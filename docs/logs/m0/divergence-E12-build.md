# M0 divergence report

## Counts

- rows joined: 140
- unjoined (in run, not in ground truth): 0
- unjoined (in ground truth, not in run): 152
  - registerApplicationEndpoints
  - getAllRegisteredApplicationEndpoints
  - getApplicationEndpointsById
  - updateApplicationEndpoint
  - deregisterApplicationEndpoint
  - createBlockchainPublicAddressValidationNonce
  - retrieveBlockchainPublicAddress
  - bindBlockchainPublicAddress
  - deleteBlockchainPublicAddress
  - postServiceCapability
  - createCall
  - getCall
  - terminateCall
  - getRecording
  - createSubscription
  - getSubscriptionList
  - getSubscription
  - deleteSubscription
  - checkNetworkQuality
  - createConsent
  - updateConsent
  - retrieveConsentInfo
  - listAccesses
  - createAccess
  - readAccess
  - deleteAccess
  - listDevices
  - addDevicesToAccess
  - removeDevicesFromAccess
  - retrieveNetworkServiceAreas
  - readNetworkServiceArea
  - readNetworkProfiles
  - readNetworkProfile
  - listNetworks
  - createNetwork
  - readNetwork
  - deleteNetwork
  - createDeviceDataVolumeSubscription
  - retrieveDeviceDataVolumeSubscriptionList
  - retrieveDeviceDataVolumeSubscription
  - deleteDeviceDataVolumeSubscription
  - retrieveDataVolume
  - checkDataVolume
  - createGeofencingSubscription
  - retrieveGeofencingSubscriptionList
  - retrieveGeofencingSubscription
  - deleteGeofencingSubscription
  - retrieveLocation
  - verifyLocation
  - createDeviceReachabilityStatusSubscription
  - retrieveDeviceReachabilityStatusSubscriptionList
  - retrieveDeviceReachabilityStatusSubscription
  - deleteDeviceReachabilityStatusSubscription
  - getReachabilityStatus
  - createConnectedNetworkTypeSubscription
  - retrieveConnectedNetworkTypeSubscriptionList
  - retrieveConnectedNetworkTypeSubscription
  - deleteConnectedNetworkTypeSubscription
  - getConnectedNetworkType
  - createDeviceReachabilityStatusSubscription
  - retrieveDeviceReachabilityStatusSubscriptionList
  - retrieveDeviceReachabilityStatusSubscription
  - deleteDeviceReachabilityStatusSubscription
  - getReachabilityStatus
  - createDeviceRoamingStatusSubscription
  - retrieveDeviceRoamingStatusSubscriptionList
  - retrieveDeviceRoamingStatusSubscription
  - deleteDeviceRoamingStatusSubscription
  - getRoamingStatus
  - retrieveDeviceVisitLocation
  - calculateEnergyConsumption
  - calculateCarbonFootprint
  - listDevices
  - getDevice
  - updateDevice
  - deleteDevice
  - performDeviceAction
  - getDeviceNetworkHealth
  - activatePowerSaving
  - getPowerSaving
  - verifyAge
  - KYC_Fill-in
  - KYC_Match
  - kycFillin
  - createKnowledgeBase
  - listKnowledgeBases
  - getKnowledgeBase
  - updateKnowledgeBase
  - deleteKnowledgeBase
  - uploadDocument
  - getDocument
  - deleteDocument
  - createTool
  - listTools
  - getTool
  - updateTool
  - deleteTool
  - callTool
  - createAssistant
  - listAssistants
  - getAssistant
  - updateAssistant
  - deleteAssistant
  - queryAssistant
  - createNetwork
  - updateNetwork
  - getNetwork
  - deleteNetwork
  - assessConnectionFeasibility
  - getHealthScores
  - getTrafficAnalysis
  - checkNumberRecycling
  - sendCode
  - validateCode
  - retrievePopulationDensity
  - createBooking
  - getBookingById
  - deleteBooking
  - assignDevices
  - getDevicesByBookingId
  - releaseDevices
  - retrieveBookingByDevice
  - createBooking
  - getBookingById
  - deleteBooking
  - retrieveBookingByDevice
  - count
  - createSimSwapSubscription
  - retrieveSubscriptionList
  - retrieveSubscription
  - deleteSubscription
  - retrieveSimSwapDate
  - checkSimSwap
  - retrieveSimSwapAgeBand
  - startSponsorship
  - getSessionStatus
  - revokeSponsorship
  - getCampaignStatus
  - getActiveSponsorships
  - configureAlerts
  - manageCampaign
  - checkTenure
  - createRegistration
  - readRegistrations
  - readRegistration
  - deleteRegistration
  - updateRegistration
  - createPreAnnouncement
  - profileResultQuery
  - profileOperation
  - profileList
  - profileDownload
