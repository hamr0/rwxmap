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
- agree: 128
- WRONG-LOOSENING: 6
- over-tight: 18

By method:
  - POST: {"agree":55,"over-tight":14,"WRONG-LOOSENING":2}
  - GET: {"agree":50}
  - PUT: {"agree":4,"over-tight":1}
  - DELETE: {"agree":18,"WRONG-LOOSENING":4,"over-tight":1}
  - PATCH: {"over-tight":2,"agree":1}

By confidence:
  - method-only: {"agree":29,"WRONG-LOOSENING":4,"over-tight":13}
  - high: {"agree":79,"over-tight":4}
  - low: {"agree":20,"WRONG-LOOSENING":2,"over-tight":1}

## Wrong loosenings

| repo | method | path | operationId | rule class | confidence | rule_id | evidence | gt_class | gt reason |
|---|---|---|---|---|---|---|---|---|---|
| ClickToDial | DELETE | /calls/{callId} | terminateCall | w | method-only | V5-floor | verb=terminate | x | Description says it "Terminates an active Click to Dial call session" between caller and callee, ending a live call that the callee is also on. |
| DedicatedNetworks | DELETE | /accesses/{accessId} | deleteAccess | w | method-only | V5-floor | verb=delete | x | Per "Deletion of the access can be interpreted as removal of the permission for all the devices included in the access to access the network," deleting revokes live network connectivity granted to those devices. |
| DedicatedNetworks | DELETE | /networks/{networkId} | deleteNetwork | w | method-only | V5-floor | verb=delete | x | Per "Deletion of a network can be interpreted as a cancellation of the resource reservation," and since an ACTIVATED network is one "devices with access can use," deleting it terminates connectivity devices may currently be using. |
| ModelAsAService | POST | /answer | queryAssistant | r | low | V4-lookup | verb=get | x | queryAssistant's LLM 'MAY invoke [associated] tools automatically while generating the answer ... turning the assistant into an agent that can take actions', and those tool invocations reach consumer-registered third-party urls, so the read-shaped query can carry third-party side effects the response never surfaces. |
| OTPValidation | POST | /validate-code | validateCode | r | low | V4-lookup | verb=verify | w | Verifies the code for the given authenticationId; once validated the code is consumed (single-use, per MAX_OTP_CODES/expiry semantics) so the authenticationId's final state converges after one or more calls, with no effect reaching outside the API. |
| SponsoredData | DELETE | /sponsorship/{sponsorId}/{campaignId}/{sessionId}/revoke | revokeSponsorship | w | method-only | V5-floor | verb=revocation | x | revokeSponsorship "revokes an active sponsorship, preventing further use of sponsored data for the subscriber," cutting off a real end user's active benefit rather than the sponsor caller's own resource. |

## Over-tightenings

