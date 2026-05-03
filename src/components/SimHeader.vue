<template>
  <div class="sim-header">
    <label class="target-select">
      <span class="target-select-label">対象</span>
      <select v-model="selectedOption" class="target-select-input" aria-label="対象属性" @change="updateFilter">
        <option v-for="option in options" :key="option" :value="option">
          {{ option }}
        </option>
      </select>
    </label>

    <div class="button-group-horizontal">
      <button class="button save-button-with-text" @click="openSavedDeckModal">
        <v-icon size="small">mdi-content-save</v-icon>
        <span class="button-text">編成</span>
      </button>
      <button class="button" @click="openInNewTab">
        <span class="dli-external-link"><span></span></span>
        <span class="button-text">別タブ</span>
      </button>
      <button class="button" @click="openInExamSimulator">
        <v-icon size="small">mdi-chart-box-outline</v-icon>
        <span class="button-text">試験シミュ</span>
      </button>
    </div>
  </div>
  
  <!-- 保存編成モーダル -->
  <SavedDeckModal 
    v-if="showSavedDeckModal" 
    @close="closeSavedDeckModal"
  />
</template>
  
<script setup>
import { ref, watch } from 'vue';
import { useSimulatorStore } from '@/store/simulatorStore';
import { saveExamSimulatorDeckImportState, saveSimulatorWindowState } from '@/storage/simulatorStorage';
import SavedDeckModal from '@/components/SavedDeckModal.vue';

const props = defineProps({
  modelValue: {
    type: String,
    default: '対全'
  }
});

const options = ['対全', '対火', '対水', '対木', '対無'];
const selectedOption = ref(props.modelValue);
const simulatorStore = useSimulatorStore();
const showSavedDeckModal = ref(false);

// 外部からの値の変更を監視
watch(() => props.modelValue, (newValue) => {
  selectedOption.value = newValue;
}, { immediate: true });

const emit = defineEmits(['update:filter', 'update:modelValue']);

const updateFilter = () => {
  emit('update:filter', selectedOption.value);
  emit('update:modelValue', selectedOption.value);
};

const createDeckSnapshot = () => simulatorStore.deckCharacters.map(char => ({
    ...char,
    // 必要なプロパティを明示的にコピー
    chara: char.chara,
    name: char.name,
    level: char.level,
    totsu: char.totsu,
    hp: char.hp,
    atk: char.atk,
    max_hp: char.max_hp,
    max_atk: char.max_atk,
    originalMaxHP: char.originalMaxHP,
    originalMaxATK: char.originalMaxATK,
    rare: char.rare,
    imgUrl: char.imgUrl, // 画像URLも保存
    hasM3: char.hasM3,
    isBonusSelected: char.isBonusSelected,
    isM1Selected: char.isM1Selected,
    isM2Selected: char.isM2Selected,
    isM3Selected: char.isM3Selected,
    magic1Lv: char.magic1Lv,
    magic2Lv: char.magic2Lv,
    magic3Lv: char.magic3Lv,
    magic1Attribute: char.magic1Attribute,
    magic2Attribute: char.magic2Attribute,
    magic3Attribute: char.magic3Attribute,
    magic1TargetAttribute: char.magic1TargetAttribute,
    magic2TargetAttribute: char.magic2TargetAttribute,
    magic3TargetAttribute: char.magic3TargetAttribute,
    magic1Power: char.magic1Power,
    magic2Power: char.magic2Power,
    magic3Power: char.magic3Power,
    magic1heal: char.magic1heal,
    magic2heal: char.magic2heal,
    magic3heal: char.magic3heal,
    buddy1c: char.buddy1c,
    buddy2c: char.buddy2c,
    buddy3c: char.buddy3c,
    buddy1s: char.buddy1s,
    buddy1s_totsu: char.buddy1s_totsu,
    buddy2s: char.buddy2s,
    buddy2s_totsu: char.buddy2s_totsu,
    buddy3s: char.buddy3s,
    buddy3s_totsu: char.buddy3s_totsu,
    buddy1Lv: char.buddy1Lv,
    buddy2Lv: char.buddy2Lv,
    buddy3Lv: char.buddy3Lv,
    buffs: char.buffs || [],
    duo: char.duo,
    magic2pow: char.magic2pow
  }));

