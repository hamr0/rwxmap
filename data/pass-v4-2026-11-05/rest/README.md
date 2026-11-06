# v4 pass rest

The Jev-w rows of the v4 pass that no Sonnet has looked at (source jev-unchecked in truth-v4-pass.csv). 18576 rows. None is in suspects/.

## Files
- rest-key.csv: row_id (g00001...), pass_id, jev_label, the five p values. Row ids assigned after a Fisher-Yates shuffle of the selected rows in truth-v4-pass.csv order, mulberry32 seed 20261109. Never give this file to a labeller.
- gbatch-NNN-blind.csv: 93 batches of 200 rows (last 176), in row_id order. Header row_id,provider,method,path,operationId,summary,description. No Jev answer, no source. Each has a .sha256.

Labelled blind by one Sonnet labeller per batch under data/relabel-v4-2026-11-05/BRIEF-v4.md (amended version). Where Sonnet disagrees with Jev, the rows go to the user grouped by pattern (plan ruling (f)). A Sonnet r on its own never lowers a w (ruling D).
