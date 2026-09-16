# M1-C9 — the two-pass shape: pass 1 (byte-for-byte C7, layer3On/layer4On both true) + pass 2 judge

Pass 1: T = 0.75, byte-for-byte C7 (layer3On/layer4On both true — round-2 coordinator correction 1). Assigned 366/719, handed 353 to pass 2.

- camara: 221/292 assigned in pass 1, 71 handed to pass 2.
- holdout1: 35/207 assigned in pass 1, 172 handed to pass 2.
- holdout2: 110/220 assigned in pass 1, 110 handed to pass 2.

## Per-rule table, RAW (all rules on, judgePostOwn=true, pathPartyOn=false, liveTokenOn=false, floorOn=false)

```
rule  set       hit  exact  leaks  over_tight
----  --------  ---  -----  -----  ----------
R1    camara    7    4      0      3         
R1    holdout1  6    6      0      0         
R1    holdout2  9    9      0      0         
R2    camara    14   7      0      7         
R2    holdout1  13   5      0      8         
R2    holdout2  1    0      0      1         
R3    camara    37   36     1      0         
R3    holdout1  52   52     0      0         
R3    holdout2  28   28     0      0         
R4    camara    3    0      3      0         
R4    holdout1  23   17     6      0         
R4    holdout2  2    2      0      0         
```

## Per-rule table, RAW (all rules on, judgePostOwn=false, floorOn=false) — R4 rows fall to R5 instead

```
rule  set       hit  exact  leaks  over_tight
----  --------  ---  -----  -----  ----------
R1    camara    7    4      0      3         
R1    holdout1  6    6      0      0         
R1    holdout2  9    9      0      0         
R2    camara    14   7      0      7         
R2    holdout1  13   5      0      8         
R2    holdout2  1    0      0      1         
R3    camara    37   36     1      0         
R3    holdout1  52   52     0      0         
R3    holdout2  28   28     0      0         
R4    camara    0    0      0      0         
R4    holdout1  0    0      0      0         
R4    holdout2  0    0      0      0         
```

## Round 3 fix (coordinator, 2026-09-08): switch decision is zero-leaks-first, THEN lower review+over-tight cost (admitted rules, floorOn=false, camara+holdout1) — ties go to OFF

### Correction 3: R1 any-operationId-token live-verb source, liveTokenOn OFF vs ON (decided first — it gates R3 admission)

```
liveTokenOn  review  over_tight  cost  rejected
-----------  ------  ----------  ----  --------
off          203     22          225   R3,R4   
on           113     26          139   R4      
```

Chosen: liveTokenOn=true (off cost 225 vs on cost 139). With liveTokenOn on, R1 catches updateRebootRequest via the "reboot" token before R3 ever sees it, clearing R3's only camara/holdout1 leak — that is reflected above as R3 no longer appearing in the "on" row's rejected list.

Full per-rule tables, liveTokenOn off vs on (pathPartyOn held off):
```
-- liveTokenOn=false --
rule  set       hit  exact  leaks  over_tight
----  --------  ---  -----  -----  ----------
R1    camara    7    4      0      3         
R1    holdout1  6    6      0      0         
R1    holdout2  9    9      0      0         
R2    camara    14   7      0      7         
R2    holdout1  13   5      0      8         
R2    holdout2  1    0      0      1         
R3    camara    37   36     1      0         
R3    holdout1  52   52     0      0         
R3    holdout2  28   28     0      0         
R4    camara    3    0      3      0         
R4    holdout1  23   17     6      0         
R4    holdout2  2    2      0      0         
-- liveTokenOn=true --
rule  set       hit  exact  leaks  over_tight
----  --------  ---  -----  -----  ----------
R1    camara    9    5      0      4         
R1    holdout1  9    6      0      3         
R1    holdout2  11   10     0      1         
R2    camara    14   7      0      7         
R2    holdout1  13   5      0      8         
R2    holdout2  1    0      0      1         
R3    camara    35   35     0      0         
R3    holdout1  50   50     0      0         
R3    holdout2  28   28     0      0         
R4    camara    3    0      3      0         
R4    holdout1  22   16     6      0         
R4    holdout2  2    2      0      0         
```

### Correction 2: R2 path-party-id source, pathPartyOn OFF vs ON (decided second, liveTokenOn held at the chosen value = true)

```
pathPartyOn  review  over_tight  cost  rejected
-----------  ------  ----------  ----  --------
off          113     26          139   R4      
on           108     34          142   R4      
```

Chosen: pathPartyOn=false (off cost 139 vs on cost 142). With R3 admitted, path-party-id rows that pathPartyOn would flag x (e.g. Stripe {customer} paths) mostly land correctly at w via R3 instead when pathPartyOn is off — turning it on trades that correct R3 resolution for an over-tight R2 hit, raising cost. This corrects the earlier (wrong) rule that chose "on" purely because raw leaks were zero, ignoring that cost.

Full per-rule tables, pathPartyOn off vs on (liveTokenOn held at the chosen value):
```
-- pathPartyOn=false --
rule  set       hit  exact  leaks  over_tight
----  --------  ---  -----  -----  ----------
R1    camara    9    5      0      4         
R1    holdout1  9    6      0      3         
R1    holdout2  11   10     0      1         
R2    camara    14   7      0      7         
R2    holdout1  13   5      0      8         
R2    holdout2  1    0      0      1         
R3    camara    35   35     0      0         
R3    holdout1  50   50     0      0         
R3    holdout2  28   28     0      0         
R4    camara    3    0      3      0         
R4    holdout1  22   16     6      0         
R4    holdout2  2    2      0      0         
-- pathPartyOn=true --
rule  set       hit  exact  leaks  over_tight
----  --------  ---  -----  -----  ----------
R1    camara    9    5      0      4         
R1    holdout1  9    6      0      3         
R1    holdout2  11   10     0      1         
R2    camara    14   7      0      7         
R2    holdout1  25   9      0      16        
R2    holdout2  1    0      0      1         
R3    camara    35   35     0      0         
R3    holdout1  43   43     0      0         
R3    holdout2  28   28     0      0         
R4    camara    3    0      3      0         
R4    holdout1  17   15     2      0         
R4    holdout2  2    2      0      0         
```

## Rule admission decisions (>=1 leak on camara or holdout1 rejects a rule, at the chosen source switches: pathPartyOn=false, liveTokenOn=true)

```
R4 REJECTED: operationId=enableEsimProfile method=POST verb=enable noun=profile gt=x pred=w set=camara repo=IoTDeviceManagement
R4 REJECTED: operationId=disableEsimProfile method=POST verb=disable noun=profile gt=x pred=w set=camara repo=IoTDeviceManagement
R4 REJECTED: operationId=setFallbackEsimProfile method=POST verb=set noun=profile gt=x pred=w set=camara repo=IoTDeviceManagement
R4 REJECTED: operationId=UpdateCallRecording method=POST verb=update noun=the gt=x pred=w set=holdout1 repo=twilio
R4 REJECTED: operationId=UpdateConference method=POST verb=update noun= gt=x pred=w set=holdout1 repo=twilio
R4 REJECTED: operationId=UpdateConferenceRecording method=POST verb=update noun=the gt=x pred=w set=holdout1 repo=twilio
R4 REJECTED: operationId=UpdatePayments method=POST verb=update noun=instance gt=x pred=w set=holdout1 repo=twilio
R4 REJECTED: operationId=UpdateRealtimeTranscription method=POST verb=update noun=sid gt=x pred=w set=holdout1 repo=twilio
R4 REJECTED: operationId=UpdateStream method=POST verb=update noun=sid gt=x pred=w set=holdout1 repo=twilio
```

## Per-rule table, ADMITTED-ONLY (rejected rules disabled, floorOn=false)

