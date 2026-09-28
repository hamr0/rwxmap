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
// THIS IS NOT CORE (D109): it never imports tokens.js, step1-3.js, flow.js
// or jev.js directly, and holds no word list and no r/w/x judgement.
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
// Mechanical only. Jev (PRD item c) is wired in later; every run says so
// on stdout ("Jev: off (mechanical)") because the mode is otherwise
// silent and a consumer should never have to guess which ran.
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
// Dependency rule (CLAUDE.md): vanilla Node >= 22 ESM, node:util's
// parseArgs, node:fs/path. No new dependency.

import { parseArgs } from 'node:util';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { loadSpec } from './load.js';
import { findSpec, firstServerHost } from './discover.js';
import { operationsFrom, exportGate, exportSidecar } from './exporter.js';

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
 * @returns {Promise<{ops: import('./types.js').Operation[], source: string, viaDiscover: boolean, isLocalFile: boolean, doc: any}>}
 *   `doc` is the parsed document for a local file (so resolveVendor can
 *   read its own `servers`), and null for anything loaded over HTTP(S) —
 *   a URL/bare-address vendor never reads the spec, it's the address's
 *   own host (see resolveVendor), so there is no reason to carry a
 *   (possibly large) parsed doc through that path.
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
      const reason = err instanceof Error ? err.message : String(err);
      throw new CliError(reason);
    }
    return { ops: operationsFrom(loaded.doc), source: address, viaDiscover: false, isLocalFile: true, doc: loaded.doc };
  }

  // http(s) URL: try it as a spec first.
  /** @type {{ops: import('./types.js').Operation[], source: string}|null} */
  let asSpec = null;
  try {
    const loaded = await loadSpec(address);
    const ops = operationsFrom(loaded.doc);
    if (ops.length > 0) asSpec = { ops, source: address };
  } catch {
    asSpec = null;
  }
  if (asSpec) return { ...asSpec, viaDiscover: false, isLocalFile: false, doc: null };

  // Not a loadable spec, or a spec with zero operations: treat as a bare
  // API address and run discovery.
  const found = await findSpec(address, findSpecOpts);
  if (found.status !== 'found') {
    const reason = found.reason ? `: ${found.reason}` : '';
    throw new CliError(`no spec found for ${address}${reason}`);
  }
  return { ops: found.ops, source: found.specUrl, viaDiscover: true, isLocalFile: false, doc: null };
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
 * Build the `mcp` dict (D122): one entry per operation, keyed
 * `"METHOD path"`. `ops` and `sidecarRows` MUST be the same length and in
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
 * @returns {{mcp: Record<string, any>, mcpCollisions: Array<{key: string, kept: string, dropped: string}>}}
 */
function buildMcp(ops, sidecarRows) {
  /** @type {Record<string, any>} */
  const mcp = {};
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

    const existing = mcp[key];
    if (!existing) {
      mcp[key] = entry;
      continue;
    }
    const existingLetter = existing._meta['io.github.hamr0.rwxmap/class'];
    if (TIGHTNESS[row.letter] > TIGHTNESS[existingLetter]) {
      mcpCollisions.push({ key, kept: row.letter, dropped: existingLetter });
      mcp[key] = entry;
    } else {
      mcpCollisions.push({ key, kept: existingLetter, dropped: row.letter });
    }
  }

  return { mcp, mcpCollisions };
}

/**
 * Write every file in `files` atomically (tmp file + rename), all or
 * nothing: if any tmp write fails, every tmp file already written is
 * removed and nothing is renamed; if any rename fails after some already
 * succeeded, the already-renamed targets are removed too (best-effort),
 * so a partial pair is never left behind.
 *
 * @param {Array<{targetPath: string, content: string}>} files
 */
