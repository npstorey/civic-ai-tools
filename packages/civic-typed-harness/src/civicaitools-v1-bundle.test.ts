// The civicaitools-v1 guidance bundle (hub ADR-0038 and its amendments): the
// hub file `docs/profiles/ai-assisted-analysis/civicaitools-v1/bundle.json`,
// read from this repository, against the revision it states.
//
// WHAT IT PINS (civic-ai-tools#293; sprint anchors civic-ai-tools#294, P1,
// civic-ai-tools#309, S2-A P1, civic-ai-tools#317, S2-C P2, and
// civic-ai-tools#318, S3-A P2).
//   - The header: revision 5, the day its bytes were written, and its URL at
//     the spec tag the merge kit sets.
//   - The words a host derives where reached sources are shown: the chooser
//     sentence and the per-load reasons, which state no question put or
//     answered (website `src/lib/mcp/routing-mode.ts:301`, a declined load with
//     no pause; and `src/lib/sources/decision.ts:243-248`, `notHeld`, at
//     4777b79): a record states whether a question was put only in
//     `trace.loadSpan.loadAsked`, when it carries that attribute. They name no
//     consent setting and no "this site": the record holds an outcome for one
//     run, not a stored setting, and a second host is not the site that ran
//     the question (rulings W1 and W3, civic-ai-tools#294, 2026-11-02). The
//     one "this site" is revision 3's ruled words for a rule the showing host
//     has no words for, which is about that host's own vocabulary.
//   - The never-carried rule for the per-source consent states: no field
//     carries them, and no host derives one from a record's notebook text
//     (ruling W2).
//   - The absence rule for `environment.toolDefinitions` on a record that is
//     not `datHere`, against a record this harness derives and produce-core
//     assembles (`deriveDatHereEnvelopeFields`, then `buildEnvelope`).
//   - The system prompt entries: the final request's prompt is carried; the
//     earlier ones by trace hash only; the hash alone when the text was not
//     stored (ruling W4 for systemPromptHash).
//   - Revision 3's four added entries (`composition.considered`,
//     `trace.loadSpan.loadAsked`, `civic.packId`, `civic.loadAsked`; ADR-0033
//     amendment 3) and its revised members (`composition.components`' values
//     and sentence, `composition.routing`'s and `trace.loadSpan.loadOutcome`'s
//     sentences, and the never-carried rule for `consent.who`): the pack beside
//     its base, the shown count, and whether a question was put, stated only
//     from `tool.load_asked`. The words are the research check's, as the owner
//     ruled them (civic-ai-tools#309 comment 6706653107: R1, Q1, Q2 and A3 = A).
//   - Revision 4 (ADR-0033 amendment 4; ADR-0038's amendment of 2026-11-12):
//     the two reported keys' entries; for each of the reference producer's six
//     failure labels, for no label and for a label not among the six, the
//     words both failure entries give, none of them "refused" (G0-C5 = C,
//     civic-ai-tools#317); the three texts that said every failed call was
//     refused, corrected; the refusal rule tied to basePins and the route to a
//     pack's entry for a record without considered, in civic.packId.
//   - Revision 5 (ADR-0033 amendment 5; ADR-0038's amendment of 2026-11-13):
//     the eight entries it adds (the routing configuration, the search span's
//     four attributes and the graph's three terms), each with the seven
//     members and the class the seat ruled (Q2); the words the owner ruled
//     (OA-766, the words record p2-words.r3b.md): the chooser sentence's place
//     for a find_source call, not-offered's corrected words, the system-prompt
//     count's words for a search, the considered sentence's 'was first shown'
//     and reader-picked words; that every attribute the harness refuses on a
//     search span is named in trace.searchSpan.operationType's values, and that
//     a call stopped at the limit is given no words of a search that ran.
//   - The field set: the 48 field ids and the 7 never-carried ids. A revision
//     that adds or removes a field moves this list: revision 3 added four,
//     revision 4 two and revision 5 eight, each with an absence rule (ADR-0038
//     section 2); the assertion fails on one fewer and on one more.
//   - The digest: `bundle.md`'s SHA-256 row and the ADR-0038 text name the
//     file's own SHA-256, and `bundle.md`'s URL row names the file's URL.
//
// The words are the bundle's, stated here so a change to them is a change to
// this file too. A later revision moves the header constants and the words it
// changes; the field-set and digest tests hold across revisions.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { buildEnvelope, DEFAULT_CONTENT_TYPE } from '@typedstandards/produce-core';
import {
  TraceBuilder,
  CIVICAITOOLS_TRACE_CONFIG,
  CIVICAITOOLS_ENVIRONMENT_CONFIG,
  CIVICAITOOLS_V1_PRODUCER_PROFILE,
  COMPOSITION_EXTENSION_KEY,
  DATHERE_CONTENT_PROFILE,
  ENVIRONMENT_EXTENSION_KEY,
  hash,
  extractRunAttributes,
  deriveDatHereEnvelopeFields,
} from './index.ts';

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const BUNDLE_DIR = join(REPO_ROOT, 'docs', 'profiles', 'ai-assisted-analysis', 'civicaitools-v1');
const BUNDLE_PATH = join(BUNDLE_DIR, 'bundle.json');
const BUNDLE_MD_PATH = join(BUNDLE_DIR, 'bundle.md');
const ADR_0038_PATH = join(REPO_ROOT, 'docs', 'adr', '0038-civicaitools-v1-producer-profile-subtype.md');

// --- The revision -------------------------------------------------------------------------

const REVISION = 5;
/** ADR-0038 §5: the day the revision's bytes were written. */
const REVISION_DATE = '2026-11-13';
/** The raw address at the tag the merge kit sets on this revision's merge commit. */
const REVISION_URL =
  'https://raw.githubusercontent.com/npstorey/civic-ai-tools/v0.1.17-typed-standards-spec/docs/profiles/ai-assisted-analysis/civicaitools-v1/bundle.json';

// --- The words ----------------------------------------------------------------------------

/** Website `SOURCE_CHOOSER_TEXT.notRecorded` and `.allSources` (`src/lib/sources/copy.ts:506-507` at 4777b79). */
const NOT_RECORDED = 'What chose these sources is not recorded.';
const ALL_SOURCES = 'Every source this question could use was given to the model from the start.';

