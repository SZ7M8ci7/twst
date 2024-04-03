<template>
  <v-app>
    <v-container>
      <div class="controls-container">
      </div>


      <v-data-table
        :headers="headers"
        :items="visibleCharacters"
        class="elevation-1"
        :items-per-page="-1"
      >
        <!-- level列のカスタムテンプレート定義 -->
        <template v-slot:[`item.level`]="{ item }">
          <v-btn color="primary" @click="onAddClick(item)">追加</v-btn>
        </template>
        <template v-slot:[`item.name`]="{ item }">
          <img :src="item.imgUrl" :alt="item.name" class="character-image" />
        </template>
      </v-data-table>
    </v-container>
  </v-app>
</template>
<script setup lang="ts">
import { computed, onMounted } from 'vue';
import { useCharacterStore } from '@/store/characters';
import { storeToRefs } from 'pinia';
const characterStore = useCharacterStore();
const { characters } = storeToRefs(characterStore);
import { useDeckStore } from '@/store/deckStore';
const deckStore = useDeckStore();
// visibleプロパティがtrueのキャラクターだけを表示
const visibleCharacters = computed(() => characters.value.filter(character => character.visible));

const headers = [
  { title: '追加', value: 'level', sortable: false },
  { title: 'キャラ', value: 'name', sortable: false  },
  { title: 'レア', value: 'rare', sortable: false  },
  { title: 'HP', value: 'hp', sortable: true  },
  { title: 'ATK', value: 'atk', sortable: true  },
  { title: 'その他', value: 'etc', sortable: false  },
];
// onAddClick メソッドの追加
const onAddClick = (item:any) => {
  deckStore.addToDeck(item);
};
onMounted(() => {
  const levelsCache = JSON.parse(localStorage.getItem('characterLevels') || '{}');
  characters.value.forEach(async character => {
    if (levelsCache[character.name]) {
      character.level = levelsCache[character.name];
    }
    const module = await import(`@/assets/img/${character.name}.png`);
    character.imgUrl = module.default;
  });
});
</script>
<style scoped>
.table-top {
  display: flex;
  align-items: center;
  gap: 10px; /* ボタンとの間隔を設定 */
}
.v-data-table :deep(.v-data-table-footer) {
   display: none; /* NOTE: フッタを非表示にする為 */
}
.controls-container {
  display: flex;
  flex-wrap: wrap; /* Allow wrapping as necessary */
  gap: 10px; /* Space between items */
  align-items: center; /* Align items vertically */
}


</style>