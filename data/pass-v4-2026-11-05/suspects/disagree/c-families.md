# c-rows families

| family | G01 | G04 | G06 | total |
|---|---|---|---|---|
| upload | 1 | 120 | 0 | 121 |
| credential | 41 | 120 | 6 | 167 |
| access | 431 | 13 | 23 | 467 |
| membership | 40 | 12 | 0 | 52 |
| outside | 48 | 29 | 235 | 312 |
| session | 0 | 14 | 0 | 14 |
| container | 189 | 48 | 26 | 263 |
| rest | 154 | 162 | 85 | 401 |
| total | 904 | 518 | 375 | 1797 |

## upload/G01 (1 rows)

Top matched words:

- upload: 1

Rows (1 of 1):

- s10679 | dracoon.team | PUT | updateUploadShare | Update Upload Share | w (high): edit upload share

## upload/G04 (120 rows)

Top matched words:

- upload: 120

Rows (12 of 120):

- s02110 | microsoft.com | POST | me.calendars.calendar.events.event.attachments.createUploadSession | Invoke action createUploadSession | w (high): creates upload session
- s04161 | microsoft.com | POST | users.user.calendarGroups.calendarGroup.calendars.calendar.events.event.instances.event.attachments.createUploadSession | Invoke action createUploadSession | w (high): ii upload session
- s09915 | microsoft.com | POST | me.outlook.taskFolders.outlookTaskFolder.tasks.outlookTask.attachments.createUploadSession | Invoke action createUploadSession | w (high): ii creates upload session
- s01777 | microsoft.com | POST | me.calendarGroups.calendarGroup.calendars.calendar.calendarView.event.exceptionOccurrences.event.instances.event.attachments.createUploadSession | Invoke action createUploadSession | w (high): ii upload session
- s03048 | dracoon.team | POST | createFileUploadChannel | Create new file upload channel | w (high): ii plain create of upload channel
- s07721 | microsoft.com | POST | me.calendars.calendar.calendarView.event.exceptionOccurrences.event.instances.event.attachments.createUploadSession | Invoke action createUploadSession | w (high): ii creates upload session
- s06699 | microsoft.com | POST | me.calendarGroups.calendarGroup.calendars.calendar.events.event.instances.event.exceptionOccurrences.event.attachments.createUploadSession | Invoke action createUploadSession | w (high): ii creates upload session
- s02823 | box | POST | post_files_id_upload_sessions | Create upload session for existing file | w (high): ii upload session create
- s04555 | microsoft.com | POST | users.user.calendars.calendar.calendarView.event.attachments.createUploadSession | Invoke action createUploadSession | w (high): ii creates upload session
- s08459 | lgtm.com | POST | initSnapshotUpload | Start snapshot upload session | w (high): ii starts upload session
- s03827 | microsoft.com | POST | users.user.calendar.events.event.instances.event.attachments.createUploadSession | Invoke action createUploadSession | w (high): ii creates upload session
- s09440 | microsoft.com | POST | me.events.event.instances.event.attachments.createUploadSession | Invoke action createUploadSession | w (high): ii creates upload session

## credential/G01 (41 rows)

Top matched words:

- key: 19
- token: 13
- certificate: 4
- secret: 3
- credential: 2

Rows (12 of 41):

- s07006 | googleapis.com | PUT | directory.groups.update |  | w (high): edit group properties
- s06723 | fecru.local | PUT | addDefaultReviewerGroup |  | w (high): adds reviewer group
- s00707 | adafruit.com | POST | addFeedToGroup | Add an existing Feed to a Group | w (high): adds feed to group
- s10764 | cloudflare | PATCH | token-validation-rules-bulk-edit | Edit token validation rules | w (high): edit rules
- s14710 | turbinelabs.io | PUT |  | modify shared_rules object | w (high): iii modifies rules object
- s08019 | okta | POST | createOAuth2Scope | Create a custom token scope | w (high): ii creates scope
- s05575 | cloudflare | POST | token-validation-rules-bulk-create | Create token validation rules | w (high): ii plain create
- s09456 | getgo.com | PUT | updateRegistrationSettingsForTraining | Update Training Registration Settings | w (high): edit settings
- s02443 | cloudflare | PATCH | token-validation-rules-edit | Edit a token validation rule | w (high): PATCH edit rule
- s07851 | cloudflare | PATCH | client-certificate-for-a-zone-edit-client-certificate | Reactivate Client Certificate | w (high): toggle reactivate
- s14090 | twilio | POST | UpdateSipCredentialList | Update a Credential List | w (high): edit credential list
- s11756 | mastercard.com | POST |  |  | w (high): toggle unsuspend has suspend

