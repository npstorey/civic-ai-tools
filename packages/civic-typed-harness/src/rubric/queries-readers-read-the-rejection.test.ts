// DERIVED GUARD — every site in this repository that READS a package's
// `queries[]` in code also reads the recorded rejection marker (`failed`).
//
// WHY THIS IS SCOPED BY WHAT READS `queries[]`, NOT BY A LIST OF CONSUMERS.
// civic-ai-tools#203 survived a whole wave that had established "a call the
// source rejected is stated as rejected on every surface the record reaches".
// It survived because the wave's consumer map and the website's site list were
// both ENUMERATIONS, and this consumer appeared on neither. A guard scoped by
// enumeration cannot fail on a site it does not name, so the universe below is
// DERIVED from `git ls-files` and the registrations are checked in BOTH
// directions: a new reader that nobody registers turns this red, and a
// registration that no longer describes the tree turns it red too.
//
// THE PROPERTY. `queries[]` entries have carried `failed` and `failureKind`
// since produce-core 0.4.0. A consumer that reads the entries and ignores
// `failed` cannot tell a call the source REFUSED from a call whose row count
// was merely never recorded. In the evaluator's case that difference is fed to
// a model whose score is then signed.
//
// WHAT THIS GUARD CHECKS, AND WHAT IT DOES NOT. It checks that a reader
// mentions the marker at all — it is a scope guard, not a behavioural one.
// That the evaluator renders the rejection CORRECTLY is asserted by the
// behavioural tests in adversarial-eval-core.test.ts; this file exists so that
// the NEXT reader cannot be added without either handling the rejection or
// being registered with a reason.
//
// STATED BLIND SPOTS (each one a way this guard could be green and wrong):
//   1. LANGUAGE. Only the JavaScript/TypeScript family is scanned. A reader in
//      another language is invisible. Measured at the time of writing: the
//      repository's only non-JS/TS mentions of `queries[]` are two Python
//      COMMENTS in .claude/skills/publish-record/publish.py (about what the
//      server's mapping drops) and prose in markdown — no code reader.
//   2. TEST FILES are excluded, by reason: they construct fixtures rather than
//      consume a record. A shipped reader misnamed `*.test.ts` escapes.
//   3. ACCESS FORM. A read is recognised as `.queries` or `pkg['queries']`. A
//      read through a computed key (`pkg[k]`) or through a destructured
//      binding passed across a module boundary is invisible.
//   4. THE MARKER TEST is textual: a reader "handles" the rejection if the
//      word `failed` survives comment/string stripping. A reader that names it
//      and ignores it passes here; the behavioural test is what pins meaning.
//   5. THE COMMENT STRIPPER is a scanner, not a parser. It removes comments
//      and KEEPS string and template content, so a read written inside a
//      template (`${pkg.queries.length}`) is still seen, and so is the bracket
//      access form. The cost is conservative in the safe direction: a
//      `.queries` written inside a string literal counts as a read and has to
//      be registered. A regex literal containing an unbalanced quote can
//      mis-segment it.
//   6. `git ls-files` is the universe, so an untracked file is not scanned.
//      That is intentional — it is also what lets a decoy be demonstrated by
//      `git add -N`.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));

const REPO_ROOT = execFileSync('git', ['rev-parse', '--show-toplevel'], {
  cwd: HERE,
  encoding: 'utf8',
}).trim();

const SCANNED_EXTENSIONS = ['.ts', '.tsx', '.mts', '.cts', '.js', '.jsx', '.mjs', '.cjs'];

/** Every tracked file of the JavaScript/TypeScript family, test files aside.
 *  `git ls-files` is run against the repository ROOT on purpose: run from a
 *  subdirectory it lists only that subtree, which is exactly the
 *  directory-scoped blindness this guard exists to avoid. */
function trackedSourceFiles(): string[] {
  const out = execFileSync('git', ['ls-files', '-z'], { cwd: REPO_ROOT, encoding: 'utf8' });
  return out
    .split('\0')
    .filter(Boolean)
    .filter((p) => SCANNED_EXTENSIONS.some((ext) => p.endsWith(ext)))
    .filter((p) => !/\.test\.[cm]?[jt]sx?$/.test(p));
}

/** Remove comments, KEEPING string and template content.
 *
 *  String-awareness is what makes comment removal correct: without it, the
 *  `//` inside a URL literal would swallow the rest of its line, and a real
 *  read after it would go unseen. Content is kept so that the bracket access
 *  form (`pkg['queries']`) survives to be matched — an earlier version of this
 *  function replaced string content with a space, which silently made that
 *  branch of the read pattern unmatchable, i.e. a check that could not fire. */
function stripComments(src: string): string {
  let out = '';
  let i = 0;
  const n = src.length;
  while (i < n) {
    const c = src[i];
    const d = src[i + 1];
    if (c === '/' && d === '/') {
      while (i < n && src[i] !== '\n') i++;
      continue;
    }
    if (c === '/' && d === '*') {
      i += 2;
      while (i < n && !(src[i] === '*' && src[i + 1] === '/')) i++;
      i += 2;
      continue;
    }
    if (c === "'" || c === '"' || c === '`') {
      const quote = c;
      out += c;
      i++;
      while (i < n) {
        if (src[i] === '\\') {
          out += src.slice(i, i + 2);
          i += 2;
          continue;
        }
        out += src[i];
        if (src[i] === quote) {
          i++;
          break;
        }
        i++;
      }
      continue;
    }
    out += c;
    i++;
  }
  return out;
}

