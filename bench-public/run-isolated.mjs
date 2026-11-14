import fs from 'node:fs';
import {spawnSync} from 'node:child_process';
const variant=process.argv[2];
if(!['G1','G2','R1','R2','T1','T2'].includes(variant))throw new Error('Unknown variant');
const plan=JSON.parse(fs.readFileSync('bench-public/plan-wave4.json'));
const seed=Number(process.argv[3]);
if(!Number.isInteger(seed)||seed<0||seed>2)throw new Error("Invalid replicate");
for(let i=0;i<plan.length;i++){
 const order=(seed+i)%2?['candidate','baseline']:['baseline','candidate'];
 for(const source of order){
  console.log(JSON.stringify({phase:'isolated-start',variant,source,seed,caseIndex:i,time:new Date().toISOString()}));
  const result=spawnSync(process.execPath,['scripts/benchmarks/paired.mjs',`--before=${source}`,'--single=true','--inputs=bench-public/profiles.generated.json','--plan=bench-public/plan-wave4.json',`--case-index=${i}`,'--time-ms=30000','--audit=1024','--supports=current',`--nonce=actions-isolated-wave4-seed${seed}`,`--tag=${variant}-seed${seed}-${source}`,'--isolation=separate-source-process'],{stdio:'inherit',env:process.env});
  if(result.status!==0)throw new Error(`Child failed: ${variant}/${source}/${seed}/${i}: ${result.status}`);
 }
}
