<template>
  <v-container class="status-plot-page">
    <div class="toolbar">
      <div class="filter-slot">
        <DataHeader />
      </div>

      <v-btn-toggle
        v-model="statMode"
        mandatory
        color="primary"
        divided
        class="mode-toggle"
      >
        <v-btn value="current">{{ $t('statusPlot.currentStats') }}</v-btn>
        <v-btn value="allBuddy">{{ $t('statusPlot.allBuddyStats') }}</v-btn>
      </v-btn-toggle>
    </div>

    <v-row dense class="content-row">
      <v-col cols="12" lg="8">
        <v-card class="plot-card" rounded="xl" elevation="0">
          <div class="plot-header">
            <h2 class="section-title">{{ $t('statusPlot.hpLabel') }} × {{ $t('statusPlot.atkLabel') }}</h2>

            <div class="plot-meta">
              <span>{{ $t('statusPlot.filteredCount', { count: filteredCharacters.length, total: characters.length }) }}</span>
              <span>{{ currentModeLabel }}</span>
            </div>
          </div>

          <div class="legend-items">
            <span
              v-for="item in legendItems"
              :key="item.value"
              class="legend-item"
            >
              <span class="legend-dot" :style="{ backgroundColor: item.color }"></span>
              {{ item.label }}
            </span>
          </div>

          <div v-if="filteredCharacters.length" class="chart-container">
            <canvas ref="chartCanvas"></canvas>
          </div>
          <div v-else class="empty-state">
            <p class="empty-title">{{ $t('statusPlot.noDataTitle') }}</p>
            <p class="empty-text">{{ $t('statusPlot.noDataText') }}</p>
          </div>
        </v-card>
      </v-col>

      <v-col cols="12" lg="4">
        <v-card class="detail-card" rounded="xl" elevation="0">
          <p class="section-label">{{ $t('statusPlot.selectedTitle') }}</p>

          <template v-if="selectedCharacter && selectedBuddyStats">
            <div class="selected-header">
              <img
                v-if="selectedCharacter.imgUrl"
                :src="selectedCharacter.imgUrl"
                :alt="selectedCharacter.name"
                class="selected-image"
              />
              <div v-else class="selected-image placeholder"></div>

              <div class="selected-copy">
                <h3 class="selected-name">{{ selectedCharacter.chara }}</h3>
                <p class="selected-costume">{{ selectedCharacter.costume }}</p>
                <div class="selected-tags">
                  <span class="tag">{{ selectedCharacter.rare }}</span>
                  <span class="tag" :style="{ borderColor: getTypeColor(selectedCharacter.attr), color: getTypeColor(selectedCharacter.attr) }">
                    {{ getTypeLabel(selectedCharacter.attr) }}
                  </span>
                </div>
              </div>
            </div>

            <div class="stat-grid">
              <div class="stat-box">
                <span class="stat-group">{{ $t('statusPlot.currentStats') }}</span>
                <div class="stat-line">
                  <span>{{ $t('statusPlot.hpLabel') }}</span>
                  <strong>{{ formatNumber(selectedCharacter.hp) }}</strong>
                </div>
                <div class="stat-line">
                  <span>{{ $t('statusPlot.atkLabel') }}</span>
                  <strong>{{ formatNumber(selectedCharacter.atk) }}</strong>
                </div>
              </div>

              <div class="stat-box">
                <span class="stat-group">{{ $t('statusPlot.allBuddyStats') }}</span>
                <div class="stat-line">
                  <span>{{ $t('statusPlot.hpLabel') }}</span>
                  <strong>{{ formatNumber(selectedBuddyStats.hp) }}</strong>
                </div>
                <div class="stat-line">
                  <span>{{ $t('statusPlot.atkLabel') }}</span>
                  <strong>{{ formatNumber(selectedBuddyStats.atk) }}</strong>
                </div>
              </div>
            </div>

            <div class="meta-list">
              <div class="meta-item">
                <span class="meta-key">{{ $t('statusPlot.duoLabel') }}</span>
                <strong class="meta-value">{{ selectedCharacter.duo || '-' }}</strong>
              </div>
              <div class="meta-item">
                <span class="meta-key">{{ $t('statusPlot.implementationDateLabel') }}</span>
                <strong class="meta-value">{{ selectedCharacter.implementation_date || '-' }}</strong>
              </div>
            </div>

            <div class="buddy-section">
              <p class="buddy-title">{{ $t('statusPlot.buddyEffectsTitle') }}</p>
              <div class="buddy-list">
                <div
                  v-for="buddy in selectedBuddyDetails"
                  :key="buddy.index"
                  class="buddy-item"
                >
                  <span class="buddy-index">Buddy {{ buddy.index }}</span>
                  <div class="buddy-copy">
                    <strong>{{ buddy.character || '-' }}</strong>
                    <span>{{ buddy.effect || '-' }}</span>
                  </div>
                </div>
              </div>
            </div>
          </template>

          <template v-else>
            <p class="empty-text detail-empty">{{ $t('statusPlot.selectedHint') }}</p>
          </template>
        </v-card>
      </v-col>
    </v-row>
  </v-container>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeMount, onMounted, onUnmounted, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { useI18n } from 'vue-i18n'
