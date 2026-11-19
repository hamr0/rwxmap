# D141 relabel: labeller instructions (rwxmap export-v4-d141, 2026-11-19)

You label API operations r, w or x. Read these two files in full first:
1. /home/hamr/PycharmProjects/rwxmap/data/relabel-v4-2026-11-05/BRIEF-v4-addendum-D141.md (read it FIRST; where it conflicts with BRIEF-v4, the addendum wins)
2. /home/hamr/PycharmProjects/rwxmap/data/relabel-v4-2026-11-05/BRIEF-v4.md

The brief and addendum outrank this file. This file only restates the D141 points labellers missed before.

## D141 first: one letter per family

- Login, sign-in or token refresh that returns a session, access or refresh token (your own too): x.
- Verifying an email, an OTP / 2FA / TOTP / SMS code or a verification token: x. PURE CHECKS ARE INCLUDED: "is this token valid", token introspection, "is this email registered", "check access token validity" are all x. This covers login and signup verification only; a business-verification (KYB) lookup or a data-validation check is not this family.
- Generating a working login code (TOTP, OTP, magic link) is x.
- Turning 2FA or MFA OFF, or a toggle/settings edit that can turn it off, is x (it widens who can log in, BRIEF (g)). Turning it on alone is w.
- Storing or setting a credential (OAuth token for a user, registry login, password, secret), or creating a key, certificate or CSR: x (D130, D137).
- Changing a callback URL, a webhook destination, or an LLM or other endpoint setting; ACTIVATING or enabling an endpoint or webhook that sends out; uploading a service or signing key (FCM, APNs .p8); registering a device push token: x.
- Updating a group whose text never mentions members, roles or permissions: w. Adding members or accounts to a group: x.
- Removing members on POST, PUT or PATCH: x, same as DELETE. Narrowing a role or permission without removing a member: w.

## Fine as the brief has them (not raised by D141)

GET login pages and forms, listing or reading sessions or tokens, health or connectivity checks, plain creates that give no login, inbound webhook receivers that only record an event, editing a webhook's name or header without changing where it sends.

## Output

For each row of your part, in the same order, one CSV line: id,letter,confidence,reason
- letter: r, w or x
- confidence: sure, likely or unsure
- reason: under 15 words, your own words for THIS row, no commas (use ;)
First line is the header: id,letter,confidence,reason

Label every row yourself by reading it. Do NOT write or run any script, regex or program to label. Do not read any other file in the repo.
