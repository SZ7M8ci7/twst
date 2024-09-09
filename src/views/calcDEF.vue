<template>
  <v-container>
    <v-row>
      <v-col cols="1" />
      <v-col cols="11">
        <v-row align="center">
          <v-col cols="3" class="pa-1 text-center">
              <span class="ma-1">{{ $t('deffence.difficulty') }}</span>
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
              <span class="ma-1 align-center pa-0">{{ $t('deffence.finishTurn') }}</span>
            </v-col>
            <v-col cols="9" class="pa-1">
              <v-text-field type="number" v-model="turn" class="mt-0 pt-0" hide-details="auto" dense solo :min="1" :max="5" />
            </v-col>
        </v-row>
        <v-row align="center">
            <v-col cols="3" class="pa-1 text-center">
              <span class="ma-1 align-center pa-0">{{ $t('deffence.totalAllyHP') }}</span>
            </v-col>
            <v-col cols="9" class="pa-1">
              <v-text-field type="number" v-model="allyTotalHP" class="mt-0 pt-0" hide-details="auto" dense solo :min="0" />
            </v-col>
        </v-row>
        <v-row align="center">
            <v-col cols="3" class="pa-1 text-center">
              <span class="ma-1 align-center pa-0">{{ $t('deffence.remainAllyHP') }}</span>
            </v-col>
            <v-col cols="9" class="pa-1">
              <v-text-field type="number" v-model="allyRemainHP" class="mt-0 pt-0" hide-details="auto" dense solo :min="0" />
            </v-col>
        </v-row>
        <v-row align="center">
            <v-col cols="3" class="pa-1 text-center">
              <span class="ma-1 ">{{ $t('deffence.totalDamageDealt') }}</span>
            </v-col>
            <v-col cols="9" class="pa-1">
              <v-text-field type="number" v-model="damage" class="mt-0 pt-0" hide-details="auto" dense solo
                :min="0" />
            </v-col>
        </v-row>
        <v-row align="center">
            <v-col cols="3" class="pa-1 text-center">
              <span class="ma-1">{{ $t('deffence.numberOfEvasion') }}
                <span class="mdi mdi-help-circle-outline">
                  <v-tooltip activator="parent" open-on-click>{{ $t('deffence.countIf') }}</v-tooltip>
                </span>
              </span>
            </v-col>
            <v-col cols="9" class="pa-1">
              <v-text-field type="number" v-model="evasion" class="mt-0 pt-0" hide-details="auto" dense solo :min="0" />
            </v-col>
        </v-row>
        <v-row align="center">
            <v-col cols="3" class="pa-1 text-center">
              <span class="ma-1">{{ $t('deffence.numberOfDebuff') }}</span>
            </v-col>
            <v-col cols="9" class="pa-1">
              <v-text-field type="number" v-model="debuff" class="mt-0 pt-0" hide-details="auto" dense solo :min="0" />
            </v-col>
        </v-row>
        <v-row>
          <v-col class="pa-1">
            <v-table>
              <thead>
                <tr>
                  <th></th>
                  <th class="pa-1">{{ $t('deffence.advantageDamageTaken') }}</th>
                  <th class="pa-1">{{ $t('deffence.disadvantageDamageTaken') }}</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <th class="text-nowrap wide-cell">{{ $t('deffence.damageTaken') }}</th>
                  <td class="pa-1"><v-text-field type="number" v-model="table.advantageDamaged" hide-details dense solo />
                  </td>
                  <td class="pa-1"><v-text-field type="number" v-model="table.disadvantageDamaged" hide-details dense
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
const turn = ref(5);
const turns = [0.8,0.85,0.9,0.95,1]
const allyTotalHP = ref(0);
const allyRemainHP = ref(0);
const damage = ref(0);
const evasion = ref(0);
const debuff = ref(0);
const difficulty = ref(1.5);
const table = ref({
  advantageDamaged: 0,
  disadvantageDamaged: 0,
});
const allyRemainHPScore = computed(() => allyRemainHP.value * 0.1275);
const allyTotalHPScore = computed(() => Number(allyTotalHP.value) * 0.0625);
const damageScore = computed(() => Number(damage.value * 0.05));
const advantageDamagedScore = computed(() => table.value.advantageDamaged * 2 * 0.05208);
const disadvantageDamagedScore = computed(() => -table.value.disadvantageDamaged / 1.5 * 0.05208);
const evasionScore = computed(() => evasion.value * 600);
const debuffScore = computed(() => debuff.value * 300);
const baseScore = computed(() =>
   allyRemainHPScore.value
  + allyTotalHPScore.value
  + damageScore.value
  + advantageDamagedScore.value
  + disadvantageDamagedScore.value
  + evasionScore.value
  + debuffScore.value);
const score = computed(() => (baseScore.value * difficulty.value * turns[turn.value-1]).toFixed())
const colors = [
  '#FAD9C8',
  '#FAF2C8',
  '#E9FAC8',
  '#D0FAC8',
  '#C8FAD9',
  '#C8FAF2',
  '#C8E9FA',
  '#C8D0FA',
  '#D9C8FA',
  '#F2C8FA',
];
const scores = computed(() => [
  { label: t('deffence.remainHP'), value: Math.floor(allyRemainHPScore.value * difficulty.value * turns[turn.value-1]), color: colors[0] },
  { label: t('deffence.totalHP'), value: Math.floor(allyTotalHPScore.value * difficulty.value * turns[turn.value-1]), color: colors[1] },
  { label: t('deffence.damage'), value: Math.floor(damageScore.value * difficulty.value * turns[turn.value-1]), color: colors[2] },
  { label: t('deffence.advantageDamageTaken'), value: Math.floor(advantageDamagedScore.value * difficulty.value * turns[turn.value-1]), color: colors[3] },
  { label: t('deffence.disadvantageDamageTaken'), value: Math.floor(disadvantageDamagedScore.value * difficulty.value * turns[turn.value-1]), color: colors[4] },
  { label: t('deffence.evasion'), value: Math.floor(evasionScore.value * difficulty.value * turns[turn.value-1]), color: colors[5] },
  { label: t('deffence.debuff'), value: Math.floor(debuffScore.value * difficulty.value * turns[turn.value-1]), color: colors[6] },
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