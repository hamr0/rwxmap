import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { parseCsv } from '/home/hamr/PycharmProjects/rwxmap/tools/csv.js';
import { classifyRow } from '/home/hamr/PycharmProjects/rwxmap/src/index.js';
const OUT='/tmp/claude-1000/-home-hamr-PycharmProjects-rwxmap/8a1965a3-0844-4847-bd48-d8f97c795834/scratchpad/';

function load(dir, idCols){
  const ops=parseCsv(readFileSync(dir+'ops.csv','utf8'));
  const key=parseCsv(readFileSync(dir+'label/key.csv','utf8'));
  const truth=new Map();
  for(const f of readdirSync(dir+'label').filter(f=>/^labels-\d+\.csv$/.test(f)))
    for(const r of parseCsv(readFileSync(dir+'label/'+f,'utf8'))) truth.set(r.row_id,r.truth_class);
  const idx=new Map();
  for(const o of ops) idx.set(idCols.map(c=>o[c]).join('|'),o);
  const out=[];
  for(const k of key){
    const o=idx.get(idCols.map(c=>k[c]).join('|')); const t=truth.get(k.row_id);
    if(!o||!t) continue;
    out.push({row_id:k.row_id, provider:k.provider, method:o.method, path:o.path,
              operationId:o.operationId, summary:o.summary, description:o.description, truth:t});
  }
  return out;
}

// mulberry32 for a reproducible draw
function rng(seed){return()=>{seed|=0;seed=seed+0x6D2B79F5|0;let t=Math.imul(seed^seed>>>15,1|seed);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}
function sample(arr,n,r){const a=[...arr];for(let i=a.length-1;i>0;i--){const j=Math.floor(r()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a.slice(0,n);}

// ---- POC A: buildset rows the flow labels w ----
const bs=load('/home/hamr/PycharmProjects/rwxmap/data/buildset-2026-09-18/',['provider','method','path','operationId']);
const sentToJev=bs.filter(r=>classifyRow({method:r.method,path:r.path,operationId:r.operationId,summary:r.summary,description:r.description}).class==='w');
writeFileSync(OUT+'rowsA-full.json',JSON.stringify(sentToJev,null,1));
const rA=rng(20260920);
const pilotA=[...sample(sentToJev.filter(r=>r.truth==='x'),20,rA),...sample(sentToJev.filter(r=>r.truth==='w'),20,rA)];
writeFileSync(OUT+'rowsA-pilot.json',JSON.stringify(pilotA,null,1));

// ---- POC B: provider corpus, whole job ----
const pc=load('/home/hamr/PycharmProjects/rwxmap/data/provider-corpus-2026-09-16/',['provider','method','path','operationId']);
writeFileSync(OUT+'rowsB-full.json',JSON.stringify(pc,null,1));
const rB=rng(20260920);
const pilotB=['r','w','x'].flatMap(c=>sample(pc.filter(r=>r.truth===c),14,rB));
writeFileSync(OUT+'rowsB-pilot.json',JSON.stringify(pilotB,null,1));

const cnt=a=>['r','w','x','?'].map(c=>c+':'+a.filter(x=>x.truth===c).length).join(' ');
console.log('A full',sentToJev.length,cnt(sentToJev),'| A pilot',pilotA.length,cnt(pilotA));
console.log('B full',pc.length,cnt(pc),'| B pilot',pilotB.length,cnt(pilotB));
