import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  scoreRow,
  aggregate,
  buildVerbTable,
  verbCountsFor,
  layer2ScopeEvidence,
  layer3CorpusEvidence,
  layer4VerbEvidence,
  leadVerbForRow,
  leadVerbWasMethodStripped,
  splitLeadToken,
  splitTokens,
  buildScopeFamilyTable,
  shareExcludingRepo,
  gatedFamilyShareForRow,
  buildRepoCountTable,
  countsForKey,
  shareX,
  buildBodyPropTable,
  bodyPropKeysForRow,
  layer5BodyEvidence,
  buildFlagTable,
  layer5FlagEvidence,
  isReadVerbForRow,
  buildLayer6Table,
  pathParamKeysForRow,
  schemaPropKeysForRow,
  layer6Evidence,
  rowExcludeRepo,
  tokenizeProse,
  highFrequencyWordTable,
  wordKeysForRow,
  buildWordTable,
  layer7WordEvidence,
  shareW,
} from './arbiter.mjs';

function row(overrides) {
  return {
    set: 'camara',
    repo: 'SomeRepo',
    path: '/x',
    method: 'GET',
    operationId: 'doThing',
    gt_class: 'r',
    security_scopes: '',
    ...overrides,
  };
}

const emptyCtx = { leanIndex: new Map(), verbTable: new Map() };

// --- 1. GET/HEAD/OPTIONS locked to r regardless of any evidence ------------

test('GET is locked to r, confidence 1, even with scope/corpus/verb evidence present', () => {
  const leanIndex = new Map([
    ['doverb', { providers: 10, perprov_get: 0, perprov_post: 10, perprov_put: 0, perprov_patch: 0, perprov_delete: 0, perprov_head: 0, perprov_options: 0 }],
  ]);
  const verbTable = buildVerbTable([
    row({ operationId: 'doVerbThing', gt_class: 'x', repo: 'A' }),
    row({ operationId: 'doVerbThing', gt_class: 'x', repo: 'A' }),
    row({ operationId: 'doVerbThing', gt_class: 'x', repo: 'A' }),
  ]);
  const r = row({
    method: 'GET',
    operationId: 'doVerbThing',
    security_scopes: 'svc:res:delete', // would be a raise on POST/PATCH/PUT/DELETE
  });
  const result = scoreRow(r, { leanIndex, verbTable }, 0.5);
  assert.equal(result.class, 'r');
  assert.equal(result.confidence, 1);
  assert.equal(result.status, 'assigned');
  assert.deepEqual(result.evidence, ['method-prior:GET-locked']);
});

test('HEAD is locked to r, confidence 1', () => {
  const result = scoreRow(row({ method: 'HEAD' }), emptyCtx, 0.5);
  assert.equal(result.class, 'r');
  assert.equal(result.confidence, 1);
  assert.equal(result.status, 'assigned');
});

test('OPTIONS is locked to r, confidence 1', () => {
  const result = scoreRow(row({ method: 'OPTIONS' }), emptyCtx, 0.5);
  assert.equal(result.class, 'r');
  assert.equal(result.confidence, 1);
  assert.equal(result.status, 'assigned');
});

// --- 2. A raise beats a lower by rule, not by weight comparison ------------

test('a raise beats a numerically larger lower — result is the prior class, not r/w', () => {
  const evidence = [
    { dir: 'lower', target: 'r', weight: 10.0, evidence: 'huge-lower' },
    { dir: 'raise', target: 'x', weight: 0.01, evidence: 'tiny-raise' },
  ];
  const result = aggregate(evidence, 'x', 0.5);
  assert.equal(result.class, 'x'); // prior for a POST/PATCH row
  assert.equal(result.status, 'assigned');
  assert.equal(result.confidence, 0.01); // confidence = R, not the lower weight
});

// --- 3. Two disagreeing scopes on the same row -> raise wins, lowering cancels
//
// CORRECTED RULE: layer 2 is now hint-vs-prior (r<w<x), so a raise can only
// come from a hint strictly above the row's prior — impossible on a
// POST/PATCH row (prior already x, the ceiling). Use a PUT row (prior w) so
// one scope hints r (below w -> lower) and another hints x (above w ->
// raise); per the corrected aggregation rule, any raise sends the row to
// class x outright (not merely "prior"), which is the whole point of the
// fix: a PUT/DELETE row can now reach x. Per M1-C5 fix 2, the read's
// lowering is also cancelled outright (not merely outweighed) because the
// two scopes carry different known hints — 'invoke' is in the explicit
// x-hint family (fix 4), so it is a real raise, not an unknown token.

test('two scopes disagreeing (read-family + explicit x-hint) on a PUT row -> raise wins, lowering is cancelled, lands at x', () => {
  const r = row({
    method: 'PUT',
    security_scopes: 'svc:res:read|svc:res:invoke', // 'invoke' is an explicit x-hint token
  });
  const evidence = layer2ScopeEvidence(r, 'w');
  // both items still emitted
  assert.equal(evidence.length, 2);
  // fix 2: the lowering is cancelled (dir 'none'), not merely outweighed
  assert.ok(!evidence.some((e) => e.dir === 'lower'));
  assert.ok(evidence.some((e) => e.evidence === 'scope:read->lower:r-cancelled'));
  assert.ok(evidence.some((e) => e.dir === 'raise'));
  const result = scoreRow(r, emptyCtx, 0.5);
  assert.equal(result.class, 'x'); // raise always means "toward x" now, not "prior"
  assert.equal(result.status, 'assigned');
});

// --- 4. Leave-one-repo-out for layer 4 --------------------------------------

test('buildVerbTable + verbCountsFor: excluding a repo actually drops its contribution', () => {
  const rows = [
    row({ operationId: 'fooThing', repo: 'RepoA', gt_class: 'x' }),
    row({ operationId: 'fooThing', repo: 'RepoA', gt_class: 'x' }),
    row({ operationId: 'fooThing', repo: 'RepoB', gt_class: 'r' }),
    row({ operationId: 'fooThing', repo: 'RepoB', gt_class: 'r' }),
    row({ operationId: 'fooThing', repo: 'RepoB', gt_class: 'r' }),
  ];
  const table = buildVerbTable(rows);

  // Full table (no exclusion, as used for holdout rows): 2x + 3r, n=5,
  // shareR=0.6 -> below 0.9, no strong signal either way.
  const full = verbCountsFor(table, 'foo', null);
  assert.deepEqual(full, { r: 3, w: 0, x: 2 });

  // Excluding RepoA (as done when scoring a CAMARA row that itself lives
  // in RepoA): only RepoB's 3 r's remain, n=3, shareR=1.0 >= 0.9.
  const excludingA = verbCountsFor(table, 'foo', 'RepoA');
  assert.deepEqual(excludingA, { r: 3, w: 0, x: 0 });

  // Prove the exclusion actually flips the emitted evidence: the full
  // table gives no evidence (n=5, shareR=0.6 < 0.9); the excluded-A table
  // gives a lower->r evidence item (shareR=1.0 >= 0.9).
  const evFull = layer4VerbEvidence(full, 'foo');
  const evExcludingA = layer4VerbEvidence(excludingA, 'foo');
  assert.equal(evFull.length, 0);
  assert.equal(evExcludingA.length, 1);
  assert.equal(evExcludingA[0].dir, 'lower');
  assert.equal(evExcludingA[0].target, 'r');

  // Excluding RepoB (as done for a CAMARA row living in RepoB): only
  // RepoA's 2 x's remain, n=2 < 3, so no evidence (n too small).
  const excludingB = verbCountsFor(table, 'foo', 'RepoB');
  assert.deepEqual(excludingB, { r: 0, w: 0, x: 2 });
  assert.equal(layer4VerbEvidence(excludingB, 'foo').length, 0);
});

