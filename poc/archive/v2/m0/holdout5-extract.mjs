#!/usr/bin/env node
// Build a FIFTH hold-out set of API operations from public OpenAPI/Swagger
// JSON files that nobody in this project has labelled, for a later blind
// reading. Modelled on holdout4-extract.mjs: same output columns, same
// candidate ordering (all path x method sorted by path then method), same
// index % N selection. See docs/product/prd.md for context.
//
// Two vendors (slack, amazon) are Swagger 2.0, not OpenAPI 3 -- the same
// path/method/operationId/summary/description/responses shape is present,
// so extraction works unchanged. Swagger 2.0 has no requestBody or
// callbacks keyword, so has_sink and has_callbacks are structurally false
// for every slack/amazon row -- not a bug, just what that spec version has.
//
// amazon is not a single file: it is amzn/selling-partner-api-models, all
// *.json files under models/ (67 files across 53 API sections), sorted by
// repo-relative path for determinism. Each row's source_url/sha256 is the
// specific model file that produced it (more precise than a single
// repo-level URL); the README also records a whole-set sha256 (the sorted
// concatenation of all 67 raw files) plus every individual file's sha256.
//
// Usage: node poc/m0/holdout5-extract.mjs <sourceDir> <outDir>
// sourceDir must contain: slack.json, notion.json, amazon/filelist.txt
// (repo-relative paths, one per line, sorted) and amazon/<path with
// '/' replaced by '__'> for each file named in filelist.txt.

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { methodDefault } from './rules.mjs';
import { toCsv } from './csv.mjs';

const SLACK = {
  file: 'slack.json',
  url: 'https://raw.githubusercontent.com/slackapi/slack-api-specs/master/web-api/slack_web_openapi_v2.json',
};
const NOTION = {
  file: 'notion.json',
  url: 'https://raw.githubusercontent.com/makenotion/notion-mcp-server/main/scripts/notion-openapi.json',
};
const AMAZON_URL_BASE = 'https://raw.githubusercontent.com/amzn/selling-partner-api-models/main/';

// Selection rule, verbatim: N chosen per vendor so each vendor yields
// roughly 120-140 rows: N = round(candidates / 130), minimum 1. Candidates
// were counted as 174 (slack), 24 (notion), 373 (amazon), giving
// slack N=1, notion N=1, amazon N=3. With N=1 (candidates well under
// target) every candidate is selected -- slack (174) and notion (24) both
// land outside the 120-140 band because the rule floors N at 1 rather than
// upsampling; this is the mechanical rule applied honestly, not a target
// hit for those two vendors. Index from 0 over the candidate list (sorted
// by path then method), select where index % N === 0.
const SELECT_N = { slack: 1, notion: 1, amazon: 3 };

const METHODS = ['get', 'post', 'put', 'patch', 'delete'];
const HEADER = [
  'repo', 'source_url', 'sha256', 'path', 'method', 'operationId',
  'summary', 'description', 'has_callbacks', 'has_409', 'has_sink',
  'default_class',
];

function cleanDescription(s) {
  if (!s) return '';
  let out = s.replace(/<[^>]+>/g, ' ');
  out = out.replace(/\s+/g, ' ').trim();
  if (out.length > 700) out = out.slice(0, 699) + '…';
  return out;
}

function resolveRef(doc, ref) {
  if (typeof ref !== 'string' || !ref.startsWith('#/')) return undefined;
  const parts = ref.slice(2).split('/');
  let node = doc;
  for (const p of parts) {
    if (node == null) return undefined;
    node = node[p.replace(/~1/g, '/').replace(/~0/g, '~')];
  }
  return node;
}

