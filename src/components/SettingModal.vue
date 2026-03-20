<template>
  <div class="modal-background">
    <!-- プリセットセクション -->
    <v-card-title class="preset-title">{{ $t('settingModal.searchPreset') }}</v-card-title>
    <v-card-text class="preset-section ma-0 pa-2">
      <div class="preset-matrix">
        <div class="matrix-corner"></div>
        <div
          v-for="column in presetMatrixColumns"
          :key="column.key"
          class="matrix-header"
        >
          {{ $t(column.labelKey) }}
        </div>
        <template v-for="row in presetMatrixRows" :key="row.labelKey">
          <div class="matrix-row-label">
            {{ $t(row.labelKey) }}
          </div>
          <v-btn
            v-for="column in presetMatrixColumns"
            :key="row.presetNames[column.key]"
            @click="applyPreset(presetByName[row.presetNames[column.key]])"
            :class="[
              'preset-button',
              'matrix-preset-button',
              `matrix-preset-button--${column.key}`,
              { 'matrix-preset-button--selected': selectedPreset === row.presetNames[column.key] }
            ]"
            :aria-label="$t(row.presetNames[column.key])"
            :title="$t(row.presetNames[column.key])"
            variant="flat"
            size="small"
          >
            <v-icon size="18">mdi-check-circle-outline</v-icon>
          </v-btn>
        </template>
      </div>
      <div v-if="secondaryPresetButtons.length > 0" class="secondary-preset-section">
        <div class="secondary-preset-title">{{ $t('settingModal.presetMatrix.other') }}</div>
        <div class="secondary-preset-grid">
          <v-btn
            v-for="preset in secondaryPresetButtons"
            :key="preset.name"
            @click="applyPreset(preset)"
            class="preset-button"
            :color="selectedPreset === preset.name ? 'primary' : 'default'"
            variant="outlined"
            size="small"
          >
            {{ $t(preset.name) }}
          </v-btn>
        </div>
      </div>
    </v-card-text>
    
    <v-divider></v-divider>
    
    <v-card-title>{{ $t('settingModal.sortSettings') }}</v-card-title>
      <v-card-text class="ma-0 pa-0">
        <div v-for="(option, index) in sortOptions" :key="index" class="ma-0 pa-0 sort-option">
          <span class="sort-rank">{{ toDisplayIndex(index) }}.</span>
          <v-select
            v-model="option.prop"
            :items="availableSortProps"
            :label="$t('settingModal.sortKey')"
            item-text="prop"
            item-value="value"
            class="ma-0 pa-0"
            hide-details
            dense
          ></v-select>
          <v-select
            v-model="option.order"
            :items="[$t('settingModal.asc'), $t('settingModal.desc')]"
            :label="$t('settingModal.order')"
            class="ma-0 pa-0"
            hide-details
            dense
            style="max-width: 130px;"
          ></v-select>
          <v-btn icon @click="removeSortOption(index)" size="x-small">
            <v-icon>mdi-minus</v-icon>
          </v-btn>
        </div>
        <div class="add-button-container">
          <v-btn icon fab @click="addSortOption" size="x-small"><v-icon>mdi-plus</v-icon></v-btn>
        </div>

      </v-card-text>
      <v-card-title class="mt-0 pt-0">{{ $t('settingModal.minimumValueSetting') }}</v-card-title>
      <v-card-text class="ma-0 pa-0">
        <div v-for="(option, index) in minimumSettings" :key="index" class="ma-0 pa-0 sort-option">
          <span class="sort-rank">{{ toDisplayIndex(index) }}.</span>
          <v-select
            v-model="option.prop"
            :items="getAvailableMinimumProps(index)"
            :label="$t('settingModal.minimumTarget')"
            class="ma-0 pa-0"
            hide-details
            dense
          ></v-select>
          <v-text-field
            v-model="option.value"
            type="number"
            :label="$t('settingModal.minimumValue')"
            class="ma-0 pa-0"
            hide-details
            dense
            solo
            :min="0"
          />
          <v-btn icon @click="removeMinimumSetting(index)" size="x-small">
            <v-icon>mdi-minus</v-icon>
          </v-btn>
        </div>
        <div class="add-button-container">
          <v-btn icon fab @click="addMinimumSetting" size="x-small"><v-icon>mdi-plus</v-icon></v-btn>
        </div>
      </v-card-text>
    <v-card-title>{{ $t('settingModal.searchSettings') }}</v-card-title>
      <v-card-text class="sort-option ma-0 pa-0">
        <span class="min-label">{{ $t('settingModal.maximumResult') }}</span>
        <v-text-field
            type="number"
            v-model="maxResult"
            class="mt-0 pt-0"
            hide-details="auto"
            dense
            solo
            :min="0"
          />
      </v-card-text>
      <v-card-text class="sort-option ma-0 pa-0">
        <span class="min-label">{{ $t('settingModal.attackNum') }}</span>
        <v-text-field
            type="number"
            v-model="attackNum"
            class="mt-0 pt-0"
            hide-details="auto"
            dense
            solo
            :min="1"
            :max="10"
          />
      </v-card-text>
      <v-card-title>{{ $t('settingModal.mustCharacter') }}</v-card-title>
      <v-card-text class="ma-0 pa-0">
        <div class="must-character-grid">
          <button
            v-for="character in mustCharacterList"
            :key="character.name_ja"
            type="button"
            :class="['must-character-button', { 'must-character-button--selected': mustCharacterSelection.includes(character.name_ja) }]"
            @click="toggleMustCharacter(character.name_ja)"
            :aria-label="character.name_ja"
            :aria-pressed="mustCharacterSelection.includes(character.name_ja)"
          >
            <img
              v-if="mustCharacterIconUrls[character.name_en]"
              :src="mustCharacterIconUrls[character.name_en]"
              :alt="character.name_ja"
              class="must-character-icon"
            />
          </button>
        </div>
      </v-card-text>
      <v-card-text class="sort-option mt-2 mb-2 pa-0">
        <v-checkbox
          v-model="allowSameCharacter"
          :label="$t('settingModal.allowSameCharacter')"
          class="ma-0 pa-0 support-checkbox"
          hide-details
        />
      </v-card-text>
    <div class="button-container">
      <v-btn class="button" @click="cancel">{{ $t('settingModal.cancel') }}</v-btn>
      <v-btn class="button apply-button" @click="applyFilter" :disabled="sortOptions.length==0">{{ $t('settingModal.ok') }}</v-btn>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';
