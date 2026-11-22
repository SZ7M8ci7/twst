<template>
  <v-container class="benchmark">
    <h1>{{ t('tool.examBenchmark') }}</h1>
    <section class="controls">
      <div class="fields condition-fields">
        <label>{{ t('benchmark.series') }}
          <select v-model="series" :disabled="busy">
            <option value="any">{{ t('benchmark.bothSeries') }}</option>
            <option value="normal">{{ t('examSimulator.normalPresets') }}</option>
            <option value="unified">{{ t('examSimulator.unifiedPresets') }}</option>
          </select>
        </label>
        <label>{{ t('benchmark.kind') }}
          <select v-model="kind" :disabled="busy">
            <option value="any">{{ t('benchmark.allKinds') }}</option>
            <option v-for="k in kinds" :key="k" :value="k">{{ k }}</option>
          </select>
        </label>
        <label>{{ t('examSimulator.enemyElement') }}
          <select v-model="element" :disabled="busy">
            <option value="any">{{ t('benchmark.any') }}</option>
            <option v-for="e in elements" :key="e" :value="e">{{ display(e) }}</option>
          </select>
        </label>
        <label>{{ t('benchmark.searchDepth') }}
          <select v-model="searchDepth" :disabled="busy">
            <option value="standard">{{ t('benchmark.standardDepth') }}</option>
            <option value="thorough">{{ t('benchmark.thoroughDepth') }}</option>
          </select>
        </label>
      </div>
      <div class="options">
        <div class="selection-mode" role="radiogroup" :aria-label="t('benchmark.selectionMode')">
          <label v-for="mode in selectionModes" :key="mode">
            <input v-model="selectionMode" type="radio" name="benchmark-selection" :value="mode" :disabled="busy">
            <span>{{ t(mode === 'latest' ? 'benchmark.latestPerGroup' : 'benchmark.manual') }}</span>
          </label>
        </div>
        <label><input v-model="includeReference" type="checkbox" :disabled="busy"> {{ t('benchmark.includeReference') }}</label>
        <select v-if="includeReference" v-model="referenceSource" :disabled="busy" :aria-label="t('benchmark.referenceSource')">
          <option v-for="source in referenceSources" :key="source" :value="source">{{ t('examSearch.rosterOptions.' + source) }}</option>
        </select>
      </div>
      <fieldset class="restrictions" :disabled="busy">
        <RequiredCardPicker v-model="requiredCards" :label="t('examSearch.cardFilter')" :catalog-mode="includeReference && referenceSource === 'allMax'" />
        <button type="button" class="compact-button" @click="characterDialog = true">
          {{ t('examSearch.characterFilter') }}<span v-if="requiredCharacters.length"> {{ requiredCharacters.length }}/5</span>
        </button>
        <RequiredCharacterDialog v-model="requiredCharacters" v-model:open="characterDialog" />
      </fieldset>
      <template v-if="selectionMode === 'manual'">
        <div class="bulk-actions" role="group" :aria-label="t('benchmark.bulkSelect')">
          <button type="button" class="compact-button" :disabled="busy || !available.length" @click="selectExams(available)">{{ t('support.selectAll') }}</button>
          <button type="button" class="compact-button" :disabled="busy || !selected.length" @click="clearVisibleExams">{{ t('support.deselectAll') }}</button>
          <button v-for="group in bulkGroups" :key="group.key" type="button" class="compact-button" :disabled="busy"
            @click="selectExams(group.exams)">{{ group.label }}</button>
        </div>
        <div class="choices">
          <label v-for="preset in available" :key="preset.id">
            <input v-model="manualIds" type="checkbox" :value="preset.id" :disabled="busy"> {{ display(preset.title) }}
          </label>
        </div>
      </template>
      <div class="actions">
        <v-btn v-if="!busy" color="primary" size="small" :disabled="!canStart" @click="start">{{ t('benchmark.start') }}</v-btn>
        <v-btn v-else variant="outlined" size="small" @click="stop">{{ t('examSimulator.stop') }}</v-btn>
        <span>{{ t('benchmark.targetCount', { n: selected.length }) }}</span>
        <RouterLink v-if="selected.length && !canStart" :to="{ name: 'handCollection' }">{{ t('tool.handCollection') }}</RouterLink>
      </div>
    </section>
    <div v-if="queue.length" class="progress" role="status">
      <span>{{ t(busy ? 'benchmark.running' : stopped ? 'benchmark.stopped' : 'benchmark.finished') }} · {{ completed }} / {{ queue.length }}</span>
      <span v-if="busy && current">{{ display(current.title) }}</span>
      <v-progress-linear v-if="busy" :model-value="100 * completed / queue.length" color="primary" height="3" />
    </div>
    <section v-if="rows.length" class="results">
      <div class="result-filters">
        <div class="result-summary">
          <v-dialog v-model="filterOpen" max-width="410" aria-labelledby="benchmark-filter-title">
            <template #activator="{ props }">
              <v-btn v-bind="props" class="result-filter-button" size="small" variant="outlined" prepend-icon="mdi-filter-outline">{{ t('benchmark.filter') }}</v-btn>
            </template>
            <v-card>
              <v-card-title id="benchmark-filter-title">{{ t('benchmark.filter') }}</v-card-title>
              <v-card-text class="filter-content">
                <div v-for="group in filterGroups" :key="group.key" class="filter-group" role="group" :aria-label="group.label">
                  <span class="filter-label">{{ group.label }}</span>
                  <div class="filter-options">
                    <label v-for="option in group.options" :key="option.value">
                      <input v-model="resultFilters[group.key]" type="checkbox" :value="option.value"> {{ option.label }}
                    </label>
                  </div>
                </div>
              </v-card-text>
              <v-card-actions>
                <v-btn color="primary" @click="filterOpen = false">{{ t('search.close') }}</v-btn>
              </v-card-actions>
            </v-card>
          </v-dialog>
          <div v-if="ranReference && resultTab !== 'analysis'" class="selection-mode" role="radiogroup" :aria-label="t('benchmark.resultRoster')">
            <label v-for="source in rosterChoices" :key="source">
              <input v-model="lane" type="radio" name="benchmark-result-roster" :value="source">
              <span>{{ t('examSearch.rosterOptions.' + (source === 'owned' ? 'owned' : ranReferenceSource)) }}</span>
            </label>
          </div>
          <span v-if="winners.length && resultTab !== 'analysis'">{{ t('benchmark.meanHighest') }} <b>{{ number(summary.meanHighest) }}</b></span>
        </div>
      </div>
      <v-tabs v-model="resultTab" density="compact" color="primary">
        <v-tab value="teams">{{ t('examSearch.table.deck') }}</v-tab>
        <v-tab value="ranking">{{ t('benchmark.ranking') }}</v-tab>
        <v-tab value="analysis">{{ t('benchmark.analysis') }}</v-tab>
      </v-tabs>
      <p v-if="!details.length" class="empty-results" role="status">{{ t(busy && queue.some(matchesResultFilters) ? 'benchmark.running' : 'benchmark.noMatches') }}</p>
      <div v-else-if="resultTab === 'teams'" class="table-scroll">
        <table class="team-table" :class="{ 'with-reference': ranReference }">
          <thead><tr>
            <th scope="col">{{ t('benchmark.kind') }}</th>
            <th scope="col">
              <span v-if="ranReference" class="score-order">{{ t('benchmark.topToBottom') }}</span>
              {{ t(ranReference ? 'benchmark.ownedPeak' : 'examSearch.table.highest') }}
            </th>
            <template v-if="ranReference">
              <th scope="col">{{ t('benchmark.referencePeak') }}</th>
              <th v-for="column in comparisonColumns" :key="column.key" scope="col"
                :aria-sort="sort?.key === column.key ? sort.direction : undefined">
                <button type="button" :title="t(column.formula)" @click="sortBy(column.key)">
                  {{ t(column.label) }} <span aria-hidden="true">{{ sort?.key !== column.key ? '↕' : sort.direction === 'descending' ? '↓' : '↑' }}</span>
                </button>
              </th>
            </template>
            <th scope="col">{{ t('examSearch.table.deck') }}</th>
          </tr></thead>
          <tbody><tr v-for="row in teamRows" :key="row.preset.id" class="team">
            <th scope="row" :data-element="row.preset.enemyElement" :title="display(row.preset.title)">
              <span v-if="examUsesSupport(row.preset)" class="series-label">{{ t('benchmark.unifiedLabel') }}</span>
              {{ shortExamLabel(row.preset) }}
            </th>
            <td>{{ number(row.owned?.winner?.highest ?? null) }}</td>
            <template v-if="ranReference">
              <td>{{ number(row.reference?.winner?.highest ?? null) }}</td>
              <td class="gap">{{ row.gap === null ? '—' : signedPoints.format(row.gap) }}</td>
              <td>{{ row.ratio === null ? '—' : percent.format(row.ratio) }}</td>
            </template>
            <td>
              <div v-if="row.winner" class="deck">
                <ExamResultCard v-for="(card, i) in row.winner.cards" :key="i" :card="card" :label="cardTitle(card.name)" :src="images[card.name]" />
              </div>
              <span v-else>{{ row.message }}</span>
            </td>
          </tr></tbody>
        </table>
      </div>
      <div v-else-if="resultTab === 'analysis'" class="analysis">
        <div class="analysis-controls">
          <select v-model="analysisGroup" :aria-label="t('benchmark.analysisGroup')">
            <option value="element">{{ t('benchmark.byElement') }}</option>
            <option value="kind">{{ t('benchmark.byKind') }}</option>
          </select>
          <select v-model="analysisMetric" :aria-label="t('benchmark.analysisMetric')">
            <option v-if="ranReference" value="ratio">{{ t('benchmark.scoreRatio') }}</option>
            <option value="score">{{ t('basic.score') }}</option>
          </select>
        </div>
        <BenchmarkRadar v-if="hasAnalysisData" :axes="analysisAxes"
          :ratio="analysisMetric === 'ratio'" :with-reference="ranReference" :reference-label="t('examSearch.rosterOptions.' + ranReferenceSource)" />
        <p v-else role="status">{{ t(busy ? 'benchmark.running' : 'benchmark.noTrials') }}</p>
      </div>
      <ol v-else-if="winners.length" class="ranking">
        <li v-for="card in summary.ranking" :key="card.name" :title="`${cardTitle(card.name)} · ${t('benchmark.adoption')} ${card.exams}/${winners.length}`">
          <img :src="images[card.name] || fallback" :alt="cardTitle(card.name)" loading="lazy">
          <b>×{{ card.slots }}</b>
        </li>
      </ol>
      <p v-else class="progress">{{ t(busy ? 'benchmark.running' : 'benchmark.noTrials') }}</p>
    </section>
  </v-container>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref, shallowReactive, shallowRef } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRoute } from 'vue-router';
