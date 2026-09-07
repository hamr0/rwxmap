#!/usr/bin/env node
// Census of machine-facing OpenAPI fields across the 719 labelled operations
// in rwxmap's three test beds (CAMARA, hold-out 1, hold-out 2 / "clean
// exam"). Vanilla Node, zero deps. See the task brief for field semantics.
//
// Usage: node run.mjs

import fs from 'node:fs';
import path from 'node:path';
import { parseYaml } from './yaml-mini.mjs';
import { parseCsv, toCsv } from '../../m0/csv.mjs';
import * as L from './lib.mjs';

const REPO_ROOT = '/home/hamr/PycharmProjects/rwxmap';
const CAMARA_ROOT = path.join(REPO_ROOT, 'data/camara-2026-09-01');
const HOLDOUT1_ROOT = path.join(REPO_ROOT, 'data/holdout-2026-09-07');
const HOLDOUT2_ROOT = path.join(REPO_ROOT, 'data/holdout2-2026-09-07');

// hold-out spec JSONs are not in the repo; re-fetch by URL and SHA from
// data/holdout*/README.md into these paths, or override via env
// CENSUS_SPECS=<dir>
const SPEC_BASE = process.env.CENSUS_SPECS
  || '/tmp/claude-1000/-home-hamr-PycharmProjects-rwxmap/445bf3bf-adc6-4e78-8312-b02aeb5cadc2/scratchpad';
const SPEC_DIRS = {
  holdout1: process.env.CENSUS_SPECS ? SPEC_BASE : path.join(SPEC_BASE, 'corpora'),
  holdout2: process.env.CENSUS_SPECS ? SPEC_BASE : path.join(SPEC_BASE, 'v4'),
};
const OUT_DIR = '/tmp/claude-1000/-home-hamr-PycharmProjects-rwxmap/317610d1-5681-4615-8633-12ae3f093f28/scratchpad/census';

const fetchLog = []; // { spec, fetched: bool, shaOk: bool|null, note }

function readText(p) { return fs.readFileSync(p, 'utf8'); }

async function ensureSpecJson(repoKey, fileName, url, expectedSha, dir) {
  const localPath = path.join(dir, fileName);
  if (fs.existsSync(localPath)) {
    const raw = readText(localPath);
    const sha = require_sha256(raw);
    fetchLog.push({ spec: repoKey, fetched: false, shaOk: sha === expectedSha, note: sha === expectedSha ? 'local file, sha matched' : `local file, SHA MISMATCH (got ${sha})` });
    return raw;
  }
  // Fallback: fetch from URL and verify.
  const res = await fetch(url);
  const raw = await res.text();
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(localPath, raw);
  const sha = require_sha256(raw);
  fetchLog.push({ spec: repoKey, fetched: true, shaOk: sha === expectedSha, note: sha === expectedSha ? 'fetched, sha matched' : `fetched, SHA MISMATCH (got ${sha})` });
  return raw;
}

import crypto from 'node:crypto';
function require_sha256(text) { return crypto.createHash('sha256').update(text).digest('hex'); }

function loadReadmeShas(readmeText) {
  const out = {};
  const re = /^-\s+(\w+):\s+([0-9a-f]{64})\s*$/gm;
  let m;
  while ((m = re.exec(readmeText))) out[m[1]] = m[2];
  return out;
}

// ---- CAMARA (YAML) ----
function loadCamara() {
  const opsRows = parseCsv(readText(path.join(CAMARA_ROOT, 'operations.csv')));
  const gtRows = parseCsv(readText(path.join(CAMARA_ROOT, 'ground-truth.csv')));
  const gtMap = new Map();
  for (const g of gtRows) gtMap.set(`${g.repo}|${g.path}|${g.method}|${g.operationId}`, g.gt_class);

  const specCache = new Map();
  const rows = [];
  for (const r of opsRows) {
    const specPath = path.join(CAMARA_ROOT, 'specs', r.repo, r.file);
    let doc = specCache.get(specPath);
    if (!doc) {
      doc = parseYaml(readText(specPath));
      specCache.set(specPath, doc);
    }
    const gt = gtMap.get(`${r.repo}|${r.path}|${r.method}|${r.operationId}`) || '';
    rows.push({ set: 'camara', repo: r.repo, doc, path: r.path, method: r.method, operationId: r.operationId, gt_class: gt });
  }
  return rows;
}

