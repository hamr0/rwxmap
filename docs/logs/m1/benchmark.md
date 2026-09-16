# M1 benchmark: c11 vs dumb baselines

c11.mjs's classify(row) — the adopted C11 floor + raise-only shape —
scored alongside three dumb baselines (baselines.mjs: all-x, get-else-x,
method-prior) against all five sets, so the c11 numbers in
docs/logs/m1/c11-final.md mean something relative to a floor.

holdout3: present, 226 rows.
holdout4: present, 210 rows.

## (a) Per-set summary

### c11

| set | n | exact | leaks | over_tight | exact_pct | leak_pct | over_tight_pct |
| --- | --- | --- | --- | --- | --- | --- | --- |
| camara | 292 | 260 | 1 | 31 | 89.0 | 0.3 | 10.6 |
| holdout1 | 207 | 146 | 2 | 59 | 70.5 | 1.0 | 28.5 |
| holdout2 | 220 | 194 | 0 | 26 | 88.2 | 0.0 | 11.8 |
| holdout3 | 226 | 198 | 1 | 27 | 87.6 | 0.4 | 11.9 |
| holdout4 | 210 | 182 | 0 | 28 | 86.7 | 0.0 | 13.3 |

### all-x

| set | n | exact | leaks | over_tight | exact_pct | leak_pct | over_tight_pct |
| --- | --- | --- | --- | --- | --- | --- | --- |
| camara | 292 | 85 | 0 | 207 | 29.1 | 0.0 | 70.9 |
| holdout1 | 207 | 67 | 0 | 140 | 32.4 | 0.0 | 67.6 |
| holdout2 | 220 | 53 | 0 | 167 | 24.1 | 0.0 | 75.9 |
| holdout3 | 226 | 68 | 0 | 158 | 30.1 | 0.0 | 69.9 |
| holdout4 | 210 | 40 | 0 | 170 | 19.0 | 0.0 | 81.0 |

### get-else-x

| set | n | exact | leaks | over_tight | exact_pct | leak_pct | over_tight_pct |
| --- | --- | --- | --- | --- | --- | --- | --- |
| camara | 292 | 181 | 0 | 111 | 62.0 | 0.0 | 38.0 |
| holdout1 | 207 | 67 | 0 | 140 | 32.4 | 0.0 | 67.6 |
| holdout2 | 220 | 147 | 0 | 73 | 66.8 | 0.0 | 33.2 |
| holdout3 | 226 | 170 | 0 | 56 | 75.2 | 0.0 | 24.8 |
| holdout4 | 210 | 142 | 0 | 68 | 67.6 | 0.0 | 32.4 |

### method-prior

| set | n | exact | leaks | over_tight | exact_pct | leak_pct | over_tight_pct |
| --- | --- | --- | --- | --- | --- | --- | --- |
| camara | 292 | 214 | 8 | 70 | 73.3 | 2.7 | 24.0 |
| holdout1 | 207 | 164 | 24 | 19 | 79.2 | 11.6 | 9.2 |
| holdout2 | 220 | 195 | 4 | 21 | 88.6 | 1.8 | 9.5 |
| holdout3 | 226 | 183 | 22 | 21 | 81.0 | 9.7 | 9.3 |
| holdout4 | 210 | 187 | 3 | 20 | 89.0 | 1.4 | 9.5 |

## (b) Tuned / reference / clean-exam

tuned = camara + holdout1 + holdout3 (word lists were fitted on these;
D35 explicitly demotes hold-out 3 to a tuning set). reference = holdout2
(never used to choose a shape, D24, but scored repeatedly and carries a
recorded taint, D27 — not blind, not fitted on). clean-exam = holdout4
(Linode, Cloudflare, X; 210 rows; the only set scored once and never
fitted on, D35).

clean-exam is the only honest transfer number — the headline should be
quoted from that row, not from tuned or reference.
tuned numbers are upper bounds, not evidence of transfer.

Headline (c11, clean-exam, n=210): 182 exact (86.7%), 0 leaks (0.0%), 28 over-tight (13.3%).

### c11

| bucket | n | exact | leaks | over_tight | exact_pct | leak_pct | over_tight_pct |
| --- | --- | --- | --- | --- | --- | --- | --- |
| tuned | 725 | 604 | 4 | 117 | 83.3 | 0.6 | 16.1 |
| reference | 220 | 194 | 0 | 26 | 88.2 | 0.0 | 11.8 |
| clean-exam | 210 | 182 | 0 | 28 | 86.7 | 0.0 | 13.3 |
| all | 1155 | 980 | 4 | 171 | 84.8 | 0.3 | 14.8 |

