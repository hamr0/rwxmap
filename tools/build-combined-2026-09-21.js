// Builds data/combined-2026-09-21/: one labelled corpus from the three sets
// whose specs this project pulled itself from official sources and labelled
// under data/calibration-2026-09-14/BRIEF.md. Test/dev tooling only — never
// part of the published library.
//
// DIAGNOSTIC over TUNING data, not an exam. Every source has been tuned on or
// scored: the provider corpus is the tuning set, both exams are burned (D24).
// No number computed over this set is a generalization claim.
//
// Sources (exactly three):
//   pc-   data/provider-corpus-2026-09-16  (4171 rows, 15 providers)
//   x17-  data/exam-2026-09-17             (1383 rows, okta/docusign/xero; D80 baked into labels)
//   x20-  data/exam-2026-09-20             (1003 rows, 5 providers; rulings.csv overlaid)
// B and C both use ids e0001..., so every row_id carries its source prefix.
//
// Usage: node tools/build-combined-2026-09-21.js
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { parseCsv } from './csv.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..');
const OUT_DIR = path.join(REPO_ROOT, 'data/combined-2026-09-21');
const ROWS_GZ = path.join(OUT_DIR, 'rows.json.gz');
const JEV_ROWS = path.join(OUT_DIR, 'jev-rows.json');
const README = path.join(OUT_DIR, 'README.md');

const CLASSES = ['r', 'w', 'x'];
const METHODS_ORDER = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'];
const ID_COLS = ['provider', 'method', 'path', 'operationId'];
const EXPECTED_TOTAL = 6557;
const EXPECTED_PROVIDERS = 23;

const SOURCES = [
  {
    source: 'pc',
    dir: 'data/provider-corpus-2026-09-16',
    labelFiles: Array.from({ length: 21 }, (_, i) => `labels-${String(i + 1).padStart(2, '0')}.csv`),
    rulings: false,
    expected: { r: 2082, w: 1218, x: 871 },
  },
  {
    source: 'x17',
    dir: 'data/exam-2026-09-17',
    labelFiles: Array.from({ length: 7 }, (_, i) => `labels-${i + 1}.csv`),
    rulings: false,
    expected: { r: 594, w: 415, x: 374 },
  },
  {
    source: 'x20',
    dir: 'data/exam-2026-09-20',
    labelFiles: Array.from({ length: 9 }, (_, i) => `labels-${i + 1}.csv`),
    rulings: true,
    expected: { r: 29, w: 633, x: 341 },
  },
];

function fail(msg) {
  console.error(`STOP: ${msg}`);
  process.exit(1);
}

const compositeOf = (o) => ID_COLS.map((c) => o[c]).join('|');

// Raw labels, then (C only) rulings overlaid exactly as
// tools/score-exam-2026-09-20.js does: each ruling asserts the raw label it
// replaces.
function loadTruth(src) {
  const labelDir = path.join(REPO_ROOT, src.dir, 'label');
  const byId = new Map();
  for (const f of src.labelFiles) {
    for (const lab of parseCsv(readFileSync(path.join(labelDir, f), 'utf8'))) {
      const id = (lab.row_id || '').trim();
      if (!id) fail(`${src.dir}/label/${f} has a row with no row_id`);
      const truth = (lab.truth_class || '').trim();
      if (!CLASSES.includes(truth)) fail(`${src.dir}/label/${f}: row ${id} truth_class "${truth}" is not r/w/x`);
      if (byId.has(id)) fail(`${src.dir}: row ${id} is labelled twice (second time in ${f})`);
      byId.set(id, { truth, confidence: (lab.confidence || '').trim() });
    }
  }
  let applied = 0;
  if (src.rulings) {
    const seen = new Set();
    for (const ru of parseCsv(readFileSync(path.join(labelDir, 'rulings.csv'), 'utf8'))) {
      const id = (ru.row_id || '').trim();
      const labelled = (ru.labelled || '').trim();
      const ruled = (ru.ruled || '').trim();
      if (seen.has(id)) fail(`${src.dir} rulings.csv rules row ${id} twice`);
      seen.add(id);
      const raw = byId.get(id);
      if (!raw) fail(`${src.dir} rulings.csv: row ${id} has no raw label`);
      if (raw.truth !== labelled) fail(`${src.dir} rulings.csv: row ${id} says labelled "${labelled}" but the raw label is "${raw.truth}"`);
      if (!CLASSES.includes(ruled)) fail(`${src.dir} rulings.csv: row ${id} ruled "${ruled}", expected r/w/x`);
      raw.truth = ruled;
      applied++;
    }
  }
  return { byId, applied };
}

