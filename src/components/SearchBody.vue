<template>
  <v-app>
    <v-container>
      <div class="controls-container">
        <div class="level-controls">
          <v-text-field type="number" v-model="bulkLevel" class="level-input" label="Lv" hide-details="auto" :min="0" :max="110"></v-text-field>
          <v-btn @click="applyBulkLevel">{{ $t('search.batchSetting') }}</v-btn>
          <v-btn color="primary" @click="openDataModal">{{ $t('search.dataManagement') }}</v-btn>
        </div>
        <v-btn @click="saveLevels" class="save-levels-btn">{{ $t('search.saveLevels') }}</v-btn>
      </div>
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
            <v-text-field type="number" v-model="item.level" class="mt-0 pt-0 level-input" hide-details="auto" dense solo :min="0" :max="110" />
          </template>
          <template v-slot:[`item.required`]="{ item }">
            <v-checkbox v-model="item.required" hide-details></v-checkbox>
          </template>
          <template v-slot:[`item.hasM3`]="{ item }">
            <v-checkbox v-model="item.hasM3" hide-details v-if="item.rare === 'SSR'"></v-checkbox>
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
              <v-text-field v-model.number="selectedCharacter.hp" label="HP" type="number" :min="0" :max="99999" hide-details></v-text-field>
              <v-text-field v-model.number="selectedCharacter.atk" label="ATK" type="number" :min="0" :max="99999" hide-details></v-text-field>
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

        <!-- エクスポート/インポートモーダル -->
        <v-dialog v-model="dataModal" max-width="800px">
          <v-card>
            <v-card-title>{{ $t('search.dataManagement') }}</v-card-title>
            <v-card-text>
              <div class="data-actions mb-4">
                <v-btn color="primary" @click="copyToClipboard" class="action-btn">
                  <v-icon>mdi-content-copy</v-icon>
                  <span class="ml-2">{{ $t('search.copy') }}</span>
                </v-btn>
                <v-btn color="primary" @click="importFromText" class="action-btn">
                  <v-icon>mdi-database-import</v-icon>
                  <span class="ml-2">{{ $t('search.import') }}</span>
                </v-btn>
                <v-btn color="success" @click="applyHandCollection" class="action-btn">
                  <v-icon>mdi-account-convert</v-icon>
                  <span class="ml-2">{{ $t('search.applyHandCollection') }}</span>
                </v-btn>
                <v-btn color="grey" @click="closeDataModal" class="action-btn">
                  <v-icon>mdi-close</v-icon>
                  <span class="ml-2">{{ $t('search.close') }}</span>
                </v-btn>
              </div>
              <v-textarea
                v-model="dataText"
                outlined
                auto-grow
                rows="10"
                class="mt-4"
              ></v-textarea>
            </v-card-text>
          </v-card>
        </v-dialog>
        <v-snackbar
          v-model="snackbar.show"
          :color="snackbar.color"
          :timeout="3000"
        >
          {{ snackbar.text }}
        </v-snackbar>
      </div>
    </v-container>
  </v-app>
</template>

<script setup lang="ts">
import { computed, ref, onBeforeMount, onMounted } from 'vue';
import { useCharacterStore } from '@/store/characters';
import { useHandCollectionStore } from '@/store/handCollection';
import { storeToRefs } from 'pinia';
import { useI18n } from 'vue-i18n';
import { applyDefaultSort } from '@/utils/sortUtils';

const { t } = useI18n();
const characterStore = useCharacterStore();
const handCollectionStore = useHandCollectionStore();
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
const dataModal = ref(false);
const dataText = ref('');
const snackbar = ref({
  show: false,
  text: '',
  color: 'success'
});

const visibleCharacters = computed(() => {
  if (loadingImgUrl.value) {
    return []; // 画像URLの読み込み中は空の配列を返す
  }
  const filteredCharacters = characters.value.filter(character => character.visible && character.imgUrl);
  return applyDefaultSort(filteredCharacters);
});

