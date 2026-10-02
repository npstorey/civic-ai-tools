// Guard: AGENTS.md's Commands table pins no count the runner outgrows, and it
// names exactly the commands ci.yml runs (civic-ai-tools#197); and every other
// markdown passage that lists the CI gates names the same set
// (civic-ai-tools#225, the last section below).
//
// WHY. Two defects of the same class, both live at `232f60e`:
//
//   - `| npm test | # pass 162 / # fail 0 |` — a monotonically increasing
//     total written down as a literal. Wave N11 P-H1 moved it from 125 to 162
//     and found it had been stale by 25; four other cells pinned a count the
//     same way (`# pass 9 / 11 / 29`, `Ran 73 tests`, `added 116 packages`),
//     and the `npm ci` cell claimed `found 0 vulnerabilities` against a tree
//     that reports one high-severity advisory at install.
//   - the sentence under the table said ci.yml "runs exactly these", which
//     nothing checked. A config nobody runs and a row nobody honours are the
//     same defect from two sides.
//
// WHAT IS DERIVED, AND WHAT THAT BUYS. Nothing here is a list of commands.
// The rows come from the table, the gates come from ci.yml's own `run:`
// steps, and the scripts come from the manifests — so a command added to any
// one of the three has to appear in the others, and this file does not change
// when the gate table grows. That is the property the previous, listless
// prose could not have.
//
// BLIND SPOTS, STATED. It reads text: it cannot tell whether `# fail 0` is
// still TRUE (that is what the commands' own exit codes are for), and it does
// not check the ORDER of the steps, only the set — the workflow runs each
// checker's self-test immediately before its check, which the table states in
// one row rather than two.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const REPO = dirname(dirname(fileURLToPath(import.meta.url)));
const AGENTS_MD = readFileSync(join(REPO, 'AGENTS.md'), 'utf8');
const CI_YML = readFileSync(join(REPO, '.github', 'workflows', 'ci.yml'), 'utf8');
const ROOT_MANIFEST = JSON.parse(readFileSync(join(REPO, 'package.json'), 'utf8'));

/** The rows of the `## Commands` table, as `{ command, output, line }`. */
export function commandTableRows(markdown) {
  const section = markdown.split('\n## ');
  const commands = section.find((s) => s.startsWith('Commands\n'));
  assert.ok(commands, 'AGENTS.md has no "## Commands" section — update this guard if it moved');
  const rows = [];
  for (const line of commands.split('\n')) {
    if (!line.startsWith('| ') || line.startsWith('|---') || line.startsWith('| Command ')) continue;
    const cells = line.split('|').slice(1, -1).map((c) => c.trim());
    if (cells.length < 2) continue;
    const command = cells[0].match(/`([^`]+)`/);
    assert.ok(command, `a Commands row names no command in backticks: ${line}`);
    rows.push({ command: command[1], output: cells[1], line });
  }
  return rows;
}

/** Every command ci.yml runs, including the lines of a block scalar. */
export function ciRunCommands(yaml) {
  const lines = yaml.split('\n');
  const out = [];
  for (let i = 0; i < lines.length; i++) {
    const match = lines[i].match(/^(\s*)run:\s*(.*)$/);
    if (!match) continue;
    const indent = match[1].length;
    const inline = match[2].trim();
    if (inline === '|' || inline === '|-' || inline === '>' || inline === '>-') {
      for (let j = i + 1; j < lines.length; j++) {
        if (lines[j].trim() === '') continue;
        const depth = lines[j].length - lines[j].trimStart().length;
        if (depth <= indent) break;
        out.push(lines[j].trim());
      }
    } else if (inline !== '') {
      out.push(inline);
    }
  }
  return out;
}

/** A command's gate identity: `npm run x` and a bare `x` are the same gate. */
const normalize = (command) => command.replace(/^npm run /, '');

/** Is this ci.yml line a GATE, rather than a probe like `python3 --version`?
 *  A shape, not a name list: an npm lifecycle/script invocation, or a python
 *  test module. */
const isGate = (command) =>
  /^npm (ci|test|run [\w:.-]+)$/.test(command) || /^python3 \S+\.py$/.test(command);

// --- The instruments, driven on samples where the answer is written out ---

test('the table parser reads rows and the yaml parser reads block scalars', () => {
  const sampleMd = [
    '# T', '', '## Commands', '', '| Command | Healthy output |', '|---|---|',
    '| `npm test` | `# fail 0` |', '| `python3 x.py` | `OK` |', '',
    '## After', '', '| `npm run nope` | not in the Commands table |',
  ].join('\n');
  assert.deepEqual(
    commandTableRows(sampleMd).map((r) => r.command),
    ['npm test', 'python3 x.py'],
    'the parser must read the Commands table and stop at the next section',
  );
  const sampleYml = [
    'jobs:', '  ci:', '    steps:',
    '      - name: One', '        run: npm ci',
    '      - name: Two', '        run: |', '          python3 --version',
    '          python3 t.py', '      - name: Three', '        run: npm run lint',
  ].join('\n');
  assert.deepEqual(
    ciRunCommands(sampleYml),
    ['npm ci', 'python3 --version', 'python3 t.py', 'npm run lint'],
    'the parser must read both scalar and block `run:` forms',
  );
  // And on the real files: an empty read from either would make every check
  // below pass by having nothing to compare.
  assert.ok(commandTableRows(AGENTS_MD).length >= 8, 'the real Commands table has rows');
  assert.ok(ciRunCommands(CI_YML).filter(isGate).length >= 8, 'the real workflow runs gates');
});

