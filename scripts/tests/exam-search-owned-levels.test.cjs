const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const vue = require('vue');
const { createPinia, setActivePinia } = require('pinia');
const cards = require('../../src/assets/chara.json');
const catalog = Object.fromEntries(cards.map(card => [card.name, card]));
const root = path.resolve(__dirname, '../..');
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');
const clone = value => JSON.parse(JSON.stringify(value));
const compiled = new Map();
function compile(source) {
  if (!compiled.has(source)) compiled.set(source, ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2021, esModuleInterop: true },
  }).outputText);
  return compiled.get(source);
}
const names = [...new Set(cards.filter(card => card.rare === 'SSR').map(card => card.chara))]
  .slice(0, 7).map(chara => cards.find(card => card.rare === 'SSR' && card.chara === chara).name);
const rosterCard = (name, level = 80, totsu = 0) => ({
  name, level, totsu, magicLevels: [10, 10, 10], buddyLevels: [10, 10, 10], allowUpgrade: true,
});
const handCard = (name, level = 80, isOwned = true) => ({ cardName: name, level, totsu: 0, isOwned });
function searchInput(unified = false) {
  return { preset: { id: 'owned-level-test', title: unified ? '統一試験' : '通常試験', kind: 'BASIC',
    enemyElement: '火', enemyHp: 100000, difficulty: 1.5, enemies: [], specialChallenges: [] },
  roster: [], supports: unified ? [rosterCard(names[6], 120, 4)] : [], budget: 0, itemsPerLimitBreak: 1,
  target: 0, attempts: 30, desiredProbability: .05, tolerance: 0, challengeLocks: {}, maxRemoved: 1, seedTeams: [] };
}
function checkpoint() {
  return { cursor: 1, seen: [], pool: [], finalists: [], pending: [], round: 0, elapsed: 10, trialSerial: 0, nonce: 'test' };
}

// Execute the view's actual setup, store, persistence, and Vue watchers. Only
// browser/UI boundaries and worker execution are replaced with test doubles.
function runtime(t, handCards, savedInput = searchInput(), savedCheckpoint) {
  const values = new Map(), cache = new Map(), timers = new Map(), workers = [];
  const storage = { getItem: key => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key),
    get length() { return values.size; }, key: index => [...values.keys()][index] ?? null };
  const window = { localStorage: storage, sessionStorage: { getItem: () => null, setItem() {}, removeItem() {} },
    addEventListener() {}, removeEventListener() {} };
  let timerId = 0;
  const context = { console, performance, MessageChannel, URL, window, localStorage: storage, sessionStorage: window.sessionStorage,
    setTimeout: callback => { timers.set(++timerId, callback); return timerId; }, clearTimeout: id => timers.delete(id),
    defineProps: () => ({}), withDefaults: (props, defaults) => ({ ...defaults, ...props }),
    defineEmits: () => () => {}, defineExpose() {},
    Worker: class {
      messages = [];
      terminated = false;
      constructor() { workers.push(this); }
      postMessage(message) { this.messages.push(message); }
      terminate() { this.terminated = true; }
      respond(data) { return this.onmessage({ data: { id: this.messages.at(-1).id, ...data } }); }
    },
  };
  function localRequire(id) {
    if (id === 'vue') return { ...vue, onMounted() {}, onBeforeUnmount() {} };
    if (id === 'vue-router') return { useRouter: () => ({}), onBeforeRouteLeave() {} };
    if (id === 'vue-i18n') return { useI18n: () => ({ locale: vue.ref('ja'), t: (key, args) => `${key}:${args?.count ?? ''}` }) };
    if (id.endsWith('.vue') || id.endsWith('.webp')) return {};
    if (id === '@/utils/characterAssets') return { loadCachedImageUrl: async () => '', loadCharacterImageUrl: async () => '' };
    return id.startsWith('@/') ? load(`src/${id.slice(2)}${id.endsWith('.json') ? '' : '.ts'}`) : require(id);
  }
  function load(relative) {
    if (relative.endsWith('.json')) return JSON.parse(read(relative));
    if (!cache.has(relative)) {
      const module = { exports: {} };
      cache.set(relative, module.exports);
      vm.runInNewContext(compile(read(relative)), { ...context, module, exports: module.exports, require: localRequire });
      cache.set(relative, module.exports);
    }
    return cache.get(relative);
  }
  storage.setItem('twst-hand-collection', JSON.stringify(Object.fromEntries(handCards.map(card => [card.cardName, card]))));
  const persistence = load('src/storage/examSearchStorage.ts');
  persistence.saveExamSearch(savedInput);
  if (savedCheckpoint) persistence.saveSearchSession({ input: savedInput, checkpoint: savedCheckpoint,
    version: load('src/domain/examSearch/types.ts').ENGINE_VERSION, catalogVersion: 'test' });
  setActivePinia(createPinia());
  const scope = vue.effectScope();
  t.after(() => scope.stop());
  const source = read('src/views/examSearch.vue').split('<script setup lang="ts">')[1].split('</script>')[0]
    .replaceAll('import.meta.url', JSON.stringify('file:///examSearch.vue'));
  const viewContext = { ...context, exports: {}, require: localRequire };
  scope.run(() => vm.runInNewContext(compile(source + '\nglobalThis.view = { input, hand, rosterReady, canResume, progress, evaluatedInput, busy, error, continuousSearch, start, resume, requestStopAndSave, setSupportCandidates, selectPreset, applySharedConditions, sessionSaved, retrySave, preview };'), viewContext));
  function supportPicker(modelValue, includeAllRarities = true) {
    const props = vue.reactive({ modelValue, includeAllRarities, focusRequest: null, disabled: false });
    const mounted = [];
    const pickerContext = { ...context, exports: {}, defineProps: () => props,
      defineEmits: () => (event, names) => { assert.equal(event, 'update:modelValue'); props.modelValue = names; },
      require: id => id === 'vue' ? { ...vue, onMounted: callback => mounted.push(callback), onBeforeUnmount() {} } : localRequire(id) };
    const script = read('src/components/SupportBody.vue').split('<script setup lang="ts">')[1].split('</script>')[0];
    scope.run(() => vm.runInNewContext(compile(script + '\nglobalThis.picker = { selectableCharacters, selectedSupportCharacters, searchSettingsStore, toggleCharacter, selectAll, deselectAll, selectHeal, deselectHeal };'), pickerContext));
    mounted.forEach(callback => callback());
    return { ...pickerContext.picker, props };
  }
  return { view: viewContext.view, load, workers, timers, persistence, supportPicker, storage,
    flushTimers() { const callbacks = [...timers.values()]; timers.clear(); callbacks.forEach(callback => callback()); } };
}

