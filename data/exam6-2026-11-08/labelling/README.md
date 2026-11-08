# Exam 6 labelling

- `blind/part-<vendor>.csv` are blind copies of `../ops.csv`, one per vendor
  (grafana, nocodb, radarr, cloudsmith, invoiceninja),
  made by `split.mjs`. Row ids are `ex6-NNNN`.
  Columns: `row_id,provider,method,path,operationId,summary,description`.
- Two blind labellers, A and B, each label every part using
  `data/relabel-v4-2026-11-05/BRIEF-v4.md` verbatim (sha256
  `f8add85988a382ff5770c3af28fb048b82099392cb456f17dcc1e79277f57cbd`).
  Labellers A and B are both Sonnet (user ruling 2026-11-08; prereg
  `docs/wiki/exam-prereg-exam6.md`).
- No scripts: a labeller reads each row and decides it. Nothing is derived by
  code, pattern or lookup. A scripted pass shows as few distinct reasons and is
  rejected (kept in `rejected/`) and relabelled by a new labeller.
- Outputs go to `out/<A|B>-<vendor>.csv`, columns
  `row_id,truth_class,confidence,reason` (class r|w|x|?, confidence high|low).
- Check every file directly, not from the labeller's counts:
  `node validate.mjs out/A-<vendor>.csv <vendor>`. It exits non-zero on a
  format failure and prints class counts, ? and low counts, and the number of
  distinct reasons (exam #3's real passes had 86-167 per vendor; the rejected
  scripted one had 12).
- `node build-truth.mjs --disputes` lists every row where A and B differ or
  either says ?, with the full description and both labellers' reasons.
- Disagreements are ruled by the user in `rulings.csv`
  (`id,ruling,a,b,note`). Then `node build-truth.mjs` writes `../truth.csv`,
  `../truth.csv.sha256` and `out.sha256`.
- `out/` and `../truth.csv` stay out of git until both sides have scored; only
  the sha256 files are committed (see the prereg, "Labelling (truth)"). There
  is no .gitignore for this (exams #4 and #5 had none): do not `git add` them.
