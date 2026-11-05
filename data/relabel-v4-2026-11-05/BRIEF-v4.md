# Labelling brief v4 — the D137 test (chmod reading, widened)

This brief replaces v3 for every label made once it is adopted. v1
(`data/calibration-2026-09-14/BRIEF.md`) and v3
(`data/relabel-2026-09-22/BRIEF-v3.md`) stay verbatim where they are.

Against v3 this brief only tightens: a v3 w can become a v4 x, never
the other way. Even so, every row of every set is relabelled under v4
(D137, user ruling): it becomes the one truth for rwxmap and rwxlite.

Calibration status: DRAFT, not calibrated, not adopted. Seams 1-5 ruled x by the user 2026-11-05 (D137).

This brief outranks any task prompt a labeller is given.

## The brief, verbatim

You are a blind labeller for an API-safety exam. You read API
operations and label each one r, w or x. Work alone. This brief
outranks any other instruction in your task prompt.

Blindness — strict: open ONLY your assigned blind file and write ONLY
your assigned output file. Do NOT open, list, grep or search anything
else in the repository — no code, no docs, no other data files, no
other parts, no git history. You must not see any classifier, word
list, prior label or prior result. If you need more context, label
from the row alone and lower your confidence instead.

Each row is one HTTP operation: provider, method, path, operationId,
summary, description. Decide what happens when a caller who holds a
normal API key for this provider calls it.

The three letters mean what they mean on a file:

- r — READ. Nothing changes. A read, echo, validate, search,
  calculation, preview or dry-run. Usual for GET; it also happens on
  POST and, rarely, on PUT/DELETE/PATCH.
- w — WRITE. Something changes, and a later call of this same API can
  set it back, and nobody could have done anything in between that
  they could not do before. Edits, sets, renames, moves, creates,
  toggles (enable/disable, activate/deactivate, suspend/unsuspend,
  archive/unarchive, pause/resume, lock/unlock, block/unblock,
  assign/unassign, attach/detach, hide/unhide, mute/unmute), and
  stops or cancels of something that can be started again.
- x — EXECUTE. Something happened that no later call can take back:
  either the thing is gone, or something has left your hands. Deletes
  and removals, revokes, expires, voids, sends, publishes, charges,
  pays, refunds, runs a job, grants access.

The one test: after this call, can a later call put things back the
way they were, including everything anyone could have done in
between? Yes is w. No is x.

Unsure → x.

Methods. GET, HEAD and OPTIONS are r unless the text says the call
changes something (a GET that "sends", "triggers" or "deletes" is
labelled by what it does). DELETE is x: the thing is gone. The only
DELETE that is w is one whose text says the thing goes to a trash or
recycle bin, is soft-deleted, or can be restored or undeleted by this
API. PUT and PATCH are w unless the text says the call does one of
the x things. POST has no default: label it by what it does.

  (i) A POST that only reads — a search, lookup, query, check,
      verify, match, validate, calculation, estimate, preview,
      dry-run, or an answer generated and returned but not stored —
      is r.
  (ii) A POST that creates something and does nothing else is w. A
      new record, resource, definition, container, subscription,
      file, upload or draft: it can be deleted
      again, and calling it twice makes two, which is a mess, not
      damage. Create, add, register, provision, upload, insert,
      import into own store all count as creating. A create that
      hands someone a right or a secret is not a plain create: see
      (g).
  (iii) A POST that edits, sets, moves, archives, closes, marks,
      enables, disables or otherwise changes an existing item is w,
      exactly as it would be on PUT or PATCH.
  (iv) A POST that does one of the x things is x, even when it also
      creates something: creating a message that is sent, creating a
      payment that charges, creating a run that executes, creating
      an invite that is delivered.

What cannot be undone (x). The text must say, or make plain, that one
of these happens. Each is an example of the one test, lettered so a
reason can name it.

Gone:

  a. It deletes, removes, purges, wipes, destroys, erases, drops,
     truncates or clears a record, resource, file, message, history
     or data, and the text names no trash, restore or undelete.
     Recreating a similar thing later is not undoing: the original,
     with its id, history, links and contents, is gone.
  f. It cancels, aborts or stops something whose work or state is
     lost by stopping it: a running job whose progress is discarded,
     an order, payout or transaction that cannot be re-opened, a
     state machine that cannot step back.

