// E19: composition, not a new arbiter. Runs E12b's word-list arbiter
// (arbiterLex, rules-lex.mjs) and E18's verb-led arbiter (arbiterVerb,
// rules-verb.mjs) over the same operation and combines their verdicts: the
// tighter class wins, confidence comes from whether the two agree, and both
// rule_ids/evidences survive in the combined result so a human can see
// which arbiter(s) drove the call.
//
// The floor after taking the tighter class is NOT methodDefault(method) —
// PRD §4.5 / D17 (the same rule assertFloor in rules-vn.mjs encodes): safe
// methods are locked at r by both arbiters already; PUT/DELETE never go
// below w; POST/PATCH MAY be lowered to r, because methodDefault's x for
// those two is a policy default, not an RFC 9110 fact. Clamping a POST/PATCH
// union result up to x (methodDefault) would silently destroy every correct
// lowering both arbiters agreed on.
//
// pass2 (opts.pass2 === true) is confidence-only (D23): it asks E15's
// refine() (rules-pass2.mjs) to look again at E12b's own raw result
// (resultA) — refine only recognizes rule_id L2-danger-verb/L3-live-noun
// and only parses the verbs=/nouns= evidence format arbiterLex produces,
// so refine is never called on the combined U:... result, only on A. If
// refine would have un-raised A back to the floor, the combined CLASS is
// left exactly as it was (the union may still be right for a different
// reason — B's evidence, or A's own non-lexicon rules) and only the
// confidence is downgraded to 'low', with refine's own evidence appended
// for a human to read. It never changes the class: run-union.mjs asserts
// this (pass2 class changes must be 0) rather than trusting it silently.

import { RANK, methodDefault, tighter } from './rules.mjs';
import { arbiterLex } from './rules-lex.mjs';
import { arbiterVerb } from './rules-verb.mjs';
import { refine } from './rules-pass2.mjs';

/**
 * E19's union arbiter: combine arbiterLex (word-list, E12b settings:
 * readVerbs='hand') and arbiterVerb (verb-led, E18 defaults) over the same
 * op, taking the tighter class.
 * @param {object} op a loadOps()-shaped row
 * @param {{model: object, lexicon: object, tables: object}} ctx
 *   model - the E8 learned model arbiterLex needs (verbMap)
 *   lexicon - loadLexicon('lexicon-v2.json')
 *   tables - loadTables()
 * @param {{pass2?: boolean}} [opts]
 * @returns {{class:'r'|'w'|'x', confidence:string, rule_id:string, evidence:string, agree:boolean, raisedBy:'both'|'wordlist'|'verb'|'neither'}}
 */
export function arbiterUnion(op, ctx, opts = {}) {
  const { pass2 = false } = opts;
  const { model, lexicon, tables } = ctx;
  const method = String(op.method ?? '').toUpperCase();
  const floor = methodDefault(method);

  const resultA = arbiterLex(op, model, lexicon, 'op', { readVerbs: 'hand' });
  const resultB = arbiterVerb(op, tables);

  // The tighter of the two. The only floor enforced here is w for
  // PUT/DELETE (never below r for anything, but that already holds
  // trivially — RANK.r is the bottom of the scale). POST/PATCH are
  // deliberately NOT clamped to methodDefault('x'): its x is a policy
  // default, not an RFC 9110 fact, so a POST/PATCH both arbiters lowered to
  // r must come out r from the union.
  let cls = tighter(resultA.class, resultB.class);
  if ((method === 'PUT' || method === 'DELETE') && RANK[cls] < RANK.w) cls = 'w';

  const agree = resultA.class === resultB.class;
  const bothSafeLocked = resultA.rule_id === 'L0-safe-locked' && resultB.rule_id === 'V0-safe-locked';
  const bothFloor = resultA.rule_id === 'L5-floor' && resultB.rule_id === 'V6-floor';

  let confidence;
  if (bothSafeLocked) confidence = 'high';
  else if (bothFloor) confidence = 'method-only';
  else confidence = agree ? 'high' : 'low';

  const raisedA = RANK[resultA.class] > RANK[floor];
  const raisedB = RANK[resultB.class] > RANK[floor];
  let raisedBy;
  if (raisedA && raisedB) raisedBy = 'both';
  else if (raisedA) raisedBy = 'wordlist';
  else if (raisedB) raisedBy = 'verb';
  else raisedBy = 'neither';

  const rule_id = `U:${resultA.rule_id}|${resultB.rule_id}`;
  const evidence = `A=${resultA.evidence} B=${resultB.evidence}`;

  let combined = { class: cls, confidence, rule_id, evidence, agree, raisedBy };

  if (pass2) {
    // refine() only recognizes resultA's own rule_id/evidence shape — it
    // is deliberately never handed the combined U:... result (whose
    // rule_id it would never match, and whose evidence it cannot parse).
    const refined = refine(op, resultA, lexicon);
    if (RANK[refined.class] < RANK[resultA.class]) {
      // refine would have un-raised A: keep the combined CLASS exactly as
      // it was, drop confidence to 'low', and record that pass 2 found
      // weak evidence without letting it change the verdict.
      combined = {
        ...combined,
        confidence: 'low',
        rule_id: `${combined.rule_id}>P2-weak`,
        evidence: `${combined.evidence} P2=${refined.evidence}`,
      };
    }
    // refined.class === resultA.class (unchanged), or — should never
    // happen — refined.class > resultA.class: both are a no-op here.
  }

  return combined;
}
