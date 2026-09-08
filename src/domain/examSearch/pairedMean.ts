import { createPairingValue } from '@/domain/examSearch/policy';

export type PairedEffectKind = 'atk' | 'damage' | 'critical' | 'immunity' | 'cleanse';

export interface PairedEffect {
  kind: PairedEffectKind;
  value?: number;
  target?: 'self' | 'allySelected' | 'allyAll';
  attribute?: string;
  duration?: number;
}

export interface PairedSpell {
  id: string;
  owner: number;
  passiveImmune?: boolean;
  atkRate?: number;
  damageRate?: number;
  critical?: number;
  attribute?: string;
  effects?: readonly PairedEffect[];
}

export interface PairedSpellStats {
  atkRate: number;
  damageRate: number;
  critical: number;
}

const EFFECT_KINDS = new Set<PairedEffectKind>(['atk', 'damage', 'critical', 'immunity', 'cleanse']);

function numberOrZero(value: unknown): number {
  return Number.isFinite(Number(value)) ? Number(value) : 0;
}

function clampCritical(value: unknown): number {
  return Math.max(0, Math.min(1, numberOrZero(value)));
}

function targetOwners(source: PairedSpell, pair: readonly [PairedSpell, PairedSpell], target: PairedEffect['target']): number[] {
  if (target === 'self') return [source.owner];
  if (target === 'allySelected' || target === 'allyAll') return [...new Set(pair.map(spell => spell.owner))];
  return [];
}

function maxAttributeDamage(spell: PairedSpell, state: { attributeDamage: Map<string, number> }): number {
  return spell.attribute === undefined ? 0 : numberOrZero(state.attributeDamage.get(spell.attribute));
}

function statsForSpell(spell: PairedSpell, state: {
  atkRate: number;
  damageRate: number;
  critical: number;
  attributeDamage: Map<string, number>;
}): PairedSpellStats {
  return {
    atkRate: numberOrZero(spell.atkRate) + state.atkRate,
    damageRate: numberOrZero(spell.damageRate) + state.damageRate + maxAttributeDamage(spell, state),
    critical: clampCritical(numberOrZero(spell.critical) + state.critical),
  };
}

/**
 * Scores one ordered pair for the current turn. Effects are deliberately
 * scoped to the two selected spells; durations do not carry into another
 * pair or turn. This is a ranking approximation, not battle simulation.
 */
export function orderedPairMean(
  spells: readonly PairedSpell[],
  firstId: string,
  secondId: string,
  frozen: boolean,
  damageFor: (spell: PairedSpell, partner: PairedSpell, stats: PairedSpellStats) => number,
): number {
  if (!Array.isArray(spells) || typeof damageFor !== 'function') throw new TypeError('spells and damageFor are required');
  const first = spells.find(spell => spell.id === firstId);
  const second = spells.find(spell => spell.id === secondId);
  if (!first || !second || first.id === second.id) throw new Error('pair ids must select two distinct spells');
  const pair: [PairedSpell, PairedSpell] = [first, second];
  type OwnerState = {
    immune: boolean;
    cleansed: boolean;
    atkRate: number;
    damageRate: number;
    critical: number;
    attributeDamage: Map<string, number>;
  };
  const ownerStates = new Map<number, OwnerState>();
  for (const spell of pair) {
    let state = ownerStates.get(spell.owner);
    if (!state) {
      state = { immune: false, cleansed: false, atkRate: 0, damageRate: 0, critical: 0, attributeDamage: new Map() };
      ownerStates.set(spell.owner, state);
    }
    state.immune ||= spell.passiveImmune === true;
  }
  const isFrozen = (owner: number) => Boolean(frozen) && !ownerStates.get(owner)!.cleansed;

  for (const source of pair) {
    for (const effect of source.effects ?? []) {
      if (!effect || !EFFECT_KINDS.has(effect.kind)) continue;
      for (const owner of targetOwners(source, pair, effect.target)) {
        const state = ownerStates.get(owner);
        if (!state) continue;
        const alwaysAllowed = effect.kind === 'immunity' || effect.kind === 'cleanse';
        if (!alwaysAllowed && isFrozen(owner) && !state.immune) continue;
        if (effect.kind === 'immunity') state.immune = true;
        else if (effect.kind === 'cleanse') state.cleansed = true;
        else if (effect.kind === 'atk') state.atkRate += numberOrZero(effect.value);
        else if (effect.kind === 'critical') state.critical = clampCritical(state.critical + numberOrZero(effect.value));
        else if (effect.kind === 'damage') {
          const value = numberOrZero(effect.value);
          if (effect.attribute === undefined) state.damageRate += value;
          else state.attributeDamage.set(effect.attribute, numberOrZero(state.attributeDamage.get(effect.attribute)) + value);
        }
      }
    }
  }

  const firstStats = statsForSpell(first, ownerStates.get(first.owner)!);
  const secondStats = statsForSpell(second, ownerStates.get(second.owner)!);
  return numberOrZero(damageFor(first, second, firstStats)) + numberOrZero(damageFor(second, first, secondStats));
}

/** Returns the maximum ordered-pair mean over a disjoint full matching. */
export function maxPairedMean(
  spells: readonly PairedSpell[],
  frozen: boolean,
  damageFor: (spell: PairedSpell, partner: PairedSpell, stats: PairedSpellStats) => number,
): number {
  const ids = spells.map(spell => spell.id);
  const index = new Map(ids.map((id, position) => [id, position]));
  const values = ids.map(() => ids.map(() => 0));
  for (let first = 0; first < ids.length; first += 1) {
    for (let second = first + 1; second < ids.length; second += 1) {
      const value = Math.max(
        orderedPairMean(spells, ids[first], ids[second], frozen, damageFor),
        orderedPairMean(spells, ids[second], ids[first], frozen, damageFor),
      );
      values[first][second] = value;
      values[second][first] = value;
    }
  }
  return createPairingValue(ids, (firstId, secondId) => {
    const first = index.get(firstId);
    const second = index.get(secondId);
    return first === undefined || second === undefined ? 0 : values[first][second];
  })(ids);
}
