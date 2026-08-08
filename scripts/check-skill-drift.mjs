#!/usr/bin/env node
/**
 * check-skill-drift.mjs — zero-dependency drift check between this repo's skill
 * guidance and the copies embedded in the public socrata-mcp-server.
 *
 * WHY: docs/skills/README.md §Governance names `docs/skills/*.md` the source of
 * truth and socrata-mcp-server/src/skills/*.ts hand-maintained copies of it.
 * A hand-maintained copy with no mechanical check is a copy that drifts. This
 * script is that check.
 *
 * WHAT IT COMPARES
 *   docs/skills/<name>.md            (source of truth, this repo)
 *   src/skills/<name>.ts             (embedded copy, socrata-mcp-server)
 *     fetched in CI from
 *     https://raw.githubusercontent.com/npstorey/socrata-mcp-server/main/src/skills/<name>.ts
 *
 * Only base/local/web are in scope: those are the three skills the server
 * embeds. docs/skills/{data-commons,boston}.md have no embedded copy in that
 * server, so there is nothing to drift against and they are not checked.
 *
 * CREDENTIAL-FREE: the fetch is an unauthenticated GET of a public raw file.
 * This script never reads an environment variable, never sends an Authorization
 * header, and has no credential surface at all.
 *
 * ── DESIGN DECISION 1: how the embedded string is extracted ──────────────────
 * Each embedded copy is a single top-level `export const <NAME>_SKILL = ` bound
 * to one template literal holding the markdown verbatim. Extraction is:
 *
 *   1. Locate `export const <EXPORT>` (EXPORT = UPPER_SNAKE(name) + '_SKILL'),
 *      allow an optional `: string` annotation, require `=` then a backtick.
 *   2. Scan forward honoring backslash escapes to the matching *unescaped*
 *      closing backtick.
 *   3. Reject an unescaped `${` inside the literal. Interpolation would mean
 *      the shipped string is not a static document, so there is nothing this
 *      check could soundly compare; that is an error, not a pass.
 *   4. Decode the template-literal escape sequences with a hand-written decoder
 *      (`decodeTemplateEscapes`).
 *
 * Step 4 is deliberately NOT `eval` / `new Function`. The input is fetched over
 * the network in CI; evaluating it would be arbitrary remote code execution in
 * a job that has a checkout of this repo. A parser cannot be talked into
 * running anything. This is the single most load-bearing choice in the file.
 *
 * ── DESIGN DECISION 2: what comparison is applied ───────────────────────────
 * EXACT string equality, after exactly two normalizations, both of which are
 * transport artifacts rather than content:
 *
 *   - a leading UTF-8 BOM is stripped from either side;
 *   - CRLF and lone CR are normalized to LF on both sides.
 *
 * Nothing else. No trimming, no trailing-newline tolerance, no whitespace
 * collapsing, no markdown-aware normalization. The reason is that a template
 * literal can represent ANY markdown byte-for-byte — including a trailing
 * newline, by putting the closing backtick on its own line — so exact equality
 * is always achievable by a correct copy. Every normalization beyond the two
 * above would be a decision to tolerate some class of divergence, and this
 * check exists precisely to refuse to make that decision silently. If a
 * tolerance is ever wanted, it belongs in an ADR first, not in this file.
 *
 * Drift fails loudly: exit 1 with a per-skill line-level diff (LCS-based,
 * unified-ish, capped by --max-diff-lines) plus byte/line counts and the first
 * differing line, so the failure is actionable from the CI log alone.
 *
 * ── OFFLINE MODE ────────────────────────────────────────────────────────────
 * `--source <dir>` reads the embedded copies from a local directory instead of
 * fetching. That is how the self-test runs (fixtures, no network) and how you
 * can diff against a local checkout of the server:
 *
 *   node scripts/check-skill-drift.mjs --source ../socrata-mcp-server/src/skills
 *
 * Programmatic callers can inject a reader outright: runDriftCheck({ readEmbedded }).
 *
 * ── FIXING DRIFT ────────────────────────────────────────────────────────────
 * `--emit <dir>` renders the embedded modules that WOULD be in sync and writes
 * them to <dir>, ready to copy over socrata-mcp-server/src/skills/. Re-syncing
 * is therefore mechanical, not a hand transcription — which matters, because
 * hand transcription is how the copies drifted in the first place. A self-test
 * round-trips emit -> extract against the real docs/skills/*.md, so the
 * escaping rule is executable rather than prose.
 *
 * Zero dependencies: Node built-ins only. Run via `npm run check:skill-drift`.
 */

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import process from 'node:process';