/** The reasons as ruled (W1 = A, civic-ai-tools#294 comment 6580908649). Not the website's
 *  `CHOOSER_REASONS` (`src/lib/sources/copy.ts:522-526` at 4777b79), which name the
 *  setting "Ask first" and "this site". */
const REASON_DECLINED = 'Not allowed, so it was not used for this question.';
const REASON_NO_ANSWER = 'Not used, because the site that ran this question could not ask, or no answer arrived in time.';
const REASON_UNAVAILABLE = 'Unavailable. The site that ran this question could not load it.';

/** The pack-and-author clause (D4 = A), in the chooser sentence, the components sentence and civic.packId's. */
const PACK_CLAUSE = "'{the host's name for the pack}, a pack by {author}, using {the host's name for its base}'";

const ROUTING_SENTENCE =
  "Shown wherever reached sources are shown, read from routing.method, the load spans, sourcesOffered and, when " +
  "present, considered. in-loop: 'The model chose which sources to load, from those this question could use.', " +
  "followed, when the record carries composition.considered, by that entry's sentences, then, when the trace holds " +
  "a search span, by the words of each find_source call (see trace.searchSpan.operationType), then three groups by the " +
  "host's names for the sources: 'Loaded: {loaded}', a loaded source the host resolves as a pack, as civic.packId " +
  `says, named ${PACK_CLAUSE}; ` +
  "'Requested, not loaded: {source} — {its last load's reason}', " +
  "one line each; 'Not requested: {the sources whose reason is configured, selected or not-consented, with no load}'; " +
  "an empty group says 'none'. Beside it the host " +
  "MAY say 'from a source list given by {router component id} {version}'. " +
  `absent: '${NOT_RECORDED}' all-sources, only if a record of this producer ever states that method: '${ALL_SOURCES}'`;

const LOAD_OUTCOME_SENTENCE =
  "Per load, the reason the chooser sentence gives for a source in its 'Requested, not loaded' group, read from " +
  `that source's last load: declined '${REASON_DECLINED}'; no-answer '${REASON_NO_ANSWER}'; ` +
  `unavailable '${REASON_UNAVAILABLE}' ` +
  'No reason states whether a question was put or answered: a record states whether one was put only in ' +
  "trace.loadSpan.loadAsked, when it carries that attribute, and that entry's words are the only words for it. " +
  "loaded places the source in the 'Loaded' group; not-offered 'it asked for {alias}, which was not on its list of " +
  "sources at the time'. The outcome tells 'the model wanted this source and did not get it' from 'the model never asked'.";

const LOAD_OUTCOME_VALUES =
  'One of loaded, declined, no-answer, unavailable, not-offered (LOAD_OUTCOMES, format/vocabulary.ts). ' +
  'loaded: the source\'s guidance and tools were added. ' +
  "declined: the source needed the reader's permission for this run and was not used; the reader answered Not " +
  'now, or the producer held no pause in which to ask (website src/lib/mcp/routing-mode.ts:301 at 4777b79). ' +
  'no-answer: no decision arrived; the reader did not answer in time, or could not be asked (website ' +
  'src/lib/sources/decision.ts:243-248 at 4777b79). ' +
  'unavailable: the instance could not offer the source for a reason known without contacting it. ' +
  "not-offered: the call named no alias, or its alias named no source in the run's directory when the call was made.";

const TOOL_DEFINITIONS_ABSENT =
  'Key omitted when the producer does not know the tools the run offered. Records published before harness 0.7.0 ' +
  'carry the placeholder [] and are not re-labelled. On a record whose metadata.contentProfile is not datHere ' +
  "(this producer's hash-only records carry default), the whole org.civicaitools.environment block is absent, " +
  'because the harness emits it only for datHere (spec section 8.7.1; harness format/dathere.ts:821-835); that ' +
  'absence states nothing about the tools.';

/** Website `SYSTEM_PROMPT_TEXT` (`src/lib/sources/copy.ts:587-615` at 4777b79). */
const PROMPT_NOT_CARRIED =
  'This record does not include the text of the system prompt (the instructions the model was given before the question).';
const PROMPT_NOT_CARRIED_NOR_HASH =
  'This record does not include the text of the system prompt (the instructions the model was given before the question), or a hash of it.';
/** Revision 5 (U2): a search can recompose the prompt without a load; the website's copy takes these words in S3-B. */
const PROMPT_MANY = 'The model was given {count} system prompts during this question. This section describes the last one.';
const PROMPT_INTRO_BLOB =
  'The text of the system prompt the model was given, kept outside the signed record. It is shown only if it matches the hash this record states.';
const PROMPT_INTRO_INLINE = 'The text of the system prompt the model was given, as the signed record includes it.';

/** P1b's rules (website `src/lib/evidence/prompt-blob.ts` at 4777b79), as criterion 6 names them. */
const SKILL_TEXT_FINAL_PROMPT = "the final request's system prompt";
const SKILL_TEXT_EARLIER_PROMPTS =
  'on an in-loop run whose loads or searches recomposed the prompt, the earlier prompts are not carried as text and each is ' +
  'identified by gen_ai.system_prompt_hash on its llm_inference span';
const SKILL_TEXT_WRITE_FAILED =
  'a new record carries systemPromptHash with no skillText when the run-end write of the text failed';
/** Ruling W4 (the seat's record, civic-ai-tools#294 comment 6580229504). */
const PROMPT_HASH_BESIDE =
  "beside the skillText BlobRef when the text was stored (see skillMetadata.skillText's absence rule)";

/** Ruling W2 = C: the field-level "never" kept, the notebook-text case and the no-derivation rule added. */
const PER_SOURCE_STATES_RULE =
  'Never enters a record as a field. sourcesOffered[].reason states the state\'s effect on the run (reader-off, ' +
  'not-consented), which is an outcome for one run and not the stored state. A record\'s notebook text, written at ' +
  'run time, may name the setting the site applied (the reference host\'s notebook says a declined source was ' +
  "'not used, set to Ask first', website src/lib/notebook-author/tool-to-cell.ts:1169 at 4777b79); no host derives " +
  'a consent state from that text or from any other part of a record, and a host never reconstructs the consent ' +
  'panel from a record.';

