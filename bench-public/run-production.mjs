import fs from 'node:fs';
import {spawnSync} from 'node:child_process';
const [variant,mode,repArg,indexArg]=process.argv.slice(2),rep=Number(repArg),index=Number(indexArg);
if(variant!=='V2'||!['long','short'].includes(mode))throw new Error('Invalid variant/mode');
const planPath=`bench-public/plan-V2-${mode}.json`,plan=JSON.parse(fs.readFileSync(planPath));
if(!Number.isInteger(index)||index<0||index>=plan.length||!Number.isInteger(rep)||rep<0||rep>(mode==='long'?2:0))throw new Error('Invalid case/replicate');
const order=(rep+index)%2?['candidate','baseline']:['baseline','candidate'];
for(const source of order){
 console.log(JSON.stringify({phase:'isolated-start',variant,mode,source,rep,caseIndex:index,time:new Date().toISOString()}));
 const result=spawnSync(process.execPath,['scripts/benchmarks/paired-production.mjs',`--before=${source}`,'--single=true','--inputs=bench-public/profiles.generated.json',`--plan=${planPath}`,`--case-index=${index}`,`--time-ms=${mode==='long'?180000:30000}`,'--audit=1024','--supports=current',`--nonce=actions-V2-tail-${mode}-20261114-seed${rep}`,`--tag=${variant}-${mode}-seed${rep}-${source}`,'--isolation=separate-source-process'],{stdio:'inherit',env:process.env});
 if(result.status!==0)throw new Error(`Child failed: ${variant}/${mode}/${source}/${rep}/${index}: ${result.status}`);
}
