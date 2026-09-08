import { atkbuffDict, dmgbuffDict, healDict, healContinueDict, magicDict, recalculateATK, recalculateHP } from '@/utils/calculations';
import { getBuddyStatusForCharacter, getBuddyStatusSummary } from '@/utils/buddyEffects';
import { parseMagicBuffsFromEtc, type ParsedBuff } from '@/utils/buffParser';
import { criticalRatePowerScale, criticalTailMultiplier } from '@/utils/criticalRates';
import { evasionRateByPower, defenceEvasionValue } from '@/utils/evasionRates';
import { yieldToHost } from '@/utils/yieldToHost';
import { searchCardVariants as cardVariants, challengeVariants, upgradeTargets, examUsesSupport, allocationCards, upgradeCost,
  requiredCardSupportAssignments, requiredOwnedNames, candidateIncludesRequired } from '@/domain/examSearch/variants';
import type { Candidate, SearchCard, SearchInput, PolicyKind } from '@/domain/examSearch/types';
import { createCompletionCheck } from '@/domain/examSearch/completion';
import { diversifyBeam } from '@/domain/examSearch/beam';
import { maxPairedMean, type PairedEffect, type PairedSpell } from '@/domain/examSearch/pairedMean';

export type Catalog = Record<string, any>;
function attackScoreEffects(raw:Catalog[string]):ParsedBuff[] {
  return parseMagicBuffsFromEtc(raw).filter(b=>['ATKUP','ダメージUP','属性ダメUP','クリティカル'].includes(b.buffOption)
    &&['self','allySelected','allyAll'].includes(b.targetType??'self'));
}
export interface GenerationTask { anchor: string; totsu: number; cost: number; challenges: string[]; style: number; supportFirst?: boolean; supportAnchor?: string; seedTeam?: string[]; requiredCharacters?: string[]; requiredCards?: string[]; requiredSupport?: string; duoChain?: boolean }
const estimatorCache=new WeakMap<SearchInput,WeakMap<Catalog,Map<string,ReturnType<typeof createEstimator>>>>();
function cachedEstimator(input:SearchInput,task:GenerationTask,catalog:Catalog) {
  let byCatalog=estimatorCache.get(input);
  if(!byCatalog){byCatalog=new WeakMap();estimatorCache.set(input,byCatalog);}
  let entries=byCatalog.get(catalog);
  if(!entries){entries=new Map();byCatalog.set(catalog,entries);}
  // Anchor and item cost do not affect the feature model. Reuse parsed spells,
  // stats and buddy features across tasks with the same exam and scoring style.
  const key=JSON.stringify([input.preset,[...task.challenges].sort(),task.style]);
  if(!entries.has(key))entries.set(key,createEstimator(input,task,catalog));
  return entries.get(key)!;
}

function* donorReductions(caps:number[],required:number,index=0,prefix:number[]=[]):Generator<number[]> {
  if(index===caps.length){if(required===0)yield prefix;return;}
  for(let amount=0;amount<=Math.min(caps[index],required);amount++)
    yield* donorReductions(caps,required-amount,index+1,[...prefix,amount]);
}

function* taskSteps(input: SearchInput, catalog: Catalog): Generator<void,GenerationTask[]> {
  const supportAllowed=examUsesSupport(input.preset),ownCount=supportAllowed?4:5;
  const challenges = challengeVariants(input), lanes = new Map<number, GenerationTask[]>();
  for (const card of input.roster) {
    for (const totsu of [card.totsu, ...upgradeTargets(card, catalog[card.name].rare, input.budget, input.itemsPerLimitBreak)]) {
      const cost = (totsu - card.totsu) * input.itemsPerLimitBreak;
      if (!lanes.has(cost)) lanes.set(cost, []);
      const style = [...card.name].reduce((sum,c)=>sum+c.charCodeAt(0),totsu) % 3;
      for (const ids of challenges) for(const supportFirst of supportAllowed?[true,false]:[false]) lanes.get(cost)!.push({ anchor: card.name, totsu, cost, challenges: ids, style, supportFirst });
    }
  }
  // Interleave resource bands so a 0 -> 3 breakthrough is reached before cheap lanes exhaust.
  // Start promising anchors in every band early, independent of catalogue order.
  // This is an ordering heuristic; every owned card remains in the task list.
  const estimates = new Map<string, ReturnType<typeof createEstimator>>();
  const attackEstimates = new Map<string, ReturnType<typeof createEstimator>>();
  const values = new Map<GenerationTask, number>();
  const attackValues = new Map<GenerationTask,number>();
  const pairedValues = new Map<GenerationTask,number>();
  const upgradeGains = new Map<GenerationTask,number>();
  const partnerPools = new Map<string, SearchCard[]>();
  const pairedCache = new Map<string,number>();
  const scoringValues=new Map<GenerationTask,number>();
  const scoreBuffs=new Map<string,ParsedBuff[]>();
  const attackInput={...input,preset:{...input.preset,kind:'ATTACK' as const}};
  for (const tasks of lanes.values()) for (const task of tasks) {
    const key = task.challenges.join('|');
    if (!estimates.has(key)) estimates.set(key, cachedEstimator(input, { ...task, style: 0 }, catalog));
    if(!attackEstimates.has(key))attackEstimates.set(key,cachedEstimator(attackInput,{...task,style:0},catalog));
    const estimate = estimates.get(key)!;
    const card = input.roster.find(c => c.name === task.anchor)!;
    const variants=cardVariants(card,catalog[card.name].rare,false,task.totsu);
    values.set(task, Math.max(...variants.map(c => estimate([c]))));
    attackValues.set(task,Math.max(...variants.map(c=>attackEstimates.get(key)!([c]))));
    if(!partnerPools.has(key)) {
      const byCharacter=new Map<string,{card:SearchCard,value:number}[]>();
      for(const [roster,support] of [[input.roster,false],...(supportAllowed?[[input.supports,true]]:[])] as [SearchInput['roster'],boolean][]) {
        for(const entry of roster)for(const option of cardVariants(entry,catalog[entry.name].rare,support)) {
          const name=catalog[entry.name].chara,group=byCharacter.get(name)??[];
          group.push({card:option,value:estimate([option])});
          group.sort((a,b)=>b.value-a.value);group.length=Math.min(2,group.length);byCharacter.set(name,group);
        }
      }
      partnerPools.set(key,[...byCharacter.values()].flatMap(group=>group.map(entry=>entry.card)));
    }
    const pairKey=JSON.stringify([key,task.anchor,task.totsu]);
    if(!pairedCache.has(pairKey)) {
      const raw=catalog[task.anchor],related=(c:any,name:string)=>[c.duo,c.buddy1c,c.buddy2c,c.buddy3c].includes(name);
      let best=values.get(task)!;
      for(const partner of partnerPools.get(key)!) {
        const other=catalog[partner.name];
        if(!partner.support&&partner.name===task.anchor)continue;
        if(!related(raw,other.chara)&&!related(other,raw.chara))continue;
        // Marginal contribution includes the buddy/DUO unlocked on either
        // card. Subtract the partner's solo strength so it cannot dominate.
        const solo=estimate([partner]);
        for(const anchor of variants)best=Math.max(best,estimate([anchor,partner])-solo);
      }
      pairedCache.set(pairKey,best);
    }
    pairedValues.set(task,pairedCache.get(pairKey)!);
    if(input.preset.kind==='ATTACK') {
      if(!scoreBuffs.has(task.anchor))scoreBuffs.set(task.anchor,attackScoreEffects(catalog[task.anchor]));
      const buffs=scoreBuffs.get(task.anchor)!;
      const count=Math.max(0,...variants.flatMap(c=>c.selectedMagic.map(m=>buffs.filter(b=>b.magicOption===`M${m}`).length)));
      // ATK awards 120 points per activated buff effect, while 208 damage
      // contributes one point. Use that equivalent only to order an extra
      // anchor lane; actual timing, freeze and score still require battles.
      scoringValues.set(task,pairedCache.get(pairKey)!+count*120*208);
    }
    // Existing strength is not the value of spending an item. Also prioritize
    // cards whose best buddy/DUO contribution changes most after the upgrade.
    const originalKey=JSON.stringify([key,task.anchor,card.totsu]);
    const originalValue=pairedCache.get(originalKey)??Math.max(...cardVariants(card,catalog[card.name].rare).map(c=>estimate([c])));
    upgradeGains.set(task,pairedCache.get(pairKey)!-originalValue);
    yield;
  }
  for (const [cost,tasks] of lanes) {
    const primary=[...tasks].sort((a,b)=>values.get(b)!-values.get(a)!||a.anchor.localeCompare(b.anchor));
    const attackers=[...tasks].sort((a,b)=>attackValues.get(b)!-attackValues.get(a)!||a.anchor.localeCompare(b.anchor));
    const paired=[...tasks].sort((a,b)=>pairedValues.get(b)!-pairedValues.get(a)!||a.anchor.localeCompare(b.anchor));
    const scoring=input.preset.kind==='ATTACK'?[...tasks].sort((a,b)=>scoringValues.get(b)!-scoringValues.get(a)!||a.anchor.localeCompare(b.anchor)):[];
    const gains=[...tasks].sort((a,b)=>upgradeGains.get(b)!-upgradeGains.get(a)!||pairedValues.get(b)!-pairedValues.get(a)!||a.anchor.localeCompare(b.anchor));
    const ordered:GenerationTask[]=[],used=new Set<GenerationTask>();
    while(ordered.length<tasks.length){
      const queues=cost>0?[gains,primary,attackers,paired,...(scoring.length?[scoring]:[])]
        :scoring.length?[scoring,primary,attackers,paired]:[primary,attackers,paired];
      const queue=queues[ordered.length%queues.length];
      while(queue.length&&used.has(queue[0]))queue.shift();
      const next=queue.shift();if(!next)break;used.add(next);ordered.push(next);
    }
    // Cover more distinct anchors before trying the other support-order path
    // for the same card. Both paths remain scheduled, with the first path
    // balanced deterministically across anchors rather than always identical.
    const first=ordered.filter(t=>t.supportFirst===(t.style%2===0));
    // Compare removed challenges without spending the beginning of a run on
    // every easier variant of the same anchor. Reserve half the early work
    // for the highest-point allowed challenge set, and rotate alternatives.
    const balanced:GenerationTask[]=[];
    for(const ranked of supportAllowed?[first,ordered.filter(t=>t.supportFirst!==(t.style%2===0))]:[ordered]) {
    const groups=challenges.map(ids=>ranked.filter(task=>task.challenges===ids));
    const positions=groups.map(()=>0);
    let alternative=1;
    while(groups.some((group,index)=>positions[index]<group.length)) {
      if(positions[0]<groups[0].length)balanced.push(groups[0][positions[0]++]);
      for(let tried=0;tried<groups.length-1;tried++) {
        const index=alternative;
        alternative=alternative===groups.length-1?1:alternative+1;
        if(positions[index]<groups[index].length){balanced.push(groups[index][positions[index]++]);break;}
      }
    }
    }
    lanes.set(cost,balanced);
  }
  const queues = [...lanes].sort(([a], [b]) => a - b).map(([, tasks]) => tasks);
  const output: GenerationTask[] = [];
  for (let i = 0; queues.some(q => i < q.length); i++) for (const queue of queues) if (queue[i]) output.push(queue[i]);
  if(supportAllowed&&challenges.length) {
    // A support rejected by every owned-anchor beam never gets a real battle.
    // Rank each support's baseline path by a promising pair. Its owned slots
    // remain free, and later mutations can distribute items across that team.
    const ids=challenges[0],estimate=cachedEstimator(input,{anchor:'',totsu:0,cost:0,challenges:ids,style:0},catalog);
    const ownGroups=new Map<string,{name:string;value:number}[]>();
    for(const card of input.roster) {
      const group=ownGroups.get(catalog[card.name].chara)??[];
      group.push({name:card.name,value:Math.max(...cardVariants(card,catalog[card.name].rare).map(c=>estimate([c])))});
      group.sort((a,b)=>b.value-a.value||a.name.localeCompare(b.name));group.length=Math.min(3,group.length);
      ownGroups.set(catalog[card.name].chara,group);
      yield;
    }
    const ownNames=new Set([...ownGroups.values()].flatMap(group=>group.map(c=>c.name)));
    const partners=input.roster.filter(c=>ownNames.has(c.name)).sort((a,b)=>a.name.localeCompare(b.name)).flatMap(c=>cardVariants(c,catalog[c.name].rare));
    const supportPaths:{task:GenerationTask;value:number}[]=[];
    for(const support of input.supports) {
      let best:SearchCard|undefined,value=-Infinity,count=0;
      for(const option of cardVariants(support,catalog[support.name].rare,true))for(const own of partners) {
        const pairValue=estimate([own,option]);
        if(pairValue>value){best=own;value=pairValue;}
        if(++count%128===0)yield;
      }
      if(best)supportPaths.push({task:{anchor:best.name,totsu:best.totsu,cost:0,challenges:ids,style:0,
        supportFirst:true,supportAnchor:support.name},value});
      yield;
    }
    supportPaths.sort((a,b)=>b.value-a.value||a.task.supportAnchor!.localeCompare(b.task.supportAnchor!));
    const regular=[...output];output.length=0;
    for(let i=0;i<Math.max(regular.length,supportPaths.length*4);i++) {
      if(regular[i])output.push(regular[i]);
      if(i%4===3&&supportPaths[Math.floor(i/4)])output.push(supportPaths[Math.floor(i/4)].task);
    }
  }
  const packages=yield* buddyPackageSteps(input,catalog,output);
  if(packages.length) {
    const regular=[...output];output.length=0;
    for(let i=0;i<Math.max(regular.length,packages.length*8);i++) {
      if(regular[i])output.push(regular[i]);
      if(i%8===7&&packages[Math.floor(i/8)])output.push(packages[Math.floor(i/8)]);
    }
  }
  if(input.preset.kind==='BASIC'||input.preset.kind==='ATTACK') {
    const roots=new Set<string>(),counts=[0,0],chains:GenerationTask[]=[];
    const upgradeRoots=new Map<number,GenerationTask[]>();
    for(const task of output) {
      const support=Number(!!task.supportAnchor),name=task.supportAnchor??task.anchor;
      const key=JSON.stringify([support,name]);
      if(task.requiredCharacters||task.cost!==0||catalog[name].rare!=='SSR'||roots.has(key)||counts[support]>=8)continue;
      roots.add(key);counts[support]++;chains.push({...task,duoChain:true});
    }
    // Add only a small, deterministic sample of upgraded OWN roots. These
    // retain the normal task ordering while giving DUO construction a chance
    // to spend the root's remaining budget on a partner upgrade.
    for(const task of output) {
      if(task.cost<=0||task.cost>input.budget||task.supportAnchor||task.requiredCharacters)continue;
      if(catalog[task.anchor]?.rare!=='SSR')continue;
      const lane=upgradeRoots.get(task.cost)??[];
      if(lane.some(root=>root.anchor===task.anchor))continue;
      if(lane.length>=2)continue;
      lane.push({...task,duoChain:true});
      upgradeRoots.set(task.cost,lane);
    }
    const upgradeChains=[...upgradeRoots.entries()].sort(([a],[b])=>a-b).flatMap(([,lane])=>lane);
    const regular=[...output];output.length=0;
    for(let i=0;i<Math.max(regular.length,chains.length*12,upgradeChains.length*12);i++) {
      if(regular[i])output.push(regular[i]);
      if(i%12===3&&chains[Math.floor(i/12)])output.push(chains[Math.floor(i/12)]);
      if(i%12===7&&upgradeChains[Math.floor(i/12)])output.push(upgradeChains[Math.floor(i/12)]);
    }
  }
  const seeds:GenerationTask[]=[];
  const uniqueTeams=new Set<string>();
  for(const team of input.seedTeams??[]) {
    if(!Array.isArray(team)||team.length!==5||new Set(team.slice(0,ownCount)).size!==ownCount
      ||!team.slice(0,ownCount).every(name=>input.roster.some(c=>c.name===name))||supportAllowed&&!input.supports.some(c=>c.name===team[4]))continue;
    const key=[...team.slice(0,ownCount)].sort().concat(supportAllowed?[team[4]]:[]).join('|');
    if(uniqueTeams.has(key)||uniqueTeams.size>=8)continue;
    uniqueTeams.add(key);
    for(const [index,name] of team.slice(0,ownCount).entries()) {
      const card=input.roster.find(c=>c.name===name)!;
      for(const totsu of [...(index===0?[card.totsu]:[]),...upgradeTargets(card,catalog[name].rare,input.budget,input.itemsPerLimitBreak)])
        for(const ids of challenges)seeds.push({anchor:name,totsu,cost:(totsu-card.totsu)*input.itemsPerLimitBreak,challenges:ids,style:0,seedTeam:team});
    }
  }
  const seedQueues=[...new Set(seeds.map(t=>t.cost))].sort((a,b)=>a-b).map(cost=>seeds.filter(t=>t.cost===cost));
  seeds.length=0;
  for(let i=0;seedQueues.some(queue=>i<queue.length);i++)for(const queue of seedQueues)if(queue[i])seeds.push(queue[i]);
  const combined:GenerationTask[]=[];
  // Saved teams are starting points, not a restriction on the card pool.
  // Three out of every four tasks still explore the full collection.
  for(let i=0;i<Math.max(output.length,seeds.length*3);i++) {
    if(i%3===0&&seeds[i/3])combined.push(seeds[i/3]);
    if(output[i])combined.push(output[i]);
  }
  const required=[...new Set(input.requiredCards ?? [])];
  if (!required.length) return combined;
  const assignments=requiredCardSupportAssignments(input);
  const requiredOwnCount=examUsesSupport(input.preset)?4:5;
  const namesForOwned=(supportName?:string)=>required.filter(name=>name!==supportName);
  const expanded:GenerationTask[]=[];
  const seenRequired=new Set<string>();
  for (const task of combined) for (const supportName of assignments) {
    const ownedRequired=namesForOwned(supportName);
    // Once all owned slots are reserved, an unrelated anchor can only create
    // an empty task. Keep the task list practical while retaining every
    // required anchor and each legal support assignment.
    if (ownedRequired.length>=requiredOwnCount && !ownedRequired.includes(task.anchor)) continue;
    if (supportName && task.supportAnchor && task.supportAnchor!==supportName) continue;
    const requiredTask={...task, requiredCards:required, requiredSupport:supportName,
      ...(supportName ? {supportAnchor:supportName,supportFirst:true} : {})};
    const key=JSON.stringify([requiredTask.anchor,requiredTask.totsu,requiredTask.cost,requiredTask.challenges,
      requiredTask.style,requiredTask.supportFirst,requiredTask.supportAnchor,requiredTask.seedTeam,requiredTask.requiredSupport,
      requiredTask.requiredCharacters,requiredTask.duoChain]);
    if (seenRequired.has(key)) continue;
    seenRequired.add(key);expanded.push(requiredTask);
  }
  return expanded;
}

