<template>
  <v-container :class="['resource-search', { embedded }]" data-testid="exam-resource-search">
    <h1 v-if="!embedded">{{ t('examSearch.title') }}</h1>
    <p v-if="!embedded" class="lead">{{ t('examSearch.simple.intro') }}</p>
    <fieldset :disabled="busy" class="setup">
      <ExamSearchPresetPicker v-if="!embedded" @select="selectPreset" />
      <p v-if="!embedded" class="selected-exam">{{ t('examSearch.exam') }}: <strong>{{ localizeGameText(input.preset.title, locale) }}</strong></p>
      <div class="required-card-setting">
        <div class="selection-label">{{ t('examSearch.cardFilter') }}<span class="optional-label">{{ t('examSearch.optional') }}</span></div>
        <div class="required-card-slots">
          <div v-for="slot in 5" :key="slot" class="required-card-slot">
            <button type="button" :data-testid="`required-card-slot-${slot - 1}`" class="required-card-pick"
              :aria-label="`${t('examSearch.cardFilter')} ${slot}${requiredCardSlots[slot - 1] ? ': ' + cardLabel(requiredCardSlots[slot - 1]) : ''}`"
              @click="openRequiredCard(slot - 1)">
              <img v-if="requiredCardSlots[slot - 1]" :src="cardImages[requiredCardSlots[slot - 1]] || defaultImg" :alt="cardLabel(requiredCardSlots[slot - 1])" />
              <span v-else aria-hidden="true">＋</span>
            </button>
            <button v-if="requiredCardSlots[slot - 1]" type="button" class="required-card-clear"
              :data-testid="`required-card-clear-${slot - 1}`" :aria-label="`${t('examSearch.clear')}: ${t('examSearch.cardFilter')} ${slot} ${cardLabel(requiredCardSlots[slot - 1])}`"
              @click="clearRequiredCard(slot - 1)">×</button>
          </div>
        </div>
      </div>
      <div class="character-setting">
        <div class="selection-label">{{ t('examSearch.characterFilter') }}<span class="optional-label">{{ t('examSearch.optional') }}</span></div>
        <v-btn data-testid="character-filter-open" class="character-picker-open" variant="outlined" :disabled="busy" @click="characterFilterOpen = true">
          {{ t('examSearch.chooseCharacters') }}<span v-if="characterFilter.length" class="filter-count">{{ characterFilter.length }}/5</span>
        </v-btn>
      </div>
    </fieldset>
    <p v-if="!rosterReady" class="missing">{{ t('examSearch.simple.missingCards', {count:usesSupport?4:5}) }} · <router-link to="/twst/hand-collection">{{ t('examSearch.simple.manageHand') }}</router-link></p>
    <v-alert v-if="error" class="my-3" type="error">{{ error }}</v-alert>
    <div class="actions my-4">
      <v-btn data-testid="search-settings-open" class="search-settings-open" variant="text" :disabled="busy" @click="searchSettingsOpen = true">
        {{ t('examSearch.changeConditions') }}
      </v-btn>
      <v-btn color="primary" class="resource-start" :disabled="busy" data-testid="resource-start" @click="start(180000)">{{ t('examSearch.start') }}</v-btn>
      <v-btn v-if="canResume && !busy" @click="resume">{{ t('examSearch.resume') }}</v-btn>
      <v-btn v-if="busy" @click="stop">{{ t('examSearch.stop') }}</v-btn>
    </div>
    <v-progress-linear v-if="busy" indeterminate color="primary" />
    <p v-if="progress" aria-live="polite">{{ t(`examSearch.phase.${progress.phase}`) }} · {{ t('examSearch.progress', { tasks: progress.tasksDone, total: progress.tasksTotal, count: progress.evaluated, seconds: Math.round(progress.elapsedMs / 1000) }) }}<span v-if="busy && ['done','stopped'].includes(progress.phase)"> · {{ t('examSearch.saving') }}</span></p>
    <p v-if="progress && !busy && !results.length">{{ t('examSearch.noResult') }}</p>
    <p v-else-if="progress && !busy && results.length && !visibleResults.length" class="filter-empty">{{ t('examSearch.filterEmpty') }}</p>
    <ExamSearchResultsTable v-if="resultGroups.length" :rows="resultGroups.map(group => ({ result: group.primary, variantCount: group.variants.length }))"
      :card-images="cardImages" :card-label="cardLabel" :upgrade-summary="variantCardSummary" :busy="busy"
      @preview="preview" @simulator="openSimulator" @variants="openVariants" />
    <v-dialog v-model="variantsOpen" max-width="1080" scrollable>
      <v-card class="modal-card variants-card">
        <v-card-title class="modal-title">{{ t('examSearch.variantsTitle') }}</v-card-title>
        <v-card-text>
          <ExamSearchResultsTable :rows="variantRows" :card-images="cardImages" :card-label="cardLabel"
            :upgrade-summary="variantCardSummary" :busy="busy" @preview="preview" @simulator="openSimulator" />
        </v-card-text>
        <v-card-actions><v-spacer /><v-btn @click="variantsOpen = false">{{ t('common.close') }}</v-btn></v-card-actions>
      </v-card>
    </v-dialog>
    <v-dialog v-model="searchSettingsOpen" max-width="640" data-testid="search-settings-dialog">
      <v-card class="modal-card">
        <v-card-title class="modal-title">{{ t('examSearch.changeConditions') }}</v-card-title>
        <v-card-text>
          <fieldset :disabled="busy" class="search-settings-fields">
            <v-text-field v-model.number="additionalBreaks" type="number" min="0" max="4" step="1" :label="t('examSearch.extraBreaks')" :error-messages="additionalBreaksError" density="compact" variant="outlined" hide-details="auto" />
            <v-text-field v-model.number="input.attempts" type="number" min="1" max="100000" step="1" :label="t('examSearch.attempts')" :error-messages="attemptsError" density="compact" variant="outlined" hide-details="auto" />
          </fieldset>
        </v-card-text>
        <v-card-actions><v-spacer /><v-btn data-testid="search-settings-close" color="primary" variant="tonal" @click="searchSettingsOpen = false">{{ t('common.close') }}</v-btn></v-card-actions>
      </v-card>
    </v-dialog>
    <Teleport to="body"><SimCharaModal v-if="cardFilterOpen" data-testid="card-filter-dialog"
      @select="selectRequiredCard" @close="cardFilterOpen = false" /></Teleport>
    <v-dialog v-model="characterFilterOpen" max-width="640" scrollable class="search-character-dialog" data-testid="character-filter-dialog">
      <v-card class="modal-card character-filter-card">
        <v-card-title class="modal-title">{{ t('examSearch.characterFilter') }}</v-card-title>
        <v-card-text>
          <p class="filter-help">{{ t('examSearch.characterFilterHelp', { count: characterFilter.length }) }}</p>
          <div class="character-filter-list">
            <label v-for="character in visibleCharacterOptions" :key="character.name" class="character-filter-option" :class="{ selected: characterFilter.includes(character.name) }" :title="localizeCharacterName(character.name, locale)">
              <input type="checkbox" class="sr-only" :data-character-name="character.name" :aria-label="localizeCharacterName(character.name, locale)" :checked="characterFilter.includes(character.name)" :disabled="!characterFilter.includes(character.name) && characterFilter.length >= 5" @change="toggleCharacterFilter(character.name)" />
              <span class="character-icon-wrap">
                <img :src="characterIconImages[character.name] || defaultImg" :alt="localizeCharacterName(character.name, locale)" class="character-icon" loading="lazy" />
                <span v-if="characterFilter.includes(character.name)" class="character-selected-mark">✓</span>
              </span>
            </label>
          </div>
          <p v-if="!visibleCharacterOptions.length" class="filter-empty">{{ t('examSearch.filterEmpty') }}</p>
        </v-card-text>
        <v-card-actions><v-spacer /><v-btn data-testid="character-filter-close" color="primary" variant="tonal" @click="characterFilterOpen = false">{{ t('common.close') }}</v-btn></v-card-actions>
      </v-card>
    </v-dialog>
    <v-dialog v-model="previewOpen" max-width="1120"><v-card class="pa-4 modal-card"><h2 class="modal-title">{{ previewIsBest ? t('examSimulator.bestScoreLogWithScore', { score: previewScore.toLocaleString() }) : t('examSearch.previewTitle') }}</h2><ExamBattleLog :groups="previewGroups" :default-img="defaultImg" :enemy-label="t('examSimulator.enemy')" :localize="localizePreviewText" :element-icon="previewElementIcon" /><v-btn @click="previewOpen = false">{{ t('examSearch.close') }}</v-btn></v-card></v-dialog>
  </v-container>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { onBeforeRouteLeave, useRouter } from 'vue-router';
