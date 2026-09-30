# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.7.0] - 2026-09-30

### Added

- **`-h`/`--help` and `-v`/`--version`** on the CLI: `--help` prints a short guide (inputs, options, the three output files, Jev, exit codes); `--version` prints the package version. Both exit 0.
- **OpenAPI 3.1 webhooks notice**: webhook operations are counted in a stdout notice and never labelled, the same way 3.2 `query`/`additionalOperations` operations are.
- **CI installs the packed tarball**: CI now packs the package, installs the tarball and runs the installed `rwxmap` bin on a tracked spec.
- **`docs/release-checklist.md`**: a repo process document, not shipped in the package.

### Changed

- **A document without an `openapi` or `swagger` key is refused, not classified** (a tightening: less input is accepted). A local file, or a discovered spec on reload, that has no such key exits 1 with "not an OpenAPI or Swagger document"; an http(s) address that loads as such a document falls through to discovery as before.
- **`--vendor` must be a plain name.** A value containing `/` or `\`, `.`, `..` or an empty value is refused before any input is read or file written.
- **Plainer error messages**: a missing local file says `no such file: <path>` instead of a raw `ENOENT`; a directory says "not a file"; a local file's error no longer carries a `loadSpec` prefix; `-o` without a value says "-o needs a value"; an unknown flag says `unknown option: --x`.
- **README rescoped**: shorter and marked WIP, with three example commands, a note that per-request classification is for library use and the CLI needs a spec.
- **`poc/conformance`**: the MCP snippet check reads its own `hint-snippets.md` (check renamed `readme` to `snippets`), so a README edit can no longer break it silently.

### Fixed

- **A spec URL's load error is no longer swallowed** when discovery then finds nothing: the error is kept, for example `(as a spec: http 503)`. It is left out when the address loaded but is not a spec.
- **"no spec found" no longer repeats itself.**
- **`check:live` record for openvan.camp** re-recorded at 32 operations (it added `POST calculateRouteCost`, classed `r`); `check:live` is 4 PASS.
- **`tools/proof-cli.js` header** now says what it checks: 37 spec files, 11,505 operations, the rest listed as load errors.

## [0.6.0] - 2026-09-29

### Added

- **The `rwxmap` command** (D121-D123): `rwxmap <spec URL | local file | bare API address> [-o dir] [--vendor name] [--force]`, installed as a `bin` (`npx rwxmap ...` or `node_modules/.bin/rwxmap`; npm runs a bin through a symlink, and the CLI's own main-module check compares real paths on both sides, so that route works, tested by spawning it through a symlink, directly and by import, and by installing a packed tarball). A local file (JSON or YAML) or a spec URL is read with `rwxmap/load`; anything else (an http(s) address that fails to load as a spec, or loads with zero operations) goes through `findSpec`, with discovery's address safety rule still in force. A discovered spec is fetched once more with redirects refused, so the operations, the letters and the OpenAPI copy all come from one fetch; if its bytes changed since discovery cached it, the fresh copy is used and stdout says so. The vendor is `--vendor`, else a URL's own host, else a local file's first declared server host (`firstServerHost`, now exported from `rwxmap/discover`), else exit 1 asking for `--vendor`. It writes three files into `-o` (default: the current directory):
  - `<vendor>.rwxmap.json` (D122): one combined file with `bareguard.tools` (exactly `exportGate`'s tools), an `mcp` dict of hints keyed `"METHOD path"` (D104 annotations plus D110 `_meta`; never full tool definitions), a `webmcp` dict (below) and a `jev` block.
  - `<vendor>.rwxmap.review.json`: the human-facing sidecar (per-row evidence and review marker, counts, review list).
  - `<vendor>.openapi.rwx.json` (D124): a JSON copy of the input spec with `x-rwx: { class, destructive, evidence, review }` on every operation under a standard HTTP method, from the final (post-Jev) verdicts. The input file is only read. A pre-existing `x-rwx` is overwritten in the copy, counted and reported. The copy is always JSON, even for a YAML input.
  - Every file is replaced atomically (tmp file plus rename) and an existing file is left alone without `--force`. With `--force`, each old file is first kept as a hard-linked backup (a copy where hard links are unsupported, the same symlink for a symlink) and replaced by one atomic rename, so a target is never absent; if any write fails, all three are restored. A run reports leftover `.bak`/`.tmp` files from an interrupted run (this tool's own naming only) as possible leftovers and never touches them. Values JSON cannot hold (`.inf`/`.nan`) become `null` in the copy and are counted; integers past 2^53 that may already have been rounded when the spec was parsed are counted too (that cannot be detected afterwards).
  - Exit 0 on success, 1 on any failure, never a partial write. A spec with zero operations exits 1 and writes nothing, for every input kind; a spec whose only operations are OpenAPI 3.2 `query`/`additionalOperations` says so instead of "no operations found".
- **The Jev tier in the CLI** (D118-D120, D125): opt-in and bring-your-own-key. Set `RWXMAP_JEV_KEY`, or put that one line in a `.env` in the folder you run from (the `.env` is parsed with `util.parseEnv`, only `RWXMAP_JEV_KEY` is taken, nothing is written to `process.env`; a non-empty variable already set wins; an empty one counts as unset). Without a key the run is mechanical and prints `Jev: off (mechanical)`. All three tiers (`jev-lower`, `jev-raise-wx`, `jev-raise-get`) run when a key is set. The CLI classifies once, asks only the rows a tier wants (`needsJev`), and applies the answers with `applyJev`. A failed call or unusable answer leaves that row's mechanical letter; the run never stops. Stdout says what leaves the machine (method, path, operationId, summary and description of each asked row, to `api.typesafe.ai`), and the combined JSON's `jev` block records `mode`, `model`, `sent`, `answered`, `failed`, `changed` and `tokens: { input, output }`; a row Jev moved carries its `p` and `model` in the review file.
  - `src/jev-client.js` (internal, not an export): plain `fetch`, 30 s timeout, retry with backoff on 429/529 only, concurrency 4, fails closed on a bad answer, key only in the request header and never in any output or error.
- **WebMCP hints** (D124): a `webmcp` dict in the combined JSON, keyed like `mcp`; each entry is the `annotations` for that operation: `r` is `readOnlyHint: true, consequentialHint: false`, `w` is both false, `x` is `readOnlyHint: false, consequentialHint: true`. Both flags are always written, because WebMCP reads an omitted hint as false.
- **OpenAPI 3.2 notice**: operations under `query` and `additionalOperations` are not labelled yet (no letter, no key, no `x-rwx`); they are counted and reported on stdout, not dropped silently.
- **`exporter.js`**: `classifyOperations` (one mechanical `classifyRow` pass, so a caller wiring in Jev classifies each operation exactly once), `operationEntries` (the one place that decides which objects in a document are operations; `operationsFrom` is built on it, 0 differences over the 11,505 operations of the proof set), and a `verdicts` option on `exportGate` and `exportSidecar` for final, post-Jev verdicts. Sidecar rows carry the `jev` `{ p, model }` of a row Jev moved.
- **`npm run check:live`**: a by-hand release check, not part of `npm test` or CI because it hits the network. It runs the CLI against four real bare API addresses through a symlink (the way npm's bin link runs it), with no Jev key and a fresh discovery cache per host. A non-zero exit, a missing or non-JSON output file, or an inconsistent output exits 1; a small site's spec drifting from what was recorded prints `CHANGED` and exits 0.
- **`poc/conformance/`**: a one-off check, with its own `package.json`, that each standard accepts rwxmap's output: the OpenAPI copy equals the input on 38 of 38 files, all 11,671 MCP entries validate against the MCP schema 2026-07-28, and the WebMCP entries conform to the WebMCP IDL. Nothing is added to rwxmap's install, `npm test` or CI, and it is not shipped in the package.
- **`tools/proof-cli.js`**: checks every operation and every gate key of the 37 proof-set spec files (11,505 operations) through the CLI's own path, mechanical and with a seeded fake Jev, including `x-rwx` and `webmcp`; 0 differences.

### Changed

- **`exportGate`/`exportSidecar` throw on a `verdicts` list of the wrong length.** A silent fallback to mechanical classification would drop every Jev move and loosen letters with nothing saying so.
- `discover.js`'s vendor determination now calls the new exported `firstServerHost` instead of carrying its own copy of "the first server host of a spec".

## [0.5.0] - 2026-09-28

### Added

- **`rwxmap/load`** (D106/D107): `loadSpec(source, opts)` loads an OpenAPI/Swagger document from an http(s) URL or a file path, JSON or YAML, transparently gunzipped if gzip-magic bytes are present. A download is capped at 64 MiB both as read (compressed) and as decoded, and a gzip bomb throws rather than expanding past the cap; a corrupt (truncated) gzip stream is reported as corrupt, not oversize. Binary content (a NUL byte, or a POSIX tar `ustar` header) is refused before it reaches the YAML parser. An external `$ref` (an operation defined in another file) is never followed — that operation classifies on method+path alone. Ships as its own `rwxmap/load` subpath, never from the package root, so `import 'rwxmap'` never loads the `yaml` parser.
- **`rwxmap/discover`** (D108, D112-D117): `findSpec`, `classifyCall` and `requestKey`, for a harness or gate that wants whole-API coverage instead of classifying one URL at a time.
  - `findSpec(apiUrl, { spec?, cacheDir? })` looks for a spec, in order: the caller-supplied `spec` (nothing else tried); a 30-day on-disk cache (including a cached "none"); `/.well-known/api-catalog` (RFC 9727); the `Link: rel="service-desc"` header (RFC 8631); then the fixed paths `/openapi.json`, `/openapi.yaml`, `/swagger.json`. Only OpenAPI/Swagger documents are recognized (D112). The catalog/Link steps walk up the host one label at a time, stopping at two labels, with no public suffix list. The fixed paths are tried on the API host and on `docs.`, `developer.` and `developers.` of its two-label parent.
  - `classifyCall(found, method, url)` matches a live call to a spec operation when it can, else falls back to per-request classification (`classifyRow`), and always returns `{ key, letter, marker, source: 'spec' | 'request' }`.
  - `requestKey(method, url)` is the per-request key builder on its own.
  - Discovery never requests a non-https URL, an IP-literal host, `localhost`, or a single-label host, checked on every redirect hop and every followed service-desc link.
  - Discovery is limited to at most 3 guessed paths, at most 3 service-desc links followed, and a 60-second wall-clock budget per `findSpec` call (up to one request timeout of overrun).
  - Known limit (D117): discovery can occasionally match a spec for a different API on the same domain (a call against it then takes that spec's letter); there is no rule that tells a wrong spec from a right one. Passing the spec URL directly avoids it.
  - Ships as its own `rwxmap/discover` subpath, never from the package root, so `import 'rwxmap'` stays offline and dependency-free.

### Changed

- **`yaml` moved from `devDependencies` to `dependencies`.** It is loaded only by `rwxmap/load` and (transitively, for spec-parsing) `rwxmap/discover` — `import 'rwxmap'` from the package root still never loads it.

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
