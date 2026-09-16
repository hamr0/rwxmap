# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
