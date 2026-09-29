import { test } from 'node:test';
import assert from 'node:assert/strict';

import { askJev, runJevBatch, JEV_ENDPOINT, JEV_MODEL } from './jev-client.js';

const ROW = { method: 'POST', path: '/things', operationId: 'doThing', summary: 'do a thing', description: 'does a thing' };

function jsonResponse(body, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  };
}

/** A fetch stub that always answers p for the isX/changes question. */
function fixedAnswerFetch(p, model = 'jev-1.0.0') {
  return async (url, init) => jsonResponse({ model, answers: { isX: { noul: p }, changes: { noul: p } } });
}

// ---------------------------------------------------------------------
// askJev — request shape, never a live call (bar 5 groundwork).
// ---------------------------------------------------------------------

test('askJev posts to the Jev endpoint with the key as a Bearer token and never in the body', async () => {
  let seenUrl;
  let seenHeaders;
  let seenBody;
  const fetchImpl = async (url, init) => {
    seenUrl = url;
    seenHeaders = init.headers;
    seenBody = JSON.parse(init.body);
    return jsonResponse({ model: 'jev-1.0.0', answers: { isX: { noul: 0.2 } } });
  };

  const result = await askJev(ROW, 'jev-lower', { fetchImpl, key: 'sk-test-fake-key' });

  assert.equal(seenUrl, JEV_ENDPOINT);
  assert.equal(seenHeaders.Authorization, 'Bearer sk-test-fake-key');
  assert.deepEqual(result, { p: 0.2, model: 'jev-1.0.0', usage: { input: 0, output: 0 } });

  // bar 5: only the five state fields, the model and the questions leave
  // the machine -- the key appears ONLY in the Authorization header.
  assert.deepEqual(Object.keys(seenBody).sort(), ['model', 'questions', 'state']);
  assert.deepEqual(seenBody.state, {
    method: 'POST',
    path: '/things',
    operationId: 'doThing',
    summary: 'do a thing',
    description: 'does a thing',
  });
  assert.equal(JSON.stringify(seenBody).includes('sk-test-fake-key'), false);
});

test('askJev asks the changes question for jev-raise-get and isX for the other two tiers', async () => {
  const seenKeys = [];
  const fetchImpl = async (url, init) => {
    const body = JSON.parse(init.body);
    seenKeys.push(Object.keys(body.questions)[0]);
    return jsonResponse({ model: 'jev-1.0.0', answers: { isX: { noul: 0.1 }, changes: { noul: 0.1 } } });
  };

  await askJev(ROW, 'jev-lower', { fetchImpl, key: 'k' });
  await askJev(ROW, 'jev-raise-wx', { fetchImpl, key: 'k' });
  await askJev(ROW, 'jev-raise-get', { fetchImpl, key: 'k' });

  assert.deepEqual(seenKeys, ['isX', 'isX', 'changes']);
});

test('askJev uses JEV_MODEL by default and a caller override when given', async () => {
  const seenModels = [];
  const fetchImpl = async (url, init) => {
    seenModels.push(JSON.parse(init.body).model);
    return jsonResponse({ model: 'jev-1.0.0', answers: { isX: { noul: 0.1 } } });
  };
  await askJev(ROW, 'jev-lower', { fetchImpl, key: 'k' });
  await askJev(ROW, 'jev-lower', { fetchImpl, key: 'k', model: 'jev-custom' });
  assert.deepEqual(seenModels, [JEV_MODEL, 'jev-custom']);
});

// ---------------------------------------------------------------------
// A bad answer throws (askJev is the client's own fail-closed gate,
// independent of applyJev's) -- bar 3 groundwork.
// ---------------------------------------------------------------------

/** @type {Array<[string, object]>} */
const MALFORMED_ANSWER_CASES = [
  ['missing answers object', {}],
  ['missing this tier\'s question key', { answers: { changes: { noul: 0.1 } } }],
  ['p is a string', { answers: { isX: { noul: '0.1' } } }],
  ['p is NaN', { answers: { isX: { noul: NaN } } }],
  ['p is -0.01', { answers: { isX: { noul: -0.01 } } }],
  ['p is 1.01', { answers: { isX: { noul: 1.01 } } }],
];

for (const [label, body] of MALFORMED_ANSWER_CASES) {
  test(`askJev throws on a malformed answer: ${label}`, async () => {
    const fetchImpl = async () => jsonResponse({ model: 'jev-1.0.0', ...body });
    await assert.rejects(() => askJev(ROW, 'jev-lower', { fetchImpl, key: 'k' }));
  });
}

test('askJev throws on a non-ok, non-retryable HTTP status', async () => {
  const fetchImpl = async () => jsonResponse({}, 400);
  await assert.rejects(() => askJev(ROW, 'jev-lower', { fetchImpl, key: 'k' }));
});

test('askJev throws when the response body is not valid JSON', async () => {
  const fetchImpl = async () => ({ ok: true, status: 200, json: async () => { throw new SyntaxError('bad json'); } });
  await assert.rejects(() => askJev(ROW, 'jev-lower', { fetchImpl, key: 'k' }));
});

