# Hint snippets

The MCP and WebMCP snippets a provider copies into place. `run.mjs`
runs the MCP one against the SDK's real `registerTool`.

- **MCP** — copy an `mcp` entry's `annotations` and `_meta` onto the
  tool with the same operation. `inputSchema` must be a Zod raw shape
  (`{ id: z.string() }`, or `{}` for none), not plain JSON Schema:

  ```js
  server.registerTool('delete_order', {
    description: 'Delete an order.',
    inputSchema: { /* yours */ }, // Zod raw shape, e.g. { id: z.string() }; {} for none
    annotations: { readOnlyHint: false, destructiveHint: true },
    _meta: {
      'io.github.hamr0.rwxmap/class': 'x',
      'io.github.hamr0.rwxmap/destructive': true,
      'io.github.hamr0.rwxmap/evidence': 'floor',
      'io.github.hamr0.rwxmap/review': 'settled',
    },
  }, handler);
  ```

- **WebMCP** — copy a `webmcp` entry's `annotations` into
  `registerTool` (Chrome 154+ with WebMCP enabled):

  ```js
  await document.modelContext.registerTool({
    name: 'delete_order',
    description: 'Delete an order.',
    annotations: { readOnlyHint: false, consequentialHint: true },
    execute: async (input) => { /* yours */ },
  });
  ```
