const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const { createPinia, setActivePinia } = require('pinia');
const cards = require('../../src/assets/chara.json');
const catalog = Object.fromEntries(cards.map(card => [card.name, card]));
const root = path.resolve(__dirname, '../..');
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');
const compile = source => ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2021, esModuleInterop: true },
}).outputText;

function runtime() {
  const values = new Map(), cache = new Map();
  const storage = { getItem: key => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key) };
  const window = { localStorage: storage, sessionStorage: storage, addEventListener() {}, removeEventListener() {} };
  function load(relative) {
    if (relative.endsWith('.json')) return JSON.parse(read(relative));
    if (cache.has(relative)) return cache.get(relative);
    const module = { exports: {} };
    const localRequire = id => id.startsWith('@/')
      ? load(`src/${id.slice(2)}${id.endsWith('.json') ? '' : '.ts'}`) : require(id);
    vm.runInNewContext(compile(read(relative)), { module, exports: module.exports, require: localRequire, window, console });
    cache.set(relative, module.exports);
    return module.exports;
  }
  setActivePinia(createPinia());
  return { load, storage };
}

test('JSON and both TSV imports flag out-of-range cards without changing saved settings', async () => {
  const { load, storage } = runtime();
  const handCollectionStore = load('src/store/handCollection.ts').useHandCollectionStore();
  const { parseHandCollectionImport } = load('src/utils/handCollectionImport.ts');
  const view = read('src/views/HandCollection.vue');
  const source = view.slice(view.indexOf('async function importFromText()'), view.indexOf('async function submitAssignedImport()'));
  const dataText = { value: '' }, notices = [];
  const context = { handCollectionStore, parseHandCollectionImport, dataText, importIssues: { value: [] },
    importRows: { value: [] }, importStageRevision: { value: 0 }, saving: { value: false }, importSubmitting: { value: false },
    parseHandCollectionSetsBackup: load('src/storage/handCollectionStorage.ts').parseHandCollectionSetsBackup,
    characters: { value: cards }, showSnackbar: key => notices.push(key), t: key => key, console };
  vm.createContext(context);
  vm.runInContext(compile(source), context);
  for (const [rare, max] of [['SSR', 120], ['SR', 90], ['R', 70]]) {
    const card = cards.find(card => card.rare === rare);
    handCollectionStore.updateHandCard(card.name, { level: 42, totsu: 1, isOwned: false });
    const before = JSON.stringify(handCollectionStore.getHandCard(card.name));
    for (const value of [
      JSON.stringify({ cards: [{ cardName: card.name, level: 999, isOwned: true }] }),
      JSON.stringify({ cards: { [card.name]: { level: 999, isOwned: true } } }),
      [card.chara, card.costume, '999', 'unused', 'true'].join('\t'),
      [card.chara, card.costume, '999', 'unused', 'true', 'true', 'true'].join('\t'),
    ]) {
      dataText.value = value;
      const beforeRaw = storage.getItem('twst-hand-collection');
      await context.importFromText();
      assert.equal(context.importIssues.value[0].cardName, card.name);
      assert.equal(context.importIssues.value[0].value, '999');
      assert.equal(context.importIssues.value[0].max, max);
      assert.equal(context.importRows.value.length, 0, 'invalid input cannot reach assignment or overwrite confirmation');
      assert.equal(storage.getItem('twst-hand-collection'), beforeRaw);
      assert.equal(dataText.value, value, 'original input stays available for correction');
      assert.equal(JSON.stringify(handCollectionStore.getHandCard(card.name)), before);
      await handCollectionStore.saveHandCollectionManually({ overwriteConfirmed: true });
      const saved = JSON.parse(storage.getItem('twst-hand-collection'));
      assert.equal(saved.sets.find(set => set.id === saved.activeSetId).data[card.name].level, 42);
    }
    dataText.value = JSON.stringify({ cards: [{ cardName: card.name, level: max, totsu: 4, isOwned: true }] });
    await context.importFromText();
    assert.equal(context.importIssues.value.length, 0);
    assert.equal(handCollectionStore.getHandCard(card.name).level, 42, 'valid input only stages until destination confirmation');
    assert.equal(context.importRows.value[0].data[card.name].level, max);
    assert.equal(context.importRows.value[0].destination, null);
    assert.equal(context.importStageRevision.value, handCollectionStore.collectionContextRevision);
  }
});

