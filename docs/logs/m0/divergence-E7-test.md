# M0 divergence report

## Counts

- rows joined: 152
- unjoined (in run, not in ground truth): 0
- unjoined (in ground truth, not in run): 140
  - getOptimalAppEndpoints
  - createApplicationProfile
  - updateApplicationProfile
  - readApplicationProfile
  - deleteApplicationProfile
  - retrieveUnconditionalCallForwarding
  - retrieveCallForwarding
  - createRefund
  - retrieveRefunds
  - retrieveRefund
  - retrievePaymentRemainingAmount
  - createPayment
  - retrievePayments
  - retrievePayment
  - preparePayment
  - validatePayment
  - confirmPayment
  - cancelPayment
  - createConnectedNetworkTypeSubscription
  - retrieveConnectedNetworkTypeSubscriptionList
  - retrieveConnectedNetworkTypeSubscription
  - deleteConnectedNetworkTypeSubscription
  - getConnectedNetworkType
  - retrieveStatus
  - retrieveScoring
  - checkImeiStatus
  - retrieveIdentifier
  - retrieveType
  - retrievePpid
  - matchIdentifier
  - retrieveMaximumDownstreamMediaRate
  - createDeviceRoamingStatusSubscription
  - retrieveDeviceRoamingStatusSubscriptionList
  - retrieveDeviceRoamingStatusSubscription
  - deleteDeviceRoamingStatusSubscription
  - getRoamingStatus
  - retrieveDeviceSwapDate
  - checkDeviceSwap
  - submitApp
  - getApps
  - getApp
  - deleteApp
  - createAppInstance
  - getAppInstances
  - getAppInstance
  - deleteAppInstance
  - createAppDeployment
  - getAppDeployments
  - getAppDeployment
  - deleteAppDeployment
  - updateAppDeployment
  - getEdgeCloudZones
  - scheduleTransmission
  - downloadEsimProfile
  - enableEsimProfile
  - disableEsimProfile
  - deleteEsimProfile
  - setFallbackEsimProfile
  - getEsimProfileStatus
  - retrieveOperation
  - subscribeFraudPrevention
  - listSubscriptions
  - getSubscription
  - deleteSubscription
  - bindDeviceImei
  - unBindDeviceImei
  - query
  - verifyAge
  - kycMatch
  - verifyFrequentLocation
  - getNetworkAccessDevices
  - getNetworkAccessDevice
  - createRebootRequest
  - getRebootRequests
  - getRebootRequest
  - updateRebootRequest
  - deleteRebootRequest
  - getServices
  - getService
  - getTrustDomainCapabilities
  - createTrustDomain
  - getTrustDomains
  - getTrustDomain
  - updateTrustDomain
  - deleteTrustDomain
  - createTrustDomainDevice
  - getTrustDomainDevices
  - getTrustDomainDevice
  - updateTrustDomainDevice
  - deleteTrustDomainDevice
  - assignDevice
  - getDevices
  - releaseDevice
  - retrieveSlicesByDevice
  - createSlice
  - deleteSlice
  - getSlice
  - phoneNumberVerify
  - phoneNumberShare
  - getRegions
  - discoverOptimalEdge
  - retrieveConnectivity
  - retrieveQosProfiles
  - getQosProfile
  - createQosAssignment
  - getQosAssignmentById
  - revokeQosAssignment
  - getQosAssignmentByDevice
  - createSession
  - getSession
  - deleteSession
  - extendQosSessionDuration
  - retrieveSessionsByDevice
  - createSession
  - getSession
  - deleteSession
  - retrieveSessionsByDevice
  - sendSessionMetrics
  - readClosestEdgeCloudZone
  - retrieveSubscriptionStatus
  - getAllTrafficInfluences
  - postTrafficInfluence
  - postTrafficInfluenceDevice
  - getTrafficInfluenceById
  - patchTrafficInfluence
  - deleteTrafficInfluence
  - createSession
  - getSessionDetailsById
  - deleteSessionById
  - updateSessionStatus
  - createNotificationChannelSubscription
  - retrieveNotificationChannelSubscriptionList
  - retrieveNotificationChannelSubscription
  - updateNotificationChannelSubscription
  - deleteNotificationChannelSubscription
  - getRegistrationsByDeviceId
  - createRegistration
  - getRegistrationById
  - updateRegistrationById
  - deleteRegistrationById
- agree: 131
- WRONG-LOOSENING: 7
- over-tight: 14

By method:
  - POST: {"agree":59,"WRONG-LOOSENING":2,"over-tight":10}
  - GET: {"agree":50}
  - PUT: {"agree":3,"over-tight":2}
  - DELETE: {"agree":18,"WRONG-LOOSENING":5}
  - PATCH: {"over-tight":2,"agree":1}

By confidence:
  - method-only: {"agree":25,"WRONG-LOOSENING":5,"over-tight":6}
  - high: {"agree":58,"over-tight":1}
  - low: {"WRONG-LOOSENING":2,"agree":48,"over-tight":7}

## Wrong loosenings

