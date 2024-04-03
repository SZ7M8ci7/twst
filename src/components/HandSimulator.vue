<template>
  <v-row class="mb-1">
    <v-col cols="12" sm="4" />
    <v-col cols="12" sm="2">
      <v-btn block @click="resetDeck">リセット</v-btn>
    </v-col>
    <v-col cols="12" sm="2">
      <v-btn :disabled="selectedCount !== 2" block color="green" @click="nextTurn">次のターン</v-btn>
    </v-col>
    <v-col cols="12" sm="4" />
  </v-row>

  <v-row class="mb-1">
    <div class="simulator">
      <div v-for="(item, index) in displayedList" :key="index" class="generated-item" @click="toggleSelection(index)">
        <v-img :src="item.imgUrl" class="generated-image" :class="{ 'selected': isSelected(index) }" contain>
          <div class="generated-text" :data-attr="getAttr(item.text, item)">{{ item.text }}</div>
        </v-img>
      </div>
    </div>
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

const updateSelection = (index: number, value: string) => {
  deckStore.updateSelection(index, value);
};

const nextTurn = () => {
  selectedIndexes.value.sort((a, b) => b - a);
  selectedIndexes.value.forEach(index => {
    deckStore.removeFromGeneratedList(index);
  });
  selectedIndexes.value = [];
};

const resetDeck = () => {
  deckStore.resetDeck();
  selectedIndexes.value = [];
};

const getAttr = (text: string, character: any) => {
  const attrKey = text.startsWith('M1') ? 'magic1atr' : text.startsWith('M2') ? 'magic2atr' : 'magic3atr';
  return character[attrKey];
};
</script>
<style scoped>
.deck {
  display: flex;
  justify-content: center; /* アイテムを中央に配置 */
  flex-wrap: wrap; /* 必要に応じてアイテムを折り返し */
  gap: 10px; /* アイテム間の隙間 */
  margin: 10px auto; /* コンテナ自体を中央に配置 */
  width: 100%; /* コンテナの横幅を最大に設定 */
  flex-direction: row; /* アイテムを横に並べる */
}
.simulator {
  display: flex;
  justify-content: center;
  flex-wrap: wrap;
  gap: 10px;
  margin: 10px auto;
  width: 500px;
  flex-direction: row;
  background-color: #cecacf;
  border-radius: 10px;
  padding: 20px;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.5);
}
.deck-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px; /* 画像とプルダウンメニューの間隔 */
}

.character-image {
  width: 80px;
  height: 80px;
  cursor: pointer;
}

.remove-btn {
  position: absolute;
  top: 0;
  right: 0;
}

.select-menu {
  width: 80px; /* プルダウンメニューの幅を画像に合わせる */
}
.generated-list {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-top: 20px;
}

.generated-item {
  position: relative;
}

.generated-image {
  width: 80px;
  height: 80px;
}

.generated-text {
  position: absolute;
  top: 85%;
  left: 20%;
  transform: translate(-50%, -50%);
  color: rgb(255, 255, 255);
  border-radius: 8px;
  font-weight: bold;
  text-shadow: 1px 1px 2px rgba(0, 0, 0, 0.8);
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
</style>
