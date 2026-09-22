interface RecoverySummary {
  count: number;
  positiveScoreCount: number;
  retireReasonFrequencies: Record<string, number>;
}

/** Offer HP recovery only for completed, unsuccessful runs with a defeat. */
export function normalSimulationRecovery(summary: RecoverySummary | null, mode: string, running: boolean) {
  if (running || mode !== 'normal' || !summary?.count || summary.positiveScoreCount > 0) return null;
  return (summary.retireReasonFrequencies['敗北'] ?? 0) > 0 ? { defeat: true } : null;
}
