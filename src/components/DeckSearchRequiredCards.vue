<template>
  <RequiredCardPicker v-model="settings.requiredCards" :label="t('search.requiredCards')"
    :limit="limit" :allowed-card-names="allowedCardNames" catalog-mode />
  <p v-if="error" role="alert" class="text-error text-body-2">{{ error }}</p>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import RequiredCardPicker from './RequiredCardPicker.vue';
import { useHandCollectionStore } from '@/store/handCollection';
import { useCharacterStore } from '@/store/characters';
import { useSearchSettingsStore } from '@/store/searchSetting';
import { isDeckSearchCardEligible } from '@/domain/deckSearch/roster';

const { t } = useI18n();
const settings = useSearchSettingsStore();
const hand = useHandCollectionStore();
const catalog = useCharacterStore();
const limit = computed(() => settings.allowSameCharacter ? 4 : 5);
const allowedCardNames = computed(() => {
  const candidates = new Set(settings.candidateCharacters);
  return new Set(catalog.characters.filter(card => candidates.has(card.chara)
    && isDeckSearchCardEligible(card.name, hand.handCollection, settings.rosterSource)).map(card => card.name));
});
const error = computed(() => {
  if (settings.requiredCards.length > limit.value) return t('error.requiredCardLimit');
  if (settings.requiredCards.some(name => !allowedCardNames.value.has(name))) return t('error.requiredCardUnavailable');
  return '';
});
</script>