| repo | method | path | operationId | rule class | confidence | rule_id | evidence | gt_class | gt reason |
|---|---|---|---|---|---|---|---|---|---|
| ConsentManagement | PATCH | /consents/{consentId} | updateConsent | x | method-only | V5-floor | verb=update | w | Description says it allows the consumer "to update the status of an existing Consent" identified by consentId, setting consentStatus to GRANTED or DENIED, a set operation on an existing resource. |
| DeviceDataVolume | POST | /retrieve | retrieveDataVolume | x | method-only | V5-floor | verb=execute | r | retrieveDataVolume "retrieve[s] the estimated remaining data volume for a device," a query returning a value with no resource created. |
| DeviceLocation | POST | /retrieve | retrieveLocation | x | method-only | V5-floor | verb=execute | r | retrieveLocation "retrieve[s] the area where a certain user device is localized," a query returning a location value with nothing created. |
| KnowYourCustomer | POST | /fill-in | KYC_Fill-in | x | method-only | V5-floor | verb=providing | r | The summary describes 'Providing information related to a customer identity stored the account data bound to the customer's phone number', a read of Operator-held data with no write. |
| KnowYourCustomer | POST | /match | KYC_Match | x | method-only | V5-floor | verb=matching | r | The operation 'verif[ies] matching of a number of attributes' against stored data and returns true/false/not_available per attribute without altering any record. |
| KnowYourCustomerFill-in | POST | /fill-in | kycFillin | x | method-only | V5-floor | verb=providing | r | As the standalone Fill-in repo's endpoint, it lets a client 'request and receive the information for a particular user ... on file' with the Operator, purely retrieving stored attributes. |
| MultiPointVPN | PATCH | /networks/{serviceId} | updateNetwork | x | method-only | V5-floor | verb=to | w | updateNetwork uses application/merge-patch+json against NetworkUpdate, a JSON-merge-patch set of guaranteeBandwidth/sla fields that is idempotent by construction. |
| MultiPointVPN | POST | /assessment | assessConnectionFeasibility | x | method-only | V5-floor | verb=assess | r | The request body only carries hypothetical connection parameters and the response returns waitDays/sla/rent estimates with no network or resource created, matching the query-only-POST rule for r. |
| PopulationDensityData | POST | /retrieve | retrievePopulationDensity | x | high | V1-structural | structural=callbacks,sink | r | The info.description states this "operation creates no resource to read back"; the operationId is only used to correlate an async callback delivery of the same query's result, not a created resource. |
| QoSBooking | POST | /qos-bookings/retrieve | retrieveBookingByDevice | x | method-only | V5-floor | verb=retrieve | r | "Querying for QoS Booking resource information details for a device"; body carries only a device identifier and the response is a read-only array. |
| QoSBooking | DELETE | /device-qos-bookings/{bookingId} | deleteBooking | x | high | V3-live-object | verb=delete nouns=device | w | "Release resources related to a QoS Booking"; deletion is described with terminal status handling and no further effect once TERMINATED, an idempotent-style resource removal. |
| QoSBooking | POST | /retrieve-device-qos-bookings | retrieveBookingByDevice | x | low | V3-live-object | verb=gets nouns=device | r | "Querying for QoS Booking resource information details for a device"; body is only a device identifier and the response is a read-only array of existing bookings. |
| RegionDeviceCount | POST | /count | count | x | high | V1-structural | structural=callbacks,sink | r | The /count operation only computes and returns "the number of devices in the specified area during a certain time interval," whether delivered synchronously or via the caller's own sink, without altering any resource. |
| SponsoredData | POST | /campaign/management | manageCampaign | x | method-only | V5-floor | verb=campaign | w | manageCampaign only toggles the campaign between "PAUSE to temporarily halt new sponsorships" and "RESUME to reactivate the campaign," a status-set operation with the same end state however often it is applied. |
| Tenure | POST | /check-tenure | checkTenure | x | method-only | V5-floor | verb=the | r | checkTenure only verifies "a specified length of tenure ... to establish a level of trust," returning a boolean with nothing created or changed. |
| VerifiedCaller | PUT | /registrations/{registrationId} | updateRegistration | x | high | V1-structural | structural=sink | w | updateRegistration replaces a "Request object to create or update (replace) a brand registration," a create-or-replace write with the same end state regardless of repetition. |
| eSimRemoteManagement | POST | /profile/result/query | profileResultQuery | x | method-only | V5-floor | verb=query | r | The POST body only carries a taskId to look up ("Query the result of an asynchronous profile operation ... using the task ID") and the response is a status value with no resource created or modified. |
| eSimRemoteManagement | POST | /profile/downloaded-list | profileList | x | method-only | V5-floor | verb=query | r | The POST body is only a query filter (eId) and the response is "a list of all eSIM profiles currently downloaded on the device," with no state change. |

## Negative controls

- ClickToDial DELETE /calls/{callId} `terminateCall`: rule class = w, gt class = x — FAIL
- WebRTC PUT /sessions/{mediaSessionId}/status `updateSessionStatus`: rule class = (not found in run output), gt class = x — FAIL
