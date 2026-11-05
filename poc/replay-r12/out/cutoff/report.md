# cut-off what-if: LOWER_MIN_P, mode a, rwxlite 0.2.0 fp32

## parity / inclusion
- exam-2026-11-03-fresh [in rwxlite training]: parity ok (at 0.97: 827/6/116 of 949)
- gate-2026-11-03: parity ok (at 0.97: 511/8/81 of 600)
- gate-2026-11-04: parity ok (at 0.97: 523/7/70 of 600)
- gate-2026-11-06 [in rwxlite training]: parity ok (at 0.97: 648/20/132 of 800)
- gate-2026-11-07 [in rwxlite training]: parity ok (at 0.97: 690/8/102 of 800)
- r9-hand: parity ok (at 0.97: 796/13/391 of 1200)
- exam4: parity ok (at 0.97: 1391/16/98 of 1505 vs committed 1391/16/98 MATCH; rows vs rows-a-fp32-base.csv: 0 differ of 1505)
- exam3: parity ok (at 0.97: 1192/15/170 of 1377 vs committed 1192/15/170 MATCH)

## exam-2026-11-03-fresh [in training]

| cut-off | N | exact | too loose | too tight | lowered | leaks added vs 0.97 | leaks closed vs 0.97 |
|---|---|---|---|---|---|---|---|
| 0.99 | 949 | 735 (77.4%) | 6 (0.6%) | 208 (21.9%) | 0 | 0 | 0 |
| 0.97 | 949 | 827 (87.1%) | 6 (0.6%) | 116 (12.2%) | 92 | 0 | 0 |
| 0.95 | 949 | 845 (89.0%) | 8 (0.8%) | 96 (10.1%) | 114 | 2 | 0 |
| 0.93 | 949 | 855 (90.1%) | 8 (0.8%) | 86 (9.1%) | 124 | 2 | 0 |
| 0.90 | 949 | 856 (90.2%) | 15 (1.6%) | 78 (8.2%) | 139 | 9 | 0 |

## gate-2026-11-03

| cut-off | N | exact | too loose | too tight | lowered | leaks added vs 0.97 | leaks closed vs 0.97 |
|---|---|---|---|---|---|---|---|
| 0.99 | 600 | 464 (77.3%) | 8 (1.3%) | 128 (21.3%) | 0 | 0 | 0 |
| 0.97 | 600 | 511 (85.2%) | 8 (1.3%) | 81 (13.5%) | 47 | 0 | 0 |
| 0.95 | 600 | 538 (89.7%) | 8 (1.3%) | 54 (9.0%) | 74 | 0 | 0 |
| 0.93 | 600 | 547 (91.2%) | 10 (1.7%) | 43 (7.2%) | 87 | 2 | 0 |
| 0.90 | 600 | 553 (92.2%) | 10 (1.7%) | 37 (6.2%) | 93 | 2 | 0 |

## gate-2026-11-04

| cut-off | N | exact | too loose | too tight | lowered | leaks added vs 0.97 | leaks closed vs 0.97 |
|---|---|---|---|---|---|---|---|
| 0.99 | 600 | 477 (79.5%) | 7 (1.2%) | 116 (19.3%) | 1 | 0 | 0 |
| 0.97 | 600 | 523 (87.2%) | 7 (1.2%) | 70 (11.7%) | 47 | 0 | 0 |
| 0.95 | 600 | 536 (89.3%) | 8 (1.3%) | 56 (9.3%) | 62 | 1 | 0 |
| 0.93 | 600 | 549 (91.5%) | 8 (1.3%) | 43 (7.2%) | 75 | 1 | 0 |
| 0.90 | 600 | 557 (92.8%) | 8 (1.3%) | 35 (5.8%) | 83 | 1 | 0 |

## gate-2026-11-06 [in training]

| cut-off | N | exact | too loose | too tight | lowered | leaks added vs 0.97 | leaks closed vs 0.97 |
|---|---|---|---|---|---|---|---|
| 0.99 | 800 | 584 (73.0%) | 19 (2.4%) | 197 (24.6%) | 0 | 0 | 1 |
| 0.97 | 800 | 648 (81.0%) | 20 (2.5%) | 132 (16.5%) | 66 | 0 | 0 |
| 0.95 | 800 | 678 (84.8%) | 20 (2.5%) | 102 (12.8%) | 96 | 0 | 0 |
| 0.93 | 800 | 694 (86.8%) | 21 (2.6%) | 85 (10.6%) | 114 | 1 | 0 |
| 0.90 | 800 | 712 (89.0%) | 21 (2.6%) | 67 (8.4%) | 133 | 1 | 0 |

