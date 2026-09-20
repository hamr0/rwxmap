# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
