import fs from 'node:fs';
const S=process.argv[2], G='/home/hamr/PycharmProjects/rwxlite/data/gate-2026-11-07/';
function rows(t){const out=[];let r=[],f='',q=false;for(let i=0;i<t.length;i++){const c=t[i];if(q){if(c=='"'){if(t[i+1]=='"'){f+='"';i++}else q=false}else f+=c}else if(c=='"')q=true;else if(c==','){r.push(f);f=''}else if(c=='\n'){r.push(f);out.push(r);r=[];f=''}else if(c!='\r')f+=c}if(f||r.length){r.push(f);out.push(r)}return out}
const rd=f=>rows(fs.readFileSync(G+f,'utf8')).slice(1).filter(r=>r.length>1);
const B=rd('blind.csv'),T=Object.fromEntries(rd('truth.csv')),P=Object.fromEntries(rd('part.csv'));
const names=JSON.parse(fs.readFileSync(S+'/vendors.json'));const vOf=Object.fromEntries(names.map((p,i)=>[p,'v'+String(i).padStart(3,'0')]));
const RUNS=['out-081-mech','out-branch-mech','out-081','out-branch'];const LBL=['0.8.1 mech','branch mech','0.8.1 + Jev','branch + Jev'];
const data=RUNS.map(()=>({}));const stat=RUNS.map(()=>({sent:0,failed:0,tin:0,models:new Set()}));
RUNS.forEach((d,i)=>{for(const v of Object.values(vOf)){
  const r=JSON.parse(fs.readFileSync(`${S}/${d}/${v}.rwxmap.review.json`));for(const x of r.rows)data[i][v+' '+x.method+' '+x.path]=x;
  const j=JSON.parse(fs.readFileSync(`${S}/${d}/${v}.rwxmap.json`)).jev;if(j&&j.mode==='on')stat[i].models.add(j.model);
  const log=fs.readFileSync(`${S}/${d}/${v}.log`,'utf8');const m=log.match(/(\d+) sent · (\d+) answered · (\d+) failed.* (\d+) in \//);if(m){stat[i].sent+=+m[1];stat[i].failed+=+m[3];stat[i].tin+=+m[4]}}});
const seen=new Set('adyen appcenter atlassian azure box clearblade dracoon gitea github gitlab jira keycloak linode microsoft netbox notion openai slack trello twilio vercel whatsapp xero zoom'.split(' '));
const rank={r:0,w:1,x:2};let missing=0;
const tal=RUNS.map(()=>({}));const tally=(i,k,L,t)=>{const s=tal[i][k]??={n:0,e:0,l:0,t:0};const d=rank[L]-rank[t];s.n++;d==0?s.e++:d<0?s.l++:s.t++};
const changed=[],jevDis=[];let missingPart=0;
for(const [id,prov,method,path,operationId] of B){
  const k=vOf[prov]+' '+method+' '+path;const xs=data.map(d=>d[k]);
  if(xs.some(x=>!x)){missing++;continue}
  const t=T[id],part=P[id];if(!t||!part)missingPart++;
  const clean=!prov.split(/[.:]/).some(l=>seen.has(l));
  xs.forEach((x,i)=>{for(const key of ['all',part,...(clean?['clean']:[])])tally(i,key,x.letter,t)});
  const [m0,m1,j0,j1]=xs;
  const f2=m0.letter!==m1.letter;
  const f1=!f2&&j1.letter!==j0.letter&&j1.evidence==='jev'&&j1.letter==='r';
  if(j0.letter!==j1.letter||f2) changed.push({id,part,prov,method,path,operationId,t,l081:j0.letter,lbr:j1.letter,m081:m0.letter,mbr:m1.letter,rule:f2?'F2 credential-set (mech differs)':f1?'F1 jev-lower->r':'other'});
  if(!f2&&!f1&&j0.letter!==j1.letter)jevDis.push(id);
}
console.log('missing joins',missing,'missing part/truth',missingPart);
RUNS.forEach((d,i)=>console.log(LBL[i],'| sent',stat[i].sent,'failed',stat[i].failed,'input tokens',stat[i].tin,'models',[...stat[i].models].join(',')||'-'));
for(const k of ['all','write','general','clean']){console.log('\n'+k);RUNS.forEach((d,i)=>{const o=tal[i][k];const p=n=>`${n} (${(100*n/o.n).toFixed(1)}%)`;console.log(' ',LBL[i].padEnd(13),'n',o.n,'exact',p(o.e),'loose',p(o.l),'tight',p(o.t))})}
const byRule={};for(const c of changed){const b=byRule[c.rule]??={n:0,right:0,wrong:0};b.n++;const good=r=>r===c.t;(c.rule.startsWith('F2')?(good(c.mbr)&&!good(c.m081)):(good(c.lbr)&&!good(c.l081)))?b.right++:(c.rule.startsWith('F2')?good(c.m081)&&!good(c.mbr):good(c.l081)&&!good(c.lbr))?b.wrong++:0}
console.log('\nchanged rows by rule',JSON.stringify(byRule,null,1));
console.log('id | part | provider | method | path | operationId | truth | 0.8.1 mech>branch mech | 0.8.1 Jev>branch Jev | rule');
for(const c of changed)console.log([c.id,c.part,c.prov,c.method,c.path,c.operationId,c.t,c.m081+'>'+c.mbr,c.l081+'>'+c.lbr,c.rule].join(' | '));
console.log('\nJev-run disagreements on rows neither F1 nor F2 touched:',jevDis.length,jevDis.join(' '));
