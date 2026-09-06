// M0's two signals (method, verb) and the tighter-on-unknown arbiter.
// See docs/product/prd.md §4.1 and §5 for the spine this implements.

// Signal 1: HTTP method default, per the -02 draft / RFC 9110.
// GET/HEAD/OPTIONS/TRACE -> r (safe); PUT/DELETE -> w (idempotent, not safe);
// POST/PATCH -> x (neither). Unknown method -> x (tighter-on-unknown, §5).
export const METHOD_DEFAULT = {
  GET: 'r',
  HEAD: 'r',
  OPTIONS: 'r',
  TRACE: 'r',
  PUT: 'w',
  DELETE: 'w',
  POST: 'x',
  PATCH: 'x',
};

/** Look up the method default, falling back to 'x' for any unknown method. */
export function methodDefault(method) {
  const m = String(method ?? '').toUpperCase();
  return METHOD_DEFAULT[m] ?? 'x';
}

export const RANK = { r: 0, w: 1, x: 2 };

/** Return whichever of a/b ranks higher (the tighter class). */
export function tighter(a, b) {
  return RANK[a] >= RANK[b] ? a : b;
}

// SEED verb table — M0's hand-written seed, built from the PRD's
// illustrative examples (§4.1) plus the CAMARA read-named-POST predicates
// named in §1 (retrieve/check/verify/status). M1 replaces this with a
// corpus-derived library built from APIs.guru's openapi-directory (§4/D7);
// this table is not a library and carries no coverage claim beyond CAMARA.
export const SEED = {
  // r — reads
  get: 'r', list: 'r', retrieve: 'r', read: 'r', check: 'r', verify: 'r',
  validate: 'r', query: 'r', fetch: 'r', status: 'r', info: 'r',
  lookup: 'r', match: 'r', search: 'r', discover: 'r', estimate: 'r',
  predict: 'r', find: 'r', count: 'r',
  // w — non-destructive writes
  create: 'w', update: 'w', set: 'w', register: 'w', put: 'w', patch: 'w',
  delete: 'w', remove: 'w', unregister: 'w', replace: 'w', configure: 'w',
  activate: 'w', deactivate: 'w', enable: 'w', disable: 'w', assign: 'w',
  modify: 'w', edit: 'w', extend: 'w', revoke: 'w', cancel: 'w', book: 'w',
  reserve: 'w', subscribe: 'w', unsubscribe: 'w',
  // x — consequential / destructive / external-effect
  send: 'x', trigger: 'x', terminate: 'x', dial: 'x', call: 'x',
  notify: 'x', invoke: 'x', execute: 'x', run: 'x', start: 'x', stop: 'x',
  transfer: 'x', pay: 'x', charge: 'x', refund: 'x', purchase: 'x',
  reset: 'x', reboot: 'x', provision: 'x', deprovision: 'x',
  download: 'x', install: 'x', connect: 'x', disconnect: 'x', swap: 'x',
  initiate: 'x', submit: 'x', order: 'x', release: 'x',
};

// SEED_V2 — a definitional correction from M0 (see docs/logs/m0-2026-09-06.md,
// E4), not a fit to the test bed. The -02 draft's definition of x includes
// "creating a new resource on every call"; SEED had filed several
// resource-minting verbs under w (idempotent write) instead. This table
// moves those verbs to x: create, register, subscribe, book, reserve,
// submit, order, initiate. Every other verb keeps its SEED class.
export const SEED_V2 = {
  ...SEED,
  create: 'x',
  register: 'x',
  subscribe: 'x',
  book: 'x',
  reserve: 'x',
  submit: 'x',
  order: 'x',
  initiate: 'x',
};

const VERSION_SEGMENT = /^v\d+(\.\d+)*$/i;
const PARAM_SEGMENT = /^\{.*\}$/;

// Split a single word on camelCase boundaries (lower/digit -> Upper, and
// an acronym run -> Titlecase, e.g. "HTTPServer" -> ["HTTP", "Server"]).
function splitCamel(word) {
  return word
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
    .split(' ')
    .filter(Boolean);
}

/**
 * Extract verb candidates from an operationId and a path.
 * opVerb: operationId split on camelCase/underscore/hyphen boundaries,
 * first token, lowercased. pathTokens: path split on '/', '-', '_',
 * with empty, {param}, and version (v1, v0.3, ...) segments dropped,
 * every remaining token lowercased.
 * @returns {{opVerb: string|null, pathTokens: string[]}}
 */
export function extractVerbs(path, operationId) {
  let opVerb = null;
  if (operationId) {
    const words = String(operationId).split(/[_\-]+/).filter(Boolean);
    const tokens = words.flatMap(splitCamel);
    if (tokens.length > 0) opVerb = tokens[0].toLowerCase();
  }

  const pathTokens = String(path ?? '')
    .split(/[/\-_]+/)
    .map((t) => t.trim())
    .filter((t) => t.length > 0)
    .filter((t) => !PARAM_SEGMENT.test(t))
    .filter((t) => !VERSION_SEGMENT.test(t))
    .map((t) => t.toLowerCase());

  return { opVerb, pathTokens };
}

