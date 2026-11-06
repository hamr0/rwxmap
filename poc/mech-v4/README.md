# poc/mech-v4

Parallel v4 copy of the v3 mechanical core, per `docs/wiki/mechanical-v4-plan.md`
(step 1: copy only, no behaviour change).

- `tokens.js step1.js step2.js step3.js flow.js types.js` and their tests are
  byte-identical copies of `src/`; `diff src/X poc/mech-v4/X` must stay empty
  until a later plan step changes the copy on purpose.
- `src/` stays v3 and untouched. Nothing here imports from `src/` except
  `proof-copy.mjs`, which uses `src/flow.js` as the v3 reference.
- `sets.mjs` loads the six tuning sets (16,486 labelled ops) with v3 and v4 truth.

Run tests: `node --test poc/mech-v4/*.test.js`

Run the proof: `node poc/mech-v4/proof-copy.mjs [path/to/other/flow.js]`
(the optional path lets you break a scratch copy and watch the proof fail).

Pinned numbers (exit 1 if any differs):
- compared 16486, differences 0
- vs v3 truth: exact/too loose/too tight 13339/156/2991
- vs v4 truth: 13484/861/2141
