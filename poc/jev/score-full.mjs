import { readFileSync } from 'node:fs';
const rd=p=>readFileSync(p,'utf8').split('\n').filter(l=>l.trim()).map(l=>JSON.parse(l));
const rows=p=>new Map(JSON.parse(readFileSync(p,'utf8')).map(r=>[r.row_id,r]));

// ================= POC A =================
const RA=rows('rowsA-full.json');
const A=rd('outA-full.jsonl').filter(o=>!o.error).map(o=>({...RA.get(o.row_id),p:o.answers.isX.noul,r1:o.answers.road1.noul,r2:o.answers.road2.noul}));
const X=A.filter(r=>r.truth==='x'), W=A.filter(r=>r.truth==='w');
console.log(`POC A — raise-only tier, ${A.length} rows step 2 calls w (${X.length} truth-x leaks, ${W.length} truth-w)`);
console.log('\n  threshold   leaks closed      false alarms      ratio   (bar: 10.0)');
const TS=[0.3,0.5,0.6,0.7,0.8,0.85,0.9,0.95];
for(const t of TS){
  const c=X.filter(r=>r.p>=t).length, f=W.filter(r=>r.p>=t).length;
  console.log(`   ${t.toFixed(2)}       ${String(c).padStart(3)}/${X.length} (${(100*c/X.length).toFixed(0)}%)   ${String(f).padStart(3)}/${W.length} (${(100*f/W.length).toFixed(1)}%)   ${f?(c/f).toFixed(2):'inf'}`);
}
// LOVO: threshold chosen on 12 vendors, scored on the 13th
const vendors=[...new Set(A.map(r=>r.provider))];
console.log(`\n  leave-one-vendor-out over ${vendors.length} vendors (threshold picked on the other 12 by best ratio with >=25% of leaks closed):`);
let LC=0,LF=0;
for(const v of vendors){
  const tr=A.filter(r=>r.provider!==v), te=A.filter(r=>r.provider===v);
  let best=null;
  for(const t of TS){
    const c=tr.filter(r=>r.truth==='x'&&r.p>=t).length, f=tr.filter(r=>r.truth==='w'&&r.p>=t).length;
    const tot=tr.filter(r=>r.truth==='x').length;
    if(tot===0||c/tot<0.25) continue;
    const ratio=f?c/f:Infinity;
    if(!best||ratio>best.ratio) best={t,ratio};
  }
  if(!best) continue;
  const c=te.filter(r=>r.truth==='x'&&r.p>=best.t).length, f=te.filter(r=>r.truth==='w'&&r.p>=best.t).length;
  LC+=c; LF+=f;
  console.log(`    ${v.padEnd(22)} t=${best.t.toFixed(2)}  closed ${String(c).padStart(3)}/${String(te.filter(r=>r.truth==='x').length).padStart(3)}  false ${String(f).padStart(3)}/${String(te.filter(r=>r.truth==='w').length).padStart(3)}`);
}
console.log(`    ${'LOVO TOTAL'.padEnd(22)}       closed ${LC}/${X.length}  false ${LF}/${W.length}  ratio ${LF?(LC/LF).toFixed(2):'inf'}`);

// road diagnostics at a mid threshold
const T=0.7;
const raised=A.filter(r=>r.p>=T);
console.log(`\n  at t=${T}: ${raised.length} raised — road1 led ${raised.filter(r=>r.r1>=r.r2).length}, road2 led ${raised.filter(r=>r.r2>r.r1).length}`);

// ================= POC B =================
const RB=rows('rowsB-full.json');
const B=rd('outB-full.jsonl').filter(o=>!o.error).map(o=>({...RB.get(o.row_id),c:o.answers.rwx.choice,conf:o.answers.rwx.confidence}));
const ord={r:0,w:1,x:2};
let ok=0,leak=0,tight=0;const M={};
for(const r of B){const k=r.truth+'->'+r.c;M[k]=(M[k]||0)+1;
  if(r.c===r.truth)ok++;else if(ord[r.c]<ord[r.truth])leak++;else tight++;}
console.log(`\n\nPOC B — whole job cold, ${B.length} rows of the 15-provider corpus`);
console.log(`  exact ${ok} (${(100*ok/B.length).toFixed(1)}%)   leaks ${leak} (${(100*leak/B.length).toFixed(1)}%)   over-tight ${tight} (${(100*tight/B.length).toFixed(1)}%)`);
console.log('  confusion:');
for(const t of ['r','w','x']) console.log('    truth '+t+': '+['r','w','x'].map(c=>`${c}=${M[t+'->'+c]||0}`).join('  '));
console.log(`\n  for comparison, the mechanical tool on these same rows (fitted, tuned on them): 93.8% exact / 1.8% leaks / 4.5% over-tight`);
// per provider
console.log('\n  per provider:');
const pv=[...new Set(B.map(r=>r.provider))].sort();
for(const p of pv){const s=B.filter(r=>r.provider===p);
  const e=s.filter(r=>r.c===r.truth).length, l=s.filter(r=>ord[r.c]<ord[r.truth]).length;
  console.log(`    ${p.padEnd(14)} n=${String(s.length).padStart(4)}  exact ${(100*e/s.length).toFixed(1).padStart(5)}%  leaks ${String(l).padStart(3)} (${(100*l/s.length).toFixed(1)}%)`);}
