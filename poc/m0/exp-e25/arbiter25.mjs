// E25: variant wrapper around the E19 union (poc/m0/rules-union.mjs), built
// only from options — no existing file is modified. Each option isolates one
// E25 hypothesis so a pass can be scored on its own.
//
//   summaryOnly   H1: the word-list judge scans the summary only (falling
//                     back to the description when the summary is empty),
//                     instead of summary+description+operationId+path.
//   firstSentence H4: the word-list judge scans summary + the first sentence
//                     of the description.
//   partyHeadOnly H2: the verb-led V3 rule raises only when the party word is
//                     the head of the verb's own object; a from/for/of/to
//                     phrase whose object is a party word no longer raises.
//   ownObjects    H3: a set of object heads measured never to be another
//                     party's; when the object head is one of them, V3 does
//                     not raise (guard only, never lowers below the floor).
//   readVerbs     H5: extra lead verbs treated as reads for the POST/PATCH
//                     lowering, on top of the shipped hand list.
//
// Everything else — the tighter-wins union, the PUT/DELETE w floor, the
// agreement confidence, pass 2 as grading only (D23) — is the E19 behaviour,
// reproduced here rather than imported so a variant can vary one step.

import { RANK, methodDefault, tighter } from '../rules.mjs';
import { arbiterLex, HAND_READ_VERBS } from '../rules-lex.mjs';
import { arbiterVerb, objectHead, partyPhrase } from '../rules-verb.mjs';
import { leadVerb, assertFloor } from '../rules-vn.mjs';
import { refine } from '../rules-pass2.mjs';

const SAFE = new Set(['GET', 'HEAD', 'OPTIONS', 'TRACE']);

function firstSentence(text) {
  if (!text) return '';
  const m = String(text).match(/^[\s\S]*?[.!?](?=\s|$)/);
  return m ? m[0] : String(text);
}

// The op handed to arbiterLex, with the fields it scans narrowed per option.
// arbiterLex's scope='op' text is summary+description+operationId+path, so
// blanking a field removes it from L2/L3's scan and nothing else (leadVerb
// still reads summary, falling back to description, which is why the
// description is kept whenever the summary is empty).
function narrowOp(op, opts) {
  if (!opts.summaryOnly && !opts.firstSentence) return op;
  const hasSummary = typeof op.summary === 'string' && /[A-Za-z]/.test(op.summary);
  let description = op.description;
  if (hasSummary) description = opts.firstSentence ? firstSentence(op.description) : '';
  return { ...op, description, operationId: '', path: '' };
}

// V3 re-decided: the same object-head / party-phrase test as arbiterVerb's,
// with the option switches applied. Returns the matched party word or null.
function partyMatch(op, tables, opts) {
  const text = (typeof op.summary === 'string' && /[A-Za-z]/.test(op.summary)) ? op.summary : (op.description ?? '');
  const head = objectHead(text);
  if (head && tables.parties.has(head)) {
    if (opts.ownObjects && opts.ownObjects.has(head)) return null;
    return head;
  }
  if (opts.partyHeadOnly) return null;
  if (opts.ownObjects && head && opts.ownObjects.has(head)) return null;
  return partyPhrase(text, tables.parties);
}

