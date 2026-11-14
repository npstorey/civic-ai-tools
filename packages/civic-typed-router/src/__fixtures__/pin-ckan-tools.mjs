#!/usr/bin/env node
// Captures ckan-tools.json: what the hosted CKAN server (the fork of the
// upstream ckan-mcp-server at github.com/npstorey/ckan-mcp-server) reports of
// itself and lists as its tools, at the commit the hosted server is built
// from (CKAN-1 P2, hub issue 314). The CKAN server entry's
// `toolsRef.fixture` names it; the base's 20 tool names
// (`CKAN_SERVER_TOOL_NAMES`), the six tool schemas the Boston pack calls
// (`CKAN_PACK_BASE_TOOLS`, `src/civic/ckan.ts`) and the pack's `basePins`
// (serverInfo's name and version, and `mcpToolSchemaSha256` of each of the
// six) are read from it, and `src/ckan.test.ts` holds them equal.
//
// USAGE
//   live: clone the repository at the commit, install, build, run one session
//     node pin-ckan-tools.mjs [--capture-date YYYY-MM-DD] [--out <path>]
//   saved: write the fixture from a session already taken (its saved answers)
//     node pin-ckan-tools.mjs --from-session <dir> --node <vX.Y.Z> --sdk <version>
//                             --package-version <version> [--capture-date YYYY-MM-DD] [--out <path>]
//   --capture-date defaults to today's UTC date; --out to ckan-tools.json
//   beside this file.
//
// TWO MODES, ONE SERIALIZER. Both modes build the fixture with the same
// function (`fixtureOf`) from the same facts: the commit (a constant here),
// the server's package version, the Node version the server ran on, the
// resolved SDK version, the capture date, and the server's `initialize` and
// `tools/list` results. Nothing in the fixture says which mode wrote it, so a
// live run and a saved-session run of the same session are byte-identical.
//
// HOW THE LIVE CAPTURE IS TAKEN (the method of pin-socrata-tools.mjs)
//   - The repository is cloned over HTTPS into a fresh temporary directory
//     under the OS temporary directory ($TMPDIR), never inside this
//     repository, with global and system git config ignored, and the commit
//     is checked out detached. The checkout is held to be the commit.
//   - `npm ci --ignore-scripts` installs its locked dependencies, so no
//     install script runs; `npm run build` bundles it (esbuild). Git and the
//     npm registry are the only hosts reached.
//   - The server is started as `node dist/index.js` (stdio is its default
//     transport), its working directory the clone (which holds no `.env`,
//     checked) and its environment empty, so no variable of this shell
//     reaches it.
//   - One session: `initialize`, `notifications/initialized`, `tools/list`,
//     and nothing else. No tool is called, so the server contacts no portal.
//
// HOW THE SAVED MODE READS A SESSION
//   - `<dir>/stdio-2025-06-18.requests.jsonl`: the three messages sent, held
//     to the live mode's (`initialize` asking 2025-06-18, then
//     `notifications/initialized`, then `tools/list`).
//   - `<dir>/stdio-2025-06-18.initialize.json` and
//     `<dir>/stdio-2025-06-18.tools-list.1.json`: the server's whole JSON-RPC
//     answers (`result`, `jsonrpc`, `id`), with no `error` and one page.
//   - The build's facts the session files do not hold (the Node version the
//     server ran on, the resolved `@modelcontextprotocol/sdk` version and the
//     server's package version) are given as arguments, from the run's own
//     record of them.
//
// The fixture holds no clock reading but the date given, no path of the
// temporary directory and no timing, so two runs with the same session and
// `--capture-date` are byte-identical.

