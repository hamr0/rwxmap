// M1 informed arbiter — pure scoring logic, no I/O.
//
// Implements the layered evidence model specified in the M1-C4 spec
// interview: method prior (locks GET/HEAD/OPTIONS to r), scope signal
// (CAMARA rows only), corpus lean (routed through the method prior),
// and a leave-one-repo-out CAMARA verb table. Evidence is pooled per
// row and aggregated fail-closed: any raise evidence wins outright,
// regardless of how much lowering evidence competes with it.
//
// M1-C5 mechanical fixes on top of the above (all always-on except the
// corpus PATCH/POST w-lean, which is a named switch — see scoreRow's
// `switches` param):
//   1. write-hint scope tokens never lower on POST; on PUT/PATCH/DELETE
//      they only ever agree (never lower there either).
//   2. conflicting scope hints on the same row cancel any lowering (a
//      raise is never cancelled).
//   3. a lead token equal to the row's own HTTP method is stripped and
//      the next token becomes the lead, both for the corpus lookup and
//      the CAMARA verb table.
//   4. a scope token outside the read/write-hint/explicit-x-hint
//      families gives no evidence at all (it no longer defaults to an
//      x-hint raise).
//   5. the corpus's PUT+PATCH-share w-lean on POST/PATCH is a switch
//      (`switches.corpusWLean`, default true).
//
// M1-C6 three new evidence layers, every admitted list mechanically derived
// from CAMARA + hold-out-1 rows in run.mjs (never hand-written) and passed
// in via ctx:
//   2b. on POST/PATCH, a scope hint that used to merely "agree" with the
//       prior x now raises, per METHOD (POST and PATCH measured and gated
//       separately, never pooled): a write-family or x-hint-family token
//       raises at that method's measured CAMARA x share only when it
//       clears n >= 5, share >= 0.9 (the same bar every other admitted
//       list uses); otherwise it stays a plain agreement. PUT/DELETE
//       unchanged.
//   5.  requestBody property names and present-only flags (callbacks
//       present, has202, an Idempotency-Key header) admitted at n >= 5,
//       x share >= 0.9 over CAMARA + hold-out 1, raise at weight = share.
//   6.  for PUT/DELETE/PATCH rows, structural own-vs-other facts (path
//       param names, body prop names, resource-schema party field,
//       party-id param, resource-schema prop names) admitted the same way,
//       raise at weight = share.
// Every table in layers 2b/5/6 is leave-one-repo-out for CAMARA and
// hold-out-1 rows (rowExcludeRepo below); hold-out-2 rows use the table
// whole. Admission itself (which names/facts qualify) is decided once from
// the full CAMARA + hold-out-1 table in run.mjs, not per scored row.
//
// M1-C7 (D32, user ruling 2026-09-07): one rule change on top of C6 — the
// callbacks_present raise in layer 5 does not fire for a read-led operation
// (CAMARA's poll-then-callback reads). See isReadVerbForRow below for the
// mechanical "read" test. Everything else in this file is unchanged from C6.
//
// M1-C8 (D30, prose last): layer 7, summary/description words, admitted
// mechanically the same way as layers 5/6 (n >= 5, x share >= 0.9 over
// CAMARA + hold-out 1, leave-one-repo-out at score time via rowExcludeRepo),
// raise-only, weight = share. A per-row word set is computed outside this
// file (run-c8.mjs, since raw text is not a census column) and attached as
// `row.words` (a Set<string> of surviving tokens, high-frequency tokens
// already dropped); wordKeysForRow below just reads it, the same shape as
// bodyPropKeysForRow/schemaPropKeysForRow. Gated behind switches.wordsOn
// (default OFF) so run-c8.mjs can sweep it like every other switch.
//
// M1-C9 (the two-pass shape): two new switches, `switches.layer3On` and
// `switches.layer4On`, both defaulting to true so every existing caller
// (run.mjs, run-c8.mjs, which never pass them) is unaffected. run-c9.mjs's
// pass 1 calls scoreRow with both false, which removes layer 3 (corpus
// lean) and layer 4 (CAMARA verb table) from the evidence sum entirely —
// not merely gated off, they never push evidence or even look anything up.
// Everything else in this file is unchanged.
//
// run.mjs owns all CSV loading/parsing and wires real data into the
// functions here; every function in this file takes plain JS
// objects/arrays/Maps so it is testable with synthetic data.

