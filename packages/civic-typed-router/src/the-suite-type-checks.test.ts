// Guard: every test file in this package is inside the type-check universe,
// and none of them is inside the config that EMITS. Copied from
// civic-typed-harness's guard of the same name (civic-ai-tools#197), where a
// type error in a test file was measured passing the test, typecheck and lint
// steps alike. The universe is derived at both ends: test files by walking
// `src/`, configs by parsing the `typecheck` script's own `-p` arguments
// through TypeScript's config parser.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, relative, resolve } from 'node:path';
import ts from 'typescript';

const PACKAGE_DIR = dirname(dirname(fileURLToPath(import.meta.url)));
const SRC_DIR = join(PACKAGE_DIR, 'src');

function testFilesOnDisk(dir = SRC_DIR): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules') continue;
      out.push(...testFilesOnDisk(full));
    } else if (entry.name.endsWith('.test.ts')) {
      out.push(resolve(full));
    }
  }
  return out;
}

/** The tsconfigs the package's own `typecheck` script points `tsc` at —
 *  parsed out of the script text, so the guard cannot drift from the command
 *  CI actually runs. */
function typecheckConfigs(): string[] {
  const manifest = JSON.parse(readFileSync(join(PACKAGE_DIR, 'package.json'), 'utf8')) as {
    scripts?: Record<string, string>;
  };
  const script = manifest.scripts?.typecheck;
  assert.ok(script, 'the package declares a `typecheck` script');
  return [...script!.matchAll(/-p\s+(\S+)/g)].map((m) => resolve(PACKAGE_DIR, m[1]!));
}

/** The file set and options `tsc -p <config>` would use, from TypeScript's own
 *  parser. */
function parseConfig(configPath: string): ts.ParsedCommandLine {
  const host: ts.ParseConfigFileHost = {
    ...ts.sys,
    onUnRecoverableConfigFileDiagnostic: (d) => {
      assert.fail(`${configPath}: ${ts.flattenDiagnosticMessageText(d.messageText, ' ')}`);
    },
  };
  const parsed = ts.getParsedCommandLineOfConfigFile(configPath, {}, host);
  assert.ok(parsed, `${configPath} could not be parsed`);
  return parsed!;
}

const rel = (file: string): string => relative(PACKAGE_DIR, file);

test('#197 PREMISE: there are test files, and the typecheck script names at least one config', () => {
  const files = testFilesOnDisk();
  assert.ok(files.length >= 5, `expected several test files, found ${files.length}`);
  const configs = typecheckConfigs();
  assert.ok(configs.length >= 1, 'the typecheck script points tsc at no config at all');
});

test('#197: every test file on disk is type-checked by a config the typecheck script runs', () => {
  const covered = new Set<string>();
  for (const config of typecheckConfigs()) {
    for (const file of parseConfig(config).fileNames) covered.add(resolve(file));
  }
  const uncovered = testFilesOnDisk().filter((f) => !covered.has(f)).map(rel);
  assert.deepEqual(
    uncovered,
    [],
    `type-checked by nothing the \`typecheck\` script runs: ${uncovered.join(', ')}. ` +
      'A test file outside the type-check universe is a file where a type error passes ' +
      '`npm test`, `npm run typecheck` and `npm run lint` alike — measured at civic-ai-tools#197.',
  );
});

test('#197: no test file is inside a config that EMITS — the published dist stays the shipped source', () => {
  // The reason for the second config rather than dropping the exclude. This
  // fails if someone folds the test files into the build config, which would
  // put every test file and its `.d.ts` into the published tarball.
  const emitting = typecheckConfigs().filter((c) => !parseConfig(c).options.noEmit);
  assert.ok(
    emitting.length >= 1,
    'no config the typecheck script runs emits — this guard would then be vacuous, and the build config is missing from it',
  );
  for (const config of emitting) {
    const tests = parseConfig(config).fileNames.filter((f) => f.endsWith('.test.ts')).map(rel);
    assert.deepEqual(
      tests,
      [],
      `${rel(config)} emits and carries test files: ${tests.join(', ')} — \`files: ["dist"]\` would publish them.`,
    );
  }
});
