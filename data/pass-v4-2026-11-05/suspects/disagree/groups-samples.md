# Disagreement group samples

## group_id=G01 | direction=jevX-sonW | question=accessChange | sonnet_confidence=high | rows=908 | distinct_providers=146 | top5_providers=microsoft.com:249;amazonaws.com:113;azure.com:45;googleapis.com:34;cloudflare:33 | methods=POST:449;PATCH:240;PUT:195;GET:23;DELETE:1

- s08452 | microsoft.com | POST teamTemplateDefinition.teamTemplateDefinition.teamDefinition.permissionGrants.resourceSpecificPermissionGrant.restore | Invoke action restore
  Sonnet w (high): restore of deleted item
  p: accessChange=0.65 handsOver=0.38 outside=0.01 otherX=0.18
- s13787 | gambitcomm.local | PUT protocol_snmpv3_vacm_save | Saves current group, access, view settings in the currently loaded VACM config file.
  Sonnet w (high): saves config
  p: accessChange=0.8 handsOver=0.06 outside=0.01 otherX=0.12
- s10095 | microsoft.com | PATCH identityGovernance.entitlementManagement.accessPackageAssignments.accessPackage.accessPackageResourceRoleScopes.accessPackageResourceRole.accessPackageResource.accessPackageResourceScopes.UpdateAccessPackageResource | Update the navigation property accessPackageResource in identityGovernance
  Sonnet w (high): PATCH edit resource
  p: accessChange=0.9 handsOver=0.04 outside=0.01 otherX=0.02
- s00052 | miro | POST create-board | Create board
  Sonnet w (high): ii plain create of board
  p: accessChange=0.94 handsOver=0.05 outside=0.02 otherX=0.06
- s00867 | twitter.com | POST usersIdBlock | Block User by User ID
  Sonnet w (high): block has unblock
  p: accessChange=0.54 handsOver=0.04 outside=0.01 otherX=0.06
- s05355 | x | POST unblockUsersDms | Unblock Users Dms
  Sonnet w (high): toggle unblock
  p: accessChange=0.72 handsOver=0.04 outside=0.01 otherX=0.11
- s03276 | orbit.love | PUT /{workspace_slug}/members/{member_slug} | Update a member
  Sonnet w (high): edit details
  p: accessChange=0.85 handsOver=0.23 outside=0.01 otherX=0.03
- s08339 | dracoon.team | POST createGroup | Create new user group
  Sonnet w (high): ii plain create
  p: accessChange=0.79 handsOver=0.65 outside=0.01 otherX=0.03
- s10264 | auth0 | POST post_synchronized-groups | Add synchronized group selections to a directory provisioning configuration
  Sonnet w (high): edit sync selections
  p: accessChange=0.55 handsOver=0.1 outside=0.36 otherX=0.13
- s12983 | microsoft.com | PATCH privilegedSignupStatus.privilegedSignupStatus.UpdatePrivilegedSignupStatus | Update entity in privilegedSignupStatus
  Sonnet w (high): edit status
  p: accessChange=0.77 handsOver=0.06 outside=0.01 otherX=0.03

## group_id=G02 | direction=jevX-sonW | question=accessChange | sonnet_confidence=low | rows=622 | distinct_providers=95 | top5_providers=microsoft.com:278;amazonaws.com:57;googleapis.com:19;cloudflare:17;okta:15 | methods=POST:263;PATCH:231;PUT:116;GET:12

- s12832 | zoom | POST meetingRegistrantCreate | Add a meeting registrant
  Sonnet w (low): ii register participant no send stated
  p: accessChange=0.62 handsOver=0.5 outside=0.01 otherX=0.13
- s05455 | microsoft.com | PATCH governanceRoleAssignments.UpdateRoleDefinition | Update the navigation property roleDefinition in governanceRoleAssignments
  Sonnet w (low): PATCH edit of role definition link
  p: accessChange=0.95 handsOver=0.17 outside=0.01 otherX=0.03
- s02869 | microsoft.com | PATCH accessReviews.instances.UpdateDecisions | Update the navigation property decisions in accessReviews
  Sonnet w (low): iii edits decision
  p: accessChange=0.55 handsOver=0.03 outside=0.01 otherX=0.02
- s05540 | microsoft.com | POST identityGovernance.entitlementManagement.accessPackageResourceRoleScopes.accessPackageResourceScope.accessPackageResource.CreateAccessPackageResourceScopes | Create new navigation property to accessPackageResourceScopes for identityGovernance
  Sonnet w (low): ii plain create
  p: accessChange=0.92 handsOver=0.16 outside=0.01 otherX=0.02
- s01067 | mailchimp | POST postListsId | Batch subscribe or unsubscribe
  Sonnet w (low): unsubscribe re-subscribable
  p: accessChange=0.86 handsOver=0.71 outside=0.02 otherX=0.3
- s03422 | microsoft.com | POST users.insights.CreateShared | Create new navigation property to shared for users
  Sonnet w (low): ii plain create of property
  p: accessChange=0.9 handsOver=0.19 outside=0.03 otherX=0.21
- s10459 | amazonaws.com | POST UpdateWorkforce | 
  Sonnet w (low): edit workforce config
  p: accessChange=0.9 handsOver=0.13 outside=0.06 otherX=0.03
- s14178 | microsoft.com | POST privilegedAccess.resources.CreateRoleSettings | Create new navigation property to roleSettings for privilegedAccess
  Sonnet w (low): ii create settings
  p: accessChange=0.81 handsOver=0.09 outside=0.02 otherX=0.02
- s11828 | meta-whatsapp | POST createWhatsAppBusinessSolution | Create Multi-Partner Solution
  Sonnet w (low): ii create solution initiated only
  p: accessChange=0.98 handsOver=0.25 outside=0.05 otherX=0.03
- s13741 | autotask.net | PATCH Roles_PatchEntity | 
  Sonnet w (low): edit roles
  p: accessChange=0.93 handsOver=0.13 outside=0.02 otherX=0.03

## group_id=G03 | direction=jevX-sonW | question=otherX | sonnet_confidence=high | rows=607 | distinct_providers=134 | top5_providers=amazonaws.com:185;googleapis.com:36;azure.com:35;microsoft.com:35;cloudflare:34 | methods=POST:399;PUT:144;GET:29;PATCH:26;DELETE:9

- s06327 | amazonaws.com | POST RestoreEventDataStore | 
  Sonnet w (high): restore deleted
  p: accessChange=0.02 handsOver=0.03 outside=0.02 otherX=0.6
- s04321 | amazonaws.com | POST ImportClientBranding | 
  Sonnet w (high): edit branding
  p: accessChange=0.02 handsOver=0.08 outside=0.04 otherX=0.84
- s09897 | microsoft.com | POST me.pendingAccessReviewInstances.accessReviewInstance.decisions.accessReviewInstanceDecisionItem.instance.resetDecisions | Invoke action resetDecisions
  Sonnet w (high): iii resets decisions
  p: accessChange=0.1 handsOver=0.02 outside=0.01 otherX=0.51
- s11098 | trakt.tv | POST Remove items from personal list | Remove items from personal list
  Sonnet w (high): removes item from list on POST
  p: accessChange=0.01 handsOver=0.02 outside=0.01 otherX=0.77
- s13737 | neon.com | DELETE deleteProjectBranchBucketObjectsByPrefix | Delete every object under a key prefix (folder) in a bucket
  Sonnet w (high): soft delete restorable
  p: accessChange=0.02 handsOver=0.02 outside=0.01 otherX=0.67
- s11338 | azure.com | POST ApplicationGateways_Start | 
  Sonnet w (high): start has stop
  p: accessChange=0.01 handsOver=0.01 outside=0.01 otherX=0.6
- s06915 | digitalocean | DELETE nfs_delete_access_point | Delete an NFS access point
  Sonnet w (high): soft-delete stated
  p: accessChange=0.45 handsOver=0.02 outside=0.01 otherX=0.71
- s05507 | googleapis.com | POST cloudshell.users.environments.start | 
  Sonnet w (high): start environment can stop
  p: accessChange=0.02 handsOver=0.12 outside=0.02 otherX=0.77
- s11372 | intercom | POST enqueueCreateTicket | Enqueue create ticket
  Sonnet w (high): ii plain create
  p: accessChange=0.01 handsOver=0.03 outside=0.02 otherX=0.94
- s00544 | amazonaws.com | POST UpdateMedicalVocabulary | 
  Sonnet w (high): edits vocabulary
  p: accessChange=0.01 handsOver=0.02 outside=0.02 otherX=0.8

## group_id=G04 | direction=jevX-sonW | question=handsOver | sonnet_confidence=high | rows=518 | distinct_providers=148 | top5_providers=microsoft.com:119;azure.com:38;googleapis.com:28;amazonaws.com:27;cloudflare:25 | methods=POST:395;PUT:78;PATCH:37;GET:8

