import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createServer} from 'vite';
const outputPrefix=process.argv[2]||'lifecycle';
const fixture=JSON.parse(fs.readFileSync('scripts/tests/fixtures/exam-observation-equivalence.json','utf8')).rows[0];
const server=await createServer({plugins:[{name:'no-scan',configResolved(c){c.optimizeDeps.noDiscovery=true;c.optimizeDeps.include=[];}}],server:{middlewareMode:true,hmr:false,watch:null},appType:'custom'});
try{
 const {createResourceBattleHost}=await server.ssrLoadModule('/src/workers/resourceBattleHost.ts');
 const {SearchSession}=await server.ssrLoadModule('/src/domain/examSearch/scheduler.ts');
 const {default:cards}=await server.ssrLoadModule('/src/assets/chara.json');
 const catalog=Object.fromEntries(cards.map(c=>[c.name,c])),input=structuredClone(fixture.input);
 const firstEngine=createResourceBattleHost();let session,trials=0;
 const stoppingEngine={...firstEngine,trial(...args){const result=firstEngine.trial(...args);if(++trials===40)session.stop();return result;}};
 session=new SearchSession(input,catalog,stoppingEngine,'lifecycle-v1');
 await session.run(10000,()=>{});
 const stopped=session.checkpoint();assert.ok(trials>=40);assert.ok(stopped.trialSerial>0);
 const filename=`artifacts/nrc19/${outputPrefix}-checkpoint.json`;fs.writeFileSync(filename,JSON.stringify(stopped));
 const saved=JSON.parse(fs.readFileSync(filename,'utf8'));assert.deepEqual(saved,JSON.parse(JSON.stringify(stopped)));
 const resumedEngine=createResourceBattleHost();let resumedOrdinaryTrials=0;
 const countedEngine={...resumedEngine,trial(...args){resumedOrdinaryTrials++;return resumedEngine.trial(...args);}};
 const resumed=new SearchSession(input,catalog,countedEngine,'ignored-new-nonce',structuredClone(saved));
 assert.equal(resumed.checkpoint().nonce,saved.nonce);
 assert.equal(resumed.checkpoint().trialSerial,saved.trialSerial);
 await resumed.run(3000,()=>{});
 const continued=resumed.checkpoint();assert.ok(resumedOrdinaryTrials>0);assert.ok(continued.trialSerial>=saved.trialSerial);assert.ok(continued.elapsed>saved.elapsed);
 const savedValidation=saved.finalists.reduce((n,r)=>n+r.validation.scores.length,0),resumedValidation=continued.finalists.reduce((n,r)=>n+r.validation.scores.length,0);
 assert.ok(resumedValidation>savedValidation,'Interrupted validation must continue before new discovery');
 for(const row of saved.finalists){const next=continued.finalists.find(r=>r.candidate.id===row.candidate.id);assert.ok(next);assert.deepEqual(next.development.scores.slice(0,row.development.scores.length),row.development.scores);assert.deepEqual(next.validation.scores.slice(0,row.validation.scores.length),row.validation.scores);}
 assert.ok(continued.finalists.length,'Resume must publish finalists');
 const replays=[];
 for(const row of continued.finalists){const best=row.validationBest??row.developmentBest;if(!best)continue;await resumedEngine.prepare(input,row.candidate);const result=resumedEngine.trial(best.seed,row.candidate.policy,true);assert.equal(result.score,best.score);assert.equal(resumedEngine.replay(best.seed,result.plan,true).score,best.score);replays.push(best.score);}
 assert.ok(replays.length);const report={stoppedAfterTrials:trials,resumedOrdinaryTrials,savedValidation,resumedValidation,savedTrials:saved.trialSerial,resumedTrials:continued.trialSerial,savedEvaluated:saved.evaluatedCount,resumedEvaluated:continued.evaluatedCount,noncePreserved:true,finalists:continued.finalists.length,replayedScores:replays,browserStorageTested:false};
 fs.writeFileSync(`artifacts/nrc19/${outputPrefix}-report.json`,JSON.stringify(report,null,2));console.log(report);
}finally{await server.close();}