import { spawn, execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT_FILE = fileURLToPath(import.meta.url);
const SCRIPT_REPO_PATH = 'packages/civic-typed-router/src/__fixtures__/pin-ckan-tools.mjs';

const REPOSITORY = 'https://github.com/npstorey/ckan-mcp-server';
/** The commit the hosted CKAN server is built from: the fork's `pin`. */
const COMMIT = '7b0ac8a1a4aaa550786a2ff96b326307345a7a89';
const FIXTURE_NAME = 'ckan-tools.json';
/** The server's environment: empty. */
const SERVER_ENV = {};
const START = ['dist/index.js'];
/** The package that carries the schemas to the wire. */
const SDK = '@modelcontextprotocol/sdk';
const PROTOCOL_VERSION = '2025-06-18';
const SESSION_TIMEOUT_MS = 60_000;
/** The messages one session sends, in order (the ids are the live mode's). */
const REQUESTS = [
  { id: 1, method: 'initialize', params: { protocolVersion: PROTOCOL_VERSION, capabilities: {}, clientInfo: { name: 'pin-ckan-tools', version: '1' } } },
  { method: 'notifications/initialized' },
  { id: 2, method: 'tools/list', params: {} },
];
const SESSION_FILES = {
  requests: `stdio-${PROTOCOL_VERSION}.requests.jsonl`,
  initialize: `stdio-${PROTOCOL_VERSION}.initialize.json`,
  toolsList: `stdio-${PROTOCOL_VERSION}.tools-list.1.json`,
};

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const next = () => {
      const v = argv[++i];
      if (v === undefined) throw new Error(`${a} needs a value`);
      return v;
    };
    if (a === '--capture-date') args.captureDate = next();
    else if (a === '--out') args.out = next();
    else if (a === '--from-session') args.fromSession = next();
    else if (a === '--node') args.node = next();
    else if (a === '--sdk') args.sdk = next();
    else if (a === '--package-version') args.packageVersion = next();
    else throw new Error(`unknown argument ${a}`);
  }
  const saved = ['node', 'sdk', 'packageVersion'];
  if (args.fromSession === undefined) {
    const given = saved.filter((name) => args[name] !== undefined);
    if (given.length > 0) throw new Error(`--${given[0]} is the saved mode's: the live mode reads it from the run`);
  } else {
    for (const name of saved) if (args[name] === undefined) throw new Error('the saved mode needs --node, --sdk and --package-version');
    if (!/^v\d+\.\d+\.\d+$/.test(args.node)) throw new Error('--node is vX.Y.Z');
    if (!/^\d+\.\d+\.\d+$/.test(args.sdk)) throw new Error('--sdk is X.Y.Z');
    if (!/^\d+\.\d+\.\d+$/.test(args.packageVersion)) throw new Error('--package-version is X.Y.Z');
  }
  args.captureDate ??= new Date().toISOString().split('T')[0];
  if (!/^\d{4}-\d{2}-\d{2}$/.test(args.captureDate)) throw new Error('--capture-date is YYYY-MM-DD');
  args.out ??= path.join(path.dirname(SCRIPT_FILE), FIXTURE_NAME);
  return args;
}

/** Git with no global or system config, so no credential or rewrite of this
 *  machine's applies. */
const GIT_ENV = { ...process.env, GIT_CONFIG_GLOBAL: os.devNull, GIT_CONFIG_NOSYSTEM: '1', GIT_TERMINAL_PROMPT: '0' };
const git = (args, cwd) => execFileSync('git', args, { cwd, env: GIT_ENV, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
const npm = (args, cwd) => execFileSync('npm', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
const readJson = (file) => JSON.parse(fs.readFileSync(file, 'utf8'));

/** One stdio session: send each message, collect each answer by id. */
function session(command, args, cwd, env, messages) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd, env, stdio: ['pipe', 'pipe', 'pipe'] });
    const responses = new Map();
    const waiting = new Set(messages.filter((m) => m.id !== undefined).map((m) => m.id));
    let buffered = '';
    let stderr = '';
    const timer = setTimeout(() => {
      child.kill('SIGKILL');
      reject(new Error(`the server did not answer within ${SESSION_TIMEOUT_MS} ms; stderr:\n${stderr}`));
    }, SESSION_TIMEOUT_MS);
    child.stderr.setEncoding('utf8');
    child.stderr.on('data', (chunk) => {
      stderr += chunk;
    });
    child.stdout.setEncoding('utf8');
    child.stdout.on('data', (chunk) => {
      buffered += chunk;
      let newline;
      while ((newline = buffered.indexOf('\n')) >= 0) {
        const line = buffered.slice(0, newline).trim();
        buffered = buffered.slice(newline + 1);
        if (!line) continue;
        const message = JSON.parse(line);
        if (message.id === undefined || !waiting.has(message.id)) continue;
        if (message.error) {
          clearTimeout(timer);
          child.kill('SIGKILL');
          reject(new Error(`request ${message.id} failed: ${JSON.stringify(message.error)}`));
          return;
        }
        responses.set(message.id, message.result);
        waiting.delete(message.id);
        if (waiting.size === 0) {
          clearTimeout(timer);
          child.stdin.end();
          child.kill('SIGTERM');
          resolve(responses);
        }
      }
    });
    child.on('error', (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.on('exit', (code, signal) => {
      if (waiting.size > 0) {
        clearTimeout(timer);
        reject(new Error(`the server exited (code ${code}, signal ${signal}) before answering; stderr:\n${stderr}`));
      }
    });
    for (const message of messages) child.stdin.write(`${JSON.stringify({ jsonrpc: '2.0', ...message })}\n`);
  });
}

