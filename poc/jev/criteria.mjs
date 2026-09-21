// Jev criteria for rwxmap, transcribed from data/calibration-2026-09-14/BRIEF.md
// — the SAME brief the nine human labellers used to make the truth these
// rows are scored against. Nothing here is written by reading the leak
// pile, so neither POC is fitted to the set it runs on.
//
// POC A (questionsA): one Noul, "this operation is x", asked COLD — step 2's
// verdict is deliberately NOT in the state, because naming it anchors Jev
// toward w, the fail-open direction. road1/road2 ride along as free
// diagnostics (same state, parallel evaluation) so a raise can be read.
//
// POC B (questionsB): a Choice over r/w/x with the three class definitions,
// the whole job cold, no mechanical tool involved.

// ---- the x side: the two roads, from the brief ----
const ROAD_1 = {
  what: 'REACHES BEYOND the caller. The text must say, or make plain, that one of these happens.',
  a: 'sends, notifies, publishes, posts or exposes something to another person or the public: a message, email, SMS, read receipt, public listing, a public/private visibility switch',
  b: "changes what another person can do: grants, revokes, invites, adds or removes a member, collaborator, role assignment, permission, login, account, session or token that another person holds or relies on",
  c: 'moves money or commits to an outside party: charges, refunds, pays, bills, confirms a payment or purchase, places or cancels an order with a carrier, registry, bank, airline or marketplace, renews a paid plan',
  d: 'acts on something live that someone else is on the other end of: a call, a session with an external system, a stream someone is watching, a physical device in the field, a network path the text says serves others',
  e: 'hands work to another party: assigns, submits, dispatches, requests a job that another system or person picks up',
};

const ROAD_2 = {
  what: 'NOT REPEATABLE. Calling it twice differs from calling it once.',
  detail: 'it triggers a run each call, appends, sends again, charges again, advances a state machine, consumes an attempt',
};

// ---- the w side: the twelve rules that settle the disputed rows ----
const TWELVE_RULES = {
  '1_record_about_a_person_is_w': "A record ABOUT a person is the caller's own record. Employees, patients, customers, clients, drivers, payees, contacts, applicants, licensees, individuals, organisations held as records: creating, editing or deleting their record in the caller's system is w. It becomes x only when road 1 applies FROM THE TEXT.",
  '2_user_account_differs_from_record': "A user ACCOUNT is something another person logs in with. Deleting, deactivating, disabling or removing that account takes away that person's access -> x (road 1b). Editing the account's plain details (name, email, preferences, profile, avatar) -> w. Setting or resetting its password, credentials, secret, recovery data, roles or permissions -> x (road 1b). Deleting or editing YOUR OWN account -> w.",
  '3_path_parameter_is_not_a_reach': "A path parameter is not a reach. {userId}, {customerId}, {partyId}, {employeeId}, {organizationName}, {teamId} name a record inside the caller's own tenant. NEVER label x because the resource might be someone else's. If the text does not say another party is reached, it is w.",
  '4_definitions_and_containers_are_w': "Roles, groups, teams, projects, organizations, workspaces, channels, folders, plans, templates, custom fields, catalogue entries: creating, editing or deleting the DEFINITION or CONTAINER is w, even if members exist and even if it cascades to its own contents. Changing WHO is in it, or WHAT its members may do, is x (road 1b). A bundle of access — a permission scheme, permission set, access policy, ACL, or a role or group whose text says it grants or controls what members may do — IS that access: deleting, replacing or reassigning it is x.",
  '5_admin_and_instance_config_is_w': "Admin, instance-wide and server-wide configuration is w. The caller administers their own instance.",
  '6_own_network_and_infrastructure_is_w': "DNS zones and records, certificates, servers, connectors, SIM preferences, keys and tokens the caller owns are w. Rotating or refreshing your own certificate or key is w. Revoking, compromising or overwriting a key or token that ANOTHER party holds is x (road 1b). A consent, agreement, authorisation or grant that the CALLER gave or holds is the caller's own: deleting or withdrawing it is w.",
  '7_social_relations_are_w': "Follow, unfollow, like, unlike, repost, promise, react: the caller changes its own relation to an item -> w. x only if the text says the other party is notified or their item is changed.",
  '8_publish_and_public_visibility_is_x': 'Publish, unpublish, make public, make private, list or delist on a marketplace -> x (road 1a).',
  '9_cancel_and_stop': "w when the caller stops or cancels its OWN thing and the text names no outside party, no charge, no refund, no viewer. x when the text says a third party is on the other end: cancels with the registry, carrier notified, refund triggered, the caller stays charged, live feed to viewers halts, session with an external broker aborted.",
  '10_money': 'Storing or editing payment details, cards, profiles, plans, prices, invoices, payment links or subscription settings WITHOUT charging is w. Charging, refunding, paying out, confirming a payment, renewing or switching a paid plan that bills the card -> x (road 1c).',
  '11_sessions_and_logins': "Logging out, ending or invalidating a session or ticket that the CALLER itself opened is w, even when the path or text calls it a customer session. Logging out, invalidating or ending a session that ANOTHER person opened, or deleting another person's active login, is x (road 1b). Mark-as-read, mark-as-seen, acknowledge: w. Do NOT infer a read receipt.",
  '12_trigger_run_sync_is_x': "Trigger, refresh, run, re-run, sync, import, rebuild that starts a job each call is x (road 2) even when it touches only the caller's own data.",
};

