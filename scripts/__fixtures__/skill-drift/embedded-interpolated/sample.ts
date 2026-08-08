// Skill-drift fixture (error mode): the embedded copy is assembled at runtime
// from an interpolation, so there is no static document to compare against.
// The extractor must refuse this rather than compare a partial string.
// Never imported, compiled, or served.

const AUDIENCE = 'the skill-drift self-test';

export const SAMPLE_SKILL = `# Fixture Skill — Sample Overlay

> **Applies to:** ${AUDIENCE} only. Never served to a client.

Done.
`;
