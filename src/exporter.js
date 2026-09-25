// The bareguard exporter (D91, amended by D103) — the one place that turns
// a parsed OpenAPI document into the two artefacts the contract names: the
// draft `tools` section of `bareguard.rwx.json`, and a human-facing sidecar
// review report. It classifies nothing itself; every letter here comes from
// flow.js's classifyRow, so the ladder stays the single source of the
// r/w/x judgement and this file only reshapes it.
//
// THE BOUNDARY (PRD "bareguard alignment"): bareguard owns the gate — the
// file format, agent grants, deny-by-absence, and the `flags` deny
// primitive that lives in its own gate config. rwxmap owns the labels and
// the carriers. So this file NEVER emits a `flags` key, NEVER emits an
// `agents` section, and never writes a deny rule: denial is the operator's
// call at grant time, and an agent-authored deny rule would cross
// bareguard's authorship boundary. `evidence` and `destructive` are
// rwxmap's own reporting and stay in the sidecar, never in the gate file.
//
// D103 — THE EXPORTER EMITS EVERY ROW. D91's older policy left floor
// PUT/PATCH rows out of the export, on the theory that deny-by-absence
// would force a human to write the letter. That policy is dead: those
// rows are right 96.6% of the time (1601 of 1657 on the 8376-row tuning
// pool) and omitting them cost a reviewer a median of 38 rows per spec.
// The `loose` marker now says what the omission used to say, without
// deleting the row. There is therefore no filter anywhere below — no row
// is ever dropped, for any reason. The marker is what tells the consumer
// how hard to stop on a row.
//
// The sidecar is HUMAN-FACING ONLY. bareguard never reads it (an unlisted
// tool already denies at runtime with `rwx.unlisted`), so its shape is
// rwxmap's to choose and must not be designed as a bareguard input.
import { classifyRow } from './flow.js';

/** @typedef {import('./types.js').Operation} Operation */
/** @typedef {import('./types.js').Verdict} Verdict */

/**
 * One entry in the gate file's `tools` map, in the D103 object form. The
 * bare-letter form (a plain `'r'`/`'w'`/`'x'` string) stays legal forever
 * and is what `form: 'letter'` emits instead of this.
 *
 * @typedef {Object} GateEntry
 * @property {'r'|'w'|'x'} letter  The class, identity with D87's letter.
 * @property {'tight'|'loose'|'settled'} marker  rwxmap's `review` hint
 *   (D101), whose one writer is flow.js's reviewHint. Nothing else may go
 *   on a tool entry.
 */

/**
 * TWO OPERATIONS THAT LANDED ON ONE KEY. Recorded rather than silently
 * resolved, because a collision means the vendor's own naming cannot tell
 * two actions apart and only a human can fix that.
 *
 * @typedef {Object} Collision
 * @property {string} key  The gate key both operations produced.
 * @property {{method: string, path: string, letter: 'r'|'w'|'x'}} existing
 *   The operation already holding the key.
 * @property {{method: string, path: string, letter: 'r'|'w'|'x'}} incoming
 *   The operation that arrived second.
 * @property {'r'|'w'|'x'} keptLetter  The letter the key ends up with —
 *   always the tighter of the two (see TIGHTNESS below).
 */

/**
 * One row of the sidecar: everything rwxmap knows about one operation,
 * including the two fields (`evidence`, `destructive`) that the contract
 * keeps out of the gate file.
 *
 * @typedef {Object} SidecarRow
 * @property {string} key
 * @property {string} method
 * @property {string} path
 * @property {'r'|'w'|'x'} letter
 * @property {'tight'|'loose'|'settled'} marker
 * @property {'floor'|'list'|'jev'} evidence  WHY the row was decided (D77).
 * @property {boolean} destructive  D86's refinement flag inside x. Always a
 *   real boolean here, unlike the verdict's optional `destructive`, because
 *   a report a human reads should not make them wonder what an absent field
 *   meant.
 */

// The real HTTP methods an OpenAPI path item may carry (OpenAPI 3.x fixed
// fields). Everything else at that level — `parameters`, `$ref`,
// `summary`, `description`, `servers`, and any `x-` extension — is not an
// operation and must not become a row.
const HTTP_METHODS = new Set(['get', 'put', 'post', 'delete', 'options', 'head', 'patch', 'trace']);

// TIGHTNESS — the project's one invariant, as a number so two letters can
// be compared. r < w < x: x is the tightest, r the loosest. On a collision
// the HIGHER number wins, so a key that already holds a tight letter can
// never be loosened by a later operation. Never invert this.
const TIGHTNESS = { r: 0, w: 1, x: 2 };

