#!/usr/bin/env node
/**
 * check-template-env.mjs — every environment variable a tracked MCP template
 * sets for the Socrata MCP server is one something actually reads.
 *
 * WHY: at 20aa3a1 all six tracked files that launch the server set
 * DEFAULT_DOMAIN, CACHE_ENABLED and LOG_LEVEL, and the server read none of
 * them. It reads DATA_PORTAL_URL, so a user who copied a template got a server
 * with no default portal, and every portal-less call (every `search`) was
 * refused. A name no reader reads looks like configuration and is not.
 *
 * ── WHAT IS DERIVED (nothing here is a list of the server's names) ──────────
 *
 *   Templates    `git ls-files` of this repo, kept when the text references a
 *                JavaScript file inside the server's directory
 *                (`socrata-mcp-server/…js`). Each such file is read by its
 *                format: JSON / JSON-with-comments, TOML, or a shell script
 *                that echoes JSON (every branch combination is rendered and
 *                must parse). A launch with no `env` sets nothing and passes.
 *                A launch reference in any other format passes only if the
 *                file shows none of the environment-setting shapes in
 *                GENERIC_ENV_SHAPES; otherwise it fails as unreadable, so a
 *                new template format cannot slip past unread.
 *   Server reads The server's own source at `main`, from a shallow `git clone`
 *                (see FETCH). The files scanned are the ones its tsconfig.json
 *                compiles (`include` minus `exclude`); test files are excluded
 *                by the server's own build config, not by a pattern here.
 *                Comments are blanked before scanning, and string contents
 *                too unless the string is a `process.env['NAME']` key, so a
 *                read mentioned in prose is not counted as a read.
 *   Runtime reads RUNTIME_READERS below: names read by something other than
 *                the server, each with its reader and the launch shape it
 *                applies to. The global-agent entry is honoured only when the
 *                launched file is a tracked hub script that imports
 *                `global-agent` and calls `bootstrap()`.
 *
 * ── FETCH ───────────────────────────────────────────────────────────────────
 * A shallow, single-branch `git clone` over public HTTPS, not the GitHub REST
 * API. Listing a tree needs either the API (unauthenticated, rate-limited per
 * IP, and shared runners share IPs) or a clone; raw fetches of known paths
 * cannot enumerate files. The clone runs outside this checkout with system and
 * global git config ignored and prompting disabled, so it carries no
 * credential and cannot hang on one. A clone failure FAILS the check.
 *
 * ── FAILURE DIRECTION ───────────────────────────────────────────────────────
 * A read shape the scanner does not recognise (an alias of `process.env`, a
 * spread, a read inside a dependency) makes a name look unread: the check
 * goes red, never green. The one way to a false green is over-counting a read,
 * which is why comments and strings are blanked. The blanker does not
 * recognise regular-expression literals: a quote inside one can shift what it
 * treats as string and code, which is a stated blind spot, not a handled case.
 * An empty template universe,
 * an empty source set, or an empty read set is a failure, not a clean tree.
 *
 * Offline: `--server-source <dir>` scans a local server checkout instead of
 * cloning. Zero dependencies. Run via `npm run check:template-env`.
 */

import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, join, relative, resolve, sep } from 'node:path';
import process from 'node:process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const DEFAULT_REPO = 'npstorey/socrata-mcp-server';
const DEFAULT_REF = 'main';
const CLONE_TIMEOUT_MS = 180_000;

/**
 * Names read by something other than the server's source. Each entry states
 * its reader and the launch it applies to; a name outside these, and outside
 * the server's derived reads, fails.
 */
export const RUNTIME_READERS = [
  {
    pattern: /^NODE_TLS_REJECT_UNAUTHORIZED$/,
    reader: 'the Node.js runtime',
    applies: (launch) => launch.command !== undefined && /^node(\.exe)?$/.test(basename(launch.command)),
    requirement: 'the launch command is `node`',
  },
  {
    pattern: /^GLOBAL_AGENT_[A-Z0-9_]+$/,
    reader: 'global-agent, bootstrapped by the launched wrapper script',
    applies: (launch, ctx) => ctx.globalAgentWrappers.has(basename(launch.entry)),
    requirement: 'the launched file is a tracked hub script that imports global-agent and calls bootstrap()',
  },
];

