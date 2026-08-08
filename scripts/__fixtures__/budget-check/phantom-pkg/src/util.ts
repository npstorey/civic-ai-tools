// Budget-check fixture: relative-import target (relative imports are out of
// scope for the budget and must not be reported).
export function local(value: string): string {
  return value.trim();
}
