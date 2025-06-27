<template>
  <v-container class="pa-2">
    <v-row class="ma-0">
      <v-col cols="12" class="pa-0">
        <v-row align="center" class="ma-0">
          <v-col cols="4" sm="3" class="pa-0 pr-1 text-right">
              <span class="field-label">{{ $t('deffence.difficulty') }}</span>
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
              <span class="field-label">{{ $t('deffence.finishTurn') }}</span>
            </v-col>
            <v-col cols="8" sm="9" class="pa-0">
              <v-text-field type="number" v-model="turn" class="mt-0 pt-0" hide-details="auto" dense solo :min="1" :max="5" />
            </v-col>
        </v-row>
        <v-row align="center" class="ma-0">
            <v-col cols="4" sm="3" class="pa-0 pr-1 text-right">
              <span class="field-label">{{ $t('deffence.totalAllyHP') }}</span>
            </v-col>
            <v-col cols="8" sm="9" class="pa-0">
              <v-text-field type="number" v-model="allyTotalHP" class="mt-0 pt-0" hide-details="auto" dense solo :min="0" />
            </v-col>
        </v-row>
        <v-row align="center" class="ma-0">
            <v-col cols="4" sm="3" class="pa-0 pr-1 text-right">
              <span class="field-label">{{ $t('deffence.remainAllyHP') }}</span>
            </v-col>
            <v-col cols="8" sm="9" class="pa-0">
              <v-text-field type="number" v-model="allyRemainHP" class="mt-0 pt-0" hide-details="auto" dense solo :min="0" />
            </v-col>
        </v-row>
        <v-row align="center" class="ma-0">
            <v-col cols="4" sm="3" class="pa-0 pr-1 text-right">
              <span class="field-label">{{ $t('deffence.totalDamageDealt') }}</span>
            </v-col>
            <v-col cols="8" sm="9" class="pa-0">
              <v-text-field type="number" v-model="damage" class="mt-0 pt-0" hide-details="auto" dense solo
                :min="0" />
            </v-col>
        </v-row>
        <v-row align="center" class="ma-0">
            <v-col cols="4" sm="3" class="pa-0 pr-1 text-right">
              <span class="field-label">{{ $t('deffence.numberOfEvasion') }}
                <span class="mdi mdi-help-circle-outline">
                  <v-tooltip activator="parent" open-on-click>{{ $t('deffence.countIf') }}</v-tooltip>
                </span>
              </span>
            </v-col>
            <v-col cols="8" sm="9" class="pa-0">
              <v-text-field type="number" v-model="evasion" class="mt-0 pt-0" hide-details="auto" dense solo :min="0" />
            </v-col>
        </v-row>
        <v-row align="center" class="ma-0">
            <v-col cols="4" sm="3" class="pa-0 pr-1 text-right">
              <span class="field-label">{{ $t('deffence.numberOfDebuff') }}</span>
            </v-col>
            <v-col cols="8" sm="9" class="pa-0">
              <v-text-field type="number" v-model="debuff" class="mt-0 pt-0" hide-details="auto" dense solo :min="0" />
            </v-col>
        </v-row>
        <v-row class="ma-0">
          <v-col class="pa-0">
            <div class="table-wrapper">
              <v-table>
                <thead>
                  <tr>
                    <th></th>
                    <th class="pa-0">{{ $t('deffence.advantageDamageTaken') }}</th>
                    <th class="pa-0">{{ $t('deffence.disadvantageDamageTaken') }}</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <th class="text-nowrap wide-cell pa-0">{{ $t('deffence.damageTaken') }}</th>
                    <td class="pa-0"><v-text-field type="number" v-model="table.advantageDamaged" hide-details dense solo />
                    </td>
                    <td class="pa-0"><v-text-field type="number" v-model="table.disadvantageDamaged" hide-details dense
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
const turn = ref(5);
const turns = [0.8,0.85,0.9,0.95,1]
const allyTotalHP = ref(0);
const allyRemainHP = ref(0);
const damage = ref(0);
const evasion = ref(0);
const debuff = ref(0);
const difficulty = ref(1.5);
const difficultyOptions = [
  { text: 'Easy', value: 0.8 },
  { text: 'Normal', value: 1 },
  { text: 'Hard', value: 1.2 },
  { text: 'Extra', value: 1.5 }
];
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
    
    // 1. 実質HP（HP+バディHP+回復）を設定
    const stats = await simulatorStore.waitForDeckStats();
    const totalHP = (stats?.totalHP || 0) + (stats?.totalBuddyHP || 0) + (stats?.totalHeal || 0);
    allyTotalHP.value = Math.round(totalHP);
    
    // 2. 与ダメージ（合計ダメージ）を設定
    const totalDamage = await simulatorStore.getSafeDeckDamage(currentAttribute);
    damage.value = Math.floor(totalDamage);
    
    // 3. 回避発動数を計算
    const evasionCount = calculateEvasionCount();
    evasion.value = evasionCount;
    
    // 4. デバフ発動数を計算
    const debuffCount = calculateDebuffCount();
    debuff.value = debuffCount;
    
  } catch (error) {
    // エラー時はデフォルト値を設定
    allyTotalHP.value = 0;
    damage.value = 0;
    evasion.value = 0;
    debuff.value = 0;
  }
}