test('scoreRow wires leave-one-repo-out through for a CAMARA row (not for holdout rows)', () => {
  const camaraRows = [
    row({ operationId: 'barThing', repo: 'RepoA', gt_class: 'r' }),
    row({ operationId: 'barThing', repo: 'RepoA', gt_class: 'r' }),
    row({ operationId: 'barThing', repo: 'RepoA', gt_class: 'r' }),
    row({ operationId: 'barThing', repo: 'RepoB', gt_class: 'x' }),
    row({ operationId: 'barThing', repo: 'RepoB', gt_class: 'x' }),
    row({ operationId: 'barThing', repo: 'RepoB', gt_class: 'x' }),
  ];
  const verbTable = buildVerbTable(camaraRows);
  const ctx = { leanIndex: new Map(), verbTable };

  // A CAMARA row scored from RepoA: excludes RepoA's own 3 r's, leaving
  // RepoB's 3 x's -> shareX=1.0 -> raise. Prior for PATCH is x, so class
  // stays x with the raise as the reason (n=3 meets the threshold).
  const camaraRow = row({ set: 'camara', repo: 'RepoA', method: 'PATCH', operationId: 'barThing' });
  const resultCamara = scoreRow(camaraRow, ctx, 0.5);
  assert.ok(resultCamara.evidence.some((e) => e.includes('raise')));

  // A holdout row with the same leadVerb: no exclusion, sums both repos
  // -> n=6, shareR=0.5, shareX=0.5, neither >= 0.9 -> no evidence.
  const holdoutRow = row({ set: 'holdout1', repo: 'HoldoutRepo', method: 'PATCH', operationId: 'barThing' });
  const resultHoldout = scoreRow(holdoutRow, ctx, 0.5);
  assert.equal(resultHoldout.status, 'review'); // no evidence at all -> falls to review at prior
  assert.equal(resultHoldout.class, 'x');
});

// --- 5. Negative controls ----------------------------------------------------
//
// Under the CORRECTED rules, "delete" and "write" are both in the
// write-hint family, so on a PUT/DELETE row (prior w) their hint equals the
// prior -> layer 2 emits an "-agrees" fragment, not a raise (the earlier
// arbiter's method-conditioned else-branch wrongly raised on these tokens).
// With no scope evidence, whether either row reaches x now depends entirely
// on layer 4 (the CAMARA verb table, leave-one-repo-out). Traced against
// the real census data (see poc/m1/arbiter/run.mjs's negative-control
// section): "terminate" has zero other CAMARA rows sharing that lead verb
// (n=0, no evidence); "update" has n=13 across other repos with shareX
// (2/13 ≈ 0.154) and shareW (11/13 ≈ 0.846), neither >= 0.9, so no evidence
// there either. With zero evidence anywhere, both rows fall through to
// status='review' at the method's prior (w) — NOT an assigned leak (their
// gt_class is x, but a 'review' row is not scored as either a leak or an
// exact match; it is counted in the review bucket). This is the real,
// traced outcome of the corrected algorithm — not asserted to be 'x'
// because tracing shows it structurally isn't, and not left at the old
// (also-untrue) 'w'-via-raise story either.

test('negative control 1: ClickToDial terminateCall (DELETE, gt=x) -> no evidence anywhere, falls to review at prior w', () => {
  const r = {
    set: 'camara',
    repo: 'ClickToDial',
    path: '/calls/{callId}',
    method: 'DELETE',
    operationId: 'terminateCall',
    gt_class: 'x',
    security_scopes: 'click-to-dial:calls:delete',
  };
  const result = scoreRow(r, emptyCtx, 0.5);
  assert.equal(result.prior, 'w');
  assert.equal(result.class, 'w');
  assert.equal(result.status, 'review'); // not assigned -> not a leak, but also not correct
  assert.equal(result.confidence, 0);
  assert.ok(result.evidence.some((e) => e === 'scope:delete-agrees'));
});

test('negative control 2: WebRTC updateSessionStatus (PUT, gt=x) -> agreement only, falls to review at prior w', () => {
  const r = {
    set: 'camara',
    repo: 'WebRTC',
    path: '/sessions/{mediaSessionId}/status',
    method: 'PUT',
    operationId: 'updateSessionStatus',
    gt_class: 'x',
    security_scopes: 'webrtc-call-handling:sessions:write',
  };
  const result = scoreRow(r, emptyCtx, 0.5);
  assert.equal(result.prior, 'w');
  assert.equal(result.class, 'w');
  assert.equal(result.status, 'review'); // no raise, no lower — 'write' hint agrees with prior w
  assert.equal(result.confidence, 0);
  assert.ok(result.evidence.some((e) => e === 'scope:write-agrees'));
});

// --- 6. Corpus read-riding verb lowers only absent a raise -------------------

test('corpus layer alone lowers a POST row toward r when no raise evidence competes', () => {
  const leanIndex = new Map([
    [
      'retrieve',
      {
        providers: 49,
        perprov_get: 46,
        perprov_post: 4,
        perprov_put: 0,
        perprov_patch: 0,
        perprov_delete: 0,
        perprov_head: 0,
        perprov_options: 0,
      },
    ],
  ]);
  const r = row({ method: 'POST', operationId: 'retrieveWidgets', security_scopes: '' });
  const result = scoreRow(r, { leanIndex, verbTable: new Map() }, 0.5);
  assert.equal(result.class, 'r');
  assert.equal(result.status, 'assigned');
  assert.ok(result.evidence.some((e) => e.startsWith('corpus:retrieve->lower:r')));
});

test('same synthetic row, but with a raise-inducing verb-table signal added -> raise wins over the corpus lowering', () => {
  // CORRECTED RULE: layer 2's raise now requires a scope hint strictly
  // above the row's prior, which is impossible on a POST/PATCH row (prior
  // is already x, the ceiling) — so a scope can no longer be the source of
  // a competing raise on the very row type the corpus layer applies to.
  // Layer 4 (the CAMARA verb table) can still raise on any method when
  // shareX >= 0.9 with n >= 3, so use that to construct the competing
  // raise evidence on the same synthetic row.
  const leanIndex = new Map([
    [
      'retrieve',
      {
        providers: 49,
        perprov_get: 46,
        perprov_post: 4,
        perprov_put: 0,
        perprov_patch: 0,
        perprov_delete: 0,
        perprov_head: 0,
        perprov_options: 0,
      },
    ],
  ]);
  const camaraRows = [
    row({ operationId: 'retrieveSomething', repo: 'RepoB', gt_class: 'x' }),
    row({ operationId: 'retrieveSomething', repo: 'RepoB', gt_class: 'x' }),
    row({ operationId: 'retrieveSomething', repo: 'RepoB', gt_class: 'x' }),
  ];
  const verbTable = buildVerbTable(camaraRows);
  const r = row({
    set: 'camara',
    repo: 'RepoA', // different repo -> leave-one-repo-out does not exclude RepoB's 3 x's
    method: 'POST',
    operationId: 'retrieveWidgets',
    security_scopes: '',
  });
  const result = scoreRow(r, { leanIndex, verbTable }, 0.5);
  assert.equal(result.class, 'x'); // raise wins outright, corpus lowering loses
  assert.equal(result.status, 'assigned');
  assert.ok(result.evidence.some((e) => e.includes('raise')));
  assert.ok(result.evidence.some((e) => e.startsWith('corpus:retrieve->lower:r'))); // lowering still fired, just lost
});

// --- Supporting unit coverage for tokenization and layer building -----------

test('splitLeadToken: camelCase, snake_case, kebab-case, dotted all split on first token', () => {
  assert.equal(splitLeadToken('retrieveOptimalAppEndpoints'), 'retrieve');
  assert.equal(splitLeadToken('register_application_endpoints'), 'register');
  assert.equal(splitLeadToken('terminate-call-session'), 'terminate');
  assert.equal(splitLeadToken('query.assistant'), 'query');
  assert.equal(splitLeadToken(''), '');
});