/** A full hex digest as the pre-push guard reads one: 40, 64, 96 or 128 hex
 *  characters, a letter among them, no letter or digit on either side. The
 *  guard masks a digest's digits. */
const DIGEST = /(?<![0-9A-Za-z])[0-9a-f]{40}(?:[0-9a-f]{24}(?:[0-9a-f]{32}(?:[0-9a-f]{32})?)?)?(?![0-9A-Za-z])/g;

/** The pre-push guard reads a run of 13 or more digits outside a digest as
 *  an account-shaped number. */
function longDigitRun(text) {
  return text.replace(DIGEST, (hex) => (/[a-f]/.test(hex) ? hex.replace(/\d/g, 'x') : hex)).match(/\d{13,}/);
}

/** `text` (serialized JSON) with every run of 13 or more digits outside a
 *  digest broken up for the guard, as `pin-socrata-tools.mjs` does: every
 *  ninth digit of the run is written as its JSON escape, which `JSON.parse`
 *  reads back as the server's text. */
function guardSafe(text) {
  let out = '';
  let last = 0;
  for (const match of text.matchAll(DIGEST)) {
    out += breakRuns(text.slice(last, match.index)) + match[0];
    last = match.index + match[0].length;
  }
  return out + breakRuns(text.slice(last));
}

function breakRuns(text) {
  return text.replace(/\d{13,}/g, (run) =>
    [...run].map((digit, i) => (i % 9 === 8 ? `\\u${digit.charCodeAt(0).toString(16).padStart(4, '0')}` : digit)).join(''),
  );
}

/** The one serializer: the fixture's text from the facts of one session. */
function fixtureOf({ commit, packageVersion, captureDate, node, sdk, initialize, listed }) {
  if (listed.nextCursor !== undefined) throw new Error('tools/list paginated; this script reads one page');
  const fixture = {
    _meta: {
      description:
        "The hosted CKAN server's own report (initialize's serverInfo) and its tools/list, at the commit of its repository the hosted server is built from, started with an empty environment. The CKAN server entry's toolsRef.fixture names it. The base's 20 tool names, the six schemas the Boston pack calls and the pack's basePins are read from it: serverInfo's name and version, and mcpToolSchemaSha256 of each of the six.",
      repository: REPOSITORY,
      commit,
      packageVersion,
      script: { path: SCRIPT_REPO_PATH, sha256: createHash('sha256').update(fs.readFileSync(SCRIPT_FILE)).digest('hex') },
      captureDate,
      node,
      resolved: { [SDK]: sdk },
      install: 'git clone over HTTPS into a fresh directory under the OS temporary directory, the commit checked out detached; npm ci --ignore-scripts; npm run build',
      transport: 'stdio: node dist/index.js, the working directory the clone (no .env), the environment empty',
      environment: SERVER_ENV,
      requests: REQUESTS.map((m) => m.method),
    },
    initialize: {
      requestedProtocolVersion: PROTOCOL_VERSION,
      protocolVersion: initialize.protocolVersion,
      serverInfo: initialize.serverInfo,
      capabilities: initialize.capabilities,
      instructions: initialize.instructions ?? null,
    },
    tools: listed.tools,
  };
  const text = guardSafe(`${JSON.stringify(fixture, null, 2)}\n`);
  if (JSON.stringify(JSON.parse(text)) !== JSON.stringify(fixture)) throw new Error('the guard-safe text does not parse to the capture');
  const longRun = longDigitRun(text);
  if (longRun) throw new Error(`the fixture holds a ${longRun[0].length}-digit run; reshape it before writing`);
  return { fixture, text };
}

