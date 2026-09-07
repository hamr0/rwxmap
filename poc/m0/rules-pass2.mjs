// E15: a second pass over pass-1 (E12b) results. Pass 1 (arbiterLex,
// rules-lex.mjs) is unchanged and runs first; this module only ever looks
// at rows pass 1 RAISED above the method floor via a lexicon hit — rule_id
// L2-danger-verb or L3-live-noun — and may un-raise such a row back to the
// method floor. It never lowers a row below that floor, and it never
// touches L0/L1/L4/L5 rows (those carry no lexicon-stem evidence to
// second-guess).
//
// Three checks run in order on a row eligible for pass 2, each carrying
// its own evidence:
//   C. Collision — every hit stem occurs in the text only inside a known
//      non-danger compound (e.g. "pay" inside "apple pay").
//   B. Owner — the op's own first sentence reads as the caller's own
//      artefact/account and nothing in the full text names another party.
//   A. Place — the hit stem never occurs in the first sentence at all
//      (it only shows up in later boilerplate); the class is kept but
//      confidence drops to low so a human can see the hit was late.
// Anything else is returned unchanged.

import { methodDefault } from './rules.mjs';

const PASS2_ELIGIBLE_RULES = new Set(['L2-danger-verb', 'L3-live-noun']);

// A word that can name a live object (resource, profile, reservation, key)
// is not evidence that the target is a stored record; only words that mean
// "a stored copy of information" qualify.
export const ARTEFACT = /\b(record|records|log|logs|entry|entries|draft|drafts|metadata|comment|comments|reaction|reactions|label|labels|autolink)\b/;

