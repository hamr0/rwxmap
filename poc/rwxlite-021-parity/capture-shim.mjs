// Stands in for `import('rwxlite')` inside the real rwxmap CLI (score's preload points the
// resolver here). It loads the real rwxlite entry (P021_REAL_ENTRY) and wraps answerMany so each
// call's request array, exactly as src/rwxliteengine.js built it, is appended as one JSON line to
// P021_CAPTURE. Behaviour is otherwise untouched: the CLI's letters are the real ones.
import * as fs from 'node:fs';

const real = await import(process.env.P021_REAL_ENTRY);
const file = process.env.P021_CAPTURE;
if (!file) throw new Error('capture-shim: P021_CAPTURE is not set');

export async function loadAnswerer(opts) {
  const a = await real.loadAnswerer(opts);
  const orig = a.answerMany.bind(a);
  a.answerMany = (reqs) => { fs.appendFileSync(file, JSON.stringify(reqs) + '\n'); return orig(reqs); };
  return a;
}