import Chart from 'chart.js/auto'
import DataHeader from '@/components/DataHeader.vue'
import type { Character } from '@/store/characters'
import { useCharacterStore } from '@/store/characters'
import { getBuddyStatusForCharacter, getBuddyStatusSummary } from '@/utils/buddyEffects'
import { hydrateCharacterImageUrls } from '@/utils/characterAssets'

type StatMode = 'current' | 'allBuddy'

type PlotPoint = {
  x: number
  y: number
  cardName: string
  chara: string
  costume: string
  attr: string
  rare: string
  currentHp: number
  currentAtk: number
  buddyHp: number
  buddyAtk: number
}

type AxisBounds = {
  min: number
  max: number
}

const TYPE_COLORS: Record<string, string> = {
  アタック: '#d2574b',
  バランス: '#bf8f32',
  ディフェンス: '#456fbd',
}

const chartCanvas = ref<HTMLCanvasElement | null>(null)
const statMode = ref<StatMode>('current')
const selectedCardName = ref('')
const isMobileView = ref(false)

const { t, locale } = useI18n()
const characterStore = useCharacterStore()
const { characters } = storeToRefs(characterStore)

let chart: Chart<'scatter'> | null = null

const filteredCharacters = computed(() => (
  characters.value.filter((character) => character.visible)
))

const legendItems = computed(() => [
  { value: 'アタック', label: t('filterModal.attack'), color: TYPE_COLORS['アタック'] },
  { value: 'バランス', label: t('filterModal.balance'), color: TYPE_COLORS['バランス'] },
  { value: 'ディフェンス', label: t('filterModal.defence'), color: TYPE_COLORS['ディフェンス'] },
])

const currentModeLabel = computed(() => (
  statMode.value === 'current'
    ? t('statusPlot.currentStats')
    : t('statusPlot.allBuddyStats')
))

const plotPoints = computed<PlotPoint[]>(() => (
  filteredCharacters.value.map((character) => {
    const buddyStats = getAllBuddyStats(character)

    return {
      x: statMode.value === 'current' ? character.hp : buddyStats.hp,
      y: statMode.value === 'current' ? character.atk : buddyStats.atk,
      cardName: character.name,
      chara: character.chara,
      costume: character.costume,
      attr: character.attr,
      rare: character.rare,
      currentHp: character.hp,
      currentAtk: character.atk,
      buddyHp: buddyStats.hp,
      buddyAtk: buddyStats.atk,
    }
  })
))

const plotBounds = computed(() => ({
  x: getAxisBounds(plotPoints.value.map((point) => point.x)),
  y: getAxisBounds(plotPoints.value.map((point) => point.y)),
}))

const selectedCharacter = computed(() => (
  filteredCharacters.value.find((character) => character.name === selectedCardName.value) ?? null
))

