# M1-C6 — mechanically admitted lists (layers 2b, 5, 6)

All lists below are derived from CAMARA + hold-out-1 rows only (n = census count, share = truth-x share), never hand-written. Admission bar: n >= 5, x share >= 0.9.

## Layer 2b (revised) — write-family and x-hint-family scope tokens, per method, CAMARA only

```
family:method  n   x_share  outcome     
-------------  --  -------  ------------
write:POST     16  0.938    admitted    
write:PATCH    5   0.200    not admitted
xhint:POST     39  1.000    admitted    
xhint:PATCH    0   n/a      not admitted
```

## Layer 5 — requestBody property-name raisers (CAMARA + hold-out 1)

Full candidate table (n >= 5), sorted by x share:

```
prop                  n   x_share
--------------------  --  -------
protocol              14  1.000  
types                 14  1.000  
subscriptionRequest   9   1.000  
devices               6   1.000  
PhoneNumber           5   1.000  
config                15  0.933  
sink                  34  0.882  
StatusCallback        16  0.875  
StatusCallbackMethod  14  0.857  
sinkCredential        33  0.848  
appId                 6   0.833  
duration              6   0.833  
esimProfile           6   0.833  
AddressSid            5   0.800  
BundleSid             5   0.800  
EmergencyAddressSid   5   0.800  
EmergencyStatus       5   0.800  
IdentitySid           5   0.800  
SmsApplicationSid     5   0.800  
TrunkSid              5   0.800  
VoiceApplicationSid   5   0.800  
VoiceReceiveMode      5   0.800  
VoiceCallerIdLookup   7   0.714  
Status                10  0.700  
VoiceFallbackMethod   9   0.667  
VoiceFallbackUrl      9   0.667  
VoiceMethod           9   0.667  
VoiceUrl              9   0.667  
ApiVersion            8   0.625  
SmsFallbackMethod     8   0.625  
SmsFallbackUrl        8   0.625  
SmsMethod             8   0.625  
SmsUrl                8   0.625  
FriendlyName          31  0.516  
name                  12  0.500  
description           6   0.500  
startTime             5   0.400  
applicationProfileId  6   0.333  
expand                6   0.333  
phoneNumber           28  0.250  
device                37  0.243  
```

Admitted (share >= 0.9): protocol (n=14, share=1.000), types (n=14, share=1.000), subscriptionRequest (n=9, share=1.000), devices (n=6, share=1.000), PhoneNumber (n=5, share=1.000), config (n=15, share=0.933).

Finding: identity-shaped names also clear n >= 5 but do not clear the share bar: FriendlyName (n=31, share=0.516), name (n=12, share=0.500), description (n=6, share=0.500) — reported, not admitted.

M1-C1 named these eight as expected raisers over all 719 rows (holdout2 included); checked here against CAMARA + hold-out 1 only:

- sink: n=34, share=0.882 (below the share bar, not admitted)
- sinkCredential: n=33, share=0.848 (below the share bar, not admitted)
- StatusCallback: n=16, share=0.875 (below the share bar, not admitted)
- subscriptionRequest: n=9, share=1.000 (admitted)
- amount: absent from CAMARA + hold-out 1 entirely (a hold-out-2-only Adyen field per the census — out of scope for admission under the hard rule)
- protocol: n=14, share=1.000 (admitted)
- types: n=14, share=1.000 (admitted)
- merchantAccount: absent from CAMARA + hold-out 1 entirely (a hold-out-2-only Adyen field per the census — out of scope for admission under the hard rule)

## Layer 5 — present-only census flags (CAMARA + hold-out 1)

```
flag                      n   x_share
------------------------  --  -------
callbacks_present         42  0.929  
has202                    52  0.558  
idempotency_header_param  0   n/a    
```

Admitted: callbacks_present.

## Layer 6 — own-vs-other structural facts, PUT/DELETE/PATCH rows (CAMARA + hold-out 1, n_rows = 203)

Full candidate table (n >= 5), sorted by x share:

```
category          key                          n   x_share
----------------  ---------------------------  --  -------
schemaprop        state                        5   0.800  
schemaprop        events_url                   8   0.500  
pathparam         username                     11  0.455  
schemaprop        avatar_url                   7   0.429  
schemaprop        login                        7   0.429  
schemaprop        repos_url                    7   0.429  
schemaprop        owner                        5   0.400  
schemaprop        html_url                     16  0.375  
schemaprop        node_id                      17  0.353  
bodyprop6         expand                       6   0.333  
schemaprop        appId                        6   0.333  
schemaprop        followers_url                6   0.333  
schemaprop        following_url                6   0.333  
schemaprop        gists_url                    6   0.333  
schemaprop        gravatar_id                  6   0.333  
schemaprop        organizations_url            6   0.333  
schemaprop        received_events_url          6   0.333  
schemaprop        site_admin                   6   0.333  
schemaprop        starred_at                   6   0.333  
schemaprop        starred_url                  6   0.333  
schemaprop        subscriptions_url            6   0.333  
schemaprop        user_view_type               6   0.333  
schemaprop        email                        10  0.300  
pathparam         customer                     8   0.250  
schemaprop        currency                     8   0.250  
schemaprop        customer_account             8   0.250  
pathparam         org                          33  0.242  
schemaprop        type                         13  0.231  
schemaprop        url                          35  0.229  
schemaprop        description                  22  0.227  
pathparam         owner                        32  0.219  
pathparam         repo                         32  0.219  
schemaprop        customer                     10  0.200  
pathparam         account                      5   0.200  
schemaprop        account                      5   0.200  
schemaprop        country                      5   0.200  
schemaprop        created                      17  0.176  
schemaprop        data                         6   0.167  
schemaprop        has_more                     6   0.167  
schemaprop        id                           67  0.164  
schemapartyfield  resource_schema_party_field  87  0.161  
partyidparam      party_id_param               56  0.161  
schemaprop        livemode                     14  0.143  
schemaprop        total_count                  14  0.143  
schemaprop        createdAt                    7   0.143  
schemaprop        status                       38  0.132  
schemaprop        name                         40  0.125  
pathparam         repository_id                9   0.111  
schemaprop        sinkCredential               9   0.111  
schemaprop        repositories                 11  0.091  
schemaprop        created_at                   24  0.083  
schemaprop        updated_at                   24  0.083  
schemaprop        object                       26  0.077  
schemaprop        metadata                     14  0.071  
schemaprop        sink                         21  0.048  
schemaprop        uri                          24  0.042  
schemaprop        account_sid                  29  0.034  
schemaprop        date_created                 30  0.033  
schemaprop        date_updated                 30  0.033  
pathparam         AccountSid                   32  0.031  
pathparam         Sid                          31  0.000  
schemaprop        sid                          30  0.000  
schemaprop        expiresAt                    19  0.000  
schemaprop        friendly_name                19  0.000  
schemaprop        config                       15  0.000  
schemaprop        startsAt                     14  0.000  
pathparam         subscriptionId               13  0.000  
schemaprop        protocol                     13  0.000  
schemaprop        types                        13  0.000  
schemaprop        api_version                  12  0.000  
schemaprop        duration                     12  0.000  
pathparam         secret_name                  11  0.000  
pathparam         id                           10  0.000  
schemaprop        subresource_uris             9   0.000  
schemaprop        price                        8   0.000  
schemaprop        price_unit                   7   0.000  
schemaprop        updatedAt                    6   0.000  
pathparam         DomainSid                    5   0.000  
pathparam         knowledgeBaseId              5   0.000  
schemaprop        knowledgeBaseId              5   0.000  
schemaprop        selected_repositories_url    5   0.000  
schemaprop        source                       5   0.000  
schemaprop        visibility                   5   0.000  
```

Admitted: none. This is the expected honest outcome for some of these facts — e.g. party_id_param sits well under the bar because Twilio's AccountSid appears on almost every path, own resource or not, so presence alone does not separate w from x.

