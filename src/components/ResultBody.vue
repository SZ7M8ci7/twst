<template>
  <div class="result-table-wrapper">
    <table class="result-table">
      <thead>
        <tr>
          <th v-for="header in headers" :key="header.value">
            {{ header.title }}
          </th>
        </tr>
      </thead>
      <tbody>
        <template v-for="item in results" :key="item.simuURL">
          <tr>
            <td>{{ item.hp }}</td>
            <td style="position: relative;">
              <div
                class="css-fukidashi"
                @mouseenter="hoveredDetailKey = item.simuURL + ':ehp'"
                @mouseleave="hoveredDetailKey = ''"
              >
                <div class="text">{{ item.ehp }}</div>
                <div v-if="hoveredDetailKey === item.simuURL + ':ehp'" class="fukidashi">
                  <div>{{ $t('resultBody.healDetail') }}</div>
                  <div v-for="(detail, index) in item.detailList[0]" :key="index">
                    {{ toDisplayIndex(index) }}: {{ Math.round(detail) }}
                  </div>
                </div>
              </div>
            </td>
            <td>{{ item.evasion }}</td>
            <td>{{ item.healNum }}</td>
            <td>{{ item.hpBuddy }}</td>
            <td>{{ item.increasedHpBuddy }}</td>
            <td>{{ item.buddy }}</td>
            <td>{{ item.noHpBuddy }}</td>
            <td>{{ item.duo }}</td>
            <td>{{ item.buff }}</td>
            <td>{{ item.debuff }}</td>
            <td>{{ item.maxCosmic }}</td>
            <td>{{ item.maxFire }}</td>
            <td>{{ item.maxWater }}</td>
            <td>{{ item.maxFlora }}</td>
            <td style="position: relative;">
              <div
                class="css-fukidashi"
                @mouseenter="hoveredDetailKey = item.simuURL + ':referenceDamage'"
                @mouseleave="hoveredDetailKey = ''"
              >
                <div class="text">{{ item.referenceDamage }}</div>
                <div v-if="hoveredDetailKey === item.simuURL + ':referenceDamage'" class="fukidashi">
                  <div>{{ $t('resultBody.damageDetail') }}</div>
                  <div v-for="(detail, index) in item.detailList[1]" :key="index">
                    {{ toDisplayIndex(index) }}: {{ Math.round(detail) }}
                  </div>
                </div>
              </div>
            </td>
            <td style="position: relative;">
              <div
                class="css-fukidashi"
                @mouseenter="hoveredDetailKey = item.simuURL + ':referenceAdvantageDamage'"
                @mouseleave="hoveredDetailKey = ''"
              >
                <div class="text">{{ item.referenceAdvantageDamage }}</div>
                <div v-if="hoveredDetailKey === item.simuURL + ':referenceAdvantageDamage'" class="fukidashi">
                  <div>{{ $t('resultBody.damageDetail') }}</div>
                  <div v-for="(detail, index) in item.detailList[2]" :key="index">
                    {{ toDisplayIndex(index) }}: {{ Math.round(detail) }}
                  </div>
                </div>
              </div>
            </td>
            <td style="position: relative;">
              <div
                class="css-fukidashi"
                @mouseenter="hoveredDetailKey = item.simuURL + ':referenceVsHiDamage'"
                @mouseleave="hoveredDetailKey = ''"
              >
                <div class="text">{{ item.referenceVsHiDamage }}</div>
                <div v-if="hoveredDetailKey === item.simuURL + ':referenceVsHiDamage'" class="fukidashi">
                  <div>{{ $t('resultBody.damageDetail') }}</div>
                  <div v-for="(detail, index) in item.detailList[3]" :key="index">
                    {{ toDisplayIndex(index) }}: {{ Math.round(detail) }}
                  </div>
                </div>
              </div>
            </td>
            <td style="position: relative;">
              <div
                class="css-fukidashi"
                @mouseenter="hoveredDetailKey = item.simuURL + ':referenceVsMizuDamage'"
                @mouseleave="hoveredDetailKey = ''"
              >
                <div class="text">{{ item.referenceVsMizuDamage }}</div>
                <div v-if="hoveredDetailKey === item.simuURL + ':referenceVsMizuDamage'" class="fukidashi">
                  <div>{{ $t('resultBody.damageDetail') }}</div>
                  <div v-for="(detail, index) in item.detailList[4]" :key="index">
                    {{ toDisplayIndex(index) }}: {{ Math.round(detail) }}
                  </div>
                </div>
              </div>
            </td>
            <td style="position: relative;">
              <div
                class="css-fukidashi"
                @mouseenter="hoveredDetailKey = item.simuURL + ':referenceVsKiDamage'"
                @mouseleave="hoveredDetailKey = ''"
              >
                <div class="text">{{ item.referenceVsKiDamage }}</div>
                <div v-if="hoveredDetailKey === item.simuURL + ':referenceVsKiDamage'" class="fukidashi">
                  <div>{{ $t('resultBody.damageDetail') }}</div>
                  <div v-for="(detail, index) in item.detailList[5]" :key="index">
                    {{ toDisplayIndex(index) }}: {{ Math.round(detail) }}
                  </div>
                </div>
              </div>
            </td>
            <td v-for="n in 5" :key="`chara${n}`">
              <button
                type="button"
                class="result-icon-button"
                :aria-label="extractCharacterName(item.simuURL, n) || undefined"
                @click="focusCharacterSetting(item.simuURL, n)"
              >
                <img
                  :src="item[`chara${n}`]"
                  width="50"
                  height="50"
                  loading="lazy"
                  decoding="async"
                  :class="['result-icon-image', { 'black-border': n === 5 && allowSameCharacter }]"
                  alt=""
                >
              </button>
            </td>
            <td>
              <button
                type="button"
                class="sim-open-button"
                aria-label="Open SIM"
                @click="openInNewTab(item.simuURL)"
              >
                SIM
              </button>
            </td>
          </tr>
        </template>
      </tbody>
    </table>
  </div>