## credential/G04 (120 rows)

Top matched words:

- key: 46
- secret: 33
- credential: 20
- token: 12
- certificate: 5
- csr: 2
- password: 2

Rows (12 of 120):

- s01965 | azure.com | PUT | StorageAccountCredentials_CreateOrUpdate |  | w (high): iii create or update
- s03338 | cloudflare | POST | account-billing-create-setup-intent | Create Setup Intent | w (high): ii creates setup intent
- s09812 | files.com | PATCH | ApiKeyUpdateCurrent | Update current API key. (Requires current API connection to be using an API key. | w (high): PATCH edit api key details
- s01642 | googleapis.com | POST | secretmanager.projects.secrets.create |  | w (high): ii creates empty secret
- s03011 | googleapis.com | POST | recaptchaenterprise.projects.keys.create |  | w (high): ii plain create of key
- s06938 | stripe | POST | PostAppsSecrets | Set a Secret | w (high): create or replace secret
- s05195 | unicourt.com | PUT | addPacerCredential | Add Pacer Credential. | w (high): ii register credentials
- s02888 | 6-dot-authentiqio.appspot.com | POST | key_register |  | w (high): ii registers key
- s03906 | twilio.com | POST | UpdateCredentialAws |  | w (high): edit credential
- s08336 | cloudflare | POST | custom-csrs-for-an-account-create-custom-csr | Create Custom CSR | w (high): ii generates CSR
- s03260 | azure.com | PUT | JobCredentials_CreateOrUpdate |  | w (high): edit credential details
- s08954 | mist.com | POST | setupOrgZscalerCredential | setupOrgZscalerCredential | w (high): set credential

## credential/G06 (6 rows)

Top matched words:

- key: 3
- token: 2
- certificate: 1

Rows (6 of 6):

- s02521 | zulip.com | POST | add-fcm-token | Add an FCM registration token | w (high): registers token
- s04835 | zulip.com | POST | add-apns-token | Add an APNs device token | w (high): register device token
- s07873 | configcat.com | POST | jira-add-or-update-integration-link |  | w (high): edit link
- s08881 | configcat.com | POST | add-or-update-integration-link | Add or update Integration link | w (high): edit link
- s10595 | biapi.pro | POST |  | Change configuration of a user. modifications on keys prefixed by 'biapi.' (exce | w (high): edit config
- s11474 | amazonaws.com | POST | PutAccountConfiguration |  | w (high): iii sets account config

## access/G01 (431 rows)

Top matched words:

- role: 182
- access: 65
- policy: 47
- identity: 23
- scope: 18
- permission: 16
- authorization: 12
- policie: 12
- oauth: 8
- acl: 6

Rows (12 of 431):

- s03790 | okta | PUT | replaceRole | Replace a custom role | w (high): replace label
- s13821 | microsoft.com | PATCH | governanceRoleSettings.governanceRoleSetting.UpdateGovernanceRoleSetting | Update entity in governanceRoleSettings | w (high): PATCH edit settings
- s03628 | microsoft.com | PATCH | identityGovernance.entitlementManagement.accessPackageAssignments.accessPackageAssignmentResourceRoles.accessPackageResourceScope.accessPackageResource.accessPackageResourceRoles.UpdateAccessPackageResource | Update the navigation property accessPackageResource in identityGovernance | w (high): edit resource
- s02743 | keycloak | POST |  | Create a new role for the realm or client | w (high): ii plain create
- s08365 | azure.com | PUT | Model_UpdatePatternAnyEntityRole | Update a role for a given Pattern.any entity in a version of the application. | w (high): edits role
- s07731 | microsoft.com | PATCH | identityGovernance.entitlementManagement.accessPackageAssignments.accessPackage.accessPackageResourceRoleScopes.UpdateAccessPackageResourceRole | Update the navigation property accessPackageResourceRole in identityGovernance | w (high): edits role
- s08757 | microsoft.com | PATCH | identityGovernance.entitlementManagement.catalogs.accessPackages.UpdateAssignmentPolicies | Update the navigation property assignmentPolicies in identityGovernance | w (high): iii edits existing item
- s08745 | microsoft.com | PATCH | identityGovernance.entitlementManagement.accessPackageAssignmentResourceRoles.accessPackageResourceScope.accessPackageResource.accessPackageResourceRoles.accessPackageResource.UpdateAccessPackageResourceScopes | Update the navigation property accessPackageResourceScopes in identityGovernance | w (high): iii edits existing item
- s00100 | callcontrol.com | POST | EnterpriseApi_UpsertUser | UpsertUser: insert or update all properties from a user PhoneNumber WhiteList (l | w (high): upsert user lists
- s04125 | microsoft.com | PATCH | identityGovernance.entitlementManagement.accessPackageAssignments.accessPackage.accessPackageResourceRoleScopes.accessPackageResourceScope.accessPackageResource.accessPackageResourceRoles.accessPackageResource.UpdateAccessPackageResourceScopes | Update the navigation property accessPackageResourceScopes in identityGovernance | w (high): PATCH edit
- s03795 | clerk.com | POST | CreateOrganizationRole | Create an organization role | w (high): ii plain create
- s03980 | microsoft.com | POST | directory.customSecurityAttributeDefinitions.CreateAllowedValues | Create allowedValue | w (high): ii plain create

## access/G04 (13 rows)

Top matched words:

- auth: 3
- identity: 3
- oauth: 2
- authenticator: 1
- authorization: 1
- claim: 1
- policy: 1
- trust: 1

Rows (12 of 13):

- s00087 | googleapis.com | POST | integrations.projects.locations.products.authConfigs.create |  | w (high): ii creates auth config
- s03646 | cloudflare | POST | zero-trust-accounts-create-zero-trust-account | Create Zero Trust account | w (high): ii plain create
- s05031 | mailscript.com | POST | addWorkspace | Claim a Mailscript workspace | w (high): ii plain create
- s10464 | pagerduty | POST | createOauthClient | Create an OAuth client | w (high): ii plain create
- s03400 | orbit.love | POST |  | Add identity to a member | w (high): ii adds identity
- s11841 | okta | PUT | replaceExistingIdentitySourceUser | Replace an existing identity source user | w (high): iii replace user details
- s07597 | amazonaws.com | POST | UpdateBackendAuth |  | w (high): edit auth resource
- s11434 | microsoft.com | POST | groupLifecyclePolicies.groupLifecyclePolicy.addGroup | Invoke action addGroup | w (high): iii adds group to policy
- s03347 | plaid.com | POST | sandboxOauthSelectAccounts | Save the selected accounts when connecting to the Platypus Oauth institution | w (high): edit selection
- s07942 | agco-ats.com | PUT | AuthorizationCodes_PutAuthorizationCode | Update an authorization code. | w (high): edit code
- s08585 | azure.com | PUT | UserAssignedIdentities_CreateOrUpdate |  | w (high): create or update identity
- s03846 | okta | POST | createAuthenticator | Create an authenticator | w (high): ii plain create

## access/G06 (23 rows)

Top matched words:

- identity: 7
- policy: 6
- auth: 4
- conditional: 2
- access: 1
- oauth: 1
- scope: 1
- trust: 1

Rows (12 of 23):

- s02320 | neon.com | PATCH | updateNeonAuthEmailProvider | Update email provider configuration | w (high): edit provider configuration
- s02738 | azure.com | PUT | ServerBlobAuditingPolicies_CreateOrUpdate |  | w (high): edit policy
- s11872 | azure.com | PUT | ExtendedDatabaseBlobAuditingPolicies_CreateOrUpdate |  | w (high): iii create or update policy
- s05205 | cloudflare | PATCH | configure_dmarc_reports | Configure DMARC Reports | w (high): iii edits setting
- s14341 | amazonaws.com | POST | POST_SetIdentityFeedbackForwardingEnabled |  | w (high): toggle setting
- s10720 | microsoft.com | POST | identityGovernance.entitlementManagement.accessPackageAssignments.accessPackageAssignmentPolicy.CreateCustomExtensionHandlers | Create new navigation property to customExtensionHandlers for identityGovernance | w (high): ii plain create
- s00783 | neon.com | PATCH | updateNeonAuthPhoneNumberPlugin | Update phone number plugin configuration | w (high): edits plugin config
- s01089 | cloudflare | POST | mcp-portals-api-create-servers | Create a new MCP Server | w (high): ii plain create
- s11183 | neon.com | PATCH | updateNeonAuthEmailServer | Update email server configuration | w (high): iii edits config
- s04910 | twilio.com | POST | CreateConnectionPolicyTarget |  | w (high): ii plain create
- s10567 | linode.com | PUT | updateClient | OAuth Client Update | w (high): edit client
- s04410 | amazonaws.com | GET | GET_SetIdentityFeedbackForwardingEnabled |  | w (high): toggle forwarding enable/disable

## membership/G01 (40 rows)

Top matched words:

- member: 26
- assignment: 7
- membership: 4
- recipient: 2
- assign: 1

Rows (12 of 40):

- s03276 | orbit.love | PUT |  | Update a member | w (high): edit details
- s13179 | okta | POST | activateRealmAssignment | Activate a realm assignment | w (high): toggle activate has deactivate
- s05616 | microsoft.com | PATCH | users.joinedTeams.tags.UpdateMembers | Update the navigation property members in users | w (high): PATCH edit tag member
- s06601 | zoom.us | PATCH | updateAGroupMember | Update a group member | w (high): PATCH edits member setting
- s13269 | amazonaws.com | PATCH | UpdateMember |  | w (high): PATCH edits member config
- s03914 | docusign | PUT | Recipients_PutRecipientsDocumentVisibility | Updates document visibility for recipients | w (high): edit visibility
- s01910 | microsoft.com | PATCH | teamTemplateDefinition.teamDefinition.channels.UpdateMembers | Update the navigation property members in teamTemplateDefinition | w (high): iii edit
- s05794 | microsoft.com | PATCH | teams.tags.UpdateMembers | Update the navigation property members in teams | w (high): PATCH edit tag member
- s12579 | microsoft.com | PATCH | groups.team.tags.UpdateMembers | Update the navigation property members in groups | w (high): PATCH edits member
- s09479 | squareup.com | PUT | UpdateTeamMember | UpdateTeamMember | w (high): edit details
- s14027 | bungie.net | POST | GroupV2.UnbanMember |  | w (high): toggle unban has ban
- s06721 | netbox.dev | PUT | tenancy_contact-assignments_update |  | w (high): PUT edits assignment

## membership/G04 (12 rows)

Top matched words:

- member: 10
- recipient: 2

Rows (12 of 12):

- s03539 | googleapis.com | POST | displayvideo.firstAndThirdPartyAudiences.editCustomerMatchMembers |  | w (high): iii edits audience members
- s05641 | sendgrid.com | POST | POST_contactdb-lists-list_id-recipients-recipient_id | Add a Single Recipient to a List | w (high): adds item to list re-removable
- s05881 | microsoft.com | POST | bookingBusinesses.CreateStaffMembers | Create bookingStaffMember | w (high): ii plain create
- s06182 | azure.com | PUT | SyncMembers_CreateOrUpdate |  | w (high): PUT create or update
- s06414 | amazonaws.com | GET | GET_RegisterTransitGatewayMulticastGroupMembers |  | w (high): iii attaches members
- s07403 | azure.com | PUT | BlockchainMembers_Create |  | w (high): ii plain create
- s08776 | mailchimp | PUT | putListsIdMembersId | Add or update list member | w (high): adds or edits list member
- s09366 | cloudflare | POST | issues.groups.members.add | Add issue group members | w (high): add to group
- s09414 | mailchimp | POST | postListsIdSegmentsId | Batch add or remove members | w (high): iii edits segment members
- s11135 | orbit.love | POST |  | Create a Custom or a Content activity for a new or existing member | w (high): ii creates activity
- s14351 | orbit.love | POST |  | Create or update a member | w (high): create or update member
- s14591 | sendgrid.com | POST | POST_contactdb-lists-list_id-recipients | Add Multiple Recipients to a List | w (high): add to list

## outside/G01 (48 rows)

Top matched words:

- target: 27
- subscription: 11
- connection: 5
- integration: 3
- subscribe: 2

Rows (12 of 48):

- s12675 | amazonaws.com | POST | UpdateIPSet |  | w (high): edit set
- s08092 | amazonaws.com | POST | CreateStack |  | w (high): ii creates stack
- s08379 | amazonaws.com | POST | CreateIpGroup |  | w (high): ii plain create
- s02001 | amazonaws.com | POST | UpdateEntitlement |  | w (high): edits entitlement
- s12828 | amazonaws.com | POST | BatchAssociateApprovalRuleTemplateWithRepositories |  | w (high): associates template with repos
- s12075 | microsoft.com | PATCH | connections.UpdateGroups | Update the navigation property groups in connections | w (high): PATCH edit group
- s02585 | amazonaws.com | POST | PutExternalModel |  | w (high): create or update endpoint
- s05295 | amazonaws.com | POST | CreateAlias |  | w (high): ii plain create of alias
- s05212 | azure.com | PATCH | Group_Update |  | w (high): iii edits group
- s03380 | microsoft.com | PATCH | external.connections.UpdateGroups | Update the navigation property groups in external | w (high): edit details
- s09643 | pagerduty | POST | createBusinessServiceAccountSubscription | Create Business Service Account Subscription | w (high): ii subscribe account to service
- s09885 | azure.com | PUT | ShareSubscriptions_Create | Create shareSubscription in an account. | w (high): ii plain create

## outside/G04 (29 rows)

Top matched words:

- subscription: 12
- target: 6
- connection: 4
- integration: 3
- stream: 3
- connector: 1

Rows (12 of 29):

- s00524 | workos.com | PUT | DataIntegrationsManagementController_updateOrganizationDataIntegration | Update an organization-owned data integration | w (high): edits integration settings
- s03190 | azure.com | PUT | Accounts_Create |  | w (high): ii plain create of account
- s14596 | workos.com | POST | DataIntegrationsOrganizationController_createOrganizationDataInstallation | Import an organization connected account | w (high): ii import own store
- s08008 | amazonaws.com | POST | CreatePlayerSession |  | w (high): ii creates player session
- s05758 | azure.com | PUT | Accounts_Create | Create an account in the given resource group | w (high): ii plain create
- s06061 | azure.com | PUT | Accounts_CreateOrUpdate | Accounts_CreateOrUpdate | w (high): PUT create or update
- s11896 | azure.com | PUT | Accounts_CreateOrUpdate | Create or Update the EngagementFabric account | w (high): iii create or update
- s12283 | api.video | POST | POST_live-streams | Create live stream | w (high): ii plain create
- s13980 | azure.com | PUT | ChapSettings_CreateOrUpdate |  | w (high): create or update setting
- s13765 | azure.com | PUT | Accounts_Create |  | w (high): ii plain create
- s12779 | amazonaws.com | POST | CreateDirectory |  | w (high): ii plain create
- s13154 | stripe.com | POST | PostFinancialConnectionsSessions |  | w (high): ii plain create

## outside/G06 (235 rows)

Top matched words:

- integration: 52
- target: 31
- subscription: 30
- extension: 25
- webhook: 21
- notification: 19
- connection: 8
- hook: 8
- endpoint: 7
- transport: 7

Rows (12 of 235):

- s12397 | amazonaws.com | POST | UpdateAssociation |  | w (high): edit association
- s02970 | alertersystem.com | POST | api_transport-sendinblue_post | Creates a TransportSendinblue resource. | w (high): ii plain create
- s08750 | amazonaws.com | POST | UpdateLoggingConfiguration |  | w (high): edits logging config
- s03122 | microsoft.com | POST | me.contactFolders.contacts.CreateExtensions | Create new navigation property to extensions for me | w (high): ii plain create of extension
- s00678 | azure.com | PUT | ReplicationAlertSettings_Create | Configures email notifications for this vault. | w (high): edits alert config
- s13271 | cloudflare | POST | dlp-zt-risk-score-integration-create | Create new risk score integration. | w (high): ii plain create
- s06697 | datadog | POST | EnableAWSLogServices | Enable an AWS Logs integration | w (high): iii enables config
- s06666 | apacta.com | POST |  | Add a user integration setting | w (high): ii plain create
- s00057 | sendgrid.com | PATCH | PATCH_user-webhooks-parse-settings-hostname | Update a parse setting | w (high): edits parse setting
- s05063 | amazonaws.com | POST | CreateIntegrationResponse |  | w (high): ii plain create
- s07125 | amazonaws.com | PUT | PutIntegrationResponse |  | w (high): edit integration
- s06982 | amazonaws.com | POST | AddApplicationCloudWatchLoggingOption |  | w (high): adds logging option

## session/G04 (14 rows)

Top matched words:

- session: 14

Rows (12 of 14):

- s11074 | googleapis.com | PUT | fitness.users.sessions.update |  | w (high): iii updates session
- s00251 | presalytics.io | POST | story_id_session_post | Sessions: Create a Session | w (high): ii plain create
- s01612 | googleapis.com | POST | spanner.projects.instances.databases.sessions.create |  | w (high): ii creates session
- s04724 | klarna.com | POST | createCreditSession | Create a new payment session | w (high): ii creates session
- s10968 | stripe.com | POST | PostLinkAccountSessions |  | w (high): ii plain create
- s03255 | vtex.local | POST | Createnewsession | Create new session | w (high): ii plain create
- s04576 | amazonaws.com | POST | PutSession |  | w (high): iii sets session state
- s10128 | microsoft.com | POST | drives.drive.items.driveItem.workbook.createSession | Invoke action createSession | w (high): ii creates session
- s09392 | twilio.com | POST | CreateSession |  | w (high): ii plain create
- s00401 | adyen | POST | post-sessions | Create a payment session | w (high): ii creates session no charge
- s05675 | microsoft.com | POST | dataClassification.exactMatchDataStores.CreateSessions | Create new navigation property to sessions for dataClassification | w (high): ii plain create
- s06560 | vtex.local | PATCH | Editsession | Edit session | w (high): iii edits session

## container/G01 (189 rows)

Top matched words:

- group: 117
- team: 41
- organization: 13
- project: 10
- repository: 4
- channel: 2
- org: 1
- tenant: 1

Rows (12 of 189):

- s08688 | jira | POST | createGroup | Create group | w (high): ii plain create
- s07323 | microsoft.com | PATCH | users.teamwork.UpdateAssociatedTeams | Update the navigation property associatedTeams in users | w (high): PATCH edit
- s13437 | amazonaws.com | POST | UpdateOrganizationConfiguration |  | w (high): iii config edit
- s11136 | amazonaws.com | POST | POST_CreateDBSecurityGroup |  | w (high): ii creates group
- s07958 | mist.com | POST | createMspOrgGroup | createMspOrgGroup | w (high): ii plain create
- s14105 | goharbor.io | PUT | updateUserGroup | Update group information | w (high): PUT edit group
- s11162 | netbox.dev | PATCH | tenancy_tenant-groups_partial_update |  | w (high): iii edits group
- s09668 | keycloak.local | POST |  | Set or create child. | w (high): ii create child group
- s02250 | microsoft.com | PATCH | me.joinedTeams.primaryChannel.UpdateSharedWithTeams | Update the navigation property sharedWithTeams in me | w (high): edit shared teams
- s10365 | okta | POST | createGroupRule | Create a group rule | w (high): ii create inactive rule
- s10148 | microsoft.com | PATCH | users.UpdateJoinedTeams | Update the navigation property joinedTeams in users | w (high): PATCH edit team
- s02457 | gerermesaffaires.com | PATCH |  |  | w (high): PATCH edit group

## container/G04 (48 rows)

Top matched words:

- organization: 22
- group: 14
- tenant: 4
- project: 3
- org: 2
- channel: 1
- repository: 1
- workspace: 1

Rows (12 of 48):

- s11016 | googleapis.com | POST | identitytoolkit.projects.tenants.create |  | w (high): ii creates tenant
- s06188 | sentry | POST | createOrganizationExternalUser | Create an External User | w (high): ii creates link
- s06512 | zendesk | POST | CreateOrganization | Create Organization | w (high): ii creates org
- s03129 | googleapis.com | POST | apigee.organizations.environments.apis.revisions.debugsessions.create |  | w (high): ii plain create of debug session
- s11193 | i-cue.solutions | POST |  | Create organization | w (high): ii plain create
- s10216 | polar.sh | POST | organizations:create | Create Organization | w (high): ii plain create
- s03572 | etherpad.local | POST | createGroupIfNotExistsForUsingPOST | this functions helps you to map your application group ids to Etherpad group ids | w (high): ii plain create of mapping
- s05714 | zoomconnect.com | GET |  | addContact | w (high): adds contact to group
- s05022 | snyk.io | POST | Create a new organization | Create a new organization | w (high): ii plain create
- s04091 | amazonaws.com | POST | CreateChannel |  | w (high): ii plain create
- s08126 | azure.com | POST | PersonGroupPerson_Create |  | w (high): ii creates person
- s08480 | zoom | POST | imGroupCreate | Create an IM Group | w (high): ii plain create of group

## container/G06 (26 rows)

Top matched words:

- project: 14
- channel: 7
- cluster: 2
- workspace: 2
- group: 1

Rows (12 of 26):

- s01981 | googleapis.com | POST | compute.forwardingRules.insert |  | w (high): ii plain create
- s05529 | amazonaws.com | PUT | UpdateMonitoring |  | w (high): PUT edit of settings
- s02658 | googleapis.com | POST | container.projects.locations.clusters.setMonitoring |  | w (high): edit setting
- s13375 | gitlab | PUT | putV3ProjectsIdServicesPipelinesEmail | Set pipelines-email service for project | w (high): sets service config
- s03435 | amazonaws.com | PUT | UpdateApnsChannel |  | w (high): toggle enables channel
- s05905 | gitlab | PUT | putV3ProjectsIdServicesSlackSlashCommands | Set slack-slash-commands service for project | w (high): edit service settings
- s14207 | amazonaws.com | PUT | ConfigureLogs |  | w (high): edits config
- s08737 | gitlab.com | PUT | putV3ProjectsIdServicesGemnasium | Set gemnasium service for project | w (high): sets service config
- s00607 | amazonaws.com | PUT | UpdateApnsVoipSandboxChannel |  | w (high): edits channel settings
- s00277 | gitlab.com | PUT | putV3ProjectsIdServicesDroneCi | Set drone-ci service for project | w (high): edit service config
- s00491 | googleapis.com | POST | tagmanager.accounts.containers.workspaces.tags.create |  | w (high): ii plain create tag
- s12284 | amazonaws.com | PUT | ConfigureLogsForChannel |  | w (high): edit settings

## rest/G01 (154 rows)

Top matched words:

- (none): 154

Rows (12 of 154):

- s11179 | gambitcomm.local | POST | from_add | Add a source address that the agent will accept messages from. | w (high): iii adds accepted source
- s00013 | okta.local | POST | suspendUser | Suspend User | w (high): toggle suspend has unsuspend
- s06357 | workos.com | PUT | ApplicationsController_update | Update a Connect Application | w (high): edit application
- s11238 | microsoft | PATCH | users.insights.UpdateShared | Update the navigation property shared in users | w (high): PATCH edit
- s03202 | loket.nl | PUT | PutDashboardLicensesByEmployerId | Edit the dashboard license | w (high): edit details
- s01128 | appwrite.io | POST | storageCreateFile | Create File | w (high): ii plain create
- s05355 | x | POST | unblockUsersDms | Unblock Users Dms | w (high): toggle unblock
- s14546 | circuitsandbox.net | POST | moderateConversation | Set conversation moderated | w (high): edit setting
- s04743 | amazonaws.com | GET | GET_AttachClassicLinkVpc |  | w (high): attach has detach
- s03807 | getlago.com | PATCH | updateEntitlement | Partial update of an entitlement | w (high): edit plan entitlements
- s12535 | jira | POST | createFilter | Create filter | w (high): ii plain create
- s06286 | sendgrid.com | PATCH | PATCH_subusers-subuser_name | Enable/disable a subuser | w (high): toggle enable disable

## rest/G04 (162 rows)

Top matched words:

- (none): 162

Rows (12 of 162):

- s09034 | journy.io | POST | upsertAccount | Create or update account | w (high): ii create or update
- s07467 | onsched.com | POST |  | Create Company | w (high): ii plain create
- s13263 | jumpseller.com | POST |  | Adds Customers to a CustomerCategory. | w (high): adds customers to category
- s13278 | xero.com | PUT | createEmployees | Creates new employees used in Xero payrun | w (high): ii creates employees
- s05172 | mailchimp | POST | postEcommerceStoresIdCustomers | Add customer | w (high): ii plain create
- s04313 | adyen.com | POST | post-accountHolders | Create an account holder | w (high): ii plain create
- s03627 | openchannel.io | POST |  | Updates the developer account or adds the developer account if it doesn't exist | w (high): upsert account details
- s00053 | data2crm.com | POST | createAccountEntity | POST for account | w (high): ii plain create
- s05266 | vtex.local | POST | UpsertSellerRequest | Configure Seller Account | w (high): iii configures seller
- s11407 | microsoft.com | POST | financials.companies.CreateEmployees | Create new navigation property to employees for financials | w (high): ii plain create employee record
- s11312 | vmware.local | PUT | updateBrocadeSwitch | Update a brocade switch data source | w (high): edit data source
- s01860 | coolify.io | POST | create-private-github-app-application | Create (Private - GH App) | w (high): ii plain create

## rest/G06 (85 rows)

Top matched words:

- (none): 85

Rows (12 of 85):

- s03523 | amazonaws.com | POST | CreateRecordingConfiguration |  | w (high): ii plain create of configuration
- s02699 | clearblade | PUT | UpdateSMSSettings | 2FA - Update SMS Settings | w (high): edit settings
- s06033 | auth0 | PATCH | patch_provider | Update email provider | w (high): PATCH edit of provider settings
- s02843 | clearblade | PUT | UpdateEmailSettings | 2FA - Update Email Settings | w (high): iii edits settings
- s08840 | azure.com | PUT | ServiceDiagnosticSettings_CreateOrUpdate |  | w (high): edit diagnostic settings
- s10454 | auth0 | POST | create_phone_provider | Configure the phone provider | w (high): ii plain create
- s03428 | twitter.com | POST | account.update_delivery_device |  | w (high): iii edits delivery setting
- s03557 | amazonaws.com | GET | GET_CreatePlatformApplication |  | w (high): ii plain create of application
- s11502 | onsched.com | POST |  | Link Service to Calendar | w (high): iii links service
- s13692 | pagerduty | PUT | updateOrchPathRouter | Update the Router for an Event Orchestration | w (high): edit routing rules
- s04527 | amazonaws.com | PUT | ConfigureLogsForPlaybackConfiguration |  | w (high): iii edits log settings
- s01958 | twilio.com | POST | CreateBinding |  | w (high): ii plain create
