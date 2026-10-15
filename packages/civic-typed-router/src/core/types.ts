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
  /** The configuration variable that carries the source's address. */
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
}

/** An ordered list of sources. The order is the order the prompt and the
 *  tools array name them. */
export type Manifest<Context = unknown> = readonly ManifestEntry<Context>[];

/** Each source's configured address, keyed by `sourceId`. A source with no
 *  key, or with an empty value, is not configured. */
export type ConfiguredAddresses = { readonly [sourceId: string]: string | undefined };
