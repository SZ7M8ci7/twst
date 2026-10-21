import type { SearchInput, SearchResult } from './types';
import type { SessionCheckpoint } from './scheduler';
import { candidateSatisfiesConstraints } from '@/domain/examSearch/variants';

// Sanitize before the coordinator publishes restored island results, including
// when a resumed search is stopped before a child worker has initialized.
export function constrainCheckpoint(input: SearchInput, checkpoint: SessionCheckpoint,
  catalog?: Record<string, { chara?: string; rare?: string }>): SessionCheckpoint {
  const matches = (result: SearchResult) => candidateSatisfiesConstraints(input, result.candidate, catalog);
  const parallel = checkpoint.parallel;
  const children = parallel?.checkpoints.map(child => constrainCheckpoint(input, child, catalog));
  const validIds = new Set(children?.flatMap(child => child.finalists.map(result => result.candidate.id)));
  return {
    ...checkpoint,
    pool: checkpoint.pool.filter(matches),
    pending: checkpoint.pending.filter(matches),
    finalists: checkpoint.finalists.filter(matches),
    ...(parallel ? { parallel: { ...parallel, checkpoints: children!,
      owners: Object.fromEntries(Object.entries(parallel.owners).filter(([id]) => validIds.has(id))),
    } } : {}),
  };
}