function loadSource(src) {
  const ops = parseCsv(readFileSync(path.join(REPO_ROOT, src.dir, 'ops.csv'), 'utf8'));
  const key = parseCsv(readFileSync(path.join(REPO_ROOT, src.dir, 'label/key.csv'), 'utf8'));
  const { byId: truthById, applied } = loadTruth(src);

  const idx = new Map();
  for (const o of ops) {
    const k = compositeOf(o);
    if (!idx.has(k)) idx.set(k, []);
    idx.get(k).push(o);
  }

  const missing = [];
  const ambiguous = [];
  const keyComposites = new Map();
  const rows = [];
  for (const k of key) {
    const comp = compositeOf(k);
    keyComposites.set(comp, (keyComposites.get(comp) || 0) + 1);
    const hits = idx.get(comp) || [];
    if (hits.length === 0) { missing.push(`${k.row_id} ${comp}`); continue; }
    if (hits.length > 1) { ambiguous.push(`${k.row_id} ${comp} (${hits.length} ops rows)`); continue; }
    const t = truthById.get(k.row_id);
    if (!t) fail(`${src.dir}: key row ${k.row_id} has no label`);
    const o = hits[0];
    rows.push({
      row_id: `${src.source}-${k.row_id}`,
      source: src.source,
      provider: o.provider,
      method: o.method,
      path: o.path,
      operationId: o.operationId,
      summary: o.summary,
      description: o.description,
      truth: t.truth,
      confidence: t.confidence,
    });
  }
  if (missing.length) fail(`${src.dir}: ${missing.length} key rows have no ops row:\n  ${missing.slice(0, 10).join('\n  ')}`);
  if (ambiguous.length) fail(`${src.dir}: ${ambiguous.length} key rows match more than one ops row:\n  ${ambiguous.slice(0, 10).join('\n  ')}`);
  const keyDup = [...keyComposites].filter(([, n]) => n > 1);
  if (keyDup.length) fail(`${src.dir}: ${keyDup.length} composite ids appear more than once in key.csv, e.g. ${keyDup[0][0]} — the join is not 1:1`);
  if (key.length !== ops.length) fail(`${src.dir}: key.csv has ${key.length} rows but ops.csv has ${ops.length} — the join is not 1:1`);
  if (truthById.size !== key.length) fail(`${src.dir}: ${truthById.size} labels for ${key.length} key rows`);

  const dist = { r: 0, w: 0, x: 0 };
  for (const r of rows) dist[r.truth]++;
  for (const c of CLASSES) {
    if (dist[c] !== src.expected[c]) {
      fail(`${src.dir}: truth ${c} = ${dist[c]}, expected ${src.expected[c]} (got r ${dist.r} / w ${dist.w} / x ${dist.x})`);
    }
  }
  return { rows, applied };
}

// ------------------------------------------------------------------ build

const all = [];
const applied = {};
for (const src of SOURCES) {
  const { rows, applied: n } = loadSource(src);
  applied[src.source] = n;
  all.push(...rows);
}

if (all.length !== EXPECTED_TOTAL) fail(`combined set has ${all.length} rows, expected ${EXPECTED_TOTAL}`);

const idSeen = new Set();
for (const r of all) {
  if (idSeen.has(r.row_id)) fail(`row_id ${r.row_id} appears twice after prefixing`);
  idSeen.add(r.row_id);
}

