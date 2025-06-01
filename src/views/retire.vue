<template>
  <v-container>
    <div class="reset-area">
      <div class="reset-container">
        <div class="reset-btn-wrapper">
          <v-btn
            class="reset-btn"
            size="small"
            @click="resetAllCounters"
          >
            {{ $t('retire.reset') }} ({{ resetCount }}{{ $t('retire.num') }})
          </v-btn>
        </div>
        <span class="elapsed-time">{{ elapsedSeconds }} {{ $t('retire.seconds') }}</span>
      </div>
    </div>

    <!-- キャラクター選択エリア -->
    <v-row>
      <v-col cols="12" class="d-flex justify-center">
        <div class="character-selection-area">
          <div v-for="(slot, index) in 5" :key="index" class="character-row">
            <div class="character-column">
              <div class="character-slot" @click="openCharacterModal(index)">
                <img
                  v-if="selectedCharacters[index]"
                  :src="selectedCharacters[index]?.imgUrl"
                  :alt="selectedCharacters[index]?.name_en"
                  class="character-image"
                />
                <div v-else class="empty-slot">
                  <v-icon>mdi-plus</v-icon>
                </div>
              </div>
              <div v-if="visibleFields[index] < 4" class="add-field-btn" @click="addField(index)">
                <v-icon size="small">mdi-plus</v-icon>
              </div>
            </div>
            <div class="input-fields">
              <div class="input-row">
                <div class="custom-select">
                  <div class="select-header" @click="toggleDropdown(index, 'field1')">
                    <img 
                      v-if="inputValues[index].field1Attribute" 
                      :src="getAttributeIcon(inputValues[index].field1Attribute)" 
                      :alt="getAttributeName(inputValues[index].field1Attribute)"
                      class="attribute-icon"
                    />
                    <span v-else class="dropdown-icon">▽</span>
                  </div>
                  <div v-if="activeDropdown === `${index}-field1`" class="select-options">
                    <div 
                      v-for="attr in attributes" 
                      :key="attr.value"
                      class="select-option"
                      @click="selectAttribute(index, 'field1', attr.value)"
                    >
                      <img :src="attr.icon" :alt="attr.name" class="attribute-icon" />
                    </div>
                  </div>
                </div>
                <div class="input-with-counter">
                  <v-text-field
                    v-model="inputValues[index].field1"
                    hide-details
                    dense
                    @update:model-value="saveToLocalStorage"
                  ></v-text-field>
                  <v-btn
                    size="small"
                    class="counter-btn"
                    @click="incrementCounter(index, 'field1')"
                    @contextmenu.prevent="resetCounter(index, 'field1')"
                  >
                    {{ inputValues[index].field1Count }}
                  </v-btn>
                </div>
              </div>
              <div class="input-row">
                <div class="custom-select">
                  <div class="select-header" @click="toggleDropdown(index, 'field2')">
                    <img 
                      v-if="inputValues[index].field2Attribute" 
                      :src="getAttributeIcon(inputValues[index].field2Attribute)" 
                      :alt="getAttributeName(inputValues[index].field2Attribute)"
                      class="attribute-icon"
                    />
                    <span v-else class="dropdown-icon">▽</span>
                  </div>
                  <div v-if="activeDropdown === `${index}-field2`" class="select-options">
                    <div 
                      v-for="attr in attributes" 
                      :key="attr.value"
                      class="select-option"
                      @click="selectAttribute(index, 'field2', attr.value)"
                    >
                      <img :src="attr.icon" :alt="attr.name" class="attribute-icon" />
                    </div>
                  </div>
                </div>
                <div class="input-with-counter">
                  <v-text-field
                    v-model="inputValues[index].field2"
                    hide-details
                    dense
                    @update:model-value="saveToLocalStorage"
                  ></v-text-field>
                  <v-btn
                    size="small"
                    class="counter-btn"
                    @click="incrementCounter(index, 'field2')"
                    @contextmenu.prevent="resetCounter(index, 'field2')"
                  >
                    {{ inputValues[index].field2Count }}
                  </v-btn>
                </div>
              </div>
              <div v-if="visibleFields[index] >= 3" class="input-row">
                <div class="custom-select">
                  <div class="select-header" @click="toggleDropdown(index, 'field3')">
                    <img 
                      v-if="inputValues[index].field3Attribute" 
                      :src="getAttributeIcon(inputValues[index].field3Attribute)" 
                      :alt="getAttributeName(inputValues[index].field3Attribute)"
                      class="attribute-icon"
                    />
                    <span v-else class="dropdown-icon">▽</span>
                  </div>
                  <div v-if="activeDropdown === `${index}-field3`" class="select-options">
                    <div 
                      v-for="attr in attributes" 
                      :key="attr.value"
                      class="select-option"
                      @click="selectAttribute(index, 'field3', attr.value)"
                    >
                      <img :src="attr.icon" :alt="attr.name" class="attribute-icon" />
                    </div>
                  </div>
                </div>
                <div class="input-with-counter">
                  <v-text-field
                    v-model="inputValues[index].field3"
                    hide-details
                    dense
                    @update:model-value="saveToLocalStorage"
                  ></v-text-field>
                  <v-btn
                    size="small"
                    class="counter-btn"
                    @click="incrementCounter(index, 'field3')"
                    @contextmenu.prevent="resetCounter(index, 'field3')"
                  >
                    {{ inputValues[index].field3Count }}
                  </v-btn>
                </div>
              </div>
              <div v-if="visibleFields[index] >= 4" class="input-row">
                <div class="custom-select">
                  <div class="select-header" @click="toggleDropdown(index, 'field4')">
                    <img 
                      v-if="inputValues[index].field4Attribute" 
                      :src="getAttributeIcon(inputValues[index].field4Attribute)" 
                      :alt="getAttributeName(inputValues[index].field4Attribute)"
                      class="attribute-icon"
                    />
                    <span v-else class="dropdown-icon">▽</span>
                  </div>
                  <div v-if="activeDropdown === `${index}-field4`" class="select-options">
                    <div 
                      v-for="attr in attributes" 
                      :key="attr.value"
                      class="select-option"
                      @click="selectAttribute(index, 'field4', attr.value)"
                    >
                      <img :src="attr.icon" :alt="attr.name" class="attribute-icon" />
                    </div>
                  </div>
                </div>
                <div class="input-with-counter">
                  <v-text-field
                    v-model="inputValues[index].field4"
                    hide-details
                    dense
                    @update:model-value="saveToLocalStorage"
                  ></v-text-field>
                  <v-btn
                    size="small"
                    class="counter-btn"
                    @click="incrementCounter(index, 'field4')"
                    @contextmenu.prevent="resetCounter(index, 'field4')"
                  >
                    {{ inputValues[index].field4Count }}
                  </v-btn>
                </div>
              </div>
            </div>
          </div>
        </div>
      </v-col>
    </v-row>

    <!-- キャラクター選択モーダル -->
    <v-dialog v-model="showModal" max-width="800px">
      <v-card>
        <v-card-text>
          <div class="character-grid">
            <div
              v-for="character in visibleCharacters"
              :key="character.name_en"
              class="character-item"
              @click="selectCharacter(character)"
            >
              <img
                :src="character.imgUrl"
                :alt="character.name_en"
                class="character-image"
              />
            </div>
          </div>
        </v-card-text>
        <v-card-actions>
          <v-spacer></v-spacer>
          <v-btn color="primary" @click="showModal = false">Close</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
    <div class="clear-storage-area">
      <v-btn
        class="clear-storage-btn"
        size="small"
        @click="showConfirmDialog = true"
      >
        {{ $t('retire.clear_content') }}
      </v-btn>
    </div>

    <!-- 確認モーダル -->
    <v-dialog v-model="showConfirmDialog" max-width="400">
      <v-card>
        <v-card-title class="text-h5">
          {{ $t('retire.confirm_clear') }}
        </v-card-title>
        <v-card-text>
          {{ $t('retire.confirm_clear_message') }}
        </v-card-text>
        <v-card-actions>
          <v-spacer></v-spacer>
          <v-btn
            color="grey-darken-1"
            variant="text"
            @click="showConfirmDialog = false"
          >
            {{ $t('retire.cancel') }}
          </v-btn>
          <v-btn
            color="error"
            variant="text"
            @click="confirmClearStorage"
          >
            {{ $t('retire.confirm') }}
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </v-container>
</template>

