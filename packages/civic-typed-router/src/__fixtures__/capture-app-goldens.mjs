#!/usr/bin/env node
// Captures app-goldens.json: the reference website's two model-facing outputs,
// taken by running the website's own exported functions at a stated commit.
//
//   1. The tools array a query route hands the model:
//        offeredMcpTools(mcpToolsFor(lockedPortal))
//   2. The composed system prompt:
//        withPortalLockGuidance(await buildSystemPrompt(portal), lockedPortal)
//
// The router package must reproduce every capture byte for byte (a pure move,
// civic-ai-tools#244). This file is the instrument; app-goldens.json beside it
// is its output and carries the inputs needed to feed the same values back.
//
// USAGE
//   node capture-app-goldens.mjs --website <path to the website repository>
//                                --commit <rev>
//                                [--out <path>]            default: app-goldens.json beside this file
//                                [--capture-date YYYY-MM-DD] default: today's UTC date
//                                [--isolation on|off]      default: on
//                                [--only <id>[,<id>...]]   capture a subset (never the committed fixture)
//
// HOW EACH CAPTURE IS TAKEN
//   - The commit is exported with `git archive` into a fresh temporary
//     directory. No website checkout is created or touched.
//   - Each configuration runs in its own child process (a fresh module graph),
//     so neither the Socrata guidance cache in socrata-skill.ts nor the
//     publication host DATA_COMMONS_SKILL reads at module load can carry from
//     one configuration into the next. `--isolation off` runs the whole
//     sequence in ONE child, swapping the environment between steps; it exists
//     to show the leak the isolation prevents and never writes the fixture
//     unless --out is given.
//   - The child's environment is exactly the configuration's variables:
//     nothing is inherited from the parent.
//   - The clock is fixed: `new Date()` and `Date.now()` return FIXED_INSTANT.
//   - `src/lib/mcp/client.ts` is replaced, by an in-file `module.registerHooks()`
//     load hook, with a stub exporting `callMcpPrompt` and
//     `getServerInstructions` that answer from this file's fixture strings and
//     log each call. Every other module is the website's own, type-stripped
//     by Node. `fetch` is replaced with a function that throws, so a capture
//     cannot reach the network.
//   - The lock and the portal are driven through the website's own
//     `resolveRunPortal(undefined)` with SITE_PORTAL_LOCKED and
//     SITE_DEFAULT_PORTAL, as a route does for a request that names no portal.
//
// ENCODING. JSON drops `undefined`; a value that is `undefined` (including an
// own key whose value is `undefined`) is written as {"$undefined": true}.

