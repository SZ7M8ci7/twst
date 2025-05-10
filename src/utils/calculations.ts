// バフの定数
export const atkbuffDict: { [key: string]: string } = {};
for (let i = 1; i <= 10; i++) {
  atkbuffDict[`ATKUP(極小)${i}`] = ((5 + 0.5 * i) / 100).toString();
  atkbuffDict[`ATKUP(小)${i}`] = ((10 + 1 * i) / 100).toString();
  atkbuffDict[`ATKUP(中)${i}`] = ((20 + 1.5 * i) / 100).toString();
  atkbuffDict[`ATKUP(大)${i}`] = ((30 + 2 * i) / 100).toString();
  atkbuffDict[`ATKUP(極大)${i}`] = ((50 + 4 * i) / 100).toString();
  
  atkbuffDict[`ATKDOWN(極小)${i}`] = (-1*(5 + 0.5 * i) / 100).toString();
  atkbuffDict[`ATKDOWN(小)${i}`] = (-1*(10 + 1 * i) / 100).toString();
  atkbuffDict[`ATKDOWN(中)${i}`] = (-1*(20 + 1.5 * i) / 100).toString();
  atkbuffDict[`ATKDOWN(大)${i}`] = (-1*(30 + 2 * i) / 100).toString();
  atkbuffDict[`ATKDOWN(極大)${i}`] = (-1*(50 + 4 * i) / 100).toString();
}

export const dmgbuffDict: { [key: string]: string } = {};
for (let i = 1; i <= 10; i++) {
  dmgbuffDict[`ダメUP(極小)${i}`] = ((1.25 + 0.125 * i) / 100).toString();
  dmgbuffDict[`ダメUP(小)${i}`] = ((2.5 + 0.25 * i) / 100).toString();
  dmgbuffDict[`ダメUP(中)${i}`] = ((5 + 0.375 * i) / 100).toString();
  dmgbuffDict[`ダメUP(大)${i}`] = ((7.5 + 0.5 * i) / 100).toString();
  dmgbuffDict[`ダメUP(極大)${i}`] = ((12.5 + 1 * i) / 100).toString();
  
  dmgbuffDict[`ダメDOWN(極小)${i}`] = (-1*(1.25 + 0.125 * i) / 100).toString();
  dmgbuffDict[`ダメDOWN(小)${i}`] = (-1*(2.5 + 0.25 * i) / 100).toString();
  dmgbuffDict[`ダメDOWN(中)${i}`] = (-1*(5 + 0.375 * i) / 100).toString();
  dmgbuffDict[`ダメDOWN(大)${i}`] = (-1*(7.5 + 0.5 * i) / 100).toString();
  dmgbuffDict[`ダメDOWN(極大)${i}`] = (-1*(12.5 + 1 * i) / 100).toString();
  
  dmgbuffDict[`属性ダメUP(極小)${i}`] = ((1.5 + 0.15 * i) / 100).toString();
  dmgbuffDict[`属性ダメUP(小)${i}`] = ((3 + 0.3 * i) / 100).toString();
  dmgbuffDict[`属性ダメUP(中)${i}`] = ((6 + 0.45 * i) / 100).toString();
  dmgbuffDict[`属性ダメUP(大)${i}`] = ((9 + 0.6 * i) / 100).toString();
  dmgbuffDict[`属性ダメUP(極大)${i}`] = ((15 + 1.2 * i) / 100).toString();
  
  dmgbuffDict[`属性ダメDOWN(極小)${i}`] = (-1*(1.5 + 0.15 * i) / 100).toString();
  dmgbuffDict[`属性ダメDOWN(小)${i}`] = (-1*(3 + 0.3 * i) / 100).toString();
  dmgbuffDict[`属性ダメDOWN(中)${i}`] = (-1*(6 + 0.45 * i) / 100).toString();
  dmgbuffDict[`属性ダメDOWN(大)${i}`] = (-1*(9 + 0.6 * i) / 100).toString();
  dmgbuffDict[`属性ダメDOWN(極大)${i}`] = (-1*(15 + 1.2 * i) / 100).toString();
}

