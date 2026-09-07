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
- agree: 86
- WRONG-LOOSENING: 0
- over-tight: 54

By method:
  - POST: {"over-tight":32,"agree":35}
  - PATCH: {"over-tight":4,"agree":2}
  - GET: {"agree":46}
  - DELETE: {"over-tight":16,"agree":2}
  - PUT: {"agree":1,"over-tight":2}

By confidence:
  - high: {"over-tight":54,"agree":86}

## Wrong loosenings

(none)

## Over-tightenings

| repo | method | path | operationId | rule class | confidence | rule_id | evidence | gt_class | gt reason |
|---|---|---|---|---|---|---|---|---|---|
| ApplicationEndpointDiscovery | POST | /retrieve-optimal-app-endpoints | getOptimalAppEndpoints | x | high | L2-danger-verb | verbs=ban,expir,invok,releas | r | The description says the network only "returns the endpoint(s) of the Application Instance(s) with the shortest network path" for the identified device, so the POST body is a lookup query and no resource is created. |
| ApplicationProfiles | PATCH | /application-profiles/{applicationProfileId} | updateApplicationProfile | x | high | L2-danger-verb | verbs=releas | w | Description states it updates "the complete set of network quality thresholds for an application with the new set of thresholds", i.e. a full replace of the identified profile's thresholds. |
| ApplicationProfiles | DELETE | /application-profiles/{applicationProfileId} | deleteApplicationProfile | x | high | L2-danger-verb | verbs=releas | w | The 204 response description "Application profile has been deleted successfully" indicates a delete whose repeated effect (profile absent) does not change. |
| CallForwardingSignal | POST | /unconditional-call-forwardings | retrieveUnconditionalCallForwarding | x | high | L2-danger-verb | verbs=activat,ban,invok,releas,start | r | Description states the endpoint "provides information about the status of the unconditional call forwarding, being active or not", a status lookup with a boolean response and no state change. |
| CallForwardingSignal | POST | /call-forwardings | retrieveCallForwarding | x | high | L2-danger-verb | verbs=activat,ban,invok,releas,start | r | Description states it "provides information about which type of call forwarding service is active", returning an array of active types with no state change. |
| CarrierBillingCheckOut | POST | /payments/{paymentId}/cancel | cancelPayment | x | high | L2-danger-verb | verbs=cancel,charg,expir,invok,notif,pay,releas,reserv,send,start,trigger | w | Description says it will "Cancel a reservation of a given payment" before it is charged, which converges the reservation to a cancelled end state and does not move money or reach a third party. |
| ConnectedNetworkType | DELETE | /subscriptions/{subscriptionId} | deleteConnectedNetworkTypeSubscription | x | high | L2-danger-verb | verbs=deliver,expir,invok,notif,releas,send,sent,start,stop,trigger | w | This is the standard CAMARA subscription delete operation on /subscriptions/{subscriptionId}: it removes the identified subscription, converging to the same absent-subscription end state on repetition and issuing no further notifications itself. |
| ConnectedNetworkType | POST | /retrieve | getConnectedNetworkType | x | high | L2-danger-verb | verbs=invok,releas | r | Description says it will "Get the connected network type to which the user device is connected", a status query returning the current technology (4G, 5G, etc.) with no state change. |
| ConsentInfo | POST | /retrieve | retrieveStatus | x | high | L2-danger-verb | verbs=expir,invok,releas | r | Description says it will "Create a request to retrieve the validity status of the API Consumer data processing for a given User, scope(s) and Purpose", i.e. despite the verb "create" in the summary it only reads and returns existing consent status, optionally with a one-off captureUrl, not a subscription. |
| CustomerInsights | POST | /scoring/retrieve | retrieveScoring | x | high | L2-danger-verb | verbs=invok,releas | r | Summary is "Retrieves Scoring information" for the identified subject (Gauge Metric or Veritas Index), a computed read with no state change. |
| DeviceAuthenticity | POST | /check-status | checkImeiStatus | x | high | L2-danger-verb | verbs=activat,block,expir,pay,releas | r | checkImeiStatus takes only an imei value and returns register/operational status information, i.e. "verify if an IMEI is present in allowed, prohibited, or tracked lists," with no resource created. |
| DeviceIdentifier | POST | /retrieve-identifier | retrieveIdentifier | x | high | L2-danger-verb | verbs=block,deliver,expir,invok,releas,send,transfer | r | retrieveIdentifier returns device identifier data ("the response will always contain imei") for a supplied subscription identifier, a pure query. |
| DeviceIdentifier | POST | /retrieve-type | retrieveType | x | high | L2-danger-verb | verbs=block,deliver,expir,invok,releas,send,transfer | r | retrieveType returns only device type info ("the response will always contain tac") for a supplied subscriber identifier, a pure query. |
| DeviceIdentifier | POST | /retrieve-ppid | retrievePpid | x | high | L2-danger-verb | verbs=block,deliver,expir,invok,releas,send,transfer | r | retrievePpid returns a pseudonymised device identifier ("the response will always contain ppid") for a supplied subscriber identifier, a pure query. |
| DeviceIdentifier | POST | /match-identifier | matchIdentifier | x | high | L2-danger-verb | verbs=block,deliver,expir,invok,releas,send,transfer | r | matchIdentifier "check[s] whether a device identifier provided by the API consumer matches the one the network currently associates with a given mobile subscription" and returns only a match boolean, no state change. |
| DeviceMediaStreamingRate | POST | /retrieve-maximum-downstream-media-rate | retrieveMaximumDownstreamMediaRate | x | high | L2-danger-verb | verbs=invok,releas | r | This operation "retrieve[s] the maximum downstream media streaming rate for a device," a query with no resource created. |
| DeviceRoamingStatus | DELETE | /subscriptions/{subscriptionId} | deleteDeviceRoamingStatusSubscription | x | high | L2-danger-verb | verbs=expir,invok,notif,releas,send,sent,start,stop,trigger | w | deleteDeviceRoamingStatusSubscription deletes "a given device-roaming-status subscription by ID," stopping only the consumer's own future notifications with no third-party effect. |
| DeviceRoamingStatus | POST | /retrieve | getRoamingStatus | x | high | L2-danger-verb | verbs=charg,deliver,invok,releas | r | getRoamingStatus "get[s] the current roaming status and the country information" synchronously, a pure query. |
| DeviceSwap | POST | /retrieve-date | retrieveDeviceSwapDate | x | high | L2-danger-verb | verbs=invok,releas,transfer | r | description 'Get timestamp of last device swap for a mobile user account provided with phone number' is a read-only query returning DeviceSwapInfo. |
| DeviceSwap | POST | /check | checkDeviceSwap | x | high | L2-danger-verb | verbs=invok,releas,transfer | r | description 'Check if device swap has been performed during a past period' returns a boolean 'swapped' with no state effect. |
| EdgeApplicationManagement | DELETE | /apps/{appId} | deleteApp | x | high | L2-danger-verb | verbs=ban,book,releas,start,terminat | w | description 'Delete all the information and content related to an Application' idempotently removes the caller's own application record. |
| EdgeApplicationManagement | DELETE | /app-instances/{appInstanceId} | deleteAppInstance | x | high | L2-danger-verb | verbs=ban,book,releas,start,terminat | w | description 'Terminate a running instance of an application within an Edge Cloud Zone' is an idempotent removal of the caller's own instance. |
| EdgeApplicationManagement | DELETE | /deployments/{appDeploymentId} | deleteAppDeployment | x | high | L2-danger-verb | verbs=ban,book,releas,start,terminat | w | description 'Delete a deployment terminating all related instances of an application' idempotently tears down the caller's own deployment. |
| EdgeApplicationManagement | PATCH | /deployments/{appDeploymentId} | updateAppDeployment | x | high | L2-danger-verb | verbs=ban,book,releas,send,start,terminat | w | description specifies JSON Merge Patch semantics where 'Only the fields provided in the request body will be updated,' a repeatable set-style update. |
| IoTDeviceManagement | POST | /retrieve-status | getEsimProfileStatus | x | high | L2-danger-verb | verbs=activat,deliver,irreversibl,notif,permanent,releas | r | description explicitly notes 'This operation uses POST despite being a read operation' and only retrieves status information. |
| IoTSIMFraudPrevention | DELETE | /subscriptions/{subscriptionId} | deleteSubscription | x | high | L2-danger-verb | verbs=notif,pay,releas,send,sent | w | "Delete an existing subscription. After deletion, no further notifications will be sent" is a delete whose repetition leaves the subscription gone either way. |
| IoTSIMFraudPrevention | POST | /query | query | x | high | L2-danger-verb | verbs=block,releas | r | The request body only carries a device identifier and queryType, and the response only reports current bind or area-limit status with no resource created or modified. |
| KnowYourCustomerAgeVerification | POST | /verify | verifyAge | x | high | L2-danger-verb | verbs=activat,block,invok,releas | r | As the standalone KnowYourCustomerAgeVerification repo's copy of /verify, it 'checks if the age of the subscriber is older than the age threshold' and returns ageCheck, a pure lookup with no side effects. |
| KnowYourCustomerMatch | POST | /match | kycMatch | x | high | L2-danger-verb | verbs=ban,invok,releas | r | As the standalone Match repo's endpoint, it compares SP-held attributes against the Operator's verified KYC records and returns per-attribute match results, never writing data. |
| MostFrequentLocation | POST | /verify | verifyFrequentLocation | x | high | L2-danger-verb | verbs=deliver,invok,releas,trigger | r | The operation 'returns a score representing how frequently the device was connected to antennas' whose coverage matches the requested area, a computed read with no state change. |
| NetworkAccessManagement | DELETE | /reboot-requests/{rebootRequestId} | deleteRebootRequest | x | high | L2-danger-verb | verbs=cancel,disconnect,execut,reboot,releas,reschedul,trigger | w | Deletes the Reboot Request, "cancelling the scheduled reboot if it has not yet occurred", a standard idempotent delete of a resource. |
| NetworkAccessManagement | POST | /trust-domains | createTrustDomain | x | high | L2-danger-verb | verbs=block,book,expir,reboot,releas,stop | w | Creation is guarded by name uniqueness ("409 ALREADY_EXISTS ... if a Trust Domain with the same name already exists"), so repeated identical requests converge on the same single domain rather than each creating a distinct resource, and the config is applied only to the caller's own network access devices. |
| NetworkAccessManagement | PATCH | /trust-domains/{trustDomainId} | updateTrustDomain | x | high | L2-danger-verb | verbs=block,book,expir,reboot,releas,stop | w | Updates the Trust Domain by ID with full-replacement semantics for accessDetails, so repeating the same PATCH body leaves the domain in the same state. |
| NetworkAccessManagement | DELETE | /trust-domains/{trustDomainId} | deleteTrustDomain | x | high | L2-danger-verb | verbs=block,book,expir,reboot,releas,stop | w | Deletes the Trust Domain and removes its configuration from all network access devices where applied, a standard idempotent resource delete. |
| NetworkAccessManagement | PATCH | /trust-domains/{trustDomainId}/devices/{deviceId} | updateTrustDomainDevice | x | high | L2-danger-verb | verbs=block,book,expir,reboot,releas,stop | w | Only included fields are updated, with `bootstrappingInfo`/`deviceCredential` replaced wholesale when present, making repeated identical PATCHes converge on the same device state. |
| NetworkAccessManagement | DELETE | /trust-domains/{trustDomainId}/devices/{deviceId} | deleteTrustDomainDevice | x | high | L2-danger-verb | verbs=block,book,expir,reboot,releas,stop | w | Deregisters and removes the device from the specified Trust Domain, an idempotent delete of the registration resource. |
| NetworkSliceBooking | POST | /retrieve-slices | retrieveSlicesByDevice | x | high | L2-danger-verb | verbs=book,deliver,invok,notif,releas | r | Body carries only a device identifier and the response is the read-only list of slices the device is assigned to, with no resource created by this call. |
| NetworkSliceBooking | DELETE | /slices/{sliceId} | deleteSlice | x | high | L2-danger-verb | verbs=book,deliver,releas,reserv,start | w | The spec states explicitly "The deletion operation is idempotent, meaning that if the slice is already deleted, the API consumer will receive a response with code 204". |
| NumberVerification | POST | /verify | phoneNumberVerify | x | high | L2-danger-verb | verbs=expir,initiat,invok,releas,send,sent | r | Compares the supplied phone number against the one tied to the access token and returns true/false, described purely as a verification check with no state change. |
| OptimalEdgeDiscovery | POST | /retrieve-optimal-edge-cloud-zones | discoverOptimalEdge | x | high | L2-danger-verb | verbs=invok,releas | r | Request body is only an applicationProfileId plus optional device/region identifiers, and the response is a ranked list of zones with no resource created by the call. |
| PredictiveConnectivityData | POST | /retrieve | retrieveConnectivity | x | high | L1-structural | structural=callbacks,sink | r | Retrieves a connectivity estimation for a requested area/service level/time window; the request is a query and the response is computed data with no resource created. |
| QualityOnDemand | POST | /retrieve-qos-profiles | retrieveQosProfiles | x | high | L2-danger-verb | verbs=invok,releas,send,sent,transfer | r | The operation only returns a filtered list of QoS Profiles ("Returns all QoS Profiles that match the given criteria") and does not create or modify any resource. |
| QualityOnDemand | DELETE | /qos-assignments/{assignmentId} | revokeQosAssignment | x | high | L2-danger-verb | verbs=invok,notif,releas,revok,sent,terminat | w | The operation "revokes the assignment of a QoS profile to a device" by deleting the existing assignment record, matching the ordinary resource-deletion pattern. |
| QualityOnDemand | POST | /retrieve-qos-assignment | getQosAssignmentByDevice | x | high | L2-danger-verb | verbs=invok,notif,releas,revok,send,sent,terminat,transfer | r | This POST "returns the details of the record for the assignment of a QoS profile to a device" and is explicitly a query substituting for GET to avoid exposing device identifiers, not a state change. |
| QualityOnDemand | DELETE | /sessions/{sessionId} | deleteSession | x | high | L2-danger-verb | verbs=expir,invok,notif,releas,sent,terminat,trigger | w | deleteSession simply releases "resources related to QoS session," the canonical resource-deletion case. |
| QualityOnDemand | POST | /retrieve-sessions | retrieveSessionsByDevice | x | high | L2-danger-verb | verbs=expir,invok,notif,releas,send,sent,terminat,transfer,trigger | r | retrieveSessionsByDevice is "querying for QoS session resource information details for a device" and returns an empty array if none are found, with no resource created. |
| SessionInsights | DELETE | /sessions/{sessionId} | deleteSession | x | high | L2-danger-verb | verbs=deliver,expir,initiat,invok,notif,releas,send,sent,stop,terminat,trigger | w | Deleting the session merely "stops all notifications and metric reporting for the session," an ordinary teardown of the caller's own monitoring resource with no live network reconfiguration described. |
| SessionInsights | POST | /retrieve-sessions | retrieveSessionsByDevice | x | high | L2-danger-verb | verbs=deliver,expir,initiat,invok,notif,releas,send,sent,terminat,trigger | r | This lookup "retrieves all Session Insights sessions for a given device" and returns an empty array if none are found. |
| SimpleEdgeDiscovery | POST | /retrieve-closest-edge-cloud-zone | readClosestEdgeCloudZone | x | high | L2-danger-verb | verbs=invok,releas | r | The operation only returns "the name of the Edge Cloud Zone with the shortest network path to the end user device," a computed lookup with no resource created. |
| SubscriptionStatus | POST | /retrieve-subscription-status | retrieveSubscriptionStatus | x | high | L2-danger-verb | verbs=block,expir,initiat,invok,pay,releas,send,suspend,transfer | r | This obtains "the business subscription status of the provided phone number" as a pure read with no request-body side effects. |
| WebRTC | PUT | /subscriptions/{subscriptionId} | updateNotificationChannelSubscription | x | high | L2-danger-verb | verbs=deliver,expir,initiat,notif,releas,send,sent,stop,terminat,trigger | w | The spec states explicitly "This operation is idempotent. Repeating the same update request results in the same final subscription state," changing only sinkCredential or expiry with no notification side-effect described. |
| WebRTC | DELETE | /subscriptions/{subscriptionId} | deleteNotificationChannelSubscription | x | high | L2-danger-verb | verbs=deliver,expir,initiat,notif,releas,send,sent,stop,terminat,trigger | w | Deleting the requester's own subscription is idempotent and the subscription-ended event it emits goes to the requester's own sink, not to a third party; ruled w by the orchestrator, consistent with the other subscription deletions in the set. |
| WebRTC | PUT | /sessions/{registrationId} | updateRegistrationById | x | high | L2-danger-verb | verbs=expir,initiat,releas,terminat | w | The refresh logic recomputes and persists "newExpire" from the operator's TTL policy using the request receipt time each call, a set-style update to the caller's own registration expiry with no third-party effect described. |
| WebRTC | DELETE | /sessions/{registrationId} | deleteRegistrationById | x | high | L2-danger-verb | verbs=expir,initiat,releas,terminat | w | Deleting "frees any resource and invalidates future actions that involves this registration" — an idempotent removal of the caller's own registration resource with no external effect stated for this operation. |

## Negative controls

- ClickToDial DELETE /calls/{callId} `terminateCall`: rule class = (not found in run output), gt class = x — FAIL
- WebRTC PUT /sessions/{mediaSessionId}/status `updateSessionStatus`: rule class = x, gt class = x — PASS