function hasSink(doc, op) {
  let reqBody = op.requestBody;
  if (!reqBody) return false;
  if (reqBody.$ref) reqBody = resolveRef(doc, reqBody.$ref);
  if (!reqBody) return false;
  let schema = reqBody.content?.['application/json']?.schema;
  if (!schema) return false;
  if (schema.$ref) schema = resolveRef(doc, schema.$ref);
  if (!schema) return false;
  return Object.prototype.hasOwnProperty.call(schema.properties ?? {}, 'sink');
}

// Collect { path, method (lowercase), op } for every real operation object.
// A path item that is itself $ref-only (no inline method objects) yields
// no candidates and is silently skipped, per the brief.
function collectOps(doc) {
  const ops = [];
  const paths = doc.paths ?? {};
  for (const p of Object.keys(paths)) {
    const pathItem = paths[p];
    if (!pathItem || typeof pathItem !== 'object') continue;
    if (pathItem.$ref) continue; // $ref-only path item: skip
    for (const m of METHODS) {
      if (Object.prototype.hasOwnProperty.call(pathItem, m)) {
        const op = pathItem[m];
        if (!op || typeof op !== 'object') continue; // no operation object
        ops.push({ path: p, method: m, op });
      }
    }
  }
  return ops;
}

function sortCandidates(ops) {
  return ops.slice().sort((a, b) => {
    if (a.path !== b.path) return a.path < b.path ? -1 : 1;
    return a.method < b.method ? -1 : a.method > b.method ? 1 : 0;
  });
}

function buildRow(repoName, sourceUrl, sha256, doc, path_, method, op) {
  return {
    repo: repoName,
    source_url: sourceUrl,
    sha256,
    path: path_,
    method: method.toUpperCase(),
    operationId: op.operationId ?? '',
    summary: op.summary ?? '',
    description: cleanDescription(op.description ?? ''),
    has_callbacks: Object.prototype.hasOwnProperty.call(op, 'callbacks') && !!op.callbacks,
    has_409: Object.prototype.hasOwnProperty.call(op.responses ?? {}, '409'),
    has_sink: hasSink(doc, op),
    default_class: methodDefault(method),
  };
}

function sha256Of(buf) {
  return crypto.createHash('sha256').update(buf).digest('hex');
}

