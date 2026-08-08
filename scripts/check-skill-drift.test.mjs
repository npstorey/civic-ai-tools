// Self-test for scripts/check-skill-drift.mjs.
//
// OFFLINE BY CONSTRUCTION: every case here runs against committed fixtures in
// scripts/__fixtures__/skill-drift/ via --source / an injected reader. The
// script's live fetch is exercised by CI, never by this test — a self-test
// that needs the network is a self-test that goes red for reasons that have
// nothing to do with the code.
//
// The drift failure mode is demonstrated with a mutated FIXTURE copy. The real
// docs/skills/*.md and the real embedded copies are never touched to make a
// test fail.
//
// Run: node --test scripts/check-skill-drift.test.mjs

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  EMBEDDED_SKILLS,
  compareSkill,
  condenseDiff,
  decodeTemplateEscapes,
  diffLines,
  encodeTemplateLiteral,
  exportNameFor,
  extractEmbeddedSkill,
  formatReport,
  normalizeForComparison,
  rawUrlFor,
  renderEmbeddedModule,
  runDriftCheck,
} from './check-skill-drift.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '..');
const scriptPath = join(here, 'check-skill-drift.mjs');
const fixtures = join(here, '__fixtures__', 'skill-drift');
const fixtureDocs = join(fixtures, 'docs');
const embedded = (variant) => join(fixtures, `embedded-${variant}`);
const readFixture = (variant) => readFileSync(join(embedded(variant), 'sample.ts'), 'utf8');
const sampleMd = () => readFileSync(join(fixtureDocs, 'sample.md'), 'utf8');

// ── the extractor ───────────────────────────────────────────────────────────

test('exportNameFor maps a skill name to its embedded export', () => {
  assert.equal(exportNameFor('base'), 'BASE_SKILL');
  assert.equal(exportNameFor('local'), 'LOCAL_SKILL');
  assert.equal(exportNameFor('web'), 'WEB_SKILL');
  assert.equal(exportNameFor('data-commons'), 'DATA_COMMONS_SKILL');
});

test('rawUrlFor builds a credential-free public raw URL', () => {
  assert.equal(
    rawUrlFor('base'),
    'https://raw.githubusercontent.com/npstorey/socrata-mcp-server/main/src/skills/base.ts',
  );
  assert.equal(
    rawUrlFor('web', { ref: 'v1.2.3' }),
    'https://raw.githubusercontent.com/npstorey/socrata-mcp-server/v1.2.3/src/skills/web.ts',
  );
});

test('decodeTemplateEscapes is byte-identical to the JS engine', () => {
  // The script decodes escapes by hand instead of evaluating fetched source
  // (see DESIGN DECISION 1). This pins the decoder to real template-literal
  // semantics: the engine is the oracle here, on a local literal only.
  const torture = String.raw`a\`b\\c\$d\ne\tf\rg\u{1F600}h\x41iBj\qk\
l\0m`;
  const engineValue = new Function('return `' + torture + '`;')();
  assert.equal(decodeTemplateEscapes(torture), engineValue);
  // and the specific sequences the real embedded copies rely on
  assert.equal(decodeTemplateEscapes(String.raw`\`\`\`sql`), '```sql');
  assert.equal(decodeTemplateEscapes(String.raw`a\\b`), 'a\\b');
  assert.equal(decodeTemplateEscapes('plain — text'), 'plain — text');
});

test('extractEmbeddedSkill recovers the source of truth byte-for-byte', () => {
  const got = extractEmbeddedSkill(readFixture('in-sync'), 'SAMPLE_SKILL');
  assert.equal(got.ok, true, got.reason);
  assert.equal(got.text, sampleMd(), 'decoded embedded text equals the .md exactly');
  assert.ok(got.text.includes('```sql'), 'fenced block survives un-escaping');
  assert.ok(got.text.includes('(\\)'), 'literal backslash survives un-escaping');
  assert.ok(got.text.endsWith('Done.\n'), 'trailing newline is representable and preserved');
});

