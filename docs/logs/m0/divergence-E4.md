# M0 divergence report

## Counts

- rows joined: 292
- unjoined (in run, not in ground truth): 0
- unjoined (in ground truth, not in run): 0
- agree: 260
- WRONG-LOOSENING: 21
- over-tight: 11

By method:
  - POST: {"agree":119,"WRONG-LOOSENING":14,"over-tight":5}
  - GET: {"agree":96}
  - PUT: {"agree":7,"WRONG-LOOSENING":1}
  - DELETE: {"agree":35,"WRONG-LOOSENING":6}
  - PATCH: {"over-tight":6,"agree":3}

By confidence:
  - low: {"agree":61,"over-tight":6,"WRONG-LOOSENING":14}
  - high: {"agree":183,"WRONG-LOOSENING":7,"over-tight":1}
  - method-only: {"agree":16,"over-tight":4}

## Wrong loosenings

| repo | method | path | operationId | rule class | confidence | rule_id | evidence | gt_class | gt reason |
|---|---|---|---|---|---|---|---|---|---|
| CapabilitiesAndRuntimeRestrictions | POST | /retrieve | postServiceCapability | r | low | A4-loosen | method=POST verb=retrieve | x | The info.description explains the server "internally registers for capability change events if 'subscriptionRequest' is provided in the request" and calls the client-supplied sink with CloudEvents, i.e. it can create a live notification subscription as part of the call. |
| CarrierBillingCheckOut | POST | /payments/{paymentId}/validate | validatePayment | r | low | A4-loosen | method=POST verb=validate | x | The 409 response example states "Payment already validated", showing that repeating the same validate call after success does not have the same effect as the first call. |
| DedicatedNetworks | DELETE | /accesses/{accessId} | deleteAccess | w | high | A1-agree | method=DELETE verb=delete | x | Per "Deletion of the access can be interpreted as removal of the permission for all the devices included in the access to access the network," deleting revokes live network connectivity granted to those devices. |
| DedicatedNetworks | POST | /accesses/{accessId}/devices/remove | removeDevicesFromAccess | w | low | A4-loosen | method=POST verb=remove | x | Per "devices can be removed from it," the API returns confirmation that removal is "interpreted as removal of the permission," revoking those devices' live access to the dedicated network. |
| DedicatedNetworks | DELETE | /networks/{networkId} | deleteNetwork | w | high | A1-agree | method=DELETE verb=delete | x | Per "Deletion of a network can be interpreted as a cancellation of the resource reservation," and since an ACTIVATED network is one "devices with access can use," deleting it terminates connectivity devices may currently be using. |
| InHomeDeviceManagement | DELETE | /v1/devices/{deviceId} | deleteDevice | w | high | A1-agree | method=DELETE verb=delete | x | description notes deletion also removes 'Any active access control rules for this device,' restoring the device's live network access, the same class of device-reaching action as updateDevice's block/unblock. |
| IoTDeviceManagement | POST | /enable | enableEsimProfile | w | low | A4-loosen | method=POST verb=enable | x | description 'enabling automatically disables the currently active eSIM Profile' is an over-the-air action that changes the device's live cellular connectivity. |
| IoTDeviceManagement | POST | /disable | disableEsimProfile | w | low | A4-loosen | method=POST verb=disable | x | description 'Device will lose cellular connectivity until another eSIM Profile is enabled' shows this over-the-air call directly changes the device's live connectivity. |
| IoTDeviceManagement | POST | /delete | deleteEsimProfile | w | low | A4-loosen | method=POST verb=delete | x | description 'Permanently removes an eSIM Profile from the device. This operation is irreversible' is an over-the-air action executed on the physical eUICC. |
| IoTDeviceManagement | POST | /set-fallback | setFallbackEsimProfile | w | low | A4-loosen | method=POST verb=set | x | though the operation 'sets attribute only' with 'No state change,' the info.description's over-the-air note lists set-fallback among the operations delivered directly to the device. |
| IoTNetworkOptimization | POST | /features/power-saving | activatePowerSaving | w | low | A4-loosen | method=POST verb=activate | x | summary 'Activate or de-activate power-saving features for IoT devices' adjusts live device network parameters, and the 409 example 'Device already in the requested power-saving state or a conflicting operation is in progress' shows repeating the call does not have the same effect. |
| ModelAsAService | POST | /answer | queryAssistant | r | low | A4-loosen | method=POST verb=query | x | queryAssistant's LLM 'MAY invoke [associated] tools automatically while generating the answer ... turning the assistant into an agent that can take actions', and those tool invocations reach consumer-registered third-party urls, so the read-shaped query can carry third-party side effects the response never surfaces. |
| NetworkSliceBooking | POST | /slices/{sliceId}/devices | assignDevice | w | low | A4-loosen | method=POST verb=assign | x | Assigning a device provisions it onto the live network slice and is capacity-bounded ("must not exceed the maximum number defined in the slice QoS profile"), i.e. a per-device reservation against finite slice capacity, not a plain idempotent record update. |
| OTPValidation | POST | /validate-code | validateCode | r | low | A4-loosen | method=POST verb=validate | w | Verifies the code for the given authenticationId; once validated the code is consumed (single-use, per MAX_OTP_CODES/expiry semantics) so the authenticationId's final state converges after one or more calls, with no effect reaching outside the API. |
| QoSBooking | POST | /qos-bookings/{bookingId}/devices/assign | assignDevices | w | low | A4-loosen | method=POST verb=assign | x | Assignment causes "the network [to be] available for the said devices to connect and use them at the requested time", provisioning live QoS onto specific devices and consuming the booking's finite `remainingDevices` count per device assigned. |
| QualityOnDemand | POST | /sessions/{sessionId}/extend | extendQosSessionDuration | w | low | A4-loosen | method=POST verb=extend | x | Extending duration adds requestedAdditionalDuration to the existing session length each time it is called, so repeating the same extend request further lengthens a live prioritized network flow rather than reproducing one fixed state. |
| SponsoredData | DELETE | /sponsorship/{sponsorId}/{campaignId}/{sessionId}/revoke | revokeSponsorship | w | high | A1-agree | method=DELETE verb=revoke | x | revokeSponsorship "revokes an active sponsorship, preventing further use of sponsored data for the subscriber," cutting off a real end user's active benefit rather than the sponsor caller's own resource. |
| SponsoredData | POST | /campaign/{sponsorId}/{campaignId}/alert-subscription | configureAlerts | w | low | A4-loosen | method=POST verb=configure | x | configureAlerts registers a webhook and callbackToken so the sponsor "subscribe[s] to receive notifications related to campaigns," matching the subscription-creation criterion for consequential actions. |
| TrafficInfluence | DELETE | /traffic-influences/{trafficInfluenceID} | deleteTrafficInfluence | w | high | A1-agree | method=DELETE verb=delete | x | deleteTrafficInfluence is "invoked ... to stop influencing the traffic," reversing an active network routing configuration for the device's live traffic rather than merely discarding inert data. |
| WebRTC | DELETE | /sessions/{mediaSessionId} | deleteSessionById | w | high | A1-agree | method=DELETE verb=delete | x | The description states this DELETE will "Terminate a 1-1 an ongoing media session" and "trigger all necessary action on the network side to properly hangup and drop the call," ending a live call the other party is on. |
| WebRTC | PUT | /sessions/{mediaSessionId}/status | updateSessionStatus | w | high | A1-agree | method=PUT verb=update | x | The walkthrough for picking up a call uses this PUT to send the SDP "answer" and "include the information about the responding device," so it drives live IMS call signaling that reaches the other party. |