import { spawnSync, execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const SCRIPT_FILE = fileURLToPath(import.meta.url);
const SCRIPT_REPO_PATH = 'packages/civic-typed-router/src/__fixtures__/capture-app-goldens.mjs';

// ---------------------------------------------------------------------------
// Fixed inputs
// ---------------------------------------------------------------------------

const FIXED_INSTANT = '2026-01-15T12:00:00.000Z';
const PLACEHOLDER_PUBLICATION_HOST = 'records.example.org';
const PLACEHOLDER_SOCRATA_MCP_URL = 'https://socrata-mcp.example.org';
const PLACEHOLDER_BOSTON_MCP_URL = 'https://boston-mcp.example.org/mcp';
const PLACEHOLDER_DATA_COMMONS_MCP_URL = 'https://data-commons-mcp.example.org/mcp';
const PLACEHOLDER_DATA_COMMONS_API_KEY = 'fixture-placeholder-not-a-real-key';
const UNKNOWN_TOOL_NAME = 'fixture_unknown_tool';

const PORTAL_NYC = 'data.cityofnewyork.us';
const PORTAL_CHICAGO = 'data.cityofchicago.org';
const PORTAL_SF = 'data.sfgov.org';
const PORTAL_UNLISTED = 'data.example.org';

// The three network inputs, as fixture text. Synthetic and neutral. Each holds
// String.prototype.replace patterns ($&, $1, $$, $`, $', ${x}), a backtick, a
// line that is exactly `---` (the composer's separator), non-ASCII text and a
// trailing newline, so that naive string handling in a reimplementation shows
// up as a byte difference. Written as joined single-quoted lines, never as a
// template literal, so `${x}` is literal here.
const FIXTURE_STRINGS = {
  socrataGuidance: [
    '# Fixture Socrata guidance (synthetic)',
    '',
    'This block stands in for the `skill-guidance` prompt a Socrata MCP server serves.',
    'It is synthetic test text and describes no deployment.',
    '',
    'Replacement patterns kept literal: $& and $1 and $$ and $` and $\' and ${x}.',
    '---',
    'Non-ASCII kept as UTF-8: café, naïve, “quoted”, ✓.',
    '    An indented line.',
    'End of the fixture Socrata guidance.',
    '',
  ].join('\n'),
  dataCommonsInstructions: [
    'Fixture Data Commons server instructions (synthetic).',
    'They stand in for the `instructions` an MCP server returns at initialize.',
    '',
    'Patterns kept literal: $1, $&, ${x}, $$.',
    '---',
    'Non-ASCII: Zürich, São Paulo, Ωmega.',
    'End of the fixture Data Commons instructions.',
    '',
  ].join('\n'),
  bostonInstructions: [
    'Fixture Boston OpenContext server instructions (synthetic).',
    'A second instructions block, distinct from the first, with `inline code`.',
    '',
    'Patterns kept literal: ${x} then $& then $1.',
    '---',
    'Non-ASCII: Montréal, Kraków, ½.',
    'End of the fixture Boston instructions.',
    '',
  ].join('\n'),
};

// ---------------------------------------------------------------------------
// The configuration set (G0-4 as amended, civic-ai-tools#244)
// ---------------------------------------------------------------------------

const LOCK_PORTAL_STATES = [
  { lock: 'off', portal: null },
  { lock: 'off', portal: PORTAL_NYC },
  { lock: 'on', portal: PORTAL_NYC },
];

function promptId(f) {
  return [
    'prompt',
    `B=${f.B}`,
    `lock=${f.lock}`,
    `portal=${f.portal ?? 'none'}`,
    `G=${f.G}`,
    `D=${f.D}`,
    `Bi=${f.Bi}`,
    `H=${f.H}`,
  ].join('|');
}

function toolsId(f) {
  return ['tools', `B=${f.B}`, `lock=${f.lock}`, `portal=${f.portal ?? 'none'}`].join('|');
}

function promptConfigurations() {
  const out = [];
  // The product: 12 with Boston unset, 24 with it set, all with the host set.
  for (const B of ['unset', 'set']) {
    for (const lp of LOCK_PORTAL_STATES) {
      for (const G of ['fetched', 'fallback']) {
        for (const D of ['present', 'null']) {
          for (const Bi of B === 'set' ? ['present', 'null'] : ['n/a']) {
            out.push({ group: 'product', B, lock: lp.lock, portal: lp.portal, G, D, Bi, H: 'set' });
          }
        }
      }
    }
  }
  // Five value cases at the base configuration, each changing one thing.
  const base = { B: 'set', lock: 'off', portal: PORTAL_NYC, G: 'fetched', D: 'present', Bi: 'present', H: 'set' };
  out.push({ group: 'value-case', ...base, portal: PORTAL_CHICAGO });
  out.push({ group: 'value-case', ...base, portal: PORTAL_SF });
  out.push({ group: 'value-case', ...base, portal: PORTAL_UNLISTED });
  out.push({ group: 'value-case', ...base, lock: 'on', portal: PORTAL_UNLISTED });
  out.push({ group: 'value-case', ...base, G: 'fetched-empty' });
  // One capture at the base configuration with the publication host unset.
  out.push({ group: 'host-unset', ...base, H: 'unset' });
  return out.map((f) => ({ id: promptId(f), ...f }));
}

function toolsConfigurations() {
  const out = [];
  for (const B of ['unset', 'set']) {
    out.push({ B, lock: 'off', portal: null });
    out.push({ B, lock: 'on', portal: PORTAL_NYC });
  }
  out.push({ B: 'set', lock: 'on', portal: PORTAL_UNLISTED });
  return out.map((f) => ({ id: toolsId(f), ...f }));
}

// readMcpEnvFromProcess() at its edges: one variable changed per case.
const ENV_EDGE_CASES = [
  { id: 'env|all-unset', env: {} },
  { id: 'env|BOSTON_OPENCONTEXT_MCP_URL=empty', env: { BOSTON_OPENCONTEXT_MCP_URL: '' } },
  { id: 'env|BOSTON_OPENCONTEXT_MCP_URL=whitespace', env: { BOSTON_OPENCONTEXT_MCP_URL: '   ' } },
  { id: 'env|BOSTON_OPENCONTEXT_MCP_URL=set', env: { BOSTON_OPENCONTEXT_MCP_URL: PLACEHOLDER_BOSTON_MCP_URL } },
  { id: 'env|DATA_COMMONS_MCP_URL=empty', env: { DATA_COMMONS_MCP_URL: '' } },
  { id: 'env|DATA_COMMONS_MCP_URL=whitespace', env: { DATA_COMMONS_MCP_URL: '   ' } },
  { id: 'env|DATA_COMMONS_MCP_URL=set', env: { DATA_COMMONS_MCP_URL: PLACEHOLDER_DATA_COMMONS_MCP_URL } },
  { id: 'env|DATA_COMMONS_API_KEY=empty', env: { DATA_COMMONS_API_KEY: '' } },
  { id: 'env|DATA_COMMONS_API_KEY=set', env: { DATA_COMMONS_API_KEY: PLACEHOLDER_DATA_COMMONS_API_KEY } },
  { id: 'env|SOCRATA_MCP_URL=empty', env: { SOCRATA_MCP_URL: '' } },
  { id: 'env|SOCRATA_MCP_URL=whitespace', env: { SOCRATA_MCP_URL: '   ' } },
  { id: 'env|SOCRATA_MCP_URL=set', env: { SOCRATA_MCP_URL: PLACEHOLDER_SOCRATA_MCP_URL } },
];

// Where the two outputs reach the model, verified against the exported tree.
const CALL_SITES = {
  prompt: [
    { path: 'src/app/api/compare/route.ts', line: 140 },
    { path: 'src/app/api/compare-stream/route.ts', line: 210 },
    { path: 'src/app/api/query-notebook/route.ts', line: 255 },
  ],
  tools: [
    { path: 'src/lib/model-loop/compare-loop.ts', line: 132 },
    { path: 'src/app/api/query-notebook/route.ts', line: 561 },
    { path: 'src/app/api/compare-stream/route.ts', line: 284 },
  ],
  replayTools: [{ path: 'src/lib/model-loop/replay-loop.ts', line: 299 }],
};
const PROMPT_EXPRESSION = 'withPortalLockGuidance(await buildSystemPrompt(portal), lockedPortal)';
const TOOLS_EXPRESSION = 'offeredMcpTools(mcpToolsFor(lockedPortal))';
const REPLAY_TOOLS_EXPRESSION = 'tools: mcpTools,';

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

function sha256(text) {
  return createHash('sha256').update(text).digest('hex');
}

function encode(value) {
  if (value === undefined) return { $undefined: true };
  if (value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map(encode);
  const out = {};
  for (const key of Object.keys(value)) out[key] = encode(value[key]);
  return out;
}

function configEnv(f) {
  const env = { SOCRATA_MCP_URL: PLACEHOLDER_SOCRATA_MCP_URL };
  if (f.B === 'set') env.BOSTON_OPENCONTEXT_MCP_URL = PLACEHOLDER_BOSTON_MCP_URL;
  if (f.portal !== null) env.SITE_DEFAULT_PORTAL = f.portal;
  if (f.lock === 'on') env.SITE_PORTAL_LOCKED = 'true';
  if (f.H === 'set') env.PUBLISHER_PUBLICATION_HOST = PLACEHOLDER_PUBLICATION_HOST;
  return env;
}

function clientFixture(f) {
  const guidance =
    f.G === 'fetched'
      ? { kind: 'returns', fixture: 'socrataGuidance' }
      : f.G === 'fetched-empty'
        ? { kind: 'returns', text: '' }
        : { kind: 'throws' };
  const instructions = {
    'data-commons': f.D === 'present' ? { fixture: 'dataCommonsInstructions' } : null,
  };
  if (f.B === 'set') {
    instructions['boston-opencontext'] = f.Bi === 'present' ? { fixture: 'bostonInstructions' } : null;
  }
  return { guidance, instructions };
}

// ---------------------------------------------------------------------------
// Child: one module graph, one or more steps
// ---------------------------------------------------------------------------

const CLIENT_STUB_SOURCE = `
const state = () => globalThis.__APP_GOLDENS_CLIENT__;
function resolveText(entry) {
  if (entry === null || entry === undefined) return null;
  if (Object.hasOwn(entry, 'fixture')) return state().strings[entry.fixture];
  return entry.text;
}
export async function callMcpPrompt(name, args) {
  const s = state();
  const call = { fn: 'callMcpPrompt', args: JSON.parse(JSON.stringify([name, args])) };
  s.calls.push(call);
  if (s.fixture.guidance.kind === 'throws') {
    call.outcome = 'threw';
    throw new Error('fixture: the Socrata prompt fetch fails');
  }
  call.outcome = 'returned';
  return resolveText(s.fixture.guidance);
}
export async function getServerInstructions(sourceId) {
  const s = state();
  const call = { fn: 'getServerInstructions', args: [sourceId] };
  s.calls.push(call);
  const entry = Object.hasOwn(s.fixture.instructions, sourceId) ? s.fixture.instructions[sourceId] : null;
  const text = resolveText(entry);
  call.outcome = text === null ? 'returned-null' : 'returned';
  return text;
}
`;

async function runChild() {
  const job = JSON.parse(fs.readFileSync(0, 'utf8'));
  const treeRoot = fs.realpathSync(job.treeRoot);
  const treeUrl = pathToFileURL(treeRoot + path.sep).href;
  const clientUrl = pathToFileURL(path.join(treeRoot, 'src/lib/mcp/client.ts')).href;

  // Console: app modules log; keep stdout for the result.
  const logs = [];
  for (const method of ['log', 'info', 'warn', 'error', 'debug']) {
    console[method] = (...args) => logs.push([method, args.map((a) => (typeof a === 'string' ? a : String(a))).join(' ')]);
  }

  // No network.
  globalThis.fetch = () => {
    throw new Error('app-goldens capture: network access is not allowed');
  };

  // Fixed clock.
  const fixedMs = Date.parse(job.instant);
  const RealDate = Date;
  class FixedDate extends RealDate {
    constructor(...args) {
      if (args.length === 0) super(fixedMs);
      else super(...args);
    }
    static now() {
      return fixedMs;
    }
  }
  globalThis.Date = FixedDate;

  // client.ts replaced; every module the graph loads is recorded.
  const loaded = [];
  let stubServed = false;
  const { registerHooks } = await import('node:module');
  registerHooks({
    load(url, context, nextLoad) {
      if (!url.startsWith('node:') && !url.startsWith(treeUrl) && url !== pathToFileURL(SCRIPT_FILE).href) {
        throw new Error(`app-goldens capture: a module outside the exported tree was loaded: ${url}`);
      }
      if (url.startsWith(treeUrl)) loaded.push(url.slice(treeUrl.length));
      if (url === clientUrl) {
        stubServed = true;
        return { format: 'module', source: CLIENT_STUB_SOURCE, shortCircuit: true };
      }
      return nextLoad(url, context);
    },
  });

  const mod = (rel) => import(pathToFileURL(path.join(treeRoot, rel)).href);
  const results = [];
  for (const step of job.steps) {
    for (const key of Object.keys(process.env)) delete process.env[key];
    Object.assign(process.env, step.env);
    const clientState = { strings: job.strings, fixture: step.client ?? { guidance: { kind: 'throws' }, instructions: {} }, calls: [] };
    globalThis.__APP_GOLDENS_CLIENT__ = clientState;

    const siteConfig = await mod('src/lib/site-config.ts');
    const skill = await mod('src/lib/mcp/socrata-skill.ts');
    const tools = await mod('src/lib/mcp/tools.ts');
    const registry = await mod('src/lib/mcp/registry.ts');
    const opTypes = await mod('src/lib/mcp/operation-types.ts');
    // The stub, not the real client, must be what socrata-skill.ts linked.
    if (!stubServed) throw new Error('app-goldens capture: client.ts was not replaced by the stub');

    const result = { id: step.id };
    if (step.kind === 'prompt' || step.kind === 'tools') {
      const resolution = siteConfig.resolveRunPortal(undefined);
      if (!resolution.ok) throw new Error(`resolveRunPortal refused for ${step.id}`);
      const { portal, lockedPortal } = resolution;
      result.resolved = encode({ portal, lockedPortal });
      result.configured = encode(registry.readMcpEnvFromProcess());
      if (step.kind === 'prompt') {
        result.publicationHost = encode(siteConfig.getPublicationHost());
        result.today = new Date().toISOString().split('T')[0];
        // The routes' expression, verbatim.
        result.output = skill.withPortalLockGuidance(await skill.buildSystemPrompt(portal), lockedPortal);
        result.clientCalls = clientState.calls;
        // Every offered source asked the stub once; nothing else did.
        const expectedCalls = ['callMcpPrompt', 'getServerInstructions:data-commons'];
        if (Object.hasOwn(step.client.instructions, 'boston-opencontext')) expectedCalls.push('getServerInstructions:boston-opencontext');
        const seenCalls = clientState.calls.map((c) => (c.fn === 'callMcpPrompt' ? c.fn : `${c.fn}:${c.args[0]}`));
        if (JSON.stringify(seenCalls) !== JSON.stringify(expectedCalls)) {
          const message = `app-goldens capture: ${step.id} made client calls ${JSON.stringify(seenCalls)}, expected ${JSON.stringify(expectedCalls)}`;
          // With isolation off the guidance cache can skip the fetch: that is
          // the leak being demonstrated, so it is recorded, not fatal.
          if (job.strictClientCalls) throw new Error(message);
          result.clientCallsMismatch = message;
        }
      } else {
        const bare = tools.mcpToolsFor(lockedPortal);
        const offered = tools.offeredMcpTools(bare);
        result.output = JSON.stringify(offered);
        result.identity = {
          offeredIsBare: offered === bare,
          offeredIsMcpTools: offered === tools.mcpTools,
          bareIsMcpTools: bare === tools.mcpTools,
        };
        result.bareSha256 = sha256(JSON.stringify(bare));
        result.mcpToolsSha256 = sha256(JSON.stringify(tools.mcpTools));
        result.clientCalls = clientState.calls;
      }
    } else if (step.kind === 'fact-source-map') {
      const names = tools.mcpTools.map((t) => t.function.name);
      result.value = [...names, UNKNOWN_TOOL_NAME].map((tool) => ({ tool, sourceId: encode(opTypes.sourceIdForToolName(tool)) }));
    } else if (step.kind === 'fact-offered') {
      const configured = registry.readMcpEnvFromProcess();
      result.value = {
        withheldToolNames: registry.withheldToolNames(configured),
        offeredSkillSources: skill.offeredSkillSources(),
      };
    } else if (step.kind === 'fact-env') {
      const read = registry.readMcpEnvFromProcess();
      result.value = { keys: Object.keys(read), result: encode(read) };
    } else {
      throw new Error(`unknown step kind ${step.kind}`);
    }
    results.push(result);
  }
  process.stdout.write(JSON.stringify({ results, loaded: [...new Set(loaded)].sort(), logCount: logs.length }));
}

// ---------------------------------------------------------------------------
// Parent
// ---------------------------------------------------------------------------

function parseArgs(argv) {
  const args = { isolation: 'on' };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const next = () => {
      const v = argv[++i];
      if (v === undefined) throw new Error(`${a} needs a value`);
      return v;
    };
    if (a === '--website') args.website = next();
    else if (a === '--commit') args.commit = next();
    else if (a === '--out') args.out = next();
    else if (a === '--capture-date') args.captureDate = next();
    else if (a === '--isolation') args.isolation = next();
    else if (a === '--only') args.only = next().split(',');
    else throw new Error(`unknown argument ${a}`);
  }
  if (!args.website || !args.commit) throw new Error('--website and --commit are required');
  if (!['on', 'off'].includes(args.isolation)) throw new Error('--isolation is on or off');
  if (args.isolation === 'off' && !args.out) throw new Error('--isolation off never writes the committed fixture; pass --out');
  if (args.only && !args.out) throw new Error('--only never writes the committed fixture; pass --out');
  args.captureDate ??= new Date().toISOString().split('T')[0];
  if (!/^\d{4}-\d{2}-\d{2}$/.test(args.captureDate)) throw new Error('--capture-date is YYYY-MM-DD');
  args.out ??= path.join(path.dirname(SCRIPT_FILE), 'app-goldens.json');
  return args;
}

function exportTree(website, commit) {
  const fullSha = execFileSync('git', ['-C', website, 'rev-parse', '--verify', `${commit}^{commit}`], { encoding: 'utf8' }).trim();
  // realpath: Node keys a module by its resolved path, so the load hook's URL
  // comparison must use it too (a symlinked temp directory, such as /tmp on
  // macOS, otherwise lets the real client.ts load).
  const tmp = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'app-goldens-')));
  const tree = path.join(tmp, 'tree');
  fs.mkdirSync(tree);
  const tar = path.join(tmp, 'export.tar');
  execFileSync('git', ['-C', website, 'archive', '--format=tar', '-o', tar, fullSha]);
  execFileSync('tar', ['-xf', tar, '-C', tree]);
  return { fullSha, tmp, tree };
}

