import { criticalTailMultiplier } from '@/utils/criticalRates';

export const evasionRateByPower:Record<string,number>={極小:9.2,小:14.8,中:23.7,大:38,極大:61};

// Optimistic candidate ordering, never a reported battle success probability.
// Normalize DF points by the contribution of one initial HP (.1275 + .0625).
// Dodging also loses any points that taking an advantageous hit would award.
export function defenceEvasionValue(equalDamage:number,matchup:number,hits:number,chance:number,minimumProbability:number):number {
  const fraction=criticalTailMultiplier(chance,hits,minimumProbability,2)-1;
  const received=matchup===1.5?.5:matchup===.5?1.5:1;
  const damagePoints=.1275-(matchup===1.5?2*.05208:matchup===.5?-.05208/1.5:0);
  return fraction*(Math.max(0,equalDamage)*received*damagePoints+600*hits)/(.1275+.0625);
}
