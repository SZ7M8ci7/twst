import type { Detection } from './types';
import type { GroovyStatus } from './groovyRibbon';

/** Combine only ribbon evidence; artwork choice never indicates Groovy status. */
export function groovyStatesByCard(rows: Detection[]): Map<string, GroovyStatus> {
  const evidence = new Map<string, Set<GroovyStatus>>();
  for (const row of rows) {
    if (!row.selected) continue;
    const states = evidence.get(row.selected) ?? new Set<GroovyStatus>();
    states.add(row.groovyStatus ?? 'unknown');
    evidence.set(row.selected, states);
  }
  return new Map([...evidence].map(([key, states]): [string, GroovyStatus] => {
    const present = states.has('present'), absent = states.has('absent');
    // Conflicting screenshots cannot establish the card's current status.
    return [key, present === absent ? 'unknown' : present ? 'present' : 'absent'];
  }));
}
