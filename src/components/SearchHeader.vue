<template>
  <v-row class="mb-1 search-header-row" justify="center" align="center">
    <v-col cols="6" sm="auto">
      <v-btn block color="red" @click="stopSearch" :disabled="!isSearching">{{ $t('search.cancelSearch') }}</v-btn>
    </v-col>
    <v-col cols="6" sm="auto">
      <v-btn block color="green" @click="startSearch" :disabled="isSearching">{{ $t('search.startSearch') }}</v-btn>
    </v-col>
    <v-col v-if="totalResults && nowResults" cols="12" sm="auto">
      <div>{{ nowResults }}/{{ totalResults }} ({{ searchPercentage }}%)</div>
      <div v-if="remainingTime">{{ $t('search.remainingTime') }}: {{ remainingTime }}</div>
      <div>{{ $t('search.processingSpeed') }}: {{ processingSpeed }}{{ $t('search.itemsPerSecond') }}</div>
    </v-col>
  </v-row>
  <v-dialog v-model="isErrorModalVisible" persistent :max-width="dialogWidth">
    <error-modal @close="isErrorModalVisible = false" />
  </v-dialog>
</template>

<script setup lang="ts">
import { computed, nextTick, ref, watch } from "vue";
import ErrorModal from "@/components/ErrorModal.vue";
import { storeToRefs } from "pinia";
import { runDeckSearch } from '@/domain/deckSearch/runDeckSearch';
import { useSearchResultStore } from '@/store/searchResult';
import { event } from 'vue-gtag'
import { useI18n } from 'vue-i18n';
const { t } = useI18n();

const searchResultStore = useSearchResultStore();
const { totalResults, nowResults, isSearching, errorMessage } = storeToRefs(searchResultStore);

// モーダルの表示状態を管理するためのリアクティブな変数
const isErrorModalVisible = ref(false);
const dialogWidth = computed(() => {
  const screenWidth = window.innerWidth;
  const maxWidth = screenWidth * 0.8;
  return maxWidth < 600 ? `${maxWidth}px` : "1200px";
});

const searchPercentage = computed(() => {
  const percentage = (nowResults.value / totalResults.value) * 100;
  return percentage.toFixed(1); // 小数点以下1桁までのパーセンテージ
});

// 進捗状況の計算用の変数
const startTime = ref<number>(0);
const processingSpeed = ref<string>('0');
const remainingTime = ref<string>('');

// 進捗状況の更新
const updateProgress = () => {
  if (!startTime.value || !nowResults.value || !totalResults.value) return;

  const currentTime = Date.now();
  const elapsedSeconds = (currentTime - startTime.value) / 1000;
  const speed = nowResults.value / elapsedSeconds;
  processingSpeed.value = speed.toFixed(1);

  const remainingItems = totalResults.value - nowResults.value;
  const estimatedSeconds = remainingItems / speed;
  
  if (estimatedSeconds > 0) {
    const hours = Math.floor(estimatedSeconds / 3600);
    const minutes = Math.floor((estimatedSeconds % 3600) / 60);
    const seconds = Math.floor(estimatedSeconds % 60);
    
    const timeParts = [];
    if (hours > 0) timeParts.push(t('search.hours', { hours }));
    if (minutes > 0) timeParts.push(t('search.minutes', { minutes }));
    timeParts.push(t('search.seconds', { seconds }));
    
    remainingTime.value = timeParts.join(' ');
  }
};

// 進捗状況の監視
watch(nowResults, () => {
  updateProgress();
});

const emit = defineEmits(['search-started']);
let searchRunToken = 0;

function waitForBrowserPaint(): Promise<void> {
  return new Promise((resolve) => {
    let done = false;
    let fallbackId: ReturnType<typeof setTimeout> | undefined;
    const finish = () => {
      if (done) return;
      done = true;
      if (fallbackId !== undefined) clearTimeout(fallbackId);
      resolve();
    };
    fallbackId = setTimeout(finish, 100);
    if (typeof requestAnimationFrame === 'function') {
      requestAnimationFrame(() => {
        setTimeout(finish, 0);
      });
    } else {
      setTimeout(finish, 0);
    }
  });
}

async function startSearch(){
  if (isSearching.value) return;
  const runToken = ++searchRunToken;
  isSearching.value = true;
  startTime.value = Date.now();
  processingSpeed.value = '0';
  remainingTime.value = '';
  emit('search-started');
  event('search start')
  try {
    await nextTick();
    await waitForBrowserPaint();
    if (runToken !== searchRunToken || !isSearching.value) return;
    await runDeckSearch(t);
  } finally {
    if (runToken === searchRunToken) {
      isSearching.value = false;
    }
  }
}
function stopSearch(){
  searchRunToken += 1;
  isSearching.value = false; // 検索中状態をfalseに設定してループを中止
  startTime.value = 0;
  processingSpeed.value = '0';
  remainingTime.value = '';
}
watch(errorMessage, (newVal) => {
  if(newVal !== '') { // errorMessageが空でない場合
    isErrorModalVisible.value = true; // エラーモーダルを表示する
  }
});

</script>
<style scoped>
@media (max-width: 600px) {
  .search-header-row {
    margin-left: 0 !important;
    margin-right: 0 !important;
  }

  .search-header-row :deep(.v-col) {
    padding-left: 0;
    padding-right: 0;
  }
}
</style>
