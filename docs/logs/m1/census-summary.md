# OpenAPI field census — M0

Total labelled operations examined: 719 (camara 292, holdout1 207, holdout2 220).
Operations that failed to resolve (path+method not found in their spec): 0.

## Presence by set

**camara** (n=292)

| field | count | percent |
|---|---|---|
| security_present | 285/292 | 97.6% |
| security_scopes_nonempty | 282/292 | 96.6% |
| requestBody_present | 152/292 | 52.1% |
| requestBody_party_money | 54/292 | 18.5% |
| has202 | 47/292 | 16.1% |
| callbacks_present(op) | 42/292 | 14.4% |
| doc_has_webhooks | 0/292 | 0.0% |
| desc_mentions_callback | 29/292 | 9.9% |
| idempotency_header_param | 0/292 | 0.0% |
| party_id_param | 1/292 | 0.3% |
| x_extensions_present | 0/292 | 0.0% |
| resource_schema_found | 159/292 | 54.5% |
| resource_schema_party_field | 55/292 | 18.8% |

**holdout1** (n=207)

| field | count | percent |
|---|---|---|
| security_present | 94/207 | 45.4% |
| security_scopes_nonempty | 0/207 | 0.0% |
| requestBody_present | 121/207 | 58.5% |
| requestBody_party_money | 27/207 | 13.0% |
| has202 | 5/207 | 2.4% |
| callbacks_present(op) | 0/207 | 0.0% |
| doc_has_webhooks | 81/207 | 39.1% |
| desc_mentions_callback | 7/207 | 3.4% |
| idempotency_header_param | 0/207 | 0.0% |
| party_id_param | 116/207 | 56.0% |
| x_extensions_present | 87/207 | 42.0% |
| resource_schema_found | 176/207 | 85.0% |
| resource_schema_party_field | 71/207 | 34.3% |

**holdout2** (n=220)

| field | count | percent |
|---|---|---|
| security_present | 27/220 | 12.3% |
| security_scopes_nonempty | 0/220 | 0.0% |
| requestBody_present | 103/220 | 46.8% |
| requestBody_party_money | 28/220 | 12.7% |
| has202 | 2/220 | 0.9% |
| callbacks_present(op) | 0/220 | 0.0% |
| doc_has_webhooks | 0/220 | 0.0% |
| desc_mentions_callback | 16/220 | 7.3% |
| idempotency_header_param | 22/220 | 10.0% |
| party_id_param | 12/220 | 5.5% |
| x_extensions_present | 205/220 | 93.2% |
| resource_schema_found | 168/220 | 76.4% |
| resource_schema_party_field | 63/220 | 28.6% |

**ALL** (n=719)

| field | count | percent |
|---|---|---|
| security_present | 406/719 | 56.5% |
| security_scopes_nonempty | 282/719 | 39.2% |
| requestBody_present | 376/719 | 52.3% |
| requestBody_party_money | 109/719 | 15.2% |
| has202 | 54/719 | 7.5% |
| callbacks_present(op) | 42/719 | 5.8% |
| doc_has_webhooks | 81/719 | 11.3% |
| desc_mentions_callback | 52/719 | 7.2% |
| idempotency_header_param | 22/719 | 3.1% |
| party_id_param | 129/719 | 17.9% |
| x_extensions_present | 292/719 | 40.6% |
| resource_schema_found | 503/719 | 70.0% |
| resource_schema_party_field | 189/719 | 26.3% |

## Presence split by gt_class

**camara — split by gt_class**

**gt_class = r** (n=155)

| field | count | percent |
|---|---|---|
| security_present | 152/155 | 98.1% |
| security_scopes_nonempty | 149/155 | 96.1% |
| requestBody_present | 56/155 | 36.1% |
| requestBody_party_money | 20/155 | 12.9% |
| has202 | 2/155 | 1.3% |
| callbacks_present(op) | 3/155 | 1.9% |
| doc_has_webhooks | 0/155 | 0.0% |
| desc_mentions_callback | 1/155 | 0.6% |
| idempotency_header_param | 0/155 | 0.0% |
| party_id_param | 1/155 | 0.6% |
| x_extensions_present | 0/155 | 0.0% |
| resource_schema_found | 84/155 | 54.2% |
| resource_schema_party_field | 26/155 | 16.8% |

**gt_class = w** (n=51)

