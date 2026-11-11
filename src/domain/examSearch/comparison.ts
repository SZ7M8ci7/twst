import type { BattleEngine, Candidate, Samples, SearchInput } from './types';
import { emptySamples } from './types';
import { alternatePolicyCandidates, jointSpellCandidates } from './variants';
import { rankedResults, searchDevelopmentQuality } from './statistics';
import { COMPARISON_EVALUATION_SAMPLES, MAX_COMPARISON_EVALUATION_SAMPLES, DISCOVERY_SAMPLES, VALIDATION_SAMPLES, MAX_FINALISTS, MAX_COMPARISON_ENTRIES } from './sampling';
import { getMaxLevelAtLimitBreak } from '@/constants/levels';
import { isM3Unlocked } from '@/utils/totsu';
import { yieldToHost } from '@/utils/yieldToHost';

export interface ComparisonEntry { id: string; label: string; candidate: Candidate; sourceId?: string }
export interface ComparisonResult { id: string; candidate: Candidate; samples: Samples; best?: { seed: string; score: number }; searched: number }
export interface ComparisonProgress { index: number; phase: 'search' | 'refine' | 'validate'; done: number; total: number }
export interface ComparisonRequest { input: SearchInput; entries: ComparisonEntry[]; nonce: string; evaluationSamples?: number }
export class ComparisonError extends Error {
  constructor(public readonly code: 'cards' | 'training' | 'trials' | 'settings', message: string) {
    super(message);
    this.name = 'ComparisonError';
  }
}
type Catalog = Record<string, { rare: string }>;
const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value));

/** Comparison owns its copies; neither the source result nor the collection is edited. */
export function comparisonCandidate(entry: ComparisonEntry, catalog: Catalog): Candidate {
  const candidate = clone(entry.candidate);
  if (candidate.cards.length !== 5) throw new ComparisonError('cards', '比較する編成は5枚必要です。');
  candidate.cards.forEach(card => {
    const rare = catalog[card.name]?.rare;
    if (!rare || !Number.isInteger(card.totsu) || card.totsu < 0 || card.totsu > 4
      || !Number.isInteger(card.level) || card.level < 1 || card.level > getMaxLevelAtLimitBreak(rare, card.totsu))
      throw new ComparisonError('training', '凸数・レベルを確認してください。');
    card.originalTotsu = card.totsu;
    card.additionalLevels = 0;
    card.allowUpgrade = false;
    if (!isM3Unlocked(rare, card.totsu)) card.selectedMagic = [1, 2];
  });
  // A changed loadout must not carry an illegal M3 instruction into the engine.
  if (candidate.preferredPlan?.some(pair => pair.some(id => {
    const match = /^(\d+)-M([123])$/.exec(id);
    return !match || !candidate.cards[Number(match[1])]?.selectedMagic.includes(Number(match[2]) as 1 | 2 | 3);
  }))) { candidate.preferredPlan = undefined; candidate.preferredPlanMode = undefined; }
  candidate.cost = 0;
  return candidate;
}

export function comparisonSummary(samples: Samples) {
  const sorted = samples.scores.map(s => Number.isFinite(s) && s > 0 ? s : 0).sort((a, b) => a - b);
  const n = sorted.length;
  return { n,
    mean: n ? sorted.reduce((a, b) => a + b, 0) / n : 0,
    median: n ? (sorted[Math.floor((n - 1) / 2)] + sorted[Math.floor(n / 2)]) / 2 : 0,
    p95: n ? sorted[Math.ceil(n * .95) - 1] : 0, max: sorted[n - 1] ?? 0,
    retired: n ? samples.retired / n : 0 };
}

/** Display only positive scores, without changing the trial denominators. */
export function comparisonScoreRange(results: ComparisonResult[]) {
  let min = Infinity, max = 0;
  for (const result of results) for (const score of result.samples.scores) {
    if (Number.isFinite(score) && score > 0) { min = Math.min(min, score); max = Math.max(max, score); }
  }
  return max > 0 ? { min, max } : null;
}

/** Shared positive-score bins; percentages still include all trials. */
export function comparisonHistogram(results: ComparisonResult[], bins = 20) {
  const range = comparisonScoreRange(results);
  if (!range) return { width: 1, labels: [], values: results.map(() => [] as number[]) };
  const { min, max } = range;
  const width = Math.max(1, Math.ceil((max - min + 1) / bins));
  return { width, labels: Array.from({ length: bins }, (_, i) => `${(min + i * width).toLocaleString()}–${(min + (i + 1) * width - 1).toLocaleString()}`),
    values: results.map(result => {
      const counts = Array<number>(bins).fill(0);
      result.samples.scores.forEach(score => {
        if (Number.isFinite(score) && score > 0) counts[Math.min(bins - 1, Math.floor((score - min) / width))]++;
      });
      return counts.map(n => result.samples.scores.length ? n / result.samples.scores.length * 100 : 0);
    }) };
}

