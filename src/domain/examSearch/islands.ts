import { MAX_ISLANDS, type SearchProgress, type SearchResult } from '@/domain/examSearch/types';
import type { SessionCheckpoint } from '@/domain/examSearch/scheduler';

const MAX_RESULTS_PER_ISLAND = 8;

export function chooseIslandCount(cores?: number, memory?: number): 1 | 2 | 3 | 6 {
  if (Number.isFinite(cores) && Number.isFinite(memory) && (cores as number) >= 16 && (memory as number) >= 16) return 6;
  const knownCores = Number.isFinite(cores) ? Math.floor(cores as number) : 0;
  let count: 1 | 2 | 3 = knownCores >= 8 ? 3 : knownCores >= 4 ? 2 : 1;
  if (Number.isFinite(memory)) {
    if ((memory as number) <= 2) count = 1;
    else if ((memory as number) < 8) count = Math.min(count, 2) as 1 | 2;
  }
  return count;
}

export function mergeIslandResults(
  rows: readonly SearchResult[][],
  owners: Record<string, number> = {},
): { results: SearchResult[]; owners: Record<string, number> } {
  const occurrences = new Map<string, Array<{ island: number; result: SearchResult }>>();
  const order: string[] = [];
  for (const [island, row] of rows.slice(0, MAX_ISLANDS).entries()) {
    for (const result of row.slice(0, MAX_RESULTS_PER_ISLAND)) {
      const id = result.candidate.id;
      if (!occurrences.has(id)) order.push(id);
      const values = occurrences.get(id) ?? [];
      if (!values.some(value => value.island === island)) values.push({ island, result });
      occurrences.set(id, values);
    }
  }
  const mergedOwners: Record<string, number> = {};
  const results: SearchResult[] = [];
  for (const id of order) {
    const values = occurrences.get(id)!;
    const previous = owners[id];
    const selectedIsland = values.some(value => value.island === previous)
      ? previous
      : Math.min(...values.map(value => value.island));
    const selected = values.find(value => value.island === selectedIsland)!;
    mergedOwners[id] = selectedIsland;
    results.push(selected.result);
  }
  return { results: results.slice(0, MAX_ISLANDS * MAX_RESULTS_PER_ISLAND), owners: mergedOwners };
}

const phaseOrder: Record<SearchProgress['phase'], number> = { generate: 0, validate: 1, stopped: 2, done: 3 };

export function aggregateIslandProgress(
  progresses: readonly (SearchProgress | undefined)[],
  owners: Record<string, number> = {},
): { progress: SearchProgress; owners: Record<string, number> } {
  const capped = progresses.slice(0, MAX_ISLANDS);
  const present = capped.filter((progress): progress is SearchProgress => !!progress);
  const merged = mergeIslandResults(capped.map(progress => progress?.results ?? []), owners);
  const phase = present.length
    ? present.reduce((current, progress) => phaseOrder[progress.phase] < phaseOrder[current] ? progress.phase : current, 'done' as SearchProgress['phase'])
    : 'generate';
  const sum = (field: 'generated' | 'evaluated' | 'tasksDone' | 'tasksTotal') => present.reduce((total, progress) => total + progress[field], 0);
  return {
    progress: {
      phase,
      generated: sum('generated'),
      evaluated: sum('evaluated'),
      tasksDone: sum('tasksDone'),
      tasksTotal: sum('tasksTotal'),
      elapsedMs: present.reduce((max, progress) => Math.max(max, progress.elapsedMs), 0),
      results: merged.results,
    },
    owners: merged.owners,
  };
}

export function createParallelCheckpoint(
  checkpoints: SessionCheckpoint[],
  baseNonce: string,
  owners: Record<string, number> = {},
  elapsed?: number,
): SessionCheckpoint {
  const children = checkpoints.slice(0, MAX_ISLANDS).map(({ parallel: _parallel, ...checkpoint }) => checkpoint);
  const merged = mergeIslandResults(children.map(checkpoint => checkpoint.finalists), owners);
  const seen = [...new Set(children.flatMap(checkpoint => checkpoint.seen))];
  const sum = (field: 'cursor' | 'trialSerial' | 'evaluatedCount' | 'tasksTotal') =>
    children.reduce((total, checkpoint) => total + (checkpoint[field] ?? 0), 0);
  const max = (field: 'round' | 'mutationRound' | 'elapsed') =>
    children.reduce((value, checkpoint) => Math.max(value, checkpoint[field] ?? 0), 0);
  const normalizedElapsed = Number.isFinite(elapsed) ? Math.max(0, elapsed as number) : max('elapsed');
  return {
    cursor: sum('cursor'), seen, pool: [], finalists: merged.results, pending: [],
    round: max('round'), elapsed: normalizedElapsed, trialSerial: sum('trialSerial'), nonce: baseNonce,
    evaluatedCount: sum('evaluatedCount'), tasksTotal: sum('tasksTotal'), mutationRound: max('mutationRound'),
    parallel: { baseNonce, checkpoints: children, owners: merged.owners },
  };
}
