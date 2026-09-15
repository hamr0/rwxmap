# data/calibration-2026-09-15 — POST calibration

## Purpose

Exam 5's POST rows scored badly, but the labelling brief's POST guidance
(`data/calibration-2026-09-14/BRIEF.md`, "Methods" paragraph) was never
checked against the corpus's own POST truth. This prepares blind files so
labellers can label the corpus's POST rows under the brief, to be compared
with corpus truth. A third is held back unlabelled, so a fixed brief can
later be checked once on rows it has not seen.

## Counts (this run)

- Total corpus POST rows: 509
- Measure (about 2/3, split across two labelling parts): 339
  - Part 1: 170
  - Part 2: 169
- Holdback (about 1/3, unlabelled for now): 170
- Seed: 20260916

## Per-vendor split

| vendor | n | measure | holdback |
|---|---|---|---|
| adyen | 23 | 15 | 8 |
| amazon | 43 | 29 | 14 |
| box | 24 | 16 | 8 |
| camara | 138 | 92 | 46 |
| cloudflare | 13 | 9 | 4 |
| discord | 13 | 9 | 4 |
| linode | 24 | 16 | 8 |
| notion | 6 | 4 | 2 |
| pagerduty | 20 | 13 | 7 |
| sentry | 11 | 7 | 4 |
| slack | 94 | 63 | 31 |
| twilio | 62 | 41 | 21 |
| vercel | 24 | 16 | 8 |
| x | 14 | 9 | 5 |

## Files

- `postcal-blind-part1.csv`, `postcal-blind-part2.csv`: blind rows to label
  under `data/calibration-2026-09-14/BRIEF.md`. Columns: row_id, provider,
  method, path, operationId, summary, description. No truth, set, or
  confidence columns.
- `postcal-holdback-blind.csv`: same columns, holdback rows. Not to be
  labelled now — held back for a single later check of a revised brief.
- `postcal-key.csv`: row_id, corpus_index, set, vendor, method, path,
  operationId, split. No gt_class — truth is read from the corpus at score
  time via corpus_index.
- Labellers will produce `postcal-labels-part1.csv` and
  `postcal-labels-part2.csv` under this same directory.

## Reproduce

```
node poc/exam/make-postcal.mjs
```

Deterministic: same seed (20260916), same corpus -> same output files, every
run (byte-identical).

## Pre-registered reading (fixed before labelling)

Reading, fixed before labelling: if the brief agrees with corpus truth on
the measure rows at about the write-row rate (185 of 200, 92.5%) and calls
a similar share of rows x, the POST drop on exam 5 belongs to the tool. If
the brief calls clearly fewer rows x than corpus truth, the brief is loose
on POST and exam 5's POST score is not trustworthy until the brief is
fixed and checked once on the holdback.

## Result (2026-09-15)

Scorer: `node poc/exam/score-postcal.mjs` (add `rows` for the disagreement
list). 195 of 339 agree (57.5%); x-share sheet 22.4% vs corpus 60.5%; x
called w 132. By the pre-registered reading, the brief is loose on POST.
Cause: the brief calls POST creates w, corpus truth calls them x by road 2
(create 117 x / 9 w). Holdback (170 rows) is still unlabelled and reserved
for one check of a fixed brief.

## Revised brief check (pre-registered 2026-09-15, before labelling)

The brief's Methods paragraph was revised (BRIEF.md header, "Revised
2026-09-15"). It is checked in two steps, both under the revised brief.

1. Practice: the 339 measure rows are relabelled blind into
   `postcal-v2-labels-part1.csv` and `postcal-v2-labels-part2.csv`.
   These rows shaped the revision, so this is a tuning readout, not a
   pass. If practice agreement is below 85%, stop and report before
   the holdback is touched.
2. Check, once: the 170 holdback rows are labelled blind into
   `postcal-holdback-labels.csv`. PASS if agreement with corpus truth
   is at least 85% AND the sheet's x-share is within 10 points of
   corpus truth's x-share. The write-row bar was 92.5%; the bar is
   lower because corpus POST truth splits near-identical rows
   (slack conversations_setPurpose w vs conversations_setTopic x,
   usergroups_disable w vs usergroups_enable x). On PASS, exam 5's 300
   POST rows are relabelled under the revised brief and POST re-scored
   once. On FAIL, stop and report; exam 5 POST stays untrusted and the
   holdback is burned.

Scorer: `node poc/exam/score-postcal.mjs v2` (practice) and
`node poc/exam/score-postcal.mjs holdback` (check); add `rows` for the
disagreement list.
