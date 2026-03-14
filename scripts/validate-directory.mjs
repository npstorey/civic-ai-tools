#!/usr/bin/env node
// Validate data/mcp-servers.json against the schema constraints.
// Usage: node scripts/validate-directory.mjs

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const JSON_PATH = join(__dirname, '..', 'data', 'mcp-servers.json');

const TRANSPORTS = ['stdio', 'http', 'sse'];
const CIVIC_DOMAINS = [
  'open-data-portals', 'census-demographics', 'legislation-legal',
  'elections-campaign-finance', 'health-public-health', 'economic-financial',
  'government-contracting', 'geospatial-gis', 'weather-environment',
  'education', 'transportation', 'international-government',
  'framework-multi-portal', 'civic-adjacent', 'federal-government',
];
const GOVERNMENT_LEVELS = ['local', 'state', 'federal', 'international', 'global', 'multi'];
const STATUSES = ['active', 'inactive', 'archived', 'beta'];
const VERIFICATION_STATUSES = ['official', 'community', 'commercial'];
const DATA_PLATFORMS = ['socrata', 'ckan', 'arcgis', 'custom-api', 'data-commons'];

const REQUIRED_FIELDS = [
  'id', 'name', 'description', 'repoUrl', 'transport',
  'categories', 'governmentLevel', 'maintainer', 'status', 'dateAdded',
];

let errors = 0;

function error(id, msg) {
  console.error(`  ERROR [${id}]: ${msg}`);
  errors++;
}

const raw = readFileSync(JSON_PATH, 'utf-8');
const entries = JSON.parse(raw);

console.log(`Validating ${entries.length} entries...\n`);

// Check required fields
for (const entry of entries) {
  const id = entry.id || '(no id)';

  for (const field of REQUIRED_FIELDS) {
    if (entry[field] === undefined || entry[field] === null || entry[field] === '') {
      error(id, `missing required field: ${field}`);
    }
  }

  // Validate arrays are non-empty
  if (Array.isArray(entry.transport) && entry.transport.length === 0) {
    error(id, 'transport array is empty');
  }
  if (Array.isArray(entry.categories) && entry.categories.length === 0) {
    error(id, 'categories array is empty');
  }
  if (Array.isArray(entry.governmentLevel) && entry.governmentLevel.length === 0) {
    error(id, 'governmentLevel array is empty');
  }

  // Validate controlled vocabularies
  if (Array.isArray(entry.transport)) {
    for (const t of entry.transport) {
      if (!TRANSPORTS.includes(t)) error(id, `invalid transport: "${t}"`);
    }
  }
  if (Array.isArray(entry.categories)) {
    for (const c of entry.categories) {
      if (!CIVIC_DOMAINS.includes(c)) error(id, `invalid category: "${c}"`);
    }
  }
  if (Array.isArray(entry.governmentLevel)) {
    for (const g of entry.governmentLevel) {
      if (!GOVERNMENT_LEVELS.includes(g)) error(id, `invalid governmentLevel: "${g}"`);
    }
  }
  if (!STATUSES.includes(entry.status)) {
    error(id, `invalid status: "${entry.status}"`);
  }
  if (entry.verificationStatus && !VERIFICATION_STATUSES.includes(entry.verificationStatus)) {
    error(id, `invalid verificationStatus: "${entry.verificationStatus}"`);
  }
  if (Array.isArray(entry.dataPlatform)) {
    for (const p of entry.dataPlatform) {
      if (!DATA_PLATFORMS.includes(p)) error(id, `invalid dataPlatform: "${p}"`);
    }
  }
}

// Check ID uniqueness
const ids = entries.map((e) => e.id);
const idCounts = {};
for (const id of ids) {
  idCounts[id] = (idCounts[id] || 0) + 1;
}
for (const [id, count] of Object.entries(idCounts)) {
  if (count > 1) error(id, `duplicate ID (appears ${count} times)`);
}

// Summary
console.log(`\n${entries.length} entries checked.`);
if (errors > 0) {
  console.error(`${errors} error(s) found.`);
  process.exit(1);
} else {
  console.log('All entries valid.');
}
