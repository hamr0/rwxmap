# M1-C11v: variation sweep on the C11 floor + raise-only shape

scoreV(row, cfg) generalises run-c11.mjs's scoreC11 (see the doc comment on
scoreV in poc/m1/arbiter/run-c11v.mjs for the full cfg field list). run-c11.mjs
is not modified.

**Admission is judged on camara + holdout1 only.** holdout2 is scored and
printed for every run below, but it is never used to decide anything — it is
the still-unseen "clean exam" set (D24: tune/fit only on camara + holdout1,
holdout2 scored once per rule change and never used to pick shapes).

## V1 baseline

Defaults: liveVerbs=LIVE_VERBS, partyNouns=PARTY_NOUNS+repository,
readVerbs=C11 READ_VERBS minus validate, readListOn=true, readSummaryOn=false,
callerPhraseOn=true, callerPathOn=false, partySource=both, patchOwnOn=false,
postOwnOn=false.

| set | n | exact | leaks | over_tight | leak_pct | over_tight_pct |
| --- | --- | --- | --- | --- | --- | --- |
| camara | 292 | 253 | 1 | 38 | 0.3 | 13.0 |
| holdout1 | 207 | 155 | 2 | 50 | 1.0 | 24.2 |
| holdout2 | 220 | 193 | 0 | 27 | 0.0 | 12.3 |

### V1 leaking rows — 3 rows

| set | repo | method | path | operationId | gt | pred | rule | evidence | summary |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| camara | TrafficInfluence | DELETE | /traffic-influences/{trafficInfluenceID} | deleteTrafficInfluence | x | w | floor |  | Delete an existing TrafficInfluence resource |
| holdout1 | github | PUT | /repos/{owner}/{repo}/issues/{issue_number}/issue-field-values | issues/set-issue-field-values | x | w | floor |  | Set issue field values for an issue |
| holdout1 | github | DELETE | /repos/{owner}/{repo}/issues/{issue_number}/sub_issue | issues/remove-sub-issue | x | w | floor |  | Remove sub-issue |

## V3a: readVerbs += get (readSummaryOn off)

| set | n | exact | leaks | over_tight | leak_pct | over_tight_pct |
| --- | --- | --- | --- | --- | --- | --- |
| camara | 292 | 262 | 1 | 29 | 0.3 | 9.9 |
| holdout1 | 207 | 155 | 2 | 50 | 1.0 | 24.2 |
| holdout2 | 220 | 195 | 0 | 25 | 0.0 | 11.4 |

Delta vs V1:

- camara: leaks +0, over_tight -9
- holdout1: leaks +0, over_tight +0
- holdout2: leaks +0, over_tight -2

### V3a rows changed vs V1 — 11 rows

| set | repo | method | path | operationId | gt | pred_v1 | pred_new | evidence | summary |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| camara | ApplicationEndpointDiscovery | POST | /retrieve-optimal-app-endpoints | getOptimalAppEndpoints | r | x | r | opid:get | Returns the Endpoint(s) of the optimal Application Instance(s) to the ... |
| camara | ConnectedNetworkType | POST | /retrieve | getConnectedNetworkType | r | x | r | opid:get | Get the connected network type |
| camara | DeviceReachabilityStatus | POST | /retrieve | getReachabilityStatus | r | x | r | opid:get | Get the current reachability status information |
| camara | DeviceRoamingStatus | POST | /retrieve | getRoamingStatus | r | x | r | opid:get | Get the current roaming status and the country information |
| camara | DeviceStatus | POST | /retrieve | getConnectedNetworkType | r | x | r | opid:get | Get the connected network type |
| camara | DeviceStatus | POST | /retrieve | getReachabilityStatus | r | x | r | opid:get | Get the current reachability status information |
| camara | DeviceStatus | POST | /retrieve | getRoamingStatus | r | x | r | opid:get | Get the current roaming status and the country information |
| camara | IoTDeviceManagement | POST | /retrieve-status | getEsimProfileStatus | r | x | r | opid:get | Retrieve eSIM Profile status |
| camara | QualityOnDemand | POST | /retrieve-qos-assignment | getQosAssignmentByDevice | r | x | r | opid:get | Returns the assignment record details of the QoS profile assignment fo... |
| holdout2 | pagerduty | POST | /analytics/metrics/incidents/services | getAnalyticsMetricsIncidentsService | r | x | r | opid:get | Get aggregated service data |
| holdout2 | pagerduty | POST | /analytics/metrics/responders/all | getAnalyticsMetricsRespondersAll | r | x | r | opid:get | Get aggregated metrics for all responders |

### V3a leaking rows — 3 rows

| set | repo | method | path | operationId | gt | pred | rule | evidence | summary |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| camara | TrafficInfluence | DELETE | /traffic-influences/{trafficInfluenceID} | deleteTrafficInfluence | x | w | floor |  | Delete an existing TrafficInfluence resource |
| holdout1 | github | PUT | /repos/{owner}/{repo}/issues/{issue_number}/issue-field-values | issues/set-issue-field-values | x | w | floor |  | Set issue field values for an issue |
| holdout1 | github | DELETE | /repos/{owner}/{repo}/issues/{issue_number}/sub_issue | issues/remove-sub-issue | x | w | floor |  | Remove sub-issue |

## V3b: readSummaryOn=true (readVerbs unchanged)

| set | n | exact | leaks | over_tight | leak_pct | over_tight_pct |
| --- | --- | --- | --- | --- | --- | --- |
| camara | 292 | 255 | 2 | 35 | 0.7 | 12.0 |
| holdout1 | 207 | 155 | 2 | 50 | 1.0 | 24.2 |
| holdout2 | 220 | 193 | 0 | 27 | 0.0 | 12.3 |

Delta vs V1:

- camara: leaks +1, over_tight -3
- holdout1: leaks +0, over_tight +0
- holdout2: leaks +0, over_tight +0

### V3b rows changed vs V1 — 4 rows

| set | repo | method | path | operationId | gt | pred_v1 | pred_new | evidence | summary |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| camara | CapabilitiesAndRuntimeRestrictions | POST | /retrieve | postServiceCapability | x | x | r | summary:retrieve | Retrieve tailored service capabilities based on consumer context |
| camara | IoTDeviceManagement | POST | /retrieve-status | getEsimProfileStatus | r | x | r | summary:retrieve | Retrieve eSIM Profile status |
| camara | eSimRemoteManagement | POST | /profile/result/query | profileResultQuery | r | x | r | summary:query | Query profile operation result |
| camara | eSimRemoteManagement | POST | /profile/downloaded-list | profileList | r | x | r | summary:query | Query downloaded profile list |

### V3b leaking rows — 4 rows

| set | repo | method | path | operationId | gt | pred | rule | evidence | summary |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| camara | CapabilitiesAndRuntimeRestrictions | POST | /retrieve | postServiceCapability | x | r | read-verb | summary:retrieve | Retrieve tailored service capabilities based on consumer context |
| camara | TrafficInfluence | DELETE | /traffic-influences/{trafficInfluenceID} | deleteTrafficInfluence | x | w | floor |  | Delete an existing TrafficInfluence resource |
| holdout1 | github | PUT | /repos/{owner}/{repo}/issues/{issue_number}/issue-field-values | issues/set-issue-field-values | x | w | floor |  | Set issue field values for an issue |
| holdout1 | github | DELETE | /repos/{owner}/{repo}/issues/{issue_number}/sub_issue | issues/remove-sub-issue | x | w | floor |  | Remove sub-issue |

## V3c: readVerbs += get, readSummaryOn=true

| set | n | exact | leaks | over_tight | leak_pct | over_tight_pct |
| --- | --- | --- | --- | --- | --- | --- |
| camara | 292 | 263 | 2 | 27 | 0.7 | 9.2 |
| holdout1 | 207 | 155 | 2 | 50 | 1.0 | 24.2 |
| holdout2 | 220 | 199 | 0 | 21 | 0.0 | 9.5 |

Delta vs V1:

- camara: leaks +1, over_tight -11
- holdout1: leaks +0, over_tight +0
- holdout2: leaks +0, over_tight -6

### V3c rows changed vs V1 — 18 rows

