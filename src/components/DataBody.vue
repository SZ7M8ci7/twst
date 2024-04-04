<template>
  <!-- ロード中に表示するロードスクリーン -->
  <div v-if="loadingImgUrl" class="text-center">
    <v-progress-circular indeterminate></v-progress-circular>
    <p>キャラクター情報を読み込んでいます...</p>
  </div>

  <!-- ロード完了後に表示するメインコンテンツ -->
  <div v-else>
    <v-container class="container">
      <v-text-field v-model="search" label="Search" prepend-inner-icon="mdi-magnify" variant="outlined" hide-details
        single-line style="max-height: 60px"></v-text-field>
      <v-card style="overflow-x: auto;">
        <v-data-table :headers="headers" :items="visibleCharacters" class="elevation-1" :items-per-page="-1"
          :search="search" style="max-height: calc(100vh - 250px); overflow-y: auto;" :hide-default-footer="true"
          fixed-header :mobile-breakpoint="0">
          <!-- level列のカスタムテンプレート定義 -->
          <template v-slot:[`item.type`]="{ item }">
            <div class="text-no-wrap">{{ item.growtype.slice(-3) }}</div>
          </template>
          <template v-slot:[`item.buddy1s`]="{ item }">
            <div class="text-no-wrap">{{ formatBuddy(item.buddy1s) }}</div>
          </template>
          <template v-slot:[`item.buddy2s`]="{ item }">
            <div class="text-no-wrap">{{ formatBuddy(item.buddy2s) }}</div>
          </template>
          <template v-slot:[`item.buddy3s`]="{ item }">
            <div class="text-no-wrap">{{ formatBuddy(item.buddy3s) }}</div>
          </template>
          <template v-slot:[`item.name`]="{ item }">
            <img :src="item.imgUrl" :alt="item.name" class="character-image" />
          </template>
        </v-data-table>
      </v-card>
    </v-container>

  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeMount, ref } from 'vue';
import { useCharacterStore } from '@/store/characters';
import { storeToRefs } from 'pinia';
const characterStore = useCharacterStore();
const { characters } = storeToRefs(characterStore);
const loadingImgUrl = ref(true);
// visibleプロパティがtrueのキャラクターだけを表示
const visibleCharacters = computed(() => {
  if (loadingImgUrl.value) {
    return []; // 画像URLの読み込み中は空の配列を返す
  }
  return characters.value.filter(character => character.visible && character.imgUrl);
});
const search = ref('');
const headers = [
  { title: 'キャラ', value: 'name', sortable: false  },
  { title: '名前', value: 'chara', sortable: true  },
  { title: '衣装', value: 'costume', sortable: true  },
  { title: 'レア', value: 'rare', sortable: true  },
  { title: 'タイプ', value: 'type', sortable: true },
  { title: '非公式タイプ', value: 'growtype', sortable: true  },
  { title: 'HP', value: 'hp', sortable: true  },
  { title: 'ATK', value: 'atk', sortable: true  },
  { title: 'デュオ', value: 'duo', sortable: true  },
  { title: 'M1', value: 'magic1atr', sortable: true  },
  { title: 'M1種', value: 'magic1pow', sortable: true  },
  { title: 'M1バフ', value: 'magic1buf', sortable: true  },
  { title: 'M1回復', value: 'magic1heal', sortable: true  },
  { title: 'M2', value: 'magic2atr', sortable: true  },
  { title: 'M2種', value: 'magic2pow', sortable: true  },
  { title: 'M2バフ', value: 'magic2buf', sortable: true  },
  { title: 'M2回復', value: 'magic2heal', sortable: true  },
  { title: 'M3', value: 'magic3atr', sortable: true  },
  { title: 'M3種', value: 'magic3pow', sortable: true  },
  { title: 'M3バフ', value: 'magic3buf', sortable: true  },
  { title: 'M3回復', value: 'magic3heal', sortable: true  },
  { title: 'バディ1', value: 'buddy1c', sortable: true  },
  { title: 'バディ1', value: 'buddy1s', sortable: true  },
  { title: 'バディ2', value: 'buddy2c', sortable: true  },
  { title: 'バディ2', value: 'buddy2s', sortable: true  },
  { title: 'バディ3', value: 'buddy3c', sortable: true  },
  { title: 'バディ3', value: 'buddy3s', sortable: true  },
  { title: 'その他', value: 'etc', sortable: false  },
];


// Method to replace "UP" with an empty string for display purposes
const formatBuddy = (value: string) => {
  return value.replace(/UP/g, '');
};

onBeforeMount(() => {
  const promises = characters.value.map(character => {
    return import(`@/assets/img/${character.name}.png`)
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
  gap: 10px;
}

.controls-container {
  display: flex;
  flex-wrap: wrap; /* Allow wrapping as necessary */
  gap: 10px; /* Space between items */
  align-items: center; /* Align items vertically */
}
.container {
  height: 100vh;
  padding: 0;
  margin: 0;
}
.v-data-table ::v-deep tbody tr td {
  white-space: nowrap;
  border-left: 1px solid #ddd;
  border-right: 1px solid #ddd;
}
.v-data-table ::v-deep thead th {
  white-space: nowrap;
  border-left: 1px solid #ddd;
  border-right: 1px solid #ddd;
}
.v-data-table :deep(.v-data-table-footer) {
   display: none; /* NOTE: フッタを非表示にする為 */
}
</style>