```
rule  set       hit  exact  leaks  over_tight
----  --------  ---  -----  -----  ----------
R1    camara    9    5      0      4         
R1    holdout1  9    6      0      3         
R1    holdout2  11   10     0      1         
R2    camara    14   7      0      7         
R2    holdout1  13   5      0      8         
R2    holdout2  1    0      0      1         
R3    camara    35   35     0      0         
R3    holdout1  50   50     0      0         
R3    holdout2  28   28     0      0         
R4    camara    0    0      0      0         
R4    holdout1  0    0      0      0         
R4    holdout2  0    0      0      0         
```

## Final numbers, admitted rules only, floorOn = FALSE

```
set       n    assigned  review  leaks  over_tight  exact
--------  ---  --------  ------  -----  ----------  -----
camara    292  279       13      0      14          265  
holdout1  207  107       100     0      12          95   
holdout2  220  150       70      0      3           147  
```

## Final numbers, admitted rules only, floorOn = TRUE (chosen configuration)

```
set       n    assigned  review  leaks  over_tight  exact
--------  ---  --------  ------  -----  ----------  -----
camara    292  292       0       0      20          272  
holdout1  207  129       78      0      28          101  
holdout2  220  193       27      0      20          173  
```

## Negative controls and queryAssistant — at the chosen (admitted+floorOn) configuration

- ClickToDial terminateCall (DELETE, gt=x, negative control): method=DELETE gt=x pred=x confidence=1 status=assigned pass=2 rule=R1 evidence=[judge:live-verb:opid:terminate]
- WebRTC updateSessionStatus (PUT, gt=x, negative control): method=PUT gt=x pred=x confidence=1 status=assigned pass=2 rule=R2 evidence=[judge:party:opidhead:session]
- ModelAsAService queryAssistant (POST, gt=r): method=POST gt=r pred=r confidence=1 status=assigned pass=1 rule=(pass1) evidence=[scope:read->lower:r]

## Review breakdown at the chosen configuration (set x method x truth)

```
set       method  truth  count
--------  ------  -----  -----
holdout1  DELETE  w      36   
holdout1  DELETE  x      13   
holdout1  PUT     w      26   
holdout1  PUT     x      3    
holdout2  DELETE  w      8    
holdout2  DELETE  x      4    
holdout2  PUT     w      15   
```

## Rows changed vs c8-rows.csv: 245 (camara 71, holdout1 94, holdout2 80)