import cards from '@/assets/chara.json';
import charactersInfo from '@/assets/characters_info.json';
import ExamSearchPresetPicker from '@/components/ExamSearchPresetPicker.vue';
import SimCharaModal from '@/components/SimCharaModal.vue';
import ExamBattleLog from '@/components/ExamBattleLog.vue';
import ExamSearchResultsTable from '@/components/ExamSearchResultsTable.vue';
import { loadCachedImageUrl, loadCharacterImageUrl } from '@/utils/characterAssets';
import defaultImg from '@/assets/img/default.webp';
import fireIcon from '@/assets/img/fire.webp';
import waterIcon from '@/assets/img/water.webp';
import floraIcon from '@/assets/img/flora.webp';
import cosmicIcon from '@/assets/img/cosmic.webp';
import { examPresetDefinitions, type ExamPresetDefinition } from '@/utils/examPresets';
import { sharedExamConditionsKey, type SharedExamConditions } from '@/utils/sharedExamConditions';
import { useHandCollectionStore } from '@/store/handCollection';
import { localizeCharacterName, localizeCostumeName, localizeGameText } from '@/utils/localizedDisplay';
import { loadExamSearch, saveExamSearch, loadSearchSession, saveSearchSession, saveSearchTransfer, loadSearchSeedTeams, type SavedSearchSession } from '@/storage/examSearchStorage';
import { validateInput, examUsesSupport } from '@/domain/examSearch/variants';
import { constrainCheckpoint } from '@/domain/examSearch/requiredCheckpoint';
import { rankedResults } from '@/domain/examSearch/statistics';
import type { RosterCard, SearchInput, SearchProgress, SearchResult } from '@/domain/examSearch/types';
import { ENGINE_VERSION } from '@/domain/examSearch/types';
import { loadSimulatorWindowState, loadStoredAutoSaveDeck, loadStoredSavedDecks } from '@/storage/simulatorStorage';
import { groupExamBattleLog, type BattleLogActionElement, type BattleLogGroup } from '@/utils/examBattleLog';