// バディHPの定数
export const buddyHPDict: { [key: string]: number } = {
  "HPUP(小)1": 0.11,
  "HPUP(小)2": 0.12,
  "HPUP(小)3": 0.13,
  "HPUP(小)4": 0.14,
  "HPUP(小)5": 0.15,
  "HPUP(小)6": 0.16,
  "HPUP(小)7": 0.17,
  "HPUP(小)8": 0.18,
  "HPUP(小)9": 0.19,
  "HPUP(小)10": 0.2,
  "HPUP(中)1": 0.21,
  "HPUP(中)2": 0.22,
  "HPUP(中)3": 0.23,
  "HPUP(中)4": 0.24,
  "HPUP(中)5": 0.25,
  "HPUP(中)6": 0.26,
  "HPUP(中)7": 0.27,
  "HPUP(中)8": 0.28,
  "HPUP(中)9": 0.29,
  "HPUP(中)10": 0.3,
  "HP&ATKUP(小)1": 0.11,
  "HP&ATKUP(小)2": 0.12,
  "HP&ATKUP(小)3": 0.13,
  "HP&ATKUP(小)4": 0.14,
  "HP&ATKUP(小)5": 0.15,
  "HP&ATKUP(小)6": 0.16,
  "HP&ATKUP(小)7": 0.17,
  "HP&ATKUP(小)8": 0.18,
  "HP&ATKUP(小)9": 0.19,
  "HP&ATKUP(小)10": 0.2,
  "HP&ATKUP(中)1": 0.21,
  "HP&ATKUP(中)2": 0.22,
  "HP&ATKUP(中)3": 0.23,
  "HP&ATKUP(中)4": 0.24,
  "HP&ATKUP(中)5": 0.25,
  "HP&ATKUP(中)6": 0.26,
  "HP&ATKUP(中)7": 0.27,
  "HP&ATKUP(中)8": 0.28,
  "HP&ATKUP(中)9": 0.29,
  "HP&ATKUP(中)10": 0.3,
};

// バディATKの定数
export const buddyATKDict: { [key: string]: number } = {
  "ATKUP(小)1": 0.11,
  "ATKUP(小)2": 0.12,
  "ATKUP(小)3": 0.13,
  "ATKUP(小)4": 0.14,
  "ATKUP(小)5": 0.15,
  "ATKUP(小)6": 0.16,
  "ATKUP(小)7": 0.17,
  "ATKUP(小)8": 0.18,
  "ATKUP(小)9": 0.19,
  "ATKUP(小)10": 0.2,
  "ATKUP(中)1": 0.215,
  "ATKUP(中)2": 0.23,
  "ATKUP(中)3": 0.245,
  "ATKUP(中)4": 0.26,
  "ATKUP(中)5": 0.275,
  "ATKUP(中)6": 0.29,
  "ATKUP(中)7": 0.305,
  "ATKUP(中)8": 0.32,
  "ATKUP(中)9": 0.335,
  "ATKUP(中)10": 0.35,
  "HP&ATKUP(小)1": 0.11,
  "HP&ATKUP(小)2": 0.12,
  "HP&ATKUP(小)3": 0.13,
  "HP&ATKUP(小)4": 0.14,
  "HP&ATKUP(小)5": 0.15,
  "HP&ATKUP(小)6": 0.16,
  "HP&ATKUP(小)7": 0.17,
  "HP&ATKUP(小)8": 0.18,
  "HP&ATKUP(小)9": 0.19,
  "HP&ATKUP(小)10": 0.2,
  "HP&ATKUP(中)1": 0.215,
  "HP&ATKUP(中)2": 0.23,
  "HP&ATKUP(中)3": 0.245,
  "HP&ATKUP(中)4": 0.26,
  "HP&ATKUP(中)5": 0.275,
  "HP&ATKUP(中)6": 0.29,
  "HP&ATKUP(中)7": 0.305,
  "HP&ATKUP(中)8": 0.32,
  "HP&ATKUP(中)9": 0.335,
  "HP&ATKUP(中)10": 0.35,
};

