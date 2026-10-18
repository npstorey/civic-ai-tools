// What the reference website derives from a hosted source's hosting value,
// derived again from 0.4.0's NYC Charter `sandbox` variant and held equal to
// what it derived from 0.3.0's `hosting` field.
//
// Each derivation is written inline, as the website writes it at 662099b,
// with the website's file and line beside it. Five of the values reach a
// signed record (the `catalogType`, the purl in `mcpServers` and in
// `aggregatePortalUrl`, the component version); the rest configure the
// sandbox the source runs in or the notebook's text. When the website moves
// from `entry.hosting` to the variant in force (its selector, R6 W2), each
// expression below reads the same strings, so no byte moves.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { CIVIC_MANIFEST } from './index.ts';

/** 0.3.0's `NYC_CHARTER_HOSTING`, as router 0.3.0 shipped it (hub 51eb833,
 *  `src/civic/nyc-charter.ts:167-173`). */
const HOSTING_0_3_0 = Object.freeze({
  kind: 'npm-package',
  package: '@betanyc/nyc-charter-laws-rules',
  version: '0.3.1',
  commit: 'b784cb763ec0d953139eef4ed366e8ec4de72625',
  outbound: Object.freeze([] as string[]),
});

interface HostedValue {
  kind: string;
  package: string;
  version: string;
  commit: string;
  outbound: readonly string[];
}

/** NYC Charter's entry. */
function charter() {
  const found = CIVIC_MANIFEST.find((entry) => entry.sourceId === 'nyc-charter');
  assert.ok(found, 'the civic manifest holds a nyc-charter entry');
  return found;
}

/** The variant the website will select while `NYC_CHARTER_HOSTING=sandbox`:
 *  the entry's variant named `sandbox`. */
function sandboxVariant(): HostedValue {
  const hostings = (charter() as unknown as { hostings?: readonly (HostedValue & { variant?: string })[] }).hostings ?? [];
  const found = hostings.find((variant) => variant.variant === 'sandbox');
  assert.ok(found, 'the nyc-charter entry carries a variant named sandbox');
  assert.equal(found.kind, 'npm-package', 'the sandbox variant is an npm package');
  return found;
}

/** Every value the website derives from a hosting value, by the website's own
 *  expressions at 662099b. */
function derive(hosting: HostedValue, alias: string) {
  return {
    // src/lib/evidence/data-sources.ts:85 — the signed `catalogType`.
    catalogType: hosting.kind,
    // src/lib/mcp/registry.ts:383-385 (`hostedServerPurl`), read at
    // registry.ts:410 (the signed `mcpServers` url) and at
    // src/lib/evidence/data-sources.ts:86 (`aggregatePortalUrl` with no run
    // record).
    purl: `pkg:npm/${hosting.package.split('/').map(encodeURIComponent).join('/')}@${encodeURIComponent(hosting.version)}`,
    // src/lib/mcp/socrata-skill.ts:346-348 (`hostedComponentVersion`), written
    // at socrata-skill.ts:482 as the signed `components[].version`.
    componentVersion: `${hosting.version}+${hosting.commit.slice(0, 12)}`,
    // src/lib/mcp/hosting/install-manifests.ts:30-32 (`pinLockfileKey`).
    pinKey: `${hosting.package}@${hosting.version}`,
    // src/lib/mcp/hosting/install-manifests.ts:25-27 (`pinPackageJson`).
    pinPackageJson: JSON.stringify(
      { name: 'civic-source-pin', private: true, dependencies: { [hosting.package]: hosting.version } },
      null,
      2,
    ),
    // src/lib/mcp/hosting/lifecycle.ts:303 — the bridge's configuration
    // inputs.
    bridgeConfigInputs: { package: hosting.package, version: hosting.version },
    // src/lib/mcp/hosting/lifecycle.ts:312 — the sandbox's network policy.
    networkPolicy: hosting.outbound.length > 0 ? { allow: [...hosting.outbound] } : 'deny-all',
    // src/lib/mcp/hosting/lifecycle.ts:313 — the installed marker.
    installedMarker: JSON.stringify({ package: hosting.package, version: hosting.version, commit: hosting.commit }),
    // src/lib/mcp/hosting/lifecycle.ts:429 — `hostedSandboxName`'s inputs.
    sandboxNameInputs: [alias, hosting.version],
    // src/lib/notebook-author/tool-to-cell.ts:997 — the notebook's text.
    notebookPackage: `\`${hosting.package}@${hosting.version}\``,
  };
}

test('hosted variant: every value the website derives from 0.4.0\'s sandbox variant equals what it derived from 0.3.0\'s hosting', () => {
  const alias = charter().alias;
  const variant = sandboxVariant();
  assert.deepEqual(derive(variant, alias), derive(HOSTING_0_3_0, alias));
});

test('hosted variant: the derived values, stated', () => {
  const variant = sandboxVariant();
  const derived = derive(variant, charter().alias);
  assert.equal(derived.catalogType, 'npm-package');
  assert.equal(derived.purl, 'pkg:npm/%40betanyc/nyc-charter-laws-rules@0.3.1');
  assert.equal(derived.componentVersion, '0.3.1+b784cb763ec0');
  assert.equal(derived.pinKey, '@betanyc/nyc-charter-laws-rules@0.3.1');
  assert.deepEqual(JSON.parse(derived.pinPackageJson), {
    name: 'civic-source-pin',
    private: true,
    dependencies: { '@betanyc/nyc-charter-laws-rules': '0.3.1' },
  });
  assert.deepEqual(derived.bridgeConfigInputs, { package: '@betanyc/nyc-charter-laws-rules', version: '0.3.1' });
  assert.deepEqual(variant.outbound, []);
  assert.equal(derived.networkPolicy, 'deny-all');
  assert.deepEqual(JSON.parse(derived.installedMarker), {
    package: '@betanyc/nyc-charter-laws-rules',
    version: '0.3.1',
    commit: 'b784cb763ec0d953139eef4ed366e8ec4de72625',
  });
  assert.deepEqual(derived.sandboxNameInputs, ['nyc_charter', '0.3.1']);
  assert.equal(derived.notebookPackage, '`@betanyc/nyc-charter-laws-rules@0.3.1`');
});