const { t, locale } = useI18n();
const router = useRouter();
const props = withDefaults(defineProps<{ embedded?: boolean; preset?: ExamPresetDefinition; conditions?: SharedExamConditions }>(), { embedded: false });
const emit = defineEmits<{ (event: 'select-preset', preset: ExamPresetDefinition): void }>();
const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value));
const catalog = Object.fromEntries(cards.map(c => [c.name, c]));
const presets = examPresetDefinitions;
const initialPreset = presets.find(p => p.specialChallenges?.length) ?? presets[0];
const saved = loadExamSearch();
const savedPreset = saved?.preset;
const validSaved = !!savedPreset
  && ['BASIC', 'ATTACK', 'DEFENCE'].includes(savedPreset.kind)
  && ['火', '水', '木', '無', '全'].includes(savedPreset.enemyElement)
  && Number.isFinite(savedPreset.enemyHp)
  && Array.isArray(savedPreset.enemies)
  && Array.isArray(saved?.roster)
  && Array.isArray(saved?.supports);
const input = ref<SearchInput>(validSaved && saved ? saved : {
  preset: { ...clone(initialPreset), difficulty: initialPreset.difficulty ?? 1.5 }, roster: [], supports: [], budget: 0,
  itemsPerLimitBreak: 1, target: 0, attempts: 30, desiredProbability: 0.05, tolerance: 0, challengeLocks: {}, maxRemoved: 1,
});
// Search is score-driven; legacy target settings no longer control new searches.
input.value.target = 0;
input.value.tolerance = 0;
input.value.desiredProbability = 0.05;
if (!props.conditions && props.preset && props.preset.id !== input.value.preset.id) {
  input.value.preset = { ...clone(props.preset), difficulty: props.preset.difficulty ?? 1.5 };
  input.value.challengeLocks = {};
}
const busy = ref(false), error = ref(''), progress = ref<SearchProgress | null>(null);
const evaluatedInput = ref<SearchInput | null>(null), runFingerprint = ref('');
const previewOpen = ref(false), previewGroups = ref<BattleLogGroup[]>([]);
const searchSettingsOpen = ref(false);
const previewScore = ref(0);
const previewCandidate = ref<SearchResult['candidate'] | null>(null);
const previewIsBest = ref(false);
const usesSupport=computed(()=>examUsesSupport(input.value.preset));
const rosterReady = computed(() => input.value.roster.length >= (usesSupport.value?4:5) && (!usesSupport.value||input.value.supports.length>=1));
const cardImages = ref<Record<string, string>>({});
const characterIconImages = ref<Record<string, string>>({});
const cardFilterOpen = ref(false), characterFilterOpen = ref(false);
const selectingRequiredCardIndex = ref(0);
const requiredCards = ref<string[]>(Array.isArray(input.value.requiredCards) ? [...input.value.requiredCards] : []);
const requiredCardSlots = ref(Array.from({ length: 5 }, (_, index) => requiredCards.value[index] ?? ''));
const characterFilter = ref<string[]>([...(input.value.requiredCharacters ?? [])]);
const persistedSession = ref<SavedSearchSession | null>(loadSearchSession());
let worker: Worker | null = null, requestId = 0;
const idleWaiters: Array<(saved:boolean)=>void> = [];
function finishRequest(saved=true) {
  busy.value=false;
  idleWaiters.splice(0).forEach(resolve=>resolve(saved));
}
const hand = useHandCollectionStore();
const additionalBreaks = computed({ get: () => input.value.budget / input.value.itemsPerLimitBreak, set: n => { input.value.budget = n * input.value.itemsPerLimitBreak; } });
const additionalBreaksError = computed(() => Number.isInteger(additionalBreaks.value) && additionalBreaks.value >= 0 && additionalBreaks.value <= 4
  ? '' : t('examSearch.validation.additional-breaks'));
