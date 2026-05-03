import { isM3Unlocked, isTotsuBuddyEnhanced } from '@/utils/totsu';

export type BuddyAttribute = '火' | '水' | '木' | '無';

export type BuddyGeneratedBuff = {
  magicOption: 'M1' | 'M2' | 'M3';
  buffOption: 'ダメージUP' | '属性ダメUP' | 'クリティカル' | '継続回復';
  powerOption: string;
  levelOption: number;
  attributeOption?: BuddyAttribute;
  isBuddyGenerated: true;
  buddyIndex: number;
  status: string;
};

export type BuddyGeneratedBuffOverrides = Record<string, Partial<Pick<BuddyGeneratedBuff, 'powerOption' | 'levelOption'>>>;

export type BuddyStatusSummary = {
  hpRate: number;
  atkRate: number;
  damageRate: number;
  criticalMultiplier: number;
  continueHealRate: number;
  attributeDamageRates: Partial<Record<BuddyAttribute, number>>;
};

const buddyHpBaseMap: Record<string, { base: number; perLevel: number }> = {
  'HPUP(小)': { base: 0.1, perLevel: 0.01 },
  'HPUP(中)': { base: 0.2, perLevel: 0.01 },
  'HPUP(大)': { base: 0.3, perLevel: 0.01 },
  'HP&ATKUP(小)': { base: 0.1, perLevel: 0.01 },
  'HP&ATKUP(中)': { base: 0.2, perLevel: 0.01 },
  'HP&ATKUP(大)': { base: 0.3, perLevel: 0.01 },
};

const buddyAtkBaseMap: Record<string, { base: number; perLevel: number }> = {
  'ATKUP(小)': { base: 0.1, perLevel: 0.01 },
  'ATKUP(中)': { base: 0.2, perLevel: 0.015 },
  'ATKUP(大)': { base: 0.35, perLevel: 0.015 },
  'HP&ATKUP(小)': { base: 0.1, perLevel: 0.01 },
  'HP&ATKUP(中)': { base: 0.2, perLevel: 0.015 },
  'HP&ATKUP(大)': { base: 0.35, perLevel: 0.015 },
};

const damageUpRateMap: Record<string, number> = {
  'ダメージUP(極小)': 0.025,
  'ダメージUP(小)': 0.05,
  'ダメージUP(中)': 0.0875,
  'ダメージUP(大)': 0.125,
  'ダメージUP(極大)': 0.225,
};

const attributeDamageUpRateMap: Record<string, number> = {
  '火属性ダメージUP(極小)': 0.03,
  '火属性ダメージUP(小)': 0.06,
  '火属性ダメージUP(中)': 0.105,
  '火属性ダメージUP(大)': 0.15,
  '火属性ダメージUP(極大)': 0.27,
  '水属性ダメージUP(極小)': 0.03,
  '水属性ダメージUP(小)': 0.06,
  '水属性ダメージUP(中)': 0.105,
  '水属性ダメージUP(大)': 0.15,
  '水属性ダメージUP(極大)': 0.27,
  '木属性ダメージUP(極小)': 0.03,
  '木属性ダメージUP(小)': 0.06,
  '木属性ダメージUP(中)': 0.105,
  '木属性ダメージUP(大)': 0.15,
  '木属性ダメージUP(極大)': 0.27,
  '無属性ダメージUP(極小)': 0.03,
  '無属性ダメージUP(小)': 0.06,
  '無属性ダメージUP(中)': 0.105,
  '無属性ダメージUP(大)': 0.15,
  '無属性ダメージUP(極大)': 0.27,
};

const criticalRateMap: Record<string, number> = {
  'クリティカル(0)': 1.0,
  'クリティカル(小)': 1.125,
  'クリティカル(中)': 1.25,
  'クリティカル(大)': 1.1666,
  'クリティカル(極大)': 1.25,
};

const buddyContinueHealPattern = /^(?:HP)?継続回復\(極小\)$/;
export const LEGACY_BUDDY_CONTINUE_HEAL_TURNS = 4;

function getLevelAdjustedRate(
  effect: string,
  level: number,
  map: Record<string, { base: number; perLevel: number }>
): number {
  const config = map[effect];
  if (!config) return 0;
  return config.base + config.perLevel * Math.max(1, Math.min(10, Math.trunc(level)));
}

