#!/usr/bin/env node
/**
 * check-spec-subtype-table.mjs — zero-dependency check that every statement
 * of the ratified `attestation/*` sub-type table in the Typed Standards
 * Specification lists the same sub-types.
 *
 * WHY THIS EXISTS. The specification states its v0.1 attestation sub-type
 * table in more than one place. The v0.1.4 revision added
 * `attestation/revises/v1` to the §6.2 glossary entry, the §8.12 opening
 * paragraph and the §8.12.1 table, and not to the two §7.4 statements (the
 * `attestation/*` family bullet and the "Q36 ratified sub-type table"
 * paragraph). The disagreement reached the reference verifier, which followed
 * the shorter list (civic-ai-tools#230; the verifier's side is
 * npstorey/typedstandards#96). Reading the statements side by side is what
 * failed; this script is the instrument that replaces the reading.
 *
 * WHAT IS DERIVED. No sub-type is named in this file. The reference set is
 * the §8.12.1 table's rows (§7.4 says the full table lives in §8.12); every
 * other statement is read from the specification's text and compared with
 * it. What this file does name is WHERE each statement lives — its section
 * heading and the words that open it — because a check that silently passes
 * when a statement moves or is reworded is not a check. So:
 *
 *  (a) each expected statement is located by section heading plus an opening
 *      marker, and must be found exactly once — a missing or ambiguous
 *      heading or statement fails, as does a statement whose list cannot be
 *      parsed item by item;
 *  (b) each statement's sub-types must equal the table's, with no duplicates.
 *      URI-form statements compare full URIs (`attestation/<verb>/v<N>`);
 *      the two prose enumerations name bare verbs ("withdraws / reinstates
 *      / ...") and compare verbs;
 *  (c) any other line in the document naming more than half of the table's
 *      verbs is reported as an unrecognized statement, so a new restatement
 *      of the table has to be added here (and so compared) rather than drift
 *      unchecked.
 *
 * BLIND SPOTS, STATED. Order is not compared, only membership. A restatement
 * split across lines, or one naming half the table or fewer, escapes rule (c).
 * The prose enumerations carry no version, so a `v2` of an existing verb
 * would read as the same verb there. The comparison with the reference
 * verifier's registered set is not made here: that set becomes an export of
 * `@typedstandards/verify-core` only in a later release, and this repository
 * installs the published package.
 *
 * Zero dependencies: Node built-ins only. Run via `npm run check:spec-subtype-table`.
 * Self-test: `npm run check:spec-subtype-table:self-test`.
 */

import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import process from 'node:process';

/** The one document this check governs, relative to the repo root. */
export const SPEC_PATH = 'docs/architecture/typed-standards-specification.md';

/**
 * Where each statement of the table lives. `section` is a heading's level and
 * the start of its text; `marker` is how the statement's line begins (for a
 * list or paragraph) and `open`/`close` bracket the enumeration within it.
 * The first entry is the reference every other statement is compared with.
 * Adding, moving or rewording a statement is a deliberate change to this list.
 */
export const STATEMENTS = [
  {
    id: 'table',
    label: '§8.12.1 sub-type table',
    section: { level: 4, title: '8.12.1 Sub-type table' },
    form: 'table',
    headerRow: '| Sub-type |',
  },
  {
    id: 'glossary',
    label: '§6.2 glossary, `attestation/*` namespace entry',
    section: { level: 3, title: '6.2 Glossary' },
    marker: '- **`attestation/*` namespace**',
    form: 'uri-list',
    open: 'The v0.1 sub-type table — ',
    close: ' — is ratified',
  },
  {
    id: 'families',
    label: '§7.4 two-family bullet for `attestation/*`',
    section: { level: 3, title: '7.4 Two-family taxonomy' },
    marker: '- **`attestation/*`** — ',
    form: 'verb-groups',
    open: 'Sub-types cover ',
    close: ' relations.',
  },
  {
    id: 'q36',
    label: '§7.4 "Q36 ratified sub-type table" paragraph',
    section: { level: 3, title: '7.4 Two-family taxonomy' },
    marker: '**Q36 ratified sub-type table.**',
    form: 'uri-list',
    open: 'The v0.1 attestation sub-type table — ',
    close: ' — is ratified',
  },
  {
    id: 'namespace',
    label: '§8.12 opening paragraph',
    section: { level: 3, title: '8.12 The attestation/* namespace' },
    marker: 'An **attestation** is one of two top-level type families',
    form: 'verb-groups',
    open: 'Attestations cover ',
    close: ' relations.',
  },
];

