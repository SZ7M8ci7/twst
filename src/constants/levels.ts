export function getStatScalingMaxLevel(rare?: string): number {
  switch (rare) {
    case 'R':
      return 70;
    case 'SR':
      return 90;
    case 'SSR':
      return 120;
    default:
      return 120;
  }
}

export function getInputMaxLevel(rare?: string): number {
  switch (rare) {
    case 'R':
      return 70;
    case 'SR':
      return 90;
    case 'SSR':
      return 120;
    default:
      return 120;
  }
}

/**
 * Guest-room friendship unlocks up to +20 for SSR (friendship Lv30 since
 * March 2026), +10 for SR/R (Lv15). Unlocking alone does not train card Lv.
 * https://kamigame.jp/ツイステ/page/213097620309074770.html
 */
export function getFriendshipLevelBonus(rare: string): number {
  return rare === 'SSR' ? 20 : 10;
}

/** Maximum with friendship fully raised, at this limit-break count. */
export function getMaxLevelAtLimitBreak(rare: string, totsu: number): number {
  const base = rare === 'R' ? 40 : rare === 'SR' ? 60 : 80;
  return base + totsu * 5 + getFriendshipLevelBonus(rare);
}

// Zero is the collection editor's unset level. Search treats it as Lv1.
export function isValidInputLevel(value: unknown, rare?: string, minimum = 0): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= minimum && value <= getInputMaxLevel(rare);
}
