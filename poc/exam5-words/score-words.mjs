// MEASUREMENT only (no product code changed). Scores hand-picked word candidates, each ALONE
// against the baseline classifyRow(row), over six tuning sets (v4 truth) + exam #5 (burned, tuning now).
import fs from 'node:fs';
import { loadSets } from '../mech-v4/sets.mjs';
import { classifyRow } from '../../src/flow.js';
import { loadExam5, candidates, score, fmt, bucket } from './lib.mjs';

const OUT = process.argv[2] || '/tmp/claude-1000/-home-hamr-PycharmProjects-rwxmap/3e29a05a-2f0f-4540-b216-597e84a62c8f/scratchpad/words';
fs.mkdirSync(OUT, { recursive: true });

const rows = [...loadSets(), ...loadExam5()].filter((s) => s.v4);
if (rows.some((s) => !s.row.provider)) { console.error('ASSERT FAIL: row without provider'); process.exit(1); }
const per = {};
for (const s of rows) per[s.set] = (per[s.set] || 0) + 1;
console.log('rows per set: ' + Object.entries(per).map(([k, v]) => `${k}=${v}`).join(' ') + ` total=${rows.length} vendors=${new Set(rows.map((s) => s.row.provider)).size}`);
const base = rows.map((s) => classifyRow(s.row));
const bt = { exact: 0, loose1: 0, loose2: 0, tight: 0 };
rows.forEach((s, i) => bt[bucket(base[i].class, s.v4)]++);
console.log(`baseline: exact=${bt.exact} loose-1=${bt.loose1} loose-2=${bt.loose2} too-tight=${bt.tight}`);
console.log('definitions: right = candidate exact where baseline was not; wrong = baseline exact where candidate is not; vendor net = right - wrong on that vendor\'s rows');
console.log('');

for (const cand of candidates()) {
  const r = score(cand, rows, base);
  console.log(fmt(cand.name, cand.label, r));
  const lines = r.changed.map(({ s, b, v }) => [s.set, s.id, s.row.provider, s.row.method, s.row.path, s.v4,
    `${b.class} -> ${v.class}`, bucket(b.class, s.v4) + ' -> ' + bucket(v.class, s.v4), (v.matched || []).join('|')].join('\t'));
  fs.writeFileSync(`${OUT}/${cand.name}.tsv`, ['set\tid\tvendor\tmethod\tpath\ttruth\tbaseline->candidate\tbucket\tmatched', ...lines].join('\n') + '\n');
}
