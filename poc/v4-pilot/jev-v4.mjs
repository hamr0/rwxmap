// The v4 "is this operation x" Noul question, built from BRIEF-v4.md (D137).
// Same object shape as isXQuestion() in src/jev.js. Not sent anywhere.
// Every brief-derived text field below is a verbatim substring of
// data/relabel-v4-2026-11-05/BRIEF-v4.md (whitespace-normalised); the test checks it.
import fs from 'node:fs';
import crypto from 'node:crypto';

export const LETTERS = {
  r: 'r — READ. Nothing changes. A read, echo, validate, search, calculation, preview or dry-run. Usual for GET; it also happens on POST and, rarely, on PUT/DELETE/PATCH.',
  w: 'w — WRITE. Something changes, and a later call of this same API can set it back, and nobody could have done anything in between that they could not do before. Edits, sets, renames, moves, creates, toggles (enable/disable, activate/deactivate, suspend/unsuspend, archive/unarchive, pause/resume, lock/unlock, block/unblock, assign/unassign, attach/detach, hide/unhide, mute/unmute), and stops or cancels of something that can be started again.',
  x: 'x — EXECUTE. Something happened that no later call can take back: either the thing is gone, or something has left your hands. Deletes and removals, revokes, expires, voids, sends, publishes, charges, pays, refunds, runs a job, grants access.',
  oneTest: 'The one test: after this call, can a later call put things back the way they were, including everything anyone could have done in between? Yes is w. No is x.',
  doubt: 'Unsure → x.',
};

export const METHODS = {
  what: 'GET, HEAD and OPTIONS are r unless the text says the call changes something (a GET that "sends", "triggers" or "deletes" is labelled by what it does). DELETE is x: the thing is gone. The only DELETE that is w is one whose text says the thing goes to a trash or recycle bin, is soft-deleted, or can be restored or undeleted by this API. PUT and PATCH are w unless the text says the call does one of the x things. POST has no default: label it by what it does.',
  i: 'A POST that only reads — a search, lookup, query, check, verify, match, validate, calculation, estimate, preview, dry-run, or an answer generated and returned but not stored — is r.',
  ii: 'A POST that creates something and does nothing else is w. A new record, resource, definition, container, subscription, file, upload or draft: it can be deleted again, and calling it twice makes two, which is a mess, not damage. Create, add, register, provision, upload, insert, import into own store all count as creating. A create that hands someone a right or a secret is not a plain create: see (g).',
  iii: 'A POST that edits, sets, moves, archives, closes, marks, enables, disables or otherwise changes an existing item is w, exactly as it would be on PUT or PATCH.',
  iv: 'A POST that does one of the x things is x, even when it also creates something: creating a message that is sent, creating a payment that charges, creating a run that executes, creating an invite that is delivered.',
};

export const CANT_UNDO = {
  what: 'The text must say, or make plain, that one of these happens. Each is an example of the one test, lettered so a reason can name it.',
  gone: {
    a: 'It deletes, removes, purges, wipes, destroys, erases, drops, truncates or clears a record, resource, file, message, history or data, and the text names no trash, restore or undelete. Recreating a similar thing later is not undoing: the original, with its id, history, links and contents, is gone.',
    f: 'It cancels, aborts or stops something whose work or state is lost by stopping it: a running job whose progress is discarded, an order, payout or transaction that cannot be re-opened, a state machine that cannot step back.',
  },
  out_of_your_hands: {
    b: 'It revokes, expires, invalidates, terminates, kills, rotates or resets a credential, key, token, secret, certificate, session, password or consent. Issuing a new one is not undoing. Setting or changing a password is x (D130).',
    c: 'It sends, delivers, notifies, publishes, posts or exposes something to a person or to the public: a message, an email, an SMS, a notification, a public listing. It cannot be unsent or unseen. Making something public counts; making it private again later does not undo the exposure. This clause covers what leaves the system and cannot be recalled — an email, an SMS, a notification, an invite, a public listing. It does NOT cover posting a comment or a reaction into a thread that this same API can delete: those are w.',
    d: 'It moves money or commits to an outside party: charges, refunds, pays out, bills, confirms a payment or purchase, places or cancels an order with a carrier, registry, bank, airline or marketplace, renews a paid plan.',
    e: "It runs, triggers, executes, dispatches, syncs, imports from an outside source, rebuilds, re-runs or starts a job: the run happens and cannot be un-run, even when it touches only the caller's own data.",
    g: "It grants or widens who can do what to which resource: sets or attaches an IAM, resource, bucket or key policy; adds a role, permission, membership, binding or ACL entry; shares or grants access; adds a deploy key; a setIamPolicy-style call. Anyone gained can act before it is taken back, and taking it back does not undo what they did. Narrowing access (admin to viewer, removing a permission on POST, PUT or PATCH) is w. A set or replace whose text does not say whether it widens or narrows is x. A 'policy' that does not control access (autoscaling, lifecycle, retention, routing, rate limit) is not (g).",
  },
};

