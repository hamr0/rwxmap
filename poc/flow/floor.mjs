// floorFor — copied from poc/archive/m1/core/core.mjs. The operationId
// splitter (withSplitOperationId) moved to words.mjs instead.

// One table, one place. GET/HEAD/OPTIONS -> r, POST -> x, PUT/DELETE/PATCH -> w.
export function floorFor(method) {
  switch (method) {
    case 'GET': case 'HEAD': case 'OPTIONS': return 'r';
    case 'POST': return 'x';
    case 'PUT': case 'DELETE': case 'PATCH': return 'w';
    default: throw new Error(`unrecognised method: ${method}`);
  }
}

// The r<w<x ordering — the project's one invariant. One shared export so
// flow.mjs's leak/over-tight tallies and ledger.mjs's verdictFor never
// disagree on which direction is a leak.
export const CLASS_ORDER = { r: 0, w: 1, x: 2 };
