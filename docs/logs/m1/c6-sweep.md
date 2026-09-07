# M1-C6 arbiter — threshold sweep, both corpus-w-lean switch states

Fix 3 (method-word lead-token stripping) touched: camara 0 of 292, holdout1 0 of 207, holdout2 127 of 220.

```
corpus w-lean ON
T     set       n    assigned  review  leaks  over_tight  exact  review+overtight
----  --------  ---  --------  ------  -----  ----------  -----  ----------------
0.5   camara    292  229       63      2      6           221    69              
0.5   holdout1  207  62        145     9      1           52     146             
0.5   holdout2  220  110       110     0      1           109    111             
0.75  camara    292  221       71      0      6           215    77              
0.75  holdout1  207  35        172     0      1           34     173             
0.75  holdout2  220  110       110     0      1           109    111             
1     camara    292  217       75      0      6           211    81              
1     holdout1  207  35        172     0      1           34     173             
1     holdout2  220  110       110     0      1           109    111             
1.25  camara    292  211       81      0      6           205    87              
1.25  holdout1  207  35        172     0      1           34     173             
1.25  holdout2  220  110       110     0      1           109    111             
1.5   camara    292  211       81      0      6           205    87              
1.5   holdout1  207  35        172     0      1           34     173             
1.5   holdout2  220  110       110     0      1           109    111             
2     camara    292  187       105     0      6           181    111             
2     holdout1  207  35        172     0      1           34     173             
2     holdout2  220  108       112     0      1           107    113             
```

```
corpus w-lean OFF
T     set       n    assigned  review  leaks  over_tight  exact  review+overtight
----  --------  ---  --------  ------  -----  ----------  -----  ----------------
0.5   camara    292  221       71      0      6           215    77              
0.5   holdout1  207  35        172     0      1           34     173             
0.5   holdout2  220  110       110     0      1           109    111             
0.75  camara    292  221       71      0      6           215    77              
0.75  holdout1  207  35        172     0      1           34     173             
0.75  holdout2  220  110       110     0      1           109    111             
1     camara    292  217       75      0      6           211    81              
1     holdout1  207  35        172     0      1           34     173             
1     holdout2  220  110       110     0      1           109    111             
1.25  camara    292  211       81      0      6           205    87              
1.25  holdout1  207  35        172     0      1           34     173             
1.25  holdout2  220  110       110     0      1           109    111             
1.5   camara    292  211       81      0      6           205    87              
1.5   holdout1  207  35        172     0      1           34     173             
1.5   holdout2  220  110       110     0      1           109    111             
2     camara    292  187       105     0      6           181    111             
2     holdout1  207  35        172     0      1           34     173             
2     holdout2  220  108       112     0      1           107    113             
```

**Chosen corpusWLean = true, T = 0.75 — minimizes (review + over-tight) = 250 on camara+holdout1 combined, subject to zero leaks on both sets (ties broken by corpusWLean=ON first, then smallest T). holdout2 was NOT used for selection; it is reported at every (switch, T) for transparency only.**

## Negative controls and queryAssistant — actual computed outcomes, at the chosen setting

- ClickToDial terminateCall (DELETE, gt=x, negative control): method=DELETE gt=x prior=w pred=w confidence=0 status=review evidence=[scope:delete-agrees]
- WebRTC updateSessionStatus (PUT, gt=x, negative control): method=PUT gt=x prior=w pred=w confidence=0 status=review evidence=[scope:write-agrees]
- ModelAsAService queryAssistant (POST, gt=r as of the 2026-09-07 truth fix): method=POST gt=r prior=x pred=r confidence=1 status=assigned evidence=[scope:read->lower:r]

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
holdout2  DELETE  w      no-evidence   18   
holdout2  DELETE  x      no-evidence   4    
holdout2  PATCH   w      has-evidence  2    
holdout2  PATCH   w      no-evidence   1    
holdout2  POST    r      no-evidence   8    
holdout2  POST    w      no-evidence   5    
holdout2  POST    w      has-evidence  2    
holdout2  POST    x      no-evidence   33   
holdout2  POST    x      has-evidence  3    
holdout2  PUT     w      no-evidence   34   
```

