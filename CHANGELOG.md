# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.4.0] - 2026-09-25

### Changed

- **The r/w/x definition itself changed (D87), and classification shifts accordingly.** `x` now means "cannot be undone", not "reaches another party's data" — a plain `POST` create is `w` (a later write, by anyone, can set it back), and `DELETE` is `x` unless the operation itself names a restore/trash path. Measured on the 3,852 non-`r` rows re-labelled under the new brief: `DELETE` flipped from mostly-`w` to mostly-`x` (777 of 803 rows); `POST` moved 930 rows x→w (plain creates) and 147 rows w→x (sends, runs, cancels). Adopters pinned to the previous release's classification of `DELETE`/`POST` rows should expect this release to disagree with it.
- **The `destructive` flag no longer covers everything under `x`.** It is now a flag true only for the REMOVES subset of `x` (delete/purge/revoke/expire/void/redact) — a charge, a send, or a job run is `x` but not `destructive`.
- The MCP hint mapping is now decided (D104): `destructiveHint` follows the class directly (`destructiveHint = (class === 'x')`, not the narrower `destructive` flag) and `idempotentHint` is never emitted. Neither is emitted by any code yet — the carrier emitters (OpenAPI `x-rwx`, MCP, WebMCP, ARD) are not built in this release; this is a decision recorded for when they are.

### Added

- **An opt-in Jev tier.** `src/jev.js` makes no network call itself — the caller supplies the model's answers (`needsJev`/`jevQuestions` say what to ask, `applyJev` applies the answers) — and moves a verdict only under a fixed threshold per pile:
  - `jev-lower` (D88): reads wordless floor-post `x` rows and may lower `x` → `w`, only when p(x) ≤ 0.10.
  - `jev-raise-wx` (D95/D100): reads method-floor `w` rows and may raise `w` → `x`, only when p(x) ≥ 0.80.
  - `jev-raise-get` (D95/D100): reads method-floor `r` rows and may raise `r` → `w` (never `x`), only when p(changes) ≥ 0.50.
  Any bad or missing model answer leaves the mechanical class untouched — no silent fail-open. Opt-in; the mechanical classifier works standalone without it.
