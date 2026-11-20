const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const { buildSync } = require('esbuild');
const vue = require('vue');
const { createI18n } = require('vue-i18n');
const { createPinia, setActivePinia } = require('pinia');

const root = path.resolve(__dirname, '../..');
const bundled = buildSync({
  stdin: { contents: `
    export * from './src/components/common';
    export * from './src/domain/deckSearch/roster';
    export * from './src/store/searchSetting';
    export * from './src/store/characters';
    export * from './src/constants/searchPresets';
  `, resolveDir: root },
  bundle: true, write: false, platform: 'node', format: 'cjs', packages: 'external',
}).outputFiles[0].text;
const runtime = { exports: {} };
vm.runInNewContext(bundled, { module: runtime, exports: runtime.exports, require, console, setTimeout, clearTimeout });
const api = runtime.exports;
const messages = Object.fromEntries(['ja', 'en', 'zh-CN'].map(locale =>
  [locale, require(path.join(root, 'src/i18n', `${locale}.json`))]));

// Run the actual settings component setup, with only DOM lifecycle/image loading stubbed.
const source = fs.readFileSync(path.join(root, 'src/components/DeckSearchSettings.vue'), 'utf8');
const script = source.match(/<script setup lang="ts">([\s\S]*?)<\/script>/)[1];
const code = ts.transpileModule(script + `
  globalThis.modal = { sortOptions, minimumSettings, availableSortProps,
    sortOrderItems, getAvailableMinimumProps, applyPreset };
`, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2021, esModuleInterop: true } }).outputText;

function openSettings(i18n) {
  const scope = vue.effectScope();
  const context = {
    exports: {}, console,
    require(id) {
      if (id === 'vue') return { ...vue, onMounted: () => {} };
      if (id === 'vue-i18n') return { useI18n: () => i18n.global };
      if (['@/store/searchSetting', '@/components/common', '@/constants/searchPresets'].includes(id)) return api;
      if (id === '@/utils/characterAssets') return { loadImageUrls: async () => ({}) };
      if (id.startsWith('@/')) return require(path.join(root, 'src', id.slice(2)));
      return require(id);
    },
  };
  scope.run(() => {
    vm.runInNewContext(code, context);
  });
  return { ...context.modal, stop: () => scope.stop() };
}

async function search(settings, t) {
  // Six distinct characters produce multiple decks, so ordering can be compared too.
  const seen = new Set();
  const characters = api.useCharacterStore().characters.filter(card => {
    if (seen.has(card.chara) || seen.size >= 6) return false;
    seen.add(card.chara);
    return true;
  }).map(card => ({ ...card, level: 120 }));
  const errors = [];
  let results = [];
  await api.calcDecks(t, {
    characters, settings,
    controls: {
      isSearching: () => true, setTotalResults() {}, setNowResults() {},
      setResults: value => { results = value; }, setErrorMessage: value => errors.push(value),
    },
  });
  assert.deepEqual(errors, []);
  assert.ok(results.length > 0, 'search should produce decks');
  return JSON.parse(JSON.stringify(results));
}

test('saved custom settings retain search results and sort direction across all languages', async () => {
  setActivePinia(createPinia());
  const settings = api.useSearchSettingsStore();
  const i18n = createI18n({ legacy: false, locale: 'ja', messages });
  const resultsByOrder = new Map();
  for (const order of ['settingModal.asc', 'settingModal.desc']) {
    for (const from of Object.keys(messages)) {
      i18n.global.locale.value = from;
      const modal = openSettings(i18n);
      modal.sortOptions.value = [{ prop: 'comments.HP', order }, { prop: 'comments.duo', order }];
      modal.minimumSettings.value = [{ prop: 'minHP', value: 100 }];
      await vue.nextTick();
      modal.stop();
      const baseline = await search(settings, i18n.global.t);
      resultsByOrder.set(order, baseline);
      for (const to of Object.keys(messages)) {
        i18n.global.locale.value = to;
        assert.deepEqual(await search(settings, i18n.global.t), baseline, `${from} -> ${to}: ${order}`);
        const reopened = openSettings(i18n);
        assert.equal(reopened.availableSortProps.value.find(item => item.value === 'comments.HP').title,
          messages[to].comments.HP);
        await vue.nextTick();
        reopened.stop();
        assert.equal(settings.sortOptions[0].prop, 'comments.HP');
        assert.equal(settings.sortOptions[0].order, order);
        assert.equal(settings.minHP, 100);
      }
    }
  }
  assert.notDeepEqual(resultsByOrder.get('settingModal.asc'), resultsByOrder.get('settingModal.desc'));
});

test('preset and inline minimum settings survive a language change', async () => {
  setActivePinia(createPinia());
  const settings = api.useSearchSettingsStore();
  const i18n = createI18n({ legacy: false, locale: 'ja', messages });
  const modal = openSettings(i18n);
  const preset = api.SEARCH_PRESET_CONFIGURATIONS[0];
  modal.applyPreset(preset);
  modal.minimumSettings.value = [{ prop: 'minHP', value: 12345 }, { prop: 'minDuo', value: 3 }];
  i18n.global.locale.value = 'zh-CN';
  assert.equal(modal.sortOrderItems.value[1].title, messages['zh-CN'].settingModal.desc);
  assert.ok(!modal.getAvailableMinimumProps(0).some(item => item.value === 'minDuo'));
  await vue.nextTick();
  assert.deepEqual(JSON.parse(JSON.stringify(settings.sortOptions)), JSON.parse(JSON.stringify(preset.sortOptions)));
  assert.equal(settings.minHP, 12345);
  assert.equal(settings.minDuo, 3);
  modal.stop();
});

