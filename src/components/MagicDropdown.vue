<template>
  <div class="select-wrapper">
    <select v-model="selectedOption" @change="updateValue">
      <option>単発(弱)</option>
      <option>単発(強)</option>
      <option>連撃(弱)</option>
      <option>連撃(強)</option>
      <option>デュオ</option>
    </select>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';

const props = defineProps({
  modelValue: {
    type: String,
    default: ''
  }
});

const emit = defineEmits(['update:modelValue']);

const selectedOption = ref(props.modelValue || '単発(弱)');

const updateValue = () => {
  emit('update:modelValue', selectedOption.value);
};

watch(() => props.modelValue, (newValue) => {
  selectedOption.value = newValue || '単発(弱)';
}, { immediate: true });
</script>

<style scoped>
.select-wrapper {
  position: relative;
  display: inline-block;
}

select {
  appearance: none;
  -webkit-appearance: none;
  -moz-appearance: none;
  background: none;
  background-image: none;
  margin-right: 1px;
  margin-left: 3px;
  padding: 2px 12px;
  border-radius: 5px; /* 角丸を適用 */
  border: 1px solid #ccc;
  background-color: white;
  cursor: pointer;
  font-size: 0.8em;
}
select::-ms-expand {
  display: none;
}
/* ドロップダウンマーク（▼）を消す */
.select-wrapper::after {
  content: '';
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
</style>
