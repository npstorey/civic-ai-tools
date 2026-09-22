// Self-test for scripts/check-spec-subtype-table.mjs.
//
// The known-bad fixture is the REAL pair of §7.4 lines that omitted
// `attestation/revises/v1` from specification v0.1.4 through v0.1.9,
// recovered verbatim from the hub commit the phase branched from:
//
//   git show cfdb210:docs/architecture/typed-standards-specification.md | sed -n '367p;373p'
//
// They are pinned here rather than described, so the check is demonstrated
// against the defect that shipped (civic-ai-tools#230) and not a
// reconstruction of it. The other fixtures are built by specFixture() below,
// which writes each of the five statements in the shape the specification
// gives it (§6.2 line 205, §7.4 lines 367 and 373, §8.12 line 1412, the
// §8.12.1 table at lines 1414-1433, all at cfdb210) around a sub-type list
// the test chooses, so each failure mode can be driven in isolation.
//
// Run: node --test scripts/check-spec-subtype-table.test.mjs

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  SPEC_PATH,
  STATEMENTS,
  checkSubtypeTable,
  parseUriList,
  parseVerbGroups,
  runSubtypeTableCheck,
} from './check-spec-subtype-table.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '..');

/** KNOWN-BAD, VERBATIM: cfdb210 line 367, the §7.4 `attestation/*` family bullet. */
const CFDB210_LINE_367 = "- **`attestation/*`** — *assertion about another node.* The node carries at least one `targetNodeId` referencing the node it asserts about. It does not stand alone — without its target the assertion has no subject. Sub-types cover lifecycle (withdraws / reinstates / supersedes / publishes), reference (locatedAt / wasDerivedFrom / answersQuestion / supportedBy / opposedBy), claim-to-claim (corroborates / contradicts / endorses), and authority-bearing (certifies / evaluates / conforms) relations.";

/** KNOWN-BAD, VERBATIM: cfdb210 line 373, the §7.4 "Q36 ratified sub-type table" paragraph. */
const CFDB210_LINE_373 = "**Q36 ratified sub-type table.** The v0.1 attestation sub-type table — `attestation/withdraws/v1`, `attestation/reinstates/v1`, `attestation/supersedes/v1`, `attestation/publishes/v1`, `attestation/locatedAt/v1`, `attestation/corroborates/v1`, `attestation/contradicts/v1`, `attestation/endorses/v1`, `attestation/wasDerivedFrom/v1`, `attestation/answersQuestion/v1`, `attestation/supportedBy/v1`, `attestation/opposedBy/v1`, `attestation/certifies/v1`, `attestation/evaluates/v1`, `attestation/conforms/v1` — is ratified with three explicit refinements: `extractsTo` merges into `wasDerivedFrom` (with `AnalyticalDerivation` as the content-shape variant when source is untyped and target is typed); `endorses` and `corroborates` stay distinct sub-types (peer attestation vs. institutional endorsement carries meaningfully different signal); and Q38 resolves with `locatedAt` suffices, no `copyOf` sub-type. Each sub-type declares its authorization rule (`publisher-only`, `any-with-binding`, or `specific-role-required`) and its payload shape; the full table lives and §8.12 of this specification. Corresponding ratified `content/*` sub-types are `content/analysis/v1` (built — the legacy and datHere content shapes both map to it), `content/claim/v1` / `content/question/v1` / `content/evidence/v1` (reserved name-only — promotion gated on first typed-content producer), `content/host/v1` / `content/hostPolicy/v1` / `content/hostTermsOfUse/v1` (reserved name-only per [Q22](open-questions.md#q22--host-as-typeable-subject--host-self-attestation-shape)), and `content/tool/v1` (reserved name-only).";

/** The sixteen sub-types the §8.12.1 table carries at cfdb210, with the relation kind the prose groups them by. */
const SIXTEEN = [
  ['withdraws', 'lifecycle'],
  ['reinstates', 'lifecycle'],
  ['supersedes', 'lifecycle'],
  ['revises', 'lifecycle'],
  ['publishes', 'lifecycle'],
  ['locatedAt', 'reference'],
  ['corroborates', 'claim-to-claim'],
  ['contradicts', 'claim-to-claim'],
  ['endorses', 'claim-to-claim'],
  ['wasDerivedFrom', 'reference'],
  ['answersQuestion', 'reference'],
  ['supportedBy', 'reference'],
  ['opposedBy', 'reference'],
  ['certifies', 'authority-bearing'],
  ['evaluates', 'authority-bearing'],
  ['conforms', 'authority-bearing'],
];
const KINDS = ['lifecycle', 'reference', 'claim-to-claim', 'authority-bearing'];
const without = (verb) => SIXTEEN.filter(([v]) => v !== verb);

