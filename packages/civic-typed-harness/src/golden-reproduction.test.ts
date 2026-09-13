// Golden reproduction, INPUT SIDE (S2 P2) — the proof that the relocated
// harness DERIVES the very values S1 proved @typedstandards/produce-core
// ASSEMBLES correctly.
//
// S1's byte-golden suite (produce-core `src/reference-golden.test.ts`) fed
// each fixture case's envelope input — with the reference packager's inline
// derivations (dataSources, provenance, skillMetadata extraction, the datHere
// policy: producerProfile auto-derivation, canonicalization-rule selection,
// the summary gate, the environment extension) carried VERBATIM as
// caller-supplied fields — to `buildEnvelope` and byte-compared the output.
// This suite closes the other half of the loop: starting from each case's RAW
// analysis inputs only, the harness's derivation functions must reproduce
// those carried derived values byte-for-byte, and the derived assembly must
// reproduce the reference implementation's exact serialized JSON, content
// hash, and envelope hash.
//
// Fixture provenance: `__fixtures__/reference-golden.json` is a VERBATIM copy
// (sha256 2f5ea4408b19f0ce46204956b29b38aeb92ec183e44c2704b1041cf75cf9f5dd)
// of @typedstandards/produce-core@0.1.0 `src/__fixtures__/reference-golden.json`
// (typedstandards repo — the published npm package ships `dist/` only, so the
// fixture travels by copy). Its `_meta` records the original capture: the
// reference implementation civic-ai-tools-website `src/lib/evidence/`
// packager.ts / attestation.ts at commit d39fdc17e8e237b5cac225e83cf7ca686b42b115,
// clock/RNG/key-id stubbed, capture run 2026-07-31. Each case's `sourceTests`
// name the reference test(s) whose input it replicates.
//
// Byte discipline: every load-bearing comparison is over canonical
// serializations — `JSON.stringify` for derived components (on the legacy
// chain those bytes ARE the hashed bytes) and the fixture's captured
// `serializedJson` / hash hex strings for the assembled envelope. No
// deep-equal approximations.
//
// A NINTH CASE, AND WHY IT IS NOT IN THAT FILE (civic-ai-tools#199 §1). All
// eight cases above carry a trace with ZERO spans (seven `{resourceSpans: []}`
// and one BlobRef), so every one of them is green for anything the tool-span
// loop does: the graph builder's span walk, skill extraction from a
// skill_fetch span, and the trace half of dataSources population reach no
// byte this suite compares. `website-golden.json` carries nine spans, five of
// them `mcp_tool_call`, so a spanless byte-compat suite was a choice and not a
// limit of the format. `__fixtures__/span-carrying-golden.json` adds the
// missing case; it is a separate file because reference-golden.json is a
// verbatim upstream copy (see the sha256 above) and a case added inside it
// would break that. It ADDS bytes and moves none: the eight cases above are
// still compared against the frozen copy, unchanged.
//
// Its expectations are frozen REFERENCE capture, not this code's output: the
// trace, the provenance graph and the dataSources come from
// `website-golden.json` (captured 2026-08-01 from the reference
// implementation), lifted by one documented string substitution for the
// synthetic prompt hash that capture used. Only the two hashes are recorded
// in the new fixture, and they pin every byte of the assembled package.
//
// TWO VOCABULARY ERAS (spec Appendix J — the 2026-08-19 settlement). The
// fixture is a 2026-07-31 capture, so the URNs inside its `serializedJson`
// are prior-era AND ARE THE HASHED BYTES: the captured content/envelope
// hashes are hashes of those exact strings. The fixture is therefore frozen
// twice over (its own sha256 pin above, and the hash chain inside it) and no
// byte of it is edited here. Instead the suite runs BOTH legs:
//
//   - PRIOR-ERA leg — derive with PRIOR_ERA_CIVIC_VOCABULARY injected and
//     demand the original byte/hash identity, unchanged from before the
//     settlement. This is the standing proof that an already-signed record
//     still reproduces and still verifies.
//   - SETTLEMENT-ERA leg — derive with the DEFAULT vocabulary and demand the
//     result equals the fixture's bytes with exactly the two Appendix J
//     literals substituted, with the hashes recomputed from those substituted
//     bytes by verify-core's own `computeEnvelopeHash` /
//     `computeContentHashSha256`. The expected side is the frozen fixture put
//     through a pure string transform and hashed by the shared chain; the
//     actual side is the harness deriving from raw inputs. They meet only if
//     the whole derive→assemble chain is right, so this pins new-era bytes
//     without minting a self-generated golden (which would pin the code
//     against itself) and without touching the frozen fixture.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import {
  buildEnvelope,
  computeContentHashSha256,
  computeEnvelopeHash,
  DATHERE_AG_JUPYTER_CANONICALIZATION,
  LEGACY_JSON_CANONICALIZATION,
  type EnvelopeInput,
  type RecordPackage,
} from '@typedstandards/produce-core';
// verify-core primitives via produce-core's own dependency (present
// transitively by construction — same documented pattern as src/).
import { isBlobRef, parseBlobRef } from '@typedstandards/verify-core';
import {
  hash,
  extractSkillMetadata,
  traceForInspection,
  buildDataSources,
  buildProvenanceGraph,
  deriveDatHereEnvelopeFields,
  CIVICAITOOLS_PROVENANCE_CONFIG,
  CIVICAITOOLS_ENVIRONMENT_CONFIG,
  ENVIRONMENT_EXTENSION_KEY,
  CIVIC_NS,
  CIVIC_URN_PREFIX,
  PRIOR_ERA_CIVIC_NS,
  PRIOR_ERA_CIVIC_URN_PREFIX,
  PRIOR_ERA_CIVIC_VOCABULARY,
  type ProvenanceConfig,
  type ToolCallSummary,
} from './index.ts';