test('askJev throws on a network error from fetch itself', async () => {
  const fetchImpl = async () => { throw new Error('ECONNRESET'); };
  await assert.rejects(() => askJev(ROW, 'jev-lower', { fetchImpl, key: 'k' }));
});

test('askJev never puts the key in a thrown error message', async () => {
  const fetchImpl = async () => { throw new Error('ECONNRESET'); };
  try {
    await askJev(ROW, 'jev-lower', { fetchImpl, key: 'sk-super-secret-fake' });
    assert.fail('expected a throw');
  } catch (err) {
    assert.equal(String(err.message).includes('sk-super-secret-fake'), false);
  }
});

// ---------------------------------------------------------------------
// Timeout -- bar 3 groundwork (a hang must not hang the run forever).
// ---------------------------------------------------------------------

test('askJev throws when the request times out', async () => {
  // AbortSignal.timeout's own internal timer is unref'd, so with nothing
  // else scheduled Node's test runner can decide the event loop has
  // drained before it fires; a ref'd keep-alive interval holds the
  // process open until the abort actually lands.
  const keepAlive = setInterval(() => {}, 5);
  const fetchImpl = async (url, init) => new Promise((resolve, reject) => {
    init.signal.addEventListener('abort', () => reject(new Error('aborted')));
  });
  try {
    // A tiny override keeps this test fast; the real default is 30s
    // (JEV_TIMEOUT_MS), never overridden by a real run.
    await assert.rejects(() => askJev(ROW, 'jev-lower', { fetchImpl, key: 'k', timeoutMs: 20 }));
  } finally {
    clearInterval(keepAlive);
  }
});

// ---------------------------------------------------------------------
// Usage — token counts ride along for cost, never decide validity.
// ---------------------------------------------------------------------

test('askJev returns the response usage as {input, output}', async () => {
  const fetchImpl = async () => jsonResponse({
    model: 'jev-1.0.0', answers: { isX: { noul: 0.2 } }, usage: { input_tokens: 812, output_tokens: 41 },
  });
  const result = await askJev(ROW, 'jev-lower', { fetchImpl, key: 'k' });
  assert.deepEqual(result, { p: 0.2, model: 'jev-1.0.0', usage: { input: 812, output: 41 } });
});

test('askJev counts a missing or non-number usage field as 0, and still accepts the answer', async () => {
  const cases = [
    [undefined, { input: 0, output: 0 }],
    [null, { input: 0, output: 0 }],
    ['lots', { input: 0, output: 0 }],
    [{ input_tokens: '812', output_tokens: 41 }, { input: 0, output: 41 }],
    [{ input_tokens: 812 }, { input: 812, output: 0 }],
    [{ input_tokens: NaN, output_tokens: Infinity }, { input: 0, output: 0 }],
  ];
  for (const [usage, expected] of cases) {
    const fetchImpl = async () => jsonResponse({ model: 'jev-1.0.0', answers: { isX: { noul: 0.2 } }, usage });
    const result = await askJev(ROW, 'jev-lower', { fetchImpl, key: 'k' });
    assert.deepEqual(result, { p: 0.2, model: 'jev-1.0.0', usage: expected }, JSON.stringify(usage));
  }
});

test('askJev: usage never rescues an unusable answer', async () => {
  const usage = { input_tokens: 812, output_tokens: 41 };
  const noAnswer = async () => jsonResponse({ model: 'jev-1.0.0', answers: {}, usage });
  const noModel = async () => jsonResponse({ answers: { isX: { noul: 0.2 } }, usage });
  await assert.rejects(() => askJev(ROW, 'jev-lower', { fetchImpl: noAnswer, key: 'k' }), /missing or malformed answer/);
  await assert.rejects(() => askJev(ROW, 'jev-lower', { fetchImpl: noModel, key: 'k' }), /no model string/);
});

// ---------------------------------------------------------------------
// Retry — 429/529 retried with backoff, everything else is not.
// ---------------------------------------------------------------------

test('askJev retries on 429 and succeeds once the server recovers', async () => {
  let calls = 0;
  const fetchImpl = async () => {
    calls += 1;
    if (calls < 3) return jsonResponse({}, 429);
    return jsonResponse({ model: 'jev-1.0.0', answers: { isX: { noul: 0.4 } } });
  };
  const t0 = Date.now();
  // retryBaseMs is tiny here to keep the test fast; the real default is
  // JEV_RETRY_BASE_MS = 500ms, doubling, capped at 16s (D118), never
  // overridden by a real run.
  const result = await askJev(ROW, 'jev-lower', { fetchImpl, key: 'k', retryBaseMs: 5 });
  assert.deepEqual(result, { p: 0.4, model: 'jev-1.0.0', usage: { input: 0, output: 0 } });
  assert.equal(calls, 3);
  // backoff: 5ms then 10ms — proves the retry actually waited (via
  // setTimeout) rather than spinning, without the real 500ms/1000ms cost.
  assert.ok(Date.now() - t0 >= 14, `expected backoff to have waited, took ${Date.now() - t0}ms`);
});

