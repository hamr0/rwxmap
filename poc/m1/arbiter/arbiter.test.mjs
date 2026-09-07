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
  splitLeadToken,
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

// --- 3. Two disagreeing scopes on the same row -> raise wins ---------------
//
// CORRECTED RULE: layer 2 is now hint-vs-prior (r<w<x), so a raise can only
// come from a hint strictly above the row's prior — impossible on a
// POST/PATCH row (prior already x, the ceiling). Use a PUT row (prior w) so
// one scope hints r (below w -> lower) and another hints x (above w ->
// raise); per the corrected aggregation rule, any raise sends the row to
// class x outright (not merely "prior"), which is the whole point of the
// fix: a PUT/DELETE row can now reach x.

test('two scopes disagreeing (read-family + unknown-family) on a PUT row -> raise wins, lands at x', () => {
  const r = row({
    method: 'PUT',
    security_scopes: 'svc:res:read|svc:res:frobnicate', // 'frobnicate' is unknown -> hint x
  });
  const evidence = layer2ScopeEvidence(r, 'w');
  // both items still emitted
  assert.equal(evidence.length, 2);
  assert.ok(evidence.some((e) => e.dir === 'lower' && e.target === 'r'));
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
