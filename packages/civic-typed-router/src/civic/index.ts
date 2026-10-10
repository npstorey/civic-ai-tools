// The civic content: the three sources' manifest entries, their texts, the
// one-portal lock, the prompt frame and the configuration reader. May import
// `../core/`; core never imports from here.

export {
  CIVIC_MANIFEST,
  civicRouter,
  createCivicRouter,
  type BuildSystemPromptInput,
  type CivicRouter,
} from './router.ts';
export type {
  CivicGuidanceContext,
  CivicManifest,
  CivicManifestEntry,
  InstructionsFetcher,
  PromptFetcher,
} from './context.ts';
export {
  BOSTON_OPENCONTEXT_ADDRESS_VARIABLE,
  configuredAddresses,
  DATA_COMMONS_ADDRESS_VARIABLE,
  DATA_COMMONS_DEFAULT_ADDRESS,
  DATA_COMMONS_KEY_VARIABLE,
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
} from './socrata.ts';
export {
  DATA_COMMONS_ENTRY,
  DATA_COMMONS_TOOL_NAMES,
  DATA_COMMONS_TOOLS,
  dataCommonsGuidanceText,
  dataCommonsSkill,
} from './data-commons.ts';
export {
  BOSTON_OPENCONTEXT_ENTRY,
  BOSTON_OPENCONTEXT_SKILL,
  BOSTON_OPENCONTEXT_TOOL_NAMES,
  BOSTON_OPENCONTEXT_TOOLS,
  bostonGuidanceText,
} from './boston.ts';
export { lockedFetch, lockedGetData, lockedSearch, portalLockSection } from './portal-lock.ts';
export {
  ALL_SOURCES,
  CROSS_SOURCE_PREAMBLE,
  crossSourcePreamble,
  introFor,
  outroFor,
  type SourceId,
} from './prompt-frame.ts';