// ---- generic JSON hold-out loader ----
async function loadHoldoutSet(setName, opsCsvPath, gtCsvPath, repoFiles, specDir) {
  const opsRows = parseCsv(readText(opsCsvPath));
  const gtRows = parseCsv(readText(gtCsvPath));
  const gtMap = new Map();
  for (const g of gtRows) gtMap.set(`${g.repo}|${g.path}|${g.method}|${g.operationId}`, g.gt_class);

  const docCache = new Map();
  const rows = [];
  for (const r of opsRows) {
    let doc = docCache.get(r.repo);
    if (!doc) {
      const info = repoFiles[r.repo];
      const raw = await ensureSpecJson(`${setName}:${r.repo}`, info.file, r.source_url || info.url, r.sha256 || info.sha256, specDir);
      doc = JSON.parse(raw);
      docCache.set(r.repo, doc);
    }
    const gt = gtMap.get(`${r.repo}|${r.path}|${r.method}|${r.operationId}`) || '';
    rows.push({ set: setName, repo: r.repo, doc, path: r.path, method: r.method, operationId: r.operationId, gt_class: gt });
  }
  return rows;
}

async function loadHoldout1() {
  const readme = readText(path.join(HOLDOUT1_ROOT, 'README.md'));
  const shas = loadReadmeShas(readme);
  const repoFiles = {
    twilio: { file: 'twilio.json', url: 'https://raw.githubusercontent.com/twilio/twilio-oai/main/spec/json/twilio_api_v2010.json', sha256: shas.twilio },
    stripe: { file: 'stripe.json', url: 'https://raw.githubusercontent.com/stripe/openapi/master/openapi/spec3.json', sha256: shas.stripe },
    github: { file: 'github.json', url: 'https://raw.githubusercontent.com/github/rest-api-description/main/descriptions/api.github.com/api.github.com.json', sha256: shas.github },
  };
  return loadHoldoutSet('holdout1', path.join(HOLDOUT1_ROOT, 'operations.csv'), path.join(HOLDOUT1_ROOT, 'ground-truth.csv'), repoFiles, SPEC_DIRS.holdout1);
}

async function loadHoldout2() {
  const readme = readText(path.join(HOLDOUT2_ROOT, 'README.md'));
  const shas = loadReadmeShas(readme);
  const repoFiles = {
    box: { file: 'box.json', url: 'https://raw.githubusercontent.com/box/box-openapi/main/openapi.json', sha256: shas.box },
    pagerduty: { file: 'pagerduty.json', url: 'https://raw.githubusercontent.com/PagerDuty/api-schema/main/reference/REST/openapiv3.json', sha256: shas.pagerduty },
    adyen: { file: 'adyen.json', url: 'https://raw.githubusercontent.com/Adyen/adyen-openapi/main/json/CheckoutService-v71.json', sha256: shas.adyen },
  };
  return loadHoldoutSet('holdout2', path.join(HOLDOUT2_ROOT, 'operations.csv'), path.join(HOLDOUT2_ROOT, 'ground-truth.csv'), repoFiles, SPEC_DIRS.holdout2);
}

// ---- extraction ----
function extractOne(row) {
  const { set, repo, doc, path: p, method, operationId, gt_class } = row;
  const op = L.methodOp(doc, p, method);
  if (!op) {
    return {
      set, repo, path: p, method, operationId, gt_class,
      resolved: false,
    };
  }
  const sec = L.securityInfo(doc, op);
  const rb = L.requestBodyInfo(doc, op);
  const codes = L.statusCodes(op);
  const cb = L.callbacksInfo(doc, op);
  const params = L.paramsInfo(doc, op);
  const xkeys = L.xExtensionKeys(op);
  const resSchema = L.resourceSchema(doc, p);

  return {
    set, repo, path: p, method, operationId, gt_class, resolved: true,
    security_present: sec.present,
    security_scheme_count: sec.schemeCount,
    security_scopes: sec.scopes,
    doc_top_level_security: sec.docTopLevelSecurity,
    doc_oauth2_flows_with_scopes: sec.oauth2WithScopes,
    doc_security_scheme_external_ref: sec.anyExternalSchemeRef,
    requestBody_present: rb.present,
    requestBody_media_type: rb.mediaType,
    requestBody_props: rb.props,
    requestBody_party_money: rb.hasPartyMoney,
    status_codes: codes,
    has200: codes.includes('200'),
    has201: codes.includes('201'),
    has202: codes.includes('202'),
    has204: codes.includes('204'),
    callbacks_present: cb.opHasCallbacks,
    doc_has_webhooks: cb.docHasWebhooks,
    desc_mentions_callback: cb.descMentions,
    idempotency_header_param: params.idempotencyHeader,
    party_id_param: params.partyParam,
    x_extension_keys: xkeys,
    has_operationId: !!(op.operationId && String(op.operationId).trim() !== ''),
    has_summary: !!(op.summary && String(op.summary).trim() !== ''),
    has_description: !!(op.description && String(op.description).trim() !== ''),
    resource_schema_found: resSchema.found,
    resource_schema_from: resSchema.fromPath,
    resource_schema_props: resSchema.props,
    resource_schema_party_field: resSchema.hasPartyField,
  };
}