/** The reference provenance config with the PRIOR-era vocabulary injected —
 *  the only configuration under which this 2026-07-31 capture reproduces. */
const PRIOR_ERA_PROVENANCE_CONFIG: ProvenanceConfig = {
  ...CIVICAITOOLS_PROVENANCE_CONFIG,
  vocabulary: PRIOR_ERA_CIVIC_VOCABULARY,
};

/** Lift a prior-era serialization to the settlement era by substituting
 *  exactly the two Appendix J literals — nothing else in the bytes moves. */
function toSettlementEra(json: string): string {
  return json
    .replaceAll(`${PRIOR_ERA_CIVIC_URN_PREFIX}:`, `${CIVIC_URN_PREFIX}:`)
    .replaceAll(PRIOR_ERA_CIVIC_NS, CIVIC_NS);
}

// --- Fixture loading ---

interface GoldenEnvelopeCase {
  name: string;
  sourceTests: string[];
  input: Record<string, unknown>;
  expected: {
    serializedJson: string;
    contentHashSha256: string | null;
    envelopeHash: string;
  };
}

const FIXTURE = JSON.parse(
  readFileSync(
    join(dirname(fileURLToPath(import.meta.url)), '__fixtures__', 'reference-golden.json'),
    'utf8',
  ),
) as {
  _meta: { referenceRepo: string; referenceCommit: string };
  envelopeCases: GoldenEnvelopeCase[];
};

test('fixture copy is intact: provenance metadata + all eight captured envelope cases', () => {
  assert.equal(FIXTURE._meta.referenceRepo, 'civic-ai-tools-website');
  assert.equal(FIXTURE._meta.referenceCommit, 'd39fdc17e8e237b5cac225e83cf7ca686b42b115');
  assert.equal(FIXTURE.envelopeCases.length, 8);
});

// --- The raw/derived split, per case ---
//
// The fixture inputs carry the reference packager's DERIVED values verbatim
// (that was S1's point). To reproduce them from the input side we must first
// name, per case, which fields were RAW caller/app inputs in the reference
// flow — everything else below is recomputed by the harness and byte-compared
// against what the fixture carries.
//
// Raw in EVERY case (never harness work):
//   - identity: packageId / createdAt / signingKeyId (the fixture's stubbed
//     clock, RNG, and key-id environment read);
//   - prompt, promptVisibility, output, trace, cost (incl. the app-side
//     totalTokens roll-up), and the route labels captureMethod /
//     contentProfile / type / signer;
//   - `queries` — the reference packager maps these from its tool-call
//     capture app-side (packager.ts:340, using the MCP layer's
//     deriveOperationType); that mapping was NOT part of the S2 port, so the
//     entries stay caller-supplied. The tool-call summary the harness's
//     dataSources population walks is reconstructed from them 1:1
//     ({ name: tool, args: arguments }) — the same pairing the reference
//     capture produced them from.
//
// Case-specific raw fields are declared here:
interface RawCaseSpec {
  /** Explicit producerProfile (route-supplied). Absent ⇒ the harness
   *  auto-derivation must produce the fixture's carried value. */
  explicitProducerProfile?: string;
  /** Explicit skillMetadata override — the documented app-side requirement
   *  when the trace ships as a BlobRef (spans can't be inspected). */
  skillMetadataOverride?: Record<string, unknown>;
}