| set | repo | method | path | operationId | gt | pred_v1 | pred_new | evidence | summary |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| camara | ApplicationEndpointDiscovery | POST | /retrieve-optimal-app-endpoints | getOptimalAppEndpoints | r | x | r | opid:get | Returns the Endpoint(s) of the optimal Application Instance(s) to the ... |
| camara | CapabilitiesAndRuntimeRestrictions | POST | /retrieve | postServiceCapability | x | x | r | summary:retrieve | Retrieve tailored service capabilities based on consumer context |
| camara | ConnectedNetworkType | POST | /retrieve | getConnectedNetworkType | r | x | r | opid:get | Get the connected network type |
| camara | DeviceReachabilityStatus | POST | /retrieve | getReachabilityStatus | r | x | r | opid:get | Get the current reachability status information |
| camara | DeviceRoamingStatus | POST | /retrieve | getRoamingStatus | r | x | r | opid:get | Get the current roaming status and the country information |
| camara | DeviceStatus | POST | /retrieve | getConnectedNetworkType | r | x | r | opid:get | Get the connected network type |
| camara | DeviceStatus | POST | /retrieve | getReachabilityStatus | r | x | r | opid:get | Get the current reachability status information |
| camara | DeviceStatus | POST | /retrieve | getRoamingStatus | r | x | r | opid:get | Get the current roaming status and the country information |
| camara | IoTDeviceManagement | POST | /retrieve-status | getEsimProfileStatus | r | x | r | opid:get | Retrieve eSIM Profile status |
| camara | QualityOnDemand | POST | /retrieve-qos-assignment | getQosAssignmentByDevice | r | x | r | opid:get | Returns the assignment record details of the QoS profile assignment fo... |
| camara | eSimRemoteManagement | POST | /profile/result/query | profileResultQuery | r | x | r | summary:query | Query profile operation result |
| camara | eSimRemoteManagement | POST | /profile/downloaded-list | profileList | r | x | r | summary:query | Query downloaded profile list |
| holdout2 | pagerduty | POST | /analytics/metrics/incidents/services | getAnalyticsMetricsIncidentsService | r | x | r | opid:get | Get aggregated service data |
| holdout2 | pagerduty | POST | /analytics/metrics/responders/all | getAnalyticsMetricsRespondersAll | r | x | r | opid:get | Get aggregated metrics for all responders |
| holdout2 | adyen | POST | /cardDetails | post-cardDetails | r | x | r | summary:get | Get the brands and other details of a card |
| holdout2 | adyen | POST | /donationCampaigns | post-donationCampaigns | r | x | r | summary:get | Get a list of donation campaigns. |
| holdout2 | adyen | POST | /paymentMethods | post-paymentMethods | r | x | r | summary:get | Get a list of available payment methods |
| holdout2 | adyen | POST | /paymentMethods/balance | post-paymentMethods-balance | r | x | r | summary:get | Get the balance of a gift card |

### V3c leaking rows — 4 rows

| set | repo | method | path | operationId | gt | pred | rule | evidence | summary |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| camara | CapabilitiesAndRuntimeRestrictions | POST | /retrieve | postServiceCapability | x | r | read-verb | summary:retrieve | Retrieve tailored service capabilities based on consumer context |
| camara | TrafficInfluence | DELETE | /traffic-influences/{trafficInfluenceID} | deleteTrafficInfluence | x | w | floor |  | Delete an existing TrafficInfluence resource |
| holdout1 | github | PUT | /repos/{owner}/{repo}/issues/{issue_number}/issue-field-values | issues/set-issue-field-values | x | w | floor |  | Set issue field values for an issue |
| holdout1 | github | DELETE | /repos/{owner}/{repo}/issues/{issue_number}/sub_issue | issues/remove-sub-issue | x | w | floor |  | Remove sub-issue |

## V4: callerPathOn=true

| set | n | exact | leaks | over_tight | leak_pct | over_tight_pct |
| --- | --- | --- | --- | --- | --- | --- |
| camara | 292 | 253 | 1 | 38 | 0.3 | 13.0 |
| holdout1 | 207 | 156 | 3 | 48 | 1.4 | 23.2 |
| holdout2 | 220 | 193 | 0 | 27 | 0.0 | 12.3 |

Delta vs V1:

- camara: leaks +0, over_tight +0
- holdout1: leaks +1, over_tight -2
- holdout2: leaks +0, over_tight +0

### V4 rows changed vs V1 — 3 rows

| set | repo | method | path | operationId | gt | pred_v1 | pred_new | evidence | summary |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| holdout1 | github | DELETE | /user/blocks/{username} | users/unblock | w | x | w | caller-path | Unblock a user |
| holdout1 | github | PUT | /user/codespaces/secrets/{secret_name}/repositories | codespaces/set-repositories-for-secret-for-authenticated-user | w | x | w | caller-path | Set selected repositories for a user secret |
| holdout1 | github | DELETE | /user/installations/{installation_id}/repositories/{repository_id} | apps/remove-repo-from-installation-for-authenticated-user | x | x | w | caller-path | Remove a repository from an app installation |

### V4 leaking rows — 4 rows

| set | repo | method | path | operationId | gt | pred | rule | evidence | summary |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| camara | TrafficInfluence | DELETE | /traffic-influences/{trafficInfluenceID} | deleteTrafficInfluence | x | w | floor |  | Delete an existing TrafficInfluence resource |
| holdout1 | github | PUT | /repos/{owner}/{repo}/issues/{issue_number}/issue-field-values | issues/set-issue-field-values | x | w | floor |  | Set issue field values for an issue |
| holdout1 | github | DELETE | /repos/{owner}/{repo}/issues/{issue_number}/sub_issue | issues/remove-sub-issue | x | w | floor |  | Remove sub-issue |
| holdout1 | github | DELETE | /user/installations/{installation_id}/repositories/{repository_id} | apps/remove-repo-from-installation-for-authenticated-user | x | w | floor | caller-path | Remove a repository from an app installation |

## V5: partySource='anytoken'

| set | n | exact | leaks | over_tight | leak_pct | over_tight_pct |
| --- | --- | --- | --- | --- | --- | --- |
| camara | 292 | 246 | 1 | 45 | 0.3 | 15.4 |
| holdout1 | 207 | 144 | 2 | 61 | 1.0 | 29.5 |
| holdout2 | 220 | 190 | 0 | 30 | 0.0 | 13.6 |

Delta vs V1:

- camara: leaks +0, over_tight +7
- holdout1: leaks +0, over_tight +11
- holdout2: leaks +0, over_tight +3

### V5 rows changed vs V1 — 21 rows

| set | repo | method | path | operationId | gt | pred_v1 | pred_new | evidence | summary |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| camara | ConnectedNetworkType | DELETE | /subscriptions/{subscriptionId} | deleteConnectedNetworkTypeSubscription | w | w | x | anytoken:network | Delete connected network type event subscription for a device |
| camara | DeviceDataVolume | DELETE | /subscriptions/{subscriptionId} | deleteDeviceDataVolumeSubscription | w | w | x | anytoken:device | Delete a device data volume event subscription |
| camara | DeviceReachabilityStatus | DELETE | /subscriptions/{subscriptionId} | deleteDeviceReachabilityStatusSubscription | w | w | x | anytoken:device | Delete a device reachability status event subscription for a device |
| camara | DeviceRoamingStatus | DELETE | /subscriptions/{subscriptionId} | deleteDeviceRoamingStatusSubscription | w | w | x | anytoken:device | Delete a device-roaming-status event subscription for a device |
| camara | DeviceStatus | DELETE | /subscriptions/{subscriptionId} | deleteConnectedNetworkTypeSubscription | w | w | x | anytoken:network | Delete connected network type event subscription for a device |
| camara | DeviceStatus | DELETE | /subscriptions/{subscriptionId} | deleteDeviceReachabilityStatusSubscription | w | w | x | anytoken:device | Delete a device reachability status event subscription for a device |
| camara | DeviceStatus | DELETE | /subscriptions/{subscriptionId} | deleteDeviceRoamingStatusSubscription | w | w | x | anytoken:device | Delete a device-roaming-status event subscription for a device |
| holdout1 | twilio | DELETE | /2010-04-01/Accounts/{AccountSid}/SIP/Domains/{DomainSid}/Auth/Calls/CredentialListMappings/{Sid}.json | DeleteSipAuthCallsCredentialListMapping | w | w | x | anytoken:call | Delete a credential list mapping from the requested domain |
| holdout1 | twilio | DELETE | /2010-04-01/Accounts/{AccountSid}/SIP/Domains/{DomainSid}/Auth/Calls/IpAccessControlListMappings/{Sid}.json | DeleteSipAuthCallsIpAccessControlListMapping | w | w | x | anytoken:call | Delete an IP Access Control List mapping from the requested domain |
| holdout1 | twilio | DELETE | /2010-04-01/Accounts/{AccountSid}/SIP/IpAccessControlLists/{Sid}.json | DeleteSipIpAccessControlList | w | w | x | anytoken:access | Delete an IpAccessControlList from the requested account |
| holdout1 | twilio | DELETE | /2010-04-01/Accounts/{AccountSid}/SIP/Domains/{DomainSid}/IpAccessControlListMappings/{Sid}.json | DeleteSipIpAccessControlListMapping | w | w | x | anytoken:access | Delete an IpAccessControlListMapping resource. |
| holdout1 | twilio | DELETE | /2010-04-01/Accounts/{AccountSid}/Calls/{CallSid}/UserDefinedMessageSubscriptions/{Sid}.json | DeleteUserDefinedMessageSubscription | w | w | x | anytoken:user | Delete a specific User Defined Message Subscription. |
| holdout1 | stripe | DELETE | /v1/customers/{customer}/cards/{id} | DeleteCustomersCustomerCardsId | w | w | x | anytoken:customer | Delete a customer source |
| holdout1 | stripe | DELETE | /v1/customers/{customer}/discount | DeleteCustomersCustomerDiscount | w | w | x | anytoken:customer | Delete a customer discount |
| holdout1 | stripe | DELETE | /v1/customers/{customer}/sources/{id} | DeleteCustomersCustomerSourcesId | w | w | x | anytoken:customer | Delete a customer source |
| holdout1 | stripe | DELETE | /v1/customers/{customer}/subscriptions/{subscription_exposed_id}/discount | DeleteCustomersCustomerSubscriptionsSubscriptionExposedIdDiscount | w | w | x | anytoken:customer | Delete a customer discount |
| holdout1 | stripe | DELETE | /v1/customers/{customer}/tax_ids/{id} | DeleteCustomersCustomerTaxIdsId | w | w | x | anytoken:customer | Delete a Customer tax ID |
| holdout1 | github | PUT | /enterprises/{enterprise}/dependabot/repository-access/default-level | dependabot/set-repository-access-default-level-for-enterprise | w | w | x | anytoken:repository | Set the default repository access level for Dependabot in an enterpris... |
| holdout2 | pagerduty | PUT | /users/{id}/notification_rules/{notification_rule_id} | updateUserNotificationRule | w | w | x | anytoken:user | Update a user's notification rule |
| holdout2 | pagerduty | PUT | /users/{id}/oncall_handoff_notification_rules/{oncall_handoff_notification_rule_id} | updateUserHandoffNotification | w | w | x | anytoken:user | Update a User's Handoff Notification Rule |
| holdout2 | pagerduty | PUT | /users/{id}/status_update_notification_rules/{status_update_notification_rule_id} | updateUserStatusUpdateNotificationRule | w | w | x | anytoken:user | Update a user's status update notification rule |

