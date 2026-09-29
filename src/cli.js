#!/usr/bin/env node
// The rwxmap CLI (PRD "What is next" item d, D121/D122) — one command,
// `rwxmap <spec URL | local file | bare API address>`, that turns an API
// description into the combined bareguard+MCP output plus a human-facing
// sidecar. It classifies nothing itself: every letter here comes from
// exportGate/exportSidecar (exporter.js), which in turn is classifyRow
// (flow.js) and nothing else. This file only decides WHICH operations to
// classify (load.js / discover.js) and HOW to reshape one classification
// into the two carriers the PRD names.
//
// THIS IS NOT CORE (D109): it never imports tokens.js, step1-3.js or
// flow.js, and holds no word list and no r/w/x judgement of its own.
// jev.js IS imported here, read-only, for exactly the two functions its
// own header names the caller as owning: needsJev (which rows a tier
// wants) and applyJev (apply an answer this file already obtained over
// the network). Neither is a judgement call this file makes itself — the
// judgement (the tier's pile, threshold and one-way move) is entirely
// jev.js's, and this file never edits jev.js, never re-derives a
// threshold, and never moves a class on its own reasoning.
//
// D121 — ONE COMMAND. A spec URL or local file is read with
// `rwxmap/load` (loadSpec); a bare API address (an http(s) URL that is
// not itself a spec — nothing at it parses as one, or it parses but
// yields zero operations) runs `findSpec` (rwxmap/discover) first. If
// nothing is found there, the run says so and exits non-zero, writing no
// file — there is nothing to classify ahead of time. Telling a "spec URL"
// from a "bare address" is done by trying to load it first (resolveInput
// below); if that load throws OR yields zero operations, it's a bare
// address.
//
// D122 — THE COMBINED OUTPUT. One JSON file: `rwxmapVersion`, `source`,
// `vendor`, `bareguard: { tools }` (exactly exportGate's `tools`, keyed
// `<vendor>.<operationId>`) and `mcp` (keyed `"METHOD path"`, D122's own
// shape). Every `mcp` letter equals the `bareguard` letter for the same
// operation because both are read off the SAME exportGate/exportSidecar
// call — this file never re-derives a class. Plus a sidecar file, exactly
// exportSidecar's own return value, unchanged (it already carries
// `collisions`, so nothing here duplicates that).
//
// JEV (PRD item c, D118-120): key configured -> used; no key -> mechanical,
// never stops, and every run says loudly which mode ran. The key is
// RWXMAP_JEV_KEY from the environment, else the RWXMAP_JEV_KEY line of a
// `.env` file in `cwd`, parsed with Node's own util.parseEnv (no dotenv
// dependency) -- an already-set variable wins, only that one variable is
// taken, and nothing from `.env` is ever written to process.env. With a
// key: classify every operation mechanically ONCE (exporter.js's
// classifyOperations, the same pass classifyAll runs by default), ask
// jev-client.js's runJevBatch about exactly the rows jev.js's needsJev
// names, apply every usable answer through jev.js's own applyJev (which
// fails closed on anything unusable), and hand the FINAL verdicts to
// buildOutput's `verdicts` option so exportGate/exportSidecar classify
// nothing a second time. A row Jev cannot answer for -- a request
// failure, a bad answer -- keeps its mechanical verdict; the run never
// stops on a Jev error.
//
// LOCAL-FILE VENDOR DEFAULT (user ruling, orchestrator escalation 1
// resolved): "a local file -> the spec's first server host." Reuses
// discover.js's own server-resolution logic through its exported
// `firstServerHost(doc, specAddr)` — the same OpenAPI 3
// `servers[]`/variable-substitution and Swagger 2 `host`+`basePath` rule
// `findSpec`'s `determineVendor` uses for `opts.spec`, factored out so
// this file never re-derives or copies it. No servers (or none that
// resolve to a real http(s) URL) -> null -> this file's own "no vendor,
// pass --vendor" error, same as before.
//
// D124 — THE REMAINING CARRIERS. Each is the exact fragment its
// standard's own slot takes, so adoption is a copy. The combined JSON
// gains `webmcp`, keyed "METHOD path" exactly like `mcp` and built in
// the SAME loop (buildHintDicts), so the two dicts can never disagree on
// keys or on which operation won a collision. A third file,
// `<vendor>.openapi.rwx.json`, is a JSON copy of the parsed input with
// `x-rwx` set on every operation object under a standard HTTP method
// field (buildOpenApiCopy). OpenAPI 3.2 `query`/`additionalOperations`
// operations are not labelled yet; the run counts them and says so
// (countUnlabelledOperations). The input
// file itself is only ever read. For a discovered spec the parsed
// document is not in findSpec's result (nor its cache), so resolveInput
// reloads `specUrl` once with redirects refused and takes operations,
// letters and the copy all from that one reloaded document.
//
// Dependency rule (CLAUDE.md): vanilla Node >= 22 ESM, node:util's
// parseArgs, node:fs/path. No new dependency.

import { parseArgs, parseEnv } from 'node:util';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { loadSpec } from './load.js';
import { findSpec, firstServerHost } from './discover.js';
import { operationsFrom, operationEntries, exportGate, exportSidecar, classifyOperations } from './exporter.js';
import { needsJev, applyJev } from './jev.js';
import { runJevBatch } from './jev-client.js';

// ---------------------------------------------------------------------
// Small local helpers — each one trivial enough (a regex, a URL-API call,
// a 3-value ordering) that pulling it out of discover.js/exporter.js would
// cost more (a new export, a new promise to keep) than it saves. Anything
// with real judgement in it (server resolution, the classification itself)
// is reused from its one writer, never repeated here.
// ---------------------------------------------------------------------

