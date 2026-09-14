// floorFor / classifyFloor — copied from poc/m1/core/core.mjs. The
// operationId splitter (withSplitOperationId) moved to words.mjs instead.

// One table, one place. GET/HEAD/OPTIONS -> r, POST -> x, PUT/DELETE/PATCH -> w.
export function floorFor(method) {
  switch (method) {
    case 'GET': case 'HEAD': case 'OPTIONS': return 'r';
    case 'POST': return 'x';
    case 'PUT': case 'DELETE': case 'PATCH': return 'w';
    default: throw new Error(`unrecognised method: ${method}`);
  }
}

// The base pipeline layer: no evidence, no word lists — just the method
// floor. Every step layer runs after this one.
export function classifyFloor(row) {
  return { class: floorFor(row.method), rule: 'floor', floor: true };
}