const RAW_SPECS: Record<string, RawCaseSpec> = {
  'legacy-inline': {},
  'legacy-capture-method': {},
  'v01-default': {},
  'v01-dathere-empty-notebook': {},
  'v01-dathere-executed-notebook': {},
  'legacy-blobref-output': {},
  'legacy-blobref-trace-skill-override': {
    // Trace is a BlobRef: the reference flow REQUIRES the caller override
    // (packager.ts:363–371); the extraction-degrades path is asserted below.
    skillMetadataOverride: undefined, // filled from the fixture input at runtime
  },
  'v01-signer-producer-capture': {
    // The route default-fills an explicit producerProfile on this path; the
    // harness derivation must pass it through unchanged (explicit wins).
    explicitProducerProfile: 'ai-assisted-analysis/civicaitools-default',
  },
  // The span-carrying ninth case: nothing route-supplied, so every harness
  // derivation runs — including the two that reach a span and were reachable
  // by no case above (skill extraction, and the graph builder's tool loop).
  'website-span-capture': {},
};

/** The raw caller-supplied extensions: the fixture input's extensions MINUS
 *  the auto-emitted environment extension (which is harness-derived). In the
 *  reference flow the remainder is the notebook written by the publish
 *  dialog. Returns undefined when nothing remains — insertion order of the
 *  surviving keys is preserved (the byte contract). */
function rawCallerExtensions(
  extensions: Record<string, unknown> | undefined,
): Record<string, unknown> | undefined {
  if (!extensions) return undefined;
  const raw: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(extensions)) {
    if (k !== ENVIRONMENT_EXTENSION_KEY) raw[k] = v;
  }
  return Object.keys(raw).length > 0 ? raw : undefined;
}

/** Derive every harness-owned envelope component for a fixture case from its
 *  RAW inputs, plus the assembled envelope input built from raw + derived
 *  values only. */
function deriveCase(c: GoldenEnvelopeCase, provenanceConfig: ProvenanceConfig) {
  const input = c.input as unknown as EnvelopeInput;
  const spec = RAW_SPECS[c.name];
  assert.ok(spec, `${c.name}: no raw/derived split declared for this case`);

  // Capture-side inspection view (BlobRef traces degrade to an empty trace —
  // packager.ts:354–357, ported as traceForInspection).
  const inspectable = traceForInspection(input.trace);

  // Skill metadata: extract from spans, or the caller override when the
  // trace is a BlobRef (the reference flow's rule).
  const skillMetadata =
    'skillMetadataOverride' in spec
      ? (c.input.skillMetadata as EnvelopeInput['skillMetadata'])
      : (extractSkillMetadata(inspectable) as EnvelopeInput['skillMetadata']);

  // Tool-call summary reconstructed 1:1 from the app-side query entries.
  const toolCalls: ToolCallSummary[] = input.queries.map((q) => ({
    name: q.tool,
    args: q.arguments,
  }));
  const portal = input.queries[0]?.portal ?? 'data.cityofnewyork.us';

  // dataSources population (harness capture group). The reference used its
  // publish-time clock for accessTimestamp — the fixture stubbed that clock
  // to createdAt.
  const dataSources = buildDataSources(toolCalls, inspectable, portal, input.createdAt);

  // PROV-O graph (harness capture group, reference config passed explicitly —
  // 0.2.0 requires it; the vocabulary era rides on that config). BlobRef
  // outputs contribute their ref hash instead of a rehash
  // (packager.ts:377–383).
  const outputIsBlob = isBlobRef(input.output);
  const provenance = buildProvenanceGraph(
    inspectable,
    {
      packageId: input.packageId,
      promptHash: hash(input.prompt),
      promptText: input.promptVisibility === 'full_text' ? input.prompt : undefined,
      outputText: outputIsBlob ? undefined : (input.output as string),
      outputHash: outputIsBlob
        ? parseBlobRef((input.output as { ref: string }).ref).hash
        : undefined,
      model: input.cost.model,
      portal,
    },
    provenanceConfig,
  );

  // datHere policy (harness format-extension group): producerProfile
  // auto-derivation, canonicalization-rule selection, summary gate,
  // environment-extension layering — driven by RAW inputs only.
  const fields = deriveDatHereEnvelopeFields({
    model: input.cost.model,
    contentProfile: input.contentProfile,
    producerProfile: spec.explicitProducerProfile,
    summary: input.summary,
    skillMcpServerUrl: skillMetadata.mcpServerUrl,
    extensions: rawCallerExtensions(input.extensions),
  }, CIVICAITOOLS_ENVIRONMENT_CONFIG);

  // Assembly input: raw fields + harness-derived values ONLY — none of the
  // fixture input's carried derived fields flow through.
  const assembled: EnvelopeInput = {
    packageId: input.packageId,
    createdAt: input.createdAt,
    signingKeyId: input.signingKeyId,
    prompt: input.prompt,
    promptVisibility: input.promptVisibility,
    queries: input.queries,
    dataSources,
    cost: input.cost,
    skillMetadata,
    output: input.output,
    trace: input.trace,
    captureMethod: input.captureMethod,
    contentProfile: input.contentProfile,
    type: input.type,
    signer: input.signer,
    provenance,
    // The derived datHere-policy fields. Like the reference packager, the
    // canonicalization rule is derived unconditionally — the core's v0.1
    // discriminator gates its emission, so legacy cases stay byte-identical.
    producerProfile: fields.producerProfile,
    contentCanonicalization: fields.contentCanonicalization,
    summary: fields.summary,
    extensions: fields.extensions,
  };

  return { input, spec, inspectable, skillMetadata, dataSources, provenance, fields, assembled };
}

