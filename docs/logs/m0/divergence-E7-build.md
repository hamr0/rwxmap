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
- agree: 127
- WRONG-LOOSENING: 0
- over-tight: 13

By method:
  - POST: {"over-tight":8,"agree":59}
  - PATCH: {"over-tight":4,"agree":2}
  - GET: {"agree":46}
  - DELETE: {"agree":18}
  - PUT: {"agree":2,"over-tight":1}

By confidence:
  - method-only: {"over-tight":5,"agree":25}
  - low: {"agree":34,"over-tight":5}
  - high: {"agree":68,"over-tight":3}

## Wrong loosenings

(none)

## Over-tightenings

| repo | method | path | operationId | rule class | confidence | rule_id | evidence | gt_class | gt reason |
|---|---|---|---|---|---|---|---|---|---|
| ApplicationEndpointDiscovery | POST | /retrieve-optimal-app-endpoints | getOptimalAppEndpoints | x | method-only | T3-floor | method=POST | r | The description says the network only "returns the endpoint(s) of the Application Instance(s) with the shortest network path" for the identified device, so the POST body is a lookup query and no resource is created. |
| ApplicationProfiles | PATCH | /application-profiles/{applicationProfileId} | updateApplicationProfile | x | low | T1-consequence | harm=new | w | Description states it updates "the complete set of network quality thresholds for an application with the new set of thresholds", i.e. a full replace of the identified profile's thresholds. |
| CarrierBillingCheckOut | POST | /payments/{paymentId}/cancel | cancelPayment | x | method-only | T3-floor | method=POST | w | Description says it will "Cancel a reservation of a given payment" before it is charged, which converges the reservation to a cancelled end state and does not move money or reach a third party. |
| ConsentInfo | POST | /retrieve | retrieveStatus | x | low | T1-consequence | harm=create | r | Description says it will "Create a request to retrieve the validity status of the API Consumer data processing for a given User, scope(s) and Purpose", i.e. despite the verb "create" in the summary it only reads and returns existing consent status, optionally with a one-off captureUrl, not a subscription. |
| EdgeApplicationManagement | PATCH | /deployments/{appDeploymentId} | updateAppDeployment | x | method-only | T3-floor | method=PATCH | w | description specifies JSON Merge Patch semantics where 'Only the fields provided in the request body will be updated,' a repeatable set-style update. |
| IoTDeviceManagement | POST | /retrieve-status | getEsimProfileStatus | x | low | T1-consequence | harm=iccid | r | description explicitly notes 'This operation uses POST despite being a read operation' and only retrieves status information. |
| NetworkAccessManagement | POST | /trust-domains | createTrustDomain | x | high | T1-consequence | harm=create,new,creates | w | Creation is guarded by name uniqueness ("409 ALREADY_EXISTS ... if a Trust Domain with the same name already exists"), so repeated identical requests converge on the same single domain rather than each creating a distinct resource, and the config is applied only to the caller's own network access devices. |
| NetworkAccessManagement | PATCH | /trust-domains/{trustDomainId} | updateTrustDomain | x | low | T1-consequence | harm=automatically | w | Updates the Trust Domain by ID with full-replacement semantics for accessDetails, so repeating the same PATCH body leaves the domain in the same state. |
| NetworkAccessManagement | PATCH | /trust-domains/{trustDomainId}/devices/{deviceId} | updateTrustDomainDevice | x | method-only | T3-floor | method=PATCH | w | Only included fields are updated, with `bootstrappingInfo`/`deviceCredential` replaced wholesale when present, making repeated identical PATCHes converge on the same device state. |
| PredictiveConnectivityData | POST | /retrieve | retrieveConnectivity | x | low | T1-consequence | structural=callbacks,sink | r | Retrieves a connectivity estimation for a requested area/service level/time window; the request is a query and the response is computed data with no resource created. |
| QualityOnDemand | POST | /retrieve-qos-assignment | getQosAssignmentByDevice | x | high | T1-consequence | harm=identifying,invoked,however | r | This POST "returns the details of the record for the assignment of a QoS profile to a device" and is explicitly a query substituting for GET to avoid exposing device identifiers, not a state change. |
| SimpleEdgeDiscovery | POST | /retrieve-closest-edge-cloud-zone | readClosestEdgeCloudZone | x | method-only | T3-floor | method=POST | r | The operation only returns "the name of the Edge Cloud Zone with the shortest network path to the end user device," a computed lookup with no resource created. |
| WebRTC | PUT | /sessions/{registrationId} | updateRegistrationById | x | high | T1-consequence | harm=new,apply | w | The refresh logic recomputes and persists "newExpire" from the operator's TTL policy using the request receipt time each call, a set-style update to the caller's own registration expiry with no third-party effect described. |

## Negative controls

- ClickToDial DELETE /calls/{callId} `terminateCall`: rule class = (not found in run output), gt class = x — FAIL
- WebRTC PUT /sessions/{mediaSessionId}/status `updateSessionStatus`: rule class = x, gt class = x — PASS
