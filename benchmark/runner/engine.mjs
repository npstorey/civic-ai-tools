// The run engine: the requests each configuration's rows send, the spend
// accounting and the cap (A3.2), the rows' states. run.mjs reads the
// arguments and the inputs, builds the steps and hands them here.
//
// ROW STATES. A row is complete, error, or not started; never cut by the cap.
//   - complete: every request it sent returned;
//   - error: a request failed after its attempts (three for a status that
//     may pass: no status, 408, 429 or 5xx; one for any other). It is started
//     and finished, and its spend counts;
//   - not started: the cap could not hold its reservation (or, for a
//     builder-N main row, its builder row was an error). The run then starts
//     no other row, lets the rows in flight finish, records `stopReason` and
//     the rows not started in meta.json, and exits 2.
//
// SPEND. Before a row's first request, the worst case of every request its
// configuration allows is reserved (bounds.mjs); a row is started only when
// the spend so far, the reservations in flight and its own fit under the
// cap. As each request returns, its slot is released and what it cost is
// charged (pricing.mjs, `chargeOf`): a call that returns no usage is charged
// its worst case. So the spend recorded plus every worst case in flight never
// passes the cap.

import { MAX_TOKENS, UNKNOWN_TOOL_TEXT } from './app-texts.mjs';
import { scoreLoad } from '../scoring/score.mjs';
import { chargeOf, estimateTokens, TIER_MARGIN, worstCostOver } from './pricing.mjs';
import { reservationOf, slotBounds } from './bounds.mjs';
import { baselineBody, baselineLadder, builderBody, secondBody, selectionBody } from './requests.mjs';
import { FIND_SOURCE_LIMIT, FIND_SOURCE_TEXT } from './texts.mjs';

const REQUEST_TIMEOUT_MS = 180_000;
const RETRYABLE = (s) => s === null || s === 408 || s === 429 || s >= 500;
const truncate = (s, n) => (typeof s === 'string' && s.length > n ? `${s.slice(0, n)}…[${s.length} chars]` : s);

const parseArgs = (raw) => {
  try {
    const v = JSON.parse(raw || '{}');
    return v && typeof v === 'object' ? v : {};
  } catch {
    return null;
  }
};

function summarizeMessage(msg) {
  return {
    content: truncate(msg?.content ?? null, 800),
    toolCalls: (msg?.tool_calls ?? []).map((tc) => ({ id: tc.id, name: tc.function?.name, args: truncate(tc.function?.arguments ?? '', 1500) })),
  };
}

/** The builder's selection from its response, by the preregistered output
 *  rule (texts.mjs, `BUILDER_OUTPUT_RULE`). */
export function builderSelection(msg, isAlias, cap = 25) {
  const call = (msg?.tool_calls ?? []).find((tc) => tc.function?.name === 'select_sources');
  if (!call) return { selection: [], dropped: [], outcome: 'no select_sources call' };
  const args = parseArgs(call.function.arguments);
  if (!args || !Array.isArray(args.aliases)) return { selection: [], dropped: [], outcome: 'arguments without an aliases array' };
  const kept = [];
  const dropped = [];
  for (const a of args.aliases) {
    if (typeof a === 'string' && isAlias(a)) {
      if (!kept.includes(a)) kept.push(a);
    } else dropped.push(typeof a === 'string' ? a : JSON.stringify(a));
  }
  return { selection: kept.slice(0, cap), dropped, cutAt25: Math.max(0, kept.length - cap), outcome: kept.length ? 'selection' : 'empty selection' };
}