// --- The ninth case: a golden that carries mcp_tool_call spans (#199 §1) ---

const WEBSITE_GOLDEN = JSON.parse(
  readFileSync(
    join(dirname(fileURLToPath(import.meta.url)), '__fixtures__', 'website-golden.json'),
    'utf8',
  ),
) as {
  trace: Record<string, unknown>;
  provenanceGraph: Record<string, unknown>;
  dataSources: unknown[];
};

const SPAN_FIXTURE = JSON.parse(
  readFileSync(
    join(dirname(fileURLToPath(import.meta.url)), '__fixtures__', 'span-carrying-golden.json'),
    'utf8',
  ),
) as {
  case: {
    name: string;
    sourceFixture: string;
    promptHashPlaceholder: string;
    input: Record<string, unknown>;
    expected: { contentHashSha256: string; envelopeHash: string };
  };
};

/** Every span in the frozen website capture. */
function websiteGoldenSpans(): Array<{ name: string; attributes: Array<{ key: string; value: { stringValue?: string } }> }> {
  const trace = WEBSITE_GOLDEN.trace as {
    resourceSpans?: Array<{ scopeSpans?: Array<{ spans?: Array<{ name: string; attributes: Array<{ key: string; value: { stringValue?: string } }> }> }> }>;
  };
  return (trace.resourceSpans ?? []).flatMap((rs) => (rs.scopeSpans ?? []).flatMap((ss) => ss.spans ?? []));
}

/** A frozen span's attribute, read straight out of the fixture — the expected
 *  side of skill extraction, so the extractor is not its own expectation. */
function frozenSpanAttribute(spanName: string, key: string): string {
  const span = websiteGoldenSpans().find((sp) => sp.name === spanName);
  assert.ok(span, `${spanName}: expected in the frozen capture`);
  const attr = span!.attributes.find((a) => a.key === key);
  assert.ok(attr?.value?.stringValue, `${spanName}.${key}: expected on the frozen span`);
  return attr!.value.stringValue!;
}

/** The frozen reference graph, lifted to this case's real prompt hash. A pure
 *  string transform of captured bytes — nothing here is regenerated by the
 *  code under test. */
function frozenProvenanceForCase(prompt: string): Record<string, unknown> {
  const frozen = JSON.stringify(WEBSITE_GOLDEN.provenanceGraph);
  const lifted = frozen.replaceAll(SPAN_FIXTURE.case.promptHashPlaceholder, hash(prompt));
  assert.notEqual(
    lifted,
    frozen,
    'the prompt-hash placeholder is not in the frozen capture — this lift would be silently doing nothing',
  );
  return JSON.parse(lifted) as Record<string, unknown>;
}

/** The ninth case, assembled from the raw inputs in its own fixture and the
 *  FROZEN derived values captured from the reference implementation. */
function spanCarryingCase(): GoldenEnvelopeCase {
  const raw = SPAN_FIXTURE.case.input;
  return {
    name: SPAN_FIXTURE.case.name,
    sourceTests: [
      'civic-ai-tools-website src/lib/evidence/provenance.ts + data-sources.ts, captured 2026-08-01 into __fixtures__/website-golden.json',
    ],
    input: {
      ...raw,
      trace: WEBSITE_GOLDEN.trace,
      dataSources: WEBSITE_GOLDEN.dataSources,
      skillMetadata: {
        systemPromptHash: frozenSpanAttribute('skill_fetch', 'skill.text_hash'),
        mcpServerUrl: frozenSpanAttribute('skill_fetch', 'skill.mcp_server_url'),
      },
      provenance: frozenProvenanceForCase(raw.prompt as string),
    },
    expected: {
      // Composed below from the frozen components, so the byte comparison is
      // against reference capture rather than against this code's own output.
      serializedJson: '',
      contentHashSha256: SPAN_FIXTURE.case.expected.contentHashSha256,
      envelopeHash: SPAN_FIXTURE.case.expected.envelopeHash,
    },
  };
}

