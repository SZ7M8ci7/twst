import { defineStore } from 'pinia';
import { ref, computed, reactive, watch, nextTick } from 'vue';
import { calculateCharacterStats } from '@/utils/calculations';

function debounce(fn: Function, delay: number) {
  let timer: number | null = null;
  return function(...args: any[]) {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      fn(...args);
      timer = null;
    }, delay) as unknown as number;
  };
}


// キャラクターのインターフェースを定義
interface Character {
  [key: string]: any;
  isBonusSelected: any;
  base_hp: any;
  base_atk: any;
  max_hp: number;
  max_atk: number;
  rare: any;
  chara: string;
  name: string;
  level: number;
  hp: number;
  atk: number;
  magic1Lv: number;
  magic2Lv: number;
  magic3Lv: number;
  magic1heal: string;
  magic2heal: string;
  magic3heal: string;
  magic1Attribute?: string;
  magic2Attribute?: string;
  magic3Attribute?: string;
  magic1Power?: string;
  magic2Power?: string;
  magic3Power?: string;
  magic1DamageDetails?: any;
  magic2DamageDetails?: any;
  magic3DamageDetails?: any;
  selectedMagic: number[];
  buddy1c: string;
  buddy2c: string;
  buddy3c: string;
  buddy1s: string;
  buddy2s: string;
  buddy3s: string;
  buddy1Lv: number;
  buddy2Lv: number;
  buddy3Lv: number;
  buffs?: {
    buffOption: string;
    powerOption: string;
    levelOption: string;
    magicOption: string;
  }[];
  duo?: string;
  magic2pow?: string;
  imgUrl?: string;
  isM1Selected?: boolean;
  isM2Selected?: boolean;
  isM3Selected?: boolean;
}

// デフォルトのキャラクター設定
const createDefaultCharacter = (): Character => ({
  chara: '',
  name: '',
  level: 0,
  hp: 0,
  atk: 0,
  max_hp: 0,
  max_atk: 0,
  magic1Lv: 1,
  magic2Lv: 1,
  magic3Lv: 1,
  magic1heal: '',
  magic2heal: '',
  magic3heal: '',
  magic1Attribute: '火',
  magic2Attribute: '火',
  magic3Attribute: '火',
  magic1Power: '単発(弱)',
  magic2Power: '単発(弱)',
  magic3Power: '単発(弱)',
  selectedMagic: [1, 2, 3],
  buddy1c: '',
  buddy2c: '',
  buddy3c: '',
  buddy1s: '',
  buddy2s: '',
  buddy3s: '',
  buddy1Lv: 10,
  buddy2Lv: 10,
  buddy3Lv: 10,
  buffs: [],
  base_hp: 0,
  base_atk: 0,
  rare: 'SSR',
  isBonusSelected: false,
  imgUrl: '',
  isM1Selected: true,
  isM2Selected: true,
  isM3Selected: true
});