import cards from '@/assets/chara.json';
import fallback from '@/assets/img/default.webp';
import { examPresetDefinitions, type ExamPresetDefinition, type ExamPresetKind, type ExamPresetElement } from '@/utils/examPresets';
import { localizeCardTitle, localizeGameText } from '@/utils/localizedDisplay';
import { loadImageUrls } from '@/utils/characterAssets';
import { fullyTrainedCard, maxSkillsCard } from '@/domain/examSearch/roster';
import { useHandCollectionStore } from '@/store/handCollection';
import { examUsesSupport } from '@/domain/examSearch/variants';
import { groupBenchmarkPresets, summarizeBenchmark, type BenchmarkWinner } from '@/domain/examSearch/benchmark';
import type { RosterCard, SearchInput } from '@/domain/examSearch/types';
import type { BenchmarkDepth } from '@/domain/examSearch/benchmarkWork';
import ExamResultCard from '@/components/ExamResultCard.vue';
import BenchmarkRadar from '@/components/BenchmarkRadar.vue';
import RequiredCardPicker from '@/components/RequiredCardPicker.vue';
import RequiredCharacterDialog from '@/components/RequiredCharacterDialog.vue';

const { t, te, locale } = useI18n();
const route = useRoute();
const kinds: ExamPresetKind[] = ['BASIC', 'ATTACK', 'DEFENCE'];
const elements: ExamPresetElement[] = ['火', '水', '木', '無', '全'];
const origin = examPresetDefinitions.find(p => p.id === route.query.preset);
const kind = ref<ExamPresetKind | 'any'>(kinds.find(k => k === route.query.kind) ?? origin?.kind ?? 'any');
const series = ref(origin ? (examUsesSupport(origin) ? 'unified' : 'normal') : 'any');
const element = ref<ExamPresetElement | 'any'>('any');
const selectionModes = ['latest', 'manual'] as const;
const selectionMode = ref<typeof selectionModes[number]>('latest');
const manualIds = ref<string[]>([]);
const groups = [...groupBenchmarkPresets(examPresetDefinitions).values()].sort(([a], [b]) =>
  Number(examUsesSupport(a)) - Number(examUsesSupport(b)) ||
  kinds.indexOf(a.kind) - kinds.indexOf(b.kind) || elements.indexOf(a.enemyElement) - elements.indexOf(b.enemyElement));