| field | count | percent |
|---|---|---|
| security_present | 50/51 | 98.0% |
| security_scopes_nonempty | 50/51 | 98.0% |
| requestBody_present | 17/51 | 33.3% |
| requestBody_party_money | 3/51 | 5.9% |
| has202 | 20/51 | 39.2% |
| callbacks_present(op) | 0/51 | 0.0% |
| doc_has_webhooks | 0/51 | 0.0% |
| desc_mentions_callback | 9/51 | 17.6% |
| idempotency_header_param | 0/51 | 0.0% |
| party_id_param | 0/51 | 0.0% |
| x_extensions_present | 0/51 | 0.0% |
| resource_schema_found | 40/51 | 78.4% |
| resource_schema_party_field | 22/51 | 43.1% |

**gt_class = x** (n=86)

| field | count | percent |
|---|---|---|
| security_present | 83/86 | 96.5% |
| security_scopes_nonempty | 83/86 | 96.5% |
| requestBody_present | 79/86 | 91.9% |
| requestBody_party_money | 31/86 | 36.0% |
| has202 | 25/86 | 29.1% |
| callbacks_present(op) | 39/86 | 45.3% |
| doc_has_webhooks | 0/86 | 0.0% |
| desc_mentions_callback | 19/86 | 22.1% |
| idempotency_header_param | 0/86 | 0.0% |
| party_id_param | 0/86 | 0.0% |
| x_extensions_present | 0/86 | 0.0% |
| resource_schema_found | 35/86 | 40.7% |
| resource_schema_party_field | 7/86 | 8.1% |

**holdout1 — split by gt_class**

**gt_class = w** (n=140)

| field | count | percent |
|---|---|---|
| security_present | 50/140 | 35.7% |
| security_scopes_nonempty | 0/140 | 0.0% |
| requestBody_present | 64/140 | 45.7% |
| requestBody_party_money | 9/140 | 6.4% |
| has202 | 1/140 | 0.7% |
| callbacks_present(op) | 0/140 | 0.0% |
| doc_has_webhooks | 62/140 | 44.3% |
| desc_mentions_callback | 6/140 | 4.3% |
| idempotency_header_param | 0/140 | 0.0% |
| party_id_param | 65/140 | 46.4% |
| x_extensions_present | 62/140 | 44.3% |
| resource_schema_found | 126/140 | 90.0% |
| resource_schema_party_field | 55/140 | 39.3% |

**gt_class = x** (n=67)

| field | count | percent |
|---|---|---|
| security_present | 44/67 | 65.7% |
| security_scopes_nonempty | 0/67 | 0.0% |
| requestBody_present | 57/67 | 85.1% |
| requestBody_party_money | 18/67 | 26.9% |
| has202 | 4/67 | 6.0% |
| callbacks_present(op) | 0/67 | 0.0% |
| doc_has_webhooks | 19/67 | 28.4% |
| desc_mentions_callback | 1/67 | 1.5% |
| idempotency_header_param | 0/67 | 0.0% |
| party_id_param | 51/67 | 76.1% |
| x_extensions_present | 25/67 | 37.3% |
| resource_schema_found | 50/67 | 74.6% |
| resource_schema_party_field | 16/67 | 23.9% |

**holdout2 — split by gt_class**

**gt_class = r** (n=104)

| field | count | percent |
|---|---|---|
| security_present | 8/104 | 7.7% |
| security_scopes_nonempty | 0/104 | 0.0% |
| requestBody_present | 11/104 | 10.6% |
| requestBody_party_money | 7/104 | 6.7% |
| has202 | 0/104 | 0.0% |
| callbacks_present(op) | 0/104 | 0.0% |
| doc_has_webhooks | 0/104 | 0.0% |
| desc_mentions_callback | 4/104 | 3.8% |
| idempotency_header_param | 5/104 | 4.8% |
| party_id_param | 7/104 | 6.7% |
| x_extensions_present | 96/104 | 92.3% |
| resource_schema_found | 93/104 | 89.4% |
| resource_schema_party_field | 35/104 | 33.7% |

**gt_class = w** (n=63)

| field | count | percent |
|---|---|---|
| security_present | 2/63 | 3.2% |
| security_scopes_nonempty | 0/63 | 0.0% |
| requestBody_present | 44/63 | 69.8% |
| requestBody_party_money | 1/63 | 1.6% |
| has202 | 1/63 | 1.6% |
| callbacks_present(op) | 0/63 | 0.0% |
| doc_has_webhooks | 0/63 | 0.0% |
| desc_mentions_callback | 4/63 | 6.3% |
| idempotency_header_param | 0/63 | 0.0% |
| party_id_param | 2/63 | 3.2% |
| x_extensions_present | 58/63 | 92.1% |
| resource_schema_found | 51/63 | 81.0% |
| resource_schema_party_field | 17/63 | 27.0% |

