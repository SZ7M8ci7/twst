import { emptySamples, type AutoScoreMetrics, type SearchResult, type Samples, type SearchProgress, type ScoreDistribution, type ScoreMetrics } from '@/domain/examSearch/types';

export function reachProbability(p: number, attempts: number): number {
  return p >= 1 ? 1 : -Math.expm1(attempts * Math.log1p(-Math.max(0, p)));
}
// Fixed validation batches use z=3.5 as a conservative reference for up to 48
// concurrently selected island finalists under the ordinary fixed-family
// approximation. A later continuation can reselect from prior development
// results, so this is not an unconditional simultaneous-coverage guarantee
// across repeated search passes; the 95% figure remains the normal-approximation
// union-bound reference.
export function interval(successes: number, n: number, z = 3.5): [number, number] {
  if (!n) return [0, 1];
  const p = successes / n, z2 = z * z, denominator = 1 + z2 / n;
  const middle = (p + z2 / (2 * n)) / denominator;
  const half = z * Math.sqrt(p * (1 - p) / n + z2 / (4 * n * n)) / denominator;
  return [Math.max(0, middle - half), Math.min(1, middle + half)];
}
export function metrics(samples: Samples, target: number, attempts: number):ScoreMetrics {
  const n = samples.scores.length;
  const successes = samples.scores.filter(s => s >= target).length;
  const [low, high] = interval(successes, n);
  return { n, successes, p: n ? successes / n : 0, reach: reachProbability(n ? successes / n : 0, attempts),
    low: reachProbability(low, attempts), high: reachProbability(high, attempts),
    max: samples.scores.reduce((a, b) => Math.max(a, b), 0) };
}
function normalizedScore(score:number):number {
  return Number.isFinite(score)&&score>0?score:0;
}
/** Expected best of repeated draws from the ordinary empirical distribution. */
export function expectedBestScore(samples: Samples, attempts: number): number {
  if (!samples.scores.length || !Number.isInteger(attempts) || attempts < 1) return 0;
  const sorted = samples.scores.map(normalizedScore).sort((a,b)=>a-b), n = sorted.length;
  return sorted.reduce((sum,score,index)=>sum+score*
    (Math.pow((index+1)/n,attempts)-Math.pow(index/n,attempts)),0);
}
export function scoreDistribution(samples: Samples):ScoreDistribution {
  const scores=samples.scores.map(normalizedScore);
  if(!scores.length)return {n:0,max:0,p95:null};
  const sorted=[...scores].sort((a,b)=>a-b);
  return {n:scores.length,max:scores.reduce((best,score)=>Math.max(best,score),0),p95:sorted[Math.ceil(sorted.length*.95)-1]};
}
/**
 * Estimate the positive score reachable at least once in `attempts` ordinary
 * trials.  The conservative value is an approximate Wilson-lower-bound
 * inversion; it is a screening reference rather than a post-selection CI.
 */
