#!/usr/bin/env node
// One-time migration script: parse docs/mcp-servers.md → data/mcp-servers.json
// Usage: node scripts/migrate-directory.mjs

import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const MD_PATH = join(ROOT, 'docs', 'mcp-servers.md');
const OUT_PATH = join(ROOT, 'data', 'mcp-servers.json');

const TODAY = new Date().toISOString().split('T')[0];

// --- Section → category + governmentLevel mapping ---

const SECTION_MAP = {
  'included in civic-ai-tools': { categories: null, governmentLevel: null }, // per-server
  'other socrata / open data portal servers': { categories: ['open-data-portals'], governmentLevel: ['multi'] },
  'u.s. federal government servers': { categories: ['federal-government'], governmentLevel: ['federal'] },
  'official (agency-maintained)': { categories: ['federal-government'], governmentLevel: ['federal'], verificationStatus: 'official' },
  'community-built': { categories: ['federal-government'], governmentLevel: ['federal'] },
  'u.s. legislative & legal servers': { categories: ['legislation-legal'], governmentLevel: ['federal', 'state'] },
  'u.s. elections & campaign finance': { categories: ['elections-campaign-finance'], governmentLevel: ['federal'] },
  'u.s. census & demographics': { categories: ['census-demographics'], governmentLevel: ['federal'] },
  'u.s. health & public health': { categories: ['health-public-health'], governmentLevel: ['federal'] },
  'u.s. economic data': { categories: ['economic-financial'], governmentLevel: ['federal'] },
  'u.s. government contracting (commercial)': { categories: ['government-contracting'], governmentLevel: ['federal'], verificationStatus: 'commercial' },
  'international government servers': { categories: ['international-government'], governmentLevel: ['international'] },
  'official (government-maintained)': { categories: ['international-government'], governmentLevel: ['international'], verificationStatus: 'official' },
  'europe': { categories: ['international-government'], governmentLevel: ['international'] },
  'asia-pacific': { categories: ['international-government'], governmentLevel: ['international'] },
  'middle east': { categories: ['international-government'], governmentLevel: ['international'] },
  'americas': { categories: ['international-government'], governmentLevel: ['international'] },
  'global': { categories: ['international-government'], governmentLevel: ['global'] },
  'framework / multi-portal servers': { categories: ['framework-multi-portal'], governmentLevel: ['multi'] },
  'ckan servers': { categories: ['framework-multi-portal', 'open-data-portals'], governmentLevel: ['multi'] },
  'geospatial / gis servers': { categories: ['geospatial-gis'], governmentLevel: ['multi'] },
  'weather & environmental servers': { categories: ['weather-environment'], governmentLevel: ['multi'] },
  'other civic-adjacent servers': { categories: ['civic-adjacent'], governmentLevel: ['multi'] },
};

// Priority tier mapping from the recommendations section
const PRIORITY_MAP = {
  'ckan-mcp-server': 'tier1', // ondata specifically
  'us-census-bureau-data-api-mcp': 'tier1',
  'us-gov-open-data-mcp': 'tier1',
  'govinfo-mcp': 'tier2',
  'legiscan-mcp': 'tier2',
  'fred-mcp-server': 'tier2',
  'datagouv-mcp': 'tier3',
  'mimilabs': 'tier3',
};

function slugify(str) {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function extractRepoName(url) {
  if (!url) return null;
  const match = url.match(/github\.com\/[^/]+\/([^/]+)/);
  return match ? match[1] : null;
}

function parseMarkdownLink(text) {
  const match = text.match(/\[([^\]]+)\]\(([^)]+)\)/);
  if (match) return { text: match[1], url: match[2] };
  return { text: text.trim(), url: '' };
}

function extractMaintainerHandle(cell) {
  const match = cell.match(/@([a-zA-Z0-9_-]+)/);
  if (match) return match[1];
  // Try markdown link
  const link = parseMarkdownLink(cell);
  if (link.url.includes('github.com')) {
    const parts = link.url.split('/');
    return parts[parts.length - 1] || link.text;
  }
  return cell.trim();
}

function extractToolCount(notes) {
  const match = notes.match(/(\d+)\+?\s*tools/i);
  return match ? parseInt(match[1]) : undefined;
}

function extractNpmPackage(notes) {
  const match = notes.match(/\[npm\]\(([^)]+)\)/);
  if (match) {
    const npmMatch = match[1].match(/npmjs\.com\/package\/([^)]+)/);
    return npmMatch ? npmMatch[1] : undefined;
  }
  return undefined;
}