**gt_class = x** (n=53)

| field | count | percent |
|---|---|---|
| security_present | 17/53 | 32.1% |
| security_scopes_nonempty | 0/53 | 0.0% |
| requestBody_present | 48/53 | 90.6% |
| requestBody_party_money | 20/53 | 37.7% |
| has202 | 1/53 | 1.9% |
| callbacks_present(op) | 0/53 | 0.0% |
| doc_has_webhooks | 0/53 | 0.0% |
| desc_mentions_callback | 8/53 | 15.1% |
| idempotency_header_param | 17/53 | 32.1% |
| party_id_param | 3/53 | 5.7% |
| x_extensions_present | 51/53 | 96.2% |
| resource_schema_found | 24/53 | 45.3% |
| resource_schema_party_field | 11/53 | 20.8% |

**ALL — split by gt_class**

**gt_class = r** (n=259)

| field | count | percent |
|---|---|---|
| security_present | 160/259 | 61.8% |
| security_scopes_nonempty | 149/259 | 57.5% |
| requestBody_present | 67/259 | 25.9% |
| requestBody_party_money | 27/259 | 10.4% |
| has202 | 2/259 | 0.8% |
| callbacks_present(op) | 3/259 | 1.2% |
| doc_has_webhooks | 0/259 | 0.0% |
| desc_mentions_callback | 5/259 | 1.9% |
| idempotency_header_param | 5/259 | 1.9% |
| party_id_param | 8/259 | 3.1% |
| x_extensions_present | 96/259 | 37.1% |
| resource_schema_found | 177/259 | 68.3% |
| resource_schema_party_field | 61/259 | 23.6% |

**gt_class = w** (n=254)

| field | count | percent |
|---|---|---|
| security_present | 102/254 | 40.2% |
| security_scopes_nonempty | 50/254 | 19.7% |
| requestBody_present | 125/254 | 49.2% |
| requestBody_party_money | 13/254 | 5.1% |
| has202 | 22/254 | 8.7% |
| callbacks_present(op) | 0/254 | 0.0% |
| doc_has_webhooks | 62/254 | 24.4% |
| desc_mentions_callback | 19/254 | 7.5% |
| idempotency_header_param | 0/254 | 0.0% |
| party_id_param | 67/254 | 26.4% |
| x_extensions_present | 120/254 | 47.2% |
| resource_schema_found | 217/254 | 85.4% |
| resource_schema_party_field | 94/254 | 37.0% |

**gt_class = x** (n=206)

| field | count | percent |
|---|---|---|
| security_present | 144/206 | 69.9% |
| security_scopes_nonempty | 83/206 | 40.3% |
| requestBody_present | 184/206 | 89.3% |
| requestBody_party_money | 69/206 | 33.5% |
| has202 | 30/206 | 14.6% |
| callbacks_present(op) | 39/206 | 18.9% |
| doc_has_webhooks | 19/206 | 9.2% |
| desc_mentions_callback | 28/206 | 13.6% |
| idempotency_header_param | 17/206 | 8.3% |
| party_id_param | 54/206 | 26.2% |
| x_extensions_present | 76/206 | 36.9% |
| resource_schema_found | 109/206 | 52.9% |
| resource_schema_party_field | 34/206 | 16.5% |

## Distinct security scope strings per vendor (top 20)

**adyen** (0 distinct scopes)

_none_

**ApplicationEndpointDiscovery** (1 distinct scopes)

| scope | count |
|---|---|
| application-endpoint-discovery:app-endpoints:read | 1 |

**ApplicationEndpointRegistration** (4 distinct scopes)

| scope | count |
|---|---|
| application-endpoint-registration:application-endpoints:read | 2 |
| application-endpoint-registration:application-endpoints:write | 1 |
| application-endpoint-registration:application-endpoints:update | 1 |
| application-endpoint-registration:application-endpoints:delete | 1 |

**ApplicationProfiles** (4 distinct scopes)

| scope | count |
|---|---|
| application-profiles:create | 1 |
| application-profiles:update | 1 |
| application-profiles:read | 1 |
| application-profiles:delete | 1 |

**BlockchainPublicAddress** (4 distinct scopes)

| scope | count |
|---|---|
| blockchain-public-address-validation:create | 1 |
| blockchain-public-address:read | 1 |
| blockchain-public-address:create | 1 |
| blockchain-public-address:delete | 1 |

**box** (0 distinct scopes)

_none_

**CallForwardingSignal** (2 distinct scopes)

