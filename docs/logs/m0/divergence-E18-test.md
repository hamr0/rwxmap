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
- agree: 123
- WRONG-LOOSENING: 3
- over-tight: 26

By method:
  - POST: {"agree":54,"over-tight":16,"WRONG-LOOSENING":1}
  - GET: {"agree":50}
  - PUT: {"agree":3,"over-tight":2}
  - DELETE: {"agree":15,"over-tight":6,"WRONG-LOOSENING":2}
  - PATCH: {"over-tight":2,"agree":1}

By confidence:
  - high: {"agree":114,"over-tight":16,"WRONG-LOOSENING":2}
  - method-only: {"agree":8,"over-tight":7,"WRONG-LOOSENING":1}
  - low: {"agree":1,"over-tight":3}

## Wrong loosenings

| repo | method | path | operationId | rule class | confidence | rule_id | evidence | gt_class | gt reason |
|---|---|---|---|---|---|---|---|---|---|
| InHomeDeviceManagement | DELETE | /v1/devices/{deviceId} | deleteDevice | w | high | V5-verb-write | verb=delete | x | description notes deletion also removes 'Any active access control rules for this device,' restoring the device's live network access, the same class of device-reaching action as updateDevice's block/unblock. |
| ModelAsAService | POST | /answer | queryAssistant | r | high | V4-verb-read | verb=get | x | queryAssistant's LLM 'MAY invoke [associated] tools automatically while generating the answer ... turning the assistant into an agent that can take actions', and those tool invocations reach consumer-registered third-party urls, so the read-shaped query can carry third-party side effects the response never surfaces. |
| SponsoredData | DELETE | /sponsorship/{sponsorId}/{campaignId}/{sessionId}/revoke | revokeSponsorship | w | method-only | V6-floor | verb=revocation head=none | x | revokeSponsorship "revokes an active sponsorship, preventing further use of sponsored data for the subscriber," cutting off a real end user's active benefit rather than the sponsor caller's own resource. |

## Over-tightenings

