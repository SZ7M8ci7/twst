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
        <div class="controls-container">
          <div class="level-controls">
            <v-text-field type="number" v-model="bulkLevel" class="level-input" label="Lv" hide-details="auto" :min="0" :max="110"></v-text-field>
            <v-btn @click="applyBulkLevel">{{ $t('search.batchSetting') }}</v-btn>
          </div>
          <v-btn @click="saveLevels" class="save-levels-btn">{{ $t('search.saveLevels') }}</v-btn>
        </div>

        <v-data-table :headers="headers" :items="visibleCharacters" class="elevation-1" :items-per-page="-1">
          <!-- level列のカスタムテンプレート定義 -->
          <template v-slot:[`item.level`]="{ item }">
            <v-text-field type="number" v-model="item.level" class="mt-0 pt-0 level-input" hide-details="auto" dense solo :min="0" :max="110" />
          </template>
          <template v-slot:[`item.required`]="{ item }">
            <v-checkbox v-model="item.required" hide-details></v-checkbox>
          </template>
          <template v-slot:[`item.hasM3`]="{ item }">
            <v-checkbox v-model="item.hasM3" hide-details></v-checkbox>
          </template>
          <template v-slot:[`item.name`]="{ item }">
            <img :src="item.imgUrl" :alt="item.name" class="character-image" />
          </template>
          <template v-slot:[`item.edit`]="{ item }">
            <v-btn @click="openEditModal(item)">Edit</v-btn>
          </template>
        </v-data-table>

        <!-- 編集モーダル -->
        <v-dialog v-model="editModal" max-width="500px">
          <v-card>
            <v-card-text>
              <v-select v-model="selectedCharacter.rare" :items="['R', 'SR', 'SSR']"  label="Rare" hide-details></v-select>
              <v-text-field v-model="selectedCharacter.hp" label="HP" type="number" :min="0" :max="99999" hide-details></v-text-field>
              <v-text-field v-model="selectedCharacter.atk" label="ATK" type="number" :min="0" :max="99999" hide-details></v-text-field>
              <v-select v-model="selectedCharacter.duo" :items=buddyCharacter  label="デュオ" hide-details></v-select>
              <v-select v-model="selectedCharacter.buddy1c" :items=buddyCharacter  label="バディ1相手" hide-details></v-select>
              <v-select v-model="selectedCharacter.buddy1s" :items=buddyStatus  label="バディ1" hide-details></v-select>
              <v-select v-model="selectedCharacter.buddy2c" :items=buddyCharacter  label="バディ2相手" hide-details></v-select>
              <v-select v-model="selectedCharacter.buddy2s" :items=buddyStatus  label="バディ2" hide-details></v-select>
              <v-select v-model="selectedCharacter.buddy3c" :items=buddyCharacter  label="バディ3相手" hide-details></v-select>
              <v-select v-model="selectedCharacter.buddy3s" :items=buddyStatus  label="バディ3" hide-details></v-select>
              <v-select v-model="selectedCharacter.magic1atr" :items=attr  label="M1属性" hide-details></v-select>
              <v-select v-model="selectedCharacter.magic1pow" :items=pow  label="M1威力" hide-details></v-select>
              <v-select v-model="selectedCharacter.magic1buf" :items=buff  label="M1バフ" hide-details></v-select>
              <v-select v-model="selectedCharacter.magic1heal" :items=heal  label="M1回復" hide-details></v-select>
              <v-select v-model="selectedCharacter.magic2atr" :items=attr  label="M2属性" hide-details></v-select>
              <v-select v-model="selectedCharacter.magic2pow" :items=pow  label="M2威力" hide-details></v-select>
              <v-select v-model="selectedCharacter.magic2buf" :items=buff  label="M2バフ" hide-details></v-select>
              <v-select v-model="selectedCharacter.magic2heal" :items=heal  label="M2回復" hide-details></v-select>
              <v-select v-model="selectedCharacter.magic3atr" :items=attr  label="M3属性" hide-details></v-select>
              <v-select v-model="selectedCharacter.magic3pow" :items=pow  label="M3威力" hide-details></v-select>
              <v-select v-model="selectedCharacter.magic3buf" :items=buff  label="M3バフ" hide-details></v-select>
              <v-select v-model="selectedCharacter.magic3heal" :items=heal  label="M3回復" hide-details></v-select>
            </v-card-text>
            <v-card-actions>
              <v-spacer></v-spacer>
              <v-btn color="blue darken-1" @click="closeEditModal">Cancel</v-btn>
              <v-btn color="blue darken-1" @click="saveCharacter">Save</v-btn>
            </v-card-actions>
          </v-card>
        </v-dialog>
      </div>
    </v-container>
  </v-app>
</template>

<script setup lang="ts">
import { computed, ref, onBeforeMount, onMounted } from 'vue';
import { useCharacterStore } from '@/store/characters';
import { storeToRefs } from 'pinia';
import { useI18n } from 'vue-i18n';

