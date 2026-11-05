# D133 mode c: mechanical -> Jev on rwxlite's 949 fresh rows

Date 2026-11-04. Code commit 00d2d11 (run from a detached worktree of that commit; the CLI
with `--engine jev`). Model Jev reported: jev-1.14.0. TUNING data, not an exam.

- Tokens: 1,939,546 in / 18,712 out; 916 rows sent, 916 answered, 0 failed, 146 letters changed.
- Cost estimate: about $0.08, from gate-4's measured rate (about $0.14 for 3.28M input tokens,
  data/gate4-2026-11-04/README.md). Not read off an invoice.
- One run of a non-deterministic model; do not pin a threshold on it. Mode c's planned D133
  change (failed call -> x plus review) is not built, so this is today's Jev behaviour.

Files: `build.mjs <dir>` (one OpenAPI spec per provider + idmap.json id -> vendor/method/path),
`run.mjs <cli> <dir> <jev|mech>`, `score.mjs <dir> .` (writes readout.txt), `score.test.mjs`,
`outputs.tar.gz` (raw CLI outputs and logs), `readout.txt` (the result).
Reads the key from the repo-root .env into the child environment only; the CLI runs from an
output folder with no .env.
