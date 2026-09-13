// Guard: AGENTS.md's Commands table pins no count the runner outgrows, and it
// names exactly the commands ci.yml runs (civic-ai-tools#197).
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
import { readdirSync, readFileSync } from 'node:fs';
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