const uriList = (list) => list.map(([v]) => `\`attestation/${v}/v1\``).join(', ');

/** "lifecycle (a / b — aside), reference (c — aside — / d), …, and authority-bearing (e)" */
function verbGroups(list, { asides = false } = {}) {
  const groups = KINDS.map((kind) => {
    const verbs = list.filter(([, k]) => k === kind).map(([v]) => v);
    if (verbs.length === 0) return null;
    if (asides && kind === 'lifecycle') return `${kind} (${verbs.join(' / ')} — operationalized per §8.10)`;
    if (asides && kind === 'reference') {
      const [first, ...rest] = verbs;
      return `${kind} (${[`${first} — operationalized per §8.10 —`, ...rest].join(' / ')})`;
    }
    return `${kind} (${verbs.join(' / ')})`;
  }).filter(Boolean);
  return `${groups.slice(0, -1).join(', ')}, and ${groups[groups.length - 1]}`;
}

/**
 * A document carrying the five statements in the specification's shapes.
 * Each option is the sub-type list for that statement; `null` omits it.
 * `lines` overrides a statement's whole line with a verbatim string.
 */
function specFixture({
  table = SIXTEEN,
  glossary = SIXTEEN,
  families = SIXTEEN,
  q36 = SIXTEEN,
  namespace = SIXTEEN,
  lines = {},
  extra = [],
} = {}) {
  const out = ['---', 'Version: v0.1.9', '---', '', '# Typed Standards Specification', ''];
  out.push('## 6. Conventions and Terminology', '', '### 6.2 Glossary', '');
  out.push('- **`content/*` namespace** *(normative)*: The top-level type family for **standalone assertions**.');
  if (glossary) {
    out.push(
      '- **`attestation/*` namespace** *(normative)*: The top-level type family for **assertions about another node** — ' +
        `nodes whose payloads carry at least one \`targetNodeId\`. The v0.1 sub-type table — ${uriList(glossary)} — is ratified. ` +
        'Operationalization per sub-type lands via downstream ADRs.',
    );
  }
  out.push('', '## 7. Architecture', '', '### 7.4 Two-family taxonomy — one structural primitive, content/* and attestation/*', '');
  if (lines.families) out.push(lines.families);
  else if (families) {
    out.push(
      '- **`attestation/*`** — *assertion about another node.* The node carries at least one `targetNodeId`. ' +
        `Sub-types cover ${verbGroups(families)} relations.`,
    );
  }
  out.push('');
  if (lines.q36) out.push(lines.q36);
  else if (q36) {
    out.push(
      `**Q36 ratified sub-type table.** The v0.1 attestation sub-type table — ${uriList(q36)} — is ratified with three ` +
        'explicit refinements; the full table lives in §8.12 of this specification.',
    );
  }
  out.push('', '### 7.5 The QEC sub-ontology within content/*', '', 'Unrelated text.', '');
  out.push('## 8. Normative specification', '', '### 8.12 The attestation/* namespace', '');
  if (namespace) {
    out.push(
      'An **attestation** is one of two top-level type families: a signed node whose payload carries `targetNodeId`. ' +
        `Attestations cover ${verbGroups(namespace, { asides: true })} relations. The v0.1 sub-type table is ratified.`,
    );
  }
  out.push('');
  if (table) {
    out.push('#### 8.12.1 Sub-type table (v0.1 ratified)', '');
    out.push('| Sub-type | Relation kind | Authorization rule | Payload (beyond structural primitive) |', '|---|---|---|---|');
    for (const [v, k] of table) out.push(`| \`attestation/${v}/v1\` | ${k} | any-with-binding | \`targetNodeId\` |`);
    out.push('', '**Succession vs. correction.** Prose after the table.', '');
  }
  out.push('#### 8.12.2 Existing attestation kinds map to sub-types', '', 'Unrelated text.', '', ...extra, '');
  return out.join('\n');
}

const kinds = (violations) => violations.map((v) => v.kind).sort();