test('extractEmbeddedSkill tolerates a `: string` type annotation', () => {
  const got = extractEmbeddedSkill(readFixture('annotated'), 'SAMPLE_SKILL');
  assert.equal(got.ok, true, got.reason);
  assert.equal(got.text, sampleMd());
});

test('extractEmbeddedSkill refuses an interpolated template literal', () => {
  const got = extractEmbeddedSkill(readFixture('interpolated'), 'SAMPLE_SKILL');
  assert.equal(got.ok, false);
  assert.match(got.reason, /interpolation/);
});

test('extractEmbeddedSkill fails when the export is renamed or removed', () => {
  const got = extractEmbeddedSkill(readFixture('no-export'), 'SAMPLE_SKILL');
  assert.equal(got.ok, false);
  assert.match(got.reason, /no `export const SAMPLE_SKILL` declaration found/);
});

test('extractEmbeddedSkill fails on an unterminated literal', () => {
  const got = extractEmbeddedSkill('export const SAMPLE_SKILL = `# no closing tick', 'SAMPLE_SKILL');
  assert.equal(got.ok, false);
  assert.match(got.reason, /unterminated/);
});

// ── the comparison ──────────────────────────────────────────────────────────

test('normalizeForComparison touches only the BOM and line endings', () => {
  assert.equal(normalizeForComparison('﻿a\r\nb\rc\n'), 'a\nb\nc\n');
  assert.equal(normalizeForComparison('  a  \n\n'), '  a  \n\n', 'no trimming, no collapsing');
});

test('a trailing-newline-only difference is drift, not a tolerated variance', () => {
  // Deliberate: a template literal CAN end with a newline, so an exact copy is
  // always achievable and no trailing-newline tolerance is warranted.
  const r = compareSkill('sample', 'body\n', 'body');
  assert.equal(r.status, 'drift');
});

test('compareSkill reports in-sync for an exact match', () => {
  const md = sampleMd();
  const r = compareSkill('sample', md, md);
  assert.equal(r.status, 'in-sync');
  assert.ok(r.lines > 0 && r.chars > 0);
});

test('compareSkill locates the first differing line and counts both sides', () => {
  const a = 'one\ntwo\nthree\nfour\n';
  const b = 'one\ntwo\nTHREE\nfour\n';
  const r = compareSkill('sample', a, b);
  assert.equal(r.status, 'drift');
  assert.equal(r.firstDiffLine, 3);
  assert.equal(r.removed, 1);
  assert.equal(r.added, 1);
  assert.equal(r.whitespaceOnly, false);
});

test('compareSkill flags a whitespace-only divergence as such', () => {
  const r = compareSkill('sample', 'alpha\nbeta\n', 'alpha\n\nbeta\n');
  assert.equal(r.status, 'drift');
  assert.equal(r.whitespaceOnly, true);
});

test('diffLines and condenseDiff produce a readable, elided diff', () => {
  const a = Array.from({ length: 20 }, (_, i) => `line ${i}`);
  const b = a.slice();
  b[10] = 'line ten CHANGED';
  const diff = diffLines(a, b);
  assert.deepEqual(
    diff.filter((d) => d.type === '-').map((d) => d.text),
    ['line 10'],
  );
  assert.deepEqual(
    diff.filter((d) => d.type === '+').map((d) => d.text),
    ['line ten CHANGED'],
  );
  const condensed = condenseDiff(diff, 2);
  assert.ok(condensed.length < diff.length, 'unchanged runs are elided');
  assert.ok(
    condensed.some((d) => d.type === '@'),
    'elisions are marked',
  );
});

// ── end to end, offline ─────────────────────────────────────────────────────

test('passing case: an in-sync embedded copy yields ok', async () => {
  const { ok, results } = await runDriftCheck({
    docsDir: fixtureDocs,
    skills: ['sample'],
    readEmbedded: async () => ({ ok: true, text: readFixture('in-sync'), origin: 'fixture' }),
  });
  assert.equal(ok, true);
  assert.equal(results[0].status, 'in-sync');
});

