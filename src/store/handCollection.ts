import { defineStore } from 'pinia';
import { ref, computed, reactive, onScopeDispose } from 'vue';
import { HAND_COLLECTION_STORAGE_KEY, HandCollectionStorageError, readHandCollectionSnapshot, saveStoredHandCollectionDocument, validateHandCollection, validateHandCollectionDocument, createHandCollectionSetsBackup, type HandCollectionDocument, type HandCollectionSet } from '@/storage/handCollectionStorage';
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
  const savedSets = ref<HandCollectionSet[]>([]);
  const activeSetId = ref<string | null>(null);
  const activeSlot = ref(1);
  const slots = computed(() => [1, 2, 3, 4, 5].map(slot => {
    const set = savedSets.value.find(item => item.slot === slot) ?? null;
    return { slot, set, savedSet: set };
  }));
  const activeSet = computed(() => savedSets.value.find(set => set.id === activeSetId.value) ?? null);
  const nameDraft = ref<string | null>(null);
  const hasUnsavedNameChanges = computed(() => nameDraft.value !== null && nameDraft.value !== (activeSet.value?.name ?? ''));
  const maxSets = 5;
  const collectionContextRevision = ref(0);
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
      const sets = snapshot.sets.map(set => ({ ...set, data: normalizeCollection(set.data) }));
      replacing = true;
      replaceCollection(normalized);
      savedSets.value = sets;
      activeSetId.value = snapshot.activeSetId;
      activeSlot.value = snapshot.activeSlot ?? 1;
      savedRaw = snapshot.raw;
      draftBaseRaw = snapshot.raw;
      savedState.value = JSON.stringify(normalized);
      loadFailed.value = false;
      hasConflict.value = false;
      saveFailed.value = false;
      nameDraft.value = null;
      collectionContextRevision.value++;
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
      if (![1, 2].includes(draft.version) || !(draft.baseRaw === null || typeof draft.baseRaw === 'string') ||
          (draft.version === 2 && !(draft.activeSetId === null || typeof draft.activeSetId === 'string'))) {
        throw new Error('Invalid hand collection draft');
      }
      const id = draft.version === 2 ? draft.activeSetId : activeSetId.value;
      const original = savedSets.value.find(set => set.id === id);
      const slot = draft.activeSlot ?? original?.slot ?? activeSlot.value;
      if (!Number.isInteger(slot) || slot < 1 || slot > 5 ||
          (draft.baseRaw === savedRaw && (savedSets.value.find(set => set.slot === slot)?.id ?? null) !== id)) {
        throw new Error('Draft set does not exist');
      }
      const recovered = normalizeCollection(validateHandCollection(draft.data));
      activeSetId.value = original ? id : null;
      activeSlot.value = slot;
      savedState.value = JSON.stringify(original?.data ?? {});
      replaceCollection(recovered);
      draftBaseRaw = draft.baseRaw;
      hasConflict.value = !loadFailed.value && draft.baseRaw !== savedRaw;
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
        window.sessionStorage.setItem(draftKey, JSON.stringify({ version: 2, baseRaw: draftBaseRaw, activeSetId: activeSetId.value, activeSlot: activeSlot.value, data: handCollection }));
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
    assertEditable();
    const wasReplacing = replacing;
    replacing = true;
    try { update(); } finally {
      replacing = wasReplacing;
      persistDraft();
    }
  }

  function resetUnsavedChanges() {
    assertEditable();
    replacing = true;
    replaceCollection(JSON.parse(savedState.value));
    collectionContextRevision.value++;
    replacing = false;
    saveFailed.value = false;
    persistDraft();
  }

  function refreshFromStorage() {
    if (saving.value) return;
    try {
      const snapshot = readHandCollectionSnapshot();
      if (snapshot.raw !== savedRaw) {
        if (hasUnsavedChanges.value || hasUnsavedNameChanges.value || loadFailed.value || hasConflict.value) hasConflict.value = true;
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
    assertEditable();
    const normalized = normalizeHandCard(cardName, {
      ...getHandCard(cardName),
      ...updates,
    });
    handCollection[cardName] = normalized;
    persistDraft();
  }

  // 取り込み前に存在しなかった設定を、取り消し時に戻す。
  function removeHandCard(cardName: string): void {
    assertEditable();
    delete handCollection[cardName];
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

  function assertEditable() {
    if (saving.value) throw new HandCollectionStorageError('confirmation');
  }

  function assertSaveable() {
    assertEditable();
    if (loadFailed.value) throw new HandCollectionStorageError('unavailable');
    if (hasConflict.value) throw new HandCollectionStorageError('conflict');
  }

  function collectionSnapshot(): HandCollection {
    return normalizeCollection(validateHandCollection(JSON.parse(JSON.stringify(handCollection))));
  }

  function storedDocument(): HandCollectionDocument {
    return { version: 2, activeSetId: activeSetId.value, activeSlot: activeSlot.value, sets: JSON.parse(JSON.stringify(savedSets.value)) };
  }

  function defaultSetName() {
    let number = 1;
    while (savedSets.value.some(set => set.name === 'セット' + number)) number++;
    return 'セット' + number;
  }

  function newSetId() {
    let id: string;
    do {
      id = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID() : 'set-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2);
    } while (savedSets.value.some(set => set.id === id));
    return id;
  }

  async function commitDocument(document: HandCollectionDocument, options: {
    baseline?: HandCollection; replaceEditor?: boolean; contextChange?: boolean;
    preserveNameDraft?: boolean; preserveFailedContext?: boolean; beforeWrite?: () => void;
  } = {}): Promise<void> {
    assertSaveable();
    // Sanitize and freeze every set before waiting for another tab's lock.
    const frozen = validateHandCollectionDocument(JSON.parse(JSON.stringify(document)));
    const editorBefore = JSON.stringify(handCollection);
    const baseline = options.baseline ? normalizeCollection(options.baseline) : undefined;
    let failed = false;
    saving.value = true;
    try {
      const raw = await saveStoredHandCollectionDocument(frozen, savedRaw, () => {
        // A consumer may mutate the exposed reactive collection directly. A
        // pending switch/restore must then abort before changing persisted data.
        if (options.replaceEditor && JSON.stringify(handCollection) !== editorBefore) {
          throw new HandCollectionStorageError('confirmation');
        }
        options.beforeWrite?.();
      });
      savedSets.value = frozen.sets;
      if (!options.preserveNameDraft) nameDraft.value = null;
      activeSetId.value = frozen.activeSetId;
      activeSlot.value = frozen.activeSlot ?? 1;
      savedRaw = raw;
      draftBaseRaw = raw;
      if (baseline) {
        savedState.value = JSON.stringify(baseline);
        if (options.replaceEditor) {
          replacing = true;
          try { replaceCollection(baseline); } finally { replacing = false; }
        }
      }
      saveFailed.value = false;
      hasConflict.value = false;
      if (options.contextChange) collectionContextRevision.value++;
      persistDraft();
    } catch (error) {
      failed = true;
      saveFailed.value = true;
      if (error instanceof HandCollectionStorageError && error.reason === 'conflict') hasConflict.value = true;
      persistDraft();
      throw error;
    } finally {
      saving.value = false;
      if (!failed || !options.preserveFailedContext) refreshFromStorage();
    }
  }

  async function saveNewSet(name = defaultSetName()): Promise<void> {
    assertSaveable();
    if (savedSets.value.length >= maxSets) throw new HandCollectionStorageError('limit');
    const data = collectionSnapshot(), id = newSetId(), document = storedDocument();
    const slot = [1, 2, 3, 4, 5].find(number => !document.sets.some(set => set.slot === number))!;
    document.sets.push({ id, name: name.trim(), data, slot });
    document.activeSetId = id;
    document.activeSlot = slot;
    await commitDocument(document, { baseline: data, contextChange: true });
  }

  async function saveHandCollectionManually(options: { name?: string; setId?: string; overwriteConfirmed?: boolean } = {}): Promise<void> {
    assertSaveable();
    const targetId = options.setId ?? activeSetId.value;
    if (!targetId) return saveNewSet(options.name ?? defaultSetName());
    if (!savedSets.value.some(set => set.id === targetId)) throw new HandCollectionStorageError('invalid');
    if (!options.overwriteConfirmed) throw new HandCollectionStorageError('confirmation');
    const data = collectionSnapshot(), document = storedDocument();
    document.sets = document.sets.map(set => set.id === targetId
      ? { ...set, name: options.name === undefined ? set.name : options.name.trim(), data } : set);
    document.activeSetId = targetId;
    document.activeSlot = document.sets.find(set => set.id === targetId)?.slot;
    await commitDocument(document, { baseline: data, contextChange: targetId !== activeSetId.value });
  }

  async function renameActiveSet(name: string): Promise<void> {
    assertSaveable();
    if (!activeSet.value) throw new HandCollectionStorageError('invalid');
    const document = storedDocument();
    document.sets = document.sets.map(set => set.id === activeSetId.value ? { ...set, name: name.trim() } : set);
    await commitDocument(document);
  }

  async function switchSet(id: string, discardConfirmed = false): Promise<void> {
    assertSaveable();
    const target = savedSets.value.find(set => set.id === id);
    if (!target) throw new HandCollectionStorageError('invalid');
    if (id === activeSetId.value) return;
    if ((hasUnsavedChanges.value || hasUnsavedNameChanges.value) && !discardConfirmed) throw new HandCollectionStorageError('confirmation');
    const document = storedDocument();
    document.activeSetId = id;
    document.activeSlot = target.slot;
    await commitDocument(document, { baseline: target.data, replaceEditor: true, contextChange: true });
  }

  async function restoreSetsBackup(value: unknown, overwriteConfirmed = false): Promise<void> {
    assertSaveable();
    if ((savedSets.value.length || hasUnsavedChanges.value) && !overwriteConfirmed) {
      throw new HandCollectionStorageError('confirmation');
    }
    const document = validateHandCollectionDocument(value);
    document.sets = document.sets.map(set => ({ ...set, data: normalizeCollection(set.data) }));
    const data = document.sets.find(set => set.id === document.activeSetId)?.data ?? {};
    await commitDocument(document, { baseline: data, replaceEditor: true, contextChange: true });
  }

  function assertSlot(slot: number) {
    if (!Number.isInteger(slot) || slot < 1 || slot > maxSets) throw new HandCollectionStorageError('invalid');
  }

  async function selectSlot(slot: number, discardConfirmed = false): Promise<void> {
    assertSaveable(); assertSlot(slot);
    if (slot === activeSlot.value) return;
    if ((hasUnsavedChanges.value || hasUnsavedNameChanges.value) && !discardConfirmed) throw new HandCollectionStorageError('confirmation');
    const document = storedDocument(), target = document.sets.find(set => set.slot === slot);
    document.activeSlot = slot; document.activeSetId = target?.id ?? null;
    await commitDocument(document, { baseline: target?.data ?? {}, replaceEditor: true, contextChange: true });
  }

  async function saveSlot(slot: number, name: string, options: { overwriteConfirmed?: boolean } = {}): Promise<void> {
    assertSaveable(); assertSlot(slot);
    if (!options.overwriteConfirmed) throw new HandCollectionStorageError('confirmation');
    const document = storedDocument(), target = document.sets.find(set => set.slot === slot), data = collectionSnapshot();
    if (target) { target.name = name.trim(); target.data = data; }
    else {
      if (document.sets.length >= maxSets) throw new HandCollectionStorageError('limit');
      let id = `slot-${slot}`;
      while (document.sets.some(set => set.id === id)) id += '-new';
      document.sets.push({ id, name: name.trim(), data, slot });
    }
    document.activeSlot = slot;
    document.activeSetId = document.sets.find(set => set.slot === slot)!.id;
    await commitDocument(document, { baseline: data, contextChange: slot !== activeSlot.value || !target });
  }

  async function deleteSlot(slot: number, options: { deleteConfirmed?: boolean; discardConfirmed?: boolean } = {}): Promise<void> {
    assertSaveable(); assertSlot(slot);
    if (!options.deleteConfirmed || (slot === activeSlot.value && hasUnsavedChanges.value && !options.discardConfirmed)) {
      throw new HandCollectionStorageError('confirmation');
    }
    const document = storedDocument();
    if (!document.sets.some(set => set.slot === slot)) throw new HandCollectionStorageError('invalid');
    document.sets = document.sets.filter(set => set.slot !== slot);
    if (slot === activeSlot.value) {
      document.activeSetId = null;
      await commitDocument(document, { baseline: {}, replaceEditor: true, contextChange: true });
    } else await commitDocument(document);
  }

  const saveSelectedSlot = (name: string, confirmed = false) => saveSlot(activeSlot.value, name, { overwriteConfirmed: confirmed });
  const deleteSelectedSlot = (confirmed = false) => deleteSlot(activeSlot.value, { deleteConfirmed: confirmed, discardConfirmed: confirmed });

  async function importAssignedSets(assignments: { slot: number; name: string; data: HandCollection }[], options: {
    overwriteConfirmed?: boolean; expectedRevision?: number;
  } = {}): Promise<void> {
    if (!Array.isArray(assignments)) throw new HandCollectionStorageError('invalid');
    // Choosing to skip every imported set has no storage or editor side effect.
    if (!assignments.length) return;
    assertSaveable();
    const revision = collectionContextRevision.value;
    if (options.expectedRevision !== undefined && options.expectedRevision !== revision) {
      throw new HandCollectionStorageError('confirmation');
    }
    const occupied = new Set<number>();
    const incoming = assignments.map(item => {
      if (!item || typeof item !== 'object') throw new HandCollectionStorageError('invalid');
      assertSlot(item.slot);
      if (occupied.has(item.slot) || typeof item.name !== 'string' || !item.name.trim()) {
        throw new HandCollectionStorageError('invalid');
      }
      occupied.add(item.slot);
      return { slot: item.slot, name: item.name.trim(), data: normalizeCollection(validateHandCollection(item.data)) };
    });
    const document = storedDocument();
    const current = incoming.find(item => item.slot === activeSlot.value);
    if (!options.overwriteConfirmed && (document.sets.some(set => occupied.has(set.slot!)) ||
        (current && (hasUnsavedChanges.value || hasUnsavedNameChanges.value)))) {
      throw new HandCollectionStorageError('confirmation');
    }
    for (const item of incoming) {
      const existing = document.sets.find(set => set.slot === item.slot);
      if (existing) { existing.name = item.name; existing.data = item.data; }
      else {
        let id = `slot-${item.slot}`;
        while (document.sets.some(set => set.id === id)) id += '-new';
        document.sets.push({ ...item, id });
      }
    }
    if (current) document.activeSetId = document.sets.find(set => set.slot === activeSlot.value)!.id;
    const editorBefore = JSON.stringify(handCollection), nameBefore = nameDraft.value;
    await commitDocument(document, {
      baseline: current?.data, replaceEditor: !!current, contextChange: !!current,
      preserveNameDraft: !current, preserveFailedContext: true,
      beforeWrite: () => {
        if (collectionContextRevision.value !== revision || JSON.stringify(handCollection) !== editorBefore || nameDraft.value !== nameBefore) {
          throw new HandCollectionStorageError('confirmation');
        }
      },
    });
  }

  function createSetsBackup(unsavedName = '未保存のセット'): string {
    const document = storedDocument(), data = collectionSnapshot();
    if (document.activeSetId) {
      document.sets = document.sets.map(set => set.id === document.activeSetId ? { ...set, data } : set);
    } else {
      if (document.sets.length >= maxSets) throw new HandCollectionStorageError('limit');
      const id = newSetId();
      // A conflicting draft may refer to a slot another tab has since filled.
      // Export its work in a free slot without replacing that tab's saved set.
      const slot = document.sets.some(set => set.slot === activeSlot.value)
        ? [1, 2, 3, 4, 5].find(number => !document.sets.some(set => set.slot === number))! : activeSlot.value;
      document.sets.push({ id, name: unsavedName.trim(), data, slot });
      document.activeSetId = id;
      document.activeSlot = slot;
    }
    return createHandCollectionSetsBackup(document);
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
    savedSets,
    activeSetId,
    activeSlot,
    selectedSlot: activeSlot,
    slots,
    activeSet,
    nameDraft,
    hasUnsavedNameChanges,
    maxSets,
    collectionContextRevision,
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
    removeHandCard,
    batchUpdates,
    isCharacterOwned,
    setUseHandCollection,
    saveHandCollectionManually,
    saveNewSet,
    renameActiveSet,
    switchSet,
    selectSlot,
    saveSlot,
    deleteSlot,
    saveSelectedSlot,
    deleteSelectedSlot,
    restoreSetsBackup,
    importAssignedSets,
    createSetsBackup,
    resetUnsavedChanges,
    reloadHandCollection: () => {
      assertEditable();
      const loaded = reloadHandCollection();
      if (loaded) persistDraft();
      return loaded;
    },
    incrementModalOpenCount,
    isFirstModalOpen,
  };
});
