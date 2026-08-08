# Fixture Skill — Sample Overlay

> **Applies to:** the skill-drift self-test only. Never served to a client.

## Rules

- Prefer `upper()` for text filters — SoQL string comparison is case-sensitive.
- The `$query` parameter takes SoQL, not SQL.
- A literal backslash in prose (\) must survive the round trip.

```sql
SELECT borough, COUNT(*) AS total
GROUP BY borough
ORDER BY total DESC
```

Done.
