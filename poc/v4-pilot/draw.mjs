// D137 pilot draw: 200 w rows (100 access-likely, 100 random), seeded, reproducible.
import fs from 'node:fs';
import zlib from 'node:zlib';
import crypto from 'node:crypto';
import { parseCsv, toCsv } from '../../tools/csv.js';

const D = new URL('../../data/', import.meta.url).pathname;
const OUT = D + 'pilot-v4-2026-11-05/';
const SEED = 20261105;
const CAP = 8;
const PER_STRATUM = 100;
const REGEX = /permission|polic(y|ies)|\brole|grant|\bacl\b|access|share|sharing|collaborator|member|owner|deploy.?key|\biam\b|binding|invite|token|api.?key|webhook|subscri|\buser|account|group|team|scope/;

const rd = (p) => {
  const b = fs.readFileSync(D + p);
  return p.endsWith('.gz') ? zlib.gunzipSync(b).toString() : b.toString();
};
const rows = (p) => parseCsv(rd(p));

function mulberry32(a) {
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function shuffle(arr, rnd) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const pool = [];
const add = (setName, a, label, idOf) => {
  for (const x of a) {
    pool.push({
      source_set: x.source_set || setName,
      source_id: idOf(x),
      provider: x.provider,
      method: (x.method || '').toUpperCase(),
      path: x.path,
      operationId: x.operationId || '',
      summary: x.summary || '',
      description: x.description || '',
      v3_label: label(x),
    });
  }
};
add('combined-2026-09-21', rows('combined-2026-09-21/labelled.csv'), (x) => x.truth_class, (x) => x.row_id);
add('relabel-buildset-2026-09-23', rows('relabel-buildset-2026-09-23/labelled.csv'), (x) => x.truth_class, (x) => x.row_id);
add('exam-2026-09-22', rows('exam-2026-09-22/labelled.csv'), (x) => x.truth_class, (x) => x.row_id);
for (const [s, d] of [['exam3-2026-11-04', 'exam3-2026-11-04'], ['exam4-2026-11-04', 'exam4-2026-11-04']]) {
  const t = new Map(rows(d + '/truth-d136.csv').map((x) => [x.id, x.label]));
  add(s, rows(d + '/ops.csv'), (x) => t.get(x.id), (x) => x.id);
}
{
  const t = new Map(rows('rwxlite-fresh-2026-11-03/truth.csv').map((x) => [x.id, x.label]));
  add('rwxlite-fresh-2026-11-03', rows('rwxlite-fresh-2026-11-03/ops.csv.gz'), (x) => t.get(x.id), (x) => x.id);
}

const w = pool.filter((r) => r.v3_label === 'w');
const nullLabels = pool.filter((r) => !r.v3_label).length;
const text = (r) => `${r.operationId} ${r.summary} ${r.description} ${r.path}`;
const accessPool = w.filter((r) => REGEX.test(text(r).toLowerCase()));
const randomPool = w.filter((r) => !REGEX.test(text(r).toLowerCase()));

const rnd = mulberry32(SEED);
function drawStratum(p, name) {
  const per = {};
  const out = [];
  for (const r of shuffle(p, rnd)) {
    if (out.length >= PER_STRATUM) break;
    if ((per[r.provider] || 0) >= CAP) continue;
    per[r.provider] = (per[r.provider] || 0) + 1;
    out.push({ ...r, stratum: name });
  }
  return out;
}
const access = drawStratum(accessPool, 'access');
const random = drawStratum(randomPool, 'random');
const all = shuffle([...access, ...random], rnd).map((r, i) => ({ ...r, pilot_id: 'p' + String(i + 1).padStart(3, '0') }));

const keyHdr = ['pilot_id', 'source_set', 'source_id', 'provider', 'method', 'path', 'operationId', 'summary', 'description', 'v3_label', 'stratum'];
const blindHdr = ['row_id', 'provider', 'method', 'path', 'operationId', 'summary', 'description'];
fs.writeFileSync(OUT + 'pilot-key.csv', toCsv(all, keyHdr));
const blindText = toCsv(all.map((r) => ({ ...r, row_id: r.pilot_id })), blindHdr);
fs.writeFileSync(OUT + 'pilot-blind.csv', blindText);
fs.writeFileSync(OUT + 'pilot-blind.csv.sha256', crypto.createHash('sha256').update(blindText).digest('hex') + '  pilot-blind.csv\n');

const count = (a, f) => { const c = {}; for (const x of a) c[f(x)] = (c[f(x)] || 0) + 1; return c; };
const fmt = (c) => Object.entries(c).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([k, v]) => `${k} ${v}`).join(', ');
const provTable = (a) => fmt(count(a, (r) => r.provider));
const readme = `# D137 pilot: v4 truth, 200 w rows

Purpose. The step-4 pilot of the D137 truth-v4 plan (docs/wiki/truth-v4-plan.md). 200 rows that are w under v3 truth are labelled under BRIEF-v4 (data/relabel-v4-2026-11-05/BRIEF-v4.md) by two blind labellers and by Jev with a v4 question. This calibrates the brief and decides who does the full w pass.

## Pre-registered bar (set before running)

"Jev must catch at least 95% of the rows the labellers' truth calls x, with its false x reported separately."

## Rules

- Truth = the two Sonnet labellers' agreed label. Disputes go to the user.
- Jev is scored against that truth.
- The user ruled both labellers use Sonnet (2026-11-05).
- Labellers see only pilot-blind.csv (no label, stratum or source). pilot-key.csv is the answer key and stays out of their sight.

## Draw

- Script: poc/v4-pilot/draw.mjs (rerun gives byte-identical files).
- Pool: every row labelled w in the v3 sets: combined-2026-09-21/labelled.csv, relabel-buildset-2026-09-23/labelled.csv, exam-2026-09-22/labelled.csv, exam3-2026-11-04/truth-d136.csv and exam4-2026-11-04/truth-d136.csv (user ruling; joined to ops.csv), rwxlite-fresh-2026-11-03/truth.csv (joined to ops.csv.gz). Pool size: ${w.length} w rows (of ${pool.length} rows read; ${nullLabels} with no label).
- Strata, 100 rows each:
  - access: operationId, summary, description and path match, case-insensitive: \`${REGEX.source}\` (${accessPool.length} w rows match)
  - random: w rows that do not match it (${randomPool.length} rows)
- Seed: ${SEED} (mulberry32). Each stratum is shuffled and taken in order; the final 200 are shuffled again to assign p001-p200.
- Cap: ${CAP} rows per provider per stratum. Both strata reached ${PER_STRATUM} under the cap (access ${access.length}, random ${random.length}).

## Counts

- Per stratum: access ${access.length}, random ${random.length}.
- Per source set: ${fmt(count(all, (r) => r.source_set))}.
- Providers, access: ${provTable(access)}.
- Providers, random: ${provTable(random)}.
- Providers, both: ${provTable(all)}.

## Files

- pilot-key.csv: answer key (pilot_id, source_set, source_id, provider, method, path, operationId, summary, description, v3_label, stratum).
- pilot-blind.csv (+ .sha256): the file labellers and Jev see: row_id,provider,method,path,operationId,summary,description.
- jev-v4-question.json (+ .sha256): the v4 Jev question, built by poc/v4-pilot/jev-v4.mjs, not yet sent.
`;
fs.writeFileSync(OUT + 'README.md', readme);
console.log(JSON.stringify({ totalRows: pool.length, nullLabels, wPool: w.length, accessPool: accessPool.length, randomPool: randomPool.length, access: access.length, random: random.length, sets: count(all, (r) => r.source_set), providersAll: count(all, (r) => r.provider), providersAccess: count(access, (r) => r.provider), providersRandom: count(random, (r) => r.provider) }));