test('imports preserve valid entries and report exact invalid levels and limit breaks', () => {
  const { load } = runtime();
  const { parseHandCollectionImport } = load('src/utils/handCollectionImport.ts');
  const [first, second] = cards.filter(card => card.rare === 'SR');
  for (const value of [91, 50.9, -1, 'Infinity', 'NaN', '50abc', '', null, true]) {
    const result = parseHandCollectionImport(JSON.stringify({ cards: [
      { cardName: first.name, level: value }, { cardName: second.name, level: 42, totsu: 3 },
    ] }), cards);
    assert.equal(result.updates.length, 1);
    assert.equal(result.updates[0].cardName, second.name);
    assert.equal(result.issues[0].field, 'level');
    assert.equal(result.issues[0].value, String(value));
  }
  for (const value of [5, -1, 1.5, 'bad']) {
    const result = parseHandCollectionImport(JSON.stringify({ cards: [{ cardName: first.name, level: 42, totsu: value }] }), cards);
    assert.equal(result.updates.length, 0);
    assert.equal(result.issues[0].field, 'totsu');
    assert.equal(result.issues[0].value, String(value));
  }
  for (const level of [0, 42, 90, '42']) {
    const result = parseHandCollectionImport(JSON.stringify({ cards: [{ cardName: first.name, level }] }), cards);
    assert.equal(result.issues.length, 0);
    assert.equal(result.updates[0].values.level, Number(level));
  }
  const duplicate = parseHandCollectionImport(JSON.stringify({ cards: [
    { cardName: first.name, level: 91 }, { cardName: first.name, level: 42 },
  ] }), cards);
  assert.equal(duplicate.updates.length, 0);
  for (const level of ['50.5', '50abc', '-1']) {
    const result = parseHandCollectionImport([first.chara, first.costume, level, '', 'false'].join('\t'), cards);
    assert.equal(result.updates.length, 0);
    assert.equal(result.issues[0].value, level);
  }
});

test('legacy JSON versions and numeric strings stay supported without coercing malformed ownership', () => {
  const {load}=runtime(), parse=load('src/utils/handCollectionImport.ts').parseHandCollectionImport;
  const card=cards.find(c=>c.rare==='SSR');
  for(const version of [undefined,1,2,3]) {
    const value={cards:{[card.name]:{level:'42',totsu:'3',isOwned:false}}};
    if(version!==undefined)value.format='twst-hand-collection-v'+version;
    const result=parse(JSON.stringify(value),cards); assert.equal(result.issues.length,0); assert.equal(result.updates[0].values.level,42);
    assert.equal(result.updates[0].values.totsu,3); assert.equal(result.updates[0].values.isOwned,false);
  }
  for(const field of ['isOwned','isM3','isLimitBreak'])for(const value of ['false',0,null,{},[]]) {
    assert.throws(()=>parse(JSON.stringify({cards:{[card.name]:{level:42,[field]:value}}}),cards),/ownership/);
  }
  for(const format of ['twst-hand-collection-v999','other-format',null,3]) {
    assert.throws(()=>parse(JSON.stringify({format,cards:{[card.name]:{level:42}}}),cards),/format/);
  }
  for(const json of ['null','[]','{bad','{"cards":3}','{"cards":[null]}'])assert.throws(()=>parse(json,cards));
  for(const legacy of [{version:1,data:{[card.name]:{level:42,isOwned:true,isM3:true}}},{[card.name]:{level:42,isOwned:true,isLimitBreak:true}}]) {
    const result=parse(JSON.stringify(legacy),cards); assert.equal(result.issues.length,0);
    assert.equal(result.updates[0].values.totsu,legacy.version===1?3:4);
  }
});

test('invalid ownership or unknown format cannot stage valid sibling cards or change existing settings', async () => {
  const {load,storage}=runtime(), store=load('src/store/handCollection.ts').useHandCollectionStore(), parse=load('src/utils/handCollectionImport.ts').parseHandCollectionImport;
  const [first,second]=cards.filter(c=>c.rare==='SSR');store.updateHandCard(first.name,{level:20,isOwned:true});await store.saveSlot(1,'Before',{overwriteConfirmed:true});
  const raw=storage.getItem('twst-hand-collection'),before=JSON.stringify(store.handCollection);
  for(const value of [{cards:[{cardName:first.name,level:30,isOwned:'false'},{cardName:second.name,level:40,isOwned:true}]},
    {format:'unsupported',cards:[{cardName:first.name,level:30,isOwned:true}]}]) {
    assert.throws(()=>parse(JSON.stringify(value),cards));assert.equal(storage.getItem('twst-hand-collection'),raw);assert.equal(JSON.stringify(store.handCollection),before);
  }
});

