---
type: reference
title: rwxmap — PRD
status: stable
---

# rwxmap — PRD

## The floor (start here)

Every operation starts at its method's floor. The floor is each method's
own measured truth lean over the 4171-row provider corpus
(`data/provider-corpus-2026-09-16/`, 15 complete official API specs —
stripe, openai, square, zoom, paypal, meta-whatsapp, spotify,
digitalocean, jira, mailchimp, asana, datadog, intercom, canva, figma —
labelled blind under `data/calibration-2026-09-14/BRIEF.md`). This
replaced the prior 5465-row corpus on 2026-09-16: that corpus never saw
one complete API (319 of its 332 providers had zero GET rows, 58
contributed exactly 24 write rows and nothing else), so it could not
give a per-provider truth read; the old table and its numbers are in
`docs/logs/learnings.md`. It is a starting value, never an early return
(D42).

| method | n | truth r | truth w | truth x | floor | holds? |
|---|---|---|---|---|---|---|
| GET | 1960 | 100% | 0% | 0% | **r** | yes |
| POST | 1309 | 9% | 29% | 61% | **x** | yes |
| PUT | 345 | 0% | 93% | 7% | **w** | yes |
| DELETE | 473 | 0% | 92% | 8% | **w** | yes |
| PATCH | 84 | 0% | 98% | 2% | **w** | yes |

Every floor holds on the new corpus, including POST at 61% x — unlike
exam 5's unseen-vendor draw against the old corpus, where POST
inverted (x 62% to 23%, r 17% to 63%); that inversion and its
vendor-by-vendor recheck are recorded in `docs/logs/learnings.md` and
are not repeated here since this table supersedes them as the current
per-method truth read.

## The shared definition (D87)

Adopted 2026-09-22 (user ruling): rwxmap and bareguard — the user's
agent gate, one hand-written file of r/w/x letters per tool or
command — use ONE meaning of the three letters, and it is the chmod
reading:

- r = read: changes nothing.
- w = write: changes things, the caller's own or anyone else's, in a
  way a later write can set back. Sets, edits, creates, toggles,
  archives, pauses, cancels of something that can be resumed.
- x = execute: cannot be undone. Deletes and removals, revokes,
  expires, voids, sends, publishes, charges, pays, refunds, triggers
  a run. `destructive: true` when it removes.
- Unsure → x.

"Touches others" is no longer a class test. One current shape only;
D86's fold and proxy are in learnings.

Why. Every list that failed leave-one-vendor-out in this project was
a noun list answering "whose thing is it" — user, member, role,
permission, and the description mining behind them; nouns for
"whose" mean different things per vendor (D81). Every list that held
was a verb list at the lead token answering "what does the call do":
step 1's read verbs hold at 98-100%, step 2's modify verbs at 88-94%
per rule. D86 folded reversibility in but kept "reaches another
party" as a road to x, so the wordless floor still carried the
unreadable question and 270 of 308 leaks. D87 keeps only questions
of the second kind. "Not safe to repeat" is folded into "cannot be
undone": what makes a repeat unsafe is that the first call already
did something a write cannot take back. A plain create is a write (a
delete undoes it; a duplicate is a mess, not damage) and becomes w; a
create that also sends, charges or runs stays x.

What it costs. PUT/PATCH rows that reach another person — set a
user's password, change their role, update collaborator permissions,
publish or share by a non-create call — move from x to w. The tool
never caught these (they were the floor leaks), so the tool is not
less safe; truth now matches what a mechanical classifier can read.
This is stated as a definition change with its own number, not as a
fix, because it is the "relabel your way out" pattern D85 rejected
for D84 and must be visible as such. MCP's `openWorldHint` is the
slot "touches others" would map to; it stays out of the class and
may return as an evidence-only flag next to `destructive`, never
emitted as false. Today there is no evidence source, so it is absent.

The two evidence sources for x. The DELETE method, and a can't-undo
lead verb on any write method (the list is written by reading the
pile and priced on the relabel: delete remove purge revoke expire
void send publish trigger run execute charge pay refund …). PUT/PATCH
otherwise floor at w; POST lowers to w on a modify verb or, if it
passes the adoption bar of 10, a create verb, else floors at x so an
unknown create fails safe. `destructive` stays a refinement flag
inside x (D86's ruling on D28 stands); `evidence` (`list` / `floor`)
is unchanged. The step numbering is in "M3 spec (D87)" below: step 2
is x by evidence, step 3 is w; the old naming (step 2 = w, step 3 =
x) is history in learnings.

Brief v3 and the relabel. The change is not one-directional (truth x
can become w), so the relabel covers every non-r row of the combined
set: 3852 of 6557 (2266 truth-w + 1586 truth-x), under a brief v3
calibrated blind — practice with two labellers, the user rules
disputes, holdback scored once. Brief v2, its practice run and the
2266-row plan are discarded (kept in history at bad0c89).
`data/calibration-2026-09-14/BRIEF.md` stays verbatim — it is the
calibrated brief every existing label was made under — so v3 is a
new file, an M3 item, calibrated before any exam relies on it. The
floor table above predates D87 and is read under the v1 brief.

## M3 spec (D87): the ladder rebuilt

This is the specification the M3 POC is tested against. Results are
left blank on purpose and filled in only when measured; the spec does
not move to meet a number.

**The ladder.** Three standalone steps, named by run order, each
owning one letter, each with its own word lists and its own ledger,
plus a fourth stage — step 2's floor, called last by the flow — which
is not a step of its own. The flow file decides only the order.

- step 1, r. Unchanged from src/step1.js (D74): GET/HEAD/OPTIONS
  floor r; a read lead verb lowers POST to r; the 10-word safe-verb
  list at any position. 2642 of 2645 claims right on the combined
  set; reused as is.
- step 2, x by evidence. Claims x on (a) method DELETE, always, and
  (b) a can't-undo lead verb on any write method (POST, PUT, PATCH).
  The verdict carries `destructive: true` when the verb or method
  removes, else no destructive field. The list is written by reading
  the relabelled pile (delete remove purge revoke expire void send
  publish trigger run execute charge pay refund … as candidates) and
  every member is priced; nothing is in it before the labels land.
- step 3, w. PUT/PATCH floor w. POST lowered to w by a modify lead
  verb (the survivors of the frozen MODIFY_VERBS after the can't-undo
  members leave) and, only if it clears the bar, by a create lead
  verb (create add register upload insert …). No OTHER_PARTY gate:
  "whose" is not a class test under D87.
- floor. Anything unclaimed is a POST with no word: x, `evidence:
  floor`. The floor function belongs to step 2 and the flow calls it
  last.

Precedence runs on evidence strength: method DELETE beats every word;
a word beats a floor; the flow orders 1, 2, 3, floor so this falls
out of the order alone. Step 2's and step 3's verb lists are disjoint
by construction and measured jointly; a verb that both steps want
(cancel, reset, disable) is settled by the relabelled pile, not by
argument. The reader change: `delete` leaves METHOD_WORDS so a
`deleteThing` lead is read as a verb on any method.

**What deprecates.** OTHER_PARTY (step 2 today) and RAISE_WORDS
(step 3 today, 17 nouns) answer "whose"; they have no job under D87
and are not carried over. MODIFY_VERBS splits between step 3 (stays w)
and step 2 (becomes x) by measurement. The frozen src/ stays shipped
at v0.3.0 until M3 graduates.

**Truth.** The relabel of all 3852 non-r rows of the combined set
under BRIEF-v3.md, nine labellers, every file validated directly
(header, order, classes, confidence). v1 r rows stand. Practice:
97 of 100 agreed, three disputes ruled (calib/practice-rulings.csv).
Holdback: measured once, recorded in the brief. This is tuning data.

**Pricing.** Every list member and every rule is priced alone and
jointly against the relabelled truth: leaks closed per false alarm,
adoption bar 10, and leave-one-vendor-out across the 23 providers as
the only generalization number. Each step keeps its own ledger,
charged to the rule that owns the row; a combined line is labelled
combined. Under- and over-classification are always reported
separately with counts and the denominator.

**Gate (user ruling 2026-09-22, D89; item 1 replaced by D94,
2026-09-23).** On the fresh exam (cloudflare, pagerduty and sentry,
4279 operations, drawn after the exposure check, labelled blind under
v3, scored once):
1. Leaks overall at or under 2% of all rows, every one listed.
2. Over-tight at or under 20% of rows, reported, never traded against
   item 1.
3. LOVO on the tuning set within 2 points of the fitted number for
   every adopted list, or the list is not adopted.

**Deliverables.** poc/d87/ (steps 1-3, flow, tests, readout, proof
against src/ for step 1 only), then graduation to src/ as the M3
release; the bareguard exporter with its sidecar (contract now D91 as
amended by D103 — every row exported, letter or letter-plus-marker;
not built yet);
Jev's criteria text replaced by the D87 definition (raise-only,
pending, D82/D83).

