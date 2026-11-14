import fs from 'node:fs';import {spawnSync} from 'node:child_process';
const [arm,repArg,shardArg,countArg]=process.argv.slice(2),rep=Number(repArg),shard=Number(shardArg),count=Number(countArg);
if(!['T3','null'].includes(arm)||!Number.isInteger(rep)||rep<0||rep>2||!Number.isInteger(shard)||shard<0||shard>=count)throw new Error('Invalid matrix');
const plan=JSON.parse(fs.readFileSync('bench-public/plan-current.json'));
for(let i=0;i<plan.length;i++){
 if(i%count!==shard)continue;
 for(const [source,lane] of [['baseline','A1'],['candidate','B1'],['candidate','B2'],['baseline','A2']]){
  console.log(JSON.stringify({phase:'isolated-start',arm,rep,caseIndex:i,source,lane,time:new Date().toISOString()}));
  const r=spawnSync(process.execPath,['scripts/benchmarks/paired-production.mjs',`--before=${source}`,'--single=true','--inputs=bench-public/profiles.generated.json','--plan=bench-public/plan-current.json',`--case-index=${i}`,'--time-ms=30000','--audit=1024','--supports=current',`--nonce=actions-current-T3-null-20261114-seed${rep}`,`--tag=${arm}-seed${rep}-${lane}`,'--isolation=ABBA-separate-source-process'],{stdio:'inherit',env:process.env});
  if(r.status!==0)throw new Error(`Failed:${arm}/${rep}/${i}/${lane}:${r.status}`);
 }
}
