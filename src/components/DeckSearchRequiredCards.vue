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
import { useSearchSettingsStore } from '@/store/searchSetting';
import { isDeckSearchCardEligible } from '@/domain/deckSearch/roster';

const { t } = useI18n();
const settings = useSearchSettingsStore();
const hand = useHandCollectionStore();
const limit = computed(() => settings.allowSameCharacter ? 4 : 5);
const allowedCardNames = computed(() => settings.rosterSource === 'allMax' ? undefined
  : new Set(hand.ownedCards.filter(card => isDeckSearchCardEligible(card.cardName, hand.handCollection, settings.rosterSource))
    .map(card => card.cardName)));
const error = computed(() => {
  if (settings.requiredCards.length > limit.value) return t('error.requiredCardLimit');
  if (allowedCardNames.value && settings.requiredCards.some(name => !allowedCardNames.value?.has(name))) return t('error.requiredCardUnavailable');
  return '';
});
</script>
