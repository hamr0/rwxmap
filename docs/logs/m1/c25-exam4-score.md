# M1-C25: exam-4 scorer — frozen shapes on exam4-2026-09-12

Configs, via the real exported classifiers only (no forked logic):
1. c15 alone.
2. c15 + C20 (goal 2's own ledger) — allowlist minN=2, minW=0.80 (D48).
3. c15 + C22 (goal 1's own ledger) — variant N, allowlist minN=5, minW=0.95 (D51).
4. combined: c15 + C20 + C22, composed as classifyC22(row, junk, a22, 'N', rr => classifyC20(rr, junk, a20)). Reported ONLY on lines labelled "combined" — never as either goal's own number.

Allowlists built ONCE from the full 5465-row combined corpus (goal-2 allowlist: 439 words; goal-1 allowlist: 106 words). Every provider in exam4-2026-09-12 is, by construction (make-exam4.mjs's own exclusion rule for exam 4; exam 3 predates that rule but is scored here only as a plumbing dry run), absent from the corpus this allowlist was built on — no leave-one-vendor-out rebuild is needed or performed.

## Set loaded

/home/hamr/PycharmProjects/rwxmap/data/exam4-2026-09-12: 4000 blind rows, 20 truth-part file(s), 0 dropped for truth_class '?', 4000 scorable.
Of the 4000 scorable rows: 3158 high-confidence, 842 low-confidence.

## Scores, all scorable rows

| config | n | goal-2 leaks (x->w) | goal-1 fa: floor | goal-1 fa: live-verb | goal-1 fa: party-noun | goal-1 fa: no-own-noun | goal-1 fa: allowlist-wins | goal-1 fa: other | goal-1 fa total | all-loosening | exact |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1. c15 alone | 4000 | 684 (17.1%) | 0 | 58 | 324 | 0 | 0 | 0 | 382 (9.6%) | 684 (17.1%) | 2910 |
| 2. c15 + C20 | 4000 | 365 (9.1%) | 0 | 58 | 324 | 728 | 0 | 0 | 1110 (27.8%) | 365 (9.1%) | 2501 |
| 3. c15 + C22 | 4000 | 695 (17.4%) | 0 | 58 | 266 | 0 | 0 | 0 | 324 (8.1%) | 695 (17.4%) | 2957 |
| 4. combined (c15 + C20 + C22) | 4000 | 376 (9.4%) | 0 | 58 | 266 | 728 | 0 | 0 | 1052 (26.3%) | 376 (9.4%) | 2548 |

## Scores, high-confidence rows only (truth is a band — repeat headline counts on the sub-band judges were most sure of)

| config | n | goal-2 leaks (x->w) | goal-1 fa: floor | goal-1 fa: live-verb | goal-1 fa: party-noun | goal-1 fa: no-own-noun | goal-1 fa: allowlist-wins | goal-1 fa: other | goal-1 fa total | all-loosening | exact |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1. c15 alone | 3158 | 281 (8.9%) | 0 | 55 | 284 | 0 | 0 | 0 | 339 (10.7%) | 281 (8.9%) | 2516 |
| 2. c15 + C20 | 3158 | 130 (4.1%) | 0 | 55 | 284 | 635 | 0 | 0 | 974 (30.8%) | 130 (4.1%) | 2032 |
| 3. c15 + C22 | 3158 | 287 (9.1%) | 0 | 55 | 229 | 0 | 0 | 0 | 284 (9.0%) | 287 (9.1%) | 2565 |
| 4. combined (c15 + C20 + C22) | 3158 | 136 (4.3%) | 0 | 55 | 229 | 635 | 0 | 0 | 919 (29.1%) | 136 (4.3%) | 2081 |

## Goal 2's own ledger (config 2: c15 + C20)

Goal-2 leaks (truth x, said w): 365 of 4000 (9.1%).
False alarms C20's own 'no-own-noun' rule adds (truth w, said x, rule=no-own-noun): 728 of 4000 (18.2%).

Corpus LOVO prediction for comparison (D48, not recomputed here): 89/5465 = 1.6% goal-2 leaks.

Every goal-2 leak under config 2, in full (365 rows):

| method | path | operationId | summary | truth | confidence | reason | provider |
| --- | --- | --- | --- | --- | --- | --- | --- |
| PUT | /scope/{job} | sign_update | (none) | x | low | authority signs jwt for a verification job | 6-dot-authentiqio.appspot.com |
| DELETE | /accounts/{accountname}/users/{username} | delete_user | Delete a specific user credential by username of the credential. Cannot be the credential used to authenticate the request. | x | high | deletes another users credential explicitly not caller | anchore.io |
| PUT | /accounts/{accountname}/state | update_account_state | Update the state of an account to either enabled or disabled. For deletion use the DELETE route | x | high | enable or disable an account | anchore.io |
| PATCH | /dags/{dag_id}/dagRuns/{dag_run_id}/taskInstances/{task_id} | patch_task_instance | Updates the state of a task instance | x | low | updates task instance state can retrigger it | apache.org |
| PATCH | /dags/{dag_id}/dagRuns/{dag_run_id}/taskInstances/{task_id} | patch_task_instance | Updates the state of a task instance | x | low | updates task instance state duplicate row | apache.org |
| PATCH | /dags/{dag_id}/dagRuns/{dag_run_id}/taskInstances/{task_id}/{map_index} | patch_mapped_task_instance | Updates the state of a mapped task instance | x | low | updates mapped task instance state retriggers it | apache.org |
| PATCH | /dags/{dag_id}/dagRuns/{dag_run_id}/taskInstances/{task_id}/{map_index} | patch_mapped_task_instance | Updates the state of a mapped task instance | x | low | updates mapped task instance state duplicate row | apache.org |
| DELETE | /order.shipment.delete.json | OrderShipmentDelete | (none) | x | high | deletes a customer order shipment | api2cart.com |
| PUT | /customer.update.json | CustomerUpdate | (none) | x | high | updates a customers record | api2cart.com |
| PUT | /order.shipment.update.json | OrderShipmentUpdate | (none) | x | high | updates a customer order shipment | api2cart.com |
| PUT | /order.update.json | OrderUpdate | (none) | x | high | updates an existing customer order | api2cart.com |
| PUT | /admin/roleMappings/{principalId} | updateRoleMapping | Update a role mapping | x | low | updates a role mapping for another principal | apicurio.local |
| DELETE | /hris/employees/{id} | employeesDelete | Delete Employee | x | low | deletes an employee record | apideck.com |
| PATCH | /file-storage/shared-links/{id} | sharedLinksUpdate | Update Shared Link | x | low | updates a shared links access settings | apideck.com |
| DELETE | /v0.1/apps/{owner_name}/{app_name}/invitations/{user_email} | appInvitations_delete | (none) | x | low | removes another users pending app invitation | appcenter.ms |
| DELETE | /v0.1/orgs/{org_name}/teams/{team_name} | teams_delete | (none) | x | low | deletes a team removing members access | appcenter.ms |
| DELETE | /v1/userInvitations/{id} | userInvitations-delete_instance | (none) | x | low | deletes an invitation sent to another user | apple.com |
| DELETE | /v1/users/{id} | users-delete_instance | (none) | x | high | deletes a user account | apple.com |
| PATCH | /v1/users/{id} | users-update_instance | (none) | x | low | updates a user account | apple.com |
| PATCH | /users/{userId}/prefs | usersUpdatePrefs | Update User Preferences | x | low | updates another users preferences by id | appwrite.io |
| PUT | /rest/api/3/user/properties/{propertyKey} | setUserProperty | Set user property | x | low | admin can set property on any user | atlassian.com |
| DELETE | /individuals/{partyId} | (none) | Delete an individual | x | high | deletes another party's individual record | ato.gov.au |
| DELETE | /individuals/{partyId}/addresses/{addressId} | (none) | Delete an address | x | high | deletes another party's address record | ato.gov.au |
| DELETE | /individuals/{partyId}/business-names/{productId} | (none) | Delete a business name | x | high | deletes another party's business name record | ato.gov.au |
| DELETE | /individuals/{partyId}/electronic-addresses/{addressId} | (none) | Delete an electronic address | x | high | deletes another party's electronic address | ato.gov.au |
| DELETE | /individuals/{partyId}/licenses/{productId} | (none) | Delete a license | x | high | deletes another party's license record | ato.gov.au |
| DELETE | /organisations/{partyId} | (none) | Delete an organisation | x | high | deletes another party's organisation record | ato.gov.au |
| DELETE | /organisations/{partyId}/business-names/{productId} | (none) | Delete a business name | x | high | deletes another party's business name record | ato.gov.au |
| DELETE | /organisations/{partyId}/licenses/{productId} | (none) | Delete a license | x | high | deletes another party's license record | ato.gov.au |
| PUT | /individuals/{partyId} | (none) | Update an individual | x | high | updates another party's individual record | ato.gov.au |
| PUT | /individuals/{partyId}/addresses/{addressId} | (none) | Update an address | x | high | updates another party's address record | ato.gov.au |
| PUT | /individuals/{partyId}/business-names/{productId} | (none) | Update a business name | x | high | updates another party's business name record | ato.gov.au |
| PUT | /individuals/{partyId}/electronic-addresses/{addressId} | (none) | Update an electronic address | x | high | updates another party's electronic address | ato.gov.au |
| PUT | /individuals/{partyId}/licenses/{productId} | (none) | Update a license | x | high | updates another party's license record | ato.gov.au |
| PUT | /organisations/{partyId} | (none) | Update an organisation | x | high | updates another party's organisation record | ato.gov.au |
| PUT | /organisations/{partyId}/addresses/{addressId} | (none) | Update an address | x | high | updates another party's address record | ato.gov.au |
| PUT | /organisations/{partyId}/business-names/{productId} | (none) | Update a business name | x | high | updates another party's business name record | ato.gov.au |
| PUT | /organisations/{partyId}/electronic-addresses/{addressId} | (none) | Update an electronic address | x | high | updates another party's electronic address | ato.gov.au |
| PUT | /organisations/{partyId}/licenses/{productId} | (none) | Update a license | x | high | updates another party's license record | ato.gov.au |
| PUT | /revokeSubUserKey | revokeSubUserKey_revokeSubUserKey_put | Revoke a Sub User Key associated with your account. | x | high | revokes another sub user's access key | autodealerdata.com |
| DELETE | /subscriptions/{subscriptionId}/resourceGroups/{resourceGroupName}/providers/Microsoft.DocumentDB/databaseAccounts/{accountName}/privateEndpointConnections/{privateEndpointConnectionName} | PrivateEndpointConnections_Delete | (none) | x | low | removes another party's private network connection | azure.com |
| PATCH | /subscriptions/{subscriptionId}/resourceGroups/{resourceGroupName}/providers/Microsoft.Media/mediaservices/{accountName}/liveEvents/{liveEventName} | LiveEvents_Update | (none) | x | low | updates settings on a live streaming event | azure.com |
| DELETE | /profiles/{profileId} | (none) | Delete profile | x | low | deletes stored payment profile of a customer | beanstream.com |
| DELETE | /profiles/{profileId}/cards/{cardId} | (none) | Delete card | x | low | deletes stored card of a customer | beanstream.com |
| PUT | /profiles/{profileId} | (none) | Update Profile | x | low | updates stored payment profile | beanstream.com |
| PUT | /profiles/{profileId}/cards/{cardId} | (none) | Update card | x | low | updates stored card details | beanstream.com |
| DELETE | /clients/{id_client} | (none) | Delete a client | x | low | deletes a platform client possibly not own | biapi.pro |
| DELETE | /users/{id_user}/categories/full/{id_full} | (none) | Delete a user-created transaction category | x | low | deletes another user's transaction category | biapi.pro |
| DELETE | /users/{id_user}/connections/{id_connection}/accounts/{id_account}/transactions/{id_transaction}/informations | (none) | Delete all arbitrary key-value pairs of a transaction | x | low | deletes another user's transaction data | biapi.pro |
| DELETE | /users/{id_user}/connections/{id_connection}/transactionsclusters/{id_transactionscluster} | (none) | Delete a clustered transaction | x | low | deletes another user's clustered transaction | biapi.pro |
| DELETE | /users/{id_user}/transactionsclusters/{id_transactionscluster} | (none) | Delete a clustered transaction | x | low | deletes another user's clustered transaction | biapi.pro |
| PUT | /clients/{id_client} | (none) | Update a client | x | low | updates a platform client possibly not own | biapi.pro |
| PUT | /connections/{id_connection}/sources/{id_source} | (none) | Update connection source | x | low | forces sync on a connection not clearly own | biapi.pro |
| PUT | /users/{id_user}/accounts/{id_account}/transactionsclusters/{id_transactionscluster} | (none) | Edit a clustered transaction | x | low | edits another user's clustered transaction | biapi.pro |
| PUT | /users/{id_user}/connections/{id_connection}/accounts/{id_account}/transactions/{id_transaction} | (none) | Edit a transaction meta-data | x | low | edits another user's transaction metadata | biapi.pro |
| PUT | /users/{id_user}/connections/{id_connection}/transactionsclusters/{id_transactionscluster} | (none) | Edit a clustered transaction | x | low | edits another user's clustered transaction | biapi.pro |
| PUT | /users/{id_user}/transactionsclusters/{id_transactionscluster} | (none) | Edit a clustered transaction | x | low | edits another user's clustered transaction | biapi.pro |
| PUT | /api/v1/orders/{id}/orderstate | OrderApi_UpdateState | Changes the main state of a single order | x | high | propagates order state to external marketplace | billbee.io |
| DELETE | /repositories/{workspace}/{repo_slug}/pullrequests/{pull_request_id}/comments/{comment_id} | (none) | Delete a comment on a pull request | x | low | could delete another user's pr comment | bitbucket.org |
| PUT | /spaces/{spaceId}/welcomebox/{content} | v2UpdateWelcomeBoxContent | Update content of welcome box | x | low | edits shared space welcome content | circuitsandbox.net |
| PUT | /spaces/{topicId}/unpin | unpinTopic | Unpin a topic | x | low | unpins topic visible to space members | circuitsandbox.net |
| DELETE | /api/v/2/devices/{SystemKey} | DeleteDevices | DEVICES - Delete devices using a query | x | high | deletes physical devices matching query | clearblade.com |
| DELETE | /organisations/{id} | deleteOrganisationsId | (none) | x | low | deletes whole organisation affecting members | clever-cloud.com |
| PUT | /subaccounts/{subaccount_id}/regen-api-key | Regenerate API Key | Regenerate API Key | x | low | regenerates subaccount api key invalidating old | clicksend.com |
| PATCH | /urbanDelivery/confirmTransaction | confirmPaymentOfTransaction | confirmTransaction | x | high | confirms payment transaction | climatekuul.com |
| PATCH | /policies/{account}/policy/{identifier} | updatePolicy | Modifies an existing Conjur policy. | x | high | modifies access policy for the org | conjur.local |
| PUT | /authn/{account}/api_key | rotateApiKey | Rotates a role's API key. | x | high | rotates a role's api key possibly another role | conjur.local |
| PUT | /policies/{account}/policy/{identifier} | replacePolicy | Loads or replaces a Conjur policy document. | x | high | replaces entire access policy deleting unlisted data | conjur.local |
| DELETE | /subscriptions/{id} | (none) | Delete a subscription. | x | low | deletes a subscription possibly anothers | contribly.com |
| DELETE | /api/v1/users/registrations/{registrationId} | deleteRegistration | Delete registration | x | low | deletes a registration entry possibly anothers | cpy.re |
| DELETE | /api/v1/videos/{id}/blacklist | delVideoBlock | Unblock a video by its id | x | low | unblocks a video affecting public visibility | cpy.re |
| DELETE | /api/v1/videos/{id}/comments/{commentId} | (none) | Delete a comment or a reply | x | low | deletes a comment possibly anothers | cpy.re |
| PUT | /api/v1/config/custom | putCustomConfig | Set instance runtime configuration | x | high | sets instance-wide runtime config | cpy.re |
| PUT | /api/v1/videos/{id}/rate | (none) | Like/dislike a video | x | high | rates anothers video affecting its score | cpy.re |
| DELETE | /rest-service/reviews-v1/{id}/comments/{cId} | removeComment | (none) | x | low | deletes a comment possibly anothers | crucible.local |
| DELETE | /rest-service/reviews-v1/{id}/comments/{cId}/replies/{rId} | removeReply | (none) | x | low | deletes a reply possibly anothers | crucible.local |
| PUT | /api/articles/{id}/unpublish | unpublishArticle | Unpublish an article | x | high | unpublishes anothers article as moderator | dev.to |
| PUT | /posts/{id}/locked.json | lockPost | Lock a post from being edited | x | low | locks a post preventing others edits | discourse.local |
| PUT | /v2/orgs/{name}/settings | (none) | Update organization settings | x | low | updates org settings affecting other members | docker.com |
| DELETE | /v4/nodes/{node_id} | removeNode | Remove node | x | low | deletes a node possibly a shared room | dracoon.team |
| DELETE | /v4/nodes/{node_id}/deleted_nodes | emptyDeletedNodes | Empty recycle bin | x | low | empties recycle bin in shared room | dracoon.team |
| DELETE | /v4/system/config/auth/radius | removeRadiusConfig | Remove RADIUS configuration | x | low | removes radius auth config affecting users | dracoon.team |
| DELETE | /v4/system/config/oauth/clients/{client_id} | removeOAuthClient | Remove OAuth client | x | low | removes oauth client affecting its users | dracoon.team |
| PUT | /v4/system/config/auth/ads/{ad_id} | updateAdConfig | Update Active Directory configuration | x | low | updates ad config affecting org authentication | dracoon.team |
| DELETE | /api/appointments/{id} | appointments_delete | (none) | x | high | deletes a patient's appointment | drchrono.com |
| DELETE | /api/lab_documents/{id} | lab_documents_delete | (none) | x | high | deletes a patient's lab document | drchrono.com |
| DELETE | /api/lab_orders/{id} | lab_orders_delete | (none) | x | high | deletes a patient's lab order | drchrono.com |
| DELETE | /api/lab_results/{id} | lab_results_delete | (none) | x | high | deletes a patient's lab result | drchrono.com |
| PATCH | /api/allergies/{id} | allergies_partial_update | (none) | x | high | updates a patient's allergy record | drchrono.com |
| PATCH | /api/consent_forms/{id} | consent_forms_partial_update | (none) | x | high | updates a patient's consent form | drchrono.com |
| PATCH | /api/documents/{id} | documents_partial_update | (none) | x | low | likely updates a patient document | drchrono.com |
| PATCH | /api/medications/{id}/append_to_pharmacy_note | medications_append_to_pharmacy_note | (none) | x | low | appends note sent to pharmacy | drchrono.com |
| PATCH | /api/patient_messages/{id} | patient_messages_partial_update | (none) | x | high | updates a patient message | drchrono.com |
| PUT | /api/amendments/{id} | amendments_update | (none) | x | high | updates a patient amendment | drchrono.com |
| PUT | /api/consent_forms/{id} | consent_forms_update | (none) | x | high | updates a patient consent form | drchrono.com |
| PUT | /api/lab_documents/{id} | lab_documents_update | (none) | x | high | updates a patient lab document | drchrono.com |
| PUT | /api/lab_orders/{id} | lab_orders_update | (none) | x | high | updates a patient lab order | drchrono.com |
| DELETE | /v1/chargestations/{id} | deleteChargeStation | (none) | x | low | deletes shared charge station device | edrv.io |
| DELETE | /v1/connectors/{id} | deleteConnector | (none) | x | low | deletes shared connector device | edrv.io |
| DELETE | /v1/drivers/{id} | deleteDriver | (none) | x | high | deletes another party's driver record | edrv.io |
| PATCH | /v1/chargestations/{id} | patchChargeStation | (none) | x | low | updates shared charge station data | edrv.io |
| PATCH | /v1/commands/{id}/variables | patchChargeStationVariable | (none) | x | low | updates charge station config variables | edrv.io |
| PATCH | /v1/connectors/{id} | patchConnector | (none) | x | low | updates shared connector data | edrv.io |
| PATCH | /v1/drivers/{id} | patchDriver | (none) | x | high | updates another party's driver data | edrv.io |
| DELETE | /me/vendors/{vendor} | disconnectVendor | Disconnect Vendor | x | low | disconnects a user's vendor account | enode.io |
| PUT | /rest-service-fecru/admin/projects/{sourceProjectKey}/move-reviews/{destinationProjectKey} | moveAllReviews | (none) | x | high | bulk moves reviews between projects | fecru.local |
| PUT | /rest-service-fecru/admin/repositories/{repository}/reindex-source | (none) | (none) | x | low | clears cache and restarts shared repo | fecru.local |
| DELETE | /classes/{class}/assignments/{assignment}/submissions/{submission} | deleteSubmission | Delete a submission | x | high | deletes a student's submission | flat.io |
| PUT | /classes/{class}/assignments/{assignment}/submissions/{submission} | editSubmission | Edit a submission | x | low | teacher grades a student's submission | flat.io |
| DELETE | /combined_submissions/{combined_submission_id} | expireCombinedSubmission | Expire a combined submission | x | low | expires a submission a signer awaits | formapi.io |
| DELETE | /submissions/{submission_id} | expireSubmission | Expire a PDF submission | x | low | expires a pdf submission for signer | formapi.io |
| DELETE | /entity/{entityId} | DeleteEntity | Delete Entity | x | high | marks an entity deleted affecting others | frankiefinancial.io |
| PATCH | /repos/{owner}/{repo}/issues/comments/{id} | issueEditComment | Edit a comment | x | low | edits a comment possibly another's | gitea.io |
| DELETE | /v3/projects/{id}/issues/{noteable_id}/notes/{note_id} | deleteV3ProjectsIdIssuesNoteableIdNotesNoteId | Delete a +noteable+ note | x | low | deletes a note possibly another's | gitlab.com |
| PUT | /v3/application/settings | putV3ApplicationSettings | Modify application settings | x | high | changes instance wide application settings | gitlab.com |
| DELETE | /v3/{name} | travelpartner.accounts.accountLinks.delete | (none) | x | low | deletes a link between accounts | google.com |
| DELETE | /v1/{name} | androidmanagement.enterprises.webApps.delete | (none) | x | low | deletes web app used by managed devices | googleapis.com |
| PUT | /androidenterprise/v1/enterprises/{enterpriseId}/users/{userId} | androidenterprise.users.update | (none) | x | high | admin updates managed employee's user record | googleapis.com |
| PUT | /management/accounts/{accountId}/webproperties/{webPropertyId}/profiles/{profileId}/entityUserLinks/{linkId} | analytics.management.profileUserLinks.update | (none) | x | high | updates another user's view permissions | googleapis.com |
| DELETE | /accounts/{id}/workers/ | accounts_workers_destroy | (none) | x | high | deletes an employee worker record | gsmtasks.com |
| DELETE | /users/{id}/ | users_destroy | (none) | x | high | deletes a user account | gsmtasks.com |
| PUT | /account_roles/{id}/ | account_roles_update | (none) | x | low | role definition affects others with that role | gsmtasks.com |
| PUT | /users/{id}/ | users_update | (none) | x | low | updates a user record possibly another employee | gsmtasks.com |
| DELETE | /automation/v4/actions/{appId}/{definitionId}/functions/{functionType} | delete-/automation/v4/actions/{appId}/{definitionId}/functions/{functionType}_archiveByFunctionType | Delete a custom action function | x | high | deletes function used by other portals workflows | hubapi.com |
| DELETE | /automation/v4/actions/{appId}/{definitionId}/functions/{functionType}/{functionId} | delete-/automation/v4/actions/{appId}/{definitionId}/functions/{functionType}/{functionId}_archive | Delete a custom action function | x | high | deletes function used by other portals workflows | hubapi.com |
| DELETE | /crm/v3/extensions/cards/{appId}/{cardId} | delete-/crm/v3/extensions/cards/{appId}/{cardId}_archive | Delete a card | x | high | removes card definition used by other portals | hubapi.com |
| DELETE | /marketing/v3/marketing-events/events/{externalEventId} | delete-/marketing/v3/marketing-events/events/{externalEventId}_archive | (none) | x | low | deletes marketing event may affect attendees | hubapi.com |
| PATCH | /crm/v3/extensions/cards/{appId}/{cardId} | patch-/crm/v3/extensions/cards/{appId}/{cardId}_update | Update a card | x | low | updates card definition used by other portals | hubapi.com |
| PATCH | /marketing/v3/marketing-events/events/{externalEventId} | patch-/marketing/v3/marketing-events/events/{externalEventId}_update | (none) | x | low | updates marketing event may affect attendees | hubapi.com |
| PUT | /automation/v4/actions/{appId}/{definitionId}/functions/{functionType} | put-/automation/v4/actions/{appId}/{definitionId}/functions/{functionType}_createOrReplaceByFunctionType | Create or replace a custom action function | x | low | replaces function used by other portals workflows | hubapi.com |
| PUT | /automation/v4/actions/{appId}/{definitionId}/functions/{functionType}/{functionId} | put-/automation/v4/actions/{appId}/{definitionId}/functions/{functionType}/{functionId}_createOrReplace | Create or replace a custom action function | x | low | replaces function used by other portals workflows | hubapi.com |
| PUT | /marketing/v3/marketing-events/events/{externalEventId} | put-/marketing/v3/marketing-events/events/{externalEventId}_replace | (none) | x | low | replaces marketing event may affect attendees | hubapi.com |
| PATCH | /account/users/{userId}/metadata | User.patchMetadata | Modify metadata | x | low | modifies another user metadata | ijenko.net |
| PUT | /v1/servers/options/server-size/{size}/ | servers_options_server_size_replace | Replace a server size by id | x | low | replaces platform wide server size option | illumidesk.com |
| PUT | /v1/users/{user}/emails/{email_id}/ | users_emails_replace | Replace an email address | x | low | replaces email address possibly another user | illumidesk.com |
| DELETE | /media/{media-id}/comments/{comment-id} | (none) | Remove a comment. | x | low | removes a comment possibly anothers | instagram.com |
| DELETE | /offerings/{offeringId}/users/{userEmail}/assessments/{assessmentId} | (none) | Reset user's assessment to draft state | x | high | resets a users submitted assessment | iqualify.com |
| DELETE | /accounts/{id} | accounts_destroy | (none) | x | high | deletes account cascading to contacts and roles | ix-api.net |
| DELETE | /network-feature-configs/{id} | network_feature_configs_destroy | (none) | x | low | decommissions shared exchange network config | ix-api.net |
| DELETE | /network-service-configs/{id} | network_service_configs_destroy | (none) | x | low | decommissions shared exchange network config | ix-api.net |
| DELETE | /network-services/{id} | network_services_destroy | (none) | x | low | decommissions shared exchange network service | ix-api.net |
| DELETE | /role-assignments/{assignment_id} | role_assignments_destroy | (none) | x | high | removes a contacts role assignment access | ix-api.net |
| PATCH | /network-feature-configs/{id} | network_feature_configs_partial_update | (none) | x | low | updates shared exchange network config | ix-api.net |
| PATCH | /network-service-configs/{id} | network_service_configs_partial_update | (none) | x | low | updates shared exchange network config | ix-api.net |
| PATCH | /network-services/{id} | network_services_partial_update | (none) | x | low | updates shared exchange network service | ix-api.net |
| PUT | /network-feature-configs/{id} | network_feature_configs_update | (none) | x | low | updates shared exchange network config | ix-api.net |
| PUT | /network-service-configs/{id} | network_service_configs_update | (none) | x | low | updates shared exchange network config | ix-api.net |
| PUT | /network-services/{id} | network_services_update | (none) | x | low | updates shared exchange network service | ix-api.net |
| DELETE | /Users/{userId}/Images/{imageType} | DeleteUserImage | Delete the user's image. | x | low | deletes an image possibly another users | jellyfin.local |
| DELETE | /Users/{userId}/Images/{imageType}/{index} | DeleteUserImageByIndex | Delete the user's image. | x | low | deletes an image possibly another users | jellyfin.local |
| DELETE | /api/2/attachment/{id} | removeAttachment | (none) | x | low | removes attachment from shared issue | jira.local |
| DELETE | /api/2/issueLink/{linkId} | deleteIssueLink | (none) | x | low | deletes link between shared issues | jira.local |
| DELETE | /api/2/issueLinkType/{issueLinkTypeId} | deleteIssueLinkType | (none) | x | low | deletes a global issue link type | jira.local |
| DELETE | /api/2/workflowscheme/{id}/draft/workflow | deleteDraftWorkflowMapping | (none) | x | low | removes workflow from draft scheme | jira.local |
| PUT | /api/2/application-properties/{id} | setPropertyViaRestfulTable | (none) | x | low | modifies a global application property | jira.local |
| PUT | /api/2/filter/{id} | editFilter | (none) | x | low | updates a filter possibly shared | jira.local |
| PUT | /api/2/issueLinkType/{issueLinkTypeId} | updateIssueLinkType | (none) | x | low | updates a global issue link type | jira.local |
| PUT | /api/2/issuetype/{id} | updateIssueType | (none) | x | low | updates a global issue type | jira.local |
| PUT | /api/2/version/{id} | updateVersion | (none) | x | low | updates a shared project version | jira.local |
| DELETE | /delivery/pools/{deliveryPoolId} | (none) | Delete a delivery pool | x | high | deletes pool unlinking restaurants from it | just-eat.co.uk |
| DELETE | /delivery/pools/{deliveryPoolId}/restaurants | (none) | Remove restaurants from a delivery pool | x | high | removes restaurants from a delivery pool | just-eat.co.uk |
| DELETE | /v1/{tenant}/restaurants/{id}/event/offline | (none) | Delete Offline Event | x | high | removes restaurant from offline events | just-eat.co.uk |
| PUT | /delivery/pools/{deliveryPoolId} | (none) | Replace an existing delivery pool | x | high | replaces delivery pool affecting restaurants | just-eat.co.uk |
| PUT | /delivery/pools/{deliveryPoolId}/restaurants | (none) | Add restaurants to an existing delivery pool | x | high | adds restaurants to a delivery pool | just-eat.co.uk |
| PUT | /driver-at-delivery-address | (none) | Driver at delivery address | x | high | webhook event driver at delivery address | just-eat.co.uk |
| PUT | /driver-location | (none) | Driver Location | x | high | updates a drivers live location | just-eat.co.uk |
| PUT | /orders/deliverystate/driverlocation | (none) | Update current driver locations (bulk upload) | x | high | bulk updates driver locations | just-eat.co.uk |
| DELETE | /{realm}/client-scopes/{id}/scope-mappings/realm | (none) | Remove a set of realm-level roles from the client’s scope | x | high | removes realm roles from client scope | keycloak.local |
| DELETE | /{realm}/clients/{id}/default-client-scopes/{clientScopeId} | (none) | (none) | x | low | removes default scope from client | keycloak.local |
| DELETE | /{realm}/clients/{id}/optional-client-scopes/{clientScopeId} | (none) | (none) | x | low | removes optional scope from client | keycloak.local |
| DELETE | /{realm}/clients/{id}/scope-mappings/realm | (none) | Remove a set of realm-level roles from the client’s scope | x | high | removes realm roles from client scope | keycloak.local |
| DELETE | /{realm}/default-optional-client-scopes/{clientScopeId} | (none) | (none) | x | low | removes default optional client scope | keycloak.local |
| DELETE | /{realm}/roles-by-id/{role-id}/composites | (none) | Remove a set of roles from the role’s composite | x | high | removes roles from composite role | keycloak.local |
| PUT | /{realm}/identity-provider/instances/{alias} | (none) | Update the identity provider | x | high | updates identity provider affecting its users | keycloak.local |
| PUT | /{realm}/identity-provider/instances/{alias}/mappers/{id} | (none) | Update a mapper for the identity provider | x | high | updates identity provider mapper affecting users | keycloak.local |
| DELETE | /v1/SubscriptionsApi/{serial} | SubscriptionsApi_DeleteSubscription | (none) | x | low | deletes customer subscription record | keyserv.solutions |
| PUT | /v1/SubscriptionsApi | SubscriptionsApi_PutSubscription | (none) | x | low | replaces a customer's subscription | keyserv.solutions |
| DELETE | /apis/apiextensions.k8s.io/v1/customresourcedefinitions | deleteApiextensionsV1CollectionCustomResourceDefinition | (none) | x | low | deletes cluster-wide custom resource definitions | kubernetes.io |
| DELETE | /apis/internal.apiserver.k8s.io/v1alpha1/storageversions | deleteInternalApiserverV1alpha1CollectionStorageVersion | (none) | x | low | deletes cluster-wide storage version records | kubernetes.io |
| DELETE | /apis/resource.k8s.io/v1alpha1/resourceclasses | deleteResourceV1alpha1CollectionResourceClass | (none) | x | low | deletes cluster-wide resource classes | kubernetes.io |
| DELETE | /apis/storage.k8s.io/v1/volumeattachments | deleteStorageV1CollectionVolumeAttachment | (none) | x | low | deletes cluster-wide volume attachments | kubernetes.io |
| PATCH | /apis/networking.k8s.io/v1/ingressclasses/{name} | patchNetworkingV1IngressClass | (none) | x | low | patches cluster-wide ingress class | kubernetes.io |
| PUT | /api/v1/nodes/{name}/status | replaceCoreV1NodeStatus | (none) | x | low | updates shared cluster node status | kubernetes.io |
| PUT | /apis/flowcontrol.apiserver.k8s.io/v1beta2/prioritylevelconfigurations/{name} | replaceFlowcontrolApiserverV1beta2PriorityLevelConfiguration | (none) | x | low | updates cluster-wide priority config | kubernetes.io |
| PATCH | /appkey | appkey_patch | Compromise app key | x | high | marks another party's app key compromised | kumpeapps.com |
| PATCH | /authentication/appkey | auth_appkey_patch | Compromise app key | x | high | marks another party's app key compromised | kumpeapps.com |
| PATCH | /authentication/authkey | auth_authkey_patch | Compromise auth key | x | high | marks a user's auth key compromised | kumpeapps.com |
| PATCH | /authkey | authkey_patch | Compromise auth key | x | high | marks a user's auth key compromised | kumpeapps.com |
| PUT | /users/{projectKey}/{environmentKey}/{userKey}/flags/{featureFlagKey} | putFlagSetting | Specifically enable or disable a feature flag for a user based on their key. | x | low | toggles flag for specific end user | launchdarkly.com |
| DELETE | /providers/employers/{employerId}/documenttemplates/{documentId} | DeleteDocumentTemplateByEmployerIdAndDocumentId | Delete a document template in the employer dossier | x | low | provider deletes employer's document template | loket.nl |
| DELETE | /providers/employers/{employerId}/logo | DeleteEmployerLogoByEmployerId | Delete the employer logo | x | low | provider deletes employer's logo | loket.nl |
| DELETE | /providers/employers/customfields/{customFieldId} | DeleteCustomFieldByCustomFieldId | Delete a custom field record | x | low | provider deletes a custom field record | loket.nl |
| PATCH | /providers/employers/conceptemployees/import/{payrollAdministrationId} | PatchImportConceptEmployeesByPayrollAdministrationId | Import concept employees via a file | x | low | imports employer's employee records | loket.nl |
| PUT | /providers/employers/{employerId}/leavetypes/{leaveTypeId} | PutLeaveTypeByEmployerIdAndLeaveTypeId | Edit the details of a leave type | x | low | edits employer's leave type details | loket.nl |
| PUT | /providers/employers/employees/employments/fiscalproperties/{fiscalPropertiesId} | PutFiscalPropertiesByFiscalPropertiesId | Edit the details of a fiscal record | x | low | edits employee's fiscal properties | loket.nl |
| PUT | /providers/employers/employees/employments/payrollperioddata/{payrollperioddataId} | PutPayrollPeriodDataByPayrollPeriodDataId | Edit the details of an payroll period data | x | low | edits employee's payroll period data | loket.nl |
| PUT | /preflight/autocheckin/{ticketnumber} | Auto Check-In | Auto Check-In | x | high | triggers check-in for a passenger | lufthansa.com |
| PUT | /V1/companyCredits/{id} | companyCreditCreditLimitRepositoryV1SavePut | companyCredits/{id} | x | low | updates a company's credit limit | magento.com |
| PUT | /V1/guest-carts/{cartId} | quoteGuestCartManagementV1AssignCustomerPut | guest-carts/{cartId} | x | low | assigns a customer to a cart | magento.com |
| PUT | /V1/hierarchy/move/{id} | companyCompanyHierarchyV1MoveNodePut | hierarchy/move/{id} | x | low | moves users within company hierarchy | magento.com |
| PATCH | /api/services/{serviceId}/apikeys/{clientId} | patchApiKey | Update an api key with a diff | x | low | patches an api key consumer's access | maif.local |
| PUT | /api/services/{serviceId}/apikeys/{clientId} | updateApiKey | Update an api key | x | low | updates an api key consumer's access | maif.local |
| PUT | /networks/{networkId}/sm/devices/checkin | checkinNetworkSmDevices | Force check-in a set of devices | x | high | forces device action each call | meraki.com |
| DELETE | /roleManagement/entitlementManagement/roleAssignmentApprovals/{approval-id}/steps/{approvalStep-id} | roleManagement.entitlementManagement.roleAssignmentApprovals.DeleteSteps | Delete navigation property steps for roleManagement | x | low | deletes step in another's approval flow | microsoft.com |
| DELETE | /users/{user-id}/calendars/{calendar-id}/calendarView/{event-id}/instances/{event-id1}/exceptionOccurrences/{event-id2}/attachments/{attachment-id} | users.calendars.calendarView.instances.exceptionOccurrences.DeleteAttachments | Delete navigation property attachments for users | x | high | deletes another named user's attachment | microsoft.com |
| PATCH | /users/{user-id}/calendarGroups/{calendarGroup-id}/calendars/{calendar-id}/events/{event-id}/singleValueExtendedProperties/{singleValueLegacyExtendedProperty-id} | users.calendarGroups.calendars.events.UpdateSingleValueExtendedProperties | Update the navigation property singleValueExtendedProperties in users | x | high | edits another named user's calendar data | microsoft.com |
| DELETE | /servers/{serverid}/users/{userid}/attributes/ | deleteUserAttributes | Delete all attributes of a specific user | x | high | deletes a specific user's attributes | n-auth.com |
| DELETE | /servers/{serverid}/users/{userid}/attributes/{attributekey} | deleteUserAttribute | Delete specific attribute of a specific user | x | high | deletes a specific user's attribute | n-auth.com |
| PUT | /servers/{serverid}/users/{userid}/attributes/ | updateUserAttributes | Update specified attributes of a specific user | x | high | updates a specific user's attributes | n-auth.com |
| DELETE | /api/Accounts/{accountId}/SavingsStrategies | Accounts_DeleteSavingsStrategiesByAccountid | (none) | x | high | removes a client's savings strategies | naviplancentral.com |
| DELETE | /api/Accounts/{accountId}/SavingsStrategies/{id} | Accounts_DeleteSavingsStrategyByAccountidId | (none) | x | high | removes a client's savings strategy | naviplancentral.com |
| DELETE | /api/EducationGoals/{id} | EducationGoals_DeleteById | (none) | x | high | removes a client's education goal | naviplancentral.com |
| DELETE | /api/Expenses/{id} | Expenses_DeleteById | (none) | x | high | removes a client's expense record | naviplancentral.com |
| DELETE | /api/Incomes/{id} | Incomes_DeleteById | (none) | x | high | removes a client's income record | naviplancentral.com |
| DELETE | /api/LongTermCareInsurancePolicies/{id} | LongTermCareInsurancePolicies_DeleteById | (none) | x | high | removes a client's insurance policy | naviplancentral.com |
| DELETE | /api/RealEstateAssets/{id} | RealEstateAssets_DeleteById | (none) | x | high | removes a client's real estate asset | naviplancentral.com |
| PUT | /api/CriticalIllnessInsurancePolicies/{id} | CriticalIllnessInsurancePolicies_PutByIdModel | (none) | x | high | replaces a client's insurance policy | naviplancentral.com |
| PUT | /api/DefinedBenefitPensions/{id} | DefinedBenefitPensions_PutDefinedBenefitPensionByIdModel | (none) | x | high | replaces a client's pension record | naviplancentral.com |
| PUT | /api/Demographics/{demographicId}/Dependents/{id} | Demographics_PutByDemographicidIdModel | (none) | x | high | replaces a client's dependent record | naviplancentral.com |
| PUT | /api/DisabilityInsurancePolicies/{id} | DisabilityInsurancePolicies_PutByIdModel | (none) | x | high | replaces a client's insurance policy | naviplancentral.com |
| PUT | /api/FactFinders/{id}/Populate | FactFinders_PutPopulateFactFinderByIdModel | (none) | x | high | populates plan once not repeatable | naviplancentral.com |
| PUT | /api/LifeInsurancePolicies/{id} | LifeInsurancePolicies_PutByIdModel | (none) | x | high | replaces a client's life policy | naviplancentral.com |
| PUT | /api/MajorPurchaseGoals/{id} | MajorPurchaseGoals_PutByIdModel | (none) | x | high | replaces a client's purchase goal | naviplancentral.com |
| PUT | /api/RealEstateAssets/{id} | RealEstateAssets_PutByIdModel | (none) | x | high | replaces a client's real estate asset | naviplancentral.com |
| PUT | /api/RetirementGoals/{retirementGoalId}/Expenses/{id} | RetirementGoals_PutByRetirementgoalidIdModel | (none) | x | high | replaces a client's goal expense | naviplancentral.com |
| DELETE | /account-access-consents/{consentId} | (none) | Delete Account Access Consents | x | high | revokes a customer's bank access consent | nbg.gr |
| DELETE | /conversations/{conversation_id} | deleteConversation | Delete a conversation | x | low | deletes shared conversation for all members | nexmo.com |
| DELETE | /conversations/{conversation_id}/events/{event_id} | deleteEvent | Delete an event | x | low | deletes event in shared conversation | nexmo.com |
| PATCH | /{api_key}/subaccounts/{subaccount_key} | modifySubaccount | Modify a subaccount | x | low | modifies a subaccount another entity | nexmo.com |
| PUT | /conversations/{conversation_id} | replaceConversation | Update a conversation | x | low | updates shared conversation metadata | nexmo.com |
| PUT | /conversations/{conversation_id}/record | recordConversation | Record a conversation | x | high | records a live conversation | nexmo.com |
| DELETE | /api/v2/payments/creditors/{id}/ | payments_creditors_destroy | (none) | x | high | deletes a payment creditor | nordigen.com |
| PATCH | /v1/subscriptions/plans/{plan-id} | updatePlan | Update plan | x | high | updates plan affecting future subscribers | nowpayments.io |
| PUT | /api/v1/users/{userId} | setRecoveryCredential | Set Recovery Credential | x | low | admin sets another user's recovery credential | okta.local |
| DELETE | /account-access-consents/{ConsentId} | DeleteAccountAccessConsentsConsentId | Delete Account Access Consents | x | high | deletes account access consent | openbanking.org.uk |
| DELETE | /funds-confirmation-consents/{ConsentId} | DeleteFundsConfirmationConsentsConsentId | Delete Funds Confirmation Consent | x | high | deletes funds confirmation consent | openbanking.org.uk |
| DELETE | /v1/consents/{consentId} | deleteConsent | Delete Consent | x | high | deletes end user access consent | openbankingproject.ch |
| DELETE | /v1/signing-baskets/{basketId} | deleteSigningBasket | Delete the signing basket | x | low | deletes basket tied to payment transactions | openbankingproject.ch |
| DELETE | /apps/{appId} | (none) | Removes app and all versions | x | low | removes developer's app on their behalf | openchannel.io |
| DELETE | /permission/apps/{appId} | (none) | Removes permission that allows the app to access this user's data | x | high | revokes app's access to user data | openchannel.io |
| DELETE | /stripe-gateway/user/{userId}/cards/{cardId} | (none) | Removes a credit card for a user | x | high | removes a user's credit card | openchannel.io |
| DELETE | /transactions/{transactionId} | (none) | Deleted a transaction | x | high | deletes a financial transaction | openchannel.io |
| PATCH | /apps/{appId}/versions/{version} | (none) | Updates the app fields or creates a new version | x | low | updates developer's app on their behalf | openchannel.io |
| PATCH | /developers/{developerId} | (none) | Updates the developer fields | x | low | updates a developer | openchannel.io |
| PATCH | /ownership/{ownershipId} | (none) | Updates ownership fields | x | low | updates ownership fields | openchannel.io |
| PATCH | /users/{userId} | (none) | Updates user fields | x | low | updates user fields | openchannel.io |
| DELETE | /attribute/{namespace} | (none) | Delete an attribute namespace and all attributes below. | x | low | deletes namespace across all projects | opensuse.org |
| DELETE | /attribute/{namespace}/_meta | (none) | Delete an attribute namespace and all attributes below. | x | low | deletes namespace across all projects | opensuse.org |
| DELETE | /distributions/{distribution_id} | (none) | Delete a distribution. | x | low | admin deletes a platform wide distribution | opensuse.org |
| DELETE | /issue_trackers/{issue_tracker_name} | (none) | Delete an issue tracker. | x | low | deletes shared issue tracker config | opensuse.org |
| PUT | /attribute/{namespace}/_meta | (none) | Change attribute namespace. Create an attribute namespace if it doesn't exist. | x | low | admin changes namespace platform wide | opensuse.org |
| PUT | /attribute/{namespace}/{attribute_name}/_meta | (none) | Change attribute data. Create an attribute if it doesn't exist. | x | low | admin changes attribute platform wide | opensuse.org |
| PUT | /build/{project_name}/{repository_name}/{architecture_name}/{package_name}/{file_name} | putBuildProjectRepositoryArchitecturePackageFile | Update a specific artifact file contents | x | high | admin overwrites another user's package file | opensuse.org |
| PUT | /configuration | (none) | Update the configuration of this Open Build Service instance | x | low | admin updates whole instance configuration | opensuse.org |
| PUT | /distributions/{distribution_id} | (none) | Update a distribution. | x | low | admin updates a distribution platform wide | opensuse.org |
| PUT | /distributions/bulk_replace | (none) | Bulk replace all distributions. | x | low | admin bulk replaces all distributions | opensuse.org |
| PUT | /issue_trackers/{issue_tracker_name} | (none) | Update or create an issue tracker. | x | low | updates shared issue tracker config | opensuse.org |
| PUT | /peers/{id} | (none) | Update Orthanc peer | x | low | defines network peer to another server | orthanc-server.com |
| DELETE | /nodes/{node_id}/ | nodes_delete | Delete a node | x | low | deletes shared project removing contributors access | osf.io |
| PATCH | /registrations/{registration_id}/ | registrations_partial_update | Update a registration | x | low | irreversibly makes private registration public | osf.io |
| PATCH | /securitymappings/{webId} | SecurityMapping_Update | Update a security mapping by replacing items in its definition. | x | high | updates mapping of identities to access rights | osisoft.com |
| DELETE | /v1/domains/{domain}/records/{type}/{name} | recordDeleteTypeName | Delete all DNS Records for the specified Domain with the specified Type and Name | x | high | deletes DNS records affecting public resolution path | ote-godaddy.com |
| PUT | /v1/domains/{domain}/records | recordReplace | Replace all DNS Records for the specified Domain | x | high | replaces DNS records affecting public resolution path | ote-godaddy.com |
| PUT | /v1/domains/{domain}/records/{type} | recordReplaceType | Replace all DNS Records for the specified Domain with the specified Type | x | high | replaces DNS records affecting public resolution path | ote-godaddy.com |
| PUT | /v1/domains/{domain}/records/{type}/{name} | recordReplaceTypeName | Replace all DNS Records for the specified Domain with the specified Type and Name | x | high | replaces DNS records affecting public resolution path | ote-godaddy.com |
| PUT | /v1/payment-links/{linkId} | updatePaymentLink | Update a payment link. | x | low | updates payment link terms shown to payer | pay1.de |
| DELETE | /v2/companies/{companyId}/employees/{employeeId}/localTaxes/{taxCode} | Delete local tax by tax code | Delete local tax by tax code | x | high | deletes another employee's tax record | paylocity.com |
| PATCH | /v2/companies/{companyId}/employees/{employeeId} | Update employee | Update employee | x | low | updates another employee's payroll data | paylocity.com |
| PUT | /v2/companies/{companyId}/employees/{employeeId}/nonprimaryStateTax | Add or update non-primary state tax | Add/update non-primary state tax | x | high | updates another employee's tax data | paylocity.com |
| PUT | /v2/companies/{companyId}/employees/{employeeId}/primaryStateTax | Add or update primary state tax | Add/update primary state tax | x | high | updates another employee's tax data | paylocity.com |
| DELETE | /Employer/{EmployerId}/Pension/{PensionId}/{EffectiveDate} | DeletePensionRevision | Delete an Pension revision matching the specified revision date. | x | low | deletes a pension revision affecting entitlement calc | payrun.io |
| DELETE | /Employer/{EmployerId}/SubContractor/{SubContractorId} | DeleteSubContractor | Delete an sub contractor | x | low | removes a paid subcontractor from the system | payrun.io |
| PATCH | /Employer/{EmployerId}/Employee/{EmployeeId} | PatchEmployee | Patches the employee | x | low | updates another employee's record | payrun.io |
| PUT | /Employer/{EmployerId}/Employee/{EmployeeId}/Secret/{SecretId} | PutEmployeeSecret | Create a new employee secret | x | high | sets another employee's sensitive secret data | payrun.io |
| DELETE | /workspaces/workspaceId | deleteWorkspace | Delete workspace | x | low | deletes workspace possibly shared with team | pdfgeneratorapi.com |
| DELETE | /domains/{domainid} | deleteDomain | Delete a Domain | x | low | deletes account's sending domain - may be shared | postmarkapp.com |
| DELETE | /servers/{serverid} | deleteServer | Delete a Server | x | low | deletes a server that may be shared by team | postmarkapp.com |
| DELETE | /servers/{server_id}/zones/{zone_id}/cryptokeys/{cryptokey_id} | deleteCryptokey | This method deletes a key specified by cryptokey_id. | x | low | deletes a dnssec key for a public zone | powerdns.local |
| DELETE | /servers/{server_id}/zones/{zone_id}/metadata/{metadata_kind} | deleteMetadata | Delete all items of a single kind of domain metadata. | x | low | deletes metadata affecting a public dns zone | powerdns.local |
| PUT | /servers/{server_id}/cache/flush | cacheFlushByName | Flush a cache-entry by name | x | low | flushes shared resolver cache entry | powerdns.local |
| PUT | /servers/{server_id}/zones/{zone_id}/metadata/{metadata_kind} | modifyMetadata | Replace the content of a single kind of domain metadata. | x | low | replaces metadata for a public dns zone | powerdns.local |
| DELETE | /{id} | story_id_delete | Story: Delete by Id | x | low | deletes a story shared with collaborators | presalytics.io |
| PATCH | /sources/{id}/incremental_refresh | incrementalRefreshSource | Incremental Refresh an existing Source | x | high | triggers async source refresh run | redhat.com |
| DELETE | /projects/{id} | deleteProjectItem | Removes the Project resource. | x | low | deletes project shared with team | redirection.io |
| PUT | /projects/{id} | putProjectItem | Replaces the Project resource. | x | low | updates shared project for team | redirection.io |
| DELETE | /users/{user_id}/rules/{rule_id} | removeAppUserFromRule | (none) | x | high | removes user's rule access | ritc.io |
| DELETE | /suppression/spam_reports | DELETE_suppression-spam_reports | Delete spam reports | x | low | deletes spam reports resumes sending to others | sendgrid.com |
| PUT | /v1/labels/{label_id}/void | void_label | Void a Label By ID | x | low | voids label triggers carrier refund | shipengine.com |
| PUT | /users/{userId}/profile | (none) | Updates user profile of an user | x | low | updates another user's profile | signl4.com |
| PUT | /api/Devices/{id} | Devices_Put | Updates the On/Off Switch on a device.              For new implementations please use the "actions" command | x | high | toggles physical device on or off | smart-me.com |
| DELETE | /org/{orgId}/project/{projectId} | Delete a project | Delete a project | x | low | deletes project shared with org team | snyk.io |
| PUT | /org/{orgId}/project/{projectId}/move | Move project to a different organization | Move project to a different organization | x | low | moves project possibly to another org | snyk.io |
| PUT | /v2/subscriptions/{subscription_id} | UpdateSubscription | UpdateSubscription | x | low | modifies customer subscription billing | squareup.com |
| PUT | /v2/team-members/{team_member_id}/wage-setting | UpdateWageSetting | UpdateWageSetting | x | low | changes another person's wage setting | squareup.com |
| DELETE | /channels/{type}/{id}/image | DeleteImage | Delete image | x | low | removes image from shared channel | stream-io-api.com |
| PATCH | /campaigns/{id}/resume | ResumeCampaign | Resume campaign | x | low | resumes sending campaign to recipients | stream-io-api.com |
| PATCH | /campaigns/{id}/schedule | ScheduleCampaign | Schedule campaign | x | low | schedules campaign send to recipients | stream-io-api.com |
| DELETE | /domains/{owner}/{domain}/{version}/comments/{comment} | deleteDomainCommentV2 | Delete a comment | x | low | deletes possibly another user's comment | swaggerhub.com |
| DELETE | /domains/{owner}/{domain}/{version}/comments/{comment}/replies/{reply} | deleteDomainCommentReplyV2 | Delete a comment reply | x | low | deletes possibly another user's comment reply | swaggerhub.com |
| PUT | /projects/{owner}/{projectId}/members | updateProjectMembersV2 | Update a project's members list | x | low | replaces project members list access | swaggerhub.com |
| DELETE | /ip_connections/{id} | deleteIpConnection | Delete an Ip connection | x | low | deletes network ip connection path | telnyx.com |
| PUT | /actions/network_preferences/sim_cards | BulkSIMCardNetworkPreferences | Bulk Network Preferences for SIM cards | x | low | changes sim network preference physical device | telnyx.com |
| PUT | /server | (none) | Update Server information | x | low | server wide config affects all users | traccar.org |
| DELETE | /users/{id}/lists/{list_id}/like | Remove like on a list | Remove like on a list | x | low | removes like from another user's list | trakt.tv |
| PUT | /posts/{post_id}/promise | promise_post | Promise an offer post | x | low | marks item promised to another named user | trashnothing.com |
| PUT | /stories/{story_id}/like | like_story | Like a story | x | low | likes another user's story | trashnothing.com |
| PUT | /stories/{story_id}/unlike | unlike_story | Unlike a story | x | low | unlikes another user's story | trashnothing.com |
| DELETE | /calendar_event/{id} | deleteCalendarEvent | Delete a calendar event | x | low | deletes patient calendar event | twinehealth.com |
| PATCH | /bundle/{id} | updateBundle | Update a bundle | x | low | updates patient plan bundle | twinehealth.com |
| PATCH | /calendar_event/{id} | updateCalendarEvent | Update a calendar event | x | low | updates patient calendar event with attendees | twinehealth.com |
| PATCH | /patient/{id} | updatePatient | Update a patient | x | low | updates another party's patient record | twinehealth.com |
| PUT | /patient | upsertPatient | Upsert patient | x | low | creates or updates patient record | twinehealth.com |
| DELETE | /2/users/{id}/followed_lists/{list_id} | listUserUnfollow | Unfollow a List | x | low | unfollows another party's list | twitter.com |
| DELETE | /maps/{id} | (none) | Delete map | x | low | deletes map removing collaborator access | uebermaps.com |
| DELETE | /v3/payees/{payeeId} | deletePayeeByIdV3 | Delete Payee by Id | x | low | deletes payee another party's payment record | velopayments.com |
| DELETE | /v4/payees/{payeeId} | deletePayeeByIdV4 | Delete Payee by Id | x | low | deletes payee another party's payment record | velopayments.com |
| DELETE | /api-public/v1/overrides/{publicId} | (none) | Deletes a scheduled override | x | low | deletes team on-call override | victorops.com |
| DELETE | /api-public/v1/user/{user}/contact-methods/phones/{contactId} | (none) | Delete a contact phone for a user | x | low | deletes another user's contact phone | victorops.com |
| PATCH | /api-public/v1/incidents/ack | (none) | Acknowledge an incident or list of incidents | x | low | acknowledges shared team incident | victorops.com |
| PATCH | /api-public/v1/incidents/resolve | (none) | Resolve an incident or list of incidents | x | low | resolves shared team incident | victorops.com |
| PUT | /api-public/v1/profile/{username}/policies/{step}/{rule} | (none) | Update a rule for a paging policy step | x | low | paging rule can retarget escalation to others | victorops.com |
| DELETE | /videos/{video_id}/comments/{comment_id} | delete_comment | Delete a video comment | x | low | may delete another user's comment | vimeo.com |
| DELETE | /api/v1/GenevaActions/VnetPoolDefinitions | (none) | (none) | x | low | ops tooling deletes shared vnet pool config | visualstudio.com |
| DELETE | /api/comments/{entryType}-comments/{commentId} | (none) | (none) | x | low | may delete another user's comment | vocadb.net |
| DELETE | /api/releaseEvents/{id} | (none) | (none) | x | low | removes shared catalog event entry | vocadb.net |
| DELETE | /api/releaseEventSeries/{id} | (none) | (none) | x | low | removes shared catalog series entry | vocadb.net |
| DELETE | /api/users/profileComments/{commentId} | (none) | (none) | x | low | may delete another user's comment | vocadb.net |
| DELETE | /api/dataentities/Address/documents/{id} | DeleteCustomerAddress | Delete customer address | x | low | deletes a customer's saved address | vtex.local |
| DELETE | /review/{reviewId} | DeleteReview | Delete Review | x | low | may delete another customer's review | vtex.local |
| PATCH | /api/storage/profile-system/profiles/{profileId}/addresses/{addressId} | UpdateClientAddress | Update client address | x | low | updates a customer's address | vtex.local |
| PUT | /subscriptions | Updaterecurrence | Update Subscription | x | low | updates a customer subscription | vtex.local |
| PATCH | /walletobjects/v1/eventTicketObject/{resourceId} | walletobjects.eventticketobject.patch | (none) | x | low | updates a specific ticket holder's pass | walletobjects.googleapis.com |
| PATCH | /walletobjects/v1/flightObject/{resourceId} | walletobjects.flightobject.patch | (none) | x | low | updates a specific passenger's pass | walletobjects.googleapis.com |
| PATCH | /walletobjects/v1/loyaltyObject/{resourceId} | walletobjects.loyaltyobject.patch | (none) | x | low | updates a specific cardholder's pass | walletobjects.googleapis.com |
| PATCH | /walletobjects/v1/offerObject/{resourceId} | walletobjects.offerobject.patch | (none) | x | low | updates a specific holder's offer pass | walletobjects.googleapis.com |
| PATCH | /walletobjects/v1/transitObject/{resourceId} | walletobjects.transitobject.patch | (none) | x | low | updates a specific holder's transit pass | walletobjects.googleapis.com |
| PUT | /walletobjects/v1/flightObject/{resourceId} | walletobjects.flightobject.update | (none) | x | low | updates a specific passenger's pass | walletobjects.googleapis.com |
| PUT | /walletobjects/v1/genericObject/{resourceId} | walletobjects.genericobject.update | (none) | x | low | updates a specific holder's pass | walletobjects.googleapis.com |
| PUT | /walletobjects/v1/giftCardObject/{resourceId} | walletobjects.giftcardobject.update | (none) | x | low | updates a specific holder's giftcard pass | walletobjects.googleapis.com |
| PUT | /walletobjects/v1/loyaltyObject/{resourceId} | walletobjects.loyaltyobject.update | (none) | x | low | updates a specific holder's loyalty pass | walletobjects.googleapis.com |
| PUT | /walletobjects/v1/offerObject/{resourceId} | walletobjects.offerobject.update | (none) | x | low | updates a specific holder's offer pass | walletobjects.googleapis.com |
| PUT | /walletobjects/v1/transitObject/{resourceId} | walletobjects.transitobject.update | (none) | x | low | updates a specific holder's transit pass | walletobjects.googleapis.com |
| PUT | /{betId}/cashin | cashin | Allows a trusted application to cash in a bet (take a return on a bet) on behalf of the customer | x | high | cashes in a bet on behalf of customer | whapi.com |
| DELETE | /{tenantID}/applications/{applicationObjectId} | Applications_Delete | (none) | x | low | deletes an application others may rely on | windows.net |
| DELETE | /{tenantID}/groups/{objectId} | Groups_Delete | (none) | x | high | deletes a directory group affecting members | windows.net |
| DELETE | /{tenantID}/servicePrincipals/{objectId} | ServicePrincipals_Delete | (none) | x | low | deletes service principal others may rely on | windows.net |
| DELETE | /{tenantID}/users/{upnOrObjectId} | Users_Delete | (none) | x | high | deletes a user from directory | windows.net |
| PATCH | /{tenantID}/applications/{applicationObjectId} | Applications_Patch | (none) | x | low | patches shared application object | windows.net |
| PATCH | /{tenantID}/applications/{applicationObjectId}/keyCredentials | Applications_UpdateKeyCredentials | (none) | x | low | updates app key credentials others may use | windows.net |
| PATCH | /{tenantID}/applications/{applicationObjectId}/passwordCredentials | Applications_UpdatePasswordCredentials | (none) | x | low | updates app password credentials others may use | windows.net |
| PATCH | /{tenantID}/servicePrincipals/{objectId}/keyCredentials | ServicePrincipals_UpdateKeyCredentials | (none) | x | low | updates service principal key credentials | windows.net |
| PATCH | /{tenantID}/servicePrincipals/{objectId}/passwordCredentials | ServicePrincipals_UpdatePasswordCredentials | (none) | x | low | updates service principal password credentials | windows.net |
| PUT | /transcoders/{id}/enable_all_stream_targets | enableAllStreamTargetsTranscoder | Enable a transcoder's stream targets | x | low | enables pushing content to stream targets | wowza.com |
| PUT | /transcoders/{id}/stop | stopTranscoder | Stop a transcoder | x | high | stops transcoder halting live feed to viewers | wowza.com |
| DELETE | /projects/{projectId} | delete_12 | Removes a project. | x | low | deletes project shared with client and vendor | xtrf.eu |
| PUT | /projects/{projectId}/finance/payables/{payableId} | updatePayable | Updates a payable. | x | low | updates payable affecting vendor payment | xtrf.eu |
| PUT | /v2/jobs/{jobId}/vendor | assignVendor_1 | Assigns vendor to a job in a project. | x | high | assigns vendor to job affecting vendor | xtrf.eu |
| PUT | /v2/quotes/{quoteId}/expectedDeliveryDate | updateExpectedDeliveryDate | Updates Expected Delivery Date for a quote. | x | low | updates client facing delivery date | xtrf.eu |
| DELETE | /accounts/{accountId}/sip_trunk/internal_numbers/{numberId} | deleteInternalNumber | Delete an internal number | x | low | deletes internal number may disconnect a user | zoom.us |
| DELETE | /phone/sites/{siteId} | deletePhoneSite | Delete a phone site | x | low | deletes site reassigning many users assets | zoom.us |
| PATCH | /accounts/{accountId}/options | accountOptionsUpdate | Update options | x | low | updates another sub account's options | zoom.us |
| PATCH | /accounts/{accountId}/settings | accountSettingsUpdate | Update settings | x | low | updates another sub account's settings | zoom.us |
| PATCH | /groups/{groupId}/lock_settings | groupLockedSettings | Update locked settings | x | low | locks settings restricting other members | zoom.us |
| PUT | /accounts/{accountId}/plans/base | accountPlanBaseUpdate | Update a base plan | x | low | updates billing plan of another sub account | zoom.us |
| PUT | /v1/entities/{id} | PUT_Entities | Multi-entity: Update an entity | x | low | updates settings of another business entity | zuora.com |

## Goal 1's own ledger (config 3: c15 + C22)

Goal-1 false alarms left from the word rules after C22 (rule=live-verb or party-noun, truth w): 324 of 4000 (8.1%).
Rescued vs config 1 (c15 alone): 58.
Leaks C22 adds vs config 1, charged to goal 1: 11.

Corpus LOVO prediction for comparison (D51, not recomputed here): baseline 522 word-rule false alarms, 61 rescued, 6 new leaks, on 5465 rows.

Every leak C22 adds under config 3 vs config 1, in full (11 rows):

| method | path | operationId | summary | truth | confidence | reason | provider |
| --- | --- | --- | --- | --- | --- | --- | --- |
| PUT | /api/v2/Users/{id}/Roles | UserPermissions_Put | Update a user's roles | x | high | updates another users roles | agco-ats.com |
| DELETE | /rest/api/3/permissionscheme/{schemeId} | deletePermissionScheme | Delete permission scheme | x | low | deletes a permission scheme controlling access | atlassian.com |
| PUT | /rest/api/3/project/{projectKeyOrId}/permissionscheme | assignPermissionScheme | Assign permission scheme | x | high | assigns permission scheme changing project access | atlassian.com |
| PUT | /spaces/{topicId}/pin | pinTopic | Pin a topic | x | low | pins topic visible to space members | circuitsandbox.net |
| PUT | /bookings/{bookingId}/booking-contact | updateBookingContact | Change a booking contact | x | high | changes booking contact shared with hotel | impala.travel |
| PUT | /api/2/permissionscheme/{schemeId} | updatePermissionScheme | (none) | x | high | updates permission scheme affecting many users | jira.local |
| PUT | /person/{login} | (none) | Update person | x | high | admin updates another person's profile | opensuse.org |
| PUT | /v2/companies/{companyId}/employees/{employeeId}/emergencyContacts | Add or update emergency contacts | Add/update emergency contacts | x | low | updates another employee's emergency contacts | paylocity.com |
| PATCH | /whatsapp_messages/{message_id} | markMessageAsRead | Mark Message As Read | x | low | read receipt visible to message sender | telnyx.com |
| PUT | /messages/{MessageID} | MarkMessageAsRead | Mark-Message-As-Read | x | high | mark read sends read receipt to sender | whatsapp.local |
| PUT | /projects/{projectId}/contacts | updateContacts | Updates contacts of a given project. | x | low | updates project contacts changes collaborators | xtrf.eu |

Every row C22 rescued under config 3 vs config 1, in full (58 rows):

| method | path | operationId | summary | truth | confidence | reason | provider |
| --- | --- | --- | --- | --- | --- | --- | --- |
| DELETE | /contacts/{contact_id}/contact_persons/{contact_person_id} | (none) | Delete a contact person | w | high | delete own contact person | apacta.com |
| DELETE | /webhooks/{webhookId} | DELETE-webhook | Delete a Webhook | w | high | delete own webhook | api.video |
| PUT | /v2/user/channelCatalogs/{channelCatalogId}/exclusionFilters | ConfigureChannelCatalogExclusionFilters | Configure channel catalog exclusion filters | w | high | configures own channel catalog filters | beezup.com |
| PUT | /v2/user/channelCatalogs/{channelCatalogId}/products/{productId}/overrides | OverrideChannelCatalogProductValues | Override channel catalog product values | w | high | overrides own catalog product values | beezup.com |
| DELETE | /webhooks | (none) | Deletes all webhooks | w | high | deletes own webhooks | biapi.pro |
| DELETE | /webhooks/{id_webhook} | (none) | Deletes a webhook | w | high | deletes own webhook | biapi.pro |
| PUT | /webhooks/{id_webhook} | (none) | Updates a webhook | w | high | updates own webhook | biapi.pro |
| DELETE | /webhooks/{id} | (none) | Delete a webhook | w | high | deletes own webhook | bulksms.com |
| DELETE | /contacts/{id} | deleteContact | Delete a contact | w | high | deletes own contact | callfire.com |
| DELETE | /contacts/dncs/{number} | deleteDoNotContact | Delete do not contact (dnc) number. If number contains commas treat as list of numbers | w | high | removes own do-not-contact number | callfire.com |
| DELETE | /contacts/dncs/sources/{source} | deleteDoNotContactsBySource | Delete do not contact (dnc) numbers contained in source. | w | high | removes own do-not-contact numbers by source | callfire.com |
| DELETE | /contacts/lists/{id}/items | removeContactListItems | Delete contacts from a contact list | w | high | removes contacts from own list | callfire.com |
| DELETE | /webhooks/{id} | deleteWebhook | Delete a webhook | w | high | deletes own webhook | callfire.com |
| PUT | /contacts/{id} | updateContact | Update a contact | w | high | updates own contact | callfire.com |
| PUT | /contacts/dncs/{number} | updateDoNotContact | Update an individual do not contact (dnc) number | w | high | updates own do-not-contact entry | callfire.com |
| PUT | /webhooks/{id} | updateWebhook | Update a webhook | w | high | updates own webhook | callfire.com |
| DELETE | /setup/webhook/{id} | (none) | Delete a webhook | w | high | deletes own webhook | cenit.io |
| DELETE | /webhooks | removeWebHooks | Removes all webHooks | w | high | unregisters own webhooks | circuitsandbox.net |
| DELETE | /webhooks/{id} | removeWebHook | Removes a registered webHook | w | high | unregisters own webhook | circuitsandbox.net |
| DELETE | /admin/v/4/webhook/{systemKey}/{name} | DeleteWebhook | WEBHOOKS - Delete a webhook | w | high | deletes own webhook | clearblade.com |
| DELETE | /api/v/1/message/{systemKey} | DeleteMessageHistory | MESSAGING - Delete history | w | high | deletes own message history topic | clearblade.com |
| DELETE | /lists/{list_id}/contacts/{contact_id} | Delete a specific contact | Delete a specific contact | w | high | deletes own contact | clicksend.com |
| PUT | /lists/{list_id}/contacts/{contact_id} | Update a specific contact | Update a specific contact | w | high | updates own contact | clicksend.com |
| PUT | /lists/{list_id}/remove-duplicates | Remove Duplicate Contacts | Remove Duplicate Contacts | w | high | dedupes own contact list | clicksend.com |
| PUT | /lists/{list_id}/remove-opted-out-contacts/{opt_out_list_id} | Remove Opted Out Contacts | Remove Opted Out Contacts | w | high | removes opted-out contacts from own list | clicksend.com |
| PUT | /api/registrations/{id}/contact-details | UpdateContactDetails | Updates a registration's contact details. | w | low | edits own registration record about client | credas.co.uk |
| PUT | /v4/provisioning/webhooks/{webhook_id} | updateTenantWebhook | Update tenant webhook | w | high | updates own tenant webhook | dracoon.team |
| DELETE | /characters/{character_id}/contacts/ | delete_characters_character_id_contacts | Delete contacts | w | high | deletes own character's contacts | evetech.net |
| PUT | /characters/{character_id}/contacts/ | put_characters_character_id_contacts | Edit contacts | w | high | edits own character contacts | evetech.net |
| DELETE | /webhooks/{id} | deleteWebhook | Delete a webhook | w | high | deletes own webhook | exavault.com |
| PATCH | /webhooks/{id} | updateWebhook | Update a webhook | w | high | updates own webhook | exavault.com |
| PUT | /{realm}/clients/{id}/roles/{role-name}/management/permissions | (none) | Return object stating whether role Authoirzation permissions have been initialized or not and a reference | w | low | initializes role authorization permissions | keycloak.local |
| PUT | /{realm}/roles-by-id/{role-id}/management/permissions | (none) | Return object stating whether role Authoirzation permissions have been initialized or not and a reference | w | low | initializes role authorization permissions | keycloak.local |
| DELETE | /webhooks/{resourceId} | deleteWebhook | Delete a webhook by ID. | w | high | deletes own account's webhook | launchdarkly.com |
| DELETE | /projects/{id}/webhooks | deleteProjectWebhook | Delete project webhooks | w | high | deletes own project webhook | motaword.com |
| DELETE | /{workspace_slug}/webhooks/{id} | (none) | Delete a webhook | w | high | delete own webhook | orbit.love |
| PUT | /{workspace_slug}/webhooks/{id} | (none) | Update a webhook | w | high | update own webhook | orbit.love |
| DELETE | /targets/{target_id}/webhooks/{id}/ | (none) | Delete target webhook | w | high | deletes own webhook | probely.com |
| DELETE | /webhooks/{id}/ | (none) | Delete account webhook | w | high | deletes own account webhook | probely.com |
| PUT | /targets/{target_id}/webhooks/{id}/ | (none) | Update target webhook | w | high | updates own webhook | probely.com |
| PUT | /webhooks/{id}/ | (none) | Update account webhook | w | high | updates own webhook | probely.com |
| DELETE | /webhooks/registrations/{id} | (none) | Remove a webhook | w | high | remove own webhook | reverb.com |
| DELETE | /v2/people/{id}.json | (none) | Delete a person | w | high | delete own person record | salesloft.com |
| PUT | /v2/people/{id}.json | (none) | Update a person | w | high | update own person record | salesloft.com |
| DELETE | /v1/environment/webhooks/{webhook_id} | delete_webhook | Delete Webhook By ID | w | high | delete own webhook | shipengine.com |
| DELETE | /webhooks/{webhookId} | (none) | Delete Webhook by Id | w | high | delete own webhook | signl4.com |
| PUT | /webhooks/{webhookId} | (none) | Update Webhook by Id | w | high | update own webhook | signl4.com |
| DELETE | /org/{orgId}/webhooks/{webhookId} | Delete a webhook | Delete a webhook | w | high | delete own webhook | snyk.io |
| DELETE | /channeltypes/{name} | DeleteChannelType | Delete channel type | w | high | delete own channel type schema | stream-io-api.com |
| DELETE | /tokens/{token}/webhooks/{idWebhook} | deleteTokensWebhooksByTokenByIdWebhook | deleteTokensWebhooksByTokenByIdWebhook() | w | high | delete own webhook under own token | trello.com |
| DELETE | /user/follows/people/{person_id} | (none) | Unfollow a person | w | high | unfollow own followed person entry | tvmaze.com |
| PUT | /user/follows/people/{person_id} | (none) | Follow a person | w | high | follow person own list | tvmaze.com |
| DELETE | /webhooks/{id} | (none) | Delete webhook | w | high | delete own webhook | up.com.au |
| DELETE | /self/webhooks/{id} | destroyWebhook | Remove a web hook | w | high | deletes own webhook | vonage.com |
| PUT | /self/webhooks/{id}/renew | renewWebhook | Renews a web hook | w | high | renews own webhook | vonage.com |
| DELETE | /ContactGroups/{ContactGroupID}/Contacts | deleteContactGroupContacts | Deletes all contacts from a specific contact group | w | high | deletes contacts from own contact group | xero.com |
| PUT | /Contacts | createContacts | Creates multiple contacts (bulk) in a Xero organisation | w | high | creates contacts in own org records | xero.com |
| DELETE | /v1/integrations/webhooks/:id | deleteWebhooks | Remove a webhook by id | w | high | deletes own webhook integration | zeit.co |

## combined (config 4: c15 + C20 + C22) — labelled combined, not either goal's own number

combined goal-2 leaks: 376 (9.4%). combined goal-1 false-alarm total: 1052 (26.3%). combined all-loosening: 376 (9.4%). combined exact: 2548.

## Note on this run

Exam 4 providers are, by construction, absent from the combined corpus
these allowlists were built on (make-exam4.mjs's own exclusion rule) —
this is a genuine held-out score, not in-sample.

