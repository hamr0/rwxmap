# Pre-registration (DRAFT): shared clean exam #4, rwxmap side (D135 next-model gate)

**Status: DRAFT, written 2026-11-04. Not frozen.** It freezes when this file is
committed with the scorer (`data/exam4-2026-11-04/score/`), the CANDIDATE
ADDENDUM below is filled in and committed, the truth sha256 is filled in, and
rwxlite has committed its side. No config below has been run on the real ops
with a real truth. The scorer's dry run used a fake truth (every label x), the
baseline only, and looked only at the join count and the model strings.

The exam answers one question (D135): may a newer rwxlite model replace 0.2.0
as the model rwxmap ships? It compares two models on the same rows. It is not a
new tuning round; nothing here is fitted to its own rows.

## Rows

Frozen in commit 1a1cc38: `data/exam4-2026-11-04/ops.csv`, 1505 operations,
sha256 `e9836ff2f9e8288e3721f97506ed666b871a3486f7b781c544b5234a0b5da0b4`
(`ops.csv.sha256`). Specs are each vendor's own official OpenAPI, original
bytes, `data/exam4-2026-11-04/specs/` (hashes in `sources.json`).

| vendor | provider in ops.csv | operations |
|---|---|---|
| permit | permit.io | 263 |
| immich | immich.app | 279 |
| polar | polar.sh | 190 |
| harbor | goharbor.io | 203 |
| zulip | zulip.com | 161 |
| chatwoot | chatwoot.com | 157 |
| render | render.com | 252 |
| total | | 1505 |

Denominator for every percentage: 1505 rows. Asked/undecided rows are scored as
x (the letter rwxmap publishes for them).

