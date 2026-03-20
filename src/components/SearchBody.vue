<template>
  <v-app>
    <v-container class="search-body-container">
      <div class="controls-container">
        <div class="level-controls">
          <v-text-field type="number" v-model="bulkLevel" class="level-input" label="Lv" hide-details="auto" :min="0" :max="getMaxLevel('SSR')"></v-text-field>
          <v-btn @click="applyBulkLevel">{{ $t('search.batchSetting') }}</v-btn>
          <div class="bulk-select-group">
            <label class="bulk-select-label">{{ $t('search.totsu') }}</label>
            <select v-model.number="bulkTotsu" class="bulk-select">
              <option v-for="option in totsuOptions" :key="option.value" :value="option.value">{{ option.title }}</option>
            </select>
          </div>
          <v-btn @click="applyBulkTotsu">{{ $t('search.totsuSetting') }}</v-btn>
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
        <!-- 表示件数が多いので仮想スクロールを使う -->
        <v-data-table-virtual
          ref="characterTable"
          :headers="headers"
          :items="visibleCharacters"
          :row-props="getRowProps"
          item-value="id"
          item-height="52"
          height="70vh"
          class="elevation-1"
        >
          <!-- level列のカスタムテンプレート定義 -->
          <template v-slot:[`item.level`]="{ item }">
            <v-text-field type="number" v-model="item.level" class="mt-0 pt-0 level-input" hide-details="auto" dense solo :min="0" :max="getMaxLevel(item.rare)" />
          </template>
          <template v-slot:[`item.totsu`]="{ item }">
            <select
              class="table-select"
              :value="item.rare === 'SSR' ? (item.totsu ?? 0) : 0"
              :disabled="item.rare !== 'SSR'"
              @input="handleTableTotsuChange(item, $event)"
              @change="handleTableTotsuChange(item, $event)"
            >
              <option v-for="option in totsuOptions" :key="option.value" :value="option.value">{{ option.title }}</option>
            </select>
          </template>
          <template v-slot:[`item.required`]="{ item }">
            <v-checkbox v-model="item.required" hide-details></v-checkbox>
          </template>
          <!-- M1/M2/M3の使用可否はここで制御し、最低2つONを維持する -->
          <template v-slot:[`item.hasM1`]="{ item }">
            <v-checkbox
              :model-value="item.hasM1"
              hide-details
              @update:modelValue="(val) => handleMagicToggle(item, 'hasM1', val)"
            ></v-checkbox>
          </template>
          <template v-slot:[`item.hasM2`]="{ item }">
            <v-checkbox
              :model-value="item.hasM2"
              hide-details
              @update:modelValue="(val) => handleMagicToggle(item, 'hasM2', val)"
            ></v-checkbox>
          </template>
          <template v-slot:[`item.hasM3`]="{ item }">
            <!-- SR以下はM3自体が存在しないため、チェック欄を表示しない -->
            <v-checkbox
              v-if="item.rare === 'SSR'"
              :model-value="item.hasM3"
              :disabled="(item.totsu ?? 0) < 3"
              hide-details
              @update:modelValue="(val) => handleMagicToggle(item, 'hasM3', val)"
            ></v-checkbox>
          </template>
          <template v-slot:[`item.name`]="{ item }">
            <img :src="item.imgUrl" :alt="item.name" class="character-image" />
          </template>
          <template v-slot:[`item.edit`]="{ item }">
            <v-btn @click="openEditModal(item)">Edit</v-btn>
          </template>
        </v-data-table-virtual>

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
                :label="$t('search.dataFormat')"
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
import { computed, nextTick, onBeforeMount, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useCharacterStore } from '@/store/characters';
import { useHandCollectionStore } from '@/store/handCollection';
import { useSearchSettingsStore } from '@/store/searchSetting';
import { storeToRefs } from 'pinia';
import { useI18n } from 'vue-i18n';
import { applyDefaultSort } from '@/utils/sortUtils';
import { scrollElementWithinContainerToCenter, waitForLayoutStability } from '@/utils/scrollPosition';
import { useDisplay } from 'vuetify';
import { getInputMaxLevel } from '@/constants/levels';
import { clampTotsuCount, isM3Unlocked } from '@/utils/totsu';
import { SEARCH_PRESET_CONFIGURATIONS } from '@/constants/searchPresets';

