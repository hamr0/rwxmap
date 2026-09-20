// The pre-registered build/exam vendor split, as data — no logic here.
//
// Source of truth: docs/logs/pre-registered-split-2026-09-18.md. The
// original caps (github.com 300, microsoft.com 200, Infinity for the rest
// of the build pile) were amended to a UNIFORM cap of 150 for all 13
// vendors on 2026-09-18 after measurement; the amendment is recorded in
// the "Amendment — 2026-09-18, after measuring the pool" section of that
// doc. A uniform cap equalises vendor weight so leave-one-vendor-out
// scores mean the same thing for each vendor left out. Changing a cap
// here is an amendment to the split doc, never a silent edit — update the
// doc first, with a reason, then this file to match.

/** Vendor -> per-vendor row cap for the build set. Infinity means "take all". */
export const BUILD_CAPS = {
  'github.com': 150,
  'microsoft.com': 150,
  'gitea.io': 150,
  'appcenter.ms': 150,
  'netbox.dev': 150,
  'clearblade.com': 150,
  'keycloak.local': 150,
  'atlassian.com': 150,
  'dracoon.team': 150,
  'trello.com': 150,
  'box.com': 150,
  'gitlab.com': 150,
  'launchdarkly.com': 150,
};

/** The locked exam pile — never read, mined or drawn from by this POC. */
export const EXAM_VENDORS = [
  'auth0',
  'cloudflare',
  'hubspot',
  'zendesk',
  'pagerduty',
  'dropbox',
  'shopify',
  'linear',
  'miro',
  'sentry',
];

/** The 15-provider corpus plus the burned exam — already seen, never re-drawn. */
export const SEEN_VENDORS = [
  'asana',
  'canva',
  'datadog',
  'digitalocean',
  'figma',
  'intercom',
  'jira',
  'mailchimp',
  'meta-whatsapp',
  'openai',
  'paypal',
  'spotify',
  'square',
  'stripe',
  'zoom',
  'okta',
  'docusign',
  'xero',
];

/** Write methods the build set is drawn from — read (GET) is out of scope. */
export const WRITE_METHODS = ['POST', 'PUT', 'DELETE', 'PATCH'];
