// The optional Jev tiers (D82/D88/D95, docs/wiki/decisions-log.md). The
// core (flow.js's classifyRow) works fully without this file — it is
// pending against the adoption bar, not required, and it is opt-in for
// two independent reasons: an adopter must choose to make the call at
// all, and must disclose that spec text (operation method/path/
// operationId/summary/description) leaves the process to an outside
// service when they do.
//
// Pure functions only. NO network code, NO key handling, NO fetch lives
// here — that plumbing (reading a key from `pass`, retries, batching) is
// the adopter's or the POC runner's job (see poc/jev-tiers/run.mjs for the
// reference shape), never this library's.
//
// D88 (2026-09-22) widened D82/D83's raise-only rule: Jev may also LOWER
// x to w, but only on rows the mechanical flow could not place any word
// or method evidence for — flow.js's 'floor-post' rows, D87's tightest
// default.
//
// D95 (user ruling, 2026-09-23) SPLITS that one tier into THREE
// independent tiers. Each reads only its own pile of mechanical verdicts,
// may make only its own ONE-WAY move, and keeps its OWN ledger. No tier
// can undo another's move, because no two piles overlap and no tier ever
// reads a verdict another tier produced:
//
//   tier            pile (mechanical rule)        move          question
//   jev-lower       'floor-post'        (x)       x -> w only   isX
//   jev-raise-wx    'method-floor'      (w)       w -> x only   isX
//   jev-raise-get   'method' + class r  (r)       r -> w only   changes
//
// jev-raise-get asks a DIFFERENT question from the other two. The GET
// pile's leaks are truth w, not truth x, so an "is this x" question
// cannot find them by construction — a leaking r row answers "no" to it
// exactly as a correct r row does. The question that separates them is
// the r boundary itself: does anything change at all?
//
// Every moved verdict records the model's own p and version
// (`jev: {p, model}`), because a signed map must not change silently as
// the model behind it changes (D88).

import { reviewHint } from './flow.js';

/** @typedef {import('./types.js').Operation} Operation */
/** @typedef {import('./types.js').Verdict} Verdict */

// ---- thresholds ---------------------------------------------------------
// Each tier owns its own threshold. They are exported as named constants so
// a caller can pass its own values through applyJev's `thresholds` option;
// these are the defaults, and no tier reads another tier's.

// jev-lower's threshold. Lower to w only when Jev is at least 90% sure the
// row is w — i.e. its own p(x) is at or under this value. User ruling,
// 2026-09-22 (D88). Chosen by leave-one-vendor-out against a fixed/leak
// ratio bar of 10 on the tuning set (all 23 provider folds picked it).
// Exported under BOTH names: JEV_THRESHOLD is the pre-D95 name and stays
// for back-compat, JEV_LOWER_THRESHOLD is the name that says which tier it
// belongs to. They are the same number, always.
export const JEV_THRESHOLD = 0.10;
export const JEV_LOWER_THRESHOLD = JEV_THRESHOLD;

// jev-raise-wx's threshold: raise a PUT/PATCH method-floor w to x only when
// p(x) is at or above this. Default pending a variance re-run — no
// threshold can be pinned from one run, because Jev is non-deterministic.
export const JEV_RAISE_WX_THRESHOLD = 0.80;

// jev-raise-get's threshold: raise a GET/HEAD/OPTIONS method-floor r to w
// only when p(changes) is at or above this. Same caveat.
export const JEV_RAISE_GET_THRESHOLD = 0.50;

/** r < w < x — the one ordering the whole project turns on. */
const RANK = { r: 0, w: 1, x: 2 };

/**
 * The three tiers. `pile` and `from` together select the mechanical
 * verdicts this tier is allowed to read; `to` is the ONLY class it may move
 * a row to; `direction` is the only direction it may move in; `question` is
 * which Noul key its answer must carry.
 * @type {Record<string, {question: string, pile: string, from: 'r'|'w'|'x', to: 'r'|'w'|'x', direction: 'raise'|'lower', threshold: number}>}
 */
