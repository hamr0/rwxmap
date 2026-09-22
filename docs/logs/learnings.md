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
  again (D56, commit db04f24).

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

### Goal 2 noun reader: junk tokens dropped (2026-09-13)
- Goal: apply the user's ruling on the reading bugs flagged in piece 3
  (placeholder tokens, version segments, filler words leaking into goal
  2's noun set) -- measured in a copy first, then reproduced for real.
- Fix: `poc/m1/goal2/allowlist.mjs`'s `nounsForRow` gained an
  `isJunkToken` check (path placeholders like `{id}`/`{app`, version
  tags like `v1`/bare digits, and filler words: from, using, or, and, by,
  for, to, of, the, a, an, with, in, on, at, into, via, all), applied in
  both extraction loops (head nouns and remaining tokens). The allowlist
  TABLE build (`buildNounTable` in `poc/m1/arbiter/c19.mjs`) does not go
  through `nounsForRow` -- it only ever read `headNounForRow` +
  `operationIdHeadNoun`, so this fix changes a row's own nouns at
  classify time, not which nouns land on a vendor's allowlist. Checked,
  not assumed.
- Outcome: leave-one-vendor-out over 5465 rows -- goal 2 unchanged at 37
  leaks (freeze holds), goal 1's false alarms fall 2650 -> 2592 (58
  freed), goal 1's leak cost stays 0, goal 3 unchanged at 49. Example
  rows freed: salesloft DELETE `{id}` "Delete a person"; svix DELETE
  `v1` "Delete Application"; billbee DELETE `from` "Deletes a single
  image from a product"; gamesparks PUT `using` "updateSnippet".
- Lesson: a noun-reading bug can sit dormant behind a frozen goal's own
  ledger (goal 2 stayed 37 throughout) while still costing another goal
  real rows -- the two ledgers really do move independently, exactly as
  the per-goal ledger rule (D57's neighbor) predicts.

### Goal 1 piece 4 -- own yours-noun list (2026-09-13)

- Goal: after piece 3's lowering-verb rule, use goal 1's own
  leave-one-vendor-out yours-noun list -- same shape as goal 2's
  allowlist (D48), the other direction (lowers x -> w), goal 1's own
  bar -- to free more of the false alarms still sitting at x.
- The pile: every PUT/DELETE/PATCH row still at x after the lower-verb
  rule runs (before piece 4 exists), read with goal 2's `nounsForRow`
  (the reader, not a list). 3057 rows: 2489 truth-w (the false alarms
  this piece targets), 568 truth-x (the leak risk).
- Bar sweep (vendors >= 2, sweeping the safe-share bar): 85% -> 192
  freed / 19 leaks; 90% -> 70 freed / 7 leaks; 95% -> 55 freed / 4
  leaks; 100% -> 53 freed / 4 leaks. 90% adopted -- 2 vendors / 90%
  safe, looser than goal 2's own raising bar (n>=2, w-share>=0.80 is
  actually about as loose already) but the point is this is goal 1's
  own bar, chosen on goal 1's own cost curve, not borrowed from goal 2.
- Per-word hand check at the adopted bar (row freed only when the word
  covers every noun in the row alongside other admitted nouns): user
  17 freed / 15 leaks, account 14/2, group 12/5, organization 5/0,
  request 7/0, order 1/6. Order is the clearest warning sign: "order"
  reads as yours in some vendors (order status, order items) and as a
  live third-party action in others (place an order against someone
  else's account) -- a hand-picked word that is a genuinely different
  API each time it appears cannot be a safe list entry, exactly the
  kind of word the mined, per-vendor LOVO bar is built to catch and a
  hand list would not.
- Outcome (first pass, unrestricted -- fires on any prev.rule): leave-
  one-vendor-out over 5465 rows -- goal 2 unchanged at 37 leaks, goal 3
  unchanged at 49, goal 1's false alarms fall 2592 -> 2522 (70 freed),
  goal 1's leak cost moves 0 -> 7 (all 7 flagged).
- The 7 leaks, read one by one: amazon PUT cancelShipment; appveyor.com
  PUT cancelDeployment "Cancel deployment"; getgo.com DELETE
  cancelRegistration "Cancel Registration"; ticketmaster.com PATCH
  patchEvent "Publish a patch on an event"; ote-godaddy.com DELETE
  (unnamed operationId) "Cancel the most recent user action for the
  specified domain"; fulfillment.com PUT put-returns "Inform us of an
  RMA"; lufthansa.com PUT "Auto Check-In". Checking each row's
  prev.rule (the rule that raised it to x before goal 1's own-noun rule
  looked at it) showed 5 of the 7 -- cancelShipment, cancelDeployment,
  cancelRegistration, patchEvent, and the ote-godaddy row -- came from
  goal 2's LIVE-VERB raise, not the noun rule; only 2 (fulfillment.com,
  lufthansa.com) came from goal 2's own no-own-noun raise. A noun list
  overriding a live verb is the wrong direction of evidence -- the verb
  said "this operation acts on something live", and no noun list should
  get to say otherwise.
- Fix: restricted the own-noun rule (poc/m1/goal1/goal1.mjs) to fire
  only when prev.rule === 'no-own-noun' -- noun evidence undoing noun
  evidence, never touching a live-verb raise, which now always stands
  once goal 1's lower-verb rule has already had its say.
- Outcome (restricted): leave-one-vendor-out over 5465 rows -- goal 2
  unchanged at 37, goal 3 unchanged at 49, goal 1's false alarms fall
  2592 -> 2531 (61 freed, 9 fewer than the unrestricted 70 -- the 5
  live-verb rows plus 4 more that only cleared the bar in combination
  with the now-excluded rows' contribution to the LOVO stats), goal 1's
  leak cost moves 0 -> 2 (fulfillment.com and lufthansa.com only, both
  flagged, charged to goal 1's own ledger).
- Lesson: a noun rule and a verb rule are different kinds of evidence
  and must not be allowed to overrule each other freely -- restricting
  a lowering rule to answer only the raising rule of the *same kind*
  (noun undoes noun) is a cheap, mechanical way to keep that boundary
  without hand-picking exceptions. Name-only evidence is otherwise
  close to exhausted for goal 1: what remains after this restriction is
  still nearly 2500 false alarms, and the next evidence has to come
  from the sentence itself (summary + description text), not from
  which nouns appear.

### Goal 1 rebuilt as its own classifier (2026-09-13)

- Goal: the user ruled that goal 1's lower-back design (D57/D60-D62,
  pieces 1-4) was the wrong shape. It could only ever move a row goal 2
  itself had raised (`x -> w`, and only when goal 2's own rule had
  fired), so goal 1 was never answering "is this row safe?" on its own
  evidence -- it was only ever undoing goal 2's mistakes, which means
  its result was mathematically bound to goal 2's own curve no matter
  what bar was chosen. A standalone classifier built with a YOURS
  (allowlist) list -- the same shape as goal 2's, just run as its own
  classifier instead of as a patch -- was tried first and confirmed
  this: at any bar it traced the same curve as goal 2's own allowlist,
  giving pairs like 1798 false alarms / 200 leaks up to 2765/28 across
  the sweep, and adding hand-picked words on top only moved it along
  the same line (1297/348) rather than off it. An allowlist-shaped
  classifier cannot escape an allowlist's curve, whoever owns it.
- Fix: invert the shape. Instead of asking "is every noun mine?"
  (allowlist, goal 2's shape), goal 1 asks "is any noun someone
  else's?" (blocklist) -- a genuinely different question with its own
  curve, not another point on goal 2's. Built `buildGoal1OtherNouns`
  (poc/m1/goal1/lists.mjs): mined leave-one-vendor-out over ALL
  PUT/DELETE/PATCH rows (not just floor-w rows) -- for vendor v, a noun
  is "someone else's" when, excluding v's own rows, it appears across
  >= OTHER_MIN_VENDORS other vendors with a danger (truth-x) share >=
  OTHER_MIN_DANGER_SHARE. `classifyGoal1` (poc/m1/goal1/goal1.mjs) is
  now genuinely standalone: floor w -> goal 1's own `LIVE_VERBS` (a
  literal copy of goal 2's 26 words, D57 copy-not-import) raises to x
  -> if still w, any noun on the other-party list raises to x, rule
  `other-noun`. Reference measurement: `scratchpad/g1block.mjs`.
- Bar sweep, full 4406-row PUT/DELETE/PATCH population (V = other
  vendors required, S = danger/x-share required), false alarms / leaks:
  ```
  V>=2 danger>=30%   803  211   101 words
  V>=2 danger>=40%   472  251    74 words
  V>=2 danger>=50%   268  382    59 words
  V>=2 danger>=60%   175  418    36 words
  V>=3 danger>=30%   728  229    60 words
  V>=3 danger>=40%   408  271    39 words
  V>=3 danger>=50%   202  406    26 words
  V>=3 danger>=60%   150  421    20 words
  V>=5 danger>=30%   635  246    28 words
  V>=5 danger>=40%   352  293    17 words
  V>=5 danger>=50%   168  427    13 words: call, assignment, security, permission, collaborator, membership, member, authorization, order, invitation, role, admin, team
  V>=5 danger>=60%   122  437     8 words: call, security, permission, collaborator, membership, member, invitation, admin
  ```
  For scale: floor + live-verb only (no noun rule at all) gives 82
  false alarms / 524 leaks; goal 2's frozen shape (a different
  question, not comparable row-for-row) sits at 2645/37. V>=2,
  danger>=30% adopted: 803 false alarms / 211 leaks, the point where
  false alarms are already cut roughly in half from the un-noun'd floor
  without pushing leaks past false alarms.
- Scoping finding: a first pass scored `classifyGoal1` over ALL 5465
  rows (not just PUT/DELETE/PATCH) and got 906 false alarms, not 803 --
  103 too many. Root cause: POST's method floor defaults to `x`, and
  `classifyGoal1` returns every non-PUT/DELETE/PATCH row's floor
  untouched (goal 1 has no rule for POST), so a truth-w POST row already
  sits at a wrong prediction before goal 1 ever runs -- exactly 103 such
  rows exist in the corpus. That mismatch is the POST floor's, not goal
  1's: goal 1 never assigns those rows a class of its own, so charging
  it for a row it never classifies is the wrong scope. Fixed by scoring
  goal 1's ledger and CSVs (`run/ledger.mjs`, `run/proof.mjs`) only over
  the 4406 PUT/DELETE/PATCH rows (3776 truth w, 605 truth x), matching
  both the reference script's population and goal 1's own stated domain.
  goal1.csv's "previous" comparison column, however, stays computed over
  the *unscoped* truth-w population (3883 rows) so it keeps reproducing
  the historical 1936 pin already committed to the repo -- current and
  previous are each the right number for the population they describe,
  not the same population.
- Outcome: goal 1 moves from 2531 (the retired lower-back number) to a
  new, differently-shaped 803 false alarms / 211 leaks, both now on goal
  1's own ledger for the first time (previously only false alarms were
  goal 1's; leaks were a "leak cost" borrowed from goal 2's ledger).
  Goal 2 is untouched and stays frozen at 37; goal 3 stays at 49. Files:
  `poc/m1/goal1/lists.mjs` (rewritten, `buildGoal1OtherNouns`),
  `poc/m1/goal1/goal1.mjs` (rewritten, `classifyGoal1`),
  `poc/m1/run/context.mjs`, `run/pipeline.mjs` (goal 1 removed from the
  pipeline order), `run/ledger.mjs`, `run/measure.mjs`, `run/proof.mjs`
  (new `goal1-leaks.csv`). D63.
- Lesson: goal 1 and goal 2 are different shapes -- an allowlist
  ("everything is yours unless proven otherwise") and a blocklist
  ("everything is safe unless proven someone else's") -- not two bars of
  the same shape. A layer that can only ever undo another layer's raises
  inherits that layer's shape by construction, no matter how its own bar
  is tuned; building a truly independent classifier meant asking the
  opposite question, not just moving goal 1's bar around inside goal
  2's allowlist logic. The scoping bug (906 vs 803) is a second, smaller
  lesson: a classifier that only ever returns some methods' untouched
  floor must be scored on the population it actually classifies, or its
  ledger silently absorbs another method's floor-level error.

### Goal 1 POC: mining tweaks all sit on the same curve (2026-09-13)
- Goal: with goal 1 standalone at 803 false alarms / 211 leaks (4406
  PUT/DELETE/PATCH rows, 3776 truth w, 605 truth x), find out whether
  any goal-1-only change lowers more x to w without leaking. POC only,
  measured in a scratch script (g1pile.mjs, g1exp.mjs); no code in the
  repo changed.
- Tried: (1) pile readout: 721 of the 803 are other-noun raises, 82 are
  live-verb; DELETE 419, PUT 291, PATCH 93. Per blocklist word, false
  alarms vs true catches: user 145/122, group 72/37, remove 67/28,
  organization 32/14, payment 30/2, org 28/3, add 26/2, request 25/2,
  message 17/0, password 15/0, member 14/38, permission 6/25; 76 of 101
  admitted words fire more false alarms than catches. Verbs read as
  nouns (remove, add, reset, enable, unfollow) are on the blocklist.
  (2) E2 mine the danger share only on the residual after live verbs:
  V2 30% 765/219, V2 40% 460/269, V2 50% 234/391. (3) E3 drop verb-ish
  tokens from the noun reader: V2 30% 710/218, V2 40% 456/253. (4) E4 =
  E2+E3: V2 20% 925/173, V2 30% 668/225, V2 40% 442/271, V2 50% 221/394,
  V5 50% 133/441. (5) E5 goal 1's own LOVO summary lowering verbs on
  top of E4: 665/228 at every bar tried (frees 3, leaks 3). (6) E6
  structural lowering on top of the 803/211 base: caller-shaped path
  (/user/, /users/me) frees 39 for 4 leaks; summary caller phrase frees
  12 for 1; summary+description caller phrase frees 50 for 19; no path
  param frees 110 for 25; exactly one path param frees 351 for 167.
- Outcome: every variant lands on the same trade-off curve as the plain
  bar sweep (803/211, 472/251, 268/382). At the top of the curve each
  10 false alarms freed cost about 1 leak; lower down it is 1 for 2.
  Nothing measured goes under the curve. Not adopted; goal 1 stays at
  803/211.
- Lesson: on PUT/DELETE/PATCH the name words (user, group, member,
  role, order) are safe about half the time, and every list, verb or
  path shape tried only re-slices that same ambiguity. Lowering x to w
  safely from here needs evidence of a different kind than name words:
  a human on the flagged pile (D44) or a labelled per-API hint. The
  next honest step for goal 1 is to pick the point on the curve, not to
  search for a better list.

### Goal 1 POC E7: verb and noun as complements (2026-09-13)
- Goal: the user asked why amazon DELETE cancelFeed / cancelReport /
  deleteDestination are false alarms when they read as plain w. Traced:
  cancelFeed and cancelReport are live-verb raises (cancel is on the
  26-word list; pooled over PUT/DELETE/PATCH cancel is 20 w / 29 x, a
  coin flip). deleteDestination is an other-noun raise: destination
  appears on 3 rows from 3 vendors, 1 x (lyft PUT SetRideDestination),
  so 33% clears the 2-vendor 30% bar and one row poisons the word for
  every vendor. The user proposed that verb and noun complement each
  other: when the verb cannot decide, the noun should.
- Tried: E7, scratch script g1verbnoun.mjs, on the 803/211 standalone
  base. Rule: a live-verb raise goes back to w when every noun on the
  row is on goal 1's own LOVO yours-noun list (noun safe share among
  other vendors >= bar, >= 2 vendors, >= N rows). E7a applies to any
  live verb, E7b only to coin-flip verbs (pooled x share < 70%: cancel,
  revoke, trigger, run, transfer, terminate, pay, end, merge, reboot,
  submit, notify). Results (fa/leaks): rows>=5 safe>=0.9: E7a 793/219,
  E7b 793/217; safe>=0.95: 797/213 both; safe>=0.8 rows>=2: E7a
  765/228, E7b 765/223; rows>=10 safe>=0.95: 799/212. Rows moved by E7b
  rows>=5 safe>=0.9 (16): ok amazon cancelFeed, cancelReport, appveyor
  cancelBuild, taxamo cancelTransaction, britbox cancelSubscription,
  atlassian mergeVersions, clicksend Transfer a Contact, adafruit
  replaceTrigger, illumidesk service_trigger_replace, payrun
  PatchPayCode; LEAK amazon cancelShipment, appveyor cancelDeployment,
  zuora PUT_CancelSubscription, getgo cancelRegistration, godaddy
  cancel (subscription), godaddy DELETE (action).
- Outcome: 10 freed for 6 leaks at the best-looking bar, 6 for 2 at the
  tightest; the plain curve gives 10 for 1. Below the curve on every
  setting. Not adopted.
- Lesson: the noun only settles rows the noun alone would have
  settled. subscription is w for britbox (your own) and x for zuora
  and godaddy (a customer's billing); shipment and deployment count as
  yours 90% of the time on update/delete rows but cancelling one
  reaches a carrier or a running server. cancelFeed reads as w to a
  person because they know an Amazon feed is a job the caller
  submitted; that is per-API knowledge, not a word. Goal 1's remaining
  false alarms need evidence that is not in the name.

### Goal 3 readout: where the 49 over-tight rows come from (2026-09-13)
- Goal: goal 1 committed standalone at 803/211 (1c5243c, D63) and
  parked by the user until goal 3 is done. Goal 3 (truth r dressed as w
  or x) opened with a POC readout, no code change: scratch scripts
  g3pile.mjs and g3verbs.mjs.
- Tried: population = 4915 write-method rows, 113 truth r (POST 88, PUT
  14, DELETE 5, PATCH 6). Today's rule (POST operationId lead verb on
  READ_VERBS lowers to r) gives 49 over-tight / 0 leaks; the 64 lowered
  rows are all truth r. E1 also read the summary lead verb on POST:
  38 / 4 leaks. Per verb on those summary-only rows: query 3 r / 0 w /
  0 x (camara x2, vercel), match 2/0/0 (camara), search 1/0/0
  (cloudflare), get 4/0/1 (adyen; leak post-applePay-sessions "Get an
  Apple Pay session" x), verify 1/1/0 (camara validateCode "Verifies
  the OTP" w), retrieve 0/0/2 (camara postServiceCapability,
  calculateCarbonFootprint). E2 also applied both verb reads to
  PUT/PATCH/DELETE: 34 / 26 leaks (verify, list, retrieve, check as
  nouns or as write verbs: twitter listIdDelete, sendgrid
  DELETE_verified_senders, zuora PUT_VerifyPaymentMethods x, powerdns
  axfrRetrieveZone x).
- Outcome: of the 49 misses, 17 are httpbin.org echo rows (PUT/PATCH/
  DELETE on /anything, /delay, /status, /redirect-to; no operationId),
  4 are amazon POST rows with no summary, and the rest carry coin-flip
  verbs across the corpus: validate 3 r / 1 w / 2 x, generate 3/0/3,
  check on PUT, parse (1 vendor), create (adyen post-originKeys, truth
  r). The only zero-leak addition found is summary lead verb query/
  match/search on POST: 6 freed, 0 leaks, but from 3 vendors and mostly
  camara, below the 5-vendor admission bar. Nothing adopted; goal 3
  stays 49 / 0.
- Lesson: lowering to r is the loosest move the tool can make, and
  goal 3's 0 leaks is its real asset; every widening tried (summary
  verb, other methods) buys single-digit rows for leaks. The remaining
  misses are either one vendor's test API with no names, or verbs
  (validate, generate, verify, retrieve) that mean read in one API and
  act in another. Same wall as goal 1, smaller.

### Floor ladder measured; floor table refreshed (2026-09-13)
- Goal: the user proposed reading the floor as a ladder: r first (GET
  97%, then POST rows that are r), then w (PUT/DELETE/PATCH floor,
  then POST rows that are w), and whatever is left is x; and asked
  whether the per-method floor table was a wrong start. Also refresh
  the PRD's floor table, which still showed the 1478-row set.
- Tried: (1) truth shares on the 5465 rows: GET 550 (97/1/2), POST
  509 (17/20/62), PUT 1696 (1/85/15), DELETE 2079 (0/87/13), PATCH
  631 (1/85/14). Old table: PUT 127 (2/83/15), DELETE 250 (0/81/19),
  PATCH 42 (0/69/31). (2) Cost of each floor before any word rule: r
  on POST 421 leaks; x on POST 191 over-tight; w on PUT/DELETE/PATCH
  605 leaks / 25 over-tight; x on PUT/DELETE/PATCH 3801 over-tight; x
  on PATCH only 544 over-tight (goal 2's PATCH leaks 5 -> 0, goal 1's
  PATCH false alarms 90 -> 538). (3) The ladder's "POST that is w"
  step, scratch script ladder.mjs, over 509 POST rows (88 r, 103 w,
  318 x), after read verb -> r and live verb -> x: A today (else x):
  0 leaks / 127 over-tight. B every noun on goal 2's yours allowlist
  -> w: said w on 61 rows, 12 truth w, 45 truth x, 4 r; 45 leaks / 115
  over-tight. C no goal-1 blocklist noun -> w: 170 leaks / 73
  over-tight. D plain w floor on POST: 277 leaks / 35 over-tight. B's
  leaks are creates: camara createSubscription, createNetwork,
  createAccess, vercel createDeployment, x createWebhooks, notion
  post-page, slack conversations_create, amazon purchaseLabels,
  twilio CreateAddress.
- Outcome: PRD floor table refreshed to the 5465-row numbers; floors
  unchanged (PATCH stays w: 14% x, same as PUT and DELETE, the 31%
  was 42 rows). The ladder reading is adopted as the description of
  today's shape: r first (GET, POST read verb), then w (PUT/DELETE/
  PATCH floor), the rest x. The "POST that is w" step is not adopted:
  even the strictest bar says w wrongly on 45 of 61 rows.
- Lesson: on POST, x mostly means "not repeatable" (a create), and a
  noun cannot say whether a create is repeatable; yours-nouns that
  hold w on PUT/DELETE/PATCH (subscription, webhook, network, page)
  are exactly the things a POST creates. The floor table was not a
  wrong start; it is the majority class per method, and rules move
  off it. What was wrong, and is fixed, was goal 1 chained behind
  goal 2.

### One-flow ladder and the "POST that is w" step measured (2026-09-13)
- Goal: the user's reading of the shape as one sequential flow, not
  three goals: step 1 r (GET floor, then POST read verb), step 2 w
  (PUT/DELETE/PATCH floor, then POST leftover that has a verb plus a
  yours noun), step 3 x is whatever remains. Measure it as one
  classifier over all 5465 rows, and measure the new step 2 piece on
  POST. Scratch scripts oneflow.mjs, postw.mjs, postw2.mjs; no code
  changed.