/** @param {string} s @returns {boolean} */
function isHttpUrl(s) {
  return /^https?:\/\//i.test(String(s));
}

let cachedVersion;
/** @returns {string} */
function packageVersion() {
  if (cachedVersion) return cachedVersion;
  try {
    const pkgUrl = new URL('../package.json', import.meta.url);
    const pkg = JSON.parse(fs.readFileSync(pkgUrl, 'utf8'));
    cachedVersion = typeof pkg.version === 'string' ? pkg.version : '0.0.0';
  } catch {
    cachedVersion = '0.0.0';
  }
  return cachedVersion;
}

// Mirrors exporter.js's own TIGHTNESS ordering (r < w < x), which is not
// exported. Reused here ONLY for the defensive duplicate-key case below —
// a 3-entry ordering, not the classification, so re-stating it is not the
// "one writer" logic the project's rule is about.
const TIGHTNESS = { r: 0, w: 1, x: 2 };

/**
 * D104's hint mapping, direct from the PRD table. `idempotentHint` and
 * `openWorldHint` are never emitted (closed, no evidence source).
 *
 * @param {'r'|'w'|'x'} letter
 * @returns {{readOnlyHint: boolean, destructiveHint?: boolean}}
 */
function annotationsForClass(letter) {
  if (letter === 'r') return { readOnlyHint: true };
  if (letter === 'w') return { readOnlyHint: false, destructiveHint: false };
  if (letter === 'x') return { readOnlyHint: false, destructiveHint: true };
  throw new Error(`cli: unknown class "${letter}"`);
}

/**
 * D124's WebMCP mapping (PRD Carrier 3). WebMCP's ToolAnnotations all
 * default to FALSE, so an omitted `consequentialHint` would read as "can
 * be undone" — the loose reading. Both flags are therefore always
 * emitted, on every class.
 *
 * @param {'r'|'w'|'x'} letter
 * @returns {{readOnlyHint: boolean, consequentialHint: boolean}}
 */
function webmcpAnnotationsForClass(letter) {
  if (letter === 'r') return { readOnlyHint: true, consequentialHint: false };
  if (letter === 'w') return { readOnlyHint: false, consequentialHint: false };
  if (letter === 'x') return { readOnlyHint: false, consequentialHint: true };
  throw new Error(`cli: unknown class "${letter}"`);
}

/**
 * The OpenAPI `x-rwx` value (PRD Carrier 1): the four published fields
 * of one sidecar row.
 *
 * @param {import('./exporter.js').SidecarRow} row
 * @returns {{class: 'r'|'w'|'x', destructive: boolean, evidence: string, review: string}}
 */
function xRwxForRow(row) {
  return { class: row.letter, destructive: row.destructive, evidence: row.evidence, review: row.marker };
}

/**
 * @param {import('./exporter.js').SidecarRow} row
 * @returns {Record<string, string|boolean>}
 */
function metaForRow(row) {
  return {
    'io.github.hamr0.rwxmap/class': row.letter,
    'io.github.hamr0.rwxmap/destructive': row.destructive,
    'io.github.hamr0.rwxmap/evidence': row.evidence,
    'io.github.hamr0.rwxmap/review': row.marker,
  };
}

// A CLI-level failure that should print cleanly to stderr and exit 1,
// without a stack trace — as opposed to a genuine bug in this file.
class CliError extends Error {}

/**
 * Resolve the input argument to a flat operation list plus the address
 * actually used as `source`. Never writes anything and makes no vendor
 * decision — that is resolveVendor's job below, kept separate so a
 * --vendor override never has to re-run I/O.
 *
 * @param {string} address
 * @param {{cacheDir?: string}} [findSpecOpts]
 * @returns {Promise<{ops: import('./types.js').Operation[], source: string, viaDiscover: boolean, isLocalFile: boolean, doc: any, specChanged: boolean}>}
 *   `doc` is the parsed document on EVERY path (D124): `ops` is always
 *   operationsFrom(doc) of that same document, so the OpenAPI copy and
 *   the letters describe one and the same spec. `specChanged` is true
 *   only on the discovered path, when the reloaded bytes' sha256 differs
 *   from the one discovery recorded (a cached result can be stale).
 *   `ops` may be empty (a local file, or a discovered spec on reload);
 *   run() refuses that in one place for every input kind.
 */
