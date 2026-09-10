// Character selections filter the existing list; they are not card constraints.
export function matchesCharacterFilter(
  cards: readonly { name: string }[],
  characters: readonly string[],
  catalog: Record<string, { chara?: string }>,
): boolean {
  const present = new Set(cards.map(card => catalog[card.name]?.chara).filter(Boolean));
  return characters.every(character => present.has(character));
}
