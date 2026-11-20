# Pre-registration: shared clean exam #7, rwxmap side (D142 next-model ship gate, round 15)

**Status: SCORED and BURNED (2026-11-20).** See "Results and findings" at the end.

Inputs are frozen in commit a1c31bf. No classifier has been run on any exam #7
row, with one exception: the mechanical lean (below), which is mechanical's own
verdict and is never shown to labellers. No CLI run, no rwxlite run and no Jev
run has touched an exam #7 row. No truth exists yet.

The exam answers two questions.

1. (D142, replacing the D135 gate for this exam) May rwxlite round 15 replace the shipped model (0.3.1) as the model
   rwxmap ships? It compares two models on the same rows. It is not a tuning
   round; nothing here is fitted to its own rows.
2. (D140) What does mode b at its new default confidence of 85 score on rows it
   never saw? Reported only, no bar.

## Rows

Frozen in commit a1c31bf: `data/exam7-2026-11-19/ops.csv`, 1579 operations,
sha256 `abe5e6cd410c72d0bee1b85948ccb12b7d898873f9cb032eb5d27bcd5e447ea3`
(`ops.csv.sha256`; `build-ops.mjs` is deterministic). Specs are each vendor's own
official OpenAPI, original bytes, gzipped, `data/exam7-2026-11-19/specs/` (hashes
and pins in `sources.json`). Vendors were frozen 2026-11-18
(`poc/exam7-shortlist/picked.tsv`).

| vendor | provider in ops.csv | operations |
|---|---|---|
| ringcentral | ringcentral.com | 347 |
| openziti | openziti.io | 204 |
| gitness | harness.io | 257 |
| huggingface | huggingface.co | 386 |
| pipedrive | pipedrive.com | 213 |
| vikunja | vikunja.io | 172 |
| total | | 1579 |

Denominator for every percentage: 1579 rows. Asked or undecided rows are scored
as x (the letter rwxmap publishes for them).

Lean. rwxmap's mechanical verdict for every row was built once, at code ref
96ebb46 (`data/exam7-2026-11-19/lean/`, commit 9514c2c). `lean.csv` sha256
`8334bbe66d1965f79cbd9ad13e17fcabd904c548832d803f7da053c005fc3a70`. rwxlite
rebuilt it independently at 1c25be1 (mechanical is identical at the two refs) and
got the same sha256. The lean is mechanical output only, not a label. It is
never shown to labellers and stays out of git until both labellers have
finished. This prereg states no lean counts.

Leakage checks (does round 15 hold these vendors?).

- rwxlite checked its round 15 train set (302,211 rows) for the six vendors by
  provider and vendor name: 0 hits. Four "harness" hits were an unrelated vendor
  (harnessbox). It also checked exact method + path + summary collisions: 42,
  all generic endpoints of other vendors, none a copy. These are rwxlite's
  figures; rwxlite's own record is the source.
- rwxmap's shortlist copy check, `poc/exam7-shortlist/r15-check/`: a spec was
  flagged at 5 or more shared METHOD + path AND 25% or more of the r15 spec, the
  rule fixed before the run. 319 specs were dropped from round 15 (rwxlite
  confirmed 319 specs, 4,963 ops, and that its 200k pick held none flagged). Max
  shared among flagged specs was 18, among near misses 24 (insightly against
  pipedrive); no real copies, the flags were generic CRUD paths.
- Both checks are on provider/vendor fields and path text, never free text. They
  cannot show that a vendor's text was never in rwxlite's training data under
  another name.

## Labelling (truth)

- Brief: `data/relabel-v4-2026-11-05/BRIEF-v4.md` verbatim, no edits. sha256
  `f8add85988a382ff5770c3af28fb048b82099392cb456f17dcc1e79277f57cbd`. Plus
  `data/relabel-v4-2026-11-05/BRIEF-v4-addendum-D141.md` (commit 54355e1), sha256
  `ff164d934b57cb1b86118aba9edb258440437fcc72c7d4f9a1f0af7accdcd918`. The
  addendum applies to exam #7 labelling and later; it does not relabel burned
  exam truth.
