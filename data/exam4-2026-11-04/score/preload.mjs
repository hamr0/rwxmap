// Loaded with `node --import` before rwxmap's CLI by score.mjs. Two jobs:
//  1. resolve `rwxlite` to the scratch build of the model under test
//     (SCORE_RWXLITE_ENTRY, a file URL: baseline 0.2.0 or the candidate);
//  2. refuse every request to github.com / *.githubusercontent.com, so rwxmap's
//     "fetch the pinned model" step fails and it falls back to the verified model
//     in the scratch cache; a published model can never replace the one under test.
// Other hosts (Jev's) are untouched.
import { register } from 'node:module';

const entry = process.env.SCORE_RWXLITE_ENTRY;
if (!entry) throw new Error('preload: SCORE_RWXLITE_ENTRY is not set');
register('./hooks.mjs', { parentURL: import.meta.url, data: { entry } });

const realFetch = globalThis.fetch;
globalThis.fetch = (input, init) => {
  let host = '';
  try { host = new URL(typeof input === 'string' ? input : (input.url ?? String(input))).hostname; } catch { /* not a URL */ }
  if (host === 'github.com' || host.endsWith('.githubusercontent.com')) {
    return Promise.reject(new TypeError('exam scorer: github fetch blocked (scratch model cache only)'));
  }
  return realFetch(input, init);
};
