// Purity lint for civic-typed-router, adapted from civic-typed-harness.
//
// The router is stricter than the harness: it has no capture group, so no
// shipped module reads a clock or an RNG. Everywhere in shipped source: no Node
// built-ins, no environment, no network, no console, no clock, no RNG. The
// consumer supplies the date, the configuration and the fetchers.
//
// `src/purity.test.ts` enforces the same contract, plus the core boundary
// (`src/boundary.test.ts`), under `node --test`. Test files are exempt from
// the import ban: they use node:test and node:fs. `src/__fixtures__/` is not
// linted at all: the capture script there is a Node program by design.

import parser from '@typescript-eslint/parser';

// Bare specifiers that resolve to Node built-ins; `node:*` covers the rest.
const FORBIDDEN_BARE_IMPORTS = ['crypto', 'fs', 'fs/promises', 'path', 'process', 'os', 'url', 'util', 'child_process'];

const DETERMINISM =
  'civic-typed-router reads no clock and no RNG — the consumer supplies `today`.';

export default [
  { ignores: ['dist/**', 'src/__fixtures__/**'] },
  {
    files: ['src/**/*.ts'],
    ignores: ['src/**/*.test.ts'],
    languageOptions: { parser },
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            ...FORBIDDEN_BARE_IMPORTS.map((name) => ({
              name,
              message: `civic-typed-router is I/O-free and browser-safe — do not import "${name}".`,
            })),
            {
              name: 'openai',
              message: 'The tool-schema type is structural; never import from openai.',
            },
          ],
          patterns: [
            {
              group: ['node:*'],
              message: 'civic-typed-router is I/O-free and browser-safe — no node:* imports in shipped source.',
            },
            {
              group: ['openai/*'],
              message: 'The tool-schema type is structural; never import from openai.',
            },
          ],
        },
      ],
      'no-restricted-globals': [
        'error',
        {
          name: 'process',
          message: 'No environment reads — the consumer passes its configuration to readMcpEnv as a plain object.',
        },
        { name: 'Buffer', message: 'Buffer is Node-only.' },
        { name: 'fetch', message: 'No network — the consumer supplies the fetchers.' },
        { name: 'XMLHttpRequest', message: 'No network — the consumer supplies the fetchers.' },
        { name: 'WebSocket', message: 'No network — the consumer supplies the fetchers.' },
        { name: 'console', message: 'No logging — a skipped source is the consumer\'s to report.' },
      ],
      'no-restricted-properties': [
        'error',
        { object: 'Date', property: 'now', message: DETERMINISM },
        { object: 'Math', property: 'random', message: DETERMINISM },
      ],
      'no-restricted-syntax': [
        'error',
        { selector: "NewExpression[callee.name='Date']", message: DETERMINISM },
        { selector: "CallExpression[callee.property.name='randomUUID']", message: DETERMINISM },
        { selector: "CallExpression[callee.property.name='getRandomValues']", message: DETERMINISM },
      ],
    },
  },
];