function extractDocsUrl(notes) {
  const match = notes.match(/\[Docs?\]\(([^)]+)\)/i);
  return match ? match[1] : undefined;
}

function extractGitHubUrl(notes) {
  const match = notes.match(/\[GitHub\]\(([^)]+)\)/i);
  return match ? match[1] : undefined;
}

function extractApiKeyRequired(notes) {
  const lower = notes.toLowerCase();
  if (lower.includes('no api key') || lower.includes('no keys required')) return false;
  if (lower.includes('requires') && (lower.includes('api_key') || lower.includes('api key'))) return true;
  if (lower.includes('api key')) return true;
  return undefined;
}

function parseTransport(cell) {
  const t = cell.toLowerCase().trim();
  const result = [];
  if (t.includes('stdio')) result.push('stdio');
  if (t.includes('http') && !t.includes('https://')) result.push('http');
  if (t.includes('streamable http')) result.push('http');
  if (t.includes('sse')) result.push('sse');
  if (t.includes('rest')) result.push('http');
  if (result.length === 0 && t.includes('stdio')) result.push('stdio');
  return result.length > 0 ? result : ['stdio'];
}

function parseStatus(cell) {
  const t = cell.toLowerCase().trim();
  if (t.includes('active')) return 'active';
  if (t.includes('beta') || t.includes('preview')) return 'beta';
  if (t.includes('inactive')) return 'inactive';
  if (t.includes('archived')) return 'archived';
  return 'active';
}

function parseTableRow(line) {
  return line
    .split('|')
    .map((c) => c.trim())
    .filter((c) => c.length > 0);
}

function isTableSeparator(line) {
  return /^\|[-| :]+\|$/.test(line.trim());
}

function isTableHeader(line) {
  return line.includes('Server') && line.includes('|');
}

// --- Main parse ---

const md = readFileSync(MD_PATH, 'utf-8');
const lines = md.split('\n');

const entries = [];
const usedIds = new Set();

let currentH2 = '';
let currentH3 = '';
let inTable = false;
let headerCols = [];
let skipSections = ['coverage gaps', 'priority recommendations', 'adding a server', 'transport types'];

function getSection() {
  // Try H3 first for specificity (e.g. "Official (agency-maintained)")
  const h3Key = currentH3.toLowerCase();
  const h2Key = currentH2.toLowerCase();

  if (SECTION_MAP[h3Key]) return SECTION_MAP[h3Key];
  if (SECTION_MAP[h2Key]) return SECTION_MAP[h2Key];

  // Fallback: try partial matching
  for (const [key, val] of Object.entries(SECTION_MAP)) {
    if (h2Key.includes(key) || h3Key.includes(key)) return val;
  }
  return { categories: ['civic-adjacent'], governmentLevel: ['multi'] };
}