export const CLASS_ORDER = { r: 0, w: 1, x: 2 };

const READ_FAMILY = new Set(['read', 'retrieve', 'check', 'verify', 'match', 'query', 'count', 'assess']);
const WRITE_HINT_FAMILY = new Set(['update', 'write', 'delete', 'modify', 'set']);
// M1-C5 fix 4: explicit x-hint tokens, minimal set read off the census (see
// docs/logs/learnings.md M1-C5). Anything not in READ_FAMILY,
// WRITE_HINT_FAMILY or this set is "unknown" and gives no evidence.
const X_HINT_FAMILY = new Set(['create', 'send', 'subscribe', 'register', 'invoke', 'call', 'dial', 'pay', 'transfer', 'notify']);
const STOPWORDS = new Set(['a', 'an', 'the', 'are', 'see', 'is', 'to', 'of', 'for', 'and', 'by']);
// M1-C5 fix 3: HTTP-method words that get stripped from lead position when
// the operationId starts with the word followed by a separator (see
// METHOD_PREFIX_SEPARATOR below) — never on a camelCase continuation.
const METHOD_WORDS = new Set(['get', 'post', 'put', 'patch', 'delete', 'head', 'options']);
// A separator or a digit right after the method word means it is a
// redundant method-name prefix (post_ai_ask, post-cardDetails,
// delete_files_id); an uppercase letter there means ordinary camelCase
// (deleteDevice, getSession, updateDevice) and the word is a real verb.
const METHOD_PREFIX_SEPARATOR = /^[_\-.0-9]/;

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

// Lowercase all tokens of a string, split on camelCase boundaries and on
// '_', '-', '.'.
export function splitTokens(str) {
  if (!str) return [];
  const withBoundaries = String(str).replace(/([a-z0-9])([A-Z])/g, '$1_$2');
  return withBoundaries
    .split(/[_\-.]+/)
    .filter((p) => p.length > 0)
    .map((p) => p.toLowerCase());
}

// Lowercase first token of a string, split on camelCase boundaries and on
// '_', '-', '.'.
export function splitLeadToken(str) {
  const tokens = splitTokens(str);
  return tokens.length ? tokens[0] : '';
}

// Raw string a row's lead verb is derived from: the operationId, or the
// last non-{param} path segment when operationId is empty.
function rawLeadStringForRow(row) {
  const opId = (row.operationId || '').trim();
  if (opId !== '') return opId;
  const path = row.path || '';
  const segments = path.split('/').filter((s) => s && !(s.startsWith('{') && s.endsWith('}')));
  return segments.length ? segments[segments.length - 1] : '';
}

// M1-C5 fix 3 (corrected): strip a leading method-word prefix ONLY when it
// is followed by a separator or a digit in the raw string (post_ai_ask,
// post-cardDetails, delete_files_id) — never on a camelCase continuation
// (deleteDevice, getSession, updateDevice keep their verb as the lead).
// Returns { tokens, stripped }; tokens is never empty unless the raw
// string tokenizes to nothing at all.
// M1-C9 correction (round 2): exported (was file-private) so judge.mjs can
// reuse the exact C5 method-word-stripped token list for its
// operationIdPartyToken check, rather than reimplementing the stripping
// logic — same tokenization leadVerbForRow itself uses.
export function tokensForRow(row) {
  const raw = rawLeadStringForRow(row);
  const tokens = splitTokens(raw);
  if (!tokens.length) return { tokens, stripped: false };
  const method = (row.method || '').toLowerCase();
  if (!METHOD_WORDS.has(method) || tokens[0] !== method) return { tokens, stripped: false };
  const rest = String(raw).slice(method.length);
  if (!METHOD_PREFIX_SEPARATOR.test(rest)) return { tokens, stripped: false }; // camelCase continuation
  if (tokens.length < 2) return { tokens, stripped: false }; // nothing to skip to
  return { tokens: tokens.slice(1), stripped: true };
}

