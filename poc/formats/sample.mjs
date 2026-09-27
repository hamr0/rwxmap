// Item (b) — draw a seeded, deterministic 200-entry sample from the
// parsed public-apis README, excluding any entry whose docs-link
// registrable domain matches one of the 25 vendors already known from
// the locked spec sets (provider-corpus-2026-09-16, exam-2026-09-17,
// exam-2026-09-20, exam-2026-09-22) — those are not "never looked at".
//
// PRNG: mulberry32, seeded 20260927 (documented, not cryptographic — a
// POC only needs a reproducible shuffle). Run as:
//   node poc/formats/sample.mjs
// writes data/formats-2026-09-27/sample.json.

import { readFileSync, writeFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseEntries } from './parse.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = `${HERE}/../../data/formats-2026-09-27`;
const SEED = 20260927;
const SAMPLE_SIZE = 200;

// Registrable domains of the 25 vendors already used across the locked
// spec sets (from poc/discover/vendors.mjs's derived hosts, host ->
// registrable domain by hand since some hosts are per-customer
// placeholders: {tenant}.auth0.com, subdomain.okta.com, your-domain
// .atlassian.net, example.zendesk.com, server.api.mailchimp.com).
const KNOWN_VENDOR_DOMAINS = new Set([
  'asana.com',
  'auth0.com',
  'canva.com',
  'cloudflare.com',
  'datadoghq.com',
  'digitalocean.com',
  'docusign.net',
  'figma.com',
  'intercom.io',
  'atlassian.net',
  'klaviyo.com',
  'mailchimp.com',
  'facebook.com',
  'miro.com',
  'okta.com',
  'openai.com',
  'pagerduty.com',
  'paypal.com',
  'sentry.io',
  'spotify.com',
  'squareup.com',
  'stripe.com',
  'xero.com',
  'zendesk.com',
  'zoom.us',
]);

const TWO_LEVEL_SUFFIXES = new Set([
  'co.uk', 'org.uk', 'ac.uk', 'gov.uk', 'me.uk', 'net.uk',
  'co.jp', 'co.nz', 'co.in', 'co.za', 'com.au', 'com.br', 'com.cn',
]);

function registrableDomain(host) {
  const labels = host.toLowerCase().split('.');
  if (labels.length <= 2) return host.toLowerCase();
  const lastTwo = labels.slice(-2).join('.');
  if (TWO_LEVEL_SUFFIXES.has(lastTwo) && labels.length >= 3) {
    return labels.slice(-3).join('.');
  }
  return lastTwo;
}

function hostOf(url) {
  try {
    return new URL(url).host;
  } catch {
    return null;
  }
}

// mulberry32: https://gist.github.com/tommyettinger/46a874533244883189143505d203312c
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function seededShuffle(array, seed) {
  const rng = mulberry32(seed);
  const out = array.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export function buildSample() {
  const gz = readFileSync(`${DATA_DIR}/public-apis-README.md.gz`);
  const text = gunzipSync(gz).toString('utf8');
  const entries = parseEntries(text);

  const excluded = [];
  const eligible = [];
  for (const e of entries) {
    const host = hostOf(e.link);
    const domain = host ? registrableDomain(host) : null;
    if (domain && KNOWN_VENDOR_DOMAINS.has(domain)) {
      excluded.push({ ...e, domain });
    } else {
      eligible.push(e);
    }
  }

  const shuffled = seededShuffle(eligible, SEED);
  const sample = shuffled.slice(0, SAMPLE_SIZE);

  return { entries, excluded, eligible, sample };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const { entries, excluded, eligible, sample } = buildSample();
  writeFileSync(
    `${DATA_DIR}/sample.json`,
    JSON.stringify(
      {
        seed: SEED,
        prng: 'mulberry32',
        parsedTotal: entries.length,
        excludedKnownVendors: excluded.length,
        eligibleTotal: eligible.length,
        sampleSize: sample.length,
        sample,
      },
      null,
      2,
    ),
  );
  console.log(`parsed ${entries.length} entries`);
  console.log(`excluded ${excluded.length} known-vendor entries: ${excluded.map((e) => e.name).join(', ')}`);
  console.log(`eligible ${eligible.length}, sampled ${sample.length}`);
}
