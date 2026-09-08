import type { RosterCard, SearchInput, SearchCard, Candidate, PolicyKind } from '@/domain/examSearch/types';
import { isM3Unlocked } from '@/utils/totsu';

export function examUsesSupport(preset: SearchInput['preset']): boolean {
  return preset.title.includes('統一') || (preset.specialChallenges?.length??0)>0;
}

/**
 * Return the support assignments that can satisfy the card identity constraint.
 * An undefined entry means that all required cards stay in owned slots.  A
 * required card may also be borrowed when the unified exam offers it; this is
 * why assignments are enumerated rather than inferring a role from ownership.
 */
export function requiredCardSupportAssignments(input: SearchInput): (string | undefined)[] {
  const required = [...new Set(input.requiredCards ?? [])];
  if (!required.length || !examUsesSupport(input.preset)) return [undefined];
  const owned = new Set(input.roster.map(card => card.name));
  const supportNames = new Set(input.supports.map(card => card.name));
  const supportOnly = required.filter(name => !owned.has(name));
  if (supportOnly.length) return [supportOnly[0]];
  const eligible = required.filter(name => supportNames.has(name));
  // Five required identities cannot all occupy four owned slots. Validation
  // guarantees this list is non-empty for the five-card case.
  if (required.length >= 5) return eligible.length ? eligible : [undefined];
  return [undefined, ...eligible];
}

export function requiredOwnedNames(input: SearchInput, supportName?: string): string[] {
  return [...new Set(input.requiredCards ?? [])].filter(name => name !== supportName);
}

export function candidateIncludesRequired(input: SearchInput, candidate: Pick<Candidate, 'cards'>,
  catalog?: Record<string, { chara?: string }>): boolean {
  if (!input.requiredCards?.length && !input.requiredCharacters?.length) return true;
  const cards = new Set(candidate.cards.map(card => card.name));
  if (input.requiredCards?.length && ![...new Set(input.requiredCards)].every(name => cards.has(name))) return false;
  if (input.requiredCharacters?.length) {
    if (!catalog) return false;
    const characters = new Set(candidate.cards.map(card => catalog[card.name]?.chara).filter((name): name is string => !!name));
    if (![...new Set(input.requiredCharacters)].every(name => characters.has(name))) return false;
  }
  return true;
}

export function challengeVariants(input: Pick<SearchInput, 'preset' | 'challengeLocks' | 'maxRemoved'>): string[][] {
  if (!input.preset.specialChallenges?.length) return [[]];
  const base = (input.preset.specialChallenges ?? []).filter(c => input.challengeLocks[c.id] !== 'off').map(c => c.id);
  if (!base.length) return [];
  const removable = base.filter(id => input.challengeLocks[id] !== 'on');
  const results = [base];
  for (let i = 0; i < removable.length; i++) {
    const one = base.filter(id => id !== removable[i]);
    if (one.length) results.push(one);
    if (input.maxRemoved === 2) for (let j = i + 1; j < removable.length; j++) {
      const two = one.filter(id => id !== removable[j]);
      if (two.length) results.push(two);
    }
  }
  return results;
}

export function cardVariants(card: RosterCard, rare: string, support = false, targetTotsu = card.totsu): SearchCard[] {
  const pairs: [1 | 2 | 3, 1 | 2 | 3][] = isM3Unlocked(rare, targetTotsu) ? [[1, 2], [1, 3], [2, 3]] : [[1, 2]];
  const level=support?card.level:Math.min(120,card.level+Math.max(0,targetTotsu-card.totsu)*5);
  return pairs.map(selectedMagic => ({ ...card, level, magicLevels: [...card.magicLevels], buddyLevels: [...card.buddyLevels],
    totsu: targetTotsu, originalTotsu: card.totsu, selectedMagic, support }));
}

export function upgradeTargets(card: RosterCard, rare: string, budget: number, itemCost: number): number[] {
  if (rare !== 'SSR' || !card.allowUpgrade) return [];
  return [1, 2, 3, 4].filter(t => t > card.totsu && (t - card.totsu) * itemCost <= budget);
}

