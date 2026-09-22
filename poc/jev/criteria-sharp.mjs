// The SHORT-BUT-SHARP arm. Same brevity as the minimal arm, but x carries a
// real test instead of being defined as the leftover. Isolates "is it the
// volume of criteria, or the framing?" — the minimal arm confounded both.
export function questionsSharp() {
  return {
    rwx: {
      type: 'choice',
      instructions: 'Decide what happens when a caller who holds a normal API key for this provider calls this operation.',
      criteria: {
        r: 'Nothing changes. A read, check or dry-run.',
        w: "Changes only the caller's own stuff.",
        x: "Reaches someone other than the caller, or can't be safely repeated.",
      },
    },
  };
}
export function stateFor(row) {
  return { method: row.method, path: row.path, operationId: row.operationId, summary: row.summary || null, description: row.description || null };
}
