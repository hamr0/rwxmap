import fs from 'node:fs';
const S=process.argv[2], G='/home/hamr/PycharmProjects/rwxlite/data/gate-2026-11-04/';
function rows(t){const out=[];let r=[],f='',q=false;for(let i=0;i<t.length;i++){const c=t[i];if(q){if(c=='"'){if(t[i+1]=='"'){f+='"';i++}else q=false}else f+=c}else if(c=='"')q=true;else if(c==','){r.push(f);f=''}else if(c=='\n'){r.push(f);out.push(r);r=[];f=''}else if(c!='\r')f+=c}if(f||r.length){r.push(f);out.push(r)}return out}
const B=rows(fs.readFileSync(G+'blind.csv','utf8')).slice(1).filter(r=>r.length>1);
const by={};let dup=0;
for(const [id,prov,method,path,operationId,summary,description] of B){
  const s=by[prov]??={openapi:'3.0.3',info:{title:prov,version:'1'},paths:{}};
  const m=method.toLowerCase();const p=s.paths[path]??={};
  if(p[m]){dup++;console.error('DUP',prov,method,path,id);continue}
  const op={responses:{'200':{description:'ok'}}};
  if(operationId)op.operationId=operationId;if(summary)op.summary=summary;if(description)op.description=description;
  p[m]=op;
}
const names=Object.keys(by);
names.forEach((p,i)=>fs.writeFileSync(`${S}/specs/v${String(i).padStart(3,'0')}.json`,JSON.stringify(by[p])));
fs.writeFileSync(`${S}/vendors.json`,JSON.stringify(names));
console.log('rows',B.length,'providers',names.length,'dups',dup);