type FocusRequest = {
  requestId: number;
  characterName: string;
  targetTab: 'search' | 'support';
};

type MagicUsageKey = 'hasM1' | 'hasM2' | 'hasM3';

const props = defineProps<{
  focusRequest: FocusRequest | null;
}>();

const { t } = useI18n();
const characterStore = useCharacterStore();
const handCollectionStore = useHandCollectionStore();
const searchSettingsStore = useSearchSettingsStore();
const { characters } = storeToRefs(characterStore);
const { appliedPresetName, appliedPresetToken } = storeToRefs(searchSettingsStore);
const { width } = useDisplay();
const bulkLevel = ref(getInputMaxLevel('SSR'));
const bulkTotsu = ref(4);
const totsuOptions = [0, 1, 2, 3, 4].map(value => ({
  title: value.toString(),
  value,
}));
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
// デッキ探索専用：マジックの使用可否(はずす/使う)を保存
const MAGIC_USAGE_STORAGE_KEY = 'characterMagicUsage';
const TOTSU_STORAGE_KEY = 'characterTotsu';

function getMaxLevel(rare: string) {
  return getInputMaxLevel(rare);
}

const visibleCharacters = computed(() => {
  if (loadingImgUrl.value) {
    return []; // 画像URLの読み込み中は空の配列を返す
  }
  const filteredCharacters = characters.value.filter(character => character.visible && character.imgUrl);
  return applyDefaultSort(filteredCharacters);
});

const shouldHideOtherColumn = computed(() => width.value < 960);

const headers = computed(() => {
  const nextHeaders = [
    { title: 'Lv', value: 'level', sortable: true },
    { title: t('search.totsu'), value: 'totsu', sortable: true },
    { title: t('search.required'), value: 'required', sortable: true },
    { title: t('search.useM1'), value: 'hasM1', sortable: false },
    { title: t('search.useM2'), value: 'hasM2', sortable: false },
    { title: t('search.useM3'), value: 'hasM3', sortable: false },
    { title: t('search.character'), value: 'name', sortable: false },
    { title: t('search.rarity'), value: 'rare', sortable: true },
    { title: 'HP', value: 'hp', sortable: true },
    { title: 'ATK', value: 'atk', sortable: true },
    { title: t('search.other'), value: 'etc', sortable: false },
    { title: 'edit', value: 'edit', sortable: false },
  ];

  return shouldHideOtherColumn.value
    ? nextHeaders.filter((header) => header.value !== 'etc')
    : nextHeaders;
});

const characterTable = ref<{ scrollToIndex: (index: number) => void; $el?: Element } | null>(null);
const focusedCharacterName = ref('');
let focusHighlightTimeout: number | null = null;
const FOCUS_HIGHLIGHT_DURATION_MS = 900;

const getCharacterRowId = (name: string) => `search-character-row-${encodeURIComponent(name)}`;

const getCharacterTableWrapper = () => {
  const tableRoot = characterTable.value?.$el;
  if (!(tableRoot instanceof HTMLElement)) return null;
  return tableRoot.querySelector<HTMLElement>('.v-table__wrapper');
};

async function scrollToCharacterRow(targetIndex: number, rowId: string) {
  for (let attempt = 0; attempt < 6; attempt += 1) {
    characterTable.value?.scrollToIndex(targetIndex);
    await nextTick();
    await waitForLayoutStability(3);

    const targetRow = document.getElementById(rowId);
    const tableWrapper = getCharacterTableWrapper();
    if (targetRow instanceof HTMLElement && tableWrapper) {
      scrollElementWithinContainerToCenter(tableWrapper, targetRow);
      return;
    }
  }

  const tableWrapper = getCharacterTableWrapper();
  if (!tableWrapper) return;

  const estimatedRowHeight = 52;
  const fallbackTop = targetIndex * estimatedRowHeight - (tableWrapper.clientHeight - estimatedRowHeight) / 2;
  const maxTop = Math.max(0, tableWrapper.scrollHeight - tableWrapper.clientHeight);

  tableWrapper.scrollTo({
    top: Math.max(0, Math.min(fallbackTop, maxTop)),
    behavior: 'smooth',
  });
}


