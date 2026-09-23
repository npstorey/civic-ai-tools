#!/usr/bin/env node
/**
 * check-verifier-subtype-set.mjs — zero-dependency check that the reference
 * verifier registers exactly the `attestation/*` sub-types the Typed Standards
 * Specification ratifies.
 *
 * WHY THIS EXISTS. The specification ratified `attestation/revises/v1` in
 * v0.1.4, and the reference verifier's registered set did not follow: through
 * `@typedstandards/verify-core` 0.10.0 it held fifteen `attestation/*` URIs, so
 * a conformant node of that sub-type read §9.2 check #12 as `unknown_type`
 * (civic-ai-tools#230; the verifier's side is npstorey/typedstandards#96).
 * `scripts/check-spec-subtype-table.mjs` keeps the specification's own
 * statements of the table agreeing with one another. This script compares the
 * specification with the verifier (civic-ai-tools#232).
 *
 * WHAT IS COMPARED. Both sides are read, not written down here:
 *
 *  (a) the specification's side is the §8.12.1 sub-type table, located and
 *      parsed by the reader check-spec-subtype-table.mjs exports (its
 *      `STATEMENTS` entry with id `table`), so the two checks cannot read the
 *      table differently;
 *  (b) the verifier's side is the `KNOWN_TYPE_URIS` export of the
 *      `@typedstandards/verify-core` that is INSTALLED, resolved from the
 *      package that declares it (`CONSUMER`, the harness, whose tests run
 *      against it). Resolving from there rather than from this script means a
 *      copy nested under another dependency is never the one read. The
 *      consumer must declare the package, so the check cannot pass on a copy
 *      that only arrived transitively.
 *
 * The `attestation/*` members of (b) must equal the rows of (a), with no
 * duplicate on either side. No sub-type is named in this file.
 *
 * WHAT IS NOT COMPARED, AND WHY. `content/*` members are not compared, nor is
 * any member outside the two families. §8.12.1 lists attestation sub-types only.
 * The specification's `content/*` sub-types are partly built
 * (`content/analysis/v1`) and partly reserved name-only (§7.4, the Q36
 * paragraph), and the verifier registers the built one alone, so set equality
 * is not the relation the specification states for that family. The members
 * not compared are printed, so they stay visible.
 *
 * IT NEVER SKIPS. An installed package that does not export `KNOWN_TYPE_URIS`
 * (every release before 0.11.0), a package that is not installed or cannot be
 * loaded, an export that is not a list of strings, a consumer that does not
 * declare the package, and a specification whose table cannot be found or read
 * all fail, naming what was found. A check that cannot read either side has
 * not passed.
 *
 * BLIND SPOTS, STATED. Order is not compared, only membership. The check reads
 * the one installed copy the consumer resolves; it says nothing about another
 * version a published consumer's own installs might resolve.
 *
 * Zero dependencies: Node built-ins only. Run via `npm run check:verifier-subtype-set`.
 * Self-test: `npm run check:verifier-subtype-set:self-test`.
 */

import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import process from 'node:process';
import { SPEC_PATH, STATEMENTS, readStatement, scanLines } from './check-spec-subtype-table.mjs';

/** The package whose registered set is compared. */
export const VERIFIER_PACKAGE = '@typedstandards/verify-core';

/** The export holding the registered set. */
export const EXPORT_NAME = 'KNOWN_TYPE_URIS';

/** The workspace that declares the verifier; resolution starts from its directory. */
export const CONSUMER = 'packages/civic-typed-harness';

/** The family compared. */
export const FAMILY = 'attestation/';

/** The §8.12.1 table's entry in the sibling check's statement list. */
const TABLE_SPEC = STATEMENTS.find((s) => s.id === 'table');

const where = (lines) =>
  lines.length === 1 ? `line ${lines[0]}` : `lines ${lines[0]}-${lines[lines.length - 1]}`;

const duplicatesOf = (keys) => [...new Set(keys.filter((k, i) => keys.indexOf(k) !== i))];

/**
 * The §8.12.1 table's URIs, read from the specification's text.
 * Returns { ok, lines, uris } or { ok: false, kind, message }.
 */