function atomicWriteFiles(files) {
  const withTmp = files.map((f) => ({
    ...f,
    tmpPath: `${f.targetPath}.${process.pid}.${Date.now()}.${Math.random().toString(36).slice(2)}.tmp`,
  }));

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

  const renamed = [];
  try {
    for (const f of withTmp) {
      fs.renameSync(f.tmpPath, f.targetPath);
      renamed.push(f.targetPath);
    }
  } catch (err) {
    for (const p of renamed) {
      try { fs.unlinkSync(p); } catch { /* best effort */ }
    }
    for (const f of withTmp) {
      try { fs.unlinkSync(f.tmpPath); } catch { /* best effort, may already be gone */ }
    }
    throw err;
  }
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
 * @returns {{combined: any, sidecarOut: any, collisions: import('./exporter.js').Collision[], mcpCollisions: Array<{key: string, kept: string, dropped: string}>}}
 */
export function buildOutput(ops, vendor, source) {
  const { tools, collisions } = exportGate(ops, { vendor });
  const sidecar = exportSidecar(ops, { vendor });
  const { mcp, mcpCollisions } = buildMcp(ops, sidecar.rows);

  const combined = {
    rwxmapVersion: packageVersion(),
    source,
    vendor,
    bareguard: { tools },
    mcp,
  };
  const sidecarOut = mcpCollisions.length > 0 ? { ...sidecar, mcpCollisions } : sidecar;

  return { combined, sidecarOut, collisions, mcpCollisions };
}

const USAGE = 'usage: rwxmap <spec URL | local file | bare API address> [-o <dir>] [--vendor <name>] [--force]';

/**
 * The testable core: no process.exit, no direct stdout/stderr — everything
 * observable goes through the injected streams and the return value, so
 * tests never have to spawn a process.
 *
 * @param {string[]} argv  Arguments only (no "node"/script path).
 * @param {{cwd: string, stdout: {write: (s: string) => void}, stderr: {write: (s: string) => void}, cacheDir?: string}} env
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
      },
    }));
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    stderr.write(`rwxmap: ${reason}\n${USAGE}\n`);
    return 1;
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
  try {
    ({ ops, source, isLocalFile, doc } = await resolveInput(address, findSpecOpts));
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    stderr.write(`rwxmap: ${reason}\n`);
    return 1;
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

  const { combined, sidecarOut, collisions } = buildOutput(ops, vendor, source);

  const mapPath = path.join(outDir, `${vendor}.rwxmap.json`);
  const reviewPath = path.join(outDir, `${vendor}.rwxmap.review.json`);

  if (!values.force) {
    const existing = [mapPath, reviewPath].filter((p) => fs.existsSync(p));
    if (existing.length > 0) {
      stderr.write(`rwxmap: refusing to overwrite existing file(s) without --force: ${existing.join(', ')}\n`);
      return 1;
    }
  }

  try {
    fs.mkdirSync(outDir, { recursive: true });
    atomicWriteFiles([
      { targetPath: mapPath, content: `${JSON.stringify(combined, null, 2)}\n` },
      { targetPath: reviewPath, content: `${JSON.stringify(sidecarOut, null, 2)}\n` },
    ]);
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    stderr.write(`rwxmap: could not write output: ${reason}\n`);
    return 1;
  }

  const { r, w, x } = sidecarOut.counts.byLetter;
  stdout.write(`rwxmap: wrote ${mapPath}\n`);
  stdout.write(`rwxmap: wrote ${reviewPath}\n`);
  stdout.write(`rwxmap: ${sidecarOut.counts.rows} operations — r:${r} w:${w} x:${x}\n`);
  stdout.write(`rwxmap: ${sidecarOut.review.length} row(s) flagged for review\n`);
  if (collisions.length > 0) {
    stdout.write(`rwxmap: ${collisions.length} bareguard key collision(s) — see the sidecar\n`);
  }
  stdout.write('rwxmap: Jev: off (mechanical)\n');

  return 0;
}

// ---------------------------------------------------------------------
// Process entry point — only runs when this file is executed directly
// (`rwxmap ...` / `node src/cli.js ...`), never on `import './cli.js'`,
// so a test can import `run` without triggering a real process exit.
// ---------------------------------------------------------------------
const isMain = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);
if (isMain) {
  const code = await run(process.argv.slice(2), { cwd: process.cwd(), stdout: process.stdout, stderr: process.stderr });
  process.exitCode = code;
}
