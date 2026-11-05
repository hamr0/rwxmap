# rwxlite fresh exam 2026-11-03, used here as TUNING data

Source repo: rwxlite (/home/hamr/PycharmProjects/rwxlite), read with `git show`, nothing checked out.
This was rwxlite's own one-time fresh exam and it is BURNED. In rwxmap it is TUNING data
for the D133 rule comparison. It is never an exam for rwxmap.

| file | source | what it is |
|---|---|---|
| decision.jsonl.gz | commit df90c02, test/fixtures/decision.jsonl | 949 rows {id, method, state, lean, jev_tier, isX, changes, expected}; p from the int8 per-channel model |
| truth.csv | tag v0.1.0, data/exam-2026-11-03-fresh/truth.csv | id,label (agreed label or user ruling) |
| rulings.csv | same folder at v0.1.0 | the 15 A/B disagreements and their rulings |
| ops.csv.gz | same folder at v0.1.0 | blind ops file; used only to read each row's provider (vendor) |

Copies only; originals are untouched in rwxlite.