const attemptsError = computed(() => Number.isInteger(input.value.attempts) && input.value.attempts >= 1 && input.value.attempts <= 100000
  ? '' : t('examSearch.validation.attempts'));
const cardLabel = (name: string) => catalog[name] ? `${localizeCharacterName(catalog[name].chara, locale.value)} / ${localizeCostumeName(catalog[name], locale.value)}` : name;
const canResume = computed(() => !!progress.value && runFingerprint.value === JSON.stringify(input.value) && (!!worker || !!persistedSession.value));
const characterOptions = computed(() => charactersInfo.map(character => character.name_ja).filter(name => cards.some(card => card.chara === name)));
const characterChoices = computed(() => characterOptions.value.map(name => ({
  name,
  iconName: charactersInfo.find(character => character.name_ja === name)?.name_en ?? name,
})));
const visibleCharacterOptions = characterChoices;
const results = computed(() => evaluatedInput.value ? rankedResults(progress.value?.results ?? [], evaluatedInput.value.target, evaluatedInput.value.attempts, evaluatedInput.value.desiredProbability) : []);
const visibleResults = results;
type ResultGroup = { primary: SearchResult; variants: SearchResult[] };
const deckKey = (result: SearchResult) => result.candidate.cards
  .map(card => `${card.support ? 'support' : 'own'}:${card.name}`)
  .sort()
  .join('|');
const investmentKey = (result: SearchResult) => result.candidate.cards
  .map(card => `${card.support ? 'support' : 'own'}:${card.name}:${card.level}:${card.totsu}`)
  .sort()
  .join('|');
