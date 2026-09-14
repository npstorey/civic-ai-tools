// Self-test for scripts/check-template-env.mjs.
//
// OFFLINE BY CONSTRUCTION: every sample is written inline, every repository
// and server tree is built in a temporary directory, and the one clone this
// file runs is of a `file://` path that does not exist. The live clone of the
// server is exercised by CI's `check:template-env` step, never here.
//
// Each extractor is driven over a sample whose answer is written out, and the
// end-to-end cases each include a shape that must be flagged, so a green run
// cannot come from an extractor that finds nothing.
//
// Run: node --test scripts/check-template-env.test.mjs

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  blankComments,
  cloneServer,
  compiledSourceFiles,
  envReadsInSource,
  globalAgentWrappers,
  launchRefPattern,
  launchesInFile,
  launchesInJson,
  launchesInToml,
  parseTomlSubset,
  runTemplateEnvCheck,
  shellGeneratedDocuments,
  shellWord,
  tsconfigGlobMatcher,
} from './check-template-env.mjs';

const SCRIPT = join(dirname(fileURLToPath(import.meta.url)), 'check-template-env.mjs');
const REF = launchRefPattern();

function tree(files) {
  const dir = mkdtempSync(join(tmpdir(), 'template-env-test-'));
  for (const [path, text] of Object.entries(files)) {
    mkdirSync(dirname(join(dir, path)), { recursive: true });
    writeFileSync(join(dir, path), text);
  }
  return dir;
}

function gitTree(files) {
  const dir = tree(files);
  const init = spawnSync('git', ['init', '-q'], { cwd: dir, encoding: 'utf8' });
  assert.equal(init.status, 0, init.stderr);
  const add = spawnSync('git', ['add', '-A'], { cwd: dir, encoding: 'utf8' });
  assert.equal(add.status, 0, add.stderr);
  return dir;
}

const SERVER_FILES = {
  'tsconfig.json': JSON.stringify({ include: ['src/**/*'], exclude: ['src/**/*.test.ts', 'src/__tests__'] }),
  'src/config.ts': "export const portal = process.env.SAMPLE_PORTAL?.trim();\n",
  'src/token.ts': "const { SAMPLE_TOKEN } = process.env;\nexport default SAMPLE_TOKEN;\n",
  'src/__tests__/config.test.ts': 'process.env.ONLY_IN_A_TEST_DIR = "x";\n',
  'src/tools/split.test.ts': 'process.env.ONLY_IN_A_TEST_FILE = "x";\n',
  'scripts/outside.ts': 'process.env.OUTSIDE_THE_BUILD;\n',
};

const jsonTemplate = (env) =>
  JSON.stringify(
    { mcpServers: { socrata: { command: 'node', args: ['.mcp-servers/socrata-mcp-server/dist/index.js', '--stdio'], env } } },
    null,
    2,
  );

// ── the launch reference ────────────────────────────────────────────────────

test('launchRefPattern matches a JS file inside the server directory, and nothing else', () => {
  const hits = [
    '.mcp-servers/socrata-mcp-server/dist/index.js',
    '${workspaceFolder}/.mcp-servers/socrata-mcp-server/proxy-wrapper.js',
    '__PROJECT_DIR__/.mcp-servers/socrata-mcp-server/dist/index.js',
    '../../socrata-mcp-server/dist/index.mjs',
  ];
  const misses = [
    'https://raw.githubusercontent.com/npstorey/socrata-mcp-server/main/src/skills/base.ts',
    'https://github.com/npstorey/socrata-mcp-server.git',
    'scripts/proxy-wrapper.js',
  ];
  assert.deepEqual(hits.map((s) => REF.test(s)), [true, true, true, true]);
  assert.deepEqual(misses.map((s) => REF.test(s)), [false, false, false]);
});

// ── the server side ─────────────────────────────────────────────────────────

test('blankComments blanks comments, keeps offsets, and keeps strings unless told not to', () => {
  const src = 'a // x\nb /* y */ c "// not a comment" `t ${ d /* z */ } u`';
  const kept = blankComments(src);
  assert.equal(kept.length, src.length);
  assert.equal(kept, 'a     \nb         c "// not a comment" `t ${ d         } u`');
  assert.equal(
    blankComments("x = 'abc' + process.env['KEY']", { keepStrings: false }),
    "x = '   ' + process.env['KEY']",
  );
});

