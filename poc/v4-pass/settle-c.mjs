// v4 pass: label the c-families rows from the user's 2026-11-06 rulings.
// Usage: node poc/v4-pass/settle-c.mjs  (no args, deterministic)
import fs from 'node:fs';
import { parseCsv, toCsv } from '../../tools/csv.js';

const DIR = new URL('../../data/pass-v4-2026-11-05/suspects/disagree/', import.meta.url).pathname;
const ids = (s) => s.trim().split(/\s+/);

const A_W = ['upload/G01', 'upload/G04', 'session/G04', 'membership/G04', 'outside/G04', 'container/G04', 'rest/G04', 'access/G06'];
const A_X = ['credential/G04', 'access/G04', 'access/G01'];
const B_FAM = ['credential/G01', 'membership/G01', 'outside/G01', 'container/G01', 'rest/G01'];
const C_FAM = ['outside/G06', 'credential/G06', 'container/G06', 'rest/G06'];

const B_X = ids(`s00052 s00237 s00269 s00335 s00362 s00385 s00399 s00422 s00425 s00466 s00508 s00592 s00642 s00677 s00725 s00734 s00859 s01069 s01087 s01111 s01156 s01174 s01299 s01411 s01469 s01537 s01553 s01618 s01706 s01869 s01910 s01915 s01969 s01982 s01985 s02001 s02030 s02239 s02250 s02252 s02264 s02278 s02338 s02437 s02443 s02467 s02477 s02530 s02543 s02618 s02680 s02689 s02707 s02798 s02854 s02870 s02882 s02926 s02945 s03003 s03033 s03202 s03261 s03264 s03293 s03380 s03555 s03584 s03601 s03689 s03717 s03807 s03832 s03891 s03914 s04110 s04115 s04158 s04326 s04351 s04353 s04380 s04382 s04455 s04463 s04718 s04743 s04785 s04802 s04814 s04938 s05017 s05029 s05244 s05273 s05294 s05295 s05354 s05355 s05575 s05578 s05616 s05662 s05724 s05790 s05794 s05994 s06020 s06055 s06101 s06134 s06194 s06286 s06308 s06333 s06357 s06389 s06457 s06596 s06645 s06747 s06765 s06769 s06873 s07029 s07096 s07139 s07209 s07225 s07290 s07447 s07604 s07810 s07845 s07851 s07886 s07937 s08019 s08092 s08199 s08545 s08691 s08735 s08739 s08819 s08867 s08918 s09004 s09168 s09205 s09393 s09456 s09479 s09480 s09510 s09571 s09598 s09605 s09783 s09885 s09893 s09936 s10030 s10084 s10088 s10093 s10115 s10229 s10242 s10259 s10264 s10365 s10366 s10493 s10496 s10555 s10563 s10577 s10764 s10830 s10864 s10894 s10951 s10992 s10997 s11023 s11032 s11149 s11179 s11207 s11287 s11519 s11733 s11756 s11792 s11880 s11890 s11892 s11953 s12075 s12177 s12236 s12269 s12316 s12381 s12517 s12518 s12535 s12579 s12592 s12596 s12613 s12675 s12701 s12806 s12852 s12877 s12983 s13163 s13179 s13203 s13268 s13295 s13360 s13381 s13396 s13428 s13437 s13456 s13457 s13569 s13606 s13848 s13875 s13913 s13928 s13957 s14027 s14090 s14197 s14290 s14309 s14532 s14544 s14556 s14602 s14605 s14643`);
const B_SPECIAL = new Map();
for (const [reason, list] of [
  ['DELETE floor', 's09393'],
  ['no usable text, unsure means x', 's05790'],
  ['ruling 1: create can add members', 's02618 s03555 s06055 s06596 s08199 s10093 s10366 s10864 s14556'],
  ['ruling 3: sharing or public named', 's00052 s05724 s06134 s06769 s09605 s11880 s12535 s13396 s13569 s14602'],
]) for (const id of ids(list)) B_SPECIAL.set(id, reason);
const C_W = ids(`s00491 s00616 s00665 s00730 s00802 s01334 s01805 s03122 s03552 s03712 s04053 s04066 s04166 s05063 s05427 s06734 s06758 s06799 s07125 s07247 s07303 s07397 s07401 s07555 s07873 s08159 s08183 s08402 s08463 s08881 s09281 s09950 s10108 s10390 s10595 s11281 s11502 s11917 s11968 s12106 s12413 s12444 s12611 s12687 s12923 s13093 s13199 s13205 s13677 s13692 s14133 s14165 s14714 s14724`);

