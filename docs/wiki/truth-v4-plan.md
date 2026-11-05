# Truth v4 plan (D137)

## Ruling

User ruling, 2026-11-05 (D137). It widens the x test. It does not change the definition.

x = after this call, a later call cannot put things back the way they were, including everything anyone could have done in between. That happens in two ways:

- gone: delete, purge, a job stopped with its work lost;
- out of your hands: sent, published, charged, run, or a secret or a right handed to someone.

Access: an operation that grants or widens who can do what to which resource is x. That covers IAM, resource, bucket and key policies; role or permission assignments and bindings; ACLs; share and invite grants; deploy keys; setIamPolicy-style calls. Narrowing access (admin to viewer) stays w: nobody gains anything in between. A set or replace whose text doesn't say whether it widens or narrows is x by the doubt rule. A "policy" that doesn't control access (autoscaling, lifecycle, retention, routing) stays w unless it's x for another reason.

D130 (setting a password), BRIEF-v3 clause (c) (sends) and clause (f) (job stops) are now examples of this one test, not separate clauses. D136 (restart and stop are w) is consistent with it: nothing is gained in between. The chmod reading holds: changing who can access a thing (chmod/chown) is the most guarded act.

Scope: every set either project (rwxmap or rwxlite) ever labelled gets new truth under BRIEF-v4, and that becomes the one truth. Originals are kept untouched; the new truth goes beside them as additions. rwxlite retrains on it. rwxmap code stays unchanged until its own D-number and fresh exam #5.

## Why

rwxlite's vendor-label check (rwxlite commit f86f5b1; `/home/hamr/PycharmProjects/rwxlite/data/vendor/report.md`). On AWS "Permissions management" actions (221 endpoints), Jev said w on 165 and 0.2.0 learned it. Our second pass lowered mechanical x to w on 38 of them at p 0.97-0.99: IAM PutRolePolicy/CreatePolicy, KMS PutKeyPolicy, PutResourcePolicy on ECR/Glue/Secrets Manager/Logs/SSM, SNS SetTopicAttributes, Lake Formation PutDataLakeSettings, GitHub create-deploy-key, branch-protection restrictions. Same family as the credential-set leaks.

The worry this answers: an agent granting itself access is a problem the user may not know about until later.

## Steps

| # | Step | Status |
|---|---|---|
| 0 | Ruling D137. | done 2026-11-05 |
| 1 | Send rwxlite the shared wording. They relabel and retrain on the same test. | sent 2026-11-05, awaiting reply |
| 2 | BRIEF-v4: rewrite BRIEF-v3 around the one test. Fold in D98, D130, D136 and D137 as examples, not clauses. Version-controlled under a new `data/relabel-v4-<date>/` folder. It states that it outranks the task prompt. Calibrated blind on a practice set, then a pre-registered holdback, both drawn from sets we hold; the holdback is burned after scoring. | not started |
| 3 | Inventory: a table of every labelled set in both repos (columns below). In rwxmap it starts with `data/provider-corpus-2026-09-16`, `buildset-2026-09-18`, `exam-2026-09-17`, `exam-2026-09-20`, `exam-2026-09-22`, `exam3-2026-11-04`, `exam4-2026-11-04`, `calibration-2026-09-14`, `relabel-2026-09-22`, `relabel-buildset-2026-09-23`, `combined-2026-09-21`, `corpus`, `credential-set-2026-11-04`, `rwxlite-fresh-2026-11-03` and `gate4-2026-11-04`; the inventory confirms which actually hold truth labels. rwxlite's sets and its ~95k training rows come from rwxlite. | not started |
| 4 | Relabel: every row of every set, under BRIEF-v4, by two blind labellers told to use no scripts, with the user ruling disputes. Each set gets a `truth-v4.csv` (and a `.sha256`) beside its original truth; originals stay untouched. Count the rows before launching; the user approves each batch. | not started |
| 5 | Hand-off: one merged v4 export for rwxlite (id, set, method, path, operationId, summary, description, label, brief, burned-or-tuning flag), written as an addition. rwxlite retrains on it (round 13). | not started |
| 6 | rwxmap code: the second pass never lowers an access-widening x, like D130. Own D-number, measured on the v4 tuning sets with leave-one-vendor-out. Check the mechanical side. The GET-twin question (AWS `GET /#Action=...` settled r while AWS calls it write; 848 endpoints) is a separate measured POC, not part of this. | not started |
| 7 | Fresh exam #5: exclude every vendor that appears in any v4 set, and count the pool first. Pre-register it. Score once for both projects: rwxmap mode a against the D133 bar, and rwxlite standalone. Must be same or better on both. | not started |
| 8 | README: a "what x covers" section and the exam #5 numbers, then a release. | not started |

### Inventory table columns (step 3)

| path | rows | brief it was labelled under | truth file | who uses it (tuning, burned exam, training) |
|---|---|---|---|---|

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
