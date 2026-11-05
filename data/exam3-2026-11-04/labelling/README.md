# Exam 3 labelling

- `blind/part-<vendor>.csv` are blind copies of `../ops.csv`, one per vendor
  (clerk, neon, supabase, mux, netbird, ory, novu), made by `split.mjs`.
  Columns: `row_id,provider,method,path,operationId,summary,description`.
- Two blind labellers, A and B, each label every part using
  `data/relabel-2026-09-22/BRIEF-v3.md` verbatim.
- Outputs go to `out/<A|B>-<vendor>.csv`.
- Disagreements between A and B are ruled by the user.
