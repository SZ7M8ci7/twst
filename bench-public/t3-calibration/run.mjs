import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';import {spawnSync} from 'node:child_process';import os from 'node:os';
const [base,candidate,repText,output]=process.argv.slice(2),rep=Number(repText),out=path.resolve(output);
assert.ok(Number.isInteger(rep)&&rep>=0&&rep<3);fs.mkdirSync(out,{recursive:true});
const worker=path.join(path.dirname(new URL(import.meta.url).pathname),'worker.mjs'),counts=path.join(out,'counts.json');
const manifest={rep,started:new Date().toISOString(),runner:process.env.RUNNER_NAME,hostname:os.hostname(),cpus:os.cpus().map(x=>({model:x.model,speed:x.speed})),platform:os.platform(),node:process.version,sourceOrder:[['A','B','C'],['B','C','A'],['C','A','B']][rep],meaning:{A:'T1',B:'T1 null',C:'T3'},smoke:process.env.T3_CALIBRATION_SMOKE==='1'};
const launch=(args)=>{const p=spawnSync(process.execPath,['--expose-gc',worker,...args],{stdio:'inherit',env:process.env});assert.equal(p.status,0,`child failed ${args.join(' ')}`);};
fs.writeFileSync(path.join(out,'manifest.json'),JSON.stringify(manifest,null,2));
launch(['pilot',base,String(rep),'-',counts]);
for(const label of manifest.sourceOrder)launch(['measure',label==='C'?candidate:base,String(rep),counts,path.join(out,`${label}.json`)]);
const rows=Object.fromEntries(['A','B','C'].map(l=>[l,JSON.parse(fs.readFileSync(path.join(out,`${l}.json`)))]));
assert.equal(rows.A.sourceHash,rows.B.sourceHash);assert.notEqual(rows.A.sourceHash,rows.C.sourceHash);
for(const x of Object.values(rows)){assert.ok(x.completed&&x.inputUnchanged);assert.equal(x.fixtureHash,rows.A.fixtureHash);assert.equal(x.harnessHash,rows.A.harnessHash);assert.equal(x.catalogHash,rows.A.catalogHash);}
const summary={...manifest,completed:new Date().toISOString(),checks:{sourceSeparated:true,nullSameSource:true,allDigestsEqual:true,allChecksumsEqual:true,durationSufficient:true},cases:[]};
for(let i=0;i<5;i++){
 const a=rows.A.cases.find(c=>c.index===i),b=rows.B.cases.find(c=>c.index===i),c=rows.C.cases.find(c=>c.index===i);
 assert.equal(a.audit.digest,b.audit.digest);assert.equal(a.audit.digest,c.audit.digest);
 const item={index:i,id:a.id,kind:a.kind,kernels:{}};
 for(const k of ['warmTrial','prepareOnly','prepareTrial']){
  const [x,y,z]=[a.kernels[k],b.kernels[k],c.kernels[k]];assert.equal(x.count,y.count);assert.equal(x.count,z.count);assert.deepEqual(x.checksum,y.checksum);assert.deepEqual(x.checksum,z.checksum);
  const sufficient=[x,y,z].every(r=>r.durationSufficient);summary.checks.durationSufficient&&=sufficient;
  // Speed ratio >1 means B faster than A, or C faster than the paired T1 geometric mean.
  item.kernels[k]={count:x.count,durationSufficient:sufficient,nullCpuSpeedRatio:x.cpuMs/y.cpuMs,candidateCpuSpeedRatio:Math.sqrt(x.cpuMs*y.cpuMs)/z.cpuMs,nullWallSpeedRatio:x.wallMs/y.wallMs,candidateWallSpeedRatio:Math.sqrt(x.wallMs*y.wallMs)/z.wallMs,wallMs:{A:x.wallMs,B:y.wallMs,C:z.wallMs},cpuMs:{A:x.cpuMs,B:y.cpuMs,C:z.cpuMs}};
 }
 summary.cases.push(item);
}
const gm=xs=>Math.exp(xs.reduce((s,x)=>s+Math.log(x),0)/xs.length),am=xs=>xs.reduce((s,x)=>s+x,0)/xs.length;
summary.kernelSummary={};for(const k of ['warmTrial','prepareOnly','prepareTrial']){summary.kernelSummary[k]={};for(const metric of ['nullCpuSpeedRatio','candidateCpuSpeedRatio','nullWallSpeedRatio','candidateWallSpeedRatio']){const xs=summary.cases.map(c=>c.kernels[k][metric]);summary.kernelSummary[k][metric]={arithmetic:am(xs),geometric:gm(xs),all:xs};}}
summary.interpretation='Calibration only. No adoption, no full-search speed inference, and no retroactive pass of the predeclared 5% end-to-end gate. Fewer than 2s kernels are insufficient, not selectively omitted.';
fs.writeFileSync(path.join(out,'summary.json'),JSON.stringify(summary,null,2));console.log(JSON.stringify(summary));
