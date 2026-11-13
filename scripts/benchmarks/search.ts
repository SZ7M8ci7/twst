import { createResourceBattleHost } from '@/workers/resourceBattleHost';
import { SearchSession } from '@/domain/examSearch/scheduler';
import { examPresetDefinitions } from '@/utils/examPresets';
import { validateInput, candidateSatisfiesConstraints } from '@/domain/examSearch/variants';
import { rankedResults, expectedBestScore, scoreDistribution } from '@/domain/examSearch/statistics';
import { emptySamples, type SearchInput, type RosterCard } from '@/domain/examSearch/types';
import cards from '@/assets/chara.json';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
const hash=(value:unknown)=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
const catalog = Object.fromEntries(cards.map(c => [c.name,c]));
const trained=(c:typeof cards[number],level?:number,totsu=4):RosterCard=>({name:c.name,level:level??(c.rare==='SSR'?120:c.rare==='SR'?90:70),totsu,magicLevels:[10,10,10],buddyLevels:[10,10,10],allowUpgrade:true});
const dorm=cards.filter(c=>c.costume==='寮服');
// Synthetic, portable fixtures; these are NOT the user's recovered collection.
const profiles:Record<string,()=>Partial<SearchInput>>={
  dorm:()=>({roster:dorm.map(c=>trained(c,110)),supports:dorm.map(c=>trained(c))}),
  mixed:()=>({roster:cards.filter(c=>c.costume==='寮服'||c.costume==='クラブ・ウェア').map(c=>trained(c, c.rare==='SSR'?100:70,3)),supports:cards.filter(c=>c.rare==='SSR').map(c=>trained(c))}),
  all:()=>({roster:cards.map(c=>trained(c)),supports:cards.filter(c=>c.rare==='SSR').map(c=>trained(c))}),
  limited:()=>({roster:dorm.slice(0,12).map(c=>trained(c,80,0)),supports:dorm.map(c=>trained(c))}),
  required:()=>({roster:dorm.map(c=>trained(c,100,3)),supports:dorm.map(c=>trained(c)),requiredCharacters:['イデア','アズール']}),
  budget:()=>({roster:dorm.slice(0,12).map(c=>trained(c,80,0)),supports:dorm.map(c=>trained(c)),budget:3,additionalLevelCap:10}),
};
export async function main(args:string[]) {
  const [out='artifacts/nrc19/run.jsonl',suite='current',profile='dorm',duration='30000',nonce='0',mode='auto']=args;
  if(!profiles[profile])throw Error('Unknown profile '+profile);
  const historical=JSON.parse(fs.readFileSync('scripts/benchmarks/historical-presets.json','utf8')) as string[];
  const development=historical.slice(0,4).concat(['第18回統一火DF','第18回統一水ATK']);
  const requested=suite==='current'?examPresetDefinitions.filter(p=>p.id.startsWith('第19回')).map(p=>p.id)
    :suite==='development'?development:suite==='holdout'?historical.filter(id=>!development.includes(id))
    :suite==='historical'?historical:suite.split(',');
  const completed=new Set(fs.existsSync(out)?fs.readFileSync(out,'utf8').trim().split('\n').filter(Boolean).map(line=>JSON.parse(line).case):[]);
  const engine=createResourceBattleHost();
  for(const id of requested){
    const caseId=[id,profile,mode,duration,nonce].join('|');if(completed.has(caseId))continue;
    const preset=examPresetDefinitions.find(p=>p.id===id);if(!preset)throw Error('Missing preset '+id);
    const input={preset,roster:[],supports:[],budget:0,additionalLevelCap:0,itemsPerLimitBreak:1,target:0,attempts:30,desiredProbability:.05,tolerance:0,challengeLocks:Object.fromEntries((preset.specialChallenges??[]).map(c=>[c.id,mode==='auto'?'auto':mode])),maxRemoved:2,...profiles[profile]()} as SearchInput;
    const issue=validateInput(input,catalog);if(issue)throw Error(caseId+': '+issue);
    const session=new SearchSession(input,catalog,engine,`benchmark:${nonce}:${id}:search`);
    const started=performance.now();await session.run(Number(duration),()=>{});
    const elapsed=performance.now()-started,checkpoint=session.checkpoint();
    const selected=rankedResults(checkpoint.finalists,input.target,input.attempts,input.desiredProbability)[0];
    if(!selected)throw Error('No finalist: '+caseId);
    if(!candidateSatisfiesConstraints(input,selected.candidate,catalog))throw Error('Illegal candidate');
    await engine.prepare(input,selected.candidate);
    const best=selected.validationBest??selected.developmentBest;
    if(best&&engine.trial(best.seed,selected.candidate.policy).score!==best.score)throw Error('Best replay mismatch');
    const samples=emptySamples();
    for(let i=0;i<1024;i++){
      const trial=engine.trial(`benchmark:${nonce}:${id}:external-holdout:${i}`,selected.candidate.policy);
      samples.scores.push(trial.score);samples.retired+=Number(trial.retired);samples.turns+=trial.finishTurn;
    }
    const row={case:caseId,commit:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),sourceHash:hash(fs.readFileSync('src/domain/examSearch/candidateGenerator.ts','utf8')),catalogHash:hash(cards),inputHash:hash(input),input,nonce,durationMs:Number(duration),elapsedMs:elapsed,tasks:checkpoint.cursor,generated:checkpoint.generatedCount,evaluated:checkpoint.evaluatedCount,selected,external:{...scoreDistribution(samples),expectedBest30:expectedBestScore(samples,30),retired:samples.retired,scores:samples.scores},bestReproduced:!!best};
    fs.appendFileSync(out,JSON.stringify(row)+'\n');
    console.log(JSON.stringify({case:caseId,generated:row.generated,evaluated:row.evaluated,expectedBest30:row.external.expectedBest30,max:row.external.max,p95:row.external.p95}));
  }
}
