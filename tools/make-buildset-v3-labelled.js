// Builds data/relabel-buildset-2026-09-23/labelled.csv — the single labelled
// CSV for the D87 relabel of the write-heavy buildset. Test/dev tooling only
// — never part of the published library.
//
// Truth for this set lives in three places: data/buildset-2026-09-18/ops.csv
// carries the operation text but no row_id, label/key.csv maps each row_id to
// its operation (provider+method+path+operationId), and the nine
// relabel-buildset-2026-09-23/label/v3-labels-*.csv files carry the v3
// class/confidence/reason for all 1819 rows. This script joins the three and
// writes ONE row per buildset row to a single CSV, using the same header and
// column order as data/combined-2026-09-21/labelled.csv.
//
// The join key is provider+method+path+operationId, which is unique across all
// 1819 ops.csv rows (asserted below). It uses ops.csv's own domain-form
// provider values ("github.com"); the OUTPUT provider column is normalized to
// the bare vendor name ("github") so this file pools with
// data/combined-2026-09-21/labelled.csv, whose providers are bare and which a
// vendor-keyed scorer matches literally. The map is an explicit table, never a
// TLD-stripping regex, and an unmapped provider is a hard failure.
//
// TUNING DATA (D24) — never an exam, never a generalization claim. This file
// is an ADDITION beside data/buildset-2026-09-18/, which is never modified.
//
// Usage: node tools/make-buildset-v3-labelled.js [outPath]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseCsv, toCsv } from './csv.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const SRC_DIR = path.join(ROOT, 'data', 'buildset-2026-09-18');
const LABEL_DIR = path.join(ROOT, 'data', 'relabel-buildset-2026-09-23', 'label');
const DEFAULT_OUT = path.join(ROOT, 'data', 'relabel-buildset-2026-09-23', 'labelled.csv');

const SOURCE_SET = 'buildset-2026-09-18';
const EXPECTED_ROWS = 1819;
const HEADER = [
  'row_id', 'provider', 'method', 'path', 'operationId', 'summary', 'description',
  'truth_class', 'confidence', 'reason', 'source_set',
];

// ops.csv's domain-form provider -> the bare vendor name used by the pooled
// tuning corpus. Explicit on purpose: a regex that stripped the TLD would
// silently mangle a vendor added later.
const PROVIDER_MAP = new Map([
  ['github.com', 'github'],
  ['microsoft.com', 'microsoft'],
  ['gitea.io', 'gitea'],
  ['appcenter.ms', 'appcenter'],
  ['netbox.dev', 'netbox'],
  ['clearblade.com', 'clearblade'],
  ['keycloak.local', 'keycloak'],
  ['atlassian.com', 'atlassian'],
  ['dracoon.team', 'dracoon'],
  ['trello.com', 'trello'],
  ['box.com', 'box'],
  ['gitlab.com', 'gitlab'],
  ['launchdarkly.com', 'launchdarkly'],
]);

// The 13 bare vendor names the output must carry, stated independently of
// PROVIDER_MAP so a wrong entry in the map is caught rather than agreed with.
const EXPECTED_PROVIDERS = [
  'appcenter', 'atlassian', 'box', 'clearblade', 'dracoon', 'gitea', 'github',
  'gitlab', 'keycloak', 'launchdarkly', 'microsoft', 'netbox', 'trello',
];

function fail(msg) {
  console.error(`FAIL: ${msg}`);
  process.exit(1);
}

// The one writer of the output's provider field.
function bareProvider(provider) {
  const bare = PROVIDER_MAP.get(provider);
  if (bare === undefined) fail(`ops.csv provider "${provider}" is not in PROVIDER_MAP — add it explicitly`);
  return bare;
}

function readCsv(p) {
  return parseCsv(fs.readFileSync(p, 'utf8'));
}

// The operation identity shared by ops.csv and key.csv. NUL-joined so no
// field value can forge a boundary.
function opKey(row) {
  return [row.provider, row.method, row.path, row.operationId].join('\u0000');
}

// --- load ops.csv: operation text, indexed by the join key -----------------

function loadOps() {
  const rows = readCsv(path.join(SRC_DIR, 'ops.csv'));
  if (rows.length !== EXPECTED_ROWS) fail(`ops.csv has ${rows.length} rows, expected ${EXPECTED_ROWS}`);
  const byKey = new Map();
  for (const row of rows) {
    const k = opKey(row);
    if (byKey.has(k)) fail(`ops.csv join key is not unique: ${k.replace(/\u0000/g, ' | ')}`);
    byKey.set(k, row);
  }
  return byKey;
}

// --- load key.csv: row_id -> operation identity ----------------------------

function loadKey() {
  const rows = readCsv(path.join(SRC_DIR, 'label', 'key.csv'));
  if (rows.length !== EXPECTED_ROWS) fail(`key.csv has ${rows.length} rows, expected ${EXPECTED_ROWS}`);
  const byRowId = new Map();
  for (const row of rows) {
    if (byRowId.has(row.row_id)) fail(`key.csv has duplicate row_id ${row.row_id}`);
    byRowId.set(row.row_id, row);
  }
  return byRowId;
}

// --- load the nine v3 label files: row_id -> class/confidence/reason -------