const TIERS = {
  'jev-lower': {
    question: 'isX',
    pile: 'floor-post',
    from: 'x',
    to: 'w',
    direction: 'lower',
    threshold: JEV_LOWER_THRESHOLD,
  },
  'jev-raise-wx': {
    question: 'isX',
    pile: 'method-floor',
    from: 'w',
    to: 'x',
    direction: 'raise',
    threshold: JEV_RAISE_WX_THRESHOLD,
  },
  'jev-raise-get': {
    question: 'changes',
    pile: 'method',
    from: 'r',
    to: 'w',
    direction: 'raise',
    threshold: JEV_RAISE_GET_THRESHOLD,
  },
};

/** The tier names, in ladder order. */
export const JEV_TIERS = Object.freeze(Object.keys(TIERS));

/**
 * What one tier is allowed to do, as a plain copy a caller can read without
 * reaching into this module's own table.
 * @param {string} tier
 * @returns {{tier: string, question: string, pile: string, from: string, to: string, direction: string, threshold: number}|null}
 */
export function jevTier(tier) {
  const spec = TIERS[tier];
  if (!spec) return null;
  return { tier, ...spec };
}

/**
 * The state sent to Jev for one row: deliberately no step verdict, no tool
 * class, no truth — a move must never be anchored toward the mechanical
 * flow's own guess. It names its five fields explicitly and copies nothing
 * else off the row, so a `truth_class` field sitting beside them can never
 * reach the model. `description` may be absent on a real Operation; it
 * comes back null rather than undefined.
 * @param {Operation} row
 * @returns {{method: string|undefined, path: string|undefined, operationId: string|undefined, summary: string|null, description: string|null}}
 */
export function jevState(row) {
  return {
    method: row.method,
    path: row.path,
    operationId: row.operationId,
    summary: row.summary || null,
    description: row.description || null,
  };
}

// =========================================================================
// The brief, transcribed.
//
// SOLE SOURCE: data/relabel-2026-09-22/BRIEF-v3.md (the D87 "chmod"
// definition), as ADOPTED 2026-09-22 and AMENDED 2026-09-23 by D98
// (posting a comment or a reaction is w, not x). Every block below is
// transcribed from that file; nothing here is read from any label, key,
// ruling or truth file, and nothing beyond the brief's own words is
// invented. When the brief changes, this file is re-transcribed from it —
// never edited from memory.
// =========================================================================

// ---- the three letters, verbatim from BRIEF-v3.md ----
const LETTERS = {
  r: 'r — READ. Nothing changes. A read, echo, validate, search, calculation, preview or dry-run. Usual for GET; it also happens on POST and, rarely, on PUT/DELETE/PATCH.',
  w: "w — WRITE. Something changes, and a later call of this same API can set it back. It does not matter whose thing it is: the caller's own record or another person's role, both are w if a later write restores the prior state. Edits, sets, renames, moves, creates, toggles (enable/disable, activate/deactivate, suspend/unsuspend, archive/unarchive, pause/resume, lock/unlock, block/unblock, assign/unassign, attach/detach, hide/unhide, mute/unmute), and stops or cancels of something that can be started again.",
  x: 'x — EXECUTE. Something happened that no later write can take back. Deletes and removals, revokes, expires, voids, sends, publishes, charges, pays, refunds, runs a job. Once done, it is done.',
  doubt: 'Unsure -> x.',
};

// ---- "Methods", verbatim from BRIEF-v3.md. Kept (unlike the pre-D95
// POST-only tier) because these piles hold GET, POST, PUT and PATCH rows,
// so the method defaults are part of the question. ----
const METHODS = {
  what: 'GET, HEAD and OPTIONS are r unless the text says the call changes something (a GET that "sends", "triggers" or "deletes" is labelled by what it does). DELETE is x: the thing is gone. The only DELETE that is w is one whose text says the thing goes to a trash or recycle bin, is soft-deleted, or can be restored or undeleted by this API. PUT and PATCH are w unless the text says the call does one of the x things. POST has no default: label it by what it does.',
  i: 'A POST that only reads — a search, lookup, query, check, verify, match, validate, calculation, estimate, preview, dry-run, or an answer generated and returned but not stored — is r.',
  ii: 'A POST that creates something and does nothing else is w. A new record, resource, definition, container, subscription, webhook, key, token, file, upload or draft: it can be deleted again, and calling it twice makes two, which is a mess, not damage. Create, add, register, provision, upload, insert, import into own store all count as creating.',
  iii: 'A POST that edits, sets, moves, archives, closes, marks, enables, disables or otherwise changes an existing item is w, exactly as it would be on PUT or PATCH.',
  iv: 'A POST that does one of the x things is x, even when it also creates something: creating a message that is sent, creating a payment that charges, creating a run that executes, creating an invite that is delivered.',
};

