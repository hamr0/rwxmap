import { test } from 'node:test';
import assert from 'node:assert/strict';
import { applyGoal1 } from './goal1.mjs';

function row(overrides) {
  return { method: 'GET', operationId: '', summary: '', description: '', path: '', vendor: 'test', gt_class: 'r', ...overrides };
}

const ctx = { junkSet: new Set(), allowlistFor: () => new Set() };

test('applyGoal1: pass-through on an x-floor-rule row', () => {
  const prev = { class: 'x', rule: 'floor', floor: true };
  const r = row({ method: 'POST', operationId: 'createSession' });
  assert.deepEqual(applyGoal1(prev, r, ctx), prev);
});

test('applyGoal1: pass-through on a w-floor row', () => {
  const prev = { class: 'w', rule: 'floor', floor: true };
  const r = row({ method: 'PUT', operationId: 'updateDeviceStatus' });
  assert.deepEqual(applyGoal1(prev, r, ctx), prev);
});

test('applyGoal1: pass-through on an x-from-goal2 row', () => {
  const prev = { class: 'x', rule: 'no-own-noun', floor: false };
  const r = row({ method: 'PUT', operationId: 'updateAccountBillingAddress' });
  assert.deepEqual(applyGoal1(prev, r, ctx), prev);
});
