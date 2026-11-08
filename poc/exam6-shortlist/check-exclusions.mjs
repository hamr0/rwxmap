// For each alias set in aliases.json, report excluded-vendors.txt entries whose whole domain label equals an alias.
// Whole label = split on . : _ / @ (a hyphen stays inside a label). Also reports the 'substring-only' hits (not blocking) for human review.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const HERE = path.dirname(fileURLToPath(import.meta.url));
const al = JSON.parse(fs.readFileSync(path.join(HERE, 'aliases.json'), 'utf8'));
const ex = fs.readFileSync(path.join(HERE, 'excluded-vendors.txt'), 'utf8').split('\n').filter(Boolean).map(l => l.split('\t'));
const res = {};
for (const [name, list] of Object.entries(al)) {
  const hit = [], sub = [];
  for (const [n, file, srcs] of ex) {
    const labels = n.split(/[.:_/@\s]/);
    if (list.some(a => labels.includes(a) || n === a)) hit.push(`${n} <- ${srcs.split(',')[0]}`);
    else if (list.some(a => a.length >= 5 && n.includes(a))) sub.push(n);
  }
  res[name] = { aliases: list, labelHits: hit, substringOnly: sub };
  console.log(name.padEnd(13), hit.length ? 'SEEN  ' + hit.slice(0, 3).join(' | ') : 'clear', sub.length ? `  [substring: ${sub.slice(0, 4).join(', ')}]` : '');
}
fs.writeFileSync(path.join(HERE, 'exclusion-check.json'), JSON.stringify(res, null, 1));
