<template>
  <v-container style="min-width: 80%;">
    <div>
      <SearchHeader1 @search-started="handleSearchStarted" />
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
          <SearchBody1 />
        </v-window-item>
        <v-window-item value="result">
          <ResultBody/>
        </v-window-item>
      </v-window>
    </v-card-text>
  </v-container>
</template>

<script setup lang="ts">
import {onMounted, ref} from 'vue';
import SearchHeader1 from '@/components/SearchHeader1.vue';
import SearchBody1 from '@/components/SearchBody1.vue';
import ResultBody from '@/components/ResultBody.vue';
import {useCharacterStore} from '@/store/characters';

const characterStore = useCharacterStore();

const tab = ref('search');
const searchStarted = ref(false);

const handleSearchStarted = () => {
  tab.value = 'result'; // タブを検索結果に切り替える
  searchStarted.value = true; // 検索が開始されたことを示す
};

onMounted(() => {
  characterStore.handlePageChange('searchPage');
});
</script>
