<template>
  <!-- フィルターボタン -->
  <v-row class="mb-1"> <!-- marginBottomを追加して下段との間隔を空けます -->
    <v-col cols="12" sm="3"/>
    <v-col cols="12" sm="2">
      <v-btn block @click="isFilterModalVisible = true">フィルター</v-btn>
    </v-col>
    <v-col cols="12" sm="2">
      <v-btn block @click="isSettingModalVisible = true">検索設定</v-btn>
    </v-col>
    <v-col cols="12" sm="2">
      <v-btn block @click="isInfoModalVisible = true">使い方</v-btn>
    </v-col>
    <v-col cols="12" sm="3"/>
    </v-row>

    <!-- 下段のボタン -->
    <v-row class="mb-1">
      <v-col cols="12" sm="3"/>
      <v-col cols="12" sm="2">
        <v-btn block color="red" @click="stopSearch">探索中止</v-btn>
      </v-col>
      <v-col cols="12" sm="2">
        <v-btn block color="green" @click="startSearch">探索開始</v-btn>
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
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import InfoModal from "@/components/InfoModal.vue";
import FilterModal from "@/components/FilterModal.vue";
import SettingModal from "@/components/SettingModal.vue";
import { storeToRefs } from "pinia";
import { calcDecks } from "./common";
import { useSearchResultStore } from '@/store/searchResult';
import { event } from 'vue-gtag'

const searchResultStore = useSearchResultStore();
const { totalResults, nowResults, isSearching } = storeToRefs(searchResultStore);

// モーダルの表示状態を管理するためのリアクティブな変数
const isInfoModalVisible = ref(false);
const isFilterModalVisible = ref(false);
const isSettingModalVisible = ref(false);
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
    calcDecks();
  }, 300); // 300 ミリ秒の遅延
}
function stopSearch(){
  isSearching.value = false; // 検索中状態をfalseに設定してループを中止
}
</script>

<style scoped>
</style>