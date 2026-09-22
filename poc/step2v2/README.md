# poc/step2v2 — step 2 rebuilt under D86 (M3 POC, not shipped)

Built under D86; D87 (2026-09-22) supersedes the definition — to be
rebuilt in the next pass.

D86 folds "cannot be undone" into class `x`. The frozen `src/step2.js`
floors PUT/DELETE/PATCH at `w` and lowers a POST to `w` on a modify verb.
Under D86 that is wrong for DELETE (the method is evidence the change can't
be undone) and for any row whose verb is destructive. This POC is the
rebuilt step 2. It is a POC: `src/` is untouched, nothing here is published.

`step2.mjs` imports nothing from `src/` or `poc/`. Every helper it uses is
copied verbatim from `src/tokens.js` and `src/step2.js`, each marked with
where it came from, so a change there cannot silently move this POC.

## The rules, in order

| # | when | verdict |
|---|---|---|
| 1 | method `DELETE` | `x`, `method-delete`, source `floor`, `destructive: true` |
| 2 | `PUT`/`PATCH`/`POST` and the row's verb stem-matches **`DESTRUCTIVE_VERBS`** | `x`, `destructive-verb` (or `-summary`), source `list`, `destructive: true`. Not gated by `OTHER_PARTY`. |
| 3 | `PUT`/`PATCH` otherwise | `w`, `method-floor`, source `floor`, `destructive: false` — the wordless floor, which step 3's raise-word may still raise |
| 4 | `POST` otherwise | the frozen `modify-verb` / `modify-verb-summary` rule with the `OTHER_PARTY` gate, `destructive: false`; else `null` |
| 5 | any other method | `null` |

The verb is read exactly as the frozen step 2 reads it: the operationId's
lead verb after modifiers, or the summary's first non-filler word when the
lead is a bare HTTP-method word. That keeps one blind spot the frozen code
has: `delete` **is** a method word, so a `deleteThing` lead is only caught
through the summary (`destructive-verb-summary`), never at the lead.

The lists:

- **`DESTRUCTIVE_VERBS` (23)** — `poc/archive/v2/m0/destructive.json`,
  copied exactly with its provenance note (written 2026-09-07 from MCP's
  `destructiveHint` definition, fit to nothing, unmeasured).
- **`MODIFY_VERBS` (16)** — the frozen 24 minus the 8 that are also
  destructive (`cancel`, `delete`, `remove`, `detach`, `expire`, `disable`,
  `deactivate`, `suspend`). Under D86 those are road 3, not `w`. The test
  asserts the two lists are disjoint.
- **`OTHER_PARTY` (21)** — copied unchanged.

`step2v2(row, words)` accepts `{destructiveVerbs, modifyVerbs, otherParty}`
overrides for LOVO and per-verb pricing.

## What the readout proves, and what it cannot yet

`readout.mjs` runs the v2 ladder (step1 → step2v2 → step3 on `method-floor`
only → floorPost, same precedence as `src/flow.js`) beside the frozen
`classifyRow` over `data/combined-2026-09-21/rows.json.gz` (6557 rows,
sha256-checked, **tuning data**).

**Proved (mechanics):** every row whose class changed moved `w → x` by one
of the three new rules; no `r` moved, no `x` loosened to `w`; every other
row keeps its frozen rule (or is `x` by another route — the frozen flow
already said `x` by `raise-word`/`floor-post`, v2 says `x` by a new rule).
If any of that fails the readout prints the rows and exits 1.

**Not proved (accuracy):** the labels are the old brief's, made before
reversibility was folded in. Section 3 scores against a PROXY truth
(v1 truth-w becomes x on DELETE or a destructive verb) — and the proxy flips
truth and prediction with the same rule, so on those rows it cannot disagree
with itself. Those figures are not accuracy numbers. Section 4 is fires
only. The accuracy read waits for `data/relabel-2026-09-22`.

Section 2 lists the POST rows the frozen `modify-verb` said `w` and v2 now
says `x` — the overlap of the two lists. Those rows are for the user to read
one by one.

## How to run

```
node --test poc/step2v2/*.test.mjs   # 13 unit tests
node poc/step2v2/readout.mjs         # sections 1-4; exit 1 on a mechanics failure
node poc/step2v2/readout.mjs --rows  # plus every changed row, one per line
```
