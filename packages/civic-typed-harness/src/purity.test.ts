// Purity + module-boundary guard for civic-typed-harness (mirrors
// produce-core's browser-safety guard, adapted to the harness-grade contract
// of the S2 brief §2).
//
// Contract enforced here, mechanically, on every shipped source file:
//   1. Browser safety (whole package): no Node built-in imports, no Buffer.
//   2. No environment reads (whole package): configuration is caller-supplied.
//   3. Determinism (format-extension + rubric + index): no clock, no RNG.
//      Capture modules (src/capture/**) are the sanctioned exception — span
//      timestamps and ids are what capture *is* — and both are injectable.
//   4. Internal module boundary (structure-for-the-future):
//      - format-extension and rubric modules never import from capture;
//      - capture modules never DEFINE civic vocabulary (the `urn:` scheme in
//        EITHER era, the civic namespace in either era, and the datHere
//        profile string all live in format/);
//      - format-extension modules never WALK a trace.
// Test files are exempt: they legitimately use node:test / node:fs / node:crypto.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, relative } from 'node:path';

const SRC_DIR = dirname(fileURLToPath(import.meta.url));

function shippedSourceFiles(dir = SRC_DIR): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === '__fixtures__' || entry.name === 'node_modules') continue;
      out.push(...shippedSourceFiles(full));
    } else if (entry.name.endsWith('.ts') && !entry.name.endsWith('.test.ts')) {
      out.push(full);
    }
  }
  return out;
}

function rel(file: string): string {
  return relative(SRC_DIR, file);
}

// Specifiers a browser-safe module must never import. `Buffer` is a global,
// not an import, so it is checked separately below.
const FORBIDDEN_SPECIFIERS = [
  'node:crypto',
  'crypto',
  'node:fs',
  'fs',
  'node:fs/promises',
  'fs/promises',
  'node:path',
  'path',
  'node:process',
  'process',
  'node:os',
  'node:url',
  'node:util',
];

