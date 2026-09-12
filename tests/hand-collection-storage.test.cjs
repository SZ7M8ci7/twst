const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const { test } = require('node:test');
const ts = require('typescript');
const vue = require('vue');
const pinia = require('pinia');
const root = path.resolve(__dirname, '..');
const KEY = 'twst-hand-collection';
const DRAFT = `${KEY}-draft-v1`;
const card = { cardName: 'sample', isOwned: true, level: 80, totsu: 1 };
const envelope = data => JSON.stringify({ version: 1, data });
function storage(raw) {
  const values = new Map(raw === undefined ? [] : [[KEY, raw]]);
  return {
    values, readError: false, writeError: false,
    getItem(key) {
      if (this.readError) throw new DOMException('blocked', 'SecurityError');
      return values.get(key) ?? null;
    },
    setItem(key, value) {
      if (this.writeError) throw new DOMException('full', 'QuotaExceededError');
      values.set(key, value);
    },
    removeItem(key) { if (this.writeError) throw new Error('blocked'); values.delete(key); },
  };
}
function tab(disk = storage(envelope({ sample: card })), session = storage(), locks) {
  const cache = new Map(), warnings = [], listeners = new Map();
  const window = {
    localStorage: disk, sessionStorage: session, innerWidth: 390, confirm: () => true,
    addEventListener: (name, fn) => listeners.set(name, fn),
    removeEventListener: name => listeners.delete(name),
  };
  const navigator = { locks, storage: { persisted: async () => false, persist: async () => false } };
  function evaluate(source, filename, overrides = {}) {
    const module = { exports: {} };
    const code = ts.transpileModule(source, { compilerOptions: {
      module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2021, esModuleInterop: true,
    } }).outputText;
    vm.runInNewContext(code, {
      module, exports: module.exports, window, navigator, setTimeout, clearTimeout,
      console: { warn: (...args) => warnings.push(args), error: (...args) => warnings.push(args) },
      require: id => Object.hasOwn(overrides, id) ? overrides[id] : load(id),
    }, { filename });
    return module.exports;
  }
  function load(id) {
    if (!id.startsWith('@/')) return require(id);
    if (!cache.has(id)) {
      const filename = path.join(root, 'src', id.slice(2) + '.ts');
      cache.set(id, evaluate(fs.readFileSync(filename, 'utf8'), filename));
    }
    return cache.get(id);
  }
  const store = load('@/store/handCollection').useHandCollectionStore(pinia.createPinia());
  async function page() {
    const mounted = [];
    const filename = path.join(root, 'src/views/HandCollection.vue');
    const source = fs.readFileSync(filename, 'utf8').match(/<script setup lang="ts">([\s\S]*?)<\/script>/)[1];
    const characters = vue.ref([{ name: 'sample', rare: 'SSR', visible: true, imgUrl: 'stub' }]);
    const exports = evaluate(source + '\nexport { updateOwnership, saveHandCollection, hasUnsavedChanges, resetUnsavedChanges, reloadSavedCollection, snackbar };', filename, {
      vue: { ...vue, onMounted: fn => mounted.push(fn), onUnmounted() {} },
      pinia: { ...pinia, storeToRefs: target => target === store ? pinia.storeToRefs(store) : { characters } },
      '@/store/handCollection': { useHandCollectionStore: () => store },
      '@/store/characters': { useCharacterStore: () => ({}) },
      '@/store/filterd': { useFilterdStore: () => ({}) },
      '@/assets/img/default.webp': 'stub',
      '@/utils/characterAssets': { hydrateCharacterImageUrls: async () => {} },
      '@/components/FilterModal.vue': {}, '@/components/LazyCharacterImage.vue': {},
      '@/assets/characters_info.json': [],
      'vue-i18n': { useI18n: () => ({ t: key => key, locale: vue.ref('ja') }) },
      '@/utils/localizedDisplay': { localizeCostumeName: () => '' },
    });
    for (const mount of mounted) await mount();
    return exports;
  }
  return { store, page, warnings, window, disk, session, event: (name, event) => listeners.get(name)?.(event) };
}

