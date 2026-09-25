import { test } from 'node:test';
import assert from 'node:assert/strict';
import { classifyRow, reviewHint } from './flow.js';

test('classifyRow: a GET comes back from step 1 as r/method, on the floor', () => {
  assert.deepEqual(
    classifyRow({ method: 'GET', operationId: 'listThings', path: '/things' }),
    { class: 'r', step: 1, rule: 'method', source: 'floor', matched: [], review: 'settled' },
  );
});

test('classifyRow: a POST read verb comes back from step 1, reporting the word it read', () => {
  assert.deepEqual(
    classifyRow({ method: 'POST', operationId: 'SearchThings', path: '/things/search' }),
    { class: 'r', step: 1, rule: 'read-verb', source: 'list', matched: ['search'], review: 'settled' },
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
    { class: 'x', step: 2, rule: 'cant-undo-verb', source: 'list', matched: ['revoke'], destructive: true, review: 'settled' },
  );
});

test('classifyRow: a POST with a KEEP_W verb is claimed w by step 3 (step 2 has nothing to say)', () => {
  assert.deepEqual(
    classifyRow({ method: 'POST', operationId: 'restoreThing', path: '/things/{id}/restore' }),
    { class: 'w', step: 3, rule: 'modify-verb', source: 'list', matched: ['restore'], review: 'settled' },
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
    class: 'w', step: 3, rule: 'modify-verb-summary', source: 'list', matched: ['update'], review: 'settled',
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
    { class: 'w', step: 3, rule: 'modify-verb', source: 'list', matched: ['remove'], review: 'settled' },
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
    { class: 'w', step: 3, rule: 'modify-verb', source: 'list', matched: ['update'], review: 'settled' },
  );
});

// ---- the review hint (one writer: reviewHint in flow.js) ---------------

test('reviewHint: every method x every class x floor/list/jev, and the method check is case-insensitive', () => {
  // The whole rule, restated as a table rather than as code: only two cells
  // are anything but 'settled'.
  //   class x + POST                         -> tight
  //   class w + PUT/PATCH + source 'floor'   -> loose
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
        if (cls === 'x' && method === 'POST') want = 'tight';
        else if (cls === 'w' && (method === 'PUT' || method === 'PATCH') && source === 'floor') want = 'loose';
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
  assert.equal(table.filter(([, , , w]) => w === 'tight').length, 3);
  assert.equal(table.filter(([, , , w]) => w === 'loose').length, 2);
});

/** "post" -> "PoSt", so the case-insensitivity check is not just two cases. */
function mixedCase(s) {
  return [...s].map((c, i) => (i % 2 === 0 ? c.toUpperCase() : c.toLowerCase())).join('');
}

test('classifyRow: the two non-settled hints reach real rows through the whole ladder', () => {
  // tight: a POST that floors at x with no evidence.
  assert.equal(classifyRow({ method: 'POST', operationId: 'createThing', path: '/things' }).review, 'tight');
  // tight again: a POST claimed x by a word list.
  assert.equal(classifyRow({ method: 'post', operationId: 'cancelSubscription', path: '/s/{id}/cancel' }).review, 'tight');
  // loose: a PUT on step 3's method floor, no word either way.
  assert.equal(classifyRow({ method: 'PUT', operationId: 'putThing', path: '/things/{id}' }).review, 'loose');
  assert.equal(classifyRow({ method: 'patch', operationId: 'patchThing', path: '/things/{id}' }).review, 'loose');
  // settled: a PUT claimed x by a word list is not a POST, so no 'tight',
  // and not a w, so no 'loose'.
  const revoke = classifyRow({ method: 'PUT', operationId: 'revokeCertificate', path: '/certs/{id}' });
  assert.equal(revoke.source, 'list');
  assert.equal(revoke.review, 'settled');
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
