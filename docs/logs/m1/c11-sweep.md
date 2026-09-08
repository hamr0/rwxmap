# M1-C11: floor + raise-only sweep

Four combos: callerPhraseOn x readListOn (each false/true). Floor = method prior;
raises only from live-verb and party-noun (fixed lists from judge.mjs); readListOn
is the one measured POST-only lowering variant (variant B).

## Per-combo, per-set summary

| combo | set | n | exact | leaks | over_tight | leak_pct | over_tight_pct |
| --- | --- | --- | --- | --- | --- | --- | --- |
| base | camara | 292 | 212 | 1 | 79 | 0.3 | 27.1 |
| base | holdout1 | 207 | 149 | 2 | 56 | 1.0 | 27.1 |
| base | holdout2 | 220 | 193 | 0 | 27 | 0.0 | 12.3 |
| readList | camara | 292 | 252 | 3 | 37 | 1.0 | 12.7 |
| readList | holdout1 | 207 | 149 | 2 | 56 | 1.0 | 27.1 |
| readList | holdout2 | 220 | 194 | 0 | 26 | 0.0 | 11.8 |
| callerPhrase | camara | 292 | 212 | 1 | 79 | 0.3 | 27.1 |
| callerPhrase | holdout1 | 207 | 155 | 2 | 50 | 1.0 | 24.2 |
| callerPhrase | holdout2 | 220 | 193 | 0 | 27 | 0.0 | 12.3 |
| both | camara | 292 | 252 | 3 | 37 | 1.0 | 12.7 |
| both | holdout1 | 207 | 155 | 2 | 50 | 1.0 | 24.2 |
| both | holdout2 | 220 | 194 | 0 | 26 | 0.0 | 11.8 |

## Per-combo, per-rule breakdown

### combo=base (callerPhraseOn=false, readListOn=false)

| rule | set | hit | exact | leaks | over_tight |
| --- | --- | --- | --- | --- | --- |
| floor | camara | 261 | 195 | 1 | 65 |
| floor | holdout1 | 145 | 125 | 2 | 18 |
| floor | holdout2 | 198 | 178 | 0 | 20 |
| live-verb | camara | 19 | 12 | 0 | 7 |
| live-verb | holdout1 | 11 | 8 | 0 | 3 |
| live-verb | holdout2 | 12 | 11 | 0 | 1 |
| party-noun | camara | 12 | 5 | 0 | 7 |
| party-noun | holdout1 | 51 | 16 | 0 | 35 |
| party-noun | holdout2 | 10 | 4 | 0 | 6 |
| read-verb | camara | 0 | 0 | 0 | 0 |
| read-verb | holdout1 | 0 | 0 | 0 | 0 |
| read-verb | holdout2 | 0 | 0 | 0 | 0 |

### combo=readList (callerPhraseOn=false, readListOn=true)

| rule | set | hit | exact | leaks | over_tight |
| --- | --- | --- | --- | --- | --- |
| floor | camara | 218 | 194 | 1 | 23 |
| floor | holdout1 | 145 | 125 | 2 | 18 |
| floor | holdout2 | 197 | 178 | 0 | 19 |
| live-verb | camara | 19 | 12 | 0 | 7 |
| live-verb | holdout1 | 11 | 8 | 0 | 3 |
| live-verb | holdout2 | 12 | 11 | 0 | 1 |
| party-noun | camara | 12 | 5 | 0 | 7 |
| party-noun | holdout1 | 51 | 16 | 0 | 35 |
| party-noun | holdout2 | 10 | 4 | 0 | 6 |
| read-verb | camara | 43 | 41 | 2 | 0 |
| read-verb | holdout1 | 0 | 0 | 0 | 0 |
| read-verb | holdout2 | 1 | 1 | 0 | 0 |

### combo=callerPhrase (callerPhraseOn=true, readListOn=false)

| rule | set | hit | exact | leaks | over_tight |
| --- | --- | --- | --- | --- | --- |
| floor | camara | 261 | 195 | 1 | 65 |
| floor | holdout1 | 151 | 131 | 2 | 18 |
| floor | holdout2 | 198 | 178 | 0 | 20 |
| live-verb | camara | 19 | 12 | 0 | 7 |
| live-verb | holdout1 | 11 | 8 | 0 | 3 |
| live-verb | holdout2 | 12 | 11 | 0 | 1 |
| party-noun | camara | 12 | 5 | 0 | 7 |
| party-noun | holdout1 | 45 | 16 | 0 | 29 |
| party-noun | holdout2 | 10 | 4 | 0 | 6 |
| read-verb | camara | 0 | 0 | 0 | 0 |
| read-verb | holdout1 | 0 | 0 | 0 | 0 |
| read-verb | holdout2 | 0 | 0 | 0 | 0 |

