// store/filterd.ts
import { defineStore } from 'pinia';
import { ref } from 'vue';

// フィルター状態の型定義
interface FilterState {
  selectedCharacters: string[];
  selectedRare: string[];
  selectedType: string[];
  selectedAttr: string[];
  selectedEffects: string[];
}

// ソート状態の型定義
interface SortState {
  sortBy: string;
  sortOrder: string;
}

// セッション内でのみ有効なフィルター状態（メモリ内管理）
let sessionFilterState: FilterState | null = null;
let userHasModifiedFilter = false;

// セッション内でのみ有効なソート状態（メモリ内管理）
let sessionSortState: SortState | null = null;
let userHasModifiedSort = false;

// フィルター状態をセッションから読み込む
function loadFilterState(): FilterState | null {
  // ユーザーが明示的にフィルターを変更した場合のみ、セッション内の状態を返す
  if (userHasModifiedFilter && sessionFilterState) {
    return sessionFilterState;
  }
  return null;
}

// フィルター状態をセッションに保存
function saveFilterState(state: FilterState): void {
  sessionFilterState = state;
  userHasModifiedFilter = true;
}

// ソート状態をセッションから読み込む
function loadSortState(): SortState | null {
  // ユーザーが明示的にソートを変更した場合のみ、セッション内の状態を返す
  if (userHasModifiedSort && sessionSortState) {
    return sessionSortState;
  }
  return null;
}

// ソート状態をセッションに保存
function saveSortState(state: SortState): void {
  sessionSortState = state;
  userHasModifiedSort = true;
}

export const useFilterdStore = defineStore('filterd', () => {
  // 保存された状態を読み込み
  const savedState = loadFilterState();
  const savedSortState = loadSortState();
  
  const tempSelectedCharacters = ref<string[]>(savedState?.selectedCharacters || []);
  const tempSelectedRare = ref<string[]>(savedState?.selectedRare || []);
  const tempSelectedType = ref<string[]>(savedState?.selectedType || []);
  const tempSelectedAttr = ref<string[]>(savedState?.selectedAttr || []);
  const tempSelectedEffects = ref<string[]>(savedState?.selectedEffects || []);
  const isFirst = ref(!savedState); // 保存された状態がない場合は初回
  
  // ソート設定
  const sortBy = ref<string>(savedSortState?.sortBy || 'default');
  const sortOrder = ref<string>(savedSortState?.sortOrder || 'asc');

  // フィルター状態を保存する関数
  function saveCurrentState() {
    const state: FilterState = {
      selectedCharacters: tempSelectedCharacters.value,
      selectedRare: tempSelectedRare.value,
      selectedType: tempSelectedType.value,
      selectedAttr: tempSelectedAttr.value,
      selectedEffects: tempSelectedEffects.value,
    };
    saveFilterState(state);
  }
  
  // ソート状態を保存する関数
  function saveCurrentSortState() {
    const state: SortState = {
      sortBy: sortBy.value,
      sortOrder: sortOrder.value,
    };
    saveSortState(state);
  }

  // フィルター状態をリセットする関数
  function resetFilterState() {
    tempSelectedCharacters.value = [];
    tempSelectedRare.value = [];
    tempSelectedType.value = [];
    tempSelectedAttr.value = [];
    tempSelectedEffects.value = [];
    isFirst.value = true;
    
    // セッション状態もリセット
    sessionFilterState = null;
    userHasModifiedFilter = false;
  }
  
  // ユーザーがフィルターを変更したことを記録する関数
  function markFilterAsModified() {
    userHasModifiedFilter = true;
  }
  
  // ユーザーがソートを変更したことを記録する関数
  function markSortAsModified() {
    userHasModifiedSort = true;
  }

  return {
    tempSelectedCharacters,
    tempSelectedRare,
    isFirst,
    tempSelectedType,
    tempSelectedAttr,
    tempSelectedEffects,
    sortBy,
    sortOrder,
    saveCurrentState,
    saveCurrentSortState,
    resetFilterState,
    markFilterAsModified,
    markSortAsModified,
  };
});
