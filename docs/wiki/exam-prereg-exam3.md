# Pre-registration (DRAFT): shared clean exam #3, rwxmap side (D133)

**Status: DRAFT, written 2026-11-04. Not frozen.** It freezes when this file is
committed with the scorer (`data/exam3-2026-11-04/score/`), the truth sha256 is
filled in, and rwxlite has committed its side
(`docs/wiki/exam-prereg-exam3.md` in the rwxlite repo). No config below has been
run on the real ops with a real truth. The scorer's dry run used a fake truth
(every label x) and looked only at the join count and the model string.

## Rows

Frozen in commit 93dc59c: `data/exam3-2026-11-04/ops.csv`, 1377 operations,
sha256 `fff7afa983c7fc85e2073e5662c4c317c69e37a1dd92a04c7e5dc04ecf43d790`
(`ops.csv.sha256`). Specs are each vendor's own official OpenAPI, original
bytes, `data/exam3-2026-11-04/specs/` (hashes in `sources.json`).

| vendor | provider in ops.csv | operations |
|---|---|---|
| clerk | clerk.com | 263 |
| neon | neon.com | 193 |
| supabase | supabase.com | 170 |
| mux | mux.com | 192 |
| netbird | netbird.io | 231 |
| ory | ory.sh | 179 |
| novu | novu.co | 149 |
| total | | 1377 |

Denominator for every percentage: 1377 rows. Asked/undecided rows are scored as
x (the letter rwxmap publishes for them).

## Labelling (truth)

- Brief: `data/relabel-2026-09-22/BRIEF-v3.md` verbatim (sha256
  `344bf93b75ae6167af576507ce65b35ec04e2cfa3d5334fc12150bbe13ef5ff3`), no edits.
- Two blind labellers, A and B, label every row. Where they disagree the user
  rules the row (as on the fresh exam). Labeller outputs are kept in
  `data/exam3-2026-11-04/labelling/`; the ruled result is `truth.csv`
  (`id,label`, label r|w|x, 1377 rows) in `data/exam3-2026-11-04/`.
- `truth.csv` sha256: **929725d51397098b6f45d86a5a551e7f0c095875557a944c02e08930efdab3c0**
  (`truth.csv.sha256`). Built by `labelling/build-truth.mjs` from the 14
  labeller files and `labelling/rulings.csv`; two runs gave the same sha.
- Measured facts: 14 labeller files (A and B for each of 7 vendors). A and B
  agree on 1370 of 1377 rows (99.5%). Per vendor (agreed/rows): clerk 260/263,
  neon 192/193, supabase 169/170, mux 191/192, netbird 230/231, ory 179/179,
  novu 149/149. The 7 disagreements were ruled by the user on 2026-11-04
  (`labelling/rulings.csv`, each with its A and B labels and a reason).
- Labeller A's first mux pass used a script (it labelled from method, path and
  summary and ignored descriptions) and was rejected; the file is kept in
  `labelling/rejected/`. Mux was relabelled by a new labeller A. The labeller
  prompts after that forbade scripts.
- Custody: rwxmap holds `truth.csv`. `truth.csv` and `labelling/out/` stay out
  of git until both sides have scored; only their sha256 are committed
  (`truth.csv.sha256`, and `labelling/out.sha256`, which lists the sha256 of
  each of the 14 out files and `rulings.csv`). `truth.csv` is opened for scoring
  only after both preregs are committed and the truth sha256 is committed. Then
  it is shared with rwxlite, whose scorer checks the same sha256.

## Code under test

- rwxmap commit: **this prereg commit** (the scorer, `src/` and every flag are
  whatever that commit holds; nothing changes after it).
- rwxlite: package 0.3.0 from branch `r10-exam3`, ref **fe374c0** (confirmed final
  by rwxlite), installed from `git archive`
  of that ref into a scratch folder. Model files from
  `/home/hamr/PycharmProjects/rwxlite/data/m1-r10/`. All five are sha256-checked
  before any run, and each run's reported model string must equal the expected
  one:

| file | sha256 |
|---|---|
| manifest.json (int8 per-channel, `rwxlite-0.3.0+093c908d`) | `8123dc0417cc56cf580da12f1ec7d9e02627e77d95fc422e9e9a319bdc134d31` |
| manifest-exact.json (fp32, `rwxlite-0.3.0+8514ddcc`) | `a7104e7aefac868dfd1809c0e0c47f52700412f06e9e3184e464ae075419ffe2` |
| model-int8-pc.onnx | `093c908d492d07121159287b5beadd3d4d75c403a4cde4f701ac918475be1173` |
| model-fp32.onnx | `8514ddccdafcda28ae468aced91673545c3c1d56201754e89a79dcb10ca61a26` |
| vocab.txt | `07eced375cec144d27c900241f3e339478dec958f92fddbc551f295c992038a3` |

