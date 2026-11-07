# `ai-assisted-analysis/civicaitools-v1` — the guidance bundle (informative rendering)

**The normative artifact is [`bundle.json`](bundle.json) beside this file.** This page describes it; where the two differ, the JSON holds. The JSON is content-addressed: the verifier's table row for the subtype pins it by URL and SHA-256 ([ADR-0038](../../../adr/0038-civicaitools-v1-producer-profile-subtype.md) §5), so any change to its bytes is a new revision with a new digest (ADR-0038 §2).

| | |
|---|---|
| Subtype | `ai-assisted-analysis/civicaitools-v1` |
| Display name | Civic AI Tools profile, v1 |
| Revision | 3, dated 2026-11-07, recorded in the ADR-0038 amendment of that date. Revision 2, dated 2026-11-02, is SHA-256 `45bf3ab479325a791829ed9987f5f291fea44238b54bfb598f32f306f574eb9b` at tag `v0.1.14-typed-standards-spec`; revision 1, dated 2026-10-30, is SHA-256 `724e399e02db8993041b64982eec731505084bec2ec5e6ca58fda2de8087a281` at tag `v0.1.13-typed-standards-spec` |
| Decision record | [ADR-0038](../../../adr/0038-civicaitools-v1-producer-profile-subtype.md) |
| URL | `https://raw.githubusercontent.com/npstorey/civic-ai-tools/v0.1.15-typed-standards-spec/docs/profiles/ai-assisted-analysis/civicaitools-v1/bundle.json` |
| SHA-256 of `bundle.json` | `d403ae5e97a7713f2af5d1dd8fb435aec2a18ce094c53883c4874e7a4e390e59` |
| Content profiles the row admits | `datHere` (the A-G envelope, a full-text record) and `default` (the plain shape, a hash-only record) |
| Capture vocabulary | inherited from `ai-assisted-analysis` (ADR-0011's G4 decision), no override |

## What the JSON states

- **The header:** the subtype, its display name, the revision and its date, the decision record, the bundle's own URL, the version rule, the content profiles the subtype's table row admits, and the capture vocabulary.
- **`fields[]`:** one entry per field a record of this producer carries beyond the `datHere` requirements of specification §8.7.1, thirty-eight in all (revision 3 added four). Each entry has six members besides its `id`:
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
| The composition block | `assertedDate`, `sourcesOffered`, `components`, `flowsStatement`, `routing`, `definitionHash`, `considered` (the inventory the run was routed against, by id, version and hash, and how many of its entries the model was shown) | `extensions["org.civicaitools.composition"]` |
| The environment block | `toolDefinitions` | `extensions["org.civicaitools.environment"]` |
| The notebook's own metadata | the execution block, the structured summary, the `provenance` discriminator | `extensions["org.civicaitools.notebook"].metadata.extensions[…]` |
| The load span | `tool.operation_type` (`load_source`), `tool.load_outcome` (five values), `tool.load_asked` (`true` or `false`: whether a question was put to the reader) | the trace's `mcp_tool_call` spans |
| The provenance graph | twenty-two `civic:` terms, `civic:packId` and `civic:loadAsked` among them | `provenance["@graph"][]` |
| The system prompt | `skillText`, `systemPromptHash` | `skillMetadata` |

The one statement in the `shows` class that every host of this subtype derives is the chooser sentence: read from `routing.method`, the load spans and `sourcesOffered`, it says what chose the sources and names three groups — loaded; requested, not loaded, each with its last load's reason; not requested — wherever reached sources are shown. No reason states that the reader was asked or answered, because the record does not hold whether a question was put, and no reason names a consent setting. A record with no `routing` key reads "What chose these sources is not recorded."

## Reading it

```sh
jq -r '.fields[] | "\(.class)\t\(.id)\t\(.path)"' bundle.json
jq -r '.neverCarried[] | .fact' bundle.json
shasum -a 256 bundle.json
```