const availableGroups = computed(() => groups.filter(([p]) =>
  (kind.value === 'any' || p.kind === kind.value) && (element.value === 'any' || p.enemyElement === element.value)
  && (series.value === 'any' || examUsesSupport(p) === (series.value === 'unified'))));
const available = computed(() => availableGroups.value.flat());
const selected = computed(() => selectionMode.value === 'manual' ? available.value.filter(p => manualIds.value.includes(p.id))
  : availableGroups.value.map(group => group[0]));
const catalog = new Map(cards.map(c => [c.name, c]));
const fullRoster = cards.map(fullyTrainedCard);
const hand = useHandCollectionStore();
const owned = computed(() => hand.ownedCards.filter(c => catalog.has(c.cardName) && c.level >= 1)
  .map(c => maxSkillsCard(c.cardName, c.level, c.totsu)));
const includeReference = ref(true);
const referenceSources = ['allMax', 'ownedMax'] as const;
type ReferenceSource = typeof referenceSources[number];
const referenceSource = ref<ReferenceSource>('allMax');
const ranReferenceSource = ref<ReferenceSource>('allMax');
const requiredCards = ref<string[]>([]);
const requiredCharacters = ref<string[]>([]);
const characterDialog = ref(false);
const referenceRoster = computed(() => {
  if (referenceSource.value === 'allMax') return fullRoster;
  const names = new Set(owned.value.map(card => card.name));
  return fullRoster.filter(card => names.has(card.name));
});
const searchDepth = ref<BenchmarkDepth>('standard');
const required = (p: ExamPresetDefinition) => examUsesSupport(p) ? 4 : 5;
const canStart = computed(() => selected.value.some(p => owned.value.length >= required(p)
  || (includeReference.value && referenceRoster.value.length >= required(p))));
