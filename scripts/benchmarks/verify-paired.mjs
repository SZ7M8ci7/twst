import fs from 'node:fs';
import assert from 'node:assert/strict';
const [output,...tags]=process.argv.slice(2);
assert.ok(output&&tags.length,'Usage: verify-paired.mjs output.json tag [tag...]');
const root='artifacts/nrc19',read=dir=>fs.readdirSync(dir).filter(f=>f.startsWith('case-')&&f.endsWith('.json')).map(f=>JSON.parse(fs.readFileSync(dir+'/'+f,'utf8')));
const key=r=>r.profile+'|'+r.caseId,metric=r=>{const {optimism,...fixed}=r.validation1024;
 if(fixed.auto){const {expectedBestScore,...commonAuto}=fixed.auto;fixed.auto=commonAuto;}
 return fixed;};
const runs=[];
for(const tag of tags){
 const plan=JSON.parse(fs.readFileSync(`${root}/${tag}-before/plan-0.json`,'utf8'));
 const sides=['before','after'].map(side=>read(`${root}/${tag}-${side}`));
 const expected=new Set(plan.planned.map(r=>r.profile+'|'+r.id));
 let candidates=0,auditTrials=0,shared=0;
 for(const [index,rows] of sides.entries()){
  assert.equal(rows.length,expected.size,`${tag}: incomplete ${index}`);
  assert.equal(new Set(rows.map(key)).size,rows.length);
  for(const row of rows){
   assert.ok(expected.has(key(row)));assert.equal(row.selection,'displayed-finalists');
   assert.equal(row.sourceHash,index?plan.afterSourceHash:plan.sourceHash);
   for(const field of ['catalogHash','presetsHash','durationMs','auditTrials','supportMode'])assert.equal(row[field],plan[field]);
   assert.equal(row.profileManifestHash,plan.profilesHash);
   assert.equal(row.nonce,`${plan.nonceBase}:${row.profile}:${row.caseId}`);
   assert.ok(row.constraints.every(check=>check.ok));
   assert.ok(row.topCandidates.length>0&&row.topCandidates.length<=3);
   for(const [rank,result] of row.topCandidates.entries()){
    const v=result.validation1024;assert.equal(result.rank,rank+1);
    assert.equal(v.n,1024);assert.equal(v.trials,1024);assert.equal(v.max,v.replayScore);
    if(v.auto?.expectedBestScore!==undefined)assert.ok(Math.abs(v.auto.expectedBestScore-v.expectedMaxOfAttempts)<1e-7);
    assert.ok(v.expectedMaxOfAttempts>=0&&v.expectedMaxOfAttempts<=v.max+1e-8);
    assert.ok(v.p95>=0&&v.p95<=v.max);assert.ok(v.winRate>=0&&v.winRate<=1);
    candidates++;auditTrials+=v.trials;
   }
  }
 }
 const after=new Map(sides[1].map(row=>[key(row),row]));
 for(const before of sides[0]){
  const matched=after.get(key(before));assert.deepEqual(before.input,matched.input);
  const lookup=new Map(matched.topCandidates.map(row=>[row.candidate.id,row]));
  for(const candidate of before.topCandidates){const same=lookup.get(candidate.candidate.id);if(!same)continue;
   assert.deepEqual(candidate.candidate.cards,same.candidate.cards);
   assert.deepEqual(metric(candidate),metric(same));shared++;
  }
 }
 runs.push({tag,pairs:expected.size,candidates,auditTrials,sharedCandidateAudits:shared,sourceBefore:plan.sourceHash,sourceAfter:plan.afterSourceHash,catalogHash:plan.catalogHash,presetsHash:plan.presetsHash,profileManifestHash:plan.profilesHash});
}
for(const field of ['sourceBefore','sourceAfter','catalogHash','presetsHash','profileManifestHash'])assert.equal(new Set(runs.map(run=>run[field])).size,1,`Mixed ${field}`);
const report={complete:true,runs,pairs:runs.reduce((n,r)=>n+r.pairs,0),candidates:runs.reduce((n,r)=>n+r.candidates,0),auditTrials:runs.reduce((n,r)=>n+r.auditTrials,0),sharedCandidateAudits:runs.reduce((n,r)=>n+r.sharedCandidateAudits,0),constraintsPassed:true,maximaReplayed:true,identicalSharedAudits:true};
fs.writeFileSync(output,JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