function mapCriticalPowerOption(effect: string, mode: 'legacy' | 'probability' = 'legacy'): string {
  if (mode === 'probability') {
    if (effect.includes('(極小)')) return '極小';
    if (effect.includes('(小)')) return '小';
    if (effect.includes('(中)')) return '中';
    if (effect.includes('(大)')) return '大';
    if (effect.includes('(極大)')) return '極大';
    return '中';
  }

  if (effect.includes('(極小)')) return '1/1';
  if (effect.includes('(小)')) return '1/2';
  if (effect.includes('(中)')) return '1/2';
  if (effect.includes('(大)')) return '2/3';
  if (effect.includes('(極大)')) return '1/1';
  return '1/1';
}

export function getBuddyContinueHealRate(level = 10): number {
  void level;
  return 0.1;
}

export function calculateBuddyContinueHealAmount(hp: number, level = 10, turns = 1): number {
  const baseHp = Number(hp);
  if (!Number.isFinite(baseHp) || baseHp <= 0 || turns <= 0) return 0;
  return Math.ceil(baseHp * getBuddyContinueHealRate(level)) * turns;
}

export function calculateLegacyBuddyContinueHealAmount(hp: number, level = 10): number {
  return calculateBuddyContinueHealAmount(hp, level, LEGACY_BUDDY_CONTINUE_HEAL_TURNS);
}

export function splitBuddyEffects(status: string | undefined | null): string[] {
  if (!status) return [];
  const protectedStatus = status.replace(/HP&ATKUP\(([^)]+)\)/g, 'HP__ATKUP($1)');
  return protectedStatus
    .split('&')
    .map(effect => effect.trim().replace(/^HP__ATKUP\(/, 'HP&ATKUP('))
    .filter(Boolean);
}

export function getBuddyHpRate(status: string | undefined | null, level = 10): number {
  return splitBuddyEffects(status).reduce((total, effect) => {
    return total + getLevelAdjustedRate(effect, level, buddyHpBaseMap);
  }, 0);
}

export function getBuddyAtkRate(status: string | undefined | null, level = 10): number {
  return splitBuddyEffects(status).reduce((total, effect) => {
    return total + getLevelAdjustedRate(effect, level, buddyAtkBaseMap);
  }, 0);
}

export function getBuddyStatusSummary(status: string | undefined | null, level = 10): BuddyStatusSummary {
  const summary: BuddyStatusSummary = {
    hpRate: 0,
    atkRate: 0,
    damageRate: 0,
    criticalMultiplier: 1.0,
    continueHealRate: 0,
    attributeDamageRates: {},
  };

  splitBuddyEffects(status).forEach(effect => {
    summary.hpRate += getLevelAdjustedRate(effect, level, buddyHpBaseMap);
    summary.atkRate += getLevelAdjustedRate(effect, level, buddyAtkBaseMap);

    if (damageUpRateMap[effect] !== undefined) {
      summary.damageRate += damageUpRateMap[effect];
    }

    const attributeEntry = Object.keys(attributeDamageUpRateMap).find(key => key === effect);
    if (attributeEntry) {
      const attribute = effect.charAt(0) as BuddyAttribute;
      summary.attributeDamageRates[attribute] = (summary.attributeDamageRates[attribute] || 0) + attributeDamageUpRateMap[attributeEntry];
    }

    if (criticalRateMap[effect] !== undefined) {
      summary.criticalMultiplier = Math.max(summary.criticalMultiplier, criticalRateMap[effect]);
    }

    if (buddyContinueHealPattern.test(effect)) {
      summary.continueHealRate += getBuddyContinueHealRate(level);
    }
  });

  return summary;
}

export function hasBuddyHpEffect(status: string | undefined | null): boolean {
  return getBuddyHpRate(status, 10) > 0;
}

export function hasBuddyAtkEffect(status: string | undefined | null): boolean {
  return getBuddyAtkRate(status, 10) > 0;
}

