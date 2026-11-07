// D137 pilot 2: our rule over Jev's five factual answers. yes = p >= 0.5.
// x if (accessChange AND NOT narrowOnly) OR handsOver OR outside OR otherX, else w.
// A missing or malformed answer on any of the five gives x (fail closed).
import { KEYS } from './jev-facts.mjs';

export const YES = 0.5;
const ok = (p) => typeof p === 'number' && Number.isFinite(p) && p >= 0 && p <= 1;

export function ruleLabel(p) {
  if (!p || typeof p !== 'object' || !KEYS.every((k) => ok(p[k]))) return 'x';
  const y = (k) => p[k] >= YES;
  return (y('accessChange') && !y('narrowOnly')) || y('handsOver') || y('outside') || y('otherX') ? 'x' : 'w';
}