### V5 leaking rows — 3 rows

| set | repo | method | path | operationId | gt | pred | rule | evidence | summary |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| camara | TrafficInfluence | DELETE | /traffic-influences/{trafficInfluenceID} | deleteTrafficInfluence | x | w | floor |  | Delete an existing TrafficInfluence resource |
| holdout1 | github | PUT | /repos/{owner}/{repo}/issues/{issue_number}/issue-field-values | issues/set-issue-field-values | x | w | floor |  | Set issue field values for an issue |
| holdout1 | github | DELETE | /repos/{owner}/{repo}/issues/{issue_number}/sub_issue | issues/remove-sub-issue | x | w | floor |  | Remove sub-issue |

## V6a: partySource='summary'

| set | n | exact | leaks | over_tight | leak_pct | over_tight_pct |
| --- | --- | --- | --- | --- | --- | --- |
| camara | 292 | 252 | 2 | 38 | 0.7 | 13.0 |
| holdout1 | 207 | 165 | 4 | 38 | 1.9 | 18.4 |
| holdout2 | 220 | 195 | 0 | 25 | 0.0 | 11.4 |

Delta vs V1:

- camara: leaks +1, over_tight +0
- holdout1: leaks +2, over_tight -12
- holdout2: leaks +0, over_tight -2

### V6a rows changed vs V1 — 17 rows

| set | repo | method | path | operationId | gt | pred_v1 | pred_new | evidence | summary |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| camara | WebRTC | PUT | /sessions/{mediaSessionId}/status | updateSessionStatus | x | x | w |  | Update the status of the media session |
| holdout1 | stripe | DELETE | /v1/customers/{customer}/bank_accounts/{id} | DeleteCustomersCustomerBankAccountsId | w | x | w |  | Delete a customer source |
| holdout1 | github | PUT | /organizations/{org}/actions/cache/storage-limit | actions/set-actions-cache-storage-limit-for-organization | w | x | w |  | Set GitHub Actions cache storage limit for an organization |
| holdout1 | github | PUT | /orgs/{org}/actions/permissions | actions/set-github-actions-permissions-organization | w | x | w |  | Set GitHub Actions permissions for an organization |
| holdout1 | github | PUT | /orgs/{org}/actions/permissions/repositories | actions/set-selected-repositories-enabled-github-actions-organization | w | x | w |  | Set selected repositories enabled for GitHub Actions in an organizatio... |
| holdout1 | github | PUT | /orgs/{org}/actions/permissions/self-hosted-runners | actions/set-self-hosted-runners-permissions-organization | w | x | w |  | Set self-hosted runners settings for an organization |
| holdout1 | github | PUT | /orgs/{org}/actions/permissions/workflow | actions/set-github-actions-default-workflow-permissions-organization | w | x | w |  | Set default workflow permissions for an organization |
| holdout1 | github | DELETE | /orgs/{org}/members/{username}/codespaces/{codespace_name} | codespaces/delete-from-organization | x | x | w |  | Delete a codespace from the organization |
| holdout1 | github | DELETE | /orgs/{org}/organization-roles/users/{username} | orgs/revoke-all-org-roles-user | x | x | w |  | Remove all organization roles for a user |
| holdout1 | github | PUT | /repos/{owner}/{repo}/actions/permissions/access | actions/set-workflow-access-to-repository | w | x | w |  | Set the level of access for workflows outside of the repository |
| holdout1 | github | PUT | /repos/{owner}/{repo}/actions/permissions/selected-actions | actions/set-allowed-actions-repository | w | x | w |  | Set allowed actions and reusable workflows for a repository |
| holdout1 | github | PUT | /user/codespaces/secrets/{secret_name}/repositories | codespaces/set-repositories-for-secret-for-authenticated-user | w | x | w |  | Set selected repositories for a user secret |
| holdout1 | github | DELETE | /users/{username}/copilot-spaces/{space_number} | copilot-spaces/delete-for-user | w | x | w |  | Delete a Copilot Space for a user |
| holdout1 | github | DELETE | /users/{username}/copilot-spaces/{space_number}/resources/{space_resource_id} | copilot-spaces/delete-resource-for-user | w | x | w |  | Delete a resource from a Copilot Space for a user |
| holdout1 | github | DELETE | /users/{username}/projectsV2/{project_number}/items/{item_id} | projects/delete-item-for-user | w | x | w |  | Delete project item for user |
| holdout2 | box | PUT | /integration_mappings/teams/{integration_mapping_id} | put_integration_mappings_teams_id | w | x | w |  | Update Teams integration mapping |
| holdout2 | box | DELETE | /storage_policy_assignments/{storage_policy_assignment_id} | delete_storage_policy_assignments_id | w | x | w |  | Unassign storage policy |

### V6a leaking rows — 6 rows

| set | repo | method | path | operationId | gt | pred | rule | evidence | summary |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| camara | TrafficInfluence | DELETE | /traffic-influences/{trafficInfluenceID} | deleteTrafficInfluence | x | w | floor |  | Delete an existing TrafficInfluence resource |
| camara | WebRTC | PUT | /sessions/{mediaSessionId}/status | updateSessionStatus | x | w | floor |  | Update the status of the media session |
| holdout1 | github | DELETE | /orgs/{org}/members/{username}/codespaces/{codespace_name} | codespaces/delete-from-organization | x | w | floor |  | Delete a codespace from the organization |
| holdout1 | github | DELETE | /orgs/{org}/organization-roles/users/{username} | orgs/revoke-all-org-roles-user | x | w | floor |  | Remove all organization roles for a user |
| holdout1 | github | PUT | /repos/{owner}/{repo}/issues/{issue_number}/issue-field-values | issues/set-issue-field-values | x | w | floor |  | Set issue field values for an issue |
| holdout1 | github | DELETE | /repos/{owner}/{repo}/issues/{issue_number}/sub_issue | issues/remove-sub-issue | x | w | floor |  | Remove sub-issue |

## V6b: partySource='opid'

| set | n | exact | leaks | over_tight | leak_pct | over_tight_pct |
| --- | --- | --- | --- | --- | --- | --- |
| camara | 292 | 254 | 1 | 37 | 0.3 | 12.7 |
| holdout1 | 207 | 160 | 7 | 40 | 3.4 | 19.3 |
| holdout2 | 220 | 192 | 2 | 26 | 0.9 | 11.8 |

Delta vs V1:

- camara: leaks +0, over_tight -1
- holdout1: leaks +5, over_tight -10
- holdout2: leaks +2, over_tight -1

### V6b rows changed vs V1 — 19 rows