/** Skills the socrata-mcp-server embeds. Everything else in docs/skills/ has no copy. */
export const EMBEDDED_SKILLS = ['base', 'local', 'web'];

const DEFAULT_REPO = 'npstorey/socrata-mcp-server';
const DEFAULT_REF = 'main';
const DEFAULT_MAX_DIFF_LINES = 60;
const FETCH_TIMEOUT_MS = 20_000;
const MAX_FETCH_BYTES = 2 * 1024 * 1024;

/** `base` -> `BASE_SKILL`; `data-commons` -> `DATA_COMMONS_SKILL`. */
export function exportNameFor(skill) {
  return `${skill.replace(/[^A-Za-z0-9]+/g, '_').toUpperCase()}_SKILL`;
}

/** Raw-content URL for one embedded copy. */
export function rawUrlFor(skill, { repo = DEFAULT_REPO, ref = DEFAULT_REF } = {}) {
  return `https://raw.githubusercontent.com/${repo}/${ref}/src/skills/${skill}.ts`;
}

/**
 * Decode JS template-literal escape sequences. Hand-written on purpose — see
 * DESIGN DECISION 1: this input is fetched over the network and must never be
 * evaluated. Unknown escapes decode to the escaped character, matching JS.
 */
export function decodeTemplateEscapes(raw) {
  let out = '';
  let i = 0;
  while (i < raw.length) {
    const c = raw[i];
    if (c !== '\\') {
      out += c;
      i += 1;
      continue;
    }
    const e = raw[i + 1];
    i += 2;
    switch (e) {
      case undefined:
        out += '\\';
        break;
      case 'n':
        out += '\n';
        break;
      case 'r':
        out += '\r';
        break;
      case 't':
        out += '\t';
        break;
      case 'b':
        out += '\b';
        break;
      case 'f':
        out += '\f';
        break;
      case 'v':
        out += '\v';
        break;
      case '0':
        // \0 is NUL only when not followed by a digit; \0<digit> is legacy octal
        // and is a syntax error in template literals, so treat it as NUL either way.
        out += '\0';
        break;
      case '\n':
        break; // line continuation: the newline is consumed
      case '\r':
        if (raw[i] === '\n') i += 1; // CRLF line continuation
        break;
      case 'x': {
        const hex = raw.slice(i, i + 2);
        if (/^[0-9a-fA-F]{2}$/.test(hex)) {
          out += String.fromCharCode(parseInt(hex, 16));
          i += 2;
        } else {
          out += 'x';
        }
        break;
      }
      case 'u': {
        if (raw[i] === '{') {
          const close = raw.indexOf('}', i);
          const body = close === -1 ? '' : raw.slice(i + 1, close);
          if (close !== -1 && /^[0-9a-fA-F]{1,6}$/.test(body)) {
            out += String.fromCodePoint(parseInt(body, 16));
            i = close + 1;
            break;
          }
          out += 'u';
          break;
        }
        const hex = raw.slice(i, i + 4);
        if (/^[0-9a-fA-F]{4}$/.test(hex)) {
          out += String.fromCharCode(parseInt(hex, 16));
          i += 4;
        } else {
          out += 'u';
        }
        break;
      }
      default:
        out += e; // \\ \` \$ \' \" and any other escaped char decode to the char
    }
  }
  return out;
}

/**
 * Pull the markdown out of one embedded copy.
 * Returns { ok: true, text } or { ok: false, reason }.
 */
