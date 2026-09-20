# E25 — why a human can sort the false alarms by summary and the tool cannot

Bounded research loop, 10 passes max. No existing file under `poc/m0/` or
`docs/` is modified; everything lives in `poc/m0/exp-e25/`. Nothing committed.

Baseline reproduced before varying anything (`run-union.mjs --pass2=on`):
CAMARA build 98 / 42 / 0 (agree / over-tight / leak), CAMARA test 120 / 32 / 0,
hold-out 1 106 / 101 / 0. `run25.mjs --variant=base` (the E25 wrapper with no
option set) reproduces all three exactly, so the wrapper is proven equivalent
before any hypothesis is tested.

## Pass 0 — where the false alarms come from (diagnostic, no variant)

`dump.mjs` groups every false alarm by the union's rule pair.
CAMARA build (42): V3-party-object involved in 21, L2-danger-verb in 15,
L3-live-noun in 7. Hold-out 1 (101): L3-live-noun involved in 55,
V3-party-object in 38, L2-danger-verb in 22, and 12 are Twilio POST `Update*`
sitting at the untouched POST floor.

Two things stand out by eye. The L3 hits are nearly all one word — `access`,
55 GitHub rows, from the boilerplate sentence about personal access tokens in
the *description*, never the summary. The V3 hits are nearly all a party word
used as *scope*: `for an organization`, `from your account`, `for the
authenticated user`, `for-repo`. That is the shape of both remaining
hypotheses.

## Pass 1 — H1 summary-only

Hypothesis: the word-list judge reads summary + description + operationId +
path; the danger stems and live nouns that produce most false alarms are in
the description boilerplate, not in the summary. Restricting the word-list
scan to the summary (description only when the summary is empty) should drop
over-tightenings sharply.
Prediction: hold-out 1 over-tight falls by roughly 40-55 (the `access` rows);
CAMARA over-tight falls by 10-20; risk is new leaks where the danger is only
in the description.

Result: CAMARA build 102 / 38 / 0, CAMARA test 122 / 28 / **2**, hold-out 1
131 / 74 / **2**. Noise falls hard (CAMARA 74 -> 66, hold-out 101 -> 74,
correct lowerings 23 -> 26) but four wrong loosenings appear, three of them at
high confidence: deleteDevice (w, truth x), queryAssistant (r, truth x),
issues/set-issue-field-values (w, truth x), issues/remove-sub-issue (w, truth
x). FAIL under rule 2.
Taught: the description is not only boilerplate — for these four rows it is the
*only* place the consequence is stated. Throwing the whole description away
buys 35 fewer false alarms at the price of the gate. The distinction the tool
needs is not summary-vs-description; it is which sentence of the description
is about this operation's own effect.

## Pass 2 — H4 first sentence

