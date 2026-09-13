// THROWAWAY — Wave N11 (#434) P-H2's reds on a runner. Not for merge.
//
// Four items, each with premises so a green cannot come from an inert scan.
// Everything here reads the repository rather than rendering or publishing.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const PKG = path.dirname(path.dirname(fileURLToPath(import.meta.url))); // packages/civic-typed-harness
const SRC = path.join(PKG, 'src');

function read(p: string): string {
  return readFileSync(p, 'utf8');
}
function walk(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const full = path.join(dir, e.name);
    return e.isDirectory() ? walk(full) : [full];
  });
}
const ALL_TS = walk(SRC).filter((f) => f.endsWith('.ts'));
const TEST_TS = ALL_TS.filter((f) => f.endsWith('.test.ts'));

// ===========================================================================
// #197 — the test files never type-check, and no gate can see it
// ===========================================================================

test('#197 PREMISE: there are test files to type-check, and a tsconfig that excludes them', () => {
  assert.ok(TEST_TS.length >= 5, `expected several test files, found ${TEST_TS.length}`);
  const tsconfig = read(path.join(PKG, 'tsconfig.json'));
  assert.match(tsconfig, /src\/\*\*\/\*\.test\.ts/, 'the exclude list names the test glob');
});

test('#197 RED: the type-check universe covers the test files', () => {
  // Either the main tsconfig stops excluding them, or a second tsconfig
  // includes them and a script runs it. Neither exists at base.
  const tsconfig = JSON.parse(
    read(path.join(PKG, 'tsconfig.json')).replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, ''),
  ) as { exclude?: string[] };
  const excludesTests = (tsconfig.exclude ?? []).some((g) => g.includes('.test.ts'));

  const siblingConfigs = readdirSync(PKG)
    .filter((f) => /^tsconfig\..*json$/.test(f) && f !== 'tsconfig.json');
  const aTestConfigExists = siblingConfigs.some((f) => {
    const c = read(path.join(PKG, f));
    return c.includes('.test.ts') && !/"exclude"[\s\S]*\.test\.ts/.test(c);
  });

  assert.ok(
    !excludesTests || aTestConfigExists,
    `tsconfig.json excludes ${TEST_TS.length} test files from the type-check and no sibling ` +
      `config includes them (siblings found: ${siblingConfigs.join(', ') || 'none'}). ` +
      'Measured at this base: a `const x: number = "s"` in a harness test file passes ' +
      '`npm run typecheck` (exit 0), `npm test` (# pass 162 / # fail 0) AND `npm run lint`. ' +
      'All three hub gates are blind to it.',
  );
});