function joinList(arr) { return (arr || []).join('|'); }

const OPS_HEADER = [
  'set', 'repo', 'path', 'method', 'operationId', 'gt_class', 'resolved',
  'security_present', 'security_scheme_count', 'security_scopes',
  'doc_top_level_security', 'doc_oauth2_flows_with_scopes', 'doc_security_scheme_external_ref',
  'requestBody_present', 'requestBody_media_type', 'requestBody_props', 'requestBody_party_money',
  'status_codes', 'has200', 'has201', 'has202', 'has204',
  'callbacks_present', 'doc_has_webhooks', 'desc_mentions_callback',
  'idempotency_header_param', 'party_id_param',
  'x_extension_keys',
  'has_operationId', 'has_summary', 'has_description',
  'resource_schema_found', 'resource_schema_from', 'resource_schema_props', 'resource_schema_party_field',
];

function toCsvRow(e) {
  if (!e.resolved) {
    const r = { set: e.set, repo: e.repo, path: e.path, method: e.method, operationId: e.operationId, gt_class: e.gt_class, resolved: 'false' };
    for (const h of OPS_HEADER) if (!(h in r)) r[h] = '';
    return r;
  }
  return {
    set: e.set, repo: e.repo, path: e.path, method: e.method, operationId: e.operationId, gt_class: e.gt_class,
    resolved: String(e.resolved),
    security_present: String(e.security_present),
    security_scheme_count: String(e.security_scheme_count),
    security_scopes: joinList(e.security_scopes),
    doc_top_level_security: String(e.doc_top_level_security),
    doc_oauth2_flows_with_scopes: String(e.doc_oauth2_flows_with_scopes),
    doc_security_scheme_external_ref: String(e.doc_security_scheme_external_ref),
    requestBody_present: String(e.requestBody_present),
    requestBody_media_type: e.requestBody_media_type,
    requestBody_props: joinList(e.requestBody_props),
    requestBody_party_money: String(e.requestBody_party_money),
    status_codes: joinList(e.status_codes),
    has200: String(e.has200), has201: String(e.has201), has202: String(e.has202), has204: String(e.has204),
    callbacks_present: String(e.callbacks_present),
    doc_has_webhooks: String(e.doc_has_webhooks),
    desc_mentions_callback: String(e.desc_mentions_callback),
    idempotency_header_param: String(e.idempotency_header_param),
    party_id_param: String(e.party_id_param),
    x_extension_keys: joinList(e.x_extension_keys),
    has_operationId: String(e.has_operationId),
    has_summary: String(e.has_summary),
    has_description: String(e.has_description),
    resource_schema_found: String(e.resource_schema_found),
    resource_schema_from: e.resource_schema_from,
    resource_schema_props: joinList(e.resource_schema_props),
    resource_schema_party_field: String(e.resource_schema_party_field),
  };
}

// ---- summary ----
function pct(n, d) { return d === 0 ? '0.0%' : `${(100 * n / d).toFixed(1)}%`; }

const FIELD_DEFS = [
  ['security_present', (e) => e.security_present === true],
  ['security_scopes_nonempty', (e) => (e.security_scopes || []).length > 0],
  ['requestBody_present', (e) => e.requestBody_present === true],
  ['requestBody_party_money', (e) => e.requestBody_party_money === true],
  ['has202', (e) => e.has202 === true],
  ['callbacks_present(op)', (e) => e.callbacks_present === true],
  ['doc_has_webhooks', (e) => e.doc_has_webhooks === true],
  ['desc_mentions_callback', (e) => e.desc_mentions_callback === true],
  ['idempotency_header_param', (e) => e.idempotency_header_param === true],
  ['party_id_param', (e) => e.party_id_param === true],
  ['x_extensions_present', (e) => (e.x_extension_keys || []).length > 0],
  ['resource_schema_found', (e) => e.resource_schema_found === true],
  ['resource_schema_party_field', (e) => e.resource_schema_party_field === true],
];

function buildPresenceTable(rows, label) {
  const n = rows.length;
  const lines = [`| field | count | percent |`, `|---|---|---|`];
  for (const [name, pred] of FIELD_DEFS) {
    const c = rows.filter((r) => r.resolved && pred(r)).length;
    lines.push(`| ${name} | ${c}/${n} | ${pct(c, n)} |`);
  }
  return `**${label}** (n=${n})\n\n${lines.join('\n')}\n`;
}

function buildClassSplitTable(rows, label) {
  const classes = ['r', 'w', 'x'];
  const out = [`**${label} — split by gt_class**\n`];
  for (const cls of classes) {
    const sub = rows.filter((r) => r.gt_class === cls);
    if (sub.length === 0) continue;
    out.push(buildPresenceTable(sub, `gt_class = ${cls}`));
  }
  return out.join('\n');
}