export function searchCardVariants(card: RosterCard, rare: string, support = false, targetTotsu = card.totsu): SearchCard[] {
  return cardVariants(card,rare,support,targetTotsu);
}

// At most 3^5 loadouts. Include single substitutions too: the separate
// composition refinement may not have visited this parent within the time limit.
// Training, cost and names are fixed.
export function jointSpellCandidates(input: SearchInput, parent: Candidate, catalog: Record<string,{rare:string}>): Candidate[] {
  let teams: SearchCard[][] = [[]];
  for (const card of parent.cards) {
    const original=(card.support?input.supports:input.roster).find(c=>c.name===card.name);
    if(!original)return [];
    const options=searchCardVariants(original,catalog[card.name].rare,card.support,card.totsu);
    teams=teams.flatMap(team=>options.map(option=>[...team,option]));
  }
  const hash=(value:string)=>{let h=2166136261;for(let i=0;i<value.length;i++)h=Math.imul(h^value.charCodeAt(i),16777619);return h>>>0;};
  return teams.filter(cards=>cards.some((c,i)=>c.selectedMagic.join(',')!==parent.cards[i].selectedMagic.join(',')))
    .map(cards=>({...parent,cards,preferredPlan:undefined,preferredPlanMode:undefined,
      id:JSON.stringify([cards.map(c=>[c.name,c.totsu,c.selectedMagic,c.support]),parent.challengeIds,parent.policy])}))
    .map(candidate=>({candidate,order:hash(candidate.id)})).sort((a,b)=>a.order-b.order).map(row=>row.candidate);
}

export function alternatePolicyCandidates(input: SearchInput, parent: Candidate): Candidate[] {
  const policies: PolicyKind[]=['effects','effects-reserve','balanced','reserve',
    ...(input.preset.kind==='DEFENCE'?['effects-score' as const]:input.preset.kind==='ATTACK'
      ?['effects-public' as const,'effects-tail' as const,'effects-score' as const,'effects-duo' as const]:['effects-tail' as const,'effects-score' as const])];
  return policies.filter(policy=>policy!==parent.policy).map(policy=>({...parent,policy,
    preferredPlan:undefined,preferredPlanMode:undefined,
    id:JSON.stringify([parent.cards.map(c=>[c.name,c.totsu,c.selectedMagic,c.support]),parent.challengeIds,policy])}));
}

export function lowerCostCandidates(input: SearchInput, parent: Candidate, catalog: Record<string,{rare:string}>): Candidate[] {
  return [...allocationCards(input,parent,catalog,true)].filter(cards=>upgradeCost(input,cards)<parent.cost).map(cards=>{
    const legalPlan=parent.preferredPlan?.every(pair=>pair.every(id=>{
      const match=/^(\d+)-M([123])$/.exec(id);
      return !!match&&cards[Number(match[1])]?.selectedMagic.some(m=>m===Number(match[2]));
    }));
    // Losing an unused M3 must not discard an otherwise legal good plan.
    // The new loadout still gets its own development and validation trials.
    const preferredPlan=legalPlan?parent.preferredPlan:undefined;
    const preferredPlanMode=legalPlan?parent.preferredPlanMode:undefined;
    const cost=upgradeCost(input,cards);
    const base=[cards.map(c=>[c.name,c.totsu,c.selectedMagic,c.support]),parent.challengeIds,parent.policy];
    const id=JSON.stringify(preferredPlan?[...base,preferredPlan,preferredPlanMode]:base);
    return {...parent,id,cards,cost,preferredPlan,preferredPlanMode};
  });
}

export function upgradeCost(input: Pick<SearchInput,'itemsPerLimitBreak'>, cards: SearchCard[]): number {
  return cards.reduce((sum,c)=>sum+(c.support?0:Math.max(0,c.totsu-c.originalTotsu)*input.itemsPerLimitBreak),0);
}