/**
 * Look up the first known verb: opVerb first, then path tokens in order.
 * @param {{opVerb: string|null, pathTokens: string[]}} tokens
 * @param {Record<string, 'r'|'w'|'x'>} table
 * @returns {{verb: string, class: 'r'|'w'|'x'}|null}
 */
export function lookupVerb(tokens, table) {
  const { opVerb, pathTokens } = tokens;
  if (opVerb && table[opVerb]) return { verb: opVerb, class: table[opVerb] };
  for (const t of pathTokens) {
    if (table[t]) return { verb: t, class: table[t] };
  }
  return null;
}

/**
 * Shared arbiter logic for arbiter(), arbiterLoosening() and
 * arbiterLoosenToReadOnly(). All three start from the method default,
 * tighten on disagreement, and differ only in whether/when a POST may
 * loosen to the verb's (looser) class — controlled by `options.loosen`:
 *   - undefined/false: never loosen (arbiter / E1-E2).
 *   - true: loosen to whatever looser class the verb signal gives
 *     (arbiterLoosening / E3, E4).
 *   - 'read-only': loosen only when the verb class is 'r'
 *     (arbiterLoosenToReadOnly / E5).
 * @param {{method: string, path: string, operationId: string}} op
 * @param {{useVerb: boolean, table?: Record<string,string>}} ruleset
 * @param {{loosen?: boolean|'read-only'}} [options]
 */
function arbiterCore(op, ruleset, options = {}) {
  const { loosen = false } = options;
  const m = methodDefault(op.method);

  if (!ruleset.useVerb) {
    return { class: m, confidence: 'method-only', rule_id: 'M1', evidence: `method=${op.method}` };
  }

  const tokens = extractVerbs(op.path, op.operationId);
  const found = lookupVerb(tokens, ruleset.table);
  if (!found) {
    return { class: m, confidence: 'method-only', rule_id: 'M1', evidence: `method=${op.method}` };
  }

  const { verb, class: v } = found;
  const evidence = `method=${op.method} verb=${verb}`;

  if (v === m) {
    return { class: m, confidence: 'high', rule_id: 'A1-agree', evidence };
  }

  if (RANK[v] > RANK[m]) {
    return { class: tighter(m, v), confidence: 'low', rule_id: 'A2-tighten', evidence };
  }

  // v is looser than m here.
  if (loosen === false) {
    return { class: m, confidence: 'low', rule_id: 'A3-keep-method', evidence };
  }

  const lastPathToken = tokens.pathTokens[tokens.pathTokens.length - 1];
  const fromAllowedPosition = verb === tokens.opVerb || verb === lastPathToken;
  const verbAllowsLoosen = loosen === 'read-only' ? v === 'r' : true;
  if (op.method?.toUpperCase() === 'POST' && fromAllowedPosition && verbAllowsLoosen) {
    return { class: v, confidence: 'low', rule_id: 'A4-loosen', evidence };
  }
  return { class: m, confidence: 'low', rule_id: 'A3-keep-method', evidence };
}

/**
 * The tighten-only arbiter (E1/E2): method default, tightened by the verb
 * signal when they disagree, never loosened. Under this arbiter a POST can
 * never come out r — that is intentional and exactly what experiment E2 is
 * meant to expose (PRD §1: 57/138 read-named POSTs).
 * @param {{method: string, path: string, operationId: string}} op
 * @param {{useVerb: boolean, table?: Record<string,string>}} ruleset
 */
export function arbiter(op, ruleset) {
  return arbiterCore(op, ruleset, { loosen: false });
}

/**
 * Experiment E3's arbiter: identical to arbiter(), except a POST is allowed
 * to loosen when the verb signal (from opVerb, or from the last path token)
 * says the true class is looser than the method default. Any other
 * disagreement — including a looser verb found elsewhere in the path —
 * still keeps the method default (never loosens).
 */
export function arbiterLoosening(op, ruleset) {
  return arbiterCore(op, ruleset, { loosen: true });
}

/**
 * Identical to arbiterLoosening(), except the A4-loosen branch fires only
 * when the verb class is 'r' — a POST may loosen to r on a read verb, but
 * a POST never loosens to w. When the verb is 'w' and the method default
 * is 'x', the method default is kept (A3-keep-method, low confidence).
 */
export function arbiterLoosenToReadOnly(op, ruleset) {
  return arbiterCore(op, ruleset, { loosen: 'read-only' });
}

export const EXPERIMENTS = {
  E1: { name: 'method-only', fn: arbiter, ruleset: { useVerb: false } },
  E2: { name: 'method+seed-verb, tighten-only', fn: arbiter, ruleset: { useVerb: true, table: SEED } },
  E3: { name: 'method+seed-verb, loosen POST on verb', fn: arbiterLoosening, ruleset: { useVerb: true, table: SEED } },
  E4: { name: 'method+seed-v2, loosen POST on verb', fn: arbiterLoosening, ruleset: { useVerb: true, table: SEED_V2 } },
  E5: { name: 'method+seed-v2, loosen POST to r only', fn: arbiterLoosenToReadOnly, ruleset: { useVerb: true, table: SEED_V2 } },
};
