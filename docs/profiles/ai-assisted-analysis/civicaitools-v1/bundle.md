# `ai-assisted-analysis/civicaitools-v1` — the guidance bundle (informative rendering)

**The normative artifact is [`bundle.json`](bundle.json) beside this file.** This page describes it; where the two differ, the JSON holds. The JSON is content-addressed: the verifier's table row for the subtype pins it by URL and SHA-256 ([ADR-0038](../../../adr/0038-civicaitools-v1-producer-profile-subtype.md) §5), so any change to its bytes is a new revision with a new digest (ADR-0038 §2).

| | |
|---|---|
| Subtype | `ai-assisted-analysis/civicaitools-v1` |
| Display name | Civic AI Tools profile, v1 |
| Revision | 5, dated 2026-11-13, recorded in the ADR-0038 amendment of that date. Revision 4, dated 2026-11-12, is SHA-256 `4c623892516dc1996e412c313c2208e0880d594e753ef0c9d2a1a3e4f4ce5c81` at tag `v0.1.16-typed-standards-spec`; revision 3, dated 2026-11-07, is SHA-256 `db8175703601a5de9d785a2cda93db194eb05cdeeb222dcfd509ea8ab249f016` at tag `v0.1.15-typed-standards-spec`; revision 2, dated 2026-11-02, is SHA-256 `45bf3ab479325a791829ed9987f5f291fea44238b54bfb598f32f306f574eb9b` at tag `v0.1.14-typed-standards-spec`; revision 1, dated 2026-10-30, is SHA-256 `724e399e02db8993041b64982eec731505084bec2ec5e6ca58fda2de8087a281` at tag `v0.1.13-typed-standards-spec` |
| Decision record | [ADR-0038](../../../adr/0038-civicaitools-v1-producer-profile-subtype.md) |
| URL | `https://raw.githubusercontent.com/npstorey/civic-ai-tools/v0.1.17-typed-standards-spec/docs/profiles/ai-assisted-analysis/civicaitools-v1/bundle.json` |
| SHA-256 of `bundle.json` | `9946c58f2a4e800388b10f31a43a099c5a1d97b4f5084dbbff8351480d9223d5` |
| Content profiles the row admits | `datHere` (the A-G envelope, a full-text record) and `default` (the plain shape, a hash-only record) |
| Capture vocabulary | inherited from `ai-assisted-analysis` (ADR-0011's G4 decision), no override |

## What the JSON states

- **The header:** the subtype, its display name, the revision and its date, the decision record, the bundle's own URL, the version rule, the content profiles the subtype's table row admits, and the capture vocabulary.
- **`fields[]`:** one entry per field a record of this producer carries beyond the `datHere` requirements of specification §8.7.1, forty-eight in all (revision 3 added four, revision 4 two, revision 5 eight). Each entry has six members besides its `id`:
  - `path`: where the field sits on the record, as the record carries it (measured at the reference host's code and fixture records, not at the specification's statement where the two differ; ADR-0038 §7);
  - `values`: what it can hold;
  - `absent`: the absence rule, which is ADR-0033's honest-absence rule throughout: an absent key renders as not recorded, never as a default;
  - `carriedBy`: a fixture or published record that carries it, or the statement that none does yet;
  - `sentence`: the statement a host derives from it, with a placeholder per value;
  - `class`: one of `shows`, `may-show`, `never-invents` (ADR-0038 §4, the D7 ruling).
- **`neverCarried[]`:** the seven facts a record of this subtype never holds, with the rule that keeps each out of the signed bytes: who consented, when, the account, the per-source consent states, the flows version row, the session cookie, and the flows statement's text.

## The field set, by group

| Group | Entries | Path |
|---|---|---|
| The composition block | `assertedDate`, `sourcesOffered`, `components` (with `reportedName` and `reportedVersion` on a remote server's entry: what the server reported itself as), `flowsStatement`, `routing`, `definitionHash`, `considered` (the inventory the run was routed against, by id, version and hash, how many of its entries the rule listed for the model's first request, and the rule: `directory-set`, or `reader-picked` for a run whose sources the reader picked), `routingConfiguration` (the rule, the cap, whether a search was offered and by which method, the inventory, and the SHA-256 of those four) | `extensions["org.civicaitools.composition"]` |
| The environment block | `toolDefinitions` | `extensions["org.civicaitools.environment"]` |
| The notebook's own metadata | the execution block, the structured summary, the `provenance` discriminator | `extensions["org.civicaitools.notebook"].metadata.extensions[…]` |
| The load span | `tool.operation_type` (`load_source`), `tool.load_outcome` (five values), `tool.load_asked` (`true` or `false`: whether a question was put to the person running the question) | the trace's `mcp_tool_call` spans |
| The search span | `tool.operation_type` (`find_source`), `tool.search_outcome` (`searched`, or `limit-reached` for a call the instance stopped at its limit and ran no search for), `tool.search_query` (the model's words), `tool.search_hits` (the sources a search that ran returned, in rank order) | the trace's `mcp_tool_call` spans |
| The provenance graph | twenty-five `civic:` terms, `civic:packId`, `civic:loadAsked` and the search's `civic:searchOutcome`, `civic:searchQuery` and `civic:searchHits` among them | `provenance["@graph"][]` |
| The system prompt | `skillText`, `systemPromptHash` | `skillMetadata` |

The one statement in the `shows` class that every host of this subtype derives is the chooser sentence: read from `routing.method`, the load spans, `sourcesOffered` and, when present, `considered`, it says what chose the sources and names three groups — loaded; requested, not loaded, each with its last load's reason; not requested — wherever reached sources are shown. No reason states whether a question was put or answered: a record states whether one was put only in `trace.loadSpan.loadAsked`, when it carries that attribute. No reason names a consent setting. A record with no `routing` key reads "What chose these sources is not recorded."

The two failure entries, `civic.failed` and `civic.failureKind`, give words for each of the reference producer's six failure labels (`timeout`, `unavailable`, `not_configured`, `not_offered`, `unknown`, `base_changed`), for a failed call with no label (the words for `unknown`) and for a label not among the six. None says that the source refused the call: `unknown` and `unavailable` each cover calls a source answered with an error and calls the producer never sent, and `not_configured`, `not_offered` and `base_changed` mark calls the producer did not send. A pack's entry is found from `composition.considered`, or, on a record without it, in the hub's tagged inventory versions by the pack's `id` and the twelve hash characters in its component's `version`.

A `find_source` call (a search span) is the model's search over the source inventory, answered by the site that ran the question and sent to no source. Its words say whether a search ran (`searched`) or the call was stopped at the limit (`limit-reached`), what the model searched with, and which sources a search that ran returned, in its order; a hit is a source the search returned, not one loaded or used, and a call stopped at the limit is given no words of a search. On a run whose sources the reader picked, `considered.rule` is `reader-picked`: the sources the person who asked the question picked, less any turned off or not set up. Revision 5 also corrects three statements that were false of some records: the components entry (on an in-loop run the components are the loaded sources), the `not-offered` load outcome's words, and the system-prompt count's words, which a search can move without a load.

## Reading it

```sh
jq -r '.fields[] | "\(.class)\t\(.id)\t\(.path)"' bundle.json
jq -r '.neverCarried[] | .fact' bundle.json
shasum -a 256 bundle.json
```
