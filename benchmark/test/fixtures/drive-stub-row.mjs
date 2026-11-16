// Run under the no-network preload (`node --import ./no-network.mjs`) by the
// stub transport's tests (S3-C; stub-transport.test.mjs): drives rows of
// `builder+search-50` (design §1.4's E) through the engine to their end, with
// the model's replies supplied to the engine as its `fetchImpl`
// (runner/engine.mjs) and scripted here. The global `fetch` and every socket
// stay the preload's, which throw; so any fetch but the engine's model
// request, or any socket, fails the run.
//
// Usage: node --import <no-network.mjs> drive-stub-row.mjs <scenario> <out dir> [qid]
//
// Writes, in <out dir>: `rows.jsonl` and `meta.json` (a probe's run
// directory, mode `probe`, which calibration.mjs --stub-probe reads),
// `requests.jsonl` (every body the engine sent) and `fetches.jsonl` (every
// call of the engine's fetch: its URL and method). Prints one JSON line: the
// preload's state at the end.
//
// The selection is S1's recorded one (builder-50-reads, S1's committed run).
// Both models run one row each. Scenarios, by what the scripted model does:
//   answer        search and an unknown call; a load; after it, a loaded
//                 tool, its bare upstream name, find_source and an unknown
//                 name; then the loaded tool again and a second load; then an
//                 answer that says what could not be checked;
//   bound         a loaded tool's call on every response: the loop's bound,
//                 then the answering turn;
//   empty         after the load, an empty response: the answering turn;
//   announcement  after the load, a response that announces a query;
//   size          after the load, a loaded tool's call with a long text: the
//                 next request passes the size limit;
//   error         after the load, HTTP 400 on the next request;
//   probe         as `answer`, as a probe row: the forced answering request.

import { mkdirSync, readFileSync, writeFileSync, appendFileSync } from 'node:fs';
import net from 'node:net';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const [scenario, out, qidArg] = process.argv.slice(2);
const REPO = fileURLToPath(new URL('../../../', import.meta.url));
const at = (rel) => join(REPO, rel);
const { createEngine } = await import(at('benchmark/runner/engine.mjs'));
const { createSession } = await import(at('benchmark/runner/session.mjs'));
const { createIndex } = await import(at('benchmark/runner/search.mjs'));
const { resolveModel, reservationPricings } = await import(at('benchmark/runner/models.mjs'));
const { pricingPerMillion } = await import(at('benchmark/runner/pricing.mjs'));
const { jsonDocument, jsonLine } = await import(at('benchmark/runner/writer.mjs'));
const { default: Ajv } = await import('ajv');

mkdirSync(out, { recursive: true });
const S1_ROWS = 'benchmark/runs/2026-11-05/2026-11-05-run-191511/rows.jsonl';
const qid = qidArg ?? 'q34';
const inventory = JSON.parse(readFileSync(at('benchmark/inventories/50.json'), 'utf8'));
const question = JSON.parse(readFileSync(at('benchmark/questions/50.json'), 'utf8')).questions.find((q) => q.id === qid);
const recorded = readFileSync(at(S1_ROWS), 'utf8')
  .split('\n')
  .filter((l) => l.includes('"role":"builder"'))
  .map((l) => JSON.parse(l))
  .find((r) => r.step === 'builder-50-reads' && r.qid === qid);
const session = await createSession({ inventory, configName: 'builder+search-50', today: '2026-11-05', routerPackage: JSON.parse(readFileSync(at('packages/civic-typed-router/package.json'), 'utf8')) });
const snapshot = JSON.parse(readFileSync(at('benchmark/runner/openrouter-models.json'), 'utf8'));
const ajv = new Ajv({ allErrors: true, unknownFormats: 'ignore', schemaId: 'auto' });
const validators = new Map();
const validatorFor = (tool) => {
  if (!validators.has(tool.function.name)) {
    const schema = JSON.parse(JSON.stringify(tool.function.parameters ?? { type: 'object' }));
    delete schema.$schema;
    try {
      validators.set(tool.function.name, ajv.compile(schema));
    } catch (e) {
      validators.set(tool.function.name, { compileError: String(e.message) });
    }
  }
  return validators.get(tool.function.name);
};
const infoOf = (slug) => {
  const m = resolveModel(slug);
  const row = snapshot.data.find((x) => x.id === m.slug);
  const listPricing = row.pricing.unit ? row.pricing : pricingPerMillion(row.pricing);
  return { m, listPricing, reservationPricings: reservationPricings(m, { pricing: listPricing }, snapshot.endpoints[m.slug]), cpt: 2, contextLength: row.context_length, validatorFor };
};