/** Revision 3's words, as the research check gave them and the owner ruled (civic-ai-tools#309 comment 6706653107). */
const UNKNOWN_RULE_WORDS = "which this site has no words for";
/** Revision 5's words (OA-766): 'was first shown' after a search that returned a source, and the reader-picked words. */
const CONSIDERED_SENTENCE =
  "Shown beside the chooser sentence (see composition.routing): first 'The model was shown {listed} of the {total} sources in the source inventory {the host's name for the inventory, or its id as written} (version {version}).', then the rule's words. On a record whose trace holds a search that returned a source (a search span whose outcome is searched and whose hits are not []), the first sentence says 'was first shown' in place of 'was shown': such a search may have added sources after the first list, and listed does not count them. For directory-set, version 1: 'Those were the sources set up on the site that ran this question, less any turned off for it.' For reader-picked, version 1: 'The person who asked this question picked those sources. A picked source was left out if it was turned off, or not set up on the site that ran this question.' The second of these states the rule: the record does not say whether any pick was left out, and a host names no pick from considered. A rule, or a ruleVersion, the host has no words for is named as written: 'They were chosen by a rule recorded as {rule}, version {ruleVersion}, " + UNKNOWN_RULE_WORDS +
  ".'; a host never reads an unknown rule as a known one. Absent: no count is stated, and a host never derives one from sourcesOffered, whose entries are the manifest's, not the inventory's.";
const CONSIDERED_ABSENT =
  "Key omitted when the run's root span carried no analysis.considered: every record before harness 0.12.0, and " +
  'every record whose producer did not state the inventory it routed against. Absent reads as not recorded: never ' +
  "as every source shown, and never as the hub's current inventory.";
const PACK_ID_SENTENCE =
  "'{the host's name for the pack}, a pack by {author}, using {the host's name for the base}', beside the call. " +
  "The host resolves the pack's name and author only from the pack's inventory entry: in the inventory " +
  "composition.considered names, at its tag with its hash checked, by the entry of that id; or, on a record that " +
  "carries no considered, in the hub's inventory versions, each read at its tag civic-inventory/<version> with " +
  "its hash checked, or in a copy of them, by the entry of that id whose hash begins with the twelve characters " +
  "after the + in the version of the pack's composition.components entry (ADR-0039, " +
  "docs/adr/0039-route-identity-conventions.md). Every fact " +
  "the host reads from the entry is inside that hash, so any version holding the entry gives the same facts. " +
  "When it finds no such entry, the host says 'a pack recorded as {packId}, using {the host's name for the " +
  "base}' and names no author. The record never spells the pack's name or author. When the entry states " +
  "basePins, beside a call that carries no civic:failed a host MAY say 'The site that ran this question checked " +
  "{base} before sending this call. {base} reported the name, version and tool inputs that {pack} was written " +
  "for.', {base} and {pack} being the host's names for the base and the pack.";
const LOAD_ASKED_SENTENCE =
  "Whether the site that ran the question asked the person running it whether to use this load's source, in this " +
  "run. Only when the value is true MAY a host say, on the source's line in the chooser sentence, 'The site that ran " +
  "this question asked whether to use {source}.'; only when it is false, 'The site that ran this question did not " +
  "ask whether to use {source}.'; when it is absent, the host says nothing about a question. {source} is the host's " +
  "name for the source, or the alias as written when no source has it. The value is read from the same load as the " +
  "source's reason, its last load. The reasons of trace.loadSpan.loadOutcome are unchanged and state no question " +
  'either way.';
/** Q2 = A: the pack's `+hash12` is the hash its inventory entry states, which the inventory schema defines. */
const PACK_HASH12_WORDS =
  "the first twelve hex characters of the hash its inventory entry states (hash), whose coverage is the inventory " +
  "schema's definition, not this bundle's";
const CONSENT_WHO_RULE =
  'Never enters a record of this subtype and no host states it from one. The consent itself is kept in the app\'s ' +
  'own store (the MCP-sources design, sections 1.6 and 4.4; ADR-0036). A record states only that a load was asked ' +
  'for, how it ended, and, where it carries trace.loadSpan.loadAsked, whether a question was put; never who ' +
  'answered it.';

/** Revision 4's failure words (G0-C5 = C): one per label of the reference producer, following the reference
 *  host's FAILURE_REASON (website `src/lib/notebook-author/tool-to-cell.ts:795-803` at f0c1eca), and for
 *  base_changed that the site did not send the call (C9 = A). */
const FAILURE_WORDS: Record<string, string> = {
  timeout: '{source} did not respond in time, so this call returned no data.',
  unavailable: '{source} could not be reached or could not answer, so this call returned no data.',
  not_configured: 'No live data source was configured for this call, so it returned no data.',
  not_offered: 'This question was not using this data source at the time, so nothing was sent to it.',
  unknown: 'The request could not be completed, so it returned no data.',
  base_changed: 'The site that ran this question did not send this call: {source} did not match what {pack} was written for.',
};
/** The reference producer's six labels, in the order the entries list them. */
const FAILURE_LABELS = ['timeout', 'unavailable', 'not_configured', 'not_offered', 'unknown', 'base_changed'];
/** A failed call with no label reads as unknown does (tool-to-cell.ts:814 at f0c1eca). */
const NO_LABEL_WORDS = 'with no civic:failureKind, the words for unknown';
/** A label not among the six: no cause and no refuser, the label as written. */
const UNLISTED_WORDS = 'This call returned no data. It was recorded as {failureKind}.';
/** civic.failureKind's sentence points to civic.failed's words: one copy, not two (the research check's row 17). */
const FAILURE_KIND_SENTENCE =
  "The words civic.failed's sentence gives for the label, for a failed call with no label and for a label not among " +
  "the six. A host never switches on the value exhaustively or treats an unknown one as invalid.";
/** Q2 = (a): the answered-by sentences are given only on a call that carries no civic:failed. */
const SOURCE_ID_SENTENCE =
  "'{the host's name for sourceId} answered this call.', only on a call that carries no civic:failed; civic.failed's words say how a failed call ended. The host resolves the id against its own manifest; the record never spells the reader-facing name.";
const SERVER_ID_SENTENCE =
  "'Answered by {serverId}', only on a call that carries no civic:failed, joined to the component of the same id for its version and guidance hash.";
/** Q2 = (a), the seat's third sentence (#317 comment 6825615082): the agent-level answered-by sentence. */
const SERVER_URL_SENTENCE =
  "'Answered by {source} at {serverUrl host}.', only when at least one activity associated with that agent " +
  "(prov:wasAssociatedWith) carries no civic:failed; when every one carries civic:failed, the host gives no " +
  "answered-by sentence for the agent, and civic.failed's words say how each of its calls ended.";