- s06963 | apideck.com | POST customersAdd | Create Customer Support Customer
  Sonnet w (high): ii plain create
  p: accessChange=0.09 handsOver=0.67 outside=0.01 otherX=0.02
- s14357 | stripe | POST PostAccountsAccountPersons | Create a person
  Sonnet w (high): ii plain create
  p: accessChange=0.13 handsOver=0.72 outside=0.01 otherX=0.02
- s06001 | microsoft.com | POST groups.group.conversations.conversation.threads.conversationThread.posts.post.attachments.createUploadSession | Invoke action createUploadSession
  Sonnet w (high): ii creates upload session
  p: accessChange=0.02 handsOver=0.67 outside=0.03 otherX=0.18
- s10227 | microsoft.com | POST me.outlook.taskGroups.outlookTaskGroup.taskFolders.outlookTaskFolder.tasks.outlookTask.attachments.createUploadSession | Invoke action createUploadSession
  Sonnet w (high): ii creates upload session
  p: accessChange=0.01 handsOver=0.59 outside=0.03 otherX=0.15
- s13765 | azure.com | PUT Accounts_Create | 
  Sonnet w (high): ii plain create
  p: accessChange=0.06 handsOver=0.51 outside=0.02 otherX=0.03
- s09215 | auth0 | PATCH patch_action_module | Update a specific Actions Module
  Sonnet w (high): edit module
  p: accessChange=0.03 handsOver=0.58 outside=0.03 otherX=0.06
- s03929 | azure.com | PUT BotConnection_Create | 
  Sonnet w (high): ii plain create
  p: accessChange=0.38 handsOver=0.75 outside=0.27 otherX=0.07
- s00791 | coolify.io | PATCH set-secret-manager-source | Set Secret Manager Source
  Sonnet w (high): edits link
  p: accessChange=0.1 handsOver=0.82 outside=0.15 otherX=0.07
- s09392 | twilio.com | POST CreateSession | 
  Sonnet w (high): ii plain create
  p: accessChange=0.02 handsOver=0.93 outside=0.03 otherX=0.06
- s14514 | apidapp.com | POST /wallet | 
  Sonnet w (high): ii plain create
  p: accessChange=0.11 handsOver=0.77 outside=0.02 otherX=0.05

## group_id=G05 | direction=jevX-sonW | question=handsOver | sonnet_confidence=low | rows=392 | distinct_providers=133 | top5_providers=microsoft.com:46;amazonaws.com:25;azure.com:22;cloudflare:17;googleapis.com:16 | methods=POST:304;PUT:59;PATCH:17;GET:12

- s11775 | apideck.com | POST connectionsAdd | Create connection
  Sonnet w (low): ii plain create
  p: accessChange=0.53 handsOver=0.59 outside=0.26 otherX=0.04
- s08033 | ix-api.net | POST accounts_create | 
  Sonnet w (low): ii creates account record
  p: accessChange=0.29 handsOver=0.99 outside=0.02 otherX=0.03
- s03210 | azure.com | PUT Session_Create | 
  Sonnet w (low): ii plain create of session
  p: accessChange=0.02 handsOver=0.87 outside=0.02 otherX=0.12
- s10711 | render.com | PATCH update-registry-credential | Update registry credential
  Sonnet w (low): edit credential
  p: accessChange=0.25 handsOver=0.81 outside=0.02 otherX=0.14
- s10770 | amazonaws.com | POST ReplicateKey | 
  Sonnet w (low): ii create replica key
  p: accessChange=0.28 handsOver=0.8 outside=0.03 otherX=0.56
- s07061 | microsoft.com | POST me.calendar.calendarView.event.attachments.createUploadSession | Invoke action createUploadSession
  Sonnet w (low): ii creates upload session
  p: accessChange=0.02 handsOver=0.62 outside=0.04 otherX=0.13
- s02473 | getlago.com | POST walletTransactionPaymentUrl | Generate a payment URL
  Sonnet w (low): generates link only
  p: accessChange=0.02 handsOver=0.51 outside=0.09 otherX=0.32
- s01263 | apideck.com | POST connectionsToken | Get Access Token
  Sonnet w (low): stores token on connection
  p: accessChange=0.6 handsOver=0.98 outside=0.02 otherX=0.41
- s03931 | azure.com | PATCH Tokens_Update | 
  Sonnet w (low): edit token
  p: accessChange=0.81 handsOver=0.84 outside=0.02 otherX=0.09
- s12082 | azure.com | PUT PowerShell_CreateSession | 
  Sonnet w (low): ii creates session
  p: accessChange=0.02 handsOver=0.72 outside=0.02 otherX=0.3

## group_id=G06 | direction=jevX-sonW | question=outside | sonnet_confidence=high | rows=377 | distinct_providers=69 | top5_providers=amazonaws.com:98;microsoft.com:29;azure.com:28;cloudflare:20;googleapis.com:16 | methods=POST:193;PUT:120;PATCH:48;GET:16

- s02521 | zulip.com | POST add-fcm-token | Add an FCM registration token
  Sonnet w (high): registers token
  p: accessChange=0.03 handsOver=0.53 outside=0.74 otherX=0.12
- s12572 | microsoft.com | POST groups.group.subscribeByMail | Invoke action subscribeByMail
  Sonnet w (high): toggle subscribe
  p: accessChange=0.15 handsOver=0.1 outside=0.73 otherX=0.57
- s03557 | amazonaws.com | GET GET_CreatePlatformApplication | 
  Sonnet w (high): ii plain create of application
  p: accessChange=0.05 handsOver=0.35 outside=0.59 otherX=0.04
- s13677 | googleapis.com | POST tagmanager.accounts.containers.workspaces.gtag_config.create | 
  Sonnet w (high): ii plain create
  p: accessChange=0.02 handsOver=0.14 outside=0.69 otherX=0.03
- s01119 | cloudflare | PUT dlp-zt-risk-score-integration-update | Update a risk score integration.
  Sonnet w (high): edit
  p: accessChange=0.02 handsOver=0.05 outside=0.82 otherX=0.32
- s01059 | alertersystem.com | POST api_transport-zendesk_post | Creates a TransportZendesk resource.
  Sonnet w (high): ii plain create
  p: accessChange=0.02 handsOver=0.05 outside=0.56 otherX=0.03
- s00833 | amazonaws.com | POST CreateDeliveryStream | 
  Sonnet w (high): ii plain create stream
  p: accessChange=0.04 handsOver=0.05 outside=0.76 otherX=0.1
- s14382 | googleapis.com | POST content.datafeeds.insert | 
  Sonnet w (high): ii plain create
  p: accessChange=0.02 handsOver=0.03 outside=0.55 otherX=0.05
- s02660 | kumpeapps.com | POST kkid_apns_post | subscribes/unsubscribes/registers for apns push notifications
  Sonnet w (high): register preferences
  p: accessChange=0.07 handsOver=0.18 outside=0.77 otherX=0.28
- s11293 | maif.local | POST serviceAddTarget | Add a target to a service descriptor
  Sonnet w (high): adds target edit
  p: accessChange=0.03 handsOver=0.05 outside=0.54 otherX=0.02

## group_id=G07 | direction=jevW-sonX | question=otherX | sonnet_confidence=low | rows=329 | distinct_providers=76 | top5_providers=microsoft.com:107;amazonaws.com:51;googleapis.com:19;azure.com:15;cloudflare:9 | methods=POST:252;PUT:33;GET:24;PATCH:12;DELETE:8

- s06117 | amazonaws.com | POST POST_SetDesiredCapacity | 
  Sonnet x (low): e may terminate instances
  p: accessChange=0.01 handsOver=0.02 outside=0.01 otherX=0.48
- s13714 | microsoft.com | POST groups.group.calendar.calendarView.event.accept | Invoke action accept
  Sonnet x (low): c response sent to organizer
  p: accessChange=0.02 handsOver=0.03 outside=0.02 otherX=0.2
- s10999 | microsoft.com | POST tenantRelationships.managedTenants.managementTemplateStepVersions.CreateDeployments | Create new navigation property to deployments for tenantRelationships
  Sonnet x (low): e creates deployment run
  p: accessChange=0.02 handsOver=0.04 outside=0.02 otherX=0.23
- s06811 | salesloft.com | PUT /v2/bulk_jobs/{id} | Update a bulk job
  Sonnet x (low): e marks bulk job ready to execute
  p: accessChange=0.01 handsOver=0.02 outside=0.01 otherX=0.22
- s14095 | microsoft.com | POST me.events.event.exceptionOccurrences.event.instances.event.tentativelyAccept | Invoke action tentativelyAccept
  Sonnet x (low): c sends response to organizer
  p: accessChange=0.02 handsOver=0.03 outside=0.02 otherX=0.32
- s12519 | ebay.com | POST createAdByListingId | 
  Sonnet x (low): d adds paid ad
  p: accessChange=0.01 handsOver=0.03 outside=0.01 otherX=0.2
