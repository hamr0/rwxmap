import { test } from 'node:test';
import assert from 'node:assert/strict';
import { classify as classifyC15 } from './c15.mjs';
import { loadCombinedCorpus, buildNounTable, truthSplit } from './c19.mjs';
import {
  rejectionReason,
  isAlphabetic,
  isStemArtifact,
  cleanNounTable,
  nounStats,
  deriveAllowlist,
  rowNouns,
  classifyC20,
  scoreRows,
  buildLovoAllowlists,
  scoreLovo,
  CONTESTED_WORDS,
  STOPWORDS,
} from './c20.mjs';

function row(overrides) {
  return {
    set: 'camara',
    vendor: 'camara',
    path: '/x',
    method: 'GET',
    operationId: 'doThing',
    gt_class: 'r',
    summary: '',
    description: '',
    confidence: 'high',
    ...overrides,
  };
}

// --- Part B: junk rejection ------------------------------------------------

test('isAlphabetic rejects digits and punctuation, accepts plain lowercase words', () => {
  assert.equal(isAlphabetic('project'), true);
  assert.equal(isAlphabetic('v2'), false);
  assert.equal(isAlphabetic("user's"), false);
  assert.equal(isAlphabetic('a-b'), false);
});

test('rejectionReason: non-alphabetic beats every other check', () => {
  const table = new Map();
  assert.equal(rejectionReason('v2', table), 'non-alphabetic');
});

test('rejectionReason: too-short for words under 3 characters', () => {
  const table = new Map([['id', 5], ['ip', 5]]);
  assert.equal(rejectionReason('id', table), 'too-short');
  assert.equal(rejectionReason('ip', table), 'too-short');
});

test('rejectionReason: stopwords are rejected even at length >= 3', () => {
  const table = new Map([['new', 5], ['the', 5], ['for', 5]]);
  for (const w of ['new', 'the', 'for']) {
    assert.equal(rejectionReason(w, table), 'stopword');
    assert.ok(STOPWORDS.has(w));
  }
});

test('rejectionReason: a real 3+ letter noun not in any list survives (null)', () => {
  const table = new Map([['project', 5]]);
  assert.equal(rejectionReason('project', table), null);
});

test('isStemArtifact: word is an artifact when word+suffix is a more common candidate', () => {
  const table = new Map([['resourc', 4], ['resource', 40]]);
  assert.equal(isStemArtifact('resourc', table), true);
  // the longer word itself is not an artifact of anything shorter here
  assert.equal(isStemArtifact('resource', table), false);
});

test('isStemArtifact: word+y case (e.g. a hypothetical "librar" vs "library")', () => {
  const table = new Map([['librar', 2], ['library', 20]]);
  assert.equal(isStemArtifact('librar', table), true);
});

test('isStemArtifact: does NOT fire when the longer form is rarer or absent', () => {
  const table = new Map([['resourc', 40], ['resource', 4]]);
  assert.equal(isStemArtifact('resourc', table), false);
  const table2 = new Map([['zone', 10]]);
  assert.equal(isStemArtifact('zone', table2), false);
});

test('cleanNounTable removes every rejected key and reports them sorted by count desc', () => {
  const rawTable = new Map([
    ['project', { allCount: 10, pdpRows: [] }],
    ['v2', { allCount: 3, pdpRows: [] }],
    ['id', { allCount: 20, pdpRows: [] }],
    ['new', { allCount: 5, pdpRows: [] }],
    ['resourc', { allCount: 2, pdpRows: [] }],
    ['resource', { allCount: 30, pdpRows: [] }],
  ]);
  const { junkSet, cleanTable, rejected } = cleanNounTable(rawTable);
  assert.ok(cleanTable.has('project'));
  assert.ok(cleanTable.has('resource'));
  assert.ok(!cleanTable.has('v2'));
  assert.ok(!cleanTable.has('id'));
  assert.ok(!cleanTable.has('new'));
  assert.ok(!cleanTable.has('resourc'));
  assert.equal(junkSet.size, 4);
  assert.equal(rejected.length, 4);
  // sorted by allCount desc
  assert.equal(rejected[0].noun, 'id');
  assert.equal(rejected[0].allCount, 20);
});

// --- Part C: allowlist derivation ------------------------------------------

