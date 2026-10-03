const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const vue = require('vue');
const { createPinia, setActivePinia } = require('pinia');
const cards = require('../../src/assets/chara.json');
const root = path.resolve(__dirname, '../..');
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');
const compile = source => ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2021, esModuleInterop: true },
}).outputText;
const first = cards.find(card => card.rare === 'SSR').name;
const second = cards.find(card => card.rare === 'SR').name;
const third = cards.find(card => card.rare === 'R').name;
function detection(cardKey = first, variant = 'normal', overrides = {}) {
  return { id: cardKey, fileIndex: 0, box: { x: 0, y: 0, width: 100, height: 100 },
    candidates: [{ cardKey, variant, score: 25, inliers: 20 }], confident: true,
    selected: cardKey, groovyStatus: 'absent', level: 40, maxLevel: 80, totsu: 0, ...overrides };
}

// Execute the actual component setup and store, replacing only browser boundaries
// and screenshot recognition. Computed properties and edits use real Vue reactivity.
function runtime(t) {
  const cache = new Map(), values = new Map();
  const storage = { getItem: key => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key) };
  const window = { localStorage: storage, sessionStorage: storage, addEventListener() {}, removeEventListener() {} };
  let nextResults = [];
  class ScreenshotSession {
    constructor() { this.abort = new AbortController(); }
    async load() {}
    async analyze() { return nextResults.map(row => ({ ...row })); }
    stop() { this.abort.abort(); }
  }
  function localRequire(id) {
    if (id === 'vue') return { ...vue, onUnmounted() {} };
    if (id === 'vue-i18n') return { useI18n: () => ({ locale: vue.ref('ja'), t: key => key }) };
    if (id.endsWith('.vue')) return {};
    if (id === '@/utils/characterAssets') return { loadImageUrls: async () => ({}) };
    if (id === '@/domain/handScreenshot/input') return { validateScreenshot: async () => {} };
    if (id === '@/domain/handScreenshot/client') return { ScreenshotSession };
    return id.startsWith('@/') ? load(`src/${id.slice(2)}${id.endsWith('.json') ? '' : '.ts'}`) : require(id);
  }
  function load(relative) {
    if (relative.endsWith('.json')) return JSON.parse(read(relative));
    if (!cache.has(relative)) {
      const module = { exports: {} };
      vm.runInNewContext(compile(read(relative)), { module, exports: module.exports, require: localRequire, window, console });
      cache.set(relative, module.exports);
    }
    return cache.get(relative);
  }
  setActivePinia(createPinia());
  const scope = vue.effectScope();
  t.after(() => scope.stop());
  let url = 0;
  const context = { exports: {}, require: localRequire, window, console, AbortController, DOMException,
    URL: { createObjectURL: () => `blob:test-${++url}`, revokeObjectURL() {} } };
  const source = read('src/components/HandScreenshotImport.vue').split('<script setup lang="ts">')[1].split('</script>')[0];
  scope.run(() => vm.runInNewContext(compile(source + '\nglobalThis.view = { rows, visibleRows, primaryRows, groovyStatusByCard, reviewOnly, needsReview, store, applied, apply, undo, activeId, pickCard, clearCard, selectFiles, levelMode };'), context));
  return { view: context.view, load, results: rows => { nextResults = rows; } };
}

test('only ribbon status controls warnings; artwork variants and recognition confidence are irrelevant', t => {
  const { view } = runtime(t);
  for (const variant of ['normal', 'groovy', 'catalog', 'unknown']) {
    for (const confident of [true, false]) {
      for (const status of ['present', 'absent', 'unknown']) {
        view.rows.value = [detection(first, variant, { confident, groovyStatus: status })];
        assert.equal(view.groovyStatusByCard.value.get(first), status, `${variant}/${confident}`);
        assert.equal(view.needsReview(view.rows.value[0]), status !== 'present');
        assert.equal(view.visibleRows.value.length, status === 'present' ? 0 : 1);
      }
    }
  }
  view.rows.value = [detection(first, 'normal', { candidates: [], groovyStatus: 'present' })];
  assert.equal(view.groovyStatusByCard.value.get(first), 'present', 'even missing artwork metadata has no effect');
});

test('readable absent-band warning remains importable and undoable', t => {
  const { view } = runtime(t);
  const before = { ...view.store.getHandCard(first) };
  view.rows.value = [detection(first, 'groovy'),
    detection(second, 'normal', { maxLevel: 60, groovyStatus: 'present' }),
    detection(third, 'catalog', { maxLevel: 40, groovyStatus: 'present' })];
  assert.equal(view.reviewOnly.value, true);
  assert.deepEqual(Array.from(view.visibleRows.value, row => row.selected), [first]);
  view.reviewOnly.value = false;
  assert.equal(view.visibleRows.value.length, 3);
  view.apply();
  assert.equal(view.applied.value, true, 'warning must not block import');
  assert.equal(view.store.getHandCard(first).isOwned, true);
  assert.equal(view.store.getHandCard(first).level, 80);
  view.undo();
  assert.equal(view.applied.value, false);
  assert.deepEqual({ ...view.store.getHandCard(first) }, before);
  assert.equal(view.groovyStatusByCard.value.get(first), 'absent');
});