const getRowProps = ({ item }: { item: { name: string } }) => ({
  id: getCharacterRowId(item.name),
  class: item.name === focusedCharacterName.value ? 'focused-character-row' : undefined,
});

async function focusCharacterSetting(request: FocusRequest | null) {
  if (!request || request.targetTab !== 'search' || loadingImgUrl.value) return;

  const targetCharacter = characters.value.find(character => character.name === request.characterName);
  if (!targetCharacter) return;

  if (!targetCharacter.visible) {
    targetCharacter.visible = true;
    await nextTick();
    await waitForLayoutStability(3);
  }

  const targetIndex = visibleCharacters.value.findIndex(character => character.name === request.characterName);
  if (targetIndex < 0) return;

  focusedCharacterName.value = request.characterName;

  const rowId = getCharacterRowId(request.characterName);
  await nextTick();
  await waitForLayoutStability(3);
  await scrollToCharacterRow(targetIndex, rowId);

  if (focusHighlightTimeout !== null) {
    window.clearTimeout(focusHighlightTimeout);
  }
  focusHighlightTimeout = window.setTimeout(() => {
    focusedCharacterName.value = '';
  }, FOCUS_HIGHLIGHT_DURATION_MS);
}

watch(
  () => props.focusRequest?.requestId,
  () => {
    if (!props.focusRequest || props.focusRequest.targetTab !== 'search' || loadingImgUrl.value) return;
    void focusCharacterSetting(props.focusRequest);
  }
);

watch(loadingImgUrl, (isLoading) => {
  if (!isLoading && props.focusRequest?.targetTab === 'search') {
    void focusCharacterSetting(props.focusRequest);
  }
});

// SSRのM3有無を考慮して選択数を数える
function countSelectedMagics(character: any): number {
  const selectedMagicKeys = getSelectableMagicKeys(character);
  return selectedMagicKeys.filter((key) => Boolean(character[key])).length;
}

function getSelectableMagicKeys(character: any): MagicUsageKey[] {
  const selectableMagicKeys: MagicUsageKey[] = ['hasM1', 'hasM2'];
  if (isM3Unlocked(character.rare, character.totsu ?? 0)) {
    selectableMagicKeys.push('hasM3');
  }
  return selectableMagicKeys;
}

// M1/M2/M3の初期化と「最低2つON」を強制する
function normalizeMagicUsage(character: any, preferredOrder?: MagicUsageKey[]) {
  if (character.hasM1 === undefined) character.hasM1 = true;
  if (character.hasM2 === undefined) character.hasM2 = true;

  if (character.rare !== 'SSR') {
    character.totsu = 0;
    character.hasM3 = false;
  } else {
    character.totsu = clampTotsuCount(character.totsu ?? 4);
    if (!isM3Unlocked(character.rare, character.totsu)) {
      character.hasM3 = false;
    } else if (character.hasM3 === undefined) {
      character.hasM3 = true;
    }
  }

  const selectableMagicKeys = getSelectableMagicKeys(character);
  const normalizedPreferredOrder = preferredOrder?.filter((key, index) =>
    selectableMagicKeys.includes(key) && preferredOrder.indexOf(key) === index
  ) ?? [];
  const fillOrder = [
    ...normalizedPreferredOrder,
    ...selectableMagicKeys.filter((key) => !normalizedPreferredOrder.includes(key))
  ];

  let selectedCount = countSelectedMagics(character);
  while (selectedCount < 2) {
    const nextKey = fillOrder.find((key) => !character[key]);
    if (!nextKey) break;
    character[nextKey] = true;
    selectedCount += 1;
  }
}

function handleMagicToggle(
  character: any,
  key: MagicUsageKey,
  nextValue: boolean | null
) {
  if (key === 'hasM3' && !isM3Unlocked(character.rare, character.totsu ?? 0)) {
    character.hasM3 = false;
  } else {
    character[key] = !!nextValue;
  }

  const preferredOrder = nextValue
    ? undefined
    : [
        ...getSelectableMagicKeys(character).filter((candidateKey) => candidateKey !== key),
        key
      ];
  normalizeMagicUsage(character, preferredOrder);
}