<script setup lang="ts">
import { onMounted, ref, computed, onUnmounted } from 'vue';
import { useCharacterStore } from '@/store/characters';
import charactersInfo from '@/assets/characters_info.json';
import { loadImageUrls } from '@/components/common';

interface CharacterInfo {
  name_ja: string;
  name_en: string;
  dorm: string;
  theme_1: string;
  theme_2: string;
  imgUrl?: string;
}

interface InputValues {
  field1: string;
  field2: string;
  field3: string;
  field4: string;
  field1Attribute: string;
  field2Attribute: string;
  field3Attribute: string;
  field4Attribute: string;
  field1Count: number;
  field2Count: number;
  field3Count: number;
  field4Count: number;
  [key: string]: string | number;
}

const characterStore = useCharacterStore();
const loadingImgUrl = ref(true);
const showModal = ref(false);
const selectedSlotIndex = ref(-1);
const selectedCharacters = ref<(CharacterInfo | null)[]>([null, null, null, null, null]);
const imgUrlDictionary = ref<Record<string, string>>({});

// ローカルストレージのキー
const STORAGE_KEY = {
  INPUT_VALUES: 'retire_input_values',
  SELECTED_CHARACTERS: 'retire_selected_characters',
  VISIBLE_FIELDS: 'retire_visible_fields',
  RESET_COUNT: 'retire_reset_count',
  LAST_RESET_TIME: 'retire_last_reset_time'
};