function loadV3Labels() {
  const byRowId = new Map();
  for (let i = 1; i <= 9; i += 1) {
    const p = path.join(LABEL_DIR, `v3-labels-${i}.csv`);
    for (const row of readCsv(p)) {
      if (byRowId.has(row.row_id)) fail(`row_id ${row.row_id} appears in more than one v3-labels-*.csv`);
      if (!['r', 'w', 'x'].includes(row.truth_class)) {
        fail(`row ${row.row_id} has invalid truth_class "${row.truth_class}"`);
      }
      if (!['high', 'low'].includes(row.confidence)) {
        fail(`row ${row.row_id} has invalid confidence "${row.confidence}"`);
      }
      byRowId.set(row.row_id, row);
    }
  }
  if (byRowId.size !== EXPECTED_ROWS) fail(`v3 labels cover ${byRowId.size} rows, expected ${EXPECTED_ROWS}`);
  return byRowId;
}

// --- main ------------------------------------------------------------------

function main() {
  const outPath = process.argv[2] ? path.resolve(process.argv[2]) : DEFAULT_OUT;

  const opsByKey = loadOps();
  const keyByRowId = loadKey();
  const labelByRowId = loadV3Labels();

  const csvRows = [];
  for (const [rowId, label] of labelByRowId) {
    const keyRow = keyByRowId.get(rowId);
    if (keyRow === undefined) fail(`labelled row ${rowId} has no key.csv entry`);
    const op = opsByKey.get(opKey(keyRow));
    if (op === undefined) fail(`row ${rowId} did not join to ops.csv: ${opKey(keyRow).replace(/\u0000/g, ' | ')}`);

    csvRows.push({
      row_id: rowId,
      provider: bareProvider(op.provider),
      method: op.method,
      path: op.path,
      operationId: op.operationId,
      summary: op.summary,
      description: op.description,
      truth_class: label.truth_class,
      confidence: label.confidence,
      reason: label.reason,
      source_set: SOURCE_SET,
    });
  }

  csvRows.sort((a, b) => (a.row_id < b.row_id ? -1 : a.row_id > b.row_id ? 1 : 0));

  // The output is serialized in memory and every assertion below runs against
  // that text. The file is written only once they all pass, so a failing run
  // leaves no output file and never a bad one beside a non-zero exit.
  const outText = toCsv(csvRows, HEADER);

  // ---- assertions + report ----
  console.log(`rows: ${csvRows.length}`);
  if (csvRows.length !== EXPECTED_ROWS) fail(`expected ${EXPECTED_ROWS} rows, got ${csvRows.length}`);

  const ids = new Set(csvRows.map((r) => r.row_id));
  if (ids.size !== csvRows.length) fail('output row_ids are not unique');
  for (const rowId of keyByRowId.keys()) {
    if (!ids.has(rowId)) fail(`key.csv row ${rowId} is missing from the output`);
  }

  // Providers: exactly the 13 bare names, nothing more, nothing missing.
  const seenProviders = new Set(csvRows.map((r) => r.provider));
  const wantProviders = new Set(EXPECTED_PROVIDERS);
  for (const p of seenProviders) {
    if (!wantProviders.has(p)) fail(`output provider "${p}" is not a mapped bare vendor name`);
  }
  for (const p of wantProviders) {
    if (!seenProviders.has(p)) fail(`mapped vendor "${p}" has no rows in the output`);
  }
  console.log(`providers: ${seenProviders.size} (${[...seenProviders].sort().join(' ')})`);

  const dist = { r: 0, w: 0, x: 0 };
  const conf = { high: 0, low: 0 };
  for (const r of csvRows) {
    dist[r.truth_class] += 1;
    conf[r.confidence] += 1;
  }
  console.log(`class distribution: r=${dist.r} w=${dist.w} x=${dist.x}`);
  console.log(`confidence: high=${conf.high} low=${conf.low}`);

  // Re-parse our own output text: 11 columns on every row, header exact.
  const reread = parseCsv(outText);
  if (reread.length !== EXPECTED_ROWS) fail(`re-parsed output has ${reread.length} rows`);
  if (outText.split('\n')[0] !== HEADER.join(',')) fail(`header mismatch: ${outText.split('\n')[0]}`);
  // parseCsv pads short rows to the header, so column count is checked by
  // round-tripping: re-serializing the re-parsed rows must reproduce the file
  // byte for byte, which can only hold if every row carried all 11 fields.
  if (toCsv(reread, HEADER) !== outText) fail('output does not round-trip through parseCsv/toCsv');
  for (let i = 0; i < reread.length; i += 1) {
    if (reread[i].row_id !== csvRows[i].row_id) fail(`re-parsed row ${i} row_id mismatch`);
    if (reread[i].truth_class !== csvRows[i].truth_class) fail(`re-parsed row ${reread[i].row_id} truth_class mismatch`);
    if (reread[i].source_set !== SOURCE_SET) fail(`re-parsed row ${reread[i].row_id} source_set is "${reread[i].source_set}"`);
  }
  console.log('re-parse: OK (11 columns on every row, header exact, order preserved)');

  // Every check passed — now, and only now, the file is written.
  fs.writeFileSync(outPath, outText);
  console.log(`wrote ${outPath}`);

  console.log('OK');
}

main();