/** Revision 3's words, which said every failed call was refused (bundle.json:160, :169 at revision 3). */
const REVISION_3_FAILED_SENTENCE = "'{source} refused this call.' Nothing when absent.";
const REVISION_3_FAILURE_KIND_SENTENCE =
  "'{source} refused this call ({failureKind}).' A host never switches on the value exhaustively or treats an unknown one as invalid.";

/** The words a failure entry's sentence gives for `label`, or undefined when it gives none of its own. */
function wordsFor(sentence: string, label: string): string | undefined {
  const match = new RegExp(`(?:^|[:;] )${label} '([^']*(?:'[^';]*)*?)'(?=; |$)`).exec(sentence);
  return match?.[1];
}

/** The refusal rule (C9 = A item 1), in civic.packId's values. */
const REFUSAL_RULE =
  "When the pack's inventory entry states basePins, this producer sent the pack's calls only after the base's " +
  'reported name and version and the argument schemas of the base tools the pin names equalled one of those pins';

/** The two entries revision 4 added (ADR-0033 amendment 4). */
const REVISION_4_ADDED = ['composition.components.reportedName', 'composition.components.reportedVersion'];

// --- The field set ------------------------------------------------------------------------

const FIELD_IDS = [
  'composition.assertedDate', 'composition.sourcesOffered', 'composition.components',
  'composition.components.reportedName', 'composition.components.reportedVersion', 'composition.flowsStatement',
  'composition.routing', 'composition.definitionHash', 'composition.considered', 'composition.routingConfiguration',
  'environment.toolDefinitions', 'notebook.execution', 'notebook.summary', 'notebook.provenance',
  'trace.loadSpan.operationType', 'trace.loadSpan.loadOutcome', 'trace.loadSpan.loadAsked',
  'trace.searchSpan.operationType', 'trace.searchSpan.searchOutcome', 'trace.searchSpan.searchQuery',
  'trace.searchSpan.searchHits', 'civic.failed', 'civic.failureKind', 'civic.contentHash', 'civic.serverUrl',
  'civic.sourceId', 'civic.url', 'civic.promptTokens', 'civic.completionTokens', 'civic.toolName',
  'civic.operationType', 'civic.datasetId', 'civic.portalDomain', 'civic.datasetUrl', 'civic.croissantMetadataUrl',
  'civic.responseRows', 'civic.durationMs', 'civic.upstreamToolName', 'civic.sourceAlias', 'civic.serverId',
  'civic.packId', 'civic.loadOutcome', 'civic.loadAsked', 'civic.searchOutcome', 'civic.searchQuery',
  'civic.searchHits', 'skillMetadata.skillText', 'skillMetadata.systemPromptHash',
];
/** The four entries revision 3 added (ADR-0033 amendment 3). */
const REVISION_3_ADDED = ['composition.considered', 'trace.loadSpan.loadAsked', 'civic.packId', 'civic.loadAsked'];
const NEVER_CARRIED_IDS = [
  'consent.who', 'consent.when', 'consent.account', 'consent.perSourceStates', 'consent.flowsVersionRow',
  'consent.sessionCookie', 'flowsStatement.text',
];

// --- Readers ------------------------------------------------------------------------------

interface BundleField {
  id: string;
  path: string;
  values: string;
  absent: string;
  carriedBy: string;
  sentence: string;
  class: 'shows' | 'may-show' | 'never-invents';
}

interface Bundle {
  revision: number;
  date: string;
  url: string;
  fields: BundleField[];
  neverCarried: Array<{ id: string; fact: string; rule: string }>;
}

function bundleBytes(): Buffer {
  return readFileSync(BUNDLE_PATH);
}

function readBundle(): Bundle {
  return JSON.parse(bundleBytes().toString('utf8')) as Bundle;
}

function field(id: string): BundleField {
  const entry = readBundle().fields.find((f) => f.id === id);
  assert.ok(entry, `the bundle has an entry ${id}`);
  return entry;
}

/** A row of `bundle.md`'s header table: `| <label> | <value> |`. */
function bundleMdRow(label: string): string {
  const row = readFileSync(BUNDLE_MD_PATH, 'utf8')
    .split('\n')
    .find((line) => line.startsWith(`| ${label} |`));
  assert.ok(row, `bundle.md has a "${label}" row`);
  return row.slice(`| ${label} |`.length).replace(/\|\s*$/, '').trim();
}

// --- Criterion 1: the header --------------------------------------------------------------

test('civicaitools-v1 bundle: the header states revision 5, the day its bytes were written, and its URL at the v0.1.17 spec tag', () => {
  const bundle = readBundle();
  assert.equal(bundle.revision, REVISION);
  assert.equal(bundle.date, REVISION_DATE);
  assert.equal(bundle.url, REVISION_URL);
});

// --- Criterion 2: the words ---------------------------------------------------------------

test('civicaitools-v1 bundle: the chooser sentence is the website\'s, and its absent and all-sources sentences equal SOURCE_CHOOSER_TEXT', () => {
  assert.equal(field('composition.routing').sentence, ROUTING_SENTENCE);
});

test('civicaitools-v1 bundle: the declined, no-answer and unavailable reasons are the ruled words and claim no question put', () => {
  const entry = field('trace.loadSpan.loadOutcome');
  assert.equal(entry.sentence, LOAD_OUTCOME_SENTENCE);
  assert.ok(entry.sentence.includes(`declined '${REASON_DECLINED}'`));
  assert.ok(entry.sentence.includes(`no-answer '${REASON_NO_ANSWER}'`));
  assert.ok(entry.sentence.includes(`unavailable '${REASON_UNAVAILABLE}'`));
});

test('civicaitools-v1 bundle: the load outcomes\' values state both ways a load is declined and both ways no answer arrives', () => {
  assert.equal(field('trace.loadSpan.loadOutcome').values, LOAD_OUTCOME_VALUES);
});

test('civicaitools-v1 bundle: the groups the other entries name are the chooser sentence\'s three', () => {
  assert.ok(field('composition.sourcesOffered').sentence.startsWith("Supplies the 'Not requested' group of the chooser sentence"));
  assert.ok(field('trace.loadSpan.operationType').sentence.includes("the chooser sentence's 'Loaded' and 'Requested, not loaded' groups"));
  const named = readBundle().fields.filter((f) => /never-asked|asked groups/.test(f.sentence)).map((f) => f.id);
  assert.deepEqual(named, [], 'no entry names a group of revision 1');
});

