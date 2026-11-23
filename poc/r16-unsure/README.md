# r16-unsure

rwxmap rules rwxlite r16's 3,853 Sonnet-unsure rows (62 dev, 3,791 train).
Opus labels train blind (no Sonnet columns); the orchestrator reads every
disagreement plus a deterministic 100-row agree sample; the orchestrator
reads the dev rows directly.

- `split.mjs`: checks input sha256 and counts, writes the files below.
- `dev-rows-numbered.txt`: the 62 dev rows, full text, with Sonnet's letter and reason.
- `blind/part-01..08.csv`: train rows, 8 parts, no Sonnet columns.
- `train-sonnet.csv`: Sonnet letter and reason per train row, for comparison only.
- `out/O-NN.csv`: Opus output per part (op_id,letter,confidence,reason).
- `validate.mjs <out> <part>`: checks an Opus output file against its part.
- `compare.mjs`: writes `disagree-numbered.txt` and `agree-sample-numbered.txt`.
- `csv.mjs`: shared CSV reader/writer.
- `rulings-train.txt`: the orchestrator's rulings on `disagree-numbered.txt`, by batch. By default a row takes the Opus letter as lean; `N S` takes Sonnet's letter; `N D` is the Opus letter with doubt; `N r|w|x` is an explicit letter; the last line for an N wins.
- `agree-sample-numbered.txt`: the deterministic 100-row sample of rows where Opus and Sonnet agree, read by the orchestrator.
- `disagree-numbered.txt`: the 974 train rows where Opus and Sonnet disagree, numbered, all read and ruled.
- `build-train.mjs`: reads the Opus outputs, Sonnet letters and `rulings-train.txt`, writes `answers-train.csv`.
- `build-dev.mjs`, `build-dev-v2.mjs`, `build-dev-v3.mjs`: the three dev rulings, writing `answers-dev.csv`, `answers-dev-v2.csv`, `answers-dev-v3.csv`. All three stay on disk; only v3 is applied.
