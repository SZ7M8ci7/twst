import type { SearchResult } from '@/domain/examSearch/types';
import { additionalLevelCost } from '@/domain/examSearch/levelAllocation';

export type ResultGroup = { primary: SearchResult; variants: SearchResult[]; allVariants: SearchResult[] };

export const resultDeckKey = (result: SearchResult): string => JSON.stringify(result.candidate.cards
  .map(card => [card.support, card.name]).sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b))));

// Upgrades on different cards remain different investment choices.
const upgradeKey = (result: SearchResult): string => JSON.stringify(result.candidate.cards
  .map(card => [card.support, card.name, card.totsu]).sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b))));
const investmentKey = (result: SearchResult): string => JSON.stringify(result.candidate.cards
  .map(card => [card.support, card.name, card.level, card.totsu]).sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b))));

/** Input is already ranked. Never alter scores, replay candidates or saved trials. */
export function groupSearchResults(ranked: readonly SearchResult[], compactTraining = false): ResultGroup[] {
  const groups = new Map<string, ResultGroup>();
  const investments = new Map<string, Set<string>>();
  for (const result of ranked) {
    const key = resultDeckKey(result);
    const investment = investmentKey(result);
    const known = investments.get(key) ?? new Set<string>();
    if (known.has(investment)) continue;
    known.add(investment);
    investments.set(key, known);
    const group = groups.get(key);
    if (group) group.allVariants.push(result);
    else groups.set(key, { primary: result, variants: [], allVariants: [] });
  }
  for (const group of groups.values()) {
    if (!compactTraining) {
      group.variants = group.allVariants;
      continue;
    }
    // Per limit-break allocation keep the highest-ranked training option and
    // its cheapest alternative. No arbitrary level/score threshold is needed.
    // Intermediate allocations remain available in the existing comparison.
    const representatives = new Map<string, { best: SearchResult; cheapest: SearchResult }>();
    const rows = [group.primary, ...group.allVariants];
    for (const result of rows) {
      const key = upgradeKey(result);
      const existing = representatives.get(key);
      if (!existing) representatives.set(key, { best: result, cheapest: result });
      else if (additionalLevelCost(result.candidate.cards) < additionalLevelCost(existing.cheapest.candidate.cards)) {
        existing.cheapest = result;
      }
    }
    const selected = new Set([...representatives.values()].flatMap(row => [row.best, row.cheapest]));
    group.variants = group.allVariants.filter(row => selected.has(row));
  }
  return [...groups.values()];
}
