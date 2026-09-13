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

### E15 — a second pass that un-raises (2026-09-07)

(a) Idea. Pass 1 (E12b) is unchanged. Pass 2 looks only at rows pass 1
raised above the method floor by the lexicon (rule ids L2-danger-verb,
L3-live-noun) and may un-raise them back to the floor, never below it,
never touching L0/L1/L4/L5 rows. Three checks in order, each naming its
evidence in the rule id: P2-collision (every fired stem occurs only
inside a known compound such as "Apple Pay", "executive",
"getting-started"), P2-own (the first sentence names a stored artefact
or says "your"/"the authenticated user", and no other party is named
anywhere), P2-place (no fired stem appears in the first sentence; class
kept, confidence dropped to low). Code poc/m0/rules-pass2.mjs,
poc/m0/rules-pass2.test.mjs, `--pass2=on` in run-lex.mjs and
run-holdout.mjs. Suite 62 pass.

(b) Results, pass 1 → pass 2, columns half/repo | agree | over-tight |
wrong loosenings:
CAMARA BUILD 110|30|0 → 112|28|**3**; CAMARA TEST 122|30|0 → 124|28|0;
hold-out total 114|91|**2** → 138|62|**7**.
Pass 2 examined 123 hold-out rows, un-raised 39 (25 by own, 14 by
collision), downgraded 38 by place; 31 un-raises were correct and 8
were wrong.

(c) The eight wrong un-raises split into two causes, and only one of
them is a defect. Three on Twilio and three on CAMARA were the artefact
word list being too generous: it contained `resource`, which in REST
names anything, plus `profile`, `reservation` and `configuration`.
"Stop a Stream using either the SID of the Stream resource" was read as
paperwork; it stops a live media stream on an in-progress call. That is
E16.

