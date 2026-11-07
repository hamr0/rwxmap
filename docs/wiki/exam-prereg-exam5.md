# Pre-registration (DRAFT): clean exam #5, rwxmap side (mechanical v4 gate)

**Status: SCORED and BURNED (2026-11-07). Gate result NO-GO as pre-registered;
the user overrode it and shipped v4 (D138). See "Results and findings" at the
end.** The text below is the pre-registration as it stood before scoring.
(Earlier status: DRAFT, written 2026-11-07. Not frozen.) The CANDIDATE ADDENDUM is
filled in, rwxlite has committed its side (acfb8d1), and the truth sha256 is now
filled in (see Labelling). The next step is sharing truth with rwxlite and
scoring once. The only classifier output on the exam rows is lean.csv (v4
letters, rules and markers, produced for rwxlite and kept away from the
labellers); no row has been scored.

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
- `truth.csv` sha256: **772ca84edf1e537f5e9b162229f59e3b0c439e55ba8f6f21f3070e058c70005a**
  (`truth.csv.sha256`). Built by `labelling/build-truth.mjs` from the 14
  labeller files and `labelling/rulings.csv`; two runs gave the same sha.
- Measured facts: 14 labeller files (A Sonnet and B Opus, for each of the 7
  vendors), all validated directly. Distinct reasons per file ranged from 98 to
  294. A and B agree on 1352 of 1443 rows (93.7%). Disagreements per vendor:
  fusionauth 58, semaphore 10, planetscale 9, hookdeck 5, weaviate 4, front 3,
  paddle 2. All 91 disagreements have the stricter label from B (Opus): 87 are
  A w vs B x, and 4 are A r vs B x. The user ruled all 91 on 2026-11-07, in
  pattern groups (`labelling/rulings.csv`, each row with its A and B labels and
  a note). 84 were ruled x and 7 were ruled w: the user-consent create/update
  rows ex5-0544, 0547, 0548 and 0549 (a non-access policy record, revocable)
  and the report or export rows ex5-0010, 0012 and 0819. Truth classes: r 671,
  w 354, x 418.
- Rejected file: the first B-front file was set aside in
  `labelling/rejected/B-front-truncated260.csv`. Its labeller cut every
  description to 260 characters (29 of the 246 front rows are longer), so
  B-front was relabelled from scratch by a new Opus labeller told to read every
  description in full. The remaining labellers got the same instruction; no
  file was rejected as scripted.

## Code under test

User ruling 2026-11-07: score v4 as it would ship, through the real CLI.

- rwxmap ref: the commit that freezes this file with the scorer (the one
  holding the filled addendum); it is passed explicitly as `--rwxmap-ref`, never
  left to the HEAD default. The scorer makes three scratch
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
(`id,class,rule,marker`) plus its sha256 to rwxlite. The CLI publishes no rule
names (by design), so the scorer checks (a) copy V4's real CLI class and marker
against `lean.csv`, and (b) the rule, by running copy V4's own `flow.js`
`classifyRow` in-process on the ops rows and comparing class, rule and marker
to `lean.csv`. Copy V4's `flow.js` is byte-identical to `poc/mech-v4/flow.js`.
Any difference stops the exam (user ruling 2026-11-07).

`lean.csv` was produced 2026-11-07, sha256
`93a76c5fad8f5baceecef4c087a95e03f070addeabbab1e356253221a09eb39d`, committed at
bbd9ab4 (`data/exam5-2026-11-07/lean.csv.sha256`). The file itself is kept out of
git at `.claude/scratchpad/exam5-lean/` so labellers never see a letter.

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

**CANDIDATE ADDENDUM: filled 2026-11-07.** The candidate is rwxlite R13;
rwxlite's own prereg is rwxlite commit acfb8d1 (`docs/wiki/prereg-exam5.md` in
the rwxlite repo). The orchestrator checked these values against the files in
the rwxlite repo. It is filled in, and committed, BEFORE the
truth sha256 is shared with rwxlite and before any scoring. The scorer refuses
to score any R13 config unless every value is filled in and checked against the
files.

