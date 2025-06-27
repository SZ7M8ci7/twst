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

export const criticalDict: { [key: string]: number } = {
  "クリティカル(1/1)": 1.25,
  "クリティカル(1/2)": 1.125,
  "クリティカル(1/3)": 1.0833,
  "クリティカル(2/3)": 1.1666,
  // 新形式との互換性のため
  "クリティカル(小)": 1.125,
  "クリティカル(中)": 1.25,
  "クリティカル(大)": 1.1666,
  "クリティカル(極大)": 1.25
};

export const magicDict: { [key: string]: number } = {
  "単発(弱)Lv1": 0.525,
  "単発(弱)Lv2": 0.55,
  "単発(弱)Lv3": 0.575,
  "単発(弱)Lv4": 0.60,
  "単発(弱)Lv5": 0.625,
  "単発(弱)Lv6": 0.65,
  "単発(弱)Lv7": 0.675,
  "単発(弱)Lv8": 0.70,
  "単発(弱)Lv9": 0.725,
  "単発(弱)Lv10": 0.75,
  "単発(強)Lv1": 0.6625,
  "単発(強)Lv2": 0.70,
  "単発(強)Lv3": 0.7375,
  "単発(強)Lv4": 0.775,
  "単発(強)Lv5": 0.8125,
  "単発(強)Lv6": 0.85,
  "単発(強)Lv7": 0.8875,
  "単発(強)Lv8": 0.925,
  "単発(強)Lv9": 0.9625,
  "単発(強)Lv10": 1.0,
  "連撃(弱)Lv1": 0.525,
  "連撃(弱)Lv2": 0.55,
  "連撃(弱)Lv3": 0.575,
  "連撃(弱)Lv4": 0.60,
  "連撃(弱)Lv5": 0.625,
  "連撃(弱)Lv6": 0.65,
  "連撃(弱)Lv7": 0.675,
  "連撃(弱)Lv8": 0.70,
  "連撃(弱)Lv9": 0.725,
  "連撃(弱)Lv10": 0.75,
  "連撃(強)Lv1": 0.6625,
  "連撃(強)Lv2": 0.70,
  "連撃(強)Lv3": 0.7375,
  "連撃(強)Lv4": 0.775,
  "連撃(強)Lv5": 0.8125,
  "連撃(強)Lv6": 0.85,
  "連撃(強)Lv7": 0.8875,
  "連撃(強)Lv8": 0.925,
  "連撃(強)Lv9": 0.9625,
  "連撃(強)Lv10": 1.0,
  "デュオ魔法Lv1": 0.6625,
  "デュオ魔法Lv2": 0.70,
  "デュオ魔法Lv3": 0.7375,
  "デュオ魔法Lv4": 0.775,
  "デュオ魔法Lv5": 0.8125,
  "デュオ魔法Lv6": 0.85,
  "デュオ魔法Lv7": 0.8875,
  "デュオ魔法Lv8": 0.925,
  "デュオ魔法Lv9": 0.9625,
  "デュオ魔法Lv10": 1.0,
  "3連撃(弱)Lv1": 0.525,
  "3連撃(弱)Lv2": 0.55,
  "3連撃(弱)Lv3": 0.575,
  "3連撃(弱)Lv4": 0.60,
  "3連撃(弱)Lv5": 0.625,
  "3連撃(弱)Lv6": 0.65,
  "3連撃(弱)Lv7": 0.675,
  "3連撃(弱)Lv8": 0.70,
  "3連撃(弱)Lv9": 0.725,
  "3連撃(弱)Lv10": 0.75,
  "3連撃(強)Lv1": 0.6625,
  "3連撃(強)Lv2": 0.70,
  "3連撃(強)Lv3": 0.7375,
  "3連撃(強)Lv4": 0.775,
  "3連撃(強)Lv5": 0.8125,
  "3連撃(強)Lv6": 0.85,
  "3連撃(強)Lv7": 0.8875,
  "3連撃(強)Lv8": 0.925,
  "3連撃(強)Lv9": 0.9625,
  "3連撃(強)Lv10": 1.0,
};

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

