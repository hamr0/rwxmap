// Goal 3's own word list (D57: each goal owns its own, never imports
// another goal's). Literal copy of c11.mjs's (frozen history,
// poc/m1/arbiter/) resolved READ_VERBS; goal3.test.mjs asserts this copy
// stays equal to c11's original.

// READ_VERBS (14): a POST row whose operationId lead verb matches one of
// these lowers off the x floor to r.
export const READ_VERBS = new Set([
  'retrieve', 'verify', 'check', 'query', 'read', 'fetch', 'list', 'search',
  'match', 'count', 'lookup', 'assess', 'find', 'get',
]);
