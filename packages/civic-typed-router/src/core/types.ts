// The router's domain-free types: a manifest of sources, each with its tool
// schemas and its guidance entry.
//
// Nothing here names a source, a tool or a sentence of guidance. The civic
// entries that fill these shapes live in `../civic/`, and this directory
// imports nothing from there and nothing from any package (`boundary.test.ts`).

/** A JSON-schema object, structurally. The router never interprets one; it
 *  hands the object to the model as it is. */
export type JsonSchema = { readonly [key: string]: unknown };

/** A function tool's definition: the shape a chat-completions request takes. */
export interface FunctionDefinition {
  readonly name: string;
  readonly description?: string;
  readonly parameters?: JsonSchema;
  readonly strict?: boolean | null;
}

/** One function tool, as handed to the model. Structural: a consumer's own
 *  tool type with this shape is accepted without an import in either direction. */
export interface FunctionToolSchema {
  readonly type: 'function';
  readonly function: FunctionDefinition;
}

/** Any entry a tools array may hold. The router reads the name of a
 *  `function` tool and passes every other kind through untouched. */
export interface ToolLike {
  readonly type: string;
}

/** Whether a run is offered the source when the instance configures no
 *  address for it. `required`: always (a required source the instance has not
 *  configured is refused by the consumer, not withheld here). `optional`: only
 *  when configured. */
export type Requirement = 'required' | 'optional';

/** How an instance configures a source. */
export interface SourceConfiguration {
  /** The configuration variable that offers the source: the one that carries
   *  its address, or, for a source the instance runs itself (an entry with an
   *  `npm-package` variant), the one that switches it on. A hosted source
   *  takes no address: its switch's value, which names the variant that is
   *  on, stands in its place in `ConfiguredAddresses` when it is on. */
  readonly addressVariable: string;
  /** The configuration variable that carries the source's key, if it takes one. */
  readonly keyVariable?: string;
  readonly requirement: Requirement;
  /** The address used when the instance sets none, if the source has one. */
  readonly defaultAddress?: string;
}

/**
 * How text names a tool in one view of the router's output (ADR-0032).
 *
 * The bare view names every tool by its upstream name: the bytes of 0.1.0.
 * The aliased view names it `<alias>__<upstream name>`, normalized where the
 * upstream name needs it (`exposedToolName`).
 */
export interface SourceView {
  /** The name the tool `upstreamName` of source `sourceId` has in this view.
   *  Text the router owns names every tool through this function. */
  toolName(sourceId: string, upstreamName: string): string;
  /** Text the router does not own (fetched guidance, a server's initialize
   *  instructions), as this view presents it: in the aliased view, the
   *  anchored rewrite of `sourceId`'s own tool names (`anchoredRewrite`). */
  sourceText(sourceId: string, text: string): string;
}

/** A source's contribution to the composed prompt. `fetchText` receives the
 *  consumer's context, which carries any fetchers it needs; the router itself
 *  performs no I/O. A text that is blank, or a call that throws, leaves the
 *  source out of the prompt. `view` is the view the text is composed in;
 *  absent, the bare view. */
export interface GuidanceEntry<Context> {
  fetchText(context: Context, view?: SourceView): Promise<string>;
}

/**
 * Where a source the instance runs itself comes from: an exact published
 * package, as a record can name it. It states what runs and what it may
 * reach, not how a host starts it or on which port. It carries no address: a
 * hosted source is reached at an address its host resolves per call, never
 * one an instance configures.
 *
 * Since 0.4.0 these five fields are the `npm-package` arm of
 * `HostingVariant` (`NpmPackageVariant`), under the same name, so a
 * `Pick<SourceHosting, …>` of them is unchanged (ADR-0036).
 *
 * Carried, never read by the router.
 */
