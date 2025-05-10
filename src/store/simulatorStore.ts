import { defineStore } from 'pinia';
import { ref, computed, reactive, watch } from 'vue';
import { calculateCharacterStats } from '@/utils/calculations';


// キャラクターのインターフェースを定義
interface Character {
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
  magic2power?: string;
  magic2pow?: string;
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
  magic1heal: 'SSR1',
  magic2heal: 'SSR1',
  magic3heal: 'SSR1',
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
  isBonusSelected: false
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

  // デッキのキャラクター名の集合を作成
  const charaDict = computed(() => {
    const dict: { [key: string]: string } = {};
    deckCharacters.forEach(char => {
      if (char.chara) dict[char.chara] = char.chara;
    });
    return dict;
  });

  // 計算済みのステータスを保持
  const characterStats = ref(deckCharacters.map(char => calculateCharacterStats(char, charaDict.value)));

  // デュオの判定と設定を行う関数
  function updateDuoStatus(character: Character, dict: { [key: string]: string }) {
    if (character.duo && dict[character.duo]) {
      character.magic2power = 'デュオ';
    } else if (character.duo && !dict[character.duo]) {
      character.magic2power = character.magic2pow || '連撃(強)';
    }
  }

  // charaDictの変更を監視して全キャラクターのステータスを再計算
  watch(charaDict, (newDict) => {
    deckCharacters.forEach(character => updateDuoStatus(character, newDict));
    characterStats.value = deckCharacters.map(char => calculateCharacterStats(char, newDict));
  });

  // デッキのキャラクターの変更を監視
  watch(deckCharacters, () => {
    deckCharacters.forEach(character => updateDuoStatus(character, charaDict.value));
    characterStats.value = deckCharacters.map(char => calculateCharacterStats(char, charaDict.value));
  }, { deep: true });

  // バフの変更を監視
  watch(() => deckCharacters.map(char => char.buffs), () => {
    characterStats.value = deckCharacters.map(char => calculateCharacterStats(char, charaDict.value));
  }, { deep: true });

  // デッキ全体のステータスを計算
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
      Object.entries(charStats.damage).forEach(([attribute, damage]) => {
        stats.totalDamage[attribute] = (stats.totalDamage[attribute] || 0) + damage;
      });
    });

    return stats;
  });

  // 属性ごとのダメージを取得
  const getDamageByAttribute = (attribute: string) => {
    return characterStats.value.map(charStats => charStats.damage[attribute] || 0);
  };

  // キャラクターの基本ステータスを計算
  function calculateBaseStats(character: Character) {
    const rare = character.rare;
    const level = character.level;
    const levelDict: Record<string, number> = {'R':70,'SR':90,'SSR':110}
    const maxLevel = levelDict[rare as keyof typeof levelDict] || 110; // 最大レベルを設定

    // 基本ステータスを計算（不正な値の場合は0を使用）
    const maxATK = Number(character.max_atk) || 0;
    const maxHP = Number(character.max_hp) || 0;
    const baseATK = Number(character.base_atk) || Math.floor(maxATK / (character.rare === 'SSR' ? 4.7 : character.rare === 'SR' ? 4.3 : 4.2));
    const baseHP = Number(character.base_hp) || Math.floor(maxHP / (character.rare === 'SSR' ? 4.7 : character.rare === 'SR' ? 4.3 : 4.2));

    // ボーナスステータス（20%）
    const bonusATK = baseATK * 0.2;
    const bonusHP = baseHP * 0.2;

    // ボーナス選択状態を確認
    const isBonusSelected = Boolean(character.isBonusSelected);
    
    // レベルごとの成長量を計算（不正な値の場合は0を使用）
    const ATKperLv = maxLevel > 1 ? (maxATK - 2 * bonusATK - baseATK) / (maxLevel - 1) : 0;
    const HPperLv = maxLevel > 1 ? (maxHP - 2 * bonusHP - baseHP) / (maxLevel - 1) : 0;

    // 現在のレベルでのステータスを計算
    const levelDiff = Math.max(0, maxLevel - level);
    
    // 必要な値のみを更新
    return {
      atk: Math.max(0, Math.floor((maxATK - ATKperLv * levelDiff) - (isBonusSelected ? 0 : bonusATK))),
      hp: Math.max(0, Math.floor((maxHP - HPperLv * levelDiff) - (isBonusSelected ? 0 : bonusHP)))
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

  // キャラクター選択時の処理
  function selectCharacter(index: number, character: any) {
    // 最大HPと最大ATKを保存
    character.max_hp = character.hp;
    character.max_atk = character.atk;
    
    Object.assign(deckCharacters[index], character);
    // バフの初期値を設定
    if (!deckCharacters[index].buffs) {
      deckCharacters[index].buffs = [];
    }
    characterStats.value[index] = calculateCharacterStats(deckCharacters[index], charaDict.value);
  }

  // 全キャラクターのステータスを再計算
  function calculateAllStats() {
    deckCharacters.forEach(character => updateDuoStatus(character, charaDict.value));
    characterStats.value = deckCharacters.map(char => calculateCharacterStats(char, charaDict.value));
  }

  // バフの更新処理
  function updateBuff(index: number, buffIndex: number, buff: any) {
    if (!deckCharacters[index].buffs) {
      deckCharacters[index].buffs = [];
    }
    // バフの初期値を設定
    const updatedBuff = {
      ...buff,
      levelOption: buff.levelOption || '10',
      powerOption: buff.powerOption || '小'
    };
    deckCharacters[index].buffs[buffIndex] = updatedBuff;
    characterStats.value[index] = calculateCharacterStats(deckCharacters[index], charaDict.value);
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