const { t } = useI18n();
const characterStore = useCharacterStore();
const { characters } = storeToRefs(characterStore);
const bulkLevel = ref(110);
const loadingImgUrl = ref(true);
const editModal = ref(false);
const selectedCharacter = ref();
const buddyCharacter = ['リドル', 'エース', 'デュース', 'ケイト', 'トレイ', 'レオナ', 'ジャック', 'ラギー', 'アズール', 'ジェイド', 'フロイド', 'カリム', 'ジャミル', 'ヴィル', 'エペル', 'ルーク', 'イデア', 'オルト', 'マレウス', 'シルバー', 'セベク', 'リリア', 'グリム', 'ロロ', 'クロウリー'];
const buddyStatus = ['HPUP(小)','HPUP(中)','ATKUP(小)','ATKUP(中)','HP&ATKUP(小)','HP&ATKUP(中)'];
const attr = ['木','水','火','無'];
const buff = [
   'ATKUP(極大)','ATKUP(大)', 'ATKUP(中)', 'ATKUP(小)', 'ATKUP(極小)',
  'ダメUP(極大)','ダメUP(大)', 'ダメUP(中)', 'ダメUP(小)', 'ダメUP(極小)',
  '属性ダメUP(極大)', '属性ダメUP(大)', '属性ダメUP(中)', '属性ダメUP(小)', '属性ダメUP(極小)',
];
const heal = ['回復&継続回復(中)','回復&継続回復(小)', '回復(中)', '回復(小)', '回復(極小)', '継続回復(中)', '継続回復(小)'];
const pow = ['単発(弱)', '単発(強)','連撃(弱)', '連撃(強)'];

const visibleCharacters = computed(() => {
  if (loadingImgUrl.value) {
    return []; // 画像URLの読み込み中は空の配列を返す
  }
  return characters.value.filter(character => character.visible && character.imgUrl);
});

const headers = computed(() => [
  { title: 'Lv', value: 'level', sortable: false },
  { title: t('search.required'), value: 'required', sortable: false },
  { title: 'M3', value: 'hasM3', sortable: false },
  { title: t('search.character'), value: 'name', sortable: false },
  { title: t('search.rarity'), value: 'rare', sortable: false },
  { title: 'HP', value: 'hp', sortable: true },
  { title: 'ATK', value: 'atk', sortable: true },
  { title: t('search.other'), value: 'etc', sortable: false },
  { title: 'edit', value: 'edit', sortable: false },
]);

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
        maxLevel = 70;
    }

    // bulkLevelの値と最大レベルの小さい方をキャラクターのレベルに設定
    character.level = Math.max(Math.min(bulkLevel.value, maxLevel), 0);
  });
}

function saveLevels() {
  const levelsCache: { [name: string]: number } = {};
  const hasM3Cache: { [name: string]: boolean } = {};
  characters.value.forEach(character => {
    levelsCache[character.name] = character.level;
    hasM3Cache[character.name] = character.hasM3;
  });
  localStorage.setItem('characterLevels', JSON.stringify(levelsCache));
  localStorage.setItem('characterM3', JSON.stringify(hasM3Cache));
}

function loadLevels() {
  const levelsCache = localStorage.getItem('characterLevels');
  const hasM3Cache = localStorage.getItem('characterM3');
  if (levelsCache) {
    const levels = JSON.parse(levelsCache);
    characters.value.forEach(character => {
      if (levels[character.name]) {
        character.level = levels[character.name];
      }
    });
  }
  if (hasM3Cache) {
    const hasM3 = JSON.parse(hasM3Cache);
    characters.value.forEach(character => {
      if (hasM3[character.name] !== undefined) {
        character.hasM3 = hasM3[character.name];
      }
    });
  }
}

function openEditModal(character: any) {
  selectedCharacter.value = { ...character };
  editModal.value = true;
}

function closeEditModal() {
  editModal.value = false;
}

function saveCharacter() {
  const index = characters.value.findIndex(c => c.name === selectedCharacter.value.name);
  if (index !== -1) {
    characters.value[index] = { ...selectedCharacter.value };
  }
  closeEditModal();
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
  characters.value.forEach(character => {
    character.hasM3 = true; // M3をデフォルトでチェック
  });
  loadLevels(); // 画面を開いた時にlocalStorageからレベルを復元
});
</script>

<style scoped>
.table-top {
  display: flex;
  align-items: center;
  gap: 10px;
}
.level-input {
  max-width: 80px;
  min-width: 70px;
}
.v-data-table :deep(.v-data-table-footer) {
   display: none; /* NOTE: フッタを非表示にする為 */
}
.right-align {
  margin-left: auto;
}
.controls-container {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  align-items: center; /* Align items vertically */
}

.level-controls {
  display: flex;
  align-items: center;
  gap: 10px;
}
.save-levels-btn {
  margin-left: auto; 
}
@media (max-width: 600px) {
  .controls-container {
    flex-direction: column;
    align-items: center;
  }

  .save-levels-btn {
    width: 100%;
  }
}
</style>
