// Measurement helpers for score-words.mjs. Changes no product code.
import fs from 'node:fs';
import { classifyRow } from '../../src/flow.js';
import { PATH_X_WORDS } from '../../src/step2.js';
import { CONTENT_W } from '../../src/step3.js';
import { splitTokens } from '../../src/tokens.js';
import { parseCsv } from '../../tools/csv.js'; // data reader only, the same one sets.mjs uses

const RANK = { r: 0, w: 1, x: 2 };
export const bucket = (cls, truth) => {
  const d = RANK[truth] - RANK[cls];
  return d === 0 ? 'exact' : d === 1 ? 'loose1' : d === 2 ? 'loose2' : 'tight';
};

export function loadExam5() {
  const D = new URL('../../data/exam5-2026-11-07/', import.meta.url);
  const ops = parseCsv(fs.readFileSync(new URL('ops.csv', D), 'utf8'));
  const t = new Map(parseCsv(fs.readFileSync(new URL('truth.csv', D), 'utf8')).map((r) => [r.id, r.label]));
  return ops.map((r) => ({ set: 'exam5', id: r.id, row: r, v4: t.get(r.id) }));
}

const withWords = (add = [], del = []) => {
  const s = new Set(PATH_X_WORDS);
  for (const w of add) s.add(w);
  for (const w of del) s.delete(w);
  return s;
};

// A candidate = { words(): override object, post?(row, base) -> verdict|null }.
export const A_WORDS = ['teammate', 'assign', 'activate', 'sso', 'two_factor', 'identity_provider', 'connector',
  'messenger', 'perms', 'password', 'cidr', 'unpause', 'expiration', 'verify', 'registration', 'login'];

const wholeKey = (row) => {
  for (const seg of String(row.path || '').split('/')) {
    if (!seg || (seg.startsWith('{') && seg.endsWith('}'))) continue;
    for (const piece of seg.split('#')) {
      if (piece.toLowerCase().split(/[-_]/).some((w) => w === 'key' || w === 'keys')) return true;
    }
  }
  return false;
};
const B7_LAST = new Set(['enable', 'disable', 'archive', 'unarchive', 'attach', 'detach']);
const lastSeg = (row) => {
  const s = String(row.path || '').split('/').filter(Boolean);
  return s.length ? s[s.length - 1].toLowerCase() : '';
};

export function candidates() {
  const c = [];
  A_WORDS.forEach((w, i) => c.push({ name: `A${i + 1}`, label: `add ${w}`, words: { pathXWords: withWords([w]) } }));
  c.push({ name: 'B1', label: "remove 'domain' from CONTENT_W", words: { contentW: new Set([...CONTENT_W].filter((w) => w !== 'domain')) } });
  for (const [n, w] of [['B2', 'role'], ['B3', 'scope'], ['B4', 'permission'], ['B5', 'key']]) {
    c.push({ name: n, label: `remove '${w}' from PATH_X_WORDS`, words: { pathXWords: withWords([], [w]) } });
  }
  // B6/B7 need no src change: they restrict a firing path-x-word, so the scorer re-runs the
  // row with a reduced list only when the baseline fired for that reason.
  c.push({
    name: 'B6', label: "'key' only as whole segment/word (split - _)",
    post: (row, base) => (base.rule === 'path-x-word' && base.matched.length === 1 && base.matched[0] === 'key' && !wholeKey(row)
      ? classifyRow(row, { pathXWords: withWords([], ['key']) }) : null),
  });
  c.push({
    name: 'B7', label: 'PUT/PATCH last segment enable|disable|archive|unarchive|attach|detach vetoes path-x-word',
    post: (row, base) => (base.rule === 'path-x-word' && ['PUT', 'PATCH'].includes(String(row.method).toUpperCase()) && B7_LAST.has(lastSeg(row))
      ? classifyRow(row, { pathXWords: new Set() }) : null),
  });
  const allA = { pathXWords: withWords(A_WORDS) };
  c.push({ name: 'JOINT-A', label: 'A1-A16 together', words: allA });
  c.push({ name: 'JOINT-A+B1', label: 'A1-A16 + B1', words: { ...allA, contentW: new Set([...CONTENT_W].filter((w) => w !== 'domain')) } });
  return c;
}