test('owned Lv0 cards are excluded while Lv1+ training is preserved', t => {
  const { view } = runtime(t, [handCard(names[0], 0), handCard(names[1], 1),
    { ...handCard(names[2], 95), totsu: 3 }, handCard(names[3], 80, false), handCard('unknown-card', 80)]);
  assert.deepEqual(clone(view.input.value.roster), [rosterCard(names[1], 1), rosterCard(names[2], 95, 3)]);
});

for (const unified of [false, true]) {
  test(`${unified ? 'unified' : 'normal'} exam counts only eligible owned cards and blocks an insufficient start`, async t => {
    const count = unified ? 4 : 5;
    const { view, load, workers } = runtime(t, names.slice(0, count).map((name, index) => handCard(name, index ? 1 : 0)), searchInput(unified));
    const { validateInput } = load('src/domain/examSearch/variants.ts');
    assert.equal(view.input.value.roster.length, count - 1);
    assert.equal(view.rosterReady.value, false);
    assert.equal(validateInput(view.input.value, catalog), 'roster');
    view.start(1000);
    assert.equal(view.error.value, `examSearch.simple.missingCards:${count}`);
    assert.equal(workers.length, 0);
    view.hand.updateHandCard(names[0], { level: 1 });
    await vue.nextTick();
    assert.equal(view.rosterReady.value, true);
    assert.equal(validateInput(view.input.value, catalog), null);
    view.start(1000);
    assert.equal(workers[0].messages[0].input.roster.length, count);
    assert.ok(workers[0].messages[0].input.roster.every(card => card.level === 1));
  });
}

test('required cards and characters cannot bring Lv0 back into owned slots, but supports remain available', t => {
  const { view, load } = runtime(t, [...names.slice(0, 5).map(name => handCard(name)), handCard(names[6], 0)]);
  const { validateInput } = load('src/domain/examSearch/variants.ts');
  const { buildTasks, generateCandidates } = load('src/domain/examSearch/candidateGenerator.ts');
  const input = clone(view.input.value);
  input.requiredCards = [names[6]];
  assert.equal(validateInput(input, catalog), 'required-cards-unowned');
  input.requiredCards = [];
  input.requiredCharacters = [catalog[names[6]].chara];
  assert.equal(validateInput(input, catalog), 'required-characters-unowned');
  input.preset.title = '統一試験';
  input.requiredCards = [names[6]];
  input.supports = [rosterCard(names[6], 120, 4)];
  assert.equal(validateInput(input, catalog), null);
  const tasks = buildTasks(input, catalog);
  const candidates = generateCandidates(input, tasks[0], catalog);
  assert.ok(candidates.length);
  for (const candidate of candidates) {
    assert.equal(candidate.cards.filter(card => !card.support).length, 4);
    assert.ok(candidate.cards.filter(card => !card.support).every(card => card.name !== names[6]));
    assert.deepEqual(clone(candidate.cards.filter(card => card.support).map(card => [card.name, card.level])), [[names[6], 120]]);
  }
});

