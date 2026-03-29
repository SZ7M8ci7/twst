export const SIMULATOR_TARGET_ATTRIBUTES = ['対火', '対水', '対木', '対無'] as const;

export type SimulatorTargetAttribute = typeof SIMULATOR_TARGET_ATTRIBUTES[number];

export function isSimulatorTargetAttribute(value?: string): value is SimulatorTargetAttribute {
  return SIMULATOR_TARGET_ATTRIBUTES.includes(value as SimulatorTargetAttribute);
}

export function resolveSimulatorAttribute(
  selectedAttribute?: string,
  selectedOpponentAttribute?: string
): string {
  const normalizedAttribute = selectedAttribute || '対全';

  if (normalizedAttribute === '対全' && isSimulatorTargetAttribute(selectedOpponentAttribute)) {
    return selectedOpponentAttribute;
  }

  return normalizedAttribute;
}

export function getMagicTargetAttribute(character: any, magicIndex: number): string {
  return character?.[`magic${magicIndex}TargetAttribute`] || '';
}

export function normalizeMagicTargetAttributes(character: any, legacyTargetAttribute?: string) {
  if (!character) {
    return character;
  }

  const fallbackTargetAttribute = isSimulatorTargetAttribute(legacyTargetAttribute)
    ? legacyTargetAttribute
    : '';

  for (let i = 1; i <= 3; i++) {
    const key = `magic${i}TargetAttribute`;
    if (!character[key]) {
      character[key] = fallbackTargetAttribute;
    }
  }

  return character;
}

export function applyLegacyTargetAttributeToCharacter(character: any, legacyTargetAttribute?: string) {
  return normalizeMagicTargetAttributes(character, legacyTargetAttribute);
}

export function applyLegacyTargetAttributeToDeck(deckCharacters: any[] | undefined, legacyTargetAttribute?: string) {
  if (!Array.isArray(deckCharacters) || !isSimulatorTargetAttribute(legacyTargetAttribute)) {
    return deckCharacters;
  }

  deckCharacters.forEach((character) => applyLegacyTargetAttributeToCharacter(character, legacyTargetAttribute));
  return deckCharacters;
}

export function getTargetElementFromAttribute(attribute?: string): string {
  switch (attribute) {
    case '対火':
      return '火';
    case '対水':
      return '水';
    case '対木':
      return '木';
    case '対無':
    case '対無属性':
      return '無';
    default:
      return '';
  }
}

export function getDamageValueFromDetails(
  damageDetails: any,
  selectedAttribute: string,
  selectedTargetAttribute?: string
): number {
  if (!damageDetails) return 0;

  const resolvedAttribute = resolveSimulatorAttribute(selectedAttribute, selectedTargetAttribute);

  switch (resolvedAttribute) {
    case '対火':
      return damageDetails.fire || 0;
    case '対水':
      return damageDetails.water || 0;
    case '対木':
      return damageDetails.wood || 0;
    case '対無':
    case '対無属性':
      return damageDetails.neutral || 0;
    case '対全':
    default:
      return Math.max(
        damageDetails.fire || 0,
        damageDetails.water || 0,
        damageDetails.wood || 0,
        damageDetails.neutral || 0
      );
  }
}

export function getCompatibilityType(
  magicAttribute: string,
  selectedAttribute: string,
  selectedTargetAttribute?: string
): 'advantage' | 'equal' | 'disadvantage' {
  const resolvedAttribute = resolveSimulatorAttribute(selectedAttribute, selectedTargetAttribute);
  const targetAttribute = getTargetElementFromAttribute(resolvedAttribute);

  if (resolvedAttribute === '対全') {
    return magicAttribute === '無' ? 'equal' : 'advantage';
  }

  if (!targetAttribute || targetAttribute === '無') {
    return 'equal';
  }

  if (
    (magicAttribute === '火' && targetAttribute === '木') ||
    (magicAttribute === '水' && targetAttribute === '火') ||
    (magicAttribute === '木' && targetAttribute === '水')
  ) {
    return 'advantage';
  }

  if (
    (magicAttribute === '火' && targetAttribute === '水') ||
    (magicAttribute === '水' && targetAttribute === '木') ||
    (magicAttribute === '木' && targetAttribute === '火')
  ) {
    return 'disadvantage';
  }

  return 'equal';
}