export function leadVerbForRow(row) {
  const { tokens } = tokensForRow(row);
  return tokens.length ? tokens[0] : '';
}

// True when leadVerbForRow actually stripped a method-word lead token for
// this row (used only for the M1-C5 "rows touched" report in run.mjs).
export function leadVerbWasMethodStripped(row) {
  return tokensForRow(row).stripped;
}

// --- Layer 2: scope (CAMARA rows only; contributes nothing when the field
// is empty, which is naturally true for non-CAMARA rows) -------------------
//
// CORRECTED RULE (post-escalation fix): each scope token maps to a class
// "hint" (r/w/x/unknown), compared against the row's prior on the r<w<x
// ordering — this replaces the earlier method-conditioned
// read-family/update-family/else split. hint below prior -> lower toward
// hint; hint == prior -> no evidence weight, but an "-agrees" fragment is
// still recorded so agreement is visible in the evidence trail; hint above
// prior -> raise. An "unknown" hint (M1-C5 fix 4) gives no evidence at all.
//
// M1-C5 fix 1: a write-hint token never lowers. On PUT/PATCH/DELETE it only
// ever agrees (recorded, zero weight); on POST it contributes nothing.
// M1-C5 fix 2: when the row's scope tokens carry more than one distinct
// known (r/w/x) hint, any lowering is dropped — a raise is never dropped.

function scopeHint(token) {
  if (READ_FAMILY.has(token)) return 'r';
  if (WRITE_HINT_FAMILY.has(token)) return 'w';
  if (X_HINT_FAMILY.has(token)) return 'x';
  return 'unknown';
}

