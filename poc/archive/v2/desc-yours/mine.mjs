// poc/desc-yours: experiment only, never wired into poc/flow. Question:
// step 2's "yours" allowlist is mined only from operationId + summary text
// (poc/flow/step2.mjs's buildStep2Context); the x-pile rows often carry a
// description the flow never reads. If the yours list is ALSO mined from
// description text, how much smaller does the pile get, and how many
// leaks (truth x resolved to w) does that cost?
//
// Imports real, exported flow pieces wherever they exist:
//   - nounsForRow, buildJunkSet from poc/flow/words.mjs (exported)
//   - LIVE_VERBS, YOURS_MIN_N, YOURS_MIN_W_SHARE from poc/flow/step2.mjs (exported)
//   - READ_VERBS from poc/flow/step1.mjs (exported; verbatim same 14 words
//     as step2's own private NON_NOUN_READ_VERBS list, so the union below
//     reproduces step2's private NOUN_SKIP_VERBS exactly without copying it)
//   - buildContext, classifyRow from poc/flow/flow.mjs (exported)
//   - loadRows from poc/flow/corpus.mjs (exported)
//
// One named exception, authorized 2026-09-16: countNounsByVendor below is
// copied VERBATIM from poc/flow/step2.mjs (lines 56-72 as of that date). It
// is not exported there, and poc/flow/ is not being touched for a one-off
// experiment — a POC owning its own copy of a small, self-contained,
// dependency-free helper is the project's standing rule for new module
// code (CLAUDE.md: "new module code imports nothing from frozen or
// archived code; copy only what is used and test it"). mine.test.mjs test
// (a) is what catches drift between this copy and the live original: it
// asserts this file's mined 'summary'-source yours list is set-equal, both
// directions, to poc/flow's own ctx.yoursFor for sampled vendors. If that
// ever stops matching, the finding is the drift itself, not a test to
// adjust.
import { buildJunkSet, nounsForRow } from '../flow/words.mjs';
import { LIVE_VERBS, YOURS_MIN_N, YOURS_MIN_W_SHARE } from '../flow/step2.mjs';
import { READ_VERBS } from '../flow/step1.mjs';
import { buildContext, classifyRow } from '../flow/flow.mjs';

export { YOURS_MIN_N, YOURS_MIN_W_SHARE };

// GET/HEAD/OPTIONS rows carry no yours/other signal (2026-09-14 decision,
// poc/flow/step2.mjs) — same three strings, written locally per the brief
// rather than imported (step2.mjs does not export this set).
const READ_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

// Same union step2.mjs builds privately as NOUN_SKIP_VERBS (LIVE_VERBS ∪
// NON_NOUN_READ_VERBS) — NON_NOUN_READ_VERBS is step1's READ_VERBS
// verbatim (step2.mjs's own comment says so), and READ_VERBS is exported,
// so this reproduces NOUN_SKIP_VERBS without copying anything.
const NOUN_SKIP_VERBS = new Set([...LIVE_VERBS, ...READ_VERBS]);

// --- countNounsByVendor -----------------------------------------------------
// Copied verbatim from poc/flow/step2.mjs (2026-09-16) — see file header.
function countNounsByVendor(rows, nounsOf) {
  const stat = new Map();
  for (const row of rows) {
    const nouns = nounsOf(row);
    if (nouns.size === 0) continue;
    const cls = row.gt_class;
    for (const n of nouns) {
      if (!stat.has(n)) stat.set(n, { w: 0, x: 0, r: 0, byVendor: new Map() });
      const t = stat.get(n);
      t[cls] = (t[cls] || 0) + 1;
      if (!t.byVendor.has(row.vendor)) t.byVendor.set(row.vendor, { w: 0, x: 0, r: 0 });
      const v = t.byVendor.get(row.vendor);
      v[cls] = (v[cls] || 0) + 1;
    }
  }
  return stat;
}