| field | value |
|---|---|
| rwxlite package ref (commit in the rwxlite repo) | `f7456a2acc66ce84fd8c87d7426c9001bab8ceb7` |
| rwxlite tag / version | `v0.3.1` |
| manifest.json sha256 (int8) | `e8477a1595578eec1e45020277319877d45cfb809785b22eaeb83bfb66c0a5b8` |
| manifest-exact.json sha256 (fp32) | `c6bac86970888049952305f72434abe5c9d8f854224a5537f14e5a428a977739` |
| model-int8-pc.onnx sha256 | `984714f0342ce551779f0ed9d95be57f71ab30b2ef72baec1d9818ce96d465d7` |
| model-fp32.onnx sha256 | `bbe1997d43020724f9eab9e42e8f6337e9640fe46f764b6fceac1eb1d000a3cf` |
| vocab.txt sha256 | `07eced375cec144d27c900241f3e339478dec958f92fddbc551f295c992038a3` |
| fp32 model string | `rwxlite-0.3.1+bbe1997d` |
| int8 model string | `rwxlite-0.3.1+984714f0` |
| temperature (from the fp32 manifest) | `0.991463` |
| model.safetensors sha256 | `d16276d8b0ff93221821e2c3bd107b7d6898a8804bba93c40a2f4b06bbd6b30d` |

