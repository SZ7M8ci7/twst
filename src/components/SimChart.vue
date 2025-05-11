<template>
  <div>
    <div class="chart-container">
      <canvas ref="chartCanvas"></canvas>
    </div>
    <div class="debug-container">
      <h3>デバッグ情報</h3>
      <div v-for="(char, index) in simulatorStore.deckCharacters" :key="index" class="debug-section">
        <div class="debug-header" @click="toggleDebug(index)">
          <h4>キャラクター{{ index + 1 }}</h4>
          <span class="toggle-icon">{{ isOpen[index] ? '▼' : '▶' }}</span>
        </div>
        <div v-show="isOpen[index]" class="debug-content">
          <div>基本情報:</div>
          <pre>{{ JSON.stringify({
            name: char.name,
            level: char.level,
            type: char.type,
            hp: char.hp,
            atk: char.atk
          }, null, 2) }}</pre>
          
          <div>計算結果:</div>
          <pre>{{ JSON.stringify(simulatorStore.characterStats[index], null, 2) }}</pre>
          
          <div>バディ情報:</div>
          <pre>{{ JSON.stringify({
            buddy1: { name: char.buddy1c, level: char.buddy1Lv, type: char.buddy1s },
            buddy2: { name: char.buddy2c, level: char.buddy2Lv, type: char.buddy2s },
            buddy3: { name: char.buddy3c, level: char.buddy3Lv, type: char.buddy3s }
          }, null, 2) }}</pre>
          
          <div>魔法情報:</div>
          <pre>{{ JSON.stringify({
            magic1: { level: char.magic1Lv, heal: char.magic1heal, attribute: char.magic1Attribute, power: char.magic1Power },
            magic2: { level: char.magic2Lv, heal: char.magic2heal, attribute: char.magic2Attribute, power: char.magic2Power },
            magic3: { level: char.magic3Lv, heal: char.magic3heal, attribute: char.magic3Attribute, power: char.magic3Power },
            selected: char.selectedMagic
          }, null, 2) }}</pre>
          
          <div>ダメージ詳細:</div>
          <pre>{{ JSON.stringify({
            magic1Damage: char.magic1DamageDetails,
            magic2Damage: char.magic2DamageDetails,
            magic3Damage: char.magic3DamageDetails
          }, null, 2) }}</pre>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch } from 'vue';
import Chart from 'chart.js/auto';
import { useSimulatorStore } from '@/store/simulatorStore';
import { calculateCharacterStats } from '@/utils/calculations';

const props = defineProps<{
  filterAttribute: string;
}>();

const chartCanvas = ref<HTMLCanvasElement | null>(null);
const simulatorStore = useSimulatorStore();
let chart: Chart | null = null;

// デバッグ情報の開閉状態を管理
const isOpen = ref<boolean[]>(Array(5).fill(false));

// デバッグ情報の開閉を切り替え
function toggleDebug(index: number) {
  isOpen.value[index] = !isOpen.value[index];
}

// バフの更新処理
function handleBuffChange(index: number, buffIndex: number, buff: any) {
  simulatorStore.updateBuff(index, buffIndex, buff);
}

// 属性ごとの色を定義
const colors: { [key: string]: string } = {
  '火': 'rgba(255, 99, 132, 0.5)',
  '水': 'rgba(54, 162, 235, 0.5)',
  '木': 'rgba(75, 192, 192, 0.5)',
  '無': 'rgba(153, 102, 255, 0.5)'
};

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
      stack: 'Stack 0',
      backgroundColor: 'rgba(100, 100, 100, 0.6)',
      data: simulatorStore.characterStats.map(stats => stats.hp)
    },
    {
      label: 'バディHP',
      stack: 'Stack 0',
      backgroundColor: 'rgba(100, 100, 100, 0.4)',
      data: simulatorStore.characterStats.map(stats => stats.buddyHP)
    },
    {
      label: '回復',
      stack: 'Stack 0',
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
  elementsToShow.forEach((element, elementIndex) => {
    magicTypes.forEach((magicType, magicIndex) => {
      const magicNumber = Number(magicType.replace('M', ''));
      datasets.push({
        label: `対${element}(${magicType})`,
        stack: `Stack ${elementIndex + 1}`,
        backgroundColor: stackColors[element],
        // 各キャラクターの指定された魔法タイプと属性のダメージを取得
        data: simulatorStore.deckCharacters.map((char, idx) => {
          const damageDetails = char[`magic${magicNumber}DamageDetails`];
          if (!damageDetails || !char.selectedMagic?.includes(magicNumber)) {
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
      labels: simulatorStore.deckCharacters.map(char => char.chara  || ''),
      datasets: datasets
    },
    options: {
      responsive: true,
      scales: {
        x: {
          stacked: true
        },
        y: {
          stacked: true,
          beginAtZero: true,
          title: {
            display: true,
            text: '数値'
          }
        }
      },
      plugins: {
        title: {
          display: true,
          text: 'キャラクターステータス'
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

watch(() => props.filterAttribute, createChart);
watch(() => simulatorStore.characterStats, createChart, { deep: true });
// キャラクター選択状態の変更を監視
watch(() => simulatorStore.deckCharacters, createChart, { deep: true });

onMounted(createChart);
</script>

<style scoped>
.chart-container {
  width: 100%;
  height: 400px;
  margin-bottom: 20px;
}

.debug-container {
  padding: 20px;
  background-color: #f5f5f5;
  border-radius: 8px;
  margin-top: 20px;
}

.debug-section {
  margin-bottom: 10px;
  background-color: white;
  border-radius: 4px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.debug-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 15px;
  cursor: pointer;
  user-select: none;
  background-color: #f8f8f8;
  border-radius: 4px;
}

.debug-header:hover {
  background-color: #f0f0f0;
}

.debug-header h4 {
  margin: 0;
  color: #333;
}

.toggle-icon {
  color: #666;
  font-size: 12px;
}

.debug-content {
  font-family: monospace;
  font-size: 14px;
  padding: 15px;
  border-top: 1px solid #eee;
}

.debug-content > div {
  margin-top: 10px;
  font-weight: bold;
  color: #666;
}

pre {
  margin: 5px 0;
  padding: 10px;
  background-color: #f8f8f8;
  border-radius: 4px;
  overflow-x: auto;
}
</style>
