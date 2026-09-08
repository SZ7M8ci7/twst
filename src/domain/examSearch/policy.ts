import type { PolicyKind } from '@/domain/examSearch/types';

function createPairingTable(spells:readonly string[],pairValue:(a:string,b:string)=>number) {
  const index=new Map(spells.map((id,i)=>[id,i])),size=spells.length;
  const scores=spells.map(a=>spells.map(b=>pairValue(a,b)));
  const memo=new Map<string,number>();
  const best=(mask:number,pairs:number):number=>{
    if(!mask||pairs<=0)return 0;
    const key=`${mask}:${pairs}`,cached=memo.get(key);if(cached!==undefined)return cached;
    let first=0;while(!(mask&(1<<first)))first++;
    const rest=mask&~(1<<first);let value=best(rest,pairs);
    for(let other=first+1;other<size;other++)if(rest&(1<<other))
      value=Math.max(value,scores[first][other]+best(rest&~(1<<other),pairs-1));
    memo.set(key,value);return value;
  };
  return { index, best };
}

export function createPairingValue(spells:readonly string[],pairValue:(a:string,b:string)=>number) {
  const { index, best }=createPairingTable(spells,pairValue);
  return (remaining:readonly string[],pairs=Math.floor(remaining.length/2))=>{
    const mask=remaining.reduce((m,id)=>m|(1<<index.get(id)!),0),maximum=best(mask,pairs);
    return maximum;
  };
}

export function createPairSpend(spells:readonly string[],pairValue:(a:string,b:string)=>number) {
  const { index, best }=createPairingTable(spells,pairValue);
  return (remaining:readonly string[],pairs=Math.floor(remaining.length/2))=>{
    const mask=remaining.reduce((m,id)=>m|(1<<index.get(id)!),0),maximum=best(mask,pairs);
    return (pair:readonly [string,string])=>{
      const first=index.get(pair[0])!,second=index.get(pair[1])!;
      return maximum-best(mask&~(1<<first)&~(1<<second),pairs-1);
    };
  };
}

// DEFENCE normally finishes during turn five, before that turn's healing tick.
// This is a public-state planning estimate, not healing applied to a battle.
export function remainingContinuousHealing(entries:readonly {cardIndex:number;rate:number;turns:number}[],turn:number,
  cardHp:(index:number)=>number,cursed:(index:number)=>boolean):number {
  const remaining=Math.max(0,5-turn);
  return entries.reduce((sum,entry)=>sum+(cursed(entry.cardIndex)?0:
    cardHp(entry.cardIndex)*entry.rate*Math.max(0,Math.min(entry.turns,remaining))),0);
}

export interface FlexiblePlanStep {
  ids: [string,string]; earliestTurn: number; requires: string[];
}
export function chooseFlexiblePlanPair(turn:number, visible:readonly string[], used:ReadonlySet<string>, steps:readonly FlexiblePlanStep[]):[string,string]|null {
  const last=steps.length-1;
  const choices=steps.map((step,index)=>({step,index})).filter(({step,index})=>
    step.ids.every(id=>visible.includes(id)&&!used.has(id)) && step.earliestTurn<=turn
    && step.requires.every(id=>used.has(id)) && (index===last?turn>=steps.length:turn<steps.length));
  choices.sort((a,b)=>b.step.earliestTurn-a.step.earliestTurn||a.index-b.index);
  return choices[0]?.step.ids??null;
}

// Deliberately contains neither hidden cards, enemy deck nor a random generator.
export interface BattleObservation {
  turn: number;
  kind: 'BASIC' | 'DEFENCE' | 'ATTACK';
  enemyHp: number;
  playerHp: number;
  maxHp: number;
  pairs: { ids: [string, string]; damage: number; firstDamage: number; duo: number; heal: number; utility: number; defense: number; finisherUsed: boolean; setup?: number; projectedScore?: number; futureDamageSpent?:number }[];
}
export function chooseObservedPair(observation: BattleObservation, policy: PolicyKind, priorities?: [string,string][]): [string, string] | null {
  const reserve = policy === 'reserve' || policy === 'effects-reserve' || (policy==='effects-tail'||policy==='effects-score'||policy==='effects-duo')&&observation.kind==='BASIC';
  const effects = policy.startsWith('effects');
  const preserveDuos=policy==='effects-duo'&&observation.kind!=='DEFENCE';
  let best: BattleObservation['pairs'][number] | undefined, bestScore = -Infinity;
  for (const pair of observation.pairs) {
    const damage = effects && pair.firstDamage >= observation.enemyHp ? pair.firstDamage : pair.damage;
    let value = damage + pair.duo * 2200 + pair.utility * 2000;
    if(preserveDuos&&pair.futureDamageSpent!==undefined)value=damage-pair.futureDamageSpent+damage*0.001;
    if (observation.kind === 'DEFENCE') {
      value = damage * 0.35 + pair.heal * 1.5 + pair.defense * 5000 + pair.utility * 3500;
      if (policy === 'effects-score' && pair.projectedScore !== undefined) value = pair.projectedScore;
      if (observation.turn < 5 && pair.damage >= observation.enemyHp) value -= 20000;
      if (observation.turn === 5 && pair.firstDamage >= observation.enemyHp) value += 15000;
      if (reserve && observation.turn < 5 && pair.finisherUsed) value -= 100000;
    } else if (observation.kind === 'BASIC' && reserve) {
      if (observation.turn < 4 && pair.finisherUsed) value -= effects ? 100000 : 25000;
      if (observation.turn < 4 && pair.damage >= observation.enemyHp) value -= effects ? 150000 : 40000;
      if (observation.turn >= 4 && pair.damage >= observation.enemyHp) value += 20000;
    } else if (reserve) {
      value += pair.heal * Math.max(0, 1 - observation.playerHp / observation.maxHp) + pair.defense * 2500;
    }
    if (effects && observation.kind === 'ATTACK') {
      if (pair.firstDamage >= observation.enemyHp) value += 20000;
      else if (pair.damage >= observation.enemyHp) value += 10000;
      if((policy==='effects-score'||policy==='effects-duo')&&pair.projectedScore!==undefined&&pair.damage>=observation.enemyHp)
        value=1000000+pair.projectedScore;
    }
    if (effects && observation.kind === 'BASIC') value += (pair.setup ?? 0)*(reserve?8:3);
    if((policy==='effects-score'||policy==='effects-duo')&&observation.kind==='BASIC'&&observation.turn>=4&&pair.damage>=observation.enemyHp&&pair.projectedScore!==undefined)
      value=1000000+pair.projectedScore;
    if (priorities?.length) {
      // Learn when to use each spell, without requiring the training seed's
      // exact partner to appear. Only the currently visible legal pairs compete.
      for (const id of pair.ids) {
        const cycleStart=Math.floor((observation.turn-1)/5)*5;
        const inCycle=priorities.slice(cycleStart,cycleStart+5).findIndex(p=>p.includes(id));
        const inFirstCycle=priorities.slice(0,5).findIndex(p=>p.includes(id));
        const plannedTurn=cycleStart+(inCycle>=0?inCycle+1:inFirstCycle>=0?inFirstCycle+1:6);
        value -= Math.abs(plannedTurn-observation.turn)*2500;
      }
    }
    if (value > bestScore) { best = pair; bestScore = value; }
  }
  return best?.ids ?? null;
}
