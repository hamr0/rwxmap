# Pre-registration (DRAFT): clean exam #5, rwxmap side (mechanical v4 gate)

**Status: DRAFT, written 2026-11-07. Not frozen.** It freezes when this file is
committed together with the scorer (`data/exam5-2026-11-07/score/`, not built
yet), the CANDIDATE ADDENDUM below is filled in, the truth sha256 is filled in,
and rwxlite has committed its side. Nothing has been classified on the exam
rows.

## The question

Main question (rwxmap's gate): does mechanical v4 (`poc/mech-v4`, frozen at
commit 40fe161, built against D137 truth v4) replace mechanical v3 (`src/`,
shipped)?

- If GO: v4 gets a D-number (expected D138), moves into `src/`, and v3 is
  archived.
- If NO-GO: v3 stays in `src/`, v4 stays in `poc/`, and the burned exam is
  never re-scored.

Second question, rwxlite's gate and not rwxmap's: may rwxlite R13 replace 0.2.0
(D135)? rwxmap runs mode a for it and records rwxlite's frozen bar.

## Rows

Frozen in commit 23a2b13: `data/exam5-2026-11-07/ops.csv`, 1443 operations,
sha256 `f6e245ed8e6953b8a7170a0bf6b6a371860460fc7206db6a5cbe23fbba1f26ea`
(`ops.csv.sha256`). Specs are each vendor's own official OpenAPI, original
bytes (paddle is gzipped, see the exam README), `data/exam5-2026-11-07/specs/`
(hashes in `sources.json`).

| vendor | provider in ops.csv | operations |
|---|---|---|
| front | frontapp.com | 246 |
| planetscale | planetscale.com | 291 |
| paddle | paddle.com | 126 |
| hookdeck | hookdeck.com | 135 |
| fusionauth | fusionauth.io | 364 |
| semaphore | semaphoreui.com | 155 |
| weaviate | weaviate.io | 126 |
| total | | 1443 |

Denominator for every percentage: 1443 rows. Asked or undecided rows are scored
as x. Langfuse was picked and then dropped: `src/load.js`'s default YAML alias
cap rejects its official spec, so weaviate replaced it (user ruling
2026-11-07).

Leakage check.

- rwxmap checked 51 candidates against 6,480 excluded names (record in
  `poc/exam5-shortlist/`).
- rwxlite checked its own training, val, gate and exam data: all 7 clean
  (rwxlite commit 33b484f, `docs/wiki/exam5-leakage.md` in the rwxlite repo).
- At the op level, 206 of 1443 ops (14.3%) share a method+path or operationId
  with some rwxlite training row. All are generic CRUD, and no training
  provider shares more than 14 ops with any one vendor.
- The same limit as exam #4 applies: this is a check on provider fields and
  aliases only.

## Labelling (truth)

- Brief: `data/relabel-v4-2026-11-05/BRIEF-v4.md` verbatim, no edits. sha256
  `f8add85988a382ff5770c3af28fb048b82099392cb456f17dcc1e79277f57cbd` (last
  changed in commit c756a28). Truth is v4 truth (D137 x).
- Labeller A is Sonnet, labeller B is Opus (different model families, user
  ruling 2026-11-06). Both are blind, label every row, and are told to use no
  scripts.
- The distinct-reason check, the direct validation of every labeller file, and
  the handling of rejected files are as exam #4.
- The user rules every disagreement (`labelling/rulings.csv`, each with its A
  and B labels and a reason). Jev is never used.
- Custody is as exam #4: `truth.csv` and `labelling/out/` stay out of git until
  both sides have scored, and only their sha256 are committed.
- `truth.csv` sha256: **pending**.

## Code under test

User ruling 2026-11-07: score v4 as it would ship, through the real CLI.

- rwxmap ref: the prereg commit (**pending**). The scorer makes three scratch
  copies of `src/` and `package.json` at that ref, via `git archive`.
- Copy V3 is unchanged.
- Copy V4 is the same, with exactly four files replaced by their `poc/mech-v4`
  versions at the same ref: `src/flow.js`, `src/step1.js`, `src/step2.js`,
  `src/step3.js`.
- Copy V4-R13 is copy V4 plus exactly one changed line: `RWXLITE_TAG` in
  `src/modeldownload.js` becomes the candidate's tag. Today's CLI accepts only
  rwxlite 0.2.x (the package range is derived from that constant, so nothing
  else moves), so R13 would be "rwxlite: off" through an unchanged copy. Copies
  V3 and V4 keep no tag change.