// Additional paths complete strong buddy combinations before comparing the
// team in battle. Character constraints leave costumes and other slots free.
function* buddyPackageSteps(input:SearchInput,catalog:Catalog,source:GenerationTask[]):Generator<void,GenerationTask[]> {
  const characters=new Set(input.roster.map(c=>catalog[c.name].chara));
  const seen=new Set<string>(),rows:{task:GenerationTask;value:number}[]=[];
  const required=-Math.expm1(Math.log1p(-input.desiredProbability)/input.attempts);
  const fullChallenges=source[0]?.challenges.join('|');
  type Link={name:string;value:number};
  const profiles=new Map<string,Link[]>();
  const links=(card:SearchCard)=>{
    const key=JSON.stringify([card.name,card.level,card.totsu,card.buddyLevels]);
    if(profiles.has(key))return profiles.get(key)!;
    const raw=catalog[card.name],totsu=card.totsu;
    const atk=recalculateATK(raw,card.level,totsu===4),hp=recalculateHP(raw,card.level,totsu===4);
    const result=([1,2,3] as const).map(i=>{
      const status=getBuddyStatusForCharacter(raw,i,{totsu,isActive:true});
      const summary=getBuddyStatusSummary(status,card.buddyLevels[i-1]);
      const critical=(criticalRatePowerScale[status.match(/クリティカル\(([^)]+)\)/)?.[1]??'']??0)/100;
      const attack=(summary.atkRate+summary.damageRate+criticalTailMultiplier(critical,3,required)-1)*atk*3
        *advantage(raw.magic2atr,input.preset.enemyElement);
      return {name:raw['buddy'+i+'c'],value:input.preset.kind==='DEFENCE'
        ?hp*summary.hpRate+attack*.25:attack+hp*summary.hpRate*.05};
    });
    profiles.set(key,result);return result;
  };
  const owned=new Map<string,Link[][]>(),borrowed=new Map<string,Link[][]>();
  for(const support of [false,true])for(const card of support?(examUsesSupport(input.preset)?input.supports:[]):input.roster) {
    const groups=support?borrowed:owned,character=catalog[card.name].chara;
    const group=groups.get(character)??[];
    group.push(links(cardVariants(card,catalog[card.name].rare,support)[0]));groups.set(character,group);
    yield;
  }
  const bestLinks=(groups:Map<string,Link[][]>,name:string,active:Set<string>)=>
    Math.max(0,...(groups.get(name)??[]).map(profile=>profile.reduce((sum,b)=>sum+(active.has(b.name)?b.value:0),0)));
  for(const task of source) {
    const support=!!task.supportAnchor,name=task.supportAnchor??task.anchor,raw=catalog[name];
    if(raw.rare!=='SSR'||task.challenges.join('|')!==fullChallenges)continue;
    const original=(support?input.supports:input.roster).find(c=>c.name===name)!;
    const totsu=support?original.totsu:task.totsu,key=JSON.stringify([name,totsu,support]);
    if(seen.has(key))continue;seen.add(key);
    const card=cardVariants(original,raw.rare,support,totsu)[0];
    const buddies=links(card).filter(b=>characters.has(b.name)&&b.value>0).sort((a,b)=>b.value-a.value);
    const strong=buddies.filter(b=>b.value>=buddies[0].value*.25);
    const groups=strong.length<2?strong.map(b=>[b]):strong.flatMap((a,i)=>strong.slice(i+1).map(b=>[a,b]));
    if((input.preset.kind==='BASIC'||input.preset.kind==='ATTACK')) {
      const distinctStrong=[...new Map(strong.map(b=>[b.name,b])).values()];
      if(distinctStrong.length>=3)groups.push(distinctStrong.slice(0,3));
    }
    for(const group of groups) {
      const requiredCharacters=[...new Set(group.map(b=>b.name))];
      const active=new Set([raw.chara,...requiredCharacters]);
      const reciprocal=requiredCharacters.map(name=>bestLinks(owned,name,active));
      // Include links back to the anchor and between its partners. At most
      // one member can use support training, and none if the anchor is borrowed.
      const supportGain=support?0:Math.max(0,...requiredCharacters.map((name,i)=>bestLinks(borrowed,name,active)-reciprocal[i]));
      rows.push({task:{...task,requiredCharacters},value:group.reduce((sum,b)=>sum+b.value,0)
        +reciprocal.reduce((sum,value)=>sum+value,0)+supportGain});
    }
    yield;
  }
  const queues=[...new Set(rows.map(r=>r.task.cost))].sort((a,b)=>a-b).flatMap(cost=>
    [false,true].map(support=>rows.filter(r=>r.task.cost===cost&&!!r.task.supportAnchor===support)
      .sort((a,b)=>b.value-a.value||a.task.anchor.localeCompare(b.task.anchor))));
  const result:GenerationTask[]=[];
  for(let i=0;queues.some(q=>i<q.length);i++)for(const queue of queues)if(queue[i])result.push(queue[i].task);
  return result;
}

