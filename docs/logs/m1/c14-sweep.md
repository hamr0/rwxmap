# M1-C14 sweep: 8 switch combinations x 6 sets

No row loosened under any combination versus the all-switches-off baseline —
this pass stayed tightening-only, as intended.

Measurement only — nothing here is adopted. c14.classify(row) with
opts={} is proven identical to c11.classify(row) by c14.test.mjs.

holdout3: 226 rows. holdout4: 210 rows. holdout5: 323 rows.

## Configuration: baseline

opts: {}

| set | n | exact | leaks | over_tight | exact_pct | leak_pct | over_tight_pct |
| --- | --- | --- | --- | --- | --- | --- | --- |
| camara | 292 | 260 | 1 | 31 | 89.0 | 0.3 | 10.6 |
| holdout1 | 207 | 146 | 2 | 59 | 70.5 | 1.0 | 28.5 |
| holdout2 | 220 | 194 | 0 | 26 | 88.2 | 0.0 | 11.8 |
| holdout3 | 226 | 198 | 1 | 27 | 87.6 | 0.4 | 11.9 |
| holdout4 | 210 | 182 | 0 | 28 | 86.7 | 0.0 | 13.3 |
| holdout5 | 323 | 241 | 17 | 65 | 74.6 | 5.3 | 20.1 |
| all | 1478 | 1221 | 21 | 236 | 82.6 | 1.4 | 16.0 |

### hold-out 5, per vendor

| set | n | exact | leaks | over_tight | exact_pct | leak_pct | over_tight_pct |
| --- | --- | --- | --- | --- | --- | --- | --- |
| slack | 174 | 111 | 17 | 46 | 63.8 | 9.8 | 26.4 |
| notion | 24 | 19 | 0 | 5 | 79.2 | 0.0 | 20.8 |
| amazon | 125 | 111 | 0 | 14 | 88.8 | 0.0 | 11.2 |

Negative controls — terminateCall: x, updateSessionStatus: x — PASS

## Configuration: readGet

opts: {"readGet":true}

| set | n | exact | leaks | over_tight | exact_pct | leak_pct | over_tight_pct |
| --- | --- | --- | --- | --- | --- | --- | --- |
| camara | 292 | 238 | 1 | 53 | 81.5 | 0.3 | 18.2 |
| holdout1 | 207 | 146 | 2 | 59 | 70.5 | 1.0 | 28.5 |
| holdout2 | 220 | 176 | 0 | 44 | 80.0 | 0.0 | 20.0 |
| holdout3 | 226 | 169 | 1 | 56 | 74.8 | 0.4 | 24.8 |
| holdout4 | 210 | 167 | 0 | 43 | 79.5 | 0.0 | 20.5 |
| holdout5 | 323 | 222 | 10 | 91 | 68.7 | 3.1 | 28.2 |
| all | 1478 | 1118 | 14 | 346 | 75.6 | 0.9 | 23.4 |

### hold-out 5, per vendor

| set | n | exact | leaks | over_tight | exact_pct | leak_pct | over_tight_pct |
| --- | --- | --- | --- | --- | --- | --- | --- |
| slack | 174 | 98 | 10 | 66 | 56.3 | 5.7 | 37.9 |
| notion | 24 | 17 | 0 | 7 | 70.8 | 0.0 | 29.2 |
| amazon | 125 | 107 | 0 | 18 | 85.6 | 0.0 | 14.4 |

Negative controls — terminateCall: x, updateSessionStatus: x — PASS

## Configuration: textFallback

opts: {"textFallback":true}

| set | n | exact | leaks | over_tight | exact_pct | leak_pct | over_tight_pct |
| --- | --- | --- | --- | --- | --- | --- | --- |
| camara | 292 | 260 | 1 | 31 | 89.0 | 0.3 | 10.6 |
| holdout1 | 207 | 146 | 2 | 59 | 70.5 | 1.0 | 28.5 |
| holdout2 | 220 | 194 | 0 | 26 | 88.2 | 0.0 | 11.8 |
| holdout3 | 226 | 198 | 1 | 27 | 87.6 | 0.4 | 11.9 |
| holdout4 | 210 | 182 | 0 | 28 | 86.7 | 0.0 | 13.3 |
| holdout5 | 323 | 241 | 17 | 65 | 74.6 | 5.3 | 20.1 |
| all | 1478 | 1221 | 21 | 236 | 82.6 | 1.4 | 16.0 |

### hold-out 5, per vendor

