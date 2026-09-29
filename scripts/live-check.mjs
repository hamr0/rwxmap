// Live release check: run the rwxmap CLI against real bare API addresses and
// assert it still works end to end. Run by hand before every release
// (`npm run check:live`). It hits the network, so it is NOT part of
// `npm test` or CI.
//
// Usage: node scripts/live-check.mjs [--cli <path>] [--jev]
//   --cli <path>  CLI to run (default: src/cli.js in this repo). Point it at
//                 an installed tarball's bin to check what actually ships.
//   --jev         Keep RWXMAP_JEV_KEY and run from the repo root so its .env
//                 is read. Spends the key's owner's money. Every host must
//                 then report Jev mode "on" with 0 failed.
//
// Without --jev, RWXMAP_JEV_KEY is removed from the child's environment and
// the child runs with cwd = a fresh empty temp dir, so neither a set variable
// nor a .env file can turn Jev on: the run is mechanical.
//
// Per host: a fresh temp dir (removed afterwards) is the -o output dir and
// the child's XDG_CACHE_HOME, so discovery's 30-day on-disk cache (which
// stores the found ops) is bypassed, every run really hits the network, and
// the user's own ~/.cache/rwxmap is neither read nor written. The CLI runs as `node <cli> <address> -o <tmp> --force`, 120 s timeout, one
// host at a time.
//
// HARD failures (exit 1): non-zero exit; an output file named on the CLI's
// "wrote" line (or the required <vendor>.rwxmap.json and
// <vendor>.rwxmap.review.json) missing or not JSON; the combined JSON's
// `source` host differs from the recorded spec host; mcp entry count differs
// from the review row count; a review row letter outside r/w/x; more
// bareguard keys than operations; the combined JSON has no `jev` field;
// without --jev, Jev mode not "off"; with --jev, Jev not "on" or any row
// failed.
//
// SOFT changes (printed CHANGED, exit 0): spec URL path differs on the same
// host; ops count or r/w/x split differs from what was recorded. Sites change
// their specs; the report says so, it does not fail.
//
// Vanilla Node >= 22, stdlib only.
import { spawn } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { parseArgs } from 'node:util';

const root = path.resolve(import.meta.dirname, '..');
const TIMEOUT_MS = 120_000;

// Recorded 2026-09-29 with the committed CLI, no Jev.
const HOSTS = [
  {
    address: 'https://api.intercom.io',
    spec: 'https://developers.intercom.com/_bundle/docs/references/@2.15/rest-api/api.intercom.io.yaml',
    ops: 166, r: 84, w: 23, x: 59,
    why: 'big, all three letters, YAML, found via a Link header to the docs host (version segment may move)',
  },
  {
    address: 'https://api.ibanforge.com',
    spec: 'https://api.ibanforge.com/openapi.json',
    ops: 41, r: 26, w: 0, x: 15,
    why: 'POSTs rated by lead verb',
  },
  {
    address: 'https://openvan.camp',
    spec: 'https://openvan.camp/.well-known/openapi.json',
    ops: 31, r: 31, w: 0, x: 0,
    why: 'found through Link rel=service-desc, a different discovery step',
  },
  {
    address: 'https://api.scrapingant.com',
    spec: 'https://api.scrapingant.com/openapi.json',
    ops: 6, r: 2, w: 2, x: 2,
    why: 'collision case: 2 gate keys, 4 collisions kept at the tightest letter',
  },
];

const { values } = parseArgs({
  options: {
    cli: { type: 'string' },
    jev: { type: 'boolean', default: false },
  },
});
const cliPath = path.resolve(values.cli ?? path.join(root, 'src/cli.js'));
const useJev = values.jev;

/** Run the CLI once; resolves {code, stdout, stderr, timedOut}. */
function runCli(address, outDir, cwd, env) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [cliPath, address, '-o', outDir, '--force'], { cwd, env });
    let stdout = '';
    let stderr = '';
    let timedOut = false;
    const timer = setTimeout(() => { timedOut = true; child.kill('SIGKILL'); }, TIMEOUT_MS);
    child.stdout.on('data', (d) => { stdout += d; });
    child.stderr.on('data', (d) => { stderr += d; });
    child.on('error', (err) => { stderr += String(err); });
    child.on('close', (code) => { clearTimeout(timer); resolve({ code, stdout, stderr, timedOut }); });
  });
}

function readJson(file) {
  try {
    return { value: JSON.parse(fs.readFileSync(file, 'utf8')) };
  } catch (err) {
    return { error: err.code === 'ENOENT' ? 'missing' : `not JSON (${err.message})` };
  }
}