test('saved search results and simulator decks cannot seed an excluded owned card', t => {
  const input = searchInput();
  input.roster = names.slice(0, 6).map(name => rosterCard(name));
  const stale = checkpoint();
  const staleTeam = [...names.slice(0, 4), names[5]];
  stale.finalists = [{ candidate: { cards: staleTeam.map(name => ({ name })) } }];
  const { view, load, persistence } = runtime(t,
    names.slice(0, 6).map((name, index) => handCard(name, index === 5 ? 0 : 80)), input, stale);
  const { buildTasks, generateCandidates } = load('src/domain/examSearch/candidateGenerator.ts');
  const validTeam = names.slice(0, 5);
  view.input.value.seedTeams = [...persistence.loadSearchSeedTeams(input.preset.id), staleTeam, validTeam];
  const current = clone(view.input.value);
  const tasks = buildTasks(current, catalog);
  const seeded = tasks.filter(task => task.seedTeam);
  assert.ok(seeded.length);
  assert.ok(seeded.every(task => JSON.stringify(task.seedTeam) === JSON.stringify(validTeam)));
  const candidates = generateCandidates(current, tasks[0], catalog);
  assert.ok(candidates.length);
  assert.ok(candidates.every(candidate => candidate.cards.every(card => card.name !== names[5])));
});

for (const legacy of [false, true]) {
  test(`${legacy ? 'legacy Lv0-to-Lv1' : 'unchanged positive-level'} saved session ${legacy ? 'is rejected' : 'can resume'}`, t => {
    const input = searchInput();
    input.roster = names.slice(0, 5).map(name => rosterCard(name));
    if (legacy) input.roster.push(rosterCard(names[5], 1));
    const { view, workers } = runtime(t, [...names.slice(0, 5).map(name => handCard(name)), handCard(names[5], 0)], input, checkpoint());
    assert.equal(view.canResume.value, !legacy);
    if (legacy) {
      assert.equal(view.progress.value, null);
      assert.equal(view.evaluatedInput.value, null);
    } else {
      view.resume();
      assert.equal(workers[0].messages[0].method, 'resume');
      assert.deepEqual(clone(workers[0].messages[0].input.roster), input.roster);
    }
  });
}

for (const errorName of ['QuotaExceededError', 'SecurityError']) {
  test(`${errorName} during checkpoint save stops auto continuation but keeps the latest in-memory resume`, async t => {
    const { view, workers, timers, flushTimers, storage, persistence } = runtime(t, names.slice(0, 5).map(name => handCard(name)));
    view.start(1000);
    const worker = workers[0];
    await worker.respond({ progress: { phase: 'done', results: [], tasksDone: 1 }, checkpoint: checkpoint(), catalogVersion: 'test' });
    assert.equal(persistence.loadSearchSession().checkpoint.cursor, 1);
    const setItem = storage.setItem;
    storage.setItem = (key, value) => {
      if (key.endsWith('-session')) { const error = new Error(errorName); error.name = errorName; throw error; }
      return setItem(key, value);
    };
    view.continuousSearch.value = true;
    view.resume();
    const latest = { ...checkpoint(), cursor: 2 };
    await worker.respond({ progress: { phase: 'done', results: [], tasksDone: 2 }, checkpoint: latest, catalogVersion: 'test' });
    assert.equal(view.error.value, 'examSearch.sessionSaveFailed:');
    assert.equal(view.busy.value, false);
    assert.equal(view.canResume.value, true);
    assert.equal(view.progress.value.tasksDone, 2);
    assert.equal(persistence.loadSearchSession().checkpoint.cursor, 1, 'reload can only recover the older saved checkpoint');
    assert.equal(timers.size, 0);
    const requests = worker.messages.length;
    flushTimers();
    assert.equal(worker.messages.length, requests, 'failed saves must not restart automatically');
    assert.equal(await view.requestStopAndSave(), false, 'navigation must not discard the unsaved checkpoint');
    view.resume();
    assert.equal(worker.messages.at(-1).checkpoint.cursor, 2, 'explicit resume uses the unsaved checkpoint in memory');
    await worker.respond({ checkpoint: latest, catalogVersion: 'test' });
    assert.equal(view.error.value, 'examSearch.sessionSaveFailed:', 'retrying without freeing space repeats the warning');
    view.preview({ candidate: { cards: [] }, validationBest: { seed: 'preview', score: 1 } });
    const leavingPreview = view.requestStopAndSave();
    await worker.respond({ preview: { score: 1, log: [] } });
    assert.equal(await leavingPreview, false, 'finishing a preview must not mark unsaved results as saved');
    storage.setItem = setItem;
    await view.retrySave();
    assert.equal(view.sessionSaved.value, true);
    assert.equal(view.error.value, '');
    assert.equal(persistence.loadSearchSession().checkpoint.cursor, 2);
    assert.equal(await view.requestStopAndSave(), true);
  });
}