| set | n | exact | leaks | over_tight | exact_pct | leak_pct | over_tight_pct |
| --- | --- | --- | --- | --- | --- | --- | --- |
| slack | 174 | 111 | 17 | 46 | 63.8 | 9.8 | 26.4 |
| notion | 24 | 19 | 0 | 5 | 79.2 | 0.0 | 20.8 |
| amazon | 125 | 111 | 0 | 14 | 88.8 | 0.0 | 11.2 |

Negative controls — terminateCall: x, updateSessionStatus: x — PASS

## Configuration: nounStem

opts: {"nounStem":true}

| set | n | exact | leaks | over_tight | exact_pct | leak_pct | over_tight_pct |
| --- | --- | --- | --- | --- | --- | --- | --- |
| camara | 292 | 260 | 1 | 31 | 89.0 | 0.3 | 10.6 |
| holdout1 | 207 | 146 | 2 | 59 | 70.5 | 1.0 | 28.5 |
| holdout2 | 220 | 194 | 0 | 26 | 88.2 | 0.0 | 11.8 |
| holdout3 | 226 | 198 | 1 | 27 | 87.6 | 0.4 | 11.9 |
| holdout4 | 210 | 182 | 0 | 28 | 86.7 | 0.0 | 13.3 |
| holdout5 | 323 | 241 | 17 | 65 | 74.6 | 5.3 | 20.1 |
| all | 1478 | 1221 | 21 | 236 | 82.6 | 1.4 | 16.0 |

### hold-out 5, per vendor

| set | n | exact | leaks | over_tight | exact_pct | leak_pct | over_tight_pct |
| --- | --- | --- | --- | --- | --- | --- | --- |
| slack | 174 | 111 | 17 | 46 | 63.8 | 9.8 | 26.4 |
| notion | 24 | 19 | 0 | 5 | 79.2 | 0.0 | 20.8 |
| amazon | 125 | 111 | 0 | 14 | 88.8 | 0.0 | 11.2 |

Negative controls — terminateCall: x, updateSessionStatus: x — PASS

## Configuration: readGet+textFallback

opts: {"readGet":true,"textFallback":true}

| set | n | exact | leaks | over_tight | exact_pct | leak_pct | over_tight_pct |
| --- | --- | --- | --- | --- | --- | --- | --- |
| camara | 292 | 238 | 1 | 53 | 81.5 | 0.3 | 18.2 |
| holdout1 | 207 | 146 | 2 | 59 | 70.5 | 1.0 | 28.5 |
| holdout2 | 220 | 176 | 0 | 44 | 80.0 | 0.0 | 20.0 |
| holdout3 | 226 | 169 | 1 | 56 | 74.8 | 0.4 | 24.8 |
| holdout4 | 210 | 167 | 0 | 43 | 79.5 | 0.0 | 20.5 |
| holdout5 | 323 | 210 | 9 | 104 | 65.0 | 2.8 | 32.2 |
| all | 1478 | 1106 | 13 | 359 | 74.8 | 0.9 | 24.3 |

### hold-out 5, per vendor

| set | n | exact | leaks | over_tight | exact_pct | leak_pct | over_tight_pct |
| --- | --- | --- | --- | --- | --- | --- | --- |
| slack | 174 | 86 | 9 | 79 | 49.4 | 5.2 | 45.4 |
| notion | 24 | 17 | 0 | 7 | 70.8 | 0.0 | 29.2 |
| amazon | 125 | 107 | 0 | 18 | 85.6 | 0.0 | 14.4 |

Negative controls — terminateCall: x, updateSessionStatus: x — PASS

## Configuration: readGet+nounStem

opts: {"readGet":true,"nounStem":true}

| set | n | exact | leaks | over_tight | exact_pct | leak_pct | over_tight_pct |
| --- | --- | --- | --- | --- | --- | --- | --- |
| camara | 292 | 233 | 1 | 58 | 79.8 | 0.3 | 19.9 |
| holdout1 | 207 | 146 | 2 | 59 | 70.5 | 1.0 | 28.5 |
| holdout2 | 220 | 176 | 0 | 44 | 80.0 | 0.0 | 20.0 |
| holdout3 | 226 | 166 | 1 | 59 | 73.5 | 0.4 | 26.1 |
| holdout4 | 210 | 163 | 0 | 47 | 77.6 | 0.0 | 22.4 |
| holdout5 | 323 | 219 | 10 | 94 | 67.8 | 3.1 | 29.1 |
| all | 1478 | 1103 | 14 | 361 | 74.6 | 0.9 | 24.4 |