// Match the module specifier of any static/dynamic import or re-export.
const IMPORT_RE = /(?:import|export)\s[^'"`]*?from\s*['"]([^'"`]+)['"]|import\s*\(\s*['"]([^'"`]+)['"]\s*\)/g;

test('browser-safety: no shipped source imports a Node built-in', () => {
  const files = shippedSourceFiles();
  assert.ok(files.length > 5, 'expected to find the harness source files');

  for (const file of files) {
    const code = readFileSync(file, 'utf8');
    for (const m of code.matchAll(IMPORT_RE)) {
      const spec = m[1] ?? m[2] ?? '';
      assert.ok(
        !FORBIDDEN_SPECIFIERS.includes(spec) && !spec.startsWith('node:'),
        `${rel(file)} imports "${spec}" — the harness must stay browser-safe (use verify-core primitives and keep I/O caller-side).`,
      );
    }
  }
});

// Match actual Buffer *usage*, not the bare word (comments may mention it).
const BUFFER_USE_RE = /\bnew\s+Buffer\b|\bBuffer\s*[.(]/;

test('browser-safety: no shipped source uses the Buffer global', () => {
  for (const file of shippedSourceFiles()) {
    const code = readFileSync(file, 'utf8');
    assert.ok(
      !BUFFER_USE_RE.test(code),
      `${rel(file)} uses Buffer — use atob / btoa / Uint8Array / verify-core primitives instead.`,
    );
  }
});

test('no environment reads anywhere in shipped source', () => {
  const ENV_RE = /\bprocess\s*\.\s*env\b/;
  for (const file of shippedSourceFiles()) {
    const code = readFileSync(file, 'utf8');
    assert.ok(
      !ENV_RE.test(code),
      `${rel(file)} reads process.env — instance values are required typed config inputs; the reference values are exported for explicit use, never applied as defaults.`,
    );
  }
});

// Determinism guard for the NON-CAPTURE groups: format-extension, rubric, and
// the index must not read a clock or an RNG. Capture modules are exempt —
// clock/RNG are inherent to capture and injectable for tests.
const NONDETERMINISM_RE =
  /\bDate\.now\s*\(|\bnew\s+Date\s*\(|\bMath\.random\s*\(|\brandomUUID\s*\(|\bgetRandomValues\s*\(/;

test('determinism: no non-capture shipped source reads a clock or an RNG', () => {
  const nonCapture = shippedSourceFiles().filter(
    (f) => !rel(f).startsWith('capture/'),
  );
  assert.ok(nonCapture.length >= 5, 'expected the format/rubric/index files');
  for (const file of nonCapture) {
    const code = readFileSync(file, 'utf8');
    assert.ok(
      !NONDETERMINISM_RE.test(code),
      `${rel(file)} reads a clock/RNG — that is capture-only (src/capture/**), injectable for tests.`,
    );
  }
});

// --- Internal module boundary (S2 brief §2) ---

test('boundary: format-extension and rubric modules never import from capture', () => {
  const nonCapture = shippedSourceFiles().filter(
    (f) => rel(f).startsWith('format/') || rel(f).startsWith('rubric/'),
  );
  for (const file of nonCapture) {
    const code = readFileSync(file, 'utf8');
    for (const m of code.matchAll(IMPORT_RE)) {
      const spec = m[1] ?? m[2] ?? '';
      assert.ok(
        !/(^|\/)capture\//.test(spec),
        `${rel(file)} imports "${spec}" — the format-extension/rubric groups must not depend on capture (the future package split runs along this line).`,
      );
    }
  }
});

// --- Vocabulary literals: the universe is derived from both ends ---
//
// The rule is "capture modules never DEFINE civic vocabulary". Until Wave N11
// this test held a LIST of the seven literals it knew about, and a list is
// exactly the shape that cannot fail on the site it never named: two `civic:`
// term names were on it and fourteen others, spelled inline in
// capture/provenance.ts and declared nowhere, were invisible to it
// (civic-ai-tools#199 §2). Both legs below derive their universe instead —
// one from what the FORMAT group declares, one from what the CAPTURE group
// spells — so neither can be satisfied by editing this file.
//
// A third leg lives in capture/provenance.test.ts, because it needs a graph:
// every `civic:` key a DRIVEN build emits must be the value of a constant
// declared in format/vocabulary.ts, and every declared term must be emitted.
// Static text cannot state that one.

/**
 * Every string literal in a TypeScript source, with comments removed.
 *
 * Scanning literals rather than raw text is what lets the checks below name a
 * bare `civicaitools.org` — capture modules mention it in PROSE, and a
 * substring search over the file text would fail on the comment. The previous
 * list dodged that by listing `civicaitools.org/ns/civic` instead; deriving
 * the universe means the derivation has to be able to tell code from a
 * comment. Template literals are returned whole, `${...}` included.
 *
 * Exported so the test below can drive it over samples where the right answer
 * is written out — an extractor that quietly returned nothing would make
 * every check here pass.
 */
export function stringLiterals(source: string): string[] {
  const out: string[] = [];
  let i = 0;
  const n = source.length;
  while (i < n) {
    const c = source[i]!;
    const next = i + 1 < n ? source[i + 1] : '';
    if (c === '/' && next === '/') {
      while (i < n && source[i] !== '\n') i++;
      continue;
    }
    if (c === '/' && next === '*') {
      i += 2;
      while (i < n && !(source[i] === '*' && source[i + 1] === '/')) i++;
      i += 2;
      continue;
    }
    if (c === "'" || c === '"' || c === '`') {
      const quote = c;
      i++;
      let value = '';
      while (i < n && source[i] !== quote) {
        if (source[i] === '\\') {
          value += source[i + 1] ?? '';
          i += 2;
          continue;
        }
        value += source[i];
        i++;
      }
      i++;
      out.push(value);
      continue;
    }
    i++;
  }
  return out;
}

test('the literal extractor reads code and not comments (the check below is only as good as this)', () => {
  const sample = [
    "const a = 'kept';",
    '// const b = \'from-a-line-comment\';',
    '/* const c = \'from-a-block-comment\'; */',
    'const d = "with // a slash-slash inside";',
    'const e = `template ${x} literal`;',
    "const f = 'escaped \\' quote';",
  ].join('\n');
  assert.deepEqual(stringLiterals(sample), [
    'kept',
    'with // a slash-slash inside',
    'template ${x} literal',
    "escaped ' quote",
  ]);
  // And a real file: the extractor must actually find something in the module
  // the checks below scan, or "no offending literal" means "no literal read".
  const provenance = shippedSourceFiles().find((f) => rel(f) === 'capture/provenance.ts');
  assert.ok(provenance, 'capture/provenance.ts is expected in the shipped source');
  assert.ok(
    stringLiterals(readFileSync(provenance!, 'utf8')).includes('tool.duration_ms'),
    'the extractor reads capture/provenance.ts — a known literal from it must come back',
  );
});

/** Every top-level `export const NAME = '<string>'` of the FORMAT group, as
 *  declared-name → value. Derived by reading the group off disk: a term
 *  declared tomorrow is in this set the moment it is written, with no list to
 *  update. */
function formatGroupStringExports(): Map<string, string> {
  const out = new Map<string, string>();
  for (const file of shippedSourceFiles().filter((f) => rel(f).startsWith('format/'))) {
    const code = readFileSync(file, 'utf8');
    for (const m of code.matchAll(/^export const ([A-Z][A-Z0-9_]*) = '([^']*)';$/gm)) {
      out.set(m[1]!, m[2]!);
    }
  }
  return out;
}

test('boundary: capture modules spell no literal the format group declares as vocabulary', () => {
  // The universe: the format group's own string constants, filtered to the
  // ones that are VOCABULARY rather than configuration. The filter is a shape,
  // not a list — a namespace URI, a urn scheme, a `civic:` term and a compound
  // profile label all carry a `:`, `/` or `.`; `socrata` (the fallback source
  // id), `datHere` (the content-profile word) and `ai-assisted-analysis` (the
  // profile TYPE) do not, and are legitimately spoken elsewhere.
  //
  // BOTH ERAS are covered without saying so, because both are declared in
  // format/vocabulary.ts: after the 2026-08-19 settlement the prior-era terms
  // are still real, exported vocabulary — frozen inside signed records — so a
  // capture module could redefine either era and break the boundary the same
  // way.
  const vocabulary = [...formatGroupStringExports()].filter(([, value]) =>
    /[:/.]/.test(value),
  );
  assert.ok(
    vocabulary.length >= 7,
    `expected the format group to declare several vocabulary literals, found ${vocabulary.length}`,
  );
  for (const file of shippedSourceFiles().filter((f) => rel(f).startsWith('capture/'))) {
    const literals = stringLiterals(readFileSync(file, 'utf8'));
    for (const [name, value] of vocabulary) {
      for (const literal of literals) {
        assert.ok(
          !literal.includes(value),
          `${rel(file)} spells "${value}" (declared in the format group as ${name}) — capture modules import vocabulary from the format-extension group, never define it.`,
        );
      }
    }
  }
});

test('boundary: no capture module spells a `civic:` term at all, declared or not', () => {
  // The other end of the universe. The check above can only see terms the
  // format group already declares, so a term INVENTED inline — the exact
  // fourteen this rule was written for — would pass it. This one derives from
  // what capture spells: any `civic:` literal is a term, whether or not
  // anything declares it, and the only correct number of them in capture/ is
  // zero.
  const offenders: string[] = [];
  for (const file of shippedSourceFiles().filter((f) => rel(f).startsWith('capture/'))) {
    for (const literal of stringLiterals(readFileSync(file, 'utf8'))) {
      if (/civic:[A-Za-z]/.test(literal)) offenders.push(`${rel(file)}: "${literal}"`);
    }
  }
  assert.deepEqual(
    offenders,
    [],
    `a \`civic:\` property name is vocabulary as much as the namespace it hangs under: declare it in format/vocabulary.ts and import it. Spelled inline: ${offenders.join(', ')}`,
  );
});

test('boundary: format-extension modules never walk a trace', () => {
  const TRACE_WALK_LITERALS = ['resourceSpans', 'scopeSpans', 'mcp_tool_call', 'skill_fetch'];
  for (const file of shippedSourceFiles().filter((f) => rel(f).startsWith('format/'))) {
    const code = readFileSync(file, 'utf8');
    for (const literal of TRACE_WALK_LITERALS) {
      assert.ok(
        !code.includes(literal),
        `${rel(file)} references "${literal}" — trace walking is capture-group work; format-extension modules carry vocabulary and policy only.`,
      );
    }
  }
});