import { createDefaultSearchSettingsState, useSearchSettingsStore, type SearchSettingsState } from '@/store/searchSetting';
import { onBeforeMount, onMounted } from 'vue';
import { cloneDeep } from 'lodash';
import { useI18n } from 'vue-i18n';
const { t } = useI18n();
import characterData from '@/assets/characters_info.json';
import { enName2jpName, getAvailableSortProps, loadImageUrls } from '@/components/common'
import { SEARCH_PRESET_CONFIGURATIONS as PRESET_CONFIGURATIONS, type SearchPreset } from '@/constants/searchPresets';

interface SortOption {
  prop: string;
  order: string;
}
interface MustCharacterOption {
  prop: string;
}

interface MinimumSettingOption {
  prop: string;
  value: number;
}

interface MustCharacterInfo {
  name_ja: string;
  name_en: string;
  dorm: string;
}

type PresetMatrixColumnKey = 'fire' | 'water' | 'flora' | 'all' | 'neutral';

interface PresetMatrixColumn {
  key: PresetMatrixColumnKey;
  labelKey: string;
}

interface PresetMatrixRow {
  labelKey: string;
  presetNames: Record<PresetMatrixColumnKey, string>;
}

type MinimumSettingKey =
  | 'minEHP'
  | 'minHP'
  | 'minHPBuddy'
  | 'minIncreasedHPBuddy'
  | 'minEvasion'
  | 'minHealNum'
  | 'minDuo'
  | 'minBuff'
  | 'minDebuff'
  | 'minCosmic'
  | 'minFire'
  | 'minWater'
  | 'minFlora'
  | 'minReferenceDamage'
  | 'minReferenceAdvantageDamage'
  | 'minReferenceVsHiDamage'
  | 'minReferenceVsMizuDamage'
  | 'minReferenceVsKiDamage';