test('default settings are valid without editing the settings', async () => {
  setActivePinia(createPinia());
  const i18n = createI18n({ legacy: false, locale: 'zh-CN', messages });
  await search(api.useSearchSettingsStore(), i18n.global.t);
});

test('empty sort settings still show the missing-settings warning', async () => {
  setActivePinia(createPinia());
  const settings = api.useSearchSettingsStore();
  settings.sortOptions = [];
  const i18n = createI18n({ legacy: false, locale: 'ja', messages });
  await assert.rejects(search(settings, i18n.global.t), /検索設定を指定してください/);
});

test('deck search applies the active collection and trains support independently', async () => {
  setActivePinia(createPinia());
  const catalog = api.useCharacterStore().characters.filter(card => card.rare === 'SSR').slice(0, 6);
  const collection = Object.fromEntries(catalog.map((card, i) => [card.name, {
    isOwned: i !== 5, level: i === 4 ? 0 : 70 + i, totsu: i,
  }]));
  const settings = api.useSearchSettingsStore();
  settings.selectedSupportCharacters = [catalog[5].name];
  settings.allowSameCharacter = true;
  settings.minHP = settings.minEHP = 0;
  for (const [source, count] of [['owned', 4], ['ownedMax', 4], ['allMax', 6]]) {
    settings.rosterSource = source;
    const roster = api.buildDeckSearchRoster(catalog, collection, settings);
    assert.equal(roster.characters.length, count);
    assert.equal(roster.characters[0].level, source === 'owned' ? 70 : 120);
    assert.equal(roster.characters[0].totsu, source === 'owned' ? 0 : 4);
    assert.equal(roster.characters[0].hasM3, source !== 'owned');
    assert.equal(roster.characters[3].hasM3, true);
    const [support] = roster.supportCharacters;
    assert.equal(support.name, catalog[5].name);
    assert.equal(support.totsu, 4);
    assert.equal(support.hasM3, true);

    let decks = [];
    await api.calcDecks(key => key, {
      ...roster, settings, controls: {
        isSearching: () => true, setTotalResults() {}, setNowResults() {},
        setResults: value => { decks = value; }, setErrorMessage: assert.fail,
      },
    });
    assert.ok(decks.length > 0);
    const first = new URLSearchParams(decks[0].simuURL.slice(1));
    assert.equal(first.get('name5'), support.name);
    assert.equal(first.get('level5'), '120');
    assert.equal(first.get('totsu5'), '4');
    for (let i = 1; i <= 4; i++) {
      const member = roster.characters.find(card => card.name === first.get('name' + i));
      assert.equal(first.get('level' + i), String(member.level));
      assert.equal(first.get('totsu' + i), String(member.totsu));
    }
  }
  assert.equal(collection[catalog[0].name].level, 70);
});

test('required cards and required characters both constrain every deck, including fully fixed decks', async () => {
  setActivePinia(createPinia());
  const byCharacter = new Map();
  for (const card of api.useCharacterStore().characters) {
    if (card.rare === 'SSR' && !byCharacter.has(card.chara)) byCharacter.set(card.chara, card);
  }
  const catalog = [...byCharacter.values()].slice(0, 8);
  const settings = api.useSearchSettingsStore();
  Object.assign(settings, { rosterSource: 'allMax', minHP: 0, minEHP: 0, maxResult: 100 });
  async function run(required, must, support = false) {
    settings.requiredCards = required.map(card => card.name);
    settings.convertedMustCharacters = must.map(card => card.chara);
    settings.allowSameCharacter = support;
    settings.selectedSupportCharacters = [catalog[7].name];
    let decks = [], error = '';
    await api.calcDecks(key => key, {
      ...api.buildDeckSearchRoster(catalog, {}, settings), settings, controls: {
        isSearching: () => true, setTotalResults() {}, setNowResults() {},
        setResults: value => { decks = value; }, setErrorMessage: value => { error = value; },
      },
    });
    return { error, decks: decks.map(deck => {
      const query = new URLSearchParams(deck.simuURL.slice(1));
      return Array.from({ length: 5 }, (_, i) => query.get('name' + (i + 1)));
    }) };
  }
  for (const [count, support] of [[1, false], [5, false], [4, true]]) {
    const required = catalog.slice(0, count);
    const must = support ? catalog[7] : catalog[4];
    const { decks, error } = await run(required, [must], support);
    assert.equal(error, '');
    assert.ok(decks.length > 0);
    for (const names of decks) {
      for (const card of required) assert.ok(names.slice(0, support ? 4 : 5).includes(card.name));
      assert.ok(names.includes(must.name));
    }
    if (count >= 4) assert.equal(decks.length, 1);
  }
  assert.equal((await run(catalog.slice(0, 5), [catalog[6]])).decks.length, 0);
  assert.equal((await run(catalog.slice(0, 5), [], true)).error, 'error.requiredCardLimit');
});
