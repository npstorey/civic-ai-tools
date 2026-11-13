// The router's domain-free core. Imports nothing from `../civic/` and nothing
// from any package; `boundary.test.ts` holds it to that.

export type {
  ChosenBy,
  ConfiguredAddresses,
  ConsentDefault,
  ContainerVariant,
  FunctionDefinition,
  FunctionToolSchema,
  GuidanceEntry,
  HarnessDefinition,
  HarnessDefinitionComponent,
  HostingRunsAt,
  HostingVariant,
  HostingVariantCommon,
  InstanceLoggingPosture,
  JsonSchema,
  LoggingKeeps,
  LoggingPosture,
  Manifest,
  ManifestEntry,
  NpmPackageVariant,
  RemoteVariant,
  Requirement,
  SourceConfiguration,
  SourceHosting,
  SourceView,
  StatedLoggingPosture,
  ToolLike,
} from './types.ts';
export {
  configuredAddress,
  isEntryOffered,
  isOfferedReason,
  offeredEntries,
  offeredReason,
  offerTools,
  sourcesOffered,
  withheldToolNames,
  type OfferedReason,
  type SourceOffered,
  type SourceSelection,
} from './select.ts';
export { BLOCK_SEPARATOR, composeManifestPrompt, composePrompt, type PromptFrame } from './compose.ts';
export {
  composeDirectory,
  directoryLine,
  directorySentence,
  FIND_SOURCE_LIMIT,
  FIND_SOURCE_TOOL_NAME,
  findSourceTool,
  LOAD_SOURCE_TOOL_NAME,
  loadSourceTool,
  type DirectoryEntry,
  type DirectoryFrame,
  type FindSourceResultText,
  type FindSourceToolText,
  type LoadSourceToolText,
} from './directory.ts';
export {
  createSearchIndex,
  SEARCH_DEFAULT_TOP,
  SEARCH_METHOD,
  type SearchableEntry,
  type SearchIndex,
  type SearchMethod,
  type SearchOptions,
} from './search.ts';
export {
  routingConfiguration,
  RoutingConfigurationError,
  type RoutingConfiguration,
  type RoutingConfigurationRecord,
  type RoutingInventory,
  type RoutingRule,
} from './routing-configuration.ts';
export { canonicalJson, CanonicalJsonError } from './canonical-json.ts';
export { canonicalJsonValue, CanonicalJsonValueError } from './canonical-json-value.ts';
export { checkBasePins, type BasePin, type BasePinCheck, type BasePinDifference, type ObservedBase } from './base-pins.ts';
export { apiContains, routesByApi, type ApiRouteGroup, type ApiStatement } from './routes-by-api.ts';
export { mcpToolSchemaSha256, mcpToolSchemaText, schemaWithoutAnnotations, type McpListedTool } from './mcp-tool-schema.ts';
export { sha256, sha256Hex } from './sha256.ts';
export {
  InventoryLoadError,
  manifestFromInventory,
  packHash,
  toolsSha256,
  type EntryCode,
  type EntryKind,
  type EntryKinds,
  type InventoryDataField,
  type InventoryDocument,
  type InventoryEntry,
  type InventoryPackEntry,
  type InventoryServerEntry,
  type InventoryToolsRef,
  type PackCode,
} from './inventory.ts';
export { CHOSEN_BY, HarnessDefinitionError, harnessDefinitionOf, type HarnessDefinitionParts } from './definition.ts';
export {
  assertUniqueToolNames,
  DuplicateToolNameError,
  findDuplicateToolNames,
  toolNamesMatchSchemas,
  toolSourceIndex,
  type DuplicateToolName,
  type ToolSourceIndex,
} from './tool-index.ts';
export {
  ALIAS_PATTERN,
  ALIAS_SEPARATOR,
  aliasedGuidance,
  aliasedToolName,
  aliasedTools,
  aliasedView,
  aliasedWithheldToolNames,
  anchoredRewrite,
  BARE_VIEW,
  checkToolNames,
  dispatchMap,
  entryToolsInView,
  exposedToolName,
  findToolNameProblems,
  MAX_TOOL_NAME_LENGTH,
  normalizeToolName,
  resolveCalledName,
  sourceForAliasedName,
  TOOL_NAME_PATTERN,
  ToolNameError,
  unaliasText,
  upstreamToolName,
  type CalledNameResolution,
  type DispatchMap,
  type DispatchTarget,
  type ToolNameProblem,
} from './alias.ts';
