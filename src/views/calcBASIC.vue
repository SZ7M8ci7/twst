<template>
  <v-container class="pa-2">
    <v-row class="ma-0">
      <v-col cols="12" class="pa-0">
        <v-row align="center" class="ma-0">
          <v-col cols="4" sm="3" class="pa-0 pr-1 text-right">
            <span class="field-label">{{ $t('basic.difficulty') }}</span>
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
            <span class="field-label">{{ $t('basic.totalDamageDealt') }}</span>
          </v-col>
          <v-col cols="8" sm="9" class="pa-0">
            <v-text-field type="number" v-model="damage" class="mt-0 pt-0" hide-details="auto" dense solo :min="0" />
          </v-col>
        </v-row>
        <v-row align="center" class="ma-0">
          <v-col cols="4" sm="3" class="pa-0 pr-1 text-right">
            <span class="field-label">{{ $t('basic.duo') }}</span>
          </v-col>
          <v-col cols="8" sm="9" class="pa-0">
            <v-text-field type="number" v-model="duo" class="mt-0 pt-0" hide-details="auto" dense solo :min="0" />
          </v-col>
        </v-row>
        <v-row class="ma-0">
          <v-col class="pa-0">
            <div class="table-wrapper">
              <v-table>
                <thead>
                  <tr>
                    <th></th>
                    <th class="pa-0">{{ $t('basic.advantage') }}</th>
                    <th class="pa-0">{{ $t('basic.neutral') }}</th>
                    <th class="pa-0">{{ $t('basic.disadvantage') }}</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <th class="text-nowrap wide-cell pa-0">{{ $t('basic.attack') }}
                      <span class="mdi mdi-help-circle-outline">

                        <v-tooltip style="white-space: nowrap;" activator="parent"
                          open-on-click>{{ $t('basic.attackDetail') }}</v-tooltip>
                      </span>
                    </th>
                    <td class="pa-0"><v-text-field type="number" v-model="table.advantage" hide-details dense solo />
                    </td>
                    <td class="pa-0"><v-text-field type="number" v-model="table.equal" hide-details dense solo />
                    </td>
                    <td class="pa-0"><v-text-field type="number" v-model="table.disadvantage" hide-details dense
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
import { computed, ref, watch, nextTick } from 'vue';
import { Chart, registerables } from 'chart.js';
import DoughnutGraph from '@/components/DoughnutGraph.vue';
import { useI18n } from 'vue-i18n';
import { useSimulatorStore } from '@/store/simulatorStore';
Chart.register(...registerables);
const { t } = useI18n();
const simulatorStore = useSimulatorStore();

// Propsの定義
const props = defineProps<{
  selectedAttribute?: string
}>();

// 初期化フラグ
const isInitialized = ref(false);
const turns = [0.144,0.138,0.132,0.126,0.1];
const damage = ref(0);
const duo = ref(0);
const difficulty = ref(1.5);
const difficultyOptions = [
  { text: 'Easy', value: 0.8 },
  { text: 'Normal', value: 1 },
  { text: 'Hard', value: 1.2 },
  { text: 'Extra', value: 1.5 }
];
const table = ref({
  advantage: 0,
  equal: 0,
  disadvantage: 0,
});
const moveNum = computed(() => Number(table.value.advantage)+Number(table.value.equal)+Number(table.value.disadvantage));
const turnNum = computed(() => Math.max(0, Number((Math.floor(((moveNum.value-1)/2)+0.001)).toFixed())));
const damageScore = computed(() => Number(damage.value) - moveNum.value*4.5);
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
  { label: t('basic.damage'), value: Number((damageScore.value * difficulty.value * turns[turnNum.value]).toFixed()), color: colors[0] },
  { label: t('basic.duo'), value: Number((duoScore.value * difficulty.value * turns[turnNum.value]).toFixed()), color: colors[1] },
  { label: t('basic.numberOfAdvantage'), value: Number((advantageScore.value * difficulty.value * turns[turnNum.value]).toFixed()), color: colors[2] },
  { label: t('basic.numberOfNeutral'), value: Number((equalScore.value * difficulty.value * turns[turnNum.value]).toFixed()), color: colors[3] },
  { label: t('basic.numberOfDisadvantage'), value: Number((disadvantageScore.value * difficulty.value * turns[turnNum.value]).toFixed()), color: colors[4] },
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