/**
 * Shapes that set an environment for a launched process, used only for a file
 * that references the server in a format this check has no reader for.
 */
export const GENERIC_ENV_SHAPES = [
  /"env"\s*:/,
  /\benv\s*[:=]/,
  /\.env\]/,
  /--env\b/,
  /\bexport\s+[A-Za-z_]\w*=/,
  /^\s*(?:[A-Za-z_]\w*=\S*\s+)+node\b/m,
];

/** `npstorey/socrata-mcp-server` -> a regex for a JS file inside that directory. */
export function launchRefPattern(repo = DEFAULT_REPO) {
  const name = repo.split('/').pop().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`${name}/[\\w.@/-]*?\\.[cm]?js\\b`);
}

// ── source text scanning ────────────────────────────────────────────────────

/**
 * Blank comments (and, with `keepStrings: false`, string contents) in JS/TS or
 * JSON-with-comments text, preserving offsets and newlines. With
 * `keepStrings: false` a string is kept whole only when it is the key of a
 * `process.env[...]` access.
 */
export function blankComments(text, { keepStrings = true } = {}) {
  let out = '';
  let i = 0;
  const templateDepth = []; // brace depth at which each open `${` returns to a template
  let braceDepth = 0;
  const blank = (s) => s.replace(/[^\n]/g, ' ');
  const readString = (quote) => {
    let j = i + 1;
    while (j < text.length) {
      if (text[j] === '\\') { j += 2; continue; }
      if (text[j] === quote) { j += 1; break; }
      if (quote === '`' && text[j] === '$' && text[j + 1] === '{') break;
      if (quote !== '`' && text[j] === '\n') break;
      j += 1;
    }
    return j;
  };
  while (i < text.length) {
    const c = text[i];
    const n = text[i + 1];
    if (c === '/' && n === '/') {
      const end = text.indexOf('\n', i);
      const stop = end === -1 ? text.length : end;
      out += blank(text.slice(i, stop));
      i = stop;
    } else if (c === '/' && n === '*') {
      const end = text.indexOf('*/', i + 2);
      const stop = end === -1 ? text.length : end + 2;
      out += blank(text.slice(i, stop));
      i = stop;
    } else if (c === '"' || c === "'" || c === '`' || (c === '}' && templateDepth.at(-1) === braceDepth)) {
      const resumingTemplate = c === '}';
      if (resumingTemplate) templateDepth.pop();
      const quote = resumingTemplate ? '`' : c;
      const j = readString(quote);
      const literal = text.slice(i, j);
      const isEnvKey = !resumingTemplate && /process\.env\s*\[\s*$/.test(out);
      out += keepStrings || isEnvKey ? literal : literal[0] + blank(literal.slice(1, -1)) + literal.slice(-1);
      i = j;
      if (quote === '`' && text[j] === '$' && text[j + 1] === '{') {
        out += '${';
        i = j + 2;
        templateDepth.push(braceDepth);
      }
    } else {
      if (c === '{') braceDepth += 1;
      if (c === '}') braceDepth -= 1;
      out += c;
      i += 1;
    }
  }
  return out;
}

/** Environment names read in one JS/TS source text. */
export function envReadsInSource(source) {
  const code = blankComments(source, { keepStrings: false });
  const names = new Set();
  for (const m of code.matchAll(/process\.env\??\.([A-Za-z_]\w*)/g)) names.add(m[1]);
  for (const m of code.matchAll(/process\.env\??\.?\[\s*(['"`])([A-Za-z_]\w*)\1\s*\]/g)) names.add(m[2]);
  for (const m of code.matchAll(/\{([^{}]*)\}\s*=\s*process\.env\b/g)) {
    for (const part of m[1].split(',')) {
      const key = part.trim().match(/^([A-Za-z_]\w*)/);
      if (key) names.add(key[1]);
    }
  }
  return names;
}

// ── the server side: which files, and what they read ────────────────────────

/** A tsconfig glob (`src/**\/*`, `src/**\/*.test.ts`, `src/__tests__`) as a path test. */
export function tsconfigGlobMatcher(pattern) {
  const p = pattern.replace(/^\.\//, '').replace(/\/$/, '');
  if (/[?[\]{}!]/.test(p)) throw new Error(`unsupported tsconfig pattern "${pattern}"`);
  if (!p.includes('*')) {
    return (file) => file === p || file.startsWith(`${p}/`);
  }
  let re = '';
  for (let k = 0; k < p.length; k += 1) {
    if (p.startsWith('**/', k)) { re += '(?:.*/)?'; k += 2; }
    else if (p[k] === '*') re += '[^/]*';
    else re += p[k].replace(/[.+^$()|\\]/g, '\\$&');
  }
  const rx = new RegExp(`^${re}$`);
  return (file) => rx.test(file);
}

/** The source files a server checkout's tsconfig.json compiles. */
export function compiledSourceFiles(serverDir) {
  const configPath = join(serverDir, 'tsconfig.json');
  if (!existsSync(configPath)) throw new Error(`no tsconfig.json in ${serverDir}`);
  const config = JSON.parse(blankComments(readFileSync(configPath, 'utf8')).replace(/,(\s*[}\]])/g, '$1'));
  if (config.extends) throw new Error('tsconfig.json uses "extends", which this check does not resolve');
  const include = (config.include ?? ['**/*']).map(tsconfigGlobMatcher);
  const exclude = (config.exclude ?? []).map(tsconfigGlobMatcher);
  const allowJs = config.compilerOptions?.allowJs === true;
  const ext = allowJs ? /\.(?:[cm]?ts|tsx|[cm]?js|jsx)$/ : /\.(?:[cm]?ts|tsx)$/;
  const files = [];
  const walk = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.name === '.git' || entry.name === 'node_modules') continue;
      const full = join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.isFile()) {
        const rel = relative(serverDir, full).split(sep).join('/');
        if (!ext.test(rel) || /\.d\.[cm]?ts$/.test(rel)) continue;
        if (include.some((m) => m(rel)) && !exclude.some((m) => m(rel))) files.push(rel);
      }
    }
  };
  walk(serverDir);
  for (const f of config.files ?? []) if (!files.includes(f)) files.push(f);
  return files.sort();
}

/** Every environment name the server's compiled source reads, with where. */
export function serverEnvReads(serverDir) {
  const files = compiledSourceFiles(serverDir);
  const reads = new Map();
  for (const f of files) {
    for (const name of envReadsInSource(readFileSync(join(serverDir, f), 'utf8'))) {
      if (!reads.has(name)) reads.set(name, []);
      reads.get(name).push(f);
    }
  }
  return { files, reads };
}

/** Shallow-clone the server. Returns { ok, dir?, reason? }; never throws. */
export function cloneServer({ repoUrl, ref = DEFAULT_REF }) {
  const parent = mkdtempSync(join(tmpdir(), 'template-env-'));
  const dir = join(parent, 'server');
  const res = spawnSync(
    'git',
    ['clone', '--depth', '1', '--single-branch', '--branch', ref, '--no-tags', '--quiet', repoUrl, dir],
    {
      cwd: parent,
      encoding: 'utf8',
      timeout: CLONE_TIMEOUT_MS,
      env: {
        ...process.env,
        GIT_TERMINAL_PROMPT: '0',
        GIT_CONFIG_NOSYSTEM: '1',
        GIT_CONFIG_GLOBAL: process.platform === 'win32' ? 'NUL' : '/dev/null',
        GIT_ASKPASS: '',
        SSH_ASKPASS: '',
      },
    },
  );
  if (res.status !== 0) {
    rmSync(parent, { recursive: true, force: true });
    const why = res.error ? res.error.message : (res.stderr || `exit ${res.status}`).trim();
    return { ok: false, reason: `git clone of ${repoUrl} (${ref}) failed: ${why}` };
  }
  return { ok: true, dir, cleanup: () => rmSync(parent, { recursive: true, force: true }) };
}

// ── the template side ───────────────────────────────────────────────────────

/** Walk a parsed JSON value for objects that launch the server. */
export function launchesInJson(value, refRx, path = '$') {
  const out = [];
  if (Array.isArray(value)) {
    value.forEach((v, k) => out.push(...launchesInJson(v, refRx, `${path}[${k}]`)));
    return out;
  }
  if (value === null || typeof value !== 'object') return out;
  const strings = [value.command, ...(Array.isArray(value.args) ? value.args : [])].filter(
    (s) => typeof s === 'string',
  );
  const entry = strings.map((s) => s.match(refRx)?.[0]).find(Boolean);
  if (entry) {
    if (value.env !== undefined && (value.env === null || typeof value.env !== 'object' || Array.isArray(value.env))) {
      throw new Error(`${path}.env is not an object`);
    }
    out.push({
      where: path,
      command: typeof value.command === 'string' ? value.command : undefined,
      entry,
      env: Object.keys(value.env ?? {}),
    });
  }
  for (const [k, v] of Object.entries(value)) {
    if (k !== 'env') out.push(...launchesInJson(v, refRx, `${path}.${k}`));
  }
  return out;
}

/** A minimal TOML reader: tables, and string / string-array / inline-table values. */
export function parseTomlSubset(text) {
  const tables = new Map([['', {}]]);
  let current = tables.get('');
  const parseValue = (raw, lineNo) => {
    const v = raw.trim();
    const str = v.match(/^"((?:[^"\\]|\\.)*)"$/) ?? v.match(/^'([^']*)'$/);
    if (str) return str[1];
    if (/^(true|false)$/.test(v)) return v === 'true';
    if (/^-?\d+$/.test(v)) return Number(v);
    if (v.startsWith('[') && v.endsWith(']')) {
      const items = v.slice(1, -1).match(/"(?:[^"\\]|\\.)*"|'[^']*'/g) ?? [];
      const rest = v.slice(1, -1).replace(/"(?:[^"\\]|\\.)*"|'[^']*'/g, '').replace(/[\s,]/g, '');
      if (rest) throw new Error(`line ${lineNo}: unsupported array value`);
      return items.map((s) => s.slice(1, -1));
    }
    if (v.startsWith('{') && v.endsWith('}')) {
      const obj = {};
      const body = v.slice(1, -1).trim();
      if (!body) return obj;
      for (const pair of body.match(/[A-Za-z0-9_-]+\s*=\s*(?:"(?:[^"\\]|\\.)*"|'[^']*')/g) ?? []) {
        const [, key, val] = pair.match(/^([A-Za-z0-9_-]+)\s*=\s*(.*)$/);
        obj[key] = parseValue(val, lineNo);
      }
      return obj;
    }
    throw new Error(`line ${lineNo}: unsupported value ${v}`);
  };
  text.split('\n').forEach((rawLine, idx) => {
    const line = rawLine.replace(/\s+#.*$/, '').replace(/^#.*$/, '').trim();
    if (!line) return;
    const header = line.match(/^\[([A-Za-z0-9_.-]+)\]$/);
    if (header) {
      if (tables.has(header[1])) throw new Error(`line ${idx + 1}: duplicate table [${header[1]}]`);
      current = {};
      tables.set(header[1], current);
      return;
    }
    const kv = line.match(/^([A-Za-z0-9_-]+|"[^"]+")\s*=\s*(.+)$/);
    if (!kv) throw new Error(`line ${idx + 1}: not a table header or key = value`);
    const key = kv[1].replace(/^"|"$/g, '');
    if (key in current) throw new Error(`line ${idx + 1}: duplicate key ${key}`);
    current[key] = parseValue(kv[2], idx + 1);
  });
  return tables;
}

export function launchesInToml(text, refRx) {
  const tables = parseTomlSubset(text);
  const out = [];
  for (const [name, table] of tables) {
    const strings = [table.command, ...(Array.isArray(table.args) ? table.args : [])].filter(
      (s) => typeof s === 'string',
    );
    const entry = strings.map((s) => s.match(refRx)?.[0]).find(Boolean);
    if (!entry) continue;
    const envTable = tables.get(`${name}.env`) ?? {};
    const inline = table.env && typeof table.env === 'object' ? table.env : {};
    out.push({
      where: `[${name}]`,
      command: typeof table.command === 'string' ? table.command : undefined,
      entry,
      env: [...new Set([...Object.keys(inline), ...Object.keys(envTable)])],
    });
  }
  return out;
}

/** Decode one shell word made of single- and double-quoted segments; `$VAR` renders as `__VAR__`. */
export function shellWord(word, lineNo) {
  let out = '';
  let i = 0;
  while (i < word.length) {
    const c = word[i];
    if (c === "'") {
      const end = word.indexOf("'", i + 1);
      if (end === -1) throw new Error(`line ${lineNo}: unterminated single quote`);
      out += word.slice(i + 1, end);
      i = end + 1;
    } else if (c === '"') {
      let j = i + 1;
      for (; j < word.length && word[j] !== '"'; j += 1) {
        if (word[j] === '\\' && '"\\$`'.includes(word[j + 1])) { out += word[j + 1]; j += 1; }
        else if (word[j] === '$') {
          const v = word.slice(j).match(/^\$(?:\{([A-Za-z_]\w*)\}|([A-Za-z_]\w*))/);
          if (!v) throw new Error(`line ${lineNo}: unsupported expansion in ${word}`);
          out += `__${v[1] ?? v[2]}__`;
          j += v[0].length - 1;
        } else out += word[j];
      }
      if (j >= word.length) throw new Error(`line ${lineNo}: unterminated double quote`);
      i = j + 1;
    } else {
      throw new Error(`line ${lineNo}: unquoted echo argument in ${word}`);
    }
  }
  return out;
}

/**
 * The documents a shell script writes with `{ echo …; } > "file"` groups.
 * Every `if` condition is a free boolean and every combination is rendered,
 * so a template whose JSON is valid only on some branches fails here. A line
 * inside a group this reader does not understand is an error, not a skip.
 */
export function shellGeneratedDocuments(text) {
  const lines = text.split('\n');
  const docs = [];
  for (let s = 0; s < lines.length; s += 1) {
    if (!/^\s*\{\s*$/.test(lines[s])) continue;
    let e = s + 1;
    let depth = 1;
    for (; e < lines.length; e += 1) {
      if (/^\s*\{\s*$/.test(lines[e])) depth += 1;
      if (/^\s*\}/.test(lines[e])) { depth -= 1; if (depth === 0) break; }
    }
    const close = (lines[e] ?? '').match(/^\s*\}\s*>\s*"?([^"\s]+)"?\s*$/);
    if (!close) continue;
    const body = lines.slice(s + 1, e).map((l, k) => ({ text: l.trim(), lineNo: s + 2 + k }));
    const conditions = [...new Set(body.map((l) => l.text.match(/^if\s+(.+?);\s*then$/)?.[1]).filter(Boolean))];
    const assigned = new Set(body.map((l) => l.text.match(/^([A-Za-z_]\w*)=(true|false)$/)?.[1]).filter(Boolean));
    for (const l of body) {
      const guard = l.text.match(/^\$([A-Za-z_]\w*)\s*&&/);
      if (guard && !assigned.has(guard[1]) && !conditions.includes(`$${guard[1]}`)) conditions.push(`$${guard[1]}`);
    }
    if (conditions.length > 10) throw new Error(`line ${s + 1}: too many conditions to enumerate`);
    for (let mask = 0; mask < 2 ** conditions.length; mask += 1) {
      const truth = new Map(conditions.map((c, k) => [c, Boolean(mask & (2 ** k))]));
      const vars = new Map();
      const active = [true];
      let output = '';
      const echo = (args, lineNo) => {
        const m = args.match(/^echo(\s+-n)?\s+(.+)$/);
        if (!m) throw new Error(`line ${lineNo}: unsupported echo form`);
        output += shellWord(m[2], lineNo) + (m[1] ? '' : '\n');
      };
      for (const { text: t, lineNo } of body) {
        if (t === '' || t.startsWith('#')) continue;
        const ifm = t.match(/^if\s+(.+?);\s*then$/);
        if (ifm) { active.push(active.at(-1) && truth.get(ifm[1])); continue; }
        if (t === 'fi') { active.pop(); continue; }
        if (/^(else|elif)\b/.test(t)) throw new Error(`line ${lineNo}: else/elif is not supported`);
        if (!active.at(-1)) continue;
        const assign = t.match(/^([A-Za-z_]\w*)=(true|false)$/);
        if (assign) { vars.set(assign[1], assign[2] === 'true'); continue; }
        const guarded = t.match(/^\$([A-Za-z_]\w*)\s*&&\s*(echo\b.*)$/);
        if (guarded) {
          const on = vars.has(guarded[1]) ? vars.get(guarded[1]) : truth.get(`$${guarded[1]}`);
          if (on) echo(guarded[2], lineNo);
          continue;
        }
        if (/^echo\b/.test(t)) { echo(t, lineNo); continue; }
        throw new Error(`line ${lineNo}: unsupported statement inside a generated document: ${t}`);
      }
      const label = conditions.map((c) => `${c}=${truth.get(c)}`).join(', ') || 'no conditions';
      docs.push({ target: close[1], line: s + 1, branches: label, text: output });
    }
  }
  return docs;
}

