// Builds answers-dev.csv: rwxmap letters for the 62 dev rows of the r16 unsure set.
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { parseCsv, toObjects, enc } from './csv.mjs';

const SRC = '/home/hamr/PycharmProjects/rwxlite/data/r16/labels/sonnet-recheck/unsure-for-rwxmap.csv';
const SHA = '5605d483af259d87d240e4fc401057d78ec3ae641b015fdf1c4d2a6f66f25973';
const die = (m) => { console.error('FATAL: ' + m); process.exit(1); };

// [N, op_id, letter, certainty, basis]
const ANSWERS = [
  [1, 'r16-00c47a34986a9438', 'x', 'sure', 'links a new sign-in method (Apple ID) to the account'],
  [2, 'r16-06e7b05696083af2', 'x', 'doubt', 'no text; billing registration could commit money (doubt rule)'],
  [3, 'r16-16d0dca1b2f620e4', 'x', 'lean', 'POST create of an employee, may be a login user'],
  [4, 'r16-20347464f26af947', 'x', 'lean', 'verifying identity (D141 b)'],
  [5, 'r16-223a2f940fa09aae', 'x', 'lean', 'POST create: starts an import that writes records; retained files need manual removal'],
  [6, 'r16-2ca9780bc040738d', 'x', 'doubt', 'no text; override (doubt rule)'],
  [7, 'r16-2def320d2fc69901', 'w', 'lean', 'quote with a soft inventory hold, 10-minute TTL: internal hold (D143 scope)'],
  [8, 'r16-3409788c1a4714c5', 'x', 'sure', 'creating a booking is x (D143)'],
  [9, 'r16-36c39d81e332f8f0', 'x', 'lean', 'removes a friendship in both directions; the other party must re-accept'],
  [10, 'r16-40eb9eb2be88d683', 'x', 'doubt', 'applies a final review decision (doubt rule)'],
  [11, 'r16-456434501ba8d795', 'x', 'doubt', 'creates PDP groups that deploy policies (doubt rule)'],
  [12, 'r16-4fc9426cd00cc3b4', 'x', 'lean', 'consumes a limited streak freeze; cannot be put back'],
  [13, 'r16-51bf5ea732289131', 'x', 'sure', 'links a new sign-in method (GameCenter)'],
  [14, 'r16-5338157a35359af1', 'x', 'sure', 'registers trusted issuer signing keys (D141 d)'],
  [15, 'r16-57a80d4d88443923', 'x', 'doubt', 'advances a phase; no way back stated (doubt rule)'],
  [16, 'r16-5a38aebbdc70fdf8', 'x', 'doubt', 'says it sends an SMS; ambiguous (doubt rule)'],
  [17, 'r16-5acfec6d591020ff', 'x', 'doubt', 'proxy pass-through; effect unknown (doubt rule)'],
  [18, 'r16-63e019e65411007b', 'x', 'doubt', 'no text; sets run state, may start a run (doubt rule)'],
  [19, 'r16-64f83054d76cbc5c', 'w', 'lean', 'rewrites own schedule; a later write can change it'],
  [20, 'r16-659835f50b25f75c', 'x', 'sure', 'provisions a paid server'],
  [21, 'r16-74a5646c407dd337', 'x', 'lean', 'stops a running conversation; work may be lost (D136)'],
  [22, 'r16-76e05eea863a6685', 'x', 'doubt', 'close with a required reason; no reopen stated (doubt rule)'],
  [23, 'r16-7c07240f1e4de250', 'x', 'lean', 'admin updates a team member, direction unstated'],
  [24, 'r16-8955e93ef1428184', 'x', 'lean', 'upload is shared to friends: sent to others'],
  [25, 'r16-8cd0a41ce4bd478b', 'x', 'doubt', 'registers an executable the server will run (doubt rule)'],
  [26, 'r16-9347aa91212d4399', 'x', 'doubt', 'generates a schedule that may be published to staff (doubt rule)'],
  [27, 'r16-94b18437658c6a0c', 'x', 'lean', 'POST create of an employee, may be a login user'],
  [28, 'r16-99a887dbfa39c681', 'x', 'doubt', 'deposit intent commits money (doubt rule)'],
  [29, 'r16-a01d7337ed53fa5f', 'x', 'sure', 'places a sell order with a market maker'],
  [30, 'r16-a4ebb429a5d48e24', 'x', 'lean', 'WOPI dispatch includes delete, rename and lock'],
  [31, 'r16-a8c4055c7f4dc049', 'x', 'lean', 'associates an eID with a profile: new sign-in link'],
  [32, 'r16-a9440472ec131a89', 'x', 'lean', 'test sends a notification out'],
  [33, 'r16-bc195158e4d5a2e7', 'x', 'doubt', 'presigned upload URL handed out (doubt rule, as earlier passes)'],
  [34, 'r16-c07c31b718013b3c', 'x', 'doubt', 'no text; create or lookup unclear (doubt rule)'],
  [35, 'r16-c19ab79c5e046abe', 'x', 'lean', 'domain proof check can mark a domain verified: widens what it may do'],
  [36, 'r16-c2af179a88f14035', 'x', 'doubt', 'signs a presentation proof: a signature handed out (doubt rule)'],
  [37, 'r16-c514696aadf43116', 'x', 'doubt', 'no text; app install (doubt rule)'],
  [38, 'r16-c61e17d981738019', 'w', 'lean', 'paper-trading quote; no money moves'],
  [39, 'r16-c71a6bcf4b0aba84', 'w', 'lean', 'rewrites own reply; a later write can change it'],
  [40, 'r16-ca851d17414ecb7e', 'x', 'sure', 'SMTP sending profile: endpoint config (D141 d)'],
  [41, 'r16-cacd80472b9cbb8c', 'x', 'lean', 'sends a request to another participant'],
  [42, 'r16-cb0ec071fcbee9a2', 'x', 'lean', 'approving grants the requester a ride seat'],
  [43, 'r16-cb86fc9c3f5084af', 'x', 'lean', 'creates a cluster and starts provisioning'],
  [44, 'r16-cf7b4ee61d5e42f4', 'x', 'lean', 'resumes an elevation (privilege) workflow'],
  [45, 'r16-d10eac8c89b0bedd', 'x', 'lean', 'collaborator update, access direction unstated'],
  [46, 'r16-d1b52ee5be0b2111', 'x', 'lean', 'cancels a hosted checkout session; cannot be put back'],
  [47, 'r16-d4b5b00b1a8413ce', 'w', 'lean', 'creates a derived ZIP file'],
  [48, 'r16-e2d266aa51a6aec4', 'x', 'doubt', 'no text; installs a pack into a space (doubt rule)'],
  [49, 'r16-e4847064e5a68cb6', 'w', 'lean', 'generates a stored summary'],
  [50, 'r16-e806330c5a25ab72', 'x', 'doubt', 'no text (doubt rule)'],
  [51, 'r16-e82939cce46eb30e', 'x', 'sure', 'starts a physical appliance'],
  [52, 'r16-e96d8577c246ce86', 'x', 'lean', 'declines a booking; the guest is told and loses the slot'],
  [53, 'r16-ea0a490d2722155b', 'x', 'doubt', 'no text; database server update (doubt rule)'],
  [54, 'r16-f033fb2704559f47', 'x', 'doubt', 'billed third-party generation (doubt rule)'],
  [55, 'r16-f1a79c6314527938', 'x', 'doubt', 'adds a session, may return a session token (D141 a, doubt rule)'],
  [56, 'r16-f4f3e6ca456f1a22', 'w', 'lean', 'generates a stored draft'],
  [57, 'r16-f59a9a4fdd12c86d', 'x', 'doubt', 'newsletter post may publish to subscribers (clause c)'],
  [58, 'r16-f72970a5677c62b6', 'x', 'doubt', 'appends a transparency-log checkpoint (doubt rule)'],
  [59, 'r16-f987da614627a3cd', 'x', 'lean', 'switches identity, returns a session (D141 a)'],
  [60, 'r16-f9f636a9a6c6a406', 'x', 'sure', 'creates an OS user that can log in'],
  [61, 'r16-fd521120d69083ed', 'w', 'lean', 'creates own user details'],
  [62, 'r16-fd70ed09f1cd9352', 'x', 'lean', 'collaborator update, access direction unstated'],
];