Model files at /home/hamr/PycharmProjects/rwxlite/data/m1-r13/ (local,
gitignored in rwxlite). The installable package is `rwxlite-0.3.1.tgz` in that
folder, sha256
`698c0191a772879ff424875f062fd54810dbd0eb7310b2bd8bb077c67476f7c0`. The scorer
extracts the tarball into its scratch package folder, not from the git ref
(rwxlite's dev package.json still says 0.2.1). Before use it checks that the
tarball's sha256 is the one above, that its package.json is rwxlite@0.3.1, and
that every file under its `src/` is byte-identical to `src/` at the package ref
f7456a2 (the same file list, the same bytes). onnxruntime-node comes from the
rwxlite checkout's node_modules, exactly as for the 0.2.0 baseline, so no npm
install runs. Tag v0.3.1 is proposed by rwxlite and not yet
created; 0.3.1 is the exam label.

Known now: rwxlite will send a scratch-installable R13 tarball. rwxlite will
feed v4's lean as is, with no aliases (rwxlite commit 4e2bc5e).

The CLI harness is as exam #4: scratch install, scratch model cache, a preload
that blocks downloads, `XDG_CACHE_HOME` and `HOME` in scratch.

Parity. rwxlite commits its R13 fp32 predictions (`id,model,p_is_x,p_changes`,
one row per op, in `ops.csv` order; sha256 committed before truth) before the
truth is shared. The scorer checks that the real CLI run with R13 gives the
same verdicts (the real CLI run on copy V4-R13) as a replay of those committed predictions through the same
`secondPass`, row for row. The replay takes its mechanical verdicts from copy
V4-R13's `flow.js` in-process. A mismatch stops the exam and is reported.

rwxlite committed its predictions at acfb8d1 (hashes in rwxlite
`docs/wiki/exam5-predictions.sha256`). The parity check uses
`predictions-r13.csv`.

| file | model, setting | sha256 |
|---|---|---|
| predictions-r13.csv | rwxlite-0.3.1+bbe1997d, T 0.991463, fp32, batch 1 | `1633417853a141cab079513dc78e8b538714bd6f46b729adb95876b34d3a73de` |
| predictions-v020.csv | rwxlite-0.2.0+8503b655, T 0.844, fp32, batch 1 | `906c0edd1a237172b3e08884f87faa538be7aacee64a633399f55905aa14f162` |

Both models were fed the same lean (id,class,rule), sha256
`e17922ad3b0c1cb90604af2d9c03dd60bcf2fde73fab8434cbaf8d1bcc370d80`, equal on
id,class,rule to rwxmap's `lean.csv`. Files:
/home/hamr/PycharmProjects/rwxlite/data/exam5-2026-11-07/ (gitignored).

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
  pre-registration is authoritative for its bar; rwxlite commit: acfb8d1.
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

## Results and findings (after scoring, 2026-11-07)

Source: `.claude/scratchpad/exam5-score/score.txt`.

### Run facts

- Scored once at rwxmap 36fb827, exit 0. All copy guards passed.
- 1443 of 1443 rows joined for every config. The lean check passed on 1443 rows.
- Parity passed: the replay of predictions-r13.csv equals the a-r13-v4 CLI run on 1443 rows, and on the sent/raised/lowered/kept/undecided counts.
- rwxlite scored its side with the same numbers (rwxlite a864560). Its secondPass replica matches our CLI letters on all 1443 rows.
- Exam #5 is BURNED for both sides.

### Main table (of 1443)

| config | exact | loose-1 | loose-2 | too loose | too tight | rwxlite sent / raised / lowered / kept / undecided |
|---|---|---|---|---|---|---|
| mech-v3 | 1188 (82.3%) | 75 (5.2%) | 2 (0.1%) | 77 (5.3%) | 178 (12.3%) | none |
| mech-v4 | 1201 (83.2%) | 57 (4.0%) | 2 (0.1%) | 59 (4.1%) | 183 (12.7%) | none |
| a-020-v3 (ships today) | 1274 (88.3%) | 98 (6.8%) | 2 (0.1%) | 100 (6.9%) | 69 (4.8%) | 645 / 8 / 139 / 407 / 91 |
| a-020-v4 | 1272 (88.1%) | 92 (6.4%) | 2 (0.1%) | 94 (6.5%) | 77 (5.3%) | 647 / 8 / 148 / 387 / 104 |
| a-r13-v4 | 1220 (84.5%) | 35 (2.4%) | 2 (0.1%) | 37 (2.6%) | 186 (12.9%) | 647 / 49 / 23 / 457 / 118 |

rwxlite's standalone scorer (exact / too loose / too tight): R13 1283 / 64 / 96; 0.2.0 1281 / 141 / 21.

### By method (of the method's rows)

mech-v3:

| method | exact | too loose | too tight | rows |
|---|---|---|---|---|
| DELETE | 168 (98.8%) | 0 (0.0%) | 2 (1.2%) | 170 |
| GET | 620 (99.5%) | 3 (0.5%) | 0 (0.0%) | 623 |
| PATCH | 86 (78.2%) | 23 (20.9%) | 1 (0.9%) | 110 |
| POST | 224 (54.0%) | 17 (4.1%) | 174 (41.9%) | 415 |
| PUT | 87 (71.3%) | 34 (27.9%) | 1 (0.8%) | 122 |

mech-v4:

| method | exact | too loose | too tight | rows |
|---|---|---|---|---|
| DELETE | 168 (98.8%) | 0 (0.0%) | 2 (1.2%) | 170 |
| GET | 620 (99.5%) | 3 (0.5%) | 0 (0.0%) | 623 |
| PATCH | 86 (78.2%) | 16 (14.5%) | 8 (7.3%) | 110 |
| POST | 242 (58.3%) | 17 (4.1%) | 156 (37.6%) | 415 |
| PUT | 82 (67.2%) | 23 (18.9%) | 17 (13.9%) | 122 |

a-r13-v4:

| method | exact | too loose | too tight | rows |
|---|---|---|---|---|
| DELETE | 168 (98.8%) | 0 (0.0%) | 2 (1.2%) | 170 |
| GET | 620 (99.5%) | 3 (0.5%) | 0 (0.0%) | 623 |
| PATCH | 73 (66.4%) | 13 (11.8%) | 24 (21.8%) | 110 |
| POST | 270 (65.1%) | 7 (1.7%) | 138 (33.3%) | 415 |
| PUT | 86 (70.5%) | 14 (11.5%) | 22 (18.0%) | 122 |

(HEAD, 3 rows, is exact in all three.)

### Gate (mechanical v4 vs v3, mechanical alone, integer counts)

1. Too loose (loose-1 + loose-2): v4 59 vs v3 77 (-18), OK.
2. Loose-2: v4 2 vs v3 2 (+0), OK.
3. Too tight: v4 183 vs v3 178 (+5), FAIL.

Gate: NO-GO as pre-registered. Beside it: exact v4 1201 vs v3 1188, of 1443.

**User override (2026-11-07, D138).** The user ruled to ship v4 anyway. Fewer leaks (-18, 23% fewer: 18 of 77) matter more than 5 more too-tight rows (+0.3 points of 1443), and every one of those rows is marked tight for review. The gate result is recorded unchanged. The override is a decision taken after the result, not a pass.

### rwxlite's bar (reported only)

a-r13-v4 vs a-020-v4: too loose 37 vs 94 (-57), OK; exact 1220 vs 1272 (-52), FAIL. Result: FAIL. rwxlite recorded R13 NO-GO (a864560). 0.2.0 stays; nothing released.

### D133 mode a bar (reported only)

Bar: too loose no worse than mech-v4 (59) and exact at least +5 points (73 more rows of 1443). All three mode a configs FAIL.

- a-020-v3: too loose 100 vs 59, FAIL (exact +5.06 points, OK).
- a-020-v4: too loose 94 vs 59, FAIL; exact +4.92 points, FAIL.
- a-r13-v4: too loose 37 vs 59, OK; exact +1.32 points, FAIL.

### Findings

- (a) v4 vs v3: 65 rows differ in letter (2 more differ only in marker). POST content nouns turned 18 too-tight rows exact (POST too tight 174 -> 156) and opened 3 leaks: ex5-0276 and ex5-0281 (fusionauth CIMD domain, word "domain") and ex5-1148 (planetscale SSO domains). PUT/PATCH path words closed 18 leaks (PUT 11, PATCH 7) and made 23 rows too tight (PUT 16, PATCH 7), all marked tight. Three more leaks closed on POST (ex5-1157, ex5-1336, ex5-1339), so leaks went 77 - 21 + 3 = 59. The false fires on truth-w rows:
  - fusionauth role, scope and permission edits: ex5-0266, 0268 (application role), 0272, 0274 (application scope), 0286, 0288 (cimd domain scope), 0335, 0337 (entity type permission), 0425 (key).
  - hookdeck destination enable/disable/archive/unarchive and integration attach/detach: ex5-0664, 0665, 0666, 0667, 0679, 0680, 0681.
  - planetscale keyspaces ("key" matched inside the word): ex5-0977, 0984, 0988; and roles ex5-1037.
  - semaphore integration edits: ex5-1201, 1208, 1212.
  - Exact rows where v3 and v4 differ in letter, id provider method path truth v3->v4 (markers v3/v4):
    - ex5-0031 frontapp POST /company/tags w x->w (tight/loose)
    - ex5-0134 frontapp POST /message_template_folders w x->w (tight/loose)
    - ex5-0139 frontapp POST /message_template_folders/{message_template_folder_id}/message_template_folders w x->w (tight/loose)
    - ex5-0141 frontapp POST /message_template_folders/{message_template_folder_id}/message_templates w x->w (tight/loose)
    - ex5-0143 frontapp POST /message_templates w x->w (tight/loose)
    - ex5-0165 frontapp POST /tags w x->w (tight/loose)
    - ex5-0200 frontapp POST /teammates/{teammate_id}/message_template_folders w x->w (tight/loose)
    - ex5-0202 frontapp POST /teammates/{teammate_id}/message_templates w x->w (tight/loose)
    - ex5-0210 frontapp POST /teammates/{teammate_id}/tags w x->w (tight/loose)
    - ex5-0225 frontapp POST /teams/{team_id}/message_template_folders w x->w (tight/loose)
    - ex5-0227 frontapp POST /teams/{team_id}/message_templates w x->w (tight/loose)
    - ex5-0234 frontapp POST /teams/{team_id}/tags w x->w (tight/loose)
    - ex5-0252 fusionauth PATCH /api/api-key/{keyId} x w->x (loose/tight)
    - ex5-0254 fusionauth PUT /api/api-key/{keyId} x w->x (loose/tight)
    - ex5-0266 fusionauth PATCH /api/application/{applicationId}/role/{roleId} w w->x (loose/tight)
    - ex5-0268 fusionauth PUT /api/application/{applicationId}/role/{roleId} w w->x (loose/tight)
    - ex5-0272 fusionauth PATCH /api/application/{applicationId}/scope/{scopeId} w w->x (loose/tight)
    - ex5-0274 fusionauth PUT /api/application/{applicationId}/scope/{scopeId} w w->x (loose/tight)
    - ex5-0276 fusionauth POST /api/cimd/domain x x->w (tight/loose)
    - ex5-0281 fusionauth POST /api/cimd/domain/{domainId} x x->w (tight/loose)
    - ex5-0286 fusionauth PATCH /api/cimd/domain/{domainId}/scope/{scopeId} w w->x (loose/tight)
    - ex5-0288 fusionauth PUT /api/cimd/domain/{domainId}/scope/{scopeId} w w->x (loose/tight)
    - ex5-0310 fusionauth POST /api/email/template w x->w (tight/loose)
    - ex5-0316 fusionauth POST /api/email/template/{emailTemplateId} w x->w (tight/loose)
    - ex5-0335 fusionauth PATCH /api/entity/type/{entityTypeId}/permission/{permissionId} w w->x (loose/tight)
    - ex5-0337 fusionauth PUT /api/entity/type/{entityTypeId}/permission/{permissionId} w w->x (loose/tight)
    - ex5-0364 fusionauth PUT /api/group/member x w->x (loose/tight)
    - ex5-0396 fusionauth PATCH /api/integration x w->x (loose/tight)
    - ex5-0397 fusionauth PUT /api/integration x w->x (loose/tight)
    - ex5-0401 fusionauth PATCH /api/ip-acl/{accessControlListId} x w->x (loose/tight)
    - ex5-0403 fusionauth PUT /api/ip-acl/{accessControlListId} x w->x (loose/tight)
    - ex5-0425 fusionauth PUT /api/key/{keyId} w w->x (loose/tight)
    - ex5-0439 fusionauth POST /api/message/template w x->w (tight/loose)
    - ex5-0444 fusionauth POST /api/message/template/{messageTemplateId} w x->w (tight/loose)
    - ex5-0540 fusionauth POST /api/user/comment w x->w (tight/loose)
    - ex5-0601 fusionauth PATCH /api/webhook/{webhookId} x w->x (loose/tight)
    - ex5-0603 fusionauth PUT /api/webhook/{webhookId} x w->x (loose/tight)
    - ex5-0659 hookdeck PUT /destinations x w->x (loose/tight)
    - ex5-0663 hookdeck PUT /destinations/{id} x w->x (loose/tight)
    - ex5-0664 hookdeck PUT /destinations/{id}/archive w w->x (loose/tight)
    - ex5-0665 hookdeck PUT /destinations/{id}/disable w w->x (loose/tight)
    - ex5-0666 hookdeck PUT /destinations/{id}/enable w w->x (loose/tight)
    - ex5-0667 hookdeck PUT /destinations/{id}/unarchive w w->x (loose/tight)
    - ex5-0679 hookdeck PUT /integrations/{id} w w->x (loose/tight)
    - ex5-0680 hookdeck PUT /integrations/{id}/attach/{source_id} w w->x (loose/tight)
    - ex5-0681 hookdeck PUT /integrations/{id}/detach/{source_id} w w->x (loose/tight)
    - ex5-0702 hookdeck PUT /notifications/webhooks x w->x (loose/tight)
    - ex5-0708 hookdeck PUT /organizations/current/api-keys/{id} x w->x (loose/tight)
    - ex5-0759 paddle PATCH /client-tokens/{client_token_id} x w->x (loose/tight)
    - ex5-0977 planetscale PATCH /organizations/{organization}/databases/{database}/branches/{branch}/keyspaces/{keyspace} w w->x (loose/tight)
    - ex5-0984 planetscale PUT /organizations/{organization}/databases/{database}/branches/{branch}/keyspaces/{keyspace}/resizes w w->x (loose/tight)
    - ex5-0988 planetscale PATCH /organizations/{organization}/databases/{database}/branches/{branch}/keyspaces/{keyspace}/vschema w w->x (loose/tight)
    - ex5-1037 planetscale PATCH /organizations/{organization}/databases/{database}/branches/{branch}/roles/{id} w w->x (loose/tight)
    - ex5-1118 planetscale PATCH /organizations/{organization}/databases/{database}/webhooks/{id} x w->x (loose/tight)
    - ex5-1129 planetscale PATCH /organizations/{organization}/members/{id} x w->x (loose/tight)
    - ex5-1148 planetscale POST /organizations/{organization}/sso/domains x x->w (tight/loose)
    - ex5-1157 planetscale POST /organizations/{organization}/teams/{team}/members x w->x (loose/tight)
    - ex5-1176 semaphoreui PUT /global-roles/{role_id} x w->x (loose/tight)
    - ex5-1201 semaphoreui PUT /project/{project_id}/integrations/{integration_id} w w->x (loose/tight)
    - ex5-1208 semaphoreui PUT /project/{project_id}/integrations/{integration_id}/matchers/{matcher_id} w w->x (loose/tight)
    - ex5-1212 semaphoreui PUT /project/{project_id}/integrations/{integration_id}/values/{extractvalue_id} w w->x (loose/tight)
    - ex5-1221 semaphoreui PUT /project/{project_id}/keys/{key_id} x w->x (loose/tight)
    - ex5-1251 semaphoreui POST /project/{project_id}/templates w x->w (tight/loose)
    - ex5-1336 weaviate POST /authz/roles/{id}/add-permissions x w->x (loose/tight)
    - ex5-1339 weaviate POST /authz/roles/{id}/remove-permissions x w->x (loose/tight)
- (b) Shipped mode a (0.2.0) makes too loose WORSE than mechanical alone on v4 truth: 100 vs 77 on v3 and 94 vs 59 on v4. 0.2.0 was trained before D137 widened x, so its confident lowerings land on rows that are now x (148 lowered on v4).
- (c) R13 halves too loose against 0.2.0 (37 vs 94) and is the safest config measured. It pays in asks: it lowers only 23 rows at p >= 0.97 against 148, so 186 rows stay too tight (of 1443).
- (d) v4's remaining 59 leaks by rule: PUT method-floor 23, PATCH method-floor 16, POST modify-verb 13, POST content-noun 3, GET method 3, POST read-verb 1. fusionauth holds 27 of the 59.
- (e) Labeller agreement was 93.7%, against 98.7% on exam #4. All 91 disputes had Opus stricter, and 58 of the 91 were fusionauth.
