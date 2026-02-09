<template>
  <div class="modal-background">
    <!-- プリセットセクション -->
    <v-card-title class="preset-title">{{ $t('settingModal.searchPreset') }}</v-card-title>
    <v-card-text class="preset-section ma-0 pa-2">
      <div class="preset-grid">
        <v-btn 
          v-for="preset in PRESET_CONFIGURATIONS" 
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
      <v-card-text class="sort-option ma-0 pa-0">
        <span class="min-label">{{ $t('settingModal.minimumEHP') }}</span>
        <v-text-field
            type="number"
            v-model="minEHP"
            class="mt-0 pt-0"
            hide-details="auto"
            dense
            solo
            :min="0"
          />
      </v-card-text>
      <v-card-text class="sort-option ma-0 pa-0">
        <span class="min-label">{{ $t('settingModal.minimumHP') }}</span>
        <v-text-field
            type="number"
            v-model="minHP"
            class="mt-0 pt-0"
            hide-details="auto"
            dense
            solo
            :min="0"
          />
      </v-card-text>
      <v-card-text class="sort-option ma-0 pa-0">
        <span class="min-label">{{ $t('settingModal.minimumHPBuddy') }}</span>
        <v-text-field
            type="number"
            v-model="minHPBuddy"
            class="mt-0 pt-0"
            hide-details="auto"
            dense
            solo
            :min="0"
          />
      </v-card-text>
      <v-card-text class="sort-option ma-0 pa-0">
        <span class="min-label">{{ $t('settingModal.minimumIncreasedHPBuddy') }}</span>
        <v-text-field
            type="number"
            v-model="minIncreasedHPBuddy"
            class="mt-0 pt-0"
            hide-details="auto"
            dense
            solo
            :min="0"
          />
      </v-card-text>
      <v-card-text class="sort-option ma-0 pa-0">
        <span class="min-label">{{ $t('settingModal.minimumEvasion') }}</span>
        <v-text-field
            type="number"
            v-model="minEvasion"
            class="mt-0 pt-0"
            hide-details="auto"
            dense
            solo
            :min="0"
          />
      </v-card-text>
      <v-card-text class="sort-option ma-0 pa-0">
        <span class="min-label">{{ $t('settingModal.minimumHealNum') }}</span>
        <v-text-field
            type="number"
            v-model="minHealNum"
            class="mt-0 pt-0"
            hide-details="auto"
            dense
            solo
            :min="0"
            :max="20"
          />
      </v-card-text>
      <v-card-text class="sort-option ma-0 pa-0">
        <span class="min-label">{{ $t('settingModal.minimumDuo') }}</span>
        <v-text-field
            type="number"
            v-model="minDuo"
            class="mt-0 pt-0"
            hide-details="auto"
            dense
            solo
            :min="0"
          />
      </v-card-text>
      <v-card-text class="sort-option ma-0 pa-0">
        <span class="min-label">{{ $t('settingModal.minimumBuff') }}</span>
        <v-text-field
            type="number"
            v-model="minBuff"
            class="mt-0 pt-0"
            hide-details="auto"
            dense
            solo
            :min="0"
          />
      </v-card-text>
      <v-card-text class="sort-option ma-0 pa-0">
        <span class="min-label">{{ $t('settingModal.minimumDebuff') }}</span>
        <v-text-field
            type="number"
            v-model="minDebuff"
            class="mt-0 pt-0"
            hide-details="auto"
            dense
            solo
            :min="0"
          />
      </v-card-text>
      <v-card-text class="sort-option ma-0 pa-0">
        <span class="min-label">{{ $t('settingModal.minimumCosmic') }}</span>
        <v-text-field
            type="number"
            v-model="minCosmic"
            class="mt-0 pt-0"
            hide-details="auto"
            dense
            solo
            :min="0"
          />
      </v-card-text>
      <v-card-text class="sort-option ma-0 pa-0">
        <span class="min-label">{{ $t('settingModal.minimumFire') }}</span>
        <v-text-field
            type="number"
            v-model="minFire"
            class="mt-0 pt-0"
            hide-details="auto"
            dense
            solo
            :min="0"
          />
      </v-card-text>
      <v-card-text class="sort-option ma-0 pa-0">
        <span class="min-label">{{ $t('settingModal.minimumWater') }}</span>
        <v-text-field
            type="number"
            v-model="minWater"
            class="mt-0 pt-0"
            hide-details="auto"
            dense
            solo
            :min="0"
          />
      </v-card-text>
      <v-card-text class="sort-option ma-0 pa-0">
        <span class="min-label">{{ $t('settingModal.minimumFlora') }}</span>
        <v-text-field
            type="number"
            v-model="minFlora"
            class="mt-0 pt-0"
            hide-details="auto"
            dense
            solo
            :min="0"
          />
      </v-card-text>
      <v-card-text class="sort-option ma-0 pa-0">
        <span class="min-label">{{ $t('settingModal.minimumNeutralDamage') }}</span>
        <v-text-field
            type="number"
            v-model="minReferenceDamage"
            class="mt-0 pt-0"
            hide-details="auto"
            dense
            solo
            :min="0"
          />
      </v-card-text>
      <v-card-text class="sort-option ma-0 pa-0">
        <span class="min-label">{{ $t('settingModal.minimumAdvantageDamage') }}</span>
        <v-text-field
            type="number"
            v-model="minReferenceAdvantageDamage"
            class="mt-0 pt-0"
            hide-details="auto"
            dense
            solo
            :min="0"
          />
      </v-card-text>
      <v-card-text class="sort-option ma-0 pa-0">
        <span class="min-label">{{ $t('settingModal.minimumAgainstFireDamage') }}</span>
        <v-text-field
            type="number"
            v-model="minReferenceVsHiDamage"
            class="mt-0 pt-0"
            hide-details="auto"
            dense
            solo
            :min="0"
          />
      </v-card-text>
      <v-card-text class="sort-option ma-0 pa-0">
        <span class="min-label">{{ $t('settingModal.minimumAgainstWaterDamage') }}</span>
        <v-text-field
            type="number"
            v-model="minReferenceVsMizuDamage"
            class="mt-0 pt-0"
            hide-details="auto"
            dense
            solo
            :min="0"
          />
      </v-card-text>
      <v-card-text class="sort-option ma-0 pa-0">
        <span class="min-label">{{ $t('settingModal.minimumAgainstFloraDamage') }}</span>
        <v-text-field
            type="number"
            v-model="minReferenceVsKiDamage"
            class="mt-0 pt-0"
            hide-details="auto"
            dense
            solo
            :min="0"
          />
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
        <div v-for="(option, index) in mustCharacters" :key="index" class="ma-0 pa-0 sort-option">
          <span class="sort-rank">{{ toDisplayIndex(index) }}.</span>
          <v-select
            v-model="option.prop"
            :items="availableCharacterProps"
            item-text="prop"
            item-value="value"
            class="ma-0 pa-0"
            hide-details
            dense
          ></v-select>
          <v-btn icon @click="removeCharacterOption(index)" size="x-small">
            <v-icon>mdi-minus</v-icon>
          </v-btn>
        </div>
        <div class="add-button-container">
          <v-btn icon fab @click="addCharacterOption" size="x-small"><v-icon>mdi-plus</v-icon></v-btn>
        </div>

      </v-card-text>
      <v-card-text class="sort-option mt-2 mb-2 pa-0">
        <span class="min-label mt-0 pa-0">{{ $t('settingModal.allowSameCharacter') }}</span>
        <v-radio-group v-model="allowSameCharacter" class="ma-0 pa-0" inline hide-details>
          <v-radio :label="$t('settingModal.yes')" :value="true" ></v-radio>
          <v-radio :label="$t('settingModal.no')" :value="false"></v-radio>
        </v-radio-group>
      </v-card-text>
    <div class="button-container">
      <v-btn class="button" @click="cancel">{{ $t('settingModal.cancel') }}</v-btn>
      <v-btn class="button apply-button" @click="applyFilter" :disabled="sortOptions.length==0">{{ $t('settingModal.ok') }}</v-btn>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { useSearchSettingsStore } from '@/store/searchSetting';
