// M1 informed arbiter — pure scoring logic, no I/O.
//
// Implements the layered evidence model specified in the M1-C4 spec
// interview: method prior (locks GET/HEAD/OPTIONS to r), scope signal
// (CAMARA rows only), corpus lean (routed through the method prior),
// and a leave-one-repo-out CAMARA verb table. Evidence is pooled per
// row and aggregated fail-closed: any raise evidence wins outright,
// regardless of how much lowering evidence competes with it.
//
// run.mjs owns all CSV loading/parsing and wires real data into the
// functions here; every function in this file takes plain JS
// objects/arrays/Maps so it is testable with synthetic data.

export const CLASS_ORDER = { r: 0, w: 1, x: 2 };

const READ_FAMILY = new Set(['read', 'retrieve', 'check', 'verify', 'match', 'query', 'count', 'assess']);
const WRITE_HINT_FAMILY = new Set(['update', 'write', 'delete', 'modify', 'set']);
const STOPWORDS = new Set(['a', 'an', 'the', 'are', 'see', 'is', 'to', 'of', 'for', 'and', 'by']);

// --- Layer 1: method prior -------------------------------------------------

// Returns 'r' (locked) for GET/HEAD/OPTIONS, the prior class ('w' or 'x')
// for the other five methods, or null for anything unrecognized.
export function methodPrior(method) {
  if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') return 'r';
  if (method === 'PUT' || method === 'DELETE') return 'w';
  if (method === 'POST' || method === 'PATCH') return 'x';
  return null;
}

export function isLockedMethod(method) {
  return method === 'GET' || method === 'HEAD' || method === 'OPTIONS';
}

// --- Lead-verb tokenization -------------------------------------------------

// Lowercase first token of a string, split on camelCase boundaries and on
// '_', '-', '.'.
export function splitLeadToken(str) {
  if (!str) return '';
  const withBoundaries = String(str).replace(/([a-z0-9])([A-Z])/g, '$1_$2');
  const parts = withBoundaries.split(/[_\-.]+/).filter((p) => p.length > 0);
  return parts.length ? parts[0].toLowerCase() : '';
}

// Lead verb for a row: first token of operationId, split as above; falls
// back to the last non-{param} path segment when operationId is empty.
export function leadVerbForRow(row) {
  const opId = (row.operationId || '').trim();
  if (opId !== '') return splitLeadToken(opId);
  const path = row.path || '';
  const segments = path.split('/').filter((s) => s && !(s.startsWith('{') && s.endsWith('}')));
  const last = segments.length ? segments[segments.length - 1] : '';
  return splitLeadToken(last);
}

// --- Layer 2: scope (CAMARA rows only; contributes nothing when the field
// is empty, which is naturally true for non-CAMARA rows) -------------------
//
// CORRECTED RULE (post-escalation fix): each scope token maps to a class
// "hint" (r/w/x), compared against the row's prior on the r<w<x ordering —
// this replaces the earlier method-conditioned read-family/update-family/
// else split. hint below prior -> lower toward hint; hint == prior -> no
// evidence weight, but an "-agrees" fragment is still recorded so agreement
// is visible in the evidence trail; hint above prior -> raise.

function scopeHint(token) {
  if (READ_FAMILY.has(token)) return 'r';
  if (WRITE_HINT_FAMILY.has(token)) return 'w';
  return 'x';
}

export function layer2ScopeEvidence(row, priorClass) {
  const scopesStr = row.security_scopes || '';
  if (scopesStr === '') return [];
  const evidence = [];
  for (const scope of scopesStr.split('|')) {
    if (scope === '') continue;
    const idx = scope.lastIndexOf(':');
    const token = (idx >= 0 ? scope.slice(idx + 1) : scope).toLowerCase();
    const hint = scopeHint(token);
    const hintIdx = CLASS_ORDER[hint];
    const priorIdx = CLASS_ORDER[priorClass];
    if (hintIdx < priorIdx) {
      const weight = hint === 'r' ? 1.0 : 0.6; // hint can only be r or w here
      evidence.push({ dir: 'lower', target: hint, weight, evidence: `scope:${token}->lower:${hint}` });
    } else if (hintIdx === priorIdx) {
      evidence.push({ dir: 'agree', target: hint, weight: 0, evidence: `scope:${token}-agrees` });
    } else {
      evidence.push({ dir: 'raise', target: 'x', weight: 1.0, evidence: `scope:${token}->raise` });
    }
  }
  return evidence;
}

// --- Layer 3: corpus lean, routed through the prior ------------------------
//
// leanIndex: Map<token, {providers, perprov_get, perprov_post, perprov_put,
// perprov_patch, perprov_delete, perprov_head, perprov_options}> for
// position === 'lead' rows, keyed by token.

export function layer3CorpusEvidence(leadVerbToken, method, leanIndex) {
  if (!leadVerbToken || STOPWORDS.has(leadVerbToken)) return [];
  // PUT/DELETE: no evidence from this layer in this pass. GET/HEAD/OPTIONS
  // never reach this layer (locked at layer 1).
  if (method !== 'POST' && method !== 'PATCH') return [];
  const lean = leanIndex.get(leadVerbToken);
  if (!lean) return [];
  const total =
    lean.perprov_get +
    lean.perprov_post +
    lean.perprov_put +
    lean.perprov_patch +
    lean.perprov_delete +
    lean.perprov_head +
    lean.perprov_options;
  if (total === 0) return [];
  const shareGet = lean.perprov_get / total;
  const sharePutPatch = (lean.perprov_put + lean.perprov_patch) / total;
  const f = Math.min(1, lean.providers / 10);
  if (shareGet >= 0.75) {
    return [
      {
        dir: 'lower',
        target: 'r',
        weight: shareGet * f,
        evidence: `corpus:${leadVerbToken}->lower:r:shareGet=${shareGet.toFixed(3)}`,
      },
    ];
  }
  if (sharePutPatch >= 0.5) {
    return [
      {
        dir: 'lower',
        target: 'w',
        weight: sharePutPatch * f,
        evidence: `corpus:${leadVerbToken}->lower:w:sharePutPatch=${sharePutPatch.toFixed(3)}`,
      },
    ];
  }
  return [];
}