// 属性選択用のデータ
const attributes = ref([
  { name: '火', value: 'fire', icon: '' },
  { name: '水', value: 'water', icon: '' },
  { name: '木', value: 'flora', icon: '' },
  { name: '無', value: 'cosmic', icon: '' },
]);

// 入力フィールドの値を管理
const inputValues = ref<InputValues[]>([
  { field1: '', field2: '', field3: '', field4: '', field1Attribute: '', field2Attribute: '', field3Attribute: '', field4Attribute: '', field1Count: 0, field2Count: 0, field3Count: 0, field4Count: 0 },
  { field1: '', field2: '', field3: '', field4: '', field1Attribute: '', field2Attribute: '', field3Attribute: '', field4Attribute: '', field1Count: 0, field2Count: 0, field3Count: 0, field4Count: 0 },
  { field1: '', field2: '', field3: '', field4: '', field1Attribute: '', field2Attribute: '', field3Attribute: '', field4Attribute: '', field1Count: 0, field2Count: 0, field3Count: 0, field4Count: 0 },
  { field1: '', field2: '', field3: '', field4: '', field1Attribute: '', field2Attribute: '', field3Attribute: '', field4Attribute: '', field1Count: 0, field2Count: 0, field3Count: 0, field4Count: 0 },
  { field1: '', field2: '', field3: '', field4: '', field1Attribute: '', field2Attribute: '', field3Attribute: '', field4Attribute: '', field1Count: 0, field2Count: 0, field3Count: 0, field4Count: 0 },
]);

const activeDropdown = ref<string>('');

const visibleFields = ref<number[]>([2, 2, 2, 2, 2]);

const resetCount = ref(0);
const elapsedSeconds = ref(0);
let timer: number | null = null;

const showConfirmDialog = ref(false);

// 経過時間を更新する
const updateElapsedTime = () => {
  const lastResetTime = localStorage.getItem(STORAGE_KEY.LAST_RESET_TIME);
  if (lastResetTime) {
    const elapsed = Math.floor((Date.now() - parseInt(lastResetTime)) / 1000);
    elapsedSeconds.value = elapsed;
  }
};

// ローカルストレージからデータを読み込む
const loadFromLocalStorage = () => {
  try {
    const savedInputValues = localStorage.getItem(STORAGE_KEY.INPUT_VALUES);
    const savedSelectedCharacters = localStorage.getItem(STORAGE_KEY.SELECTED_CHARACTERS);
    const savedVisibleFields = localStorage.getItem(STORAGE_KEY.VISIBLE_FIELDS);
    const savedResetCount = localStorage.getItem(STORAGE_KEY.RESET_COUNT);
    const savedLastResetTime = localStorage.getItem(STORAGE_KEY.LAST_RESET_TIME);

    if (savedInputValues) {
      inputValues.value = JSON.parse(savedInputValues);
    }
    if (savedSelectedCharacters) {
      const parsed = JSON.parse(savedSelectedCharacters);
      selectedCharacters.value = parsed.map((char: any) => {
        if (!char) return null;
        return {
          ...char,
          imgUrl: imgUrlDictionary.value[char.name_en] || ''
        };
      });
    }
    if (savedVisibleFields) {
      visibleFields.value = JSON.parse(savedVisibleFields);
    }
    if (savedResetCount) {
      resetCount.value = parseInt(savedResetCount);
    }
    if (savedLastResetTime) {
      updateElapsedTime();
    }
  } catch (error) {
    console.error('ローカルストレージからの読み込みに失敗しました:', error);
  }
};