// ---- the x side: "What cannot be undone (x)" from BRIEF-v3.md.
// Clause (c) is the AMENDED (2026-09-23, D98) text. ----
const CANT_UNDO = {
  what: 'The text must say, or make plain, that one of these happens.',
  a: 'It deletes, removes, purges, wipes, destroys, erases, drops, truncates or clears a record, resource, file, message, history or data, and the text names no trash, restore or undelete. Recreating a similar thing later is not undoing: the original, with its id, history, links and contents, is gone.',
  b: 'It revokes, expires, invalidates, terminates, kills, rotates or resets a credential, key, token, secret, certificate, session, password or consent. Issuing a new one is not undoing.',
  c: 'It sends, delivers, notifies, publishes, posts or exposes something to a person or to the public: a message, an email, an SMS, a notification, a public listing. It cannot be unsent or unseen. Making something public counts; making it private again later does not undo the exposure. This clause covers what leaves the system and cannot be recalled — an email, an SMS, a notification, an invite, a public listing. It does NOT cover posting a comment or a reaction into a thread that this same API can delete: those are w.',
  d: 'It moves money or commits to an outside party: charges, refunds, pays out, bills, confirms a payment or purchase, places or cancels an order with a carrier, registry, bank, airline or marketplace, renews a paid plan.',
  e: 'It runs, triggers, executes, dispatches, syncs, imports from an outside source, rebuilds, re-runs or starts a job: the run happens and cannot be un-run, even when it touches only the caller\'s own data.',
  f: 'It cancels, aborts or stops something whose work or state is lost by stopping it: a running job whose progress is discarded, an order, payout or transaction that cannot be re-opened, a state machine that cannot step back.',
};

// ---- the w side: "What can be set back (w)" from BRIEF-v3.md ----
const CAN_SET_BACK = {
  what: 'What can be set back (w), even when it touches another person.',
  list: [
    "editing plain details, settings, configuration, names, fields, preferences, prices, plans, templates, definitions or containers, yours or anyone's",
    'changing a role, permission, membership, assignment, owner or collaborator, when the text says nothing about a notification, an invite being sent, or a session being ended: the previous value can be set again',
    'a toggle with a named opposite in the same API (enable/disable, activate/deactivate, suspend/unsuspend, archive/unarchive, pause/resume, lock/unlock, block/unblock, assign/unassign, attach/detach, hide/unhide, mute/unmute). Do NOT infer an opposite the API does not offer; if the text names none and the thing is gone, it is x by (a)',
    'a delete whose text says the thing goes to a trash or recycle bin, is soft-deleted, or can be restored or undeleted',
    'removing one item from a list, set or membership where adding it back is one more call (remove a tag from a contact, remove a track from a playlist) — on POST, PUT or PATCH only. On DELETE the method wins: a DELETE is x unless a trash or restore is named, even when what it removes is a membership, an assignment or a role. Removing the list or the item itself is x by (a)',
    'stopping or pausing something that can be started again: stop own transcoder, pause a campaign, stop a server',
    'a plain create, per (ii)',
  ],
};

// ---- "Rules that trip people up" from BRIEF-v3.md (the ones a cold binary
// question can use; the "?" escape hatch is dropped, it has no Noul
// equivalent — see "Unsure -> x" in LETTERS instead) ----
const TRIPWIRES = [
  '"Whose thing is it" is NOT the test. Editing another user\'s profile, role or permissions is w; deleting your own draft is x. Ask one thing only: after this call, can a later call put things back the way they were?',
  'Severity, sensitivity and size are NOT the test. Deleting one small record and deleting a whole company record are both x by (a). Editing sensitive personal data is w.',
  'A path parameter is not a reach and not a delete. {userId}, {customerId}, {teamId} name a record. Label by what the call does to it.',
  'A cascade of edits stays w. A cascade of deletes is x by (a), and no more than x.',
  '"May", "possibly", "could affect" are not evidence. Do not infer a send the text does not name, and do not infer a restore the API does not name. "The record could be recreated" is not undoable.',
  'A create that the text says notifies, invites, sends, charges or runs is x by (iv). A create the text says nothing about is w.',
  'Posting a COMMENT or a REACTION is w, not x. A comment or a reaction can be deleted by the same API, so a later call puts things back the way they were, which is the whole test. Clause (c) does not bite here: nothing left the system that cannot be recalled. This covers POST reactions/create-for-team-discussion, POST pulls/create-review-comment, POST chatMessage.setReaction and POST post_comments alike. It does not change DELETE: deleting a comment is still x unless a trash or restore is named.',
  'When the row genuinely could be either AFTER applying the lists above, pick the TIGHTER class (x over w, w over r).',
];

