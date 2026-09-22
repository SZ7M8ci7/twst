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
const source = fs.readFileSync(path.join(root, 'src/components/SettingModal.vue'), 'utf8');
const script = source.match(/<script setup lang="ts">([\s\S]*?)<\/script>/)[1];
const code = ts.transpileModule(script + `
  globalThis.modal = { sortOptions, minimumSettings, availableSortProps,
    sortOrderItems, getAvailableMinimumProps, applyFilter, applyPreset, cancel };
`, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2021, esModuleInterop: true } }).outputText;

function openSettings(i18n) {
  const beforeMount = [];
  const scope = vue.effectScope();
  const context = {
    exports: {}, console, defineEmits: () => () => {},
    require(id) {
      if (id === 'vue') return { ...vue, onBeforeMount: fn => beforeMount.push(fn), onMounted: () => {} };
      if (id === 'vue-i18n') return { useI18n: () => i18n.global };
      if (['@/store/searchSetting', '@/components/common', '@/constants/searchPresets'].includes(id)) return api;
      if (id === '@/utils/characterAssets') return { loadImageUrls: async () => ({}) };
      if (id.startsWith('@/')) return require(path.join(root, 'src', id.slice(2)));
      return require(id);
    },
  };
  scope.run(() => {
    vm.runInNewContext(code, context);
    beforeMount.forEach(fn => fn());
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
      modal.applyFilter();
      modal.stop();
      const baseline = await search(settings, i18n.global.t);
      resultsByOrder.set(order, baseline);
      for (const to of Object.keys(messages)) {
        i18n.global.locale.value = to;
        assert.deepEqual(await search(settings, i18n.global.t), baseline, `${from} -> ${to}: ${order}`);
        const reopened = openSettings(i18n);
        assert.equal(reopened.availableSortProps.value.find(item => item.value === 'comments.HP').title,
          messages[to].comments.HP);
        reopened.applyFilter();
        reopened.stop();
        assert.equal(settings.sortOptions[0].prop, 'comments.HP');
        assert.equal(settings.sortOptions[0].order, order);
        assert.equal(settings.minHP, 100);
      }
    }
  }
  assert.notDeepEqual(resultsByOrder.get('settingModal.asc'), resultsByOrder.get('settingModal.desc'));
});

test('preset and unsaved minimum settings survive a language change while the dialog is open', () => {
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
  modal.applyFilter();
  assert.deepEqual(JSON.parse(JSON.stringify(settings.sortOptions)), JSON.parse(JSON.stringify(preset.sortOptions)));
  assert.equal(settings.minHP, 12345);
  assert.equal(settings.minDuo, 3);
  modal.stop();
});

test('default settings are valid without first opening the dialog', async () => {
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