export function buildTasks(input: SearchInput, catalog: Catalog): GenerationTask[] {
  const steps=taskSteps(input,catalog);
  let next=steps.next();
  while(!next.done)next=steps.next();
  return next.value;
}

export async function buildTasksAsync(input: SearchInput,catalog:Catalog,stop:()=>boolean):Promise<GenerationTask[]|undefined> {
  const steps=taskSteps(input,catalog);
  let lastYield=performance.now();
  while(!stop()) {
    const next=steps.next();
    if(next.done)return next.value;
    if(performance.now()-lastYield>=8) {
      await yieldToHost();
      lastYield=performance.now();
    }
  }
  return undefined;
}

function advantage(a: string, b: string): number {
  if (a === '無' || b === '無' || b === '全' || a === b) return 1;
  return ({ 火: '木', 木: '水', 水: '火' } as Record<string, string>)[a] === b ? 1.5 : 0.5;
}

export function createEstimator(input: SearchInput, task: GenerationTask, catalog: Catalog) {
  const ownCharacters=new Set(input.roster.map(c=>catalog[c.name].chara));
  const supportCharacters=new Set(input.supports.map(c=>catalog[c.name].chara));
  const requiredPerAttempt = -Math.expm1(Math.log1p(-input.desiredProbability) / input.attempts);
  const publicActions=input.preset.enemies.flatMap(enemy=>enemy.actions);
  const defenseCompatibility=(attribute:string)=>publicActions.reduce((sum,action)=>{
    const matchup=advantage(attribute,action.element??input.preset.enemyElement);
    const received=matchup===1.5?.5:matchup===.5?1.5:1;
    return sum+Math.max(0,Number(action.estimatedDamage)||0)*(1-received);
  },0)/Math.max(1,publicActions.length);
  const effects = input.preset.specialChallenges?.filter(c => task.challenges.includes(c.id)).flatMap(c => c.effects) ?? [];
  const curse = effects.some(e => e.kind === 'playerCurse'), freeze = effects.some(e => e.kind === 'playerFreeze');
  const enemyEffects = new Set(input.preset.enemies.flatMap(e=>e.actions.map(a=>a.effectKind)));
  const blind = effects.some(e=>e.kind==='playerBlind') || enemyEffects.has('blind');
  const parsedEffects = new Map<string,ParsedBuff[]>();
  const buffsFor=(c:SearchCard)=>{
    if(!parsedEffects.has(c.name))parsedEffects.set(c.name,parseMagicBuffsFromEtc(catalog[c.name]));
    return parsedEffects.get(c.name)!.filter(b=>c.selectedMagic.includes(Number(b.magicOption.slice(1)) as 1|2|3));
  };
  const pairedEffectFor=(buff:ParsedBuff,c:SearchCard):PairedEffect|undefined=>{
    const target=buff.targetType??(buff.isSelf?'self':'self');
    if(target!=='self'&&target!=='allySelected'&&target!=='allyAll')return undefined;
    const duration=buff.durationTurns??1;
    const level=c.magicLevels[Number(buff.magicOption.slice(1))-1]||10;
    if(buff.buffOption==='凍結無効')return {kind:'immunity',target,duration};
    if(buff.buffOption==='デバフ解除')return {kind:'cleanse',target,duration};
    if(buff.buffOption==='ATKUP')return {kind:'atk',target,duration,value:Number(atkbuffDict[`ATKUP(${buff.powerOption})${level}`]??0)};
    if(buff.buffOption==='クリティカル')return {kind:'critical',target,duration,value:(criticalRatePowerScale[buff.powerOption]??0)/100};
    if(buff.buffOption==='ダメージUP'||buff.buffOption==='属性ダメUP') {
      const prefix=buff.buffOption==='ダメージUP'?'ダメUP':'属性ダメUP';
      return {kind:'damage',target,duration,attribute:buff.attributeOption||undefined,value:Number(dmgbuffDict[`${prefix}(${buff.powerOption})${level}`]??0)};
    }
    return undefined;
  };
  const buildFinisherProfile=(c:SearchCard)=>{
    const raw=catalog[c.name];
    return { raw, atk:recalculateATK(raw,c.level,c.totsu===4),
      immunities:buffsFor(c).filter(b=>['凍結無効','デバフ解除'].includes(b.buffOption)).map(b=>b.targetType??'self'),
      selectedImmunitySlots:[...new Set(buffsFor(c).filter(b=>['凍結無効','デバフ解除'].includes(b.buffOption)&&b.targetType==='allySelected').map(b=>b.magicOption))],
      immuneBuddies:([1,2,3] as const).filter(i=>getBuddyStatusForCharacter(raw,i,{totsu:c.totsu,isActive:true}).includes('凍結無効')).map(i=>raw['buddy'+i+'c']),
      buddies:([1,2,3] as const).map(i=>{
        const status=getBuddyStatusForCharacter(raw,i,{totsu:c.totsu,isActive:true});
        const critical=criticalRatePowerScale[status.match(/クリティカル\(([^)]+)\)/)?.[1]??'']??0;
        return {name:raw['buddy'+i+'c'],critical:critical/100,...getBuddyStatusSummary(status,c.buddyLevels[i-1])};
      }),
      magic:c.selectedMagic.map(m=>{const power=String(raw['magic'+m+'pow']??'');return {m,attr:raw['magic'+m+'atr'],duo:m===2&&c.magicLevels[1]>=5,
        ratio:magicDict[power+'Lv'+c.magicLevels[m-1]]??1,duoRatio:magicDict['デュオ魔法Lv'+c.magicLevels[m-1]]??1,multiplier:power.includes('3連')?2.4:power.includes('連')?1.8:1};}),
      effects:buffsFor(c).map(buff=>({magic:Number(buff.magicOption.slice(1)),effect:pairedEffectFor(buff,c)})).filter((row):row is {magic:number;effect:PairedEffect}=>!!row.effect),
      boosts:buffsFor(c).filter(b=>['ATKUP','ダメージUP','属性ダメUP','クリティカル'].includes(b.buffOption)).map(b=>{
        const m=Number(b.magicOption.slice(1)),level=c.magicLevels[m-1],prefix=b.buffOption==='ダメージUP'?'ダメUP':'属性ダメUP';
        return {m,target:b.targetType??'self',duration:b.durationTurns??1,attribute:b.attributeOption,
          atk:b.buffOption==='ATKUP'?Number(atkbuffDict['ATKUP('+b.powerOption+')'+level]??0):0,
          damage:['ダメージUP','属性ダメUP'].includes(b.buffOption)?Number(dmgbuffDict[prefix+'('+b.powerOption+')'+level]??0):0,
          critical:b.buffOption==='クリティカル'?(criticalRatePowerScale[b.powerOption]??0)/100:0};
      })};
  };
  const finisherProfiles=new Map<string,ReturnType<typeof buildFinisherProfile>>();
  const finisher=(cards:SearchCard[])=>{
    const profiles=cards.map(c=>{const key=[c.name,c.level,c.totsu,c.selectedMagic.join(','),c.magicLevels.join(','),c.buddyLevels.join(',')].join(':');
      if(!finisherProfiles.has(key))finisherProfiles.set(key,buildFinisherProfile(c));return finisherProfiles.get(key)!;});
    if(input.preset.kind==='ATTACK'&&task.style===1&&cards.length===5) {
      const spellMeta=new Map<string,{profile:typeof profiles[number];magic:typeof profiles[number]['magic'][number];index:number}>();
      const spells:PairedSpell[]=profiles.flatMap((p,index)=>{
        let buddyAtk=0,buddyDamage=0,buddyCritical=0;
        for(const b of p.buddies)if(profiles.some(other=>other.raw.chara===b.name)){buddyAtk+=b.atkRate;buddyDamage+=b.damageRate;buddyCritical+=b.critical;}
        return p.magic.map(m=>{
          const id=`${index}-M${m.m}`;
          spellMeta.set(id,{profile:p,magic:m,index});
          return {id,owner:index,passiveImmune:p.immuneBuddies.some(name=>profiles.some(other=>other.raw.chara===name)),
            atkRate:buddyAtk,damageRate:buddyDamage,critical:Math.min(1,buddyCritical),attribute:m.attr,
            effects:p.effects.filter(row=>row.magic===m.m).map(row=>row.effect)};
        });
      });
      const meanTotal=maxPairedMean(spells,freeze,(spell,partner,stats)=>{
        const meta=spellMeta.get(spell.id)!;
        const duo=meta.magic.duo&&partner.owner!==meta.index&&partner.owner>=0
          &&meta.profile.raw.duo===profiles[partner.owner].raw.chara;
        const nonCriticalDamage=meta.profile.atk*(1+stats.atkRate)
          *((duo?meta.magic.duoRatio:meta.magic.ratio)*(meta.magic.attr==='無'?1.1:1)+stats.damageRate)
          *(duo?2.4:meta.magic.multiplier)*advantage(meta.magic.attr,input.preset.enemyElement);
        return nonCriticalDamage*(1+stats.critical*.25);
      });
      return {peak:0,total:0,meanTotal};
    }
    const names=new Set(profiles.map(p=>p.raw.chara));
    const allImmune=profiles.some(p=>p.immunities.includes('allyAll'));
    const partnerSlots=profiles.reduce((sum,p)=>sum+p.selectedImmunitySlots.length,0);
    const externalGains:{tailGain:number;meanGain:number}[]=[];
    let peak=0,total=0,meanTotal=0;
    for(const [profileIndex,p] of profiles.entries()) {
      const ownProtection=allImmune||p.immuneBuddies.some(name=>names.has(name))
        ||p.immunities.some(target=>['self','allySelected','allyAll'].includes(target));
      const protectedFromFreeze=ownProtection||partnerSlots>0;
      let externalGainTail=0,externalGainMean=0;
      let buddyAtk=0,buddyDamage=0,buddyCritical=0;
      for(const b of p.buddies)if(names.has(b.name)){buddyAtk+=b.atkRate;buddyDamage+=b.damageRate;buddyCritical+=b.critical;}
      for(const m of p.magic) {
        const duo=m.duo&&names.has(p.raw.duo);
        let atkRate=buddyAtk,damageRate=buddyDamage,critical=Math.min(1,buddyCritical);
        for(const [sourceIndex,source] of profiles.entries())for(const b of source.boosts) {
          const applicable=sourceIndex===profileIndex?(b.target==='self'||b.target==='allySelected'||b.target==='allyAll')&&(b.m===m.m||b.duration>=2)
            :(b.target==='allySelected'||b.target==='allyAll')&&(!duo||source.raw.chara===p.raw.duo||b.duration>=2);
          if(!applicable)continue;
          // Partial beams must retain a setup spell until its immunity partner
          // can join. Full battle evaluation checks the actual pairing/order.
          const activation=freeze&&!protectedFromFreeze?(cards.length<5?0.55:0):1;
          atkRate+=b.atk*activation;
          if(!b.attribute||b.attribute===m.attr)damageRate+=b.damage*activation;
          critical=Math.min(1,critical+b.critical*activation);
        }
        // Retain a finisher whose critical upper tail is plausible within the
        // retry budget. This optimistic ordering is not a team success rate:
        // independent battles still measure joint draws, damage and survival.
        const hits=duo||m.multiplier===2.4?3:m.multiplier===1.8?2:1;
        const criticalMultiplier=criticalTailMultiplier(critical,hits,requiredPerAttempt);
        const nonCriticalDamage=p.atk*(1+atkRate)*((duo?m.duoRatio:m.ratio)*(m.attr==='無'?1.1:1)+damageRate)*(duo?2.4:m.multiplier)
          *advantage(m.attr,input.preset.enemyElement);
        const damage=nonCriticalDamage*criticalMultiplier;
        const meanDamage=nonCriticalDamage*(1+critical*.25);
        peak=Math.max(peak,damage);
        total+=damage;
        meanTotal+=meanDamage;
        if(freeze&&cards.length===5&&!ownProtection&&partnerSlots>0) {
          const blockedNonCritical=p.atk*(1+buddyAtk)*((duo?m.duoRatio:m.ratio)*(m.attr==='無'?1.1:1)+buddyDamage)*(duo?2.4:m.multiplier)
            *advantage(m.attr,input.preset.enemyElement);
          const blockedTail=blockedNonCritical*criticalTailMultiplier(Math.min(1,buddyCritical),hits,requiredPerAttempt);
          const blockedMean=blockedNonCritical*(1+Math.min(1,buddyCritical)*.25);
          externalGainTail+=Math.max(0,damage-blockedTail);
          externalGainMean+=Math.max(0,meanDamage-blockedMean);
        }
      }
      if(externalGainTail>0||externalGainMean>0)externalGains.push({tailGain:externalGainTail,meanGain:externalGainMean});
    }
    // Each selected-ally immunity spell covers its source and one partner.
    // Its best individual finisher remains possible, but total team damage
    // must not assume every unprotected member receives that same partner slot.
    const uncovered=externalGains.sort((a,b)=>b.tailGain-a.tailGain).slice(partnerSlots);
    total-=uncovered.reduce((sum,gain)=>sum+gain.tailGain,0);
    meanTotal-=uncovered.reduce((sum,gain)=>sum+gain.meanGain,0);
    return {peak,total,meanTotal};
  };
  const usefulImmunity = (text: string) => (curse || enemyEffects.has('curse')) && /呪い無効/.test(text)
    || (freeze || enemyEffects.has('freeze')) && /凍結無効/.test(text)
    || blind && /暗闇無効/.test(text)
    || /デバフ解除/.test(text) && (curse || freeze || blind);
  const cache = new Map<string, { raw: any; atk: number; hp: number; magic: { base: number; duo: boolean; utility: number; heal: number; cure: boolean }[]; buddies: { name: string; utility: number; hpRate: number; atkRate: number; curseImmune: boolean; critical:number }[] }>();
  return (cards: SearchCard[]): number => {
    const names = new Set(cards.map(c => catalog[c.name].chara));
    const allyCure=input.preset.kind==='DEFENCE'&&curse&&cards.some(c=>buffsFor(c).some(b=>
      ['呪い無効','デバフ解除'].includes(b.buffOption)&&['allySelected','allyAll'].includes(b.targetType??'self')));
    const externalHealing:number[]=[];
    const missingBuddyValue=new Map<string,number>();
    let score = 0;
    for (const c of cards) {
      const key = [c.name, c.level, c.totsu, c.selectedMagic.join(','), c.magicLevels.join(','), c.buddyLevels.join(',')].join(':');
      let feature = cache.get(key);
      if (!feature) {
        const raw = catalog[c.name];
        const atk = recalculateATK(raw, c.level, c.totsu === 4), hp = recalculateHP(raw, c.level, c.totsu === 4);
        const magic = c.selectedMagic.map(m => {
          const attr = raw['magic'+m+'atr'], power = String(raw['magic'+m+'pow'] ?? '');
          const multiplier = power.includes('3連') ? 2.4 : power.includes('連') ? 1.8 : 1;
          let base = atk * multiplier * (magicDict[`${power}Lv${c.magicLevels[m-1]}`] ?? 1) * (attr==='無'?1.1:1) * advantage(attr, input.preset.enemyElement);
          if (effects.some(e => e.kind === 'enemyDamageNull' && e.attribute === attr)) base *= 0.7;
          const catalogueEffects = String(raw.etc ?? '').split(/<br\s*\/?\s*>/i).filter(text => text.includes('(M'+m+')')).join(' ');
          const text = [raw['magic'+m+'etc'] ?? '', catalogueEffects, raw['magic'+m+'heal'] ?? '', raw['magic'+m+'buf'] ?? ''].join(' ');
          const immune = usefulImmunity(text);
          const healing = text.includes('回復') ? (curse && !/呪い無効/.test(text) ? hp*0.03 : hp*0.25) : 0;
          const evasionChance=Math.min(1,buffsFor(c).filter(b=>b.magicOption===`M${m}`&&b.buffOption==='回避'
            &&['self','allySelected','allyAll'].includes(b.targetType??'self')).reduce((sum,b)=>sum+(evasionRateByPower[b.powerOption]??14.8)/100,0));
          const evasionValue=input.preset.kind==='DEFENCE'&&evasionChance>0?publicActions.reduce((sum,action)=>{
            const hits=String(action.power??'').includes('3連')?3:String(action.power??'').includes('連')?2:1;
            const equalDamage=Number(action.estimatedDamage)||0,matchup=advantage(attr,action.element??input.preset.enemyElement);
            return sum+(task.style===2?defenceEvasionValue(equalDamage,matchup,hits,evasionChance,requiredPerAttempt)
              :defenceEvasionValue(equalDamage,matchup,hits,1,1)*evasionChance);
          },0)/Math.max(1,publicActions.length):0;
          const defensive = input.preset.kind === 'DEFENCE'
            ? defenseCompatibility(attr) + evasionValue + (/ATKDOWN|ダメージDOWN/.test(text) ? 2500 : 0) : 0;
          const instantPower=text.match(/(?<!継続)回復\(([^)]+)\)/)?.[1];
          const actualInstant=input.preset.kind==='DEFENCE'&&instantPower?atk*(healDict[`回復(${instantPower})${c.magicLevels[m-1]}`]??0):0;
          const continuing=input.preset.kind==='DEFENCE'?buffsFor(c).filter(b=>b.magicOption===`M${m}`&&b.buffOption==='継続回復')
            .reduce((sum,b)=>sum+hp*(healContinueDict[`継続回復(${b.powerOption})${c.magicLevels[m-1]}`]??0)*Math.min(5,b.durationTurns??3),0):0;
          const actualHealing=actualInstant+continuing;
          // DF rewards the healing/damage enabled by immunity, not the count
          // of immunity spells. Healing already receives its curse adjustment
          // below; adding a second flat bonus favors redundant cleansers.
          const utility = (actualHealing?0:healing) + (immune && input.preset.kind!=='DEFENCE' ? 5000 : 0) + defensive;
          return { base, duo: m===2 && c.magicLevels[1]>=5, utility, heal:actualHealing, cure:/呪い無効|デバフ解除/.test(text) };
        });
        const buddies = ([1,2,3] as const).map(i => {
          const status = getBuddyStatusForCharacter({ ...raw, totsu: c.totsu }, i, { totsu: c.totsu, isActive: true });
          const summary = getBuddyStatusSummary(status, c.buddyLevels[i-1]);
          return { name: raw['buddy'+i+'c'], utility: usefulImmunity(status) && input.preset.kind!=='DEFENCE' ? 7000 : 0,
            hpRate: summary.hpRate, atkRate: summary.atkRate + summary.damageRate, curseImmune:status.includes('呪い無効'),
            critical:(criticalRatePowerScale[status.match(/クリティカル\(([^)]+)\)/)?.[1]??'']??0)/100 };
        });
        feature = { raw, atk, hp, magic, buddies }; cache.set(key, feature);
      }
      let damage = 0, utility = 0, hpRate = 0, atkRate = 0, duos = 0;
      const ownCure=feature.magic.some(m=>m.cure)||feature.buddies.some(b=>b.curseImmune&&names.has(b.name));
      if(allyCure&&!ownCure)externalHealing.push(feature.magic.reduce((sum,m)=>sum+m.heal*.5,0));
      for (const m of feature.magic) {
        const duo = m.duo && names.has(feature.raw.duo);
        damage += m.base * (duo ? 2.4/1.8 : 1);
        // Keep a heal's potential in partial teams; an allied immunity may be
        // added next. Only full battle trials decide whether it actually heals.
        utility += m.utility+m.heal*(!curse||ownCure?1:allyCure?0.8:0.3); duos += Number(duo);
      }
      for (const b of feature.buddies) if (names.has(b.name)) { utility += b.utility; hpRate += b.hpRate; atkRate += b.atkRate; }
      damage *= 1 + atkRate;
      const hp = feature.hp * (1 + hpRate);
      if(cards.length>=2&&cards.length<5) {
        for(const b of feature.buddies)if(!names.has(b.name)
          &&(ownCharacters.has(b.name)||examUsesSupport(input.preset)&&!cards.some(c=>c.support)&&supportCharacters.has(b.name))) {
          // A greedy partial team otherwise loses to standalone healers before
          // its HP/ATK/critical buddy can join. Credit only a discounted completion
          // potential; a completed team gets no speculative buddy stats.
          const unboosted=damage/(1+atkRate),peak=Math.max(...feature.magic.map(m=>m.base));
          const contribution=input.preset.kind==='DEFENCE'?feature.hp*b.hpRate+unboosted*b.atkRate*.25
            :feature.hp*b.hpRate*.15+unboosted*b.atkRate*(input.preset.kind==='BASIC'&&task.style!==1?.35:1)
              +(input.preset.kind==='BASIC'?peak*(b.atkRate+criticalTailMultiplier(b.critical,3,requiredPerAttempt)-1)*(task.style===1?.5:1.8):0);
          missingBuddyValue.set(b.name,(missingBuddyValue.get(b.name)??0)+contribution);
        }
      }
      score += input.preset.kind === 'DEFENCE' ? hp + damage*0.25 + utility
        : damage*(input.preset.kind==='BASIC'&&task.style!==1?0.35:input.preset.kind==='ATTACK'?0.3:1) + hp*0.15 + utility + (input.preset.kind === 'BASIC' ? duos*3000 : 0);
      if (task.style===1) score += utility;
      if (task.style===2) score += feature.hp*0.4;
    }
    score += [...missingBuddyValue.values()].sort((a,b)=>b-a).slice(0,5-cards.length).reduce((sum,value)=>sum+value,0)*.5;
    if(input.preset.kind==='DEFENCE') {
      if(allyCure&&cards.length===5) {
        const cures=cards.flatMap(c=>buffsFor(c).filter(b=>['呪い無効','デバフ解除'].includes(b.buffOption))
          .map(b=>({key:`${c.name}:${c.support}:${b.magicOption}`,target:b.targetType??'self'})));
        if(!cures.some(c=>c.target==='allyAll')) {
          // A selected-ally cure has only one partner. Do not credit every
          // healer in a full team for the same single cleansing opportunity.
          const partners=new Set(cures.filter(c=>c.target==='allySelected').map(c=>c.key)).size;
          score-=(task.style===1?2:1)*externalHealing.sort((a,b)=>b-a).slice(partners).reduce((sum,value)=>sum+value,0);
        }
      }
      return score;
    }
    const potential=finisher(cards);
    if(input.preset.kind==='BASIC')return score+potential.peak*(task.style===1?0.5:1.8);
    // ATTACK style 1 is an exploratory probability-sensitive ranking lane;
    // battle validation and all other styles retain the optimistic tail.
    return score+(input.preset.kind==='ATTACK'&&task.style===1?potential.meanTotal:potential.total)*0.7;
  };
}

