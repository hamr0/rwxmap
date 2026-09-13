// The shared shape: only the method floor and the operationId splitter.
// D57: core holds no word lists — every goal owns its own (see
// docs/product/prd.md, "How the goals stay separate").

// One table, one place. GET/HEAD/OPTIONS -> r, POST -> x, PUT/DELETE/PATCH -> w.
export function floorFor(method) {
  switch (method) {
    case 'GET': case 'HEAD': case 'OPTIONS': return 'r';
    case 'POST': return 'x';
    case 'PUT': case 'DELETE': case 'PATCH': return 'w';
    default: throw new Error(`unrecognised method: ${method}`);
  }
}

// arbiter.mjs's own splitTokens only splits on '_ - .' and camelCase, so an
// operationId like 'gists/unstar' or 'delete team member' stays one token.
// arbiter.mjs is frozen history, so the fix lives here instead: trim, then
// collapse every run of '/' or whitespace into '_' before anything reads
// operationId — this is the one place the split lives. A whitespace-only
// operationId trims to '' first, so it still falls back to the path
// (rawLeadStringForRow's behaviour) exactly as before.
export function withSplitOperationId(row) {
  const trimmed = (row.operationId || '').trim();
  return { ...row, operationId: trimmed.replace(/[\/\s]+/g, '_') };
}

// The base pipeline layer: no evidence, no word lists — just the method
// floor. Every goal layer runs after this one.
export function classifyFloor(row) {
  return { class: floorFor(row.method), rule: 'floor', floor: true };
}