test('leadVerbForRow falls back to the last non-{param} path segment when operationId is empty', () => {
  const r = row({ operationId: '', path: '/sessions/{mediaSessionId}/statusUpdate' });
  assert.equal(leadVerbForRow(r), 'status');
});

test('layer3CorpusEvidence yields nothing for a stopword lead verb', () => {
  const leanIndex = new Map([
    ['the', { providers: 100, perprov_get: 100, perprov_post: 0, perprov_put: 0, perprov_patch: 0, perprov_delete: 0, perprov_head: 0, perprov_options: 0 }],
  ]);
  assert.deepEqual(layer3CorpusEvidence('the', 'POST', leanIndex), []);
});

test('layer3CorpusEvidence yields nothing for PUT/DELETE rows (corpus layer does not run there)', () => {
  const leanIndex = new Map([
    ['retrieve', { providers: 49, perprov_get: 46, perprov_post: 4, perprov_put: 0, perprov_patch: 0, perprov_delete: 0, perprov_head: 0, perprov_options: 0 }],
  ]);
  assert.deepEqual(layer3CorpusEvidence('retrieve', 'PUT', leanIndex), []);
  assert.deepEqual(layer3CorpusEvidence('retrieve', 'DELETE', leanIndex), []);
});

// --- M1-C5 fix 1: write-hint scope tokens never lower on POST/PATCH --------
//
// Without the fix, a 'write' scope on a POST row (prior x) lowers toward w
// at weight 0.6 — this is exactly the C4 defect (write scope on CAMARA POST
// measured 10 x / 1 w in M1-C2) that wrongly loosened truth-x rows.
//
// M1-C6 layer 2b supersedes the "agrees"/"write-blocked" no-evidence outcome
// on POST/PATCH with a raise once a measured write-family share is
// available (see the layer 2b tests below); called with no third argument
// (as here) writeFamilyXShare is null, which is the pre-2b fallback these
// two tests still cover, and PATCH now shares POST's branch (both are
// "isPostPatch") rather than PUT/DELETE's agree-only branch.

test('fix 1: a write-hint scope on POST gives no evidence at all (never lowers) when no write-family table is available', () => {
  const r = row({ method: 'POST', security_scopes: 'svc:res:write' });
  const evidence = layer2ScopeEvidence(r, 'x');
  assert.ok(!evidence.some((e) => e.dir === 'lower'));
  assert.equal(evidence.length, 1);
  assert.equal(evidence[0].dir, 'none');
  assert.equal(evidence[0].evidence, 'scope:write-write-no-table');
});

test('fix 1 / C6 2b: a write-hint scope on PATCH never lowers toward w; with no write-family table it gives no evidence (PATCH now shares POST\'s branch)', () => {
  const r = row({ method: 'PATCH', security_scopes: 'svc:res:delete' });
  const evidence = layer2ScopeEvidence(r, 'x');
  assert.ok(!evidence.some((e) => e.dir === 'lower'));
  assert.ok(evidence.some((e) => e.dir === 'none' && e.evidence === 'scope:delete-write-no-table'));
});

// --- M1-C5 fix 2: conflicting scope hints cancel any lowering --------------
//
// scheduleTransmission's real shape (M1-C4 finding 3): a POST row carrying
// both a read scope and a write scope. Without fix 2 (but with fix 1
// blocking the write-hint from lowering), the read scope alone would still
// lower the row toward r — wrongly, since the row also carries a
// disagreeing write hint.

test('fix 2: read+write scopes on POST cancel the read lowering (scheduleTransmission shape)', () => {
  const r = row({ method: 'POST', security_scopes: 'ns:read|ns:write' });
  const evidence = layer2ScopeEvidence(r, 'x');
  assert.ok(!evidence.some((e) => e.dir === 'lower'));
  assert.ok(evidence.some((e) => e.evidence === 'scope:read->lower:r-cancelled'));
});

// --- M1-C5 fix 3: method-word lead tokens stripped, separator-gated -------
//
// Corrected rule (post-escalation fix): Box's post_ai_ask and Adyen's
// post-cardDetails keep "post" as the lead verb without the fix, which is a
// raise-shaped token in the CAMARA verb table (M1-C4 finding 4: 8 of 12
// clean-exam over-tights came from this) — so a method word followed by a
// separator (_ - . or a digit) IS stripped. But a method word that is a
// genuine camelCase-led verb (deleteDevice, getSession, updateDevice) is
// NOT a redundant prefix and must keep its verb: the first implementation
// stripped these too (strip-on-equality alone), which the coordinator
// flagged as too literal a reading of the brief.

test('fix 3: a method-word prefix followed by a separator is stripped (redundant prefix)', () => {
  assert.equal(leadVerbForRow(row({ method: 'POST', operationId: 'post_ai_ask' })), 'ai');
  assert.equal(leadVerbForRow(row({ method: 'POST', operationId: 'post-cardDetails' })), 'card');
  assert.equal(leadVerbForRow(row({ method: 'DELETE', operationId: 'delete_files_id' })), 'files');
  assert.equal(leadVerbWasMethodStripped(row({ method: 'POST', operationId: 'post_ai_ask' })), true);
});

test('fix 3: a method word continuing in camelCase is a real verb and is NOT stripped', () => {
  assert.equal(leadVerbForRow(row({ method: 'DELETE', operationId: 'deleteDevice' })), 'delete');
  assert.equal(leadVerbForRow(row({ method: 'GET', operationId: 'getSession' })), 'get');
  assert.equal(leadVerbForRow(row({ method: 'PUT', operationId: 'updateDevice' })), 'update'); // not a method-word lead at all
  assert.equal(leadVerbWasMethodStripped(row({ method: 'DELETE', operationId: 'deleteDevice' })), false);
});

test('fix 3: a lead token is NOT stripped when it does not equal the row\'s own method', () => {
  // 'get' only strips on a GET row; on POST it is left alone (GET rows never
  // reach the corpus/verb-table layers anyway, since they are locked at r).
  assert.equal(leadVerbForRow(row({ method: 'POST', operationId: 'getWidgetStatus' })), 'get');
  assert.equal(leadVerbWasMethodStripped(row({ method: 'POST', operationId: 'getWidgetStatus' })), false);
});

// --- M1-C5 fix 4: unknown scope tokens give no evidence --------------------
//
// Without the fix, an unrecognized token defaults to an x hint and raises
// on any method whose prior is below x — this produced all 4 CAMARA
// over-tights in C4 (deleteRebootRequest and friends, M1-C4 finding 5).

test('fix 4: an unknown scope token gives no evidence and does not raise', () => {
  const r = row({ method: 'PUT', security_scopes: 'ns:res:reboot' }); // 'reboot' is not in any hint family
  const evidence = layer2ScopeEvidence(r, 'w');
  assert.equal(evidence.length, 1);
  assert.equal(evidence[0].dir, 'none');
  assert.equal(evidence[0].evidence, 'scope:reboot-unknown');
  const result = scoreRow(r, emptyCtx, 0.5);
  assert.equal(result.status, 'review'); // no raise, no lower -> falls to review at the prior
  assert.notEqual(result.class, 'x');
});

test('fix 4: an explicit x-hint scope token (from the minimal named set) still raises', () => {
  const r = row({ method: 'PUT', security_scopes: 'ns:res:create' });
  const evidence = layer2ScopeEvidence(r, 'w');
  assert.ok(evidence.some((e) => e.dir === 'raise'));
  const result = scoreRow(r, emptyCtx, 0.5);
  assert.equal(result.class, 'x');
  assert.equal(result.status, 'assigned');
});

// --- M1-C5 fix 5: corpus PATCH/POST w-lean is a named switch ---------------