for (let i = 0; i < lines.length; i++) {
  const line = lines[i];

  // Track headings
  if (line.startsWith('## ') && !line.startsWith('### ')) {
    currentH2 = line.replace('## ', '').trim();
    currentH3 = '';
    inTable = false;
    continue;
  }
  if (line.startsWith('### ')) {
    currentH3 = line.replace('### ', '').trim();
    inTable = false;
    continue;
  }

  // Skip non-data sections
  if (skipSections.some((s) => currentH2.toLowerCase().includes(s))) continue;

  // Detect table header
  if (isTableHeader(line)) {
    headerCols = parseTableRow(line).map((c) => c.toLowerCase());
    inTable = true;
    continue;
  }

  // Skip separator
  if (isTableSeparator(line)) continue;

  // Parse table rows
  if (inTable && line.trim().startsWith('|') && line.includes('|')) {
    const cols = parseTableRow(line);
    if (cols.length < 4) continue;

    const section = getSection();
    const hasStatusCol = headerCols.includes('status');

    // Map columns by header
    const serverIdx = 0;
    const dataSourceIdx = 1;
    const transportIdx = 2;
    const maintainerIdx = 3;
    const statusIdx = hasStatusCol ? 4 : -1;
    const notesIdx = hasStatusCol ? 5 : 4;

    const serverCell = cols[serverIdx] || '';
    const dataSourceCell = cols[dataSourceIdx] || '';
    const transportCell = cols[transportIdx] || '';
    const maintainerCell = cols[maintainerIdx] || '';
    const statusCell = statusIdx >= 0 && cols[statusIdx] ? cols[statusIdx] : 'Active';
    const notesCell = cols[notesIdx] || '';

    // Parse server name and URL
    const serverLink = parseMarkdownLink(serverCell);
    const repoName = extractRepoName(serverLink.url);
    const githubFromNotes = extractGitHubUrl(notesCell);

    let repoUrl = serverLink.url;
    if (!repoUrl.includes('github.com') && githubFromNotes) {
      repoUrl = githubFromNotes;
    }

    // Generate ID
    let id;
    if (repoName) {
      id = slugify(repoName);
    } else {
      id = slugify(serverLink.text);
    }

    // Deduplicate IDs
    if (usedIds.has(id)) {
      // Append a suffix based on maintainer
      const maintainer = extractMaintainerHandle(maintainerCell);
      id = `${id}-${slugify(maintainer)}`;
    }
    usedIds.add(id);

    const entry = {
      id,
      name: serverLink.text,
      description: dataSourceCell.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1'),
      repoUrl: repoUrl || '',
      transport: parseTransport(transportCell),
      categories: section.categories || ['open-data-portals'],
      governmentLevel: section.governmentLevel || ['multi'],
      maintainer: extractMaintainerHandle(maintainerCell),
      status: parseStatus(statusCell),
      dateAdded: TODAY,
      dataSources: [dataSourceCell.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')],
      verificationStatus: section.verificationStatus || 'community',
      dateModified: TODAY,
    };

    // Extract optional fields from notes
    const toolCount = extractToolCount(notesCell);
    if (toolCount) entry.toolCount = toolCount;

    const npmPkg = extractNpmPackage(notesCell);
    if (npmPkg) entry.npmPackage = npmPkg;

    const docsUrl = extractDocsUrl(notesCell);
    if (docsUrl) entry.docsUrl = docsUrl;

    const apiKey = extractApiKeyRequired(notesCell);
    if (apiKey !== undefined) entry.apiKeyRequired = apiKey;

    if (notesCell.trim()) {
      // Clean notes: remove markdown links formatting
      entry.notes = notesCell
        .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
        .trim();
    }

    // Priority tier
    const priorityKey = repoName || id;
    if (PRIORITY_MAP[priorityKey]) {
      entry.priority = PRIORITY_MAP[priorityKey];
    }

    entries.push(entry);
  } else if (inTable && !line.trim().startsWith('|')) {
    inTable = false;
  }
}

// --- Special handling for specific servers ---

for (const entry of entries) {
  // socrata-mcp-server
  if (entry.id === 'socrata-mcp-server') {
    entry.included = true;
    entry.verificationStatus = 'community';
    entry.categories = ['open-data-portals'];
    entry.governmentLevel = ['local', 'state'];
    entry.npmPackage = 'socrata-mcp-server';
    entry.programmingLanguage = 'TypeScript';
    entry.endpointUrl = 'https://socrata-mcp.civicaitools.org';
  }

  // data-commons-mcp
  if (entry.id === 'data-commons-mcp') {
    entry.included = true;
    entry.verificationStatus = 'official';
    entry.categories = ['census-demographics', 'health-public-health', 'economic-financial'];
    entry.governmentLevel = ['federal', 'international', 'global'];
    entry.apiKeyRequired = true;
  }

  // GovCon MCP / GovTribe MCP
  if (entry.name === 'GovCon MCP' || entry.name === 'GovTribe MCP') {
    entry.verificationStatus = 'commercial';
  }

  // Census MCP (official)
  if (entry.id === 'us-census-bureau-data-api-mcp') {
    entry.verificationStatus = 'official';
    entry.programmingLanguage = 'TypeScript';
    entry.apiKeyRequired = true;
    entry.priority = 'tier1';
  }

  // GovInfo MCP (official)
  if (entry.id === 'api' && entry.name === 'govinfo-mcp') {
    entry.id = 'govinfo-mcp';
    entry.verificationStatus = 'official';
    entry.priority = 'tier2';
  }

  // datagouv-mcp (official French government)
  if (entry.id === 'datagouv-mcp') {
    entry.verificationStatus = 'official';
    entry.endpointUrl = 'https://mcp.data.gouv.fr/mcp';
    entry.jurisdiction = 'France';
    entry.priority = 'tier3';
  }

  // India NSO MCP
  if (entry.name.includes('India NSO')) {
    entry.verificationStatus = 'official';
    entry.jurisdiction = 'India';
  }

  // Set jurisdiction for international servers with clear country mentions
  if (entry.name.includes('eurostat')) entry.jurisdiction = 'European Union';
  if (entry.id === 'datos-gob-es-mcp') entry.jurisdiction = 'Spain';
  if (entry.id === 'kolada-mcp') entry.jurisdiction = 'Sweden';
  if (entry.id === 'riksdag-regering-mcp') entry.jurisdiction = 'Sweden';
  if (entry.id === 'parliament-mcp') entry.jurisdiction = 'United Kingdom';
  if (entry.name === 'GovUK-MCP') entry.jurisdiction = 'United Kingdom';
  if (entry.id === 'swedish-law-mcp') entry.jurisdiction = 'Sweden';
  if (entry.id === 'estat-mcp') entry.jurisdiction = 'Japan';
  if (entry.id === 'jpn-laws-mcp-server') entry.jurisdiction = 'Japan';
  if (entry.id === 'data-gov-hk-mcp') entry.jurisdiction = 'Hong Kong';
  if (entry.id === 'mcp-datagovmy') entry.jurisdiction = 'Malaysia';
  if (entry.id === 'opendart-mcp') entry.jurisdiction = 'South Korea';
  if (entry.id === 'budgetkey-mcp') entry.jurisdiction = 'Israel';
  if (entry.id === 'gov-ca-mcp') entry.jurisdiction = 'Canada';
  if (entry.id.includes('ibge')) entry.jurisdiction = 'Brazil';
  if (entry.id.includes('bcb')) entry.jurisdiction = 'Brazil';
  if (entry.id === 'agrobr-mcp') entry.jurisdiction = 'Brazil';
  if (entry.id === 'world-bank-data-mcp') entry.jurisdiction = 'Global';

  // US servers default jurisdiction
  if (
    !entry.jurisdiction &&
    entry.governmentLevel.includes('federal') &&
    !entry.governmentLevel.includes('international')
  ) {
    entry.jurisdiction = 'United States';
  }
}

// --- Assign dataPlatform ---

// Explicit platform mappings by ID
const PLATFORM_BY_ID = {
  'socrata-mcp-server': ['socrata'],
  'odp-mcp': ['socrata'],
  'socrata-mcp': ['socrata'],
  'opengov-mcp-server': ['socrata'],
  'open-data-mcp': ['socrata'],
  'nyc-mcp': ['socrata'],           // NYC Open Data runs on Socrata
  'data-commons-mcp': ['data-commons'],
  'ckan-mcp-server': ['ckan'],
  'ckan-mcp-server-ondics': ['ckan'],
  'ckan-mcp-openascot': ['ckan'],
  'opendatamcp': ['ckan'],          // OpenDataMCP starts with CKAN portals
  'datagov-mcp-server': ['ckan'],   // Data.gov is CKAN-based
};

for (const entry of entries) {
  if (PLATFORM_BY_ID[entry.id]) {
    entry.dataPlatform = PLATFORM_BY_ID[entry.id];
  } else {
    // Default: custom-api for everything else (direct API wrappers)
    entry.dataPlatform = ['custom-api'];
  }
}

// Fix govinfo-mcp ID issue (its repoUrl points to github.com/usgpo/api)
const govinfoEntry = entries.find(
  (e) => e.repoUrl.includes('govinfo.gov') || (e.repoUrl.includes('usgpo/api'))
);
if (govinfoEntry) {
  govinfoEntry.id = 'govinfo-mcp';
  govinfoEntry.verificationStatus = 'official';
  govinfoEntry.priority = 'tier2';
  // Fix: the main URL is the govinfo page, but GitHub is in notes
  if (!govinfoEntry.repoUrl.includes('github.com')) {
    govinfoEntry.repoUrl = 'https://github.com/usgpo/api';
  }
}

// Deduplicate IDs one more time
const finalIds = new Set();
for (const entry of entries) {
  if (finalIds.has(entry.id)) {
    entry.id = `${entry.id}-2`;
  }
  finalIds.add(entry.id);
}

// --- Output ---

writeFileSync(OUT_PATH, JSON.stringify(entries, null, 2) + '\n');
console.log(`Migrated ${entries.length} servers to ${OUT_PATH}`);

// Summary by category
const byCat = {};
for (const e of entries) {
  for (const c of e.categories) {
    byCat[c] = (byCat[c] || 0) + 1;
  }
}
console.log('\nBy category:');
for (const [cat, count] of Object.entries(byCat).sort((a, b) => b[1] - a[1])) {
  console.log(`  ${cat}: ${count}`);
}

const included = entries.filter((e) => e.included);
console.log(`\nIncluded servers: ${included.map((e) => e.id).join(', ')}`);

const official = entries.filter((e) => e.verificationStatus === 'official');
console.log(`Official servers: ${official.map((e) => e.id).join(', ')}`);