const URI_RE = /^`attestation\/([A-Za-z]+)\/(v\d+)`$/;
const VERB_RE = /^[a-z][A-Za-z]*$/;
const HEADING_RE = /^(#{1,6}) (.+)$/;
const FENCE_RE = /^\s*(```|~~~)/;

/** Split a document into lines, marking which sit inside a fenced code block. */
export function scanLines(source) {
  const text = source.charCodeAt(0) === 0xfeff ? source.slice(1) : source;
  let fenced = false;
  return text.split('\n').map((raw, i) => {
    const isFence = FENCE_RE.test(raw);
    const inFence = fenced || isFence;
    if (isFence) fenced = !fenced;
    return { text: raw.replace(/\r$/, ''), line: i + 1, inFence };
  });
}

/** Headings outside code fences, as { level, title, index }. */
export function headings(lines) {
  const out = [];
  lines.forEach((l, index) => {
    if (l.inFence) return;
    const m = HEADING_RE.exec(l.text);
    if (m) out.push({ level: m[1].length, title: m[2].trim(), index });
  });
  return out;
}

/**
 * The line range [start, end) of the one section whose heading has this level
 * and begins with this title. Returns { ok, start, end } or { ok: false, kind, message }.
 */
export function findSection(lines, { level, title }) {
  const all = headings(lines);
  const hits = all.filter((h) => h.level === level && h.title.startsWith(title));
  const want = `${'#'.repeat(level)} ${title}`;
  if (hits.length === 0) {
    return { ok: false, kind: 'section-not-found', message: `no heading "${want}…" found` };
  }
  if (hits.length > 1) {
    return {
      ok: false,
      kind: 'section-ambiguous',
      message: `heading "${want}…" appears ${hits.length} times (lines ${hits.map((h) => lines[h.index].line).join(', ')})`,
    };
  }
  const start = hits[0].index + 1;
  const next = all.find((h) => h.index > hits[0].index && h.level <= level);
  return { ok: true, start, end: next ? next.index : lines.length };
}

/** A URI list: "`attestation/a/v1`, `attestation/b/v1`, …". */
export function parseUriList(segment) {
  const entries = [];
  for (const item of segment.split(', ')) {
    const m = URI_RE.exec(item.trim());
    if (!m) return { ok: false, message: `item ${JSON.stringify(item)} is not a backticked attestation/<verb>/v<N> URI` };
    entries.push({ uri: `attestation/${m[1]}/${m[2]}`, verb: m[1] });
  }
  return { ok: true, entries };
}

/**
 * A prose enumeration by relation kind:
 * "lifecycle (withdraws / reinstates — aside), reference (a — aside — / b), and x (c)".
 * An em-dash aside inside a group is dropped; anything left outside the groups
 * other than commas and "and" makes the statement unparseable.
 */
export function parseVerbGroups(segment) {
  const entries = [];
  const groupRe = /([A-Za-z][A-Za-z-]*) \(([^()]*)\)/g;
  let groups = 0;
  for (const m of segment.matchAll(groupRe)) {
    groups += 1;
    const body = m[2].replace(/\s+—[^—]*—\s*/g, ' ').replace(/\s+—[^—]*$/, '');
    for (const item of body.split('/')) {
      const verb = item.trim();
      if (!VERB_RE.test(verb)) {
        return { ok: false, message: `in group "${m[1]}", ${JSON.stringify(verb)} is not a bare sub-type verb` };
      }
      entries.push({ uri: null, verb });
    }
  }
  const residue = segment.replace(groupRe, '').replace(/\band\b/g, '').replace(/[\s,]/g, '');
  if (groups === 0) return { ok: false, message: 'no "kind (verb / verb …)" group found' };
  if (residue !== '') return { ok: false, message: `text outside the groups: ${JSON.stringify(residue)}` };
  return { ok: true, entries };
}

/** Locate and parse one statement. Returns { ok, lines: [..], entries } or { ok: false, kind, message }. */
export function readStatement(lines, spec) {
  const section = findSection(lines, spec.section);
  if (!section.ok) return section;
  const body = lines.slice(section.start, section.end);

  if (spec.form === 'table') {
    const headerAt = body.findIndex((l) => !l.inFence && l.text.startsWith(spec.headerRow));
    if (headerAt === -1) {
      return { ok: false, kind: 'statement-not-found', message: `no table row starting "${spec.headerRow}" in its section` };
    }
    const rows = [];
    for (let i = headerAt + 1; i < body.length && body[i].text.startsWith('|'); i += 1) {
      if (/^\|[\s:|-]+\|$/.test(body[i].text)) continue;
      rows.push(body[i]);
    }
    if (rows.length === 0) return { ok: false, kind: 'empty', message: 'the table has no rows' };
    const entries = [];
    for (const row of rows) {
      const cell = row.text.split('|')[1].trim();
      const m = URI_RE.exec(cell);
      if (!m) {
        return {
          ok: false,
          kind: 'unparseable',
          message: `line ${row.line}: first cell ${JSON.stringify(cell)} is not a backticked attestation/<verb>/v<N> URI`,
        };
      }
      entries.push({ uri: `attestation/${m[1]}/${m[2]}`, verb: m[1], line: row.line });
    }
    return { ok: true, lines: rows.map((r) => r.line), entries };
  }

  const hits = body.filter((l) => !l.inFence && l.text.startsWith(spec.marker));
  if (hits.length === 0) {
    return { ok: false, kind: 'statement-not-found', message: `no line starting ${JSON.stringify(spec.marker)} in its section` };
  }
  if (hits.length > 1) {
    return {
      ok: false,
      kind: 'statement-ambiguous',
      lines: hits.map((h) => h.line),
      message: `${hits.length} lines start ${JSON.stringify(spec.marker)} (lines ${hits.map((h) => h.line).join(', ')})`,
    };
  }
  const { text, line } = hits[0];
  const from = text.indexOf(spec.open);
  const to = from === -1 ? -1 : text.indexOf(spec.close, from + spec.open.length);
  if (from === -1 || to === -1) {
    return {
      ok: false,
      kind: 'unparseable',
      lines: [line],
      message: `line ${line}: the enumeration between ${JSON.stringify(spec.open)} and ${JSON.stringify(spec.close)} is not there`,
    };
  }
  const segment = text.slice(from + spec.open.length, to);
  const parsed = spec.form === 'uri-list' ? parseUriList(segment) : parseVerbGroups(segment);
  if (!parsed.ok) return { ok: false, kind: 'unparseable', lines: [line], message: `line ${line}: ${parsed.message}` };
  if (parsed.entries.length === 0) return { ok: false, kind: 'empty', lines: [line], message: `line ${line}: the enumeration is empty` };
  return { ok: true, lines: [line], entries: parsed.entries.map((e) => ({ ...e, line })) };
}

const where = (lines) =>
  lines.length === 1 ? `line ${lines[0]}` : `lines ${lines[0]}-${lines[lines.length - 1]}`;

const duplicatesOf = (keys) => [...new Set(keys.filter((k, i) => keys.indexOf(k) !== i))];

/**
 * Check one document. Returns { statements, violations } — `statements` holds
 * each statement found, as { id, label, lines, entries }.
 */
export function checkSubtypeTable(source, statementSpecs = STATEMENTS) {
  const lines = scanLines(source);
  const violations = [];
  const statements = [];
  const located = []; // lines of statements found but not read, so rule (c) does not report them twice

  for (const spec of statementSpecs) {
    const got = readStatement(lines, spec);
    if (!got.ok) {
      violations.push({ kind: got.kind, statement: spec.id, message: `${spec.label}: ${got.message}` });
      if (got.lines) located.push(...got.lines);
      continue;
    }
    statements.push({ id: spec.id, label: spec.label, form: spec.form, lines: got.lines, entries: got.entries });
  }

  for (const s of statements) {
    const keys = s.entries.map((e) => (s.form === 'verb-groups' ? e.verb : e.uri));
    for (const dup of duplicatesOf(keys)) {
      violations.push({
        kind: 'duplicate',
        statement: s.id,
        subtype: dup,
        message: `${s.label} (${where(s.lines)}) lists ${dup} more than once`,
      });
    }
  }

  const reference = statements.find((s) => s.id === statementSpecs[0].id);
  if (!reference) return { statements, violations };

  const refUris = new Set(reference.entries.map((e) => e.uri));
  const refVerbs = new Set(reference.entries.map((e) => e.verb));
  const refWhere = `the ${reference.label} (${where(reference.lines)})`;

  for (const s of statements) {
    if (s === reference) continue;
    const byVerb = s.form === 'verb-groups';
    const mine = new Set(s.entries.map((e) => (byVerb ? e.verb : e.uri)));
    const theirs = byVerb ? refVerbs : refUris;
    for (const k of theirs) {
      if (!mine.has(k)) {
        violations.push({
          kind: 'missing',
          statement: s.id,
          subtype: k,
          message: `${s.label} (${where(s.lines)}) lacks ${k}, which ${refWhere} lists`,
        });
      }
    }
    for (const k of mine) {
      if (!theirs.has(k)) {
        violations.push({
          kind: 'extra',
          statement: s.id,
          subtype: k,
          message: `${s.label} (${where(s.lines)}) lists ${k}, which ${refWhere} does not`,
        });
      }
    }
  }

  // (c) an unrecognized restatement: a line naming more than half the verbs.
  const known = new Set([...statements.flatMap((s) => s.lines), ...located]);
  const verbs = [...refVerbs];
  const threshold = Math.floor(verbs.length / 2) + 1;
  const wordRes = verbs.map((v) => new RegExp(`(?<![A-Za-z])${v}(?![A-Za-z])`));
  for (const l of lines) {
    if (l.inFence || known.has(l.line)) continue;
    const named = verbs.filter((_, i) => wordRes[i].test(l.text));
    if (named.length >= threshold) {
      violations.push({
        kind: 'unrecognized-statement',
        line: l.line,
        message:
          `line ${l.line} names ${named.length} of the table's ${verbs.length} sub-types and is not a ` +
          `statement this check knows; if it restates the table, add it to STATEMENTS in ` +
          `scripts/check-spec-subtype-table.mjs so it is compared`,
      });
    }
  }

  return { statements, violations };
}