const SPAN_CASE = spanCarryingCase();

/** The package the FROZEN components assemble into: the case's raw fields plus
 *  the reference-captured provenance, dataSources and skillMetadata, put
 *  through the same core assembly. This is the expected side; the actual side
 *  derives all three from the raw trace. */
function spanCaseExpectedPackage(provenanceConfig: ProvenanceConfig): {
  serializedJson: string;
  contentHashSha256: string | null;
  envelopeHash: string;
} {
  const { assembled } = deriveCase(SPAN_CASE, provenanceConfig);
  const { pkg, envelopeHash } = buildEnvelope({
    ...assembled,
    provenance: SPAN_CASE.input.provenance as EnvelopeInput['provenance'],
    dataSources: SPAN_CASE.input.dataSources as EnvelopeInput['dataSources'],
    skillMetadata: SPAN_CASE.input.skillMetadata as EnvelopeInput['skillMetadata'],
  });
  const built = pkg as RecordPackage;
  return {
    serializedJson: JSON.stringify(built),
    contentHashSha256: built.contentHash?.sha256 ?? null,
    envelopeHash,
  };
}

SPAN_CASE.expected.serializedJson = spanCaseExpectedPackage(
  PRIOR_ERA_PROVENANCE_CONFIG,
).serializedJson;

/** The eight upstream cases plus the ninth. Every per-case test below runs
 *  over all nine. */
const ALL_CASES: GoldenEnvelopeCase[] = [...FIXTURE.envelopeCases, SPAN_CASE];

test('#199 §1: the ninth case is the only one that carries spans, and it carries tool spans', () => {
  // The premise the whole case rests on, measured rather than asserted. If a
  // future upstream copy of reference-golden.json starts carrying spans this
  // fails, and it should: at that point the shape of the gap has changed.
  const spansOf = (trace: unknown): Array<{ name: string }> => {
    const t = trace as { resourceSpans?: Array<{ scopeSpans?: Array<{ spans?: Array<{ name: string }> }> }> };
    return (t?.resourceSpans ?? []).flatMap((rs) => (rs.scopeSpans ?? []).flatMap((ss) => ss.spans ?? []));
  };
  for (const c of FIXTURE.envelopeCases) {
    assert.equal(
      spansOf((c.input as { trace: unknown }).trace).length,
      0,
      `${c.name}: an upstream case has started carrying spans`,
    );
  }
  const spans = spansOf(SPAN_CASE.input.trace);
  assert.equal(spans.length, 9, 'the ninth case carries the frozen capture\'s nine spans');
  assert.equal(
    spans.filter((sp) => sp.name === 'mcp_tool_call').length,
    5,
    'five of them are tool calls — the loop that was reachable by no golden case',
  );
  assert.equal(spans.filter((sp) => sp.name === 'skill_fetch').length, 1, 'and one is a skill fetch');
});