/**
 * Read the operations out of a parsed OpenAPI document.
 *
 * This function does NO I/O and NO parsing: the caller has already read
 * the file and turned it into an object (JSON.parse, or a YAML parser of
 * their choosing). Keeping file and format handling out of the library is
 * what lets rwxmap stay dependency-free.
 *
 * A missing operationId STAYS MISSING here. Synthesising a name is the key
 * builder's job (gateKey below) and it is the only writer of that
 * decision — if this function invented one too, two different fallbacks
 * could drift apart.
 *
 * @param {any} spec  A parsed OpenAPI document. Typed loosely on purpose:
 *   this is untrusted third-party JSON, not a shape rwxmap controls.
 * @returns {Operation[]} flat, in document order; [] when there is no
 *   usable `paths` object at all.
 */
export function operationsFrom(spec) {
  const paths = spec && typeof spec === 'object' ? spec.paths : undefined;
  if (!paths || typeof paths !== 'object') return [];

  /** @type {Operation[]} */
  const operations = [];
  for (const [path, pathItem] of Object.entries(paths)) {
    if (!pathItem || typeof pathItem !== 'object') continue;
    for (const [field, operation] of Object.entries(pathItem)) {
      if (!HTTP_METHODS.has(field.toLowerCase())) continue;
      if (!operation || typeof operation !== 'object') continue;

      /** @type {Operation} */
      const row = { method: field.toUpperCase(), path };
      // Only real strings are copied across. An absent field stays absent
      // rather than becoming `undefined`, so a row carries no key it
      // cannot answer for.
      if (typeof operation.operationId === 'string') row.operationId = operation.operationId;
      if (typeof operation.summary === 'string') row.summary = operation.summary;
      if (typeof operation.description === 'string') row.description = operation.description;
      operations.push(row);
    }
  }
  return operations;
}

/**
 * THE ONE WRITER of a gate key. bareguard matches a `tools` key literally
 * against the harness's action `type` and does no namespacing of its own,
 * so the vendor prefix is what stops two vendors' `createUser` colliding.
 * The dot is just a character to bareguard — no nesting, no prefix
 * matching (D91).
 *
 * The fallback chain, in order:
 *   1. the operationId;
 *   2. the last non-empty path segment, with any `{...}` template braces
 *      stripped — a templated tail is still a better name than nothing;
 *   3. the lowercased HTTP method, when even that comes out empty.
 * Step 3 can produce a key that several operations share; that is what
 * the collision handling below exists for, and it is reported rather
 * than hidden.
 *
 * @param {string} vendor
 * @param {Operation} row
 * @returns {string}
 */
function gateKey(vendor, row) {
  const id = (row.operationId || '').trim();
  if (id) return `${vendor}.${id}`;

  const segments = (row.path || '').split('/').filter((s) => s.trim() !== '');
  const tail = (segments.length ? segments[segments.length - 1] : '').replace(/[{}]/g, '').trim();
  if (tail) return `${vendor}.${tail}`;

  return `${vendor}.${(row.method || '').toLowerCase()}`;
}

/**
 * Require a usable vendor. An unkeyed file would collide across vendors the
 * moment a second one was added, and bareguard cannot detect that for us,
 * so this throws rather than defaulting to something plausible.
 *
 * @param {{vendor?: string}} options
 * @returns {string}
 */
function requireVendor(options) {
  const vendor = (options && options.vendor ? String(options.vendor) : '').trim();
  if (!vendor) {
    throw new Error('exporter: options.vendor is required — a bareguard tools key is `<vendor>.<operationId>`, and an unkeyed file collides across vendors');
  }
  return vendor;
}

/**
 * Classify every operation once and resolve keys, so the gate and the
 * sidecar can never disagree about a row's letter, marker or key. Both
 * exported builders call this and reshape what it returns; neither
 * re-derives any of it.
 *
 * @param {Operation[]} operations
 * @param {string} vendor
 * @returns {{rows: SidecarRow[], entries: Map<string, GateEntry>, collisions: Collision[]}}
 */
function classifyAll(operations, vendor) {
  /** @type {SidecarRow[]} */
  const rows = [];
  /** @type {Map<string, GateEntry>} */
  const entries = new Map();
  // Which operation currently HOLDS each key, tracked beside the entry
  // rather than looked up in `rows` afterwards: after a collision the
  // holder may be the second operation, so the first row with a matching
  // key is not reliably the one whose letter is in the map.
  /** @type {Map<string, {method: string, path: string}>} */
  const holders = new Map();
  /** @type {Collision[]} */
  const collisions = [];

  for (const operation of operations || []) {
    const verdict = classifyRow(operation);
    const key = gateKey(vendor, operation);
    const method = operation.method || '';
    const path = operation.path || '';

    rows.push({
      key,
      method,
      path,
      letter: verdict.class,
      marker: verdict.review,
      evidence: verdict.source,
      destructive: verdict.destructive === true,
    });

    const held = entries.get(key);
    const holder = holders.get(key);
    if (!held || !holder) {
      entries.set(key, { letter: verdict.class, marker: verdict.review });
      holders.set(key, { method, path });
      continue;
    }

    // COLLISION. Never a silent overwrite: the tighter letter wins, and on
    // a tie the first one stays. Loosening an already-placed key would be
    // fail-open — exactly what the invariant forbids — so the comparison is
    // strictly greater-than, never greater-or-equal.
    const takeIncoming = TIGHTNESS[verdict.class] > TIGHTNESS[held.letter];
    collisions.push({
      key,
      existing: { method: holder.method, path: holder.path, letter: held.letter },
      incoming: { method, path, letter: verdict.class },
      keptLetter: takeIncoming ? verdict.class : held.letter,
    });
    if (takeIncoming) {
      entries.set(key, { letter: verdict.class, marker: verdict.review });
      holders.set(key, { method, path });
    }
  }

  return { rows, entries, collisions };
}

