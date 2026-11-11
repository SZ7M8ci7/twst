<template>
  <section class="comparison" data-testid="formation-comparison">
    <div v-if="!entries.length" class="empty-comparison">
      <p>{{ t('examComparison.empty') }}</p>
      <v-btn variant="text" color="primary" @click="emit('select')">{{ t('examComparison.select') }}</v-btn>
    </div>
    <template v-else>
      <div class="comparison-toolbar">
        <v-btn v-if="!running" color="primary" size="small" data-testid="comparison-start" :disabled="disabled || entries.length < 2" @click="start">{{ t('examComparison.start') }}</v-btn>
        <v-btn v-else variant="outlined" size="small" data-testid="comparison-stop" @click="stop">{{ t('examComparison.stop') }}</v-btn>
        <label class="trial-count">{{ t('examComparison.trials') }}<input :value="evaluationSamples" type="number" inputmode="numeric" min="1000" :max="MAX_COMPARISON_EVALUATION_SAMPLES" step="1000" :disabled="running" :aria-label="t('examComparison.trials')" @change="changeEvaluationSamples($event)" @keydown.enter="changeEvaluationSamples($event)" /><span>{{ t('examComparison.trialUnit') }}</span></label>
      </div>
      <p v-if="status && (running || results.length < entries.length)" role="status" class="help">{{ statusText }}</p>
      <v-progress-linear v-if="running" :model-value="progressPercent" color="primary" class="mb-3" />
      <v-alert v-if="error" type="error" class="my-3">{{ errorText }}</v-alert>
      <template v-if="results.length">
        <div class="graph-tabs" role="tablist" :aria-label="t('examComparison.graphs')">
          <button type="button" role="tab" :aria-selected="graph === 'distribution'" :tabindex="graph === 'distribution' ? 0 : -1" @click="graph = 'distribution'" @keydown.right="switchGraph($event)" @keydown.left="switchGraph($event)">{{ t('examComparison.distribution') }}</button>
          <button type="button" role="tab" :aria-selected="graph === 'reach'" :tabindex="graph === 'reach' ? 0 : -1" @click="graph = 'reach'" @keydown.right="switchGraph($event)" @keydown.left="switchGraph($event)">{{ t('examComparison.reach') }}</button>
        </div>
        <div class="chart-row">
          <div class="chart" role="tabpanel" :aria-label="t(graph === 'distribution' ? 'examComparison.distribution' : 'examComparison.reach')">
            <Bar v-if="graph === 'distribution'" :data="histogramData" :options="barOptions" :aria-label="t('examComparison.distributionLabel')" role="img" />
            <Line v-else :data="reachData" :options="lineOptions" :aria-label="t('examComparison.reachLabel')" role="img" />
          </div>
          <label v-if="graph === 'reach'" class="reach-scale-control">
            <span>{{ t('examComparison.log') }}</span>
            <input v-model.number="reachScaleStrength" type="range" min="0" max="100" step="1" :aria-label="t('examComparison.strength')" aria-orientation="vertical" :aria-valuetext="reachScaleStrength === 0 ? t('examComparison.linear') : `${reachScaleStrength}%`" />
            <span>{{ t('examComparison.linear') }}</span>
          </label>
        </div>
      </template>
      <div class="entries">
        <article v-for="(entry, entryIndex) in entries" :key="entry.id" class="entry" :style="{ '--team-color': colors[entryIndex] }">
          <div class="entry-heading">
            <span class="color-dot" aria-hidden="true" />
            <input :value="entryLabel(entry)" @input="entry.label = ($event.target as HTMLInputElement).value" class="entry-name" :aria-label="t('examComparison.teamName', { number: entryIndex + 1 })" :disabled="running" maxlength="40" />
            <button type="button" class="text-button duplicate-button" :disabled="running || entries.length >= MAX_COMPARISON_ENTRIES" :aria-label="t('examComparison.duplicateTeam', { name: entryLabel(entry) })" data-testid="comparison-duplicate" @click="duplicate(entry)">{{ t('examComparison.duplicate') }}</button>
            <button type="button" class="icon-button" :disabled="running" :aria-label="t('examComparison.removeTeam', { name: entryLabel(entry) })" :title="t('examSearch.remove')" @click="remove(entry.id)"><v-icon size="19">mdi-close</v-icon></button>
          </div>
          <div class="cards">
            <div v-for="(card, index) in entry.candidate.cards" :key="index" class="card">
              <figure :title="cardLabel(card.name)">
                <div class="card-image"><img :src="cardImages[card.name] || defaultImg" :alt="cardLabel(card.name)" /><span v-if="card.support" class="support-badge" :title="t('examSearch.support')">S</span></div>
                <figcaption class="selected-magic-icons" :aria-label="`M${selectedMagicFor(entry, index).join('/M')}`">
                  <span v-for="magic in [1, 2, 3]" :key="magic" class="magic-icon" :class="{ selected: selectedMagicFor(entry, index).includes(magic as 1 | 2 | 3) }">M{{ magic }}</span>
                </figcaption>
              </figure>
              <select :value="card.totsu" :aria-label="t('examComparison.breaks', { name: cardLabel(card.name) })" :disabled="running" @change="changeTotsu(entry, index, ($event.target as HTMLSelectElement).value)"><option v-for="n in 5" :key="n" :value="n - 1">{{ t('examComparison.breakCount', { count: n - 1 }) }}</option></select>
              <label class="level-input"><span>Lv</span><input :value="card.level" :aria-label="t('examComparison.level', { name: cardLabel(card.name) })" type="number" inputmode="numeric" min="1" :max="maxLevel(card)" :title="t('examComparison.levelRange', { max: maxLevel(card) })" :disabled="running" @change="changeLevel(entry, index, $event)" @blur="changeLevel(entry, index, $event)" @keydown.enter="changeLevel(entry, index, $event)" /></label>
            </div>
          </div>
        </article>
      </div>
    </template>
  </section>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { Bar, Line } from 'vue-chartjs';
