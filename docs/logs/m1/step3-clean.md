# Step 3 — clean rebuild score

rows 5465, vendors 332, leave-one-vendor-out.

## Summary

| pass | step-3 leaks | step-2 false alarms (info) | all-loosening |
|---|---|---|---|
| GATE — frozen baseline (classifyC20 + c15) | 89 | 1936 | 106 |
| NEW — classifyStep3 (this module) | 37 | 2645 | 54 |
| NEW, verbs only — classifyByVerb (no noun layer) | 524 | 185 | 541 |

GATE reproduced 89 exactly: yes. NEW matched 37 leaks / 2645 step-2 false alarms: yes.

## NEW step-3 leaks by rule

| rule | count |
|---|---|
| floor | 37 |

## Regressions — leak under NEW, not under GATE (13)

| vendor | method | operationId | truth | predicted | rule |
|---|---|---|---|---|---|
| camara | DELETE | deleteAccess | x | w | floor |
| camara | DELETE | deleteNetwork | x | w | floor |
| camara | PATCH | updateDevice | x | w | floor |
| camara | DELETE | deleteDevice | x | w | floor |
| stripe | DELETE | DeleteCustomersCustomer | x | w | floor |
| discord | DELETE | delete_channel | x | w | floor |
| tyk.com | DELETE |  | x | w | floor |
| gerermesaffaires.com | DELETE |  | x | w | floor |
| impala.travel | PUT | updateBookingContact | x | w | floor |
| jira.local | PUT | put | x | w | floor |
| n-auth.com | DELETE | deleteAccount | x | w | floor |
| n-auth.com | PUT | updateAccount | x | w | floor |
| victorops.com | PUT |  | x | w | floor |

## Rescues — leak under GATE, not under NEW (65)

| vendor | method | operationId | truth | predicted | rule |
|---|---|---|---|---|---|
| github | PUT | issues/set-issue-field-values | x | w | floor |
| discord | PATCH | update_stage_instance | x | w | floor |
| cloudflare | PATCH | ssl-verification-edit-ssl-certificate-pack-validation-method | x | w | floor |
| apicurio.local | PUT | updateRoleMapping | x | w | floor |
| appcenter.ms | DELETE | appInvitations_delete | x | w | floor |
| apple.com | DELETE | apps-betaTesters-delete_to_many_relationship | x | w | floor |
| apple.com | DELETE | betaTesters-betaGroups-delete_to_many_relationship | x | w | floor |
| apple.com | PATCH | users-update_instance | x | w | floor |
| clearblade.com | PUT | AddEdgeCommand | x | w | floor |
| codat.io | PUT | update-bill-credit-note | x | w | floor |
| figshare.com | DELETE | private_project_delete | x | w | floor |
| gsmtasks.com | DELETE | accounts_managers_destroy | x | w | floor |
| id4i.de | PUT | completeRegistration | x | w | floor |
| ix-api.net | DELETE | role_assignments_destroy | x | w | floor |
| just-eat.co.uk | PUT |  | x | w | floor |
| n-auth.com | PUT | updateUserAttributes | x | w | floor |
| onsched.com | PUT |  | x | w | floor |
| rumble.run | PATCH | rotateAccountKey | x | w | floor |
| rumble.run | PATCH | rotateKey | x | w | floor |
| rumble.run | PUT | updateAccountGroupMapping | x | w | floor |
| swaggerhub.com | PUT | setTemplatePrivateSettings | x | w | floor |
| victorops.com | PATCH |  | x | w | floor |
| whapi.com | PUT | cashin | x | w | floor |
| zuora.com | PUT | PUT_WriteOffInvoice | x | w | floor |
| 6-dot-authentiqio.appspot.com | PUT | sign_update | x | w | floor |
| anchore.io | PUT | update_account_state | x | w | floor |
| appcenter.ms | DELETE | storeReleases_delete | x | w | floor |
| appcenter.ms | PATCH | orgInvitations_update | x | w | floor |
| apple.com | DELETE | betaTesters-delete_instance | x | w | floor |
| apple.com | DELETE | users-delete_instance | x | w | floor |
| autodealerdata.com | PUT | revokeSubUserKey_revokeSubUserKey_put | x | w | floor |
| azure.com | PUT | NotificationRecipientEmail_CreateOrUpdate | x | w | floor |
| billbee.io | PUT | OrderApi_UpdateState | x | w | floor |
| bluemix.net | PUT |  | x | w | floor |
| climatekuul.com | PATCH | confirmPaymentOfTransaction | x | w | floor |
| conjur.local | PATCH | enableAuthenticatorInstance | x | w | floor |
| conjur.local | PUT | rotateApiKey | x | w | floor |
| dev.to | PUT | unpublishArticle | x | w | floor |
| gerermesaffaires.com | PATCH |  | x | w | floor |
| getgo.com | PUT | updateTrainingTimes | x | w | floor |
| gitlab.com | DELETE | deleteV3UsersIdKeysKeyId | x | w | floor |
| gsmtasks.com | PUT | account_roles_update | x | w | floor |
| gsmtasks.com | PUT | accounts_stripe_create_setup_intent_update | x | w | floor |
| ijenko.net | PUT | Functionality.set | x | w | floor |
| ix-api.net | PATCH | member_joining_rules_partial_update | x | w | floor |
| ix-api.net | PUT | member_joining_rules_update | x | w | floor |
| keycloak.local | PUT |  | x | w | floor |
| lufthansa.com | PUT | Auto Check-In | x | w | floor |
| lyft.com | PUT | SetRideDestination | x | w | floor |
| motaword.com | DELETE | deleteContinuousProject | x | w | floor |
| okta.local | PUT | setRecoveryCredential | x | w | floor |
| openchannel.io | PATCH |  | x | w | floor |
| shipengine.com | PUT | void_label | x | w | floor |
| snyk.io | PUT | Move project to a different organization | x | w | floor |
| swaggerhub.com | PUT | updateProjectMembersV2 | x | w | floor |
| trello.com | PUT | updateBoardsMembersByIdBoard | x | w | floor |
| victorops.com | PATCH |  | x | w | floor |
| windows.net | DELETE | Groups_Delete | x | w | floor |
| windows.net | DELETE | Users_Delete | x | w | floor |
| windows.net | PATCH | Users_Update | x | w | floor |
| wowza.com | PUT | restartTranscoderOutputOutputStreamTarget | x | w | floor |
| zoom.us | PATCH | groupLockedSettings | x | w | floor |
| zoom.us | PUT | changeCallQueueManager | x | w | floor |
| zuora.com | PUT | PUT_ProvisionEntity | x | w | floor |
| zuora.com | PUT | PUT_VerifyPaymentMethods | x | w | floor |
