<template>
  <v-container class="pa-2">
    <v-row class="ma-0">
      <v-col cols="12" class="pa-0">
        <v-row align="center" class="ma-0">
          <v-col cols="4" sm="3" class="pa-0 pr-1 text-right">
              <span class="field-label">{{ $t('attack.difficulty') }}</span>
          </v-col>
          <v-col cols="8" sm="9" class="pa-0">
            <v-select
              v-model="difficulty"
              :items="difficultyOptions"
              item-title="text"
              item-value="value"
              hide-details
              dense
              solo
            ></v-select>
          </v-col>
        </v-row>
        <v-row align="center" class="ma-0">
            <v-col cols="4" sm="3" class="pa-0 pr-1 text-right">
              <span class="field-label">{{ $t('attack.enemyHP') }}</span>
            </v-col>
            <v-col cols="8" sm="9" class="pa-0">
              <v-text-field type="number" v-model="enemyHP" class="mt-0 pt-0" hide-details="auto" dense solo :min="0" />
            </v-col>
        </v-row>
        <v-row align="center" class="ma-0">
            <v-col cols="4" sm="3" class="pa-0 pr-1 text-right">
              <span class="field-label">{{ $t('attack.totalDamageDealt') }}</span>
            </v-col>
            <v-col cols="8" sm="9" class="pa-0">
              <v-text-field type="number" v-model="damage" class="mt-0 pt-0" hide-details="auto" dense solo
                :min="enemyHP" />
            </v-col>
        </v-row>
        <v-row align="center" class="ma-0">
            <v-col cols="4" sm="3" class="pa-0 pr-1 text-right">
              <span class="field-label">{{ $t('attack.buff') }}</span>
            </v-col>
            <v-col cols="8" sm="9" class="pa-0">
              <v-text-field type="number" v-model="buff" class="mt-0 pt-0" hide-details="auto" dense solo :min="0" />
            </v-col>
        </v-row>
        <v-row align="center" class="ma-0">
            <v-col cols="4" sm="3" class="pa-0 pr-1 text-right">
              <span class="field-label">{{ $t('attack.nullifingHPRestoration') }}
                <span class="mdi mdi-help-circle-outline">
                  <v-tooltip activator="parent" open-on-click>{{ $t('attack.maxNum') }}</v-tooltip>
                </span>
              </span>
            </v-col>
            <v-col cols="8" sm="9" class="pa-0">
              <v-text-field type="number" v-model="blockHeal" class="mt-0 pt-0" hide-details="auto" dense solo :min="0"
                :max="1" />
            </v-col>
        </v-row>
        <v-row class="ma-0">
          <v-col class="pa-0">
            <div class="table-wrapper">
              <v-table>
                <thead>
                  <tr>
                    <th></th>
                    <th class="pa-0">{{ $t('attack.advantage') }}</th>
                    <th class="pa-0">{{ $t('attack.neutral') }}</th>
                    <th class="pa-0">{{ $t('attack.disadvantage') }}</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <th class="text-nowrap wide-cell pa-0">{{ $t('attack.numberOfMultihit') }}
                      <span class="mdi mdi-help-circle-outline">

                        <v-tooltip style="white-space: nowrap;" activator="parent"
                          open-on-click>{{ $t('attack.attackDetail') }}</v-tooltip>
                      </span>
                    </th>
                    <td class="pa-0"><v-text-field type="number" v-model="table.advantageCombo" hide-details dense solo />
                    </td>
                    <td class="pa-0"><v-text-field type="number" v-model="table.equalCombo" hide-details dense solo />
                    </td>
                    <td class="pa-0"><v-text-field type="number" v-model="table.disadvantageCombo" hide-details dense
                        solo /></td>
                  </tr>
                  <tr>
                    <th class="text-nowrap pa-0">{{ $t('attack.numberOfSingleHit') }}</th>
                    <td class="pa-0"><v-text-field type="number" v-model="table.advantageSingle" hide-details dense
                        solo /></td>
                    <td class="pa-0"><v-text-field type="number" v-model="table.equalSingle" hide-details dense solo />
                    </td>
                    <td class="pa-0"><v-text-field type="number" v-model="table.disadvantageSingle" hide-details dense
                        solo /></td>
                  </tr>
                </tbody>

              </v-table>
            </div>
          </v-col>
        </v-row>

        <DoughnutGraph :data="data" :scores="scores" :score="score"/>
      </v-col>
    </v-row>
  </v-container>
</template>
<script setup lang="ts">
import { computed, ref } from 'vue';
import { Chart, registerables } from 'chart.js';
import DoughnutGraph from '@/components/DoughnutGraph.vue';
import { useI18n } from 'vue-i18n';
Chart.register(...registerables);