| scope | count |
|---|---|
| call-forwarding-signal:unconditional-call-forwardings:read | 1 |
| call-forwarding-signal:call-forwardings:read | 1 |

**CapabilitiesAndRuntimeRestrictions** (1 distinct scopes)

| scope | count |
|---|---|
| camara-capability:read | 1 |

**CarrierBillingCheckOut** (5 distinct scopes)

| scope | count |
|---|---|
| carrier-billing-refund:refunds:read | 3 |
| carrier-billing:payments:write | 3 |
| carrier-billing:payments:create | 2 |
| carrier-billing:payments:read | 2 |
| carrier-billing-refund:refunds:create | 1 |

**ClickToDial** (4 distinct scopes)

| scope | count |
|---|---|
| click-to-dial:calls:create | 1 |
| click-to-dial:calls:read | 1 |
| click-to-dial:calls:delete | 1 |
| click-to-dial:recordings:read | 1 |

**ConnectedNetworkType** (4 distinct scopes)

| scope | count |
|---|---|
| connected-network-type-subscriptions:read | 2 |
| connected-network-type-subscriptions:org.camaraproject.connected-network-type-subscriptions.v0.network-type-changed:create | 1 |
| connected-network-type-subscriptions:delete | 1 |
| connected-network-type:read | 1 |

**ConnectivityInsights** (4 distinct scopes)

| scope | count |
|---|---|
| connectivity-insights-subscriptions:read | 2 |
| connectivity-insights-subscriptions:org.camaraproject.connectivity-insights-subscriptions.v0.network-quality:create | 1 |
| connectivity-insights-subscriptions:delete | 1 |
| connectivity-insights:check | 1 |

**ConsentInfo** (1 distinct scopes)

| scope | count |
|---|---|
| consent-info:retrieve | 1 |

**ConsentManagement** (3 distinct scopes)

| scope | count |
|---|---|
| consent-management:create | 1 |
| consent-management:update | 1 |
| consent-management:retrieve-info | 1 |

**CustomerInsights** (1 distinct scopes)

| scope | count |
|---|---|
| customer-insights:scoring:read | 1 |

**DedicatedNetworks** (11 distinct scopes)

| scope | count |
|---|---|
| dedicated-network-accesses:accesses:read | 2 |
| dedicated-network-areas:areas:read | 2 |
| dedicated-network-profiles:profiles:read | 2 |
| dedicated-network:networks:read | 2 |
| dedicated-network-accesses:accesses:create | 1 |
| dedicated-network-accesses:accesses:delete | 1 |
| dedicated-network-accesses:devices:read | 1 |
| dedicated-network-accesses:devices:add | 1 |
| dedicated-network-accesses:devices:remove | 1 |
| dedicated-network:networks:create | 1 |
| dedicated-network:networks:delete | 1 |

**DeviceAuthenticity** (1 distinct scopes)

| scope | count |
|---|---|
| device-authenticity:check-status | 1 |

**DeviceDataVolume** (7 distinct scopes)

| scope | count |
|---|---|
| device-data-volume-subscriptions:read | 2 |
| device-data-volume:read | 2 |
| device-data-volume-subscriptions:org.camaraproject.device-data-volume-subscriptions.v0.data-50-percent-remaining:create | 1 |
| device-data-volume-subscriptions:org.camaraproject.device-data-volume-subscriptions.v0.data-25-percent-remaining:create | 1 |
| device-data-volume-subscriptions:org.camaraproject.device-data-volume-subscriptions.v0.data-10-percent-remaining:create | 1 |
| device-data-volume-subscriptions:org.camaraproject.device-data-volume-subscriptions.v0.data-00-percent-remaining:create | 1 |
| device-data-volume-subscriptions:delete | 1 |

**DeviceIdentifier** (4 distinct scopes)

| scope | count |
|---|---|
| device-identifier:retrieve-identifier | 1 |
| device-identifier:retrieve-type | 1 |
| device-identifier:retrieve-ppid | 1 |
| device-identifier:match-identifier | 1 |

**DeviceLocation** (6 distinct scopes)

| scope | count |
|---|---|
| geofencing-subscriptions:read | 2 |
| geofencing-subscriptions:org.camaraproject.geofencing-subscriptions.v0.area-entered:create | 1 |
| geofencing-subscriptions:org.camaraproject.geofencing-subscriptions.v0.area-left:create | 1 |
| geofencing-subscriptions:delete | 1 |
| location-retrieval:read | 1 |
| location-verification:verify | 1 |

**DeviceMediaStreamingRate** (1 distinct scopes)

