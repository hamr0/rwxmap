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
- agree: 96
- WRONG-LOOSENING: 0
- over-tight: 56

By method:
  - POST: {"agree":40,"over-tight":31}
  - GET: {"agree":50}
  - PUT: {"over-tight":5}
  - DELETE: {"over-tight":18,"agree":5}
  - PATCH: {"over-tight":2,"agree":1}

By confidence:
  - high: {"agree":96,"over-tight":56}

## Wrong loosenings

(none)

## Over-tightenings

| repo | method | path | operationId | rule class | confidence | rule_id | evidence | gt_class | gt reason |
|---|---|---|---|---|---|---|---|---|---|
| ApplicationEndpointRegistration | PUT | /application-endpoint-lists/{applicationEndpointListId} | updateApplicationEndpoint | x | high | L2-danger-verb | verbs=releas | w | Description says it will "Update registered application Endpoint information" for the identified list, a set/replace operation via PUT with no external notification. |
| ApplicationEndpointRegistration | DELETE | /application-endpoint-lists/{applicationEndpointListId} | deregisterApplicationEndpoint | x | high | L2-danger-verb | verbs=releas | w | Description says it will "Deregister an application's Endpoint from the edge cloud zone", a resource deletion whose repeated effect (endpoint gone) is unchanged. |
| BlockchainPublicAddress | POST | /blockchain-public-addresses/retrieve-blockchains | retrieveBlockchainPublicAddress | x | high | L2-danger-verb | verbs=block,pay,releas,send,sent | r | Description says it "Retrieves Blockchain Public Address associated with a mobile phone number" and returns an array with no resource created or modified. |
| BlockchainPublicAddress | DELETE | /blockchain-public-addresses/{id} | deleteBlockchainPublicAddress | x | high | L2-danger-verb | verbs=block,pay,releas,send,sent | w | Description says it "Unbinds Blockchain Public Address to a mobile phone number" for the given bind id, a deletion whose end state (unbound) is stable under repetition. |
| ConnectivityInsights | DELETE | /subscriptions/{subscriptionId} | deleteSubscription | x | high | L2-danger-verb | verbs=invok,notif,releas | w | Summary is "Operation to delete a subscription"; deleting the same subscription id again converges to the same absent-subscription state. |
| ConnectivityInsights | POST | /check-network-quality | checkNetworkQuality | x | high | L2-danger-verb | verbs=invok,notif,releas | r | Summary is "Check the network quality", a computed read of network conditions for the identified device/session with no created or modified resource. |
| ConsentManagement | PATCH | /consents/{consentId} | updateConsent | x | high | L2-danger-verb | verbs=expir,invok,releas,revok | w | Description says it allows the consumer "to update the status of an existing Consent" identified by consentId, setting consentStatus to GRANTED or DENIED, a set operation on an existing resource. |
| ConsentManagement | POST | /consents/retrieve-info | retrieveConsentInfo | x | high | L2-danger-verb | verbs=expir,invok,releas,revok | r | Description says it allows the consumer "to retrieve information about the Consent(s) for a given User, scope(s) and Purpose", a read-only lookup returning an array (possibly empty) with no resource created. |
| DedicatedNetworks | POST | /retrieve-service-areas | retrieveNetworkServiceAreas | x | high | L2-danger-verb | verbs=releas,reserv | r | retrieveNetworkServiceAreas is a POST search whose body is only filter criteria (location, area, name, profile) and whose response is a list of matching service areas, no resource created. |
| DeviceDataVolume | DELETE | /subscriptions/{subscriptionId} | deleteDeviceDataVolumeSubscription | x | high | L2-danger-verb | verbs=expir,invok,notif,releas,send,sent,start,stop,trigger | w | Per "deletes a specific data volume usage subscription... Once deleted, no more notifications will be sent," deleting only stops the consumer's own future notifications, an idempotent state removal with no effect on any other party. |
| DeviceDataVolume | POST | /retrieve | retrieveDataVolume | x | high | L2-danger-verb | verbs=execut,invok,releas | r | retrieveDataVolume "retrieve[s] the estimated remaining data volume for a device," a query returning a value with no resource created. |
| DeviceDataVolume | POST | /check | checkDataVolume | x | high | L2-danger-verb | verbs=invok,releas | r | checkDataVolume checks "if the remaining data allowance... is above a specified threshold" and returns a boolean-style result with no state change. |
| DeviceLocation | DELETE | /subscriptions/{subscriptionId} | deleteGeofencingSubscription | x | high | L2-danger-verb | verbs=expir,invok,notif,releas,send,sent,start,stop,trigger | w | deleteGeofencingSubscription simply deletes "a given Geofencing subscription," ending only the consumer's own future notifications with no effect on any other party. |
| DeviceLocation | POST | /retrieve | retrieveLocation | x | high | L2-danger-verb | verbs=deliver,execut,invok,releas,send,sent,trigger | r | retrieveLocation "retrieve[s] the area where a certain user device is localized," a query returning a location value with nothing created. |
| DeviceLocation | POST | /verify | verifyLocation | x | high | L2-danger-verb | verbs=deliver,invok,releas,sent,trigger | r | verifyLocation "verif[ies] whether the location of a device is within a requested area" and returns a verification result, a pure check. |
| DeviceReachabilityStatus | DELETE | /subscriptions/{subscriptionId} | deleteDeviceReachabilityStatusSubscription | x | high | L2-danger-verb | verbs=disconnect,expir,invok,notif,releas,send,sent,start,stop,trigger | w | deleteDeviceReachabilityStatusSubscription simply deletes "a given subscription by ID," stopping only the consumer's own future notifications with no third-party effect. |
| DeviceReachabilityStatus | POST | /retrieve | getReachabilityStatus | x | high | L2-danger-verb | verbs=invok,releas | r | getReachabilityStatus "get[s] current connectivity status information synchronously," a pure query returning reachability data. |
| DeviceStatus | DELETE | /subscriptions/{subscriptionId} | deleteConnectedNetworkTypeSubscription | x | high | L2-danger-verb | verbs=deliver,expir,invok,notif,releas,send,sent,stop,trigger | w | Deletes the caller's own subscription (204/202 async), a delete-resource operation whose repetition converges to the same deleted state. |
| DeviceStatus | POST | /retrieve | getConnectedNetworkType | x | high | L2-danger-verb | verbs=invok,releas | r | description 'Get the connected network type to which the user device is connected' is a query with no requestBody-driven state change and a value-only 200 response. |
| DeviceStatus | DELETE | /subscriptions/{subscriptionId} | deleteDeviceReachabilityStatusSubscription | x | high | L2-danger-verb | verbs=disconnect,expir,invok,notif,releas,send,sent,stop,trigger | w | description 'Delete a given subscription by ID' removes the caller's own subscription, an idempotent delete. |
| DeviceStatus | POST | /retrieve | getReachabilityStatus | x | high | L2-danger-verb | verbs=invok,releas | r | description 'Get the current reachability status information' synchronously returns a value with no state change. |
| DeviceStatus | DELETE | /subscriptions/{subscriptionId} | deleteDeviceRoamingStatusSubscription | x | high | L2-danger-verb | verbs=expir,invok,notif,releas,send,sent,stop,trigger | w | description 'Delete a given device-roaming-status subscription by ID' idempotently removes the caller's own subscription. |
| DeviceStatus | POST | /retrieve | getRoamingStatus | x | high | L2-danger-verb | verbs=charg,deliver,invok,releas | r | description 'Get the current roaming status and the country information' synchronously returns data without altering state. |
| DeviceVisitLocation | POST | /retrieve | retrieveDeviceVisitLocation | x | high | L2-danger-verb | verbs=invok,pay,start,transfer | r | description 'Retrieves the latest visit locations of a device within a given time window' is a pure query returning a geoCodeList. |
| KnowYourCustomer | POST | /verify | verifyAge | x | high | L2-danger-verb | verbs=activat,block,invok,releas | r | "Verify that the age of the subscriber ... is equal to or greater than the specified age threshold" only returns a computed ageCheck value, changing nothing. |
| KnowYourCustomer | POST | /fill-in | KYC_Fill-in | x | high | L2-danger-verb | verbs=invok,releas | r | The summary describes 'Providing information related to a customer identity stored the account data bound to the customer's phone number', a read of Operator-held data with no write. |
| KnowYourCustomer | POST | /match | KYC_Match | x | high | L2-danger-verb | verbs=invok,releas | r | The operation 'verif[ies] matching of a number of attributes' against stored data and returns true/false/not_available per attribute without altering any record. |
| KnowYourCustomerFill-in | POST | /fill-in | kycFillin | x | high | L2-danger-verb | verbs=ban,invok,releas | r | As the standalone Fill-in repo's endpoint, it lets a client 'request and receive the information for a particular user ... on file' with the Operator, purely retrieving stored attributes. |
| ModelAsAService | PUT | /knowledge-bases/{knowledgeBaseId} | updateKnowledgeBase | x | high | L2-danger-verb | verbs=block,initiat,invok,releas,send | w | Despite the PUT verb, the description states this 'is a partial update (not a full replacement)' that replaces the stored name/description fields, an idempotent set operation. |
| ModelAsAService | DELETE | /knowledge-bases/{knowledgeBaseId} | deleteKnowledgeBase | x | high | L2-danger-verb | verbs=block,initiat,invok,irreversibl,permanent,releas,send | w | "Permanently deletes a knowledge base and its documents" with 204 No Content is an idempotent removal, since a repeat call finds it already gone. |
| ModelAsAService | DELETE | /knowledge-bases/{knowledgeBaseId}/documents/{documentId} | deleteDocument | x | high | L2-danger-verb | verbs=block,cannot be undone,initiat,invok,irreversibl,permanent,releas,send | w | "Permanently removes a document from a knowledge base" returning 204 is an idempotent deletion of the identified sub-resource. |
| ModelAsAService | PUT | /knowledge-bases/{knowledgeBaseId}/tools/{toolId} | updateTool | x | high | L2-danger-verb | verbs=block,initiat,invok,releas,send | w | The operation is explicitly 'a partial update (not a full replacement)' of the tool definition, with headers replaced-as-a-whole or preserved, an idempotent set. |
| ModelAsAService | DELETE | /knowledge-bases/{knowledgeBaseId}/tools/{toolId} | deleteTool | x | high | L2-danger-verb | verbs=block,cannot be undone,initiat,invok,irreversibl,permanent,releas,send | w | "Permanently removes a tool definition" (204) is an idempotent deletion, and the cross-API pruning of assistant toolIds it triggers is itself idempotent. |
| ModelAsAService | PUT | /assistants/{assistantId} | updateAssistant | x | high | L2-danger-verb | verbs=releas | w | updateAssistant 'is a partial update (not a full replacement)' where largeModelParameters and toolIds are each 'replaced as a whole' when supplied, an idempotent set operation. |
| ModelAsAService | DELETE | /assistants/{assistantId} | deleteAssistant | x | high | L2-danger-verb | verbs=cannot be undone,deactivat,irreversibl,permanent,releas | w | "Permanently removes a QA assistant configuration" (204) is an idempotent deletion that cannot be undone but converges to the same deleted state on repeat. |
| MultiPointVPN | PATCH | /networks/{serviceId} | updateNetwork | x | high | L2-danger-verb | verbs=deliver,expir,invok,releas,terminat | w | updateNetwork uses application/merge-patch+json against NetworkUpdate, a JSON-merge-patch set of guaranteeBandwidth/sla fields that is idempotent by construction. |
| MultiPointVPN | DELETE | /networks/{serviceId} | deleteNetwork | x | high | L2-danger-verb | verbs=deliver,expir,invok,releas,terminat | w | "Network deletion request accepted. The deletion is processed asynchronously; the resource will be removed once complete" describes an idempotent removal despite the async 202. |
| MultiPointVPN | POST | /assessment | assessConnectionFeasibility | x | high | L2-danger-verb | verbs=deliver,expir,invok,releas,terminat | r | The request body only carries hypothetical connection parameters and the response returns waitDays/sla/rent estimates with no network or resource created, matching the query-only-POST rule for r. |
| NumberRecycling | POST | /check | checkNumberRecycling | x | high | L2-danger-verb | verbs=cancel,deliver,invok,releas,send,stop | r | Body is only a phoneNumber and specifiedDate query; the response is a boolean `phoneNumberRecycled` flag with no resource created or modified. |
| OTPValidation | POST | /validate-code | validateCode | x | high | L2-danger-verb | verbs=releas,send | w | Verifies the code for the given authenticationId; once validated the code is consumed (single-use, per MAX_OTP_CODES/expiry semantics) so the authenticationId's final state converges after one or more calls, with no effect reaching outside the API. |
| PopulationDensityData | POST | /retrieve | retrievePopulationDensity | x | high | L1-structural | structural=callbacks,sink | r | The info.description states this "operation creates no resource to read back"; the operationId is only used to correlate an async callback delivery of the same query's result, not a created resource. |
| QoSBooking | DELETE | /qos-bookings/{bookingId} | deleteBooking | x | high | L2-danger-verb | verbs=activat,book,cancel,expir,invok,notif,releas,sent,start,terminat | w | "cancels and deletes a specific QoS booking ... and releases the resources related to that booking", a standard cancellation/delete of an existing resource. |
| QoSBooking | POST | /qos-bookings/retrieve | retrieveBookingByDevice | x | high | L2-danger-verb | verbs=activat,book,expir,invok,notif,releas,send,sent,start,terminat | r | "Querying for QoS Booking resource information details for a device"; body carries only a device identifier and the response is a read-only array. |
| QoSBooking | DELETE | /device-qos-bookings/{bookingId} | deleteBooking | x | high | L2-danger-verb | verbs=activat,book,expir,invok,notif,releas,sent,start,terminat | w | "Release resources related to a QoS Booking"; deletion is described with terminal status handling and no further effect once TERMINATED, an idempotent-style resource removal. |
| QoSBooking | POST | /retrieve-device-qos-bookings | retrieveBookingByDevice | x | high | L2-danger-verb | verbs=book,expir,invok,notif,releas,send,sent,start,terminat | r | "Querying for QoS Booking resource information details for a device"; body is only a device identifier and the response is a read-only array of existing bookings. |
| RegionDeviceCount | POST | /count | count | x | high | L1-structural | structural=callbacks,sink | r | The /count operation only computes and returns "the number of devices in the specified area during a certain time interval," whether delivered synchronously or via the caller's own sink, without altering any resource. |
| SimSwap | DELETE | /subscriptions/{subscriptionId} | deleteSubscription | x | high | L2-danger-verb | verbs=deactivat,expir,invok,notif,releas,send,sent,stop,trigger | w | deleteSubscription just deletes "a given event subscription," the caller's own notification subscription, matching ordinary resource deletion. |
| SimSwap | POST | /retrieve-date | retrieveSimSwapDate | x | high | L2-danger-verb | verbs=activat,ban,invok,releas,sent | r | retrieve-date only "provides timestamp of latest SIM swap, if any, for a given phone number" with no state modified. |
| SimSwap | POST | /check | checkSimSwap | x | high | L2-danger-verb | verbs=activat,ban,invok,releas,sent | r | check only reports "whether a SIM swap has been performed during a past period" as a boolean, with no side effects. |
| SimSwap | POST | /retrieve-age-band | retrieveSimSwapAgeBand | x | high | L2-danger-verb | verbs=activat,ban,invok,releas,sent | r | retrieve-age-band "returns a standardized simSwapAgeBand value" as a computed read, explicitly noted to not return or alter any state. |
| SponsoredData | POST | /campaign/management | manageCampaign | x | high | L2-danger-verb | verbs=activat,expir,halt,initiat,notif,releas,revok,start,terminat | w | manageCampaign only toggles the campaign between "PAUSE to temporarily halt new sponsorships" and "RESUME to reactivate the campaign," a status-set operation with the same end state however often it is applied. |
| Tenure | POST | /check-tenure | checkTenure | x | high | L2-danger-verb | verbs=invok,pay,releas | r | checkTenure only verifies "a specified length of tenure ... to establish a level of trust," returning a boolean with nothing created or changed. |
| VerifiedCaller | DELETE | /registrations/{registrationId} | deleteRegistration | x | high | L2-danger-verb | verbs=expir,notif,releas,sent | w | deleteRegistration "deletes an existing brand registration from the service platform," the caller's own record, matching ordinary resource deletion. |
| VerifiedCaller | PUT | /registrations/{registrationId} | updateRegistration | x | high | L1-structural | structural=sink | w | updateRegistration replaces a "Request object to create or update (replace) a brand registration," a create-or-replace write with the same end state regardless of repetition. |
| eSimRemoteManagement | POST | /profile/result/query | profileResultQuery | x | high | L2-danger-verb | verbs=activat,deactivat,execut,permanent,releas,trigger | r | The POST body only carries a taskId to look up ("Query the result of an asynchronous profile operation ... using the task ID") and the response is a status value with no resource created or modified. |
| eSimRemoteManagement | POST | /profile/downloaded-list | profileList | x | high | L2-danger-verb | verbs=activat,deactivat,execut,permanent,releas,trigger | r | The POST body is only a query filter (eId) and the response is "a list of all eSIM profiles currently downloaded on the device," with no state change. |

## Negative controls

- ClickToDial DELETE /calls/{callId} `terminateCall`: rule class = x, gt class = x — PASS
- WebRTC PUT /sessions/{mediaSessionId}/status `updateSessionStatus`: rule class = (not found in run output), gt class = x — FAIL
