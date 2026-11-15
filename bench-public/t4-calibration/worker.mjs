import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createServer} from 'vite';
import {execFileSync} from 'node:child_process';
const [mode,sourceRoot,repText,countsFile,outFile]=process.argv.slice(2),root=path.resolve(sourceRoot),rep=Number(repText);
assert.ok(['pilot','measure'].includes(mode));assert.ok(Number.isInteger(rep)&&rep>=0&&rep<3);
const smoke=process.env.T4_CALIBRATION_SMOKE==='1';
const dir=path.dirname(new URL(import.meta.url).pathname),fixtureBytes=fs.readFileSync(path.join(dir,'fixtures.json'));
const hash=v=>createHash('sha256').update(v).digest('hex');
const fixtureHash=hash(fixtureBytes);assert.equal(fixtureHash,'40a7c850f70e22ac50a63e34465beec50494743336b2e1e240549a11d484c573');
const fixture=JSON.parse(fixtureBytes);assert.equal(fixture.rows.length,10);assert.equal(fixture.provenance.personalData,false);
const catalog=JSON.parse(fs.readFileSync(path.join(root,'src/assets/chara.json'))),known=new Set(catalog.map(c=>c.name));
for(const r of fixture.rows)for(const c of [...r.input.roster,...r.input.supports,...r.candidate.cards])assert.ok(known.has(c.name)&&c.name.endsWith('_dormitory'));
const original=JSON.stringify(fixture.rows),sourceDigest=()=>hash(execFileSync('git',['-C',root,'ls-files','src','vite.config.mts'],{encoding:'utf8'}).trim().split('\n').map(p=>p+':'+hash(fs.readFileSync(path.join(root,p)))).join('\n')),sourceHash=sourceDigest();
const result={mode,rep,smoke,sourceHash,fixtureHash,harnessHash:hash(fs.readFileSync(new URL(import.meta.url))),catalogHash:hash(JSON.stringify(catalog)),processId:process.pid,node:process.version,scope:'fixed-host calibration only; not adoption/full-search performance',cases:[]};
const save=()=>fs.writeFileSync(outFile,JSON.stringify(result,null,2));
const t0=performance.now();
const server=await createServer({root,configFile:path.join(root,'vite.config.mts'),plugins:[{name:'no-scan',configResolved(c){c.optimizeDeps.noDiscovery=true;c.optimizeDeps.include=[];}}],server:{middlewareMode:true,hmr:false,watch:null},appType:'custom'});
try{
 const {createResourceBattleHost}=await server.ssrLoadModule('/src/workers/resourceBattleHost.ts');result.importMs=performance.now()-t0;
 const hostStart=performance.now(),host=createResourceBattleHost();result.hostCreateMs=performance.now()-hostStart;
 const {candidateSatisfiesConstraints,cardVariants}=await server.ssrLoadModule('/src/domain/examSearch/variants.ts');
 const {withinLevelBudget,additionalLevelCost}=await server.ssrLoadModule('/src/domain/examSearch/levelAllocation.ts');
 const cat=Object.fromEntries(catalog.map(c=>[c.name,c]));
 for(const r of fixture.rows){assert.ok(candidateSatisfiesConstraints(r.input,r.candidate,cat));assert.ok(withinLevelBudget(r.input,r.candidate.cards,cat));assert.equal(additionalLevelCost(r.candidate.cards),r.input.additionalLevelCap);for(const c of r.candidate.cards){const raw=(c.support?r.input.supports:r.input.roster).find(x=>x.name===c.name);const v=cardVariants(raw,cat[c.name].rare,c.support,c.totsu,c.additionalLevels??0).find(x=>JSON.stringify(x.selectedMagic)===JSON.stringify(c.selectedMagic));assert.ok(v);assert.equal(v.level,c.level);assert.equal(c.additionalLevels??0,c.support?0:(r.input.additionalLevelCap?5:0));}}
 result.constraintsLegal=true;
 const kernels=['warmTrial','prepareOnly','prepareTrial'];
 async function fixed(row,index,kernel,count,phase){
  const checksum={score:0,fitness:0,turns:0,retired:0};
  for(let i=0;i<count;i++){
   if(kernel!=='warmTrial')await host.prepare(row.input,row.candidate);
   if(kernel!=='prepareOnly'){
    const v=host.trial(`T4-current-cal-v1:rep${rep}:case${index}:${kernel}:${phase}:${i}`,row.candidate.policy,false);
    checksum.score+=Number.isFinite(v.score)?v.score:0;checksum.fitness+=Number.isFinite(v.fitness)?v.fitness:0;
    checksum.turns+=Number.isFinite(v.finishTurn)?v.finishTurn:0;checksum.retired+=Number(v.retired===true);
   }
  }
  return checksum;
 }
 async function warm(row,index,kernel){
  await host.prepare(row.input,row.candidate);const start=performance.now();let count=0;
  do{await fixed(row,index,kernel,16,`warm${count}`);count+=16;}while(performance.now()-start<(smoke?5:750));
  return {count,wallMs:performance.now()-start};
 }
 const counts=mode==='measure'?JSON.parse(fs.readFileSync(countsFile)):null;
 if(counts){assert.equal(counts.fixtureHash,fixtureHash);assert.equal(counts.rep,rep);assert.equal(counts.smoke,smoke);}
 const order=fixture.rows.map((_,i)=>(i+rep)%fixture.rows.length);result.caseOrder=order;
 for(const index of order){
  const row=fixture.rows[index],record={index,id:row.input.preset.id,kind:row.input.preset.kind,cap:row.input.additionalLevelCap,allocations:row.candidate.cards.map(c=>({name:c.name,support:c.support,level:c.level,additionalLevels:c.additionalLevels??0})),kernels:{}};
  for(const kernel of kernels){
   global.gc?.();const warmup=await warm(row,index,kernel);global.gc?.();
   if(kernel==='warmTrial'){
    // Reprepare then warm this fixed runtime: its lazy caches are populated,
    // unlike the separate prepare+first-trial kernel.
    await host.prepare(row.input,row.candidate);await fixed(row,index,kernel,64,'cache-prime');
   }
   if(mode==='pilot'){
    const start=performance.now();let n=0;
    do{await fixed(row,index,kernel,16,`pilot${n}`);n+=16;}while(performance.now()-start<(smoke?5:250));
    const elapsed=performance.now()-start,targetMs=smoke?20:(kernel==='warmTrial'?6000:3000);
    const cap=kernel==='warmTrial'?262144:65536,count=Math.max(16,Math.min(cap,Math.ceil(n*targetMs/elapsed/16)*16));
    record.kernels[kernel]={count,pilotCount:n,pilotWallMs:elapsed,targetMs,warmup,atCap:count===cap};
   }else{
    const count=counts.cases.find(c=>c.index===index).kernels[kernel].count;
    assert.ok(Number.isInteger(count)&&count>=16);const cpuStart=process.cpuUsage(),start=performance.now();
    const checksum=await fixed(row,index,kernel,count,'measurement'),wallMs=performance.now()-start,cpu=process.cpuUsage(cpuStart);
    record.kernels[kernel]={count,wallMs,cpuMs:(cpu.user+cpu.system)/1000,cpuUserMs:cpu.user/1000,cpuSystemMs:cpu.system/1000,checksum,warmup,durationSufficient:wallMs>=2000};
   }
  }
  if(mode==='measure'){
   await host.prepare(row.input,row.candidate);const audit=createHash('sha256');
   for(let i=0;i<128;i++){const seed=`T4-current-cal-audit-v1:rep${rep}:case${index}:${i}`,trial=host.trial(seed,row.candidate.policy,i<4);audit.update(JSON.stringify(trial)+'\n');if(i<4)audit.update(JSON.stringify(host.replay(seed,trial.plan,true))+'\n');}
   record.audit={trials:128,replays:4,digest:audit.digest('hex')};
  }
  result.cases.push(record);assert.equal(JSON.stringify(fixture.rows),original,'fixture mutated');save();console.log(JSON.stringify({phase:mode,rep,case:index,complete:true}));
 }
 assert.equal(result.cases.length,10);assert.equal(sourceDigest(),sourceHash,'source changed during run');result.sourceUnchanged=true;result.completed=true;result.inputUnchanged=true;save();
}finally{await server.close()}