const buf = readFileSync(SRC);
const got = createHash('sha256').update(buf).digest('hex');
if (got !== SHA) die(`sha256 mismatch: ${got}`);

const dev = toObjects(parseCsv(buf.toString('utf8'))).filter((r) => r.part === 'dev');
if (dev.length !== 62) die(`expected 62 dev rows, found ${dev.length}`);

const byN = new Map();
for (const a of ANSWERS) {
  if (byN.has(a[0])) die(`duplicate entry N=${a[0]}`);
  byN.set(a[0], a);
}
if (ANSWERS.length !== dev.length) die(`entry count ${ANSWERS.length} != dev rows ${dev.length}`);

const out = ['op_id,sonnet_letter,rwxmap_letter,changed,basis,certainty'];
const pairs = {}, certs = {};
dev.forEach((r, i) => {
  const n = i + 1;
  const a = byN.get(n);
  if (!a) die(`no entry for dev row ${n}`);
  if (a[1] !== r.op_id) die(`op_id mismatch at N=${n}: entry ${a[1]} vs row ${r.op_id}`);
  const changed = a[2] === r.sonnet_letter ? 'no' : 'yes';
  if (changed === 'yes') { const k = `${r.sonnet_letter}->${a[2]}`; pairs[k] = (pairs[k] || 0) + 1; }
  certs[a[3]] = (certs[a[3]] || 0) + 1;
  out.push([r.op_id, r.sonnet_letter, a[2], changed, a[4], a[3]].map(enc).join(','));
});

writeFileSync(new URL('./answers-dev.csv', import.meta.url), out.join('\n') + '\n');
console.log(`rows: ${dev.length}`);
console.log('changes by pair:', JSON.stringify(pairs));
console.log('certainty:', JSON.stringify(certs));