// Preserve different DUO continuations while assembling a full team. A weak
// intermediate costume can connect several strong cards later in the chain.
function* duoChainSteps(input:SearchInput,task:GenerationTask,catalog:Catalog):Generator<void,Candidate[]> {
  const supportAllowed=examUsesSupport(input.preset),ownCount=supportAllowed?4:5;
  const support=!!task.supportAnchor,name=task.supportAnchor??task.anchor;
  const root=(support?input.supports:input.roster).find(c=>c.name===name);
  if(!root)return [];
  const estimate=cachedEstimator(input,{...task,style:0},catalog);
  let work=0;
  const registeredOptions=[...input.roster.flatMap(c=>cardVariants(c,catalog[c.name].rare)),
    ...(supportAllowed?input.supports.flatMap(c=>cardVariants(c,catalog[c.name].rare,true)):[])]
    .filter(c=>c.selectedMagic.includes(2)&&c.magicLevels[1]>=5);
  let options=registeredOptions;
  if(task.cost>0&&!support) {
    const remaining=input.budget-task.cost;
    const rootVariants=cardVariants(root,catalog[name].rare,false,task.totsu)
      .filter(c=>c.selectedMagic.includes(2)&&c.magicLevels[1]>=5);
    const linkedToRoot=(card:SearchCard)=>{
      const raw=catalog[card.name],rootRaw=catalog[name];
      return raw.chara===rootRaw.duo||raw.duo===rootRaw.chara;
    };
    const byCost=new Map<number,Map<string,{card:SearchCard;value:number;linked:boolean}>>();
    for(const raw of input.roster) {
      if(raw.name===name)continue;
      for(const target of upgradeTargets(raw,catalog[raw.name].rare,remaining,input.itemsPerLimitBreak)) {
        if(++work%64===0)yield;
        const variants=cardVariants(raw,catalog[raw.name].rare,false,target)
          .filter(c=>c.selectedMagic.includes(2)&&c.magicLevels[1]>=5);
        if(!variants.length)continue;
        const card=variants[0],cost=upgradeCost(input,[card]);
        if(cost<=0||cost>remaining)continue;
        const key=JSON.stringify([card.name,card.totsu]);
        const row={card,value:Math.max(...rootVariants.flatMap(rootOption=>variants.map(option=>estimate([rootOption,option])))),linked:linkedToRoot(card)};
        const lane=byCost.get(cost)??new Map<string,{card:SearchCard;value:number;linked:boolean}>();
        const previous=lane.get(key);
        if(!previous||row.value>previous.value)lane.set(key,row);
        byCost.set(cost,lane);
      }
    }
    const selectedStates:SearchCard[]=[];
    for(const [,lane] of [...byCost.entries()].sort(([a],[b])=>a-b)) {
      const rows=[...lane.values()].sort((a,b)=>b.value-a.value||a.card.name.localeCompare(b.card.name));
      const chosen=new Set<string>();
      for(const row of rows.filter(row=>row.linked).slice(0,4).concat(rows.filter(row=>!row.linked).slice(0,2))) {
        const key=JSON.stringify([row.card.name,row.card.totsu]);
        if(chosen.has(key))continue;
        chosen.add(key);selectedStates.push(row.card);
      }
    }
    options=[...registeredOptions,...selectedStates.flatMap(card=>cardVariants(
      input.roster.find(raw=>raw.name===card.name)!,catalog[card.name].rare,false,card.totsu)
      .filter(c=>c.selectedMagic.includes(2)&&c.magicLevels[1]>=5))];
  }
  let beam=cardVariants(root,catalog[name].rare,support,support?root.totsu:task.totsu)
    .filter(c=>c.selectedMagic.includes(2)&&c.magicLevels[1]>=5).map(c=>[c]);
  const canComplete = createCompletionCheck(input, catalog, options.filter(card => !card.support), options.filter(card => card.support), task.requiredCards ?? input.requiredCards);
  if (canComplete) beam = beam.filter(canComplete);
  const missing=(cards:SearchCard[])=>[...new Set(cards.filter(c=>!cards.some(other=>other!==c&&catalog[other.name].chara===catalog[c.name].duo))
    .map(c=>catalog[c.name].duo).filter(Boolean))].sort();
  const value=(cards:SearchCard[])=>estimate(cards)+cards.filter(c=>cards.some(other=>other!==c&&catalog[other.name].chara===catalog[c.name].duo)).length*10000;
  const costBalanced=<T extends {cards:SearchCard[]}>(rows:T[],limit:number):T[]=>{
    const buckets=new Map<number,T[]>();
    for(const row of rows) {
      const cost=upgradeCost(input,row.cards),bucket=buckets.get(cost)??[];
      bucket.push(row);buckets.set(cost,bucket);
    }
    const costs=[...buckets.keys()].sort((a,b)=>a-b),result:T[]=[];
    for(let index=0;result.length<limit;index++) {
      let added=false;
      for(const cost of costs) {
        const row=buckets.get(cost)![index];
        if(row){result.push(row);added=true;if(result.length>=limit)break;}
      }
      if(!added)break;
    }
    return result;
  };
  for(let depth=1;depth<5&&beam.length;depth++) {
    const expanded=new Map<string,{cards:SearchCard[];value:number}>();
    for(const cards of beam) {
      const wants=missing(cards);
      const legal=options.filter(c=>(c.support?!cards.some(other=>other.support)
        :cards.filter(other=>!other.support).length<ownCount&&!cards.some(other=>!other.support&&other.name===c.name))
        &&!(depth===4&&supportAllowed&&!cards.some(other=>other.support)&&!c.support))
        .filter(card => !canComplete || canComplete([...cards, card]));
      const linked=legal.filter(c=>wants.includes(catalog[c.name].chara));
      for(const card of linked.length?linked:legal) {
        if(++work%64===0)yield;
        const team=[...cards,card].sort((a,b)=>Number(a.support)-Number(b.support)||a.name.localeCompare(b.name));
        if(upgradeCost(input,team)>input.budget)continue;
        const key=JSON.stringify(team.map(c=>[c.name,c.totsu,c.selectedMagic,c.support]));
        if(!expanded.has(key))expanded.set(key,{cards:team,value:value(team)});
      }
    }
    const groups=new Map<string,number>();
    const ranked=[...expanded.values()].sort((a,b)=>b.value-a.value).filter(row=>{
      const key=JSON.stringify([missing(row.cards),row.cards.map(c=>catalog[c.name].chara).sort(),row.cards.some(c=>c.support),
        task.cost>0?upgradeCost(input,row.cards):0,
        task.cost>0?row.cards.map(c=>[c.name,c.totsu,c.support]).sort((a,b)=>String(a).localeCompare(String(b))):[]]);
      const n=groups.get(key)??0;if(n>=2)return false;groups.set(key,n+1);return true;
    });
    beam=(task.cost>0?costBalanced(ranked,32):ranked.slice(0,32)).map(row=>row.cards);
  }
  const challengeIds=[...task.challenges].sort(),policy:PolicyKind=input.preset.kind==='ATTACK'?'effects-duo':'effects-score';
  const finished=beam.filter(cards=>cards.length===5&&cards.filter(c=>!c.support).length===ownCount
    && candidateIncludesRequired(input,{cards},catalog))
    .sort((a,b)=>value(b)-value(a)).map(cards=>({cards,challengeIds,policy,cost:upgradeCost(input,cards),estimate:estimate(cards),
      id:JSON.stringify([cards.map(c=>[c.name,c.totsu,c.selectedMagic,c.support]),challengeIds,policy])}));
  const selected=task.cost>0?costBalanced(finished,8):finished.slice(0,8);
  return selected;
}

