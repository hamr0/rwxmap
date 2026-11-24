// Module-resolution hook for the exam #8 scorer: makes `import('rwxlite')` in
// rwxmap's src/rwxliteengine.js resolve to the scratch install of the baseline (0.4.0) or candidate build (one scratch install per model),
// without editing src/ and without touching any real node_modules.
let entry;
export function initialize(data) { entry = data.entry; }
export async function resolve(specifier, context, nextResolve) {
  if (specifier === 'rwxlite') return { url: entry, shortCircuit: true };
  return nextResolve(specifier, context);
}
