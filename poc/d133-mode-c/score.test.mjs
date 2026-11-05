import test from 'node:test';
import assert from 'node:assert/strict';
import { tally } from './score.mjs';
test('tally splits too loose (looser than truth) from too tight', () => {
  const c = tally([{ pred: 'r', truth: 'r' }, { pred: 'w', truth: 'x' }, { pred: 'x', truth: 'w' }, { pred: 'r', truth: 'x' }]);
  assert.deepEqual(c, { n: 4, exact: 1, loose: 2, tight: 1 });
});
