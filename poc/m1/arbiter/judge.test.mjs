import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  LIVE_VERBS,
  OWN_VERBS,
  PARTY_NOUNS,
  fallbackVerbFromSummary,
  leadVerbForJudge,
  summaryLeadVerb,
  naiveSingular,
  headNounForRow,
  isCallerShapedPath,
  pathPartyIdForRow,
  operationIdHeadNoun,
  operationIdAnyLiveToken,
  judgeRow,
} from './judge.mjs';

function row(overrides) {
  return {
    method: 'DELETE',
    operationId: 'doThing',
    path: '/x/{id}',
    summary: '',
    gt_class: 'x',
    ...overrides,
  };
}

// --- head noun: the four worked examples, verbatim -------------------------

test('headNounForRow: "Delete a repository secret" -> secret', () => {
  assert.equal(headNounForRow(row({ summary: 'Delete a repository secret' })), 'secret');
});

test('headNounForRow: "Delete a repository" -> repository', () => {
  assert.equal(headNounForRow(row({ summary: 'Delete a repository' })), 'repository');
});

test('headNounForRow: "Remove team membership for a user" -> membership (stops at "for")', () => {
  assert.equal(headNounForRow(row({ summary: 'Remove team membership for a user' })), 'membership');
});

test('headNounForRow: "Kick a participant from a given conference" -> participant (stops at "from")', () => {
  assert.equal(headNounForRow(row({ summary: 'Kick a participant from a given conference' })), 'participant');
});

test('headNounForRow: empty/missing summary -> "" (and "" is not in PARTY_NOUNS)', () => {
  assert.equal(headNounForRow(row({ summary: '' })), '');
  assert.equal(headNounForRow(row({ summary: undefined })), '');
  assert.ok(!PARTY_NOUNS.has(''));
});

test('headNounForRow: naive singularization never mangles a doubled-s word', () => {
  assert.equal(headNounForRow(row({ summary: 'Remove repository access' })), 'access');
  assert.equal(naiveSingular('access'), 'access');
  assert.equal(naiveSingular('class'), 'class');
});

test('headNounForRow: strips a plain trailing "s" or "es"', () => {
  assert.equal(headNounForRow(row({ summary: 'Delete repository secrets' })), 'secret');
  assert.equal(headNounForRow(row({ summary: 'Remove team addresses' })), 'address');
});

test('headNounForRow: stops at a literal "(" or ","', () => {
  assert.equal(headNounForRow(row({ summary: 'Update a widget (legacy)' })), 'widget');
  assert.equal(headNounForRow(row({ summary: 'Update a widget, permanently' })), 'widget');
});

// --- head noun: GENERIC_TAILS steps back one word (coordinator correction 3) -

test('headNounForRow: "Update device information" steps back past the generic tail -> device', () => {
  assert.equal(headNounForRow(row({ summary: 'Update device information' })), 'device');
});

test('headNounForRow: "Delete device record" steps back past the generic tail -> device', () => {
  assert.equal(headNounForRow(row({ summary: 'Delete device record' })), 'device');
});

// --- lead verb: operationId path vs. the new empty-operationId fallback ----

test('leadVerbForJudge: non-empty operationId reuses arbiter.mjs leadVerbForRow (C5 method-word stripping applies)', () => {
  assert.equal(leadVerbForJudge(row({ operationId: 'deleteRepositorySecret', method: 'DELETE' })), 'delete');
  // method-word prefix with separator gets stripped (arbiter.mjs behavior)
  assert.equal(leadVerbForJudge(row({ operationId: 'delete_files_id', method: 'DELETE' })), 'files');
});

test('fallbackVerbFromSummary: first word of the summary, lowercased, letters-only, trailing punctuation stripped', () => {
  assert.equal(fallbackVerbFromSummary('Delete a repository secret'), 'delete');
  assert.equal(fallbackVerbFromSummary('Update: the widget'), 'update');
  assert.equal(fallbackVerbFromSummary(''), '');
  assert.equal(fallbackVerbFromSummary(undefined), '');
});

test('leadVerbForJudge: empty operationId falls back to the summary\'s first word, NOT arbiter.mjs\'s path-segment fallback', () => {
  const r = row({ operationId: '', method: 'DELETE', path: '/2010-04-01/Accounts/{AccountSid}/Calls/{CallSid}.json', summary: 'Terminate a live call' });
  assert.equal(leadVerbForJudge(r), 'terminate');
});