- **A `review` marker** (`tight` / `loose` / `settled`, D101) on every classified row, derived from method + class + source. It's a review-priority signal, not a confidence score: review `loose` rows first (where the under-classification risk concentrates), then `tight`. `settled` means neither of the other two — mostly method-floor guesses, not a signed or verified state.
- **The bareguard exporter** (`src/exporter.js`): `operationsFrom` walks a parsed OpenAPI document into rows with no I/O of its own; `exportGate` builds the draft `tools` section of a `bareguard.rwx.json` gate file (bare letter, or `{ letter, marker }` including the `review` marker, never a `deny` or `destructive` flag — those stay the gate operator's own call); `exportSidecar` builds the human-facing report. Every row is emitted, with no floor-row filtering (D103) — omitting floor `PUT`/`PATCH` rows previously cost a reviewer a median of 38 rows per spec despite those rows being right 96.6% of the time. On a key collision the tighter class always wins and every collision is reported back to the caller, never resolved silently.

### Measured

- **The M3 clean exam, scored once and burned** (cloudflare, pagerduty, sentry — 4,279 operations across three complete official APIs never used in tuning): **82.3% exact / 0.8% leaks / 16.9% over-tight**, mechanical only. With the opt-in Jev tier: **93.0% exact / 0.5% leaks / 6.5% over-tight**. Unlike the previous release's exam, this fitted tuning-set read (82.6% / 1.0% / 16.4%) held on the unseen vendors rather than falling hard off it.
- Leave-three-vendors-out over all 1,771 provider triples: 81.8% exact / 1.0% leaks / 17.3% over-tight mechanical, 93.3% / 1.1% / 5.6% with Jev — within 0.4-1 point of the fitted tuning number.
- `classifyRow` reads every field as optional, so the same function can be fed a bare `{ method, path }` with no `operationId`/`summary`. On the M3 exam this costs exactness, not leaks (D105): full spec 82.3% / 0.8% / 16.9%, method+path 81.9% / 0.8% / 17.3%, method alone 81.1% / 0.8% / 18.1%. A URL/spec-discovery layer and the caller-facing key normalizer for spec-less requests are not built in this release (`docs/product/prd.md` "What is next").

### Removed

- Superseded pre-D87 experiment data and code: the five M0 hold-out sets, exams 1 through 5, two pre-D87 calibration sets, `docs/logs/m0/`, and `poc/archive/` (frozen M0/M1 code that no longer runs). All results from this data remain recorded in `docs/logs/learnings.md` and `docs/wiki/decisions-log.md`; everything deleted stays recoverable from git history.

### Fixed

- **The publish workflow now fails when `package-lock.json`'s version drifts from `package.json`.** npm writes that field on install, so a release that bumps `package.json` without running one leaves it behind — and nothing caught it: `npm ci` fails when the lockfile's *dependency* entries disagree, but never checks the lockfile's copy of the project's own version. `scripts/check-lockfile.mjs` (`npm run check:lockfile`) compares both places npm writes it and runs in the publish workflow. No lockfile is not a failure.

[0.4.0]: https://github.com/hamr0/rwxmap/releases/tag/v0.4.0

## [0.3.0] - 2026-09-20

The first release that ships working code. Every earlier tarball shipped
only `README.md`, `CHANGELOG.md` and `LICENSE` — this one adds a real
package entry point.

### Added

- A public export, `classifyRow`, from `src/index.js`, with TypeScript
  declarations built into the tarball (`types/`). `npm install rwxmap`
  now gives adopters something importable for the first time.
- The classifier itself: a three-step r/w/x ladder (step 1 = r, step 2 =
  w, step 3 = x), each step its own standalone rule set with its own
  word lists, frozen in order as it was built and measured — step 1
  (D74), step 2 (D75), the step-3 precedence wiring (D78), and the
  poc-to-src graduation verified byte-for-byte equivalent to the frozen
  proof-of-concept (D79). Step 2 is now closed (D81): no further
  word-list tuning without an explicit decision to reopen it.
- A single shared classifier map (`class`, `destructive`, `evidence`,
  `confident`) intended to feed OpenAPI `x-rwx`, MCP `annotations`,
  WebMCP hints and ARD catalog entries alike, agreed as the output
  shape this project targets (D76/D77).

### Measured

- **The first clean exam, scored once and burned**: 85.3% exact, 12.4%
  leaks, 2.3% over-tight, on 1,383 operations across three vendors the
  classifier had never seen (okta, docusign, xero). This is the honest
  generalization number. **The leak rate on unseen vendors is 12.4%** —
  roughly seven times the tuning-corpus figure below, because that
  figure is fitted to the rows it was tuned on and this one is not.
  Every leak in the exam is a truth-x row predicted w (over-loosened);
  there were zero r-direction leaks.
- The tuning-corpus figure, for comparison only, not a substitute for
  the exam above: 94.2% exact / 1.3% leaks / 4.5% over-tight on the
  4,171-row provider corpus the ladder was built and tuned against.
  This number reads better than an unseen vendor would and is not
  presented as a generalization claim.
- A write-heavy build set (1,819 rows, 13 vendors, PUT/DELETE/PATCH and
  POST only) was drawn and labelled under a pre-registered vendor split
  to see whether a mined word list could close the exam's gap. It could
  not: the best candidate word list fell from 8.17 leaks-closed-per-
  false-alarm fitted to 0.83 leave-one-vendor-out, against the adoption
  bar of 10 — the same noun means opposite things at different vendors.

### Parked

- An optional, raise-only model tier ("Jev") is specified but not built
  (D82): no API access yet, never able to lower a class, and scoped
  only at step 2's wordless floor and word-claim rows. M1 closes as the
  mechanical, deterministic offering — spec text in, one class out, no
  model, no network (D83). The go/no-go gate's zero-leaks-on-assigned-
  rows condition is now measured on the mechanical tool plus the opt-in
  Jev tier together, not the mechanical tool alone.

[0.3.0]: https://github.com/hamr0/rwxmap/releases/tag/v0.3.0

## [0.2.0] - 2026-09-16

This release still ships no code. **Nothing in this package is importable.**
It is the same three files as 0.1.0 — `README.md`, `CHANGELOG.md`, and
`LICENSE` — with a corrected README.

### Fixed

- The README's License section still said "LICENSE file to follow" after
  `LICENSE` (Apache-2.0) had already been added to the tarball. It now
  links to [`LICENSE`](https://github.com/hamr0/rwxmap/blob/main/LICENSE).

### Clarified

- The README now states outright that `rwxmap` on npm is a name
  reservation only, with no entry point, so a reader of the tarball
  cannot mistake it for working code.

[0.2.0]: https://github.com/hamr0/rwxmap/releases/tag/v0.2.0

## [0.1.0] - 2026-09-16

This release reserves the `rwxmap` name on npm. There is no public API yet
and **nothing in this package is importable**.

### What exists today

The r/w/x classifier is a proof-of-concept living in this repository at
`poc/flow/`. It is not shipped in this package — this tarball ships only
`README.md`, `CHANGELOG.md`, and `LICENSE`.

### Measured (the classifier's own numbers, not a promise about this package)

- 78.8% exact / 3.7% too loose / 17.5% too tight, on a 5,465-row labelled
  corpus, scored leave-one-vendor-out.
- 70.2% exact / 3.2% too loose / 26.7% too tight, on a held-out exam scored
  once.

Under-classification (too loose — a security cost) and over-classification
(too tight — a usability cost) are counted separately throughout; they are
never blended into one accuracy figure.

### Coming next

- A loader that takes an OpenAPI document by URL or file path.
- A public API built on top of the classifier.
- MCP tool-annotation hints.

[0.1.0]: https://github.com/hamr0/rwxmap/releases/tag/v0.1.0
