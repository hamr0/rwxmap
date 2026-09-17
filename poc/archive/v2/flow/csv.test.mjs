import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseCsv, toCsv } from './csv.mjs';

test('parseCsv: plain rows keyed by header', () => {
  const res = parseCsv('a,b\n1,2\n3,4\n');
  assert.deepEqual(res, [{ a: '1', b: '2' }, { a: '3', b: '4' }]);
});

test('parseCsv: quoted field containing a comma', () => {
  const res = parseCsv('a,b\n"1,2",3\n');
  assert.deepEqual(res, [{ a: '1,2', b: '3' }]);
});

test('parseCsv: doubled quotes inside a quoted field unescape to one quote', () => {
  const res = parseCsv('a,b\n"say ""hi""",3\n');
  assert.deepEqual(res, [{ a: 'say "hi"', b: '3' }]);
});

test('parseCsv: newline inside a quoted field stays in the field', () => {
  const res = parseCsv('a,b\n"line1\nline2",3\n');
  assert.deepEqual(res, [{ a: 'line1\nline2', b: '3' }]);
});

test('parseCsv: trailing blank line from a final newline is skipped', () => {
  const res = parseCsv('a,b\n1,2\n');
  assert.equal(res.length, 1);
});

test('parseCsv: missing trailing field is filled with empty string', () => {
  const res = parseCsv('a,b,c\n1,2\n');
  assert.deepEqual(res, [{ a: '1', b: '2', c: '' }]);
});

test('parseCsv: empty text -> empty array', () => {
  assert.deepEqual(parseCsv(''), []);
});

test('toCsv: plain rows with header order', () => {
  const res = toCsv([{ a: '1', b: '2' }], ['a', 'b']);
  assert.equal(res, 'a,b\n1,2\n');
});

test('toCsv: quotes a field containing a comma', () => {
  const res = toCsv([{ a: '1,2', b: '3' }], ['a', 'b']);
  assert.equal(res, 'a,b\n"1,2",3\n');
});

test('toCsv: doubles quotes inside a field that contains a quote', () => {
  const res = toCsv([{ a: 'say "hi"', b: '3' }], ['a', 'b']);
  assert.equal(res, 'a,b\n"say ""hi""",3\n');
});

test('toCsv: quotes a field containing a newline', () => {
  const res = toCsv([{ a: 'line1\nline2', b: '3' }], ['a', 'b']);
  assert.equal(res, 'a,b\n"line1\nline2",3\n');
});

test('toCsv: missing field in a row writes empty string', () => {
  const res = toCsv([{ a: '1' }], ['a', 'b']);
  assert.equal(res, 'a,b\n1,\n');
});

test('round-trip: parseCsv(toCsv(rows)) recovers the original rows, including quote/comma/newline data', () => {
  const header = ['a', 'b'];
  const rows = [
    { a: 'plain', b: '1' },
    { a: 'has,comma', b: '2' },
    { a: 'has "quote"', b: '3' },
    { a: 'has\nnewline', b: '4' },
  ];
  const text = toCsv(rows, header);
  const parsed = parseCsv(text);
  assert.deepEqual(parsed, rows);
});
