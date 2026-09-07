# Learnings

This is one running document of every experiment run on rwxmap: what
it tested, the numbers it produced, and what it taught. Newest
experiments are appended at the end. Per-experiment divergence
reports under `docs/logs/m0/` are raw evidence, not summaries.

Where findings go: a result that changes a feature or a decision goes
into `docs/product/prd.md`, and this file links to the PRD section it
produced.

Prior art verified live on 2026-09-06 is in
`docs/logs/prior-art-2026-09-06.md`; it is a sourced report, not an
experiment, and stays where the PRD cites it.

## M0 — ground truth and the arbiter shapes (2026-09-06)

### What M0 set out to answer

Whether method plus a verb signal yields a confidence that separates
safe loosenings from unsafe ones on real data — the riskiest assumption
named for M0 in `docs/product/prd.md` §4. Concretely: can a regex-only,
two-signal arbiter (§4.1) run over the 292-operation CAMARA test bed
without proposing a single class looser than a hand-read ground truth?

### How the ground truth was produced

Seven agents read the 292 operations in groups of 18-50, whole
repositories per group, blind to any prior label and instructed not to
use the HTTP method or the operation's name as a heuristic — the point
was to record what the spec text says the operation does, not what its
shape suggests. Each row got one reason naming the specific spec field
it rests on (`description`, `requestBody.schema.Device`,
`responses.201`, `callbacks`, `summary`, `info.description`), no
template, no two rows sharing reason text. The full brief given verbatim
to the reading agents is at `docs/logs/m0/reading-brief.md`.

The orchestrator then applied six class rulings plus one doubt
annotation on top of the agents' state_effect/external_effect/reason
columns, producing the as-read table before it became ground truth. Both
are in the repo:

- `data/camara-2026-09-01/ground-truth-as-read.csv` — the agents' raw
  output.
- `data/camara-2026-09-01/ground-truth.csv` — after the orchestrator's
  rulings.

### The five experiments

| id | shape | agree | over-tight | wrong loosenings |
|---|---|---|---|---|
| E1 | method only | 215 | 69 | 8 |
| E2 | + seed verb table, tighten only | 216 | 69 | 7 |
| E3 | + loosen POST on any verb | 222 | 10 | 60 |
| E4 | seed-v2 (create/register/subscribe/book/reserve are x), loosen POST | 260 | 11 | 21 |
| E5 | seed-v2, loosen POST to r only | 269 | 12 | 11 |

Negative controls: `terminateCall` FAILs in E1 and PASSes in E2 through
E5. `updateSessionStatus` FAILs in all five.

### What the divergence list showed

The 11 wrong loosenings left by E5 (the best shape tried) split into two
families:

1. **Seven rows where method and verb agree, and both are wrong.** These
   are PUT or DELETE operations acting on a live session, a network
   access grant, or a traffic path — `updateSessionStatus` among them.
   Because the method default (`w`) and the verb signal agree on `w`,
   no verb library, however large, can move these rows to `x`. The verb
   signal only ever competes with the method default; it cannot
   override an agreement between the two.
2. **Four rows where a read-shaped POST carries a caveat in its text.**
   The verb reads as a lookup, so the arbiter loosens to `r`, but the
   operation's own description names a side effect the verb misses.

These two families are the direct cause of D16, D17, and D18: family 1
is why the method needs to be read as a floor rather than an answer
(§4.4, §4.5, D17), and both families together are why a verb table alone
cannot reach the gate, which demotes the verb-library plan from primary
signal to one input among several (D18). Family 1 in particular is what
makes `x` a matter of consequence rather than literal non-idempotence
(D16) — every one of those seven rows is idempotent by RFC 9110 and
consequential by what it actually does.

### A fitted diagnostic, reported and discarded

A third-signal rule was built directly from those same 11 E5 failures
and, unsurprisingly, cuts them to 4 on the same 292 operations. This
number is fitted by construction — the rule was written to fix the exact
rows it was tested against — and proves nothing about a document it
wasn't built to fix. The script lives only in the session scratchpad and
is deliberately not committed to this repo. The real test of the
floor-and-ceiling design in §4.5 is a run against documents it was not
designed against.

### E7 — learned text signal, honest split (2026-09-07)