interface MinimumSettingDefinition {
  key: MinimumSettingKey;
  labelKey: string;
}

const presetMatrixColumns: PresetMatrixColumn[] = [
  { key: 'fire', labelKey: 'settingModal.presetMatrix.fire' },
  { key: 'water', labelKey: 'settingModal.presetMatrix.water' },
  { key: 'flora', labelKey: 'settingModal.presetMatrix.flora' },
  { key: 'all', labelKey: 'settingModal.presetMatrix.all' },
  { key: 'neutral', labelKey: 'settingModal.presetMatrix.neutral' },
];

const presetMatrixRows: PresetMatrixRow[] = [
  {
    labelKey: 'settingModal.presetMatrix.basic',
    presetNames: {
      fire: 'settingModal.preset.fireBasicExam',
      water: 'settingModal.preset.waterBasicExam',
      flora: 'settingModal.preset.floraBasicExam',
      all: 'settingModal.preset.allBasicExam',
      neutral: 'settingModal.preset.neutralBasicExam',
    },
  },
  {
    labelKey: 'settingModal.presetMatrix.defense',
    presetNames: {
      fire: 'settingModal.preset.fireDefenseExam',
      water: 'settingModal.preset.waterDefenseExam',
      flora: 'settingModal.preset.floraDefenseExam',
      all: 'settingModal.preset.allDefenseExam',
      neutral: 'settingModal.preset.neutralDefenseExam',
    },
  },
  {
    labelKey: 'settingModal.presetMatrix.attack',
    presetNames: {
      fire: 'settingModal.preset.fireAttackExam',
      water: 'settingModal.preset.waterAttackExam',
      flora: 'settingModal.preset.floraAttackExam',
      all: 'settingModal.preset.allAttackExam',
      neutral: 'settingModal.preset.neutralAttackExam',
    },
  },
];

const matrixPresetNames = new Set(
  presetMatrixRows.flatMap((row) => Object.values(row.presetNames))
);
const presetByName = Object.fromEntries(
  PRESET_CONFIGURATIONS.map((preset) => [preset.name, preset])
) as Record<string, SearchPreset>;
const secondaryPresetButtons = PRESET_CONFIGURATIONS.filter(
  (preset) => !matrixPresetNames.has(preset.name)
);

const minimumSettingDefinitions: MinimumSettingDefinition[] = [
  { key: 'minEHP', labelKey: 'settingModal.minimumEHP' },
  { key: 'minHP', labelKey: 'settingModal.minimumHP' },
  { key: 'minHPBuddy', labelKey: 'settingModal.minimumHPBuddy' },
  { key: 'minIncreasedHPBuddy', labelKey: 'settingModal.minimumIncreasedHPBuddy' },
  { key: 'minEvasion', labelKey: 'settingModal.minimumEvasion' },
  { key: 'minHealNum', labelKey: 'settingModal.minimumHealNum' },
  { key: 'minDuo', labelKey: 'settingModal.minimumDuo' },
  { key: 'minBuff', labelKey: 'settingModal.minimumBuff' },
  { key: 'minDebuff', labelKey: 'settingModal.minimumDebuff' },
  { key: 'minCosmic', labelKey: 'settingModal.minimumCosmic' },
  { key: 'minFire', labelKey: 'settingModal.minimumFire' },
  { key: 'minWater', labelKey: 'settingModal.minimumWater' },
  { key: 'minFlora', labelKey: 'settingModal.minimumFlora' },
  { key: 'minReferenceDamage', labelKey: 'settingModal.minimumNeutralDamage' },
  { key: 'minReferenceAdvantageDamage', labelKey: 'settingModal.minimumAdvantageDamage' },
  { key: 'minReferenceVsHiDamage', labelKey: 'settingModal.minimumAgainstFireDamage' },
  { key: 'minReferenceVsMizuDamage', labelKey: 'settingModal.minimumAgainstWaterDamage' },
  { key: 'minReferenceVsKiDamage', labelKey: 'settingModal.minimumAgainstFloraDamage' },
];