const resultGroups = computed<ResultGroup[]>(() => {
  const groups = new Map<string, ResultGroup>();
  const investments = new Map<string, Set<string>>();
  for (const result of visibleResults.value) {
    const key = deckKey(result);
    const group = groups.get(key);
    if (!group) {
      groups.set(key, { primary: result, variants: [] });
      investments.set(key, new Set([investmentKey(result)]));
      continue;
    }
    const keySet = investments.get(key)!;
    const variantKey = investmentKey(result);
    if (!keySet.has(variantKey)) {
      keySet.add(variantKey);
      group.variants.push(result);
    }
  }
  return [...groups.values()];
});
const variantsOpen = ref(false);
const variantsDeckKey = ref('');
const variantRows = computed(() => {
  const group = resultGroups.value.find(group => deckKey(group.primary) === variantsDeckKey.value);
  return group ? [group.primary, ...group.variants].map(result => ({ result })) : [];
});
function openVariants(result: SearchResult) {
  variantsDeckKey.value = deckKey(result);
  variantsOpen.value = true;
}
watch(() => visibleResults.value.flatMap(r => r.candidate.cards.map(c => c.name)), names => {
  for (const name of new Set(names)) if (!cardImages.value[name]) void loadCharacterImageUrl(name).then(url => { cardImages.value[name] = url; });
});
watch([() => visibleCharacterOptions.value.map(character => character.name), characterFilterOpen], ([names, open]) => {
  if (!open) return;
  for (const name of names) {
    const iconName = characterChoices.value.find(character => character.name === name)?.iconName ?? name;
    if (!characterIconImages.value[name]) void loadCachedImageUrl(iconName, 'icon/').then(url => { characterIconImages.value[name] = url; });
  }
}, { immediate: true });
watch(requiredCards, names => {
  const normalized = [...new Set(names)].slice(0, 5);
  if (JSON.stringify(normalized) !== JSON.stringify(names)) {
    requiredCards.value = normalized;
    return;
  }
  const current = input.value.requiredCards ?? [];
  if (JSON.stringify(current) === JSON.stringify(normalized)) return;
  input.value.requiredCards = [...normalized];
  if (!busy.value) invalidateActiveSearch();
}, { deep: true });
function openRequiredCard(index: number) {
  selectingRequiredCardIndex.value = index;
  cardFilterOpen.value = true;
}
function selectRequiredCard(card: { name: string }) {
  const next = [...requiredCardSlots.value];
  const index = selectingRequiredCardIndex.value;
  const previous = next.indexOf(card.name);
  if (previous >= 0 && previous !== index) next[previous] = next[index];
  next[index] = card.name;
  requiredCardSlots.value = next;
  requiredCards.value = next.filter(Boolean);
  cardFilterOpen.value = false;
}
function clearRequiredCard(index: number) {
  requiredCardSlots.value[index] = '';
  requiredCards.value = requiredCardSlots.value.filter(Boolean);
}
watch(requiredCards, names => {
  for (const name of names) if (!cardImages.value[name]) void loadCharacterImageUrl(name).then(url => { cardImages.value[name] = url; });
}, { immediate: true });
watch(characterFilter, names => {
  if (JSON.stringify(input.value.requiredCharacters ?? []) === JSON.stringify(names)) return;
  input.value.requiredCharacters = [...names];
  if (!busy.value) invalidateActiveSearch();
}, { deep: true });
watch([() => input.value.budget, () => input.value.attempts], () => {
  if (!busy.value) invalidateActiveSearch();
});
function toggleCharacterFilter(name: string) {
  characterFilter.value = characterFilter.value.includes(name)
    ? characterFilter.value.filter(value => value !== name)
    : characterFilter.value.length < 5 ? [...characterFilter.value, name] : characterFilter.value;
}
function invalidateActiveSearch() {
  // Results and resume state belong to the previous conditions. Leave the saved
  // checkpoint untouched, but remove it from the active view until a new
  // search is started for these conditions.
  worker?.terminate();
  worker = null;
  requestId++;
  error.value = '';
  progress.value = null;
  evaluatedInput.value = null;
  runFingerprint.value = '';
  previewOpen.value = false;
  previewGroups.value = [];
  previewScore.value = 0;
  previewCandidate.value = null;
  previewIsBest.value = false;
  variantsOpen.value = false;
  variantsDeckKey.value = '';
}
function currentSharedConditions(): SharedExamConditions {
  return {
    preset: clone(input.value.preset),
    challengeLocks: clone(input.value.challengeLocks),
    maxRemoved: input.value.maxRemoved,
  };
}
function applySharedConditions(conditions: SharedExamConditions) {
  if (sharedExamConditionsKey(currentSharedConditions()) === sharedExamConditionsKey(conditions)) return;
  input.value.preset = clone(conditions.preset);
  input.value.challengeLocks = clone(conditions.challengeLocks);
  input.value.maxRemoved = conditions.maxRemoved;
  if (input.value.supports.length === 0 && examUsesSupport(input.value.preset)) syncSupports();
  invalidateActiveSearch();
}
function applyPreset(p: typeof presets[number]) {
  if (input.value.preset.id === p.id) return;
  input.value.preset = { ...clone(p), difficulty: p.difficulty ?? 1.5 };
  input.value.challengeLocks = {};
  syncSupports();
  invalidateActiveSearch();
}
function selectPreset(p: typeof presets[number]) {
  if (busy.value) return;
  emit('select-preset', p);
  applyPreset(p);
}
// A parent-selected preset is an explicit context change. An omitted prop
// leaves the saved search untouched so standalone navigation can restore it.
watch(() => props.preset?.id, () => {
  if (props.preset && !props.conditions && !busy.value) applyPreset(props.preset);
});
watch(() => props.conditions ? sharedExamConditionsKey(props.conditions) : '', () => {
  if (props.conditions && !busy.value) applySharedConditions(props.conditions);
});
onMounted(() => {
  if (props.conditions) {
    applySharedConditions(props.conditions);
    return;
  }
  if (props.preset) {
    // The prop is the parent's explicit selection. Re-apply after restored
    // session state has been considered, then report it back for parent sync.
    applyPreset(props.preset);
    emit('select-preset', props.preset);
    return;
  }
  // Standalone navigation owns the saved preset; let an embedding parent
  // mirror it without replacing the restored search or its results.
  const selected = presets.find(p => p.id === input.value.preset.id);
  if (selected) emit('select-preset', selected);
});
// Collection is the single source of truth. Training skills are assumed maxed.
function maxSkillsCard(name: string, level: number, totsu: number): RosterCard {
  return { name, level, totsu, magicLevels: [10, 10, 10], buddyLevels: [10, 10, 10], allowUpgrade: true };
}
function syncSupports() {
  input.value.supports=examUsesSupport(input.value.preset)?cards.map(c => maxSkillsCard(c.name,c.rare==='SSR'?120:c.rare==='SR'?90:70,4)):[];
}
if (input.value.supports.length === 0 && examUsesSupport(input.value.preset)) syncSupports();
type StoredTeam={deckCharacters?: {name?:string}[]};
const savedTeams=[loadSimulatorWindowState(),loadStoredAutoSaveDeck<StoredTeam>(),...loadStoredSavedDecks<StoredTeam>()]
  .map(team=>team?.deckCharacters?.map(c=>c?.name??'')??[]).filter(team=>team.length===5&&team.every(name=>!!catalog[name]));