export function getBuddyStatusForCharacter(
  character: any,
  buddyIndex: number,
  options: {
    totsu?: number;
    isActive?: boolean;
    forceTotsu?: boolean;
  } = {}
): string {
  const normalStatus = character?.[`buddy${buddyIndex}s`] || '';
  const totsuStatus = character?.[`buddy${buddyIndex}s_totsu`] || normalStatus;

  if (options.forceTotsu) {
    return totsuStatus || normalStatus;
  }

  const totsuCount = options.totsu ?? character?.totsu ?? 0;
  const shouldUseTotsu =
    options.isActive === true &&
    isTotsuBuddyEnhanced(character?.rare, totsuCount);

  return shouldUseTotsu ? (totsuStatus || normalStatus) : normalStatus;
}

export function createBuddyGeneratedBuffs(
  character: any,
  buddyIndex: number,
  options: {
    totsu?: number;
    isActive: boolean;
    forceTotsu?: boolean;
    criticalPowerMode?: 'legacy' | 'probability';
  }
): BuddyGeneratedBuff[] {
  const status = getBuddyStatusForCharacter(character, buddyIndex, options);
  if (!status) return [];

  const totsuCount = options.totsu ?? character?.totsu ?? 0;
  if (!options.forceTotsu && !options.isActive) return [];
  if (!options.forceTotsu && !isTotsuBuddyEnhanced(character?.rare, totsuCount)) return [];

  const magicOptions: Array<'M1' | 'M2' | 'M3'> = ['M1', 'M2'];
  if (isM3Unlocked(character?.rare, totsuCount)) {
    magicOptions.push('M3');
  }

  const generated: BuddyGeneratedBuff[] = [];

  splitBuddyEffects(status).forEach(effect => {
    if (effect.startsWith('ダメージUP(')) {
      magicOptions.forEach(magicOption => {
        generated.push({
          magicOption,
          buffOption: 'ダメージUP',
          powerOption: effect.match(/\((.+)\)/)?.[1] || '中',
          levelOption: 10,
          isBuddyGenerated: true,
          buddyIndex,
          status: effect,
        });
      });
      return;
    }

    if (effect.startsWith('クリティカル(')) {
      magicOptions.forEach(magicOption => {
        generated.push({
          magicOption,
          buffOption: 'クリティカル',
          powerOption: mapCriticalPowerOption(effect, options.criticalPowerMode),
          levelOption: 10,
          isBuddyGenerated: true,
          buddyIndex,
          status: effect,
        });
      });
      return;
    }

    const continueHealMatch = effect.match(/^(?:HP)?継続回復\((.+)\)$/);
    if (continueHealMatch) {
      const [, power] = continueHealMatch;
      magicOptions.forEach(magicOption => {
        generated.push({
          magicOption,
          buffOption: '継続回復',
          powerOption: power || '極小',
          levelOption: 10,
          isBuddyGenerated: true,
          buddyIndex,
          status: effect,
        });
      });
      return;
    }

    const attributeMatch = effect.match(/^(火|水|木|無)属性ダメージUP\((.+)\)$/);
    if (!attributeMatch) return;

    const [, attribute, power] = attributeMatch as [string, BuddyAttribute, string];
    magicOptions.forEach(magicOption => {
      const magicAttribute = character?.[`magic${magicOption.charAt(1)}Attribute`] ?? character?.[`magic${magicOption.charAt(1)}atr`];
      if (magicAttribute !== attribute) return;
      generated.push({
        magicOption,
        buffOption: '属性ダメUP',
        powerOption: power,
        levelOption: 10,
        attributeOption: attribute,
        isBuddyGenerated: true,
        buddyIndex,
        status: effect,
      });
    });
  });

  return generated;
}

export function getBuddyGeneratedBuffKey(
  buff: Pick<BuddyGeneratedBuff, 'buddyIndex' | 'magicOption' | 'status'>
): string {
  return `${buff.buddyIndex}:${buff.magicOption}:${buff.status}`;
}

export function applyBuddyGeneratedBuffOverrides<T extends BuddyGeneratedBuff>(
  buffs: T[],
  overrides?: BuddyGeneratedBuffOverrides | null
): T[] {
  if (!overrides) {
    return buffs;
  }

  return buffs.map((buff) => {
    const override = overrides[getBuddyGeneratedBuffKey(buff)];
    if (!override) {
      return buff;
    }

    return {
      ...buff,
      ...override,
    };
  });
}