const defaultSearchSettings = createDefaultSearchSettingsState();
const defaultMinimumSettingValues = minimumSettingDefinitions.reduce((acc, definition) => {
  acc[definition.key] = defaultSearchSettings[definition.key];
  return acc;
}, {} as Record<MinimumSettingKey, number>);

const searchSettingsStore = useSearchSettingsStore();
const maxResult = ref(searchSettingsStore.maxResult);
const attackNum = ref(searchSettingsStore.attackNum);
let initialSortOptions: SortOption[] = [];
const sortOptions = ref<SortOption[]>([]);
const minimumSettings = ref<MinimumSettingOption[]>([]);
const mustCharacterSelection = ref<string[]>([]);
const mustCharacterIconUrls = ref<Record<string, string>>({});

const availableSortProps = getAvailableSortProps(t);
const mustCharacterList = (characterData as MustCharacterInfo[]).filter(
  (character) => character.name_ja !== 'サム'
);

onBeforeMount(() => {
  // sortOptionsの初期状態を保持するためのリアクティブな参照
  initialSortOptions = cloneDeep(searchSettingsStore.sortOptions ?? []);
  // ユーザーによる変更を保持するためのリアクティブな参照
  sortOptions.value = cloneDeep(initialSortOptions).map((option: SortOption) => ({
    ...option,
    prop: t(option.prop),
    order: t(option.order),
  }));
  mustCharacterSelection.value = (searchSettingsStore.mustCharacters ?? [])
    .map((option) => enName2jpName[option.prop] || option.prop)
    .filter((name): name is string => typeof name === 'string' && name.length > 0);
  minimumSettings.value = buildMinimumSettingRows(getMinimumSettingValues(searchSettingsStore));
  selectedPreset.value = searchSettingsStore.appliedPresetName ?? '';
});

onMounted(async () => {
  mustCharacterIconUrls.value = await loadImageUrls(characterData, (item: MustCharacterInfo) => item.name_en, 'icon/');
});

const allowSameCharacter = ref(searchSettingsStore.allowSameCharacter);
const selectedPreset = ref('');
const isApplyingPreset = ref(false);

function getMinimumSettingValues(source: Pick<SearchSettingsState, MinimumSettingKey>): Record<MinimumSettingKey, number> {
  return minimumSettingDefinitions.reduce((acc, definition) => {
    acc[definition.key] = source[definition.key];
    return acc;
  }, {} as Record<MinimumSettingKey, number>);
}

function getMinimumSettingLabel(key: MinimumSettingKey): string {
  return t(minimumSettingDefinitions.find((definition) => definition.key === key)?.labelKey ?? '');
}

function getMinimumSettingKey(label: string): MinimumSettingKey | undefined {
  return minimumSettingDefinitions.find((definition) => t(definition.labelKey) === label)?.key;
}

function buildMinimumSettingRows(values: Partial<Record<MinimumSettingKey, number>>): MinimumSettingOption[] {
  return minimumSettingDefinitions
    .filter((definition) => (values[definition.key] ?? 0) > 0)
    .map((definition) => ({
      prop: getMinimumSettingLabel(definition.key),
      value: values[definition.key] ?? 0,
    }));
}

function setMinimumSettings(values: Partial<Record<MinimumSettingKey, number>>) {
  minimumSettings.value = buildMinimumSettingRows(values);
}

function getAvailableMinimumProps(index: number): string[] {
  const currentValue = minimumSettings.value[index]?.prop ?? '';
  const selectedValues = new Set(
    minimumSettings.value
      .map((option, optionIndex) => (optionIndex === index ? '' : option.prop))
      .filter((prop) => prop !== '')
  );
  return minimumSettingDefinitions
    .map((definition) => t(definition.labelKey))
    .filter((label) => label === currentValue || !selectedValues.has(label));
}