## Over-tightenings

| repo | method | path | operationId | rule class | confidence | rule_id | evidence | gt_class | gt reason |
|---|---|---|---|---|---|---|---|---|---|
| ApplicationProfiles | PATCH | /application-profiles/{applicationProfileId} | updateApplicationProfile | x | low | A3-keep-method | method=PATCH verb=update | w | Description states it updates "the complete set of network quality thresholds for an application with the new set of thresholds", i.e. a full replace of the identified profile's thresholds. |
| ConsentManagement | PATCH | /consents/{consentId} | updateConsent | x | low | A3-keep-method | method=PATCH verb=update | w | Description says it allows the consumer "to update the status of an existing Consent" identified by consentId, setting consentStatus to GRANTED or DENIED, a set operation on an existing resource. |
| EdgeApplicationManagement | PATCH | /deployments/{appDeploymentId} | updateAppDeployment | x | low | A3-keep-method | method=PATCH verb=update | w | description specifies JSON Merge Patch semantics where 'Only the fields provided in the request body will be updated,' a repeatable set-style update. |
| KnowYourCustomer | POST | /fill-in | KYC_Fill-in | x | method-only | M1 | method=POST | r | The summary describes 'Providing information related to a customer identity stored the account data bound to the customer's phone number', a read of Operator-held data with no write. |
| KnowYourCustomerFill-in | POST | /fill-in | kycFillin | x | method-only | M1 | method=POST | r | As the standalone Fill-in repo's endpoint, it lets a client 'request and receive the information for a particular user ... on file' with the Operator, purely retrieving stored attributes. |
| MultiPointVPN | PATCH | /networks/{serviceId} | updateNetwork | x | low | A3-keep-method | method=PATCH verb=update | w | updateNetwork uses application/merge-patch+json against NetworkUpdate, a JSON-merge-patch set of guaranteeBandwidth/sla fields that is idempotent by construction. |
| MultiPointVPN | POST | /assessment | assessConnectionFeasibility | x | method-only | M1 | method=POST | r | The request body only carries hypothetical connection parameters and the response returns waitDays/sla/rent estimates with no network or resource created, matching the query-only-POST rule for r. |
| NetworkAccessManagement | POST | /trust-domains | createTrustDomain | x | high | A1-agree | method=POST verb=create | w | Creation is guarded by name uniqueness ("409 ALREADY_EXISTS ... if a Trust Domain with the same name already exists"), so repeated identical requests converge on the same single domain rather than each creating a distinct resource, and the config is applied only to the caller's own network access devices. |
| NetworkAccessManagement | PATCH | /trust-domains/{trustDomainId} | updateTrustDomain | x | low | A3-keep-method | method=PATCH verb=update | w | Updates the Trust Domain by ID with full-replacement semantics for accessDetails, so repeating the same PATCH body leaves the domain in the same state. |
| NetworkAccessManagement | PATCH | /trust-domains/{trustDomainId}/devices/{deviceId} | updateTrustDomainDevice | x | low | A3-keep-method | method=PATCH verb=update | w | Only included fields are updated, with `bootstrappingInfo`/`deviceCredential` replaced wholesale when present, making repeated identical PATCHes converge on the same device state. |
| SponsoredData | POST | /campaign/management | manageCampaign | x | method-only | M1 | method=POST | w | manageCampaign only toggles the campaign between "PAUSE to temporarily halt new sponsorships" and "RESUME to reactivate the campaign," a status-set operation with the same end state however often it is applied. |

## Negative controls

- ClickToDial DELETE /calls/{callId} `terminateCall`: rule class = x, gt class = x — PASS
- WebRTC PUT /sessions/{mediaSessionId}/status `updateSessionStatus`: rule class = w, gt class = x — FAIL
