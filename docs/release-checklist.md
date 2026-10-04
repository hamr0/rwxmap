# Release checklist

Why: 0.6.0 shipped without `--help`, and a README edit silently broke
conformance, which CI does not run. Run every item, report each result;
a release is not cut with any item unrun. Each line: what, command, pass.

## A. Before the release commit (on the branch)

1. Tree clean, not on main. `git status --porcelain` prints nothing;
   `git branch --show-current` is not `main`.
2. Tests and types. `npm test` all pass; `npm run typecheck` 0 errors.
3. Proofs. `node tools/proof-load.js`, `node tools/proof-match.js`,
   `node tools/proof-cli.js`: each exits 0 with "All pins hold".
   proof-cli lists its load errors; those are expected.
4. Conformance. `(cd poc/conformance && node run.mjs)` exits 0. For the
   browser check, add `CHROME=/path/to/chrome-156-or-later` (Chrome for
   Testing); with it set the browser check runs and passes, without it it is skipped (6/6).
5. Live. `npm run check:live`: 0 FAIL. A CHANGED line means a site
   drifted; look at what changed before accepting or re-recording.
6. Install check, as CI runs it (from the repo root):
   ```
   d=$(mktemp -d)
   zcat data/provider-corpus-2026-09-16/specs/paypal/notifications_webhooks_v1.json.gz > "$d/spec.json"
   npm pack --silent --pack-destination "$d"
   (cd "$d" && npm init -y >/dev/null && npm install --silent ./rwxmap-*.tgz && npx rwxmap spec.json --vendor demo && ls demo.rwxmap.json)
   ```
   Pass: exits 0 and lists `demo.rwxmap.json`.
7. Hand run as a new user, in that install folder (`$d`, or an empty
   scratch folder with the tarball installed), no `.env`,
   `unset RWXMAP_JEV_KEY`. Run with `npx rwxmap`: `--help`, `--version`,
   a local spec, a spec URL, a bare API address, a missing file, a
   non-spec file. Pass: each output reads plainly; the successful runs
   print "Jev: off (mechanical)".
8. README examples. Every command in README.md runs as written; same
   scratch folder, same pass rule as item 7.
9. Review gates. `/self-review` until 0 Fix-now, then `/branch-review` says
   ready at HEAD.
10. CHANGELOG entry and version bump: `/release`.

## B. After publish

11. CI green on the PR before merge; tag on main. Publish with the
    "Publish to npm" workflow (`.github/workflows/publish.yml`).
12. `npm view rwxmap version` shows the new version. In a scratch
    folder with no `.env`: `npm init -y && npm install rwxmap`, then
    run `npx rwxmap` on a spec. Pass: exit 0, 3 files written,
    `rwxmapVersion` in the JSON matches.