const selectedBuddyStats = computed(() => (
  selectedCharacter.value ? getAllBuddyStats(selectedCharacter.value) : null
))

const selectedBuddyDetails = computed(() => {
  if (!selectedCharacter.value) {
    return []
  }

  return [1, 2, 3].map((buddyIndex) => ({
    index: buddyIndex,
    character: selectedCharacter.value?.[`buddy${buddyIndex}c` as keyof Character] as string,
    effect: getBuddyStatusForCharacter(selectedCharacter.value, buddyIndex, { forceTotsu: true }),
  }))
})

function getAllBuddyStats(character: Character) {
  let hpRate = 0
  let atkRate = 0

  for (let buddyIndex = 1; buddyIndex <= 3; buddyIndex += 1) {
    const status = getBuddyStatusForCharacter(character, buddyIndex, { forceTotsu: true })
    const summary = getBuddyStatusSummary(status, 10)
    hpRate += summary.hpRate
    atkRate += summary.atkRate
  }

  return {
    hp: Math.round(character.hp * (1 + hpRate)),
    atk: Math.round(character.atk * (1 + atkRate)),
  }
}

function getAxisBounds(values: number[]): AxisBounds {
  if (!values.length) {
    return { min: 0, max: 0 }
  }

  const min = Math.min(...values)
  const max = Math.max(...values)
  const range = Math.max(max - min, 1)
  const padding = Math.max(Math.ceil(range * 0.02), 20)

  return {
    min: Math.max(0, min - padding),
    max: max + padding,
  }
}

function buildDatasets() {
  return legendItems.value
    .map((item) => {
      const data = plotPoints.value.filter((point) => point.attr === item.value)
      if (!data.length) {
        return null
      }

      return {
        label: item.label,
        data,
        parsing: false,
        clip: 12,
        backgroundColor: `${item.color}cc`,
        pointRadius: 6,
        pointHoverRadius: 8,
        pointBorderColor(context: any) {
          const point = context.raw as PlotPoint
          return point.cardName === selectedCardName.value ? '#111b2b' : '#ffffff'
        },
        pointBorderWidth(context: any) {
          const point = context.raw as PlotPoint
          return point.cardName === selectedCardName.value ? 3 : 1.5
        },
      }
    })
    .filter(Boolean)
}

function buildChartOptions() {
  return {
    responsive: true,
    maintainAspectRatio: false,
    animation: false,
    normalized: true,
    layout: {
      padding: {
        left: isMobileView.value ? 2 : 8,
        right: 8,
        top: 0,
        bottom: 0,
      },
    },
    interaction: {
      mode: 'nearest' as const,
      intersect: false,
    },
    scales: {
      x: {
        min: plotBounds.value.x.min,
        max: plotBounds.value.x.max,
        title: {
          display: true,
          text: t('statusPlot.hpLabel'),
          color: '#253048',
          font: {
            weight: 'bold' as const,
            size: 13,
          },
        },
        grid: {
          color: 'rgba(81, 97, 123, 0.12)',
        },
        ticks: {
          color: '#51617b',
          callback(value: string | number) {
            return Number(value).toLocaleString()
          },
        },
      },
      y: {
        min: plotBounds.value.y.min,
        max: plotBounds.value.y.max,
        title: {
          display: true,
          text: t('statusPlot.atkLabel'),
          color: '#253048',
          font: {
            weight: 'bold' as const,
            size: 13,
          },
        },
        grid: {
          color: 'rgba(81, 97, 123, 0.12)',
        },
        ticks: {
          display: !isMobileView.value,
          color: '#51617b',
          callback(value: string | number) {
            return Number(value).toLocaleString()
          },
        },
      },
    },
    plugins: {
      legend: {
        display: false,
      },
      tooltip: {
        backgroundColor: 'rgba(18, 27, 42, 0.92)',
        padding: 12,
        displayColors: false,
        callbacks: {
          title(items: any[]) {
            const point = items[0]?.raw as PlotPoint | undefined
            if (!point) {
              return ''
            }
            return `${point.chara} / ${point.costume}`
          },
          label(context: any) {
            const point = context.raw as PlotPoint
            return [
              `${t('statusPlot.currentStats')}: HP ${formatNumber(point.currentHp)} / ATK ${formatNumber(point.currentAtk)}`,
              `${t('statusPlot.allBuddyStats')}: HP ${formatNumber(point.buddyHp)} / ATK ${formatNumber(point.buddyAtk)}`,
              `${t('statusPlot.typeLabel')}: ${getTypeLabel(point.attr)}`,
              `Rare: ${point.rare}`,
            ]
          },
        },
      },
    },
    onClick: (_event: unknown, elements: any[]) => {
      if (!elements.length || !chart) {
        return
      }

      const target = elements[0]
      const point = chart.data.datasets[target.datasetIndex].data[target.index] as PlotPoint
      selectedCardName.value = point.cardName
    },
  }
}

