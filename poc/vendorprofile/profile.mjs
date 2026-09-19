// Pure module. No I/O, no truth. Computes a per-document (per-vendor spec)
// steer on top of the UNCHANGED method floor (GET->r, POST->x,
// PUT/DELETE/PATCH->w). The steer only ever moves the PUT/DELETE/PATCH
// floor from w up to x, and only when the whole document's profile score
// clears a threshold; passing a threshold above 1 must recover the
// original floor exactly.

import { SIGNAL_WORDS } from './signal.mjs';

const SIGNAL_SET = new Set(SIGNAL_WORDS);

/**
 * Split `path + ' ' + operationId + ' ' + summary` into a deduped,
 * lowercased token list. Splits on non-alphanumeric characters AND
 * camelCase boundaries (lower/digit -> Upper, and an acronym run ->
 * Upper+lower, e.g. "APIKey" -> "API Key"). Drops tokens of length <= 2
 * and tokens that are pure digits.
 *
 * @param {{path?: string, operationId?: string, summary?: string}} row
 * @returns {string[]}
 */
export function rowTokens(row) {
  const raw = `${row.path || ''} ${row.operationId || ''} ${row.summary || ''}`;
  const withBoundaries = raw
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2');
  const parts = withBoundaries.split(/[^a-zA-Z0-9]+/).filter(Boolean);
  const tokens = parts
    .map((p) => p.toLowerCase())
    .filter((t) => t.length > 2 && !/^\d+$/.test(t));
  return Array.from(new Set(tokens));
}

/**
 * Document-level profile score: the share (0..1) of the given rows
 * (ALL operations of one document/vendor, every method, not just writes)
 * whose rowTokens contain at least one SIGNAL_WORD.
 *
 * @param {Array<object>} rows all operations of one document
 * @returns {number}
 */
export function profileScore(rows) {
  if (!rows || rows.length === 0) return 0;
  let hit = 0;
  for (const row of rows) {
    const tokens = rowTokens(row);
    if (tokens.some((t) => SIGNAL_SET.has(t))) hit++;
  }
  return hit / rows.length;
}

/**
 * The steered class floor for one operation.
 *
 * GET is always 'r' and POST is always 'x' regardless of score or
 * threshold (the original floor, unchanged). PUT/DELETE/PATCH is 'x'
 * when `score >= threshold`, else 'w' (the original floor). Passing a
 * threshold above 1 makes the PUT/DELETE/PATCH branch never fire, which
 * recovers the original unsteered floor exactly.
 *
 * @param {string} method
 * @param {number} score document profileScore, ignored for GET/POST
 * @param {number} threshold
 * @returns {'r'|'w'|'x'}
 */
export function steeredFloor(method, score, threshold) {
  const m = String(method || '').toUpperCase();
  if (m === 'GET') return 'r';
  if (m === 'POST') return 'x';
  // PUT, DELETE, PATCH (and any other write-shaped method): w floor,
  // steered up to x when the document profile clears the threshold.
  return score >= threshold ? 'x' : 'w';
}