for (const stopWhileSaving of [false, true]) {
  test(`asynchronous save waits for commit before ${stopWhileSaving ? 'navigation' : 'continuing the search'}`, async t => {
    const { view, workers, timers, persistence } = runtime(t, names.slice(0, 5).map(name => handCard(name)));
    let release;
    const originalSave = persistence.saveSearchSession;
    persistence.saveSearchSession = value => new Promise(resolve => {
      release = async () => resolve(await originalSave(value));
    });
    view.continuousSearch.value = true;
    view.start(1000);
    const response = workers[0].respond({ progress: { phase: 'done', results: [], tasksDone: 1 },
      checkpoint: checkpoint(), catalogVersion: 'test' });
    assert.equal(view.busy.value, true);
    assert.equal(view.sessionSaved.value, false);
    assert.equal(timers.size, 0);
    let navigationFinished = false;
    const navigation = stopWhileSaving ? view.requestStopAndSave().then(saved => { navigationFinished = true; return saved; }) : null;
    await Promise.resolve();
    assert.equal(navigationFinished, false);
    await release(); await response;
    assert.equal(view.sessionSaved.value, true);
    assert.equal(timers.size, stopWhileSaving ? 0 : 1);
    if (navigation) assert.equal(await navigation, true);
  });
}

test('an old asynchronous save cannot revive invalidated search results', async t => {
  const { view, workers, timers, persistence } = runtime(t, names.slice(0, 5).map(name => handCard(name)));
  let release;
  persistence.saveSearchSession = () => new Promise(resolve => { release = resolve; });
  view.continuousSearch.value = true;
  view.start(1000);
  const response = workers[0].respond({ progress: { phase: 'done', results: [], tasksDone: 1 },
    checkpoint: checkpoint(), catalogVersion: 'test' });
  view.hand.updateHandCard(names[0], { level: 81 });
  await vue.nextTick();
  release(false); await response;
  assert.equal(view.busy.value, false);
  assert.equal(view.progress.value, null);
  assert.equal(view.error.value, '');
  assert.equal(view.canResume.value, false);
  assert.equal(timers.size, 0);
});

for (const betweenBatches of [false, true]) {
  test(`changing a card to Lv0 ${betweenBatches ? 'between continuous batches' : 'during a search'} clears results and prevents old-roster continuation`, async t => {
    const { view, workers, timers, flushTimers } = runtime(t, names.slice(0, 5).map(name => handCard(name)));
    view.continuousSearch.value = true;
    view.start(1000);
    const worker = workers[0];
    await worker.respond({ progress: { phase: betweenBatches ? 'done' : 'generate', results: [], tasksDone: 1 } });
    if (betweenBatches) {
      await worker.respond({ checkpoint: checkpoint(), catalogVersion: 'test' });
      assert.equal(timers.size, 1);
    }
    const saving = betweenBatches ? null : view.requestStopAndSave();
    view.hand.updateHandCard(names[0], { level: 0 });
    await vue.nextTick();
    if (saving) assert.equal(await saving, true);
    assert.equal(worker.terminated, true);
    assert.equal(view.busy.value, false);
    assert.equal(view.progress.value, null);
    assert.equal(view.evaluatedInput.value, null);
    assert.equal(view.canResume.value, false);
    assert.equal(timers.size, 0);
    flushTimers();
    assert.ok(worker.messages.every(message => message.method !== 'resume'));
    await worker.respond({ progress: { phase: 'done', results: [], tasksDone: 2 } });
    assert.equal(view.progress.value, null, 'late worker responses cannot restore stale results');
  });
}

test('changing an excluded card leaves a valid continuous search running', async t => {
  const { view, workers, flushTimers } = runtime(t, [...names.slice(0, 5).map(name => handCard(name)), handCard(names[5], 0)]);
  view.continuousSearch.value = true;
  view.start(1000);
  const worker = workers[0];
  await worker.respond({ progress: { phase: 'done', results: [], tasksDone: 1 }, checkpoint: checkpoint(), catalogVersion: 'test' });
  view.hand.updateHandCard(names[5], { totsu: 4 });
  await vue.nextTick();
  assert.equal(worker.terminated, false);
  assert.equal(view.busy.value, true);
  flushTimers();
  assert.equal(worker.messages.at(-1).method, 'resume');
  assert.ok(worker.messages.at(-1).input.roster.every(card => card.name !== names[5]));
});

test('support selection persists through preset changes, shared conditions and reload', t => {
  const { view, persistence } = runtime(t, names.slice(0, 5).map(name => handCard(name)), searchInput(true));
  const selected = [names[4], names[6]];
  view.setSupportCandidates(selected);
  assert.deepEqual(clone(view.input.value.supports.map(card => card.name)).sort(), [...selected].sort());
  const saved = persistence.loadExamSearch();
  assert.ok(saved.excludedSupportNames.includes(names[0]));
  view.selectPreset({ ...searchInput(false).preset, id: 'normal' });
  assert.equal(view.input.value.supports.length, 0);
  view.selectPreset({ ...searchInput(true).preset, id: 'unified-again' });
  assert.deepEqual(clone(view.input.value.supports.map(card => card.name)).sort(), [...selected].sort());
  view.applySharedConditions({ preset: { ...searchInput(true).preset, id: '第16回統一火DF', title: '第16回統一火DF' }, challengeLocks: {}, maxRemoved: 1 });
  assert.deepEqual(clone(view.input.value.supports.map(card => card.name)).sort(), [...selected].sort());
  const restored = runtime(t, names.slice(0, 5).map(name => handCard(name)), saved).view;
  assert.deepEqual(clone(restored.input.value.supports), clone(saved.supports));
});