// --- Layer 4: CAMARA verb signal, leave-one-repo-out -----------------------

// Build a leadVerb -> repo -> {r,w,x} count table from CAMARA rows (rows
// must carry repo, operationId/path, and gt_class in {r,w,x}).
export function buildVerbTable(camaraRows) {
  const table = new Map();
  for (const row of camaraRows) {
    const gt = row.gt_class;
    if (gt !== 'r' && gt !== 'w' && gt !== 'x') continue;
    const token = leadVerbForRow(row);
    if (!token) continue;
    if (!table.has(token)) table.set(token, new Map());
    const byRepo = table.get(token);
    if (!byRepo.has(row.repo)) byRepo.set(row.repo, { r: 0, w: 0, x: 0 });
    byRepo.get(row.repo)[gt] += 1;
  }
  return table;
}

// Sum counts for leadVerbToken across all repos except excludeRepo (pass
// null/undefined for no exclusion, i.e. the holdout-set case).
export function verbCountsFor(table, leadVerbToken, excludeRepo) {
  const byRepo = table.get(leadVerbToken);
  if (!byRepo) return null;
  const counts = { r: 0, w: 0, x: 0 };
  for (const [repo, c] of byRepo) {
    if (excludeRepo != null && repo === excludeRepo) continue;
    counts.r += c.r;
    counts.w += c.w;
    counts.x += c.x;
  }
  return counts;
}

export function layer4VerbEvidence(counts, leadVerbToken) {
  if (!counts) return [];
  const n = counts.r + counts.w + counts.x;
  if (n < 3) return [];
  const shareR = counts.r / n;
  const shareW = counts.w / n;
  const shareX = counts.x / n;
  if (shareR >= 0.9) {
    return [
      {
        dir: 'lower',
        target: 'r',
        weight: 0.8 * shareR,
        evidence: `verbtable:${leadVerbToken}->lower:r:shareR=${shareR.toFixed(3)}`,
      },
    ];
  }
  if (shareW >= 0.9) {
    return [
      {
        dir: 'lower',
        target: 'w',
        weight: 0.6 * shareW,
        evidence: `verbtable:${leadVerbToken}->lower:w:shareW=${shareW.toFixed(3)}`,
      },
    ];
  }
  if (shareX >= 0.9) {
    return [
      {
        dir: 'raise',
        target: 'x',
        weight: 0.8,
        evidence: `verbtable:${leadVerbToken}->raise:shareX=${shareX.toFixed(3)}`,
      },
    ];
  }
  return [];
}

// --- Aggregation ------------------------------------------------------------

// Pools evidence from layers 2-4 into a final class/confidence/status,
// fail-closed: any raise evidence (R > 0) wins outright over lowering,
// regardless of relative weight magnitude. CORRECTED RULE (post-escalation
// fix): a raise always means "toward x", on every method — not "capped at
// the method's prior" as originally specified. This lets a PUT/DELETE row
// reach x via a raise, which the original rule could never do.
export function aggregate(evidenceList, priorClass, threshold) {
  let R = 0;
  let Lr = 0;
  let Lw = 0;
  const fired = [];
  for (const e of evidenceList) {
    fired.push(e.evidence);
    if (e.dir === 'raise') R += e.weight;
    else if (e.dir === 'lower' && e.target === 'r') Lr += e.weight;
    else if (e.dir === 'lower' && e.target === 'w') Lw += e.weight;
    // 'agree' items contribute weight 0 to R/L_r/L_w but are still recorded
    // in the evidence trail (fired above).
  }
  if (R > 0) {
    return { class: 'x', confidence: R, status: 'assigned', evidence: fired };
  }
  if (Lr >= threshold) {
    return { class: 'r', confidence: Lr, status: 'assigned', evidence: fired };
  }
  if (Lw >= threshold || Lr + Lw >= threshold) {
    return { class: 'w', confidence: Lw, status: 'assigned', evidence: fired };
  }
  return { class: priorClass, confidence: Math.max(Lr, Lw), status: 'review', evidence: fired };
}

// --- Top-level row scoring ---------------------------------------------------
//
// ctx: { leanIndex: Map<token, leanRow>, verbTable: Map<token, Map<repo, counts>> }
// row: must carry method, operationId, path, security_scopes, set, repo.

export function scoreRow(row, ctx, threshold) {
  const method = row.method;
  if (isLockedMethod(method)) {
    return {
      class: 'r',
      confidence: 1,
      status: 'assigned',
      evidence: [`method-prior:${method}-locked`],
      prior: 'r',
    };
  }
  const prior = methodPrior(method);
  if (!prior) {
    throw new Error(`scoreRow: unrecognized method "${method}"`);
  }
  const leadVerbToken = leadVerbForRow(row);
  const evidence = [];
  evidence.push(...layer2ScopeEvidence(row, prior));
  evidence.push(...layer3CorpusEvidence(leadVerbToken, method, ctx.leanIndex || new Map()));
  const excludeRepo = row.set === 'camara' ? row.repo : null;
  const counts = ctx.verbTable ? verbCountsFor(ctx.verbTable, leadVerbToken, excludeRepo) : null;
  evidence.push(...layer4VerbEvidence(counts, leadVerbToken));
  const result = aggregate(evidence, prior, threshold);
  return { ...result, prior };
}