/** Launches (with env names) in one tracked file, by format. */
export function launchesInFile(path, text, refRx) {
  const name = basename(path);
  if (!refRx.test(text)) return { format: 'none', launches: [] };
  if (/\.jsonc?(?:[.-]|$)/.test(name)) {
    let parsed;
    try {
      parsed = JSON.parse(blankComments(text));
    } catch (err) {
      throw new Error(`does not parse as JSON (comments allowed): ${err.message}`);
    }
    return { format: 'json', launches: launchesInJson(parsed, refRx) };
  }
  if (/\.toml(?:[.-]|$)/.test(name)) {
    return { format: 'toml', launches: launchesInToml(text, refRx) };
  }
  if (/\.(?:ba)?sh$/.test(name) || /^#!\/bin\/(?:ba)?sh\b/.test(text)) {
    const launches = [];
    const docs = shellGeneratedDocuments(text);
    for (const doc of docs) {
      let parsed;
      try {
        parsed = JSON.parse(doc.text);
      } catch (err) {
        throw new Error(
          `the document written to ${doc.target} (group at line ${doc.line}; ${doc.branches}) does not parse: ${err.message}`,
        );
      }
      for (const l of launchesInJson(parsed, refRx)) {
        launches.push({ ...l, where: `${doc.target} ${l.where}`, branches: doc.branches });
      }
    }
    // Text outside the generated documents is read like any other format.
    const residual = stripShellGroups(text);
    if (refRx.test(residual)) {
      const shape = GENERIC_ENV_SHAPES.find((rx) => rx.test(residual));
      if (shape) throw new Error(`references the server outside a generated document and matches ${shape}`);
    }
    return { format: 'shell', launches };
  }
  const shape = GENERIC_ENV_SHAPES.find((rx) => rx.test(text));
  if (shape) {
    throw new Error(
      `references the server and matches the environment-setting shape ${shape}, in a format this check has no reader for`,
    );
  }
  return { format: 'mention', launches: [] };
}

