import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { loadLexicon } from './rules-lex.mjs';
import { joinAndScore } from './run-holdout.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const LEXICON_V2_PATH = path.join(HERE, 'lexicon-v2.json');

function op(overrides) {
  return {
    repo: 'twilio', method: 'DELETE', path: '/x/{Sid}', operationId: 'DeleteX',
    summary: '', description: '',
    hasCallbacks: false, has409: false, hasSink: false,
    opBlockText: '', infoDescription: '', fileText: '',
    ...overrides,
  };
}

function gt(overrides) {
  return { repo: 'twilio', path: '/x/{Sid}', method: 'DELETE', operationId: 'DeleteX', gt_class: 'x', doubt: '', reason: '', ...overrides };
}

const model = { verbMap: {} };

test('joining skips rows with an empty gt_class, counting them unruled', () => {
  const ops = [
    op({ path: '/a', operationId: 'DeleteA' }),
    op({ path: '/b', operationId: 'DeleteB' }),
  ];
  const gtRows = [
    gt({ path: '/a', operationId: 'DeleteA', gt_class: 'w' }),
    gt({ path: '/b', operationId: 'DeleteB', gt_class: '' }),
  ];
  const lexicon = loadLexicon();
  const { scored, unruled, unjoined } = joinAndScore(ops, gtRows, model, lexicon);
  assert.equal(scored.length, 1);
  assert.equal(scored[0].path, '/a');
  assert.equal(unruled, 1);
  assert.equal(unjoined, 0);
});

test('Twilio-like "Kick a participant from a given conference" (truth x) scores x via L2-danger-verb under lexicon-v2', () => {
  const ops = [op({
    path: '/2010-04-01/Accounts/{AccountSid}/Conferences/{ConferenceSid}/Participants/{CallSid}.json',
    operationId: 'DeleteParticipant',
    summary: 'Kick a participant from a given conference',
    description: 'Kick a participant from a given conference',
  })];
  const gtRows = [gt({
    path: '/2010-04-01/Accounts/{AccountSid}/Conferences/{ConferenceSid}/Participants/{CallSid}.json',
    operationId: 'DeleteParticipant',
    gt_class: 'x',
  })];
  const lexicon = loadLexicon(LEXICON_V2_PATH);
  const { scored } = joinAndScore(ops, gtRows, model, lexicon);
  assert.equal(scored.length, 1);
  assert.equal(scored[0].class, 'x');
  assert.equal(scored[0].rule_id, 'L2-danger-verb');
  assert.equal(scored[0].direction, 'agree');
});

test('Stripe-like "Delete a draft invoice" (truth w) scores w via L5-floor', () => {
  const ops = [op({
    repo: 'stripe', path: '/v1/invoices/{invoice}', operationId: 'DeleteInvoicesInvoice',
    summary: 'Delete a draft invoice',
  })];
  const gtRows = [gt({ repo: 'stripe', path: '/v1/invoices/{invoice}', operationId: 'DeleteInvoicesInvoice', gt_class: 'w' })];
  const lexicon = loadLexicon();
  const { scored } = joinAndScore(ops, gtRows, model, lexicon);
  assert.equal(scored.length, 1);
  assert.equal(scored[0].class, 'w');
  assert.equal(scored[0].rule_id, 'L5-floor');
  assert.equal(scored[0].direction, 'agree');
});
