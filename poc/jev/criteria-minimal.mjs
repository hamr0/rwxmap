// The minimal arm: three short definitions, nothing else. No twelve rules,
// no method guidance, no tripwire list. x is framed as the residual —
// "neither r nor w" — exactly as the user posed it. Run against the same
// 4171 labelled corpus rows as the loaded arm, so the two are comparable.
export function questionsMinimal() {
  return {
    rwx: {
      type: 'choice',
      instructions: 'Decide what happens when a caller who holds a normal API key for this provider calls this operation.',
      criteria: {
        r: "Doesn't change anything.",
        w: "Changes only the caller's own stuff.",
        x: 'Neither r nor w.',
      },
    },
  };
}
export function stateFor(row) {
  return { method: row.method, path: row.path, operationId: row.operationId, summary: row.summary || null, description: row.description || null };
}