| set | repo | method | path | operationId | gt | pred_v1 | pred_new | evidence | summary |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| camara | WebRTC | DELETE | /sessions/{registrationId} | deleteRegistrationById | w | x | w |  | Delete Registration Session. |
| holdout1 | twilio | DELETE | /2010-04-01/Accounts/{AccountSid}/IncomingPhoneNumbers/{ResourceSid}/AssignedAddOns/{Sid}.json | DeleteIncomingPhoneNumberAssignedAddOn | w | x | w |  | Remove the assignment of an Add-on installation from the Number specif... |
| holdout1 | github | PUT | /enterprises/{enterprise}/teams/{enterprise-team}/organizations/{org} | enterprise-team-organizations/add | x | x | w |  | Add an organization assignment |
| holdout1 | github | PUT | /orgs/{org}/actions/runner-groups/{runner_group_id}/repositories/{repository_id} | actions/add-repo-access-to-self-hosted-runner-group-in-org | w | x | w |  | Add repository access to a self-hosted runner group in an organization |
| holdout1 | github | PUT | /orgs/{org}/actions/secrets/{secret_name}/repositories/{repository_id} | actions/add-selected-repo-to-org-secret | w | x | w |  | Add selected repository to an organization secret |
| holdout1 | github | PUT | /orgs/{org}/actions/variables/{name}/repositories/{repository_id} | actions/add-selected-repo-to-org-variable | w | x | w |  | Add selected repository to an organization variable |
| holdout1 | github | DELETE | /orgs/{org}/agents/secrets/{secret_name}/repositories/{repository_id} | agents/remove-selected-repo-from-org-secret | w | x | w |  | Remove selected repository from an organization secret |
| holdout1 | github | DELETE | /orgs/{org}/agents/variables/{name}/repositories/{repository_id} | agents/remove-selected-repo-from-org-variable | w | x | w |  | Remove selected repository from an organization variable |
| holdout1 | github | PUT | /orgs/{org}/codespaces/secrets/{secret_name}/repositories/{repository_id} | codespaces/add-selected-repo-to-org-secret | w | x | w |  | Add selected repository to an organization secret |
| holdout1 | github | PUT | /orgs/{org}/copilot-spaces/{space_number}/collaborators/{actor_type}/{actor_identifier} | copilot-spaces/update-collaborator-for-org | x | x | w |  | Set a collaborator role for an organization Copilot Space |
| holdout1 | github | DELETE | /orgs/{org}/migrations/{migration_id}/repos/{repo_name}/lock | migrations/unlock-repo-for-org | w | x | w |  | Unlock an organization repository |
| holdout1 | github | DELETE | /orgs/{org}/teams/{team_slug}/memberships/{username} | teams/remove-membership-for-user-in-org | x | x | w |  | Remove team membership for a user |
| holdout1 | github | DELETE | /repos/{owner}/{repo} | repos/delete | x | x | w |  | Delete a repository |
| holdout1 | github | PUT | /repos/{owner}/{repo}/interaction-limits/pulls/bypass-list | interactions/set-pull-request-bypass-list-for-repo | w | x | w |  | Add users to the pull request creation cap bypass list for a repositor... |
| holdout1 | github | DELETE | /teams/{team_id}/memberships/{username} | teams/remove-membership-for-user-legacy | x | x | w |  | Remove team membership for a user (Legacy) |
| holdout1 | github | DELETE | /user/blocks/{username} | users/unblock | w | x | w |  | Unblock a user |
| holdout2 | box | DELETE | /collaborations/{collaboration_id} | delete_collaborations_id | x | x | w |  | Remove collaboration |
| holdout2 | box | DELETE | /groups/{group_id} | delete_groups_id | x | x | w |  | Remove group |
| holdout2 | adyen | DELETE | /storedPaymentMethods/{storedPaymentMethodId} | delete-storedPaymentMethods-storedPaymentMethodId | w | x | w |  | Delete a token for stored payment details |

### V6b leaking rows — 10 rows

| set | repo | method | path | operationId | gt | pred | rule | evidence | summary |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| camara | TrafficInfluence | DELETE | /traffic-influences/{trafficInfluenceID} | deleteTrafficInfluence | x | w | floor |  | Delete an existing TrafficInfluence resource |
| holdout1 | github | PUT | /enterprises/{enterprise}/teams/{enterprise-team}/organizations/{org} | enterprise-team-organizations/add | x | w | floor |  | Add an organization assignment |
| holdout1 | github | PUT | /orgs/{org}/copilot-spaces/{space_number}/collaborators/{actor_type}/{actor_identifier} | copilot-spaces/update-collaborator-for-org | x | w | floor |  | Set a collaborator role for an organization Copilot Space |
| holdout1 | github | DELETE | /orgs/{org}/teams/{team_slug}/memberships/{username} | teams/remove-membership-for-user-in-org | x | w | floor |  | Remove team membership for a user |
| holdout1 | github | DELETE | /repos/{owner}/{repo} | repos/delete | x | w | floor |  | Delete a repository |
| holdout1 | github | PUT | /repos/{owner}/{repo}/issues/{issue_number}/issue-field-values | issues/set-issue-field-values | x | w | floor |  | Set issue field values for an issue |
| holdout1 | github | DELETE | /repos/{owner}/{repo}/issues/{issue_number}/sub_issue | issues/remove-sub-issue | x | w | floor |  | Remove sub-issue |
| holdout1 | github | DELETE | /teams/{team_id}/memberships/{username} | teams/remove-membership-for-user-legacy | x | w | floor |  | Remove team membership for a user (Legacy) |
| holdout2 | box | DELETE | /collaborations/{collaboration_id} | delete_collaborations_id | x | w | floor |  | Remove collaboration |
| holdout2 | box | DELETE | /groups/{group_id} | delete_groups_id | x | w | floor |  | Remove group |

## V7: patchOwnOn=true

| set | n | exact | leaks | over_tight | leak_pct | over_tight_pct |
| --- | --- | --- | --- | --- | --- | --- |
| camara | 292 | 256 | 2 | 34 | 0.7 | 11.6 |
| holdout1 | 207 | 155 | 2 | 50 | 1.0 | 24.2 |
| holdout2 | 220 | 193 | 0 | 27 | 0.0 | 12.3 |

Delta vs V1:

- camara: leaks +1, over_tight -4
- holdout1: leaks +0, over_tight +0
- holdout2: leaks +0, over_tight +0

### V7 rows changed vs V1 — 5 rows

| set | repo | method | path | operationId | gt | pred_v1 | pred_new | evidence | summary |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| camara | ApplicationProfiles | PATCH | /application-profiles/{applicationProfileId} | updateApplicationProfile | w | x | w | opid:update | Update an Application Profile |
| camara | ConsentManagement | PATCH | /consents/{consentId} | updateConsent | w | x | w | opid:update | Update User Consent |
| camara | EdgeApplicationManagement | PATCH | /deployments/{appDeploymentId} | updateAppDeployment | w | x | w | opid:update | Update an Application Deployment |
| camara | NetworkAccessManagement | PATCH | /trust-domains/{trustDomainId} | updateTrustDomain | w | x | w | opid:update | Update a specific Trust Domain |
| camara | TrafficInfluence | PATCH | /traffic-influences/{trafficInfluenceID} | patchTrafficInfluence | x | x | w | opid:patch | updates a specific TrafficInfluence resource, identified by the traffi... |

### V7 leaking rows — 4 rows

| set | repo | method | path | operationId | gt | pred | rule | evidence | summary |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| camara | TrafficInfluence | PATCH | /traffic-influences/{trafficInfluenceID} | patchTrafficInfluence | x | w | patch-own | opid:patch | updates a specific TrafficInfluence resource, identified by the traffi... |
| camara | TrafficInfluence | DELETE | /traffic-influences/{trafficInfluenceID} | deleteTrafficInfluence | x | w | floor |  | Delete an existing TrafficInfluence resource |
| holdout1 | github | PUT | /repos/{owner}/{repo}/issues/{issue_number}/issue-field-values | issues/set-issue-field-values | x | w | floor |  | Set issue field values for an issue |
| holdout1 | github | DELETE | /repos/{owner}/{repo}/issues/{issue_number}/sub_issue | issues/remove-sub-issue | x | w | floor |  | Remove sub-issue |

## V8: postOwnOn=true

| set | n | exact | leaks | over_tight | leak_pct | over_tight_pct |
| --- | --- | --- | --- | --- | --- | --- |
| camara | 292 | 222 | 33 | 37 | 11.3 | 12.7 |
| holdout1 | 207 | 139 | 35 | 33 | 16.9 | 15.9 |
| holdout2 | 220 | 185 | 11 | 24 | 5.0 | 10.9 |

Delta vs V1:

- camara: leaks +32, over_tight -1
- holdout1: leaks +33, over_tight -17
- holdout2: leaks +11, over_tight -3

### V8 rows changed vs V1 — 97 rows

