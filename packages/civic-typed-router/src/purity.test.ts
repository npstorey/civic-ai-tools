// Purity guard for civic-typed-router, adapted from civic-typed-harness's.
//
// Enforced on every shipped source file (`src/**/*.ts`, test files and
// `src/__fixtures__/` excepted):
//   1. Browser safety: no Node built-in import, no Buffer.
//   2. No environment read: the consumer hands `readMcpEnv` a plain object.
//   3. Determinism, everywhere: no clock, no RNG. The router has no capture
//      group, so the harness's one exception does not apply; the consumer
//      supplies `today`.
//   4. No network and no logging: no `fetch`, no `console`. The consumer
//      supplies the fetchers and reports a skipped source if it wants to.
// And over the whole package:
//   5. No `openai` import anywhere, test files and fixtures included, and no
//      `openai` in the manifest: the tool-schema type is structural.
//   6. No runtime dependency at all.
//
// `src/__fixtures__/capture-app-goldens.mjs` is a Node program that reads its
// own environment by design; it is not shipped, and only rule 5 reads it.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, relative } from 'node:path';

const SRC_DIR = dirname(fileURLToPath(import.meta.url));
const PACKAGE_DIR = dirname(SRC_DIR);

function walk(dir: string, skipFixtures: boolean): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || (skipFixtures && entry.name === '__fixtures__')) continue;
      out.push(...walk(full, skipFixtures));
    } else {
      out.push(full);
    }
  }
  return out;
}

function shippedSourceFiles(): string[] {
  return walk(SRC_DIR, true).filter((f) => f.endsWith('.ts') && !f.endsWith('.test.ts'));
}

const rel = (file: string): string => relative(SRC_DIR, file);

const IMPORT_RE =
  /(?:import|export)\s[^'"`]*?from\s*['"]([^'"`]+)['"]|import\s*\(\s*['"]([^'"`]+)['"]\s*\)|import\s+['"]([^'"`]+)['"]/g;

const NODE_BUILTINS = ['crypto', 'fs', 'fs/promises', 'path', 'process', 'os', 'url', 'util', 'child_process', 'module'];

test('purity: the shipped source universe is core, civic and the entry', () => {
  const files = shippedSourceFiles().map(rel).sort();
  assert.ok(files.includes('index.ts'), 'src/index.ts is shipped');
  assert.ok(files.some((f) => f.startsWith('core/')), 'core modules are scanned');
  assert.ok(files.some((f) => f.startsWith('civic/')), 'civic modules are scanned');
  assert.ok(!files.some((f) => f.startsWith('__fixtures__')), 'the fixtures are not shipped source');
});

test('purity: no shipped source imports a Node built-in', () => {
  for (const file of shippedSourceFiles()) {
    for (const m of readFileSync(file, 'utf8').matchAll(IMPORT_RE)) {
      const spec = m[1] ?? m[2] ?? m[3] ?? '';
      assert.ok(
        !spec.startsWith('node:') && !NODE_BUILTINS.includes(spec),
        `${rel(file)} imports "${spec}" — the router is browser-safe and I/O-free.`,
      );
    }
  }
});

test('purity: no shipped source uses Buffer', () => {
  for (const file of shippedSourceFiles()) {
    assert.ok(!/\bnew\s+Buffer\b|\bBuffer\s*[.(]/.test(readFileSync(file, 'utf8')), `${rel(file)} uses Buffer.`);
  }
});

test('purity: no shipped source reads the environment', () => {
  const ENV_RE = /\bprocess\s*\.\s*env\b|\bprocess\s*\[|\bimport\.meta\.env\b|\bDeno\s*\.\s*env\b/;
  const files = shippedSourceFiles();
  assert.ok(files.length >= 10);
  for (const file of files) {
    assert.ok(
      !ENV_RE.test(readFileSync(file, 'utf8')),
      `${rel(file)} reads the environment — the consumer passes its configuration to readMcpEnv.`,
    );
  }
});

test('purity: no shipped source reads a clock or an RNG', () => {
  const NONDETERMINISM_RE =
    /\bDate\.now\s*\(|\bnew\s+Date\s*\(|\bDate\s*\(|\bperformance\.now\s*\(|\bMath\.random\s*\(|\brandomUUID\s*\(|\bgetRandomValues\s*\(/;
  for (const file of shippedSourceFiles()) {
    assert.ok(
      !NONDETERMINISM_RE.test(readFileSync(file, 'utf8')),
      `${rel(file)} reads a clock or an RNG — the consumer supplies \`today\`.`,
    );
  }
});

test('purity: no shipped source calls the network or logs', () => {
  const IO_RE = /(?<![\w.'"`])fetch\s*\(|\bXMLHttpRequest\b|\bnew\s+WebSocket\b|\bconsole\s*\./;
  for (const file of shippedSourceFiles()) {
    assert.ok(
      !IO_RE.test(readFileSync(file, 'utf8')),
      `${rel(file)} calls the network or logs — the consumer supplies the fetchers.`,
    );
  }
});

test('purity: nothing in the package imports openai, and the manifest does not name it', () => {
  const OPENAI_RE = /\bfrom\s*['"]openai(?:\/[^'"]*)?['"]|\bimport\s*\(\s*['"]openai(?:\/[^'"]*)?['"]\s*\)|\brequire\s*\(\s*['"]openai/;
  const files = walk(SRC_DIR, false).filter((f) => /\.(?:[cm]?[jt]s)$/.test(f));
  assert.ok(files.some((f) => f.endsWith('capture-app-goldens.mjs')), 'the fixture script is in this scan');
  for (const file of files) {
    assert.ok(!OPENAI_RE.test(readFileSync(file, 'utf8')), `${rel(file)} imports openai.`);
  }
  const manifest = JSON.parse(readFileSync(join(PACKAGE_DIR, 'package.json'), 'utf8'));
  for (const field of ['dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies']) {
    assert.ok(!Object.hasOwn(manifest[field] ?? {}, 'openai'), `package.json ${field} names openai.`);
  }
});

test('purity: the package declares no runtime dependency', () => {
  const manifest = JSON.parse(readFileSync(join(PACKAGE_DIR, 'package.json'), 'utf8'));
  assert.deepEqual(Object.keys(manifest.dependencies ?? {}), []);
  assert.deepEqual(Object.keys(manifest.peerDependencies ?? {}), []);
});
