# markers-2026-11-04

Mechanical markers for every APIs.guru operation, exported for rwxlite's
contested-row second pass. Read-only: no rule changed.

## Files

- `export.mjs`: runs `classifyRow` from `src` on each row and writes one
  line per operation.
- `markers.csv.gz`: the output, 123,339 rows.

## Columns

provider,api_key,method,path,operationId,class,step,rule,source,evidence_vs_floor,review,destructive

## Re-run

    cd data/markers-2026-11-04 && node export.mjs ../corpus/apis-guru-ops.csv.gz markers.csv.gz

## Source

- Code: commit 0876cf6.
- Input: data/corpus/apis-guru-ops.csv.gz.
- Mechanical only. No Jev was run, so no letter was lowered or raised
  by a model.

## Totals (123,339 rows)

- class: r 62,879 / w 17,312 / x 43,148.
- review: settled 78,556 / tight 29,687 / loose 15,096.
- evidence_vs_floor: floor 116,015 / evidence 7,324.
