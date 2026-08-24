import { OPPONENT_WIDE_EFFECT, PARTY_WIDE_EFFECT } from '@/store/searchResult';

function splitEtcEffects(etcRaw: string): string[] {
  return (etcRaw || '')
    .replace(/<br\s*\/?>/g, ',')
    .split(',')
    .map(effect => effect.trim())
    .filter(Boolean);
}

export function hasPartyWideEffect(etcRaw: string): boolean {
  return splitEtcEffects(etcRaw).some(effect => effect.includes('味方全体'));
}

export function hasOpponentWideEffect(etcRaw: string): boolean {
  return splitEtcEffects(etcRaw).some(effect => effect.includes('相手全体'));
}

export function matchesSelectedEffect(etcRaw: string, effect: string): boolean {
  if (effect === PARTY_WIDE_EFFECT) {
    return hasPartyWideEffect(etcRaw);
  }
  if (effect === OPPONENT_WIDE_EFFECT) {
    return hasOpponentWideEffect(etcRaw);
  }
  if (effect === '呪い') {
    return (etcRaw || '').includes('呪い(');
  }
  return (etcRaw || '').includes(effect);
}

export function matchesAnySelectedEffect(etcRaw: string, effects: string[]): boolean {
  for (let i = 0; i < effects.length; i++) {
    if (matchesSelectedEffect(etcRaw, effects[i])) {
      return true;
    }
  }
  return false;
}

export function matchesSelectedBuddyBonusEffect(buddyStatus: string, effect: string): boolean {
  if (effect === 'HPUP') {
    return buddyStatus.includes('HPUP') || buddyStatus.includes('HP&ATKUP');
  }
  if (effect === '被ダメージDOWN') {
    return buddyStatus.split('&').some(status => status.startsWith('被ダメージDOWN'));
  }
  return buddyStatus.includes(effect);
}

export function matchesAnySelectedBuddyBonusEffect(
  character: {
    rare?: string;
    buddy1s_totsu?: string;
    buddy2s_totsu?: string;
    buddy3s_totsu?: string;
  },
  effects: string[],
): boolean {
  if (character.rare !== 'SSR') {
    return false;
  }

  const buddyStatuses = [
    character.buddy1s_totsu || '',
    character.buddy2s_totsu || '',
    character.buddy3s_totsu || '',
  ];

  return effects.some(effect =>
    buddyStatuses.some(status => matchesSelectedBuddyBonusEffect(status, effect))
  );
}
