import { test } from 'node:test';
import assert from 'node:assert/strict';
import { operationsFrom, exportGate, exportSidecar } from './exporter.js';

// ---- operationsFrom -----------------------------------------------------

test('operationsFrom: takes only real HTTP methods, skipping every other path-item field', () => {
  const spec = {
    paths: {
      '/things': {
        // not operations — none of these may become a row
        parameters: [{ name: 'page', in: 'query' }],
        $ref: '#/components/pathItems/things',
        summary: 'Things',
        description: 'The things collection.',
        servers: [{ url: 'https://example.test' }],
        'x-internal': true,
        get: { operationId: 'listThings', summary: 'List things' },
        post: { operationId: 'createThing' },
      },
    },
  };
  assert.deepEqual(operationsFrom(spec), [
    { method: 'GET', path: '/things', operationId: 'listThings', summary: 'List things' },
    { method: 'POST', path: '/things', operationId: 'createThing' },
  ]);
});

test('operationsFrom: a missing operationId stays missing — the key builder owns the fallback', () => {
  const [row] = operationsFrom({ paths: { '/things/{id}': { delete: { summary: 'Remove it' } } } });
  assert.equal('operationId' in row, false);
  assert.deepEqual(row, { method: 'DELETE', path: '/things/{id}', summary: 'Remove it' });
});

test('operationsFrom: returns [] for a missing, null or non-object paths', () => {
  assert.deepEqual(operationsFrom({}), []);
  assert.deepEqual(operationsFrom({ paths: null }), []);
  assert.deepEqual(operationsFrom({ paths: 'nope' }), []);
  assert.deepEqual(operationsFrom(null), []);
  assert.deepEqual(operationsFrom(undefined), []);
});

test('operationsFrom: uppercases the method and carries description through for the Jev tier', () => {
  const rows = operationsFrom({ paths: { '/a': { PATCH: { operationId: 'a', description: 'why' } } } });
  assert.deepEqual(rows, [{ method: 'PATCH', path: '/a', operationId: 'a', description: 'why' }]);
});

// ---- vendor is required -------------------------------------------------

test('exportGate and exportSidecar both throw without a vendor', () => {
  const ops = [{ method: 'GET', path: '/a', operationId: 'a' }];
  assert.throws(() => exportGate(ops, {}), /vendor is required/);
  assert.throws(() => exportGate(ops, { vendor: '' }), /vendor is required/);
  assert.throws(() => exportGate(ops, { vendor: '   ' }), /vendor is required/);
  assert.throws(() => exportGate(ops), /vendor is required/);
  assert.throws(() => exportSidecar(ops, {}), /vendor is required/);
});

// ---- the two legal forms (D103) ----------------------------------------

test('exportGate: object form is the default and carries letter + marker', () => {
  const { tools } = exportGate([
    { method: 'GET', path: '/things', operationId: 'listThings' },
    { method: 'PUT', path: '/things/{id}', operationId: 'putThing' },
    { method: 'POST', path: '/things', operationId: 'createThing' },
  ], { vendor: 'acme' });

  assert.deepEqual(tools, {
    'acme.listThings': { letter: 'r', marker: 'settled' },
    'acme.putThing': { letter: 'w', marker: 'loose' },
    'acme.createThing': { letter: 'x', marker: 'tight' },
  });
});

test('exportGate: letter form emits the bare letter, which stays legal forever', () => {
  const ops = [
    { method: 'GET', path: '/things', operationId: 'listThings' },
    { method: 'PUT', path: '/things/{id}', operationId: 'putThing' },
    { method: 'DELETE', path: '/things/{id}', operationId: 'deleteThing' },
  ];
  assert.deepEqual(exportGate(ops, { vendor: 'acme', form: 'letter' }).tools, {
    'acme.listThings': 'r',
    'acme.putThing': 'w',
    'acme.deleteThing': 'x',
  });
});