/** Check one host; returns {status, line}. */
async function checkHost(h) {
  const vendor = new URL(h.address).hostname.toLowerCase();
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'rwxmap-live-'));
  const env = { ...process.env };
  if (!useJev) delete env.RWXMAP_JEV_KEY;
  env.XDG_CACHE_HOME = tmp; // bypass discovery's cache, see header
  const cwd = useJev ? root : tmp;
  const started = Date.now();
  const hard = [];
  const soft = [];
  let got = null;

  try {
    const res = await runCli(h.address, tmp, cwd, env);
    if (res.timedOut) hard.push(`timed out after ${TIMEOUT_MS / 1000} s`);
    else if (res.code !== 0) hard.push(`exit ${res.code}: ${res.stderr.trim().split('\n').pop() || '(no stderr)'}`);

    if (hard.length === 0) {
      const mapName = `${vendor}.rwxmap.json`;
      const reviewName = `${vendor}.rwxmap.review.json`;
      const wrote = res.stdout.split('\n').find((l) => l.startsWith('rwxmap: wrote '));
      const named = wrote ? wrote.slice('rwxmap: wrote '.length).split(' + ').map((s) => s.trim()).filter(Boolean) : [];
      if (!wrote) hard.push('no "wrote" line on stdout');
      const files = [...new Set([mapName, reviewName, ...named])];
      const parsed = {};
      for (const f of files) {
        const r = readJson(path.join(tmp, f));
        if (r.error) hard.push(`${f} ${r.error}`);
        else parsed[f] = r.value;
      }

      const combined = parsed[mapName];
      const review = parsed[reviewName];
      if (combined && review) {
        const rows = Array.isArray(review.rows) ? review.rows : [];
        const counts = { r: 0, w: 0, x: 0 };
        const bad = rows.filter((row) => !(row.letter in counts));
        for (const row of rows) if (row.letter in counts) counts[row.letter] += 1;
        got = { ops: rows.length, ...counts };

        let srcHost = null;
        try { srcHost = new URL(combined.source).host; } catch { /* stays null */ }
        const specUrl = new URL(h.spec);
        if (srcHost !== specUrl.host) hard.push(`source host ${srcHost} != ${specUrl.host}`);
        else if (combined.source !== h.spec) soft.push(`spec path moved: ${combined.source}`);

        const mcpCount = Object.keys(combined.mcp ?? {}).length;
        if (mcpCount !== rows.length) hard.push(`mcp entries ${mcpCount} != review rows ${rows.length}`);
        if (bad.length > 0) hard.push(`${bad.length} review row(s) with letter outside r/w/x (e.g. ${JSON.stringify(bad[0].letter)})`);
        const keyCount = Object.keys(combined.bareguard?.tools ?? {}).length;
        if (keyCount > rows.length) hard.push(`bareguard keys ${keyCount} > ops ${rows.length}`);

        const j = combined.jev;
        if (!j || typeof j !== 'object') hard.push('combined JSON has no jev field');
        else if (useJev) {
          if (j.mode !== 'on') hard.push(`Jev mode ${JSON.stringify(j.mode)}, expected "on"`);
          else if (j.failed !== 0) hard.push(`Jev failed ${j.failed} row(s)`);
        } else if (j.mode !== 'off') hard.push(`Jev mode ${JSON.stringify(j.mode)}, expected "off"`);

        if (got.ops !== h.ops || got.r !== h.r || got.w !== h.w || got.x !== h.x) {
          soft.push(`ops/letters moved from recorded ${h.ops} (r ${h.r} w ${h.w} x ${h.x})`);
        }
      }
    }
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }

  const secs = ((Date.now() - started) / 1000).toFixed(1);
  const status = hard.length > 0 ? 'FAIL' : soft.length > 0 ? 'CHANGED' : 'PASS';
  const letters = got
    ? `${got.ops} ops (r ${got.r} w ${got.w} x ${got.x}) vs recorded ${h.ops} (r ${h.r} w ${h.w} x ${h.x})`
    : `recorded ${h.ops} (r ${h.r} w ${h.w} x ${h.x})`;
  const notes = [...hard, ...soft].join('; ');
  return { status, line: `${status.padEnd(7)} ${h.address} — ${letters} — ${secs} s${notes ? ` — ${notes}` : ''}` };
}

console.log(`rwxmap live check — cli ${cliPath} — Jev ${useJev ? 'ON (key kept, repo .env read)' : 'off (key removed, empty cwd)'}`);
const tally = { PASS: 0, CHANGED: 0, FAIL: 0 };
for (const h of HOSTS) {
  const { status, line } = await checkHost(h);
  tally[status] += 1;
  console.log(line);
}
console.log(`summary: ${tally.PASS} PASS · ${tally.CHANGED} CHANGED · ${tally.FAIL} FAIL of ${HOSTS.length} hosts`);
process.exitCode = tally.FAIL > 0 ? 1 : 0;