- s00537 | microsoft.com | POST me.calendarGroups.calendarGroup.calendars.calendar.events.event.exceptionOccurrences.event.tentativelyAccept | Invoke action tentativelyAccept
  Sonnet x (low): c response sent to organizer
  p: accessChange=0.02 handsOver=0.02 outside=0.02 otherX=0.34
- s00363 | microsoft.com | POST me.calendar.events.event.exceptionOccurrences.event.instances.event.tentativelyAccept | Invoke action tentativelyAccept
  Sonnet x (low): c response sent to organizer
  p: accessChange=0.02 handsOver=0.03 outside=0.02 otherX=0.27
- s08355 | microsoft.com | POST deviceAppManagement.mobileAppConfigurations.managedDeviceMobileAppConfiguration.assign | Invoke action assign
  Sonnet x (low): g assigns app config
  p: accessChange=0.15 handsOver=0.06 outside=0.02 otherX=0.24
- s09751 | microsoft.com | POST groups.group.events.event.instances.event.tentativelyAccept | Invoke action tentativelyAccept
  Sonnet x (low): c response sent to organizer
  p: accessChange=0.02 handsOver=0.03 outside=0.02 otherX=0.27

## group_id=G08 | direction=jevX-sonW | question=otherX | sonnet_confidence=low | rows=282 | distinct_providers=108 | top5_providers=amazonaws.com:56;googleapis.com:19;azure.com:17;cloudflare:11;microsoft.com:10 | methods=POST:184;PUT:60;GET:25;PATCH:11;DELETE:2

- s05403 | visagecloud.com | PATCH startStreamUsingPATCH | Start existing stream
  Sonnet w (low): toggle start has stop
  p: accessChange=0.01 handsOver=0.03 outside=0.09 otherX=0.83
- s03306 | azure.com | POST RestoreStorageAccount | Restores a backed up storage account to a vault.
  Sonnet w (low): restore into vault
  p: accessChange=0.03 handsOver=0.04 outside=0.02 otherX=0.52
- s08681 | microsoft.com | POST identityGovernance.accessReviews.definitions.accessReviewScheduleDefinition.instances.accessReviewInstance.stages.accessReviewStage.decisions.accessReviewInstanceDecisionItem.instance.resetDecisions | Invoke action resetDecisions
  Sonnet w (low): resets decisions can be redone
  p: accessChange=0.05 handsOver=0.02 outside=0.01 otherX=0.55
- s12202 | amazonaws.com | POST UpdateContainerAgent | 
  Sonnet w (low): agent update no task interruption
  p: accessChange=0.01 handsOver=0.02 outside=0.01 otherX=0.55
- s10753 | amazonaws.com | POST RestoreObject | 
  Sonnet w (low): restore archived copy
  p: accessChange=0.01 handsOver=0.02 outside=0.02 otherX=0.54
- s07718 | amazonaws.com | POST ReplicateInstance | 
  Sonnet w (low): ii creates replica
  p: accessChange=0.04 handsOver=0.07 outside=0.03 otherX=0.64
- s07144 | azure.com | PUT StreamingJobs_CreateOrReplace | 
  Sonnet w (low): create or replace
  p: accessChange=0.02 handsOver=0.02 outside=0.18 otherX=0.57
- s05640 | amazonaws.com | POST POST_RestoreDBInstanceFromS3 | 
  Sonnet w (low): ii creates new instance
  p: accessChange=0.02 handsOver=0.03 outside=0.02 otherX=0.91
- s00321 | zulip.com | POST create-message-reminder | Create a message reminder
  Sonnet w (low): ii schedules own reminder
  p: accessChange=0.01 handsOver=0.02 outside=0.03 otherX=0.64
- s04552 | amazonaws.com | POST ResumeBatchLoadTask | 
  Sonnet w (low): resume batch task
  p: accessChange=0.01 handsOver=0.02 outside=0.02 otherX=0.9

## group_id=G09 | direction=jevX-sonW | question=outside | sonnet_confidence=low | rows=150 | distinct_providers=53 | top5_providers=amazonaws.com:30;cloudflare:11;microsoft.com:9;pagerduty:7;autotask.net:6 | methods=POST:100;PUT:27;PATCH:18;GET:5

- s01202 | amazonaws.com | POST UpdateWebhook | 
  Sonnet w (low): edits webhook settings
  p: accessChange=0.09 handsOver=0.46 outside=0.97 otherX=0.16
- s04007 | coolify.io | POST add-application-destination | Add Destination
  Sonnet w (low): attach destination toggle
  p: accessChange=0.02 handsOver=0.07 outside=0.58 otherX=0.04
- s12610 | launchdarkly | PATCH patchIntegrationSubscription | Modify an integration subscription by ID.
  Sonnet w (low): edit subscription
  p: accessChange=0.04 handsOver=0.03 outside=0.71 otherX=0.02
- s02891 | gitlab | PUT putV3ProjectsIdServicesPivotaltracker | Set pivotaltracker service for project
  Sonnet w (low): iii sets integration
  p: accessChange=0.02 handsOver=0.06 outside=0.76 otherX=0.02
- s00528 | auth0 | POST post_hooks | Create a hook
  Sonnet w (low): ii creates hook
  p: accessChange=0.04 handsOver=0.2 outside=0.76 otherX=0.03
- s08305 | kubernetes.io | PUT replaceAdmissionregistrationV1MutatingWebhookConfiguration | 
  Sonnet w (low): replaces webhook configuration
  p: accessChange=0.17 handsOver=0.03 outside=0.7 otherX=0.08
- s09156 | gitlab | PUT putV3ProjectsIdServicesHipchat | Set hipchat service for project
  Sonnet w (low): iii sets service integration
  p: accessChange=0.02 handsOver=0.07 outside=0.92 otherX=0.03
- s08513 | amazonaws.com | POST CreateRealtimeLogConfig2020_05_31 | 
  Sonnet w (low): ii creates log config
  p: accessChange=0.02 handsOver=0.04 outside=0.98 otherX=0.21
- s14059 | amazonaws.com | PUT CreateIntegrationAssociation | 
  Sonnet w (low): ii create association
  p: accessChange=0.14 handsOver=0.06 outside=0.62 otherX=0.05
- s00319 | hubapi.com | PATCH patch-/webhooks/v3/{appId}/subscriptions/{subscriptionId}_update | 
  Sonnet w (low): edit subscription
  p: accessChange=0.03 handsOver=0.06 outside=0.76 otherX=0.03

## group_id=G10 | direction=jevW-sonX | question=accessChange | sonnet_confidence=low | rows=98 | distinct_providers=32 | top5_providers=microsoft.com:28;amazonaws.com:15;googleapis.com:9;azure.com:5;cloudflare:4 | methods=POST:66;PUT:19;PATCH:11;GET:2

- s02646 | gsmtasks.com | POST tasks_account_change_create | 
  Sonnet x (low): unclear account change unsure
  p: accessChange=0.42 handsOver=0.29 outside=0.03 otherX=0.05
- s03341 | amazonaws.com | POST POST_UploadSigningCertificate | 
  Sonnet x (low): g credential gives auth
  p: accessChange=0.41 handsOver=0.27 outside=0.01 otherX=0.19
- s03726 | googleapis.com | POST paymentsresellersubscription.partners.subscriptions.provision | 
  Sonnet x (low): d provisions subscription
  p: accessChange=0.32 handsOver=0.15 outside=0.03 otherX=0.18
- s11516 | okta | PATCH addResourceSetResources | Add more resources to a resource set
  Sonnet x (low): g adds resources to set
  p: accessChange=0.25 handsOver=0.09 outside=0.01 otherX=0.04
- s00853 | github.com | PUT enterprise-admin/set-self-hosted-runners-in-group-for-enterprise | Set self-hosted runners in a group for an enterprise
  Sonnet x (low): g replace membership unspecified
  p: accessChange=0.41 handsOver=0.32 outside=0.02 otherX=0.36
- s06549 | cloudflare | POST zone-level-access-mtls-authentication-add-an-mtls-certificate | Add an mTLS certificate
  Sonnet x (low): g adds trusted certificate
  p: accessChange=0.48 handsOver=0.32 outside=0.02 otherX=0.05
- s07903 | microsoft.com | POST organization.organization.setMobileDeviceManagementAuthority | Invoke action setMobileDeviceManagementAuthority
  Sonnet x (low): authority change unsure
  p: accessChange=0.42 handsOver=0.07 outside=0.05 otherX=0.03
- s07032 | cloudflare | POST unrevoke-registrations | Unrevoke registrations
  Sonnet x (low): g restores device access
  p: accessChange=0.4 handsOver=0.17 outside=0.01 otherX=0.13
- s03159 | apple.com | POST betaTesters-builds-create_to_many_relationship | 
  Sonnet x (low): g grants tester build access
  p: accessChange=0.46 handsOver=0.24 outside=0.02 otherX=0.05