function formatNumber(value: number) {
  return value.toLocaleString()
}

function getTypeLabel(type: string) {
  if (type === 'アタック') return t('filterModal.attack')
  if (type === 'バランス') return t('filterModal.balance')
  if (type === 'ディフェンス') return t('filterModal.defence')
  return type
}

function getTypeColor(type: string) {
  return TYPE_COLORS[type] || '#7d8798'
}

function renderChart() {
  if (!chartCanvas.value || !filteredCharacters.value.length) {
    destroyChart()
    return
  }

  const context = chartCanvas.value.getContext('2d')
  if (!context) {
    return
  }

  const datasets = buildDatasets()
  const options = buildChartOptions()

  if (chart) {
    chart.data.datasets = datasets as any
    chart.options = options as any
    chart.update()
    return
  }

  chart = new Chart(context, {
    type: 'scatter',
    data: {
      datasets: datasets as any,
    },
    options: options as any,
  })
}

function destroyChart() {
  if (!chart) {
    return
  }
  chart.destroy()
  chart = null
}

function updateViewportState() {
  isMobileView.value = window.innerWidth <= 600
}

onBeforeMount(() => {
  void hydrateCharacterImageUrls(characters.value, 'name', { fallbackName: 'notyet' })
})

onMounted(() => {
  updateViewportState()
  window.addEventListener('resize', updateViewportState)
  characterStore.handlePageChange('statusPlotPage')
  if (filteredCharacters.value.length) {
    selectedCardName.value = filteredCharacters.value[0].name
  }
  void nextTick(() => {
    renderChart()
  })
})

onUnmounted(() => {
  window.removeEventListener('resize', updateViewportState)
  destroyChart()
})

watch(
  filteredCharacters,
  (nextCharacters) => {
    if (!nextCharacters.length) {
      selectedCardName.value = ''
      destroyChart()
      return
    }

    if (!nextCharacters.some((character) => character.name === selectedCardName.value)) {
      selectedCardName.value = nextCharacters[0].name
    }

    void nextTick(() => {
      renderChart()
    })
  },
  { deep: true }
)

watch([statMode, locale, selectedCardName, isMobileView], () => {
  void nextTick(() => {
    renderChart()
  })
})
</script>

<style scoped>
.status-plot-page {
  padding-top: 12px;
  padding-bottom: 24px;
}

.section-label {
  margin: 0 0 6px;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: #6f7b8e;
}

.section-title {
  margin: 0;
  color: #1e2940;
  line-height: 1.15;
  font-size: 22px;
}

.empty-text,
.plot-meta {
  color: #5e6a7d;
}

.toolbar {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  align-items: center;
  margin-bottom: 12px;
  flex-wrap: wrap;
}

.filter-slot {
  min-width: 180px;
}

.filter-slot :deep(.v-btn) {
  min-width: 180px;
}

.mode-toggle {
  flex-wrap: wrap;
}

.plot-card {
  border: 1px solid rgba(80, 93, 116, 0.14);
  background: #ffffff;
  padding: 18px;
}

.detail-card {
  border: 1px solid rgba(80, 93, 116, 0.14);
  background: #ffffff;
  padding: 18px;
  height: 100%;
}