| repo | method | path | operationId | rule class | confidence | rule_id | evidence | gt_class | gt reason |
|---|---|---|---|---|---|---|---|---|---|
| ConsentManagement | PATCH | /consents/{consentId} | updateConsent | x | high | V5-verb-write | verb=update | w | Description says it allows the consumer "to update the status of an existing Consent" identified by consentId, setting consentStatus to GRANTED or DENIED, a set operation on an existing resource. |
| DeviceDataVolume | POST | /retrieve | retrieveDataVolume | x | high | V2-verb-consequential | verb=execute | r | retrieveDataVolume "retrieve[s] the estimated remaining data volume for a device," a query returning a value with no resource created. |
| DeviceLocation | POST | /retrieve | retrieveLocation | x | high | V2-verb-consequential | verb=execute | r | retrieveLocation "retrieve[s] the area where a certain user device is localized," a query returning a location value with nothing created. |
| DeviceLocation | POST | /verify | verifyLocation | x | low | V3-party-object | verb=verify head=location party=device | r | verifyLocation "verif[ies] whether the location of a device is within a requested area" and returns a verification result, a pure check. |
| DeviceReachabilityStatus | DELETE | /subscriptions/{subscriptionId} | deleteDeviceReachabilityStatusSubscription | x | high | V3-party-object | verb=delete head=event party=device | w | deleteDeviceReachabilityStatusSubscription simply deletes "a given subscription by ID," stopping only the consumer's own future notifications with no third-party effect. |
| DeviceStatus | DELETE | /subscriptions/{subscriptionId} | deleteConnectedNetworkTypeSubscription | x | high | V3-party-object | verb=delete head=event party=device | w | Deletes the caller's own subscription (204/202 async), a delete-resource operation whose repetition converges to the same deleted state. |
| DeviceStatus | DELETE | /subscriptions/{subscriptionId} | deleteDeviceReachabilityStatusSubscription | x | high | V3-party-object | verb=delete head=event party=device | w | description 'Delete a given subscription by ID' removes the caller's own subscription, an idempotent delete. |
| DeviceStatus | DELETE | /subscriptions/{subscriptionId} | deleteDeviceRoamingStatusSubscription | x | high | V3-party-object | verb=delete head=event party=device | w | description 'Delete a given device-roaming-status subscription by ID' idempotently removes the caller's own subscription. |
| KnowYourCustomer | POST | /verify | verifyAge | x | method-only | V6-floor | verb=verify head=threshold | r | "Verify that the age of the subscriber ... is equal to or greater than the specified age threshold" only returns a computed ageCheck value, changing nothing. |
| KnowYourCustomer | POST | /fill-in | KYC_Fill-in | x | low | V3-party-object | verb=providing head=related party=customer | r | The summary describes 'Providing information related to a customer identity stored the account data bound to the customer's phone number', a read of Operator-held data with no write. |
| KnowYourCustomer | POST | /match | KYC_Match | x | method-only | V6-floor | verb=matching head=identity | r | The operation 'verif[ies] matching of a number of attributes' against stored data and returns true/false/not_available per attribute without altering any record. |
| KnowYourCustomerFill-in | POST | /fill-in | kycFillin | x | low | V3-party-object | verb=providing head=related party=customer | r | As the standalone Fill-in repo's endpoint, it lets a client 'request and receive the information for a particular user ... on file' with the Operator, purely retrieving stored attributes. |
| ModelAsAService | PUT | /assistants/{assistantId} | updateAssistant | x | high | V3-party-object | verb=update head=assistant party=assistant | w | updateAssistant 'is a partial update (not a full replacement)' where largeModelParameters and toolIds are each 'replaced as a whole' when supplied, an idempotent set operation. |
| ModelAsAService | DELETE | /assistants/{assistantId} | deleteAssistant | x | high | V3-party-object | verb=delete head=assistant party=assistant | w | "Permanently removes a QA assistant configuration" (204) is an idempotent deletion that cannot be undone but converges to the same deleted state on repeat. |
| MultiPointVPN | PATCH | /networks/{serviceId} | updateNetwork | x | method-only | V6-floor | verb=to head=private | w | updateNetwork uses application/merge-patch+json against NetworkUpdate, a JSON-merge-patch set of guaranteeBandwidth/sla fields that is idempotent by construction. |
| MultiPointVPN | DELETE | /networks/{serviceId} | deleteNetwork | x | high | V3-party-object | verb=delete head=network party=network | w | "Network deletion request accepted. The deletion is processed asynchronously; the resource will be removed once complete" describes an idempotent removal despite the async 202. |
| MultiPointVPN | POST | /assessment | assessConnectionFeasibility | x | method-only | V6-floor | verb=assess head=feasibility | r | The request body only carries hypothetical connection parameters and the response returns waitDays/sla/rent estimates with no network or resource created, matching the query-only-POST rule for r. |
| NumberRecycling | POST | /check | checkNumberRecycling | x | high | V3-party-object | verb=check head=subscriber party=subscriber | r | Body is only a phoneNumber and specifiedDate query; the response is a boolean `phoneNumberRecycled` flag with no resource created or modified. |
| OTPValidation | POST | /validate-code | validateCode | x | method-only | V6-floor | verb=verify head=received | w | Verifies the code for the given authenticationId; once validated the code is consumed (single-use, per MAX_OTP_CODES/expiry semantics) so the authenticationId's final state converges after one or more calls, with no effect reaching outside the API. |
| PopulationDensityData | POST | /retrieve | retrievePopulationDensity | x | high | V1-structural | structural=callbacks,sink | r | The info.description states this "operation creates no resource to read back"; the operationId is only used to correlate an async callback delivery of the same query's result, not a created resource. |
| QoSBooking | POST | /qos-bookings/retrieve | retrieveBookingByDevice | x | high | V3-party-object | verb=retrieve head=booking party=device | r | "Querying for QoS Booking resource information details for a device"; body carries only a device identifier and the response is a read-only array. |
| QoSBooking | POST | /retrieve-device-qos-bookings | retrieveBookingByDevice | x | high | V3-party-object | verb=gets head=booking party=device | r | "Querying for QoS Booking resource information details for a device"; body is only a device identifier and the response is a read-only array of existing bookings. |
| RegionDeviceCount | POST | /count | count | x | high | V1-structural | structural=callbacks,sink | r | The /count operation only computes and returns "the number of devices in the specified area during a certain time interval," whether delivered synchronously or via the caller's own sink, without altering any resource. |
| SponsoredData | POST | /campaign/management | manageCampaign | x | method-only | V6-floor | verb=campaign head=management | w | manageCampaign only toggles the campaign between "PAUSE to temporarily halt new sponsorships" and "RESUME to reactivate the campaign," a status-set operation with the same end state however often it is applied. |
| Tenure | POST | /check-tenure | checkTenure | x | method-only | V6-floor | verb=the head=api | r | checkTenure only verifies "a specified length of tenure ... to establish a level of trust," returning a boolean with nothing created or changed. |
| VerifiedCaller | PUT | /registrations/{registrationId} | updateRegistration | x | high | V1-structural | structural=sink | w | updateRegistration replaces a "Request object to create or update (replace) a brand registration," a create-or-replace write with the same end state regardless of repetition. |

## Negative controls

- ClickToDial DELETE /calls/{callId} `terminateCall`: rule class = x, gt class = x — PASS
- WebRTC PUT /sessions/{mediaSessionId}/status `updateSessionStatus`: rule class = (not found in run output), gt class = x — FAIL