// --- The table pins no count ---

test('#197: no Healthy-output cell pins a count the runner outgrows', () => {
  // The rule is a shape: any non-zero integer in an output cell is a count of
  // something that grows — passes, packages, tests, warnings. Zero is allowed
  // and is the point: `# fail 0` and `exit 0` are invariants, not counts. A
  // cell that wants to say how many there are should say where to read it
  // instead.
  // An ISSUE REFERENCE is not a count: `#197` and `civic-ai-tools#199` carry a
  // number that never moves, and a cell is allowed to cite one. They are
  // struck before the scan by their shape — `#` with no space before the
  // digits, which no TAP summary has (`# pass 162`, `# fail 0`).
  const countable = (output) => output.replace(/#\d+/g, '');
  const offenders = commandTableRows(AGENTS_MD)
    .filter((r) => /[1-9]\d*/.test(countable(r.output)))
    .map((r) => `${r.command} → ${countable(r.output).match(/[^ ]*[1-9]\d*[^ ]*/)[0]}`);
  assert.deepEqual(
    offenders,
    [],
    `pinned counts in the Commands table: ${offenders.join('; ')}. Every one of these was wrong within a wave or two of being written; state the invariant and point at the merge-ref run for the total.`,
  );
});

test('#197: every npm script the table names exists', () => {
  const workspaceManifests = (ROOT_MANIFEST.workspaces ?? []).flatMap((pattern) => {
    // Only the `packages/*` form this repo uses; a new pattern shape should
    // fail loudly here rather than be silently skipped.
    assert.match(pattern, /^[\w-]+\/\*$/, `unhandled workspace pattern: ${pattern}`);
    const dir = pattern.replace(/\/\*$/, '');
    return readdirSync(join(REPO, dir)).filter((n) => !n.startsWith('.')).map((name) =>
      JSON.parse(readFileSync(join(REPO, dir, name, 'package.json'), 'utf8')),
    );
  });
  const known = new Set([
    ...Object.keys(ROOT_MANIFEST.scripts ?? {}),
    ...workspaceManifests.flatMap((m) => Object.keys(m.scripts ?? {})),
  ]);
  const missing = commandTableRows(AGENTS_MD)
    .map((r) => r.command)
    .filter((c) => c.startsWith('npm run '))
    .map(normalize)
    .filter((s) => !known.has(s));
  assert.deepEqual(missing, [], `the table names npm scripts that exist nowhere: ${missing.join(', ')}`);
});

// --- The table and the workflow name the same gates ---

test('#197: ci.yml runs every command the table names, and names every gate ci.yml runs', () => {
  const rows = commandTableRows(AGENTS_MD);
  const tabled = new Set(rows.map((r) => normalize(r.command)));
  // A row may name a second script in its output cell — the checker twins are
  // written that way. Derived from the cell, not from a list of twins.
  for (const row of rows) {
    for (const m of row.output.matchAll(/`([\w-]+:[\w:-]+)`/g)) {
      if ((ROOT_MANIFEST.scripts ?? {})[m[1]]) tabled.add(m[1]);
    }
  }
  const run = new Set(ciRunCommands(CI_YML).filter(isGate).map(normalize));

  const notRun = [...tabled].filter((c) => !run.has(c)).sort();
  const notTabled = [...run].filter((c) => !tabled.has(c)).sort();
  assert.deepEqual(notRun, [], `AGENTS.md names commands ci.yml does not run: ${notRun.join(', ')}`);
  assert.deepEqual(notTabled, [], `ci.yml runs gates AGENTS.md does not name: ${notTabled.join(', ')}`);
});

test('#197: every gate-shaped root script is run by ci.yml — a config nobody runs is not a gate', () => {
  // The universe is the root manifest's own script names, filtered by shape:
  // the four lifecycle gates and anything named `check:*`. The utility
  // scripts (validate-directory and friends) are not gates and are not
  // required here. This is what makes "wired into ci.yml" checkable without
  // naming the wires.
  const gateShaped = Object.keys(ROOT_MANIFEST.scripts ?? {}).filter(
    (name) => ['build', 'test', 'typecheck', 'lint'].includes(name) || name.startsWith('check:'),
  );
  assert.ok(gateShaped.length >= 8, `expected the root gates, found ${gateShaped.length}`);
  const run = new Set(ciRunCommands(CI_YML).filter(isGate).map(normalize));
  const unrun = gateShaped.filter((name) => !run.has(name) && !run.has(`npm ${name}`)).sort();
  assert.deepEqual(unrun, [], `declared as a gate and run by no CI step: ${unrun.join(', ')}`);
});

// --- Every gate list in the repository, derived (civic-ai-tools#225) ---
//
// WHAT WAS MEASURED. `.claude/agents/impl.md` told an IMPL to paste "every
// check CI gates on" and then listed the checks itself. At `1cdd0c2`, where
// #225 was filed, the list omitted three of ci.yml's gates; at `78354f2` it
// omitted seven: both sub-type checkers and their self-tests, this guard, and
// the template-env check and its self-test. The tests above read AGENTS.md
// only, so main stayed green while the copy fell behind.
//
// THE UNIVERSE. Every markdown file git tracks or would track
// (`git ls-files --cached --others --exclude-standard`), split into heading
// sections, frontmatter and fenced code left out. No path is named: a doc
// that lists the gates is checked the moment it is written, committed or not.
//
// WHAT COUNTS AS A GATE LIST. A section whose code spans name three or more
// distinct gates besides the `npm ci` install. One or two is a passage citing
// the check it is about (a rule file names the checker that enforces it, a
// CHANGELOG entry names the build); three or more is an enumeration of CI's
// gates, which is a claim to be the list. A span names a gate when it is the
// command ci.yml runs, an npm alias of it (`npm run test`, `npm t`,
// `npm run-script x`), or a twin's bare script name, written the way the
// Commands table's output cells write one. The test prints every section it
// classified, either way.
//
// WHAT A GATE LIST MUST SAY. Every gate ci.yml runs, the install aside, and no
// gate-shaped command ci.yml does not run. The set, not the order, for the
// reason the header gives. A passage that needs the gates points at the
// Commands table instead of copying it.
//
// BLIND SPOTS, STATED. A list split across headings so that no one section
// names three gates is not recognised; fenced code and non-markdown files are
// not read. It errs loud the other way: a section that names three gates
// without meaning to list CI's fails, and the fix is to name them all or to
// point at the table.

const GATE_LIST_MIN = 3;
const FENCE = /^ {0,3}(`{3,}|~{3,})/;
const HEADING = /^ {0,3}#{1,6}(?:[ \t]|$)/;
const isInstall = (command) => /^npm ci(?:\s|$)/.test(command);
const quoted = (commands) => commands.map((c) => `\`${c}\``).join(', ');

/** A markdown file's heading sections as `{ heading, text }`, frontmatter and fenced code left out. */
export function sectionsOf(markdown) {
  const lines = markdown.split('\n');
  let i = 0;
  if (lines[0] === '---') {
    const end = lines.indexOf('---', 1);
    if (end !== -1) i = end + 1;
  }
  const sections = [{ heading: '', lines: [] }];
  let fence = null;
  for (; i < lines.length; i++) {
    const open = lines[i].match(FENCE);
    if (fence) {
      if (open && open[1][0] === fence[0] && open[1].length >= fence.length) fence = null;
      continue;
    }
    if (open) {
      fence = open[1];
      continue;
    }
    if (HEADING.test(lines[i])) sections.push({ heading: lines[i].trim(), lines: [] });
    else sections.at(-1).lines.push(lines[i]);
  }
  return sections.map((s) => ({ heading: s.heading, text: s.lines.join('\n').trim() }));
}

/** `npm t`, `npm tst` and `npm run test` spell `npm test`; `npm run-script x` spells `npm run x`. */
const spelling = (command) =>
  command
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^npm run-script /, 'npm run ')
    .replace(/^npm (?:t|tst|run test)$/, 'npm test');

