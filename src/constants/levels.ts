export function getStatScalingMaxLevel(rare?: string): number {
  switch (rare) {
    case 'R':
      return 70;
    case 'SR':
      return 90;
    case 'SSR':
      return 110;
    default:
      return 110;
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
      return 110;
  }
}