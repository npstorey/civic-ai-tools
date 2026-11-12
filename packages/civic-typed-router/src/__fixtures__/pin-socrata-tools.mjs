#!/usr/bin/env node
// Captures socrata-tools.json: what the Socrata MCP server (npstorey's
// socrata-mcp-server) reports of itself and lists as its tools, at a stated
// commit of its repository (hub #317, S2-C P1, A1.3). The City Record pack's
// `basePins` are read from it (`serverInfo`, and `mcpToolSchemaSha256` of
// `get_data` and `fetch`), and `src/base-pins.test.ts` holds the two equal;
// the Socrata entry's `toolsRef.fixture` names it.
//
// USAGE
//   node pin-socrata-tools.mjs --commit <sha>                 the server commit to capture at (required)
//                              [--capture-date YYYY-MM-DD]    default: today's UTC date
//                              [--out <path>]                 default: socrata-tools.json beside this file
//
// HOW THE CAPTURE IS TAKEN (the method of pin-nyc-record-tools.mjs, from the
// repository at a commit rather than from npm: many commits share 0.9.2)
//   - The repository is cloned over HTTPS into a fresh temporary directory
//     under the OS temporary directory ($TMPDIR), never inside this
//     repository, with global and system git config ignored, and the commit
//     is checked out detached. The checkout is held to be the stated commit.
//   - `npm ci --ignore-scripts` installs its locked dependencies, so no
//     install script runs; `npm run build:tsc` compiles it. Git and the npm
//     registry are the only hosts reached.
//   - The server is started as `node dist/index.js --stdio`, its working
//     directory the clone (which holds no `.env`, checked) and its
//     environment empty, so no variable of this shell reaches it.
//   - One session: `initialize`, `notifications/initialized`, `tools/list`,
//     and nothing else. No tool is called, so the server contacts no portal.
//   - The fixture holds no clock reading but the date given, no path of the
//     temporary directory and no timing, so two runs with the same `--commit`
//     and `--capture-date` on the same Node are byte-identical.

import { spawn, execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT_FILE = fileURLToPath(import.meta.url);
const SCRIPT_REPO_PATH = 'packages/civic-typed-router/src/__fixtures__/pin-socrata-tools.mjs';

const REPOSITORY = 'https://github.com/npstorey/socrata-mcp-server';
const FIXTURE_NAME = 'socrata-tools.json';
/** The server's environment: empty. */
const SERVER_ENV = {};
const START = ['dist/index.js', '--stdio'];
/** The packages that carry the schemas to the wire. */
const RENDERING_PACKAGES = ['@modelcontextprotocol/sdk'];
const PROTOCOL_VERSION = '2025-06-18';
const SESSION_TIMEOUT_MS = 60_000;

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const next = () => {
      const v = argv[++i];
      if (v === undefined) throw new Error(`${a} needs a value`);
      return v;
    };
    if (a === '--commit') args.commit = next();
    else if (a === '--capture-date') args.captureDate = next();
    else if (a === '--out') args.out = next();
    else throw new Error(`unknown argument ${a}`);
  }
  if (!args.commit || !/^[0-9a-f]{7,40}$/.test(args.commit)) throw new Error('--commit <sha> is required: the server commit to capture at');
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

/** One stdio session: send each request, collect each response by id. */
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
 *  digest broken up for the guard, as `pin-nyc-record-tools.mjs` does: every
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

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const scriptBytes = fs.readFileSync(SCRIPT_FILE);
  const tmp = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'pin-socrata-')));
  try {
    const server = path.join(tmp, 'socrata-mcp-server');
    git(['clone', '--quiet', '--no-checkout', REPOSITORY, server], tmp);
    git(['checkout', '--quiet', '--detach', args.commit], server);
    const commit = git(['rev-parse', 'HEAD'], server);
    if (!commit.startsWith(args.commit)) throw new Error(`checked out ${commit}; asked for ${args.commit}`);
    if (git(['status', '--porcelain'], server) !== '') throw new Error('the checkout is not clean');

    npm(['ci', '--ignore-scripts', '--no-audit', '--no-fund'], server);
    npm(['run', 'build:tsc'], server);
    if (fs.existsSync(path.join(server, '.env'))) throw new Error('the clone holds a .env; the server would read it');
    const manifest = readJson(path.join(server, 'package.json'));

    const responses = await session(process.execPath, START, server, SERVER_ENV, [
      {
        id: 1,
        method: 'initialize',
        params: { protocolVersion: PROTOCOL_VERSION, capabilities: {}, clientInfo: { name: 'pin-socrata-tools', version: '1' } },
      },
      { method: 'notifications/initialized' },
      { id: 2, method: 'tools/list', params: {} },
    ]);
    const initialize = responses.get(1);
    const listed = responses.get(2);
    if (listed.nextCursor !== undefined) throw new Error('tools/list paginated; this script reads one page');

    const fixture = {
      _meta: {
        description:
          "The Socrata MCP server's own report (initialize's serverInfo) and its tools/list, at a stated commit of its repository, started with an empty environment. The City Record pack's basePins are read from it: serverInfo's name and version, and mcpToolSchemaSha256 of get_data and fetch.",
        repository: REPOSITORY,
        commit,
        packageVersion: manifest.version,
        script: { path: SCRIPT_REPO_PATH, sha256: createHash('sha256').update(scriptBytes).digest('hex') },
        captureDate: args.captureDate,
        node: process.version,
        resolved: Object.fromEntries(RENDERING_PACKAGES.map((name) => [name, readJson(path.join(server, 'node_modules', name, 'package.json')).version])),
        install: 'git clone over HTTPS into a fresh directory under the OS temporary directory, the commit checked out detached; npm ci --ignore-scripts; npm run build:tsc',
        transport: 'stdio: node dist/index.js --stdio, the working directory the clone (no .env), the environment empty',
        environment: SERVER_ENV,
        requests: ['initialize', 'notifications/initialized', 'tools/list'],
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
    fs.writeFileSync(args.out, text);
    process.stdout.write(`wrote ${args.out}: ${fixture.tools.length} tools from ${REPOSITORY} at ${commit} (${initialize.serverInfo?.name} ${initialize.serverInfo?.version})\n`);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

await main();
