# v4 pass rcheck

Purpose: a second blind labeller on the 201 suspect rows the first suspect labeller called r. A row becomes r only if both say r (user ruling of 2026-11-06).

## Inputs
- sbatch-NNN-blind.csv and sbatch-NNN-labels.csv (74 pairs) in the parent folder; suspects-key.csv for pass_id, category and Jev label.
- Selection: every labelled row with truth_class r. 201 rows.

## Seed
Fisher-Yates shuffle, mulberry32 seed 20261109. New ids r001..r201 assigned after the shuffle.

## Counts
- By method: {"GET":157,"POST":41,"PATCH":1,"PUT":2}
- By category: {"near":69,"jev-x":106,"sample":26}

## Files
- rcheck-blind.csv: header row_id,provider,method,path,operationId,summary,description. Row text verbatim from the sbatch blind files. No old s-id, first label, category or Jev answer. Has a .sha256.
- rcheck-key.csv: rcheck_id,row_id,pass_id,category,jev_label,first_class,first_confidence,first_reason. The key file is never given to a labeller.