- s02997 | github | PUT actions/add-selected-repo-to-required-workflow | Add a repository to a required workflow
  Sonnet x (low): e triggers workflows on repo
  p: accessChange=0.37 handsOver=0.08 outside=0.02 otherX=0.04

## group_id=G11 | direction=jevW-sonX | question=otherX | sonnet_confidence=high | rows=74 | distinct_providers=29 | top5_providers=amazonaws.com:14;microsoft.com:14;googleapis.com:10;twilio:4;adyen:2 | methods=POST:61;GET:6;PATCH:4;DELETE:2;PUT:1

- s08903 | adyen | POST post-payments-details | Submit details for a payment
  Sonnet x (high): d payment details
  p: accessChange=0.01 handsOver=0.04 outside=0.02 otherX=0.4
- s02934 | twilio.com | POST UpdateRoomParticipantAnonymize | 
  Sonnet x (high): a anonymizes data irreversibly
  p: accessChange=0.09 handsOver=0.04 outside=0.02 otherX=0.42
- s11447 | twilio | POST CreateSiprec | Create a Siprec
  Sonnet x (high): c streams call audio outside
  p: accessChange=0.01 handsOver=0.05 outside=0.2 otherX=0.24
- s04116 | microsoft.com | POST groups.group.calendar.calendarView.event.exceptionOccurrences.event.tentativelyAccept | Invoke action tentativelyAccept
  Sonnet x (high): c sends response to organizer
  p: accessChange=0.02 handsOver=0.03 outside=0.02 otherX=0.28
- s13029 | googleapis.com | POST drive.changes.watch | 
  Sonnet x (high): c subscription sends events outside
  p: accessChange=0.02 handsOver=0.29 outside=0.35 otherX=0.41
- s13917 | microsoft.com | POST users.CreateEvents | Create Event
  Sonnet x (high): c event invites delivered
  p: accessChange=0.07 handsOver=0.03 outside=0.03 otherX=0.2
- s07674 | googleapis.com | POST batch.projects.locations.jobs.create | 
  Sonnet x (high): e creates running job
  p: accessChange=0.02 handsOver=0.04 outside=0.06 otherX=0.29
- s01127 | microsoft.com | POST me.calendar.events.event.instances.event.tentativelyAccept | Invoke action tentativelyAccept
  Sonnet x (high): c sends response to organizer
  p: accessChange=0.02 handsOver=0.03 outside=0.02 otherX=0.32
- s07770 | telnyx.com | PATCH updatePortoutRequest | Update Status
  Sonnet x (high): d authorize or reject portout
  p: accessChange=0.08 handsOver=0.03 outside=0.02 otherX=0.24
- s10065 | googleapis.com | POST youtube.liveBroadcasts.transition | 
  Sonnet x (high): c broadcast goes live publicly
  p: accessChange=0.01 handsOver=0.02 outside=0.02 otherX=0.33

## group_id=G12 | direction=jevX-sonR | question=handsOver | sonnet_confidence=low | rows=43 | distinct_providers=28 | top5_providers=azure.com:4;docusign:4;amazonaws.com:2;apideck.com:2;cloudflare:2 | methods=GET:23;POST:20

- s06358 | slack | GET rtm_connect | 
  Sonnet r (low): starts session no change
  p: accessChange=0.02 handsOver=0.85 outside=0.06 otherX=0.58
- s11555 | codat.io | GET get-sync-flow-url | Retrieve sync flow url
  Sonnet r (low): returns URL
  p: accessChange=0.03 handsOver=0.96 outside=0.27 otherX=0.4
- s10585 | envoice.in | GET PaymentLinkApi_All | Create a payment link
  Sonnet r (low): list read
  p: accessChange=0.03 handsOver=0.61 outside=0.11 otherX=0.3
- s00226 | apideck.com | GET connectionsCallback | Callback
  Sonnet r (low): GET callback verifies state
  p: accessChange=0.45 handsOver=0.54 outside=0.05 otherX=0.17
- s08962 | twilio.com | POST CreateInsightsSession | 
  Sonnet r (low): returns session details
  p: accessChange=0.03 handsOver=0.95 outside=0.02 otherX=0.06
- s12046 | docusign.net | POST Views_PostEnvelopeEditView | Returns a URL to the edit view UI.
  Sonnet r (low): returns one time URL only
  p: accessChange=0.25 handsOver=0.99 outside=0.42 otherX=0.61
- s12523 | docusign.net | POST Views_PostEnvelopeSenderView | Returns a URL to the sender view UI.
  Sonnet r (low): returns URL only
  p: accessChange=0.04 handsOver=0.91 outside=0.04 otherX=0.55
- s09771 | smart-me.com | GET Account_Login | 
  Sonnet r (low): login read-like
  p: accessChange=0.08 handsOver=0.84 outside=0.02 otherX=0.12
- s02431 | openlinksw.com | GET login | Login
  Sonnet r (low): login returns session only
  p: accessChange=0.13 handsOver=0.99 outside=0.01 otherX=0.18
- s10718 | workos.com | POST UserlandSsoController_deviceAuthorization | Get device authorization URL
  Sonnet r (low): returns device code only
  p: accessChange=0.27 handsOver=0.77 outside=0.12 otherX=0.36

## group_id=G13 | direction=jevX-sonW | question=accessChange+narrow | sonnet_confidence=high | rows=39 | distinct_providers=10 | top5_providers=amazonaws.com:16;microsoft.com:8;asana:5;appcenter.ms:2;box:2 | methods=POST:29;GET:8;PUT:2

- s00230 | slack | POST conversations_kick | 
  Sonnet w (high): remove member on POST
  p: accessChange=0.96 handsOver=0.02 outside=0.01 otherX=0.64
- s12714 | amazonaws.com | POST DisassociatePersonasFromEntities | 
  Sonnet w (high): narrowing permissions
  p: accessChange=0.99 handsOver=0.04 outside=0.01 otherX=0.64
- s07889 | amazonaws.com | POST DeregisterDelegatedAdministrator | 
  Sonnet w (high): narrowing delegated admin
  p: accessChange=0.97 handsOver=0.03 outside=0.01 otherX=0.5
- s04757 | slack | POST admin_usergroups_removeChannels | 
  Sonnet w (high): removes channels narrowing
  p: accessChange=0.88 handsOver=0.03 outside=0.01 otherX=0.66
- s12898 | microsoft.com | POST privilegedRoleAssignmentRequests.privilegedRoleAssignmentRequest.roleInfo.selfDeactivate | Invoke action selfDeactivate
  Sonnet w (high): deactivate own role narrows
  p: accessChange=0.97 handsOver=0.04 outside=0.01 otherX=0.51
- s09255 | amazonaws.com | POST AdminRemoveUserFromGroup | 
  Sonnet w (high): remove from group POST narrows
  p: accessChange=0.99 handsOver=0.04 outside=0.01 otherX=0.58
- s05290 | microsoft.com | POST privilegedApproval.privilegedApproval.roleInfo.selfDeactivate | Invoke action selfDeactivate
  Sonnet w (high): narrows own role
  p: accessChange=0.97 handsOver=0.04 outside=0.01 otherX=0.51
- s03508 | microsoft.com | POST admin.windows.updates.deploymentAudiences.deploymentAudience.exclusions.updatableAsset.removeMembers | Invoke action removeMembers
  Sonnet w (high): removes members on POST narrowing
  p: accessChange=0.65 handsOver=0.03 outside=0.01 otherX=0.61
- s04770 | amazonaws.com | GET GET_DetachUserPolicy | 
  Sonnet w (high): narrows access detach policy
  p: accessChange=0.99 handsOver=0.03 outside=0.01 otherX=0.51
- s08085 | zoomconnect.com | POST /api/rest/v1/groups/{groupId}/removeContact/{contactId} | removeContact
  Sonnet w (high): iii removes contact from group
  p: accessChange=0.96 handsOver=0.02 outside=0.01 otherX=0.68

## group_id=G14 | direction=jevW-sonX | question=outside | sonnet_confidence=low | rows=33 | distinct_providers=23 | top5_providers=alertersystem.com:6;amazonaws.com:3;okta:3;microsoft.com:2;airbyte.local:1 | methods=POST:21;PUT:12

- s02205 | okta | POST verifyEventHook | Verify an event hook
  Sonnet x (low): e triggers outbound verification request
  p: accessChange=0.11 handsOver=0.04 outside=0.31 otherX=0.23
- s07629 | clerk.com | POST CreateEnterpriseConnection | Create an enterprise connection
  Sonnet x (low): g enterprise login connection unsure
  p: accessChange=0.18 handsOver=0.18 outside=0.31 otherX=0.04
- s03334 | visualstudio.com | POST /api/v1/Tokens/subscriptions/{subscriptionId}/resourceGroups/{resourceGroup}/providers/{providerNamespace}/plans/{resourceName}/writeEnvironments | 
  Sonnet x (low): unsure no text
  p: accessChange=0.28 handsOver=0.26 outside=0.3 otherX=0.08
