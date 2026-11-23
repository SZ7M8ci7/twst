<template>
  <div class="deck-search-settings">
    <v-radio-group v-model="searchSettingsStore.rosterSource" :label="$t('examSearch.rosterSource')"
      inline color="primary" hide-details density="compact">
      <v-radio value="owned" :label="$t('examSearch.rosterOptions.owned')" />
      <v-radio value="allMax" :label="$t('examSearch.rosterOptions.allMax')" />
      <v-radio value="ownedMax" :label="$t('examSearch.rosterOptions.ownedMax')" />
    </v-radio-group>
    <p class="roster-description">
      {{ $t(rosterDescriptions[searchSettingsStore.rosterSource]) }}
      <router-link v-if="searchSettingsStore.rosterSource !== 'allMax'" :to="{ name: 'handCollection' }">
        {{ $t('simulator.manageCardSettings') }}
      </router-link>
    </p>
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
            item-title="title"
            item-value="value"
            class="ma-0 pa-0"
            hide-details
            dense
          ></v-select>
          <v-select
            v-model="option.order"
            :items="sortOrderItems"
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
      <DeckSearchRequiredCards class="mt-4" />
      <v-card-title>{{ $t('settingModal.mustCharacter') }}</v-card-title>
      <v-card-text class="ma-0 pa-0">
        <DeckSearchCharacterGrid v-model="mustCharacterSelection" :label="$t('settingModal.mustCharacter')" />
        <p v-if="searchSettingsStore.hasExcludedRequiredCharacter" role="alert" class="text-error text-body-2">
          {{ $t('error.requiredCharacterOutsideCandidates') }}
        </p>
      </v-card-text>
      <v-card-title>{{ $t('settingModal.candidateCharacters') }}</v-card-title>
      <v-card-text class="ma-0 pa-0">
        <p>{{ $t('settingModal.candidateCharactersHelp') }}</p>
        <div class="d-flex flex-wrap align-center ga-2 my-2">
          <span>{{ searchSettingsStore.candidateCharacters.length }} / {{ deckSearchCharacters.length }}</span>
          <v-btn size="small" variant="outlined" @click="searchSettingsStore.candidateCharacters = [...defaultSearchSettings.candidateCharacters]">
            {{ $t('support.selectAll') }}
          </v-btn>
          <v-btn size="small" variant="outlined" @click="searchSettingsStore.candidateCharacters = []">
            {{ $t('support.deselectAll') }}
          </v-btn>
        </div>
        <DeckSearchCharacterGrid v-model="searchSettingsStore.candidateCharacters" :label="$t('settingModal.candidateCharacters')" />
      </v-card-text>
      <v-card-text class="sort-option mt-2 mb-2 pa-0">
        <v-checkbox
          v-model="allowSameCharacter"
          :label="$t('settingModal.allowSameCharacter')"
          class="ma-0 pa-0 support-checkbox"
          hide-details
        />
      </v-card-text>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { createDefaultSearchSettingsState, deckSearchCharacters, useSearchSettingsStore, type SearchSettingsState } from '@/store/searchSetting';
import DeckSearchRequiredCards from './DeckSearchRequiredCards.vue';
import { useI18n } from 'vue-i18n';
import DeckSearchCharacterGrid from './DeckSearchCharacterGrid.vue';
import { enName2jpName, getAvailableSortProps } from '@/components/common'
import { SEARCH_PRESET_CONFIGURATIONS as PRESET_CONFIGURATIONS, type SearchPreset } from '@/constants/searchPresets';

const { t } = useI18n();

