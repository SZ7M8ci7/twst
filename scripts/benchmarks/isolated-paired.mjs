import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
const args=process.argv.slice(2),options=new Map(args.map(arg=>{const [key,...value]=arg.replace(/^--/,'').split('=');return[key,value.join('=')];}));
assert.ok(options.get('plan')&&options.get('tag'),'Explicit plan and unique tag are required');
assert.ok(!options.has('shard')&&!options.has('case-index'),'The supervisor owns case assignment');
const planned=JSON.parse(fs.readFileSync(options.get('plan'),'utf8')),concurrency=4,tag=options.get('tag');
const root=path.resolve('artifacts/nrc19');fs.mkdirSync(root,{recursive:true});
const active=new Map(),completed=[],failures=[];let stopping=false;
const reportPath=path.join(root,tag+'-process-report.json');
const save=()=>{const tmp=reportPath+'.pending';fs.writeFileSync(tmp,JSON.stringify({tag,processIsolation:'one-paired-case-per-child',concurrency,total:planned.length,completedIndices:completed,activeIndices:[...active.keys()],failures,updatedUtc:new Date().toISOString()},null,2));fs.renameSync(tmp,reportPath);};
const stop=()=>{stopping=true;for(const child of active.values())child.kill('SIGTERM');};
process.on('SIGINT',stop);process.on('SIGTERM',stop);
async function slotRun(slot){
 const fd=fs.openSync(path.join(root,tag+'-isolated-'+slot+'.log'),'a');
 try{
  for(let index=slot;index<planned.length&&!stopping;index+=concurrency){
   const child=spawn(process.execPath,[path.resolve('scripts/benchmarks/paired.mjs'),...args,`--case-index=${index}`,`--shard=${slot}/${concurrency}`,'--isolation=pair'],{stdio:['ignore',fd,fd]});
   active.set(index,child);save();
   const outcome=await new Promise(resolve=>{child.once('error',error=>resolve({error:String(error)}));child.once('exit',(code,signal)=>resolve({code,signal}));});
   active.delete(index);
   if(outcome.code!==0){failures.push({index,slot,...outcome,otherActiveIndices:[...active.keys()]});stop();save();return;}
   completed.push(index);save();console.log(JSON.stringify({tag,completed:completed.length,total:planned.length,index,slot}));
  }
 }finally{fs.closeSync(fd);}
}
await Promise.all(Array.from({length:concurrency},(_,slot)=>slotRun(slot)));
save();if(failures.length||stopping)process.exitCode=1;