export function readSpecTable(source) {
  if (!TABLE_SPEC) {
    return {
      ok: false,
      kind: 'table-spec-missing',
      message: 'check-spec-subtype-table.mjs no longer lists a statement with id "table"',
    };
  }
  const got = readStatement(scanLines(source), TABLE_SPEC);
  if (!got.ok) return { ok: false, kind: got.kind, message: `${TABLE_SPEC.label}: ${got.message}` };
  return { ok: true, label: TABLE_SPEC.label, lines: got.lines, uris: got.entries.map((e) => e.uri) };
}

/**
 * The registered set, read from a loaded module namespace.
 * Returns { ok, all, uris, other } or { ok: false, kind, message }.
 */
export function readRegisteredSet(namespace, version) {
  const named = `${VERIFIER_PACKAGE} ${version ?? '(version unknown)'}`;
  if (!namespace || !Object.prototype.hasOwnProperty.call(namespace, EXPORT_NAME)) {
    return {
      ok: false,
      kind: 'no-export',
      message:
        `the installed ${named} does not export ${EXPORT_NAME}; the export exists from 0.11.0, ` +
        `so the range ${CONSUMER} declares must admit a release that has it`,
    };
  }
  const value = namespace[EXPORT_NAME];
  if (!Array.isArray(value) || value.some((u) => typeof u !== 'string')) {
    return { ok: false, kind: 'malformed', message: `${named}: ${EXPORT_NAME} is not a list of strings` };
  }
  return {
    ok: true,
    all: [...value],
    uris: value.filter((u) => u.startsWith(FAMILY)),
    other: value.filter((u) => !u.startsWith(FAMILY)),
  };
}

/**
 * Compare the specification's table with a registered set.
 * `namespace` is the loaded module (or a stand-in), `version` its version.
 * Returns { table, registered, violations }.
 */
export function checkVerifierSubtypeSet({ specSource, namespace, version }) {
  const violations = [];
  const table = readSpecTable(specSource);
  if (!table.ok) violations.push({ kind: table.kind, side: 'specification', message: table.message });
  const registered = readRegisteredSet(namespace, version);
  if (!registered.ok) violations.push({ kind: registered.kind, side: 'verifier', message: registered.message });
  if (!table.ok || !registered.ok) return { table, registered, violations };

  const tableWhere = `the ${table.label} (${where(table.lines)})`;
  const setName = `${VERIFIER_PACKAGE} ${version}'s ${EXPORT_NAME}`;

  for (const dup of duplicatesOf(table.uris)) {
    violations.push({ kind: 'duplicate', side: 'specification', subtype: dup, message: `${tableWhere} lists ${dup} more than once` });
  }
  for (const dup of duplicatesOf(registered.uris)) {
    violations.push({ kind: 'duplicate', side: 'verifier', subtype: dup, message: `${setName} lists ${dup} more than once` });
  }

  const mine = new Set(registered.uris);
  const theirs = new Set(table.uris);
  for (const uri of theirs) {
    if (!mine.has(uri)) {
      violations.push({ kind: 'missing', side: 'verifier', subtype: uri, message: `${setName} lacks ${uri}, which ${tableWhere} lists` });
    }
  }
  for (const uri of mine) {
    if (!theirs.has(uri)) {
      violations.push({ kind: 'extra', side: 'verifier', subtype: uri, message: `${setName} lists ${uri}, which ${tableWhere} does not` });
    }
  }
  return { table, registered, violations };
}

/**
 * Resolve and load the verifier the consumer would import.
 * Returns { ok, version, declared, path, namespace } or { ok: false, kind, message }.
 */
export async function loadInstalledVerifier(repoRoot, consumer = CONSUMER) {
  const manifestPath = join(resolve(repoRoot), consumer, 'package.json');
  let manifest;
  try {
    manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  } catch (err) {
    return { ok: false, kind: 'consumer-unreadable', message: `cannot read ${consumer}/package.json: ${err.message}` };
  }
  const declared = manifest.devDependencies?.[VERIFIER_PACKAGE] ?? manifest.dependencies?.[VERIFIER_PACKAGE];
  if (!declared) {
    return {
      ok: false,
      kind: 'not-declared',
      message: `${consumer}/package.json does not declare ${VERIFIER_PACKAGE}, so any installed copy arrived transitively and is not the one to compare`,
    };
  }
  const req = createRequire(manifestPath);
  let entry;
  let version;
  try {
    entry = req.resolve(VERIFIER_PACKAGE);
    version = JSON.parse(readFileSync(req.resolve(`${VERIFIER_PACKAGE}/package.json`), 'utf8')).version;
  } catch (err) {
    return {
      ok: false,
      kind: 'not-installed',
      declared,
      message: `${VERIFIER_PACKAGE} (declared ${declared} by ${consumer}) is not installed where ${consumer} resolves it — run npm ci: ${err.message.split('\n')[0]}`,
    };
  }
  let namespace;
  try {
    namespace = await import(pathToFileURL(entry).href);
  } catch (err) {
    return {
      ok: false,
      kind: 'unloadable',
      version,
      declared,
      message: `${VERIFIER_PACKAGE} ${version} is installed but cannot be loaded: ${err.message.split('\n')[0]}`,
    };
  }
  return { ok: true, version, declared, path: entry, namespace };
}

