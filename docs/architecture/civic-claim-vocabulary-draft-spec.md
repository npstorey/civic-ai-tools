---
Status: Historical snapshot — frozen 2026-05-26
Last updated: 2026-05-01
Maintainer: [TK: leave as placeholder]
---

> **Historical snapshot — frozen 2026-05-26.**
>
> Canonical text now lives at [`typed-standards-specification.md`](typed-standards-specification.md) §8.11 (Typed Claims) and Appendix B (worked example). The CCV claim shapes (TrendClaim, ComparisonClaim, ObservationClaim, CompositionClaim, RelationshipClaim, QualitativeClaim), confidence-method discipline, scope taxonomy, AnalyticalDerivation, falsifiability requirement, anti-patterns, and extension mechanism are absorbed into the consolidated specification per [ADR-0012](../adr/0012-typed-standards-consolidation.md), with the `ccv:` prefix renamed to `ts:` and the namespace URI moved from `https://civicaitools.org/ns/civic-claim-vocabulary/v1#` to `https://typedstandards.org/ns/ts#`. The legacy namespace URI continues to resolve as an alias for backwards-compatibility; a future deprecation is gated on adopter need per [Q10](open-questions.md#q10--civic-claim-vocabulary-as-a-full-ontology). Specifically:
>
> - §1 Purpose and scope → typed-standards-specification.md §8.11.1
> - §2 Design principles → §8.11.2
> - §3 Package integration → §8.11.3 (substantively reframed around `content/claim/v1` signed nodes per [ADR-0009](../adr/0009-unified-typed-attestation-primitive.md) §8 Q11/Q12 closure — typed claims are first-class signed nodes, not companion files)
> - §4 Civic Claim Vocabulary (namespace, reused vocabularies, core class, scope, confidence, AnalyticalDerivation) → §8.11.4 (with `ts:` prefix)
> - §5 Core claim types → §8.11.5
> - §6.1-§6.2 Extension mechanism → §8.11.6 (§6.3 governance dropped as pre-mature per Q10)
> - §7 Worked example → Appendix B
> - §8 Anti-patterns and prohibitions → §8.11.7
>
> §9 (Open questions for review) and §10 (Reactions invited) were draft-stage commentary that did not carry forward into the consolidated specification.
>
> Body preserved verbatim per [ADR-0012](../adr/0012-typed-standards-consolidation.md) §4 for historical cross-reference accuracy. New implementations should reference §8.11 of the consolidated specification instead. The "Internal working draft" status callout and the 2026-05-25 ADR-0009 reframe status note below reflect the file's state at the times they were authored; they are not the file's current state.

> **Status: Internal working draft, pre-v0.1. Not for external review.**
>
> This document represents the project's current internal best-thinking on the Civic Claim Vocabulary. It is not a stable specification. The document's framing as a vocabulary (rather than a full ontology) is itself an open question; see `civic-ai-tools/docs/architecture/open-questions.md`.

> **Status note 2026-05-25 (ADR-0009 reframe).** Typed claims are realized as `content/claim/v1` signed nodes per [ADR-0009](../adr/0009-unified-typed-attestation-primitive.md) §7 — NOT as a separate `claims.jsonld` companion file. The claim shapes (TrendClaim, ComparisonClaim, ObservationClaim, CompositionClaim, RelationshipClaim, QualitativeClaim) and conformance requirements specified in this draft remain authoritative; the carrier changes from companion file to first-class signed node. The untyped → typed extraction step is itself an attested step via `attestation/wasDerivedFrom/v1` carrying an `AnalyticalDerivation` payload per [ADR-0009](../adr/0009-unified-typed-attestation-primitive.md) §7 refinement (a) + [ADR-0006](../adr/0006-producer-profile-architecture.md) §4 (the classification-laundering guard). A future ADR may consolidate this draft into [`typed-standards-proposal.md`](typed-standards-proposal.md) per [Q39](open-questions.md#q39--consolidate-oes--ccv-into-typed-standards-proposalmd-as-a-single-rfc-ready-spec). References to `claims.jsonld` and the multi-file package layout in this draft predate the reframe; read them as the carrier-shape narrative the [ADR-0009](../adr/0009-unified-typed-attestation-primitive.md) framing supersedes, not as current carrier requirements.

This document is a draft specification, not an Architecture Decision Record. ADRs in this directory track decisions; spec drafts track the artifacts those decisions are about.

This document is the draft specification of the Civic Claim Vocabulary, the project's typed-claims layer for evidence packages.

# Open Evidence Standard — Typed Claims Layer

**Spec extension draft v0.1**
**Companion file:** `claims.jsonld` (added to evidence package)

---

## 1. Purpose and scope

The Open Evidence Standard captures *how* an AI-assisted analysis was produced. The Typed Claims Layer additionally captures *what the analysis claims*, in a form that is machine-comparable across evidence packages.

A typed claim is a structured assertion derived from the analysis output and serialized as JSON-LD against a published vocabulary. Typed claims are intended to enable corpus-level operations — corroboration, contradiction detection, citation graphs, meta-analysis, drift surveillance — that are impractical against unstructured prose.

This spec defines:

- The structure and required core fields of a typed claim
- The Civic Claim Vocabulary, a minimal set of claim shapes every claim conforms to
- The extension mechanism for domain-specific vocabularies
- The relationship between typed claims and the rest of the evidence package
- The translation provenance requirements for LLM-emitted claims

This spec does **not** define:

- The full vocabulary of every civic domain (housing, transit, public health, etc.) — those live in extension vocabularies governed separately
- How the network layer (e.g. KOI processors) ranks or surfaces claims — that is downstream of the standard
- Whether any specific claim is true — the standard surfaces structure, not truth

---

## 2. Design principles

1. **Build on existing standards, do not replace them.** Where W3C, OGC, ISO, or domain-specific vocabularies and ontologies exist (PROV-O, SDMX, Data Cube, Schema.org, GeoSPARQL, FHIR, etc.), the Civic Claim Vocabulary references and reuses them rather than inventing parallel terms.
2. **Common core, modular extensions.** A small mandatory core (the Civic Claim Vocabulary) ensures every claim has provenance, geographic and temporal scope, and a quantified confidence statement. Domain extensions add typed claim shapes for crime, transit, housing, public health, budgets, procurement, and so on, without requiring the core to know about them.
3. **Optional in v1, incentivized.** `claims.jsonld` is OPTIONAL in evidence packages conforming to v1 of the Open Evidence Standard. Packages with valid typed claims SHOULD receive richer treatment in network-layer processors (citation graph inclusion, contradiction surfacing, meta-analysis discovery). Packages without claims remain fully valid.
4. **Translation is itself an analytical step.** When a claim is generated by translating an LLM's prose output into structured form, that translation MUST be captured as a distinct provenance step in `trace.json`, with its own prompt, model, and version. The standard is explicit that structured form does not confer truth.
5. **Falsifiable by construction.** Every claim type MUST be defined such that a counter-claim can be expressed in the same vocabulary. If a claim cannot be contradicted by another well-formed claim, it is not a claim — it is decoration.
6. **Confidence MUST be derivable, not asserted.** Any confidence value attached to a claim MUST trace to a method (sample size, statistical test, model log probability, human review) recorded in the package. Free-form LLM confidence judgments are not permitted at the protocol level.

---

## 3. Package integration

### 3.1 File location

> ⚠ **Subject to Open Question #5 — `claims.jsonld` and `upstream-evidence.json` implementation timing.** Also subject to Open Question #1 (package format) — the multi-file directory layout shown below is the current direction, not the current shape. Today the published package is a single canonical JSON object; if Open Question #1 resolves toward RO-Crate / multi-file, the layout shown here becomes the canonical home for `claims.jsonld`. Until then, this section describes intent rather than a normative requirement.

The current direction is for typed claims to live in a single file at the package root:

```
evidence-package/
├── metadata.json
├── trace.json
├── provenance.jsonld
├── output.md
├── output.json (optional, structured output)
├── claims.jsonld          ← THIS SPEC
├── queries.json
├── metadata-context.json
├── data-sources.json
├── upstream-evidence.json
├── summary.md
├── prompt.json
└── signature.json
```

### 3.2 Relationship to other files

- Each claim in `claims.jsonld` MUST cite its supporting evidence within the same package using `prov:wasDerivedFrom` references to entities in `provenance.jsonld`.
- Claims MAY reference data sources from `data-sources.json` via the source's stable identifier.
- Claims MAY reference upstream evidence packages via `upstream-evidence.json` entries, enabling cross-package claim chains.
- The package signature in `signature.json` covers `claims.jsonld` along with all other package contents — claims are immutable once signed.

### 3.3 Conformance

A `claims.jsonld` file conforms to this spec if:

1. It is a valid JSON-LD 1.1 document.
2. Its `@context` includes the Civic Claim Vocabulary context.
3. Every top-level claim object validates against the SHACL shapes published with the Civic Claim Vocabulary.
4. Every confidence value is traceable to a method recorded elsewhere in the package.
5. Every claim is falsifiable in the sense of §2 principle 5.

---

## 4. Civic Claim Vocabulary

The vocabulary is a controlled set of typed claim shapes expressed in JSON-LD. It references W3C ontologies (PROV-O, OWL-Time, RDF Data Cube), OGC GeoSPARQL, Schema.org, and SDMX-RDF for concepts those vocabularies already cover; the Civic Claim Vocabulary contributes only the structural conventions that civic-data analysis claims need on top.

### 4.1 Namespace

```
@prefix ccv: <https://civicaitools.org/ns/civic-claim-vocabulary/v1#>
```

### 4.2 Reused vocabularies

The Civic Claim Vocabulary does not redefine concepts that exist in widely-adopted vocabularies. It imports and references:

| Prefix | Vocabulary | Used for |
|---|---|---|
| `prov:` | W3C PROV-O | Provenance of every claim |
| `qb:` | W3C RDF Data Cube | Multidimensional observations |
| `sdmx:` | W3C SDMX-RDF | Statistical metadata, time periods |
| `schema:` | Schema.org | Datasets, organizations, persons |
| `geo:` | OGC GeoSPARQL | Geographic geometries |
| `time:` | W3C OWL-Time | Temporal entities and intervals |
| `dcterms:` | Dublin Core Terms | Identifiers, titles, descriptions |
| `xsd:` | XML Schema datatypes | Primitive value types |

The Civic Claim Vocabulary contributes only what these external vocabularies do not already provide: the *Claim* shape, the *ConfidenceStatement* pattern, civic-specific scope types (e.g. NeighborhoodTabulationArea), and the *AnalyticalDerivation* link from claim to LLM trace.

### 4.3 Core class: `ccv:Claim`

Every typed claim is an instance of `ccv:Claim` or a subclass thereof. The base class defines the minimum required structure; subclasses (TrendClaim, ComparisonClaim, etc.) refine it.

**Required properties** on every Claim:

| Property | Type | Description |
|---|---|---|
| `dcterms:identifier` | xsd:string | Stable claim ID, unique within the package |
| `ccv:subject` | URI | What the claim is about (typically a metric, indicator, or observable) |
| `ccv:scope` | ccv:Scope | Geographic and temporal bounds of the claim |
| `ccv:confidence` | ccv:ConfidenceStatement | Method-derived confidence (see §4.5) |
| `prov:wasDerivedFrom` | URI[] | At least one entity from `provenance.jsonld` |
| `ccv:derivedVia` | ccv:AnalyticalDerivation | Link to the analytical step in `trace.json` |

**Optional properties:**

| Property | Type | Description |
|---|---|---|
| `dcterms:description` | xsd:string | Human-readable claim summary |
| `ccv:contradicts` | URI[] | Identifiers of other claims (in this or other packages) the author is explicitly contesting |
| `ccv:corroborates` | URI[] | Identifiers of other claims the author is explicitly affirming |
| `ccv:supersedes` | URI | A previous claim this one replaces |
| `ccv:limitations` | xsd:string | Author-acknowledged limitations of the claim |

### 4.4 Scope: `ccv:Scope`

Every claim has a scope expressing where and when it applies.

```json
{
  "@type": "ccv:Scope",
  "ccv:geographicScope": {
    "@type": "ccv:NeighborhoodTabulationArea",
    "dcterms:identifier": "BK0801",
    "schema:name": "Bushwick North",
    "geo:hasGeometry": { "@id": "..." }
  },
  "ccv:temporalScope": {
    "@type": "time:Interval",
    "time:hasBeginning": { "time:inXSDDate": "2024-01-01" },
    "time:hasEnd": { "time:inXSDDate": "2025-12-31" }
  }
}
```

The Civic Claim Vocabulary defines a small taxonomy of `ccv:GeographicScope` subtypes for common civic units. Each subtype names the canonical reference standard or authority where one exists; subtypes without a clean canonical reference are flagged for follow-up.

| Subtype | Reference standard / authority |
|---|---|
| `ccv:CensusTract` | US Census Bureau [TIGER/Line](https://www.census.gov/geographies/mapping-files/time-series/geo/tiger-line-file.html) (`tract` shapefile, GEOID encoding) |
| `ccv:CensusBlock` | US Census Bureau TIGER/Line (`tabblock` shapefile) |
| `ccv:CensusBlockGroup` | US Census Bureau TIGER/Line (`bg` shapefile) |
| `ccv:ZIPCodeTabulationArea` | US Census Bureau TIGER/Line ZCTA (`zcta` shapefile); the ZCTA is the Census-derived approximation of USPS ZIP areas, not the USPS routing dataset itself |
| `ccv:SchoolDistrict` | US Census Bureau [Education Demographic and Geographic Estimates (EDGE)](https://nces.ed.gov/programs/edge/Geographic/SchoolLocations) plus TIGER/Line school-district shapefiles |
| `ccv:MunicipalBoundary` | US Census Bureau TIGER/Line `place` shapefile (incorporated places + Census-designated places); other jurisdictions: country-specific gazetteers |
| `ccv:CountyBoundary` | US Census Bureau TIGER/Line `county` shapefile (FIPS county code) |
| `ccv:StateBoundary` | US Census Bureau TIGER/Line `state` shapefile (FIPS state code); ISO 3166-2 for international subdivisions |
| `ccv:NeighborhoodTabulationArea` | NYC Department of City Planning [NTA](https://www.nyc.gov/site/planning/data-maps/open-data.page#other) (NYC-specific; analogous boundaries elsewhere are typically jurisdiction-defined and lack a uniform standard) |
| `ccv:CommunityBoardDistrict` | NYC Department of City Planning [Community District boundary file](https://www.nyc.gov/site/planning/data-maps/open-data.page#district_political) (NYC-specific) |
| `ccv:CityCouncilDistrict` | Jurisdiction-specific. Reference the publishing city's council-district authority (e.g. NYC City Council district shapefile via NYC OpenData). No single cross-city canonical authority. |
| `ccv:PolicePrecinct` | Jurisdiction-specific. NYC: NYPD precinct boundaries via NYC OpenData. LA: LAPD division boundaries via LA GeoHub. No cross-jurisdiction standard. **Flagged for follow-up:** the namespace name `PolicePrecinct` may be too NYC-coded; some jurisdictions use "district," "division," "ward," etc. |

Domain extensions MAY add more. International equivalents (statistical-area-1 in Australia, OA in the UK, etc.) should be added as domain extensions rather than core subtypes.

For arbitrary geometries that do not fit any of the named subtypes, claims MAY use `ccv:GeographicScope` directly with a `geo:hasGeometry` value pointing at an OGC GeoSPARQL geometry literal (WKT, GML, or GeoJSON-LD).

Temporal scope uses W3C OWL-Time directly. No additions to the claim vocabulary are needed.

### 4.5 Confidence: `ccv:ConfidenceStatement`

Confidence is structured, not free-form. Every confidence statement MUST identify its method.

```json
{
  "@type": "ccv:ConfidenceStatement",
  "ccv:method": "ccv:FrequentistInterval",
  "ccv:level": 0.95,
  "ccv:lowerBound": 18.4,
  "ccv:upperBound": 27.6,
  "ccv:methodReference": "trace.json#step-stat-test-3"
}
```

The Civic Claim Vocabulary defines a starting set of confidence methods:

| Method URI | Use when |
|---|---|
| `ccv:FrequentistInterval` | Confidence interval from a statistical test |
| `ccv:BayesianCredibleInterval` | Bayesian posterior interval |
| `ccv:SampleSizeBased` | Confidence implied by sample size against a known population |
| `ccv:LLMReportedLogProbability` | Token-level log probabilities from the model (limited applicability) |
| `ccv:HumanReview` | Reviewer-asserted confidence with reviewer identity |
| `ccv:NotApplicable` | The claim is qualitative or definitional; numeric confidence does not apply |

`ccv:NotApplicable` is permitted but MUST be accompanied by a description explaining why a quantified confidence is not appropriate.

**The list is extensible by domain extensions.** Domain extensions MAY define additional confidence methods under their own namespace (for example, `nyc-housing:RentRollSampleConfidence` or `transit:ScheduleAdherenceConfidence`), in the same way they MAY add to the `ccv:GeographicScope` subtype taxonomy. New methods MUST satisfy the §2 principle 6 requirement (confidence is method-derived, traceable to a recorded calculation in the package) and SHOULD be registered in the extension registry alongside the extension that defines them.

### 4.6 AnalyticalDerivation

Every claim MUST link to the analytical step that produced it. This is what makes the LLM-to-claim translation auditable.

```json
{
  "@type": "ccv:AnalyticalDerivation",
  "ccv:traceReference": "trace.json#step-claim-extraction-1",
  "ccv:translationModel": {
    "@type": "schema:SoftwareApplication",
    "schema:name": "claude-opus-4-7",
    "schema:softwareVersion": "claude-opus-4-7"
  },
  "ccv:translationPrompt": {
    "@id": "prompt.json#claim-extraction"
  },
  "ccv:sourceOutputSpan": {
    "ccv:outputFile": "output.md",
    "ccv:byteRange": [1240, 1487]
  }
}
```

This serves three purposes:

1. Makes clear that the structured claim is a *translation* of LLM prose, not the prose itself.
2. Makes the translation prompt inspectable (and re-runnable for verification).
3. Pins the claim to a specific span of source output for human review.

---

## 5. Core claim types

The Civic Claim Vocabulary ships with a small starter set of claim types. All extend `ccv:Claim`. Each subclass adds typed properties beyond the core.

### 5.1 `ccv:TrendClaim`

A claim that some metric increased, decreased, or remained stable across two time periods within a scope.

**Additional required properties:**

| Property | Type | Description |
|---|---|---|
| `ccv:metric` | URI | The measured quantity (ideally referencing an external vocabulary) |
| `ccv:baselinePeriod` | time:Interval | Earlier comparison period |
| `ccv:comparisonPeriod` | time:Interval | Later comparison period |
| `ccv:direction` | ccv:TrendDirection | `Increase`, `Decrease`, or `NoSignificantChange` |
| `ccv:magnitude` | ccv:Magnitude | Quantified change (absolute or percent) |

### 5.2 `ccv:ComparisonClaim`

A claim that two scopes differ on some metric within a single time period.

**Additional required properties:**

| Property | Type | Description |
|---|---|---|
| `ccv:metric` | URI | The compared quantity |
| `ccv:scopeA` / `ccv:scopeB` | ccv:Scope | The two scopes being compared |
| `ccv:relation` | ccv:ComparisonRelation | `GreaterThan`, `LessThan`, `ApproximatelyEqual` |
| `ccv:magnitude` | ccv:Magnitude | Quantified difference |

### 5.3 `ccv:ObservationClaim`

A claim that a metric had a specific value within a scope at a point in time. Maps directly onto `qb:Observation` from the W3C Data Cube vocabulary.

**Additional required properties:**

| Property | Type | Description |
|---|---|---|
| `ccv:metric` | URI | The observed quantity |
| `ccv:value` | (numeric or qb:Observation) | The observed value |
| `ccv:unit` | URI | Unit of measure (QUDT or UCUM reference) |

### 5.4 `ccv:CompositionClaim`

A claim about the breakdown of a population, budget, or count into components. Useful for budget analyses, demographic breakdowns, etc.

**Additional required properties:**

| Property | Type | Description |
|---|---|---|
| `ccv:whole` | ccv:Scope | The aggregate being decomposed |
| `ccv:components` | ccv:Component[] | Each component with its share |
| `ccv:totalsTo` | xsd:decimal | Sum of components (1.0 for proportions, total $ for budgets, etc.) |

### 5.5 `ccv:RelationshipClaim`

A claim about a statistical relationship (correlation, regression coefficient) between two metrics within a scope. Distinguished from causal claims, which the Civic Claim Vocabulary does not include in v1.

**Additional required properties:**

| Property | Type | Description |
|---|---|---|
| `ccv:metricA` / `ccv:metricB` | URI | The two metrics |
| `ccv:relationshipType` | URI | `Correlation`, `RegressionCoefficient`, `RankOrderAgreement`, etc. |
| `ccv:strength` | xsd:decimal | The estimated value (correlation coefficient, etc.) |

### 5.6 `ccv:QualitativeClaim`

A claim that does not reduce to a single numeric assertion — for example, characterizing a pattern, a procedural finding, or a typology. Permitted but flagged as qualitative; downstream processors may treat differently.

**Additional required properties:**

| Property | Type | Description |
|---|---|---|
| `ccv:assertion` | xsd:string | The qualitative claim in prose |
| `ccv:groundingMethod` | URI | How the claim was derived (`Pattern Recognition`, `Document Analysis`, `Comparative Synthesis`, etc.) |

`ccv:confidence` MAY be `ccv:NotApplicable` for qualitative claims, with a required description.

---

## 6. Extension mechanism

Domain extensions extend the Civic Claim Vocabulary by:

1. Declaring their own namespace (e.g., `nyc-housing:`, `transit:`, `health:`).
2. Subclassing one or more core claim types or defining new ones that extend `ccv:Claim`.
3. Adding domain-specific properties.
4. Optionally referencing or aligning with external domain vocabularies (FHIR for health, GTFS for transit, DCAT for catalogs, etc.).
5. Publishing SHACL shapes for validation.

### 6.1 Example extension fragment

A hypothetical NYC Housing extension might define:

```turtle
nyc-housing:RentStabilizationClaim
  rdfs:subClassOf ccv:ObservationClaim ;
  rdfs:label "Claim about rent-stabilized unit counts" ;
  sh:property [
    sh:path nyc-housing:buildingClassification ;
    sh:class nyc-housing:BuildingClass ;
    sh:minCount 1 ;
  ] .
```

### 6.2 Extension registry

A lightweight registry at `civicaitools.org/vocabulary-registry` lists known extension vocabularies, their maintainers, their version status, and their SHACL shape files. Inclusion in the registry is informational; it does not confer endorsement.

### 6.3 Governance of the Civic Claim Vocabulary itself

> ⚠ **Future intent — not in force at v0.1.** When the standard reaches v1.0 and a public-comment process is established, the project intends to use comment periods of approximately the durations below. **v0.1-stage development does not follow these periods**; the spec is iterating internally and changes land as soon as the small set of active collaborators agrees. The numbers below are placeholders for a later governance regime.

Future intent for changes to the Civic Claim Vocabulary at v1.0 and beyond:
- Minor (additive, non-breaking): approximately a 30-day comment period
- Major (breaking): approximately a 90-day comment period plus migration guide
- All versions remain resolvable at versioned URIs forever

---

## 7. Worked example

A complete `claims.jsonld` for a hypothetical analysis of 311 noise complaints in Bushwick, 2024 vs 2025.

```json
{
  "@context": [
    "https://civicaitools.org/ns/civic-claim-vocabulary/v1/context.jsonld",
    {
      "ex": "https://example.gov/datasets/311/"
    }
  ],
  "@graph": [
    {
      "@id": "claim-001",
      "@type": "ccv:TrendClaim",
      "dcterms:identifier": "claim-001",
      "dcterms:description": "Noise complaints rose materially in Bushwick North between 2024 and 2025.",
      "ccv:metric": {
        "@id": "ex:complaint-count",
        "schema:name": "311 noise complaint count"
      },
      "ccv:scope": {
        "@type": "ccv:Scope",
        "ccv:geographicScope": {
          "@type": "ccv:NeighborhoodTabulationArea",
          "dcterms:identifier": "BK0801",
          "schema:name": "Bushwick North"
        },
        "ccv:temporalScope": {
          "@type": "time:Interval",
          "time:hasBeginning": { "time:inXSDDate": "2024-01-01" },
          "time:hasEnd": { "time:inXSDDate": "2025-12-31" }
        }
      },
      "ccv:baselinePeriod": {
        "time:hasBeginning": { "time:inXSDDate": "2024-01-01" },
        "time:hasEnd": { "time:inXSDDate": "2024-12-31" }
      },
      "ccv:comparisonPeriod": {
        "time:hasBeginning": { "time:inXSDDate": "2025-01-01" },
        "time:hasEnd": { "time:inXSDDate": "2025-12-31" }
      },
      "ccv:direction": "ccv:Increase",
      "ccv:magnitude": {
        "@type": "ccv:Magnitude",
        "ccv:percentChange": 23.0,
        "ccv:absoluteChange": 1842
      },
      "ccv:confidence": {
        "@type": "ccv:ConfidenceStatement",
        "ccv:method": "ccv:FrequentistInterval",
        "ccv:level": 0.95,
        "ccv:lowerBound": 18.4,
        "ccv:upperBound": 27.6,
        "ccv:methodReference": "trace.json#step-stat-test-3"
      },
      "prov:wasDerivedFrom": [
        { "@id": "provenance.jsonld#query-result-2" }
      ],
      "ccv:derivedVia": {
        "@type": "ccv:AnalyticalDerivation",
        "ccv:traceReference": "trace.json#step-claim-extraction-1",
        "ccv:translationModel": {
          "@type": "schema:SoftwareApplication",
          "schema:name": "claude-opus-4-7"
        },
        "ccv:translationPrompt": {
          "@id": "prompt.json#claim-extraction"
        },
        "ccv:sourceOutputSpan": {
          "ccv:outputFile": "output.md",
          "ccv:byteRange": [1240, 1487]
        }
      },
      "ccv:limitations": "Excludes complaints recorded against addresses without geocoded NTA assignment (~3.1% of records)."
    }
  ]
}
```

---

## 8. Anti-patterns and prohibitions

### 8.1 Things this spec deliberately does not enable

- **Causal claims.** The Civic Claim Vocabulary v1 includes `ccv:RelationshipClaim` for statistical relationships but no `ccv:CausalClaim`. Causal inference requires either experimental design or strong identifying assumptions, neither of which the standard can verify. Domain extensions may add causal claim types if they include explicit identification-strategy fields.
- **Free-form confidence.** `ccv:confidence` MUST reference a method; `"high"`, `"medium"`, `"low"` strings without method backing are non-conforming.
- **Implicit scope.** Every claim MUST have an explicit scope. "Crime is up" without geographic and temporal scope is non-conforming.

### 8.2 Translation laundering

A common failure mode: an LLM produces vague prose, a translator extracts a precise-looking structured claim, and the precision of the claim is taken as the precision of the underlying analysis. The standard guards against this through:

- The `ccv:derivedVia` requirement, which exposes the translation prompt and source span.
- The requirement that confidence be method-derived.
- The expectation that downstream processors surface the source span alongside the structured claim.

### 8.3 Vocabulary shopping

Where multiple external vocabularies cover the same concept, claim authors SHOULD prefer the most widely adopted one for the domain. The extension registry lists recommended choices per domain. Authors who use a less-common vocabulary SHOULD include `owl:sameAs` or `skos:exactMatch` references to the canonical alternative.

---

## 9. Open questions for review

These are explicitly left open in this draft, pending feedback:

1. **Should typed claims be optional or required in v1?** This draft says optional. An alternative is to require at least one claim per package, even if it is `ccv:QualitativeClaim`. Tradeoff: required improves network value, optional improves adoption.
2. **How are aggregate/derived claims represented?** A meta-analysis package that synthesizes 50 upstream claims into one new claim — does that get its own claim type, or is it just a regular claim with many `prov:wasDerivedFrom` links?
3. **Should the Civic Claim Vocabulary include a `ccv:Question` companion class?** Many evidence packages answer questions that someone asked. Capturing the question separately from the claim could help downstream processors group related work, but adds complexity.
4. **How granular should the vocabulary's confidence methods be?** The starter set in §4.5 is opinionated and small. Should it be expanded, or kept minimal and pushed into extensions?
5. **What is the relationship between `claims.jsonld` and Schema.org `Claim` / `ClaimReview`?** Schema.org has fact-checking vocabulary (`schema:Claim`, `schema:ClaimReview`) used by Google's fact-check ecosystem. Should claims be `schema:Claim` subclasses for SEO and fact-check tooling interop, or kept separate to avoid the fact-check connotation?
6. **SHACL vs ShEx vs JSON Schema for validation?** SHACL is the W3C standard but ShEx is more readable. JSON Schema is most familiar to developers but less expressive for graph data. Pick one as the authoritative validator?
7. **How does the standard handle redaction?** A typed claim about, say, a small subpopulation may itself be re-identifying. Does the Civic Claim Vocabulary need a redaction or k-anonymity affordance, or is that the publisher's responsibility?

---

## 10. Reactions invited

Specifically useful to react on:

- Whether the core/extension split is at the right level of abstraction, or whether the core is too thin (and should mandate more) or too thick (and should push more into extensions)
- Whether the six starter claim types are the right minimum set
- Whether the confidence-method enforcement is the right balance between rigor and adoption friction
- Whether the AnalyticalDerivation requirement adequately addresses the translation-laundering concern
- Whether the open questions in §9 have obvious answers that should be promoted into the body
- Anything missing from the anti-patterns list that you have already seen in the wild

---

*Draft prepared in response to design conversation, April 2026. Not for circulation outside the Civic AI Tools working context until reviewed.*