(d) The other five, all GitHub DELETEs (remove team membership ×2,
remove app access restrictions, remove user access restrictions, remove
sub-issue), are not a pass-2 defect. Pass 1 had raised each of them to x
on the stem `start`, whose only occurrence in the operation's text is
inside the documentation URL
`.../getting-started-with-github/githubs-products`. That is not
evidence of anything. Pass 2 identified the evidence as fake and
un-raised, correctly by its own rule; the row is x for a reason the
tool still cannot see ("Removes the ability of a user to push to this
branch"). So pass 1's hold-out score of 2 wrong loosenings was partly
luck: 5 of its GitHub rows were right by accident, and the number of
hold-out operations whose danger the tool can actually see is 200 of
207, not 205.

### E16 — the artefact list, trimmed (2026-09-07)

(a) Change, one file: ARTEFACT in poc/m0/rules-pass2.mjs is reduced to
words that can only ever mean a stored copy of information — record,
log, entry, draft, metadata, comment, reaction, label, autolink — and
loses resource, profile, reservation, configuration, setting, template,
feedback, secret, variable, cache, key, webhook. A word that can name a
live object is not evidence that the target is a record. Three
regression tests added (Stop a Stream stays x; "Delete a Call record
from your account" still un-raises; "Create an Application Profile" no
longer un-raises). Suite 65 pass.

(b) Results: CAMARA BUILD 110|30|**0**, TEST 122|30|0 — all three E15
CAMARA leaks gone, and pass 2 now changes nothing net on CAMARA.
Hold-out with pass 2 on: 126|74|7; with pass 2 off: 114|91|2. All three
Twilio wrong un-raises gone; the five GitHub `start`-collision rows
remain, for the reason in E15(d).

(c) Reading: as an un-raiser, pass 2 buys 17 fewer over-tightenings on
the hold-out and pays 5 wrong loosenings, all of them rows pass 1 held
for a fake reason. Under a zero-leak gate that is not a trade worth
making.

### E17 — the same second pass, confidence only (2026-09-07)

(a) Change of role, not of code path: pass 2 never alters the class,
only marks whether pass 1's evidence was strong or weak. A row whose
only trigger sits in a documentation URL, in boilerplate, or outside
the first sentence stays x and is marked weak. Measured on the hold-out
over the 123 lexicon-raised rows, classes identical to pass 1 (2 wrong
loosenings, unchanged):
| | marked weak | still strong |
|---|---|---|
| false alarms | 53 | 25 |
| true x | 18 | 27 |

(b) So a consumer configured to act only on strong evidence sees 25
false alarms instead of 78, a two-thirds cut, and loses nothing to a
wrong loosening, because the 18 true-x rows marked weak are still x.
The eighteen are listed in the run output; they include Stripe's
"Delete a customer" (whose "immediately cancels any active
subscriptions" sentence is the second one) and the five GitHub `start`
rows.

(c) Finding, stated once: the un-raise and the confidence mark are the
same measurement used two ways. Used to change the class it creates
leaks; used to grade the evidence it removes two thirds of the noise
for free. rwxmap's safety spine says never loosen without evidence, and
"this evidence is weak" is not evidence of safety.

### E18 — verb-led: the lead verb sets the class, the verb's object may raise it (2026-09-07)

(a) The change of model. Every shape from E9 to E17 asked "does a danger
word appear anywhere in the text". E18 asks two different questions in
order: what does the lead verb mean, and what is that verb acting on.
Ordered procedure in poc/m0/rules-verb.mjs: V0 safe method → r; V1
callbacks or sink → x; V2 lead verb in the `consequential` list → x; V3
the head noun of the verb's object is a party word, or a from/for/of/to
phrase attached to it names a party → x; V4 lead verb in the `read`
list → r; V5 lead verb in the `write` list → the method floor; V6
otherwise the method floor. Nothing ever goes below the method floor.
Object head extraction is head-final: from "Delete a Call record from
your account" the head is `record`, from "Terminate an active call" it
is `call`, from "Delete a specific Trust Domain" it is `domain`. Tables
are hand-written in poc/m0/verbs.json and poc/m0/parties.json, both
carrying a provenance field saying they were written from ordinary
English and then checked against the measured distribution over all 499
labelled operations, so E18's scores are fitted for verb choice.
`remove` and `removes` are deliberately in no verb list, because they
measured 8 w and 10 x over 18 operations: "remove X from Y" usually
takes something away from Y. Suite 80 pass. Runner poc/m0/run-verb.mjs,
reports docs/logs/m0/divergence-E18-{build,test}.md and
holdout-E18.csv.

(b) The measurement that motivated it, over all 499 labelled
operations, lead verb against truth:
| lead verb | n | r | w | x |
|---|---|---|---|---|
| get | 56 | 55 | 0 | 1 |
| retrieve | 43 | 42 | 0 | 1 |
| delete | 110 | 0 | 99 | 11 |
| create | 49 | 1 | 2 | 46 |
| update | 27 | 0 | 22 | 5 |
| remove | 18 | 0 | 8 | 10 |

And the objects that separate a w delete from an x delete: delete
stayed w on event, subscription, secret, item, session, recording,
list, source, discount, configuration, domain, instance; delete became
x on account, customer, access, token, installation, codespace,
repository, network. The left column is the caller's own paperwork, the
right column is something a person or another system relies on. Note
`session` appears 3 times as a w delete and never as an x one, although
it was on every live-noun list from E8 onward.

(c) Results, columns half/repo | agree | over-tight | wrong loosenings:
CAMARA BUILD 103 | 36 | 1; CAMARA TEST 123 | 26 | 3; hold-out twilio 69
| 25 | 0, stripe 28 | 4 | 0, github 45 | 34 | 2, total 142 | 63 | 2.
For comparison, E12b on the same sets: BUILD 110 | 30 | 0, TEST 122 |
30 | 0, hold-out total 114 | 91 | 2.
Negative controls: terminateCall PASS; updateSessionStatus FAIL.
A variant with `--parties=anywhere` (a party word anywhere in the text
raises, the pre-E18 behaviour) gives BUILD 91 | 49 | 0 and TEST 106 |
46 | 0 with both controls passing — it trades every CAMARA leak for 33
more over-tightenings, and is recorded only as the comparison it was
built to be.

(d) The four CAMARA wrong loosenings, each a different failure of the
verb-led model: (1) WebRTC PUT updateSessionStatus, "Update the status
of the media session" — the lead verb is `update` (write) and the
object head is `status`; the operation answers or ends a live call,
which the text only reveals three paragraphs later. (2)
InHomeDeviceManagement DELETE deleteDevice, summary "Delete device
record" — the head is `record`, a wrapper word, so the party word
`device` sitting one token earlier never becomes the head. (3)
ModelAsAService POST queryAssistant, "Get an answer from a QA
assistant" — lead verb `get` lowers it to r; the danger ("may invoke
tools automatically") is nowhere near the verb. (4) SponsoredData
DELETE revokeSponsorship, summary "Revocation of Sponsorship" — the
lead word is a noun, not a verb, so no verb rule fires and V6 keeps the
floor. E12b caught (2) by its live-noun rule and (4) by the danger stem
`revok`; the verb-led model has no equivalent.

(e) Party-word accuracy at V3, correct raises against
over-tightenings, over all 499: device 3/17, repository 2/12, user
1/7, organization 0/6, session 0/4, account 1/4, slice 0/2, assistant
0/2, person 0/2, permission 0/2, customer 1/2; and the words that
earned their place: member 2/0, restriction 2/0, role 2/0, participant
1/0, team 1/0, token 1/0, installation 1/0, codespace 1/0, stream 1/0,
membership 2/1. The list is carrying six words that never once raised
correctly.

(f) Reading, one paragraph: the verb-led model roughly halves the
noise on the blind hold-out (91 over-tightenings down to 63) at the
same 2 wrong loosenings, and it removes the whole class of false
alarms caused by scenery words, because a party word only counts when
it is the object of the verb. It pays with four CAMARA rows that the
word-list shapes caught: a noun-led summary, a wrapper-word object, a
verb whose danger is stated far from it, and a status update on a live
session. The two models fail in different places, which is the
finding.

### E19 — the union: both arbiters, tighter class wins, agreement is the confidence (2026-09-07)

(a) What it is, composition only, no new vocabulary and no new rule.
poc/m0/rules-union.mjs runs both existing arbiters over the same
operation: the word-list model (arbiterLex with lexicon v2 and the
hand read-verb list, i.e. E12b) and the verb-led model (arbiterVerb,
E18). The class is the tighter of the two. Confidence comes from
agreement: high when both returned the same class, low when they
disagree. The rule id keeps both provenances as `U:<A>|<B>` and the
evidence keeps both strings. Two descriptive fields are recorded per
row: `agree`, and `raisedBy` (both / wordlist / verb / neither)
measured against the method default. Pass 2 runs in grading mode only,
per D23. Runner poc/m0/run-union.mjs, tests
poc/m0/rules-union.test.mjs, suite 90 pass.

(b) The measurement that motivated it. The two models' x-sets were
compared directly: Jaccard 0.78 on CAMARA and 0.68 on the hold-out, and
in both sets the rows NEITHER model raised contain zero true x. Their
misses are disjoint — the word-list model missed
enterprise-team-organizations/add and pulls/merge-async; the verb-led
model missed issues/set-issue-field-values and
issues/remove-sub-issue.

(c) Results, columns half/repo | agree | over-tight | wrong loosenings
| correct lowerings:
CAMARA BUILD 98 | 42 | 0 | 10; CAMARA TEST 117 | 35 | 0 | 13; hold-out
total 105 | 102 | 0 | 0 (twilio 58 | 36 | 0, stripe 25 | 7 | 0, github
22 | 59 | 0).
Both negative controls PASS. `pass2 class changes: 0` on every run,
asserted by the runner and failing the run if it is ever non-zero —
D23 is now enforced by code rather than claimed.
For comparison on the same sets: E12b 110|30|0 and 122|30|0, hold-out
114|91|2. E18 103|36|1 and 123|26|3, hold-out 142|63|2.

(d) So the union is the first shape with zero wrong loosenings on both
CAMARA halves AND on the blind hold-out, and both negative controls
pass. It pays in noise: 77 over-tightenings across CAMARA against
E12b's 60, and 102 of 207 on the hold-out against E12b's 91 and E18's
63. Taking the tighter of two models is by construction at least as
tight as either.

(e) Agreement earns its keep as the confidence signal. On the
hold-out, splitting the union's rows by confidence: high confidence 93
correct against 49 over-tightenings; low confidence 12 correct against
53. A consumer acting only on high-confidence rows sheds 53 of the 102
over-tightenings and loses nothing to a wrong loosening, because there
are none at either level. Under D22 the gate is met at high confidence
and the low-confidence wrong-loosening rate is also zero, so both
numbers are reported and both are zero.

(f) A defect found and fixed during review, recorded because it nearly
produced a false result. The first implementation clamped the
combined class up to the method default. For POST that default is x,
so every POST was forced to x, every correct lowering was destroyed
(correct lowerings read 0 on halves where E12b alone had 22), and the
resulting "zero wrong loosenings" was an artifact: nothing can leak on
POST when every POST is already x. One row made it visible —
CallForwardingSignal POST retrieveUnconditionalCallForwarding, where
both arbiters returned r, agreed, and the union emitted x. The floor
is not "never below the method default": per D17 and §4.5, safe
methods are locked at r, PUT and DELETE never go below w, and POST and
PATCH may be lowered to r because their x is a policy default, not an
RFC 9110 fact. After the fix, wrong loosenings stayed 0 on every set
and the correct lowerings returned.

(g) A limit of the hold-out, stated because it caps what E19's
hold-out numbers can show: the hold-out's ground truth contains 140 w
and 67 x and no r at all, because the extraction selected no GET and
every selected POST creates or acts. Correct lowerings on the hold-out
are therefore 0 by construction, not by failure, and the usefulness
half of the gate — a useful share of POSTs decided r — can only be
measured on CAMARA until a hold-out with read operations exists.

### E20 — the clean exam: Box, PagerDuty, Adyen, with read operations (2026-09-07)

(a) What it is. data/holdout2-2026-09-07/: 220 operations extracted by
poc/m0/holdout2-extract.mjs from three public OpenAPI 3 JSON files
pinned by SHA-256 in the README (Box 99, PagerDuty 93, Adyen 28),
selection rule fixed before any text was read: sorted by path then
method, every 3rd Box candidate, every 5th PagerDuty candidate, every
Adyen candidate. GET is included this time: 94 of the 220. Every
operation has a summary and a description. Ground truth read blind by
five Sonnet agents, 44 rows each, round-robin over vendors and methods,
same brief as the first hold-out plus one sentence naming file sharing,
invitations, paging and payment capture or refund as third-party
effects. Readers appended rows incrementally because a first attempt
was killed by a rate limit before anything was written. As read: r 104
(all 94 GET plus 10 POST lookups), w 63, x 53; 4 rows carry doubt, all
classed to the tighter option; zero orchestrator rulings. No list in
the repo had seen any of these operations: the lexicon, the verb table
and the party list were all written before this set existed, so this
is the one clean score in M0. Runners gained an `--ops=` flag so the
hold-out mode can point at this set. Scored CSV
docs/logs/m0/holdout2-E19.csv.

(b) Results, scored once each, columns
shape | agree | over-tight | wrong loosenings | correct lowerings, all
of 220:
E19 union (the shape that counts) 181 | 37 | 2 | 4.
E12b word lists (reference) 184 | 34 | 2 | 4.
E18 verb-led (reference) 197 | 20 | 3 | 6.
Trivial baseline "GET is r, else x" 147 | 73 | 0.
Because 94 rows are GET and locked r, the non-GET view is the
informative one: E19 over the 126 non-GET rows is 87 agree, 37
over-tight, 2 wrong loosenings; 10 of those rows are POST lookups the
readers classed r, and E19 lowered 4 of them.

(c) The two wrong loosenings, both Box DELETEs, both a relationship
object that belongs to another person, and both invisible to every
list: (1) delete_collaborations_id, summary "Remove collaboration",
description "Deletes a single collaboration." — truth x because it
removes another person's access to shared content; both arbiters
returned the method floor, so confidence is method-only. (2)
delete_shield_information_barrier_segment_members_id, summary "Delete
shield information barrier segment member by ID" — truth x because it
removes another person's barrier-segment membership; the word-list
arbiter found no stem, the verb-led arbiter took `delete` as a write
verb, and its object-head extraction, capped at four tokens after the
verb, stopped at `segment` and never reached `member`, which is on the
party list. Both arbiters agreed on w, so this row sits at HIGH
confidence. Under D22 the gate is zero wrong loosenings at high
confidence; on this set it is one. The gate is not met on the clean
exam. Recorded defect, not fixed: the four-token cap in objectHead.

(d) Confidence split on this set, rows | correct | over-tight | wrong
loosenings: high 185 | 171 | 13 | 1; low 21 | 1 | 20 | 0; method-only 14
| 9 | 4 | 1. Of the 37 over-tightenings, 20 sit at low confidence and
13 at high.

(e) Where the x rows came from, `raisedBy` against the method default,
truly-x / over-tightening: both 1 / 2; wordlist only 1 / 15; verb only
0 / 3; neither (the POST floor) 49 / 17. On this set the lexicon raised
19 rows and was right once; the verb-led raise was right zero times of
three. Nearly every true x here is a POST that the floor already had,
and the raising rules mostly added noise. Over-tightenings by pair of
rule ids: the word-list danger verb accounts for 18 of the 37 (its
stems firing on Box and PagerDuty prose such as "remove", "cancel",
"start", "notification"), the live-noun rule 8, the POST floor on rows
the readers classed w 4, and the verb-led consequential or party rules
7.

(f) Reading, once. On a catalogue no list had seen, the union's danger
record is 2 wrong loosenings in 220, the same two the word lists alone
produce, and one of them at high confidence; the verb-led model alone
adds a third (delete a group). The two misses share a shape the tool
has no signal for: deleting a relationship object (a collaboration, a
membership) whose other end is a person, with prose that names neither
the person nor an effect. The noise record is better than on the first
hold-out (37 of 220 against 102 of 207), largely because this
catalogue's prose is terse. E18 alone would have been the best on this
set by every count except leaks.

### E21 — the four-token cap removed, scored once (2026-09-07)

(a) What changed. poc/m0/rules-verb.mjs objectHead() had a cap of four
kept tokens after the lead verb; E20(c) recorded that it stopped at
"segment" in "Delete shield information barrier segment member by ID"
and never reached "member", a party word, producing a wrong loosening
at high confidence. The cap line was deleted; the PREP stop and STOP
skipping are unchanged; no lexicon, verb table, party list or other
rule changed. Per D24 the clean exam is scored once after the change
and the fact recorded here. node --test poc/m0/*.test.mjs: 90 pass, no
test asserted the cap.

(b) Results, union shape, pass2 on, pass2 class changes 0 on every
run. CAMARA build 98 | 42 | 0 | 10 (confidence high 115, low 19,
method-only 6); CAMARA test 117 | 35 | 0 | 13 (high 128, low 17,
method-only 7); both negative controls x, PASS. Hold-out 1 total 105 |
102 | 0 | 0 (high 142, low 61, method-only 4). Unchanged from E19 on
both. Clean exam 182 | 37 | 1 | 4 (high 184, low 22, method-only 14).
Scored CSV docs/logs/m0/holdout2-E21.csv.

(c) Exactly one class changed on the clean exam:
delete_shield_information_barrier_segment_members_id, w to x, truth x,
head now "member", party rule fires. No new over-tightening anywhere;
the 37 over-tightenings are the same 37 rows with the same rule pairs
as E20 (danger-verb with verb-write 9, danger-verb with floor 5, floor
with consequential 3, floor with verb-write 3, live-noun with floor 3,
live-noun with verb-write 2, danger-verb with verb-read 2, and 1 each
for six other pairs).

(d) The remaining wrong loosening: box DELETE
/collaborations/{collaboration_id} delete_collaborations_id, summary
"Remove collaboration", description "Deletes a single collaboration.",
truth x (removes another person's access to shared content). Both
arbiters return the method floor (rule U:L5-floor|V6-floor, evidence
verb=remove head=collaboration), confidence LOW (method-only). Under
D22, zero wrong loosenings at high confidence: the clean exam now
meets the gate at high confidence, with 1 wrong loosening at low
confidence reported beside it. Per set: CAMARA 0 high / 0 low;
hold-out 1 0 / 0; clean exam 0 / 1.

(e) False-alarm dossiers: docs/logs/m0/false-alarms-E20.csv (37 rows,
pre-fix) and docs/logs/m0/false-alarms-E21.csv (37 rows, post-fix),
columns repo,path,method,operationId,tool_class,gt_class,confidence,
rule_id,evidence,summary, sorted high confidence first. Of the 37, 13
sit at high confidence, 20 at low, 4 method-only (from E20(d),
unchanged). The word-list danger verb is in 18 of the 37 pairs.

(f) Reading, once. Removing the cap fixed the one row it was meant to
fix and nothing else, on every set. The leak that remains has no word
in it that any list could carry: a relationship object whose other end
is a person. The signal is structural (Box's collaboration schema has
an accessible_by user field). That is M1's first item, not an M0
tuning. M0 closes here.

### E22 — irreversibility stems dropped per D20, scored once (2026-09-07)

(a) Why. The user, reading docs/logs/m0/false-alarms-E21.csv, asked
why Box "Delete file", "Delete folder", "Permanently remove folder"
were flagged x when truth is w. Cause: poc/m0/lexicon-v2.json
dangerVerbs carried three irreversibility stems, "permanent",
"irreversibl", "cannot be undone", written before D20 decided that
irreversibility is not the test for x (own-resource permanent deletes
are w; 129 DELETE w rows are irreversible). The three stems were
removed; nothing else in any list or rule changed; provenance
sentence appended to the lexicon. node --test poc/m0/*.test.mjs: 90
pass, no test asserted the stems.

(b) Results, union shape, pass2 on, pass2 class changes 0 everywhere,
both negative controls x, PASS. CAMARA build 98 | 42 | 0 | 10
(unchanged); CAMARA test 120 | 32 | 0 | 13 (was 117 | 35); hold-out 1
106 | 101 | 0 | 0 (was 105 | 102); clean exam 186 | 33 | 1 | 4 (was
182 | 37), confidence high 187 / low 18 / method-only 15. Scored CSV
docs/logs/m0/holdout2-E22.csv; dossier
docs/logs/m0/false-alarms-E22.csv, 33 rows.

(c) Every class change against E21, all x to w with truth w, i.e. all
fixes; zero new over-tightenings, zero new wrong loosenings: CAMARA
test ModelAsAService deleteKnowledgeBase, deleteDocument, deleteTool;
hold-out 1 Stripe DeleteInvoicesInvoice; clean exam Box
delete_files_id, delete_folders_id, delete_folders_id_trash,
PagerDuty deleteSreMemory. Eight rows.

(d) The remaining clean-exam wrong loosening is unchanged:
delete_collaborations_id, low confidence, method floor from both
arbiters.

(e) Also observed in the same dossier, recorded not fixed: substring
collisions in the live-noun rule, "call" matching "called" and
"calling this endpoint" (Box classification and storage-policy rows),
"access" matching PagerDuty's "Early Access" banner text
(updateEventEnrichment, updateEventEnrichmentRules). Pass 2 marked
all of them low confidence but did not clear them. Candidate for the
party-list and live-noun trim already on M1's list.

(f) Reading, once. A stem list written before a decision can quietly
carry the decision's opposite. The three stems encoded "irreversible
means x", which D20 rejected; removing them fixed eight rows across
three sets and cost nothing. The user's question also settled a
definitional point worth recording: x is radius (reaches beyond the
caller) or non-repeatability, never severity or permanence; "delete"
alone never makes x, its object can (party list, rules-verb.mjs
parties.json), and the object words that fail are relationship nouns
like collaboration, which is M1's schema signal.

### E23 — collaboration added to the party list, scored once (2026-09-07)

(a) What changed. The user asked for "collaboration" on the verb-led
party list. poc/m0/parties.json gained "collaboration",
"collaborations" beside "collaborator(s)"; provenance sentence
appended. Nothing else changed. node --test: 90 pass.

(b) Results, union shape, pass2 on, pass2 class changes 0 everywhere,
both negative controls x, PASS. CAMARA build 98 | 42 | 0 | 10
(unchanged); CAMARA test 120 | 32 | 0 | 13 (unchanged); hold-out 1
106 | 101 | 0 | 0 (unchanged); clean exam 187 | 33 | 0 | 4 (was 186 |
33 | 1). Confidence, clean exam: high 187 (174 correct, 13 over-tight,
0 leaks), low 19 (3 / 16 / 0), method-only 14 (10 / 4 / 0). Scored CSV
docs/logs/m0/holdout2-E23.csv; dossier
docs/logs/m0/false-alarms-E23.csv, 33 rows, same rows as E22.

(c) Exactly one class changed on any set: delete_collaborations_id, w
to x, truth x, the last clean-exam wrong loosening. Its confidence is
low: only the verb-led arbiter raised it (party rule), the word-list
arbiter found nothing, so the two disagree.

(d) Every row on any set whose text contains "collaboration", all on
the clean exam: post_collaboration_whitelist_entries x/x high;
get_collaboration_whitelist_exempt_targets r/r;
get_collaboration_whitelist_exempt_targets_id r/r;
delete_collaborations_id x/x low; get_files_id_collaborations r/r;
put_folders_id w/w high; get_folders_id_collaborations r/r;
get_groups_id_collaborations r/r. The word raised one row and
disturbed none; GETs are locked r; put_folders_id mentions
collaborations in passing and the party rule did not fire because the
word is not the verb's object head.

(e) Taint, stated plainly. This word was added because the clean exam
exposed it. Per D24 the clean exam is scored once per change and
recorded, never used to choose between shapes; this is a list edit,
not a shape choice, but the clean exam's zero for this one row is no
longer a blind result. The other 219 rows are untouched by the edit.
Hold-out 1 and CAMARA contain no operation mentioning collaboration,
so they neither confirm nor refute the word.

(f) Reading, once. A one-word fix closes the last leak, and it does
not generalise: a membership, an assignment, a share, a grant to a
group are the same shape, a relationship object whose other end is a
person, and the list would need every noun any vendor ever coins for
one. The structural signal (the resource schema points at a user) is
the version of this fix that does not need a new word per vendor. M1
first item unchanged.

### E24 — two axes: a destructive flag beside r/w/x, first grid (2026-09-07)

(a) Why. The user argued w is also dangerous and proposed x =
delete/remove, w = add/update, so a Gmail agent could be granted "read
and reply, never delete". That is a different question from blast
radius (MCP's destructiveHint asks exactly it: destructive versus
additive), and one ordered letter cannot carry both; under that
proposal pay, send, reply and add-a-stranger-to-admins all become w.
Decision "two axes": r/w/x stays radius or non-repeatability (D20);
destructive becomes a separate boolean derived from method and lead
verb only, never from the class. This also exposes a defect in PRD
§4.3's untested mapping destructiveHint = (class == x), which sends
"delete my own file" (w) out as non-destructive.

(b) POC. poc/m0/rules-destructive.mjs destructiveFlag(op): D1 method
DELETE -> true; D2 lead verb (leadVerb from rules-vn.mjs) in
poc/m0/destructive.json (23 stems: delete, remove, purge, wipe,
destroy, erase, clear, drop, revoke, unassign, uninstall, detach,
terminate, cancel, kill, reset, truncate, expire, disable, deactivate,
suspend, ban, block; written before scoring, from MCP's definition,
unmeasured) -> true; D3 else false. poc/m0/run-axes.mjs prints a 3x2
grid per set by truth class and by tool class, a mapping check, and
samples. 7 new tests, 97 pass total. No existing file changed.
Clean-exam CSV docs/logs/m0/axes-E24.csv.

(c) Grid by TRUTH class, cells destructive false | true. CAMARA build:
r 76|0, w 7|17, x 36|4. CAMARA test: r 79|0, w 9|18, x 40|6. Hold-out
1: r 0|0, w 45|95, x 49|18. Clean exam: r 104|0, w 43|20, x 45|8. Over
all 719 labelled rows: truth-w and destructive 150 (own deletes);
truth-x and non-destructive 170 (reach others by adding: create
payment, create call, register endpoints, create comment, create
subaccount, upload file version); truth-x and destructive 36; no r row
is destructive.

(d) Mapping check, destructiveHint = (tool class == x) versus the
flag: tool x but flag false, CAMARA 62 + 62, hold-out 1 94, clean exam
72 (Ask question, Generate text, Create comment, Create payment); tool
w but flag true, CAMARA 1 + 8, hold-out 1 39, clean exam 14 (Delete
file, Delete folder, Remove shared link, Delete escalation policy).
The class-derived hint is wrong on 352 of 719 rows in one direction or
the other.

(e) Negative controls: terminateCall x and destructive true (D1);
updateSessionStatus x and destructive false. The second is correct
under MCP's definition (a status update breaks nothing) and shows the
axes are independent.

(f) Reading, once. The two questions really are different: the largest
cells are exactly the two the single-letter schemes cannot separate,
own deletes (w, destructive) and additive reach (x, non-destructive).
The flag is cheap, the method gives most of it, and it fixes the §4.3
mapping. What is not yet known is whether the verb list is right: no
reader has labelled destructive, so its false positives (cancel,
block, reset, expire as first verbs) and misses are unmeasured. That
measurement, plus the mapping change in §4.3, go to the PRD as D28.

(g) All false alarms across the three sets, 208 rows (tool class
tighter than truth), split by the destructive flag, dossier
docs/logs/m0/false-alarms-by-destructive-E24.csv. Destructive: CAMARA
26, hold-out 1 56, clean exam 6, total 88; all are truth w, and 87 of
88 are method DELETE (the one exception is POST "Cancel a payment").
Non-destructive: CAMARA 48, hold-out 1 45, clean exam 27, total 120;
these are the POST/PUT/PATCH adds and updates the floor or a stem
raised, and the destructive axis says nothing about them. Reading the
88 destructive rows by hand: 77 are plainly the caller's own resource
(event subscriptions 13, secrets and webhooks 11, recordings, records,
media, transcriptions, caches, bookings, keys, reactions, project
items, a stored card), raised by danger stems in surrounding prose
("terminate", "purge", "release"), by the live noun "session", or by
party words used as scope ("for the authenticated user", "from your
account", "for an organization", "from a repository"). About 11 are
arguable and worth a second read of the truth, not of the tool:
"Unblock a user" (2, GitHub), "Delete a person" (2, Stripe Connect),
"Remove a device from a Trust Domain", "Terminate an Application
Instance" and "Deployment" (2), "Delete a QoS session", "Delete
session", "Delete Registration Session" (CAMARA live sessions; D20
names a live session as reaching beyond the caller, and the readers
classed these w). Two signals fall out. First, a destructive row whose
object is scoped to the caller ("your account", "the authenticated
user") is strong evidence for w; today that phrase is what makes the
party rule fire wrongly ("user" as head of a for-phrase), so the
party-phrase rule is the defect, not the flag. Second, the
non-destructive 120 are untouched by this axis and remain the
POST-floor problem. Neither signal is applied; recorded for M1.

### E25 — ten passes on the false alarms: what a human sees in the summary (2026-09-07)

(a) Why and how. The user, sorting the false-alarm dossiers by the
summary column alone, could class most rows by eye and asked what the
rules are doing wrong. A bounded loop of ten passes, one hypothesis
each, logged before and after in poc/m0/exp-e25/LOG.md; tuning on
CAMARA build/test and hold-out 1 only, the clean exam scored once at
the end on the best variant (D24). No existing file changed; variant
arbiter poc/m0/exp-e25/arbiter25.mjs, scorer run25.mjs,
`--variant=base` reproduces E23 exactly.

(b) Pass table, CAMARA test agree/over-tight/leaks then hold-out 1. P1
summary-only word list 122/28/2, 131/74/2, drop. P2 summary + first
sentence 123/28/1, 128/77/2, drop. P3 party word in a from/for/of
phrase is scope, not target; raise only when the party word is the
verb's object head: 123/29/0, 110/97/0, KEEP. P4 live-noun scan on
summary only 123/28/1, 139/67/1, drop. P5 evidence-locality grading,
confidence only: no change, drop. P6 any write lead verb lowers
POST/PATCH x to w: 2 leaks on CAMARA build, drop. P7 same, restricted
to modify verbs (poc/m0/exp-e25/modify-verbs.json, written from CAMARA
build): 123/29/0, 122/85/0, KEEP. P8 extra POST read verbs
ask/generate/verify: 124/26/2, drop; "Generate a nonce" is truth x and
"Verify the OTP" is truth w, so generate and verify are not read verbs
(second instance of E12's finding). P9 own-resource object heads
derived from CAMARA build: 3 words, first one (assignment) leaks
enterprise-team-organizations/add at high confidence, drop. P10
measurement of confidence: a low-confidence row is 1.3 to 4.5 times
more likely to be a false alarm than a correct call, a high-confidence
row 6 to 16 times more likely to be correct.

(c) Best variant P3+P7, pass2 on: CAMARA build 107 | 33 | 0 | 17 (was
98 | 42 | 0 | 10); test 123 | 29 | 0 | 13 (was 120 | 32); hold-out 1
122 | 85 | 0 | 0 (was 106 | 101); clean exam, scored once, 189 | 31 |
0 | 4 (was 187 | 33). Both negative controls PASS. Zero wrong
loosenings at every confidence on all four sets. Clean-exam rows
changed versus E23: exactly two, both correct,
patch_metadata_taxonomies_id_id and
patch_metadata_taxonomies_id_id_nodes_id, "Update metadata taxonomy"
and "... node", x to w, truth w. Reproduced by the orchestrator.

(d) What we are doing wrong, from the loop. First, the arbiter has no
way to say w about a POST or PATCH: the floor is x and the only exit
was down to r via a read verb, so every "Update the queue", "Modify an
account" is x by construction; 12 of hold-out 1's 101 false alarms and
2 of the clean exam's, all high confidence; P7 fixes them with no
leak. Second, the party rule reads scope as target ("delete an org
secret for an organization" names the container the caller owns); P3
removes 8 CAMARA and 4 hold-out false alarms and adds 7 correct
lowerings. Third, the two judges read different text: the verb-led
judge reads the summary, the word-list judge reads summary,
description, operationId and path, and 45 of the remaining false
alarms are one boilerplate word in a description the human never saw
("access" in GitHub's personal-access-token sentence, "call" and
"message" in Twilio's). Fourth, the description cannot simply be
dropped: two hold-out 1 truth-x rows are held only by that boilerplate
(issues/set-issue-field-values by "access", issues/remove-sub-issue by
the substring collision "start"), so E23's zero on hold-out 1 partly
rests on accidents; P1, P2 and P4 each leak when the description is
narrowed. Fifth, confidence already separates most of what the user
sorted by eye; the E24 dossier was sorted by the destructive flag, not
by confidence, which shuffled signal and noise together.

(e) What a human still sees that the rules cannot: whether the object
is the caller's own paperwork or something another party relies on.
Rows with the tool's own evidence: "Update AI agent" (head=agent
party=agent), "Remove upload session" (nouns=session party=session,
high), "Delete a token for stored payment details" (verbs=pay,
party=token, high), "Create Box Skill cards on file" (create is
consequential regardless of object), "Ask question" (verbs=send from
the description), "Delete an override" (verbs=start, collision).
Learning that distinction from words (P9) leaks on the first word
learned. The distinction is not in the summary's words; it is in what
the resource is, which is in the schema. M1's structural signal
confirmed as the next thing.

(f) Reading, once. Two mechanical defects (no w exit for POST/PATCH;
scope read as target) account for the false alarms a rule can fix
without a leak, about 16 of 101 on hold-out 1 and 2 of 33 on the clean
exam. The rest are the own-versus-shared question, which words do not
carry. Whether P3 and P7 are promoted into rules-verb.mjs and
rules-union.mjs is a decision, not a finding.

### How the E19 union works, in plain words (2026-09-07)

Written for the user at M0 close; the code is poc/m0/rules-union.mjs,
rules-lex.mjs, rules-verb.mjs, rules-pass2.mjs.

Here is the flow, one operation at a time. Think of two judges and a
referee.

**Step 1. The method sets the floor.** GET or HEAD is `r`, locked.
Nothing can raise or lower it. PUT or DELETE starts at `w`. It can go
up to `x`. It can never go below `w`. POST or PATCH starts at `x`.
This one can go down, to `w` or `r`, but only if the text earns it.

**Step 2. Judge A reads word lists.** It scans the summary and
description for stems. Danger words like "revoke", "terminate", "pay"
push toward `x`. Live nouns like "session", "call", "device" push
toward `x`. A hand-checked list of read verbs like "get", "retrieve",
"list" lets a POST drop to `r`.

**Step 3. Judge B reads the sentence.** It takes the first verb.
"Delete" is a write verb. "Get" is a read verb. "Send" or "pay" is a
consequential verb, so `x`. Then it looks at what the verb acts on. It
walks the words after the verb until it hits "by", "for", "of" and so
on. The last word it kept is the object. If that object is a party
word like "user" or "member", the class goes up to `x`. This is where
the 4-word cap was, and is now gone.

**Step 4. The referee picks the tighter answer.** Judge A says `w`,
Judge B says `x`? Answer is `x`. Always the stricter one. Then the
floor from step 1 is applied.

**Step 5. Confidence.** Both judges agree: high. They disagree: low.
Both just fell back to the method floor with no evidence:
method-only.

**Step 6. Pass 2, a second look.** It only looks at Judge A's word
hits. If a danger word looks like a false hit, say "remove" inside
"remove from list", it marks the row low confidence. It never changes
the class. The runner checks that every time and prints the count,
which must be 0.

**What comes out.** One class, one confidence, both judges' rule ids
and evidence, so a human can see why. Then the scorer compares to
ground truth and counts two things apart: wrong loosenings and false
alarms.

**Why the leak still leaks.** "Remove collaboration." Judge A finds no
stem. Judge B sees verb "remove", object "collaboration". Not a party
word. Both land on the floor, `w`. Truth is `x` because the
collaboration is another person's access. Only the schema knows that.
That is M1.

## M1 — the informed arbiter (2026-09-07)

### M1-C1 — field census over the 719 operations (2026-09-07)

**(a) What.** Read-only census over every labelled operation (CAMARA
292, hold-out 1 207, clean exam 220; 0 unresolved; six vendor specs
SHA-matched) of the machine-facing OpenAPI fields M1 proposes to read:
per-operation security and scopes, requestBody and its property names,
response codes (202), callbacks, document webhooks, Idempotency-Key
header parameter, party-id parameters, x- extensions, and the resource
schema reachable from the path's GET. Files
`docs/logs/m1/census-summary.md`, `docs/logs/m1/census-ops.csv`,
script `poc/m1/census/`.

**(b) Presence per set.** Count of ops with the field, CAMARA / hold-out
1 / clean exam: security on the operation 285 of 292 / 94 of 207 / 27
of 220; non-empty scopes 282 / 0 / 0; requestBody 152 / 121 / 103;
requestBody with a party or money property name 54 / 27 / 28; 202
response 47 / 5 / 2; callbacks on the operation 42 / 0 / 0; webhooks in
the document 0 / 81 / 0; Idempotency-Key parameter 0 / 0 / 22 (all
Adyen); party-id parameter 1 / 116 / 12; x- extensions 0 / 87 / 205;
resource schema found 159 / 176 / 168; resource schema with a party
field 55 / 71 / 63.

**(c) Split by truth class** over all 719 (r 259, w 254, x 206):
requestBody present r 26% / w 49% / x 89%; requestBody party-or-money
property r 10% / w 5% / x 34%; 202 r 1% / w 9% / x 15%; callbacks r
1% / w 0% / x 19% (CAMARA only: x 39 of 86, w 0 of 51); Idempotency-Key
r 2% / w 0% / x 8% (clean exam: x 17 of 53, w 0 of 63); resource schema
party field r 24% / w 37% / x 17%, i.e. it leans the wrong way as a
raiser; party-id parameter on hold-out 1 w 46% / x 76%.

**(d) Scopes.** Only CAMARA declares OAuth scopes per operation
(96.6%). GitHub's spec has no securitySchemes at all; Box, PagerDuty,
Adyen, Stripe, Twilio declare none per operation. But PagerDuty carries
a per-operation scope in an extension, `x-pd-requires-scope` (78 of 93
PagerDuty ops, values such as `tags.read`, `tags.write`), and GitHub's
`x-github` carries category and app-enablement flags (81 of 81 GitHub
ops), not permissions. So "scopes" is present in two of six vendors and
under two different names.

**(e) Request-body property names with a clean lean,** over all 719:
sink 34 (x 30), sinkCredential 33 (x 28), StatusCallback 16 (x 14),
protocol 14 (x 14), types 14 (x 14), amount 12 (x 10), merchantAccount
18 (x 13), subscriptionRequest 9 (x 9); against device 37 (r 28),
phoneNumber 28 (r 19), FriendlyName 31 (w 15 / x 16), name 16 (w 6 /
x 7), description 11 (w 6 / x 5). A callback-shaped body (sink,
StatusCallback, protocol, types) is nearly pure x; identity-shaped
names (name, description, FriendlyName) do not separate w from x.

**(f) Reading, once,** against the user's criterion "present
consistently or almost always". Fields that pass per set: CAMARA scopes
and security; clean-exam x- extensions (Box tags, PagerDuty scopes);
resource schema in hold-out 1 (85%) and the clean exam (76%).
requestBody is present on about half of all ops but on 89% of x ops, so
its absence leans r/w and its presence with a callback- or money-shaped
property is a strong raiser. Callbacks, 202 and Idempotency-Key are
rare (6%, 8%, 3%) and, where present, nearly pure x with zero w rows,
which is the right shape for a raise-only rule and the wrong shape for
anything else. No field is present in 90%+ of ops across all three
sets; every structural rule must therefore be admitted per vendor or
per set and may only raise on presence, never lower on absence, exactly
as the PRD's M1 text states.

### M1-C2 — scopes per method, CAMARA POST scope verb vs truth (2026-09-07)

Scope presence per method in CAMARA (from docs/logs/m1/census-ops.csv):
POST 132/138, GET 93/96, PUT 8/8, DELETE 40/41, PATCH 9/9. Hold-out 1
and the clean exam: 0 scopes on every method. So scope is dominant
(≥90% per method) in CAMARA only.

On CAMARA POST, the last token of the first scope against the truth
class:

| scope verb | r | w | x |
|---|---|---|---|
| create | 0 | 0 | 37 |
| read / retrieve / check / verify | 46 | 0 | 3 |
| write | 0 | 1 | 10 |
| (none) | 3 | 1 | 2 |

The three `read`-scoped truth-x rows: postServiceCapability (`POST
/retrieve`, body has `subscriptionRequest`), scheduleTransmission
(carries both `:read` and `:write` scopes), queryAssistant (`POST
/answer`, `answer:read`, body `assistantId|prompt`, nothing raising).
Two of three are held by "never lower when a raiser is present";
queryAssistant is not.

What it taught: scope is the strongest single field seen so far, but
only where it is dominant. The read-named-POST problem (57 of 138 in
M0) is mostly answered by scope inside CAMARA. Outside CAMARA it does
not exist. Fed into D30 rule 4.

### M1-C3 — APIs.guru corpus leans by method co-occurrence (2026-09-07)

Source: APIs.guru v2 index, 2529 entries, fetched live 2026-09-07 in 40s;
2518 ok, 11 skipped over 8 MB, 0 failed, 0 parse failures. Six hold-out
vendors excluded by provider prefix (twilio.com, stripe.com, github.com,
box.com, pagerduty.com, adyen.com): 77 index keys and 10,315 operations
removed. Counted: 2435 APIs, 71,829 operations, 667 providers. Top three
by share: amazonaws.com 18.4%, azure.com 11.3%, googleapis.com 8.2%.
Scripts poc/m1/corpus/{fetch,extract,leans}.mjs; full table in scratch,
repo copy docs/logs/m1/corpus-leans.csv cut to providers >= 3 (3,688 rows
of 17,429); readout docs/logs/m1/corpus-summary.md. The orchestrator
re-ran leans.mjs and reproduced the row count and the create row.

Counts are per (token, position) with position = lead (first operationId
token), opid (any operationId token), path (any path-segment token),
each method counted raw and once per provider so Azure's 653 APIs cannot
dominate.

Per-provider method shares at lead position for the verbs M1 cares about
(G/PO/PU/PA/D, providers):

| token | providers | GET | POST | PUT | PATCH | DELETE |
|---|---|---|---|---|---|---|
| get | 377 | 369 | 70 | 2 | 0 | 0 |
| retrieve | 49 | 46 | 4 | 0 | 0 | 0 |
| list | 136 | 131 | 16 | 3 | 0 | 2 |
| search | 93 | 78 | 24 | 0 | 0 | 0 |
| create | 213 | 11 | 209 | 19 | 1 | 0 |
| delete | 217 | 4 | 29 | 2 | 0 | 205 |
| update | 188 | 3 | 62 | 138 | 57 | 1 |
| send | 49 | 6 | 45 | 5 | 0 | 1 |
| verify | 30 | 7 | 23 | 4 | 0 | 0 |
| validate | 28 | 11 | 20 | 0 | 0 | 0 |
| generate | 43 | 16 | 34 | 0 | 0 | 0 |
| check | 43 | 20 | 25 | 0 | 1 | 0 |
| query | 22 | 13 | 12 | 1 | 1 | 1 |
| cancel | 49 | 2 | 28 | 7 | 3 | 19 |
| confirm | 15 | 2 | 11 | 1 | 1 | 1 |
| submit | 18 | 0 | 16 | 2 | 1 | 0 |
| subscribe | 11 | 1 | 9 | 2 | 0 | 0 |
| reboot | 3 | 0 | 3 | 1 | 0 | 0 |
| terminate | 3 | 0 | 2 | 1 | 0 | 0 |
| pay | 1 | 0 | 1 | 0 | 0 | 0 |
| ask | 0 | absent | | | | |
| answer | 0 | absent | | | | |

Tokens at 90%+ GET (26): retrieve, status, health, current, balance,
latest, browse and thin ones. At 90%+ POST (31): post, register, publish,
invite, execute, authenticate, detect, clone, approve, grant, refund,
buy, install, launch, lookup, classify. Split with no method above 60%
(257): update, set, cancel, check, change, export, stop, query, test,
revoke, modify, replace, edit, accept, schedule, rename.

What it taught:
1. The corpus tells which method a verb rides, not what it does. create
rides POST 95%, delete rides DELETE 97%, retrieve rides GET 92%. That is
a prior in the direction of the method's class, no more.
2. A POST lean is not an x lean. lookup, classify, detect, search-on-POST
are read-shaped and ride POST. The next pass must route a verb's method
lean through the method prior (GET locked r, POST no lean) and not map
POST straight to x. Verb leans that separate r from x within POST must
come from elsewhere: scope where dominant (M1-C2), body shape, and the
CAMARA rows as one signal (D30 rule 5).
3. ask and answer do not exist in the corpus, and pay, reboot, terminate
are at or under 3 providers. The corpus cannot cover the user's "ask"
case by itself. That is a stated gap for the arbiter pass, not a reason
to hand-list.
4. check, query, cancel, verify, validate, generate are split in the
wild. The corpus agrees with E25: generate and verify are not read
verbs, and check/query are not either without more evidence.
5. Tokenizer leaks stopword-shaped lead tokens (a, are, see) from the
summary fallback; harmless at providers >= 3 but to be filtered in the
arbiter pass.

### M1-C4 — first weighted arbiter, primaries only (2026-09-07)

Shape: poc/m1/arbiter/{arbiter.mjs,run.mjs,arbiter.test.mjs} (15 tests).
Inputs are docs/logs/m1/census-ops.csv and corpus-leans.csv only. Layers:
(1) method prior, GET locked r, PUT/DELETE start w, POST/PATCH start x;
(2) scope last-token as a class hint relative to the prior (read family
hint r, {update, write, delete, modify, set} hint w, all else hint x;
below prior lowers with weight r 1.0 / w 0.6, equal agrees, above raises
1.0); (3) corpus lead-verb lean routed through the prior (on POST/PATCH,
GET share >= 0.75 lowers to r, PUT+PATCH share >= 0.5 lowers to w, weight
share x min(1, providers/10)); (4) CAMARA lead-verb table,
leave-one-repo-out on CAMARA, whole on the hold-outs (share >= 0.9 at n
>= 3: r lowers 0.8, w lowers 0.6, x raises 0.8). Any raise blocks
lowering and lands on x (first draft kept PUT/DELETE at w on a raise,
which made zero leaks unreachable on CAMARA; the agent escalated, the
rule was corrected). Below threshold T the row keeps the prior and is
tagged review.

Sweep (n / assigned / review / leaks among assigned / over-tight among
assigned):

| T | CAMARA 292 | hold-out 1 207 | clean exam 220 |
|---|---|---|---|
| 0.5 | 218 / 74 / 18 / 4 | 62 / 145 / 9 / 1 | 160 / 60 / 0 / 12 |
| 0.75 | 201 / 91 / 4 / 4 | 35 / 172 / 0 / 1 | 160 / 60 / 0 / 12 |
| 1.0 | 197 / 95 / 4 / 4 | 35 / 172 / 0 / 1 | 157 / 63 / 0 / 12 |
| 1.5 | 185 / 107 / 2 / 4 | 35 / 172 / 0 / 1 | 157 / 63 / 0 / 12 |
| 2.0 | 159 / 133 / 0 / 4 | 35 / 172 / 0 / 1 | 155 / 65 / 0 / 12 |

T = 2.0 chosen on CAMARA + hold-out 1 (only T with zero leaks on both);
clean exam scored once at T = 2.0: 0 leaks, 12 over-tight, 65 review.
Against D30: rule 1 met at T = 2.0; rule 2 far from met (review +
over-tight 137/292, 173/207, 77/220); rule 3 not met (see the false
flags). Outputs docs/logs/m1/c4-rows.csv, c4-false-flags.csv,
c4-sweep.md.

Negative controls at T = 2.0: terminateCall (DELETE) and
updateSessionStatus (PUT) both land at w, review, confidence 0: their
scope tokens delete/write agree with the prior, nothing raises. Not
leaks, not right. queryAssistant: read scope lowers to r at weight 1.0,
below T, so it stays x in review.

What it taught:
1. Why T had to be 2.0: the leaks below it are almost all one shape. A
`:write` or `:delete` scope on POST was given hint w (weight 0.6) and
lowered truth-x rows: registerApplicationEndpoints, submitApp,
activatePowerSaving, sendSessionMetrics, postTrafficInfluence,
deleteEsimProfile, releaseDevice, releaseDevices,
extendQosSessionDuration and more. M1-C2 had already measured write on
CAMARA POST as 10 x to 1 w. The write-family scope must never lower on
POST; it can only agree with PUT/PATCH/DELETE. This brief ignored its
own census. Fix in C5.
2. The corpus w-lean on PATCH (update, patch, configure at PUT+PATCH
share 0.75-0.93) lowered three truth-x rows: updateDevice,
updateRebootRequest, patchTrafficInfluence, plus configureAlerts on
POST. A verb that rides PATCH in the wild says "update", not "own". The
w-lowering from the corpus needs pairing with an own-resource signal or
a higher bar; measure in C5.
3. Read scope lowering leaks three rows at low T: postServiceCapability
(body subscriptionRequest, the body layer is not in C4),
scheduleTransmission (read and write scopes together; with fix 1 the
write no longer lowers, so the read alone would lower it; two scopes
with different hints must cancel), queryAssistant (the known gap).
4. Method-word lead tokens are a defect: Box `post_...` and Adyen
`post-...` operationIds put "post" into the CAMARA verb table, which
raises; 8 of 12 clean-exam over-tights, all truth r (Adyen cardDetails,
paymentMethods, originKeys, Box ai/ask, ai/text_gen). Method names must
be stripped before the verb lookup.
5. Unknown scope tokens that are nouns (reboot, trust-domains, devices
in NetworkAccessManagement) raise to x and produce all 4 CAMARA
over-tights, e.g. deleteRebootRequest truth w. An unknown token is
absence of knowledge, not evidence; it should leave the prior in place
(still fail-closed, the row goes to review).
6. Hold-out 1 sits at 172 of 207 in review because it has no scopes and
PUT/DELETE get no lowering. The method prior alone cannot assign
PUT/DELETE: 18 of 113 hold-out-1 DELETEs and 6 of 32 PUTs are truth x.
The own-vs-other layer (body, path party id, schema) is what those rows
wait for; that is C6 or later, secondary per D30.
7. Truth check surfaced: Box post_ai_ask is labelled r, CAMARA
queryAssistant (same ask-an-assistant shape) is labelled x. One of the
two labels should move; the user rules.

### M1-C5 — five mechanical fixes, truth fix for queryAssistant (2026-09-07)

Truth fix first (user ruling 2026-09-07, D31): CAMARA queryAssistant
(ModelAsAService POST /answer) x -> r; asking an assistant reads back an
answer and reaches no one, the same shape Box post_ai_ask carries as r
in the clean exam. CAMARA is now r 156, w 51, x 85. Edited in
data/camara-2026-09-01/ground-truth.csv and docs/logs/m1/census-ops.csv;
census run.mjs regenerates the CSV identically. Stale copies of the old
label remain in operations.csv, operations_raw.csv,
ground-truth-as-read.csv and camara-2026-09-01-op-test.csv (not read by
any live script) and in M0 logs (history, left as is).

Fixes in poc/m1/arbiter/ (26 tests, each fix with a test that fails
without it): (1) write-family scope tokens {update, write, delete,
modify, set} never lower on POST/PATCH, only agree on PUT/PATCH/DELETE;
(2) conflicting scope hints cancel the lowering, a raise still raises;
(3) a lead token equal to the row's own HTTP method is stripped only
when followed by a separator (post_ai_ask -> ai, post-cardDetails ->
card; deleteDevice keeps delete) — touches 0 CAMARA, 0 hold-out 1, 127
clean-exam rows; the first literal reading stripped 94 CAMARA rows and
was corrected before anything was logged; (4) unknown scope tokens give
no evidence; the only x-hint tokens are {create, send, subscribe,
register, invoke, call, dial, pay, transfer, notify}; (5) the corpus
w-lean on PATCH/POST is a switch, run on and off.

Sweep, corpus w-lean on (assigned / review / leaks / over-tight):

| T | CAMARA 292 | hold-out 1 207 | clean exam 220 |
|---|---|---|---|
| 0.5 | 200 / 92 / 4 / 1 | 62 / 145 / 9 / 1 | 110 / 110 / 0 / 1 |
| 0.75 | 192 / 100 / 2 / 1 | 35 / 172 / 0 / 1 | 110 / 110 / 0 / 1 |
| 1.0 | 187 / 105 / 1 / 1 | 35 / 172 / 0 / 1 | 110 / 110 / 0 / 1 |
| 1.25 | 179 / 113 / 0 / 1 | 35 / 172 / 0 / 1 | 110 / 110 / 0 / 1 |
| 2.0 | 155 / 137 / 0 / 1 | 35 / 172 / 0 / 1 | 108 / 112 / 0 / 1 |

Switch off is identical from T = 0.75 up; at 0.5 off is better on
hold-out 1 (9 leaks -> 0). Chosen on CAMARA + hold-out 1: on, T = 1.25,
the first zero-leak setting; review + over-tight 114/292 and 173/207.
Clean exam scored once: 0 leaks, 1 over-tight, 110 review. Against D30:
rule 1 met; rule 2 not met; rule 3 met for the first time — the three
false flags are all create-led POSTs on own resources (createTrustDomain,
CreateMessageFeedback, createAutomationActionTeamAssociation) raised by
the CAMARA verb table's create -> x share of 0.97, a reasonable
confusion, not a plain-word miss. Outputs docs/logs/m1/c5-rows.csv,
c5-false-flags.csv, c5-sweep.md.

Negative controls: terminateCall and updateSessionStatus still land w
in review with confidence 0; their scopes agree with the method and
nothing else speaks. queryAssistant (now r): read scope lowers at
weight 1.0, under T, so it sits at x in review.

What it taught:
1. C4 -> C5 moved CAMARA over-tight 4 -> 1 and the clean exam 12 -> 1
with zero leaks kept, at a lower threshold (2.0 -> 1.25). The five
fixes were all mechanical and all visible in the C4 false-flag file;
the gate's rule 3 is how they were found.
2. What is left in review is now honest absence of evidence, not noise.
Hold-out 1: 145 of its 172 review rows are PUT/DELETE with no evidence
at all (121 truth w, 24 truth x). Clean exam: 33 POST truth-x rows with
no evidence. These wait for the own-vs-other and body layers (secondary
per D30), not for more verb work.
3. T = 1.25 instead of 1.0 is held by a single row: postServiceCapability,
read scope plus a subscriptionRequest body. At T = 1.0 CAMARA review
drops 113 -> 105 with that one leak. A body raiser (subscriptionRequest,
sink, StatusCallback, amount — all near-pure x in M1-C1) would hold it
and let T fall.
4. On POST the prior is a floor, not a lean, so a scope that "agrees"
with x (create, 37 of 37 x in M1-C2) or a write-family scope (10 x to 1
w) is evidence for x, not silence. C5 treats both as no evidence and
leaves 15 CAMARA truth-x POSTs in review. C6 should let x-hint and
write-family scopes on POST/PATCH count as a raise.
5. The corpus w-lean is inert above T = 0.75: it never decides a row at
the chosen setting. Keep the switch, do not build on it.

### M1-C6 — body raisers, scope raises on POST, own-vs-other measured (2026-09-07)

Three layers added to poc/m1/arbiter/ (40 tests). Every list is derived from CAMARA + hold-out 1 rows in census-ops.csv at n >= 5 and truth-x share >= 0.9, leave-one-repo-out, never from the clean exam; the full admitted and rejected tables are in docs/logs/m1/c6-admitted.md.

Layer 2b, scope on POST/PATCH as a raise, measured per method: write-family on POST n 16 share 0.938 admitted; write-family on PATCH n 5 share 0.200 not admitted; x-hint on POST n 39 share 1.000 admitted; x-hint on PATCH n 0. A first pooled measurement over POST+PATCH gave 0.762 and was wrongly admitted because the brief forgot the bar for this one layer; it raised four truth-w PATCH updates and was corrected before logging.

Layer 5, body raisers admitted: protocol (14, 1.00), types (14, 1.00), subscriptionRequest (9, 1.00), devices (6, 1.00), PhoneNumber (5, 1.00), config (15, 0.93); flag callbacks_present (42, 0.929). Just under the bar: sink (34, 0.882), sinkCredential (33, 0.848), StatusCallback (16, 0.875). Rejected as expected: FriendlyName (31, 0.52), name (12, 0.50), description (6, 0.50), has202 (52, 0.56). Inadmissible: amount, merchantAccount, Idempotency-Key exist only in the clean exam (Adyen).

Layer 6, own-vs-other on PUT/DELETE/PATCH (203 rows): nothing admitted. party_id_param 0.161, resource_schema_party_field 0.161; no path parameter, body property or schema property reaches 0.9. Twilio's AccountSid sits in every path, so "a party id is present" is not "another party".

Sweep, corpus w-lean on (assigned / review / leaks / over-tight):

| T | CAMARA 292 | hold-out 1 207 | clean exam 220 |
|---|---|---|---|
| 0.5 | 229 / 63 / 2 / 6 | 62 / 145 / 9 / 1 | 110 / 110 / 0 / 1 |
| 0.75 | 221 / 71 / 0 / 6 | 35 / 172 / 0 / 1 | 110 / 110 / 0 / 1 |
| 1.0 | 217 / 75 / 0 / 6 | 35 / 172 / 0 / 1 | 110 / 110 / 0 / 1 |
| 1.25 | 211 / 81 / 0 / 6 | 35 / 172 / 0 / 1 | 110 / 110 / 0 / 1 |
| 2.0 | 187 / 105 / 0 / 6 | 35 / 172 / 0 / 1 | 108 / 112 / 0 / 1 |

Chosen on CAMARA + hold-out 1: on, T = 0.75; review + over-tight 77/292 (26%) and 173/207 (84%). Clean exam once: 0 leaks, 1 over-tight, 110 review (50%). Outputs c6-rows.csv, c6-false-flags.csv, c6-sweep.md, c6-admitted.md.

Negative controls unchanged: terminateCall and updateSessionStatus at w, review, confidence 0. queryAssistant assigned r, confidence 1.

The eight false flags, all over-tight: cancelPayment (write scope on POST, share 1.0); createTrustDomain, CreateMessageFeedback, createAutomationActionTeamAssociation (create in the CAMARA verb table, 0.97); retrievePopulationDensity, retrieveConnectivity, count (truth r, raised by callbacks_present at 0.951 — CAMARA's poll-then-callback reads); updateNotificationChannelSubscription (PUT, body prop config, 1.0).

What it taught:
1. CAMARA moved: extra asks 114 -> 77, threshold 1.25 -> 0.75, zero leaks kept. Scope raises on POST and the body raisers did it. Over-tight rose 1 -> 6; the six are stated above and are all rule-3 confusions, three of them a truth question (is a read delivered by callback r?) for the user.
2. Hold-out 1 did not move at all (173 both passes) and the clean exam barely (112 -> 111). Everything in those sets waits on PUT/DELETE with no evidence (hold-out 1: 145 rows, 121 w, 24 x; clean exam: 56) and on scope-less POST (clean exam: 33 truth-x POSTs with no evidence).
3. Own-vs-other is not in the structural fields at the 0.9 bar. This closes the M0 hope (E24, D28) that "the schema points at a person" could be a raiser as written. It also means the two negative controls cannot be reached by any machine-facing field admitted so far.
4. The 0.9 bar found a wrong admission twice today (fix 3 in C5, layer 2b here). Keep it uniform; a layer without the bar is how leaks return.
5. Adyen's money and idempotency fields cannot be admitted by this method because they exist in no tuning set. A vendor-specific field can only enter when a tuning set carries it (D30 rule 4).

### M1-C7 — the poll-then-callback ruling: callbacks_present does not raise a read verb (2026-09-07)

One rule change on top of C6 (D32, the user's ruling): the layer-5 `callbacks_present` raise no longer fires when the operation's lead verb is a read. "Read" is decided mechanically, no hand list — either (a) the row's own security_scopes carry a token in the existing read family (read, retrieve, check, verify, match, query, count, assess), or (b) the lead verb (after C5's method-word stripping) has, at lead position in `docs/logs/m1/corpus-leans.csv`, a per-provider GET share >= 0.75 with providers >= 3. Either path records `flag:callbacks_present-suppressed:read-verb`; the check only runs once the raise would otherwise have fired, so the marker never appears on a row that had no raise to suppress. Everything else in the C6 arbiter is untouched. Four tests added (44 total): the suppression firing on a read-scope + callbacks row, a create-scope + callbacks row still raising, a no-read-signal callbacks row still raising, and `isReadVerbForRow`'s own bar (providers >= 3 alone is not enough without the GET-share bar, and vice versa).

Re-swept T x corpus-w-lean, re-chosen on CAMARA + hold-out 1 only, hold-out 2 scored once — outputs `c7-rows.csv`, `c7-false-flags.csv`, `c7-sweep.md` (the C6 admitted lists are untouched, so `c6-admitted.md` still applies and was not renamed):

| T | CAMARA 292 | hold-out 1 207 | clean exam 220 |
|---|---|---|---|
| 0.5 | 229 / 63 / 2 / 3 | 62 / 145 / 9 / 1 | 110 / 110 / 0 / 1 |
| 0.75 | 221 / 71 / 0 / 3 | 35 / 172 / 0 / 1 | 110 / 110 / 0 / 1 |
| 1.0 | 217 / 75 / 0 / 3 | 35 / 172 / 0 / 1 | 110 / 110 / 0 / 1 |
| 1.25 | 210 / 82 / 0 / 3 | 35 / 172 / 0 / 1 | 110 / 110 / 0 / 1 |
| 2.0 | 186 / 106 / 0 / 3 | 35 / 172 / 0 / 1 | 108 / 112 / 0 / 1 |

Chosen on CAMARA + hold-out 1 (unchanged from C6): corpus w-lean on, T = 0.75; review + over-tight 74/292 (25%) and 173/207 (84%), combined 247 (down from C6's 250). Clean exam once: 0 leaks, 1 over-tight, 110 review (50%) — hold-out 2 has no CAMARA-shaped poll-then-callback rows, so it does not move.

Negative controls unchanged: terminateCall and updateSessionStatus at w, review, confidence 0 — still open, not this checkpoint's question. queryAssistant unchanged: assigned r, confidence 1.

Five false flags remain, all over-tight, all unrelated to callbacks: cancelPayment (write scope on POST, share 1.0); createTrustDomain, CreateMessageFeedback, createAutomationActionTeamAssociation (create in the CAMARA verb table, 0.97-1.0); updateNotificationChannelSubscription (PUT, body prop config, 1.0).

Rows that changed status or class versus c6-rows.csv: exactly three, all camara, all POST, all gt=r, all over-tight->exact — retrievePopulationDensity and retrieveConnectivity (x -> r, evidence now carries `scope:read->lower:r`, `corpus:retrieve->lower:r:shareGet=0.920`, `verbtable:retrieve->lower:r:shareR=1.000`, and the suppression marker) and count (x -> r, evidence `scope:count->lower:r` plus the suppression marker). No other row's class or status moved; the fix removed exactly the three false flags C6 named for this question and nothing else.

What it taught:
1. The rule is narrow by design: it only reaches rows that already carry independent read evidence strong enough to win the aggregate once the callbacks raise is out of the way (scope, corpus lean, or the CAMARA verb table). A callbacks-present row with no other read signal still raises, by construction (tested directly).
2. The suppression is CAMARA-only in practice this pass — no hold-out-1 or hold-out-2 row both carries an admitted callbacks_present raise and clears either read test. The poll-then-callback shape measured here is a CAMARA idiom, not (yet) evidenced elsewhere.
3. Recording the marker only after confirming the raise would have fired keeps the evidence trail honest — it never claims to have suppressed something that was never going to happen (e.g. a row excluded down below n>=5 by leave-one-repo-out).

### M1-C8 — prose as the last layer, raise-only (2026-09-07)

Text extracted for all 719 rows into docs/logs/m1/ops-text.csv (poc/m1/arbiter/extract-text.mjs): summary on 702, description on 698, neither on 16 (all Twilio). Hold-out text was read from each hold-out's operations.csv, which carries the same summary/description the spec does; the blind readers never saw those columns. Layer 7 (poc/m1/arbiter/arbiter.mjs, switch wordsOn; driver run-c8.mjs; 51 tests): tokens from summary + description, tokens in more than 40% of CAMARA + hold-out 1 rows dropped (only "the" and "for"), admitted at n >= 5 and truth-x share >= 0.9, leave-one-repo-out, raise-only.

Admitted: assign (5, 1.00), intents (5, 1.00), removed (5, 1.00). Closest misses: create (68, 0.75), new (47, 0.81). Sweep unchanged on CAMARA and hold-out 1 at every T from 0.75 up (74/292 and 173/207 at T = 0.75, zero leaks); the three words never land on a CAMARA or hold-out 1 row that lacked other evidence. Clean exam once: 4 rows changed, three Box POSTs assigned x correctly (policy and task assignments), one new over-tight (PagerDuty deleteServiceNowTable, truth w, word "removed"). Six false flags total. Negative controls unchanged. Outputs c8-rows.csv, c8-false-flags.csv, c8-sweep.md, c8-admitted.md.

Computed but not wired, the same table for truth-w share: secret (11, 1.00), secrets (10, 1.00), adds (6, 1.00), applied (6, 1.00), environment (6, 1.00), replaces (5, 1.00), updated (5, 1.00), deletes (37, 0.946), personal (42, 0.905), tokens (42, 0.905).

What it taught:
1. Prose as a raise-only layer at the bar is nearly empty: three words at the n = 5 floor, no movement on the tuning sets. The x-words are already caught by the machine fields.
2. Prose does carry the own-vs-other signal the structural fields did not (M1-C6): "deletes" at 0.946 over 37 rows and "personal"/"tokens" at 0.905 say "own". Raise-only cannot use that; a judge that may assign w on the residual can.
3. The user's reading of the review pile (2026-09-07): pass 1 should be the machine fields with the confidence sum, and the verb, noun and words should be a second pass that runs only on what pass 1 hands over, assigning in both directions at the bar, zero leaks on CAMARA + hold-out 1 as the wall. On the residual PUT/DELETE rows the lead verb alone gives delete about 120 w / 13 x, update 24 w / 1 x, and terminate/revoke/cancel/convert/merge/start 0 w / 8 x; the 13 delete-led x rows are separated by the noun (access, network, device, collaboration, membership, member). That is M1-C9.

### M1-C9 — the two-pass shape: confidence pass, then a verb-and-noun judge on the residual (2026-09-07/08)

Shape (poc/m1/arbiter/judge.mjs, run-c9.mjs, judge.test.mjs; 97 tests): pass 1 is the C7 arbiter unchanged (T = 0.75). Pass 2 runs only on the rows pass 1 leaves in review. It reads the lead verb (operationId, or the summary's first word for the live set), the head noun of the summary's object phrase (last word before a preposition, stepping back over generic tails such as information, record, status), the operationId's head noun the same way, and three lists written by the orchestrator from reading the residual pile: LIVE_VERBS (terminate, kick, cancel, revoke, convert, merge, start, reboot, dial, ...), OWN_VERBS (delete, remove, update, set, add, enable, disable, ...), PARTY_NOUNS (member, membership, collaborator, collaboration, customer, account, user, role, team, group, installation, token, access, restriction, participant, call, session, device, network, ...). Rules in order: R1 live verb -> x; R2 own verb with a party head noun -> x; R3 own verb with a thing as head noun on PUT/PATCH/DELETE -> w; R4 the same on POST -> w; else review. Every rule and every extractor source is a switch; a rule that leaks on CAMARA + hold-out 1 is not admitted; switches are chosen by zero leaks first, then the lower review + over-tight on CAMARA + hold-out 1. The clean exam is scored once.

Rounds: round 1 (verb from operationId only, no session/device/network, no generic-tail step) admitted R1 and R2, rejected R3 on 7 leaks and R4 on 45; updateSessionStatus stayed w. Round 2 added the summary as a verb source for R1, the generic-tail step, and session/device/network to the nouns: R3 down to 1 leak (updateRebootRequest). Round 3 replaced "any operationId token" by the operationId head noun, made the path party id a switch, and let a live verb fire from any operationId token: R3 at zero leaks, admitted. Path party id chosen OFF on cost (139 vs 142): with R3 admitted, Stripe's {customer} rows land w correctly via the head noun ("customer source"), and the path id only turned them into over-tights. R4 stays rejected: enable/disable/setFallback eSIM profile and Twilio UpdateConference are truth x with an own-shaped sentence; POST cannot be given w by the verb.

Final, admitted rules R1 + R2 + R3, pass 1 + pass 2 (assigned / review / leaks / over-tight):

| floor | CAMARA 292 | hold-out 1 207 | clean exam 220 |
|---|---|---|---|
| off | 279 / 13 / 0 / 14 | 107 / 100 / 0 / 12 | 150 / 70 / 0 / 3 |
| on | 292 / 0 / 0 / 20 | 129 / 78 / 0 / 28 | 193 / 27 / 0 / 20 |

Floor = a residual POST/PATCH is assigned x with confidence 0 and evidence "floor" instead of review; never leaks; the user has not yet ruled on it. Negative controls: terminateCall x by R1 (live verb terminate), updateSessionStatus x by R2 (operationId head noun session). queryAssistant r in pass 1. Zero leaks on every set in both floor states. Outputs c9-rows.csv (columns pass and rule added), c9-false-flags.csv, c9-sweep.md, c9-judge-misses.md.

Over-tights at floor on: CAMARA 20 (floor on four read POSTs KYC_Match, KYC_Fill-in, matchIdentifier, profileList and five w PATCH/POSTs; R2 on QoS deleteSession x2, trust-domain device, MultiPointVPN network; R1 on "Terminate an Application Instance/Deployment" and revokeQosAssignment); hold-out 1 28 (16 Twilio Update* POSTs by the floor, 7 R2 party hits such as "Delete a person", "Delete a Call record"); clean exam 20 (floor). These are the E24 arguable rows and the Twilio POST-as-update habit; none is a plain-word miss.

What is left in review at floor on: hold-out 1 78 rows, GitHub 74 of them; clean exam 27, Box 26. Both vendors name operations group-first ("actions/delete-org-secret", "put_files_id"), so the lead token is not a verb and the judge answers "don't know" while the summary says "Delete an organization secret". The judge's verb for R2/R3 must also come from the summary's first word, as R1 already does. That is M1-C10.

### M1-C10 — the judge's verb from the summary; caller phrases; repository (2026-09-08)

Three switches added to poc/m1/arbiter/judge.mjs, driver run-c10.mjs, outputs c10-rows.csv, c10-false-flags.csv, c10-sweep.md, c10-judge-misses.md; 104 tests. (1) summaryVerbOn: when the operationId lead token is not a known verb (GitHub "actions/delete-org-secret", Box "put_files_id"), R2/R3 take the summary's first word. (2) Caller phrases in the summary ("for the authenticated user", "your account", ...) suppress R2's party-noun branch; correctly wired, zero effect on this corpus because every such row also hits the operationId head noun "user". (3) repoNounOn: "repository" as a party noun (a GitHub repository is shared with collaborators).

Measured by the cost rule with the zero-leak wall on CAMARA + hold-out 1: summaryVerbOn on gives R3 95 hits, 92 exact, 3 leaks on hold-out 1, so R3 is rejected under it and the state is strictly worse (cost 211 vs 139); chosen off. repoNounOn measured alone is a tie (139/139), chosen off; measured jointly with summaryVerbOn it would remove the repos/delete leak, which the driver's one-at-a-time order did not see. Final real configuration is therefore unchanged from C9: zero leaks everywhere; floor on: 292/0/0/20, 129/78/0/28, 193/27/0/20 (assigned / review / leaks / over-tight).

The three rows that hold the summary verb back, all GitHub, all truth x, all read as own work by the judge: repos/delete "Delete a repository" (a shared object; the repository noun covers it), issues/set-issue-field-values "Set issue field values for an issue", issues/remove-sub-issue "Remove sub-issue". The last two are candidates for the user's truth re-read.

Hypothetical, pending that re-read, not used for any decision: summaryVerbOn on with those three rows excluded from the leak count, floor on: CAMARA 292/0/0/20, hold-out 1 207/0/0/48, clean exam 219/1/0/22. That is every set fully assigned at zero leaks with extra asks 7%, 23%, 10%.

What it taught:
1. The judge's verb from the summary is the right cure for group-first naming (GitHub, Box): 92 of 95 hold-out 1 rows it reaches are exact. It is held back by three truth rows, not by the idea.
2. Switches interact; the driver must measure a candidate pair jointly when one only pays off with the other (repository + summary verb). Recorded, not fixed here.
3. The caller phrase is redundant with the operationId head noun on GitHub; it stays as a guard.
4. With the summary verb and the re-read, M1's shape would meet D30 rule 2 on CAMARA and the clean exam and come within reach on hold-out 1; without them CAMARA alone meets it. Either way the shape is stable and the findings entry can be written.

What it taught:
1. The two-pass shape works where the one-sum shape did not: CAMARA goes from 74 extra asks (C7) to 20 with zero leaks; hold-out 1 from 173 to 106 (floor on), clean exam from 111 to 47. Both negative controls are x for the first time since M0 began.
2. The judge's lists were written by reading the pile, then measured. Two rounds of extractor fixes (summary as verb source, head noun with generic tails, operationId head noun) were the difference between R3 leaking and R3 clean; the lists themselves did not change after round 2 except session/device/network.
3. Cost, not leaks alone, must choose a switch. Path party id was zero-leak both ways and still wrong to turn on.
4. The verb cannot give w on POST (R4 rejected twice). A POST that reads like an own-update is x often enough that only the machine fields or the floor may speak there.
5. Vendor naming habits (GitHub group/verb, Box method_noun) are the last structural wall; the summary is the cure, not a vendor list.

### Next

M0 closed 2026-09-07 as exploratory at the user's word (D29). Twenty-
five experiments, three blind-read sets, 719 labels. The result that
stands is the ceiling: prose-only rules reach zero wrong loosenings on
every set at roughly 30 over-tightenings per 200 operations, and the
false alarms that remain are the own-versus-shared question, which
words do not carry. The arbiter is archived under `poc/m0/` (see
`poc/m0/ARCHIVED.md`), not promoted. M1 starts fresh in `poc/m1/` as
an informed POC: method as prior, machine-facing spec fields first
(scopes, idempotency key, callbacks, 202, request-body and
resource-schema fields) admitted only where a census shows them
consistently present, corpus-derived verb and noun leans as graded
evidence, weighted class with a fail-closed lowering rule. The first
M1 artefact is the census over the 719 operations; it will be E26 or
the first M1 entry, whichever numbering the PRD settles. Facts still
open, one sentence each: the party words that never raised correctly;
generate and verify are not read verbs; the 11 arguable truth rows
named in E24(g) want a second read; the destructive verb list is
unmeasured.

### M1-C11 — floor + raise-only from fixed verb/noun lists (POC, user-directed simplification, 2026-09-08)

Shape: floor = method prior (GET/HEAD/OPTIONS r, PUT/DELETE w, POST/PATCH x). Raise only: LIVE_VERBS hit on any operationId token or the summary lead word -> x; PARTY_NOUNS (+repository) hit on summary head noun or operationId head noun on PUT/DELETE/PATCH -> x. No corpus lookup, no CAMARA verb table, no scopes, no body/flag/structural layers, no weights. Two switches measured: readListOn (POST with lead verb in a 14-word hand READ_VERBS list lowers to r when nothing raised) and callerPhraseOn (a caller phrase in the summary skips the party-noun raise). Script poc/m1/arbiter/run-c11.mjs, outputs docs/logs/m1/c11-sweep.md and c11-rows.csv.

Bare floor alone (no lists): leaks camara 8, holdout1 24, holdout2 4 — all PUT/DELETE truth-x; over-tight camara 70, holdout1 19, holdout2 21 — all POST/PATCH truth r/w.

Results (combo, set, n, exact, leaks, over_tight, leak%, over-tight%):

| combo | set | n | exact | leaks | over_tight | leak% | over-tight% |
|---|---|---|---|---|---|---|---|
| base | camara | 292 | 212 | 1 | 79 | 0.3 | 27.1 |
| base | holdout1 | 207 | 149 | 2 | 56 | 1.0 | 27.1 |
| base | holdout2 | 220 | 193 | 0 | 27 | 0.0 | 12.3 |
| readList | camara | 292 | 252 | 3 | 37 | 1.0 | 12.7 |
| readList | holdout1 | 207 | 149 | 2 | 56 | 1.0 | 27.1 |
| readList | holdout2 | 220 | 194 | 0 | 26 | 0.0 | 11.8 |
| callerPhrase | camara | 292 | 212 | 1 | 79 | 0.3 | 27.1 |
| callerPhrase | holdout1 | 207 | 155 | 2 | 50 | 1.0 | 24.2 |
| callerPhrase | holdout2 | 220 | 193 | 0 | 27 | 0.0 | 12.3 |
| both | camara | 292 | 252 | 3 | 37 | 1.0 | 12.7 |
| both | holdout1 | 207 | 155 | 2 | 50 | 1.0 | 24.2 |
| both | holdout2 | 220 | 194 | 0 | 26 | 0.0 | 11.8 |

The lists catch 33 of the 36 hidden-x PUT/DELETE rows. Missed: camara TrafficInfluence deleteTrafficInfluence (leak, no word signal), holdout1 github issues/set-issue-field-values and issues/remove-sub-issue (the two disputed truth rows from C10, pending the user's re-read). camara patchTrafficInfluence also ends at floor but PATCH floor is x so it is not a leak.

readList leaks: exactly 2, both on the verb "validate" (camara validatePayment, validateCode). Dropping "validate" from READ_VERBS would give zero read-list leaks on all sets (not yet run).

callerPhrase: flips 6 holdout1 rows x->w, all truth w, zero leaks. Costless.

Party-noun over-tight: 48 rows, mostly GitHub "... for an organization" settings rows and Stripe/CAMARA "delete session/device/network" rows the readers labelled w.

Comparison to C10 at zero leaks (floor on): C10 over-tight 7% / 51% / 21%; C11 both-switches 12.7% / 24.2% / 11.8% with 3 leaks (1 real, 2 disputed truth rows).

What it taught: the method floor plus two hand lists does most of the work of the seven-layer arbiter; pass 1's corpus lowering only ever helped CAMARA's read-named POSTs, which a 13-word read list covers at the cost of one word ("validate").

Decision pending the user: drop "validate", admit both switches, rule on the two GitHub truth rows and the TrafficInfluence leak.

### M1-C11 variations V1–V8 (loop run, 2026-09-08)

Following C11's decision, ran a variation sweep on the C11 floor + raise-only shape. scoreV generalises run-c11.mjs's scoreC11 (see poc/m1/arbiter/run-c11v.mjs). Admission judged on camara + holdout1 only; holdout2 scored and printed every run but never used to pick a shape (D24). Full numbers and row-level detail: docs/logs/m1/c11v-sweep.md.

**V1 baseline** — C11 with "validate" dropped from READ_VERBS, readListOn and callerPhraseOn on:

| set | n | exact | leaks | over_tight | leak% | over-tight% |
|---|---|---|---|---|---|---|
| camara | 292 | 253 | 1 | 38 | 0.3 | 13.0 |
| holdout1 | 207 | 155 | 2 | 50 | 1.0 | 24.2 |
| holdout2 | 220 | 193 | 0 | 27 | 0.0 | 12.3 |

3 leaks: camara deleteTrafficInfluence (no word signal), holdout1 issues/set-issue-field-values and issues/remove-sub-issue (disputed truth rows, pending user).

**Variations V3a–V8** (deltas vs V1, camara/holdout1):

| variation | what it changes | leaks delta cam/ho1 | over_tight delta cam/ho1 | verdict |
|---|---|---|---|---|
| V3a | readVerbs += get | +0/+0 | -9/+0 | ADMIT — 0 leaks, -9 camara over-tight; all 11 changed rows truth r (CAMARA POST /retrieve getX rows, two PagerDuty analytics) |
| V3b | summary lead word as read source | +1/+0 | -3/+0 | REJECT — leaks camara postServiceCapability "Retrieve tailored service capabilities" gt x |
| V3c | readVerbs += get, readSummaryOn=true | +1/+0 | -11/+0 | REJECT (inherits V3b's leak) |
| V4 | caller-shaped path skips party raise | +0/+1 | +0/-2 | REJECT — leaks holdout1 apps/remove-repo-from-installation-for-authenticated-user gt x |
| V5 | any operationId token as party source | +0/+0 | +7/+11 | REJECT on cost — 0 leaks but +7/+11 over-tight |
| V6a | partySource=summary only | +1/+2 | +0/-12 | REJECT — +1/+2 leaks, incl. WebRTC updateSessionStatus, a negative control |
| V6b | partySource=opid only | +0/+5 | -1/-10 | REJECT — +5 leaks holdout1 |
| V7 | PATCH own-verb lowers to w | +1/+0 | -4/+0 | REJECT — leaks camara patchTrafficInfluence gt x |
| V8 | POST own-verb lowers to w | +32/+33 | -1/-17 | REJECT HARD — +32/+33 leaks |

**V2: leave-one-word-out.** For every LIVE_VERBS/PARTY_NOUNS word, V1 rerun with that word dropped; leaks_added/over_tight_removed measured on camara+holdout1. Top of the table (word, source, hits, leaks_added, over_tight_removed):

| word | source | hits | leaks_added | over_tight_removed |
|---|---|---|---|---|
| user | party | 11 | 2 | 7 |
| cancel | live | 8 | 2 | 0 |
| membership | party | 2 | 2 | 0 |
| restriction | party | 2 | 2 | 0 |
| repository | party | 12 | 1 | 8 |
| organization | party | 6 | 1 | 5 |
| account | party | 4 | 1 | 3 |
| session | party | 5 | 1 | 3 |

No word can be removed without adding a leak, except words whose only hits are POST rows already x on the floor (terminate, execute, person, pay, trigger, reboot) — those are kept anyway: dropping a live verb because it over-tightens two rows is fitting to pass. 24 words have zero hits on the three sets, kept at no cost: live:dial, live:hangup, live:end, live:reject, live:accept, live:approve, live:invite, live:transfer, live:notify, live:publish, live:run, live:launch, party:collaborator, party:sponsorship, party:participant, party:call, party:seat, party:invitation, party:people, party:contact, party:recipient, party:subscriber, party:tenant, party:partner.

What it taught: both noun sources (summary head noun and operationId head noun) are needed — they catch different rows; every lowering beyond the read list leaks; the read list is the only lowering that survives. Best admitted config after V1-V8: V1 + get.

M1 checkpoint, the user's calls: (1) the floor — a silent POST/PATCH assigned x and marked floor, or review; (2) the truth re-read of the rows the judge names (QoS deleteSession x2, deleteTrustDomainDevice, deleteAppInstance/Deployment, Delete a person x2, unblock user x2, DeleteCall record, issues/set-issue-field-values, issues/remove-sub-issue), the user's act; (3) stop M1 and write the M4 findings entry, or one more pass with the summary verb and repository measured jointly after the re-read.

### M1-C11 variations V9–V10 (loop close, 2026-09-08)

Closing the C11v loop: one more source for candidate live verbs (the APIs.guru corpus), then a final config. Full numbers and row-level detail: docs/logs/m1/c11-v9.md and docs/logs/m1/c11v-sweep.md.

**V9: corpus-mined LIVE_VERBS candidates.** APIs.guru lead tokens, providers >= 10, not already on any list, ranked by POST share. Baseline for this run is V1+get: camara 292/262/1/29 (9.9%), holdout1 207/155/2/50 (24.2%), holdout2 220/195/0/25 (11.4%).

Top 10 (register, login, resend, activate, complete, copy, import, logout, calculate, request): zero rows changed on any set.

Top 20 (all that clear postShare >= 0.6): 0 leaks, +1 camara / +3 holdout1 / +4 holdout2 over-tight.

Verdict REJECT: cost only. What it taught: corpus-mined verbs are POST-shaped, and POST is already x on the floor, so they cannot raise anything; the hidden x rows sit on PUT/DELETE and are caught by nouns, not verbs. In the floor+raise shape the corpus has no job on the raise lists. Its one remaining use is suggesting read verbs for the POST read list, unmeasured.

**V10: final config** = V1 + get (readListOn, callerPhraseOn, "validate" out, "get" in, both noun sources, PARTY_NOUNS + repository).

| set | n | exact | leaks | over_tight | leak% | over-tight% |
|---|---|---|---|---|---|---|
| camara | 292 | 262 | 1 | 29 | 0.3 | 9.9 |
| holdout1 | 207 | 155 | 2 | 50 | 1.0 | 24.2 |
| holdout2 | 220 | 195 | 0 | 25 | 0.0 | 11.4 |

Both negative controls x: terminateCall via live-verb opid:terminate, updateSessionStatus via party-noun opid:session. Remaining leaks: camara deleteTrafficInfluence (no word signal; one row, not a rule) and the two disputed GitHub truth rows (pending user). Versus C10 seven-layer shape at zero leaks: 7% / 51% / 21%.

**Loop summary, V1–V10:**

| variation | change | verdict | reason |
|---|---|---|---|
| V1 | baseline (validate dropped, readListOn+callerPhraseOn) | baseline | 3 leaks (1 real, 2 disputed) |
| V2 | leave-one-word-out sweep | INFORM | no word removable without adding a leak, except zero-hit or already-floor-x words; kept at no cost |
| V3a | readVerbs += get | ADMIT | 0 leaks, -9 camara over-tight |
| V3b | summary lead word as read source | REJECT | leaks camara postServiceCapability |
| V3c | readVerbs += get, readSummaryOn=true | REJECT | inherits V3b's leak |
| V4 | caller-shaped path skips party raise | REJECT | leaks holdout1 apps/remove-repo-from-installation-for-authenticated-user |
| V5 | any operationId token as party source | REJECT | 0 leaks but +7/+11 over-tight, cost only |
| V6a | partySource=summary only | REJECT | +1/+2 leaks, incl. WebRTC updateSessionStatus (negative control) |
| V6b | partySource=opid only | REJECT | +5 leaks holdout1 |
| V7 | PATCH own-verb lowers to w | REJECT | leaks camara patchTrafficInfluence |
| V8 | POST own-verb lowers to w | REJECT HARD | +32/+33 leaks |
| V9 | corpus-mined LIVE_VERBS candidates | REJECT | cost only, corpus verbs are POST-shaped and POST is already floor x |
| V10 | final config = V1 + get | ADOPTED (POC) | near-zero leaks, over-tight 9.9%/24.2%/11.4% vs C10's 7%/51%/21% |

Pending the user: ruling on the two GitHub truth rows; whether TrafficInfluence stays a reported leak; whether C11 replaces the C7-through-C10 shape as the M1 arbiter.

### M1-C11 adopted (2026-09-08)

The C11 floor + raise-only shape is adopted as the M1 arbiter, per the user's direction. Module code is `poc/m1/arbiter/c11.mjs` (being written in parallel, may not exist yet — see c11.mjs).

### M1-C11 on hold-out 3 — Discord, Sentry, Vercel (2026-09-08)

- Hold-out 3: data/holdout3-2026-09-08/, 226 rows (discord 81, sentry 76, vercel 69; GET 102, POST 48, PUT 20, PATCH 19, DELETE 37), blind-read by five agents, truth r 104 / w 54 / x 68, 46 doubt rows (45 Discord no-text). Scored once with the adopted C11 (poc/m1/arbiter/c11.mjs via run-c11-final.mjs), lists untouched.
- Combined results table (set, n, exact, leaks, over_tight, exact%, leak%, over-tight%): camara 292 262 1 29 89.7 0.3 9.9; holdout1 207 155 2 50 74.9 1.0 24.2; holdout2 220 195 0 25 88.6 0.0 11.4; holdout3 226 194 11 21 85.8 4.9 9.3. Both negative controls x.
- The 11 hold-out 3 leaks, all PUT/DELETE at the w floor: discord set_guild_application_command_permissions, delete_channel, delete_message, delete_user_message_reaction, set_channel_permission_overwrite, deprecated_create_pin, unban_user_from_guild, delete_guild_emoji, update_guild_incident_actions, delete_guild_sticker; vercel deleteRedirects ("Delete project-level redirects", creates a new version per call). Ten of eleven are Discord rows with no summary text; the party-noun rule has only the operationId to read and its head nouns (channel, message, reaction, overwrite, pin, emoji, sticker, guild) are shared-resource nouns, not party nouns.
- Two candidate fixes measured, NOT admitted (hold-out 3 is an exam; admitting on it would taint it):
  Rule A, no-text tighten: PUT/DELETE/PATCH row at the floor with empty summary AND empty description -> x. Leaks: camara 1, holdout1 2, holdout2 0, holdout3 2 (from 11). Over-tight: 29, 54 (+4, Twilio no-text DELETEs all w), 25, 25 (+4). Rows changed: 0 / 4 / 0 / 13. Zero new leaks anywhere. This is the doctrine's own rule (no evidence -> tighter class) applied to text, not a word fit.
  Rule B, party path param ({user_id}, {username}, {member}, {person}, {customer}, {participant}, {actor_identifier}) on PUT/DELETE at the floor -> x: holdout3 leaks 9 (from 11), holdout1 over-tight +6, no new leaks. Weak; A subsumes its useful part on this set.
  No-text rows by set/method/truth: holdout1 DELETE 5 w, POST 3 w / 8 x; holdout3 DELETE 2 w / 10 x, PATCH 4 w / 5 x, PUT 2 w / 4 x, POST 3 w / 11 x, GET 34 r.
- What it taught: (1) the lists transfer: 9.3% over-tight and 85.8% exact on three vendors never seen, with no tuning; (2) the leak surface is "no text at all", which the flow currently treats as w on PUT/DELETE, i.e. a silent loosening from "don't know"; (3) readers draw the shared-resource line differently per vendor (Discord guild objects x, GitHub org settings w), so a shared-object noun list would fit one reader's line, while Rule A fits the doctrine.
- Pending the user: admit Rule A (and if so, hold-out 3 becomes a tuning set and a hold-out 4 is needed as the clean exam), or keep C11 frozen and report hold-out 3 as-is.

What the seven-layer C4-C10 work taught that still stands: machine-facing fields (scope, body, callbacks, corpus lean, CAMARA verb table) lean but never reach the 0.9 admission bar; lowering below the method prior beyond a fixed read-verb list always leaks; both noun sources (summary head noun and operationId head noun) are needed, since they catch different rows.

Retired: corpus lookup at score time, the CAMARA verb table, per-operation scopes, body/flag/structural layers, the prose-word layer, the weighted-aggregate confidence sum, and the two-pass judge shape (D33).

### M1-C11 Rule A adopted (2026-09-08)

- Rule A, adopted by the user's ruling: a PUT, DELETE or PATCH row that
  reaches the floor step with no summary and no description -> x,
  marked no-text. Implemented as step 5 of the C11 flow in
  `poc/m1/arbiter/c11.mjs` (floor is now step 6).
- 17 rows moved. Four Twilio DELETEs in hold-out 1, all truth w, now
  over-tight: DeleteAddress, DeleteKey, DeleteRecordingTranscription,
  DeleteSigningKey. Thirteen Discord rows in hold-out 3, nine of them
  truth x.
- Leaks per set, before Rule A -> after: camara 1 -> 1, holdout1 2 ->
  2, holdout2 0 -> 0, holdout3 11 -> 2. Zero new leaks anywhere.
- Tests: 115 pass. Module: `poc/m1/arbiter/c11.mjs`, step 5.
- Two measurements the user asked about, both NOT admitted:
  (a) "POST with lead verb update lowers to w when the noun is not a
      party" leaks 6 Twilio rows (UpdateConference, UpdateStream,
      UpdatePayments, UpdateCallRecording, UpdateConferenceRecording,
      UpdateRealtimeTranscription), so Twilio's POST-as-update rows
      stay at the x floor.
  (b) The any-token live-verb source costs three over-tight rows
      (DeleteApplePayDomainsDomain via "pay", UpdateUsageTrigger and
      DeleteUsageTrigger via "trigger") against one leak it prevents
      (updateRebootRequest) — kept as-is (first-token-only), not
      switched to any-token.
- (c) Shared-object nouns (channel, message, emoji, sticker, pin,
  guild, permission, overwrite, ban, webhook, reaction) added to the
  party list would take hold-out 3 to 1 leak, at +2/+6/+1/+3
  over-tight (camara/holdout1/holdout2/holdout3), zero new leaks. Not
  admitted: it is one vendor's reader line (Discord treats shared
  objects as x, GitHub treats org settings as w) rather than a
  transferable rule. Revisit after hold-out 4.

### M1-C11 clean exam — hold-out 4 (Linode, Cloudflare, X), 2026-09-08

- Hold-out 4: data/holdout4-2026-09-08/, 210 rows (linode 75, cloudflare
  71, x 64; GET 102, POST 51, DELETE 29, PUT 23, PATCH 5), blind-read by
  five agents, truth r 106 / w 64 / x 40, 16 doubt, zero no-text rows.
  Scored once with C11 + Rule A, nothing changed after.
- Combined table for all five sets (set, n, exact, leaks, over_tight,
  exact%, leak%, over-tight%): camara 292 262 1 29 89.7 0.3 9.9;
  holdout1 207 151 2 54 72.9 1.0 26.1; holdout2 220 195 0 25 88.6 0.0
  11.4; holdout3 226 199 2 25 88.1 0.9 11.1; holdout4 210 181 2 27 86.2
  1.0 12.9. Total 1155 rows, 7 leaks (0.6%), 160 over-tight (13.9%).
  Both negative controls x.
- Hold-out 4 leaks, both X rows with text and no list word: DELETE
  /2/broadcasts/{id}/chat/{message_id} deleteBroadcastChatMessage
  "Remove a chat message from a live broadcast" (removes another
  participant's message; noun "message"); PUT /2/webhooks/{webhook_id}
  validateWebhooks "Validate webhook" (fires a live CRC challenge at a
  third-party endpoint; verb "validate", the same word that leaked the
  read list on CAMARA).
- Hold-out 4 over-tight by rule: floor POST 12, floor PATCH 4, floor PUT
  1, live-verb 6 (cancel x2, revoke x2, terminate x2 — Linode cancel
  backups/object storage, revoke a key/app access, X terminate
  connections; readers called these own-resource w), party-noun 4
  (contact, group, network, user: delete-managed-contact,
  put-placement-group, tunnel-virtual-network-delete, unfollowUser).
- What it taught: (1) transfer holds on a fourth unseen vendor set: 86%
  exact, 1% leak, 13% over-tight with zero tuning; (2) the remaining
  leak shape is stable across sets: a write on a shared object
  (message, issue, channel) or a verb that fires a live check
  (validate); (3) the live verbs cancel/revoke/terminate over-tighten
  when the object is the caller's own, which is the price of the
  raise-only shape and is what the evidence word is for; (4) more
  vendor sets will not move the lists; the next gain is in output (rule
  + evidence word shipped) and in an owner override, not in words.
- Pending the user: the shared-object noun question (message/channel/
  issue) now has evidence from three vendors (GitHub w, Discord x, X
  x); the two GitHub truth rows; deleteTrafficInfluence.

### M1-C11 shared-object nouns admitted; GitHub triggersNotification measured (2026-09-08)

- SHARED_NOUNS = message, channel, emoji, sticker, pin, guild,
  permission, overwrite, ban, webhook, reaction, added to step 3
  (party-noun) in c11.mjs, user ruling after three vendors' readers
  (Discord, X, and hold-out 4) drew the shared-object line at x; GitHub
  readers had drawn org-settings at w. Sources: summary head noun,
  operationId head noun, and any operationId token. 33 rows changed,
  all tightening or same class; 3 leaks fixed (discord
  update_guild_incident_actions, x deleteBroadcastChatMessage, x
  validateWebhooks); 11 new over-tight (CAMARA WebRTC
  notification-channel subscription x2, Twilio
  DeleteUserDefinedMessageSubscription, Stripe/GitHub/PagerDuty/X
  webhook deletes, GitHub reactions/delete-for-release, Discord
  voice-channel status and guild event/soundboard/template/widget
  rows).
- Results table (set n exact leaks over_tight exact% leak%
  over-tight%): camara 292 260 1 31 89.0 0.3 10.6; holdout1 207 146 2
  59 70.5 1.0 28.5; holdout2 220 194 0 26 88.2 0.0 11.8; holdout3 226
  198 1 27 87.6 0.4 11.9; holdout4 210 182 0 28 86.7 0.0 13.3. Total
  1155 rows, 4 leaks (0.3%), 171 over-tight (14.8%). Both controls x.
  118 tests pass.
- Remaining 4 leaks, all floor w with text and no list word: camara
  deleteTrafficInfluence; github issues/set-issue-field-values and
  issues/remove-sub-issue; vercel deleteRedirects ("Delete
  project-level redirects", creates a new version each call).
- Truth check on the two GitHub rows: the orchestrator's earlier
  reading of w was wrong; the readers' reason is GitHub's own
  `x-github.triggersNotification: true`, an external effect (notifies).
  Truth x stands.
- triggersNotification measured on the GitHub spec (SHA matches
  hold-out 1's README): among the 81 labelled GitHub rows, flag true on
  3 (all truth x: set-issue-field-values, remove-sub-issue,
  pulls/merge-async), absent on 78 (w 62, x 16). Whole spec: true on 22
  of ~1225 operations (POST 12, DELETE 4, PUT 4, PATCH 1), false once,
  absent elsewhere. Verdict: zero-leak raise-only signal with tiny
  coverage (3 of 19 GitHub x rows). Not admitted yet; it is the owner's
  own declaration of an external effect, so an "owner-declared notify
  flag raises to x" step is the candidate, generalised only as an
  exact vendor key list, never a substring guess. Pending user.
- What it taught: the leak surface after five sets is four rows, each
  needing either an owner-declared field (the GitHub flag) or a
  description read (Vercel's "new version" sentence), neither of which
  the operationId-plus-summary flow can see.

### M1-C12 benchmark honesty pass: baselines, set buckets, evidence-vs-floor (2026-09-08)

- What was added: `poc/m1/arbiter/baselines.mjs` (three dumb baselines:
  all-x, get-else-x, method-prior), `poc/m1/arbiter/run-benchmark.mjs`
  (the single re-runnable command), `poc/m1/arbiter/load-sets.mjs`
  (loaders extracted from `run-c11-final.mjs`; that runner's three
  output files verified byte-identical after the extraction). 122
  tests pass. No classifier logic changed.
- The corrected set buckets and why (D19/D24/D27/D35): tuned = camara +
  holdout1 + holdout3, reference = holdout2, clean-exam = holdout4
  only. An earlier draft of this pass had holdouts 2, 3, and 4 all
  counted as "clean", which would have inflated the transfer number;
  the PRD's own decisions corrected it — hold-out 3 was demoted to a
  tuning set by D35 (Rule A was fitted on it), and hold-out 2 stays a
  reference set, not a clean exam, by D24/D27 (scored repeatedly, not
  blind, carries a recorded taint).
- (b) Tuned / reference / clean-exam tables, verbatim from
  `docs/logs/m1/benchmark.md`:

  c11: tuned n=725 exact=604 leaks=4 over_tight=117 (83.3% / 0.6% /
  16.1%); reference n=220 exact=194 leaks=0 over_tight=26 (88.2% / 0.0%
  / 11.8%); clean-exam n=210 exact=182 leaks=0 over_tight=28 (86.7% /
  0.0% / 13.3%); all n=1155 exact=980 leaks=4 over_tight=171 (84.8% /
  0.3% / 14.8%).

  all-x: tuned n=725 exact=220 leaks=0 over_tight=505 (30.3% / 0.0% /
  69.7%); reference n=220 exact=53 leaks=0 over_tight=167 (24.1% / 0.0%
  / 75.9%); clean-exam n=210 exact=40 leaks=0 over_tight=170 (19.0% /
  0.0% / 81.0%); all n=1155 exact=313 leaks=0 over_tight=842 (27.1% /
  0.0% / 72.9%).

  get-else-x: tuned n=725 exact=418 leaks=0 over_tight=307 (57.7% /
  0.0% / 42.3%); reference n=220 exact=147 leaks=0 over_tight=73 (66.8%
  / 0.0% / 33.2%); clean-exam n=210 exact=142 leaks=0 over_tight=68
  (67.6% / 0.0% / 32.4%); all n=1155 exact=707 leaks=0 over_tight=448
  (61.2% / 0.0% / 38.8%).

  method-prior: tuned n=725 exact=561 leaks=54 over_tight=110 (77.4% /
  7.4% / 15.2%); reference n=220 exact=195 leaks=4 over_tight=21 (88.6%
  / 1.8% / 9.5%); clean-exam n=210 exact=187 leaks=3 over_tight=20
  (89.0% / 1.4% / 9.5%); all n=1155 exact=943 leaks=61 over_tight=151
  (81.6% / 5.3% / 13.1%).

- (d) Evidence-vs-floor tables, verbatim from
  `docs/logs/m1/benchmark.md`:

  Per set: camara locked=96 (32.9%) evidence=83 (28.4%) floor=113
  (38.7%); holdout1 locked=0 (0.0%) evidence=61 (29.5%) floor=146
  (70.5%); holdout2 locked=94 (42.7%) evidence=25 (11.4%) floor=101
  (45.9%); holdout3 locked=102 (45.1%) evidence=36 (15.9%) floor=88
  (38.9%); holdout4 locked=102 (48.6%) evidence=20 (9.5%) floor=88
  (41.9%); all locked=394 (34.1%) evidence=225 (19.5%) floor=536
  (46.4%).

  Tuned / reference / clean-exam: tuned locked=198 (27.3%) evidence=180
  (24.8%) floor=347 (47.9%); reference locked=94 (42.7%) evidence=25
  (11.4%) floor=101 (45.9%); clean-exam locked=102 (48.6%) evidence=20
  (9.5%) floor=88 (41.9%); all locked=394 (34.1%) evidence=225 (19.5%)
  floor=536 (46.4%).

- What it taught, flatly: on the clean exam the method-prior baseline
  is MORE exact (89.0 vs 86.7) and asks for FEWER reviews (9.5% vs
  13.3%) than the adopted arbiter; what the arbiter buys is 3 leaks ->
  0, and both negative controls, which method-prior gets wrong (w,
  should be x). Also: the word rules fire on only 9.5% of clean-exam
  rows (20 of 210); 41.9% land on the floor with no evidence read at
  all, so further word-list work cannot move the exact rate much — the
  remaining headroom is in the floor pile.
- Open weakness: the readers are LLM readers and the truth is itself
  model-generated, not a human expert reading; no row has been read
  twice by an independent reader, so none of these numbers has an
  error bar and the truth's own noise is unknown.

### M1-C13 hold-out 5 scored once: the gate fails, 17 leaks, all GET (2026-09-08)

- What it is: hold-out 5, `data/holdout5-2026-09-08/`, 323 operations —
  slack (174), notion (24), amazon SP-API (125) — read blind by five
  Sonnet agents, round-robin, input columns repo/path/method/operationId
  only, no orchestrator rulings. Scored once against c11.mjs and the
  three baselines in baselines.mjs.

- Overall scores:

  | classifier | exact | leaks | over-tight |
  |---|---|---|---|
  | c11 | 241 (74.6%) | 17 (5.3%) | 65 (20.1%) |
  | all-x | 97 (30.0%) | 0 (0.0%) | 226 (70.0%) |
  | get-else-x | 223 (69.0%) | 17 (5.3%) | 83 (25.7%) |
  | method-prior | 230 (71.2%) | 22 (6.8%) | 71 (22.0%) |

- c11 per vendor: slack n=174, 63.8% exact, 17 leaks, 26.4% over-tight;
  notion n=24, 79.2% exact, 0 leaks, 20.8% over-tight; amazon n=125,
  88.8% exact, 0 leaks, 11.2% over-tight.

- Truth class counts: r=153, w=73, x=97; 16 rows marked doubt.

- All 17 leaks are Slack GET rows: apps_permissions_request,
  apps_permissions_users_request, apps_uninstall, auth_revoke,
  dialog_open, files_remote_share, oauth_access, oauth_token,
  oauth_v2_access, rtm_connect, views_open, views_publish, views_push,
  views_update, workflows_stepCompleted, workflows_stepFailed,
  workflows_updateStep.

- Of 156 GET rows, 17 are not r; all 17 are Slack (notion 0 of 12,
  amazon 0 of 64).

- Double-read: two independent readers on the same 60 rows agreed on
  57 (95.0%). The three disagreements were all w-vs-x: slack
  reactions_add, amazon cancelFulfillmentOrder, amazon
  cancelServiceJobByServiceJobId. Reader B's contamination check was
  clean.

- Field census on this set: slack 174/174 rows have an EMPTY summary
  (0 empty description); amazon 116/125 empty summary (0 empty
  description); notion 0 empty summary, 13 empty description.

- Three root causes, stated separately, verified in the code and the
  specs:

  1. c11 rule 1 locks GET/HEAD/OPTIONS to `r` and returns immediately,
     so no text is ever read for a GET.
  2. The text rules read `row.summary` (judge.mjs summaryLeadVerb,
     headNounForRow). Slack and Amazon are Swagger 2.0 and put their
     prose in `description`; 290 of 323 rows in this set have no
     summary at all, so those rules ran on an empty string.
  3. judge.mjs `naiveSingular` strips `es` from any word ending in
     `es`, which is a noun rule. Applied to third-person verbs it
     destroys the stem: creates->creat, revokes->revok,
     terminates->terminat, shares->shar, invites->invit,
     approves->approv, schedules->schedul, exchanges->exchang. Verbs
     whose stem ends in a consonant survive (cancels->cancel,
     sends->send). Slack and Amazon write descriptions in the third
     person; the earlier twelve vendors mostly write imperative
     summaries, which never hit the `es` branch.

  Slack's own text is clear on all 17 rows (e.g. oauth_access
  "Exchanges a temporary OAuth verifier code for an access token.";
  dialog_open "Open a dialog with a user"; rtm_connect "Starts a Real
  Time Messaging session."; auth_revoke "Revokes a token."). The
  failure is ours, not a vendor quirk.

- get-else-x leaks on the identical 17 rows, because it shares c11's
  rule 1 (GET locked to r with no text read).

- What it taught: the `r` floor on GET was never earned — it was
  assumed from the method and never tested against a vendor that
  writes real prose on GET operations with side effects. Twelve
  vendors agreeing that GET means r did not make it true; it only
  meant none of the twelve vendors' GETs happened to have a
  description-only side effect and a summary-shaped judge running on
  an empty string. Two independent code defects (summary-vs-description
  field choice, and the `es`-stripping stemmer) had been present all
  along and never triggered because no earlier set combined
  description-only prose with third-person verb phrasing on a GET.

- No fix was applied in this pass.

### M1-C13b the A/B/C fix measurement; stemming adopted, inert today (2026-09-08)

- Three candidate fixes for C13's three root causes were built behind
  flags in `poc/m1/arbiter/c13.mjs` and measured by
  `poc/m1/arbiter/run-c13.mjs` over eight configurations across all six
  sets. Flags require strict `true` (passing 1 silently does nothing).
  - A = `opts.readGet`: GET no longer returns immediately; the
    live-verb raise runs on GETs, raise-only.
  - B = `opts.textFallback`: use `row.description` when `row.summary`
    is empty.
  - C = `opts.stem`: verb-correct suffix stripping instead of
    `naiveSingular` for verbs.

- Results on hold-out 5 (n=323), as exact / leaks / over-tight:

  | config | exact | leaks | over-tight |
  |---|---|---|---|
  | baseline | 241 | 17 | 65 |
  | B alone | 241 | 17 | 65 |
  | C alone | 241 | 17 | 65 |
  | A alone | 237 | 15 | 71 |
  | A+B | 238 | 14 | 71 |
  | A+B+C | 237 | 14 | 72 |

- B alone and C alone are inert, and the reason is structural, not
  statistical: c11's rule 1 returns `r` for GET before any text is
  read, so on a GET there is no text path for B or C to fix; and on
  POST the floor is already `x`, so a rule that raises to `x` is a
  no-op. A is the only switch that opens the door. B then fixes
  exactly three more rows: auth_revoke, rtm_connect, views_publish.

- Across all eight configurations 20 rows tightened and 0 loosened;
  both negative controls stayed `x` in all eight.

- Still leaking under A+B+C, 14 Slack GET rows:
  apps_permissions_request, apps_permissions_users_request,
  apps_uninstall, dialog_open, files_remote_share, oauth_access,
  oauth_token, oauth_v2_access, views_open, views_push, views_update,
  workflows_stepCompleted, workflows_stepFailed, workflows_updateStep.
  Plus four pre-existing leaks outside hold-out 5, unchanged from
  baseline: TrafficInfluence deleteTrafficInfluence, github
  issues/set-issue-field-values, github issues/remove-sub-issue,
  vercel deleteRedirects.

- What it taught: the failure is roughly one third plumbing, two
  thirds vocabulary. The 14 remaining leaks need words that are not in
  LIVE_VERBS at all — open, access, token, uninstall, request, share,
  push, update, stepCompleted, stepFailed, updateStep. Stemming cannot
  reach them; it only inflects words already in the list.

- Fix C was adopted (A and B were not, in this pass), in two steps:
  1. `stemMatches` / `matchesAnyStem` were moved into `judge.mjs` and
     made the default for LIVE_VERBS and READ_VERBS on BOTH the
     summary path and the operationId path, so the two finally agree
     on what a word is. `naiveSingular` was kept and still used by the
     noun sets. c13.mjs's `opts.stem` became a no-op; `opts.readGet`
     and `opts.textFallback` still work.
  2. The -ing / -ies / doubled-consonant gap was closed: a stem ending
     in `e` accepts stem-minus-e + ing (invoke -> invoking); consonant
     + y accepts -ies / -ied (verify -> verifies / verified); a CVC
     stem accepts a doubled final consonant + ing / ed (cancel ->
     cancelling / cancelled), excluding a final w/x/y.

- Adversarial behaviour verified: invoking, terminating, revoking,
  verifies, verified, cancelling, cancelled, running, ending, paying
  all MATCH their stems; revoke-vs-invok, address-vs-add,
  spend-vs-send, banner-vs-ban, sender-vs-send, listings-vs-list all do
  NOT match. `listing` does match `list`, which is correct English and
  cannot cause a leak, because `list` is a read verb that only ever
  lowers POSTs.

- Measured impact of both stemming steps: ZERO rows changed on all six
  sets — same exact, leaks and over-tight everywhere, both controls
  `x`, 150 tests pass, run-benchmark.mjs and run-c11-final.mjs both
  exit 0. The value is future headroom (one list entry now covers its
  inflections), not a score gain today. The only visible difference is
  the evidence column, which now names the actual matched word
  (opid:cancels instead of opid:cancel) — same class, same rule, on
  every row.

- A separate defect was left standing and is recorded here so it is
  not lost: the noun paths (headNounForRow, operationIdHeadNoun in
  judge.mjs) still normalise through `naiveSingular`, which is the
  same es-stripping rule that mangled the verbs. Verbs were fixed,
  nouns were not.

- User ruling this session: no verb or noun is deleted from a list
  without a measurement first and the user's approval after. An
  unfiring word costs nothing to keep and may fire on vendor sixteen.

### M1-C15 per-method floors and one direction per method (2026-09-09)

- Truth distribution per method over all 1478 labelled rows, which is
  what the floors are set from:

  | method | n | r | w | x |
  |---|---|---|---|---|
  | GET | 550 | 533 (97%) | 4 (1%) | 13 (2%) |
  | POST | 509 | 88 (17%) | 103 (20%) | 318 (62%) |
  | DELETE | 250 | 0 (0%) | 203 (81%) | 47 (19%) |
  | PUT | 127 | 2 (2%) | 106 (83%) | 19 (15%) |
  | PATCH | 42 | 0 (0%) | 29 (69%) | 13 (31%) |

- The floor is now each method's own lean, and is a STARTING VALUE,
  never an early return: GET/HEAD/OPTIONS -> r, POST -> x, PUT -> w,
  DELETE -> w, PATCH -> w. PATCH moved from x (c11) to w; every other
  floor is unchanged.

- Each method gets ONE direction of travel, because its floor sits at
  one end of what is actually possible for it:
  - GET/HEAD/OPTIONS: no word rules run at all. 97% right already;
    every rule tried on GET made it worse.
  - POST: LOWER only (find the r's). Its floor x is already the top,
    so a raise is a no-op.
  - PUT / DELETE / PATCH: RAISE only (find the x's). DELETE has zero
    truth-r rows in 250; PUT has two in 127; PATCH has none in 42 — so
    lowering has almost nothing to find and only risks leaks.

- Why the blanket scan was wrong, with the rows that showed it: the
  noun `access` correctly raises a DELETE but on GET produced
  `listAccesses` r->x; a read verb correctly lowers a POST but is
  meaningless on DELETE where no row is truth r; `refund` correctly
  raises a DELETE but on `retrieveRefunds` it is a noun, not a verb,
  and wrongly raised a GET. One word list cannot serve two opposite
  jobs, so the vocabulary is now scoped per direction: a lowering list
  used only on POST, and a raising list used only on PUT/DELETE/PATCH.

- Scores, all 1478 rows:

  | classifier | exact | leaks | over-tight |
  |---|---|---|---|
  | floor only, no word rules | 1189 (80.4%) | 96 (6.5%) | 193 (13.1%) |
  | c11 (blanket rules) | 1221 (82.6%) | 21 (1.4%) | 236 (16.0%) |
  | c15 (per-method) | 1247 (84.4%) | 27 (1.8%) | 204 (13.8%) |

- c15 per method: GET n=550 exact=533 leak=17 over=0; POST n=509
  exact=382 leak=0 over=127; PUT n=127 exact=102 leak=1 over=24; DELETE
  n=250 exact=200 leak=3 over=47; PATCH n=42 exact=30 leak=6 over=6.

- Versus c11: +26 exact, -32 over-tight, +6 leaks. All six new leaks
  are PATCH and come from moving the PATCH floor from x to w. That
  same move took PATCH exact from 13 to 30 of 42 and cut PATCH
  over-tightening from 29 to 6. Dropping the blanket live-verb scan
  from POST also helped on its own — that scan had been pre-empting
  the read-verb lower, so POST exact went 380 to 382.

- The word rules earn their keep: floor-only leaks 96, with rules 27.
  They close 69.

- DETECTABILITY, the important negative result. Split every row by
  whether a word rule actually fired:

  | bucket | n | exact | leaks | over-tight |
  |---|---|---|---|---|
  | evidence (a rule fired) | 208 | 133 | 0 | 75 |
  | floor (method alone) | 1270 | 1114 | 27 | 129 |

  Every one of the 27 leaks is a floor row. In 208 rows where a rule
  read the operation and fired, we have never leaked. So the tool
  cannot detect "this w is really an x" — that judgement needs ground
  truth. What it CAN emit honestly is "I had no evidence here", and
  that flag captures 100% of the leaks. The cost: on PUT/DELETE/PATCH
  the no-evidence pile is 275 rows to find 10 hidden x. Shrinking that
  pile, not inventing a confidence score, is the job.

- The 10 remaining x-dressed-as-w rows (truth x, predicted w), the
  whole non-GET leak problem: camara PATCH patchTrafficInfluence;
  camara DELETE deleteTrafficInfluence; holdout1 PUT
  issues/set-issue-field-values; holdout1 DELETE
  issues/remove-sub-issue; holdout3 PATCH update_stage_instance;
  holdout3 PATCH patchUrlProtectionBypass; holdout3 PATCH
  updateSandbox; holdout3 DELETE deleteRedirects; holdout4 PATCH
  ssl-verification-edit-ssl-certificate-pack-validation-method;
  holdout5 PATCH patch-block-children. All ten are vocabulary gaps —
  traffic influence, sandbox, redirects, stage instance, field values
  never appear in LIVE_VERBS, PARTY_NOUNS or SHARED_NOUNS.

- The other 17 leaks are the known Slack GET rows, unchanged from c11
  and structurally untouched by this shape, since GET runs no word
  rules by design.

- A `noTextRaise` switch was built and measured, NOT adopted, default
  off: on PUT/DELETE/PATCH with no summary and no description, raise
  to x instead of using the w floor. It closes exactly one leak
  (holdout3 PATCH update_stage_instance), 27 leaks to 26, and leaves
  the review pile unchanged. It is a raise on zero evidence, which is
  a doctrine question and is left to the user.

- Two human-facing outputs are now kept deliberately separate: a
  per-API report (poc/m1/arbiter/report.mjs) that a person runs on a
  real spec, carrying class counts, the evidence-vs-floor split and a
  review-first list, and NO accuracy, leak or over-tight number,
  because without ground truth we do not have one; and the benchmark,
  which has truth and therefore reports leaks and labels
  x-dressed-as-w rows.

- The labelled corpus was consolidated into one canonical table,
  data/corpus/labelled.csv, 1478 rows and 37 columns, generated by
  poc/m1/corpus/build-labelled.mjs and read by loadLabelledCorpus() in
  poc/m1/arbiter/load-corpus.mjs, byte-identical across runs. It had
  been scattered across six directories in two file shapes behind four
  loaders. The raw APIs.guru per-operation dump and the downloaded specs
  were written by poc/m1/corpus/extract.mjs to a session scratchpad that
  has since been wiped, and are gone. The aggregate they produced
  survives in the repo at docs/logs/m1/corpus-leans.csv — 3688 tokens,
  each with position (lead or opid), provider count, total ops and per-
  method counts, hold-out vendors excluded at extract time — and it is
  sufficient for the per-method word-lean scan this shape needs.
  Verified examples: `delete` in lead position, 3354 ops of which 2624
  DELETE; `update` in opid position, 5397 ops of which 2867 PUT and 1343
  PATCH; `partial` in opid position, 320 ops of which 316 PATCH. A re-
  extract is owed only for questions the aggregate cannot answer, such
  as reading operation summaries or word co-occurrence.

### M1-C15 wild reading — the shape run over the APIs.guru corpus (2026-09-09)

- Corpus: data/corpus/apis-guru-ops.csv.gz — 2,529 specs fetched with
  poc/m1/corpus/fetch-corpus.mjs (resumable, 0 failures, 402 MB of
  specs kept local and gitignored), 123,339 operations extracted by
  poc/m1/corpus/extract-ops.mjs with NO provider excluded at
  collection time; 673 providers, 2,517 APIs. Per method: GET 59,779;
  POST 34,805; DELETE 13,276; PATCH 7,734; PUT 7,542. The previous
  session's extract had been written to a scratchpad and lost; this
  one lives in the repo (4.5 MB gzipped, byte-identical to the raw on
  md5).
- Reading: c15 classify() run over the 92,049 wild rows that remain
  after excluding every provider present in the six labelled sets. No
  truth exists on the wild; the comparison is truth-lean on the
  labelled 1478 vs the classifier's own output split on the wild.
- Then the table exactly as it appears in the PRD's "Wild reading
  (2026-09-09)" block (copy it from prd.md so the two never diverge):

| method | truth r | truth w | truth x | wild output r | wild output w | wild output x | rules fired on wild | reading |
|---|---|---|---|---|---|---|---|---|
| GET | 97% | 1% | 2% | 100% | 0% | 0% | 0% | aligned by design |
| PUT | 2% | 83% | 15% | 0% | 87% | 13% | 13% | aligned |
| DELETE | 0% | 81% | 19% | 0% | 86% | 14% | 14% | close, slightly under-raising |
| PATCH | 0% | 69% | 31% | 0% | 88% | 12% | 12% | under-raising: a third are x, the list catches an eighth |
| POST | 17% | 20% | 62% | 2% | 0% | 98% | 2% | way off: 37% are not x, the lowering list fires on 2% |

- What it taught: the floors hold outside the labelled set for GET,
  PUT and DELETE (wild output within ~5 points of the truth lean).
  PATCH under-raises: truth says ~31% x, the raise list fires on 12%.
  POST is the largest gap: truth says 37% of POSTs are not x, the
  lowering list fires on 2%, so 98% land on the x floor. By size the
  vocabulary job is POST-lowering first, PATCH-raising second. This is
  the reading that fixes M1 step 3's order.
- Sampling note, for the record only: our labelled set is 2.8% PATCH
  where the wild is 6.3% (0.45x), and 16.9% DELETE where the wild is
  10.8% (1.57x). The PATCH floor rests on 42 rows. Not acted on.

### M1 step 3 — corpus-derived raising list, measured and failed (2026-09-09)

- The task: M1 step 3, per the PRD's D30 rule 5 — "Verb and noun
  leans come from a broader corpus (APIs.guru, D7) as method
  co-occurrence — which methods a verb or noun travels with — with
  CAMARA usable as one signal among them. No hand lists." The
  specific job was the RAISING list used on PUT/DELETE/PATCH (w ->
  x), chosen ahead of the POST lowering list because raising is what
  closes leaks, and leaks are what fail the gate.

- Method: from data/corpus/apis-guru-ops.csv.gz, take every
  PUT/DELETE/PATCH operation (28,552 rows) and count, per word, how
  many DISTINCT PROVIDERS use it in the operationId or summary. Score
  each candidate on the labelled TUNED sets only (camara, holdout1,
  holdout3) — 279 PUT/DELETE/PATCH rows with truth w or x, of which
  65 are x, a 23% base rate. Admit candidates with at least 5 labelled
  rows and at least 20 providers in the corpus, at precision bars
  1.00, 0.90, 0.80 and 0.67. Then re-score the whole 1478-row labelled
  corpus and the clean exam.

- Result: FAILED. At every precision bar the list closed ZERO of the
  10 leaks and moved exact by 0 or -1. Only two words were ever
  admitted: `member` and `role`. The clean exam (linode/cloudflare/x)
  was unchanged at 185/210 exact, 1 leak, 24 over-tight — identical
  to the c15 baseline.

  | precision bar | words admitted | all six sets: exact | leaks | over-tight |
  |---|---|---|---|---|
  | baseline (no list) | 0 | 1247 (84.4%) | 27 | 204 (13.8%) |
  | 1.00 | 1 (member) | 1247 (84.4%) | 27 | 204 (13.8%) |
  | 0.90 | 1 (member) | 1247 (84.4%) | 27 | 204 (13.8%) |
  | 0.80 | 2 (member, role) | 1246 (84.3%) | 27 | 205 (13.9%) |
  | 0.67 | 2 (member, role) | 1246 (84.3%) | 27 | 205 (13.9%) |

- Why it failed, and this is structural rather than a tuning problem:
  method co-occurrence answers "which method does this word travel
  with". Every candidate here travels with PUT/DELETE/PATCH — that IS
  the selection filter. But inside those methods the w-vs-x question
  is whether the object belongs to someone else, and co-occurrence is
  blind to that. The corpus cannot see whose thing is being deleted.

- The measurement that shows it: breadth is ANTI-correlated with
  discrimination. Against the 23% base rate, on tuned PUT/DELETE/PATCH
  rows:

  | word | labelled rows | of which x | precision | providers |
  |---|---|---|---|---|
  | member | 8 | 8 | 100% | 33 |
  | team | 10 | 9 | 90% | 16 |
  | role | 5 | 4 | 80% | 36 |
  | message | 6 | 4 | 67% | 26 |
  | app | 9 | 4 | 44% | 28 |
  | remove | 22 | 9 | 41% | 91 |
  | user | 25 | 10 | 40% | 121 |
  | update | 52 | 15 | 29% | 220 |

  The widest-travelling words — update at 220 providers, user at 121,
  remove at 91 — sit at or barely above the base rate, because a word
  that every vendor uses on DELETE is a generic one. The three words
  that do separate (member, team, role) are "another person is
  affected" nouns, they are rare, and they are already in the
  hand-written PARTY_NOUNS the rule was meant to replace.

- The method was given every advantage and still produced nothing:
  candidates were scored on the TUNED sets, which is fitting, and the
  clean exam was only used to confirm the result afterwards.

- What this does NOT invalidate: the corpus is still worth what it
  cost. It is a good CANDIDATE GENERATOR (breadth without vendor
  bias) and a good VENDOR-BIAS CHECK — it proved member/team/role are
  not one vendor's habit, at 33, 16 and 36 providers. What it cannot
  do is SCORE a candidate. Only truth can score, and truth exists
  only in the 1478 labelled rows.

- Consequence for the spec: D30 rule 5 as written ("no hand lists",
  leans derived from corpus co-occurrence) is falsified for the
  raising direction. Per AGENT_RULES a failed POC goes back to the
  PRD as a spec change, not a retry. Two options were put to the user
  and NEITHER is yet chosen: (a) rewrite rule 5 so the corpus
  proposes candidates, the labelled tuned sets score them, and the
  clean exam validates once — admitting openly that this is
  fitting-with-a-holdout rather than derivation; or (b) stop
  attacking w-vs-x with words at all and examine signals never yet
  looked at for this question — response_codes, security_scopes,
  tags and the full description text, all of which the corpus now
  carries.

- The 10 rows this was trying to close, unchanged: camara PATCH
  patchTrafficInfluence; camara DELETE deleteTrafficInfluence;
  holdout1 PUT issues/set-issue-field-values; holdout1 DELETE
  issues/remove-sub-issue; holdout3 PATCH update_stage_instance;
  holdout3 PATCH patchUrlProtectionBypass; holdout3 PATCH
  updateSandbox; holdout3 DELETE deleteRedirects; holdout4 PATCH
  ssl-verification-edit-ssl-certificate-pack-validation-method;
  holdout5 PATCH patch-block-children.

### M1-C16 — description reach-phrase raise, DELETED (2026-09-09)

- Goal 2 attempt: a small hand-derived phrase list (3 phrases:
  "notification will be sent", "organization-level", "shareable
  link"), read off the 10 c15 goal-2 leak rows, layered as a raise-only
  pass on PUT/DELETE/PATCH rows whose description matches.
- On the 1478-row labelled set it closed 3 of 10 leaks (10 -> 7),
  zero new goal-1 cost. Looked promising.
- Leave-one-vendor-out killed it: rebuilding the phrase list with each
  leak's own vendor held out, 0 of 9 tuned-set leak rows were caught.
  Every phrase was contributed by exactly one vendor's own leak row and
  never appears in any other vendor's leak-row description.
- Scored once against exam 1 (data/exam-2026-09-09/, 25 scorable
  PUT/DELETE/PATCH leak rows in scope): 0 of 25 closed. Zero transfer
  off the tuned sets, not just zero transfer under LOVO.
- DELETED. docs/logs/m1/c16-sweep.md and c16-rows.csv stay in the repo
  as the evidence it failed; poc/m1/arbiter/c16.mjs is removed.
- Lesson: a phrase list read off the leak rows it is meant to fix is
  memorisation dressed as generalisation — LOVO is the check that
  catches it, and a same-day blind exam is the check that confirms LOVO
  wasn't itself lucky.

### M1-C17 — named-noun raise, DELETED, D24 breach recorded (2026-09-09)

- Goal 2 attempt, layered on c16: a 9-word hand-named noun list
  ("children", "method", "issue", "instance", "field", "sandbox",
  "influence", "bypass", "redirect"), each read off one of the 10 c15
  goal-2 leak rows, raise-only on PUT/DELETE/PATCH rows still at the w
  floor after c16.
- On the 1478-row labelled set it closed all 10 remaining leaks (10 ->
  0) but cost 7 new over-tight rows (178 -> 185 goal-1 errors, 204 ->
  211 total over-tight): twilio DeleteConnectApp, twilio
  DeleteSipDomain, github orgs/delete-issue-field, pagerduty
  deleteServiceCustomField, and three linode/cloudflare "instance"
  deletes.
- D24 BREACH, recorded plainly: one of the nine nouns, "method", was
  read off a holdout4 row (cloudflare's
  ssl-verification-edit-ssl-certificate-pack-validation-method).
  holdout4 is the clean exam; D24 says the clean exam is scored once
  per rule change and never used to pick a rule's shape. Naming a word
  off a clean-exam row breaks that wall — the clean exam's read on that
  one word is no longer blind, even though the other 219 holdout4 rows
  are unaffected.
- Scored once against exam 2 (data/exam2-2026-09-10/, 81 scorable
  PUT/DELETE/PATCH leak-shaped rows in scope): closed 1 of 81.
- Leave-one-vendor-out: 3 of 10 tuned-set leak rows caught by a noun
  list that never saw their own vendor — real but thin transfer, and
  bought at a rising over-tight cost.
- DELETED. docs/logs/m1/c17-sweep.md and c17-rows.csv stay in the repo
  as the evidence it failed; poc/m1/arbiter/c17.mjs is removed.
- Lesson: closing every labelled leak by reading the leak rows
  themselves is the memorisation trap by construction, LOVO and the
  same-day blind exam both confirmed it doesn't transfer, and the
  process itself broke the clean-exam wall it was supposed to respect.
  Named word lists read off failing rows are now off the table for
  goal 2; derivation has to come from the corpus, not from the leak
  list.

### M1-C18 — party-noun derivation, mechanical bar, zero admitted (2026-09-09)

- Goal 2 attempt, corpus-derived this time per D30 rule 5: candidate
  head nouns on PUT/DELETE/PATCH rows, admitted only at n>=3 rows and
  x-share>=75%, and only if the candidate survives leave-one-vendor-out
  (qualifies with every contributing vendor held out in turn). Not
  hand-picked; not tuned to the leak rows.
- First run on the original 1478-row labelled corpus: 6 nouns
  qualified (member, team, role, message, membership, rol); all were
  already in PARTY_NOUNS/SHARED_NOUNS or failed LOVO. 0 admitted.
- Re-run on the combined corpus after exam 2 was added (2472 rows: the
  1478 plus exam 2's 994 scorable rows): 11 nouns qualified, still 0
  admitted — order, rol, appointment, password, owned, security all
  qualified on the full set but failed with at least one vendor
  removed, rejected as memorisation.
- Score, unchanged at both corpus sizes: 10 goal-2 leaks / 178 goal-1
  errors on the original 1478; 91 goal-2 leaks / 277 goal-1 errors on
  the 2472-row combined corpus, before and after adding the (empty)
  admitted set.
- Named check, no hinting: owner, credential, username, password were
  looked for specifically at the user's earlier suggestion. owner did
  not qualify (0 PDP rows); credential did not qualify (1 row, 0%
  x-share); username and password do not appear as a head noun
  anywhere in the corpus at this size.
- Lesson: the mechanical bar is honest but the corpus was still too
  thin — several near-miss candidates (order, password) had only 4-5
  examples total. Left open explicitly: does more data admit more
  words, or is the blocklist shape itself the problem? Both were tested
  next.

### M1-C19 — same derivation, bigger corpus: one word survives (2026-09-09)

- Same c18 derivation, unchanged (n>=3, x-share>=75%, LOVO-gated), run
  once more after exam 3 was added: combined corpus 5465 rows (1478 +
  994 exam-2 + 2993 exam-3 scorable rows), 332 distinct providers.
- 15 nouns qualified this time (member, permission, owned, security,
  membership, call, collaborator, owner, participant, organizer,
  subuser, invitation, admin, webinar, psu). 1 ADMITTED: `owner` — 7
  PDP rows, 5 vendors, survives every vendor held out in turn.
- Learning curve of admissions by corpus size: 1478 rows -> 0 admitted;
  2472 rows -> 0 admitted; 5465 rows -> 1 admitted (owner). More data
  did move the needle, but by exactly one word.
- Effect of adding `owner`, full 5465-row corpus: goal-2 leaks 280 ->
  274 (closes 6 of 280), goal-1 errors 625 -> 626 (costs 1 over-tight).
  On the original 1478 rows alone the addition changes nothing (10
  leaks both before and after) — the 6 closed leaks all live in the
  new exam material.
- Lesson: the blocklist (third-party noun) shape is not dead, it is
  just starved — one admission per ~1800 rows of PUT/DELETE/PATCH
  evidence at this bar is real signal, not noise, but it will not close
  280 leaks at this rate without a lot more labelled data. That
  pointed straight at the user's inversion idea, tested next as C20.

### M1-C20 — the inversion: an allowlist of "yours" nouns (2026-09-09, the user's idea)

- Every blocklist attempt (C16-C19) tried to learn which nouns mean
  "someone else's thing" and failed to transfer, because every vendor
  invents its own third-party noun and they don't repeat across
  vendors. C20 inverts the question: learn an ALLOWLIST of "yours"
  nouns (project, file, record, config, zone, ...) instead, and treat
  the ABSENCE of a known "yours" noun on a PUT/DELETE/PATCH floor row
  as the evidence for x.
- Layered on c15, changing nothing before it: only PUT/DELETE/PATCH
  rows c15 already leaves at the w floor (floor:true, no c15 word rule
  fired) are eligible. If the row has at least one cleaned head noun
  and every one is on the allowlist, it stays w; otherwise it raises to
  x under rule 'no-own-noun'. Never lowers, never touches r; GET and
  POST pass through untouched.
- Measured leave-one-vendor-out (the allowlist rebuilt from every OTHER
  vendor's rows, then scored on the held-out vendor), over all 5465
  combined rows. Numbers below are the LOVO ones, the only honest read
  — every point looked much better fitted (allowlist built and scored
  on the same rows) and every point collapsed going to LOVO, at one
  point 2 fitted leaks becoming 41 LOVO leaks. Full nine-point sweep
  (minN in {2,3,5} x minW in {0.80,0.90,0.95}) is in
  docs/logs/m1/c20-sweep.md.

  | config | leaks | real over-tight (a rule fired and was wrong) | flagged unknown (no evidence, went safe) |
  |---|---|---|---|
  | c15 today | 297 (5.4%) | 522 (9.6%) | 152 (2.8%) |
  | C20 loose (n>=2, minW 0.80, 439 words) | 89 (1.6%) | 522 (9.6%) | 1397 (25.6%) |
  | C20 tight (n>=5, minW 0.95, 106 words) | 29 (0.5%) | 522 (9.6%) | 2725 (49.9%) |

- Every LOVO point on the sweep beat the c15 baseline by a wide margin
  (29-89 leaks vs 280-297), the opposite of what happened to the
  blocklist attempts, where LOVO admitted zero transferable words at
  every corpus size. An allowlist of "yours" words carries real,
  non-zero signal across held-out vendors that a blocklist of "their"
  words did not. The honest cost is steep: flagged-unknown rows (rows
  with no evidence, sent safe rather than guessed) rise sharply as the
  bar tightens, from a quarter of all rows at the loose end to half at
  the tight end.
- Contested words, settled by measured lean rather than by taste, per
  the user's instruction: network, device, person, customer, contact,
  partner all sit in both the general candidate pool and c11.mjs's
  hand-written PARTY_NOUNS. All six measured as leaning "yours" (w) on
  PUT/DELETE/PATCH rows, at 83.3%-100% w-share. Three agreed with the
  user's own expectation (device, person, contact); three disagreed
  (network, customer, partner — the user expected these to read as
  third-party and the data says otherwise). This currently has NO
  scored effect: c15's own PARTY_NOUNS rule fires before a row can ever
  reach the w floor and become eligible for the C20 layer, so acting on
  the lean means editing PARTY_NOUNS in c11.mjs, and that edit has NOT
  been made. Open.
- THE PROPERTY THAT HELD EVERY TIME, across every goal-2 pass run
  today (C16 through C20): every leak ever measured — 10 on the
  original labelled set, 25 on exam 1, 81 on exam 2, 189 on exam 3, 297
  on the combined corpus — landed on a floor row, one the tool had
  already flagged as having no evidence. Zero leaks have ever come from
  a row where a word rule actually fired. 297 of 297. Also measured:
  leaks skew to the rare tail (the head noun on a caught dangerous op
  is shared by a median of 44 providers, on a missed one by 17), but
  68% of leaks still carry a noun 10+ providers share, so it is a lean
  and not a wall.
- Grounding for the long-tail question, from published sources:
  Treblle's "Anatomy of an API 2023" (1 billion requests, 9,000 APIs)
  reports an average of 22 endpoints per API and that 20% of endpoints
  go unused for 30+ days. Web request traffic follows Zipf with alpha
  measured between 0.6 and 1.0; applying that alpha to endpoint counts
  puts the top 20% of endpoints at roughly 50-70% of calls, not 80% —
  concentration is real but weaker than the common 80/20 claim. The
  alpha is borrowed from web-page traffic, not measured on API
  endpoints — stated plainly, not measured here.
- User decisions taken today, recorded in the decisions log (D46-D50):
  attack order is goal 2, then 1, then 3, GET last, one goal at a time;
  goal 2's shape is the via-negativa allowlist, adopted at the LOOSE
  bar (n>=2, minW 0.80); leaks in the 2-4% range are acceptable given
  every leak is flagged; contested words are settled by measured lean
  (this pass), acting on it is still open.
- Status: C20 is a POC in poc/m1/arbiter/c20.mjs and c20.test.mjs, not
  shipped — "never ship the POC" stands. Two things are open before it
  can graduate: the PARTY_NOUNS edit for the six contested words, and a
  fresh exam 4, since exam 1, exam 2 and exam 3 have all now been used
  to derive or admit a word (C16/C17 read exam-1/2 leak rows for
  hand-picking, C19 admitted `owner` off exam-3 evidence, C20's sweep
  was scored on all three) and are burned as blind material for scoring
  any further change to this rule.

### M1-C21 — word-by-word audit of the hand-written danger lists (2026-09-10)

- Script `poc/m1/arbiter/c21.mjs`, report
  `docs/logs/m1/c21-word-audit.md`. Read-only diagnosis; no vocabulary
  was changed. Direct measurement, not leave-one-vendor-out, because
  LIVE_VERBS/PARTY_NOUNS/SHARED_NOUNS were hand-written months earlier
  and never saw this corpus.
- Numbers: combined corpus 5465 rows, 332 providers, 8 sets, 0
  unscorable. 4406 scorable PUT/DELETE/PATCH rows (the only rows c15
  can raise on). 847 fired a word rule; 325 right (truth x), 522 wrong
  (all truth w, zero truth r). Reproduces the known 522 exactly.
- Worst words by wrong count (word, fires, right, wrong, precision):
  user 140/78/62/0.557; webhook 55/1/54/0.018; account 65/15/50/0.231;
  group 64/16/48/0.250; channel 30/4/26/0.133; token 28/6/22/0.214;
  device 23/2/21/0.087; cancel 48/28/20/0.583; contact 20/1/19/0.050;
  role 28/12/16/0.429.
- 13 words never fire at all: dial, execute, hangup, launch, refund,
  reject, people, recipient, seat, sponsorship, subscriber, tenant,
  ban. 29 words are below 0.50 precision.
- Two causes found by reading the rows, not by counting: (a) a
  part-of-speech failure — LIVE_VERBS entries matching nouns. trigger
  12 fires/0 right, run 11/2, transfer 9/2, pay 6/0 — together 38
  fires, 4 right, 34 wrong. Real rows: `DELETE /{username}/triggers/{id}
  destroyTrigger`; `PATCH /dags/{dag_id}/dagRuns/{id}
  update_dag_run_state`; `DELETE /Employer/{id}/PayRun/{id}
  DeletePayRun`; `PUT /BankTransfers/{id}/Attachments
  createBankTransferAttachment`. Also `DELETE /reboot-requests/{id}
  deleteRebootRequest` (CAMARA) — deleting a request record, nothing
  reboots. (b) nouns that mean "the caller's own thing", not "another
  party" — webhook, channel, device, contact, network, repository,
  customer: together 173 fires, 13 right, 160 wrong. (c) a third,
  smaller failure: SHARED_NOUNS scans every operationId token, so a
  word buried mid-name fires even when it is not the object — CAMARA's
  updateNotificationChannelSubscription and
  deleteNotificationChannelSubscription fire on "channel" when the
  object is a subscription.
- C20's measured "yours" allowlist
  already rates all seven of those nouns 87-100% truth-w (webhook 97%
  n=36 across 24 vendors; contact 95% n=21/13; network 94% n=16/8;
  device 92% n=24/15; repository 88% n=16/3; customer 87% n=15/9;
  channel 87% n=15/10), and also trigger (100%, n=11, 6 vendors) and
  run (100%, n=6, 5 vendors). The same words sit on both a
  hand-written "danger" list and a measured "yours" list, and c15's
  PARTY_NOUNS fires first, so the measured evidence never gets a say.
  This is D50's note showing up as 522 real rows. By contrast user
  (44% w-share, n=153), account (76%, n=68), group (71%, n=69) and
  token (74%, n=34) are NOT on the allowlist — the two lists disagree
  only where the evidence is genuinely mixed.

### M1-C22 — the allowlist wins: goal 1's answer (2026-09-10, the user's ruling)

- Script `poc/m1/arbiter/c22.mjs`, report
  `docs/logs/m1/c22-allowlist-wins.md`.
- The layer: on PUT/DELETE/PATCH rows where c15 returned class x with
  rule `live-verb` or `party-noun`, extract the row's cleaned head
  nouns exactly as C20 does; if the row has at least one noun AND
  every noun is on the "yours" allowlist, LOWER the class back to w
  with rule `allowlist-wins`. Otherwise unchanged. c15.mjs, c11.mjs and
  judge.mjs were not modified by this pass.
- This is the FIRST rule in the project that
  LOOSENS (x -> w), the one direction the project's single invariant
  guards. A wrong firing here is a leak, not a usability cost.
- Isolation, measured not assumed: C20 acts only on rows c15 left at
  the w floor; C22 acts only on rows c15 raised to x — disjoint row
  sets. Across both variants and all 16 grid points C22 changed 0 of
  the 3559 floor rows, and c20's own goal-2 leak count was unaffected.
- Two variants measured: N (rule `party-noun` only) and NV (adds
  `live-verb`). Bar swept over minN in [2,3,5,10] x minW in
  [0.80,0.90,0.95,1.00]. All headline numbers are leave-one-vendor-out,
  the allowlist rebuilt from the other 331 vendors for each of the 332
  vendors in turn; fitted numbers are reported in the doc only as a
  labelled contrast, per C20's precedent where 2 fitted leaks became 41
  under LOVO.
- LOVO grid points worth recording: N n>=2/0.80 (439 words) rescued
  160, new leaks 23; N n>=5/0.95 (106 words) rescued 61, new leaks 6,
  remaining wrong 461; N n>=10/1.00 (35 words) rescued 10, leaks 6; NV
  n>=2/0.80 rescued 203, leaks 38; NV n>=10/1.00 rescued 15, leaks 7.
  No grid point anywhere reaches zero leaks.
- Adopted point: variant N, minN=5, minW=0.95, 106-word allowlist.
  Rescued 61, new leaks 6.
- Per-set at the adopted point (rescued/leaks): camara 4/3, holdout1
  5/0, holdout2 0/0, holdout3 1/0, holdout4 2/1, holdout5 0/0, exam2
  10/1, exam3 39/1. CAMARA, the declared test bed,
  is the worst set — 4 rescued for 3 leaks — with the softening that
  CAMARA is a single vendor so LOVO holds out all 292 of its rows at
  once, the harshest possible case; across every other set the trade
  is 56 rescued for 3 leaks.
- The 6 new-leak rows, listed in full: `DELETE /networks/{networkId}
  deleteNetwork` (truth x, let through by "network"); `PATCH
  /v1/devices/{deviceId} updateDevice` ("device"); `DELETE
  /v1/devices/{deviceId} deleteDevice` ("device"); `PUT
  /2/webhooks/{webhook_id} validateWebhooks` ("webhook"); `PUT
  /v2.1/accounts/{accountId}/permission_profiles/{permissionProfileId}
  PermissionProfiles_PutPermissionProfiles` ("profile"); `PUT
  /bookings/{bookingId}/booking-contact updateBookingContact`
  ("contact", and its truth label is marked LOW confidence).
- Reading those 6 by hand: 1 is provably unlearnable — CAMARA contains
  both `DELETE /networks/{networkId} deleteNetwork` "Delete a
  dedicated network" (truth x, high confidence) and `DELETE
  /networks/{serviceId} deleteNetwork` "Delete multipoint virtual
  private network" (truth w); same catalogue, same method, same verb,
  same noun, opposite truth, so no word rule can ever split them. 2
  rest on low-confidence truth labels. 3 have a tell in the description
  (blocks network access / removes access control rules / triggers a
  CRC check) — the shape C16 already measured at zero transfer.
- The description-marker measurement run this pass over
  the 3037 PUT/DELETE/PATCH rows that carry a description (truth w
  2600, x 429), as x-hits/w-hits/precision: "affects others" (other
  users, everyone, participants, members of) 19/9/0.679; "access
  control" 2/3/0.400; "live or active" 20/42/0.323; "sends outward"
  (sends, triggers, delivers, notifies) 33/100/0.248; "irreversible"
  (cannot be undone, permanent) 5/41/0.109. Only one marker beats
  chance and it covers 28 rows in 5465 — too thin to build on. Note
  that "irreversible" is ANTI-correlated with x, independent support
  for D28's separation of a destructive axis from r/w/x blast radius.
- The one-base framing the user asked for, against 5465 rows: goal-1
  false alarms fall from 522 (9.6%) to 461 (8.4%); new misses rise
  from 0 to 6 (0.11%). Per 1000 rows: 96 false alarms and 0 misses
  become 84 false alarms and 1 miss.
- Flagging is a condition of adoption, not an optional extra: every
  row lowered by `allowlist-wins` must be marked review, never
  confident, so the 6 leaks stay visible and the project's standing
  property — never confidently wrong in the loosening direction —
  survives.

### M1-C23 — path-tail noun trial, a clean negative (2026-09-10)

- Script `poc/m1/arbiter/c23.mjs`, report
  `docs/logs/m1/c23-path-tail-noun.md`. Trial of reading the object
  noun from the path tail instead of the operationId head noun.
- `judge.mjs`'s `GENERIC_TAILS` was made exported — a one-word,
  visibility-only change (`const` -> `export const`), no behaviour
  change — so c23 could reuse the list rather than copy it, on the
  repo's "one writer per piece of state" rule. Verified
  behaviour-neutral: 254/254 tests still pass and c21 still reports
  exactly 522.
- Agreement census over 4406 scorable PUT/DELETE/PATCH rows: path-tail
  null on 353 (8.0%), operationIdHeadNoun empty on 883 (20.0%), summary
  head noun empty on 1025 (23.3%); vs operationIdHeadNoun agree 1125 /
  disagree 2052 / path-tail-only 876 / opid-only 346.
- LOVO results: A (today's nouns, n>=5/0.95) rescued 61 leaks 6; B
  (path-tail only, best at n>=10/1.00) rescued 31 leaks 5; C (union,
  best at n>=5/0.95) rescued 48 leaks 4. Path-tail loses. Of the 6 leak
  rows, path-tail fixes only 2 (PermissionProfiles and
  updateBookingContact).
- Two flaws found: path segments are not camelCase-split, so
  `IncomingPhoneNumbers` yields `incomingphonenumber` rather than
  `number`; and the brief's stated expectation that a union can only
  tighten was violated by the data, because each configuration
  rebuilds its allowlist from its own candidate table rather than
  sharing one.
- The disproved premise, recorded: the trial was motivated by
  two Discord rows (`update_webhook_message`,
  `update_original_webhook_message`) believed to be misread as
  "webhook". They are NOT among C22's 6 leak rows, and
  `operationIdHeadNoun` already resolves both to "message", which is
  already in SHARED_NOUNS, so c15 classifies them correctly as x
  today. The orchestrator's premise came from a substring grep and was
  wrong; the agent caught it and the orchestrator verified it
  directly.
- Also note the union configuration C (48 rescued / 4 leaks) was
  offered to the user as the safer alternative and not taken, because
  with flagging on a leak is not silent, so the extra 13 rescues cost
  nothing the user cares about.

### M1-C24 — PARTY_NOUNS via-negativa cleanup, measured and rejected (2026-09-10)

- The idea (the user's): apply via negativa to the last hand-written
  blocklist — take every word that measures as "yours" out of
  PARTY_NOUNS/SHARED_NOUNS and let the absence of a "yours" noun do
  the work. The user's ruling was set in advance: re-measure first;
  if it breaks goal 2, leave the list alone.
- Script `poc/m1/arbiter/c24.mjs`, report
  `docs/logs/m1/c24-party-nouns-cleanup.md`. To feed a substituted
  noun set through the real stack, `classifyC20` (c20.mjs) and
  `classifyC22` (c22.mjs) got an optional trailing `classifyBase`
  parameter that defaults to the real c15 classify. Additive,
  behaviour-neutral: 254/254 tests, c21 still 522, c22 still rescued
  61 / new leaks 6, c23 exit 0.
- Word groups over PUT/DELETE/PATCH rows of the 5465-row corpus
  (PARTY_NOUNS 32 words including c11.mjs's added 'repository',
  SHARED_NOUNS 11): YOURS (n>=5, w-share>=0.80), 9 words: contact,
  customer, device, network, partner, person, repository, channel,
  webhook (contact, person, webhook also pass at 0.95). THIRD-PARTY
  (w-share<0.50), 14: call, collaboration, collaborator, invitation,
  member, membership, participant, restriction, sponsorship, team,
  user, guild, overwrite, permission. MIXED, 14: access, account,
  assignment, group, installation, organization, role, session,
  token, emoji, message, pin, reaction, sticker. DEAD (never a
  candidate noun), 6: people, recipient, seat, subscriber, tenant,
  ban.
- Two variants: KEEP removes only the 9 YOURS words (34 of 43 words
  remain); STRIP keeps only the 14 THIRD-PARTY words.
- Important correction found during this pass — the baselines. The
  numbers quoted for goal 1 (461) and goal 2 (89) had each been
  measured with the OTHER layer switched off; nobody had run C20 and
  C22 together. The real full stack, all 5465 rows, LOVO (C20
  n>=2/0.80, C22 variant N n>=5/0.95), verified independently by the
  orchestrator:

  | config | goal-2 (x as w) | all loosening | loosening on GET | goal-1 (w as x) | goal-1 by rule |
  |---|---|---|---|---|---|
  | c15 | 280 | 297 | 17 | 625 | floor 103, live-verb 81, party-noun 441 |
  | c15+C20 | 89 | 106 | 17 | 1936 | floor 103, live-verb 81, no-own-noun 1311, party-noun 441 |
  | c15+C22 | 286 | 303 | 17 | 564 | floor 103, live-verb 81, party-noun 380 |
  | c15+C20+C22 | 95 | 112 | 17 | 1875 | floor 103, live-verb 81, no-own-noun 1311, party-noun 380 |

  Against the 5465-row base, today's combined stack (c15 + C20 + C22)
  has 95 leaks (1.7%) and 1875 false alarms (34.3%); goal 2's own
  count is 89. Of those false alarms, 1311
  (24.0%) come from goal 2's own C20 `no-own-noun` raise, 461 (8.4%)
  from the hand-written word rules (party-noun 380 + live-verb 81),
  103 (1.9%) from POST's x default. Goal 1 as closed in C22 counted
  only the word-rule share. The C20 share is the via-negativa trade
  the user accepted in D48, recorded there as "flagged unknown".
- Second finding: "flagged" is not wired in code. classifyC20 returns
  its raises with `floor: false`, so they come out looking confident;
  C22's lowered rows are not marked either. "Flagged" exists only in
  how passes were reported. Fine for a POC; must be wired before
  anything graduates.
- Third finding: "297" was mislabelled as goal 2 in the PRD, D48 and
  D49. The real goal-2 (x as w) count for bare c15 is 280 (5.1%); 297
  is ALL loosening, i.e. 280 plus 17 GET rows. Both numbers are real.
  D49's "297 of 297 leaks landed on flagged floor rows" remains true
  as a statement about all loosening.
- Scored configurations (LOVO, all 5465 rows; goal-2 / all loosening
  / goal-1 total / goal-1 by rule): cfg 0 control (full stack, real
  lists) 95 / 112 / 1875 / no-own-noun 1311, party-noun 380, floor
  103, live-verb 81. cfg 1 KEEP 97 / 114 / 1811 / no-own-noun 1319,
  party-noun 308, floor 103, live-verb 81. cfg 2 STRIP 103 / 120 /
  1811 / no-own-noun 1488, party-noun 139, floor 103, live-verb 81.
  cfg 3 STRIP with C22 off 101 / 118 / 1852 / no-own-noun 1488,
  party-noun 180, floor 103, live-verb 81. cfg 3 vs cfg 2 shows C22
  still rescues 41 rows after STRIP, so it is not redundant.
- The buried-token bypass: classifyWithNouns (c19.mjs) always tests
  the real SHARED_NOUNS in its operationId-token scan, so removed
  SHARED_NOUNS words can still fire there (39 rows under KEEP, 52
  under STRIP). This under-counts leaks. The orchestrator emulated a
  real edit with the bypass off: KEEP 99 leaks (+4 over control),
  STRIP 107 (+12). No leak disappeared under either variant.
- The 4 new leaks under KEEP with a real edit, read by hand: `DELETE
  /v1/customers/{customer} DeleteCustomersCustomer` "Delete a
  customer" (holdout1/stripe, high confidence); `DELETE
  /repos/{owner}/{repo} repos/delete` "Delete a repository"
  (holdout1/github, high); `PUT
  /v4/settings/notifications/channels toggleNotificationChannels`
  (exam2/dracoon.team, low); `DELETE
  /users/{user_id}/channels/{channel_id}
  removeAppUserFromChannel` (exam2/ritc.io, low). The two
  high-confidence rows are the lesson: `customer` and `repository`
  mean the caller's own thing when a sub-part is edited, but deleting
  the whole top-level object reaches other people. That is the fat
  tail the user asked about; it lives on customer/repository rather
  than on network.
- Verdict under the user's ruling: every variant raises goal-2 leaks
  above goal 2's own 89 (and the combined 95), so the list is left
  alone. D50's open item (edit PARTY_NOUNS for the contested words)
  is closed with a measured no.
- All 8 scoring sets are burned for a rule change; this was a
  no-change verdict, so nothing needs exam 4 to confirm it.
- Re-checked on goal 2's own ledger after the user flagged that 95
  mixed goal 1's C22 cost into goal 2's count: c15 + C20 only, C22
  off, real edit emulated — control 89, KEEP 98 (+9), STRIP 106
  (+17). Verdict unchanged and stronger. From here, each goal's count
  is reported on its own ledger; a fix's cost to another goal is
  charged to the fixing goal; combined totals appear only on a line
  labelled combined.

### Exam 4 drawn, unlabelled (2026-09-10)

- Why: exams 1-3 are burned (C19 derived from exam 3; C20 tuned
  against all three; C22/C23 scored on all three). Exam 4 is virgin
  material for scoring the goal 1 C22 layer and any future rule
  change.
- Script `poc/m1/arbiter/make-exam4.mjs`, seed 20260912, output
  `data/exam4-2026-09-12/`: blind paper `exam-blind.csv` (4000 rows,
  no class column) plus 20 part files, `exam-key.csv`, and a README.
  Truth files will be created by a later labelling pass, following
  exam 3's actual layout (separate exam-truth-partN.csv files), not
  an empty class column in the key.
- Pool: 123,339 rows / 673 providers before exclusion; 92,409 rows /
  663 providers after excluding every provider in the burned sets;
  eligible PUT/DELETE/PATCH rows 21,643 across 318 providers; drawn
  4000 rows across 318 providers, capped at 22 per provider; 17,657
  eligible rows remain unused. Method split: DELETE 1842, PUT 1582,
  PATCH 576 — PUT/DELETE/PATCH only, the same shape as exam 3
  (DELETE 1382, PUT 1169, PATCH 449).
- Exclusion used make-exam3.mjs's exact registrable-domain matching
  with its amazonaws->amazon alias. The burned-provider union is 332,
  not 332+105: every exam 1 provider was already inside the combined
  corpus. The script computes the intersection of drawn providers
  with the burned set and throws unless it is 0; it was 0.
- Reproducible: run twice, byte-identical output.
- A stated limit: the effects being measured are rare. C22's new-miss
  cost is 6 in 5465 rows (0.11%), so a 4000-row exam expects about 4.
  Exam 4 can confirm the shape holds; it cannot pin the rate to a
  decimal.
- Status: unlabelled and unscored.

### M1-C25 — exam 4 scored once; the truth drifted, the result is not comparable (2026-09-12)

- Purpose: exams 1-3 were burned (C19 derived from exam 3, C20 tuned
  on all three, C22/C23 scored on all three), so exam 4 was drawn as
  virgin material to score the frozen shapes. Script
  `poc/m1/arbiter/c25.mjs`, report `docs/logs/m1/c25-exam4-score.md`,
  run once as `node poc/m1/arbiter/c25.mjs data/exam4-2026-09-12
  docs/logs/m1/c25-exam4-score.md`. Allowlists built once from the
  full 5465-row corpus (goal-2 list 439 words at n>=2/minW 0.80;
  goal-1 list 106 words at n>=5/minW 0.95). No leave-one-vendor-out
  needed — every exam-4 provider is absent from the corpus by
  construction.
- Exam 4 itself: 4000 PUT/DELETE/PATCH rows, 318 providers, labelled
  blind by agents working 200 rows at a time. Truth totals w=2970,
  x=1006, r=24, zero '?' rows; confidence high=3158, low=842.
- Scores on all 4000 rows, each goal on its own ledger: goal 2's own
  ledger (c15 + C20) leaked 365 (9.1%) and its no-own-noun rule added
  728 false alarms (18.2%). Goal 1's own ledger (c15 + C22) left 324
  word-rule false alarms (8.1%), rescued 58 versus c15 alone, and
  added 11 leaks charged to goal 1. c15 alone leaked 684 (17.1%) with
  382 false alarms (9.6%). The combined line (c15 + C20 + C22) leaked
  376 (9.4%) with 1052 false alarms (26.3%), exact 2548.
- On high-confidence rows only (3158): c15 alone 281 leaks (8.9%);
  c15 + C20 130 (4.1%); c15 + C22 287 (9.1%); combined 136 (4.3%).
- Corpus predictions for comparison: goal 2 1.6% (D48); goal 1 522
  word-rule false alarms with 61 rescued and 6 new leaks (D51).
- The finding, and it blocks reading any of the above as a
  wild-world result: exam 4's truth is roughly twice as x-heavy as
  every comparable set. x-share by set — exam2 14.9%, exam3 12.6%,
  corpus PUT/DELETE/PATCH 13.7%, exam4 25.2% — on the same draw
  method and the same method mix. Per shared head noun exam 4 reads
  far tighter than the corpus: model +64pp, address +42pp, role
  +37pp, comment +37pp, state +36pp, event +36pp, organization
  +33pp; overall shared-noun x-share 14.1% corpus versus 25.0% exam
  4. More truth-x rows mechanically produce more x-said-w leaks.
- Cause: exam 3's labelling brief was never saved,
  so exam 4's was reconstructed by the orchestrator from D46, D20
  and D28. The reconstruction lists more roads to x and carries an
  explicit tighter-on-doubt rule. The brief is now saved at
  `data/exam4-2026-09-12/LABELLING-BRIEF.md` so this cannot recur.
- Normalised as a share of truth-x rows, the gap shrinks but does
  not vanish: c15 alone misses 68% of x rows on exam 4 against 46%
  on corpus PUT/DELETE/PATCH; c15 + C20 36% against 15%; combined
  37% against 16%.
- The calibration that measured the drift
  (`data/calibration-2026-09-12/`): 200 rows drawn from exam 3's
  blind file with a mulberry32 PRNG, seed 20260913, method mix
  DELETE 96, PUT 73, PATCH 31, relabelled blind under exam 4's brief
  (r=1, w=141, x=58; high=132, low=68). Against exam 3's stored
  truth, 177 of 200 agree (89%). Confusion old->new: w->w 150, x->x
  26, w->x 21, x->w 2, r->r 1. Flip rates: old w -> new x is
  21/171 = 12.3%; old x -> new w is 2/28 = 7.1%. Of rows the new
  brief called x, 26 of 47 (55.3%) were also x under the old
  standard. x-share on those rows moved 14.0% to 23.5%. Note as a
  reproducibility gap that the draw was done inline by the
  orchestrator, not by a committed script.
- Same 200 rows, same classifier, only the truth swapped: c15 + C20
  leaked 3 under stored truth versus 11 under new-brief truth
  (factor 3.67x); c15 alone 8 versus 21 (factor 2.63x).
- Corrected estimates for exam 4's 9.1%: 2.5% by the leak-ratio
  estimator — which rests on only 3 leaks and is too thin to trust
  — and 5.0% by the surviving-x-rows estimator, which rests on 47
  rows and is sturdier. The corpus prediction is 1.6%. Exam 4
  back-solved to the old standard gives w about 3335 and x about
  641, an x-share of 16.1% against exam 3's 12.6%.
- Honest reading: goal 2's real-world leak
  rate is somewhere around 2.5-5% against 1.6% predicted. Drift
  explains most of the 9.1% but not all of it, so goal 2 looks
  genuinely somewhat worse in the wild. Goal 1 transferred cleanly —
  58 rescued and 11 leaks against 61 and 6 predicted.
- Labelling process notes: labellers invented a `medium` confidence
  value the brief does not define; 276 such values across parts 3,
  5, 6, 11, 15, 16, 17, 18 and 19 were converted to `low` by the
  orchestrator on the rule "high only if genuinely sure, anything
  less is low". That widens the error band in the safe direction
  but is not the labellers' own judgement — the one labeller that
  resolved its own medium rows split them roughly half high and half
  low, so the high-confidence share is understated. Part 20 was sent
  back once to re-apply road 1 to money-moving and live-session rows
  and moved 5 rows from w to x (createCreditNoteAllocation,
  PUT_CancelCreditMemo, Object_PUTRefund, stopLiveStream,
  stopTranscoder).
- OPEN, not decided: two options were put to the user and neither is
  chosen. Option A, label about 600 more exam-3 rows under the new
  brief to turn 3 leaks into 10-15 and collapse the 2.5-5% range
  into a single number, then restate exam 4 against the old
  standard. Option B, relabel all 4000 exam-4 rows with a brief
  written to match exams 2 and 3, giving one consistent standard
  everywhere at roughly ten times the cost. The orchestrator
  recommended A. No decisions-log row exists yet because the ruling
  has not been made.

### M1-C26 rejected; goal 2 rebuilt clean in poc/m1/goal2 (2026-09-12)

- M1-C26: delete the 43-word hand-written PARTY_NOUNS+SHARED_NOUNS
  list and make the yours-allowlist exclusive of it. Goal-2 ledger
  89 -> 95 (+6, 0 rescued). REJECTED. The 6 were all buried-token
  rows (`permission` x5, `guild` x1) that only the old rule's
  every-token scan caught. An earlier scratch measurement had said
  89 for this shape; it was wrong because it injected an empty noun
  set into c19's classifyWithNouns, which keeps a hardcoded
  SHARED_NOUNS token scan alive. Lesson: measure the real edit,
  never an injection.
- Root cause of the contradiction: five files each carry their own
  copy of METHOD_FLOOR and their own variant of step 1 (c15, c18,
  c19, c26, derive-nouns) and they have drifted. arbiter.mjs exports
  39 functions, the goal-2 path uses 6; judge.mjs exports 22, the
  path uses 7. The live shape was written down from the code as
  `docs/product/goal2-solution.md`.
- Clean rebuild in `poc/m1/goal2/` (goal2.mjs 91 lines, measure.mjs,
  goal2.test.mjs; 342 lines total vs 6728 in the c* pass files). One
  floor table, one verb rule, one noun layer. The only behavioural
  change from the frozen shape: the yours-noun layer reads EVERY
  noun token in the operation name (verbs stripped), not just the
  two head nouns -- and the hand-written third-party list is gone
  entirely. Reuses judge.mjs/arbiter.mjs primitives; imports c11's
  LIVE_VERBS and READ_VERBS; does not import PARTY_NOUNS or
  SHARED_NOUNS.
- Numbers (5465 rows, 332 vendors, leave-one-vendor-out, allowlist
  bar minN=2 minW=0.80 unchanged):

  | shape | goal-2 leaks | goal-1 false alarms (info) | all-loosening |
  |---|---|---|---|
  | GATE -- frozen (c15 + C20), reproduced through the new harness | 89 | 1936 | 106 |
  | NEW -- classifyGoal2 | 37 | 2727 | 54 |
  | NEW, verbs only, no noun layer | 527 | 184 | 544 |

- The gate printed exactly 89, so the old measurements reproduce;
  the housing was the problem, not the numbers. 65 rescued, 13 new
  leaks, net -52. All 37 remaining leaks are floor rows (flagged, no
  evidence fired): DELETE 18, PUT 14, PATCH 5; 27 distinct vendors;
  4.0% of the 936 truth-x rows. Tests 16/16.
- Goal 2 ledger (own ledger, never blended): frozen 89 -> candidate
  37. Cost charged to goal 1: +791 false alarms (1936 -> 2727), i.e.
  flagged rows rise from about a third to about half.
- Status: candidate, NOT adopted, NOT exam-checked. Measured on the
  tuning corpus under LOVO only -- the same footing as the 89, so
  the comparison is fair, but neither number is a clean-exam number.
  Next: a proper broad exam with its labelling brief saved to the
  repo before any row is labelled.

### Goal 2 frozen at 37; goal 1 reopened; layers split (2026-09-12)

- Goal 2's rebuilt shape (poc/m1/goal2) is frozen at 37 leaks (4.0%
  of 936 truth-x), down from 89, provisionally -- a clean exam may
  still move it (D54). The hand-written PARTY_NOUNS/SHARED_NOUNS
  lists are not part of the frozen shape; D52's "keep the list"
  ruling applied to the old shape only, so it does not carry over.
- Goal 1 reopens at 2727 false alarms (was 1936), the +791 charged to
  goal 1's ledger as the cost of goal 2's freeze (D55). M1-C22 /
  D51's lower-back layer is void: the party-noun rule it lowered
  back no longer exists, so there is nothing left for it to undo.
- Code split into poc/m1/{core,goal1,goal2,goal3,run}: core holds the
  floor table and shared primitives; each goal is its own layer, one
  direction of travel; run/pipeline.mjs fixes one order (verbs ->
  goal 2 -> goal 1 -> goal 3) and throws if a layer moves a row the
  wrong way; run/ledger.test.mjs pins each goal's number. The old
  poc/m1/arbiter/c*.mjs pass files are frozen history, not built on
  again (D56, commit dd16c52).

### Goal 1 measured: where the 2727 false alarms come from (2026-09-13)

- By rule: no-own-noun 2543 (DELETE 1159, PUT 1027, PATCH 357), POST
  floor 103, live-verb 81 (DELETE 46, PUT 24, PATCH 11).
- Among the 2543 no-own-noun rows: 16 raised with no nouns at all.
  Blocking words per row: 1 word 1414, 2 words 724, 3 words 232, 4+
  words 157. 1526 distinct blocking words, 780 of them on one row
  only. Top blockers: user 145, account 110, v1 76, group 72.
- A random 15-row sample: most blocking words are ordinary nouns not
  on the yours list (token, request, synonym, group, log, period,
  key) -- not third-party nouns, just nouns the allowlist has not
  seen.
- Tried stripping judge.mjs's OWN_VERBS (36) from the noun set: frees
  29 false alarms but moves goal 2 from 37 to 38 leaks. Not adopted
  -- goal 2's ledger is frozen (D54).
- Lessons, both withdrawn: an earlier claim that the operationId
  splitter bug was a big contributor to goal 1 was made before
  measuring it -- it frees only 24 (see next entry). A claim that "a
  word list won't work for goal 1" was made from goal 2's history
  without ever measuring goal 1 -- also withdrawn.

### Splitter into core: '/' and whitespace (2026-09-13)

- The operationId splitter moves into `poc/m1/core/` and also splits
  on `/` and whitespace, not only `_ - .` and camelCase -- the old
  splitter in arbiter.mjs left `gists/unstar` as one token. It now
  reaches the verb rules, the noun set and the allowlist build (D58).
- Measured LOVO over 5465 rows: 176 rows touched across 11 vendors;
  goal 2 unchanged at 37; goal 3 unchanged at 49; goal 1 falls 2727
  -> 2703; the old-shape gate still reproduces 89 exactly. Goal 1's
  pin moves 2727 -> 2703 at the user's word.
- Lesson: the split has to reach the allowlist build too, not only
  the pipeline's read of the row -- a pipeline-only split gave 2713,
  not 2703, because the allowlist itself was still built from
  unsplit tokens.

### MCP hints measured, GET ruling (2026-09-13)

- Mapping considered: `readOnlyHint` = class r; `idempotentHint` =
  class r or w; `destructiveHint` and `openWorldHint` have no r/w/x
  signal (D28) and stay at the MCP default of true.
- Hinting every row: `readOnlyHint` wrong on 17 rows, all GET floor
  rows (13 truth x, 4 truth w); `idempotentHint` wrong on 50 rows.
- Hinting only evidence rows (floor:false, 3273 of 5465 rows): zero
  wrong on both hints. 2192 floor rows would go unhinted (POST 445,
  GET 550, PUT 403, PATCH 177, DELETE 617). Of GET's 550 rows, truth
  is r 533 / w 4 / x 13.
- Ruling (D59): GET's `readOnlyHint` follows the class -- floor r, so
  `readOnlyHint` true -- accepting the 17-row, 3.1% cost. No code
  emits hints yet (M3); parked while goal 1 is open.

### Word lists moved to their owners (2026-09-13)

- Goal 1 piece 2 (D57): moved `LIVE_VERBS` (26) and the yours-noun
  allowlist build out of `core/core.mjs` and `core/corpus.mjs` into
  `goal2/lists.mjs` and `goal2/allowlist.mjs`; moved `READ_VERBS` (14)
  into `goal3/lists.mjs` and its rule into `goal3/goal3.mjs`. Core now
  holds only the floor table, the operationId splitter, and row
  loading (`core/corpus.mjs`'s 5465/332 asserts) -- no word list, no
  noun table. A new `run/context.mjs` assembles the full run context
  (core's rows + goal 2's LOVO allowlist + the frozen replay pair) for
  `measure.mjs`, `proof.mjs` and `ledger.test.mjs`. `run/pipeline.mjs`'s
  base layer is renamed `verbs` -> `floor`, calling `core.mjs`'s new
  `classifyFloor` instead of the retired `classifyByVerb`.
- The POST read-verb rule moved with `READ_VERBS`, from the base layer
  into goal 3's layer (last in the pipeline: floor -> goal2 -> goal1 ->
  goal3). Checked before moving it: all 64 rows the rule lowers are
  truth r (0 truth w, 0 truth x), so the move costs goal 1 and goal 2
  nothing.
- Surfaced by the move, not by the brief: `run/proof.mjs` classified at
  `upTo: 'goal2'` for all three goals' CSVs, which used to be
  equivalent to the full pipeline (goal 1 and goal 3 were both
  pass-through). Once the read-verb rule lives in goal 3, `upTo:
  'goal2'` no longer reaches it, and goal 3's over-tight count jumped
  49 -> 113 (the 64 read-verb rows, all truth r, stuck at the x floor).
  Fixed to match `run/ledger.mjs`'s own rule: each CSV is classified at
  its own goal's stage -- goal2.csv at upTo 'goal2', goal1.csv at
  'goal1', goal3.csv at 'goal3' -- so a later goal's layer (once goal 1
  starts lowering rows) can never leak into an earlier goal's ledger or
  CSV.
- Proof it is a pure move: `node --test` on core/goal1/goal2/goal3/run's
  *.test.mjs -- 42 pass, 0 fail (list-copy equality tests added,
  comparing each goal's copy against c11.mjs, frozen history). `node
  poc/m1/run/measure.mjs` reproduces GATE 89/1936/106, NEW 37/2703/54,
  VERBS 524/185/541, 13 regressions / 65 rescues, byte-for-byte
  unchanged. `node poc/m1/run/proof.mjs` -- all six SELF-CHECK rows
  PASS, ledger 89/37, 1936/2703, 49/49. `git diff --stat run-proof/
  docs/logs/m1/goal2-clean.md` shows no diff at all, not even the
  run-date line. `grep -rn "LIVE_VERBS\|READ_VERBS\|c11.mjs"` across
  core/goal1/goal2/goal3/run: zero hits in core; goal3 does not import
  goal2's lists and vice versa (each has its own copy, checked only in
  tests against c11.mjs).
- Lesson: a "pure move" of a list can still move a *rule's effective
  position* in a pipeline, even when the list's contents and the row
  outcomes end up identical -- any caller that hardcodes a stop-point
  (`upTo`) has to be re-checked against where the moved rule now runs,
  not just against the final numbers.

### Goal 1 piece 3 — lowering-verb rule (2026-09-13)
- Goal: give goal 1 its own lower-back rule, mirroring goal 2's shape in the
  opposite direction -- a mined leave-one-vendor-out list of summary lead
  verbs that lowers a PUT/DELETE/PATCH row still at x back to w, flagged.
- The pile (every PUT/DELETE/PATCH row still at x after goal 2, any rule):
  2600 truth-w, 568 truth-x, 17 truth-r (3185 rows).
- Bar sweep (vendors excluded = the row's own vendor; non-x share measured
  over the rest):
  ```
  vendors>=3 non-x>=0.90  fix  262  leak  30 (17 vendors)  r 0  words 12: PATCH update, PUT enable, PUT mark, PUT edit, PATCH patch, PUT save, PATCH partially, DELETE reset, PUT replace, PUT stop, PUT create, DELETE unfollow
  vendors>=3 non-x>=0.95  fix   74  leak   1 (1 vendors)  r 0  words 8: PUT enable, PUT mark, PUT edit, PATCH patch, PUT save, PATCH partially, DELETE reset, PUT stop
  vendors>=3 non-x>=1.00  fix   74  leak   1 (1 vendors)  r 0  words 8: PUT enable, PUT mark, PUT edit, PATCH patch, PUT save, PATCH partially, DELETE reset, PUT stop
  vendors>=5 non-x>=0.90  fix  241  leak  29 (16 vendors)  r 0  words 8: PATCH update, PUT enable, PUT mark, PUT edit, PUT save, PUT replace, PUT create, DELETE unfollow
  vendors>=5 non-x>=0.95  fix   53  leak   0 (0 vendors)  r 0  words 4: PUT enable, PUT mark, PUT edit, PUT save
  vendors>=5 non-x>=1.00  fix   53  leak   0 (0 vendors)  r 0  words 4: PUT enable, PUT mark, PUT edit, PUT save
  vendors>=8 non-x>=0.90  fix  221  leak  26 (15 vendors)  r 0  words 5: PATCH update, PUT mark, PUT edit, PUT replace, PUT create
  vendors>=8 non-x>=0.95  fix   33  leak   0 (0 vendors)  r 0  words 2: PUT mark, PUT edit
  vendors>=8 non-x>=1.00  fix   33  leak   0 (0 vendors)  r 0  words 2: PUT mark, PUT edit
  ```
  Adopted bar: vendors>=5, non-x>=0.95 -- 53 fixed, 0 leaks, 4 words (PUT
  enable, mark, edit, save).
- A noun-list candidate (raise-only nouns already on the wall, tried in the
  lowering direction) was measured and NOT adopted: best variant fixed 102
  rows at a cost of 5 leaks; the zero-leak bar on the same list gave only
  7 fixed for 1 leak -- worse on both axes than the verb list.
- Caller-phrase and path candidates were measured and NOT adopted: a
  summary caller-phrase check fixed 21 rows for 3 leaks; a description
  caller-phrase check fixed 113 for 29 leaks; a caller-shaped path check
  (GitHub's /user/... convention, generalised) fixed 59 for 6 leaks. None
  cleared the zero-leak bar the verb list did.
- Reading bugs surfaced in goal 2's noun set while auditing candidates
  (goal 2 is frozen, so fixing these needs the user's ruling, not done
  here): placeholder tokens like `{id}` leaking into the noun set (29
  rows touched, 0 leaks if cleaned); bare version segments like `v1` (8,
  0); filler words that survived cleaning (21, 0); verbs misread as nouns
  (40, 1 leak if cleaned). Left exactly as-is; called out for the user.
- Outcome: goal 1 moves 2703 -> 2650 (53 fixed), leak cost stays 0 (goal 2
  still 37 at the goal-1 stage). Files: `poc/m1/goal1/lists.mjs` (new,
  `buildGoal1LowerVerbs`), `poc/m1/goal1/goal1.mjs` (piece 3's rule),
  `poc/m1/run/context.mjs` (builds goal 1's pile and `lowerVerbsFor`),
  pins updated in `run/ledger.test.mjs` and `run/proof.mjs`.
- Lesson: the operation name alone separates safe writes from dangerous
  ones badly even for a single verb -- "delete" alone splits 591 w vs 93 x
  in this corpus. The next evidence to read, still untouched today, is
  the description text; the reading bugs found above are all evidence
  this pass could see but wasn't asked to fix.
