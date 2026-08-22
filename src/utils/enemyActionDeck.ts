export interface ConstrainedEnemyAction {
  identity: string;
  fixedOrder?: number;
  preferFirstDuplicate?: boolean;
}

export function buildConstrainedEnemyActionDeck<T extends ConstrainedEnemyAction>(
  allActions: T[],
  rng: () => number,
  deckSize = 10,
): T[] | null {
  const fixedActions = allActions
    .filter((action) => Number.isInteger(action.fixedOrder) && Number(action.fixedOrder) >= 1 && Number(action.fixedOrder) <= deckSize)
    .sort((a, b) => Number(a.fixedOrder) - Number(b.fixedOrder));
  if (!fixedActions.length) return null;

  const fixedIdentities = new Set(fixedActions.map((action) => action.identity));
  const selected = [...allActions];
  const counts = countIdentities(selected);
  const preferredCandidates = allActions.filter((action) => action.preferFirstDuplicate && !fixedIdentities.has(action.identity));
  if (selected.length < deckSize && preferredCandidates.length) {
    const picked = pickRandom(preferredCandidates, rng);
    selected.push(picked);
    counts.set(picked.identity, (counts.get(picked.identity) ?? 0) + 1);
  }
  while (selected.length < deckSize) {
    const candidates = allActions.filter((action) => (
      !fixedIdentities.has(action.identity)
      && (counts.get(action.identity) ?? 0) < 2
    ));
    if (!candidates.length) break;
    const picked = pickRandom(candidates, rng);
    selected.push(picked);
    counts.set(picked.identity, (counts.get(picked.identity) ?? 0) + 1);
  }

  const fixedActionSet = new Set(fixedActions);
  const deck = shuffle(selected.filter((action) => !fixedActionSet.has(action)), rng).slice(0, deckSize - fixedActions.length);
  fixedActions.forEach((action) => {
    const index = Math.min(deck.length, Math.max(0, Number(action.fixedOrder) - 1));
    deck.splice(index, 0, action);
  });
  return deck.slice(0, deckSize);
}

function countIdentities<T extends ConstrainedEnemyAction>(actions: T[]) {
  const counts = new Map<string, number>();
  actions.forEach((action) => counts.set(action.identity, (counts.get(action.identity) ?? 0) + 1));
  return counts;
}

function pickRandom<T>(items: T[], rng: () => number): T {
  return items[Math.min(items.length - 1, Math.floor(rng() * items.length))];
}

function shuffle<T>(items: T[], rng: () => number) {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(rng() * (index + 1));
    [result[index], result[swapIndex]] = [result[swapIndex], result[index]];
  }
  return result;
}
