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
- agree: 98
- WRONG-LOOSENING: 0
- over-tight: 42

By method:
  - POST: {"over-tight":22,"agree":45}
  - PATCH: {"over-tight":4,"agree":2}
  - GET: {"agree":46}
  - DELETE: {"agree":3,"over-tight":15}
  - PUT: {"agree":2,"over-tight":1}

By confidence:
  - low: {"over-tight":18,"agree":1}
  - high: {"agree":95,"over-tight":20}
  - method-only: {"agree":2,"over-tight":4}

## Wrong loosenings

(none)

## Over-tightenings

| repo | method | path | operationId | rule class | confidence | rule_id | evidence | gt_class | gt reason |
|---|---|---|---|---|---|---|---|---|---|
| ApplicationEndpointDiscovery | POST | /retrieve-optimal-app-endpoints | getOptimalAppEndpoints | x | low | U:L4-lookup|V3-party-object | A=verb=return B=verb=return head=s party=user | r | The description says the network only "returns the endpoint(s) of the Application Instance(s) with the shortest network path" for the identified device, so the POST body is a lookup query and no resource is created. |
| ApplicationProfiles | PATCH | /application-profiles/{applicationProfileId} | updateApplicationProfile | x | high | U:L3-live-noun|V5-verb-write | A=nouns=network verb=update B=verb=update | w | Description states it updates "the complete set of network quality thresholds for an application with the new set of thresholds", i.e. a full replace of the identified profile's thresholds. |
| CallForwardingSignal | POST | /call-forwardings | retrieveCallForwarding | x | low | U:L4-lookup|V3-party-object | A=verb=retrieve B=verb=retrieve head=type party=call | r | Description states it "provides information about which type of call forwarding service is active", returning an array of active types with no state change. |
| CarrierBillingCheckOut | POST | /payments/{paymentId}/cancel | cancelPayment | x | high | U:L2-danger-verb|V2-verb-consequential | A=verbs=cancel,pay,reserv B=verb=cancel | w | Description says it will "Cancel a reservation of a given payment" before it is charged, which converges the reservation to a cancelled end state and does not move money or reach a third party. |
| ConnectedNetworkType | DELETE | /subscriptions/{subscriptionId} | deleteConnectedNetworkTypeSubscription | x | high | U:L3-live-noun|V3-party-object | A=nouns=network verb=delete B=verb=delete head=event party=device | w | This is the standard CAMARA subscription delete operation on /subscriptions/{subscriptionId}: it removes the identified subscription, converging to the same absent-subscription end state on repetition and issuing no further notifications itself. |
| ConsentInfo | POST | /retrieve | retrieveStatus | x | high | U:L3-live-noun|V2-verb-consequential | A=nouns=access verb=create B=verb=create | r | Description says it will "Create a request to retrieve the validity status of the API Consumer data processing for a given User, scope(s) and Purpose", i.e. despite the verb "create" in the summary it only reads and returns existing consent status, optionally with a one-off captureUrl, not a subscription. |
| DeviceAuthenticity | POST | /check-status | checkImeiStatus | x | low | U:L4-lookup|V3-party-object | A=verb=check B=verb=check head=status party=device | r | checkImeiStatus takes only an imei value and returns register/operational status information, i.e. "verify if an IMEI is present in allowed, prohibited, or tracked lists," with no resource created. |
| DeviceIdentifier | POST | /retrieve-type | retrieveType | x | low | U:L4-lookup|V3-party-object | A=verb=get B=verb=get head=type party=device | r | retrieveType returns only device type info ("the response will always contain tac") for a supplied subscriber identifier, a pure query. |
| DeviceIdentifier | POST | /retrieve-ppid | retrievePpid | x | low | U:L4-lookup|V3-party-object | A=verb=get B=verb=get head=identifier party=device | r | retrievePpid returns a pseudonymised device identifier ("the response will always contain ppid") for a supplied subscriber identifier, a pure query. |
| DeviceRoamingStatus | DELETE | /subscriptions/{subscriptionId} | deleteDeviceRoamingStatusSubscription | x | low | U:L5-floor|V3-party-object | A=verb=delete B=verb=delete head=event party=device | w | deleteDeviceRoamingStatusSubscription deletes "a given device-roaming-status subscription by ID," stopping only the consumer's own future notifications with no third-party effect. |
| EdgeApplicationManagement | DELETE | /apps/{appId} | deleteApp | x | low | U:L5-floor|V3-party-object | A=verb=delete B=verb=delete head=application party=application | w | description 'Delete all the information and content related to an Application' idempotently removes the caller's own application record. |
| EdgeApplicationManagement | DELETE | /app-instances/{appInstanceId} | deleteAppInstance | x | high | U:L2-danger-verb|V2-verb-consequential | A=verbs=terminat B=verb=terminate | w | description 'Terminate a running instance of an application within an Edge Cloud Zone' is an idempotent removal of the caller's own instance. |
| EdgeApplicationManagement | DELETE | /deployments/{appDeploymentId} | deleteAppDeployment | x | high | U:L2-danger-verb|V2-verb-consequential | A=verbs=terminat B=verb=terminate | w | description 'Delete a deployment terminating all related instances of an application' idempotently tears down the caller's own deployment. |
| EdgeApplicationManagement | PATCH | /deployments/{appDeploymentId} | updateAppDeployment | x | high | U:L5-floor|V5-verb-write | A=verb=update B=verb=update | w | description specifies JSON Merge Patch semantics where 'Only the fields provided in the request body will be updated,' a repeatable set-style update. |
| IoTSIMFraudPrevention | DELETE | /subscriptions/{subscriptionId} | deleteSubscription | x | low | U:L2-danger-verb|V5-verb-write | A=verbs=notif,sent B=verb=delete | w | "Delete an existing subscription. After deletion, no further notifications will be sent" is a delete whose repetition leaves the subscription gone either way. |
| IoTSIMFraudPrevention | POST | /query | query | x | method-only | U:L5-floor|V6-floor | A=verb=iot B=verb=iot head=query | r | The request body only carries a device identifier and queryType, and the response only reports current bind or area-limit status with no resource created or modified. |
| KnowYourCustomerAgeVerification | POST | /verify | verifyAge | x | method-only | U:L5-floor|V6-floor | A=verb=verify B=verb=verify head=threshold | r | As the standalone KnowYourCustomerAgeVerification repo's copy of /verify, it 'checks if the age of the subscriber is older than the age threshold' and returns ageCheck, a pure lookup with no side effects. |
| KnowYourCustomerMatch | POST | /match | kycMatch | x | method-only | U:L5-floor|V6-floor | A=verb=matching B=verb=matching head=identity | r | As the standalone Match repo's endpoint, it compares SP-held attributes against the Operator's verified KYC records and returns per-attribute match results, never writing data. |
| MostFrequentLocation | POST | /verify | verifyFrequentLocation | x | high | U:L5-floor|V3-party-object | A=verb=verify B=verb=verify head=location party=device | r | The operation 'returns a score representing how frequently the device was connected to antennas' whose coverage matches the requested area, a computed read with no state change. |
| NetworkAccessManagement | DELETE | /reboot-requests/{rebootRequestId} | deleteRebootRequest | x | low | U:L2-danger-verb|V5-verb-write | A=verbs=cancel,reboot B=verb=delete | w | Deletes the Reboot Request, "cancelling the scheduled reboot if it has not yet occurred", a standard idempotent delete of a resource. |
| NetworkAccessManagement | POST | /trust-domains | createTrustDomain | x | high | U:L5-floor|V2-verb-consequential | A=verb=create B=verb=create | w | Creation is guarded by name uniqueness ("409 ALREADY_EXISTS ... if a Trust Domain with the same name already exists"), so repeated identical requests converge on the same single domain rather than each creating a distinct resource, and the config is applied only to the caller's own network access devices. |
| NetworkAccessManagement | PATCH | /trust-domains/{trustDomainId} | updateTrustDomain | x | high | U:L3-live-noun|V5-verb-write | A=nouns=access,network verb=update B=verb=update | w | Updates the Trust Domain by ID with full-replacement semantics for accessDetails, so repeating the same PATCH body leaves the domain in the same state. |
| NetworkAccessManagement | DELETE | /trust-domains/{trustDomainId} | deleteTrustDomain | x | low | U:L3-live-noun|V5-verb-write | A=nouns=access,network verb=delete B=verb=delete | w | Deletes the Trust Domain and removes its configuration from all network access devices where applied, a standard idempotent resource delete. |
| NetworkAccessManagement | PATCH | /trust-domains/{trustDomainId}/devices/{deviceId} | updateTrustDomainDevice | x | high | U:L5-floor|V3-party-object | A=verb=update B=verb=update head=device party=device | w | Only included fields are updated, with `bootstrappingInfo`/`deviceCredential` replaced wholesale when present, making repeated identical PATCHes converge on the same device state. |
| NetworkAccessManagement | DELETE | /trust-domains/{trustDomainId}/devices/{deviceId} | deleteTrustDomainDevice | x | low | U:L5-floor|V3-party-object | A=verb=remove B=verb=remove head=device party=device | w | Deregisters and removes the device from the specified Trust Domain, an idempotent delete of the registration resource. |
| NetworkSliceBooking | POST | /retrieve-slices | retrieveSlicesByDevice | x | low | U:L4-lookup|V3-party-object | A=verb=retrieve B=verb=retrieve head=slice party=slice | r | Body carries only a device identifier and the response is the read-only list of slices the device is assigned to, with no resource created by this call. |
| NetworkSliceBooking | DELETE | /slices/{sliceId} | deleteSlice | x | high | U:L2-danger-verb|V3-party-object | A=verbs=releas B=verb=delete head=slice party=slice | w | The spec states explicitly "The deletion operation is idempotent, meaning that if the slice is already deleted, the API consumer will receive a response with code 204". |
| NumberVerification | POST | /verify | phoneNumberVerify | x | high | U:L3-live-noun|V6-floor | A=nouns=access,network verb=verify B=verb=verify head=none | r | Compares the supplied phone number against the one tied to the access token and returns true/false, described purely as a verification check with no state change. |
| OptimalEdgeDiscovery | POST | /retrieve-optimal-edge-cloud-zones | discoverOptimalEdge | x | method-only | U:L5-floor|V6-floor | A=verb=discover B=verb=discover head=zone | r | Request body is only an applicationProfileId plus optional device/region identifiers, and the response is a ranked list of zones with no resource created by the call. |
| PredictiveConnectivityData | POST | /retrieve | retrieveConnectivity | x | high | U:L1-structural|V1-structural | A=structural=callbacks,sink B=structural=callbacks,sink | r | Retrieves a connectivity estimation for a requested area/service level/time window; the request is a query and the response is computed data with no resource created. |
| QualityOnDemand | POST | /retrieve-qos-profiles | retrieveQosProfiles | x | low | U:L2-danger-verb|V4-verb-read | A=verbs=send,sent,transfer B=verb=retrieve | r | The operation only returns a filtered list of QoS Profiles ("Returns all QoS Profiles that match the given criteria") and does not create or modify any resource. |
| QualityOnDemand | DELETE | /qos-assignments/{assignmentId} | revokeQosAssignment | x | high | U:L2-danger-verb|V2-verb-consequential | A=verbs=notif,revok B=verb=revoke | w | The operation "revokes the assignment of a QoS profile to a device" by deleting the existing assignment record, matching the ordinary resource-deletion pattern. |
| QualityOnDemand | POST | /retrieve-qos-assignment | getQosAssignmentByDevice | x | high | U:L2-danger-verb|V3-party-object | A=verbs=invok,send,sent,transfer B=verb=return head=detail party=device | r | This POST "returns the details of the record for the assignment of a QoS profile to a device" and is explicitly a query substituting for GET to avoid exposing device identifiers, not a state change. |
| QualityOnDemand | DELETE | /sessions/{sessionId} | deleteSession | x | high | U:L2-danger-verb|V3-party-object | A=verbs=notif,releas B=verb=delete head=session party=session | w | deleteSession simply releases "resources related to QoS session," the canonical resource-deletion case. |
| QualityOnDemand | POST | /retrieve-sessions | retrieveSessionsByDevice | x | high | U:L2-danger-verb|V3-party-object | A=verbs=send,sent,transfer B=verb=get head=information party=device | r | retrieveSessionsByDevice is "querying for QoS session resource information details for a device" and returns an empty array if none are found, with no resource created. |
| SessionInsights | DELETE | /sessions/{sessionId} | deleteSession | x | high | U:L2-danger-verb|V3-party-object | A=verbs=notif,stop B=verb=delete head=session party=session | w | Deleting the session merely "stops all notifications and metric reporting for the session," an ordinary teardown of the caller's own monitoring resource with no live network reconfiguration described. |
| SessionInsights | POST | /retrieve-sessions | retrieveSessionsByDevice | x | low | U:L4-lookup|V3-party-object | A=verb=retrieve B=verb=retrieve head=session party=session | r | This lookup "retrieves all Session Insights sessions for a given device" and returns an empty array if none are found. |
| SimpleEdgeDiscovery | POST | /retrieve-closest-edge-cloud-zone | readClosestEdgeCloudZone | x | low | U:L4-lookup|V3-party-object | A=verb=return B=verb=return head=name party=user | r | The operation only returns "the name of the Edge Cloud Zone with the shortest network path to the end user device," a computed lookup with no resource created. |
| SubscriptionStatus | POST | /retrieve-subscription-status | retrieveSubscriptionStatus | x | low | U:L4-lookup|V3-party-object | A=verb=retrieve B=verb=retrieve head=status party=phone | r | This obtains "the business subscription status of the provided phone number" as a pure read with no request-body side effects. |
| WebRTC | DELETE | /subscriptions/{subscriptionId} | deleteNotificationChannelSubscription | x | low | U:L2-danger-verb|V5-verb-write | A=verbs=notif,stop B=verb=delete | w | Deleting the requester's own subscription is idempotent and the subscription-ended event it emits goes to the requester's own sink, not to a third party; ruled w by the orchestrator, consistent with the other subscription deletions in the set. |
| WebRTC | PUT | /sessions/{registrationId} | updateRegistrationById | x | low | U:L2-danger-verb|V6-floor | A=verbs=expir B=verb=refresh head=registration | w | The refresh logic recomputes and persists "newExpire" from the operator's TTL policy using the request receipt time each call, a set-style update to the caller's own registration expiry with no third-party effect described. |
| WebRTC | DELETE | /sessions/{registrationId} | deleteRegistrationById | x | high | U:L3-live-noun|V3-party-object | A=nouns=network,session verb=delete B=verb=delete head=session party=session | w | Deleting "frees any resource and invalidates future actions that involves this registration" — an idempotent removal of the caller's own registration resource with no external effect stated for this operation. |

## Negative controls

- ClickToDial DELETE /calls/{callId} `terminateCall`: rule class = (not found in run output), gt class = x — FAIL
- WebRTC PUT /sessions/{mediaSessionId}/status `updateSessionStatus`: rule class = x, gt class = x — PASS
