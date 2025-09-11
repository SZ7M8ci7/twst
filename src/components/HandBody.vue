<template>
  <v-app>
    <v-container>

      <!-- ロード中に表示するロードスクリーン -->
      <div v-if="loadingImgUrl" class="text-center">
        <v-progress-circular indeterminate></v-progress-circular>
        <p>Loading...</p>
      </div>

      <!-- ロード完了後に表示するメインコンテンツ -->
      <div v-else>

        <v-data-table :headers="headers" :items="visibleCharacters" class="elevation-1" :items-per-page="-1">
          <!-- level列のカスタムテンプレート定義 -->
          <template v-slot:[`item.level`]="{ item }">
            <v-btn color="primary" @click="onAddClick(item)">{{ $t('hand.add') }}</v-btn>
          </template>
          <template v-slot:[`item.name`]="{ item }">
            <img :src="item.imgUrl" :alt="item.name" class="character-image" />
          </template>
        </v-data-table>

      </div>
    </v-container>

  </v-app>
</template>
<script setup lang="ts">
import { computed, onBeforeMount, ref } from 'vue';
import { useCharacterStore } from '@/store/characters';
import { storeToRefs } from 'pinia';
import { useI18n } from 'vue-i18n';
import { applyDefaultSort } from '@/utils/sortUtils';
const { t } = useI18n();
const characterStore = useCharacterStore();
const { characters } = storeToRefs(characterStore);
import { useDeckStore } from '@/store/deckStore';
const deckStore = useDeckStore();
const loadingImgUrl = ref(true);
const visibleCharacters = computed(() => {
  if (loadingImgUrl.value) {
    return []; // 画像URLの読み込み中は空の配列を返す
  }
  const filteredCharacters = characters.value.filter(character => character.visible && character.imgUrl);
  return applyDefaultSort(filteredCharacters);
});
const headers = computed(() =>[
  { title: t('hand.add'), value: 'level', sortable: false },
  { title: t('hand.character'), value: 'name', sortable: false  },
  { title: t('hand.rarity'), value: 'rare', sortable: false  },
  { title: 'HP', value: 'hp', sortable: true  },
  { title: 'ATK', value: 'atk', sortable: true  },
  { title: t('hand.other'), value: 'etc', sortable: false  },
]);
// onAddClick メソッドの追加
const onAddClick = (item:any) => {
  deckStore.addToDeck(item);
};
onBeforeMount(() => {
  const promises = characters.value.map(character => {
    return import(`@/assets/img/${character.name}.webp`)
      .then(module => {
        character.imgUrl = module.default;
      })
      .catch(() => {
        character.imgUrl = ''; // 画像の読み込みに失敗した場合
      });
  });

  Promise.all(promises).then(() => {
    loadingImgUrl.value = false; // すべての画像のロードが完了
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

.character-image {
  width: 40px;
  height: 40px;
  border-radius: 4px;
  object-fit: cover;
}


</style>