| scope | count |
|---|---|
| media-streaming-rate:retrieve-maximum-downstream-media-rate | 1 |

**DeviceReachabilityStatus** (6 distinct scopes)

| scope | count |
|---|---|
| device-reachability-status-subscriptions:read | 2 |
| device-reachability-status-subscriptions:org.camaraproject.device-reachability-status-subscriptions.v0.reachability-data:create | 1 |
| device-reachability-status-subscriptions:org.camaraproject.device-reachability-status-subscriptions.v0.reachability-sms:create | 1 |
| device-reachability-status-subscriptions:org.camaraproject.device-reachability-status-subscriptions.v0.reachability-disconnected:create | 1 |
| device-reachability-status-subscriptions:delete | 1 |
| device-reachability-status:read | 1 |

**DeviceRoamingStatus** (7 distinct scopes)

| scope | count |
|---|---|
| device-roaming-status-subscriptions:read | 2 |
| device-roaming-status-subscriptions:org.camaraproject.device-roaming-status-subscriptions.v0.roaming-status:create | 1 |
| device-roaming-status-subscriptions:org.camaraproject.device-roaming-status-subscriptions.v0.roaming-on:create | 1 |
| device-roaming-status-subscriptions:org.camaraproject.device-roaming-status-subscriptions.v0.roaming-off:create | 1 |
| device-roaming-status-subscriptions:org.camaraproject.device-roaming-status-subscriptions.v0.roaming-change-country:create | 1 |
| device-roaming-status-subscriptions:delete | 1 |
| device-roaming-status:read | 1 |

**DeviceStatus** (17 distinct scopes)

| scope | count |
|---|---|
| connected-network-type-subscriptions:read | 2 |
| device-reachability-status-subscriptions:read | 2 |
| device-roaming-status-subscriptions:read | 2 |
| connected-network-type-subscriptions:org.camaraproject.connected-network-type-subscriptions.v0.network-type-changed:create | 1 |
| connected-network-type-subscriptions:delete | 1 |
| connected-network-type:read | 1 |
| device-reachability-status-subscriptions:org.camaraproject.device-reachability-status-subscriptions.v0.reachability-data:create | 1 |
| device-reachability-status-subscriptions:org.camaraproject.device-reachability-status-subscriptions.v0.reachability-sms:create | 1 |
| device-reachability-status-subscriptions:org.camaraproject.device-reachability-status-subscriptions.v0.reachability-disconnected:create | 1 |
| device-reachability-status-subscriptions:delete | 1 |
| device-reachability-status:read | 1 |
| device-roaming-status-subscriptions:org.camaraproject.device-roaming-status-subscriptions.v0.roaming-status:create | 1 |
| device-roaming-status-subscriptions:org.camaraproject.device-roaming-status-subscriptions.v0.roaming-on:create | 1 |
| device-roaming-status-subscriptions:org.camaraproject.device-roaming-status-subscriptions.v0.roaming-off:create | 1 |
| device-roaming-status-subscriptions:org.camaraproject.device-roaming-status-subscriptions.v0.roaming-change-country:create | 1 |
| device-roaming-status-subscriptions:delete | 1 |
| device-roaming-status:read | 1 |

**DeviceSwap** (3 distinct scopes)

| scope | count |
|---|---|
| device-swap | 2 |
| device-swap:retrieve-date | 1 |
| device-swap:check | 1 |

**DeviceVisitLocation** (1 distinct scopes)

| scope | count |
|---|---|
| device-visit-location:retrieve | 1 |

**EdgeApplicationManagement** (11 distinct scopes)

| scope | count |
|---|---|
| edge-application-management:apps:read | 2 |
| edge-application-management:instances:read | 2 |
| edge-application-management:deployments:read | 2 |
| edge-application-management:apps:write | 1 |
| edge-application-management:apps:delete | 1 |
| edge-application-management:instances:write | 1 |
| edge-application-management:instances:delete | 1 |
| edge-application-management:deployments:write | 1 |
| edge-application-management:deployments:delete | 1 |
| edge-application-management:deployments:update | 1 |
| edge-application-management:edge-cloud-zones:read | 1 |

**EnergyFootprintNotification** (2 distinct scopes)

| scope | count |
|---|---|
| energy-footprint-notification:calculate-energy-consumption | 1 |
| energy-footprint-notification:calculate-carbon-footprint | 1 |

**eSimRemoteManagement** (4 distinct scopes)

| scope | count |
|---|---|
| esim-remote-management:query | 1 |
| esim-remote-management:oper | 1 |
| esim-remote-management:downloadedlist | 1 |
| esim-remote-management:download | 1 |

