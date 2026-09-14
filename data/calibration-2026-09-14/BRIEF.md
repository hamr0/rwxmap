# Labelling brief — corpus standard (calibrated 2026-09-14)

This brief is calibrated to the standard that produced the labelled
corpus (the six original sets, exam 2 and exam 3; 5465 rows). It was
written by reading the 2109 rows labelled under both exam 3's lost
brief and exam 4's reconstructed brief (272 flipped w->x, 33 x->w) and
measuring the corpus truth lean of the words that decided them. It is
saved verbatim so exam 5 and every later exam label to the same
standard. Rationale and numbers: README.md in this directory.

## The brief, verbatim

You are a blind labeller for an API-safety exam. You read API
operations and label each one r, w or x. Work alone.

Blindness — strict: open ONLY your assigned blind file and write ONLY
your assigned output file. Do NOT open, list, grep or search anything
else in the repository — no code, no docs, no other data files, no
other parts, no git history. You must not see any classifier, word
list, prior label or prior result. If you need more context, label
from the row alone and lower your confidence instead.

Each row is one HTTP operation: provider, method, path, operationId,
summary, description. Decide what happens when a caller who holds a
normal API key for this provider calls it.

The classes:

- r — nothing changes. A read, echo, validate or dry-run that happens
  to use PUT/DELETE/PATCH. Rare.
- w — changes only the caller's OWN stuff: records, configuration,
  files, settings, definitions inside the caller's own account,
  tenant, workspace, server or system. Risky to the caller, not to
  anyone else. w is the DEFAULT for PUT, DELETE and PATCH.
- x — the operation REACHES BEYOND the caller, or is NOT REPEATABLE.
  Either road alone is enough.

Road 1, reaches beyond the caller. The text must say, or make plain,
that one of these happens:

  a. it sends, notifies, publishes, posts or exposes something to
     another person or to the public: a message, an email, an SMS, a
     read receipt, a public listing, a public/private visibility
     switch.
  b. it changes what another person can do: grants, revokes, invites,
     adds or removes a member, collaborator, role assignment,
     permission, login, account, session or token that another person
     holds or relies on.
  c. it moves money or commits to an outside party: charges, refunds,
     pays, bills, confirms a payment or purchase, places or cancels an
     order with a carrier, registry, bank, airline or marketplace,
     renews a paid plan.
  d. it acts on something live that someone else is on the other end
     of: a call, a session with an external system, a stream someone
     is watching, a physical device in the field, a network path the
     text says serves others.
  e. it hands work to another party: assigns, submits, dispatches,
     requests a job that another system or person picks up.

Road 2, not repeatable. Calling it twice differs from calling it once:
it triggers a run each call, appends, sends again, charges again,
advances a state machine, consumes an attempt.

The corpus standard — twelve rules that settle the disputed rows.
Apply these before your instinct:

1. A record ABOUT a person is the caller's own record. Employees,
   patients, customers, clients, drivers, payees, contacts,
   applicants, licensees, individuals, organisations held as records:
   creating, editing or deleting their record in the caller's system
   is w. "Delete employee", "Update patient", "Delete customer",
   "Update an individual" -> w. It becomes x only when road 1 applies
   from the text (the person is notified, their access changes, money
   moves to or from them, a live thing of theirs is touched).
2. A user ACCOUNT is different from a record about a person. An
   account is something another person logs in with. Deleting,
   deactivating, disabling or removing that account (from the system,
   an org, a team, a class) takes away that person's access -> x
   (road 1b). Editing the account's plain details (name, email,
   preferences, profile, avatar) -> w. Setting or resetting its
   password, credentials, secret, recovery data, roles or permissions
   -> x (road 1b). Deleting or editing YOUR OWN account -> w.
3. A path parameter is not a reach. {userId}, {customerId}, {partyId},
   {employeeId}, {organizationName}, {teamId} name a record inside the
   caller's own tenant. Never label x because the resource "might be
   someone else's" or "possibly another's". If the text does not say
   another party is reached, it is w.
4. Definitions and containers are w. Roles, groups, teams, projects,
   organizations, workspaces, channels, folders, plans, templates,
   custom fields, catalogue entries: creating, editing or deleting the
   definition or container is w, even if members exist and even if it
   cascades to its own contents. Changing WHO is in it, or WHAT its
   members may do, is x (road 1b). "Delete role" -> w; "Remove user
   from role", "Add a member", "Update collaborator" -> x.
5. Admin, instance-wide and server-wide configuration is w. The caller
   administers their own instance. "Update the configuration of this
   instance", "Bulk replace all distributions" -> w.
6. Your own network and infrastructure are w. DNS zones and records,
   certificates, servers, connectors, SIM preferences, keys and tokens
   the caller owns are w. Rotating or refreshing your own certificate
   or key is w. Revoking, compromising or overwriting a key, token or
   consent that ANOTHER party holds is x (road 1b).
7. Social relations are w. Follow, unfollow, like, unlike, repost,
   promise, react: the caller changes its own relation to an item ->
   w. x only if the text says the other party is notified or their
   item is changed.
8. Publish and visibility to the world are x. Publish, unpublish, make
   public, make private, list or delist on a marketplace -> x
   (road 1a).
9. Cancel and stop. w when the caller stops or cancels its own thing
   and the text names no outside party, no charge, no refund, no
   viewer: stop own transcoder, stop own stream, cancel own scheduled
   payout, delete own scheduled job -> w. x when the text says a
   third party is on the other end: cancels with the registry,
   carrier notified, refund triggered, the caller stays charged, live
   feed to viewers halts, session with an external broker aborted.
10. Money. Storing or editing payment details, cards, profiles, plans,
    prices, invoices, payment links or subscription settings WITHOUT
    charging is w. Charging, refunding, paying out, confirming a
    payment, renewing or switching a paid plan that bills the card ->
    x (road 1c).
11. Sessions and logins. Logging out your own session is w. Logging
    out, invalidating or ending another person's session is x
    (road 1b). Mark-as-read is w unless the text says a read receipt
    goes to the sender (then x, road 1a).
12. Trigger, refresh, run, re-run, sync, import, rebuild that starts a
    job each call is x (road 2) even when it touches only the caller's
    own data.

Rules that trip people up:

- Irreversibility is NOT the test. "Permanently delete, cannot be
  undone" of the caller's own resource is w.
- Severity, sensitivity and size are NOT the test. Deleting a whole
  company record, all attributes, or sensitive personal data in the
  caller's own system is w. Ask only: who ELSE is touched, and is it
  repeatable?
- A cascade inside the caller's own system stays w ("deletes the team
  and its groups" -> w). A cascade that removes other people's ACCESS
  is x ("deletes the account and all its users" -> x).
- When the row genuinely could be either AFTER applying rules 1-12,
  pick the TIGHTER class (x over w, w over r) and mark confidence low.
  Apply the rules first; "tighter on doubt" is for rows the rules do
  not settle, never a way around rule 1, 3 or 4.
- If the text is contradictory or absent and you truly cannot tell,
  answer ? rather than guess.

Output format: header row_id,truth_class,confidence,reason.
truth_class is r, w, x or ?. confidence is EXACTLY high or low — there
is no medium, and a file containing any other value is rejected. reason
is a short phrase under 15 words with no commas (or the whole reason
double-quoted) and names the rule or road you applied, e.g.
"rule 1 employee record in own system", "road 1b revokes another users
token". One line per input row, same order, no rows skipped, no extras.
