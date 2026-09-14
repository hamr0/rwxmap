import { test } from 'node:test';
import assert from 'node:assert/strict';
import { classifyStep2 } from './step2.mjs';

function row(overrides) {
  return { method: 'PUT', operationId: '', summary: '', description: '', path: '', vendor: 'test', gt_class: 'w', ...overrides };
}

function ctxWith(otherNouns) {
  return {
    junkSet: new Set(),
    otherNounsFor: () => (otherNouns || new Set()),
  };
}

test('classifyStep2: a PUT row with no evidence stays at the w floor', () => {
  const r = row({ summary: 'Change the widget' });
  const res = classifyStep2(r, ctxWith());
  assert.deepEqual(res, { class: 'w', rule: 'floor', floor: true });
});

test('classifyStep2: a PUT row with a live verb raises to x', () => {
  const r = row({ operationId: 'cancelBooking', summary: 'Cancel the booking' });
  const res = classifyStep2(r, ctxWith());
  assert.equal(res.class, 'x');
  assert.equal(res.rule, 'live-verb');
  assert.equal(res.floor, false);
});

test('classifyStep2: a PUT row whose noun is on the other-party list raises to x', () => {
  const r = row({ operationId: 'updateWidgetSecret', summary: 'Update something' });
  const res = classifyStep2(r, ctxWith(new Set(['secret'])));
  assert.equal(res.class, 'x');
  assert.equal(res.rule, 'other-noun');
  assert.equal(res.floor, false);
});

test('classifyStep2: live-verb wins first over other-noun', () => {
  const r = row({ operationId: 'cancelWidgetSecret', summary: 'Cancel something' });
  const res = classifyStep2(r, ctxWith(new Set(['secret'])));
  assert.equal(res.rule, 'live-verb');
});

test('classifyStep2: a PUT row whose nouns are all clean stays at the w floor', () => {
  const r = row({ operationId: 'updateWidgetSetting', summary: 'Update something' });
  const res = classifyStep2(r, ctxWith(new Set(['secret'])));
  assert.deepEqual(res, { class: 'w', rule: 'floor', floor: true });
});

test('classifyStep2: DELETE and PATCH also raise-eligible', () => {
  const del = row({ method: 'DELETE', operationId: 'terminateSession', summary: 'Terminate the session' });
  assert.equal(classifyStep2(del, ctxWith()).class, 'x');
  const patch = row({ method: 'PATCH', operationId: 'patchWidgetSecret', summary: 'Patch something' });
  assert.equal(classifyStep2(patch, ctxWith(new Set(['secret']))).class, 'x');
});

test('classifyStep2: a non-PUT/DELETE/PATCH method returns the untouched floor', () => {
  const get = row({ method: 'GET', operationId: 'cancelBooking', summary: 'Cancel the booking' });
  assert.deepEqual(classifyStep2(get, ctxWith()), { class: 'r', rule: 'floor', floor: true });

  const post = row({ method: 'POST', operationId: 'cancelBooking', summary: 'Cancel the booking' });
  assert.deepEqual(classifyStep2(post, ctxWith()), { class: 'x', rule: 'floor', floor: true });
});