const display = (value: string) => localizeGameText(value, locale.value);
const kindAbbreviations = { BASIC: 'BS', ATTACK: 'ATK', DEFENCE: 'DF' } as const;
const bulkGroups = computed(() => [
  ...elements.map(key => ({ key, label: display(key), exams: available.value.filter(p => p.enemyElement === key) })),
  ...kinds.map(key => ({ key, label: kindAbbreviations[key], exams: available.value.filter(p => p.kind === key) })),
].filter(group => group.exams.length));
function selectExams(exams: ExamPresetDefinition[]) {
  manualIds.value = [...new Set([...manualIds.value, ...exams.map(p => p.id)])];
}
function clearVisibleExams() {
  const visibleIds = new Set(available.value.map(p => p.id));
  manualIds.value = manualIds.value.filter(id => !visibleIds.has(id));
}
function shortExamLabel(preset: ExamPresetDefinition) {
  return t('benchmark.normalGroup', {
    element: display(preset.enemyElement), kind: kindAbbreviations[preset.kind],
  });
}
function cardTitle(name: string) {
  const card = catalog.get(name);
  return card ? localizeCardTitle(card, locale.value) : name;
}
const number = (value: number | null) => value === null ? '—' : Math.round(value).toLocaleString(locale.value);
const percent = computed(() => new Intl.NumberFormat(locale.value, { style: 'percent', maximumFractionDigits: 1 }));
const signedPoints = computed(() => new Intl.NumberFormat(locale.value, { signDisplay: 'exceptZero', maximumFractionDigits: 0 }));
const images = shallowRef<Record<string, string>>({});
void loadImageUrls(cards, 'name', '', 'notyet').then(urls => { images.value = urls; });