test('save failure stays unsaved, shows error, and undo retains the committed baseline', async () => {
  const current = tab(), page = await current.page();
  current.disk.writeError = true;
  page.updateOwnership('sample', false);
  await page.saveHandCollection();
  assert.equal(page.snackbar.value.text, 'handCollection.saveError');
  assert.equal(page.snackbar.value.color, 'error');
  assert.equal(page.hasUnsavedChanges.value, true);
  assert.equal(tab(current.disk).store.isCharacterOwned('sample'), true);
  page.resetUnsavedChanges();
  assert.equal(current.store.isCharacterOwned('sample'), true);
  assert.equal(page.hasUnsavedChanges.value, false);
});

test('successful retry commits edits and clears the draft', async () => {
  const current = tab(), page = await current.page();
  current.disk.writeError = true;
  page.updateOwnership('sample', false);
  await page.saveHandCollection();
  current.disk.writeError = false;
  await page.saveHandCollection();
  assert.equal(page.snackbar.value.text, 'handCollection.saveSuccess');
  assert.equal(current.store.hasUnsavedChanges, false);
  assert.equal(current.session.getItem(DRAFT), null);
  assert.equal(tab(current.disk).store.isCharacterOwned('sample'), false);
});

test('dirty state survives page remount and a same-tab draft survives reload', async () => {
  const current = tab(), page = await current.page();
  page.updateOwnership('sample', false);
  const remounted = await current.page();
  assert.equal(remounted.hasUnsavedChanges.value, true);
  const reloaded = tab(current.disk, current.session);
  assert.equal(reloaded.store.isCharacterOwned('sample'), false);
  assert.equal(reloaded.store.hasUnsavedChanges, true);
  assert.equal(tab(current.disk).store.isCharacterOwned('sample'), true);
  reloaded.store.resetUnsavedChanges();
  assert.equal(reloaded.store.isCharacterOwned('sample'), true);
  assert.equal(current.session.getItem(DRAFT), null);
});

test('stale tab cannot erase newer cards even if it has no local changes', async () => {
  const old = tab(), newer = tab(old.disk);
  newer.store.updateHandCard('new-card', { isOwned: true, level: 90 });
  await newer.store.saveHandCollectionManually();
  await assert.rejects(old.store.saveHandCollectionManually(), /conflict/);
  assert.equal(old.store.hasConflict, true);
  assert.equal(tab(old.disk).store.isCharacterOwned('new-card'), true);
});

test('storage events refresh clean tabs and protect dirty tabs', async () => {
  const clean = tab(), dirty = tab(clean.disk), newer = tab(clean.disk);
  dirty.store.updateHandCard('sample', { level: 81 });
  newer.store.updateHandCard('new-card', { isOwned: true });
  await newer.store.saveHandCollectionManually();
  clean.event('storage', { key: KEY }); dirty.event('storage', { key: KEY });
  assert.equal(clean.store.isCharacterOwned('new-card'), true);
  assert.equal(clean.store.hasUnsavedChanges, false);
  assert.equal(dirty.store.peekHandCard('sample').level, 81);
  assert.equal(dirty.store.hasConflict, true);
  await assert.rejects(dirty.store.saveHandCollectionManually(), /conflict/);
  const reloaded = tab(clean.disk, dirty.session);
  assert.equal(reloaded.store.hasConflict, true);
  reloaded.store.updateHandCard('sample', { level: 82 });
  assert.equal(tab(clean.disk, dirty.session).store.hasConflict, true);
});

test('transient read failure cannot overwrite existing data and explicit recovery works', async () => {
  const disk = storage(envelope({ sample: card })), original = disk.getItem(KEY);
  disk.readError = true;
  const current = tab(disk);
  disk.readError = false;
  assert.equal(current.store.loadFailed, true);
  await assert.rejects(current.store.saveHandCollectionManually(), /unavailable/);
  assert.equal(disk.getItem(KEY), original);
  assert.equal(current.store.reloadHandCollection(), true);
  assert.equal(current.store.loadFailed, false);
  assert.equal(current.store.isCharacterOwned('sample'), true);
});

for (const raw of ['{invalid', 'null', '[]', '{"sample":42}', '{"version":2,"data":{}}', '{"version":1}']) {
  test(`invalid or unsupported stored data stays intact: ${raw}`, async () => {
    const current = tab(storage(raw));
    assert.equal(current.store.loadFailed, true);
    await assert.rejects(current.store.saveHandCollectionManually());
    assert.equal(current.disk.getItem(KEY), raw);
  });
}