</template>

<script setup lang="ts">
import { useSearchResultStore } from '@/store/searchResult';
import { storeToRefs } from 'pinia';
import { computed, ref, watch } from 'vue';
import { useSearchSettingsStore } from '@/store/searchSetting';
import { useI18n } from 'vue-i18n';

const emit = defineEmits<{
  (e: 'focus-character-setting', payload: { characterName: string; targetTab: 'search' | 'support' }): void;
}>();

const searchResultStore = useSearchResultStore();
const searchSettingsStore = useSearchSettingsStore();
const { results } = storeToRefs(searchResultStore);
const allowSameCharacter = computed(() => searchSettingsStore.allowSameCharacter);
const { t } = useI18n();
const hoveredDetailKey = ref('');
const characterNameCache = new Map<string, Array<string | null>>();

type DataTableHeader = {
  title: string;
  value: string;
  align?: 'start' | 'center' | 'end';
  sortable?: boolean;
  filterable?: boolean;
  groupable?: boolean;
  divider?: boolean;
  class?: string | string[];
  cellClass?: string | string[];
  width?: string | number;
  filter?: (value: any, search: string, item: any) => boolean;
  sort?: (a: any, b: any) => number;
}

const fifthColumnTitle = computed(() => allowSameCharacter.value ? 'Sup' : '5');

const headers = computed<DataTableHeader[]>(() => [
  { title: t('resultBody.HP'), value: 'hp', sortable: false },
  { title: t('resultBody.effectiveHP'), value: 'ehp', sortable: false },
  { title: t('resultBody.evasion'), value: 'evasion', sortable: false },
  { title: t('resultBody.healNum'), value: 'healNum', sortable: false },
  { title: t('resultBody.HPBuddy'), value: 'hpBuddy', sortable: false },
  { title: t('resultBody.increasedHPBuddy'), value: 'increasedHpBuddy', sortable: false },
  { title: t('resultBody.buddy'), value: 'buddy', sortable: false },
  { title: t('resultBody.noHPBuddy'), value: 'noHPBuddy', sortable: false },
  { title: t('resultBody.duo'), value: 'duo', sortable: false },
  { title: t('resultBody.buff'), value: 'buff', sortable: false },
  { title: t('resultBody.debuff'), value: 'debuff', sortable: false },
  { title: t('resultBody.maxCosmic'), value: 'maxCosmic', sortable: false },
  { title: t('resultBody.maxFire'), value: 'maxFire', sortable: false },
  { title: t('resultBody.maxWater'), value: 'maxWater', sortable: false },
  { title: t('resultBody.maxFlora'), value: 'maxFlora', sortable: false },
  { title: t('resultBody.neutralDamage'), value: 'referenceDamage', sortable: false },
  { title: t('resultBody.advantageDamage'), value: 'referenceAdvantageDamage', sortable: false },
  { title: t('resultBody.damageAgainstFire'), value: 'referenceVsHiDamage', sortable: false },
  { title: t('resultBody.damageAgainstWater'), value: 'referenceVsMizuDamage', sortable: false },
  { title: t('resultBody.damageAgainstFlora'), value: 'referenceVsKiDamage', sortable: false },
  { title: '1', value: 'chara1', sortable: false },
  { title: '2', value: 'chara2', sortable: false },
  { title: '3', value: 'chara3', sortable: false },
  { title: '4', value: 'chara4', sortable: false },
  { title: fifthColumnTitle.value, value: 'chara5', sortable: false },
  { title: 'SIM', value: 'simuURL', sortable: false },
]);

