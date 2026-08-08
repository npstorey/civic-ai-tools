// Budget-check fixture (failure mode b). `left-pad` IS declared in
// dependencies (so the phantom-import check passes) but is NOT in the budget,
// isolating the unbudgeted-dependency failure. Never compiled or executed.
import leftPad from 'left-pad';

export function pad(value: string): string {
  return String(leftPad(value, 4));
}