const providerSources = new Map();
for (const r of all) {
  if (!providerSources.has(r.provider)) providerSources.set(r.provider, new Set());
  providerSources.get(r.provider).add(r.source);
}
const overlap = [...providerSources].filter(([, s]) => s.size > 1);
if (overlap.length) fail(`providers appear in more than one source: ${overlap.map(([p, s]) => `${p} (${[...s].join(',')})`).join('; ')}`);
if (providerSources.size !== EXPECTED_PROVIDERS) fail(`${providerSources.size} distinct providers, expected ${EXPECTED_PROVIDERS}`);

const byComposite = new Map();
for (const r of all) {
  const k = compositeOf(r);
  if (!byComposite.has(k)) byComposite.set(k, []);
  byComposite.get(k).push(r);
}
const dups = [...byComposite].filter(([, rs]) => rs.length > 1);
const conflicts = dups.filter(([, rs]) => new Set(rs.map((r) => r.truth)).size > 1);
if (conflicts.length) {
  fail(`${conflicts.length} duplicate operations carry CONFLICTING truth:\n  ` +
    conflicts.map(([k, rs]) => `${k}: ${rs.map((r) => `${r.row_id}=${r.truth}`).join(' ')}`).join('\n  '));
}

// ------------------------------------------------------------------ write

mkdirSync(OUT_DIR, { recursive: true });
const json = JSON.stringify(all);
const sha = createHash('sha256').update(json).digest('hex');
const gz = gzipSync(Buffer.from(json, 'utf8'), { level: 9 });
// Node's gzipSync writes MTIME 0 and a fixed OS byte; the header carries no
// time, so the bytes depend only on the content.
if (gz.readUInt32LE(4) !== 0) fail('gzip header carries a non-zero mtime — output would not be reproducible');
writeFileSync(ROWS_GZ, gz);

const jevRows = all.map((r) => ({
  row_id: r.row_id,
  method: r.method,
  path: r.path,
  operationId: r.operationId,
  summary: r.summary,
  description: r.description,
}));
writeFileSync(JEV_ROWS, JSON.stringify(jevRows, null, 1) + '\n');

// ------------------------------------------------------------------ print

const out = [];
const say = (s = '') => out.push(s);
const tally = (rows, pick) => {
  const m = new Map();
  for (const r of rows) m.set(pick(r), (m.get(pick(r)) || 0) + 1);
  return m;
};
const distLine = (rows) => {
  const t = tally(rows, (r) => r.truth);
  return CLASSES.map((c) => `${c} ${t.get(c) || 0}`).join(' / ') + `  (of ${rows.length})`;
};

say('COMBINED data/combined-2026-09-21 — DIAGNOSTIC over tuning data, not an exam, no generalization claim.');
say(`rows ${all.length}   providers ${providerSources.size}   provider overlap across sources: none   rulings applied: x20 ${applied.x20}`);
say(`duplicate operations (same provider|method|path|operationId): ${dups.length} groups, conflicting truth: ${conflicts.length}`);
say();
say('per source:');
for (const src of SOURCES) {
  const rs = all.filter((r) => r.source === src.source);
  say(`  ${src.source.padEnd(4)} ${String(rs.length).padStart(5)}  truth ${distLine(rs)}`);
}
say();
say('per provider (source, rows, truth):');
const provs = [...providerSources.keys()].sort();
for (const p of provs) {
  const rs = all.filter((r) => r.provider === p);
  say(`  ${p.padEnd(14)} ${[...providerSources.get(p)][0].padEnd(4)} ${String(rs.length).padStart(5)}  ${distLine(rs)}`);
}
say();
const methods = [...tally(all, (r) => r.method).keys()].sort((a, b) => {
  const ia = METHODS_ORDER.indexOf(a);
  const ib = METHODS_ORDER.indexOf(b);
  return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib) || (a < b ? -1 : a > b ? 1 : 0);
});
say('truth overall: ' + distLine(all));
say('per method (rows, truth):');
for (const m of methods) {
  const rs = all.filter((r) => r.method === m);
  say(`  ${m.padEnd(7)} ${String(rs.length).padStart(5)}  ${distLine(rs)}`);
}
say();
say(`wrote ${path.relative(REPO_ROOT, ROWS_GZ)} (${gz.length} bytes gz)`);
say(`  sha256 of uncompressed rows.json: ${sha}`);
say(`wrote ${path.relative(REPO_ROOT, JEV_ROWS)} (${jevRows.length} rows; no truth, source or provider)`);

