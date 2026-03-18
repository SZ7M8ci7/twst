export const MAX_TOTSU = 4;

export function clampTotsuCount(value: unknown): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 0;
  return Math.max(0, Math.min(MAX_TOTSU, Math.trunc(parsed)));
}

export function deriveTotsuCount(value: {
  totsu?: unknown;
  isLimitBreak?: unknown;
  isM3?: unknown;
} | null | undefined): number {
  if (!value) return 0;

  if (value.totsu !== undefined && value.totsu !== null && value.totsu !== '') {
    return clampTotsuCount(value.totsu);
  }

  if (value.isLimitBreak) {
    return MAX_TOTSU;
  }

  if (value.isM3) {
    return 3;
  }

  return 0;
}

export function isMaxLimitBreak(totsu: number): boolean {
  return clampTotsuCount(totsu) >= MAX_TOTSU;
}

export function isM3Unlocked(rare: string | undefined, totsu: number): boolean {
  return rare === 'SSR' && clampTotsuCount(totsu) >= 3;
}

export function isTotsuBuddyEnhanced(rare: string | undefined, totsu: number): boolean {
  return rare === 'SSR' && clampTotsuCount(totsu) >= 2;
}
