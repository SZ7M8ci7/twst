<template>
  <v-container fluid class="search-page-container">
    <div>
      <SearchHeader @search-started="handleSearchStarted" />
    </div>
    <v-tabs v-model="tab" color="indigo-darken-2" fixed-tabs
      :show-arrows="false"
      :mobile-breakpoint="Infinity">
      <v-tab value="search">{{ $t('search.characterList') }}</v-tab>
      <v-tab value="support">{{ $t('search.support') }}</v-tab>
      <v-tab value="result">{{ $t('search.result') }}</v-tab>
    </v-tabs>
    <v-card-text class="search-page-card-text">
      <KeepAlive>
        <SearchBody
          v-if="tab === 'search'"
          :focus-request="focusRequest"
        />
        <SupportBody
          v-else-if="tab === 'support'"
          :focus-request="focusRequest"
        />
        <ResultBody
          v-else
          @focus-character-setting="handleFocusCharacterSetting"
        />
      </KeepAlive>
    </v-card-text>
  </v-container>
</template>

<script setup lang="ts">
import { nextTick, onMounted, ref } from 'vue';
import { waitForLayoutStability } from '@/utils/scrollPosition';
import SearchHeader from '@/components/SearchHeader.vue';
import SearchBody from '@/components/SearchBody.vue';
import SupportBody from '@/components/SupportBody.vue';
import ResultBody from '@/components/ResultBody.vue';
import { useCharacterStore } from '@/store/characters';

type SearchTab = 'search' | 'support' | 'result';

type FocusRequest = {
  requestId: number;
  characterName: string;
  targetTab: Exclude<SearchTab, 'result'>;
};

const characterStore = useCharacterStore();

const tab = ref<SearchTab>('search');
const focusRequest = ref<FocusRequest | null>(null);
let focusRequestSequence = 0;

const handleSearchStarted = () => {
  tab.value = 'result';
};

const handleFocusCharacterSetting = async (payload: Omit<FocusRequest, 'requestId'>) => {
  tab.value = payload.targetTab;
  await nextTick();
  await waitForLayoutStability(5);

  focusRequestSequence += 1;
  focusRequest.value = {
    ...payload,
    requestId: focusRequestSequence,
  };
};

onMounted(() => {
  characterStore.handlePageChange('searchPage');
});
</script>
<style scoped>
.search-page-container {
  max-width: none;
  padding-left: 12px;
  padding-right: 12px;
}

.search-page-card-text {
  padding-left: 8px;
  padding-right: 8px;
}

@media (max-width: 960px) {
  .search-page-container {
    padding-left: 6px;
    padding-right: 6px;
  }

  .search-page-card-text {
    padding-left: 2px;
    padding-right: 2px;
    padding-top: 12px;
    padding-bottom: 12px;
  }
}

@media (max-width: 600px) {
  .search-page-container {
    padding-left: 2px;
    padding-right: 2px;
  }

  .search-page-card-text {
    padding-left: 0;
    padding-right: 0;
    padding-top: 8px;
    padding-bottom: 8px;
  }
}
</style>