test('failure mode: drift against a mutated fixture copy, with a usable diff', async () => {
  const { ok, results } = await runDriftCheck({
    docsDir: fixtureDocs,
    skills: ['sample'],
    readEmbedded: async () => ({ ok: true, text: readFixture('drifted'), origin: 'fixture' }),
  });
  assert.equal(ok, false);
  const [r] = results;
  assert.equal(r.status, 'drift');
  assert.equal(r.firstDiffLine, 3, 'the reworded blockquote is the first divergence');
  const report = formatReport(results).join('\n');
  assert.match(report, /FAIL sample — DRIFT/);
  assert.match(report, /-> \*\*Applies to:\*\*/, 'the source-of-truth line is shown');
  assert.match(report, /\+> Applies to:/, 'the drifted line is shown');
  assert.match(report, /-- The `\$query` parameter/, 'the dropped bullet is shown as removed');
});

test('failure mode: an unavailable embedded copy fails rather than passing quietly', async () => {
  const { ok, results } = await runDriftCheck({
    docsDir: fixtureDocs,
    skills: ['sample'],
    readEmbedded: async () => ({ ok: false, reason: 'HTTP 404 Not Found', origin: 'fixture-url' }),
  });
  assert.equal(ok, false);
  assert.equal(results[0].status, 'unavailable');
  assert.match(formatReport(results).join('\n'), /embedded copy unavailable/);
});

test('failure mode: an unextractable embedded copy is an error, not a pass', async () => {
  const { ok, results } = await runDriftCheck({
    docsDir: fixtureDocs,
    skills: ['sample'],
    readEmbedded: async () => ({ ok: true, text: readFixture('interpolated'), origin: 'fixture' }),
  });
  assert.equal(ok, false);
  assert.equal(results[0].status, 'error');
});

test('a missing source-of-truth file is an error, not a pass', async () => {
  const { ok, results } = await runDriftCheck({
    docsDir: fixtureDocs,
    skills: ['no-such-skill'],
    readEmbedded: async () => ({ ok: true, text: readFixture('in-sync'), origin: 'fixture' }),
  });
  assert.equal(ok, false);
  assert.equal(results[0].status, 'error');
  assert.match(results[0].reason, /cannot read source of truth/);
});

// ── the CLI ─────────────────────────────────────────────────────────────────

const runCli = (args) =>
  spawnSync(process.execPath, [scriptPath, ...args], { encoding: 'utf8', cwd: repoRoot });

test('CLI exits 0 on an in-sync tree', () => {
  const r = runCli(['--docs', fixtureDocs, '--source', embedded('in-sync'), '--skills', 'sample']);
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /OK\s+sample — in sync/);
  assert.match(r.stdout, /Skill-drift check passed/);
});

test('CLI exits 1 and prints a diff on drift', () => {
  const r = runCli(['--docs', fixtureDocs, '--source', embedded('drifted'), '--skills', 'sample']);
  assert.equal(r.status, 1);
  assert.match(r.stdout, /FAIL sample — DRIFT/);
  assert.match(r.stdout, /Applies to:/);
  assert.match(r.stderr, /Skill-drift check FAILED/);
  assert.match(r.stderr, /docs\/skills\/\*\.md is the source of truth/);
});

test('CLI --json emits a machine-readable result', () => {
  const r = runCli([
    '--docs',
    fixtureDocs,
    '--source',
    embedded('drifted'),
    '--skills',
    'sample',
    '--json',
  ]);
  assert.equal(r.status, 1);
  const parsed = JSON.parse(r.stdout);
  assert.equal(parsed.ok, false);
  assert.equal(parsed.results[0].skill, 'sample');
  assert.equal(parsed.results[0].status, 'drift');
});

test('CLI exits 2 on a usage error', () => {
  const r = runCli(['--nope']);
  assert.equal(r.status, 2);
  assert.match(r.stderr, /unrecognized argument/);
});

