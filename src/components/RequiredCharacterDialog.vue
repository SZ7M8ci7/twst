<template>
  <v-dialog v-model="characterFilterOpen" max-width="640" scrollable class="search-character-dialog" data-testid="character-filter-dialog">
    <v-card class="modal-card character-filter-card">
      <v-card-title class="modal-title">{{ t('examSearch.characterFilter') }}</v-card-title>
      <v-card-text>
        <p class="filter-help">{{ t('examSearch.characterFilterHelp', { count: characterFilter.length }) }}</p>
        <div class="character-filter-list">
          <label v-for="character in characters" :key="character.name" class="character-filter-option" :class="{ selected: characterFilter.includes(character.name) }" :title="localizeCharacterName(character.name, locale)">
            <input type="checkbox" class="sr-only" :data-character-name="character.name" :aria-label="localizeCharacterName(character.name, locale)" :disabled="!characterFilter.includes(character.name) && characterFilter.length >= 5" v-model="characterFilter" :value="character.name" />
            <span class="character-icon-wrap">
              <img :src="characterIconImages[character.name] || defaultImg" :alt="localizeCharacterName(character.name, locale)" class="character-icon" loading="lazy" />
              <span v-if="characterFilter.includes(character.name)" class="character-selected-mark">✓</span>
            </span>
          </label>
        </div>
        <p v-if="!characters.length" class="filter-empty">{{ t('examSearch.filterEmpty') }}</p>
      </v-card-text>
      <v-card-actions><v-spacer /><v-btn data-testid="character-filter-close" color="primary" variant="tonal" @click="characterFilterOpen = false">{{ t('common.close') }}</v-btn></v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import cards from '@/assets/chara.json';
import charactersInfo from '@/assets/characters_info.json';
import defaultImg from '@/assets/img/default.webp';
import { loadCachedImageUrl } from '@/utils/characterAssets';
import { localizeCharacterName } from '@/utils/localizedDisplay';

const characterFilter = defineModel<string[]>({ required: true });
const characterFilterOpen = defineModel<boolean>('open', { required: true });
const { t, locale } = useI18n();
const cardCharacters = new Set(cards.map(card => card.chara));
const characters = charactersInfo.filter(character => cardCharacters.has(character.name_ja))
  .map(character => ({ name: character.name_ja, icon: character.name_en }));
const characterIconImages = ref<Record<string, string>>({});
watch(characterFilterOpen, open => {
  if (!open) return;
  for (const character of characters) {
    if (!characterIconImages.value[character.name]) {
      void loadCachedImageUrl(character.icon, 'icon/').then(url => { characterIconImages.value[character.name] = url; });
    }
  }
}, { immediate: true });
</script>

<style scoped>
.filter-help { color: #52616d; font-size: .85rem; margin: 8px 0; }
.filter-empty { color: #8b4a10; }
.character-filter-option { display: flex; align-items: center; gap: 8px; min-width: 0; padding: 8px; border: 1px solid #dde6ed; border-radius: 8px; background: #fbfcfd; cursor: pointer; }
.character-filter-option.selected { border-color: #d9a65d; background: #fff7ec; }
.character-filter-option input { flex: 0 0 auto; accent-color: #b16a21; }
.character-icon-wrap { position: relative; flex: 0 0 auto; display: block; }
.character-filter-option:focus-within { outline: 2px solid #b16a21; outline-offset: 2px; }
.character-filter-option span { min-width: 0; overflow-wrap: anywhere; font-size: .85rem; }
.character-filter-list { display: grid; grid-template-columns: repeat(auto-fill, minmax(60px, 1fr)); gap: 6px; margin: 12px 2px 4px; }
.character-filter-option { flex-direction: column; justify-content: flex-start; text-align: center; padding: 4px; gap: 4px; }
.character-icon { width: 50px; height: 50px; border-radius: 50%; object-fit: cover; background: #eef3f7; }
.character-filter-option:not(.selected) .character-icon { opacity: .5; }
.character-selected-mark { position: absolute; right: -4px; bottom: -4px; display: grid; place-items: center; width: 20px; height: 20px; border-radius: 50%; background: #b16a21; color: #fff; font-size: 13px !important; font-weight: 800; }
.sr-only { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0, 0, 0, 0); white-space: nowrap; border: 0; }
.character-filter-option:has(input:disabled) { opacity: .45; cursor: default; }
.v-dialog.search-character-dialog :deep(.v-card.character-filter-card) { overflow: hidden; }
.v-dialog.search-character-dialog :deep(.character-filter-card > .v-card-text) { min-height: 0; padding: 12px 16px; }
</style>
