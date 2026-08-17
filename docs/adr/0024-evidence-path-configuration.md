# ADR-0024: Configuration that reaches signed output is absent-or-error, never defaulted

- **Status:** **Accepted** 2026-08-12 (maintainer review, post-merge of #149; the rule was already enforced by two shipped mechanisms — the container environment-coverage guard ([civic-ai-tools-website#250](https://github.com/npstorey/civic-ai-tools-website/issues/250)) and the both-halves signing gate ([civic-ai-tools-website#251](https://github.com/npstorey/civic-ai-tools-website/issues/251)) — so this records existing practice rather than proposing new); amended 2026-08-17 (§Consequences open-instances bullet — [civic-ai-tools#153](https://github.com/npstorey/civic-ai-tools/issues/153))
- **Date:** 2026-08-12
- **Decision-maker:** Solo maintainer
- **Supersedes:** —
- **Superseded by:** —
- **Evolves:** [ADR-0020](0020-instance-key-custody.md) (per-instance identity — the parameterization that created this configuration surface, and whose half-configured state is the first incident below), [ADR-0019](0019-reference-app-posture.md) (the instance posture: what the demo deployment hardcoded, an instance configures), [ADR-0023](0023-notebook-executor-driver.md) (the driver-seam register — the pattern by which the project keeps adding configuration)

*Numbering note: 0018 remains reserved for the roadmap-governance amendment; 0019–0023 are taken (confirmed against `origin/main` at drafting time).*

## Context

Three defects, found independently within two days, in three different layers:

1. **The signing key-id fallback** ([civic-ai-tools-website#251](https://github.com/npstorey/civic-ai-tools-website/issues/251), merged 2026-08-12). `getActiveKeyId()` fell back to a hardcoded literal — the reference deployment's kid — when `EVIDENCE_KEY_ID` was unset, while `isSigningConfigured()` checked only `EVIDENCE_SIGNING_KEY`. An operator who set a key but no kid therefore *left the unsigned tier* and signed every package under another party's registry identifier: packages that fail verification while presenting themselves as someone else's. Fixed by deleting the fallback and requiring both halves.
2. **The `${VAR:-}` empty-string form** ([civic-ai-tools-website#250](https://github.com/npstorey/civic-ai-tools-website/issues/250), merged 2026-08-12). While wiring the documented environment through to the container, the obvious Compose spelling turned out to render **empty string**, not absent. For `EVIDENCE_TRUST_REGISTRY_LEGACY_URL`, empty is a documented instruction meaning *omit `trustRegistryUrlLegacy` from the commitment sidecar* — so a change that read as pure plumbing would have silently altered the proof view verifiers resolve, on every containerized instance. Caught by running the real consumers; the fix bans that form in a CI guard.
3. **The publish skill's model default** ([civic-ai-tools#129](https://github.com/npstorey/civic-ai-tools/issues/129), open). `publish.py` fills an absent `model` from a hardcoded slug, so a signed, timestamped, Rekor-logged record can carry a model claim nobody supplied. It had fired on eleven public records before anyone noticed. All eleven are accurate — which is the point: nothing was positioned to notice the day they stopped being.

Three different accidents, one shape. **The evidence path reads from the same configuration surface as everything else, but a wrong value there does not produce a cosmetic defect — it produces a signed, timestamped, externally verifiable record asserting something false.** The error surfaces at verification time, to a third party who cannot tell which fields an operator supplied and which the code filled in. A default that is merely convenient elsewhere is an integrity hazard here.

The surface exists at this size because [ADR-0020](0020-instance-key-custody.md) made instance identity *configuration* rather than constants — correctly, since hardcoded identity emits one deployment's values from everyone's instance. Parameterization moved the risk rather than removing it, from *wrong constant* to *wrong default*, and the follow-through ADR-0020's §Consequences did not name is this rule. The project keeps adding such surfaces — drivers ([ADR-0023](0023-notebook-executor-driver.md)), host topology, branding, content sources, and next the guidance manifest ([Q65](../architecture/open-questions.md#q65--build-composition-as-a-publishable-artifact-what-is-a-harness-at-the-experience-layer)) — so every new seam is another opportunity to repeat this.

## Decision

### A. On the evidence path, configuration is absent-or-error — never defaulted

No fallback may supply a value that will be asserted inside a signed record. *Configuration* here means any value a producing path can supply on an operator's or a caller's behalf: environment variables however delivered, config files, and defaults filled into a publish payload.

Two admissible shapes for a missing value, chosen by whether the format makes the field optional:

- **Required field → refuse**, with a named, actionable failure that identifies the variable, points at the setup guide, and states the real consequence. Refusing beats returning absent wherever every caller writes the value straight into a required field: returning nothing does not remove the guess, it relocates it to each call site, which then has to invent something (website#251's reasoning — three call sites, one required envelope field).
- **Optional field → omit it.** Absence is expressible in the format; a producer that cannot name a value should say nothing rather than something.

### B. An honest absence is a legitimate default; an asserted fact is not

This is the line separating a default worth keeping from a defect. Judge what the value *becomes in the record*, not whether it is currently correct. The publish skill's neighbouring defaults get it right and its `model` default does not: `portal` defaults to `"n/a"` (an explicit not-applicable), `tokenUsage` to `{}` (empty, claims nothing), `model` to a specific slug (asserts a fact).

**A default that asserts a specific fact inside a signed artifact is a defect while the fact is still true.** The record it produces is indistinguishable from one the caller actually made, so the defect becomes undetectable at exactly the moment it starts mattering. A *fresher* default is therefore not a fix — it resets the clock on the same failure.

### C. The practical test — is this value on the evidence path?

Applied per value, when the value is introduced. **If this value were wrong, would the error appear in bytes a third party verifies?** Any yes puts it on the path:

1. It lands **under the signature** — the envelope, its payload, the provenance graph, or an artifact the package hashes (the executed notebook, the guidance text).
2. It lands in something **a verifier resolves while checking** — the commitment sidecar's `trustRegistryUrl` pair, the trust registry, the well-known documents (spec §8.3.3, §9.2).
3. It **changes an input to either of those**, without appearing in them itself.

Everything else is presentation and may default freely; the chrome `SITE_BRAND_*` set is the worked example, read independently of the evidence-identity set precisely so neither can surprise the other. A third class — format-vocabulary identifiers — is not instance configuration at all and must not be parameterized (`docs/instance-setup.md` §"Do not parameterize").

**When the classification is unclear, treat the value as on the path.** The cost of a wrong *presentation* call is a false record in public; the cost of a wrong *evidence* call is one more required variable.

### D. Empty and unset are distinguished deliberately, and the distinction is stated per delivery mechanism

Wherever either state is meaningful, the code distinguishes them on purpose and the documentation says so where an operator can see it — **including how each delivery mechanism renders them**. This is not a style preference; it is forced by cases where empty is itself an instruction (`EVIDENCE_TRUST_REGISTRY_LEGACY_URL=''` means *omit the field*, which unset does not).

The mechanisms differ, and the difference is invisible at the call site: a shell leaves a variable unset unless assigned; an env file's `NAME=` line delivers empty; container orchestration may render a bare `NAME:` as absent and `${NAME:-}` as empty string. A deployment surface offering more than one spelling states which produces which, and states that the enumeration is complete — the reference app's deploy guide now names three (pass-through, defaulted, hardcoded) and says there is no fourth.

### E. Where a check can be mechanical, prefer it to a convention

The two guards that shipped with incidents 1 and 2 are the model, and both are cheap: an **environment-coverage check** comparing the deployment surface against the declared inventory in both directions and rejecting the ambiguous spelling outright (run in CI *and* inside the test suite, on purpose — two independent paths); and a **configuration predicate** treating a partially-configured signing pair as *not configured* everywhere, never as a partial success. Conventions cannot catch a defect defined by absence: website#250's root cause is that per-feature review does not see a variable nobody wired.

## Considered and rejected

- **A general ban on defaults across all configuration.** Rejected as over-broad: presentation values and tuning knobs are better with defaults, and a rule that costs everywhere gets waived where it matters. Scope is fixed by the §C test, not by the word "configuration."
- **Normalize empty to unset (or unset to empty) everywhere.** Rejected: at least one variable already uses empty as a distinct documented instruction, and normalizing would silently discard an operator's expressed intent. §D's cost — every consumer decides — is the price of the case that needs it.
- **Refuse at boot: fail the process when any evidence-path value is absent.** Rejected: it would delete [ADR-0020](0020-instance-key-custody.md) Decision B's unsigned dev tier, which is itself an honest absence (no key, no claim, nothing reaching `sealed` or `public`). The refusal belongs at the producing action — preflight warns before a deploy, the seal/publish gate refuses at the moment a false record would be minted, and the banner covers the interval between.
- **An auto-generated ephemeral development key**, so that a developer can exercise the full publish path locally. Rejected: it produces a signature that verifies against nothing, and a key generated to make a path runnable is itself a default asserting a fact — *this was signed by someone* — rather than degrading to honest absence, which is the precise class §B names. The risk of an ephemeral key reaching a real deployment compounds it.
- **A well-known test key shipped in the repository.** Same benefit as above, plus the signature would be explicitly identifiable as untrusted. Rejected: publishing a private key so that signatures can be produced inverts what a signature means, and a test-signed record that escaped would carry a real cryptographic signature no reader could distinguish at a glance.
- **Document the rule and rely on review.** Rejected per §E — this is the posture all three incidents shipped under.
- **Update the stale default rather than removing it.** Rejected per §B.

## Consequences

- **New evidence-path configuration carries its classification with it.** The §C determination is made in the change that introduces the value, and lands in the environment inventory and the setup guide's table alongside it — not in a later sweep. Where a mechanical check is cheap, it ships in the same change (§E).
- **Display surfaces need a non-committing probe.** A surface that *shows* a configured value rather than committing to it takes a nullable read and renders honest absence — the reference app's `getConfiguredKeyId()` beside the throwing `getActiveKeyId()`. Without the pair, §A's refusal would take working display surfaces down with it.
- **The refusal lands at the producing action, and lands there *before* packaging.** In the reference app, `evaluateSealCommitGate()` runs at the top of the publish route (`src/app/api/evidence/route.ts:151`), ahead of any package assembly (`buildEvidencePackage` at :290); the in-code note states that with no signing key configured the whole persist path is refused up front rather than storing a record with a null signature. An unsigned instance therefore exercises no part of the packaging pipeline — canonicalization, the provenance graph, the commitment view are all downstream of the refusal — so that path's first real exercise on any instance is its first configured publish. Recorded because it was raised in review; §A's placement of the refusal is unchanged.
- **[civic-ai-tools#129](https://github.com/npstorey/civic-ai-tools/issues/129) is the open instance of the class**, and closes under §A/§B by requiring `model` or omitting it — not by a fresher slug. The eleven affected records are accurate; no remediation is proposed, and none is implied by this ADR. *(Amended 2026-08-17 — [civic-ai-tools#153](https://github.com/npstorey/civic-ai-tools/issues/153) found five further instances of the class in `@typedstandards/civic-typed-harness` 0.1.0, where the reference deployment's identity rode in as silently-applied default parameters: the provenance builder's `ProvenanceConfig`; the datHere environment config of `buildDatHereEnvironment` / `deriveDatHereEnvelopeFields`, whose `host` lands under the envelope hash; the provenance builder's model-agent description fallback, which asserted a specific gateway nobody supplied (§B's shape exactly); the `TraceBuilder` identity config; and the source-registry parameter of the source-display helpers. All five closed in harness 0.2.0 by making the config parameter required — a bare call now fails typecheck — with the description fallback resolved per §A's optional-field shape: omitted when unset. #129 remains the one open instance.)*
- **Operators pay for this in required variables.** Half-configuring now fails loudly instead of producing output. That cost is spent deliberately: the alternative is output that looks correct to its producer and is wrong to everyone else.
- **The test reaches further than the values named in an envelope.** `EXECUTOR_DRIVER` asserts nothing inside a package, but the pinned image it selects produces the executed notebook the package hashes — which is why [ADR-0023](0023-notebook-executor-driver.md) §E single-sourced the library table and test-enforced its Dockerfile mirror. That was this rule applied before it was named; §C.3 is the clause that generalizes it.
- **No spec or wire change.** The rule governs producer configuration, not the format, and verification is unchanged. The defining property of the class is that these defects were only ever detectable at verification time, by the party least able to act on them.
- **Threat-model routing.** What a defaulted evidence-path value does to a verifier's reading belongs in the threat-model doc tracked by [civic-ai-tools#63](https://github.com/npstorey/civic-ai-tools/issues/63), stated there rather than duplicated here.

## References

- [civic-ai-tools-website#251](https://github.com/npstorey/civic-ai-tools-website/issues/251) — signing key-id fallback deleted; both halves required (incident 1).
- [civic-ai-tools-website#250](https://github.com/npstorey/civic-ai-tools-website/issues/250) — full documented environment wired through to the container; the `${NAME:-}` form banned by guard (incident 2).
- [civic-ai-tools#129](https://github.com/npstorey/civic-ai-tools/issues/129) — the publish skill's `model` default (incident 3); the honest-absence/asserted-fact framing in §B is stated there first.
- [civic-ai-tools#153](https://github.com/npstorey/civic-ai-tools/issues/153) — five harness config defaults, found after acceptance and closed by `@typedstandards/civic-typed-harness` 0.2.0 (see the amended open-instances bullet in §Consequences).
- [civic-ai-tools#63](https://github.com/npstorey/civic-ai-tools/issues/63) — threat-model home.
- [ADR-0020](0020-instance-key-custody.md) — per-instance keys and the unsigned dev tier; the parameterization posture this rule constrains.
- [ADR-0019](0019-reference-app-posture.md), [ADR-0023](0023-notebook-executor-driver.md) — the instance posture and the driver-seam register that keep growing the surface.
- [Q65](../architecture/open-questions.md#q65--build-composition-as-a-publishable-artifact-what-is-a-harness-at-the-experience-layer) — its constraint of record (guidance text is hashed into signed packages, so a manifest change is evidence-visible) is §C applied to the next seam; cited, not restated.
- Typed Standards Specification §8.3.3 (trust registry / well-known), §8.5 (signer identity), §9.2 (verification check sequence).
- Reference app (`civic-ai-tools-website`): `src/lib/evidence/signing.ts`, `src/lib/site-config.ts` (the evidence-identity set and the empty-vs-unset case), `scripts/check-compose-env.mjs` + `scripts/preflight-env.mjs` (the guards), `docs/instance-setup.md` §4 and §"Do not parameterize", `docs/deploy.md` §"Supplying your environment" (the three spellings).
- Publish skill: `.claude/skills/publish-evidence/publish.py`.
