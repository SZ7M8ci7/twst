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
              <span class="ma-1 ">与ダメージ</span>
            </v-col>
            <v-col cols="9" class="pa-1">
              <v-text-field type="number" v-model="damage" class="mt-0 pt-0" hide-details="auto" dense solo :min="0" />
            </v-col>
        </v-row>
        <v-row align="center">
            <v-col cols="3" class="pa-1 text-center">
              <span class="ma-1">DUO回数</span>
            </v-col>
            <v-col cols="9" class="pa-1">
              <v-text-field type="number" v-model="duo" class="mt-0 pt-0" hide-details="auto" dense solo :min="0" />
            </v-col>
        </v-row>
        <v-row>
          <v-col class="pa-1">
            <v-table>
              <thead>
                <tr>
                  <th></th>
                  <th class="pa-1">有利</th>
                  <th class="pa-1">等倍</th>
                  <th class="pa-1">不利</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <th class="text-nowrap wide-cell">攻撃数
                    <span class="mdi mdi-help-circle-outline">

                      <v-tooltip style="white-space: nowrap;" activator="parent"
                        open-on-click>2連撃、3連撃どちらでも1回とカウント</v-tooltip>
                    </span>
                  </th>
                  <td class="pa-1"><v-text-field type="number" v-model="table.advantage" hide-details dense solo />
                  </td>
                  <td class="pa-1"><v-text-field type="number" v-model="table.equal" hide-details dense solo />
                  </td>
                  <td class="pa-1"><v-text-field type="number" v-model="table.disadvantage" hide-details dense
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
const turns = [0.144,0.138,0.132,0.126,0.1];
const damage = ref(0);
const duo = ref(0);
const difficulty = ref(1.5);
const table = ref({
  advantage: 0,
  equal: 0,
  disadvantage: 0,
});
const moveNum = computed(() => Number(table.value.advantage)+Number(table.value.equal)+Number(table.value.disadvantage));
const turnNum = computed(() => Math.max(0, Number((Math.floor(((moveNum.value-1)/2)+0.001)).toFixed())));
const damageScore = computed(() => Number(damage.value));
const duoScore = computed(() => duo.value * 3000);
const advantageScore = computed(() => Number(table.value.advantage) * 2000);
const equalScore = computed(() => Number(table.value.equal) * 500);
const disadvantageScore = computed(() => Number(table.value.disadvantage) * -1000);
const baseScore = computed(() =>
  damageScore.value
  + duoScore.value
  + advantageScore.value
  + equalScore.value
  + disadvantageScore.value);
const score = computed(() => (baseScore.value * difficulty.value * turns[turnNum.value]).toFixed())
const colors = [
  '#FAD9C8',
  '#FAF2C8',
  '#E9FAC8',
  '#D0FAC8',
  '#C8FAD9',
];
const scores = computed(() => [
  { label: 'ダメージ', value: Number((damageScore.value * difficulty.value * turns[turnNum.value]).toFixed()), color: colors[0] },
  { label: 'デュオ', value: Number((duoScore.value * difficulty.value * turns[turnNum.value]).toFixed()), color: colors[1] },
  { label: '有利回数', value: Number((advantageScore.value * difficulty.value * turns[turnNum.value]).toFixed()), color: colors[2] },
  { label: '等倍回数', value: Number((equalScore.value * difficulty.value * turns[turnNum.value]).toFixed()), color: colors[3] },
  { label: '不利回数', value: Number((disadvantageScore.value * difficulty.value * turns[turnNum.value]).toFixed()), color: colors[4] },
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