<template>
  <!-- フィルターボタン -->
  <v-row class="mb-1"> <!-- marginBottomを追加して下段との間隔を空けます -->
    <v-col cols="12" sm="3"/>
    <v-col cols="12" sm="2">
      <v-btn block @click="isFilterModalVisible = true">{{ $t('search.filter') }}</v-btn>
    </v-col>
    <v-col cols="12" sm="2">
      <v-btn block @click="isSettingModalVisible = true">{{ $t('search.settings') }}</v-btn>
    </v-col>
    <v-col cols="12" sm="2">
      <v-btn block @click="isInfoModalVisible = true">{{ $t('search.howToUse') }}</v-btn>
    </v-col>
    <v-col cols="12" sm="3"/>
    </v-row>

    <!-- 下段のボタン -->
    <v-row class="mb-1">
      <v-col cols="12" sm="3"/>
      <v-col cols="12" sm="2">
        <v-btn block color="red" @click="stopSearch">{{ $t('search.cancelSearch') }}</v-btn>
      </v-col>
      <v-col cols="12" sm="2">
        <v-btn block color="green" @click="startSearch">{{ $t('search.startSearch') }}</v-btn>
      </v-col>
      <v-col cols="12" sm="2">
        <div v-if="totalResults && nowResults">
          <div>{{ nowResults }}/{{ totalResults }} ({{ searchPercentage }}%)</div>
          <div v-if="remainingTime">{{ $t('search.remainingTime') }}: {{ remainingTime }}</div>
          <div>{{ $t('search.processingSpeed') }}: {{ processingSpeed }}{{ $t('search.itemsPerSecond') }}</div>
        </div>
      </v-col>
      <v-col cols="12" sm="3"/>
    </v-row>

  <!-- フィルターモーダル -->
  <v-dialog v-model="isInfoModalVisible" persistent :max-width="dialogWidth">
    <Info-modal @close="isInfoModalVisible = false" />
  </v-dialog>
  <v-dialog v-model="isFilterModalVisible" persistent :max-width="dialogWidth">
    <filter-modal @close="isFilterModalVisible = false" />
  </v-dialog>
  <v-dialog v-model="isSettingModalVisible" persistent :max-width="dialogWidth">
    <setting-modal @close="isSettingModalVisible = false" />
  </v-dialog>
  <v-dialog v-model="isErrorModalVisible" persistent :max-width="dialogWidth">
    <error-modal @close="isErrorModalVisible = false" />
  </v-dialog>
</template>

<script setup lang="ts">
import { computed, ref, watch } from "vue";
import InfoModal from "@/components/InfoModal.vue";
import FilterModal from "@/components/FilterModal.vue";
import SettingModal from "@/components/SettingModal.vue";
import ErrorModal from "@/components/ErrorModal.vue";
import { storeToRefs } from "pinia";
import { calcDecks } from "./common";
import { useSearchResultStore } from '@/store/searchResult';
import { event } from 'vue-gtag'
import { useI18n } from 'vue-i18n';
const { t } = useI18n();

const searchResultStore = useSearchResultStore();
const { totalResults, nowResults, isSearching, errorMessage } = storeToRefs(searchResultStore);

// モーダルの表示状態を管理するためのリアクティブな変数
const isInfoModalVisible = ref(false);
const isFilterModalVisible = ref(false);
const isSettingModalVisible = ref(false);
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
function startSearch(){
  isSearching.value = true;
  startTime.value = Date.now();
  processingSpeed.value = '0';
  remainingTime.value = '';
  emit('search-started',)
  event('search start')
  setTimeout(() => {
    calcDecks(t);
  }, 300); // 300 ミリ秒の遅延
}
function stopSearch(){
  isSearching.value = false; // 検索中状態をfalseに設定してループを中止
  startTime.value = 0;
  processingSpeed.value = '0';
  remainingTime.value = '';
}
// eslint-disable-next-line @typescript-eslint/no-unused-vars
watch(errorMessage, (newVal, oldVal) => {
  if(newVal !== '') { // errorMessageが空でない場合
    isErrorModalVisible.value = true; // エラーモーダルを表示する
  }
});
</script>

<style scoped>
</style>
