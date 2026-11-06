# Truth v4 plan (D137)

## Ruling

User ruling, 2026-11-05 (D137). It widens the x test. It does not change the definition.

x = after this call, a later call cannot put things back the way they were, including everything anyone could have done in between. That happens in two ways:

- gone: delete, purge, a job stopped with its work lost;
- out of your hands: sent, published, charged, run, or a secret or a right handed to someone.

Access: an operation that grants or widens who can do what to which resource is x. That covers IAM, resource, bucket and key policies; role or permission assignments and bindings; ACLs; share and invite grants; deploy keys; setIamPolicy-style calls. Narrowing access (admin to viewer) stays w: nobody gains anything in between. A set or replace whose text doesn't say whether it widens or narrows is x by the doubt rule. A "policy" that doesn't control access (autoscaling, lifecycle, retention, routing) stays w unless it's x for another reason.

D130 (setting a password), BRIEF-v3 clause (c) (sends) and clause (f) (job stops) are now examples of this one test, not separate clauses. D136 (restart and stop are w) is consistent with it: nothing is gained in between. The chmod reading holds: changing who can access a thing (chmod/chown) is the most guarded act.

Scope: every set either project (rwxmap or rwxlite) ever labelled gets new truth under BRIEF-v4, and that becomes the one truth. Originals are kept untouched; the new truth goes beside them as additions. rwxlite retrains on it. rwxmap code stays unchanged until its own D-number and fresh exam #5.

## Scope ruling (user, 2026-11-05)

The labelled data stays the source of truth. D137 only moves w to x, so only rows labelled w today are relabelled, in one pass over every w row of every set in both projects. Repeats are merged first, so each unique operation (same method, path, operationId and text) is labelled once and copies inherit the label. Generated variants inherit their source row's label. After the pass: look at what came out, adjust the brief if a pattern is wrong, and re-run only those rows. Sets still labelled under a brief older than v3 are relabelled in full.

This supersedes "every row of every set" in step 4 and in the Scope paragraph above.

Further rulings (user, 2026-11-05):

- (a) Vendor labels are a cross-check, not truth. After the pass, any row v4 calls w where AWS (Permissions management or Write) or GitHub (Administration, secrets, keys, roles write) says otherwise gets a second blind look, and a user ruling if still split. Source: rwxlite data/vendor/joined.jsonl.
- (b) Generated variants: surface rewordings inherit their seed's v4 label; contrast variants are labelled directly.
- (c) Pre-v3 sets data/calibration-2026-09-14 (543) and data/corpus/labelled.csv (1186) are relabelled in full; rwxlite holds no pre-v3 w or x labels.

- (d) (2026-11-06) Rows both Sonnet labellers call r are corrected to r and reported separately as "fixes" (pilot 2: q016, q021, q044, q071, q106). Pilot 2's three disputes (q045, q075, q129) are x.
- (e) (2026-11-06) Jev labels the full pass with the pilot-2 factual questions and rule (poc/v4-pilot2). Sonnet does a second pass on the suspect rows only, fixed before the run: every Jev-x row; Jev-w rows where any of the five questions has p >= 0.2 (and < 0.5); a seeded random 5% of the remaining Jev-w rows, to measure misses. Where Sonnet and Jev disagree, the rows go to the user grouped by pattern. The AWS/GitHub cross-check (a) runs afterwards.
- (f) (user, 2026-11-06) Pass design: Jev labels every row; one Sonnet pass on the suspect rows; no second Sonnet; where Sonnet and Jev disagree, the rows go to the user grouped by pattern.
- (g) (2026-11-06) BRIEF-v4 amended: the seam 3 rule now also covers changing where an existing webhook or subscription sends (user ruling on pilot 2 row q129, x). Suspect batches sbatch-001 to sbatch-006 were labelled before the amendment; later batches after it.

Why pilot 1 was unfair to Jev: the access rules sat in the "ignore" part of its question; the x list opened with "the text must make plain"; and a probability model cannot express "unclear, so x". Pilot 2 asks five facts and applies the rule in code (poc/v4-pilot2/rule.mjs).

## Why

rwxlite's vendor-label check (rwxlite commit f86f5b1; `/home/hamr/PycharmProjects/rwxlite/data/vendor/report.md`). On AWS "Permissions management" actions (221 endpoints), Jev said w on 165 and 0.2.0 learned it. Our second pass lowered mechanical x to w on 38 of them at p 0.97-0.99: IAM PutRolePolicy/CreatePolicy, KMS PutKeyPolicy, PutResourcePolicy on ECR/Glue/Secrets Manager/Logs/SSM, SNS SetTopicAttributes, Lake Formation PutDataLakeSettings, GitHub create-deploy-key, branch-protection restrictions. Same family as the credential-set leaks.