export const OWN = /\b(your|from your account|for the authenticated user|the authenticated user|the account making the request|of the api consumer|api consumer'?s)\b/;

export const OTHER = /\b(participant|participants|customer|customer'?s|member|members|collaborator|collaborators|a user|the user|user'?s|users|subscriber|subscriber'?s|callee|third[- ]party|another|others|other users?|team|teams|people|person|device|device'?s|devices|recipient|merchant|connected account|installation'?s)\b/;

// stem -> compounds that are NOT that danger meaning. Checked against the
// full text (summary + description + path + operationId, lowercased).
export const COLLISIONS = {
  pay: ['apple pay', 'payload', 'payloads'],
  execut: ['executive', 'executives'],
  block: ['blockchain'],
  ban: ['band', 'bands'],
  start: ['getting-started', 'getting started', 'started with'],
  releas: ['immutable releases', 'release reaction', 'releases in'],
  trigger: ['usage trigger', 'usagetrigger', 'usage triggers'],
  sent: ['present', 'represent', 'consent', 'consents'],
  stop: ['stop watching'],
  notif: ['mark notifications as read', 'notifications as read'],
};

function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * summary + ' ' + the first sentence of description, lowercased. Sentence
 * split is on /(?<=[.!?])\s+/ (a lookbehind for sentence-ending
 * punctuation, then whitespace) applied to description alone.
 * @param {{summary?: string, description?: string}} op
 * @returns {string}
 */
export function firstSentence(op) {
  const summary = op.summary ?? '';
  const description = op.description ?? '';
  const firstDescSentence = description.split(/(?<=[.!?])\s+/)[0] ?? '';
  return `${summary} ${firstDescSentence}`.toLowerCase();
}

// The full text a pass-1 lexicon hit could have come from: summary +
// description + path + operationId, lowercased.
function fullText(op) {
  return [op.summary, op.description, op.path, op.operationId].filter(Boolean).join(' ').toLowerCase();
}

/**
 * The lexicon stems named in a pass-1 result's evidence string, e.g.
 * "verbs=kick" -> ['kick'], "nouns=call,session verb=kick" -> ['call',
 * 'session'] (the trailing "verb=" is the lead verb, not a lexicon stem,
 * and is deliberately not captured — only the plural "verbs="/"nouns="
 * lexicon-hit fields are).
 * @param {{evidence: string}} result
 * @returns {string[]}
 */
export function evidenceStems(result) {
  const stems = [];
  const re = /(?:verbs|nouns)=([^\s]+)/g;
  let m;
  while ((m = re.exec(result.evidence ?? '')) !== null) {
    for (const s of m[1].split(',')) if (s) stems.push(s);
  }
  return stems;
}

// stem -> its compiled lexicon regex (verbRe/nounRe from loadLexicon()),
// so pass 2 tests the same pattern pass 1 matched with.
function stemRegexMap(lexicon) {
  const map = new Map();
  for (const { stem, re } of [...(lexicon.verbRe ?? []), ...(lexicon.nounRe ?? [])]) {
    map.set(stem, re);
  }
  return map;
}

function regexFor(stem, stemRe) {
  return stemRe.get(stem) ?? new RegExp(`\\b${escapeRegex(stem)}`, 'i');
}

// True when every occurrence of `stem` in `text` sits inside one of its
// listed non-danger compounds: remove each compound, then the stem's own
// regex no longer matches what remains.
function isCollisionOnly(stem, text, stemRe) {
  const compounds = COLLISIONS[stem];
  if (!compounds || compounds.length === 0) return false;
  let stripped = text;
  for (const compound of compounds) {
    stripped = stripped.split(compound.toLowerCase()).join(' ');
  }
  return !regexFor(stem, stemRe).test(stripped);
}

function unraise(op, result, suffix, evidence) {
  return {
    class: methodDefault(op.method),
    confidence: 'low',
    rule_id: `${result.rule_id}>${suffix}`,
    evidence,
  };
}

/**
 * Pass 2: look again at a pass-1 (arbiterLex) result that raised an op
 * above its method floor via a lexicon hit (L2-danger-verb or
 * L3-live-noun), and possibly un-raise it back to the floor. Any other
 * rule_id is returned unchanged.
 * @param {object} op a loadOps()-shaped row (summary, description, path, operationId, method)
 * @param {{class:'r'|'w'|'x', confidence:string, rule_id:string, evidence:string}} result the pass-1 result
 * @param {{verbRe: Array<{stem:string,re:RegExp}>, nounRe: Array<{stem:string,re:RegExp}>}} lexicon from loadLexicon()
 * @returns {{class:'r'|'w'|'x', confidence:string, rule_id:string, evidence:string}}
 */
export function refine(op, result, lexicon) {
  if (!PASS2_ELIGIBLE_RULES.has(result.rule_id)) return result;

  const stems = evidenceStems(result);
  const text = fullText(op);
  const firstSent = firstSentence(op);
  const stemRe = stemRegexMap(lexicon);

  // C. Collision: every hit stem is only ever inside a non-danger compound.
  if (stems.length > 0 && stems.every((s) => isCollisionOnly(s, text, stemRe))) {
    return unraise(op, result, 'P2-collision', `collision=${stems.join(',')}`);
  }

  // B. Owner: the first sentence reads as the caller's own artefact/
  // account, and nothing in the full text names another party.
  const artefactMatch = firstSent.match(ARTEFACT);
  const ownMatch = firstSent.match(OWN);
  if ((artefactMatch || ownMatch) && !OTHER.test(text)) {
    const words = [];
    if (artefactMatch) words.push(artefactMatch[0]);
    if (ownMatch) words.push(ownMatch[0]);
    return unraise(op, result, 'P2-own', `own=${words.join(',')}`);
  }

  // A. Place: the hit stem never shows up in the first sentence — the
  // class is kept, but confidence drops so the late hit is visible.
  const inFirstSentence = stems.some((s) => regexFor(s, stemRe).test(firstSent));
  if (!inFirstSentence) {
    return {
      class: result.class,
      confidence: 'low',
      rule_id: `${result.rule_id}>P2-place`,
      evidence: 'place=later-sentence',
    };
  }

  return result;
}
