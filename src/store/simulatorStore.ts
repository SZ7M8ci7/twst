import { defineStore } from 'pinia';
import { ref, computed, reactive, watch, nextTick } from 'vue';
import { calculateCharacterStats, recalculateHP, recalculateATK } from '@/utils/calculations';
import { useHandCollectionStore } from '@/store/handCollection';

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
  // 手持ちコレクションストアへの参照
  const handCollectionStore = useHandCollectionStore();

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

  // 計算済みのステータスを保持（初期化時は空の辞書を使用）
  const characterStats = ref(deckCharacters.map(char => calculateCharacterStats(char, {})));
  
  const isCalculating = ref(false);
  
  const needsRecalculation = ref(false);
  
  // 初期化状態を管理
  const isInitialized = ref(false);
  
  // deckStatsの初期化完了を待つ
  const isDeckStatsReady = ref(false);

  // デュオの判定と設定を行う関数（キャラクター選択時のみ実行）
  function updateDuoStatus(character: Character, dict: { [key: string]: boolean }, forceUpdate = false) {
    if (!forceUpdate) return; // forceUpdateがtrueの場合のみ実行
    
    if (character.duo && dict[character.duo]) {
      character.magic2Power = 'デュオ';
    } else if (character.duo && !dict[character.duo]) {
      character.magic2Power = character.magic2pow || '連撃(強)';
    }
  }

  // レア度に応じてマジックが有効かどうかを判定するヘルパー関数
  function isMagicValidForRarity(character: Character, magicIndex: number): boolean {
    if (!character || !character.rare) return true;
    
    // R、SRの場合はM3を無効
    if ((character.rare === 'R' || character.rare === 'SR') && magicIndex === 3) {
      return false;
    }
    
    return true;
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
        const character = deckCharacters[i];
        
        // デッキ内のキャラクターは手持ち設定に関係なく、ユーザーが設定した値を使用
        newStats.push(calculateCharacterStats(character, currentCharaDict));
        if (i < deckCharacters.length - 1) await new Promise(r => setTimeout(r, 0));
      }
      
      characterStats.value = newStats;
      
      // 初期化完了後にdeckStatsの準備完了を設定
      if (!isInitialized.value) {
        isInitialized.value = true;
      }
      
      // deckStatsの準備完了を設定
      isDeckStatsReady.value = true;
    } finally {
      isCalculating.value = false;
      
      if (needsRecalculation.value) {
        needsRecalculation.value = false;
        // 非同期で実行して本番環境でのstack overflowを防ぐ
        setTimeout(() => recalculateStats(), 0);
      }
    }
  }, 100);

  // charaDictの変更を監視して全キャラクターのステータスを再計算
  watch(charaDict, (newDict, oldDict) => {
    // Only recalculate if the dictionary actually changed
    if (JSON.stringify(newDict) !== JSON.stringify(oldDict)) {
      recalculateStats();
    }
  });

  // デッキのキャラクターの変更を監視 - 最適化: 個別のプロパティを監視
  watch(() => deckCharacters.map(char => ({
    chara: char.chara,
    level: char.level,
    hp: char.hp,
    atk: char.atk,
    rare: char.rare,
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
    // レア度変更によるM3の自動無効化をチェック
    if (oldVal) {
      newVal.forEach((newChar, index) => {
        const oldChar = oldVal[index];
        if (oldChar && newChar.rare !== oldChar.rare) {
          // レア度が変更された場合、R/SRならM3を無効化
          if ((newChar.rare === 'R' || newChar.rare === 'SR') && deckCharacters[index].isM3Selected) {
            deckCharacters[index].isM3Selected = false;
          }
        }
      });
    }
    
    // Only recalculate if something actually changed
    if (JSON.stringify(newVal) !== JSON.stringify(oldVal)) {
      recalculateStats();
    }
  });

  // バフの変更を監視 - 最適化: 個別のバフ監視
  watch(() => deckCharacters.map(char => 
    char.buffs ? JSON.stringify(char.buffs) : ''
  ), (newVal, oldVal) => {
    // Only recalculate if buffs actually changed
    if (JSON.stringify(newVal) !== JSON.stringify(oldVal)) {
      recalculateStats();
    }
  });

  // 手持ちコレクションの変更を監視
  watch(handCollectionStore.handCollection, () => {
    recalculateStats();
  }, { deep: true });

  // 手持ちコレクション使用設定の変更を監視
  watch(() => handCollectionStore.useHandCollection, () => {
    recalculateStats();
  });

  // デッキ全体のステータスを計算 - 最適化: 型安全性の向上
  const deckStats = computed(() => {
    const stats = {
      totalHP: 0,
      totalBuddyHP: 0,
      totalHeal: 0,
      totalDamage: {} as { [key: string]: number }
    };

    characterStats.value.forEach((charStats, index) => {
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


  // deckStatsの初期化を待機してから取得する関数
  const waitForDeckStats = async (): Promise<typeof deckStats.value> => {
    // 既に準備完了している場合は即座に返す
    if (isDeckStatsReady.value) {
      return deckStats.value;
    }
    
    // 計算中の場合は完了を待つ
    if (isCalculating.value) {
      return new Promise((resolve) => {
        const checkReady = () => {
          if (isDeckStatsReady.value && !isCalculating.value) {
            resolve(deckStats.value);
          } else {
            setTimeout(checkReady, 50);
          }
        };
        checkReady();
      });
    }
    
      // 初期化が必要な場合は実行してから待つ
    if (!isInitialized.value) {
      // 初期計算を実行
      await recalculateStats();
      return new Promise((resolve) => {
        const checkReady = () => {
          if (isDeckStatsReady.value && !isCalculating.value) {
            resolve(deckStats.value);
          } else {
            setTimeout(checkReady, 50);
          }
        };
        checkReady();
      });
    }
    
    return deckStats.value;
  };

  // 安全にdeckStatsのダメージを取得する関数
  const getSafeDeckDamage = async (attribute: string = '対全'): Promise<number> => {
    try {
      const stats = await waitForDeckStats();
      
      if (!stats || !stats.totalDamage) {
        return 0;
      }
      
      // 属性に応じてダメージを取得
      if (attribute === '対全') {
        // 全属性の最大値を取得
        const damages = Object.values(stats.totalDamage).map(d => Number(d) || 0);
        return Math.max(...damages, 0);
      } else {
        // 特定属性のダメージを取得（例: '対火' -> '火'）
        const targetAttribute = attribute.replace('対', '');
        return Number(stats.totalDamage[targetAttribute]) || 0;
      }
    } catch (error) {
      return 0;
    }
  };

  // キャラクターの基本ステータスを計算（twstsimu.jsのchangeLevel関数に合わせる）
  function calculateBaseStats(character: Character) {
    return {
      atk: recalculateATK(character, character.level, character.isBonusSelected),
      hp: recalculateHP(character, character.level, character.isBonusSelected)
    };
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
  function selectCharacter(index: number, character: any, ignoreHandCollection = false) {
    // 最大HPと最大ATKを保存（常にフルステータスの最大値を使用）
    // originalMaxHP/originalMaxATKがある場合はそれを使用、なければ現在の値を使用
    character.max_hp = character.originalMaxHP || character.hp;
    character.max_atk = character.originalMaxATK || character.atk;
    
    const levelDict = {'R': 70, 'SR': 90, 'SSR': 110};
    // 現在の手持ち設定に基づいてHP/ATKを再計算
    // これにより、手持ち設定が変更された後の置き換えでも正しいステータスが適用される
    // ignoreHandCollectionがtrueの場合は手持ち設定を無視
    if (!ignoreHandCollection && handCollectionStore.useHandCollection) {
      const handCard = handCollectionStore.getHandCard(character.name);
      if (handCard.isOwned) {
        // 手持ち設定ONで所持している場合、手持ちレベルで再計算
        character.level = Number(handCard.level);
        character.hp = recalculateHP(character, Number(handCard.level), handCard.isLimitBreak);
        character.atk = recalculateATK(character, Number(handCard.level), handCard.isLimitBreak);
        character.isBonusSelected = handCard.isLimitBreak;
        character.hasM3 = handCard.isM3;
      } else {
        // 手持ち設定ONで所持していない場合、完凸で計算
        character.level = levelDict[character.rare as keyof typeof levelDict] || 110;
        character.hp = recalculateHP(character, character.level, true);
        character.atk = recalculateATK(character, character.level, true);
        character.isBonusSelected = true;
        character.hasM3 = true;
      }
    } else if (!ignoreHandCollection) {
      // 手持ち設定OFFの場合のみ、フルステータスを使用
      // originalMaxHP/ATKがある場合はそれを使用
      if (character.originalMaxHP) {
        character.hp = character.originalMaxHP;
      }
      if (character.originalMaxATK) {
        character.atk = character.originalMaxATK;
      }
      // フルステータスの場合の設定
      character.level = levelDict[character.rare as keyof typeof levelDict] || 110;
      character.isBonusSelected = true;
      character.hasM3 = true;
    }
    // ignoreHandCollectionがtrueの場合は、既に設定されているレベルでHP/ATKを再計算
    else if (ignoreHandCollection) {
      character.hp = recalculateHP(character, character.level, character.isBonusSelected);
      character.atk = recalculateATK(character, character.level, character.isBonusSelected);
    }
    
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



  return {
    deckCharacters,
    selectedAttribute,
    characterStats,
    deckStats,
    updateLevel,
    calculateBaseStats,
    selectCharacter,
    recalculateStats,
    charaDict,
    calculateCharacterStats,
    isInitialized,
    isDeckStatsReady,
    waitForDeckStats,
    getSafeDeckDamage,
    isMagicValidForRarity
  };
});

