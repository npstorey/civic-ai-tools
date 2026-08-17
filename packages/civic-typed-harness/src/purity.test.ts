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
//      - capture modules never DEFINE civic vocabulary (the `urn:` scheme,
//        the civic namespace, the datHere profile string live in format/);
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

test('boundary: capture modules define no civic vocabulary (terms live in format/)', () => {
  const VOCAB_LITERALS = [
    'urn:civic-evidence', // the id scheme
    'civicaitools.org/ns/evidence', // the civic: namespace
    'ai-assisted-analysis/datHere', // the datHere producer profile
  ];
  for (const file of shippedSourceFiles().filter((f) => rel(f).startsWith('capture/'))) {
    const code = readFileSync(file, 'utf8');
    for (const literal of VOCAB_LITERALS) {
      assert.ok(
        !code.includes(literal),
        `${rel(file)} contains the vocabulary literal "${literal}" — capture modules import vocabulary from the format-extension group, never define it.`,
      );
    }
  }
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
