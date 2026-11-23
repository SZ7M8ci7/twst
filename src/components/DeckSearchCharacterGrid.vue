<template>
  <div class="character-grid" role="group" :aria-label="label">
    <button
      v-for="character in deckSearchCharacters"
      :key="character.name_ja"
      type="button"
      :class="['character-button', { 'character-button--selected': selection.includes(character.name_ja) }]"
      @click="toggle(character.name_ja)"
      :aria-label="localizeCharacterName(character.name_ja, locale)"
      :title="localizeCharacterName(character.name_ja, locale)"
      :aria-pressed="selection.includes(character.name_ja)"
    >
      <img
        v-if="iconUrls[character.name_en]"
        :src="iconUrls[character.name_en]"
        alt=""
        class="character-icon"
      />
      <span v-else>{{ localizeCharacterName(character.name_ja, locale) }}</span>
    </button>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { deckSearchCharacters } from '@/store/searchSetting';
import { loadImageUrls } from '@/utils/characterAssets';
import { localizeCharacterName } from '@/utils/localizedDisplay';

defineProps<{ label: string }>();
const selection = defineModel<string[]>({ required: true });
const { locale } = useI18n();
const iconUrls = ref<Record<string, string>>({});
onMounted(async () => {
  iconUrls.value = await loadImageUrls(deckSearchCharacters, 'name_en', 'icon/');
});

function toggle(name: string) {
  selection.value = selection.value.includes(name)
    ? selection.value.filter(selected => selected !== name)
    : [...selection.value, name];
}
</script>

<style scoped>
.character-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(36px, 1fr));
  gap: 6px;
}

.character-button {
  border: 1px solid transparent;
  border-radius: 8px;
  background: transparent;
  padding: 2px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: transform 0.15s ease, box-shadow 0.15s ease, border-color 0.15s ease, background-color 0.15s ease, opacity 0.15s ease;
  opacity: 0.55;
}

.character-button:hover {
  transform: translateY(-1px);
  opacity: 0.75;
}

.character-button--selected {
  border-color: #1976d2;
  background: #eef5ff;
  box-shadow: 0 0 0 1px rgba(25, 118, 210, 0.2);
  opacity: 1;
}

.character-icon {
  width: 30px;
  height: 30px;
  object-fit: cover;
  border-radius: 6px;
  display: block;
  filter: grayscale(1);
  transition: filter 0.15s ease, opacity 0.15s ease;
}

.character-button--selected .character-icon {
  filter: grayscale(0);
}

@media (max-width: 600px) {
  .character-grid {
    grid-template-columns: repeat(auto-fill, minmax(34px, 1fr));
    gap: 5px;
  }

  .character-icon {
    width: 28px;
    height: 28px;
  }
}
</style>
