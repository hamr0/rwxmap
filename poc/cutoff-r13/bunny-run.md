# bunny.net curiosity run, R13 at cut-off 0.97 and 0.90 (2026-11-07)

One unseen vendor through the real CLI. bunny.net is a CDN and storage API:
113 operations, official spec sha256
2b06f94dbfbf974c2f1257bf730eaeab3342a6bd66ba1e559ecc1b42e7de5a36. It came
from the exam #5 shortlist and is in no labelled set. It is NOT labelled, so
there is no truth and no exact/leak count, only letters.

## How it ran

- Real CLI from the exam #5 R13 scratch copy (mechanical v4 plus rwxlite
  R13), and a copy that differs by exactly the `LOWER_MIN_P` line (0.90).
- Model `rwxlite-0.3.1+bbe1997d`, fp32, from the scratch cache.
- Three outputs: `mech` (`--engine mechanical`), `a` (mode a, 0.97), `a90`
  (mode a, 0.90). Raw files: `.claude/scratchpad/bunny-r13/{mech,a,a90}/bunny.rwxmap.review.json`.

## Letters (r / w / x)

| run | r | w | x | rows with rwxlite evidence |
|---|---|---|---|---|
| mechanical v4 | 42 | 10 | 61 | 0 |
| + R13 at 0.97 | 42 | 12 | 59 | 4 |
| + R13 at 0.90 | 45 | 25 | 43 | 20 |

Undecided counts (24 at 0.97, 8 at 0.90) were read from the run's own
output at the time; they are not in the review files, so this readout does
not re-derive them.

At 0.97, 4 rows differ from mechanical: 3 POST x to w (`/dnszone/{id}`,
`/dnszone/{zoneId}/records/{id}`, `/loadbalancer/{loadBalancerId}`) and
`addAllowedReferrer` w to x.

## The 20 rows that differ from mechanical at 0.90

| method | path | mech | 0.97 | 0.90 |
|---|---|---|---|---|
| POST | /dnszone | x | x | w |
| POST | /dnszone/{id} | x | w | w |
| POST | /dnszone/checkavailability | x | x | r |
| POST | /dnszone/{zoneId}/records/{id} | x | w | w |
| POST | /pullzone | x | x | w |
| POST | /pullzone/{id} | x | x | w |
| POST | /pullzone/{pullZoneId}/edgerules/addOrUpdate | x | x | w |
| POST | /pullzone/{pullZoneId}/edgerules/{edgeRuleId}/setEdgeRuleEnabled | x | x | w |
| POST | /pullzone/checkavailability | x | x | r |
| POST | /pullzone/{id}/addHostname | x | x | w |
| POST | /pullzone/{id}/addBlockedIp | x | x | w |
| POST | /storagezone | x | x | w |
| POST | /storagezone/checkavailability | x | x | r |
| POST | /storagezone/{id} | x | x | w |
| POST | /videolibrary/{id}/addAllowedReferrer | w | x | x |
| POST | /loadbalancer/{loadBalancerId}/origingroup/{originGroupId}/origin/{originId} | x | x | w |
| POST | /loadbalancer/{loadBalancerId}/origingroup/{id} | x | x | w |
| POST | /loadbalancer | x | x | w |
| POST | /loadbalancer/{loadBalancerId} | x | w | w |
| POST | /dnszone/{id}/dnssec | x | x | w |

Counts: 3 POST x to r (checkavailability), 16 POST x to w, 1 w to x
(`addAllowedReferrer`: R13 raised a widening that mechanical missed, at both
cuts).

## Read (orchestrator, unlabelled)

No visible leak. The creates and `addHostname` are the arguable ones: going
live publicly could be read as "published", which is x. With no truth this
is a read, not a measurement. bunny.net has now been run through the
classifier, so it is out for exam #6.
