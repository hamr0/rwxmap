// Shared OpenAPI-document field extraction, used for both the YAML CAMARA
// specs (parsed by yaml-mini.mjs) and the JSON hold-out specs (parsed by
// JSON.parse) — once parsed, both are plain JS objects with the same
// OpenAPI shape, so one set of extractors works for all three test beds.

export const PARTY_MONEY_RE = /(recipient|to|from|user|member|email|phone|msisdn|amount|currency|payee|payer|customer|account|destination|target)/i;
export const RESOURCE_PARTY_RE = /(owner|user|member|accessible_by|created_by|assignee|recipient|to|from|email|participants|attendees)/i;
export const IDEMPOTENCY_HEADER_RE = /idempotency/i;
export const PARTY_PARAM_RE = /(user|member|account|customer|recipient)/i;
export const CALLBACK_TEXT_RE = /callback|webhook|notification|sink/i;

export function resolveLocalRef(doc, ref) {
  if (typeof ref !== 'string') return undefined;
  if (!ref.startsWith('#/')) return { __external: true, ref };
  const parts = ref.slice(2).split('/').map((p) => p.replace(/~1/g, '/').replace(/~0/g, '~'));
  let node = doc;
  for (const p of parts) {
    if (node == null) return undefined;
    node = node[p];
  }
  return node;
}

// Merge object-schema properties, following $ref (local only) and allOf
// members, capped in depth and guarded against ref cycles. This is used
// for both requestBody schemas and resource (GET response) schemas.
export function schemaProperties(doc, schema, depth = 0, seen = new Set()) {
  if (!schema || typeof schema !== 'object' || depth > 4) return {};
  if (schema.$ref) {
    if (typeof schema.$ref === 'string' && seen.has(schema.$ref)) return {};
    if (typeof schema.$ref === 'string') seen.add(schema.$ref);
    const resolved = resolveLocalRef(doc, schema.$ref);
    if (!resolved || resolved.__external) return {};
    return schemaProperties(doc, resolved, depth + 1, seen);
  }
  let props = {};
  if (schema.properties && typeof schema.properties === 'object') {
    props = { ...props, ...schema.properties };
  }
  if (Array.isArray(schema.allOf)) {
    for (const s of schema.allOf) props = { ...props, ...schemaProperties(doc, s, depth + 1, seen) };
  }
  return props;
}

// Unwrap an array-typed schema (list envelope) to its item schema's props.
export function effectiveObjectProperties(doc, schema, depth = 0, seen = new Set()) {
  if (!schema || typeof schema !== 'object' || depth > 4) return {};
  let s = schema;
  if (s.$ref) {
    const resolved = resolveLocalRef(doc, s.$ref);
    if (!resolved || resolved.__external) return {};
    return effectiveObjectProperties(doc, resolved, depth + 1, seen);
  }
  if (s.type === 'array' && s.items) {
    return effectiveObjectProperties(doc, s.items, depth + 1, seen);
  }
  return schemaProperties(doc, s, depth, seen);
}

export function methodOp(doc, pathKey, method) {
  const pathItem = doc.paths?.[pathKey];
  if (!pathItem) return undefined;
  return pathItem[String(method).toLowerCase()];
}

export function statusCodes(op) {
  return Object.keys(op.responses || {});
}

export function requestBodyInfo(doc, op) {
  let rb = op.requestBody;
  if (rb && rb.$ref) rb = resolveLocalRef(doc, rb.$ref);
  if (!rb || rb.__external || !rb.content) {
    return { present: false, mediaType: '', props: [], hasPartyMoney: false };
  }
  const mediaTypes = Object.keys(rb.content);
  const primaryType = mediaTypes.includes('application/json') ? 'application/json' : mediaTypes[0];
  const media = rb.content[primaryType];
  const props = Object.keys(schemaProperties(doc, media?.schema)).slice(0, 30);
  return {
    present: true,
    mediaType: primaryType || '',
    props,
    hasPartyMoney: props.some((p) => PARTY_MONEY_RE.test(p)),
  };
}