- agree: 112
- WRONG-LOOSENING: 0
- over-tight: 28

By method:
  - POST: {"agree":54,"over-tight":13}
  - PATCH: {"over-tight":4,"agree":2}
  - GET: {"agree":46}
  - DELETE: {"agree":8,"over-tight":10}
  - PUT: {"agree":2,"over-tight":1}

By confidence:
  - low: {"agree":21,"over-tight":1}
  - method-only: {"agree":15,"over-tight":12}
  - high: {"agree":76,"over-tight":15}

## Wrong loosenings

(none)

## Over-tightenings

| repo | method | path | operationId | rule class | confidence | rule_id | evidence | gt_class | gt reason |
|---|---|---|---|---|---|---|---|---|---|
| ApplicationProfiles | PATCH | /application-profiles/{applicationProfileId} | updateApplicationProfile | x | method-only | L5-floor | verb=update | w | Description states it updates "the complete set of network quality thresholds for an application with the new set of thresholds", i.e. a full replace of the identified profile's thresholds. |
| CarrierBillingCheckOut | POST | /payments/{paymentId}/cancel | cancelPayment | x | high | L2-danger-verb | verbs=cancel,pay,reserv | w | Description says it will "Cancel a reservation of a given payment" before it is charged, which converges the reservation to a cancelled end state and does not move money or reach a third party. |
| ConsentInfo | POST | /retrieve | retrieveStatus | x | method-only | L5-floor | verb=create | r | Description says it will "Create a request to retrieve the validity status of the API Consumer data processing for a given User, scope(s) and Purpose", i.e. despite the verb "create" in the summary it only reads and returns existing consent status, optionally with a one-off captureUrl, not a subscription. |
| EdgeApplicationManagement | DELETE | /app-instances/{appInstanceId} | deleteAppInstance | x | high | L2-danger-verb | verbs=terminat | w | description 'Terminate a running instance of an application within an Edge Cloud Zone' is an idempotent removal of the caller's own instance. |
| EdgeApplicationManagement | DELETE | /deployments/{appDeploymentId} | deleteAppDeployment | x | high | L2-danger-verb | verbs=terminat | w | description 'Delete a deployment terminating all related instances of an application' idempotently tears down the caller's own deployment. |
| EdgeApplicationManagement | PATCH | /deployments/{appDeploymentId} | updateAppDeployment | x | method-only | L5-floor | verb=update | w | description specifies JSON Merge Patch semantics where 'Only the fields provided in the request body will be updated,' a repeatable set-style update. |
| IoTSIMFraudPrevention | DELETE | /subscriptions/{subscriptionId} | deleteSubscription | x | high | L2-danger-verb | verbs=notif,sent | w | "Delete an existing subscription. After deletion, no further notifications will be sent" is a delete whose repetition leaves the subscription gone either way. |
| IoTSIMFraudPrevention | POST | /query | query | x | method-only | L5-floor | verb=iot | r | The request body only carries a device identifier and queryType, and the response only reports current bind or area-limit status with no resource created or modified. |
| KnowYourCustomerAgeVerification | POST | /verify | verifyAge | x | method-only | L5-floor | verb=verify | r | As the standalone KnowYourCustomerAgeVerification repo's copy of /verify, it 'checks if the age of the subscriber is older than the age threshold' and returns ageCheck, a pure lookup with no side effects. |
| KnowYourCustomerMatch | POST | /match | kycMatch | x | method-only | L5-floor | verb=matching | r | As the standalone Match repo's endpoint, it compares SP-held attributes against the Operator's verified KYC records and returns per-attribute match results, never writing data. |
| MostFrequentLocation | POST | /verify | verifyFrequentLocation | x | method-only | L5-floor | verb=verify | r | The operation 'returns a score representing how frequently the device was connected to antennas' whose coverage matches the requested area, a computed read with no state change. |
| NetworkAccessManagement | DELETE | /reboot-requests/{rebootRequestId} | deleteRebootRequest | x | high | L2-danger-verb | verbs=cancel,reboot | w | Deletes the Reboot Request, "cancelling the scheduled reboot if it has not yet occurred", a standard idempotent delete of a resource. |
| NetworkAccessManagement | POST | /trust-domains | createTrustDomain | x | method-only | L5-floor | verb=create | w | Creation is guarded by name uniqueness ("409 ALREADY_EXISTS ... if a Trust Domain with the same name already exists"), so repeated identical requests converge on the same single domain rather than each creating a distinct resource, and the config is applied only to the caller's own network access devices. |
| NetworkAccessManagement | PATCH | /trust-domains/{trustDomainId} | updateTrustDomain | x | method-only | L5-floor | verb=update | w | Updates the Trust Domain by ID with full-replacement semantics for accessDetails, so repeating the same PATCH body leaves the domain in the same state. |
| NetworkAccessManagement | PATCH | /trust-domains/{trustDomainId}/devices/{deviceId} | updateTrustDomainDevice | x | method-only | L5-floor | verb=update | w | Only included fields are updated, with `bootstrappingInfo`/`deviceCredential` replaced wholesale when present, making repeated identical PATCHes converge on the same device state. |
| NetworkSliceBooking | DELETE | /slices/{sliceId} | deleteSlice | x | high | L2-danger-verb | verbs=releas | w | The spec states explicitly "The deletion operation is idempotent, meaning that if the slice is already deleted, the API consumer will receive a response with code 204". |
| NumberVerification | POST | /verify | phoneNumberVerify | x | method-only | L5-floor | verb=verify | r | Compares the supplied phone number against the one tied to the access token and returns true/false, described purely as a verification check with no state change. |
| OptimalEdgeDiscovery | POST | /retrieve-optimal-edge-cloud-zones | discoverOptimalEdge | x | method-only | L5-floor | verb=discover | r | Request body is only an applicationProfileId plus optional device/region identifiers, and the response is a ranked list of zones with no resource created by the call. |
| PredictiveConnectivityData | POST | /retrieve | retrieveConnectivity | x | high | L1-structural | structural=callbacks,sink | r | Retrieves a connectivity estimation for a requested area/service level/time window; the request is a query and the response is computed data with no resource created. |
| QualityOnDemand | POST | /retrieve-qos-profiles | retrieveQosProfiles | x | high | L2-danger-verb | verbs=send,sent,transfer | r | The operation only returns a filtered list of QoS Profiles ("Returns all QoS Profiles that match the given criteria") and does not create or modify any resource. |
| QualityOnDemand | DELETE | /qos-assignments/{assignmentId} | revokeQosAssignment | x | high | L2-danger-verb | verbs=notif,revok | w | The operation "revokes the assignment of a QoS profile to a device" by deleting the existing assignment record, matching the ordinary resource-deletion pattern. |
| QualityOnDemand | POST | /retrieve-qos-assignment | getQosAssignmentByDevice | x | high | L2-danger-verb | verbs=invok,send,sent,transfer | r | This POST "returns the details of the record for the assignment of a QoS profile to a device" and is explicitly a query substituting for GET to avoid exposing device identifiers, not a state change. |
| QualityOnDemand | DELETE | /sessions/{sessionId} | deleteSession | x | high | L2-danger-verb | verbs=notif,releas | w | deleteSession simply releases "resources related to QoS session," the canonical resource-deletion case. |
| QualityOnDemand | POST | /retrieve-sessions | retrieveSessionsByDevice | x | high | L2-danger-verb | verbs=send,sent,transfer | r | retrieveSessionsByDevice is "querying for QoS session resource information details for a device" and returns an empty array if none are found, with no resource created. |
| SessionInsights | DELETE | /sessions/{sessionId} | deleteSession | x | high | L2-danger-verb | verbs=notif,stop | w | Deleting the session merely "stops all notifications and metric reporting for the session," an ordinary teardown of the caller's own monitoring resource with no live network reconfiguration described. |
| WebRTC | DELETE | /subscriptions/{subscriptionId} | deleteNotificationChannelSubscription | x | high | L2-danger-verb | verbs=notif,stop | w | Deleting the requester's own subscription is idempotent and the subscription-ended event it emits goes to the requester's own sink, not to a third party; ruled w by the orchestrator, consistent with the other subscription deletions in the set. |
| WebRTC | PUT | /sessions/{registrationId} | updateRegistrationById | x | high | L2-danger-verb | verbs=expir | w | The refresh logic recomputes and persists "newExpire" from the operator's TTL policy using the request receipt time each call, a set-style update to the caller's own registration expiry with no third-party effect described. |
| WebRTC | DELETE | /sessions/{registrationId} | deleteRegistrationById | x | low | L3-live-noun | nouns=session verb=delete | w | Deleting "frees any resource and invalidates future actions that involves this registration" — an idempotent removal of the caller's own registration resource with no external effect stated for this operation. |

## Negative controls

- ClickToDial DELETE /calls/{callId} `terminateCall`: rule class = (not found in run output), gt class = x — FAIL
- WebRTC PUT /sessions/{mediaSessionId}/status `updateSessionStatus`: rule class = x, gt class = x — PASS
