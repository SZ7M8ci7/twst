import cards from '@/assets/chara.json';
import { validateInput, candidateIncludesRequired } from '@/domain/examSearch/variants';
import { constrainCheckpoint } from '@/domain/examSearch/requiredCheckpoint';
import { createParallelCheckpoint, aggregateIslandProgress, chooseIslandCount, mergeIslandResults } from '@/domain/examSearch/islands';
import type { SearchInput, Candidate, SearchProgress } from '@/domain/examSearch/types';
import { ENGINE_VERSION, MAX_ISLANDS } from '@/domain/examSearch/types';
import { serializeSearchSession } from '@/storage/examSearchStorage';
import type { SessionCheckpoint } from '@/domain/examSearch/scheduler';
import { displayProgress } from '@/domain/examSearch/statistics';

const catalog = Object.fromEntries(cards.map(c => [c.name, c]));
const catalogVersion = JSON.stringify(cards).split('').reduce((hash, c) => Math.imul(hash ^ c.charCodeAt(0), 16777619), 2166136261).toString(16);
type ParallelCheckpoint = SessionCheckpoint & { parallel?: { baseNonce: string; checkpoints: SessionCheckpoint[]; owners: Record<string, number> } };
type Request = { method: 'start'; id: number; input: SearchInput; durationMs: number }
  | { method: 'resume' | 'evaluate'; id: number; durationMs: number; input?: SearchInput; checkpoint?: ParallelCheckpoint; catalogVersion?: string; candidateId?: string }
  | { method: 'stop'; id: number }
  | { method: 'preview'; id: number; input: SearchInput; candidate: Candidate; best?: {seed:string;score:number} };
type ChildRequest = { method: 'start'; id: number; island: number; islandCount: number; input: SearchInput; durationMs: number; deadline: number; nonce: string; serialize: false }
  | { method: 'resume' | 'evaluate'; id: number; island: number; durationMs: number; deadline: number; input: SearchInput; checkpoint: SessionCheckpoint; catalogVersion: string; serialize: false; candidateId?: string; nonce?: string }
  | { method: 'stop'; id: number }
  | { method: 'preview'; id: number; island: number; input: SearchInput; candidate: Candidate; best?: {seed:string;score:number} };
type ChildOperationRequest = Exclude<ChildRequest, { method: 'stop' }>;
type ChildMessage = { id: number; island: number; progress?: SearchProgress; checkpoint?: SessionCheckpoint; catalogVersion?: string; preview?: unknown; error?: string; diagnostic?: { stack?: string };
  boot?: { stage: 'loading' | 'loaded'; url: string }; bootstrapError?: { message: string; stack?: string; url: string;
    diagnostic?: { bootstrapUrl?: string; runtimeSpecifier?: string; failedUrl?: string; resources?: Array<{ name: string; responseStatus: number | null; duration: number }> } } };
type Child = { worker?: Pick<Worker, 'postMessage' | 'terminate'>; island: number; finished: boolean; validMessageSeen: boolean; retryCount: number;
  originalRequest?: ChildOperationRequest; bootstrapStage?: 'loading' | 'loaded'; bootstrapUrl?: string };
type Operation = {
  id: number; method: Request['method']; input: SearchInput; startedAt: number; deadline: number; baseElapsed: number; baseNonce: string;
  children: Child[]; checkpoints: Array<SessionCheckpoint | undefined>; progresses: Array<SearchProgress | undefined>;
  owners: Record<string, number>; required: Set<number>; stopping: boolean;
};

let operation: Operation | null = null;
let requestActive = false;
let childRequest = 0;

