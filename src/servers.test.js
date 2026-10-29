import { test } from 'node:test';
import assert from 'node:assert/strict';
import { tenantTemplate, tenantServerTemplates } from './servers.js';

test('tenantTemplate: leading {var} labels over a fixed suffix of at least 2 labels', () => {
  assert.equal(tenantTemplate('https://{region}.sentry.io')?.suffix, 'sentry.io');
  assert.equal(tenantTemplate('https://{a}.{b}.example.co.uk/v1')?.suffix, 'example.co.uk');
  assert.equal(tenantTemplate('https://{r}.sentry.io:8443/x')?.suffix, 'sentry.io:8443');
  assert.equal(tenantTemplate('https://{r}.sentry.io:443')?.suffix, 'sentry.io'); // default port dropped
  assert.equal(tenantTemplate('HTTPS://{r}.Sentry.IO')?.suffix, 'sentry.io');
});

test('tenantTemplate: every other templated or placeholder host gets no route', () => {
  for (const url of [
    'https://{yourOktaDomain}',            // whole host a var
    'https://{subdomain}.{site}',          // no fixed suffix
    'https://{subdomain}.{domain}.com',    // 1-label suffix
    'https://{a}.sentry.{tld}',            // var in the suffix
    'https://api-{x}.foo.com',             // var mid-label
    'https://foo.{x}.example.com',         // var not leading
    'https://your-domain.atlassian.net',   // placeholder word, no braces
    'https://server.api.mailchimp.com',
    'https://{a}.sentry.io?x=1',
    '/v1/{a}',
    'ftp://{a}.sentry.io',
    'https://{a}..sentry.io',
  ]) {
    assert.equal(tenantTemplate(url), null, url);
  }
});

test('tenantServerTemplates: keeps host vars, resolves path vars with defaults, skips the rest', () => {
  const doc = {
    servers: [
      { url: 'https://{region}.sentry.io/api/{v}', variables: { region: { default: 'us' }, v: { default: '0' } } },
      { url: 'https://{region}.sentry.io/api/{v}', variables: { v: { default: '0' } } }, // duplicate once resolved
      { url: 'https://{yourOktaDomain}' },
      { url: 'https://{subdomain}.{domain}.com' },
      { url: 'https://api.fixed.com' },
      { url: 7 },
    ],
  };
  assert.deepEqual(tenantServerTemplates(doc), ['https://{region}.sentry.io/api/0']);
  assert.deepEqual(tenantServerTemplates({ swagger: '2.0', host: 'x.y.com' }), []);
  assert.deepEqual(tenantServerTemplates(undefined), []);
});