// M1-C6 layer 2b (revised): on POST and PATCH, a scope hint that merely
// *agreed* with the prior x is upgraded to a raise — but only on the
// specific method where the family's measured x share clears the same bar
// every other admitted list uses (n >= 5, share >= 0.9), never a fixed
// weight and never pooled across methods. `writeFamilyXShare` /
// `xHintXShare` are that measured, leave-one-repo-out, per-method share
// (null when the method's family did not clear the bar, in which case the
// token gives no evidence there — same as the pre-2b/pre-revision
// behavior). PUT/DELETE are unchanged: a write-hint token there only ever
// agrees; an x-hint token there always raises (already above the prior).
export function layer2ScopeEvidence(row, priorClass, writeFamilyXShare = null, xHintXShare = null) {
  const scopesStr = row.security_scopes || '';
  if (scopesStr === '') return [];
  const method = row.method;
  const isPostPatch = method === 'POST' || method === 'PATCH';
  const tokens = scopesStr
    .split('|')
    .filter((s) => s !== '')
    .map((scope) => {
      const idx = scope.lastIndexOf(':');
      return (idx >= 0 ? scope.slice(idx + 1) : scope).toLowerCase();
    });
  const hints = tokens.map(scopeHint);
  // fix 2: cancellation looks at the KNOWN (r/w/x) hints only — an
  // "unknown" token gives no evidence and must not affect any other token.
  const knownHints = new Set(hints.filter((h) => h !== 'unknown'));
  const cancelLowering = knownHints.size > 1;

  const priorIdx = CLASS_ORDER[priorClass];
  const evidence = [];
  tokens.forEach((token, i) => {
    const hint = hints[i];
    if (hint === 'unknown') {
      evidence.push({ dir: 'none', target: null, weight: 0, evidence: `scope:${token}-unknown` });
      return;
    }
    if (hint === 'w') {
      // fix 1 (still holds): write-hint tokens never lower, on any method.
      if (isPostPatch) {
        // M1-C6 layer 2b: raises on POST/PATCH when the measured share is
        // available; otherwise no evidence (matches the pre-C6 rule).
        if (writeFamilyXShare != null) {
          evidence.push({
            dir: 'raise',
            target: 'x',
            weight: writeFamilyXShare,
            evidence: `scope:${token}->raise:writeFamilyShare=${writeFamilyXShare.toFixed(3)}`,
          });
        } else {
          evidence.push({ dir: 'none', target: null, weight: 0, evidence: `scope:${token}-write-no-table` });
        }
      } else {
        // PUT/DELETE: unchanged, only ever agrees.
        evidence.push({ dir: 'agree', target: 'w', weight: 0, evidence: `scope:${token}-agrees` });
      }
      return;
    }
    const hintIdx = CLASS_ORDER[hint];
    if (hintIdx < priorIdx) {
      if (cancelLowering) {
        evidence.push({ dir: 'none', target: null, weight: 0, evidence: `scope:${token}->lower:${hint}-cancelled` });
      } else {
        const weight = hint === 'r' ? 1.0 : 0.6;
        evidence.push({ dir: 'lower', target: hint, weight, evidence: `scope:${token}->lower:${hint}` });
      }
    } else if (hintIdx === priorIdx) {
      // M1-C6 layer 2b (revised): an x-hint token can only equal the prior
      // on POST/PATCH (prior is already x there) — upgrade agreement to a
      // raise only when this method's measured x-hint share clears n >= 5,
      // share >= 0.9; otherwise it stays a plain agreement (no evidence).
      if (hint === 'x' && isPostPatch && xHintXShare != null) {
        evidence.push({
          dir: 'raise',
          target: 'x',
          weight: xHintXShare,
          evidence: `scope:${token}->raise:xHintShare=${xHintXShare.toFixed(3)}`,
        });
      } else {
        evidence.push({ dir: 'agree', target: hint, weight: 0, evidence: `scope:${token}-agrees` });
      }
    } else {
      evidence.push({ dir: 'raise', target: 'x', weight: 1.0, evidence: `scope:${token}->raise` });
    }
  });
  return evidence;
}

// M1-C6 (revised): measured x share of a scope-hint family, on ONE method,
// built as a per-repo table so the caller can leave-one-repo-out. A row
// counts if its method matches, it has a resolved gt_class, and at least
// one of its scope tokens has the given hint ('w' for the write family, 'x'
// for the explicit x-hint family). Kept per-method — never pooled across
// POST and PATCH — because the two measure differently (see run.mjs's own
// count: write-family POST 0.94 admitted, PATCH not).
export function buildScopeFamilyTable(rows, method, hintValue) {
  const byRepo = new Map();
  for (const row of rows) {
    if (row.method !== method) continue;
    const gt = row.gt_class;
    if (gt !== 'r' && gt !== 'w' && gt !== 'x') continue;
    const scopesStr = row.security_scopes || '';
    if (scopesStr === '') continue;
    const tokens = scopesStr
      .split('|')
      .filter((s) => s !== '')
      .map((scope) => {
        const idx = scope.lastIndexOf(':');
        return (idx >= 0 ? scope.slice(idx + 1) : scope).toLowerCase();
      });
    if (!tokens.some((t) => scopeHint(t) === hintValue)) continue;
    if (!byRepo.has(row.repo)) byRepo.set(row.repo, { r: 0, w: 0, x: 0 });
    byRepo.get(row.repo)[gt] += 1;
  }
  return byRepo;
}

// Sum a buildScopeFamilyTable() map across all repos except excludeRepo, and
// return {n, share} or null when there are no rows at all.
export function shareExcludingRepo(byRepo, excludeRepo) {
  const counts = { r: 0, w: 0, x: 0 };
  for (const [repo, c] of byRepo) {
    if (excludeRepo != null && repo === excludeRepo) continue;
    counts.r += c.r;
    counts.w += c.w;
    counts.x += c.x;
  }
  const n = counts.r + counts.w + counts.x;
  if (n === 0) return null;
  return { n, share: counts.x / n };
}