function checkpointProgress(checkpoint: SessionCheckpoint, input: SearchInput): SearchProgress {
  const finalists=checkpoint.finalists.filter(result=>candidateIncludesRequired(input,result.candidate,catalog));
  return displayProgress({ phase: 'done', generated: checkpoint.seen.length, evaluated: checkpoint.evaluatedCount ?? checkpoint.pool.length,
    tasksDone: checkpoint.cursor, tasksTotal: checkpoint.tasksTotal ?? checkpoint.cursor, elapsedMs: checkpoint.elapsed, results: finalists }, input.target, input.attempts, input.desiredProbability);
}
function postAggregate(op: Operation, finalPhase?: 'done' | 'stopped') {
  const merged = aggregateIslandProgress(op.progresses, op.owners);
  op.owners = merged.owners;
  const progress = { ...merged.progress, elapsedMs: op.baseElapsed + Math.max(0, Date.now() - op.startedAt), ...(finalPhase ? { phase: finalPhase } : {}) };
  self.postMessage({ id: op.id, progress });
}
function stopChildren(op: Operation) {
  for (const child of op.children) {
    if (!child.finished) child.worker?.postMessage({ method: 'stop', id: ++childRequest } satisfies ChildRequest);
  }
}
function terminateChildren(op: Operation) {
  for (const child of op.children) {
    child.worker?.terminate();
  }
}
function failOperation(op: Operation, message: string, diagnostic?: unknown) {
  if (operation !== op) return;
  stopChildren(op); terminateChildren(op); operation = null; requestActive = false;
  self.postMessage({ id: op.id, error: message, ...(diagnostic ? { diagnostic } : {}) });
}
function handleChild(op: Operation, child: Child, data: ChildMessage) {
  if (operation !== op || data.id !== op.id || data.island !== child.island) return;
  if (data.boot) {
    child.bootstrapStage = data.boot.stage;
    child.bootstrapUrl = data.boot.url;
    return;
  }
  if (data.bootstrapError) {
    failOperation(op, startupFailureMessage(child, {
      message: data.bootstrapError.message,
    }), data.bootstrapError.diagnostic);
    return;
  }
  if (data.error || data.progress || data.checkpoint || data.preview !== undefined) child.validMessageSeen = true;
  if (data.error) { failOperation(op, data.error, data.diagnostic); return; }
  if (data.preview !== undefined) {
    self.postMessage({ id: op.id, preview: data.preview }); child.finished = true; child.worker?.terminate(); operation = null; requestActive = false; return;
  }
  if (data.progress) { op.progresses[child.island] = data.progress; postAggregate(op); }
  if (!data.checkpoint) return;
  op.checkpoints[child.island] = data.checkpoint; child.finished = true;
  if (![...op.required].every(index => op.children.find(c => c.island === index)?.finished)) return;
  const checkpoints = op.checkpoints
    .filter((checkpoint): checkpoint is SessionCheckpoint => !!checkpoint)
    .map(checkpoint => ({ ...checkpoint,
      pool: checkpoint.pool.filter(result=>candidateIncludesRequired(op.input,result.candidate,catalog)),
      finalists: checkpoint.finalists.filter(result=>candidateIncludesRequired(op.input,result.candidate,catalog)),
      pending: checkpoint.pending.filter(result=>candidateIncludesRequired(op.input,result.candidate,catalog)),
    }));
  const merged = mergeIslandResults(checkpoints.map(checkpoint => checkpoint.finalists
    .filter(result=>candidateIncludesRequired(op.input,result.candidate,catalog))), op.owners);
  op.owners = merged.owners;
  const checkpoint = createParallelCheckpoint(checkpoints, op.baseNonce, op.owners, op.baseElapsed + Date.now() - op.startedAt) as ParallelCheckpoint;
  checkpoint.finalists = merged.results;
  const serializedSession = serializeSearchSession({ input: op.input, checkpoint, catalogVersion, version: ENGINE_VERSION });
  postAggregate(op, op.stopping ? 'stopped' : 'done');
  self.postMessage({ id: op.id, checkpoint, catalogVersion, serializedSession });
  terminateChildren(op); operation = null; requestActive = false;
}
function startupFailureMessage(child: Child, event: { message?: string }) {
  const details = event.message ? `: ${event.message}` : '';
  const phase = child.validMessageSeen ? 'during execution' : 'during startup';
  return `Search island ${child.island} failed ${phase}${details}.`;
}
function spawnChild(op: Operation, child: Child) {
  if (typeof Worker === 'undefined') return spawnInlineChild(op, child);
  const worker = new Worker(new URL('./examSearchIsland.worker.ts', import.meta.url), { type: 'module' });
  child.worker = worker;
  worker.onmessage = ({ data: message }: MessageEvent<ChildMessage>) => {
    if (operation !== op || child.worker !== worker) return;
    handleChild(op, child, message);
  };
  worker.onerror = event => {
    event.preventDefault?.();
    if (operation !== op || child.worker !== worker || child.finished) return;
    const canRetry = !child.validMessageSeen && child.retryCount < 1 && !op.stopping
      && Date.now() < op.deadline && !!child.originalRequest;
    if (canRetry) {
      child.retryCount++;
      worker.terminate();
      try {
        const retryWorker = spawnChild(op, child);
        retryWorker.postMessage(child.originalRequest!);
      } catch (retryError) {
        failOperation(op, startupFailureMessage(child, retryError instanceof Error ? retryError : event));
      }
      return;
    }
    failOperation(op, startupFailureMessage(child, event));
  };
  return worker;
}
// Older Safari exposes Worker on the page, but not inside a dedicated worker.
// Keep the same runtime and message boundaries inside this background worker.
function spawnInlineChild(op: Operation, child: Child) {
  let runtime: ReturnType<typeof import('./examSearchIslandRuntime')['createIslandRuntime']> | undefined;
  let terminated = false, pending = false, stopRequested = false;
  const worker = {
    postMessage(message: ChildRequest) {
      if (terminated) return;
      if (message.method === 'stop') { stopRequested = true; runtime?.stop(); return; }
      if (pending) return;
      pending = true;
      const request = structuredClone(message);
      void import('./examSearchIslandRuntime').then(module => {
        if (terminated) return;
        runtime ??= module.createIslandRuntime(data => {
          if (!terminated && operation === op && child.worker === worker) handleChild(op, child, structuredClone(data));
        });
        return runtime.handle(request, stopRequested);
      }).catch(error => {
        if (!terminated) failOperation(op, startupFailureMessage(child, error instanceof Error ? error : { message: String(error) }));
      }).finally(() => { pending = false; });
    },
    terminate() { terminated = true; stopRequested = true; runtime?.stop(); },
  };
  child.worker = worker;
  return worker;
}
function sendChildRequest(child: Child, request: ChildOperationRequest) {
  child.originalRequest = request;
  child.worker?.postMessage(request);
}
function makeOperation(data: Request, checkpoints: SessionCheckpoint[], owners: Record<string, number>, baseNonce: string, count: number,
  activeIslands = Array.from({ length: count }, (_, island) => island), baseElapsedOverride?: number): Operation {
  const startedAt = Date.now(), requestedMs = 'durationMs' in data ? data.durationMs : 180000;
  const totalMs = Math.max(0, Math.min(180000, requestedMs));
  const reserveMs = count > 3 ? Math.min(8000, totalMs * 0.05) : Math.min(4000, totalMs * 0.025);
  const deadline = startedAt + totalMs - reserveMs;
  const input = 'input' in data && data.input ? data.input : ({} as SearchInput);
  const baseElapsed = baseElapsedOverride ?? (checkpoints.length ? Math.max(...checkpoints.map(checkpoint => checkpoint.elapsed ?? 0)) : 0);
  const progresses = Array.from({ length: count }, (_, island) => checkpoints[island] ? checkpointProgress(checkpoints[island]!, input) :
    { phase: 'generate' as const, generated: 0, evaluated: 0, tasksDone: 0, tasksTotal: 0, elapsedMs: 0, results: [] });
  const children: Child[] = Array.from({ length: count }, (_, island) => ({ worker: undefined, island,
    finished: !activeIslands.includes(island), validMessageSeen: false, retryCount: 0 }));
  const op: Operation = { id: data.id, method: data.method, input, startedAt, deadline, baseElapsed, baseNonce,
    children, checkpoints: Array.from({ length: count }, (_, i) => checkpoints[i]), progresses: Array.from({ length: count }, (_, i) => progresses[i]),
    owners: { ...owners }, required: new Set<number>(), stopping: false };
  try {
    for (const child of children) {
      if (child.finished) continue;
      spawnChild(op, child);
    }
  } catch (error) {
    terminateChildren(op);
    throw error;
  }
  return op;
}
type SearchRequest = Extract<Request, { method: 'start' }>
  | Extract<Request, { method: 'resume' | 'evaluate' }>;
