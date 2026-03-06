<template>
  <v-app>
    <v-container>
      <v-data-table
        :headers="headers"
        :items="results"
        item-value="simuURL"
        class="elevation-1"
        :items-per-page="-1"
        :mobile-breakpoint="0"
      >
        <template v-slot:item="{ item }">
          <tr :key="item.simuURL">
            <td>{{ item.hp }}</td>
            <td style="position: relative;">
              <div class="css-fukidashi">
                <div class="text">{{ item.ehp }}</div>
                <div class="fukidashi">
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
              <div class="css-fukidashi">
                <div class="text">{{ item.referenceDamage }}</div>
                <div class="fukidashi">
                  <div>{{ $t('resultBody.damageDetail') }}</div>
                  <div v-for="(detail, index) in item.detailList[1]" :key="index">
                    {{ toDisplayIndex(index) }}: {{ Math.round(detail) }}
                  </div>
                </div>
              </div>
            </td>
            <td style="position: relative;">
              <div class="css-fukidashi">
                <div class="text">{{ item.referenceAdvantageDamage }}</div>
                <div class="fukidashi">
                  <div>{{ $t('resultBody.damageDetail') }}</div>
                  <div v-for="(detail, index) in item.detailList[2]" :key="index">
                    {{ toDisplayIndex(index) }}: {{ Math.round(detail) }}
                  </div>
                </div>
              </div>
            </td>
            <td style="position: relative;">
              <div class="css-fukidashi">
                <div class="text">{{ item.referenceVsHiDamage }}</div>
                <div class="fukidashi">
                  <div>{{ $t('resultBody.damageDetail') }}</div>
                  <div v-for="(detail, index) in item.detailList[3]" :key="index">
                    {{ toDisplayIndex(index) }}: {{ Math.round(detail) }}
                  </div>
                </div>
              </div>
            </td>
            <td style="position: relative;">
              <div class="css-fukidashi">
                <div class="text">{{ item.referenceVsMizuDamage }}</div>
                <div class="fukidashi">
                  <div>{{ $t('resultBody.damageDetail') }}</div>
                  <div v-for="(detail, index) in item.detailList[4]" :key="index">
                    {{ toDisplayIndex(index) }}: {{ Math.round(detail) }}
                  </div>
                </div>
              </div>
            </td>
            <td style="position: relative;">
              <div class="css-fukidashi">
                <div class="text">{{ item.referenceVsKiDamage }}</div>
                <div class="fukidashi">
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
                <v-img
                  :src="item[`chara${n}`]"
                  max-width="50"
                  width="50"
                  height="50"
                  :class="['result-icon-image', { 'black-border': n === 5 && allowSameCharacter }]"
                ></v-img>
              </button>
            </td>
            <td><v-btn variant="text" v-on:click="openInNewTab(item.simuURL)" icon="mdi-open-in-new" size="x-small"></v-btn></td>
          </tr>
        </template>
      </v-data-table>
    </v-container>
  </v-app>
</template>

<script setup lang="ts">
import { useSearchResultStore } from '@/store/searchResult';
import { storeToRefs } from 'pinia';
import { computed } from 'vue';
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

function extractCharacterName(url: string, slot: number): string | null {
  const params = new URLSearchParams(url.startsWith('&') ? url.slice(1) : url);
  return params.get(`name${slot}`);
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
  display: none;
}

.right-align {
  margin-left: auto;
}

:deep(.v-data-table td) {
  padding: 1px 1px !important;
  text-align: center;
}

:deep(.v-data-table__td),
:deep(.v-data-table-column--align-start),
:deep(.v-data-table__th) {
  padding: 1px 1px !important;
}

:deep(.v-data-table thead tr th) {
  text-align: center !important;
  justify-content: center !important;
}

:deep(.v-data-table thead tr th .v-data-table-header__content) {
  justify-content: center !important;
  text-align: center !important;
}

:deep(.v-data-table tr td:nth-child(odd)),
:deep(.v-data-table thead tr th:nth-child(odd)) {
  background-color: rgba(0, 0, 0, 0.05);
}

:deep(.v-data-table tr td:nth-child(even)),
:deep(.v-data-table thead tr th:nth-child(even)) {
  background-color: rgba(0, 0, 0, 0.02);
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
  display: none;
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

.text:hover + .fukidashi {
  display: block;
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
  cursor: pointer;
}

.black-border {
  border: 2px solid black;
  border-radius: 4px;
  box-sizing: border-box;
}
</style>