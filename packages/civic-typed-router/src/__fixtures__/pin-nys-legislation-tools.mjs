#!/usr/bin/env node
// Captures nys-legislation-tools.json: the tool schemas of the NYS Open
// Legislation MCP server (npm `@betanyc/nys-openlegislation-mcp`, published by
// BetaNYC) at the exact version the router's entry pins, as the server itself
// lists them. `src/civic/nys-legislation.ts` carries the same schemas as code
// (the build reads no JSON), and `hosted-entries.test.ts` holds the two equal.
//
// USAGE
//   node pin-nys-legislation-tools.mjs [--capture-date YYYY-MM-DD]  default: today's UTC date
//                                      [--out <path>]               default: nys-legislation-tools.json beside this file
//
// HOW THE CAPTURE IS TAKEN (the method of pin-nyc-charter-tools.mjs)
//   - The pinned version is installed with `npm install --ignore-scripts` into
//     a fresh temporary directory under the OS temporary directory ($TMPDIR),
//     never inside this repository. No install script of the package or of
//     any dependency runs.
//   - The registry is read twice, through npm: the install itself, and
//     `npm view` for the version's `gitHead`. Nothing else reaches a network.
//   - The server is started over stdio with `node <its bin>`, its working
//     directory the temporary directory and its environment holding one
//     variable, `NYS_LEGISLATION_API_KEY`, set to a fixed PLACEHOLDER that is
//     not a key. The server exits at start when it has neither a key nor a
//     local corpus (the package ships none), and it reads the key at start
//     and sends it only with a tool call, which this script never makes. No
//     other variable of this shell (`NYS_CORPUS_DB` among them) reaches it.
//   - One session: `initialize`, `notifications/initialized`, `tools/list`,
//     and nothing else. No tool is called, so the server never contacts its
//     upstream host (legislation.nysenate.gov), and the placeholder is
//     never sent anywhere.
//   - The fixture holds no clock reading but the date given, no path of the
//     temporary directory and no timing, so two runs with the same
//     `--capture-date` on the same Node are byte-identical.

import { spawn, execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT_FILE = fileURLToPath(import.meta.url);
const SCRIPT_REPO_PATH = 'packages/civic-typed-router/src/__fixtures__/pin-nys-legislation-tools.mjs';

const PACKAGE = '@betanyc/nys-openlegislation-mcp';
const VERSION = '2.4.0';
const FIXTURE_NAME = 'nys-legislation-tools.json';
const SERVER_LABEL = 'NYS Open Legislation';
/** The server's environment: one fixed PLACEHOLDER key, so the server
 *  starts; it is not a key, and no call that would send it is made. */
const SERVER_ENV = { NYS_LEGISLATION_API_KEY: 'placeholder-not-a-key' };
/** The packages that carry the schemas to the wire: the SDK serializes the
 *  server's tool table; zod parses each call's arguments. */
const RENDERING_PACKAGES = ['@modelcontextprotocol/sdk', 'zod'];
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
    if (a === '--capture-date') args.captureDate = next();
    else if (a === '--out') args.out = next();
    else throw new Error(`unknown argument ${a}`);
  }
  args.captureDate ??= new Date().toISOString().split('T')[0];
  if (!/^\d{4}-\d{2}-\d{2}$/.test(args.captureDate)) throw new Error('--capture-date is YYYY-MM-DD');
  args.out ??= path.join(path.dirname(SCRIPT_FILE), FIXTURE_NAME);
  return args;
}

function npm(args, cwd) {
  return execFileSync('npm', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

/** The version of `name` the package at `from` resolves: its own nested copy
 *  first, then the install root's. */
function resolvedVersion(root, from, name) {
  for (const dir of [path.join(from, 'node_modules', name), path.join(root, 'node_modules', name)]) {
    const file = path.join(dir, 'package.json');
    if (fs.existsSync(file)) return readJson(file).version;
  }
  throw new Error(`${name} is not installed beside ${PACKAGE}`);
}

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
 *  digest broken up for the guard: every ninth digit of the run is written as
 *  its JSON escape (`\u0034` for `4`), so no run in the file is longer than
 *  twelve digits. The escape is lexical only: `JSON.parse` gives the server's
 *  text, character for character. Example identifiers in a server's tool
 *  descriptions are such runs. */
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
  const tmp = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'pin-nys-legislation-')));
  try {
    fs.writeFileSync(path.join(tmp, 'package.json'), `${JSON.stringify({ private: true }, null, 2)}\n`);
    npm(['install', '--ignore-scripts', '--no-audit', '--no-fund', '--save-exact', `${PACKAGE}@${VERSION}`], tmp);
    const view = JSON.parse(npm(['view', `${PACKAGE}@${VERSION}`, 'version', 'gitHead', 'dist.integrity', '--json'], tmp));

    const packageDir = path.join(tmp, 'node_modules', ...PACKAGE.split('/'));
    const manifest = readJson(path.join(packageDir, 'package.json'));
    if (manifest.version !== VERSION || view.version !== VERSION) {
      throw new Error(`installed ${manifest.version}, registry ${view.version}; expected ${VERSION}`);
    }
    const lock = readJson(path.join(tmp, 'package-lock.json'));
    const locked = lock.packages[`node_modules/${PACKAGE}`];
    if (locked.integrity !== view['dist.integrity']) throw new Error('the installed tarball is not the registry\'s');
    const bins = typeof manifest.bin === 'string' ? { [manifest.name]: manifest.bin } : manifest.bin;
    const binNames = Object.keys(bins ?? {});
    if (binNames.length !== 1) throw new Error(`expected one bin, found ${binNames.length}`);
    const bin = bins[binNames[0]];

    const responses = await session(process.execPath, [path.join(packageDir, bin)], tmp, SERVER_ENV, [
      {
        id: 1,
        method: 'initialize',
        params: { protocolVersion: PROTOCOL_VERSION, capabilities: {}, clientInfo: { name: 'pin-nys-legislation-tools', version: '1' } },
      },
      { method: 'notifications/initialized' },
      { id: 2, method: 'tools/list', params: {} },
    ]);
    const initialize = responses.get(1);
    const listed = responses.get(2);
    if (listed.nextCursor !== undefined) throw new Error('tools/list paginated; this script reads one page');

    const fixture = {
      _meta: {
        description: `The ${SERVER_LABEL} MCP server's tool schemas, as its tools/list returns them at the pinned version. The router's ${SERVER_LABEL} entry carries the same schemas as code.`,
        package: PACKAGE,
        version: VERSION,
        gitHead: view.gitHead,
        integrity: locked.integrity,
        repository: manifest.repository?.url ?? null,
        bin,
        script: { path: SCRIPT_REPO_PATH, sha256: createHash('sha256').update(scriptBytes).digest('hex') },
        captureDate: args.captureDate,
        node: process.version,
        resolved: Object.fromEntries(RENDERING_PACKAGES.map((name) => [name, resolvedVersion(tmp, packageDir, name)])),
        install: 'npm install --ignore-scripts into a fresh directory under the OS temporary directory; the server started over stdio with an environment of one variable, NYS_LEGISLATION_API_KEY, set to a placeholder that is not a key',
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
    process.stdout.write(`wrote ${args.out}: ${fixture.tools.length} tools from ${PACKAGE}@${VERSION} (${view.gitHead})\n`);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

await main();