type Lane = 'owned' | 'reference';
interface Outcome { winner: BenchmarkWinner | null; error?: string; missing?: number }
interface ExamRow { preset: ExamPresetDefinition; owned?: Outcome; reference?: Outcome }
const rows = shallowRef<ExamRow[]>([]);
const queue = shallowRef<ExamPresetDefinition[]>([]);
const completed = ref(0);
const current = computed(() => queue.value[completed.value]);
const ranReference = ref(false);
const lane = ref<Lane>('owned');
const rosterChoices = ['owned', 'reference'] as const;
const resultSeries = (preset: ExamPresetDefinition) => examUsesSupport(preset) ? 'unified' : 'normal';
const filterGroups = computed(() => [
  { key: 'elements', label: t('examSimulator.enemyElement'), options: elements.filter(e => queue.value.some(p => p.enemyElement === e)).map(value => ({ value, label: display(value) })) },
  { key: 'kinds', label: t('benchmark.kind'), options: kinds.filter(k => queue.value.some(p => p.kind === k)).map(value => ({ value, label: kindAbbreviations[value] })) },
  { key: 'series', label: t('benchmark.series'), options: ['normal', 'unified'].filter(s => queue.value.some(p => resultSeries(p) === s)).map(value => ({
    value, label: t(value === 'normal' ? 'examSimulator.normalPresets' : 'examSimulator.unifiedPresets'),
  })) },
] as const);
const resultFilters = ref<Record<'elements' | 'kinds' | 'series', string[]>>({ elements: [], kinds: [], series: [] });
const filterOpen = ref(false);
function matchesResultFilters(preset: ExamPresetDefinition) {
  const filters = resultFilters.value;
  return filters.elements.includes(preset.enemyElement) && filters.kinds.includes(preset.kind) && filters.series.includes(resultSeries(preset));
}
const resultTab = ref<'teams' | 'ranking' | 'analysis'>('teams');
const analysisGroup = ref<'element' | 'kind'>('element');
const analysisMetric = ref<'ratio' | 'score'>('ratio');
const comparisonColumns = [
  { key: 'gap', label: 'benchmark.scoreGap', formula: 'benchmark.gapFormula' },
  { key: 'ratio', label: 'benchmark.scoreRatio', formula: 'benchmark.ratioFormula' },
] as const;
type ComparisonKey = typeof comparisonColumns[number]['key'];
const sort = ref<{ key: ComparisonKey; direction: 'ascending' | 'descending' } | null>(null);
function sortBy(key: ComparisonKey) {
  const ascending = sort.value?.key !== key || sort.value.direction === 'descending';
  sort.value = { key, direction: ascending ? 'ascending' : 'descending' };
}
const details = computed(() => rows.value.filter(row => matchesResultFilters(row.preset))
  .map(row => {
    const result = row[lane.value];
    let message = t('benchmark.noTrials');
    if (!result) message = t(busy.value ? 'benchmark.running' : 'benchmark.stopped');
    else if (result.missing) message = t('benchmark.missing', { n: result.missing });
    else if (result.error) message = t('benchmark.failure', { detail: result.error });
    const ownedPeak = row.owned?.winner?.highest;
    const referencePeak = row.reference?.winner?.highest;
    const gap = ownedPeak !== undefined && referencePeak !== undefined ? ownedPeak - referencePeak : null;
    const ratio = ownedPeak !== undefined && referencePeak !== undefined && referencePeak > 0 ? ownedPeak / referencePeak : null;
    return { ...row, winner: result?.winner, message, gap, ratio };
  }));
const teamRows = computed(() => {
  if (!ranReference.value || !sort.value) return details.value;
  const { key, direction } = sort.value;
  return [...details.value].sort((a, b) => {
    const left = a[key], right = b[key];
    if (left === null || right === null) return Number(left === null) - Number(right === null);
    return direction === 'descending' ? right - left : left - right;
  });
});
const winners = computed(() => details.value.flatMap(row => row.winner ? [row.winner] : []));
function averageMeasured(values: (number | null | undefined)[]) {
  const measured = values.filter((value): value is number => value != null);
  return { value: measured.length ? measured.reduce((a, b) => a + b, 0) / measured.length : null, count: measured.length };
}
const analysisAxes = computed(() => {
  const byElement = analysisGroup.value === 'element';
  const axes = byElement
    ? elements.map(key => ({ key, label: display(key) }))
    : kinds.map(key => ({ key, label: kindAbbreviations[key] }));
  return axes.map(({ key, label }) => {
    const group = details.value.filter(row => (byElement ? row.preset.enemyElement : row.preset.kind) === key);
    return { label,
      ratio: averageMeasured(group.map(row => row.ratio)),
      owned: averageMeasured(group.map(row => row.owned?.winner?.highest)),
      reference: averageMeasured(group.map(row => row.reference?.winner?.highest)),
    };
  });
});
const hasAnalysisData = computed(() => analysisAxes.value.some(axis =>
  analysisMetric.value === 'ratio' ? axis.ratio.count > 0 : axis.owned.count + axis.reference.count > 0));
