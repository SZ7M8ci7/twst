import cards from '@/assets/chara.json';
import { createResourceBattleHost } from '@/workers/resourceBattleHost';
import { SearchSession, type SessionCheckpoint } from '@/domain/examSearch/scheduler';
import { validateInput } from '@/domain/examSearch/variants';
import type { SearchInput, Candidate } from '@/domain/examSearch/types';
import { displayProgress } from '@/domain/examSearch/statistics';
import { runSessionWithinBudget } from './examSearchRun';

const catalog = Object.fromEntries(cards.map(c => [c.name, c]));
// Invalidate persisted statistics whenever source combat data changes.
const catalogVersion = JSON.stringify(cards).split('').reduce((hash, c) => Math.imul(hash ^ c.charCodeAt(0), 16777619), 2166136261).toString(16);

export type IslandRequest = { method: 'start'; id: number; island: number; islandCount: number; input: SearchInput; durationMs: number; deadline?: number; nonce: string; serialize?: boolean }
  | { method: 'resume' | 'evaluate'; id: number; island: number; durationMs: number; deadline?: number; input?: SearchInput; checkpoint?: SessionCheckpoint; catalogVersion?: string; candidateId?: string; nonce?: string; serialize?: boolean }
  | { method: 'stop'; id: number }
  | { method: 'preview'; id: number; island: number; input: SearchInput; candidate: Candidate; best?: {seed:string;score:number} };

export type IslandMessage = { id: number; island: number; progress?: ReturnType<typeof displayProgress>; checkpoint?: SessionCheckpoint; catalogVersion?: string; preview?: unknown; error?: string; diagnostic?: { stack?: string } };

export function createIslandRuntime(emit: (message: IslandMessage) => void) {
  let session: SearchSession | null = null;
  let active = false;
  let stopRequested = false;
  let engine: ReturnType<typeof createResourceBattleHost> | undefined;

  async function handle(data: IslandRequest, initiallyStopped = false) {
    if (data.method === 'stop') { stopRequested = true; session?.stop(); return; }
    if (active) return;
    active = true;
    stopRequested = initiallyStopped;
    try {
      engine ??= createResourceBattleHost();
      if (data.method === 'preview') {
        await engine.prepare(data.input, data.candidate);
        const result = engine.trial(data.best?.seed ?? `preview:${Date.now()}`, data.candidate.policy, true);
        if (data.best && result.score !== data.best.score) throw new Error('Saved best trial no longer reproduces; start a new search.');
        emit({ id: data.id, island: data.island, preview: result });
        return;
      }
      if (data.method === 'start') {
        const issue = validateInput(data.input, catalog);
        if (issue) throw new Error(issue);
        session = new SearchSession(data.input, catalog, engine, data.nonce, undefined,
          { islandIndex: data.island, islandCount: data.islandCount });
      }
      if ((data.method === 'resume' || data.method === 'evaluate') && !session && data.input && data.checkpoint) {
        if (data.catalogVersion !== catalogVersion) throw new Error('Saved card data changed; start a new search.');
        const issue = validateInput(data.input, catalog);
        if (issue) throw new Error(issue);
        session = new SearchSession(data.input, catalog, engine, data.nonce ?? data.checkpoint.nonce, data.checkpoint);
      }
      if (!session) throw new Error('session');
      if (data.method === 'evaluate') session.refineValidation(data.candidateId ?? '');
      const deadline = data.deadline ?? Date.now() + Math.max(0, Math.min(180000, data.durationMs));
      await runSessionWithinBudget(session, deadline, progress => emit({ id: data.id, island: data.island,
        progress: displayProgress(progress, session!.input.target, session!.input.attempts, session!.input.desiredProbability) }), {
        allowRepeat: data.method === 'start' || data.method === 'resume',
        shouldStop: () => stopRequested,
      });
      const checkpoint = session.checkpoint();
      emit({ id: data.id, island: data.island, checkpoint, catalogVersion });
    } catch (error) {
      emit({ id: data.id, island: data.island, error: error instanceof Error ? error.message : String(error), diagnostic: { stack: error instanceof Error ? error.stack : undefined } });
    } finally { active = false; }
  }

  return {
    handle,
    stop() { stopRequested = true; session?.stop(); },
  };
}
