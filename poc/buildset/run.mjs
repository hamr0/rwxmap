#!/usr/bin/env node
// Runner for the write-heavy build set draw. Dry-run by default — prints
// the per-vendor table and every gate result, exits 1 if any gate fails.
// Only writes a file when --write <dir> is passed (not part of normal use).
//
// Imports parseCsv from ../../tools/csv.js (dev tooling) — the only place
// in this POC allowed to do so; the pure modules (draw.mjs, gates.mjs)
// import nothing from it.

import { gunzipSync } from 'node:zlib';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

import { parseCsv, toCsv } from '../../tools/csv.js';
import { BUILD_CAPS, EXAM_VENDORS, SEEN_VENDORS, WRITE_METHODS } from './split.mjs';
import { drawBuildSet } from './draw.mjs';
import { runGates } from './gates.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CORPUS_GZ = path.join(__dirname, '..', '..', 'data', 'corpus', 'apis-guru-ops.csv.gz');
const SEED = 20260918;
const GIANT_SHARE_BAR = 0.4;

function parseArgs(argv) {
  const opts = { write: null, methods: null, capOverrides: {} };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--write') {
      opts.write = argv[++i];
    } else if (arg.startsWith('--methods=')) {
      opts.methods = arg
        .slice('--methods='.length)
        .split(',')
        .map((m) => m.trim().toUpperCase())
        .filter(Boolean);
    } else if (arg.startsWith('--cap-github=')) {
      opts.capOverrides['github.com'] = Number(arg.slice('--cap-github='.length));
    } else if (arg.startsWith('--cap-microsoft=')) {
      opts.capOverrides['microsoft.com'] = Number(arg.slice('--cap-microsoft='.length));
    }
  }
  return opts;
}

function main() {
  const args = parseArgs(process.argv.slice(2));

  const caps = { ...BUILD_CAPS, ...args.capOverrides };
  const methods = args.methods || WRITE_METHODS;

  const gz = readFileSync(CORPUS_GZ);
  const csvText = gunzipSync(gz).toString('utf8');
  const rows = parseCsv(csvText);

  const { rows: drawn, perVendor } = drawBuildSet(rows, { caps, methods, seed: SEED });

  console.log('vendor'.padEnd(20), 'available'.padStart(10), 'drawn'.padStart(8), 'POST/PUT/DELETE/PATCH');
  for (const v of perVendor) {
    const breakdown = `${v.byMethod.POST}/${v.byMethod.PUT}/${v.byMethod.DELETE}/${v.byMethod.PATCH}`;
    console.log(
      v.vendor.padEnd(20),
      String(v.available).padStart(10),
      String(v.drawn).padStart(8),
      breakdown
    );
  }

  const total = drawn.length;
  const giant = drawn.filter((r) => r.provider === 'github.com' || r.provider === 'microsoft.com')
    .length;
  const pct = total === 0 ? '0.0' : ((giant / total) * 100).toFixed(1);
  console.log('');
  console.log(`total drawn: ${total}`);
  console.log(`github.com+microsoft.com share: ${giant} of ${total} drawn rows (${pct}%)`);

  const gateResults = runGates(drawn, {
    caps,
    examVendors: EXAM_VENDORS,
    seenVendors: SEEN_VENDORS,
    methods,
    giantShareBar: GIANT_SHARE_BAR,
  });

  console.log('');
  console.log('gates:');
  let anyFail = false;
  for (const g of gateResults) {
    if (!g.pass) anyFail = true;
    console.log(`  [${g.pass ? 'PASS' : 'FAIL'}] ${g.name} - ${g.detail}`);
  }

  if (args.write) {
    mkdirSync(args.write, { recursive: true });
    const header = Object.keys(rows[0] || {});
    const outPath = path.join(args.write, 'ops.csv');
    writeFileSync(outPath, toCsv(drawn, header));
    console.log('');
    console.log(`wrote ${drawn.length} rows to ${outPath}`);
  }

  process.exit(anyFail ? 1 : 0);
}

main();
