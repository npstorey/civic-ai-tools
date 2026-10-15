# ADR-0032: Tool naming across sources — `<alias>__<upstream name>`, applied by the router, checked at startup, dispatched by a map

- **Status:** **Accepted** (2026-10-15 — ruled by the owner at gate G0 of sprint R2, anchor issue [civic-ai-tools-website#599](https://github.com/npstorey/civic-ai-tools-website/issues/599): ruling D6 of 2026-10-14 and the G0 memo's cards 1 and 2 of 2026-10-15)
- **Date:** 2026-10-15 (decision); written by the sprint's H1 implementation session and landing in its PR
- **Decision-maker:** Solo maintainer
- **Supersedes:** —
- **Superseded by:** —
- **Evolves:** [ADR-0031](0031-civic-typed-router-packaging.md) (it left "the renaming of tools under source aliases and the startup checks" to a later change; this is that change)
- **Resolves:** [Q60](../architecture/open-questions.md#q60--tool-name-namespacing-across-mcp-sources) (tool-name namespacing across MCP sources), parts (a), (b) and (c)

## Context

The reference application hands a model one flat list of tools gathered from several MCP servers. A tool name is the only key a model call carries, so two servers that declare the same name cannot both be offered: the Socrata server's `search` collides with the `search` of a publisher-bundled server the program means to host next. The application already refuses such a configuration at startup (since website #503) instead of overwriting the first binding, and `@typedstandards/civic-typed-router` 0.1.0 carries the same check without invoking it. What was missing is a naming rule that lets both servers be offered, written down as a contract a fork can follow when it adds its own sources.

The MCP-sources design (planning-side, §6) sets that rule; the owner confirmed §6 as the contract on 2026-10-14 (D6) and added the dispatch rule. G0 then settled how the rule reaches text (card 1) and what happens to a name the rule cannot carry as it is (card 2), and a reuse check against existing gateways and SDKs added four rules, the output contract and the triggers below.

## Decision

### Rulings of record: design §6, the naming layer

Design §6's seven items, restated from its text, with each later ruling noted beside the item it changes:

1. **Three layers.** A source has a global **identity** (its MCP Registry name where it is published there; otherwise package name plus repository address), an operator-chosen **alias** unique within one deployment, and model-facing **tool names** `<alias>__<upstream tool name>`. The current aliases are `socrata`, `data_commons` and `boston`. (The map from tool name to source that dispatch reads is described under the reuse-check rules below.)
2. **Applied by the app at the registry boundary** (Q60 a): in the advertised schema, and reversed on dispatch. Never requested of upstream publishers.
3. **The model APIs' limit binds:** 64 characters from letters, digits, `_` and `-`, checked at startup. The specification's own rule is looser (128, and it allows a dot). The 64 is a conservative bound, not stated in the provider documentation read on 2026-09-20, so the website confirms it with one real call (sprint R2, W3). *Amended by G0 card 2 (2026-10-15):* a name that would break the bound or the character set is normalized, not refused (below).
4. **Startup fails loudly** (Q60 b) on a duplicate alias, a duplicate tool name, an over-long or ill-formed name, or a tool whose source is not in the instance's registry. No silent last-write-wins. *Amended by G0 card 2:* an over-long or out-of-set exposed name is normalized instead of refused, and only a collision after normalizing refuses the manifest; an ill-formed alias is still refused. A tool whose source is not in the registry is a dispatch matter here: the router's map holds only the manifest's sources, so `resolveCalledName` refuses a name of a source the run is not offered as `not-offered`, and a name no source has as `unknown`.
5. **The record stores both** the tool name as called and the source identity with its version, so no reader resolves an alias and a fork may rename aliases freely.
6. **It is a fork-facing contract** (Q60 c), documented in the deployment guide (the website's `docs/deploy.md`, sprint R2, W3), in this ADR and in the router's README.
7. **The existing eleven tools** are renamed under the same rule (ruled "rename now" as D1, 2026-10-14): `socrata__get_data`, `socrata__search`, `socrata__fetch`, `data_commons__search_indicators`, `data_commons__get_observations`, and `boston__ckan__search_datasets`, `boston__ckan__get_dataset`, `boston__ckan__query_data`, `boston__ckan__get_schema`, `boston__ckan__execute_sql`, `boston__ckan__aggregate_data`. Boston's publisher-applied `ckan__` prefix stays inside the upstream name. Replay and notebook code read both spellings. The reason: one rule, and the collision risk is highest exactly on the bare names `search` and `fetch`. The cost: every new record's tool names differ from every old record's. Grandfathering would avoid that and leave a permanent exception in a contract forks are meant to copy.

### The dispatch rule (D6)

A name the model calls resolves by the map. A bare upstream name is accepted when exactly one offered source has it, and refused, naming every aliased form, when two or more do. This covers what neither text rule reaches: tool results, which the application does not rewrite, and server text at no anchor. A name only a source the run is not offered has, and a name no source has, are refused. The router implements the rule as a pure function, `resolveCalledName(map, offered, name)`; the application's client applies it before any request.

### How text names a tool (card 1)

- **Text the router owns names each tool through a function of the view.** That text is the prompt frame, the civic guidance blocks, the one-portal lock section, and every tool and parameter description in the schemas. The bare view yields the 0.1.0 bytes; the aliased view yields `<alias>__<upstream>` everywhere a tool is named. Each mention of a name that is also an English word (`search`, `fetch`) is decided by reading it: the English uses stay words. The aliased view is therefore exact and reversible by construction.
- **Text the router does not own gets the anchored rewrite,** scoped to that source's own block and its own tool names: the guidance a server serves, and a server's initialize instructions. The anchors are an exact backtick token, an exact bold token, an exact double-quoted token, an exact table cell, and an item of a `Tools:` list, each equal to one of that source's own tool names. Nothing else changes. On the Socrata guidance at socrata-mcp-server `3163601` this renames 17 `get_data`, 8 `search` and 7 `fetch` tokens, and leaves two `get_data` at no anchor (a fenced `Tool: get_data` line and the header cell "get_data coverage") and five English uses as written. The dispatch rule covers a model that calls a name it read at no anchor.

### Names outside the set (card 2, amending D6's startup refusal)

An exposed name that would hold a character outside `[A-Za-z0-9_-]`, or run past 64 characters, is normalized deterministically: each out-of-set character (by code point) becomes `_`, and an over-long name is cut and ends in `_` and a short hash of the name it came from (eight hex characters of FNV-1a over its UTF-8 bytes), so the same input gives the same name on every run. Both names are recorded in the dispatch map. Only a collision after normalizing is refused at startup. An alias is the operator's own, so an ill-formed alias is refused, never normalized.

### The naming contract (from the reuse check)

- A name starts with a letter or an underscore. Every exposed name matches `^[A-Za-z_][A-Za-z0-9_-]{0,63}$`.
- An alias contains no `__`. (It also starts with a letter or an underscore, holds only `[A-Za-z0-9_-]`, and is at most 32 characters, so every exposed name keeps room for its tool's name.) Two sources never share an alias.
- Dispatch goes through a map built at startup, from exposed name to `{ sourceId, alias, upstreamName }`, never by splitting a name: an upstream name may itself hold `__` (`ckan__search_datasets`).
- Per call, the record holds the exposed name, the upstream name, the alias and the server identity. The map supplies the first three; the application writes them (sprint R2, W3 and W4, with the record fields of ADR-0033).

### The router's output contract

The router's output is three things: a tools array of chat-completions function tools, a prompt string, and the dispatch map. Any harness or gateway can consume them; the router performs no call. Bare and aliased views of the first two sit side by side, so a consumer adopts the aliased view as one switch.

### Adoption triggers

The program builds this layer itself because no outside component met the rules above when it was decided. It adopts outside code instead when:

- **agentgateway**, for hosting and a local gateway, when the program hosts servers itself (sprint R7);
- **the official MCP TypeScript SDK or `@ai-sdk/mcp`**, for the MCP client, decided before R7;
- **the AI SDK**, for the model loop, only if its step hooks capture every routing decision a record states.

## Considered and rejected

- **Grandfather the eleven, alias only new sources.** Leaves a permanent exception in a contract forks copy, on exactly the bare names a new source collides with (D1).
- **Request the prefix upstream.** Cleaner names, but not the program's to decide and uncoordinated across independently maintained servers (Q60 part (a)).
- **Extend the rewrite to every identifier token in prose,** for names that are not English words. It would rewrite text the router owns by pattern instead of by construction, and could not decide `search` and `fetch`; card 1 names each mention instead.
- **Refuse every name outside the set or over 64 characters.** One stray character in a server's tool name would refuse the whole configuration; card 2 normalizes and records both names.
- **Split the exposed name on `__` to dispatch.** Ambiguous for upstream names that hold `__`, and wrong for any normalized name.
- **Check bare-name uniqueness at startup.** Refuses the case the alias exists to allow; the router checks uniqueness over the exposed names.

## Consequences

- Router 0.2.0 carries both views, the checks, the map and the dispatch rule; its bare view reproduces the website at `d1919a8`. The website switches to the aliased view in one change (R2, W3), where every name-keyed site reads the upstream name through the map and both spellings are accepted.
- A fork adds a source with one manifest entry: an `alias`, a `description` and a `freshness` line, its schemas and its guidance. The startup checks refuse an entry whose names cannot be exposed.
- Every record made after the switch names tools differently from every record made before it; replay, notebooks and the evidence pages read both.
- A server's tool results can name a bare tool; they are not rewritten, and the dispatch rule decides a call that copies one.

## References

- [civic-ai-tools-website#599](https://github.com/npstorey/civic-ai-tools-website/issues/599) — the sprint anchor, its G0 record and close.
- [ADR-0031](0031-civic-typed-router-packaging.md) — the router package this extends.
- [Q60](../architecture/open-questions.md#q60--tool-name-namespacing-across-mcp-sources) — the question this resolves.
- `packages/civic-typed-router/README.md` — the views, the checks, dispatch and the selection, with examples.
- `packages/civic-typed-router/src/core/alias.ts` — the naming layer.