export function extractEmbeddedSkill(source, exportName) {
  const decl = new RegExp(String.raw`export\s+const\s+${exportName}\b`);
  const declMatch = decl.exec(source);
  if (!declMatch) {
    return { ok: false, reason: `no \`export const ${exportName}\` declaration found` };
  }
  // Between the identifier and the template literal, allow only an optional
  // type annotation and the `=`. Anything else means the shape changed.
  const after = source.slice(declMatch.index + declMatch[0].length);
  const head = /^(\s*:\s*[A-Za-z0-9_$.<>[\]\s|]*?)?\s*=\s*`/.exec(after);
  if (!head) {
    return {
      ok: false,
      reason: `${exportName} is not bound directly to a template literal (expected "=" then a backtick)`,
    };
  }
  const bodyStart = head[0].length;
  let i = bodyStart;
  let raw = null;
  while (i < after.length) {
    const c = after[i];
    if (c === '\\') {
      i += 2;
      continue;
    }
    if (c === '`') {
      raw = after.slice(bodyStart, i);
      break;
    }
    if (c === '$' && after[i + 1] === '{') {
      return {
        ok: false,
        reason:
          `\`${exportName}\` contains a \${...} interpolation at offset ${i - bodyStart}; ` +
          'the embedded copy must be a static document for drift to be checkable',
      };
    }
    i += 1;
  }
  if (raw === null) {
    return { ok: false, reason: `unterminated template literal for \`${exportName}\`` };
  }
  return { ok: true, text: decodeTemplateEscapes(raw) };
}

/**
 * Inverse of decodeTemplateEscapes: escape a document for embedding in a
 * template literal. Only three sequences need it — a backslash, a backtick,
 * and the `${` that would open an interpolation. Everything else, including
 * newlines and non-ASCII, is literal.
 */
export function encodeTemplateLiteral(text) {
  return text.replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/\$\{/g, '\\${');
}

/**
 * Render the embedded module that WOULD be in sync with `text`.
 *
 * This exists so the fix for drift is mechanical rather than hand-transcribed:
 * `--emit` prints these, and a self-test round-trips emit -> extract against
 * the real docs/skills/*.md, which makes the escaping rule executable instead
 * of prose. The closing backtick sits on its own line whenever the document
 * ends with a newline, which is why no trailing-newline tolerance is needed in
 * the comparison.
 */
export function renderEmbeddedModule(skill, text) {
  return [
    `// Sourced from civic-ai-tools/docs/skills/${skill}.md`,
    '// Keep in sync — see civic-ai-tools/docs/skills/README.md for governance.',
    '// Generated by civic-ai-tools scripts/check-skill-drift.mjs --emit; do not hand-edit.',
    '',
    `export const ${exportNameFor(skill)} = \`${encodeTemplateLiteral(text)}\`;`,
    '',
  ].join('\n');
}

/** Strip a leading BOM and normalize CRLF/CR to LF. The only normalization applied. */
export function normalizeForComparison(text) {
  return text.replace(/^﻿/, '').replace(/\r\n?/g, '\n');
}

/**
 * Line-level LCS diff. Returns [{ type: ' '|'-'|'+', text }].
 * '-' is source-of-truth-only, '+' is embedded-copy-only.
 */
export function diffLines(aLines, bLines) {
  const n = aLines.length;
  const m = bLines.length;
  if (n * m > 4_000_000) {
    return [
      { type: '-', text: `<${n} lines of source of truth — too large to diff line by line>` },
      { type: '+', text: `<${m} lines of embedded copy — too large to diff line by line>` },
    ];
  }
  // lcs[i][j] = length of the LCS of aLines[i..] and bLines[j..]
  const lcs = Array.from({ length: n + 1 }, () => new Uint32Array(m + 1));
  for (let i = n - 1; i >= 0; i -= 1) {
    for (let j = m - 1; j >= 0; j -= 1) {
      lcs[i][j] =
        aLines[i] === bLines[j] ? lcs[i + 1][j + 1] + 1 : Math.max(lcs[i + 1][j], lcs[i][j + 1]);
    }
  }
  const out = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (aLines[i] === bLines[j]) {
      out.push({ type: ' ', text: aLines[i] });
      i += 1;
      j += 1;
    } else if (lcs[i + 1][j] >= lcs[i][j + 1]) {
      out.push({ type: '-', text: aLines[i] });
      i += 1;
    } else {
      out.push({ type: '+', text: bLines[j] });
      j += 1;
    }
  }
  while (i < n) out.push({ type: '-', text: aLines[i++] });
  while (j < m) out.push({ type: '+', text: bLines[j++] });
  return out;
}