## gate-2026-11-07 [in training]

| cut-off | N | exact | too loose | too tight | lowered | leaks added vs 0.97 | leaks closed vs 0.97 |
|---|---|---|---|---|---|---|---|
| 0.99 | 800 | 599 (74.9%) | 8 (1.0%) | 193 (24.1%) | 0 | 0 | 0 |
| 0.97 | 800 | 690 (86.3%) | 8 (1.0%) | 102 (12.8%) | 91 | 0 | 0 |
| 0.95 | 800 | 717 (89.6%) | 10 (1.3%) | 73 (9.1%) | 122 | 2 | 0 |
| 0.93 | 800 | 731 (91.4%) | 12 (1.5%) | 57 (7.1%) | 140 | 4 | 0 |
| 0.90 | 800 | 741 (92.6%) | 12 (1.5%) | 47 (5.9%) | 150 | 4 | 0 |

## r9-hand

| cut-off | N | exact | too loose | too tight | lowered | leaks added vs 0.97 | leaks closed vs 0.97 |
|---|---|---|---|---|---|---|---|
| 0.99 | 1200 | 413 (34.4%) | 8 (0.7%) | 779 (64.9%) | 0 | 0 | 5 |
| 0.97 | 1200 | 796 (66.3%) | 13 (1.1%) | 391 (32.6%) | 393 | 0 | 0 |
| 0.95 | 1200 | 959 (79.9%) | 15 (1.3%) | 226 (18.8%) | 560 | 2 | 0 |
| 0.93 | 1200 | 1014 (84.5%) | 20 (1.7%) | 166 (13.8%) | 624 | 7 | 0 |
| 0.90 | 1200 | 1066 (88.8%) | 23 (1.9%) | 111 (9.3%) | 683 | 10 | 0 |

## exam4

| cut-off | N | exact | too loose | too tight | lowered | leaks added vs 0.97 | leaks closed vs 0.97 |
|---|---|---|---|---|---|---|---|
| 0.99 | 1505 | 1268 (84.3%) | 15 (1.0%) | 222 (14.8%) | 0 | 0 | 1 |
| 0.97 | 1505 | 1391 (92.4%) | 16 (1.1%) | 98 (6.5%) | 125 | 0 | 0 |
| 0.95 | 1505 | 1407 (93.5%) | 18 (1.2%) | 80 (5.3%) | 145 | 2 | 0 |
| 0.93 | 1505 | 1411 (93.8%) | 21 (1.4%) | 73 (4.9%) | 155 | 5 | 0 |
| 0.90 | 1505 | 1419 (94.3%) | 22 (1.5%) | 64 (4.3%) | 165 | 6 | 0 |

## exam3

| cut-off | N | exact | too loose | too tight | lowered | leaks added vs 0.97 | leaks closed vs 0.97 |
|---|---|---|---|---|---|---|---|
| 0.99 | 1377 | 1095 (79.5%) | 15 (1.1%) | 267 (19.4%) | 0 | 0 | 0 |
| 0.97 | 1377 | 1192 (86.6%) | 15 (1.1%) | 170 (12.3%) | 97 | 0 | 0 |
| 0.95 | 1377 | 1223 (88.8%) | 18 (1.3%) | 136 (9.9%) | 134 | 3 | 0 |
| 0.93 | 1377 | 1243 (90.3%) | 18 (1.3%) | 116 (8.4%) | 154 | 3 | 0 |
| 0.90 | 1377 | 1259 (91.4%) | 19 (1.4%) | 99 (7.2%) | 172 | 4 | 0 |

## POOLED, all included sets (exam-2026-11-03-fresh, gate-2026-11-03, gate-2026-11-04, gate-2026-11-06, gate-2026-11-07, r9-hand, exam4, exam3)