// arbiterVerb with the V3 change applied. When the option suppresses a raise
// that arbiterVerb made at V3, the remaining rules (V4 read / V5 write / V6
// floor) are evaluated in the same order arbiterVerb uses.
function verbVariant(op, tables, opts) {
  const base = arbiterVerb(op, tables);
  // H3: the own-resource guard. A V2 (consequential lead verb) raise whose
  // object head is on the build-derived own-resource list falls back to the
  // remaining rules. V3 is guarded inside partyMatch().
  if (opts.ownObjects && base.rule_id === 'V2-verb-consequential') {
    const t = (typeof op.summary === 'string' && /[A-Za-z]/.test(op.summary)) ? op.summary : (op.description ?? '');
    const h = objectHead(t);
    if (h && opts.ownObjects.has(h)) {
      const method = String(op.method ?? '').toUpperCase();
      const v = leadVerb(op);
      return assertFloor({ class: methodDefault(method), confidence: 'low', rule_id: 'V5-verb-write', evidence: `verb=${v} own=${h}` }, method);
    }
  }
  // H5: extra read verbs, POST/PATCH only, and only where the verb-led judge
  // resolved nothing at all (V6-floor). Never on a safe method, never on
  // DELETE/PUT, never over a V1/V2/V3 raise.
  if (opts.readVerbs && base.rule_id === 'V6-floor') {
    const method = String(op.method ?? '').toUpperCase();
    const v = leadVerb(op);
    if ((method === 'POST' || method === 'PATCH') && v && opts.readVerbs.has(v) && !op.has409) {
      return { class: 'r', confidence: 'low', rule_id: 'V4-verb-read-extra', evidence: `verb=${v}` };
    }
  }
  if (base.rule_id !== 'V3-party-object') return base;
  if (partyMatch(op, tables, opts)) return base;
  const method = String(op.method ?? '').toUpperCase();
  const floor = methodDefault(method);
  const v = leadVerb(op);
  const finish = (r) => assertFloor(r, method);
  if (v && tables.read.has(v)) {
    if (method === 'POST' || method === 'PATCH') return finish({ class: 'r', confidence: 'high', rule_id: 'V4-verb-read', evidence: `verb=${v}` });
    return finish({ class: floor, confidence: 'low', rule_id: 'V4-verb-read', evidence: `verb=${v}` });
  }
  if (v && tables.write.has(v)) return finish({ class: floor, confidence: 'high', rule_id: 'V5-verb-write', evidence: `verb=${v}` });
  return finish({ class: floor, confidence: 'method-only', rule_id: 'V6-floor', evidence: `verb=${v ?? 'none'} head=${objectHead(op.summary || op.description || '') ?? 'none'}` });
}

// arbiterLex with the narrowed scan text and, for H5, an extra read-verb
// list applied at L4 (POST/PATCH only, never on a safe method or DELETE/PUT).
function lexVariant(op, model, lexicon, opts) {
  const scanOp = narrowOp(op, opts);
  let base = arbiterLex(scanOp, model, lexicon, 'op', { readVerbs: 'hand' });
  if (opts.nounSummaryOnly) {
    // H1', split scan: danger verbs (L2) keep the full summary+description+
    // operationId+path text, live nouns (L3) see the summary only. L2 fires
    // before L3 in arbiterLex, so running it twice and preferring the full
    // scan's L2 hit reproduces exactly that ordering.
    const full = arbiterLex(op, model, lexicon, 'op', { readVerbs: 'hand' });
    base = full.rule_id === 'L2-danger-verb'
      ? full
      : arbiterLex(narrowOp(op, { summaryOnly: true }), model, lexicon, 'op', { readVerbs: 'hand' });
  }
  if (!opts.readVerbs) return base;
  const method = String(op.method ?? '').toUpperCase();
  if (method !== 'POST' && method !== 'PATCH') return base;
  if (base.rule_id !== 'L5-floor') return base;
  const v = leadVerb(op);
  if (v && opts.readVerbs.has(v) && !HAND_READ_VERBS.has(v) && !op.has409) {
    return { class: 'r', confidence: 'low', rule_id: 'L4-lookup-extra', evidence: `verb=${v}` };
  }
  return base;
}

// True when the word that drove the raise is present in the operation's own
// summary. L1/V1 (structural markers) are always local — they are the
// operation's own document node. V3's party word is drawn from the summary by
// construction. L2/L3 name their matched stems in `verbs=`/`nouns=` evidence.
function evidenceInSummary(op, resultA, resultB, lexicon) {
  const summary = (typeof op.summary === 'string' && /[A-Za-z]/.test(op.summary)) ? op.summary : (op.description ?? '');
  if (resultA.rule_id === 'L1-structural' || resultB.rule_id === 'V1-structural') return true;
  if (resultB.rule_id === 'V2-verb-consequential' || resultB.rule_id === 'V3-party-object') return true;
  const m = /(?:verbs|nouns)=([a-z, ]+)/.exec(resultA.evidence ?? '');
  if (!m) return true;
  const stems = m[1].trim().split(',').map((s) => s.trim()).filter(Boolean);
  const compiled = [...lexicon.verbRe, ...lexicon.nounRe];
  for (const stem of stems) {
    const c = compiled.find((e) => e.stem === stem);
    if (c && c.re.test(summary)) return true;
  }
  return false;
}