- s02510 | amazonaws.com | POST AddFlowOutputs | 
  Sonnet x (low): c output sends stream out
  p: accessChange=0.01 handsOver=0.03 outside=0.37 otherX=0.03
- s10284 | alertersystem.com | PUT api_transport-mattermost_id_put | Replaces the TransportMattermost resource.
  Sonnet x (low): c changes transport destination
  p: accessChange=0.02 handsOver=0.03 outside=0.37 otherX=0.24
- s04920 | gitlab | PUT putV3ProjectsIdServicesBamboo | Set bamboo service for project
  Sonnet x (low): c integration sends to outside service
  p: accessChange=0.02 handsOver=0.03 outside=0.33 otherX=0.02
- s01732 | alertersystem.com | POST api_transport-twitter_post | Creates a TransportTwitter resource.
  Sonnet x (low): c transport posts to twitter
  p: accessChange=0.02 handsOver=0.06 outside=0.41 otherX=0.04
- s11114 | render.com | PUT update-resource-log-stream | Update log stream override
  Sonnet x (low): c changes log destination
  p: accessChange=0.02 handsOver=0.02 outside=0.2 otherX=0.03
- s04330 | twilio | POST CreateUsageTrigger | Create a new UsageTrigger
  Sonnet x (low): c trigger sends callbacks
  p: accessChange=0.01 handsOver=0.02 outside=0.47 otherX=0.03
- s04102 | sentry | POST Create an External Issue and Link It to an Issue | 
  Sonnet x (low): c creates external issue outside
  p: accessChange=0.02 handsOver=0.06 outside=0.3 otherX=0.2

## group_id=G15 | direction=jevW-sonX | question=handsOver | sonnet_confidence=low | rows=27 | distinct_providers=21 | top5_providers=microsoft.com:4;files.com:3;googleapis.com:2;amazonaws.com:1;apple.com:1 | methods=POST:19;PUT:4;PATCH:3;GET:1

- s05174 | visualstudio.com | POST /api/v1/Tokens/subscriptions/{subscriptionId}/resourceGroups/{resourceGroup}/providers/{providerNamespace}/plans/{resourceName}/readAllEnvironments | 
  Sonnet x (low): b token issue unclear
  p: accessChange=0.18 handsOver=0.29 outside=0.05 otherX=0.12
- s13384 | amazonaws.com | POST RegisterCACertificate | 
  Sonnet x (low): g registers trusted CA
  p: accessChange=0.38 handsOver=0.48 outside=0.02 otherX=0.13
- s06475 | clerk.com | POST CreateSCIMDirectory | Create a directory
  Sonnet x (low): g creates provisioning directory
  p: accessChange=0.21 handsOver=0.32 outside=0.03 otherX=0.03
- s09478 | supabase.com | PATCH v1-update-project-signing-key | Update a signing key, mainly its status
  Sonnet x (low): b signing key status change
  p: accessChange=0.43 handsOver=0.45 outside=0.02 otherX=0.12
- s03167 | twilio.com | POST CreateCredentialList | 
  Sonnet x (low): g attaches credential list to trunk
  p: accessChange=0.16 handsOver=0.23 outside=0.02 otherX=0.02
- s03731 | microsoft.com | POST app.calls.CreateParticipants | Create new navigation property to participants for app
  Sonnet x (low): c adds participants to call
  p: accessChange=0.25 handsOver=0.49 outside=0.02 otherX=0.02
- s03047 | files.com | POST PostBundleRecipients | Create Bundle Recipient
  Sonnet x (low): c bundle recipient gets access or email
  p: accessChange=0.26 handsOver=0.42 outside=0.05 otherX=0.04
- s07955 | stripe | POST PostPaymentLinks | Create a payment link
  Sonnet x (low): c public payment link
  p: accessChange=0.03 handsOver=0.45 outside=0.05 otherX=0.1
- s13140 | microsoft.com | POST users.pendingAccessReviewInstances.decisions.instance.CreateContactedReviewers | Create new navigation property to contactedReviewers for users
  Sonnet x (low): c contacts reviewers
  p: accessChange=0.22 handsOver=0.32 outside=0.02 otherX=0.18
- s11588 | microsoft.com | POST deviceManagement.embeddedSIMActivationCodePools.embeddedSIMActivationCodePool.assign | Invoke action assign
  Sonnet x (low): g assigns activation codes
  p: accessChange=0.13 handsOver=0.39 outside=0.01 otherX=0.38

## group_id=G16 | direction=jevX-sonR | question=otherX | sonnet_confidence=high | rows=26 | distinct_providers=11 | top5_providers=payrun.io:16;bigoven.com:1;bunq.com:1;github.com:1;meshery.local:1 | methods=GET:25;POST:1

- s00244 | payrun.io | GET GetPayDashboardPayslipReportOuput | Runs the Pay Dashboard payslips report
  Sonnet r (high): runs report returns result
  p: accessChange=0.01 handsOver=0.02 outside=0.01 otherX=0.7
- s10201 | bunq.com | GET List_all_TransferwiseTransfer_for_User_TransferwiseQuote | 
  Sonnet r (high): GET list read
  p: accessChange=0.01 handsOver=0.06 outside=0.09 otherX=0.52
- s03139 | payrun.io | GET GetEmployerSummaryReportOuput | Runs the employer summary report
  Sonnet r (high): returns report result
  p: accessChange=0.01 handsOver=0.02 outside=0.01 otherX=0.63
- s09329 | pdfblocks.com | POST removePasswordV1 | Remove the password from a PDF
  Sonnet r (high): returns converted doc
  p: accessChange=0.31 handsOver=0.19 outside=0.01 otherX=0.91
- s04589 | staging-ecotaco.com | GET Cancel fee of a Ride | Cancel fee of a Ride
  Sonnet r (high): read GET
  p: accessChange=0.01 handsOver=0.02 outside=0.01 otherX=0.79
- s13818 | payrun.io | GET GetLastPayDateReportOuput | Runs the last pay date report
  Sonnet r (high): GET report result
  p: accessChange=0.01 handsOver=0.02 outside=0.01 otherX=0.66
- s05327 | payrun.io | GET GetPensionLiabilityReportOutput | Runs the pension liability report
  Sonnet r (high): runs report read only
  p: accessChange=0.01 handsOver=0.02 outside=0.01 otherX=0.72
- s08728 | bigoven.com | GET Me_Index | Indexes this instance.
  Sonnet r (high): GET read
  p: accessChange=0.02 handsOver=0.03 outside=0.02 otherX=0.5
- s05710 | payrun.io | GET GetActivePayInstructionsReportOutput | Runs the active pay instructions report
  Sonnet r (high): report read
  p: accessChange=0.01 handsOver=0.02 outside=0.01 otherX=0.7
- s08243 | swagger.io | GET downloadFile | Downloads a pre-generated file
  Sonnet r (high): read download
  p: accessChange=0.02 handsOver=0.05 outside=0.01 otherX=0.79

## group_id=G17 | direction=jevW-sonX | question=none | sonnet_confidence=low | rows=23 | distinct_providers=12 | top5_providers=googleapis.com:4;microsoft.com:4;amazonaws.com:3;azure.com:2;files.com:2 | methods=POST:21;DELETE:1;PUT:1

- s11307 | github | DELETE migrations/unlock-repo-for-org | Unlock an organization repository
  Sonnet x (low): DELETE method wins
  p: accessChange=0.16 handsOver=0.02 outside=0.01 otherX=0.17
- s11113 | files.com | POST PostRequests | Create Request
  Sonnet x (low): c request likely sent to people
  p: accessChange=0.02 handsOver=0.03 outside=0.02 otherX=0.03
- s03933 | openchannel.io | POST /apps/{appId}/live | Change the live app to another, previously approved version
  Sonnet x (low): c publishes live version
  p: accessChange=0.01 handsOver=0.03 outside=0.02 otherX=0.16
- s05962 | amazonaws.com | POST CreateVpcPeeringConnection | 
  Sonnet x (low): g peering opens network access
  p: accessChange=0.18 handsOver=0.04 outside=0.05 otherX=0.11
- s08847 | googleapis.com | POST monitoring.locations.global.metricsScopes.projects.create | 
  Sonnet x (low): g adds project to scope
  p: accessChange=0.04 handsOver=0.15 outside=0.03 otherX=0.03
- s13479 | microsoft.com | POST deviceManagement.mobileAppTroubleshootingEvents.CreateAppLogCollectionRequests | Create new navigation property to appLogCollectionRequests for deviceManagement
  Sonnet x (low): e triggers log collection
  p: accessChange=0.02 handsOver=0.04 outside=0.07 otherX=0.19
