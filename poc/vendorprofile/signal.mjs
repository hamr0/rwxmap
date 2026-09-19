// SIGNAL_WORDS: hand-written by reading the build-set pile (data/buildset-2026-09-18/,
// see README.md at that path). Every word here names an object-noun that
// another party depends on (identity/account, access, credential, sharing),
// not a verb and not a generic noun. This list is measured by poc/vendorprofile/run.mjs
// before being trusted for anything; nothing here is adopted on vibes.
//
// This module is pure data. It must never be extended by reading a truth
// label — the profile it feeds (poc/vendorprofile/profile.mjs) reads spec
// text only, never truth_class.

export const SIGNAL_WORDS = [
  // identity / account
  'user', 'users', 'account', 'member', 'members', 'membership', 'memberships',
  'group', 'groups', 'team', 'teams', 'org', 'orgs', 'organization', 'organizations',
  'tenant', 'realm',
  // access
  'role', 'roles', 'permission', 'permissions', 'scope', 'scopes', 'grant', 'grants',
  'policy', 'acl', 'access', 'consent',
  // credential
  'credential', 'credentials', 'token', 'tokens', 'key', 'keys', 'secret', 'secrets',
  'password', 'mfa', 'otp', 'session', 'sessions',
  // sharing
  'share', 'shares', 'shared', 'link', 'links', 'invite', 'invitation', 'invitations',
  'collaborator', 'collaborators', 'visibility', 'public',
].filter((w, i, arr) => arr.indexOf(w) === i);