// ローカルストレージにデータを保存する
const saveToLocalStorage = () => {
  try {
    localStorage.setItem(STORAGE_KEY.INPUT_VALUES, JSON.stringify(inputValues.value));
    localStorage.setItem(STORAGE_KEY.SELECTED_CHARACTERS, JSON.stringify(selectedCharacters.value));
    localStorage.setItem(STORAGE_KEY.VISIBLE_FIELDS, JSON.stringify(visibleFields.value));
    localStorage.setItem(STORAGE_KEY.RESET_COUNT, resetCount.value.toString());
  } catch (error) {
    console.error('ローカルストレージへの保存に失敗しました:', error);
  }
};

// 表示可能なキャラクターのリスト
const visibleCharacters = computed(() => {
  if (loadingImgUrl.value) {
    return [];
  }
  return (charactersInfo as CharacterInfo[]).filter(character => character.imgUrl);
});

// キャラクター選択モーダルを開く
const openCharacterModal = (index: number) => {
  selectedSlotIndex.value = index;
  showModal.value = true;
};

// キャラクターを選択
const selectCharacter = (character: CharacterInfo) => {
  if (selectedSlotIndex.value >= 0) {
    selectedCharacters.value[selectedSlotIndex.value] = character;
    saveToLocalStorage();
  }
  showModal.value = false;
};

// プルダウンの表示/非表示を切り替える
const toggleDropdown = (index: number, field: string) => {
  const dropdownId = `${index}-${field}`;
  activeDropdown.value = activeDropdown.value === dropdownId ? '' : dropdownId;
};

// 属性を選択する
const selectAttribute = (index: number, field: string, value: string) => {
  const fieldKey = `${field}Attribute`;
  inputValues.value[index][fieldKey] = value;
  activeDropdown.value = '';
  saveToLocalStorage();
};

// 属性アイコンを取得する
const getAttributeIcon = (value: string) => {
  const attr = attributes.value.find(a => a.value === value);
  return attr?.icon || '';
};

// 属性名を取得する
const getAttributeName = (value: string) => {
  const attr = attributes.value.find(a => a.value === value);
  return attr?.name || '';
};

// カウンターをインクリメントする
const incrementCounter = (index: number, field: string) => {
  const countField = `${field}Count`;
  const currentCount = inputValues.value[index][countField] as number;
  inputValues.value[index][countField] = currentCount + 1;
  saveToLocalStorage();
};

// カウンターをリセットする
const resetCounter = (index: number, field: string) => {
  const countField = `${field}Count`;
  inputValues.value[index][countField] = 0;
  saveToLocalStorage();
};

// フィールドを追加する
const addField = (index: number) => {
  if (visibleFields.value[index] < 4) {
    visibleFields.value[index]++;
    saveToLocalStorage();
  }
};

// すべてのカウンターをリセット
const resetAllCounters = () => {
  inputValues.value.forEach((values, index) => {
    inputValues.value[index].field1Count = 0;
    inputValues.value[index].field2Count = 0;
    inputValues.value[index].field3Count = 0;
    inputValues.value[index].field4Count = 0;
  });
  resetCount.value++;
  elapsedSeconds.value = 0;
  localStorage.setItem(STORAGE_KEY.LAST_RESET_TIME, Date.now().toString());
  saveToLocalStorage();
};

// ローカルストレージをクリアする
const clearLocalStorage = () => {
  try {
    localStorage.removeItem(STORAGE_KEY.INPUT_VALUES);
    localStorage.removeItem(STORAGE_KEY.SELECTED_CHARACTERS);
    localStorage.removeItem(STORAGE_KEY.VISIBLE_FIELDS);
    localStorage.removeItem(STORAGE_KEY.RESET_COUNT);
    localStorage.removeItem(STORAGE_KEY.LAST_RESET_TIME);
    
    // 状態をリセット
    inputValues.value = inputValues.value.map(() => ({
      field1: '', field2: '', field3: '', field4: '',
      field1Attribute: '', field2Attribute: '', field3Attribute: '', field4Attribute: '',
      field1Count: 0, field2Count: 0, field3Count: 0, field4Count: 0
    }));
    selectedCharacters.value = [null, null, null, null, null];
    visibleFields.value = [2, 2, 2, 2, 2];
    resetCount.value = 0;
    elapsedSeconds.value = 0;
  } catch (error) {
    console.error('ローカルストレージのクリアに失敗しました:', error);
  }
};