### combo=both (callerPhraseOn=true, readListOn=true)

| rule | set | hit | exact | leaks | over_tight |
| --- | --- | --- | --- | --- | --- |
| floor | camara | 218 | 194 | 1 | 23 |
| floor | holdout1 | 151 | 131 | 2 | 18 |
| floor | holdout2 | 197 | 178 | 0 | 19 |
| live-verb | camara | 19 | 12 | 0 | 7 |
| live-verb | holdout1 | 11 | 8 | 0 | 3 |
| live-verb | holdout2 | 12 | 11 | 0 | 1 |
| party-noun | camara | 12 | 5 | 0 | 7 |
| party-noun | holdout1 | 45 | 16 | 0 | 29 |
| party-noun | holdout2 | 10 | 4 | 0 | 6 |
| read-verb | camara | 43 | 41 | 2 | 0 |
| read-verb | holdout1 | 0 | 0 | 0 | 0 |
| read-verb | holdout2 | 1 | 1 | 0 | 0 |

## Hidden x missed (combo=base: callerPhraseOn=false, readListOn=false) — 4 rows

PUT/DELETE/PATCH rows with gt_class x that the floor+raise-only shape never catches.

| set | repo | method | path | operationId | summary |
| --- | --- | --- | --- | --- | --- |
| camara | TrafficInfluence | PATCH | /traffic-influences/{trafficInfluenceID} | patchTrafficInfluence | updates a specific TrafficInfluence resource, identified by the trafficInfluence... |
| camara | TrafficInfluence | DELETE | /traffic-influences/{trafficInfluenceID} | deleteTrafficInfluence | Delete an existing TrafficInfluence resource |
| holdout1 | github | PUT | /repos/{owner}/{repo}/issues/{issue_number}/issue-field-values | issues/set-issue-field-values | Set issue field values for an issue |
| holdout1 | github | DELETE | /repos/{owner}/{repo}/issues/{issue_number}/sub_issue | issues/remove-sub-issue | Remove sub-issue |

## Party-noun over-tight (combo=base) — 48 rows

party-noun raises where the ground truth is not x.

