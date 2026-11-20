<template>
  <div class="modal-background">
    <div class="section">
      <h3>{{ $t('infoModal.about') }}</h3>
      <p>{{ $t('infoModal.text1') }}</p>
      <p>{{ $t('infoModal.text2') }}</p>
      <p>{{ $t('infoModal.text6') }}</p>
      <p>{{ $t('infoModal.text7') }}</p>
    </div>
    <div class="section">
      <h3>{{ $t('infoModal.setting') }}</h3>
      <ol>
        <li v-for="step in ['chooseRoster', 'choosePreset', 'chooseSupport', 'start']" :key="step">
          {{ $t('infoModal.' + step) }}
        </li>
      </ol>
      <p>{{ $t('infoModal.text11') }}</p>
      <p>{{ $t('infoModal.text12') }}</p>
    </div>
    <!-- ボタンのコンテナ -->
    <div class="button-container">
      <v-btn class="button" @click="$emit('close')">{{ $t('infoModal.close') }}</v-btn>
    </div>
  </div>
</template>

<script setup lang="ts">
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
ol {
  padding-inline-start: 1.5em;
}
li {
  margin-bottom: 0.5em;
}
.section {
  margin: 10px;
}
</style>