test('nounStats computes n, w/x share, vendor count over pdpRows only', () => {
  const pdpRows = [
    row({ method: 'DELETE', vendor: 'a', gt_class: 'w' }),
    row({ method: 'DELETE', vendor: 'a', gt_class: 'w' }),
    row({ method: 'PUT', vendor: 'b', gt_class: 'x' }),
  ];
  const cleanTable = new Map([['project', { allCount: 3, pdpRows }]]);
  const stats = nounStats(cleanTable);
  assert.equal(stats.length, 1);
  const s = stats[0];
  assert.equal(s.n, 3);
  assert.equal(s.w, 2);
  assert.equal(s.x, 1);
  assert.ok(Math.abs(s.wShare - 2 / 3) < 1e-9);
  assert.equal(s.vendorCount, 2);
});

test('nounStats skips a noun with zero pdpRows entirely', () => {
  const cleanTable = new Map([['project', { allCount: 5, pdpRows: [] }]]);
  const stats = nounStats(cleanTable);
  assert.equal(stats.length, 0);
});

test('deriveAllowlist admits only nouns meeting both minN and minW', () => {
  const stats = [
    { noun: 'project', n: 5, wShare: 0.9 },
    { noun: 'contact', n: 5, wShare: 0.5 },
    { noun: 'zone', n: 1, wShare: 1.0 },
  ];
  const allow = deriveAllowlist(stats, 3, 0.8);
  assert.ok(allow.has('project'));
  assert.ok(!allow.has('contact'), 'below minW');
  assert.ok(!allow.has('zone'), 'below minN');
});

// --- Part E: the layer -----------------------------------------------------

test('rowNouns drops any noun present in the junk set', () => {
  const r = row({ method: 'DELETE', summary: 'Delete a widget', operationId: 'deleteWidget' });
  const withoutJunk = rowNouns(r, new Set());
  assert.ok(withoutJunk.has('widget'));
  const withJunk = rowNouns(r, new Set(['widget']));
  assert.equal(withJunk.size, 0);
});

test('classifyC20 self-check: allow-everything allowlist reproduces c15.classify on the original 1478 rows, except rows with zero extractable nouns', () => {
  const { originalRows } = loadCombinedCorpus();
  const allowAll = { has: () => true };
  const emptyJunk = new Set();
  let unexplained = 0;
  for (const r of originalRows) {
    const a = classifyC15(r).class;
    const b = classifyC20(r, emptyJunk, allowAll).class;
    if (a !== b && rowNouns(r, emptyJunk).size !== 0) unexplained += 1;
  }
  assert.equal(unexplained, 0, 'every mismatch must be explained by a zero-noun row, never anything else');
});

test('classifyC20 passes GET/POST rows through untouched, regardless of allowlist', () => {
  const emptyAllow = new Set();
  const emptyJunk = new Set();
  const getRow = row({ method: 'GET' });
  const postRow = row({ method: 'POST', operationId: 'deleteWidget', summary: 'Delete a widget' });
  assert.equal(classifyC20(getRow, emptyJunk, emptyAllow).class, classifyC15(getRow).class);
  assert.equal(classifyC20(postRow, emptyJunk, emptyAllow).class, classifyC15(postRow).class);
});

test('classifyC20 keeps w on a PUT/DELETE/PATCH floor row when every noun is on the allowlist', () => {
  const r = row({
    method: 'DELETE', operationId: 'deleteProject', summary: 'Delete a project',
    path: '/projects/{id}', gt_class: 'w',
  });
  const base = classifyC15(r);
  assert.equal(base.class, 'w');
  assert.equal(base.floor, true);
  const allow = new Set(['project']);
  const res = classifyC20(r, new Set(), allow);
  assert.equal(res.class, 'w');
  assert.equal(res.rule, base.rule);
});

test('classifyC20 raises to x, rule no-own-noun, when a floor row has a noun not on the allowlist', () => {
  const r = row({
    method: 'DELETE', operationId: 'deleteWidget', summary: 'Delete a widget',
    path: '/widgets/{id}', gt_class: 'x',
  });
  const base = classifyC15(r);
  assert.equal(base.class, 'w');
  assert.equal(base.floor, true);
  const res = classifyC20(r, new Set(), new Set(['project']));
  assert.equal(res.class, 'x');
  assert.equal(res.rule, 'no-own-noun');
});

test('classifyC20 raises to x when the row has NO surviving noun at all (absence is evidence)', () => {
  const r = row({
    method: 'DELETE', operationId: 'deleteIt', summary: '',
    path: '/things/{id}', gt_class: 'x',
  });
  const base = classifyC15(r);
  assert.equal(base.class, 'w');
  assert.equal(base.floor, true);
  // operationIdHeadNoun('deleteIt') would be 'it' or similar short token;
  // force the "no surviving noun" branch directly by junking whatever it extracts.
  const nouns = rowNouns(r, new Set());
  const junkAllOfThem = new Set(nouns);
  const res = classifyC20(r, junkAllOfThem, new Set(['project']));
  assert.equal(res.class, 'x');
  assert.equal(res.rule, 'no-own-noun');
});