test('exportGate: an unknown form is a caller error, not a silent default', () => {
  // Cast: the typo is the point of the test, and a plain JS caller (which
  // is who this guard protects) has no type to stop them writing it.
  const bad = /** @type {'object'|'letter'} */ (/** @type {unknown} */ ('letters'));
  assert.throws(
    () => exportGate([], { vendor: 'acme', form: bad }),
    /must be 'object' or 'letter'/,
  );
});

// ---- the key and its fallback chain ------------------------------------

test('exportGate: keys are <vendor>.<operationId>, dot-separated, no namespacing', () => {
  const { tools } = exportGate([{ method: 'GET', path: '/a', operationId: 'users/list' }], { vendor: 'github' });
  assert.deepEqual(Object.keys(tools), ['github.users/list']);
});

test('exportGate: no operationId falls back to the last path segment, braces stripped', () => {
  const { tools } = exportGate([
    { method: 'GET', path: '/v1/users/settings' },
    { method: 'PUT', path: '/v1/users/{userId}' },
    { method: 'GET', path: '/v1/things/', operationId: '   ' },
  ], { vendor: 'acme' });

  assert.deepEqual(Object.keys(tools).sort(), ['acme.settings', 'acme.things', 'acme.userId']);
});

test('exportGate: an empty path falls the whole way through to the lowercased method', () => {
  const { tools } = exportGate([
    { method: 'GET', path: '/' },
    { method: 'POST', path: '' },
  ], { vendor: 'acme' });
  assert.deepEqual(Object.keys(tools).sort(), ['acme.get', 'acme.post']);
});

// ---- collisions ---------------------------------------------------------

test('exportGate: on a collision the TIGHTER letter wins and the collision is reported', () => {
  // Both fall back to the `{id}` path segment, so both land on `acme.id`.
  const { tools, collisions } = exportGate([
    { method: 'GET', path: '/things/{id}' },
    { method: 'DELETE', path: '/things/{id}' },
  ], { vendor: 'acme' });

  assert.deepEqual(tools, { 'acme.id': { letter: 'x', marker: 'settled' } });
  assert.equal(collisions.length, 1);
  assert.deepEqual(collisions[0], {
    key: 'acme.id',
    existing: { method: 'GET', path: '/things/{id}', letter: 'r' },
    incoming: { method: 'DELETE', path: '/things/{id}', letter: 'x' },
    keptLetter: 'x',
  });
});

test('exportGate: a collision NEVER loosens a key that is already there', () => {
  const { tools, collisions } = exportGate([
    { method: 'DELETE', path: '/things/{id}' },
    { method: 'GET', path: '/things/{id}' },
  ], { vendor: 'acme' });

  // The GET arrived second and is looser; the x must stand.
  assert.deepEqual(tools, { 'acme.id': { letter: 'x', marker: 'settled' } });
  assert.deepEqual(collisions[0], {
    key: 'acme.id',
    existing: { method: 'DELETE', path: '/things/{id}', letter: 'x' },
    incoming: { method: 'GET', path: '/things/{id}', letter: 'r' },
    keptLetter: 'x',
  });
});

test('exportGate: equal letters keep the first, and the collision still gets reported', () => {
  const { tools, collisions } = exportGate([
    { method: 'PUT', path: '/things/{id}' },
    { method: 'PATCH', path: '/things/{id}' },
  ], { vendor: 'acme' });

  assert.deepEqual(tools, { 'acme.id': { letter: 'w', marker: 'loose' } });
  assert.equal(collisions.length, 1);
  assert.equal(collisions[0].keptLetter, 'w');
  assert.equal(collisions[0].existing.method, 'PUT');
  assert.equal(collisions[0].incoming.method, 'PATCH');
});

test('exportGate: a three-way collision reports the CURRENT holder, not the first row seen', () => {
  const { tools, collisions } = exportGate([
    { method: 'GET', path: '/things/{id}' },     // r, places the key
    { method: 'PUT', path: '/things/{id}' },     // w, takes it
    { method: 'DELETE', path: '/things/{id}' },  // x, takes it
  ], { vendor: 'acme' });

  assert.deepEqual(tools, { 'acme.id': { letter: 'x', marker: 'settled' } });
  assert.equal(collisions.length, 2);
  assert.deepEqual(collisions[0].existing, { method: 'GET', path: '/things/{id}', letter: 'r' });
  // The second collision's `existing` must be the PUT that now holds the
  // key — reading the first matching row instead would report the GET.
  assert.deepEqual(collisions[1].existing, { method: 'PUT', path: '/things/{id}', letter: 'w' });
});

