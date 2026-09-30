# Conformance check (item e, bar 10)

A one-off check that each standard's own published definition accepts
what rwxmap emits. It is not part of rwxmap's `package.json`, `npm test`
or CI. The validators are installed only here.

## Run

```sh
cd poc/conformance && npm install && node run.mjs
# add the real-browser WebMCP check:
CHROME=/path/to/chrome-156-or-later node run.mjs
# see one check fail on purpose (rwxmap output corrupted in memory only):
node run.mjs --break=openapi   # or mcp | metakey | roundtrip | snippets | webmcp | browser
```

The script exits 1 if any check fails. The schemas are pinned in
`schemas/` (sources and sha256 are in `schemas/README.md`). The live
intercom run and the spec it fetches need the network.

## Input

This is rwxmap's real output, not a copy of it:

- `buildOutput` from `src/cli.js` over the 37 spec files that
  `tools/proof-cli.js` covers. It uses the same four sets' `specs.lock.json`
  and the same filter. That is 11,505 operations.
- One live CLI run, `node src/cli.js https://api.intercom.io -o <tmp>`.
  It runs with `RWXMAP_JEV_KEY` removed, `XDG_CACHE_HOME` set to a fresh
  temp dir, and a temp dir as cwd, so no `.env` is read. The written
  files are checked, and the input spec is re-fetched from the `source`
  that the run records. That is 166 operations.

## Checks

| Check | What passes |
|---|---|
| `openapi` | Every input and its `.openapi.rwx` copy are validated against the official OAI JSON Schema for their version. The copy's error set (instancePath + keyword + message) must equal the input's. An input that is already invalid is the vendor's problem: it is listed, not failed. A minimal valid document per version must pass first. This guards against a broken validator. |
| `mcp` | Each `mcp` entry is built into a full Tool (`name`, `description`, `inputSchema: {type:'object'}`, `annotations`, `_meta`). Each Tool must validate against `$defs/Tool` in MCP `schema.json` 2026-07-28. |
| `metakey` | Every `_meta` key must follow that schema's MetaObject key rule. The rule is written in prose there, not in the JSON Schema. It covers the label/name syntax and reserves prefixes whose second label is `mcp` or `modelcontextprotocol`. |
| `roundtrip` | A real `@modelcontextprotocol/sdk` `McpServer` registers intercom's 166 tools with rwxmap's `annotations` and `_meta`. A real `Client` calls `tools/list` over the SDK's in-memory transport. Every tool's `annotations` and `_meta` must come back deep-equal. |
| `snippets` | The MCP snippet in `hint-snippets.md` is run as written against the SDK's `McpServer.registerTool`. `inputSchema: { /* yours */ }` is replaced by `{}`. The tool must list with the snippet's `annotations` and `_meta`. |
| `webmcp` | Every `webmcp` entry is checked against the WebIDL, which is parsed from the pinned spec page. It may use only `ModelContextTool` members, and only `ToolAnnotations` members inside `annotations`. Every value must have the IDL type (all booleans). This is stricter than a browser: WebIDL silently drops unknown dictionary members. |
| `browser` | This check runs only with `CHROME=`. A headless Chrome runs with `--enable-features=WebMCPTesting`. It registers one r, one w and one x intercom tool with rwxmap's annotations via `document.modelContext.registerTool`, then reads them back with `getTools()`. Every member sent must come back with the same value. |

## When to re-run

Re-run when a standard publishes a new revision: a new OAI schema date,
a new MCP `schema.json` revision, a WebMCP IDL change, a new SDK major,
or a Chrome release that changes WebMCP. Also re-run when rwxmap changes
what it writes into `x-rwx`, `mcp` or `webmcp`. Pin the new file, record
it in `schemas/README.md`, run, and update the table below.

## Results — 2026-09-29

Environment: node v22.22.2, ajv 8.20.0, ajv-draft-04 1.0.0, ajv-formats
3.0.1, @modelcontextprotocol/sdk 1.31.0. The run covered 38 files (37
corpus + 1 live) and 11,671 operations.

