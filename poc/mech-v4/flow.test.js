import { test } from 'node:test';
import assert from 'node:assert/strict';
import { classifyRow, reviewHint } from './flow.js';

test('classifyRow: a GET comes back from step 1 as r/method, on the floor', () => {
  assert.deepEqual(
    classifyRow({ method: 'GET', operationId: 'listThings', path: '/things' }),
    { class: 'r', step: 1, rule: 'method', source: 'floor', matched: [], review: 'settled' },
  );
});

test('get-action: a GET naming a one-way action is x/get-action, review tight', () => {
  const v = classifyRow({ method: 'GET', operationId: 'logout', path: '/sso/logout' });
  assert.deepEqual(v, { class: 'x', step: 2, rule: 'get-action', source: 'list', matched: ['logout'], review: 'tight' });
  assert.equal(classifyRow({ method: 'GET', operationId: 'revokeOidcSession', path: '/oauth2/sessions/logout' }).rule, 'get-action');
  assert.equal(classifyRow({ method: 'GET', operationId: 'closeTarget', path: '/devtools/json/close/{id}' }).class, 'x');
});

test('get-action: GETs without the evidence stay r/settled; a POST /logout is unchanged', () => {
  for (const [operationId, path] of [['getSecrets', '/apps/secrets'], ['getRefund', '/payments/refunds/{id}'], ['listConnectedAccounts', '/connected_accounts']]) {
    assert.deepEqual(
      classifyRow({ method: 'GET', operationId, path }),
      { class: 'r', step: 1, rule: 'method', source: 'floor', matched: [], review: 'settled' },
      path,
    );
  }
  const post = classifyRow({ method: 'POST', operationId: 'logout', path: '/logout' });
  assert.notEqual(post.rule, 'get-action');
});

test('classifyRow: a POST read verb comes back from step 1, reporting the word it read', () => {
  assert.deepEqual(
    classifyRow({ method: 'POST', operationId: 'SearchThings', path: '/things/search' }),
    { class: 'r', step: 1, rule: 'read-verb', source: 'list', matched: ['search'], review: 'loose' },
  );
});

test('classifyRow: DELETE beats every word — always x, destructive, even with a KEEP_W verb in the name', () => {
  assert.deepEqual(
    classifyRow({ method: 'DELETE', operationId: 'updateThing', path: '/things/{id}' }),
    { class: 'x', step: 2, rule: 'method-delete', source: 'floor', matched: [], destructive: true, review: 'settled' },
  );
});

test('classifyRow: an ordinary PUT with no word evidence is claimed w by step 3\'s method floor', () => {
  assert.deepEqual(
    classifyRow({ method: 'PUT', operationId: 'updateThing', path: '/things/{id}' }),
    { class: 'w', step: 3, rule: 'method-floor', source: 'floor', matched: [], review: 'loose' },
  );
});

test('classifyRow: a PUT with a CANT_UNDO verb is claimed x by step 2 before step 3 ever runs', () => {
  // "revoke" is also a REMOVES member, so this comes back destructive too.
  assert.deepEqual(
    classifyRow({ method: 'PUT', operationId: 'revokeCertificate', path: '/certs/{id}' }),
    { class: 'x', step: 2, rule: 'cant-undo-verb', source: 'list', matched: ['revoke'], destructive: true, review: 'tight' },
  );
});

test('classifyRow: a PUT setting a password is claimed x by step 2 credential-set before step 3\'s w floor', () => {
  assert.deepEqual(
    classifyRow({ method: 'PUT', operationId: 'updateUserPassword', path: '/users/{id}/password' }),
    { class: 'x', step: 2, rule: 'credential-set', source: 'list', matched: ['password'], review: 'tight' },
  );
});

test('classifyRow: a POST with a KEEP_W verb is claimed w by step 3 (step 2 has nothing to say)', () => {
  assert.deepEqual(
    classifyRow({ method: 'POST', operationId: 'restoreThing', path: '/things/{id}/restore' }),
    { class: 'w', step: 3, rule: 'modify-verb', source: 'list', matched: ['restore'], review: 'loose' },
  );
});

test('classifyRow: a POST with a CANT_UNDO verb is claimed x by step 2, not offered to step 3', () => {
  assert.deepEqual(
    classifyRow({ method: 'POST', operationId: 'cancelSubscription', path: '/subscriptions/{id}/cancel' }),
    { class: 'x', step: 2, rule: 'cant-undo-verb', source: 'list', matched: ['cancel'], review: 'tight' },
  );
});

