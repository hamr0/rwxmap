# Pass v4 merge (2026-11-05)

Built by `poc/v4-pass/merge.mjs` (node, no arguments). Read-only on every input. Re-running gives byte-identical output.

## Inputs (sha256 of the files read)

- rwxlite-w-unique.csv: a40d1f59dc56b31628e1a48cf8b1c99e9159d6dff0b645050079e141d7edd558 (checked)
- pilot-key.csv: a29d65493c97b0e224cf5c6b5839247b4f95c7085f887811957e60f36c55e1c6
- exam3 truth-d136.csv: 1a257e4329089855d32ca261c8b28077b5a15345b00ffc76b6bca62ab9fc4c10
- exam4 truth-d136.csv: 6c35a32f93a307f254c90d1f2b27913b3bffd0f528669c693bd81ab578108c39
- combined labelled.csv: b181417de4b466a41c0b2c3c55129d017a730ed4c4989078c56923d88bc51120
- relabel-buildset labelled.csv: cffbd4c39a2103aeaced627ac8cbaf570db94a13fd56b2174374aaa0cdb30bc7
- exam-2026-09-22 labelled.csv: eb402eb8927a043ac637eea8befd8114a9043b37ccb94233653bd1861c1a1b94
- rwxlite-fresh truth.csv: 8945b5a5e8158d3ff16efffd0845dd29bf431215215b00c9fc44b5ae12abc67e
- corpus labelled.csv: 90a742b0d40adb0948093dcf1bbcea200f0cd4f0112b537e29935cc149ec89d7
- calibA-blind.csv: 5222c934863d01c9ef0349ba8fe101d6ccdcd6fe8800dacb4ee7b6613e096c2c
- calibA-labels.csv: 8e90d007f3a43f1810fa68ce658bf77e47a080b45bbda3482c585864443201ec
- calibB-blind.csv: 5f05a90cf773e3efe8e94bcb36e9ed1926b34e9dc8869745a042afb34b8aa9a5
- calibB-labels.csv: f69d33b0f2e558397a5d1174d1d77bc35d912d26f2950144018ae24838869e48
- calibC-blind.csv: f2aaf1904edfcb62d899581fe8fd9d9caf7876f1bc48c12fc2c63b9dcd06a414
- calibC-labels.csv: c071becc96cac58e369f98ed928ed0971615c6403424e13b1d606ce8562310f2

Also read: ops.csv of exam3, exam4 and rwxlite-fresh (row text for those sets).

## Counts at every step

- in: rwxmap v3 w rows: 6091
- in: rwxmap pre-v3 rows (calibration label rows 550 + corpus 1186): 1736
- in: rwxlite rows (all): 29327
- in: rwxlite plain rows: 28714
- in: rwxlite contrast variants: 43
- in: rwxlite surface variants: 570
- v3 rows total (all classes): 16486; v3 x rows: 3684
- calibration unique ops under old key: 543
- items entering merge (v3 w + pre-v3 + rwxlite plain + contrast): 36584
- unique under raw key: 34971; overlap (rows lost to dedupe): 1613
- unique under normalised key: 33625; overlap (rows lost to dedupe): 2959
- [rk] unique keys: v3 6091, pre 1729, rwxlite 28757; v3&pre 114, v3&rwxlite 1236, pre&rwxlite 256
- [nk] unique keys: v3 6091, pre 1729, rwxlite 28757; v3&pre 126, v3&rwxlite 2479, pre&rwxlite 395
- within v3: 6091 rows, 6091 unique normalised keys
- within pre: 1736 rows, 1729 unique normalised keys
- within rl: 28714 rows, 28714 unique normalised keys
- within rlc: 43 rows, 43 unique normalised keys
- keys that merge only under the normalised key: 1346
- pilot rows read: 200; unique keys 200
- unique keys after merge (normalised): 33625
- pilot-labelled keys excluded: 200 (raw-key match would give 200)
- x-conflict keys excluded (after pilot): 104
- pilot keys present in merged groups: 200 of 200
- surface variants excluded: 570 (their key also in the pass: 0)
- final pass rows: 33321; by stratum {"pre-v3":1501,"w-v3":31777,"contrast-variant":43}
- batches: 167 (200 rows each, last 121)

## Seed

Shuffle: Fisher-Yates over pass-key order with mulberry32, seed 20261106. Batches of 200 rows, taken in shuffled order. Blind row_id is pass_id.

## Rules

- Merge key (rwxlite's): provider lowercased + method (QUERY folded to GET) + path + operationId + summary (whitespace collapsed, lowercased).
- Dedupe is on the normalised key: same, with the provider also stripped of a trailing .com/.io/.app/.sh/.dev/.ai/.co/.net/.org. Overlap is reported under both.
- Inputs: all w rows of the v3 sets (combined, buildset, exam22, exam3 and exam4 via truth-d136, fresh); every row of the pre-v3 sets (calibration A+B+C label rows, corpus/labelled.csv) whatever its label; rwxlite w rows.
- Pilot rows (pilot-key.csv, matched on normalised key) are already labelled under v4 and are excluded.
- Surface variants (variant_kind surface) are excluded and listed in inherit.csv (your_id, variant_of; variant_of is rwxlite's seed id, not present in its export). Contrast variants are labelled (stratum contrast-variant unless the key also comes from another origin).
- Conflicts: a key with an x label anywhere in the v3 rwxmap truth (all classes) stands as x under tighten-only; excluded and listed in conflicts.csv. rwxlite's export holds only w. Pre-v3 old labels never count as conflicts.
- Row text: rwxmap v3 text if any, else rwxmap pre-v3, else rwxlite. origins lists set:id for every origin (corpus ids are R + 1-based data-row number).
- Stratum: w-v3 if any v3 w origin (or rwxlite plain row with no rwxmap origin); else pre-v3 if any pre-v3 origin; else contrast-variant.
- Files: pass-key.csv, batch-NNN-blind.csv (+ .sha256), inherit.csv, conflicts.csv.