test('fix 5: the corpus PUT+PATCH-share w-lean fires when the switch is on, and not when it is off', () => {
  const leanIndex = new Map([
    [
      'update',
      {
        providers: 20,
        perprov_get: 2,
        perprov_post: 3,
        perprov_put: 8,
        perprov_patch: 6,
        perprov_delete: 1,
        perprov_head: 0,
        perprov_options: 0,
      },
    ],
  ]);
  const on = layer3CorpusEvidence('update', 'PATCH', leanIndex, true);
  assert.equal(on.length, 1);
  assert.equal(on[0].dir, 'lower');
  assert.equal(on[0].target, 'w');

  const off = layer3CorpusEvidence('update', 'PATCH', leanIndex, false);
  assert.deepEqual(off, []);
});

test('fix 5: scoreRow defaults corpusWLean to on when switches is omitted', () => {
  const leanIndex = new Map([
    [
      'update',
      {
        providers: 20,
        perprov_get: 2,
        perprov_post: 3,
        perprov_put: 8,
        perprov_patch: 6,
        perprov_delete: 1,
        perprov_head: 0,
        perprov_options: 0,
      },
    ],
  ]);
  const r = row({ method: 'PATCH', operationId: 'updateWidget', security_scopes: '' });
  const withDefault = scoreRow(r, { leanIndex, verbTable: new Map() }, 0.5);
  const withExplicitOff = scoreRow(r, { leanIndex, verbTable: new Map() }, 0.5, { corpusWLean: false });
  assert.ok(withDefault.evidence.some((e) => e.startsWith('corpus:update->lower:w')));
  assert.ok(!withExplicitOff.evidence.some((e) => e.startsWith('corpus:update->lower:w')));
});

// --- Supporting unit coverage: splitTokens returns all tokens, not just the lead

test('splitTokens returns every token, not just the first', () => {
  assert.deepEqual(splitTokens('retrieveOptimalAppEndpoints'), ['retrieve', 'optimal', 'app', 'endpoints']);
  assert.deepEqual(splitTokens('post-cardDetails'), ['post', 'card', 'details']);
});

// ============================================================================
// M1-C6: three new evidence layers
// ============================================================================

// --- Layer 2b (revised, coordinator correction 2026-09-07): scope
// agreement upgraded to a raise on POST/PATCH ONLY when that method's own
// measured family share clears n >= 5, share >= 0.9 — write-family and
// x-hint-family are measured and gated separately per method, never
// pooled, and never a fixed weight. -----------------------------------

test('layer 2b: an x-hint token raises on a method only when xHintXShare is supplied (admitted), and stays a plain agreement otherwise', () => {
  const post = row({ method: 'POST', security_scopes: 'svc:res:create' });
  const evAdmitted = layer2ScopeEvidence(post, 'x', null, 0.95);
  assert.ok(evAdmitted.some((e) => e.dir === 'raise' && Math.abs(e.weight - 0.95) < 1e-9 && e.evidence === 'scope:create->raise:xHintShare=0.950'));

  // Not admitted on this method (xHintXShare null) -> falls back to a plain
  // agreement, exactly the pre-2b behavior.
  const evNotAdmitted = layer2ScopeEvidence(post, 'x', null, null);
  assert.ok(!evNotAdmitted.some((e) => e.dir === 'raise'));
  assert.ok(evNotAdmitted.some((e) => e.dir === 'agree' && e.evidence === 'scope:create-agrees'));

  const result = scoreRow(post, emptyCtx, 0.5); // emptyCtx has no scopeFamilyTables -> null shares -> no raise from 2b
  assert.notEqual(result.status, 'assigned'); // no evidence anywhere in emptyCtx -> review
});

test('layer 2b: a write-family token raises only on a method whose measured writeFamilyXShare is supplied, and never on PUT/DELETE', () => {
  const post = row({ method: 'POST', security_scopes: 'svc:res:write' });
  const evAdmitted = layer2ScopeEvidence(post, 'x', 0.94, null); // POST admitted per the coordinator's own count
  assert.ok(evAdmitted.some((e) => e.dir === 'raise' && Math.abs(e.weight - 0.94) < 1e-9));

  const patch = row({ method: 'PATCH', security_scopes: 'svc:res:update' });
  const evNotAdmitted = layer2ScopeEvidence(patch, 'x', null, null); // PATCH not admitted -> agrees
  assert.ok(!evNotAdmitted.some((e) => e.dir === 'raise'));
  assert.ok(evNotAdmitted.some((e) => e.dir === 'none' && e.evidence === 'scope:update-write-no-table'));

  const put = row({ method: 'PUT', security_scopes: 'svc:res:write' });
  const evPut = layer2ScopeEvidence(put, 'w', 0.94, null);
  assert.ok(!evPut.some((e) => e.dir === 'raise'));
  assert.ok(evPut.some((e) => e.dir === 'agree' && e.evidence === 'scope:write-agrees'));
});

test('buildScopeFamilyTable + shareExcludingRepo: per-method, leave-one-repo-out — the coordinator\'s own POST/PATCH split', () => {
  const camaraRows = [
    // POST write-family: 1 x -> full-table share would be 1.0, but this is
    // deliberately tiny to prove the per-method split, not the real numbers.
    row({ repo: 'RepoA', method: 'POST', operationId: 'registerX', gt_class: 'x', security_scopes: 'ns:res:write' }),
    // PATCH write-family: 1 x, 2 w -> share 1/3, nowhere near 0.9.
    row({ repo: 'RepoA', method: 'PATCH', operationId: 'updateX', gt_class: 'x', security_scopes: 'ns:res:update' }),
    row({ repo: 'RepoB', method: 'PATCH', operationId: 'updateY', gt_class: 'w', security_scopes: 'ns:res:update' }),
    row({ repo: 'RepoB', method: 'PATCH', operationId: 'updateZ', gt_class: 'w', security_scopes: 'ns:res:update' }),
  ];
  const postTable = buildScopeFamilyTable(camaraRows, 'POST', 'w');
  const patchTable = buildScopeFamilyTable(camaraRows, 'PATCH', 'w');
  // POST table only sees the one POST row -> not a PATCH row leaking in.
  assert.equal(shareExcludingRepo(postTable, null).n, 1);
  assert.equal(shareExcludingRepo(postTable, null).share, 1);
  // PATCH table sees only the three PATCH rows.
  const patchFull = shareExcludingRepo(patchTable, null);
  assert.equal(patchFull.n, 3);
  assert.equal(patchFull.share, 1 / 3);
  // Leave-one-repo-out: excluding RepoB from the PATCH table leaves only
  // RepoA's one truth-x PATCH row.
  const patchExcludingB = shareExcludingRepo(patchTable, 'RepoB');
  assert.equal(patchExcludingB.n, 1);
  assert.equal(patchExcludingB.share, 1);
});

test('gatedFamilyShareForRow: gates at n>=5, share>=0.9, and applies leave-one-repo-out for a CAMARA row', () => {
  const camaraRows = [];
  for (let i = 0; i < 9; i++) {
    camaraRows.push(row({ repo: `Repo${i}`, method: 'POST', operationId: `op${i}`, gt_class: 'x', security_scopes: 'ns:res:write' }));
  }
  camaraRows.push(row({ repo: 'RepoW', method: 'POST', operationId: 'opW', gt_class: 'w', security_scopes: 'ns:res:write' }));
  const table = buildScopeFamilyTable(camaraRows, 'POST', 'w'); // n=10, share=0.9 exactly at the bar
  const r = row({ set: 'camara', repo: 'RepoOutside', method: 'POST' });
  const shareForOutsideRow = gatedFamilyShareForRow(r, table);
  assert.equal(shareForOutsideRow, 0.9); // outside repo -> no exclusion effect, full table used

  // A CAMARA row living in one of the table's own repos excludes itself —
  // excluding Repo0 (a truth-x contributor) drops n to 9, share stays >= 0.9
  // only if the remaining rows still clear it; here 8 x / 1 w = 0.889, so
  // it now falls just short and must return null.
  const rInRepo0 = row({ set: 'camara', repo: 'Repo0', method: 'POST' });
  assert.equal(gatedFamilyShareForRow(rInRepo0, table), null);
});

