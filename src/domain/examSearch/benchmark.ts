import type { SearchCard, SearchResult } from '@/domain/examSearch/types';
import type { ExamPresetDefinition } from '@/utils/examPresets';
import { examUsesSupport } from '@/domain/examSearch/variants';

export function benchmarkGroup(preset: ExamPresetDefinition) {
  return [examUsesSupport(preset) ? 'unified' : 'normal', preset.kind, preset.enemyElement].join('/');
}

export function groupBenchmarkPresets(presets: ExamPresetDefinition[]) {
  const groups = new Map<string, ExamPresetDefinition[]>();
  for (const preset of presets) {
    const key = benchmarkGroup(preset);
    const group = groups.get(key) ?? [];
    group.push(preset);
    groups.set(key, group);
  }
  for (const group of groups.values()) {
    group.sort((a, b) => b.title.localeCompare(a.title, 'ja', { numeric: true }));
  }
  return groups;
}

export interface BenchmarkWinner {
  cards: Pick<SearchCard, 'name' | 'support' | 'selectedMagic'>[];
  highest: number;
  mean: number;
  trials: number;
}

/** Use the ordinary validation trials behind the search table's highest-score column. */
export function benchmarkWinner(finalists: SearchResult[]): BenchmarkWinner | null {
  let winner: BenchmarkWinner | null = null;
  let winnerId = '';
  for (const { candidate, validation } of finalists) {
    if (!validation.scores.length) continue;
    let sum = 0;
    let highest = 0;
    for (const value of validation.scores) {
      const score = Number.isFinite(value) && value > 0 ? value : 0;
      sum += score;
      highest = Math.max(highest, score);
    }
    const mean = sum / validation.scores.length;
    if (winner && (highest < winner.highest || (highest === winner.highest &&
      (mean < winner.mean || (mean === winner.mean && candidate.id >= winnerId))))) continue;
    winnerId = candidate.id;
    winner = { cards: candidate.cards.map(({ name, support, selectedMagic }) => ({ name, support, selectedMagic })),
      highest, mean, trials: validation.scores.length };
  }
  return winner;
}

export function summarizeBenchmark(winners: BenchmarkWinner[]) {
  const cards = new Map<string, { name: string; slots: number; exams: number }>();
  let totalHighest = 0;
  let totalMean = 0;
  for (const winner of winners) {
    totalHighest += winner.highest;
    totalMean += winner.mean;
    const seen = new Set<string>();
    for (const { name } of winner.cards) {
      const entry = cards.get(name) ?? { name, slots: 0, exams: 0 };
      entry.slots++;
      if (!seen.has(name)) entry.exams++;
      seen.add(name);
      cards.set(name, entry);
    }
  }
  return {
    meanHighest: winners.length ? totalHighest / winners.length : null,
    meanScore: winners.length ? totalMean / winners.length : null,
    ranking: [...cards.values()].sort((a, b) => b.slots - a.slots || b.exams - a.exams || a.name.localeCompare(b.name, 'ja')),
  };
}
