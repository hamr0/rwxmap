// `rwxmap/match` — the key and letter for one live call, from rwxmap's own
// exported sidecars alone: no spec, no YAML, no network at runtime. Built
// for a proxy that sees only METHOD + absolute URL per request.
//
// matcherFrom(sidecars) takes parsed <vendor>.rwxmap.review.json objects
// and returns { match(method, url) }. match NEVER returns null: a call no
// sidecar documents gets the request-only label, exactly what
// discover.js's classifyCall gives when nothing matches (requestKey + the
// method/path ladder). A call that does match gets the sidecar row's gate
// key and the GATE ENTRY for that key — what exportGate produced, collision
// rule included (exporter.js's gateEntriesFromRows, the one writer of it).
//
// This file imports only match.js, key.js, servers.js, flow.js and
// exporter.js (which itself imports only flow.js) — never discover.js,
// load.js or the yaml package, so a memory-tight proxy loads little.
import { compileOps, matchCompiled } from './match.js';
import { requestKey } from './key.js';
import { classifyRow } from './flow.js';
import { serversOrVendorHost } from './servers.js';
import { gateEntriesFromRows } from './exporter.js';

const TIGHTNESS = { r: 0, w: 1, x: 2 };
const LETTERS = new Set(['r', 'w', 'x']);
const MARKERS = new Set(['tight', 'loose', 'settled']);

/**
 * @typedef {Object} MatchResult
 * @property {string} key  The sidecar row's gate key (`<vendor>.<operationId>`)
 *   for a spec hit; `<host>.<METHOD> <path>` (requestKey) otherwise.
 * @property {'r'|'w'|'x'} letter
 * @property {'tight'|'loose'|'settled'} marker
 * @property {'spec'|'request'} source
 * @property {boolean} tie  matchOperation's own tie flag for the winning
 *   match; true too when two sidecars both matched and the tighter won.
 */

/**
 * @typedef {Object} Entry
 * @property {string[]} servers
 * @property {import('./match.js').CompiledOps} compiled  Compiled once here; every call reuses it.
 * @property {Map<string, {letter: 'r'|'w'|'x', marker: 'tight'|'loose'|'settled'}>} entries
 */

/**
 * @param {any} sidecar
 * @param {number} i
 * @returns {Entry}
 */
function buildEntry(sidecar, i) {
  const where = `matcherFrom: sidecar ${i}`;
  if (!sidecar || typeof sidecar !== 'object' || !Array.isArray(sidecar.rows)) {
    throw new Error(`${where}: not a sidecar object with a rows array`);
  }
  sidecar.rows.forEach((row, j) => {
    const ok = row && typeof row === 'object'
      && typeof row.key === 'string' && row.key !== ''
      && typeof row.method === 'string' && typeof row.path === 'string'
      && LETTERS.has(row.letter) && MARKERS.has(row.marker);
    if (!ok) throw new Error(`${where}, row ${j}: needs string key, method and path, a letter of r/w/x and a marker of tight/loose/settled`);
  });
  const given = sidecar.servers;
  if (given !== undefined && !(Array.isArray(given) && given.every((s) => typeof s === 'string'))) {
    throw new Error(`${where}: servers must be an array of strings`);
  }
  const vendor = typeof sidecar.vendor === 'string' ? sidecar.vendor : '';
  const servers = serversOrVendorHost(given ?? [], vendor);
  return {
    servers,
    compiled: compileOps(sidecar.rows, servers),
    entries: gateEntriesFromRows(sidecar.rows),
  };
}

/**
 * @param {any[]} sidecars  Parsed `<vendor>.rwxmap.review.json` objects.
 * @returns {{match: (method: string, url: string) => MatchResult}}
 */
export function matcherFrom(sidecars) {
  if (!Array.isArray(sidecars)) throw new Error('matcherFrom: expects an array of parsed sidecar objects');
  const built = sidecars.map(buildEntry);

  // Lowercased server host (hostname plus any non-default port: a call to
  // another port is another service) -> the sidecars naming it, so a call only
  // tries sidecars that can own its host.
  /** @type {Map<string, Entry[]>} */
  const byHost = new Map();
  for (const entry of built) {
    for (const server of entry.servers) {
      let host;
      try {
        host = new URL(server).host.toLowerCase();
      } catch {
        continue; // an unparseable server is skipped, as matchOperation does
      }
      const list = byHost.get(host) ?? [];
      if (!list.includes(entry)) list.push(entry);
      byHost.set(host, list);
    }
  }

  return {
    match(method, url) {
      let target;
      try {
        target = new URL(url);
      } catch (err) {
        throw new Error(`match: ${url}: unparseable URL (${err instanceof Error ? err.message : String(err)})`);
      }
      if (target.protocol !== 'http:' && target.protocol !== 'https:') {
        throw new Error(`match: ${url}: not an http(s) URL (protocol ${target.protocol})`);
      }

      /** @type {MatchResult|null} */
      let best = null;
      let hits = 0;
      for (const entry of byHost.get(target.host.toLowerCase()) ?? []) {
        const matched = matchCompiled(entry.compiled, method, target);
        if (!matched) continue;
        hits += 1;
        const row = /** @type {any} */ (matched.op);
        const gate = entry.entries.get(row.key);
        if (!gate) throw new Error(`match: no gate entry for key "${row.key}" — invariant broken`);
        if (!best || TIGHTNESS[gate.letter] > TIGHTNESS[best.letter]) {
          best = { key: row.key, letter: gate.letter, marker: gate.marker, source: 'spec', tie: matched.tie };
        }
      }
      if (best) {
        if (hits > 1) best.tie = true;
        return best;
      }

      const verdict = classifyRow({ method, path: target.pathname });
      return { key: requestKey(method, url), letter: verdict.class, marker: verdict.review, source: 'request', tie: false };
    },
  };
}