test('civicaitools-v1 bundle: no sentence of any class states a reader\'s answer, names Ask first, or says this site', () => {
  const bundle = readBundle();
  assert.ok(bundle.fields.some((f) => f.class === 'shows'));
  const stating = bundle.fields.flatMap((entry) =>
    ['you said no', "the reader's answer", 'ask first', 'this site']
      // The one ruled "this site" names the showing host's own vocabulary, not the site that ran the question.
      .filter((phrase) => entry.sentence.replace(UNKNOWN_RULE_WORDS, '').toLowerCase().includes(phrase))
      .map((phrase) => `${entry.id} (${entry.class}): "${phrase}"`),
  );
  assert.deepEqual(stating, []);
  assert.equal(field('composition.considered').sentence.split(UNKNOWN_RULE_WORDS).length, 2, 'the ruled phrase, once');
});

// --- Revision 3: the inventory, the pack's credit, whether a question was put ------------

test('civicaitools-v1 bundle: composition.considered names the inventory by id, the version form and the hash\'s resolution, and pins no inventory', () => {
  const entry = field('composition.considered');
  assert.equal(entry.class, 'shows');
  assert.equal(entry.path, 'extensions["org.civicaitools.composition"].considered');
  assert.ok(entry.values.startsWith('{ inventory: { id, version, hash }, total, listed, rule, ruleVersion }, keys in that order'));
  assert.ok(entry.values.includes('<YYYY-MM-DD>.<n>+<hash12>'), 'the build-metadata form');
  assert.ok(entry.values.includes('civic-inventory/<YYYY-MM-DD>.<n>'), 'the tag a reader resolves');
  assert.ok(entry.values.includes(".sha256 sibling"), 'the hash file');
  assert.ok(entry.values.includes("canonical JSON of the parsed inventory file, not of its bytes"));
  assert.ok(entry.values.includes('this bundle names no inventory version or hash'));
  // No inventory version's hash in any member: a new inventory version is not a bundle revision.
  assert.doesNotMatch(JSON.stringify(entry), /[0-9a-f]{64}/);
  assert.doesNotMatch(JSON.stringify(entry), /\d{4}-\d{2}-\d{2}\.\d+\+/);
  assert.equal(entry.absent, CONSIDERED_ABSENT);
  assert.equal(entry.sentence, CONSIDERED_SENTENCE);
});

test('civicaitools-v1 bundle: the pack is credited beside its base, in components, in the chooser sentence and in civic.packId', () => {
  const components = field('composition.components');
  assert.ok(components.values.includes('A pack (an inventory entry whose calls go to a base server with fixed arguments) is one entry of its own'));
  assert.ok(components.values.includes('version <version>+<hash12>'));
  assert.ok(components.values.includes(PACK_HASH12_WORDS), 'Q2 = A: the hash its inventory entry states');
  assert.ok(!components.values.includes('SHA-256 of its text'));
  assert.ok(components.values.includes("Its base's entry is present whenever the pack's is"));
  assert.ok(components.sentence.includes(`a pack's entry is named ${PACK_CLAUSE}, then its version`));
  assert.ok(field('composition.routing').sentence.includes(`named ${PACK_CLAUSE}`));
  const packId = field('civic.packId');
  assert.equal(packId.sentence, PACK_ID_SENTENCE);
  assert.ok(packId.values.includes("verbatim from the span's mcp.pack_id"));
  assert.ok(packId.values.includes('The key follows civic:serverId.'));
  // A3 = A, as C9 = A widens it: the name and author come only from the pack's inventory entry; otherwise the id, and no author.
  assert.ok(packId.sentence.includes("only from the pack's inventory entry: in the inventory composition.considered names, at its tag with its hash checked"));
  assert.ok(components.sentence.includes('resolves the pack\'s name and author only from that inventory'));
});

test('civicaitools-v1 bundle: whether a question was put is stated only from tool.load_asked, and the outcome reasons still state none', () => {
  const span = field('trace.loadSpan.loadAsked');
  assert.equal(span.sentence, LOAD_ASKED_SENTENCE);
  assert.ok(span.path.endsWith('attributes[key="tool.load_asked"]'));
  assert.ok(span.values.includes("A repeat load of a source in the same run states the first load's value"));
  assert.ok(span.absent.includes('absent reads as not recorded, never as false'));
  const graph = field('civic.loadAsked');
  assert.ok(graph.values.includes("after civic:loadOutcome, the activity's last key"));
  assert.ok(field('civic.loadOutcome').values.includes("the activity's last key but civic:loadAsked"));
  assert.ok(span.values.includes('A producer that cannot tell whether a question was put omits the attribute.'));
  // The reasons are unchanged: none of them says a question was put, and the outcome's entry points at this one.
  assert.equal(field('trace.loadSpan.loadOutcome').sentence, LOAD_OUTCOME_SENTENCE);
  const consentWho = readBundle().neverCarried.find((n) => n.id === 'consent.who');
  assert.equal(consentWho?.rule, CONSENT_WHO_RULE);
});

// --- Revision 4: the reported keys, the failure words, the refusal rule and the route -----

test('civicaitools-v1 bundle: civic.failed gives words for each of the six labels, civic.failureKind points to them, and none says refused', () => {
  // civic.failed's sentence carries the words; civic.failureKind's points to them.
  const sentence = field('civic.failed').sentence;
  for (const label of FAILURE_LABELS) {
    assert.equal(wordsFor(sentence, label), FAILURE_WORDS[label], `civic.failed: the words for ${label}`);
  }
  assert.ok(sentence.includes(NO_LABEL_WORDS), 'civic.failed: an absent label reads as unknown');
  assert.ok(sentence.includes(`a label not among these six, '${UNLISTED_WORDS}', the label as written`), 'civic.failed: the unlisted label');
  // Six labels with words of their own, and no seventh.
  assert.deepEqual(FAILURE_LABELS.filter((label) => wordsFor(sentence, label) !== undefined), FAILURE_LABELS);
  assert.ok(sentence.includes('the host gives the words for unknown'), 'a {source} with no name reads as unknown');
  const kindSentence = field('civic.failureKind').sentence;
  assert.equal(kindSentence, FAILURE_KIND_SENTENCE);
  for (const each of [sentence, kindSentence]) {
    assert.doesNotMatch(each, /refused this call/i, "revision 3's words are gone");
  }
  for (const words of [...Object.values(FAILURE_WORDS), UNLISTED_WORDS]) {
    assert.doesNotMatch(words, /refus/i, words);
  }
  // base_changed says the site did not send the call; unknown says the request could not be completed.
  assert.match(FAILURE_WORDS.base_changed!, /^The site that ran this question did not send this call/);
  assert.match(FAILURE_WORDS.unknown!, /^The request could not be completed/);
  // The unlisted label's words name no cause and no refuser.
  assert.doesNotMatch(UNLISTED_WORDS, /source|site|server|refus|reject|sent/i);
});

