import { defineStore } from 'pinia';
import { ref, computed, reactive, onScopeDispose } from 'vue';
import { HAND_COLLECTION_STORAGE_KEY, HandCollectionStorageError, readHandCollectionSnapshot, saveStoredHandCollection, validateHandCollection } from '@/storage/handCollectionStorage';
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

function normalizeCollection(collection: HandCollection): HandCollection {
  return Object.fromEntries(Object.entries(collection).map(([name, card]) => [name, normalizeHandCard(name, card)]));
}


export const useHandCollectionStore = defineStore('handCollection', () => {
  // 手持ちコレクションのstate - reactiveを使用してdeep reactivityを確保
  const handCollection = reactive<HandCollection>({});
  const savedState = ref('{}');
  const loadFailed = ref(false);
  const saveFailed = ref(false);
  const hasConflict = ref(false);
  const draftFailed = ref(false);
  const saving = ref(false);
  const hasUnsavedChanges = computed(() => JSON.stringify(handCollection) !== savedState.value);
  let savedRaw: string | null = null;
  let draftBaseRaw: string | null = null;
  let replacing = false;
  const draftKey = `${HAND_COLLECTION_STORAGE_KEY}-draft-v1`;

  function replaceCollection(collection: HandCollection) {
    Object.keys(handCollection).forEach(key => delete handCollection[key]);
    Object.assign(handCollection, collection);
  }

  // Called explicitly by the recovery UI; read successfully before discarding edits.
  function reloadHandCollection(): boolean {
    try {
      const snapshot = readHandCollectionSnapshot();
      const normalized = normalizeCollection(snapshot.data);
      replacing = true;
      replaceCollection(normalized);
      savedRaw = snapshot.raw;
      draftBaseRaw = snapshot.raw;
      savedState.value = JSON.stringify(normalized);
      loadFailed.value = false;
      hasConflict.value = false;
      saveFailed.value = false;
      return true;
    } catch (error) {
      loadFailed.value = true;
      console.warn('Failed to load hand collection:', error);
      return false;
    } finally {
      replacing = false;
    }
  }

  reloadHandCollection();

  // A tab's unsaved edits survive reloads without overwriting committed data or
  // another tab's draft. Draft recovery never changes the saved baseline.
  try {
    const raw = window.sessionStorage.getItem(draftKey);
    if (raw) {
      const draft = JSON.parse(raw);
      if (draft.version !== 1 || !(draft.baseRaw === null || typeof draft.baseRaw === 'string')) {
        throw new Error('Invalid hand collection draft');
      }
      replaceCollection(normalizeCollection(validateHandCollection(draft.data)));
      draftBaseRaw = draft.baseRaw;
      hasConflict.value = !loadFailed.value && draft.baseRaw !== savedRaw && hasUnsavedChanges.value;
    }
  } catch (error) {
    draftFailed.value = true;
    console.warn('Failed to restore hand collection draft:', error);
  }

  function persistDraft() {
    if (replacing) return;
    try {
      if (hasUnsavedChanges.value) {
        // Preserve the original base on conflicts, so reloading cannot turn an
        // unresolved draft into an apparently safe replacement of newer data.
        window.sessionStorage.setItem(draftKey, JSON.stringify({ version: 1, baseRaw: draftBaseRaw, data: handCollection }));
      } else {
        window.sessionStorage.removeItem(draftKey);
      }
      draftFailed.value = false;
    } catch (error) {
      draftFailed.value = true;
      console.warn('Failed to save hand collection draft:', error);
    }
  }
  // Bulk edits write one draft; serializing every intermediate card is costly
  // on phones. All editor mutations go through updateHandCard.
  function batchUpdates(update: () => void) {
    const wasReplacing = replacing;
    replacing = true;
    try { update(); } finally {
      replacing = wasReplacing;
      persistDraft();
    }
  }

  function resetUnsavedChanges() {
    replacing = true;
    replaceCollection(JSON.parse(savedState.value));
    replacing = false;
    saveFailed.value = false;
    persistDraft();
  }

  function refreshFromStorage() {
    if (saving.value) return;
    try {
      const snapshot = readHandCollectionSnapshot();
      if (snapshot.raw !== savedRaw) {
        if (hasUnsavedChanges.value || loadFailed.value) hasConflict.value = true;
        else reloadHandCollection();
      }
    } catch (error) {
      loadFailed.value = true;
      console.warn('Failed to refresh hand collection:', error);
    }
  }
  const onStorage = (event: StorageEvent) => {
    if (event.key === HAND_COLLECTION_STORAGE_KEY || event.key === null) refreshFromStorage();
  };
  const onVisibility = () => {
    if (document.visibilityState === 'hidden') persistDraft();
    else refreshFromStorage();
  };
  if (typeof window !== 'undefined') {
    window.addEventListener('storage', onStorage);
    window.addEventListener('pageshow', refreshFromStorage);
    if (typeof document !== 'undefined') document.addEventListener('visibilitychange', onVisibility);
    onScopeDispose(() => {
      window.removeEventListener('storage', onStorage);
      window.removeEventListener('pageshow', refreshFromStorage);
      if (typeof document !== 'undefined') document.removeEventListener('visibilitychange', onVisibility);
    });
  }
  
  // 手持ちから選択するかフルステータスから選択するかの設定
  const useHandCollection = ref<boolean>(false);
  
  // 同一セッション内でのモーダル表示回数を追跡
  let modalOpenCount = 0;

  function peekHandCard(cardName: string): HandCard | undefined {
    return handCollection[cardName];
  }

  // 指定されたカード名の手持ち設定を取得
  function getHandCard(cardName: string): HandCard {
    return handCollection[cardName] ?? createDefaultHandCard(cardName);
  }

  // 手持ちカード設定を更新
  function updateHandCard(cardName: string, updates: Partial<HandCard>): void {
    const normalized = normalizeHandCard(cardName, {
      ...getHandCard(cardName),
      ...updates,
    });
    handCollection[cardName] = normalized;
    persistDraft();
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
  async function saveHandCollectionManually(): Promise<void> {
    if (saving.value) throw new Error('Hand collection save already in progress');
    if (loadFailed.value) throw new HandCollectionStorageError('unavailable');
    if (hasConflict.value) throw new HandCollectionStorageError('conflict');
    saving.value = true;
    const snapshot = JSON.stringify(handCollection);
    try {
      savedRaw = await saveStoredHandCollection(JSON.parse(snapshot), savedRaw);
      draftBaseRaw = savedRaw;
      savedState.value = snapshot;
      saveFailed.value = false;
      persistDraft();
    } catch (error) {
      saveFailed.value = true;
      if (error instanceof HandCollectionStorageError && error.reason === 'conflict') hasConflict.value = true;
      throw error;
    } finally {
      saving.value = false;
    }
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
    hasUnsavedChanges,
    loadFailed,
    saveFailed,
    hasConflict,
    draftFailed,
    saving,
    
    // Computed
    ownedCards,
    hasAnyHandSettings,
    stats,
    
    // Actions
    peekHandCard,
    getHandCard,
    updateHandCard,
    batchUpdates,
    isCharacterOwned,
    setUseHandCollection,
    saveHandCollectionManually,
    resetUnsavedChanges,
    reloadHandCollection: () => {
      const loaded = reloadHandCollection();
      if (loaded) persistDraft();
      return loaded;
    },
    incrementModalOpenCount,
    isFirstModalOpen,
  };
});