import { Chart, registerables, type ChartOptions } from 'chart.js';
import cards from '@/assets/chara.json';
import defaultImg from '@/assets/img/default.webp';
import { getMaxLevelAtLimitBreak } from '@/constants/levels';
import { comparisonHistogram, comparisonScoreRange, comparisonSummary, type ComparisonEntry, type ComparisonProgress, type ComparisonResult } from '@/domain/examSearch/comparison';
import { COMPARISON_EVALUATION_SAMPLES, MAX_COMPARISON_EVALUATION_SAMPLES, MAX_COMPARISON_ENTRIES } from '@/domain/examSearch/sampling';
import type { SearchCard, SearchInput, SearchResult } from '@/domain/examSearch/types';
Chart.register(...registerables);
const { t, locale } = useI18n();
const props = defineProps<{ disabled: boolean; contextKey: string; cardImages: Record<string, string>; cardLabel: (name: string) => string }>();
const emit = defineEmits<{ (event: 'busy', value: boolean): void; (event: 'select'): void }>();
const catalog = Object.fromEntries(cards.map(c => [c.name, c]));
const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value));
const colors = ['#1967b3', '#ce5422', '#16816b', '#914eb6', '#9b7310', '#c13978'];
const entries = ref<ComparisonEntry[]>([]), results = ref<ComparisonResult[]>([]), sourceInput = ref<SearchInput>();
const running = ref(false), error = ref(''), status = ref(''), progress = ref<ComparisonProgress>();
const graph = ref<'distribution' | 'reach'>('reach');
const reachScaleStrength = ref(0);
const evaluationSamples = ref(COMPARISON_EVALUATION_SAMPLES);
const count = computed(() => entries.value.length);
const selectedIds = computed(() => entries.value.flatMap(entry => entry.sourceId ? [entry.sourceId] : []));
function switchGraph(event: KeyboardEvent) {
  event.preventDefault();
  graph.value = graph.value === 'distribution' ? 'reach' : 'distribution';
  const buttons = (event.currentTarget as HTMLElement).parentElement?.querySelectorAll<HTMLButtonElement>('button');
  buttons?.[graph.value === 'distribution' ? 0 : 1]?.focus();
}
let worker: Worker | undefined, serial = 0;
const number = (n: number) => Math.round(n).toLocaleString(locale.value);
const summaries = computed(() => entries.value.flatMap((entry, index) => {
  const result = results.value.find(r => r.id === entry.id);
  return result ? [{ entry, result, stats: comparisonSummary(result.samples), color: colors[index] }] : [];
}));
const entryLabel = (entry: ComparisonEntry) => entry.label || t('examComparison.team', { number: entry.id.replace('comparison-', '') });
const statusText = computed(() => {
  const p = progress.value;
  if (status.value === 'progress' && p) return t('examComparison.progress', {
    name: entryLabel(entries.value[p.index]), index: p.index + 1, total: entries.value.length,
    phase: t(`examComparison.${p.phase}`), done: number(p.done), count: number(p.total),
  });
  return status.value ? t(`examComparison.${status.value}`) : '';
});
const errorText = computed(() => error.value.startsWith('examComparison.errors.')
  ? t(error.value, { max: number(MAX_COMPARISON_EVALUATION_SAMPLES) })
  : t('examComparison.failure', { message: error.value }));
