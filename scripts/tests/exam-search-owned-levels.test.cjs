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
    setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key) };
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
      respond(data) { this.onmessage({ data: { id: this.messages.at(-1).id, ...data } }); }
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
  scope.run(() => vm.runInNewContext(compile(source + '\nglobalThis.view = { input, hand, rosterReady, canResume, progress, evaluatedInput, busy, error, continuousSearch, start, resume, requestStopAndSave };'), viewContext));
  return { view: viewContext.view, load, workers, timers, persistence,
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

for (const betweenBatches of [false, true]) {
  test(`changing a card to Lv0 ${betweenBatches ? 'between continuous batches' : 'during a search'} clears results and prevents old-roster continuation`, async t => {
    const { view, workers, timers, flushTimers } = runtime(t, names.slice(0, 5).map(name => handCard(name)));
    view.continuousSearch.value = true;
    view.start(1000);
    const worker = workers[0];
    worker.respond({ progress: { phase: betweenBatches ? 'done' : 'generate', results: [], tasksDone: 1 } });
    if (betweenBatches) {
      worker.respond({ checkpoint: checkpoint(), catalogVersion: 'test' });
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
    worker.respond({ progress: { phase: 'done', results: [], tasksDone: 2 } });
    assert.equal(view.progress.value, null, 'late worker responses cannot restore stale results');
  });
}

test('changing an excluded card leaves a valid continuous search running', async t => {
  const { view, workers, flushTimers } = runtime(t, [...names.slice(0, 5).map(name => handCard(name)), handCard(names[5], 0)]);
  view.continuousSearch.value = true;
  view.start(1000);
  const worker = workers[0];
  worker.respond({ progress: { phase: 'done', results: [], tasksDone: 1 }, checkpoint: checkpoint(), catalogVersion: 'test' });
  view.hand.updateHandCard(names[5], { totsu: 4 });
  await vue.nextTick();
  assert.equal(worker.terminated, false);
  assert.equal(view.busy.value, true);
  flushTimers();
  assert.equal(worker.messages.at(-1).method, 'resume');
  assert.ok(worker.messages.at(-1).input.roster.every(card => card.name !== names[5]));
});
