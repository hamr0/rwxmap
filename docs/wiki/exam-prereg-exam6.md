# Pre-registration (DRAFT): clean exam #6, rwxmap 0.11.0 as shipped

**Status: DRAFT, written 2026-11-08. Truth built, sha256 committed. Not scored.**
Inputs are frozen (see Rows). No classifier, rwxlite, Jev or CLI has been run on any
exam #6 spec or row; no letter exists for these rows.

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
