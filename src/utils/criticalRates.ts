// Shared by the battle engine and candidate-ordering estimates.
export const criticalRatePowerScale: Record<string, number> = {
  極小: 10, 小: 19.1, 中: 33.3, 大: 50, 極大: 100,
};

// Exploration only. Both Bernoulli outcomes retain positive proposal mass;
// multiplying these ratios along an adaptive battle restores its true law.
export function criticalProposal(chance:number) {
  const probability=Math.max(0,Math.min(1,chance));
  const proposal=probability>0&&probability<0.5?0.5:probability;
  return {proposal,weight:(critical:boolean)=>critical
    ?(proposal===0?1:probability/proposal)
    :(proposal===1?1:(1-probability)/(1-proposal))};
}

// An action-selection heuristic only: find a critical-hit count whose binomial
// upper tail meets the requested per-attempt probability. Actual battle rolls
// and independently measured success probabilities remain unchanged.
export function criticalTailMultiplier(chance:number,hits:number,minimumProbability:number,multiplier=1.25):number {
  const n=Math.max(1,Math.min(3,Math.round(hits))),p=Math.max(0,Math.min(1,chance));
  const threshold=Math.max(Number.EPSILON,Math.min(1,minimumProbability));
  let tail=0;
  for(let k=n;k>=0;k--) {
    let combinations=1;
    for(let j=1;j<=k;j++)combinations*= (n-j+1)/j;
    tail+=combinations*p**k*(1-p)**(n-k);
    if(tail>=threshold)return 1+(multiplier-1)*k/n;
  }
  return 1;
}