// ---- the "does anything change" reading of the same brief, for
// jev-raise-get. The GET/HEAD/OPTIONS line is verbatim from "Methods"; the
// change lists are the brief's own x and w lists (both are changes); the
// no-change list is the brief's r material. ----
const GET_LINE =
  'GET, HEAD and OPTIONS are r unless the text says the call changes something (a GET that "sends", "triggers" or "deletes" is labelled by what it does).';

const NO_CHANGE = {
  what: 'Nothing changes. The call only reads.',
  list: [
    'a read, echo, validate, search, calculation, preview or dry-run',
    'a lookup, query, check, verify, match or estimate that stores nothing',
    'an answer generated and returned but not stored',
    'listing, fetching, exporting or downloading what already exists',
    'returning a computed or derived value the API does not keep',
  ],
};

const CHANGES_TRIPWIRES = [
  '"Whose thing is it" is NOT the test. A change to another user\'s profile, role or permissions is still a change; so is a change to your own draft. Ask one thing only: after this call, is anything different from before?',
  'Severity, sensitivity and size are NOT the test. A one-field edit and a whole-company delete both change something.',
  'A path parameter is not a reach and not a change. {userId}, {customerId}, {teamId} name a record. Judge by what the call does to it.',
  '"May", "possibly", "could affect" are not evidence. Do not infer a change the text does not name.',
  'Issuing, generating or returning a token, report, link or export changes something only if the text says the API stores or sends it; if it is merely computed and returned, nothing changed.',
  'When the row genuinely could be either AFTER applying the lists above, pick the TIGHTER answer: a change over no change.',
];

const FRAMING =
  'Each row is one HTTP operation. Decide what happens when a caller who holds a normal API key for this provider calls it.';

/** The "is this operation x" Noul — jev-lower and jev-raise-wx. */
function isXQuestion() {
  return {
    isX: {
      type: 'noul',
      instructions: {
        framing: FRAMING,
        question: 'Is this operation x?',
        definition: `${LETTERS.r} ${LETTERS.w} ${LETTERS.x} ${LETTERS.doubt} "Whose thing it is" is NOT a test. A pure read is not x.`,
        inspect: ['description', 'summary', 'operationId', 'path', 'method'],
        focus:
          'Apply the method defaults in criteria.true.methods, then the cannot-be-undone list in criteria.true and the can-set-back list in criteria.false, BEFORE instinct. They settle the disputed rows and override a first impression.',
        ignore: TRIPWIRES,
      },
      criteria: {
        true: {
          what: 'The operation cannot be undone (x).',
          methods: METHODS,
          cannot_be_undone: CANT_UNDO,
          examples: [
            'Delete a record, the text names no trash or restore (a)',
            'Revoke a credential, key, token or consent (b)',
            'Send a message, email or notification to a person (c)',
            'Charge a payment or refund one (d)',
            'Trigger a pipeline run or sync (e)',
            'Cancel a running job whose progress is lost by stopping it (f)',
            'A create that also sends an invite, charges a card, or runs a job (iv)',
          ],
        },
        false: {
          what: 'A later call of the same API can set the change back (w), or the call only reads (r). Either way it is not x.',
          can_be_set_back: CAN_SET_BACK,
          examples: [
            "Edit another user's role, no notification or session-end named",
            'Toggle disable, the same API also offers an enable',
            'A plain create of a webhook, the text says nothing else (ii)',
            'Remove one tag from a contact, not the whole list, on POST, PUT or PATCH',
            'Pause a campaign or stop a transcoder, either can be started again',
            'Post a comment or a reaction into a thread this same API can delete',
            'A PUT or PATCH that edits plain fields, the text names no x thing',
            'A POST that only searches, validates or previews and stores nothing (i)',
          ],
        },
      },
    },
  };
}