- s02089 | microsoft.com | POST groups.group.calendar.calendarView.event.instances.event.exceptionOccurrences.event.accept | Invoke action accept
  Sonnet x (low): c sends response to organizer
  p: accessChange=0.03 handsOver=0.02 outside=0.01 otherX=0.14
- s08340 | amazonaws.com | POST POST_ModifyVpcPeeringConnectionOptions | 
  Sonnet x (low): g enables peering communication
  p: accessChange=0.14 handsOver=0.02 outside=0.02 otherX=0.02
- s01308 | stripe.com | POST PostSubscriptionItemsSubscriptionItemUsageRecords | 
  Sonnet x (low): d billing usage record
  p: accessChange=0.01 handsOver=0.02 outside=0.01 otherX=0.08
- s12119 | azure.com | PUT Remediations_CreateOrUpdateAtResourceGroup | 
  Sonnet x (low): e remediation runs tasks
  p: accessChange=0.08 handsOver=0.02 outside=0.02 otherX=0.1

## group_id=G18 | direction=jevX-sonR | question=otherX | sonnet_confidence=low | rows=23 | distinct_providers=15 | top5_providers=payrun.io:5;amazonaws.com:2;osisoft.com:2;pdfblocks.com:2;telnyx.com:2 | methods=GET:19;POST:4

- s04808 | payrun.io | GET GetReportOutput | Runs the specified report definition
  Sonnet r (low): returns report result read
  p: accessChange=0.01 handsOver=0.01 outside=0.01 otherX=0.87
- s00126 | citrixonline.com | GET /meetings/{meetingId}/start | Start meeting
  Sonnet r (low): returns URL only
  p: accessChange=0.03 handsOver=0.6 outside=0.03 otherX=0.89
- s09604 | microsoft.com | POST drives.drive.items.driveItem.workbook.application.calculate | Invoke action calculate
  Sonnet r (low): recalculation only
  p: accessChange=0.01 handsOver=0.01 outside=0.01 otherX=0.5
- s01430 | telnyx.com | GET getUsageReportSync_1 | 
  Sonnet r (low): generates and returns report
  p: accessChange=0.01 handsOver=0.02 outside=0.01 otherX=0.81
- s00066 | osisoft.com | GET StreamSet_GetChannelAdHoc | Opens a channel that will send messages about any value changes for the specified streams.
  Sonnet r (low): opens read channel
  p: accessChange=0.02 handsOver=0.09 outside=0.14 otherX=0.58
- s07328 | telnyx.com | GET getUsageAggregationsSync | 
  Sonnet r (low): generates and returns aggregations
  p: accessChange=0.01 handsOver=0.01 outside=0.01 otherX=0.76
- s10441 | amazonaws.com | GET GET_GenerateServiceLastAccessedDetails | 
  Sonnet r (low): generates report read
  p: accessChange=0.02 handsOver=0.03 outside=0.02 otherX=0.56
- s14205 | azure.com | GET ProductDeployments_List | 
  Sonnet r (low): GET list despite odd summary
  p: accessChange=0.02 handsOver=0.02 outside=0.03 otherX=0.82
- s08717 | superset.apache.local | GET /chart/{pk}/cache_screenshot/ | 
  Sonnet r (low): computes cache screenshot
  p: accessChange=0.01 handsOver=0.01 outside=0.01 otherX=0.6
- s05613 | maif.local | GET health | Return current Otoroshi health
  Sonnet r (low): GET health read
  p: accessChange=0.03 handsOver=0.03 outside=0.01 otherX=0.5

## group_id=G19 | direction=jevX-sonW | question=accessChange+narrow | sonnet_confidence=low | rows=23 | distinct_providers=12 | top5_providers=amazonaws.com:10;appcenter:2;cloudflare:2;discord:1;github:1 | methods=POST:12;GET:8;PUT:2;DELETE:1

- s03792 | appcenter | POST distributionGroups_bulkDeleteUsers | 
  Sonnet w (low): removes list items on POST
  p: accessChange=0.99 handsOver=0.02 outside=0.01 otherX=0.91
- s10943 | amazonaws.com | POST DisassociateMembers | 
  Sonnet w (low): narrows membership
  p: accessChange=0.99 handsOver=0.03 outside=0.01 otherX=0.51
- s07697 | amazonaws.com | POST DisassociateMember | 
  Sonnet w (low): narrows admin association
  p: accessChange=0.97 handsOver=0.03 outside=0.01 otherX=0.52
- s01795 | amazonaws.com | GET GET_RevokeSnapshotAccess | 
  Sonnet w (low): narrows access
  p: accessChange=0.99 handsOver=0.03 outside=0.01 otherX=0.72
- s10339 | googleapis.com | POST cloudchannel.accounts.unregister | 
  Sonnet w (low): narrows subscriber access
  p: accessChange=0.93 handsOver=0.04 outside=0.05 otherX=0.92
- s03484 | discord | POST bulk_ban_users_from_guild | 
  Sonnet w (low): toggle ban has unban
  p: accessChange=0.92 handsOver=0.03 outside=0.01 otherX=0.6
- s05574 | microsoft.com | POST admin.windows.updates.deployments.deployment.audience.members.updatableAsset.removeMembers | Invoke action removeMembers
  Sonnet w (low): iii removes assets from group
  p: accessChange=0.82 handsOver=0.02 outside=0.01 otherX=0.72
- s01666 | cloudflare | PUT custom-indicator-feeds-remove-permission | Revoke permission to indicator feed
  Sonnet w (low): narrows permission on PUT
  p: accessChange=0.99 handsOver=0.03 outside=0.02 otherX=0.59
- s05791 | appcenter | POST distributionGroups_removeUser | 
  Sonnet w (low): removes members re-addable
  p: accessChange=0.99 handsOver=0.02 outside=0.01 otherX=0.75
- s11489 | zoomconnect.com | GET /api/rest/v1/groups/{groupId}/removeContact/{contactId} | removeContact
  Sonnet w (low): removes contact from group re-addable
  p: accessChange=0.96 handsOver=0.02 outside=0.01 otherX=0.72

## group_id=G20 | direction=jevW-sonX | question=accessChange | sonnet_confidence=high | rows=18 | distinct_providers=8 | top5_providers=amazonaws.com:5;googleapis.com:4;microsoft.com:3;azure.com:2;appcenter.ms:1 | methods=POST:13;PUT:3;GET:1;PATCH:1

- s01077 | azure.com | PUT ExpressRouteCircuitAuthorizations_CreateOrUpdate | 
  Sonnet x (high): g creates authorization key
  p: accessChange=0.37 handsOver=0.1 outside=0.03 otherX=0.04
- s08114 | googleapis.com | PATCH orgpolicy.projects.policies.patch | 
  Sonnet x (high): g policy overwrite widen unclear
  p: accessChange=0.44 handsOver=0.03 outside=0.02 otherX=0.22
- s08100 | googleapis.com | POST orgpolicy.projects.policies.create | 
  Sonnet x (high): g policy widen unclear
  p: accessChange=0.42 handsOver=0.04 outside=0.02 otherX=0.02
- s01400 | googleapis.com | POST managedidentities.projects.locations.global.domains.attachTrust | 
  Sonnet x (high): g adds trust
  p: accessChange=0.23 handsOver=0.15 outside=0.03 otherX=0.13
- s03432 | microsoft.com | POST deviceManagement.virtualEndpoint.userSettings.cloudPcUserSetting.assign | Invoke action assign
  Sonnet x (high): g assigns setting to groups
  p: accessChange=0.43 handsOver=0.19 outside=0.01 otherX=0.09
- s08848 | amazonaws.com | POST ConfirmTransitVirtualInterface | 
  Sonnet x (high): d accepts ownership commit
  p: accessChange=0.44 handsOver=0.06 outside=0.1 otherX=0.31
- s10010 | permit.io | POST create_relationship_tuple | Create Relationship Tuple
  Sonnet x (high): g creates access relationship tuple
  p: accessChange=0.35 handsOver=0.06 outside=0.01 otherX=0.02
- s13498 | amazonaws.com | POST AssociateQualificationWithWorker | 
  Sonnet x (high): g gives worker qualification
  p: accessChange=0.39 handsOver=0.09 outside=0.01 otherX=0.35
- s13884 | azure.com | PUT RegistrationDefinitions_CreateOrUpdate | 
  Sonnet x (high): g registration delegates access
  p: accessChange=0.2 handsOver=0.06 outside=0.08 otherX=0.03
- s03524 | amazonaws.com | GET GET_AddClientIDToOpenIDConnectProvider | 
  Sonnet x (high): g trusts new client ID
  p: accessChange=0.43 handsOver=0.25 outside=0.03 otherX=0.05

## group_id=G21 | direction=jevX-sonW | question=otherX+narrow | sonnet_confidence=high | rows=18 | distinct_providers=12 | top5_providers=amazonaws.com:4;magento.com:2;microsoft.com:2;pagerduty:2;asana:1 | methods=POST:15;PUT:2;GET:1

