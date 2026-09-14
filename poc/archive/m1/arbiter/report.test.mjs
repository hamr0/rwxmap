import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatReport } from './report.mjs';
import { classify as classifyC15 } from './c15.mjs';

function row(overrides) {
  return {
    set: 'demo',
    repo: 'DemoAPI',
    path: '/x',
    method: 'GET',
    operationId: 'doThing',
    summary: '',
    description: '',
    ...overrides,
  };
}

function classify(row) {
  return classifyC15(row, {});
}

const SAMPLE_ROWS = [
  row({ method: 'GET', path: '/widgets', operationId: 'listWidgets', summary: 'List widgets' }),
  row({ method: 'POST', path: '/widgets', operationId: 'createWidget', summary: 'Create a widget' }),
  row({ method: 'PUT', path: '/widgets/{id}', operationId: 'updateWidget', summary: 'Update a widget' }),
  row({ method: 'DELETE', path: '/widgets/{id}', operationId: 'terminateWidget', summary: 'Terminate a widget' }),
  row({ method: 'PATCH', path: '/widgets/{id}', operationId: 'patchWidget', summary: 'Patch a widget' }),
];

test('the three class counts add up to the total row count', () => {
  const report = formatReport(SAMPLE_ROWS, classify, { name: 'Demo API' });
  const rMatch = report.match(/r: (\d+)/);
  const wMatch = report.match(/w: (\d+)/);
  const xMatch = report.match(/x: (\d+)/);
  assert.ok(rMatch && wMatch && xMatch);
  const sum = Number(rMatch[1]) + Number(wMatch[1]) + Number(xMatch[1]);
  assert.equal(sum, SAMPLE_ROWS.length);
});

test('the review list contains only PUT/DELETE/PATCH floor rows', () => {
  // updateWidget (PUT) has no live-verb/party-noun hit, floors to w.
  // patchWidget (PATCH) also floors.
  // terminateWidget (DELETE) raises via live-verb — evidence, not floor —
  // so it must NOT appear in the review list.
  const report = formatReport(SAMPLE_ROWS, classify, { name: 'Demo API' });
  assert.ok(report.includes('PUT /widgets/{id} updateWidget'));
  assert.ok(report.includes('PATCH /widgets/{id} patchWidget'));
  assert.ok(!report.includes('terminateWidget'));
  // GET/POST never appear in the review list even though listWidgets/
  // createWidget are also floor:true.
  assert.ok(!report.includes('listWidgets'));
  assert.ok(!report.includes('createWidget'));
});

test('the review list caps at 20 rows and reports how many more there are', () => {
  const manyRows = [];
  for (let i = 0; i < 25; i += 1) {
    manyRows.push(row({
      method: 'DELETE',
      path: `/things/${i}`,
      operationId: `deleteThing${i}`,
      summary: 'Delete an obscure thing',
    }));
  }
  const report = formatReport(manyRows, classify, { name: 'Big API' });
  const shownCount = (report.match(/DELETE \/things\//g) || []).length;
  assert.equal(shownCount, 20);
  assert.ok(report.includes('... and 5 more'));
});

test('output contains no leak/accuracy wording', () => {
  const report = formatReport(SAMPLE_ROWS, classify, { name: 'Demo API' });
  const lower = report.toLowerCase();
  assert.ok(!lower.includes('leak'));
  assert.ok(!lower.includes('accuracy'));
  assert.ok(!lower.includes('over-tight'));
  assert.ok(!lower.includes('overtight'));
  assert.ok(!lower.includes('exact'));
});

test('an empty row set produces a report with zero counts, no crash', () => {
  const report = formatReport([], classify, { name: 'Empty API' });
  assert.ok(report.includes('0 operations'));
  assert.ok(report.includes('(none'));
});