function stripShellGroups(text) {
  const lines = text.split('\n');
  const keep = lines.map(() => true);
  for (let s = 0; s < lines.length; s += 1) {
    if (!/^\s*\{\s*$/.test(lines[s])) continue;
    for (let e = s + 1; e < lines.length; e += 1) {
      if (/^\s*\}\s*>/.test(lines[e])) {
        for (let k = s; k <= e; k += 1) keep[k] = false;
        s = e;
        break;
      }
    }
  }
  return lines.filter((_, k) => keep[k]).join('\n');
}

/** Tracked hub scripts that bootstrap global-agent before importing a server entry. */
export function globalAgentWrappers(root, files) {
  const out = new Set();
  for (const f of files) {
    if (!/\.[cm]?js$/.test(f)) continue;
    let text;
    try { text = readFileSync(join(root, f), 'utf8'); } catch { continue; }
    const code = blankComments(text);
    if (/from\s+['"]global-agent['"]|require\(\s*['"]global-agent['"]\s*\)/.test(code) && /\bbootstrap\s*\(/.test(code) && /import\s+['"][^'"]+\.js['"]/.test(code)) {
      out.add(basename(f));
    }
  }
  return out;
}

function trackedFiles(root) {
  const res = spawnSync('git', ['ls-files', '-z'], { cwd: root, encoding: 'utf8' });
  if (res.status !== 0) throw new Error(`git ls-files failed in ${root}: ${res.stderr}`);
  return res.stdout.split('\0').filter(Boolean);
}

/**
 * Run the check.
 * @returns {{ ok: boolean, lines: string[], failures: string[], templates: object[] }}
 */
export function runTemplateEnvCheck({ root, serverDir, repo = DEFAULT_REPO, exclude = [] }) {
  const lines = [];
  const failures = [];
  const refRx = launchRefPattern(repo);

  let reads;
  let files;
  try {
    ({ files, reads } = serverEnvReads(serverDir));
  } catch (err) {
    failures.push(`server source: ${err.message}`);
    return { ok: false, lines, failures, templates: [] };
  }
  if (files.length === 0) failures.push('server source: tsconfig.json compiles no files — nothing to derive reads from');
  if (reads.size === 0) failures.push('server source: no environment reads found — an empty read set is not a clean result');
  lines.push(`Server reads (${files.length} compiled source files):`);
  for (const [name, where] of [...reads].sort()) lines.push(`  ${name}  ← ${[...new Set(where)].join(', ')}`);

  const tracked = trackedFiles(root).filter((f) => !exclude.includes(f));
  const ctx = { globalAgentWrappers: globalAgentWrappers(root, tracked) };
  const templates = [];
  const mentions = [];
  for (const f of tracked) {
    let text;
    try {
      if (!statSync(join(root, f)).isFile()) continue;
      text = readFileSync(join(root, f), 'utf8');
    } catch {
      continue;
    }
    if (!refRx.test(text)) continue;
    let found;
    try {
      found = launchesInFile(f, text, refRx);
    } catch (err) {
      failures.push(`${f}: ${err.message}`);
      continue;
    }
    const withEnv = found.launches.filter((l) => l.env.length > 0);
    if (withEnv.length === 0) {
      mentions.push(`${f} (${found.format})`);
      continue;
    }
    templates.push({ file: f, format: found.format, launches: withEnv });
    // A shell template renders one launch per branch combination; report each
    // unread name once per site, with the combinations it appears in.
    const unread = new Map();
    for (const launch of withEnv) {
      for (const name of launch.env) {
        if (reads.has(name)) continue;
        const runtime = RUNTIME_READERS.find((r) => r.pattern.test(name));
        if (runtime && runtime.applies(launch, ctx)) continue;
        const note = runtime ? ` (${runtime.reader} reads it only when ${runtime.requirement})` : '';
        const key = `${f} ${launch.where}: sets ${name}, which nothing reads${note}`;
        if (!unread.has(key)) unread.set(key, []);
        if (launch.branches) unread.get(key).push(launch.branches);
      }
    }
    for (const [key, branches] of unread) {
      failures.push(branches.length ? `${key} [in ${branches.length} rendered branch combination(s)]` : key);
    }
  }
  if (templates.length === 0) {
    failures.push('no tracked file launches the server with an environment — an empty template universe is not a clean result');
  }
  lines.push('', 'Templates (launch the server and set its environment):');
  for (const t of templates) {
    const names = [...new Set(t.launches.flatMap((l) => l.env))];
    lines.push(`  ${t.file} [${t.format}, ${t.launches.length} launch(es)]: ${names.join(', ')}`);
  }
  lines.push('', 'Launch references with no environment (nothing to check):');
  for (const m of mentions) lines.push(`  ${m}`);
  return { ok: failures.length === 0, lines, failures, templates };
}

function usage() {
  return [
    'usage: check-template-env.mjs [options]',
    '',
    '  --root <dir>            repository whose tracked templates are checked (default: this repo)',
    '  --server-source <dir>   scan a local server checkout instead of cloning',
    `  --server-repo <url>     clone URL (default: https://github.com/${DEFAULT_REPO}.git)`,
    `  --ref <branch>          branch or tag to clone (default: ${DEFAULT_REF})`,
    '',
    'exit 0 every set name has a reader · exit 1 an unread name, an unreadable template, or a fetch failure · exit 2 usage',
  ].join('\n');
}

async function main() {
  const scriptPath = fileURLToPath(import.meta.url);
  const opts = {
    root: resolve(dirname(scriptPath), '..'),
    serverSource: null,
    serverRepo: `https://github.com/${DEFAULT_REPO}.git`,
    ref: DEFAULT_REF,
  };
  const args = process.argv.slice(2);
  for (let i = 0; i < args.length; i += 1) {
    const [arg, value] = [args[i], args[i + 1]];
    if (arg === '--root' && value) opts.root = resolve(args[(i += 1)]);
    else if (arg === '--server-source' && value) opts.serverSource = resolve(args[(i += 1)]);
    else if (arg === '--server-repo' && value) opts.serverRepo = args[(i += 1)];
    else if (arg === '--ref' && value) opts.ref = args[(i += 1)];
    else if (arg === '--help' || arg === '-h') { console.log(usage()); process.exit(0); }
    else { console.error(`error: unrecognized argument "${arg}"\n\n${usage()}`); process.exit(2); }
  }

  let serverDir = opts.serverSource;
  let cleanup = () => {};
  let origin = serverDir;
  if (!serverDir) {
    const cloned = cloneServer({ repoUrl: opts.serverRepo, ref: opts.ref });
    if (!cloned.ok) {
      console.error(`Template-env check FAILED — the server source could not be fetched, so nothing was checked.\n  ${cloned.reason}`);
      process.exit(1);
    }
    serverDir = cloned.dir;
    cleanup = cloned.cleanup;
    origin = `${opts.serverRepo}@${opts.ref}`;
  }

  // The check's own files carry sample templates; they are not templates.
  const self = [scriptPath, scriptPath.replace(/\.mjs$/, '.test.mjs')].map((p) => relative(opts.root, p).split(sep).join('/'));
  let result;
  try {
    result = runTemplateEnvCheck({ root: opts.root, serverDir, exclude: self });
  } finally {
    cleanup();
  }
  console.log(`Template-env check — templates tracked in ${opts.root}, server source ${origin}\n`);
  for (const line of result.lines) console.log(line);
  if (!result.ok) {
    console.error('\nTemplate-env check FAILED:');
    for (const f of result.failures) console.error(`  ${f}`);
    process.exit(1);
  }
  console.log('\nTemplate-env check passed — every name a template sets for the server has a reader.');
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  await main();
}