// --- Layer 5: body-prop and flag raisers ------------------------------------

test('bodyPropKeysForRow: splits requestBody_props on "|", empty when requestBody is absent', () => {
  assert.deepEqual(bodyPropKeysForRow(row({ requestBody_present: 'true', requestBody_props: 'sink|sinkCredential' })), ['sink', 'sinkCredential']);
  assert.deepEqual(bodyPropKeysForRow(row({ requestBody_present: 'false', requestBody_props: 'sink' })), []);
  assert.deepEqual(bodyPropKeysForRow(row({ requestBody_present: 'true', requestBody_props: '' })), []);
});

test('layer5BodyEvidence: an admitted body-prop name at n>=5, share>=0.9 raises with weight = its share; a non-admitted name gives nothing', () => {
  // 9 x, 1 w across five repos, n=10, share=0.9 — right at the admission bar.
  const rows = [
    row({ repo: 'A', requestBody_present: 'true', requestBody_props: 'sink', gt_class: 'x' }),
    row({ repo: 'A', requestBody_present: 'true', requestBody_props: 'sink', gt_class: 'x' }),
    row({ repo: 'B', requestBody_present: 'true', requestBody_props: 'sink', gt_class: 'x' }),
    row({ repo: 'B', requestBody_present: 'true', requestBody_props: 'sink', gt_class: 'x' }),
    row({ repo: 'C', requestBody_present: 'true', requestBody_props: 'sink', gt_class: 'x' }),
    row({ repo: 'C', requestBody_present: 'true', requestBody_props: 'sink', gt_class: 'w' }),
    row({ repo: 'D', requestBody_present: 'true', requestBody_props: 'sink', gt_class: 'x' }),
    row({ repo: 'D', requestBody_present: 'true', requestBody_props: 'sink', gt_class: 'x' }),
    row({ repo: 'E', requestBody_present: 'true', requestBody_props: 'sink', gt_class: 'x' }),
    row({ repo: 'E', requestBody_present: 'true', requestBody_props: 'sink', gt_class: 'x' }),
  ];
  const table = buildBodyPropTable(rows);
  const admitted = new Set(['sink']);
  const r = row({ set: 'camara', repo: 'F', requestBody_present: 'true', requestBody_props: 'sink|other' });
  const ev = layer5BodyEvidence(r, table, admitted);
  assert.equal(ev.length, 1);
  assert.equal(ev[0].dir, 'raise');
  assert.equal(ev[0].weight, 9 / 10);
  assert.ok(ev[0].evidence.startsWith('bodyprop:sink->raise'));

  const notAdmitted = layer5BodyEvidence(r, table, new Set(['other']));
  assert.deepEqual(notAdmitted, []);
});

test('layer5BodyEvidence: leave-one-repo-out — a CAMARA or hold-out-1 row never scores itself; a hold-out-2 row uses the whole table', () => {
  const rows = [
    row({ set: 'camara', repo: 'A', requestBody_present: 'true', requestBody_props: 'amount', gt_class: 'x' }),
    row({ set: 'camara', repo: 'A', requestBody_present: 'true', requestBody_props: 'amount', gt_class: 'x' }),
    row({ set: 'camara', repo: 'A', requestBody_present: 'true', requestBody_props: 'amount', gt_class: 'x' }),
    row({ set: 'camara', repo: 'A', requestBody_present: 'true', requestBody_props: 'amount', gt_class: 'x' }),
    row({ set: 'camara', repo: 'A', requestBody_present: 'true', requestBody_props: 'amount', gt_class: 'x' }),
  ];
  const table = buildBodyPropTable(rows);
  const admitted = new Set(['amount']);
  // A CAMARA row from RepoA: excluding RepoA leaves n=0 -> no evidence, even
  // though the un-excluded table alone would satisfy n=5, share=1.0.
  const camaraRow = row({ set: 'camara', repo: 'A', requestBody_present: 'true', requestBody_props: 'amount' });
  assert.deepEqual(layer5BodyEvidence(camaraRow, table, admitted), []);
  // A hold-out-2 row with the same prop: no exclusion, the full n=5 table fires.
  const holdout2Row = row({ set: 'holdout2', repo: 'ZRepo', requestBody_present: 'true', requestBody_props: 'amount' });
  const ev = layer5BodyEvidence(holdout2Row, table, admitted);
  assert.equal(ev.length, 1);
  assert.equal(ev[0].weight, 1.0);
});

test('layer5FlagEvidence: an admitted present-only flag raises with weight = its share; absence gives nothing', () => {
  // 9 x, 1 w across five repos, n=10, share=0.9 — right at the admission bar.
  const rows = [
    row({ repo: 'A', callbacks_present: 'true', gt_class: 'x' }),
    row({ repo: 'A', callbacks_present: 'true', gt_class: 'x' }),
    row({ repo: 'B', callbacks_present: 'true', gt_class: 'x' }),
    row({ repo: 'B', callbacks_present: 'true', gt_class: 'x' }),
    row({ repo: 'C', callbacks_present: 'true', gt_class: 'x' }),
    row({ repo: 'C', callbacks_present: 'true', gt_class: 'w' }),
    row({ repo: 'D', callbacks_present: 'true', gt_class: 'x' }),
    row({ repo: 'D', callbacks_present: 'true', gt_class: 'x' }),
    row({ repo: 'E', callbacks_present: 'true', gt_class: 'x' }),
    row({ repo: 'E', callbacks_present: 'true', gt_class: 'x' }),
  ];
  const table = buildFlagTable(rows, 'callbacks_present');
  const withFlag = row({ set: 'camara', repo: 'F', callbacks_present: 'true' });
  const ev = layer5FlagEvidence(withFlag, 'callbacks_present', table, true);
  assert.equal(ev.length, 1);
  assert.equal(ev[0].weight, 9 / 10);
  const withoutFlag = row({ set: 'camara', repo: 'F', callbacks_present: 'false' });
  assert.deepEqual(layer5FlagEvidence(withoutFlag, 'callbacks_present', table, true), []);
});

// --- Layer 6: own-vs-other structural facts for PUT/DELETE/PATCH -----------

test('pathParamKeysForRow and schemaPropKeysForRow parse their sources correctly', () => {
  assert.deepEqual(pathParamKeysForRow(row({ path: '/calls/{callId}/status' })), ['callId']);
  assert.deepEqual(pathParamKeysForRow(row({ path: '/a/{x}/b/{y}' })), ['x', 'y']);
  assert.deepEqual(pathParamKeysForRow(row({ path: '/no-params' })), []);
  assert.deepEqual(schemaPropKeysForRow(row({ resource_schema_props: 'foo|bar' })), ['foo', 'bar']);
});

