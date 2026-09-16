# Hold-out 5 reading — in progress

Input groups and reader outputs for the blind reading of
`../operations.csv` (323 rows).

- `group0.csv` .. `group4.csv` — the five reading groups, round-robin over
  operations.csv order (row i to group i mod 5). Columns repo, source_url,
  path, method, operationId only; no labels, no summary text.
- `double.csv` — a 60-row sample, evenly spaced across the whole set
  (index floor(k * 323 / 60), k = 0..59), read independently by two
  readers who cannot see each other's output, to measure how much two
  readers disagree.

## Read so far

- `group2-reader.csv` — group 2, 65 rows, r 30 / w 13 / x 22, 8 marked doubt.
- `double-a.csv` — the 60-row sample, reader A, r 26 / w 17 / x 17, 1 doubt.

Groups 0, 1, 3, 4 and double-read B were not completed: all seven readers
were launched at once and five died on a session rate limit. Ground truth
for this set does not exist yet; `../ground-truth.csv` is absent on purpose.
