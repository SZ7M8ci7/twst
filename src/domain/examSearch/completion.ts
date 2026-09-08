import type { SearchInput, SearchCard } from '@/domain/examSearch/types';
import { examUsesSupport } from '@/domain/examSearch/variants';

/** Identity-only feasibility is shared by spell alternatives of a partial team. */
export function createCompletionCheck(
  input: SearchInput,
  catalog: Record<string, { chara?: string }>,
  ownedOptions: readonly Pick<SearchCard, 'name'>[],
  supportOptions: readonly Pick<SearchCard, 'name'>[],
  requiredCards: readonly string[] = input.requiredCards ?? [],
): ((partial: readonly Pick<SearchCard, 'name' | 'support'>[]) => boolean) | undefined {
  const requiredCharacters = [...new Set(input.requiredCharacters ?? [])];
  if (!requiredCards.length && !requiredCharacters.length) return undefined;
  const supportAllowed = examUsesSupport(input.preset), ownCount = supportAllowed ? 4 : 5;
  const ownedNames = new Set(ownedOptions.map(card => card.name));
  const byCharacter = new Map<string, Set<string>>();
  for (const name of ownedNames) {
    const character = catalog[name]?.chara;
    if (!character) continue;
    if (!byCharacter.has(character)) byCharacter.set(character, new Set());
    byCharacter.get(character)!.add(name);
  }
  const requiredSet = new Set(requiredCards), characterSet = new Set(requiredCharacters);
  // Supports with the same requirement coverage are interchangeable here.
  // Their damage, spell and buddy differences are still compared by the beam.
  const supportGroups = new Map<string, string>();
  for (const {name} of supportOptions) {
    const character = catalog[name]?.chara ?? '';
    const key = requiredSet.has(name) ? `card:${name}` : characterSet.has(character) ? `character:${character}` : 'other';
    if (!supportGroups.has(key)) supportGroups.set(key, name);
  }
  const cache = new Map<string, boolean>();
  return partial => {
    const key = partial.map(card => `${card.support ? 's' : 'o'}:${card.name}`).sort().join('|');
    const cached = cache.get(key);
    if (cached !== undefined) return cached;
    const own = partial.filter(card => !card.support), borrowed = partial.filter(card => card.support);
    const used = new Set(own.map(card => card.name));
    const remaining = ownCount - own.length;
    let feasible = remaining >= 0 && borrowed.length <= Number(supportAllowed) && used.size === own.length;
    if (feasible) {
      const present = new Set(partial.map(card => card.name));
      const characters = new Set(partial.map(card => catalog[card.name]?.chara));
      const fits = (supportName?: string) => {
        const pending = [...requiredSet].filter(name => !present.has(name) && name !== supportName);
        if (pending.length > remaining || pending.some(name => !ownedNames.has(name))) return false;
        const covered = new Set([...characters, ...pending.map(name => catalog[name]?.chara), catalog[supportName ?? '']?.chara]);
        const missing = requiredCharacters.filter(name => !covered.has(name));
        return pending.length + missing.length <= remaining && missing.every(character =>
          [...(byCharacter.get(character) ?? [])].some(name => !used.has(name)));
      };
      feasible = borrowed.length || !supportAllowed ? fits() : [...supportGroups.values()].some(fits);
    }
    if (cache.size >= 4096) cache.clear();
    cache.set(key, feasible);
    return feasible;
  };
}