### all-x

| bucket | n | exact | leaks | over_tight | exact_pct | leak_pct | over_tight_pct |
| --- | --- | --- | --- | --- | --- | --- | --- |
| tuned | 725 | 220 | 0 | 505 | 30.3 | 0.0 | 69.7 |
| reference | 220 | 53 | 0 | 167 | 24.1 | 0.0 | 75.9 |
| clean-exam | 210 | 40 | 0 | 170 | 19.0 | 0.0 | 81.0 |
| all | 1155 | 313 | 0 | 842 | 27.1 | 0.0 | 72.9 |

### get-else-x

| bucket | n | exact | leaks | over_tight | exact_pct | leak_pct | over_tight_pct |
| --- | --- | --- | --- | --- | --- | --- | --- |
| tuned | 725 | 418 | 0 | 307 | 57.7 | 0.0 | 42.3 |
| reference | 220 | 147 | 0 | 73 | 66.8 | 0.0 | 33.2 |
| clean-exam | 210 | 142 | 0 | 68 | 67.6 | 0.0 | 32.4 |
| all | 1155 | 707 | 0 | 448 | 61.2 | 0.0 | 38.8 |

### method-prior

| bucket | n | exact | leaks | over_tight | exact_pct | leak_pct | over_tight_pct |
| --- | --- | --- | --- | --- | --- | --- | --- |
| tuned | 725 | 561 | 54 | 110 | 77.4 | 7.4 | 15.2 |
| reference | 220 | 195 | 4 | 21 | 88.6 | 1.8 | 9.5 |
| clean-exam | 210 | 187 | 3 | 20 | 89.0 | 1.4 | 9.5 |
| all | 1155 | 943 | 61 | 151 | 81.6 | 5.3 | 13.1 |

## (c) Negative controls

Both must be x under c11.

| classifier | control | class |
| --- | --- | --- |
| c11 | terminateCall (ClickToDial DELETE /calls/{callId}) | x |
| c11 | updateSessionStatus (WebRTC PUT /sessions/{mediaSessionId}/status) | x |
| all-x | terminateCall (ClickToDial DELETE /calls/{callId}) | x |
| all-x | updateSessionStatus (WebRTC PUT /sessions/{mediaSessionId}/status) | x |
| get-else-x | terminateCall (ClickToDial DELETE /calls/{callId}) | x |
| get-else-x | updateSessionStatus (WebRTC PUT /sessions/{mediaSessionId}/status) | x |
| method-prior | terminateCall (ClickToDial DELETE /calls/{callId}) | w |
| method-prior | updateSessionStatus (WebRTC PUT /sessions/{mediaSessionId}/status) | w |

PASS — both controls x under c11.

## (d) Evidence vs floor (c11)

The floor bucket is the human review pile; locked rows (GET/HEAD/OPTIONS,
auto-r) never need review.

### per set

| set | locked_count | locked_pct | evidence_count | evidence_pct | floor_count | floor_pct |
| --- | --- | --- | --- | --- | --- | --- |
| camara | 96 | 32.9 | 83 | 28.4 | 113 | 38.7 |
| holdout1 | 0 | 0.0 | 61 | 29.5 | 146 | 70.5 |
| holdout2 | 94 | 42.7 | 25 | 11.4 | 101 | 45.9 |
| holdout3 | 102 | 45.1 | 36 | 15.9 | 88 | 38.9 |
| holdout4 | 102 | 48.6 | 20 | 9.5 | 88 | 41.9 |
| all | 394 | 34.1 | 225 | 19.5 | 536 | 46.4 |

### tuned / reference / clean-exam

| bucket | locked_count | locked_pct | evidence_count | evidence_pct | floor_count | floor_pct |
| --- | --- | --- | --- | --- | --- | --- |
| tuned | 198 | 27.3 | 180 | 24.8 | 347 | 47.9 |
| reference | 94 | 42.7 | 25 | 11.4 | 101 | 45.9 |
| clean-exam | 102 | 48.6 | 20 | 9.5 | 88 | 41.9 |
| all | 394 | 34.1 | 225 | 19.5 | 536 | 46.4 |