// --- per-source text wiring --------------------------------------------------
//
// nounsForRow (poc/flow/words.mjs) reads two channels: headNounForRow,
// which parses row.summary as prose (verb, then object phrase up to a
// stop-word/comma/paren) and operationIdHeadNoun + the raw token loop,
// which parses row.operationId as an IDENTIFIER (camelCase/underscore/
// dash-split) — never prose. So to add a source without writing a second
// noun reader, only the prose (summary) slot is ever swapped; operationId
// always stays the row's real operationId, keeping that channel meaningful
// for every source. This also makes 'summary' below the identity
// transform, so it reproduces step2's own mining bit-for-bit (test a).
export const SOURCES = ['summary', 'description', 'both'];

export function rowForSource(row, source) {
  if (source === 'summary') return row;
  if (source === 'description') return { ...row, summary: row.description || '' };
  if (source === 'both') return { ...row, summary: `${row.summary || ''} ${row.description || ''}`.trim() };
  throw new Error(`unknown source: ${source}`);
}

// The one noun reader for all three sources — mining and scoring both call
// this, never a second reader.
export function nounsFromRow(row, ctx, source) {
  return nounsForRow(rowForSource(row, source), ctx.junkSet, NOUN_SKIP_VERBS);
}

// buildDescYours(rows, vendors, { minN, minWShare, source }) — mines a
// "yours" allowlist per vendor, leave-one-vendor-out, exactly like step 2's
// yoursStat/yoursFor (population: every method but GET/HEAD/OPTIONS; admit
// a noun when the OTHER vendors' rows with that noun have n >= minN and
// w/n >= minWShare), except the junk set and the nouns come from
// `source`'s text via nounsFromRow/rowForSource above.
export function buildDescYours(rows, vendors, { minN = YOURS_MIN_N, minWShare = YOURS_MIN_W_SHARE, source }) {
  if (!SOURCES.includes(source)) throw new Error(`unknown source: ${source}`);

  const transformed = rows.map((r) => rowForSource(r, source));
  const junkSet = buildJunkSet(transformed);
  const ctx0 = { junkSet };
  const nounsOf = (row) => nounsFromRow(row, ctx0, 'summary'); // row already transformed; 'summary' = identity here

  const writeRows = transformed.filter((r) => !READ_METHODS.has(r.method));
  const yoursStat = countNounsByVendor(writeRows, nounsOf);

  const yoursByVendor = new Map();
  for (const vendor of vendors) {
    const admitted = new Set();
    for (const [noun, t] of yoursStat) {
      const own = t.byVendor.get(vendor) || { w: 0, x: 0, r: 0 };
      const w = t.w - own.w, x = t.x - own.x, r = t.r - own.r;
      const n = w + x + r;
      if (n >= minN && w / n >= minWShare) admitted.add(noun);
    }
    yoursByVendor.set(vendor, admitted);
  }

  function yoursFor(vendor) {
    return yoursByVendor.get(vendor) || new Set();
  }

  return { junkSet, yoursFor, source, minN, minWShare };
}

// resolvePile(rows, vendors, opts): for every corpus row today's flow
// leaves flagged x-pile (found by actually running poc/flow's own
// buildContext + classifyRow, never reimplemented), decide with the mined
// list (opts.source/minN/minWShare) whether it resolves.
export function resolvePile(rows, vendors, opts) {
  const flowCtx = buildContext(rows, vendors);
  const pile = rows.filter((row) => classifyRow(row, flowCtx).flag === 'x-pile');

  const descCtx = buildDescYours(rows, vendors, opts);

  return pile.map((row) => {
    const nouns = nounsFromRow(row, descCtx, opts.source);
    const yoursNouns = descCtx.yoursFor(row.vendor);
    let outcome;
    if (nouns.size === 0) {
      outcome = 'no noun';
    } else if ([...nouns].every((n) => yoursNouns.has(n))) {
      outcome = 'resolved';
    } else {
      outcome = 'stays';
    }
    return {
      vendor: row.vendor,
      method: row.method,
      path: row.path,
      operationId: row.operationId,
      summary: row.summary,
      truth: row.gt_class,
      outcome,
    };
  });
}
