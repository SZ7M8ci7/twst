import type { Candidate, SearchCard, SearchInput } from '@/domain/examSearch/types';
import { getFriendshipLevelBonus, getMaxLevelAtLimitBreak } from '@/constants/levels';

type Catalog = Record<string, { rare: string }>;
type Estimate = (cards: SearchCard[]) => number;
const LEVEL_STEP = 5;

export function additionalLevelCost(cards: readonly SearchCard[]): number {
  return cards.reduce((sum, card) => sum + (card.support ? 0 : card.additionalLevels ?? 0), 0);
}

export function withinLevelBudget(input: Pick<SearchInput, 'additionalLevelCap'>, cards: readonly SearchCard[],
  catalog?: Record<string, { rare?: string }>): boolean {
  const used = additionalLevelCost(cards), budget = input.additionalLevelCap ?? 0;
  if (used > budget || !cards.every(card => Number.isInteger(card.additionalLevels ?? 0)
    && (card.additionalLevels ?? 0) >= 0 && (!card.support || !card.additionalLevels))) return false;
  // Non-five increments are only a card's remaining headroom or the final
  // budget remainder. Never split that remainder between several cards.
  const remainders = cards.filter(card => {
    const amount = card.additionalLevels ?? 0, rare = catalog?.[card.name]?.rare;
    return amount % LEVEL_STEP !== 0 && !(rare && amount === cardCapacity(card, rare));
  });
  return remainders.length === 0 || remainders.length === 1 && used === budget;
}

function capacity(card: SearchCard, catalog: Catalog): number {
  return cardCapacity(card, catalog[card.name].rare);
}

function cardCapacity(card: SearchCard, rare: string): number {
  if (card.support) return 0;
  const baseline = card.level - (card.additionalLevels ?? 0);
  return Math.max(0, Math.min(getFriendshipLevelBonus(rare), getMaxLevelAtLimitBreak(rare, card.totsu) - baseline));
}

function allocate(card: SearchCard, amount: number): SearchCard {
  return { ...card, level: card.level - (card.additionalLevels ?? 0) + amount, additionalLevels: amount };
}

export function trainingCandidate(parent: Candidate, cards: SearchCard[], estimate: Estimate): Candidate {
  const base = [cards.map(c => [c.name, c.level, c.totsu, c.selectedMagic, c.support]), parent.challengeIds, parent.policy];
  return { ...parent, cards, estimate: estimate(cards),
    id: JSON.stringify(parent.preferredPlan ? [...base, parent.preferredPlan, parent.preferredPlanMode] : base) };
}

/**
 * Search five-level allocations with a bounded beam, plus explicit concentrated
 * and balanced seeds. Keep zero/partial training: more damage can finish a
 * BASIC battle too early. Yield during estimates so cancellation stays usable.
 */