- The scorer prints the unified diff of V4-R13 against V4 and fails unless the
  diff is exactly that one line in that one file. If R13 cannot run this way
  (for example its package or manifest layout differs), the exam stops and is
  reported; no bypass is added to `src/`.
- The scorer fails unless all of these hold:
  - the three copies list the same files;
  - between V3 and V4, exactly those four files differ;
  - between V4 and V4-R13, exactly `src/modeldownload.js` differs, by that one
    line;
  - each replaced file is byte-identical to `poc/mech-v4/<name>`;
  - `tokens.js` and `types.js` are identical in `poc/mech-v4` and `src/`.
- The scorer refuses to run if the working-tree `src/`, `package.json` or
  `poc/mech-v4/` differs from the ref.
- `secondpass.js` imports `reviewHint` from `flow.js`, so copy V4 carries v4's
  marker rule: every PUT/PATCH/POST is marked by direction, and settled means
  class equals the method default.
- Nothing under `src/` is changed in the repo.

Lean file for rwxlite. After both preregs are committed, rwxmap runs
`poc/mech-v4/lean.mjs` (commit 94f6cc4) on `ops.csv` and sends `lean.csv`
(`id,class,rule,marker`) plus its sha256 to rwxlite. The scorer checks that
copy V4's CLI letters, rules and markers equal `lean.csv` row for row. Any
difference stops the exam.

## Models

### BASELINE: rwxlite 0.2.0 as shipped

- Package: tag v0.2.0, commit `6c47fec6734e666462164025674b55e8323d5b86`, via
  `git archive` of `src` and `package.json` into a scratch folder. No rwxmap
  change (the shipped pin already is v0.2.0).
- Model files: the published v0.2.0 release assets
  (`https://github.com/hamr0/rwxlite/releases/download/v0.2.0/`). The scorer
  downloads any missing one into `--models-base` (default
  `<scratch>/models-base`) and then checks all five against these hashes before
  any run.

| file | sha256 |
|---|---|
| manifest.json (int8-pc, `rwxlite-0.2.0+8ad0a182`) | `10407b787fae2cadc318780a8c4ad171dc07af1389129c284bfd85c54f6b38bc` |
| manifest-exact.json (fp32, `rwxlite-0.2.0+8503b655`) | `a484251cd4daf9c6fc7c8d2cb3f4a43f0cbdd6f4447d2c9ff65721a2f767b774` |
| model-int8-pc.onnx | `8ad0a182b37237adc819bda2c03c01f0cb0e40afc2b20bdacb06193cd62a8844` |
| model-fp32.onnx | `8503b655a25202f8d01ced40ab685c34b287f70db8c0651528ca476f1470a48b` |
| vocab.txt | `07eced375cec144d27c900241f3e339478dec958f92fddbc551f295c992038a3` |

Model strings: fp32 `rwxlite-0.2.0+8503b655`, int8 `rwxlite-0.2.0+8ad0a182`.

0.2.0 runs at its shipped temperature 0.844 as read from its manifest. Each
model runs at its own manifest temperature, and nothing is overridden.

### CANDIDATE: rwxlite R13

**CANDIDATE ADDENDUM: pending.** It is filled in, and committed, BEFORE the
truth sha256 is shared with rwxlite and before any scoring. The scorer refuses
to score any R13 config unless every value is filled in and checked against the
files.

| field | value |
|---|---|
| rwxlite package ref (commit in the rwxlite repo) | **pending** |
| rwxlite tag / version | **pending** |
| manifest.json sha256 (int8) | **pending** |
| manifest-exact.json sha256 (fp32) | **pending** |
| model-int8-pc.onnx sha256 | **pending** |
| model-fp32.onnx sha256 | **pending** |
| vocab.txt sha256 | **pending** |
| fp32 model string | **pending** |
| int8 model string | **pending** |
| temperature (from the fp32 manifest) | **pending** (rwxlite announced T 0.991463) |
| model.safetensors sha256 | `d16276d8b0ff93221821e2c3bd107b7d6898a8804bba93c40a2f4b06bbd6b30d` |

Known now: rwxlite will send a scratch-installable R13 tarball. rwxlite will
feed v4's lean as is, with no aliases (rwxlite commit 4e2bc5e).

The CLI harness is as exam #4: scratch install, scratch model cache, a preload
that blocks downloads, `XDG_CACHE_HOME` and `HOME` in scratch.

