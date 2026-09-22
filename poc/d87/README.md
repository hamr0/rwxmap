# poc/d87

The M3 POC for the D87 definition (`docs/product/prd.md`, "M3 spec (D87)").
Not shipped. `src/` is untouched — this directory imports nothing from
`src/` or any other `poc/` dir (the step1 proof test is the one exception:
it imports `src/step1.js` only to compare outputs, never to run it).

D87's definition: r = read, changes nothing. w = changes things in a way a
later call can set back. x = cannot be undone. Unsure -> x.

## The ladder

Run order: step 1, step 2, step 3, step 2's floor. First non-null verdict
wins. `delete` was removed from `METHOD_WORDS` (the "reader fix"), so a
`deleteThing` lead reads as a verb on any HTTP method, not just DELETE.

| step | class | rules | lists |
|---|---|---|---|
| 1 | r | `method` (floor: GET/HEAD/OPTIONS), `read-verb` (lead), `read-verb-anywhere` (any position) | READ_VERBS (23), SAFE_VERBS (10) — unchanged from `src/step1.js`, D74 |
| 2 | x | `method-delete` (floor: DELETE, always `destructive: true`), `cant-undo-verb`/`cant-undo-verb-summary` (POST/PUT/PATCH) | CANT_UNDO (29), REMOVES ⊂ CANT_UNDO (6, sets `destructive: true`) |
| 3 | w | `method-floor` (floor: PUT/PATCH), `modify-verb`/`modify-verb-summary` (POST) | KEEP_W (14) |
| 2 (floor) | x | `floor-post` — the leftover pile, no word fired | — |

Precedence: method DELETE beats every word; a word beats a floor. CANT_UNDO
and KEEP_W are disjoint by construction (asserted in tests), so nothing is
ever arbitrated between step 2 and step 3 — the run order alone decides.

No OTHER_PARTY, no RAISE_WORDS: D87 drops "whose" as a class test.

## Files

- `tokens.mjs` — tokeniser (copied from `src/tokens.js`, reader fix
  applied) plus `verbForRow`, the one shared verb-reading helper steps 2
  and 3 both call.
- `step1.mjs` — verbatim copy of `src/step1.js`.
- `step2.mjs` — the x step: CANT_UNDO, REMOVES, `step2()`, `floorPost()`.
- `step3.mjs` — the w step: KEEP_W, `step3()`.
- `flow.mjs` — `classifyRow()`, the ladder's run order.
- `readout.mjs` — measurement against the v3 relabel truth.
- `d87.test.mjs` — unit tests plus the step1-vs-`src/step1.js` proof.

## Running

```
node --test 'poc/d87/*.test.mjs'
node poc/d87/readout.mjs
```
