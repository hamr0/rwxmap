// Pure functions for drawing the build set. No I/O here — see run.mjs for
// the file-reading runner. Imports nothing from frozen code.

/**
 * Reduce a vendor hostname to its registrable label.
 *
 * Normal case: lowercase, strip a leading "www.", take the second-to-last
 * dot-label (e.g. github.com -> github, appcenter.ms -> appcenter,
 * keycloak.local -> keycloak).
 *
 * Two-part public suffix case (e.g. example.co.uk): when the last label is
 * 2 characters and the second-to-last label is a known second-level suffix
 * word (co, com, org, net, gov, ac), both of the last two labels are the
 * suffix, so the registrable label is the one before them
 * (example.co.uk -> example).
 *
 * @param {string} vendor
 * @returns {string}
 */
export function registrableName(vendor) {
  let v = String(vendor).toLowerCase();
  if (v.startsWith('www.')) v = v.slice(4);
  const labels = v.split('.');
  if (labels.length === 1) return labels[0];

  const last = labels[labels.length - 1];
  const secondLast = labels[labels.length - 2];
  const KNOWN_2ND_LEVEL = new Set(['co', 'com', 'org', 'net', 'gov', 'ac']);

  if (last.length === 2 && KNOWN_2ND_LEVEL.has(secondLast) && labels.length >= 3) {
    return labels[labels.length - 3];
  }
  return secondLast;
}

// mulberry32: small deterministic PRNG. Returns a function producing
// floats in [0, 1).
function mulberry32(seed) {
  let t = seed >>> 0;
  return function next() {
    t = (t + 0x6d2b79f5) | 0;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

// Turn a seed (number or string) into a deterministic 32-bit unsigned int
// via FNV-1a when it's a string, so different salts give different seeds.
function toSeed32(seed) {
  if (typeof seed === 'number') return seed >>> 0;
  let h = 2166136261 >>> 0;
  const s = String(seed);
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
}

/**
 * Deterministically shuffle an array. Does not mutate the input; returns a
 * new array. Same seed -> same order, every time.
 * @param {Array<any>} array
 * @param {number|string} seed
 * @returns {Array<any>}
 */
export function seededShuffle(array, seed) {
  const out = array.slice();
  const rand = mulberry32(toSeed32(seed));
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    const tmp = out[i];
    out[i] = out[j];
    out[j] = tmp;
  }
  return out;
}

/**
 * Dedupe rows that share the same provider+method+path+operationId (the
 * apis-guru corpus repeats the same endpoint many times under different
 * spec variants — e.g. github.com, github.com:api.github.com,
 * github.com:ghec, github.com:ghes-3.2 — which differ only in fields like
 * description). Keys on provider|METHOD|path|operationId, keeps the FIRST
 * occurrence in input order.
 * @param {Array<Record<string,string>>} rows
 * @returns {Array<Record<string,string>>}
 */
export function dedupeRows(rows) {
  const seen = new Set();
  const out = [];
  for (const row of rows) {
    const method = String(row.method || '').toUpperCase();
    const key = `${row.provider}|${method}|${row.path}|${row.operationId}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(row);
  }
  return out;
}

/**
 * Draw the write-heavy build set from corpus rows.
 * @param {Array<Record<string,string>>} rows
 * @param {{caps: Record<string, number>, methods: string[], seed: number|string}} opts
 * @returns {{rows: Array<Record<string,string>>, perVendor: Array<object>, dropped: number}}
 */
export function drawBuildSet(rows, { caps, methods, seed }) {
  const methodSet = new Set(methods.map((m) => String(m).toUpperCase()));
  const capKeys = new Set(Object.keys(caps));

  // Filter to write-method rows for vendors in the cap table, preserving
  // input order.
  const filtered = [];
  for (const row of rows) {
    const method = String(row.method || '').toUpperCase();
    if (!methodSet.has(method)) continue;
    const vendor = row.provider;
    if (!capKeys.has(vendor)) continue;
    filtered.push(row);
  }

  // Dedupe AFTER the method+vendor filter, BEFORE capping/shuffling.
  const deduped = dedupeRows(filtered);
  const dropped = filtered.length - deduped.length;

  // Group by provider, tracking pre-dedupe (raw) availability too.
  const byProvider = new Map();
  for (const row of deduped) {
    const vendor = row.provider;
    if (!byProvider.has(vendor)) byProvider.set(vendor, []);
    byProvider.get(vendor).push(row);
  }
  const rawCountByProvider = new Map();
  for (const row of filtered) {
    const vendor = row.provider;
    rawCountByProvider.set(vendor, (rawCountByProvider.get(vendor) || 0) + 1);
  }

  const drawnRows = [];
  const perVendor = [];

  for (const vendor of Object.keys(caps)) {
    const available = byProvider.get(vendor) || [];
    const cap = caps[vendor];
    let drawn;
    if (Number.isFinite(cap)) {
      const shuffled = seededShuffle(available, `${seed}:${vendor}`);
      drawn = shuffled.slice(0, cap);
    } else {
      drawn = available.slice();
    }

    const byMethod = { POST: 0, PUT: 0, DELETE: 0, PATCH: 0 };
    for (const row of drawn) {
      const method = String(row.method || '').toUpperCase();
      if (method in byMethod) byMethod[method]++;
    }

    perVendor.push({
      vendor,
      available: available.length,
      availableRaw: rawCountByProvider.get(vendor) || 0,
      drawn: drawn.length,
      byMethod,
    });
    drawnRows.push(...drawn);
  }

  perVendor.sort((a, b) => b.drawn - a.drawn);

  return { rows: drawnRows, perVendor, dropped };
}
