<template>
  <v-btn block @click="isFilterModalVisible = true">{{ t('common.filter') }}</v-btn>
  <!-- フィルターモーダル -->
  <v-dialog v-model="isFilterModalVisible" persistent :max-width="dialogWidth">
    <filter-modal @close="isFilterModalVisible = false" />
  </v-dialog>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import { useI18n } from 'vue-i18n';
import FilterModal from "@/components/FilterModal.vue";

// モーダルの表示状態を管理するためのリアクティブな変数
const isFilterModalVisible = ref(false);
const { t } = useI18n();

const dialogWidth = computed(() => {
  const screenWidth = window.innerWidth;
  const maxWidth = screenWidth * 0.8;
  return maxWidth < 600 ? `${maxWidth}px` : "1200px";
});
</script>

<style scoped>
</style>