// --- The scripted model ---
const call = (id, name, args) => ({ id, type: 'function', function: { name, arguments: typeof args === 'string' ? args : JSON.stringify(args) } });
const reply = (status, body) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
function respond(body) {
  const assistants = body.messages.filter((m) => m.role === 'assistant').length;
  const names = (body.tools ?? []).map((t) => t.function.name);
  const enumOf = body.tools?.find((t) => t.function.name === 'load_source')?.function.parameters.properties.alias.enum ?? [];
  const loadedTool = names.find((n) => n.includes('__'));
  const done = (message) =>
    reply(200, {
      id: 'scripted',
      model: body.model,
      provider: 'ScriptedProvider',
      choices: [{ index: 0, message: { role: 'assistant', content: null, ...message }, finish_reason: message.tool_calls ? 'tool_calls' : 'stop' }],
      usage: { prompt_tokens: Math.ceil(JSON.stringify(body).length / 4), completion_tokens: 20, total_tokens: 0, cost: 0.00001 },
    });
  if (assistants === 0) return done({ tool_calls: [call('a1', 'find_source', { query: 'Boston city council and census figures' }), call('a2', 'get_data', {})] });
  if (assistants === 1) return done({ tool_calls: [call('b1', 'load_source', { alias: enumOf[0] })] });
  // From here, S1's last request (after the load) and the stub's.
  const after = assistants - 2;
  if (scenario === 'answer' || scenario === 'probe') {
    if (after === 0) return done({ tool_calls: [call('c1', loadedTool, {}), call('c2', loadedTool.split('__')[1], {}), call('c3', 'find_source', { query: 'decennial census population' }), call('c4', 'nope_tool', '{}')] });
    if (after === 1) return done({ tool_calls: [call('d1', loadedTool, { q: 1 }), call('d2', 'load_source', { alias: enumOf.find((a) => a !== enumOf[0]) ?? enumOf[0] })] });
    return done({ content: 'The records could not be checked: each query returned no rows, so the figures the question asks for are not available here.' });
  }
  if (scenario === 'bound') {
    if (!names.length) return done({ content: 'There were no matching records.' });
    return done({ tool_calls: [call(`x${after}`, loadedTool, {})] });
  }
  if (scenario === 'empty') {
    if (!names.length) return done({ content: 'No answer can be given from the data collected.' });
    return done({ content: '' });
  }
  if (scenario === 'announcement') {
    if (!names.length) return done({ content: 'The council met twice.' });
    return done({ content: "I'll query the dataset for the figures next." });
  }
  if (scenario === 'size') return done({ content: 'x'.repeat(130_000), tool_calls: [call('s1', loadedTool, {})] });
  if (scenario === 'error') {
    if (after === 0) return done({ tool_calls: [call('e1', loadedTool, {})] });
    return reply(400, { error: { code: 400, message: 'scripted refusal' } });
  }
  throw new Error(`unknown scenario ${scenario}`);
}

const fetchImpl = async (url, init) => {
  appendFileSync(join(out, 'fetches.jsonl'), `${JSON.stringify({ url: String(url), method: init?.method ?? 'GET' })}\n`);
  const body = JSON.parse(init.body);
  appendFileSync(join(out, 'requests.jsonl'), `${JSON.stringify(body)}\n`);
  return respond(body);
};

const rows = [];
const engine = createEngine({ ledger: { record() {} }, apiKey: 'scripted-not-a-credential', baseUrl: 'https://openrouter.ai/api/v1', cap: 5, writeRow: (_, row) => rows.push(row), retryDelaysMs: [0, 0], fetchImpl });
const dir = session.directoryFor(recorded.selection.map((a) => session.entry(a).sourceId));
const index = createIndex(inventory.entries);
const tasks = ['anthropic/claude-haiku-5.5', 'z-ai/glm-5.3-flash'].map((spec) => ({
  type: 'search',
  key: `probe-builder+search-50|${spec}|${qid}|1`,
  step: { id: 'probe-builder+search-50' },
  session,
  index,
  dir,
  mi: infoOf(spec),
  q: question,
  r: 1,
  transport: 'stub',
  ...(scenario === 'probe' ? { probe: true } : {}),
}));
await engine.runTasks(tasks, 1);
writeFileSync(join(out, 'rows.jsonl'), rows.map(jsonLine).join(''));
writeFileSync(join(out, 'meta.json'), jsonDocument({ runId: `driven-${scenario}`, mode: 'probe', today: '2026-11-05', steps: [{ id: 'probe-builder+search-50', config: 'builder+search-50', rows: rows.length, transport: 'stub' }] }));

// The preload is still in force: a fetch and a socket are refused.
let fetchRefused = false;
try {
  await fetch('https://example.invalid/');
} catch (e) {
  fetchRefused = /no-network preload/.test(String(e.message));
}
let socketRefused = false;
try {
  new net.Socket().connect(443, 'example.invalid');
} catch (e) {
  socketRefused = /no-network preload/.test(String(e.message));
}
console.log(JSON.stringify({ scenario, rows: rows.length, fetchRefused, socketRefused, selection: recorded.selection }));
