<template>
  <v-row>
    <v-col cols="9">
      <div class="radio-group">
        <label v-for="option in options" :key="option" class="radio-option">
          <input type="radio" :value="option" v-model="selectedOption" @change="updateFilter" />
          {{ option }}
        </label>
      </div>
    </v-col>
    <v-col cols="3">
      <button class="button" @click="openInNewTab">別タブ<span class="dli-external-link"><span></span></span></button>
    </v-col>
  </v-row>
</template>
  
<script setup>
import { ref, watch } from 'vue';
import { useSimulatorStore } from '@/store/simulatorStore';

const props = defineProps({
  modelValue: {
    type: String,
    default: '対全'
  }
});

const options = ['対全', '対火', '対水', '対木', '対無'];
const selectedOption = ref(props.modelValue);
const simulatorStore = useSimulatorStore();

// 外部からの値の変更を監視
watch(() => props.modelValue, (newValue) => {
  selectedOption.value = newValue;
}, { immediate: true });

const emit = defineEmits(['update:filter', 'update:modelValue']);

const updateFilter = () => {
  const filterMap = {
    '対全': '対全',
    '対火': '対火',
    '対水': '対水',
    '対木': '対木',
    '対無': '対無'
  };
  const newValue = filterMap[selectedOption.value];
  emit('update:filter', newValue);
  emit('update:modelValue', newValue);
};

const saveState = () => {
  // 必要な情報のみを保存（循環参照を避けるため）
  const charactersToSave = simulatorStore.deckCharacters.map(char => ({
    ...char,
    // 必要なプロパティを明示的にコピー
    chara: char.chara,
    name: char.name,
    level: char.level,
    hp: char.hp,
    atk: char.atk,
    max_hp: char.max_hp,
    max_atk: char.max_atk,
    rare: char.rare,
    imgUrl: char.imgUrl, // 画像URLも保存
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
    buddy2s: char.buddy2s,
    buddy3s: char.buddy3s,
    buddy1Lv: char.buddy1Lv,
    buddy2Lv: char.buddy2Lv,
    buddy3Lv: char.buddy3Lv,
    buffs: char.buffs || [],
    duo: char.duo,
    magic2pow: char.magic2pow
  }));

  const state = {
    deckCharacters: charactersToSave,
    selectedAttribute: selectedOption.value
  };
  localStorage.setItem('twstSimulatorState', JSON.stringify(state));
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
</script>

<style scoped>
.radio-group {
  display: flex;
  justify-content: space-between;
  font-size: 0.8em;
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
.radio-option {
  margin-right: auto;
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
</style>