/** Replace the first occurrence of `from`, failing if it is absent — a no-op mutation would pass for the wrong reason. */
function mutate(source, from, to) {
  assert.ok(source.includes(from), `fixture mutation target not found: ${from}`);
  return source.replace(from, to);
}

// --- The parsers, on samples where the answer is written out ---

test('parseUriList reads a backticked URI list and rejects a stray item', () => {
  assert.deepEqual(
    parseUriList('`attestation/a/v1`, `attestation/bC/v2`').entries.map((e) => e.uri),
    ['attestation/a/v1', 'attestation/bC/v2'],
  );
  assert.equal(parseUriList('`attestation/a/v1`, and more').ok, false);
  assert.equal(parseUriList('`content/a/v1`').ok, false, 'a content/* URI is not an attestation sub-type');
});

test('parseVerbGroups reads the prose enumeration, dropping em-dash asides', () => {
  const got = parseVerbGroups(
    'lifecycle (a / b — operationalized per §8.10), reference (c — operationalized per §8.10 — / d), and x-y (e)',
  );
  assert.equal(got.ok, true);
  assert.deepEqual(got.entries.map((e) => e.verb), ['a', 'b', 'c', 'd', 'e']);
  assert.equal(parseVerbGroups('lifecycle (a / b), plus stray words').ok, false, 'text outside the groups is not ignored');
  assert.equal(parseVerbGroups('lifecycle (a / two words)').ok, false, 'a group item must be one verb');
  assert.equal(parseVerbGroups('no groups at all').ok, false);
});

// --- The four failure modes the contract names, and the passing case ---

test('AGREEMENT PASSES: five statements over the same sixteen sub-types', () => {
  const { statements, violations } = checkSubtypeTable(specFixture());
  assert.deepEqual(violations, [], 'the positive control is clean');
  assert.deepEqual(statements.map((s) => s.id).sort(), STATEMENTS.map((s) => s.id).sort(), 'every statement is found');
  for (const s of statements) assert.equal(s.entries.length, SIXTEEN.length, `${s.id} reads all sixteen`);
});

test('A STATEMENT MISSING ONE SUB-TYPE FAILS — each statement, in turn', () => {
  for (const id of ['glossary', 'families', 'q36', 'namespace']) {
    const { violations } = checkSubtypeTable(specFixture({ [id]: without('evaluates') }));
    assert.equal(violations.length, 1, `${id}: exactly one violation`);
    assert.equal(violations[0].kind, 'missing', `${id}: reported as missing`);
    assert.equal(violations[0].statement, id, `${id}: the statement is named`);
    assert.match(violations[0].subtype, /evaluates/, `${id}: the sub-type is named`);
  }
  // The reference itself short one: every other statement then carries an extra.
  const { violations } = checkSubtypeTable(specFixture({ table: without('evaluates') }));
  assert.deepEqual(kinds(violations), ['extra', 'extra', 'extra', 'extra']);
});

test('A STATEMENT WITH AN EXTRA SUB-TYPE FAILS — URI form and verb form', () => {
  const plus = [...SIXTEEN, ['rescinds', 'lifecycle']];
  const uri = checkSubtypeTable(specFixture({ q36: plus }));
  assert.deepEqual(kinds(uri.violations), ['extra']);
  assert.equal(uri.violations[0].subtype, 'attestation/rescinds/v1');

  const verb = checkSubtypeTable(specFixture({ namespace: plus }));
  assert.deepEqual(kinds(verb.violations), ['extra']);
  assert.equal(verb.violations[0].subtype, 'rescinds');

  const version = checkSubtypeTable(
    mutate(specFixture(), '`attestation/conforms/v1` — is ratified.', '`attestation/conforms/v2` — is ratified.'),
  );
  assert.deepEqual(kinds(version.violations), ['extra', 'missing'], 'a URI statement compares versions too');
});