(a) Setup: poc/m0/spec-text.mjs extracts summary, description, and three
structural markers (callbacks, a 409 response, a sink field) per
operation by walking the YAML by indentation; coverage 289 of 292
descriptions (three operations genuinely have none: two in
IoTNetworkOptimization, one in KnowYourCustomer); markers found:
callbacks 42, 409 responses 61, sink 29. poc/m0/split.mjs splits by
repository, sorted names alternating: BUILD 30 repos / 140 ops, TEST 30
repos / 152 ops. The split is fixed by sort order and is never adjusted.
poc/m0/learn.mjs derives a "harm" word list and a "read" word list from
the BUILD half only, by presence counts and purity. poc/m0/rules-text.mjs
implements PRD §4.5 as written: safe methods locked at r; any harm word,
callbacks, or sink raises to x; POST/PATCH with a read word, no harm
word, and no 409 lowers to r; else the method floor. Thresholds swept on
BUILD only (27 combinations), the one chosen was minSupport 5, harm
purity 0.75, read purity 0.85; TEST scored exactly once.

(b) Results table:
| half | agree | over-tight | wrong loosenings |
|---|---|---|---|
| BUILD (fitted) | 127 | 13 | 0 |
| TEST (honest) | 131 | 14 | 7 |

Negative controls: updateSessionStatus (BUILD half) PASS; terminateCall
(TEST half) FAIL, rule gives w.

(c) The seven TEST leaks: five DELETEs kept at the floor w where truth is
x (ClickToDial terminateCall, DedicatedNetworks deleteAccess and
deleteNetwork, InHomeDeviceManagement deleteDevice, SponsoredData
revokeSponsorship) and two POSTs wrongly lowered to r (OTPValidation
sendCode, lowered because its description contains the learned read word
"phone"; BlockchainPublicAddress
createBlockchainPublicAddressValidationNonce, lowered on the learned read
word "associated").

(d) What the learned lists actually contained, verbatim, because it
explains the failure: harm = new, create, creates, invoked, iccid,
transition, automatically, supplied, uniquely, apply, disabled,
identifying, however, trafficinfluenceid. read = get, retrieve,
associated, number, list, details, phone, retrieves, mobile, matches,
check, found, verify, read, being, issued, would, managed, otherwise,
instead, domains. State plainly: the harm list is repository vocabulary
and function words, not consequence words; no word like terminate,
charge, refund, or reboot survived the purity filter. The read list
mixes real read verbs with nouns that happen to co-occur with reads in
this catalogue.

### Two measurements that explain E7 (2026-09-07)

(e) Measurement 1, presence of a consequence word anywhere in the text is
impure. In the BUILD half, counting operations whose summary+description
contains the substring:
| word | ops | of which x | purity |
|---|---|---|---|
| terminate | 5 | 3 | 0.60 |
| refund | 4 | 1 | 0.25 |
| reboot | 6 | 2 | 0.33 |
| cancel | 4 | 2 | 0.50 |
| send | 5 | 2 | 0.40 |
| notif | 16 | 10 | 0.63 |
| subscription | 21 | 4 | 0.19 |

Explain: reads mention actions. An operation that reports whether a call
was terminated contains "terminate" and is r. Bag-of-words cannot tell
doing from describing.

(f) Measurement 2, the leading verb of the summary (else description) is
near-perfect for reads and weak for consequence. BUILD half, first
alphabetic token:
| leading verb | n | r | w | x |
|---|---|---|---|---|
| get | 31 | 31 | 0 | 0 |
| retrieve | 23 | 23 | 0 | 0 |
| delete | 14 | 0 | 12 | 2 |
| create | 11 | 1 | 1 | 9 |
| update | 7 | 0 | 5 | 2 |
| creates | 5 | 0 | 0 | 5 |
| returns | 4 | 4 | 0 | 0 |
| check | 3 | 3 | 0 | 0 |
| terminate | 2 | 0 | 2 | 0 |

Of the 14 leading verbs with n >= 2, 10 are 100% pure. Explain the
failure case: WebRTC deleteSessionById's description reads "Cancel a 1-1
media session (as originator), Decline a 1-1 media session (as
receiver), Terminate a 1-1 an ongoing media session"; the consequential
action is the third clause, so the leading verb is "cancel". And the two
x under "delete" and "terminate" leading to w show the verb does not
carry consequence.

(g) The reading of both: the verb carries read-versus-write; consequence
correlates with the object acted on. The seven DELETE/PUT leaks across
E5 and E7 act on a live session, a call, network access, a device, or a
traffic path. That is the noun in the path, not the verb in the text.

