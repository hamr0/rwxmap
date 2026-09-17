import { test } from 'node:test';
import assert from 'node:assert/strict';
import { leadVerb, arbiterVN } from './rules-vn.mjs';

function op(overrides) {
  return {
    method: 'GET',
    path: '/x',
    operationId: 'x',
    summary: '',
    description: '',
    hasCallbacks: false,
    has409: false,
    hasSink: false,
    ...overrides,
  };
}

function model(overrides) {
  return { verbMap: {}, liveNouns: [], ...overrides };
}

test('leadVerb: "Retrieves the location" -> retrieve', () => {
  assert.equal(leadVerb(op({ summary: 'Retrieves the location' })), 'retrieve');
});

test('leadVerb: "Creates a session" -> create', () => {
  assert.equal(leadVerb(op({ summary: 'Creates a session' })), 'create');
});

test('leadVerb: "** Get status" -> get', () => {
  assert.equal(leadVerb(op({ summary: '** Get status' })), 'get');
});

test('GET stays r even with a live noun and verb x', () => {
  const m = model({
    verbMap: { terminate: { class: 'x', r: 0, w: 0, x: 5 } },
    liveNouns: [{ noun: 'call', nX: 5, support: 5 }],
  });
  const r = arbiterVN(op({ method: 'GET', path: '/calls/{callId}', operationId: 'terminateCall' }), m);
  assert.equal(r.class, 'r');
  assert.equal(r.rule_id, 'V0-safe-locked');
});

test('DELETE with a live noun and verb w goes to x (V3)', () => {
  const m = model({
    verbMap: { terminate: { class: 'w', r: 0, w: 5, x: 0 } },
    liveNouns: [{ noun: 'call', nX: 5, support: 5 }],
  });
  const r = arbiterVN(op({ method: 'DELETE', path: '/calls/{callId}', operationId: 'terminateCall' }), m);
  assert.equal(r.class, 'x');
  assert.equal(r.rule_id, 'V3-live-object');
});

test('DELETE with no live noun and verb w stays w (V5)', () => {
  const m = model({
    verbMap: { terminate: { class: 'w', r: 0, w: 5, x: 0 } },
    liveNouns: [],
  });
  const r = arbiterVN(op({ method: 'DELETE', path: '/widgets/{id}', operationId: 'terminateWidget' }), m);
  assert.equal(r.class, 'w');
  assert.equal(r.rule_id, 'V5-floor');
});

test('POST with verb r and no 409 lowers to r (V4)', () => {
  const m = model({ verbMap: { retrieve: { class: 'r', r: 5, w: 0, x: 0 } } });
  const r = arbiterVN(op({ method: 'POST', summary: 'Retrieves the location' }), m);
  assert.equal(r.class, 'r');
  assert.equal(r.rule_id, 'V4-lookup');
});

test('POST with verb r but has409 keeps the floor x', () => {
  const m = model({ verbMap: { retrieve: { class: 'r', r: 5, w: 0, x: 0 } } });
  const r = arbiterVN(op({ method: 'POST', summary: 'Retrieves the location', has409: true }), m);
  assert.equal(r.class, 'x');
  assert.equal(r.rule_id, 'V5-floor');
});

test('POST with verb r but hasSink goes to x (V1)', () => {
  const m = model({ verbMap: { retrieve: { class: 'r', r: 5, w: 0, x: 0 } } });
  const r = arbiterVN(op({ method: 'POST', summary: 'Retrieves the location', hasSink: true }), m);
  assert.equal(r.class, 'x');
  assert.equal(r.rule_id, 'V1-structural');
});

test('PUT never returns r', () => {
  const m = model({ verbMap: { retrieve: { class: 'r', r: 5, w: 0, x: 0 } } });
  const r = arbiterVN(op({ method: 'PUT', summary: 'Retrieves the location' }), m);
  assert.notEqual(r.class, 'r');
});