// 初期化完了後にwatchを開始
nextTick(async () => {
  // simulatorStoreの初期化を確実に待機
  await simulatorStore.waitForDeckStats();
  
  isInitialized.value = true;
  
  // シミュレータの値と属性選択を監視して自動反映
  watch(
    () => [simulatorStore.deckCharacters, props.selectedAttribute, simulatorStore.isDeckStatsReady],
    () => {
      if (isInitialized.value && simulatorStore.isDeckStatsReady) {
        autoFillFromSimulator();
      }
    },
    { deep: true, immediate: true }
  );
});

// シミュレータから自動入力する関数
async function autoFillFromSimulator() {
  if (!isInitialized.value) return;
  
  try {
    // propsから属性を取得（デフォルトは'対全'）
    const currentAttribute = props.selectedAttribute || '対全';
    
    // simulatorStoreのdeckStatsからダメージを安全に取得
    const totalDamage = await simulatorStore.getSafeDeckDamage(currentAttribute);
    
    damage.value = Math.floor(totalDamage);
    
    // 2. デュオ魔法の数を設定
    const duoCount = (simulatorStore.deckCharacters || []).filter((char: any) => 
      char?.magic2Power === 'デュオ' && char?.isM2Selected
    ).length;
    duo.value = duoCount;
    
    // 3. 属性相性を計算して設定
    const compatibility = calculateAttributeCompatibility();
    table.value.advantage = compatibility.advantage;
    table.value.equal = compatibility.equal;
    table.value.disadvantage = compatibility.disadvantage;
    
  } catch (error) {
    // エラーが発生した場合は0に設定
    damage.value = 0;
  }
}

// 属性相性を計算する関数
function calculateAttributeCompatibility() {
  const compatibility = { advantage: 0, equal: 0, disadvantage: 0 };
  // 選択された属性を取得
  const selectedAttribute = props.selectedAttribute || '対全';
  // 「対火」から「火」を抽出
  const targetAttribute = selectedAttribute.replace('対', '');
  
  (simulatorStore.deckCharacters || []).forEach((char: any) => {
    // キャラが未選択の場合（nameが空など）はスキップ
    if (!char || !char.name || char.name === '' || char.name === 'なし') return;
    
    for (let i = 1; i <= 3; i++) {
      if (char[`isM${i}Selected`]) {
        const magicAttribute = char[`magic${i}Attribute`];
        
        if (selectedAttribute === '対全') {
          // 対全の場合: 無属性は等倍、それ以外は有利として扱う
          if (magicAttribute === '無') {
            compatibility.equal++;
          } else {
            compatibility.advantage++;
          }
        } else if (targetAttribute === '無') {
          // 対無の場合: 全て等倍
          compatibility.equal++;
        } else {
          // 特定属性の場合: 属性相性を判定
          if (isAdvantage(magicAttribute, targetAttribute)) {
            compatibility.advantage++;
          } else if (isDisadvantage(magicAttribute, targetAttribute)) {
            compatibility.disadvantage++;
          } else {
            compatibility.equal++;
          }
        }
      }
    }
  });
  
  return compatibility;
}

// 有利属性判定
function isAdvantage(magicAttr: string, targetAttr: string): boolean {
  const advantages: Record<string, string> = {
    '火': '木',
    '水': '火', 
    '木': '水'
  };
  return advantages[magicAttr] === targetAttr;
}

// 不利属性判定
function isDisadvantage(magicAttr: string, targetAttr: string): boolean {
  const disadvantages: Record<string, string> = {
    '火': '水',
    '水': '木',
    '木': '火'
  };
  return disadvantages[magicAttr] === targetAttr;
}

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