const { t } = useI18n();
const enemyHP = ref(0);
const damage = ref(0);
const buff = ref(0);
const blockHeal = ref(0);
const difficulty = ref(1.5);
const difficultyOptions = [
  { text: 'Easy', value: 0.8 },
  { text: 'Normal', value: 1 },
  { text: 'Hard', value: 1.2 },
  { text: 'Extra', value: 1.5 }
];
const table = ref({
  advantageCombo: 0,
  equalCombo: 0,
  disadvantageCombo: 0,
  advantageSingle: 0,
  equalSingle: 0,
  disadvantageSingle: 0,
});
const totalTable = computed(() =>
  Number(table.value.advantageCombo) +
  Number(table.value.equalCombo) +
  Number(table.value.disadvantageCombo) +
  Number(table.value.advantageSingle) +
  Number(table.value.equalSingle) +
  Number(table.value.disadvantageSingle)
);
const damageScore = computed(() => Number((damage.value / 208).toFixed(0)));
const buffScore = computed(() => buff.value * 120);
const blockHealScore = computed(() => blockHeal.value * 180);
const advantageComboScore = computed(() => table.value.advantageCombo * 210);
const equalComboScore = computed(() => table.value.equalCombo * 180);
const disadvantageComboScore = computed(() => table.value.disadvantageCombo * 150);
const advantageSingleScore = computed(() => table.value.advantageSingle * 150);
const equalSingleScore = computed(() => table.value.equalSingle * 120);
const disadvantageSingleScore = computed(() => table.value.disadvantageSingle * 90);
const basicScore = computed(() => 11036 + enemyHP.value * 0.080471);
const moveMinusScore = computed(() => 641.2 + enemyHP.value * 0.002048);
const baseScore = computed(() =>
  basicScore.value
  - moveMinusScore.value * totalTable.value
  + damageScore.value
  + buffScore.value
  + blockHealScore.value
  + advantageComboScore.value
  + equalComboScore.value
  + disadvantageComboScore.value
  + advantageSingleScore.value
  + equalSingleScore.value
  + disadvantageSingleScore.value);
const score = computed(() => (baseScore.value * difficulty.value).toFixed())
const colors = [
  '#FAD9C8', // 行動回数
  '#FAF2C8', // 有利連撃
  '#E9FAC8', // ダメージ
  '#D0FAC8', // 回復阻害
  '#C8FAD9', // 等倍連撃
  '#C8FAF2', // バフ
  '#C8E9FA', // 有利単発
  '#C8D0FA', // 不利連撃
  '#D9C8FA', // 等倍単発
  '#F2C8FA', // 不利単発
];
const scores = computed(() => [
  { label: t('attack.numberOfActions'), value: Number(((basicScore.value - moveMinusScore.value * totalTable.value) * difficulty.value).toFixed()), color: colors[0] },
  { label: t('attack.numberOfAdvantage2'), value: advantageComboScore.value * difficulty.value, color: colors[1] },
  { label: t('attack.damage'), value: damageScore.value * difficulty.value, color: colors[2] },
  { label: t('attack.nullifingHPRestoration'), value: blockHealScore.value * difficulty.value, color: colors[3] },
  { label: t('attack.numberOfDisadvantage2'), value: equalComboScore.value * difficulty.value, color: colors[4] },
  { label: t('attack.buff'), value: buffScore.value * difficulty.value, color: colors[5] },
  { label: t('attack.numberOfAdvantage1'), value: advantageSingleScore.value * difficulty.value, color: colors[6] },
  { label: t('attack.numberOfNeutral2'), value: disadvantageComboScore.value * difficulty.value, color: colors[7] },
  { label: t('attack.numberOfDisadvantage1'), value: equalSingleScore.value * difficulty.value, color: colors[8] },
  { label: t('attack.numberOfNeutral1'), value: disadvantageSingleScore.value * difficulty.value, color: colors[9] },
].sort((a, b) => b.value - a.value));
// チャート用のデータ
const data = computed(() => {
  return {
    labels: scores.value.map(score => score.label),
    datasets: [{
      data: scores.value.map(score => score.value),
      backgroundColor: scores.value.map(score => score.color),
    }]
  };
});


</script>
<style scoped>

.no-break {
  white-space: nowrap;
}

.wide-cell {
  width: 100px;
}

.table-wrapper {
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
}

.field-label {
  font-size: 0.875rem;
  font-weight: 500;
}

/* Vuetify 3 入力フィールドの余白削除 */
:deep(.v-field) {
  margin: 0 !important;
  padding: 0 !important;
}

:deep(.v-field__field) {
  padding: 4px 8px !important;
  min-height: 36px !important;
}

:deep(.v-field__input) {
  padding: 0 !important;
  min-height: 32px !important;
}

:deep(.v-field--variant-solo) {
  box-shadow: none !important;
}

:deep(.v-input) {
  grid-template-rows: min-content 0 !important;
}

:deep(.v-input__details) {
  display: none !important;
  min-height: 0 !important;
  padding: 0 !important;
  margin: 0 !important;
}

:deep(.v-field__clearable) {
  margin: 0 !important;
}

:deep(.v-field__append-inner) {
  padding: 0 !important;
}

:deep(.v-field__prepend-inner) {
  padding: 0 !important;
}

/* セレクトボックスの調整 */
:deep(.v-select .v-field__input) {
  padding: 0 !important;
}

:deep(.v-select .v-field__field) {
  padding: 0 8px !important;
}

/* テーブル内の入力フィールドも調整 */
:deep(.v-table .v-field) {
  margin: 0 !important;
}

:deep(.v-table .v-input) {
  margin: 0 !important;
}

/* 行間の余白を最小化 */
.v-row + .v-row {
  margin-top: 8px !important;
}

@media (max-width: 600px) {
  .v-table th,
  .v-table td {
    padding: 2px !important;
    font-size: 0.875rem;
  }
  
  .v-text-field input {
    font-size: 0.875rem;
  }
  
  .wide-cell {
    width: 80px;
  }
  
  .field-label {
    font-size: 0.75rem;
  }
  
  :deep(.v-field__field) {
    padding: 2px 6px !important;
    min-height: 32px !important;
  }
  
  :deep(.v-field__input) {
    min-height: 28px !important;
  }
  
  /* 行間の余白も削除 */
  .v-row + .v-row {
    margin-top: 6px !important;
  }
}

</style>