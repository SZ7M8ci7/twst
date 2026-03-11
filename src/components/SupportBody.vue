<template>
  <v-container class="pa-0">
    <div class="support-toolbar">
      <v-btn
        color="primary"
        class="support-toolbar-button"
        size="small"
        @click="selectAll"
      >
        {{ $t('support.selectAll') }}
      </v-btn>
      <v-btn
        color="error"
        class="support-toolbar-button"
        size="small"
        @click="deselectAll"
      >
        {{ $t('support.deselectAll') }}
      </v-btn>
      <v-btn
        color="success"
        class="support-toolbar-button"
        size="small"
        @click="selectHeal"
      >
        {{ $t('support.selectHeal') }}
      </v-btn>
      <v-btn
        color="warning"
        class="support-toolbar-button"
        size="small"
        @click="deselectHeal"
      >
        {{ $t('support.deselectHeal') }}
      </v-btn>
      <v-btn
        color="success"
        class="support-toolbar-button"
        size="small"
        @click="selectRegen"
      >
        {{ $t('support.selectRegen') }}
      </v-btn>
      <v-btn
        color="warning"
        class="support-toolbar-button"
        size="small"
        @click="deselectRegen"
      >
        {{ $t('support.deselectRegen') }}
      </v-btn>
    </div>
    <div class="character-grid">
      <div
        v-for="character in ssrCharacters"
        :key="character.name"
        :class="[
          'character-item',
          { 'focused-support-character': highlightedCharacterName === character.name },
        ]"
        :ref="(element) => setCharacterElement(character.name, element)"
      >
        <v-card
          :class="[
            { 'unselected-character': !isSelected(character.name) },
          ]"
          @click="toggleCharacter(character.name)"
          class="character-card"
          elevation="2"
        >
          <v-img
            :src="character.imgUrl"
            height="60"
            width="60"
            class="character-image"
            contain
          ></v-img>
        </v-card>
      </div>
    </div>
  </v-container>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useCharacterStore } from '@/store/characters';
import { useSearchSettingsStore } from '@/store/searchSetting';
import { storeToRefs } from 'pinia';
import characters_info from '@/assets/characters_info.json';
import { findNearestVerticalScrollContainer, scrollElementToViewportCenter, scrollElementWithinContainerToCenter, waitForLayoutStability } from '@/utils/scrollPosition';

interface CharacterInfo {
  name_ja: string;
  name_en: string;
  dorm: string;
  theme_1: string;
  theme_2: string;
}

type FocusRequest = {
  requestId: number;
  characterName: string;
  targetTab: 'search' | 'support';
};

const props = defineProps<{
  focusRequest: FocusRequest | null;
}>();

const characterStore = useCharacterStore();
const searchSettingsStore = useSearchSettingsStore();
const { characters } = storeToRefs(characterStore);
const { selectedSupportCharacters } = storeToRefs(searchSettingsStore);

const highlightedCharacterName = ref('');
const characterElements = new Map<string, HTMLElement>();
let focusHighlightTimeout: number | null = null;
const FOCUS_HIGHLIGHT_DURATION_MS = 1300;

const ssrCharacters = computed(() => {
  const characterOrder = characters.value
    .filter(character => character.rare === 'SSR')
    .map(chara => ({
      name: chara.name,
      imgUrl: chara.imgUrl,
      chara: chara.chara,
      magic1heal: chara.magic1heal,
      magic2heal: chara.magic2heal,
      magic3heal: chara.magic3heal
    }));

  const sorted = characterOrder.sort((a, b) => {
    const aInfo = (characters_info as CharacterInfo[]).find(char => char.name_ja === a.chara);
    const bInfo = (characters_info as CharacterInfo[]).find(char => char.name_ja === b.chara);

    if (!aInfo || !bInfo) {
      return 0;
    }

    const aIndex = (characters_info as CharacterInfo[]).indexOf(aInfo);
    const bIndex = (characters_info as CharacterInfo[]).indexOf(bInfo);

    return aIndex - bIndex;
  });

  return sorted;
});

const hasInstantHeal = (
  character: { magic1heal?: string; magic2heal?: string; magic3heal?: string }
) => [character.magic1heal, character.magic2heal, character.magic3heal]
  .some((heal) => typeof heal === 'string' && (heal.startsWith('回復(') || heal.startsWith('回復&継続回復(')));

const hasRegen = (
  character: { magic1heal?: string; magic2heal?: string; magic3heal?: string }
) => [character.magic1heal, character.magic2heal, character.magic3heal]
  .some((heal) => typeof heal === 'string' && (heal.startsWith('継続回復(') || heal.startsWith('回復&継続回復(')));

