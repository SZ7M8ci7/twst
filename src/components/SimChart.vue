<template>
  <div>
    <div class="chart-container">
      <canvas ref="chartCanvas"></canvas>
    </div>
    <div class="character-images">
      <div 
        v-for="(char, index) in simulatorStore.deckCharacters" 
        :key="index"
        class="character-image-label"
      >
        <img 
          v-if="char.imgUrl" 
          :src="char.imgUrl" 
          :alt="char.chara"
          class="chart-character-image"
        />
        <div v-else class="empty-character"></div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch } from 'vue';
import Chart from 'chart.js/auto';
import { useSimulatorStore } from '@/store/simulatorStore';
// import { calculateCharacterStats } from '@/utils/calculations';

const props = defineProps<{
  filterAttribute: string;
}>();

const chartCanvas = ref<HTMLCanvasElement | null>(null);
const simulatorStore = useSimulatorStore();
let chart: Chart | null = null;

// 属性ごとの色を定義
// const colors: { [key: string]: string } = {
//   '火': 'rgba(255, 99, 132, 0.5)',
//   '水': 'rgba(54, 162, 235, 0.5)',
//   '木': 'rgba(75, 192, 192, 0.5)',
//   '無': 'rgba(153, 102, 255, 0.5)'
// };

// スタックごとの色を定義
const stackColors: { [key: string]: string } = {
  '火': 'rgba(255, 20, 20, 0.4)',
  '木': 'rgba(20, 255, 20, 0.4)',
  '水': 'rgba(20, 20, 255, 0.4)',
  '無': 'rgba(140, 140, 140, 0.4)'
};

function createChart() {
  if (!chartCanvas.value) return;

  const ctx = chartCanvas.value.getContext('2d');
  if (!ctx) return;

  if (chart) {
    chart.destroy();
  }

  const datasets = [
    {
      label: 'HP',
      stack: 'Stack HP',
      backgroundColor: 'rgba(100, 100, 100, 0.6)',
      data: simulatorStore.characterStats.map(stats => stats.hp)
    },
    {
      label: 'バディHP',
      stack: 'Stack HP',
      backgroundColor: 'rgba(100, 100, 100, 0.4)',
      data: simulatorStore.characterStats.map(stats => stats.buddyHP)
    },
    {
      label: '回復',
      stack: 'Stack HP',
      backgroundColor: 'rgba(100, 100, 100, 0.2)',
      data: simulatorStore.characterStats.map(stats => stats.heal)
    }
  ];

  // 属性ダメージのデータを追加
  const elements = ['火', '水', '木', '無'];
  const magicTypes = ['M1', 'M2', 'M3'];
  
  // 選択された属性のみ表示するか、全属性を表示するか
  const elementsToShow = props.filterAttribute === '対全' ? elements : [props.filterAttribute.replace('対', '')];
  
  // 各魔法タイプと属性の組み合わせでデータセットを作成
  magicTypes.forEach((magicType) => {
    const magicNumber = Number(magicType.replace('M', ''));
    elementsToShow.forEach((element) => {
      datasets.push({
        label: `対${element}(${magicType})`,
        stack: `Stack ${element}${magicType}`,
        backgroundColor: simulatorStore.deckCharacters.map((char) => {
          const isMagicSelected = char[`isM${magicNumber}Selected`];
          // 選択されていない魔法は透明度を下げる
          const baseColor = stackColors[element];
          if (!isMagicSelected) {
            // RGBAの透明度を0.2に変更（より薄く）
            return baseColor.replace(/[\d.]+\)$/, '0.2)');
          }
          return baseColor;
        }),
        // 各キャラクターの指定された魔法タイプと属性のダメージを取得
        data: simulatorStore.deckCharacters.map((char) => {
          const damageDetails = char[`magic${magicNumber}DamageDetails`];
          // 選択されていない魔法も表示（ダメージ詳細がある場合は表示）
          if (!damageDetails) {
            return 0;
          }
          
          if (element === '火') return damageDetails.fire || 0;
          if (element === '水') return damageDetails.water || 0;
          if (element === '木') return damageDetails.wood || 0;
          if (element === '無') return damageDetails.neutral || 0;
          return 0;
        })
      });
    });
  });

  chart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: simulatorStore.deckCharacters.map((char, index) => index),
      datasets: datasets
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      layout: {
        padding: {
          top: 10,
          right: 10,
          bottom: 10,
          left: 10
        }
      },
      scales: {
        x: {
          stacked: true,
          grid: {
            display: true
          },
          ticks: {
            display: false
          }
        },
        y: {
          stacked: true,
          beginAtZero: true,
          title: {
            display: false
          },
          grid: {
            display: true
          }
        }
      },
      plugins: {
        title: {
          display: false
        },
        legend: {
          display: true,
          position: 'top',
          labels: {
            boxWidth: 10,
            padding: 8
          }
        },
        tooltip: {
          mode: 'index',
          intersect: false,
          callbacks: {
            label: function(context) {
              const label = context.dataset.label || '';
              const value = Math.ceil(context.parsed.y);
              return `${label}: ${value}`;
            },
            title: function(context) {
              return context[0].label;
            },
            afterBody: function(context) {
              const totalHP = context.reduce((sum, item) => {
                if (item.dataset.label === 'HP' || item.dataset.label === 'バディHP' || item.dataset.label === '回復') {
                  return sum + Math.ceil(item.parsed.y);
                }
                return sum;
              }, 0);
              return [`総HP: ${totalHP}`];
            }
          }
        }
      }
    }
  });
}

// デバウンス関数を作成
function debounce(fn: Function, delay: number) {
  let timer: number | null = null;
  return function(...args: any[]) {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      fn(...args);
      timer = null;
    }, delay) as unknown as number;
  };
}

const debouncedCreateChart = debounce(createChart, 100);

// 統合されたwatcher - 1つのwatcherで全ての変更を監視
watch(() => ({
  filterAttribute: props.filterAttribute,
  characterStats: simulatorStore.characterStats,
  selectedStates: simulatorStore.deckCharacters.map(char => ({
    isM1Selected: char.isM1Selected,
    isM2Selected: char.isM2Selected,
    isM3Selected: char.isM3Selected,
    magic1DamageDetails: char.magic1DamageDetails,
    magic2DamageDetails: char.magic2DamageDetails,
    magic3DamageDetails: char.magic3DamageDetails
  }))
}), debouncedCreateChart, { deep: true });

onMounted(createChart);
</script>

<style scoped>
.chart-container {
  width: 100%;
  height: 300px;
  margin: 0;
  padding: 0;
  position: relative;
  min-height: 300px;
  z-index: 10;
}

canvas {
  width: 100% !important;
  height: 100% !important;
  position: absolute;
  top: 0;
  left: 0;
}

.character-images {
  display: flex;
  align-items: center;
  padding: 0px 2px;
  margin-top: -18px;
  position: relative;
  width: calc(100% - 62px);
  margin-left: 58px;
  z-index: 1;
  pointer-events: none;
}

.character-image-label {
  flex: 1;
  display: flex;
  justify-content: center;
  align-items: center;
  position: relative;
}

.chart-character-image {
  width: 28px;
  height: 28px;
  object-fit: cover;
}

.empty-character {
  width: 24px;
  height: 24px;
  background-color: #f5f5f5;
  border: 1px dashed #ccc;
  border-radius: 3px;
}

/* ダークモード対応 */
.v-theme--dark .chart-character-image {
  border-color: #666;
}

.v-theme--dark .empty-character {
  background-color: #333;
  border-color: #555;
}
</style>