// 回避効果のある魔法の数を計算
function calculateEvasionCount(): number {
  let count = 0;
  
  (simulatorStore.deckCharacters || []).forEach((char: any) => {
    // キャラが未選択の場合はスキップ
    if (!char || !char.name || char.name === '' || char.name === 'なし') return;
    
    for (let i = 1; i <= 3; i++) {
      if (char[`isM${i}Selected`]) {
        // etcフィールドをbrタグで分割して各効果をチェック
        const etcContent = char.etc || '';
        const effects = etcContent.split('<br>').map((effect: string) => effect.trim());
        
        // 該当する魔法番号を含む効果行で回避効果をチェック
        const magicEffects = effects.filter((effect: string) => effect.includes(`(M${i})`));
        const hasEvasion = magicEffects.some((effect: string) => effect.includes('回避'));
        
        if (hasEvasion) {
          count++;
        }
      }
    }
  });
  
  return count;
}

// デバフ効果のある魔法の数を計算
function calculateDebuffCount(): number {
  let count = 0;
  
  const debuffPatterns = [
    'ATKDOWN',
    '火属性ダメージDOWN',
    '水属性ダメージDOWN',
    '木属性ダメージDOWN',
    '無属性ダメージDOWN',
    'ダメージDOWN',
    '被ダメージDOWN'
  ];
  
  (simulatorStore.deckCharacters || []).forEach((char: any) => {
    // キャラが未選択の場合はスキップ
    if (!char || !char.name || char.name === '' || char.name === 'なし') return;
    
    for (let i = 1; i <= 3; i++) {
      if (char[`isM${i}Selected`]) {
        // etcフィールドをbrタグで分割して各効果をチェック
        const etcContent = char.etc || '';
        const effects = etcContent.split(',').map((effect: string) => effect.trim());
        // 該当する魔法番号を含む効果行でデバフ効果をチェック
        const magicEffects = effects.filter((effect: string) => effect.includes(`(M${i})`));
        
        for (const effect of magicEffects) {
          for (const pattern of debuffPatterns) {
            if (effect.includes(pattern)) {
              // 被ダメージDOWNの場合は自身または味方が対象
              if (pattern === '被ダメージDOWN') {
                if (effect.includes('自') || effect.includes('味方')) {
                  count++;
                  break;
                }
              } else {
                // その他のデバフは相手が対象
                if (effect.includes('相手')) {
                  count++;
                  break;
                }
              }
            }
          }
        }
      }
    }
  });
  
  return count;
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