const summary = computed(() => summarizeBenchmark(winners.value));
const busy = ref(false);
const stopped = ref(false);
let controller: AbortController | null = null;
const workers = new Map<Lane, Worker>();
let requestId = 0;
function releaseWorkers() {
  for (const worker of workers.values()) worker.terminate();
  workers.clear();
}
function stop() {
  controller?.abort();
  releaseWorkers();
  controller = null;
  stopped.value = busy.value;
  busy.value = false;
}
onBeforeUnmount(stop);
async function start() {
  if (busy.value || !canStart.value) return;
  const collection = owned.value;
  const reference = includeReference.value;
  const maxRoster = referenceRoster.value;
  ranReferenceSource.value = referenceSource.value;
  const constraints = { requiredCards: [...requiredCards.value], requiredCharacters: [...requiredCharacters.value] };
  const depth = searchDepth.value;
  const run = new AbortController();
  controller = run;
  queue.value = [...selected.value];
  rows.value = [];
  completed.value = 0;
  ranReference.value = reference;
  lane.value = reference && !queue.value.some(p => collection.length >= required(p)) ? 'reference' : 'owned';
  analysisMetric.value = reference && lane.value === 'owned' ? 'ratio' : 'score';
  for (const group of filterGroups.value) resultFilters.value[group.key] = group.options.map(option => option.value);
  sort.value = null;
  resultTab.value = 'teams';
  busy.value = true;
  stopped.value = false;
  for (const preset of queue.value) {
    const row = shallowReactive<ExamRow>({ preset });
    rows.value = [...rows.value, row];
    const hasOwned = collection.length >= required(preset);
    const jobs: Promise<void>[] = [];
    async function evaluate(source: Lane, roster: RosterCard[]) {
      const result = await search(preset, source, roster, constraints, depth, run.signal);
      if (!run.signal.aborted) row[source] = result;
    }
    if (hasOwned) jobs.push(evaluate('owned', collection));
    else row.owned = { winner: null, missing: required(preset) };
    if (reference && maxRoster.length >= required(preset)) jobs.push(evaluate('reference', maxRoster));
    else if (reference) row.reference = { winner: null, missing: required(preset) };
    await Promise.all(jobs);
    if (run.signal.aborted) return;
    completed.value++;
  }
  busy.value = false;
  controller = null;
  releaseWorkers();
}

function search(preset: ExamPresetDefinition, source: Lane, roster: RosterCard[],
  constraints: Pick<SearchInput, 'requiredCards' | 'requiredCharacters'>, depth: BenchmarkDepth, signal: AbortSignal): Promise<Outcome> {
  return new Promise(resolve => {
    const id = ++requestId;
    let worker: Worker | undefined;
    function finish(result: Outcome) {
      signal.removeEventListener('abort', abort);
      if (worker) {
        worker.onmessage = null;
        worker.onerror = null;
        worker.onmessageerror = null;
        if (result.error) {
          worker.terminate();
          workers.delete(source);
        }
      }
      resolve(result);
    }
    const abort = () => finish({ winner: null });
    signal.addEventListener('abort', abort, { once: true });
    try {
      worker = workers.get(source) ?? new Worker(new URL('../workers/examSearch.worker.ts', import.meta.url), { type: 'module' });
      workers.set(source, worker);
      worker.onmessage = ({ data }: MessageEvent<{ id: number; winner?: BenchmarkWinner | null; error?: string }>) => {
        if (data.id !== id) return;
        if (data.error) {
          const key = 'examSearch.validation.' + data.error;
          finish({ winner: null, error: te(key) ? t(key) : data.error });
        } else if (data.winner !== undefined) finish({ winner: data.winner });
      };
      worker.onerror = event => finish({ winner: null, error: event.message || t('examSearch.failure') });
      worker.onmessageerror = () => finish({ winner: null, error: t('examSearch.failure') });
      const input: SearchInput = {
        preset: { ...preset, difficulty: preset.difficulty ?? 1.5 }, rosterSource: source === 'owned' ? 'owned' : ranReferenceSource.value, roster, ...constraints,
        supports: examUsesSupport(preset) ? fullRoster : [], budget: 0, itemsPerLimitBreak: 1,
        attempts: 30, desiredProbability: 0.05, challengeLocks: {}, maxRemoved: 1,
      };
      worker.postMessage({ method: 'start', id, input, benchmarkDepth: depth });
    } catch (error) { finish({ winner: null, error: error instanceof Error ? error.message : String(error) }); }
  });
}
</script>

