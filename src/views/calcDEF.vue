<template>
  <v-container>
    <v-row>
      <v-col cols="1" />
      <v-col cols="11">
        <v-row align="center">
          <v-col cols="3" class="pa-1 text-center">
              <span class="ma-1">難易度</span>
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
              <span class="ma-1 align-center pa-0">終了ターン</span>
            </v-col>
            <v-col cols="9" class="pa-1">
              <v-text-field type="number" v-model="turn" class="mt-0 pt-0" hide-details="auto" dense solo :min="1" :max="5" />
            </v-col>
        </v-row>
        <v-row align="center">
            <v-col cols="3" class="pa-1 text-center">
              <span class="ma-1 align-center pa-0">開始時味方HP</span>
            </v-col>
            <v-col cols="9" class="pa-1">
              <v-text-field type="number" v-model="allyInitialHP" class="mt-0 pt-0" hide-details="auto" dense solo :min="0" />
            </v-col>
        </v-row>
        <v-row align="center">
            <v-col cols="3" class="pa-1 text-center">
              <span class="ma-1 align-center pa-0">味方残HP</span>
            </v-col>
            <v-col cols="9" class="pa-1">
              <v-text-field type="number" v-model="allyRemainHP" class="mt-0 pt-0" hide-details="auto" dense solo :min="0" />
            </v-col>
        </v-row>
        <v-row align="center">
            <v-col cols="3" class="pa-1 text-center">
              <span class="ma-1 ">与ダメージ</span>
            </v-col>
            <v-col cols="9" class="pa-1">
              <v-text-field type="number" v-model="damage" class="mt-0 pt-0" hide-details="auto" dense solo
                :min="0" />
            </v-col>
        </v-row>
        <v-row align="center">
            <v-col cols="3" class="pa-1 text-center">
              <span class="ma-1 align-center pa-0">味方回復量</span>
            </v-col>
            <v-col cols="9" class="pa-1">
              <v-text-field type="number" v-model="allyHeal" class="mt-0 pt-0" hide-details="auto" dense solo :min="0" />
            </v-col>
        </v-row>
        <v-row align="center">
            <v-col cols="3" class="pa-1 text-center">
              <span class="ma-1">回避発動数
                <span class="mdi mdi-help-circle-outline">
                  <v-tooltip activator="parent" open-on-click>回避失敗してもカウント</v-tooltip>
                </span>
              </span>
            </v-col>
            <v-col cols="9" class="pa-1">
              <v-text-field type="number" v-model="evasion" class="mt-0 pt-0" hide-details="auto" dense solo :min="0" />
            </v-col>
        </v-row>
        <v-row align="center">
            <v-col cols="3" class="pa-1 text-center">
              <span class="ma-1">デバフ発動数</span>
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
                  <th class="pa-1">有利受け</th>
                  <th class="pa-1">不利受け</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <th class="text-nowrap wide-cell">被ダメージ量</th>
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
Chart.register(...registerables);
const turn = ref(5);
const turns = [0.8,0.85,0.9,0.95,1]
const allyInitialHP = ref(0);
const allyRemainHP = ref(0);
const damage = ref(0);
const allyHeal = ref(0);
const evasion = ref(0);
const debuff = ref(0);
const difficulty = ref(1.5);
const table = ref({
  advantageDamaged: 0,
  disadvantageDamaged: 0,
});
const allyRemainHPScore = computed(() => allyRemainHP.value * 0.1275);
const allyInitialHPScore = computed(() => (Number(allyInitialHP.value)+Number(allyHeal.value)) * 0.0625);
const damageScore = computed(() => Number(damage.value * 0.05));
const advantageDamagedScore = computed(() => table.value.advantageDamaged * 2 * 0.05208);
const disadvantageDamagedScore = computed(() => -table.value.disadvantageDamaged / 1.5 * 0.05208);
const evasionScore = computed(() => evasion.value * 600);
const debuffScore = computed(() => debuff.value * 300);
const baseScore = computed(() =>
   allyRemainHPScore.value
  + allyInitialHPScore.value
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
  { label: '残HP', value: Math.floor(allyRemainHPScore.value * difficulty.value * turns[turn.value-1]), color: colors[0] },
  { label: '総HP（回復込み）', value: Math.floor(allyInitialHPScore.value * difficulty.value * turns[turn.value-1]), color: colors[1] },
  { label: 'ダメージ', value: Math.floor(damageScore.value * difficulty.value * turns[turn.value-1]), color: colors[2] },
  { label: '有利被ダメ', value: Math.floor(advantageDamagedScore.value * difficulty.value * turns[turn.value-1]), color: colors[3] },
  { label: '不利被ダメ', value: Math.floor(disadvantageDamagedScore.value * difficulty.value * turns[turn.value-1]), color: colors[4] },
  { label: '回避', value: Math.floor(evasionScore.value * difficulty.value * turns[turn.value-1]), color: colors[5] },
  { label: 'デバフ', value: Math.floor(debuffScore.value * difficulty.value * turns[turn.value-1]), color: colors[6] },
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