watch(results, () => {
  characterNameCache.clear();
});

function getCharacterNames(url: string): Array<string | null> {
  const cached = characterNameCache.get(url);
  if (cached) return cached;
  const params = new URLSearchParams(url.startsWith('&') ? url.slice(1) : url);
  const names = [
    params.get('name1'),
    params.get('name2'),
    params.get('name3'),
    params.get('name4'),
    params.get('name5'),
  ];
  characterNameCache.set(url, names);
  return names;
}

function extractCharacterName(url: string, slot: number): string | null {
  return getCharacterNames(url)[slot - 1] ?? null;
}

function focusCharacterSetting(url: string, slot: number) {
  const characterName = extractCharacterName(url, slot);
  if (!characterName) return;

  emit('focus-character-setting', {
    characterName,
    targetTab: allowSameCharacter.value && slot === 5 ? 'support' : 'search',
  });
}

function openInNewTab(url: string){
  const baseUrl = window.location.origin;
  window.open(`${baseUrl}/twst/sim?restoreFromSearch=true${url}`, '_blank');
}

function toDisplayIndex(index: string | number): number {
  return Number(index) + 1;
}
</script>

<style scoped>
.result-table-wrapper {
  width: 100%;
  overflow-x: auto;
}

.result-table {
  width: max-content;
  min-width: 100%;
  border-collapse: collapse;
  font-size: 0.875rem;
}

.result-table th,
.result-table td {
  padding: 1px 4px;
  text-align: center;
  white-space: nowrap;
  border-bottom: 1px solid rgba(0, 0, 0, 0.08);
}

.result-table th {
  font-weight: 600;
  background-color: #f5f5f5;
}

.result-table td:nth-child(odd),
.result-table th:nth-child(odd) {
  background-color: rgba(0, 0, 0, 0.05);
}

.result-table td:nth-child(even),
.result-table th:nth-child(even) {
  background-color: rgba(0, 0, 0, 0.02);
}

.result-table tbody tr {
  content-visibility: auto;
  contain-intrinsic-size: 54px;
}

.css-fukidashi {
  padding: 0;
  margin: 0;
  position: relative;
}

.text {
  display: inline-block;
  position: relative;
  z-index: 1;
}

.fukidashi {
  position: absolute;
  top: 100%;
  left: 50%;
  transform: translate(30%, -50%);
  margin-top: 5px;
  padding: 5px;
  border-radius: 5px;
  background: #c9c9c9;
  color: #fff;
  font-weight: bold;
  white-space: nowrap;
  z-index: 2;
}

.result-icon-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 50px;
  padding: 0;
  border: 0;
  background: transparent;
  cursor: pointer;
}

.result-icon-button:focus-visible {
  outline: 2px solid #1976d2;
  outline-offset: 2px;
}

.result-icon-image {
  display: block;
  width: 50px;
  height: 50px;
  object-fit: cover;
  cursor: pointer;
}

.sim-open-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 40px;
  min-height: 28px;
  padding: 0 8px;
  border: 1px solid rgba(0, 0, 0, 0.2);
  border-radius: 4px;
  background: #fff;
  color: #333;
  cursor: pointer;
  font-size: 0.75rem;
}

.sim-open-button:focus-visible {
  outline: 2px solid #1976d2;
  outline-offset: 2px;
}

.black-border {
  border: 2px solid black;
  border-radius: 4px;
  box-sizing: border-box;
}
</style>