// 回復量の定数
export const healDict: { [key: string]: number } = {
    "回復極小1": 0.51,
    "回復極小2": 0.52,
    "回復極小3": 0.53,
    "回復極小4": 0.54,
    "回復極小5": 0.55,
    "回復極小6": 0.56,
    "回復極小7": 0.57,
    "回復極小8": 0.58,
    "回復極小9": 0.59,
    "回復極小10": 0.60,
    "回復小1": 0.92,
    "回復小2": 0.94,
    "回復小3": 0.96,
    "回復小4": 0.98,
    "回復小5": 1.00,
    "回復小6": 1.02,
    "回復小7": 1.04,
    "回復小8": 1.06,
    "回復小9": 1.08,
    "回復小10": 1.10,
    "回復中1": 1.34,
    "回復中2": 1.38,
    "回復中3": 1.42,
    "回復中4": 1.46, 
    "回復中5": 1.50,
    "回復中6": 1.54,
    "回復中7": 1.58,
    "回復中8": 1.62,
    "回復中9": 1.66,
    "回復中10": 1.70,
};

// 継続回復量の定数
export const healContinueDict: { [key: string]: number } = {
  "継続回復小1": 0.105,
  "継続回復小2": 0.11,
  "継続回復小3": 0.115,
  "継続回復小4": 0.12,
  "継続回復小5": 0.125,
  "継続回復小6": 0.13,
  "継続回復小7": 0.135,
  "継続回復小8": 0.14,
  "継続回復小9": 0.145,
  "継続回復小10": 0.15,
  "継続回復中1": 0.205,
  "継続回復中2": 0.21,
  "継続回復中3": 0.215,
  "継続回復中4": 0.22,
  "継続回復中5": 0.225,
  "継続回復中6": 0.23,
  "継続回復中7": 0.235,
  "継続回復中8": 0.24,
  "継続回復中9": 0.245,
  "継続回復中10": 0.25
};

// 計算関数
export function calculateCharacterStats(character: any, charaDict: { [key: string]: string }) {
  // キャラクターデータが存在しない場合はデフォルト値を返す
  if (!character) {
    console.error('Character data is not defined');
    return {
      hp: 0,
      buddyHP: 0,
      heal: 0,
      damage: {}
    };
  }

  // HP計算
  const baseHP = character.hp || 0;
  const buddyHP = calculateBuddyHP(character, charaDict);
  const totalHP = baseHP + buddyHP;

  // 回復量計算
  const heal = calculateHeal(character);

  // ダメージ計算
  const damage = calculateDamage(character, charaDict);

  return {
    hp: totalHP,
    buddyHP,
    heal,
    damage
  };
}

// バディHPの計算
function calculateBuddyHP(character: any, charaDict: { [key: string]: string }) {
  // charaDictはデッキに選択されているすべてのキャラクター名の集合
  // バディの名前がcharaDictに存在する場合のみ、そのバディの効果が適用される
  if (!charaDict) {
    console.log('charaDict is not defined');
    return 0;
  }

  let totalBuddyHPRatio = 0;

  // 各バディのHP上昇率を計算（デッキに含まれている場合のみ）
  for (let i = 1; i <= 3; i++) {
    const buddyName = character[`buddy${i}c`];
    const buddyState = character[`buddy${i}s`];
    const buddyLevel = character[`buddy${i}Lv`];

    if (buddyName && buddyName in charaDict) {
      const buddyKey = buddyState + buddyLevel;
      const buddyHPRatio = buddyKey in buddyHPDict ? Number(buddyHPDict[buddyKey]) : 0;
      console.log(`Buddy${i}: ${buddyName}, Key: ${buddyKey}, Ratio: ${buddyHPRatio}`);
      totalBuddyHPRatio += buddyHPRatio;
    }
  }

  const totalBuddyHP = totalBuddyHPRatio * character.hp;
  return totalBuddyHP;
}

// 回復量の計算
function calculateHeal(character: any) {
  let totalHeal = 0;

  // バフが存在しない場合は0を返す
  if (!character.buffs) {
    return totalHeal;
  }

  // 各魔法の回復量を計算
  for (let i = 1; i <= 3; i++) {
    // 該当する魔法の回復バフを取得
    const healBuffs = character.buffs.filter((buff: any) => 
      buff.magicOption === `M${i}` && (buff.buffOption === '回復' || buff.buffOption === '継続回復')
    );

    if (healBuffs.length === 0) continue;

    // 各回復バフの効果を計算
    healBuffs.forEach((buff: any) => {
      // バフの選択内容から回復量を計算
      const buffLevel = parseInt(buff.levelOption) || 10;  // レベルを数値に変換
      const powerType = buff.powerOption || '小';  // デフォルトは'小'

      // バフの種類とレベルからキーを生成
      const healKey = `${buff.buffOption}${powerType}${buffLevel}`;

      // 即時回復の計算
      if (buff.buffOption === '回復') {
        const healValue = healKey in healDict ? healDict[healKey] : 0;
        totalHeal += Number(healValue) * Number(character.atk);
      }

      // 継続回復の計算
      if (buff.buffOption === '継続回復') {
        const healContinueValue = healKey in healContinueDict ? healContinueDict[healKey] : 0;
        totalHeal += 3 * Number(healContinueValue) * Number(character.hp);
      }
    });
  }
  return totalHeal;
}

