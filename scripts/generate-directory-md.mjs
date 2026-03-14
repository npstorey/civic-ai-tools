#!/usr/bin/env node
// Generate docs/mcp-servers.md from data/mcp-servers.json
// Usage: node scripts/generate-directory-md.mjs

import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const JSON_PATH = join(ROOT, 'data', 'mcp-servers.json');
const OUT_PATH = join(ROOT, 'docs', 'mcp-servers.md');

const entries = JSON.parse(readFileSync(JSON_PATH, 'utf-8'));

// --- Section definitions (order matters) ---

const SECTIONS = [
  {
    heading: '## Included in civic-ai-tools',
    filter: (e) => e.included,
    hasStatus: false,
  },
  {
    heading: '## Other Socrata / Open Data Portal Servers',
    filter: (e) => !e.included && e.categories.includes('open-data-portals') && !e.categories.includes('framework-multi-portal'),
    hasStatus: true,
  },
  {
    heading: '## U.S. Federal Government Servers',
    subsections: [
      {
        heading: '### Official (agency-maintained)',
        filter: (e) => e.categories.includes('federal-government') && e.verificationStatus === 'official',
        hasStatus: true,
      },
      {
        heading: '### Community-built',
        filter: (e) => e.categories.includes('federal-government') && e.verificationStatus === 'community',
        hasStatus: true,
      },
    ],
  },
  {
    heading: '## U.S. Legislative & Legal Servers',
    filter: (e) => e.categories.includes('legislation-legal'),
    hasStatus: true,
  },
  {
    heading: '## U.S. Elections & Campaign Finance',
    filter: (e) => e.categories.includes('elections-campaign-finance'),
    hasStatus: true,
  },
  {
    heading: '## U.S. Census & Demographics',
    filter: (e) => e.categories.includes('census-demographics') && !e.included && !e.categories.includes('federal-government'),
    hasStatus: true,
  },
  {
    heading: '## U.S. Health & Public Health',
    filter: (e) => e.categories.includes('health-public-health') && !e.included,
    hasStatus: true,
  },
  {
    heading: '## U.S. Economic Data',
    filter: (e) => e.categories.includes('economic-financial') && !e.included && e.governmentLevel.includes('federal'),
    hasStatus: true,
  },
  {
    heading: '## U.S. Government Contracting (Commercial)',
    filter: (e) => e.categories.includes('government-contracting'),
    hasStatus: true,
  },
  {
    heading: '## International Government Servers',
    subsections: [
      {
        heading: '### Official (government-maintained)',
        filter: (e) => e.categories.includes('international-government') && e.verificationStatus === 'official',
        hasStatus: true,
      },
      {
        heading: '### Europe',
        filter: (e) => e.categories.includes('international-government') && e.verificationStatus !== 'official' &&
          ['European Union', 'Spain', 'Sweden', 'United Kingdom'].includes(e.jurisdiction),
        hasStatus: true,
      },
      {
        heading: '### Asia-Pacific',
        filter: (e) => e.categories.includes('international-government') &&
          ['Japan', 'Hong Kong', 'Malaysia', 'South Korea'].includes(e.jurisdiction),
        hasStatus: true,
      },
      {
        heading: '### Middle East',
        filter: (e) => e.categories.includes('international-government') &&
          ['Israel'].includes(e.jurisdiction),
        hasStatus: true,
      },
      {
        heading: '### Americas',
        filter: (e) => e.categories.includes('international-government') &&
          ['Canada', 'Brazil'].includes(e.jurisdiction),
        hasStatus: true,
      },
      {
        heading: '### Global',
        filter: (e) => e.categories.includes('international-government') &&
          e.governmentLevel.includes('global'),
        hasStatus: true,
      },
    ],
  },
  {
    heading: '## Framework / Multi-Portal Servers',
    filter: (e) => e.categories.includes('framework-multi-portal') && !e.id.includes('ckan'),
    hasStatus: true,
  },
  {
    heading: '## CKAN Servers',
    filter: (e) => e.id.includes('ckan'),
    hasStatus: true,
  },
  {
    heading: '## Geospatial / GIS Servers',
    filter: (e) => e.categories.includes('geospatial-gis'),
    hasStatus: true,
  },
  {
    heading: '## Weather & Environmental Servers',
    filter: (e) => e.categories.includes('weather-environment'),
    hasStatus: true,
  },
  {
    heading: '## Other Civic-Adjacent Servers',
    filter: (e) => e.categories.includes('civic-adjacent'),
    hasStatus: true,
  },
];

// Track which entries have been placed
const placed = new Set();

