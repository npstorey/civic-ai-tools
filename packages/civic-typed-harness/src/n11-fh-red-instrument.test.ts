// THROWAWAY — Wave N11 F-H's red instrument (civic-ai-tools-website#434, G41 D2). Never merged.
// Run by CI's `npm test` because it sits under the harness's src/.
//
// Every universe is derived: the templates are the tracked files that launch the Socrata MCP
// server; the names the server reads are the `process.env` reads in its non-test source at
// `main`, fetched raw the way the skill-drift step fetches server files, failing on any fetch
// failure. Names read by Node itself or by the proxy wrapper are allowed by reason.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const SERVER = 'npstorey/socrata-mcp-server';

/** Read by the Node runtime or by global-agent (scripts/proxy-wrapper.js), not by the server's source. */
const RUNTIME_READS: ReadonlyArray<readonly [RegExp, string]> = [
  [/^NODE_TLS_REJECT_UNAUTHORIZED$/, 'read by Node itself'],
  [/^GLOBAL_AGENT_[A-Z_]+$/, 'read by global-agent, which scripts/proxy-wrapper.js bootstraps'],
];

function templates(): string[] {
  const files = execFileSync('git', ['ls-files', '-z'], { cwd: ROOT, encoding: 'utf8' }).split('\0').filter(Boolean);
  return files.filter((f) => {
    if (/\.test\.[cm]?[jt]s$/.test(f) || f.startsWith('packages/')) return false;
    let text = '';
    try { text = readFileSync(join(ROOT, f), 'utf8'); } catch { return false; }
    // A file that launches the server AND sets its environment. A launch mention with no env
    // block (a doc, an example script, the proxy wrapper itself) configures nothing to check.
    return /socrata-mcp-server\/(?:dist\/index\.js|proxy-wrapper\.js)/.test(text) && /"env"|\.env\]/.test(text);
  });
}

/** The env names a template sets for the socrata server block. Throws on a shape it cannot read. */
function socrataEnvNames(file: string): string[] {
  const text = readFileSync(join(ROOT, file), 'utf8');
  if (file.endsWith('.toml.example')) {
    const m = /\[mcp_servers\.socrata\.env\]\n([\s\S]*?)(?:\n\[|$)/.exec(text);
    assert.ok(m, `${file}: no [mcp_servers.socrata.env] section`);
    return [...m[1].matchAll(/^([A-Z][A-Z0-9_]+)\s*=/gm)].map((x) => x[1]);
  }
  if (file.endsWith('.sh')) {
    const blocks = [...text.matchAll(/"socrata": \{'([\s\S]*?)echo -n '\s*\}'/g)].map((x) => x[1]);
    assert.ok(blocks.length > 0, `${file}: no socrata block`);
    return [...new Set(blocks.flatMap((b) => [...b.matchAll(/\\?"([A-Z][A-Z0-9_]+)\\?":/g)].map((x) => x[1])))];
  }
  const json = JSON.parse(text.replace(/^\s*\/\/.*$/gm, ''));
  const servers = json.mcpServers ?? json.servers;
  assert.ok(servers?.socrata, `${file}: no socrata server entry`);
  return Object.keys(servers.socrata.env ?? {});
}

async function get(url: string): Promise<string> {
  const res = await fetch(url, { headers: { 'user-agent': 'n11-fh-red-instrument' } });
  assert.equal(res.status, 200, `fetch failed (${res.status}): ${url}`);
  return res.text();
}

async function serverReads(): Promise<Set<string>> {
  const tree = JSON.parse(await get(`https://api.github.com/repos/${SERVER}/git/trees/main?recursive=1`));
  const paths: string[] = tree.tree
    .map((e: { path: string }) => e.path)
    .filter((p: string) => /^src\/.*\.ts$/.test(p) && !/__tests__|\.test\.ts$/.test(p));
  assert.ok(paths.length > 5, `derived ${paths.length} server source files`);
  const names = new Set<string>();
  for (const p of paths) {
    const src = await get(`https://raw.githubusercontent.com/${SERVER}/main/${p}`);
    for (const m of src.matchAll(/process\.env(?:\.([A-Z][A-Z0-9_]+)|\[\s*['"]([A-Z][A-Z0-9_]+)['"]\s*\])/g)) names.add(m[1] ?? m[2]);
  }
  return names;
}

test('PREMISE: the derived template universe is non-empty, and each yields env names', () => {
  const t = templates();
  assert.ok(t.length >= 5, `derived ${t.length} templates: ${t.join(', ')}`);
  for (const f of t) assert.ok(socrataEnvNames(f).length > 0, `${f} yielded no env names`);
});

test('PREMISE: the server source at main reads DATA_PORTAL_URL (so the fetch saw real source)', async () => {
  assert.ok((await serverReads()).has('DATA_PORTAL_URL'));
});

test('RED: every env name a hub template sets for the socrata server is one the server source or the runtime reads', async () => {
  const reads = await serverReads();
  const unread: string[] = [];
  for (const f of templates()) {
    for (const n of socrataEnvNames(f)) {
      if (reads.has(n) || RUNTIME_READS.some(([re]) => re.test(n))) continue;
      unread.push(`${f}: ${n}`);
    }
  }
  assert.deepEqual(unread, []);
});