| set | repo | method | path | operationId | summary | evidence |
| --- | --- | --- | --- | --- | --- | --- |
| camara | MultiPointVPN | PATCH | /networks/{serviceId} | updateNetwork | To update a multipoint virtual private network | summary:network |
| camara | MultiPointVPN | DELETE | /networks/{serviceId} | deleteNetwork | Delete multipoint virtual private network | summary:network |
| camara | NetworkAccessManagement | PATCH | /trust-domains/{trustDomainId}/devices/{deviceId} | updateTrustDomainDevice | Update a device in a Trust Domain | summary:device |
| camara | NetworkAccessManagement | DELETE | /trust-domains/{trustDomainId}/devices/{deviceId} | deleteTrustDomainDevice | Remove a device from a Trust Domain | summary:device |
| camara | QualityOnDemand | DELETE | /sessions/{sessionId} | deleteSession | Delete a QoS session | summary:session |
| camara | SessionInsights | DELETE | /sessions/{sessionId} | deleteSession | Delete session | summary:session |
| camara | WebRTC | DELETE | /sessions/{registrationId} | deleteRegistrationById | Delete Registration Session. | summary:session |
| holdout1 | twilio | DELETE | /2010-04-01/Accounts/{AccountSid}/Calls/{Sid}.json | DeleteCall | Delete a Call record from your account. Once the record is deleted, it will no l... | summary:call |
| holdout1 | twilio | DELETE | /2010-04-01/Accounts/{AccountSid}/IncomingPhoneNumbers/{ResourceSid}/AssignedAddOns/{Sid}.json | DeleteIncomingPhoneNumberAssignedAddOn | Remove the assignment of an Add-on installation from the Number specified. | summary:assignment |
| holdout1 | stripe | DELETE | /v1/accounts/{account}/bank_accounts/{id} | DeleteAccountsAccountBankAccountsId | Delete an external account | summary:account |
| holdout1 | stripe | DELETE | /v1/accounts/{account}/external_accounts/{id} | DeleteAccountsAccountExternalAccountsId | Delete an external account | summary:account |
| holdout1 | stripe | DELETE | /v1/accounts/{account}/people/{person} | DeleteAccountsAccountPeoplePerson | Delete a person | summary:person |
| holdout1 | stripe | DELETE | /v1/accounts/{account}/persons/{person} | DeleteAccountsAccountPersonsPerson | Delete a person | summary:person |
| holdout1 | stripe | DELETE | /v1/customers/{customer}/bank_accounts/{id} | DeleteCustomersCustomerBankAccountsId | Delete a customer source | opid:account |
| holdout1 | github | PUT | /organizations/{org}/actions/cache/storage-limit | actions/set-actions-cache-storage-limit-for-organization | Set GitHub Actions cache storage limit for an organization | opid:organization |
| holdout1 | github | PUT | /orgs/{org}/actions/permissions | actions/set-github-actions-permissions-organization | Set GitHub Actions permissions for an organization | opid:organization |
| holdout1 | github | PUT | /orgs/{org}/actions/permissions/repositories | actions/set-selected-repositories-enabled-github-actions-organization | Set selected repositories enabled for GitHub Actions in an organization | opid:organization |
| holdout1 | github | PUT | /orgs/{org}/actions/permissions/self-hosted-runners | actions/set-self-hosted-runners-permissions-organization | Set self-hosted runners settings for an organization | opid:organization |
| holdout1 | github | PUT | /orgs/{org}/actions/permissions/workflow | actions/set-github-actions-default-workflow-permissions-organization | Set default workflow permissions for an organization | opid:organization |
| holdout1 | github | PUT | /orgs/{org}/actions/runner-groups/{runner_group_id}/repositories/{repository_id} | actions/add-repo-access-to-self-hosted-runner-group-in-org | Add repository access to a self-hosted runner group in an organization | summary:access |
| holdout1 | github | PUT | /orgs/{org}/actions/secrets/{secret_name}/repositories/{repository_id} | actions/add-selected-repo-to-org-secret | Add selected repository to an organization secret | summary:repository |
| holdout1 | github | PUT | /orgs/{org}/actions/variables/{name}/repositories/{repository_id} | actions/add-selected-repo-to-org-variable | Add selected repository to an organization variable | summary:repository |
| holdout1 | github | DELETE | /orgs/{org}/agents/secrets/{secret_name}/repositories/{repository_id} | agents/remove-selected-repo-from-org-secret | Remove selected repository from an organization secret | summary:repository |
| holdout1 | github | DELETE | /orgs/{org}/agents/variables/{name}/repositories/{repository_id} | agents/remove-selected-repo-from-org-variable | Remove selected repository from an organization variable | summary:repository |
| holdout1 | github | DELETE | /orgs/{org}/blocks/{username} | orgs/unblock-user | Unblock a user from an organization | summary:user |
| holdout1 | github | PUT | /orgs/{org}/codespaces/secrets/{secret_name}/repositories/{repository_id} | codespaces/add-selected-repo-to-org-secret | Add selected repository to an organization secret | summary:repository |
| holdout1 | github | PUT | /orgs/{org}/copilot/coding-agent/permissions/repositories/{repository_id} | copilot/enable-copilot-coding-agent-for-repository-in-organization | Enable a repository for Copilot cloud agent in an organization | summary:repository |
| holdout1 | github | DELETE | /orgs/{org}/migrations/{migration_id}/repos/{repo_name}/lock | migrations/unlock-repo-for-org | Unlock an organization repository | summary:repository |
| holdout1 | github | PUT | /orgs/{org}/public_members/{username} | orgs/set-public-membership-for-authenticated-user | Set public organization membership for the authenticated user | summary:membership |
| holdout1 | github | DELETE | /orgs/{org}/settings/immutable-releases/repositories/{repository_id} | orgs/disable-selected-repository-immutable-releases-organization | Disable a selected repository for immutable releases in an organization | summary:repository |
| holdout1 | github | PUT | /repos/{owner}/{repo}/actions/permissions/access | actions/set-workflow-access-to-repository | Set the level of access for workflows outside of the repository | opid:repository |
| holdout1 | github | PUT | /repos/{owner}/{repo}/actions/permissions/selected-actions | actions/set-allowed-actions-repository | Set allowed actions and reusable workflows for a repository | opid:repository |
| holdout1 | github | PUT | /repos/{owner}/{repo}/interaction-limits/pulls/bypass-list | interactions/set-pull-request-bypass-list-for-repo | Add users to the pull request creation cap bypass list for a repository | summary:user |
| holdout1 | github | DELETE | /user/blocks/{username} | users/unblock | Unblock a user | summary:user |
| holdout1 | github | PUT | /user/codespaces/secrets/{secret_name}/repositories | codespaces/set-repositories-for-secret-for-authenticated-user | Set selected repositories for a user secret | opid:user |
| holdout1 | github | DELETE | /user/emails | users/delete-email-for-authenticated-user | Delete an email address for the authenticated user | opid:user |
| holdout1 | github | DELETE | /user/keys/{key_id} | users/delete-public-ssh-key-for-authenticated-user | Delete a public SSH key for the authenticated user | opid:user |
| holdout1 | github | DELETE | /user/packages/{package_type}/{package_name}/versions/{package_version_id} | packages/delete-package-version-for-authenticated-user | Delete a package version for the authenticated user | opid:user |
| holdout1 | github | DELETE | /user/starred/{owner}/{repo} | activity/unstar-repo-for-authenticated-user | Unstar a repository for the authenticated user | summary:repository |
| holdout1 | github | DELETE | /users/{username}/copilot-spaces/{space_number} | copilot-spaces/delete-for-user | Delete a Copilot Space for a user | opid:user |
| holdout1 | github | DELETE | /users/{username}/copilot-spaces/{space_number}/resources/{space_resource_id} | copilot-spaces/delete-resource-for-user | Delete a resource from a Copilot Space for a user | opid:user |
| holdout1 | github | DELETE | /users/{username}/projectsV2/{project_number}/items/{item_id} | projects/delete-item-for-user | Delete project item for user | opid:user |
| holdout2 | box | DELETE | /files/upload_sessions/{upload_session_id} | delete_files_upload_sessions_id | Remove upload session | summary:session |
| holdout2 | box | PUT | /integration_mappings/teams/{integration_mapping_id} | put_integration_mappings_teams_id | Update Teams integration mapping | opid:team |
| holdout2 | box | DELETE | /storage_policy_assignments/{storage_policy_assignment_id} | delete_storage_policy_assignments_id | Unassign storage policy | opid:assignment |
| holdout2 | box | PUT | /task_assignments/{task_assignment_id} | put_task_assignments_id | Update task assignment | summary:assignment |
| holdout2 | pagerduty | PUT | /teams/{id}/users/{user_id} | updateTeamUser | Add a user to a team | summary:user |
| holdout2 | adyen | DELETE | /storedPaymentMethods/{storedPaymentMethodId} | delete-storedPaymentMethods-storedPaymentMethodId | Delete a token for stored payment details | summary:token |