test('envReadsInSource reads every read shape and counts no mention in a comment or string', () => {
  const src = [
    'const a = process.env.DOT_READ;',
    "const b = process.env['BRACKET_READ'];",
    'const c = process.env?.OPTIONAL_READ;',
    'const { DESTRUCTURED, RENAMED: local, DEFAULTED = "x" } = process.env;',
    'const d = `port ${process.env.IN_TEMPLATE_CODE}`;',
    '// process.env.IN_A_LINE_COMMENT',
    '/* process.env.IN_A_BLOCK_COMMENT */',
    'const e = "set process.env.IN_A_STRING to change it";',
    'const f = `process.env.IN_TEMPLATE_TEXT`;',
  ].join('\n');
  assert.deepEqual(
    [...envReadsInSource(src)].sort(),
    ['BRACKET_READ', 'DEFAULTED', 'DESTRUCTURED', 'DOT_READ', 'IN_TEMPLATE_CODE', 'OPTIONAL_READ', 'RENAMED'],
  );
});

test('tsconfigGlobMatcher reads the pattern forms tsconfig uses, and refuses the rest', () => {
  const all = tsconfigGlobMatcher('src/**/*');
  const tests = tsconfigGlobMatcher('src/**/*.test.ts');
  const dir = tsconfigGlobMatcher('src/__tests__');
  assert.deepEqual(['src/a.ts', 'src/x/y/b.ts', 'lib/a.ts'].map(all), [true, true, false]);
  assert.deepEqual(['src/a.test.ts', 'src/x/a.test.ts', 'src/a.ts'].map(tests), [true, true, false]);
  assert.deepEqual(['src/__tests__/a.ts', 'src/__tests__x.ts'].map(dir), [true, false]);
  assert.throws(() => tsconfigGlobMatcher('src/{a,b}/*'), /unsupported tsconfig pattern/);
});

