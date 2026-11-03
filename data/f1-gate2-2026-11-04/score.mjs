import fs from 'node:fs';
const S=process.argv[2], G='/home/hamr/PycharmProjects/rwxlite/data/gate-2026-11-04/';
function rows(t){const out=[];let r=[],f='',q=false;for(let i=0;i<t.length;i++){const c=t[i];if(q){if(c=='"'){if(t[i+1]=='"'){f+='"';i++}else q=false}else f+=c}else if(c=='"')q=true;else if(c==','){r.push(f);f=''}else if(c=='\n'){r.push(f);out.push(r);r=[];f=''}else if(c!='\r')f+=c}if(f||r.length){r.push(f);out.push(r)}return out}
const B=rows(fs.readFileSync(G+'blind.csv','utf8')).slice(1).filter(r=>r.length>1);
const T=Object.fromEntries(rows(fs.readFileSync(G+'truth.csv','utf8')).slice(1).filter(r=>r.length>1));
const names=JSON.parse(fs.readFileSync(S+'/vendors.json'));const vOf=Object.fromEntries(names.map((p,i)=>[p,'v'+String(i).padStart(3,'0')]));
const out={};let tokIn=0,sent=0,failed=0;
for(const v of Object.values(vOf)){const r=JSON.parse(fs.readFileSync(`${S}/out/${v}.rwxmap.review.json`));for(const x of r.rows)out[v+' '+x.method+' '+x.path]=x;
 const log=fs.readFileSync(`${S}/out/${v}.log`,'utf8');const m=log.match(/(\d+) sent · (\d+) answered · (\d+) failed.* (\d+) in \//);if(m){sent+=+m[1];failed+=+m[3];tokIn+=+m[4]}}
const seen=new Set('adyen appcenter atlassian azure box clearblade dracoon gitea github gitlab jira keycloak linode microsoft netbox notion openai slack trello twilio vercel whatsapp xero zoom'.split(' '));
const rank={r:0,w:1,x:2};let missing=0;const f1=[];
const lines={mech:{},shipped:{},f1:{}};
const tally=(o,k,L,t)=>{const s=o[k]??={n:0,e:0,l:0,t:0};const d=rank[L]-rank[t];s.n++;d==0?s.e++:d<0?s.l++:s.t++};
const mechOf={};for(const v of fs.readdirSync(S+'/mech').filter(f=>f.endsWith('review.json'))){}
import { classifyRow } from '/home/hamr/PycharmProjects/rwxmap/src/index.js';
for(const [id,prov,method,path,operationId,summary,description] of B){
  const x=out[vOf[prov]+' '+method+' '+path];if(!x){missing++;continue}
  const t=T[id];const mech=classifyRow({method,path,operationId,summary,description}).class;
  const isF1 = x.evidence==='jev' && x.letter==='r';
  const shipped = isF1 ? 'w' : x.letter;
  if(isF1) f1.push([id,prov,method,path,operationId,'truth='+t]);
  const clean=!prov.split(/[.:]/).some(l=>seen.has(l));
  for(const [k,L] of [['mech',mech],['shipped',shipped],['f1',x.letter]]){tally(lines[k],'all',L,t);if(clean)tally(lines[k],'clean',L,t)}
}
console.log('missing joins',missing,'| requests sent',sent,'failed',failed,'input tokens',tokIn);
for(const k in lines)for(const s in lines[k]){const o=lines[k][s];console.log(k.padEnd(8),s.padEnd(6),o.n,'exact',o.e,(100*o.e/o.n).toFixed(1)+'%','loose',o.l,'tight',o.t)}
console.log('F1 moves',f1.length,'right',f1.filter(r=>r[5]=='truth=r').length);for(const r of f1)console.log(' ',r.join(' | '));
