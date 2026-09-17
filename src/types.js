// Shared JSDoc @typedefs for the r/w/x classifier library. No runtime code
// lives here — this file exists only so every step can `@typedef
// {import('./types.js').X}` the same shapes instead of restating them.

/**
 * One API operation, as this library reads it. Every field is optional: a
 * real OpenAPI spec can omit any of them, and each step's own rules already
 * handle the empty-string / missing-field case (a missing operationId falls
 * back to the last path segment, a missing summary just never matches a
 * summary-verb rule, and so on).
 *
 * `description` is deliberately NOT a field here: no step reads it. Mining
 * the description text was tried and rejected (D78) — it does not transfer
 * across vendors, so this library never opens that door in its own types.
 *
 * @typedef {Object} Operation
 * @property {string} [method]      HTTP method (GET, POST, PUT, DELETE, PATCH, ...).
 *   Read case-insensitively by every rule that inspects it.
 * @property {string} [path]        The URL path template (e.g. "/users/{id}/permissions").
 *   Used as a fallback lead-string source when operationId is empty, and
 *   (by later steps) as a source of path-tail tokens.
 * @property {string} [operationId] The OpenAPI operationId, e.g. "getUserPermissions".
 *   The primary source of a row's lead verb.
 * @property {string} [summary]     The OpenAPI summary line. Some rules fall
 *   back to a verb found here when operationId/path give up nothing.
 */

/**
 * What a step returns when it claims a row. A `null` return (not this
 * shape) means the step does not claim the row at all, and it passes to the
 * next step untouched.
 *
 * @typedef {Object} Verdict
 * @property {'r'|'w'|'x'} class   The class this step is assigning.
 * @property {1|2|3} step          Which step claimed the row (1 = r, 2 = w, 3 = x).
 * @property {string} rule         The name of the rule within the step that fired
 *   (e.g. "method", "read-verb", "read-verb-anywhere").
 * @property {'floor'|'list'} source  WHY the row was decided, not just what
 *   class it got (D77). 'floor' means the HTTP method alone decided it and
 *   NO word list matched — a default, and evidence downstream is free to
 *   override it. 'list' means a word list fired: a word was read and
 *   matched, and that is final, nothing overrides it.
 * @property {string[]} matched    The word-list member(s) that actually
 *   fired, sorted ascending. ALWAYS an empty array for a floor verdict,
 *   since a floor by definition matched no word.
 */

export {};
