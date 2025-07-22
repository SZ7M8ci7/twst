<template>
  <v-app>
    <v-container>
      <v-data-table :headers="headers" :items="results" class="elevation-1" :items-per-page="-1" :mobile-breakpoint="0">
        <!-- カスタムコンテンツのスロットを使用 -->
        <template v-slot:item="{ item }">
          <tr>
            <td>{{ item.hp }}</td>
            <td style="position: relative;">
              <div class="css-fukidashi">
                <div class="text">{{ item.ehp }}</div>
                <div class="fukidashi">
                  <div>{{ $t('resultBody.healDetail') }}</div>
                  <div v-for="(detail, index) in item.detailList[0]" :key="index">
                    {{ index + 1 }}: {{ Math.round(detail) }}
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
                    {{ index + 1 }}: {{ Math.round(detail) }}
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
                    {{ index + 1 }}: {{ Math.round(detail) }}
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
                    {{ index + 1 }}: {{ Math.round(detail) }}
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
                    {{ index + 1 }}: {{ Math.round(detail) }}
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
                    {{ index + 1 }}: {{ Math.round(detail) }}
                  </div>
                </div>
              </div>
            </td>
            <!-- キャラ1～5の画像を表示 -->
            <td v-for="n in 5" :key="`chara${n}`">
              <v-img :src="item[`chara${n}`]" max-width="50" width="50" height="50" :class="{ 'black-border': n === 5 && allowSameCharacter }"></v-img>
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

const searchResultStore = useSearchResultStore();
const searchSettingsStore = useSearchSettingsStore();
const { results } = storeToRefs(searchResultStore);
const allowSameCharacter = computed(() => searchSettingsStore.allowSameCharacter);
import { useI18n } from 'vue-i18n';
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
function openInNewTab(url: string){
  // 現在のオリジンを使用して新しいシミュレータに遷移
  const baseUrl = window.location.origin;
  window.open(`${baseUrl}/twst/sim?restoreFromSearch=true${url}`, '_blank');
}
</script>

<style scoped>
.table-top {
  display: flex;
  align-items: center;
  gap: 10px;
  /* ボタンとの間隔を設定 */
}

.level-input {
  max-width: 80px;
  /* 最大横幅を80pxに設定 */
  min-width: 70px;
}

.v-data-table :deep(.v-data-table-footer) {
  display: none;
  /* NOTE: フッタを非表示にする為 */
}

.right-align {
  margin-left: auto;
  /* 左側の余白を自動で最大にして右寄せにする */
}

::v-deep .v-data-table td {
  padding: 1px 1px !important;
  text-align: center;
}

::v-deep .v-data-table__td,
::v-deep .v-data-table-column--align-start,
::v-deep .v-data-table__th {
  padding: 1px 1px !important;
}

::v-deep .v-data-table thead tr th {
  text-align: center !important;
  justify-content: center !important;
}

::v-deep .v-data-table thead tr th .v-data-table-header__content {
  justify-content: center !important;
  text-align: center !important;
}

::v-deep .v-data-table tr td:nth-child(odd),
::v-deep .v-data-table thead tr th:nth-child(odd) {
  background-color: rgba(0, 0, 0, 0.05);
}

::v-deep .v-data-table tr td:nth-child(even),
::v-deep .v-data-table thead tr th:nth-child(even) {
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
.black-border {
  border: 2px solid black;
  border-radius: 4px;
  box-sizing: border-box;
}
</style>
