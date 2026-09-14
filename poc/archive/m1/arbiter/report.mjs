// M1-C15 task 3: the human-facing per-API report — what a person gets after
// running rwxmap on a real spec, with NO ground truth. It must never
// pretend to know more than it does: no accuracy/leak/over-tight number
// belongs here (those require ground truth and live only in the
// benchmark), and no invented confidence score.
//
// The honest signal we actually have is `floor` on a classify() result:
// floor:false means a word rule read the operation and fired (evidence);
// floor:true means the class came from the HTTP method alone (the method
// floor, or the no-text doctrine). Measurement (c15-sweep.md) shows every
// leak we have lives in the floor bucket on PUT/DELETE/PATCH — so that is
// what gets surfaced as REVIEW FIRST, not a made-up risk score.
//
// Pure, no I/O: formatReport(rows, classifyFn, { name }) -> string.
const REVIEW_METHODS = new Set(['PUT', 'DELETE', 'PATCH']);
const REVIEW_CAP = 20;

export function formatReport(rows, classifyFn, { name } = {}) {
  const total = rows.length;
  const results = rows.map((row) => ({ row, result: classifyFn(row) }));

  const counts = { r: 0, w: 0, x: 0 };
  let evidenceCount = 0;
  let floorCount = 0;
  const reviewRows = [];

  for (const { row, result } of results) {
    if (result.class in counts) counts[result.class] += 1;
    if (result.floor === true) {
      floorCount += 1;
      if (REVIEW_METHODS.has(row.method)) reviewRows.push({ row, result });
    } else {
      evidenceCount += 1;
    }
  }

  const pct = (c) => (total ? ((c / total) * 100).toFixed(1) : '0.0');

  const lines = [];
  const apiName = name || '(unnamed API)';
  lines.push(`${apiName} — ${total} operation${total === 1 ? '' : 's'}`);
  lines.push('');
  lines.push('CLASS DISTRIBUTION');
  lines.push(`  r: ${counts.r} (${pct(counts.r)}%)`);
  lines.push(`  w: ${counts.w} (${pct(counts.w)}%)`);
  lines.push(`  x: ${counts.x} (${pct(counts.x)}%)`);
  lines.push('');
  lines.push('CONFIDENCE');
  lines.push(`  evidence — a rule read the operation and fired: ${evidenceCount} (${pct(evidenceCount)}%)`);
  lines.push(`  floor — class came from the HTTP method alone: ${floorCount} (${pct(floorCount)}%)`);
  lines.push('');
  lines.push('REVIEW FIRST');
  if (reviewRows.length === 0) {
    lines.push('  (none — no PUT/DELETE/PATCH operation was classified by method alone)');
  } else {
    lines.push('  PUT/DELETE/PATCH operations classified by method alone (no evidence read):');
    lines.push('');
    const shown = reviewRows.slice(0, REVIEW_CAP);
    for (const { row, result } of shown) {
      lines.push(`  ${row.method} ${row.path} ${row.operationId} -> ${result.class} (floor)`);
    }
    const remaining = reviewRows.length - shown.length;
    if (remaining > 0) {
      lines.push(`  ... and ${remaining} more`);
    }
  }
  lines.push('');

  return lines.join('\n');
}