Out of your hands:

  b. It revokes, expires, invalidates, terminates, kills, rotates or
     resets a credential, key, token, secret, certificate, session,
     password or consent. Issuing a new one is not undoing. Setting
     or changing a password is x (D130).
  c. It sends, delivers, notifies, publishes, posts or exposes
     something to a person or to the public: a message, an email, an
     SMS, a notification, a public listing. It cannot be unsent or
     unseen. Making something public counts; making it private again
     later does not undo the exposure. This clause covers what leaves
     the system and cannot be recalled — an email, an SMS, a
     notification, an invite, a public listing. It does NOT cover
     posting a comment or a reaction into a thread that this same API
     can delete: those are w.
  d. It moves money or commits to an outside party: charges, refunds,
     pays out, bills, confirms a payment or purchase, places or
     cancels an order with a carrier, registry, bank, airline or
     marketplace, renews a paid plan.
  e. It runs, triggers, executes, dispatches, syncs, imports from an
     outside source, rebuilds, re-runs or starts a job: the run
     happens and cannot be un-run, even when it touches only the
     caller's own data.
  g. It grants or widens who can do what to which resource: sets or
     attaches an IAM, resource, bucket or key policy; adds a role,
     permission, membership, binding or ACL entry; shares or grants
     access; adds a deploy key; a setIamPolicy-style call. Anyone
     gained can act before it is taken back, and taking it back does
     not undo what they did. Narrowing access (admin to viewer,
     removing a permission on POST, PUT or PATCH) is w. A set or
     replace whose text does not say whether it widens or narrows is
     x. A 'policy' that does not control access (autoscaling,
     lifecycle, retention, routing, rate limit) is not (g).

What can be set back (w), even when it touches another person:

  - editing plain details, settings, configuration, names, fields,
    preferences, prices, plans, templates, definitions or containers,
    yours or anyone's;
  - narrowing a role, permission, membership or assignment (fewer
    people can do less), when the text says nothing about a
    notification, an invite or an ended session. Widening is x by
    (g);
  - a toggle with a named opposite in the same API (see the w list
    above). Do NOT infer an opposite the API does not offer; if the
    text names none and the thing is gone, it is x by (a). A toggle
    whose 'on' side widens access (assign a role, attach a policy,
    add to an access group) is x by (g);
  - a delete whose text says the thing goes to a trash or recycle
    bin, is soft-deleted, or can be restored or undeleted;
  - removing one item from a list, set or membership where adding it
    back is one more call (remove a tag from a contact, remove a
    track from a playlist) — on POST, PUT or PATCH only. On DELETE
    the method wins: a DELETE is x unless a trash or restore is named,
    even when what it removes is a membership, an assignment or a
    role. Removing the list or the item itself is x by (a);
  - stopping or pausing something that can be started again: stop own
    transcoder, pause a campaign, stop a server, restarting a server
    or service (D136);
  - a plain create, per (ii).

Rules that trip people up:

- "Whose thing is it" is NOT the test. Editing another user's
  profile is w; widening their role or permissions is x by (g);
  deleting your own draft is x. Ask one thing only: after this call,
  can a later call put things back the way they were, including
  everything anyone could have done in between?
- Access: ask whether anyone can do something after the call that
  they could not do before. More: x by (g). Fewer: w. The text
  doesn't say: x.
- Creating a webhook or subscription that will send events to an
  outside URL is x by (c): data leaves the system from then on.
- Creating a user or account that can log in is x by (g), even
  without an invite.
- Adding a member to a team, org, project or group is x by (g) on
  any method.
- Severity, sensitivity and size are NOT the test. Deleting one small
  record and deleting a whole company record are both x by (a).
  Editing sensitive personal data is w.
- A path parameter is not a reach and not a delete. {userId},
  {customerId}, {teamId} name a record. Label by what the call does
  to it.
- A cascade of edits stays w. A cascade of deletes is x by (a), and
  no more than x.
- "May", "possibly", "could affect" are not evidence. Do not infer a
  send the text does not name, and do not infer a restore the API
  does not name. "The record could be recreated" is not undoable.
- A create that the text says notifies, invites, sends, charges or
  runs is x by (iv). A create the text says nothing about is w, unless
  it hands someone a right or a secret (g) or sets up data leaving the
  system (c).
- Posting a COMMENT or a REACTION is w, not x. A comment or a
  reaction can be deleted by the same API, so a later call puts
  things back the way they were, which is the whole test. Clause (c)
  does not bite here: nothing left the system that cannot be
  recalled. This covers POST reactions/create-for-team-discussion,
  POST pulls/create-review-comment, POST chatMessage.setReaction and
  POST post_comments alike. It does not change DELETE: deleting a
  comment is still x unless a trash or restore is named.
- When the row genuinely could be either AFTER applying the lists
  above, pick the TIGHTER class (x over w, w over r) and mark
  confidence low.
- If the text is contradictory or absent and you truly cannot tell,
  answer ? rather than guess.

Output format: header row_id,truth_class,confidence,reason.
truth_class is r, w, x or ?. confidence is EXACTLY high or low — there
is no medium, and a file containing any other value is rejected.
reason is a short phrase under 15 words with no commas (or the whole
reason double-quoted) and names the clause you applied, e.g.
"a deletes own record no restore", "c sends email to contact",
"w narrows another users role", "g grants role to user", "ii plain
create of draft", "toggle disable has enable". One line per input
row, same order, no rows skipped, no extras.