| cut-off | N | exact | too loose | too tight | lowered | leaks added vs 0.97 | leaks closed vs 0.97 |
|---|---|---|---|---|---|---|---|
| 0.99 | 7831 | 5635 (72.0%) | 86 (1.1%) | 2110 (26.9%) | 1 | 0 | 7 |
| 0.97 | 7831 | 6578 (84.0%) | 93 (1.2%) | 1160 (14.8%) | 958 | 0 | 0 |
| 0.95 | 7831 | 6903 (88.1%) | 105 (1.3%) | 823 (10.5%) | 1307 | 12 | 0 |
| 0.93 | 7831 | 7044 (90.0%) | 118 (1.5%) | 669 (8.5%) | 1473 | 25 | 0 |
| 0.90 | 7831 | 7163 (91.5%) | 130 (1.7%) | 538 (6.9%) | 1618 | 37 | 0 |

## POOLED WITHOUT training sets (gate-2026-11-03, gate-2026-11-04, r9-hand, exam4, exam3)

| cut-off | N | exact | too loose | too tight | lowered | leaks added vs 0.97 | leaks closed vs 0.97 |
|---|---|---|---|---|---|---|---|
| 0.99 | 5282 | 3717 (70.4%) | 53 (1.0%) | 1512 (28.6%) | 1 | 0 | 6 |
| 0.97 | 5282 | 4413 (83.5%) | 59 (1.1%) | 810 (15.3%) | 709 | 0 | 0 |
| 0.95 | 5282 | 4663 (88.3%) | 67 (1.3%) | 552 (10.5%) | 975 | 8 | 0 |
| 0.93 | 5282 | 4764 (90.2%) | 77 (1.5%) | 441 (8.3%) | 1095 | 18 | 0 |
| 0.90 | 5282 | 4854 (91.9%) | 82 (1.6%) | 346 (6.6%) | 1196 | 23 | 0 |

## leaks added at 0.99 vs 0.97 (truth->letter), all rows

total 0; by kind: none; of which in training sets: 0


closed at 0.99 (leaks at 0.97 that are not leaks now): 7
- gate-2026-11-06/gate3-0482 amazonaws.com POST /#X-Amz-Target=Route53Domains_v20140515.RegisterDomain truth x: w -> x
- r9-hand/r9-0543 watchful.li POST /sites/{id}/audits truth x: w -> x
- r9-hand/r9-0814 twilio.com POST /v2/Services/{ServiceSid}/Entities/{Identity}/Challenges truth x: w -> x
- r9-hand/r9-0897 azure.com POST /subscriptions/{subscriptionId}/resourceGroups/{resourceGroupName}/providers/Microsoft.MachineLearningCompute/operationalizationClusters/{clusterName}/updateSystemServices truth x: w -> x
- r9-hand/r9-1109 shipengine.com POST /v1/manifests truth x: w -> x
- r9-hand/r9-1164 googleapis.com POST /v1beta1/projects/{projectId}/zones/{zone}/clusters/{clusterId}/master truth x: w -> x
- exam4/ex4-0573 immich.app POST /shared-links truth x: w -> x

## leaks added at 0.95 vs 0.97 (truth->letter), all rows

total 12; by kind: x->w 12; of which in training sets: 4

| set | id | provider | method | path | truth | letter | kind | p(accepted letter) | at 0.97 was |
|---|---|---|---|---|---|---|---|---|---|
| exam-2026-11-03-fresh* | fx-0718 | getlago.com | POST | /credit_notes | x | w | x->w | 0.9578 | x (exact) |
| exam-2026-11-03-fresh* | fx-0936 | workos.com | POST | /user_management/waitlists/{id}/entries | x | w | x->w | 0.9637 | x (exact) |
| gate-2026-11-04 | gate2-0219 | linode.com | POST | /linode/instances | x | w | x->w | 0.9516 | x (exact) |
| gate-2026-11-07* | gate4-0667 | googleapis.com | POST | /v1/{parent}/messages | x | w | x->w | 0.9655 | x (exact) |
| gate-2026-11-07* | gate4-0672 | windows.net | POST | /jobs/{jobId}/addtaskcollection | x | w | x->w | 0.9683 | x (exact) |
| r9-hand | r9-0713 | microsoft.com | POST | /me/events/{event-id}/exceptionOccurrences/{event-id1}/microsoft.graph.tentativelyAccept | x | w | x->w | 0.9516 | x (exact) |
| r9-hand | r9-1129 | elmah.io | POST | /v3/messages/{logId} | x | w | x->w | 0.9670 | x (exact) |
| exam4 | ex4-0152 | chatwoot.com | POST | /public/api/v1/inboxes/{inbox_identifier}/contacts/{contact_identifier}/conversations/{conversation_id}/messages | x | w | x->w | 0.9692 | x (exact) |
| exam4 | ex4-0813 | permit.io | POST | /v2/projects/{proj_id}/envs/{env_id}/copy | x | w | x->w | 0.9638 | x (exact) |
| exam3 | ex3-0031 | clerk.com | POST | /billing/subscription_items/{subscription_item_id}/price_transition | x | w | x->w | 0.9643 | x (exact) |
| exam3 | ex3-0257 | clerk.com | POST | /waitlist_entries/bulk | x | w | x->w | 0.9526 | x (exact) |
| exam3 | ex3-0774 | netbird.io | POST | /api/integrations/msp/tenants/{id}/subscription | x | w | x->w | 0.9541 | x (exact) |

