<template>
  <v-container class="pa-0">
    <div class="d-flex justify-end mb-2">
      <v-btn
        color="primary"
        class="mr-2"
        size="small"
        @click="selectAll"
      >
        {{ $t('support.selectAll') }}
      </v-btn>
      <v-btn
        color="error"
        size="small"
        @click="deselectAll"
      >
        {{ $t('support.deselectAll') }}
      </v-btn>
    </div>
    <div class="character-grid">
      <div
        v-for="character in ssrCharacters"
        :key="character.name"
        class="character-item"
      >
        <v-card
          :class="{ 'unselected-character': !isSelected(character.name) }"
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
import { computed, onMounted } from 'vue';
import { useCharacterStore } from '@/store/characters';
import { useSearchSettingsStore } from '@/store/searchSetting';
import { storeToRefs } from 'pinia';
import characters_info from '@/assets/characters_info.json';

interface CharacterInfo {
  name_ja: string;
  name_en: string;
  dorm: string;
  theme_1: string;
  theme_2: string;
}

const characterStore = useCharacterStore();
const searchSettingsStore = useSearchSettingsStore();
const { characters } = storeToRefs(characterStore);
const { selectedSupportCharacters } = storeToRefs(searchSettingsStore);

const ssrCharacters = computed(() => {
  const characterOrder = characters.value
    .filter(character => character.rare === 'SSR')
    .map(chara => ({
      name: chara.name,
      imgUrl: chara.imgUrl,
      chara: chara.chara
    }));


  // characters_info.jsonの順序に基づいてソート
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

onMounted(() => {
  selectAll(); // コンポーネントがマウントされた時に全選択
});
</script>

<style scoped>
.character-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 2px;
}

.character-item {
  flex: 0 0 auto;
}

.character-card {
  cursor: pointer;
  transition: all 0.3s ease;
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 0;
}

.character-card:hover {
  transform: scale(1.05);
}

.unselected-character {
  opacity: 0.3;
  filter: grayscale(100%);
}

.character-image {
  object-fit: contain;
}
</style> 