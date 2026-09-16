# M1-C4 arbiter — threshold sweep

```
T     set       n    assigned  review  leaks  over_tight  exact  review+overtight
----  --------  ---  --------  ------  -----  ----------  -----  ----------------
0.5   camara    292  218       74      18     4           196    78              
0.5   holdout1  207  62        145     9      1           52     146             
0.5   holdout2  220  160       60      0      12          148    72              
0.75  camara    292  201       91      4      4           193    95              
0.75  holdout1  207  35        172     0      1           34     173             
0.75  holdout2  220  160       60      0      12          148    72              
1     camara    292  197       95      4      4           189    99              
1     holdout1  207  35        172     0      1           34     173             
1     holdout2  220  157       63      0      12          145    75              
1.25  camara    292  189       103     2      4           183    107             
1.25  holdout1  207  35        172     0      1           34     173             
1.25  holdout2  220  157       63      0      12          145    75              
1.5   camara    292  185       107     2      4           179    111             
1.5   holdout1  207  35        172     0      1           34     173             
1.5   holdout2  220  157       63      0      12          145    75              
2     camara    292  159       133     0      4           155    137             
2     holdout1  207  35        172     0      1           34     173             
2     holdout2  220  155       65      0      12          143    77              
```

**Chosen T = 2 — minimizes (review + over-tight) = 310 on camara+holdout1 combined, subject to zero leaks on both sets (smallest T on ties). holdout2 was NOT used for selection; it is reported at every T for transparency only.**

## Negative controls and queryAssistant — actual computed outcomes

- ClickToDial terminateCall (DELETE, gt=x): method=DELETE gt=x prior=w pred=w confidence=0 status=review evidence=[scope:delete-agrees]
- WebRTC updateSessionStatus (PUT, gt=x): method=PUT gt=x prior=w pred=w confidence=0 status=review evidence=[scope:write-agrees]
- ModelAsAService queryAssistant (POST, gt=x): method=POST gt=x prior=x pred=x confidence=1 status=review evidence=[scope:read->lower:r]

Under the corrected rules (raise always targets x, on any method; layer 2 is a class-hint compared against the row's prior, not a method-conditioned split), a PUT/DELETE row CAN reach x via a raise — this fixes the earlier arbiter's structural inability to ever assign x to PUT/DELETE. Neither negative control actually reaches x, however: both scope tokens ("delete", "write") land in the write-hint family, which equals the PUT/DELETE prior (w), so layer 2 only records agreement, not a raise or a lower. Layer 4 (the CAMARA verb table, leave-one-repo-out) also contributes no evidence for either: "terminate" has no other CAMARA rows sharing that lead verb (n=0), and "update" has n=13 with shareX ≈ 0.154 and shareW ≈ 0.846, neither meeting the 0.9 threshold. With zero evidence from any layer, both rows fall through to status=review at the prior (w) — NOT an assigned leak (a review-status row is not scored as a leak or an exact match), but also not a correct x. queryAssistant (POST, gt=x): its "read" scope lowers toward r with weight 1.0; at the chosen T that lowering is below threshold, so it also falls to review at the prior (x) rather than being wrongly lowered to r.