test('all supports OFF survives reload and preset changes and blocks search with a support-specific message', t => {
  const { view, workers, persistence } = runtime(t, names.slice(0, 5).map(name => handCard(name)), searchInput(true));
  view.setSupportCandidates([]);
  assert.equal(view.rosterReady.value, false);
  view.start(1000);
  assert.equal(workers.length, 0);
  assert.equal(view.error.value, 'examSearch.supportRequired:');
  const saved = persistence.loadExamSearch();
  const restored = runtime(t, names.slice(0, 5).map(name => handCard(name)), saved).view;
  assert.equal(restored.input.value.supports.length, 0);
  restored.applySharedConditions({ preset: { ...searchInput(true).preset, id: 'different' }, challengeLocks: {}, maxRemoved: 1 });
  assert.equal(restored.input.value.supports.length, 0);
  restored.selectPreset({ ...searchInput(false).preset, id: 'normal' });
  restored.selectPreset({ ...searchInput(true).preset, id: 'unified' });
  assert.equal(restored.input.value.supports.length, 0);
});

test('OFF support cards cannot enter generated teams as supports but remain available as owned cards', t => {
  const { view, load, workers } = runtime(t, names.slice(0, 5).map(name => handCard(name)), searchInput(true));
  view.setSupportCandidates([names[6]]);
  view.input.value.requiredCards = [names[0]];
  const input = clone(view.input.value);
  const { buildTasks, generateCandidates } = load('src/domain/examSearch/candidateGenerator.ts');
  const tasks = buildTasks(input, catalog);
  const candidates = generateCandidates(input, tasks[0], catalog);
  assert.ok(candidates.length);
  for (const candidate of candidates) {
    assert.deepEqual(clone(candidate.cards.filter(card => card.support).map(card => card.name)), [names[6]]);
    assert.ok(candidate.cards.some(card => !card.support && card.name === names[0]));
  }
  view.start(1000);
  assert.deepEqual(clone(workers[0].messages[0].input.supports.map(card => card.name)), [names[6]]);
  view.setSupportCandidates([]);
  assert.deepEqual(clone(view.input.value.supports.map(card => card.name)), [names[6]], 'cannot edit during a search');
});

test('changing support candidates invalidates the previous session and prevents resume', t => {
  const input = searchInput(true);
  input.roster = names.slice(0, 5).map(name => rosterCard(name));
  const { view } = runtime(t, names.slice(0, 5).map(name => handCard(name)), input, checkpoint());
  assert.equal(view.canResume.value, true);
  view.setSupportCandidates([names[5]]);
  assert.equal(view.canResume.value, false);
  assert.equal(view.progress.value, null);
  assert.equal(view.evaluatedInput.value, null);
});

test('reused support picker keeps exam selections isolated and preserves all-OFF on mount', t => {
  const { supportPicker } = runtime(t, []);
  const picker = supportPicker([]);
  const legacyNames = clone(picker.searchSettingsStore.selectedSupportCharacters);
  assert.equal(picker.selectableCharacters.value.length, cards.length);
  assert.deepEqual(clone(picker.selectedSupportCharacters.value), []);
  picker.toggleCharacter(names[0]);
  assert.deepEqual(clone(picker.props.modelValue), [names[0]]);
  picker.toggleCharacter(names[0]);
  assert.deepEqual(clone(picker.props.modelValue), []);
  picker.selectAll();
  assert.equal(picker.props.modelValue.length, cards.length);
  picker.deselectAll();
  picker.selectHeal();
  assert.ok(picker.props.modelValue.length > 0);
  assert.ok(picker.props.modelValue.every(name => [catalog[name].magic1heal, catalog[name].magic2heal, catalog[name].magic3heal]
    .some(value => value.startsWith('回復(') || value.startsWith('回復&継続回復('))));
  picker.deselectHeal();
  assert.deepEqual(clone(picker.props.modelValue), []);
  picker.props.disabled = true;
  picker.selectAll();
  picker.toggleCharacter(names[0]);
  assert.deepEqual(clone(picker.props.modelValue), []);
  assert.deepEqual(clone(picker.searchSettingsStore.selectedSupportCharacters), legacyNames);
});

test('existing support picker usage still defaults to all SSR cards in its original store', t => {
  const { supportPicker } = runtime(t, []);
  const picker = supportPicker(undefined, false);
  assert.equal(picker.selectableCharacters.value.length, cards.filter(card => card.rare === 'SSR').length);
  assert.equal(picker.searchSettingsStore.selectedSupportCharacters.length, picker.selectableCharacters.value.length);
  picker.deselectAll();
  assert.deepEqual(clone(picker.searchSettingsStore.selectedSupportCharacters), []);
  picker.toggleCharacter(names[0]);
  assert.deepEqual(clone(picker.searchSettingsStore.selectedSupportCharacters), [names[0]]);
});