const resultFor = (id: string) => results.value.find(result => result.id === id);
const selectedMagicFor = (entry: ComparisonEntry, index: number) =>
  (resultFor(entry.id)?.candidate.cards[index] ?? entry.candidate.cards[index]).selectedMagic;
const maxLevel = (card: SearchCard) => getMaxLevelAtLimitBreak(catalog[card.name].rare, card.totsu);
const histogramData = computed(() => {
  const histogram = comparisonHistogram(summaries.value.map(row => row.result));
  return { labels: histogram.labels, datasets: summaries.value.map((row, index) => ({ label: entryLabel(row.entry), data: histogram.values[index], backgroundColor: row.color + 'aa' })) };
});
// Normalize the softened logarithm to 0–100; strength zero is exactly linear.
const reachScaleCurve = computed(() => Math.expm1(reachScaleStrength.value / 100 * Math.log1p(100000)));
function reachY(rate: number) {
  const curve = reachScaleCurve.value;
  return curve === 0 ? rate : 100 * Math.log1p(curve * rate / 100) / Math.log1p(curve);
}
const scoreRange = computed(() => comparisonScoreRange(summaries.value.map(row => row.result)));
const reachRates = computed(() => {
  const range = scoreRange.value;
  const thresholds = range ? [...new Set(Array.from({ length: 61 }, (_, i) =>
    range.min + Math.ceil((range.max + 1 - range.min) * i / 60)))] : [];
  return { datasets: summaries.value.map(row => ({ label: entryLabel(row.entry), borderColor: row.color, backgroundColor: row.color, pointRadius: 0,
    data: thresholds.map(x => {
      const reached = row.result.samples.scores.filter(score => score >= x).length;
      return { x, y: row.stats.n > 0 ? reached / row.stats.n * 100 : 0 };
    }) })) };
});
const reachData = computed(() => ({ datasets: reachRates.value.datasets.map(dataset => ({ ...dataset,
  data: dataset.data.map(point => ({ x: point.x, y: reachY(point.y), rate: point.y })),
})) }));
const barOptions = computed<ChartOptions<'bar'>>(() => ({ responsive: true, maintainAspectRatio: false, animation: false, plugins: { legend: { position: 'bottom' } }, scales: { y: { beginAtZero: true, title: { display: true, text: t('examComparison.shareAxis') } }, x: { ticks: { maxTicksLimit: 6 }, title: { display: true, text: t('examComparison.scoreAxis') } } } }));
const lineOptions = computed<ChartOptions<'line'>>(() => {
  // Keep percentage labels readable as their spacing changes with the slider.
  const ticks = [{ value: 0, label: '0%' }];
  for (const rate of [.001, .01, .1, 1, 5, 10, 20, 40, 60, 80]) {
    const value = reachY(rate);
    if (value - ticks[ticks.length - 1].value >= 12 && value <= 88) ticks.push({ value, label: `${rate}%` });
  }
  ticks.push({ value: 100, label: '100%' });
  return { responsive: true, maintainAspectRatio: false, animation: false,
  interaction: { mode: 'index', intersect: false },
  plugins: { legend: { position: 'bottom' }, tooltip: { callbacks: {
    title: items => t('examComparison.threshold', { score: number(items[0]?.parsed.x ?? 0) }),
    label: item => `${item.dataset.label}: ${(item.raw as { rate: number }).rate.toLocaleString(locale.value, { maximumFractionDigits: 4 })}%`,
  } } },
  scales: { y: { type: 'linear', min: 0, max: 100,
    afterBuildTicks: axis => { axis.ticks = ticks.map(tick => ({ ...tick })); },
    ticks: { autoSkip: false, callback: (_value, index) => ticks[index].label },
    title: { display: true, text: t(reachScaleStrength.value === 0 ? 'examComparison.reachLinearAxis' : 'examComparison.reachLogAxis') } }, x: { type: 'linear', min: scoreRange.value?.min ?? 1, max: (scoreRange.value?.max ?? 1) + 1, title: { display: true, text: t('examComparison.scoreAxis') } } } };
});
const progressPercent = computed(() => {
  const p = progress.value; if (!p) return 0;
  return (p.index + ({ search: 0, refine: .5, validate: .75 }[p.phase]) + p.done / p.total * (p.phase === 'search' ? .5 : .25)) / entries.value.length * 100;
});
function invalidate() { results.value = []; status.value = ''; error.value = ''; }
function changeEvaluationSamples(event: Event) {
  const field = event.target as HTMLInputElement;
  const value = int(field.value, MAX_COMPARISON_EVALUATION_SAMPLES, 1000);
  field.value = String(value);
  if (evaluationSamples.value !== value) { evaluationSamples.value = value; invalidate(); }
}
function add(result: SearchResult, input: SearchInput) {
  if (running.value || entries.value.length >= MAX_COMPARISON_ENTRIES) return;
  sourceInput.value = clone(input);
  const candidate = clone(result.candidate);
  candidate.cards.forEach(card => { card.level = Math.min(card.level, maxLevel(card)); });
  entries.value.push({ id: `comparison-${++serial}`, label: '', candidate, sourceId: result.candidate.id });
  invalidate();
}
function toggle(result: SearchResult, input: SearchInput) {
  if (running.value) return;
  const selected = entries.value.find(entry => entry.sourceId === result.candidate.id);
  if (selected) remove(selected.id);
  else add(result, input);
}
function duplicate(entry: ComparisonEntry) {
  if (running.value || entries.value.length >= MAX_COMPARISON_ENTRIES) return;
  entries.value.push({ ...clone(entry), id: `comparison-${++serial}`, sourceId: undefined, label: '' }); invalidate();
}
function remove(id: string) { entries.value = entries.value.filter(e => e.id !== id); invalidate(); }
function clear() { entries.value = []; sourceInput.value = undefined; invalidate(); }
function int(value: string, max: number, min = 1) { const n = Number(value); return Number.isFinite(n) ? Math.max(min, Math.min(max, Math.trunc(n))) : min; }
function changeTotsu(entry: ComparisonEntry, index: number, value: string) {
  const card = entry.candidate.cards[index]; card.totsu = int(value, 4, 0);
  card.level = Math.min(card.level, maxLevel(card)); invalidate();
}
function changeLevel(entry: ComparisonEntry, index: number, event: Event) {
  const field = event.target as HTMLInputElement, card = entry.candidate.cards[index];
  const level = int(field.value, maxLevel(card));
  field.value = String(level);
  if (card.level !== level) { card.level = level; invalidate(); }
}
function finish() { worker?.terminate(); worker = undefined; running.value = false; emit('busy', false); }
function stop() { finish(); status.value = 'stopped'; }
function start() {
  if (running.value || props.disabled || entries.value.length < 2 || !sourceInput.value) return;
  invalidate(); progress.value = undefined; running.value = true; emit('busy', true); status.value = 'preparing';
  try {
    worker = new Worker(new URL('../workers/examComparison.worker.ts', import.meta.url), { type: 'module' });
    const activeWorker = worker;
    worker.onmessage = ({ data }) => {
      if (worker !== activeWorker) return;
      if (data.progress) { progress.value = data.progress; status.value = 'progress'; }
      if (data.result) results.value.push(data.result);
      if (data.error) { error.value = data.errorCode ? `examComparison.errors.${data.errorCode}` : data.error; status.value = 'failed'; finish(); }
      if (data.done) { status.value = 'done'; finish(); }
    };
    worker.onerror = event => { if (worker !== activeWorker) return; error.value = event.message; status.value = ''; finish(); };
    worker.postMessage({ method: 'start', request: clone({ input: sourceInput.value, entries: entries.value, evaluationSamples: evaluationSamples.value, nonce: `compare:${Date.now()}:${Math.random()}` }) });
  } catch (e) { error.value = String(e); finish(); }
}
watch(() => props.contextKey, () => { finish(); clear(); });
onBeforeUnmount(finish);
defineExpose({ toggle, stop, count, selectedIds });
</script>

