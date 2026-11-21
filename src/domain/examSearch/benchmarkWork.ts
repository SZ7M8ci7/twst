import type { ExamPresetDefinition } from '@/utils/examPresets';
import { examUsesSupport } from './variants';

export type BenchmarkDepth = 'standard' | 'thorough';
export interface BenchmarkWork { candidates: number; validationTrials: number }

// The calibration machine used three search islands. Keep the same three task
// partitions even on devices where the timed simulator chooses a different count.
export const BENCHMARK_ISLANDS = 3;

// November 2026 timing runs, one preset per series and kind. Each pair is
// the summed evaluatedCount and the winning finalist's validation sample count.
const measured = {
  normal: {
    BASIC:   { standard: [208, 576], thorough: [643, 1536] },
    ATTACK:  { standard: [244, 576], thorough: [784, 1792] },
    DEFENCE: { standard: [388, 384], thorough: [1303, 1490] },
  },
  unified: {
    BASIC:   { standard: [107, 448], thorough: [475, 1344] },
    ATTACK:  { standard: [136, 512], thorough: [664, 1728] },
    DEFENCE: { standard: [296, 448], thorough: [1101, 1584] },
  },
} as const;

export function benchmarkIslandWork(preset: ExamPresetDefinition, depth: BenchmarkDepth, island: number): BenchmarkWork {
  const series = examUsesSupport(preset) ? 'unified' : 'normal';
  const [total, validationTrials] = measured[series][preset.kind][depth];
  const candidates = Math.floor(total / BENCHMARK_ISLANDS) + Number(island < total % BENCHMARK_ISLANDS);
  return { candidates, validationTrials };
}
