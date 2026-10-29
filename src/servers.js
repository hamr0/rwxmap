// Server resolution, shared by discover.js (which builds a found result
// from a spec), cli.js (which stores the resolved list in the sidecar) and
// matcher.js (which reads it back at proxy time). Pure and import-free on
// purpose: matcher.js must load without the yaml package or any I/O, and
// the three callers must never disagree about what a spec's servers are.

/**
 * @param {string} url
 * @param {any} variables
 * @returns {string}
 */
function resolveServerVariables(url, variables) {
  if (!variables || typeof variables !== 'object') return url;
  return url.replace(/\{([^}]+)\}/g, (whole, name) => {
    const v = variables[name];
    if (!v) return whole;
    if (typeof v.default === 'string') return v.default;
    if (Array.isArray(v.enum) && v.enum.length > 0) return String(v.enum[0]);
    return name;
  });
}

/**
 * The doc's OWN declared servers (OpenAPI 3 `servers[]` with variable
 * defaults resolved, or Swagger 2 `schemes`+`host`+`basePath`), resolved
 * to absolute URLs — no fallback host baked in here (that decision is
 * serversOrVendorHost's, once a vendor is actually known).
 *
 * @param {any} doc
 * @param {string} [specUrl]  Base for a relative server URL; omitted
 *   (rather than a non-URL like a local file path) when there is no
 *   usable base — a relative server URL then fails to resolve and is
 *   skipped, same as any other unresolvable one.
 * @returns {string[]}
 */
export function resolvedServers(doc, specUrl) {
  /** @type {string[]} */
  const urls = [];
  if (doc && Array.isArray(doc.servers) && doc.servers.length > 0) {
    for (const s of doc.servers) {
      if (!s || typeof s.url !== 'string') continue;
      const resolved = resolveServerVariables(s.url, s.variables);
      try {
        urls.push(new URL(resolved, specUrl).toString());
      } catch {
        // an unresolvable server URL template is skipped, not fatal.
      }
    }
  } else if (doc && typeof doc.host === 'string' && doc.host) {
    const scheme = Array.isArray(doc.schemes) && doc.schemes.length > 0 ? doc.schemes[0] : 'https';
    const basePath = typeof doc.basePath === 'string' ? doc.basePath : '';
    urls.push(`${scheme}://${doc.host}${basePath}`);
  }
  return [...new Set(urls)];
}

/**
 * THE ONE WRITER of the no-servers fallback: a spec that names no usable
 * server is taken to live at `https://<vendor>`. buildFoundResult
 * (classifyCall) and matcherFrom both call this, so the two can never
 * disagree about which host a server-less spec answers for.
 *
 * @param {string[]} servers  A resolvedServers() result (or a sidecar's
 *   stored `servers`).
 * @param {string} vendor
 * @returns {string[]}
 */
export function serversOrVendorHost(servers, vendor) {
  return servers.length === 0 ? [`https://${vendor}`] : servers;
}

// A tenant server URL: scheme, one or more LEADING host labels that are each
// exactly `{var}`, then a fixed host (no braces) and an optional path.
// Anything else templated (a whole-host var, a var in the suffix or mid-label,
// a query or fragment) does not match.
const TENANT_TEMPLATE = /^(https?):\/\/((?:\{[^{}./]+\}\.)+)([^{}/?#@\s]+)(\/[^?#]*)?$/i;

/**
 * THE ONE READER of the suffix-routing rule (D126): a server URL whose host
 * is leading `{var}` labels over a fixed suffix of AT LEAST 2 labels routes
 * every host ending in `.<suffix>`. Used by tenantServerTemplates (the
 * writer of the sidecar's `serverTemplates`) and by matcher.js (which
 * validates them), so the two never disagree about what is routable.
 *
 * @param {string} url
 * @returns {{scheme: string, vars: string, host: string, suffix: string, path: string}|null}
 *   `suffix` is the normalized `host[:port]` (default port dropped) the
 *   routed hosts must end in; null when `url` is not suffix-routable.
 */
export function tenantTemplate(url) {
  const m = TENANT_TEMPLATE.exec(url);
  if (!m) return null;
  const [, scheme, vars, host, path = ''] = m;
  const hostname = host.replace(/:\d+$/, '');
  const labels = hostname.split('.');
  if (labels.length < 2 || labels.includes('')) return null;
  let parsed;
  try {
    parsed = new URL(`${scheme}://x.${host}`);
  } catch {
    return null;
  }
  return { scheme: scheme.toLowerCase(), vars, host, suffix: parsed.host.slice(2), path };
}

/**
 * THE ONE WRITER of the sidecar's `serverTemplates`: the doc's OpenAPI 3
 * server URLs that tenantTemplate accepts, host `{var}` labels left as
 * written and the path's variables resolved with their defaults, exactly as
 * resolvedServers does.
 *
 * @param {any} doc
 * @returns {string[]}
 */
export function tenantServerTemplates(doc) {
  /** @type {string[]} */
  const out = [];
  if (doc && Array.isArray(doc.servers)) {
    for (const s of doc.servers) {
      if (!s || typeof s.url !== 'string') continue;
      const t = tenantTemplate(s.url);
      if (t) out.push(`${t.scheme}://${t.vars}${t.host}${resolveServerVariables(t.path, s.variables)}`);
    }
  }
  return [...new Set(out)];
}
