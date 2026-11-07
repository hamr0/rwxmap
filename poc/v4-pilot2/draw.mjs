// D137 pilot 2 draw: 200 rows from the pass pool (pilot 1 rows already excluded), seeded, reproducible.
import fs from 'node:fs';
import crypto from 'node:crypto';
import { parseCsv, toCsv } from '../../tools/csv.js';

const D = new URL('../../data/', import.meta.url).pathname;
const OUT = D + 'pilot2-v4-2026-11-06/';
const SEED = 20261106;
const CAP = 8;
const PER_STRATUM = 100;
const REGEX = /permission|polic(y|ies)|\brole|grant|\bacl\b|access|share|sharing|collaborator|member|owner|deploy.?key|\biam\b|binding|invite|token|api.?key|webhook|subscri|\buser|account|group|team|scope/;

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

const pool = parseCsv(fs.readFileSync(D + 'pass-v4-2026-11-05/pass-key.csv', 'utf8'));
const text = (r) => `${r.operationId} ${r.summary} ${r.description} ${r.path}`.toLowerCase();
const accessPool = pool.filter((r) => REGEX.test(text(r)));
const randomPool = pool.filter((r) => !REGEX.test(text(r)));

const rnd = mulberry32(SEED);
function drawStratum(p, name) {
  const per = {};
  const out = [];
  for (const r of shuffle(p, rnd)) {
    if (out.length >= PER_STRATUM) break;
    if ((per[r.provider] || 0) >= CAP) continue;
    per[r.provider] = (per[r.provider] || 0) + 1;
    out.push({ ...r, pass_stratum: r.stratum, stratum: name });
  }
  return out;
}
const access = drawStratum(accessPool, 'access');
const random = drawStratum(randomPool, 'random');
const all = shuffle([...access, ...random], rnd).map((r, i) => ({ ...r, pilot_id: 'q' + String(i + 1).padStart(3, '0') }));

const keyHdr = ['pilot_id', 'pass_id', 'origins', 'provider', 'method', 'path', 'operationId', 'summary', 'description', 'stratum', 'pass_stratum'];
const blindHdr = ['row_id', 'provider', 'method', 'path', 'operationId', 'summary', 'description'];
fs.writeFileSync(OUT + 'pilot-key.csv', toCsv(all, keyHdr));
const blindText = toCsv(all.map((r) => ({ ...r, row_id: r.pilot_id })), blindHdr);
fs.writeFileSync(OUT + 'pilot-blind.csv', blindText);
fs.writeFileSync(OUT + 'pilot-blind.csv.sha256', crypto.createHash('sha256').update(blindText).digest('hex') + '  pilot-blind.csv\n');

const count = (a, f) => { const c = {}; for (const x of a) c[f(x)] = (c[f(x)] || 0) + 1; return c; };
const fmt = (c) => Object.entries(c).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([k, v]) => `${k} ${v}`).join(', ');
const provTable = (a) => fmt(count(a, (r) => r.provider));
const readme = `# D137 pilot 2: v4 truth, 200 rows, factual Jev questions

Purpose. Pilot 1's Jev question was unfair to it (access rules in "ignore", a probability model cannot express "unclear, so x"). Pilot 2 asks Jev five FACTS per row (poc/v4-pilot2/jev-facts.mjs); our code applies the rule (poc/v4-pilot2/rule.mjs). The rows are labelled under BRIEF-v4 (data/relabel-v4-2026-11-05/BRIEF-v4.md) by two blind Sonnet labellers.

## Pre-registered bar (set before running)

"Jev's rule label must catch at least 95% of the rows the two Sonnet labellers agree are x; false x is reported separately. The cut-off is p >= 0.5 for every question, fixed before running. Truth = the two blind Sonnet labellers' agreed label under BRIEF-v4; disputes go to the user. Pilot 1's rows were not reused, because they shaped this question."

## Draw

- Script: poc/v4-pilot2/draw.mjs (rerun gives byte-identical files).
- Pool: data/pass-v4-2026-11-05/pass-key.csv, ${pool.length} rows (it already excludes the pilot 1 rows).
- Strata, 100 rows each:
  - access: operationId, summary, description and path match, case-insensitive: \`${REGEX.source}\` (${accessPool.length} pool rows match)
  - random: pool rows that do not match it (${randomPool.length} rows)
- Seed: ${SEED} (mulberry32). Each stratum is shuffled and taken in order; the final 200 are shuffled again to assign q001-q200.
- Cap: ${CAP} rows per provider per stratum. Strata sizes: access ${access.length}, random ${random.length}.

## Counts

- Per stratum: access ${access.length}, random ${random.length}.
- Per pass stratum: ${fmt(count(all, (r) => r.pass_stratum))}
- Providers, access: ${provTable(access)}.
- Providers, random: ${provTable(random)}.
- Providers, both: ${provTable(all)}.

## Files

- pilot-key.csv: answer key (pilot_id, pass_id, origins, provider, method, path, operationId, summary, description, stratum, pass_stratum).
- pilot-blind.csv (+ .sha256): the file labellers and Jev see: row_id,provider,method,path,operationId,summary,description.
- jev-facts-question.json (+ .sha256): the five factual questions, built by poc/v4-pilot2/jev-facts.mjs.
`;
fs.writeFileSync(OUT + 'README.md', readme);
console.log(JSON.stringify({ pool: pool.length, accessPool: accessPool.length, randomPool: randomPool.length, access: access.length, random: random.length, providersAll: count(all, (r) => r.provider) }));