- Two blind labellers label every row: A = Sonnet, B = Opus (chosen 2026-11-19).
  Blind parts are `labelling/blind/part-<vendor>.csv` (`split.mjs`). The labeller
  prompt tells them to read each row and use no scripts. A labeller reads every
  description in full.
- Each labeller file is validated directly, never from the labeller's own counts
  (`labelling/validate.mjs`: header, row order, classes, confidence, distinct
  reasons). A scripted pass shows as few distinct reasons; such a file is moved to
  `labelling/rejected/` and relabelled by a new labeller.
- Where A and B differ, or either says ?, the user rules the row
  (`labelling/rulings.csv`, each with its A and B labels and a note). Jev is never
  used for truth. `build-truth.mjs` writes `truth.csv`, `truth.csv.sha256` and
  `labelling/out.sha256`.
- Custody: `truth.csv`, `labelling/out/` and `lean/lean.csv` stay out of git until
  both sides have scored; only their sha256 are committed. No `.gitignore`: do not
  `git add` them. `truth.csv` is opened for scoring only after both preregs are
  committed, the CANDIDATE ADDENDUM is filled in and the truth sha256 is
  committed. Only then is it shared with rwxlite, whose scorer checks the same
  sha256.
- `truth.csv` sha256: **af0fe041ff0bc2a372d915b63f2937a9f44a0808d911d821a1a4ffde851783ec**
  (`truth.csv.sha256`). Built by `labelling/build-truth.mjs` from the 12
  labeller files and `labelling/rulings.csv`; three runs gave the same sha.
  `labelling/out.sha256` is committed beside it.
- Measured facts about the labelling: 12 labeller files (A Sonnet, B Opus, for
  each of the 6 vendors), all validated directly; each labeller's transcript
  showed it opened only the brief, the addendum, its blind part and its own
  output. Distinct reasons A / B: gitness 233 / 250, huggingface 252 / 357,
  openziti 197 / 200, pipedrive 213 / 213, ringcentral 315 / 343, vikunja
  159 / 163. A and B agree on 1513 of 1579 (95.8%). Disagreements per vendor:
  openziti 27, huggingface 11, gitness 9, pipedrive 9, ringcentral 6, vikunja 4.
  64 were B x / A w and 2 were A x / B w. The user ruled all 66 on 2026-11-19 in
  12 pattern groups (G1 to G12, `labelling/rulings.csv`, each row with its A and
  B labels and a note): 45 ruled x, 21 ruled w. Truth classes: r 740, w 369,
  x 470 (N = 1579). Order note: labelling ran before the candidate addendum was
  filled (the addendum was committed in 428727f, before this truth sha256 was
  committed or shared); labels do not depend on the candidate.

## Code under test