- s03841 | microsoft.com | POST admin.windows.updates.updatableAssets.updatableAsset.removeMembersById | Invoke action removeMembersById
  Sonnet w (high): removes members from group on POST
  p: accessChange=0.7 handsOver=0.02 outside=0.01 otherX=0.72
- s02171 | amazonaws.com | PUT RemoveThingFromBillingGroup | 
  Sonnet w (high): removes item from list
  p: accessChange=0.51 handsOver=0.02 outside=0.01 otherX=0.53
- s11121 | square | POST UnlinkCustomerFromGiftCard | UnlinkCustomerFromGiftCard
  Sonnet w (high): iii unlinks customer
  p: accessChange=0.28 handsOver=0.02 outside=0.01 otherX=0.65
- s00604 | pagerduty | POST unsubscribeUserNotificationSubscriptions | Remove Notification Subscriptions
  Sonnet w (high): narrows subscriptions
  p: accessChange=0.1 handsOver=0.02 outside=0.04 otherX=0.59
- s12099 | microsoft.com | POST admin.windows.updates.deployments.deployment.audience.exclusions.updatableAsset.removeMembersById | Invoke action removeMembersById
  Sonnet w (high): removes member via POST
  p: accessChange=0.6 handsOver=0.02 outside=0.01 otherX=0.61
- s03922 | googleapis.com | POST managedidentities.projects.locations.global.domains.detachTrust | 
  Sonnet w (high): toggle detach
  p: accessChange=0.47 handsOver=0.03 outside=0.02 otherX=0.76
- s02183 | amazonaws.com | POST POST_RemoveClientIDFromOpenIDConnectProvider | 
  Sonnet w (high): narrowing removal on POST
  p: accessChange=0.59 handsOver=0.04 outside=0.02 otherX=0.6
- s06970 | meraki.com | POST removeNetworkDevice | Remove a single device
  Sonnet w (high): removes item has add
  p: accessChange=0.1 handsOver=0.01 outside=0.01 otherX=0.93
- s06658 | magento.com | POST sharedCatalogCategoryManagementV1UnassignCategoriesPost | sharedCatalog/{id}/unassignCategories
  Sonnet w (high): POST removes item from list
  p: accessChange=0.27 handsOver=0.02 outside=0.01 otherX=0.56
- s12793 | telnyx.com | POST RemoveSIMCardGroupPrivateWirelessGateway | Request Private Wireless Gateway removal from SIM card group
  Sonnet w (high): remove one item
  p: accessChange=0.02 handsOver=0.01 outside=0.05 otherX=0.86

## group_id=G22 | direction=jevX-sonW | question=otherX+narrow | sonnet_confidence=low | rows=15 | distinct_providers=8 | top5_providers=amazonaws.com:8;digitalocean:1;googleapis.com:1;hetzner.cloud:1;keycloak:1 | methods=POST:11;GET:3;PUT:1

- s14389 | keycloak | POST /{realm}/user-storage/{id}/unlink-users | Unlink imported users from a storage provider
  Sonnet w (low): unlink users
  p: accessChange=0.45 handsOver=0.04 outside=0.01 otherX=0.69
- s08787 | googleapis.com | POST compute.firewallPolicies.removeAssociation | 
  Sonnet w (low): removes association
  p: accessChange=0.54 handsOver=0.02 outside=0.02 otherX=0.64
- s03982 | amazonaws.com | GET GET_RejectTransitGatewayMulticastDomainAssociations | 
  Sonnet w (low): reject request can be redone
  p: accessChange=0.37 handsOver=0.02 outside=0.01 otherX=0.54
- s10277 | amazonaws.com | POST DisassociateConnector | 
  Sonnet w (low): disassociate detach
  p: accessChange=0.05 handsOver=0.02 outside=0.02 otherX=0.51
- s13052 | amazonaws.com | POST ScheduleKeyDeletion | 
  Sonnet w (low): schedule deletion cancellable
  p: accessChange=0.15 handsOver=0.04 outside=0.01 otherX=0.54
- s10644 | amazonaws.com | GET GET_RemoveClientIDFromOpenIDConnectProvider | 
  Sonnet w (low): narrows removes client ID
  p: accessChange=0.51 handsOver=0.03 outside=0.02 otherX=0.66
- s07094 | amazonaws.com | GET GET_RejectVpcEndpointConnections | 
  Sonnet w (low): rejection narrowing
  p: accessChange=0.52 handsOver=0.02 outside=0.01 otherX=0.57
- s12485 | keycloak.local | POST /{realm}/user-storage/{id}/unlink-users | Unlink imported users from a storage provider
  Sonnet w (low): unlink users re-linkable
  p: accessChange=0.49 handsOver=0.04 outside=0.01 otherX=0.66
- s13629 | hetzner.cloud | POST /firewalls/{id}/actions/remove_from_resources | Remove from Resources
  Sonnet w (low): detach has attach
  p: accessChange=0.36 handsOver=0.02 outside=0.01 otherX=0.72
- s12651 | digitalocean | POST images_post_account_transfer_cancel | Cancel an Image Account Transfer
  Sonnet w (low): cancel can restart
  p: accessChange=0.52 handsOver=0.02 outside=0.01 otherX=0.77

## group_id=G23 | direction=jevW-sonX | question=accessChange+narrow | sonnet_confidence=low | rows=8 | distinct_providers=7 | top5_providers=amazonaws.com:2;keycloak:1;keycloak.local:1;mailchimp:1;slack:1 | methods=POST:3;PUT:3;DELETE:1;GET:1

- s02241 | keycloak | PUT /{realm}/users/{id}/disable-credential-types | Disable all credentials for a user of a specific type
  Sonnet x (low): b disables user credentials
  p: accessChange=0.75 handsOver=0.11 outside=0.01 otherX=0.47
- s03005 | amazonaws.com | GET GET_RejectDataShare | 
  Sonnet x (low): rejects datashare unsure no named reverse
  p: accessChange=0.88 handsOver=0.02 outside=0.01 otherX=0.4
- s06578 | whatsapp.local | POST LeaveGroup | Leave-Group
  Sonnet x (low): f leaving group cannot rejoin freely
  p: accessChange=0.98 handsOver=0.02 outside=0.01 otherX=0.44
- s07149 | zuora.com | PUT PUT_EntityConnectionsDeny | Multi-entity: Deny a connection request
  Sonnet x (low): f denied request state
  p: accessChange=0.83 handsOver=0.03 outside=0.01 otherX=0.4
- s09912 | keycloak.local | PUT /{realm}/users/{id}/disable-credential-types | Disable all credentials for a user of a specific type
  Sonnet x (low): b disables credentials no enable
  p: accessChange=0.7 handsOver=0.14 outside=0.01 otherX=0.46
- s10351 | amazonaws.com | POST DisassociateIpGroups | 
  Sonnet x (low): g removes IP restriction
  p: accessChange=0.86 handsOver=0.02 outside=0.01 otherX=0.21
- s10546 | mailchimp | DELETE deleteListsIdMembersId | Archive list member
  Sonnet x (low): a DELETE no restore named
  p: accessChange=0.78 handsOver=0.02 outside=0.01 otherX=0.31
- s14595 | slack | POST admin_conversations_disconnectShared | 
  Sonnet x (low): a disconnect channel
  p: accessChange=0.95 handsOver=0.03 outside=0.02 otherX=0.28

## group_id=G24 | direction=jevX-sonR | question=handsOver | sonnet_confidence=high | rows=8 | distinct_providers=6 | top5_providers=adyen:2;sentry:2;azure.com:1;cloudflare:1;contentgroove.com:1 | methods=GET:6;POST:2

- s00174 | azure.com | POST Sites_GetSiteBackupStatusSecrets | Gets status of a web app backup that may be in progress, including secrets associated with the backu
  Sonnet r (high): reads backup status
  p: accessChange=0.26 handsOver=0.97 outside=0.07 otherX=0.21
- s00255 | adyen | POST post-applePay-sessions | Get an Apple Pay session
  Sonnet r (high): returns session data
  p: accessChange=0.01 handsOver=0.94 outside=0.03 otherX=0.22
- s01862 | sentry | GET listProjectKeys | List a Project's Client Keys
  Sonnet r (high): list read
  p: accessChange=0.01 handsOver=0.65 outside=0.01 otherX=0.01
- s05519 | sentry | GET getProjectKey | Retrieve a Client Key
  Sonnet r (high): GET read
  p: accessChange=0.01 handsOver=0.72 outside=0.01 otherX=0.01
- s07879 | adyen | GET get-storedPaymentMethods | Get tokens for stored payment details
  Sonnet r (high): GET lists tokens
  p: accessChange=0.01 handsOver=0.89 outside=0.01 otherX=0.01
- s08121 | cloudflare | GET secrets-store-get-by-id | Get a secret by ID
  Sonnet r (high): GET reads secret
  p: accessChange=0.01 handsOver=0.57 outside=0.01 otherX=0.01