```
changed camara|ApplicationEndpointRegistration|/application-endpoint-lists/{applicationEndpointListId}|PUT|updateApplicationEndpoint  gt=w  c8:w/review -> c9:w/assigned (pass=2 rule=R3)
changed camara|ApplicationEndpointRegistration|/application-endpoint-lists/{applicationEndpointListId}|DELETE|deregisterApplicationEndpoint  gt=w  c8:w/review -> c9:w/assigned (pass=2 rule=R3)
changed camara|ApplicationProfiles|/application-profiles/{applicationProfileId}|PATCH|updateApplicationProfile  gt=w  c8:x/review -> c9:w/assigned (pass=2 rule=R3)
changed camara|ApplicationProfiles|/application-profiles/{applicationProfileId}|DELETE|deleteApplicationProfile  gt=w  c8:w/review -> c9:w/assigned (pass=2 rule=R3)
changed camara|BlockchainPublicAddress|/blockchain-public-addresses/{id}|DELETE|deleteBlockchainPublicAddress  gt=w  c8:w/review -> c9:w/assigned (pass=2 rule=R3)
changed camara|ClickToDial|/calls/{callId}|DELETE|terminateCall  gt=x  c8:w/review -> c9:x/assigned (pass=2 rule=R1)
changed camara|ConnectedNetworkType|/subscriptions/{subscriptionId}|DELETE|deleteConnectedNetworkTypeSubscription  gt=w  c8:w/review -> c9:w/assigned (pass=2 rule=R3)
changed camara|ConnectivityInsights|/subscriptions/{subscriptionId}|DELETE|deleteSubscription  gt=w  c8:w/review -> c9:w/assigned (pass=2 rule=R3)
changed camara|ConsentManagement|/consents/{consentId}|PATCH|updateConsent  gt=w  c8:x/review -> c9:w/assigned (pass=2 rule=R3)
changed camara|DedicatedNetworks|/accesses/{accessId}|DELETE|deleteAccess  gt=x  c8:w/review -> c9:x/assigned (pass=2 rule=R2)
changed camara|DedicatedNetworks|/accesses/{accessId}/devices/add|POST|addDevicesToAccess  gt=x  c8:x/review -> c9:x/assigned (pass=2 rule=R2)
changed camara|DedicatedNetworks|/accesses/{accessId}/devices/remove|POST|removeDevicesFromAccess  gt=x  c8:x/review -> c9:x/assigned (pass=2 rule=R2)
changed camara|DedicatedNetworks|/networks/{networkId}|DELETE|deleteNetwork  gt=x  c8:w/review -> c9:x/assigned (pass=2 rule=R2)
changed camara|DeviceDataVolume|/subscriptions/{subscriptionId}|DELETE|deleteDeviceDataVolumeSubscription  gt=w  c8:w/review -> c9:w/assigned (pass=2 rule=R3)
changed camara|DeviceIdentifier|/match-identifier|POST|matchIdentifier  gt=r  c8:x/review -> c9:x/assigned (pass=floor rule=floor)
changed camara|DeviceLocation|/subscriptions/{subscriptionId}|DELETE|deleteGeofencingSubscription  gt=w  c8:w/review -> c9:w/assigned (pass=2 rule=R3)
changed camara|DeviceReachabilityStatus|/subscriptions/{subscriptionId}|DELETE|deleteDeviceReachabilityStatusSubscription  gt=w  c8:w/review -> c9:w/assigned (pass=2 rule=R3)
changed camara|DeviceRoamingStatus|/subscriptions/{subscriptionId}|DELETE|deleteDeviceRoamingStatusSubscription  gt=w  c8:w/review -> c9:w/assigned (pass=2 rule=R3)
changed camara|DeviceStatus|/subscriptions/{subscriptionId}|DELETE|deleteConnectedNetworkTypeSubscription  gt=w  c8:w/review -> c9:w/assigned (pass=2 rule=R3)
changed camara|DeviceStatus|/subscriptions/{subscriptionId}|DELETE|deleteDeviceReachabilityStatusSubscription  gt=w  c8:w/review -> c9:w/assigned (pass=2 rule=R3)
changed camara|DeviceStatus|/subscriptions/{subscriptionId}|DELETE|deleteDeviceRoamingStatusSubscription  gt=w  c8:w/review -> c9:w/assigned (pass=2 rule=R3)
changed camara|EdgeApplicationManagement|/apps/{appId}|DELETE|deleteApp  gt=w  c8:w/review -> c9:w/assigned (pass=2 rule=R3)
changed camara|EdgeApplicationManagement|/app-instances/{appInstanceId}|DELETE|deleteAppInstance  gt=w  c8:w/review -> c9:x/assigned (pass=2 rule=R1)
changed camara|EdgeApplicationManagement|/deployments/{appDeploymentId}|DELETE|deleteAppDeployment  gt=w  c8:w/review -> c9:x/assigned (pass=2 rule=R1)
changed camara|EdgeApplicationManagement|/deployments/{appDeploymentId}|PATCH|updateAppDeployment  gt=w  c8:x/review -> c9:w/assigned (pass=2 rule=R3)
changed camara|InHomeDeviceManagement|/v1/devices/{deviceId}|PATCH|updateDevice  gt=x  c8:x/review -> c9:x/assigned (pass=2 rule=R2)
changed camara|InHomeDeviceManagement|/v1/devices/{deviceId}|DELETE|deleteDevice  gt=x  c8:w/review -> c9:x/assigned (pass=2 rule=R2)
changed camara|InHomeDeviceManagement|/v1/devices/{deviceId}/actions/{actionId}|POST|performDeviceAction  gt=x  c8:x/review -> c9:x/assigned (pass=floor rule=floor)
changed camara|IoTDeviceManagement|/download|POST|downloadEsimProfile  gt=x  c8:x/review -> c9:x/assigned (pass=floor rule=floor)
changed camara|IoTDeviceManagement|/enable|POST|enableEsimProfile  gt=x  c8:x/review -> c9:x/assigned (pass=floor rule=floor)
changed camara|IoTDeviceManagement|/disable|POST|disableEsimProfile  gt=x  c8:x/review -> c9:x/assigned (pass=floor rule=floor)
changed camara|IoTDeviceManagement|/set-fallback|POST|setFallbackEsimProfile  gt=x  c8:x/review -> c9:x/assigned (pass=floor rule=floor)
changed camara|IoTSIMFraudPrevention|/subscriptions/{subscriptionId}|DELETE|deleteSubscription  gt=w  c8:w/review -> c9:w/assigned (pass=2 rule=R3)
changed camara|IoTSIMFraudPrevention|/bind|POST|bindDeviceImei  gt=x  c8:x/review -> c9:x/assigned (pass=floor rule=floor)
changed camara|IoTSIMFraudPrevention|/unbind|POST|unBindDeviceImei  gt=x  c8:x/review -> c9:x/assigned (pass=floor rule=floor)
changed camara|KnowYourCustomer|/fill-in|POST|KYC_Fill-in  gt=r  c8:x/review -> c9:x/assigned (pass=floor rule=floor)
changed camara|KnowYourCustomer|/match|POST|KYC_Match  gt=r  c8:x/review -> c9:x/assigned (pass=floor rule=floor)
changed camara|ModelAsAService|/knowledge-bases/{knowledgeBaseId}|PUT|updateKnowledgeBase  gt=w  c8:w/review -> c9:w/assigned (pass=2 rule=R3)
changed camara|ModelAsAService|/knowledge-bases/{knowledgeBaseId}|DELETE|deleteKnowledgeBase  gt=w  c8:w/review -> c9:w/assigned (pass=2 rule=R3)
changed camara|ModelAsAService|/knowledge-bases/{knowledgeBaseId}/documents/{documentId}|DELETE|deleteDocument  gt=w  c8:w/review -> c9:w/assigned (pass=2 rule=R3)
changed camara|ModelAsAService|/knowledge-bases/{knowledgeBaseId}/tools/{toolId}|PUT|updateTool  gt=w  c8:w/review -> c9:w/assigned (pass=2 rule=R3)
changed camara|ModelAsAService|/knowledge-bases/{knowledgeBaseId}/tools/{toolId}|DELETE|deleteTool  gt=w  c8:w/review -> c9:w/assigned (pass=2 rule=R3)
changed camara|ModelAsAService|/assistants/{assistantId}|PUT|updateAssistant  gt=w  c8:w/review -> c9:w/assigned (pass=2 rule=R3)
changed camara|ModelAsAService|/assistants/{assistantId}|DELETE|deleteAssistant  gt=w  c8:w/review -> c9:w/assigned (pass=2 rule=R3)
changed camara|MultiPointVPN|/networks/{serviceId}|PATCH|updateNetwork  gt=w  c8:x/review -> c9:x/assigned (pass=2 rule=R2)
changed camara|MultiPointVPN|/networks/{serviceId}|DELETE|deleteNetwork  gt=w  c8:w/review -> c9:x/assigned (pass=2 rule=R2)
changed camara|NetworkAccessManagement|/reboot-requests/{rebootRequestId}|PATCH|updateRebootRequest  gt=x  c8:x/review -> c9:x/assigned (pass=2 rule=R1)
changed camara|NetworkAccessManagement|/reboot-requests/{rebootRequestId}|DELETE|deleteRebootRequest  gt=w  c8:w/review -> c9:x/assigned (pass=2 rule=R1)
changed camara|NetworkAccessManagement|/trust-domains/{trustDomainId}|PATCH|updateTrustDomain  gt=w  c8:x/review -> c9:w/assigned (pass=2 rule=R3)
changed camara|NetworkAccessManagement|/trust-domains/{trustDomainId}|DELETE|deleteTrustDomain  gt=w  c8:w/review -> c9:w/assigned (pass=2 rule=R3)
changed camara|NetworkAccessManagement|/trust-domains/{trustDomainId}/devices/{deviceId}|PATCH|updateTrustDomainDevice  gt=w  c8:x/review -> c9:x/assigned (pass=2 rule=R2)
changed camara|NetworkAccessManagement|/trust-domains/{trustDomainId}/devices/{deviceId}|DELETE|deleteTrustDomainDevice  gt=w  c8:w/review -> c9:x/assigned (pass=2 rule=R2)
changed camara|NetworkSliceBooking|/slices/{sliceId}|DELETE|deleteSlice  gt=w  c8:w/review -> c9:w/assigned (pass=2 rule=R3)
changed camara|OTPValidation|/send-code|POST|sendCode  gt=x  c8:x/review -> c9:x/assigned (pass=2 rule=R1)
changed camara|OTPValidation|/validate-code|POST|validateCode  gt=w  c8:x/review -> c9:x/assigned (pass=floor rule=floor)
changed camara|QoSBooking|/qos-bookings/{bookingId}|DELETE|deleteBooking  gt=w  c8:w/review -> c9:w/assigned (pass=2 rule=R3)
changed camara|QoSBooking|/device-qos-bookings/{bookingId}|DELETE|deleteBooking  gt=w  c8:w/review -> c9:w/assigned (pass=2 rule=R3)
changed camara|QualityOnDemand|/qos-assignments/{assignmentId}|DELETE|revokeQosAssignment  gt=w  c8:w/review -> c9:x/assigned (pass=2 rule=R1)
changed camara|QualityOnDemand|/sessions/{sessionId}|DELETE|deleteSession  gt=w  c8:w/review -> c9:x/assigned (pass=2 rule=R2)
changed camara|SessionInsights|/sessions/{sessionId}|DELETE|deleteSession  gt=w  c8:w/review -> c9:x/assigned (pass=2 rule=R2)
changed camara|SimSwap|/subscriptions/{subscriptionId}|DELETE|deleteSubscription  gt=w  c8:w/review -> c9:w/assigned (pass=2 rule=R3)
changed camara|SponsoredData|/sponsorship/{sponsorId}/{campaignId}/{sessionId}/revoke|DELETE|revokeSponsorship  gt=x  c8:w/review -> c9:x/assigned (pass=2 rule=R1)
changed camara|SponsoredData|/campaign/management|POST|manageCampaign  gt=w  c8:x/review -> c9:x/assigned (pass=floor rule=floor)
changed camara|VerifiedCaller|/registrations/{registrationId}|DELETE|deleteRegistration  gt=w  c8:w/review -> c9:w/assigned (pass=2 rule=R3)
changed camara|VerifiedCaller|/registrations/{registrationId}|PUT|updateRegistration  gt=w  c8:w/review -> c9:w/assigned (pass=2 rule=R3)
changed camara|WebRTC|/sessions/{mediaSessionId}|DELETE|deleteSessionById  gt=x  c8:w/review -> c9:x/assigned (pass=2 rule=R1)
changed camara|WebRTC|/sessions/{mediaSessionId}/status|PUT|updateSessionStatus  gt=x  c8:w/review -> c9:x/assigned (pass=2 rule=R2)
changed camara|WebRTC|/subscriptions/{subscriptionId}|DELETE|deleteNotificationChannelSubscription  gt=w  c8:w/review -> c9:w/assigned (pass=2 rule=R3)
changed camara|WebRTC|/sessions/{registrationId}|PUT|updateRegistrationById  gt=w  c8:w/review -> c9:w/assigned (pass=2 rule=R3)
changed camara|WebRTC|/sessions/{registrationId}|DELETE|deleteRegistrationById  gt=w  c8:w/review -> c9:x/assigned (pass=2 rule=R2)
changed camara|eSimRemoteManagement|/profile/downloaded-list|POST|profileList  gt=r  c8:x/review -> c9:x/assigned (pass=floor rule=floor)
changed holdout1|twilio|/2010-04-01/Accounts/{Sid}.json|POST|UpdateAccount  gt=w  c8:x/review -> c9:x/assigned (pass=2 rule=R2)
changed holdout1|twilio|/2010-04-01/Accounts/{AccountSid}/Addresses/{Sid}.json|POST|UpdateAddress  gt=w  c8:x/review -> c9:x/assigned (pass=floor rule=floor)
changed holdout1|twilio|/2010-04-01/Accounts/{AccountSid}/Addresses/{Sid}.json|DELETE|DeleteAddress  gt=w  c8:w/review -> c9:w/assigned (pass=2 rule=R3)
changed holdout1|twilio|/2010-04-01/Accounts/{AccountSid}/Applications/{Sid}.json|POST|UpdateApplication  gt=w  c8:x/review -> c9:x/assigned (pass=floor rule=floor)
changed holdout1|twilio|/2010-04-01/Accounts/{AccountSid}/Applications/{Sid}.json|DELETE|DeleteApplication  gt=w  c8:w/review -> c9:w/assigned (pass=2 rule=R3)
changed holdout1|twilio|/2010-04-01/Accounts/{AccountSid}/Calls/{Sid}.json|POST|UpdateCall  gt=x  c8:x/review -> c9:x/assigned (pass=2 rule=R2)
changed holdout1|twilio|/2010-04-01/Accounts/{AccountSid}/Calls/{Sid}.json|DELETE|DeleteCall  gt=w  c8:w/review -> c9:x/assigned (pass=2 rule=R2)
changed holdout1|twilio|/2010-04-01/Accounts/{AccountSid}/Calls/{CallSid}/Recordings/{Sid}.json|POST|UpdateCallRecording  gt=x  c8:x/review -> c9:x/assigned (pass=floor rule=floor)
changed holdout1|twilio|/2010-04-01/Accounts/{AccountSid}/Calls/{CallSid}/Recordings/{Sid}.json|DELETE|DeleteCallRecording  gt=w  c8:w/review -> c9:w/assigned (pass=2 rule=R3)
changed holdout1|twilio|/2010-04-01/Accounts/{AccountSid}/Conferences/{Sid}.json|POST|UpdateConference  gt=x  c8:x/review -> c9:x/assigned (pass=floor rule=floor)
changed holdout1|twilio|/2010-04-01/Accounts/{AccountSid}/Conferences/{ConferenceSid}/Recordings/{Sid}.json|POST|UpdateConferenceRecording  gt=x  c8:x/review -> c9:x/assigned (pass=floor rule=floor)
changed holdout1|twilio|/2010-04-01/Accounts/{AccountSid}/Conferences/{ConferenceSid}/Recordings/{Sid}.json|DELETE|DeleteConferenceRecording  gt=w  c8:w/review -> c9:w/assigned (pass=2 rule=R3)
changed holdout1|twilio|/2010-04-01/Accounts/{AccountSid}/ConnectApps/{Sid}.json|POST|UpdateConnectApp  gt=w  c8:x/review -> c9:x/assigned (pass=floor rule=floor)
changed holdout1|twilio|/2010-04-01/Accounts/{AccountSid}/ConnectApps/{Sid}.json|DELETE|DeleteConnectApp  gt=w  c8:w/review -> c9:w/assigned (pass=2 rule=R3)
changed holdout1|twilio|/2010-04-01/Accounts/{AccountSid}/IncomingPhoneNumbers/{Sid}.json|POST|UpdateIncomingPhoneNumber  gt=w  c8:x/review -> c9:x/assigned (pass=floor rule=floor)
changed holdout1|twilio|/2010-04-01/Accounts/{AccountSid}/IncomingPhoneNumbers/{Sid}.json|DELETE|DeleteIncomingPhoneNumber  gt=w  c8:w/review -> c9:w/assigned (pass=2 rule=R3)
changed holdout1|twilio|/2010-04-01/Accounts/{AccountSid}/IncomingPhoneNumbers/{ResourceSid}/AssignedAddOns/{Sid}.json|DELETE|DeleteIncomingPhoneNumberAssignedAddOn  gt=w  c8:w/review -> c9:x/assigned (pass=2 rule=R2)
changed holdout1|twilio|/2010-04-01/Accounts/{AccountSid}/Keys/{Sid}.json|POST|UpdateKey  gt=w  c8:x/review -> c9:x/assigned (pass=floor rule=floor)
changed holdout1|twilio|/2010-04-01/Accounts/{AccountSid}/Keys/{Sid}.json|DELETE|DeleteKey  gt=w  c8:w/review -> c9:w/assigned (pass=2 rule=R3)
changed holdout1|twilio|/2010-04-01/Accounts/{AccountSid}/Messages/{MessageSid}/Media/{Sid}.json|DELETE|DeleteMedia  gt=w  c8:w/review -> c9:w/assigned (pass=2 rule=R3)
changed holdout1|twilio|/2010-04-01/Accounts/{AccountSid}/Queues/{QueueSid}/Members/{CallSid}.json|POST|UpdateMember  gt=x  c8:x/review -> c9:x/assigned (pass=2 rule=R2)
changed holdout1|twilio|/2010-04-01/Accounts/{AccountSid}/Messages/{Sid}.json|POST|UpdateMessage  gt=w  c8:x/review -> c9:x/assigned (pass=floor rule=floor)
changed holdout1|twilio|/2010-04-01/Accounts/{AccountSid}/Messages/{Sid}.json|DELETE|DeleteMessage  gt=w  c8:w/review -> c9:w/assigned (pass=2 rule=R3)
changed holdout1|twilio|/2010-04-01/Accounts/{AccountSid}/OutgoingCallerIds/{Sid}.json|POST|UpdateOutgoingCallerId  gt=w  c8:x/review -> c9:x/assigned (pass=floor rule=floor)
changed holdout1|twilio|/2010-04-01/Accounts/{AccountSid}/OutgoingCallerIds/{Sid}.json|DELETE|DeleteOutgoingCallerId  gt=w  c8:w/review -> c9:w/assigned (pass=2 rule=R3)
changed holdout1|twilio|/2010-04-01/Accounts/{AccountSid}/Conferences/{ConferenceSid}/Participants/{CallSid}.json|POST|UpdateParticipant  gt=x  c8:x/review -> c9:x/assigned (pass=2 rule=R2)
changed holdout1|twilio|/2010-04-01/Accounts/{AccountSid}/Conferences/{ConferenceSid}/Participants/{CallSid}.json|DELETE|DeleteParticipant  gt=x  c8:w/review -> c9:x/assigned (pass=2 rule=R1)
changed holdout1|twilio|/2010-04-01/Accounts/{AccountSid}/Calls/{CallSid}/Payments/{Sid}.json|POST|UpdatePayments  gt=x  c8:x/review -> c9:x/assigned (pass=floor rule=floor)
changed holdout1|twilio|/2010-04-01/Accounts/{AccountSid}/Queues/{Sid}.json|POST|UpdateQueue  gt=w  c8:x/review -> c9:x/assigned (pass=floor rule=floor)
changed holdout1|twilio|/2010-04-01/Accounts/{AccountSid}/Queues/{Sid}.json|DELETE|DeleteQueue  gt=w  c8:w/review -> c9:w/assigned (pass=2 rule=R3)
changed holdout1|twilio|/2010-04-01/Accounts/{AccountSid}/Calls/{CallSid}/Transcriptions/{Sid}.json|POST|UpdateRealtimeTranscription  gt=x  c8:x/review -> c9:x/assigned (pass=floor rule=floor)
changed holdout1|twilio|/2010-04-01/Accounts/{AccountSid}/Recordings/{Sid}.json|DELETE|DeleteRecording  gt=w  c8:w/review -> c9:w/assigned (pass=2 rule=R3)
changed holdout1|twilio|/2010-04-01/Accounts/{AccountSid}/Recordings/{ReferenceSid}/AddOnResults/{Sid}.json|DELETE|DeleteRecordingAddOnResult  gt=w  c8:w/review -> c9:w/assigned (pass=2 rule=R3)
changed holdout1|twilio|/2010-04-01/Accounts/{AccountSid}/Recordings/{ReferenceSid}/AddOnResults/{AddOnResultSid}/Payloads/{Sid}.json|DELETE|DeleteRecordingAddOnResultPayload  gt=w  c8:w/review -> c9:w/assigned (pass=2 rule=R3)
changed holdout1|twilio|/2010-04-01/Accounts/{AccountSid}/Recordings/{RecordingSid}/Transcriptions/{Sid}.json|DELETE|DeleteRecordingTranscription  gt=w  c8:w/review -> c9:w/assigned (pass=2 rule=R3)
changed holdout1|twilio|/2010-04-01/Accounts/{AccountSid}/SMS/ShortCodes/{Sid}.json|POST|UpdateShortCode  gt=w  c8:x/review -> c9:x/assigned (pass=floor rule=floor)
changed holdout1|twilio|/2010-04-01/Accounts/{AccountSid}/SigningKeys/{Sid}.json|POST|UpdateSigningKey  gt=w  c8:x/review -> c9:x/assigned (pass=floor rule=floor)
changed holdout1|twilio|/2010-04-01/Accounts/{AccountSid}/SigningKeys/{Sid}.json|DELETE|DeleteSigningKey  gt=w  c8:w/review -> c9:w/assigned (pass=2 rule=R3)
changed holdout1|twilio|/2010-04-01/Accounts/{AccountSid}/SIP/Domains/{DomainSid}/Auth/Calls/CredentialListMappings/{Sid}.json|DELETE|DeleteSipAuthCallsCredentialListMapping  gt=w  c8:w/review -> c9:w/assigned (pass=2 rule=R3)
changed holdout1|twilio|/2010-04-01/Accounts/{AccountSid}/SIP/Domains/{DomainSid}/Auth/Calls/IpAccessControlListMappings/{Sid}.json|DELETE|DeleteSipAuthCallsIpAccessControlListMapping  gt=w  c8:w/review -> c9:w/assigned (pass=2 rule=R3)
changed holdout1|twilio|/2010-04-01/Accounts/{AccountSid}/SIP/Domains/{DomainSid}/Auth/Registrations/CredentialListMappings/{Sid}.json|DELETE|DeleteSipAuthRegistrationsCredentialListMapping  gt=w  c8:w/review -> c9:w/assigned (pass=2 rule=R3)
changed holdout1|twilio|/2010-04-01/Accounts/{AccountSid}/SIP/CredentialLists/{CredentialListSid}/Credentials/{Sid}.json|POST|UpdateSipCredential  gt=w  c8:x/review -> c9:x/assigned (pass=floor rule=floor)
changed holdout1|twilio|/2010-04-01/Accounts/{AccountSid}/SIP/CredentialLists/{CredentialListSid}/Credentials/{Sid}.json|DELETE|DeleteSipCredential  gt=w  c8:w/review -> c9:w/assigned (pass=2 rule=R3)
changed holdout1|twilio|/2010-04-01/Accounts/{AccountSid}/SIP/CredentialLists/{Sid}.json|POST|UpdateSipCredentialList  gt=w  c8:x/review -> c9:x/assigned (pass=floor rule=floor)
changed holdout1|twilio|/2010-04-01/Accounts/{AccountSid}/SIP/CredentialLists/{Sid}.json|DELETE|DeleteSipCredentialList  gt=w  c8:w/review -> c9:w/assigned (pass=2 rule=R3)
changed holdout1|twilio|/2010-04-01/Accounts/{AccountSid}/SIP/Domains/{DomainSid}/CredentialListMappings/{Sid}.json|DELETE|DeleteSipCredentialListMapping  gt=w  c8:w/review -> c9:w/assigned (pass=2 rule=R3)
changed holdout1|twilio|/2010-04-01/Accounts/{AccountSid}/SIP/Domains/{Sid}.json|POST|UpdateSipDomain  gt=w  c8:x/review -> c9:x/assigned (pass=floor rule=floor)
changed holdout1|twilio|/2010-04-01/Accounts/{AccountSid}/SIP/Domains/{Sid}.json|DELETE|DeleteSipDomain  gt=w  c8:w/review -> c9:w/assigned (pass=2 rule=R3)
changed holdout1|twilio|/2010-04-01/Accounts/{AccountSid}/SIP/IpAccessControlLists/{Sid}.json|POST|UpdateSipIpAccessControlList  gt=w  c8:x/review -> c9:x/assigned (pass=floor rule=floor)
changed holdout1|twilio|/2010-04-01/Accounts/{AccountSid}/SIP/IpAccessControlLists/{Sid}.json|DELETE|DeleteSipIpAccessControlList  gt=w  c8:w/review -> c9:w/assigned (pass=2 rule=R3)
changed holdout1|twilio|/2010-04-01/Accounts/{AccountSid}/SIP/Domains/{DomainSid}/IpAccessControlListMappings/{Sid}.json|DELETE|DeleteSipIpAccessControlListMapping  gt=w  c8:w/review -> c9:w/assigned (pass=2 rule=R3)
changed holdout1|twilio|/2010-04-01/Accounts/{AccountSid}/SIP/IpAccessControlLists/{IpAccessControlListSid}/IpAddresses/{Sid}.json|POST|UpdateSipIpAddress  gt=w  c8:x/review -> c9:x/assigned (pass=floor rule=floor)
changed holdout1|twilio|/2010-04-01/Accounts/{AccountSid}/SIP/IpAccessControlLists/{IpAccessControlListSid}/IpAddresses/{Sid}.json|DELETE|DeleteSipIpAddress  gt=w  c8:w/review -> c9:w/assigned (pass=2 rule=R3)
changed holdout1|twilio|/2010-04-01/Accounts/{AccountSid}/Calls/{CallSid}/Siprec/{Sid}.json|POST|UpdateSiprec  gt=w  c8:x/review -> c9:x/assigned (pass=floor rule=floor)
changed holdout1|twilio|/2010-04-01/Accounts/{AccountSid}/Calls/{CallSid}/Streams/{Sid}.json|POST|UpdateStream  gt=x  c8:x/review -> c9:x/assigned (pass=floor rule=floor)
changed holdout1|twilio|/2010-04-01/Accounts/{AccountSid}/Transcriptions/{Sid}.json|DELETE|DeleteTranscription  gt=w  c8:w/review -> c9:w/assigned (pass=2 rule=R3)
changed holdout1|twilio|/2010-04-01/Accounts/{AccountSid}/Usage/Triggers/{Sid}.json|POST|UpdateUsageTrigger  gt=w  c8:x/review -> c9:x/assigned (pass=2 rule=R1)
changed holdout1|twilio|/2010-04-01/Accounts/{AccountSid}/Usage/Triggers/{Sid}.json|DELETE|DeleteUsageTrigger  gt=w  c8:w/review -> c9:x/assigned (pass=2 rule=R1)
changed holdout1|twilio|/2010-04-01/Accounts/{AccountSid}/Calls/{CallSid}/UserDefinedMessageSubscriptions/{Sid}.json|DELETE|DeleteUserDefinedMessageSubscription  gt=w  c8:w/review -> c9:w/assigned (pass=2 rule=R3)
changed holdout1|stripe|/v1/accounts/{account}|DELETE|DeleteAccountsAccount  gt=x  c8:w/review -> c9:x/assigned (pass=2 rule=R2)
changed holdout1|stripe|/v1/accounts/{account}/bank_accounts/{id}|DELETE|DeleteAccountsAccountBankAccountsId  gt=w  c8:w/review -> c9:x/assigned (pass=2 rule=R2)
changed holdout1|stripe|/v1/accounts/{account}/external_accounts/{id}|DELETE|DeleteAccountsAccountExternalAccountsId  gt=w  c8:w/review -> c9:x/assigned (pass=2 rule=R2)
changed holdout1|stripe|/v1/accounts/{account}/people/{person}|DELETE|DeleteAccountsAccountPeoplePerson  gt=w  c8:w/review -> c9:x/assigned (pass=2 rule=R2)
changed holdout1|stripe|/v1/accounts/{account}/persons/{person}|DELETE|DeleteAccountsAccountPersonsPerson  gt=w  c8:w/review -> c9:x/assigned (pass=2 rule=R2)
changed holdout1|stripe|/v1/apple_pay/domains/{domain}|DELETE|DeleteApplePayDomainsDomain  gt=w  c8:w/review -> c9:x/assigned (pass=2 rule=R1)
changed holdout1|stripe|/v1/coupons/{coupon}|DELETE|DeleteCouponsCoupon  gt=w  c8:w/review -> c9:w/assigned (pass=2 rule=R3)
changed holdout1|stripe|/v1/customers/{customer}|DELETE|DeleteCustomersCustomer  gt=x  c8:w/review -> c9:x/assigned (pass=2 rule=R2)
changed holdout1|stripe|/v1/customers/{customer}/bank_accounts/{id}|DELETE|DeleteCustomersCustomerBankAccountsId  gt=w  c8:w/review -> c9:x/assigned (pass=2 rule=R2)
changed holdout1|stripe|/v1/customers/{customer}/cards/{id}|DELETE|DeleteCustomersCustomerCardsId  gt=w  c8:w/review -> c9:w/assigned (pass=2 rule=R3)
changed holdout1|stripe|/v1/customers/{customer}/discount|DELETE|DeleteCustomersCustomerDiscount  gt=w  c8:w/review -> c9:w/assigned (pass=2 rule=R3)
changed holdout1|stripe|/v1/customers/{customer}/sources/{id}|DELETE|DeleteCustomersCustomerSourcesId  gt=w  c8:w/review -> c9:w/assigned (pass=2 rule=R3)
changed holdout1|stripe|/v1/customers/{customer}/subscriptions/{subscription_exposed_id}|DELETE|DeleteCustomersCustomerSubscriptionsSubscriptionExposedId  gt=x  c8:w/review -> c9:x/assigned (pass=2 rule=R1)
changed holdout1|stripe|/v1/customers/{customer}/subscriptions/{subscription_exposed_id}/discount|DELETE|DeleteCustomersCustomerSubscriptionsSubscriptionExposedIdDiscount  gt=w  c8:w/review -> c9:w/assigned (pass=2 rule=R3)
changed holdout1|stripe|/v1/customers/{customer}/tax_ids/{id}|DELETE|DeleteCustomersCustomerTaxIdsId  gt=w  c8:w/review -> c9:w/assigned (pass=2 rule=R3)
changed holdout1|stripe|/v1/ephemeral_keys/{key}|DELETE|DeleteEphemeralKeysKey  gt=w  c8:w/review -> c9:w/assigned (pass=2 rule=R3)
changed holdout1|stripe|/v1/invoiceitems/{invoiceitem}|DELETE|DeleteInvoiceitemsInvoiceitem  gt=w  c8:w/review -> c9:w/assigned (pass=2 rule=R3)
changed holdout1|stripe|/v1/invoices/{invoice}|DELETE|DeleteInvoicesInvoice  gt=w  c8:w/review -> c9:w/assigned (pass=2 rule=R3)
changed holdout1|stripe|/v1/plans/{plan}|DELETE|DeletePlansPlan  gt=w  c8:w/review -> c9:w/assigned (pass=2 rule=R3)
changed holdout1|stripe|/v1/products/{id}|DELETE|DeleteProductsId  gt=w  c8:w/review -> c9:w/assigned (pass=2 rule=R3)
changed holdout1|stripe|/v1/products/{product}/features/{id}|DELETE|DeleteProductsProductFeaturesId  gt=w  c8:w/review -> c9:w/assigned (pass=2 rule=R3)
changed holdout1|stripe|/v1/radar/value_list_items/{item}|DELETE|DeleteRadarValueListItemsItem  gt=w  c8:w/review -> c9:w/assigned (pass=2 rule=R3)
changed holdout1|stripe|/v1/radar/value_lists/{value_list}|DELETE|DeleteRadarValueListsValueList  gt=w  c8:w/review -> c9:w/assigned (pass=2 rule=R3)
changed holdout1|stripe|/v1/subscription_items/{item}|DELETE|DeleteSubscriptionItemsItem  gt=w  c8:w/review -> c9:w/assigned (pass=2 rule=R3)
changed holdout1|stripe|/v1/subscriptions/{subscription_exposed_id}|DELETE|DeleteSubscriptionsSubscriptionExposedId  gt=x  c8:w/review -> c9:x/assigned (pass=2 rule=R1)
changed holdout1|stripe|/v1/subscriptions/{subscription_exposed_id}/discount|DELETE|DeleteSubscriptionsSubscriptionExposedIdDiscount  gt=w  c8:w/review -> c9:w/assigned (pass=2 rule=R3)
changed holdout1|stripe|/v1/tax_ids/{id}|DELETE|DeleteTaxIdsId  gt=w  c8:w/review -> c9:w/assigned (pass=2 rule=R3)
changed holdout1|stripe|/v1/terminal/configurations/{configuration}|DELETE|DeleteTerminalConfigurationsConfiguration  gt=w  c8:w/review -> c9:w/assigned (pass=2 rule=R3)
changed holdout1|stripe|/v1/terminal/locations/{location}|DELETE|DeleteTerminalLocationsLocation  gt=w  c8:w/review -> c9:w/assigned (pass=2 rule=R3)
changed holdout1|stripe|/v1/terminal/readers/{reader}|DELETE|DeleteTerminalReadersReader  gt=w  c8:w/review -> c9:w/assigned (pass=2 rule=R3)
changed holdout1|stripe|/v1/test_helpers/test_clocks/{test_clock}|DELETE|DeleteTestHelpersTestClocksTestClock  gt=w  c8:w/review -> c9:w/assigned (pass=2 rule=R3)
changed holdout1|stripe|/v1/webhook_endpoints/{webhook_endpoint}|DELETE|DeleteWebhookEndpointsWebhookEndpoint  gt=w  c8:w/review -> c9:w/assigned (pass=2 rule=R3)
changed holdout1|github|/orgs/{org}/outside_collaborators/{username}|PUT|orgs/convert-member-to-outside-collaborator  gt=x  c8:w/review -> c9:x/assigned (pass=2 rule=R1)
changed holdout1|github|/repos/{owner}/{repo}/import|PUT|migrations/start-import  gt=x  c8:w/review -> c9:x/assigned (pass=2 rule=R1)
changed holdout1|github|/repos/{owner}/{repo}/pulls/{pull_number}/merge-async|PUT|pulls/merge-async  gt=x  c8:w/review -> c9:x/assigned (pass=2 rule=R1)
changed holdout2|box|/ai/ask|POST|post_ai_ask  gt=r  c8:x/review -> c9:x/assigned (pass=floor rule=floor)
changed holdout2|box|/ai/text_gen|POST|post_ai_text_gen  gt=r  c8:x/review -> c9:x/assigned (pass=floor rule=floor)
changed holdout2|box|/ai_agents|POST|post_ai_agents  gt=x  c8:x/review -> c9:x/assigned (pass=floor rule=floor)
changed holdout2|box|/collaboration_whitelist_entries|POST|post_collaboration_whitelist_entries  gt=x  c8:x/review -> c9:x/assigned (pass=floor rule=floor)
changed holdout2|box|/comments|POST|post_comments  gt=x  c8:x/review -> c9:x/assigned (pass=floor rule=floor)
changed holdout2|box|/files/upload_sessions/{upload_session_id}/commit|POST|post_files_upload_sessions_id_commit  gt=x  c8:x/review -> c9:x/assigned (pass=floor rule=floor)
changed holdout2|box|/files/{file_id}/content|POST|post_files_id_content  gt=x  c8:x/review -> c9:x/assigned (pass=floor rule=floor)
changed holdout2|box|/files/{file_id}/metadata/global/boxSkillsCards|POST|post_files_id_metadata_global_boxSkillsCards  gt=w  c8:x/review -> c9:x/assigned (pass=floor rule=floor)
changed holdout2|box|/files/{file_id}/versions/current|POST|post_files_id_versions_current  gt=x  c8:x/review -> c9:x/assigned (pass=floor rule=floor)
changed holdout2|box|/folders/{folder_id}/metadata/enterprise/securityClassification-6VMVochwUWo|POST|post_folders_id_metadata_enterprise_securityClassification-6VMVochwUWo  gt=w  c8:x/review -> c9:x/assigned (pass=floor rule=floor)
changed holdout2|box|/integration_mappings/slack|POST|post_integration_mappings_slack  gt=x  c8:x/review -> c9:x/assigned (pass=floor rule=floor)
changed holdout2|box|/metadata_cascade_policies|POST|post_metadata_cascade_policies  gt=x  c8:x/review -> c9:x/assigned (pass=floor rule=floor)
changed holdout2|box|/metadata_cascade_policies/{metadata_cascade_policy_id}/apply|POST|post_metadata_cascade_policies_id_apply  gt=w  c8:x/review -> c9:x/assigned (pass=floor rule=floor)
changed holdout2|box|/metadata_taxonomies/{namespace}/{taxonomy_key}|PATCH|patch_metadata_taxonomies_id_id  gt=w  c8:x/review -> c9:x/assigned (pass=floor rule=floor)
changed holdout2|box|/metadata_taxonomies/{namespace}/{taxonomy_key}/levels:append|POST|post_metadata_taxonomies_id_id_levels:append  gt=x  c8:x/review -> c9:x/assigned (pass=floor rule=floor)
changed holdout2|box|/metadata_taxonomies/{namespace}/{taxonomy_key}/nodes|POST|post_metadata_taxonomies_id_id_nodes  gt=x  c8:x/review -> c9:x/assigned (pass=floor rule=floor)
changed holdout2|box|/metadata_taxonomies/{namespace}/{taxonomy_key}/nodes/{node_id}|PATCH|patch_metadata_taxonomies_id_id_nodes_id  gt=w  c8:x/review -> c9:x/assigned (pass=floor rule=floor)
changed holdout2|box|/oauth2/token|POST|post_oauth2_token  gt=x  c8:x/review -> c9:x/assigned (pass=floor rule=floor)
changed holdout2|box|/shield_information_barrier_segment_restrictions|POST|post_shield_information_barrier_segment_restrictions  gt=x  c8:x/review -> c9:x/assigned (pass=floor rule=floor)
changed holdout2|box|/shield_information_barriers|POST|post_shield_information_barriers  gt=x  c8:x/review -> c9:x/assigned (pass=floor rule=floor)
changed holdout2|box|/sign_requests/{sign_request_id}/cancel|POST|post_sign_requests_id_cancel  gt=x  c8:x/review -> c9:x/assigned (pass=2 rule=R1)
changed holdout2|box|/users/{user_id}/email_aliases|POST|post_users_id_email_aliases  gt=x  c8:x/review -> c9:x/assigned (pass=floor rule=floor)
changed holdout2|box|/workflows/{workflow_id}/start|POST|post_workflows_id_start  gt=x  c8:x/review -> c9:x/assigned (pass=2 rule=R1)
changed holdout2|pagerduty|/business_services/priority_thresholds|PUT|putBusinessServicePriorityThresholds  gt=w  c8:w/review -> c9:w/assigned (pass=2 rule=R3)
changed holdout2|pagerduty|/enrichment/event_enrichments/{id}|PUT|updateEventEnrichment  gt=w  c8:w/review -> c9:w/assigned (pass=2 rule=R3)
changed holdout2|pagerduty|/enrichment/event_enrichments/{id}/rules|PUT|updateEventEnrichmentRules  gt=w  c8:w/review -> c9:w/assigned (pass=2 rule=R3)
changed holdout2|pagerduty|/enrichment/integrations/servicenow/{integration_id}/tables/{table_id}|DELETE|deleteServiceNowTable  gt=w  c8:x/assigned -> c9:w/assigned (pass=2 rule=R3)
changed holdout2|pagerduty|/escalation_policies/{id}|DELETE|deleteEscalationPolicy  gt=w  c8:w/review -> c9:w/assigned (pass=2 rule=R3)
changed holdout2|pagerduty|/event_orchestrations/services/{service_id}/cache_variables/{cache_variable_id}/data|DELETE|deleteExternalDataCacheVarDataOnServiceOrch  gt=w  c8:w/review -> c9:w/assigned (pass=2 rule=R3)
changed holdout2|pagerduty|/event_orchestrations/{id}|PUT|updateOrchestration  gt=w  c8:w/review -> c9:w/assigned (pass=2 rule=R3)
changed holdout2|pagerduty|/event_orchestrations/{id}/cache_variables/{cache_variable_id}|PUT|updateCacheVarOnGlobalOrch  gt=w  c8:w/review -> c9:w/assigned (pass=2 rule=R3)
changed holdout2|pagerduty|/event_orchestrations/{id}/enablements/{feature_name}|PUT|updateEventOrchestrationFeatureEnablements  gt=w  c8:w/review -> c9:w/assigned (pass=2 rule=R3)
changed holdout2|pagerduty|/event_orchestrations/{id}/integrations/migration|POST|migrateOrchestrationIntegration  gt=w  c8:x/review -> c9:x/assigned (pass=floor rule=floor)
changed holdout2|pagerduty|/event_orchestrations/{id}/router|PUT|updateOrchPathRouter  gt=w  c8:w/review -> c9:w/assigned (pass=2 rule=R3)
changed holdout2|pagerduty|/extensions/{id}/enable|POST|enableExtension  gt=w  c8:x/review -> c9:x/assigned (pass=floor rule=floor)
changed holdout2|pagerduty|/incident_workflows/triggers/{id}/services|POST|associateServiceToIncidentWorkflowTrigger  gt=w  c8:x/review -> c9:x/assigned (pass=2 rule=R1)
changed holdout2|pagerduty|/incidents/{id}/alerts|PUT|updateIncidentAlerts  gt=w  c8:w/review -> c9:w/assigned (pass=2 rule=R3)
changed holdout2|pagerduty|/recommendations/event_orchestrations/services/{service_id}/rules/{recommendation_id}/dismiss|POST|dismissRecommendedRule  gt=w  c8:x/review -> c9:x/assigned (pass=floor rule=floor)
changed holdout2|pagerduty|/rulesets/{id}|PUT|updateRuleset  gt=w  c8:w/review -> c9:w/assigned (pass=2 rule=R3)
changed holdout2|pagerduty|/rulesets/{id}/rules/{rule_id}|PUT|updateRulesetEventRule  gt=w  c8:w/review -> c9:w/assigned (pass=2 rule=R3)
changed holdout2|pagerduty|/schedules/{id}/overrides/{override_id}|DELETE|deleteScheduleOverride  gt=w  c8:w/review -> c9:w/assigned (pass=2 rule=R3)
changed holdout2|pagerduty|/services/custom_fields/{field_id}|DELETE|deleteServiceCustomField  gt=w  c8:w/review -> c9:w/assigned (pass=2 rule=R3)
changed holdout2|pagerduty|/services/custom_fields/{field_id}/field_options/{field_option_id}|DELETE|deleteServiceCustomFieldOption  gt=w  c8:w/review -> c9:w/assigned (pass=2 rule=R3)
changed holdout2|pagerduty|/services/{id}|PUT|updateService  gt=w  c8:w/review -> c9:w/assigned (pass=2 rule=R3)
changed holdout2|pagerduty|/services/{id}/rules/{rule_id}|PUT|updateServiceEventRule  gt=w  c8:w/review -> c9:w/assigned (pass=2 rule=R3)
changed holdout2|pagerduty|/sre_agent/memories/{id}|DELETE|deleteSreMemory  gt=w  c8:w/review -> c9:w/assigned (pass=2 rule=R3)
changed holdout2|pagerduty|/standards/{id}|PUT|updateStandard  gt=w  c8:w/review -> c9:w/assigned (pass=2 rule=R3)
changed holdout2|pagerduty|/status_pages/{id}/subscriptions/{subscription_id}|DELETE|deleteStatusPageSubscription  gt=w  c8:w/review -> c9:w/assigned (pass=2 rule=R3)
changed holdout2|pagerduty|/teams/{id}/users/{user_id}|PUT|updateTeamUser  gt=w  c8:w/review -> c9:x/assigned (pass=2 rule=R2)
changed holdout2|pagerduty|/users/{id}/notification_rules/{notification_rule_id}|PUT|updateUserNotificationRule  gt=w  c8:w/review -> c9:w/assigned (pass=2 rule=R3)
changed holdout2|pagerduty|/users/{id}/oncall_handoff_notification_rules/{oncall_handoff_notification_rule_id}|PUT|updateUserHandoffNotification  gt=w  c8:w/review -> c9:w/assigned (pass=2 rule=R3)
changed holdout2|pagerduty|/users/{id}/status_update_notification_rules/{status_update_notification_rule_id}|PUT|updateUserStatusUpdateNotificationRule  gt=w  c8:w/review -> c9:w/assigned (pass=2 rule=R3)
changed holdout2|pagerduty|/v3/schedules/{id}|PUT|updateScheduleV3  gt=w  c8:w/review -> c9:w/assigned (pass=2 rule=R3)
changed holdout2|pagerduty|/v3/schedules/{id}/rotations/{rotation_id}/events/{event_id}|PUT|updateEvent  gt=w  c8:w/review -> c9:w/assigned (pass=2 rule=R3)
changed holdout2|pagerduty|/webhook_subscriptions/{id}|DELETE|deleteWebhookSubscription  gt=w  c8:w/review -> c9:w/assigned (pass=2 rule=R3)
changed holdout2|pagerduty|/workflows/integrations/{integration_id}/connections/{id}|DELETE|deleteWorkflowIntegrationConnection  gt=w  c8:w/review -> c9:w/assigned (pass=2 rule=R3)
changed holdout2|adyen|/applePay/sessions|POST|post-applePay-sessions  gt=x  c8:x/review -> c9:x/assigned (pass=2 rule=R1)
changed holdout2|adyen|/cancels|POST|post-cancels  gt=x  c8:x/review -> c9:x/assigned (pass=2 rule=R1)
changed holdout2|adyen|/cardDetails|POST|post-cardDetails  gt=r  c8:x/review -> c9:x/assigned (pass=floor rule=floor)
changed holdout2|adyen|/donationCampaigns|POST|post-donationCampaigns  gt=r  c8:x/review -> c9:x/assigned (pass=floor rule=floor)
changed holdout2|adyen|/donations|POST|post-donations  gt=x  c8:x/review -> c9:x/assigned (pass=floor rule=floor)
changed holdout2|adyen|/forward|POST|post-forward  gt=x  c8:x/review -> c9:x/assigned (pass=floor rule=floor)
changed holdout2|adyen|/orders|POST|post-orders  gt=x  c8:x/review -> c9:x/assigned (pass=floor rule=floor)
changed holdout2|adyen|/orders/cancel|POST|post-orders-cancel  gt=x  c8:x/review -> c9:x/assigned (pass=2 rule=R1)
changed holdout2|adyen|/originKeys|POST|post-originKeys  gt=r  c8:x/review -> c9:x/assigned (pass=floor rule=floor)
changed holdout2|adyen|/paymentLinks|POST|post-paymentLinks  gt=x  c8:x/review -> c9:x/assigned (pass=floor rule=floor)
changed holdout2|adyen|/paymentLinks/{linkId}|PATCH|patch-paymentLinks-linkId  gt=w  c8:x/review -> c9:x/assigned (pass=floor rule=floor)
changed holdout2|adyen|/paymentMethods|POST|post-paymentMethods  gt=r  c8:x/review -> c9:x/assigned (pass=floor rule=floor)
changed holdout2|adyen|/paymentMethods/balance|POST|post-paymentMethods-balance  gt=r  c8:x/review -> c9:x/assigned (pass=floor rule=floor)
changed holdout2|adyen|/payments|POST|post-payments  gt=x  c8:x/review -> c9:x/assigned (pass=2 rule=R1)
changed holdout2|adyen|/payments/details|POST|post-payments-details  gt=x  c8:x/review -> c9:x/assigned (pass=2 rule=R1)
changed holdout2|adyen|/payments/{paymentPspReference}/amountUpdates|POST|post-payments-paymentPspReference-amountUpdates  gt=x  c8:x/review -> c9:x/assigned (pass=floor rule=floor)
changed holdout2|adyen|/payments/{paymentPspReference}/cancels|POST|post-payments-paymentPspReference-cancels  gt=x  c8:x/review -> c9:x/assigned (pass=2 rule=R1)
changed holdout2|adyen|/payments/{paymentPspReference}/captures|POST|post-payments-paymentPspReference-captures  gt=x  c8:x/review -> c9:x/assigned (pass=floor rule=floor)
changed holdout2|adyen|/payments/{paymentPspReference}/refunds|POST|post-payments-paymentPspReference-refunds  gt=x  c8:x/review -> c9:x/assigned (pass=2 rule=R1)
changed holdout2|adyen|/payments/{paymentPspReference}/reversals|POST|post-payments-paymentPspReference-reversals  gt=x  c8:x/review -> c9:x/assigned (pass=2 rule=R1)
changed holdout2|adyen|/paypal/updateOrder|POST|post-paypal-updateOrder  gt=x  c8:x/review -> c9:x/assigned (pass=floor rule=floor)
changed holdout2|adyen|/sessions|POST|post-sessions  gt=x  c8:x/review -> c9:x/assigned (pass=floor rule=floor)
changed holdout2|adyen|/storedPaymentMethods|POST|post-storedPaymentMethods  gt=x  c8:x/review -> c9:x/assigned (pass=floor rule=floor)
changed holdout2|adyen|/validateShopperId|POST|post-validateShopperId  gt=r  c8:x/review -> c9:x/assigned (pass=floor rule=floor)
```

## Every leak anywhere, any set, any pass, at the chosen configuration: 0

None.

## Empty-operationId rows (judge summary-fallback): 0

None found in census-ops.csv / ops-text.csv — see the delegate report for the discrepancy this raises against the M1-C9 brief's "~16, all Twilio" note.