The worry this answers: an agent granting itself access is a problem the user may not know about until later.

## Steps

| # | Step | Status |
|---|---|---|
| 0 | Ruling D137. | done 2026-11-05 |
| 1 | Send rwxlite the shared wording. They relabel and retrain on the same test. | sent 2026-11-05, awaiting reply |
| 2 | BRIEF-v4: rewrite BRIEF-v3 around the one test. Fold in D98, D130, D136 and D137 as examples, not clauses. Version-controlled under a new `data/relabel-v4-<date>/` folder. It states that it outranks the task prompt. Calibrated blind on a practice set, then a pre-registered holdback, both drawn from sets we hold; the holdback is burned after scoring. | drafted and approved by the user 2026-11-05 (seams 1-5 ruled x); calibration via the step-4 pilot |
| 3 | Inventory: a table of every labelled set in both repos (columns below). In rwxmap it starts with `data/provider-corpus-2026-09-16`, `buildset-2026-09-18`, `exam-2026-09-17`, `exam-2026-09-20`, `exam-2026-09-22`, `exam3-2026-11-04`, `exam4-2026-11-04`, `calibration-2026-09-14`, `relabel-2026-09-22`, `relabel-buildset-2026-09-23`, `combined-2026-09-21`, `corpus`, `credential-set-2026-11-04`, `rwxlite-fresh-2026-11-03` and `gate4-2026-11-04`; the inventory confirms which actually hold truth labels. rwxlite's sets and its ~95k training rows come from rwxlite. | rwxmap side done 2026-11-05 (table below); rwxlite side in its own inventory |
| 4 | Pilot, then one pass. Pilot: about 200 w rows from tuning sets (half drawn from rows likely to touch access, half random w), labelled under v4 by two blind labellers on DIFFERENT models (not two sessions of one model; disputes to the user), and by Jev with a v4 question. Bar, set before running: Jev must catch at least 95% of the rows the labellers' truth calls x, with its false x reported separately. Jev passes: Jev labels the full w pass, and a blind labeller checks every row Jev calls x plus a random sample of rows it keeps w. Jev fails: local blind labellers do the pass (user ruling). Exam #5 truth stays two blind labellers, no Jev. | pilot 1 2026-11-05: Jev FAIL (18/28, 64.3% vs 95%). pilot 2 PASS 2026-11-06 (Jev factual questions, 27/28 = 96.4%). Full pass done 2026-11-06: Jev on all 33,321 rows, one Sonnet on 14,735 suspects, 4,688 disagreements ruled by the user by pattern, AWS/GitHub cross-check (8 of 45 raised to x). Result data/pass-v4-2026-11-05/truth-v4-pass.csv: 7,170 x, 26,151 w. Known gap: 18,576 Jev-w rows had no second look (the 5% sample found 2.1% x). |
| 5 | Hand-off: one merged v4 export for rwxlite (id, set, method, path, operationId, summary, description, label, brief, burned-or-tuning flag), written as an addition. rwxlite retrains on it (round 13). | not started |
| 6 | rwxmap code: the second pass never lowers an access-widening x, like D130. Own D-number, measured on the v4 tuning sets with leave-one-vendor-out. Check the mechanical side. The GET-twin question (AWS `GET /#Action=...` settled r while AWS calls it write; 848 endpoints) is a separate measured POC, not part of this. | not started |
| 7 | Fresh exam #5: exclude every vendor that appears in any v4 set, and count the pool first. Pre-register it. Score once for both projects: rwxmap mode a against the D133 bar, and rwxlite standalone. Must be same or better on both. | not started |
| 8 | README: a "what x covers" section and the exam #5 numbers, then a release. | not started |

### Inventory table columns (step 3)

| path | rows | brief it was labelled under | truth file | who uses it (tuning, burned exam, training) |
|---|---|---|---|---|

### rwxmap inventory (2026-11-05)

Counts are of CURRENT truth, unique by method, path, operationId and text (0 repeats found inside or across sets, so rows = unique operations). Counted with node (tools/csv.js) over the files named below. Source ops text for exam #3, #4 and the rwxlite fresh exam comes from their ops.csv.

