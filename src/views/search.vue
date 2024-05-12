<template>
  <v-container>
    <div>
      <SearchHeader @search-started="handleSearchStarted" />
    </div>
    <v-tabs v-model="tab" color="indigo-darken-2" fixed-tabs 
      :show-arrows="false"
      :mobile-breakpoint="Infinity">
      <v-tab value="search">{{ $t('search.characterList') }}</v-tab>
      <v-tab value="result">{{ $t('search.result') }}</v-tab>
    </v-tabs>
    <v-card-text>
      <v-window v-model="tab" disabled >
        <v-window-item value="search">
          <SearchBody />
        </v-window-item>
        <v-window-item value="result">
          <ResultBody/>
        </v-window-item>
      </v-window>
    </v-card-text>
  </v-container>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import SearchHeader from '@/components/SearchHeader.vue';
import SearchBody from '@/components/SearchBody.vue';
import ResultBody from '@/components/ResultBody.vue';

const tab = ref('search');
const searchStarted = ref(false);

const handleSearchStarted = () => {
  tab.value = 'result'; // タブを検索結果に切り替える
  searchStarted.value = true; // 検索が開始されたことを示す
};
</script>