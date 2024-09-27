<template>
  <div class="select-wrapper">
    <select v-model="selectedOption">
      <option>単発(弱)</option>
      <option>単発(強)</option>
      <option>連撃(弱)</option>
      <option>連撃(強)</option>
      <option>デュオ</option>
    </select>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';

const selectedOption = ref('単発(弱)'); // デフォルト値
</script>

<style scoped>
.select-wrapper {
  position: relative;
  display: inline-block;
}

select {
  appearance: none;
  margin-right: 1px;
  padding: 1px 12px;
  border-radius: 5px; /* 角丸を適用 */
  border: 1px solid #ccc;
  background-color: white;
  cursor: pointer;
  font-size: 0.8em;
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