test('additional trained levels respect rarity, limit breaks and remaining friendship headroom', t => {
  const { load } = runtime(t, []);
  const { cardVariants } = load('src/domain/examSearch/variants.ts');
  const level = (rare, current, totsu, target, extra = 0, support = false) =>
    cardVariants(rosterCard(names[0], current, totsu), rare, support, target, extra)[0].level;
  for (const [rare, base, bonus] of [['SSR', 80, 20], ['SR', 60, 10], ['R', 40, 10]]) {
    for (let totsu = 0; totsu <= 4; totsu++) {
      assert.equal(level(rare, base + totsu * 5, totsu, totsu, 20), base + totsu * 5 + bonus);
      assert.equal(level(rare, base + totsu * 5 + bonus - 1, totsu, totsu, 20), base + totsu * 5 + bonus);
    }
  }
  assert.equal(level('SSR', 80, 0, 1, 20), 105);
  assert.equal(level('SSR', 90, 0, 0, 20), 100, 'existing friendship bonus cannot be added twice');
  assert.equal(level('SSR', 110, 4, 4, 20), 120);
  assert.equal(level('SSR', 80, 0, 0, 1), 81, 'card-level increments are not friendship-level increments');
  assert.equal(level('SSR', 40, 0, 0, 10), 50, 'do not fill the entire available level cap');
  assert.equal(level('SSR', 80, 0, 1), 85, 'zero preserves the existing limit-break increment');
  assert.equal(level('SSR', 80, 0, 0), 80);
  assert.equal(level('SSR', 80, 0, 0, 20, true), 80, 'supports retain their registered training');
  assert.equal(level('SSR', 120, 0, 1, 20), 120, 'legacy inconsistent registrations are not lowered');
  const original = rosterCard(names[0]);
  const unbroken = cardVariants(original, 'SSR', false, 0, 20);
  assert.deepEqual(clone(unbroken.map(card => card.selectedMagic)), [[1, 2]], 'levels never unlock M3');
  assert.equal(original.level, 80, 'the hand collection is unchanged');
});

test('extra level cap is validated, saved and sent to the worker without altering the collection', async t => {
  const { view, workers, persistence, load } = runtime(t, names.slice(0, 5).map(name => handCard(name)));
  const { validateInput } = load('src/domain/examSearch/variants.ts');
  assert.equal(view.input.value.additionalLevelCap ?? 0, 0, 'legacy settings default to no additional levels');
  for (const value of [-1, 101, 1.5, '', '10', NaN, Infinity]) {
    view.input.value.additionalLevelCap = value;
    assert.equal(validateInput(view.input.value, catalog), 'additional-level-cap');
    view.start(1000);
    assert.equal(view.error.value, 'examSearch.validation.additional-level-cap:');
    assert.equal(workers.length, 0);
  }
  view.input.value.additionalLevelCap = 10;
  await vue.nextTick();
  view.start(1000);
  assert.equal(workers[0].messages[0].input.additionalLevelCap, 10);
  assert.equal(persistence.loadExamSearch().additionalLevelCap, 10);
  assert.ok(view.hand.ownedCards.every(card => card.level === 80));
  await workers[0].respond({ progress: { phase: 'done', results: [], tasksDone: 1 }, checkpoint: checkpoint(), catalogVersion: 'test' });
  assert.equal(view.canResume.value, true);
  view.input.value.additionalLevelCap = 5;
  await vue.nextTick();
  assert.equal(view.canResume.value, false);
  assert.equal(view.progress.value, null, 'scores from the old training setting are cleared');
});

test('saved extra level cap survives restoring a resumable search', t => {
  const input = searchInput();
  input.additionalLevelCap = 7;
  input.roster = names.slice(0, 5).map(name => rosterCard(name));
  const { view, workers } = runtime(t, names.slice(0, 5).map(name => handCard(name)), input, checkpoint());
  assert.equal(view.canResume.value, true);
  view.resume();
  assert.equal(workers[0].messages[0].input.additionalLevelCap, 7);
});