export interface SourceHosting {
  /** The registry the package is published to. */
  readonly kind: 'npm-package';
  /** The package's registry name, as published (`@scope/name`). */
  readonly package: string;
  /** The exact version the instance installs: never a range. */
  readonly version: string;
  /** The commit the registry states for that version (its `gitHead`), in
   *  full. */
  readonly commit: string;
  /** The hosts the source may reach, applied when its host creates the
   *  sandbox it runs in. Empty: it may reach none. */
  readonly outbound: readonly string[];
}

/** Where a hosting variant runs: in a sandbox the instance creates, at the
 *  server's publisher, at a government's own server, or elsewhere (an
 *  address the instance configures, which the manifest cannot name for every
 *  instance). */
export type HostingRunsAt = 'instance-sandbox' | 'publisher' | 'government' | 'other';

/** What a log holder's statement says it keeps of a request: nothing,
 *  metadata about it (addresses, times, sizes), its content, or nothing
 *  either way. `not-stated` is a fact about a statement that was read: it is
 *  never written for one nobody read. */
export type LoggingKeeps = 'none' | 'metadata' | 'content' | 'not-stated';

/**
 * A log holder the manifest names, and what its own statement says it keeps:
 * policy text carried by reference, with the statement's address and the date
 * it was read. It is the holder's statement, never a fact the router, an
 * instance or a record attests (ADR-0036).
 */
export interface StatedLoggingPosture {
  readonly statedBy: 'manifest';
  /** The holder, named as its statement names it. */
  readonly holder: string;
  readonly keeps: LoggingKeeps;
  /** How long, as the statement puts it, when it says. */
  readonly retention?: string;
  /** The statement read: an `https:` address. */
  readonly statementUrl: string;
  /** The UTC date the statement was read, `YYYY-MM-DD`. */
  readonly readOn: string;
}

/**
 * A log holder the instance chooses (the platform its sandboxes run on, the
 * operator of an address it configures), which the manifest, the same for
 * every instance, cannot name for all of them. Named by role only: the
 * consuming app states the holder and its posture (ADR-0036).
 */
export interface InstanceLoggingPosture {
  readonly statedBy: 'instance';
  /** The holder's role, a key the consuming app states a posture for. */
  readonly role: string;
}

/** Who holds logs of what a variant is sent, and what each states it keeps. */
export type LoggingPosture = StatedLoggingPosture | InstanceLoggingPosture;

/** What every hosting variant carries. */
export interface HostingVariantCommon {
  /** The variant's name, unique within its entry. For a source offered by a
   *  switch, the switch's value that turns this variant on; a remote's single
   *  variant is selected by its address variable's presence. */
  readonly variant: string;
  readonly runsAt: HostingRunsAt;
  /** Every holder of logs of what the variant is sent, in the order the data
   *  flows: the server's holder first, then each onward recipient. */
  readonly logging: readonly LoggingPosture[];
}

/** A variant the instance runs from an exact published package, in a sandbox
 *  it creates: 0.3.0's `SourceHosting`, and what every variant carries. */
export interface NpmPackageVariant extends SourceHosting, HostingVariantCommon {}

/** A variant reached at an address the instance configures. It carries no
 *  package and no address. */
export interface RemoteVariant extends HostingVariantCommon {
  readonly kind: 'remote';
}

/** A variant run from a container image. A name in the type only: no
 *  container host is built, and no entry carries one. */
export interface ContainerVariant extends HostingVariantCommon {
  readonly kind: 'container';
}

/** One way a source can be run or reached, discriminated on `kind`. No arm
 *  carries an address. Carried, never read by the router. */
export type HostingVariant = NpmPackageVariant | RemoteVariant | ContainerVariant;

/** A source's state in a reader's first consent: On, or Ask first. */
export type ConsentDefault = 'on' | 'ask-first';