test('civicaitools-v1 bundle: revision 3\'s two sentences give no label words of their own, only the refused words (decoy)', () => {
  for (const sentence of [REVISION_3_FAILED_SENTENCE, REVISION_3_FAILURE_KIND_SENTENCE]) {
    assert.deepEqual(FAILURE_LABELS.filter((label) => wordsFor(sentence, label) !== undefined), []);
    assert.match(sentence, /^'\{source\} refused this call/);
  }
});

test('civicaitools-v1 bundle: the three texts that said every failed call was refused, and the three answered-by sentences, are corrected', () => {
  const failed = field('civic.failed').values;
  assert.ok(!failed.includes('the source refused the call;'), 'civic.failed values');
  assert.ok(failed.includes('or was never sent the call'));
  assert.ok(failed.includes('this producer also marks failed a call the source did not answer and one the producer did not send'));
  assert.ok(failed.includes('Spec section 8.1.8 defines a failed call as one rejected by the source'));
  const kind = field('civic.failureKind');
  assert.ok(!kind.absent.includes('is not a rejection'), 'civic.failureKind absent');
  assert.ok(kind.absent.includes('A failed call with no kind reads as unknown does.'));
  assert.ok(kind.values.includes("the reference producer's six values are timeout, unavailable, not_configured, not_offered, unknown and base_changed"));
  assert.ok(!kind.values.includes('four values'));
  const duration = field('civic.durationMs').values;
  assert.ok(!duration.includes('the source refused'), 'civic.durationMs values');
  assert.ok(duration.includes('on a call the producer did not send, the time until its own refusal'));
  // Q2 = (a): the answered-by sentences are not given on a failed call.
  assert.equal(field('civic.sourceId').sentence, SOURCE_ID_SENTENCE);
  assert.equal(field('civic.serverId').sentence, SERVER_ID_SENTENCE);
  for (const id of ['civic.sourceId', 'civic.serverId']) {
    assert.ok(field(id).sentence.includes('only on a call that carries no civic:failed'), id);
  }
  assert.equal(field('civic.serverUrl').sentence, SERVER_URL_SENTENCE);
  assert.ok(field('civic.serverUrl').sentence.includes('only when at least one activity associated with that agent'));
});

test('civicaitools-v1 bundle: civic.packId states the refusal rule, tied to basePins, and the route for a record without considered', () => {
  const packId = field('civic.packId');
  assert.ok(packId.values.includes(REFUSAL_RULE), 'the refusal rule');
  assert.ok(packId.values.includes('labelled base_changed'));
  assert.equal(packId.sentence, PACK_ID_SENTENCE);
  assert.ok(packId.sentence.includes('on a record that carries no considered'));
  assert.ok(packId.sentence.includes('civic-inventory/<version> with its hash checked, or in a copy of them'));
  assert.ok(packId.sentence.includes('the twelve characters after the + in the version'));
  assert.ok(field('composition.components').sentence.includes("from the inventory entry it finds as civic.packId says"));
});

test('civicaitools-v1 bundle: the reported keys are entries of their own, after composition.components, on a remote server\'s entry only', () => {
  const ids = readBundle().fields.map((f) => f.id);
  assert.deepEqual(ids.slice(ids.indexOf('composition.components'), ids.indexOf('composition.components') + 3), ['composition.components', ...REVISION_4_ADDED]);
  for (const id of REVISION_4_ADDED) {
    const entry = field(id);
    const key = id.split('.').pop()!;
    assert.equal(entry.class, 'may-show', id);
    assert.equal(entry.path, `extensions["org.civicaitools.composition"].components[].${key}`, id);
    assert.ok(entry.values.includes("On a remote server's entry only"), id);
    assert.ok(entry.absent.includes('Key omitted when this producer held no report from the server when it wrote the entry'), id);
    assert.ok(!(entry.values + entry.absent).includes('for this run') && !entry.absent.includes('for the run'), `${id}: no per-run claim`);
    assert.ok(entry.absent.includes('on every record before harness 0.13.0'), id);
    assert.ok(entry.carriedBy.includes('reported-keys-golden.json'), id);
    assert.deepEqual(Object.keys(entry), ['id', 'path', 'values', 'absent', 'carriedBy', 'sentence', 'class'], id);
  }
  assert.ok(field('composition.components.reportedName').sentence.includes("'The server for {name} reported itself as {reportedName} {reportedVersion}.'"));
  assert.ok(field('composition.components.reportedName').values.includes('which may have been made for an earlier run'));
  assert.ok(field('composition.components.reportedName').sentence.includes('nothing in the record checks it against the entry\'s id'));
  assert.ok(field('composition.components').values.includes('{ id, version?, guidanceHash?, guidanceOrigin?, reportedName?, reportedVersion? }'));
});

test('civicaitools-v1 bundle: each entry revision 3 added carries the seven members and an absence rule', () => {
  for (const id of REVISION_3_ADDED) {
    const entry = field(id);
    assert.deepEqual(Object.keys(entry), ['id', 'path', 'values', 'absent', 'carriedBy', 'sentence', 'class'], id);
    assert.ok(entry.absent.length > 0 && entry.carriedBy.includes('considered-golden.json'), id);
  }
});

// --- Criterion 3: the environment block on a record that is not datHere ------------------

/** A run whose root span states the tools offered, as the reference host's traces do. */
function traceWithTools(): Record<string, unknown> {
  let ms = 300_000;
  let counter = 0;
  const tb = new TraceBuilder({
    ...CIVICAITOOLS_TRACE_CONFIG,
    now: () => (ms += 250),
    randomBytes: (n: number) => {
      const out = new Uint8Array(n);
      for (let i = 0; i < n; i++) out[i] = 0xa0 + ((counter++ * 11) % 0x50);
      return out;
    },
  });
  tb.startRoot('civic_analysis', { 'query.text_hash': hash('A question.') });
  const request = tb.startSpan('llm_inference', undefined, { 'gen_ai.inference_index': '0' });
  tb.endSpan(request, { 'gen_ai.response.prompt_tokens': 10, 'gen_ai.response.completion_tokens': 2 });
  tb.endRoot({
    'analysis.mcp_servers': JSON.stringify([{ url: 'https://socrata-mcp.example', name: 'socrata' }]),
    'analysis.tool_definitions': JSON.stringify([{ type: 'function', function: { name: 'load_source', parameters: { type: 'object' } } }]),
    'analysis.sources_offered': JSON.stringify([{ sourceId: 'socrata', alias: 'socrata', reason: 'selected' }]),
  });
  return tb.finalize() as unknown as Record<string, unknown>;
}

/** Derive (`deriveDatHereEnvelopeFields`) and assemble (`buildEnvelope`) a record of that run under one content profile. */
function recordUnder(contentProfile: string): Record<string, unknown> {
  const trace = traceWithTools();
  const fields = deriveDatHereEnvelopeFields(
    {
      model: 'test-model',
      contentProfile,
      producerProfile: CIVICAITOOLS_V1_PRODUCER_PROFILE,
      // A datHere record's content hash covers its notebook; a skeleton one is enough here.
      ...(contentProfile === DATHERE_CONTENT_PROFILE
        ? { extensions: { 'org.civicaitools.notebook': { nbformat: 4, nbformat_minor: 5, cells: [], metadata: {} } } }
        : {}),
      ...extractRunAttributes(trace),
    },
    CIVICAITOOLS_ENVIRONMENT_CONFIG,
  );
  const { pkg } = buildEnvelope({
    packageId: '00000000-0000-4000-8000-0000000000d1',
    createdAt: '2026-11-02T00:00:00.000Z',
    signingKeyId: 'platform:test-key-1',
    prompt: 'A question.',
    promptVisibility: contentProfile === DATHERE_CONTENT_PROFILE ? 'full_text' : 'hash_only',
    queries: [],
    dataSources: [],
    cost: { model: 'test-model' },
    skillMetadata: {},
    output: 'An answer.',
    trace,
    captureMethod: 'chat-flow-stream',
    contentProfile,
    type: DEFAULT_CONTENT_TYPE,
    producerProfile: fields.producerProfile,
    contentCanonicalization: fields.contentCanonicalization,
    extensions: fields.extensions,
  });
  return pkg as unknown as Record<string, unknown>;
}

test('civicaitools-v1 bundle: a default record of a run that stated its tools carries no environment block, and the absence rule names that case', () => {
  const entry = field('environment.toolDefinitions');
  assert.ok(entry.path.startsWith(`extensions["${ENVIRONMENT_EXTENSION_KEY}"]`), entry.path);

  const hashOnly = recordUnder('default');
  const extensions = hashOnly.extensions as Record<string, unknown>;
  assert.equal((hashOnly.metadata as Record<string, unknown>).contentProfile, 'default');
  assert.equal(Object.hasOwn(extensions, ENVIRONMENT_EXTENSION_KEY), false, 'no environment block on a default record');
  assert.ok(Object.hasOwn(extensions, COMPOSITION_EXTENSION_KEY), 'the composition block is there');
  // The same run under datHere states the tools: the absence is the content profile's, not the producer's.
  const fullText = recordUnder(DATHERE_CONTENT_PROFILE);
  const environment = (fullText.extensions as Record<string, Record<string, unknown>>)[ENVIRONMENT_EXTENSION_KEY];
  assert.ok(environment, 'a datHere record of the same run carries the environment block');
  assert.equal((environment.toolDefinitions as unknown[]).length, 1);

  assert.equal(entry.absent, TOOL_DEFINITIONS_ABSENT);
  assert.ok(entry.absent.includes('metadata.contentProfile is not datHere'));
  assert.ok(entry.absent.includes(`the whole ${ENVIRONMENT_EXTENSION_KEY} block is absent`));
});

// --- Criterion 6: the system prompt -------------------------------------------------------

test('civicaitools-v1 bundle: skillText states the final prompt, the earlier ones by trace hash, and the hash alone when the write failed', () => {
  const entry = field('skillMetadata.skillText');
  assert.ok(entry.values.includes(SKILL_TEXT_FINAL_PROMPT), 'values names the final request\'s prompt');
  assert.ok(entry.values.includes(SKILL_TEXT_EARLIER_PROMPTS), 'values names the earlier prompts by trace hash');
  assert.ok(!entry.values.includes('On every new record of this producer'), 'values no longer says every new record carries the BlobRef');
  assert.ok(entry.absent.includes(SKILL_TEXT_WRITE_FAILED), 'absent names the failed write');
});

test('civicaitools-v1 bundle: skillText\'s sentence is the website\'s SYSTEM_PROMPT_TEXT', () => {
  const sentence = field('skillMetadata.skillText').sentence;
  for (const words of [PROMPT_NOT_CARRIED, PROMPT_NOT_CARRIED_NOR_HASH, PROMPT_MANY, PROMPT_INTRO_BLOB, PROMPT_INTRO_INLINE]) {
    assert.ok(sentence.includes(`'${words}'`), `the sentence quotes: ${words}`);
  }
  assert.ok(!sentence.includes('hypotheses'), 'no words are marked as hypotheses');
});

test('civicaitools-v1 bundle: systemPromptHash is carried beside the BlobRef only when the text was stored', () => {
  assert.ok(field('skillMetadata.systemPromptHash').absent.includes(PROMPT_HASH_BESIDE));
});

// --- Ruling W2: the per-source consent states -------------------------------------------

test('civicaitools-v1 bundle: no field carries the consent states, and no host derives one from notebook text', () => {
  const entry = readBundle().neverCarried.find((n) => n.id === 'consent.perSourceStates');
  assert.ok(entry, 'the never-carried list has consent.perSourceStates');
  assert.equal(entry.fact, "The reader's per-source consent states (On, Ask first, Off) as stored.");
  assert.equal(entry.rule, PER_SOURCE_STATES_RULE);
  assert.ok(entry.rule.includes("A record's notebook text, written at run time, may name the setting the site applied"));
  assert.ok(entry.rule.includes('no host derives a consent state from that text'));
});

// --- Criterion 7: the field set and the digest -------------------------------------------

/** The field-set assertion, over any bundle: the ids in order, the never-carried ids, seven members each. */
function assertFieldSet(bundle: Bundle): void {
  assert.deepEqual(bundle.fields.map((f) => f.id), FIELD_IDS);
  assert.deepEqual(bundle.neverCarried.map((n) => n.id), NEVER_CARRIED_IDS);
  for (const entry of bundle.fields) {
    assert.deepEqual(Object.keys(entry), ['id', 'path', 'values', 'absent', 'carriedBy', 'sentence', 'class'], entry.id);
  }
}

test('civicaitools-v1 bundle: the 48 field ids and the 7 never-carried ids', () => {
  assert.equal(FIELD_IDS.length, 48);
  assert.equal(NEVER_CARRIED_IDS.length, 7);
  assertFieldSet(readBundle());
});

test('civicaitools-v1 bundle: the field-set assertion fails on 47 fields and on 49 (decoy)', () => {
  const bundle = readBundle();
  const fewer = { ...bundle, fields: bundle.fields.filter((f) => f.id !== 'civic.packId') };
  const more = { ...bundle, fields: [...bundle.fields, { ...bundle.fields[0]!, id: 'composition.extra' }] };
  assert.equal(fewer.fields.length, 47);
  assert.equal(more.fields.length, 49);
  assert.throws(() => assertFieldSet(fewer), assert.AssertionError);
  assert.throws(() => assertFieldSet(more), assert.AssertionError);
});

test('civicaitools-v1 bundle: bundle.md and ADR-0038 name the file\'s own SHA-256 and URL', () => {
  const bundle = readBundle();
  const digest = createHash('sha256').update(bundleBytes()).digest('hex');
  assert.equal(bundleMdRow('SHA-256 of `bundle.json`'), `\`${digest}\``);
  assert.equal(bundleMdRow('URL'), `\`${bundle.url}\``);
  assert.ok(bundleMdRow('Revision').startsWith(`${bundle.revision}, dated ${bundle.date}`), bundleMdRow('Revision'));
  const adr = readFileSync(ADR_0038_PATH, 'utf8');
  assert.ok(adr.includes(digest), 'ADR-0038 records the digest');
  assert.ok(adr.includes(bundle.url), 'ADR-0038 records the URL');
});

// --- Revision 5: a search, the routing configuration and a picked run ---------------------

/** The eight entries revision 5 added (ADR-0033 amendment 5), with the class the seat ruled (Q2). */
const REVISION_5_ADDED: Record<string, BundleField['class']> = {
  'composition.routingConfiguration': 'may-show',
  'trace.searchSpan.operationType': 'shows',
  'trace.searchSpan.searchOutcome': 'shows',
  'trace.searchSpan.searchQuery': 'shows',
  'trace.searchSpan.searchHits': 'shows',
  'civic.searchOutcome': 'may-show',
  'civic.searchQuery': 'may-show',
  'civic.searchHits': 'may-show',
};

test('civicaitools-v1 bundle: each entry revision 5 added carries the seven members, an absence rule and its ruled class', () => {
  for (const [id, cls] of Object.entries(REVISION_5_ADDED)) {
    const entry = field(id);
    assert.deepEqual(Object.keys(entry), ['id', 'path', 'values', 'absent', 'carriedBy', 'sentence', 'class'], id);
    assert.equal(entry.class, cls, id);
    assert.ok(entry.absent.length > 0 && entry.carriedBy.includes('search-golden.json'), id);
  }
  assert.ok(field('trace.searchSpan.searchOutcome').path.endsWith('attributes[key="tool.search_outcome"]'));
  assert.ok(field('civic.searchHits').path.endsWith('["civic:searchHits"]'));
});

test('civicaitools-v1 bundle: every attribute the harness refuses on a search span is named in trace.searchSpan.operationType\'s values', () => {
  const values = field('trace.searchSpan.operationType').values;
  for (const words of ['error: true', 'mcp.source', 'mcp.server.id', 'mcp.alias', 'mcp.pack_id', 'tool.upstream_name', '(SearchSpanError)']) {
    assert.ok(values.includes(words), words);
  }
  // The hits' refusals, as the code makes them: an empty string and an id named twice (Q6), and hits on limit-reached (D1).
  const absent = field('trace.searchSpan.searchHits').absent;
  assert.ok(absent.includes('an empty string or the same id twice'));
  assert.ok(absent.includes('the harness refuses hits on such a span'));
  assert.ok(field('trace.searchSpan.searchOutcome').absent.includes('is absent or is neither value'));
  // The cap's form is the code's (Q6).
  assert.ok(field('composition.routingConfiguration').values.includes('a positive whole number written in decimal digits with no leading zero'));
});

test('civicaitools-v1 bundle: a call stopped at the limit is given no words of a search that ran', () => {
  const sentence = field('trace.searchSpan.searchOutcome').sentence;
  const limitPart = sentence.slice(sentence.indexOf('limit-reached:'), sentence.indexOf('On a limit-reached call'));
  const quoted = [...limitPart.matchAll(/'([^']+)'/g)].map((m) => m[1]!);
  assert.equal(quoted.length, 3, limitPart);
  for (const words of quoted) {
    for (const claim of ['searched for', 'returned', 'found', 'The model searched']) {
      assert.ok(!words.includes(claim), `${words}: ${claim}`);
    }
  }
  assert.ok(field('trace.searchSpan.searchHits').sentence.includes('A call whose outcome is limit-reached has no hits'));
  assert.ok(field('civic.searchHits').absent.includes('outcome is limit-reached, where no search ran'));
});

test('civicaitools-v1 bundle: the reader-picked words, and the composition and tools entries read a search and a picked run', () => {
  const considered = field('composition.considered');
  assert.ok(considered.values.includes('reader-picked is the sources the reader picked for this question'));
  assert.ok(considered.sentence.includes("For reader-picked, version 1: 'The person who asked this question picked those sources."));
  assert.ok(considered.sentence.includes("says 'was first shown' in place of 'was shown'"));
  assert.ok(field('composition.components').values.startsWith('One entry per source the run composed, in manifest order'));
  assert.ok(field('environment.toolDefinitions').values.includes('find_source when the run offered the model a search'));
  assert.ok(field('composition.routing').values.includes('never by the method picker'));
});
