import type { SearchProgress } from '@/domain/examSearch/types';

export interface SessionRunner {
  run(durationMs: number, publish: (progress: SearchProgress) => void): Promise<void>;
}

export interface RunSessionOptions {
  now?: () => number;
  shouldStop?: () => boolean;
  allowRepeat?: boolean;
  minimumRemainingMs?: number;
}

export interface RunSessionResult {
  passes: number;
}

/** Run search passes inside one absolute deadline, continuing only while useful work progresses. */
export async function runSessionWithinBudget(
  session: SessionRunner,
  deadline: number,
  publish: (progress: SearchProgress) => void,
  options: RunSessionOptions = {},
): Promise<RunSessionResult> {
  const now = options.now ?? Date.now;
  const shouldStop = options.shouldStop ?? (() => false);
  const allowRepeat = options.allowRepeat ?? false;
  const configuredMinimum = options.minimumRemainingMs ?? 15_000;
  const minimumRemainingMs = Number.isFinite(configuredMinimum) && configuredMinimum > 0
    ? configuredMinimum : 15_000;
  const initialRemaining = Math.max(0, deadline - now());
  const maxPasses = Number.isFinite(initialRemaining)
    ? Math.max(1, Math.ceil(initialRemaining / minimumRemainingMs)) : 1;
  let passes = 0;
  let pendingTerminal: SearchProgress | undefined;
  let previousTerminal: { generated: number; evaluated: number } | undefined;

  while (passes < maxPasses) {
    const remaining = Math.max(0, deadline - now());
    if (!remaining || shouldStop()) {
      if (pendingTerminal) publish(pendingTerminal);
      break;
    }
    if (pendingTerminal) {
      if (remaining < minimumRemainingMs) {
        publish(pendingTerminal);
        break;
      }
      pendingTerminal = undefined;
    }
    let terminal: SearchProgress | undefined;
    await session.run(remaining, progress => {
      if (progress.phase === 'done' || progress.phase === 'stopped') terminal = progress;
      else publish(progress);
    });
    passes += 1;

    const progressed = !previousTerminal || !terminal
      || terminal.generated > previousTerminal.generated
      || terminal.evaluated > previousTerminal.evaluated;
    const canRepeat = passes === 1 || progressed;
    previousTerminal = terminal
      ? { generated: terminal.generated, evaluated: terminal.evaluated } : undefined;
    if (allowRepeat && terminal?.phase === 'done' && canRepeat
      && passes < maxPasses && !shouldStop() && deadline - now() >= minimumRemainingMs) {
      // Do not expose an intermediate done state while the continuation is eligible.
      pendingTerminal = terminal;
      publish({ ...terminal, phase: 'generate' });
      if (shouldStop() || deadline - now() < minimumRemainingMs) {
        publish(pendingTerminal);
        pendingTerminal = undefined;
        break;
      }
      continue;
    }
    if (terminal) publish(terminal);
    break;
  }
  return { passes };
}
