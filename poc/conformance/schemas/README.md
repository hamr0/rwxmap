# Pinned definitions

Fetched 2026-09-29. `run.mjs` reads only these files, so the schema side
of a run works offline. To pick up a new revision, fetch the new file,
add a line here, and point `run.mjs` at it.

| File | Source | sha256 |
|---|---|---|
| `oas-2.0-2017-08-27.json` | https://spec.openapis.org/oas/2.0/schema/2017-08-27 | `b36871c8016292c5e66dd3b203e69aeff98bfef97e0b3c67c1909036095586a5` |
| `oas-3.0-2024-10-18.json` | https://spec.openapis.org/oas/3.0/schema/2024-10-18 | `2385f5bbb8c37878daae73baeabe7f34b2f022a4a8c049329ee61f71796f039c` |
| `oas-3.1-2026-08-03.json` | https://spec.openapis.org/oas/3.1/schema/2026-08-03 | `59f106413cb48c31299f96f024c938d3628aed6cd02cd14bcfb2fcaae7a130b6` |
| `mcp-2026-07-28.schema.json` | https://raw.githubusercontent.com/modelcontextprotocol/modelcontextprotocol/main/schema/2026-07-28/schema.json (last commit to the file: `271ecc9`) | `ef70b61f99b6d2e5e3b46863822eab08dff6a45bedc7a08914e0e5b133f40203` |
| `webmcp-spec.html` | https://webmachinelearning.github.io/webmcp/ (Draft Community Group Report dated 28 September 2026; repo head `0957b0b`) | `a2e2d30778d64ca06aca8892c5e381d12a23b575b90a4d093a5da33b7e8c032e` |

Each OAI file is the newest revision spec.openapis.org published for its
version on the fetch date. That site also has a 3.2 schema (2026-08-30).
It is not pinned, because none of the inputs is a 3.2 document. A 3.2
input fails the run with "no official schema pinned".
