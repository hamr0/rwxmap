# M1-C8 — layer 7 word admission (prose last, D30)

Everything through layer 6 is unchanged from C6/C7 (corpusWLean fixed ON — see c6-admitted.md for those admitted lists). This file covers layer 7 only.

## Layer 7 — high-frequency drop (replaces a stopword list)

Tokens present in more than 40% of the 499 CAMARA + hold-out-1 rows (row presence, not raw occurrence count) are dropped from every row's vocabulary, all three sets alike:

```
token  rows  row_fraction
-----  ----  ------------
the    331   0.663       
for    216   0.433       
```

## Layer 7 — x-share admission table (n >= 5, over CAMARA + hold-out 1)

Admitted (share >= 0.9): assign (n=5, share=1.000), intents (n=5, share=1.000), removed (n=5, share=1.000).

Top 30 rejected candidates by n (n >= 5, share < 0.9):

```
word          n    x_share
------------  ---  -------
and           175  0.309  
this          131  0.275  
with          121  0.380  
delete        119  0.118  
access        106  0.245  
device        97   0.299  
information   90   0.167  
given         89   0.135  
api           82   0.280  
from          81   0.296  
endpoint      79   0.177  
user          72   0.278  
must          72   0.236  
network       70   0.314  
that          70   0.300  
not           70   0.271  
will          69   0.464  
create        68   0.750  
status        68   0.294  
get           66   0.030  
retrieve      64   0.016  
subscription  63   0.254  
use           60   0.250  
scope         60   0.117  
list          56   0.107  
request       52   0.308  
response      51   0.353  
can           51   0.275  
new           47   0.809  
are           46   0.283  
```

## Layer 7 — w-share table (own-vs-other visibility only, NEVER wired into scoring; n >= 5)

Tokens that would say "own" at the same 0.9 bar: secret (n=11, share=1.000), secrets (n=10, share=1.000), adds (n=6, share=1.000), applied (n=6, share=1.000), environment (n=6, share=1.000), replaces (n=5, share=1.000), updated (n=5, share=1.000), deletes (n=37, share=0.946), personal (n=42, share=0.905), tokens (n=42, share=0.905).