function syncDefenseExamContinueHealMagics(presetName: string) {
  const preset = SEARCH_PRESET_CONFIGURATIONS.find((entry) => entry.name === presetName);
  const disabledAttribute = preset?.deckSearchContinueHealDisabledAttribute;
  if (!disabledAttribute) return;

  characters.value.forEach(character => {
    const magicKeys = [
      { attrKey: 'magic1atr', healKey: 'magic1heal', usageKey: 'hasM1' },
      { attrKey: 'magic2atr', healKey: 'magic2heal', usageKey: 'hasM2' },
      { attrKey: 'magic3atr', healKey: 'magic3heal', usageKey: 'hasM3' },
    ] as const;

    for (const { attrKey, healKey, usageKey } of magicKeys) {
      const isContinueHealMagic = typeof character[healKey] === 'string' && character[healKey].includes('継続回復');
      if (!isContinueHealMagic) continue;
      if (character[attrKey] === disabledAttribute) continue;
      if (usageKey === 'hasM3' && !isM3Unlocked(character.rare, character.totsu ?? 0)) continue;
      character[usageKey] = true;
    }

    for (const { attrKey, healKey, usageKey } of magicKeys) {
      if (!character[usageKey]) continue;
      if (character[attrKey] !== disabledAttribute) continue;
      if (typeof character[healKey] !== 'string' || !character[healKey].includes('継続回復')) continue;
      if (countSelectedMagics(character) <= 2) break;
      character[usageKey] = false;
    }

    normalizeMagicUsage(character);
  });
}

function applyBulkLevel() {
  visibleCharacters.value.forEach(character => {
    const maxLevel = getMaxLevel(character.rare);
    character.level = Math.max(Math.min(bulkLevel.value, maxLevel), 0);
  });
}

function updateTotsu(character: any, value: string | number | null) {
  if (character.rare !== 'SSR') {
    character.totsu = 0;
  } else {
    character.totsu = clampTotsuCount(value);
  }
  normalizeMagicUsage(character);
}

function handleTableTotsuChange(character: any, event: Event) {
  updateTotsu(character, (event.target as HTMLSelectElement)?.value ?? 0);
}

function applyBulkTotsu() {
  visibleCharacters.value.forEach(character => {
    updateTotsu(character, bulkTotsu.value);
  });
}

function saveLevels() {
  const levelsCache: { [name: string]: number } = {};
  const hasM3Cache: { [name: string]: boolean } = {};
  const totsuCache: { [name: string]: number } = {};
  const magicUsageCache: { [name: string]: { hasM1: boolean; hasM2: boolean; hasM3: boolean } } = {};
  // M1/M2/M3の使用可否も保存（TSVの出力形式は従来通り）
  characters.value.forEach(character => {
    levelsCache[character.name] = character.level;
    hasM3Cache[character.name] = character.hasM3;
    totsuCache[character.name] = clampTotsuCount(character.totsu ?? (character.hasM3 ? 3 : 0));
    magicUsageCache[character.name] = {
      hasM1: !!character.hasM1,
      hasM2: !!character.hasM2,
      hasM3: !!character.hasM3
    };
  });
  localStorage.setItem('characterLevels', JSON.stringify(levelsCache));
  localStorage.setItem('characterM3', JSON.stringify(hasM3Cache));
  localStorage.setItem(TOTSU_STORAGE_KEY, JSON.stringify(totsuCache));
  localStorage.setItem(MAGIC_USAGE_STORAGE_KEY, JSON.stringify(magicUsageCache));
}