test('layer6Evidence only applies to PUT/DELETE/PATCH rows, never GET/POST', () => {
  const categories = [
    { name: 'pathparam', keysFn: pathParamKeysForRow, table: buildLayer6Table([
        row({ method: 'PUT', repo: 'A', path: '/x/{ownerId}', gt_class: 'x' }),
        row({ method: 'PUT', repo: 'B', path: '/x/{ownerId}', gt_class: 'x' }),
        row({ method: 'PUT', repo: 'C', path: '/x/{ownerId}', gt_class: 'x' }),
        row({ method: 'PUT', repo: 'D', path: '/x/{ownerId}', gt_class: 'x' }),
        row({ method: 'PUT', repo: 'E', path: '/x/{ownerId}', gt_class: 'x' }),
      ], pathParamKeysForRow), admittedSet: new Set(['ownerId']) },
    // (buildLayer6Table takes (rows, keysFn); the categories array's own
    // keysFn above is the one layer6Evidence actually calls per scored row)
  ];
  const putRow = row({ set: 'camara', repo: 'F', method: 'PUT', path: '/x/{ownerId}' });
  const ev = layer6Evidence(putRow, categories);
  assert.equal(ev.length, 1);
  assert.equal(ev[0].dir, 'raise');

  const postRow = row({ set: 'camara', repo: 'F', method: 'POST', path: '/x/{ownerId}' });
  assert.deepEqual(layer6Evidence(postRow, categories), []);
  const getRow = row({ set: 'camara', repo: 'F', method: 'GET', path: '/x/{ownerId}' });
  assert.deepEqual(layer6Evidence(getRow, categories), []);
});

test('layer6Evidence: an empty admittedSet (the honest "nothing qualified" outcome) never raises', () => {
  const categories = [
    { name: 'partyidparam', keysFn: (r) => (r.party_id_param === 'true' ? ['party_id_param'] : []), table: new Map(), admittedSet: new Set() },
  ];
  const r = row({ set: 'holdout1', repo: 'twilio', method: 'DELETE', party_id_param: 'true' });
  assert.deepEqual(layer6Evidence(r, categories), []);
});

test('scoreRow wires layers 2b/5/6 through ctx and the raise wins the aggregate, regardless of threshold', () => {
  const bodyPropTable = buildBodyPropTable([
    row({ repo: 'A', requestBody_present: 'true', requestBody_props: 'sink', gt_class: 'x' }),
    row({ repo: 'A', requestBody_present: 'true', requestBody_props: 'sink', gt_class: 'x' }),
    row({ repo: 'B', requestBody_present: 'true', requestBody_props: 'sink', gt_class: 'x' }),
    row({ repo: 'B', requestBody_present: 'true', requestBody_props: 'sink', gt_class: 'x' }),
    row({ repo: 'C', requestBody_present: 'true', requestBody_props: 'sink', gt_class: 'x' }),
  ]);
  const ctx = { leanIndex: new Map(), verbTable: new Map(), bodyPropTable, admittedBodyProps: new Set(['sink']) };
  const r = row({ set: 'camara', repo: 'D', method: 'POST', requestBody_present: 'true', requestBody_props: 'sink', security_scopes: '' });
  const result = scoreRow(r, ctx, 2.0); // T well above any weight in play
  assert.equal(result.class, 'x');
  assert.equal(result.status, 'assigned');
  assert.ok(result.evidence.some((e) => e.startsWith('bodyprop:sink->raise')));
});

// --- Negative controls, re-asserted under the C6 pipeline -------------------
//
// Neither terminateCall nor updateSessionStatus carries a requestBody, a
// present-only flag, or a path-param/schema shape admitted by the real
// census tables (traced in run.mjs's own report) — so wiring layers 5/6
// into their ctx changes nothing about their outcome. Reported plainly, not
// forced to 'x': both still fall to review at the method's prior.

test('negative control 1, re-checked under C6: terminateCall still has no admitting evidence and falls to review at prior w', () => {
  const r = {
    set: 'camara',
    repo: 'ClickToDial',
    path: '/calls/{callId}',
    method: 'DELETE',
    operationId: 'terminateCall',
    gt_class: 'x',
    security_scopes: 'click-to-dial:calls:delete',
    requestBody_present: 'false',
    requestBody_props: '',
    callbacks_present: 'false',
    has202: 'false',
    party_id_param: 'false',
    resource_schema_party_field: 'false',
    resource_schema_props: '',
  };
  // ctx carries C6 tables that do NOT admit anything matching this row's
  // shape, to prove the layers being present is not itself sufficient.
  const ctx = {
    leanIndex: new Map(),
    verbTable: new Map(),
    scopeFamilyTables: new Map(),
    bodyPropTable: new Map(),
    admittedBodyProps: new Set(['sink']),
    flagTables: new Map([['callbacks_present', new Map()]]),
    admittedFlags: new Set(['callbacks_present']),
    layer6Categories: [{ name: 'pathparam', keysFn: pathParamKeysForRow, table: new Map(), admittedSet: new Set(['ownerId']) }],
  };
  const result = scoreRow(r, ctx, 0.5);
  assert.equal(result.prior, 'w');
  assert.equal(result.class, 'w');
  assert.equal(result.status, 'review');
  assert.ok(result.evidence.some((e) => e === 'scope:delete-agrees'));
});

test('negative control 2, re-checked under C6: updateSessionStatus still has no admitting evidence and falls to review at prior w', () => {
  const r = {
    set: 'camara',
    repo: 'WebRTC',
    path: '/sessions/{mediaSessionId}/status',
    method: 'PUT',
    operationId: 'updateSessionStatus',
    gt_class: 'x',
    security_scopes: 'webrtc-call-handling:sessions:write',
    requestBody_present: 'true',
    requestBody_props: 'status',
    callbacks_present: 'false',
    has202: 'false',
    party_id_param: 'false',
    resource_schema_party_field: 'false',
    resource_schema_props: '',
  };
  const ctx = {
    leanIndex: new Map(),
    verbTable: new Map(),
    scopeFamilyTables: new Map(),
    bodyPropTable: new Map(),
    admittedBodyProps: new Set(['sink']), // 'status' is not admitted
    flagTables: new Map(),
    admittedFlags: new Set(),
    layer6Categories: [],
  };
  const result = scoreRow(r, ctx, 0.5);
  assert.equal(result.prior, 'w');
  assert.equal(result.class, 'w');
  assert.equal(result.status, 'review');
  assert.ok(result.evidence.some((e) => e === 'scope:write-agrees'));
});

// --- M1-C7: callbacks_present does not raise a read-led operation ----------

function callbacksTable() {
  // 9 x, 1 w across five repos, n=10, share=0.9 — clears the admission bar,
  // same shape as the layer5FlagEvidence unit test above.
  const rows = [
    row({ repo: 'A', callbacks_present: 'true', gt_class: 'x' }),
    row({ repo: 'A', callbacks_present: 'true', gt_class: 'x' }),
    row({ repo: 'B', callbacks_present: 'true', gt_class: 'x' }),
    row({ repo: 'B', callbacks_present: 'true', gt_class: 'x' }),
    row({ repo: 'C', callbacks_present: 'true', gt_class: 'x' }),
    row({ repo: 'C', callbacks_present: 'true', gt_class: 'w' }),
    row({ repo: 'D', callbacks_present: 'true', gt_class: 'x' }),
    row({ repo: 'D', callbacks_present: 'true', gt_class: 'x' }),
    row({ repo: 'E', callbacks_present: 'true', gt_class: 'x' }),
    row({ repo: 'E', callbacks_present: 'true', gt_class: 'x' }),
  ];
  return buildFlagTable(rows, 'callbacks_present');
}

test('M1-C7: retrievePopulationDensity-shaped row (read scope + callbacks) lands r', () => {
  const table = callbacksTable();
  const ctx = {
    leanIndex: new Map(),
    verbTable: new Map(),
    flagTables: new Map([['callbacks_present', table]]),
    admittedFlags: new Set(['callbacks_present']),
  };
  const r = row({
    set: 'camara',
    repo: 'F',
    method: 'POST',
    operationId: 'retrievePopulationDensity',
    security_scopes: 'population-density:area:retrieve',
    requestBody_present: 'true',
    callbacks_present: 'true',
    gt_class: 'r',
  });
  // Sanity: the read-family scope token alone is enough for isReadVerbForRow.
  assert.equal(isReadVerbForRow(r, ctx.leanIndex), true);
  const result = scoreRow(r, ctx, 0.5);
  assert.equal(result.class, 'r');
  assert.equal(result.status, 'assigned');
  assert.ok(result.evidence.includes('flag:callbacks_present-suppressed:read-verb'));
  assert.ok(!result.evidence.some((e) => e.startsWith('flag:callbacks_present->raise')));
});

