export interface DuoDeckCharacter {
  chara?: string;
  duo?: string;
  isM1Selected?: boolean;
  isM2Selected?: boolean;
  isM3Selected?: boolean;
}

export interface DuoResolutionStatus {
  partnerExists: boolean;
  canUseDuo: boolean;
  isPartnerInsufficient: boolean;
}

export interface DuoResolutionResult {
  statuses: DuoResolutionStatus[];
  totalDuo: number;
}

export function resolveDeckDuoAvailability(
  deck: ReadonlyArray<DuoDeckCharacter | null | undefined>
): DuoResolutionResult {
  const canUseM2 = (character: DuoDeckCharacter | null | undefined) => character?.isM2Selected !== false;
  const getPartnerMagicCapacity = (character: DuoDeckCharacter | null | undefined) => {
    if (!character) return 0;
    return (character.isM1Selected !== false ? 1 : 0) + (character.isM3Selected ? 1 : 0);
  };

  const memberNameDict: Record<string, boolean> = {};
  deck.forEach((character) => {
    if (character?.chara) {
      memberNameDict[character.chara] = true;
    }
  });

  const duoUsed = new Array(deck.length).fill(false);
  const m2Used = new Array(deck.length).fill(false);
  const partnerMagicRemaining = deck.map((character) => getPartnerMagicCapacity(character));

  // 1. 相互デュオを最優先で割り当てる
  deck.forEach((character, index) => {
    if (!character?.duo || !memberNameDict[character.duo] || duoUsed[index] || !canUseM2(character)) {
      return;
    }

    for (let partnerIndex = 0; partnerIndex < deck.length; partnerIndex += 1) {
      if (partnerIndex === index) continue;
      const partner = deck[partnerIndex];
      if (
        partner &&
        canUseM2(partner) &&
        partner.chara === character.duo &&
        partner.duo === character.chara &&
        !duoUsed[partnerIndex]
      ) {
        duoUsed[index] = true;
        duoUsed[partnerIndex] = true;
        m2Used[index] = true;
        m2Used[partnerIndex] = true;
        break;
      }
    }
  });

  // 2. 未使用M2に対して、相手のM1/M3を消費して割り当てる
  deck.forEach((character, index) => {
    if (!character?.duo || !memberNameDict[character.duo] || duoUsed[index] || m2Used[index] || !canUseM2(character)) {
      return;
    }

    for (let partnerIndex = 0; partnerIndex < deck.length; partnerIndex += 1) {
      if (partnerIndex === index) continue;
      const partner = deck[partnerIndex];
      if (partner?.chara === character.duo && partnerMagicRemaining[partnerIndex] > 0) {
        duoUsed[index] = true;
        m2Used[index] = true;
        partnerMagicRemaining[partnerIndex] -= 1;
        break;
      }
    }
  });

  // 3. 残ったM2同士で割り当てる
  deck.forEach((character, index) => {
    if (!character?.duo || !memberNameDict[character.duo] || duoUsed[index] || m2Used[index] || !canUseM2(character)) {
      return;
    }

    for (let partnerIndex = 0; partnerIndex < deck.length; partnerIndex += 1) {
      if (partnerIndex === index) continue;
      const partner = deck[partnerIndex];
      if (partner?.chara === character.duo && canUseM2(partner) && !m2Used[partnerIndex]) {
        duoUsed[index] = true;
        m2Used[index] = true;
        m2Used[partnerIndex] = true;
        break;
      }
    }
  });

  const statuses = deck.map((character, index) => {
    const partnerExists = Boolean(character?.duo && memberNameDict[character.duo]);
    const ownM2Selected = canUseM2(character);
    const canUseDuo = duoUsed[index];
    return {
      partnerExists,
      canUseDuo,
      isPartnerInsufficient: ownM2Selected && partnerExists && !canUseDuo
    };
  });

  return {
    statuses,
    totalDuo: statuses.reduce((count, status) => count + (status.canUseDuo ? 1 : 0), 0)
  };
}