async function resolveInput(address, findSpecOpts = {}) {
  if (!isHttpUrl(address)) {
    // "An argument that is an existing local path -> loadSpec(path)."
    // No fallback to findSpec for a local path — a bare address is
    // necessarily something findSpec can probe over HTTP(S).
    let loaded;
    try {
      loaded = await loadSpec(address);
    } catch (err) {
      if (err && err.code === 'ENOENT') throw new CliError(`no such file: ${address}`);
      const reason = err instanceof Error ? err.message : String(err);
      throw new CliError(reason);
    }
    return { ops: operationsFrom(loaded.doc), source: address, viaDiscover: false, isLocalFile: true, doc: loaded.doc, specChanged: false };
  }

  // http(s) URL: try it as a spec first.
  /** @type {{ops: import('./types.js').Operation[], source: string, doc: any}|null} */
  let asSpec = null;
  let loadError = '';
  try {
    const loaded = await loadSpec(address);
    const ops = operationsFrom(loaded.doc);
    if (ops.length > 0) asSpec = { ops, source: address, doc: loaded.doc };
  } catch (err) {
    loadError = (err instanceof Error ? err.message : String(err)).replace(`loadSpec: ${address}: `, '');
  }
  if (asSpec) return { ...asSpec, viaDiscover: false, isLocalFile: false, specChanged: false };

  // Not a loadable spec, or a spec with zero operations: treat as a bare
  // API address and run discovery.
  const found = await findSpec(address, findSpecOpts);
  if (found.status !== 'found') {
    const reason = found.reason && found.reason !== 'no spec found' ? `: ${found.reason}` : '';
    const asSpecNote = loadError ? ` (as a spec: ${loadError})` : '';
    throw new CliError(`no spec found for ${address}${reason}${asSpecNote}`);
  }

  // D124: findSpec's result (and its cache) carries operations but not
  // the parsed document, so reload the spec it found ONCE, with
  // redirects refused (`redirect: 'manual'` makes load.js throw on any
  // 3xx — the reload is not run through discovery's per-hop safety walk,
  // so it must not follow anywhere). Operations, letters and the copy
  // all come from THIS document; found.ops is never mixed with it.
  let reloaded;
  try {
    reloaded = await loadSpec(found.specUrl, { headers: { 'User-Agent': `rwxmap/${packageVersion()}` }, redirect: 'manual' });
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    throw new CliError(`could not reload the discovered spec ${found.specUrl} (a redirect on reload is refused, never followed): ${reason}`);
  }
  // Zero operations on reload is refused by run()'s one zero-operations
  // check, the same one every input kind goes through.
  const ops = operationsFrom(reloaded.doc);
  return {
    ops,
    source: found.specUrl,
    viaDiscover: true,
    isLocalFile: false,
    doc: reloaded.doc,
    specChanged: reloaded.sha256 !== found.sha256,
  };
}

/**
 * The approved vendor default. `--vendor` always wins (checked by the
 * caller before this runs). A URL or bare address defaults to its own
 * host, computed the same way discover.js's own safety check does
 * (`new URL(...).hostname.toLowerCase()` — a one-line stdlib call, not
 * logic worth exporting). A local file defaults to the spec's own first
 * resolved server's host (user ruling), read through discover.js's
 * exported `firstServerHost` — the one writer of that resolution, never
 * re-derived here. No servers (or none resolve) -> null, which the
 * caller turns into an error asking for --vendor.
 *
 * @param {string} address
 * @param {boolean} isLocalFile
 * @param {any} doc  The local file's parsed document; ignored when
 *   `isLocalFile` is false.
 * @returns {string|null}
 */
function defaultVendor(address, isLocalFile, doc) {
  if (isLocalFile) return firstServerHost(doc, address);
  try {
    return new URL(address).hostname.toLowerCase();
  } catch {
    return null;
  }
}

/**
 * Build the `mcp` dict (D122) and the `webmcp` dict (D124): one entry
 * each per operation, keyed `"METHOD path"`. Both are filled in this ONE
 * loop from the same row, so they share keys and every collision
 * decision — `mcpCollisions` therefore covers `webmcp` too. `ops` and `sidecarRows` MUST be the same length and in
 * the same order — exportSidecar's classifyAll pushes exactly one row per
 * input operation, in input order, so zipping by index reads the
 * operationId (only `ops` carries it) beside the letter/marker/evidence
 * (only the sidecar row carries those). Neither is re-derived from the
 * other.
 *
 * A duplicate "METHOD path" key cannot arise from a valid OpenAPI
 * document (a `paths` object cannot repeat a path string, and a path
 * item cannot repeat a method), but this stays defensive rather than
 * silent: on a collision the tighter class wins (never loosened) and the
 * loser is reported back to the caller for the sidecar note, exactly the
 * same shape exporter.js's own collisions use.
 *
 * @param {import('./types.js').Operation[]} ops
 * @param {import('./exporter.js').SidecarRow[]} sidecarRows
 * @returns {{mcp: Record<string, any>, webmcp: Record<string, any>, mcpCollisions: Array<{key: string, kept: string, dropped: string}>}}
 */
function buildHintDicts(ops, sidecarRows) {
  /** @type {Record<string, any>} */
  const mcp = {};
  /** @type {Record<string, any>} */
  const webmcp = {};
  /** @type {Array<{key: string, kept: string, dropped: string}>} */
  const mcpCollisions = [];

  for (let i = 0; i < ops.length; i++) {
    const op = ops[i];
    const row = sidecarRows[i];
    const key = `${row.method} ${row.path}`;
    const entry = {
      ...(typeof op.operationId === 'string' && op.operationId ? { operationId: op.operationId } : {}),
      annotations: annotationsForClass(row.letter),
      _meta: metaForRow(row),
    };

    const webmcpEntry = { annotations: webmcpAnnotationsForClass(row.letter) };

    const existing = mcp[key];
    if (!existing) {
      mcp[key] = entry;
      webmcp[key] = webmcpEntry;
      continue;
    }
    const existingLetter = existing._meta['io.github.hamr0.rwxmap/class'];
    if (TIGHTNESS[row.letter] > TIGHTNESS[existingLetter]) {
      mcpCollisions.push({ key, kept: row.letter, dropped: existingLetter });
      mcp[key] = entry;
      webmcp[key] = webmcpEntry;
    } else {
      mcpCollisions.push({ key, kept: existingLetter, dropped: row.letter });
    }
  }

  return { mcp, webmcp, mcpCollisions };
}

/**
 * Count two kinds of number in a parsed document, separately:
 *   - `nonFinite`: YAML `.inf`, `-.inf`, `.nan`. JSON cannot hold them;
 *     JSON.stringify writes null, so the copy loses them.
 *   - `bigIntegers`: integers past +-2^53 (not safe integers). Precision
 *     is lost at YAML/JSON PARSE time, not at the copy, so it cannot be
 *     detected after parsing: such a value MAY already be rounded (which
 *     affects what the letters were computed from too), or may be exact
 *     (1e21 is held exactly and still counts here). Reported as "may".
 * Walked the way JSON.stringify walks it: a value reached twice through a
 * YAML alias is written twice, so it counts twice. An object already on
 * the current walk path (a self-referencing alias) is skipped here;
 * JSON.stringify throws on it anyway.
 *
 * @param {any} doc
 * @returns {{nonFinite: number, bigIntegers: number}}
 */