**The story (user, 2026-09-22).** The words settle r and w for most rows; whatever the words cannot settle goes to x. On the 6557 tuning rows that leaves 1075 over-tight (16.4%) for 64 leaks (1.0%). Jev, asked only about the rows that reach the POST floor, moves a row from x to w only when it is at least 90% sure the row is w (t=0.10, D88): over-tight falls to 309 (4.7%) for 72 leaks (1.1%).

**Results (poc/d87, tuning data, fitted, 2026-09-22).** v3 truth over the 6557 rows: r 2712 / w 2378 / x 1467. Flow: exact 5418 (82.6%), leaks 64 (1.0%), over-tight 1075 (16.4%). LOVO over 23 providers: leaks 1.0% (0.0 points off), over-tight 16.8% (0.4 points off). Leaks: 23 on list rows (22 from KEEP_W lowerings, 1 step 1), 41 on floor rows (39 the PUT/PATCH w floor). Over-tight: 1036 of 1075 on the POST floor. Lists as built: CANT_UNDO 29 (REMOVES 6), KEEP_W 14; deactivate, change, swap, archive and disable left the lowering list below the bar (user ruling 2026-09-22, D89: they stay off, those rows floor at x). create fails the bar (6.99 fitted; kept on 0 of 23 LOVO folds; with a can't-undo-word guard 9.24 fitted, 2 of 23 folds) and is not adopted. Against the gate as it now stands (D89 with item 1 replaced by D94): the tuning read is 64 leaks of 6557 rows (1.0%), inside the 2% bar, and the LOVO line above is inside the 2-point bar; the gate itself is scored on the exam, in "Where the work is" below. The 13 can't-undo verbs that leave-three-out drops (execute, run, void in 87% of folds, ten others in 24%) were priced and stay (user ruling 2026-09-22, D90): they claim 40 rows, removing all 13 costs 1 leak and 0 over-tight fitted, changes nothing at all under leave-one-out, and moves 40 rows from list evidence to floor. Detail in learnings, "M3 POC under D87".

## Truth by provider (new — the old corpus could not give this)

No single-corpus provider had enough rows to read a per-provider truth
lean before; the 4171-row provider corpus's 15 complete specs can:

| provider | n | r | w | x |
|---|---|---|---|---|
| digitalocean | 684 | 53% | 30% | 17% |
| jira | 610 | 50% | 35% | 15% |
| stripe | 594 | 46% | 29% | 25% |
| openai | 346 | 48% | 24% | 28% |
| square | 332 | 48% | 33% | 20% |
| mailchimp | 298 | 50% | 31% | 19% |
| asana | 249 | 48% | 27% | 25% |
| datadog | 235 | 52% | 29% | 19% |
| intercom | 231 | 49% | 32% | 19% |
| zoom | 155 | 52% | 28% | 21% |
| paypal | 115 | 37% | 24% | 39% |
| meta-whatsapp | 113 | 43% | 22% | 35% |
| spotify | 96 | 63% | 29% | 8% |
| canva | 59 | 61% | 8% | 31% |
| figma | 54 | 80% | 13% | 7% |

32 rows overlap the old corpus (all stripe, every stripe row the old
corpus had); 29 of 32 agree (90.6%), and all 3 disagreements are
x → w — the new labels lean slightly looser.

**How the flow works (the user's reading, 2026-09-13).** One sequence,
three steps. Each step takes the rows the step before left behind.

1. **Step 1, r.** Start every GET / HEAD / OPTIONS row at r. Then look
   at POST, twice: a POST whose **lead token** is a read verb is r; and
   a POST the lead rule did not claim, carrying a never-a-noun compute
   verb **anywhere** in its name, is r too. Built and frozen 2026-09-16
   (D74) — 2052 claimed, 3 leaks, 2049 of the corpus's 2082 truth-r
   rows found (98.4%).
2. **Step 2, w.** Start every PUT / DELETE / PATCH row at w. Then look
   at the POST rows step 1 left behind: a POST whose lead token is a
   modify verb from `MODIFY_VERBS` is w, and so is one whose
   operationId carries no verb at all (a bare `PostThing` name) but
   whose summary leads with one. Either way the lowering is blocked
   when the row names someone who is not the caller, from
   `OTHER_PARTY`. Built and frozen 2026-09-17 (D75) — 1134 claimed,
   71 leaks, reaching 227 of the 380 truth-w POST rows. See learnings,
   "One-flow ladder".
3. **Step 3, x.** Two rules. `raise-word` scans the PUT / DELETE /
   PATCH rows step 2 floored WITHOUT a word and raises them to x when
   one of the 17 `RAISE_WORDS` nouns fires at any token position — 19
   claimed, 19 right, 0 false alarms. `floor-post` is the named
   leftover pile: every row steps 1 and 2 left, 985 of them, all POST,
   called x because x is the tightest class and nothing spoke for the
   row. Built and frozen 2026-09-17 (D78) — 1004 claimed, 818 right,
   **0 leaks, structurally**, since x is the tightest class and there
   is nothing looser for step 3 to be wrong toward.

**Superseded.** The pre-D87 core — the D74 (step 1, r), D75 (step 2, w)
and D78 (step 3, x) three-step ladder, frozen 2026-09-16/17, graduated
to `src/` 2026-09-17 (D79) and measured at 94.2% exact / 1.3% leaks /
4.5% over-tight on the 4171-row provider corpus — was replaced by the
D87 ladder on 2026-09-22. Its full build history, rule-by-rule
ledgers, ablations and word-list durability numbers live in
`docs/logs/learnings.md`. The current shape is "M3 spec (D87): the
ladder rebuilt" and "The story" / "Results" above, and "Where the code
lives (src/)" just below still describes today's `src/`.

### Where the code lives (src/)

| file | owns |
|---|---|
| `src/tokens.js` | the splitter, tokenizer, verb stemmer and `verbForRow` (lead verb, or the summary verb when the lead is a bare method word) — readers only, no classification list |
| `src/step1.js` | step 1, r: `method`, `read-verb`, `read-verb-anywhere`; owns `READ_VERBS`, `SAFE_VERBS` (D74, unchanged) |
| `src/step2.js` | step 2, x by evidence: `method-delete`, `cant-undo-verb`, `cant-undo-verb-summary`, and the `floor-post` floor; owns `CANT_UNDO` (29) and `REMOVES` (6) |
| `src/step3.js` | step 3, w: `method-floor` (PUT/PATCH), `modify-verb`, `modify-verb-summary`; owns `KEEP_W` (14) |
| `src/flow.js` | the ladder: step 1, step 2, step 3, then step 2's floor — order written once |
| `src/jev.js` | the optional Jev tiers (D82/D88/D95), three of them, each with its own ledger and none able to undo another: `jev-lower` lowers a `floor-post` row x→w at p(isX) <= 0.10; `jev-raise-wx` raises a `method-floor` row w→x at p(isX) >= 0.80 on the x-only criteria; `jev-raise-get` raises a `method` r row r→w, never x, at p(changes) >= 0.50. Any bad answer leaves the verdict untouched — fail closed. No network code: the adopter makes the call |
| `src/index.js` | the package entry: `classifyRow`, plus `applyJev`, `needsJev`, `jevState`, `jevQuestions`, `JEV_THRESHOLD` |
| `src/types.js` | the shared `Operation` and `Verdict` typedefs |
| `tools/corpus.js`, `tools/csv.js` | corpus loading and CSV read, test/dev only, never shipped |

Each step owns its own lists; `src/tokens.js` holds readers only. Each rule returns its own `source` (floor, list, or jev) and `matched` at the moment it matches. `poc/d87/` is the reference the src code is proved against: `node poc/d87/proof-src.mjs` runs both over all 6557 combined rows and must print 0 differences (checked to fail when broken), and replays the recorded Jev answers through `applyJev` (804 lowered). Step 1 keeps its own proof, `node tools/proof-step1.js`.

Run: `npm test`, `npm run typecheck`, `node poc/d87/proof-src.mjs`, `node tools/proof-step1.js`.

Current shape: the numbers are the M3 results above ("M3 spec (D87)", Results and The story). Superseded shapes and their numbers are in `docs/logs/learnings.md`, not here.

## Where the work is

The core in `src/` is the D87 ladder (M3), graduated 2026-09-22 and
proved equal to `poc/d87/` on all 6557 combined rows, with the
optional D88 Jev tier lowering `floor-post` rows only when Jev is at
least 90% sure the row is w. It is not released yet: npm still ships
v0.3.0 (the D75/D78 flow) until the M3 release.

The M3 clean exam (cloudflare, pagerduty, sentry, the three
unspent-and-pullable vendors of the locked pile, D92) was drawn,
labelled blind under BRIEF-v3, and scored once on 2026-09-23. It is
now BURNED (D24) — no re-score, no rule change evaluated against these
rows again. Mechanical only, no Jev (this exam has no Jev answers of
its own yet): 4279 rows, exact 3520 (82.3%), leaks 34 (0.8%),
over-tight 725 (16.9%) — essentially unchanged from the 6557-row
tuning set's own read of 82.6% / 1.0% / 16.4%, unlike the D75/D78
flow's fall from 93.8% fitted to 85.3% exam. Per vendor (cloudflare is
84% of the rows, so the pooled line above is never quoted alone):
cloudflare n=3575 exact 81.8% leaks 0.9% over-tight 17.3%; pagerduty
n=465 exact 83.2% leaks 0.4% over-tight 16.3%; sentry n=239 exact
87.4% leaks 0.4% over-tight 12.1%. Per method: GET n=2099 exact 2094
(99.8%) leaks 5 (0.2%) over-tight 0 (0.0%); POST n=892 exact 179
(20.1%) leaks 3 (0.3%) over-tight 710 (79.6%); PUT n=460 exact 443
(96.3%) leaks 14 (3.0%) over-tight 3 (0.7%); DELETE n=558 exact 548
(98.2%) leaks 0 (0.0%) over-tight 10 (1.8%); PATCH n=270 exact 256
(94.8%) leaks 12 (4.4%) over-tight 2 (0.7%). 710 of the 725 over-tight
rows are POST, because an unclaimed POST floors at x by design — that
is the pile the optional Jev tier exists to lower; PUT (3.0%) and
PATCH (4.4%) carry 26 of the 34 leaks, all on the wordless floor.
Note, not a gate item since D94: 3 of the 34 leaks sit on
`evidence: list` rows (3 of 90 list rows), and all three are the known
lead-verb-matches-a-noun blind spot — two are step 1's read-verb list
claiming `evaluate` (cloudflare's `EvaluateNewWebhook` and
`EvaluateExistingWebhook`, both truth x), the third is step 3's
modify-verb claiming `add` in sentry's `addOrganizationMember`. The
denominator is tiny, which is why D94 replaced this reading with
overall leaks. Full per-method,
evidence-split and row-level detail is in
`docs/logs/learnings.md` ("The M3 clean exam", 2026-09-23).

The with-Jev pass over this exam has now run — once, at thresholds
frozen before any exam row was read. M3 clean exam, cloudflare +
pagerduty + sentry, 4279 operations, scored once and burned (D24).
Mechanical, no model tier: 82.3% exact (3520 of 4279), 0.8% leaks
(34), 16.9% over-tight (725). With all three Jev tiers: 93.0% exact
(3980 of 4279), 0.5% leaks (22), 6.5% over-tight (277). Both error
directions fall; nothing is traded. cloudflare is 84% of the rows
(3575), so the pooled line is never quoted alone.

**The M3 gate PASSES on all three items**, measured on this exam.
Item 1 (leaks at or under 2% of all rows): 22 of 4279 (0.5%) with Jev,
34 of 4279 (0.8%) mechanical. Item 2 (over-tight at or under 20%):
277 of 4279 (6.5%) with Jev, 725 (16.9%) mechanical. Item 3 (LOVO
within 2 points of fitted): held, at the LOVO figures already given
in "Results (poc/d87 …)" above.

Next, in order: the bareguard exporter; then the M3 release; then a
fresh exam for anything adopted under D100. D84 stays rejected (D85); the
consumption policy in the following section stands.

### Adoption bars by direction (D100)

A candidate rule is priced on what share of the rows it flags are
correct, and the bar depends on which way it can be wrong.

| rule direction | can it create a leak? | bar | why |
|---|---|---|---|
| loosens a class (x→w, w→r) | yes | at least 91% of flags correct | its mistakes are under-classification, the go/no-go direction |
| tightens by one step (r→w, w→x) | no | more right than wrong, and neither error type worse overall | its mistakes are over-classification, a usability cost |

The 91% bar is the original 10-leaks-closed-per-false-alarm rule
restated. It stands unchanged for anything that can loosen. D84 (14%
correct) and the mined word lists stay rejected under both bars.

Measured on the M3 exam:

| tier | direction | rows flagged | correct | verdict |
|---|---|---|---|---|
| jev-lower (x→w, t=0.10) | loosens | 522 of 808 | 99.4% (3 became leaks) | PASS, 91% bar |
| jev-raise-wx (w→x, t=0.80) | tightens | 11 of 724 | 90.9% (10 of 11) | PASS |
| jev-raise-get (r→w, t=0.50) | tightens | 9 of 2099 | 55.6% by label, 77.8% after the D100 rulings | PASS |

jev-raise-wx would also pass the old 91% bar; jev-raise-get would not,
and is adopted on the tightening bar. The caveat, said plainly:
jev-raise-get's case rests on 9 flagged rows, 5 right by the labels —
a thin basis, and it is unproven until a fresh exam.

The three thresholds (0.10, 0.80, 0.50) were swept against direct HTTP
calls. Provider hardening shifted recorded noul values by up to 0.17,
so routing the calls through a hardened provider invalidates all three
and they must be re-swept.

D87 was adopted 2026-09-22: the definition collapses to the chmod
reading and "touches others" leaves the class (see "The shared
definition (D87)" above). M3 = the ladder rebuilt under D87 + brief
v3 + the relabel of all 3852 write rows of the combined set + the
bareguard exporter. The ladder under D87: step 1 r unchanged; step 2
x by evidence (DELETE method, can't-undo lead verb); step 3 w
(PUT/PATCH floor, POST lowered by modify or, above the bar, create
verb); unclaimed POST floors at x (see "M3 spec (D87)" above). That
is new `src/` code, not a patch; the burned exams cannot re-score it
(D24). The M3 groundwork under D86 — brief v2, the 2266-row draw,
`poc/step2v2` — was built, measured for mechanics (1030 rows moved,
all w→x, 918 of them by DELETE) and superseded before use; its
numbers are in learnings. Jev keeps its D82/D83 role; its criteria
text becomes the D87 definition, a criteria edit inside M3.

A second clean exam, `data/exam-2026-09-20/`, was drawn from five
vendors no prior set had seen — auth0, hubspot, zendesk, klaviyo,
miro — 1003 write-method rows. Jev's predictions were committed before
any row was labelled, and the exam was scored once and is burned
(D24). Each over 1003 rows: the flow scored exact 841 (83.8%), leaks
82 (8.2%), over-tight 80 (8.0%); flow plus the Jev raise scored leaks
51 (5.1%), over-tight 80 (8.0%); Jev alone leaked 207 (20.6%). This is
now the project's latest honest generalization number, standing
beside the 2026-09-17 exam's 85.3% exact / 12.4% leaks / 2.3%
over-tight over 1383 rows. The two are not comparable head to head:
different vendors, and the 2026-09-20 exam holds write methods only.

A combined diagnostic set, `data/combined-2026-09-21/`, puts every row
we pulled and labelled ourselves in one place: 6557 rows across 23
providers (the provider corpus's 4171, the 2026-09-17 exam's 1383, the
2026-09-20 exam's 1003). It is tuning data, not an exam; every number
it gives is a diagnostic. The fresh exam drawn after it, from the
last unused locked vendors that could actually be pulled, is
cloudflare, pagerduty and sentry (D92); it is scored and burned — see
"Where the work is" above. What remains of M3 is the bareguard
exporter and the release.

The full module ladder, the M1 go/no-go gate, the labelled sets and
the current arbiter shape with its scores live in
[module ladder and arbiter shape](../wiki/module-ladder-and-shape.md).
Decisions D1-D70 are in [the decisions log](../wiki/decisions-log.md).
M0 is closed; its gate statement and results are in
[go/no-go gate and M0 results](../logs/gate-and-m0-results.md). Notes
carried from the original outline are in
[design notes](../logs/design-notes.md).

## How to consume the map (D85, revised by D86)

D84 (2026-09-21) proposed publishing every wordless write row as x
with `evidence: floor`, so the tool would stop guessing w against x
where no word fired. It was rejected 2026-09-22 (user ruling, D85)
before its POC was built. On the combined set the move trades 270
fewer leaks for 1698 more over-tight rows: 0.16 leaks closed per false
alarm against the project's standing adoption bar of 10, about 60x
under it. It is not a better classifier — it is the same wordless
guess relabelled — and it fails the project's own bar. The honesty it
wanted already exists: `evidence: floor` is published on every
verdict (D76/D77), so the safety decision belongs in the adopter's
runtime policy, not in the class.

The record of why. Measured on the combined set, 6557 rows across 23
providers, each over all 6557 rows; a diagnostic over tuning data,
not an exam:

| shape | exact | leaks | over-tight |
|---|---|---|---|
| today's flow (v0.3.0) | 5951 (90.8%) | 308 (4.7%) | 298 (4.5%) |
| D84: w only with a word (rejected) | 4523 (69.0%) | 38 (0.6%) | 1996 (30.4%) |
| every write x (r against not-r only), reference | 4227 (64.5%) | 3 (0.0%) | 2327 (35.5%) |

The rows D84 would have moved are step 2's wordless PUT / DELETE /
PATCH floor, 1969 of 6557: a floor PUT says w and is right 1698 of
1969 times (86.2%), 270 are truth x.

What stands instead. The class is the tool's best guess and stays
accurate by default. The map carries exactly four fields — the three
D76/D77 name (`class`, `destructive`, `evidence`: `list` when a word
fired, `floor` when only the method decided, `jev` when the optional
model tier moved the row) plus `review` (D101),
the review hint. D85 first read
them as a runtime policy (ask once on a w-floor row, ask every time
on x). D86 (2026-09-22) replaces that with review-once: floor rows
are reviewed once by a human before the map is deployed, and the
gate never asks at runtime.

The reading under D87. D87 (2026-09-22) collapsed the definition to
the chmod reading — see "The shared definition (D87)" above; letter
= class is unchanged by it. `destructive: true` always sits inside
class x, so the two "ask every time" rows of the old table collapse
into one letter. `review` marks the rows a human should read before
deploy — `tight` first, then `loose` (D101). Under D103 `review` is
also published INTO THE BAREGUARD GATE FILE as a tool entry's
`marker`, not only into rwxmap's own map and sidecar. `evidence` says only
whether a word fired or the method alone decided, and is not a
reliability signal. The policy is NOT carried in the map JSON; it is
how a consumer reads the four fields, and the README states it the
same way.

bareguard alignment (SETTLED with the bareguard session 2026-09-22,
D91, AMENDED 2026-09-24 by D103 — the omission policy below is dead,
the exporter emits every row, and a letter may now carry a marker;
bareguard's rwx support is approved but not yet built — their
branch `feat/rwx`, target release 0.17.0, so this is a
settled-but-unshipped contract; their file shape is authoritatively
specced in their repo's `docs/product/bareguard-prd.md`, Part 1 §23 —
if their spec and this paragraph ever disagree, theirs governs and
this is the stale copy). bareguard owns the gate, the file
format (one letter per row), agent grants such as `r--` / `rw-` /
`rwx`, child ≤ parent, deny-by-absence and no runtime asks. A `tools`
entry's value is a BARE SINGLE LETTER (`"r"`, `"w"` or `"x"`), which
stays legal forever; the three-letter form is for the `agents` map
only. Under D103 a `tools` / `bash` entry MAY instead be an object
`{ "letter": "w", "marker": "loose" }`, where `marker` is rwxmap's
`review` hint (D101); nothing else goes on a tool entry, and
everything beyond letter and marker — the evidence kind included —
belongs in rwxmap's sidecar, never the gate file. rwxmap owns
the labels and the carriers, and gains one offline exporter (an M3
item): spec → draft `tools` section of `bareguard.rwx.json`, keyed
`<vendor>.<operationId>` (dot-separated: bareguard matches a `tools`
key literally against the harness's action `type` and does no
namespacing, so a bare operationId would collide across vendors),
letter = class (identity under D87), NEVER the `agents` section.
D91 left floor PUT/PATCH rows OUT of the export, on the grounds that
deny-by-absence forces a human letter. That policy is DEAD (D103): the
exporter emits EVERY row. Those rows are right 96.6% of the time
(1601 of 1657 on the 8376-row tuning pool), and omitting them cost a
reviewer a median of 38 rows per spec, 1657 of 8376 (19.8%) across 36
vendors — 0 for stripe, openai and meta-whatsapp, 125 for hubspot
(half its rows), 60% of trello. The `loose` marker now says the same
thing the omission used to say, without deleting the row. bareguard has
no `destructive` concept, now or planned; its deny mechanism is the
`flags` primitive (e.g. `flags: { type: { "deleteUser": "deny" } }`,
rule id `flags.type`, or `"ask"` to route to a human), which lives in
the gate config, not in `bareguard.rwx.json` or on a tool entry, and
fires before the allowlist/rwx check. The exporter MUST NOT emit
`flags` — denial is the human's call at grant time, and an
agent-authored deny rule would cross bareguard's authorship boundary.
A sidecar review report carries the evidence kind for each row, and
MAY list rows where `destructive` is true as a
clearly-labelled SUGGESTION for the reviewer, never as config;
`evidence` and `destructive` never enter the gate file. The sidecar
is HUMAN-FACING ONLY — bareguard never reads it, since an unlisted
tool already denies at runtime with `rwx.unlisted` telling the
operator to add it as r, w or x, so rwxmap is free to shape the
sidecar for its reviewer and must not design it as a bareguard input.
A human reviews the sidecar and commits the file; nothing writes at
runtime. D28's motivating case, "read and reply, never delete", is
expressed in bareguard as a grant of `r-x` plus a `flags.type: deny`
rule on the delete action in the gate config — separate from the
letters — so nothing is lost by folding `destructive` into x; the
exporter never emits that deny rule, only the sidecar's suggestion.
bareguard confirmed both of our follow-up consequences on 2026-09-22:
the sidecar may name `flags.type` inside a clearly-labelled
suggestions block provided it does not pre-write the operator's
config text, and `rwx.unlisted` stays a loud named deny for any row
the exporter never saw. D103 (2026-09-24) adds one more agreed point:
bareguard gains an opt-in `rwx.askOn` knob, defaulting to off, which
reads the marker. That knob is bareguard's design and its default is
bareguard's call, not rwxmap's; it is recorded here only so the two
repos agree on what the marker is for. The measured shape of the
three markers, and why `tight` is a build-time worklist rather than a
runtime ask trigger, is in D103 and in "The review hint (D101)" below.
The boundary is unchanged: bareguard never runs rwxmap, at build time
or at runtime. The consumer runs rwxmap offline, reviews the draft,
commits the file; bareguard only ever reads a file the operator
committed.

Vendor-to-vendor inconsistency in how methods are used is structural
(D81: mined lists do not transfer), and the tool reports it through
the floor flag rather than chasing it. The tool cannot know which
operations an adopter actually calls heavily — a spec does not say —
so it gives the head start and the adopter tightens from traffic.

What stays frozen: `src/` is unchanged today, the word lists are kept
as they are, the POST floor stays x, and the output shape and its
carriers (D76/D77) are unchanged. `poc/unreviewed/` is never created.
D86 reopened step 2 for the M3 rebuild and D87 sets the definition
it is rebuilt under (see "Where the work is"); nothing in `src/` has
changed yet.
Jev returns to D82/D83's role: an optional raise-only tier (w to x,
never lower), measured at 31 of 82 leaks closed for 0 false alarms on
the 2026-09-20 exam and 86 of 305 for 9 under leave-one-vendor-out on
the combined set (ratio 9.56, just under the bar of 10). It is
pending against the bar, not adopted; its next number comes from a
fresh exam per D24. Under D88 (2026-09-22) Jev may also lower x to w
on the D87 POST floor rows only, at t=0.10 (lower only when Jev is at
least 90% sure the row is w; user ruling 2026-09-22); measured on the tuning set at t=0.10 as 8 new leaks for 796 rows
fixed, flow 94.2% exact / 1.1% leaks / 4.7% over-tight (learnings,
"Jev lowers the D87 POST floor").

## Problem & goal

The -02 draft
(`justabit:ietf/v3/docs/draft-hamr-oauth-agent-delegation-02.xml`, anchor
`classification`) defines two ways a request's `actionClass` gets
decided. Under `classSource` **method**, the class comes from the HTTP
method alone: GET, HEAD, and OPTIONS default to `r`; PUT and DELETE
default to `w`; POST and PATCH default to `x` (lines 810-816). Under
`classSource` **declared**, a Resource Owner publishes a JWS-signed menu
(anchor `declared-menu`) naming each operation's class explicitly, and
where that menu verifies and matches, "the declared value alone governs,
replacing the method default rather than being compared against it"
(lines 826-830). (docs/archive/prd.md:10-21)

The method default is a reliable floor in one direction and not the
other. The 2026-09-01 CAMARA catalogue survey in the other repo
(`justabit:ietf/v3/poc/spike-a/`, 292 operations across 60 repositories)
found zero operations judged `x` behind a safe method — the leak
direction is closed. But 57 of 138 POST operations are named as reads
(`retrieve-`, `check-`, `verify-`, `status-`prefixed — the exact
predicate catalogue this project targets: SimSwap `/check`,
NumberVerification `/verify`, `retrieve-location`, KYC match), and every
one classes as `x` under `classSource` method, because POST defaults to
`x` regardless of what the operation actually does.
(docs/archive/prd.md:22-31)

The declared menu already exists in the spec to fix this. The
bottleneck is that nobody wants to hand-classify hundreds of operations
across dozens of repositories to author the menu in the first place.
(docs/archive/prd.md:33-35)

**rwxmap is the author's own tool, first.** It reads an OpenAPI document
and draws a map of which operation is `r`, `w`, or `x`, so an agent, a
guard, a harness, or a classic workflow knows what a call does before it
is made, and so a mechanical arbiter outside the auth agent can see what
agents do. It is a discovery tool, not a proof. It also serves as a
supporting proof-of-concept for -02's actionClass axis and declared
menu, but it is **not load-bearing** for that draft or for any CAMARA
filing — it may ship imperfect. It is also useful on its own as a
stopgap "upfront" map when an API owner is slow to publish a declared
menu, or has none. (docs/archive/prd.md:37-48)

## Out of scope

- A model/LLM tier in the core. The deterministic flow is the product
  and works fully on its own. The optional tier was measured
  (D82/D83) and under D88 may both raise w to x and lower x to w on
  wordless floor rows; it stays outside the core.
- A default of `r`, or any guess path.
- Signing. Output stops at a candidate map; a signature is the Resource
  Owner's act.
- Anything normative in an Internet-Draft.
- A third standards track.
- A mandated conformance harness.
- A CLI, packaging, or UI before M3 passes.
- A claim of coverage beyond the vendors actually measured.

(docs/archive/prd.md:133-145)

For the module ladder that M3 refers to, see the
[module ladder page](../wiki/module-ladder-and-shape.md).

## The safety spine

Output classes are `r < w < x`, per the -02 axis-registry ordering
(anchor `action-class-values`: "actionClass is an ordered enumeration
with three values, r, w, and x, ranked r < w < x"). (docs/archive/prd.md:478-480)

When the tool does not know, or when its confidence is below the set
line, **the answer is the tighter class.** The tool never loosens
without evidence. Defaulting to `r` would be fail-open and a security
hole: `r` is the least restrictive class on the actionClass axis, so a
delegation restricted to reads would admit whatever operation the
classifier guessed wrong on — including a destructive one.
(docs/archive/prd.md:482-487)

This changes the outline's framing. The outline said "omit the
operation" — that was right for a signed menu a Resource Owner authors,
and is still what a verifier does per the -02 quotes above (on any menu
failure, or on no menu at all, "the verifier MUST fall back to the
method default," and "A verifier MUST NOT construct or synthesize a
menu entry ... on behalf of a resource owner that has not published
one," anchor `classification`, lines 826-827, 837-839). rwxmap's
consumers are agents and guards that need an answer for every
operation, not a verifier consuming a signed menu, so rwxmap answers
with the tightest class instead of omitting. Both are the same rule: no
loosening without evidence. (docs/archive/prd.md:489-499)

Two error directions, counted and reported separately, never collapsed
into one accuracy number:

- **Over-classification — "too tight"**, the word the README and the
  published `review` hint use — a rule proposes a class stricter than
  the operation's actual behavior warrants. Cost: usability. A Resource
  Owner who signs an over-classified menu makes their own catalogue
  harder to delegate against than it needs to be.
- **Under-classification — "too loose"**, the README's word for the
  same thing — a rule proposes a class looser than the operation's
  actual behavior warrants. Cost: security. This is the
  failure the safety spine exists to keep out of the trust path.

(docs/archive/prd.md:501-510)

A single accuracy figure hides the one that matters. Report both
counts, every time, as justabit's `docs/logs/findings.md` already does
for leak-direction and usability findings. This repo's own log starts
at M4. (docs/archive/prd.md:512-514)

For the module that produces these counts and the go/no-go gate built
on them, see the [module ladder page](../wiki/module-ladder-and-shape.md)
and the [go/no-go gate page](../logs/gate-and-m0-results.md).

## Direction

Both directions are in scope. The tool proposes loosening (POST → `r`
or `w`) and tightening (DELETE or PUT → `x` when the verb says
destructive, e.g. `terminateCall`). For the -02 story this means "a
menu replaces the method default in both directions," not only "fixes
POST over-classification." Whether tightening becomes part of the -02
argument or stays a demonstration is open — see Open questions below —
and depends on how many tighten cases M0 finds. (docs/archive/prd.md:518-527)

This is D4; see the [decisions log](../wiki/decisions-log.md) for the
full ruling record.

## The output shape (agreed 2026-09-17, D76)

rwxmap does not publish a format for anyone to adopt. It keeps one small
map of its own and fills the slot that each existing standard already
leaves open for other people's data. Four carriers, one map, no new
standards track — which is the same commitment CLAUDE.md makes about the
draft: this is not a third standards track.

The standards below were fetched and read on 2026-09-17, not recalled.
Field names, defaults and schema constraints MUST be re-checked against
the targeted revision before anything emits, because all four are moving.

### The map (the one file rwxmap owns)

One row per operation, keyed by method + path + operationId, carrying
four fields:

```json
{
  "rwxmapVersion": "0.1",
  "source": "stripe/spec3.json",
  "operations": [
    { "method": "GET",    "path": "/v1/customers/{customer}", "operationId": "GetCustomersCustomer",
      "class": "r", "destructive": false, "evidence": "floor", "review": "settled" },
    { "method": "POST",   "path": "/v1/customers/{customer}", "operationId": "PostCustomersCustomer",
      "class": "w", "destructive": false, "evidence": "list",  "review": "settled" },
    { "method": "DELETE", "path": "/rest/api/2/filter/{id}/permission/{permissionId}", "operationId": "deleteSharePermission",
      "class": "x", "destructive": true,  "evidence": "floor", "review": "settled" },
    { "method": "POST",   "path": "/chat/completions", "operationId": "createChatCompletion",
      "class": "x", "destructive": false, "evidence": "floor", "review": "tight" }
  ]
}
```

All four rows are real corpus rows from
`data/provider-corpus-2026-09-16/`, carrying what the tool actually
emits for them today. Under D86 `destructive: true` always coincides
with `class: x`, as the third row already shows.

`evidence` has exactly three values and they are the same evidence axis
the internal sheet records:

- `list` — a word list fired. The tool read a word and claimed the row
  on evidence. 343 of the 4171 corpus rows, 98.3% right.
- `floor` — no word matched; only the HTTP method was known, and the
  class is that method's default. 3828 rows, 93.9% right, and the
  honesty flag the project already measured: every one of the 55 leaks
  that fired no word, and all 186 over-tight rows, are `floor` rows.
- `jev` — the optional model tier moved the row (D88/D95). It appears
  only when the tier ran; the mechanical core emits `list` and `floor`
  only.

The fourth row above is a `floor` row from step 3's leftover pile and
it is wrong: `createChatCompletion` is truth `r`, called `x` because
nothing spoke for it. Showing it is the point — `evidence: "floor"` is
how a consumer sees that for itself.

What the map does NOT carry: the rule name (`method-floor`,
`modify-verb-summary`, `raise-word`, …) and the specific word that
matched. Those are rwxmap's internal vocabulary, they live in the
debugging sheet `run-proof/step3.csv` alongside truth and the `matched`
column, and they are deliberately unpublished — an adopter cannot act
on them, and publishing them would freeze this project's own naming
into someone else's contract.

There is no `confident` field, and `evidence` is not one either (D101).
It answers "did a word fire", which is a fact about the implementation,
not a reading of how likely the row is wrong — measured on the M3 exam,
`floor` is the CLEANEST bucket of the three (5.6% error) and `list` the
dirtiest (23.3%), because `floor` is mostly GET rows. The signal an
adopter can act on is the review hint below.

`destructive` was D28's separate axis; under D86 it is a refinement
flag inside x — `destructive: true` ⇒ `class: x`, always, while an x
row need not be destructive — derived from the method and the lead
verb. `class` is `r < w < x` per the one invariant.

### The review hint (D101)

The map carries a second signal beside `evidence`, answering the
question an adopter can actually act on: "should I look at this row?"
It is derived from fields already published — method, `class` and the
evidence source — and asserts nothing new about confidence.

- `tight` — `class: x` on a POST. Likely tighter than needed, and safe
  to review: no leak was observed in this bucket on either set.
- `loose` — `class: w` on a PUT or PATCH decided by the method floor.
  This is where most of the danger lives.
- `settled` — everything else. It is NOT a signed or human-confirmed
  state; it means "neither of the other two". A genuinely signed state
  would be a fourth value only a human writes after the export, and
  rwxmap will never emit it, because signing is the Resource Owner's
  act.

The three values partition a provider's whole corpus: every row gets
exactly one. `review` is published into rwxmap's own map, into the
sidecar, and — since D103 (2026-09-24) — into the bareguard gate file
as a tool entry's `marker`, the object form `{ "letter": "w",
"marker": "loose" }`. The bare letter stays legal there forever.

Measured on the 8376-row tuning pool (82 leaks, 1566 over-tight):

| hint | rows | leaks | over-tight |
|---|---|---|---|
| tight | 2116 (25%) | 0 (0%) | 1524 (97%) |
| loose | 1657 (20%) | 55 (67%) | 1 (0%) |
| settled | 4603 (55%) | 27 (33%) | 41 (3%) |

And on the M3 exam, 4279 rows (34 leaks, 725 over-tight) — a read of a
burned exam, not a score:

| hint | rows | leaks | over-tight |
|---|---|---|---|
| tight | 835 (20%) | 0 (0%) | 710 (98%) |
| loose | 724 (17%) | 26 (76%) | 2 (0%) |
| settled | 2720 (64%) | 8 (24%) | 13 (2%) |

A provider reviews the `tight` fifth of their API and can only improve
it; they review the `loose` fifth and that is where three quarters of
the danger is; the remaining roughly 60% can be left alone.

The word lists stay. A no-lists arm — the bare method floor — scores
6191 exact (73.9%) / 75 leaks / 2110 over-tight on the tuning pool
against 6728 (80.3%) / 82 / 1566 with lists, and 3469 (81.1%) / 34 /
776 on the M3 exam against 3520 (82.3%) / 34 / 725. Dropping every list
costs 537 exact rows on tuning to save 7 leaks, and on the exam saves
no leaks at all while costing 51 rows.

Caveat, stated plainly: the hint's rule was read off the M3 exam's own
buckets, so its numbers on that exam are FITTED, not a clean
generalization figure. It reproduces on the tuning pool, which is
independent of the exam, and that is the stronger of the two readings —
but the rule is unproven until a fresh exam.

### Carrier 1 — OpenAPI, per operation

OpenAPI allows `x-` extension keys on any object, including an
operation. rwxmap reads these files already; it writes back into the
same file it read:

```yaml
/v1/accounts/{account}:
  delete:
    operationId: DeleteAccountsAccount
    x-rwx:
      class: x
      destructive: true
      evidence: floor
      review: settled
```

### Carrier 2 — MCP, per tool

Two slots, both the spec's own: the `annotations` object for MCP's own
hints, and `_meta` for rwxmap's fields — the MCP 2026-07-28
specification names `_meta` as the extension slot and reverse-DNS key
prefixes as the convention there (prefixes whose second label is
`modelcontextprotocol` or `mcp` are reserved).

**Hints are matched best-effort, not one-to-one (D102).** MCP's four
hint booleans and rwxmap's fields are not the same axes, so rwxmap
fills the ones it can determine and emits nothing at all for the rest.
Leaving a hint out is safe by this project's own invariant, because an
MCP consumer defaults an omitted hint to the tightest reading.

- `readOnlyHint` — emitted. True when `class` is `r`, false otherwise.
- `destructiveHint` — emitted. It is rwxmap's `destructive`, which
  always sits inside `class: x`.
- `idempotentHint` — not emitted. Idempotency cannot be read off a
  spec: where it appears at all it is a retry capability the caller
  may use, not a declaration about the operation (see the MCP hints
  entry under Open questions).
- `openWorldHint` — not emitted. There is no evidence source for it
  (D87).

In `_meta` rwxmap publishes three of its four fields — `class`,
`destructive` and `evidence`. `review` is NOT published to MCP
(D102): it is a provider's build-time worklist, not something an agent
needs at call time, and publishing it invites a consumer to read it as
a confidence score, which it is not (D101). It goes in the exporter's
sidecar report instead.

**OPEN QUESTION — `review` in MCP.** D102 keeps the marker out of MCP,
while D103 puts it into the bareguard gate file, which is a runtime
consumer. Whether MCP should carry it too is unresolved and needs the
user's ruling.

```json
{ "name": "delete_share_permission",
  "annotations": { "readOnlyHint": false, "destructiveHint": true },
  "_meta": { "io.github.hamr0.rwxmap/class": "x",
             "io.github.hamr0.rwxmap/destructive": true,
             "io.github.hamr0.rwxmap/evidence": "floor" } }
```

### Carrier 3 — WebMCP, per tool

WebMCP (W3C Web Machine Learning Community Group, Draft Community Group
Report of 2026-04-23) has a page hand tools to the agent through
`navigator.modelContext`. Its `ToolAnnotations` dictionary is NOT MCP's
four; as read on 2026-09-17 it is `readOnlyHint`, `untrustedContentHint`,
`consequentialHint` and `debugging`, and the IDL admits defined members
only — no `_meta`, no extension slot. Nothing custom is needed, because
the two flags that matter carry all three classes with nothing left
over:

| class | `readOnlyHint` | `consequentialHint` |
|---|---|---|
| `r` | true | false |
| `w` | false | false |
| `x` | false | true |

`consequentialHint` is a closer fit to this project's `x` (cannot be
undone, D87) than any MCP hint is: MCP's
`destructiveHint` was measured and rejected as a reading of the class
(D28), and `idempotentHint` cannot be read off the specs at all. This
makes WebMCP the carrier where the r/w/x ladder maps cleanly, and it
raises the value of step 3 — `consequentialHint` IS the x step.

```js
navigator.modelContext.registerTool({
  name: "delete_account",
  annotations: { readOnlyHint: false, consequentialHint: true },
  execute: /* ... */
});
```

### Carrier 4 — Agentic Resource Discovery, per domain

ARD (Google and ten others, published 2026-06-17) has a domain serve
`/.well-known/ai-catalog.json` with `specVersion`, `host` and `entries`,
one entry per whole resource — an MCP server, an A2A agent, an OpenAPI
document.

Per-operation data cannot go inside an entry, and this is a schema fact,
not a preference: the published entry schema sets
`additionalProperties: false`, there is no `x-` support and no
extensions object, and the one free slot, `metadata`, takes flat
key-value pairs whose values are limited to string, number, boolean or
null. A map of 1309 operations does not fit in a flat scalar.

So the map is its own resource with its own URL, listed beside the
OpenAPI document it describes:

```json
{ "identifier": "urn:stripe:rwxmap",
  "displayName": "Stripe API — rwx map",
  "type": "application/vnd.rwxmap+json",
  "url": "https://stripe.com/.well-known/rwxmap.json",
  "metadata": { "rwxmapVersion": "0.1", "operations": 1309 } }
```

### What this means for the work

- rwxmap is a **build-time annotator**, not a runtime component. It runs
  once over a spec and produces the map; the map feeds whichever carrier
  the Resource Owner publishes. This keeps signing the Resource Owner's
  act, per Out of scope.
- Only two of the four slots are rwxmap's own: OpenAPI's `x-rwx` and
  MCP's `_meta` keys. In the other two it sets fields the spec already
  defines.
- What is shippable today is unchanged by this decision: `readOnlyHint`
  (and therefore WebMCP's `readOnlyHint`) is ready at 3 unsafe-wrong
  rows in 4171 (0.07%); `consequentialHint` follows directly from the
  class, since WebMCP's two flags carry r/w/x with nothing left over
  (carrier 3 above). Neither waits on step 3 any longer — it is built
  (D78) and the classifier has graduated to `src/` (D79).
  `idempotentHint` is not emitted at all (D102): idempotency cannot be
  read off a spec, and a hint rwxmap cannot determine is left out
  rather than guessed.
- The four carriers are an output contract, not code. Step 3 is now
  built (D78) and the classifier has graduated to `src/` (D79), but
  nothing emits yet: the emitter is the next pass, and the
  input-adapter question under Open questions stays open.

## Open questions

Non-blocking; never silently assumed.

- The last mile: can a model read what words cannot? Partly, and not
  enough to decide a class. TypeSafe Jev was measured three times. On
  the build set, as a raise over the 1113 rows the flow calls w, it
  closed 51 of 147 leaks for 1 false alarm fitted and 43 for 1 under
  leave-one-vendor-out. On the 2026-09-20 clean exam, scored once, it
  closed 31 of 82 flow leaks for 0 false alarms, taking leaks from 82
  to 51 of 1003 rows with over-tight unchanged at 80. On the combined
  6557-row set, over the 2335 rows step 2 decides, it closes 86 of 305
  leaks for 9 false alarms under leave-one-vendor-out with the
  bar-of-10 selection (ratio 9.56, just under the bar). It raises; it
  cannot replace: alone it leaks 893 of 6557 rows (13.6%) on the
  combined set and 207 of 1003 (20.6%) on the exam, mostly POST
  creates called w. The answer given 2026-09-21 by D84 (Jev only orders
  a review queue) is withdrawn 2026-09-22 by D85: Jev stands as the
  D82/D83 optional raise-only tier, pending against the bar of 10.
  Raised 2026-09-19.
- Is the POST floor (x) wrong? No — on the 4171-row provider corpus of
  15 complete official APIs the POST floor holds: truth x is 61%
  (804 of 1309), close to the old corpus's 62%, not to exam 5's 23%;
  the inversion recorded 2026-09-14/15 is now read as a property of
  exam 5's draw (89 vendors, median 1 POST row each, drawn from
  APIs.guru fragments) rather than of POST itself. How a POST row
  reaches w is no longer open either: step 2 (`src/step2.js`) answers it
  with a modify verb plus the `OTHER_PARTY` block, reaching 227 of the
  380 truth-w POST rows, against zero before. What stays open is the
  remaining 153 POST rows that never get off the `x` floor, and step
  3: the 66 PUT / DELETE / PATCH rows sitting on step 2's method floor
  at `w` that are truth `x`, which are 93% of step 2's leaks and the
  only dangerous part of the tool's error. See list item 2 of "The new
  core" above and `docs/logs/learnings.md`. Raised 2026-09-14, updated
  2026-09-15, updated 2026-09-16 with the provider-corpus read,
  updated 2026-09-16 when step 2 was built. The D84 answer of
  2026-09-21 is withdrawn by D85 (2026-09-22); the POST floor stays x,
  published with `evidence: floor`, unchanged.
- Can the "I don't know" pile be shrunk by reading the description?
  Answer so far: no — mining the yours list from description text
  resolves at best 130 of 1972 rows (6.6%) and leaks 8; the safe
  settings clear 2-5%. Rejected 2026-09-16, POC kept at
  `poc/desc-yours/`. The pile stays as the flag because it holds 155
  of 204 leaks. D84's answer of 2026-09-21 (publish the pile as x) is
  withdrawn 2026-09-22 by D85: the pile keeps its best-guess class,
  marked `evidence: floor`, and the consumer's policy asks about it
  once per operation.
- MCP hints (answered 2026-09-24 by D102; the user's end goal is to
  feed them). Nothing emits hints yet — the exporter is unbuilt — but
  the shape is settled. Hints are matched BEST-EFFORT, not one-to-one:
  MCP's four booleans and rwxmap's fields are not the same axes, so
  rwxmap emits `readOnlyHint` (from `class`) and `destructiveHint`
  (from `destructive`), and emits nothing at all for a hint it cannot
  determine. That is safe because an MCP consumer defaults an omitted
  hint to the tightest reading — `readOnlyHint` false,
  `destructiveHint` true, `idempotentHint` false, `openWorldHint`
  true — so partial emission cannot loosen anything. The full shape,
  including what goes in `_meta` and why `review` stays out of MCP, is
  in "Carrier 2 — MCP, per tool" above. These annotation names and
  defaults are from the MCP spec **as recalled, not from a fetched
  copy**, and must be checked against the exact spec revision targeted
  before anything emits.
  - `readOnlyHint`: **the one that is ready.** True when the class is
    `r`; GET follows its `r` floor (D59). On the 4171-row provider
    corpus, 2052 rows, 3 wrong in the unsafe direction (0.07% of all
    4171 rows, 0.15% of the trues) — the three being the known
    low-confidence GET rows `datadog GetGraphSnapshot` and `intercom
    listContactBanners` plus one more. 33 further rows are marked
    not-read-only when they are read-only, which is the too-tight
    direction.
  - `destructiveHint`: rwxmap's `destructive` field, a refinement flag
    inside x under D86 (`destructive` ⇒ x, but x does not ⇒
    `destructive`), derived from method plus lead verb. D28 rejected
    the cruder reading `destructiveHint = (class == x)`, wrong on 352
    of 719 rows, and the broader "every non-`r` row is destructive"
    was measured on the provider corpus and rejected too: it would
    mark all 2119 non-`r` rows destructive, but only 584 of them
    (27.6%) carry any wrecking signal at all — a DELETE method, or a
    verb such as delete / remove / purge / revoke / expire / void /
    archive — while 1535 (72.4%) destroy nothing, being creates,
    updates, sends and publishes. That reading is identical to the MCP
    default and therefore emits no information. The useful signal is
    the inverse: which of the non-reads are NOT destructive.
  - `idempotentHint`: **not emitted (D102).** Idempotency cannot be
    read off the specs. Measured across all 15 provider specs: 11 of
    the 15 never mention idempotency at all. The four that do are
    paypal (103 mentions), square (16), openai (6) and intercom (1),
    and even there it is prose in descriptions plus an
    `Idempotency-Key` / `PayPal-Request-Id` request header, not a
    machine-readable property. That header is a *capability* — the API
    offering to make retries safe if the caller supplies a key — not a
    declaration that the operation is idempotent. It cannot be
    measured honestly on 4 vendors, so rwxmap says nothing and the
    consumer's tight default (false) stands. The two candidate
    readings — from the class, or from the method per RFC 9110 §9.2.2
    — are recorded in `docs/logs/learnings.md`; neither is adopted.
  - `openWorldHint`: **the one still open.** No signal; MCP default
    `true` and rwxmap emits nothing. Closed as a class question
    2026-09-22 (D87): this is the slot "touches others" would map to,
    it left the class, and it may yet return as an evidence-only flag
    next to `destructive`, never emitted as false. It is absent today
    because there is no evidence source. What stays open is whether
    such an evidence source is ever found.
- Closed 2026-09-17 (D76): the output file format. rwxmap keeps one map
  of its own, one row per operation, and publishes nothing of its own —
  it fills the extension slot each existing standard already leaves
  open: OpenAPI's `x-rwx` per operation, MCP's `annotations` plus a
  reverse-DNS `_meta` key per tool, WebMCP's `readOnlyHint` /
  `consequentialHint` per tool, and one Agentic Resource Discovery
  `ai-catalog.json` entry per domain pointing at the map file. See
  "The output shape" above. This supersedes the archived bullet below
  that offered the -02 declared menu's `{iss, menu}` shape or rwxmap's
  own JSON with a converter.
- Whether tightening enters the -02 argument, or stays a demonstration
  (D4, M4).
- The exact confidence formula and line — M0 finds it.
- The output file format: the -02 declared menu's `{iss, menu}` shape
  (anchor `declared-menu`), or rwxmap's own JSON with a converter.
- The GitHub remote is `hamr0/rwxmap`; visibility (public with a WIP
  marker, like the author's other repos, or private) is decided at the
  first push.
- Whether the -02 draft's definition of `x` is amended to name
  consequence in the test and not only in the label. This is rwxmap's
  first finding with a consequence for the draft text, and it belongs
  to the justabit track to accept or reject.
- Input adapters beyond OpenAPI. The arbiter is a function of a method,
  a name, and a text; GraphQL (`query` vs `mutation`), gRPC/AIP custom
  methods, AsyncAPI, and MCP tool lists can each feed those three
  through a small adapter, with the method empty where the format has
  none. Deferred until the output contract exists; the MCP tool-list
  adapter is the strongest candidate to go first.
- The three questions opened on 2026-09-07 — the `x` definition, the
  DELETE/PUT default, and the gate's treatment of low-confidence rows —
  were decided the same day; see D20, D21 and D22 in the decisions log.
- Preflight against a mock: run an agent against a mock server built
  from the OpenAPI file (e.g. Prism), record which operations it
  reaches for, look each up in the map, and show the x calls before any
  token is issued. HTTP has no dry run; vendor test modes exist for
  some APIs only. Raised by the user 2026-09-07; a later module, not
  M1.
- Closed 2026-09-07 (D31): queryAssistant is truth `r`; ask-an-assistant
  reads back an answer and reaches no one. It is not a negative
  control.
- Closed 2026-09-22 (D86): the ordered r < w < x scale holds because
  `destructive` is no longer a separate axis — `destructive: true` ⇒
  `x`, and it is a refinement flag inside x. A consumer wanting "`x`,
  non-destructive only" says so in bareguard as a grant of `r-x` plus
  a `flags.type: deny` rule on the destructive action, in bareguard's
  gate config, separate from the letters in `bareguard.rwx.json` —
  the exporter never emits that rule, only a labelled suggestion in
  the sidecar; the scale itself needs no new word (D91). Raised
  2026-09-07.
- Closed 2026-09-07 (D32): a read whose result arrives by callback is
  `r`; the caller named the sink, so it reaches no one else. Callbacks
  raise only when the lead verb is not a read (M1-C7).
- Which structural fields qualify for a rule, per set, by the user's
  criterion "present consistently or almost always"? Answered by the
  M1 census, pending 2026-09-07.
- Truth re-read owed (raised by M1-C9/C10): the judge names the E24
  arguable rows and three GitHub rows (repos/delete,
  issues/set-issue-field-values, issues/remove-sub-issue) as the only
  leaks that block the summary-verb source. The user re-reads; nothing
  is re-labelled by the tool.
- Over-tight rows are a usability cost invisible to humans at run time;
  how a consumer surfaces or overrides them is open.
- Closed 2026-09-08 (D35): the no-text tighten rule (Rule A) is
  adopted — a PUT/DELETE/PATCH with no summary and no description ->
  x, marked no-text. Hold-out 3 became a tuning set to decide it;
  hold-out 4 is the new clean exam.
- Owner-declared notify flags (e.g. x-github.triggersNotification:
  true) as a raise-only step: zero leaks, tiny coverage; admit as an
  exact vendor-key list?

(docs/archive/prd.md:528-586)

For the decisions named above (D4, D20-D22, D31, D32, D35) and any
decision numbers not yet resolved here, see the
[decisions log page](../wiki/decisions-log.md).
For the module numbers (M0-M4) referenced throughout, see the
[module ladder page](../wiki/module-ladder-and-shape.md). For the
arbiter's shape and rules (e.g. Rule A, the summary-verb source), see
the [arbiter shape page](../wiki/module-ladder-and-shape.md).
