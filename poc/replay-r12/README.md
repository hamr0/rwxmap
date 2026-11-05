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

## Cut-off what-if (`--lower-min-p`)

`replay.mjs --lower-min-p <0..1>` copies `src/secondpass.js` to a temp dir, replaces only the line
`export const LOWER_MIN_P = 0.97;` (dies unless found exactly once), points `./flow.js` and
`./modelcache.js` at the repo's `src/`, and imports the copy. It prints the file used and the cut-off.
Without the flag the real module is used. Rows csv gains `rule`, `rw_letter`, `rw_p` (p of the letter rwxlite read).

    cd <scratch cwd, no .env>
    node poc/replay-r12/cutoff.mjs        # 8 sets x {0.99,0.97,0.95,0.93,0.90}; writes out/cutoff/report.md

Parity (out/cutoff/P1-*, P2-*): exam #4 with r11 p, G1/G2 0 differ through the real module (P2) and through
the copy at 0.97 (P1, rows identical). `cutoff.mjs` also checks each set at 0.97 against committed numbers
(exam #4 v0.2.0 fp32 vs `rows-a-fp32-base.csv` 1391/16/98, 0 row diffs; exam #3 1192/15/170).
