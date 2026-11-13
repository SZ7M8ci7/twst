import fs from 'node:fs';
import assert from 'node:assert/strict';
const [before,after,out]=process.argv.slice(2);
const read=dir=>fs.readdirSync(dir).filter(f=>f.startsWith('case-')).map(f=>JSON.parse(fs.readFileSync(dir+'/'+f)));
const a=read(before),b=read(after),key=r=>r.profile+'|'+r.caseId,byKey=new Map(b.map(r=>[key(r),r]));
for(const rs of [a,b]) { assert.equal(new Set(rs.map(key)).size,rs.length); for(const field of ['sourceHash','catalogHash','presetsHash','profileManifestHash','supportMode','durationMs','auditTrials']) assert.ok(new Set(rs.map(r=>r[field])).size<=1,`Mixed ${field}`); }
const tuning=['2026/06-2全DF','2026/06-2木BS','2026/06-1火ATK','第18回統一全BS','第18回統一水ATK','第17回統一全DF'];
const rows=a.flatMap(x=>{const y=byKey.get(key(x));if(!y)return[];assert.deepEqual(y.input,x.input);for(const field of ['nonce','durationMs','auditTrials','catalogHash','presetsHash','profileManifestHash','supportMode'])assert.equal(y[field],x[field]);for(const r of [x,y]){assert.equal(r.selection,'displayed-finalists');assert.ok(r.constraints.every(c=>c.ok));assert.equal(r.topCandidates[0].rank,1);}
 const p=x.topCandidates[0].validation1024,q=y.topCandidates[0].validation1024;
 return[{profile:x.profile,id:x.caseId,current:x.caseId.startsWith('第19回'),development:tuning.includes(x.caseId),kind:x.preset.kind,unified:x.caseId.includes('統一'),before:p.expectedMaxOfAttempts,after:q.expectedMaxOfAttempts,delta:q.expectedMaxOfAttempts-p.expectedMaxOfAttempts,maxDelta:q.max-p.max,p95Delta:q.p95-p.p95,winDelta:q.winRate-p.winRate,evaluatedBefore:x.evaluated,evaluatedAfter:y.evaluated}];});
const maxima=new Map();for(const r of rows)maxima.set(r.id,Math.max(maxima.get(r.id)||0,r.before));
for(const r of rows){r.normalizedDelta=maxima.get(r.id)?r.delta/maxima.get(r.id):0;r.relativeDelta=r.before?r.delta/r.before:0;}
const summary=rs=>({n:rs.length,expected30Delta:rs.reduce((s,r)=>s+r.delta,0)/Math.max(1,rs.length),normalizedDelta:rs.reduce((s,r)=>s+r.normalizedDelta,0)/Math.max(1,rs.length),maxDelta:rs.reduce((s,r)=>s+r.maxDelta,0)/Math.max(1,rs.length),p95Delta:rs.reduce((s,r)=>s+r.p95Delta,0)/Math.max(1,rs.length),winRateDelta:rs.reduce((s,r)=>s+r.winDelta,0)/Math.max(1,rs.length),wins:rs.filter(r=>r.delta>1).length,losses:rs.filter(r=>r.delta< -1).length,ties:rs.filter(r=>Math.abs(r.delta)<=1).length});
const current=summary(rows.filter(r=>r.current)),historical=summary(rows.filter(r=>!r.current));
const groups=field=>Object.fromEntries([...new Set(rows.map(r=>r[field]))].map(v=>[v,summary(rows.filter(r=>r[field]===v))]));
const result={matched:rows.length,beforeCases:a.length,afterCases:b.length,complete185:rows.length===185&&current.n===25&&historical.n===160,current,historical,weightedDelta:(current.n&&historical.n)?0.7*current.expected30Delta+0.3*historical.expected30Delta:null,weightedNormalizedDelta:(current.n&&historical.n)?0.7*current.normalizedDelta+0.3*historical.normalizedDelta:null,profiles:groups('profile'),subjects:groups('id'),kinds:groups('kind'),pastNormal:summary(rows.filter(r=>!r.current&&!r.unified)),pastUnified:summary(rows.filter(r=>!r.current&&r.unified)),development:summary(rows.filter(r=>r.development)),holdout:summary(rows.filter(r=>!r.current&&!r.development)),regressionsOver5Percent:rows.filter(r=>r.relativeDelta<-.05),rows};
if(out)fs.writeFileSync(out,JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));