<style scoped>
.benchmark { max-width: 880px; padding: 8px 12px 24px; color: #263744; font-size: 13px; }
h1 { margin-bottom: 8px; font-size: 18px; }
.controls, .results { background: #fff; border: 1px solid #d9e2ea; border-radius: 6px; }
.controls { padding: 10px 12px; }
.fields, .options, .actions, .progress { display: flex; align-items: center; flex-wrap: wrap; gap: 5px 12px; }
.condition-fields { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 6px 10px; }
.condition-fields label { display: grid; grid-template-rows: 1fr auto; gap: 2px; min-width: 0; font-size: 12px; }
.condition-fields select { width: 100%; min-width: 0; }
select { appearance: auto; min-height: 30px; padding: 2px 6px; color: inherit; background: white; border: 1px solid #b4c2ce; border-radius: 4px; }
.options, .actions { margin-top: 8px; }
.restrictions, .bulk-actions { display: flex; flex-wrap: wrap; align-items: center; gap: 5px 8px; margin-top: 8px; }
.restrictions { border: 0; padding: 0; min-width: 0; }
.restrictions :deep(.required-card-setting) { grid-template-columns: auto 1fr; gap: 8px; padding: 0; }
.restrictions :deep(.selection-label) { font-size: 12px; }
.restrictions :deep(.optional-label) { display: none; }
.restrictions :deep(.required-card-slots) { grid-template-columns: repeat(5, 30px); gap: 4px; }
.restrictions :deep(.required-card-clear) { width: 16px; height: 16px; line-height: 12px; top: -4px; right: -3px; }
.compact-button { padding: 3px 8px; min-height: 28px; border: 1px solid #b4c2ce; border-radius: 4px; font-size: 12px; }
.compact-button:disabled { opacity: .5; }
.options label, .choices label { cursor: pointer; }
.selection-mode { display: inline-flex; max-width: 100%; padding: 2px; border: 1px solid #b4c2ce; border-radius: 5px; background: #f2f6f9; }
.selection-mode label { position: relative; }
.selection-mode input { position: absolute; inset: 0; width: 100%; height: 100%; opacity: 0; cursor: pointer; }
.selection-mode span { display: block; padding: 5px 9px; border-radius: 3px; text-align: center; }
.selection-mode input:checked + span { background: #1867ad; color: #fff; }
.selection-mode input:focus-visible + span { outline: 2px solid #173e65; outline-offset: 1px; }
.selection-mode input:disabled { cursor: default; }
input { accent-color: #1867ad; vertical-align: middle; }
.choices { display: grid; grid-template-columns: repeat(auto-fill, minmax(145px, 1fr)); gap: 4px; max-height: 200px; overflow: auto; margin-top: 6px; padding: 6px; background: #f7fafc; }
.actions span, .progress { color: #526673; font-size: 12px; }
.actions a { font-size: 12px; }
.progress { padding: 8px 0; }
.result-filters { padding: 6px 8px; font-size: 12px; }
.result-filter-button { padding-inline: 10px; }
.result-filter-button :deep(.v-btn__prepend) { margin-inline: 0 4px; }
.result-filter-button :deep(.v-icon) { font-size: 16px; transform: translateY(1px); }
.filter-content { display: grid; gap: 8px; font-size: 14px; }
.filter-group { display: grid; grid-template-columns: max-content 1fr; align-items: baseline; gap: 8px; }
.filter-label { min-width: 4em; font-weight: 600; }
.filter-options, .result-summary { display: flex; flex-wrap: wrap; align-items: center; gap: 2px 10px; }
.filter-options label { display: inline-flex; align-items: center; gap: 4px; min-height: 32px; cursor: pointer; }
.empty-results { padding: 6px 8px; font-size: 12px; }
.results .v-tab { min-width: 60px; font-size: 12px; }
.analysis { padding: 8px; }
.analysis-controls { display: flex; flex-wrap: wrap; gap: 6px; }
.analysis p { margin-top: 8px; }
.table-scroll { overflow-x: auto; }
.team-table { width: 100%; border-collapse: collapse; font-size: 12px; font-variant-numeric: tabular-nums; }
.team-table th, .team-table td { padding: 4px 6px; border-top: 1px solid #e0e7ed; text-align: right; }
.team-table thead { background: #f2f6f9; white-space: nowrap; }
.team-table th:first-child, .team-table th:last-child, .team-table td:last-child { text-align: left; }
.team-table th:first-child { width: 1%; white-space: nowrap; }
.team-table tbody th { font-weight: 500; }
.team-table .series-label { display: block; }
.team-table th[data-element="火"] { color: #ad342e; }
.team-table th[data-element="水"] { color: #165e9d; }
.team-table th[data-element="木"] { color: #237344; }
.team-table th[data-element="無"] { color: #724ba0; }
.team-table th[data-element="全"] { color: #856122; }
.team-table button { color: #175d94; cursor: pointer; }
.score-order { display: none; }
.team-table .gap { font-weight: 600; }
.deck { display: grid; grid-template-columns: repeat(5, 40px); gap: 2px; }
.deck :deep(.selected-magic-icons) { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 1px; padding: 1px; }
.deck :deep(.magic-icon) { font: 8px/11px Arial, sans-serif; white-space: nowrap; letter-spacing: -.15px; text-align: center; }
.deck :deep(.magic-icon.selected) { font-weight: 700; }
.ranking { display: flex; flex-wrap: wrap; gap: 4px 10px; padding: 8px; list-style: none; }
.ranking li { display: flex; align-items: center; gap: 3px; font-variant-numeric: tabular-nums; }
.ranking img { width: 34px; height: 34px; border-radius: 3px; }
@media (max-width: 520px) {
  .benchmark { padding: 6px 8px 20px; }
  .fields { gap: 4px 6px; }
}
@media (max-width: 600px) {
  .condition-fields { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 5px 8px; }
  .team-table, .team-table thead, .team-table tbody { display: block; }
  .team-table tr {
    display: grid;
    align-items: center;
    border-top: 1px solid #e0e7ed;
    padding: 2px 5px;
  }
  .team-table th, .team-table td {
    border: 0;
    min-width: 0;
    padding: 0;
    line-height: 1.25;
    text-align: center;
  }
  .team-table thead { white-space: normal; font-size: 11px; }
  .team-table thead tr { display: flex; align-items: center; flex-wrap: wrap; gap: 0 8px; position: relative; min-height: 28px; padding-inline: 6px; }
  .team-table thead th { font-weight: 500; white-space: nowrap; }
  .team-table thead th:last-child { order: -1; margin-inline-end: auto; }
  .team-table thead th:first-child,
  .team-table.with-reference thead th:last-child { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); }
  .team-table.with-reference thead th:nth-child(n+3):not(:last-child) { border-inline-start: 1px solid #c8d5df; padding-inline-start: 8px; }
  .score-order { display: inline; margin-inline-end: 6px; font-weight: 400; color: #526673; }
  .team-table thead button { min-height: 24px; }
  .team-table thead th[aria-sort] button { font-weight: 700; }
  .team-table tbody { display: grid; grid-template-columns: fit-content(4.5em) minmax(0, 1fr) fit-content(7em); column-gap: 4px; padding-inline: 5px; }
  .team-table tbody tr {
    grid-column: 1 / -1;
    grid-template-columns: 4.5em minmax(0, 1fr) 5em;
    grid-template-columns: subgrid;
    grid-template-rows: auto;
    column-gap: inherit;
    padding-inline: 0;
  }
  .team-table.with-reference tbody tr { grid-template-rows: repeat(4, auto); }
  .team-table tbody th:first-child {
    grid-area: 1 / 1 / -1 / 2; width: auto; font-size: 11px;
    text-align: left; white-space: normal; overflow-wrap: anywhere;
  }
  .team-table tbody td:not(:last-child) { grid-column: 3; text-align: right; white-space: nowrap; }
  .team-table tbody td:last-child { grid-area: 1 / 2 / -1 / 3; text-align: left; overflow-wrap: anywhere; }
  .deck { grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 0; }
  .deck :deep(.selected-magic-icons) { gap: 0; padding-inline: 0; }
  .deck :deep(.magic-icon) { font-size: clamp(8px, 2.3vw, 11px); line-height: 1.2; }
}
</style>