function addMinimumSetting() {
  const currentSelections = new Set(minimumSettings.value.map((option) => option.prop));
  const nextLabel = minimumSettingDefinitions
    .map((definition) => t(definition.labelKey))
    .find((label) => !currentSelections.has(label)) ?? '';
  minimumSettings.value.push({ prop: nextLabel, value: 0 });
}

function removeMinimumSetting(index: string | number) {
  minimumSettings.value.splice(Number(index), 1);
}

// プリセット適用関数（自動リセット付き）
function applyPreset(preset: SearchPreset) {
  isApplyingPreset.value = true;
  // まず全設定をリセット
  resetAllSettings();

  // プリセット名を設定
  selectedPreset.value = preset.name;

  // ソートオプションの適用
  sortOptions.value = preset.sortOptions.map((option) => ({
    ...option,
    prop: t(option.prop),
    order: t(option.order),
  }));

  setMinimumSettings({
    ...defaultMinimumSettingValues,
    ...preset.minSettings,
  });

  // その他の設定
  if (preset.attackNum !== undefined) attackNum.value = preset.attackNum;
  if (preset.allowSameCharacter !== undefined) allowSameCharacter.value = preset.allowSameCharacter;
  isApplyingPreset.value = false;
}

// 全設定をデフォルト値にリセット
function resetAllSettings() {
  // 全ての設定を初期値にリセット
  setMinimumSettings(defaultMinimumSettingValues);
  maxResult.value = 30;
  attackNum.value = 10;
  allowSameCharacter.value = false;

  // ソートオプションをクリア
  sortOptions.value = [];

  // 必須キャラクターをクリア
  mustCharacterSelection.value = [];

  // 選択されたプリセットをクリア
  selectedPreset.value = '';
}

function addSortOption() {
  sortOptions.value.push({ prop: '', order: t('settingModal.desc') });
}
function removeSortOption(index: string | number) {
  sortOptions.value.splice(Number(index), 1);
}

function toggleMustCharacter(name: string) {
  if (mustCharacterSelection.value.includes(name)) {
    mustCharacterSelection.value = mustCharacterSelection.value.filter((characterName) => characterName !== name);
    return;
  }
  mustCharacterSelection.value = [...mustCharacterSelection.value, name];
}
const emit = defineEmits(['close']);
let hasLoggedMaxResultNormalization = false;
let hasLoggedAttackNumNormalization = false;

function toFiniteInt(value: unknown, fallback: number, min?: number, max?: number): number {
  const parsed = Number(value);
  let normalized = Number.isFinite(parsed) ? Math.trunc(parsed) : fallback;
  if (min !== undefined && normalized < min) normalized = min;
  if (max !== undefined && normalized > max) normalized = max;
  return normalized;
}