input.value.seedTeams??=savedTeams;
watch(() => hand.ownedCards.map(c => [c.cardName, c.level, c.totsu] as const), owned => {
  input.value.roster = owned.filter(([name]) => catalog[name]).map(([name, level, totsu]) => maxSkillsCard(name, Math.max(1, level), totsu));
}, { immediate: true });
if (persistedSession.value && JSON.stringify(persistedSession.value.input) === JSON.stringify(input.value)) {
  evaluatedInput.value = clone(input.value);
  runFingerprint.value = JSON.stringify(input.value);
  const checkpoint = constrainCheckpoint(input.value, persistedSession.value.checkpoint, catalog);
  persistedSession.value.checkpoint = checkpoint;
  progress.value = { phase: 'stopped', generated: checkpoint.seen.length, evaluated: checkpoint.evaluatedCount ?? checkpoint.pool.length,
    tasksDone: checkpoint.cursor, tasksTotal: checkpoint.tasksTotal ?? checkpoint.cursor, elapsedMs: checkpoint.elapsed, results: checkpoint.finalists };
}
function getWorker() {
  if (worker) return worker;
  worker = new Worker(new URL('../workers/examSearch.worker.ts', import.meta.url), { type: 'module' });
  worker.onmessage = ({ data }) => {
    if (data.id !== requestId) return;
    if (data.diagnostic) console.error('Exam search failed', JSON.stringify(data.diagnostic));
    if (data.error) { error.value = t('examSearch.failure') + ': ' + data.error; finishRequest(false); }
    if (data.progress) {
      progress.value = data.progress;
    }
    if (data.checkpoint && evaluatedInput.value) {
      persistedSession.value = { input: clone(evaluatedInput.value), checkpoint: data.checkpoint, catalogVersion: data.catalogVersion, version: ENGINE_VERSION };
      const saved=saveSearchSession(persistedSession.value,data.serializedSession);
      if (!saved) error.value = t('examSearch.sessionSaveFailed');
      finishRequest(saved);
    }
    if (data.preview) {
      previewScore.value = Number(data.preview.score || 0);
      previewGroups.value = groupExamBattleLog(data.preview.log ?? [], { playerIcon: previewPlayerIcon });
      previewOpen.value = true; finishRequest();
    }
  };
  worker.onerror = event => { error.value = `${t('examSearch.failure')}: ${event.message}`; finishRequest(false); worker?.terminate(); worker = null; };
  return worker;
}
function start(durationMs: number) {
  error.value = '';
  if (additionalBreaksError.value || attemptsError.value) {
    error.value = additionalBreaksError.value || attemptsError.value;
    return;
  }
  input.value.seedTeams=[...loadSearchSeedTeams(input.value.preset.id),...savedTeams];
  const issue = validateInput(input.value, catalog);
  if (issue) {
    error.value = issue === 'roster'
      ? t('examSearch.simple.missingCards', { count: usesSupport.value ? 4 : 5 })
      : t(`examSearch.validation.${issue}`);
    return;
  }
  if (!saveExamSearch(input.value)) error.value = t('examSearch.saveFailed');
  worker?.terminate(); worker = null;
  runFingerprint.value = JSON.stringify(input.value);
  evaluatedInput.value = clone(input.value); progress.value = null; busy.value = true;
  getWorker().postMessage({ method: 'start', id: ++requestId, input: clone(input.value), durationMs });
}
function resume() {
  busy.value = true;
  getWorker().postMessage({ method: 'resume', id: ++requestId, durationMs: 180000,
    input: clone(evaluatedInput.value), checkpoint: persistedSession.value ? clone(persistedSession.value.checkpoint) : undefined, catalogVersion: persistedSession.value?.catalogVersion });
}
function stop() { worker?.postMessage({ method: 'stop', id: requestId }); }
async function requestStopAndSave() {
  if (!busy.value) return true;
  const saved = new Promise<boolean>(resolve => idleWaiters.push(resolve));
  stop();
  return await saved;
}
defineExpose({ busy, requestStopAndSave });
function localizePreviewText(text: string) { return localizeGameText(text, locale.value); }
function previewPlayerIcon(line: string) {
  const card = previewCandidate.value?.cards.find(candidateCard => {
    const source = catalog[candidateCard.name];
    return line.includes(candidateCard.name)
      || (source && line.includes(`${source.chara}/${source.costume}`));
  });
  return card ? cardImages.value[card.name] || defaultImg : '';
}
function previewElementIcon(element: BattleLogActionElement) {
  if (element === '火') return fireIcon;
  if (element === '水') return waterIcon;
  if (element === '木') return floraIcon;
  return cosmicIcon;
}
function preview(result: SearchResult) {
  busy.value = true;
  previewIsBest.value = true;
  previewCandidate.value = clone(result.candidate);
  getWorker().postMessage({ method: 'preview', id: ++requestId, input: clone(evaluatedInput.value), candidate: clone(result.candidate), best: clone(result.validationBest) });
}
function openSimulator(result: SearchResult) {
  try {
    const id = saveSearchTransfer(clone(evaluatedInput.value!), clone(result.candidate));
    const url = router.resolve({ name: 'examSimulator', query: { resourceSearch: id } }).href;
    window.open(url, '_blank', 'noopener,noreferrer');
  } catch { error.value = t('examSearch.saveFailed'); }
}
function variantCardSummary(result: SearchResult) {
  return result.candidate.cards.filter(card => !card.support && card.totsu > card.originalTotsu)
    .map(card => `${localizeCharacterName(catalog[card.name].chara, locale.value)} +${card.totsu - card.originalTotsu}`).join(' · ') || t('examSearch.noUpgrade');
}
onBeforeRouteLeave(() => requestStopAndSave());
onBeforeUnmount(() => { worker?.terminate(); });
</script>