// ── the emitter (the mechanical fix for drift) ──────────────────────────────

test('encodeTemplateLiteral escapes exactly the three sequences that need it', () => {
  assert.equal(encodeTemplateLiteral('a`b'), 'a\\`b');
  assert.equal(encodeTemplateLiteral('a\\b'), 'a\\\\b');
  assert.equal(encodeTemplateLiteral('cost ${x}'), 'cost \\${x}');
  assert.equal(encodeTemplateLiteral('$query and $ alone'), '$query and $ alone', '$ is literal');
  assert.equal(encodeTemplateLiteral('em — dash\nnewline'), 'em — dash\nnewline');
});

test('emit round-trips: renderEmbeddedModule -> extractEmbeddedSkill is the identity', () => {
  const md = sampleMd();
  const rendered = renderEmbeddedModule('sample', md);
  const back = extractEmbeddedSkill(rendered, 'SAMPLE_SKILL');
  assert.equal(back.ok, true, back.reason);
  assert.equal(back.text, md);
});

test('emit round-trips on the REAL source-of-truth documents', () => {
  // Offline, and the strongest form of the escaping-rule guarantee: whatever
  // docs/skills/*.md contains, the emitted module decodes back to it exactly.
  // This is the property the P4-style re-sync would rely on.
  for (const skill of EMBEDDED_SKILLS) {
    const md = normalizeForComparison(
      readFileSync(join(repoRoot, 'docs', 'skills', `${skill}.md`), 'utf8'),
    );
    const rendered = renderEmbeddedModule(skill, md);
    const back = extractEmbeddedSkill(rendered, exportNameFor(skill));
    assert.equal(back.ok, true, `${skill}: ${back.reason}`);
    assert.equal(back.text, md, `${skill}: round-trips byte-for-byte`);
    assert.equal(
      compareSkill(skill, md, back.text).status,
      'in-sync',
      `${skill}: the emitted module would pass the drift check`,
    );
  }
});

test('CLI --emit writes modules that pass the check', () => {
  const outDir = mkdtempSync(join(tmpdir(), 'skill-drift-emit-'));
  const emit = runCli(['--docs', fixtureDocs, '--skills', 'sample', '--emit', outDir]);
  assert.equal(emit.status, 0, emit.stderr);
  assert.match(emit.stdout, /wrote .*sample\.ts/);
  const verify = runCli(['--docs', fixtureDocs, '--source', outDir, '--skills', 'sample']);
  assert.equal(verify.status, 0, verify.stdout + verify.stderr);
  assert.match(verify.stdout, /Skill-drift check passed/);
  rmSync(outDir, { recursive: true, force: true });
});

// ── properties of the script itself ─────────────────────────────────────────

test('the checker never evaluates fetched source and reads no environment', () => {
  // Both are load-bearing security properties, not style preferences: the
  // script's input is fetched over the network in a job holding a checkout of
  // this repo, and the check is chartered as credential-free.
  const src = readFileSync(scriptPath, 'utf8');
  const code = src.slice(src.indexOf('*/') + 2); // skip the header comment
  assert.ok(!/\bnew\s+Function\b/.test(code), 'no new Function');
  assert.ok(!/(^|[^.\w])eval\s*\(/.test(code), 'no eval');
  assert.ok(!/process\.env/.test(code), 'no environment reads');
  assert.ok(!/Authorization|authorization/.test(code), 'no auth header');
});

test('scope: exactly the three skills the server embeds, and each .md exists', () => {
  // Guard against a rename making the check silently check nothing. This does
  // NOT assert the files are in sync — the live comparison is the CI step.
  assert.deepEqual(EMBEDDED_SKILLS, ['base', 'local', 'web']);
  for (const skill of EMBEDDED_SKILLS) {
    assert.ok(
      existsSync(join(repoRoot, 'docs', 'skills', `${skill}.md`)),
      `docs/skills/${skill}.md exists`,
    );
  }
});