for (const unified of [false, true]) {
  test(`shared extra level budget reaches ${unified ? 'unified' : 'normal'} candidates, refinements and simulator transfers`, async t => {
    const { load, persistence } = runtime(t, []);
    const input = searchInput(unified);
    input.roster = names.slice(0, unified ? 4 : 5).map(name => rosterCard(name, 90, 2));
    if (unified) input.supports[0].level = 85;
    input.additionalLevelCap = 10;
    input.budget = 1;
    const { buildTasks, generateCandidates, generateNeighbors, crossCandidates } = load('src/domain/examSearch/candidateGenerator.ts');
    const { jointSpellCandidates, lowerCostCandidates, trainedUpgradeCandidates, upgradeCost } = load('src/domain/examSearch/variants.ts');
    const { additionalLevelCost } = load('src/domain/examSearch/levelAllocation.ts');
    const tasks = buildTasks(input, catalog);
    const baseline = generateCandidates(input, tasks.find(task => task.cost === 0), catalog);
    const upgraded = generateCandidates(input, tasks.find(task => task.cost === 1), catalog);
    assert.ok(baseline.length && upgraded.length);
    const parent = upgraded.find(candidate => candidate.cost === 1 && additionalLevelCost(candidate.cards) === 10);
    assert.ok(parent);
    const cheaper = lowerCostCandidates(input, parent, catalog);
    const spells = jointSpellCandidates(input, parent, catalog);
    const trained = trainedUpgradeCandidates(input, baseline[0], catalog);
    assert.ok(cheaper.length && spells.length && trained.length);
    assert.ok(baseline.some(candidate => candidate.cards.some(card => card.additionalLevels === 10)), 'can allocate all ten levels to one card');
    assert.ok(baseline.some(candidate => candidate.cards.filter(card => card.additionalLevels === 5).length === 2), 'can split five levels each between two cards');
    assert.ok(baseline.some(candidate => additionalLevelCost(candidate.cards) === 0), 'also compares no additional training');
    const neighbors = await generateNeighbors(input, parent, catalog, new Set([parent.id]), () => false);
    const crossed = crossCandidates(input, parent, baseline[0], catalog, new Set());
    assert.ok(neighbors.length && crossed.length);
    for (const candidate of [...baseline, ...upgraded, ...cheaper, ...spells, ...trained, ...neighbors, ...crossed]) {
      for (const card of candidate.cards) assert.equal(card.level, card.support ? 85 : 90 + (card.totsu - 2) * 5 + (card.additionalLevels ?? 0));
      assert.ok(candidate.cards.every(card => (card.additionalLevels ?? 0) % 5 === 0), 'every generation and refinement path uses five-level units');
      assert.ok(additionalLevelCost(candidate.cards) <= 10, 'the whole team shares the ten-level allowance');
      assert.equal(candidate.cost, upgradeCost(input, candidate.cards), 'level training consumes no limit-break items');
      assert.ok(candidate.cost <= 1);
    }
    assert.ok(spells.every(candidate => additionalLevelCost(candidate.cards) === 10), 'spell changes retain the allocation');
    assert.ok(cheaper.every(candidate => additionalLevelCost(candidate.cards) === 10), 'reducing limit breaks does not remove separate friendship training');
    const id = persistence.saveSearchTransfer(input, parent);
    const transfer = persistence.loadSearchTransfer(id);
    assert.deepEqual(clone(transfer.candidate.cards), clone(parent.cards));
    assert.equal(transfer.input.additionalLevelCap, 10);
  });
}

function drain(generator) {
  let step = generator.next();
  while (!step.done) step = generator.next();
  return step.value;
}

test('allocation search finds five-level splits and respects a total budget above twenty', t => {
  const { load } = runtime(t, []);
  const { cardVariants } = load('src/domain/examSearch/variants.ts');
  const { levelAllocationSteps, additionalLevelCost } = load('src/domain/examSearch/levelAllocation.ts');
  const input = searchInput();
  input.additionalLevelCap = 15;
  const parent = { id: 'base', cards: names.slice(0, 5).map(name => cardVariants(rosterCard(name), 'SSR')[0]),
    challengeIds: [], cost: 0, policy: 'balanced', estimate: 0 };
  const original = clone(parent);
  const target = [5, 10, 0, 0, 0];
  const estimate = cards => -cards.reduce((sum, card, i) => sum + (card.additionalLevels - target[i]) ** 2, 0);
  const rows = drain(levelAllocationSteps(input, parent, catalog, estimate));
  assert.ok(rows.some(row => JSON.stringify(row.cards.map(c => c.additionalLevels)) === JSON.stringify(target)));
  assert.equal(new Set(rows.map(row => row.id)).size, rows.length, 'different level allocations have distinct IDs');
  assert.deepEqual(clone(parent), original);
  for (const budget of [25, 100]) {
    input.additionalLevelCap = budget;
    const rows = drain(levelAllocationSteps(input, parent, catalog, cards => cards.reduce((sum, c) => sum + c.level, 0)));
    assert.ok(rows.every(row => additionalLevelCost(row.cards) <= budget));
    assert.ok(rows.every(row => row.cards.every(card => card.additionalLevels <= 20 && card.level <= 100)));
    assert.ok(rows.some(row => additionalLevelCost(row.cards) === budget));
  }
});

test('a remainder below five stays on one card and refinement preserves learned plans', t => {
  const { load } = runtime(t, []);
  const { cardVariants } = load('src/domain/examSearch/variants.ts');
  const { levelAllocationNeighbors, additionalLevelCost } = load('src/domain/examSearch/levelAllocation.ts');
  const input = searchInput(); input.additionalLevelCap = 3;
  const parent = { id: 'base', cards: names.slice(0, 5).map(name => cardVariants(rosterCard(name), 'SSR')[0]),
    challengeIds: [], cost: 0, policy: 'balanced', estimate: 0,
    preferredPlan: [['0-M1', '1-M2']], preferredPlanMode: 'turn' };
  const key = row => row.cards.map(card => card.additionalLevels).join(',');
  const seen = new Set([key(parent)]), queue = [parent];
  while (queue.length) for (const row of levelAllocationNeighbors(input, queue.shift(), catalog, () => 0)) {
    assert.ok(additionalLevelCost(row.cards) <= 3);
    assert.equal(row.cost, 0);
    assert.deepEqual(clone(row.preferredPlan), parent.preferredPlan);
    if (!seen.has(key(row))) { seen.add(key(row)); queue.push(row); }
  }
  assert.equal(seen.size, 6, 'only zero and a single three-level remainder on each of five cards are reachable');
});