function* generateSteps(input: SearchInput, task: GenerationTask, catalog: Catalog): Generator<void, Candidate[]> {
  if(task.duoChain)return yield* duoChainSteps(input,task,catalog);
  const supportAllowed=examUsesSupport(input.preset),ownCount=supportAllowed?4:5,supportFirst=supportAllowed&&task.supportFirst;
  const estimate = cachedEstimator(input, task, catalog);
  if(task.seedTeam) {
    if (task.requiredCards?.some(name => !task.seedTeam!.includes(name))) return [];
    if (task.requiredSupport && task.seedTeam[4] !== task.requiredSupport) return [];
    if ((input.requiredCharacters ?? []).some(chara => !task.seedTeam!.some(name => catalog[name]?.chara === chara))) return [];
    // Five saved names have at most 3^5 legal spell combinations. Enumerate
    // this small space directly; the general beam's composition deduplication
    // would otherwise discard nearly every alternative on the same five cards.
    let teams:SearchCard[][]=[[]];
    for(const [index,name] of task.seedTeam.entries()) {
      const support=supportAllowed&&index===4;
      const original=(support?input.supports:input.roster).find(c=>c.name===name)!;
      const choices=cardVariants(original,catalog[name].rare,support,!support&&name===task.anchor?task.totsu:original.totsu);
      teams=teams.flatMap(team=>choices.map(card=>[...team,card]));
    }
    const best=new Map<number,{cards:SearchCard[];value:number}>();
    const estimates=[0,1,2].map(style=>cachedEstimator(input,{...task,style},catalog));
    for(const [index,team] of teams.entries()) {
      if(index%32===0)yield;
      const cards=team.filter(c=>!c.support).sort((a,b)=>a.name.localeCompare(b.name)).concat(team.filter(c=>c.support));
      for(const [style,estimate] of estimates.entries()) {
        const value=estimate(cards);
        if(!best.has(style)||value>best.get(style)!.value)best.set(style,{cards,value});
      }
    }
    const policies:PolicyKind[]=input.preset.kind==='DEFENCE'?['effects-score','effects-score','effects-score']
      :input.preset.kind==='BASIC'?['effects-tail','effects-tail','effects-tail']:['effects-public','effects-tail','effects-duo'];
    const selected=new Map<string,Candidate>(),challengeIds=[...task.challenges].sort();
    for(const [style,{cards,value}] of best) {
      const policy=policies[style],id=JSON.stringify([cards.map(c=>[c.name,c.totsu,c.selectedMagic,c.support]),challengeIds,policy]);
      selected.set(id,{id,cards,challengeIds,cost:task.cost,policy,estimate:value});
    }
    return [...selected.values()];
  }
  const anchor = input.roster.find(c => c.name === task.anchor)!;
  const requiredNames=task.requiredCards ? [...new Set(task.requiredCards)] : [...new Set(input.requiredCards ?? [])];
  const requiredCharacters=[...new Set(input.requiredCharacters ?? [])];
  const inferredSupport=requiredNames.length&&!task.requiredSupport
    ? requiredCardSupportAssignments(input)[0] : undefined;
  const requiredSupport=task.requiredSupport ?? inferredSupport;
  const forcedSupport=task.supportAnchor ?? requiredSupport;
  const fixedSupport=!!(supportAllowed&&forcedSupport);
  const requiredOwned=requiredOwnedNames(input,requiredSupport);
  // One of the three construction styles can spend the remaining budget on
  // partners immediately. A pair that only works after both M3 unlocks must
  // not first survive real trials at the partner's untrained state.
  const splitBudget=task.style===2&&task.cost>0&&task.cost<input.budget&&!forcedSupport;
  let options = input.roster.filter(c => (fixedSupport||c.name !== task.anchor)
    && !requiredOwned.includes(c.name)
    &&(!task.seedTeam||task.seedTeam.slice(0,ownCount).includes(c.name)))
    .flatMap(c => [c.totsu,...(splitBudget?upgradeTargets(c,catalog[c.name].rare,input.budget-task.cost,input.itemsPerLimitBreak):[])]
      .flatMap(t=>cardVariants(c,catalog[c.name].rare,false,t)));
  let supportOptions = supportAllowed?input.supports.filter(c=>(!task.seedTeam||c.name===task.seedTeam[4])
    &&(!forcedSupport||c.name===forcedSupport)).flatMap(s => cardVariants(s, catalog[s.name].rare, true)):[];
  // A fixed support must leave all owned slots free. The partner used to rank
  // this task is only a scheduling estimate, not a required team member.
  let beam = fixedSupport?supportOptions.map(c=>[c]):cardVariants(anchor, catalog[anchor.name].rare, false, task.totsu).map(c => [c]);
  if (requiredNames.length) {
    const anchorRequired=requiredOwned.includes(task.anchor);
    const includeAnchor=!anchorRequired&&requiredOwned.length<ownCount&&!fixedSupport;
    const anchorCost=includeAnchor?(task.totsu-anchor.totsu)*input.itemsPerLimitBreak:0;
    const allocationBudget=Math.max(0,task.cost-anchorCost);
    // Build the beam from required identities first. Enumerating only legal
    // target allocations keeps multi-upgrade requests discoverable without
    // generating a full roster cross-product and avoids post-filtering them.
    const targetsByName = new Map<string, number[]>();
    for (const name of requiredOwned) {
      const raw=input.roster.find(c=>c.name===name)!;
      targetsByName.set(name,[raw.totsu,...upgradeTargets(raw,catalog[name].rare,input.budget,input.itemsPerLimitBreak)]);
    }
    const allocations:{name:string;target:number}[][]=[];
    const visit=(index:number,cost:number,row:{name:string;target:number}[])=>{
      if(index===requiredOwned.length){
        if(cost===allocationBudget) allocations.push(row); return;
      }
      const name=requiredOwned[index],raw=input.roster.find(c=>c.name===name)!;
      for(const target of targetsByName.get(name)??[]) {
        const next=cost+(target-raw.totsu)*input.itemsPerLimitBreak;
        if(next>allocationBudget)continue;
        visit(index+1,next,[...row,{name,target}]);
      }
    };
    if(requiredOwned.length)visit(0,0,[]);
    else allocations.push([]);
    if(!allocations.length&&requiredOwned.length){
      const baseline=requiredOwned.map(name=>({name,target:input.roster.find(c=>c.name===name)!.totsu}));
      allocations.push(baseline);
    }
    const prefix:SearchCard[][]=[];
    for(const allocation of allocations.slice(0,96)) {
      let teams:SearchCard[][]=[[]];
      for(const row of allocation) {
        const raw=input.roster.find(c=>c.name===row.name)!;
        const choices=cardVariants(raw,catalog[row.name].rare,false,row.target);
        teams=teams.flatMap(team=>choices.map(card=>[...team,card])).slice(0,256);
      }
      prefix.push(...teams);
    }
    const extras=includeAnchor
      ? cardVariants(anchor,catalog[anchor.name].rare,false,task.totsu).map(c=>[c]) : [[]];
    beam=[];
    for(const base of prefix) for(const extra of extras) {
      const own=[...base,...extra].sort((a,b)=>a.name.localeCompare(b.name));
      if(new Set(own.map(c=>c.name)).size!==own.length)continue;
      // A task-fixed support must survive rebuilding the required-card prefix,
      // even when none of the user's required cards is assigned to support.
      beam.push(...(fixedSupport
        ? supportOptions.slice(0,8).map(support=>[...own,support])
        : [own]));
    }
    if(!beam.length && !requiredOwned.length) beam=cardVariants(anchor,catalog[anchor.name].rare,false,task.totsu).map(c=>[c]);
  }
  const canCompleteCharacters = createCompletionCheck(input, catalog, options, supportOptions, requiredNames);
  if (canCompleteCharacters) beam = beam.filter(canCompleteCharacters);
  if (!beam.length) return [];
  const selectBeam=(choices:{cards:SearchCard[];value:number}[],depth:number)=>{
    const width=fixedSupport?8:12;
    const finish=(preferred:typeof choices)=>diversifyBeam(choices,preferred,width,requiredCharacters,catalog).map(row=>row.cards);
    if(task.seedTeam)return choices.slice(0,width).map(c=>c.cards);
    if(fixedSupport||task.style!==2||choices.length<=width)return finish(choices.slice(0,width));
    const hash=(cards:SearchCard[])=>{
      let result=2166136261;
      const key=`${task.anchor}:${task.totsu}:${depth}:`+cards.map(c=>`${c.name}:${c.selectedMagic}:${c.support}`).join('|');
      for(const character of key)result=Math.imul(result^character.charCodeAt(0),16777619);
      return result>>>0;
    };
    // Keep the leading eight branches and four reproducibly varied alternatives
    // near the front. A missing buddy may make a later addition transformative.
    const alternatives=choices.slice(8,120).map(choice=>({...choice,priority:hash(choice.cards)})).sort((a,b)=>a.priority-b.priority).slice(0,4);
    return finish([...choices.slice(0,8),...alternatives]);
  };
  const shortlist=(choices:SearchCard[])=>{
    if(task.seedTeam||new Set(choices.map(c=>c.name)).size<=96)return choices;
    const groups=new Map<string,Map<string,number>>();
    for(const card of choices) {
      const character=catalog[card.name].chara;
      if(!groups.has(character))groups.set(character,new Map());
      const group=groups.get(character)!;
      group.set(card.name,Math.max(group.get(card.name)??-Infinity,...beam.map(partial=>estimate([...partial,card]))));
    }
    const names=new Set([...groups.values()].flatMap(group=>[...group].sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0])).slice(0,3).map(([name])=>name)));
    return choices.filter(c=>names.has(c.name));
  };
  // Bound each beam expansion by character, preserving all spell pairs for
  // retained cards. Every owned card still has its own forced-anchor task.
  const requiredBeamFull=requiredNames.length>0&&!!beam[0]&&beam[0].filter(card=>!card.support).length>=ownCount;
  if (!requiredBeamFull) options=shortlist(options);
  if (!requiredNames.length || !requiredSupport) supportOptions=shortlist(supportOptions);
  if(supportFirst&&!fixedSupport&&!requiredSupport) {
    const seeds:{cards:SearchCard[];value:number}[]=[];
    let count=0;
    for(const own of beam)for(const support of supportOptions){
      if(++count%128===0)yield;
      const cards=[...own,support];
      if (canCompleteCharacters && !canCompleteCharacters(cards)) continue;
      seeds.push({cards,value:estimate(cards)});
    }
    const supportCounts=new Map<string,number>();
    beam=selectBeam(seeds.sort((a,b)=>b.value-a.value).filter(s=>{
      const name=s.cards.at(-1)!.name,count=supportCounts.get(name)??0;
      if(count>=2)return false;supportCounts.set(name,count+1);return true;
    }),0);
  }
  const initialDepth=beam.length?beam[0].filter(card=>!card.support).length:(fixedSupport?0:1);
  for (let depth = initialDepth; depth < ownCount; depth++) {
    const expanded: { cards: SearchCard[]; value: number }[] = [];
    const seen = new Set<string>();
    let processed = 0;
    for (const partial of beam) for (const card of options) {
      if (++processed % 128 === 0) yield;
      if(requiredCharacters.length) {
        const missingCharacters=requiredCharacters.filter(name=>!partial.some(c=>catalog[c.name]?.chara===name));
        const remainingAfter = ownCount - (partial.filter(c=>!c.support).length + 1);
        const hasSupport=partial.some(c=>c.support);
        const supportCapacity=(!hasSupport&&supportAllowed&&!fixedSupport&&supportOptions.some(c=>missingCharacters.includes(catalog[c.name]?.chara)))?1:0;
        // Required characters are construction constraints. If there are more
        // missing characters than slots left, only a missing character can be
        // added here; this prevents a promising-looking partial team from
        // consuming the only slot that could satisfy the request. The task's
        // buddy hint remains an independent, lower-priority construction hint.
        if(missingCharacters.length>remainingAfter+supportCapacity && !missingCharacters.includes(catalog[card.name]?.chara))continue;
      }
      const nextBuddy=task.requiredCharacters?.find(name=>!partial.some(c=>catalog[c.name]?.chara===name));
      const missingInputCharacter=requiredCharacters.length>0
        &&requiredCharacters.some(name=>!partial.some(c=>catalog[c.name]?.chara===name));
      if(!missingInputCharacter&&nextBuddy&&catalog[card.name]?.chara!==nextBuddy)continue;
      if (partial.some(c => !c.support && c.name === card.name)) continue;
      const cards = [...partial.filter(c=>!c.support), card].sort((a, b) => a.name.localeCompare(b.name)).concat(partial.filter(c=>c.support));
      if (canCompleteCharacters && !canCompleteCharacters(cards)) continue;
      if(upgradeCost(input,cards)>input.budget)continue;
      const key = cards.map(c => `${c.name}:${c.totsu}:${c.selectedMagic}`).join('|');
      if (seen.has(key)) continue;
      seen.add(key);
      expanded.push({ cards, value: estimate(cards) });
    }
    expanded.sort((a, b) => b.value - a.value);
    const compositions = new Map<string, number>();
    beam = selectBeam(expanded.filter(e => {
      const key = e.cards.map(c => c.name).join('|'), count = compositions.get(key) ?? 0;
      if (count >= (fixedSupport?1:2)) return false;
      compositions.set(key, count + 1); return true;
    }),depth);
  }
  const finished: { cards: SearchCard[]; value: number }[] = [];
  let supportCount = 0;
  for (const own of beam) for (const support of fixedSupport||supportFirst||!supportAllowed?[null]:supportOptions) {
    if (++supportCount % 128 === 0) yield;
    const cards = support ? [...own, support] : own;
    if (cards.length !== 5 || cards.filter(card => card.support).length !== Number(supportAllowed)) continue;
    if (requiredCharacters.length) {
      const covered = new Set(cards.map(card => catalog[card.name]?.chara).filter((name): name is string => !!name));
      if (!requiredCharacters.every(name => covered.has(name))) continue;
    }
    finished.push({ cards, value: estimate(cards) });
    finished.sort((a, b) => b.value - a.value);
    // Keep distinct teams, rather than spending both places on the same five
    // cards with a different spell. Spell substitutions remain in refinement.
    const composition = requiredNames.length
      ? cards.map(c => `${c.name}:${c.totsu}`).join('|')
      : cards.map(c => c.name).join('|');
    const signature=(row:{cards:SearchCard[]})=>requiredNames.length
      ? row.cards.map(c=>`${c.name}:${c.totsu}`).join('|')
      : row.cards.map(c=>c.name).join('|');
    const duplicate = finished.findIndex((e,i) => i > 0 && signature(e) === composition
      && finished.slice(0,i).some(previous=>signature(previous) === composition));
    if (duplicate >= 0) finished.splice(duplicate,1);
    if (finished.length > (requiredNames.length ? 8 : 2)) finished.pop();
  }
  const setups: typeof finished = [];
  for (const {cards} of input.preset.kind==='DEFENCE'?[]:finished) for (const [index,card] of cards.entries()) {
    if (!card.selectedMagic.includes(2)) continue;
    const raw=catalog[card.name];
    const setupMagic=parseMagicBuffsFromEtc(raw).filter(b=>
      ['ATKUP','ダメージUP','属性ダメUP','クリティカル'].includes(b.buffOption)
      && (b.durationTurns??1)>=2).map(b=>Number(b.magicOption.slice(1)));
    const original=(card.support?input.supports:input.roster).find(c=>c.name===card.name)!;
    for(const alternative of cardVariants(original,raw.rare,card.support,card.totsu)) {
      if(!alternative.selectedMagic.includes(2)||!setupMagic.some(m=>alternative.selectedMagic.includes(m as 1|2|3)&&!card.selectedMagic.includes(m as 1|2|3)))continue;
      const team=cards.map((c,i)=>i===index?alternative:c);
      setups.push({cards:team,value:estimate(team)});
    }
  }
  // A whole-team scalar can hide a second finisher's setup behind the first
  // finisher's peak. Give a bounded number of those legal spell pairs real trials.
  const scoringSetups:{cards:SearchCard[];value:number;gain:number}[]=[];
  if(input.preset.kind==='ATTACK')for(const {cards} of finished)for(const [index,card] of cards.entries()) {
    const raw=catalog[card.name],buffs=attackScoreEffects(raw);
    const count=(c:SearchCard)=>Math.max(...c.selectedMagic.map(m=>buffs.filter(b=>b.magicOption===`M${m}`).length));
    const current=count(card),original=(card.support?input.supports:input.roster).find(c=>c.name===card.name)!;
    let best:typeof scoringSetups[number]|undefined;
    for(const alternative of cardVariants(original,raw.rare,card.support,card.totsu)) {
      const gain=count(alternative)-current;if(gain<=0)continue;
      const team=cards.map((c,i)=>i===index?alternative:c),value=estimate(team);
      if(!best||gain>best.gain||gain===best.gain&&value>best.value)best={cards:team,value,gain};
    }
    if(best)scoringSetups.push(best);
  }
  const initial=[...finished,...setups.sort((a,b)=>b.value-a.value).slice(0,2),
    ...scoringSetups.sort((a,b)=>b.gain-a.gain||b.value-a.value).slice(0,2)];
  // Compare more compositions before repeating every policy on the same five.
  // Promising compositions receive the other policies in the refinement stage.
  const policyCycle: PolicyKind[] = input.preset.kind==='DEFENCE'
    ? ['effects-score'] : input.preset.kind==='BASIC'
    ? ['effects-tail'] : ['effects-public','effects-tail','effects-duo'];
  const policies=[policyCycle[task.style%policyCycle.length]];
  return initial.flatMap(({ cards, value }) => policies.map(policy => {
    const challengeIds = [...task.challenges].sort();
    const id = JSON.stringify([cards.map(c => [c.name, c.totsu, c.selectedMagic, c.support]), challengeIds, policy]);
    return { id, cards, challengeIds, cost: upgradeCost(input,cards), policy, estimate: value };
  }));
}

