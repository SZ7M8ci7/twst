<template>
  <v-row class="mb-1">
    <v-col cols="12" class="text-center">
      <div class="reset-stats">
        {{ $t('hand.reset_stats', { 
          ok: resetOkCount, 
          total: resetTotalCount,
          percent: resetTotalCount > 0 ? Math.round((resetOkCount / resetTotalCount) * 100) : 0
        }) }}
      </div>
    </v-col>
  </v-row>

  <v-row class="mb-1">
    <div class="simulator">
      <div v-for="(item, index) in displayedList" :key="index" class="generated-item" @click="toggleSelection(index)">
        <v-img :src="item.imgUrl" class="generated-image" :class="{ 'selected': isSelected(index) }" contain>
          <div class="generated-text" :data-attr="getAttr(item.text, item)">{{ item.text }}</div>
        </v-img>
      </div>
      <div class="next-turn-btn">
        <v-btn :disabled="selectedCount !== 2" block color="green" @click="nextTurn">{{ $t('hand.next') }}</v-btn>
      </div>
    </div>
  </v-row>

  <v-row class="mb-1">
    <div class="reset-buttons">
      <v-btn block color="success" @click="resetDeck(true)">{{ $t('hand.reset_ok') }}</v-btn>
      <v-btn block color="error" @click="resetDeck(false)">{{ $t('hand.reset_ng') }}</v-btn>
    </div>
  </v-row>

  <v-row class="mb-1">
    <div class="deck">
      <div v-for="(character, index) in deck" :key="character.name" class="deck-item">
        <v-img
          :src="character.imgUrl"
          class="character-image"
          @mouseover="showRemove = index"
          @mouseleave="showRemove = null"
          contain
        >
          <v-btn v-if="showRemove === index" icon class="remove-btn" @click="removeFromDeck(index)">
            <v-icon>mdi-close</v-icon>
          </v-btn>
        </v-img>
        <v-select
          :items="['M1M2', 'M1M3', 'M2M3']"
          label=""
          solo
          hideDetails
          class="select-menu"
          @update:modelValue="updateSelection(index, $event)"
        ></v-select>
      </div>
    </div>
  </v-row>
</template>

<script setup lang="ts">
import { ref, computed } from "vue";
import { storeToRefs } from "pinia";
import { useDeckStore } from '@/store/deckStore';

const deckStore = useDeckStore();
const { deck, generatedList } = storeToRefs(deckStore);

const showRemove = ref<number | null>(null);
const selectedIndexes = ref<number[]>([]);
const resetOkCount = ref(0);
const resetTotalCount = ref(0);

const displayedList = computed(() => {
  return generatedList.value.slice(0, 5);
});

const selectedCount = computed(() => {
  return selectedIndexes.value.length;
});

const isSelected = (index: number) => {
  return selectedIndexes.value.includes(index);
};

const toggleSelection = (index: number) => {
  const selectedIndex = selectedIndexes.value.indexOf(index);
  if (selectedIndex > -1) {
    selectedIndexes.value.splice(selectedIndex, 1);
  } else if (selectedIndexes.value.length < 2) {
    selectedIndexes.value.push(index);
  }
};

const removeFromDeck = (index: number) => {
  deckStore.removeFromDeck(index);
  if (index === 0) {
    showRemove.value = null;
  }
};

const updateSelection = (index: number, value: string | null) => {
  deckStore.updateSelection(index, value || '');
};

const nextTurn = () => {
  selectedIndexes.value.sort((a, b) => b - a);
  selectedIndexes.value.forEach(index => {
    deckStore.removeFromGeneratedList(index);
  });
  selectedIndexes.value = [];
};

const resetDeck = (isOk: boolean) => {
  deckStore.resetDeck();
  selectedIndexes.value = [];
  resetTotalCount.value++;
  if (isOk) {
    resetOkCount.value++;
  }
};

const getAttr = (text: string, character: any) => {
  const attrKey = text.startsWith('M1') ? 'magic1atr' : text.startsWith('M2') ? 'magic2atr' : 'magic3atr';
  return character[attrKey];
};
</script>
<style scoped>
.deck {
  display: flex;
  justify-content: center;
  flex-wrap: wrap;
  gap: 10px;
  margin: 30px auto 10px;
  width: 100%;
  max-width: 800px;
  flex-direction: row;
}
.simulator {
  display: flex;
  justify-content: center;
  flex-wrap: wrap;
  gap: 10px;
  margin: 10px auto;
  width: 100%;
  max-width: 800px;
  background-color: #cecacf;
  border-radius: 10px;
  padding: 20px;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.5);
}
.next-turn-btn {
  width: 100%;
  margin-top: 20px;
}
.deck-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  flex: 0 0 calc(20% - 8px);
  min-width: calc(20% - 8px);
  max-width: calc(20% - 8px);
}

.character-image {
  width: 100%;
  aspect-ratio: 1;
  cursor: pointer;
}

.remove-btn {
  position: absolute;
  top: 0;
  right: 0;
}

.select-menu {
  width: 100%;
}
.generated-list {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  width: 100%;
  justify-content: center;
}

.generated-item {
  position: relative;
  flex: 0 0 calc(20% - 8px);
  min-width: calc(20% - 8px);
  max-width: calc(20% - 8px);
}

.generated-image {
  width: 100%;
  aspect-ratio: 1;
}

.generated-text {
  position: absolute;
  bottom: 0;
  left: 0;
  transform: none;
  color: rgb(255, 255, 255);
  border-radius: 8px;
  font-weight: bold;
  text-shadow: 1px 1px 2px rgba(0, 0, 0, 0.8);
  white-space: nowrap;
  padding: 2px 4px;
  font-size: clamp(10px, 2vw, 14px);
  margin: 0px;
}
.generated-text[data-attr="火"] {
  background-color: red;
}

.generated-text[data-attr="水"] {
  background-color: blue;
}

.generated-text[data-attr="木"] {
  background-color: green;
}

.generated-text[data-attr="無"] {
  background-color: gray;
}
.selected {
  opacity: 0.2;
}
.reset-stats {
  font-size: 1.2em;
  font-weight: bold;
  margin: 10px 0;
}

.reset-buttons {
  display: flex;
  justify-content: center;
  gap: 10px;
  width: 100%;
  max-width: 800px;
  margin: 0 auto;
  padding: 0 5px;
  flex-wrap: wrap;
}

.reset-buttons .v-btn {
  flex: 1;
  min-width: 0;
}

@media (max-width: 600px) {
  .reset-buttons {
    padding: 0 2px;
    gap: 6px;
  }
}
</style>
