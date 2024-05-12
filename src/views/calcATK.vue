<template>
  <v-container>
    <v-row>
      <v-col cols="1" />
      <v-col cols="11">
        <v-row align="center">
          <v-col cols="3" class="pa-1 text-center">
              <span class="ma-1">{{ $t('attack.difficulty') }}</span>
          </v-col>
          <v-col cols="9" class="pa-1">
            <v-radio-group v-model="difficulty" hide-details inline>
              <v-radio label="Easy" value=0.8></v-radio>
              <v-radio label="Normal" value=1></v-radio>
              <v-radio label="Hard" value=1.2></v-radio>
              <v-radio label="Extra" :value=1.5 checked></v-radio>
            </v-radio-group>
          </v-col>
        </v-row>
        <v-row align="center">
            <v-col cols="3" class="pa-1 text-center">
              <span class="ma-1 align-center pa-0">{{ $t('attack.enemyHP') }}</span>
            </v-col>
            <v-col cols="9" class="pa-1">
              <v-text-field type="number" v-model="enemyHP" class="mt-0 pt-0" hide-details="auto" dense solo :min="0" />
            </v-col>
        </v-row>
        <v-row align="center">
            <v-col cols="3" class="pa-1 text-center">
              <span class="ma-1 ">{{ $t('attack.totalDamageDealt') }}</span>
            </v-col>
            <v-col cols="9" class="pa-1">
              <v-text-field type="number" v-model="damage" class="mt-0 pt-0" hide-details="auto" dense solo
                :min="enemyHP" />
            </v-col>
        </v-row>
        <v-row align="center">
            <v-col cols="3" class="pa-1 text-center">
              <span class="ma-1">{{ $t('attack.buff') }}</span>
            </v-col>
            <v-col cols="9" class="pa-1">
              <v-text-field type="number" v-model="buff" class="mt-0 pt-0" hide-details="auto" dense solo :min="0" />
            </v-col>
        </v-row>
        <v-row align="center">
            <v-col cols="3" class="pa-1 text-center">
              <span class="ma-1">{{ $t('attack.nullifingHPRestoration') }}
                <span class="mdi mdi-help-circle-outline">
                  <v-tooltip activator="parent" open-on-click>{{ $t('attack.maxNum') }}</v-tooltip>
                </span>
              </span>
            </v-col>
            <v-col cols="9" class="pa-1">
              <v-text-field type="number" v-model="blockHeal" class="mt-0 pt-0" hide-details="auto" dense solo :min="0"
                :max="1" />
            </v-col>
        </v-row>
        <v-row>
          <v-col class="pa-1">
            <v-table>
              <thead>
                <tr>
                  <th></th>
                  <th class="pa-1">{{ $t('attack.advantage') }}</th>
                  <th class="pa-1">{{ $t('attack.neutral') }}</th>
                  <th class="pa-1">{{ $t('attack.disadvantage') }}</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <th class="text-nowrap wide-cell">{{ $t('attack.numberOfMultihit') }}
                    <span class="mdi mdi-help-circle-outline">

                      <v-tooltip style="white-space: nowrap;" activator="parent"
                        open-on-click>{{ $t('attack.attackDetail') }}</v-tooltip>
                    </span>
                  </th>
                  <td class="pa-1"><v-text-field type="number" v-model="table.advantageCombo" hide-details dense solo />
                  </td>
                  <td class="pa-1"><v-text-field type="number" v-model="table.equalCombo" hide-details dense solo />
                  </td>
                  <td class="pa-1"><v-text-field type="number" v-model="table.disadvantageCombo" hide-details dense
                      solo /></td>
                </tr>
                <tr>
                  <th class="text-nowrap">{{ $t('attack.numberOfSingleHit') }}</th>
                  <td class="pa-1"><v-text-field type="number" v-model="table.advantageSingle" hide-details dense
                      solo /></td>
                  <td class="pa-1"><v-text-field type="number" v-model="table.equalSingle" hide-details dense solo />
                  </td>
                  <td class="pa-1"><v-text-field type="number" v-model="table.disadvantageSingle" hide-details dense
                      solo /></td>
                </tr>
              </tbody>

            </v-table>
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

</style>