export function createEngine({ ledger, apiKey, baseUrl, cap, writeRow, log = () => {}, fetchImpl = (...a) => fetch(...a), retryDelaysMs = [2000, 8000] }) {
  let spent = 0;
  let reserved = 0;
  let stopReason = null;

  const fits = (usd) => spent + reserved + usd <= cap;
  function reserve(usd, what) {
    if (!fits(usd)) {
      stopReason ??= `cap: $${spent.toFixed(4)} spent + $${reserved.toFixed(4)} reserved in flight + $${usd.toFixed(4)} for ${what} > $${cap}`;
      return false;
    }
    reserved += usd;
    return true;
  }

  async function chat(body) {
    const url = `${baseUrl}/chat/completions`;
    let res;
    try {
      res = await fetchImpl(url, {
        method: 'POST',
        headers: { authorization: `Bearer ${apiKey}`, 'content-type': 'application/json' },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
    } catch (e) {
      ledger.record('POST', url, `error: ${e.name}`);
      throw Object.assign(new Error(`${e.name}: ${e.message}`), { status: null });
    }
    const text = await res.text();
    let json = null;
    try {
      json = JSON.parse(text);
    } catch {
      json = null;
    }
    const failed = !res.ok || !json || json.error;
    const status = !res.ok ? res.status : json?.error ? Number(json.error.code) || 502 : res.status;
    ledger.record('POST', url, failed ? `${status} (refused)` : status);
    if (failed) throw Object.assign(new Error(`HTTP ${status}: ${truncate(json?.error ? JSON.stringify(json.error) : text, 600)}`), { status });
    return json;
  }

  /** One request of a row, against its slot of the row's reservation. */
  async function call(mi, body, slot) {
    const limit = body.max_tokens ?? body.max_completion_tokens ?? MAX_TOKENS;
    const worst = worstCostOver(mi.reservationPricings, Math.min(estimateTokens(body, mi.cpt), mi.contextLength ?? Infinity), limit, TIER_MARGIN);
    if (worst > slot.usd + 1e-12) {
      const extra = worst - slot.usd;
      if (!reserve(extra, 'a request past its bound')) return { status: 'not_sent', error: { status: null, message: `the request's worst case ($${worst.toFixed(6)}) passes its reserved bound and the cap leaves no room; not sent` } };
      slot.usd += extra;
      slot.toppedUp = (slot.toppedUp ?? 0) + extra;
    }
    const attempts = [];
    try {
      for (let attempt = 1; attempt <= 3; attempt++) {
        const t0 = Date.now();
        try {
          const res = await chat(body);
          const usage = res.usage ?? null;
          const cost = chargeOf(mi.listPricing, mi.reservationPricings, usage, worst);
          spent += cost.charged;
          return { status: 'ok', res, latencyMs: Date.now() - t0, attempts: attempts.length + 1, usage, cost: { ...cost, worstUsd: worst } };
        } catch (e) {
          const err = { status: e.status ?? null, message: truncate(String(e.message), 600) };
          attempts.push({ ...err, latencyMs: Date.now() - t0 });
          if (!RETRYABLE(err.status) || attempt === 3) return { status: 'error', error: err, attempts };
          await new Promise((r) => setTimeout(r, retryDelaysMs[attempt - 1]));
        }
      }
    } finally {
      reserved -= slot.usd;
      slot.usd = 0;
    }
    return { status: 'error', error: { status: null, message: 'unreachable' }, attempts };
  }

  const requestRecord = (c, body, kind, extra = {}) => ({
    kind,
    promptChars: JSON.stringify(body).length,
    latencyMs: c.latencyMs,
    attempts: c.attempts,
    usage: c.usage,
    cost: c.cost,
    finishReason: c.res.choices?.[0]?.finish_reason ?? null,
    respondedModel: c.res.model ?? null,
    ...summarizeMessage(c.res.choices?.[0]?.message),
    ...extra,
  });

  /** Reserve a row's worst case; null when the cap cannot hold it. */
  async function reserveRow({ session, kind, dir, mi, q }, key) {
    const bounds = await slotBounds({ session, kind, dir, m: mi.m, q, cpt: mi.cpt, contextLength: mi.contextLength });
    const r = reservationOf(bounds, mi.reservationPricings, TIER_MARGIN);
    if (!reserve(r.usd, key)) return null;
    return { boundsTokens: bounds, usd: r.usd, perRequest: [...r.perRequest], slots: r.perRequest.map((usd) => ({ usd })) };
  }
  const releaseRow = (resv) => {
    for (const s of resv.slots) {
      reserved -= s.usd;
      s.usd = 0;
    }
  };
  const reservationRecord = (resv) => ({ reservedUsd: resv.usd, perRequestUsd: resv.perRequest, requests: resv.slots.length, promptBoundTokens: resv.boundsTokens, toppedUpUsd: resv.slots.reduce((s, x) => s + (x.toppedUp ?? 0), 0) });

  /** The second request after loads, scored as P0 scored it. */
  async function postLoad({ session, mi, dir, body, msg, toolMessages, loaded, slot, search }) {
    const state = await dir.afterLoads(loaded.map((a) => session.entry(a).sourceId));
    const body2 = secondBody(mi.m, body, msg, toolMessages, state, { search });
    const c2 = await call(mi, body2, slot);
    if (c2.status !== 'ok') return { failed: c2, body2, state };
    const msg2 = c2.res.choices?.[0]?.message ?? {};
    const offeredByName = new Map(state.tools.map((t) => [t.function.name, t]));
    const nearMiss = (name) => {
      for (const a of loaded) if (offeredByName.has(`${a}__${name}`)) return `bare upstream name of ${a}__${name}`;
      const target = session.router.sourceForAliasedName(name);
      if (target) return `a tool of ${session.aliasOf(target.sourceId)}, which was not loaded`;
      return null;
    };
    const loaded2 = [...loaded];
    const evaluated = (msg2.tool_calls ?? []).map((tc) => {
      const name = tc.function?.name;
      const raw = tc.function?.arguments ?? '';
      if (name === 'load_source') {
        const alias = parseArgs(raw)?.alias;
        if (typeof alias === 'string' && dir.has(alias) && !loaded2.includes(alias)) loaded2.push(alias);
        return { name, kind: 'load_source', alias: typeof alias === 'string' ? alias : null };
      }
      if (name === 'find_source' && search) return { name, kind: 'find_source' };
      const tool = offeredByName.get(name);
      if (!tool) return { name, kind: 'unknown', validName: false, nearMiss: nearMiss(name), args: truncate(raw, 400) };
      const args = parseArgs(raw);
      if (args === null) return { name, kind: 'loaded', validName: true, argsParse: false, schemaValid: false, args: truncate(raw, 400) };
      const v = mi.validatorFor(tool);
      if (v.compileError) return { name, kind: 'loaded', validName: true, argsParse: true, schemaValid: null, schemaNote: v.compileError };
      const ok = v(args);
      return { name, kind: 'loaded', validName: true, argsParse: true, schemaValid: Boolean(ok), ...(ok ? {} : { schemaErrors: (v.errors ?? []).slice(0, 5).map((e) => `${e.dataPath || '/'} ${e.message}`), args: truncate(raw, 400) }) };
    });
    const loadedCalls = evaluated.filter((e) => e.kind === 'loaded');
    const unknownCalls = evaluated.filter((e) => e.kind === 'unknown');
    let outcome;
    if (loadedCalls.length && !unknownCalls.length && loadedCalls.every((e) => e.schemaValid)) outcome = 'valid_tool_call';
    else if (loadedCalls.length || unknownCalls.length) outcome = 'invalid_tool_call';
    else if (evaluated.length) outcome = 'loaded_more_only';
    else outcome = 'no_tool_call';
    return {
      second: { ...requestRecord(c2, body2, 'after-load'), evaluated, outcome, offeredToolCount: state.tools.length, definitionHash: state.definitionHash },
      loaded2,
      cost: c2.cost.charged,
    };
  }

  /** A load_source call's result text, and whether it loaded. */
  function loadResult(session, dir, alias, loaded) {
    if (typeof alias === 'string' && dir.has(alias)) {
      if (loaded.includes(alias)) return { content: session.loadResultText.alreadyLoaded(alias), ok: true };
      return { content: session.isRegistry(alias) ? session.loadResultText.registry : session.loadResultText.loaded(alias), ok: true, fresh: true };
    }
    return { content: session.loadResultText.notOffered, ok: false };
  }

  const picksOf = (session, loaded) => loaded.map((alias) => ({ alias, ...session.kindOf(alias) }));

  /** A main row: baseline-7, flat-N, shortlist-N, builder-N. */
  async function mainRow(t) {
    const { session, dir, mi, q, r, step } = t;
    const row = { key: t.key, step: step.id, config: session.config.name, role: 'main', model: mi.m.slug, spec: mi.m.spec, control: mi.m.control, qid: q.id, kind: q.kind, repeat: r, acceptable: q.acceptable, shortlist: [...dir.aliases] };
    if (!dir.ids.length) {
      return { ...row, status: 'complete', noRequest: 'empty shortlist: nothing offered, nothing can be loaded', requests: [], loaded1: [], score1: scoreLoad([], q.acceptable), second: null, loaded2: [], score2: scoreLoad([], q.acceptable), picks: [], offered: [], costUsd: 0, reservation: null };
    }
    const resv = await reserveRow({ session, kind: 'main', dir, mi, q }, row.key);
    if (!resv) return null;
    try {
      const body1 = selectionBody(dir, mi.m, q);
      const c1 = await call(mi, body1, resv.slots[0]);
      if (c1.status !== 'ok') return { ...row, status: 'error', first: { error: c1.error, attempts: c1.attempts }, requests: [], offered: [...dir.aliases], costUsd: 0, reservation: reservationRecord(resv) };
      const msg1 = c1.res.choices?.[0]?.message ?? {};
      const calls1 = msg1.tool_calls ?? [];
      const loaded = [];
      const invalidAliases = [];
      const otherCalls = [];
      const toolMessages = [];
      for (const tc of calls1) {
        const name = tc.function?.name;
        let content;
        if (name === 'load_source') {
          const res = loadResult(session, dir, parseArgs(tc.function.arguments)?.alias, loaded);
          if (res.fresh) loaded.push(parseArgs(tc.function.arguments).alias);
          if (!res.ok) invalidAliases.push(tc.function?.arguments ?? '');
          content = res.content;
        } else {
          otherCalls.push(name);
          content = UNKNOWN_TOOL_TEXT(name);
        }
        toolMessages.push({ role: 'tool', tool_call_id: tc.id, content });
      }
      row.first = {
        ...requestRecord(c1, body1, 'selection', { directoryChars: dir.system.length }),
        firstCallName: calls1[0]?.function?.name ?? null,
        loadCalls: calls1.filter((tc) => tc.function?.name === 'load_source').length,
        invalidAliases,
        otherCalls,
        definitionHash: session.hashes().firstRequestDefinitionHash,
      };
      row.firstCallIsLoad = calls1[0]?.function?.name === 'load_source';
      row.loaded1 = [...loaded];
      row.score1 = scoreLoad(loaded, q.acceptable);
      row.picks = picksOf(session, loaded);
      row.offered = [...dir.aliases];
      if (!loaded.length) return { ...row, status: 'complete', second: null, loaded2: [], score2: row.score1, costUsd: c1.cost.charged, reservation: reservationRecord(resv) };
      const p = await postLoad({ session, mi, dir, body: body1, msg: msg1, toolMessages, loaded, slot: resv.slots[1], search: false });
      if (p.failed) return { ...row, status: 'error', second: { error: p.failed.error, attempts: p.failed.attempts, promptChars: JSON.stringify(p.body2).length }, loaded2: [...loaded], score2: row.score1, costUsd: c1.cost.charged, reservation: reservationRecord(resv) };
      return { ...row, status: 'complete', second: p.second, loaded2: p.loaded2, score2: scoreLoad(p.loaded2, q.acceptable), costUsd: c1.cost.charged + p.cost, reservation: reservationRecord(resv) };
    } finally {
      releaseRow(resv);
    }
  }

  /** A shortlist+search-N row: up to three selection requests with
   *  `find_source` beside `load_source` (at most two searches run), then the
   *  request after the loads. */
  async function searchRow(t) {
    const { session, dir, mi, q, r, step, index } = t;
    const row = { key: t.key, step: step.id, config: session.config.name, role: 'main', model: mi.m.slug, spec: mi.m.spec, control: mi.m.control, qid: q.id, kind: q.kind, repeat: r, acceptable: q.acceptable, shortlist: [...dir.aliases], searches: [] };
    const resv = await reserveRow({ session, kind: 'search', dir, mi, q }, row.key);
    if (!resv) return null;
    const requests = [];
    let cost = 0;
    const found = [];
    const history = [];
    let searchesRun = 0;
    let limitTexts = 0;
    try {
      for (let round = 1; round <= 1 + FIND_SOURCE_LIMIT; round++) {
        const cur = session.directoryFor([...dir.ids, ...found.map((a) => session.entry(a).sourceId)]);
        const body = selectionBody(cur, mi.m, q, { search: true, history });
        const c = await call(mi, body, resv.slots[round - 1]);
        if (c.status !== 'ok') return { ...row, status: 'error', failedRequest: { round, error: c.error, attempts: c.attempts }, requests, offered: cur.aliases, costUsd: cost, reservation: reservationRecord(resv) };
        cost += c.cost.charged;
        const msg = c.res.choices?.[0]?.message ?? {};
        const calls = msg.tool_calls ?? [];
        const loaded = [];
        const invalidAliases = [];
        const otherCalls = [];
        const toolMessages = [];
        let searched = false;
        for (const tc of calls) {
          const name = tc.function?.name;
          let content;
          if (name === 'load_source') {
            const alias = parseArgs(tc.function.arguments)?.alias;
            const res = loadResult(session, cur, alias, loaded);
            if (res.fresh) loaded.push(alias);
            if (!res.ok) invalidAliases.push(tc.function?.arguments ?? '');
            content = res.content;
          } else if (name === 'find_source') {
            searched = true;
            if (searchesRun < FIND_SOURCE_LIMIT) {
              searchesRun++;
              const query = parseArgs(tc.function.arguments)?.query;
              const hits = index.search(typeof query === 'string' ? query : '');
              row.searches.push({ query: typeof query === 'string' ? query : '', hits, round });
              for (const h of hits) if (!found.includes(h)) found.push(h);
              content = hits.length ? FIND_SOURCE_TEXT.found(hits) : FIND_SOURCE_TEXT.none;
            } else {
              limitTexts++;
              content = FIND_SOURCE_TEXT.limit;
            }
          } else {
            otherCalls.push(name);
            content = UNKNOWN_TOOL_TEXT(name);
          }
          toolMessages.push({ role: 'tool', tool_call_id: tc.id, content });
        }
        requests.push({ ...requestRecord(c, body, 'selection', { round, directory: cur.aliases.length, directoryChars: cur.system.length, invalidAliases, otherCalls }), definitionHash: session.hashes().firstRequestDefinitionHash });
        if (loaded.length) {
          // The load step: the loads of this response are the row's first loads.
          row.first = { ...requests.at(-1), firstCallName: calls[0]?.function?.name ?? null, loadCalls: calls.filter((x) => x.function?.name === 'load_source').length };
          row.firstCallIsLoad = round === 1 && calls[0]?.function?.name === 'load_source';
          row.loadRound = round;
          row.loaded1 = [...loaded];
          row.score1 = scoreLoad(loaded, q.acceptable);
          row.picks = picksOf(session, loaded);
          const after = session.directoryFor([...dir.ids, ...found.map((a) => session.entry(a).sourceId)]);
          row.offered = after.aliases;
          const p = await postLoad({ session, mi, dir: after, body, msg, toolMessages, loaded, slot: resv.slots[1 + FIND_SOURCE_LIMIT], search: true });
          if (p.failed) return { ...row, status: 'error', requests, second: { error: p.failed.error, attempts: p.failed.attempts }, loaded2: [...loaded], score2: row.score1, limitTexts, costUsd: cost, reservation: reservationRecord(resv) };
          return { ...row, status: 'complete', requests, second: p.second, loaded2: p.loaded2, score2: scoreLoad(p.loaded2, q.acceptable), limitTexts, costUsd: cost + p.cost, reservation: reservationRecord(resv) };
        }
        history.push(msg, ...toolMessages);
        if (!searched) break;
      }
      const last = session.directoryFor([...dir.ids, ...found.map((a) => session.entry(a).sourceId)]);
      row.first = { ...requests.at(-1), firstCallName: requests.at(-1)?.toolCalls?.[0]?.name ?? null, loadCalls: 0 };
      row.firstCallIsLoad = false;
      return { ...row, status: 'complete', requests, loadRound: null, loaded1: [], score1: scoreLoad([], q.acceptable), picks: [], offered: last.aliases, second: null, loaded2: [], score2: scoreLoad([], q.acceptable), limitTexts, costUsd: cost, reservation: reservationRecord(resv) };
    } finally {
      releaseRow(resv);
    }
  }

  /** A builder row: one request, the selection read by the output rule. */
  async function builderRow(t) {
    const { session, mi, q, step } = t;
    const row = { key: t.key, step: step.id, config: session.config.name, role: 'builder', model: mi.m.slug, spec: mi.m.spec, qid: q.id, kind: q.kind, acceptable: q.acceptable };
    const resv = await reserveRow({ session, kind: 'builder-read', dir: session.full, mi, q }, row.key);
    if (!resv) return null;
    try {
      const body = builderBody(session.full, mi.m, q);
      const c = await call(mi, body, resv.slots[0]);
      if (c.status !== 'ok') return { ...row, status: 'error', request: { error: c.error, attempts: c.attempts }, costUsd: 0, reservation: reservationRecord(resv) };
      const sel = builderSelection(c.res.choices?.[0]?.message, (a) => Boolean(session.entry(a)));
      return { ...row, status: 'complete', request: requestRecord(c, body, 'builder'), ...sel, shortlist: sel.selection, costUsd: c.cost.charged, reservation: reservationRecord(resv) };
    } finally {
      releaseRow(resv);
    }
  }

  /** A rule-N row: BM25 with the question as the query; no request. */
  const ruleRow = (t) => ({
    key: t.key,
    step: t.step.id,
    config: t.session.config.name,
    role: 'rule',
    model: null,
    spec: 'rule',
    qid: t.q.id,
    kind: t.q.kind,
    acceptable: t.q.acceptable,
    status: 'complete',
    shortlist: [],
    searches: [{ query: t.q.text, hits: t.index.search(t.q.text) }],
    costUsd: 0,
  });

  /** A token baseline (P0's single-configuration runs): the ladder of
   *  `baselineLadder`; a step that returns no usage is re-sent at the next
   *  step (R8). Each step is reserved before it is sent. */
  async function baselineTask(t) {
    const { mi, name, b } = t;
    const out = { key: t.key, model: mi.m.slug, spec: mi.m.spec, baseline: name };
    const tried = [];
    let lastOk = null;
    for (const step of baselineLadder(mi.m)) {
      const body = baselineBody(mi.m, b, step.params);
      const worst = worstCostOver(mi.reservationPricings, estimateTokens(body, mi.cpt), step.limit, TIER_MARGIN);
      const slot = { usd: worst };
      if (!reserve(worst, out.key)) return null;
      const c = await call(mi, body, slot);
      if (c.status === 'ok' && c.usage) return { ...out, status: 'complete', sent: step.note, toolCount: b.tools.length, systemChars: b.system.length, usage: c.usage, cost: c.cost, latencyMs: c.latencyMs, tried };
      if (c.status === 'ok') {
        lastOk = { step, c };
        tried.push({ sent: step.note, note: 'no usage returned', cost: c.cost });
      } else tried.push({ sent: step.note, error: c.error });
    }
    if (lastOk) return { ...out, status: 'complete', sent: lastOk.step.note, toolCount: b.tools.length, systemChars: b.system.length, usage: null, cost: lastOk.c.cost, latencyMs: lastOk.c.latencyMs, tried };
    return { ...out, status: 'error', tried };
  }

  const runners = { main: mainRow, search: searchRow, builder: builderRow, rule: async (t) => ruleRow(t), baseline: baselineTask };

  /** Run `tasks` (in order, `concurrency` at a time) until done or stopped.
   *  Returns the keys not started. */
  async function runTasks(tasks, concurrency) {
    let next = 0;
    const notStarted = [];
    async function worker() {
      while (next < tasks.length) {
        const t = tasks[next++];
        if (stopReason) {
          notStarted.push(t.key);
          continue;
        }
        const out = await runners[t.type](t);
        if (out === null) {
          notStarted.push(t.key);
          continue;
        }
        writeRow(t.type === 'baseline' ? 'baseline' : 'row', out);
        log(t, out, { spent, reserved });
      }
    }
    await Promise.all(Array.from({ length: concurrency }, worker));
    return notStarted;
  }

  return {
    runTasks,
    stop: (why) => {
      stopReason ??= why;
    },
    get spent() {
      return spent;
    },
    set priorSpend(v) {
      spent = v;
    },
    get reserved() {
      return reserved;
    },
    get stopReason() {
      return stopReason;
    },
  };
}
