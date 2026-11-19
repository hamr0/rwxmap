# Exam 7 labelling

- `blind/part-<vendor>.csv` are blind copies of `../ops.csv`, one per vendor
  (ringcentral, openziti, gitness, huggingface, pipedrive, vikunja),
  made by `split.mjs`. Row ids are `ex7-NNNN`.
  Columns: `row_id,provider,method,path,operationId,summary,description`.
- Two blind labellers, A and B, each label every part using
  `data/relabel-v4-2026-11-05/BRIEF-v4.md` verbatim (sha256
  `f8add85988a382ff5770c3af28fb048b82099392cb456f17dcc1e79277f57cbd`) plus
  `data/relabel-v4-2026-11-05/BRIEF-v4-addendum-D141.md` (commit `54355e1`).
  Labeller A is Sonnet, labeller B is Opus.
- No scripts: a labeller reads each row and decides it. Nothing is derived by
  code, pattern or lookup. A scripted pass shows as few distinct reasons and is
  rejected (kept in `rejected/`) and relabelled by a new labeller.
- Outputs go to `out/<A|B>-<vendor>.csv`, columns
  `row_id,truth_class,confidence,reason` (class r|w|x|?, confidence high|low).
- Check every file directly, not from the labeller's counts:
  `node validate.mjs out/A-<vendor>.csv <vendor>`. It exits non-zero on a
  format failure and prints class counts, ? and low counts, and the number of
  distinct reasons.
- `node build-truth.mjs --disputes` lists every row where A and B differ or
  either says ?, with the full description and both labellers' reasons.
- Disagreements are ruled by the user in `rulings.csv`
  (`id,ruling,a,b,note`; create it before building truth). Then
  `node build-truth.mjs` writes `../truth.csv`, `../truth.csv.sha256` and
  `out.sha256`.
- `out/` and `../truth.csv` stay out of git until both sides have scored; only
  the sha256 files are committed. There is no .gitignore for this (same as
  exam #6): do not `git add` them.
