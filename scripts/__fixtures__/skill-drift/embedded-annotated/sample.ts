// Skill-drift fixture: same correct copy as embedded-in-sync/, but the export
// carries an explicit `: string` type annotation. The extractor tolerates the
// annotation; anything else between the identifier and the template literal is
// a shape change and an error. Never imported, compiled, or served.

export const SAMPLE_SKILL: string = `# Fixture Skill — Sample Overlay

> **Applies to:** the skill-drift self-test only. Never served to a client.

## Rules

- Prefer \`upper()\` for text filters — SoQL string comparison is case-sensitive.
- The \`$query\` parameter takes SoQL, not SQL.
- A literal backslash in prose (\\) must survive the round trip.

\`\`\`sql
SELECT borough, COUNT(*) AS total
GROUP BY borough
ORDER BY total DESC
\`\`\`

Done.
`;
