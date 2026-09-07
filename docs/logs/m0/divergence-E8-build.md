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
- agree: 123
- WRONG-LOOSENING: 0
- over-tight: 17

By method:
  - POST: {"agree":60,"over-tight":7}
  - PATCH: {"over-tight":4,"agree":2}
  - GET: {"agree":46}
  - DELETE: {"agree":13,"over-tight":5}
  - PUT: {"agree":2,"over-tight":1}

By confidence:
  - low: {"agree":33,"over-tight":4}
  - high: {"agree":70,"over-tight":7}
  - method-only: {"over-tight":6,"agree":20}

## Wrong loosenings

(none)

## Over-tightenings

| repo | method | path | operationId | rule class | confidence | rule_id | evidence | gt_class | gt reason |
|---|---|---|---|---|---|---|---|---|---|
| ApplicationProfiles | PATCH | /application-profiles/{applicationProfileId} | updateApplicationProfile | x | method-only | V5-floor | verb=update | w | Description states it updates "the complete set of network quality thresholds for an application with the new set of thresholds", i.e. a full replace of the identified profile's thresholds. |
| CarrierBillingCheckOut | POST | /payments/{paymentId}/cancel | cancelPayment | x | low | V3-live-object | verb=cancel nouns=payment | w | Description says it will "Cancel a reservation of a given payment" before it is charged, which converges the reservation to a cancelled end state and does not move money or reach a third party. |
| ConsentInfo | POST | /retrieve | retrieveStatus | x | high | V2-verb-x | verb=create | r | Description says it will "Create a request to retrieve the validity status of the API Consumer data processing for a given User, scope(s) and Purpose", i.e. despite the verb "create" in the summary it only reads and returns existing consent status, optionally with a one-off captureUrl, not a subscription. |
| EdgeApplicationManagement | PATCH | /deployments/{appDeploymentId} | updateAppDeployment | x | method-only | V5-floor | verb=update | w | description specifies JSON Merge Patch semantics where 'Only the fields provided in the request body will be updated,' a repeatable set-style update. |
| IoTSIMFraudPrevention | POST | /query | query | x | method-only | V5-floor | verb=iot | r | The request body only carries a device identifier and queryType, and the response only reports current bind or area-limit status with no resource created or modified. |
| KnowYourCustomerMatch | POST | /match | kycMatch | x | method-only | V5-floor | verb=matching | r | As the standalone Match repo's endpoint, it compares SP-held attributes against the Operator's verified KYC records and returns per-attribute match results, never writing data. |
| NetworkAccessManagement | POST | /trust-domains | createTrustDomain | x | high | V2-verb-x | verb=create | w | Creation is guarded by name uniqueness ("409 ALREADY_EXISTS ... if a Trust Domain with the same name already exists"), so repeated identical requests converge on the same single domain rather than each creating a distinct resource, and the config is applied only to the caller's own network access devices. |
| NetworkAccessManagement | PATCH | /trust-domains/{trustDomainId} | updateTrustDomain | x | method-only | V5-floor | verb=update | w | Updates the Trust Domain by ID with full-replacement semantics for accessDetails, so repeating the same PATCH body leaves the domain in the same state. |
| NetworkAccessManagement | PATCH | /trust-domains/{trustDomainId}/devices/{deviceId} | updateTrustDomainDevice | x | low | V3-live-object | verb=update nouns=device | w | Only included fields are updated, with `bootstrappingInfo`/`deviceCredential` replaced wholesale when present, making repeated identical PATCHes converge on the same device state. |
| NetworkAccessManagement | DELETE | /trust-domains/{trustDomainId}/devices/{deviceId} | deleteTrustDomainDevice | x | low | V3-live-object | verb=remove nouns=device | w | Deregisters and removes the device from the specified Trust Domain, an idempotent delete of the registration resource. |
| NetworkSliceBooking | DELETE | /slices/{sliceId} | deleteSlice | x | high | V3-live-object | verb=delete nouns=slice | w | The spec states explicitly "The deletion operation is idempotent, meaning that if the slice is already deleted, the API consumer will receive a response with code 204". |
| OptimalEdgeDiscovery | POST | /retrieve-optimal-edge-cloud-zones | discoverOptimalEdge | x | method-only | V5-floor | verb=discover | r | Request body is only an applicationProfileId plus optional device/region identifiers, and the response is a ranked list of zones with no resource created by the call. |
| PredictiveConnectivityData | POST | /retrieve | retrieveConnectivity | x | high | V1-structural | structural=callbacks,sink | r | Retrieves a connectivity estimation for a requested area/service level/time window; the request is a query and the response is computed data with no resource created. |
| QualityOnDemand | DELETE | /sessions/{sessionId} | deleteSession | x | high | V3-live-object | verb=delete nouns=session | w | deleteSession simply releases "resources related to QoS session," the canonical resource-deletion case. |
| SessionInsights | DELETE | /sessions/{sessionId} | deleteSession | x | high | V3-live-object | verb=delete nouns=session | w | Deleting the session merely "stops all notifications and metric reporting for the session," an ordinary teardown of the caller's own monitoring resource with no live network reconfiguration described. |
| WebRTC | PUT | /sessions/{registrationId} | updateRegistrationById | x | low | V3-live-object | verb=refresh nouns=session | w | The refresh logic recomputes and persists "newExpire" from the operator's TTL policy using the request receipt time each call, a set-style update to the caller's own registration expiry with no third-party effect described. |
| WebRTC | DELETE | /sessions/{registrationId} | deleteRegistrationById | x | high | V3-live-object | verb=delete nouns=session | w | Deleting "frees any resource and invalidates future actions that involves this registration" — an idempotent removal of the caller's own registration resource with no external effect stated for this operation. |

## Negative controls

- ClickToDial DELETE /calls/{callId} `terminateCall`: rule class = (not found in run output), gt class = x — FAIL
- WebRTC PUT /sessions/{mediaSessionId}/status `updateSessionStatus`: rule class = x, gt class = x — PASS