### E8 — verb from the prose, object noun from the path (2026-09-07)

(a) Design: poc/m0/rules-vn.mjs. Safe methods locked r. Verb = leading
word of summary (else description), singularised, mapped to a class by a
map learned from the BUILD half (support >= 2, majority share >= 0.8).
Object nouns = path tokens, singularised; a noun is "live" if, over
BUILD non-safe operations containing it, at least 50% are x with support
>= 4. Order: structural marker (callbacks or sink) -> x; verb class x ->
x; live noun with verb not r -> x; POST/PATCH with verb r and no 409 ->
r; else the method floor. 54 threshold combinations swept on BUILD only;
18 reached zero BUILD leaks and tied on correct lowerings (25); chosen by
fewest over-tightenings: VERB_MIN 2, VERB_P 0.8, NOUN_MIN 4, NOUN_P 0.5.
TEST scored once.

(b) Learned model, verbatim: verbMap return→r, create→x, get→r,
delete→w, retrieve→r, check→r, submit→x, terminate→w, list→r, verify→r.
liveNouns session (8 of 14 x), payment (5/6), device (3/5), slice (3/5),
traffic (4/4), influence (4/4).

(c) Results table:
| half | agree | over-tight | wrong loosenings | correct lowerings |
|---|---|---|---|---|
| BUILD (fitted) | 123 | 17 | 0 | 25 |
| TEST (honest) | 128 | 18 | 6 | — |

Negative controls: updateSessionStatus (BUILD) PASS; terminateCall
(TEST) FAIL, rule gives w.

(d) The six TEST leaks, with rule ids: DELETE ClickToDial
/calls/{callId} terminateCall, V5-floor, verb terminate; DELETE
DedicatedNetworks /accesses/{accessId} deleteAccess, V5-floor; DELETE
DedicatedNetworks /networks/{networkId} deleteNetwork, V5-floor; DELETE
SponsoredData /sponsorship/.../revoke revokeSponsorship, V5-floor,
leading word "revocation" unknown to the verb map; POST ModelAsAService
/answer queryAssistant, V4-lookup on verb "get"; POST OTPValidation
/validate-code validateCode, V4-lookup on verb "verify", truth w.

(e) Why the nouns failed, measured: the four leaking nouns have almost
no support in BUILD non-safe operations: call 2 ops (0 x), access 0,
network 1 (1 x), sponsorship 0. They could not be learned from the other
half because each CAMARA repository names its live object differently.
Also a small defect found on the way: the singulariser turns "accesses"
into "accesse", so that noun would not have matched even if learned;
recorded, not fixed, because fixing it changes no result here.

(f) The lesson across E7 and E8, stated once: vocabulary learned from
half of one catalogue does not transfer to the other half. Consequence
words and live-object nouns are long-tailed and repository-specific.
Either the vocabulary comes from outside the test bed, or the design
must not depend on vocabulary to tighten DELETE and PUT.

(g) One more measurement, "collapse by confidence": if a consumer trusts
only high-confidence rows and treats every other non-safe row as x (safe
methods stay r), E8 gives 0 wrong loosenings on both halves — BUILD
agree 86, over-tight 54; TEST agree 96, over-tight 56. But that is
exactly the trivial baseline "GET is r, everything else is x" (TEST:
agree 96, over-tight 56). On TEST the high-confidence rows are 50
safe-locked r, 27 structural x, 4 verb x, 2 live-object x; every
lowering (18 V4-lookup rows) is low confidence. The policy meets the
gate only by never loosening, so it contributes nothing the method alone
did not.

### E9 — hand-written lexicon, tighten-only, three scan scopes (2026-09-07)