test('leadVerbForJudge: operationId of only whitespace counts as empty', () => {
  const r = row({ operationId: '   ', summary: 'Kick a participant' });
  assert.equal(leadVerbForJudge(r), 'kick');
});

// --- path party id: caller-shaped paths never count -------------------------

test('pathPartyIdForRow: a /user/... (singular) path never counts as party even with a listed param name elsewhere', () => {
  const r = row({ path: '/user/repos/{username}' });
  assert.deepEqual(pathPartyIdForRow(r), { present: false, param: null });
  assert.equal(isCallerShapedPath('/user/repos/{username}'), true);
});

test('pathPartyIdForRow: a /users/me/... path never counts as party', () => {
  const r = row({ path: '/users/me/starred/{owner}/{repo}' });
  // no listed param here anyway, but the caller-shape check must still hold
  assert.equal(isCallerShapedPath('/users/me/starred/{owner}/{repo}'), true);
  const r2 = row({ path: '/users/me/customer/{customer}' });
  assert.deepEqual(pathPartyIdForRow(r2), { present: false, param: null });
});

test('pathPartyIdForRow: a /users/{username}/... path DOES count as party', () => {
  const r = row({ path: '/users/{username}/starred/{owner}/{repo}' });
  assert.equal(isCallerShapedPath('/users/{username}/starred/{owner}/{repo}'), false);
  assert.deepEqual(pathPartyIdForRow(r), { present: true, param: 'username' });
});

test('pathPartyIdForRow: "for the authenticated user" in the summary forces caller regardless of the path', () => {
  const r = row({ path: '/users/{username}/starred/{owner}/{repo}', summary: 'Star a repository for the authenticated user' });
  assert.deepEqual(pathPartyIdForRow(r), { present: false, param: null });
});

test('pathPartyIdForRow: AccountSid is never treated as a party id (Twilio own-account id, not in PARTY_PATH_PARAMS)', () => {
  const r = row({ path: '/2010-04-01/Accounts/{AccountSid}/Calls/{CallSid}.json' });
  // CallSid IS listed, so this should still fire on CallSid, not AccountSid.
  assert.deepEqual(pathPartyIdForRow(r), { present: true, param: 'CallSid' });
  const r2 = row({ path: '/2010-04-01/Accounts/{AccountSid}.json' });
  assert.deepEqual(pathPartyIdForRow(r2), { present: false, param: null });
});

// --- R1-R5 cascade -----------------------------------------------------------

test('R1: a live verb assigns x regardless of noun/party/method (operationId source)', () => {
  const r = row({ method: 'DELETE', operationId: 'terminateCall', summary: 'Terminate a call', path: '/x/{callId}' });
  const result = judgeRow(r);
  assert.equal(result.class, 'x');
  assert.equal(result.status, 'assigned');
  assert.equal(result.rule, 'R1');
  assert.equal(result.evidence[0], 'judge:live-verb:opid:terminate');
});

// --- R1 second verb source: the summary's own first word (coordinator
// correction 2) — fires even when the operationId lead verb is an OWN_VERB,
// not a LIVE_VERB, since the two sources are allowed to disagree ------------

test('summaryLeadVerb: singularised first word of the summary', () => {
  assert.equal(summaryLeadVerb(row({ summary: 'Cancel a subscription' })), 'cancel');
  assert.equal(summaryLeadVerb(row({ summary: '' })), '');
});

test('R1: "Cancel a subscription" with operationId DeleteX fires via the summary source, evidence names it', () => {
  const r = row({ method: 'DELETE', operationId: 'DeleteSubscription', summary: 'Cancel a subscription', path: '/subscriptions/{id}' });
  const result = judgeRow(r);
  assert.equal(result.class, 'x');
  assert.equal(result.status, 'assigned');
  assert.equal(result.rule, 'R1');
  assert.equal(result.evidence[0], 'judge:live-verb:summary:cancel');
});

// --- PARTY_NOUNS additions (coordinator correction 4) -----------------------

test('PARTY_NOUNS now includes device, session, network', () => {
  assert.ok(PARTY_NOUNS.has('device'));
  assert.ok(PARTY_NOUNS.has('session'));
  assert.ok(PARTY_NOUNS.has('network'));
});

