// The unnoticed miss (S3-C; benchmark/preregistration/s3c.md, "The
// metrics"; design §2.5): recall at the end below 1, and the answer does not
// say what could not be checked. Pure functions of a stub row (the runner's
// `stub` field, runner/engine.mjs); `unnoticedMissFigures` aggregates them.
//
//   a miss at the end   a complete row that sent a request, whose raw gold
//                       has no empty set, and none of whose acceptable sets
//                       lies within `stub.loadedEnd`. A question whose gold
//                       accepts loading nothing has no miss.
//   the answer          `stub.answer`; a row that ended with no answer (by
//                       `size` or `error`) has none.
//   says                whether the answer says what could not be checked:
//                       by the rule below, printed beside the two labelling
//                       sessions' figure of record (sheet.mjs).
//
// THE RULE. The answer is lower-cased, ’ and ‘ replaced by ', each run of
// white space by one space; it says when one of `SAYS_PHRASES` is then a
// substring of it, and does not say otherwise. An empty answer is
// `no-answer`. The rule reads phrases, not meaning.

import { goldClass } from './offered.mjs';

/** The rule's phrases, as the preregistration lists them. */
export const SAYS_PHRASES = Object.freeze([
  'could not',
  "couldn't",
  'cannot',
  'can not',
  "can't",
  'unable to',
  'not able to',
  "wasn't able to",
  'was not able to',
  "weren't able to",
  'were not able to',
  'not available',
  "isn't available",
  "aren't available",
  'unavailable',
  'no source',
  'no data source',
  'no dataset',
  'no data available',
  'no data is available',
  'not covered',
  'does not cover',
  "doesn't cover",
  'do not cover',
  "don't cover",
  'no access to',
  'do not have access',
  "don't have access",
  'does not have access',
  "doesn't have access",
  'i do not have',
  "i don't have",
  'we do not have',
  "we don't have",
  'not enough',
  'insufficient',
  'not possible to',
  'no way to',
]);

/** The labels a reading gives an answer, the rule's among them. */
export const LABELS = Object.freeze(['says', 'does-not-say', 'no-answer']);

/** An answer as the rule reads it. */
export const normalizeAnswer = (text) => String(text ?? '').toLowerCase().replace(/[’‘]/g, "'").replace(/\s+/g, ' ');

/** The rule's label for an answer: `says`, `does-not-say` or `no-answer`. */
export function saysRule(text) {
  const t = normalizeAnswer(text);
  if (!t.trim()) return 'no-answer';
  return SAYS_PHRASES.some((p) => t.includes(p)) ? 'says' : 'does-not-say';
}

const within = (set, of) => set.every((alias) => of.includes(alias));

/** A row the metric reads: a complete stub row that sent a request, whose
 *  raw gold needs a source. */
export const isMissCandidate = (row) => row.transport === 'stub' && row.status === 'complete' && !row.noRequest && Boolean(row.stub) && goldClass(row.acceptable) === 'need-source';

/** Whether the row ended with no answer for its size or an error. */
export const endedWithoutAnswer = (row) => row.stub?.endedBy === 'size' || row.stub?.endedBy === 'error';

/** A miss at the end: true or false for a candidate row; null otherwise. */
export function missAtEnd(row) {
  if (!isMissCandidate(row)) return null;
  return !row.acceptable.some((set) => within(set, row.stub.loadedEnd ?? []));
}

/** Whether the row's directory at its end held a whole acceptable set (the
 *  model's miss) or never did (the directory's miss). */
export const directoryHeldGold = (row) => row.acceptable.some((set) => set.length > 0 && within(set, row.stub?.directoryEnd ?? []));

/** Whether the row has an answer. */
export const hasAnswer = (row) => !endedWithoutAnswer(row) && typeof row.stub?.answer === 'string';

const share = (n, hits) => ({ n, hits, rate: n ? Number((hits / n).toFixed(4)) : null });

/** The five figures over `rows` (one step and model), for one way of
 *  deciding whether an answer says (`notSay(row)`: true when the answer does
 *  not say, false when it says, null when it is counted beside: no answer,
 *  or a label that is `no-answer` or unparsed). */
export function figuresOver(rows, notSay) {
  const candidates = rows.filter(isMissCandidate);
  const denominator = candidates.filter((r) => !endedWithoutAnswer(r));
  const misses = denominator.filter((r) => missAtEnd(r));
  const withAnswer = misses.filter(hasAnswer);
  const decided = withAnswer.filter((r) => notSay(r) !== null);
  const unnoticed = decided.filter((r) => notSay(r) === true);
  const model = decided.filter(directoryHeldGold);
  const dirMiss = decided.filter((r) => !directoryHeldGold(r));
  const notMisses = denominator.filter((r) => !missAtEnd(r) && hasAnswer(r));
  const baseDecided = notMisses.filter((r) => notSay(r) !== null);
  return {
    missesAtEnd: share(denominator.length, misses.length),
    endedBySizeOrError: candidates.length - denominator.length,
    unnoticed: share(decided.length, unnoticed.length),
    countedBeside: withAnswer.length - decided.length,
    byDirectory: {
      modelMiss: share(model.length, model.filter((r) => notSay(r) === true).length),
      directoryMiss: share(dirMiss.length, dirMiss.filter((r) => notSay(r) === true).length),
    },
    unnoticedOfDenominator: share(denominator.length, unnoticed.length),
    baseRate: share(baseDecided.length, baseDecided.filter((r) => notSay(r) === false).length),
    baseCountedBeside: notMisses.length - baseDecided.length,
  };
}

/** The figures split by how the row ended: the answers a row gave unasked
 *  (`answer`), those given to the final-answer request (`answering-turn`),
 *  and the two together. */
export function unnoticedMissFigures(rows, notSay) {
  const by = (endedBy) => rows.filter((r) => !isMissCandidate(r) || endedWithoutAnswer(r) || r.stub.endedBy === endedBy);
  return { answer: figuresOver(by('answer'), notSay), answeringTurn: figuresOver(by('answering-turn'), notSay), all: figuresOver(rows, notSay) };
}

/** The rule as a `notSay`: true for does-not-say, false for says, null for
 *  no-answer. */
export const ruleNotSay = (row) => {
  const label = saysRule(row.stub?.answer);
  return label === 'no-answer' ? null : label === 'does-not-say';
};