/** Drop runs of unchanged lines longer than `context`, the way a unified diff does. */
export function condenseDiff(diff, context = 2) {
  const keep = new Array(diff.length).fill(false);
  diff.forEach((d, idx) => {
    if (d.type === ' ') return;
    for (let k = Math.max(0, idx - context); k <= Math.min(diff.length - 1, idx + context); k += 1) {
      keep[k] = true;
    }
  });
  const out = [];
  let skipped = 0;
  diff.forEach((d, idx) => {
    if (keep[idx]) {
      if (skipped > 0) {
        out.push({ type: '@', text: `… ${skipped} unchanged line${skipped === 1 ? '' : 's'} …` });
        skipped = 0;
      }
      out.push(d);
    } else {
      skipped += 1;
    }
  });
  if (skipped > 0) {
    out.push({ type: '@', text: `… ${skipped} unchanged line${skipped === 1 ? '' : 's'} …` });
  }
  return out;
}

/** Compare one skill. Returns a structured result; never throws. */
export function compareSkill(skill, sourceOfTruth, embedded) {
  const a = normalizeForComparison(sourceOfTruth);
  const b = normalizeForComparison(embedded);
  if (a === b) {
    return { skill, status: 'in-sync', lines: a.split('\n').length, chars: a.length };
  }
  const aLines = a.split('\n');
  const bLines = b.split('\n');
  let firstDiffLine = aLines.length < bLines.length ? aLines.length + 1 : bLines.length + 1;
  for (let k = 0; k < Math.min(aLines.length, bLines.length); k += 1) {
    if (aLines[k] !== bLines[k]) {
      firstDiffLine = k + 1;
      break;
    }
  }
  const diff = diffLines(aLines, bLines);
  const removed = diff.filter((d) => d.type === '-').length;
  const added = diff.filter((d) => d.type === '+').length;
  const whitespaceOnly = a.replace(/\s+/g, '') === b.replace(/\s+/g, '');
  return {
    skill,
    status: 'drift',
    firstDiffLine,
    removed,
    added,
    whitespaceOnly,
    chars: { sourceOfTruth: a.length, embedded: b.length },
    lines: { sourceOfTruth: aLines.length, embedded: bLines.length },
    diff,
  };
}

/** Default embedded-copy reader: local dir when `sourceDir` is set, else a public raw fetch. */
export function makeEmbeddedReader({ sourceDir, repo, ref } = {}) {
  if (sourceDir) {
    return async (skill) => {
      const path = join(sourceDir, `${skill}.ts`);
      try {
        return { ok: true, text: readFileSync(path, 'utf8'), origin: path };
      } catch (err) {
        return { ok: false, reason: `cannot read ${path}: ${err.message}`, origin: path };
      }
    };
  }
  return async (skill) => {
    const url = rawUrlFor(skill, { repo, ref });
    try {
      // Credential-free by construction: no headers beyond a UA, no auth, no cookies.
      const res = await fetch(url, {
        headers: { accept: 'text/plain', 'user-agent': 'civic-ai-tools-skill-drift-check' },
        redirect: 'follow',
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      });
      if (!res.ok) {
        return { ok: false, reason: `HTTP ${res.status} ${res.statusText}`, origin: url };
      }
      const text = await res.text();
      if (text.length > MAX_FETCH_BYTES) {
        return { ok: false, reason: `response exceeds ${MAX_FETCH_BYTES} bytes`, origin: url };
      }
      return { ok: true, text, origin: url };
    } catch (err) {
      return { ok: false, reason: `fetch failed: ${err.message}`, origin: url };
    }
  };
}

/**
 * Run the check.
 * @param {object} opts
 * @param {string} opts.docsDir       directory holding the source-of-truth .md files
 * @param {string[]} [opts.skills]    which skills to check
 * @param {Function} [opts.readEmbedded] async (skill) => { ok, text?, reason?, origin }
 * @returns {Promise<{ ok: boolean, results: object[] }>}
 */
