import fs from 'node:fs';
import assert from 'node:assert/strict';
import { createServer } from 'vite';
const roots=['../twst-nrc19-baseline','.'];const contexts=[];
try{
 for(const root of roots){const server=await createServer({root,plugins:[{name:'no-scan',configResolved(c){c.optimizeDeps.noDiscovery=true;c.optimizeDeps.include=[];}}],server:{middlewareMode:true,hmr:false,watch:null},appType:'custom'});const {createResourceBattleHost}=await server.ssrLoadModule('/src/workers/resourceBattleHost.ts');contexts.push({server,engine:createResourceBattleHost()});}
 const synthetic=fs.readFileSync('artifacts/nrc19/baseline-current.jsonl','utf8').trim().split('\n').map(JSON.parse);
 const actual=JSON.parse(fs.readFileSync('artifacts/nrc19/profile-baseline-before/case-original-zero-第19回統一火BS.json'));
 const rows=[...synthetic.map(r=>({input:r.input,candidate:r.selected.candidate})),...actual.topCandidates.map(r=>({input:actual.input,candidate:r.candidate}))];
 const report=[];
 for(const [index,row] of rows.entries()){
  const times=[];const outputs=[];
  for(const {engine} of contexts){await engine.prepare(row.input,row.candidate);const start=performance.now(),trials=[];
   for(let i=0;i<256;i++)trials.push(engine.trial(`equivalence:${index}:${i}`,row.candidate.policy,i<2));
   times.push(performance.now()-start);outputs.push(trials);
  }
  assert.deepEqual(outputs[1],outputs[0]);report.push({case:row.input.preset.id,candidate:index,trials:256,baselineMs:times[0],afterMs:times[1],identical:true});
 }
 fs.writeFileSync('artifacts/nrc19/replay-equivalence.json',JSON.stringify(report,null,2));console.log(report);
}finally{for(const c of contexts)await c.server.close();}
