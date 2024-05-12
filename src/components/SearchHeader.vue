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
        <span v-if="totalResults && nowResults">{{ nowResults }}/{{ totalResults }} ({{ searchPercentage }}%)</span>
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
  return maxWidth < 600 ? `${maxWidth}px` : "600px";
});

const searchPercentage = computed(() => {
  const percentage = (nowResults.value / totalResults.value) * 100;
  return percentage.toFixed(1); // 小数点以下1桁までのパーセンテージ
});

const emit = defineEmits(['search-started']);
function startSearch(){
  isSearching.value = true;
  emit('search-started',)
  event('search start')
  setTimeout(() => {
    calcDecks(t);
  }, 300); // 300 ミリ秒の遅延
}
function stopSearch(){
  isSearching.value = false; // 検索中状態をfalseに設定してループを中止
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