test('#197 RED: AGENTS.md does not hand-pin the pass count', () => {
  const agents = read(path.join(PKG, '..', '..', 'AGENTS.md'));
  const pinned = agents.match(/#\s*pass\s+(\d+)`?\s*\/\s*`?#\s*fail\s+0/);
  assert.equal(
    pinned,
    null,
    `AGENTS.md pins \`# pass ${pinned?.[1]}\`, a number every phase that adds a test invalidates. ` +
      'Wave N11 P-H1 already moved it once (125 → 162) and found it had been stale by 25. ' +
      'The website guards its equivalent row by deriving it; this one is a hand list of one number.',
  );
});

// ===========================================================================
// #199 §1 — the byte-compat suite cannot fail on a span change
// ===========================================================================

interface SpanLike { name?: string; attributes?: { key: string }[] }
function spansIn(json: unknown): SpanLike[] {
  const out: SpanLike[] = [];
  const visit = (o: unknown): void => {
    if (Array.isArray(o)) { o.forEach(visit); return; }
    if (o && typeof o === 'object') {
      const r = o as Record<string, unknown>;
      if (Array.isArray(r.attributes) && typeof r.name === 'string') out.push(r as SpanLike);
      Object.values(r).forEach(visit);
    }
  };
  visit(json);
  return out;
}

const REFERENCE = JSON.parse(read(path.join(SRC, '__fixtures__', 'reference-golden.json')));
const WEBSITE = JSON.parse(read(path.join(SRC, '__fixtures__', 'website-golden.json')));

test('#199 §1 PREMISE: website-golden DOES carry spans, so a spanless fixture is a choice not a limit', () => {
  const s = spansIn(WEBSITE);
  assert.ok(s.length > 0, 'website-golden.json carries spans');
  assert.ok(
    s.filter((x) => x.name === 'mcp_tool_call').length >= 1,
    'including mcp_tool_call spans — the shape reference-golden lacks',
  );
});

test('#199 §1 RED: the golden-reproduction fixture exercises tool spans', () => {
  const s = spansIn(REFERENCE);
  assert.ok(
    s.length > 0,
    'reference-golden.json carries ZERO spans of any kind, so its eight golden-reproduction ' +
      'cases are green for anything the tool-span loop does — including every marker Wave N10 ' +
      'and N11 added. Their green is not evidence about the graph builder, which is what the ' +
      '0.4.0 release note already had to say in prose.',
  );
});

// ===========================================================================
// #199 §2 — the civic: vocabulary is spelled, not named
// ===========================================================================

const TERM = /['"]civic:[A-Za-z]+['"]/g;
const CAPTURE = ALL_TS.filter(
  (f) => f.includes(`${path.sep}capture${path.sep}`) && !f.endsWith('.test.ts') && !f.endsWith('.assert.ts'),
);
const VOCAB = read(path.join(SRC, 'format', 'vocabulary.ts'));

test('#199 §2 PREMISE: the vocabulary module declares terms, and the capture layer imports some', () => {
  const declared = new Set(VOCAB.match(TERM) ?? []);
  assert.ok(declared.size >= 2, `vocabulary.ts declares ${declared.size} civic: terms`);
  const provenance = read(CAPTURE.find((f) => f.endsWith('provenance.ts'))!);
  assert.match(provenance, /CIVIC_TERM_FAILED/, 'and provenance.ts imports at least one by name');
});

test('#199 §2 RED: every civic: term the capture layer emits is named, not spelled', () => {
  const declared = new Set([...VOCAB.matchAll(TERM)].map((m) => m[0].slice(1, -1)));
  const inline = new Map<string, string>();
  for (const f of CAPTURE) {
    for (const m of read(f).matchAll(TERM)) {
      const term = m[0].slice(1, -1);
      if (!declared.has(term)) inline.set(term, path.basename(f));
    }
  }
  assert.deepEqual(
    [...inline.keys()].sort(), [],
    `spelled inline and declared nowhere: ${[...inline.entries()].map(([t, f]) => `${t} (${f})`).join(', ')}. ` +
      'A `civic:` property name is vocabulary as much as the namespace it hangs under — the ' +
      "0.4.0 note says so, for the two terms that ARE named. These are the rest.",
  );
});

// ===========================================================================
// The third item (folded in by the seat at G25) — two claims P4 falsified
// ===========================================================================

test('THIRD ITEM PREMISE: the harness reads tool.duration_ms and emits civic:durationMs', () => {
  const p = read(path.join(SRC, 'capture', 'provenance.ts'));
  assert.match(p, /getAttr\(span\.attributes, 'tool\.duration_ms'\)/, 'it reads the attribute');
  assert.match(p, /civic:durationMs/, 'and emits the term');
});

test('THIRD ITEM RED: no comment claims the reference producer omits a rejected span\'s duration', () => {
  const offenders: string[] = [];
  for (const f of ALL_TS) {
    const text = read(f);
    text.split('\n').forEach((line, i) => {
      if (/rejected span carries no `?tool\.duration_ms|does not write it onto the span/.test(line)) {
        offenders.push(`${path.relative(PKG, f)}:${i + 1}`);
      }
    });
  }
  assert.deepEqual(
    offenders, [],
    'these say a rejected span carries no `tool.duration_ms` "from the reference producer today ' +
      '(civic-ai-tools-website#413)". #413 shipped in the website\'s Wave N11 P4 (merged ' +
      '`ec7f173`), so both sentences are now false, and both cite the issue by number as their ' +
      `reason: ${offenders.join(', ')}`,
  );
});

test('THIRD ITEM RED: the driving fixture\'s REJECTED span carries a duration', () => {
  // Read the rejected span's OWN object literal, not the function around it.
  // A first version of this scan split on `const`/`function` and matched the
  // ANSWERED span's `tool.duration_ms` against the REJECTED span's `error`
  // flag inside one helper — it reported a driver where none exists. Same
  // span or nothing.
  const provTest = read(path.join(SRC, 'capture', 'provenance.test.ts'));
  const start = provTest.indexOf('const rejected: SpanStub = {');
  assert.notEqual(start, -1, 'PREMISE: the driving fixture builds a named `rejected` span');
  const literal = provTest.slice(start, provTest.indexOf('\n  };', start));
  assert.match(literal, /error/, 'PREMISE: and that span asserts the rejection');
  assert.ok(
    literal.includes('tool.duration_ms'),
    'the harness\'s own driving fixture builds a rejected span WITHOUT a duration, and its ' +
      'docstring says so, citing civic-ai-tools-website#413 as "out of scope for this phase". ' +
      'Since #413 shipped, that is the shape the reference producer no longer emits. ' +
      'reference-golden.json carries zero spans and website-golden.json nine, one with a ' +
      'duration and none with `error` — so `civic:durationMs` beside `civic:failed`, which the ' +
      'website now writes into a SIGNED graph, is exercised nowhere in this package.',
  );
});
