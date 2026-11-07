# Archived v3 tools

`readout.js` (moved from `tools/`) and `predict-exam.js` (moved from `tools/`)
made the committed recordings `run-proof/readout.csv` and
`run-proof/exam-2026-09-17-predictions.csv` under v3. They import `src/flow.js`,
which is v4 since D138 (commit 1268650), so re-running them now writes v4 rows
over those v3 recordings. Nothing live references them (no npm script, release
checklist item, test or CI step). They are kept as history only and are not part
of any gate. Relative imports were repointed after the move.
`predict-exam.js` is the pre-registration of the clean exam of 2026-09-17; the
committed CSV is the record, do not regenerate it.