export function trainedUpgradeCandidates(input:SearchInput,parent:Candidate,catalog:Record<string,{rare:string}>):Candidate[] {
  return [...allocationCards(input,parent,catalog)]
    // Keep learned-plan redistribution at the same total cost (for example
    // 2+1 -> 3+0); omit only the unchanged parent and preserve its spells.
    .filter(cards=>upgradeCost(input,cards)>=parent.cost
      &&cards.some((card,i)=>card.totsu!==parent.cards[i].totsu)
      &&cards.every((card,i)=>card.selectedMagic.join(',')===parent.cards[i].selectedMagic.join(',')))
    .map(cards=>{
      const preferredPlan=parent.preferredPlan?.length?parent.preferredPlan:undefined;
      const preferredPlanMode=preferredPlan?parent.preferredPlanMode:undefined;
      const base=[cards.map(c=>[c.name,c.totsu,c.selectedMagic,c.support]),parent.challengeIds,parent.policy];
      const id=JSON.stringify(preferredPlan?[...base,preferredPlan,preferredPlanMode]:base);
      return {...parent,cards,cost:upgradeCost(input,cards),preferredPlan,preferredPlanMode,id};
    })
    .sort((a,b)=>a.cost-b.cost);
}

// Enumerate allocations only within this team, pruning by total item cost.
// Unchanged training retains its spells; changed training tries every legal pair.
// A generator lets callers yield between estimates and honour cancellation.
export function* allocationCards(input: SearchInput, parent: Candidate, catalog: Record<string,{rare:string}>, reduceOnly=false,
  index=0, cards: SearchCard[]=[], cost=0): Generator<SearchCard[]> {
  if(index===parent.cards.length){yield cards;return;}
  const slot=parent.cards[index];
  const original=(slot.support?input.supports:input.roster).find(c=>c.name===slot.name);
  if(!original)return;
  const targets=slot.support?[slot.totsu]:[original.totsu,...upgradeTargets(original,catalog[slot.name].rare,input.budget-cost,input.itemsPerLimitBreak)]
    .filter(t=>!reduceOnly||t<=slot.totsu);
  for(const target of targets) {
    const nextCost=cost+(slot.support?0:(target-original.totsu)*input.itemsPerLimitBreak);
    if(nextCost>input.budget)continue;
    const options=target===slot.totsu?[slot]:searchCardVariants(original,catalog[slot.name].rare,false,target);
    for(const option of options)yield* allocationCards(input,parent,catalog,reduceOnly,index+1,[...cards,option],nextCost);
  }
}

