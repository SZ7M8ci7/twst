<template>
  <v-app>
    <v-container>
      <span class="table-top">
        <v-text-field
          type="number"
          v-model="bulkLevel"
          class="mb-4 level-input"
          label="Lv"
          hide-details="auto"
          :min="0"
          :max="110"
        />
        <v-btn @click="applyBulkLevel">表示キャラレベル一括設定</v-btn>
        <div class="right-align">
          <v-btn @click="saveLevels">レベルをキャッシュに保存</v-btn>
        </div>
      </span>
      <v-data-table
        :headers="headers"
        :items="visibleCharacters"
        class="elevation-1"
        :items-per-page="-1"
      >
        <!-- level列のカスタムテンプレート定義 -->
        <template v-slot:[`item.level`]="{ item }">
          <v-text-field
            type="number"
            v-model="item.level"
            class="mt-0 pt-0 level-input"
            hide-details="auto"
            dense
            solo
            :min="0"
            :max="110"
          />
        </template>
        <template v-slot:[`item.required`]="{ item }">
          <v-checkbox v-model="item.required" hide-details></v-checkbox>
        </template>
        <template v-slot:[`item.name`]="{ item }">
          <img :src="item.imgUrl" :alt="item.name" class="character-image" />
        </template>

      </v-data-table>
    </v-container>
  </v-app>
</template>
<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useCharacterStore } from '@/store/characters';
import { storeToRefs } from 'pinia';
const characterStore = useCharacterStore();
const { characters } = storeToRefs(characterStore);
const bulkLevel = ref(110);
// visibleプロパティがtrueのキャラクターだけを表示
const visibleCharacters = computed(() => characters.value.filter(character => character.visible));

const headers = [
  { title: 'Lv', value: 'level', sortable: false },
  // { title: '必須', value: 'required', sortable: false  },
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
</style>