<style scoped>
.resource-search { max-width: 1200px; padding-top: 28px; }
.resource-search.embedded { max-width: none; padding: 0 !important; }
.resource-search.embedded .setup { border: 0; background: transparent; }
.search-settings-fields { display: grid; gap: 20px; padding-top: 8px; border: 0; }
.required-card-setting, .character-setting { display: grid; grid-template-columns: 150px minmax(0, 1fr); align-items: center; gap: 16px; padding: 12px 0; }
.selection-label { display: flex; align-items: center; gap: 8px; font-size: .9rem; }
.optional-label { font-size: .75rem; color: #657582; font-weight: normal; }
.character-picker-open { justify-self: start; }
.resource-search > .actions { border-top: 1px solid #dde6ed; padding-top: 16px; }
.resource-search > .actions .resource-start { order: 0; }
.resource-search > .actions .search-settings-open { order: 2; }
.required-card-slots { display: grid; grid-template-columns: repeat(5, minmax(0, 72px)); gap: 10px; }
.required-card-slot { position: relative; min-width: 0; }
.required-card-pick { display: grid; place-items: center; width: 100%; aspect-ratio: 1; border: 1px solid #c6d1dc; border-radius: 6px; overflow: hidden; background: white; color: #1976d2; font-size: 24px; }
.required-card-pick img { width: 100%; height: 100%; object-fit: cover; }
.required-card-clear { position: absolute; top: -7px; right: -7px; width: 22px; height: 22px; background: white; border: 1px solid #c6d1dc; border-radius: 50%; line-height: 18px; }
.search-settings-open { margin-left: 0; }
.filter-count { min-width: 1.4em; margin-left: 6px; padding: 1px 5px; border-radius: 999px; background: #e8eef4; font-size: .8em; }
.filter-help { color: #52616d; font-size: .85rem; }
.character-filter-option { display: flex; align-items: center; gap: 8px; min-width: 0; padding: 8px; border: 1px solid #dde6ed; border-radius: 8px; background: #fbfcfd; cursor: pointer; }
.character-filter-option.selected { border-color: #d9a65d; background: #fff7ec; }
.character-filter-option input { flex: 0 0 auto; accent-color: #b16a21; }
.character-icon-wrap { position: relative; flex: 0 0 auto; display: block; }
.character-filter-option:focus-within { outline: 2px solid #b16a21; outline-offset: 2px; }
.character-filter-option span { min-width: 0; overflow-wrap: anywhere; font-size: .85rem; }
.character-filter-list { display: grid; grid-template-columns: repeat(auto-fill, minmax(60px, 1fr)); gap: 6px; margin: 12px 2px 4px; }
.character-filter-option { flex-direction: column; justify-content: flex-start; text-align: center; padding: 4px; gap: 4px; }
.character-icon { width: 50px; height: 50px; border-radius: 50%; object-fit: cover; background: #eef3f7; }
.character-filter-option:not(.selected) .character-icon { opacity: .5; }
.character-selected-mark { position: absolute; right: -4px; bottom: -4px; display: grid; place-items: center; width: 20px; height: 20px; border-radius: 50%; background: #b16a21; color: #fff; font-size: 13px !important; font-weight: 800; }
.sr-only { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0, 0, 0, 0); white-space: nowrap; border: 0; }
.filter-empty { color: #8b4a10; }
.resource-start { min-width: 180px; }
.character-filter-option:has(input:disabled) { opacity: .45; cursor: default; }
.v-dialog.search-character-dialog :deep(.v-card.character-filter-card) { overflow: hidden; }
.v-dialog.search-character-dialog :deep(.character-filter-card > .v-card-text) { min-height: 0; padding: 12px 16px; }
@media (max-width: 600px) {
  .search-settings-open { margin-left: 0; }
  .required-card-setting, .character-setting { grid-template-columns: 1fr; gap: 8px; }
  .actions .resource-start { flex: 1; }
}
h1 { font-size: 1.6rem; margin-bottom: 12px; } h2 { font-size: 1.15rem; margin: 20px 0 10px; }
fieldset { border: 0; min-width: 0; } fieldset:disabled { opacity: .65; pointer-events: none; }
.input-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(240px, 100%), 1fr)); gap: 16px; margin: 16px 0; }
.actions { display: flex; flex-wrap: wrap; align-items: center; gap: 10px; }
.result-heading, .metrics { display: flex; flex-wrap: wrap; gap: 16px; align-items: center; }
.metrics { padding: 12px 0; } .battle-log { white-space: pre-wrap; overflow-wrap: anywhere; font-size: .85rem; }
p { margin: 8px 0; } small { opacity: .8; }
.lead { color: #64748b; margin-bottom: 22px; }
.setup { border: 1px solid #d9e2ea; border-radius: 8px; background: #fff; overflow: hidden; }
.setup-row { display: flex; gap: 16px; padding: 20px 24px; border-bottom: 1px solid #8882; }
.step-content { flex: 1; min-width: 0; }
.step-content h2 { margin: 0 0 12px; }
.muted { color: #64748b; font-size: .85rem; }
.missing { color: #9a5900; font-size: .85rem; }
.budget-field { max-width: 220px; }
.advanced-settings { padding: 16px 24px; }
summary { cursor: pointer; font-size: .9rem; padding: 8px 0; }
.nested-settings { border-top: 1px solid #8883; padding: 8px 0; }
.evaluation-notes { margin: 12px 0; color: #64748b; }
@media (max-width: 600px) {
  .resource-search.embedded .resource-start { width: 100%; }
}
.section-icon { color: #52616d; margin-top: 1px; }
.setup-row { border-color: #edf2f6; }
.step-content h2 { font-weight: 800; }
.special-challenge-list { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(300px, 100%), 1fr)); gap: 8px; }
.special-challenge-row { display: flex; align-items: center; gap: 2px; min-width: 0; }
.special-challenge-item { flex: 1; display: grid; grid-template-columns: 18px 32px minmax(0, 1fr) auto; align-items: center; gap: 8px; min-height: 42px; padding: 8px 10px; border: 1px solid #dde6ed; border-radius: 8px; background: #fbfcfd; cursor: pointer; min-width: 0; }
.special-challenge-item input { width: 16px; height: 16px; accent-color: #b16a21; }
.special-challenge-item.selected { border-color: #d9a65d; background: #fff7ec; }
.special-rank { color: #89530d; font-size: 11px; font-weight: 900; }
.special-label { min-width: 0; font-size: 13px; line-height: 1.25; font-weight: 800; }
.special-label small { display: block; margin-top: 4px; color: #52616d; font-size: 11px; font-weight: 400; }
.special-score { color: #9b4f0b; font-weight: 900; white-space: nowrap; font-size: 13px; }
.v-dialog :deep(.v-card.variants-card > .v-card-text) { padding: 0 12px; }
.selected-exam { padding: 0 16px; }
</style>
