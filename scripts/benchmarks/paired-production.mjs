import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createServer } from 'vite';
import { runHistoryCase } from './exam-search-history-case-production.mjs';
const args=new Map(process.argv.slice(2).map(a=>{const [k,...v]=a.replace(/^--/,'').split('=');return[k,v.join('=')];}));
const root=process.cwd(),profiles=JSON.parse(fs.readFileSync(args.get('inputs')||'artifacts/nrc19/profiles.json','utf8'));
const historical=JSON.parse(fs.readFileSync('scripts/benchmarks/historical-presets.json','utf8'));
const tuning=['2026/06-2全DF','2026/06-2木BS','2026/06-1火ATK','第18回統一全BS','第18回統一水ATK','第17回統一全DF'];
const durationMs=Number(args.get('time-ms')||30000),auditTrials=Number(args.get('audit')||1024),nonceBase=args.get('nonce')||'nrc19-primary-v1';
const [shard,count]=(args.get('shard')||'0/1').split('/').map(Number);
assert.ok(shard>=0&&shard<count&&count>=1);
const digest=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
async function context(source,label){
 const sourceRoot=path.resolve(source),tag=(args.get('tag')||'primary')+'-'+label,outputDir=path.join(root,'artifacts/nrc19',tag);fs.mkdirSync(outputDir,{recursive:true});
 const server=await createServer({root:sourceRoot,configFile:path.join(sourceRoot,'vite.config.mts'),plugins:[{name:'benchmark-no-scan',configResolved(c){c.optimizeDeps.noDiscovery=true;c.optimizeDeps.include=[];}}],cacheDir:path.join(outputDir,'vite-'+shard),server:{middlewareMode:true,hmr:false,watch:null},appType:'custom'});
 const modules={};
 for(const [file,names] of [['workers/resourceBattleHost',['createResourceBattleHost']],['domain/examSearch/scheduler',['SearchSession']],['workers/examSearchRun',['runSessionWithinBudget']],['domain/examSearch/statistics',['metrics','scoreDistribution','autoScoreMetrics','compareAutoResults','searchDevelopmentQuality','displayProgress','rankedResults']],['domain/examSearch/types',['ENGINE_VERSION']],['domain/examSearch/variants',['validateInput','candidateSatisfiesConstraints']]]){const m=await server.ssrLoadModule('/src/'+file+'.ts');for(const name of names)modules[name]=m[name];}
 const {default:cards}=await server.ssrLoadModule('/src/assets/chara.json');modules.catalog=Object.fromEntries(cards.map(c=>[c.name,c]));
 const {examPresetDefinitions:presets}=await server.ssrLoadModule('/src/utils/examPresets.ts');
 const sourceFiles=fs.readdirSync(path.join(sourceRoot,'src'),{recursive:true}).filter(f=>/\.(ts|vue|json)$/.test(f)).sort();
 const dependencies=[...sourceFiles.map(f=>'src/'+f),...fs.readdirSync(path.join(sourceRoot,'build'),{recursive:true}).filter(f=>/\.(ts|mts|js)$/.test(f)).map(f=>'build/'+f),'vite.config.mts','package-lock.json'];
 const sourceHash=digest(dependencies.sort().map(f=>[f,fs.readFileSync(path.join(sourceRoot,f),'utf8')]));
 const catalogHash=digest(cards),presetsHash=digest(presets);
 return{server,modules,presets,sourceRoot,sourceHash,catalogHash,presetsHash,tag,outputDir};
}
const before=await context(args.get('before')||'../twst-nrc19-baseline','before');
const after=args.has('single')?null:await context(args.get('after')||'.','after');
try{
 if(after){assert.equal(after.catalogHash,before.catalogHash,'Card data differ');assert.equal(after.presetsHash,before.presetsHash,'Preset data differ');}
 const supportMode=args.get('supports')||'historical';assert.ok(['historical','current'].includes(supportMode));
 const supports=supportMode==='historical'?profiles.supports:Object.values(before.modules.catalog).map(c=>({name:c.name,level:c.rare==='SSR'?120:c.rare==='SR'?90:70,totsu:4,magicLevels:[10,10,10],buddyLevels:[10,10,10],allowUpgrade:false}));
 const current=before.presets.filter(p=>p.id.startsWith('第19回')).map(p=>p.id),suite=args.get('cases')||'current';
 const ids=suite==='current'?current:suite==='development'?[...current,...tuning]:suite==='holdout'?historical.filter(x=>!tuning.includes(x)):suite==='historical'?historical:suite==='all'?[...current,...historical]:suite.split(',');
 const names=(args.get('profiles')||Object.keys(profiles.profiles).join(',')).split(',');
 const planned=args.has('plan')?JSON.parse(fs.readFileSync(args.get('plan'),'utf8')):names.flatMap(profile=>ids.map(id=>({profile,id})));
 assert.ok(Array.isArray(planned)&&planned.length>0,'Empty case plan');
 assert.equal(new Set(planned.map(row=>JSON.stringify([row.profile,row.id]))).size,planned.length,'Duplicate planned cases');
 for(const row of planned){assert.ok(profiles.profiles[row.profile],row.profile);assert.ok(before.presets.some(p=>p.id===row.id),row.id);}
 const caseIndex=args.has('case-index')?Number(args.get('case-index')):null;
 if(caseIndex!==null)assert.ok(Number.isInteger(caseIndex)&&caseIndex>=0&&caseIndex<planned.length);
 const planPath=path.join(before.outputDir,`plan-${shard}.json`),planTemporary=planPath+'.'+process.pid+'.pending';
 fs.writeFileSync(planTemporary,JSON.stringify({profilesHash:digest(profiles),planned,durationMs,auditTrials,nonceBase,shard,count,supportMode,sourceHash:before.sourceHash,afterSourceHash:after?.sourceHash,catalogHash:before.catalogHash,presetsHash:before.presetsHash,processIsolation:args.get('isolation')||'reused-shard'},null,2));
 fs.renameSync(planTemporary,planPath);
 for(const [i,{profile,id}] of planned.entries()){
  if(i%count!==shard || caseIndex!==null&&i!==caseIndex)continue;
  const preset=structuredClone(before.presets.find(p=>p.id===id));assert.ok(preset,id);preset.difficulty??=1.5;
  const mode=args.get('challenges')||'on';assert.ok(['on','auto','off'].includes(mode));
  const input={preset,...structuredClone(profiles.profiles[profile]),supports:preset.title.includes('統一')?structuredClone(supports):[],itemsPerLimitBreak:1,additionalLevelCap:0,target:0,attempts:30,desiredProbability:.05,tolerance:0,challengeLocks:Object.fromEntries((preset.specialChallenges??[]).map(c=>[c.id,mode])),maxRemoved:1};
  assert.ok(input.roster.length);assert.equal(before.modules.validateInput(input,before.modules.catalog),null);
  const nonce=`${nonceBase}:${profile}:${id}`;
  for(const c of after?(i%2?[after,before]:[before,after]):[before]){
   const existing=fs.readdirSync(c.outputDir).filter(f=>f.startsWith('case-')&&f.endsWith('.json')).map(f=>JSON.parse(fs.readFileSync(path.join(c.outputDir,f),'utf8'))).find(r=>r.profile===profile&&r.caseId===id);
   if(existing){assert.equal(digest(existing.input),digest(input));assert.equal(existing.sourceHash,c.sourceHash);assert.equal(existing.nonce,nonce);assert.equal(existing.durationMs,durationMs);assert.equal(existing.auditTrials,auditTrials);continue;}
   assert.deepEqual(c.presets.find(p=>p.id===id),before.presets.find(p=>p.id===id));
   const report=await runHistoryCase({input:structuredClone(input),preset,entry:{score:null},profile,tag:c.tag,outputDir:c.outputDir,durationMs,auditTrials,nonce,sourceHash:c.sourceHash,modules:c.modules});
   report.sourceHash=c.sourceHash;report.catalogHash=c.catalogHash;report.presetsHash=c.presetsHash;report.supportMode=supportMode;report.inputHash=digest(input);report.profileManifestHash=digest(profiles);
   for(const row of report.topCandidates)assert.ok(c.modules.candidateSatisfiesConstraints(input,row.candidate,c.modules.catalog));
   const reportPath=path.join(c.outputDir,report.checkpoint.replace('checkpoint-','case-'));
   const temporary=reportPath+'.'+process.pid+'.pending';fs.writeFileSync(temporary,JSON.stringify(report,null,2));fs.renameSync(temporary,reportPath);
   console.log(JSON.stringify({version:c.tag,profile,id,evaluated:report.evaluated,top:report.topCandidates.map(r=>({rank:r.rank,max:r.validation1024.max,p95:r.validation1024.p95,expected30:r.validation1024.expectedMaxOfAttempts,winRate:r.validation1024.winRate}))}));
  }
 }
 if(args.get('isolation')==='pair')console.log(JSON.stringify({caseIndex,resourceUsage:process.resourceUsage(),rssBytes:process.memoryUsage().rss}));
}finally{await before.server.close();if(after)await after.server.close();}