// 確認後にローカルストレージをクリア
const confirmClearStorage = () => {
  clearLocalStorage();
  showConfirmDialog.value = false;
};

onMounted(async () => {
  try {
    // 属性アイコンの読み込み
    await Promise.all(attributes.value.map(async (attr) => {
      const module = await import(`@/assets/img/icon/${attr.value}.png`);
      attr.icon = module.default;
    }));

    // キャラクター画像の辞書を作成
    imgUrlDictionary.value = await loadImageUrls(charactersInfo, (item: any) => item.name_en);

    // キャラクター画像の読み込み
    await Promise.all((charactersInfo as CharacterInfo[]).map(character => {
      return import(`@/assets/img/icon/${character.name_en}.png`)
        .then(module => {
          character.imgUrl = module.default;
        })
        .catch(() => {
          character.imgUrl = '';
        });
    }));

    // ローカルストレージからデータを読み込む
    loadFromLocalStorage();

    // 1秒ごとに経過時間を更新
    timer = window.setInterval(updateElapsedTime, 1000);
  } finally {
    loadingImgUrl.value = false;
  }
  characterStore.handlePageChange('retirePage');
});

// コンポーネントのアンマウント時にタイマーをクリア
onUnmounted(() => {
  if (timer !== null) {
    clearInterval(timer);
  }
});
</script>

<style scoped>
.v-container {
  padding-bottom: 0;
}

.v-row {
  margin-top: 0 !important;
  margin-bottom: 0 !important;
  padding-top: 0 !important;
  padding-bottom: 0 !important;
}

.v-col {
  margin-top: 0 !important;
  margin-bottom: 0 !important;
  padding-top: 0 !important;
  padding-bottom: 0 !important;
}

.character-selection-area {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 6px;
  background-color: #f5f5f5;
  border-radius: 6px;
  width: 95%;
  max-width: 420px;
  min-width: 220px;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.15);
  border: 1px solid #e0e0e0;
  margin-bottom: 0;
}

.character-row {
  display: flex;
  align-items: center;
  gap: 2px;
  margin-bottom: 1px;
  background-color: rgba(255, 255, 255, 0.8);
  border-radius: 4px;
  padding: 1px;
  border: 1px solid #e0e0e0;
  min-height: 48px;
}

.character-row:nth-child(odd) {
  background-color: rgba(245, 245, 245, 0.8);
}

.character-row:not(:last-child) {
  margin-bottom: 0px;
}

.character-slot {
  width: 40px;
  height: 40px;
  border: 1px solid #bdbdbd;
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  background-color: white;
  flex-shrink: 0;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.15);
  margin: 0;
}

.attribute-select {
  width: 80px;
  flex-shrink: 0;
}

.attribute-select-field {
  background-color: white;
  border-radius: 4px;
  border: 1px solid #e0e0e0;
}

.attribute-item {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 2px 0;
}

.attribute-icon {
  width: 16px;
  height: 16px;
  object-fit: contain;
}

.attribute-select :deep(.v-field__input) {
  padding-top: 0;
  padding-bottom: 0;
  min-height: 20px;
}

.attribute-select :deep(.v-field__outline) {
  --v-field-border-width: 1px;
  border-color: #bdbdbd;
}

.attribute-select :deep(.v-field__outline__notch) {
  display: none;
}

.input-fields {
  display: flex;
  flex-direction: column;
  gap: 1px;
  flex: 1;
  background-color: white;
  border-radius: 4px;
  padding: 2px;
  border: 1px solid #e0e0e0;
  justify-content: center;
}

.input-fields :deep(.v-field) {
  padding-top: 0;
  padding-bottom: 0;
  min-height: 20px;
  margin-top: 0;
  margin-bottom: 0;
  background-color: transparent;
}

.input-fields :deep(.v-field__input) {
  padding-top: 0;
  padding-bottom: 0;
  min-height: 20px;
  font-size: 0.7rem;
}

.input-fields :deep(.v-field__outline) {
  --v-field-border-width: 1px;
  border-color: #bdbdbd;
}

