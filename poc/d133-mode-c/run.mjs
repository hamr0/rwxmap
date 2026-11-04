// Usage: node run.mjs <cli.js> <workdir> <jev|mech>. Runs the CLI per spec from a cwd with no .env.
import fs from 'node:fs';
import { spawnSync } from 'node:child_process';
const [cli, W, mode] = process.argv.slice(2);
const O = `${W}/out-${mode}`; fs.mkdirSync(O, { recursive: true });
const env = { ...process.env }; delete env.RWXMAP_JEV_KEY;
if (mode === 'jev') {
  const m = fs.readFileSync('/home/hamr/PycharmProjects/rwxmap/.env', 'utf8').match(/^RWXMAP_JEV_KEY=(.*)$/m);
  if (!m) { console.error('no key'); process.exit(1); }
  env.RWXMAP_JEV_KEY = m[1].trim().replace(/^["']|["']$/g, '');
}
const names = JSON.parse(fs.readFileSync(W + '/vendors.json'));
let fail = 0;
names.forEach((n, i) => {
  const v = 'v' + String(i).padStart(3, '0');
  const r = spawnSync('node', [cli, `${W}/specs/${v}.json`, '--vendor', v, '-o', O, '--force', '--engine', mode === 'jev' ? 'jev' : 'mechanical'], { cwd: O, env, encoding: 'utf8' });
  fs.writeFileSync(`${O}/${v}.log`, (r.stdout || '') + (r.stderr || '')); if (r.status !== 0) { fail++; console.error('FAIL', v); }
});
console.log(mode, 'vendors', names.length, 'failed runs', fail);
process.exit(fail ? 1 : 0);