function countJsonNumberIssues(doc) {
  const counts = { nonFinite: 0, bigIntegers: 0 };
  const onPath = new Set();
  /** @param {any} v */
  const walk = (v) => {
    if (typeof v === 'number') {
      if (!Number.isFinite(v)) counts.nonFinite += 1;
      else if (Number.isInteger(v) && !Number.isSafeInteger(v)) counts.bigIntegers += 1;
      return;
    }
    if (!v || typeof v !== 'object' || onPath.has(v)) return;
    onPath.add(v);
    for (const child of Object.values(v)) walk(child);
    onPath.delete(v);
  };
  walk(doc);
  return counts;
}

/**
 * Count the OpenAPI 3.2 operations operationEntries does not walk (item g
 * will label them): each `paths[p].query` that is an object, plus each
 * object entry of `paths[p].additionalOperations`. Reporting only — this
 * never changes which operations are classified.
 *
 * @param {any} doc
 * @returns {number}
 */
function countUnlabelledOperations(doc) {
  const paths = doc && typeof doc === 'object' ? doc.paths : undefined;
  if (!paths || typeof paths !== 'object') return 0;
  let n = 0;
  for (const item of Object.values(paths)) {
    if (!item || typeof item !== 'object') continue;
    if (item.query && typeof item.query === 'object') n += 1;
    const extra = item.additionalOperations;
    if (extra && typeof extra === 'object') {
      for (const op of Object.values(extra)) if (op && typeof op === 'object') n += 1;
    }
  }
  return n;
}

/**
 * The OpenAPI copy (D124, PRD Carrier 1): a deep copy of the parsed input
 * document with `x-rwx` set on every operation object. Never touches
 * `doc` itself.
 *
 * The copy is a JSON round trip, not structuredClone, ON PURPOSE: a YAML
 * alias makes two operations the SAME JS object, and structuredClone
 * keeps that sharing, so writing one operation's `x-rwx` would silently
 * overwrite the other's. A JSON round trip splits them, and the output
 * is JSON anyway. (A self-referencing YAML alias cannot be written as
 * JSON at all; JSON.stringify throws and the run fails loudly.)
 *
 * The copy's operation objects are found by exporter.js's
 * operationEntries — the same walk operationsFrom uses — and zipped by
 * index with `sidecarRows`. Each pairing is checked (method and path must
 * match) and a mismatch THROWS rather than labelling the wrong object.
 *
 * The round trip is lossy where JSON cannot hold a value (see
 * countJsonNumberIssues); the copy stays JSON (D124) and `nonFinite` /
 * `bigIntegers` count those values so the run can say so.
 *
 * @param {any} doc  The parsed input document `ops` came from.
 * @param {import('./exporter.js').SidecarRow[]} sidecarRows  One per
 *   operation, same order as operationsFrom(doc).
 * @returns {{copy: any, overwritten: number, nonFinite: number, bigIntegers: number}}
 *   `overwritten` counts the operations that already carried an `x-rwx`
 *   in the input; `nonFinite` the values written as null; `bigIntegers`
 *   the integers past 2^53 that may already have been rounded at parse.
 */
function buildOpenApiCopy(doc, sidecarRows) {
  const { nonFinite, bigIntegers } = countJsonNumberIssues(doc);
  const copy = JSON.parse(JSON.stringify(doc));
  const entries = operationEntries(copy);
  if (entries.length !== sidecarRows.length) {
    throw new Error(`cli: OpenAPI copy has ${entries.length} operation(s) but ${sidecarRows.length} verdict row(s)`);
  }
  let overwritten = 0;
  for (let i = 0; i < entries.length; i += 1) {
    const { path: p, field, operation } = entries[i];
    const row = sidecarRows[i];
    if (field.toUpperCase() !== row.method || p !== row.path) {
      throw new Error(`cli: OpenAPI copy operation ${i} is ${field.toUpperCase()} ${p}, verdict row is ${row.method} ${row.path}`);
    }
    if (Object.prototype.hasOwnProperty.call(operation, 'x-rwx')) overwritten += 1;
    operation['x-rwx'] = xRwxForRow(row);
  }
  return { copy, overwritten, nonFinite, bigIntegers };
}

/**
 * Write every file in `files` atomically (tmp file + rename), and roll the
 * whole set back on any failure:
 *   1. every tmp file is written first; if any write fails, the tmp files
 *      already written are removed and nothing else is touched;
 *   2. then, per file, an existing target (anything but a directory) gets
 *      a backup under a unique name in the same directory — a HARD LINK
 *      to it (fs.linkSync), or where hard links are not supported a copy
 *      (a symlink target is recreated as the same symlink) —
 *      and the tmp file is renamed onto the target. That rename replaces
 *      the target atomically, so the target path exists at every instant:
 *      the old file is never moved away first;
 *   3. on any failure in step 2, every file already replaced is restored
 *      by renaming its backup back onto it (atomic too), a file that had
 *      no old version is removed, and every leftover tmp file and backup
 *      is removed — so a failed --force leaves the old files byte-identical;
 *   4. on success, the backups are deleted.
 * Each file is replaced atomically, but the set is not: a hard kill
 * mid-set can leave a mix of old and new files plus stray .tmp/.bak
 * files — never a missing one. A directory at a target path gets no
 * backup; the rename onto it fails and step 3 rolls back.
 *
 * @param {Array<{targetPath: string, content: string}>} files
 * @param {(targetPath: string) => void} [beforeReplace]  Test-only seam
 *   (run's `env.beforeReplace`): called after a file's backup is made and
 *   before its tmp file is renamed onto it. The real CLI never passes it.
 */
