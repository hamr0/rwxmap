# replay-r12

Scores a peer model's per-row p answers through rwxmap's real mode-a second pass
(`src/secondpass.js`), for sets that come only as an `ops.csv` (no spec files).
Mechanical verdicts come from `classifyOperations` on operations built from the csv
(method, path, operationId, summary, description; an empty csv field is treated as absent).
Imports only `src/`; touches nothing in `src/` or `data/`. Run from a scratch cwd with no `.env`.

    node poc/replay-r12/replay.mjs --ops ops.csv --truth truth.csv --p p.jsonl --out rows.csv \
         [--expect-mech rows-mech.csv] [--expect-rows rows-a.csv]

- `--ops`   header `id,provider,method,path,operationId,summary,description`
- `--truth` header `id,label` (r|w|x)
- `--p`     jsonl `{id, model, pIsX, pChanges}`; one model string per file, passed to secondPass
- `--out`   `id,provider,method,path,truth,mech_letter,mech_review,letter,review,evidence,outcome`
- Refuses to run if any op lacks a p row or truth label; prints every unmatched count.
- Exit 3 if a parity gate differs (first 20 diffs printed, full count always).

Gates on exam #4 (1505 ops):
- G1 mechanical letter+review vs `score/rows-mech.csv`: 1505/1505, 0 differ.
- G2 mode a letter+review, `p-r11-fp32.jsonl` vs `score/rows-a-fp32-cand.csv`: 1505/1505, 0 differ (totals 1393/18/94).

Known gap: ops.csv has no requestBody, x- fields or tags. Mechanical steps read only
operationId, summary, method, path, so G1 shows no effect on exam #4.
