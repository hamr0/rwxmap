# export-v4 (2026-11-06)

## Purpose
The v4 training labels for rwxlite round 13, labelled under BRIEF-v4 and D137. Written as an addition: no existing file was changed. Built by `poc/v4-pass/export.mjs` (no args, deterministic).

## Inputs (sha256)
- pass-v4-2026-11-05/truth-v4-pass.csv: afdb6b309594c502651398c73a75a4cd57a50e0f65cb8820b4b8db3cd50dfee6
- pass-v4-2026-11-05/pass-key.csv: 9c3ce15756d98cf828835f2336607f092cb89a7b8ef13106cbbfe68c0af3f7f0
- pass-v4-2026-11-05/conflicts.csv: e641ddb17e5c790106b6dd814d689126db5a54ec07a6284ef0568d9b3af2e0e7
- pass-v4-2026-11-05/inherit.csv: 1bd71a24247c4abaf791217874a632e23fb2856d34b980379e0db8d3bd27ae4f
- pilot-v4-2026-11-05/pilot-key.csv: a29d65493c97b0e224cf5c6b5839247b4f95c7085f887811957e60f36c55e1c6
- pilot-v4-2026-11-05/truth-v4.csv: 1aa785a6f38d247bc02c9b5982914761d5396654b39c773ef38a2338e52f3c6a
- pilot2-v4-2026-11-06/pilot-key.csv: 10bc34feba767f9596bc90c5afff344a21ae3aa11372dbd04e923d3c8e2c2771
- pilot2-v4-2026-11-06/truth-v4.csv: efe5e6ab919a370cb38a28610d9f643fd521cd56a2b989898412196ae4795c14

## Rules
- One row per origin id (set + id). Output sorted by set, then id.
- Pass rows: each origin of each pass row gets that row's v4_label; label_source is the truth-v4-pass source. Text comes from pass-key.
- Conflicts: label x, label_source conflict-v3-x (v3 truth already has x). Text from conflicts.csv.
- Pilots: label_source pilot1-v4 or pilot2-v4. Pilot1 source_set is normalised to the pass set names (provider-corpus-2026-09-16, exam-2026-09-17, exam-2026-09-20 -> combined; buildset-2026-09-18 -> buildset; exam-2026-09-22 -> exam22; exam3-2026-11-04 -> exam3; exam4-2026-11-04 -> exam4; rwxlite-fresh-2026-11-03 -> fresh). Pilot2 labels apply to every origin id of the row. Pilot2's 5 r labels are user-ruled fixes and stay r.
- An id with labels from more than one source keeps the tighter label (x over w over r), except that pilot2's 5 user-ruled r labels override the pass label (the one loosening exception); on a tie the first source in the order pass, conflict, pilot1, pilot2 supplies label_source and text. Every such id is listed with its sources in multi-source-ids.csv (231 ids, 24 where the labels differ).
- brief is BRIEF-v4 for every row.
- Flags: rwxlite -> rwxlite; combined by id prefix (pc- tuning; x17-, x20- burned); buildset, relabel-buildset -> tuning; exam22, exam3, exam4, fresh -> burned; calibA, calibB, calibC, corpus -> diagnostic.
- inherit-v4.csv: 570 rwxlite surface variants (your_id, variant_of). rwxlite gives each variant its seed's v4 label from this export: label is "seed" unless variant_of appears as an id in export-v4.csv, in which case that label is filled in (0 resolved, 0 of them with an id shared across sets, tightest kept).

## Counts
Rows: 36477

By set:
- buildset: 1130
- calibA: 200
- calibB: 150
- calibC: 200
- combined: 2378
- corpus: 1180
- exam22: 1347
- exam3: 439
- exam4: 469
- fresh: 328
- rwxlite: 28656

By flag:
- burned: 3733
- diagnostic: 1730
- rwxlite: 28656
- tuning: 2358

By label:
- r: 5
- w: 28381
- x: 8091

By flag and label:
- burned/w: 2739
- burned/x: 994
- diagnostic/r: 4
- diagnostic/w: 969
- diagnostic/x: 757
- rwxlite/r: 1
- rwxlite/w: 22849
- rwxlite/x: 5806
- tuning/w: 1824
- tuning/x: 534

By label_source:
- conflict-v3-x: 105
- disagree-final/c-ruling: 1988
- disagree-final/group: 3168
- disagree-final/row-ruling: 7
- jev-sonnet-agreed: 10878
- jev-sonnet-r-kept-w: 96
- jev-unchecked: 19978
- pilot1-v4: 200
- pilot2-v4: 7
- vendor-ruling: 50

## Known gap
18,576 pass rows carry Jev's label only (Jev-w, never Sonnet-checked). Sonnet's 5% sample of such rows found 21 of 978 were x (2.1%).
