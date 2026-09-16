# M1-C5 arbiter — threshold sweep, both corpus-w-lean switch states

Fix 3 (method-word lead-token stripping) touched: camara 0 of 292, holdout1 0 of 207, holdout2 127 of 220.

```
corpus w-lean ON
T     set       n    assigned  review  leaks  over_tight  exact  review+overtight
----  --------  ---  --------  ------  -----  ----------  -----  ----------------
0.5   camara    292  200       92      4      1           195    93              
0.5   holdout1  207  62        145     9      1           52     146             
0.5   holdout2  220  110       110     0      1           109    111             
0.75  camara    292  192       100     2      1           189    101             
0.75  holdout1  207  35        172     0      1           34     173             
0.75  holdout2  220  110       110     0      1           109    111             
1     camara    292  187       105     1      1           185    106             
1     holdout1  207  35        172     0      1           34     173             
1     holdout2  220  110       110     0      1           109    111             
1.25  camara    292  179       113     0      1           178    114             
1.25  holdout1  207  35        172     0      1           34     173             
1.25  holdout2  220  110       110     0      1           109    111             
1.5   camara    292  179       113     0      1           178    114             
1.5   holdout1  207  35        172     0      1           34     173             
1.5   holdout2  220  110       110     0      1           109    111             
2     camara    292  155       137     0      1           154    138             
2     holdout1  207  35        172     0      1           34     173             
2     holdout2  220  108       112     0      1           107    113             
```

```
corpus w-lean OFF
T     set       n    assigned  review  leaks  over_tight  exact  review+overtight
----  --------  ---  --------  ------  -----  ----------  -----  ----------------
0.5   camara    292  191       101     1      1           189    102             
0.5   holdout1  207  35        172     0      1           34     173             
0.5   holdout2  220  110       110     0      1           109    111             
0.75  camara    292  191       101     1      1           189    102             
0.75  holdout1  207  35        172     0      1           34     173             
0.75  holdout2  220  110       110     0      1           109    111             
1     camara    292  187       105     1      1           185    106             
1     holdout1  207  35        172     0      1           34     173             
1     holdout2  220  110       110     0      1           109    111             
1.25  camara    292  179       113     0      1           178    114             
1.25  holdout1  207  35        172     0      1           34     173             
1.25  holdout2  220  110       110     0      1           109    111             
1.5   camara    292  179       113     0      1           178    114             
1.5   holdout1  207  35        172     0      1           34     173             
1.5   holdout2  220  110       110     0      1           109    111             
2     camara    292  155       137     0      1           154    138             
2     holdout1  207  35        172     0      1           34     173             
2     holdout2  220  108       112     0      1           107    113             
```

**Chosen corpusWLean = true, T = 1.25 — minimizes (review + over-tight) = 287 on camara+holdout1 combined, subject to zero leaks on both sets (ties broken by corpusWLean=ON first, then smallest T). holdout2 was NOT used for selection; it is reported at every (switch, T) for transparency only.**

## Negative controls and queryAssistant — actual computed outcomes, at the chosen setting

- ClickToDial terminateCall (DELETE, gt=x, negative control): method=DELETE gt=x prior=w pred=w confidence=0 status=review evidence=[scope:delete-agrees]
- WebRTC updateSessionStatus (PUT, gt=x, negative control): method=PUT gt=x prior=w pred=w confidence=0 status=review evidence=[scope:write-agrees]
- ModelAsAService queryAssistant (POST, gt=r as of the 2026-09-07 truth fix): method=POST gt=r prior=x pred=x confidence=1 status=review evidence=[scope:read->lower:r]

