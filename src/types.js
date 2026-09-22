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
 * `description` is read ONLY by the optional D88 Jev tier (jev.js's
 * jevState) — never by the mechanical steps. Mining description text for
 * the mechanical ladder was tried and rejected (D78: it does not transfer
 * across vendors), so step1/step2/step3 still never open that door.
 *
 * @typedef {Object} Operation
 * @property {string} [method]      HTTP method (GET, POST, PUT, DELETE, PATCH, ...).
 *   Read case-insensitively by every rule that inspects it.
 * @property {string} [path]        The URL path template (e.g. "/users/{id}/permissions").
 *   Used as a fallback lead-string source when operationId is empty.
 * @property {string} [operationId] The OpenAPI operationId, e.g. "getUserPermissions".
 *   The primary source of a row's lead verb.
 * @property {string} [summary]     The OpenAPI summary line. Some rules fall
 *   back to a verb found here when operationId/path give up nothing.
 * @property {string} [description] The OpenAPI description text. Read only
 *   by the optional Jev tier (jev.js); no mechanical step reads it.
 */

/**
 * What a step returns when it claims a row. A `null` return (not this
 * shape) means the step does not claim the row at all, and it passes to the
 * next step untouched.
 *
 * @typedef {Object} Verdict
 * @property {'r'|'w'|'x'} class   The class this step is assigning.
 * @property {1|2|3} step          Which step claimed the row under the D87
 *   ladder: 1 = r, 2 = x, 3 = w. (The Jev tier's 'jev-lower' rule also
 *   reports step 2, since it only ever revisits step 2's own floor.)
 * @property {string} rule         The name of the rule within the step that
 *   fired (e.g. "method", "read-verb", "cant-undo-verb", "method-floor",
 *   "floor-post", "jev-lower").
 * @property {'floor'|'list'|'jev'} source  WHY the row was decided, not
 *   just what class it got (D77). 'floor' means the HTTP method alone
 *   decided it and NO word list matched — a default. 'list' means a word
 *   list fired: a word was read and matched, and that is final, nothing
 *   overrides it. 'jev' means the optional D88 tier lowered a 'floor-post'
 *   verdict from x to w based on a model answer, not a word or a method.
 * @property {string[]} matched    The word-list member(s) that actually
 *   fired, sorted ascending. ALWAYS an empty array for a floor or jev
 *   verdict, since neither matched a word.
 * @property {true} [destructive]  Present and true only on an x verdict
 *   that removes something (D86's refinement flag inside x, never a fourth
 *   class). Absent, never false, on every other verdict.
 * @property {{p: number, model: string}} [jev]  Present only on a
 *   'jev-lower' verdict: the model's own p(x) and version string, so a
 *   signed map never changes silently as the model behind it changes (D88).
 */

export {};