/** The "does this operation change anything" Noul — jev-raise-get. */
function changesQuestion() {
  return {
    changes: {
      type: 'noul',
      instructions: {
        framing: FRAMING,
        question: 'Does this operation change anything?',
        definition: `${LETTERS.r} ${LETTERS.w} ${LETTERS.x} A w and an x both CHANGE something; only an r changes nothing. ${GET_LINE} Unsure -> it changes something.`,
        inspect: ['description', 'summary', 'operationId', 'path', 'method'],
        focus:
          'Apply the no-change list in criteria.false and the change lists in criteria.true BEFORE instinct. The method alone is not the answer: judge by what the text says the call does.',
        ignore: CHANGES_TRIPWIRES,
      },
      criteria: {
        true: {
          what: 'Something is different after the call: it writes, deletes, sends, runs, charges or otherwise changes state. It is w or x, not r.',
          changes_and_cannot_be_undone: CANT_UNDO,
          changes_but_can_be_set_back: CAN_SET_BACK,
          examples: [
            'A GET whose text says it sends, triggers, resets or deletes something',
            'A call that starts, runs or dispatches a job',
            'A call that marks something read, seen, acknowledged or dismissed',
            'A call that creates or stores a record as a side effect of fetching',
            'A call that rotates, issues and stores, or invalidates a credential',
          ],
        },
        false: {
          what: 'Nothing is different after the call (r).',
          nothing_changes: NO_CHANGE,
          examples: [
            'List, get, fetch, search or export existing records',
            'Validate, check or verify input and return the result, storing nothing',
            'A preview, estimate, calculation or dry-run',
            'Download a file the API already holds',
            'Return the current status or configuration',
          ],
        },
      },
    },
  };
}

/**
 * The Noul question object for one tier, transcribed from BRIEF-v3 above.
 * Called with no argument it returns the isX question, which is what every
 * pre-D95 caller expected.
 * @param {string} [tier] one of JEV_TIERS; omitted means the isX question.
 * @returns {object}
 */
export function jevQuestions(tier) {
  if (tier === undefined) return isXQuestion();
  const spec = TIERS[tier];
  if (!spec) throw new Error(`unknown jev tier ${tier}`);
  return spec.question === 'changes' ? changesQuestion() : isXQuestion();
}

/**
 * Which tier, if any, may be asked about this verdict. A verdict belongs to
 * at most one tier: the three piles are disjoint by rule name, and the one
 * rule name two tiers could in principle share ('method') is pinned to
 * class r as well.
 *
 * Returns the TIER NAME (a truthy string) or null, rather than the bare
 * boolean it returned before D95. Every existing caller uses it as a
 * condition (`if (needsJev(v))`), so a truthy string keeps them working
 * while telling a new caller which question to ask and which answer to
 * send back.
 * @param {Verdict|null} [verdict] A missing verdict belongs to no tier —
 *   fail closed rather than throw, same as every other unusable input here.
 * @returns {string|null}
 */
export function needsJev(verdict) {
  if (!verdict) return null;
  for (const [name, spec] of Object.entries(TIERS)) {
    if (verdict.rule === spec.pile && verdict.class === spec.from) return name;
  }
  return null;
}

/**
 * The move a tier is allowed to make. Throws on anything else — a lowering
 * tier that raises, a raising tier that lowers, or a tier that moves a row
 * to the class it already had, is a BUG in this file, never a verdict to
 * publish. Exported so a test can prove the backstop fires.
 * @param {string} tier
 * @param {string} from
 * @param {string} to
 * @returns {true}
 */
export function assertJevMove(tier, from, to) {
  const spec = TIERS[tier];
  if (!spec) throw new Error(`unknown jev tier ${tier}`);
  if (RANK[from] === undefined || RANK[to] === undefined) throw new Error(`bad class ${from}->${to}`);
  if (from !== spec.from) throw new Error(`tier ${tier} moves from ${spec.from}, got ${from}`);
  if (to !== spec.to) throw new Error(`tier ${tier} may only move to ${spec.to}, got ${to}`);
  const dir = RANK[to] > RANK[from] ? 'raise' : RANK[to] < RANK[from] ? 'lower' : 'none';
  if (dir !== spec.direction) throw new Error(`tier ${tier} may only ${spec.direction}, ${from}->${to} is a ${dir}`);
  return true;
}