function applyFilter() {
  const convertedMustCharacters = [...mustCharacterSelection.value];
  const storedMustCharacters: MustCharacterOption[] = convertedMustCharacters.map((name) => ({ prop: name }));

  // ソートオプションの翻訳キーを元のプロパティ名に戻す
  const convertedSortOptions = sortOptions.value.map((option: SortOption) => {
    // 表示用の翻訳されたプロパティ名から元のキーを見つける
    let originalProp = option.prop;
    let originalOrder = option.order;
    
    // commentsセクションから元のキーを検索
    const commentsEntries = Object.entries(t('comments'));
    const foundCommentProp = commentsEntries.find(([, value]) => value === option.prop);
    if (foundCommentProp) {
      originalProp = `comments.${foundCommentProp[0]}`;
    }
    
    // settingModalセクションから元のキーを検索
    const settingModalEntries = Object.entries(t('settingModal'));
    const foundSettingProp = settingModalEntries.find(([, value]) => value === option.order);
    if (foundSettingProp) {
      originalOrder = `settingModal.${foundSettingProp[0]}`;
    }
    
    return {
      ...option,
      prop: originalProp,
      order: originalOrder
    };
  });

  const rawMaxResult = maxResult.value;
  const normalizedMaxResult = toFiniteInt(rawMaxResult, 30, 0);
  if (
    !hasLoggedMaxResultNormalization &&
    (typeof rawMaxResult !== 'number' || normalizedMaxResult !== rawMaxResult)
  ) {
    hasLoggedMaxResultNormalization = true;
    console.warn('[SearchSettings][diagnostic] maxResult was normalized', {
      rawValue: rawMaxResult,
      rawType: typeof rawMaxResult,
      normalizedValue: normalizedMaxResult,
    });
  }

  const rawAttackNum = attackNum.value;
  const normalizedAttackNum = toFiniteInt(rawAttackNum, 10, 1, 10);
  if (
    !hasLoggedAttackNumNormalization &&
    (typeof rawAttackNum !== 'number' || normalizedAttackNum !== rawAttackNum)
  ) {
    hasLoggedAttackNumNormalization = true;
    console.warn('[SearchSettings][diagnostic] attackNum was normalized', {
      rawValue: rawAttackNum,
      rawType: typeof rawAttackNum,
      normalizedValue: normalizedAttackNum,
    });
  }

  const normalizedMinimumSettings = minimumSettingDefinitions.reduce((acc, definition) => {
    acc[definition.key] = 0;
    return acc;
  }, {} as Record<MinimumSettingKey, number>);

  minimumSettings.value.forEach((option) => {
    const originalKey = getMinimumSettingKey(option.prop);
    if (!originalKey) return;
    normalizedMinimumSettings[originalKey] = toFiniteInt(option.value, 0, 0);
  });

  searchSettingsStore.updateSearchSettings({
    ...normalizedMinimumSettings,
    sortOptions: convertedSortOptions,
    maxResult: normalizedMaxResult,
    attackNum: normalizedAttackNum,
    allowSameCharacter: allowSameCharacter.value,
    mustCharacters: storedMustCharacters,
    convertedMustCharacters: convertedMustCharacters,
    appliedPresetName: selectedPreset.value,
    appliedPresetToken: searchSettingsStore.appliedPresetToken + 1,
  });
  emit('close');
}
// キャンセルを押した場合、sortOptionsを元の状態に戻す
function cancel() {
  searchSettingsStore.sortOptions = [...initialSortOptions]; 
  emit('close'); // モーダルを閉じる
}

function toDisplayIndex(index: string | number): number {
  return Number(index) + 1;
}

watch(
  [sortOptions, minimumSettings, attackNum, allowSameCharacter],
  () => {
    if (isApplyingPreset.value || selectedPreset.value === '') return;
    selectedPreset.value = '';
  },
  { deep: true, flush: 'sync' }
);
</script>
<style scoped>
.character-list > .character-item {
  display: inline-flex; /* or 'inline-block' */
  align-items:center;
  width: 110px;
  text-align: left;
}

.modal-background {
  background-color: white;
  padding: 20px; /* パディングを調整 */
  border-radius: 8px; /* 角を丸くする */
  max-height: 95vh; /* Maximum height - 80% of the viewport height */
  overflow-y: auto; /* Enable vertical scrolling if content overflows */
}

.button-container {
  display: flex;
  gap: 10px; /* ボタン間のスペース */
  justify-content: center;
  padding-top: 14px;
}

.button, .apply-button {
  width: 150px; /* ボタンの幅を統一 */
}

.apply-button {
  background-color: #19d241;
  color: white;
}
.sort-option {
  display: flex;
  align-items: center; /* 中央揃え */
  gap: 10px; /* 要素間のスペース */
}
.min-label {
  min-width: 120px;
}
:deep(.v-card-text) {
  padding: 5px;
}
.add-button-container {
  display: flex;
  justify-content: center; /* Center the button horizontally */
  padding: 0px 0px 5px 0px; /* Add some padding above and below the button */
}

.must-character-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(36px, 1fr));
  gap: 6px;
}