| set | repo | method | path | operationId | gt | pred_v1 | pred_new | evidence | summary |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| camara | ApplicationProfiles | POST | /application-profiles | createApplicationProfile | x | x | w | opid:create | Create an Application Profile |
| camara | BlockchainPublicAddress | POST | /nonce | createBlockchainPublicAddressValidationNonce | x | x | w | opid:create | Generates a one-time nonce associated to a specific Blockchain Public ... |
| camara | CarrierBillingCheckOut | POST | /payments | createPayment | x | x | w | opid:create | Create a new Payment |
| camara | ConnectedNetworkType | POST | /subscriptions | createConnectedNetworkTypeSubscription | x | x | w | opid:create | Create a subscription for receiving notifications on changes to the co... |
| camara | ConnectivityInsights | POST | /subscriptions | createSubscription | x | x | w | opid:create | Create a Connectivity insights subscription for a device |
| camara | ConsentManagement | POST | /consents | createConsent | x | x | w | opid:create | Create User Consent |
| camara | DeviceDataVolume | POST | /subscriptions | createDeviceDataVolumeSubscription | x | x | w | opid:create | Create a device data volume event subscription |
| camara | DeviceLocation | POST | /subscriptions | createGeofencingSubscription | x | x | w | opid:create | Create a geofencing subscription for a device |
| camara | DeviceReachabilityStatus | POST | /subscriptions | createDeviceReachabilityStatusSubscription | x | x | w | opid:create | Create a device reachability status event subscription for a device |
| camara | DeviceRoamingStatus | POST | /subscriptions | createDeviceRoamingStatusSubscription | x | x | w | opid:create | Create a device roaming status event subscription for a device |
| camara | DeviceStatus | POST | /subscriptions | createConnectedNetworkTypeSubscription | x | x | w | opid:create | Create a subscription for receiving notifications on changes to the co... |
| camara | DeviceStatus | POST | /subscriptions | createDeviceReachabilityStatusSubscription | x | x | w | opid:create | Create a device reachability status event subscription for a device |
| camara | DeviceStatus | POST | /subscriptions | createDeviceRoamingStatusSubscription | x | x | w | opid:create | Create a device roaming status event subscription for a device |
| camara | EdgeApplicationManagement | POST | /app-instances | createAppInstance | x | x | w | opid:create | Instantiation of an Application |
| camara | EdgeApplicationManagement | POST | /deployments | createAppDeployment | x | x | w | opid:create | Deploy an Application |
| camara | IoTDeviceManagement | POST | /enable | enableEsimProfile | x | x | w | opid:enable | Enable eSIM Profile |
| camara | IoTDeviceManagement | POST | /disable | disableEsimProfile | x | x | w | opid:disable | Disable eSIM Profile |
| camara | IoTDeviceManagement | POST | /delete | deleteEsimProfile | x | x | w | opid:delete | Delete eSIM Profile |
| camara | IoTDeviceManagement | POST | /set-fallback | setFallbackEsimProfile | x | x | w | opid:set | Set fallback eSIM Profile |
| camara | ModelAsAService | POST | /knowledge-bases | createKnowledgeBase | x | x | w | opid:create | Create a new knowledge base |
| camara | ModelAsAService | POST | /knowledge-bases/{knowledgeBaseId}/documents | uploadDocument | x | x | w | opid:upload | Upload a document to a knowledge base |
| camara | ModelAsAService | POST | /knowledge-bases/{knowledgeBaseId}/tools | createTool | x | x | w | opid:create | Register a new tool |
| camara | ModelAsAService | POST | /assistants | createAssistant | x | x | w | opid:create | Create a new QA assistant |
| camara | NetworkAccessManagement | POST | /trust-domains | createTrustDomain | w | x | w | opid:create | Create a new Trust Domain |
| camara | NetworkSliceBooking | POST | /slices | createSlice | x | x | w | opid:create | Creates a new network slice |
| camara | QoSBooking | POST | /qos-bookings | createBooking | x | x | w | opid:create | This operation reserves required QoS in advance up to a certain number... |
| camara | QoSBooking | POST | /qos-bookings/{bookingId}/devices/assign | assignDevices | x | x | w | opid:assign | Assign one or more devices to an existing QoS Booking identified by `b... |
| camara | QoSBooking | POST | /device-qos-bookings | createBooking | x | x | w | opid:create | Sets a new booking of QoS for a device |
| camara | SimSwap | POST | /subscriptions | createSimSwapSubscription | x | x | w | opid:create | Create a sim swap event subscription for a phone number |
| camara | VerifiedCaller | POST | /registrations | createRegistration | x | x | w | opid:create | Register new brand information in the service platform |
| camara | VerifiedCaller | POST | /pre-announce | createPreAnnouncement | x | x | w | opid:create | Create a call pre-announcement in the service platform |
| camara | WebRTC | POST | /subscriptions | createNotificationChannelSubscription | x | x | w | opid:create | Create a webrtc-events event subscription |
| camara | WebRTC | POST | /sessions | createRegistration | x | x | w | opid:create | Create a registration |
| holdout1 | twilio | POST | /2010-04-01/Accounts/{AccountSid}/Addresses.json | CreateAddress | x | x | w | opid:create |  |
| holdout1 | twilio | POST | /2010-04-01/Accounts/{AccountSid}/Addresses/{Sid}.json | UpdateAddress | w | x | w | opid:update |  |
| holdout1 | twilio | POST | /2010-04-01/Accounts/{AccountSid}/Applications/{Sid}.json | UpdateApplication | w | x | w | opid:update | Updates the application's properties |
| holdout1 | twilio | POST | /2010-04-01/Accounts/{AccountSid}/Calls/{CallSid}/Recordings.json | CreateCallRecording | x | x | w | opid:create | Create a recording for the call |
| holdout1 | twilio | POST | /2010-04-01/Accounts/{AccountSid}/Calls/{CallSid}/Recordings/{Sid}.json | UpdateCallRecording | x | x | w | opid:update | Changes the status of the recording to paused, stopped, or in-progress... |
| holdout1 | twilio | POST | /2010-04-01/Accounts/{AccountSid}/Conferences/{Sid}.json | UpdateConference | x | x | w | opid:update |  |
| holdout1 | twilio | POST | /2010-04-01/Accounts/{AccountSid}/Conferences/{ConferenceSid}/Recordings/{Sid}.json | UpdateConferenceRecording | x | x | w | opid:update | Changes the status of the recording to paused, stopped, or in-progress... |
| holdout1 | twilio | POST | /2010-04-01/Accounts/{AccountSid}/ConnectApps/{Sid}.json | UpdateConnectApp | w | x | w | opid:update | Update a connect-app with the specified parameters |
| holdout1 | twilio | POST | /2010-04-01/Accounts/{AccountSid}/IncomingPhoneNumbers/{Sid}.json | UpdateIncomingPhoneNumber | w | x | w | opid:update | Update an incoming-phone-number instance. |
| holdout1 | twilio | POST | /2010-04-01/Accounts/{AccountSid}/IncomingPhoneNumbers.json | CreateIncomingPhoneNumber | x | x | w | opid:create | Purchase a phone-number for the account. |
| holdout1 | twilio | POST | /2010-04-01/Accounts/{AccountSid}/IncomingPhoneNumbers/{ResourceSid}/AssignedAddOns.json | CreateIncomingPhoneNumberAssignedAddOn | x | x | w | opid:create | Assign an Add-on installation to the Number specified. |
| holdout1 | twilio | POST | /2010-04-01/Accounts/{AccountSid}/IncomingPhoneNumbers/Local.json | CreateIncomingPhoneNumberLocal | x | x | w | opid:create |  |
| holdout1 | twilio | POST | /2010-04-01/Accounts/{AccountSid}/IncomingPhoneNumbers/Mobile.json | CreateIncomingPhoneNumberMobile | x | x | w | opid:create |  |
| holdout1 | twilio | POST | /2010-04-01/Accounts/{AccountSid}/IncomingPhoneNumbers/TollFree.json | CreateIncomingPhoneNumberTollFree | x | x | w | opid:create |  |
| holdout1 | twilio | POST | /2010-04-01/Accounts/{AccountSid}/Keys/{Sid}.json | UpdateKey | w | x | w | opid:update |  |
| holdout1 | twilio | POST | /2010-04-01/Accounts/{AccountSid}/Keys.json | CreateNewKey | x | x | w | opid:create |  |
| holdout1 | twilio | POST | /2010-04-01/Accounts/{AccountSid}/Messages/{Sid}.json | UpdateMessage | w | x | w | opid:update | Update a Message resource (used to redact Message `body` text and to c... |
| holdout1 | twilio | POST | /2010-04-01/Accounts/{AccountSid}/Messages/{MessageSid}/Feedback.json | CreateMessageFeedback | w | x | w | opid:create | Create Message Feedback to confirm a tracked user action was performed... |
| holdout1 | twilio | POST | /2010-04-01/Accounts/{AccountSid}/SigningKeys.json | CreateNewSigningKey | x | x | w | opid:create | Create a new Signing Key for the account making the request. |
| holdout1 | twilio | POST | /2010-04-01/Accounts/{AccountSid}/OutgoingCallerIds/{Sid}.json | UpdateOutgoingCallerId | w | x | w | opid:update | Updates the caller-id |
| holdout1 | twilio | POST | /2010-04-01/Accounts/{AccountSid}/OutgoingCallerIds.json | CreateValidationRequest | x | x | w | opid:create |  |
| holdout1 | twilio | POST | /2010-04-01/Accounts/{AccountSid}/Calls/{CallSid}/Payments.json | CreatePayments | x | x | w | opid:create | create an instance of payments. This will start a new payments session |
| holdout1 | twilio | POST | /2010-04-01/Accounts/{AccountSid}/Calls/{CallSid}/Payments/{Sid}.json | UpdatePayments | x | x | w | opid:update | update an instance of payments with different phases of payment flows. |
| holdout1 | twilio | POST | /2010-04-01/Accounts/{AccountSid}/Queues/{Sid}.json | UpdateQueue | w | x | w | opid:update | Update the queue with the new parameters |
| holdout1 | twilio | POST | /2010-04-01/Accounts/{AccountSid}/Queues.json | CreateQueue | x | x | w | opid:create | Create a queue |
| holdout1 | twilio | POST | /2010-04-01/Accounts/{AccountSid}/Calls/{CallSid}/Transcriptions.json | CreateRealtimeTranscription | x | x | w | opid:create | Create a Transcription |
| holdout1 | twilio | POST | /2010-04-01/Accounts/{AccountSid}/Calls/{CallSid}/Transcriptions/{Sid}.json | UpdateRealtimeTranscription | x | x | w | opid:update | Stop a Transcription using either the SID of the Transcription resourc... |
| holdout1 | twilio | POST | /2010-04-01/Accounts/{AccountSid}/SMS/ShortCodes/{Sid}.json | UpdateShortCode | w | x | w | opid:update | Update a short code with the following parameters |
| holdout1 | twilio | POST | /2010-04-01/Accounts/{AccountSid}/SigningKeys/{Sid}.json | UpdateSigningKey | w | x | w | opid:update |  |
| holdout1 | twilio | POST | /2010-04-01/Accounts/{AccountSid}/SIP/Domains/{DomainSid}/Auth/Calls/CredentialListMappings.json | CreateSipAuthCallsCredentialListMapping | x | x | w | opid:create | Create a new credential list mapping resource |
| holdout1 | twilio | POST | /2010-04-01/Accounts/{AccountSid}/SIP/Domains/{DomainSid}/Auth/Calls/IpAccessControlListMappings.json | CreateSipAuthCallsIpAccessControlListMapping | x | x | w | opid:create | Create a new IP Access Control List mapping |
| holdout1 | twilio | POST | /2010-04-01/Accounts/{AccountSid}/SIP/Domains/{DomainSid}/Auth/Registrations/CredentialListMappings.json | CreateSipAuthRegistrationsCredentialListMapping | x | x | w | opid:create | Create a new credential list mapping resource |
| holdout1 | twilio | POST | /2010-04-01/Accounts/{AccountSid}/SIP/CredentialLists/{CredentialListSid}/Credentials.json | CreateSipCredential | x | x | w | opid:create | Create a new credential resource. |
| holdout1 | twilio | POST | /2010-04-01/Accounts/{AccountSid}/SIP/CredentialLists/{CredentialListSid}/Credentials/{Sid}.json | UpdateSipCredential | w | x | w | opid:update | Update a credential resource. |
| holdout1 | twilio | POST | /2010-04-01/Accounts/{AccountSid}/SIP/CredentialLists.json | CreateSipCredentialList | x | x | w | opid:create | Create a Credential List |
| holdout1 | twilio | POST | /2010-04-01/Accounts/{AccountSid}/SIP/CredentialLists/{Sid}.json | UpdateSipCredentialList | w | x | w | opid:update | Update a Credential List |
| holdout1 | twilio | POST | /2010-04-01/Accounts/{AccountSid}/SIP/Domains/{DomainSid}/CredentialListMappings.json | CreateSipCredentialListMapping | x | x | w | opid:create | Create a CredentialListMapping resource for an account. |
| holdout1 | twilio | POST | /2010-04-01/Accounts/{AccountSid}/SIP/Domains.json | CreateSipDomain | x | x | w | opid:create | Create a new Domain |
| holdout1 | twilio | POST | /2010-04-01/Accounts/{AccountSid}/SIP/Domains/{Sid}.json | UpdateSipDomain | w | x | w | opid:update | Update the attributes of a domain |
| holdout1 | twilio | POST | /2010-04-01/Accounts/{AccountSid}/SIP/IpAccessControlLists.json | CreateSipIpAccessControlList | x | x | w | opid:create | Create a new IpAccessControlList resource |
| holdout1 | twilio | POST | /2010-04-01/Accounts/{AccountSid}/SIP/IpAccessControlLists/{Sid}.json | UpdateSipIpAccessControlList | w | x | w | opid:update | Rename an IpAccessControlList |
| holdout1 | twilio | POST | /2010-04-01/Accounts/{AccountSid}/SIP/Domains/{DomainSid}/IpAccessControlListMappings.json | CreateSipIpAccessControlListMapping | x | x | w | opid:create | Create a new IpAccessControlListMapping resource. |
| holdout1 | twilio | POST | /2010-04-01/Accounts/{AccountSid}/SIP/IpAccessControlLists/{IpAccessControlListSid}/IpAddresses.json | CreateSipIpAddress | x | x | w | opid:create | Create a new IpAddress resource. |
| holdout1 | twilio | POST | /2010-04-01/Accounts/{AccountSid}/SIP/IpAccessControlLists/{IpAccessControlListSid}/IpAddresses/{Sid}.json | UpdateSipIpAddress | w | x | w | opid:update | Update an IpAddress resource. |
| holdout1 | twilio | POST | /2010-04-01/Accounts/{AccountSid}/Calls/{CallSid}/Siprec.json | CreateSiprec | x | x | w | opid:create | Create a Siprec |
| holdout1 | twilio | POST | /2010-04-01/Accounts/{AccountSid}/Calls/{CallSid}/Siprec/{Sid}.json | UpdateSiprec | w | x | w | opid:update | Stop a Siprec using either the SID of the Siprec resource or the `name... |
| holdout1 | twilio | POST | /2010-04-01/Accounts/{AccountSid}/Calls/{CallSid}/Streams.json | CreateStream | x | x | w | opid:create | Create a Stream |
| holdout1 | twilio | POST | /2010-04-01/Accounts/{AccountSid}/Calls/{CallSid}/Streams/{Sid}.json | UpdateStream | x | x | w | opid:update | Stop a Stream using either the SID of the Stream resource or the `name... |
| holdout1 | twilio | POST | /2010-04-01/Accounts/{AccountSid}/Calls/{CallSid}/UserDefinedMessages.json | CreateUserDefinedMessage | x | x | w | opid:create | Create a new User Defined Message for the given Call SID. |
| holdout1 | twilio | POST | /2010-04-01/Accounts/{AccountSid}/Calls/{CallSid}/UserDefinedMessageSubscriptions.json | CreateUserDefinedMessageSubscription | x | x | w | opid:create | Subscribe to User Defined Messages for a given Call SID. |
| holdout2 | pagerduty | POST | /automation_actions/actions | createAutomationAction | x | x | w | opid:create | Create an Automation Action |
| holdout2 | pagerduty | POST | /automation_actions/actions/{id}/teams | createAutomationActionTeamAssociation | w | x | w | opid:create | Associate an Automation Action with a team |
| holdout2 | pagerduty | POST | /business_services | createBusinessService | x | x | w | opid:create | Create a Business Service |
| holdout2 | pagerduty | POST | /business_services/{id}/account_subscription | createBusinessServiceAccountSubscription | x | x | w | opid:create | Create Business Service Account Subscription |
| holdout2 | pagerduty | POST | /enrichment/event_enrichments | createEventEnrichment | x | x | w | opid:create | Create an Event Enrichment |
| holdout2 | pagerduty | POST | /extensions/{id}/enable | enableExtension | w | x | w | opid:enable | Enable an extension |
| holdout2 | pagerduty | POST | /incidents/custom_fields | createCustomFieldsField | x | x | w | opid:create | Create a Field |
| holdout2 | pagerduty | POST | /incidents/custom_fields/{field_id}/field_options | createCustomFieldsFieldOption | x | x | w | opid:create | Create a Field Option |
| holdout2 | pagerduty | POST | /incidents/{id}/notes | createIncidentNote | x | x | w | opid:create | Create a note on an incident |
| holdout2 | pagerduty | POST | /incidents/{id}/status_updates | createIncidentStatusUpdate | x | x | w | opid:create | Create a status update on an incident |
| holdout2 | pagerduty | POST | /ip_allow_lists | createIpAllowList | x | x | w | opid:create | Create an IP allow list |
| holdout2 | pagerduty | POST | /recommendations/event_orchestrations/services/{service_id}/rules/{recommendation_id}/dismiss | dismissRecommendedRule | w | x | w | opid:dismiss | Dismiss a recommended rule |
| holdout2 | pagerduty | POST | /status_pages/{id}/posts | createStatusPagePost | x | x | w | opid:create | Create a Status Page Post |
| holdout2 | pagerduty | POST | /status_pages/{id}/posts/{post_id}/post_updates | createStatusPagePostUpdate | x | x | w | opid:create | Create a Status Page Post Update |

### V8 leaking rows — 79 rows

| set | repo | method | path | operationId | gt | pred | rule | evidence | summary |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| camara | ApplicationProfiles | POST | /application-profiles | createApplicationProfile | x | w | post-own | opid:create | Create an Application Profile |
| camara | BlockchainPublicAddress | POST | /nonce | createBlockchainPublicAddressValidationNonce | x | w | post-own | opid:create | Generates a one-time nonce associated to a specific Blockchain Public ... |
| camara | CarrierBillingCheckOut | POST | /payments | createPayment | x | w | post-own | opid:create | Create a new Payment |
| camara | ConnectedNetworkType | POST | /subscriptions | createConnectedNetworkTypeSubscription | x | w | post-own | opid:create | Create a subscription for receiving notifications on changes to the co... |
| camara | ConnectivityInsights | POST | /subscriptions | createSubscription | x | w | post-own | opid:create | Create a Connectivity insights subscription for a device |
| camara | ConsentManagement | POST | /consents | createConsent | x | w | post-own | opid:create | Create User Consent |
| camara | DeviceDataVolume | POST | /subscriptions | createDeviceDataVolumeSubscription | x | w | post-own | opid:create | Create a device data volume event subscription |
| camara | DeviceLocation | POST | /subscriptions | createGeofencingSubscription | x | w | post-own | opid:create | Create a geofencing subscription for a device |
| camara | DeviceReachabilityStatus | POST | /subscriptions | createDeviceReachabilityStatusSubscription | x | w | post-own | opid:create | Create a device reachability status event subscription for a device |
| camara | DeviceRoamingStatus | POST | /subscriptions | createDeviceRoamingStatusSubscription | x | w | post-own | opid:create | Create a device roaming status event subscription for a device |
| camara | DeviceStatus | POST | /subscriptions | createConnectedNetworkTypeSubscription | x | w | post-own | opid:create | Create a subscription for receiving notifications on changes to the co... |
| camara | DeviceStatus | POST | /subscriptions | createDeviceReachabilityStatusSubscription | x | w | post-own | opid:create | Create a device reachability status event subscription for a device |
| camara | DeviceStatus | POST | /subscriptions | createDeviceRoamingStatusSubscription | x | w | post-own | opid:create | Create a device roaming status event subscription for a device |
| camara | EdgeApplicationManagement | POST | /app-instances | createAppInstance | x | w | post-own | opid:create | Instantiation of an Application |
| camara | EdgeApplicationManagement | POST | /deployments | createAppDeployment | x | w | post-own | opid:create | Deploy an Application |
| camara | IoTDeviceManagement | POST | /enable | enableEsimProfile | x | w | post-own | opid:enable | Enable eSIM Profile |
| camara | IoTDeviceManagement | POST | /disable | disableEsimProfile | x | w | post-own | opid:disable | Disable eSIM Profile |
| camara | IoTDeviceManagement | POST | /delete | deleteEsimProfile | x | w | post-own | opid:delete | Delete eSIM Profile |
| camara | IoTDeviceManagement | POST | /set-fallback | setFallbackEsimProfile | x | w | post-own | opid:set | Set fallback eSIM Profile |
| camara | ModelAsAService | POST | /knowledge-bases | createKnowledgeBase | x | w | post-own | opid:create | Create a new knowledge base |
| camara | ModelAsAService | POST | /knowledge-bases/{knowledgeBaseId}/documents | uploadDocument | x | w | post-own | opid:upload | Upload a document to a knowledge base |
| camara | ModelAsAService | POST | /knowledge-bases/{knowledgeBaseId}/tools | createTool | x | w | post-own | opid:create | Register a new tool |
| camara | ModelAsAService | POST | /assistants | createAssistant | x | w | post-own | opid:create | Create a new QA assistant |
| camara | NetworkSliceBooking | POST | /slices | createSlice | x | w | post-own | opid:create | Creates a new network slice |
| camara | QoSBooking | POST | /qos-bookings | createBooking | x | w | post-own | opid:create | This operation reserves required QoS in advance up to a certain number... |
| camara | QoSBooking | POST | /qos-bookings/{bookingId}/devices/assign | assignDevices | x | w | post-own | opid:assign | Assign one or more devices to an existing QoS Booking identified by `b... |
| camara | QoSBooking | POST | /device-qos-bookings | createBooking | x | w | post-own | opid:create | Sets a new booking of QoS for a device |
| camara | SimSwap | POST | /subscriptions | createSimSwapSubscription | x | w | post-own | opid:create | Create a sim swap event subscription for a phone number |
| camara | TrafficInfluence | DELETE | /traffic-influences/{trafficInfluenceID} | deleteTrafficInfluence | x | w | floor |  | Delete an existing TrafficInfluence resource |
| camara | VerifiedCaller | POST | /registrations | createRegistration | x | w | post-own | opid:create | Register new brand information in the service platform |
| camara | VerifiedCaller | POST | /pre-announce | createPreAnnouncement | x | w | post-own | opid:create | Create a call pre-announcement in the service platform |
| camara | WebRTC | POST | /subscriptions | createNotificationChannelSubscription | x | w | post-own | opid:create | Create a webrtc-events event subscription |
| camara | WebRTC | POST | /sessions | createRegistration | x | w | post-own | opid:create | Create a registration |
| holdout1 | twilio | POST | /2010-04-01/Accounts/{AccountSid}/Addresses.json | CreateAddress | x | w | post-own | opid:create |  |
| holdout1 | twilio | POST | /2010-04-01/Accounts/{AccountSid}/Calls/{CallSid}/Recordings.json | CreateCallRecording | x | w | post-own | opid:create | Create a recording for the call |
| holdout1 | twilio | POST | /2010-04-01/Accounts/{AccountSid}/Calls/{CallSid}/Recordings/{Sid}.json | UpdateCallRecording | x | w | post-own | opid:update | Changes the status of the recording to paused, stopped, or in-progress... |
| holdout1 | twilio | POST | /2010-04-01/Accounts/{AccountSid}/Conferences/{Sid}.json | UpdateConference | x | w | post-own | opid:update |  |
| holdout1 | twilio | POST | /2010-04-01/Accounts/{AccountSid}/Conferences/{ConferenceSid}/Recordings/{Sid}.json | UpdateConferenceRecording | x | w | post-own | opid:update | Changes the status of the recording to paused, stopped, or in-progress... |
| holdout1 | twilio | POST | /2010-04-01/Accounts/{AccountSid}/IncomingPhoneNumbers.json | CreateIncomingPhoneNumber | x | w | post-own | opid:create | Purchase a phone-number for the account. |
| holdout1 | twilio | POST | /2010-04-01/Accounts/{AccountSid}/IncomingPhoneNumbers/{ResourceSid}/AssignedAddOns.json | CreateIncomingPhoneNumberAssignedAddOn | x | w | post-own | opid:create | Assign an Add-on installation to the Number specified. |
| holdout1 | twilio | POST | /2010-04-01/Accounts/{AccountSid}/IncomingPhoneNumbers/Local.json | CreateIncomingPhoneNumberLocal | x | w | post-own | opid:create |  |
| holdout1 | twilio | POST | /2010-04-01/Accounts/{AccountSid}/IncomingPhoneNumbers/Mobile.json | CreateIncomingPhoneNumberMobile | x | w | post-own | opid:create |  |
| holdout1 | twilio | POST | /2010-04-01/Accounts/{AccountSid}/IncomingPhoneNumbers/TollFree.json | CreateIncomingPhoneNumberTollFree | x | w | post-own | opid:create |  |
| holdout1 | twilio | POST | /2010-04-01/Accounts/{AccountSid}/Keys.json | CreateNewKey | x | w | post-own | opid:create |  |
| holdout1 | twilio | POST | /2010-04-01/Accounts/{AccountSid}/SigningKeys.json | CreateNewSigningKey | x | w | post-own | opid:create | Create a new Signing Key for the account making the request. |
| holdout1 | twilio | POST | /2010-04-01/Accounts/{AccountSid}/OutgoingCallerIds.json | CreateValidationRequest | x | w | post-own | opid:create |  |
| holdout1 | twilio | POST | /2010-04-01/Accounts/{AccountSid}/Calls/{CallSid}/Payments.json | CreatePayments | x | w | post-own | opid:create | create an instance of payments. This will start a new payments session |
| holdout1 | twilio | POST | /2010-04-01/Accounts/{AccountSid}/Calls/{CallSid}/Payments/{Sid}.json | UpdatePayments | x | w | post-own | opid:update | update an instance of payments with different phases of payment flows. |
| holdout1 | twilio | POST | /2010-04-01/Accounts/{AccountSid}/Queues.json | CreateQueue | x | w | post-own | opid:create | Create a queue |
| holdout1 | twilio | POST | /2010-04-01/Accounts/{AccountSid}/Calls/{CallSid}/Transcriptions.json | CreateRealtimeTranscription | x | w | post-own | opid:create | Create a Transcription |
| holdout1 | twilio | POST | /2010-04-01/Accounts/{AccountSid}/Calls/{CallSid}/Transcriptions/{Sid}.json | UpdateRealtimeTranscription | x | w | post-own | opid:update | Stop a Transcription using either the SID of the Transcription resourc... |
| holdout1 | twilio | POST | /2010-04-01/Accounts/{AccountSid}/SIP/Domains/{DomainSid}/Auth/Calls/CredentialListMappings.json | CreateSipAuthCallsCredentialListMapping | x | w | post-own | opid:create | Create a new credential list mapping resource |
| holdout1 | twilio | POST | /2010-04-01/Accounts/{AccountSid}/SIP/Domains/{DomainSid}/Auth/Calls/IpAccessControlListMappings.json | CreateSipAuthCallsIpAccessControlListMapping | x | w | post-own | opid:create | Create a new IP Access Control List mapping |
| holdout1 | twilio | POST | /2010-04-01/Accounts/{AccountSid}/SIP/Domains/{DomainSid}/Auth/Registrations/CredentialListMappings.json | CreateSipAuthRegistrationsCredentialListMapping | x | w | post-own | opid:create | Create a new credential list mapping resource |
| holdout1 | twilio | POST | /2010-04-01/Accounts/{AccountSid}/SIP/CredentialLists/{CredentialListSid}/Credentials.json | CreateSipCredential | x | w | post-own | opid:create | Create a new credential resource. |
| holdout1 | twilio | POST | /2010-04-01/Accounts/{AccountSid}/SIP/CredentialLists.json | CreateSipCredentialList | x | w | post-own | opid:create | Create a Credential List |
| holdout1 | twilio | POST | /2010-04-01/Accounts/{AccountSid}/SIP/Domains/{DomainSid}/CredentialListMappings.json | CreateSipCredentialListMapping | x | w | post-own | opid:create | Create a CredentialListMapping resource for an account. |
| holdout1 | twilio | POST | /2010-04-01/Accounts/{AccountSid}/SIP/Domains.json | CreateSipDomain | x | w | post-own | opid:create | Create a new Domain |
| holdout1 | twilio | POST | /2010-04-01/Accounts/{AccountSid}/SIP/IpAccessControlLists.json | CreateSipIpAccessControlList | x | w | post-own | opid:create | Create a new IpAccessControlList resource |
| holdout1 | twilio | POST | /2010-04-01/Accounts/{AccountSid}/SIP/Domains/{DomainSid}/IpAccessControlListMappings.json | CreateSipIpAccessControlListMapping | x | w | post-own | opid:create | Create a new IpAccessControlListMapping resource. |
| holdout1 | twilio | POST | /2010-04-01/Accounts/{AccountSid}/SIP/IpAccessControlLists/{IpAccessControlListSid}/IpAddresses.json | CreateSipIpAddress | x | w | post-own | opid:create | Create a new IpAddress resource. |
| holdout1 | twilio | POST | /2010-04-01/Accounts/{AccountSid}/Calls/{CallSid}/Siprec.json | CreateSiprec | x | w | post-own | opid:create | Create a Siprec |
| holdout1 | twilio | POST | /2010-04-01/Accounts/{AccountSid}/Calls/{CallSid}/Streams.json | CreateStream | x | w | post-own | opid:create | Create a Stream |
| holdout1 | twilio | POST | /2010-04-01/Accounts/{AccountSid}/Calls/{CallSid}/Streams/{Sid}.json | UpdateStream | x | w | post-own | opid:update | Stop a Stream using either the SID of the Stream resource or the `name... |
| holdout1 | twilio | POST | /2010-04-01/Accounts/{AccountSid}/Calls/{CallSid}/UserDefinedMessages.json | CreateUserDefinedMessage | x | w | post-own | opid:create | Create a new User Defined Message for the given Call SID. |
| holdout1 | twilio | POST | /2010-04-01/Accounts/{AccountSid}/Calls/{CallSid}/UserDefinedMessageSubscriptions.json | CreateUserDefinedMessageSubscription | x | w | post-own | opid:create | Subscribe to User Defined Messages for a given Call SID. |
| holdout1 | github | PUT | /repos/{owner}/{repo}/issues/{issue_number}/issue-field-values | issues/set-issue-field-values | x | w | floor |  | Set issue field values for an issue |
| holdout1 | github | DELETE | /repos/{owner}/{repo}/issues/{issue_number}/sub_issue | issues/remove-sub-issue | x | w | floor |  | Remove sub-issue |
| holdout2 | pagerduty | POST | /automation_actions/actions | createAutomationAction | x | w | post-own | opid:create | Create an Automation Action |
| holdout2 | pagerduty | POST | /business_services | createBusinessService | x | w | post-own | opid:create | Create a Business Service |
| holdout2 | pagerduty | POST | /business_services/{id}/account_subscription | createBusinessServiceAccountSubscription | x | w | post-own | opid:create | Create Business Service Account Subscription |
| holdout2 | pagerduty | POST | /enrichment/event_enrichments | createEventEnrichment | x | w | post-own | opid:create | Create an Event Enrichment |
| holdout2 | pagerduty | POST | /incidents/custom_fields | createCustomFieldsField | x | w | post-own | opid:create | Create a Field |
| holdout2 | pagerduty | POST | /incidents/custom_fields/{field_id}/field_options | createCustomFieldsFieldOption | x | w | post-own | opid:create | Create a Field Option |
| holdout2 | pagerduty | POST | /incidents/{id}/notes | createIncidentNote | x | w | post-own | opid:create | Create a note on an incident |
| holdout2 | pagerduty | POST | /incidents/{id}/status_updates | createIncidentStatusUpdate | x | w | post-own | opid:create | Create a status update on an incident |
| holdout2 | pagerduty | POST | /ip_allow_lists | createIpAllowList | x | w | post-own | opid:create | Create an IP allow list |
| holdout2 | pagerduty | POST | /status_pages/{id}/posts | createStatusPagePost | x | w | post-own | opid:create | Create a Status Page Post |
| holdout2 | pagerduty | POST | /status_pages/{id}/posts/{post_id}/post_updates | createStatusPagePostUpdate | x | w | post-own | opid:create | Create a Status Page Post Update |

## V2: leave-one-word-out

For every word in liveVerbs and partyNouns (V1 defaults), V1 rerun with that
one word removed from its own list. hits = rows that word resolved (was the
evidence word for) in V1, all sets. leaks_added/over_tight_removed are measured
on the admission scope (camara+holdout1) only. Sorted by leaks_added desc, then
over_tight_removed desc.

| word | source | hits | leaks_added | over_tight_removed |
| --- | --- | --- | --- | --- |
| user | party | 11 | 2 | 7 |
| cancel | live | 8 | 2 | 0 |
| membership | party | 2 | 2 | 0 |
| restriction | party | 2 | 2 | 0 |
| repository | party | 12 | 1 | 8 |
| organization | party | 6 | 1 | 5 |
| account | party | 4 | 1 | 3 |
| session | party | 5 | 1 | 3 |
| access | party | 2 | 1 | 1 |
| assignment | party | 4 | 1 | 1 |
| device | party | 4 | 1 | 1 |
| network | party | 3 | 1 | 1 |
| merge | live | 1 | 1 | 0 |
| start | live | 5 | 1 | 0 |
| customer | party | 1 | 1 | 0 |
| role | party | 1 | 1 | 0 |
| team | party | 2 | 1 | 0 |
| installation | party | 1 | 1 | 0 |
| token | party | 2 | 1 | 0 |
| terminate | live | 3 | 0 | 2 |
| execute | live | 2 | 0 | 2 |
| person | party | 2 | 0 | 2 |
| pay | live | 2 | 0 | 1 |
| trigger | live | 5 | 0 | 1 |
| reboot | live | 3 | 0 | 1 |
| kick | live | 1 | 0 | 0 |
| revoke | live | 2 | 0 | 0 |
| convert | live | 1 | 0 | 0 |
| refund | live | 3 | 0 | 0 |
| send | live | 3 | 0 | 0 |
| submit | live | 3 | 0 | 0 |
| member | party | 1 | 0 | 0 |
| collaboration | party | 1 | 0 | 0 |
| group | party | 1 | 0 | 0 |

Zero-hit words (24, not run, not in the table above): live:dial, live:hangup, live:end, live:reject, live:accept, live:approve, live:invite, live:transfer, live:notify, live:publish, live:run, live:launch, party:collaborator, party:sponsorship, party:participant, party:call, party:seat, party:invitation, party:people, party:contact, party:recipient, party:subscriber, party:tenant, party:partner

