# BRIEF-v4 addendum, D141 (2026-11-19)

Read this WITH BRIEF-v4. Where they conflict, this addendum wins.

It applies to exam #7 labelling and later. Burned exam truth is never
relabelled by it. Classes stay r < w < x. Five places where BRIEF-v4 was
ambiguous were ruled by the user on 2026-11-19 (D141). One letter per family.

## (a) Login, sign-in, token refresh is x

A login, sign-in or token refresh that returns a session, access or refresh
token is x. This includes your own session. It hands out a working token,
the same as creating a key or token.

- GET /api/login/refresh, "Retrieve a new access token": x
- POST /auth/sign-in, "Sign in by password": x

## (b) Verifying an email, one-time code or token is x

Verifying an email address, a one-time code (OTP, 2FA/TOTP, SMS code) or an
email/verification token is x. This includes pure checks, such as "is this
token valid" or "is this email registered". Login and signup calls are risks
an agent can act on, so the whole family is x.

- POST /user/verify_otp, "Verify OTP.": x
- POST /auth/mfa/verify, "Verify 2FA code during login": x
- POST /users/isUserExist, "Check if email address is already registered": x

## (c) Updating a group is w unless it touches members, roles or permissions

Updating a group whose text never mentions members, roles or permissions is
w, a plain edit. Adding members or accounts to a group stays x under the
existing add-a-member rule.

- PUT /api/groups/{groupId}, "Update group": w
- PATCH /v2/{instanceId}/{applicationId}/groups/{groupId}: w
- POST .../groups/{groupId}/actions/addUsersToGroup: x (adds members)

## (d) Callback, webhook, endpoint config, push credentials are x

Changing a callback URL, a webhook destination, or an LLM or other endpoint
configuration is x. So is uploading a service account key or signing key
(for example Firebase/FCM, APNs .p8), and registering a device push token.
Test: after the call, someone can receive or use something they could not
before (data goes to a new place, a credential is set, a device now receives
the user's notifications).

- PATCH /merchant/callbacks, "Update callback URLs for the merchant": x
- PUT /api/v1/accounts/{account_id}/inboxes/{inbox_id}/app_sdk/push/{provider}, "Upload a Firebase service account (fcm) or an APNs .p8 key": x
- GET /Regdevicetokensns, "Register device token sns": x

## (e) Removing members on POST, PUT or PATCH is x

Removing members on POST, PUT or PATCH is x, the same as on DELETE. This
overrides BRIEF-v4's w for removing a membership on POST/PUT/PATCH, for
memberships only. Narrowing a role or permission without removing a member
stays w. Reason: a removal by PUT should match a removal by DELETE, it can
lock someone out mid-work, and it is the tighter side.

- PUT /api/v1/projects/{ProjectId}/users, "Remove existing users and assign new list of users to a project": x
- PUT /api/admin/zones/id/users, "Add or Delete zone users": x