function formatServerCell(e) {
  return `[${e.name}](${e.repoUrl})`;
}

function formatMaintainer(e) {
  const m = e.maintainer;
  if (m.includes(' ') || m.includes('(') || !m.match(/^[a-zA-Z0-9_-]+$/)) {
    return m;
  }
  return `[@${m}](https://github.com/${m})`;
}

function formatNotes(e) {
  const parts = [];
  if (e.notes) parts.push(e.notes);
  else {
    // Reconstruct key info
    if (e.toolCount) parts.push(`${e.toolCount}+ tools.`);
  }
  // Re-add links
  let text = parts.join(' ');
  if (e.docsUrl && !text.includes('Docs')) text += ` [Docs](${e.docsUrl}).`;
  if (e.npmPackage && !text.includes('npm')) text += ` [npm](https://www.npmjs.com/package/${e.npmPackage}).`;
  return text;
}

function formatStatus(e) {
  if (e.status === 'active') return 'Active';
  if (e.status === 'beta') return 'Beta';
  if (e.status === 'inactive') return 'Inactive';
  if (e.status === 'archived') return 'Archived';
  return e.status;
}

function renderTable(items, hasStatus) {
  if (items.length === 0) return '';

  const lines = [];
  if (hasStatus) {
    lines.push('| Server | Data Source | Transport | Maintainer | Status | Notes |');
    lines.push('|--------|------------|-----------|------------|--------|-------|');
  } else {
    lines.push('| Server | Data Source | Transport | Maintainer | Notes |');
    lines.push('|--------|------------|-----------|------------|-------|');
  }

  for (const e of items) {
    placed.add(e.id);
    const transport = e.transport.join(', ');
    const ds = (e.dataSources || [e.description]).join(', ');
    const notes = formatNotes(e);
    if (hasStatus) {
      lines.push(`| ${formatServerCell(e)} | ${ds} | ${transport} | ${formatMaintainer(e)} | ${formatStatus(e)} | ${notes} |`);
    } else {
      lines.push(`| ${formatServerCell(e)} | ${ds} | ${transport} | ${formatMaintainer(e)} | ${notes} |`);
    }
  }

  return lines.join('\n');
}

function renderSection(section) {
  const out = [];
  out.push('');
  out.push(section.heading);

  if (section.subsections) {
    for (const sub of section.subsections) {
      const items = entries.filter((e) => !placed.has(e.id) && sub.filter(e));
      if (items.length === 0) continue;
      out.push('');
      out.push(sub.heading);
      out.push('');
      out.push(renderTable(items, sub.hasStatus));
    }
  } else {
    const items = entries.filter((e) => !placed.has(e.id) && section.filter(e));
    if (items.length === 0) return '';
    out.push('');
    out.push(renderTable(items, section.hasStatus));
  }

  return out.join('\n');
}

// --- Build output ---

const parts = [];

parts.push(`<!-- AUTO-GENERATED from data/mcp-servers.json. Do not edit directly. Run: npm run generate-directory-md -->`);
parts.push('');
parts.push('# Civic Data MCP Servers');
parts.push('');
parts.push("A directory of MCP servers for accessing civic and public data. Servers marked **Included** are pre-configured in this repo's setup.");
parts.push('');
parts.push('*Last surveyed: March 2026. Sources: GitHub, official MCP Registry, Glama, PulseMCP, mcpservers.org, mcp.so, Smithery, LobeHub, Playbooks.*');

for (const section of SECTIONS) {
  const rendered = renderSection(section);
  if (rendered) parts.push(rendered);
}

// Coverage Gaps (editorial content)
parts.push('');
parts.push('---');
parts.push('');
parts.push('## Coverage Gaps');
parts.push('');
parts.push('The following civic data domains have **no or limited MCP server coverage** as of March 2026:');
parts.push('');
parts.push('| Domain | Data Sources That Could Be Wrapped | Notes |');
parts.push('|--------|-----------------------------------|-------|');
parts.push('| **Elections / voting results** | State election boards, AP election data | Campaign finance (FEC) is covered, but actual election results are not |');
parts.push('| **Universal transit (GTFS)** | GTFS feeds from any transit agency | International coverage exists (mcp-datagovmy includes GTFS for Malaysia) but US-specific coverage is still missing |');
parts.push('| **Local 311 / permits** | Open311 API, municipal permit databases | No dedicated server found |');
parts.push('| **Zoning / land use** | Municipal zoning databases | Highly local, fragmented data |');
parts.push('| **Property records** | County assessor databases | Parcel data, assessments, ownership |');

