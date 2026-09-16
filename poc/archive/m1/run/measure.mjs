// Step 3 clean measurement: corpus load, LOVO allowlist build, scoring,
// and the markdown report. Run: node poc/m1/run/measure.mjs
//
// Two gates, both must hold before anything is written:
//   1. corpus shape — 5465 rows, 332 vendors (enforced by core/corpus.mjs)
//   2. GATE score — the frozen c20/c15 baseline must print exactly 89
//      step-3 leaks. If it doesn't, the old numbers never reproduced and
//      nothing past this point can be trusted.
import { writeFileSync } from 'node:fs';
import { CLASS_ORDER } from '../arbiter/arbiter.mjs';
import { classifyC20 } from '../arbiter/c20.mjs';
import { classifyFloor } from '../core/core.mjs';
import { applyLiveVerb } from '../step3/step3.mjs';
import { applyStep1 } from '../step1/step1.mjs';
import { classifyStep2 } from '../step2/step2.mjs';
import { loadContext } from './context.mjs';
import { classify } from './pipeline.mjs';

function escalate(msg) {
  console.error('ESCALATE:', msg);
  process.exit(1);
}

const { rows: allRows, vendors, junkSet, allowlistFor, otherNounsFor, frozenJunkSet, frozenAllowlistFor } = loadContext();
const ctx = { junkSet, allowlistFor };
const step2Ctx = { junkSet, otherNounsFor };

const isStep3Leak = (predClass, gtClass) => gtClass === 'x' && predClass === 'w';
const isStep2FalseAlarm = (predClass, gtClass) => gtClass === 'w' && predClass === 'x';
const isLoosening = (predClass, gtClass) => CLASS_ORDER[predClass] < CLASS_ORDER[gtClass];
const STEP2_METHODS = new Set(['PUT', 'DELETE', 'PATCH']);

function score(fn) {
  let leaks = 0, falseAlarms = 0, loosening = 0;
  const leakRows = [];
  const ruleCounts = {};
  for (const row of allRows) {
    const res = fn(row);
    if (isStep3Leak(res.class, row.gt_class)) {
      leaks += 1;
      leakRows.push({ row, res });
      ruleCounts[res.rule] = (ruleCounts[res.rule] || 0) + 1;
    }
    if (isStep2FalseAlarm(res.class, row.gt_class)) falseAlarms += 1;
    if (isLoosening(res.class, row.gt_class)) loosening += 1;
  }
  return { leaks, falseAlarms, loosening, leakRows, ruleCounts };
}

// GATE replays the frozen c15 + C20 shape exactly as frozen, so it uses the
// frozen (raw, unsplit) junkSet/allowlist pair — not the splitter-aware one.
const gate = score((row) => classifyC20(row, frozenJunkSet, frozenAllowlistFor(row.vendor)));
if (gate.leaks !== 89) {
  escalate(`GATE printed ${gate.leaks} step-3 leaks, expected exactly 89 — old numbers do not reproduce`);
}

const fresh = score((row) => classify(row, ctx, { upTo: 'step3' }));

// Step 2 standalone: its own classifier, scored on its own raise-eligible
// population (PUT/DELETE/PATCH), matching the reference measurement
// (g1block.mjs) — not a pipeline stage, never chained onto step 3's
// output (the user's ruling, 2026-09-13).
let step2FalseAlarms = 0, step2Leaks = 0;
for (const row of allRows) {
  if (!STEP2_METHODS.has(row.method)) continue;
  const res = classifyStep2(row, step2Ctx);
  if (isStep2FalseAlarm(res.class, row.gt_class)) step2FalseAlarms += 1;
  if (isStep3Leak(res.class, row.gt_class)) step2Leaks += 1;
}
if (step2FalseAlarms !== 803 || step2Leaks !== 211) {
  escalate(`STEP2 standalone printed ${step2FalseAlarms} false alarms / ${step2Leaks} leaks, expected 803 / 211`);
}

