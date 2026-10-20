// The civic content: the civic sources' manifest entries, their texts, the
// one-portal lock, the prompt frame and the configuration reader. May import
// `../core/`; core never imports from here.

export {
  CIVIC_DOMAIN,
  CIVIC_MANIFEST,
  civicRouter,
  createCivicRouter,
  type BuildSystemPromptInput,
  type CivicRouter,
  type DirectoryPromptInput,
  type HarnessDefinitionInput,
  type InLoopSystemPromptInput,
  type LoadSourceToolInput,
} from './router.ts';
export type {
  CivicGuidanceContext,
  CivicManifest,
  CivicManifestEntry,
  CivicPortalLock,
  CivicPromptParts,
  InstructionsFetcher,
  PromptFetcher,
} from './context.ts';
export {
  BOSTON_OPENCONTEXT_ADDRESS_VARIABLE,
  configuredAddresses,
  configuredSources,
  DATA_COMMONS_ADDRESS_VARIABLE,
  DATA_COMMONS_DEFAULT_ADDRESS,
  DATA_COMMONS_KEY_VARIABLE,
  HOSTING_SANDBOX,
  NYC_CHARTER_HOSTING_SANDBOX,
  NYC_CHARTER_HOSTING_VARIABLE,
  NYC_CHECKBOOK_HOSTING_VARIABLE,
  NYC_RECORD_HOSTING_VARIABLE,
  NYS_LEGISLATION_HOSTING_VARIABLE,
  readMcpEnv,
  SOCRATA_ADDRESS_VARIABLE,
  type ConfigurationSource,
  type McpRegistryEnv,
} from './env.ts';
export {
  getSkillForPortal,
  SOCRATA_ENTRY,
  SOCRATA_SKILL_FALLBACK,
  SOCRATA_TOOL_NAMES,
  SOCRATA_TOOLS,
  socrataGuidanceText,
  socrataSkillFallback,
  socrataTools,
} from './socrata.ts';
export {
  DATA_COMMONS_ENTRY,
  DATA_COMMONS_TOOL_NAMES,
  DATA_COMMONS_TOOLS,
  dataCommonsGuidanceText,
  dataCommonsSkill,
  dataCommonsTools,
} from './data-commons.ts';
export {
  BOSTON_OPENCONTEXT_ENTRY,
  BOSTON_OPENCONTEXT_SKILL,
  BOSTON_OPENCONTEXT_TOOL_NAMES,
  BOSTON_OPENCONTEXT_TOOLS,
  bostonGuidanceText,
  bostonSkill,
  bostonTools,
} from './boston.ts';
export {
  NYC_CHARTER_ENTRY,
  NYC_CHARTER_HOSTING,
  NYC_CHARTER_SANDBOX_VARIANT,
  NYC_CHARTER_TOOL_NAMES,
  NYC_CHARTER_TOOLS,
} from './nyc-charter.ts';
export {
  NYC_CHECKBOOK_ENTRY,
  NYC_CHECKBOOK_HOSTING,
  NYC_CHECKBOOK_SANDBOX_VARIANT,
  NYC_CHECKBOOK_TOOL_NAMES,
  NYC_CHECKBOOK_TOOLS,
} from './nyc-checkbook.ts';
export {
  NYC_RECORD_ENTRY,
  NYC_RECORD_HOSTING,
  NYC_RECORD_SANDBOX_VARIANT,
  NYC_RECORD_TOOL_NAMES,
  NYC_RECORD_TOOLS,
} from './nyc-record.ts';
export {
  NYS_LEGISLATION_ENTRY,
  NYS_LEGISLATION_HOSTING,
  NYS_LEGISLATION_SANDBOX_VARIANT,
  NYS_LEGISLATION_TOOL_NAMES,
  NYS_LEGISLATION_TOOLS,
} from './nys-legislation.ts';
export {
  lockedFetch,
  lockedGetData,
  lockedSearch,
  lockSocrataTools,
  portalLockSection,
  portalLockSectionFor,
} from './portal-lock.ts';
export {
  ALL_SOURCES,
  civicCitation,
  civicPreambleEntry,
  composeOutro,
  composePreamble,
  CROSS_SOURCE_PREAMBLE,
  crossSourcePreamble,
  DIRECTORY_FRESHNESS_LABEL,
  DIRECTORY_HEADING,
  DIRECTORY_PARAGRAPH,
  directoryFrameFor,
  introFor,
  LOAD_SOURCE_TOOL_TEXT,
  outroFor,
  sourceCountWord,
  type PromptSource,
  type SourceId,
} from './prompt-frame.ts';
