<template>
  <v-container style="min-width: 90%;">
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
    <v-card-text>
      <v-window v-model="tab" disabled >
        <v-window-item value="search">
          <SearchBody :focus-request="focusRequest" />
        </v-window-item>
        <v-window-item value="support">
          <SupportBody :focus-request="focusRequest" />
        </v-window-item>
        <v-window-item value="result">
          <ResultBody @focus-character-setting="handleFocusCharacterSetting" />
        </v-window-item>
      </v-window>
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
  await waitForLayoutStability(2);

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