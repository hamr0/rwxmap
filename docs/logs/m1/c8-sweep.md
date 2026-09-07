# M1-C8 arbiter — threshold sweep, words ON/OFF (corpusWLean fixed ON)

Layer 7 (prose words, D30 "prose last") added on top of the unchanged C6/C7 pipeline (layers 1-6, corpusWLean fixed ON — see c6-admitted.md and c7-sweep.md for those). Layer 7's own admitted list is in c8-admitted.md.

```
words ON
T     set       n    assigned  review  leaks  over_tight  exact  review+overtight
----  --------  ---  --------  ------  -----  ----------  -----  ----------------
0.5   camara    292  229       63      2      3           224    66              
0.5   holdout1  207  62        145     9      1           52     146             
0.5   holdout2  220  114       106     0      2           112    108             
0.75  camara    292  221       71      0      3           218    74              
0.75  holdout1  207  35        172     0      1           34     173             
0.75  holdout2  220  114       106     0      2           112    108             
1     camara    292  217       75      0      3           214    78              
1     holdout1  207  35        172     0      1           34     173             
1     holdout2  220  114       106     0      2           112    108             
1.25  camara    292  210       82      0      3           207    85              
1.25  holdout1  207  35        172     0      1           34     173             
1.25  holdout2  220  114       106     0      2           112    108             
1.5   camara    292  210       82      0      3           207    85              
1.5   holdout1  207  35        172     0      1           34     173             
1.5   holdout2  220  114       106     0      2           112    108             
2     camara    292  186       106     0      3           183    109             
2     holdout1  207  35        172     0      1           34     173             
2     holdout2  220  112       108     0      2           110    110             
```

```
words OFF
T     set       n    assigned  review  leaks  over_tight  exact  review+overtight
----  --------  ---  --------  ------  -----  ----------  -----  ----------------
0.5   camara    292  229       63      2      3           224    66              
0.5   holdout1  207  62        145     9      1           52     146             
0.5   holdout2  220  110       110     0      1           109    111             
0.75  camara    292  221       71      0      3           218    74              
0.75  holdout1  207  35        172     0      1           34     173             
0.75  holdout2  220  110       110     0      1           109    111             
1     camara    292  217       75      0      3           214    78              
1     holdout1  207  35        172     0      1           34     173             
1     holdout2  220  110       110     0      1           109    111             
1.25  camara    292  210       82      0      3           207    85              
1.25  holdout1  207  35        172     0      1           34     173             
1.25  holdout2  220  110       110     0      1           109    111             
1.5   camara    292  210       82      0      3           207    85              
1.5   holdout1  207  35        172     0      1           34     173             
1.5   holdout2  220  110       110     0      1           109    111             
2     camara    292  186       106     0      3           183    109             
2     holdout1  207  35        172     0      1           34     173             
2     holdout2  220  108       112     0      1           107    113             
```

**Chosen wordsOn = true, T = 0.75 (corpusWLean fixed ON, the C6/C7 setting) — minimizes (review + over-tight) = 247 on camara+holdout1 combined, subject to zero leaks on both sets (ties broken by wordsOn=true first, then smallest T). holdout2 was NOT used for selection; it is reported at every (switch, T) for transparency only.**

## Negative controls and queryAssistant — actual computed outcomes, at the chosen setting

- ClickToDial terminateCall (DELETE, gt=x, negative control): method=DELETE gt=x prior=w pred=w confidence=0 status=review evidence=[scope:delete-agrees]
- WebRTC updateSessionStatus (PUT, gt=x, negative control): method=PUT gt=x prior=w pred=w confidence=0 status=review evidence=[scope:write-agrees]
- ModelAsAService queryAssistant (POST, gt=r): method=POST gt=r prior=x pred=r confidence=1 status=assigned evidence=[scope:read->lower:r]

## Review breakdown by set x method x truth x has-evidence, at the chosen setting

```
set       method  truth  evidence      count
--------  ------  -----  ------------  -----
camara    DELETE  w      no-evidence   34   
camara    DELETE  x      no-evidence   6    
camara    PATCH   w      has-evidence  6    
camara    PATCH   x      has-evidence  2    
camara    POST    r      no-evidence   4    
camara    POST    w      no-evidence   2    
camara    POST    x      no-evidence   10   
camara    PUT     w      no-evidence   6    
camara    PUT     x      no-evidence   1    
holdout1  DELETE  w      no-evidence   95   
holdout1  DELETE  x      no-evidence   18   
holdout1  POST    w      has-evidence  18   
holdout1  POST    x      has-evidence  9    
holdout1  PUT     w      no-evidence   26   
holdout1  PUT     x      no-evidence   6    
holdout2  DELETE  w      no-evidence   17   
holdout2  DELETE  x      no-evidence   4    
holdout2  PATCH   w      has-evidence  2    
holdout2  PATCH   w      no-evidence   1    
holdout2  POST    r      no-evidence   8    
holdout2  POST    w      no-evidence   5    
holdout2  POST    w      has-evidence  2    
holdout2  POST    x      no-evidence   30   
holdout2  POST    x      has-evidence  3    
holdout2  PUT     w      no-evidence   34   
```

## Rows changed vs c7-rows.csv: 4 (camara 0, holdout1 0, holdout2 4); new leaks introduced: 0

```
changed holdout2|box|/legal_hold_policy_assignments|POST|post_legal_hold_policy_assignments  gt=x  c7:x/review -> c8:x/assigned
changed holdout2|box|/retention_policy_assignments|POST|post_retention_policy_assignments  gt=x  c7:x/review -> c8:x/assigned
changed holdout2|box|/task_assignments|POST|post_task_assignments  gt=x  c7:x/review -> c8:x/assigned
changed holdout2|pagerduty|/enrichment/integrations/servicenow/{integration_id}/tables/{table_id}|DELETE|deleteServiceNowTable  gt=w  c7:w/review -> c8:x/assigned
```