| repo | method | path | operationId | rule class | confidence | rule_id | evidence | gt_class | gt reason |
|---|---|---|---|---|---|---|---|---|---|
| BlockchainPublicAddress | POST | /nonce | createBlockchainPublicAddressValidationNonce | r | low | T2-lookup | read=associated | x | The 201 Created response returns a freshly generated "One-time challenge" nonce each call, so calling twice yields two distinct nonces rather than the same result. |
| ClickToDial | DELETE | /calls/{callId} | terminateCall | w | method-only | T3-floor | method=DELETE | x | Description says it "Terminates an active Click to Dial call session" between caller and callee, ending a live call that the callee is also on. |
| DedicatedNetworks | DELETE | /accesses/{accessId} | deleteAccess | w | method-only | T3-floor | method=DELETE | x | Per "Deletion of the access can be interpreted as removal of the permission for all the devices included in the access to access the network," deleting revokes live network connectivity granted to those devices. |
| DedicatedNetworks | DELETE | /networks/{networkId} | deleteNetwork | w | method-only | T3-floor | method=DELETE | x | Per "Deletion of a network can be interpreted as a cancellation of the resource reservation," and since an ACTIVATED network is one "devices with access can use," deleting it terminates connectivity devices may currently be using. |
| InHomeDeviceManagement | DELETE | /v1/devices/{deviceId} | deleteDevice | w | method-only | T3-floor | method=DELETE | x | description notes deletion also removes 'Any active access control rules for this device,' restoring the device's live network access, the same class of device-reaching action as updateDevice's block/unblock. |
| OTPValidation | POST | /send-code | sendCode | r | low | T2-lookup | read=phone,number | x | Description states it "Sends an SMS with the desired message and an OTP code to the received phone number", directly reaching a person via SMS, which is a third-party external effect regardless of idempotency. |
| SponsoredData | DELETE | /sponsorship/{sponsorId}/{campaignId}/{sessionId}/revoke | revokeSponsorship | w | method-only | T3-floor | method=DELETE | x | revokeSponsorship "revokes an active sponsorship, preventing further use of sponsored data for the subscriber," cutting off a real end user's active benefit rather than the sponsor caller's own resource. |

## Over-tightenings

| repo | method | path | operationId | rule class | confidence | rule_id | evidence | gt_class | gt reason |
|---|---|---|---|---|---|---|---|---|---|
| ConsentManagement | PATCH | /consents/{consentId} | updateConsent | x | method-only | T3-floor | method=PATCH | w | Description says it allows the consumer "to update the status of an existing Consent" identified by consentId, setting consentStatus to GRANTED or DENIED, a set operation on an existing resource. |
| KnowYourCustomer | POST | /match | KYC_Match | x | low | T1-consequence | harm=apply | r | The operation 'verif[ies] matching of a number of attributes' against stored data and returns true/false/not_available per attribute without altering any record. |
| ModelAsAService | PUT | /assistants/{assistantId} | updateAssistant | x | low | T1-consequence | harm=new | w | updateAssistant 'is a partial update (not a full replacement)' where largeModelParameters and toolIds are each 'replaced as a whole' when supplied, an idempotent set operation. |
| MultiPointVPN | PATCH | /networks/{serviceId} | updateNetwork | x | method-only | T3-floor | method=PATCH | w | updateNetwork uses application/merge-patch+json against NetworkUpdate, a JSON-merge-patch set of guaranteeBandwidth/sla fields that is idempotent by construction. |
| OTPValidation | POST | /validate-code | validateCode | x | method-only | T3-floor | method=POST | w | Verifies the code for the given authenticationId; once validated the code is consumed (single-use, per MAX_OTP_CODES/expiry semantics) so the authenticationId's final state converges after one or more calls, with no effect reaching outside the API. |
| PopulationDensityData | POST | /retrieve | retrievePopulationDensity | x | low | T1-consequence | structural=callbacks,sink | r | The info.description states this "operation creates no resource to read back"; the operationId is only used to correlate an async callback delivery of the same query's result, not a created resource. |
| QoSBooking | POST | /qos-bookings/retrieve | retrieveBookingByDevice | x | method-only | T3-floor | method=POST | r | "Querying for QoS Booking resource information details for a device"; body carries only a device identifier and the response is a read-only array. |
| RegionDeviceCount | POST | /count | count | x | low | T1-consequence | structural=callbacks,sink | r | The /count operation only computes and returns "the number of devices in the specified area during a certain time interval," whether delivered synchronously or via the caller's own sink, without altering any resource. |
| SimSwap | POST | /retrieve-age-band | retrieveSimSwapAgeBand | x | low | T1-consequence | harm=apply | r | retrieve-age-band "returns a standardized simSwapAgeBand value" as a computed read, explicitly noted to not return or alter any state. |
| SponsoredData | POST | /campaign/management | manageCampaign | x | low | T1-consequence | harm=new | w | manageCampaign only toggles the campaign between "PAUSE to temporarily halt new sponsorships" and "RESUME to reactivate the campaign," a status-set operation with the same end state however often it is applied. |
| Tenure | POST | /check-tenure | checkTenure | x | method-only | T3-floor | method=POST | r | checkTenure only verifies "a specified length of tenure ... to establish a level of trust," returning a boolean with nothing created or changed. |
| VerifiedCaller | PUT | /registrations/{registrationId} | updateRegistration | x | low | T1-consequence | structural=sink | w | updateRegistration replaces a "Request object to create or update (replace) a brand registration," a create-or-replace write with the same end state regardless of repetition. |
| eSimRemoteManagement | POST | /profile/result/query | profileResultQuery | x | method-only | T3-floor | method=POST | r | The POST body only carries a taskId to look up ("Query the result of an asynchronous profile operation ... using the task ID") and the response is a status value with no resource created or modified. |
| eSimRemoteManagement | POST | /profile/downloaded-list | profileList | x | high | T1-consequence | harm=disabled,iccid | r | The POST body is only a query filter (eId) and the response is "a list of all eSIM profiles currently downloaded on the device," with no state change. |

## Negative controls

- ClickToDial DELETE /calls/{callId} `terminateCall`: rule class = w, gt class = x — FAIL
- WebRTC PUT /sessions/{mediaSessionId}/status `updateSessionStatus`: rule class = (not found in run output), gt class = x — FAIL
