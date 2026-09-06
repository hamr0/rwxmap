# actionClass disagreement table

Spike date: 2026-09-01. Source: CAMARA API catalogue, `camaraproject` GitHub org,
default branch, commit SHAs recorded per-repo in `operations.csv` / `specs/<repo>/.sha`.

Judgement (`judged_class`) is a JUDGEMENT CALL made by reading each operation's
`summary`/`description`/request-response shape, not a spec fact. Method default
(`default_class`) is mechanical, per RFC 9110: GET/HEAD/OPTIONS -> r,
PUT/DELETE -> w, POST/PATCH -> x.

## 1. R3 table — judged `x` behind a SAFE method (GET/HEAD/OPTIONS)

**NONE FOUND.** Zero operations across 96 GET/HEAD/OPTIONS operations in 60 API
repos were judged to have a consequential, hard-to-reverse, or externally
notifying effect. Every CAMARA API that performs a consequential read
(location retrieve/verify, reachability check, roaming check, consent
retrieve, KYC verify/match/fill-in, scoring retrieve, IMEI/device-authenticity
check) is deliberately modelled as `POST`, not `GET` — see the full list of
POST-modelled "read-shaped" operations below. This is the R3 readout: **empty**.

### For reference: consequential reads already modelled as POST (not GET)

These are NOT disagreements (default already `x`, judged `x` — no tightening
needed) but are the direct evidence for why R3 is empty: the CAMARA WG already
routes every "read that matters" through POST.

| repo | path | operationId |
|---|---|---|
| DeviceLocation | POST /retrieve | retrieveLocation |
| DeviceLocation | POST /verify | verifyLocation |
| DeviceReachabilityStatus | POST /retrieve | getReachabilityStatus |
| DeviceRoamingStatus | POST /retrieve | getRoamingStatus |
| DeviceVisitLocation | POST /retrieve | retrieveDeviceVisitLocation |
| MostFrequentLocation | POST /verify | verifyFrequentLocation |
| ConsentInfo | POST /retrieve | retrieveStatus |
| ConsentManagement | POST /consents/retrieve-info | retrieveConsentInfo |
| CustomerInsights | POST /scoring/retrieve | retrieveScoring |
| DeviceAuthenticity | POST /check-status | checkImeiStatus |
| KnowYourCustomer(+3 split repos) | POST /verify, /fill-in, /match | verifyAge, KYC_Fill-in, KYC_Match |
| OTPValidation | POST /send-code | sendCode |

## 2. Judged `x` behind PUT/DELETE (idempotent, designed path — R2)

Two findings. Both are DELETE/PUT operations on live, real-time telephony
sessions where the method's idempotent-write default undersells the true
consequence (ending or steering an active call for another party, in real
time, in a hard-to-reverse way). Under the proposed rule these are exactly
the case the "declare to tighten" mechanism exists for: the resource owner
declares `x` explicitly rather than relying on the PUT/DELETE default of `w`.

| repo | file | path | method | operationId | default | judged | reason |
|---|---|---|---|---|---|---|---|
| ClickToDial | click-to-dial.yaml | /calls/{callId} | DELETE | terminateCall | w | x | Terminates an ACTIVE call session for another party in real time; consequential and hard-to-reverse (cannot un-hang-up a call). |
| WebRTC | webrtc-call-handling.yaml | /sessions/{mediaSessionId}/status | PUT | updateSessionStatus | w | x | Accepts a `MediaSessionStatusChange` with statuses Connected/Ringing/Hold/Resume — live call control (answer/hold/resume) on an active session, touching another party in real time. |

No other PUT/DELETE operation (47 remaining) was judged to exceed its method
default. The rest are ordinary idempotent resource lifecycle operations
(delete a subscription the caller itself created, cancel a booking/slice the
caller itself created, update/delete an application profile or registration)
— ending an effect the caller itself is the owner of, not creating a new
external effect on a third party.

## 3. Judged `w` behind GET (safe method judged non-pure-read)

**NONE FOUND.** All 96 GET/HEAD/OPTIONS operations were judged pure reads (`r`).

## 4. Looser-than-default (judged class WEAKER than method default)

**NONE FOUND.** No operation was judged `r` where the method default was `w`
or `x`, and none was judged `w` where the method default was `x`. This means
the method-default `x` assignment for all 138 POST + 9 PATCH operations was
never judged as an over-classification in this spike — i.e., the "cost of the
default" (over-declaring `x` for what is actually a harmless read/write) was
measured at **zero** operations in this catalogue. This is a small dataset for
that specific question (POST/PATCH ops were not individually second-guessed
downward — the judgement pass in this spike concentrated on GET/PUT/DELETE,
where a stricter-than-default finding threatens the `actionClass` axiom; a
POST/PATCH found to be looser-than-default would only ever be a cost/UX
finding, never a safety finding, so was not separately audited operation-by-
operation for downgrade candidates. See "What this spike does NOT prove" in
README.md.)

## Totals

- Total operations parsed: 292 (96 GET, 8 PUT, 41 DELETE, 138 POST, 9 PATCH)
- Stricter-than-default (any tightening): 2 (both PUT/DELETE -> x, R2 territory)
- x behind a safe method (R3): 0
- w behind a safe method: 0
- Looser-than-default: 0
