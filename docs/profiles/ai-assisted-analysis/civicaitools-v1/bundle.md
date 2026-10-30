# `ai-assisted-analysis/civicaitools-v1` — the guidance bundle (informative rendering)

**The normative artifact is [`bundle.json`](bundle.json) beside this file.** This page describes it; where the two differ, the JSON holds. The JSON is content-addressed: the verifier's table row for the subtype pins it by URL and SHA-256 ([ADR-0038](../../../adr/0038-civicaitools-v1-producer-profile-subtype.md) §5), so any change to its bytes is a new revision with a new digest (ADR-0038 §2).

| | |
|---|---|
| Subtype | `ai-assisted-analysis/civicaitools-v1` |
| Display name | Civic AI Tools profile, v1 |
| Revision | 1, dated 2026-10-30 |
| Decision record | [ADR-0038](../../../adr/0038-civicaitools-v1-producer-profile-subtype.md) |
| URL | `https://raw.githubusercontent.com/npstorey/civic-ai-tools/v0.1.13-typed-standards-spec/docs/profiles/ai-assisted-analysis/civicaitools-v1/bundle.json` |
| SHA-256 of `bundle.json` | `9823edce4c15baa960ba77d3b0af0b261402e6cce621d1cfaca31526bd44f313` |
| Content profiles the row admits | `datHere` (the A-G envelope, a full-text record) and `default` (the plain shape, a hash-only record) |
| Capture vocabulary | inherited from `ai-assisted-analysis` (ADR-0011's G4 decision), no override |

## What the JSON states

- **The header:** the subtype, its display name, the revision and its date, the decision record, the bundle's own URL, the version rule, the content profiles the subtype's table row admits, and the capture vocabulary.
- **`fields[]`:** one entry per field a record of this producer carries beyond the `datHere` requirements of specification §8.7.1, thirty-four in all. Each entry has six members:
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
| The composition block | `assertedDate`, `sourcesOffered`, `components`, `flowsStatement`, `routing`, `definitionHash` | `extensions["org.civicaitools.composition"]` |
| The environment block | `toolDefinitions` | `extensions["org.civicaitools.environment"]` |
| The notebook's own metadata | the execution block, the structured summary, the `provenance` discriminator | `extensions["org.civicaitools.notebook"].metadata.extensions[…]` |
| The load span | `tool.operation_type` (`load_source`), `tool.load_outcome` (five values) | the trace's `mcp_tool_call` spans |
| The provenance graph | twenty `civic:` terms | `provenance["@graph"][]` |
| The system prompt | `skillText`, `systemPromptHash` | `skillMetadata` |

The one statement in the `shows` class that every host of this subtype derives is the chooser sentence: read from `routing.method`, the load spans and `sourcesOffered`, it says what chose the sources and names three groups — loaded; asked, with the reader's answer; never asked — wherever reached sources are shown. A record with no `routing` key reads "not recorded".

## Reading it

```sh
jq -r '.fields[] | "\(.class)\t\(.id)\t\(.path)"' bundle.json
jq -r '.neverCarried[] | .fact' bundle.json
shasum -a 256 bundle.json
```