/**
 * Apply a Jev answer to a verdict, under the ONE tier that owns the
 * verdict's pile. Returns the verdict UNCHANGED unless every one of these
 * holds: a tier claims the verdict, an answer is present, `answer.p` is a
 * finite number in [0, 1], `answer.model` is a non-empty string, and p is
 * on the firing side of the tier's threshold (p <= t for a lowering tier,
 * p >= t for a raising one).
 *
 * This must be fail-CLOSED, not merely "not fail-open on the common case":
 * `Number.isFinite` rejects NaN and ±Infinity (a bare `p > t` check lets
 * NaN through silently, since every comparison against NaN is false — the
 * bug this discipline exists to stop), the [0, 1] bounds reject a p a
 * malformed caller could send, `typeof p === 'number'` is implied by
 * `Number.isFinite` so a string like '0.05' is rejected without a separate
 * check, and the model check means an answer that moves the class but
 * carries no model string is rejected outright — the whole point of
 * recording `jev.model` (D88) is that a signed map must not change silently
 * as the model behind it changes, so a moved verdict with an unrecorded
 * model is worse than not moving at all. Any row this function declines to
 * touch stays exactly at its mechanical class.
 *
 * The moved verdict keeps the mechanical verdict's own `step`, because a
 * tier only ever revisits the pile that step already floored, and it drops
 * `destructive` and `matched` — no word matched, so there is nothing to
 * report but the model's own p and version.
 *
 * @param {Verdict} verdict
 * @param {{p?: unknown, model?: unknown}|null} [answer] Both fields are typed
 *   loosely (unknown, not number/string) because a malformed answer —
 *   missing, wrong type — is exactly the input the fail-closed checks
 *   below must handle, not a case the type system should rule out before
 *   the checks run.
 * A moved verdict's `review` hint is RECOMPUTED here, through flow.js's
 * reviewHint — the same one writer classifyRow uses — because a row whose
 * class moved must never carry the hint its old class earned. `options.method`
 * supplies the row's method for that recomputation; it is optional because a
 * moved verdict's source is always 'jev', which rules out 'loose' outright,
 * and the one hint the method could still decide ('tight' = x on a POST) is
 * unreachable from every tier: jev-lower and jev-raise-get both end at w, and
 * jev-raise-wx reads only the 'method-floor' pile, which step 3 fills with
 * PUT and PATCH alone. Passing the method costs nothing and keeps that
 * argument from having to hold.
 *
 * @param {{thresholds?: Record<string, unknown>, method?: string}} [options]
 *   `thresholds` overrides a tier's default by tier name, e.g.
 *   `{thresholds: {'jev-raise-wx': 0.9}}`. An override that is not a finite
 *   number in [0, 1] is ignored and the tier's default stands — an
 *   unreadable threshold must not silently become a permissive one.
 *   `method` is the row's HTTP method, read only to recompute `review`.
 * @returns {Verdict}
 */
export function applyJev(verdict, answer, options) {
  const tier = needsJev(verdict);
  if (!tier) return verdict;
  if (!answer) return verdict;

  const spec = TIERS[tier];

  const p = answer.p;
  if (typeof p !== 'number' || !Number.isFinite(p) || p < 0 || p > 1) return verdict;

  const model = answer.model;
  if (typeof model !== 'string' || model === '') return verdict;

  const t = thresholdFor(tier, options);
  const fires = spec.direction === 'lower' ? p <= t : p >= t;
  if (!fires) return verdict;

  assertJevMove(tier, verdict.class, spec.to);

  return {
    class: spec.to,
    step: verdict.step,
    rule: tier,
    source: 'jev',
    matched: [],
    review: reviewHint(options && options.method, spec.to, 'jev'),
    jev: { p, model },
  };
}

/**
 * This tier's threshold: the caller's override when it is a finite number
 * in [0, 1], otherwise the tier's own default.
 * @param {string} tier
 * @param {{thresholds?: Record<string, unknown>}} [options]
 * @returns {number}
 */
function thresholdFor(tier, options) {
  const override = options && options.thresholds && options.thresholds[tier];
  if (typeof override === 'number' && Number.isFinite(override) && override >= 0 && override <= 1) {
    return override;
  }
  return TIERS[tier].threshold;
}
