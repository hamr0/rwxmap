// Step 3's own word lists (was goal 2 until 2026-09-13; D57: each step
// owns its own, never imports another step's). These are literal copies
// of the resolved sets c11.mjs (frozen history, poc/m1/arbiter/) exported
// as LIVE_VERBS/READ_VERBS; step3.test.mjs asserts these copies stay
// equal to c11's originals.

// LIVE_VERBS (26): a PUT/DELETE/PATCH row whose operationId or summary
// lead verb matches one of these raises off the w floor to x.
export const LIVE_VERBS = new Set([
  'accept', 'approve', 'cancel', 'convert', 'dial', 'end', 'execute',
  'hangup', 'invite', 'kick', 'launch', 'merge', 'notify', 'pay', 'publish',
  'reboot', 'refund', 'reject', 'revoke', 'run', 'send', 'start', 'submit',
  'terminate', 'transfer', 'trigger',
]);

// Copied per D57: step 3 uses this only to keep verb tokens out of the
// noun set it builds for the yours-noun allowlist check (nounsForRow) —
// it is not a rule step 3 applies on its own. Step 1 owns the actual
// read-verb rule in its own copy (step1/lists.mjs).
export const NON_NOUN_READ_VERBS = new Set([
  'retrieve', 'verify', 'check', 'query', 'read', 'fetch', 'list', 'search',
  'match', 'count', 'lookup', 'assess', 'find', 'get',
]);