// 回復量の定数（旧シミュレータ形式に合わせる）
export const healDict: { [key: string]: number } = {
    "回復(極小)1": 0.51,
    "回復(極小)2": 0.52,
    "回復(極小)3": 0.53,
    "回復(極小)4": 0.54,
    "回復(極小)5": 0.55,
    "回復(極小)6": 0.56,
    "回復(極小)7": 0.57,
    "回復(極小)8": 0.58,
    "回復(極小)9": 0.59,
    "回復(極小)10": 0.60,
    "回復(小)1": 0.92,
    "回復(小)2": 0.94,
    "回復(小)3": 0.96,
    "回復(小)4": 0.98,
    "回復(小)5": 1.00,
    "回復(小)6": 1.02,
    "回復(小)7": 1.04,
    "回復(小)8": 1.06,
    "回復(小)9": 1.08,
    "回復(小)10": 1.10,
    "回復(中)1": 1.34,
    "回復(中)2": 1.38,
    "回復(中)3": 1.42,
    "回復(中)4": 1.46, 
    "回復(中)5": 1.50,
    "回復(中)6": 1.54,
    "回復(中)7": 1.58,
    "回復(中)8": 1.62,
    "回復(中)9": 1.66,
    "回復(中)10": 1.70,
    // 継続回復エントリ（旧形式互換性のため、値は0）
    "継続回復(小)1": 0,
    "継続回復(小)2": 0,
    "継続回復(小)3": 0,
    "継続回復(小)4": 0,
    "継続回復(小)5": 0,
    "継続回復(小)6": 0,
    "継続回復(小)7": 0,
    "継続回復(小)8": 0,
    "継続回復(小)9": 0,
    "継続回復(小)10": 0,
    "継続回復(中)1": 0,
    "継続回復(中)2": 0,
    "継続回復(中)3": 0,
    "継続回復(中)4": 0,
    "継続回復(中)5": 0,
    "継続回復(中)6": 0,
    "継続回復(中)7": 0,
    "継続回復(中)8": 0,
    "継続回復(中)9": 0,
    "継続回復(中)10": 0,
    // 回復&継続回復エントリ
    "回復&継続回復(小)1": 0.92,
    "回復&継続回復(小)2": 0.94,
    "回復&継続回復(小)3": 0.96,
    "回復&継続回復(小)4": 0.98,
    "回復&継続回復(小)5": 1.00,
    "回復&継続回復(小)6": 1.02,
    "回復&継続回復(小)7": 1.04,
    "回復&継続回復(小)8": 1.06,
    "回復&継続回復(小)9": 1.08,
    "回復&継続回復(小)10": 1.10
};