// ---- the not_for side: the brief's "rules that trip people up" ----
const TRIPWIRES = [
  'Irreversibility is NOT the test. "Permanently delete, cannot be undone" of the caller\'s own resource is w.',
  "Severity, sensitivity and size are NOT the test. Deleting a whole company record, all attributes, or sensitive personal data in the caller's own system is w. Ask only: who ELSE is touched, and is it repeatable?",
  'A cascade inside the caller\'s own system stays w ("deletes the team and its groups" -> w). A cascade that removes other people\'s ACCESS is x ("deletes the account and all its users" -> x).',
  'Do NOT infer. "May", "possibly", "could affect", "others may rely on" are not evidence. The text must STATE the reach. If it does not, the row is w.',
  'Do not label x because the operationId or path merely CONTAINS a word like user, permission, role, token or account. The word alone is not the reach; the text must state it.',
];

const FRAMING =
  'Each row is one HTTP operation. Decide what happens when a caller who holds a normal API key for this provider calls it.';

/** POC A — the raise-only tier. One Noul decides; two ride along as diagnostics. */
export function questionsA() {
  return {
    isX: {
      type: 'noul',
      instructions: {
        framing: FRAMING,
        question: 'Is this operation x?',
        definition:
          'x means the operation REACHES BEYOND the caller (road 1) OR is NOT REPEATABLE (road 2). Either road alone is enough. Otherwise it is w: it changes only the caller\'s OWN stuff — records, configuration, files, settings, definitions inside the caller\'s own account, tenant, workspace, server or system. Risky to the caller, not to anyone else.',
        inspect: ['description', 'summary', 'operationId', 'path', 'method'],
        focus:
          'Apply the twelve rules in criteria.false BEFORE instinct. They settle the disputed rows and override a first impression.',
        ignore: TRIPWIRES,
      },
      criteria: {
        true: {
          what: 'The operation takes road 1 or road 2.',
          road_1_reaches_beyond: ROAD_1,
          road_2_not_repeatable: ROAD_2,
          examples: [
            'Remove a user from a role (road 1b: changes what another person can do)',
            'Send a message to a channel (road 1a)',
            'Trigger a pipeline run (road 2)',
            'Refund a charge (road 1c)',
          ],
        },
        false: {
          what: "The operation changes only the caller's own stuff, and neither road is stated in the text.",
          the_twelve_rules: TWELVE_RULES,
          examples: [
            'Delete an employee record in the caller\'s own HR system (rule 1)',
            'Update a team definition (rule 4)',
            'Delete a DNS record the caller owns (rule 6)',
            'Permanently delete the caller\'s own bucket, cannot be undone (irreversibility is not the test)',
          ],
        },
      },
    },
    road1: {
      type: 'noul',
      instructions: {
        framing: FRAMING,
        question: 'Does this operation REACH BEYOND the caller?',
        inspect: ['description', 'summary', 'operationId', 'path', 'method'],
        focus: 'Road 1 only. Ignore repeatability entirely for this question.',
        ignore: TRIPWIRES,
      },
      criteria: {
        true: ROAD_1,
        false: { what: "Only the caller's own stuff is touched; no other party is reached by the text." },
      },
    },
    road2: {
      type: 'noul',
      instructions: {
        framing: FRAMING,
        question: 'Is this operation NOT REPEATABLE — does calling it twice differ from calling it once?',
        inspect: ['description', 'summary', 'operationId', 'path', 'method'],
        focus: 'Road 2 only. Ignore who is reached entirely for this question.',
        ignore: TRIPWIRES,
      },
      criteria: {
        true: ROAD_2,
        false: {
          what: 'Calling it twice lands in the same place as calling it once: it sets, replaces, edits or deletes a named thing.',
        },
      },
    },
  };
}