export function generateCandidates(input: SearchInput, task: GenerationTask, catalog: Catalog): Candidate[] {
  const steps = generateSteps(input, task, catalog);
  let next = steps.next();
  while (!next.done) next = steps.next();
  return next.value.filter(candidate => candidateIncludesRequired(input,candidate,catalog));
}

export async function generateCandidatesAsync(input: SearchInput, task: GenerationTask, catalog: Catalog, stop: () => boolean): Promise<Candidate[] | null> {
  const steps = generateSteps(input, task, catalog);
  let lastYield = performance.now();
  let next = steps.next();
  while (!next.done) {
    if (performance.now() - lastYield >= 8) {
      await yieldToHost();
      lastYield = performance.now();
    }
    if (stop()) return null;
    next = steps.next();
  }
  return next.value.filter(candidate => candidateIncludesRequired(input,candidate,catalog));
}

// Exchange one owned card with its same-card support copy, then fill the old
// support character with an owned card. This is a coupled mutation: changing
// the two roles independently can prune the intermediate state before the
// resulting five-character team is measured. Keep a small, explicit set per
// promoted slot and item cost so the exchange cannot be lost behind the larger
// allocation neighborhood.
async function supportRoleExchangeNeighbors(input: SearchInput, parent: Candidate, catalog: Catalog,
  seen: Set<string>, stop: () => boolean, estimate: (cards: SearchCard[]) => number): Promise<Candidate[]> {
  if (!examUsesSupport(input.preset)) return [];
  const supportIndex = parent.cards.findIndex(card => card.support);
  if (supportIndex < 0 || parent.cards.filter(card => card.support).length !== 1) return [];
  const originalSupport = parent.cards[supportIndex];
  const supportCharacter = catalog[originalSupport.name]?.chara;
  if (!supportCharacter) return [];
  const buckets = new Map<string, { candidate: Candidate; hasM2: boolean }[]>();
  const unique = new Set<string>();
  let work = 0;
  for (let promoteIndex = 0; promoteIndex < parent.cards.length; promoteIndex++) {
    const promoted = parent.cards[promoteIndex];
    if (promoted.support) continue;
    const sameCardSupports = input.supports.filter(card => card.name === promoted.name);
    if (!sameCardSupports.length) continue;
    // The old support character is removed from the support slot, so only
    // unchanged owned names must be excluded from the replacement choices.
    const unchangedOwned = new Set(parent.cards.filter((card, index) =>
      !card.support && index !== promoteIndex).map(card => card.name));
    const replacements = input.roster.filter(card =>
      catalog[card.name]?.chara === supportCharacter && !unchangedOwned.has(card.name));
    if (!replacements.length) continue;
    for (const supportRaw of sameCardSupports) {
      const supportOptions = cardVariants(supportRaw, catalog[supportRaw.name].rare, true, supportRaw.totsu);
      for (const replacementRaw of replacements) {
        const targets = [replacementRaw.totsu,
          ...upgradeTargets(replacementRaw, catalog[replacementRaw.name].rare, input.budget, input.itemsPerLimitBreak)];
        for (const target of targets) for (const replacement of cardVariants(
          replacementRaw, catalog[replacementRaw.name].rare, false, target)) for (const support of supportOptions) {
          if (++work % 64 === 0) { await yieldToHost(); if (stop()) return []; }
          const cards = parent.cards.map((card, index) => index === promoteIndex ? support
            : index === supportIndex ? replacement : card);
          const own = cards.filter(card => !card.support).sort((a, b) => a.name.localeCompare(b.name));
          if (own.length !== 4 || new Set(own.map(card => card.name)).size !== 4) continue;
          const canonical = [...own, cards.find(card => card.support)!];
          const initialCost = upgradeCost(input, canonical);
          // A role exchange can introduce a fully trained replacement while
          // freeing a promoted owned slot. If that intermediate exceeds the
          // budget, spend the excess from the other unchanged owned cards so
          // the legal redistribution reaches the shared budget. Keep the
          // replacement and promoted support untouched.
          const repaired: SearchCard[][] = [];
          if (initialCost <= input.budget) repaired.push(canonical);
          else {
            const donorCards = canonical.filter(card => !card.support && card !== replacement);
            const caps = donorCards.map(card => Math.max(0, card.totsu - card.originalTotsu));
            const required = Math.ceil((initialCost - input.budget) / input.itemsPerLimitBreak);
            if (required <= caps.reduce((sum, cap) => sum + cap, 0)) {
              for (const reductions of donorReductions(caps, required)) {
                const changed = canonical.map(card => {
                  const donorIndex = donorCards.indexOf(card);
                  const reduction = donorIndex < 0 ? 0 : reductions[donorIndex];
                  if (!reduction) return card;
                  const original = input.roster.find(raw => raw.name === card.name)!;
                  const target = card.totsu - reduction;
                  const options = cardVariants(original, catalog[card.name].rare, false, target);
                  return options.find(option => option.selectedMagic.join(',') === card.selectedMagic.join(','))
                    ?? options.find(option => option.selectedMagic.join(',') === '1,2');
                });
                if (changed.every((card): card is SearchCard => !!card)
                  && upgradeCost(input, changed) <= input.budget) repaired.push(changed);
              }
            }
          }
          for (const repairedCards of repaired) {
            const cost = upgradeCost(input, repairedCards);
            const id = JSON.stringify([repairedCards.map(card => [card.name, card.totsu, card.selectedMagic, card.support]),
              parent.challengeIds, parent.policy]);
            if (seen.has(id) || unique.has(id)) continue;
            unique.add(id);
            const candidate = { ...parent, id, cards: repairedCards, cost, estimate: estimate(repairedCards),
              preferredPlan: undefined, preferredPlanMode: undefined };
            const bucket = `${promoteIndex}:${cost}`;
            const rows = buckets.get(bucket) ?? [];
            rows.push({ candidate, hasM2: replacement.selectedMagic.includes(2) && support.selectedMagic.includes(2) });
            buckets.set(bucket, rows);
          }
        }
      }
    }
  }
  const selected: Candidate[] = [];
  for (const rows of buckets.values()) {
    rows.sort((a, b) => b.candidate.estimate - a.candidate.estimate || a.candidate.id.localeCompare(b.candidate.id));
    const best = rows[0];
    const bestM2 = rows.find(row => row.hasM2 && row.candidate.id !== best.candidate.id);
    if (best) selected.push(best.candidate);
    if (bestM2) selected.push(bestM2.candidate);
  }
  return selected.filter(candidate => candidateIncludesRequired(input,candidate,catalog));
}