test('#199 §1: the ninth case\'s span-derived expectations are the frozen reference capture, node for node', () => {
  // What makes this a GOLDEN and not a self-portrait. The derived graph is
  // compared against the 2026-08-01 capture of the reference implementation,
  // lifted only by the prompt-hash substitution the fixture documents — and
  // the blast radius of that lift is measured here too, so "lifted" cannot
  // quietly come to mean "regenerated".
  //
  // Compared BY POSITION, not by `@id`. The builder pushes two nodes that
  // share an id with an earlier one (the first inference gains its
  // qualifiedAssociation, the output entity its generation edge), so a map
  // keyed by id silently drops nodes — 26 keys for 28 nodes. Position is also
  // the byte contract: `JSON.stringify` writes the array in order.
  const { provenance, dataSources, skillMetadata } = deriveCase(
    SPAN_CASE,
    PRIOR_ERA_PROVENANCE_CONFIG,
  );
  const nodesOf = (g: unknown): Array<Record<string, unknown>> =>
    (g as { '@graph': Array<Record<string, unknown>> })['@graph'];
  const lifted = nodesOf(SPAN_CASE.input.provenance);
  const frozen = nodesOf(WEBSITE_GOLDEN.provenanceGraph);
  const derived = nodesOf(provenance);

  // 1. The lift moved exactly two of the capture's 28 nodes: the prompt entity
  //    the synthetic hash names, and the one inference that uses it. Every
  //    span-derived node is frozen capture, untouched.
  assert.equal(frozen.length, 28, 'the frozen capture has 28 nodes');
  assert.equal(lifted.length, frozen.length, 'the lift adds and removes nothing');
  const movedByLift = frozen
    .map((node, i) => ({ id: node['@id'] as string, moved: JSON.stringify(node) !== JSON.stringify(lifted[i]) }))
    .filter((n) => n.moved)
    .map((n) => n.id);
  assert.deepEqual(
    movedByLift,
    [
      // The prompt entity the synthetic hash names …
      `urn:civic-evidence:pkg-golden-001:prompt:${SPAN_FIXTURE.case.promptHashPlaceholder}`,
      // … and the two inferences that reference it in `prov:used`. Nothing
      // else in the capture mentions the prompt hash, and in particular no
      // node derived from a span does.
      'urn:civic-evidence:pkg-golden-001:inference:inf-1',
      'urn:civic-evidence:pkg-golden-001:inference:inf-2',
    ],
    'the prompt-hash substitution reached a node it has no business reaching',
  );

  // 2. Every node the harness derives from the raw trace is byte-identical to
  //    the (lifted) capture — including the eighteen that come out of a span.
  const spanDerived = lifted.filter((n) => /:tool-call:|:data:|:query:|:mcp-server:/.test(n['@id'] as string));
  assert.equal(
    spanDerived.length,
    18,
    'the frozen capture\'s span-derived nodes: 5 tool-call activities, 5 query entities, 4 data responses and 4 MCP source agents — every one of them out of a span, and every one of them unreachable by the eight spanless cases',
  );
  assert.equal(derived.length, lifted.length, 'the derived graph carries the same number of nodes');
  for (const [i, node] of lifted.entries()) {
    assert.equal(
      JSON.stringify(derived[i]),
      JSON.stringify(node),
      `node ${i} (${node['@id']}): diverged from the reference capture`,
    );
  }

  assert.equal(
    JSON.stringify(dataSources),
    JSON.stringify(WEBSITE_GOLDEN.dataSources),
    'the four dataSources entries are the frozen capture, byte for byte',
  );
  // Byte comparison, like every other seam in this suite: the extractor
  // returns `skillText: undefined` as an own property (a BlobRef slot it did
  // not fill), which JSON.stringify drops and which is therefore not in the
  // signed bytes.
  assert.equal(
    JSON.stringify(skillMetadata),
    JSON.stringify({
      systemPromptHash: frozenSpanAttribute('skill_fetch', 'skill.text_hash'),
      mcpServerUrl: frozenSpanAttribute('skill_fetch', 'skill.mcp_server_url'),
    }),
    'skill metadata is what the frozen skill_fetch span carries — read from the span, not from the extractor',
  );
});

test('#199 §1: the ninth case\'s recorded hashes are the hashes of the frozen composition', () => {
  const composed = spanCaseExpectedPackage(PRIOR_ERA_PROVENANCE_CONFIG);
  assert.equal(
    composed.envelopeHash,
    SPAN_FIXTURE.case.expected.envelopeHash,
    'the recorded envelope hash is not the hash of the package the frozen components assemble into',
  );
  assert.equal(
    composed.contentHashSha256,
    SPAN_FIXTURE.case.expected.contentHashSha256,
    'the recorded content hash is not the hash of that package either',
  );
});

// --- Per-case: derivation-seam byte parity + assembled byte-golden ---