- s09202 | linode | GET get-managed-credential | Get a managed credential
  Sonnet r (high): GET read
  p: accessChange=0.01 handsOver=0.54 outside=0.01 otherX=0.01
- s14630 | contentgroove.com | GET /api/v1/direct_uploads | prepare presigned upload url
  Sonnet r (high): GET prepares upload url only
  p: accessChange=0.04 handsOver=0.86 outside=0.23 otherX=0.1

## group_id=G25 | direction=jevW-sonX | question=outside | sonnet_confidence=high | rows=7 | distinct_providers=5 | top5_providers=googleapis.com:3;amazonaws.com:1;codat.io:1;twilio:1;xtrf.eu:1 | methods=POST:7

- s01183 | googleapis.com | POST directory.users.aliases.watch | 
  Sonnet x (high): c watch pushes events out
  p: accessChange=0.04 handsOver=0.08 outside=0.24 otherX=0.21
- s05918 | twilio | POST CreateStream | Create a Stream
  Sonnet x (high): c stream leaves system
  p: accessChange=0.01 handsOver=0.04 outside=0.41 otherX=0.41
- s06750 | amazonaws.com | POST PutEventStream | 
  Sonnet x (high): c event stream leaves system
  p: accessChange=0.02 handsOver=0.04 outside=0.37 otherX=0.09
- s07097 | codat.io | POST create-bank-transactions | Create bank transactions
  Sonnet x (high): e pushes to accounting package
  p: accessChange=0.01 handsOver=0.01 outside=0.44 otherX=0.42
- s09645 | xtrf.eu | POST subscribe | Subscribe to event
  Sonnet x (high): c creates subscription sending events
  p: accessChange=0.11 handsOver=0.13 outside=0.47 otherX=0.21
- s11230 | googleapis.com | POST mirror.subscriptions.insert | 
  Sonnet x (high): c subscription sends to callback
  p: accessChange=0.11 handsOver=0.1 outside=0.26 otherX=0.07
- s13169 | googleapis.com | POST logging.entries.copy | 
  Sonnet x (high): e runs copy job
  p: accessChange=0.01 handsOver=0.02 outside=0.4 otherX=0.32

## group_id=G26 | direction=jevW-sonX | question=otherX+narrow | sonnet_confidence=high | rows=5 | distinct_providers=5 | top5_providers=github:1;just-eat.co.uk:1;tvmaze.com:1;twitter.com:1;x:1 | methods=DELETE:5

- s00286 | x | DELETE unfollowList | Unfollow a List
  Sonnet x (high): a DELETE method wins
  p: accessChange=0.28 handsOver=0.02 outside=0.01 otherX=0.31
- s01757 | twitter.com | DELETE listUserUnfollow | Unfollow a List
  Sonnet x (high): DELETE method wins
  p: accessChange=0.27 handsOver=0.02 outside=0.01 otherX=0.3
- s04143 | tvmaze.com | DELETE /user/follows/shows/{show_id} | Unfollow a show
  Sonnet x (high): DELETE no trash
  p: accessChange=0.06 handsOver=0.02 outside=0.01 otherX=0.35
- s07336 | just-eat.co.uk | DELETE /consumers/{tenant}/me/communication-preferences/{type}/subscribedChannels/{channel} | Remove subscription of a specific communication preference channel
  Sonnet x (high): DELETE no trash
  p: accessChange=0.03 handsOver=0.02 outside=0.03 otherX=0.47
- s14717 | github | DELETE orgs/disable-selected-repository-immutable-releases-organization | Disable a selected repository for immutable releases in an organization
  Sonnet x (high): a DELETE no restore named
  p: accessChange=0.34 handsOver=0.02 outside=0.01 otherX=0.41

## group_id=G27 | direction=jevW-sonX | question=handsOver | sonnet_confidence=high | rows=3 | distinct_providers=3 | top5_providers=mastercard.com:1;microsoft.com:1;polar.sh:1 | methods=POST:3

- s08431 | mastercard.com | POST /fraud/merchant/v3/add-merchant | Used by Acquirers to add a terminated a merchant in the MATCH system. Merchant information, and up t
  Sonnet x (high): c publishes merchant listing to outside system
  p: accessChange=0.04 handsOver=0.22 outside=0.02 otherX=0.15
- s09957 | polar.sh | POST customer-seats:assign_seat | Assign Seat
  Sonnet x (high): g assigns seat right
  p: accessChange=0.15 handsOver=0.26 outside=0.01 otherX=0.05
- s10912 | microsoft.com | POST education.classes.CreateRefTeachers | Create new navigation property ref to teachers for education
  Sonnet x (high): g adds teacher
  p: accessChange=0.29 handsOver=0.49 outside=0.01 otherX=0.02

## group_id=G28 | direction=jevW-sonX | question=otherX+narrow | sonnet_confidence=low | rows=3 | distinct_providers=3 | top5_providers=github:1;okta:1;x:1 | methods=DELETE:2;POST:1

- s03964 | x | DELETE unfollowUser | Unfollow User
  Sonnet x (low): DELETE method no restore named
  p: accessChange=0.11 handsOver=0.02 outside=0.01 otherX=0.37
- s06520 | github | DELETE activity/delete-repo-subscription | Delete a repository subscription
  Sonnet x (low): a DELETE no restore
  p: accessChange=0.03 handsOver=0.02 outside=0.02 otherX=0.29
- s09691 | okta | POST optOutUsersFromOktaCommunicationEmails | Opt out of Okta user communication emails
  Sonnet x (low): b opt out consent change
  p: accessChange=0.08 handsOver=0.04 outside=0.04 otherX=0.2

## group_id=G29 | direction=jevX-sonR | question=outside | sonnet_confidence=low | rows=3 | distinct_providers=3 | top5_providers=apideck.com:1;digitallocker.gov.in:1;httpbin.org:1 | methods=GET:2;PATCH:1

- s00972 | digitallocker.gov.in | GET Get Authorization Code id | Get Authorization Code
  Sonnet r (low): starts auth page flow
  p: accessChange=0.39 handsOver=0.62 outside=0.7 otherX=0.35
- s02773 | apideck.com | GET getProxy | GET
  Sonnet r (low): proxies downstream GET
  p: accessChange=0.03 handsOver=0.46 outside=0.62 otherX=0.49
- s05663 | httpbin.org | PATCH /redirect-to | 302/3XX Redirects to the given URL.
  Sonnet r (low): redirect echo
  p: accessChange=0.02 handsOver=0.02 outside=0.61 otherX=0.26

## group_id=G30 | direction=jevX-sonR | question=outside | sonnet_confidence=high | rows=2 | distinct_providers=2 | top5_providers=httpbin.org:1;nexmo.com:1 | methods=GET:1;PUT:1

- s11595 | nexmo.com | GET getNumberInsightAsync | Advanced Number Insight (async)
  Sonnet r (high): number lookup
  p: accessChange=0.01 handsOver=0.02 outside=0.94 otherX=0.59
- s14420 | httpbin.org | PUT /redirect-to | 302/3XX Redirects to the given URL.
  Sonnet r (high): redirect echo
  p: accessChange=0.02 handsOver=0.02 outside=0.65 otherX=0.31

## group_id=G31 | direction=jevW-sonX | question=accessChange+narrow | sonnet_confidence=high | rows=1 | distinct_providers=1 | top5_providers=github:1 | methods=DELETE:1

- s10257 | github | DELETE agents/remove-selected-repo-from-org-secret | Remove selected repository from an organization secret
  Sonnet x (high): DELETE method no trash
  p: accessChange=0.97 handsOver=0.09 outside=0.01 otherX=0.44

## group_id=G32 | direction=jevX-sonR | question=accessChange | sonnet_confidence=low | rows=1 | distinct_providers=1 | top5_providers=zulip.com:1 | methods=GET:1

- s07456 | zulip.com | GET create-big-blue-button-video-call | Create BigBlueButton video call
  Sonnet r (low): returns call URL
  p: accessChange=0.88 handsOver=0.86 outside=0.17 otherX=0.55

## group_id=G33 | direction=jevX-sonW | question=handsOver+narrow | sonnet_confidence=high | rows=1 | distinct_providers=1 | top5_providers=docusign:1 | methods=POST:1

- s03975 | docusign | POST Lock_PostTemplateLock | Locks a template.
  Sonnet w (high): toggle lock has unlock
  p: accessChange=0.66 handsOver=0.97 outside=0.01 otherX=0.09

## group_id=G34 | direction=son? | question=outside | sonnet_confidence=low | rows=1 | distinct_providers=1 | top5_providers=clever-cloud.com:1 | methods=PUT:1

- s05133 | clever-cloud.com | PUT /vendor/apps/{addonId}/migration_callback | 
  Sonnet ? (low): no text
  p: accessChange=0.03 handsOver=0.06 outside=0.64 otherX=0.44