test('classifyRow: summary fallback works through the whole ladder for both step 2 and step 3', () => {
  const twoFallback = classifyRow({
    method: 'POST', operationId: 'PostTaxCalculations', path: '/tax/calculations', summary: 'Void a tax calculation',
  });
  assert.deepEqual(twoFallback, {
    class: 'x', step: 2, rule: 'cant-undo-verb-summary', source: 'list', matched: ['void'], destructive: true, review: 'tight',
  });

  const threeFallback = classifyRow({
    method: 'POST', operationId: 'PostLists', path: '/lists', summary: 'Update a list',
  });
  assert.deepEqual(threeFallback, {
    class: 'w', step: 3, rule: 'modify-verb-summary', source: 'list', matched: ['update'], review: 'loose',
  });
});

test('classifyRow: an unclaimed POST falls to step 2\'s floor-post pile', () => {
  assert.deepEqual(
    classifyRow({ method: 'POST', operationId: 'createThing', path: '/things' }),
    { class: 'x', step: 2, rule: 'floor-post', source: 'floor', matched: [], review: 'tight' },
  );
});

test('classifyRow: no "whose" gate anywhere — a POST reaching another party with no evidence still just floors', () => {
  assert.deepEqual(
    classifyRow({ method: 'POST', operationId: 'removeUserForTeam', path: '/teams/{t}/users/{u}' }),
    { class: 'w', step: 3, rule: 'modify-verb', source: 'list', matched: ['remove'], review: 'loose' },
  );
});

test('classifyRow: a rebuilt words override reaches every step — an emptied keepW makes a POST fall through to floor-post x', () => {
  const row = { method: 'POST', operationId: 'updateThing', path: '/things/{id}' };
  assert.deepEqual(
    classifyRow(row, { keepW: new Set() }),
    { class: 'x', step: 2, rule: 'floor-post', source: 'floor', matched: [], review: 'tight' },
  );
});

test('classifyRow: passing nothing is unchanged — the same POST still claims w via KEEP_W', () => {
  assert.deepEqual(
    classifyRow({ method: 'POST', operationId: 'updateThing', path: '/things/{id}' }),
    { class: 'w', step: 3, rule: 'modify-verb', source: 'list', matched: ['update'], review: 'loose' },
  );
});

// ---- the review hint (one writer: reviewHint in flow.js) ---------------

test('reviewHint: every method x every class x floor/list/jev, and the method check is case-insensitive', () => {
  // The whole rule, restated as a table rather than as code (D133 widening):
  //   PUT/PATCH/POST + class x               -> tight
  //   PUT/PATCH/POST + class w|r             -> loose (any source)
  //   GET/HEAD/OPTIONS + r -> settled, x -> tight, w -> loose
  //   DELETE + x -> settled, w|r -> loose
  //   every other method                     -> settled
  /** @type {Array<[string, 'r'|'w'|'x', 'floor'|'list'|'jev', 'tight'|'loose'|'settled']>} */
  const table = [];
  const methods = ['GET', 'HEAD', 'OPTIONS', 'POST', 'PUT', 'PATCH', 'DELETE', ''];
  /** @type {Array<'r'|'w'|'x'>} */
  const classes = ['r', 'w', 'x'];
  /** @type {Array<'floor'|'list'|'jev'>} */
  const sources = ['floor', 'list', 'jev'];
  for (const method of methods) {
    for (const cls of classes) {
      for (const source of sources) {
        let want = /** @type {'tight'|'loose'|'settled'} */ ('settled');
        if (method === 'PUT' || method === 'PATCH' || method === 'POST') want = cls === 'x' ? 'tight' : 'loose';
        else if (['GET', 'HEAD', 'OPTIONS'].includes(method)) want = cls === 'r' ? 'settled' : cls === 'x' ? 'tight' : 'loose';
        else if (method === 'DELETE') want = cls === 'x' ? 'settled' : 'loose';
        table.push([method, cls, source, want]);
      }
    }
  }
  assert.equal(table.length, 8 * 3 * 3);

  for (const [method, cls, source, want] of table) {
    assert.equal(reviewHint(method, cls, source), want, `${method || '(no method)'} ${cls} ${source}`);
    // Same answer whatever the case, and whatever a caller passes for a
    // missing method.
    assert.equal(reviewHint(method.toLowerCase(), cls, source), want, `${method.toLowerCase()} ${cls} ${source}`);
    assert.equal(reviewHint(mixedCase(method), cls, source), want, `${mixedCase(method)} ${cls} ${source}`);
  }
  assert.equal(reviewHint(undefined, 'x', 'floor'), 'settled');
  assert.equal(reviewHint(undefined, 'w', 'floor'), 'settled');

  // The two non-settled cells actually occur in the table, so a reviewHint
  // that returned 'settled' for everything would fail this test.
  assert.equal(table.filter(([, , , w]) => w === 'tight').length, 18);
  assert.equal(table.filter(([, , , w]) => w === 'loose').length, 33);
});

