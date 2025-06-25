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

// localStorageキー
const FILTER_STORAGE_KEY = 'twstSimulatorFilterState';

// フィルター状態をlocalStorageから読み込む
function loadFilterState(): FilterState | null {
  try {
    const stored = localStorage.getItem(FILTER_STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (error) {
    console.warn('Failed to load filter state from localStorage:', error);
  }
  return null;
}

// フィルター状態をlocalStorageに保存
function saveFilterState(state: FilterState): void {
  try {
    localStorage.setItem(FILTER_STORAGE_KEY, JSON.stringify(state));
  } catch (error) {
    console.warn('Failed to save filter state to localStorage:', error);
  }
}

export const useFilterdStore = defineStore('filterd', () => {
  // 保存された状態を読み込み
  const savedState = loadFilterState();
  
  const tempSelectedCharacters = ref<string[]>(savedState?.selectedCharacters || []);
  const tempSelectedRare = ref<string[]>(savedState?.selectedRare || []);
  const tempSelectedType = ref<string[]>(savedState?.selectedType || []);
  const tempSelectedAttr = ref<string[]>(savedState?.selectedAttr || []);
  const tempSelectedEffects = ref<string[]>(savedState?.selectedEffects || []);
  const isFirst = ref(!savedState); // 保存された状態がない場合は初回

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

  // フィルター状態をリセットする関数
  function resetFilterState() {
    tempSelectedCharacters.value = [];
    tempSelectedRare.value = [];
    tempSelectedType.value = [];
    tempSelectedAttr.value = [];
    tempSelectedEffects.value = [];
    isFirst.value = true;
    
    // localStorageからも削除
    try {
      localStorage.removeItem(FILTER_STORAGE_KEY);
    } catch (error) {
      console.warn('Failed to remove filter state from localStorage:', error);
    }
  }

  return {
    tempSelectedCharacters,
    tempSelectedRare,
    isFirst,
    tempSelectedType,
    tempSelectedAttr,
    tempSelectedEffects,
    saveCurrentState,
    resetFilterState,
  };
});
