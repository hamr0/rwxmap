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
- agree: 117
- WRONG-LOOSENING: 0
- over-tight: 35

By method:
  - POST: {"agree":53,"over-tight":18}
  - GET: {"agree":50}
  - PUT: {"agree":3,"over-tight":2}
  - DELETE: {"agree":10,"over-tight":13}
  - PATCH: {"over-tight":2,"agree":1}

By confidence:
  - high: {"agree":111,"over-tight":17}
  - method-only: {"agree":3,"over-tight":4}
  - low: {"over-tight":14,"agree":3}

## Wrong loosenings

(none)

## Over-tightenings

| repo | method | path | operationId | rule class | confidence | rule_id | evidence | gt_class | gt reason |
|---|---|---|---|---|---|---|---|---|---|
| BlockchainPublicAddress | POST | /blockchain-public-addresses/retrieve-blockchains | retrieveBlockchainPublicAddress | x | low | U:L2-danger-verb|V4-verb-read | A=verbs=send B=verb=retrieve | r | Description says it "Retrieves Blockchain Public Address associated with a mobile phone number" and returns an array with no resource created or modified. |
| BlockchainPublicAddress | DELETE | /blockchain-public-addresses/{id} | deleteBlockchainPublicAddress | x | low | U:L3-live-noun|V6-floor | A=nouns=access verb=unbind B=verb=unbind head=association | w | Description says it "Unbinds Blockchain Public Address to a mobile phone number" for the given bind id, a deletion whose end state (unbound) is stable under repetition. |
| ConsentManagement | PATCH | /consents/{consentId} | updateConsent | x | high | U:L2-danger-verb|V5-verb-write | A=verbs=expir B=verb=update | w | Description says it allows the consumer "to update the status of an existing Consent" identified by consentId, setting consentStatus to GRANTED or DENIED, a set operation on an existing resource. |
| DeviceDataVolume | DELETE | /subscriptions/{subscriptionId} | deleteDeviceDataVolumeSubscription | x | low | U:L2-danger-verb|V5-verb-write | A=verbs=notif,sent B=verb=delete | w | Per "deletes a specific data volume usage subscription... Once deleted, no more notifications will be sent," deleting only stops the consumer's own future notifications, an idempotent state removal with no effect on any other party. |
| DeviceDataVolume | POST | /retrieve | retrieveDataVolume | x | high | U:L2-danger-verb|V2-verb-consequential | A=verbs=execut B=verb=execute | r | retrieveDataVolume "retrieve[s] the estimated remaining data volume for a device," a query returning a value with no resource created. |
| DeviceLocation | POST | /retrieve | retrieveLocation | x | high | U:L2-danger-verb|V2-verb-consequential | A=verbs=execut B=verb=execute | r | retrieveLocation "retrieve[s] the area where a certain user device is localized," a query returning a location value with nothing created. |
| DeviceLocation | POST | /verify | verifyLocation | x | high | U:L5-floor|V3-party-object | A=verb=verify B=verb=verify head=location party=device | r | verifyLocation "verif[ies] whether the location of a device is within a requested area" and returns a verification result, a pure check. |
| DeviceReachabilityStatus | DELETE | /subscriptions/{subscriptionId} | deleteDeviceReachabilityStatusSubscription | x | low | U:L5-floor|V3-party-object | A=verb=delete B=verb=delete head=event party=device | w | deleteDeviceReachabilityStatusSubscription simply deletes "a given subscription by ID," stopping only the consumer's own future notifications with no third-party effect. |
| DeviceStatus | DELETE | /subscriptions/{subscriptionId} | deleteConnectedNetworkTypeSubscription | x | high | U:L3-live-noun|V3-party-object | A=nouns=network verb=delete B=verb=delete head=event party=device | w | Deletes the caller's own subscription (204/202 async), a delete-resource operation whose repetition converges to the same deleted state. |
| DeviceStatus | DELETE | /subscriptions/{subscriptionId} | deleteDeviceReachabilityStatusSubscription | x | low | U:L5-floor|V3-party-object | A=verb=delete B=verb=delete head=event party=device | w | description 'Delete a given subscription by ID' removes the caller's own subscription, an idempotent delete. |
| DeviceStatus | DELETE | /subscriptions/{subscriptionId} | deleteDeviceRoamingStatusSubscription | x | low | U:L5-floor|V3-party-object | A=verb=delete B=verb=delete head=event party=device | w | description 'Delete a given device-roaming-status subscription by ID' idempotently removes the caller's own subscription. |
| KnowYourCustomer | POST | /verify | verifyAge | x | method-only | U:L5-floor|V6-floor | A=verb=verify B=verb=verify head=threshold | r | "Verify that the age of the subscriber ... is equal to or greater than the specified age threshold" only returns a computed ageCheck value, changing nothing. |
| KnowYourCustomer | POST | /fill-in | KYC_Fill-in | x | high | U:L5-floor|V3-party-object | A=verb=providing B=verb=providing head=related party=customer | r | The summary describes 'Providing information related to a customer identity stored the account data bound to the customer's phone number', a read of Operator-held data with no write. |
| KnowYourCustomer | POST | /match | KYC_Match | x | method-only | U:L5-floor|V6-floor | A=verb=matching B=verb=matching head=identity | r | The operation 'verif[ies] matching of a number of attributes' against stored data and returns true/false/not_available per attribute without altering any record. |
| KnowYourCustomerFill-in | POST | /fill-in | kycFillin | x | high | U:L5-floor|V3-party-object | A=verb=providing B=verb=providing head=related party=customer | r | As the standalone Fill-in repo's endpoint, it lets a client 'request and receive the information for a particular user ... on file' with the Operator, purely retrieving stored attributes. |
| ModelAsAService | DELETE | /knowledge-bases/{knowledgeBaseId} | deleteKnowledgeBase | x | low | U:L2-danger-verb|V5-verb-write | A=verbs=irreversibl,permanent B=verb=delete | w | "Permanently deletes a knowledge base and its documents" with 204 No Content is an idempotent removal, since a repeat call finds it already gone. |
| ModelAsAService | DELETE | /knowledge-bases/{knowledgeBaseId}/documents/{documentId} | deleteDocument | x | low | U:L2-danger-verb|V5-verb-write | A=verbs=cannot be undone,irreversibl,permanent B=verb=delete | w | "Permanently removes a document from a knowledge base" returning 204 is an idempotent deletion of the identified sub-resource. |
| ModelAsAService | DELETE | /knowledge-bases/{knowledgeBaseId}/tools/{toolId} | deleteTool | x | low | U:L2-danger-verb|V5-verb-write | A=verbs=cannot be undone,irreversibl,permanent B=verb=delete | w | "Permanently removes a tool definition" (204) is an idempotent deletion, and the cross-API pruning of assistant toolIds it triggers is itself idempotent. |
| ModelAsAService | PUT | /assistants/{assistantId} | updateAssistant | x | low | U:L5-floor|V3-party-object | A=verb=update B=verb=update head=assistant party=assistant | w | updateAssistant 'is a partial update (not a full replacement)' where largeModelParameters and toolIds are each 'replaced as a whole' when supplied, an idempotent set operation. |
| ModelAsAService | DELETE | /assistants/{assistantId} | deleteAssistant | x | high | U:L2-danger-verb|V3-party-object | A=verbs=cannot be undone,deactivat,irreversibl,permanent B=verb=delete head=assistant party=assistant | w | "Permanently removes a QA assistant configuration" (204) is an idempotent deletion that cannot be undone but converges to the same deleted state on repeat. |
| MultiPointVPN | PATCH | /networks/{serviceId} | updateNetwork | x | high | U:L3-live-noun|V6-floor | A=nouns=network verb=to B=verb=to head=private | w | updateNetwork uses application/merge-patch+json against NetworkUpdate, a JSON-merge-patch set of guaranteeBandwidth/sla fields that is idempotent by construction. |
| MultiPointVPN | DELETE | /networks/{serviceId} | deleteNetwork | x | high | U:L3-live-noun|V3-party-object | A=nouns=network verb=delete B=verb=delete head=network party=network | w | "Network deletion request accepted. The deletion is processed asynchronously; the resource will be removed once complete" describes an idempotent removal despite the async 202. |
| MultiPointVPN | POST | /assessment | assessConnectionFeasibility | x | method-only | U:L5-floor|V6-floor | A=verb=assess B=verb=assess head=feasibility | r | The request body only carries hypothetical connection parameters and the response returns waitDays/sla/rent estimates with no network or resource created, matching the query-only-POST rule for r. |
| NumberRecycling | POST | /check | checkNumberRecycling | x | low | U:L4-lookup|V3-party-object | A=verb=check B=verb=check head=subscriber party=subscriber | r | Body is only a phoneNumber and specifiedDate query; the response is a boolean `phoneNumberRecycled` flag with no resource created or modified. |
| OTPValidation | POST | /validate-code | validateCode | x | method-only | U:L5-floor|V6-floor | A=verb=verify B=verb=verify head=received | w | Verifies the code for the given authenticationId; once validated the code is consumed (single-use, per MAX_OTP_CODES/expiry semantics) so the authenticationId's final state converges after one or more calls, with no effect reaching outside the API. |
| PopulationDensityData | POST | /retrieve | retrievePopulationDensity | x | high | U:L1-structural|V1-structural | A=structural=callbacks,sink B=structural=callbacks,sink | r | The info.description states this "operation creates no resource to read back"; the operationId is only used to correlate an async callback delivery of the same query's result, not a created resource. |
| QoSBooking | DELETE | /qos-bookings/{bookingId} | deleteBooking | x | low | U:L2-danger-verb|V6-floor | A=verbs=cancel,notif,releas,sent B=verb=this head=booking | w | "cancels and deletes a specific QoS booking ... and releases the resources related to that booking", a standard cancellation/delete of an existing resource. |
| QoSBooking | POST | /qos-bookings/retrieve | retrieveBookingByDevice | x | high | U:L2-danger-verb|V3-party-object | A=verbs=send,sent B=verb=retrieve head=booking party=device | r | "Querying for QoS Booking resource information details for a device"; body carries only a device identifier and the response is a read-only array. |
| QoSBooking | DELETE | /device-qos-bookings/{bookingId} | deleteBooking | x | low | U:L2-danger-verb|V5-verb-write | A=verbs=activat,notif,releas,terminat B=verb=delete | w | "Release resources related to a QoS Booking"; deletion is described with terminal status handling and no further effect once TERMINATED, an idempotent-style resource removal. |
| QoSBooking | POST | /retrieve-device-qos-bookings | retrieveBookingByDevice | x | high | U:L2-danger-verb|V3-party-object | A=verbs=send,sent B=verb=gets head=booking party=device | r | "Querying for QoS Booking resource information details for a device"; body is only a device identifier and the response is a read-only array of existing bookings. |
| RegionDeviceCount | POST | /count | count | x | high | U:L1-structural|V1-structural | A=structural=callbacks,sink B=structural=callbacks,sink | r | The /count operation only computes and returns "the number of devices in the specified area during a certain time interval," whether delivered synchronously or via the caller's own sink, without altering any resource. |
| SimSwap | POST | /retrieve-age-band | retrieveSimSwapAgeBand | x | low | U:L2-danger-verb|V4-verb-read | A=verbs=sent B=verb=retrieve | r | retrieve-age-band "returns a standardized simSwapAgeBand value" as a computed read, explicitly noted to not return or alter any state. |
| SponsoredData | POST | /campaign/management | manageCampaign | x | high | U:L2-danger-verb|V6-floor | A=verbs=halt B=verb=campaign head=management | w | manageCampaign only toggles the campaign between "PAUSE to temporarily halt new sponsorships" and "RESUME to reactivate the campaign," a status-set operation with the same end state however often it is applied. |
| Tenure | POST | /check-tenure | checkTenure | x | high | U:L3-live-noun|V6-floor | A=nouns=network verb=the B=verb=the head=api | r | checkTenure only verifies "a specified length of tenure ... to establish a level of trust," returning a boolean with nothing created or changed. |
| VerifiedCaller | PUT | /registrations/{registrationId} | updateRegistration | x | high | U:L1-structural|V1-structural | A=structural=sink B=structural=sink | w | updateRegistration replaces a "Request object to create or update (replace) a brand registration," a create-or-replace write with the same end state regardless of repetition. |

## Negative controls

- ClickToDial DELETE /calls/{callId} `terminateCall`: rule class = x, gt class = x — PASS
- WebRTC PUT /sessions/{mediaSessionId}/status `updateSessionStatus`: rule class = (not found in run output), gt class = x — FAIL