/** The ci.yml gate a code span names, as ci.yml spells it; undefined if none. */
export function gateNamedBy(span, gates) {
  const command = /^[\w-]+:[\w:-]+$/.test(span.trim()) ? `npm run ${span.trim()}` : span;
  return gates.find((g) => spelling(g) === spelling(command));
}

/** Every section that names a ci.yml gate, as `{ heading, named, strays }`: the
 *  gates it names in document order, and the gate-shaped commands it names that
 *  ci.yml does not run. */
export function passagesNamingGates(markdown, gates) {
  const out = [];
  for (const { heading, text } of sectionsOf(markdown)) {
    const spans = [...text.matchAll(/`([^`]+)`/g)].map((m) => m[1]);
    const named = spans.map((s) => gateNamedBy(s, gates)).filter(Boolean);
    if (named.length === 0) continue;
    const strays = spans.map(spelling).filter((s) => isGate(s) && !gateNamedBy(s, gates));
    out.push({ heading, named, strays });
  }
  return out;
}

/** A passage is a gate list when it names enough distinct gates, the install aside. */
const isGateList = ({ named }) => new Set(named.filter((g) => !isInstall(g))).size >= GATE_LIST_MIN;

/** What a gate list gets wrong against ci.yml's gates; [] when it names exactly their set. */
export function gateListProblems({ named, strays }, gates) {
  const omitted = gates.filter((g) => !isInstall(g) && !named.includes(g));
  const problems = [];
  if (omitted.length) problems.push(`omits ${quoted(omitted)}`);
  if (strays.length) problems.push(`names ${quoted(strays)}, which ci.yml does not run`);
  return problems;
}

/** Every markdown file git tracks, or would track, that is on disk. */
function markdownUniverse() {
  return execFileSync('git', ['ls-files', '-z', '--cached', '--others', '--exclude-standard'], {
    cwd: REPO,
    encoding: 'utf8',
  })
    .split('\0')
    .filter((f) => /\.md$/i.test(f) && existsSync(join(REPO, f)))
    .sort();
}

test('#225: the section reader drops frontmatter and fenced code, and a span names a gate by any npm spelling of it', () => {
  const sample = [
    '---', 'description: `npm run a`', '---', 'intro `npm run a`',
    '# One', '`npm run b`', '```sh', '# not a heading', '`npm run c`', '```',
    '## Two', 'text',
  ].join('\n');
  assert.deepEqual(sectionsOf(sample), [
    { heading: '', text: 'intro `npm run a`' },
    { heading: '# One', text: '`npm run b`' },
    { heading: '## Two', text: 'text' },
  ]);
  const gates = ['npm ci', 'npm test', 'npm run check:a', 'python3 t.py'];
  assert.equal(gateNamedBy('npm test', gates), 'npm test');
  assert.equal(gateNamedBy('npm run test', gates), 'npm test');
  assert.equal(gateNamedBy('npm t', gates), 'npm test');
  assert.equal(gateNamedBy('npm run-script check:a', gates), 'npm run check:a');
  assert.equal(gateNamedBy('check:a', gates), 'npm run check:a', 'a twin written bare, as the Commands table writes one');
  assert.equal(gateNamedBy('npm run\n  check:a', gates), 'npm run check:a', 'a span broken across lines');
  assert.equal(gateNamedBy('python3 t.py', gates), 'python3 t.py');
  assert.equal(gateNamedBy('npm testx', gates), undefined);
  assert.equal(gateNamedBy('npm run check:a -- --flag', gates), undefined);
  assert.equal(gateNamedBy('did:key', gates), undefined);
});

