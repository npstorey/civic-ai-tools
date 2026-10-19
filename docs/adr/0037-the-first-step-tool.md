# ADR-0037: The first-step tool — a directory of sources, `load_source(alias)` under a reserved name, composition for a loaded set, and the harness definition as an output with its hash

- **Status:** **Accepted** (rulings D3 = A and D5 = B by the owner at gate G0 of anchor [civic-ai-tools-website#644](https://github.com/npstorey/civic-ai-tools-website/issues/644), 2026-10-19, with D1 = A and D9 = A; as corrected at G0 in the hub's [G0 record](https://github.com/npstorey/civic-ai-tools-website/issues/644#issuecomment-6274954918) and its [amendment](https://github.com/npstorey/civic-ai-tools-website/issues/644#issuecomment-6275034482): the directory has no outro (5(a)), `buildSystemPrompt` with an empty selection does not move (5(b)), the canonical JSON and the SHA-256 are the router's own code in `src/core/` with no import (5(d) as amended), and the definition takes its components from the consumer (5(i)); and the program seat's ruling 5(c) = A on that record, 2026-10-19: one router function for the in-loop prompt)
- **Date:** 2026-10-19
- **Decision-maker:** Solo maintainer
- **Supersedes:** —
- **Superseded by:** —
- **Evolves:** [ADR-0031](0031-civic-typed-router-packaging.md) (the router gains in-loop functions beside the composition) and [ADR-0032](0032-tool-naming-across-sources.md) (the startup check gains a reserved name). Cites [ADR-0033](0033-composed-harness-record-fields.md) (the composition block a record carries, which a later phase of this sprint amends) and [ADR-0036](0036-source-hosting-variants-and-logging-posture.md) (the carried fields the router never reads).

## Context

`@typedstandards/civic-typed-router` 0.4.0 composes one system prompt and one tools array per run, for every source the configuration offers or for an explicit selection (`buildSystemPrompt(input.selection)`). A consumer sends both on every request of a run. With more sources, every tool and every guidance block rides on every request, whether the question needs them or not.

The MCP-sources design (planning-side, §1.3 step 2, §1.6, §10 items 9-11, §12 M3) adds in-loop routing: the model's first request carries a short directory of sources and one tool, `load_source(alias)`; a source the model loads arrives on the next request. R5's measurement (its frozen directory, sha256 `be0874030f0c…`) found every one of nine models loading a source first on every row that needed data, and found that a tool message holding a JSON object reached two Google models as that object alone, while the same guidance in the system prompt reached them whole. So the guidance of a loaded source arrives in the next request's system prompt (D1 = A), and the load result is one plain line, written by the consuming app.

The quote test of 2026-10-19 measured the directory text this record ships (shape S2: R5's frozen first-request template with its sentence about the load result rewritten for this shape) on the three models the reference instance offers: 6 of 6 passed, each quoting the first line and the final sentence of the loaded guidance.

Measured at hub `9a6eff5`: the router's purity guard refuses a Node built-in import in every shipped file (`src/purity.test.ts:5`, `:52`, `:62-72`); `src/core/` imports nothing outside itself (`src/boundary.test.ts`); the router declares no runtime dependency (`scripts/dependency-budgets.json`). The dispatch rule accepts a bare upstream name when exactly one offered source has it (`src/core/alias.ts:255-301`), so a manifest whose source declares a tool named `load_source` was accepted, and a bare `load_source` call resolved to that source's tool (`nyc_charter__load_source` for such a fork of NYC Charter's entry).

## Decision

### A. The modelling (D3)

The router owns the directory and the first-step tool; the consuming app owns the loop's load step, the mode switch and the load result's line; the harness owns what a record states. A directory entry is what the MCP groups draft's `groups/list` returns for a group (a name and a description), and `load_source(alias)` is its `groups/get(name)`, which returns a group's scoped tools as invokable definitions ([modelcontextprotocol/progressive-disclosure-wg#19](https://github.com/modelcontextprotocol/progressive-disclosure-wg/pull/19), open, read 2026-10-19). OpenAI's tool search has the same shape on a model API: a `namespace` tool with a name, a description and functions marked `defer_loading`, beside a `tool_search` entry ([tool search guide](https://developers.openai.com/api/docs/guides/tools-tool-search), read 2026-10-19; the page states no date). So a protocol-level form can replace this client-side one without changing a record's vocabulary: a source is still named by its alias, and a load is still one call that names it.

The router has no mode (D9 = A): the consuming app chooses between all-sources routing, whose bytes do not move, and in-loop routing, which calls the functions below.

### B. The directory

`directoryPrompt({ configured, today, selection? })` returns the directory over the directory set, the entries `selection` offers in manifest order (`offeredEntries`). It is composed in `src/core/directory.ts` by `composeDirectory(frame, entries)`, which holds no sentence: the intro, the heading, the paragraph and the freshness label arrive as values (`directoryFrameFor(today)`, `DIRECTORY_HEADING`, `DIRECTORY_PARAGRAPH` and `DIRECTORY_FRESHNESS_LABEL` in `src/civic/prompt-frame.ts`). The text is `introFor(today)`, a blank line, `## Data sources`, a blank line, the paragraph, a blank line, and one line per entry joined by a newline:

```
- `<alias>`: <description> Freshness: <freshness>
```

A description that does not end in `.`, `!` or `?` gains a period (`directorySentence`). There is no outro and no trailing newline (5(a)). The paragraph:

> The data sources below are available to you, but none of their tools are loaded yet. To use a source, call `load_source` with its alias; its tools are added for your next turn, and its guidance then appears in this system prompt. Load every source the question needs; you may call `load_source` more than once. If the question needs no data, answer without loading anything.

Over R5's eleven frozen entries with today `{{TODAY}}`, this is the 3,486-character text the quote test measured as S2 (sha256 `ce6b136a…`), held by a test over a fixture of those entries. The directory reads each entry's `alias`, `description` and `freshness`, calls no fetcher, and names no tool: an entry's `description` is written for routing and stays as it is.

### C. The first-step tool and its reserved name

`aliasedLoadSourceTool({ configured, selection? })` is R5's frozen `load_source` schema (one required argument, `alias`, and no other) with its enum the directory set's aliases in manifest order, and R5's descriptions byte for byte (`LOAD_SOURCE_TOOL_TEXT`). It is built by `loadSourceTool(aliases, text)` in core.

`load_source` (`LOAD_SOURCE_TOOL_NAME`) is a reserved name. `findToolNameProblems`, which `createCivicRouter` runs at construction, reports a problem of kind `reserved-name` for an entry whose alias is `load_source` and for an entry with an upstream tool named `load_source`, and the router is refused with a `ToolNameError` that names it. The reason is bare dispatch: a model that calls `load_source` must reach the first-step tool, and the dispatch rule would otherwise hand a bare call of that name to the one offered source that declares it. An alias of that name is refused because the first-step tool takes an alias as its argument and the directory lists each source under its alias.

### D. Composition for a loaded set (5(c) = A)

`aliasedInLoopSystemPrompt({ ...BuildSystemPromptInput, loaded })`, with `selection` the directory set, returns the directory over `selection`. When a loaded id is in the directory set, it continues with `BLOCK_SEPARATOR` and the aliased composition over the loaded sources of the directory set, in manifest order, without its intro: its preamble, one block per loaded source, and its outro. The intro states the role and the date once. With nothing loaded it is the directory alone, the first request's prompt, and calls no fetcher; a loaded id outside the directory set composes nothing. The directory stays at the top of every request, so `load_source` remains usable on any request. `buildSystemPrompt` does not move (5(b)): with an empty selection it keeps its 807 characters for the G0 record's input, and every app golden holds.

The quote test's S2 put a one-line heading (`## Guidance for <displayName> (loaded)`) and the guidance alone after the directory, while the router's composition keeps its preamble and outro around the loaded blocks, so an in-loop prompt is close to what S2 measured but not byte-equal to it.

### E. The harness definition (D5 = B, 5(d) as amended, 5(i))

`harnessDefinition({ configured, selection, chosenBy, components })` returns `{ domain, sources, components, chosenBy, hash }`:

| Field | Value |
|---|---|
| `domain` | `'civic'` (`CIVIC_DOMAIN`), a value the civic layer passes to core's `harnessDefinitionOf` |
| `sources` | `offeredSkillSources(configured, selection)`: the composed source ids |
| `components` | the consumer's, in its order: `id`, `version?`, `guidanceHash?` (64 lowercase hex). The router never reads an entry's `id` or `hostings` and does not see a block as composed, so it cannot state them; any other key of a consumer's component is not read |
| `chosenBy` | `'reader' \| 'model' \| 'instance'` (`CHOSEN_BY`): who chose the sources. Recorded, so a record can say what chose |
| `hash` | the lowercase hex SHA-256 of the canonical JSON of the four fields above |

There is no `task`: nothing in the composition declares one, since the first-step tool takes an alias only. A `chosenBy` outside the three, an empty `id`, an empty `version` and a `guidanceHash` that is not 64 lowercase hex are refused with `HarnessDefinitionError`.

The canonical JSON (`canonicalJson`) is RFC 8785 for strings, arrays and plain objects: members in the order of their names' UTF-16 code units, no whitespace, every string as `JSON.stringify` writes it. Any other value is refused with `CanonicalJsonError`, so the router never hashes a value whose canonical form it does not define. The SHA-256 (`sha256Hex`) is FIPS 180-4 over the UTF-8 bytes from `TextEncoder`. Both are the router's own code in `src/core/`, with no import, so the router stays browser-safe and dependency-free. Tests hold the digest to the FIPS 180-4 example vectors and to `node:crypto` over 1,200 generated inputs, and a fixed definition's canonical string to a literal.

The definition is an output and a hash only. Loading a definition from a file or an address, and a signer, wait for the definition to be a node type (D5 = B; the MCP-sources design (planning-side, §10 item 10) and §12 T item 4), so that a named signer is a verified one.

### F. What a record carries: later work in this sprint

The record of an in-loop run is the harness's (H2 of this sprint, an amendment to ADR-0033): the composition block's `routing { method, version }` and `definitionHash`, each emitted only when passed, and a load span, a tool span with `tool.operation_type` `load_source` and its outcome, attributed to no data source. An all-sources record's bytes do not move. This record decides none of that.

## Considered and rejected

- **The consuming app composes the directory from the manifest** (D3's option B). A second composer outside the package, and a record whose `components[]` names a composer it cannot version.
- **The in-loop prompt as the directory joined to the whole composition** (the alternative to 5(c) = A). Every request after a load would state the role and the date twice.
- **The canonical JSON and the SHA-256 from a package or a Node built-in** (5(d) as first posted). The router's purity guard refuses a Node built-in in every shipped file, `src/core/` imports nothing from any package, and the router's dependency budget is empty.
- **The router states the components itself** (H1's first wording). It reads no `id`, no hosting variant and no composed block, so it would state values it does not have.

## Consequences

- The router's public surface grows: `directoryPrompt`, `aliasedLoadSourceTool`, `aliasedInLoopSystemPrompt` and `harnessDefinition` on `CivicRouter`; `composeDirectory`, `loadSourceTool`, `canonicalJson`, `sha256Hex` and `harnessDefinitionOf` in core. `ToolNameProblem` gains the kind `reserved-name`; a consumer that switches over its kinds sees one more.
- A manifest with an alias or an upstream tool named `load_source`, which loaded before, is refused at construction.
- A change to the directory's text, to the composition's frame, or to a civic block shows as a diff in the pinned in-loop fixture, beside the app goldens.

## References

- The R8 anchor, [civic-ai-tools-website#644](https://github.com/npstorey/civic-ai-tools-website/issues/644): decisions D1, D3, D5 and D9; phase H1; W1 item 4.
- The hub's G0 record and its amendment, comments [6274954918](https://github.com/npstorey/civic-ai-tools-website/issues/644#issuecomment-6274954918) and [6275034482](https://github.com/npstorey/civic-ai-tools-website/issues/644#issuecomment-6275034482): the quote test's table, the measured directory text, and corrections 5(a)-(d) and 5(i).
- The MCP groups draft, [modelcontextprotocol/progressive-disclosure-wg#19](https://github.com/modelcontextprotocol/progressive-disclosure-wg/pull/19); OpenAI's [tool search guide](https://developers.openai.com/api/docs/guides/tools-tool-search).
- [RFC 8785](https://www.rfc-editor.org/rfc/rfc8785) (JSON Canonicalization Scheme); [FIPS 180-4](https://csrc.nist.gov/pubs/fips/180-4/upd1/final) (SHA-256).
- `packages/civic-typed-router/src/core/directory.ts`, `canonical-json.ts`, `sha256.ts`, `definition.ts`; `src/civic/router.ts`, `prompt-frame.ts`; the tests `directory.test.ts`, `load-source.test.ts`, `in-loop.test.ts`, `definition.test.ts`.