test('screenshot review includes invalid levels and blocks applying them without changing the values', () => {
  const { load } = runtime();
  const { computed, ref } = require('vue');
  const { isValidInputLevel } = load('src/constants/levels.ts');
  const { getImportLevel } = load('src/domain/handScreenshot/importLevel.ts');
  const source = read('src/components/HandScreenshotImport.vue');
  const reviewFunction = source.match(/function needsReview\([^\n]+/)[0];
  const keysSource = source.slice(source.indexOf('const invalidLevelCardKeys ='), source.indexOf('const primaryFileOrder ='));
  const applySource = source.slice(source.indexOf('function apply()'), source.indexOf('function undo()'));
  const card = cards.find(card => card.rare === 'SR');
  const primaryRows = ref([{ selected: card.name, maxLevel: 91, level: 42, totsu: 1 }]);
  const levelMode = ref('maximum');
  const context = { computed, primaryRows, levelMode, isValidInputLevel, getImportLevel,
    groovyStatusByCard: { value: new Map([[card.name, 'present']]) },
    catalog: new Map(cards.map(card => [card.name, card])), busy: { value: false },
    resultContextRevision: 0,
    store: { collectionContextRevision: 0, batchUpdates() { assert.fail('Invalid cards must not be applied'); } },
    displayLevel: row => getImportLevel(row, levelMode.value), displayTotsu: row => row.totsu, hasDuplicateConflict: () => false };
  vm.createContext(context);
  vm.runInContext(compile(keysSource + reviewFunction + '\n' + applySource), context);
  for (const level of [91, 50.5, -1, 0, NaN, Infinity]) {
    primaryRows.value[0].maxLevel = level;
    assert.equal(context.needsReview(primaryRows.value[0]), true);
    context.apply();
    assert.equal(primaryRows.value[0].maxLevel, level);
  }
  primaryRows.value[0].maxLevel = 90;
  assert.equal(context.needsReview(primaryRows.value[0]), false);
  primaryRows.value[0].maxLevel = 91;
  levelMode.value = 'current';
  assert.equal(context.needsReview(primaryRows.value[0]), false, 'review follows the selected import mode');
});

function fixture() {
  return { preset: { title: '通常試験', enemyHp: 100000, difficulty: 1.5 },
    roster: cards.filter(card => card.rare === 'SSR').slice(0, 5).map(card => ({
      name: card.name, level: 120, totsu: 4, magicLevels: [10, 10, 10], buddyLevels: [10, 10, 10],
    })), supports: [], budget: 0, itemsPerLimitBreak: 1, target: 0, attempts: 30,
    tolerance: 0, desiredProbability: .05, challengeLocks: {}, maxRemoved: 1 };
}

test('search identifies all invalid owned and support cards including malformed skills', () => {
  const { load } = runtime();
  const { validateInput, invalidSearchCards } = load('src/domain/examSearch/variants.ts');
  const input = fixture();
  assert.equal(validateInput(input, catalog), null);
  for (const change of [{ level: 121 }, { level: 50.5 }, { totsu: 5 }, { magicLevels: [0, 10, 10] },
    { buddyLevels: [10, 11, 10] }, { magicLevels: null }, { buddyLevels: [10, 10] }, { name: 'unknown-card' }]) {
    const modified = fixture();
    Object.assign(modified.roster[0], change);
    assert.equal(validateInput(modified, catalog), 'card');
    assert.equal(invalidSearchCards(modified, catalog)[0].name, modified.roster[0].name);
  }
  input.roster[1].level = 121;
  input.supports = [{ ...input.roster[2], totsu: -1 }];
  assert.deepEqual(Array.from(invalidSearchCards(input, catalog), card => card.name), [input.roster[1].name, input.roster[2].name]);
});

test('search start displays invalid card names with costumes in every locale and does not launch a worker', () => {
  const { load, storage } = runtime();
  const input = fixture();
  // Previously saved invalid data remains detectable until the user edits it.
  storage.setItem('twst-hand-collection', JSON.stringify({ [input.roster[0].name]: { level: 121, isOwned: true } }));
  const store = load('src/store/handCollection.ts').useHandCollectionStore();
  input.roster[0].level = store.getHandCard(input.roster[0].name).level;
  input.roster[1].buddyLevels = [0, 10, 10];
  const { validateInput, invalidSearchCards } = load('src/domain/examSearch/variants.ts');
  const source = read('src/views/examSearch.vue').split('function start(durationMs: number)')[1].split('function resume()')[0];
  for (const locale of ['ja', 'en', 'zh-CN']) {
    const message = JSON.parse(read(`src/i18n/${locale}.json`)).examSearch.validation.card;
    const error = { value: '' };
    const cardLabel = name => `${catalog[name].chara} / ${catalog[name].costume}`;
    const context = { input: { value: input }, error, catalog, validateInput, invalidSearchCards, cardLabel,
      usesSupport: { value: false }, getWorker() { assert.fail('Invalid cards must not start a worker'); },
      additionalBreaksError: { value: '' }, attemptsError: { value: '' }, loadSearchSeedTeams: () => [], savedTeams: [],
      t: (key, args) => { assert.equal(key, 'examSearch.validation.card'); return message.replace('{cards}', args.cards); } };
    vm.createContext(context);
    vm.runInContext(compile(`function start(durationMs: number)${source}`), context);
    context.start(180000);
    for (const card of input.roster.slice(0, 2)) assert.ok(error.value.includes(cardLabel(card.name)));
    assert.ok(!error.value.includes('{cards}'));
  }
});