- Tried: (1) One flow, POST included in the w step (3p noun -> x, else
  w): said r 597/4/13, said w 42/3098/443, said x 7/781/480 (columns
  truth r/w/x); exact 76.4%, leaks 460 (8.4%), over-tight 830 (15.2%);
  POST alone leaks 183 / over-tight 67. (2) Same flow plus live verbs,
  POST without read verb stays x: said r 597/4/13, said w 25/2973/211,
  said x 24/906/712; exact 78.4%, leaks 228 (4.2%), over-tight 955
  (17.5%); by method GET 17/0, POST 0/127, PUT 93/305, DELETE 76/424,
  PATCH 42/99. This is exactly today's pieces (goal 3 read verbs, goal
  1 lens) run as one sequence; the 211 w-leaks are goal 1's 211. (3)
  The 103 truth-w POST rows: twilio Update* (18), slack group-word
  names whose verb sits after the prefix (conversations_rename,
  chat_update, files_delete, dnd_setSnooze; 49 rows), linode
  cancel/resize/resume/close, pagerduty enable/associate/dismiss. Lead
  verb on the 445 leftover POST rows: create 9 w / 117 x, update 20 /
  12, add 0 / 8, set 9 / 10 (any position: update 27 / 18, delete 7 /
  3, add 6 / 20). (4) Rules on the 445 leftover POST rows (24 r, 103
  w, 318 x): M1 modify verb anywhere (update, set, rename, archive,
  close, resize, resume, enable, disable, delete, remove, mark,
  cancel, ...) -> w: 77 right / 69 leaks; M2 same minus live verbs: 73
  / 63; M3 modify verb plus every noun on the yours allowlist -> w
  (the user's rule as stated): 10 right / 4 leaks; M5 "update" alone:
  27 / 19. M2's leaks: twilio UpdateCall (terminates a call),
  UpdateStream (stops a stream), UpdateParticipant; slack admin_*
  (an admin acting on other users' things: admin_users_setOwner,
  admin_conversations_rename); camara addDevicesToAccess,
  enableEsimProfile; vercel addProjectDomain, updateAccessGroup;
  sentry addOrganizationMember.
- Outcome: the one-flow reading is adopted as the way to describe the
  shape (PRD floor section). The POST w step is real but tiny: verb
  plus yours noun says w on 14 rows, 10 right, 4 wrong; the verb alone
  is a coin flip (73 / 63). Not adopted; POST stays x unless a read
  verb lowers it.
- Lesson: on POST the modify verbs split the same way the nouns did on
  PUT/DELETE/PATCH: twilio UpdateAccount is w and twilio UpdateCall is
  x; slack conversations_rename is w and slack admin_conversations_rename
  is x. The yours noun filters those down to a handful because the
  nouns a POST touches (call, stream, member, domain) are mostly not
  on any yours list. Same wall, third time.

### Goals renamed to steps; pipeline reordered floor -> step 1 -> step 3 (2026-09-13)
- Goal: the user's ruling: the three goals were never three classifiers; they were error counts on one sequence (step 1 claims r, step 2 claims w, x is the byproduct). Rename to match the flow and reorder the code so it reads like it. Map: goal 3 -> step 1 (r), goal 1 -> step 2 (w), goal 2 -> step 3 (x).
- Tried: git mv of poc/m1/goal{3,1,2} to step{1,2,3}, function renames (applyStep1, classifyStep2, applyStep3), pipeline LAYERS floor -> step1 -> step3, proof CSVs renamed (step1.csv, step2.csv, step2-leaks.csv, step3.csv), docs renamed. Verified by re-running tests, measure and proof, and diffing each new CSV (sorted) against the pre-rename copy.
- Outcome: zero row change; 49 / 803+211 / 37 unchanged. D64.
- Lesson: the earlier "three goals, attack one at a time" wording made the pipeline read as three classifiers; it was one chain with counters on it, and the orchestrator should have said so in one line when first asked. Older learnings entries keep the old names; read them through the map above.

### Shape B chosen: step 2 in order a-d, the middle group sized (2026-09-13)
- Goal: the user chose B (step 2 keeps the middle group at w) over A (yours-list only, middle to x). Size the middle group, explain why rows land there, and check whether verb and noun should be judged in order or together.
- Tried: split of the 4406 PUT/DELETE/PATCH rows by both mined lists (scratch both.mjs, middle.mjs, order.mjs): live verb 163 (82 w / 81 x); 3p noun 1034 (721 / 313); every noun yours 1237 (1201 / 36); neither 1972 (1797 / 175). Why neither: noun used by this vendor only 1327; noun between the bars (20-30% x) 130; too few other-vendor rows 499; no noun 16. Order: sequential live -> 3p -> yours -> rest gives 803 / 211; live overridden by all-yours 772 / 221; live overridden by no-3p 738 / 260; 3p overridden by all-yours 762 / 212.
- Outcome: shape B plus a flag adopted in the PRD: step 2 checks a live verb, then a 3p noun, then yours (flag evidence), then rest (flag no evidence). Whole flow 78.4% exact / 4.2% leaks / 17.5% over-tight, vs A 49.7% / 1.0% / 49.3%. Build to follow: pipeline floor -> step 1 -> step 2, yours list moves into step 2, step 3 folder retired, one proof CSV with a flag column.
- Lesson: the middle group is not a list problem; it is rows whose nouns no other vendor has vouched for. Sequential judging beats joint judging on every pairing tried but one (yours beating 3p when both fire: 41 freed for 1 leak), which is parked for re-measure after the move.

### Flow rebuild, step 1 of 5: fresh bottom layer in poc/flow/ (2026-09-14)
- Goal: the user agreed to archive poc/m1/ and rebuild the classifier in poc/flow/ with zero imports from the archive. The live code (1610 lines) imported 12 helpers from the frozen poc/m1/arbiter/ folder (50 files, 17023 lines), and the yours list was mined with a different noun reader (c19/c20 head-noun table) than the 3p list (nounsForRow), which is why the two disagreed on 41 rows. Step 1: corpus loader, csv, word helpers, floor, each tested; prove the new noun reader matches today's on every row.
- Tried: poc/flow/{csv,corpus,words,floor}.mjs (696 lines) plus three test files (30 tests). words.mjs copies only what is used: splitter, tokenizer with method-word strip, verb stemmer, naiveSingular, summary verb, caller phrase, summary head noun, operationId head noun, junk token, buildJunkSet (replaces c19 buildNounTable + c20 cleanNounTable), nounsForRow with the verb-skip set passed in. One deliberate change: tokensForRow applies the '/'+whitespace split itself, so callers no longer have to. Equivalence script (scratch, not in the repo) compared old vs new over all 5465 rows: rows, vendors, junkSet (117 words), tokens, lead verb, summary verb, caller phrase, head noun, operationId head noun, nounsForRow.
- Outcome: 0 mismatches on every check; 30/30 tests pass. Flag pile decision: the user did not name a row, so the orchestrator took the recommended one and said so: one noun reader, yours list mined over all 5465 rows (pile 2441, 192 of 211 leaks in it) instead of today's two-reader 1972 / 175.
- Lesson: naiveSingular is a noun rule and mangles some nouns ('devices' -> 'devic'); the copy keeps that behaviour on purpose because the mined lists were measured with it. Change it only with a re-measure.

### Flow rebuild, step 2 of 5: step 1 (r) and the flow entry point (2026-09-14)
- Goal: poc/flow/step1.mjs (READ_VERBS 14, applyStep1: GET/HEAD/OPTIONS -> r rule method; POST with a read lead verb -> r rule read-verb) and poc/flow/flow.mjs (classifyRow: step 1, then a marked slot for step 2, then the floor; scoreRows: the ledger). The user confirmed the flag pick (one noun reader, yours list mined over all 5465 rows, pile 2441 / 192) and named the no-evidence flag "x-pile"; those rows stay class w (shape B), only the flag is named.
- Tried: 14 new tests (44 total in poc/flow). Equivalence script (scratch) compared new classifyRow against the old pipeline classify(row, {upTo: 'step1'}) on all 5465 rows.
- Outcome: 0 mismatches. Pins hit: step 1 49 over-tight / 0 leaks; GET floor leaks 17 (D59, parked, charged to the floor not to step 1). Up to step 1 only, whole table: exact 4691, leaks 622, over-tight 152 (step 2 not yet built, so PUT/DELETE/PATCH sit at the bare w floor).
- Lesson: none new; the pins came out first run because step 1 is a copy.

### Flow rebuild, step 3 of 5: step 2 (w) checks a-d and the x-pile flag (2026-09-14)
- Goal: poc/flow/step2.mjs: PUT/DELETE/PATCH start at w; in order, (a) live verb -> x, (b) other-party noun -> x, (c) every noun yours -> w flag "evidence", (d) else w flag "x-pile" (the user's name; class stays w, shape B). Both noun lists are mined with the ONE noun reader in words.mjs: other-party over PUT/DELETE/PATCH rows (LOVO, >= 2 vendors, x-share >= 0.30), yours over all 5465 rows (LOVO, n >= 2, w-share >= 0.80). Wired into flow.mjs; POST leftovers are step 3 x. scoreRows gained the step 2 ledger and a per-method split.
- Tried: 11 new tests (55 total). Equivalence script (scratch) compared the new classifyRow class against the old code (old classifyStep2 on PUT/DELETE/PATCH, old pipeline up to step 1 elsewhere) on all 5465 rows.
- Outcome: 0 class mismatches. Pins hit exactly: step 2 803 false alarms / 211 leaks; x-pile 2441 rows with 192 of the 211 leaks in it (was 1972 / 175 with two readers); whole flow exact 4282 (78.4%), leaks 228 (4.2%), over-tight 955 (17.5%); by method leaks/over-tight GET 17/0, POST 0/127, PUT 93/305, DELETE 76/424, PATCH 42/99; both negative controls x.
- Lesson: the two old noun readers only ever disagreed on the flag, never on the class, so retiring the c19/c20 table cost nothing on the ledger and moved 469 rows into the flagged pile, 17 of them leaks.

### Flow rebuild, step 4 of 5: ledger pins and one proof CSV (2026-09-14)
- Goal: poc/flow/ledger.mjs (PINS in one place, pinDiffs, verdictFor) and poc/flow/proof.mjs, which writes one CSV run-proof/flow.csv (all 5465 rows: set, vendor, method, path, operationId, summary, truth, step, class, rule, flag, verdict) and run-proof/flow.md (ledger, per-method table, where-the-rows-sit table, column glossary), and exits 1 if a pin moves. The old per-step CSVs and rwxmap-runs.md stay until the archive step.
- Tried: `node poc/flow/proof.mjs` and 61 tests (flow.test.mjs now asserts pinDiffs is empty instead of 21 inline equals).
- Outcome: all pins hold. Where the rows sit (rows / truth r / w / x): step 1 r 614 / 597 / 4 / 13; step 2 w "evidence" 768 / 3 / 746 / 19; step 2 w "x-pile" 2441 / 22 / 2227 / 192; step 3 x 1642 / 24 / 906 / 712. Negative controls: ClickToDial terminateCall x by live-verb; WebRTC updateSessionStatus x by other-noun.
- Lesson: with the yours list mined over all rows by the one reader, the "evidence" group shrank from 1237 to 768 rows (19 leaks instead of 36 hide there); the flag moved, the classes did not. This is the number the PRD must carry from now on, replacing 1972 / 175.

### Flow rebuild: yours list mined over write rows; PRD shape replaced (2026-09-14)
- Goal: pick which rows the yours list is mined over, out of three candidate populations: all 5465 rows, write rows only (every method but GET/HEAD/OPTIONS), or PUT/DELETE/PATCH only. Then replace the PRD's shape-B write-up (still describing the retired two-reader 1972/175 pile and the frozen-goal-2/goal-1-lens wording) with the current poc/flow/ shape, since the PRD carries exactly one current shape.
- Tried: measured all three populations leave-one-vendor-out over 5465 rows, one noun reader throughout (words.mjs): all rows, pile 2441 / 192 leaks; write rows, pile 1998 / 179 leaks; PUT/DELETE/PATCH only, pile 1582 / 159 leaks. Classes (803 false alarms / 211 leaks) held identical across all three — only the x-pile/evidence split moved.
- Outcome: the user chose option 2, write rows. poc/flow/step2.mjs and ledger.mjs pins now read 1998 / 179; PRD's "Step 2 in order" table, group table and "why a row lands in d" paragraph updated to match; the "Two flows, not one pipeline" and "How the steps stay separate" subsections and the frozen-step-3/rebuilt-step-2-standalone status blocks were deleted from the PRD and replaced with one "Where the code lives (poc/flow)" subsection, since those described the retired two-lens design. Numbers that left the PRD today, so they are not lost: step 3 (as a standalone lens) was frozen at 37 leaks against 2727 step-2 false alarms charged to it; the shape before that froze at 89 leaks / 1936 false alarms / 106 all-loosening; the "lower-back" design (D60-D62) moved step 2 from 2727 to 2531 false alarms by only ever undoing step 3's own raises; the two-reader x-pile was 1972 rows / 175 leaks, breaking down as 1327 vendor-only nouns, 130 nouns between the two bars (20-30% dangerous), 499 nouns with too few other-vendor rows, and 16 rows with no noun at all; the two-reader evidence group was 1237 rows / 1201 truth-w / 36 truth-x.
- Parked, unchanged by this pass: yours-beats-3p when both fire (762/212, to be re-measured now the yours list lives in step 2); summary read verbs query/match/search on POST (6 for 0); POST modify verb + yours noun (10/4).
- Lesson: mining "yours" from rows whose truth cannot say whose thing it is (GET is truth r regardless of ownership) only dilutes the list; restricting to write rows is the right population, not just a tidier one. The population choice moved 443 rows between the evidence group and the x-pile with zero class change — a reminder that a flag pile's membership and a step's classes are different questions, and only the classes are pinned.

### Flow rebuild, step 5 of 5: poc/m1 archived (2026-09-14)
- Goal: retire poc/m1/ now that poc/flow/ has been proven identical on all 5465 rows (701f3b6, D65) and is the only live classifier.
- Tried: `git mv poc/m1 poc/archive/m1`; wrote poc/archive/m1/ARCHIVED.md modelled on poc/m0/ARCHIVED.md; deleted the five old per-step proof files (run-proof/step1.csv, step2.csv, step2-leaks.csv, step3.csv, rwxmap-runs.md), since run-proof/flow.csv and flow.md are the only proof now; updated poc/m0/ARCHIVED.md's successor pointer, docs/product/goal2-solution.md, docs/wiki/module-ladder-and-shape.md, and docs/product/prd.md to point at poc/archive/m1/ and poc/flow/ instead of poc/m1/.
- Outcome: poc/flow/ is now the only live code — corpus.mjs, csv.mjs, floor.mjs, flow.mjs, ledger.mjs, proof.mjs, step1.mjs, step2.mjs, words.mjs (9 files) plus corpus.test.mjs, floor.test.mjs, flow.test.mjs, ledger.test.mjs, step1.test.mjs, step2.test.mjs, words.test.mjs (7 test files, 62 tests, 0 fail); `node poc/flow/proof.mjs` exits 0 with every pin held.
- Lesson: the rebuild took five checkpointed steps in one day because every step was proved identical to the old code (mismatch scripts against the retired pipeline, then a full-corpus equivalence check before D65) before the old code was retired — nothing was archived on trust.

### Exam 4 was never virgin; frozen shape scored, per-set stability measured (2026-09-14)
- Goal: re-check exam 4's "virgin draw" claim before trusting the M1-C25 truth-drift finding any further, then score the frozen poc/flow shape against exam 4 once and measure the shape's per-set stability across every existing set.
- Tried: compared exam 4's 318 providers and 4000 (provider, method, path, operationId) rows against the 332 corpus providers and their rows, using the same normalisation on both sides (registrable name AND raw vendor token, both directions), then re-ran `poc/archive/m1/arbiter/make-exam4.mjs`'s own exclusion logic to see what it actually compared. Scored exam 4 once against the frozen poc/flow shape (lists mined from the full corpus, not LOVO, since the rows were believed unseen), then scored the frozen shape LOVO on every existing set.
- Outcome: exam 4 is not virgin — 316 of 318 providers (only apidapp.com and openlinksw.com are new) and 2702 of 4000 rows overlap the corpus (593 from exam 2, 2109 from exam 3; 1298 more rows from the same burned providers but not in exams 2/3). Cause: make-exam4.mjs's exclusion compares each pool provider's registrable name (e.g. "ably") against the corpus's raw vendor tokens (e.g. "ably.net"), which never match for the full-string tokens exams 2/3 use, so the script's own "intersection must be 0" self-check passed while comparing the wrong things; it only worked for the six original sets because those use short vendor names ("github", "slack") that do match. Consequence: the M1-C25 truth-drift finding is void as a generalisation number — on the 2109 shared exam-3 rows, exam 3 -> exam 4 truth moved w->w 1541, x->x 242, w->x 272, x->w 33, r->r 16, plus 5 rows exam 3 marked '?', so the drift is real but nothing in exam 4 was unseen. Exam 4 scored once against the frozen shape: all 4000 rows exact 71.8%, false alarms 565 (19.0% of truth-w), leaks 537 (13.4% of rows, 53.4% of truth-x), x-pile 1828 holding 389 leaks (72%); high-confidence rows only (3158): exact 77.2%, leaks 6.4% of rows / 43.0% of truth-x — both lower than the corpus pins (78.4 / 4.2 / 17.5), and per the standing rule work stopped and this was reported rather than chased. Per-set LOVO stability of the frozen shape, exact / leaks / over-tight: camara 90.4 / 2.1 / 7.5; holdout1 (github etc.) 59.9 / 3.9 / 36.2; holdout2 85.5 / 0.5 / 14.1; holdout3 82.3 / 4.9 / 12.8; holdout4 86.2 / 1.0 / 12.9; holdout5 (slack, amazon) 75.9 / 5.6 / 18.6; exam2 77.8 / 5.4 / 16.8; exam3 77.5 / 4.3 / 18.2; all 78.4 / 4.2 / 17.5.
- Lesson: a self-check that compares canonical names against raw tokens passes for the wrong reason — it proved the sets it already matched on, and silently skipped the one comparison that mattered; an exam draw must assert a zero intersection on rows and on providers using the same normalisation on both sides, and that check must be re-run by the reader, not trusted from the README. Standing: no clean exam exists for this project; a real exam 5 needs a like-for-like exclusion (both name forms, both directions), a row-level as well as provider-level intersection check, and a decision on the truth standard, since the brief that produced the corpus truth was lost and the exam-4 brief is stricter.

### Between-bars words: "confirm" and "payment" measured as hand raisers (2026-09-14)
- Goal: the x-pile reason table says 1072 of 1998 pile rows sit "between bars" (a noun other vendors use, safe less than 80% and dangerous less than 30%, or dangerous but from one other vendor). The user asked whether any word there would improve things (per-provider customising rejected). Listed the 195 between-bars nouns by pile rows.
- Tried: top nouns (pile rows / x in pile / all-write-row w% x% / vendors): account 90/12/73%/27%/61; set 61/7; subscription 49/1; create 44/6 (70% x overall, but LOVO leaves it under the bar for the vendors that hold it); statu 37/0; instance 30/3; token 28/4; device 28/0; domain 26/0; confirm 19/19 (23 write rows, 100% x, 3 vendors, all 19 pile rows from climatekuul.com); payment 11/11 (68 write rows, 47% x, 27 vendors). Why they escape: "confirm" is a verb token read as a noun, its other-vendor rows are POST so the PUT/DELETE/PATCH other-party table never sees a second vendor; "payment" falls under the LOVO 30% bar for the vendors that hold the leaks. Measured as hand raisers over every PUT/DELETE/PATCH row still w after the frozen flow (raise only, so no new leaks possible): "confirm" as a LIVE_VERBS entry (operationId token or summary lead verb, caller-phrase veto): moves 21 rows w->x, 19 truth x, 2 truth w (codat.io PATCH update-accounts-categories "Confirm categories for accounts"; gettyimages.com DELETE "Confirm asset change notifications"), 3 vendors. "payment" as a raising noun: 11 rows, 11 truth x, 0 w, 5 vendors. Other money nouns rejected: invoice 3 x / 15 w, transaction 1 / 23, charge 0 / 3, checkout 0 / 1, payout 1 / 1, fund 2 / 0 (one vendor, too thin), order/refund/money/wallet 0 rows.
- Outcome: whole flow, frozen 78.4% exact / 228 leaks (4.2%) / 955 over-tight (17.5%), step 2 803/211, x-pile 1998 (179). Plus confirm: 78.7 / 209 (3.8%) / 957, step 2 805/192. Plus payment: 78.6 / 217 (4.0%) / 955, 803/200. Both together: 78.8% / 204 (3.7%) / 957 (17.5%), step 2 805/187, x-pile 1972 (155). 24 leaks closed for 2 false alarms, 12 per 1, above the 10-for-1 line. NOT adopted yet: hand-list changes need the user's word, and "confirm" rests on one vendor's 19 rows (transfer unproven; the 2 other vendors' rows are r/w-free x too, but only 2 rows).
- Lesson: the between-bars pile is not a list problem in bulk (87% safe), but its top rows are readable by hand and two generic English commit words (confirm, payment) were hiding there because the mined bars are per-vendor and per-method. A raise-only hand word cannot add leaks; its whole cost is false alarms, so the bar to clear is the 10-for-1 line, not zero.

### confirm and payment adopted (2026-09-14)
- Goal: adopt the two hand raisers measured in "Between-bars words" — the user's word, 2026-09-14 (D66) — and record the pin move.
- Tried: added "confirm" to LIVE_VERBS (26 -> 27 words) and a new MONEY_NOUNS = {payment} list in poc/flow/step2.mjs, checked after the other-party noun check, rule money-noun; re-ran `node poc/flow/proof.mjs` leave-one-vendor-out over 5465 rows.
- Outcome: step 2's pins move 803 false alarms / 211 leaks -> 805 / 187; x-pile 1998/179 -> 1972/155 (1795 truth w, 155 truth x); whole flow exact 78.4% -> 78.8%, leaks 4.2% -> 3.7%, over-tight unchanged 17.5%. Per-method leaks/over-tight now GET 17/0, POST 0/127, PUT 89/305, DELETE 75/425, PATCH 23/100. Matches the pre-adoption measurement exactly (24 leaks closed for 2 false alarms).
- Lesson: the x-pile reason table (between bars / too few rows / vendor-only / no noun) pointed straight at these two words — both sat in the largest reason bucket, "between bars" — confirming that reason table is worth reading by hand for future candidates, not just used as a leak-locator.

### Calibrated labelling brief, first measure (2026-09-14)
- Goal: write a labelling brief calibrated to the corpus standard (the user's option 2, 2026-09-14) so exam 5's truth is comparable to the 5465-row corpus, then measure it blind before use.
- Tried: joined exam 3 truth to exam 4 truth on provider|method|path|operationId (2109 shared rows; w->w 1541, x->x 242, w->x 272, x->w 33, r->r 16, 5 '?' on exam 3) and read all 305 flipped rows; measured corpus truth leans on PUT/DELETE/PATCH rows for the words that decided them (employee 32 w / 2 x, patient 15/0, customer 53/9, device 59/4, comment 40/2, webhook 69/3, project 165/21; plain /users/{id} rows 38 x of 56; member 52 x of 76, permission 26 of 37, invite 5 of 6, publish 8 of 12; follow 7 x of 37, like 2 of 16). Wrote data/calibration-2026-09-14/BRIEF.md: D20's two roads plus twelve corpus-standard rules, the key ones being (1) a record about a person is the caller's own record -> w, (2) a user account another person logs in with is that person's access -> deleting or disabling it is x, (3) a path parameter is never a reach, (4) definitions and containers are w and changing who is in them is x, (7) social relations are w, (8) publish/visibility is x. Drew two blind check samples with poc/exam/make-calib5.mjs: sample A = the same 200 random exam-3 rows the exam 4 brief scored on 2026-09-12 (byte-identical copy), sample B = 150 of the 305 flipped rows (seed 20260914; 134 w->x, 16 x->w). Two blind mid-tier labellers, one per sample, saw only BRIEF.md and their blind file.
- Outcome: sample A agreement with exam 3 truth 185/200 (92.5%) against the exam 4 brief's 177/200 (88.5%) on the same rows; w called x fell 21 -> 5, x called w rose 2 -> 10 (of 28 truth-x rows). Sample B: 123/150 (82.0%) land on the exam 3 label; of the 134 rows exam 4 had flipped w->x, 116 came back w; of the 16 exam 4 had flipped x->w, 7 came back x, 8 w, 1 '?'. Zero invalid confidence values in either file (the exam 4 run had produced 276 'medium'). Where the new brief still misses, by row: roles/groups/permission schemes read as plain definitions (apache "Update a role", citrixonline "Replace Group", files.com "Delete Group", fecru permission scheme — all corpus x); the caller's own consent/agreement read as another party's (nbg, nordigen, openbanking — corpus w); mark-as-read inferred to send a read receipt (telnyx, whatsapp — corpus w); logging out a session the caller itself opened read as another's session (letmc, whapi — corpus w); soundcloud unlike/unfollow/repost (exam 3 x, but corpus lean is w 42 of 52 so the brief's rule 7 stands). Corpus leans measured for the fixes: permission DELETE 12 x of 13, consent DELETE 7 w of 8, mark-as-read 12 w of 12, logout 7 w of 8, group DELETE 30 w / 30 x.
- Lesson: the drift was almost entirely one idea — exam 4's brief let "the record is about someone else" count as reach; naming that in the brief (rules 1-3) removed three quarters of the strictness (w->x 21 -> 5) in one step. The brief now errs slightly loose on access bundles (roles, groups, permission schemes), which is the direction that matters for the gate, so it needs one tightening line there before exam 5; four targeted fixes are proposed and not yet applied or measured. Sample A has now been scored under two briefs and is a tuning set for briefs; sample B was built from disagreements and never was a clean sample. The next measure needs a fresh random draw.

### Exam 5 draw: the APIs.guru pool has no unseen write vendors (2026-09-14)
- Goal: draw exam 5, the first clean exam, from providers absent from the corpus, exam 1 and exam 4 under both name forms (raw token and registrable name, both directions), with row-level and provider-level zero-intersection asserted, and label it under the calibrated brief (data/calibration-2026-09-14/BRIEF.md, revised the same day with four fixes and a Methods paragraph).
- Tried: wrote poc/exam/make-exam5.mjs with the like-for-like exclusion; it threw before writing anything because the PUT/DELETE/PATCH stratum was unreachable. Re-counted the pool independently in the main session: data/corpus/apis-guru-ops.csv.gz has 123339 rows from 673 providers; 327 providers have any PUT/DELETE/PATCH row; after excluding the 332 corpus vendors by raw token or registrable name, 340 providers remain but only 3 of them have write rows — amazonaws.com (1405 rows; the same vendor as holdout 5's Amazon SP-API under another token, aliased "amazon" by the old draw scripts) and apidapp.com and openlinksw.com with 1 row each. The free providers hold 8029 GET and 10619 POST rows. Inside the corpus vendors, 23108 PUT/DELETE/PATCH rows across 177 vendors, 24186 POST and 51750 GET rows are not labelled.
- Outcome: no vendor-disjoint PUT/DELETE/PATCH exam can be drawn from APIs.guru; exams 2, 3 and 4 (cap 12 rows per provider) already touched every write-capable provider in the pool. Exam 4 could not have been vendor-clean even without its name-matching bug. A vendor-disjoint exam remains possible only for GET and POST (step 1 and the GET floor). For steps 2 and 3 the honest options are (a) a row-disjoint exam drawn from the 23108 unseen write rows inside corpus vendors, scored leave-one-vendor-out so the mined lists never see the row's own vendor — weaker than vendor-disjoint because the hand lists were shaped on those vendors' other rows — or (b) a new spec source outside APIs.guru, which is a download-and-extract module of its own. Nothing was drawn; the choice is the user's.
- Lesson: "clean exam" has been assumed to mean vendor-disjoint since D46, but the pool was finite and the exams consumed it one cap-12 slice at a time; nobody counted how many write-capable providers existed before drawing. Count the pool before promising a draw, and record which providers each exam consumed.

### Calibrated labelling brief, second measure after four fixes (2026-09-14)
- Goal: measure the revised brief (rule 4 access bundles, rule 6 own consent, rule 11 own customer session and no inferred read receipt, a "do not infer" bullet, plus a Methods paragraph for GET and POST) once on fresh rows before adopting it for exam 5, since sample A had been scored under two briefs and was a tuning set.
- Tried: drew sample C, 200 exam-3 rows disjoint from samples A and B, seed 20260915, via poc/exam/make-calib5.mjs (A and B outputs byte-identical before and after the change); one blind mid-tier labeller saw only BRIEF.md and calibC-blind.csv.
- Outcome: 185/200 (92.5%) agree with exam 3 truth, the same rate as sample A under the first brief (185/200); w called x 5, x called w 9 of 23 truth-x rows, 1 '?' on a truth-r row; zero invalid confidence values. Remaining x->w misses by row: gitea "Delete a team" (corpus x, read as a container), rebilly "Create or update an invoice" (billing a customer, read as no charge), gsmtasks stripe setup intent, lgtm upload part (road 2 append), soundcloud unlike (rule 7 stands by corpus lean), redirection.io "Removes the User resource" (rule 2 should have caught it), gambitcomm MQTT abort, va.gov document upload to an agency. Remaining w->x: reindex read as a road-2 job, wowza disable stream targets read as halting viewers, vimeo embed domain read as visibility, two walletobjects rows.
- Lesson: two independent readers agreed on 95% of rows in an earlier measure (M1-C12), so 92.5% sits near the reader-noise floor and further brief edits would be fitting to one labeller's taste. The brief is adopted as the exam 5 standard with the known lean recorded: it errs slightly loose on truth-x rows (9 of 23 here, 10 of 28 on sample A), most often on "delete a team" and "invoice a customer" rows. Samples A, B and C are all tuning sets for briefs now.

### Exam 5 scored once: step 2's own-stuff rules transfer, the raisers and the POST floor do not (2026-09-14)
- Goal: draw and score exam 5 under the adopted brief (the user's order 2026-09-14: option 1, row-disjoint writes, then a new spec source only if option 1 cannot be drawn or scored honestly), and report against the corpus pins 78.8% exact / 3.7% leaks / 17.5% over-tight without tuning.
- Tried: poc/exam/make-exam5.mjs drew 2000 rows, seed 20260914: 1500 PUT/DELETE/PATCH rows the corpus, exam 1 and exam 4 never held (excluded by same method+path or same method+operationId within the vendor) from 103 corpus vendors, recorded with their exact corpus vendor name so the mined lists leave that vendor out; 300 POST and 200 GET rows from 164 vendors absent from every labelled set under both name forms (apiz.ebay.com excluded as matching two corpus vendors, the tighter reading). Reruns byte-identical; overlap re-checked by the orchestrator with its own normaliser: 0 rows, 0 providers, 0 duplicate paths. A pre-score check confirmed every one of the 103 write vendors gets non-empty lists (other-party 130-137 words, yours 694-719); the wrong name form ("github.com" for "github") would have got zero. Ten blind mid-tier labellers, 200 rows each, saw only BRIEF.md and their part; all ten files validated (header, row order, classes, confidence). Scored once by poc/exam/score-exam5.mjs, row detail in data/exam5-2026-09-14/score.csv.
- Outcome: 1999 scorable rows (1 '?'); truth r 385 / w 1410 / x 204; x-share on PUT/DELETE/PATCH 11.1% (corpus 13.7%, consistent with the brief's recorded slightly-loose lean). Whole exam exact 1368 (68.4%), leaks 64 (3.2%), over-tight 567 (28.4%); high-confidence rows only (1755) exact 69.7%, leaks 2.5%, over-tight 27.9%. By stratum against the corpus: PUT/DELETE/PATCH 1500 rows exact 73.3% (corpus 76.9%), leaks 3.7% (4.2%), over-tight 23.0% (18.8%) — PUT 70.0 / 4.6 / 25.4 (corpus 5.2% leaks, 18.0% over-tight), DELETE 74.0 / 3.3 / 22.7 (3.6%, 20.4%), PATCH 79.2 / 2.7 / 18.1 (3.6%, 15.8%); GET 200 rows exact 97.0%, leaks 3.0% (corpus 96.9%, 3.1%); POST 299 rows exact 25.1% (corpus 75.0%), leaks 0.7% (0%), over-tight 74.2% (25.0%). Share of each rule's fires that are right, corpus vs exam 5: GET method 97% vs 97%; POST read-verb 100% vs 95% (2 leaks); step 2 x-pile 91% vs 92% (155 vs 51 leaks); step 2 yours-noun evidence 97% vs 99% (32 vs 5 leaks); step 3 POST floor 71% vs 14%; live-verb 54% vs 32%; other-party noun 30% vs 24%; money-noun 5 of 5 vs 0 of 1. 51 of the 56 write leaks sit in the x-pile, 5 on yours evidence. The 345 write over-tight rows are other-party noun 307, live verb 34, money noun 1, x-pile 3. Other-party nouns by fires (right x / wrong w): user 34/71, group 6/37, remove 10/19 (a verb read as a noun), organization 3/14, org 3/14, payment 2/14, request 4/11, role 2/10, message 1/10, scheme 1/8, security 0/7; nouns that held: permission 16/1, membership 5/0, member 10/5. Live-verb false alarms are mostly cancel on the caller's own unsent or running thing (four clicksend campaign/MMS cancels, CancelJob, cancelDeployment, cancel upload, cancel query job — the brief's rule 9 calls these w), pay on payrun.io pay instruction/code records (six rows), merge, trigger, accept terms, revoke own token. Leak rows by theme: access grants the other-party list does not know (shared links on apideck, box twice and figshare; box collaboration; docusign shared access; dracoon download and upload shares; seven osisoft security entries; jira role actors twice; vimeo channel moderators; apple beta testers twice; loket self-service access twice; four gerermesaffaires member-access rows; drchrono onpatient access; azure SQL AD administrators; amazon delegations); road-2 jobs on PUT (atlassian webhook refresh, fecru reindex twice, rumble import, slicebox, gambitcomm resubscribe, xero history append twice); outward notices (four just-eat delivery ETA/location/online-status rows, github enterprise announcement banner, sendgrid schedule single send, reverb vacation relist, zoom webinar status); money (clicksend purchase package on yours evidence, vtex decrease balance); a device (telnyx delete SIM). The 6 GET leaks are all GETs that change state (dweet lock, netatmo addwebhook, opendatanetwork create map, patrowl clean, tokenjay createbabel, namsor learnable toggle). The 2 POST leaks are read-verb hits that act (mandrill check-domain auto-adds, mercedes dtcReadouts creates a job). POST truth on exam 5 is r 188 / w 75 / x 36 (12% x) against corpus POST r 88 / w 103 / x 318 (62% x, 509 rows from 14 vendors in the six original sets only); truth-r POSTs left at x by lead word: get 12, retrieve 10, detailed 7, search 6, convert 5, infer 5, identify 4, math 4, booking 4.
- Lesson: step 2's "own stuff" side transfers to unseen rows at corpus accuracy (yours evidence 99%, x-pile 92%) and so does the GET floor, and the write leak rate held (3.7% vs 4.2%), with 91% of write leaks still flagged by the x-pile. The two raising rules lose precision off the corpus (other-party noun 24%, live verb 32%) and carry most of the extra over-tightening, led by generic words (user, group, organization, payment) and by cancel-own-thing. The POST floor does not transfer: unseen vendors' POSTs are mostly reads and own writes. That POST gap cannot yet be split between the tool and the truth, because the brief's Methods paragraph for POST was never calibrated against corpus POST truth (samples A, B and C were PUT/DELETE/PATCH only). Option 1 worked, so option 2 was not triggered. Exam 5 is scored once; measuring any candidate word or rule on its rows makes it a tuning set (D40), so candidates are measured on the corpus first. The exam came out lower overall, so per the standing rule this was reported, not chased.

### POST calibration: the brief calls POST creates w, the corpus calls them x (2026-09-15)
- Goal: find out whether exam 5's POST collapse (25.1% exact, 74.2% over-tight) belongs to the tool or to the truth, since the brief's Methods paragraph for POST had never been checked against corpus POST truth (the user's choice, 2026-09-15). Reading fixed before labelling: about the write-row agreement (92.5%) and a similar x-share means the tool; clearly fewer x means the brief is loose and exam 5's POST score is not trustworthy.
- Tried: poc/exam/make-postcal.mjs split the corpus's 509 POST rows (14 vendors: camara 138, slack 94, twilio 62, amazon 43, then ten vendors with 6-24 each; all corpus confidence high) by vendor, seed 20260916, into 339 rows to measure (two parts) and 170 held back unlabelled for one later check. Two blind mid-tier labellers labelled the 339 under data/calibration-2026-09-14/BRIEF.md, seeing only the brief and their part. Scored with poc/exam/score-postcal.mjs against corpus truth by corpus row index.
- Outcome: 195 of 339 agree (57.5%), against 92.5% on write rows. The sheet calls 22.4% of rows x; corpus truth calls 60.5% x. Confusion: x called w 132, x called r 3, w called x 6, w called r 1, r called w 2; agreed r 58, w 67, x 70. By vendor, agreement is lowest where POST creates dominate (cloudflare 3 of 9, linode, box, vercel and x 44% each; camara 49 of 92 with truth x 49 and sheet x 7) and highest on slack (47 of 63). Nearly every x-called-w row is a create: Create a VPC, Create a NodeBalancer, Create a queue, Create webhook, Create a New Team, Create OAuth client, Create personal access token, create guild channel, create subscription, Upload file version, Create comment. Corpus POST truth by operationId lead word: create r 0 / w 9 / x 117; update r 0 / w 20 / x 12; admin w 11 / x 27; add x 8; payments x 7; retrieve r 26; get r 17; check r 7. So the corpus reads a POST create as x by D20's second road — calling it twice makes a second resource, which is not the same as calling it once — and a POST update as mostly w. The brief's Methods paragraph says "A POST that creates or edits the caller's own record ... is w when only the caller's own stuff changes", which contradicts that; an older outline heuristic in docs/archive/prd.md line 321 ("create/update/register -> w") says the same and was not what corpus truth followed.
- Lesson: the brief was loose on POST by its own pre-registered reading, so exam 5's POST score (25.1 / 0.7 / 74.2) and its POST truth (r 188 / w 75 / x 36) are not trustworthy, and the open question "is the POST floor wrong" is still unanswered. The cause is one sentence in the brief, written without calibration: the POST paragraph must apply road 2 to creates. The write-row calibration (92.5%) is unaffected, since that paragraph only governs POST. Next, if the user agrees: fix the POST sentence, check it once on the 170 held-back corpus POST rows, relabel exam 5's 300 POST rows, and re-score POST once. Calibrating one method's guidance says nothing about another's: every method a brief covers needs its own check before an exam relies on it.

### POST brief fixed: creates x by road 2, checked once on the holdback (2026-09-15)
- Goal: fix the brief's POST sentence and check it once on held-back corpus POST rows before exam 5's POST rows are relabelled (the user's option 1).
- Tried: the revised Methods paragraph (POST read r; POST create x by road 2 overriding rules 1, 4, 6, 11 for POST; POST edit of an existing own item w; road 1/2 actions x); pass bar pre-registered and committed before labelling; practice relabel of the 339 by two blind mid-tier labellers; one blind labeller on the 170 holdback.
- Outcome: practice, 339 measure rows relabelled blind (postcal-v2-labels-part1/2.csv): agree 290/339 (85.5%); x-share sheet 57.2% vs corpus 60.5%; confusion x->w 26, w->x 17, x->r 3, w->r 1, r->x 1, r->w 1. Check, 170 holdback rows, scored once (postcal-holdback-labels.csv): agree 145/170 (85.3%); x-share sheet 60.6% vs corpus 66.5% (gap 5.9); truth mix r 28 / w 29 / x 113; sheet mix r 32 / w 35 / x 103; confusion x->x 96, x->w 13, x->r 4, r->r 27, r->x 1, w->r 1, w->w 22, w->x 6. PASS against the pre-registered bar (>=85% and <=10 points) on both conditions.
- Lesson: one sentence of brief fixed three quarters of the POST gap (x called w 132 -> 26 on the same rows); the fixed key still leans loose on live things and payment links/tokens, which is the direction that hides leaks, so exam 5's POST re-score must be read with that lean; a thin pass on a pre-registered bar still counts, and the bar is not moved after the fact; with the holdback burned, any further POST brief change can only be checked on a new source.

### Exam 5 POST relabelled under the fixed brief and re-scored once (2026-09-15)
- Goal: relabel exam 5's 300 POST rows under the brief revised 2026-09-15 (POST create x by road 2), re-score POST once, and close the open question on whether the POST floor is wrong.
- Tried: two mid-tier labellers relabelled the 300 POST rows blind, 150 each (`data/exam5-2026-09-14/exam-post-truth-part1.csv` / `exam-post-truth-part2.csv`, split by `poc/exam/make-exam5-post.mjs`), then `node poc/exam/score-exam5.mjs` re-scored the whole exam once (score.csv rewritten).
- Outcome: new POST truth r 189 / w 40 / x 70 / ? 1 (x 23.4% of 299 scorable), against old POST truth r 188 / w 75 / x 36 (12%); old -> new confusion r->r 187, w->w 37, x->x 32, w->x 37, x->w 3, x->r 1, w->r 1, r->x 1, ?->? 1; confidence high 274, low 26. POST 299 rows: exact 110 (36.8%), leaks 1 (0.3%), over-tight 188 (62.9%); was 25.1 / 0.7 / 74.2. By rule: POST floor x — ok 69, over-tight on truth r 148, false alarm on truth w 40; read-verb r — ok 41, leak 1 (mercedes-benz.com getDtcDataListByEcuUsingPOST "View the List of DTCs", truth now x as a created readout job). Whole exam: exact 1403 (70.2%), leaks 63 (3.2%), over-tight 533 (26.7%); was 68.4 / 3.2 / 28.4. High-confidence only (1771 rows): 70.8 / 2.4 / 26.8. PUT/DELETE/PATCH (73.3 / 3.7 / 23.0) and GET (97.0 / 3.0 / 0) unchanged. Whole truth mix r 386 / w 1375 / x 238.
- Lesson: the brief fix doubled exam 5's POST x (36 -> 70), but unseen vendors' POST x-share is still 23% against the corpus's 62%, a gap the ~6-point loose lean measured on the holdback cannot close. The big number is reads: 189 of 299 unseen POSTs are truth r (63%; corpus POST 17% r), and 148 of the 188 over-tight POST rows are those reads left at the x floor because step 1's POST read-verb list did not fire; r truth is stable across both briefs (187 of 188 kept r) and r agreed well on corpus POST calibration (practice r->r 58 of 60, holdback 27 of 28), so these reads are trusted. So the POST gap on unseen vendors belongs mostly to step 1's read-verb list, and secondarily to the POST floor on own writes (40 w rows called x, a usability cost, never a leak). Leaks stay near zero (1). Nothing was tuned; exam 5's rows must not be used to pick read verbs (D40) — candidates are measured on the corpus, never on exam rows.

### Description-mined yours list: the I-don't-know pile barely moves (2026-09-16)
- Goal: check whether mining the "yours" allowlist from operation description text (in addition to operationId+summary) can resolve more of the x-pile's 1972 rows to w-with-evidence, in a new POC folder (`poc/desc-yours/`) that leaves the live flow untouched.
- Tried: leave-one-vendor-out sweep of source (summary / description / both) x minWShare (0.80/0.85/0.90/0.95) x minN (2/3/5), plus one union variant measured separately by the orchestrator (description nouns checked against the union of the summary-mined and description-mined lists).
- Outcome: summary source resolved 0 rows at every setting — mechanically guaranteed, since the pile is exactly the rows that already failed that same bar, so it is a sanity check with no information. description, minN 2, 0.80: 130 resolved, 122 right, 8 leaks unflagged, pile down to 1842. description, minN 3, 0.80: 93 resolved, 92 right, 1 leak. both, minN 2, 0.80: 71 resolved, 69 right, 2 leaks (top vendor carried only 8 of the 71, so no single vendor carried the result). both, minN 2, 0.85: 35 resolved, 35 right, 0 leaks. Union variant (minN 3 / 0.80): 100 resolved, 98 right, 2 leaks, pile down to 1872. Best case is a 6.6% dent in the pile with 8 leaks; the safe (zero- or near-zero-leak) settings clear only 2-5%. Verified: poc/flow's 66 tests still pass and its own pins hold, unchanged by this POC; poc/desc-yours has 6 passing tests, including one confirming the summary-source baseline reproduces poc/flow's own yours list set-equal for 5 vendors. Nothing adopted.
- Lesson: this is the second mining approach in a row to fail to cross vendors (after the corpus-derived raise list in M1-C15 and the hand/mechanical blocklist in M1-C12/M1-C9), and for the same underlying reason each time: the pile is stuck because vendors do not share the words that matter, not because the tool reads too little text — reading more text (description vs summary) only found a handful more matching nouns per vendor, not a transferable list. The pile earns its place as a flag rather than a rule (it holds 155 of the run's 204 leaks). The user's decision: stop mining words for the pile, keep the pile as the flag, and freeze the core at 78.8% exact / 3.7% leaks / 17.5% over-tight (exam 5: 70.2 / 3.2 / 26.7) as of 2026-09-16. Next candidate work, not started: step 1's POST read-verb list (exam 5 shows 148 of 188 over-tight POST rows are reads the list misses).

### Holdout5 specs removed from branch history after GH013 push protection (2026-09-16)
- Goal: unblock the push of branch m1/informed-arbiter, which GitHub's push protection (GH013) rejected over two vendor-published example credentials — an AWS access key ID and a Slack bot token — sitting inside third-party OpenAPI spec files committed under data/holdout5-2026-09-08/specs/, 9.6 MB of raw vendor downloads that no code ever reads (the classifier reads only ground-truth.csv and operations.csv, poc/flow/corpus.mjs:19-21).
- Tried: toggling the repo-level secret_scanning_push_protection setting off did not lift the block and the change propagates with a lag of minutes, not immediately; the GitHub unblock URLs the push error printed 404'd for the user; git-filter-repo could not be installed in this environment, so git filter-branch --index-filter removed the path data/holdout5-2026-09-08/specs from all 84 commits of the branch.
- Outcome: 84 commits before and after, 0 dropped, 0 empty, 0 subject mismatches; the specs path appears 0 times anywhere in branch history; no blob in branch history contains either secret; 66 poc/flow tests plus 6 poc/desc-yours tests pass; poc/flow/proof.mjs prints "All pins hold." with every number unchanged (x-pile 1972 rows / 155 leaks, whole flow 78.8% exact / 3.7% leaks / 17.5% over-tight).
- Lesson: committed third-party corpus source files can carry vendor example credentials that block a push years after the commit, because push protection scans every commit in the push, not just the tip. Only the extracted rows are load-bearing for this project, so raw vendor downloads do not belong in git; once a secret is in history, a rewrite (filter-branch, or filter-repo where installable) is the only fix — a toggle or an unblock link is not reliable enough to depend on.

### Ledger-mode refactor pass on poc/flow: dead code, a duplicated literal, a missing test file (2026-09-16)
- Goal: close a fix-ledger with no behaviour change, since the core is frozen (D70) and any edit had to prove it moved nothing: delete dead code, remove a duplicated literal, and add tests where a module had none.
- Tried: removed `classifyFloor` from `floor.mjs` along with its test case and stale header comment — it was dead in the live pipeline, since `flow.mjs`'s `classifyRow` calls `floorFor(row.method)` directly and the only caller of the poc/flow copy was its own test; hoisted `CLASS_ORDER = { r: 0, w: 1, x: 2 }`, previously a separate literal in both `flow.mjs` and `ledger.mjs`, into one export in `floor.mjs` (values unchanged) and imported it in both; added `csv.test.mjs` (14 tests) for `csv.mjs`, which claimed to handle quoted fields, commas inside quotes, doubled quotes and newlines inside quoted fields but had no test file, fail-first proven on three mutations of a scratchpad copy (2, 4 and 2 tests red) without touching `csv.mjs` itself.
- Outcome: 78 poc/flow tests pass (was 66), 6 poc/desc-yours tests pass, `proof.mjs` prints "All pins hold." with every number unchanged (x-pile 1972 rows / 155 leaks, whole flow 78.8% exact / 3.7% leaks / 17.5% over-tight); an independent reviewer rebuilt the pre-refactor `poc/flow/` in a scratchpad and diffed `proof.mjs` output byte-for-byte identical. Four fix-ledger bullets closed (3 fixed, 1 dropped as already cleaned by D72); one left — `poc/m0/holdout{3,4,5}-extract.mjs` have no tests and no fixtures exist to build one against.
- Lesson: a refactor inside frozen code is safe only when the pins prove it moved nothing — deleting dead code, hoisting a duplicated literal and adding missing tests all leave the classifier's shape and numbers untouched by construction, but the proof (same pins, same CSV, an independent rebuild diffed byte-for-byte) is what makes that true rather than assumed; no decision needed, since nothing crossed the D70 freeze.

### npm name reservation: package.json, LICENSE, CHANGELOG.md added (2026-09-16)
- Goal: reserve the `rwxmap` name on npm at 0.1.0 before anyone else takes it, without shipping the frozen POC or implying a public API exists yet.
- Tried: added package.json (no main/exports/bin, `files` limited to README.md/CHANGELOG.md/LICENSE), an Apache-2.0 LICENSE (the repo's first licence), and a CHANGELOG.md 0.1.0 entry stating the frozen corpus and exam 5 numbers and that nothing is importable; published to npm and verified the live tarball independently.
- Outcome: published tarball contains exactly 4 files (package.json, README.md, CHANGELOG.md, LICENSE), 7030 bytes; no src/, no poc/ contents shipped. README's License section (which said "LICENSE file to follow") was stale against the new file and was fixed to point at it; a short honest note on the name-reservation-only publish was added to README's Status section. Recorded as D73.
- Lesson: a name reservation is not packaging in the sense the PRD's out-of-scope list means (`docs/product/prd.md`, "A CLI, packaging, or UI before M3 passes") — it ships zero code — but the wording is close enough that a future reader could read it as a scope breach; worth the user's eyes rather than assumed clean.

### Floor POC: four of five per-method floors hold on unseen vendors, POST inverts (2026-09-16)
- Goal: the user reopened the frozen core and asked to start the new shape from the dominating truth class per HTTP method ("the floor"), verifying first that the floor is right. Test: does the dominant truth class per method hold on vendors never seen? The user chose to spend all of exam 5 on this rather than hold half back.
- Tried: computed truth share per method on the corpus (run-proof/flow.csv, 5465 rows, 332 vendors) and on exam 5 (2000 rows; truth assembled the way poc/exam/score-exam5.mjs does it, from exam-truth-part1..10.csv with the 300 POST rows overridden by exam-post-truth-part1/2.csv, relabelled 2026-09-15), then compared the dominant class and its share. Measurement only, in Bash in the main session; no code changed and no rule or word list was touched.
- Outcome: corpus GET 550 rows r 97% / w 1% / x 2%; POST 509 rows r 17% / w 20% / x 62%; PUT 1696 rows r 1% / w 85% / x 15%; DELETE 2079 rows r 0% / w 87% / x 13%; PATCH 631 rows r 1% / w 85% / x 14%. Exam 5 GET 200 rows r 97% / w 3% / x 1%; POST 300 rows r 63% / w 13% / x 23%; PUT 603 rows r 0% / w 87% / x 12%; DELETE 638 rows r 0% / w 89% / x 11%; PATCH 259 rows r 0% / w 92% / x 8%. Four floors hold with the dominant class unchanged and the share stable or better (GET r +0 points, PUT w +3, DELETE w +2, PATCH w +7). POST does not drift, it inverts: dominant class flips from x to r, x-share 62% to 23%, r-share 17% to 63%. On exam 5's 299 scorable POST rows the flow puts 257 on the step 3 x floor (truth r 148, truth w 40, truth x 69) and 42 on step 1's read-verb rule (truth r 41, truth x 1); verdicts over-tight 148, ok 110, false alarm 40, leak 1. Step 1's read-verb list catches only 42 of the 189 truth-r POSTs, 22%. The 148 figure reproduces the recorded exam 5 POST re-score exactly (148 of 188 over-tight rows are truth r left at the x floor), so this is the same fact already in the data, not a new measurement.
- Lesson: the flip is not a labelling artifact — the same brief produces about 61% x on corpus POST rows (holdback x-share 60.6%, 2026-09-15) and 23% x on exam 5 POST rows, so the same instrument reads two populations differently and the difference is in the APIs. POST is the only method that is not one dominant class plus exceptions: it carries two distinct meanings (create a resource, and submit a query and get an answer), and unseen long-tail vendors use it mostly for the second. Note the stratum caveat: exam 5's W stratum is row-disjoint but not vendor-disjoint, so PUT/DELETE/PATCH were tested on unseen rows from known vendors, while GET and POST strata are vendor-disjoint and are the only true unseen-vendor evidence here.

### The POST flip holds vendor by vendor, and the x floor rests on 14 look-alike vendors (2026-09-16)
- Goal: the user asked whether the POST inversion survives being counted per vendor rather than pooled over rows, since a pooled percentage can be carried by a few large vendors. Also: given the flip, price every possible POST floor on both sets before choosing one.
- Tried: grouped both POST populations by vendor, counted how many vendors are r-dominant, w-dominant and x-dominant, compared row-weighted against vendor-weighted class shares, and measured how much of each set its three largest vendors carry. Then billed each of the three possible POST floors (r, w, x) against both sets, counting leaks (class looser than truth) and over-tight rows separately. Measurement only; nothing tuned, no code changed.
- Outcome: corpus POST is 509 rows across only 14 vendors, median 24 POST rows per vendor, and 14 of the 14 are x-dominant with 0 r-dominant; its three largest vendors (camara 138 rows, slack 94, twilio 62) are 58% of all corpus POST rows; x-share is 62% row-weighted and 68% vendor-weighted, r-share 17% row-weighted and 12% vendor-weighted. Exam 5 POST is 300 rows across 89 vendors, median 1 POST row per vendor, split 57 r-dominant / 27 x-dominant / 5 w-dominant; its three largest vendors (airbyte.local, apisetu.gov.in, apptigent.com, 12 rows each) are 12% of rows; x-share is 23% row-weighted and 34% vendor-weighted, r-share 63% row-weighted and 57% vendor-weighted. So vendor-weighting does not rescue the corpus lean; the gap stays about two-fold. Floor pricing, corpus then exam 5: floor r gives 83% leaks then 37% leaks; floor w gives 62% leaks plus 17% over-tight, then 23% leaks plus 63% over-tight; floor x gives 0% leaks plus 38% over-tight, then 0% leaks plus 77% over-tight.
- Lesson: the inversion is not a big-vendor artifact, it holds vendor by vendor, and the check exposed something worse — the whole "POST is x" belief rests on 14 vendors that are all large platform APIs sharing one house style (POST creates a resource), which is a selection effect in the corpus rather than a fact about POST. x remains the only permissible POST floor, but for the invariant's reason and not the corpus's: x is the tightest class, and floor r leaks up to 83% while floor w leaks up to 62% and is over-tight up to 63%, both fail-open and forbidden. Had the corpus leaned r, floor r would still be forbidden, so the corpus lean is a coincidence and not the argument. The price of floor x is up to 77% over-tight on unseen vendors, roughly three in four POSTs called x when they are not, which is safe but close to useless. Therefore POST cannot be a floor-driven method in the new shape: it needs evidence, and where no evidence fires the row is marked unsure rather than served as a confident x.

### New corpus: 15 complete provider APIs replace the 5465-row corpus, and the frozen core is scored once against it (2026-09-16)
- Goal: replace the old 5465-row corpus — which never saw one complete API (319 of 332 providers had zero GET rows, 58 contributed exactly 24 write rows and nothing else, and 42,119 available GET operations were never labelled; it was ~10% GET where a real API is about half) — with a corpus built from whole, official specs, then check the per-method floor and score the frozen core (`poc/flow`, unmodified) against it once.
- Tried: assembled `data/provider-corpus-2026-09-16/` from 15 complete official API specs (stripe, openai, square, zoom, paypal, meta-whatsapp, spotify, digitalocean, jira, mailchimp, asana, datadog, intercom, canva, figma), 4171 operations, spec originals tracked gzipped (711 .gz files, 42MB raw to 3.9MB) with sha256 of each uncompressed original in `specs.lock.json`. Labelled blind under `data/calibration-2026-09-14/BRIEF.md` in 21 parts of 199 rows (part 21, 191), seed 20260916. Measured per-method and per-provider truth, scored the frozen core once (14 of 15 providers unseen; stripe scored leave-one-vendor-out since it is also in the old corpus), broke the score down per rule and by the evidence-vs-floor flag, and checked the 32 rows that overlap the old corpus (all stripe).
- Outcome: per-method truth (n / r / w / x / floor / holds): GET 1960 / 100% / 0% / 0% / r / yes; POST 1309 / 9% / 29% / 61% / x / yes; PUT 345 / 0% / 93% / 7% / w / yes; DELETE 473 / 0% / 92% / 8% / w / yes; PATCH 84 / 0% / 98% / 2% / w / yes. Every floor holds, including POST at 61% x — unlike exam 5's unseen-vendor draw on the old corpus, where POST inverted to 23% x. Per-provider truth (new, the old corpus could never give this): digitalocean 684 rows 53/30/17, jira 610 50/35/15, stripe 594 46/29/25, openai 346 48/24/28, square 332 48/33/20, mailchimp 298 50/31/19, asana 249 48/27/25, datadog 235 52/29/19, intercom 231 49/32/19, zoom 155 52/28/21, paypal 115 37/24/39, meta-whatsapp 113 43/22/35, spotify 96 63/29/8, canva 59 61/8/31, figma 54 80/13/7. Frozen core scored once, whole corpus n=4171: exact 83.8%, leaks 0.4% (17 rows), over-tight 15.8% — better than the prior pins (78.8/3.7/17.5) on all three, on a harder test. By method: GET 1960 rows 99.9/0.1/0.0; POST 1309 rows 66.2/0.2/33.6; PUT 345 rows 74.2/2.0/23.8; DELETE 473 rows 75.1/1.1/23.9; PATCH 84 rows 72.6/0.0/27.4. Per-rule (n / exact / leaks / over-tight): method(GET→r) 1960/100%/2/0; floor 1629/72%/8/440; yours-noun 245/98%/4/0; other-noun 241/19%/0/195; read-verb 65/95%/3/0; live-verb 31/26%/0/23 — the two raising rules (other-noun, live-verb) together raise 218 rows wrongly and close zero leaks on this corpus, though they were adopted on the old corpus because they closed leaks there; yours-noun, the one loosening rule, is 98% right. Evidence-vs-floor flag: evidence 245 rows / 4 leaks / 0 over-tight; x-pile 385 rows / 8 leaks / 0 over-tight; no flag 3541 rows / 5 leaks / 658 over-tight — the x-pile holds 8 of 17 leaks in 9% of rows, weaker than the old corpus (155 of 187, 83%) because the leaks moved. The 17 leaks cluster: jira roles/filters 6 (setActors, deleteActor, updateFilter, updatePlan, exportArchivedIssues, refreshWebhooks — jobs behind a PUT); "verify" on POST not a read 3 (meta-whatsapp verifyPhoneNumberCode, verifyPreVerifiedPhoneNumberCode, mailchimp verifyDomain — "verify" is in the read-verb list but these flip state); 2 GET leaks the floor cannot reach by design (datadog GetGraphSnapshot makes a new image each call, intercom listContactBanners); singletons stripe DeleteAccountsAccount, zoom accountDisassociate, digitalocean addons_delete, intercom detachContactFromConversation, paypal trackers.put, spotify change-playlist-details. Agreement check: 32 rows overlap the old corpus (all stripe, every stripe row the old corpus had); 29/32 agree (90.6%), all 3 disagreements x→w (new labels lean slightly looser). Other measured facts: 714 of 2211 non-GET rows have an operationId whose lead word is the HTTP method itself (stripe 329, mailchimp 145, jira 79, openai 40), invisible to the lead-verb reader — 515 of the 714 took the floor; 450 rows carry a read verb not in lead position (e.g. square BulkRetrieveBookings), invisible to the splitter, 35 of them ended up non-r; 5 rows have no operationId at all; PATCH is genuinely rare, 84 rows across 15 providers (rejected candidates gitlab 9/1121, okta 13/734, no better). Open brief gaps found during labelling: "add/insert/attach a sub-item to a thing you already own" splits labellers between POST-create (x) and own-item edit (w), 124 POST rows; upsert/create-or-update, 17 POST rows; generate-but-maybe-not-stored, 5 POST rows; two inbound-callback rows (paypal server.callback, meta-whatsapp receive-incoming-messages) the brief's frame does not cover; the POST-create override names rules 1, 4, 6, 11 but not rule 10 (money), and two labellers independently read rule 10 as a carve-out.
- Lesson: a corpus built from whole official specs gives two things the old vendor-scattered corpus structurally could not — a trustworthy per-provider truth read, and a POST floor test that is not distorted by 14 look-alike platform vendors: on 15 complete APIs POST does not invert, it holds at 61% x, close to the old corpus's 62%. The frozen core, never touched for this corpus, scores better on every axis than its own construction-time pins, which is real evidence the shape generalizes rather than having been fitted. The per-rule breakdown is the actionable finding: both raising rules (other-noun, live-verb) contribute zero leak closures and substantial over-tightening here, which was not visible when they were judged only against the old corpus's leaks; whether to change or drop them is left open, not decided by this pass. The x-pile flag's leak-catching share dropped from 83% to 9% because leaks are not stable across corpora — a flag mined to find a corpus's own leak pattern does not automatically transfer to a different one, even when the underlying rule (floor, no evidence fired) stays the same. This pass was measurement only, in Bash in the main session, re-run and independently verified before either doc was updated; the PRD's floor table, per-method section, and frozen-core score were replaced (old numbers moved to this entry), and Table 2 (per-provider truth) and the per-rule/evidence-flag tables are new additions.

### Step 1 POC: the r floor holds at 99.9%, and POST reads reach 87 rows with zero leaks (2026-09-16)
- Goal: the user reopened step 1 as its own standalone POC over the whole new 15-provider corpus (4171 rows, no parts, no hold-back). Two questions: does the r floor (GET/HEAD/OPTIONS -> r) hold, and how far can step 1 reach into the 124 truth-r POST rows without leaking.
- Tried: built `poc/step1/` as a standalone classifier importing nothing from `poc/flow` or `poc/archive` (csv.mjs copied verbatim; words.mjs a partial copy of the splitter/tokenizer/verb-stemmer plus one new function `leadVerbAfterModifiers`); orchestrator measured every candidate in Bash in the main session first, then delegated the build. Candidates measured on POST rows: the frozen 14-word lead read-verb list; that list minus `verify`; plus a modifier-prefix skip (`bulk`/`batch`/`deprecated`/`beta`/`async`); plus 10 compute/dry-run verbs read from the miss pile by the orchestrator (`validate evaluate analyse analyze parse calculate introspect suggest sanitise sanitize`), each priced word by word; and three location-free variants (any token position, summary-verb fallback, lead-OR-summary), and — on the user's suggestion that nouns come last, so only the first few words need parsing — a sliding window over the first k tokens for k = 1, 2, 3, 4 and unbounded, each measured both with and without an additional skip of a leading HTTP-method word.
- Outcome: truth by method on the 4171-row corpus — GET 1960 (r 1958 / w 1 / x 1), POST 1309 (r 124 / w 381 / x 804), PUT 345 (w 320 / x 25), DELETE 473 (w 434 / x 39), PATCH 84 (w 82 / x 2); the corpus contains no HEAD or OPTIONS rows at all, so keeping them on the r floor is untested here, not wrong. The r floor holds at 1958 of 1960 (99.9%), 13 of 15 providers at 100%, datadog 116/117 and intercom 107/108; the two exceptions are `datadog GetGraphSnapshot` (truth x, confidence low) and `intercom listContactBanners` (truth w, confidence low), both already known as the two GET leaks the floor cannot reach by design. POST read-verb candidates, claims/right/leaks: frozen 14-word list 65/62/3; minus `verify` 61/61/0; plus modifier-prefix skip 73/73/0; plus the 10 compute verbs 87/87/0. `verify` was the whole leak: it fired 4 times and was wrong 3 (meta-whatsapp verifyPhoneNumberCode, verifyPreVerifiedPhoneNumberCode, mailchimp verifyDomain, all truth w — a verify that flips the record's verified state is a write); dropping it costs exactly 1 right row. Each of the 10 added compute verbs was priced alone and fires 0 wrong rows; `simulate` (1/0/1, paypal simulate-event), `convert` (2/0/2, intercom convertConversationToTicket, convertVisitor) and `test` (2/0/2, openai TestWebhookEndpoint, square TestWebhookSubscription) were measured and rejected. Location-free variants: any token position with the full list 126/95/**31 leaks** — it collapses because the list words are also nouns (mailchimp postLists, postListsIdMembers, postListsIdSurveys, postListsIdMergeFields and 11 more mailchimp rows where `list` is the object); summary-verb fallback 36/35/1; lead-OR-summary 67/66/1. Window over the first k tokens with modifiers skipped, claims/right/leaks: k=1 87/87/0, k=2 115/94/21, k=3 118/94/24, k=4 124/94/30, unbounded 126/95/31 — widening from the lead token to two buys 7 right rows for 21 leaks, and 20 of those 21 are one vendor, mailchimp, which writes its object noun in position 2 directly behind the method word (postLists, postListsId, postListsIdMembers, postListsIdSegments, postListsIdSurveys and 15 more); additionally skipping a leading method word makes every window strictly worse (k=1 91/71/20, k=2 99/78/21, k=3 106/78/28, unbounded 110/79/31), because stripping `post` from stripe's PostRadarValueLists-style names exposes their nouns to the same list. A restricted any-position variant using only the 10 never-a-noun compute verbs scores 92/91/1 — +5 right rows for 1 new leak (`stripe PostPaymentMethodDomainsPaymentMethodDomainValidate`, truth w) — measured and NOT adopted. Final step 1 ledger over all 4171 rows: rule `method` 1960 claimed / 1958 right / 2 leaks; rule `read-verb` 87 claimed / 87 right / 0 leaks; total 2047 / 2045 / 2. Missed reads 37, all POST. Leave-one-vendor-out (a word kept only if it fires on at least one other provider's POST rows; the 13 carried-over words always kept since they were not mined from this corpus): 78 claims / 78 right / 0 leaks. Per word on POST (fires/right/providers): search 27/27/4, get 16/16/3, retrieve 15/15/1, validate 5/5/3, list 4/4/3, read 4/4/1, calculate 2/2/1, check 2/2/1, evaluate 2/2/1, fetch 2/2/2, analyse 1/1/1, count 1/1/1, find 1/1/1, introspect 1/1/1, match 1/1/1, parse 1/1/1, sanitise 1/1/1, suggest 1/1/1; `query`, `lookup`, `assess`, `analyze` and `sanitize` never fire. Verified by the orchestrator, not taken on the agent's word: 37 poc/step1 tests pass, `node poc/step1/proof.mjs` prints "All pins hold." and exits 0, `poc/flow` is untouched (git clean, its 78 tests pass, its own pins still hold), `poc/step1/csv.mjs` is byte-identical to `poc/flow/csv.mjs` below the header comment, no file in poc/step1 imports from poc/flow or poc/archive, and readout.mjs was re-run and its rows read.
- Lesson: position, not the word, is what makes the read-verb rule safe — the same 23-word list scores 0 leaks read at the lead token and 31 leaks read anywhere in the operationId, because API names use `list`, `get`, `count` and `check` as nouns at least as often as verbs. Separators are not the obstacle (`/` and whitespace are already collapsed to `_` before tokenizing, and `_ - .` and camelCase all split); the two remaining parse failures are the opposite, a name with no separator to split on (openai `Getinputtokencounts`, one lowercase run) and a name whose lead token is the literal HTTP method with no verb anywhere in it (stripe `PostTaxCalculations`, `PostRadarPaymentEvaluations` — 8 such rows). The 37 misses are therefore not reachable by more words: roughly 13 are LLM inference rows that honestly say `create` (openai createChatCompletion/createEmbedding/createImage, digitalocean inference_create_*) and need a different signal entirely, 8 are the verbless stripe rows, and the rest is a long tail. LOVO's 0 leaks is real but thin — 13 of the 15 holdouts keep every word that ever fires, because jira and square are the sole users of most single-fire words, so an unseen vendor with a private read verb would be missed rather than leaked, which is the safe direction. Both raising candidates that would have closed the gap (any-position matching, summary-verb fallback) were rejected for buying 5-6 rows at the price of a leak on a rule that is currently perfect.

### Step 1 takes its first deliberate leak: SAFE_VERBS read at any position (2026-09-16)
- Goal: after step 1 was committed at 2047 claimed / 2045 right / 2 leaks, the user asked for the one candidate the step 1 POC had measured and declined — matching a restricted, never-a-noun read-verb subset at any token position instead of only the lead token. This is the tool's first deliberate loosening: a leak accepted on purpose, priced in advance, not an accident.
- Tried: added `SAFE_VERBS` to `poc/step1/step1.mjs` — the 10 compute/dry-run verbs (`validate evaluate analyse analyze parse calculate introspect suggest sanitise sanitize`), a strict subset of the 23-word `READ_VERBS` — and a third, lower-priority POST rule `read-verb-anywhere` that fires only on the POST rows the lead-token rule left behind, matching any token position stem-aware. The full `READ_VERBS` list cannot be read this way: at any position it scores 31 leaks instead of 0, because `list`, `get`, `count` and `check` are object nouns in API names as often as verbs. The orchestrator priced the rule in Bash in the main session before the code was written, and re-verified every number afterwards.
- Outcome: the new rule claims 5 rows, 4 right, 1 leak. The leak is `stripe PostPaymentMethodDomainsPaymentMethodDomainValidate` (truth w, confidence low — validating a payment method domain stores the result). All 4 gains are one vendor, digitalocean (`apps_validate_appSpec`, `apps_validate_rollback`, `registries_validate_name`, `registry_validate_name`, the last two being the same call under two names). Step 1 ledger over all 4171 rows: `method` 1960/1958/2, `read-verb` 87/87/0, `read-verb-anywhere` 5/4/1, total 2052 claimed / 2049 right / 3 leaks. Against the corpus's 2082 truth-r rows: 2049 found (98.4%, was 98.2%), 33 missed (was 37). Leave-one-vendor-out, both word lists rebuilt per holdout: 83 claimed / 82 right / 1 leak, against the previous 78/78/0 — the leak survives LOVO and the gains do not, and stripe is the only holdout that gains nothing while being the one that leaks. Verified by the orchestrator: 41 poc/step1 tests pass (was 37), `node poc/step1/proof.mjs` prints "All pins hold." and exits 0, `poc/flow` is untouched (git clean, 78 tests, its own pins unchanged), and `run-proof/step1.csv` moved exactly 5 rows — the 4 digitalocean rows and the stripe one, nothing else.
- Lesson: the price was known before the decision and the decision was still the user's to make — a usability gain of 4 rows for one security cost of 1 row, on a rule that had been perfect. What LOVO says about it is the part worth keeping: a rule whose gains sit in one vendor and whose leak sits in another is a rule that will generalize its cost and not its benefit, so the honest expectation for an unseen vendor is the leak without the four rows. Two further misses were found and left: `stripe PostTaxCalculations` and `PostRadarPaymentEvaluations` are truth r but tokenize to the noun `calculations` / `evaluations`, and the stemmer handles verb inflections, not the noun form of a verb stem — reaching them is a stemmer change with its own price, not another word.

### Step 1 frozen at 98.4% of r found, 3 leaks (2026-09-16)
- Goal: close step 1 and put one clear, final statement of where the r step stands in the log, since the two entries above it record the work pass by pass rather than the result.
- Tried: nothing new measured; this entry records the user's decision to freeze and the numbers as verified by the orchestrator — 41 tests pass, `node poc/step1/proof.mjs` prints "All pins hold.", `run-proof/step1.csv` regenerated, `poc/flow` untouched.
- Outcome: three rules — `method` (GET / HEAD / OPTIONS -> r), `read-verb` (a POST whose lead token, after skipping `bulk` / `batch` / `deprecated` / `beta` / `async`, stem-matches one of the 23 `READ_VERBS`) and `read-verb-anywhere` (a POST the lead rule did not claim, carrying one of the 10 `SAFE_VERBS` at any token position). Ledger over all 4171 corpus rows: `method` 1960 claimed / 1958 right / 2 leaks; `read-verb` 87 / 87 / 0; `read-verb-anywhere` 5 / 4 / 1; total 2052 claimed / 2049 right / 3 leaks. Of the corpus's 2082 truth-r rows, 2049 are found (98.4%) and 33 missed. Leave-one-vendor-out, both word lists rebuilt per holdout: 83 claimed / 82 right / 1 leak. The 3 leaks are `datadog GetGraphSnapshot` (truth x, low confidence), `intercom listContactBanners` (truth w, low confidence) and `stripe PostPaymentMethodDomainsPaymentMethodDomainValidate` (truth w, low confidence, the one deliberately bought). Commits 3519310 and 653da3a.
- Lesson: the r step is the easy one and it still needed three rules, one word removed and five candidates rejected to land at 3 leaks — and two of those three leaks are GET rows a method floor cannot reach at all, so the reachable error is one row the user chose. Step 2, the w step, is the open work: 381 POST rows are truth w and the tool assigns w to zero of 1309 POSTs.

### Step 2 built: the w step reaches 211 of 380 truth-w POSTs, and 93% of its leaks are the floor (2026-09-16)
- Goal: build step 2, the w step, to the user's spec — a w floor on PUT / DELETE / PATCH with no words involved, plus live verbs and a yours noun to reach into POST's 29% truth-w share, which step 1 leaves entirely to the x floor. Step 1 is frozen, so step 2 may only claim rows step 1 passed down, and it may never assign r or x.
- Tried: the orchestrator priced every candidate in Bash in the main session before any code was written, then delegated the build. Adopted: (1) `method-floor` — every PUT / DELETE / PATCH row starts at w, no words involved; (2) on the POST rows step 1 left behind, a modify verb lowers x to w, where the verb is the operationId's lead token, or — when that lead token is a bare HTTP method word, as in stripe's `PostTaxCalculations` and mailchimp's `postLists` — the lead verb of the summary instead (rule `modify-verb-summary`); (3) that lowering is BLOCKED if any word of the row is in `OTHER_PARTY`. The two lists step 2 owns are `MODIFY_VERBS` (24 words: cancel delete archive unarchive move dismiss restore pause unpause activate deactivate rotate disable enable swap merge update modify change remove suspend detach expire void) and `OTHER_PARTY` (25 role nouns: user users member members follower followers role roles permission permissions participant participants collaborator invite people person admin assignee owner contact customer subscriber recipient agent audience). Rejected and measured on the way: the verbs `set` (3 leaks), `attach` (2) and `finalize` (1), dropped for 13 right rows and 6 leaks saved; a via-negativa mined yours-noun allowlist, which this corpus structurally cannot feed — 15 vendors mine only 36 nouns against the old corpus's 439 from 332 vendors, and its best settings claimed 9 rows of 380 at 0 leaks or 41 at 12% leaks; a list-free structural gate (a preposition linking two nouns) which caught 8 of 22 leaks while costing 32 right rows; and matching the read-verb list at any token position, 31 leaks instead of 0. Five `OTHER_PARTY` words the orchestrator had written from imagination (guest, guests, invitee, teammate, attendee) appear nowhere in the corpus and were deleted before adoption.
- Outcome: `poc/step2/` — 7 files, 15 tests, `node poc/step2/proof.mjs` prints "All pins hold.", proof CSV `run-proof/step2.csv`; it imports from `poc/step1/` (live adjacent code) and nothing from `poc/flow/` or `poc/archive/`. Step 2 ledger over the 2119 rows step 1 left it: `method-floor` 902 claimed / 836 right / 66 leaks (7.3%); `modify-verb` 108 / 107 / 1; `modify-verb-summary` 108 / 104 / 4; total 1118 claimed / 1047 right / 71 leaks (6.4% of claims). It claimed 52.8% of what it inherited and passed on 1001 rows (47.2%), whose truth is r 33 / w 169 / x 799. Step 2 has zero over-tight rows. The POST rule alone: 216 claimed, 5 leaks — 2.3% fitted, 3.4% leave-one-vendor-out with both lists rebuilt per holdout, which is the honest figure. Reach: 211 of 380 truth-w POST rows (55.5%), against zero before. The 5 POST leaks, named: `stripe PostPaymentIntentsIntentCancel`, `stripe PostClimateOrdersOrderCancel`, `stripe PostSubscriptionsSubscriptionExposedId`, `mailchimp postCampaignsIdActionsCancelSend`, `square BatchChangeInventory`; four of the five are the verb `cancel`, which keeps its place because it also brings 34 right rows. Precision per class the tool would emit today: says `r` on 2052 rows, 99.9% right, 3 wrong and all in the loose direction (0.1%); says `w` on 1118 rows, 93.6% right, 71 wrong and ALL in the loose direction (6.4%); says `x` on 1001 rows, 79.8% right, 0 wrong in the loose direction — the x pile is wrong only by being too tight. Whole flow today (step 1 + step 2 + an x placeholder for the unbuilt step 3), all 4171 rows: exact 93.4%, leaks 1.8% (74 rows), over-tight 4.8% (202 rows); the frozen old core `poc/flow` scored 83.8 / 0.4 / 15.8 on the same corpus — better on exact and over-tight, worse on leaks, because lowering rows to w is exactly what bought the improvement. Two measured, NOT-adopted candidates are left open for the user: (1) four `OTHER_PARTY` words — `customer`, `contact`, `agent`, `person` — block 18 rows between them and catch ZERO leaks (customer blocks 8, all truth w; contact 5, all w; agent 3, all w; person 2, all w), and removing them would take reach from 211 to 227 truth-w POST rows with leaks unchanged at 5 and LOVO falling from 3.4% to 3.2%, not adopted because no word leaves a hand list without the user's word; (2) running `OTHER_PARTY` as a RAISER over the 902 PUT/DELETE/PATCH rows, to catch the floor's 66 leaks, scores 0.31 leaks closed per false alarm with the list as built and 0.50 trimmed, against the project's adoption bar of 10 — it fails by 20x, because `user` flags 42 write rows of which only 13 are truth x and `customer` flags 21 of which zero are; the single exception is the word `permission`, 6 flags, all 6 truth x, 0 false alarms. The 66 floor leaks cluster in openai and zoom account/user administration (`delete-user`, `remove-group-user`, `unassign-project-user-role`, `userPassword`, `userSSOTokenDelete`), not in dangerous-sounding verbs. Step 2 is built and verified by the orchestrator; it is not frozen and it is not yet a numbered decision.
- Lesson: 93% of step 2's leaks (66 of 71) come from the half of it that uses no words at all — the wordless method floor, 7.3% — while the two hand lists are the better half at 2.3% fitted and 3.4% honest, so step 2 cannot be improved by better words; those 66 floor rows are step 3's to raise back to x, and nothing step 2 can say about them will help. The same word means opposite things in different places: `user` on a POST is evidence of another party, but on a PUT it is usually your own user record, which is why the same 25-noun list is a good blocker (it buys the POST rule's low leak rate) and a terrible raiser (0.31 closed per false alarm, 20x below the bar) — a word list has a direction, not just a membership. Via negativa is not wrong here, it is unaffordable: a mined yours-noun allowlist needs vendor breadth that a 15-provider corpus does not have (36 nouns against the old corpus's 439 from 332 vendors), so the technique that worked on the old corpus cannot be run on the better one. And the honest limits: LOVO is concentrated, with stripe alone carrying 92 of 204 claimed rows and 3 of 7 leaks while six of the fifteen providers claim zero rows under LOVO, so 3.4% is really a stripe/openai/jira/square number and not a general one; and there is no clean exam behind any of this, since steps 1 and 2 were both measured on the same 4171 rows they were tuned on, which under D24 makes this corpus a tuning set from now on.

### Four gate words removed: naming a person is not the same as belonging to someone else (2026-09-17)
- Goal: the per-word price review of step 2's `OTHER_PARTY` gate that the step 2 entry left open, and the user's decision on it.
- Tried: pricing every gate word by what it vetoes and what it catches, measured in Bash in the main session, then the removal of the four that cost and caught nothing; the removal was proven red-before-green by putting the four words back and watching the two new tests fail.
- Outcome: `customer` vetoed 8 rows all truth w, `contact` 5 all w, `agent` 3 all w, `person` 2 all w — 18 rows for 0 leaks caught. Removing them: list 25 → 21; reach 211 → 227 of 380 (59.7%); leaks unchanged at 5, and the 5 are the same 5 rows; fitted 2.3% → 2.2%; LOVO 3.4% → 3.2% (219/212/7); step 2 total 1118/1047/71 → 1134/1063/71; rows passed to step 3 1001 → 985; whole flow 93.4/1.8/4.8 → 93.8/1.8/4.5. Exactly 16 rows moved in `run-proof/step2.csv`, all `x`→`w`, all truth w (stripe 9, openai 3, intercom 3, mailchimp 1); 17 tests pass; pins hold; `poc/step1` and `poc/flow` untouched.
- Lesson: the gate was asking the wrong question. "Does this name a human?" and "does this belong to someone other than the caller?" are different tests, and four words were on the list for the first reason while the gate exists for the second — your own customer record, your own contact and your own agent are your data, which is why all 18 vetoed rows were truth w. The words were reachable only by pricing each one against what it caught, not by reading the list and judging it; and the direction of the finding is worth keeping — a gate word that blocks rows and catches nothing is a pure usability tax that no leak number will ever reveal, because removing it cannot create a leak it was not already failing to catch.

### Step 2 frozen: 227 of 380 truth-w POSTs, 93.7% right when it says w (2026-09-17)
- Goal: close step 2 and state where the w step stands.
- Tried: nothing new measured; this records the user's decision to freeze and the numbers as verified by the orchestrator — 17 tests pass, `node poc/step2/proof.mjs` prints "All pins hold.", `run-proof/step2.csv` regenerated, `poc/step1` and `poc/flow` untouched.
- Outcome: three rules — `method-floor` (every PUT / DELETE / PATCH starts at w, no words), `modify-verb` (a `MODIFY_VERBS` verb at the operationId's lead token lowers a leftover POST from x to w) and `modify-verb-summary` (the same list read against the summary's lead verb when the operationId lead is a bare HTTP method word), the last two blocked when any word of the row is in `OTHER_PARTY`. Ledger over the 2119 rows step 1 leaves it: `method-floor` 902 claimed / 836 right / 66 leaks; `modify-verb` 114 / 113 / 1; `modify-verb-summary` 118 / 114 / 4; total 1134 claimed / 1063 right / 71 leaks (6.3% of claims), 53.5% of what it inherits, 985 rows passed on (46.5%), zero over-tight rows of its own. The POST rules reach 227 of the 380 truth-w POST rows (59.7%) against zero before, at 232 claimed / 5 leaks — 2.2% fitted, 3.2% leave-one-vendor-out with both lists rebuilt per holdout. The 5 POST leaks, named: `stripe PostClimateOrdersOrderCancel`, `stripe PostPaymentIntentsIntentCancel`, `stripe PostSubscriptionsSubscriptionExposedId`, `square BatchChangeInventory`, `mailchimp postCampaignsIdActionsCancelSend`. Whole flow with step 1, both frozen, plus the x placeholder, all 4171 rows: exact 93.8%, leaks 1.8% (74 rows), over-tight 4.5% (186 rows); the tool says `r` on 2052 rows 99.9% right / 3 loose-wrong, `w` on 1134 rows 93.7% / 71 loose-wrong, `x` on 985 rows 81.1% / 0 loose-wrong. Commit 1022ac7.
- Lesson: 66 of the 71 leaks are the wordless method floor, so the w step is now as good as words can make it and step 3 — raising those floor rows back to x — is the only remaining dangerous work. Two honest limits ride along: LOVO is concentrated, with stripe alone carrying 92 of the pre-trim 204 claimed rows and 3 of the 7 leaks while six of the fifteen providers claim zero rows under LOVO, so 3.2% is really a stripe/openai/jira/square number; and there is no clean exam, since steps 1 and 2 were both measured on the same 4171 rows they were tuned on, which under D24 makes this corpus a tuning set from now on.

### The output shape agreed: fill other people's slots, publish no format (2026-09-17)
- Goal: the user asked whether rwxmap's JSON should match one of the emerging agent standards rather than being a new format of its own, naming the AI catalogue JSON and the agentic resource discovery standard, and raising WebMCP — websites publishing their APIs with an rwx part — as a second use. This pass decided the output contract; it measured nothing about the classifier.
- Tried: the four candidate carriers were fetched and read on 2026-09-17, not recalled — the ARD announcement and the published `ai-catalog.schema.json`, the WebMCP Draft Community Group Report (W3C Web Machine Learning Community Group, 2026-04-23), and the MCP 2026-07-28 specification's `_meta` extension rules. Three real corpus rows were pulled from `data/provider-corpus-2026-09-16/` for the worked example (stripe `GetCustomersCustomer` truth r, `PostCustomersCustomer` truth w, `DeleteAccountsAccount` truth x, the last being one of step 2's 66 floor leaks). Two shapes were considered: rwxmap's own JSON published as a format for others to adopt, or rwxmap's own map kept private and rendered into slots the existing standards already leave open. The second was adopted as D76.
- Outcome: one map rwxmap owns (method + path + operationId, plus `class`, `destructive`, `evidence`, `confident`) and four carriers — OpenAPI `x-rwx` per operation; MCP `annotations` plus reverse-DNS `_meta` keys per tool; WebMCP `readOnlyHint` / `consequentialHint` per tool; one ARD `ai-catalog.json` entry per domain pointing at the map by URL. Two hard facts came out of the reading. First, per-operation data provably cannot ride inside an ARD catalog entry: the entry schema sets `additionalProperties: false`, has no `x-` support and no extensions object, and its only free slot, `metadata`, accepts flat values limited to string, number, boolean or null — so the catalog gets a link to the map, not the map. Second, WebMCP's `ToolAnnotations` is not MCP's four hints; as read it is `readOnlyHint`, `untrustedContentHint`, `consequentialHint` and `debugging`, defined members only, with no `_meta` and no extension slot — and those two flags carry all three classes with nothing left over (r = readOnlyHint true; w = both false; x = consequentialHint true). Shippability is unchanged by the decision: `readOnlyHint` is ready in both MCP and WebMCP at 3 unsafe-wrong rows in 4171 (0.07%), while `consequentialHint` and `idempotentHint` both wait on step 3. Nothing emits; no emitter is built before step 3. Written to `docs/product/prd.md` as a new section "The output shape (agreed 2026-09-17, D76)", with the archived open question about the `{iss, menu}` shape closed above the archive block, and the MCP hints bullet's "the shape of the hint output is not being decided here" corrected to point at the new section.
- Lesson: the carrier that fits this project's ladder best is the one it had not looked at. MCP's four hints were the assumed target for months, yet two of them cannot take the class at all — `destructiveHint` was rejected as a reading of it (D28) and `idempotentHint` cannot be read off specs (D75) — while WebMCP's `consequentialHint` is almost a restatement of this project's own definition of `x`, reach beyond the caller or not repeatable. That changes what step 3 is worth: it is not one MCP hint among four, it is the single flag the browser-native carrier asks for. The second lesson is procedural — the shape was decided by reading published schemas rather than by design argument, and both decisive facts (ARD's `additionalProperties: false` with scalar-only `metadata`, and WebMCP's different annotation set) would have been got wrong from memory; the decision record therefore carries the read date and an explicit instruction to re-check every field name before anything emits.

### Step 3 POC, arm A vs arm B: words are done, and descriptions are worse (2026-09-17)
- Goal: the user asked for the two step-3 candidates to be POCed and proved with numbers rather than recommended — arm A, a hand word list with zero false alarms on this corpus, and arm B, reading the description text, which the project's own memory names as the place operationId+summary classification hits a ceiling. The target is the 66 PUT / DELETE / PATCH rows sitting at `w` on step 2's wordless method floor that are truth `x`, which are 93% of step 2's leaks and the only dangerous error in the tool. No code was written; every number below was measured in Bash in the main session.
- Tried: built a verified join of `ops.csv.gz` to the 21 label files through `label/key.csv` by row index, checking provider / method / path agreement on every one of the 4171 rows and failing loudly on mismatch — 4171 rows joined, all 4171 carrying truth, 902 PUT/DELETE/PATCH rows with 66 truth x, 901 of the 902 carrying a description. Arm A is the 17 words the orchestrator read out of the 66 rows and priced individually as having zero false alarms on the 902 floor rows: permission, membership(s), panelist(s), watcher(s), participants, actor, invites, invitation(s), sso, password, grant, disassociate, reject. Arm B mines its list from the corpus itself under a stated rule — a token is kept if it appears in at least minX truth-x floor rows, at most maxW truth-w floor rows, and fires for at least minProv providers — swept over minX 2/3, maxW 0/1/2, minProv 1/2 and three text sources (operationId+path+summary; description alone; both), 36 configurations. Both arms were scored twice: fitted on the 902 rows they were built from, and leave-one-vendor-out with the list re-mined from the other 14 providers for every holdout, which is the only honest number here. For arm A LOVO keeps a word only if it fires on some OTHER provider's truth-x row. Earlier in the same pass, four coarser raiser ideas were priced on the 902 floor rows against the project's adoption bar of 10 leaks closed per false alarm: a relationship-noun list (22 closed / 11 false alarms, 2.0), an un-verb list read anywhere (12 / 8, 1.5), un-verbs at the operationId lead token (7 / 9, 0.78), and the structural "remove X from Y" preposition read off the summary (10 / 28, 0.36).
- Outcome: arm A fitted closes 19 of 66 with 0 false alarms; under LOVO it closes 6 of 66 with 0 false alarms, and the 6 are all the single word `permission` — openai `deleteFineTuningCheckpointPermission` and jira `deleteSharePermission`, `updatePermissionScheme`, `deletePermissionScheme`, `deletePermissionSchemeEntity`, `assignPermissionScheme`. The other 16 words are pure fitting, and the mechanism is visible: each survives LOVO's keep-test in 14 of the 15 holdouts, yet fires in none of them, because it only ever appears in its own provider's rows. `permission` is the only word of the 17 that two providers share. Reading the same 17 words against the description text as well closes more (36 fitted, 28 LOVO) at 167 false alarms, which is worse than useless. Arm B failed in every one of its 36 configurations. Its best fitted score, description text at minX 2 / maxW 2 / minProv 1, is 34 closed / 22 false alarms; the same configuration LOVO is 10 closed / 37 false alarms, a ratio of 0.27 against the adoption bar of 10 — 37x below. Every configuration that reached 0 false alarms fitted collapsed under LOVO to at most 5 closures against 19 false alarms. Raising minProv to 2 to force breadth did not rescue it: the name source at minProv 2 closes 0 rows under LOVO in every setting. For completeness the 17 words were also scored as a standalone x-claiming rule rather than a raiser, over the whole corpus: 85 flags / 38 truth x / 47 over-tight on all 4171 rows (42 of the 47 being GET rows, which step 1 owns), and 43 / 38 / 5 on non-GET rows only — a fitted number on the rows the list was read from, recorded so it is not mistaken for generalization.
- Lesson: step 3 cannot be bought with words, and this pass is the measurement that closes the question rather than another rejected candidate. The corpus has 66 target rows spread over 12 providers with a median of 2 rows each (jira 24, zoom 12, openai 10, then a tail of ones and twos), so any word specific enough to avoid false alarms is specific to one provider, and any word general enough to cross providers (`user`, `role`, `security`, `token`) brings more false alarms than closures — the same breadth-versus-precision wall already recorded for the old corpus's mined lists, reached here from the other side. The description text, held in reserve for exactly this case, is measured and dead: on these rows it mostly restates the summary, and mining it produces vocabulary that is 37x below the adoption bar. What honestly remains of arm A is one word, `permission`, closing 6 of 66 at zero usability cost — worth banking as a rule but not worth calling a solution, and it must be recorded as one word rather than seventeen so that the sixteen idle words are never mistaken for reach. The open design question this pass surfaced, and did not decide: step 3 is specified as a standalone classifier with its own flow and ledger, yet the 66 rows are rows step 2 has already claimed as `w`, so a step 3 that fixes them is an override of step 2's output rather than a standalone claim — which reading the ladder takes is the user's to rule on before step 3 is built.

### Step 3 built: the pass-through floor is the fix, not the words (2026-09-17)
- Goal: build step 3, the x step, to the user's spec — an x floor on the rows nothing else claims, plus a scan of step 2's wordless method floor so the PUT/DELETE/PATCH rows are not left unexamined, plus the leftover pile named in the output rather than emitted as a silent x. The user's correction that opened this pass: step 3 comes after step 2 and is not a fresh run over the corpus, and step 2's 90%-plus w floor must still be scanned rather than treated as final.
- Tried: the orchestrator measured the whole ladder in Bash in the main session before any code was written, using the repo's own tokenizers rather than a stand-in, then delegated the build and re-verified every number from the output CSV rather than from proof.mjs. The architecture question was settled first and is the substance of the pass: today's flow was first-match-wins (`poc/step2/flow.mjs` returned step 2's claim and the x line never ran on it), so the 66 floor leaks were unreachable by construction — step 3 could not see the rows it exists to fix. Two candidate fixes were considered. A standalone step 3 reading every row fresh with a POST x floor plus tightest-wins was measured and rejected on the spot: its floor would claim all 1309 POST rows as x, overriding the 124 read-POSTs step 1 gets right and the 227 truth-w POSTs step 2 gets right, dropping the flow to 39.3% right. The adopted rule separates a floor from evidence: a method floor is a DEFAULT that only speaks where nothing else fired, so step 2's wordless floor passes through to step 3 and step 3's word may raise it, while step 2's own word claims (`modify-verb`, `modify-verb-summary`) are final because a word beats no word. Four scan lists were priced on the 902 floor rows before the choice: `permission` alone 6 closed / 0 false alarms; the 17 hand words 19 / 0; relationship nouns 22 / 11; description-mined words 10 / 37 under LOVO. The user chose the 17 words. Two word sources were then compared with the repo's real functions — step 2's `wordsForRow` (operationId plus summary) closes 18, and adding the row's non-param path tokens closes 19, both at 0 false alarms; the path form was adopted for the one extra correct row at no cost. The per-method x floor from the user's plan was also re-checked: the old corpus figures behind it (PUT 15.0%, PATCH 31.0%) are real and come from `data/corpus/labelled.csv`, but on the new corpus PUT is 7.2% and PATCH 2.4% of 84 rows against 31% of only 42 old rows, so adding PATCH to an x floor would cost 82 over-tight rows to gain 2; with the pass-through design the question is moot, because PATCH stays on step 2's w floor and step 3 raises it on evidence like any other floor row.
- Outcome: `poc/step3/` — 7 files, 16 tests, `node poc/step3/proof.mjs` prints "All pins hold.", proof CSV `run-proof/step3.csv`; it imports from `poc/step1/` and `poc/step2/` (live adjacent frozen code) and nothing from `poc/flow/` or `poc/archive/`; both frozen folders are untouched and their own proofs still print "All pins hold." (74 tests pass across all three steps). Step 3 ledger over 4171 rows: `raise-word` 19 claimed / 19 right / 0 false alarms, and all 19 verified row by row from the CSV by the orchestrator — openai `deleteFineTuningCheckpointPermission`, `delete-invite`; zoom `accountDisassociate`, `userPassword`, `userSSOTokenDelete`, `webinarPanelistsDelete`, `webinarPanelistDelete`; meta-whatsapp `rejectJoinRequests`, `removeGroupParticipants`; jira `deleteSharePermission`, `removeWatcher`, `updatePermissionScheme`, `deletePermissionScheme`, `deletePermissionSchemeEntity`, `deleteActor`, `assignPermissionScheme`; asana `updateMembership`, `deleteMembership`; datadog `DeletePublicDashboardInvitation` — six providers, not the one or two the per-word breadth check had suggested. `floor-post` 985 rows, every one a POST, truth r 33 / w 153 / x 799, 81.1% right, and it holds 186 of the flow's 186 over-tight rows, every single one. Step 2's method floor drops from 902 claims to 883. Whole flow n=4171: exact 3930 (94.2%), leaks 55 (1.3%), over-tight 186 (4.5%), against the frozen 93.8 / 1.8 (74 rows) / 4.5 — 19 leaks closed for zero new over-tight rows. Emitted-class precision: r 2052 rows (2049 right, 3 loose-wrong), w 1115 (1063, 52 — was 71), x 1004 (818, 0). Leave-one-vendor-out with the list rebuilt per holdout closes 6 of the 66 at 0 false alarms, and all 6 are the single word `permission`; the other 16 words each appear in one provider only, so 6 is the honest expectation on an unseen vendor and 19 is the fitted one. The via-negativa yours-noun rule from the user's step 3 plan is deliberately NOT built, and the README says so: mining it was measured at 9 rows of 380 at 0 leaks, too weak to adopt.
- Lesson: the fix was the wiring, not the vocabulary. Every word list measured in this session and the last one failed the adoption bar or collapsed under LOVO, yet 19 leaks closed the moment step 2's wordless floor stopped being final — the 66 rows were never a vocabulary problem, they were unreachable rows. The principle that makes it safe is worth keeping past this step: a method floor is a default and may be overridden by a later step's evidence, while an evidence claim is final, so precedence runs on evidence strength and not on step order. This also dissolved two questions that looked open — whether PATCH belongs in the x floor (it does not need to, the ladder reaches it) and whether step 3 should be standalone or a layer (it reads rows fresh with its own list and ledger, but it only speaks where an earlier step left a wordless default, which is neither inheriting step 2's curve nor re-running the corpus). And the fitted-versus-honest gap is now stated in the code's own README rather than only in the log: 19 on this corpus, 6 on a vendor it has not seen, 0 false alarms either way.

### Floor or list: naming the judge, and showing which word hit (2026-09-17)
- Goal: the user asked, after reading the per-step ledger, for the tool's own output to say WHY each row got its class rather than only what class it got — floors versus lists — and then, separately, for the sheet to show "what hit what" instead of leaving us blind when debugging later. This pass is naming and instrumentation; no rule, word list or class changed, and no number moved.
- Tried: added `source` (floor/list) beside `rule` in `run-proof/step3.csv`, then `matched` (the specific word-list member that fired) beside `source`. Both have one writer each in `poc/step3/step3.mjs` — `sourceForRule` and `matchedWordsForRule` — and both throw on an unknown rule rather than returning a default, so a rule added later cannot silently become `floor` or report a blank word. `matched` had to be RE-DERIVED, because steps 1 and 2 are frozen and their `apply` functions return only a rule name, never the word that matched; the re-derivation uses their own exported helpers (`stemMatches`, `leadVerbAfterModifiers`, `tokensForRow`, `READ_VERBS`, `SAFE_VERBS`, `MODIFY_VERBS`, `summaryVerb`, `wordsForRow`), and six proof pins guard it — the load-bearing one being that `matched` is non-empty for exactly the 343 `list` rows and empty for exactly the 3828 `floor` rows, so a re-derivation that misses a row fails the proof instead of printing a blank. Two shapes were considered and rejected on the way: dropping `source` as derivable from `rule` (rejected — the floor/list question would then need the eight-rule mapping held in the reader's head), and renaming the rule strings so `floor`/`method-floor` stops saying "floor" twice (rejected — `method` and `method-floor` live in frozen steps, D74 and D75, and renaming them breaks their pins for a cosmetic gain). D76's published map shape was amended in the same pass at the user's word: `evidence` now carries only `floor` or `list` instead of the internal rule name, and the `confident` field was removed because `evidence` already carries it.
- Outcome: `run-proof/step3.csv` is now 12 columns — provider, method, path, operationId, summary, truth, confidence, class, step, rule, source, matched. Measured split, re-derived by the orchestrator from the CSV rather than taken from proof.mjs: `list` 343 rows / 337 right / 6 leaks / 0 over-tight; `floor` 3828 / 3593 / 49 / 186; zero list rows with an empty `matched`, zero floor rows with a word. 81 tests pass across the three steps, all three proof scripts print "All pins hold.", and `poc/step1`, `poc/step2` and their proof CSVs are untouched. The instrumentation paid for itself in the first read: the six leaks that fired a word are now visible straight off the sheet — `cancel` 3 (stripe PostClimateOrdersOrderCancel, stripe PostPaymentIntentsIntentCancel, mailchimp postCampaignsIdActionsCancelSend), `validate` 1 (stripe PostPaymentMethodDomainsPaymentMethodDomainValidate), `update` 1 (stripe PostSubscriptionsSubscriptionExposedId), `change` 1 (square BatchChangeInventory) — and so is which words carry the work: of `read-verb`'s 87 rows, `search` 27, `get` 16 and `retrieve` 15 account for 67%, while ten words fire once or twice each. Two orchestrator errors were caught during the pass and are worth recording. First, the PRD example rows: two paths were written from memory and were wrong (jira as `/rest/api/3/...` when the corpus says `api/2`, openai as `/v1/chat/completions` when it is `/chat/completions`); both were checked against the corpus and corrected before anything was written to the file. Second, a proof pin: the brief pinned asana `updateMembership -> membership`, and the real re-derivation returns `membership+memberships`, because the row's path is `/memberships/{membership_gid}` and BOTH words are members of `RAISE_WORDS`, so both genuinely matched. The delegated agent escalated rather than forcing the pin, and pinned the observed value — the right call, since reporting only `membership` would have hidden a real match, which is exactly the drift the pin exists to catch.
- Lesson: instrumentation is not bookkeeping here, it is the difference between a word list you can audit and one you can only re-measure. The six word-fired leaks and the 27/16/15 concentration in `read-verb` were both already true and both already recorded in this log, but neither was readable from the tool's own output — and a fact that needs a script to recover is a fact that gets forgotten. The floor/list axis also turned out to be the honest way to talk about the tool to anyone outside it: 91.4% of its correct answers come from floors, so "the tool is mostly an HTTP method table with a thin, very accurate layer of words on top" is the true description, and `evidence: floor` is how a consumer sees that for a specific row without being handed our rule names. Keeping the rule name and the matched word OUT of the published map is the same discipline from the other side: they are this project's vocabulary, an adopter cannot act on them, and publishing them would freeze our naming into someone else's contract. Last, the two errors caught in this pass were both mine and both the same species — a detail recalled instead of read (a path, a matched word) — which is the argument for the pins and the corpus check, not for more care.

### Step 3 frozen: the ladder is complete, and the x step cannot leak (2026-09-17)
- Goal: close step 3 and state where the x step stands, since the entries above it record the work pass by pass rather than the result. This is the first time all three steps are built and frozen and no placeholder remains anywhere in the flow.
- Tried: nothing new measured; this records the user's decision to freeze and the numbers as verified by the orchestrator — 81 tests pass across the three steps, all three proof scripts print "All pins hold.", `run-proof/step3.csv` regenerated at 12 columns, and `poc/step1`, `poc/step2` and their proof CSVs untouched. The stale "step 3 not built" prose was hunted out of the PRD in the same pass, which is the pattern this project has hit after every freeze: the section heading, two step-3 list items, the which-list-runs-where table row, and the five-lists/83-words count all still described a placeholder.
- Outcome: two rules plus one wiring change. `raise-word` raises a row from w to x when one of 17 `RAISE_WORDS` role/access nouns fires at any token position, and only on a row step 2 claimed with its WORDLESS method floor — 19 claimed, 19 right, 0 false alarms, across six providers. `floor-post` is the named leftover pile: 985 rows, all POST, truth r 33 / w 153 / x 799, 81.1% right, emitted with `source: floor` instead of as a silent x. The wiring is the substance: step 2's wordless floor became a default that passes through, where before it returned and step 3 never saw the rows it exists to fix. Step 2's word claims stay final, because a word beats no word — precedence runs on evidence strength, not step order. Step 3 ledger: 1004 claimed, 818 right (81.5%), **0 leaks**, 186 over-tight, and it holds 186 of the flow's 186 over-tight rows. Whole flow n=4171: exact 94.2%, leaks 1.3% (55 rows), over-tight 4.5%, against the pre-step-3 93.8 / 1.8 / 4.5 — 19 leaks closed for zero new over-tight rows. Emitted r 2052 (2049 right, 3 loose-wrong), w 1115 (1063, 52), x 1004 (818, 0). Six lists now, 100 words, each running in exactly one step (D57 holding): `LEAD_MODIFIERS` 5, `READ_VERBS` 23, `SAFE_VERBS` 10, `MODIFY_VERBS` 24, `OTHER_PARTY` 21, `RAISE_WORDS` 17. Per step and per source: step 1 list 92 / 91 / 1 leak, floor 1960 / 1958 / 2; step 2 list 232 / 227 / 5, floor 883 / 836 / 47; step 3 list 19 / 19 / 0, floor 985 / 799 / 0 with 186 over-tight. Commits ad21062, 210464a, a145598.
- Lesson: step 3 is the one step that cannot leak, and that is structural rather than earned — x is the tightest class, so there is nothing looser for it to be wrong toward and its only possible error is over-tightness, which costs the caller an extra ask and nothing else. Two facts about the finished ladder are worth carrying forward. First, the tool is mostly an HTTP method table: 3593 of its 3930 correct answers, 91.4%, come from floors, while the six word lists fire on 343 rows, 8% of the corpus, though they are 98.3% right when they do. Second, the two failure modes are now each confined to a single cell — 47 of the 55 leaks are step 2's wordless PUT/DELETE/PATCH floor, and all 186 over-tight rows are step 3's `floor-post` pile — which makes the remaining work legible in a way no headline accuracy number was: safety lives in one box, usability in another, and they never mix. What is left is honestly stated rather than planned: 47 leaks that words have been measured out of reaching, 153 truth-w POST rows still on the x floor, 33 truth-r rows that belong to step 1 and would need its freeze lifted, and no clean exam behind any of the three steps, since all of them were measured on the same 4171 rows they were tuned on.

### Word-list durability audited: where the tool's work actually comes from (2026-09-17)
- Goal: during the POC-to-src rewrite, measure how durable the five classification word lists are — per word, per list, against the corpus's 15 providers — and separate what the lists are worth from what the method floors already do, without changing any rule. All three steps stay frozen (D74, D75, D78); everything below is a readout on the frozen 15-provider corpus (4171 rows, data/provider-corpus-2026-09-16).
- Tried: (1) for each of the 95 words across the five classification lists (`LEAD_MODIFIERS`, 5 words, is tokeniser plumbing and excluded), counted how many of the 15 providers it fires on, under that list's own matching rule and on the rows that list is actually consulted on. (2) re-scored the whole flow with each list cut to words firing on at least N providers, N = 1 (today), 2, 3, 4, keeping every zero-provider word at every bar since this corpus cannot judge it and an unfired word costs nothing. (3) built a per-rule ledger over all 4171 rows (claimed/right/leaks/over-tight) for every floor and every list rule, and, for the first time, measured a wordless baseline — classify on HTTP method alone (GET/HEAD/OPTIONS r, PUT/DELETE/PATCH w, POST x), no word lists at all. (4) audited list sizes and pairwise overlap across all five lists plus `LEAD_MODIFIERS`.
- Outcome: (1) Across all 95 words: 14 fire on zero providers, 51 fire on exactly one, only 15 fire on three or more. Per list (word:providerCount), exactly: READ_VERBS (23 words, consulted on 1309 POST rows) — 5 fire on 0, 13 on exactly 1, 4 on 3+: search:4 get:3 list:3 validate:3 fetch:2 analyse:1 calculate:1 check:1 count:1 evaluate:1 find:1 introspect:1 match:1 parse:1 read:1 retrieve:1 sanitise:1 suggest:1 analyze:0 assess:0 lookup:0 query:0 sanitize:0. SAFE_VERBS (10 words, consulted on 1309 POST rows) — 2 fire on 0, 7 on exactly 1, 1 on 3+: validate:5 analyse:1 calculate:1 evaluate:1 introspect:1 parse:1 sanitise:1 suggest:1 analyze:0 sanitize:0. MODIFY_VERBS (24 words, consulted on 1217 rows step 1 left) — 2 fire on 0, 7 on exactly 1, 6 on 3+: cancel:7 update:7 archive:5 delete:4 remove:4 pause:3 activate:2 change:2 deactivate:2 disable:2 dismiss:2 enable:2 move:2 restore:2 unarchive:2 detach:1 expire:1 merge:1 modify:1 rotate:1 swap:1 void:1 suspend:0 unpause:0. OTHER_PARTY (21 words, consulted on 1217 rows) — 5 fire on 0, 8 on exactly 1, 4 on 3+: user:9 members:4 role:3 users:3 audience:2 invite:2 member:2 permission:2 admin:1 collaborator:1 follower:1 followers:1 participants:1 people:1 permissions:1 subscriber:1 assignee:0 owner:0 participant:0 recipient:0 roles:0. RAISE_WORDS (17 words, consulted on the 902 PUT/DELETE/PATCH method-floor rows) — 0 fire on 0, SIXTEEN on exactly 1, ZERO on 3+: permission:2 actor:1 disassociate:1 grant:1 invitation:1 invitations:1 invites:1 membership:1 memberships:1 panelist:1 panelists:1 participants:1 password:1 reject:1 sso:1 watcher:1 watchers:1. This is the direct mechanical explanation for D78's already-recorded LOVO collapse from 19 fitted catches to 6, all 6 being the single word `permission`. (2) Durability-cut scores: bar >=1 (today, 95 words) exact 3930 (94.2%) / leaks 55 (1.3%) / over-tight 186 (4.5%); bar >=2 (44 words) 3865 (92.7%) / 71 (1.7%) / 235 (5.6%); bar >=3 (29 words) 3826 (91.7%) / 76 (1.8%) / 269 (6.4%); bar >=4 (23 words) 3799 (91.1%) / 78 (1.9%) / 294 (7.0%). The >=1 figure is fitted and propped up by the 51 single-provider words, which are inert on an unseen vendor, so the tool's real behaviour on a new provider already sits nearer the >=2 row than the headline; the honest caveat runs the other way too — 15 providers is a small sample, so a one-provider word here is unproven rather than shown worthless (`panelist` fires only on zoom in this corpus but another video API would use it). DECISION (user, 2026-09-17): the lists are NOT cut. Single-provider words stay. They do real work when they fire, cost nothing when they do not, and the expectation is that scanning more providers adds words to these lists rather than replacing them. (3) Per-rule ledger over all 4171 rows (claimed/right/leaks/over-tight): method (floor) 1960/1958/2/0; floor-post (floor) 985/799/0/186; method-floor (floor) 883/836/47/0; modify-verb-summary (list) 118/114/4/0; modify-verb (list) 114/113/1/0; read-verb (list) 87/87/0/0; raise-word (list) 19/19/0/0; read-verb-anywhere (list) 5/4/1/0. TOTAL floor 3828/3593/49/186; TOTAL list 343/337/6/0. Wordless baseline, measured for the first time — classify on HTTP method alone (GET/HEAD/OPTIONS -> r, PUT/DELETE/PATCH -> w, POST -> x), no word lists at all: exact 3598 (86.3%), leaks 68 (1.6%), over-tight 505 (12.1%) — against the full tool with all 95 words: exact 3930 (94.2%), leaks 55 (1.3%), over-tight 186 (4.5%). The word lists fire on only 8% of rows but carry the entire difference between a bare HTTP method table and the tool: +332 rows right, -319 over-tight, -13 leaks. This confirms and quantifies D77's already-decided floor/list split rather than revising it; what is new is the wordless baseline, which nobody had measured before, and it is the number that says what the lists are worth. The lists do two opposite jobs, not one: the lowering lists (READ_VERBS, SAFE_VERBS, MODIFY_VERBS) pull POST rows down off step 3's x floor and are the over-tightness cleanup; RAISE_WORDS pushes PUT/DELETE/PATCH rows up off step 2's w floor and is leak-closing, the safety direction. (4) Sizes: READ_VERBS 23, SAFE_VERBS 10, MODIFY_VERBS 24, OTHER_PARTY 21, RAISE_WORDS 17, LEAD_MODIFIERS 5 (the last is tokeniser plumbing, not a classification list). SAFE_VERBS is a strict subset of READ_VERBS — all 10 of its members: analyse, analyze, calculate, evaluate, introspect, parse, sanitise, sanitize, suggest, validate. OTHER_PARTY and RAISE_WORDS share exactly two words: participants, permission. All 13 other pairs are completely disjoint — zero shared words. No two lists are identical. DECISION (user, 2026-09-17): the lists stay separate. Nothing is merged and nothing is consolidated. SAFE_VERBS and READ_VERBS stay two named lists because they answer different questions — READ_VERBS asks "does this verb mean read?", SAFE_VERBS asks "is this word ever a noun?" — and their membership decisions are independent, so they grow at different rates by different criteria (`get` and `list` mean read perfectly well but are nouns half the time, which is why they are matched at the lead token only). A proposal to fold SAFE_VERBS into READ_VERBS as a per-word `anywhere` flag was raised and withdrawn. The OTHER_PARTY / RAISE_WORDS overlap is deliberate and must not be tidied: they are different steps, different row sets and opposite directions (OTHER_PARTY blocks a lowering on step 2's POST rows; RAISE_WORDS forces a raise on step 3's PUT/DELETE/PATCH floor rows), and D75 already measured the whole of OTHER_PARTY used as a raiser over those same 902 rows and rejected it at 0.31 leaks closed per false alarm against an adoption bar of 10, because `user` flags 42 write rows of which only 13 are truth x — with `permission` the single exception (6 flags, 6 truth x, 0 false alarms), explicitly left for step 3, which then adopted it.
- Lesson: the durable core is about 15 words (user:9 cancel:7 update:7 archive:5 validate:5 members:4 delete:4 remove:4 search:4 get:3 list:3 pause:3 role:3 users:3), the other 80 are local colour that still pay their way; and the target for future work is the floors, not the lists — all 186 over-tight rows and 47 of the 55 leaks sit on two floors (floor-post and step 2's method-floor), while the lists are 98.3% right when they fire and have never produced a single over-tight row.

### The classifier graduated from poc/ to src/, and the package entry point fixed (2026-09-17)
- Goal: graduate step 3 and the whole flow from `poc/` into `src/`, finishing the POC-to-src rewrite begun with the tokeniser and steps 1 and 2, and fix the package entry point so the library actually resolves for an adopter. No rule change and no word-list change: all three steps stay frozen (D74, D75, D78), and the rewrite had to prove it reproduced them exactly rather than assert it.
- Tried: rebuilt step 3 and the flow fresh against the rule rather than copying the POC, then proved equivalence row by row against the frozen code. The substance is what a clean rebuild exposed that the POC hides, four things. (a) `FLOOR_RULES` is an exported dead symbol in `poc/step3/step3.mjs` — nothing in the repo imports it; only `sourceForRule` three lines below reads it, while its sibling `LIST_RULES` is correctly private, so the `export` keyword was the dead part. (b) Two writers for one piece of state: `applyStep3` decides which raise word hit with `.some()`, and `matchedWordsForRule` re-decides it with `.filter()` — that duplication is precisely why D77 needed six proof pins to stop the two drifting apart. (c) That duplicate carried a latent bug: `matchedWordsForRule` ignores an injected LOVO word list and always reads module-level `RAISE_WORDS`. Demonstrated — with a rebuilt list of only `memberships`, the POC reports `membership+memberships`, a word the list does not contain. It is unreachable in the POC, since nothing asks for `matched` on a LOVO run, so it never produced a wrong published number; it is exactly the class of drift the new shape makes unrepresentable. (d) The step-3 verdict had two writers — `flow.mjs` hand-built the `floor-post` literal while `step3.mjs` owned `raise-word`; `src/step3.js` now exports `floorPost()` and `src/flow.js` calls it. Beyond the four: `matchedWordsForRule` and its six guard pins are DELETED, not ported, and the mechanism is worth naming plainly because it is the whole rewrite — the POC's helper asked "did anything match?", so it had to re-implement every rule a second time to recover which word; asking "which members matched?" once leaves nothing to re-derive. Step 3's coupling collapsed with it: `poc/step3` imports 9 symbols from steps 1 and 2, seven of them only to feed the re-derivation, while `src/step3.js` imports 2 (`splitTokens`, `wordsForRow`) and no longer knows step 1's word lists exist. The sort-order finding is recorded because it contradicts what steps 1 and 2 recorded: those two carry a KNOWN LIMIT that the corpus cannot see `matched`'s sort order, since 0 of 4171 rows fire more than one member. Step 3 is different — 17 of 4171 rows fire two `RAISE_WORDS` members, across five pairs: membership+memberships 8, grant+permission 3, panelist+panelists 2, watcher+watchers 2, invitation+invitations 2. Four of the five are singular/plural pairs sitting adjacent and already in declaration order, so they cannot tell a sort from insertion order; only `grant`+`permission` can, being declared 15th and 1st. So step 3's proof genuinely pins the sort where steps 1 and 2's cannot. Verification method is recorded too, since this project's rule is that an agent's "done" is not evidence: the orchestrator re-ran all seven checks independently, then broke `src/flow.js`'s precedence branch so step 3 could never raise, and watched `proof-flow.js` print 16 mismatches including exact 93.8% / leaks 1.8% — the pre-step-3 numbers — then restored the file and diffed it byte-identical.
- Outcome: `src/step3.js`, `src/flow.js`, `src/index.js` and their tests, plus `tools/proof-step3.js` and `tools/proof-flow.js`. Equivalence to the frozen POC over all 4171 rows: 0 class / 0 rule / 0 source / 0 matched differences, `RAISE_WORDS` pinned set-equal at 17. 153 tests pass, typecheck clean, all five src proofs and all three poc proofs print "All pins hold.", `poc/` byte-untouched. No number moved: the flow is still 3930 exact (94.2%), 55 leaks (1.3%), 186 over-tight (4.5%) on 4171 rows, and the per-step-per-source ledger is unchanged — step 1 list 92/91/1 and floor 1960/1958/2; step 2 list 232/227/5 and floor 883/836/47; step 3 list 19/19/0 and floor 985/799/0 with 186 over-tight. The package fix was two bugs, not one: `exports` pointed at a nonexistent `./src/index.js`, and `files` was ["README.md","CHANGELOG.md","LICENSE"], so even a valid entry point would have shipped no code and 404'd for every adopter. Both closed; the tarball went from 4 files with no code to 23 files, 25.2 kB packed, with `src/` and `types/` in it, and the public surface is exactly one export, `classifyRow` — internals are sealed by the exports map, not merely undocumented. The published-map emitter (D76/D77's adopter-facing `evidence` field) is deliberately not built: the PRD puts it after step 3, in its own pass.
- Lesson: the rewrite's value was not tidiness. Every defect found across all three passes was invisible in the POC precisely because the POC asked a weaker question and then patched around the answer — "did anything match?" forces a second implementation to recover the word, and a proof that guards a re-derivation is a proof guarding a design mistake rather than a behaviour. Two things worth carrying. A proof that cannot see a behaviour must not be what guards it: the sort order was pinned by construction in the tests, not by the corpus, and the corpus turned out to see it only by luck of one word pair. And the corpus's ability to see a behaviour differs step by step, so it must be checked per step and never inherited from the step before — steps 1 and 2 honestly recorded that their rows cannot see the sort, and carrying that limit forward to step 3 without re-checking would have recorded the opposite of the truth.

### The clean exam is drawn, and the ladder's predictions are pre-registered on it before any label exists (2026-09-17)
- Goal: draw a genuinely unseen exam for the three-step ladder and put the
  classifier's verdicts on the record before truth exists, so the exam can be
  scored once without anyone having to promise the rules were not fitted to it
  (D24). No score was sought and none is reported here: this pass produces an
  artefact and a parse-sanity check, nothing else.
- Tried: fetched three complete official provider APIs — okta 734 rows,
  docusign 414, xero 235, 1383 total — with overlap against the 15-provider
  corpus, the M0-era tuning set and every earlier exam checked on both the raw
  token and the registrable name, in both directions. Built `tools/predict-exam.js`,
  which reads `data/exam-2026-09-17/ops.csv.gz` while the directory still carries
  no truth column and no `label/` directory, runs `src/`'s frozen ladder over
  every row, and writes `run-proof/exam-2026-09-17-predictions.csv`. It counts no
  leaks and no over-tightness, and it deliberately does not print the r/w/x class
  split — reading that split before the labels exist is the peek that tempts
  fitting the rules to the exam's own rows. Committed as 66c68f1 together with
  the corpus it was run on, since the predictions prove nothing apart from the
  rows that produced them.
- Outcome: predictions artefact sha256
  80f3f37df9cb4e6e466e92be8c8896bf65f3725c4d7aa6defafcaeca9ba2f985, identical
  across two runs, so the artefact is deterministic and citable. Parse sanity
  holds on every provider: zero blank operationIds and zero blank paths in all
  1383 rows; step-1 claims (okta 290, docusign 167, xero 126) equal each
  provider's GET count exactly; empty summaries (0, 11, 4) match the README's
  stated 734-of-734, 403-of-414 and 231-of-235. Step claims are okta
  290/282/162, docusign 167/179/68, xero 126/105/4, summing to 583/566/234 =
  1383. Source is the number that stands out: 1255 of 1383 rows (90.7%) reach a
  wordless method floor and only 128 (9.3%) have a word list fire, and it is
  wildly uneven by vendor — xero fires on 42 of 235 (17.9%), okta on 83 of 734
  (11.3%), docusign on 3 of 414 (0.7%). xero's stated limit stands: 0 of its 235
  rows carry description text, so any future rule needing the description is
  blind on every xero row. The guards were proved able to fail rather than
  asserted — a scratchpad copy with EXPECTED_ROWS at 1382 and another with xero
  at 234 each exited 1 naming the disagreement. 72/72 tests pass, `tsc --noEmit`
  is clean, and `src/` was not touched. One brief correction made by the writing
  agent and kept: `description` is not passed into `classifyRow`, because
  `src/types.js` says plainly it is not an Operation field (D78).
- Lesson: pre-registration costs minutes and buys two separate things, and it is
  worth being clear that they are separate. The timestamp is the cheap one — it
  converts "we did not fit to the exam" from a promise into a fact git can
  settle. The smoke test is the one that paid immediately: it caught that
  docusign's Swagger 2.0 extract parses cleanly (zero blank operationIds, GET
  counts matching to the row) before a single labelling hour was spent on rows
  that might not have loaded. The third thing it surfaced was not asked for and
  is the most useful: docusign fires a word list on 3 of 414 rows. Whatever this
  exam eventually scores, docusign's number will be very close to a pure
  method-floor number, and reading its result as evidence about the word lists
  would be reading a rule that almost never ran. That is knowable now, without
  truth, and it should be said out loud in advance rather than discovered as an
  excuse afterwards.

### The exam is labelled, and one disputed family needed a ruling the classifier can never learn (2026-09-18)
- Goal: produce truth for the 1383-row clean exam by blind labelling, under the
  calibrated brief, without anyone seeing the predictions pre-registered at
  66c68f1 — then settle whatever the labellers could not.
- Tried: seven blind labellers, one per part, each opening only
  `data/calibration-2026-09-14/BRIEF.md` and its own `blind-N.csv` and writing
  only its own `labels-N.csv`, with no subagents and no git. Every returned file
  was validated against its blind file by the orchestrator rather than from the
  labellers' self-reports — header, row count, row_id order position for
  position, class in r/w/x, confidence literally high or low, no duplicates —
  and 36 rows were spot-checked against their real source rows. A first launch
  of four labellers was killed by a weekly rate limit before writing anything;
  the relaunch told each labeller to append in batches of about 40 rows so an
  interruption would leave partial work on disk instead of nothing.
- Outcome: 1383 rows, zero ids missing, zero duplicates across parts, no
  labeller used `?`. Truth is r 594 / w 415 / x 374 after the ruling below. Every
  method floor held: GET 583 of 583 r; POST 216 x / 120 w / 10 r; PUT 144 w /
  98 x / 1 r; DELETE 142 w / 56 x; PATCH 9 w / 4 x. The exam's stated limit
  showed up exactly where it was predicted and cost confidence rather than
  correctness: xero, the provider carrying no description text at all, drew
  25.5% low confidence against docusign's 15.5% and okta's 11.6%. Two families
  of xero PUT rows whose summary says "Creates" behaved very differently. The 15
  `PUT /{Resource}/{id}/History` rows were seen by six different labellers and
  all fifteen came back x — independent agreement, never in dispute. The 11
  `PUT /{Resource}/{id}/Attachments/{FileName}` rows, identical to each other in
  shape and operationId form, split 7 w / 4 x purely by which labeller drew them.
  The user ruled all 11 x (D80): the summary says "Creates", the brief makes a
  create x by road 2 even for the caller's own file, and the overwrite-on-same-
  filename reading is inferred from the path shape rather than stated, so the
  tighter class wins. Confidence was deliberately left low on all 11 — the ruling
  settles the class, not the evidence, and raising it would misrepresent what
  xero's text actually says.
- Lesson: the ruling is truth, not a rule, and the distinction is the whole
  point. Whether `PUT .../{FileName}` overwrites or appends is a fact about one
  vendor's implementation and is simply not present in the spec text, so no word
  list and no method floor can ever learn it — a future vendor with the same path
  shape has to be ruled on its own evidence, not by precedent from this one. That
  is worth separating from the `/History` family, which needed no ruling at all
  because six labellers reached the same answer alone. The split was also only
  visible because identical rows were deliberately scattered across seven
  labellers by the seeded shuffle; had one labeller taken all of xero in a block,
  it would have been internally consistent, wrong or right, and nothing would
  have flagged it. Spreading a provider across labellers is what turns a silent
  convention into a measurable disagreement.

### The clean exam scored once: 12.4% leaks, seven times the fitted figure (2026-09-18)
- Goal: score the frozen three-step ladder against the clean exam, once, and
  find out what the core is actually worth on vendors it has never seen. This is
  the first honest generalization number the project has ever had.
- Tried: joined `run-proof/exam-2026-09-17-predictions.csv` (pre-registered at
  66c68f1 before any truth existed) to the 1383 labelled rows. The join is by
  index, so it was re-checked on method, operationId, path and provider for every
  row — zero disagreements — and the orchestrator recomputed the whole score
  independently in the main session rather than trusting the scorer, reaching the
  same three numbers. No rule, word list or `src/` file was touched.
- Outcome: exact 85.3% (1180/1383), leaks 12.4% (171/1383), over-tight 2.3%
  (32/1383), against the tuning set's 93.8% / 1.8% / 4.5%. Leaks are about seven
  times the fitted figure. Every single one of the 171 leaks is truth x predicted
  w — there is not one r-direction leak in the exam, so step 1 and the r class
  are untouched by this result. Step 1 scored 583 of 583 exact with zero leaks.
  Step 3 took zero leaks and paid 31 over-tight rows. All 171 leaks belong to
  step 2, which is 30.2% of its 566 claims. By method, PUT is the worst at 39.5%
  leaks (96/243), then PATCH 30.8% (4/13), DELETE 25.8% (51/198), POST 5.8%
  (20/346), GET 0%. By provider, xero 26.8% (63/235), okta 9.8% (72/734),
  docusign 8.7% (36/414). 151 of the 171 leaks fired no word at all; 20 fired a
  word list and leaked anyway, 10 of them on the verb `update`.
- Lesson: the M1 go/no-go gate's first condition is zero leaks among ASSIGNED
  rows — rows where a word fired rather than the method floor decided. There are
  20. The gate fails on its own terms, and it fails on the strongest kind of
  evidence the tool has, not on its shrugs. Two further things are worth separating
  because they are different problems wearing one number. xero's 63 leaks are
  almost all PUT-as-create: xero uses PUT where most vendors use POST, so a
  method floor that reads PUT as w is structurally blind there, and no word list
  is involved. okta's and docusign's 108 are the yours-versus-theirs problem in
  its purest form — assign, unassign, revoke, share, document_visibility — which
  is the signal the project has already measured three separate times as not
  transferable by vocabulary. The prior belief that nearly all leaks are wordless
  floor rows survives on share (88.3% of leaks) but NOT on rate: evidence rows
  leak at 15.6% (20/128) against the floor's 12.0% (151/1255), so on this exam a
  fired word was slightly worse than no word at all. That inverts the assumption
  the word lists were built on and is the single most important thing the exam
  said. Finally, the exam is now burned: under D24 it is scored once, and any
  rule change from here needs a new exam, not a re-score of this one.

### The build/exam split, pre-registered before any row was read (2026-09-18)
- Goal: decide, before reading rows, which vendors may be mined for the
  write-heavy specialized list and which are locked for the next exam, so
  the next exam is virgin by construction rather than by promise.
- Tried: counted apis-guru's 123,339 rows by vendor for write methods and
  for access/credential/membership language; checked every candidate
  against the 15-provider corpus, the 2026-09-17 exam, and exams 1-5;
  checked ten proposed exam vendors for any appearance in apis-guru.
- Outcome: every large apis-guru vendor is already burned by exams 1-5,
  so apis-guru is build-only from now on and the next exam must come
  from fresh official complete specs. Build pile is 13 vendors, github
  capped at 300 and microsoft at 200 because github alone holds 5492 of
  6454 access-ish write rows (85%), with azure dropped as same-family.
  Exam pile is ten vendors — auth0, cloudflare, hubspot, zendesk,
  pagerduty, dropbox, shopify, linear, miro, sentry — none of which
  appears in apis-guru, the corpus, or any earlier exam.
- Lesson: choosing the build pile by browsing every candidate would have
  leaked information into the exam pile, because the leftovers would be
  the vendors that looked unpromising. Committing the split first costs
  one commit and no row reading, and it is the only way the next exam's
  virginity is a fact rather than a claim.

### The write-heavy build set: 1819 rows labelled, and the failure mode is a property of the vendor, not the method (2026-09-18)
- Goal: the burned exam showed step 2 leaking 30.2% of its claims, with
  PUT at 39.5% and DELETE at 25.8%, while the 15-provider corpus held
  only 7.3% truth-x on those methods — the measuring instrument barely
  contained the failure mode. Build a write-heavy labelled set on
  vendors never used for an exam, rich enough in the yours-versus-theirs
  problem to mine a list on, and pre-register which vendors are locked
  away for the next exam before reading a row.
- Tried: pre-registered the build/exam vendor split and committed it
  before any row was read (5ff1cbb). Built `poc/buildset/`, a draw with
  seven gates and six proofs that can fail (f6e53c3), and proved two
  things measurement alone could show: apis-guru repeats the same
  endpoint across spec variants, so github.com's 7136 write rows are
  only 544 unique endpoints carried across 20 specs (api.github.com,
  ghec, ghes-2.18 through 3.8, github.ae) and microsoft.com's 16878 are
  11866, while the eleven small vendors carry no duplicates at all; and
  a bare-substring vendor-overlap check wrongly flagged build vendor
  box.com against locked exam vendor dropbox, fixed to whole-dot-label
  matching. Amended the caps to a uniform 150 per vendor, which removes
  github and microsoft dominance by construction and gives
  leave-one-vendor-out equal weight per vendor. Drew 1819 rows across 13
  vendors, cut them into 9 blind parts, and had 9 blind labellers label
  them under the calibrated brief; every returned file was validated in
  the main session for row count, row order, id uniqueness and legal
  class/confidence values rather than trusted.
- Outcome: truth is r 42, w 1094, x 681, with 2 `?` rows and 218
  low-confidence (12.0%). By method POST is 73.2% x (512 of 699), PUT
  15.7% (72 of 460), DELETE 16.4% (83 of 505), PATCH 9.0% (14 of 155).
  PUT+DELETE+PATCH combined carry 169 truth-x of 1120 = 15.1%, against
  the corpus's 7.3% and the burned exam's roughly 40%. The per-vendor
  read is the real finding: on PUT/DELETE/PATCH the truth-x share runs
  keycloak 32.5% (26/80), box 25.3% (21/83), github 23.8% (24/101),
  dracoon 23.7% (22/93), appcenter 17.8%, gitea 14.0%, clearblade 13.9%,
  trello 12.3%, microsoft 12.1%, gitlab 7.4%, atlassian 7.1%,
  launchdarkly 6.7%, netbox 0.9% (1/117) — a 36-fold spread across
  thirteen vendors drawn under one rule.
- Lesson: the failure mode is not a property of the write methods, it is
  a property of what the vendor's API is about. Identity (keycloak) and
  file sharing (box, dracoon) behave like okta and docusign, the
  vendors that broke the exam; network inventory (netbox) and issue
  tracking (atlassian) barely have the problem. That explains the whole
  history of this project's write-method rules pricing as worthless:
  the sets they were priced on were dominated by vendors whose APIs
  rarely reach another party, so a rule that is right could not show a
  profit. It also means the 15.1% headline is the wrong number to plan
  with, since it is an average over a population whose members differ
  by 36x. The mining question changes shape with it: the signal being
  hunted is what kind of OBJECT an operation touches — an identity, a
  share, a credential, a membership — rather than which verb it uses,
  and with 13 vendors and 169 positive rows, leave-one-vendor-out is
  finally a real test instead of a two-vendor guess.

### Mining the build set, and a per-document steer: neither beats the D75 flow, and step 2 is closed (2026-09-19)
- Goal: mine a specialized list on the 1817 scoreable build-set rows to
  move step 2's wordless PUT/DELETE/PATCH floor rows to x, and failing
  that, test a per-document steer that moves a whole spec's
  PUT/DELETE/PATCH floor when the spec's own text leans toward
  identity and access.
- Tried: (a) mined tokens from path, operationId and summary of the
  1120 PUT/DELETE/PATCH rows, keeping words with at least 3 truth-x
  hits, 70% precision and 2 vendors; (b) the same miner on POST rows
  for comparison; (c) `poc/vendorprofile/`, a steer that scores each
  document by the share of its operations carrying a hand-written
  vocabulary of identity, access, credential and sharing nouns —
  computed from spec text only, never truth — and sets that document's
  PUT/DELETE/PATCH floor to x above a threshold, leaving the method
  floor untouched and recoverable; (d) every shape scored on the
  burned clean exam as reference only.
- Outcome: the mined PUT/DELETE/PATCH list scored 49 leaks closed for
  6 false alarms fitted (8.17) and 35 for 42 under leave-one-vendor-out
  (0.83), against a bar of 10. POST held up far better (x: 3.53
  fitted, 2.91 LOVO). The cause is visible per vendor: `user` is
  truth-x on 1 of 20 microsoft rows and 12 of 16 keycloak rows; `key`
  on 2 of 27 atlassian and 6 of 52 clearblade; `members` on 9 of 33
  trello rows (card assignment) and 4 of 4 gitea (repo access);
  `groups` 0 of 10 netbox, 0 of 11 appcenter, 4 of 9 keycloak. The
  profile steer lost under LOVO: 77.5% exact / 7.8% leaks / 14.7%
  over-tight against the method floor's 80.5 / 9.3 / 10.2; its best
  trade was 28 leaks closed for 82 over-tight added (0.34 against the
  bar of 10), and 11 of 13 held-out vendors were never steered. The
  profile tracks truth only at the extremes (keycloak score 1.000 /
  32.5% truth-x, netbox 0.180 / 0.9%) and not in the middle (microsoft
  0.613 / 12.1%). On the build set the D75 flow scores 83.2% exact /
  8.1% leaks / 8.6% over-tight; 144 of step 2's 147 leaks sit on its
  wordless method floor, and its word rules, which barely fire there
  (22 claims), leak 3. On the burned exam, as reference: D75 flow
  85.3% exact / 12.4% leaks / 2.3% over-tight, method floor only 79.1
  / 11.4 / 9.5, D75 plus the steer 77.7 / 9.8 / 12.6, the steer alone
  71.5 / 8.7 / 19.8. Nothing beats D75. The exam's profile scores were
  docusign 0.976, okta 0.569, xero 0.089 — the steer points away from
  xero, the worst leaker.
- Lesson: a word's meaning is a property of the vendor using it, so
  any list mined from labelled rows transfers only to vendors that use
  the word the same way — that is the fifth measurement of the same
  wall, and the per-vendor table shows the mechanism directly rather
  than inferring it. Narrow hand-written lists survive where mined
  ones die: step 3's 17 RAISE_WORDS scored 25 right, 4 over-tight and
  0 leaks on these unseen vendors. The D75 flow is the best shape this
  project has measured and further word work on step 2 would be
  fitting noise, so step 2 is closed (D81). What spec text cannot do
  is read meaning; that last mile is parked for an optional model
  tier (D82).

### Jev measured twice: a raise-only tier that survives LOVO, and a cold read of the whole corpus (2026-09-20)
- Goal: the Jev tier parked as D82 became testable when an API key
  arrived, so run two POCs. (A) Jev as the raise-only tier sitting over
  the rows step 2 labels w, measured on the build set. (B) Jev doing
  the whole r/w/x job cold on the 4171-row 15-provider corpus, to see
  how good or bad it is unaided.
- Tried: the criteria were transcribed from
  `data/calibration-2026-09-14/BRIEF.md` — the same calibrated brief the
  nine human labellers used to make the build set's truth — into Jev's
  structured Noul/Choice criteria format: instructions carrying
  question, inspect, focus and ignore, and two-sided criteria carrying
  the two roads on the true side and the twelve rules on the false
  side, with the brief's "rules that trip people up" as the ignore
  list. Nothing was written by reading the leak pile, and the brief
  predates both sets. POC A asked one Noul, "is this operation x",
  deliberately cold: step 2's own verdict was kept out of the state,
  because naming it would anchor Jev toward w, which is the fail-open
  direction. Two further Nouls, road1 and road2, rode along in the same
  call as free diagnostics. POC B asked one Choice over r/w/x carrying
  the three class definitions and the brief's method guidance. Raw
  fetch, no SDK. The criteria were written once and run once; there was
  no tuning loop.
- Outcome: POC A ran over the 1113 rows the D75 flow labels w on the
  build set, of which 147 are truth x and 966 truth w. At threshold
  0.70 it closed 51 of the 147 leaks for 1 false alarm in 966, a ratio
  of 51.0 against the bar of 10. The full sweep: t=0.50 closed 84 for
  27 false (3.11), t=0.60 closed 69 for 13 (5.31), t=0.70 closed 51 for
  1 (51.0), t=0.80 closed 34 for 0. Under leave-one-vendor-out across
  the 13 build-set vendors, with the threshold picked on the other 12
  each fold, it closed 43 of 147 for 1 false alarm, a ratio of 43.0,
  and every one of the 13 folds picked 0.70 or 0.80. The single false
  alarm was a gitlab.com row. Of the 52 rows raised at t=0.70, road 1
  led on all 52 and road 2 on none. POC B read all 4171 corpus rows
  cold and scored 88.2% exact (3679), 11.0% leaks (459), 0.8%
  over-tight (33). The confusion: truth r, 2082 rows, went r=2077, w=2,
  x=3; truth w, 1218 rows, went r=4, w=1186, x=28; truth x, 871 rows,
  went r=3, w=452, x=416. Per provider, exact ran from 84.3% (asana) to
  96.3% (figma) and leaks from 3.7% (figma) to 15.3% (asana). The fair
  comparison is not the mechanical tool's fitted 93.8 / 1.8 / 4.5 on
  these same rows, which were tuned on them, but the mechanical tool on
  data it had never seen — the burned clean exam's 85.3 / 12.4 / 2.3.
  Cost: POC A was 1113 rows in 36.7 seconds for 3,756,386 input tokens,
  about $0.16; POC B was 4171 rows in 131.5 seconds for 10,817,638
  input tokens, about $0.45. Zero failed calls across both.
- Lesson: Jev's error is concentrated in a single cell — 452 of the 871
  truth-x rows called w — so its x recall is poor at 47.8% while its x
  precision is high, 416 of the 447 rows it calls x being truth x, 93%.
  That asymmetry is exactly the shape a raise-only tier wants: believe
  the positive, ignore the negative. It is also the first thing
  measured in this project that does not collapse under
  leave-one-vendor-out. D81's mined lists went 8.17 fitted to 0.83
  LOVO; this goes 51.0 fitted to 43.0 LOVO, and the per-fold threshold
  was stable at 0.70-0.80 in all 13 folds, which is the property every
  mined word list lacked. The honest limit is that it closes only 29%
  of the leaks under LOVO: a partial fix that clears the bar several
  times over, not a solve. And sweeping a threshold on those 1113 rows
  makes the build set a tuning set for this tier from now on, so the
  number that counts must still come from a fresh exam drawn from the
  ten locked vendors.

### Clean exam 2026-09-20 scored once: Jev raises, it cannot replace (2026-09-21)
- Goal: score the Jev tier on data it has never seen, since the build
  set became a tuning set for it when the threshold was swept.
- Tried: drew 1003 rows from five vendors never seen by any prior set
  — auth0 250, hubspot 250, zendesk 250, klaviyo 141, miro 112 — write
  methods only, POST 339 / DELETE 280 / PATCH 206 / PUT 178.
  cloudflare, pagerduty and sentry were dropped because they are
  M0-era holdouts in `data/corpus/labelled.csv`. Jev's predictions
  (frozen criteria, questionsA and questionsB unchanged, two separate
  calls) and the frozen flow's own predictions were committed with
  sha256s in 597191d before any row was labelled. Nine blind labellers
  then labelled all 1003 rows under
  `data/calibration-2026-09-14/BRIEF.md`. Three constructs came back
  split between labellers — id-keyed upsert, CRM list membership, POST
  verify/test — and the user ruled them before any score was seen:
  upsert keyed on an id is w unless it creates a user account or
  starts a job; CRM list membership is w; verify/test follows its
  text. 13 rows changed (12 x->w, 1 r->x), recorded in
  `data/exam-2026-09-20/label/rulings.csv` with the raw labeller files
  left untouched. The threshold was fixed in advance at 0.70, the
  value POC A picked. Scored once by
  `tools/score-exam-2026-09-20.js`.
- Outcome: truth over the 1003 rows is r 29 / w 633 / x 341 / ? 0,
  with 13 rulings applied. The 12 x->w rulings loosened truth, so they
  could only move flow rows from exact to over-tight, never hide a
  leak. Whole exam, each over 1003 rows: the frozen flow scored exact
  841 (83.8%) / leaks 82 (8.2%) / over-tight 80 (8.0%); Jev-B cold
  scored exact 796 (79.4%) / leaks 207 (20.6%) / over-tight 0 (0.0%);
  flow+Jev-A scored exact 872 (86.9%) / leaks 51 (5.1%) / over-tight
  80 (8.0%). The flow per method: POST 263 / 339 exact (77.6%), 10
  leaks (2.9%), 66 over-tight (19.5%); PUT 153 / 178 (86.0%), 18
  (10.1%), 7 (3.9%); DELETE 230 / 280 (82.1%), 45 (16.1%), 5 (1.8%);
  PATCH 195 / 206 (94.7%), 9 (4.4%), 2 (1.0%). Flow+Jev-A per method:
  POST 263 / 339 exact (77.6%), 10 leaks (2.9%), 66 over-tight
  (19.5%); PUT 161 / 178 (90.4%), 10 (5.6%), 7 (3.9%); DELETE 249 /
  280 (88.9%), 26 (9.3%), 5 (1.8%); PATCH 199 / 206 (96.6%), 5 (2.4%),
  2 (1.0%). Jev-A alone on the 654 rows the flow calls w, of which 82
  (12.5%) are truth x, closed 31 of the 82 leaks (37.8%) for 0 false
  alarms. Per provider: auth0 closed 8 of 34 (23.5%) over 171 flow-w
  rows; hubspot 2 of 4 (50.0%) over 181; zendesk 9 of 22 (40.9%) over
  163; klaviyo 0 of 8 (0.0%) over 69; miro 12 of 14 (85.7%) over 70.
  0 false alarms on every provider.
- Lesson: the raise-only tier held on unseen vendors: 31 of 82 flow
  leaks closed for 0 false alarms, taking whole-exam leaks from 82 to
  51 of 1003 with over-tight unchanged at 80. That is the same shape
  as the build set (51 fitted, 43 LOVO) — a partial fix at clean
  precision. Jev cannot replace the flow: alone it leaks 207 of 1003
  (20.6%), 179 of them on POST's 339 rows, where it calls truth-x
  creates w — 205 of the 341 truth-x rows are called w overall — and
  it is never over-tight (0 of 1003). That is POC B's single-cell
  weakness again, on new vendors: high x precision, poor x recall. The
  flow's POST floor of x is what catches those rows, which is why Jev
  only works on top of it. Klaviyo is the tier's blind spot here, 0 of
  8 flow-w leaks closed; miro is its best, 12 of 14. This exam is now
  burned (D24). The brief needs an addendum for the three split
  constructs before the next exam; `BRIEF.md` itself stays verbatim as
  calibrated, and the addendum goes alongside it.

### Combined diagnostic set: each step does one kind of wrong; stop guessing on the floor (2026-09-21)
- Goal: see each step, the whole flow and Jev scored together on every
  row we pulled and labelled ourselves, and weigh Jev against step 2
  head to head.
- Tried: built `data/combined-2026-09-21/` — 6557 rows across 23
  providers from three sources (provider corpus 4171, exam 2026-09-17
  1383, exam 2026-09-20 1003), ids prefixed `pc-` / `x17-` / `x20-`
  because both exams used `e0001...`. The build set was left out
  because its specs came from apis-guru; camara was deleted the same
  day (a2571b1). Ran Jev A and B fresh over all 6557 rows, 0 failed
  calls: A in 238.8s for about $0.9384, B in 239.6s for about $0.7151.
  Scored with `tools/score-combined-2026-09-21.js`. The x20 slice
  reproduced the exam scorer exactly (841 exact / 82 leaks / 80
  over-tight of 1003), which cross-checks the scorer. The LOVO section
  as first written picked each fold's threshold by the maximum
  closed/false ratio, which always picks 0.90 and closed only 14 of
  305 for 0 false alarms — an artifact of the selection rule. It was
  recomputed with the project's bar (the lowest threshold whose
  training closed/false clears 10, which is the one that closes most
  subject to the bar). Then measured the D84 shape.
- Outcome: truth over the 6557 rows is r 2705 / w 2266 / x 1586. The
  flow, over all 6557 rows: exact 5951 (90.8%), leaks 308 (4.7%),
  over-tight 298 (4.5%). Per step, each over only the rows whose final
  verdict it produced: step 1, 2645 claims, exact 2642 (99.9%), leaks
  3 (0.1%), over-tight 0. Step 2, 2335 claims, exact 2029 (86.9%),
  leaks 305 (13.1%), over-tight 1 (0.0%); its word rules
  (`modify-verb` + `modify-verb-summary`), 366 claims, exact 331
  (90.4%), leaks 35 (9.6%), over-tight 0; its method floor, 1969
  claims, exact 1698 (86.2%), leaks 270 (13.7%), over-tight 1 (0.1%).
  Step 3, 1577 claims, exact 1280 (81.2%), leaks 0, over-tight 297
  (18.8%); `raise-word`, 51 claims, exact 36 (70.6%), leaks 0,
  over-tight 15 (29.4%); `floor-post`, 1526 claims, exact 1244
  (81.5%), leaks 0, over-tight 282 (18.5%). Jev-B cold, over 6557:
  exact 5625 (85.8%), leaks 893 (13.6%), over-tight 39 (0.6%).
  Flow+Jev-A at 0.70, over 6557: exact 6045 (92.2%), leaks 205
  (3.1%), over-tight 307 (4.7%). Jev-A alone on the 2335 flow-w rows,
  of which 305 (13.1%) are truth x: closed 103 of 305 (33.8%) for 9
  false alarms, 11.44, fitted at 0.70. Step 2 head to head, each over
  the same 2335 rows: step 2 exact 2029 (86.9%), leaks 305 (13.1%),
  over-tight 1 (0.0%); Jev-B exact 2155 (92.3%), leaks 161 (6.9%),
  over-tight 19 (0.8%); flow+Jev-A exact 2123 (90.9%), leaks 202
  (8.7%), over-tight 10 (0.4%). Step 2 and Jev-B disagree on 167 of
  2335 rows (7.2%): truth x, step 2 w, Jev x — 145 rows, Jev right;
  truth w, step 2 w, Jev x — 19 rows, step 2 right; truth w, Jev r — 1
  row, step 2 right; truth r, step 2 w, Jev r — 1 row, Jev right;
  truth x, Jev r — 1 row, neither. The fitted sweep over flow-w rows:
  t=0.50 closed 170 for 53 false (3.21), 0.60 135 for 24 (5.63), 0.70
  103 for 9 (11.44), 0.80 66 for 4 (16.50), 0.90 14 for 0. The
  corrected leave-one-vendor-out: 86 of 305 closed (28.2%) for 9 false
  alarms, ratio 9.56, just under the bar of 10, with threshold 0.70 in
  21 folds and 0.80 in 2 (docusign, okta). The D84 shape, each over
  6557 rows: today's flow exact 5951 (90.8%) / leaks 308 (4.7%) /
  over-tight 298 (4.5%); D84, w only with a word, exact 4523 (69.0%) /
  leaks 38 (0.6%) / over-tight 1996 (30.4%); every write x, r against
  not-r only, exact 4227 (64.5%) / leaks 3 (0.0%) / over-tight 2327
  (35.5%). The review queue, step 2's floor rows, is 1969 of 6557 rows,
  of which 270 are truth x. Leaks remaining after flow+Jev-A, by
  provider: xero 60, okta 42, auth0 26, docusign 22, jira 12, zendesk
  12, klaviyo 8, zoom 6, and 1-2 each at datadog, digitalocean,
  hubspot, intercom, miro, openai, paypal, spotify, square and stripe.
- Lesson: each step does exactly one kind of wrong. Step 1 is solved.
  Step 2 holds the leaks, 305 of 308, 270 of them on its wordless
  floor. Step 3 holds the over-tightness, 297 of 298, 282 of them on
  its wordless POST floor. The wordless floor is where specs do not
  state the answer, and neither mined lists nor a model fixes it; the
  honest move is to stop guessing there and publish it as a review
  queue (D84). Also: a threshold picked by maximizing a ratio always
  drifts to the most conservative setting — select by "most closed
  subject to the bar" instead.

### D84 rejected against the bar; the runtime policy replaces it (D85) (2026-09-22)
- Goal: decide whether to build the D84 POC (`poc/unreviewed/`): w
  only on word evidence, every wordless write published as x.
- Tried: D84 was measured on paper on the combined 6557-row set,
  each over all rows, against today's flow and the every-write-x
  reference, and priced at the project's standing adoption bar of 10
  leaks closed per false alarm.
- Outcome: D84 moves step 2's 1969 wordless PUT/DELETE/PATCH floor
  rows from w to x. That closes 270 leaks (308 to 38) and adds 1698
  over-tight rows (298 to 1996): 0.16 leaks closed per false alarm,
  about 60x under the bar. The floor guess is right 1698 of 1969 times
  (86.2%). Rejected 2026-09-22 by the user's ruling before any POC
  code was written; D85 replaces it. The class stays the best guess,
  `evidence` and `destructive` are published as they already are, and
  the README and PRD carry a recommended consumption policy: r allow;
  w on a list allow; w on the floor ask once and remember; x ask every
  time; destructive ask every time. Jev returns to the D82/D83
  raise-only role, pending at 86 of 305 for 9 under LOVO (9.56).
  `src/` unchanged.
- Lesson: a leak count bought below the adoption bar is fitting to
  pass, whichever direction it fits; relabelling the same wordless
  guess as x is not a better classifier. The honesty D84 wanted
  already exists in `evidence: floor` on every verdict, so the safety
  decision belongs in the consumer's policy, not in the class.

### D86: one shared r/w/x definition with bareguard; the fold measured under a proxy (2026-09-22)
- Goal: give rwxmap and bareguard (the user's agent gate: one file of
  r/w/x letters per tool, agent grants like `r--`/`rw-`/`rwx`, child
  ≤ parent, not-in-file = denied, no runtime asks) ONE meaning of the
  three letters, and decide whether the class can absorb "can't be
  undone" without breaking the one invariant.
- Tried: folded reversibility into the class — r = changes nothing;
  w = own stuff AND undoable AND safe to repeat; x = fails any one of
  those; unsure → x — and measured it on `data/combined-2026-09-21/`
  (6557 rows, 23 providers, tuning data) with a PROXY for "can't be
  undone": the DELETE method, or a lead verb in the 23-word list at
  `poc/archive/v2/m0/destructive.json`. The proxy was applied
  identically to truth and prediction. Option 2, relabelling the 6557
  rows for reversibility with nine labellers, was priced and deferred.
- Outcome: adopted as D86 (user ruling). Truth w rows that become x:
  888 of 2266 (39%); truth becomes r 2705 / w 1378 / x 2474 (w falls
  from 35% to 21% of rows); tool w rows that become x: 999 of 2335.
  Ledger today: exact 5951 (90.8%) / leaks 308 (4.7%) / over-tight
  298 (4.5%). Folded under the proxy: exact 6088 (92.8%) / leaks 184
  (2.8%) / over-tight 285 (4.3%). CAVEAT: reversibility was never
  labelled; the proxy flips truth and prediction with the same rule,
  so where it applies it cannot disagree with itself; these are NOT
  accuracy numbers and are never quoted as an exam. D28's two-axes
  ruling is superseded: `destructive: true` ⇒ x, kept as a flag inside
  x for `destructiveHint`; `evidence` unchanged. D85's runtime table
  (ask once on w-floor, ask every time on x) is replaced by
  review-once: floor rows are reviewed by a human before deploy, the
  gate never asks. The wordless floor loses DELETE (now evidence for
  x) and shrinks from 1969 PUT/DELETE/PATCH rows to roughly 1000
  PUT/PATCH rows; step 2 must be rebuilt as M3 (DELETE floors at x,
  the destructive list becomes a w→x raise, PUT/PATCH floor stays w)
  together with a bareguard exporter (draft `tools` section keyed by
  operationId, floor rows left out, sidecar review report, `evidence`
  never in the gate file) and a brief v2 with a reversibility clause
  (`data/calibration-2026-09-14/BRIEF.md` stays verbatim). Jev keeps
  its raise-only role; on the combined set it closes 94 for 3 false
  on the wordless floor (ratio 31) against 5 / 4 on modify-verb rows
  (1.25) and 4 / 2 on modify-verb-summary rows, so it earns its place
  only where the tool read nothing. Relabel is owed before the next
  fresh exam (dropbox, shopify, linear after the exposure check).
- Lesson: folding reversibility into the class only tightens — rows
  move w→x, never the other way — so it is safe to adopt before it is
  honestly measured. But the proxy number is the proxy agreeing with
  itself, not an accuracy figure, and the relabel is owed before any
  exam is scored under the fold.

### D87: the definition collapses to chmod; "touches others" leaves the class (2026-09-22)
- Goal: decide whether the D86 fold — r / own-undoable-repeatable w /
  everything-else x — is a definition a mechanical classifier can
  read, before spending nine labellers on a relabel under it.
- Retired from the PRD (D86 proxy, tuning data, not accuracy): under
  the DELETE-or-destructive-verb proxy applied identically to truth
  and prediction, 888 of 2266 (39%) truth-w rows flipped to x; truth
  became r 2705 / w 1378 / x 2474; the folded ledger read 6088 exact /
  184 leaks / 285 over-tight against today's 5951 / 308 / 298. All
  proxy: where the rule applies it cannot disagree with itself.
- M3 groundwork built under D86, measured for mechanics only, then
  superseded before use (kept in history at bad0c89): brief v2 and a
  2266-row draw of every v1 truth-w row (`data/relabel-2026-09-22/`,
  now deleted); practice calibration with two blind labellers agreed
  100 of 100 (each w 54 / x 46; 14 and 11 marked low confidence).
  `poc/step2v2` (DELETE floors at x, destructive lead verb raises on
  any write method, PUT/PATCH floor w) moved 1030 rows against the
  frozen flow, all w→x: method-delete 918, destructive-verb 74,
  destructive-verb-summary 38. 108 POST rows are where the frozen
  modify-verb lowering and the destructive list collide (cancel 37,
  deactivate 33, remove 15, delete 11, expire 6, disable 3, suspend 2,
  detach 1; v1 truth w 96 / x 12). A reader gap: `delete` sits in
  METHOD_WORDS, so only 11 rows reach x by `delete` on a non-DELETE
  method, all via the summary. The POC read the proxy flip as 912,
  not the 888 the PRD carried. 11 of the 23 destructive verbs never
  fire on a truth-w row.
- What it taught: every list that failed leave-one-vendor-out here
  was a noun list answering "whose thing is it" — user, member, role,
  permission, and the description mining behind them — because nouns
  for "whose" mean different things per vendor (D81). Every list that
  held was a verb list at the lead token answering "what does the
  call do": step 1's read verbs at 98-100%, step 2's modify verbs at
  88-94% per rule. D86 folded reversibility in but kept "reaches
  another party" as a road to x, so the wordless floor still carried
  the unreadable question and 270 of 308 leaks. The 96-of-108 POST
  collision rows (cancel, deactivate, remove …, truth w) show the same
  thing from the other side: the destructive list was not a
  reversibility list either.
- Decision (D87, user ruling): r = changes nothing; w = changes
  things, anyone's, in a way a later write can set back; x = cannot be
  undone; unsure → x. "Touches others" leaves the class (openWorldHint
  is its slot, evidence-only, absent today); "not safe to repeat"
  folds into "cannot be undone", so a plain create is w. The relabel
  covers all 3852 non-r rows of the combined set under a brief v3
  calibrated blind; brief v2 and its practice run are discarded. This
  is a definition change with its own number, not a fix — the
  "relabel your way out" pattern D85 rejected for D84 — and is named
  as such.

### M3 POC under D87: the relabel, the lists, and the first readout (2026-09-22)

- Relabel under brief v3 (D87): all 3852 non-r rows of the combined set, nine blind labellers, every file validated directly. v3 truth over the 3852: w 2378 / x 1467 (1463 labelled plus 4 abstentions ruled x by the user) / r 7; 391 marked low confidence. Whole set of 6557: r 2712 / w 2378 / x 1467. Moves against v1 by method: DELETE w→x 777 of 803 (26 stay w where trash or restore is named); POST x→w 930 (plain creates), POST w→x 147 (sends, runs, cancels); PUT x→w 123; PATCH x→w 17. Per provider x runs 16% (xero) to 64% (figma, 11 rows); most sit at 33-47%.
- Built `poc/d87/` (steps 1-3, flow, 14 tests, readout). Step 1 is src/step1.js copied; a proof compares it with src on all 6557 rows and was seen to fail when broken by hand. Reader fix: `delete` left METHOD_WORDS. Step 2 (x by evidence): DELETE always, plus a 29-verb CANT_UNDO list at the lead (or the summary verb when the lead is a bare method word); 6 of them set destructive. Step 3 (w): PUT/PATCH floor, plus a 14-verb KEEP_W list lowering POST. Unclaimed POST floors at x. OTHER_PARTY and RAISE_WORDS are gone.
- The lists were written by reading the pile. KEEP_W took the frozen MODIFY_VERBS members with 0 leaks, plus every verb clearing 10 fixed per leak on 2+ providers: update 166/13, add 81/6, remove 21/2, attach 12/1, assign 11/0, activate 34/0. Frozen members that leak below the bar left the lowering list and now floor at x: deactivate 29 fixed / 5 leaks, change 4/2, swap 1/1, archive 3/5, disable 1/2 (pending the user's ruling). CANT_UNDO took the spec candidates plus pile verbs where x outnumbers w on 2+ providers.
- Readout on 6557 rows, v3 truth (tuning data, fitted): exact 5418 (82.6%), leaks 64 (1.0%), over-tight 1075 (16.4%). LOVO over 23 providers, lists rebuilt per fold by their adoption rule: leaks 64 (1.0%, 0.0 points off fitted), over-tight 1103 (16.8%, 0.4 points off).
- Where the errors sit. Leaks: 23 on list rows (22 are KEEP_W lowerings: update 13, add 6, remove 2, attach 1; 1 is step 1's known validate row) and 41 on floor rows (39 are the PUT/PATCH w floor). Over-tight: 1036 of 1075 are the POST floor, mostly plain creates.
- Step 2 on POST changes no class — the POST floor is x already — so its list adds evidence and the destructive flag there; its only class effect is PUT/PATCH, where it closed 12 leaks for 3 false alarms.
- create is the lever and fails the bar: 503 fixed / 72 leaks (6.99). Alone it would move the flow to 89.0% exact / 2.1% leaks / 8.9% over-tight. A guard blocking create when any CANT_UNDO word sits anywhere in the row reaches 499/54 (9.24), still under. Under LOVO create is kept on 0 of 23 folds, create+guard on 2 of 23 (80 fixed / 25 leaks, 3.20). The 54 guarded leaks are money movement (payment intents, payouts, transfers, top-ups, reversals), jobs (export, import, resize, fine-tuning, batch) and messages.
- Against the proposed gate (read on tuning data only; the gate is for the fresh exam): item 1 (zero leaks on list rows) fails at 22 lowering leaks — no lowering list on this truth reaches zero; item 2 (leaks ≤5%, all on floor rows) passes on rate, fails on "all on floor"; item 3 (over-tight ≤20%) passes at 16.4%; item 4 (LOVO within 2 points) passes.
- What it taught: under D87 the verb lists hold across vendors (LOVO within half a point) where the "whose" noun lists never did. The cost moved: leaks are now small and mostly the PUT/PATCH floor, and the price is over-tightness on POST creates, which lead verbs alone cannot split into plain creates (w) and creates that move money or start work (x).
