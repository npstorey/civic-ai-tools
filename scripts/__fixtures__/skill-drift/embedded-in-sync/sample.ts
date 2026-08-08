// Skill-drift fixture: an embedded copy that matches ../docs/sample.md
// byte-for-byte once template-literal escapes are decoded — the shape a real
// embedded skill has. Never imported, compiled, or served.

export const SAMPLE_SKILL = `# Fixture Skill — Sample Overlay

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