| Standard (revision) | Check | Result |
|---|---|---|
| OpenAPI 2.0 (schema 2017-08-27) | input vs copy | 3 files, copy == input 3/3. All 3 inputs are valid. |
| OpenAPI 3.0 (schema 2024-10-18) | input vs copy | 31 files, copy == input 31/31. 21 inputs are valid and 10 were already invalid. |
| OpenAPI 3.1 (schema 2026-08-03) | input vs copy | 4 files, copy == input 4/4. 3 inputs are valid and 1 was already invalid (meta-whatsapp). |
| OpenAPI 3.2 (schema 2026-08-30) | — | No 3.2 input exists, so this revision is not pinned. |
| MCP (schema.json 2026-07-28) | Tool schema | 11,671/11,671 Tools valid |
| MCP (schema.json 2026-07-28) | `_meta` key rule | 46,684/46,684 keys conform |
| MCP (SDK 1.31.0) | server → client round trip | 166/166 deep-equal. The negotiated protocol was 2025-11-25, the SDK's latest. |
| MCP (SDK 1.31.0) | hint-snippets.md snippet | Runs as written, with `{}` for the placeholder |
| WebMCP (CG draft 28 Sep 2026) | IDL | 11,671/11,671 entries conform |
| WebMCP | Chrome for Testing 154.0.8037.57 (Stable), `WebMCPTesting` | r, w and x all read back equal. `debugging` is not in this build, and rwxmap does not send it. |
| WebMCP | Chrome for Testing 156.0.8077.0 (Canary), `WebMCPTesting` | r, w and x all read back equal, 4 runs of 4. All four IDL members come back. |
| WebMCP | Chromium 153.0.8010.36 (Fedora), `WebMCPTesting` | FAIL: this build drops `consequentialHint` (see below) |

The 11 inputs that were already invalid are listed on each run with
their error counts. They are the same in the copy.

### Known limits

- **OpenAPI 3.1 and Ajv.** Ajv 8.20 resolves the 3.1 schema's
  `$dynamicRef: "#meta"` wrongly. Before the fix, a trivially valid 3.1
  document failed, and all 4 of 4 inputs "failed" with 1,863–20,205
  errors each. The pinned schema has exactly one `$dynamicAnchor: "meta"`,
  so `run.mjs` resolves it statically to `$defs/schema` in memory. That
  is what JSON Schema 2020-12 prescribes here. The script refuses to do
  this if that premise ever stops holding. The validator-sanity step
  catches a regression: with the fix removed, it fails on the minimal 3.1
  document.
- Ajv has no `media-range` format. The 3.1 schema uses it on `content`
  keys, so those keys go unchecked. Ajv prints a warning.
- **MCP protocol revision.** The Tool shape is validated against
  `schema.json` 2026-07-28. The newest SDK (1.31.0) negotiates 2025-11-25
  at most, and so does `@modelcontextprotocol/server` 2.2.0. So the
  round trip is on 2025-11-25.
- **Snippets.** The call shape is right: `registerTool(name,
  config, handler)`. But in SDK 1.x, `inputSchema` must be a Zod raw
  shape or a Zod schema. A JSON Schema object such as
  `{ type: 'object' }` is refused with "inputSchema must be a Zod schema
  or raw shape, received an unrecognized object". `--break=snippets` shows
  this.
- **Chromium 153** (the local Fedora build) knows only `readOnlyHint`
  and `untrustedContentHint`. It silently drops `consequentialHint`,
  so an `x` tool reads back with nothing marking it consequential.
  Chrome 154 (Stable) and 156 (Canary) keep it. A search of the binary
  strings for the member names found the same split in Playwright's
  Chrome for Testing builds. 146.0.7680.0 has only `readOnlyHint`.
  149.0.7827.55 and 153.0.8010.12 have `readOnlyHint` and
  `untrustedContentHint`. Those three builds were not run.
- WebMCP is behind `--enable-features=WebMCPTesting` (the
  `chrome://flags/#enable-webmcp-testing` flag). `document.modelContext`
  is absent without it (tried on 153 and 156).