export const run = (cand, row, base) => {
  if (cand.post) return cand.post(row, base) || base;
  return classifyRow(row, cand.words || {});
};

/** Score one candidate over rows. Returns counts, vendor maps and the changed-row list. */
export function score(cand, rows, base) {
  const changed = [];
  for (let i = 0; i < rows.length; i++) {
    const s = rows[i];
    const v = run(cand, s.row, base[i]);
    if (v.class !== base[i].class) changed.push({ s, b: base[i], v });
  }
  const cnt = { changed: changed.length, closed1: 0, closed2: 0, new1: 0, new2: 0, partial: 0, tightFixed: 0, newTight: 0, right: 0, wrong: 0 };
  const rightV = new Map(), wrongV = new Map();
  const net = new Map(), netNoEx5 = new Map();
  for (const s of rows) { net.set(s.row.provider, 0); if (s.set !== 'exam5') netNoEx5.set(s.row.provider, 0); }
  for (const { s, b, v } of changed) {
    const bb = bucket(b.class, s.v4), cb = bucket(v.class, s.v4);
    const vend = s.row.provider;
    if (bb === 'loose1' && cb !== 'loose1' && cb !== 'loose2') cnt.closed1++;
    if (bb === 'loose2' && cb !== 'loose1' && cb !== 'loose2') cnt.closed2++;
    if (bb === 'loose2' && cb === 'loose1') cnt.partial++;
    if (cb === 'loose1' && bb !== 'loose1' && bb !== 'loose2') cnt.new1++;
    if (cb === 'loose2' && bb !== 'loose2') cnt.new2++;
    if (bb === 'tight' && cb === 'exact') cnt.tightFixed++;
    if (cb === 'tight' && bb !== 'tight') cnt.newTight++;
    const right = cb === 'exact' && bb !== 'exact', wrong = bb === 'exact' && cb !== 'exact';
    if (right) { cnt.right++; rightV.set(vend, (rightV.get(vend) || 0) + 1); }
    if (wrong) { cnt.wrong++; wrongV.set(vend, (wrongV.get(vend) || 0) + 1); }
    const d = right ? 1 : wrong ? -1 : 0;
    net.set(vend, net.get(vend) + d);
    if (s.set !== 'exam5') { netNoEx5.set(vend, netNoEx5.get(vend) + d); }
  }
  const tally = (m) => { let b = 0, w = 0, u = 0; for (const x of m.values()) x > 0 ? b++ : x < 0 ? w++ : u++; return { b, w, u, sum: [...m.values()].reduce((a, c) => a + c, 0) }; };
  let top = null, topN = 0;
  for (const [k, n] of rightV) if (n > topN) { top = k; topN = n; }
  return { cnt, changed, rightV: rightV.size, wrongV: wrongV.size, top, topN, all: tally(net), no5: tally(netNoEx5) };
}

export function fmt(name, label, r) {
  const c = r.cnt;
  const share = c.right ? `${topShare(r)} (${r.topN}/${c.right} ${r.top})` : 'n/a';
  return `${name} [${label}] changed=${c.changed} | leaks closed loose-1=${c.closed1} loose-2=${c.closed2} (loose-2->loose-1 partial=${c.partial}) | new leaks loose-1=${c.new1} loose-2=${c.new2} | too-tight fixed=${c.tightFixed} new=${c.newTight} | right=${c.right} wrong=${c.wrong} vendors(right)=${r.rightV} vendors(wrong)=${r.wrongV} topVendorShareOfRight=${share}\n`
    + `    LOVO all 7 sets: vendors net-better=${r.all.b} net-worse=${r.all.w} unchanged=${r.all.u} (net rows ${r.all.sum >= 0 ? '+' : ''}${r.all.sum})\n`
    + `    LOVO exam5 EXCLUDED (6 original sets): vendors net-better=${r.no5.b} net-worse=${r.no5.w} unchanged=${r.no5.u} (net rows ${r.no5.sum >= 0 ? '+' : ''}${r.no5.sum})`;
}
const topShare = (r) => (100 * r.topN / r.cnt.right).toFixed(1) + '%';