test('#225: a section naming three gates is a gate list, and it must name every gate and nothing ci.yml does not run', () => {
  const gates = ['npm ci', 'npm run build', 'npm test', 'npm run check:a', 'python3 t.py'];
  const sample = [
    '# Cites', '`npm ci`, then `npm run build` and `npm test`; `npm run build` again.',
    '# Lists', '`npm run build`, `npm t`,', '`check:a` and `npm run check:gone`.',
    '# Silent', '`npm run lint`',
  ].join('\n');
  const passages = passagesNamingGates(sample, gates);
  assert.deepEqual(passages, [
    { heading: '# Cites', named: ['npm ci', 'npm run build', 'npm test', 'npm run build'], strays: [] },
    { heading: '# Lists', named: ['npm run build', 'npm test', 'npm run check:a'], strays: ['npm run check:gone'] },
  ]);
  assert.deepEqual(passages.map(isGateList), [false, true], 'the install and a repeat do not count toward a gate list');
  assert.deepEqual(gateListProblems(passages[1], gates), [
    'omits `python3 t.py`',
    'names `npm run check:gone`, which ci.yml does not run',
  ]);
  assert.deepEqual(
    gateListProblems({ named: ['python3 t.py', 'npm run check:a', 'npm test', 'npm run build'], strays: [] }, gates),
    [],
    'the set, not the order, and the install may go unnamed',
  );
});

