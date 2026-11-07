# v4 pass suspects

Rows from the full v4 pass (33321 rows, Jev facts pass) that get a blind check.

## Rules (user ruling, fixed before the Jev run)
- jev-x: every row whose Jev label is x. 8283 rows.
- near: Jev label w, with any of the five p values >= 0.2 and < 0.5. 5474 rows.
- sample: seeded random 5% (rounded to the nearest whole row) of the remaining Jev-w rows. 19564 remaining, 978 drawn. Seed 20261107, mulberry32 over a Fisher-Yates shuffle of the pass-key order. 978 rows.

Total 14735 rows. Jev labels seen: {"w":25038,"x":8283}.

## Files
- suspects-key.csv: row_id (s00001...), pass_id, category, jev_label, the five p values. Row ids assigned after a Fisher-Yates shuffle, mulberry32 seed 20261108. Never give this file to a labeller.
- sbatch-NNN-blind.csv: 74 batches of 200 rows (last 135), taken in shuffled order, so all three categories are mixed. Header row_id,provider,method,path,operationId,summary,description. No category, no Jev answer, no source. Each has a .sha256.

Labelled blind by one Sonnet labeller per batch under BRIEF-v4. Where Sonnet disagrees with Jev, the rows go to the user grouped by pattern (plan ruling (f), user 2026-11-06); there is no second Sonnet. Results: disagree/ (groups, rulings, final labels for all 4,688 disagreements); rcheck/ is a second blind look at the 201 Sonnet-r rows, kept as information only. It set no labels.
