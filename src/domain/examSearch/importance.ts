export interface WeightedObservation {
  score: number;
  weight: number;
}

// Return the largest observed score whose weighted upper tail reaches the
// requested probability. The denominator is the number of proposal trials,
// rather than the sum of importance weights.
export function importanceUpperQuantile(
  observations: readonly WeightedObservation[],
  minimumPerAttemptProbability: number,
): number {
  if (!observations.length || !Number.isFinite(minimumPerAttemptProbability)
    || observations.some(({ score, weight }) => !Number.isFinite(score) || !Number.isFinite(weight) || weight < 0)) return 0;

  const threshold = Math.max(Number.EPSILON, minimumPerAttemptProbability);
  const ordered = [...observations].sort((a, b) => b.score - a.score);
  let weight = 0;
  for (let index = 0; index < ordered.length;) {
    const score = ordered[index].score;
    while (index < ordered.length && ordered[index].score === score) weight += ordered[index++].weight;
    if (weight / observations.length >= threshold) return score;
  }
  return 0;
}