for (const c of ALL_CASES) {
  test(`golden input-side [prior era][${c.name}]: harness derivations reproduce the carried derived values byte-for-byte`, () => {
    const { input, spec, skillMetadata, dataSources, provenance, fields } = deriveCase(
      c,
      PRIOR_ERA_PROVENANCE_CONFIG,
    );

    // PROV-O graph — byte parity (legacy chain hashes JSON.stringify bytes).
    assert.equal(
      JSON.stringify(provenance),
      JSON.stringify(input.provenance),
      `${c.name}: derived provenance graph diverged from the reference capture`,
    );

    // dataSources — byte parity.
    assert.equal(
      JSON.stringify(dataSources),
      JSON.stringify(input.dataSources),
      `${c.name}: derived dataSources diverged from the reference capture`,
    );

    // skillMetadata — byte parity (extraction for span traces; the caller
    // override carried verbatim for the BlobRef-trace case).
    assert.equal(
      JSON.stringify(skillMetadata),
      JSON.stringify(input.skillMetadata),
      `${c.name}: skillMetadata diverged from the reference capture`,
    );

    // datHere policy fields against the carried values.
    assert.equal(fields.producerProfile, input.producerProfile, `${c.name}: producerProfile`);
    if (input.type !== undefined) {
      // v0.1 cases carry the rule explicitly; legacy cases omit it (the
      // reference derived it unconditionally but only emitted it on v0.1 —
      // same as the harness+core seam assembled below).
      assert.equal(
        fields.contentCanonicalization,
        input.contentCanonicalization,
        `${c.name}: contentCanonicalization`,
      );
    }
    assert.equal(fields.summary, input.summary, `${c.name}: summary emission gate`);
    assert.equal(
      JSON.stringify(fields.extensions),
      JSON.stringify(input.extensions),
      `${c.name}: extensions (environment layering + caller passthrough)`,
    );
    if (spec.explicitProducerProfile !== undefined) {
      assert.equal(fields.producerProfile, spec.explicitProducerProfile, `${c.name}: explicit wins`);
    }
  });

  test(`golden input-side [prior era][${c.name}]: derived assembly reproduces the reference bytes, content hash, envelope hash`, () => {
    const { assembled } = deriveCase(c, PRIOR_ERA_PROVENANCE_CONFIG);
    const { pkg, envelopeHash } = buildEnvelope(assembled);
    const built = pkg as RecordPackage;

    // 1. Serialized canonical JSON is byte-identical (insertion order and all).
    assert.equal(JSON.stringify(built), c.expected.serializedJson, `${c.name}: serialized JSON diverged`);

    // 2. The multihash content hash is identical (v0.1) / absent (legacy).
    if (c.expected.contentHashSha256 === null) {
      assert.ok(!('contentHash' in built), `${c.name}: legacy case must not emit contentHash`);
    } else {
      assert.equal(built.contentHash?.sha256, c.expected.contentHashSha256, `${c.name}: contentHash diverged`);
    }

    // 3. The envelope hash is identical.
    assert.equal(envelopeHash, c.expected.envelopeHash, `${c.name}: envelope hash diverged`);
  });

  test(`golden input-side [settlement era][${c.name}]: the default vocabulary reproduces the reference bytes with exactly the two Appendix J literals substituted, and the hashes of those bytes`, () => {
    const { assembled } = deriveCase(c, CIVICAITOOLS_PROVENANCE_CONFIG);
    const { pkg, envelopeHash } = buildEnvelope(assembled);
    const built = pkg as RecordPackage;

    // The expected side: the FROZEN fixture bytes put through a pure string
    // substitution. Nothing is regenerated by the code under test.
    const substituted = toSettlementEra(c.expected.serializedJson);
    const carriesVocabulary = substituted !== c.expected.serializedJson;
    const expectedPkg = JSON.parse(substituted) as Record<string, unknown>;

    // v0.1 packages EMBED `contentHash`, which fingerprints content the
    // vocabulary lives inside — so the era flip necessarily moves that field
    // too, and a pure string substitution cannot produce it. Recompute it from
    // the substituted bytes with verify-core's own `computeContentHashSha256`
    // (it strips `contentHash` before hashing, so this is well-defined on a
    // package that already carries one). JSON.parse preserves source key
    // order, so overwriting the value in place keeps `contentHash` spread last
    // — the byte contract the envelope assembles under.
    if (c.expected.contentHashSha256 !== null) {
      const rule = expectedPkg.contentCanonicalization as string;
      (expectedPkg.contentHash as { sha256: string }).sha256 = computeContentHashSha256(
        expectedPkg,
        rule,
      );
      // Whether contentHash MOVES across the era flip is a property of the
      // canonicalization rule's hashed surface, and pinning it per rule is
      // part of the coverage:
      //   - legacy-json/v1 hashes the whole package, provenance graph
      //     included, so the vocabulary IS inside the fingerprint and it must
      //     move;
      //   - dathere-ag-jupyter/v1 hashes only the executed notebook
      //     (extensions['org.civicaitools.notebook']), which carries no civic
      //     vocabulary at all, so it must NOT move — a changed value there
      //     would mean the rule had started covering something it does not.
      // The ENVELOPE hash covers the whole package under both rules and moves
      // either way (asserted below).
      const moved = (expectedPkg.contentHash as { sha256: string }).sha256;
      if (rule === LEGACY_JSON_CANONICALIZATION) {
        assert.notEqual(
          moved,
          c.expected.contentHashSha256,
          `${c.name}: legacy-json/v1 hashes the whole package — the era flip must move contentHash`,
        );
      } else if (rule === DATHERE_AG_JUPYTER_CANONICALIZATION) {
        assert.equal(
          moved,
          c.expected.contentHashSha256,
          `${c.name}: dathere-ag-jupyter/v1 hashes only the notebook — the era flip must NOT move contentHash`,
        );
      }
    }
    const expectedJson = JSON.stringify(expectedPkg);

    // 1. Serialized canonical JSON matches the era-lifted reference bytes.
    assert.equal(JSON.stringify(built), expectedJson, `${c.name}: settlement-era serialized JSON diverged`);

    // 2. Content hash + envelope hash are the hashes OF those bytes, computed
    //    by verify-core's shared chain from the substituted fixture — the same
    //    functions the prior-era pins were produced with, run on the other era.
    assert.equal(
      envelopeHash,
      computeEnvelopeHash(expectedPkg),
      `${c.name}: settlement-era envelope hash diverged`,
    );
    if (c.expected.contentHashSha256 === null) {
      assert.ok(!('contentHash' in built), `${c.name}: legacy case must not emit contentHash`);
    } else {
      assert.equal(
        built.contentHash?.sha256,
        (expectedPkg.contentHash as { sha256: string }).sha256,
        `${c.name}: settlement-era contentHash diverged`,
      );
    }

    // 3. Non-vacuity + no era mixing. Cases whose envelope carries no
    //    vocabulary at all (no provenance graph) legitimately have identical
    //    bytes across eras; every other case must have MOVED, and no case may
    //    emit a prior-era term.
    if (carriesVocabulary) {
      assert.notEqual(
        envelopeHash,
        c.expected.envelopeHash,
        `${c.name}: the era flip changed bytes but not the hash — the hash chain is not covering the vocabulary`,
      );
    }
    assert.ok(
      !JSON.stringify(built).includes(PRIOR_ERA_CIVIC_URN_PREFIX),
      `${c.name}: a settlement-era package must carry no prior-era identifier`,
    );
    assert.ok(
      !JSON.stringify(built).includes(PRIOR_ERA_CIVIC_NS),
      `${c.name}: a settlement-era package must carry no prior-era namespace URI`,
    );
  });
}