.input-fields :deep(.v-field__outline__start),
.input-fields :deep(.v-field__outline__end) {
  padding: 0 4px;
}

.input-fields :deep(.v-field__outline__notch) {
  display: none;
}

.character-image {
  width: 100%;
  height: 100%;
  object-fit: cover;
  border-radius: 3px;
}

.empty-slot {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  color: #ccc;
}

.character-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(60px, 1fr));
  gap: 4px;
  padding: 4px;
}

.character-item {
  cursor: pointer;
  transition: transform 0.2s;
}

.character-item:hover {
  transform: scale(1.05);
}

.input-row {
  display: flex;
  gap: 4px;
  align-items: center;
  margin: 0;
  padding: 0;
}

.attribute-select-field {
  width: 60px;
  flex-shrink: 0;
}

.attribute-item {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 2px 0;
}

.attribute-icon {
  width: 16px;
  height: 16px;
  object-fit: contain;
}

.attribute-select-field :deep(.v-field__input) {
  padding-top: 0;
  padding-bottom: 0;
  min-height: 20px;
}

.attribute-select-field :deep(.v-field__outline) {
  --v-field-border-width: 1px;
  border-color: #bdbdbd;
}

.attribute-select-field :deep(.v-field__outline__notch) {
  display: none;
}

.input-fields {
  display: flex;
  flex-direction: column;
  gap: 1px;
  flex: 1;
  background-color: white;
  border-radius: 4px;
  padding: 2px;
  border: 1px solid #e0e0e0;
  justify-content: center;
}

.custom-select {
  position: relative;
  width: 32px;
  flex-shrink: 0;
}

.select-header {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 2px;
  background-color: white;
  border: 1px solid #bdbdbd;
  border-radius: 4px;
  cursor: pointer;
  min-height: 20px;
  width: 32px;
  height: 32px;
}

.select-options {
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  background-color: white;
  border: 1px solid #bdbdbd;
  border-radius: 4px;
  margin-top: 2px;
  z-index: 1000;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 2px;
}

.select-option {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 2px;
  cursor: pointer;
  width: 32px;
  height: 32px;
}

.select-option:hover {
  background-color: #f5f5f5;
}

.attribute-icon {
  width: 24px;
  height: 24px;
  object-fit: contain;
}

.input-with-counter {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 1;
  margin: 0;
  padding: 0;
}

.input-with-counter :deep(.v-field) {
  margin: 0;
  padding: 0;
}

.input-with-counter :deep(.v-field__input) {
  padding: 0 4px;
  margin: 0;
}

.counter-btn {
  min-width: 28px !important;
  width: 28px !important;
  height: 28px !important;
  padding: 0 !important;
  margin: 0 !important;
  font-size: 0.7rem !important;
}

.counter-btn :deep(.v-btn__content) {
  padding: 0 !important;
}

.dropdown-icon {
  font-size: 1rem;
  color: #666;
  line-height: 1;
}

.add-field-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border: 1px solid #bdbdbd;
  border-radius: 4px;
  cursor: pointer;
  background-color: white;
}

.add-field-btn:hover {
  background-color: #f5f5f5;
}

.character-column {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
}

.reset-area {
  display: flex;
  justify-content: center;
  margin-bottom: 10px;
  margin-top: 0;
}

.reset-container {
  display: flex;
  align-items: center;
  width: 100%;
  max-width: 420px;
  position: relative;
}

.reset-btn-wrapper {
  position: absolute;
  left: 50%;
  transform: translateX(-50%);
}

.reset-btn {
  background-color: #abf1dc !important;
  color: #000000 !important;
  border-radius: 4px;
  box-shadow: 0 2px 2px rgba(29, 29, 29, 0.7);
  transition: background 0.2s;
}

.clear-storage-area {
  display: flex;
  justify-content: center;
  margin-top: 10px;
  margin-bottom: 10px;
}

.clear-storage-btn {
  background-color: #ffcdd2 !important;
  color: #000000 !important;
  border-radius: 4px;
  box-shadow: 0 2px 2px rgba(29, 29, 29, 0.7);
  transition: background 0.2s;
}

.clear-storage-btn:hover {
  background-color: #ef9a9a !important;
}

.elapsed-time {
  font-size: 0.9rem;
  color: #666;
  min-width: 60px;
  text-align: right;
  margin-left: auto;
  padding-right: 10px;
}
</style>