// --- LIVE_VERBS: "reboot" added (coordinator correction 2) ------------------

test('LIVE_VERBS includes "reboot"; R1 fires on it via the operationId source', () => {
  assert.ok(LIVE_VERBS.has('reboot'));
  const r = row({ method: 'POST', operationId: 'rebootDevice', summary: 'Reboot a device', path: '/devices/{deviceId}/reboot' });
  const result = judgeRow(r);
  assert.equal(result.class, 'x');
  assert.equal(result.rule, 'R1');
  assert.equal(result.evidence[0], 'judge:live-verb:opid:reboot');
});

// --- R1's third verb source: liveTokenOn, ANY operationId token, not just
// the lead (coordinator correction 3, round 3) -------------------------------

test('operationIdAnyLiveToken: updateRebootRequest -> "reboot" (a non-lead token)', () => {
  assert.equal(operationIdAnyLiveToken(row({ method: 'PATCH', operationId: 'updateRebootRequest' })), 'reboot');
});

test('operationIdAnyLiveToken: no live token anywhere -> null', () => {
  assert.equal(operationIdAnyLiveToken(row({ method: 'DELETE', operationId: 'deleteWidget' })), null);
});

test('liveTokenOn defaults OFF: updateRebootRequest does not fire R1 on the non-lead token alone', () => {
  const r = row({ method: 'PATCH', operationId: 'updateRebootRequest', summary: 'Update a reboot request', path: '/requests/{id}' });
  const result = judgeRow(r, { floorOn: false });
  assert.notEqual(result.rule, 'R1');
});

test('liveTokenOn: true fires R1 on updateRebootRequest via the non-lead operationId token', () => {
  const r = row({ method: 'PATCH', operationId: 'updateRebootRequest', summary: 'Update a reboot request', path: '/requests/{id}' });
  const result = judgeRow(r, { liveTokenOn: true });
  assert.equal(result.class, 'x');
  assert.equal(result.rule, 'R1');
  assert.equal(result.evidence[0], 'judge:live-verb:opidtoken:reboot');
});

// --- R2's operationId party-hit source: the operationId HEAD NOUN, not
// "any token in PARTY_NOUNS" (coordinator correction 1, round 3) -----------

test('operationIdHeadNoun: updateSessionStatus -> session (generic-tail "status" steps back)', () => {
  assert.equal(operationIdHeadNoun(row({ method: 'PUT', operationId: 'updateSessionStatus' })), 'session');
});

test('operationIdHeadNoun: deleteDeviceRoamingStatusSubscription -> subscription (no step back needed)', () => {
  assert.equal(operationIdHeadNoun(row({ method: 'DELETE', operationId: 'deleteDeviceRoamingStatusSubscription' })), 'subscription');
});

test('operationIdHeadNoun: DeleteSipAuthCallsCredentialListMapping -> mapping', () => {
  assert.equal(operationIdHeadNoun(row({ method: 'DELETE', operationId: 'DeleteSipAuthCallsCredentialListMapping' })), 'mapping');
});

test('operationIdHeadNoun: UpdateAccount -> account (single token after the lead verb)', () => {
  assert.equal(operationIdHeadNoun(row({ method: 'PUT', operationId: 'UpdateAccount' })), 'account');
});

test('R2: an updateSessionStatus-shaped row fires via the opid-head-noun party check even though its head noun and path carry no party signal', () => {
  const r = row({
    method: 'PUT',
    operationId: 'updateSessionStatus',
    summary: 'Update the status of a session',
    path: '/sessions/{mediaSessionId}/status',
  });
  const result = judgeRow(r);
  assert.equal(result.class, 'x');
  assert.equal(result.rule, 'R2');
  assert.equal(result.evidence[0], 'judge:party:opidhead:session');
});

test('R2: an own verb with a party-noun head assigns x, evidence names the noun', () => {
  const r = row({ method: 'DELETE', operationId: 'removeTeamMember', summary: 'Remove team membership for a user', path: '/teams/{team_id}/memberships/{username}' });
  const result = judgeRow(r);
  assert.equal(result.class, 'x');
  assert.equal(result.rule, 'R2');
  assert.equal(result.evidence[0], 'judge:party:membership');
});