const headers = computed(() => [
  { title: 'Lv', value: 'level', sortable: true },
  { title: t('search.required'), value: 'required', sortable: true },
  { title: 'M3', value: 'hasM3', sortable: true, show: (item: any) => item.rare === 'SSR' },
  { title: t('search.character'), value: 'name', sortable: false },
  { title: t('search.rarity'), value: 'rare', sortable: true },
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
  } else {
    console.error('character not found');
  }
  closeEditModal();
}

function openDataModal() {
  dataModal.value = true;
  dataText.value = characters.value
    .map(char => `${char.chara}\t${char.costume}\t${char.level}\t${char.required}\t${char.hasM3}`)
    .join('\n');
}

function closeDataModal() {
  dataModal.value = false;
  dataText.value = '';
}

function showSnackbar(text: string, color: 'success' | 'error' = 'success') {
  snackbar.value.text = text;
  snackbar.value.color = color;
  snackbar.value.show = true;
}

function copyToClipboard() {
  navigator.clipboard.writeText(dataText.value)
    .then(() => {
      showSnackbar(t('search.copySuccess'));
    })
    .catch(err => {
      console.error('クリップボードへのコピーに失敗しました:', err);
      showSnackbar(t('search.copyError'), 'error');
    });
}

function importFromText() {
  try {
    const lines = dataText.value.split('\n').filter(line => line.trim());
    let importedCount = 0;
    lines.forEach(line => {
      const [chara, costume, level, required, hasM3] = line.split('\t');
      const character = characters.value.find(
        char => char.chara === chara && char.costume === costume
      );
      if (character) {
        character.level = parseInt(level) || 0;
        character.required = required.toLowerCase() === 'true';
        character.hasM3 = hasM3.toLowerCase() === 'true';
        importedCount++;
      }
    });
    saveLevels();
    closeDataModal();
    showSnackbar(t('search.importSuccess', { count: importedCount }));
  } catch (error) {
    console.error('インポートエラー:', error);
    showSnackbar(t('search.importError'), 'error');
  }
}

function applyHandCollection() {
  try {
    let appliedCount = 0;
    
    characters.value.forEach(character => {
      // 手持ち設定から対応するカードを取得
      const handCard = handCollectionStore.getHandCard(character.name);
      
      if (handCard.isOwned) {
        // 所持している場合、手持ち設定の内容を反映
        character.level = handCard.level;
        character.required = false;
        character.hasM3 = handCard.isM3;
        appliedCount++;
      } else {
        // 所持していない場合、デフォルト設定
        character.level = 0;
        character.required = false;
        character.hasM3 = false;
      }
    });
    
    saveLevels();
    closeDataModal();
    showSnackbar(t('search.applyHandCollectionSuccess', { count: appliedCount }));
  } catch (error) {
    console.error('手持ち設定反映エラー:', error);
    showSnackbar(t('search.applyHandCollectionError'), 'error');
  }
}

onBeforeMount(() => {
  const promises = characters.value.map(character => {
    return import(`@/assets/img/${character.name}.webp`)
      .then(module => {
        character.imgUrl = module.default;
      })
      .catch(async () => {
        const module = await import(`@/assets/img/notyet.webp`);
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
.character-image {
  width: 40px;
  height: 40px;
  border-radius: 4px;
  object-fit: cover;
}

.controls-container {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  align-items: center;
}

.level-controls {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.save-levels-btn {
  margin-left: auto;
}

@media (max-width: 600px) {
  .controls-container {
    flex-direction: column;
    align-items: center;
  }

  .level-controls {
    width: 100%;
    justify-content: center;
  }

  .save-levels-btn {
    width: 100%;
  }
}

.level-input {
  max-width: 80px !important;
  min-width: 80px !important;
}

.v-data-table :deep(.v-field__input) {
  padding-top: 4px !important;
  padding-bottom: 4px !important;
}

.v-data-table :deep(.v-text-field) {
  width: 80px !important;
}

.data-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.action-btn {
  flex: 1;
  min-width: 120px;
  max-width: 200px;
}

@media (max-width: 600px) {
  .action-btn {
    flex: 1 1 100%;
    max-width: none;
  }
}
</style>