test('#225: the markdown universe comes from git, and the Commands table is a gate list by this rule', () => {
  // The positive control: if the reader stopped recognising gates, the test
  // below would pass by finding no list to compare.
  const files = markdownUniverse();
  assert.ok(files.includes('AGENTS.md'), `git listed ${files.length} markdown files, AGENTS.md not among them`);
  const commands = passagesNamingGates(AGENTS_MD, ciRunCommands(CI_YML).filter(isGate)).find(
    (p) => p.heading === '## Commands',
  );
  assert.ok(commands && isGateList(commands), 'the Commands table does not classify as a gate list');
});

test("#225: every gate list in the repository's markdown names exactly the gates ci.yml runs", (t) => {
  const gates = ciRunCommands(CI_YML).filter(isGate);
  const problems = [];
  for (const file of markdownUniverse()) {
    for (const passage of passagesNamingGates(readFileSync(join(REPO, file), 'utf8'), gates)) {
      const where = `${file}${passage.heading ? ` § ${passage.heading}` : ''}`;
      if (!isGateList(passage)) {
        t.diagnostic(`not a gate list (fewer than ${GATE_LIST_MIN} gates): ${where}`);
        continue;
      }
      t.diagnostic(`gate list: ${where}`);
      for (const problem of gateListProblems(passage, gates)) problems.push(`${where}: ${problem}`);
    }
  }
  assert.deepEqual(
    problems,
    [],
    'a passage that lists the CI gates must name all of them; point at the AGENTS.md Commands table instead of copying it',
  );
});
