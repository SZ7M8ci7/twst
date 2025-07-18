import { defineStore } from 'pinia';
import { ref, computed, triggerRef, reactive } from 'vue';

// 手持ちカードの設定インターフェース
export interface HandCard {
  characterName: string;
  cardName: string;
  isOwned: boolean;
  level: number;
  isLimitBreak: boolean; // 完凸状況
  isM3: boolean; // M3状況（完凸時は自動的にtrue）
}

// 全体の手持ちコレクション（カード名のみ）
export interface HandCollection {
  [cardName: string]: HandCard;
}

// localStorageのキー
const HAND_COLLECTION_STORAGE_KEY = 'twst-hand-collection';

// デフォルトの手持ちカード設定を作成
function createDefaultHandCard(cardName: string): HandCard {
  // cardNameから推測できる場合はcharacterNameを設定、そうでなければ空文字
  const characterName = ''; // 必要に応じて推測ロジックを追加
  
  return {
    characterName,
    cardName,
    isOwned: false,
    level: 0,
    isLimitBreak: false,
    isM3: false,
  };
}

// レア度に応じた最大レベルを取得
function getMaxLevel(rare: string): number {
  switch (rare) {
    case 'SSR': return 110;
    case 'SR': return 90;
    case 'R': return 70;
    default: return 70;
  }
}

// localStorageから手持ちコレクションを読み込み
function loadHandCollection(): HandCollection {
  try {
    const stored = localStorage.getItem(HAND_COLLECTION_STORAGE_KEY);
    return stored ? JSON.parse(stored) : {};
  } catch (error) {
    console.warn('Failed to load hand collection from localStorage:', error);
    return {};
  }
}

// localStorageに手持ちコレクションを保存
function saveHandCollection(collection: HandCollection): void {
  try {
    localStorage.setItem(HAND_COLLECTION_STORAGE_KEY, JSON.stringify(collection));
  } catch (error) {
    console.warn('Failed to save hand collection to localStorage:', error);
  }
}

export const useHandCollectionStore = defineStore('handCollection', () => {
  // 手持ちコレクションのstate - reactiveを使用してdeep reactivityを確保
  const handCollection = reactive<HandCollection>(loadHandCollection());
  
  // 手持ちから選択するかフルステータスから選択するかの設定
  const useHandCollection = ref<boolean>(true);

  // 指定されたカード名の手持ち設定を取得
  function getHandCard(cardName: string): HandCard {
    if (!handCollection[cardName]) {
      handCollection[cardName] = createDefaultHandCard(cardName);
    }
    
    return handCollection[cardName];
  }

  // 手持ちカード設定を更新
  function updateHandCard(cardName: string, updates: Partial<HandCard>): void {
    const handCard = getHandCard(cardName);
    
    // 更新を適用
    Object.assign(handCard, updates);
    
    // 完凸状況が変更された場合、M3状況も自動調整
    if ('isLimitBreak' in updates) {
      if (updates.isLimitBreak) {
        handCard.isM3 = true; // 完凸時は自動的にM3もtrue
      }
    }
  }

  // キャラクターの所持状況を確認
  function isCharacterOwned(cardName: string): boolean {
    const handCard = getHandCard(cardName);
    return handCard.isOwned;
  }

  // 所持しているカードのみを取得
  const ownedCards = computed(() => {
    return Object.values(handCollection).filter(card => card.isOwned);
  });

  // 手持ちコレクション使用設定を設定
  function setUseHandCollection(use: boolean): void {
    useHandCollection.value = use;
  }

  // 手持ちコレクションを手動で保存
  function saveHandCollectionManually(): void {
    saveHandCollection(handCollection);
  }

  // エクスポート用の統計情報
  const stats = computed(() => ({
    totalCards: Object.keys(handCollection).length,
    ownedCardsCount: ownedCards.value.length,
    limitBreakCardsCount: ownedCards.value.filter(card => card.isLimitBreak).length,
    m3CardsCount: ownedCards.value.filter(card => card.isM3).length,
  }));

  return {
    // State
    handCollection,
    useHandCollection,
    
    // Computed
    ownedCards,
    stats,
    
    // Actions
    getHandCard,
    updateHandCard,
    isCharacterOwned,
    setUseHandCollection,
    saveHandCollectionManually,
  };
});