.must-character-button {
  border: 1px solid transparent;
  border-radius: 8px;
  background: transparent;
  padding: 2px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: transform 0.15s ease, box-shadow 0.15s ease, border-color 0.15s ease, background-color 0.15s ease, opacity 0.15s ease;
  opacity: 0.55;
}

.must-character-button:hover {
  transform: translateY(-1px);
  opacity: 0.75;
}

.must-character-button--selected {
  border-color: #1976d2;
  background: #eef5ff;
  box-shadow: 0 0 0 1px rgba(25, 118, 210, 0.2);
  opacity: 1;
}

.must-character-icon {
  width: 30px;
  height: 30px;
  object-fit: cover;
  border-radius: 6px;
  display: block;
  filter: grayscale(1);
  transition: filter 0.15s ease, opacity 0.15s ease;
}

.must-character-button--selected .must-character-icon {
  filter: grayscale(0);
}

/* プリセット関連のスタイル */
.preset-title {
  font-size: 1.1rem;
  font-weight: bold;
  color: #1976d2;
  padding-bottom: 8px;
}

.preset-section {
  background-color: #f8f9fa;
  border-radius: 8px;
  border: 1px solid #e9ecef;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.preset-matrix {
  display: grid;
  grid-template-columns: 42px repeat(5, minmax(0, 1fr));
  gap: 6px;
  align-items: center;
}

.matrix-corner {
  min-height: 1px;
}

.matrix-header,
.matrix-row-label {
  font-size: 0.78rem;
  font-weight: 600;
  color: #495057;
  text-align: center;
}

.matrix-preset-button {
  min-width: 0;
  width: 100%;
  padding: 0 4px;
  font-size: 0.72rem;
}

.matrix-preset-button--fire {
  background-color: #f8d9d5;
  color: #9f2f24;
}

.matrix-preset-button--water {
  background-color: #d9e8fb;
  color: #215aa7;
}

.matrix-preset-button--flora {
  background-color: #dbeedc;
  color: #2f7338;
}

.matrix-preset-button--all {
  background-color: #e8defa;
  color: #5c33ab;
}

.matrix-preset-button--neutral {
  background-color: #e9ecef;
  color: #495057;
}

.matrix-preset-button--selected {
  box-shadow: 0 0 0 2px #1f2937 inset, 0 4px 10px rgba(0, 0, 0, 0.18);
  transform: translateY(-1px);
  color: #fff;
}

.matrix-preset-button--fire.matrix-preset-button--selected {
  background-color: #d84a3a;
}

.matrix-preset-button--water.matrix-preset-button--selected {
  background-color: #2f7de1;
}

.matrix-preset-button--flora.matrix-preset-button--selected {
  background-color: #3f9b4b;
}

.matrix-preset-button--all.matrix-preset-button--selected {
  background-color: #7a4bd1;
}

.matrix-preset-button--neutral.matrix-preset-button--selected {
  background-color: #6c757d;
}

.secondary-preset-section {
  border-top: 1px solid #dee2e6;
  padding-top: 8px;
}

.secondary-preset-title {
  font-size: 0.8rem;
  font-weight: 600;
  color: #495057;
  margin-bottom: 6px;
}

.secondary-preset-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
  gap: 8px;
}

.preset-button {
  font-size: 0.85rem;
  padding: 8px 12px;
  text-transform: none;
  height: auto;
  min-height: 36px;
  transition: all 0.2s ease;
}

.preset-button:hover {
  transform: translateY(-1px);
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
}

@media (max-width: 600px) {
  .preset-matrix {
    grid-template-columns: 38px repeat(5, minmax(0, 1fr));
    gap: 4px;
  }

  .matrix-header,
  .matrix-row-label,
  .secondary-preset-title {
    font-size: 0.72rem;
  }

  .preset-button {
    padding: 6px 8px;
  }

  .matrix-preset-button {
    font-size: 0.68rem;
    min-height: 32px;
  }

  .must-character-grid {
    grid-template-columns: repeat(auto-fill, minmax(34px, 1fr));
    gap: 5px;
  }

  .must-character-icon {
    width: 28px;
    height: 28px;
  }
}

</style>
