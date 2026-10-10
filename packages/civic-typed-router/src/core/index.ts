// The router's domain-free core. Imports nothing from `../civic/` and nothing
// from any package; `boundary.test.ts` holds it to that.

export type {
  ConfiguredAddresses,
  FunctionDefinition,
  FunctionToolSchema,
  GuidanceEntry,
  JsonSchema,
  Manifest,
  ManifestEntry,
  Requirement,
  SourceConfiguration,
  ToolLike,
} from './types.ts';
export { configuredAddress, isEntryOffered, offeredEntries, offerTools, withheldToolNames } from './select.ts';
export { BLOCK_SEPARATOR, composeManifestPrompt, composePrompt, type PromptFrame } from './compose.ts';
export {
  assertUniqueToolNames,
  DuplicateToolNameError,
  findDuplicateToolNames,
  toolNamesMatchSchemas,
  toolSourceIndex,
  type DuplicateToolName,
  type ToolSourceIndex,
} from './tool-index.ts';