test('classifyC20 never touches a row c15 already resolved off the floor (e.g. a party-noun hit)', () => {
  const r = row({
    method: 'DELETE', operationId: 'deleteCustomer', summary: 'Delete a customer',
    path: '/customers/{id}', gt_class: 'x',
  });
  const base = classifyC15(r);
  assert.equal(base.floor, false, 'expected c15 party-noun rule to fire before reaching the floor');
  const res = classifyC20(r, new Set(), new Set()); // empty allowlist would raise if eligible
  assert.equal(res.class, base.class);
  assert.equal(res.rule, base.rule);
});

// --- scoring plumbing -------------------------------------------------------

test('scoreRows counts goal-2 leaks, goal-1 errors, over-tight and exact correctly', () => {
  const rows = [
    row({ gt_class: 'x' }), // predicted r below -> leak
    row({ gt_class: 'w' }), // predicted r below -> over-tight? predicted r < w truth -> leak actually
    row({ gt_class: 'r' }),
  ];
  // Simple deterministic scorer: always predicts 'w'.
  const res = scoreRows(rows, () => ({ class: 'w' }));
  // row0 truth x, pred w -> leak (goal-2 leak)
  // row1 truth w, pred w -> exact
  // row2 truth r, pred w -> over-tight
  assert.equal(res.goal2Leaks, 1);
  assert.equal(res.exact, 1);
  assert.equal(res.overTight, 1);
  assert.equal(res.goal1Errors, 0);
});

// --- LOVO plumbing -----------------------------------------------------------

test('buildLovoAllowlists excludes the held-out vendor\'s own rows when checking qualification', () => {
  const rowsA = [
    row({ method: 'DELETE', vendor: 'vendorA', gt_class: 'w' }),
    row({ method: 'DELETE', vendor: 'vendorA', gt_class: 'w' }),
  ];
  const rowsB = [
    row({ method: 'DELETE', vendor: 'vendorB', gt_class: 'w' }),
  ];
  const pdpRows = [...rowsA, ...rowsB];
  const stats = [{ noun: 'project', n: pdpRows.length, wShare: 1, pdpRows }];
  const vendors = ['vendorA', 'vendorB'];
  const perVendor = buildLovoAllowlists(stats, vendors, 2, 0.8);
  // Excluding vendorA leaves only 1 row (vendorB's) -> n=1 < minN=2 -> not admitted for vendorA's own fold.
  assert.ok(!perVendor.get('vendorA').has('project'));
  // Excluding vendorB leaves 2 rows (vendorA's) -> n=2 >= minN=2, wShare=1 >= 0.8 -> admitted for vendorB's fold.
  assert.ok(perVendor.get('vendorB').has('project'));
});

test('scoreLovo uses each row\'s own vendor to select its fold allowlist', () => {
  const r = row({
    method: 'DELETE', operationId: 'deleteProject', summary: 'Delete a project',
    path: '/projects/{id}', gt_class: 'w', vendor: 'vendorX',
  });
  const perVendorAllowlist = new Map([['vendorX', new Set(['project'])]]);
  const res = scoreLovo([r], new Set(), perVendorAllowlist);
  assert.equal(res.goal2Leaks, 0);
  assert.equal(res.exact, 1);
});

// --- corpus sanity for the contested words list -----------------------------

test('CONTESTED_WORDS is exactly the six words named in the brief', () => {
  assert.deepEqual(
    [...CONTESTED_WORDS].sort(),
    ['contact', 'customer', 'device', 'network', 'partner', 'person'].sort(),
  );
});

// --- integration: buildNounTable/truthSplit reused from c19 still work as
// expected when fed into c20's own cleaning + stats pipeline ---------------

test('cleanNounTable + nounStats over the real combined corpus produce a non-empty, junk-free candidate list', () => {
  const { allRows } = loadCombinedCorpus();
  const rawTable = buildNounTable(allRows);
  const { cleanTable, rejected } = cleanNounTable(rawTable);
  assert.ok(cleanTable.size > 0);
  assert.ok(rejected.length > 0, 'expected the real corpus to contain at least some junk tokens');
  for (const noun of cleanTable.keys()) {
    assert.equal(rejectionReason(noun, new Map([...rawTable].map(([n, e]) => [n, e.allCount]))), null);
  }
  const stats = nounStats(cleanTable);
  assert.ok(stats.length > 0);
  for (const s of stats) {
    assert.ok(s.n > 0);
    assert.ok(s.wShare >= 0 && s.wShare <= 1);
  }
});