test('M1-C7: createSubscription-shaped row (create scope + callbacks) still raises x', () => {
  const table = callbacksTable();
  const ctx = {
    leanIndex: new Map(),
    verbTable: new Map(),
    flagTables: new Map([['callbacks_present', table]]),
    admittedFlags: new Set(['callbacks_present']),
  };
  const r = row({
    set: 'camara',
    repo: 'F',
    method: 'POST',
    operationId: 'createSubscription',
    security_scopes: 'subscriptions:events:create',
    requestBody_present: 'true',
    callbacks_present: 'true',
    gt_class: 'x',
  });
  assert.equal(isReadVerbForRow(r, ctx.leanIndex), false);
  const result = scoreRow(r, ctx, 0.5);
  assert.equal(result.class, 'x');
  assert.equal(result.status, 'assigned');
  assert.ok(result.evidence.some((e) => e.startsWith('flag:callbacks_present->raise')));
  assert.ok(!result.evidence.some((e) => e.includes('suppressed')));
});

test('M1-C7: a callbacks row with no read signal (empty scopes, unmeasured verb) still raises', () => {
  const table = callbacksTable();
  const ctx = {
    // A lead verb present in the corpus lean but well under the read bar
    // (low GET share, or too few providers) must not suppress the raise.
    leanIndex: new Map([
      ['dispatch', { providers: 2, perprov_get: 0, perprov_post: 5, perprov_put: 0, perprov_patch: 0, perprov_delete: 0, perprov_head: 0, perprov_options: 0 }],
    ]),
    verbTable: new Map(),
    flagTables: new Map([['callbacks_present', table]]),
    admittedFlags: new Set(['callbacks_present']),
  };
  const r = row({
    set: 'camara',
    repo: 'F',
    method: 'POST',
    operationId: 'dispatchEvent',
    security_scopes: '',
    requestBody_present: 'true',
    callbacks_present: 'true',
    gt_class: 'x',
  });
  assert.equal(isReadVerbForRow(r, ctx.leanIndex), false);
  const result = scoreRow(r, ctx, 0.5);
  assert.equal(result.class, 'x');
  assert.equal(result.status, 'assigned');
  assert.ok(result.evidence.some((e) => e.startsWith('flag:callbacks_present->raise')));
});

test('isReadVerbForRow: corpus-lean path alone (no scope) suppresses at providers>=3, GET share>=0.75; falls short below either bar', () => {
  const leanIndex = new Map([
    ['retrieve', { providers: 4, perprov_get: 80, perprov_post: 20, perprov_put: 0, perprov_patch: 0, perprov_delete: 0, perprov_head: 0, perprov_options: 0 }],
    ['borderline', { providers: 2, perprov_get: 90, perprov_post: 10, perprov_put: 0, perprov_patch: 0, perprov_delete: 0, perprov_head: 0, perprov_options: 0 }],
  ]);
  const readRow = row({ method: 'POST', operationId: 'retrieveThing', security_scopes: '' });
  assert.equal(isReadVerbForRow(readRow, leanIndex), true);
  // providers=2 < 3: the GET-share bar alone is not enough.
  const borderlineRow = row({ method: 'POST', operationId: 'borderlineThing', security_scopes: '' });
  assert.equal(isReadVerbForRow(borderlineRow, leanIndex), false);
  // No leanIndex at all and no read scope: false, never throws.
  assert.equal(isReadVerbForRow(readRow, null), false);
});

// --- M1-C8, layer 7: prose words (D30, prose last) --------------------------

test('tokenizeProse: lowercases, splits on non-letters, drops tokens under 3 chars', () => {
  const tokens = tokenizeProse('Delete a Key', 'This removes the API key, id: 42.');
  assert.deepEqual([...tokens].sort(), ['api', 'delete', 'key', 'removes', 'the', 'this']);
});

test('highFrequencyWordTable: drops a token present in more than the row-fraction bar, keeps one just under it', () => {
  // 5 rows: "the" in all 5 (1.0 > 0.4, dropped), "rare" in 2 of 5 (0.4, not
  // strictly greater than the bar, kept).
  const rowsWithTokens = [
    new Set(['the', 'rare', 'delete']),
    new Set(['the', 'rare', 'update']),
    new Set(['the', 'create']),
    new Set(['the', 'send']),
    new Set(['the', 'notify']),
  ];
  const dropped = highFrequencyWordTable(rowsWithTokens, 0.4);
  assert.equal(dropped.get('the'), 5);
  assert.equal(dropped.has('rare'), false);
});

function wordTableFromWords(specs) {
  // specs: [{repo, words: [...], gt_class}]
  return buildWordTable(specs.map((s) => row({ repo: s.repo, gt_class: s.gt_class, words: new Set(s.words) })));
}

test('layer7WordEvidence: an admitted word raises a silent DELETE (no other evidence) to x', () => {
  const table = wordTableFromWords([
    { repo: 'A', words: ['removed'], gt_class: 'x' },
    { repo: 'B', words: ['removed'], gt_class: 'x' },
    { repo: 'C', words: ['removed'], gt_class: 'x' },
    { repo: 'D', words: ['removed'], gt_class: 'x' },
    { repo: 'E', words: ['removed'], gt_class: 'x' },
  ]);
  const admitted = new Set(['removed']);
  const ctx = { leanIndex: new Map(), verbTable: new Map(), wordTable: table, admittedWords: admitted };
  const silentDelete = row({
    set: 'holdout2',
    repo: 'ZRepo',
    method: 'DELETE',
    operationId: 'deleteThing',
    security_scopes: '',
    words: new Set(['removed']),
    gt_class: 'x',
  });
  // wordsOn OFF (default): no evidence from layer 7, falls to review at prior w.
  const withoutWords = scoreRow(silentDelete, ctx, 0.5);
  assert.equal(withoutWords.status, 'review');
  assert.equal(withoutWords.class, 'w');
  // wordsOn ON: the admitted word raises it to x, regardless of threshold.
  const withWords = scoreRow(silentDelete, ctx, 2.0, { wordsOn: true });
  assert.equal(withWords.class, 'x');
  assert.equal(withWords.status, 'assigned');
  assert.ok(withWords.evidence.some((e) => e.startsWith('word:removed->raise')));
});

test('layer7WordEvidence: leave-one-repo-out — a CAMARA or hold-out-1 row never scores itself; a hold-out-2 row uses the whole table', () => {
  const table = wordTableFromWords([
    { repo: 'A', words: ['dispatched'], gt_class: 'x' },
    { repo: 'A', words: ['dispatched'], gt_class: 'x' },
    { repo: 'A', words: ['dispatched'], gt_class: 'x' },
    { repo: 'A', words: ['dispatched'], gt_class: 'x' },
    { repo: 'A', words: ['dispatched'], gt_class: 'x' },
  ]);
  const admitted = new Set(['dispatched']);
  // A CAMARA row from RepoA: excluding RepoA leaves n=0 -> no evidence, even
  // though the un-excluded table alone would satisfy n=5, share=1.0.
  const camaraRow = row({ set: 'camara', repo: 'A', words: new Set(['dispatched']) });
  assert.deepEqual(layer7WordEvidence(camaraRow, table, admitted), []);
  // A hold-out-2 row with the same word: no exclusion, the full n=5 table fires.
  const holdout2Row = row({ set: 'holdout2', repo: 'ZRepo', words: new Set(['dispatched']) });
  const ev = layer7WordEvidence(holdout2Row, table, admitted);
  assert.equal(ev.length, 1);
  assert.equal(ev[0].dir, 'raise');
  assert.equal(ev[0].weight, 1.0);
});

