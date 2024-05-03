<template>
  <v-row>
    <v-col cols="12" md="6" class="pa-1">
      <div class="doughnut-graph-container">
        <div class="doughnut-graph">
          <Doughnut :data="data" :options="options" :plugins="[ratioText, doughnutLabel]" />
        </div>
      </div>
    </v-col>
    <v-col cols="12" md="6" class="pa-1">
      <v-table>
        <tbody>
          <tr v-for="(score, index) in scores" :key="index">
            <td>{{ score.label }}</td>
            <td>{{ score.value.toFixed() }}</td>
          </tr>
        </tbody>
      </v-table>
    </v-col>
  </v-row>
</template>
<script setup lang="ts">
import { Doughnut } from 'vue-chartjs'
import { Chart, ChartData, registerables } from 'chart.js';
Chart.register(...registerables);
// チャート描画のオプション
const options = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    title: {
      display: true,
      text: 'スコア',
      font: {
        weight: 'bold',
        size: 30
      },
    },
    legend: {
      display: false,
      position: 'bottom',
      reverse: true,
      labels: {
        font: {
          size: 20
        }
      }
    },
    tooltip: {
      enabled: false // ツールチップを無効化
    }

  }
} as any;

const props = defineProps({
  data: {
    type: Object as () => ChartData<"doughnut", number[], unknown>,
    required: true,
  },
  scores: {
    type: Array as () => { label: string; value: number }[],
    required: true,
  },
  score: {
    type: String,
    required: true,
  },
});

const ratioText = {
  id: 'ratio-text',
  beforeDraw(chart: any) {
    const { ctx, chartArea: { top, width, height } } = chart
    ctx.save()
    //チャート描画部分の中央を指定
    ctx.fillRect(width / 2, top + (height / 2), 0, 0)
    //フォントのスタイル指定
    ctx.font = 'bold 30px Roboto'
    ctx.fillStyle = '#333333'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(props.score, width / 2, top + (height / 2))
  }
}
// 値を表示し、値が0のラベルを表示しないように修正
const doughnutLabel = {
  id: 'doughnutLabel',
  afterDraw(chart: any) {
    const { ctx, data } = chart;

    ctx.font = '12px Roboto';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    const total = data.datasets[0].data.reduce((a: number, b: number) => Math.abs(a) + Math.abs(b), 0);

    data.labels.forEach((label: string, i: number) => {
      const value = data.datasets[0].data[i];
      const percentage = (Math.abs(value) / total) * 100;

      // 値が0の場合はラベルを表示しない
      if (value === 0) {
        return;
      }

      const startAngle = chart.getDatasetMeta(0).data[i].startAngle;
      const endAngle = chart.getDatasetMeta(0).data[i].endAngle;
      const midAngle = startAngle + (endAngle - startAngle) / 2;

      let radius, x, y;
      if (percentage >= 3.5) {
        // 割合が5％以上の場合は円内に表示
        ctx.fillStyle = '#99857A';
        radius = (chart.getDatasetMeta(0).data[i].outerRadius + chart.getDatasetMeta(0).data[i].innerRadius) / 2;
        x = radius * Math.cos(midAngle);
        y = radius * Math.sin(midAngle);
        // 値を表示
        ctx.fillText(label, chart.getDatasetMeta(0).data[i].x + x, chart.getDatasetMeta(0).data[i].y + y - 6);
        ctx.fillText(value.toString(), chart.getDatasetMeta(0).data[i].x + x, chart.getDatasetMeta(0).data[i].y + y + 6);
      }
    });
  }
};
</script>
<style scoped>
.doughnut-graph-container {
  position: relative;
  width: 100%;
  padding-top: 100%;
  /* 高さを幅の100%に保つ */
}

@media (min-width: 960px) {
  .doughnut-graph-container {
    max-width: 500px;
    height: 500px;
    padding-top: 0;
    margin: 0 auto;
  }
}

.doughnut-graph {
  position: absolute;
  top: 0;
  left: 0;
  bottom: 0;
  right: 0;
}
</style>