import { onBeforeMount } from 'vue';
import { cloneDeep } from 'lodash';
import { useI18n } from 'vue-i18n';
const { t } = useI18n();
import { enName2jpName, getAvailableCharacterProps, getAvailableSortProps } from '@/components/common'
import { SEARCH_PRESET_CONFIGURATIONS as PRESET_CONFIGURATIONS, type SearchPreset } from '@/constants/searchPresets';

interface SortOption {
  prop: string;
  order: string;
}
interface MustCharacterOption {
  prop: string;
}

const searchSettingsStore = useSearchSettingsStore();
const minEHP = ref(searchSettingsStore.minEHP);
const minHP = ref(searchSettingsStore.minHP);
const minHPBuddy = ref(searchSettingsStore.minHPBuddy);
const minIncreasedHPBuddy = ref(searchSettingsStore.minIncreasedHPBuddy);
const minEvasion = ref(searchSettingsStore.minEvasion);
const minDuo = ref(searchSettingsStore.minDuo);
const minBuff = ref(searchSettingsStore.minBuff);
const minDebuff = ref(searchSettingsStore.minDebuff);
const minCosmic = ref(searchSettingsStore.minCosmic);
const minFire = ref(searchSettingsStore.minFire);
const minWater = ref(searchSettingsStore.minWater);
const minFlora = ref(searchSettingsStore.minFlora);
const minHealNum = ref(searchSettingsStore.minHealNum);
const minReferenceDamage = ref(searchSettingsStore.minReferenceDamage);
const minReferenceAdvantageDamage = ref(searchSettingsStore.minReferenceAdvantageDamage);
const minReferenceVsHiDamage = ref(searchSettingsStore.minReferenceVsHiDamage);
const minReferenceVsMizuDamage = ref(searchSettingsStore.minReferenceVsMizuDamage);
const minReferenceVsKiDamage = ref(searchSettingsStore.minReferenceVsKiDamage);
const maxResult = ref(searchSettingsStore.maxResult)
const attackNum = ref(searchSettingsStore.attackNum)
let initialSortOptions: SortOption[] = [];
const sortOptions = ref<SortOption[]>([]);
let initialMustCharacters: MustCharacterOption[] = [];
const mustCharacters = ref<MustCharacterOption[]>([]);