// Gated lookup used by scoreRow: null unless the method's table clears
// n >= 5, x share >= 0.9 (after excluding the row's own repo for CAMARA).
export function gatedFamilyShareForRow(row, table, minN = 5, minShare = 0.9) {
  if (!table) return null;
  const excludeRepo = row.set === 'camara' ? row.repo : null;
  const s = shareExcludingRepo(table, excludeRepo);
  if (!s || s.n < minN || s.share < minShare) return null;
  return s.share;
}

// --- Layer 3: corpus lean, routed through the prior ------------------------
//
// leanIndex: Map<token, {providers, perprov_get, perprov_post, perprov_put,
// perprov_patch, perprov_delete, perprov_head, perprov_options}> for
// position === 'lead' rows, keyed by token.

// M1-C5 fix 5: the PUT+PATCH-share w-lean below is a named switch
// (`corpusWLean`, default true) so run.mjs can sweep with it on and off.
export function layer3CorpusEvidence(leadVerbToken, method, leanIndex, corpusWLean = true) {
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
  if (corpusWLean && sharePutPatch >= 0.5) {
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

// --- Generic key -> repo -> {r,w,x} table (used by layers 5 and 6) ---------
//
// keysFn(row) returns the (deduplicated) list of keys this row contributes
// to, e.g. its requestBody property names, or [] to contribute nothing.
// Only rows with a resolved gt_class count.

export function buildRepoCountTable(rows, keysFn) {
  const table = new Map();
  for (const row of rows) {
    const gt = row.gt_class;
    if (gt !== 'r' && gt !== 'w' && gt !== 'x') continue;
    for (const key of keysFn(row)) {
      if (!table.has(key)) table.set(key, new Map());
      const byRepo = table.get(key);
      if (!byRepo.has(row.repo)) byRepo.set(row.repo, { r: 0, w: 0, x: 0 });
      byRepo.get(row.repo)[gt] += 1;
    }
  }
  return table;
}

// Sum counts for `key` across all repos except excludeRepo (null/undefined =
// no exclusion, the holdout2 case).
export function countsForKey(table, key, excludeRepo) {
  const byRepo = table.get(key);
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

// {n, share} of truth-x within counts, or null when n === 0.
export function shareX(counts) {
  if (!counts) return null;
  const n = counts.r + counts.w + counts.x;
  if (n === 0) return null;
  return { n, share: counts.x / n };
}

// A CAMARA or hold-out-1 row must never have its own repo's rows back it as
// evidence; a hold-out-2 row (or anything else) uses the table whole.
export function rowExcludeRepo(row) {
  return row.set === 'camara' || row.set === 'holdout1' ? row.repo : null;
}

// --- Layer 5: body-shape raisers (requestBody property names + presence
// flags), admitted mechanically from CAMARA + hold-out-1 rows -------------

export function bodyPropKeysForRow(row) {
  if (row.requestBody_present !== 'true') return [];
  const raw = row.requestBody_props || '';
  if (raw === '') return [];
  return Array.from(new Set(raw.split('|').map((s) => s.trim()).filter((s) => s !== '')));
}

export function buildBodyPropTable(rows) {
  return buildRepoCountTable(rows, bodyPropKeysForRow);
}

export function layer5BodyEvidence(row, table, admittedNames, minN = 5, minShare = 0.9) {
  if (!admittedNames || admittedNames.size === 0) return [];
  const excludeRepo = rowExcludeRepo(row);
  const evidence = [];
  for (const key of bodyPropKeysForRow(row)) {
    if (!admittedNames.has(key)) continue;
    const s = shareX(countsForKey(table, key, excludeRepo));
    if (!s || s.n < minN || s.share < minShare) continue;
    evidence.push({
      dir: 'raise',
      target: 'x',
      weight: s.share,
      evidence: `bodyprop:${key}->raise:n=${s.n}:share=${s.share.toFixed(3)}`,
    });
  }
  return evidence;
}

// Present-only census flags admitted the same mechanical way (callbacks
// present, has202, an Idempotency-Key header parameter).
export function flagPresent(row, flagName) {
  return row[flagName] === 'true';
}

export function buildFlagTable(rows, flagName) {
  return buildRepoCountTable(rows, (row) => (flagPresent(row, flagName) ? [flagName] : []));
}

// M1-C7 (D32, user ruling 2026-09-07): a read-led operation is not raised by
// callbacks_present (CAMARA's poll-then-callback reads). "Read" is decided
// mechanically, no hand list — either of:
//   (a) the row's own security_scopes carry a token in the existing
//       READ_FAMILY (read, retrieve, check, verify, match, query, count,
//       assess); or
//   (b) the row's lead verb (post C5 method-word stripping) has, at lead
//       position in docs/logs/m1/corpus-leans.csv, a per-provider GET share
//       >= 0.75 with providers >= 3.
// leanIndex may be omitted (defaults to no corpus check, i.e. only (a)
// applies) so existing call sites that never passed one are unaffected.
export function isReadVerbForRow(row, leanIndex = null) {
  const scopesStr = row.security_scopes || '';
  if (scopesStr !== '') {
    const tokens = scopesStr
      .split('|')
      .filter((s) => s !== '')
      .map((scope) => {
        const idx = scope.lastIndexOf(':');
        return (idx >= 0 ? scope.slice(idx + 1) : scope).toLowerCase();
      });
    if (tokens.some((t) => READ_FAMILY.has(t))) return true;
  }
  if (leanIndex) {
    const leadVerbToken = leadVerbForRow(row);
    const lean = leadVerbToken ? leanIndex.get(leadVerbToken) : null;
    if (lean && lean.providers >= 3) {
      const total =
        lean.perprov_get +
        lean.perprov_post +
        lean.perprov_put +
        lean.perprov_patch +
        lean.perprov_delete +
        lean.perprov_head +
        lean.perprov_options;
      if (total > 0 && lean.perprov_get / total >= 0.75) return true;
    }
  }
  return false;
}

export function layer5FlagEvidence(row, flagName, table, admitted, minN = 5, minShare = 0.9, leanIndex = null) {
  if (!admitted || !flagPresent(row, flagName)) return [];
  const excludeRepo = rowExcludeRepo(row);
  const s = shareX(countsForKey(table, flagName, excludeRepo));
  if (!s || s.n < minN || s.share < minShare) return [];
  // M1-C7: only checked once we know a raise would otherwise fire, so the
  // suppression marker is never recorded for a row that would not have
  // raised anyway.
  if (flagName === 'callbacks_present' && isReadVerbForRow(row, leanIndex)) {
    return [{ dir: 'none', target: null, weight: 0, evidence: 'flag:callbacks_present-suppressed:read-verb' }];
  }
  return [
    {
      dir: 'raise',
      target: 'x',
      weight: s.share,
      evidence: `flag:${flagName}->raise:n=${s.n}:share=${s.share.toFixed(3)}`,
    },
  ];
}

// --- Layer 6: own-vs-other structural facts for PUT/DELETE/PATCH ----------

export function pathParamKeysForRow(row) {
  const path = row.path || '';
  const matches = path.match(/\{([^}]+)\}/g) || [];
  return Array.from(new Set(matches.map((m) => m.slice(1, -1))));
}

export function schemaPropKeysForRow(row) {
  const raw = row.resource_schema_props || '';
  if (raw === '') return [];
  return Array.from(new Set(raw.split('|').map((s) => s.trim()).filter((s) => s !== '')));
}

function isPutDeletePatch(row) {
  return row.method === 'PUT' || row.method === 'DELETE' || row.method === 'PATCH';
}

// Build a layer-6 table restricted to PUT/DELETE/PATCH rows only.
export function buildLayer6Table(rows, keysFn) {
  return buildRepoCountTable(rows.filter(isPutDeletePatch), keysFn);
}

// categories: array of {name, keysFn, table, admittedSet}. Only rows whose
// method is PUT/DELETE/PATCH ever produce evidence here.
export function layer6Evidence(row, categories, minN = 5, minShare = 0.9) {
  if (!isPutDeletePatch(row) || !categories) return [];
  const excludeRepo = rowExcludeRepo(row);
  const evidence = [];
  for (const cat of categories) {
    if (!cat.admittedSet || cat.admittedSet.size === 0) continue;
    for (const key of cat.keysFn(row)) {
      if (!cat.admittedSet.has(key)) continue;
      const s = shareX(countsForKey(cat.table, key, excludeRepo));
      if (!s || s.n < minN || s.share < minShare) continue;
      evidence.push({
        dir: 'raise',
        target: 'x',
        weight: s.share,
        evidence: `${cat.name}:${key}->raise:n=${s.n}:share=${s.share.toFixed(3)}`,
      });
    }
  }
  return evidence;
}

// --- Layer 7: prose words (summary + description), admitted mechanically
// from CAMARA + hold-out-1 rows, raise-only (D30: prose last) --------------

const WORD_TOKEN_RE = /[a-z]+/g;

// Lowercase, split on non-letters, drop tokens under 3 chars. Returns a
// Set<string> (deduplicated within the row — presence, not count).
export function tokenizeProse(summary, description) {
  const text = `${summary || ''} ${description || ''}`.toLowerCase();
  const matches = text.match(WORD_TOKEN_RE) || [];
  const tokens = new Set();
  for (const t of matches) {
    if (t.length >= 3) tokens.add(t);
  }
  return tokens;
}

// Tokens present in more than `maxRowFraction` of `rowsWithTokens` (row
// PRESENCE, not raw occurrence count — each row's token Set already counts
// a repeated word once) — this replaces a hand-written stopword list.
// Returns Map<token, rowCount>, dropped tokens only.
export function highFrequencyWordTable(rowsWithTokens, maxRowFraction = 0.4) {
  const counts = new Map();
  for (const tokens of rowsWithTokens) {
    for (const t of tokens) counts.set(t, (counts.get(t) || 0) + 1);
  }
  const total = rowsWithTokens.length;
  const dropped = new Map();
  for (const [t, c] of counts) {
    if (total > 0 && c / total > maxRowFraction) dropped.set(t, c);
  }
  return dropped;
}

// {n, share} of truth-w within counts, or null when n === 0 — computed for
// the layer-7 report (own-vs-other visibility) but never wired into scoring.
export function shareW(counts) {
  if (!counts) return null;
  const n = counts.r + counts.w + counts.x;
  if (n === 0) return null;
  return { n, share: counts.w / n };
}

// row.words is a Set<string> of surviving tokens, attached by run-c8.mjs
// (raw summary/description text is not a census column, so it cannot be
// derived from the row alone the way bodyPropKeysForRow etc. can).
export function wordKeysForRow(row) {
  return row.words ? Array.from(row.words) : [];
}

export function buildWordTable(rows) {
  return buildRepoCountTable(rows, wordKeysForRow);
}

export function layer7WordEvidence(row, table, admittedWords, minN = 5, minShare = 0.9) {
  if (!admittedWords || admittedWords.size === 0) return [];
  const excludeRepo = rowExcludeRepo(row);
  const evidence = [];
  for (const word of wordKeysForRow(row)) {
    if (!admittedWords.has(word)) continue;
    const s = shareX(countsForKey(table, word, excludeRepo));
    if (!s || s.n < minN || s.share < minShare) continue;
    evidence.push({
      dir: 'raise',
      target: 'x',
      weight: s.share,
      evidence: `word:${word}->raise:n=${s.n}:share=${s.share.toFixed(3)}`,
    });
  }
  return evidence;
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
// ctx: {
//   leanIndex: Map<token, leanRow>,
//   verbTable: Map<token, Map<repo, counts>>,
//   scopeFamilyTables: Map<'write:POST'|'write:PATCH'|'xhint:POST'|'xhint:PATCH', Map<repo, counts>> (M1-C6 layer 2b, revised),
//   bodyPropTable: Map<propName, Map<repo, counts>>, admittedBodyProps: Set (layer 5),
//   flagTables: Map<flagName, Map<repo, counts>>, admittedFlags: Set<flagName> (layer 5),
//   layer6Categories: array of {name, keysFn, table, admittedSet} (layer 6),
//   wordTable: Map<word, Map<repo, counts>>, admittedWords: Set<word> (layer 7, M1-C8),
// }
// row: must carry method, operationId, path, security_scopes, set, repo; for
// layer 7 also `words` (Set<string>, attached by run-c8.mjs).
// switches: { corpusWLean: boolean (M1-C5 fix 5, default true), wordsOn: boolean (M1-C8, default false),
//   layer3On: boolean (M1-C9, default true), layer4On: boolean (M1-C9, default true) }.

export function scoreRow(row, ctx, threshold, switches = {}) {
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
  const corpusWLean = switches.corpusWLean !== false;
  const layer3On = switches.layer3On !== false;
  const layer4On = switches.layer4On !== false;
  const leadVerbToken = leadVerbForRow(row);
  const evidence = [];

  // Layer 2 + M1-C6 layer 2b (revised): write-family and x-hint-family
  // shares are each measured per method (POST, PATCH separately), CAMARA-
  // only, leave-one-repo-out, gated at n >= 5 / share >= 0.9.
  let writeFamilyXShare = null;
  let xHintXShare = null;
  if ((method === 'POST' || method === 'PATCH') && ctx.scopeFamilyTables) {
    writeFamilyXShare = gatedFamilyShareForRow(row, ctx.scopeFamilyTables.get(`write:${method}`));
    xHintXShare = gatedFamilyShareForRow(row, ctx.scopeFamilyTables.get(`xhint:${method}`));
  }
  evidence.push(...layer2ScopeEvidence(row, prior, writeFamilyXShare, xHintXShare));

  // M1-C9: layer3On/layer4On (both default true) let a caller remove these
  // two layers from the evidence sum entirely — not merely gate their
  // output, skip the lookup itself (verbCountsFor is not even called).
  if (layer3On) {
    evidence.push(...layer3CorpusEvidence(leadVerbToken, method, ctx.leanIndex || new Map(), corpusWLean));
  }
  if (layer4On) {
    const excludeRepo = row.set === 'camara' ? row.repo : null;
    const counts = ctx.verbTable ? verbCountsFor(ctx.verbTable, leadVerbToken, excludeRepo) : null;
    evidence.push(...layer4VerbEvidence(counts, leadVerbToken));
  }

  // Layer 5: body-prop raisers + present-only flag raisers.
  if (ctx.bodyPropTable && ctx.admittedBodyProps) {
    evidence.push(...layer5BodyEvidence(row, ctx.bodyPropTable, ctx.admittedBodyProps));
  }
  if (ctx.flagTables && ctx.admittedFlags) {
    for (const flagName of ctx.admittedFlags) {
      const table = ctx.flagTables.get(flagName);
      if (table) evidence.push(...layer5FlagEvidence(row, flagName, table, true, 5, 0.9, ctx.leanIndex));
    }
  }

  // Layer 6: own-vs-other structural facts for PUT/DELETE/PATCH.
  if (ctx.layer6Categories) {
    evidence.push(...layer6Evidence(row, ctx.layer6Categories));
  }

  // Layer 7 (M1-C8, D30 prose last): summary/description word raisers,
  // gated behind switches.wordsOn (default OFF).
  if (switches.wordsOn === true && ctx.wordTable && ctx.admittedWords) {
    evidence.push(...layer7WordEvidence(row, ctx.wordTable, ctx.admittedWords));
  }

  const result = aggregate(evidence, prior, threshold);
  return { ...result, prior };
}