export function* levelAllocationSteps(input: SearchInput, parent: Candidate, catalog: Catalog,
  estimate: Estimate): Generator<void, Candidate[]> {
  const budget = input.additionalLevelCap ?? 0;
  if (!budget) return withinLevelBudget(input, parent.cards, catalog) ? [parent] : [];
  const baseline = parent.cards.map(card => allocate(card, 0));
  const caps = baseline.map(card => capacity(card, catalog));
  const total = Math.min(budget, caps.reduce((sum, cap) => sum + cap, 0));
  if (!total) return [parent];
  const cache = new Map<string, Candidate>();
  let work = 0;
  const evaluate = (amounts: number[]) => {
    const key = amounts.join(',');
    if (!cache.has(key)) cache.set(key, trainingCandidate(parent, baseline.map((card, i) => allocate(card, amounts[i])), estimate));
    return cache.get(key)!;
  };
  const zeros = caps.map(() => 0), base = evaluate(zeros);
  const concentrated: Candidate[] = [], balanced: Candidate[] = [];
  // Retain every possible single-card investment, even when the heuristic
  // prefers another recipient. Battle trials decide which finisher benefits.
  for (let i = 0; i < caps.length; i++) if (caps[i]) {
    const amounts = [...zeros]; amounts[i] = Math.min(caps[i], total);
    concentrated.push(evaluate(amounts));
  }
  const balance = (indices: number[]) => {
    const amounts = [...zeros];
    for (let used = 0; used < total;) {
      let changed = false;
      for (const i of indices) if (used < total && amounts[i] < caps[i]) {
        const step = Math.min(LEVEL_STEP, total - used, caps[i] - amounts[i]);
        amounts[i] += step; used += step; changed = true;
      }
      if (!changed) break;
    }
    return evaluate(amounts);
  };
  for (let i = 0; i < caps.length; i++) for (let j = i + 1; j < caps.length; j++) {
    if (caps[i] && caps[j]) balanced.push(balance([i, j]));
  }
  const even = balance(caps.map((_, i) => i));
  const rank = (a: Candidate, b: Candidate) => b.estimate - a.estimate || a.id.localeCompare(b.id);
  let beam = [base];
  const champions: Candidate[] = [];
  const completed: Candidate[] = [];
  // Every move consumes five levels, except when it exhausts a card or budget.
  for (let depth = 0; beam.length && depth < Math.ceil(total / LEVEL_STEP) + caps.length; depth++) {
    const next = new Map<string, Candidate>();
    for (const row of beam) for (let i = 0; i < caps.length; i++) {
      const amounts = row.cards.map(card => card.additionalLevels ?? 0);
      const remaining = total - additionalLevelCost(row.cards);
      if (amounts[i] >= caps[i] || !remaining) continue;
      amounts[i] += Math.min(LEVEL_STEP, caps[i] - amounts[i], remaining);
      const candidate = evaluate(amounts); next.set(candidate.id, candidate);
      if (++work % 32 === 0) yield;
    }
    const ranked = [...next.values()].sort(rank);
    completed.push(...ranked.filter(row => additionalLevelCost(row.cards) === total).slice(0, 2));
    beam = ranked.filter(row => additionalLevelCost(row.cards) < total).slice(0, 8);
    if (ranked[0]) champions.push(ranked[0]);
  }
  // Bounded battle workload; refinement also moves whole five-level chunks.
  const partial = champions[Math.floor((champions.length - 1) / 2)];
  const options = [...completed.sort(rank).slice(0, 2), ...balanced.sort(rank).slice(0, 2), ...concentrated,
    even, partial, ...champions.sort(rank).slice(0, 2), base, parent].filter((row): row is Candidate => !!row);
  return [...new Map(options.filter(row => withinLevelBudget(input, row.cards, catalog)).map(row => [row.id, row])).values()];
}

/** Move five-level chunks or the final remainder, preserving learned plans. */
export function levelAllocationNeighbors(input: SearchInput, parent: Candidate, catalog: Catalog, estimate: Estimate): Candidate[] {
  const budget = input.additionalLevelCap ?? 0;
  if (!budget) return [];
  const amounts = parent.cards.map(card => card.additionalLevels ?? 0);
  const caps = parent.cards.map(card => capacity(card, catalog));
  const used = additionalLevelCost(parent.cards);
  const rows = new Map<string, Candidate>();
  const add = (values: number[]) => {
    if (values.every((value, i) => value === amounts[i])) return;
    const cards = parent.cards.map((card, i) => allocate(card, values[i]));
    if (!withinLevelBudget(input, cards, catalog)) return;
    const key = values.join(',');
    if (!rows.has(key)) rows.set(key, trainingCandidate(parent, cards, estimate));
  };
  const options = caps.map(cap => [...new Set([0, ...Array.from({ length: Math.floor(cap / LEVEL_STEP) },
    (_, i) => (i + 1) * LEVEL_STEP), cap])]);
  for (let i = 0; i < amounts.length; i++) {
    const remaining = budget - used + amounts[i];
    for (const value of [...options[i], remaining]) if (value <= caps[i] && value <= remaining) {
      const next = [...amounts]; next[i] = value; add(next);
    }
    for (let j = i + 1; j < amounts.length; j++) {
      const total = amounts[i] + amounts[j];
      for (const value of [...options[i], ...options[j].map(amount => total - amount)]) {
        if (value < 0 || value > caps[i] || total - value < 0 || total - value > caps[j]) continue;
        const moved = [...amounts]; moved[i] = value; moved[j] = total - value; add(moved);
      }
    }
  }
  return [...rows.values()].sort((a, b) => b.estimate - a.estimate);
}
