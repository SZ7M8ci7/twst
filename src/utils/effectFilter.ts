import { PARTY_WIDE_TWO_TURN_BUFF } from '@/store/searchResult';

const partyWideBuffPatterns = [
  'ATKUP',
  'ダメージUP',
  '属性ダメージUP',
  'クリティカル',
  'ダメージDOWN',
  '属性ダメージDOWN',
  '被ダメージDOWN',
  '回避',
  'HP回復',
  'HP継続回復',
  '暗闇無効',
  '呪い無効',
  '凍結無効',
  'デバフ解除',
];

function splitEtcEffects(etcRaw: string): string[] {
  return (etcRaw || '')
    .replace(/<br\s*\/?>/g, ',')
    .split(',')
    .map(effect => effect.trim())
    .filter(Boolean);
}

export function hasPartyWideTwoTurnBuff(etcRaw: string): boolean {
  return splitEtcEffects(etcRaw).some(effect =>
    effect.includes('味方全体/2T') &&
    partyWideBuffPatterns.some(pattern => effect.includes(pattern)) &&
    !effect.includes('被ダメージUP') &&
    !effect.includes('ATKDOWN') &&
    !effect.includes('呪い(')
  );
}

export function matchesSelectedEffect(etcRaw: string, effect: string): boolean {
  if (effect === PARTY_WIDE_TWO_TURN_BUFF) {
    return hasPartyWideTwoTurnBuff(etcRaw);
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