## Read-list leaks (readListOn=true, callerPhraseOn=false) — 2 rows

read-verb POST lowerings where the ground truth is not r.

| set | repo | method | path | operationId | summary |
| --- | --- | --- | --- | --- | --- |
| camara | CarrierBillingCheckOut | POST | /payments/{paymentId}/validate | validatePayment | Validate a payment |
| camara | OTPValidation | POST | /validate-code | validateCode | Verifies the OTP received as input |

## Caller-phrase effect (base vs callerPhraseOn=true) — 6 rows changed

Rows whose predicted class differs when callerPhraseOn flips from false to true.

| set | repo | method | path | operationId | gt_class | pred_off | pred_on |
| --- | --- | --- | --- | --- | --- | --- | --- |
| holdout1 | twilio | DELETE | /2010-04-01/Accounts/{AccountSid}/Calls/{Sid}.json | DeleteCall | w | x | w |
| holdout1 | github | PUT | /orgs/{org}/public_members/{username} | orgs/set-public-membership-for-authenticated-user | w | x | w |
| holdout1 | github | DELETE | /user/emails | users/delete-email-for-authenticated-user | w | x | w |
| holdout1 | github | DELETE | /user/keys/{key_id} | users/delete-public-ssh-key-for-authenticated-user | w | x | w |
| holdout1 | github | DELETE | /user/packages/{package_type}/{package_name}/versions/{package_version_id} | packages/delete-package-version-for-authenticated-user | w | x | w |
| holdout1 | github | DELETE | /user/starred/{owner}/{repo} | activity/unstar-repo-for-authenticated-user | w | x | w |