test('the era substitution is non-trivial on this fixture: every case with a provenance graph moves bytes', () => {
  const moved = ALL_CASES.filter(
    (c) => toSettlementEra(c.expected.serializedJson) !== c.expected.serializedJson,
  );
  assert.equal(
    moved.length,
    ALL_CASES.length,
    'a case stopped carrying vocabulary — the settlement-era leg would be passing vacuously for it',
  );
});

// --- The degraded paths the BlobRef cases route through ---

test('BlobRef trace: the inspection view degrades to an empty trace and extraction yields {} (the override is REQUIRED, not redundant)', () => {
  const c = FIXTURE.envelopeCases.find((x) => x.name === 'legacy-blobref-trace-skill-override');
  assert.ok(c);
  const input = c!.input as unknown as EnvelopeInput;
  assert.ok(isBlobRef(input.trace), 'fixture trace should be a BlobRef');
  const inspectable = traceForInspection(input.trace);
  assert.equal(JSON.stringify(inspectable), JSON.stringify({ resourceSpans: [] }));
  assert.equal(JSON.stringify(extractSkillMetadata(inspectable)), '{}');
});

test('BlobRef output: the provenance output entity carries the ref hash, not a rehash of the ref object', () => {
  const c = FIXTURE.envelopeCases.find((x) => x.name === 'legacy-blobref-output');
  assert.ok(c);
  const input = c!.input as unknown as EnvelopeInput;
  assert.ok(isBlobRef(input.output), 'fixture output should be a BlobRef');
  const refHash = parseBlobRef((input.output as { ref: string }).ref).hash;
  const graph = (c!.input.provenance as { '@graph': Array<{ '@id': string }> })['@graph'];
  const outputNode = graph.find((n) => n['@id'].includes(':output:'));
  assert.ok(outputNode);
  // The node inspected here is the FIXTURE's carried graph, not a fresh
  // emission — so its id is prior-era by construction and stays that way
  // forever. Naming the constant rather than the literal keeps the intent
  // explicit: this is not a site the settlement flips.
  assert.equal(
    outputNode!['@id'],
    `${PRIOR_ERA_CIVIC_URN_PREFIX}:${input.packageId}:output:${refHash}`,
  );
});
