// Purity guard for civic-typed-harness (harness-grade, per the S2 brief §2 —
// one notch looser than produce-core's core-grade contract).
//
// The whole package is I/O-free and browser-safe: no Node built-ins, no
// environment reads, no network, no Buffer. Clock + RNG are additionally
// banned in the FORMAT-EXTENSION and RUBRIC module groups; they are permitted
// in the CAPTURE group only (span timestamps and ids are what capture *is*),
// where they must be injectable for deterministic tests. The dependency-free
// `purity.test.ts` enforces the same contract (plus the format/capture module
// boundary) mechanically under `node --test`. Test files are exempt from the
// import ban: they legitimately use `node:test` / `node:fs` to build fixtures.

import parser from '@typescript-eslint/parser';

// Bare specifiers that resolve to Node built-ins; the `node:*` pattern below
// covers every prefixed form.
const FORBIDDEN_BARE_IMPORTS = [
  'crypto',
  'fs',
  'fs/promises',
  'path',
  'process',
];

export default [
  // Whole package: I/O-free, env-free, browser-safe.
  {
    files: ['src/**/*.ts'],
    ignores: ['src/**/*.test.ts'],
    languageOptions: { parser },
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: FORBIDDEN_BARE_IMPORTS.map((name) => ({
            name,
            message: `civic-typed-harness is I/O-free and browser-safe — do not import "${name}". Use @typedstandards/verify-core primitives (via produce-core's dependency), or take the value as a caller-supplied config input.`,
          })),
          patterns: [
            {
              group: ['node:*'],
              message:
                'civic-typed-harness is I/O-free and browser-safe — no node:* imports in shipped source.',
            },
          ],
        },
      ],
      'no-restricted-globals': [
        'error',
        {
          name: 'process',
          message:
            'No environment reads — every instance-naming value (platform agent, server URLs, environment host, trace service.name) is a typed config input with the demo values as exported defaults.',
        },
        {
          name: 'Buffer',
          message:
            'Buffer is Node-only — use Uint8Array / atob / btoa / verify-core primitives.',
        },
      ],
    },
  },
  // Non-capture groups (format-extension, rubric, index): additionally
  // deterministic — no clock, no RNG. Capture modules (src/capture/**) are
  // exempt from THIS block only: timestamps and span ids are what capture is,
  // and both are injectable there for tests.
  {
    files: ['src/format/**/*.ts', 'src/rubric/**/*.ts', 'src/index.ts'],
    ignores: ['src/**/*.test.ts'],
    languageOptions: { parser },
    rules: {
      'no-restricted-properties': [
        'error',
        {
          object: 'Date',
          property: 'now',
          message:
            'Clock reads are capture-only (src/capture/**) — format-extension and rubric modules are deterministic.',
        },
        {
          object: 'Math',
          property: 'random',
          message:
            'RNG is capture-only (src/capture/**) — format-extension and rubric modules are deterministic.',
        },
      ],
      'no-restricted-syntax': [
        'error',
        {
          selector: "NewExpression[callee.name='Date']",
          message:
            'Clock reads are capture-only (src/capture/**) — format-extension and rubric modules are deterministic.',
        },
        {
          selector: "CallExpression[callee.property.name='randomUUID']",
          message:
            'RNG is capture-only (src/capture/**) — ids are caller-supplied or capture-generated.',
        },
        {
          selector: "CallExpression[callee.property.name='getRandomValues']",
          message:
            'RNG is capture-only (src/capture/**) — ids are caller-supplied or capture-generated.',
        },
      ],
    },
  },
];
