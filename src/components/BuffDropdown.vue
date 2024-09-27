<template>
  <div class="select-wrapper">
    <select v-model="magicOption">
      <option>M1</option>
      <option>M2</option>
      <option>M3</option>
    </select>
  </div>
  <div class="select-wrapper">
    <select v-model="buffOption">
      <option>ATKUP</option>
      <option>ダメージUP</option>
      <option>継続回復</option>
      <option>回復</option>
    </select>
  </div>
  <div class="select-wrapper">
    <select v-model="powerOption">
      <option>極小</option>
      <option>小</option>
      <option>中</option>
      <option>大</option>
      <option>極大</option>
    </select>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';

const magicOption = ref();
const buffOption = ref();
const powerOption = ref();

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
</style>