/** POC B — the whole job cold. One Choice over the three classes. */
export function questionsB() {
  return {
    rwx: {
      type: 'choice',
      instructions: {
        framing: FRAMING,
        question: 'Which class is this operation: r, w or x?',
        inspect: ['description', 'summary', 'operationId', 'path', 'method'],
        method_guidance: {
          GET_HEAD_OPTIONS:
            'r unless the text says the call changes something. A GET that "sends", "triggers" or "deletes" is labelled by what it does, not by its method.',
          PUT_DELETE_PATCH: 'start at w and rise to x only on evidence.',
          POST: {
            note: 'POST has no default. Label it by what it does, in this order.',
            i: 'A POST that only READS — a search, lookup, query, check, verify, match, validate, calculation, estimate, preview, dry-run, or an answer or text generated and returned but not stored — is r.',
            ii: 'A POST that CREATES something new is x by road 2: calling it twice makes two. This holds even when the new thing is the caller\'s own record, resource, definition, container, subscription, webhook, key, token, session, upload or file. Create, add a new item, register, provision, upload, submit, request, deploy and instantiate all count as creating. For a POST create this OVERRIDES rules 1, 4, 6 and 11.',
            iii: 'A POST that edits, renames, sets, moves, archives, closes, marks, pins, stars, labels, enables, disables or deletes an EXISTING item of the caller\'s own is w, exactly as the same change would be on PUT/DELETE/PATCH, and the twelve rules apply.',
            iv: 'A POST that sends, notifies, publishes, pays, charges, invites, grants, assigns, dispatches, triggers a run, or otherwise takes road 1 or road 2, is x.',
          },
        },
        the_twelve_rules: TWELVE_RULES,
        tie_break:
          'When the row genuinely could be either AFTER applying the twelve rules, pick the TIGHTER class (x over w, w over r). Apply the rules FIRST; "tighter on doubt" is never a way around rule 1, 3 or 4.',
        ignore: TRIPWIRES,
      },
      criteria: {
        r: 'Nothing changes. A read, echo, validate, search or dry-run.',
        w: "Changes only the caller's OWN stuff: records, configuration, files, settings, definitions inside the caller's own account, tenant, workspace, server or system. Risky to the caller, not to anyone else.",
        x: {
          what: 'The operation REACHES BEYOND the caller, or is NOT REPEATABLE. Either road alone is enough.',
          road_1_reaches_beyond: ROAD_1,
          road_2_not_repeatable: ROAD_2,
        },
      },
    },
  };
}

/** The state sent for a row. Deliberately no step-2 verdict, no tool output. */
export function stateFor(row) {
  return {
    method: row.method,
    path: row.path,
    operationId: row.operationId,
    summary: row.summary || null,
    description: row.description || null,
  };
}
