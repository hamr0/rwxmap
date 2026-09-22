// The optional D88 Jev tier (D82/D88, docs/wiki/decisions-log.md). The
// core (flow.js's classifyRow) works fully without this file — it is
// pending against the adoption bar, not required, and it is opt-in for
// two independent reasons: an adopter must choose to make the call at
// all, and must disclose that spec text (operation method/path/
// operationId/summary/description) leaves the process to an outside
// service when they do.
//
// Pure functions only. NO network code, NO key handling, NO fetch lives
// here — that plumbing (reading a key from `pass`, retries, batching) is
// the adopter's or the POC runner's job (see poc/jev-d87/run.mjs for the
// reference shape), never this library's.
//
// D88 (2026-09-22) widened D82/D83's raise-only rule: Jev may also LOWER
// x to w, but only on rows the mechanical flow could not place any word
// or method evidence for — flow.js's 'floor-post' rows, D87's tightest
// default. It still never raises (that is the separate, still-pending
// D82/D83 tier, not built here) and never touches a row any other rule
// already decided. Every lowered verdict records the model's own p and
// version (`jev: {p, model}`), because a signed map must not change
// silently as the model behind it changes (D88).

/** @typedef {import('./types.js').Operation} Operation */
/** @typedef {import('./types.js').Verdict} Verdict */

// Lower to w only when Jev is at least 90% sure the row is w — i.e. its
// own p(x) is at or under this threshold. User ruling, 2026-09-22 (D88).
// Chosen by leave-one-vendor-out against a fixed/leak ratio bar of 10 on
// the tuning set (all 23 provider folds picked it); measured there as 804
// rows lowered, 8 of them wrongly (new leaks). Tuning data — the fresh
// exam decides adoption, this file only encodes the ruling.
export const JEV_THRESHOLD = 0.10;

/**
 * The state sent to Jev for one row: deliberately no step verdict, no tool
 * class, no truth — a lower must never be anchored toward the mechanical
 * flow's own guess. `description` may be absent on a real Operation; it
 * comes back null rather than undefined, matching poc/jev-d87/criteria.mjs.
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

// ---- the x side: "What cannot be undone (x)" from BRIEF-v3.md ----
const CANT_UNDO = {
  what: 'The text must say, or make plain, that one of these happens.',
  a: 'It deletes, removes, purges, wipes, destroys, erases, drops, truncates or clears a record, resource, file, message, history or data, and the text names no trash, restore or undelete. Recreating a similar thing later is not undoing: the original, with its id, history, links and contents, is gone.',
  b: 'It revokes, expires, invalidates, terminates, kills, rotates or resets a credential, key, token, secret, certificate, session, password or consent. Issuing a new one is not undoing.',
  c: 'It sends, delivers, notifies, publishes, posts or exposes something to a person or to the public: a message, an email, an SMS, a notification, a public listing. It cannot be unsent or unseen. Making something public counts; making it private again later does not undo the exposure.',
  d: 'It moves money or commits to an outside party: charges, refunds, pays out, bills, confirms a payment or purchase, places or cancels an order with a carrier, registry, bank, airline or marketplace, renews a paid plan.',
  e: 'It runs, triggers, executes, dispatches, syncs, imports from an outside source, rebuilds, re-runs or starts a job: the run happens and cannot be un-run, even when it touches only the caller\'s own data.',
  f: 'It cancels, aborts or stops something whose work or state is lost by stopping it: a running job whose progress is discarded, an order, payout or transaction that cannot be re-opened, a state machine that cannot step back.',
};

// ---- the w side: "What can be set back (w)" from BRIEF-v3.md ----
const CAN_SET_BACK = {
  what: 'Even when it touches another person, the previous state can be reached again by a later call of the same API.',
  list: [
    "editing plain details, settings, configuration, names, fields, preferences, prices, plans, templates, definitions or containers, yours or anyone's",
    'changing a role, permission, membership, assignment, owner or collaborator, when the text says nothing about a notification, an invite being sent, or a session being ended: the previous value can be set again',
    'a toggle with a named opposite in the same API (enable/disable, activate/deactivate, suspend/unsuspend, archive/unarchive, pause/resume, lock/unlock, block/unblock, assign/unassign, attach/detach, hide/unhide, mute/unmute). Do NOT infer an opposite the API does not offer; if the text names none and the thing is gone, it is x',
    'a delete whose text says the thing goes to a trash or recycle bin, is soft-deleted, or can be restored or undeleted',
    'removing one item from a list, set or membership where adding it back is one more call (remove a tag from a contact, remove a track from a playlist) — on POST only here (these are all POST rows). Removing the list or the item itself is x',
    'stopping or pausing something that can be started again: stop own transcoder, pause a campaign, stop a server',
    'a plain create that the text says nothing else about: a new record, resource, definition, container, subscription, webhook, key, token, file, upload or draft. It can be deleted again, and calling it twice makes two, which is a mess, not damage. Create, add, register, provision, upload, insert, import into own store all count as creating',
  ],
};

// ---- "Rules that trip people up" from BRIEF-v3.md (the ones a cold
// binary question can use; the ? escape hatch is dropped, it has no Noul
// equivalent — see "Unsure -> x" in the definition instead) ----
const TRIPWIRES = [
  '"Whose thing it is" is NOT the test. Editing another user\'s profile, role or permissions is w; deleting your own draft is x. Ask one thing only: after this call, can a later call put things back the way they were?',
  'Severity, sensitivity and size are NOT the test. Deleting one small record and deleting a whole company record are both x. Editing sensitive personal data is w.',
  'A path parameter is not a reach and not a delete. {userId}, {customerId}, {teamId} name a record. Label by what the call does to it.',
  'A cascade of edits stays w. A cascade of deletes is x, and no more than x.',
  '"May", "possibly", "could affect" are not evidence. Do not infer a send the text does not name, and do not infer a restore the API does not name. "The record could be recreated" is not undoable.',
  'A create that the text says notifies, invites, sends, charges or runs is x. A create the text says nothing about is w.',
];

const FRAMING =
  'Each row is one HTTP operation. Decide what happens when a caller who holds a normal API key for this provider calls it.';

/**
 * The isX Noul question object, exactly as poc/jev-d87/criteria.mjs's
 * questions() — checked against BRIEF-v3 there; not reworded here.
 * SOLE SOURCE: data/relabel-2026-09-22/BRIEF-v3.md (the D87 "chmod"
 * definition).
 * @returns {object}
 */