// Refine decks that actually performed well, rather than ending after the
// heuristic beam. All proposals still obey ownership, support and item limits.
export async function generateNeighbors(input: SearchInput, parent: Candidate, catalog: Catalog,
  seen: Set<string>, stop: () => boolean): Promise<Candidate[]> {
  const estimate = cachedEstimator(input, { anchor: '', totsu: 0, cost: 0, challenges: parent.challengeIds, style: 0 }, catalog);
  const proposals: { candidate: Candidate; spellOnly: boolean; index: number; option: SearchCard }[] = [];
  const rebalanced = new Map<string, { candidate: Candidate; hasM2: boolean }[]>();
  const unique = new Set<string>();
  let count = 0;
  for (let index = 0; index < parent.cards.length; index++) {
    const slot = parent.cards[index];
    const source = slot.support ? input.supports : input.roster;
    for (const raw of source) {
      if (++count % 64 === 0) { await yieldToHost(); if (stop()) return []; }
      if (!slot.support && parent.cards.some((c, i) => i !== index && !c.support && c.name === raw.name)) continue;
      const targets = slot.support ? [raw.totsu] : [raw.totsu, ...upgradeTargets(raw, catalog[raw.name].rare, input.budget, input.itemsPerLimitBreak)];
      for (const target of targets) for (const option of cardVariants(raw, catalog[raw.name].rare, slot.support, target)) {
        const replacement = parent.cards.map((c, i) => i === index ? option : c);
        const cards = [...replacement.filter(c=>!c.support).sort((a,b)=>a.name.localeCompare(b.name)), ...replacement.filter(c=>c.support)];
        const upgrades = cards.filter(c => !c.support && c.totsu > c.originalTotsu);
        const cost = upgrades.reduce((sum, c) => sum + (c.totsu - c.originalTotsu) * input.itemsPerLimitBreak, 0);
        if (cost > input.budget && option.name !== slot.name && !slot.support) {
          const replacement = cards.find(card => !card.support && card.name === option.name);
          const donorCards = cards.filter(card => !card.support && card !== replacement);
          const caps = donorCards.map(card => Math.max(0, card.totsu - card.originalTotsu));
          const required = Math.ceil((cost - input.budget) / input.itemsPerLimitBreak);
          if (required <= caps.reduce((sum, cap) => sum + cap, 0)) {
            for (const reductions of donorReductions(caps, required)) {
              if (++count % 64 === 0) { await yieldToHost(); if (stop()) return []; }
              const changed: (SearchCard | undefined)[] = cards.map(card => {
                const donorIndex = donorCards.indexOf(card);
                const reduction = donorIndex < 0 ? 0 : reductions[donorIndex];
                if (!reduction) return card;
                const original = input.roster.find(raw => raw.name === card.name)!;
                const target = card.totsu - reduction;
                const options = cardVariants(original, catalog[card.name].rare, false, target);
                return options.find(candidate => candidate.selectedMagic.join(',') === card.selectedMagic.join(','))
                  ?? options.find(candidate => candidate.selectedMagic.join(',') === '1,2');
              });
              if (changed.some(card => !card)) continue;
              const validChanged = changed.filter((card): card is SearchCard => !!card);
              const canonical = [...validChanged.filter(card => !card.support).sort((a,b)=>a.name.localeCompare(b.name)),
                ...validChanged.filter(card => card.support)];
              const balancedCost = upgradeCost(input, canonical);
              if (balancedCost > input.budget) continue;
              const id = JSON.stringify([canonical.map(card => [card.name, card.totsu, card.selectedMagic, card.support]),
                parent.challengeIds, parent.policy]);
              if (seen.has(id) || unique.has(id)) continue;
              unique.add(id);
              const candidate = { ...parent, id, cards: canonical, cost: balancedCost, estimate: estimate(canonical),
                preferredPlan: undefined, preferredPlanMode: undefined };
              const bucket = `${index}:${balancedCost}`;
              const rows = rebalanced.get(bucket) ?? [];
              rows.push({ candidate, hasM2: !!canonical.find(card => !card.support && card.name === option.name
                && card.selectedMagic.includes(2)) });
              rebalanced.set(bucket, rows);
            }
          }
        }
        if (cost > input.budget) continue;
        const id = JSON.stringify([cards.map(c => [c.name, c.totsu, c.selectedMagic, c.support]), parent.challengeIds, parent.policy]);
        if (seen.has(id) || unique.has(id)) continue;
        unique.add(id);
        proposals.push({ candidate: { ...parent, preferredPlan: undefined, preferredPlanMode: undefined, id, cards, cost, estimate: estimate(cards) },
          spellOnly: option.name === slot.name && option.totsu === slot.totsu, index, option });
      }
    }
  }
  proposals.sort((a,b) => Number(b.spellOnly)-Number(a.spellOnly) || b.candidate.estimate-a.candidate.estimate);
  // Preserve coupled role exchanges before regular mutation/allocation choices.
  // They are legal only for unified exams and are intentionally not subject to
  // the per-slot three-choice ranking below.
  const selected = await supportRoleExchangeNeighbors(input, parent, catalog, seen, stop, estimate);
  if (stop()) return [];
  for (const rows of rebalanced.values()) {
    rows.sort((a,b) => b.candidate.estimate - a.candidate.estimate || a.candidate.id.localeCompare(b.candidate.id));
    const best = rows[0], bestM2 = rows.find(row => row.hasM2 && row.candidate.id !== best.candidate.id);
    if (best) selected.push(best.candidate);
    if (bestM2) selected.push(bestM2.candidate);
  }
  selected.push(...parent.cards.flatMap((slot,index)=>{
    const options=proposals.filter(p=>p.index===index);
    // Spell alternatives must not consume every mutation slot. A card that
    // only becomes useful after a replacement or upgrade needs a real battle.
    const choices=[options.find(p=>p.spellOnly),
      options.find(p=>p.option.name!==slot.name),
      options.find(p=>p.option.name===slot.name&&p.option.totsu!==slot.totsu)];
    return [...new Set([...choices.filter((p):p is typeof options[number]=>!!p),...options])]
      .slice(0,3).map(p=>p.candidate);
  }));
  const allocations=new Map<string,Candidate>();
  for(const cards of allocationCards(input,parent,catalog)) {
    if(++count%64===0){await yieldToHost();if(stop())return [];}
    const id=JSON.stringify([cards.map(c=>[c.name,c.totsu,c.selectedMagic,c.support]),parent.challengeIds,parent.policy]);
    if(seen.has(id)||selected.some(c=>c.id===id))continue;
    const key=JSON.stringify(cards.filter(c=>!c.support).map(c=>[c.name,c.totsu]));
    const value=estimate(cards);
    if(!allocations.has(key)||value>allocations.get(key)!.estimate)allocations.set(key,{...parent,id,cards,
      cost:upgradeCost(input,cards),estimate:value,preferredPlan:undefined,preferredPlanMode:undefined});
  }
  // One spell setup per allocation bounds battle trials without excluding
  // split investments or moving the full budget between existing members.
  for(const candidate of [...allocations.values()].sort((a,b)=>a.cost-b.cost||b.estimate-a.estimate)) {
    selected.push(candidate);unique.add(candidate.id);
  }
  // Introduce a linked pair together, even when neither one-card substitution
  // was competitive enough to survive the measured pool.
  for(let i=0;i<4;i++) for(let j=i+1;j<5;j++) {
    await yieldToHost(); if(stop())return [];
    const names=new Set<string>();
    const primary=proposals.filter(p=>p.index===i&&p.option.name!==parent.cards[i].name)
      .sort((a,b)=>b.candidate.estimate-a.candidate.estimate)
      .filter(p=>!names.has(p.option.name)&&!!names.add(p.option.name)).slice(0,8);
    let best:Candidate|undefined;
    for(const p of primary) {
      const raw=catalog[p.option.name], partners=new Set([raw.duo,raw.buddy1c,raw.buddy2c,raw.buddy3c]);
      const support=parent.cards[j].support;
      const source=(support?input.supports:input.roster).filter(c=>{
        const other=catalog[c.name];
        // Buddy/DUO links are directed. The second replacement can benefit
        // from the first even when the first has no link pointing back.
        return c.name!==parent.cards[j].name&&(partners.has(other.chara)
          ||[other.duo,other.buddy1c,other.buddy2c,other.buddy3c].includes(raw.chara));
      });
      for(const card of source) {
        if(++count%64===0){await yieldToHost();if(stop())return [];}
        const targets=support?[card.totsu]:[card.totsu,...upgradeTargets(card,catalog[card.name].rare,input.budget,input.itemsPerLimitBreak)];
        for(const totsu of targets) for(const option of cardVariants(card,catalog[card.name].rare,support,totsu)) {
          const replacement=parent.cards.map((c,index)=>index===i?p.option:index===j?option:c);
          const own=replacement.filter(c=>!c.support).sort((a,b)=>a.name.localeCompare(b.name));
          if(new Set(own.map(c=>c.name)).size!==(examUsesSupport(input.preset)?4:5))continue;
          const upgrades=own.filter(c=>c.totsu>c.originalTotsu);
          const cost=upgrades.reduce((sum,c)=>sum+(c.totsu-c.originalTotsu)*input.itemsPerLimitBreak,0);
          if(cost>input.budget)continue;
          const cards=[...own,...replacement.filter(c=>c.support)];
          const id=JSON.stringify([cards.map(c=>[c.name,c.totsu,c.selectedMagic,c.support]),parent.challengeIds,parent.policy]);
          if(seen.has(id)||unique.has(id))continue;
          const value=estimate(cards);
          if(!best||value>best.estimate)best={...parent,preferredPlan:undefined,preferredPlanMode:undefined,id,cards,cost,estimate:value};
        }
      }
    }
    if(best){selected.push(best);unique.add(best.id);}
  }
  return selected.filter(candidate => candidateIncludesRequired(input,candidate,catalog));
}

