#!/usr/bin/env node
// Pins socrata-guidance.json: the Socrata guidance the reference website
// fetches (`skill-guidance` with `modality: 'web'`), as socrata-mcp-server
// composes it at a stated commit. The aliased view's anchored rewrite is
// tested on this text (ADR-0032); the app goldens hold only a synthetic
// stand-in that names no tool.
//
// USAGE
//   node pin-socrata-guidance.mjs --server <path to a socrata-mcp-server clone>
//                                 --commit <rev>
//                                 [--out <path>]   default: socrata-guidance.json beside this file
//
// HOW
//   - `git show <commit>:src/skills/base.ts` and `:src/skills/web.ts` are read
//     from the server repository; no checkout is created or touched.
//   - Each module's one template literal is extracted with the hub's drift
//     checker (`scripts/check-skill-drift.mjs`, `extractEmbeddedSkill`), which
//     parses and never evaluates the source.
//   - The text is `BASE_SKILL + '\n\n---\n\n' + WEB_SKILL`, the server's
//     composition for the web modality with no posture overlay
//     (`src/skills/compose.ts`, `composeSkillGuidance`).
//   - The hub's `docs/skills/base.md` and `web.md` are compared with the two
//     parts, and the result is recorded.

import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { extractEmbeddedSkill } from '../../../../scripts/check-skill-drift.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const HUB_ROOT = path.resolve(HERE, '../../../..');
const SEPARATOR = '\n\n---\n\n';
const PARTS = [
  { path: 'src/skills/base.ts', exportName: 'BASE_SKILL', hubDoc: 'docs/skills/base.md' },
  { path: 'src/skills/web.ts', exportName: 'WEB_SKILL', hubDoc: 'docs/skills/web.md' },
];

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const v = argv[++i];
    if (v === undefined) throw new Error(`${a} needs a value`);
    if (a === '--server') args.server = v;
    else if (a === '--commit') args.commit = v;
    else if (a === '--out') args.out = v;
    else throw new Error(`unknown argument ${a}`);
  }
  if (!args.server || !args.commit) throw new Error('--server and --commit are required');
  args.out ??= path.join(HERE, 'socrata-guidance.json');
  return args;
}

const sha256 = (text) => createHash('sha256').update(text).digest('hex');

const args = parseArgs(process.argv.slice(2));
const commit = execFileSync('git', ['-C', args.server, 'rev-parse', '--verify', `${args.commit}^{commit}`], { encoding: 'utf8' }).trim();
const parts = PARTS.map((part) => {
  const source = execFileSync('git', ['-C', args.server, 'show', `${commit}:${part.path}`], { encoding: 'utf8' });
  const extracted = extractEmbeddedSkill(source, part.exportName);
  if (!extracted.ok) throw new Error(`${part.path}: ${extracted.reason}`);
  const text = extracted.text;
  const hubDoc = fs.readFileSync(path.join(HUB_ROOT, part.hubDoc), 'utf8');
  return {
    path: part.path,
    exportName: part.exportName,
    sourceSha256: sha256(source),
    textSha256: sha256(text),
    hubDoc: part.hubDoc,
    hubDocIdentical: hubDoc === text,
    text,
  };
});
const text = parts.map((p) => p.text).join(SEPARATOR);

const fixture = {
  _meta: {
    description:
      "The Socrata guidance the reference website fetches: socrata-mcp-server's `skill-guidance` prompt for the web modality with no posture overlay, BASE_SKILL then the separator then WEB_SKILL. The aliased view's anchored rewrite is tested on it.",
    origin: {
      repository: 'npstorey/socrata-mcp-server',
      commit,
      composition: "src/skills/compose.ts, composeSkillGuidance('web', undefined): BASE_SKILL + '\\n\\n---\\n\\n' + WEB_SKILL",
      parts: parts.map(({ text: _text, ...rest }) => rest),
    },
    script: { path: 'packages/civic-typed-router/src/__fixtures__/pin-socrata-guidance.mjs' },
    sha256: sha256(text),
    utf8Bytes: Buffer.byteLength(text),
  },
  text,
};

fs.writeFileSync(args.out, JSON.stringify(fixture, null, 2) + '\n');
process.stdout.write(`wrote ${args.out}: ${fixture._meta.utf8Bytes} bytes, hub docs identical: ${parts.map((p) => `${p.hubDoc}=${p.hubDocIdentical}`).join(', ')}\n`);
