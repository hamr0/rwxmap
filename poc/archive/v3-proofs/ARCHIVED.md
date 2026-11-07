# Archived v3 proofs

`proof-src.mjs` (moved from `poc/d87/`) and `proof-step1.js` (moved from `tools/`)
encode v3 on purpose: they compare `src/` against a v3 reference.
`src/` is v4 since D138 (commit 1268650), so both exit 1 against it by design
(proof-src: 469 differences; proof-step1: 1,960 class differences).
They are kept as history only and are not part of any gate. Relative imports were
repointed after the move; the v3 reference code itself is in `poc/d87/` and
`poc/archive/mech-v3/`. The live proof is `poc/mech-v4/proof-copy.mjs`.