function sendOperation(op: Operation, data: SearchRequest, checkpoints: SessionCheckpoint[]) {
  for (const child of op.children) {
    if (child.finished || !child.worker) continue;
    const island = child.island; op.required.add(island);
    if (data.method === 'start') {
      sendChildRequest(child, { method: 'start', id: op.id, island, islandCount: op.children.length, input: data.input, durationMs: data.durationMs, deadline: op.deadline,
        nonce: `${op.baseNonce}:island:${island}`, serialize: false });
    } else {
      const checkpoint = checkpoints[island];
      if (!checkpoint) { failOperation(op, 'Saved island checkpoint is missing.'); return; }
      sendChildRequest(child, { method: data.method, id: op.id, island, input: data.input!, durationMs: data.durationMs, deadline: op.deadline,
        checkpoint, catalogVersion: data.catalogVersion ?? catalogVersion, serialize: false, candidateId: data.candidateId,
        nonce: checkpoint.nonce });
    }
  }
}
function startSearch(data: Extract<Request,{method:'start'}>) {
  const issue = validateInput(data.input, catalog); if (issue) throw new Error(issue);
  const cores = globalThis.navigator?.hardwareConcurrency, memory = (globalThis.navigator as Navigator & { deviceMemory?: number })?.deviceMemory;
  const count = typeof Worker === 'undefined' ? 1 : chooseIslandCount(cores, memory), baseNonce = `${Date.now()}:${Math.random()}`;
  operation = makeOperation(data, [], {}, baseNonce, count); sendOperation(operation, data, []);
}
function resumeSearch(data: Extract<Request,{method:'resume'|'evaluate'}>) {
  if (!data.input || !data.checkpoint) throw new Error('session');
  if (data.catalogVersion !== catalogVersion) throw new Error('Saved card data changed; start a new search.');
  const issue = validateInput(data.input, catalog); if (issue) throw new Error(issue);
  data.checkpoint = constrainCheckpoint(data.input, data.checkpoint, catalog);
  const parallel = data.checkpoint.parallel;
  const checkpoints = parallel?.checkpoints?.length ? parallel.checkpoints : [data.checkpoint];
  if (checkpoints.length < 1 || checkpoints.length > MAX_ISLANDS || checkpoints.some(checkpoint => !checkpoint || !Array.isArray(checkpoint.finalists)))
    throw new Error('Saved island checkpoint is invalid; start a new search.');
  let owners = parallel?.owners ?? {};
  const baseNonce = parallel?.baseNonce ?? data.checkpoint.nonce;
  if (data.method === 'evaluate') {
    const candidateId = data.candidateId ?? '';
    let island = owners[candidateId];
    if (island === undefined) island = mergeIslandResults(checkpoints.map(checkpoint => checkpoint.finalists), owners).owners[candidateId];
    if (island === undefined || !Number.isInteger(island) || island < 0 || island >= checkpoints.length)
      throw new Error('Candidate owner island is missing.');
    owners = { ...owners, [candidateId]: island };
    operation = makeOperation(data, checkpoints, owners, baseNonce, checkpoints.length, [island], data.checkpoint.elapsed);
    const child = operation.children.find(c => c.island === island);
    if (!child || !child.worker || !checkpoints[island]) throw new Error('Candidate owner island is missing.');
    operation.required = new Set([island]);
    sendChildRequest(child, { method: 'evaluate', id: operation.id, island, input: data.input, durationMs: data.durationMs, deadline: operation.deadline,
      checkpoint: checkpoints[island], catalogVersion, serialize: false, candidateId: data.candidateId, nonce: checkpoints[island].nonce });
  } else {
    operation = makeOperation(data, checkpoints, owners, baseNonce, checkpoints.length, undefined, data.checkpoint.elapsed);
    sendOperation(operation, data, checkpoints);
  }
}
function previewSearch(data: Extract<Request,{method:'preview'}>) {
  if (!candidateIncludesRequired(data.input,data.candidate,catalog)) throw new Error('Candidate does not contain every required card or character.');
  const op = makeOperation(data, [], {}, `${Date.now()}:preview`, 1); operation = op; op.required = new Set([0]);
  const child = op.children[0];
  if (!child?.worker) throw new Error('Search island is unavailable.');
  sendChildRequest(child, { method: 'preview', id: op.id, island: 0, input: data.input, candidate: data.candidate, best: data.best });
}

self.onmessage = ({ data }: MessageEvent<Request>) => {
  if (data.method === 'stop') { if (operation) { operation.stopping = true; stopChildren(operation); } return; }
  if (requestActive) return;
  requestActive = true;
  try {
    if (data.method === 'start') startSearch(data);
    else if (data.method === 'preview') previewSearch(data);
    else resumeSearch(data);
  } catch (error) {
    if (operation) { terminateChildren(operation); operation = null; }
    requestActive = false;
    self.postMessage({ id: data.id, error: error instanceof Error ? error.message : String(error) });
  }
};
