<template>
  <v-app>
    <v-container>
      <!-- ロード中に表示するロードスクリーン -->
      <div v-if="loadingImgUrl" class="text-center">
        <v-progress-circular indeterminate></v-progress-circular>
        <p>キャラクター情報を読み込んでいます...</p>
      </div>

      <!-- ロード完了後に表示するメインコンテンツ -->
      <div v-else>
        <div class="controls-container">
          <div class="level-controls">
            <v-text-field type="number" v-model="bulkLevel" class="level-input" label="Lv" hide-details="auto" :min="0"
              :max="110"></v-text-field>
            <v-btn @click="applyBulkLevel">表示キャラレベル一括設定</v-btn>
          </div>
          <v-btn @click="saveLevels" class="save-levels-btn">レベルをキャッシュに保存</v-btn>
        </div>

        <v-data-table :headers="headers" :items="visibleCharacters" class="elevation-1" :items-per-page="-1">
          <!-- level列のカスタムテンプレート定義 -->
          <template v-slot:[`item.level`]="{ item }">
            <v-text-field type="number" v-model="item.level" class="mt-0 pt-0 level-input" hide-details="auto" dense
              solo :min="0" :max="110" />
          </template>
          <template v-slot:[`item.required`]="{ item }">
            <v-checkbox v-model="item.required" hide-details></v-checkbox>
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
import { computed, ref, onBeforeMount, onMounted } from 'vue';
import { useCharacterStore } from '@/store/characters';
import { storeToRefs } from 'pinia';
const characterStore = useCharacterStore();
const { characters } = storeToRefs(characterStore);
const bulkLevel = ref(110);
const loadingImgUrl = ref(true);
const visibleCharacters = computed(() => {
  if (loadingImgUrl.value) {
    return []; // 画像URLの読み込み中は空の配列を返す
  }
  return characters.value.filter(character => character.visible && character.imgUrl);
});
const headers = [
  { title: 'Lv', value: 'level', sortable: false },
  { title: '必須', value: 'required', sortable: false  },
  { title: 'キャラ', value: 'name', sortable: false  },
  { title: 'レア', value: 'rare', sortable: false  },
  { title: 'HP', value: 'hp', sortable: true  },
  { title: 'ATK', value: 'atk', sortable: true  },
  { title: 'その他', value: 'etc', sortable: false  },
];
function applyBulkLevel() {
  visibleCharacters.value.forEach(character => {
    let maxLevel;

    switch (character.rare) {
      case 'SSR':
        maxLevel = 110;
        break;
      case 'SR':
        maxLevel = 90;
        break;
      case 'R':
        maxLevel = 70;
        break;
      default:
        maxLevel = 70; // デフォルトの最大レベル、またはその他のレアリティの場合
    }

    // bulkLevelの値と最大レベルの小さい方をキャラクターのレベルに設定
    character.level = Math.max(Math.min(bulkLevel.value, maxLevel), 0);
  });
}
function saveLevels() {
  const levelsCache:{ [name: string]: number } = {};
  characters.value.forEach(character => {
    levelsCache[character.name] = character.level;
  });
  localStorage.setItem('characterLevels', JSON.stringify(levelsCache));
}

function loadLevels() {
  const levelsCache = localStorage.getItem('characterLevels');
  if (levelsCache) {
    const levels = JSON.parse(levelsCache);
    characters.value.forEach(character => {
      if (levels[character.name]) {
        character.level = levels[character.name];
      }
    });
  }
}
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
onMounted(() => {
  loadLevels(); // 画面を開いた時にlocalStorageからレベルを復元
});
</script>
<style scoped>
.table-top {
  display: flex;
  align-items: center;
  gap: 10px; /* ボタンとの間隔を設定 */
}
.level-input {
  max-width: 80px; /* 最大横幅を80pxに設定 */
  min-width: 70px;
}
.v-data-table :deep(.v-data-table-footer) {
   display: none; /* NOTE: フッタを非表示にする為 */
}
.right-align {
  margin-left: auto; /* 左側の余白を自動で最大にして右寄せにする */
}
.controls-container {
  display: flex;
  flex-wrap: wrap; /* Allow wrapping as necessary */
  gap: 10px; /* Space between items */
  align-items: center; /* Align items vertically */
}

.level-controls {
  display: flex;
  align-items: center;
  gap: 10px; /* Space between text field and button */
}
.save-levels-btn {
  margin-left: auto; 
}
@media (max-width: 600px) {
  .controls-container {
    flex-direction: column; /* Stack items vertically on narrow screens */
    align-items: center; /* Align items to the start */
  }

  .save-levels-btn {
    width: 100%;
  }
}


</style>