/** Run the check. Returns { relPath, installed, table, registered, violations, ok }. */
export async function runVerifierSubtypeSetCheck(repoRoot, { file = SPEC_PATH, consumer = CONSUMER } = {}) {
  const violations = [];
  let specSource = null;
  try {
    specSource = readFileSync(resolve(repoRoot, file), 'utf8');
  } catch (err) {
    violations.push({ kind: 'unreadable', side: 'specification', message: `cannot read ${file}: ${err.message}` });
  }
  const installed = await loadInstalledVerifier(repoRoot, consumer);
  if (!installed.ok) violations.push({ kind: installed.kind, side: 'verifier', message: installed.message });

  let table = null;
  let registered = null;
  if (specSource !== null && installed.ok) {
    const result = checkVerifierSubtypeSet({ specSource, namespace: installed.namespace, version: installed.version });
    ({ table, registered } = result);
    violations.push(...result.violations);
  } else if (specSource !== null) {
    // The verifier side failed to load; the specification side is still read, so both are reported.
    table = readSpecTable(specSource);
    if (!table.ok) violations.push({ kind: table.kind, side: 'specification', message: table.message });
  } else if (installed.ok) {
    // The specification is unreadable; the verifier side is still read, so both are reported.
    registered = readRegisteredSet(installed.namespace, installed.version);
    if (!registered.ok) violations.push({ kind: registered.kind, side: 'verifier', message: registered.message });
  }
  return { relPath: file, installed, table, registered, violations, ok: violations.length === 0 };
}

async function main() {
  const args = process.argv.slice(2);
  const scriptDir = dirname(fileURLToPath(import.meta.url));
  let repoRoot = resolve(scriptDir, '..');
  let file = SPEC_PATH;
  for (let i = 0; i < args.length; i += 1) {
    if (args[i] === '--root' && args[i + 1]) repoRoot = resolve(args[(i += 1)]);
    else if (args[i] === '--file' && args[i + 1]) file = args[(i += 1)];
    else {
      console.error('usage: check-verifier-subtype-set.mjs [--root <dir>] [--file <path>]');
      process.exit(2);
    }
  }

  const { relPath, installed, table, registered, violations, ok } = await runVerifierSubtypeSetCheck(repoRoot, { file });
  console.log(`${relPath}  ↔  ${VERIFIER_PACKAGE} (as ${CONSUMER} resolves it)`);
  if (table?.ok) console.log(`  ${table.label} (${where(table.lines)}) — ${table.uris.length} ${FAMILY}* URIs`);
  if (installed.ok) {
    const count = registered?.ok ? `${registered.uris.length} ${FAMILY}* URIs` : 'not read';
    console.log(`  ${VERIFIER_PACKAGE} ${installed.version} (declared ${installed.declared}), ${EXPORT_NAME} — ${count}`);
    if (registered?.ok && registered.other.length > 0) {
      console.log(`  not compared (outside ${FAMILY}*): ${registered.other.join(', ')}`);
    }
  }
  for (const v of violations) console.log(`  [${v.kind}] ${v.message}`);
  if (!ok) {
    console.error(
      `\nVerifier-subtype-set check FAILED. The ${FAMILY}* members of ${VERIFIER_PACKAGE}'s ` +
        `${EXPORT_NAME} must equal the specification's §8.12.1 sub-type table. ` +
        'See scripts/check-verifier-subtype-set.mjs for the rules.',
    );
    process.exit(1);
  }
  console.log('\nVerifier-subtype-set check passed.');
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  await main();
}