export function validateInput(input: SearchInput, catalog: Record<string, { rare: string; chara?: string }>): string | null {
  if (!challengeVariants(input).length) return 'challenges';
  const support=examUsesSupport(input.preset);
  if (input.roster.length < (support?4:5) || support&&!input.supports.length) return 'roster';
  if (new Set(input.roster.map(c => c.name)).size !== input.roster.length) return 'duplicate';
  if (!Number.isInteger(input.budget) || input.budget < 0 || !Number.isInteger(input.itemsPerLimitBreak) || input.itemsPerLimitBreak < 1
    || Math.floor(input.budget / input.itemsPerLimitBreak) > 4) return 'budget';
  if (!Number.isFinite(input.target) || input.target < 0 || !Number.isInteger(input.attempts) || input.attempts < 1 || input.attempts > 100000
    || !Number.isFinite(input.tolerance) || input.tolerance < 0 || (input.target === 0 ? input.tolerance !== 0 : input.tolerance >= input.target)
    || !Number.isFinite(input.desiredProbability) || input.desiredProbability <= 0 || input.desiredProbability >= 1) return 'target';
  if (!Number.isFinite(input.preset.enemyHp) || input.preset.enemyHp <= 0 || !Number.isFinite(input.preset.difficulty) || input.preset.difficulty! <= 0) return 'exam';
  for (const c of [...input.roster, ...input.supports]) {
    const rare = catalog[c.name]?.rare;
    const max = rare === 'SSR' ? 120 : rare === 'SR' ? 90 : 70;
    if (!rare || !Number.isInteger(c.totsu) || c.totsu < 0 || c.totsu > 4 || !Number.isInteger(c.level) || c.level < 1 || c.level > max
      || c.magicLevels.length !== 3 || c.buddyLevels.length !== 3
      || [...c.magicLevels, ...c.buddyLevels].some(l => !Number.isInteger(l) || l < 1 || l > 10)) return 'card';
  }
  if (input.requiredCards !== undefined) {
    if (!Array.isArray(input.requiredCards) || input.requiredCards.length > 5) return 'required-cards-limit';
    if (input.requiredCards.some(name => typeof name !== 'string' || !name.length)) return 'required-cards';
    if (new Set(input.requiredCards).size !== input.requiredCards.length) return 'required-cards-duplicate';
    const owned = new Set(input.roster.map(card => card.name));
    const availableSupport = new Set(input.supports.map(card => card.name));
    if (input.requiredCards.some(name => !catalog[name])) return 'required-cards-unknown';
    if (!support && input.requiredCards.some(name => !owned.has(name))) return 'required-cards-unowned';
    if (support) {
      const supportOnly = input.requiredCards.filter(name => !owned.has(name));
      if (supportOnly.length > 1) return 'required-cards-support';
      if (supportOnly.some(name => !availableSupport.has(name))) return 'required-cards-unowned';
      if (input.requiredCards.length > 4
        && !input.requiredCards.some(name => availableSupport.has(name))) return 'required-cards-impossible';
    }
  }
  if (input.requiredCharacters !== undefined) {
    if (!Array.isArray(input.requiredCharacters) || input.requiredCharacters.length > 5) return 'required-characters-limit';
    if (input.requiredCharacters.some(name => typeof name !== 'string' || !name.length)) return 'required-characters';
    if (new Set(input.requiredCharacters).size !== input.requiredCharacters.length) return 'required-characters-duplicate';
    const catalogCharacters = new Set(Object.values(catalog).map(card => card.chara).filter((name): name is string => !!name));
    if (input.requiredCharacters.some(name => !catalogCharacters.has(name))) return 'required-characters-unknown';
    const ownedByCharacter = new Map<string, string[]>(), supportByCharacter = new Map<string, string[]>();
    for (const card of input.roster) {
      const chara = catalog[card.name]?.chara; if (!chara) continue;
      ownedByCharacter.set(chara, [...(ownedByCharacter.get(chara) ?? []), card.name]);
    }
    for (const card of input.supports) {
      const chara = catalog[card.name]?.chara; if (!chara) continue;
      supportByCharacter.set(chara, [...(supportByCharacter.get(chara) ?? []), card.name]);
    }
    const required = [...input.requiredCharacters];
    if (!support) {
      if (required.some(chara => !ownedByCharacter.has(chara))) return 'required-characters-unowned';
      const requiredCards = new Set(input.requiredCards ?? []);
      const additional = required.filter(chara => ![...requiredCards].some(name => catalog[name]?.chara === chara));
      if (requiredCards.size + additional.length > 5) return 'required-characters-impossible';
    } else {
      // Try each available support card as the one support slot. This also
      // handles support-only required cards and character requirements that
      // compete for the four owned slots.
      const requiredCards = [...new Set(input.requiredCards ?? [])];
      const owned = new Set(input.roster.map(card => card.name));
      const supportCandidates = input.supports;
      const feasible = supportCandidates.some(supportCard => {
        const ownedRequired = requiredCards.filter(name => name !== supportCard.name);
        if (ownedRequired.some(name => !owned.has(name))) return false;
        const requiredOwned = new Set(ownedRequired);
        if (requiredOwned.size > 4) return false;
        let additional = 0;
        for (const chara of required) {
          const coveredBySupport = catalog[supportCard.name]?.chara === chara;
          const coveredByOwned = [...requiredOwned].some(name => catalog[name]?.chara === chara);
          if (coveredBySupport || coveredByOwned) continue;
          if (!(ownedByCharacter.get(chara) ?? []).some(name => !requiredOwned.has(name))) return false;
          additional++;
        }
        return requiredOwned.size + additional <= 4;
      });
      if (!feasible) return 'required-characters-impossible';
    }
  }
  return null;
}