**github** (0 distinct scopes)

_none_

**HighThroughputElasticNetworks** (2 distinct scopes)

| scope | count |
|---|---|
| high_throughput_elastic_network:read | 1 |
| high_throughput_elastic_network:write | 1 |

**InHomeDeviceManagement** (2 distinct scopes)

| scope | count |
|---|---|
| inhome.device.read | 3 |
| inhome.device.write | 3 |

**IoTDeviceManagement** (7 distinct scopes)

| scope | count |
|---|---|
| iot-device-management:esim-profiles:download | 1 |
| iot-device-management:esim-profiles:enable | 1 |
| iot-device-management:esim-profiles:disable | 1 |
| iot-device-management:esim-profiles:delete | 1 |
| iot-device-management:esim-profiles:set-fallback | 1 |
| iot-device-management:esim-profiles:retrieve-status | 1 |
| iot-device-management:esim-profiles:retrieve-operation | 1 |

**IoTNetworkOptimization** (2 distinct scopes)

| scope | count |
|---|---|
| iot-management:power-saving:write | 1 |
| iot-management:power-saving:read | 1 |

**IoTSIMFraudPrevention** (6 distinct scopes)

| scope | count |
|---|---|
| iot-sim-fraud-prevention-subscriptions:read | 2 |
| iot-sim-fraud-prevention-subscriptions:subscribe | 1 |
| iot-sim-fraud-prevention-subscriptions:delete | 1 |
| iot-sim-fraud-prevention:bind | 1 |
| iot-sim-fraud-prevention:unbind | 1 |
| iot-sim-fraud-prevention:query | 1 |

**KnowYourCustomer** (0 distinct scopes)

_none_

**KnowYourCustomerAgeVerification** (1 distinct scopes)

| scope | count |
|---|---|
| kyc-age-verification:verify | 1 |

**KnowYourCustomerFill-in** (27 distinct scopes)

| scope | count |
|---|---|
| kyc-fill-in:set-all | 1 |
| kyc-fill-in:phoneNumber | 1 |
| kyc-fill-in:idDocument | 1 |
| kyc-fill-in:idDocumentType | 1 |
| kyc-fill-in:idDocumentExpiryDate | 1 |
| kyc-fill-in:bankAccountNumber | 1 |
| kyc-fill-in:name | 1 |
| kyc-fill-in:givenName | 1 |
| kyc-fill-in:familyName | 1 |
| kyc-fill-in:nameKanaHankaku | 1 |
| kyc-fill-in:nameKanaZenkaku | 1 |
| kyc-fill-in:middleNames | 1 |
| kyc-fill-in:familyNameAtBirth | 1 |
| kyc-fill-in:address | 1 |
| kyc-fill-in:streetName | 1 |
| kyc-fill-in:streetNumber | 1 |
| kyc-fill-in:postalCode | 1 |
| kyc-fill-in:region | 1 |
| kyc-fill-in:locality | 1 |
| kyc-fill-in:country | 1 |

**KnowYourCustomerMatch** (1 distinct scopes)

| scope | count |
|---|---|
| kyc-match:match | 1 |

**ModelAsAService** (17 distinct scopes)

| scope | count |
|---|---|
| knowledge-base:knowledge-bases:read | 2 |
| knowledge-base:tools:read | 2 |
| qa-assistant-manage:assistants:read | 2 |
| knowledge-base:knowledge-bases:create | 1 |
| knowledge-base:knowledge-bases:update | 1 |
| knowledge-base:knowledge-bases:delete | 1 |
| knowledge-base:documents:create | 1 |
| knowledge-base:documents:read | 1 |
| knowledge-base:documents:delete | 1 |
| knowledge-base:tools:create | 1 |
| knowledge-base:tools:update | 1 |
| knowledge-base:tools:delete | 1 |
| knowledge-base:tools:call | 1 |
| qa-assistant-manage:assistants:create | 1 |
| qa-assistant-manage:assistants:update | 1 |
| qa-assistant-manage:assistants:delete | 1 |
| qa-assistant-service:answer:read | 1 |

**MostFrequentLocation** (1 distinct scopes)

| scope | count |
|---|---|
| most-frequent-location:verify | 1 |

**MultiPointVPN** (5 distinct scopes)

| scope | count |
|---|---|
| multi-point-vpn:network:create | 1 |
| multi-point-vpn:network:update | 1 |
| multi-point-vpn:network:read | 1 |
| multi-point-vpn:network:delete | 1 |
| multi-point-vpn:assessment:assess | 1 |

**NetworkAccessManagement** (5 distinct scopes)