const availableSortProps = getAvailableSortProps(t);
const availableCharacterProps = getAvailableCharacterProps(t);
onBeforeMount(()=>{
  // sortOptionsの初期状態を保持するためのリアクティブな参照
  initialSortOptions = cloneDeep(searchSettingsStore.sortOptions ?? []);
  // ユーザーによる変更を保持するためのリアクティブな参照
  sortOptions.value = cloneDeep(initialSortOptions).map((option: SortOption) => ({
    ...option,
    prop: t(option.prop),
    order: t(option.order)
  }));
  initialMustCharacters = cloneDeep(searchSettingsStore.mustCharacters ?? []);
  mustCharacters.value = cloneDeep(initialMustCharacters);
})

const allowSameCharacter = ref(searchSettingsStore.allowSameCharacter);
const selectedPreset = ref('');

// プリセット適用関数（自動リセット付き）
function applyPreset(preset: SearchPreset) {
  // まず全設定をリセット
  resetAllSettings();
  
  // プリセット名を設定
  selectedPreset.value = preset.name;
  
  // ソートオプションの適用
  sortOptions.value = preset.sortOptions.map(option => ({
    ...option,
    prop: t(option.prop),
    order: t(option.order)
  }));
  
  // 最小設定値の適用（存在する場合のみ）
  const settings = preset.minSettings;
  if (settings.minEHP !== undefined) minEHP.value = settings.minEHP;
  if (settings.minHP !== undefined) minHP.value = settings.minHP;
  if (settings.minHPBuddy !== undefined) minHPBuddy.value = settings.minHPBuddy;
  if (settings.minIncreasedHPBuddy !== undefined) minIncreasedHPBuddy.value = settings.minIncreasedHPBuddy;
  if (settings.minEvasion !== undefined) minEvasion.value = settings.minEvasion;
  if (settings.minDuo !== undefined) minDuo.value = settings.minDuo;
  if (settings.minBuff !== undefined) minBuff.value = settings.minBuff;
  if (settings.minDebuff !== undefined) minDebuff.value = settings.minDebuff;
  if (settings.minCosmic !== undefined) minCosmic.value = settings.minCosmic;
  if (settings.minFire !== undefined) minFire.value = settings.minFire;
  if (settings.minWater !== undefined) minWater.value = settings.minWater;
  if (settings.minFlora !== undefined) minFlora.value = settings.minFlora;
  if (settings.minReferenceDamage !== undefined) minReferenceDamage.value = settings.minReferenceDamage;
  if (settings.minReferenceAdvantageDamage !== undefined) minReferenceAdvantageDamage.value = settings.minReferenceAdvantageDamage;
  if (settings.minReferenceVsHiDamage !== undefined) minReferenceVsHiDamage.value = settings.minReferenceVsHiDamage;
  if (settings.minReferenceVsMizuDamage !== undefined) minReferenceVsMizuDamage.value = settings.minReferenceVsMizuDamage;
  if (settings.minReferenceVsKiDamage !== undefined) minReferenceVsKiDamage.value = settings.minReferenceVsKiDamage;
  
  // その他の設定
  if (preset.attackNum !== undefined) attackNum.value = preset.attackNum;
  if (preset.allowSameCharacter !== undefined) allowSameCharacter.value = preset.allowSameCharacter;
}

