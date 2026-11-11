// Shared search/evaluation sizes. Comparison does not introduce a separate
// user-facing search-depth setting.
export const DISCOVERY_SAMPLES = 32;
export const VALIDATION_SAMPLES = 2048;
export const REFINED_VALIDATION_SAMPLES = 32768;
export const MAX_FINALISTS = 8;

export const MAX_COMPARISON_ENTRIES = 6;
export const MAX_COMPARISON_EVALUATION_SAMPLES = 1000000;
export const COMPARISON_CONFIDENCE = 0.95;
export const COMPARISON_CDF_ERROR = 0.01;

export const COMPARISON_EVALUATION_SAMPLES = 10000;

// DKWM + union bound: absolute CDF error across all compared teams.
export function comparisonCdfError(samples: number, entries: number): number {
  if (samples <= 0 || entries <= 0) return 1;
  return Math.min(1, Math.sqrt(Math.log(2 * entries / (1 - COMPARISON_CONFIDENCE)) / (2 * samples)));
}