/**
 * Build the draft `tools` section of `bareguard.rwx.json`.
 *
 * The return is `{ tools, collisions }` rather than a bare `tools` object
 * on purpose: a collision is something a human must see, and returning
 * only the map would make losing that report the default.
 *
 * @param {Operation[]} operations
 * @param {{vendor?: string, form?: 'object'|'letter'}} options
 *   `vendor` is required. `form` picks the entry shape: 'object' (the
 *   default) emits D103's `{ letter, marker }`; 'letter' emits the bare
 *   letter, which stays legal forever and is what a consumer who does not
 *   want the marker should ask for. Both are correct output.
 * @returns {{tools: Record<string, GateEntry|'r'|'w'|'x'>, collisions: Collision[]}}
 */
export function exportGate(operations, options = {}) {
  const vendor = requireVendor(options);
  const form = options.form ?? 'object';
  if (form !== 'object' && form !== 'letter') {
    throw new Error(`exporter: options.form must be 'object' or 'letter', got ${JSON.stringify(options.form)}`);
  }

  const { entries, collisions } = classifyAll(operations, vendor);

  /** @type {Record<string, GateEntry|'r'|'w'|'x'>} */
  const tools = {};
  for (const [key, entry] of entries) {
    tools[key] = form === 'letter' ? entry.letter : { letter: entry.letter, marker: entry.marker };
  }
  // No `flags`, no `agents`, no `evidence`, no `destructive` — see the file
  // header. Those are bareguard's authorship or the sidecar's job.
  return { tools, collisions };
}

/**
 * Build the sidecar review report — the artefact a PERSON reads before
 * committing the gate file. bareguard never reads this, so it is shaped
 * for a reviewer rather than for a parser.
 *
 * @param {Operation[]} operations
 * @param {{vendor?: string}} options  `vendor` is required, same as the gate.
 * @returns {{
 *   vendor: string,
 *   counts: {
 *     rows: number,
 *     byLetter: {r: number, w: number, x: number},
 *     byMarker: {tight: number, loose: number, settled: number},
 *     byEvidence: {floor: number, list: number, jev: number},
 *   },
 *   rows: SidecarRow[],
 *   review: SidecarRow[],
 *   destructiveSuggestions: {note: string, rows: SidecarRow[]},
 *   collisions: Collision[],
 * }}
 */
export function exportSidecar(operations, options = {}) {
  const vendor = requireVendor(options);
  const { rows, collisions } = classifyAll(operations, vendor);

  const counts = {
    rows: rows.length,
    byLetter: { r: 0, w: 0, x: 0 },
    byMarker: { tight: 0, loose: 0, settled: 0 },
    byEvidence: { floor: 0, list: 0, jev: 0 },
  };
  for (const row of rows) {
    counts.byLetter[row.letter] += 1;
    counts.byMarker[row.marker] += 1;
    counts.byEvidence[row.evidence] += 1;
  }

  // WHAT TO READ FIRST. `loose` leads because that is where the danger is:
  // a w on a PUT/PATCH the method floor guessed, with no word evidence
  // either way, is where the residual too-loose rows live. `tight` follows
  // because it costs only usability — it is a build-time worklist meaning
  // "review this to LOOSEN it", never a security risk (D103). `settled`
  // rows are not listed here at all; they are still in `rows`, since
  // nothing is ever omitted.
  const review = [
    ...rows.filter((r) => r.marker === 'loose'),
    ...rows.filter((r) => r.marker === 'tight'),
  ];

  return {
    vendor,
    counts,
    rows,
    review,
    destructiveSuggestions: {
      note: 'SUGGESTION FOR THE OPERATOR, NOT CONFIG. These rows classify as x and look like they remove something. rwxmap does not write bareguard deny rules and never will: denial is your call at grant time, and bareguard\'s deny mechanism (the `flags` primitive) lives in your own gate config, not in bareguard.rwx.json and not on a tool entry. Read this list, decide for yourself, and write any deny rule by hand.',
      rows: rows.filter((r) => r.destructive),
    },
    collisions,
  };
}
