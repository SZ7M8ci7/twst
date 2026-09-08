import type { SearchResult } from '@/domain/examSearch/types';

const compositionKey = (result: SearchResult) => JSON.stringify([
  result.candidate.cards.map(card=>[card.name,card.support]).sort((a,b)=>String(a).localeCompare(String(b))),
  [...result.candidate.challengeIds].sort(),
]);

/** Give distinct teams validation slots before adding more spell/policy variants. */
export function diverseFinalists(preferred: (SearchResult | undefined)[], width: number,
  retained: SearchResult[] = []): SearchResult[] {
  const selected: SearchResult[] = [], used = new Set(retained.map(row=>row.candidate.id));
  const counts = new Map<string,number>();
  for (const row of retained) {
    const key = compositionKey(row); counts.set(key,(counts.get(key)??0)+1);
  }
  for (const limit of [2,Infinity]) for (const row of preferred) {
    if (selected.length >= width) return selected;
    if (!row || used.has(row.candidate.id)) continue;
    const key = compositionKey(row), count = counts.get(key)??0;
    if (count >= limit) continue;
    selected.push(row); used.add(row.candidate.id); counts.set(key,count+1);
  }
  return selected;
}
