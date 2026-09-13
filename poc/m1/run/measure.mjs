// Goal 2 clean measurement: corpus load, LOVO allowlist build, scoring,
// and the markdown report. Run: node poc/m1/run/measure.mjs
//
// Two gates, both must hold before anything is written:
//   1. corpus shape — 5465 rows, 332 vendors (enforced by core/corpus.mjs)
//   2. GATE score — the frozen c20/c15 baseline must print exactly 89
//      goal-2 leaks. If it doesn't, the old numbers never reproduced and
//      nothing past this point can be trusted.
import { writeFileSync } from 'node:fs';
import { CLASS_ORDER } from '../arbiter/arbiter.mjs';
import { classifyC20 } from '../arbiter/c20.mjs';
import { classifyFloor } from '../core/core.mjs';
import { applyLiveVerb } from '../goal2/goal2.mjs';
import { applyGoal3 } from '../goal3/goal3.mjs';
import { loadContext } from './context.mjs';
import { classify } from './pipeline.mjs';

function escalate(msg) {
  console.error('ESCALATE:', msg);
  process.exit(1);
}

const { rows: allRows, vendors, junkSet, allowlistFor, lowerVerbsFor, frozenJunkSet, frozenAllowlistFor } = loadContext();
const ctx = { junkSet, allowlistFor, lowerVerbsFor };

const isGoal2Leak = (predClass, gtClass) => gtClass === 'x' && predClass === 'w';
const isGoal1FalseAlarm = (predClass, gtClass) => gtClass === 'w' && predClass === 'x';
const isLoosening = (predClass, gtClass) => CLASS_ORDER[predClass] < CLASS_ORDER[gtClass];

function score(fn) {
  let leaks = 0, falseAlarms = 0, loosening = 0;
  const leakRows = [];
  const ruleCounts = {};
  for (const row of allRows) {
    const res = fn(row);
    if (isGoal2Leak(res.class, row.gt_class)) {
      leaks += 1;
      leakRows.push({ row, res });
      ruleCounts[res.rule] = (ruleCounts[res.rule] || 0) + 1;
    }
    if (isGoal1FalseAlarm(res.class, row.gt_class)) falseAlarms += 1;
    if (isLoosening(res.class, row.gt_class)) loosening += 1;
  }
  return { leaks, falseAlarms, loosening, leakRows, ruleCounts };
}

// GATE replays the frozen c15 + C20 shape exactly as frozen, so it uses the
// frozen (raw, unsplit) junkSet/allowlist pair — not the splitter-aware one.
const gate = score((row) => classifyC20(row, frozenJunkSet, frozenAllowlistFor(row.vendor)));
if (gate.leaks !== 89) {
  escalate(`GATE printed ${gate.leaks} goal-2 leaks, expected exactly 89 — old numbers do not reproduce`);
}

const fresh = score((row) => classify(row, ctx, { upTo: 'goal2' }));
const atGoal1 = score((row) => classify(row, ctx, { upTo: 'goal1' }));
const verbsOnly = score((row) => {
  const afterLiveVerb = applyLiveVerb(classifyFloor(row), row);
  return applyGoal3(afterLiveVerb, row, ctx);
});

let mismatch = false;
if (fresh.leaks !== 37) { console.error(`NEW leaks ${fresh.leaks}, expected 37`); mismatch = true; }
if (fresh.falseAlarms !== 2703) { console.error(`NEW goal-1 false alarms ${fresh.falseAlarms}, expected 2703`); mismatch = true; }
if (mismatch) escalate('NEW did not match the reference script numbers (37 leaks / 2703 goal-1 false alarms)');

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

const report = `# Goal 2 — clean rebuild score

rows ${allRows.length}, vendors ${vendors.length}, leave-one-vendor-out.

## Summary

| pass | goal-2 leaks | goal-1 false alarms (info) | all-loosening |
|---|---|---|---|
| GATE — frozen baseline (classifyC20 + c15) | ${gate.leaks} | ${gate.falseAlarms} | ${gate.loosening} |
| NEW — classifyGoal2 (this module) | ${fresh.leaks} | ${fresh.falseAlarms} | ${fresh.loosening} |
| NEW, verbs only — classifyByVerb (no noun layer) | ${verbsOnly.leaks} | ${verbsOnly.falseAlarms} | ${verbsOnly.loosening} |

GATE reproduced 89 exactly: yes. NEW matched 37 leaks / 2703 goal-1 false alarms: yes.

## NEW goal-2 leaks by rule

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

writeFileSync(new URL('../../../docs/logs/m1/goal2-clean.md', import.meta.url), report);

console.log('rows', allRows.length, 'vendors', vendors.length, 'LOVO');
console.log('GATE  leaks', gate.leaks, '| goal1 fa', gate.falseAlarms, '| loosening', gate.loosening);
console.log('NEW   leaks', fresh.leaks, '| goal1 fa', fresh.falseAlarms, '| loosening', fresh.loosening);
console.log('VERBS leaks', verbsOnly.leaks, '| goal1 fa', verbsOnly.falseAlarms, '| loosening', verbsOnly.loosening);
console.log('GOAL1 after lower-verb: goal1 fa', atGoal1.falseAlarms, '| goal-2 leaks at goal1 stage', atGoal1.leaks);
console.log('regressions', regressions.length, 'rescues', rescues.length);
console.log('wrote docs/logs/m1/goal2-clean.md');