export const CAN_SET_BACK = {
  what: 'What can be set back (w), even when it touches another person',
  list: [
    "editing plain details, settings, configuration, names, fields, preferences, prices, plans, templates, definitions or containers, yours or anyone's",
    'narrowing a role, permission, membership or assignment (fewer people can do less), when the text says nothing about a notification, an invite or an ended session. Widening is x by (g)',
    "a toggle with a named opposite in the same API (see the w list above). Do NOT infer an opposite the API does not offer; if the text names none and the thing is gone, it is x by (a). A toggle whose 'on' side widens access (assign a role, attach a policy, add to an access group) is x by (g)",
    'a delete whose text says the thing goes to a trash or recycle bin, is soft-deleted, or can be restored or undeleted',
    'removing one item from a list, set or membership where adding it back is one more call (remove a tag from a contact, remove a track from a playlist) — on POST, PUT or PATCH only. On DELETE the method wins: a DELETE is x unless a trash or restore is named, even when what it removes is a membership, an assignment or a role. Removing the list or the item itself is x by (a)',
    'stopping or pausing something that can be started again: stop own transcoder, pause a campaign, stop a server, restarting a server or service (D136)',
    'a plain create, per (ii)',
  ],
};

// "Rules that trip people up", minus the "?" escape hatch (no Noul equivalent;
// "Unsure → x" in LETTERS covers it). The last rule stops before the brief's
// "and mark confidence low", which has no meaning in a Noul answer.
export const TRIPWIRES = [
  '"Whose thing is it" is NOT the test. Editing another user\'s profile is w; widening their role or permissions is x by (g); deleting your own draft is x. Ask one thing only: after this call, can a later call put things back the way they were, including everything anyone could have done in between?',
  "Access: ask whether anyone can do something after the call that they could not do before. More: x by (g). Fewer: w. The text doesn't say: x.",
  'Creating a webhook or subscription that will send events to an outside URL is x by (c): data leaves the system from then on.',
  'Creating a user or account that can log in is x by (g), even without an invite.',
  'Adding a member to a team, org, project or group is x by (g) on any method.',
  'Severity, sensitivity and size are NOT the test. Deleting one small record and deleting a whole company record are both x by (a). Editing sensitive personal data is w.',
  'A path parameter is not a reach and not a delete. {userId}, {customerId}, {teamId} name a record. Label by what the call does to it.',
  'A cascade of edits stays w. A cascade of deletes is x by (a), and no more than x.',
  '"May", "possibly", "could affect" are not evidence. Do not infer a send the text does not name, and do not infer a restore the API does not name. "The record could be recreated" is not undoable.',
  'A create that the text says notifies, invites, sends, charges or runs is x by (iv). A create the text says nothing about is w, unless it hands someone a right or a secret (g) or sets up data leaving the system (c).',
  'Posting a COMMENT or a REACTION is w, not x. A comment or a reaction can be deleted by the same API, so a later call puts things back the way they were, which is the whole test. Clause (c) does not bite here: nothing left the system that cannot be recalled. This covers POST reactions/create-for-team-discussion, POST pulls/create-review-comment, POST chatMessage.setReaction and POST post_comments alike. It does not change DELETE: deleting a comment is still x unless a trash or restore is named.',
  'When the row genuinely could be either AFTER applying the lists above, pick the TIGHTER class (x over w, w over r)',
];

const FRAMING =
  'Each row is one HTTP operation. Decide what happens when a caller who holds a normal API key for this provider calls it.';

export function isXQuestionV4() {
  return {
    isX: {
      type: 'noul',
      instructions: {
        framing: FRAMING,
        question: 'Is this operation x?',
        definition: `${LETTERS.r} ${LETTERS.w} ${LETTERS.x} ${LETTERS.oneTest} ${LETTERS.doubt}`,
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
        },
        false: {
          what: 'A later call of the same API can set the change back (w), or the call only reads (r). Either way it is not x.',
          can_be_set_back: CAN_SET_BACK,
        },
      },
    },
  };
}

export const questionJson = () => JSON.stringify(isXQuestionV4());

if (process.argv[1] && fs.realpathSync(process.argv[1]) === new URL(import.meta.url).pathname) {
  const out = new URL('../../data/pilot-v4-2026-11-05/', import.meta.url).pathname;
  const s = questionJson();
  fs.writeFileSync(out + 'jev-v4-question.json', s);
  fs.writeFileSync(out + 'jev-v4-question.json.sha256', crypto.createHash('sha256').update(s).digest('hex') + '  jev-v4-question.json\n');
  console.log('chars', s.length);
}
