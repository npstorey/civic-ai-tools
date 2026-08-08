// Skill-drift fixture (drift failure mode): a copy that has been edited away
// from ../docs/sample.md the way the real embedded copies drift in practice —
// a reworded blockquote, inline-code backticks stripped, and one bullet
// dropped entirely. Never imported, compiled, or served.

export const SAMPLE_SKILL = `# Fixture Skill — Sample Overlay

> Applies to: the skill-drift self-test only. Never served to a client.

## Rules

- Prefer upper() for text filters — SoQL string comparison is case-sensitive.
- A literal backslash in prose (\\) must survive the round trip.

\`\`\`sql
SELECT borough, COUNT(*) AS total
GROUP BY borough
ORDER BY total DESC
\`\`\`

Done.
`;
