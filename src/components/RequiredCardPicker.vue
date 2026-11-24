<template>
  <div class="required-card-setting">
    <div class="selection-label">{{ label }}<span class="optional-label">{{ t('examSearch.optional') }}</span></div>
    <div class="required-card-slots">
      <div v-for="slot in requiredCardSlots.length" :key="slot" class="required-card-slot">
        <button type="button" :data-testid="`required-card-slot-${slot - 1}`" class="required-card-pick"
          :aria-label="`${label} ${slot}${requiredCardSlots[slot - 1] ? ': ' + cardLabel(requiredCardSlots[slot - 1]) : ''}`"
          @click="openRequiredCard(slot - 1)">
          <img v-if="requiredCardSlots[slot - 1]" :src="cardImages[requiredCardSlots[slot - 1]] || defaultImg" :alt="cardLabel(requiredCardSlots[slot - 1])" />
          <svg v-else aria-hidden="true" width="20" height="20" viewBox="0 0 20 20">
            <path d="M3 10h14M10 3v14" fill="none" stroke="currentColor" stroke-width="2" />
          </svg>
        </button>
        <button v-if="requiredCardSlots[slot - 1]" type="button" class="required-card-clear"
          :data-testid="`required-card-clear-${slot - 1}`" :aria-label="`${t('examSearch.clear')}: ${label} ${slot} ${cardLabel(requiredCardSlots[slot - 1])}`"
          @click="clearRequiredCard(slot - 1)">×</button>
      </div>
    </div>
  </div>
  <Teleport to="body">
    <SimCharaModal v-if="selectingIndex !== null" data-testid="card-filter-dialog"
      :catalog-mode="catalogMode" :allowed-card-names="allowedCardNames"
      @select="selectRequiredCard" @close="selectingIndex = null" />
  </Teleport>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import SimCharaModal from './SimCharaModal.vue';
import { useCharacterStore } from '@/store/characters';
import { loadImageUrls } from '@/utils/characterAssets';
import { localizeCardTitle } from '@/utils/localizedDisplay';
import defaultImg from '@/assets/img/default.webp';

const props = withDefaults(defineProps<{
  label: string;
  limit?: number;
  catalogMode?: boolean;
  allowedCardNames?: Set<string>;
}>(), { limit: 5 });
const model = defineModel<string[]>({ required: true });
const { t, locale } = useI18n();
const catalog = useCharacterStore();
const cardsByName = computed(() => new Map(catalog.characters.map(card => [card.name, card])));
function cardLabel(name: string) {
  const card = cardsByName.value.get(name);
  return card ? localizeCardTitle(card, locale.value) : name;
}

const cardImages = ref<Record<string, string>>({});
const selectingIndex = ref<number | null>(null);
const requiredCardSlots = ref<string[]>([]);
watch([model, () => props.limit], ([names, limit], _, onCleanup) => {
  const count = Math.max(limit, names.length);
  const filled = requiredCardSlots.value.filter(Boolean);
  if (requiredCardSlots.value.length !== count || filled.length !== names.length || filled.some((name, i) => name !== names[i])) {
    requiredCardSlots.value = Array.from({ length: count }, (_, i) => names[i] ?? '');
  }
  let current = true;
  onCleanup(() => { current = false; });
  void loadImageUrls(names, name => name, '', 'notyet').then(images => {
    if (current) cardImages.value = images;
  });
}, { immediate: true });

function openRequiredCard(index: number) {
  selectingIndex.value = index;
}
function selectRequiredCard(card: { name: string }) {
  const index = selectingIndex.value;
  if (index === null || (props.allowedCardNames && !props.allowedCardNames.has(card.name))) return;
  const slots = [...requiredCardSlots.value];
  const previous = slots.indexOf(card.name);
  if (previous >= 0) slots[previous] = slots[index];
  slots[index] = card.name;
  requiredCardSlots.value = slots;
  model.value = slots.filter(Boolean);
  selectingIndex.value = null;
}
function clearRequiredCard(index: number) {
  requiredCardSlots.value[index] = '';
  model.value = requiredCardSlots.value.filter(Boolean);
}
</script>

<style scoped>
.required-card-setting { display: grid; grid-template-columns: 150px minmax(0, 1fr); align-items: center; gap: 16px; padding: 12px 0; }
.selection-label { display: flex; align-items: center; gap: 8px; font-size: .9rem; }
.optional-label { font-size: .75rem; color: #657582; }
.required-card-slots { display: grid; grid-template-columns: repeat(5, minmax(0, 72px)); gap: 10px; }
.required-card-slot { position: relative; min-width: 0; }
.required-card-pick { display: grid; place-items: center; width: 100%; aspect-ratio: 1; border: 1px solid #c6d1dc; border-radius: 6px; overflow: hidden; background: white; color: #1976d2; font-size: 24px; }
.required-card-pick img { width: 100%; height: 100%; object-fit: cover; }
.required-card-clear { position: absolute; top: -7px; right: -7px; width: 22px; height: 22px; background: white; border: 1px solid #c6d1dc; border-radius: 50%; line-height: 18px; }
@media (max-width: 600px) {
  .required-card-setting { grid-template-columns: 1fr; gap: 8px; }
}
</style>