function atomicWriteFiles(files, beforeReplace) {
  const withTmp = files.map((f) => {
    // Math.random() can return 0, whose base-36 digits are empty; '0' keeps
    // the segment non-empty so countLeftovers' `+` still matches it.
    const unique = `${process.pid}.${Date.now()}.${Math.random().toString(36).slice(2) || '0'}`;
    return { ...f, tmpPath: `${f.targetPath}.${unique}.tmp`, backupPath: `${f.targetPath}.${unique}.bak` };
  });

  const tmpWritten = [];
  try {
    for (const f of withTmp) {
      fs.writeFileSync(f.tmpPath, f.content);
      tmpWritten.push(f.tmpPath);
    }
  } catch (err) {
    for (const p of tmpWritten) {
      try { fs.unlinkSync(p); } catch { /* best effort */ }
    }
    throw err;
  }

  /** @type {string[]} */
  const backups = [];
  /** @type {Array<{targetPath: string, backupPath: string|null}>} */
  const replaced = [];
  try {
    for (const f of withTmp) {
      /** @type {fs.Stats|null} */
      let existing = null;
      try { existing = fs.lstatSync(f.targetPath); } catch { /* no old file */ }
      /** @type {string|null} */
      let backupPath = null;
      if (existing && !existing.isDirectory()) {
        try {
          fs.linkSync(f.targetPath, f.backupPath);
        } catch {
          // No hard links here: back up by file type. A symlink is
          // recreated as a symlink (copyFileSync would follow it and the
          // rollback would turn the link into a plain file).
          if (existing.isSymbolicLink()) fs.symlinkSync(fs.readlinkSync(f.targetPath), f.backupPath);
          else fs.copyFileSync(f.targetPath, f.backupPath);
        }
        backupPath = f.backupPath;
        backups.push(f.backupPath);
      }
      if (beforeReplace) beforeReplace(f.targetPath);
      fs.renameSync(f.tmpPath, f.targetPath);
      replaced.push({ targetPath: f.targetPath, backupPath });
    }
  } catch (err) {
    for (const r of replaced) {
      try {
        if (r.backupPath) fs.renameSync(r.backupPath, r.targetPath);
        else fs.unlinkSync(r.targetPath);
      } catch { /* best effort */ }
    }
    for (const p of backups) {
      try { fs.unlinkSync(p); } catch { /* best effort, may already be restored */ }
    }
    for (const f of withTmp) {
      try { fs.unlinkSync(f.tmpPath); } catch { /* best effort, may already be gone */ }
    }
    throw err;
  }

  for (const p of backups) {
    try { fs.unlinkSync(p); } catch { /* best effort */ }
  }
}

/**
 * Count stray .tmp/.bak files an interrupted atomicWriteFiles run left in
 * `dir` — only this tool's own naming (`<target>.<pid>.<ms>.<base36>.tmp`
 * or `.bak`, as atomicWriteFiles builds them) for the given target
 * basenames. Read-only: the files are reported, never touched (a .bak can
 * be the user's only copy of a previous version). A missing or unreadable
 * dir counts as none.
 * @param {string} dir
 * @param {string[]} basenames
 * @returns {number}
 */
function countLeftovers(dir, basenames) {
  let entries;
  try { entries = fs.readdirSync(dir); } catch { return 0; }
  const suffix = /^\.\d+\.\d+\.[0-9a-z]+\.(?:bak|tmp)$/;
  return entries.filter((e) => basenames.some((b) => e.startsWith(b) && suffix.test(e.slice(b.length)))).length;
}

/**
 * The `jev` top-level field's shape when no key was configured (D122's
 * combined JSON, extended by item c). The one writer of this default —
 * `runJev` below builds the "on" version, never this file's other code.
 * @returns {{mode: 'off', model: null, sent: 0, answered: 0, failed: 0, changed: 0, tokens: {input: 0, output: 0}}}
 */
function jevOffSummary() {
  return { mode: 'off', model: null, sent: 0, answered: 0, failed: 0, changed: 0, tokens: { input: 0, output: 0 } };
}

/**
 * Build the combined output and the sidecar from an already-resolved
 * operation list. Pure — no I/O, no process exit — so both `run` (which
 * writes the result to disk) and `tools/proof-cli.js` (which never writes
 * a file, per its own go/no-go bars) call this SAME function rather than
 * two copies that could drift apart.
 *
 * @param {import('./types.js').Operation[]} ops
 * @param {string} vendor
 * @param {string} source
 * @param {{verdicts?: import('./types.js').Verdict[], jevSummary?: object, doc?: any}} [options]
 *   `verdicts` is the FINAL (post-Jev, or plain mechanical) verdict list,
 *   same order as `ops` — omitted (mechanical-only callers, e.g.
 *   tools/proof-cli.js) falls back to exportGate/exportSidecar's own
 *   default of classifying `ops` themselves, unchanged from item d.
 *   `jevSummary` is the combined JSON's top-level `jev` field; omitted
 *   defaults to the "off" shape. `doc` is the parsed document `ops`
 *   came from (`ops` must be operationsFrom(doc)); given, the result
 *   also carries the OpenAPI copy (D124) as `openapiCopy` plus
 *   `xRwxOverwritten`, `openapiNonFinite` and `openapiBigIntegers`;
 *   omitted, they are null/0/0/0. Each of the last two, when non-zero, is
 *   also written into the sidecar's `counts` (absent when 0, like
 *   `mcpCollisions`).
 * @returns {{combined: any, sidecarOut: any, collisions: import('./exporter.js').Collision[], mcpCollisions: Array<{key: string, kept: string, dropped: string}>, openapiCopy: any, xRwxOverwritten: number, openapiNonFinite: number, openapiBigIntegers: number}}
 */