export function jevQuestions() {
  return {
    isX: {
      type: 'noul',
      instructions: {
        framing: FRAMING,
        question: 'Is this operation x?',
        definition:
          "w means WRITE: something changes, and a later call of this same API can set it back. It does not matter whose thing it is. x means EXECUTE: something happened that no later write can take back — deletes and removals, revokes, expires, voids, sends, publishes, charges, pays, refunds, runs a job. Once done, it is done. A plain create is w; a create that also sends, charges or runs is x. \"Whose thing it is\" is NOT a test. A pure read is not x. Unsure -> x.",
        inspect: ['description', 'summary', 'operationId', 'path', 'method'],
        focus:
          'Apply the cannot-be-undone list in criteria.true and the can-set-back list in criteria.false BEFORE instinct. They settle the disputed rows and override a first impression.',
        ignore: TRIPWIRES,
      },
      criteria: {
        true: {
          what: 'The operation cannot be undone (x).',
          cannot_be_undone: CANT_UNDO,
          examples: [
            'Delete a record, the text names no trash or restore (a)',
            'Revoke a credential, key, token or consent (b)',
            'Send a message, email or notification to a person (c)',
            'Charge a payment or refund one (d)',
            'Trigger a pipeline run or sync (e)',
            'Cancel a running job whose progress is lost by stopping it (f)',
            'A create that also sends an invite, charges a card, or runs a job',
          ],
        },
        false: {
          what: 'A later call of the same API can set the change back (w).',
          can_be_set_back: CAN_SET_BACK,
          examples: [
            "Edit another user's role, no notification or session-end named",
            'Toggle disable, the same API also offers an enable',
            'A plain create of a webhook, the text says nothing else',
            'Remove one tag from a contact, not the whole list, on POST',
            'Pause a campaign or stop a transcoder, either can be started again',
          ],
        },
      },
    },
  };
}

/**
 * Whether Jev may be asked about a verdict at all: only the D87 flow's
 * named leftover pile (step2.js's floorPost, rule 'floor-post') — the one
 * place the mechanical ladder has no word or method evidence at all. Jev
 * never touches anything else, and never raises (see file header).
 * @param {Verdict} verdict
 * @returns {boolean}
 */
export function needsJev(verdict) {
  return verdict.rule === 'floor-post';
}

/**
 * Apply a Jev answer to a verdict. Lowers 'floor-post' x to w only when
 * `answer.p` is a finite number in [0, JEV_THRESHOLD] (i.e. at least 90%
 * sure the row is w) AND `answer.model` is a non-empty string; otherwise
 * returns the verdict UNCHANGED. This must be fail-CLOSED, not merely
 * "not fail-open on the common case": `Number.isFinite` rejects NaN and
 * ±Infinity (a bare `p > JEV_THRESHOLD` check lets NaN through silently,
 * since every comparison against NaN is false), the `p >= 0` bound rejects
 * a negative p a malformed caller could send, `typeof p === 'number'` is
 * implied by `Number.isFinite` so a string like '0.05' is rejected without
 * a separate check, and the model check means an answer that lowers the
 * class but carries no model string is rejected outright — the whole point
 * of recording `jev.model` (D88) is that a signed map must not change
 * silently as the model behind it changes, so a lowered verdict with an
 * unrecorded model is worse than not lowering at all. Any row this
 * function declines to touch stays exactly as it was, at the tighter
 * class (x), same as any other row this tier declines to touch.
 * @param {Verdict} verdict
 * @param {{p?: unknown, model?: unknown}} [answer] Both fields are typed
 *   loosely (unknown, not number/string) because a malformed answer —
 *   missing, wrong type — is exactly the input the fail-closed checks
 *   below must handle, not a case the type system should rule out before
 *   the checks run.
 * @returns {Verdict}
 */
export function applyJev(verdict, answer) {
  if (!needsJev(verdict)) return verdict;
  if (!answer) return verdict;

  const p = answer.p;
  if (typeof p !== 'number' || !Number.isFinite(p) || p < 0 || p > JEV_THRESHOLD) return verdict;

  const model = answer.model;
  if (typeof model !== 'string' || model === '') return verdict;

  return {
    class: 'w',
    step: 2,
    rule: 'jev-lower',
    source: 'jev',
    matched: [],
    jev: { p, model },
  };
}