// Priority Recommendations (editorial content)
parts.push('');
parts.push('---');
parts.push('');
parts.push('## Priority Recommendations');
parts.push('');
parts.push('Servers ranked by value to civic-ai-tools users, considering data breadth, quality signals, and compatibility:');
parts.push('');
parts.push('### Tier 1: Incorporate Next');
parts.push('');
parts.push('1. **[ckan-mcp-server (ondata)](https://github.com/ondata/ckan-mcp-server)** — Unlocks data.gov (250,000+ datasets), data.gov.uk, and hundreds of international CKAN portals. Single integration, massive coverage expansion.');
parts.push('');
parts.push('2. **[census-mcp (official)](https://github.com/uscensusbureau/us-census-bureau-data-api-mcp)** — Official Census Bureau server. ACS data is foundational for almost all civic analysis. Maintained by the agency itself.');
parts.push('');
parts.push('3. **[us-gov-open-data-mcp](https://github.com/lzinga/us-gov-open-data-mcp)** — 36+ APIs, 188+ tools. Covers EPA, NOAA, FDA, SEC, BLS, and more in a single server. Modular loading lets users enable only the APIs they need.');
parts.push('');
parts.push('### Tier 2: High Value, More Specialized');
parts.push('');
parts.push('4. **[govinfo-mcp (official)](https://www.govinfo.gov/features/mcp-public-preview)** — Official GPO server. Congressional Record, Federal Register, and CFR are essential for legislative and regulatory research.');
parts.push('');
parts.push('5. **[legiscan-mcp](https://github.com/sh-patterson/legiscan-mcp)** — State legislation tracking across all 50 states + Congress. Valuable for policy researchers and journalists.');
parts.push('');
parts.push('6. **[fred-mcp-server](https://github.com/stefanoamorelli/fred-mcp-server)** — 800,000+ economic time series. Foundational for any analysis touching on economic trends.');
parts.push('');
parts.push('### Tier 3: Watch and Evaluate');
parts.push('');
parts.push('7. **[datagouv-mcp (official)](https://github.com/datagouv/datagouv-mcp)** — Official French government server. Signals that government-maintained MCP servers are becoming a global pattern.');
parts.push('');
parts.push('8. **[mimilabs](https://www.mimilabs.ai/mcp)** — 50+ healthcare datasets. Valuable for health equity research.');
parts.push('');
parts.push('9. **International data servers** — Spain (datos-gob-es), Sweden (kolada), Brazil (ibge), Japan (e-stat) all have mature implementations. Worth including as civic-ai-tools expands internationally.');
parts.push('');
parts.push('### Integration Notes');
parts.push('');
parts.push('- Most servers use **stdio transport only** — they work with Claude Code, Cursor, and VS Code Copilot out of the box. Only socrata-mcp-server and datagouv-mcp offer HTTP transport for web applications.');
parts.push('- Adding a new server to civic-ai-tools requires: (1) adding it to `claude_desktop_config.json`, (2) writing a skill guidance doc in `docs/skills/`, and (3) testing with representative queries.');
parts.push("- The **us-gov-open-data-mcp** server's modular loading pattern is worth studying — it lets users enable only the APIs they need, avoiding tool overload.");
parts.push('- **Two official U.S. federal agencies** (Census Bureau, GPO) and **two national governments** (France, India) now maintain MCP servers. This is a strong legitimacy signal for the ecosystem.');

// Footer
parts.push('');
parts.push('---');
parts.push('');
parts.push('## Adding a Server');
parts.push('');
parts.push('Know of a civic data MCP server not listed here? Open an [issue](https://github.com/npstorey/civic-ai-tools/issues) or submit a pull request.');
parts.push('');
parts.push('## Transport Types');
parts.push('');
parts.push('- **stdio** — Runs locally as a subprocess. Used by Claude Code, Cursor, and VS Code Copilot.');
parts.push('- **HTTP** — Runs as a web service. Used by web applications (e.g., [civicaitools.org](https://civicaitools.org)).');
parts.push('- **SSE** — Server-Sent Events transport. Older MCP transport, being superseded by HTTP.');

const output = parts.join('\n') + '\n';
writeFileSync(OUT_PATH, output);

// Count placed vs total
const unplaced = entries.filter((e) => !placed.has(e.id));
console.log(`Generated ${OUT_PATH}`);
console.log(`Placed ${placed.size}/${entries.length} servers`);
if (unplaced.length > 0) {
  console.warn(`WARNING: ${unplaced.length} servers not placed in any section:`);
  for (const e of unplaced) {
    console.warn(`  - ${e.id} (categories: ${e.categories.join(', ')})`);
  }
}
