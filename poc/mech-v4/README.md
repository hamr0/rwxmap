# poc/mech-v4

Frozen reference for mechanical v4. v4 shipped to `src/` in commit 1268650 (D138);
`src/flow.js`, `step1-3.js`, `tokens.js`, `types.js` and their tests are byte
copies of the files here, and v3 is archived in `poc/archive/mech-v3/`.
This folder is what `proof-copy.mjs` checks `src/` against; do not edit it
unless `src/` changes on purpose in the same commit.

- `sets.mjs` loads the six tuning sets (16,486 labelled ops) with v3 and v4 truth.
- `proof-copy.mjs` is the only file that imports from `src/`.

Run tests: `node --test poc/mech-v4/*.test.js`

Run the proof: `node poc/mech-v4/proof-copy.mjs [path/to/other/flow.js]`
(the optional path swaps in a scratch copy of the reference `flow.js`, so you can
break it and watch the proof fail).

Pinned numbers (exit 1 if any differs):
- compared 16486, differences 0, skipped (no truth) 0
- src vs v3 truth (original labels): exact/too loose/too tight 13096/119/3271
- src vs v4 truth (D137 labels): 14048/421/2017