/** Run the check over the specification. Returns { relPath, statements, violations, ok }. */
export function runSubtypeTableCheck(repoRoot, relPath = SPEC_PATH) {
  let source;
  try {
    source = readFileSync(resolve(repoRoot, relPath), 'utf8');
  } catch (err) {
    return {
      relPath,
      statements: [],
      violations: [{ kind: 'unreadable', message: `cannot read ${relPath}: ${err.message}` }],
      ok: false,
    };
  }
  const { statements, violations } = checkSubtypeTable(source);
  return { relPath, statements, violations, ok: violations.length === 0 };
}

function main() {
  const args = process.argv.slice(2);
  const scriptDir = dirname(fileURLToPath(import.meta.url));
  let repoRoot = resolve(scriptDir, '..');
  let file = SPEC_PATH;
  for (let i = 0; i < args.length; i += 1) {
    if (args[i] === '--root' && args[i + 1]) repoRoot = resolve(args[(i += 1)]);
    else if (args[i] === '--file' && args[i + 1]) file = args[(i += 1)];
    else {
      console.error('usage: check-spec-subtype-table.mjs [--root <dir>] [--file <path>]');
      process.exit(2);
    }
  }

  const { relPath, statements, violations, ok } = runSubtypeTableCheck(repoRoot, file);
  console.log(relPath);
  const failing = new Set(violations.map((v) => v.statement).filter(Boolean));
  for (const s of statements) {
    const unit = s.form === 'verb-groups' ? 'sub-type verbs' : 'sub-type URIs';
    console.log(`  ${failing.has(s.id) ? 'FAIL' : 'OK  '} ${s.label} (${where(s.lines)}) — ${s.entries.length} ${unit}`);
  }
  for (const v of violations) console.log(`  [${v.kind}] ${v.message}`);
  if (!ok) {
    console.error(
      '\nSpec-subtype-table check FAILED. Every statement of the ratified attestation ' +
        'sub-type table in the specification must list the same sub-types as the §8.12.1 ' +
        'table. See scripts/check-spec-subtype-table.mjs for the rules.',
    );
    process.exit(1);
  }
  console.log('\nSpec-subtype-table check passed.');
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main();
}
