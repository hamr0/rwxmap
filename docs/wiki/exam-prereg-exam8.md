# Pre-registration: shared clean exam #8, rwxmap side (D142 next-model ship gate, rwxlite round 16)

**Status: PREREGISTERED. CANDIDATE ADDENDUM: filled 2026-11-23. Truth sha256 committed.** Not yet scored.

Inputs are frozen in commit 70630cf (the wekan provider value was fixed in
88d4171). No CLI run, no rwxlite run and no Jev run has touched an exam #8 row.
Two things exist for these rows: the mechanical lean (below), which is
mechanical's own verdict and is never read against truth, and truth itself,
which is built and held (see "Order note" below for how that differs from
exam #7).

The exam answers two questions, plus one reported measurement.

1. (D142) May rwxlite round 16 replace the shipped model (0.4.0) as the model
   rwxmap ships? It compares two models on the same rows. It is not a tuning
   round; nothing here is fitted to its own rows.
2. (D140) What does mode b at its default confidence of 85 score on rows it
   never saw? Reported only, no bar.
3. (D144, reported only) The `mech` config runs mechanical v4 plus D144 (refresh
   on GET; verify, callback and login as path words) on rows it never saw. D144
   was adopted on set A under D100 (PRD, What is next, item 3); this prereg sets
   no new bar for it.

## Rows

Frozen in commit 70630cf: `data/exam8-2026-11-23/ops.csv`, 1821 operations,
sha256 `7d2be1f3167086597522025841c4a21e8eeb28095b2613f51e79237b21b428de`
(`ops.csv.sha256`; `build-ops.mjs` is deterministic). Specs are each vendor's own
official OpenAPI, original bytes, gzipped, `data/exam8-2026-11-23/specs/` (hashes
and pins in `sources.json`). Vendors were frozen 2026-11-18 (commit 0c2d623) as the six
`role=reserve` rows of `poc/exam7-shortlist/picked.tsv`; bytes fetched
2026-11-18.

| vendor | provider in ops.csv | operations |
|---|---|---|
| gitbook | gitbook.com | 403 |
| baserow | baserow.io | 488 |
| looker | looker.com | 502 |
| wekan | wekan.github.io | 157 |
| shortcut | shortcut.com | 143 |
| bitrise | bitrise.io | 128 |
| total | | 1821 |

Denominator for every percentage: 1821 rows. Asked or undecided rows are scored
as x (the letter rwxmap publishes for them).

Lean. rwxmap's mechanical verdict for every row was built once, at code ref
ecee4f1 (`data/exam8-2026-11-23/lean/`). `lean.csv` sha256
`87a6e8978534fb37e5d24e76034720c481e2c8417e91b3e6eaf64eb4317a1502`; two builds
gave the same sha256. The lean is mechanical output only, not a label. It has not
been read against truth and stays out of git until both sides have scored. This
prereg states no lean counts.

Leakage checks (does round 16 hold these vendors?).

- rwxlite's r16 train check against these six vendors. These are rwxlite's
  figures; its record is the source (rwxlite commit 2e7865a,
  `docs/product/r16-exam8-leakage-check.md`).
  - rwxlite read only id, provider, method, path, operationId and summary from
    ops.csv (sha verified), no labels and no lean.
  - Names: no r16-built file (teacher-train-v3, set A, set B, dev v3) has a row
    whose vendor, provider, vendor_id or source names gitbook, baserow, looker,
    wekan, shortcut, clubhouse or bitrise. The inherited r15 train holds 41 rows
    from clubhouseapi.com (the Clubhouse social-audio app, a name match on
    Shortcut's old name but a different product); its 5 rows in the r16 replay
    were dropped anyway.
  - Exact method+path+summary collisions (empty summary on both sides counts as
    equal): teacher-train-v3 58 rows on 26 exam ops, 50 on generic routes (POST
    /login, GET /api/users, POST /projects ...) and 8 vendor-flavoured (GET
    /api/jobs/, /api/audit-log/, /api/applications/, /api/admin/users/ against
    baserow; PATCH /collections/{collectionId} against gitbook; GET /builds
    against bitrise; POST /agents against looker), every colliding train row from
    an unrelated vendor; set A 4, set B 13, inherited r15 train 109 rows on 25
    exam ops, dev v3 0. Method+path only: teacher-train-v3 3,304 rows on 111 exam
    ops.
  - r16 removed the exam #8 vendors at spec level (rwxmap's dc3a0e0 drop list
    plus rwxlite's name hits, sha mirrors and near-duplicate specs), not by op
    key.
- rwxmap's copy check of rwxlite's r16 GitHub collection, `poc/exam8-r16-check/`
  (commit dc3a0e0), run with exam #7's rule unchanged: an op key is METHOD plus
  normalised path; a spec is flagged at 5 or more shared ops AND 25% or more of
  the r16 spec's ops; name match exact, label or segment on the six aliases. The
  rule was fixed before the run. 260 specs were flagged (looker 213, wekan 38,
  gitbook 5, baserow 5; shortcut 0, bitrise 0), 0 name matches, and the drop list
  holds those 260 specs and 4,680 of 807,949 ops (0.58%). At most 18 of looker's
  502 ops were shared by any flagged spec; the flags are generic CRUD look-alikes.
  The list was dropped anyway, because the rule was set first. The collection
  checked is rwxlite's GitHub collection as sent to rwxmap (35,810 specs).
- These six were held as `role=reserve` at exam #7's freeze
  (`poc/exam7-shortlist/picked.tsv`) and were part of exam #7's round 15 copy
  check (`poc/exam7-shortlist/r15-check/summary.txt`, which lists flagged and
  near-miss pairs for looker and wekan and near-misses for the others). They
  were sent to rwxlite as off-limits for round 16 on 2026-11-20 (PRD, What is
  next, item 2).
- Both checks are on provider/vendor fields and path text, never free text. They
  cannot show that a vendor's text was never in rwxlite's training data under
  another name.

As at exam #7, no exam #8 row is excluded from scoring for a collision; all 1821
rows are scored.

## Labelling (truth)

- Brief: `data/relabel-v4-2026-11-05/BRIEF-v4.md` verbatim, no edits. sha256
  `f8add85988a382ff5770c3af28fb048b82099392cb456f17dcc1e79277f57cbd`. Plus
  `data/relabel-v4-2026-11-05/BRIEF-v4-addendum-D141.md` (commit 54355e1), sha256
  `ff164d934b57cb1b86118aba9edb258440437fcc72c7d4f9a1f0af7accdcd918`. Plus
  `data/relabel-v4-2026-11-05/BRIEF-v4-addendum-D143.md` (bookings are x), sha256
  `c449c5d3070fbef7cb08bcc0fa6ea7c0da0943011beaae6cf03ce82e1d2ae31e`. Neither
  addendum relabels burned exam truth.
- Two blind labellers label every row: A = Sonnet, B = Opus. Blind parts are
  `labelling/blind/part-<vendor>.csv` (`split.mjs`). The labeller prompt tells
  them to read each row and use no scripts. A labeller reads every description
  in full.
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
  `git add` them. `truth.csv` is opened for scoring only after this prereg is
  committed, the CANDIDATE ADDENDUM is filled in and the truth sha256 is
  committed. Only then is it shared with rwxlite, whose scorer checks the same
  sha256.
- `truth.csv` sha256: **0dfc8b42bd85f336ab7897b902e228e0ec8cca2960f0ffc6b8887dee17e8ac42**
  (`truth.csv.sha256`). Built by `labelling/build-truth.mjs` from the 12
  labeller files and `labelling/rulings.csv`; three runs gave the same sha.
  `labelling/out.sha256` is committed beside it.
- Measured facts about the labelling (from the labelling record kept by the
  orchestrator; the labeller files themselves are not in git): 12 labeller files
  (A Sonnet, B Opus, for each of the 6 vendors), all validated directly; each
  labeller's transcript showed it opened only the brief files, its blind part and
  its own output. A and B agree on 1711 of 1821 (94.0%). 110 disputes: baserow 37,
  looker 26, gitbook 23, bitrise 17, wekan 6, shortcut 1; 98 of them were A w
  against B x. The user ruled all 110 by the plain rwx definitions: x 72, w 30,
  r 8. Truth classes: r 845, w 406, x 570 (N = 1821).
- Order note (a deviation from exam #7, stated plainly). Labelling ran and truth
  was built BEFORE this prereg was written and before the code ref was frozen.
  At exam #7 the prereg was committed before labelling (its candidate addendum
  followed labelling but came before the truth sha256 was shared). Here the order was: inputs frozen, labelling, truth built and
  held, D144 built, code ref ecee4f1 frozen, then this prereg. D144 was built
  after truth existed. Its 31 candidate words were measured only on
  export-v4-d141 (set A, 102,590 rows) and the burned exam #7, never on exam #8
  rows, and the truth file was not opened for it. The lean was built after the
  code ref and has not been read against truth. Labels do not depend on code or
  on the candidate.

## Code under test

- rwxmap commit: **ecee4f1** (the exam #8 ref, frozen 2026-11-23): mechanical v4
  plus D144, which adds `refresh` to GET_ACTION (`src/step2.js`) and `verify`,
  `callback` and `login` to PATH_X_WORDS (`src/step2.js`); rwxlite pin v0.4.0,
  lowering cut-off 0.90 and mode b default 85, as shipped in 0.12.0. The scorer
  takes a scratch copy of it (`git archive` of `src` and `package.json` at
  `--rwxmap-ref`) and refuses to run if the working-tree `src/` or `package.json`
  differs from that ref. Nothing under `src/` is changed in the repo for this
  exam. Against exam #7's ref 96ebb46, `src/` differs in `src/step2.js` (D144),
  the one-line `RWXLITE_TAG` pin (v0.3.1 to v0.4.0), one comment in
  `src/secondpass.js`, and tests; `package.json` differs in its version and its
  test script.
- The pins in force at that commit (read with `git show ecee4f1:<file>`):
  `src/modeldownload.js:35` `RWXLITE_TAG = 'v0.4.0'` (manifest URLs and offline
  cache fallback); `src/rwxliteengine.js` accepts only rwxlite npm packages in the
  tag's minor line (0.4.x), derived from `RWXLITE_VERSION` (lines 18 to 25),
  else "rwxlite: off"; `src/secondpass.js:53` `LOWER_MIN_P = 0.90` (D139);
  `src/cli.js:871` `DEFAULT_CONFIDENCE = 85` (D140).

### BASELINE: rwxlite 0.4.0 as shipped

- Package rwxlite 0.4.0, tag v0.4.0, fp32 model. Model string
  `rwxlite-0.4.0+4608f470`; fp32 model sha256
  `4608f4705d652de65adde722dc14868ef2f0898d36f84d18c88524e07ab0bc19`. No rwxmap
  change (the shipped pin already is v0.4.0). Package ref (rwxlite v0.4.0 tag
  commit) `db328e6f67871a50610f44e1e8895b086fe5b442`; manifest-exact.json sha256
  `5b3e5b876ea0eda3416ae2115404cae13dd3e699bf4f446e07adb7540771d0f8`; vocab.txt
  sha256 `07eced375cec144d27c900241f3e339478dec958f92fddbc551f295c992038a3`. The
  three files were checked equal to the v0.4.0 GitHub release assets by the
  orchestrator; the base model dir is
  `/home/hamr/PycharmProjects/rwxlite/data/m1-r15` (passed as `--models-base`).
  The scorer checks all three files against these hashes before any run.
- Refusal rule: before scoring, a baseline run's output must show
  `rwxlite: on (rwxlite-0.4.0+4608f470)` on the engine line. Otherwise the scorer
  refuses and nothing is scored.

### CANDIDATE: the model rwxlite enters

**CANDIDATE ADDENDUM: filled 2026-11-23.** The candidate is rwxlite round 16 (r16),
the r16 student, entered by rwxlite. Values were sent by rwxlite on 2026-11-23 and
checked by the orchestrator against the file bytes and the rwxlite commits before
this commit. rwxlite's dev figures, as rwxlite's and not measured here (dev-v3
subset (b), 3,286 rows, mode a at 0.90, fp32): 0.5.0 3,093 exact / 41 too loose /
152 too tight against 0.4.0's 3,064 / 42 / 180; at the ecee4f1 lean 3,093 / 38 /
155. This section is filled in, and committed, BEFORE the truth sha256 is shared
with rwxlite and before any scoring. The scorer refuses to score any
`*-cand` config unless every value below is given on its command line, and checks
each against the files (a model string must equal
`rwxlite-<version>+<first 8 hex of its model file's sha256>`, and must differ from
the baseline's). The scorer also reads this table as committed at `--rwxmap-ref`
(`git show <ref>:docs/wiki/exam-prereg-exam8.md`, never the working tree) and
refuses if any field says PENDING or any value differs from the command line.

| field | value |
|---|---|
| rwxlite package version | 0.5.0 |
| rwxlite package ref (commit in the rwxlite repo) | 67f732c241227cf7d682f0bf881130a0b8f6732a |
| rwxlite tag / version (the tag rwxmap would pin) | v0.5.0 |
| model string (fp32) | rwxlite-0.5.0+82fa50c3 |
| model-fp32.onnx sha256 | 82fa50c394b1ef274e02ae9355bed56a6405fb001bd7694a6dd78acdc574065e |
| manifest-exact.json sha256 (fp32) | b576eb72a442d074c669f4cfd92b178ddf571d295d067db0b5e7891b5e67fd8e |
| vocab.txt sha256 | 07eced375cec144d27c900241f3e339478dec958f92fddbc551f295c992038a3 |
| rwxlite prereg commit (rwxlite repo) | 87f501d83d06e1f162866095197c8b9d21a4edfc |

Model dir: /home/hamr/PycharmProjects/rwxlite/data/m1-r16 (manifest-exact.json, model-fp32.onnx, vocab.txt). The v0.5.0 tag and release do not exist; the scorer loads the package by git archive of the package ref and the model from this dir, with GitHub blocked. rwxlite's other commits: 0eb4230 (dev model and prediction sha256s, before its dev scoring), a9eb49a (dev result, PASS), 601e5f3 (addendum values doc only). The prereg commit field is 87f501d, section 16, the rule written before training.

Only fp32 is scored (rwxmap's default model). The int8 per-channel model
(`--model small`) is not part of this exam, for either the baseline or the candidate.

How the candidate is scored: as it would ship (D135 scoring method, unchanged).
Today's CLI accepts only rwxlite 0.4.x, and its offline cache fallback names the
exact pinned version. The unchanged CLI is used only when the candidate's tag
equals the shipped `v0.4.0`. For any other tag the CLI would show "rwxlite: off",
because the cache fallback names exactly v0.4.0, so the scorer makes a SECOND
scratch copy of the same rwxmap commit and changes exactly one line in it:
`RWXLITE_TAG` in `src/modeldownload.js` becomes the candidate's tag (the package
range is derived from that constant, so nothing else moves). That change lives
only in the scorer's scratch install, never in the repo `src/`. The scorer applies
the change, prints the unified diff, and fails unless the diff is exactly that one
line in that one file (and the two copies list the same files). The baseline copy
has no change. If a candidate cannot run this way (for example its package or
manifest layout differs), the exam stops and is reported; no bypass is added to
`src/`. If rwxmap ships the candidate, the same one-line change (and the cache
fallback that follows from it) is what goes out.

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
| a-base | (none: mode a) | shipped 0.4.0 fp32 `rwxlite-0.4.0+4608f470` | gate reference |
| a-cand | (none: mode a) | candidate fp32 | **GATE (D142)** |
| b85-base | `--engine rwxlite` (default confidence 85, D140) | 0.4.0 fp32 | reported |
| b85-cand | `--engine rwxlite` (default confidence 85) | candidate fp32 | reported |

Jev (mode c) is not scored (paid).

Commands (`<T>` is the committed truth sha256). Baseline only, no verdict on the
gate:

```
node data/exam8-2026-11-23/score/score.mjs --rwxmap-ref <ref> --truth-sha <T> \
  --models-base /home/hamr/PycharmProjects/rwxlite/data/m1-r15
```

With the candidate (every value copied from the committed CANDIDATE ADDENDUM).
`--rwxmap-ref` is required and is the commit that holds the filled addendum; there
is no HEAD default.

```
node data/exam8-2026-11-23/score/score.mjs --rwxmap-ref <ref> --truth-sha <T> \
  --models-base /home/hamr/PycharmProjects/rwxlite/data/m1-r15 \
  --cand-models <dir> --cand-version <ver> --cand-ref <rwxlite-commit> \
  --cand-tag <tag> --cand-model <model-string> --cand-model-sha <sha256> \
  --cand-manifest-sha <sha256> --cand-vocab-sha <sha256> \
  --cand-prereg-commit <rwxlite-prereg-commit>
```

`--config` may name a subset of the configs only for a crash rerun.

## Output

Per config: exact, loose-1, loose-2, too loose (loose-1 + loose-2) and too tight,
each as a count and a share of 1821, per vendor and per method. Per-vendor and
per-method lines show the share of the group's own rows and the share of 1821.
Every too-loose row is listed with its marker (tight, loose or settled). rwxlite
sent / raised / lowered / kept / undecided counts are printed for each rwxlite
config. Rows where a-base and a-cand differ are listed with truth. Each run writes
`score/rows-<config>.csv`. Too loose (letter below truth) and too tight (letter
above truth) are never folded into one number.

## Bars (set before scoring)

- **D142 GATE (user ruling, agreed by the user before any exam #8 score
  existed; the same gate as exam #7).** Real CLI,
  fp32, mode a, same 1821 rows. Round 16 replaces 0.4.0 only if BOTH: (1) a-cand
  exact >= a-base exact (a tie passes); (2) a-cand too-loose share <= a-base
  too-loose share + 1.0 percentage point. Integer form: 1.0 point of 1821 is
  18.21 rows, so cand.loose - base.loose <= floor(0.01 x n) = 18 (the scorer
  computes it from n and prints the allowance used). Anything else is NO-GO and
  0.4.0 stays. Too tight is reported beside the gate and is not part of it. The
  gate is the CLI number, not rwxlite's own scorer.
- **D133 mode a bar, reported only, for both a-base and a-cand against mech.** On
  the same 1821 rows: too loose <= mech's too loose AND exact >= mech's exact +
  5.0 percentage points. 5.0 points of 1821 is 91.05 rows, so at least 92 more
  exact rows than mech (ceil(0.05 x 1821) = 92, computed on integer counts).
- **D140 mode b at 85: no bar.** Reported for b85-base and b85-cand with their
  too-loose, too-tight and asked (undecided) counts.

## Order

1. Inputs frozen (70630cf, 88d4171). Done.
2. Blind labelling by A and B, validation of every file, the user rules every
   disagreement; truth built and held. Done, before this prereg (see the order
   note).
3. Code ref ecee4f1 frozen; the lean built. Done.
4. This prereg is committed. Done.
5. The CANDIDATE ADDENDUM is filled in and committed (rwxmap and rwxlite agree on
   the same ref, tag, hashes and model string), together with the truth sha256
   (written into this file). Done, in this commit.
6. The truth sha256 is sent to rwxlite; `truth.csv` is opened only now.
7. rwxlite commits its prediction hashes.
8. Each side scores once, on the same rows. A rerun is allowed only for a crash or
   a row-join bug, recorded with the reason. No change of model, code, config, cut
   or text after any prediction exists. Anything a result suggests needs a new
   exam with new vendors.
9. Results go to `docs/logs/learnings.md`, the README and the PRD (a result that
   changes a feature or a decision, D142, D140 and D144 included, goes to the PRD
   and the decisions log).

## Burn rule

As exams #6 and #7: once both sides have scored, exam #8 is BURNED. Its truth is
never edited (derived copies sit beside the originals), its rows and truth may be
used for training and tuning, and it is never an exam again. Any rule change after
this needs a new exam.

## Known limits

- Labels are model labels (Sonnet and Opus, blind) plus the user's rulings on
  disagreements, not authoritative truth. Agreement shows consistency, not truth.
  The user ruled the disputes by the plain rwx definitions; 98 of 110 were A w
  against B x, so the rulings carry weight in the x count.
- Labellers read the brief plus the D141 and D143 addenda, so labels follow
  readings that earlier exams' truth did not use.
- The order deviates from exam #7: truth was built before the prereg and the code
  ref (see the order note). The safeguards that remain are that D144's words were
  measured only on set A and the burned exam #7, that truth was not opened for
  D144, and that the lean has not been read against truth.
- baserow has no summary on any of its 488 ops and wekan has none on 87 of its
  157. Kept as published.
- GitHub pins are branch fetches (`main`); the recorded commit is the latest commit
  touching the file at survey time (wekan's is dated 2026-11-18, the survey day),
  so the sha256 is the real pin. gitbook, baserow, shortcut and bitrise are live
  vendor URLs with no commit: the sha256 is the only pin.
- looker's provider value `looker.com` is a chosen value: the spec names no
  looker.com host (the SDK spec's only server is localhost). wekan's provider is a
  join key and does not affect scoring.
- Selection was by row count and domain spread from a shortlist, not random.
- The leakage checks are on provider/vendor fields and path text. They do not rule
  out that rwxlite's training text held these vendors under another name.
- Some exam ops share exact method+path+summary with unrelated vendors' training
  rows (generic routes mostly), so those rows are not fully unseen text.
- Parity of rwxlite's per-row p's against the CLI is not checked by this scorer;
  rwxlite checks its own p files. A model's score belongs to the decision rule it
  was measured with, so rwxlite's own scorer is not the gate.
- Model files are copied into a scratch cache, not downloaded by the CLI; the
  production download path is not exercised.
- The candidate is scored as it would ship (D135 scoring method). If its tag differs
  from `v0.4.0` that needs the one-line `RWXLITE_TAG` change, because the CLI's
  offline cache fallback names the exact pinned version; the guard proves the diff
  is that line but cannot prove the real release would be built the same way.
- Mode a and mode b share a model; their rows are not independent. Base and
  candidate are scored on the same rows, so the gate is a paired comparison on 1821
  rows with integer counts. A one-row gap is decided by the written rule (an exact
  tie passes; too loose may rise by at most 18 rows), not by a significance test.
- The figures are for the one candidate named in the addendum only.