- rwxmap commit: **96ebb46** (the exam #7 ref, frozen 2026-11-19). The scorer takes
  a scratch copy of it (`git archive` of `src` and `package.json` at
  `--rwxmap-ref`) and refuses to run if the working-tree `src/` or `package.json`
  differs from that ref. `src/` was checked identical to 96ebb46. Mechanical is
  identical to 1c25be1. 96ebb46 differs from shipped 0.11.x only by D140 (mode b
  default confidence 85); mode a and mechanical behave as shipped. Nothing under
  `src/` is changed in the repo for this exam.
- The pins in force at that commit: `src/modeldownload.js` has
  `RWXLITE_TAG = 'v0.3.1'` (manifest URLs and offline cache fallback), and
  `src/rwxliteengine.js` accepts only rwxlite npm packages in the tag's minor line
  (0.3.x), else "rwxlite: off". The lowering cut-off is 0.90 (D139,
  `LOWER_MIN_P` in `src/secondpass.js`).

### BASELINE: rwxlite 0.3.1 as shipped

- Package rwxlite 0.3.1, tag v0.3.1, fp32 model. Model string
  `rwxlite-0.3.1+bbe1997d`; fp32 model sha256
  `bbe1997d43020724f9eab9e42e8f6337e9640fe46f764b6fceac1eb1d000a3cf`. No rwxmap
  change (the shipped pin already is v0.3.1). Package ref (rwxlite v0.3.1 tag
  commit) `5069dfa1f242f451a2d8b38c7bf2bfb08710d03b`; manifest-exact.json sha256
  `c6bac86970888049952305f72434abe5c9d8f854224a5537f14e5a428a977739`; vocab.txt
  sha256 `07eced375cec144d27c900241f3e339478dec958f92fddbc551f295c992038a3`. The
  scorer checks all three files against these before any run.
- Refusal rule: before scoring, a baseline run's output must show
  `rwxlite: on (rwxlite-0.3.1+bbe1997d)` on the engine line. Otherwise the scorer
  refuses and nothing is scored.

### CANDIDATE: the model rwxlite enters

**CANDIDATE ADDENDUM: filled 2026-11-20.** The candidate is rwxlite round 15 (r15),
entered by rwxlite. The candidate is the round 15 student distilled from the new
teacher. On 2026-11-20 rwxlite's user waived its own val guards (teacher too loose
115 vs 104, student 120 vs 104), recorded in rwxlite's prereg; these are rwxlite's
figures, not measured here. Values were sent by rwxlite on 2026-11-20 and checked by the orchestrator against the file bytes and the rwxlite commit before this commit. This section is filled in, and
committed, BEFORE the truth sha256 is shared with rwxlite and before any scoring.
The scorer refuses to score any `*-cand` config unless every value below is given
on its command line, and checks each against the files (a model string must equal
`rwxlite-<version>+<first 8 hex of its model file's sha256>`, and must differ from
the baseline's). The scorer also reads this table as committed at `--rwxmap-ref`
(`git show <ref>:docs/wiki/exam-prereg-exam7.md`, never the working tree) and
refuses if any field says PENDING or any value differs from the command line.

| field | value |
|---|---|
| rwxlite package version | 0.4.0 |
| rwxlite package ref (commit in the rwxlite repo) | 088bec1d9c33efac58929806f8858f4d00f62909 |
| rwxlite tag / version (the tag rwxmap would pin) | v0.4.0 |
| model string (fp32) | rwxlite-0.4.0+4608f470 |
| model-fp32.onnx sha256 | 4608f4705d652de65adde722dc14868ef2f0898d36f84d18c88524e07ab0bc19 |
| manifest-exact.json sha256 (fp32) | 5b3e5b876ea0eda3416ae2115404cae13dd3e699bf4f446e07adb7540771d0f8 |
| vocab.txt sha256 | 07eced375cec144d27c900241f3e339478dec958f92fddbc551f295c992038a3 |
| rwxlite prereg commit (rwxlite repo) | 088bec1d9c33efac58929806f8858f4d00f62909 |

Model dir: /home/hamr/PycharmProjects/rwxlite/data/m1-r15 (manifest-exact.json, model-fp32.onnx, vocab.txt). The v0.4.0 tag and release do not exist; the scorer loads the package by git archive of the commit above and the model from this dir, with GitHub blocked.

Only fp32 is scored (rwxmap's default model). The int8 per-channel model
(`--model small`) is not part of this exam, for either the baseline or the candidate.

How the candidate is scored: as it would ship (D135 scoring method, unchanged). Today's CLI accepts only
rwxlite 0.3.x, and its offline cache fallback names the exact pinned version. The
unchanged CLI is used only when the candidate's tag equals the shipped `v0.3.1`.
For any other tag (0.3.2 included) the CLI would show "rwxlite: off", because the
cache fallback names exactly v0.3.1, so the scorer
makes a SECOND scratch copy of the same rwxmap commit and changes exactly one line
in it: `RWXLITE_TAG` in `src/modeldownload.js` becomes the candidate's tag (the
package range is derived from that constant, so nothing else moves). That change
lives only in the scorer's scratch install, never in the repo `src/`. The scorer
applies the change, prints the unified diff, and fails unless the diff is exactly
that one line in that one file (and the two copies list the same files). The
baseline copy has no change. If a candidate cannot run this way (for example its
package or manifest layout differs), the exam stops and is reported; no bypass is
added to `src/`. If rwxmap ships the candidate, the same one-line change (and the
cache fallback that follows from it) is what goes out.

How both builds are loaded without the user's cache: `score.mjs` builds one scratch
install per model (a real package folder `node_modules/rwxlite` with its own
`package.json`, so the version reader that walks up from the resolved entry finds
it), one model cache per model laid out as rwxmap's cache
(`rwxlite-<version>+<sha8>/` with `manifest.json`, the model, `vocab.txt`), and a
preload given to the real CLI with `node --import`. The preload resolves
`import('rwxlite')` to that model's install and refuses requests to github.com and
`*.githubusercontent.com`, so the pinned-release download cannot replace the model
under test and the CLI falls back to the verified scratch cache. `XDG_CACHE_HOME`
and `HOME` point into the scratch folder; `~/.cache/rwxmap` is not read or
written. The run fails loudly on "rwxlite: off", a wrong model string, or a wrong
pass or confidence (never scored as mechanical).

## Configs

Each runs the real CLI (`node src/cli.js <spec> --vendor <name> -o <scratch>`, from
the scratch rwxmap copy) on each of the 6 specs, from a scratch folder with an
empty HOME and no `.env`, and the scorer joins every operation to `ops.csv` by
(provider, METHOD, path), 1:1 (any unmatched, extra or duplicate row fails the
run).

| config | flags | model | role |
|---|---|---|---|
| mech | `--engine mechanical` | none | reference |
| a-base | (none: mode a) | shipped 0.3.1 fp32 `rwxlite-0.3.1+bbe1997d` | gate reference |
| a-cand | (none: mode a) | candidate fp32 | **GATE (D142)** |
| b85-base | `--engine rwxlite` (default confidence 85, D140) | 0.3.1 fp32 | reported |
| b85-cand | `--engine rwxlite` (default confidence 85) | candidate fp32 | reported |

Jev (mode c) is not scored (paid).

Commands (`<T>` is the committed truth sha256). Baseline only, no verdict on the
gate:

```
node data/exam7-2026-11-19/score/score.mjs --rwxmap-ref <ref> --truth-sha <T>
```

With the candidate (every value copied from the committed CANDIDATE ADDENDUM).
`--rwxmap-ref` is required and is the commit that holds the filled addendum; there
is no HEAD default.

```
node data/exam7-2026-11-19/score/score.mjs --rwxmap-ref <ref> --truth-sha <T> \
  --cand-models <dir> --cand-version <ver> --cand-ref <rwxlite-commit> \
  --cand-tag <tag> --cand-model <model-string> --cand-model-sha <sha256> \
  --cand-manifest-sha <sha256> --cand-vocab-sha <sha256> \
  --cand-prereg-commit <rwxlite-prereg-commit>
```

`--config` may name a subset of the configs only for a crash rerun.

## Output

Per config: exact, loose-1, loose-2, too loose (loose-1 + loose-2) and too tight,
each as a count and a share of 1579, per vendor and per method. Per-vendor and
per-method lines show the share of the group's own rows and the share of 1579. Every too-loose
row is listed with its marker (tight, loose or settled). rwxlite sent / raised /
lowered / kept / undecided counts are printed for each rwxlite config. Rows where
a-base and a-cand differ are listed with truth. Each run writes
`score/rows-<config>.csv`. Too loose (letter below truth) and too tight (letter
above truth) are never folded into one number.

## Bars (set before scoring)

- **D142 GATE (user ruling 2026-11-20, made before the truth sha256 was shared
  and before any score was seen; proposed by rwxlite's user, agreed by the rwxmap
  user).** It replaces the D135 "same or better" gate (ruled 2026-11-19) for this
  exam. Real CLI, fp32, mode a, same 1579 rows. Round 15 replaces 0.3.1 only if
  BOTH: (1) a-cand exact >= a-base exact (a tie passes); (2) a-cand too-loose share
  <= a-base too-loose share + 1.0 percentage point. Integer form: 1.0 point of 1579
  is 15.79 rows, so cand.loose - base.loose <= floor(0.01 x n) = 15 (the scorer
  prints the allowance used). Anything else is NO-GO and 0.3.1 stays. Too tight is
  reported beside the gate and is not part of it. The gate is the CLI number, not
  rwxlite's own scorer. Reason: a more confident model relaxes more letters, mostly
  correctly, so exact rises and too tight falls; a small rise in too loose is
  accepted as a trade.
- **D133 mode a bar, reported only, for both a-base and a-cand against mech.** On
  the same 1579 rows: too loose <= mech's too loose AND exact >= mech's exact +
  5.0 percentage points. 5.0 points of 1579 is 78.95 rows, so at least 79 more
  exact rows than mech (ceil(0.05 x 1579) = 79, computed on integer counts).
- **D140 mode b at 85: no bar.** Reported for b85-base and b85-cand with their
  too-loose, too-tight and asked (undecided) counts.

## Order

1. This prereg is committed.
2. The CANDIDATE ADDENDUM is filled in and committed (rwxmap and rwxlite agree on
   the same ref, tag, hashes and model string).
3. Blind labelling by A and B, validation of every file, the user rules every
   disagreement.
4. Truth is built and its sha256 is committed (written into this file) and sent to
   rwxlite; `truth.csv` is opened only now.
5. rwxlite commits its prediction hashes.
6. Each side scores once, on the same rows. A rerun is allowed only for a crash or
   a row-join bug, recorded with the reason. No change of model, code, config, cut
   or text after any prediction exists. Anything a result suggests needs a new
   exam with new vendors.
7. Results go to `docs/logs/learnings.md`, the README and the PRD (a result that
   changes a feature or a decision, D142 and D140 included, goes to the PRD and
   the decisions log).

## Burn rule

As exam #6: once both sides have scored, exam #7 is BURNED. Its truth is never
edited (derived copies sit beside the originals), its rows and truth may be used
for training and tuning, and it is never an exam again. Any rule change after this
needs a new exam.

## Known limits

- Labels are model labels (Sonnet and Opus, blind) plus the user's rulings on
  disagreements, not authoritative truth. Agreement shows consistency, not truth.
- Labellers read the brief plus the D141 addendum. The addendum was written after
  rwxlite round 15's review surfaced the ambiguities, so labels follow D141
  readings that earlier exams' truth did not use.
- gitness has no summary on 245 of its 257 ops, huggingface has no operationId on
  any of its 386, vikunja on 171 of its 172. Kept as published.
- GitHub pins are branch fetches (`main`); the recorded commit is the latest commit
  touching the file at survey time, so the sha256 is the real pin. huggingface and
  pipedrive are live vendor URLs with no commit: the sha256 is the only pin.
- Selection was by row count and domain spread from a shortlist, not random.
- The leakage checks are on provider/vendor fields and path text. They do not rule
  out that rwxlite's training text held these vendors under another name.
- Parity of rwxlite's per-row p's against the CLI is not checked by this scorer;
  rwxlite checks its own p files. A model's score belongs to the decision rule it
  was measured with, so rwxlite's own scorer is not the gate.
- Model files are copied into a scratch cache, not downloaded by the CLI; the
  production download path is not exercised.
- The candidate is scored as it would ship (D135 scoring method). If its tag differs from
  `v0.3.1` (0.3.2 included) that needs the one-line `RWXLITE_TAG` change, because
  the CLI's offline cache fallback names the exact pinned version; the guard proves the diff is that
  line but cannot prove the real release would be built the same way.
- Mode a and mode b share a model; their rows are not independent. Base and
  candidate are scored on the same rows, so the gate is a paired comparison on 1579
  rows with integer counts. A one-row gap is decided by the written rule (an exact
  tie passes; too loose may rise by at most 15 rows), not by a significance test.
- The figures are for the one candidate named in the addendum only.

## Results and findings (after scoring, 2026-11-20)

Source: `data/exam7-2026-11-19/score/score.txt` and `rows-{mech,a-base,a-cand,b85-base,b85-cand}.csv`; run log `data/exam7-2026-11-19/score/score-run.log.gz`. The run log's scratch path (`.claude/scratchpad/exam7-run`) is not in the repo; the CLI outputs it held are committed as `data/exam7-2026-11-19/score/rows-*.csv` and `score.txt`.

### Run facts

- Scorer run 2026-11-20T14:52:21Z at `--rwxmap-ref 7dce23e`, exit 0.
- truth.csv sha256 af0fe041...83ec verified against `--truth-sha`, `truth.csv.sha256` and this file. N 1579. ops.csv sha256 abe5e6cd...47ea.
- Join for every config (mech, a-base, a-cand, b85-base, b85-cand): matched 1579, unmatched ops 0, unmatched output 0, duplicate keys 0.
- The candidate addendum matched this file field by field. The retag diff between the base and candidate rwxmap copies was exactly the `RWXLITE_TAG` line (`v0.3.1` to `v0.4.0` in `src/modeldownload.js`).
- Base models came from rwxlite `data/m1-r13`, three files verified against the pinned hashes (ref 5069dfa1, model string rwxlite-0.3.1+bbe1997d). Candidate came from rwxlite `data/m1-r15`, three files verified (ref 088bec1d, model string rwxlite-0.4.0+4608f470).
- rwxlite committed its prediction hashes at rwxlite b5ee1cc before the truth was shared (rwxlite's record, not checked by this scorer).
- Exam #7 is BURNED for both sides. It was scored once.

### Main table (of 1579)

| config | exact | loose-1 | loose-2 | too loose | too tight | rwxlite sent / raised / lowered / kept / undecided |
|---|---|---|---|---|---|---|
| mech | 1333 (84.4%) | 54 (3.4%) | 18 (1.1%) | 72 (4.6%) | 174 (11.0%) | none |
| a-base (0.3.1) | 1431 (90.6%) | 50 (3.2%) | 18 (1.1%) | 68 (4.3%) | 80 (5.1%) | 664 / 33 / 123 / 435 / 73 |
| a-cand (0.4.0) | 1432 (90.7%) | 50 (3.2%) | 16 (1.0%) | 66 (4.2%) | 81 (5.1%) | 664 / 21 / 108 / 464 / 71 |
| b85-base | 1447 (91.6%) | 46 (2.9%) | 8 (0.5%) | 54 (3.4%) | 78 (4.9%) | 1579 / 17 / 143 / 1241 / 178 |
| b85-cand | 1449 (91.8%) | 38 (2.4%) | 1 (0.1%) | 39 (2.5%) | 91 (5.8%) | 1579 / 17 / 118 / 1280 / 164 |

Markers on the too-loose rows: mech 72 (tight 0, loose 57, settled 15); a-base 68 (tight 0, loose 53, settled 15); a-cand 66 (tight 0, loose 51, settled 15); b85-base 54 (tight 0, loose 49, settled 5); b85-cand 39 (tight 0, loose 39, settled 0).

The headline for the shipped build is a-base: mode a with rwxlite 0.3.1, 1431 exact / 68 too loose (50 loose-1, 18 loose-2) / 80 too tight, of 1579. Vendors are huggingface, openziti, pipedrive, ringcentral, vikunja and gitness (the scorer prints gitness as harness.io).

### By vendor (of the vendor's rows)

mech:

| vendor | rows | exact | loose-1 | loose-2 | too loose | too tight |
|---|---|---|---|---|---|---|
| harness.io | 257 | 224 (87.2%) | 8 | 0 | 8 (3.1%) | 25 (9.7%) |
| huggingface.co | 386 | 291 (75.4%) | 4 | 14 | 18 (4.7%) | 77 (19.9%) |
| openziti.io | 204 | 173 (84.8%) | 20 | 1 | 21 (10.3%) | 10 (4.9%) |
| pipedrive.com | 213 | 202 (94.8%) | 4 | 2 | 6 (2.8%) | 5 (2.3%) |
| ringcentral.com | 347 | 303 (87.3%) | 10 | 0 | 10 (2.9%) | 34 (9.8%) |
| vikunja.io | 172 | 140 (81.4%) | 8 | 1 | 9 (5.2%) | 23 (13.4%) |

a-base:

| vendor | rows | exact | loose-1 | loose-2 | too loose | too tight |
|---|---|---|---|---|---|---|
| harness.io | 257 | 232 (90.3%) | 7 | 0 | 7 (2.7%) | 18 (7.0%) |
| huggingface.co | 386 | 341 (88.3%) | 8 | 14 | 22 (5.7%) | 23 (6.0%) |
| openziti.io | 204 | 181 (88.7%) | 19 | 1 | 20 (9.8%) | 3 (1.5%) |
| pipedrive.com | 213 | 201 (94.4%) | 2 | 2 | 4 (1.9%) | 8 (3.8%) |
| ringcentral.com | 347 | 323 (93.1%) | 9 | 0 | 9 (2.6%) | 15 (4.3%) |
| vikunja.io | 172 | 153 (89.0%) | 5 | 1 | 6 (3.5%) | 13 (7.6%) |

a-cand:

| vendor | rows | exact | loose-1 | loose-2 | too loose | too tight |
|---|---|---|---|---|---|---|
| harness.io | 257 | 230 (89.5%) | 9 | 0 | 9 (3.5%) | 18 (7.0%) |
| huggingface.co | 386 | 341 (88.3%) | 3 | 14 | 17 (4.4%) | 28 (7.3%) |
| openziti.io | 204 | 176 (86.3%) | 24 | 1 | 25 (12.3%) | 3 (1.5%) |
| pipedrive.com | 213 | 205 (96.2%) | 2 | 1 | 3 (1.4%) | 5 (2.3%) |
| ringcentral.com | 347 | 324 (93.4%) | 8 | 0 | 8 (2.3%) | 15 (4.3%) |
| vikunja.io | 172 | 156 (90.7%) | 4 | 0 | 4 (2.3%) | 12 (7.0%) |

### By method (of the method's rows)

mech:

| method | rows | exact | loose-1 | loose-2 | too loose | too tight |
|---|---|---|---|---|---|---|
| DELETE | 189 | 188 (99.5%) | 0 | 0 | 0 | 1 (0.5%) |
| GET | 726 | 711 (97.9%) | 0 | 15 | 15 (2.1%) | 0 |
| PATCH | 74 | 55 (74.3%) | 18 | 0 | 18 (24.3%) | 1 (1.4%) |
| POST | 446 | 258 (57.8%) | 18 | 3 | 21 (4.7%) | 167 (37.4%) |
| PUT | 144 | 121 (84.0%) | 18 | 0 | 18 (12.5%) | 5 (3.5%) |

a-base:

| method | rows | exact | loose-1 | loose-2 | too loose | too tight |
|---|---|---|---|---|---|---|
| DELETE | 189 | 188 (99.5%) | 0 | 0 | 0 | 1 (0.5%) |
| GET | 726 | 711 (97.9%) | 0 | 15 | 15 (2.1%) | 0 |
| PATCH | 74 | 59 (79.7%) | 15 | 0 | 15 (20.3%) | 0 |
| POST | 446 | 349 (78.3%) | 24 | 3 | 27 (6.1%) | 70 (15.7%) |
| PUT | 144 | 124 (86.1%) | 11 | 0 | 11 (7.6%) | 9 (6.3%) |

a-cand:

| method | rows | exact | loose-1 | loose-2 | too loose | too tight |
|---|---|---|---|---|---|---|
| DELETE | 189 | 188 (99.5%) | 0 | 0 | 0 | 1 (0.5%) |
| GET | 726 | 711 (97.9%) | 0 | 15 | 15 (2.1%) | 0 |
| PATCH | 74 | 58 (78.4%) | 15 | 0 | 15 (20.3%) | 1 (1.4%) |
| POST | 446 | 355 (79.6%) | 19 | 1 | 20 (4.5%) | 71 (15.9%) |
| PUT | 144 | 120 (83.3%) | 16 | 0 | 16 (11.1%) | 8 (5.6%) |

### D142 gate (the ship gate for this exam)

- a-cand too loose 66 against a-base 68 (-2); the limit was +15 rows of 1579. OK.
- a-cand exact 1432 against a-base 1431 (+1); the rule was no fewer. OK.
- Verdict: GO. Round 15 (rwxlite 0.4.0) may replace 0.3.1.
- Beside the gate, not part of it: too tight 81 against 80 (+1), of 1579.
- The candidate would also pass D135's same-or-better gate (no more too loose, no fewer exact): 66 <= 68 and 1432 >= 1431.

### D133 mode a bar (reported only, for both models; not the D142 gate)

- a-base: too loose 68 against mech 72, PASS; exact 1431 against mech 1333 plus 79 = 1412, PASS.
- a-cand: too loose 66 against mech 72, PASS; exact 1432 against 1412, PASS.

### D140 mode b at confidence 85 (no bar, reported)

- b85-base: exact 1447 (91.6%), too loose 54 (loose-1 46, loose-2 8; 3.4%), too tight 78 (4.9%), asked 178 (11.3%).
- b85-cand: exact 1449 (91.8%), too loose 39 (loose-1 38, loose-2 1; 2.5%), too tight 91 (5.8%), asked 164 (10.4%).

### Findings

- (a) 53 rows differ between a-base and a-cand. 10 leaks closed (8 loose-1 to exact, 2 loose-2 to exact): huggingface resource-group POST x4 (ex7-0282, 0314, 0398, 0578), huggingface SCIM Users PATCH x2 (0454, 0470), ringcentral glip conversations POST (1331), pipedrive oauth/token POST, loose-2 (0951), vikunja openid callback POST, loose-2 (1416), vikunja totp disable POST (1562). 8 leaks opened, all truth x predicted w (exact to loose-1): gitness admin users PATCH (0006), gitness connectors POST (0007), huggingface jobs expose PUT (0370), openziti auth-policies PATCH (0653) and PUT (0654), edge-router-policies PUT (0721), service-edge-router-policies PUT (0801), service-policies PUT (0809). Net too loose 68 - 10 + 8 = 66. The other 35 differing rows move too tight only: 17 tight to exact and 18 exact to tight, net +1 (80 to 81).
- (b) The 15 GET leaks (all loose-2, truth x read as r) are identical in mech, a-base and a-cand. They are settled GET rows (huggingface xet-read/write-token, jwt and registry/token; pipedrive oauth/authorize), which the second pass never sees. Mode a cannot move them.
- (c) Mode b at 85 has fewer leaks than mode a for both models: base 54 against 68, candidate 39 against 66 (loose-2 1 against 16). The cost is too tight: 91 (candidate) against 81 in mode a, of 1579. Mode b at 85 sends all 1579 rows; mode a sends 664.
- (d) The new leaks cluster in openziti: 5 of the 8 opened leaks are openziti PUT or PATCH on access-policy objects (auth-policies, edge-router-policies, service-edge-router-policies, service-policies). openziti too loose goes from 20 to 25 (of 204) in a-cand. Round 16 target.
- (e) rwxlite's own information scorer reproduced mode a fp32 exactly: base 1431 / 68 / 80 and candidate 1432 / 66 / 81 (exact / too loose / too tight). rwxlite's figures, not measured here: standalone fp32 base 1453 / 91 / 35, candidate 1456 / 80 / 43, x read as r 16 to 3; int8 mode a base 1426 / 68 / 85, candidate 1431 / 66 / 82.

Exam #7 is BURNED for both sides. Any rule or model change needs a new exam.