const attributeEffectiveness: Record<string, Record<string, number>> = {
  '水': { '火': 1.5, '木': 0.5 },
  '木': { '水': 1.5, '火': 0.5 },
  '火': { '木': 1.5, '水': 0.5 },
};

// 属性ダメージの計算
function calcAttributeDamage(magicAtr: string, targetAtr: string, damage: number): number {
  if (magicAtr === '無') {
    return damage * 1.1;
  }
  
  const effectiveness = attributeEffectiveness[magicAtr]?.[targetAtr];
  return effectiveness ? damage * effectiveness : damage;
}

// ダメージの計算
function calculateDamage(character: any, charaDict: { [key: string]: string }) {
  const damage: { [key: string]: number } = {};

  // charaDictが存在しない場合は空のダメージオブジェクトを返す
  if (!charaDict) {
    return damage;
  }

  // バディATKの計算
  const buddy1atkRatio = character.buddy1c && character.buddy1c in charaDict ? 
    (character.buddy1s + character.buddy1Lv in buddyATKDict ? buddyATKDict[character.buddy1s + character.buddy1Lv] : 0) : 0;
  const buddy2atkRatio = character.buddy2c && character.buddy2c in charaDict ? 
    (character.buddy2s + character.buddy2Lv in buddyATKDict ? buddyATKDict[character.buddy2s + character.buddy2Lv] : 0) : 0;
  const buddy3atkRatio = character.buddy3c && character.buddy3c in charaDict ? 
    (character.buddy3s + character.buddy3Lv in buddyATKDict ? buddyATKDict[character.buddy3s + character.buddy3Lv] : 0) : 0;

  const totalATK = character.atk * (1 + buddy1atkRatio + buddy2atkRatio + buddy3atkRatio);

  // 各魔法のダメージ計算
  for (let i = 1; i <= 3; i++) {
    if (!character.selectedMagic?.includes(i)) continue;

    const magicKey = `magic${i}`;
    const attribute = character[`${magicKey}Attribute`];
    const power = character[`${magicKey}Power`];
    const level = character[`${magicKey}Lv`];

    // バフの計算
    let atkBuff = 0;
    for (let j = 1; j <= 6; j++) {
      const buffKey = `${magicKey}Buff${j}`;
      const buffLv = character[`${magicKey}Buff${j}Lv`];
      const buffValue = character[buffKey] + buffLv;
      if (buffValue in atkbuffDict) {
        atkBuff += Number(atkbuffDict[buffValue]);
      }
    }

    // ダメージバフの計算
    let dmgBuff = 0;
    for (let j = 1; j <= 6; j++) {
      const buffKey = `${magicKey}DmgBuff${j}`;
      const buffLv = character[`${magicKey}DmgBuff${j}Lv`];
      const buffValue = character[buffKey] + buffLv;
      if (buffValue in dmgbuffDict) {
        dmgBuff += Number(dmgbuffDict[buffValue]);
      }
    }

    const baseDamage = totalATK * (1 + atkBuff) * (1 + dmgBuff);
    
    damage[attribute] = baseDamage;
    
    damage['火'] = calcAttributeDamage(attribute, '火', baseDamage);
    damage['水'] = calcAttributeDamage(attribute, '水', baseDamage);
    damage['木'] = calcAttributeDamage(attribute, '木', baseDamage);
    damage['無'] = attribute === '無' ? baseDamage * 1.1 : baseDamage;
    
    damage['対全'] = Math.max(damage['火'], damage['水'], damage['木']);
  }

  return damage;
}