test('askJev retries on 529 the same as 429', async () => {
  let calls = 0;
  const fetchImpl = async () => {
    calls += 1;
    if (calls < 2) return jsonResponse({}, 529);
    return jsonResponse({ model: 'jev-1.0.0', answers: { isX: { noul: 0.4 } } });
  };
  const result = await askJev(ROW, 'jev-lower', { fetchImpl, key: 'k', retryBaseMs: 5 });
  assert.deepEqual(result, { p: 0.4, model: 'jev-1.0.0', usage: { input: 0, output: 0 } });
  assert.equal(calls, 2);
});

test('askJev gives up after 5 retries on a persistent 429', async () => {
  let calls = 0;
  const fetchImpl = async () => { calls += 1; return jsonResponse({}, 429); };
  await assert.rejects(() => askJev(ROW, 'jev-lower', { fetchImpl, key: 'k', retryBaseMs: 5 }));
  // one initial attempt + 5 retries = 6 calls.
  assert.equal(calls, 6);
});

test('askJev does NOT retry on a 500 (only 429/529 retry)', async () => {
  let calls = 0;
  const fetchImpl = async () => { calls += 1; return jsonResponse({}, 500); };
  await assert.rejects(() => askJev(ROW, 'jev-lower', { fetchImpl, key: 'k' }));
  assert.equal(calls, 1);
});

// ---------------------------------------------------------------------
// runJevBatch — never throws, order-preserving, concurrency-bounded.
// ---------------------------------------------------------------------

test('runJevBatch returns null for a failed row and the answer for a succeeding one, in order', async () => {
  let calls = 0;
  const fetchImpl = async () => {
    calls += 1;
    if (calls === 2) return jsonResponse({}, 400); // the second item fails
    return jsonResponse({ model: 'jev-1.0.0', answers: { isX: { noul: 0.05 } } });
  };
  const items = [
    { row: ROW, tier: 'jev-lower' },
    { row: ROW, tier: 'jev-lower' },
    { row: ROW, tier: 'jev-lower' },
  ];
  const results = await runJevBatch(items, { fetchImpl, key: 'k', concurrency: 1 });
  assert.equal(results.length, 3);
  assert.deepEqual(results[0], { p: 0.05, model: 'jev-1.0.0', usage: { input: 0, output: 0 } });
  assert.equal(results[1], null);
  assert.deepEqual(results[2], { p: 0.05, model: 'jev-1.0.0', usage: { input: 0, output: 0 } });
});

test('runJevBatch never throws even when every request fails', async () => {
  const fetchImpl = async () => { throw new Error('offline'); };
  const items = Array.from({ length: 5 }, () => ({ row: ROW, tier: 'jev-lower' }));
  const results = await runJevBatch(items, { fetchImpl, key: 'k', concurrency: 4 });
  assert.equal(results.length, 5);
  assert.ok(results.every((r) => r === null));
});

test('runJevBatch sends exactly one request per item, no more no less', async () => {
  let calls = 0;
  const fetchImpl = fixedAnswerFetch(0.05);
  const wrapped = async (url, init) => { calls += 1; return fetchImpl(url, init); };
  const items = Array.from({ length: 7 }, () => ({ row: ROW, tier: 'jev-lower' }));
  await runJevBatch(items, { fetchImpl: wrapped, key: 'k', concurrency: 4 });
  assert.equal(calls, 7);
});

test('runJevBatch respects a concurrency of 1 (fully serial, never more than one in flight)', async () => {
  let inFlight = 0;
  let maxInFlight = 0;
  const fetchImpl = async () => {
    inFlight += 1;
    maxInFlight = Math.max(maxInFlight, inFlight);
    await new Promise((r) => setTimeout(r, 5));
    inFlight -= 1;
    return jsonResponse({ model: 'jev-1.0.0', answers: { isX: { noul: 0.05 } } });
  };
  const items = Array.from({ length: 4 }, () => ({ row: ROW, tier: 'jev-lower' }));
  await runJevBatch(items, { fetchImpl, key: 'k', concurrency: 1 });
  assert.equal(maxInFlight, 1);
});

test('runJevBatch respects a concurrency of 4 (never more than 4 in flight)', async () => {
  let inFlight = 0;
  let maxInFlight = 0;
  const fetchImpl = async () => {
    inFlight += 1;
    maxInFlight = Math.max(maxInFlight, inFlight);
    await new Promise((r) => setTimeout(r, 5));
    inFlight -= 1;
    return jsonResponse({ model: 'jev-1.0.0', answers: { isX: { noul: 0.05 } } });
  };
  const items = Array.from({ length: 12 }, () => ({ row: ROW, tier: 'jev-lower' }));
  await runJevBatch(items, { fetchImpl, key: 'k', concurrency: 4 });
  assert.ok(maxInFlight <= 4, `expected at most 4 in flight, saw ${maxInFlight}`);
  assert.ok(maxInFlight >= 2, `expected some real concurrency, saw ${maxInFlight}`);
});

test('runJevBatch on an empty item list resolves to an empty array', async () => {
  const results = await runJevBatch([], { fetchImpl: fixedAnswerFetch(0.1), key: 'k' });
  assert.deepEqual(results, []);
});
