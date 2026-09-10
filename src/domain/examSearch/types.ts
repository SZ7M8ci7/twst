import type { ExamPresetDefinition } from '@/utils/examPresets';
import type { WeightedObservation } from '@/domain/examSearch/importance';

export const MAX_ISLANDS = 6;

export type MagicSlot = 1 | 2 | 3;
export type PolicyKind = 'balanced' | 'reserve' | 'effects' | 'effects-reserve' | 'effects-score' | 'effects-public' | 'effects-tail' | 'effects-duo';
export interface RosterCard {
  name: string;
  level: number;
  totsu: number;
  magicLevels: [number, number, number];
  buddyLevels: [number, number, number];
  allowUpgrade: boolean;
}
export interface SearchCard extends RosterCard {
  originalTotsu: number;
  selectedMagic: [MagicSlot, MagicSlot];
  support: boolean;
}
export interface SearchInput {
  seedTeams?: string[][];
  /** Card catalog names that every generated/evaluated loadout must contain. */
  requiredCards?: string[];
  /** Character names that every generated/evaluated loadout must contain. */
  requiredCharacters?: string[];
  preset: ExamPresetDefinition;
  roster: RosterCard[];
  supports: RosterCard[];
  budget: number;
  itemsPerLimitBreak: number;
  target: number;
  attempts: number;
  desiredProbability: number;
  tolerance: number;
  challengeLocks: Record<string, 'on' | 'off' | 'auto'>;
  maxRemoved: 1 | 2;
}
export interface TaskPartition {
  islandIndex: number;
  islandCount: number;
}
export interface Candidate {
  id: string;
  cards: SearchCard[];
  challengeIds: string[];
  cost: number;
  policy: PolicyKind;
  estimate: number;
  preferredPlan?: [string, string][];
  preferredPlanMode?: 'turn' | 'priority' | 'flexible';
}
export interface Samples {
  scores: number[];
  retired: number;
  turns: number;
  fitnessSum?: number;
}
export interface SearchResult {
  candidate: Candidate;
  development: Samples;
  developmentBest?: { seed: string; score: number };
  // Hypothetical exploration only. Never include these scores in Samples.
  criticalScout?: { attempted: number; score: number; cardIndex?: number; magic?: MagicSlot; idealHand?: boolean; seed?:string; plan?: [string,string][] };
  // Importance sampling is development-only, never an ordinary sample count.
  importance?: { n:number; successWeight:number; observations?: WeightedObservation[]; upperScore:number };
  validation: Samples;
  validationTarget: number;
  validationBest?: { seed: string; score: number };
  // Display packets omit large trial arrays. Checkpoints always retain them.
  validationSummary?: { target:number; attempts:number; metrics:ScoreMetrics; scoreDistribution?: ScoreDistribution; auto?: { attempts:number; desiredProbability:number; metrics:AutoScoreMetrics } };
}
export interface ScoreMetrics { n:number; successes:number; p:number; reach:number; low:number; high:number; max:number }
export interface ScoreDistribution { n:number; max:number; p95:number|null }
export interface AutoScoreMetrics {
  n: number;
  retired: number;
  empiricalScore: number | null;
  conservativeScore: number | null;
  max: number;
}
export interface SearchProgress {
  phase: 'generate' | 'validate' | 'done' | 'stopped';
  generated: number;
  evaluated: number;
  tasksDone: number;
  tasksTotal: number;
  elapsedMs: number;
  results: SearchResult[];
}
export interface BattleEngine {
  prepare(input: SearchInput, candidate: Candidate): Promise<void>;
  trial(seed: string, policy: PolicyKind, log?: boolean): BattleTrial;
  scout?(seed: string, policy: PolicyKind, cardIndex: number, idealHand?: boolean, magic?: MagicSlot): BattleTrial & { forcedHits: number };
  scoutTargets?(): number[];
  importanceTrial?(seed:string,policy:PolicyKind):BattleTrial & {weight:number};
  replay?(seed: string, plan: [string, string][], log?: boolean): BattleTrial;
  learnPlan?(seed: string, durationMs: number): Promise<[string, string][] | null>;
  learnCriticalPlan?(seed:string,durationMs:number,cardIndex:number,idealHand?:boolean,magic?:MagicSlot):Promise<[string,string][]|null>;
}
export interface BattleTrial { score: number; retired: boolean; finishTurn: number; fitness?: number; log?: string[]; plan?: [string, string][] }
export const ENGINE_VERSION = 'exam-resource-search-135';
export const emptySamples = (): Samples => ({ scores: [], retired: 0, turns: 0 });