/** A read of a package's `queries` member, in either access form. */
const QUERIES_READ_RE = /\.\s*queries\b|\[\s*['"]queries['"]\s*\]/;

/** The recorded rejection marker. */
const REJECTION_MARKER_RE = /\bfailed\b/;

function codeOf(relPath: string): string {
  return stripComments(readFileSync(join(REPO_ROOT, relPath), 'utf8'));
}

/** Files that read `queries[]` in code, derived. */
function derivedQueryReaders(): string[] {
  return trackedSourceFiles().filter((p) => QUERIES_READ_RE.test(codeOf(p))).sort();
}

// --- The registration, checked in BOTH directions --------------------------
//
// Every entry must still be a reader (or the tree moved under it), and every
// reader the scan finds must be registered. Adding a reader here is a
// deliberate act that says "this consumer has been considered".

const REGISTERED_QUERY_READERS: Record<string, string> = {
  'packages/civic-typed-harness/src/rubric/adversarial-eval-core.ts':
    'buildEvaluationPrompt renders each entry into the turn the adversarial evaluator reads; its score is signed as an `evaluation` attestation (civic-ai-tools#203).',
};

// Files that MENTION `queries` but perform no read — registered so that a
// mention turning into a read cannot slip through as "already known".
const MENTIONS_WITHOUT_READING: Record<string, string> = {
  'packages/civic-typed-harness/src/capture/data-sources.ts':
    "a comment only: buildDataSources notes that a rejected call is still carried in the caller's own `queries[]`.",
  'scripts/generate-directory-md.mjs':
    'the English word, inside generated prose about testing a server with representative queries.',
};

test('premise: the derived universe is the whole repository, not one subtree', () => {
  const files = trackedSourceFiles();
  assert.ok(
    files.length > 20,
    `expected the repository's JS/TS family to be scanned; got ${files.length} files. ` +
      'If this collapsed to a handful, `git ls-files` resolved against the wrong root.',
  );
  assert.ok(
    files.includes('packages/civic-typed-harness/src/rubric/adversarial-eval-core.ts'),
    'the evaluator source is not in the scanned universe',
  );
  assert.ok(
    files.some((f) => f.startsWith('scripts/')),
    'no scripts/ file was scanned — the universe is directory-scoped, which is the blindness this guard exists to avoid',
  );
});

test('every site that reads queries[] in code is registered, and every registration is still a reader', () => {
  const found = derivedQueryReaders();
  const registered = Object.keys(REGISTERED_QUERY_READERS).sort();

  const unregistered = found.filter((f) => !(f in REGISTERED_QUERY_READERS));
  assert.deepEqual(
    unregistered,
    [],
    `these files read a package's queries[] and are registered nowhere:\n  ${unregistered.join('\n  ')}\n` +
      'Register the reader with the reason it reads the entries, and make sure it reads the rejection marker.',
  );

  const stale = registered.filter((f) => !found.includes(f));
  assert.deepEqual(
    stale,
    [],
    `these registrations no longer describe the tree (the file is gone, renamed, or no longer reads queries[]):\n  ${stale.join('\n  ')}`,
  );
});

test('every registered reader of queries[] also reads the recorded rejection marker', () => {
  for (const [file, why] of Object.entries(REGISTERED_QUERY_READERS)) {
    assert.ok(
      REJECTION_MARKER_RE.test(codeOf(file)),
      `${file} reads a package's queries[] but never reads \`failed\`, so it cannot tell a call the ` +
        `source REFUSED from one whose row count was never recorded.\nRegistered because: ${why}`,
    );
  }
});

test('a file registered as mentioning queries[] without reading it still does exactly that', () => {
  for (const [file, why] of Object.entries(MENTIONS_WITHOUT_READING)) {
    const raw = readFileSync(join(REPO_ROOT, file), 'utf8');
    assert.ok(
      raw.includes('queries'),
      `${file} no longer mentions queries at all — drop the registration.\nRegistered because: ${why}`,
    );
    assert.ok(
      !QUERIES_READ_RE.test(codeOf(file)),
      `${file} is registered as mentioning queries[] without reading it, but it now READS it. ` +
        `Move it to REGISTERED_QUERY_READERS and make it read the rejection marker.\nRegistered because: ${why}`,
    );
  }
});

test('the stripper tells a read from a mention (it is what the scan trusts)', () => {
  // A mention in a comment is not a read.
  assert.ok(!QUERIES_READ_RE.test(stripComments('// the caller\'s own `queries[]` still carries it')));
  assert.ok(!QUERIES_READ_RE.test(stripComments('/* pkg.queries in a block comment */')));
  // Prose that merely uses the word is not a read.
  assert.ok(!QUERIES_READ_RE.test(stripComments("const s = 'testing with representative queries';")));
  // Real reads: both access forms, and one inside a template interpolation.
  assert.ok(QUERIES_READ_RE.test(stripComments('const n = pkg.queries.length;')));
  assert.ok(QUERIES_READ_RE.test(stripComments("const n = pkg['queries'];")));
  assert.ok(QUERIES_READ_RE.test(stripComments('const s = `total ${pkg.queries.length}`;')));
  // Regression: a URL's `//` must not be taken for a comment and swallow the
  // read that follows it on the same line.
  assert.ok(QUERIES_READ_RE.test(stripComments("const u = 'https://x/y'; const n = pkg.queries;")));
});