export function securityInfo(doc, op) {
  const opSec = op.security;
  const present = Array.isArray(opSec) && opSec.length > 0;
  let schemeCount = 0;
  const scopes = [];
  if (Array.isArray(opSec)) {
    for (const entry of opSec) {
      if (entry && typeof entry === 'object') {
        for (const [scheme, scopeList] of Object.entries(entry)) {
          schemeCount++;
          if (Array.isArray(scopeList)) {
            for (const s of scopeList) if (s !== '' && s != null) scopes.push(String(s));
          }
        }
      }
    }
  }
  const docTopLevelSecurity = Array.isArray(doc.security) && doc.security.length > 0;

  const schemes = doc.components?.securitySchemes || {};
  let oauth2WithScopes = false;
  let anyExternalSchemeRef = false;
  for (const scheme of Object.values(schemes)) {
    let s = scheme;
    if (s && s.$ref) {
      const resolved = resolveLocalRef(doc, s.$ref);
      if (resolved && resolved.__external) { anyExternalSchemeRef = true; continue; }
      s = resolved;
    }
    if (!s) continue;
    if (s.type === 'oauth2' && s.flows && typeof s.flows === 'object') {
      for (const flow of Object.values(s.flows)) {
        if (flow && flow.scopes && Object.keys(flow.scopes).length > 0) oauth2WithScopes = true;
      }
    }
  }

  return { present, schemeCount, scopes, docTopLevelSecurity, oauth2WithScopes, anyExternalSchemeRef, schemeNamesCount: Object.keys(schemes).length };
}

export function callbacksInfo(doc, op) {
  const opHasCallbacks = Object.prototype.hasOwnProperty.call(op, 'callbacks')
    && op.callbacks && typeof op.callbacks === 'object' && Object.keys(op.callbacks).length > 0;
  const docHasWebhooks = !!(doc.webhooks && Object.keys(doc.webhooks).length > 0)
    || !!(doc['x-webhooks'] && Object.keys(doc['x-webhooks']).length > 0);
  const text = `${op.summary || ''} ${op.description || ''}`;
  const descMentions = CALLBACK_TEXT_RE.test(text);
  return { opHasCallbacks, docHasWebhooks, descMentions };
}

function resolveParam(doc, p) {
  if (p && p.$ref) {
    const r = resolveLocalRef(doc, p.$ref);
    return r && !r.__external ? r : p;
  }
  return p;
}

export function paramsInfo(doc, op) {
  const params = Array.isArray(op.parameters) ? op.parameters.map((p) => resolveParam(doc, p)) : [];
  const idempotencyHeader = params.some((p) => p && p.in === 'header' && IDEMPOTENCY_HEADER_RE.test(p.name || ''));
  const partyParam = params.some((p) => p && PARTY_PARAM_RE.test(p.name || ''));
  return { idempotencyHeader, partyParam, count: params.length };
}

export function xExtensionKeys(op) {
  return Object.keys(op).filter((k) => k.startsWith('x-'));
}

// Resource schema: the path's own GET, or (failing that) the collection
// path's GET (this op's path with a trailing "/{id}" segment removed).
export function resourceSchema(doc, opPath) {
  const candidates = [opPath];
  const collection = opPath.replace(/\/\{[^/]+\}$/, '');
  if (collection !== opPath) candidates.push(collection);

  for (const p of candidates) {
    const getOp = doc.paths?.[p]?.get;
    if (!getOp) continue;
    const responses = getOp.responses || {};
    const codes = Object.keys(responses).filter((c) => /^2\d\d$/.test(c));
    for (const code of codes.length ? codes : Object.keys(responses)) {
      let resp = responses[code];
      if (resp && resp.$ref) resp = resolveLocalRef(doc, resp.$ref);
      if (!resp || resp.__external) continue;
      const mediaTypes = Object.keys(resp.content || {});
      const primaryType = mediaTypes.includes('application/json') ? 'application/json' : mediaTypes[0];
      const schema = resp.content?.[primaryType]?.schema;
      if (!schema) continue;
      const props = Object.keys(effectiveObjectProperties(doc, schema)).slice(0, 30);
      if (props.length > 0) {
        return {
          found: true,
          fromPath: p,
          props,
          hasPartyField: props.some((x) => RESOURCE_PARTY_RE.test(x)),
        };
      }
    }
  }
  return { found: false, fromPath: '', props: [], hasPartyField: false };
}