.plot-header {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  align-items: center;
  flex-wrap: wrap;
}

.plot-meta {
  display: flex;
  flex-direction: column;
  gap: 2px;
  font-size: 13px;
  text-align: right;
}

.legend-items {
  display: flex;
  gap: 14px;
  align-items: center;
  flex-wrap: wrap;
  margin-top: 10px;
}

.legend-item {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  color: #38445a;
  font-size: 13px;
}

.legend-dot {
  width: 10px;
  height: 10px;
  border-radius: 999px;
  display: inline-block;
}

.chart-container {
  position: relative;
  min-height: 620px;
  margin-top: 12px;
}

.chart-container canvas {
  width: 100% !important;
  height: 100% !important;
}

.empty-state {
  min-height: 420px;
  margin-top: 16px;
  border-radius: 20px;
  display: grid;
  place-items: center;
  text-align: center;
  background: linear-gradient(135deg, #f6f8fc, #eef2f8);
}

.empty-title {
  margin: 0 0 6px;
  font-size: 22px;
  color: #29364f;
}

.detail-empty {
  margin-top: 12px;
}

.content-row {
  align-items: stretch;
}

.selected-header {
  display: flex;
  gap: 14px;
  margin-top: 12px;
}

.selected-image {
  width: 88px;
  height: 88px;
  border-radius: 16px;
  object-fit: cover;
  background: #eef2f7;
  flex-shrink: 0;
}

.selected-image.placeholder {
  border: 1px dashed rgba(104, 119, 145, 0.35);
}

.selected-copy {
  min-width: 0;
}

.selected-name {
  margin: 0;
  font-size: 24px;
  color: #1d2941;
}

.selected-costume {
  margin: 4px 0 0;
  color: #5e6a7d;
}

.selected-tags {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  margin-top: 10px;
}

.tag {
  padding: 3px 10px;
  border: 1px solid rgba(101, 114, 137, 0.28);
  border-radius: 999px;
  font-size: 12px;
  font-weight: 700;
  color: #42506a;
}

.stat-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
  margin-top: 16px;
}

.stat-box {
  padding: 12px;
  border-radius: 16px;
  background: #f7f9fc;
}

.stat-group {
  display: block;
  margin-bottom: 8px;
  font-size: 12px;
  font-weight: 700;
  color: #5f6c82;
}

.stat-line,
.meta-item {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  align-items: center;
}

.stat-line + .stat-line {
  margin-top: 6px;
}

.stat-line span,
.meta-key,
.buddy-index,
.buddy-copy span {
  font-size: 12px;
  color: #67758a;
}

.stat-line strong,
.meta-value,
.buddy-copy strong {
  color: #1c2940;
}

.meta-list {
  display: grid;
  gap: 10px;
  margin-top: 16px;
}

.buddy-section {
  margin-top: 18px;
}

.buddy-title {
  margin: 0 0 10px;
  font-size: 13px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: #6f7b8e;
}

.buddy-list {
  display: grid;
  gap: 10px;
}

.buddy-item {
  padding: 12px;
  border-radius: 16px;
  background: #f7f9fc;
}

.buddy-copy {
  display: grid;
  gap: 4px;
  margin-top: 4px;
}

@media (max-width: 960px) {
  .chart-container {
    min-height: 440px;
  }

  .plot-meta {
    text-align: left;
  }

  .detail-card {
    margin-top: 12px;
  }
}

@media (max-width: 600px) {
  .status-plot-page {
    padding-top: 12px;
  }

  .hero {
    padding: 22px 18px;
    border-radius: 22px;
  }

  .toolbar {
    align-items: stretch;
  }

  .mode-toggle {
    width: 100%;
  }

  .mode-toggle :deep(.v-btn) {
    flex: 1 1 0;
  }

  .chart-container {
    min-height: 360px;
  }

  .selected-header {
    flex-direction: column;
  }

  .stat-grid {
    grid-template-columns: 1fr;
  }
}
</style>