/** One source in a manifest. */
export interface ManifestEntry<Context = unknown> {
  /** The source's global identity: its MCP Registry name where it is
   *  published there, otherwise its package or service name and address.
   *  Carried, never read by the router. */
  readonly id: string;
  /** The operator's short name for the source, and the prefix of every tool
   *  name the aliased view exposes: `<alias>__<upstream name>`. It starts
   *  with a letter or an underscore, holds only `[A-Za-z0-9_-]`, contains no
   *  `__`, and is at most 32 characters (`checkToolNames`). */
  readonly alias: string;
  /** The key the source is routed, traced and recorded under. */
  readonly sourceId: string;
  /** The human-readable name of the source's server. */
  readonly displayName: string;
  /** One line, written for routing: what the source covers, for which
   *  places, and what it cannot do. No build or status notes. */
  readonly description: string;
  /** One line: how current the source's data is. Model-facing, so it carries
   *  no citation; the citation is `freshnessSource`. */
  readonly freshness: string;
  /** Where the `freshness` line comes from: a public source, never a
   *  deployment's address. A record of the claim, never model-facing. */
  readonly freshnessSource?: string;
  readonly configuration: SourceConfiguration;
  /** The source's tool schemas, in the order the model is offered them, in
   *  the bare view. */
  readonly tools: readonly FunctionToolSchema[];
  /** The source's tool schemas in a view, when the router owns their text:
   *  every tool named in a name or a description goes through
   *  `view.toolName`. `tools` is this function in the bare view. Absent, the
   *  aliased view renames each schema and applies the anchored rewrite to its
   *  descriptions (`entryToolsInView`). */
  readonly toolsFor?: (view: SourceView) => readonly FunctionToolSchema[];
  /** The server's tool names in the order its routing lists them. The same
   *  set as `tools` (`toolNamesMatchSchemas`); the order may differ, and the
   *  withheld-tools list follows this one. */
  readonly toolNames: readonly string[];
  readonly guidance: GuidanceEntry<Context>;
  /** The ways the source can be run or reached (ADR-0036). The consumer
   *  selects the variant in force from its configuration. Carried, never read
   *  by the router. */
  readonly hostings: readonly HostingVariant[];
  /** The source's state in a reader's first consent. Carried, never read by
   *  the router. */
  readonly consentDefault: ConsentDefault;
  /** The source's publisher, named as its own page names it. Carried, never
   *  read by the router. */
  readonly publisher?: string;
}

/** An ordered list of sources. The order is the order the prompt and the
 *  tools array name them. */
export type Manifest<Context = unknown> = readonly ManifestEntry<Context>[];

/** Each source's configured address, keyed by `sourceId`. A source with no
 *  key, or with an empty value, is not configured. A hosted source, which
 *  takes no address, is configured by its switch: its value here is the
 *  switch's value while the switch is on, and it has no key otherwise. */
export type ConfiguredAddresses = { readonly [sourceId: string]: string | undefined };

// --- The harness definition (ADR-0037) ---------------------------------------------

/** Who chose a composition's sources: the reader, the model (in-loop
 *  routing), or the instance (its configuration). */
export type ChosenBy = 'reader' | 'model' | 'instance';

/** One component of a composition, as the consumer's composition states it:
 *  its identity, the version the consumer knows, and the lowercase hex
 *  SHA-256 of its block as composed. */
export interface HarnessDefinitionComponent {
  readonly id: string;
  readonly version?: string;
  readonly guidanceHash?: string;
}

/** What one composition was made of, and the hash of that. */
export interface HarnessDefinition {
  /** The domain the composition is for (`'civic'` for this package's router). */
  readonly domain: string;
  /** The composed source ids, in composition order. */
  readonly sources: readonly string[];
  /** The consumer's components, in its order. */
  readonly components: readonly HarnessDefinitionComponent[];
  readonly chosenBy: ChosenBy;
  /** The lowercase hex SHA-256 of the canonical JSON of the four fields
   *  above (`canonicalJson`, `sha256Hex`). */
  readonly hash: string;
}