test('A STATEMENT THE CHECK EXPECTS BUT CANNOT FIND FAILS', () => {
  for (const id of ['glossary', 'families', 'q36', 'namespace']) {
    const { violations } = checkSubtypeTable(specFixture({ [id]: null }));
    assert.deepEqual(kinds(violations), ['statement-not-found'], `${id} removed`);
    assert.equal(violations[0].statement, id);
  }

  const renamed = checkSubtypeTable(mutate(specFixture(), '**Q36 ratified sub-type table.**', '**Q36 sub-type table.**'));
  assert.deepEqual(
    kinds(renamed.violations),
    ['statement-not-found', 'unrecognized-statement'],
    'a reworded opening is not silently skipped, and the orphaned line is reported as an unknown restatement',
  );

  const reworded = checkSubtypeTable(mutate(specFixture(), 'Sub-types cover ', 'Sub-types span '));
  assert.deepEqual(kinds(reworded.violations), ['unparseable'], 'a reworded enumeration is not silently skipped');

  const noTable = checkSubtypeTable(specFixture({ table: null }));
  assert.deepEqual(kinds(noTable.violations), ['section-not-found'], 'no reference table');

  const moved = checkSubtypeTable(mutate(specFixture(), '### 6.2 Glossary', '### 6.2 Terms'));
  assert.deepEqual(kinds(moved.violations), ['section-not-found', 'unrecognized-statement'], 'a renamed section');

  const twice = checkSubtypeTable(mutate(specFixture(), '### 7.5 The QEC', '### 7.4 Two-family taxonomy again\n\n### 7.5 The QEC'));
  assert.ok(kinds(twice.violations).includes('section-ambiguous'), 'a duplicated section heading');

  const emptyTable = checkSubtypeTable(specFixture({ table: [] }));
  assert.deepEqual(kinds(emptyTable.violations), ['empty'], 'a table with no rows');
});

// --- The shipped defect, verbatim ---

test('KNOWN-BAD (the real cfdb210 §7.4 lines) FAILS, naming attestation/revises/v1 twice', () => {
  const { statements, violations } = checkSubtypeTable(
    specFixture({ lines: { families: CFDB210_LINE_367, q36: CFDB210_LINE_373 } }),
  );
  assert.equal(statements.length, STATEMENTS.length, 'the real lines are found and parse');
  assert.deepEqual(
    violations.map((v) => [v.kind, v.statement, v.subtype]).sort(),
    [
      ['missing', 'families', 'revises'],
      ['missing', 'q36', 'attestation/revises/v1'],
    ],
  );
  const q36 = statements.find((s) => s.id === 'q36');
  assert.equal(q36.entries.length, SIXTEEN.length - 1, 'the real Q36 paragraph lists fifteen');
});

// --- The rest of the rules ---

test('a duplicated entry fails', () => {
  const { violations } = checkSubtypeTable(specFixture({ glossary: [...SIXTEEN, ['endorses', 'claim-to-claim']] }));
  assert.deepEqual(kinds(violations), ['duplicate']);
  assert.equal(violations[0].subtype, 'attestation/endorses/v1');
});

test('an unparseable item or row fails rather than being skipped', () => {
  const item = checkSubtypeTable(mutate(specFixture(), '`attestation/endorses/v1`, ', 'endorses, '));
  assert.deepEqual(kinds(item.violations), ['unparseable']);
  const row = checkSubtypeTable(mutate(specFixture(), '| `attestation/certifies/v1` |', '| certifies |'));
  assert.deepEqual(kinds(row.violations), ['unparseable']);
});

test('an unrecognized restatement of the table fails; a short mention does not', () => {
  const many = SIXTEEN.slice(0, 9).map(([v]) => v).join(', ');
  const { violations } = checkSubtypeTable(specFixture({ extra: [`A new summary: ${many}.`] }));
  assert.deepEqual(kinds(violations), ['unrecognized-statement']);
  const few = SIXTEEN.slice(0, 8).map(([v]) => v).join(', ');
  assert.deepEqual(checkSubtypeTable(specFixture({ extra: [`A mention: ${few}.`] })).violations, []);
  const fenced = checkSubtypeTable(specFixture({ extra: ['```', `code: ${many}`, '```'] }));
  assert.deepEqual(fenced.violations, [], 'a fenced code block is not prose');
});

// --- The live specification, and the runner ---

test('the live specification: every expected statement is found and parses', () => {
  const source = readFileSync(join(repoRoot, SPEC_PATH), 'utf8');
  const { statements, violations } = checkSubtypeTable(source);
  const structural = violations.filter((v) => !['missing', 'extra', 'duplicate'].includes(v.kind));
  assert.deepEqual(structural, [], 'no statement is missing, ambiguous or unparseable, and none is unrecognized');
  assert.equal(statements.length, STATEMENTS.length);
});

test('an unreadable target fails rather than passing quietly', () => {
  const result = runSubtypeTableCheck(repoRoot, 'docs/architecture/does-not-exist.md');
  assert.equal(result.ok, false);
  assert.equal(result.violations[0].kind, 'unreadable');
});