export function buildOutput(ops, vendor, source, options = {}) {
  const { verdicts, jevSummary = jevOffSummary(), doc } = options;
  const { tools, collisions } = exportGate(ops, { vendor, verdicts });
  const sidecar = exportSidecar(ops, { vendor, verdicts });
  const { mcp, webmcp, mcpCollisions } = buildHintDicts(ops, sidecar.rows);
  const { copy: openapiCopy, overwritten: xRwxOverwritten, nonFinite: openapiNonFinite, bigIntegers: openapiBigIntegers } = doc === undefined
    ? { copy: null, overwritten: 0, nonFinite: 0, bigIntegers: 0 }
    : buildOpenApiCopy(doc, sidecar.rows);

  const combined = {
    rwxmapVersion: packageVersion(),
    source,
    vendor,
    bareguard: { tools },
    mcp,
    webmcp,
    jev: jevSummary,
  };
  let sidecarOut = mcpCollisions.length > 0 ? { ...sidecar, mcpCollisions } : sidecar;
  if (openapiNonFinite > 0 || openapiBigIntegers > 0) {
    /** @type {any} */
    const counts = { ...sidecarOut.counts };
    if (openapiNonFinite > 0) counts.openapiNonFinite = openapiNonFinite;
    if (openapiBigIntegers > 0) counts.openapiBigIntegers = openapiBigIntegers;
    sidecarOut = { ...sidecarOut, counts };
  }

  return { combined, sidecarOut, collisions, mcpCollisions, openapiCopy, xRwxOverwritten, openapiNonFinite, openapiBigIntegers };
}

/**
 * The Jev key (D118): RWXMAP_JEV_KEY from the environment, else the
 * RWXMAP_JEV_KEY entry of a `.env` file in `cwd`, read with
 * fs.readFileSync and parsed with Node's own util.parseEnv. Only that one
 * entry is taken: nothing from `.env` is ever written to process.env (so a
 * proxy or any other variable in it never changes this process), and an
 * already-set environment variable always wins. A missing, unreadable or
 * malformed `.env` means no key, and the run stays mechanical (D118's
 * "no key -> mechanical, never stops"). An EMPTY RWXMAP_JEV_KEY in the
 * environment counts as unset, so a `.env` key is still used (D125).
 *
 * @param {string} cwd
 * @returns {string|undefined}
 */
function loadJevKey(cwd) {
  if (typeof process.env.RWXMAP_JEV_KEY === 'string' && process.env.RWXMAP_JEV_KEY !== '') {
    return process.env.RWXMAP_JEV_KEY;
  }
  let parsed;
  try {
    parsed = parseEnv(fs.readFileSync(path.join(cwd, '.env'), 'utf8'));
  } catch {
    return undefined; // missing, unreadable or malformed .env: no key.
  }
  const key = parsed.RWXMAP_JEV_KEY;
  return typeof key === 'string' && key !== '' ? key : undefined;
}

/**
 * Run the optional Jev tiers (D118-120) over one mechanically-classified
 * batch. NEVER THROWS and NEVER STOPS THE RUN: any row Jev cannot usefully
 * answer for (a request failure, a bad/missing answer) keeps exactly the
 * mechanical verdict `verdicts` already gave it — jev.js's applyJev is the
 * one place that decides that, and it already fails closed, so this
 * function only has to feed it real answers or nothing at all.
 *
 * Sends ONLY the rows jev.js's needsJev names — one askJev call per such
 * row, never the whole operation list — so the request count this run
 * makes is exactly the count it reports as "sent".
 *
 * @param {import('./types.js').Operation[]} ops
 * @param {import('./types.js').Verdict[]} verdicts  mechanical, same
 *   length/order as `ops` (exporter.js's classifyOperations).
 * @param {{key: string, fetchImpl: typeof fetch, model?: string, concurrency?: number}} jevOpts
 * `summary.tokens` sums the answered rows' own usage (askJev's `usage`);
 * a failed row contributes nothing. The usage never reaches applyJev,
 * which is handed only `{p, model}`, so it never lands in a sidecar row.
 *
 * @returns {Promise<{verdicts: import('./types.js').Verdict[], summary: {mode: 'on', model: string|null, sent: number, answered: number, failed: number, changed: number, tokens: {input: number, output: number}}}>}
 */
async function runJev(ops, verdicts, jevOpts) {
  /** @type {{index: number, tier: string}[]} */
  const targets = [];
  for (let i = 0; i < verdicts.length; i += 1) {
    const tier = needsJev(verdicts[i]);
    if (tier) targets.push({ index: i, tier });
  }

  const items = targets.map((t) => ({ row: ops[t.index], tier: t.tier }));
  const answers = items.length > 0 ? await runJevBatch(items, jevOpts) : [];

  const finalVerdicts = verdicts.slice();
  let answered = 0;
  let failed = 0;
  let changed = 0;
  const tokens = { input: 0, output: 0 };
  /** @type {string|null} */
  let model = null;

  for (let j = 0; j < targets.length; j += 1) {
    const { index } = targets[j];
    const answer = answers[j];
    if (!answer) {
      failed += 1;
      continue;
    }
    answered += 1;
    tokens.input += answer.usage.input;
    tokens.output += answer.usage.output;
    if (!model) model = answer.model;
    const moved = applyJev(verdicts[index], { p: answer.p, model: answer.model }, { method: ops[index].method });
    finalVerdicts[index] = moved;
    if (moved.class !== verdicts[index].class) changed += 1;
  }

  return {
    verdicts: finalVerdicts,
    summary: { mode: 'on', model, sent: items.length, answered, failed, changed, tokens },
  };
}