export const useSimulatorStore = defineStore('simulator', () => {
  // デッキのキャラクター（5人分）
  const deckCharacters = reactive([
    createDefaultCharacter(),
    createDefaultCharacter(),
    createDefaultCharacter(),
    createDefaultCharacter(),
    createDefaultCharacter()
  ]);
  const selectedAttribute = ref('対全');

  // デッキのキャラクター名の集合を作成（デュオ判定用）
  const charaDict = computed(() => {
    const dict: { [key: string]: boolean } = {};
    deckCharacters.forEach(char => {
      if (char.chara) dict[char.chara] = true;
    });
    return dict;
  });

  // 計算済みのステータスを保持
  const characterStats = ref(deckCharacters.map(char => calculateCharacterStats(char, {})));
  
  const isCalculating = ref(false);
  
  const needsRecalculation = ref(false);

  // デュオの判定と設定を行う関数（キャラクター選択時のみ実行）
  function updateDuoStatus(character: Character, dict: { [key: string]: boolean }, forceUpdate = false) {
    if (!forceUpdate) return; // forceUpdateがtrueの場合のみ実行
    
    if (character.duo && dict[character.duo]) {
      character.magic2Power = 'デュオ';
    } else if (character.duo && !dict[character.duo]) {
      character.magic2Power = character.magic2pow || '連撃(強)';
    }
  }
  
  const recalculateStats = debounce(async () => {
    if (isCalculating.value) {
      needsRecalculation.value = true;
      return;
    }
    
    isCalculating.value = true;
    
    await nextTick();
    
    try {
      // Get current charaDict value to avoid reactivity issues
      const currentCharaDict = charaDict.value;
      
      // recalculateStatsでは強制更新しない（ユーザーの手動選択を保持）
      // deckCharacters.forEach(character => updateDuoStatus(character, currentCharaDict));
      
      const newStats = [];
      for (let i = 0; i < deckCharacters.length; i++) {
        newStats.push(calculateCharacterStats(deckCharacters[i], currentCharaDict));
        if (i < deckCharacters.length - 1) await new Promise(r => setTimeout(r, 0));
      }
      
      characterStats.value = newStats;
    } finally {
      isCalculating.value = false;
      
      if (needsRecalculation.value) {
        needsRecalculation.value = false;
        // 非同期で実行して本番環境でのstack overflowを防ぐ
        setTimeout(() => recalculateStats(), 0);
      }
    }
  }, 100);

  // 元のwatcherロジックを維持 - nextTickを使わず、デバウンスで制御
  watch(charaDict, (newDict, oldDict) => {
    if (JSON.stringify(newDict) !== JSON.stringify(oldDict)) {
      recalculateStats();
    }
  });

  watch(() => deckCharacters.map(char => ({
    chara: char.chara,
    level: char.level,
    hp: char.hp,
    atk: char.atk,
    isM1Selected: char.isM1Selected,
    isM2Selected: char.isM2Selected,
    isM3Selected: char.isM3Selected,
    magic1Attribute: char.magic1Attribute,
    magic2Attribute: char.magic2Attribute,
    magic3Attribute: char.magic3Attribute,
    magic1Power: char.magic1Power,
    magic2Power: char.magic2Power,
    magic3Power: char.magic3Power,
    magic1Lv: char.magic1Lv,
    magic2Lv: char.magic2Lv,
    magic3Lv: char.magic3Lv,
    buddy1c: char.buddy1c,
    buddy2c: char.buddy2c,
    buddy3c: char.buddy3c,
    buddy1Lv: char.buddy1Lv,
    buddy2Lv: char.buddy2Lv,
    buddy3Lv: char.buddy3Lv
  })), (newVal, oldVal) => {
    if (JSON.stringify(newVal) !== JSON.stringify(oldVal)) {
      recalculateStats();
    }
  });

  watch(() => deckCharacters.map(char => 
    char.buffs ? JSON.stringify(char.buffs) : ''
  ), (newVal, oldVal) => {
    if (JSON.stringify(newVal) !== JSON.stringify(oldVal)) {
      recalculateStats();
    }
  });

  // デッキ全体のステータスを計算 - 最適化: 型安全性の向上
  const deckStats = computed(() => {
    const stats = {
      totalHP: 0,
      totalBuddyHP: 0,
      totalHeal: 0,
      totalDamage: {} as { [key: string]: number }
    };

    characterStats.value.forEach(charStats => {
      stats.totalHP += charStats.hp;
      stats.totalBuddyHP += charStats.buddyHP;
      stats.totalHeal += charStats.heal;

      // ダメージの合計を計算
      if (charStats.damage) {
        Object.entries(charStats.damage).forEach(([attribute, damageValue]) => {
          const damage = Number(damageValue) || 0;
          stats.totalDamage[attribute] = (stats.totalDamage[attribute] || 0) + damage;
        });
      }
    });

    return stats;
  });

  // 属性ごとのダメージを取得
  const getDamageByAttribute = (attribute: string) => {
    return characterStats.value.map(charStats => {
      const damage = charStats.damage as { [key: string]: number };
      return damage[attribute] || 0;
    });
  };

  // キャラクターの基本ステータスを計算（twstsimu.jsのchangeLevel関数に合わせる）
  function calculateBaseStats(character: Character) {
    const rare = character.rare;
    const level = character.level;
    const levelDict: Record<string, number> = {'R':70,'SR':90,'SSR':110}
    const maxLevel = levelDict[rare as keyof typeof levelDict] || 110; // hiddenLv

    // 基本ステータスを計算（不正な値の場合は0を使用）
    const maxATK = Number(character.max_atk) || 0;
    const maxHP = Number(character.max_hp) || 0;
    const baseATK = Number(character.base_atk) || Math.floor(maxATK / (character.rare === 'SSR' ? 4.7 : character.rare === 'SR' ? 4.3 : 4.2));
    const baseHP = Number(character.base_hp) || Math.floor(maxHP / (character.rare === 'SSR' ? 4.7 : character.rare === 'SR' ? 4.3 : 4.2));

    // ボーナスステータス（20%）- twstsimu.jsと同じ
    const bonusATK = baseATK * 0.2;
    const bonusHP = baseHP * 0.2;

    // レベルごとの成長量を計算 - twstsimu.jsの計算式と同じ
    const ATKperLv = maxLevel > 1 ? (maxATK - 2 * bonusATK - baseATK) / (maxLevel - 1) : 0;
    const HPperLv = maxLevel > 1 ? (maxHP - 2 * bonusHP - baseHP) / (maxLevel - 1) : 0;

    // 現在のレベルでのステータスを計算 - twstsimu.jsと同じ
    const levelDiff = maxLevel - level; // leveldef = hiddenLv - inLv
    
    // totsurate: 凸選択状態 (1 = 未凸, 0 = 凸済み)
    const totsurate = character.isBonusSelected ? 0 : 1;
    
    // twstsimu.jsと同じ計算式で小数点第1位まで計算
    const calculatedATK = (maxATK - ATKperLv * levelDiff) - bonusATK * totsurate;
    const calculatedHP = (maxHP - HPperLv * levelDiff) - bonusHP * totsurate;
    
    return {
      atk: Math.max(0, Number(calculatedATK.toFixed(1))),
      hp: Math.max(0, Number(calculatedHP.toFixed(1)))
    };
  }

  function addCharacter(character: Partial<Character>) {
    deckCharacters.push({ ...createDefaultCharacter(), ...character });
  }

  function removeCharacter(index: number) {
    deckCharacters.splice(index, 1);
  }


  function setSelectedAttribute(attribute: string) {
    selectedAttribute.value = attribute;
  }

  // キャラクターのレベルを更新
  function updateLevel(index: number, level: number) {
    const character = deckCharacters[index];
    const oldLevel = character.level;
    
    // レベルが有効な範囲内かチェック
    const maxLevel = character.rare === 'SSR' ? 110 : character.rare === 'SR' ? 90 : 70;
    const validLevel = Math.max(0, Math.min(level, maxLevel));
    
    character.level = validLevel;
    
    // レベルが変更された場合のみ再計算
    if (oldLevel !== validLevel) {
      const newStats = calculateBaseStats(character);
      // 必要な値のみを更新
      character.atk = newStats.atk;
      character.hp = newStats.hp;
      // レベル更新後に再計算
      characterStats.value[index] = calculateCharacterStats(character, charaDict.value);
    }
  }

  // キャラクター選択時の処理 - 最適化: 個別キャラクターの更新
  function selectCharacter(index: number, character: any) {
    // 最大HPと最大ATKを保存
    character.max_hp = character.hp;
    character.max_atk = character.atk;
    
    const oldChara = deckCharacters[index].chara;
    Object.assign(deckCharacters[index], character);
    
    // バフの初期値を設定
    if (!deckCharacters[index].buffs) {
      deckCharacters[index].buffs = [];
    }
    
    // キャラクター選択時のみデュオ状態を強制更新
    if (oldChara !== character.chara) {
      // 全キャラクターのデュオ状態を更新（キャラクター選択時のみ）
      deckCharacters.forEach(char => updateDuoStatus(char, charaDict.value, true));
    }
    
    // キャラクターが変更された場合は常に再計算
    characterStats.value[index] = calculateCharacterStats(deckCharacters[index], charaDict.value);
    
    // デュオ関連のキャラクターがある場合は全体を再計算
    if (character.duo || deckCharacters.some(c => c.duo === oldChara || c.duo === character.chara)) {
      recalculateStats();
    } else if (oldChara !== character.chara) {
      // 新しいキャラクターが選択された場合も全体を再計算（同じキャラクターの重複対応）
      recalculateStats();
    }
  }

  // 全キャラクターのステータスを再計算 - 最適化: デバウンス適用
  function calculateAllStats() {
    recalculateStats();
  }

  // バフの更新処理 - 最適化: 個別バフの更新
  function updateBuff(index: number, buffIndex: number, buff: any) {
    if (!deckCharacters[index].buffs) {
      deckCharacters[index].buffs = [];
    }
    
    const currentBuff = deckCharacters[index].buffs[buffIndex];
    const hasChanged = !currentBuff || 
      currentBuff.buffOption !== buff.buffOption ||
      currentBuff.powerOption !== buff.powerOption ||
      currentBuff.levelOption !== buff.levelOption ||
      currentBuff.magicOption !== buff.magicOption;
    
    if (hasChanged) {
      // バフの初期値を設定
      const updatedBuff = {
        ...buff,
        levelOption: buff.levelOption || '10',
        powerOption: buff.powerOption || '小'
      };
      deckCharacters[index].buffs[buffIndex] = updatedBuff;
      
      characterStats.value[index] = calculateCharacterStats(deckCharacters[index], charaDict.value);
    }
  }

  return {
    deckCharacters,
    selectedAttribute,
    characterStats,
    deckStats,
    getDamageByAttribute,
    addCharacter,
    removeCharacter,
    setSelectedAttribute,
    updateLevel,
    calculateBaseStats,
    selectCharacter,
    calculateAllStats,
    updateBuff,
    charaDict,
    calculateCharacterStats
  };
});