const fail = (m) => { console.error('FAIL: ' + m); process.exit(1); };
const rows = parseCsv(fs.readFileSync(DIR + 'c-families.csv', 'utf8'));
if (rows.length !== 1797) fail('c-families rows ' + rows.length);
const byId = new Map();
for (const r of rows) { if (byId.has(r.row_id)) fail('dup row_id in c-families ' + r.row_id); byId.set(r.row_id, r); }
const fg = (r) => r.family + '/' + r.group_id;

// list checks
for (const [name, list, fams] of [['B', B_X, B_FAM], ['C', C_W, C_FAM]]) {
  if (new Set(list).size !== list.length) fail(name + ' list has duplicate ids');
  for (const id of list) {
    const r = byId.get(id);
    if (!r) fail(name + ' id missing ' + id);
    if (!fams.includes(fg(r))) fail(name + ' id ' + id + ' in ' + fg(r));
  }
}
for (const id of B_SPECIAL.keys()) if (!B_X.includes(id)) fail('special id not in B x list ' + id);
const bx = new Set(B_X), cw = new Set(C_W);

const out = [];
const stat = { A: { x: 0, w: 0 }, B: { x: 0, w: 0 }, C: { x: 0, w: 0 } };
const luis = [];
for (const r of rows) {
  const k = fg(r);
  let part, cls, reason;
  if (A_W.includes(k) || A_X.includes(k)) {
    part = 'A';
    cls = A_W.includes(k) ? 'w' : 'x';
    reason = 'family ruling: ' + k;
    if (k === 'access/G01' && r.provider === 'azure.com' && /^Model_.*Role/.test(r.operationId)) {
      cls = 'w'; reason = 'azure LUIS language-model entity role, not access'; luis.push(r);
    }
  } else if (B_FAM.includes(k)) {
    part = 'B';
    if (bx.has(r.row_id)) { cls = 'x'; reason = B_SPECIAL.get(r.row_id) || 'one test: yes'; }
    else { cls = 'w'; reason = 'one test: no new access, credential or sending'; }
  } else if (C_FAM.includes(k)) {
    part = 'C';
    if (cw.has(r.row_id)) { cls = 'w'; reason = 'one test: no'; }
    else { cls = 'x'; reason = 'one test: yes (sends, receives or credentials; ruling 4: same-provider services count as outside)'; }
  } else fail('unhandled family ' + k);
  stat[part][cls]++;
  out.push({ row_id: r.row_id, pass_id: r.pass_id, group_id: r.group_id, family: r.family, final_class: cls, reason });
}
const nB = stat.B.x + stat.B.w, nC = stat.C.x + stat.C.w;
if (nB !== 472) fail('B part ' + nB);
if (nC !== 352) fail('C part ' + nC);

fs.writeFileSync(DIR + 'c-decisions.csv', toCsv(out, ['row_id', 'pass_id', 'group_id', 'family', 'final_class', 'reason']));

const settled = parseCsv(fs.readFileSync(DIR + 'settled.csv', 'utf8'));
const final = settled.map((r) => ({ row_id: r.row_id, pass_id: r.pass_id, group_id: r.group_id, final_class: r.final_class, source: r.source }));
for (const o of out) final.push({ row_id: o.row_id, pass_id: o.pass_id, group_id: o.group_id, final_class: o.final_class, source: 'c-ruling' });
if (new Set(final.map((r) => r.row_id)).size !== 4688 || final.length !== 4688) fail('final rows ' + final.length);
fs.writeFileSync(DIR + 'disagree-final.csv', toCsv(final, ['row_id', 'pass_id', 'group_id', 'final_class', 'source']));

console.log('A', stat.A, 'B', stat.B, 'C', stat.C);
console.log('LUIS rows (' + luis.length + '):');
for (const r of luis) console.log(' ', r.row_id, r.provider, r.method, r.operationId);
const tot = {};
for (const r of final) tot[r.final_class] = (tot[r.final_class] || 0) + 1;
console.log('final', final.length, tot);