function loadLevels() {
  const levelsCache = localStorage.getItem('characterLevels');
  const hasM3Cache = localStorage.getItem('characterM3');
  const totsuCache = localStorage.getItem(TOTSU_STORAGE_KEY);
  const magicUsageCache = localStorage.getItem(MAGIC_USAGE_STORAGE_KEY);
  if (levelsCache) {
    const levels = JSON.parse(levelsCache);
    characters.value.forEach(character => {
      if (levels[character.name] !== undefined) {
        character.level = levels[character.name];
      }
    });
  }
  if (totsuCache) {
    const totsu = JSON.parse(totsuCache);
    characters.value.forEach(character => {
      if (totsu[character.name] !== undefined) {
        character.totsu = clampTotsuCount(totsu[character.name]);
      }
    });
  }
  if (hasM3Cache) {
    const hasM3 = JSON.parse(hasM3Cache);
    characters.value.forEach(character => {
      if ((character.totsu ?? 0) === 0 && hasM3[character.name] === true && character.rare === 'SSR') {
        character.totsu = 3;
      }
      if (hasM3[character.name] !== undefined) {
        character.hasM3 = hasM3[character.name];
      }
    });
  }
  if (magicUsageCache) {
    const usage = JSON.parse(magicUsageCache);
    characters.value.forEach(character => {
      if (usage[character.name] !== undefined) {
        const entry = usage[character.name];
        // 旧キー(useM*)にも対応して読み込む
        if ('hasM1' in entry || 'hasM2' in entry || 'hasM3' in entry) {
          character.hasM1 = !!entry.hasM1;
          character.hasM2 = !!entry.hasM2;
          character.hasM3 = !!entry.hasM3;
        } else if ('useM1' in entry || 'useM2' in entry || 'useM3' in entry) {
          character.hasM1 = !!entry.useM1;
          character.hasM2 = !!entry.useM2;
          character.hasM3 = !!entry.useM3;
        }
      }
    });
  }
  // 読み込み後に必ず最低2つON/SSRのみM3可を補正
  characters.value.forEach(character => {
    normalizeMagicUsage(character);
  });
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
    const normalizedCharacter = { ...selectedCharacter.value };
    normalizeMagicUsage(normalizedCharacter);
    characters.value[index] = normalizedCharacter;
  } else {
    console.error('character not found');
  }
  closeEditModal();
}