| scope | count |
|---|---|
| network-access-devices:reboot | 7 |
| network-access-domains:trust-domains | 6 |
| network-access-domains:devices | 5 |
| network-access-domains:services:read | 2 |
| network-access-domains:trust-domains:read-all | 2 |

**NetworkInsights** (2 distinct scopes)

| scope | count |
|---|---|
| network-health-assessment:health-scores:read | 1 |
| network-traffic-analysis:traffic-analysis:read | 1 |

**NetworkSliceBooking** (7 distinct scopes)

| scope | count |
|---|---|
| network-slice-assignment:devices:assign | 1 |
| network-slice-assignment:devices:get | 1 |
| network-slice-assignment:devices:delete | 1 |
| network-slice-assignment:devices:retrieve | 1 |
| network-slice-booking:slices:create | 1 |
| network-slice-booking:slices:delete | 1 |
| network-slice-booking:slices:get | 1 |

**NumberRecycling** (1 distinct scopes)

| scope | count |
|---|---|
| number-recycling:check | 1 |

**NumberVerification** (2 distinct scopes)

| scope | count |
|---|---|
| number-verification:verify | 1 |
| number-verification:device-phone-number:read | 1 |

**OptimalEdgeDiscovery** (2 distinct scopes)

| scope | count |
|---|---|
| optimal-edge-discovery:regions:read | 1 |
| optimal-edge-discovery:edge-zones:read | 1 |

**OTPValidation** (1 distinct scopes)

| scope | count |
|---|---|
| one-time-password-sms:send-validate | 2 |

**pagerduty** (0 distinct scopes)

_none_

**PopulationDensityData** (1 distinct scopes)

| scope | count |
|---|---|
| population-density-data:read | 1 |

**PredictiveConnectivityData** (1 distinct scopes)

| scope | count |
|---|---|
| predictive-connectivity-data:read | 1 |

**QoSBooking** (11 distinct scopes)

| scope | count |
|---|---|
| qos-booking-and-assignment:qos-bookings:create | 1 |
| qos-booking-and-assignment:qos-bookings:read | 1 |
| qos-booking-and-assignment:qos-bookings:delete | 1 |
| qos-booking-and-assignment:qos-bookings:devices:create | 1 |
| qos-booking-and-assignment:qos-bookings:devices:read | 1 |
| qos-booking-and-assignment:qos-bookings:devices:delete | 1 |
| qos-booking-and-assignment:qos-bookings:retrieve-by-device | 1 |
| qos-booking:device-qos-bookings:create | 1 |
| qos-booking:device-qos-bookings:read | 1 |
| qos-booking:device-qos-bookings:delete | 1 |
| qos-booking:device-qos-bookings:retrieve-by-device | 1 |

**QualityOnDemand** (10 distinct scopes)

| scope | count |
|---|---|
| qos-profiles:read | 2 |
| qos-provisioning:qos-assignments:create | 1 |
| qos-provisioning:qos-assignments:read | 1 |
| qos-provisioning:qos-assignments:delete | 1 |
| qos-provisioning:qos-assignments:read-by-device | 1 |
| quality-on-demand:sessions:create | 1 |
| quality-on-demand:sessions:read | 1 |
| quality-on-demand:sessions:delete | 1 |
| quality-on-demand:sessions:update | 1 |
| quality-on-demand:sessions:retrieve-by-device | 1 |

**RegionDeviceCount** (1 distinct scopes)

| scope | count |
|---|---|
| region-device-count:count | 1 |

**SessionInsights** (5 distinct scopes)

| scope | count |
|---|---|
| session-insights:sessions:create | 1 |
| session-insights:sessions:read | 1 |
| session-insights:sessions:delete | 1 |
| session-insights:sessions:retrieve-by-device | 1 |
| session-insights:sessions:write | 1 |

**SimpleEdgeDiscovery** (1 distinct scopes)

| scope | count |
|---|---|
| simple-edge-discovery:read | 1 |

**SimSwap** (7 distinct scopes)

| scope | count |
|---|---|
| sim-swap | 3 |
| sim-swap-subscriptions:read | 2 |
| sim-swap-subscriptions:org.camaraproject.sim-swap-subscriptions.v0.swapped:create | 1 |
| sim-swap-subscriptions:delete | 1 |
| sim-swap:retrieve-date | 1 |
| sim-swap:check | 1 |
| sim-swap:retrieve-age-band | 1 |

**SponsoredData** (0 distinct scopes)

_none_

**stripe** (0 distinct scopes)

_none_

