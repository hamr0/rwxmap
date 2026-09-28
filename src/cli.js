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
// RWXMAP_JEV_KEY from the environment, else a `.env` file in `cwd` read
// through Node's own process.loadEnvFile (no dotenv dependency) -- an
// already-set variable wins and this file never reads or logs `.env`'s
// contents itself (loadEnvFile writes straight into process.env). With a
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
// Dependency rule (CLAUDE.md): vanilla Node >= 22 ESM, node:util's
// parseArgs, node:fs/path. No new dependency.

import { parseArgs } from 'node:util';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { loadSpec } from './load.js';
import { findSpec, firstServerHost } from './discover.js';
import { operationsFrom, exportGate, exportSidecar, classifyOperations } from './exporter.js';
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
 * @param {{verdicts?: import('./types.js').Verdict[], jevSummary?: object}} [options]
 *   `verdicts` is the FINAL (post-Jev, or plain mechanical) verdict list,
 *   same order as `ops` — omitted (mechanical-only callers, e.g.
 *   tools/proof-cli.js) falls back to exportGate/exportSidecar's own
 *   default of classifying `ops` themselves, unchanged from item d.
 *   `jevSummary` is the combined JSON's top-level `jev` field; omitted
 *   defaults to the "off" shape.
 * @returns {{combined: any, sidecarOut: any, collisions: import('./exporter.js').Collision[], mcpCollisions: Array<{key: string, kept: string, dropped: string}>}}
 */
export function buildOutput(ops, vendor, source, options = {}) {
  const { verdicts, jevSummary = jevOffSummary() } = options;
  const { tools, collisions } = exportGate(ops, { vendor, verdicts });
  const sidecar = exportSidecar(ops, { vendor, verdicts });
  const { mcp, mcpCollisions } = buildMcp(ops, sidecar.rows);

  const combined = {
    rwxmapVersion: packageVersion(),
    source,
    vendor,
    bareguard: { tools },
    mcp,
    jev: jevSummary,
  };
  const sidecarOut = mcpCollisions.length > 0 ? { ...sidecar, mcpCollisions } : sidecar;

  return { combined, sidecarOut, collisions, mcpCollisions };
}

/**
 * The Jev key (D118): RWXMAP_JEV_KEY from the environment, else a `.env`
 * file in `cwd` via Node's own process.loadEnvFile — an already-set
 * environment variable always wins and this function never reads or logs
 * `.env`'s own contents (loadEnvFile writes straight into process.env; a
 * malformed or unreadable `.env` is treated the same as no `.env` at all,
 * per D118's "no key -> mechanical, never stops"). A missing `.env` file
 * is not an error: `.env` is optional.
 *
 * @param {string} cwd
 * @returns {string|undefined}
 */
function loadJevKey(cwd) {
  if (typeof process.env.RWXMAP_JEV_KEY === 'string' && process.env.RWXMAP_JEV_KEY !== '') {
    return process.env.RWXMAP_JEV_KEY;
  }
  const envPath = path.join(cwd, '.env');
  if (fs.existsSync(envPath)) {
    try {
      process.loadEnvFile(envPath);
    } catch {
      // malformed .env: no key, the run stays mechanical.
    }
  }
  return typeof process.env.RWXMAP_JEV_KEY === 'string' && process.env.RWXMAP_JEV_KEY !== ''
    ? process.env.RWXMAP_JEV_KEY
    : undefined;
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

/**
 * The testable core: no process.exit, no direct stdout/stderr — everything
 * observable goes through the injected streams and the return value, so
 * tests never have to spawn a process.
 *
 * @param {string[]} argv  Arguments only (no "node"/script path).
 * @param {{cwd: string, stdout: {write: (s: string) => void}, stderr: {write: (s: string) => void}, cacheDir?: string, jevKey?: string, fetchImpl?: typeof fetch, jevConcurrency?: number}} env
 *   `jevKey`, `fetchImpl` and `jevConcurrency` are test-only overrides for
 *   the Jev wiring (D118), the same pattern `cacheDir` already uses for
 *   discovery: `jevKey` bypasses loadJevKey's environment/.env read
 *   entirely (so a test never has to touch real process.env or a real
 *   `.env` file), and `fetchImpl` bypasses the real network `fetch` (so no
 *   test may reach the real Jev endpoint). Neither is a documented CLI
 *   flag; the real entry point below never passes either, so a real run
 *   always uses loadJevKey and the real global fetch.
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

  const mapPath = path.join(outDir, `${vendor}.rwxmap.json`);
  const reviewPath = path.join(outDir, `${vendor}.rwxmap.review.json`);

  if (!values.force) {
    const existing = [mapPath, reviewPath].filter((p) => fs.existsSync(p));
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

  const { combined, sidecarOut, collisions, mcpCollisions } = buildOutput(ops, vendor, source, { verdicts, jevSummary });

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
  stdout.write(`rwxmap: wrote ${path.basename(mapPath)} + ${path.basename(reviewPath)}\n`);
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
// ---------------------------------------------------------------------
const isMain = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);
if (isMain) {
  const code = await run(process.argv.slice(2), { cwd: process.cwd(), stdout: process.stdout, stderr: process.stderr });
  process.exitCode = code;
}