// 継続回復量の定数（旧シミュレータ形式に合わせる）
export const healContinueDict: { [key: string]: number } = {
  "継続回復(小)1": 0.105,
  "継続回復(小)2": 0.11,
  "継続回復(小)3": 0.115,
  "継続回復(小)4": 0.12,
  "継続回復(小)5": 0.125,
  "継続回復(小)6": 0.13,
  "継続回復(小)7": 0.135,
  "継続回復(小)8": 0.14,
  "継続回復(小)9": 0.145,
  "継続回復(小)10": 0.15,
  "継続回復(中)1": 0.205,
  "継続回復(中)2": 0.21,
  "継続回復(中)3": 0.215,
  "継続回復(中)4": 0.22,
  "継続回復(中)5": 0.225,
  "継続回復(中)6": 0.23,
  "継続回復(中)7": 0.235,
  "継続回復(中)8": 0.24,
  "継続回復(中)9": 0.245,
  "継続回復(中)10": 0.25,
  // 通常回復エントリ（旧形式互換性のため、値は0）
  "回復(極小)1": 0,
  "回復(極小)2": 0,
  "回復(極小)3": 0,
  "回復(極小)4": 0,
  "回復(極小)5": 0,
  "回復(極小)6": 0,
  "回復(極小)7": 0,
  "回復(極小)8": 0,
  "回復(極小)9": 0,
  "回復(極小)10": 0,
  "回復(小)1": 0,
  "回復(小)2": 0,
  "回復(小)3": 0,
  "回復(小)4": 0,
  "回復(小)5": 0,
  "回復(小)6": 0,
  "回復(小)7": 0,
  "回復(小)8": 0,
  "回復(小)9": 0,
  "回復(小)10": 0,
  "回復(中)1": 0,
  "回復(中)2": 0,
  "回復(中)3": 0,
  "回復(中)4": 0,
  "回復(中)5": 0,
  "回復(中)6": 0,
  "回復(中)7": 0,
  "回復(中)8": 0,
  "回復(中)9": 0,
  "回復(中)10": 0,
  // 回復&継続回復エントリ
  "回復&継続回復(小)1": 0.105,
  "回復&継続回復(小)2": 0.11,
  "回復&継続回復(小)3": 0.115,
  "回復&継続回復(小)4": 0.12,
  "回復&継続回復(小)5": 0.125,
  "回復&継続回復(小)6": 0.13,
  "回復&継続回復(小)7": 0.135,
  "回復&継続回復(小)8": 0.14,
  "回復&継続回復(小)9": 0.145,
  "回復&継続回復(小)10": 0.15
};


// 計算関数
export function calculateCharacterStats(character: any, charaDict: { [key: string]: boolean }) {
  // キャラクターデータが存在しない場合はデフォルト値を返す
  if (!character) {
    return {
      hp: 0,
      buddyHP: 0,
      heal: 0,
      damage: {}
    };
  }

  // HP計算
  const characterHP = character.hp || 0;
  const buddyHP = calculateBuddyHP(character, charaDict);

  // 回復量計算
  const heal = calculateHeal(character);

  // ダメージ計算
  const damage = calculateDamage(character, charaDict);

  const result = {
    hp: characterHP,
    buddyHP,
    heal,
    damage,
    magic1DamageDetails: character.magic1DamageDetails,
    magic2DamageDetails: character.magic2DamageDetails,
    magic3DamageDetails: character.magic3DamageDetails
  };
  
  return result;
}


// バディHPの計算
function calculateBuddyHP(character: any, charaDict: { [key: string]: boolean }) {
  // charaDictはデッキに選択されているすべてのキャラクター名の集合
  // バディの名前がcharaDictに存在する場合のみ、そのバディの効果が適用される
  if (!charaDict) {
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
      totalBuddyHPRatio += buddyHPRatio;
    }
  }

  const totalBuddyHP = totalBuddyHPRatio * character.hp;
  return totalBuddyHP;
}

