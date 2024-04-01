<template>
  <div class="modal-background">
    <div class="section">
      <p>{{errorMessage}}</p>
    </div>
    <!-- ボタンのコンテナ -->
    <div class="button-container">
      <v-btn class="button" @click="close">閉じる</v-btn>
    </div>
  </div>
</template>

<script setup lang="ts">

import { useSearchResultStore } from '@/store/searchResult';
import { storeToRefs } from 'pinia';
const searchResultStore = useSearchResultStore();
const { errorMessage } = storeToRefs(searchResultStore);
const emit = defineEmits(['close']);
function close(){
  errorMessage.value = '';
  emit('close'); // モーダルを閉じる
}
</script>
<style scoped>

.modal-background {
  background-color: white;
  padding: 20px; /* パディングを調整 */
  border-radius: 8px; /* 角を丸くする */
  max-height: 95vh; /* Maximum height - 80% of the viewport height */
  overflow-y: auto; /* Enable vertical scrolling if content overflows */
}

.button-container {
  display: flex;
  gap: 10px; /* ボタン間のスペース */
  justify-content: center;
}

.button, .apply-button {
  width: 150px; /* ボタンの幅を統一 */
}

.apply-button {
  background-color: #19d241;
  color: white;
}
.bold {
  font-weight: bold;
}
.section {
  margin: 10px;
}
</style>