// ---- D103: the exporter emits EVERY row --------------------------------

// A dedicated corpus of the rows D91's dead policy used to omit, plus the
// obvious r/w/x rows around them.
const NO_OMISSION_OPS = [
  { method: 'GET', path: '/things', operationId: 'listThings' },
  { method: 'PUT', path: '/things/{id}', operationId: 'putThing' },      // floor PUT — omitted under D91
  { method: 'PATCH', path: '/things/{id}', operationId: 'patchThing' },  // floor PATCH — omitted under D91
  { method: 'POST', path: '/things', operationId: 'createThing' },
  { method: 'DELETE', path: '/things/{id}', operationId: 'deleteThing' },
  { method: 'POST', path: '/things/{id}/rename', operationId: 'renameThing' },
];

test('D103: every input row reaches the gate — a floor PUT and a floor PATCH included', () => {
  const { tools } = exportGate(NO_OMISSION_OPS, { vendor: 'acme' });

  // Would FAIL the moment anyone reintroduces row omission for any reason.
  assert.equal(Object.keys(tools).length, NO_OMISSION_OPS.length);
  for (const op of NO_OMISSION_OPS) {
    assert.ok(`acme.${op.operationId}` in tools, `missing from the gate: ${op.operationId}`);
  }

  // And specifically the two the dead policy used to drop, with the marker
  // that now says what the omission used to say.
  assert.deepEqual(tools['acme.putThing'], { letter: 'w', marker: 'loose' });
  assert.deepEqual(tools['acme.patchThing'], { letter: 'w', marker: 'loose' });
});

test('D103: every input row reaches the sidecar too', () => {
  const sidecar = exportSidecar(NO_OMISSION_OPS, { vendor: 'acme' });
  assert.equal(sidecar.rows.length, NO_OMISSION_OPS.length);
  assert.deepEqual(
    sidecar.rows.map((r) => r.key),
    NO_OMISSION_OPS.map((op) => `acme.${op.operationId}`),
  );
});

test('D103: even a collision drops no sidecar row — the row count always equals the input count', () => {
  const ops = [
    { method: 'GET', path: '/things/{id}' },
    { method: 'PUT', path: '/things/{id}' },
    { method: 'DELETE', path: '/things/{id}' },
  ];
  const sidecar = exportSidecar(ops, { vendor: 'acme' });
  assert.equal(sidecar.rows.length, 3);
  // Only the gate collapses to one key; the sidecar still shows all three.
  assert.equal(Object.keys(exportGate(ops, { vendor: 'acme' }).tools).length, 1);
});

// ---- what the gate must NEVER contain ----------------------------------

test('exportGate: never emits `flags`, `agents`, `evidence` or `destructive`', () => {
  const result = exportGate(NO_OMISSION_OPS, { vendor: 'acme' });

  assert.deepEqual(Object.keys(result).sort(), ['collisions', 'tools']);
  for (const forbidden of ['flags', 'agents', 'evidence', 'destructive']) {
    assert.equal(forbidden in result, false, `exportGate returned a ${forbidden} key`);
    assert.equal(forbidden in result.tools, false, `the tools map contains a ${forbidden} key`);
  }
  // Nothing beyond letter and marker may ride on a tool entry.
  for (const entry of Object.values(result.tools)) {
    assert.deepEqual(Object.keys(entry).sort(), ['letter', 'marker']);
  }
  // Belt and braces: the serialised gate mentions none of those words.
  const json = JSON.stringify(result.tools);
  for (const forbidden of ['flags', 'agents', 'evidence', 'destructive']) {
    assert.equal(json.includes(forbidden), false, `${forbidden} appears in the serialised gate`);
  }
});