(a) Design. E9 keeps E8's skeleton (safe methods locked r; callbacks/sink
→ x; POST/PATCH with a BUILD-learned read lead-verb and no 409 → r, low
confidence; else the method floor) and replaces the learned danger
vocabulary with a hand-written lexicon in poc/m0/lexicon.json: 43
danger-verb stems (terminat, cancel, revok, kick, suspend, purg, send,
sent, deliver, notif, pay, charg, refund, transfer, disconnect,
deactivat, destroy, reboot, wipe, shutdown, halt, stop, start, activat,
book, reserv, reschedul, invok, execut, trigger, dial, permanent,
irreversibl, cannot be undone, releas, expir, block, ban, hang up,
hangup, initiat, launch, shut down) and 28 live-noun stems (call,
session, participant, conference, subscription, sponsorship, access,
network, connection, connectivity, slice, device, payment, sms, message,
notification, token, credential, permission, grant, membership,
installation, appointment, booking, campaign, simulation, stream,
media). Stems match at a word start (`\b<stem>`), so "accesses" and
"Terminates" match. A danger verb anywhere in the scanned text → x (rule
L2, high). A live noun → x unless the lead verb is a learned read verb
(rule L3). The lexicon only ever tightens. Three scan scopes were run:
`op` (summary + description + operationId + path), `block` (op scope
plus the operation's full YAML block plus the file's info.description),
`file` (the whole YAML file). Code: poc/m0/rules-lex.mjs, run-lex.mjs,
rules-lex.test.mjs (9 tests; suite now 46 pass); spec-text.mjs gained
opBlockText, infoDescription, fileText. Divergence reports:
docs/logs/m0/divergence-E9-{op,block,file}-{build,test}.md.

(b) Provenance and taint, stated plainly: the lexicon was written on
2026-09-07 from general English plus DELETE/PUT anomalies measured that
morning in Stripe (594 ops), GitHub (1225), Twilio (197), OnSched and
Mimic OpenAPI files, i.e. outside the test bed. But the author had
already seen the E1–E8 failures; terminate, call, access, network and
sponsorship are all on the list. E9 is therefore tainted for those five
words and the lexicon.json provenance field says so. The outside-corpus
measurement itself: in GitHub, Stripe and Twilio roughly 1 in 10 DELETE
and 1 in 15 PUT operations carry a danger word (cancel a subscription,
kick a participant, revoke a token, suspend an installation, purge
payloads); the same shape as CAMARA's 8 of 49.

(c) Results table, three scopes × two halves, columns half | agree |
over-tight | wrong loosenings | correct lowerings:
scope op: BUILD 110 | 30 | 0 | 22; TEST 115 | 36 | 1 | 14.
scope block: BUILD 86 | 54 | 0 | 0; TEST 96 | 56 | 0 | 0.
scope file: BUILD 86 | 54 | 0 | 0; TEST 96 | 56 | 0 | 0.
Trivial baseline "GET is r, else x" for reference: BUILD 86 | 54 | 0;
TEST 96 | 56 | 0.
Negative controls: terminateCall (TEST) PASS x via L2 (terminat);
updateSessionStatus (BUILD) PASS x, at all three scopes. First shape to
pass both controls.

(d) The one TEST wrong loosening at scope op: POST OTPValidation
/validate-code validateCode, rule L4-lookup on lead verb "verify"
("Verifies the OTP received as input"), truth w because a successful
validation consumes the one-time code. The same row leaked in E8. All
four E8 DELETE leaks are gone: terminateCall by L2 (terminat),
deleteAccess by L3 (noun access in the path, lead verb delete → w, high
confidence), deleteNetwork by L3 (network), revokeSponsorship by L2
(revok). queryAssistant is now x by L2 (invok, from "may invoke tools").
So 1 leak in 15 TEST lowerings; on BUILD 0 in 22.

(e) Why block and file scopes collapse to the baseline, measured: every
CAMARA file carries the same security boilerplate in info.description
and in the operation's security/response text ("access token", "released
version of the profile", "the API is invoked using a two-legged access
token"), so the stems access, token, releas and invok fire on 139 of 140
BUILD non-safe operations and 152 of 152 TEST ones. With those firing,
every non-safe operation is x and the result is exactly "GET is r, else
x". Scanning beyond the operation's own summary/description/path is
useless with a flat lexicon; the deleteAccess intro sentence that
motivated the wider scan was caught at op scope anyway, by the path
noun.

