<template>
  <figure>
    <div v-if="!ratio" class="legend">
      <span v-for="line in series" :key="line.key" :class="line.key">{{ line.label }}</span>
    </div>
    <div class="plot">
      <Radar :data="data" :options="options" :aria-label="accessibleSummary" />
    </div>
  </figure>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { Radar } from 'vue-chartjs';
import { Chart, Filler, LineElement, PointElement, RadialLinearScale, Tooltip, type ChartOptions } from 'chart.js';

Chart.register(RadialLinearScale, PointElement, LineElement, Filler, Tooltip);
type Measure = { value: number | null; count: number };
type SeriesKey = 'ratio' | 'owned' | 'reference';
const props = defineProps<{
  axes: ({ label: string } & Record<SeriesKey, Measure>)[];
  ratio: boolean;
  withReference: boolean;
}>();
const { locale, t } = useI18n();
const caption = computed(() => t(props.ratio ? 'benchmark.meanRatio' : 'benchmark.meanHighest'));
const series = computed(() => {
  const keys: SeriesKey[] = props.ratio ? ['ratio'] : props.withReference ? ['owned', 'reference'] : ['owned'];
  const names = { ratio: 'scoreRatio', owned: 'ownedPeak', reference: 'referencePeak' };
  return keys.map(key => ({ key, label: t(`benchmark.${names[key]}`) }));
});
const ratioMin = computed(() => {
  const lowest = Math.min(0.8, ...props.axes.map(axis => axis.ratio.value ?? Infinity));
  return Math.floor(lowest * 10) / 10;
});
const formatter = computed(() => new Intl.NumberFormat(locale.value, props.ratio
  ? { style: 'percent', maximumFractionDigits: 1 } : { maximumFractionDigits: 0 }));
const formatted = (value: number | null) => value === null ? '—' : formatter.value.format(value);
const pointLabels = computed(() => props.axes.map(axis =>
  [axis.label, ...series.value.map(({ key }) => formatted(axis[key].value))]));
const accessibleSummary = computed(() => [caption.value, ...series.value.map(({ key, label }) =>
  [label, ...props.axes.map(axis => `${axis.label} ${formatted(axis[key].value)}`)].join(' · '))].join(' / '));
const data = computed(() => ({
  labels: props.axes.map(axis => axis.label),
  datasets: series.value.map(({ key, label }) => {
    const reference = key === 'reference';
    const color = reference ? '#ad521b' : '#1867ad';
    return {
      label, data: props.axes.map(axis => axis[key].value),
      fill: props.ratio && props.axes.every(axis => axis.ratio.value !== null),
      spanGaps: false, borderWidth: 2, borderColor: color, borderDash: reference ? [5, 3] : [],
      backgroundColor: 'rgba(24, 103, 173, 0.15)', pointBackgroundColor: color,
      pointStyle: reference ? 'rectRot' as const : 'circle' as const,
      pointRadius: reference ? 4 : 3, pointHitRadius: 10,
    };
  }),
}));
const options = computed<ChartOptions<'radar'>>(() => {
  const labels = pointLabels.value;
  const format = formatter.value;
  return {
    responsive: true, maintainAspectRatio: false, animation: false,
    scales: { r: {
      min: props.ratio ? ratioMin.value : 0, suggestedMax: 1,
      grid: { color: context => props.ratio && context.tick.value === 1 ? '#8599a9' : '#dce4eb' },
      ticks: { maxTicksLimit: 6, precision: props.ratio ? undefined : 0,
        color: '#516574', font: { size: 10 }, callback: value => format.format(Number(value)) },
      pointLabels: { color: '#263744', font: { size: 12, weight: 600 }, padding: 5,
        callback: (_label, index) => labels[index] },
    } },
    plugins: {
      legend: { display: false },
      tooltip: { mode: 'index', callbacks: { label: item => {
        const line = series.value[item.datasetIndex];
        const measure = props.axes[item.dataIndex][line.key];
        return `${line.label} ${formatted(measure.value)} · ${t('benchmark.targetCount', { n: measure.count })}`;
      } } },
    },
  };
});
</script>

<style scoped>
figure { margin: 6px 0 0; }
.legend { display: flex; justify-content: center; flex-wrap: wrap; gap: 4px 14px; font-size: 12px; }
.legend span { display: inline-flex; align-items: center; gap: 4px; }
.legend span::before { content: ''; width: 16px; border-top: 2px solid #1867ad; }
.legend .reference::before { border-top: 2px dashed #ad521b; }
.plot { position: relative; width: 100%; max-width: 370px; height: clamp(244px, 70vw, 285px); margin-inline: auto; }
</style>
