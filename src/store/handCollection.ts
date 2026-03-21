import { defineStore } from 'pinia';
import { ref, computed, reactive } from 'vue';
import { clampTotsuCount, deriveTotsuCount, isM3Unlocked, isMaxLimitBreak } from '@/utils/totsu';

// 手持ちカードの設定インターフェース
export interface HandCard {
  characterName: string;
  cardName: string;
  isOwned: boolean;
  level: number;
  totsu: number;
  isLimitBreak: boolean;
  isM3: boolean;
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
    totsu: 0,
    isLimitBreak: false,
    isM3: false,
  };
}

function normalizeHandCard(cardName: string, value?: Partial<HandCard> | null): HandCard {
  const base = createDefaultHandCard(cardName);
  const raw = value || {};
  const totsu = clampTotsuCount(deriveTotsuCount(raw));

  return {
    ...base,
    ...raw,
    cardName,
    totsu,
    isLimitBreak: isMaxLimitBreak(totsu),
    isM3: isM3Unlocked('SSR', totsu),
  };
}

// localStorageから手持ちコレクションを読み込み
function loadHandCollection(): HandCollection {
  try {
    const stored = localStorage.getItem(HAND_COLLECTION_STORAGE_KEY);
    if (!stored) return {};

    const parsed = JSON.parse(stored) as HandCollection;
    const normalized: HandCollection = {};
    Object.entries(parsed || {}).forEach(([cardName, handCard]) => {
      normalized[cardName] = normalizeHandCard(cardName, handCard);
    });
    return normalized;
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
  const useHandCollection = ref<boolean>(false);
  
  // 同一セッション内でのモーダル表示回数を追跡
  let modalOpenCount = 0;

  function peekHandCard(cardName: string): HandCard | undefined {
    return handCollection[cardName];
  }

  // 指定されたカード名の手持ち設定を取得
  function getHandCard(cardName: string): HandCard {
    if (!handCollection[cardName]) {
      handCollection[cardName] = createDefaultHandCard(cardName);
    }
    
    return handCollection[cardName];
  }

  // 手持ちカード設定を更新
  function updateHandCard(cardName: string, updates: Partial<HandCard>): void {
    const normalized = normalizeHandCard(cardName, {
      ...getHandCard(cardName),
      ...updates,
    });
    handCollection[cardName] = normalized;
  }

  // キャラクターの所持状況を確認
  function isCharacterOwned(cardName: string): boolean {
    return !!peekHandCard(cardName)?.isOwned;
  }

  // 所持しているカードのみを取得
  const ownedCards = computed(() => {
    return Object.values(handCollection).filter(card => card.isOwned);
  });

  // 手持ちコレクション使用設定を設定
  function setUseHandCollection(use: boolean): void {
    useHandCollection.value = use;
  }
  
  // モーダル表示回数をインクリメント
  function incrementModalOpenCount(): void {
    modalOpenCount++;
  }
  
  // 初回モーダル表示かどうかを判定
  function isFirstModalOpen(): boolean {
    return modalOpenCount === 0;
  }

  // 手持ちコレクションを手動で保存
  function saveHandCollectionManually(): void {
    saveHandCollection(handCollection);
  }

  // 手持ち設定が何も設定されていないかを判定
  const hasAnyHandSettings = computed(() => {
    // 所持カードが1枚以上あるかをチェック
    return ownedCards.value.length > 0;
  });


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
    hasAnyHandSettings,
    stats,
    
    // Actions
    peekHandCard,
    getHandCard,
    updateHandCard,
    isCharacterOwned,
    setUseHandCollection,
    saveHandCollectionManually,
    incrementModalOpenCount,
    isFirstModalOpen,
  };
});
