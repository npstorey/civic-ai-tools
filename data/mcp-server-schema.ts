// MCP Server Directory Schema
// Controlled vocabularies and TypeScript types for the civic data MCP server directory.
// Aligned with DCAT 3.0 (publisher, license, dateAdded, spatialGranularity)
// and Schema.org (name, description, programmingLanguage, version).

// --- Controlled vocabularies ---

export const TRANSPORTS = ['stdio', 'http', 'sse'] as const;
export type Transport = (typeof TRANSPORTS)[number];

export const CIVIC_DOMAINS = [
  'open-data-portals',
  'census-demographics',
  'legislation-legal',
  'elections-campaign-finance',
  'health-public-health',
  'economic-financial',
  'government-contracting',
  'geospatial-gis',
  'weather-environment',
  'education',
  'transportation',
  'international-government',
  'framework-multi-portal',
  'civic-adjacent',
  'federal-government',
] as const;
export type CivicDomain = (typeof CIVIC_DOMAINS)[number];

export const GOVERNMENT_LEVELS = [
  'local',
  'state',
  'federal',
  'international',
  'global',
  'multi',
] as const;
export type GovernmentLevel = (typeof GOVERNMENT_LEVELS)[number];

export const STATUSES = ['active', 'inactive', 'archived', 'beta'] as const;
export type Status = (typeof STATUSES)[number];

export const VERIFICATION_STATUSES = [
  'official',
  'community',
  'commercial',
] as const;
export type VerificationStatus = (typeof VERIFICATION_STATUSES)[number];

export const ACCESS_LEVELS = ['free', 'freemium', 'paid'] as const;
export type AccessLevel = (typeof ACCESS_LEVELS)[number];

export const SPATIAL_GRANULARITIES = [
  'point',
  'neighborhood',
  'city',
  'county',
  'state',
  'country',
  'global',
] as const;
export type SpatialGranularity = (typeof SPATIAL_GRANULARITIES)[number];

export const PRIORITY_TIERS = ['tier1', 'tier2', 'tier3'] as const;
export type PriorityTier = (typeof PRIORITY_TIERS)[number];

export const DATA_PLATFORMS = [
  'socrata',
  'ckan',
  'arcgis',
  'custom-api',
  'data-commons',
] as const;
export type DataPlatform = (typeof DATA_PLATFORMS)[number];

// --- Entry interface ---

export interface McpServerEntry {
  // Required (10)
  id: string; // kebab-case slug
  name: string;
  description: string;
  repoUrl: string;
  transport: Transport[];
  categories: CivicDomain[];
  governmentLevel: GovernmentLevel[];
  maintainer: string;
  status: Status;
  dateAdded: string; // ISO date

  // Recommended (12)
  dataSources?: string[];
  jurisdiction?: string;
  toolCount?: number;
  notes?: string;
  docsUrl?: string;
  npmPackage?: string;
  license?: string;
  programmingLanguage?: string;
  apiKeyRequired?: boolean;
  verificationStatus?: VerificationStatus;
  included?: boolean;
  dateModified?: string; // ISO date

  dataPlatform?: DataPlatform[];

  // Optional (8)
  tags?: string[];
  endpointUrl?: string;
  version?: string;
  publisher?: string;
  accessLevel?: AccessLevel;
  spatialGranularity?: SpatialGranularity;
  capabilities?: {
    tools?: boolean;
    resources?: boolean;
    prompts?: boolean;
  };
  priority?: PriorityTier;
}