test('compiledSourceFiles takes the server build config, not a pattern in this file', () => {
  const dir = tree(SERVER_FILES);
  try {
    assert.deepEqual(compiledSourceFiles(dir), ['src/config.ts', 'src/token.ts']);
    writeFileSync(join(dir, 'tsconfig.json'), JSON.stringify({ extends: './base.json' }));
    assert.throws(() => compiledSourceFiles(dir), /extends/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

// ── the template side ───────────────────────────────────────────────────────

test('launchesInJson finds the launching object wherever it sits, with its env names', () => {
  const doc = {
    servers: {
      other: { command: 'uvx', args: ['something'], env: { NOT_THIS: '1' } },
      nested: { deeper: { command: 'node', args: ['x/socrata-mcp-server/dist/index.js'], env: { A_NAME: '1', B_NAME: '2' } } },
      bare: { command: 'node', args: ['socrata-mcp-server/dist/index.js'] },
    },
  };
  assert.deepEqual(launchesInJson(doc, REF), [
    { where: '$.servers.nested.deeper', command: 'node', entry: 'socrata-mcp-server/dist/index.js', env: ['A_NAME', 'B_NAME'] },
    { where: '$.servers.bare', command: 'node', entry: 'socrata-mcp-server/dist/index.js', env: [] },
  ]);
  assert.throws(() => launchesInJson({ s: { args: ['socrata-mcp-server/dist/index.js'], env: ['X'] } }, REF), /not an object/);
});

test('parseTomlSubset and launchesInToml read a table env and an inline env', () => {
  const toml = [
    '# comment',
    '[mcp_servers.one]',
    'command = "node"',
    'args = ["socrata-mcp-server/dist/index.js", "--stdio"]',
    '',
    '[mcp_servers.one.env]',
    'TABLE_NAME = "x" # trailing comment',
    '',
    '[mcp_servers.two]',
    "args = ['socrata-mcp-server/dist/index.js']",
    'env = { INLINE_NAME = "y" }',
    '',
    '[mcp_servers.three]',
    'args = ["unrelated.js"]',
  ].join('\n');
  assert.deepEqual(parseTomlSubset(toml).get('mcp_servers.one.env'), { TABLE_NAME: 'x' });
  assert.deepEqual(
    launchesInToml(toml, REF).map((l) => [l.where, l.env]),
    [['[mcp_servers.one]', ['TABLE_NAME']], ['[mcp_servers.two]', ['INLINE_NAME']]],
  );
  assert.throws(() => parseTomlSubset('[t]\nkey = 1979-05-27'), /unsupported value/);
  assert.throws(() => parseTomlSubset('[t]\n[t]'), /duplicate table/);
});

test('shellWord decodes quoting, and shellGeneratedDocuments renders every branch combination', () => {
  assert.equal(shellWord(`'  "a": "b",'`, 1), '  "a": "b",');
  assert.equal(shellWord(`"  \\"t\\": \\"$TOKEN\\", \\\${keep}"`, 1), '  "t": "__TOKEN__", ${keep}');
  const script = [
    '#!/bin/bash',
    '{',
    "    echo '{'",
    '    NEED_COMMA=false',
    '    if $INCLUDE_ONE; then',
    "        echo '\"one\": {\"args\": [\"socrata-mcp-server/dist/index.js\"], \"env\": {'",
    '        if [ -n "$TOKEN" ]; then',
    '            echo "\\"TOKEN_NAME\\": \\"$TOKEN\\","',
    '        fi',
    "        echo '\"PORTAL_NAME\": \"p\"'",
    "        echo -n '}}'",
    '        NEED_COMMA=true',
    '    fi',
    "    $NEED_COMMA && echo ','",
    "    echo '\"last\": {}'",
    "    echo '}'",
    '} > "$DIR/out.json"',
  ].join('\n');
  const docs = shellGeneratedDocuments(script);
  assert.deepEqual(docs.map((d) => d.branches), [
    '$INCLUDE_ONE=false, [ -n "$TOKEN" ]=false',
    '$INCLUDE_ONE=true, [ -n "$TOKEN" ]=false',
    '$INCLUDE_ONE=false, [ -n "$TOKEN" ]=true',
    '$INCLUDE_ONE=true, [ -n "$TOKEN" ]=true',
  ]);
  const { launches } = launchesInFile('gen.sh', script, REF);
  assert.deepEqual(launches.map((l) => l.env), [['PORTAL_NAME'], ['TOKEN_NAME', 'PORTAL_NAME']]);

  // Delete the entry after the token line, which keeps its trailing comma:
  // the document is valid when the token is unset and invalid when it is set,
  // so only a reader that renders every branch can see it.
  const brokenOnOneBranch = script.replace("        echo '\"PORTAL_NAME\": \"p\"'\n", '');
  assert.notEqual(brokenOnOneBranch, script);
  assert.throws(() => launchesInFile('gen.sh', brokenOnOneBranch, REF), /\[ -n "\$TOKEN" \]=true\) does not parse/);
  assert.throws(
    () => shellGeneratedDocuments('{\n  printf "%s" x\n} > "out.json"'),
    /unsupported statement inside a generated document/,
  );
});

test('launchesInFile: a launch reference with no environment passes; an unreadable format with one fails', () => {
  assert.deepEqual(
    launchesInFile('docs/guide.md', 'Run `node .mcp-servers/socrata-mcp-server/dist/index.js --stdio`.', REF),
    { format: 'mention', launches: [] },
  );
  assert.throws(
    () => launchesInFile('run.py', 'subprocess.run(["node", "socrata-mcp-server/dist/index.js"], env={"X": "1"})', REF),
    /no reader for/,
  );
  assert.throws(() => launchesInFile('a.json.example', '{ "args": ["socrata-mcp-server/dist/index.js"], }', REF), /does not parse/);
  assert.deepEqual(launchesInFile('unrelated.json', '{"args": ["other.js"]}', REF), { format: 'none', launches: [] });
});

test('globalAgentWrappers names a tracked script that bootstraps global-agent, and not one missing any of the three parts', () => {
  // Each negative sample lacks exactly one of: the import, the bootstrap() call, the server import.
  const dir = tree({
    'scripts/wrap.js': "import { bootstrap } from 'global-agent';\nbootstrap();\nimport './dist/index.js';\n",
    'scripts/no-import.js': "// uses global-agent's bootstrap() elsewhere\nbootstrap();\nimport './dist/index.js';\n",
    'scripts/no-bootstrap.js': "import { bootstrap } from 'global-agent';\nimport './dist/index.js';\n",
    'scripts/no-server.js': "import { bootstrap } from 'global-agent';\nbootstrap();\n",
  });
  const files = ['scripts/wrap.js', 'scripts/no-import.js', 'scripts/no-bootstrap.js', 'scripts/no-server.js'];
  try {
    assert.deepEqual([...globalAgentWrappers(dir, files)], ['wrap.js']);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

// ── end to end ──────────────────────────────────────────────────────────────

test('a decoy template, at a path nothing names, that sets an unread name is caught', () => {
  const server = tree(SERVER_FILES);
  const repo = gitTree({
    '.mcp.json.example': jsonTemplate({ SAMPLE_PORTAL: 'p', SAMPLE_TOKEN: 't' }),
    'deeply/nested/client-settings/agent.jsonc': `{\n  // decoy\n${jsonTemplate({ SAMPLE_PORTAL: 'p', DECOY_UNREAD_NAME: 'x' }).slice(1)}`,
    'docs/guide.md': 'Launch with `node .mcp-servers/socrata-mcp-server/dist/index.js`.\n',
  });
  try {
    const r = runTemplateEnvCheck({ root: repo, serverDir: server });
    assert.equal(r.ok, false);
    assert.deepEqual(r.failures, [
      'deeply/nested/client-settings/agent.jsonc $.mcpServers.socrata: sets DECOY_UNREAD_NAME, which nothing reads',
    ]);
    assert.deepEqual(r.templates.map((t) => t.file).sort(), ['.mcp.json.example', 'deeply/nested/client-settings/agent.jsonc']);
    // A name read only by a test file, or by a file outside the build, is not a read.
    const testOnly = runTemplateEnvCheck({
      root: gitTree({ 'a.json': jsonTemplate({ ONLY_IN_A_TEST_DIR: '1', ONLY_IN_A_TEST_FILE: '1', OUTSIDE_THE_BUILD: '1' }) }),
      serverDir: server,
    });
    assert.equal(testOnly.failures.length, 3, testOnly.failures.join('\n'));
  } finally {
    rmSync(server, { recursive: true, force: true });
    rmSync(repo, { recursive: true, force: true });
  }
});

test('a runtime-read name passes only on the launch its reader applies to', () => {
  const server = tree(SERVER_FILES);
  const proxied = (entry) => ({
    servers: {
      socrata: {
        command: 'node',
        args: [`\${workspaceFolder}/.mcp-servers/socrata-mcp-server/${entry}`],
        env: { SAMPLE_PORTAL: 'p', NODE_TLS_REJECT_UNAUTHORIZED: '0', GLOBAL_AGENT_HTTP_PROXY: 'http://proxy.example.internal' },
      },
    },
  });
  const wrapper = "import { bootstrap } from 'global-agent';\nbootstrap();\nimport './dist/index.js';\n";
  const repo = gitTree({
    'scripts/proxy-wrapper.js': wrapper,
    'through-wrapper.json': JSON.stringify(proxied('proxy-wrapper.js')),
    'no-wrapper.json': JSON.stringify(proxied('dist/index.js')),
  });
  try {
    const r = runTemplateEnvCheck({ root: repo, serverDir: server });
    assert.deepEqual(r.failures, [
      'no-wrapper.json $.servers.socrata: sets GLOBAL_AGENT_HTTP_PROXY, which nothing reads (global-agent, bootstrapped by the launched wrapper script reads it only when the launched file is a tracked hub script that imports global-agent and calls bootstrap())',
    ]);
  } finally {
    rmSync(server, { recursive: true, force: true });
    rmSync(repo, { recursive: true, force: true });
  }
});

test('an empty universe on either side is a failure, not a clean result', () => {
  const noReads = tree({ 'tsconfig.json': '{"include": ["src/**/*"]}', 'src/a.ts': 'export const x = 1;\n' });
  const server = tree(SERVER_FILES);
  const withTemplate = gitTree({ 'a.json': jsonTemplate({ SAMPLE_PORTAL: 'p' }) });
  const withoutTemplate = gitTree({ 'readme.md': 'nothing launches here\n' });
  try {
    assert.match(runTemplateEnvCheck({ root: withTemplate, serverDir: noReads }).failures.join('\n'), /no environment reads found/);
    assert.match(runTemplateEnvCheck({ root: withoutTemplate, serverDir: server }).failures.join('\n'), /empty template universe/);
    assert.equal(runTemplateEnvCheck({ root: withTemplate, serverDir: server }).ok, true);
  } finally {
    for (const d of [noReads, server, withTemplate, withoutTemplate]) rmSync(d, { recursive: true, force: true });
  }
});

test('the CLI fails, and does not pass, when the server source cannot be fetched', () => {
  const missing = join(tmpdir(), 'template-env-no-such-server-repository');
  const cloned = cloneServer({ repoUrl: `file://${missing}` });
  assert.equal(cloned.ok, false);
  assert.match(cloned.reason, /git clone of .* failed/);
  const run = spawnSync(process.execPath, [SCRIPT, '--server-repo', `file://${missing}`], { encoding: 'utf8' });
  assert.equal(run.status, 1, run.stdout + run.stderr);
  assert.match(run.stderr, /could not be fetched, so nothing was checked/);
  assert.doesNotMatch(run.stdout, /passed/);
});

test('the CLI exits 0 on a clean tree and 1 on an unread name', () => {
  const server = tree(SERVER_FILES);
  const clean = gitTree({ 'a.json': jsonTemplate({ SAMPLE_PORTAL: 'p' }) });
  const dirty = gitTree({ 'a.json': jsonTemplate({ SAMPLE_PORTAL: 'p', UNREAD_SAMPLE: 'x' }) });
  try {
    const ok = spawnSync(process.execPath, [SCRIPT, '--root', clean, '--server-source', server], { encoding: 'utf8' });
    assert.equal(ok.status, 0, ok.stdout + ok.stderr);
    assert.match(ok.stdout, /Template-env check passed/);
    const bad = spawnSync(process.execPath, [SCRIPT, '--root', dirty, '--server-source', server], { encoding: 'utf8' });
    assert.equal(bad.status, 1, bad.stdout + bad.stderr);
    assert.match(bad.stderr, /a\.json \$\.mcpServers\.socrata: sets UNREAD_SAMPLE, which nothing reads/);
  } finally {
    for (const d of [server, clean, dirty]) rmSync(d, { recursive: true, force: true });
  }
});