function main() {
  const [, , sourceDir, outDir] = process.argv;
  if (!sourceDir || !outDir) {
    console.error('Usage: node poc/m0/holdout5-extract.mjs <sourceDir> <outDir>');
    process.exit(1);
  }

  const rows = [];
  const shas = {};
  const counts = {};

  // --- slack (single file, Swagger 2.0) ---
  {
    const raw = fs.readFileSync(path.join(sourceDir, SLACK.file), 'utf8');
    const sha256 = sha256Of(raw);
    shas.slack = sha256;
    const doc = JSON.parse(raw);
    const candidates = sortCandidates(collectOps(doc));
    const n = SELECT_N.slack;
    const selected = candidates.filter((_, idx) => idx % n === 0);
    counts.slack = selected.length;
    for (const { path: p, method, op } of selected) {
      rows.push(buildRow('slack', SLACK.url, sha256, doc, p, method, op));
    }
  }

  // --- notion (single file, OpenAPI 3.1) ---
  {
    const raw = fs.readFileSync(path.join(sourceDir, NOTION.file), 'utf8');
    const sha256 = sha256Of(raw);
    shas.notion = sha256;
    const doc = JSON.parse(raw);
    const candidates = sortCandidates(collectOps(doc));
    const n = SELECT_N.notion;
    const selected = candidates.filter((_, idx) => idx % n === 0);
    counts.notion = selected.length;
    for (const { path: p, method, op } of selected) {
      rows.push(buildRow('notion', NOTION.url, sha256, doc, p, method, op));
    }
  }

  // --- amazon (multi-file, Swagger 2.0, SP-API models) ---
  const amazonFileShas = {};
  let amazonWholeSetSha;
  {
    const filelist = fs
      .readFileSync(path.join(sourceDir, 'amazon', 'filelist.txt'), 'utf8')
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean)
      .sort();

    const concatBuffers = [];
    let allOps = []; // { path, method, op, doc, relPath, sha256, url }

    for (const relPath of filelist) {
      const localName = relPath.replace(/\//g, '__');
      const raw = fs.readFileSync(path.join(sourceDir, 'amazon', localName), 'utf8');
      const sha256 = sha256Of(raw);
      amazonFileShas[relPath] = sha256;
      concatBuffers.push(raw);
      const doc = JSON.parse(raw);
      const ops = collectOps(doc);
      const url = AMAZON_URL_BASE + relPath;
      for (const o of ops) allOps.push({ ...o, doc, relPath, sha256, url });
    }
    amazonWholeSetSha = sha256Of(concatBuffers.join(''));

    // Global sort by path then method; ties (identical path+method strings
    // across different model files -- distinct APIs sharing a path
    // fragment) keep JS's stable sort, i.e. filelist order (deterministic,
    // since filelist is sorted).
    const candidates = sortCandidates(allOps);
    const n = SELECT_N.amazon;
    const selected = candidates.filter((_, idx) => idx % n === 0);
    counts.amazon = selected.length;
    for (const { path: p, method, op, doc, url, sha256 } of selected) {
      rows.push(buildRow('amazon', url, sha256, doc, p, method, op));
    }
  }

  fs.mkdirSync(outDir, { recursive: true });

  const csv = toCsv(rows, HEADER);
  fs.writeFileSync(path.join(outDir, 'operations.csv'), csv);

  const total = rows.length;
  const REPO_NAMES = ['slack', 'notion', 'amazon'];
  const noSummaryNoDesc = rows.filter((r) => r.summary === '' && r.description === '').length;
  const noSummaryNoDescByRepo = {};
  for (const repoName of REPO_NAMES) {
    noSummaryNoDescByRepo[repoName] = rows.filter(
      (r) => r.repo === repoName && r.summary === '' && r.description === ''
    ).length;
  }

  const methodCounts = {};
  for (const r of rows) methodCounts[r.method] = (methodCounts[r.method] ?? 0) + 1;
  const methodLines = Object.keys(methodCounts).sort()
    .map((m) => `- ${m}: ${methodCounts[m]}`).join('\n');

  const amazonFileShaLines = Object.keys(amazonFileShas).sort()
    .map((f) => `  - ${f}: ${amazonFileShas[f]}`).join('\n');

  const readme = `# Hold-out set 5 — 2026-09-08

Three public OpenAPI/Swagger JSON sources, none of them read or labelled by
anyone on this project before this extraction. shopify was dropped (see
below); notion turned out to have a vendor-owned spec after all, contrary
to the working assumption going in.

## Vendors considered, and shopify's drop

- slack: slackapi/slack-api-specs (slackapi is Slack's own GitHub org)
  publishes the Web API spec as Swagger 2.0, not OpenAPI 3. The
  path/method/operationId/summary/description/responses shape needed here
  is present unchanged in Swagger 2.0, so extraction proceeds. Methods used
  are GET (80) and POST (94) only, each path carrying exactly one method
  (no path exposes both) -- the method still carries signal, so this does
  not trip the "method carries no signal" stop condition.
- notion: makenotion/notion-mcp-server ships scripts/notion-openapi.json,
  OpenAPI 3.1, generated by Notion for their own official MCP server
  (makenotion is Notion's own GitHub org: company Notion, blog notion.so).
  This is vendor-owned, contrary to the brief's working assumption that
  Notion publishes no OpenAPI spec -- verified before using it. It is a
  small surface: only 24 path x method candidates total, all of them
  selected (N=1).
- shopify: no vendor-owned OpenAPI JSON found. Checked shopify.dev's Admin
  REST reference (no spec download or link) and the Shopify/Shopify-*
  GitHub orgs (200 repos scanned by name, none named as an API-spec repo).
  Only third-party reconstructions exist (e.g. allengrant/shopify_openapi,
  api-evangelist/shopify-admin) -- per the brief, these are not substituted
  in. shopify is dropped; four vendors were named, three are used.
- amazon: amzn/selling-partner-api-models, Swagger 2.0, one file per API
  section under models/ (53 sections, 67 JSON files total, no example
  files present). All 67 files are used as one vendor, sorted by
  repo-relative path for determinism -- a documented subset per the brief
  ("all files under a named models directory, sorted by filename").

## Sources

- slack: ${SLACK.url}
- notion: ${NOTION.url}
- amazon: all 67 \`models/**/*.json\` files in amzn/selling-partner-api-models
  (main branch), listed below with their raw URL prefix
  \`${AMAZON_URL_BASE}\`

## SHA-256

- slack (whole raw file): ${shas.slack}
- notion (whole raw file): ${shas.notion}
- amazon (whole set: sorted concatenation of all 67 raw files, byte-for-
  byte, in filelist order): ${amazonWholeSetSha}
- amazon (per file, sorted by path):
${amazonFileShaLines}

Each amazon row in operations.csv carries the source_url and sha256 of the
one model file it came from, not the whole-set values above (a per-vendor
single file/URL/sha doesn't fit a 67-file vendor) -- see the amazon note
above.

## Selection rule

N chosen per vendor so each vendor yields roughly 120-140 rows:
N = round(candidates / 130), minimum 1. slack — every 1st candidate (174
candidates, N=1 floors below target); notion — every 1st candidate (24
candidates, N=1, far below target); amazon — every 3rd candidate (373
candidates, N=3, ~124 rows). Index from 0 and select where
\`index % N === 0\`. Candidates are all path × method (get/post/put/patch/
delete) pairs, sorted by path (string sort) then method (string sort) for
determinism (amazon's candidates are pooled across all 67 files before this
sort, with file-list order as the tiebreak for any identical path+method
string that happens to appear in two different model files). A path item
that is $ref-only, or a method entry that is not an operation object, is
skipped and not counted as a candidate.

Note: with N floored at 1 (candidates already under the ~130 target), a
vendor is not resampled upward — slack (174) and notion (24) both land
outside the 120-140 band as an honest consequence of the mechanical rule,
not a target miss to fix by hand.

## Structural columns and spec version

slack and amazon are Swagger 2.0: neither has a \`requestBody\` or
\`callbacks\` keyword (Swagger 2.0 uses \`parameters\` with \`in: body\`
instead), so \`has_sink\` and \`has_callbacks\` are structurally \`false\`
for every slack/amazon row. This is a property of the spec version, not an
extraction bug. notion is OpenAPI 3.1, so \`has_sink\`/\`has_callbacks\` are
computed normally there.

## Row counts

### Per repo

- slack: ${counts.slack}
- notion: ${counts.notion}
- amazon: ${counts.amazon}
- total: ${total}

### Per method

${methodLines}

No one in this project had read or labelled these operations before
extraction. Like data/holdout2-2026-09-07/, data/holdout3-2026-09-08/ and
data/holdout4-2026-09-08/, this set includes GET operations, so it can
measure correct lowerings and the usefulness half of the gate.

## Ground truth

NOT YET READ.
`;
  fs.writeFileSync(path.join(outDir, 'README.md'), readme);

  console.log(`slack: ${counts.slack} rows`);
  console.log(`notion: ${counts.notion} rows`);
  console.log(`amazon: ${counts.amazon} rows`);
  console.log(`total: ${total} rows`);
  for (const m of Object.keys(methodCounts).sort()) {
    console.log(`method ${m}: ${methodCounts[m]} rows`);
  }
  console.log(`rows with no summary and no description: ${noSummaryNoDesc}`);
  for (const repoName of REPO_NAMES) {
    console.log(`  ${repoName}: ${noSummaryNoDescByRepo[repoName]}`);
  }
}

main();
