# export-v4-d141 (2026-11-19)

Purpose: the D141 relabel of rwxlite's round13 train and val rows, with the mechanical lean recomputed for each row.
D141 relabel: the BRIEF-v4 addendum (commit 54355e1) applied to 4990 candidate rows picked by the rwxlite net
(`poc/d141-pass/rwxlite-net.md`, `pattern-net.json`), labelled blind in 13 parts with `poc/d141-pass/LABEL-PROMPT.md`
(sha256 6688192669b5e4ed9fad653b312be83f565d5bb4f06240d10ac9ebb37aabe524).

This is an addition. No existing file was changed; round13 train.jsonl and val.jsonl are untouched and the labeller outputs are used as delivered.

## Files
- export-v4-d141.csv: one row per round13 train and val id (106848), sorted by split then id. Columns: id, split, label_v4 (round13 label), label_d141 (merged label; equals label_v4 for non-candidates), changed (0/1), d141_families, d141_confidence (candidates only), lean_letter, lean_rule, lean_source (m0, m0q, exam3, exam4, fresh, missing).
- changed-train.csv, changed-val.csv: id, label_v4, label_d141, d141_families, reason (labeller's reason).
- *.sha256: sha256 of each of the three CSVs.

## Merge rule
Tighten-only, with one exception. label_d141 = the tighter (x > w > r) of label_v4 and the labeller letter, whatever the confidence. The pass may raise a label but lowers none except the 2 ids in poc/d141-pass/c-lowers.txt (ag-069342, ag-071594).
The exception, D141(c) lowers agreed with rwxlite 2026-11-19: for an id in c-lowers.txt the labeller lowered x->w (sure/likely) citing a plain group edit; the op updates the group object itself (PATCH .../groups/{id}); the text has no member, role, permission, owner, admin, access, grant, policy or acl words. merge.mjs applies it only when the labeller letter is w, the old label is x and the families include c, otherwise it errors, and it fails unless the applied count equals the number of ids listed. Creates (POST /groups) are not (c) and stay as they were; sub-resources under /groups (calendar, policies) are not (c). Counts of this exception: 2 lowered x->w. Reason: export-v4 labels are user-ruled truth (D137), and a single blind labeller's opinion does not overrule it. Reading the 183 lowered rows of the earlier merge showed 103 that were not D141 cases (unban/unlock/enable user, soft deletes, GitHub Actions permission sets), and the group-family lowers were mostly calendar accept/decline calls under /groups. D141(c) "plain group update is w" applies to exam #7 labelling and later; apart from the exception above it is not used to lower existing truth here. The labeller's letter stays visible in poc/d141-pass/merged.csv (column labeller_letter), so the rejected lowers can be read.
Lowers not applied: 297 (candidate rows where the labeller letter is looser than label_v4, excluding the 2 c-lowers; by family and move, a row in several families counts in each: a w->r 3; a x->r 4; a x->w 73; b x->r 1; b x->w 10; c w->r 1; c x->r 4; c x->w 103; d x->r 2; d x->w 86; e x->w 18). Non-candidates keep label_v4.

## Lean rule and sources
lean_letter and lean_rule come from rwxmap's shipped `src/exporter.js` classifyOperations (src/ is identical to commit 1c25be1; `git diff 1c25be1 -- src/` is empty), on the original operation (method upper-cased, path, and operationId/summary/description when non-empty), exactly as rwxlite r15/label_mech.mjs builds them. lean_rule is the rule as it appears in the text prefix, so rule credential-set is written cant-undo-verb (rwxlite src/text.js alias). Computed by `poc/d141-pass/lean.mjs`.
Reproduction check first: 2000 rows (every 99th) of rwxlite data/r15/labels/final-labels-r15-d141.csv.gz against the prefixes in texts-r15.jsonl: 2000 match, 0 mismatch (`repro-lean.mjs`).
Original operation sources: ag- ids from rwxlite data/m0/mechanical.jsonl.gz (m0); ex3- from data/exam3-2026-11-04/ops.csv (exam3); ex4- from data/exam4-2026-11-04/ops.csv (exam4); fx- from data/rwxlite-fresh-2026-11-03/ops.csv.gz (fresh). QUERY copies: ids ag-N-q are QUERY copies of ag-N; their lean is computed from the base ag-N op in m0 with the method set to QUERY (lean_source=m0q): 4258 rows, 0 differ from the stored prefix (letter or rule). Unresolved: lean_source=missing, lean fields empty (0 rows).

## Counts
- rows: 106848 (train 102668, val 4180)
- candidates: 4990 (train 4817, val 173); changed: 232 (train 226, val 6)
- changed by family and move (a row in several families counts in each): a r->w 4; a r->x 85; a w->x 24; b r->w 2; b r->x 64; b w->x 23; c w->x 15; c x->w 2; d r->x 11; d w->x 9; e w->x 25
- moves: train r->w 6; train r->x 127; train w->x 91; train x->w 2; val r->x 3; val w->x 3
- lean_source: m0 98759, m0q 4258, exam3 1377, exam4 1505, fresh 949, missing 0
- computed lean differs from the stored round13 text prefix (letter or rule): train 6304, val 154 (letter differs: train 3535, val 104); stored prefix unparsable: train 0, val 0
- most common differences (stored -> computed):
- x floor-post -> x path-x-word: 2819
- x floor-post -> w content-noun: 1757
- w method-floor -> x path-x-word: 1616
- w modify-verb -> x path-x-word: 230
- r method -> x get-action: 20
- w modify-verb-summary -> x path-x-word: 16

## Input sha256
- rwxlite/data/round13/train.jsonl: 8144e5056e0244e888ca6360ac312901762245d4c8874b0c304bcd897a788fef
- rwxlite/data/round13/val.jsonl: 8c0fdcfb32ca107db4ba8e5a535cf5851da91a164903603c250fd4dfb0654983
- poc/d141-pass/merged.csv: 9948c6cb008344ee40fb76fc12d8a66f0fc58b8b1032a79080fda733e630a3b8
- poc/d141-pass/candidates.csv: bf300de5c47e3176340b84f21e847a1d18104b001ff2faf9f9a81ce6f5dbd113
- poc/d141-pass/out/part-01.csv: d14588ffe5fefafa5f0f404ce1ec9075a754a6dbc65399aa76b32953245bbdf4
- poc/d141-pass/out/part-02.csv: 0aed34f0ae6fa8a807a85e67bfc4d0cc3da8f2e60d581c3967c40edb3cfb34fc
- poc/d141-pass/out/part-03.csv: ab6dd2455a320e02871fd3d08ad64956cc0420316ad37c4dbccc7041fc89da59
- poc/d141-pass/out/part-04.csv: f6a2ec9ff33cccc37ffbd1bd24f127ce7ac560120143a3684d0fc04f6b4518b1
- poc/d141-pass/out/part-05.csv: 6f562cf7837c1314aa6fbf54d5081e2b9eb5ba75cac139ba1b3acd9a53c77fd3
- poc/d141-pass/out/part-06.csv: b0637411845d1e3560ca8c9280999387d62de6d35df72363b4974dbb750a149a
- poc/d141-pass/out/part-07.csv: bf5784c56033ba2632900dcad2f618161eabc535d8381c16a18eca8a5a7542bc
- poc/d141-pass/out/part-08.csv: aa19f63a8f783d7101ed6c18ce69307a6e1138010b3d536896234af016a31a58
- poc/d141-pass/out/part-09.csv: 63f4942622cbb95bb52e008c7905f7d98f3dae8733127d8dd1ffe9907ad1f263
- poc/d141-pass/out/part-10.csv: f663cdc2ceb0a3cbb0716c45724cc19f5bf433fbd4a79d2b8916d6196667cf22
- poc/d141-pass/out/part-11.csv: 9a98487d8e18078061412c39a9175d77264f2181dd13757457f3031921a635ed
- poc/d141-pass/out/part-12.csv: d20c8e993e524d8dcc1172391a1ba029baf771a069eded88ee1b15e28c2c27c6
- poc/d141-pass/out/part-13.csv: d32954443330573204d82740db5e4d40670ad30c50d117d1ae6c9f8a0b2c894c
- rwxlite/data/m0/mechanical.jsonl.gz: 42381904d789c88abcd7794926cb34f9415b9c6d02ed9a81d040bf9959123552
- data/exam3-2026-11-04/ops.csv: fff7afa983c7fc85e2073e5662c4c317c69e37a1dd92a04c7e5dc04ecf43d790
- data/exam4-2026-11-04/ops.csv: e9836ff2f9e8288e3721f97506ed666b871a3486f7b781c544b5234a0b5da0b4
- data/rwxlite-fresh-2026-11-03/ops.csv.gz: ab155ac1e500f7ababe09872f683aba3869fbfe207d0e35570ee70af452de215
- poc/d141-pass/LABEL-PROMPT.md: 6688192669b5e4ed9fad653b312be83f565d5bb4f06240d10ac9ebb37aabe524
- poc/d141-pass/c-lowers.txt: 4aff6fa9fe5aae3a78d8d3d2f2dfe46179d9b4cd61ef93237b9b158aef238ec4

## Output sha256
- export-v4-d141.csv: 8d802cf42d56fbcf050102fb854a958696bf59abdeca1a43fe6c88bcdc53034f
- changed-train.csv: 11e048ff6acb00be10f3461cf9b01ea1266b3a2da7c5992dbf68b8e9356b0ee2
- changed-val.csv: f567ea00f7bad0932570570b0811a3f920b25e03cabfd71950166d370b52acfb

## Rebuild
```
cd poc/d141-pass
node validate.mjs && node merge.mjs && node repro-lean.mjs && node build.mjs
```
Reads /home/hamr/PycharmProjects/rwxlite/data in place (read-only). Output is deterministic; two runs are byte-identical.
