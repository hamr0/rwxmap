import { test } from 'node:test';
import assert from 'node:assert/strict';
import { registrableName, seededShuffle, drawBuildSet, dedupeRows } from './draw.mjs';
import { runGates } from './gates.mjs';

function row(provider, method, path, operationId) {
  return { provider, method, path, operationId, summary: '', description: '' };
}

// --- registrableName ---

test('registrableName: github.com -> github', () => {
  assert.equal(registrableName('github.com'), 'github');
});

test('registrableName: appcenter.ms -> appcenter', () => {
  assert.equal(registrableName('appcenter.ms'), 'appcenter');
});

test('registrableName: keycloak.local -> keycloak', () => {
  assert.equal(registrableName('keycloak.local'), 'keycloak');
});

test('registrableName: example.co.uk -> example (two-part suffix)', () => {
  assert.equal(registrableName('example.co.uk'), 'example');
});

test('registrableName: strips leading www. and lowercases', () => {
  assert.equal(registrableName('WWW.GitHub.com'), 'github');
});

// --- seededShuffle ---

test('seededShuffle: same seed gives same order', () => {
  const input = [1, 2, 3, 4, 5, 6, 7, 8];
  const a = seededShuffle(input, 42);
  const b = seededShuffle(input, 42);
  assert.deepEqual(a, b);
});

test('seededShuffle: different seed gives different order', () => {
  const input = [1, 2, 3, 4, 5, 6, 7, 8];
  const a = seededShuffle(input, 42);
  const b = seededShuffle(input, 43);
  assert.notDeepEqual(a, b);
});

test('seededShuffle: does not mutate the input array', () => {
  const input = [1, 2, 3, 4, 5];
  const copy = input.slice();
  seededShuffle(input, 7);
  assert.deepEqual(input, copy);
});

// --- drawBuildSet ---

test('drawBuildSet: respects a finite cap', () => {
  const rows = [];
  for (let i = 0; i < 10; i++) rows.push(row('github.com', 'POST', `/p${i}`, `op${i}`));
  const { rows: drawn, perVendor } = drawBuildSet(rows, {
    caps: { 'github.com': 3 },
    methods: ['POST'],
    seed: 1,
  });
  assert.equal(drawn.length, 3);
  assert.equal(perVendor[0].available, 10);
  assert.equal(perVendor[0].drawn, 3);
});

test('drawBuildSet: takes all rows under an Infinity cap', () => {
  const rows = [];
  for (let i = 0; i < 5; i++) rows.push(row('gitea.io', 'PUT', `/p${i}`, `op${i}`));
  const { rows: drawn } = drawBuildSet(rows, {
    caps: { 'gitea.io': Infinity },
    methods: ['PUT'],
    seed: 1,
  });
  assert.equal(drawn.length, 5);
});

test('drawBuildSet: filters out GET rows', () => {
  const rows = [row('github.com', 'GET', '/p', 'op1'), row('github.com', 'POST', '/p', 'op2')];
  const { rows: drawn } = drawBuildSet(rows, {
    caps: { 'github.com': Infinity },
    methods: ['POST', 'PUT', 'DELETE', 'PATCH'],
    seed: 1,
  });
  assert.equal(drawn.length, 1);
  assert.equal(drawn[0].method, 'POST');
});

test('drawBuildSet: filters out an unlisted vendor', () => {
  const rows = [row('github.com', 'POST', '/p', 'op1'), row('auth0', 'POST', '/p', 'op2')];
  const { rows: drawn } = drawBuildSet(rows, {
    caps: { 'github.com': Infinity },
    methods: ['POST'],
    seed: 1,
  });
  assert.equal(drawn.length, 1);
  assert.equal(drawn[0].provider, 'github.com');
});

test('drawBuildSet: deterministic across two calls', () => {
  const rows = [];
  for (let i = 0; i < 20; i++) rows.push(row('github.com', 'POST', `/p${i}`, `op${i}`));
  const a = drawBuildSet(rows, { caps: { 'github.com': 7 }, methods: ['POST'], seed: 99 });
  const b = drawBuildSet(rows, { caps: { 'github.com': 7 }, methods: ['POST'], seed: 99 });
  assert.deepEqual(a.rows, b.rows);
  assert.deepEqual(a.perVendor, b.perVendor);
});

