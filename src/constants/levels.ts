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

// Zero is the collection editor's unset level. Search treats it as Lv1.
export function isValidInputLevel(value: unknown, rare?: string, minimum = 0): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= minimum && value <= getInputMaxLevel(rare);
}