test('layer7WordEvidence: a word under the bar (n>=5 but share<0.9, or n<5) gives nothing', () => {
  const belowShareTable = wordTableFromWords([
    { repo: 'A', words: ['maybe'], gt_class: 'x' },
    { repo: 'B', words: ['maybe'], gt_class: 'x' },
    { repo: 'C', words: ['maybe'], gt_class: 'x' },
    { repo: 'D', words: ['maybe'], gt_class: 'w' },
    { repo: 'E', words: ['maybe'], gt_class: 'w' },
  ]); // n=5, share=0.6 < 0.9
  const r = row({ set: 'holdout2', repo: 'ZRepo', words: new Set(['maybe']) });
  assert.deepEqual(layer7WordEvidence(r, belowShareTable, new Set(['maybe'])), []);

  const belowNTable = wordTableFromWords([
    { repo: 'A', words: ['scarce'], gt_class: 'x' },
    { repo: 'B', words: ['scarce'], gt_class: 'x' },
  ]); // n=2 < 5
  assert.deepEqual(
    layer7WordEvidence(row({ set: 'holdout2', repo: 'ZRepo', words: new Set(['scarce']) }), belowNTable, new Set(['scarce'])),
    [],
  );

  // Not in admittedWords at all, regardless of the table.
  assert.deepEqual(layer7WordEvidence(r, belowShareTable, new Set(['other'])), []);
});

test('wordKeysForRow: reads row.words as an array; empty when absent', () => {
  assert.deepEqual(wordKeysForRow(row({ words: new Set(['a', 'b']) })).sort(), ['a', 'b']);
  assert.deepEqual(wordKeysForRow(row({})), []);
});

test('shareW: truth-w share of a counts object, mirroring shareX', () => {
  assert.deepEqual(shareW({ r: 0, w: 3, x: 1 }), { n: 4, share: 0.75 });
  assert.equal(shareW({ r: 0, w: 0, x: 0 }), null);
  assert.equal(shareW(null), null);
});

// --- M1-C9: layer3On/layer4On switches (default true, backward compatible) -

test('scoreRow: layer3On/layer4On default true — a POST row with strong corpus+verb-table lowering evidence still scores exactly as before the switches were added', () => {
  const leanIndex = new Map([
    ['retrieve', { providers: 10, perprov_get: 8, perprov_post: 2, perprov_put: 0, perprov_patch: 0, perprov_delete: 0, perprov_head: 0, perprov_options: 0 }],
  ]);
  const verbTable = buildVerbTable([
    row({ operationId: 'retrieveThing', gt_class: 'r', repo: 'A' }),
    row({ operationId: 'retrieveThing', gt_class: 'r', repo: 'A' }),
    row({ operationId: 'retrieveThing', gt_class: 'r', repo: 'A' }),
  ]);
  const r = row({ method: 'POST', operationId: 'retrieveThing', repo: 'B' });
  const withoutSwitches = scoreRow(r, { leanIndex, verbTable }, 0.5);
  const withDefaultSwitches = scoreRow(r, { leanIndex, verbTable }, 0.5, {});
  const withExplicitTrue = scoreRow(r, { leanIndex, verbTable }, 0.5, { layer3On: true, layer4On: true });
  assert.deepEqual(withDefaultSwitches, withoutSwitches);
  assert.deepEqual(withExplicitTrue, withoutSwitches);
  assert.equal(withoutSwitches.class, 'r');
  assert.equal(withoutSwitches.status, 'assigned');
  assert.ok(withoutSwitches.evidence.some((e) => e.startsWith('corpus:retrieve->lower:r')));
  assert.ok(withoutSwitches.evidence.some((e) => e.startsWith('verbtable:retrieve->lower:r')));
});

test('scoreRow: layer3On:false removes layer 3 (corpus lean) evidence entirely, leaving layer 4 untouched', () => {
  const leanIndex = new Map([
    ['retrieve', { providers: 10, perprov_get: 8, perprov_post: 2, perprov_put: 0, perprov_patch: 0, perprov_delete: 0, perprov_head: 0, perprov_options: 0 }],
  ]);
  const verbTable = buildVerbTable([
    row({ operationId: 'retrieveThing', gt_class: 'r', repo: 'A' }),
    row({ operationId: 'retrieveThing', gt_class: 'r', repo: 'A' }),
    row({ operationId: 'retrieveThing', gt_class: 'r', repo: 'A' }),
  ]);
  const r = row({ method: 'POST', operationId: 'retrieveThing', repo: 'B' });
  const result = scoreRow(r, { leanIndex, verbTable }, 0.5, { layer3On: false });
  assert.ok(!result.evidence.some((e) => e.startsWith('corpus:')));
  assert.ok(result.evidence.some((e) => e.startsWith('verbtable:retrieve->lower:r')));
  // Layer 4 alone still clears the 0.5 threshold on its own (weight 0.8).
  assert.equal(result.class, 'r');
  assert.equal(result.status, 'assigned');
});

test('scoreRow: layer4On:false removes layer 4 (CAMARA verb table) evidence entirely, leaving layer 3 untouched, and never calls verbCountsFor', () => {
  const leanIndex = new Map([
    ['retrieve', { providers: 10, perprov_get: 8, perprov_post: 2, perprov_put: 0, perprov_patch: 0, perprov_delete: 0, perprov_head: 0, perprov_options: 0 }],
  ]);
  // A verbTable that would throw if verbCountsFor ever iterated its Map
  // (Map.get is fine — this just proves layer 4 truly never looks it up by
  // asserting the resulting evidence has no verbtable: entry).
  const verbTable = buildVerbTable([
    row({ operationId: 'retrieveThing', gt_class: 'r', repo: 'A' }),
    row({ operationId: 'retrieveThing', gt_class: 'r', repo: 'A' }),
    row({ operationId: 'retrieveThing', gt_class: 'r', repo: 'A' }),
  ]);
  const r = row({ method: 'POST', operationId: 'retrieveThing', repo: 'B' });
  const result = scoreRow(r, { leanIndex, verbTable }, 0.5, { layer4On: false });
  assert.ok(!result.evidence.some((e) => e.startsWith('verbtable:')));
  assert.ok(result.evidence.some((e) => e.startsWith('corpus:retrieve->lower:r')));
  assert.equal(result.class, 'r');
  assert.equal(result.status, 'assigned');
});

test('scoreRow: layer3On:false and layer4On:false together removes both, leaving only layers 1/2/5/6 (M1-C9 pass 1 shape)', () => {
  const leanIndex = new Map([
    ['retrieve', { providers: 10, perprov_get: 8, perprov_post: 2, perprov_put: 0, perprov_patch: 0, perprov_delete: 0, perprov_head: 0, perprov_options: 0 }],
  ]);
  const verbTable = buildVerbTable([
    row({ operationId: 'retrieveThing', gt_class: 'r', repo: 'A' }),
    row({ operationId: 'retrieveThing', gt_class: 'r', repo: 'A' }),
    row({ operationId: 'retrieveThing', gt_class: 'r', repo: 'A' }),
  ]);
  const r = row({ method: 'POST', operationId: 'retrieveThing', repo: 'B' });
  const result = scoreRow(r, { leanIndex, verbTable }, 0.75, { layer3On: false, layer4On: false });
  assert.ok(!result.evidence.some((e) => e.startsWith('corpus:')));
  assert.ok(!result.evidence.some((e) => e.startsWith('verbtable:')));
  // With both removed and no other evidence, the row falls to review at the
  // prior class (x), not r — proving the two layers really were the only
  // source of lowering evidence for this row.
  assert.equal(result.status, 'review');
  assert.equal(result.class, 'x');
  assert.equal(result.prior, 'x');
});