/** Re-search spells/policies at fixed training, then freeze the winner before fresh evaluation. */
export async function runComparison(request: ComparisonRequest, catalog: Catalog, engine: BattleEngine,
  publish: (progress: ComparisonProgress) => void, complete: (result: ComparisonResult) => void,
  stopped: () => boolean = () => false): Promise<void> {
  const evaluationSamples = request.evaluationSamples ?? COMPARISON_EVALUATION_SAMPLES;
  if (!Number.isInteger(evaluationSamples) || evaluationSamples < 1 || evaluationSamples > MAX_COMPARISON_EVALUATION_SAMPLES)
    throw new ComparisonError('trials', `試行回数は1〜${MAX_COMPARISON_EVALUATION_SAMPLES.toLocaleString()}回で指定してください。`);
  if (request.entries.length < 1 || request.entries.length > MAX_COMPARISON_ENTRIES
    || !Number.isInteger(request.input.attempts) || request.input.attempts < 1 || request.input.attempts > 100000
    || !Number.isFinite(request.input.desiredProbability) || request.input.desiredProbability <= 0 || request.input.desiredProbability >= 1)
    throw new ComparisonError('settings', '比較条件を確認してください。');
  // Validate every entry before running any team.
  const parents = request.entries.map(entry => comparisonCandidate(entry, catalog));
  // Exam conditions are shared. Do not carry per-result challenge variations
  // into a comparison of training/composition under the current conditions.
  const challengeIds = (request.input.preset.specialChallenges ?? [])
    .filter(challenge => request.input.challengeLocks[challenge.id] !== 'off').map(challenge => challenge.id);
  parents.forEach(parent => { parent.challengeIds = [...challengeIds]; });
  for (const [index, entry] of request.entries.entries()) {
    if (stopped()) return;
    const parent = parents[index];
    const input: SearchInput = { ...clone(request.input), budget: 0, additionalLevelCap: 0,
      roster: parent.cards.filter(c => !c.support).map(c => clone(c)), supports: parent.cards.filter(c => c.support).map(c => clone(c)) };
    const loadouts = [parent, ...jointSpellCandidates(input, parent, catalog)];
    // Include a fresh policy for the original spells even if the source has a learned plan.
    const candidates = loadouts.flatMap(candidate => [candidate,
      ...(candidate.preferredPlan ? [{ ...candidate, preferredPlan: undefined, preferredPlanMode: undefined }] : []),
      ...alternatePolicyCandidates(input, candidate)]);
    type Ranked = { candidate: Candidate; samples: Samples };
    const rank = (a: Ranked, b: Ranked) => searchDevelopmentQuality(b.samples, input) - searchDevelopmentQuality(a.samples, input);
    const finalists: Ranked[] = [];
    for (const [candidateIndex, candidate] of candidates.entries()) {
      if (stopped()) return;
      await engine.prepare(input, candidate);
      const samples = emptySamples();
      for (let n = 0; n < DISCOVERY_SAMPLES; n++) {
        const trial = engine.trial(`${request.nonce}:discovery:${n}`, candidate.policy);
        samples.scores.push(trial.retired ? 0 : trial.score);
        samples.fitnessSum = (samples.fitnessSum ?? 0) + (trial.fitness ?? trial.score);
      }
      finalists.push({ candidate, samples }); finalists.sort(rank); finalists.splice(MAX_FINALISTS);
      if (candidateIndex % 4 === 0 || candidateIndex === candidates.length - 1) {
        publish({ index, phase: 'search', done: candidateIndex + 1, total: candidates.length }); await yieldToHost();
      }
    }
    for (const [candidateIndex, finalist] of finalists.entries()) {
      if (stopped()) return;
      await engine.prepare(input, finalist.candidate);
      finalist.samples = emptySamples();
      for (let n = 0; n < VALIDATION_SAMPLES; n++) {
        if (n % 32 === 0) { await yieldToHost(); if (stopped()) return; }
        const trial = engine.trial(`${request.nonce}:refine:${n}`, finalist.candidate.policy);
        finalist.samples.scores.push(trial.retired ? 0 : trial.score);
      }
      publish({ index, phase: 'refine', done: candidateIndex + 1, total: finalists.length });
    }
    const candidate = rankedResults(finalists.map(finalist => ({ candidate: finalist.candidate,
      development: emptySamples(), validation: finalist.samples, validationTarget: VALIDATION_SAMPLES })),
      input.target, input.attempts, input.desiredProbability)[0].candidate;
    await engine.prepare(input, candidate);
    const result: ComparisonResult = { id: entry.id, candidate, samples: emptySamples(), searched: candidates.length };
    for (let n = 0; n < evaluationSamples; n++) {
      if (n % 32 === 0) {
        publish({ index, phase: 'validate', done: n, total: evaluationSamples }); await yieldToHost(); if (stopped()) return;
      }
      // Identical evaluation seeds for all teams; never reused in selection.
      const seed = `${request.nonce}:evaluation:${n}`, trial = engine.trial(seed, candidate.policy);
      const score = trial.retired ? 0 : trial.score;
      result.samples.scores.push(score); result.samples.retired += Number(trial.retired); result.samples.turns += trial.finishTurn;
      if (!result.best || score > result.best.score) result.best = { seed, score };
    }
    publish({ index, phase: 'validate', done: evaluationSamples, total: evaluationSamples });
    complete(result);
  }
}