(f) What the 30 BUILD and 36 TEST over-tightenings at op scope are,
grouped: (1) DELETE/PUT/PATCH on a subscription resource, 12 rows,
tightened by the noun subscription and/or the stem notif ("notifications
will no longer be sent"); truth w because it is the caller's own
subscription. (2) Stem collisions, 6 rows: block matches Blockchain, ban
matches "age band", book matches QoSBooking, execut in "executes the
query". (3) Read POSTs whose description mentions data being sent or
transferred, 8 rows (QualityOnDemand retrieve-*, QoSBooking retrieve-*,
DeviceLocation/DeviceDataVolume retrieve): reads that mention actions,
the E7 measurement again. (4) Own-resource teardown with a strong word,
10 rows: releas (slice, session), terminat (app instance, deployment),
reboot-request cancel, and ModelAsAService knowledge-base/assistant
DELETEs whose text says "permanent", "irreversible", "cannot be undone";
truth w in every case. (5) Structural markers on reads, 4 rows
(callbacks/sink on retrieve/count POSTs). (6) Unknown lead verbs left at
the floor, 7 rows (matching, providing, query, iot, discover).

(g) A finding for the class definition, not for the arbiter: the readers
judged "permanently delete a knowledge base / assistant / document —
this cannot be undone" (ModelAsAService, four DELETEs) as w, not x,
because the resource belongs to the caller and no third party is
touched. So irreversibility alone did not move the readers; reach beyond
the caller did. Whatever test the PRD adopts for x must be checked
against those four rows.

(h) Comparison with E8 on TEST: E8 128 agree / 18 over-tight / 6 leaks;
E9-op 115 / 36 / 1. E9 buys five fewer leaks with eighteen more false
alarms. The remaining leak is a POST lowering, not a DELETE/PUT one, so
the "x dressed up as w" problem is closed on this test bed by the
lexicon, with the taint stated in (b).

### E10 — lexicon v2: whole-word short stems, own-handle nouns dropped (2026-09-07)

(a) Taint first: from E10 on, the author has seen every row of both
halves, so every score below is fitted, not honest. The only untainted
score left is the hold-out set in data/holdout-2026-09-07/ (207 Twilio,
Stripe and GitHub operations extracted this day, unread by anyone in the
project; see its README), which E14 uses. (b) Changes to the lexicon, in
poc/m0/lexicon-v2.json with a provenance field saying the same: block,
ban and book match whole words with inflections only (v1 matched
Blockchain, "age band" and QoSBooking); nouns subscription, token,
credential, connection removed (0 true-x hits, 14 over-tightenings in
E9); noun device removed (every CAMARA operation names a device; it
never decided a DELETE/PUT/PATCH row on its own). Measurement that
justified it, from E9 op-scope rows on both halves: stem → (fired on
true x, fired on over-tightening): device 8/14, subscription 0/11,
network 5/9, sent 1/9, notif 3/8, send 4/6, block 5/2, terminat 5/3,
access 5/3, invok 5/1. The true-x rows caught only by a dropped stem
were all POSTs, whose floor is x anyway, so no DELETE/PUT/PATCH catch
was lost. (c) Results, op scope: BUILD 113 agree / 27 over-tight / 0
leaks / 22 correct lowerings; TEST 122 / 29 / 1 / 14. Same single leak
as E9 (validateCode). Seven fewer TEST over-tightenings than E9, three
fewer on BUILD. Both controls PASS. Code: rules-lex.mjs now takes opts
and lexicon entries may be {stem, re}; run-lex.mjs takes --lexicon
--scope --nouns --readverbs --floor --label; default flags reproduce E9
exactly (checked: 115/36/1). Suite 50 pass. Reports
docs/logs/m0/divergence-E10-{build,test}.md.

### E11 — live nouns from the path only (2026-09-07)

(a) Question: is the live-object noun a property of the resource in the
URL, or of the prose? E11 = E10 with --nouns=path: L3 scans only path
and operationId for nouns; L2 danger verbs still scan summary,
description, operationId, path. (b) Results: BUILD 115 / 25 / 0 / 22;
TEST 123 / 27 / 2 / 14. (c) The new TEST leak: DELETE
InHomeDeviceManagement /v1/devices/{deviceId} deleteDevice, truth x.
Summary "Delete device record"; the description says deletion also
removes "any active access control rules for this device", which
restores the device's live network access. E10 caught it by the prose
nouns access and network (L3, high). The path says only "devices", and
device is no longer a live noun. So the noun that carries the danger was
in the description, not in the URL: the resource name is not enough,
the prose noun is needed. E11 is rejected on that row. Reports
divergence-E11-{build,test}.md.

### E12 — hand-written read-verb list replaces the learned verb map (2026-09-07)

(a) Question: can the last POST leak (validateCode, "Verifies the OTP",
lowered on verb "verify") be closed by a hand list of read verbs that
leaves verify, validate and match out? HAND_READ_VERBS = get, retrieve,
return(s), list(s), check(s), query/queries, fetch, read, lookup,
search, count, describe, with plural forms. Run as E11 +
--readverbs=hand (path nouns), and as E12b = E10 + --readverbs=hand
(prose nouns). (b) Results: E12 (path nouns) BUILD 112 / 28 / 0 / 19;
TEST 123 / 28 / 1 / 14, the one leak being deleteDevice from E11. E12b
(prose nouns) BUILD 110 / 30 / 0 / 19; TEST 122 / 30 / 0 / 14. E12b is
the first shape with zero wrong loosenings on both halves without
forcing DELETE/PUT to x. Both controls PASS. (c) Cost of leaving verify
out: three correct lowerings lost on BUILD (KnowYourCustomerAgeVerification,
MostFrequentLocation, NumberVerification /verify, all truth r) and two
more on TEST now over-tight (DeviceLocation /verify, KnowYourCustomer
/verify). Measured: six CAMARA POSTs lead with "verify"; five are r,
one (validateCode) is w because a successful check consumes the code.
"verify" is genuinely ambiguous in this catalogue; the tighter choice
costs five false alarms and removes one leak. (d) Remaining
over-tightenings in E12b, by kind: reads that mention data being sent
or transferred (QualityOnDemand, QoSBooking, DeviceLocation,
DeviceDataVolume retrieve POSTs; 8 rows); own-resource teardown with a
strong word (terminate an app instance, release a slice, cancel a
reboot request, ModelAsAService "permanent/irreversible" deletes; 10
rows); subscription DELETEs tightened by notif/sent in "notifications
will no longer be sent" (4 rows); structural markers on reads (4 rows);
unknown lead verbs left at the floor (verify, matching, providing,
discover, assess; 12 rows). Reports divergence-E12-{build,test}.md
(path-noun variant).

### E13 — what option 1A costs: DELETE/PUT/PATCH floor at x (2026-09-07)

(a) Question: if DELETE, PUT and PATCH default to x with a declared menu
as the only way down (PRD option 1A), what does the table look like?
Run as E12 + --floor=x (rule L5-floor-x, confidence "policy"), and E13b
= E12b + --floor=x. (b) Results: E13 BUILD 105 / 35 / 0 / 19; TEST 110 /
42 / 0 / 14. E13b identical: BUILD 105 / 35 / 0; TEST 110 / 42 / 0. Zero
leaks on both halves in both. (c) Cost relative to E12b, which already
had zero leaks: 12 more over-tightenings on TEST and 5 more on BUILD, 17
in all; those are the DELETE/PUT/PATCH rows the method floor had right
as w and the lexicon had not touched. On this test bed the floor-at-x
policy buys no leak that the lexicon had not already removed; it is
insurance against the lexicon missing a word, and its premium here is
17 of 292. Reports divergence-E13-{build,test}.md.

### E14 — the hold-out: Twilio, Stripe, GitHub, read blind (2026-09-07)

(a) What the hold-out is. data/holdout-2026-09-07/: 207 operations
extracted by poc/m0/holdout-extract.mjs from three public OpenAPI 3
JSON files pinned by SHA-256 in the README (Twilio API v2010: every
DELETE and POST, 94; Stripe: every DELETE, 32; GitHub REST: every 4th
DELETE or PUT, 81). No GET. Ground truth read blind by five Sonnet
agents from repo/path/method/operationId only, with the CAMARA brief
adapted for JSON (three added sentences, recorded in the README), then
one orchestrator ruling
(agents/remove-selected-repo-from-org-variable x→w to match its twin).
As read: twilio POST 19 w / 43 x, twilio DELETE 31 w / 1 x, stripe
DELETE 28 w / 4 x, github DELETE 35 w / 14 x, github PUT 26 w / 6 x; 19
rows carry doubt. Files ground-truth.csv, ground-truth-as-read.csv,
README.md. Nobody in the project had seen these operations before the
lexicon was written, so this is the one untainted score in M0. Runner:
poc/m0/run-holdout.mjs (+3 tests; suite 53 pass). Scored CSVs in
docs/logs/m0/holdout-{E9,E12b,E13b}.csv.

(b) Results, scored once each, columns
repo | n | agree | over-tight | wrong loosenings:
E9 (lexicon v1, learned read verbs): twilio 94 | 58 | 36 | 0; stripe 32
| 23 | 9 | 0; github 81 | 25 | 54 | 2; total 207 | 106 | 99 | 2.
E12b (lexicon v2, prose nouns, hand read verbs): twilio 94 | 62 | 32 |
0; stripe 32 | 27 | 5 | 0; github 81 | 25 | 54 | 2; total 207 | 114 |
91 | 2.
E13b (E12b + DELETE/PUT/PATCH floor x): total 207 | 67 | 140 | 0,
identical to the trivial baseline "everything x" (twilio 44/50, stripe
4/28, github 19/62).

(c) The two wrong loosenings, both GitHub PUT, both left at the method
floor w by E9 and E12b: (1) enterprise-team-organizations/add, "Assign
an enterprise team to an organization"; truth x because it grants every
member of that team access to the organization. The op text contains no
lexicon word; "access" and "grant" are the reader's inference, not the
spec's words. (2) pulls/merge-async, "Merge a pull request
asynchronously"; truth x because merging changes shared history and the
operation carries x-github.triggersNotification: true. "merge" is not
in the lexicon, and holdout-extract.mjs did not carry vendor
extensions, so the structural marker the readers used was invisible to
the arbiter. Every Twilio and Stripe danger case was caught:
DeleteParticipant ("Kick a participant") by kick; Stripe
cancel-subscription by cancel; DeleteCustomersCustomer ("immediately
cancels any active subscriptions") by cancel; DeleteAccountsAccount by
the noun account text and permanent; every live-call Twilio POST is x
by floor.

(d) Why GitHub over-tightens 54 of 81, measured: 41 rows are
L3-live-noun and the stem access fired 56 times across the hold-out,
almost all from GitHub's per-operation boilerplate sentence "OAuth app
tokens and personal access tokens (classic) need the … scope". It is
the CAMARA block-scope collapse again, this time inside the operation's
own description: a vendor's boilerplate can carry a live noun.
permission (14) and membership (5) add a few more. On Twilio the 32
over-tightenings split 13 POST Update* on the caller's own resources
left at the POST floor x (truth w; there is no read verb to lower on
and the arbiter never lowers POST to w), 13 own-record DELETEs
tightened by the nouns call, conference, message, installation, and 6
by danger verbs (cancel, stop, trigger, pay in "payload", purge).
Stripe's 5 are stem collisions and strong words on own resources
(execut in "executive", pay in "Apple Pay", "cannot be undone" on a
draft invoice).

(e) What transfers and what does not, stated once. Transfers: the
tighten-only danger-verb rule (kick, cancel, terminate, revoke,
suspend, purge) caught every DELETE danger case in three vendors it
was not written against; the method floor plus lexicon left zero wrong
loosenings on 126 Twilio and Stripe operations. Does not transfer: the
live-noun list, which is vendor-specific in both directions (GitHub's
boilerplate makes access fire everywhere; GitHub's real danger cases
say "assign a team to an organization" with no noun on the list); and
any rule that lowers POST, because in this set no POST is r and the
arbiter has no path from POST to w. Not measured here: correct
lowerings (none possible, no GET and no r rows).

(f) Two extractor gaps found by the readers, recorded not fixed: vendor
extensions (x-github.triggersNotification) are structural evidence of
consequence and holdout-extract.mjs dropped them; 16 Twilio operations
have no summary and no description at all, and were classed by the
readers from request and response schemas, which the arbiter never
reads.

### Next

M0 has run fourteen shapes and one blind hold-out. The honest numbers
are E14's: with lexicon v2 the method floor plus a tighten-only
danger-verb list leaves zero wrong loosenings on 126 Twilio and Stripe
operations and two on 81 GitHub operations, both PUTs whose danger is
stated in words the list does not have (assign a team to an
organisation; merge). Forcing DELETE/PUT/PATCH to x removes those two
at the price of collapsing to "everything is x" (140 over-tightenings
of 207). The live-noun rule is the weak part: it over-fires on vendor
boilerplate (GitHub's "personal access tokens" sentence) and misses
vendor-specific danger nouns. The decisions owed to the PRD are
unchanged and now have prices: the x definition; the DELETE/PUT default
(E13 on CAMARA costs 17 of 292, E13b on the hold-out costs 49 more than
E12b and buys two leaks); the gate's treatment of low-confidence
lowerings. Two extractor gaps go on the M1 list: vendor extensions as
structural markers, and schema text for operations with no prose.
