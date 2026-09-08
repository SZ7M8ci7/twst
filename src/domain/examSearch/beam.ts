import type { SearchCard } from '@/domain/examSearch/types';

type ScoredTeam = { cards: SearchCard[]; value: number };

/** Keep spell alternatives from occupying every slot in a partial-team beam. */
export function diversifyBeam<T extends ScoredTeam>(ranked: T[], preferred: T[], width: number,
  requiredCharacters: readonly string[], catalog: Record<string, { chara?: string }>): T[] {
  if (ranked.length <= width) return preferred;
  const selected: T[] = [], selectedCards = new Set<SearchCard[]>(), counts = new Map<string, number>();
  const keys = new WeakMap<SearchCard[], string>();
  const identity = (cards: SearchCard[]) => {
    let key = keys.get(cards);
    if (key === undefined) {
      key = JSON.stringify(cards.map(card => [card.name, card.level, card.totsu, !!card.support])
        .sort((a,b) => String(a).localeCompare(String(b))));
      keys.set(cards, key);
    }
    return key;
  };
  for (const row of [...preferred, ...ranked]) {
    if (selectedCards.has(row.cards)) continue;
    const key = identity(row.cards), count = counts.get(key) ?? 0;
    if (count >= 2) continue;
    counts.set(key, count + 1); selectedCards.add(row.cards); selected.push(row);
    if (selected.length >= width) break;
  }
  // Fully fixed teams and narrow collections still use every available slot.
  for (const row of [...preferred, ...ranked]) {
    if (selected.length >= width) break;
    if (!selectedCards.has(row.cards)) { selectedCards.add(row.cards); selected.push(row); }
  }
  if (!requiredCharacters.length) return selected;
  const coverage = (row: T) => requiredCharacters.reduce((mask, chara, index) =>
    mask | (row.cards.some(card => catalog[card.name]?.chara === chara) ? 1 << index : 0), 0);
  const protectedCount = Math.max(1, width - 4), protectedRows = selected.slice(0, protectedCount);
  const covered = new Set(protectedRows.map(coverage)), alternatives: T[] = [];
  for (const row of ranked) {
    const mask = coverage(row);
    if (covered.has(mask)) continue;
    covered.add(mask); alternatives.push(row);
    if (alternatives.length >= width - protectedCount) break;
  }
  const result: T[] = [], used = new Set<SearchCard[]>();
  for (const row of [...protectedRows, ...alternatives, ...selected]) {
    if (!used.has(row.cards)) { used.add(row.cards); result.push(row); }
    if (result.length >= width) break;
  }
  return result;
}