// 回復量の計算
function calculateHeal(character: any) {
  let totalHeal = 0;
  // 選択された魔法を取得
  const selectedMagic: number[] = [];
  if (character.isM1Selected) selectedMagic.push(1);
  if (character.isM2Selected) selectedMagic.push(2);
  if (character.isM3Selected) selectedMagic.push(3);

  // buffs配列からの回復値を追加
  if (character.buffs && Array.isArray(character.buffs)) {
    character.buffs.forEach((buff: any) => {
      // 回復タイプのバフをチェック
      if ((buff.buffOption === '回復' || buff.buffOption === '継続回復') && buff.magicOption) {
        const magicNum = Number(buff.magicOption.replace('M', ''));
        
        // 該当する魔法が選択されている場合のみ
        if (selectedMagic.includes(magicNum)) {
          const level = Number(buff.levelOption) || 10;
          
          if (buff.buffOption === '回復') {
            // 即時回復: healDictから値を取得
            const healKey = `回復(${buff.powerOption})${level}`;
            const healValue = healKey in healDict ? healDict[healKey] : 0;
            if (healValue > 0) {
              totalHeal += Number(healValue) * Number(character.atk);
            }
          } else if (buff.buffOption === '継続回復') {
            // 継続回復: healContinueDictから値を取得
            const healContinueKey = `継続回復(${buff.powerOption})${level}`;
            const healContinueValue = healContinueKey in healContinueDict ? healContinueDict[healContinueKey] : 0;
            if (healContinueValue > 0) {
              totalHeal += 3 * Number(healContinueValue) * Number(character.hp);
            }
          }
        }
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
    return damage; // 無属性は属性倍率の影響を受けない
  }
  
  const effectiveness = attributeEffectiveness[magicAtr]?.[targetAtr];
  return effectiveness ? damage * effectiveness : damage;
}


// ダメージの計算
function calculateDamage(character: any, charaDict: { [key: string]: boolean }) {
  const damage: { [key: string]: number } = {
    '火': 0,
    '水': 0,
    '木': 0,
    '無': 0,
    '対全': 0
  };

  // charaDictが存在しない場合は空のダメージオブジェクトを返す
  if (!charaDict) {
    return damage;
  }

  // バディATKの計算 - 最適化: 一度だけ計算
  const buddyATK = calculateBuddyATK(character, charaDict);
  
  // 各魔法のダメージ計算
  for (let i = 1; i <= 3; i++) {
    const magicKey = `magic${i}`;
    const attribute = character[`${magicKey}Attribute`];
    const power = character[`${magicKey}Power`] || '単発(弱)';
    const level = character[`${magicKey}Lv`] || 1;
    
    const buffResults = calculateBuffs(character, magicKey);
    const atkBuffTotal = buffResults.atkBuffTotal;
    const dmgBuffTotal = buffResults.dmgBuffTotal;
    const criticalMultiplier = buffResults.criticalMultiplier;
    
    const baseATK = character.atk + atkBuffTotal + buddyATK;
    
    // デュオ -> デュオ魔法への変換
    const adjustedPower = power === 'デュオ' ? 'デュオ魔法' : power;
    const magicRatioKey = `${adjustedPower}Lv${level}`;
    const magicRatio = magicRatioKey in magicDict ? magicDict[magicRatioKey] : 1.0;
    
    const attributeAdjust = attribute === '無' ? 1.1 : 1.0;
    const rengekiMultiplier = getRengekiMultiplier(adjustedPower);
    
    const baseDamage = baseATK * (Number(magicRatio) * attributeAdjust + dmgBuffTotal) * rengekiMultiplier * criticalMultiplier;
    
    // 属性ダメージの計算
    const attributeDamages = calculateAttributeDamages(attribute, baseDamage);
    
    // 全ての魔法のダメージ詳細を保存（グラフ表示用）
    character[`magic${i}DamageDetails`] = {
      attribute,
      power,
      baseDamage: Math.round(baseDamage),
      fire: Math.round(attributeDamages.fire),
      water: Math.round(attributeDamages.water),
      wood: Math.round(attributeDamages.wood),
      neutral: Math.round(attributeDamages.neutral),
      max: Math.round(attributeDamages.max)
    };
    
    // selectedMagicを使わず、個別のフラグをチェック
    const isSelected = character[`isM${i}Selected`];
    if (!isSelected) continue;
    
    // 選択された魔法のダメージのみを合計
    damage['火'] += Math.round(attributeDamages.fire);
    damage['水'] += Math.round(attributeDamages.water);
    damage['木'] += Math.round(attributeDamages.wood);
    damage['無'] += Math.round(attributeDamages.neutral);
    damage['対全'] += Math.round(attributeDamages.max);
  }

  return damage;
}

function calculateBuddyATK(character: any, charaDict: { [key: string]: boolean }): number {
  const buddy1atkRatio = character.buddy1c && character.buddy1c in charaDict ? 
    (character.buddy1s + character.buddy1Lv in buddyATKDict ? buddyATKDict[character.buddy1s + character.buddy1Lv] : 0) : 0;
  const buddy2atkRatio = character.buddy2c && character.buddy2c in charaDict ? 
    (character.buddy2s + character.buddy2Lv in buddyATKDict ? buddyATKDict[character.buddy2s + character.buddy2Lv] : 0) : 0;
  const buddy3atkRatio = character.buddy3c && character.buddy3c in charaDict ? 
    (character.buddy3s + character.buddy3Lv in buddyATKDict ? buddyATKDict[character.buddy3s + character.buddy3Lv] : 0) : 0;

  return character.atk * (buddy1atkRatio + buddy2atkRatio + buddy3atkRatio);
}

function calculateBuffs(character: any, magicKey: string) {
  let atkBuffTotal = 0;
  let dmgBuffTotal = 0;
  let criticalMultiplier = 1.0;
  
  if (character.buffs && Array.isArray(character.buffs)) {
    for (const buff of character.buffs) {
      if (buff.magicOption !== `M${magicKey.charAt(5)}`) continue;
      
      const buffType = buff.buffOption;
      const powerType = buff.powerOption;
      const level = buff.levelOption || 10;
      
      if (buffType === 'ATKUP' || buffType === 'ATKDOWN') {
        const buffKey = `${buffType}(${powerType})${level}`;
        if (buffKey in atkbuffDict) {
          atkBuffTotal += Number(atkbuffDict[buffKey]) * character.atk;
        }
      }
      
      // ダメージバフの計算
      if (buffType === 'ダメージUP' || buffType === '属性ダメUP' || buffType === 'ダメージDOWN' || buffType === '属性ダメDOWN') {
        let prefix = '';
        if (buffType === 'ダメージUP') prefix = 'ダメUP';
        else if (buffType === 'ダメージDOWN') prefix = 'ダメDOWN';
        else if (buffType === '属性ダメUP') prefix = '属性ダメUP';
        else if (buffType === '属性ダメDOWN') prefix = '属性ダメDOWN';
        
        const buffKey = `${prefix}(${powerType})${level}`;
        if (buffKey in dmgbuffDict) {
          dmgBuffTotal += Number(dmgbuffDict[buffKey]);
        }
      }
      
      if (buffType === 'クリティカル') {
        const critKey = `クリティカル(${powerType})`;
        if (critKey in criticalDict) {
          criticalMultiplier = Math.max(criticalMultiplier, criticalDict[critKey]);
        }
      }
    }
  } else {
    for (let j = 1; j <= 6; j++) {
      const buffKey = `${magicKey}Buff${j}`;
      const buffLv = character[`${magicKey}Buff${j}Lv`] || '';
      const buffValue = character[buffKey] + buffLv;
      
      if (buffValue in atkbuffDict) {
        atkBuffTotal += Number(atkbuffDict[buffValue]) * character.atk;
      }
      
      // ダメージバフの計算
      if (buffValue in dmgbuffDict) {
        dmgBuffTotal += Number(dmgbuffDict[buffValue]);
      }
      
      if (buffValue in criticalDict) {
        criticalMultiplier = Math.max(criticalMultiplier, criticalDict[buffValue]);
      }
    }
  }
  
  return { atkBuffTotal, dmgBuffTotal, criticalMultiplier };
}

function getRengekiMultiplier(power: string): number {
  if (power === '連撃(弱)' || power === '連撃(強)') {
    return 1.8;
  } else if (power === 'デュオ魔法' || power === '3連撃(弱)' || power === '3連撃(強)') {
    return 2.4;
  }
  return 1.0;
}

function calculateAttributeDamages(attribute: string, baseDamage: number) {
  const fireDamage = calcAttributeDamage(attribute, '火', baseDamage);
  const waterDamage = calcAttributeDamage(attribute, '水', baseDamage);
  const woodDamage = calcAttributeDamage(attribute, '木', baseDamage);
  const neutralDamage = calcAttributeDamage(attribute, '無', baseDamage);
  const maxDamage = Math.max(fireDamage, waterDamage, woodDamage);
  
  return {
    fire: fireDamage,
    water: waterDamage,
    wood: woodDamage,
    neutral: neutralDamage,
    max: maxDamage
  };
}
