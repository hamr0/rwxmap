import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { loadLexicon, arbiterLex } from './rules-lex.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const LEXICON_V2_PATH = path.join(HERE, 'lexicon-v2.json');

function op(overrides) {
  return {
    method: 'GET',
    path: '/x',
    operationId: 'x',
    summary: '',
    description: '',
    infoDescription: '',
    opBlockText: '',
    fileText: '',
    hasCallbacks: false,
    has409: false,
    hasSink: false,
    ...overrides,
  };
}

function model(overrides) {
  return { verbMap: {}, ...overrides };
}

const lexicon = loadLexicon();

function stemRe(compiled, stem) {
  const found = compiled.find((c) => c.stem === stem);
  assert.ok(found, `no compiled entry for stem ${stem}`);
  return found.re;
}

test('stem "access" matches "accesses"', () => {
  assert.equal(stemRe(lexicon.nounRe, 'access').test('accesses'), true);
});

test('stem "terminat" matches "Terminates" (case-insensitive)', () => {
  assert.equal(stemRe(lexicon.verbRe, 'terminat').test('Terminates'), true);
});

test('stem "access" does not match inside "success" (no word boundary)', () => {
  assert.equal(stemRe(lexicon.nounRe, 'access').test('success'), false);
});

test('GET is always r even with "terminate" in text (L0-safe-locked)', () => {
  const r = arbiterLex(
    op({ method: 'GET', summary: 'Terminate now' }),
    model(),
    lexicon,
    'op'
  );
  assert.equal(r.class, 'r');
  assert.equal(r.rule_id, 'L0-safe-locked');
});

test('DELETE "Delete a draft invoice", no lexicon hit -> w L5-floor', () => {
  const r = arbiterLex(
    op({
      method: 'DELETE',
      path: '/invoices/{invoiceId}',
      operationId: 'deleteInvoice',
      summary: 'Delete a draft invoice',
    }),
    model(),
    lexicon,
    'op'
  );
  assert.equal(r.class, 'w');
  assert.equal(r.rule_id, 'L5-floor');
});

test('DELETE "Terminate an active call" -> x L2 at scope op', () => {
  const r = arbiterLex(
    op({
      method: 'DELETE',
      path: '/calls/{callId}',
      operationId: 'terminateCall',
      summary: 'Terminate an active call',
    }),
    model(),
    lexicon,
    'op'
  );
  assert.equal(r.class, 'x');
  assert.equal(r.rule_id, 'L2-danger-verb');
});

test('DELETE "Delete an access" -> x L3-live-noun via path noun "access", high confidence (verb delete->w)', () => {
  const m = model({ verbMap: { delete: { class: 'w' }, get: { class: 'r' } } });
  const r = arbiterLex(
    op({
      method: 'DELETE',
      path: '/accesses/{accessId}',
      operationId: 'deleteAccess',
      summary: 'Delete an access',
      infoDescription: 'removal of the permission for all devices',
    }),
    m,
    lexicon,
    'op'
  );
  assert.equal(r.class, 'x');
  assert.equal(r.rule_id, 'L3-live-noun');
  assert.equal(r.confidence, 'high');
});

test('POST "Get the current roaming status", no hit, no 409 -> r L4-lookup', () => {
  const m = model({ verbMap: { delete: { class: 'w' }, get: { class: 'r' } } });
  const r = arbiterLex(
    op({
      method: 'POST',
      path: '/roaming/status',
      operationId: 'getRoamingStatus',
      summary: 'Get the current roaming status',
    }),
    m,
    lexicon,
    'op'
  );
  assert.equal(r.class, 'r');
  assert.equal(r.rule_id, 'L4-lookup');
});

test('POST "Get an answer" with description "may invoke tools" -> x L2 (invok), even though verb reads r', () => {
  const m = model({ verbMap: { delete: { class: 'w' }, get: { class: 'r' } } });
  const r = arbiterLex(
    op({
      method: 'POST',
      path: '/answers',
      operationId: 'getAnswer',
      summary: 'Get an answer',
      description: 'This endpoint may invoke tools to compute the answer.',
    }),
    m,
    lexicon,
    'op'
  );
  assert.equal(r.class, 'x');
  assert.equal(r.rule_id, 'L2-danger-verb');
});

// --- E10-E13 opts (lexicon-v2, nounSource, readVerbs, nonSafeFloor) ---

test('lexicon-v2 whole-word "block" does not match "Blockchain" but matches "unblock"', () => {
  const lexV2 = loadLexicon(LEXICON_V2_PATH);
  const found = lexV2.verbRe.find((c) => c.stem === 'block');
  assert.ok(found, 'no compiled entry for stem block');
  assert.equal(found.re.test('Blockchain'), false);
  assert.equal(found.re.test('unblock'), true);
});

test("readVerbs 'hand': POST \"Verifies the OTP\" is NOT lowered (L5-floor, x)", () => {
  const r = arbiterLex(
    op({
      method: 'POST',
      path: '/otp/verify',
      operationId: 'verifyOtp',
      summary: 'Verifies the OTP',
    }),
    model(),
    lexicon,
    'op',
    { readVerbs: 'hand' }
  );
  assert.equal(r.class, 'x');
  assert.equal(r.rule_id, 'L5-floor');
});

test("nounSource 'path': POST \"Retrieve sessions by device\" at /retrieve-sessions -> r under L4 (prose noun ignored, lead verb read)", () => {
  const m = model({ verbMap: { retrieve: { class: 'r' } } });
  const r = arbiterLex(
    op({
      method: 'POST',
      path: '/retrieve-sessions',
      operationId: 'retrieveSessions',
      summary: 'Retrieve sessions by device',
    }),
    m,
    lexicon,
    'op',
    { nounSource: 'path' }
  );
  assert.equal(r.class, 'r');
  assert.equal(r.rule_id, 'L4-lookup');
});

test("nonSafeFloor 'x': DELETE \"Delete a draft\" -> x (L5-floor-x)", () => {
  const r = arbiterLex(
    op({
      method: 'DELETE',
      path: '/drafts/{draftId}',
      operationId: 'deleteDraft',
      summary: 'Delete a draft',
    }),
    model(),
    lexicon,
    'op',
    { nonSafeFloor: 'x' }
  );
  assert.equal(r.class, 'x');
  assert.equal(r.rule_id, 'L5-floor-x');
});