const updateSelection = (names: string[], selected: boolean) => {
  const next = new Set(selectedSupportCharacters.value);
  names.forEach((name) => {
    if (selected) {
      next.add(name);
    } else {
      next.delete(name);
    }
  });
  selectedSupportCharacters.value = [...next];
};

const isSelected = (characterName: string) => {
  return selectedSupportCharacters.value.includes(characterName);
};

const toggleCharacter = (characterName: string) => {
  const index = selectedSupportCharacters.value.indexOf(characterName);
  if (index === -1) {
    selectedSupportCharacters.value.push(characterName);
  } else {
    selectedSupportCharacters.value.splice(index, 1);
  }
};

const selectAll = () => {
  selectedSupportCharacters.value = ssrCharacters.value.map(char => char.name);
};

const deselectAll = () => {
  selectedSupportCharacters.value = [];
};

const selectHeal = () => {
  updateSelection(
    ssrCharacters.value.filter(character => hasInstantHeal(character)).map(character => character.name),
    true
  );
};

const deselectHeal = () => {
  updateSelection(
    ssrCharacters.value.filter(character => hasInstantHeal(character)).map(character => character.name),
    false
  );
};

const selectRegen = () => {
  updateSelection(
    ssrCharacters.value.filter(character => hasRegen(character)).map(character => character.name),
    true
  );
};

const deselectRegen = () => {
  updateSelection(
    ssrCharacters.value.filter(character => hasRegen(character)).map(character => character.name),
    false
  );
};

function setCharacterElement(characterName: string, element: unknown) {
  if (element instanceof HTMLElement) {
    characterElements.set(characterName, element);
    return;
  }
  characterElements.delete(characterName);
}

async function focusCharacterSetting(request: FocusRequest | null) {
  if (!request || request.targetTab !== 'support') return;

  await nextTick();
  await waitForLayoutStability(5);

  const targetElement = characterElements.get(request.characterName);
  if (!targetElement) return;

  highlightedCharacterName.value = request.characterName;

  const scrollContainer = findNearestVerticalScrollContainer(targetElement);
  if (scrollContainer) {
    scrollElementWithinContainerToCenter(scrollContainer, targetElement);
  } else {
    scrollElementToViewportCenter(targetElement);
  }

  if (focusHighlightTimeout !== null) {
    window.clearTimeout(focusHighlightTimeout);
  }
  focusHighlightTimeout = window.setTimeout(() => {
    highlightedCharacterName.value = '';
  }, FOCUS_HIGHLIGHT_DURATION_MS);
}

watch(
  () => props.focusRequest?.requestId,
  () => {
    if (!props.focusRequest || props.focusRequest.targetTab !== 'support') return;
    void focusCharacterSetting(props.focusRequest);
  }
);

onMounted(() => {
  selectAll();
});

onBeforeUnmount(() => {
  if (focusHighlightTimeout !== null) {
    window.clearTimeout(focusHighlightTimeout);
  }
});
</script>

<style scoped>
.support-toolbar {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 8px;
  margin-bottom: 8px;
}

.support-toolbar-button {
  margin-right: 0 !important;
}

.character-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 2px;
}

.character-item {
  flex: 0 0 auto;
  position: relative;
  overflow: visible;
}

.character-card {
  cursor: pointer;
  transition: all 0.3s ease;
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 0;
  position: relative;
  z-index: 1;
}

.character-card:hover {
  transform: scale(1.05);
}

.focused-support-character {
  isolation: isolate;
  z-index: 20;
}

.focused-support-character .character-card {
  z-index: 21;
}

.focused-support-character::before,
.focused-support-character::after {
  content: '';
  position: absolute;
  inset: -5px;
  border: 4px solid #ff3b30;
  border-radius: 10px;
  pointer-events: none;
}

.focused-support-character::before {
  z-index: 22;
  opacity: 1;
}

.focused-support-character::after {
  z-index: 23;
  opacity: 0.95;
  will-change: transform, opacity;
  animation: support-focus-pulse 0.78s linear infinite alternate;
}

@keyframes support-focus-pulse {
  0% {
    transform: scale(1);
    opacity: 0.9;
  }

  100% {
    transform: scale(1.36);
    opacity: 0;
  }
}

.unselected-character {
  opacity: 0.3;
  filter: grayscale(100%);
}

.character-image {
  object-fit: contain;
}

@media (max-width: 600px) {
  .support-toolbar {
    justify-content: flex-start;
    gap: 6px;
  }

  .support-toolbar-button {
    flex: 1 1 calc(50% - 6px);
    min-width: 0;
  }
}
</style>