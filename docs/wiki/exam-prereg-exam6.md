# Pre-registration (DRAFT): clean exam #6, rwxmap 0.11.0 as shipped

**Status: SCORED and BURNED (2026-11-08).** See "Results and findings" at the end.
The text below is the pre-registration as it stood before scoring (written
2026-11-08; inputs frozen, see Rows; no classifier, rwxlite, Jev or CLI had been run
on any exam #6 row).

## The question

What does rwxmap 0.11.0 score, as shipped, on five complete official APIs that
no labelled set has seen?

This is a measurement only. There is no candidate, no gate and no code change.
The result is published in the README whatever it is.

## Rows

Frozen in commit b26c68d.
`data/exam6-2026-11-08/ops.csv`, 1588 operations, sha256
`4a4854fad8bd1a3fdc57ff23bb3e9c6eb7d0ab7dc8d5f1d7947c87b0b346233d`
(`ops.csv.sha256`; two runs of `build-ops.mjs` gave the same bytes). Specs are
each vendor's own official OpenAPI, original bytes,
`data/exam6-2026-11-08/specs/` (hashes and pins in `sources.json`). GitHub specs
were fetched at the pinned commit SHA; cloudsmith comes from its vendor API host
(sha256 pin only, the URL is live and mutable). Every fetched sha256 equalled the
shortlist's `results.json` (`poc/exam6-shortlist/`).

| vendor | provider in ops.csv | operations |
|---|---|---|
| grafana | grafana.com | 314 |
| nocodb | nocodb.com | 279 |
| radarr | radarr.video | 240 |
| cloudsmith | cloudsmith.io | 376 |
| invoiceninja | invoiceninja.com | 379 |
| total | | 1588 |

The shortlist counted 1,587 deduped ops; the exam keeps raw ops (uniqueness on
provider, METHOD, raw path, as exam #5), and nocodb has one collapsed-param pair
(279 raw, 278 deduped). radarr.video is the user's choice; the radarr spec names
no host or contact.

Denominator for every percentage: 1588 rows. Asked or undecided rows are scored
as x.

Leakage check. poc/exam6-shortlist checked the candidates against the excluded
vendor names (provider names and brand aliases) plus a raw text grep; the hits
were mentions inside other vendors' specs, listed in
`poc/exam6-shortlist/shortlist.md`. It does not cover rwxlite's training rows at
the op level.

## Labelling (truth)

- Brief: `data/relabel-v4-2026-11-05/BRIEF-v4.md` verbatim, no edits. sha256
  `f8add85988a382ff5770c3af28fb048b82099392cb456f17dcc1e79277f57cbd`
  (checked equal on 2026-11-08). Truth is v4 truth (D137 x).
- Labellers A and B are both Sonnet (user ruling 2026-11-08). This departs from
  exams #3 to #5 (Sonnet + Opus). Both are blind, label every row, use no
  scripts, and read every description in full.
- Each labeller file is validated directly (`labelling/validate.mjs`: header, row
  order, classes, confidence, distinct-reason count), as exam #5. A scripted pass
  shows as few distinct reasons and is rejected into `labelling/rejected/` and
  relabelled by a new labeller.
- The user rules every disagreement (`labelling/rulings.csv`, each with its A and
  B labels and a reason). Jev is never used.
- Custody is as exam #5: `truth.csv` and `labelling/out/` stay out of git until
  both sides have scored, and only their sha256 are committed. Blind parts are in
  `labelling/blind/` (`split.mjs`).
- `truth.csv` sha256: **cc4c22c5130c118a46a144b6650f8d7ee123363a74aa35c01b170fd83c48a183**
  (`truth.csv.sha256`). Built by `labelling/build-truth.mjs` from the 10
  labeller files and `labelling/rulings.csv`; two runs gave the same sha.
- Measured facts: 10 labeller files (A and B, both Sonnet, for each of the 5
  vendors), all validated directly. Distinct reasons per file: A grafana 258,
  nocodb 217, radarr 99, cloudsmith 163, invoiceninja 86; B grafana 246, nocodb
  158, radarr 38, cloudsmith 111, invoiceninja 83. Each labeller's transcript
  showed it opened only the brief, its blind part and its own output. A and B
  agree on 1564 of 1588 rows (98.5%). Disagreements per vendor: nocodb 8,
  grafana 6, cloudsmith 5, invoiceninja 5, radarr 0. Radarr's A and B agreed on
  all 240 rows; radarr has no operationId, summary or description, so its labels
  rest on method and path. The user ruled all 24 on 2026-11-08, in pattern
  groups (G1 to G5 plus five one-offs; `labelling/rulings.csv`, each row with
  its A and B labels and a note). 21 were ruled x and 3 were ruled w: ex6-0358,
  ex6-0402 and ex6-1256. Truth classes: r 757, w 425, x 406 (N = 1588).

## Code under test

rwxmap 0.11.0 exactly as shipped (mechanical v4, D138; rwxlite 0.3.1 fp32 at cut
0.90, D139). No candidate and no change.

- `rwxmap@0.11.0` installed from the npm registry (tag v0.11.0, commit
  `feff27a7269c99e7931eee879cdc62153a3889ff`; the registry's gitHead is the same
  commit) into an empty scratch folder, with an empty HOME and no `.env`.
- `rwxlite@0.3.1` from npm. The model is downloaded from the GitHub release
  v0.3.1 into an empty cache. fp32 model string `rwxlite-0.3.1+bbe1997d`; fp32
  model sha256 `bbe1997d43020724f9eab9e42e8f6337e9640fe46f764b6fceac1eb1d000a3cf`.
- Refusal rule: before scoring, a run's output must show `rwxlite: on
  (rwxlite-0.3.1+bbe1997d)` on the engine line and `rwxmapVersion` 0.11.0 in the
  combined JSON. Otherwise the scorer refuses and nothing is scored.
- Nothing under `src/` is changed in the repo for this exam.

## Configs

Each runs the real CLI on each of the 5 specs, from a scratch folder with no
`.env`, and the scorer joins every operation to `ops.csv` by (provider, METHOD,
path), 1:1, as exam #5.

| config | flags | role |
|---|---|---|
| mech | `--engine mechanical` | reference |
| a | (default, mode a) | the headline |
| b95 | `--engine rwxlite` (default confidence 95) | reported only |

Jev (mode c) is not scored (paid).

## Output

Per config: exact, loose-1, loose-2, too loose (loose-1 + loose-2) and too tight,
each as a count and a share of 1588, per vendor and per method. Every too-loose
row is listed with its marker. Too loose and too tight are never folded into one
number. For mode a the rwxlite sent / raised / lowered / kept / undecided counts
are printed.

## Bars

None. This is a measurement. Reported only, the D133 mode a bar: a has too loose
<= mech's, and exact >= mech's exact + 5.0 points, that is ceil(0.05 x 1588) = 80
more exact rows (79.4 rounded up).

## Order

1. This prereg is committed.
2. Truth is built and its sha256 is committed (written into this file).
3. Scored once.
4. Results go to `docs/logs/learnings.md`, the README and the PRD. A rerun is
   allowed only for a crash or a join bug, recorded with the reason. No change
   of code, rule, model, cut or text after any prediction exists.

## Burn rule

As exam #5: once scored, exam #6 is burned. Its truth is never edited, and any
rule change afterwards needs a new exam.

## Known limits

- Both labellers are the same model family, so they are less independent than
  Sonnet + Opus. Agreement shows consistency, not truth.
- Labels are model labels, then the user's rulings, not authoritative truth.
- radarr has no operationId and no summary on any of its 240 ops.
- Four of the five specs (grafana, nocodb, radarr, invoiceninja) are generated
  from code; cloudsmith is served from its live API host.
- The leakage check covers provider names plus a raw text grep; the hits were
  mentions inside other vendors' specs (see `poc/exam6-shortlist/shortlist.md`).
- Selection was by row count and domain spread from a shortlist, not random.
- A one-row gap is decided by the written rule, not by a significance test.

## Results and findings (after scoring, 2026-11-08)

Source: `data/exam6-2026-11-08/score/score.txt` and `rows-{mech,a,b95}.csv`.

### Run facts

- Scorer run 2026-11-08T20:19:30Z, exit 0.
- rwxmap 0.11.0 and rwxlite 0.3.1 installed from npm into an empty folder. Model string seen: rwxlite-0.3.1+bbe1997d.
- truth.csv sha256 cc4c22c5...a183 verified before scoring. N 1588.
- Join for every config: matched 1588, unmatched ops 0, unmatched output 0, duplicate keys 0, skipped 0.
- Exam #6 is BURNED. It was scored once, with no candidate and no gate.

### Main table (of 1588)

| config | exact | loose-1 | loose-2 | too loose | too tight | rwxlite sent / raised / lowered / kept / undecided |
|---|---|---|---|---|---|---|
| mech | 1305 (82.2%) | 25 (1.6%) | 18 (1.1%) | 43 (2.7%) | 240 (15.1%) | none |
| a (default) | 1434 (90.3%) | 17 (1.1%) | 18 (1.1%) | 35 (2.2%) | 119 (7.5%) | 745 / 21 / 133 / 516 / 75 |
| b at 95 | 1288 (81.1%) | 7 (0.4%) | 6 (0.4%) | 13 (0.8%) | 287 (18.1%) | 1588 / 6 / 75 / 1090 / 417 |

Markers on the too-loose rows: mech 43 (tight 0, loose 29, settled 14); a 35 (tight 0, loose 21, settled 14); b95 13 (tight 0, loose 12, settled 1).

### By vendor (of the vendor's rows)

mech:

| vendor | rows | exact | too loose | too tight |
|---|---|---|---|---|
| cloudsmith.io | 376 | 300 (79.8%) | 4 (1.1%) | 72 (19.1%) |
| grafana.com | 314 | 267 (85.0%) | 15 (4.8%) | 32 (10.2%) |
| invoiceninja.com | 379 | 318 (83.9%) | 16 (4.2%) | 45 (11.9%) |
| nocodb.com | 279 | 209 (74.9%) | 5 (1.8%) | 65 (23.3%) |
| radarr.video | 240 | 211 (87.9%) | 3 (1.3%) | 26 (10.8%) |

a:

| vendor | rows | exact | too loose | too tight |
|---|---|---|---|---|
| cloudsmith.io | 376 | 345 (91.8%) | 4 (1.1%) | 27 (7.2%) |
| grafana.com | 314 | 285 (90.8%) | 9 (2.9%) | 20 (6.4%) |
| invoiceninja.com | 379 | 339 (89.4%) | 15 (4.0%) | 25 (6.6%) |
| nocodb.com | 279 | 254 (91.0%) | 4 (1.4%) | 21 (7.5%) |
| radarr.video | 240 | 211 (87.9%) | 3 (1.3%) | 26 (10.8%) |

b at 95:

| vendor | rows | exact | too loose | too tight |
|---|---|---|---|---|
| cloudsmith.io | 376 | 306 (81.4%) | 1 (0.3%) | 69 (18.4%) |
| grafana.com | 314 | 270 (86.0%) | 3 (1.0%) | 41 (13.1%) |
| invoiceninja.com | 379 | 266 (70.2%) | 7 (1.8%) | 106 (28.0%) |
| nocodb.com | 279 | 247 (88.5%) | 2 (0.7%) | 30 (10.8%) |
| radarr.video | 240 | 199 (82.9%) | 0 (0.0%) | 41 (17.1%) |

### By method (of the method's rows)

mech:

| method | rows | exact | too loose | too tight |
|---|---|---|---|---|
| DELETE | 177 | 174 (98.3%) | 0 (0.0%) | 3 (1.7%) |
| GET | 666 | 652 (97.9%) | 14 (2.1%) | 0 (0.0%) |
| PATCH | 90 | 75 (83.3%) | 7 (7.8%) | 8 (8.9%) |
| POST | 519 | 280 (53.9%) | 14 (2.7%) | 225 (43.4%) |
| PUT | 135 | 123 (91.1%) | 8 (5.9%) | 4 (3.0%) |

a:

| method | rows | exact | too loose | too tight |
|---|---|---|---|---|
| DELETE | 177 | 174 (98.3%) | 0 (0.0%) | 3 (1.7%) |
| GET | 666 | 652 (97.9%) | 14 (2.1%) | 0 (0.0%) |
| PATCH | 90 | 77 (85.6%) | 2 (2.2%) | 11 (12.2%) |
| POST | 519 | 408 (78.6%) | 15 (2.9%) | 96 (18.5%) |
| PUT | 135 | 122 (90.4%) | 4 (3.0%) | 9 (6.7%) |

b at 95:

| method | rows | exact | too loose | too tight |
|---|---|---|---|---|
| DELETE | 177 | 174 (98.3%) | 0 (0.0%) | 3 (1.7%) |
| GET | 666 | 610 (91.6%) | 1 (0.2%) | 55 (8.3%) |
| PATCH | 90 | 70 (77.8%) | 0 (0.0%) | 20 (22.2%) |
| POST | 519 | 336 (64.7%) | 11 (2.1%) | 172 (33.1%) |
| PUT | 135 | 98 (72.6%) | 1 (0.7%) | 36 (26.7%) |

(HEAD, 1 row, is exact in mech and a, and too tight in b at 95.)

### D133 mode a bar (reported only, no gate)

- Too loose: a 35 against mech 43. PASS.
- Exact: a 1434 against mech 1305 plus 80 (5 points of 1588, rounded up) = 1385. PASS.
- Both halves pass.

### Findings

- (a) Mode a against mech: 12 leaks closed and 4 opened, so too loose goes 43 - 12 + 4 = 35. Closed: cloudsmith privileges PATCH and PUT (ex6-0223, 0224); grafana ldap sync (0404), lbac teams (0498), org users POST (0543), orgs users POST (0557), orgs users PATCH (0560), sso-settings PATCH and PUT (0689, 0690); invoiceninja PUT invoices (0829); nocodb base user PATCH (1196) and users PATCH (1274). Opened: cloudsmith POST /orgs/{org}/services/ (0089) and POST geoip/disable (0215); grafana POST contact-points (0663); nocodb POST views show-all (1241, truth w, predicted r).
- (b) Loose-2 (x read as r) is 18 in both mech and a. The model did not change it. 13 are GET rows settled by the method floor, which the model never sees: invoiceninja 8 (six `/{id}/{action}` rows, webcron, claim_license), grafana 3 (`/logout/saml`, `/saml/slo`, `/snapshots-delete/{deleteKey}`), cloudsmith 1 (members remove), nocodb 1 (internal). The other 5 are POST rows lowered to r by read verbs, all invoiceninja: export, import_json, logout, bank_integrations refresh_accounts and remove_account. A 14th settled GET, grafana `/user/email/update`, is truth w, so it counts as loose-1.
- (c) Of the 35 leaks in mode a, 14 are settled GET rows and 21 carry a loose marker. None carries a tight marker.
- (d) Mode a closes most of the POST and PATCH too-tight pile: POST too tight 225 to 96 (of 519), PATCH leaks 7 to 2 (of 90). Radarr is unchanged (211 exact, 26 too tight): its spec has no operationIds or summaries, so the model had little to read, and mode a gives the same counts as mech on its 240 rows.
- (e) Mode b at 95 has the fewest leaks (13) and the most too-tight rows (287). It asks the model about every row, so 55 of 666 GET rows go too tight. It has no bar.
- (f) The GET get-action rule (logout, close, revoke; step 2) fired once on exam #6, radarr GET /logout, and was right.
- (g) Labeller agreement was 1564 of 1588 rows. Both labellers were Sonnet, so this shows consistency, not truth. The 24 disagreements were ruled by the user.

### GET ruling (user, 2026-11-08)

GET stays as is: r floor plus the raise-only get-action rule. Evidence given to the user: across every labelled set (six tuning sets 6,283 GET rows, exam #5 623, exam #6 666; 7,572 GET rows in all) the rule fired 7 times, caught 6 real x rows, and made 1 r row too tight (ory getOAuth2LogoutRequest). 24 GET leaks remain unmatched, across 11 vendors; 16 of them are invoiceninja 8, cloudflare 4 and grafana 4. "GET is always r" would add 6 leaks and remove 1 too-tight row, so it was rejected as fail-open. A vendor-specific word such as invoiceninja's `{action}` would fail leave-one-vendor-out.

Exam #6 is BURNED; any rule or model change needs exam #7.
