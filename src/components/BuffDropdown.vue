<template>
  <div class="select-wrapper">
    <select v-model="magicOption" @change="updateValue">
      <option>M1</option>
      <option>M2</option>
      <option>M3</option>
    </select>
  </div>
  <div class="select-wrapper">
    <select v-model="buffOption" @change="updateValue">
      <option>ATKUP</option>
      <option>ダメージUP</option>
      <option>属性ダメUP</option>
      <option>継続回復</option>
      <option>回復</option>
      <option>クリティカル</option>
    </select>
  </div>
  <div class="select-wrapper">
    <select v-model="powerOption" @change="updateValue">
      <template v-if="buffOption === 'クリティカル'">
        <option>1/1</option>
        <option>1/2</option>
        <option>1/3</option>
        <option>2/3</option>
      </template>
      <template v-else>
        <option>極小</option>
        <option>小</option>
        <option>中</option>
        <option>大</option>
        <option>極大</option>
      </template>
    </select>
  </div>
  <div class="select-wrapper">
    <select v-model="levelOption" @change="updateValue" :disabled="buffOption === 'クリティカル'">
      <option disabled value="">Lv</option>
      <option v-for="n in 10" :key="n" :value="n">Lv{{ n }}</option>
    </select>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';

const props = defineProps({
  modelValue: {
    type: Object,
    default: () => ({
      magicOption: '',
      buffOption: '',
      powerOption: '',
      levelOption: 10
    })
  }
});

const emit = defineEmits(['update:modelValue']);

const magicOption = ref(props.modelValue.magicOption || '');
const buffOption = ref(props.modelValue.buffOption || '');
const powerOption = ref(props.modelValue.powerOption || '');
const levelOption = ref(props.modelValue.levelOption || 10);

// 初期値を設定
watch(() => props.modelValue, (newValue) => {
  if (newValue) {
    magicOption.value = newValue.magicOption || '';
    buffOption.value = newValue.buffOption || '';
    powerOption.value = newValue.powerOption || '';
    levelOption.value = newValue.levelOption || 10;
  }
}, { immediate: true });

// buffOptionの変更を監視してpowerOptionをリセット
watch(buffOption, (newBuffOption) => {
  if (newBuffOption === 'クリティカル') {
    powerOption.value = '1/1'; // デフォルトのクリティカル値
    levelOption.value = 1; // クリティカルはレベル無効だが形式上1を設定
  } else if (powerOption.value && ['1/1', '1/2', '1/3', '2/3'].includes(powerOption.value)) {
    powerOption.value = '小'; // 他のバフに変更時はデフォルトの'小'に戻す
  }
  updateValue();
});

const updateValue = () => {
  emit('update:modelValue', {
    magicOption: magicOption.value,
    buffOption: buffOption.value,
    powerOption: powerOption.value,
    levelOption: levelOption.value,
    isManuallyAdded: props.modelValue?.isManuallyAdded || false // 既存のフラグを保持
  });
};
</script>

<style scoped>
.select-wrapper {
  position: relative;
  display: inline-block;
}

select {
  appearance: none;
  padding: 1px 12px;
  border-radius: 5px; /* 角丸を適用 */
  border: 1px solid #ccc;
  background-color: white;
  cursor: pointer;
  font-size: 0.9em;
}

/* ドロップダウンマーク（▼）を表示するためのスタイル */
.select-wrapper::after {
  content: '▼';
  position: absolute;
  right: 5%;
  top: 50%;
  transform: translateY(-50%);
  pointer-events: none;
  font-size: 1em;
}

/* フォーカス時のスタイル */
select:focus {
  outline: none;
  border-color: #66afe9;
  box-shadow: 0 0 8px rgba(102, 175, 233, 0.6);
}

/* 無効化されたselect要素のスタイル */
select:disabled {
  background-color: #f5f5f5;
  color: #999;
  cursor: not-allowed;
}
</style>