export async function runDriftCheck({ docsDir, skills = EMBEDDED_SKILLS, readEmbedded }) {
  const read = readEmbedded ?? makeEmbeddedReader({});
  const results = [];
  for (const skill of skills) {
    const mdPath = join(docsDir, `${skill}.md`);
    let sourceOfTruth;
    try {
      sourceOfTruth = readFileSync(mdPath, 'utf8');
    } catch (err) {
      results.push({
        skill,
        status: 'error',
        reason: `cannot read source of truth ${mdPath}: ${err.message}`,
        sourcePath: mdPath,
      });
      continue;
    }
    const fetched = await read(skill);
    if (!fetched.ok) {
      results.push({
        skill,
        status: 'unavailable',
        reason: fetched.reason,
        origin: fetched.origin,
        sourcePath: mdPath,
      });
      continue;
    }
    const extracted = extractEmbeddedSkill(fetched.text, exportNameFor(skill));
    if (!extracted.ok) {
      results.push({
        skill,
        status: 'error',
        reason: `cannot extract the embedded skill from ${fetched.origin}: ${extracted.reason}`,
        origin: fetched.origin,
        sourcePath: mdPath,
      });
      continue;
    }
    results.push({
      ...compareSkill(skill, sourceOfTruth, extracted.text),
      origin: fetched.origin,
      sourcePath: mdPath,
    });
  }
  return { ok: results.every((r) => r.status === 'in-sync'), results };
}

/** Human-readable report. Returns an array of lines. */
export function formatReport(results, { maxDiffLines = DEFAULT_MAX_DIFF_LINES } = {}) {
  const out = [];
  for (const r of results) {
    if (r.status === 'in-sync') {
      out.push(`OK   ${r.skill} — in sync (${r.lines} lines, ${r.chars} chars)`);
      continue;
    }
    if (r.status === 'unavailable') {
      out.push(`FAIL ${r.skill} — embedded copy unavailable: ${r.reason}`);
      out.push(`       ${r.origin}`);
      continue;
    }
    if (r.status === 'error') {
      out.push(`FAIL ${r.skill} — ${r.reason}`);
      continue;
    }
    out.push(`FAIL ${r.skill} — DRIFT`);
    out.push(`       source of truth : ${r.sourcePath}`);
    out.push(`       embedded copy   : ${r.origin}`);
    out.push(
      `       ${r.removed} line(s) only in the source of truth, ${r.added} only in the embedded copy; ` +
        `first difference at line ${r.firstDiffLine}`,
    );
    out.push(
      `       lines ${r.lines.sourceOfTruth} vs ${r.lines.embedded}, ` +
        `chars ${r.chars.sourceOfTruth} vs ${r.chars.embedded}` +
        (r.whitespaceOnly ? ' (whitespace-only difference)' : ''),
    );
    out.push(`       --- ${r.sourcePath}`);
    out.push(`       +++ ${r.origin}`);
    const condensed = condenseDiff(r.diff);
    const shown = condensed.slice(0, maxDiffLines);
    for (const d of shown) out.push(`       ${d.type === '@' ? '' : d.type}${d.text}`);
    if (condensed.length > shown.length) {
      out.push(
        `       … ${condensed.length - shown.length} more diff line(s) suppressed ` +
          `(raise --max-diff-lines to see them) …`,
      );
    }
  }
  return out;
}

function usage() {
  return [
    'usage: check-skill-drift.mjs [options]',
    '',
    '  --docs <dir>            source-of-truth markdown dir (default: docs/skills)',
    '  --source <dir>          read embedded copies from a local dir instead of fetching',
    `  --repo <owner/name>     GitHub repo to fetch from (default: ${DEFAULT_REPO})`,
    `  --ref <git-ref>         ref to fetch (default: ${DEFAULT_REF})`,
    `  --skills <a,b,c>        skills to check (default: ${EMBEDDED_SKILLS.join(',')})`,
    `  --max-diff-lines <n>    diff lines to print per drifted skill (default: ${DEFAULT_MAX_DIFF_LINES})`,
    '  --json                  emit the structured result as JSON instead of a report',
    '  --emit <dir>            write the in-sync embedded modules to <dir> and exit;',
    '                          compares nothing. Use to regenerate socrata-mcp-server/src/skills/.',
    '',
    'exit 0 in sync (or emit succeeded) · exit 1 drift/unavailable/error · exit 2 usage error',
  ].join('\n');
}

