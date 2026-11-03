// The committed source files the inventories are built from, each read
// through its recorded hash: a source that changed stops the build.
//
//   sources/socrata.json, sources/ckan.json   the website's two portal
//       directories, whole files, byte for byte (no row filtered; the rules in
//       build.mjs pick the rows)
//   sources/registry-entries.json             the MCP Registry entries used
//       (extract.mjs, from the owner's fetch)
//   sources/r5-servers.json                   R5's four servers outside the
//       seven (extract.mjs, from the owner's copy of R5)
//   sources/g06-registry-fetch.py, sources/fetch-log.tsv
//       the registry fetch's script and its log, byte for byte (read by no
//       code; their hashes are in registry-entries.json and the README)

import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');

/** Where the two portal directories were copied from. */
export const WEBSITE_SOURCE = Object.freeze({
  repository: 'npstorey/civic-ai-tools-website',
  commit: '85590020eae4ab72795afd7e8e6cd81589e8ac23',
  lastChangedAt: 'b69c65a3d165afd4d5f4b0af60f134b40cd16feb',
  fields: 'src/lib/mcp/portal-data.ts:7-20 (PortalEntry)',
});

/** The two catalogs: the website path each was copied from and its sha256. */
export const CATALOGS = Object.freeze({
  socrata: { path: 'sources/socrata.json', from: 'data/portals/socrata.json', sha256: '97f6131d3a434e643cb24d9038864a72cacf8ff44961894c3dffe0d5ac2397e9' },
  ckan: { path: 'sources/ckan.json', from: 'data/portals/ckan.json', sha256: '7590d64fd0ae794fc2d489c6333ff519c002c60a442faa2b571828ba47f54580' },
});

/** The extracts, by their file's sha256: the inventories' hashes rest on these
 *  bytes, so a re-extraction that moves them moves this line too. */
export const EXTRACTS = Object.freeze({
  registry: { path: 'sources/registry-entries.json', sha256: '89a919e6c662f5c3052f5bc74a1dc3cd38f8ee6c8f336ba94346417d49f9b2c1' },
  r5: { path: 'sources/r5-servers.json', sha256: '26526aa977681040b049606f3f45ffc14e535427be76395b9a0b17263544125d' },
});

function readChecked(path, expected) {
  const bytes = readFileSync(new URL(path, import.meta.url));
  const actual = sha256(bytes);
  if (actual !== expected) throw new Error(`sources: ${path} has sha256 ${actual}, not the recorded ${expected}`);
  return { json: JSON.parse(bytes.toString('utf8')), sha256: actual };
}

/** A catalog's rows, after its hash is checked. */
export const readCatalog = (name) => readChecked(CATALOGS[name].path, CATALOGS[name].sha256).json;

/** The registry extract, after its hash is checked, with its sha256. */
export const readRegistryExtract = () => readChecked(EXTRACTS.registry.path, EXTRACTS.registry.sha256);

/** The R5 extract, after its hash is checked, with its sha256. */
export const readR5Extract = () => readChecked(EXTRACTS.r5.path, EXTRACTS.r5.sha256);