const USAGE = 'usage: rwxmap <spec URL | local file | bare API address> [-o <dir>] [--vendor <name>] [--force]';

const HELP = `${USAGE}

Input:
  local file     an OpenAPI 3.x or Swagger 2.0 file, JSON or YAML
  spec URL       an http(s) address that serves such a spec
  API address    an http(s) address with no spec of its own; looks in the common places

Options:
  -o <dir>       write the output files here (default: the current folder)
  --vendor <n>   name for the output files and tool keys (default: the host)
  --force        overwrite existing output files
  -h, -v         this help; the version

Writes <vendor>.rwxmap.json, <vendor>.rwxmap.review.json, <vendor>.openapi.rwx.json.

Jev (optional model pass): set RWXMAP_JEV_KEY, or put it in a .env in the run folder. Without it the run is mechanical.

Exit 0 on success; 1 on failure, with nothing written.
`;

/**
 * The testable core: no process.exit, no direct stdout/stderr — everything
 * observable goes through the injected streams and the return value, so
 * tests never have to spawn a process.
 *
 * @param {string[]} argv  Arguments only (no "node"/script path).
 * @param {{cwd: string, stdout: {write: (s: string) => void}, stderr: {write: (s: string) => void}, cacheDir?: string, jevKey?: string, fetchImpl?: typeof fetch, jevConcurrency?: number, beforeReplace?: (targetPath: string) => void}} env
 *   `jevKey`, `fetchImpl` and `jevConcurrency` are test-only overrides for
 *   the Jev wiring (D118), the same pattern `cacheDir` already uses for
 *   discovery: `jevKey` bypasses loadJevKey's environment/.env read
 *   entirely (so a test never has to touch real process.env or a real
 *   `.env` file), and `fetchImpl` bypasses the real network `fetch` (so no
 *   test may reach the real Jev endpoint). Neither is a documented CLI
 *   flag; the real entry point below never passes either, so a real run
 *   always uses loadJevKey and the real global fetch. `beforeReplace` is
 *   the same kind of test-only seam for atomicWriteFiles (called between
 *   a file's backup and its replacing rename); a real run never passes it.
 * @returns {Promise<number>}  Process exit code.
 */