test('drawBuildSet: perVendor counts add up', () => {
  const rows = [
    row('github.com', 'POST', '/a', 'op1'),
    row('github.com', 'PUT', '/b', 'op2'),
    row('github.com', 'DELETE', '/c', 'op3'),
    row('gitea.io', 'PATCH', '/d', 'op4'),
  ];
  const { rows: drawn, perVendor } = drawBuildSet(rows, {
    caps: { 'github.com': Infinity, 'gitea.io': Infinity },
    methods: ['POST', 'PUT', 'DELETE', 'PATCH'],
    seed: 5,
  });
  const totalDrawn = perVendor.reduce((sum, v) => sum + v.drawn, 0);
  assert.equal(totalDrawn, drawn.length);
  const github = perVendor.find((v) => v.vendor === 'github.com');
  const byMethodSum = Object.values(github.byMethod).reduce((a, b) => a + b, 0);
  assert.equal(byMethodSum, github.drawn);
  assert.equal(github.byMethod.POST, 1);
  assert.equal(github.byMethod.PUT, 1);
  assert.equal(github.byMethod.DELETE, 1);
});

// --- dedupeRows ---

test('dedupeRows: keeps first occurrence and drops later duplicates that differ only in a non-key field', () => {
  const rows = [
    { provider: 'github.com', method: 'POST', path: '/repos', operationId: 'create', description: 'variant A' },
    { provider: 'github.com', method: 'POST', path: '/repos', operationId: 'create', description: 'variant B (ghec)' },
    { provider: 'github.com', method: 'POST', path: '/repos', operationId: 'create', description: 'variant C (ghes)' },
  ];
  const out = dedupeRows(rows);
  assert.equal(out.length, 1);
  assert.equal(out[0].description, 'variant A');
});

test('dedupeRows: keys are case-insensitive on method but not on path/operationId', () => {
  const rows = [
    row('github.com', 'post', '/repos', 'create'),
    row('github.com', 'POST', '/repos', 'create'),
  ];
  const out = dedupeRows(rows);
  assert.equal(out.length, 1);
});

test('dedupeRows: distinct keys are all kept', () => {
  const rows = [
    row('github.com', 'POST', '/a', 'op1'),
    row('github.com', 'POST', '/b', 'op2'),
    row('gitea.io', 'POST', '/a', 'op1'),
  ];
  const out = dedupeRows(rows);
  assert.equal(out.length, 3);
});

test('drawBuildSet: reports dropped duplicates correctly and never returns two rows sharing the dedupe key', () => {
  const rows = [
    row('github.com', 'POST', '/repos', 'create'),
    { ...row('github.com', 'POST', '/repos', 'create'), description: 'ghec variant' },
    { ...row('github.com', 'POST', '/repos', 'create'), description: 'ghes variant' },
    row('github.com', 'POST', '/issues', 'createIssue'),
  ];
  const { rows: drawn, dropped } = drawBuildSet(rows, {
    caps: { 'github.com': Infinity },
    methods: ['POST'],
    seed: 1,
  });
  assert.equal(dropped, 2);
  assert.equal(drawn.length, 2);
  const keys = drawn.map((r) => `${r.provider}|${r.method}|${r.path}|${r.operationId}`);
  assert.equal(new Set(keys).size, keys.length);
});

// --- gates ---

const BASE_OPTS = {
  caps: { 'github.com': Infinity, 'gitea.io': Infinity },
  examVendors: ['auth0', 'cloudflare'],
  seenVendors: ['stripe', 'xero'],
  methods: ['POST', 'PUT', 'DELETE', 'PATCH'],
  giantShareBar: 0.4,
};

function passingDraw() {
  return [
    row('github.com', 'POST', '/a', 'op1'),
    row('gitea.io', 'PUT', '/b', 'op2'),
    row('gitea.io', 'DELETE', '/c', 'op3'),
    row('gitea.io', 'PATCH', '/d', 'op4'),
  ];
}

test('gates: all-pass case', () => {
  const results = runGates(passingDraw(), BASE_OPTS);
  for (const r of results) {
    assert.equal(r.pass, true, `${r.name} unexpectedly failed: ${r.detail}`);
  }
});

test('gates: GET row trips methods-only', () => {
  const drawn = [...passingDraw(), row('github.com', 'GET', '/e', 'op5')];
  const results = runGates(drawn, BASE_OPTS);
  const gate = results.find((r) => r.name === 'methods-only');
  assert.equal(gate.pass, false);
});

test('gates: a row from auth0 trips no-exam-vendor-overlap', () => {
  const drawn = [...passingDraw(), row('auth0', 'POST', '/f', 'op6')];
  const caps = { ...BASE_OPTS.caps, auth0: Infinity };
  const results = runGates(drawn, { ...BASE_OPTS, caps });
  const gate = results.find((r) => r.name === 'no-exam-vendor-overlap');
  assert.equal(gate.pass, false);
});