/** "post" -> "PoSt", so the case-insensitivity check is not just two cases. */
function mixedCase(s) {
  return [...s].map((c, i) => (i % 2 === 0 ? c.toUpperCase() : c.toLowerCase())).join('');
}

test('reviewHint: the second pass argument decides tight/loose, and wins over method and source', () => {
  assert.equal(reviewHint('PUT', 'x', 'floor', 'undecided'), 'tight');
  assert.equal(reviewHint('GET', 'x', 'floor', 'undecided'), 'tight');
  assert.equal(reviewHint('PUT', 'x', 'floor', 'raised'), 'tight');
  assert.equal(reviewHint('GET', 'w', 'floor', 'raised'), 'loose');
  assert.equal(reviewHint('POST', 'w', 'list', 'lowered'), 'loose');
  assert.equal(reviewHint('POST', 'x', 'floor', 'lowered'), 'loose');
  assert.equal(reviewHint('GET', 'r', 'floor', undefined), 'settled');
});

test('classifyRow: the non-settled hints reach real rows through the whole ladder', () => {
  // tight: a POST that floors at x with no evidence.
  assert.equal(classifyRow({ method: 'POST', operationId: 'createThing', path: '/things' }).review, 'tight');
  // tight again: a POST claimed x by a word list.
  assert.equal(classifyRow({ method: 'post', operationId: 'cancelSubscription', path: '/s/{id}/cancel' }).review, 'tight');
  // loose: a PUT on step 3's method floor, no word either way.
  assert.equal(classifyRow({ method: 'PUT', operationId: 'putThing', path: '/things/{id}' }).review, 'loose');
  assert.equal(classifyRow({ method: 'patch', operationId: 'patchThing', path: '/things/{id}' }).review, 'loose');
  // loose (D133): a POST a word list lowered below the floor, to w and to r.
  assert.equal(classifyRow({ method: 'POST', operationId: 'updateThing', path: '/things/{id}' }).review, 'loose');
  assert.equal(classifyRow({ method: 'POST', operationId: 'searchThings', path: '/things/search' }).review, 'loose');
  // tight: a PUT claimed x by a word list (a write-method x may be too tight).
  const revoke = classifyRow({ method: 'PUT', operationId: 'revokeCertificate', path: '/certs/{id}' });
  assert.equal(revoke.source, 'list');
  assert.equal(revoke.review, 'tight');
  // settled: a DELETE x is not a POST, and a GET r is neither cell.
  assert.equal(classifyRow({ method: 'DELETE', operationId: 'deleteThing', path: '/things/{id}' }).review, 'settled');
  assert.equal(classifyRow({ method: 'GET', operationId: 'listThings', path: '/things' }).review, 'settled');
});

test('classifyRow: every row carries exactly one of the three hints', () => {
  const rows = [
    { method: 'GET', operationId: 'listThings', path: '/things' },
    { method: 'POST', operationId: 'createThing', path: '/things' },
    { method: 'POST', operationId: 'searchThings', path: '/things/search' },
    { method: 'PUT', operationId: 'putThing', path: '/things/{id}' },
    { method: 'PATCH', operationId: 'patchThing', path: '/things/{id}' },
    { method: 'DELETE', operationId: 'deleteThing', path: '/things/{id}' },
    { method: '', operationId: '', path: '/things' },
  ];
  for (const row of rows) {
    const hit = classifyRow(row);
    assert.ok(['tight', 'loose', 'settled'].includes(hit.review), `${row.method} ${row.operationId} -> ${hit.review}`);
    assert.equal(hit.review, reviewHint(row.method, hit.class, hit.source), `${row.method} ${row.operationId}`);
  }
});
