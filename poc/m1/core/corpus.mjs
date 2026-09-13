// The one place the combined corpus is loaded, plus its shape asserts.
// D57: the noun table / allowlist build moved to goal2/allowlist.mjs — core
// owns row loading only, not any goal's evidence.
import { loadCombinedCorpus } from '../arbiter/c19.mjs';

function escalate(msg) {
  console.error('ESCALATE:', msg);
  process.exit(1);
}

// Loads the corpus and returns { rows, vendors }, asserting the corpus
// shape every caller already checked for.
export function loadContext() {
  const { allRows } = loadCombinedCorpus();
  const vendors = [...new Set(allRows.map((r) => r.vendor))].sort();

  if (allRows.length !== 5465) escalate(`corpus rows ${allRows.length}, expected 5465`);
  if (vendors.length !== 332) escalate(`corpus vendors ${vendors.length}, expected 332`);

  return { rows: allRows, vendors };
}
