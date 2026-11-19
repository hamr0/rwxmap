# Pre-registration (DRAFT): shared clean exam #7, rwxmap side (D135 next-model gate, round 15)

**Status: DRAFT, written 2026-11-19. Not frozen. Not scored.** It freezes when
this file is committed with the scorer (`data/exam7-2026-11-19/score/`, not yet
written), the CANDIDATE ADDENDUM below is filled in and committed, the truth
sha256 is filled in, and rwxlite has committed its side.

Inputs are frozen in commit a1c31bf. No classifier has been run on any exam #7
row, with one exception: the mechanical lean (below), which is mechanical's own
verdict and is never shown to labellers. No CLI run, no rwxlite run and no Jev
run has touched an exam #7 row. No truth exists yet.

The exam answers two questions.

1. (D135) May rwxlite round 15 replace the shipped model (0.3.1) as the model
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
- `truth.csv` sha256: **PENDING**
- Measured facts about the labelling: PENDING (written in after truth is built).

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
  change (the shipped pin already is v0.3.1). The remaining file hashes
  (manifest-exact.json, vocab.txt) are read from the v0.3.1 release and checked
  by the scorer before any run; they are not repeated here.
- Refusal rule: before scoring, a baseline run's output must show
  `rwxlite: on (rwxlite-0.3.1+bbe1997d)` on the engine line. Otherwise the scorer
  refuses and nothing is scored.

### CANDIDATE: the model rwxlite enters

**CANDIDATE ADDENDUM: PENDING.** The candidate is rwxlite round 15 (r15),
entered by rwxlite. Every value below is PENDING. This section is filled in, and
committed, BEFORE the truth sha256 is shared with rwxlite and before any scoring.
The scorer refuses to score any `*-cand` config unless every value below is given
on its command line, and checks each against the files (a model string must equal
`rwxlite-<version>+<first 8 hex of its model file's sha256>`, and must differ from
the baseline's). The scorer also reads this table as committed at `--rwxmap-ref`
(`git show <ref>:docs/wiki/exam-prereg-exam7.md`, never the working tree) and
refuses if any field says PENDING or any value differs from the command line.

| field | value |
|---|---|
| rwxlite package version | PENDING |
| rwxlite package ref (commit in the rwxlite repo) | PENDING |
| rwxlite tag / version (the tag rwxmap would pin) | PENDING |
| model string (fp32) | PENDING |
| model-fp32.onnx sha256 | PENDING |
| manifest-exact.json sha256 (fp32) | PENDING |
| vocab.txt sha256 | PENDING |
| rwxlite prereg commit (rwxlite repo) | PENDING |

Only fp32 is scored (rwxmap's default model). The int8 per-channel model
(`--model small`) is not part of this exam, for either the baseline or the candidate.

How the candidate is scored: as it would ship (D135). Today's CLI accepts only
rwxlite 0.3.x. A candidate packaged as 0.3.x runs through the unchanged CLI. If
round 15 ships as 0.4.x, the CLI would show "rwxlite: off" for it, so the scorer
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
| a-cand | (none: mode a) | candidate fp32 | **GATE** |
| b85-base | `--engine rwxlite` (default confidence 85, D140) | 0.3.1 fp32 | reported |
| b85-cand | `--engine rwxlite` (default confidence 85) | candidate fp32 | reported |

Jev (mode c) is not scored (paid).

Commands (`<T>` is the committed truth sha256). Baseline only, no verdict on the
gate:

```
node data/exam7-2026-11-19/score/score.mjs --truth-sha <T>
```

With the candidate (every value copied from the committed CANDIDATE ADDENDUM).
`--rwxmap-ref` is passed explicitly and is the commit that holds the filled
addendum; do not rely on a HEAD default. The scorer's exact flags are fixed when
the scorer is written and committed with this prereg.

## Output

Per config: exact, loose-1, loose-2, too loose (loose-1 + loose-2) and too tight,
each as a count and a share of 1579, per vendor and per method. Every too-loose
row is listed with its marker (tight, loose or settled). rwxlite sent / raised /
lowered / kept / undecided counts are printed for each rwxlite config. Rows where
a-base and a-cand differ are listed with truth. Each run writes
`score/rows-<config>.csv`. Too loose (letter below truth) and too tight (letter
above truth) are never folded into one number.

## Bars (set before scoring)

- **D135 GATE (user ruling 2026-11-19: D135 as written, "same or better").**
  Round 15 replaces 0.3.1 only if, on the same 1579 rows, a-cand's too loose <=
  a-base's too loose AND a-cand's exact >= a-base's exact. Integer counts. A tie on
  either half passes that half. Anything else is NO-GO and 0.3.1 stays. The gate
  is the CLI number, not rwxlite's own scorer. Too tight is reported beside the
  gate and is not part of it.
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
   changes a feature or a decision, D135 and D140 included, goes to the PRD and
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
- The candidate is scored as it would ship under D135. If round 15 ships as 0.4.x
  that needs the one-line `RWXLITE_TAG` change; the guard proves the diff is that
  line but cannot prove the real release would be built the same way.
- Mode a and mode b share a model; their rows are not independent. Base and
  candidate are scored on the same rows, so the gate is a paired comparison on 1579
  rows with integer counts. A one-row gap is decided by the written rule (a tie
  passes), not by a significance test.
- The figures are for the one candidate named in the addendum only.