function topN(counter, n) {
  return [...counter.entries()].sort((a, b) => b[1] - a[1]).slice(0, n);
}

function main() {
  return run();
}

async function run() {
  const camaraRows = loadCamara();
  const h1Rows = await loadHoldout1();
  const h2Rows = await loadHoldout2();

  const allRaw = [...camaraRows, ...h1Rows, ...h2Rows];
  const extracted = allRaw.map(extractOne);

  const unresolved = extracted.filter((e) => !e.resolved);
  if (unresolved.length > 0) {
    console.error('UNRESOLVED OPERATIONS (path+method not found in spec):');
    for (const u of unresolved) console.error(' ', u.set, u.repo, u.method, u.path, u.operationId);
  }

  fs.mkdirSync(OUT_DIR, { recursive: true });
  const csv = toCsv(extracted.map(toCsvRow), OPS_HEADER);
  fs.writeFileSync(path.join(OUT_DIR, 'ops.csv'), csv);

  const bySet = {
    camara: extracted.filter((e) => e.set === 'camara'),
    holdout1: extracted.filter((e) => e.set === 'holdout1'),
    holdout2: extracted.filter((e) => e.set === 'holdout2'),
  };

  let md = `# OpenAPI field census — M0\n\n`;
  md += `Total labelled operations examined: ${extracted.length} (camara ${bySet.camara.length}, holdout1 ${bySet.holdout1.length}, holdout2 ${bySet.holdout2.length}).\n`;
  md += `Operations that failed to resolve (path+method not found in their spec): ${unresolved.length}.\n\n`;

  md += `## Presence by set\n\n`;
  for (const [label, rows] of [['camara', bySet.camara], ['holdout1', bySet.holdout1], ['holdout2', bySet.holdout2], ['ALL', extracted]]) {
    md += buildPresenceTable(rows, label) + '\n';
  }

  md += `## Presence split by gt_class\n\n`;
  for (const [label, rows] of [['camara', bySet.camara], ['holdout1', bySet.holdout1], ['holdout2', bySet.holdout2], ['ALL', extracted]]) {
    md += buildClassSplitTable(rows, label) + '\n';
  }

  md += `## Distinct security scope strings per vendor (top 20)\n\n`;
  const scopesByRepo = new Map();
  for (const e of extracted) {
    if (!e.resolved) continue;
    if (!scopesByRepo.has(e.repo)) scopesByRepo.set(e.repo, new Map());
    const m = scopesByRepo.get(e.repo);
    for (const s of e.security_scopes || []) m.set(s, (m.get(s) || 0) + 1);
  }
  for (const [repo, m] of [...scopesByRepo.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    md += `**${repo}** (${m.size} distinct scopes)\n\n`;
    if (m.size === 0) { md += `_none_\n\n`; continue; }
    md += `| scope | count |\n|---|---|\n`;
    for (const [s, c] of topN(m, 20)) md += `| ${s} | ${c} |\n`;
    md += `\n`;
  }

  md += `## Top 30 requestBody property names overall, with gt_class split\n\n`;
  const propCounter = new Map();
  const propByClass = new Map();
  for (const e of extracted) {
    if (!e.resolved) continue;
    for (const p of e.requestBody_props || []) {
      propCounter.set(p, (propCounter.get(p) || 0) + 1);
      if (!propByClass.has(p)) propByClass.set(p, { r: 0, w: 0, x: 0 });
      const rec = propByClass.get(p);
      if (rec[e.gt_class] !== undefined) rec[e.gt_class]++;
    }
  }
  md += `| property | total | r | w | x |\n|---|---|---|---|---|\n`;
  for (const [p, c] of topN(propCounter, 30)) {
    const rec = propByClass.get(p);
    md += `| ${p} | ${c} | ${rec.r} | ${rec.w} | ${rec.x} |\n`;
  }
  md += `\n`;

  md += `## Distinct x- extension names (operation-level), with counts\n\n`;
  const xCounter = new Map();
  for (const e of extracted) {
    if (!e.resolved) continue;
    for (const k of e.x_extension_keys || []) xCounter.set(k, (xCounter.get(k) || 0) + 1);
  }
  if (xCounter.size === 0) {
    md += `_none found_\n\n`;
  } else {
    md += `| extension | count |\n|---|---|\n`;
    for (const [k, c] of topN(xCounter, 50)) md += `| ${k} | ${c} |\n`;
    md += `\n`;
  }

  fs.writeFileSync(path.join(OUT_DIR, 'summary.md'), md);

  console.log('Wrote', path.join(OUT_DIR, 'ops.csv'));
  console.log('Wrote', path.join(OUT_DIR, 'summary.md'));
  console.log('Fetch log:', JSON.stringify(fetchLog, null, 2));
  console.log('Unresolved count:', unresolved.length);
}

main();
