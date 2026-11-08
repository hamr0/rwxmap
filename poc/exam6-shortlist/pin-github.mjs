// For GitHub-hosted candidates: record the latest commit SHA touching the spec file (pin). Writes pins.json.
import fs from 'node:fs';
const rows = fs.readFileSync(new URL('./candidates.tsv', import.meta.url), 'utf8').split('\n').filter(Boolean).map(l => l.split('\t'));
const want = process.argv.slice(2);
const out = {};
for (const [name, url] of rows) {
  if (!want.includes(name)) continue;
  const m = url.match(/^https:\/\/raw\.githubusercontent\.com\/([^/]+)\/([^/]+)\/([^/]+)\/(.+)$/);
  if (!m) { out[name] = null; continue; }
  const [, o, r, ref, p] = m;
  const res = await fetch(`https://api.github.com/repos/${o}/${r}/commits?sha=${ref}&path=${encodeURIComponent(p)}&per_page=1`, { headers: { 'user-agent': 'spec-survey/1', accept: 'application/vnd.github+json' } });
  if (!res.ok) { out[name] = 'HTTP ' + res.status; continue; }
  const j = await res.json();
  out[name] = { repo: `${o}/${r}`, ref, path: p, sha: j[0]?.sha, date: j[0]?.commit?.committer?.date };
}
fs.writeFileSync(new URL('./pins.json', import.meta.url), JSON.stringify(out, null, 1));
console.log(JSON.stringify(out, null, 1));