function openDataModal() {
  dataModal.value = true;
  const cards = characters.value.reduce((result, char) => {
    result[char.name] = {
      chara: char.chara,
      costume: char.costume,
      rare: char.rare,
      level: char.level,
      required: !!char.required,
      totsu: clampTotsuCount(char.totsu ?? (char.hasM3 ? 3 : 0)),
      useM1: !!char.hasM1,
      useM2: !!char.hasM2,
      useM3: !!char.hasM3,
    };
    return result;
  }, {} as Record<string, {
    chara: string;
    costume: string;
    rare: string;
    level: number;
    required: boolean;
    totsu: number;
    useM1: boolean;
    useM2: boolean;
    useM3: boolean;
  }>);

  dataText.value = JSON.stringify({
    format: 'twst-search-settings-v2',
    cards,
  }, null, 2);
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
    let importedCount = 0;
    const trimmed = dataText.value.trim();
    const parsedJson = trimmed ? JSON.parse(trimmed) : null;

    if (parsedJson && typeof parsedJson === 'object') {
      const cards = Array.isArray((parsedJson as any).cards)
        ? (parsedJson as any).cards
        : Object.entries((parsedJson as any).cards || {}).map(([cardName, value]) => ({
            cardName,
            ...(value as Record<string, unknown>),
          }));

      cards.forEach((entry: any) => {
        const character = characters.value.find(char =>
          (entry.cardName && char.name === entry.cardName) ||
          (entry.chara && entry.costume && char.chara === entry.chara && char.costume === entry.costume)
        );
        if (!character) return;

        character.level = Number(entry.level) || 0;
        character.required = Boolean(entry.required);
        character.totsu = character.rare === 'SSR'
          ? clampTotsuCount(entry.totsu ?? ((entry.useM3 ?? entry.hasM3) ? 3 : 0))
          : 0;
        character.hasM1 = entry.useM1 !== undefined ? Boolean(entry.useM1) : true;
        character.hasM2 = entry.useM2 !== undefined ? Boolean(entry.useM2) : true;
        character.hasM3 = entry.useM3 !== undefined
          ? Boolean(entry.useM3)
          : Boolean(entry.hasM3);
        normalizeMagicUsage(character);
        importedCount++;
      });
    }

    if (importedCount === 0) {
      const lines = dataText.value.split('\n').filter(line => line.trim());
      lines.forEach(line => {
        const [chara, costume, level, required, hasM3] = line.split('\t');
        const character = characters.value.find(
          char => char.chara === chara && char.costume === costume
        );
        if (!character) return;

        character.level = parseInt(level) || 0;
        character.required = required.toLowerCase() === 'true';
        character.hasM3 = hasM3.toLowerCase() === 'true';
        character.totsu = character.hasM3 ? 3 : 0;
        normalizeMagicUsage(character);
        importedCount++;
      });
    }

    saveLevels();
    closeDataModal();
    showSnackbar(t('search.importSuccess', { count: importedCount }));
  } catch (error) {
    try {
      let importedCount = 0;
      const lines = dataText.value.split('\n').filter(line => line.trim());
      lines.forEach(line => {
        const [chara, costume, level, required, hasM3] = line.split('\t');
        const character = characters.value.find(
          char => char.chara === chara && char.costume === costume
        );
        if (!character) return;

        character.level = parseInt(level) || 0;
        character.required = required.toLowerCase() === 'true';
        character.hasM3 = hasM3.toLowerCase() === 'true';
        character.totsu = character.hasM3 ? 3 : 0;
        normalizeMagicUsage(character);
        importedCount++;
      });

      if (importedCount === 0) {
        throw error;
      }

      saveLevels();
      closeDataModal();
      showSnackbar(t('search.importSuccess', { count: importedCount }));
    } catch (fallbackError) {
      console.error('インポートエラー:', fallbackError);
      showSnackbar(t('search.importError'), 'error');
    }
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
        character.totsu = handCard.totsu;
        // 手持ち設定はM3のみなので、M1/M2を含めた使用可否を補正
        normalizeMagicUsage(character);
        appliedCount++;
      } else {
        // 所持していない場合、デフォルト設定
        character.level = 0;
        character.required = false;
        character.hasM3 = false;
        character.totsu = 0;
        // 未所持は最低2つONの初期状態に合わせる
        normalizeMagicUsage(character);
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

onBeforeUnmount(() => {
  if (focusHighlightTimeout !== null) {
    window.clearTimeout(focusHighlightTimeout);
  }
});

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
    if (character.totsu === undefined) {
      character.totsu = character.rare === 'SSR' ? 4 : 0;
    }
    normalizeMagicUsage(character);
  });
  loadLevels(); // 画面を開いた時にlocalStorageからレベルを復元
  syncDefenseExamContinueHealMagics(appliedPresetName.value);
});

watch(appliedPresetToken, () => {
  syncDefenseExamContinueHealMagics(appliedPresetName.value);
});
</script>

<style scoped>
.character-image {
  width: 40px;
  height: 40px;
  border-radius: 4px;
  object-fit: cover;
}

:deep(.focused-character-row td) {
  background-color: rgba(211, 47, 47, 0.16) !important;
  transition: background-color 0.3s ease;
}

.search-body-container {
  padding-left: 6px;
  padding-right: 6px;
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

.bulk-select-group {
  display: flex;
  align-items: center;
  gap: 6px;
}

.bulk-select-label {
  font-size: 0.9rem;
  color: rgba(0, 0, 0, 0.6);
}

.bulk-select,
.table-select {
  border: 1px solid #ccc;
  border-radius: 4px;
  background-color: #fff;
  padding: 6px 8px;
}

.bulk-select {
  min-width: 64px;
}

.table-select {
  min-width: 56px;
}

.table-select:disabled {
  background-color: #f5f5f5;
  color: #999;
}

.save-levels-btn {
  margin-left: auto;
}

@media (max-width: 960px) {
  .search-body-container {
    padding-left: 2px;
    padding-right: 2px;
  }
}

@media (max-width: 600px) {
  .search-body-container {
    padding-left: 0;
    padding-right: 0;
  }

  .controls-container {
    flex-direction: column;
    align-items: center;
  }

  .level-controls {
    width: 100%;
    justify-content: center;
  }

  .bulk-select-group {
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