export function autoScoreMetrics(samples: Samples, attempts: number, desired: number, z = 3.5): AutoScoreMetrics {
  // Every ordinary trial remains in the denominator. Invalid or non-positive
  // scores are failed positive-score trials rather than silently discarded.
  const scores=samples.scores.map(score=>Number.isFinite(score)&&score>0?score:0);
  const n=samples.scores.length;
  const max=scores.reduce((best,score)=>Math.max(best,score),0);
  let empiricalScore:number|null=null, conservativeScore:number|null=null;
  if(n && Number.isInteger(attempts) && attempts>0 && Number.isFinite(desired) && desired>0 && desired<1 && Number.isFinite(z) && z>0) {
    const positive=scores.filter(score=>score>0).sort((a,b)=>b-a);
    let index=0, successes=0;
    while(index<positive.length) {
      const threshold=positive[index];
      do index++; while(index<positive.length && positive[index]===threshold);
      successes=index;
      const p=successes/n;
      if(empiricalScore===null && reachProbability(p,attempts)>=desired) empiricalScore=threshold;
      const lower=interval(successes,n,z)[0];
      if(conservativeScore===null && reachProbability(lower,attempts)>=desired) conservativeScore=threshold;
      if(empiricalScore!==null && conservativeScore!==null) break;
    }
  }
  return {n,retired:Number.isFinite(samples.retired)?samples.retired:0,empiricalScore,conservativeScore,max};
}
export function resultMetrics(result:SearchResult,target:number,attempts:number):ScoreMetrics {
  const summary=result.validationSummary;
  return summary?.target===target&&summary.attempts===attempts?summary.metrics:metrics(result.validation,target,attempts);
}
export function resultAutoScore(result:SearchResult, attempts:number, desired:number):AutoScoreMetrics {
  const cached=result.validationSummary?.auto;
  if(cached && cached.attempts===attempts && cached.desiredProbability===desired) return cached.metrics;
  return autoScoreMetrics(result.validation,attempts,desired);
}
export function resultScoreDistribution(result:SearchResult):ScoreDistribution {
  if(result.validation.scores.length)return scoreDistribution(result.validation);
  const cached=result.validationSummary?.scoreDistribution;
  if(cached)return cached;
  const legacy=result.validationSummary?.metrics;
  if(legacy)return {n:legacy.n,max:normalizedScore(legacy.max),p95:null};
  return scoreDistribution(result.validation);
}
export function displayProgress(progress:SearchProgress,target:number,attempts:number,desiredProbability=0.05):SearchProgress {
  return {...progress,results:progress.results.map(result=>{
    const auto=target===0?autoScoreMetrics(result.validation,attempts,desiredProbability):undefined;
    const scoreDistribution=resultScoreDistribution(result);
    return {candidate:result.candidate,development:emptySamples(),validation:{...result.validation,scores:[]},validationTarget:result.validationTarget,
      validationBest:result.validationBest,validationSummary:{target,attempts,scoreDistribution,metrics:auto?{n:auto.n,successes:0,p:0,reach:0,low:0,high:0,max:auto.max}:metrics(result.validation,target,attempts),
        ...(auto?{auto:{attempts,desiredProbability,metrics:auto}}:{})}};
  })};
}
function compareNullableDescending(a:number|null,b:number|null):number {
  if(a===null)return b===null?0:1;
  if(b===null)return -1;
  return b-a;
}
function compareAutoMetricValues(am:AutoScoreMetrics,bm:AutoScoreMetrics,a:SearchResult,b:SearchResult):number {
  const ah=am.conservativeScore!==null||am.empiricalScore!==null, bh=bm.conservativeScore!==null||bm.empiricalScore!==null;
  return Number(bh)-Number(ah)
    || Number(bm.n>=b.validationTarget)-Number(am.n>=a.validationTarget)
    || compareNullableDescending(am.conservativeScore,bm.conservativeScore)
    || compareNullableDescending(am.empiricalScore,bm.empiricalScore)
    || bm.max-am.max;
}
export function compareAutoResults(a:SearchResult,b:SearchResult,attempts:number,desired:number):number {
  const am=resultAutoScore(a,attempts,desired),bm=resultAutoScore(b,attempts,desired);
  return compareAutoMetricValues(am,bm,a,b);
}
export function rankedResults(results: SearchResult[], target: number, attempts: number, desired: number): SearchResult[] {
  if(target===0) return results.map(result=>({result,metrics:resultAutoScore(result,attempts,desired)}))
    .sort((a,b)=>a.result.candidate.cost-b.result.candidate.cost||compareAutoMetricValues(a.metrics,b.metrics,a.result,b.result))
    .map(row=>row.result);
  return [...results].sort((a, b) => {
    const am = resultMetrics(a, target, attempts), bm = resultMetrics(b, target, attempts);
    const ac = am.n >= a.validationTarget && am.low >= desired;
    const bc = bm.n >= b.validationTarget && bm.low >= desired;
    // Always retain the no-upgrade baseline; cost is primary, never a tiny max-score gain.
    return Number(b.candidate.cost === 0) - Number(a.candidate.cost === 0)
      || Number(bc) - Number(ac) || a.candidate.cost - b.candidate.cost || bm.reach - am.reach || bm.max - am.max;
  });
}

export function compactResults(results: SearchResult[], target:number, attempts:number, desired:number):SearchResult[] {
  if(target===0) {
    const rows=results.map(result=>({result,metrics:resultAutoScore(result,attempts,desired)}));
    return [...new Set(rows.map(r=>r.result.candidate.cost))].sort((a,b)=>a-b).map(cost=>
      rows.filter(row=>row.result.candidate.cost===cost).sort((a,b)=>compareAutoMetricValues(a.metrics,b.metrics,a.result,b.result))[0].result);
  }
  const rows=results.map(result=>({result,metrics:resultMetrics(result,target,attempts)}));
  return [...new Set(rows.map(r=>r.result.candidate.cost))].sort((a,b)=>a-b).map(cost=>
    rows.filter(r=>r.result.candidate.cost===cost).sort((a,b)=>{
      const qualified=(r:typeof a)=>r.metrics.n>=r.result.validationTarget&&r.metrics.low>=desired;
      // Maximize the critical ceiling among teams satisfying the user's reach
      // condition. If none is confirmed, still expose the highest observed one.
      return Number(qualified(b))-Number(qualified(a))||b.metrics.max-a.metrics.max||b.metrics.reach-a.metrics.reach;
    })[0].result);
}