const verbsOnly = score((row) => {
  const afterLiveVerb = applyLiveVerb(classifyFloor(row), row);
  return applyStep1(afterLiveVerb, row, ctx);
});

let mismatch = false;
if (fresh.leaks !== 37) { console.error(`NEW leaks ${fresh.leaks}, expected 37`); mismatch = true; }
if (fresh.falseAlarms !== 2645) { console.error(`NEW step-2 false alarms ${fresh.falseAlarms}, expected 2645`); mismatch = true; }
if (mismatch) escalate('NEW did not match the reference script numbers (37 leaks / 2645 step-2 false alarms)');

// regressions: leak under NEW, not under GATE. rescues: the reverse.
const gateLeakKeys = new Set(gate.leakRows.map(({ row }) => `${row.vendor} ${row.method} ${row.operationId} ${row.path}`));
const freshLeakKeys = new Set(fresh.leakRows.map(({ row }) => `${row.vendor} ${row.method} ${row.operationId} ${row.path}`));

const regressions = fresh.leakRows.filter(({ row }) => !gateLeakKeys.has(`${row.vendor} ${row.method} ${row.operationId} ${row.path}`));
const rescues = gate.leakRows.filter(({ row }) => !freshLeakKeys.has(`${row.vendor} ${row.method} ${row.operationId} ${row.path}`));

function rowLine({ row, res }) {
  return `| ${row.vendor} | ${row.method} | ${row.operationId} | ${row.gt_class} | ${res.class} | ${res.rule} |`;
}

const ruleLines = Object.entries(fresh.ruleCounts)
  .sort((a, b) => b[1] - a[1])
  .map(([rule, n]) => `| ${rule} | ${n} |`)
  .join('\n') || '| (none) | 0 |';

const report = `# Step 3 — clean rebuild score

rows ${allRows.length}, vendors ${vendors.length}, leave-one-vendor-out.

## Summary

| pass | step-3 leaks | step-2 false alarms (info) | all-loosening |
|---|---|---|---|
| GATE — frozen baseline (classifyC20 + c15) | ${gate.leaks} | ${gate.falseAlarms} | ${gate.loosening} |
| NEW — classifyStep3 (this module) | ${fresh.leaks} | ${fresh.falseAlarms} | ${fresh.loosening} |
| NEW, verbs only — classifyByVerb (no noun layer) | ${verbsOnly.leaks} | ${verbsOnly.falseAlarms} | ${verbsOnly.loosening} |

GATE reproduced 89 exactly: yes. NEW matched 37 leaks / 2645 step-2 false alarms: yes.

## NEW step-3 leaks by rule

| rule | count |
|---|---|
${ruleLines}

## Regressions — leak under NEW, not under GATE (${regressions.length})

| vendor | method | operationId | truth | predicted | rule |
|---|---|---|---|---|---|
${regressions.length ? regressions.map(rowLine).join('\n') : '| (none) | | | | | |'}

## Rescues — leak under GATE, not under NEW (${rescues.length})

| vendor | method | operationId | truth | predicted | rule |
|---|---|---|---|---|---|
${rescues.length ? rescues.map(rowLine).join('\n') : '| (none) | | | | | |'}
`;

writeFileSync(new URL('../../../docs/logs/m1/step3-clean.md', import.meta.url), report);

console.log('rows', allRows.length, 'vendors', vendors.length, 'LOVO');
console.log('GATE  leaks', gate.leaks, '| step2 fa', gate.falseAlarms, '| loosening', gate.loosening);
console.log('NEW   leaks', fresh.leaks, '| step2 fa', fresh.falseAlarms, '| loosening', fresh.loosening);
console.log('VERBS leaks', verbsOnly.leaks, '| step2 fa', verbsOnly.falseAlarms, '| loosening', verbsOnly.loosening);
console.log('STEP2 standalone: false alarms', step2FalseAlarms, '| leaks', step2Leaks);
console.log('regressions', regressions.length, 'rescues', rescues.length);
console.log('wrote docs/logs/m1/step3-clean.md');