Hypothesis: the stems that fire wrongly sit in trailing boilerplate ("OAuth app
tokens and personal access tokens ...", "notifications will no longer be
sent"), while a description that really states a consequence states it in its
first sentence. Scan summary + first sentence of the description.
Prediction: recovers pass 1's four leaks (or most of them) while keeping most
of pass 1's noise reduction — expect hold-out over-tight in the 75-90 band with
0 leaks.

Result: CAMARA build 101 / 39 / 0, CAMARA test 123 / 28 / **1**, hold-out 1
128 / 77 / **2**. Three leaks (queryAssistant high, set-issue-field-values
high, remove-sub-issue method-only). FAIL under rule 2.
Taught — and this is the pass's real finding, checked against the baseline CSV:
two of the three rows are held by the *baseline* for reasons that are not
evidence at all. `issues/set-issue-field-values` (truth x) is held by
`nouns=access`, the same GitHub boilerplate word that produces 55 false alarms
on hold-out 1; `issues/remove-sub-issue` (truth x) is held by `verbs=start`,
a substring collision that pass 2 already flags as `collision=start`. E23's
zero on hold-out 1 rests, on those two rows, on accidents. Only queryAssistant
is held for a real reason stated late in its description.

## Pass 3 — H2 party word as scope, not as target

Hypothesis: V3 raises when a from/for/of/to phrase names a party word, but in
"delete an org secret **for an organization**", "delete an email **for the
authenticated user**", "remove a repo **from an org secret**" the party word
names the caller's own container (scope), not the thing acted on. Require the
party word to be the head of the verb's own object.
Prediction: hold-out over-tight falls ~25-30 (the V3 rows whose head is not the
party), CAMARA ~8-12; risk is losing true-x raises where the party really is
the target of a from-phrase ("remove a user from a team").

Result: CAMARA build 106 / 34 / 0, CAMARA test 123 / 29 / 0, hold-out 1
110 / 97 / 0. Correct lowerings 10 -> 17 on build. Both controls PASS.
Strictly better than the baseline on every set with zero leaks. **KEEP.**
Taught: a party word in a from/for/of/to phrase is scope, not target, in every
row it decided here — the phrase names the container the caller owns. The rule
had been reading "delete an org secret for an organization" as "acts on an
organization".

## Pass 4 — H1' the live-noun scan reads the summary only

Hypothesis (a narrowed H1, after pass 1 showed the whole description cannot be
dropped): the danger-verb list (L2) needs the description — it is where
queryAssistant's "may invoke tools" lives — but the live-noun list (L3) does
not. 45 of the 160 remaining false alarms are L3 hits on a single word from
description boilerplate (`access` in GitHub's personal-access-token sentence,
`call`/`message` in Twilio's). Keep L2 on the full text, restrict L3 to the
summary. Run on top of pass 3.
Prediction: hold-out over-tight falls 30-40, CAMARA 5-10; the only leak risk is
set-issue-field-values, which the baseline holds by `nouns=access` — the same
boilerplate.

Result: CAMARA build 107 / 33 / 0, CAMARA test 123 / 28 / **1**, hold-out 1
139 / 67 / **1**, both leaks at high confidence. FAIL under rule 2.
Taught: restricting the live-noun scan to the summary removes 30 of hold-out
1's false alarms and 5 of CAMARA's, and costs exactly the two rows pass 2
already identified as held by accident — `deleteDevice` (summary "Delete device
record", truth x, held only by `access,network` appearing in its description)
and `set-issue-field-values` (summary "Set issue field values for an issue",
truth x, held only by GitHub's boilerplate `access`). Both are rows where the
right answer needs a word the party list does not have (`issue`) or a head the
extractor does not reach (`device`, behind the wrapper word `record`). The
noise and the cover come from the same place, so no scan-narrowing alone can
have one without the other.

## Pass 5 — H6/H7 evidence locality as confidence, never as class

Hypothesis: the change that cannot leak. Keep every class exactly as pass 3
leaves it, and grade confidence by where the deciding evidence sits: high only
when the word that raised the class appears in the operation's own summary,
low when it was found only in the description, operationId or path. This is
D23's discipline applied to pass 1's evidence rather than pass 2's.
Prediction: since the user sorted the dossier by summary alone, most remaining
false alarms should be graded low, and the true-x rows should mostly keep high
— measured as high-confidence false alarms before and after.

Result: identical to pass 3 on all three sets — nothing moved. The reason is
the finding: every high-confidence raise is already justified by a word in the
summary. The judges disagree (hence low confidence) exactly when only one of
them found something, and the word-list judge's description-only hits are
already low. Locality grading is therefore a no-op on top of pass 3.
Taught: the high-confidence false alarms are NOT caused by reading the
description. They come from the summary itself, read correctly, and judged
wrongly. Reported as a finding; the variant is dropped as a no-op.

Reading the 62 high-confidence false alarms across the three sets by hand at
this point makes the largest single cause obvious: 12 of hold-out 1's 35 and
several of CAMARA's are `POST`/`PATCH` operations whose summary is plainly an
update — "Modify the properties of a given Account", "Update the queue with the
new parameters", "Rename an IpAccessControlList", "Update an Application
Deployment" — sitting at x because **the floor for POST and PATCH is x and the
only route down is to r**. PRD §4.5 says the text may move POST "up or down"
and the weakness list already records "there is no path from POST to w"; the
arbiter has never had one.

## Pass 6 — H7 a write lead verb lowers POST/PATCH from x to w

Hypothesis: what the human sees in "Update a queue" is not danger and not a
read — it is a write, and w is a class the tool is structurally unable to
reach for POST. Give it one: when the word-list judge found no lexicon
evidence at all (L5-floor) and the verb-led judge found a write lead verb
(V5-verb-write), a POST or PATCH comes out w, not x. Conservative on purpose —
any lexicon hit, party object or consequential verb still wins.
Prediction: hold-out over-tight falls 12-20 and CAMARA 5-10, all at high
confidence; the leak risk is a POST whose write verb hides a consequence the
text never states.

Result: CAMARA build 105 / 33 / **2** (both low confidence), CAMARA test
123 / 29 / 0, hold-out 1 122 / 85 / 0. High-confidence over-tightenings fall
from 35 to 23 on hold-out 1 and 16 to 15 on build. The two leaks are
IoTDeviceManagement `POST /delete deleteEsimProfile` and
`POST /set-fallback setFallbackEsimProfile`, truth x — a POST that is really a
delete, and a POST that switches which eSIM profile a device is using. Both
come in through the write list's `delete` and `set`, which are not "update"
verbs at all. FAIL as it stands, but the cause is one list, not the rule.

## Pass 7 — H7b the same rung, restricted to modify verbs

Hypothesis: the write list mixes three kinds of verb — modify (update, modify,
rename, edit, replace), destroy (delete, clear, unlink) and state flips (set,
enable, disable, lock, star). Only the modify kind is safe to lower a POST to
w; the pass 6 leaks came from `delete` and `set`. Restrict the lowering to a
hand modify list written from CAMARA build rows only: update(s), modify/
modifies, rename(s), edit(s), patch(es), amend(s), adjust(s), revise(s).
Prediction: pass 6's two build leaks disappear; most of the noise reduction
survives, because Twilio's rows are `Update*`.

Result: CAMARA build 107 / 33 / 0, CAMARA test 123 / 29 / 0, hold-out 1
122 / 85 / 0. Both controls PASS. High-confidence over-tightenings 15 / 11 / 23
against pass 3's 16 / 11 / 35. **KEEP.** Pass 6's two leaks are gone and the
noise reduction survives intact.
Taught: the rung was missing, not wrong. A POST or PATCH led by a modify verb
with no other evidence is w, and that single rung removes 12 of hold-out 1's
false alarms, all of them at high confidence. Splitting `write` into modify /
destroy / state-flip is what makes it safe: `delete` and `set` are not
"update" verbs and must not lower anything.

## Pass 8 — H5 the POST read floor

Hypothesis: the remaining truth-r false alarms on CAMARA build are POSTs whose
lead verb is a lookup word the read list does not have — verify (3), matching,
discover, plus noun-led summaries. Add the brief's hand read-verb list to both
judges' POST/PATCH lowering.
Prediction: 4-6 more correct lowerings on CAMARA build and a similar number on
test; the known risk is `validate`, which E12 measured as producing the
validateCode leak ("a successful check consumes the code"), so the list is
scored with and without it.

Result (both list variants identical, because `validate` never leads a CAMARA
summary — the row E12 blamed on `validate` actually leads with `verify`):
CAMARA build 110 / 30 / 0 (correct lowerings 17 -> 20), CAMARA test 124 / 26 /
**2**, hold-out 1 unchanged at 122 / 85 / 0. Both leaks at high confidence:
`createBlockchainPublicAddressValidationNonce` ("Generate a nonce", truth x —
generating a nonce creates server state) and `validateCode` ("Verify the OTP",
truth w — a successful check consumes the code). FAIL under rule 2.
Taught: `generate` and `verify` are not read verbs. Removing just those two
from the list would give a clean 110/30/0 and 124/26/0, but that is fitting to
the half the list was scored on, so the whole variant is dropped and the number
is recorded only as what the fit would have been worth. E12's finding stands
and now has a second instance: a POST that produces a value the server
remembers is not a lookup.

## Pass 9 — H3 own-resource object heads

Hypothesis: the remaining high-confidence false alarms are consequential-verb
and party-object raises whose object is the caller's own paperwork —
"Add selected repository to an organization secret", "Delete a QoS session",
"Terminate an Application Instance". Derive, from CAMARA BUILD ONLY, the object
heads that are the head of a truth-w row and never the head of a truth-x row,
and use the list as a guard: a V2 (consequential lead verb) or V3 (party
object) raise does not fire when the object head is on it.
Prediction: high-confidence over-tightenings fall on all three sets; the leak
risk is any build-only word that is an x object elsewhere.

Result: 3 heads only — `assignment`, `deployment`, `domain` (relaxed to one
truth-w sighting; at two sightings the list is 2 words). CAMARA build
107 / 33 / 0, test 123 / 29 / 0, hold-out 1 121 / 85 / **1** at high
confidence: `enterprise-team-organizations/add` ("Add an organization to an
enterprise team", truth x) is un-raised because `assignment` is on the list.
FAIL under rule 2.
Taught: the own-resource idea is right by inspection and cannot be learned from
140 build rows — the very first word it learns leaks. Object-level world
knowledge has to come from the schema (M1's structural signal), not from
counting heads.

## Pass 10 — the best variant, and the confidence question (H6)

No new rule. Best variant = pass 3 (partyHeadOnly) + pass 7 (modifyVerbs).
H6 is answered from its counters rather than by a variant.

### The best variant

`--variant=partyHeadOnly,modifyVerbs` (E19 union + pass 3 + pass 7):

| set | agree | over-tight | leaks | correct lowerings | E23 for comparison |
|---|---|---|---|---|---|
| CAMARA build (140) | 107 | 33 | 0 | 17 | 98 / 42 / 0 (10) |
| CAMARA test (152) | 123 | 29 | 0 | 13 | 120 / 32 / 0 (13) |
| hold-out 1 (207) | 122 | 85 | 0 | 0 | 106 / 101 / 0 (0) |
| clean exam (220), scored once | 189 | 31 | 0 | 4 | 187 / 33 / 0 (4) |

Both negative controls PASS on CAMARA. Zero wrong loosenings at every
confidence level on all four sets. Clean-exam rows that changed versus E23:
`patch_metadata_taxonomies_id_id` "Update metadata taxonomy" x -> w, truth w;
`patch_metadata_taxonomies_id_id_nodes_id` "Update metadata taxonomy node"
x -> w, truth w. No other row moved.

### H6 answered: what disagreement predicts

Best variant, agreement (high) versus disagreement (low / method-only),
counting correct rows against over-tightenings:

| set | high: correct / over | low: correct / over |
|---|---|---|
| CAMARA build | 103 / 15 | 4 / 18 |
| CAMARA test | 117 / 11 | 6 / 18 |
| hold-out 1 | 98 / 23 | 24 / 62 |
| clean exam | 174 / 11 | 15 / 20 |

A low-confidence row is 1.3 to 4.5 times more likely to be an over-tightening
than a correct call; a high-confidence row is 6 to 16 times more likely to be
correct. Disagreement is a strong predictor of a false alarm and does not
predict a leak at all (there are none). The confidence label already carries
most of what the user was doing by eye — it is just not what the dossier was
sorted on.