interface MinimumSettingOption {
  prop: MinimumSettingKey | '';
  value: number;
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
const rosterDescriptions = {
  owned: 'search.ownedDescription',
  allMax: 'simulator.allCardsDescription',
  ownedMax: 'examSearch.ownedMaxDescription',
};
const sortOptions = ref(searchSettingsStore.sortOptions.map(option => ({ ...option })));
const minimumSettings = ref(buildMinimumSettingRows(getMinimumSettingValues(searchSettingsStore)));
const mustCharacterSelection = ref(searchSettingsStore.mustCharacters.map(option => enName2jpName[option.prop] || option.prop));

// Keep stable keys as values; only the labels depend on the current language.
const availableSortProps = computed(() => getAvailableSortProps((key) => key)
  .map((key) => ({ title: t(key), value: key })));
const sortOrderItems = computed(() => ['settingModal.asc', 'settingModal.desc']
  .map((key) => ({ title: t(key), value: key })));
const allowSameCharacter = ref(searchSettingsStore.allowSameCharacter);
const selectedPreset = ref(searchSettingsStore.appliedPresetName);
const isApplyingPreset = ref(false);

function getMinimumSettingValues(source: Pick<SearchSettingsState, MinimumSettingKey>): Record<MinimumSettingKey, number> {
  return minimumSettingDefinitions.reduce((acc, definition) => {
    acc[definition.key] = source[definition.key];
    return acc;
  }, {} as Record<MinimumSettingKey, number>);
}

function buildMinimumSettingRows(values: Partial<Record<MinimumSettingKey, number>>): MinimumSettingOption[] {
  return minimumSettingDefinitions
    .filter((definition) => (values[definition.key] ?? 0) > 0)
    .map((definition) => ({
      prop: definition.key,
      value: values[definition.key] ?? 0,
    }));
}

function setMinimumSettings(values: Partial<Record<MinimumSettingKey, number>>) {
  minimumSettings.value = buildMinimumSettingRows(values);
}

function getAvailableMinimumProps(index: number) {
  const currentValue = minimumSettings.value[index]?.prop ?? '';
  const selectedValues = new Set(
    minimumSettings.value
      .map((option, optionIndex) => (optionIndex === index ? '' : option.prop))
      .filter((prop) => prop !== '')
  );
  return minimumSettingDefinitions
    .filter((definition) => definition.key === currentValue || !selectedValues.has(definition.key))
    .map((definition) => ({ title: t(definition.labelKey), value: definition.key }));
}

function addMinimumSetting() {
  const currentSelections = new Set(minimumSettings.value.map((option) => option.prop));
  const nextKey = minimumSettingDefinitions
    .find((definition) => !currentSelections.has(definition.key))?.key ?? '';
  minimumSettings.value.push({ prop: nextKey, value: 0 });
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
  sortOptions.value = preset.sortOptions.map((option) => ({ ...option }));

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
  sortOptions.value.push({ prop: '', order: 'settingModal.desc' });
}
function removeSortOption(index: string | number) {
  sortOptions.value.splice(Number(index), 1);
}

function toFiniteInt(value: unknown, fallback: number, min?: number, max?: number): number {
  const parsed = Number(value);
  let normalized = Number.isFinite(parsed) ? Math.trunc(parsed) : fallback;
  if (min !== undefined && normalized < min) normalized = min;
  if (max !== undefined && normalized > max) normalized = max;
  return normalized;
}

function updateSettings() {
  const convertedMustCharacters = [...mustCharacterSelection.value];
  const storedMustCharacters = convertedMustCharacters.map((name) => ({ prop: name }));

  const normalizedMinimumSettings = minimumSettingDefinitions.reduce((acc, definition) => {
    acc[definition.key] = 0;
    return acc;
  }, {} as Record<MinimumSettingKey, number>);

  minimumSettings.value.forEach((option) => {
    if (!option.prop) return;
    normalizedMinimumSettings[option.prop] = toFiniteInt(option.value, 0, 0);
  });

  searchSettingsStore.updateSearchSettings({
    ...normalizedMinimumSettings,
    sortOptions: sortOptions.value.map((option) => ({ ...option })),
    maxResult: toFiniteInt(maxResult.value, 30, 0),
    attackNum: toFiniteInt(attackNum.value, 10, 1, 10),
    allowSameCharacter: allowSameCharacter.value,
    mustCharacters: storedMustCharacters,
    convertedMustCharacters: convertedMustCharacters,
    appliedPresetName: selectedPreset.value,
  });
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
watch([sortOptions, minimumSettings, maxResult, attackNum, allowSameCharacter, mustCharacterSelection, selectedPreset],
  updateSettings, { deep: true });
</script>
<style scoped>
.deck-search-settings {
  max-width: 1100px;
  margin: 0 auto;
  padding: 8px;
}
.roster-description {
  margin: 4px 0 16px;
  font-size: 0.875rem;
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
}

</style>