How r10 is loaded without the user's cache: `score.mjs` builds a scratch folder
holding (a) the rwxlite src from the ref, (b) one cache per variant laid out as
rwxmap's model cache (`rwxlite-0.3.0+<sha8>/` with `manifest.json`, the model,
`vocab.txt`), and (c) a preload (`score/preload.mjs`, `hooks.mjs`) given to the
real CLI with `node --import`. The preload resolves `import('rwxlite')` to the
scratch build and refuses requests to github.com and `*.githubusercontent.com`,
so rwxmap's latest-model download cannot replace r10 and the CLI falls back to
the verified scratch cache. `XDG_CACHE_HOME` and `HOME` point into the scratch
folder; `~/.cache/rwxmap` is not read or written. No file under `src/` is
changed. The run fails loudly on "rwxlite: off", a wrong model string, a wrong
pass or confidence (never scored as mechanical).

## Configs

Each runs the real CLI (`node src/cli.js <spec> --vendor <name> -o <scratch>`) on
each of the 7 specs, from a scratch folder with no `.env`, and the scorer joins
every operation to `ops.csv` by (provider, METHOD, path), 1:1 (any unmatched,
extra or duplicate row fails the run).

| config | flags | model |
|---|---|---|
| mech | `--engine mechanical` | none |
| a-fp32 (GATE) | (none: mode a) | r10 fp32 `rwxlite-0.3.0+8514ddcc` |
| a-int8 | `--model small` | r10 int8-pc `rwxlite-0.3.0+093c908d` |
| b95-fp32 | `--engine rwxlite --confidence 95` | r10 fp32 |
| b95-int8 | `--engine rwxlite --confidence 95 --model small` | r10 int8-pc |
| c-jev | `--engine jev` (paid; only with `--jev`) | Jev |

Command (all but c-jev; `<T>` is the committed truth sha256):

```
node data/exam3-2026-11-04/score/score.mjs --truth-sha <T> \
  --rwxlite-repo /home/hamr/PycharmProjects/rwxlite --rwxlite-ref <ref> \
  --models /home/hamr/PycharmProjects/rwxlite/data/m1-r10
```

Add `--jev` (with `RWXMAP_JEV_KEY` in the environment) to run c-jev. Each run
writes `score/rows-<config>.csv` (id, provider, method, path, truth, letter,
review, evidence) and prints per config: exact / too loose / too tight as counts
and share of 1377, per vendor, per method, rwxlite sent/raised/lowered/kept/
undecided, and every too-loose row for mech, a-fp32 and c-jev. Too loose (letter
below truth) and too tight (letter above truth) are never folded into one
number.

## Bars (set before scoring)

- **Mode a (D133, decided 2026-11-03, "Go/no-go bar (set before building)" in the
  PRD).** a-fp32 is the gate; a-int8 is reported beside it. PASS needs both:
  too loose <= mech's too loose on the same 1377 rows, AND exact >= mech's exact
  + 5.0 percentage points (68.85 rows, so at least 69 more exact rows than
  mech; computed on integer counts).
- **Mode b (D133).** No pass/fail bar. Reported at confidence 95 with its
  too-loose, too-tight and asked (undecided) counts.
- **Mode c (existing Jev bars).** The user confirmed the M3 gate as the mode c bar
  on 2026-11-04. The M3 gate (D89 as amended by D94; Jev shipped on it by D119): too loose <= 2% of all rows, every one listed
  (item 1); too tight <= 20% of rows, reported and never traded against item 1
  (item 2). Item 3 (LOVO on the tuning set) does not apply to a clean exam.
  Jev is non-deterministic: a near-bar result must repeat on a second run, and
  no threshold is pinned from one run.

## Order

1. This prereg is committed by rwxmap and by rwxlite.
2. The truth sha256 is committed (written into this file).
3. Each side scores once, on the same rows. rwxmap runs the configs above; a
   rerun is allowed only for a crash or a row-join bug, recorded with the
   reason. No change of model, code, config, cut or text after any prediction
   exists. Anything a result suggests needs a new exam with new vendors.
4. Results go to `docs/logs/learnings.md`; a result that changes a feature or a
   decision goes to the PRD.

## Burn rule

After both sides have scored, exam #3 is BURNED as an exam: its rows and truth
may be used for training and tuning, and it is never an exam again. Any rule
change after this needs a new exam.

## Known limits

- Both labellers are the same model family (Sonnet), so their errors can be
  correlated; the 99.5% agreement partly reflects that.
- The labels are model labellers (two blind passes plus the user's ruling on
  disagreements), not an authoritative ground truth; labeller error caps what
  any figure can say.
- The seven vendors were rwxmap's last unseen spares; there are none left for a
  further clean exam from this pool.
- Parity of rwxlite's per-row p's against the CLI is not checked by this scorer:
  the combined JSON and sidecar carry only counts for the rwxlite pass. rwxlite
  checks its own p files with its `m0/exam3-parity.mjs`.
- The model files are copied into a scratch cache, not downloaded; the
  production download path (manifest, release tag, size caps) is not exercised.
- Mode b and mode a share the same model; their rows are not independent.
- rwxmap's default (published) model will be whatever rwxlite releases; these
  figures are for r10 only.