export async function run(argv, env) {
  const { cwd, stdout, stderr } = env;
  const findSpecOpts = env.cacheDir ? { cacheDir: env.cacheDir } : {};

  let values;
  let positionals;
  try {
    ({ values, positionals } = parseArgs({
      args: argv,
      allowPositionals: true,
      options: {
        outDir: { type: 'string', short: 'o' },
        vendor: { type: 'string' },
        force: { type: 'boolean', default: false },
        help: { type: 'boolean', short: 'h', default: false },
        version: { type: 'boolean', short: 'v', default: false },
      },
    }));
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    stderr.write(`rwxmap: ${reason}\n${USAGE}\n`);
    return 1;
  }

  if (values.help) {
    stdout.write(HELP);
    return 0;
  }
  if (values.version) {
    stdout.write(`${packageVersion()}\n`);
    return 0;
  }

  if (positionals.length !== 1) {
    stderr.write(`rwxmap: expected exactly one address, got ${positionals.length}\n${USAGE}\n`);
    return 1;
  }
  const address = positionals[0];
  const outDir = values.outDir ? path.resolve(cwd, values.outDir) : cwd;

  let ops;
  let source;
  let isLocalFile;
  let doc;
  let specChanged;
  try {
    ({ ops, source, isLocalFile, doc, specChanged } = await resolveInput(address, findSpecOpts));
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    stderr.write(`rwxmap: ${reason}\n`);
    return 1;
  }

  // One rule for every input kind: nothing to classify -> exit 1, no file.
  // A spec whose only operations sit under OpenAPI 3.2 query/
  // additionalOperations (not read yet, item g) says so instead.
  if (ops.length === 0) {
    const unread = countUnlabelledOperations(doc);
    stderr.write(
      unread > 0
        ? `rwxmap: no labelled operations in ${source} — ${unread} operation(s) under OpenAPI 3.2 query/additionalOperations are not read yet (item g)\n`
        : `rwxmap: no operations found in ${source}\n`,
    );
    return 1;
  }

  if (specChanged) {
    stdout.write('rwxmap: spec changed since discovery cached it (sha256 differs); used the fresh copy\n');
  }

  const vendor = values.vendor ? String(values.vendor) : defaultVendor(address, isLocalFile, doc);
  if (!vendor) {
    stderr.write(
      isLocalFile
        ? 'rwxmap: no vendor — pass --vendor (the spec declares no servers to default from)\n'
        : 'rwxmap: no vendor — pass --vendor\n',
    );
    return 1;
  }

  const mapPath = path.join(outDir, `${vendor}.rwxmap.json`);
  const reviewPath = path.join(outDir, `${vendor}.rwxmap.review.json`);
  const openapiPath = path.join(outDir, `${vendor}.openapi.rwx.json`);

  const leftovers = countLeftovers(outDir, [mapPath, reviewPath, openapiPath].map((p) => path.basename(p)));
  if (leftovers > 0) {
    stdout.write(
      `rwxmap: ${leftovers} possible leftover .bak/.tmp file(s) in ${outDir} (from an interrupted run, or another rwxmap run still writing; a .bak holds the previous version of that file); not touched, remove them when done\n`,
    );
  }

  if (!values.force) {
    const existing = [mapPath, reviewPath, openapiPath].filter((p) => fs.existsSync(p));
    if (existing.length > 0) {
      stderr.write(`rwxmap: refusing to overwrite existing file(s) without --force: ${existing.join(', ')}\n`);
      return 1;
    }
  }

  // Classify mechanically ONCE (D118: "one classification per run, one
  // writer"). A configured key runs the optional Jev tiers over exactly
  // the rows jev.js's needsJev names; no key means jevSummary stays the
  // "off" shape and `verdicts` stays the mechanical pass untouched.
  const verdicts = classifyOperations(ops);
  /** @type {{mode: 'off'|'on', model: string|null, sent: number, answered: number, failed: number, changed: number, tokens: {input: number, output: number}}} */
  let jevSummary = jevOffSummary();
  const key = typeof env.jevKey === 'string' ? env.jevKey : loadJevKey(cwd);
  if (key) {
    const targetCount = verdicts.reduce((n, v) => (needsJev(v) ? n + 1 : n), 0);
    stdout.write(
      `rwxmap: Jev: on — sends method, path, operationId, summary, description of ${targetCount} operation(s) to api.typesafe.ai. Your key, your cost.\n`,
    );
    const fetchImpl = env.fetchImpl || globalThis.fetch;
    const result = await runJev(ops, verdicts, { key, fetchImpl, concurrency: env.jevConcurrency });
    verdicts.splice(0, verdicts.length, ...result.verdicts);
    jevSummary = result.summary;
  }

  let built;
  try {
    built = buildOutput(ops, vendor, source, { verdicts, jevSummary, doc });
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    stderr.write(`rwxmap: could not build output: ${reason}\n`);
    return 1;
  }
  const { combined, sidecarOut, collisions, mcpCollisions, openapiCopy, xRwxOverwritten, openapiNonFinite, openapiBigIntegers } = built;

  try {
    fs.mkdirSync(outDir, { recursive: true });
    atomicWriteFiles([
      { targetPath: mapPath, content: `${JSON.stringify(combined, null, 2)}\n` },
      { targetPath: reviewPath, content: `${JSON.stringify(sidecarOut, null, 2)}\n` },
      { targetPath: openapiPath, content: `${JSON.stringify(openapiCopy, null, 2)}\n` },
    ], env.beforeReplace);
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    stderr.write(`rwxmap: could not write output: ${reason}\n`);
    return 1;
  }

  const total = sidecarOut.counts.rows;
  const { r, w, x } = sidecarOut.counts.byLetter;
  const { settled, loose, tight } = sidecarOut.counts.byMarker;
  const pctOf = (n) => (total === 0 ? 0 : Math.round((100 * n) / total));

  stdout.write(`rwxmap: ${vendor} — ${total} operations (r ${r} · w ${w} · x ${x})\n`);
  stdout.write(
    `rwxmap: settled ${settled} (${pctOf(settled)}%) · loose ${loose} (${pctOf(loose)}%) · tight ${tight} (${pctOf(tight)}%)\n`,
  );
  stdout.write(
    jevSummary.mode === 'on'
      ? `rwxmap: Jev: on — ${jevSummary.sent} sent · ${jevSummary.answered} answered · ${jevSummary.failed} failed (kept mechanical) · ${jevSummary.changed} letters changed · ${jevSummary.tokens.input} in / ${jevSummary.tokens.output} out tokens\n`
      : 'rwxmap: Jev: off (mechanical)\n',
  );
  stdout.write(`rwxmap: wrote ${path.basename(mapPath)} + ${path.basename(reviewPath)} + ${path.basename(openapiPath)}\n`);
  if (xRwxOverwritten > 0) {
    stdout.write(`rwxmap: ${xRwxOverwritten} existing x-rwx overwritten in the copy\n`);
  }
  if (openapiNonFinite > 0) {
    stdout.write(
      `rwxmap: ${openapiNonFinite} value(s) can't be written as JSON (.inf/.nan); the copy holds null there; your original is unchanged\n`,
    );
  }
  if (openapiBigIntegers > 0) {
    stdout.write(
      `rwxmap: ${openapiBigIntegers} integer(s) past 2^53 in the spec may already be rounded (JavaScript numbers); check them in the copy\n`,
    );
  }
  const unlabelled = countUnlabelledOperations(doc);
  if (unlabelled > 0) {
    stdout.write(
      `rwxmap: ${unlabelled} operation(s) under OpenAPI 3.2 query/additionalOperations are not labelled yet (no letter, no key, no x-rwx)\n`,
    );
  }
  if (collisions.length > 0 || mcpCollisions.length > 0) {
    stdout.write(
      `rwxmap: ${collisions.length} bareguard key collision(s), ${mcpCollisions.length} mcp key collision(s) — see the sidecar\n`,
    );
  }

  return 0;
}

// ---------------------------------------------------------------------
// Process entry point — only runs when this file is executed directly
// (`rwxmap ...` / `node src/cli.js ...`), never on `import './cli.js'`,
// so a test can import `run` without triggering a real process exit.
// Both sides are realpaths: npm's bin link and npx run this file through a
// symlink, and Node resolves import.meta.url through it but not argv[1].
// ---------------------------------------------------------------------
function isMainModule() {
  if (!process.argv[1]) return false;
  try {
    return fs.realpathSync(process.argv[1]) === fs.realpathSync(fileURLToPath(import.meta.url));
  } catch {
    return false;
  }
}
const isMain = isMainModule();
if (isMain) {
  const code = await run(process.argv.slice(2), { cwd: process.cwd(), stdout: process.stdout, stderr: process.stderr });
  process.exitCode = code;
}