| path | truth file (current) | brief | unique ops | r / w / x | use |
|---|---|---|---|---|---|
| data/combined-2026-09-21 (provider-corpus-2026-09-16 + exam-2026-09-17 + exam-2026-09-20) | labelled.csv (v3 for every non-r row, rulings applied; r rows keep v1 labels, never relabelled) | v3 (r rows v1) | 6557 | 2712 / 2378 / 1467 | tuning (all three parts; both exams are burned) |
| - part pc- = provider-corpus-2026-09-16 | same file, source_set | v3 (r rows v1) | 4171 | 2085 / 1228 / 858 | tuning set |
| - part x17- = exam-2026-09-17 | same file | v3 (r rows v1) | 1383 | 598 / 520 / 265 | burned exam (okta, docusign, xero) |
| - part x20- = exam-2026-09-20 | same file | v3 (r rows v1) | 1003 | 29 / 630 / 344 | burned exam (auth0, hubspot, klaviyo, miro, zendesk) |
| data/relabel-buildset-2026-09-23 (replaces buildset-2026-09-18 labels) | labelled.csv | v3 (the v1 labels in buildset-2026-09-18/label are superseded) | 1819 | 43 / 1130 / 646 | tuning (write-heavy; step 2 closed, D81) |
| data/exam-2026-09-22 | labelled.csv (2 D93 rulings applied) | v3 | 4279 | 2227 / 1347 / 705 | burned exam (cloudflare, pagerduty, sentry) |
| data/exam3-2026-11-04 | truth.csv (truth-d136.csv: 2 rows x to w, so w 439 / x 330) | v3 (+D136 in the copy) | 1377 | 608 / 437 / 332 | burned exam (shared with rwxlite) |
| data/exam4-2026-11-04 | truth.csv (truth-d136.csv: 2 rows x to w, so w 469 / x 321) | v3 (+D136 in the copy) | 1505 | 715 / 467 / 323 | burned exam (shared with rwxlite) |
| data/rwxlite-fresh-2026-11-03 | truth.csv (15 rulings applied) | v3 (per rwxlite's inventory; the README does not say) | 949 | 406 / 328 / 215 | rwxlite's burned exam, tuning here |
| **Total, v3 sets** | | | **16486** | **6711 / 6087 / 3688** | |

Not counted as separate sets (subsets of the above or no truth): data/relabel-2026-09-22 (the v3 relabel itself; its output is in combined/labelled.csv), calib/ folders under relabel-2026-09-22 and exam-2026-09-22 (subsets of combined), data/buildset-2026-09-18, data/provider-corpus-2026-09-16/label, exam-2026-09-17/label and exam-2026-09-20/label (the v1 originals, superseded by combined/labelled.csv), credential-set-2026-11-04 (no truth), jev-*, markers-2026-11-04, discover-*, formats-*, f1-*, gate4-* (outputs, no truth).

**Total unique w rows under v3 truth: 6087** (6091 if exam #3 and #4 use their D136 copies). Cross-set repeats: 0 (checked on method, path, operationId and text; and on provider, method, path, operationId).

**Sets whose current truth is still pre-v3:**

| path | truth file | brief | unique ops | r / w / x | use |
|---|---|---|---|---|---|
| data/calibration-2026-09-14 | calibA/B/C-labels.csv (550 label rows) | v1 (the calibrated BRIEF.md of that folder) | 543 | 1 / 473 / 66, plus 3 unsettled (?, or x and w) | diagnostic (v1 calibration samples from the old exam 3; mostly w, since its purpose was w vs x drift) |
| data/corpus/labelled.csv | gt_class | unclear (M0-era hand labels, holdout1-5; rwxlite's inventory calls them v1) | 1186 | 467 / 394 / 325 | diagnostic / archived M0 (332 of its rows also appear, by method, path and operationId, in the v3 sets above) |

Open on provenance: nothing in data/corpus says which brief labelled corpus/labelled.csv. The overlap with v3 sets means about a third of it already has v3 truth elsewhere.

### rwxlite inventory (2026-11-05)

Source: rwxlite docs/wiki/label-inventory.md (rwxlite 570c25a). 104,855 distinct operations, all under BRIEF-v3 + D136. Round 12 training is 95,291 rows: Jev soft target 79.2% (75,483), mechanical only 16.0% (15,212), hand/ruled 4.8% (4,596). Their access-rule estimate is about 1,030 operations by a narrow pattern (1,027 currently w; Microsoft Graph 574, AWS 147) and about 5,400 by a broad one; both overcount. Their hand labels were two sessions of one model, so they count as one opinion.

Sizing (rwxlite label-inventory.md section 9, 806ec1b): 29,327 unique w operations of 101,806 (Jev 21,673; hand/ruled 5,121; mechanical 1,920; generated 613); 615 variants from 160 seeds (570 surface, 45 contrast); a keyword scope of about 1,710 likely D137 rows.

## Rules

- Originals are kept.
- Every truth file names its brief.
- Every score names its truth version.
- Old numbers are quoted with the brief they were labelled under.
- A burned exam stays burned as an exam, but can be used as tuning or training data under v4 (D24).

## Open questions

- The GET twins (848 endpoints): separate measured POC.
- Who labels rwxlite's ~95k training rows, and how: rwxlite's call, under the same brief.
- Which vendors are left for exam #5.