// ----------------------------------------------------------------- README

const readme = `# data/combined-2026-09-21 — combined labelled corpus (DIAGNOSTIC)

**This is a tuning/diagnostic set, not an exam.** Every source in it has
already been tuned on or scored: the provider corpus is the tuning set the
rules were fitted on, and both exams are burned (D24). No number computed
over this set is a generalization claim. The only honest generalization
numbers remain the ones each exam gave when it was scored once.

## What it is

${all.length} labelled operations across ${providerSources.size} providers, joined from the
three sets whose specs this project pulled itself from official sources and
labelled blind under \`data/calibration-2026-09-14/BRIEF.md\`:

| prefix | source | rows | providers | truth r / w / x |
|---|---|---|---|---|
${SOURCES.map((src) => {
  const rs = all.filter((r) => r.source === src.source);
  const t = tally(rs, (r) => r.truth);
  const ps = [...new Set(rs.map((r) => r.provider))].sort().join(', ');
  return `| \`${src.source}-\` | \`${src.dir}\` | ${rs.length} | ${ps} | ${CLASSES.map((c) => t.get(c) || 0).join(' / ')} |`;
}).join('\n')}

- \`x17\`: the D80 rulings are already baked into its \`labels-N.csv\` files.
- \`x20\`: \`label/rulings.csv\` is overlaid on the raw labels exactly as
  \`tools/score-exam-2026-09-20.js\` does (${applied.x20} rulings, each asserting the raw
  label it replaces). A ruled row keeps its labeller's \`confidence\`.

Only these three, deliberately: the build set (\`data/buildset-2026-09-18\`)
is apis-guru specs this project did not pull from official sources; CAMARA
is deleted; everything older is superseded.

No provider appears in more than one source. Duplicate operations
(same provider|method|path|operationId) inside the set: ${dups.length}.

## Row ids

Exams 09-17 and 09-20 both number their rows \`e0001...\`, so every
\`row_id\` is prefixed with its source: \`pc-\`, \`x17-\`, \`x20-\` (e.g.
\`pc-r0001\`, \`x17-e0001\`, \`x20-e0001\`). Uniqueness is asserted after
prefixing.

## Files

- \`rows.json.gz\` — array of
  \`{row_id, source, provider, method, path, operationId, summary, description, truth, confidence}\`.
  Full description text, never truncated. sha256 of the **uncompressed**
  JSON: \`${sha}\`.
- \`jev-rows.json\` — uncompressed, what \`poc/jev/run.mjs\` reads: array of
  \`{row_id, method, path, operationId, summary, description}\`. No truth,
  no source, no provider.
- \`outA.jsonl\` / \`outB.jsonl\` (when present) — raw Jev output, scored by
  \`tools/score-combined-2026-09-21.js\`.

## Rebuild

\`\`\`
node tools/build-combined-2026-09-21.js
\`\`\`

Deterministic: \`zlib.gzipSync\` writes mtime 0, so two runs give identical
bytes. The builder hard-fails on any per-source truth total other than the
recorded one, a non-1:1 ops/key join, a total other than ${EXPECTED_TOTAL}, a provider
count other than ${EXPECTED_PROVIDERS}, a provider in two sources, a repeated prefixed
row_id, or a duplicate operation with conflicting truth.
`;
writeFileSync(README, readme);
say(`wrote ${path.relative(REPO_ROOT, README)}`);

console.log(out.join('\n'));