closed at 0.95 (leaks at 0.97 that are not leaks now): 0

## leaks added at 0.93 vs 0.97 (truth->letter), all rows

total 25; by kind: x->w 24, w->r 1; of which in training sets: 7

| set | id | provider | method | path | truth | letter | kind | p(accepted letter) | at 0.97 was |
|---|---|---|---|---|---|---|---|---|---|
| exam-2026-11-03-fresh* | fx-0718 | getlago.com | POST | /credit_notes | x | w | x->w | 0.9578 | x (exact) |
| exam-2026-11-03-fresh* | fx-0936 | workos.com | POST | /user_management/waitlists/{id}/entries | x | w | x->w | 0.9637 | x (exact) |
| gate-2026-11-03 | gate-0029 | walletobjects.googleapis.com | POST | /walletobjects/v1/eventTicketClass/{resourceId}/addMessage | x | w | x->w | 0.9478 | x (exact) |
| gate-2026-11-03 | gate-0422 | mist.com | POST | /api/v1/sites/{site_id}/mxedges/{mxedge_id}/support | x | w | x->w | 0.9421 | x (exact) |
| gate-2026-11-04 | gate2-0219 | linode.com | POST | /linode/instances | x | w | x->w | 0.9516 | x (exact) |
| gate-2026-11-06* | gate3-0626 | azure.com | POST | /subscriptions/{subscriptionId}/resourceGroups/{resourceGroupName}/providers/Microsoft.Compute/virtualMachines/{vmName}/generalize | x | w | x->w | 0.9359 | x (exact) |
| gate-2026-11-07* | gate4-0086 | windows.net | POST | /jobs/{jobId}/tasks | x | w | x->w | 0.9495 | x (exact) |
| gate-2026-11-07* | gate4-0394 | twilio.com | POST | /v1/Sinks/{Sid}/Test | x | w | x->w | 0.9337 | x (exact) |
| gate-2026-11-07* | gate4-0667 | googleapis.com | POST | /v1/{parent}/messages | x | w | x->w | 0.9655 | x (exact) |
| gate-2026-11-07* | gate4-0672 | windows.net | POST | /jobs/{jobId}/addtaskcollection | x | w | x->w | 0.9683 | x (exact) |
| r9-hand | r9-0435 | billbee.io | POST | /api/v1/shipment/shipment | x | w | x->w | 0.9410 | x (exact) |
| r9-hand | r9-0577 | microsoft.com | POST | /me/calendars/{calendar-id}/events/{event-id}/exceptionOccurrences/{event-id1}/instances/{event-id2}/microsoft.graph.tentativelyAccept | x | w | x->w | 0.9488 | x (exact) |
| r9-hand | r9-0689 | trakt.tv | POST | /users/{id}/lists/{list_id}/like | w | r | w->r | 0.9386 | x (tight) |
| r9-hand | r9-0713 | microsoft.com | POST | /me/events/{event-id}/exceptionOccurrences/{event-id1}/microsoft.graph.tentativelyAccept | x | w | x->w | 0.9516 | x (exact) |
| r9-hand | r9-0739 | microsoft.com | POST | /me/calendar/calendarView/{event-id}/microsoft.graph.accept | x | w | x->w | 0.9336 | x (exact) |
| r9-hand | r9-0989 | microsoft.com | POST | /users/{user-id}/pendingAccessReviewInstances/{accessReviewInstance-id}/stages/{accessReviewStage-id}/decisions/{accessReviewInstanceDecisionItem-id}/instance/contactedReviewers | x | w | x->w | 0.9449 | x (exact) |
| r9-hand | r9-1129 | elmah.io | POST | /v3/messages/{logId} | x | w | x->w | 0.9670 | x (exact) |
| exam4 | ex4-0023 | chatwoot.com | POST | /api/v1/accounts/{account_id}/campaigns | x | w | x->w | 0.9402 | x (exact) |
| exam4 | ex4-0055 | chatwoot.com | POST | /api/v1/accounts/{account_id}/conversations/{conversation_id}/messages | x | w | x->w | 0.9367 | x (exact) |
| exam4 | ex4-0152 | chatwoot.com | POST | /public/api/v1/inboxes/{inbox_identifier}/contacts/{contact_identifier}/conversations/{conversation_id}/messages | x | w | x->w | 0.9692 | x (exact) |
| exam4 | ex4-0813 | permit.io | POST | /v2/projects/{proj_id}/envs/{env_id}/copy | x | w | x->w | 0.9638 | x (exact) |
| exam4 | ex4-0814 | permit.io | POST | /v2/projects/{proj_id}/envs/{env_id}/copy/async | x | w | x->w | 0.9302 | x (exact) |
| exam3 | ex3-0031 | clerk.com | POST | /billing/subscription_items/{subscription_item_id}/price_transition | x | w | x->w | 0.9643 | x (exact) |
| exam3 | ex3-0257 | clerk.com | POST | /waitlist_entries/bulk | x | w | x->w | 0.9526 | x (exact) |
| exam3 | ex3-0774 | netbird.io | POST | /api/integrations/msp/tenants/{id}/subscription | x | w | x->w | 0.9541 | x (exact) |

