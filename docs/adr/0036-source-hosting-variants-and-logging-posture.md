# ADR-0036: Source hosting variants and the logging posture — each manifest entry lists its variants, each variant names who holds its logs, and the entry carries its consent default and its publisher

- **Status:** **Accepted** (ruling D11 = A by the owner at gate G0 of anchor [civic-ai-tools-website#632](https://github.com/npstorey/civic-ai-tools-website/issues/632), 2026-10-17, with D6 = A; as corrected at G0 in the hub's [G0 record](https://github.com/npstorey/civic-ai-tools-website/issues/632#issuecomment-6245049852): the variants are a union discriminated on `kind`, whose `npm-package` arm requires 0.3.0's four fields under the name `SourceHosting`; that correction was accepted by the program seat before the phase began. The two shape questions the phase was asked to settle, several holders per variant and a holder the instance chooses, are settled in §B and §C)
- **Date:** 2026-10-18
- **Decision-maker:** Solo maintainer
- **Supersedes:** —
- **Superseded by:** —
- **Evolves:** [ADR-0031](0031-civic-typed-router-packaging.md) (the manifest entry gains `hostings`, `consentDefault` and `publisher`, and loses `hosting`). Cites [ADR-0032](0032-tool-naming-across-sources.md) (an entry's `id` and `alias`, which two variants of one source share) and [ADR-0033](0033-composed-harness-record-fields.md) (how a record names the server that ran, which this record amends in nothing).

## Context

`@typedstandards/civic-typed-router` 0.3.0 carries one hosting value on one entry. Measured at hub `51eb833`:

- `ManifestEntry.hosting?: SourceHosting` (`src/core/types.ts:146`), with `kind: 'npm-package'` as its only kind and the fields `package`, `version`, `commit` and `outbound` (`:90-103`). It is "carried, never read by the router" (`:88`), and its comment names the variants and the logging posture as later work (`:84`).
- Only NYC Charter, Laws and Rules carries it (`src/civic/nyc-charter.ts:167-173`, `:208`). It is switched on by `NYC_CHARTER_HOSTING`, on only at exactly `sandbox` after trimming (`src/civic/env.ts:28`, `:33`, `:64-66`).
- `router-goldens.test.ts` shows the router never reads `hosting`: every golden holds with the field replaced by a sentinel and behind a getter that throws (`:338-410`).

The MCP-sources design (planning-side, §11 item 2) rules that the manifest lists every way a source can be run, that two enabled variants of one source share an identity and appear as separate rows in the sources panel because their log holders differ, and that the record names which variant ran. Its disclosure model (§4.3) holds what each recipient states it keeps "per source in the manifest (the logging-posture field: none / metadata / content, retention, URL, date read)", carried into the signed record "by reference only". Its consent model (§4.4) needs a default state for each source.

The reference website reads the hosting value at eleven places at website `662099b`. Four of its signatures take `Pick<SourceHosting, 'package' | 'version'>` or `Pick<SourceHosting, 'version' | 'commit'>` and act on those fields as strings (`registry.ts:383-384`, `socrata-skill.ts:346-347`, `hosting/install-manifests.ts:25-31`). Five of the values it derives reach a signed record: `catalogType` (`evidence/data-sources.ts:85`), the purl in `aggregatePortalUrl` (`:86`) and in `mcpServers` (`registry.ts:410`), and `components[].version` (`socrata-skill.ts:482`).

## Decision

### A. The shape

`ManifestEntry.hosting?` is replaced by three fields:

```ts
readonly hostings: readonly HostingVariant[];   // every way the source can be run or reached
readonly consentDefault: 'on' | 'ask-first';    // its state in a reader's first consent
readonly publisher?: string;                    // its publisher, named as its own page names it
```

`HostingVariant` is a union discriminated on `kind`. Every arm carries the same three fields:

| Field | Type | What it states |
|---|---|---|
| `variant` | `string` | The variant's name, unique within its entry |
| `runsAt` | `'instance-sandbox' \| 'publisher' \| 'government' \| 'other'` | Where it runs: a sandbox the instance creates, the server's publisher, a government's own server, or elsewhere |
| `logging` | `readonly LoggingPosture[]` | Every holder of logs of what the variant is sent, in the order the data flows (§B) |

The arms:

| `kind` | Carries besides the three | Notes |
|---|---|---|
| `npm-package` | `package`, `version`, `commit` (strings) and `outbound` (`readonly string[]`), all required | These are 0.3.0's `SourceHosting` and keep that name: `NpmPackageVariant extends SourceHosting`, so a `Pick<SourceHosting, …>` of a variant compiles unchanged, and Charter's `kind` stays the literal `'npm-package'` that a record's `catalogType` states |
| `remote` | nothing | Reached at an address the instance configures |
| `container` | nothing | A name in the type only. No container host is built, and no entry carries one |

No arm has a field for an address. A remote's address is the instance's configuration, and a hosted source is reached at an address its host resolves per call.

D11's draft made `package`, `version`, `commit` and `outbound` optional fields of one flat type. A `Pick` of that type has optional fields, so the four website signatures above would no longer type-check against a variant. The discriminated union is the G0 correction.

### B. Several holders per variant

`logging` is a list, ordered as the data flows: the holder of the server's logs first, then each onward recipient. A Socrata call goes to the server at the configured address and then to the portal the call names, and both hold logs of it. One `LoggingPosture` per variant could carry only one of them.

A list is the cheapest shape that carries both. A variant with one holder has a list of one. The order is the order a "where this question went" view lists them.

### C. A holder the instance chooses

The manifest is the same for every instance. Where the holder depends on the instance, the manifest cannot cite one holder's page as true for all of them. Examples are the platform an instance runs its sandboxes on, and the operator of the address an instance configures. A posture is therefore one of two arms, discriminated on `statedBy`:

| `statedBy` | Fields | Meaning |
|---|---|---|
| `'manifest'` | `holder` (string), `keeps`, `retention?` (string), `statementUrl` (an `https:` address), `readOn` (`YYYY-MM-DD`, UTC) | The manifest names the holder and states what that holder's own statement says it keeps, with the address read and the date it was read |
| `'instance'` | `role` (string) | The manifest names the holder by role only. The consuming app states the holder and its posture for that role, with its own address and read date |

`keeps` is `'none' | 'metadata' | 'content' | 'not-stated'`. `'not-stated'` is written only where the statement read says nothing about what the holder keeps. It is a fact about a page that was read, so it is never a placeholder for a page nobody read.

The four entries use three roles:

- `server-operator`: whoever runs the server at the address the instance configures;
- `portal-operator`: the operator of the portal a call names (the Socrata server reaches whichever portal the call's `domain` argument names);
- `sandbox-platform`: the platform the instance runs its sandboxes on.

### D. A posture is policy text carried by reference

A posture is what a holder's own statement says, read on a date. It is not a measurement and is never signed as fact: no record field carries a posture. Per the design (§4.3), a record refers to the instance's flows statement by address, hash and date. That statement carries the postures, so a record can state where its question went without attesting other parties' practices.

### E. The instance-level recipients live in the consuming app

The model endpoint, the hosting platform's function logs, sign-in, analytics and the notebook executor are recipients of every question, whatever sources are configured. Their postures live in the consuming app, beside the postures it states for the roles of §C. The manifest carries only each source's own variants and postures.

### F. Which variant is in force: the consumer selects it, and the router reads none of it

For a source offered by a switch, the switch's value names the variant that is on: `NYC_CHARTER_HOSTING=sandbox` turns on Charter's variant named `sandbox` (`NYC_CHARTER_HOSTING_SANDBOX` is that name). For a remote, its address variable's presence selects its single variant.

No router function reads `hostings`, `consentDefault` or `publisher`. `router-goldens.test.ts` runs every golden with each replaced by a sentinel and behind a getter that throws, as it does for `id`. Tests read the fields; the router does not. The consumer selects the variant in force for an entry under its configuration.

### G. Two variants of one source share its identity, and a second enabled variant is later work

Two variants of one source share its `id`, `alias` and `sourceId`, and appear as two panel rows, because their log holders differ (design §11 item 2). The consumer's registry, the record's `sourcesOffered` (ADR-0033 §E) and a reader's consent states are all keyed by that id. Two enabled variants of one id would therefore share one consent state and one dispatch target. Each of the four entries has one variant, so the case does not arise. Enabling a second variant of one source is later work, and it needs those keys to tell the variants apart.

### H. How a record names the variant that ran

No new record byte. The record already names the variant through two fields:

- the `mcpServers` url shape (ADR-0033 §D): a `pkg:` purl for a variant the instance runs from a package (`pkg:npm/%40betanyc/nyc-charter-laws-rules@0.3.1`), and an `https:` address for a remote;
- `components[].version` (ADR-0033 §E), for an npm-package variant: its version, `+`, and the first 12 hex characters of its commit (`0.3.1+b784cb763ec0`).

An npm-package variant carries the same `package`, `version` and `commit` strings that 0.3.0's field did, so every value the website derives from them is unchanged. This record amends nothing in ADR-0033 §D's type: a hosted server's `mcpServers` url stays its purl.

### I. The consent default and the publisher

`consentDefault` is a source's state in a reader's first consent (design §4.4). It is `'on'` for all four entries (ruling D6 = A): every source the instance configures is On in the first consent. A source configured after a reader's first consent arrives as Ask first, by the consent store's rule rather than by this field. A fork changes a source's default in one place.

`publisher` names the source's publisher as the source's own page names it. Absent, a consumer says the publisher is not stated.

### J. The four entries

Read on 2026-10-18 (UTC), each on the holder's or the publisher's own page:

| Source | `publisher` | Variant | `runsAt` | `logging`, in order |
|---|---|---|---|---|
| Socrata | `npstorey` (the repository's owner) | `remote` (`remote`) | `other`: no default address, so the instance's address names who runs it | `server-operator` (instance); `portal-operator` (instance) |
| Data Commons | `Google` ("Data Commons by Google") | `remote` (`remote`) | `publisher`: Google's hosted endpoint, the default address | Google, `content`, no retention period stated; [Google's privacy policy](https://policies.google.com/privacy?hl=en-US), the one the Data Commons documentation links |
| Boston OpenContext | `City of Boston` (the repository's owner, its Department of Innovation and Technology) | `remote` (`remote`) | `government` | City of Boston, `metadata`, under the City's records retention schedule; [the City's terms of use and privacy policy for its digital services](https://www.boston.gov/government/cabinets/innovation-and-technology/terms-use-and-privacy-policy-city-boston-digital) |
| NYC Charter, Laws and Rules | `BetaNYC` ("built and maintained by BetaNYC") | `sandbox` (`npm-package`, `@betanyc/nyc-charter-laws-rules` 0.3.1, `outbound: []`) | `instance-sandbox` | `sandbox-platform` (instance); the package reaches no host, so nothing goes onward |

## Considered and rejected

- **D11's draft: one flat type with `package?`, `version?`, `commit?` and `outbound?`.** It breaks the consumer's `Pick<SourceHosting, …>` signatures, as §A states.
- **Keeping 0.3.0's `hosting` and adding a variants field beside it** (D11 option B). Two fields would describe one thing, and a consumer would read both.
- **One `logging` posture per variant.** It cannot carry both of a Socrata call's holders (§B).
- **Stating a posture for a holder the instance chooses.** The manifest would state one instance's platform or operator as true for every instance. "Not stated" is no fix: it states a fact about a page for a page the manifest cannot know (§C).

## Consequences

- The type change is planned for router 0.4.0. `ManifestEntry.hosting` is removed. A consumer that reads it, as the reference website does, moves to the variant in force: one selector, and the call sites that read `entry.hosting`. The `Pick<SourceHosting, …>` signatures and the derived values stay as they are. A manifest built outside this package must add `hostings` and `consentDefault` to each entry.
- Each `readOn` ages. A re-read updates the posture and its date in a router release. A posture that changes value is a change to the flows statement that the consent store re-asks or notifies on (design §4.4).
- The `container` arm is a name only, and a second enabled variant of one source is later work (§G).

## References

- The MCP-sources design (planning-side, §2.2, §4.3, §4.4, §11 item 2).
- [civic-ai-tools-website#632](https://github.com/npstorey/civic-ai-tools-website/issues/632): the anchor, its rulings D6 and D11, and the hub's G0 record.
- [ADR-0031](0031-civic-typed-router-packaging.md), [ADR-0032](0032-tool-naming-across-sources.md), [ADR-0033](0033-composed-harness-record-fields.md).