function verifyCallSites(tree) {
  const check = (sites, needle) =>
    sites.map(({ path: rel, line }) => {
      const text = fs.readFileSync(path.join(tree, rel), 'utf8').split('\n')[line - 1] ?? '';
      if (!text.includes(needle)) throw new Error(`call site ${rel}:${line} does not contain ${needle}`);
      return { path: rel, line, text: text.trim() };
    });
  return {
    prompt: check(CALL_SITES.prompt, PROMPT_EXPRESSION),
    tools: check(CALL_SITES.tools, TOOLS_EXPRESSION),
    replayTools: check(CALL_SITES.replayTools, REPLAY_TOOLS_EXPRESSION),
  };
}

function runSteps(tree, steps, env) {
  const job = { treeRoot: tree, instant: FIXED_INSTANT, strings: FIXTURE_STRINGS, steps, strictClientCalls: steps.length === 1 };
  const r = spawnSync(process.execPath, ['--experimental-strip-types', '--no-warnings', SCRIPT_FILE, '--child'], {
    input: JSON.stringify(job),
    env,
    encoding: 'utf8',
    maxBuffer: 256 * 1024 * 1024,
  });
  if (r.status !== 0) {
    throw new Error(`child failed for ${steps.map((s) => s.id).join(', ')} (exit ${r.status}):\n${r.stderr}`);
  }
  return JSON.parse(r.stdout);
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const scriptBytes = fs.readFileSync(SCRIPT_FILE);
  const { fullSha, tmp, tree } = exportTree(args.website, args.commit);
  try {
    const callSites = verifyCallSites(tree);
    const prompts = promptConfigurations();
    const toolsConfigs = toolsConfigurations();

    const steps = [
      ...prompts.map((f) => ({ id: f.id, kind: 'prompt', env: configEnv(f), client: clientFixture(f) })),
      ...toolsConfigs.map((f) => ({ id: f.id, kind: 'tools', env: configEnv(f) })),
      { id: 'fact|sourceIdForToolName', kind: 'fact-source-map', env: {} },
      ...['unset', 'set'].map((B) => ({ id: `fact|offered|B=${B}`, kind: 'fact-offered', env: configEnv({ B, lock: 'off', portal: null, H: 'unset' }) })),
      ...ENV_EDGE_CASES.map((c) => ({ id: `fact|${c.id}`, kind: 'fact-env', env: c.env })),
    ];
    const selected = args.only ? steps.filter((s) => args.only.includes(s.id)) : steps;
    if (args.only && selected.length !== args.only.length) throw new Error('--only names an unknown id');

    const byId = new Map();
    const loadedSets = new Set();
    if (args.isolation === 'on') {
      for (const step of selected) {
        const out = runSteps(tree, [step], step.env);
        byId.set(step.id, out.results[0]);
        loadedSets.add(JSON.stringify(out.loaded));
      }
    } else {
      const out = runSteps(tree, selected, {});
      for (const r of out.results) byId.set(r.id, r);
      loadedSets.add(JSON.stringify(out.loaded));
    }
    if (loadedSets.size !== 1) throw new Error('children loaded different module sets');

    const stepById = new Map(steps.map((s) => [s.id, s]));
    const promptCaptures = prompts
      .filter((f) => byId.has(f.id))
      .map((f) => {
        const r = byId.get(f.id);
        const { id, group, ...factors } = f;
        return {
          id,
          group,
          expression: PROMPT_EXPRESSION,
          callSites: callSites.prompt.map((c) => `${c.path}:${c.line}`),
          factors: encode(factors),
          env: stepById.get(id).env,
          client: stepById.get(id).client,
          resolved: r.resolved,
          configured: r.configured,
          publicationHost: r.publicationHost,
          today: r.today,
          clientCalls: r.clientCalls,
          output: r.output,
        };
      });

    const toolsCaptures = toolsConfigs
      .filter((f) => byId.has(f.id))
      .map((f) => {
        const r = byId.get(f.id);
        const { id, ...factors } = f;
        return {
          id,
          expression: TOOLS_EXPRESSION,
          callSites: callSites.tools.map((c) => `${c.path}:${c.line}`),
          factors: encode(factors),
          env: stepById.get(id).env,
          resolved: r.resolved,
          configured: r.configured,
          identity: r.identity,
          clientCalls: r.clientCalls,
          output: r.output,
        };
      });
    // Hashes stay out of the fixture: a 64-character hex digest can hold a
    // long decimal run, which the repository's pre-push guard reads as an
    // account-shaped number. The alias checks below compare them here.
    const hashesOf = new Map(
      toolsConfigs.filter((f) => byId.has(f.id)).map((f) => {
        const r = byId.get(f.id);
        return [f.id, { output: sha256(r.output), bare: r.bareSha256, mcpTools: r.mcpToolsSha256 }];
      }),
    );

    // Aliases, each checked: by identity inside one module graph, and by bytes
    // across graphs.
    const toolsBy = new Map(toolsCaptures.map((c) => [c.id, c]));
    const aliases = [];
    const bSetOff = toolsBy.get(toolsId({ B: 'set', lock: 'off', portal: null }));
    if (bSetOff) {
      aliases.push({
        name: "replay's tools",
        expression: 'mcpTools',
        callSites: callSites.replayTools.map((s) => `${s.path}:${s.line}`),
        aliasOf: bSetOff.id,
        identityCheck: { expression: 'offeredMcpTools(mcpToolsFor(undefined)) === mcpTools, Boston set', result: bSetOff.identity.offeredIsMcpTools },
        bytesCheck: { expression: 'every tools capture: sha256(JSON.stringify(mcpTools)) equals this capture', result: toolsCaptures.every((c) => hashesOf.get(c.id).mcpTools === hashesOf.get(bSetOff.id).output) },
      });
    }
    for (const lockState of [{ lock: 'off', portal: null }, { lock: 'on', portal: PORTAL_NYC }, { lock: 'on', portal: PORTAL_UNLISTED }]) {
      const target = toolsBy.get(toolsId({ B: 'set', ...lockState }));
      if (!target) continue;
      const sameLock = toolsCaptures.filter((c) => c.factors.lock === lockState.lock && c.factors.portal === lockState.portal);
      aliases.push({
        name: `bare mcpToolsFor(lockedPortal), lock ${lockState.lock}${lockState.portal ? ` on ${lockState.portal}` : ''}`,
        expression: 'mcpToolsFor(lockedPortal)',
        aliasOf: target.id,
        identityCheck: { expression: 'offeredMcpTools(bare) === bare, Boston set', result: target.identity.offeredIsBare },
        bytesCheck: {
          expression: 'every tools capture at this lock (Boston set or unset): sha256(JSON.stringify(bare)) equals this capture',
          captures: sameLock.map((c) => c.id),
          result: sameLock.every((c) => hashesOf.get(c.id).bare === hashesOf.get(target.id).output),
        },
      });
    }

    const facts = {
      sourceIdForToolName: byId.get('fact|sourceIdForToolName')?.value,
      offered: ['unset', 'set']
        .filter((B) => byId.has(`fact|offered|B=${B}`))
        .map((B) => ({ B, env: stepById.get(`fact|offered|B=${B}`).env, ...byId.get(`fact|offered|B=${B}`).value })),
      readMcpEnvFromProcess: ENV_EDGE_CASES.filter((c) => byId.has(`fact|${c.id}`)).map((c) => ({ id: c.id, env: c.env, ...byId.get(`fact|${c.id}`).value })),
    };

    const fixture = {
      _meta: {
        description:
          "The reference website's two model-facing outputs, captured by running its own exported functions at the commit below: the tools array a query route hands the model, and the composed system prompt. The router package's acceptance bar: it must reproduce every output byte for byte.",
        website: { repository: 'npstorey/civic-ai-tools-website', commit: fullSha },
        script: { path: SCRIPT_REPO_PATH, sha256: sha256(scriptBytes) },
        captureDate: args.captureDate,
        node: process.version,
        clock: { instant: FIXED_INSTANT, today: FIXED_INSTANT.split('T')[0] },
        placeholders: {
          publicationHost: PLACEHOLDER_PUBLICATION_HOST,
          socrataMcpUrl: PLACEHOLDER_SOCRATA_MCP_URL,
          bostonMcpUrl: PLACEHOLDER_BOSTON_MCP_URL,
          dataCommonsMcpUrl: PLACEHOLDER_DATA_COMMONS_MCP_URL,
          dataCommonsApiKey: PLACEHOLDER_DATA_COMMONS_API_KEY,
          unknownToolName: UNKNOWN_TOOL_NAME,
        },
        fixtureStrings: Object.fromEntries(
          Object.entries(FIXTURE_STRINGS).map(([k, v]) => [k, { sha256: sha256(v), utf8Bytes: Buffer.byteLength(v) }]),
        ),
        isolation:
          args.isolation === 'on'
            ? 'one child process per configuration; its environment is exactly the configuration env; nothing inherited'
            : 'OFF: every configuration in one child process, environment swapped between steps (leak demonstration only)',
        clientReplacement:
          'src/lib/mcp/client.ts is served by an in-file module.registerHooks() load hook as a stub exporting callMcpPrompt and getServerInstructions; the stub answers from fixtureStrings per each capture\'s "client" entry and logs each call in "clientCalls". fetch throws. Every other module is the website\'s own.',
        portalDriving:
          'resolveRunPortal(undefined) from src/lib/site-config.ts, under the capture env (SITE_PORTAL_LOCKED, SITE_DEFAULT_PORTAL), as a route does for a request naming no portal',
        expressions: { prompt: PROMPT_EXPRESSION, tools: TOOLS_EXPRESSION },
        callSites,
        modulesLoaded: JSON.parse([...loadedSets][0]).map((m) => (m === 'src/lib/mcp/client.ts' ? `${m} (served as the stub)` : m)),
        encoding: 'A value that is undefined, including an own key whose value is undefined, is written {"$undefined": true}. A tools output is the JSON.stringify text of the array.',
        counts: { prompts: promptCaptures.length, tools: toolsCaptures.length },
        subset: args.only ?? null,
      },
      fixtureStrings: FIXTURE_STRINGS,
      prompts: promptCaptures,
      tools: toolsCaptures,
      aliases,
      facts,
    };

    fs.writeFileSync(args.out, JSON.stringify(fixture, null, 2) + '\n');
    process.stdout.write(`wrote ${args.out}: ${promptCaptures.length} prompt captures, ${toolsCaptures.length} tools captures (isolation ${args.isolation})\n`);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

if (process.argv[2] === '--child') {
  await runChild();
} else {
  main();
}