<style scoped>
.comparison { max-width: 1060px; margin: 0 auto; color: #24384a; }
.entry-heading, .comparison-toolbar { display: flex; align-items: center; gap: 6px; }
.help, small { color: #657582; font-size: .78rem; }.help { margin: 8px 0; }
.entries { display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 320px)); gap: 12px 20px; }
.entry { min-width: 0; }
.entry-heading { margin-bottom: 4px; }.color-dot { width: 8px; height: 8px; border-radius: 50%; background: var(--team-color); flex-shrink: 0; }
input, select { min-width: 0; border: 1px solid #c7d3dd; border-radius: 4px; background: #fff; color: #24384a; font-size: .85rem; padding: 5px 6px; }
input:focus-visible, select:focus-visible, button:focus-visible, summary:focus-visible { outline: 2px solid #1967b3; outline-offset: 2px; }
:disabled { opacity: .5; cursor: default; }.entry-name { flex: 1; width: 0; border-color: transparent; padding: 3px; font-weight: 600; }.entry-name:hover { border-color: #c7d3dd; }
.icon-button { display: grid; place-items: center; width: 28px; height: 28px; border-radius: 4px; color: #657582; flex-shrink: 0; }.icon-button:hover:not(:disabled) { background: #edf3f8; }
.cards { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 5px; }.card { min-width: 0; display: grid; gap: 3px; align-content: start; }
.card figure { margin: 0; min-width: 0; border: 1px solid #ccd8e2; border-radius: 5px; overflow: hidden; }
.card-image { position: relative; aspect-ratio: 1; overflow: hidden; background: #eef3f7; }.card-image img { display: block; width: 100%; height: auto; object-fit: cover; }.support-badge { position: absolute; top: 3px; left: 3px; background: #14202bcc; color: #fff; font-size: 10px; font-weight: 800; padding: 0 3px; border-radius: 3px; }
.selected-magic-icons { display: flex; gap: 2px; padding: 2px; background: #152336c9; }
.magic-icon { flex: 1; border-radius: 2px; text-align: center; font-size: 9px; line-height: 14px; color: #ffffff66; }
.magic-icon.selected { background: #fff; color: #173e65; font-weight: 800; }
.card select { width: 100%; padding: 4px; font-size: .75rem; }.level-input { display: flex; align-items: center; border: 1px solid #c7d3dd; border-radius: 4px; padding-left: 5px; gap: 2px; }.level-input span { color: #657582; font-size: .65rem; }.level-input input { width: 100%; border: 0; padding: 4px 2px; font-size: .8rem; appearance: textfield; -moz-appearance: textfield; }.level-input input::-webkit-inner-spin-button, .level-input input::-webkit-outer-spin-button { appearance: none; margin: 0; }
.text-button { color: #1967b3; font-size: .75rem; padding: 4px 0; white-space: nowrap; }.duplicate-button { padding: 4px; }
.comparison-toolbar { margin: 8px 0; flex-wrap: wrap; gap: 12px; }.entries { margin-top: 8px; }
.trial-count { display: flex; align-items: center; gap: 5px; font-size: .75rem; color: #657582; white-space: nowrap; }
.trial-count input { width: 90px; padding: 4px 6px; font-size: .8rem; }
.graph-tabs { display: flex; gap: 20px; margin-top: 18px; border-bottom: 1px solid #d9e2ea; }.graph-tabs button { padding: 8px 0; font-size: .85rem; color: #657582; border-bottom: 2px solid transparent; }.graph-tabs button[aria-selected='true'] { border-color: #1967b3; color: #1967b3; }
.chart-row { display: flex; align-items: stretch; gap: 8px; margin-top: 12px; }
.chart { position: relative; height: 320px; min-width: 0; flex: 1; }
.empty-comparison { padding: 48px 12px; text-align: center; color: #657582; font-size: .85rem; }
.reach-scale-control { display: flex; flex-direction: column; align-items: center; gap: 5px; width: 42px; flex-shrink: 0; padding: 8px 0 40px; font-size: .65rem; color: #657582; }
.reach-scale-control input { writing-mode: vertical-lr; direction: rtl; width: 28px; height: 0; flex: 1; min-height: 0; margin: 0; padding: 0; border: 0; accent-color: #1967b3; cursor: pointer; }
@media (max-width: 700px) { .entries { grid-template-columns: repeat(auto-fit, minmax(250px, 300px)); gap: 10px 16px; }.chart { height: 280px; } }
@media (max-width: 340px) { .entries { grid-template-columns: minmax(0, 1fr); } }
</style>