test('gates: a row from api.auth0.com trips no-exam-vendor-overlap via containment', () => {
  const drawn = [...passingDraw(), row('api.auth0.com', 'POST', '/f', 'op6')];
  const caps = { ...BASE_OPTS.caps, 'api.auth0.com': Infinity };
  const results = runGates(drawn, { ...BASE_OPTS, caps });
  const gate = results.find((r) => r.name === 'no-exam-vendor-overlap');
  assert.equal(gate.pass, false);
});

test('gates: a row from stripe trips no-seen-vendor-overlap', () => {
  const drawn = [...passingDraw(), row('stripe', 'POST', '/f', 'op6')];
  const caps = { ...BASE_OPTS.caps, stripe: Infinity };
  const results = runGates(drawn, { ...BASE_OPTS, caps });
  const gate = results.find((r) => r.name === 'no-seen-vendor-overlap');
  assert.equal(gate.pass, false);
});

test('gates: a duplicated row trips no-duplicate-rows', () => {
  const drawn = [...passingDraw(), row('github.com', 'POST', '/a', 'op1')];
  const results = runGates(drawn, BASE_OPTS);
  const gate = results.find((r) => r.name === 'no-duplicate-rows');
  assert.equal(gate.pass, false);
});

test('gates: a github-heavy draw trips giant-share', () => {
  const drawn = [];
  for (let i = 0; i < 9; i++) drawn.push(row('github.com', 'POST', `/g${i}`, `opg${i}`));
  drawn.push(row('gitea.io', 'POST', '/x', 'opx'));
  const results = runGates(drawn, BASE_OPTS);
  const gate = results.find((r) => r.name === 'giant-share');
  assert.equal(gate.pass, false);
});

test('gates: an unregistered vendor trips vendors-are-pre-registered', () => {
  const drawn = [...passingDraw(), row('box.com', 'POST', '/z', 'opz')];
  const results = runGates(drawn, BASE_OPTS);
  const gate = results.find((r) => r.name === 'vendors-are-pre-registered');
  assert.equal(gate.pass, false);
});

test('gates: a missing vendor trips every-vendor-present', () => {
  const drawn = [row('github.com', 'POST', '/a', 'op1')];
  const results = runGates(drawn, BASE_OPTS);
  const gate = results.find((r) => r.name === 'every-vendor-present');
  assert.equal(gate.pass, false);
});

// --- overlap gate: label-level matching, not bare substring ---

test('gates: no-exam-vendor-overlap PASSES for box.com against exam vendor dropbox', () => {
  const drawn = [...passingDraw(), row('box.com', 'POST', '/z', 'opz')];
  const caps = { ...BASE_OPTS.caps, 'box.com': Infinity };
  const results = runGates(drawn, { ...BASE_OPTS, caps, examVendors: ['dropbox', 'cloudflare'] });
  const gate = results.find((r) => r.name === 'no-exam-vendor-overlap');
  assert.equal(gate.pass, true, gate.detail);
});

test('gates: no-exam-vendor-overlap FAILS for api.auth0.com against auth0 (whole label)', () => {
  const drawn = [...passingDraw(), row('api.auth0.com', 'POST', '/f', 'op6')];
  const caps = { ...BASE_OPTS.caps, 'api.auth0.com': Infinity };
  const results = runGates(drawn, { ...BASE_OPTS, caps, examVendors: ['auth0', 'cloudflare'] });
  const gate = results.find((r) => r.name === 'no-exam-vendor-overlap');
  assert.equal(gate.pass, false);
});

test('gates: no-exam-vendor-overlap FAILS for auth0.com against auth0 (whole label)', () => {
  const drawn = [...passingDraw(), row('auth0.com', 'POST', '/f', 'op6')];
  const caps = { ...BASE_OPTS.caps, 'auth0.com': Infinity };
  const results = runGates(drawn, { ...BASE_OPTS, caps, examVendors: ['auth0', 'cloudflare'] });
  const gate = results.find((r) => r.name === 'no-exam-vendor-overlap');
  assert.equal(gate.pass, false);
});

test('gates: no-exam-vendor-overlap FAILS on raw equality', () => {
  const drawn = [...passingDraw(), row('auth0', 'POST', '/f', 'op6')];
  const caps = { ...BASE_OPTS.caps, auth0: Infinity };
  const results = runGates(drawn, { ...BASE_OPTS, caps, examVendors: ['auth0', 'cloudflare'] });
  const gate = results.find((r) => r.name === 'no-exam-vendor-overlap');
  assert.equal(gate.pass, false);
});