**SubscriptionStatus** (1 distinct scopes)

| scope | count |
|---|---|
| subscription-status:retrieve-subscription-status | 1 |

**Tenure** (1 distinct scopes)

| scope | count |
|---|---|
| kyc-tenure:check-tenure | 1 |

**TrafficInfluence** (5 distinct scopes)

| scope | count |
|---|---|
| traffic-influence:traffic-influences:read | 2 |
| traffic-influence:traffic-influences:write | 1 |
| traffic-influence:traffic-influence-devices:write | 1 |
| traffic-influence:traffic-influences:update | 1 |
| traffic-influence:traffic-influences:delete | 1 |

**twilio** (0 distinct scopes)

_none_

**VerifiedCaller** (5 distinct scopes)

| scope | count |
|---|---|
| brand-registration:read | 2 |
| brand-registration:create | 1 |
| brand-registration:delete | 1 |
| brand-registration:update | 1 |
| verified-caller:create | 1 |

**WebRTC** (14 distinct scopes)

| scope | count |
|---|---|
| webrtc-events-subscriptions:read | 2 |
| webrtc-registration:sessions:read | 2 |
| webrtc-call-handling:sessions:create | 1 |
| webrtc-call-handling:sessions:read | 1 |
| webrtc-call-handling:sessions:delete | 1 |
| webrtc-call-handling:sessions:write | 1 |
| webrtc-events-subscriptions:org.camaraproject.webrtc-events-subscriptions.v0.session-status:create | 1 |
| webrtc-events-subscriptions:org.camaraproject.webrtc-events-subscriptions.v0.session-invitation:create | 1 |
| webrtc-events-subscriptions:org.camaraproject.webrtc-events-subscriptions.v0.registration-ends:create | 1 |
| webrtc-events-subscriptions:update | 1 |
| webrtc-events-subscriptions:delete | 1 |
| webrtc-registration:sessions:create | 1 |
| webrtc-registration:sessions:write | 1 |
| webrtc-registration:sessions:delete | 1 |

## Top 30 requestBody property names overall, with gt_class split

| property | total | r | w | x |
|---|---|---|---|---|
| device | 37 | 28 | 0 | 9 |
| sink | 34 | 3 | 1 | 30 |
| sinkCredential | 33 | 3 | 2 | 28 |
| FriendlyName | 31 | 0 | 15 | 16 |
| phoneNumber | 28 | 19 | 2 | 7 |
| merchantAccount | 18 | 5 | 0 | 13 |
| name | 16 | 3 | 6 | 7 |
| StatusCallback | 16 | 0 | 2 | 14 |
| config | 15 | 0 | 1 | 14 |
| protocol | 14 | 0 | 0 | 14 |
| types | 14 | 0 | 0 | 14 |
| StatusCallbackMethod | 14 | 0 | 2 | 12 |
| amount | 12 | 2 | 0 | 10 |
| description | 11 | 0 | 6 | 5 |
| applicationInfo | 11 | 1 | 0 | 10 |
| Status | 10 | 0 | 3 | 7 |
| reference | 10 | 1 | 0 | 9 |
| subscriptionRequest | 9 | 0 | 0 | 9 |
| VoiceUrl | 9 | 0 | 3 | 6 |
| VoiceMethod | 9 | 0 | 3 | 6 |
| VoiceFallbackUrl | 9 | 0 | 3 | 6 |
| VoiceFallbackMethod | 9 | 0 | 3 | 6 |
| ApiVersion | 8 | 0 | 3 | 5 |
| SmsUrl | 8 | 0 | 3 | 5 |
| SmsMethod | 8 | 0 | 3 | 5 |
| SmsFallbackUrl | 8 | 0 | 3 | 5 |
| SmsFallbackMethod | 8 | 0 | 3 | 5 |
| displayName | 7 | 0 | 3 | 4 |
| VoiceCallerIdLookup | 7 | 0 | 2 | 5 |
| enhancedSchemeData | 7 | 0 | 0 | 7 |

## Distinct x- extension names (operation-level), with counts

| extension | count |
|---|---|
| x-box-tag | 99 |
| x-github | 81 |
| x-pd-requires-scope | 78 |
| x-box-unsupported-on-free-developer | 32 |
| x-sortIndex | 28 |
| x-methodName | 28 |
| x-twilio | 6 |
| x-box-enable-explorer | 5 |
| x-addedInVersion | 5 |
| x-stability-level | 4 |
| x-box-requires-admin | 4 |
| x-github-breaking-changes | 2 |
| x-box-reference-category | 1 |
| x-deprecatedInVersion | 1 |