async function main() {
  const scriptDir = dirname(fileURLToPath(import.meta.url));
  const repoRoot = resolve(scriptDir, '..');
  const opts = {
    docsDir: join(repoRoot, 'docs', 'skills'),
    sourceDir: null,
    repo: DEFAULT_REPO,
    ref: DEFAULT_REF,
    skills: EMBEDDED_SKILLS,
    maxDiffLines: DEFAULT_MAX_DIFF_LINES,
    json: false,
    emitDir: null,
  };
  const args = process.argv.slice(2);
  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    const value = args[i + 1];
    if (arg === '--docs' && value) opts.docsDir = resolve(args[(i += 1)]);
    else if (arg === '--source' && value) opts.sourceDir = resolve(args[(i += 1)]);
    else if (arg === '--repo' && value) opts.repo = args[(i += 1)];
    else if (arg === '--ref' && value) opts.ref = args[(i += 1)];
    else if (arg === '--skills' && value) opts.skills = args[(i += 1)].split(',').filter(Boolean);
    else if (arg === '--max-diff-lines' && value) opts.maxDiffLines = Number(args[(i += 1)]);
    else if (arg === '--emit' && value) opts.emitDir = resolve(args[(i += 1)]);
    else if (arg === '--json') opts.json = true;
    else if (arg === '--help' || arg === '-h') {
      console.log(usage());
      process.exit(0);
    } else {
      console.error(`error: unrecognized argument "${arg}"\n\n${usage()}`);
      process.exit(2);
    }
  }
  if (!Number.isFinite(opts.maxDiffLines) || opts.maxDiffLines < 0) {
    console.error(`error: --max-diff-lines must be a non-negative number\n\n${usage()}`);
    process.exit(2);
  }

  if (opts.emitDir) {
    mkdirSync(opts.emitDir, { recursive: true });
    for (const skill of opts.skills) {
      const mdPath = join(opts.docsDir, `${skill}.md`);
      const outPath = join(opts.emitDir, `${skill}.ts`);
      let text;
      try {
        text = readFileSync(mdPath, 'utf8');
      } catch (err) {
        console.error(`error: cannot read ${mdPath}: ${err.message}`);
        process.exit(1);
      }
      writeFileSync(outPath, renderEmbeddedModule(skill, normalizeForComparison(text)));
      console.log(`wrote ${outPath}`);
    }
    console.log(
      '\nCopy these over socrata-mcp-server/src/skills/ to bring the embedded copies back in sync.',
    );
    return;
  }

  const readEmbedded = makeEmbeddedReader({
    sourceDir: opts.sourceDir,
    repo: opts.repo,
    ref: opts.ref,
  });
  const { ok, results } = await runDriftCheck({
    docsDir: opts.docsDir,
    skills: opts.skills,
    readEmbedded,
  });

  if (opts.json) {
    console.log(JSON.stringify({ ok, results }, null, 2));
  } else {
    console.log(
      `Skill-drift check — source of truth ${opts.docsDir}, embedded copies ` +
        (opts.sourceDir ? opts.sourceDir : `${opts.repo}@${opts.ref}:src/skills`),
    );
    console.log('');
    for (const line of formatReport(results, { maxDiffLines: opts.maxDiffLines })) {
      console.log(line);
    }
  }

  if (!ok) {
    console.error(
      '\nSkill-drift check FAILED. docs/skills/*.md is the source of truth ' +
        '(docs/skills/README.md §Governance); update the embedded copies in ' +
        'socrata-mcp-server/src/skills/ to match, then re-run.',
    );
    process.exit(1);
  }
  console.log('\nSkill-drift check passed — every embedded copy matches its source of truth.');
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  await main();
}