### hold-out 5, per vendor

| set | n | exact | leaks | over_tight | exact_pct | leak_pct | over_tight_pct |
| --- | --- | --- | --- | --- | --- | --- | --- |
| slack | 174 | 96 | 10 | 68 | 55.2 | 5.7 | 39.1 |
| notion | 24 | 17 | 0 | 7 | 70.8 | 0.0 | 29.2 |
| amazon | 125 | 106 | 0 | 19 | 84.8 | 0.0 | 15.2 |

Negative controls — terminateCall: x, updateSessionStatus: x — PASS

## Configuration: textFallback+nounStem

opts: {"textFallback":true,"nounStem":true}

| set | n | exact | leaks | over_tight | exact_pct | leak_pct | over_tight_pct |
| --- | --- | --- | --- | --- | --- | --- | --- |
| camara | 292 | 260 | 1 | 31 | 89.0 | 0.3 | 10.6 |
| holdout1 | 207 | 146 | 2 | 59 | 70.5 | 1.0 | 28.5 |
| holdout2 | 220 | 194 | 0 | 26 | 88.2 | 0.0 | 11.8 |
| holdout3 | 226 | 198 | 1 | 27 | 87.6 | 0.4 | 11.9 |
| holdout4 | 210 | 182 | 0 | 28 | 86.7 | 0.0 | 13.3 |
| holdout5 | 323 | 241 | 17 | 65 | 74.6 | 5.3 | 20.1 |
| all | 1478 | 1221 | 21 | 236 | 82.6 | 1.4 | 16.0 |

### hold-out 5, per vendor

| set | n | exact | leaks | over_tight | exact_pct | leak_pct | over_tight_pct |
| --- | --- | --- | --- | --- | --- | --- | --- |
| slack | 174 | 111 | 17 | 46 | 63.8 | 9.8 | 26.4 |
| notion | 24 | 19 | 0 | 5 | 79.2 | 0.0 | 20.8 |
| amazon | 125 | 111 | 0 | 14 | 88.8 | 0.0 | 11.2 |

Negative controls — terminateCall: x, updateSessionStatus: x — PASS

## Configuration: readGet+textFallback+nounStem

opts: {"readGet":true,"textFallback":true,"nounStem":true}

| set | n | exact | leaks | over_tight | exact_pct | leak_pct | over_tight_pct |
| --- | --- | --- | --- | --- | --- | --- | --- |
| camara | 292 | 233 | 1 | 58 | 79.8 | 0.3 | 19.9 |
| holdout1 | 207 | 146 | 2 | 59 | 70.5 | 1.0 | 28.5 |
| holdout2 | 220 | 176 | 0 | 44 | 80.0 | 0.0 | 20.0 |
| holdout3 | 226 | 166 | 1 | 59 | 73.5 | 0.4 | 26.1 |
| holdout4 | 210 | 163 | 0 | 47 | 77.6 | 0.0 | 22.4 |
| holdout5 | 323 | 207 | 9 | 107 | 64.1 | 2.8 | 33.1 |
| all | 1478 | 1091 | 13 | 374 | 73.8 | 0.9 | 25.3 |

### hold-out 5, per vendor

| set | n | exact | leaks | over_tight | exact_pct | leak_pct | over_tight_pct |
| --- | --- | --- | --- | --- | --- | --- | --- |
| slack | 174 | 84 | 9 | 81 | 48.3 | 5.2 | 46.6 |
| notion | 24 | 17 | 0 | 7 | 70.8 | 0.0 | 29.2 |
| amazon | 125 | 106 | 0 | 19 | 84.8 | 0.0 | 15.2 |

Negative controls — terminateCall: x, updateSessionStatus: x — PASS

## Negative controls, all configurations

| configuration | terminateCall | updateSessionStatus | result |
| --- | --- | --- | --- |
| baseline | x | x | PASS |
| readGet | x | x | PASS |
| textFallback | x | x | PASS |
| nounStem | x | x | PASS |
| readGet+textFallback | x | x | PASS |
| readGet+nounStem | x | x | PASS |
| textFallback+nounStem | x | x | PASS |
| readGet+textFallback+nounStem | x | x | PASS |

PASS — both controls x in every configuration.

## Rows changed vs baseline, across every non-baseline configuration

tightened: 522
loosened: 0
total changed rows (config x row pairs): 522

Full row-level detail is in docs/logs/m1/c14-changed-rows.csv.