Leakage check (rwxlite's suggestion). Exclusion against every vendor and
registrable domain in the prior exams, tuning sets and holdouts was checked on
the provider/vendor fields and registrable domain labels, never on free text
(render, polar and harbor are ordinary words in other vendors' descriptions).
The record is `poc/exam4-shortlist/` (`excluded-vendors.txt`, `aliases.json`,
`check-exclusions.mjs`, `exclusion-check.json`, `exclusion-counts.txt`); the
brand aliases of the seven vendors are in `data/exam4-2026-11-04/README.md`.
This is a check on those fields only. It cannot show that a vendor's text was
never in rwxlite's training data under another name.

## Labelling (truth)

- Brief: `data/relabel-2026-09-22/BRIEF-v3.md` verbatim, no edits. sha256
  `344bf93b75ae6167af576507ce65b35ec04e2cfa3d5334fc12150bbe13ef5ff3`, the same
  as exam #3's (re-checked 2026-11-04).
- Two blind labellers, A and B, label every row. The labeller prompt tells them
  to read each row and use no scripts. After each file the number of distinct
  reasons is checked: a scripted pass shows as few distinct reasons, and such a
  file is rejected and relabelled by a new labeller (kept in
  `labelling/rejected/`). Every labeller file is validated directly (header, row
  order, classes), not from the labeller's own counts.
- Where A and B disagree, the user rules the row (`labelling/rulings.csv`, each
  with its A and B labels and a reason). rwxmap builds truth; Jev is never used.
  Labeller outputs go in `data/exam4-2026-11-04/labelling/`; the ruled result is
  `truth.csv` (`id,label`, label r|w|x, 1505 rows) in `data/exam4-2026-11-04/`.
- `truth.csv` sha256: **b76c55fb30235726489574c90425c2c53b8343467e2fd918603952d135313c45**
  (`truth.csv.sha256`). Built by `labelling/build-truth.mjs` from the 14
  labeller files and `labelling/rulings.csv`; two runs gave the same sha.
- Measured facts: 14 labeller files (A and B for each of 7 vendors), all
  validated directly. A and B agree on 1485 of 1505 rows (98.7%). Per vendor
  (agreed/rows): permit 257/263, immich 275/279, polar 188/190, harbor 202/203,
  zulip 154/161 (5 class disagreements plus 2 rows both marked ?), chatwoot
  157/157, render 252/252. The 20 disputed rows were ruled by the user on
  2026-11-05 (`labelling/rulings.csv`, each with its A and B labels and a
  reason; one row, ex4-0355 harbor DELETE /users/{user_id}, was ruled x against
  the orchestrator's suggestion of w). Truth classes: r 715, w 467, x 323.
  Distinct-reason counts per file ranged 72-210; no file was rejected as
  scripted.
- Custody: rwxmap holds `truth.csv`. `truth.csv` and `labelling/out/` stay out
  of git until both sides have scored; only their sha256 are committed
  (`truth.csv.sha256`, and `labelling/out.sha256`, which lists the sha256 of
  each labeller out file and `rulings.csv`). `truth.csv` is opened for scoring
  only after both preregs are committed, the CANDIDATE ADDENDUM is filled in and
  the truth sha256 is committed. Only then is it shared with rwxlite, whose
  scorer checks the same sha256.

## Code under test

- rwxmap commit: **this prereg commit**. The scorer takes a scratch copy of it
  (`git archive` of `src` and `package.json` at `--rwxmap-ref`, default HEAD) and
  refuses to run if the working-tree `src/` or `package.json` differs from that
  ref. Nothing under `src/` is changed in the repo.
- The ranges and pins in force at that commit (D135): `src/modeldownload.js`
  pins `RWXLITE_TAG = 'v0.2.0'` for the manifest URLs and the offline cache
  fallback, and `src/rwxliteengine.js` accepts only rwxlite npm packages in the
  tag's minor line (0.2.x), else "rwxlite: off".

### BASELINE: rwxlite 0.2.0 as shipped

- Package: tag v0.2.0, commit `6c47fec6734e666462164025674b55e8323d5b86`, via
  `git archive` of `src` and `package.json` into a scratch folder. No rwxmap
  change (the shipped pin already is v0.2.0).
- Model files: the published v0.2.0 release assets
  (`https://github.com/hamr0/rwxlite/releases/download/v0.2.0/`). The scorer
  downloads any missing one into `--models-base` (default `<scratch>/models-base`)
  and then checks all five against these hashes before any run. Hashes read from
  the v0.2.0 manifests and the release files (the same ones
  `poc/rwxlite-021-parity/setup.mjs` downloads and checks):

| file | sha256 |
|---|---|
| manifest.json (int8-pc, `rwxlite-0.2.0+8ad0a182`) | `10407b787fae2cadc318780a8c4ad171dc07af1389129c284bfd85c54f6b38bc` |
| manifest-exact.json (fp32, `rwxlite-0.2.0+8503b655`) | `a484251cd4daf9c6fc7c8d2cb3f4a43f0cbdd6f4447d2c9ff65721a2f767b774` |
| model-int8-pc.onnx | `8ad0a182b37237adc819bda2c03c01f0cb0e40afc2b20bdacb06193cd62a8844` |
| model-fp32.onnx | `8503b655a25202f8d01ced40ab685c34b287f70db8c0651528ca476f1470a48b` |
| vocab.txt | `07eced375cec144d27c900241f3e339478dec958f92fddbc551f295c992038a3` |

Model strings: fp32 `rwxlite-0.2.0+8503b655`, int8 `rwxlite-0.2.0+8ad0a182`.

### CANDIDATE: the model rwxlite enters

**CANDIDATE ADDENDUM: filled 2026-11-05.** The candidate is rwxlite round 11 (r11), entered by rwxlite's user; rwxlite's own prereg is rwxlite commit 594227f. Values checked by the orchestrator against the rwxlite repo and the model files before this commit. This section is filled in, and committed, BEFORE the truth
sha256 is shared with rwxlite and before any scoring. The scorer refuses to
score any `*-cand` config unless every value below is given on its command line,
and checks each against the files (a model string must equal
`rwxlite-<version>+<first 8 hex of its model file's sha256>`, and must differ
from the baseline's). The scorer also reads this table as committed at
`--rwxmap-ref` (`git show <ref>:docs/wiki/exam-prereg-exam4.md`, never the
working tree) and refuses if any field says pending or any value differs from
the command line.

| field | value |
|---|---|
| rwxlite package ref (commit in the rwxlite repo) | `77e6bb485fcb3e119f3c3f02ceb649f1de0c9bbf` |
| rwxlite tag / version (the tag rwxmap would pin) | `v0.3.0` |
| manifest.json sha256 (int8) | `ff1ed6f12d7e6d237a96be2e600fa0da3438fd9a085801092b453df829cd052c` |
| manifest-exact.json sha256 (fp32) | `65e84b7697f725bac41550afd001aefe532ad2dd2ed1ce41ca6a349138244a80` |
| model-int8-pc.onnx sha256 | `adc6e6c130f8ba1716fa6b31e1ddce27e4b8eea8c76b336b8c1d53efdf3ea3e2` |
| model-fp32.onnx sha256 | `252f31811a1a9316cea0c6fd3404f3674c9e253613604fcc46a5832377e43bf6` |
| vocab.txt sha256 | `07eced375cec144d27c900241f3e339478dec958f92fddbc551f295c992038a3` |
| fp32 model string | `rwxlite-0.3.0+252f3181` |
| int8 model string | `rwxlite-0.3.0+adc6e6c1` |

Model files: /home/hamr/PycharmProjects/rwxlite/data/m1-r11/ (local, gitignored in rwxlite). Tag v0.3.0 is annotated, local and unpushed; package.json 0.3.0; src/ identical to rwxlite 95b83c5.

How the candidate is scored: as it would ship (D135). Today's CLI accepts only
rwxlite 0.2.x, so a candidate packaged as 0.3.x would be "rwxlite: off" through
an unchanged rwxmap. The scorer therefore makes a SECOND scratch copy of the
same rwxmap commit and changes exactly one line in it: `RWXLITE_TAG` in
`src/modeldownload.js` becomes the candidate's tag (the package range is derived
from that constant, so nothing else moves). The scorer applies the change, prints
the unified diff, and fails unless the diff is exactly that one line in that one
file (and the two copies list the same files). The baseline copy has no change.
If a candidate cannot run this way (for example its package or manifest layout
differs), the exam stops and is reported; no bypass is added to `src/`.

How both builds are loaded without the user's cache: `score.mjs` builds one
scratch install per model (a real package folder `node_modules/rwxlite` with its
own `package.json`, so the version reader that walks up from the resolved entry
finds it), one model cache per model and variant laid out as rwxmap's cache
(`rwxlite-<version>+<sha8>/` with `manifest.json`, the model, `vocab.txt`), and a
preload (`score/preload.mjs`, `hooks.mjs`) given to the real CLI with
`node --import`. The preload resolves `import('rwxlite')` to that model's
install and refuses requests to github.com and `*.githubusercontent.com`, so the
pinned-release download cannot replace the model under test and the CLI falls
back to the verified scratch cache. `XDG_CACHE_HOME` and `HOME` point into the
scratch folder; `~/.cache/rwxmap` is not read or written. The run fails loudly on
"rwxlite: off", a wrong model string, a wrong pass or confidence (never scored
as mechanical).

## Configs

Each runs the real CLI (`node src/cli.js <spec> --vendor <name> -o <scratch>`,
from the scratch rwxmap copy) on each of the 7 specs, from a scratch folder with
no `.env`, and the scorer joins every operation to `ops.csv` by (provider,
METHOD, path), 1:1 (any unmatched, extra or duplicate row fails the run).

| config | flags | model | role |
|---|---|---|---|
| mech | `--engine mechanical` | none | reference |
| a-fp32-base | (none: mode a) | baseline fp32 `rwxlite-0.2.0+8503b655` | gate reference |
| a-fp32-cand | (none: mode a) | candidate fp32 | **GATE** |
| a-int8-base | `--model small` | baseline int8 `rwxlite-0.2.0+8ad0a182` | info |
| a-int8-cand | `--model small` | candidate int8 | info |
| b95-fp32-base | `--engine rwxlite --confidence 95` | baseline fp32 | info |
| b95-fp32-cand | `--engine rwxlite --confidence 95` | candidate fp32 | info |
| c-jev | `--engine jev` (paid; only with `--jev`) | Jev | existing bars |

c-jev is as in exam #3: paid, only with `--jev` and `RWXMAP_JEV_KEY` in the
environment, never part of a routine run.

Commands (`<T>` is the committed truth sha256). Baseline only, no verdict on the
gate:

```
node data/exam4-2026-11-04/score/score.mjs --truth-sha <T>
```

With the candidate (every value copied from the committed CANDIDATE ADDENDUM).
`--rwxmap-ref` is passed explicitly and is the commit that holds the filled
addendum (the scorer's rwxmap code and the addendum it checks are both read at
that commit); do not rely on the HEAD default:

```
node data/exam4-2026-11-04/score/score.mjs --truth-sha <T> \
  --rwxmap-ref <commit holding the filled addendum> \
  --cand-ref <rwxlite commit> --cand-tag <vX.Y.Z> --cand-models <dir> \
  --cand-file manifest.json=<sha> --cand-file manifest-exact.json=<sha> \
  --cand-file model-int8-pc.onnx=<sha> --cand-file model-fp32.onnx=<sha> \
  --cand-file vocab.txt=<sha> \
  --cand-model-fp32 <model string> --cand-model-int8 <model string>
```

Add `--jev` (with `RWXMAP_JEV_KEY` in the environment) to run c-jev. Each run
writes `score/rows-<config>.csv` (id, provider, method, path, truth, letter,
review, evidence) and prints per config: exact / too loose / too tight as counts
and share of 1505, per vendor, per method, rwxlite sent/raised/lowered/kept/
undecided, and every too-loose row for mech, a-fp32-base, a-fp32-cand and
c-jev, plus the rows where a-fp32-base and a-fp32-cand differ. Too loose (letter
below truth) and too tight (letter above truth) are never folded into one number.

## Bars (set before scoring)

- **D135 GATE (user ruling 2026-11-04: "better or same, no regression").** The
  candidate replaces 0.2.0 only if, on the same 1505 rows, a-fp32-cand's too
  loose <= a-fp32-base's too loose AND a-fp32-cand's exact >= a-fp32-base's
  exact. Integer counts. A tie on either passes that half. Too tight is reported
  beside the gate and is not part of it. If the gate fails, 0.2.0 stays.
- **D133 mode a bar, reported for both models (not the gate).** Against mech, on
  the same 1505 rows: too loose <= mech's too loose AND exact >= mech's exact +
  5.0 percentage points. 5.0 points of 1505 is 75.25 rows, so at least 76 more
  exact rows than mech (ceil(0.05 x 1505) = 76; computed on integer counts).
  Reported for a-fp32 and a-int8, base and cand.
- **Mode b (D133).** No pass/fail bar. Reported at confidence 95 with its
  too-loose, too-tight and asked (undecided) counts.
- **Mode c (existing Jev bars).** The M3 gate (D89 as amended by D94; Jev shipped
  on it by D119), as in exam #3: too loose <= 2% of all rows, every one listed
  (item 1); too tight <= 20% of rows, reported and never traded against item 1
  (item 2). Item 3 (LOVO on the tuning set) does not apply to a clean exam. Jev
  is non-deterministic: a near-bar result must repeat on a second run, and no
  threshold is pinned from one run.

## Order

1. This prereg is committed by rwxmap and by rwxlite.
2. The CANDIDATE ADDENDUM is filled in and committed (rwxmap and rwxlite agree on
   the same ref, tag, hashes and model strings).
3. Truth is built (two blind labellers per row, the user rules disagreements) and
   its sha256 is committed (written into this file).
4. The truth sha256 is shared with rwxlite; `truth.csv` is opened only now.
5. Each side scores once, on the same rows. A rerun is allowed only for a crash
   or a row-join bug, recorded with the reason. No change of model, code, config,
   cut or text after any prediction exists. Anything a result suggests needs a
   new exam with new vendors.
6. Results go to `docs/logs/learnings.md`; a result that changes a feature or a
   decision (D135 included) goes to the PRD and the decisions log.

## Burn rule

After both sides have scored, exam #4 is BURNED as an exam: its rows and truth
may be used for training and tuning, and it is never an exam again. Any rule
change after this needs a new exam.

## Known limits

- Both labellers are the same model family (Sonnet), so their errors can be
  correlated; their agreement partly reflects that.
- The labels are model labellers (two blind passes plus the user's ruling on
  disagreements), not an authoritative ground truth; labeller error caps what
  any figure can say.
- Exam #4's seven vendors came from outside every set either project holds
  (`poc/exam4-shortlist/`). The next exam will need new vendors again; D132
  released the ten vendors locked in `docs/logs/pre-registered-split-2026-09-18.md`,
  so they are no longer a reserve.
- The leakage check is on provider/vendor fields and registrable domains. It does
  not rule out that rwxlite's training text held these vendors under another
  name.
- Parity of rwxlite's per-row p's against the CLI is not checked by this scorer:
  the combined JSON and sidecar carry only counts for the rwxlite pass. rwxlite
  checks its own p files.
- The model files are copied into a scratch cache, not downloaded by the CLI; the
  production download path (manifest, release tag, size caps) is not exercised.
  The baseline files are downloaded once by the scorer from the release and
  hash-checked.
- The candidate is scored as it would ship under D135, which needs the one-line
  `RWXLITE_TAG` change. The guard proves the diff is that line; it cannot prove
  the real release would be built the same way. If rwxmap ships the candidate, the
  same one-line change (and the cache fallback that follows from it) is what goes
  out.
- Mode a and mode b share a model; their rows are not independent. Base and
  candidate are scored on the same rows, so the gate is a paired comparison on
  1505 rows with integer counts; a one-row gap is inside reader noise and is
  decided by the written rule (tie passes), not by a significance test.
- The figures are for the one candidate named in the addendum only. rwxmap's
  shipped model changes only if the gate passes and the user rules it (D135);
  it is no longer "whatever rwxlite releases".
- int8 is reported but not gated. 0.2.0 int8 differs slightly from the CLI's
  replay near cut-offs (D133 parity finding), so int8 rows are information, not
  a basis for the decision.
