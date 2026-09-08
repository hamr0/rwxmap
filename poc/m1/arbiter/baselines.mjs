// Dumb baselines to compare the adopted c11 classifier against, so the
// benchmark's numbers mean something. Pure, no I/O: each classify(row) ->
// { class }.
import { methodPrior } from './arbiter.mjs';

// Every row 'x', regardless of method or text.
function classifyAllX() {
  return { class: 'x' };
}

// GET/HEAD/OPTIONS -> 'r', everything else -> 'x'.
function classifyGetElseX(row) {
  const isRead = row.method === 'GET' || row.method === 'HEAD' || row.method === 'OPTIONS';
  return { class: isRead ? 'r' : 'x' };
}

// GET/HEAD/OPTIONS -> 'r', PUT/DELETE -> 'w', POST/PATCH -> 'x' — just the
// method prior from arbiter.mjs, no text/verb evidence at all.
function classifyMethodPrior(row) {
  return { class: methodPrior(row.method) };
}

export const BASELINES = [
  { name: 'all-x', classify: classifyAllX },
  { name: 'get-else-x', classify: classifyGetElseX },
  { name: 'method-prior', classify: classifyMethodPrior },
];