test('unknown and missing status remain review items without asserting a missing band', t => {
  const { view } = runtime(t);
  for (const groovyStatus of ['unknown', undefined]) {
    view.rows.value = [detection(first, 'groovy', { groovyStatus })];
    assert.equal(view.groovyStatusByCard.value.get(first), 'unknown');
    assert.equal(view.needsReview(view.rows.value[0]), true);
    assert.equal(view.visibleRows.value.length, 1);
  }
});

test('manual identity correction retains only the source crop ribbon evidence for the corrected card', t => {
  const { view } = runtime(t);
  view.rows.value = [detection(first, 'groovy', { confident: false })];
  view.activeId.value = first;
  view.pickCard({ name: second });
  assert.equal(view.groovyStatusByCard.value.has(first), false);
  assert.equal(view.groovyStatusByCard.value.get(second), 'absent');
  view.clearCard();
  assert.equal(view.groovyStatusByCard.value.size, 0);
  view.pickCard({ name: first });
  assert.equal(view.groovyStatusByCard.value.get(first), 'absent');
});

test('supplemental evidence is limited to imported cards and conflicts remain unknown', t => {
  const { view } = runtime(t);
  view.rows.value = [detection(first, 'catalog', { groovyStatus: 'unknown' }),
    detection(first, 'groovy', { id: 'supplement', fileIndex: 1, displayMode: 'uncaps' }),
    detection(second, 'normal', { fileIndex: 1, displayMode: 'uncaps' })];
  assert.deepEqual(Array.from(view.groovyStatusByCard.value, ([key, value]) => [key, value]), [[first, 'absent']]);
  assert.deepEqual(Array.from(view.visibleRows.value, row => row.selected), [first]);
  assert.equal(view.primaryRows.value.length, 1);
  view.rows.value[0].groovyStatus = 'present';
  assert.equal(view.groovyStatusByCard.value.get(first), 'unknown', 'conflicting readable screenshots cannot establish current status');
  view.rows.value[1].groovyStatus = 'unknown';
  assert.equal(view.groovyStatusByCard.value.get(first), 'present');
  view.levelMode.value = 'current';
  assert.equal(view.groovyStatusByCard.value.get(first), 'present', 'level mode never changes ribbon evidence');
});

test('replacing images removes the previous ribbon warning', async t => {
  const { view, results } = runtime(t);
  results([detection()]);
  await view.selectFiles([{ name: 'first.png' }]);
  assert.equal(view.groovyStatusByCard.value.get(first), 'absent');
  results([detection(second, 'normal', { maxLevel: 60, groovyStatus: 'present' })]);
  await view.selectFiles([{ name: 'replacement.png' }]);
  assert.equal(view.groovyStatusByCard.value.has(first), false);
  assert.equal(view.groovyStatusByCard.value.get(second), 'present');
  assert.equal(view.visibleRows.value.length, 0);
});

test('each locale and result-card condition distinguish absent from unknown ribbon status', () => {
  for (const locale of ['ja', 'en', 'zh-CN']) {
    const messages = JSON.parse(read(`src/i18n/${locale}.json`)).screenshot;
    assert.match(messages.groovyWarning, /未グルーヴィー|not Groovified|未进行Groovy/);
    assert.equal(messages.groovyContinue, undefined);
    assert.equal(messages.groovyCancel, undefined);
    assert.equal(messages.groovyUnknown, messages.groovyWarning, 'unknown uses the requested visible notice without changing its internal status');
    assert.doesNotMatch(messages.groovyUnknown, /確認してください|Check the|请确认/);
    assert.doesNotMatch(messages.groovyWarning, /イラスト|artwork|卡面/);
  }
  const template = read('src/components/HandScreenshotImport.vue').split('</template>')[0];
  assert.equal(JSON.parse(read('src/i18n/ja.json')).screenshot.groovyWarning, '未グルーヴィーと認識されました。ステータスに差異が発生する可能性があります。');
  assert.doesNotMatch(template, /groovyConfirm|confirmGroovy|groovyContinue|groovyCancel/);
  assert.match(template, /v-if="groovyStatusByCard\.get\(row\.selected\) === 'absent'" class="card-warning">\{\{ t\('screenshot\.groovyWarning'\) \}\}/);
  assert.match(template, /v-else-if="row\.selected && groovyStatusByCard\.get\(row\.selected\) !== 'present'" class="card-warning">\{\{ t\('screenshot\.groovyUnknown'\) \}\}/);
});

test('absent-band warning registers directly once and remains undoable', t => {
  const { view } = runtime(t);
  view.rows.value = [detection()];
  let batches = 0;
  const original = view.store.batchUpdates;
  view.store.batchUpdates = (...args) => { batches++; return original(...args); };
  view.apply(); view.apply(); view.apply();
  assert.equal(batches, 1, 'normal apply registers directly exactly once');
  assert.equal(view.applied.value, true);
  view.undo();
  assert.equal(view.applied.value, false);
  view.apply();
  assert.equal(batches, 3, 'undo and a fresh apply each execute once');
});

test('present and unknown-only cards register directly', t => {
  const { view } = runtime(t);
  for (const groovyStatus of ['present', 'unknown', undefined]) {
    view.rows.value = [detection(first, 'groovy', { groovyStatus })];
    view.apply();
    assert.equal(view.applied.value, true);
    view.undo();
  }
});