// --- path party id: a switch, default OFF (coordinator correction 2, round 3) -

test('pathPartyOn defaults OFF: a party-id path param does NOT fire R2 on its own', () => {
  const r = row({ method: 'DELETE', operationId: 'removeStarredRepo', summary: 'Delete a widget', path: '/users/{username}/widgets/{widgetId}' });
  const result = judgeRow(r, { floorOn: false });
  assert.notEqual(result.rule, 'R2');
});

test('pathPartyOn: true restores the party-id path param source, evidence names the param', () => {
  const r = row({ method: 'DELETE', operationId: 'removeStarredRepo', summary: 'Delete a widget', path: '/users/{username}/widgets/{widgetId}' });
  const result = judgeRow(r, { pathPartyOn: true });
  assert.equal(result.class, 'x');
  assert.equal(result.rule, 'R2');
  assert.equal(result.evidence[0], 'judge:party:username');
});

test('R3: an own verb, non-party noun, no path party id, on PUT/PATCH/DELETE assigns w', () => {
  const r = row({ method: 'DELETE', operationId: 'deleteWidget', summary: 'Delete a widget', path: '/widgets/{widgetId}' });
  const result = judgeRow(r);
  assert.equal(result.class, 'w');
  assert.equal(result.rule, 'R3');
  assert.equal(result.evidence[0], 'judge:own:widget');
});

test('R4: same shape as R3 but on POST assigns w ONLY when judgePostOwn is on; otherwise falls through to R5/floor', () => {
  const r = row({ method: 'POST', operationId: 'createWidget', summary: 'Create a widget', path: '/widgets' });
  const on = judgeRow(r, { judgePostOwn: true, floorOn: false });
  assert.equal(on.class, 'w');
  assert.equal(on.rule, 'R4');
  const off = judgeRow(r, { judgePostOwn: false, floorOn: false });
  assert.equal(off.status, 'review');
  assert.equal(off.rule, 'R5');
});

test('R5: a verb in neither list falls to review at the prior class when floorOn is off', () => {
  const r = row({ method: 'DELETE', operationId: 'purgeWidget', summary: 'Purge a widget', path: '/widgets/{widgetId}' });
  const result = judgeRow(r, { floorOn: false });
  assert.equal(result.status, 'review');
  assert.equal(result.rule, 'R5');
  assert.equal(result.class, 'w'); // DELETE's prior
  assert.equal(result.confidence, 0);
});

test('floor: an R5 POST/PATCH row is tightened to x, confidence 0, evidence floor', () => {
  const r = row({ method: 'POST', operationId: 'purgeWidget', summary: 'Purge a widget', path: '/widgets' });
  const result = judgeRow(r, { floorOn: true });
  assert.equal(result.class, 'x');
  assert.equal(result.status, 'assigned');
  assert.equal(result.rule, 'floor');
  assert.deepEqual(result.evidence, ['floor']);
});

test('floor: never applies to PUT/DELETE — an R5 DELETE row stays in review even with floorOn true', () => {
  const r = row({ method: 'DELETE', operationId: 'purgeWidget', summary: 'Purge a widget', path: '/widgets/{widgetId}' });
  const result = judgeRow(r, { floorOn: true });
  assert.equal(result.status, 'review');
  assert.equal(result.rule, 'R5');
});

// --- a rule disabled: falls through to review, is NOT reinterpreted by a
// later rule (a leaking rule is turned off cleanly, per the brief) ---------

test('a leaking rule turned off: disabling R2 on a party-noun row does not let R3 pick it up instead — it falls straight to review/floor', () => {
  const r = row({ method: 'DELETE', operationId: 'removeTeamMember', summary: 'Remove team membership for a user', path: '/teams/{team_id}/memberships/{username}' });
  const withR2 = judgeRow(r, { r2On: true });
  assert.equal(withR2.rule, 'R2');
  const withoutR2 = judgeRow(r, { r2On: false, floorOn: false });
  assert.equal(withoutR2.status, 'review');
  assert.equal(withoutR2.rule, 'R5');
});

// Note: admission sweeping (measuring each rule's leaks/over-tights over
// CAMARA + hold-out 1 and disabling a leaking rule for the final score) is
// data-driven over the full census and lives in run-c9.mjs, not here — it
// is exercised by running run-c9.mjs, not by a judge.mjs unit test.