test('missing, legacy and current data load; read-only lookups do not create drafts', () => {
  for (const disk of [storage(), storage(JSON.stringify({ sample: card })), storage(envelope({ sample: card }))]) {
    const current = tab(disk);
    assert.equal(current.store.loadFailed, false);
    current.store.getHandCard('unknown');
    assert.equal(current.store.hasUnsavedChanges, false);
    assert.equal(current.store.peekHandCard('unknown'), undefined);
    assert.equal(current.session.getItem(DRAFT), null);
  }
});

test('draft failure is visible but does not prevent committing to localStorage', async () => {
  const current = tab(); current.session.writeError = true;
  current.store.updateHandCard('sample', { level: 82 });
  assert.equal(current.store.draftFailed, true);
  await current.store.saveHandCollectionManually();
  assert.equal(current.store.hasUnsavedChanges, false);
  assert.equal(tab(current.disk).store.peekHandCard('sample').level, 82);
});

test('canceling conflict recovery leaves edits intact; confirmed recovery uses latest saved data', async () => {
  const current = tab(), page = await current.page(), newer = tab(current.disk);
  page.updateOwnership('sample', false);
  newer.store.updateHandCard('new-card', { isOwned: true });
  await newer.store.saveHandCollectionManually();
  current.event('storage', { key: KEY });
  current.window.confirm = () => false;
  page.reloadSavedCollection();
  assert.equal(current.store.hasConflict, true);
  assert.equal(current.store.isCharacterOwned('sample'), false);
  current.window.confirm = () => true;
  page.reloadSavedCollection();
  assert.equal(current.store.hasConflict, false);
  assert.equal(current.store.hasUnsavedChanges, false);
  assert.equal(current.store.isCharacterOwned('new-card'), true);
  assert.equal(current.session.getItem(DRAFT), null);
});

test('concurrent saves under the shared lock cannot silently overwrite each other', async () => {
  let tail = Promise.resolve();
  const locks = { request: (_name, fn) => { const result = tail.then(fn); tail = result.catch(() => {}); return result; } };
  const first = tab(undefined, undefined, locks), second = tab(first.disk, undefined, locks);
  first.store.updateHandCard('first', { isOwned: true });
  second.store.updateHandCard('second', { isOwned: true });
  const results = await Promise.allSettled([first.store.saveHandCollectionManually(), second.store.saveHandCollectionManually()]);
  assert.deepEqual(results.map(r => r.status), ['fulfilled', 'rejected']);
  assert.equal(tab(first.disk).store.isCharacterOwned('first'), true);
  assert.equal(second.store.hasUnsavedChanges, true);
});

test('edits made while a save waits for its lock remain unsaved after that save finishes', async () => {
  let release;
  const gate = new Promise(resolve => { release = resolve; });
  const current = tab(undefined, undefined, { request: async (_name, fn) => { await gate; return fn(); } });
  current.store.updateHandCard('sample', { level: 81 });
  const saving = current.store.saveHandCollectionManually();
  current.store.updateHandCard('sample', { level: 82 });
  release(); await saving;
  assert.equal(current.store.hasUnsavedChanges, true);
  assert.equal(tab(current.disk).store.peekHandCard('sample').level, 81);
  assert.equal(tab(current.disk, current.session).store.peekHandCard('sample').level, 82);
  assert.equal(tab(current.disk, current.session).store.hasConflict, false);
});

test('bulk edits persist one complete draft, including edits before an interrupted batch', () => {
  const current = tab();
  let writes = 0;
  const write = current.session.setItem.bind(current.session);
  current.session.setItem = (...args) => { writes++; return write(...args); };
  current.store.batchUpdates(() => {
    for (let i = 0; i < 600; i++) current.store.updateHandCard(`card-${i}`, { isOwned: true });
  });
  assert.equal(writes, 1);
  assert.equal(Object.keys(JSON.parse(current.session.getItem(DRAFT)).data).length, 601);
  assert.throws(() => current.store.batchUpdates(() => {
    current.store.updateHandCard('interrupted', { isOwned: true });
    throw new Error('interrupted');
  }));
  assert.equal(writes, 2);
  assert.equal(tab(current.disk, current.session).store.isCharacterOwned('interrupted'), true);
});
