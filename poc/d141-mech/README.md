# poc/d141-mech: measurement harness for GET_ACTION and PATH_X_WORDS words

Measurement only. Nothing here edits `src/`. Candidate words come from a JSON file written by the orchestrator; no word list lives in this folder.

Sets (always reported separately, never pooled):
- A: `data/export-v4-d141-2026-11-19/export-v4-d141.csv`, truth `label_d141`, QUERY copies (`m0q`, ids ending `-q`) dropped, operations joined from their sources (ag- rwxlite `mechanical.jsonl.gz`, ex3-, ex4-, fx-). Any unjoined row is an error.
- B: exam #7 (burned, tuning only): `data/exam7-2026-11-19/ops.csv` with truth from `truth.csv`.

Files:
- `load.mjs`: loads both sets as rows `{id, set, vendor, method, path, operationId, summary, description, truth, families}` (plus `lean_letter` for A). Run directly to print the join counts.
- `dump.mjs`: `node poc/d141-mech/dump.mjs` writes `leaks.txt` (truth x, today's class not x, per set, grouped GET/HEAD/OPTIONS/QUERY, PUT, PATCH, POST) and `leaks-d141.txt` (only rows with D141 families); prints counts per group.
- `score.mjs`: `node poc/d141-mech/score.mjs candidates.json` where candidates is `{"getAction": [...], "pathXWords": [...]}`. Per set, per word and for the whole list: fires (class changes) split right/wrong, per-vendor counts, LOVO, exact/too-loose/too-tight totals (baseline, fitted, LOVO), up to 15 examples each of right and wrong fires (counts are the true counts). Output goes to stdout and `out/score-<basename>.txt`. It first checks that set A's baseline letters equal the export's `lean_letter` and exits 2 if any differ.
- `score.test.mjs`: `node --test poc/d141-mech/score.test.mjs` (synthetic rows).
- `smoke.json`: empty candidates; the run must show 0 changes on both sets.

LOVO rule: for vendor V, a word is adopted only if on all other vendors pooled it has right > wrong and at least one right fire; the adopted words are applied to V's rows. A word whose right fires all come from one vendor gets nothing under LOVO. Per-word LOVO sums per-word fires; the whole-list LOVO classifies each vendor's rows with that vendor's adopted words together.

A run takes about a minute (set A is 102,590 rows).

D144 note (2026-11-23): `score.mjs`'s parity guard pins the pre-D144 lean, that is the export's `lean_letter` (src at 1c25be1 plus D140). After D144 landed in `src/step2.js` it exits 2 by design (31 mismatches on set A, exactly the 31 raised rows). `out/score-cand-r1.txt` is the measurement D144 was decided on. `out/score-cand-none.txt` is the post-edit check: empty lists scored against the edited src, run with the guard bypassed in a throwaway copy; set A baseline too loose 3155 -> 3131 and too tight 13651 -> 13658, exam #7 unchanged at 72 / 174. `score.mjs` itself is unchanged.