/** The live mode: a fresh clone at the commit, its install and build, one
 *  session. */
async function live(args) {
  const tmp = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'pin-ckan-')));
  try {
    const server = path.join(tmp, 'ckan-mcp-server');
    git(['clone', '--quiet', '--no-checkout', REPOSITORY, server], tmp);
    git(['checkout', '--quiet', '--detach', COMMIT], server);
    const commit = git(['rev-parse', 'HEAD'], server);
    if (commit !== COMMIT) throw new Error(`checked out ${commit}; asked for ${COMMIT}`);
    if (git(['status', '--porcelain'], server) !== '') throw new Error('the checkout is not clean');

    npm(['ci', '--ignore-scripts', '--no-audit', '--no-fund'], server);
    npm(['run', 'build'], server);
    if (fs.existsSync(path.join(server, '.env'))) throw new Error('the clone holds a .env; the server would read it');

    const responses = await session(process.execPath, START, server, SERVER_ENV, REQUESTS);
    return fixtureOf({
      commit,
      packageVersion: readJson(path.join(server, 'package.json')).version,
      captureDate: args.captureDate,
      node: process.version,
      sdk: readJson(path.join(server, 'node_modules', SDK, 'package.json')).version,
      initialize: responses.get(1),
      listed: responses.get(2),
    });
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

/** One saved JSON-RPC answer: its `result`, held to the id and to no error. */
function savedResult(file, id) {
  const answer = readJson(file);
  if (answer === null || typeof answer !== 'object' || answer.jsonrpc !== '2.0' || answer.id !== id) throw new Error(`${file}: not the JSON-RPC answer to request ${id}`);
  if (answer.error !== undefined || answer.result === undefined) throw new Error(`${file}: request ${id} has no result`);
  return answer.result;
}

/** The saved mode: the same facts, from a session already taken. */
function saved(args) {
  const dir = args.fromSession;
  const sent = fs
    .readFileSync(path.join(dir, SESSION_FILES.requests), 'utf8')
    .split('\n')
    .filter((line) => line.trim() !== '')
    .map((line) => JSON.parse(line));
  const shape = (m) => JSON.stringify({ id: m.id, method: m.method, protocolVersion: m.params?.protocolVersion });
  if (sent.length !== REQUESTS.length || sent.some((m, i) => shape(m) !== shape(REQUESTS[i]))) {
    throw new Error(`${SESSION_FILES.requests}: the session did not send initialize (${PROTOCOL_VERSION}), notifications/initialized and tools/list, in that order`);
  }
  return fixtureOf({
    commit: COMMIT,
    packageVersion: args.packageVersion,
    captureDate: args.captureDate,
    node: args.node,
    sdk: args.sdk,
    initialize: savedResult(path.join(dir, SESSION_FILES.initialize), 1),
    listed: savedResult(path.join(dir, SESSION_FILES.toolsList), 2),
  });
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const { fixture, text } = args.fromSession === undefined ? await live(args) : saved(args);
  fs.writeFileSync(args.out, text);
  const info = fixture.initialize.serverInfo;
  process.stdout.write(`wrote ${args.out}: ${fixture.tools.length} tools from ${REPOSITORY} at ${fixture._meta.commit} (${info?.name} ${info?.version})\n`);
}

await main();