/**
 * The E25 variant union. Same contract as arbiterUnion.
 * @param {object} op
 * @param {{model:object, lexicon:object, tables:object}} ctx
 * @param {{pass2?:boolean, summaryOnly?:boolean, firstSentence?:boolean, partyHeadOnly?:boolean, ownObjects?:Set<string>, readVerbs?:Set<string>}} [opts]
 */
export function arbiter25(op, ctx, opts = {}) {
  const { model, lexicon, tables } = ctx;
  const method = String(op.method ?? '').toUpperCase();
  const floor = methodDefault(method);

  if (SAFE.has(method)) {
    return { class: 'r', confidence: 'high', rule_id: 'U:L0-safe-locked|V0-safe-locked', evidence: `method=${method}`, agree: true, raisedBy: 'neither' };
  }

  const resultA = lexVariant(op, model, lexicon, opts);
  const resultB = verbVariant(op, tables, opts);

  let cls = tighter(resultA.class, resultB.class);
  if ((method === 'PUT' || method === 'DELETE') && RANK[cls] < RANK.w) cls = 'w';

  // H7: the missing rung. POST/PATCH's x is a policy default, not an RFC 9110
  // fact (D17), so evidence may lower it — but the only route down the
  // arbiter has ever had is to r, via a read verb. A POST whose summary is
  // plainly an update ("Update the queue with the new parameters") has no way
  // to be called w. This adds it, at its most conservative: only when the
  // word-list judge found NO lexicon evidence (L5-floor) and the verb-led
  // judge found a write lead verb (V5-verb-write). Any danger stem, live
  // noun, party object, consequential verb or structural marker still wins.
  let writeLowered = false;
  if (opts.writeFloorW && (method === 'POST' || method === 'PATCH')
      && resultA.rule_id === 'L5-floor' && resultB.rule_id === 'V5-verb-write' && cls === 'x'
      && (!opts.modifyVerbs || opts.modifyVerbs.has(leadVerb(op)))) {
    cls = 'w';
    writeLowered = true;
  }

  const agree = resultA.class === resultB.class;
  const bothFloor = resultA.rule_id === 'L5-floor' && resultB.rule_id === 'V6-floor';
  let confidence = bothFloor ? 'method-only' : (agree ? 'high' : 'low');
  if (writeLowered) confidence = 'low';

  const raisedA = RANK[resultA.class] > RANK[floor];
  const raisedB = RANK[resultB.class] > RANK[floor];
  const raisedBy = raisedA && raisedB ? 'both' : raisedA ? 'wordlist' : raisedB ? 'verb' : 'neither';

  let combined = {
    class: cls, confidence,
    rule_id: `U:${resultA.rule_id}|${resultB.rule_id}${writeLowered ? '>E25-write-floor-w' : ''}`,
    evidence: `A=${resultA.evidence} B=${resultB.evidence}`,
    agree, raisedBy,
  };

  // H7 locality grading: confidence-only, never a class change. The word
  // that raised the class must appear in the operation's own summary for the
  // row to be graded high; evidence found only in the description,
  // operationId or path is graded low, so a consumer can filter it.
  if (opts.localityGrade && RANK[cls] > RANK[floor] && combined.confidence === 'high') {
    if (!evidenceInSummary(op, resultA, resultB, lexicon)) {
      combined = { ...combined, confidence: 'low', rule_id: `${combined.rule_id}>E25-not-in-summary` };
    }
  }

  if (opts.pass2) {
    const refined = refine(op, resultA, lexicon);
    if (RANK[refined.class] < RANK[resultA.class]) {
      combined = { ...combined, confidence: 'low', rule_id: `${combined.rule_id}>P2-weak`, evidence: `${combined.evidence} P2=${refined.evidence}` };
    }
  }
  return combined;
}