// ---- the sidecar --------------------------------------------------------

test('exportSidecar: every count grouping sums to the row count', () => {
  const sidecar = exportSidecar(NO_OMISSION_OPS, { vendor: 'acme' });
  const sum = (o) => Object.values(o).reduce((a, b) => a + b, 0);

  assert.equal(sidecar.counts.rows, NO_OMISSION_OPS.length);
  assert.equal(sum(sidecar.counts.byLetter), sidecar.counts.rows);
  assert.equal(sum(sidecar.counts.byMarker), sidecar.counts.rows);
  assert.equal(sum(sidecar.counts.byEvidence), sidecar.counts.rows);
});

test('exportSidecar: a row carries the two fields the gate is not allowed to have', () => {
  const sidecar = exportSidecar([{ method: 'DELETE', path: '/things/{id}', operationId: 'deleteThing' }], { vendor: 'acme' });
  assert.deepEqual(sidecar.rows[0], {
    key: 'acme.deleteThing',
    method: 'DELETE',
    path: '/things/{id}',
    letter: 'x',
    marker: 'settled',
    evidence: 'floor',
    destructive: true,
  });
  assert.equal(sidecar.vendor, 'acme');
});

test('exportSidecar: `destructive` is always a real boolean, never an absent field', () => {
  const sidecar = exportSidecar([{ method: 'GET', path: '/things', operationId: 'listThings' }], { vendor: 'acme' });
  assert.equal(sidecar.rows[0].destructive, false);
});

test('exportSidecar: the review list puts loose before tight, and leaves settled out', () => {
  const sidecar = exportSidecar(NO_OMISSION_OPS, { vendor: 'acme' });
  const markers = sidecar.review.map((r) => r.marker);

  assert.equal(markers.includes('settled'), false);
  assert.deepEqual(markers, [...markers].sort((a, b) => (a === b ? 0 : a === 'loose' ? -1 : 1)));
  assert.equal(markers[0], 'loose');
  assert.equal(sidecar.review.length, sidecar.counts.byMarker.loose + sidecar.counts.byMarker.tight);
});

test('exportSidecar: destructiveSuggestions carries a note saying it is a suggestion, never config', () => {
  const sidecar = exportSidecar(NO_OMISSION_OPS, { vendor: 'acme' });
  const { note, rows } = sidecar.destructiveSuggestions;

  assert.equal(typeof note, 'string');
  assert.ok(note.length > 0);
  assert.match(note, /SUGGESTION/i);
  assert.match(note, /not config|never as config|NOT CONFIG/i);
  assert.match(note, /rwxmap does not write bareguard deny rules/i);
  assert.ok(rows.every((r) => r.destructive === true));
  assert.deepEqual(rows.map((r) => r.key), ['acme.deleteThing']);
});

test('exportSidecar: collisions reach the human too, identically to the gate', () => {
  const ops = [
    { method: 'GET', path: '/things/{id}' },
    { method: 'DELETE', path: '/things/{id}' },
  ];
  assert.deepEqual(
    exportSidecar(ops, { vendor: 'acme' }).collisions,
    exportGate(ops, { vendor: 'acme' }).collisions,
  );
});

test('exportSidecar: an empty operation list is a valid, empty report', () => {
  const sidecar = exportSidecar([], { vendor: 'acme' });
  assert.equal(sidecar.counts.rows, 0);
  assert.deepEqual(sidecar.rows, []);
  assert.deepEqual(sidecar.review, []);
  assert.deepEqual(sidecar.collisions, []);
  assert.deepEqual(sidecar.destructiveSuggestions.rows, []);
});

// ---- the two exports agree ---------------------------------------------

test('the gate letter for a key always matches the sidecar row that holds it', () => {
  const { tools } = exportGate(NO_OMISSION_OPS, { vendor: 'acme', form: 'letter' });
  for (const row of exportSidecar(NO_OMISSION_OPS, { vendor: 'acme' }).rows) {
    assert.equal(tools[row.key], row.letter);
  }
});