// 全設定をデフォルト値にリセット
function resetAllSettings() {
  // 全ての設定を初期値にリセット
  minEHP.value = 30000;
  minHP.value = 30000;
  minHPBuddy.value = 0;
  minIncreasedHPBuddy.value = 0;
  minEvasion.value = 0;
  minDuo.value = 0;
  minBuff.value = 0;
  minDebuff.value = 0;
  minCosmic.value = 0;
  minFire.value = 0;
  minWater.value = 0;
  minFlora.value = 0;
  minHealNum.value = 0;
  minReferenceDamage.value = 0;
  minReferenceAdvantageDamage.value = 0;
  minReferenceVsHiDamage.value = 0;
  minReferenceVsMizuDamage.value = 0;
  minReferenceVsKiDamage.value = 0;
  maxResult.value = 10;
  attackNum.value = 10;
  allowSameCharacter.value = false;
  
  // ソートオプションをクリア
  sortOptions.value = [];
  
  // 必須キャラクターをクリア
  mustCharacters.value = [];
  
  // 選択されたプリセットをクリア
  selectedPreset.value = '';
}

function addSortOption() {
  sortOptions.value.push({ prop: '', order: t('settingModal.desc') });
}
function addCharacterOption() {
  mustCharacters.value.push({ prop: ''});
}
function removeSortOption(index: string | number) {
  sortOptions.value.splice(Number(index), 1);
}
function removeCharacterOption(index: string | number) {
  mustCharacters.value.splice(Number(index), 1);
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
  const convertedMustCharacters = mustCharacters.value
    .filter((mustCharacter: any) => mustCharacter.prop && mustCharacter.prop.trim() !== '')
    .map((mustCharacter: any) => {
      return enName2jpName[mustCharacter.prop] || mustCharacter.prop;
    });

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
  const normalizedMaxResult = toFiniteInt(rawMaxResult, 10, 0);
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

  searchSettingsStore.updateSearchSettings({
    minEHP: minEHP.value,
    minHP: minHP.value,
    minHPBuddy: minHPBuddy.value,
    minIncreasedHPBuddy: minIncreasedHPBuddy.value,
    minEvasion: minEvasion.value,
    minDuo: minDuo.value,
    minBuff: minBuff.value,
    minDebuff: minDebuff.value,
    minCosmic: minCosmic.value,
    minFire: minFire.value,
    minWater: minWater.value,
    minFlora: minFlora.value,
    minHealNum: minHealNum.value,
    minReferenceDamage: minReferenceDamage.value,
    minReferenceAdvantageDamage: minReferenceAdvantageDamage.value,
    minReferenceVsHiDamage: minReferenceVsHiDamage.value,
    minReferenceVsMizuDamage: minReferenceVsMizuDamage.value,
    minReferenceVsKiDamage: minReferenceVsKiDamage.value,
    sortOptions: convertedSortOptions,
    maxResult: normalizedMaxResult,
    attackNum: normalizedAttackNum,
    allowSameCharacter: allowSameCharacter.value,
    mustCharacters: mustCharacters.value,
    convertedMustCharacters: convertedMustCharacters,
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
}

.preset-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
  gap: 8px;
  margin-bottom: 8px;
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

.preset-actions {
  display: flex;
  align-items: center;
  justify-content: center;
  border-top: 1px solid #dee2e6;
  padding-top: 8px;
}

.preset-indicator {
  font-size: 0.9rem;
  color: #28a745;
  background-color: #d4edda;
  padding: 4px 8px;
  border-radius: 4px;
  border: 1px solid #c3e6cb;
}

</style>