// Recombine two measured teams to cross valleys that a single-card replacement
// cannot cross (for example, a new attacker together with its DUO/buddy partner).
export function crossCandidates(input: SearchInput, a: Candidate, b: Candidate, catalog: Catalog, seen: Set<string>): Candidate[] {
  if (a.challengeIds.join('|') !== b.challengeIds.join('|')) return [];
  const cardKey=(c:SearchCard)=>[c.name,c.totsu,c.selectedMagic.join(',')].join(':');
  const all=[...new Map([...a.cards,...b.cards].filter(c=>!c.support).map(c=>[cardKey(c),c])).values()];
  const supports=[...new Map([...a.cards,...b.cards].filter(c=>c.support).map(c=>[cardKey(c),c])).values()];
  const estimate=cachedEstimator(input,{anchor:'',totsu:0,cost:0,challenges:a.challengeIds,style:0},catalog);
  const results:Candidate[]=[],unique=new Set<string>();
  const supportAllowed=examUsesSupport(input.preset),ownCount=supportAllowed?4:5;
  function* combinations(start=0,chosen:SearchCard[]=[]):Generator<SearchCard[]> {
    if(chosen.length===ownCount){yield chosen;return;}
    for(let i=start;i<=all.length-(ownCount-chosen.length);i++)yield* combinations(i+1,[...chosen,all[i]]);
  }
  for(const combination of combinations()) {
    const own=[...combination].sort((x,y)=>x.name.localeCompare(y.name));
    if(new Set(own.map(c=>c.name)).size!==ownCount)continue;
    const upgrades=own.filter(c=>c.totsu>c.originalTotsu);
    const cost=upgrades.reduce((sum,c)=>sum+(c.totsu-c.originalTotsu)*input.itemsPerLimitBreak,0);
    if(cost>input.budget)continue;
    for(const support of supportAllowed?supports:[null]) for(const policy of new Set([a.policy,b.policy])) {
      const cards=support?[...own,support]:own;
      const id=JSON.stringify([cards.map(c=>[c.name,c.totsu,c.selectedMagic,c.support]),a.challengeIds,policy]);
      if(seen.has(id)||unique.has(id))continue;
      unique.add(id); results.push({...a,preferredPlan:undefined,id,cards,cost,policy,estimate:estimate(cards)});
    }
  }
  return results.filter(candidate => candidateIncludesRequired(input,candidate,catalog))
    .sort((a,b)=>b.estimate-a.estimate).slice(0,16);
}
