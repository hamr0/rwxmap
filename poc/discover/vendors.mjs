// Pass 1, step 2 — derive one API host per vendor from the four locked
// spec sets, via src/load.js only (no new dependencies, no network yet).
import { readFileSync } from 'node:fs';
import { loadSpec } from '../../src/load.js';

const SETS = [
  'data/provider-corpus-2026-09-16',
  'data/exam-2026-09-17',
  'data/exam-2026-09-20',
  'data/exam-2026-09-22',
];

/**
 * Resolve an OpenAPI 3 server URL template against its declared variable
 * defaults (e.g. `https://{region}.example.com` with
 * `variables.region.default === "us"`).
 */
function resolveServerUrl(server) {
  let url = server.url;
  const vars = server.variables || {};
  for (const [name, v] of Object.entries(vars)) {
    if (v && typeof v.default === 'string') {
      url = url.split(`{${name}}`).join(v.default);
    }
  }
  return url;
}

function hostFromUrl(url) {
  try {
    return new URL(url).host;
  } catch {
    return null;
  }
}

async function deriveHost(specPath) {
  const { doc } = await loadSpec(specPath);
  if (Array.isArray(doc.servers) && doc.servers.length > 0 && doc.servers[0]?.url) {
    const resolved = resolveServerUrl(doc.servers[0]);
    // A relative server URL (no scheme) can't give a host on its own.
    const withScheme = /^https?:\/\//i.test(resolved) ? resolved : `https://${resolved.replace(/^\/+/, '')}`;
    return { host: hostFromUrl(withScheme), via: 'openapi3 servers[0].url', raw: doc.servers[0].url };
  }
  if (typeof doc.host === 'string' && doc.host) {
    return { host: doc.host, via: 'swagger2 host', raw: doc.host };
  }
  return { host: null, via: null, raw: null };
}

export async function collectVendorRows() {
  const byVendor = new Map();
  for (const dir of SETS) {
    const lock = JSON.parse(readFileSync(`${dir}/specs.lock.json`, 'utf8'));
    for (const row of lock) {
      if (row.provider === 'hubspot') continue; // skip hubspot's tarball
      if (!byVendor.has(row.provider)) byVendor.set(row.provider, []);
      byVendor.get(row.provider).push({ dir, ...row });
    }
  }

  const rows = [];
  for (const [vendor, entries] of byVendor) {
    // For digitalocean, use the aggregator (the one full-surface spec, not
    // the per-resource fragments also locked in this set).
    let entry = entries[0];
    if (vendor === 'digitalocean') {
      entry = entries.find((e) => e.path.endsWith('DigitalOcean-public.v2.yaml.gz')) || entry;
    }
    const specPath = `${entry.dir}/specs/${entry.path}`;
    let host = null;
    let via = null;
    let raw = null;
    let error = null;
    try {
      ({ host, via, raw } = await deriveHost(specPath));
    } catch (err) {
      error = err instanceof Error ? err.message : String(err);
    }
    rows.push({
      vendor,
      lockedUrl: entry.url,
      specPath,
      fragmentCount: entries.length,
      host,
      via,
      raw,
      error,
    });
  }
  rows.sort((a, b) => a.vendor.localeCompare(b.vendor));
  return rows;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const rows = await collectVendorRows();
  for (const r of rows) {
    const hostStr = r.error
      ? `ERROR: ${r.error}`
      : r.host
        ? `${r.host}${r.fragmentCount > 1 ? ` (${r.fragmentCount} fragments, used ${r.specPath})` : ''}`
        : "CAN'T DERIVE (no servers[0].url or host field)";
    console.log(`${r.vendor}\t${hostStr}\t${r.lockedUrl}`);
  }
}
