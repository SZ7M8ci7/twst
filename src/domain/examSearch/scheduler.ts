import { buildTasksAsync, generateCandidatesAsync, generateNeighbors, crossCandidates, type Catalog, type GenerationTask } from '@/domain/examSearch/candidateGenerator';
import { emptySamples, MAX_ISLANDS, type BattleEngine, type MagicSlot, type Samples, type SearchInput, type SearchProgress, type SearchResult, type TaskPartition } from '@/domain/examSearch/types';
import { metrics } from '@/domain/examSearch/statistics';
import * as statistics from '@/domain/examSearch/statistics';
import { lowerCostCandidates, trainedUpgradeCandidates, jointSpellCandidates, alternatePolicyCandidates, candidateIncludesRequired } from '@/domain/examSearch/variants';
import { importanceUpperQuantile } from '@/domain/examSearch/importance';
import { diverseFinalists } from '@/domain/examSearch/finalists';

import { yieldToHost as yieldEventLoop } from '@/utils/yieldToHost';
const VALIDATION_SAMPLES = 2048;
const DISCOVERY_SAMPLES = 32;
const MAX_FINALISTS = 8;
const WIDE_DISCOVERY_SAMPLES = 8;
const WIDE_SCOUT_SAMPLES = 8;
export interface SessionCheckpoint {
  cursor: number; seen: string[]; pool: SearchResult[]; finalists: SearchResult[]; pending: SearchResult[];
  round: number; elapsed: number; trialSerial: number; nonce: string;
  evaluatedCount?: number; tasksTotal?: number;
  mutationRound?: number;
  partition?: TaskPartition;
  parallel?: { baseNonce: string; checkpoints: SessionCheckpoint[]; owners: Record<string, number> };
}
export function validateTaskPartition(partition: TaskPartition = { islandIndex: 0, islandCount: 1 }): TaskPartition {
  if (!Number.isInteger(partition.islandCount) || partition.islandCount < 1 || partition.islandCount > MAX_ISLANDS
    || !Number.isInteger(partition.islandIndex) || partition.islandIndex < 0 || partition.islandIndex >= partition.islandCount)
    throw new Error('Invalid task partition.');
  return { islandIndex: partition.islandIndex, islandCount: partition.islandCount };
}
export function usesWideInitialScreen(input: Pick<SearchInput, 'preset'>, partition: TaskPartition): boolean {
  if (input.preset.kind !== 'ATTACK' || partition.islandCount <= 1) return false;
  return partition.islandCount === 2
    ? partition.islandIndex === 1
    : partition.islandIndex % 3 === 2;
}
export function partitionGenerationTasks(tasks: readonly GenerationTask[], partition?: TaskPartition): GenerationTask[] {
  const selected = validateTaskPartition(partition);
  if (selected.islandCount === 1) return [...tasks];
  const ordinals = new Map<number, number>();
  return tasks.filter(task => {
    // Saved teams are explicit user starting points and receive trials on every
    // island; only the generated catalogue paths are partitioned.
    if (task.seedTeam) return true;
    const ordinal = ordinals.get(task.cost) ?? 0;
    ordinals.set(task.cost, ordinal + 1);
    return ordinal % selected.islandCount === selected.islandIndex;
  });
}
export function interleaveWideCostTasks(tasks: readonly GenerationTask[]): GenerationTask[] {
  const output = [...tasks];
  const groups = new Map<number, { positions: number[]; candidates: GenerationTask[] }>();
  tasks.forEach((task, index) => {
    if (task.seedTeam) return;
    const group = groups.get(task.cost) ?? { positions: [], candidates: [] };
    group.positions.push(index); group.candidates.push(task); groups.set(task.cost, group);
  });
  for (const { positions, candidates } of groups.values()) {
    const buckets = Array.from({length:4}, (_, bucket) =>
      candidates.slice(Math.floor(candidates.length*bucket/4), Math.floor(candidates.length*(bucket+1)/4)));
    const reordered: GenerationTask[] = [];
    for (let offset=0; offset<candidates.length; offset++)
      for (const bucket of buckets) if (bucket[offset]) reordered.push(bucket[offset]);
    positions.forEach((position, index) => { output[position] = reordered[index]; });
  }
  return output;
}
export function prepareGenerationTasks(input: Pick<SearchInput, 'preset'>, tasks: readonly GenerationTask[], partition: TaskPartition): GenerationTask[] {
  const partitioned=partitionGenerationTasks(tasks,partition);
  return usesWideInitialScreen(input,partition)?interleaveWideCostTasks(partitioned):partitioned;
}
export class SearchSession {
  private tasks: GenerationTask[] = [];
  private tasksReady = false;
  private knownTasksTotal = 0;
  private cursor = 0;
  private seen = new Set<string>();
  private pool: SearchResult[] = [];
  private finalists: SearchResult[] = [];
  private pending: SearchResult[] = [];
  private stopped = false;
  private round = 0;
  private elapsed = 0;
  private trialSerial = 0;
  private evaluatedCount = 0;
  private mutationRound = 0;
  private partition: TaskPartition;
  constructor(readonly input: SearchInput, private catalog: Catalog, private engine: BattleEngine, private nonce: string, checkpoint?: SessionCheckpoint, partition?: TaskPartition) {
    this.partition = validateTaskPartition(checkpoint?.partition ?? partition);
    if (checkpoint) {
      this.cursor = checkpoint.cursor; this.seen = new Set(checkpoint.seen);
      const valid = (result: SearchResult) => candidateIncludesRequired(this.input,result.candidate,this.catalog);
      this.pool = checkpoint.pool.filter(valid);
      this.finalists = checkpoint.finalists.filter(valid);
      this.pending = checkpoint.pending.filter(valid); this.round = checkpoint.round;
      this.elapsed = checkpoint.elapsed; this.trialSerial = checkpoint.trialSerial; this.nonce = checkpoint.nonce;
      this.evaluatedCount = checkpoint.evaluatedCount ?? checkpoint.pool.length;
      this.mutationRound = checkpoint.mutationRound ?? 0;
      this.knownTasksTotal = checkpoint.tasksTotal ?? 0;
    }
  }
  checkpoint(): SessionCheckpoint {
    return { cursor: this.cursor, seen: [...this.seen], pool: this.pool, finalists: this.finalists, pending: this.pending,
      round: this.round, elapsed: this.elapsed, trialSerial: this.trialSerial, nonce: this.nonce, evaluatedCount: this.evaluatedCount, tasksTotal: this.knownTasksTotal, mutationRound: this.mutationRound,
      partition: this.partition };
  }
  stop() { this.stopped = true; }
  refineValidation(candidateId: string) {
    const result=this.finalists.find(r=>r.candidate.id===candidateId);
    if(!result)throw new Error('Candidate is no longer available.');
    // A fresh fixed-size holdout confirms a candidate already chosen by the
    // user. Do not tune its cards or plan using these additional trials.
    result.validation=emptySamples();result.validationBest=undefined;
    result.validationTarget=result.validationTarget<32768?32768:131072;
    this.round++;
  }
  private quality(result: SearchResult) {
    if(this.input.target===0) {
      const auto=this.autoScoreMetrics(result.development);
      const empirical=auto.empiricalScore??0;
      const mean=(result.development.fitnessSum??result.development.scores.reduce((a,b)=>a+b,0))/Math.max(1,auto.n);
      // The empirical reachable quantile is the primary development rank.
      // Ceiling and mean only break ties; they must not let a rare maximum
      // outrank a candidate with a better ordinary reach estimate.
      return empirical+auto.max*1e-6+mean*1e-9;
    }
    const m = metrics(result.development, this.input.target, this.input.attempts);
    const mean = (result.development.fitnessSum ?? result.development.scores.reduce((a, b) => a + b, 0)) / Math.max(1, m.n);
    // A retry-oriented target can be worthwhile even with a modest average.
    // Use the observed ceiling to explore; independent validation decides reach.
    return m.reach * this.input.target + m.max + mean * 0.1;
  }
  private tailLikelihood(result:SearchResult) {
    return result.importance?.n?result.importance.successWeight/result.importance.n:0;
  }
  private upperScore(result:SearchResult) {
    return result.importance?.upperScore??0;
  }
  private autoScoreMetrics(samples: Samples) {
    return statistics.autoScoreMetrics(samples,this.input.attempts,this.input.desiredProbability);
  }
  private importanceProbability() {
    return -Math.expm1(Math.log1p(-this.input.desiredProbability) / this.input.attempts);
  }
  private weightedChampion(results:SearchResult[],target:number) {
    if(this.input.target===0)return results.filter(r=>this.upperScore(r)>0)
      .sort((a,b)=>this.upperScore(b)-this.upperScore(a))[0];
    const weighted=results.filter(r=>this.tailLikelihood(r)>0)
      .sort((a,b)=>this.tailLikelihood(b)-this.tailLikelihood(a)||this.upperScore(b)-this.upperScore(a))[0];
    if(weighted)return weighted;
    if(results.some(r=>r.development.scores.some(score=>score>=target)))return undefined;
    return results.filter(r=>this.upperScore(r)>0)
      .sort((a,b)=>this.upperScore(b)-this.upperScore(a))[0];
  }
  private async importanceScreen(result:SearchResult,deadline:number,total:number) {
    if(!this.engine.importanceTrial||this.input.preset.kind==='DEFENCE')return;
    if(!result.importance)result.importance={n:0,successWeight:0,observations:[],upperScore:0};
    else if(!result.importance.observations&&result.importance.n>0)
      result.importance={n:0,successWeight:0,observations:[],upperScore:0};
    else { result.importance.observations??=[];result.importance.upperScore??=0; }
    const importance=result.importance;
    while(importance.n<total&&!this.stopped&&performance.now()<deadline) {
      const trial=this.engine.importanceTrial(`${this.nonce}:importance-development:${this.trialSerial++}`,result.candidate.policy);
      importance.n++;
      importance.observations!.push({score:trial.score,weight:trial.weight});
      if(this.input.target>0&&trial.score>=this.input.target)importance.successWeight+=trial.weight;
      if(importance.n%8===0)await yieldEventLoop();
    }
    importance.upperScore=importanceUpperQuantile(importance.observations!,this.importanceProbability());
  }
  private async scout(result:SearchResult,deadline:number,maximumTrials=32) {
    if(!this.engine.scout||this.input.preset.kind==='DEFENCE')return;
    result.criticalScout??={attempted:0,score:0};
    const targets=this.engine.scoutTargets?.()??result.candidate.cards.map((_,i)=>i);
    const maximum=targets.length?maximumTrials:0;
    while(result.criticalScout.attempted<maximum&&!this.stopped&&performance.now()<deadline) {
      const attempt=result.criticalScout.attempted++;
      const idealHand=attempt<8;
      const targetOffset=attempt%targets.length;
      const index=targets[targetOffset];
      const cycle=Math.floor(attempt/targets.length);
      const selected=result.candidate.cards[index];
      const magic:MagicSlot|undefined=this.input.preset.kind==='BASIC'&&cycle%2===1&&selected?.selectedMagic.includes(2)?2:undefined;
      const seed=`${this.nonce}:critical-scout:${this.trialSerial++}`;
      const trial=this.engine.scout(seed,result.candidate.policy,index,idealHand,magic);
      if(trial.forcedHits>0&&trial.score>result.criticalScout.score){result.criticalScout.score=trial.score;result.criticalScout.cardIndex=index;result.criticalScout.idealHand=idealHand;result.criticalScout.seed=seed;result.criticalScout.plan=trial.plan;result.criticalScout.magic=magic;}
      // Match ordinary screening's cooperative batch size. Yielding after
      // every hypothetical battle spends most of a short screen on timers.
      if(result.criticalScout.attempted%8===0)await yieldEventLoop();
    }
  }
  private diverseParents(limit: number) {
    const sorted = [...this.pool].sort((a,b)=>this.quality(b)-this.quality(a));
    const peak=(result:SearchResult)=>result.development.scores.reduce((a,b)=>Math.max(a,b),0);
    const ceilings=[...sorted].sort((a,b)=>peak(b)-peak(a));
    const bands=[...new Set(sorted.map(r=>r.candidate.cost))].sort((a,b)=>a-b).map(cost=>{
      const best=ceilings.find(r=>r.candidate.cost===cost),quality=sorted.find(r=>r.candidate.cost===cost);
      const scout=sorted.filter(r=>r.candidate.cost===cost&&(r.criticalScout?.score??0)>0)
        .sort((a,b)=>b.criticalScout!.score-a.criticalScout!.score)[0];
      const weighted=this.weightedChampion(sorted.filter(r=>r.candidate.cost===cost),this.input.target);
      const champions=[...new Set([best,weighted,scout,quality].filter((r):r is SearchResult=>!!r))];
      const seen=new Set(champions.map(r=>JSON.stringify(r.candidate.cards.map(c=>c.name))));
      return [...champions,...sorted.filter(r=>r.candidate.cost===cost).filter(r=>{
        const key=JSON.stringify(r.candidate.cards.map(c=>c.name));
        if(seen.has(key))return false;seen.add(key);return true;
      })].slice(0,limit);
    });
    // Refinement has a small time budget. Grouping all four cost-0 parents
    // first can consume it before any cost-3 breakthrough gets a mutation.
    return Array.from({length:limit},(_,index)=>bands.flatMap(band=>band[index]?[band[index]]:[])).flat();
  }
  private closeLosses(limit:number) {
    const counts=new Map<number,number>(),seen=new Set<string>();
    const fitness=(result:SearchResult)=>(result.development.fitnessSum??0)/Math.max(1,result.development.scores.length);
    return this.pool.filter(r=>r.development.scores.length>0&&r.development.scores.every(score=>score===0)&&fitness(r)>=10000)
      .sort((a,b)=>fitness(b)-fitness(a)).filter(r=>{
        const cost=r.candidate.cost,key=JSON.stringify([cost,r.candidate.cards.map(c=>c.name)]);
        if(seen.has(key)||(counts.get(cost)??0)>=limit)return false;
        seen.add(key);counts.set(cost,(counts.get(cost)??0)+1);return true;
      });
  }
  private contenders() {
    const normal=this.diverseParents(4),losses=this.closeLosses(2);
    const costs=[...new Set(this.pool.map(r=>r.candidate.cost))].sort((a,b)=>a-b);
    return costs.flatMap(cost=>{
      const promising=normal.filter(r=>r.candidate.cost===cost),rare=losses.filter(r=>r.candidate.cost===cost);
      const chosen=[...new Set([...promising.slice(0,3),...rare,...promising])];
      return chosen.slice(0,4);
    });
  }
  private selectFinalists() {
    if(this.input.target===0){this.selectAutoFinalists();return;}
    const sorted = [...this.pool].sort((a, b) => this.quality(b) - this.quality(a));
    const costs = [...new Set(sorted.map(r => r.candidate.cost))].sort((a, b) => a - b);
    // Continue searching without discarding the strongest already evaluated
    // option in each item band. Keep its fixed holdout unchanged; it is never
    // used to learn a new plan or appended to a different candidate's samples.
    const retained=costs.flatMap(cost=>this.finalists.filter(r=>r.candidate.cost===cost&&r.validation.scores.length>=r.validationTarget)
      .sort((a,b)=>{
        const am=metrics(a.validation,this.input.target,this.input.attempts),bm=metrics(b.validation,this.input.target,this.input.attempts);
        return bm.low-am.low||bm.reach-am.reach||bm.max-am.max;
      }).slice(0,1));
    const retainedIds=new Set(retained.map(r=>r.candidate.id));
    const selected: SearchResult[] = [];
    for (const cost of costs) {
      const compositions = new Set<string>();
      const peak=(result:SearchResult)=>result.development.scores.reduce((max,score)=>Math.max(max,score),0);
      const ceiling=[...sorted].filter(r=>r.candidate.cost===cost&&!retainedIds.has(r.candidate.id)).sort((a,b)=>
        peak(b)-peak(a))[0];
      const quality=sorted.find(r=>r.candidate.cost===cost&&!retainedIds.has(r.candidate.id));
      const band=sorted.filter(r=>r.candidate.cost===cost&&!retainedIds.has(r.candidate.id));
      const weighted=this.weightedChampion(band,this.input.target);
      // A positive importance tail remains useful even when its estimated
      // upper score is below the measured development peak.  Keep the
      // positive-weight candidate as an explicit finalist slot; the old
      // unseen-tail rule is retained as the fallback when no positive tail is
      // available.
      const positiveWeighted=weighted&&this.tailLikelihood(weighted)>0?weighted:undefined;
      const forcedScout=band.filter(r=>(r.criticalScout?.score??0)>=this.input.target)
        .sort((a,b)=>b.criticalScout!.score-a.criticalScout!.score)[0];
      const measuredPeak=band.reduce((max,result)=>Math.max(max,peak(result)),0);
      const unseenTail=quality&&!this.pool.some(r=>r.candidate.cost===cost&&r.development.scores.some(score=>score>=this.input.target))
        ?weighted&&weighted!==ceiling&&this.upperScore(weighted)>=measuredPeak?weighted:forcedScout:undefined;
      // Different spells or plans on the same five cards can trade peak score
      // for reach probability. Preserve both champions before diversifying names.
      // If ordinary screening has never reached the target in this band, do
      // not require another lucky critical draw before validating its template.
      // Keep the measured peak as well; only the fresh holdout is reported.
      const hasRetained=retained.some(r=>r.candidate.cost===cost);
      const priorities=positiveWeighted
        ? (hasRetained
          ? [positiveWeighted,ceiling,unseenTail,quality]
          : [ceiling,positiveWeighted,unseenTail,quality])
        : (unseenTail&&hasRetained?[unseenTail,ceiling,quality]:[ceiling,unseenTail??quality]);
      const slots=Math.max(1,Math.floor((MAX_FINALISTS-retained.length)/costs.length));
      const bandSelected:SearchResult[]=[];
      const addPriority=(result:SearchResult|undefined)=>{
        if(!result||bandSelected.length>=slots||retainedIds.has(result.candidate.id)
          ||bandSelected.some(r=>r.candidate.id===result.candidate.id)
          ||selected.some(r=>r.candidate.id===result.candidate.id))return;
        const key=result.candidate.cards.map(c=>c.name).join('|');
        compositions.add(key);bandSelected.push(result);
      };
      const addFallback=(result:SearchResult|undefined)=>{
        if(!result||bandSelected.length>=slots||retainedIds.has(result.candidate.id)
          ||bandSelected.some(r=>r.candidate.id===result.candidate.id)
          ||selected.some(r=>r.candidate.id===result.candidate.id))return;
        const key=result.candidate.cards.map(c=>c.name).join('|');
        if(compositions.has(key))return;
        compositions.add(key);bandSelected.push(result);
      };
      priorities.forEach(result=>addPriority(result));
      for(const result of sorted) {
        if(bandSelected.length>=slots)break;
        if(result.candidate.cost===cost)addFallback(result);
      }
      selected.push(...bandSelected);
    }
    for (const r of sorted) if (selected.length < MAX_FINALISTS-retained.length && !retainedIds.has(r.candidate.id)
      && !selected.some(selectedResult=>selectedResult.candidate.id===r.candidate.id)) selected.push(r);
    // Every newly selected candidate gets a fresh, independent fixed batch.
    this.finalists = [...retained,...selected.slice(0, MAX_FINALISTS-retained.length).map(r => ({ ...r, validation: emptySamples(), validationBest: undefined, validationTarget: VALIDATION_SAMPLES }))];
    this.round++;
  }
  private selectAutoFinalists() {
    const qualityCache=new Map<SearchResult,number>();
    const qualityOf=(result:SearchResult)=>{
      const cached=qualityCache.get(result);if(cached!==undefined)return cached;
      const value=this.quality(result);qualityCache.set(result,value);return value;
    };
    const sorted=[...this.pool].sort((a,b)=>qualityOf(b)-qualityOf(a));
    const costs=[...new Set([...sorted,...this.finalists].map(r=>r.candidate.cost))].sort((a,b)=>a-b);
    type AutoMetrics={n:number;retired:number;empiricalScore:number|null;conservativeScore:number|null;max:number};
    const scoreCache=new Map<SearchResult,AutoMetrics>();
    const scoreOf=(result:SearchResult):AutoMetrics=>{
      const cached=scoreCache.get(result);if(cached)return cached;
      const value=this.autoScoreMetrics(result.validation);scoreCache.set(result,value);return value;
    };
    const retained=costs.flatMap(cost=>this.finalists.filter(r=>r.candidate.cost===cost&&r.validation.scores.length>=r.validationTarget)
      .sort((a,b)=>{
        const am=scoreOf(a),bm=scoreOf(b);
        const conservative=(value:number|null)=>value===null?-1:value;
        return conservative(bm.conservativeScore)-conservative(am.conservativeScore)
          ||conservative(bm.empiricalScore)-conservative(am.empiricalScore)||bm.max-am.max;
      }).slice(0,1));
    const retainedIds=new Set(retained.map(r=>r.candidate.id)),selected:SearchResult[]=[];
    for(const cost of costs){
      const band=sorted.filter(r=>r.candidate.cost===cost&&!retainedIds.has(r.candidate.id));
      const empirical=band[0],weighted=this.weightedChampion(band,0);
      const scout=band.filter(r=>(r.criticalScout?.score??0)>0).sort((a,b)=>b.criticalScout!.score-a.criticalScout!.score)[0];
      const peak=[...band].sort((a,b)=>{
        const am=a.development.scores.reduce((x,y)=>Math.max(x,y),0),bm=b.development.scores.reduce((x,y)=>Math.max(x,y),0);return bm-am;
      })[0];
      const stable=band.map(result=>({result,value:statistics.expectedBestScore(result.development,this.input.attempts)}))
        .sort((a,b)=>b.value-a.value)[0]?.result;
      const slots=Math.max(1,Math.floor((MAX_FINALISTS-retained.length)/Math.max(1,costs.length)));
      // Cost bands with one slot rotate their champion role across islands and
      // continuation rounds. This keeps one island empirical-first while the
      // others get a chance to validate the weighted tail and scout signals.
      const role=(this.partition.islandIndex+this.round)%3;
      const champions=role===0?[empirical,weighted,scout,peak]
        :role===1?[weighted,empirical,scout,peak]
        :[scout,weighted,empirical,peak];
      // Protect the explicit champion roles before diversifying spare slots.
      // A scout or weighted winner may be a useful spell/plan of the same team.
      const priority=[...new Set([...champions,stable].filter((result):result is SearchResult=>!!result))].slice(0,slots);
      const bandSelected=[...priority,...diverseFinalists(band,slots-priority.length,
        [...retained,...selected,...priority].filter(result=>result.candidate.cost===cost))];
      selected.push(...bandSelected);
    }
    for(const result of sorted)if(selected.length<MAX_FINALISTS-retained.length&&!retainedIds.has(result.candidate.id)&&!selected.some(r=>r.candidate.id===result.candidate.id))selected.push(result);
    this.finalists=[...retained,...selected.slice(0,MAX_FINALISTS-retained.length).map(r=>({...r,validation:emptySamples(),validationBest:undefined,validationTarget:VALIDATION_SAMPLES}))];
    this.round++;
  }
  async run(durationMs: number, publish: (progress: SearchProgress) => void) {
    this.stopped = false;
    const wideInitialScreen = usesWideInitialScreen(this.input, this.partition);
    const discoverySamples = wideInitialScreen ? WIDE_DISCOVERY_SAMPLES : DISCOVERY_SAMPLES;
    const discoveryScoutSamples = wideInitialScreen ? WIDE_SCOUT_SAMPLES : DISCOVERY_SAMPLES;
    const start = performance.now(), deadline = start + durationMs, discoveryEnd = start + durationMs * 0.48;
    const loadoutDeadline = start + durationMs * 0.55;
    const contenderDeadline = start + durationMs * 0.65;
    const planDeadline = start + durationMs * 0.7;
    const report = (phase: SearchProgress['phase']) => publish({ phase, generated: this.seen.size,
      evaluated: this.evaluatedCount, tasksDone: this.cursor, tasksTotal: this.knownTasksTotal,
      elapsedMs: this.elapsed + performance.now() - start, results: this.finalists });
    let lastReport = 0;
    const progress = async (phase: SearchProgress['phase']) => {
      if (performance.now() - lastReport > 150) { report(phase); lastReport = performance.now(); }
      await yieldEventLoop();
    };
    // Finish interrupted validation before changing the selection.
    const unfinished = this.finalists.some(r => r.validation.scores.length < r.validationTarget);
    if (!unfinished) {
      if(!this.tasksReady) {
        report('generate');
        const tasks=await buildTasksAsync(this.input,this.catalog,()=>this.stopped||performance.now()>=discoveryEnd);
        if(tasks){
          this.tasks=prepareGenerationTasks(this.input,tasks,this.partition);
          this.tasksReady=true;this.knownTasksTotal=this.tasks.length;
        }
      }
      let emptyMutations = 0;
      while (!this.stopped && performance.now() < discoveryEnd && (this.pending.length || this.cursor < this.tasks.length || this.pool.length)) {
        if (!this.pending.length) {
          const stop = () => this.stopped || performance.now() >= discoveryEnd;
          let candidates;
          // Refine actual promising teams while the larger catalogue is still
          // being scanned. Otherwise a full collection never reaches refinement.
          const refineNow = this.pool.length > 0 && this.cursor >= (this.mutationRound + 1) * 8;
          if (this.cursor < this.tasks.length && !refineNow) {
            candidates = await generateCandidatesAsync(this.input, this.tasks[this.cursor], this.catalog, stop);
            if (candidates) this.cursor++;
          } else {
            const parents = this.diverseParents(4);
            const parent = parents[this.mutationRound++ % parents.length];
            candidates = await generateNeighbors(this.input, parent.candidate, this.catalog, this.seen, stop);
            const partner=parents.find(r=>r!==parent && r.candidate.cost===parent.candidate.cost) ?? parents.find(r=>r!==parent);
            if(partner && !stop()) candidates.push(...crossCandidates(this.input,parent.candidate,partner.candidate,this.catalog,this.seen));
            if (!candidates.length && ++emptyMutations >= parents.length && this.cursor >= this.tasks.length) break;
            if (candidates.length) emptyMutations = 0;
          }
          if (!candidates) break;
          for (const candidate of candidates) if (candidateIncludesRequired(this.input,candidate,this.catalog) && !this.seen.has(candidate.id)) {
            this.seen.add(candidate.id);
            this.pending.push({ candidate, development: emptySamples(), validation: emptySamples(), validationTarget: VALIDATION_SAMPLES });
          }
        }
        const result = this.pending[0];
        if (!result) { await progress('generate'); continue; }
        await this.engine.prepare(this.input, result.candidate);
        await this.scout(result,discoveryEnd,discoveryScoutSamples);
        await this.importanceScreen(result,discoveryEnd,16);
        while (result.development.scores.length < discoverySamples && !this.stopped && performance.now() < discoveryEnd) {
          const seed=`${this.nonce}:development:${this.trialSerial++}`;
          const trial = this.engine.trial(seed, result.candidate.policy);
          if(!result.developmentBest||trial.score>result.developmentBest.score)result.developmentBest={seed,score:trial.score};
          result.development.scores.push(trial.score);
          result.development.fitnessSum = (result.development.fitnessSum ?? 0) + (trial.fitness ?? trial.score);
          result.development.retired += Number(trial.retired);
          result.development.turns += trial.finishTurn;
          if (result.development.scores.length % 8 === 0) await progress('generate');
        }
        if (result.development.scores.length >= discoverySamples) {
          this.pool.push(result); this.pending.shift(); this.evaluatedCount++;
          // Bound memory, retaining candidates separately in each resource band.
          if (this.pool.length > 240) {
            const rare=this.closeLosses(4);
            const ceilings=this.diverseParents(3);
            const sorted = this.pool.sort((a, b) => this.quality(b) - this.quality(a));
            const kept = new Map<number, number>(), compositions = new Map<string,number>();
            this.pool = sorted.filter(r => {
              const c=r.candidate.cost,n=kept.get(c)??0,key=JSON.stringify([c,r.candidate.cards.map(card=>card.name)]), count=compositions.get(key)??0;
              if(n>=24||count>=2) return false;
              kept.set(c,n+1); compositions.set(key,count+1); return true;
            });
            this.pool=[...new Set([...this.pool,...rare,...ceilings])];
          }
        }
        await progress('generate');
      }
      // Cross multiple spell substitutions on measured compositions. A bounded
      // round-robin gives each cost band time before deeper contender trials.
      const loadouts=this.diverseParents(2).map(parent=>[...alternatePolicyCandidates(this.input,parent.candidate),
        ...jointSpellCandidates(this.input,parent.candidate,this.catalog)]
        .filter(candidate=>candidateIncludesRequired(this.input,candidate,this.catalog)&&!this.seen.has(candidate.id)));
      for(let index=0;index<249;index++)for(const options of loadouts) {
        if(this.stopped||performance.now()>=loadoutDeadline)break;
        const candidate=options[index];if(!candidate||this.seen.has(candidate.id))continue;
        const result:SearchResult={candidate,development:emptySamples(),validation:emptySamples(),validationTarget:VALIDATION_SAMPLES};
        await this.engine.prepare(this.input,candidate);
        await this.scout(result,loadoutDeadline,8);
        await this.importanceScreen(result,loadoutDeadline,16);
        for(let i=0;i<16&&!this.stopped&&performance.now()<loadoutDeadline;i++) {
          const seed=`${this.nonce}:development:${this.trialSerial++}`;
          const trial=this.engine.trial(seed,candidate.policy);
          if(!result.developmentBest||trial.score>result.developmentBest.score)result.developmentBest={seed,score:trial.score};
          result.development.scores.push(trial.score);
          result.development.fitnessSum=(result.development.fitnessSum??0)+(trial.fitness??trial.score);
          result.development.retired+=Number(trial.retired);result.development.turns+=trial.finishTurn;
          if(i%8===0)await progress('generate');
        }
        if(result.development.scores.length){this.pool.push(result);this.seen.add(candidate.id);this.evaluatedCount++;}
      }
      // Rare successful draws are easily missed by the short ordinary screen.
      // Give promising compositions in every resource band equal extra batches
      // before fitting plans. These remain development data, never holdout data.
      const contenders = this.contenders();
      for (let batch=0;batch<(wideInitialScreen?16:15);batch++) for (const result of contenders) {
        if(this.stopped || performance.now()>=contenderDeadline) break;
        if(result.development.scores.length>=512) continue;
        await this.engine.prepare(this.input,result.candidate);
        if (wideInitialScreen) await this.scout(result,contenderDeadline,32);
        await this.importanceScreen(result,contenderDeadline,Math.min(512,(result.importance?.n??0)+32));
        for(let i=0;i<32 && result.development.scores.length<512 && !this.stopped && performance.now()<contenderDeadline;i++) {
          const seed=`${this.nonce}:development:${this.trialSerial++}`;
          const trial=this.engine.trial(seed,result.candidate.policy);
          if(!result.developmentBest || trial.score>result.developmentBest.score)result.developmentBest={seed,score:trial.score};
          result.development.scores.push(trial.score);
          result.development.fitnessSum=(result.development.fitnessSum??0)+(trial.fitness??trial.score);
          result.development.retired+=Number(trial.retired);
          result.development.turns+=trial.finishTurn;
          if(i%8===0)await progress('generate');
        }
      }
      // Fit a small number of explicit plans on development seeds. At runtime a
      // plan only chooses a pair if both cards are visible; otherwise the public
      // observation policy takes over. Holdout trials never optimize their seed.
      if (this.engine.learnPlan && !this.stopped) {
        const parents = this.diverseParents(3).slice(0,12);
        for (let planRound=0;planRound<3;planRound++) for (const parent of parents) {
          if (this.stopped || performance.now() >= planDeadline) break;
          await this.engine.prepare(this.input,parent.candidate);
          let plan;
          if(planRound===0&&(parent.criticalScout?.score??0)>(parent.developmentBest?.score??0))plan=parent.criticalScout?.plan;
          // Keep the observed plan first, then optimize a template without a
          // particular hand draw. Only ordinary trials below can rank it.
          if(planRound===1&&parent.criticalScout?.cardIndex!==undefined&&this.engine.learnCriticalPlan)
            plan=await this.engine.learnCriticalPlan(parent.criticalScout.seed??`${this.nonce}:ideal-critical-plan-development:${this.trialSerial++}`,250,parent.criticalScout.cardIndex,true,parent.criticalScout.magic);
          if(!plan&&planRound<=1&&parent.developmentBest&&parent.developmentBest.score>0) {
            const observed=this.engine.trial(parent.developmentBest.seed,parent.candidate.policy,true);
            if(observed.score!==parent.developmentBest.score)throw new Error('Development trial replay mismatch');
            plan=observed.plan;
          }
          // An observed successful development run is often a better starting
          // point than an unrelated draw. It is never a validation/audit seed.
          if(!plan&&planRound===2&&parent.criticalScout?.cardIndex!==undefined&&this.engine.learnCriticalPlan)
            plan=await this.engine.learnCriticalPlan(`${this.nonce}:critical-plan-development:${this.trialSerial++}`,250,parent.criticalScout.cardIndex,false,parent.criticalScout.magic);
          plan??=await this.engine.learnPlan(`${this.nonce}:plan-development:${this.trialSerial++}`, 250);
          if (!plan || this.stopped) continue;
          const planModes=this.input.preset.kind==='BASIC'?['flexible','turn','priority'] as const:['turn','priority'] as const;
          for (const preferredPlanMode of planModes) {
          const candidate = { ...parent.candidate, preferredPlan: plan, preferredPlanMode,
            id: JSON.stringify([parent.candidate.cards.map(c=>[c.name,c.totsu,c.selectedMagic,c.support]),parent.candidate.challengeIds,parent.candidate.policy,plan,preferredPlanMode]) };
          if (this.seen.has(candidate.id)) continue;
          const result: SearchResult = { candidate, development: emptySamples(), validation: emptySamples(), validationTarget: VALIDATION_SAMPLES };
          await this.engine.prepare(this.input,candidate);
          await this.scout(result,planDeadline,8);
          await this.importanceScreen(result,planDeadline,32);
          for (let i=0;i<64 && !this.stopped && performance.now()<planDeadline;i++) {
            const seed=`${this.nonce}:development:${this.trialSerial++}`;
            const trial = this.engine.trial(seed,candidate.policy);
            if(!result.developmentBest||trial.score>result.developmentBest.score)result.developmentBest={seed,score:trial.score};
            result.development.scores.push(trial.score);
            result.development.fitnessSum = (result.development.fitnessSum ?? 0) + (trial.fitness ?? trial.score);
            result.development.retired += Number(trial.retired);
            result.development.turns += trial.finishTurn;
            if (i % 8 === 0) await progress('generate');
          }
          if (result.development.scores.length === 64) { this.pool.push(result); this.seen.add(candidate.id); this.evaluatedCount++; }
          }
        }
      }
      // Check whether each promising upgraded team can work with fewer items,
      // including the same learned instructions when its spells remain legal.
      const plannedParents=[...this.pool].filter(r=>r.candidate.preferredPlan?.length)
        .sort((a,b)=>this.quality(b)-this.quality(a));
      const plannedCosts=new Set<number>();
      const trainingParents=[...new Set([...this.diverseParents(1),...plannedParents.filter(r=>{
        if(plannedCosts.has(r.candidate.cost))return false;plannedCosts.add(r.candidate.cost);return true;
      })])];
      for(const parent of trainingParents)for(const candidate of [
        ...lowerCostCandidates(this.input,parent.candidate,this.catalog),
        ...trainedUpgradeCandidates(this.input,parent.candidate,this.catalog),
      ]) {
        if (!candidateIncludesRequired(this.input,candidate,this.catalog)) continue;
        if(this.stopped||performance.now()>=deadline-durationMs*0.25)break;
        if(this.seen.has(candidate.id))continue;
        const result:SearchResult={candidate,development:emptySamples(),validation:emptySamples(),validationTarget:VALIDATION_SAMPLES};
        await this.engine.prepare(this.input,candidate);
        await this.scout(result,deadline-durationMs*0.25,8);
        await this.importanceScreen(result,deadline-durationMs*0.25,32);
        for(let i=0;i<64&&!this.stopped&&performance.now()<deadline-durationMs*0.25;i++) {
          const seed=`${this.nonce}:development:${this.trialSerial++}`;
          const trial=this.engine.trial(seed,candidate.policy);
          if(!result.developmentBest||trial.score>result.developmentBest.score)result.developmentBest={seed,score:trial.score};
          result.development.scores.push(trial.score);
          result.development.fitnessSum=(result.development.fitnessSum??0)+(trial.fitness??trial.score);
          result.development.retired+=Number(trial.retired);result.development.turns+=trial.finishTurn;
          if(i%8===0)await progress('generate');
        }
        if(result.development.scores.length===64){this.pool.push(result);this.seen.add(candidate.id);this.evaluatedCount++;}
      }
      this.selectFinalists();
    }
    // Reuse prepared deck/runtime caches for 64 trials, but keep the same
    // 16-trial cooperative boundary for cancellation and progress messages.
    // Bounded round-robin batches still share holdout time across candidates.
    while (!this.stopped && performance.now() < deadline && this.finalists.some(r => r.validation.scores.length < r.validationTarget)) {
      for (const result of this.finalists) {
        if (this.stopped || performance.now() >= deadline) break;
        if (result.validation.scores.length >= result.validationTarget) continue;
        await this.engine.prepare(this.input, result.candidate);
        let batchTrials=0;
        for (let i = 0; i < 64 && result.validation.scores.length < result.validationTarget; i++) {
          if (this.stopped || performance.now() >= deadline) break;
          const seed = `${this.nonce}:validation:${this.round}:${result.candidate.id}:${result.validation.scores.length}`;
          const trial = this.engine.trial(seed, result.candidate.policy);
          if (!result.validationBest || trial.score > result.validationBest.score) result.validationBest = {seed,score:trial.score};
          result.validation.scores.push(trial.score);
          result.validation.retired += Number(trial.retired);
          result.validation.turns += trial.finishTurn;
          batchTrials++;
          if(batchTrials%16===0)await progress('validate');
        }
        if(batchTrials%16!==0)await progress('validate');
      }
    }
    report(this.stopped ? 'stopped' : 'done');
    this.elapsed += performance.now() - start;
  }
}