const saveState = () => {
  const charactersToSave = createDeckSnapshot();

  const state = {
    deckCharacters: charactersToSave,
    selectedAttribute: selectedOption.value
  };
  saveSimulatorWindowState(state);
};

const openInNewTab = () => {
  saveState();
  
  const restoreStateParam = 'restoreState=true';
  let newUrl = window.location.href;
  
  if (!newUrl.includes(restoreStateParam)) {
    newUrl += newUrl.includes('?') ? '&' : '?';
    newUrl += restoreStateParam;
  }
  
  window.open(newUrl, '_blank');
};

const createTransferId = () => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
};

const openInExamSimulator = () => {
  const transferId = createTransferId();
  saveExamSimulatorDeckImportState({
    id: transferId,
    deckCharacters: createDeckSnapshot(),
    selectedAttribute: selectedOption.value,
    createdAt: new Date().toISOString()
  });

  const baseUrl = window.location.origin;
  window.open(`${baseUrl}/twst/exam-simulator?importDeck=${encodeURIComponent(transferId)}`, '_blank');
};

const openSavedDeckModal = () => {
  showSavedDeckModal.value = true;
};

const closeSavedDeckModal = () => {
  showSavedDeckModal.value = false;
};
</script>

<style scoped>
.sim-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  min-width: 0;
  margin-bottom: 8px;
}

.target-select {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  min-width: 0;
}

.target-select-label {
  font-size: 0.8em;
  font-weight: 700;
  color: #4a5562;
  white-space: nowrap;
}

.target-select-input {
  width: 112px;
  min-width: 112px;
  height: 30px;
  padding: 3px 28px 3px 10px;
  border: 1px solid #b8c7d5;
  border-radius: 5px;
  background-color: #fff;
  color: #27323f;
  font-size: 0.82em;
  line-height: 1.2;
  cursor: pointer;
}

.button {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  padding: 4px 8px;
  border-radius: 3px;
  border: 1px solid #ccc;
  background-color: #f8f8f8;
  cursor: pointer;
  font-size: 0.7em;
  color: #333;
  text-decoration: none;
}

.button:hover {
  background-color: #e8e8e8;
}

.dli-external-link {
  display: inline-block;
  vertical-align: middle;
  color: #333;
  line-height: 1;
  width: 0.9em;
  height: 0.9em;
  border: 0.1em solid currentColor;
  border-radius: 0.1em;
  background: #fff;
  box-sizing: content-box;
  position: relative;
}

.dli-external-link > span {
  position: absolute;
  top: -0.2em;
  right: -0.2em;
  width: 45%;
  height: 45%;
  border: 0.1em solid currentColor;
  border-bottom: 0;
  border-left: 0;
  background: #fff;
  box-shadow: -0.1em 0.1em 0 0.1em #fff;
  box-sizing: border-box;
}

.dli-external-link > span::before {
  content: '';
  position: absolute;
  top: -0.05em;
  right: -0.1em;
  width: 0.1em;
  height: 0.9em;
  background: currentColor;
  transform: rotate(45deg);
  transform-origin: top center;
}

.button-group-horizontal {
  display: flex;
  gap: 4px;
  align-items: center;
  justify-content: flex-end;
  min-width: 0;
}

.save-button-with-text {
  display: flex;
  align-items: center;
  gap: 4px;
}

@media (max-width: 767px) {
  .sim-header {
    align-items: stretch;
    gap: 8px;
    flex-wrap: wrap;
  }

  .button-group-horizontal {
    flex: 1 1 auto;
    justify-content: flex-start;
    flex-wrap: wrap;
  }

  .target-select-input {
    width: 84px;
    min-width: 84px;
  }

  .button {
    min-width: 0;
    padding: 4px 7px;
  }
}
</style>