closed at 0.93 (leaks at 0.97 that are not leaks now): 0

## leaks added at 0.90 vs 0.97 (truth->letter), all rows

total 37; by kind: x->w 36, w->r 1; of which in training sets: 14

| set | id | provider | method | path | truth | letter | kind | p(accepted letter) | at 0.97 was |
|---|---|---|---|---|---|---|---|---|---|
| exam-2026-11-03-fresh* | fx-0090 | getlago.com | POST | /quote_versions/{lago_id}/clone | x | w | x->w | 0.9004 | x (exact) |
| exam-2026-11-03-fresh* | fx-0113 | getlago.com | POST | /wallet_transactions | x | w | x->w | 0.9173 | x (exact) |
| exam-2026-11-03-fresh* | fx-0120 | coolify.io | POST | /servers/digitalocean | x | w | x->w | 0.9279 | x (exact) |
| exam-2026-11-03-fresh* | fx-0260 | getlago.com | POST | /invoices | x | w | x->w | 0.9285 | x (exact) |
| exam-2026-11-03-fresh* | fx-0355 | coolify.io | POST | /servers/vultr | x | w | x->w | 0.9202 | x (exact) |
| exam-2026-11-03-fresh* | fx-0568 | coolify.io | POST | /servers/hetzner | x | w | x->w | 0.9199 | x (exact) |
| exam-2026-11-03-fresh* | fx-0695 | coolify.io | POST | /{resource_type}/{uuid}/secret-manager/import | x | w | x->w | 0.9258 | x (exact) |
| exam-2026-11-03-fresh* | fx-0718 | getlago.com | POST | /credit_notes | x | w | x->w | 0.9578 | x (exact) |
| exam-2026-11-03-fresh* | fx-0936 | workos.com | POST | /user_management/waitlists/{id}/entries | x | w | x->w | 0.9637 | x (exact) |
| gate-2026-11-03 | gate-0029 | walletobjects.googleapis.com | POST | /walletobjects/v1/eventTicketClass/{resourceId}/addMessage | x | w | x->w | 0.9478 | x (exact) |
| gate-2026-11-03 | gate-0422 | mist.com | POST | /api/v1/sites/{site_id}/mxedges/{mxedge_id}/support | x | w | x->w | 0.9421 | x (exact) |
| gate-2026-11-04 | gate2-0219 | linode.com | POST | /linode/instances | x | w | x->w | 0.9516 | x (exact) |
| gate-2026-11-06* | gate3-0626 | azure.com | POST | /subscriptions/{subscriptionId}/resourceGroups/{resourceGroupName}/providers/Microsoft.Compute/virtualMachines/{vmName}/generalize | x | w | x->w | 0.9359 | x (exact) |
| gate-2026-11-07* | gate4-0086 | windows.net | POST | /jobs/{jobId}/tasks | x | w | x->w | 0.9495 | x (exact) |
| gate-2026-11-07* | gate4-0394 | twilio.com | POST | /v1/Sinks/{Sid}/Test | x | w | x->w | 0.9337 | x (exact) |
| gate-2026-11-07* | gate4-0667 | googleapis.com | POST | /v1/{parent}/messages | x | w | x->w | 0.9655 | x (exact) |
| gate-2026-11-07* | gate4-0672 | windows.net | POST | /jobs/{jobId}/addtaskcollection | x | w | x->w | 0.9683 | x (exact) |
| r9-hand | r9-0435 | billbee.io | POST | /api/v1/shipment/shipment | x | w | x->w | 0.9410 | x (exact) |
| r9-hand | r9-0577 | microsoft.com | POST | /me/calendars/{calendar-id}/events/{event-id}/exceptionOccurrences/{event-id1}/instances/{event-id2}/microsoft.graph.tentativelyAccept | x | w | x->w | 0.9488 | x (exact) |
| r9-hand | r9-0685 | twilio.com | POST | /v1/Services/PreregisteredUsa2p | x | w | x->w | 0.9069 | x (exact) |
| r9-hand | r9-0689 | trakt.tv | POST | /users/{id}/lists/{list_id}/like | w | r | w->r | 0.9386 | x (tight) |
| r9-hand | r9-0713 | microsoft.com | POST | /me/events/{event-id}/exceptionOccurrences/{event-id1}/microsoft.graph.tentativelyAccept | x | w | x->w | 0.9516 | x (exact) |
| r9-hand | r9-0739 | microsoft.com | POST | /me/calendar/calendarView/{event-id}/microsoft.graph.accept | x | w | x->w | 0.9336 | x (exact) |
| r9-hand | r9-0989 | microsoft.com | POST | /users/{user-id}/pendingAccessReviewInstances/{accessReviewInstance-id}/stages/{accessReviewStage-id}/decisions/{accessReviewInstanceDecisionItem-id}/instance/contactedReviewers | x | w | x->w | 0.9449 | x (exact) |
| r9-hand | r9-0999 | drchrono.com | POST | /api/patient_messages | x | w | x->w | 0.9194 | x (exact) |
| r9-hand | r9-1078 | microsoft.com | POST | /me/pendingAccessReviewInstances/{accessReviewInstance-id}/stages/{accessReviewStage-id}/decisions/{accessReviewInstanceDecisionItem-id}/instance/contactedReviewers | x | w | x->w | 0.9218 | x (exact) |
| r9-hand | r9-1129 | elmah.io | POST | /v3/messages/{logId} | x | w | x->w | 0.9670 | x (exact) |
| exam4 | ex4-0023 | chatwoot.com | POST | /api/v1/accounts/{account_id}/campaigns | x | w | x->w | 0.9402 | x (exact) |
| exam4 | ex4-0055 | chatwoot.com | POST | /api/v1/accounts/{account_id}/conversations/{conversation_id}/messages | x | w | x->w | 0.9367 | x (exact) |
| exam4 | ex4-0152 | chatwoot.com | POST | /public/api/v1/inboxes/{inbox_identifier}/contacts/{contact_identifier}/conversations/{conversation_id}/messages | x | w | x->w | 0.9692 | x (exact) |
| exam4 | ex4-0813 | permit.io | POST | /v2/projects/{proj_id}/envs/{env_id}/copy | x | w | x->w | 0.9638 | x (exact) |
| exam4 | ex4-0814 | permit.io | POST | /v2/projects/{proj_id}/envs/{env_id}/copy/async | x | w | x->w | 0.9302 | x (exact) |
| exam4 | ex4-1372 | zulip.com | POST | /export/realm | x | w | x->w | 0.9268 | x (exact) |
| exam3 | ex3-0031 | clerk.com | POST | /billing/subscription_items/{subscription_item_id}/price_transition | x | w | x->w | 0.9643 | x (exact) |
| exam3 | ex3-0069 | clerk.com | POST | /instance/change_domain | x | w | x->w | 0.9043 | x (exact) |
| exam3 | ex3-0257 | clerk.com | POST | /waitlist_entries/bulk | x | w | x->w | 0.9526 | x (exact) |
| exam3 | ex3-0774 | netbird.io | POST | /api/integrations/msp/tenants/{id}/subscription | x | w | x->w | 0.9541 | x (exact) |

closed at 0.90 (leaks at 0.97 that are not leaks now): 0