Parity. rwxlite commits its R13 fp32 predictions (`id,model,p_is_x,p_changes`,
one row per op, in `ops.csv` order; sha256 committed before truth) before the
truth is shared. The scorer checks that the real CLI run with R13 gives the
same verdicts (the real CLI run on copy V4-R13) as a replay of those committed predictions through the same
`secondPass`, row for row. A mismatch stops the exam and is reported.

## Configs

Each runs the real CLI from its scratch copy on each of the 7 specs, from a
scratch folder with no `.env`, and the scorer joins every operation to
`ops.csv` by (provider, METHOD, path), 1:1, as exam #4.

| config | copy | flags | model | role |
|---|---|---|---|---|
| mech-v3 | V3 | `--engine mechanical` | none | gate reference |
| mech-v4 | V4 | `--engine mechanical` | none | **GATE** |
| a-020-v3 | V3 | (mode a) | 0.2.0 fp32 | info: what ships today |
| a-020-v4 | V4 | (mode a) | 0.2.0 fp32 | rwxlite bar reference |
| a-r13-v4 | V4-R13 | (mode a) | R13 fp32 | rwxlite bar |

Each run writes `rows-<config>.csv` and prints, per config:

- exact;
- loose-1 (one class too loose);
- loose-2 (x scored r);
- too loose = loose-1 + loose-2;
- too tight.

Each is given as a count and as a share of 1443, per vendor and per method. It
also prints markers on the too-loose rows, every too-loose row for mech-v3,
mech-v4 and a-r13-v4, and the rows where mech-v3 and mech-v4 differ. Too loose
and too tight are never folded into one number. R13 standalone (mode b) is
scored on rwxlite's side.

## Bars (set before scoring)

- **rwxmap GATE (user ruling 2026-11-06).** mech-v4 vs mech-v3 on the same 1443
  rows, v4 truth, integer counts. GO only if all three hold:
  1. too loose (loose-1 + loose-2) of mech-v4 < that of mech-v3 (strictly
     lower);
  2. loose-2 of mech-v4 <= that of mech-v3;
  3. too tight of mech-v4 <= that of mech-v3.

  A tie on (1) fails. Mechanical alone decides; mode a is not part of rwxmap's
  gate.
- **rwxlite's bar (theirs, frozen by them, recorded here).** R13 vs 0.2.0,
  through rwxmap's `secondPass` (a-r13-v4 vs a-020-v4) and standalone on their
  side: no more too loose and no fewer exact; a tie passes. rwxlite's own
  pre-registration is authoritative for its bar; rwxlite commit: **pending**.
- **D133 mode a bar, reported only.** a-r13-v4 and a-020-v4 vs mech-v4: too
  loose <= mech-v4's, and exact >= mech-v4's exact + 5.0 points. That is
  ceil(0.05 x 1443) = 73 more exact rows (72.15 rounded up).

## Order

1. Both preregs are committed (rwxmap and rwxlite).
2. `lean.csv` is sent to rwxlite, and rwxlite commits its predictions and their
   sha256.
3. The CANDIDATE ADDENDUM is filled in and committed.
4. Truth is built and its sha256 is committed (written into this file).
5. Truth is shared, and each side scores once. A rerun is allowed only for a
   crash or a join bug, recorded with the reason. No change of code, rule,
   model, cut or text after any prediction exists.
6. Results go to `docs/logs/learnings.md`; a decision-changing result also goes
   to the PRD and the decisions log.

## Burn rule

As exam #4.

## Known limits

- v4's rules were fitted on six tuning sets scored on v4 truth, so its fitted
  85.2% exact flatters it. This exam is the first clean figure.
- Labellers are model labellers (Sonnet + Opus, then the user), not
  authoritative truth.
- Mode a's R13 was trained with v3-era leans. On rwxlite's 4,180 val rows, v4
  leans fed as is gave 3815/76/289 vs 3776/74/330 with v3 leans (right / too
  loose / too tight). That is their tuning data, not this exam.
- rwxlite reported on its val rows that content-noun lowered 8 of 58 truly-x
  rows to w. v4 stays frozen at 40fe161, and this is logged for after exam #5,
  not acted on.
- The vendor pool is thin for identity (fusionauth is the only pure identity
  vendor). Langfuse was dropped by a loader limit, which is a selection effect.
- The leakage check covers provider fields only.
- A one-row gap is decided by the written rule, not by a significance test.
