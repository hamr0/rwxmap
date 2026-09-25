# data/relabel-buildset-2026-09-23 — buildset relabelled under BRIEF-v3 (D87)

## Why

`data/buildset-2026-09-18/` (1819 rows, 13 apis-guru vendors, write-only:
POST 699 / DELETE 505 / PUT 460 / PATCH 155) was labelled under BRIEF v1
(`data/calibration-2026-09-14/BRIEF.md`) on 2026-09-18 — four days before
D87 was adopted. Under D87 the DELETE and POST truth is backwards:
DELETE went ~92% w -> ~98% x, POST went ~61% x -> ~67-71% w.

Its 13 vendors (github, microsoft, gitea, appcenter, netbox, atlassian,
dracoon, trello, gitlab, keycloak, box, clearblade, launchdarkly) appear
in NEITHER the 23-vendor combined tuning set NOR the 3-vendor burned exam.

## What this is NOT

Still a TUNING set, never an exam. Step 2's word lists were mined on these
rows (D81), so by the project's own rule it can never serve as a clean exam
again.

## Method

The 9 blind splits from `data/buildset-2026-09-18/label/blind-*.csv` are
reused VERBATIM — same rows, same order, same parts. Only the brief and the
output filenames change. Brief: `data/relabel-2026-09-22/BRIEF-v3.md`.
Outputs: `label/v3-labels-N.csv`, one per labeller, columns
`row_id,truth_class,confidence,reason`.