test('five-level refinement covers coarse splits without splitting the final remainder', t => {
  const { load } = runtime(t, []);
  const { cardVariants } = load('src/domain/examSearch/variants.ts');
  const { levelAllocationSteps, levelAllocationNeighbors, additionalLevelCost, withinLevelBudget } = load('src/domain/examSearch/levelAllocation.ts');
  const parent = { id: 'base', cards: names.slice(0, 5).map(name => cardVariants(rosterCard(name), 'SSR')[0]),
    challengeIds: [], cost: 0, policy: 'balanced', estimate: 0 };
  for (const budget of [10, 12]) {
    const input = { ...searchInput(), additionalLevelCap: budget };
    const key = row => row.cards.map(card => card.additionalLevels).join(',');
    const seeds = drain(levelAllocationSteps(input, parent, catalog, () => 0));
    const seen = new Set([key(parent)]), queue = [parent];
    for (const row of seeds) assert.ok(withinLevelBudget(input, row.cards, catalog));
    while (queue.length) for (const row of levelAllocationNeighbors(input, queue.shift(), catalog, () => 0)) {
      const amounts = row.cards.map(card => card.additionalLevels), remainder = amounts.filter(n => n % 5);
      assert.ok(additionalLevelCost(row.cards) <= budget);
      assert.ok(remainder.length <= (budget % 5 ? 1 : 0));
      if (remainder.length) {
        assert.equal(remainder[0] % 5, 2);
        assert.equal(additionalLevelCost(row.cards), budget);
      }
      if (!seen.has(key(row))) { seen.add(key(row)); queue.push(row); }
    }
    assert.ok(seen.has('5,5,0,0,0'));
    assert.ok(seen.has('10,0,0,0,0'));
    assert.ok(!seen.has('9,1,0,0,0'));
    assert.ok(!seen.has('2,2,2,2,2'));
    if (budget === 10) assert.equal(seen.size, 21);
    else {
      assert.ok(seen.has('10,2,0,0,0'));
      assert.ok(seen.has('5,5,2,0,0'));
      assert.ok(seen.has('7,5,0,0,0'));
      assert.ok(seen.has('12,0,0,0,0'));
      assert.ok(seeds.some(row => additionalLevelCost(row.cards) === 12));
    }
  }
});

test('support and rarity headroom leave unused budget rather than granting illegal levels', t => {
  const { load } = runtime(t, []);
  const { cardVariants } = load('src/domain/examSearch/variants.ts');
  const { levelAllocationSteps, additionalLevelCost } = load('src/domain/examSearch/levelAllocation.ts');
  const input = searchInput(true); input.additionalLevelCap = 100;
  const localCatalog = { a: { rare: 'SSR' }, b: { rare: 'SR' }, c: { rare: 'R' }, d: { rare: 'SSR' }, s: { rare: 'SSR' } };
  const specs = [['a', 99, 0], ['b', 60, 0], ['c', 69, 4], ['d', 120, 4], ['s', 80, 0]];
  const parent = { id: 'mixed', cards: specs.map(([name, level, totsu]) => cardVariants(rosterCard(name, level, totsu), localCatalog[name].rare, name === 's')[0]),
    challengeIds: [], cost: 0, policy: 'balanced', estimate: 0 };
  const rows = drain(levelAllocationSteps(input, parent, localCatalog, cards => cards.reduce((sum, c) => sum + c.level, 0)));
  assert.ok(rows.every(row => additionalLevelCost(row.cards) <= 12));
  const max = rows.find(row => additionalLevelCost(row.cards) === 12);
  assert.ok(max);
  assert.deepEqual(clone(max.cards.map(card => card.level)), [100, 70, 70, 120, 80]);
});

test('restored checkpoints discard over-budget and fine-grained allocations', t => {
  const { load } = runtime(t, []);
  const { cardVariants } = load('src/domain/examSearch/variants.ts');
  const { constrainCheckpoint } = load('src/domain/examSearch/requiredCheckpoint.ts');
  const input = searchInput(); input.additionalLevelCap = 10;
  const candidate = amount => ({ id: `extra-${amount}`, cards: names.slice(0, 5)
    .map(name => cardVariants(rosterCard(name), 'SSR', false, 0, amount)[0]) });
  const valid = { candidate: candidate(0) }, invalid = { candidate: candidate(10) }, fine = { candidate: candidate(2) };
  const saved = { ...checkpoint(), pool: [valid, invalid, fine], pending: [invalid, fine], finalists: [valid, invalid, fine] };
  const cleaned = constrainCheckpoint(input, saved, catalog);
  assert.deepEqual(clone(cleaned.pool), [clone(valid)]);
  assert.deepEqual(clone(cleaned.finalists), [clone(valid)]);
  assert.deepEqual(clone(cleaned.pending), []);
});
