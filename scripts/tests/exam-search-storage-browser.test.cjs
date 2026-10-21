// Real IndexedDB/localStorage tests in a new browser context for every case.
// PLAYWRIGHT_MODULE / CHROMIUM_EXECUTABLE_PATH may point at bundled runtimes.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { build } = require('esbuild');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = path.resolve(__dirname, '../..');
const setupKey = 'twst-exam-resource-search-v1';
const sessionKey = `${setupKey}-session`;
let browser, server, url, bundle;
const measurements = [];
before(async () => {
  bundle = (await build({ entryPoints: [path.join(root, 'src/storage/examSearchStorage.ts')],
    bundle: true, write: false, format: 'iife', globalName: 'ExamStorage', platform: 'browser',
    tsconfig: path.join(root, 'tsconfig.json') })).outputFiles[0].text;
  server = http.createServer((_req, res) => { res.setHeader('Content-Type', 'text/html'); res.end('<title>Storage verification</title>'); });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  url = `http://127.0.0.1:${server.address().port}`;
  browser = await chromium.launch({ headless: true, ...(process.env.CHROMIUM_EXECUTABLE_PATH
    ? { executablePath: process.env.CHROMIUM_EXECUTABLE_PATH } : {}) });
});
after(async () => {
  await browser?.close();
  if (server) await new Promise(resolve => server.close(resolve));
  fs.mkdirSync(path.join(root, 'artifacts'), { recursive: true });
  fs.writeFileSync(path.join(root, 'artifacts/exam-search-storage-fix-browser.json'), JSON.stringify(measurements, null, 2));
});
async function pageFor(t) {
  const context = await browser.newContext();
  t.after(() => context.close());
  await context.addInitScript({ content: `${bundle}\nglobalThis.ExamStorage = ExamStorage;` });
  const page = await context.newPage();
  await page.goto(url);
  return page;
}
function session(samples = 8) {
  const version = fs.readFileSync(path.join(root, 'src/domain/examSearch/types.ts'), 'utf8').match(/ENGINE_VERSION = '([^']+)'/)[1];
  const cards = Array.from({ length: 5 }, (_, i) => ({ name: `card-${i}`, level: 80, totsu: 0,
    magicLevels: [10, 10, 10], buddyLevels: [10, 10, 10], allowUpgrade: true, originalTotsu: 0,
    selectedMagic: [1, 2], support: false }));
  const row = { candidate: { id: 'candidate', cards, challengeIds: [], cost: 0, policy: 'effects', estimate: 1 },
    development: { scores: [35000, 45000], retired: 0, turns: 8 },
    validation: { scores: Array.from({ length: samples }, (_, i) => 40000 + i % 10000), retired: 0, turns: samples * 4 },
    validationTarget: samples, validationBest: { seed: 'replay-exact', score: 40000 + Math.min(samples - 1, 9999) } };
  const child = { cursor: 7, seen: ['candidate', 'discarded'], pool: [row], finalists: [row], pending: [],
    round: 1, elapsed: 12345, trialSerial: 200, nonce: 'seed-island', evaluatedCount: 12, generatedCount: 20,
    partition: { islandIndex: 0, islandCount: 1 } };
  return { input: { preset: { id: 'test', kind: 'BASIC' }, roster: cards, supports: [], challengeLocks: {},
    budget: 0, itemsPerLimitBreak: 1, attempts: 30, target: 0, desiredProbability: .05, maxRemoved: 1 },
  checkpoint: { ...child, pool: [], parallel: { baseNonce: 'seed', checkpoints: [child], owners: { candidate: 0 } } },
  version, catalogVersion: 'catalog-test' };
}
async function abortWrites(page) {
  await page.evaluate(() => {
    const original = IDBObjectStore.prototype.put;
    IDBObjectStore.prototype.put = function (...args) {
      const request = original.apply(this, args);
      // Abort after request success, to distinguish success from transaction commit.
      request.addEventListener('success', () => this.transaction.abort());
      return request;
    };
    window.restoreWrites = () => { IDBObjectStore.prototype.put = original; };
  });
}
for (const compressed of [false, true]) {
  test(`migrates ${compressed ? 'compressed' : 'plain'} legacy data losslessly and survives a reload`, { timeout: 60000 }, async t => {
    const page = await pageFor(t), saved = session(compressed ? 50000 : 8);
    await page.evaluate(({ saved, compressed, setupKey, sessionKey }) => {
      localStorage.setItem(setupKey, JSON.stringify({ ...saved.input, setupVersion: 2 }));
      localStorage.setItem('twst-hand-collection', 'keep-my-cards');
      localStorage.setItem('twst_saved_decks', 'keep-my-decks');
      const raw = compressed ? ExamStorage.serializeSearchSession(saved) : JSON.stringify(saved);
      if (compressed && JSON.parse(raw).checkpointEncoding !== 'lz-utf16-v1') throw Error('compression fixture too small');
      localStorage.setItem(sessionKey, raw);
    }, { saved, compressed, setupKey, sessionKey });
    await page.evaluate(() => ExamStorage.initializeExamSearchStorage());
    assert.deepEqual(await page.evaluate(() => ExamStorage.loadSearchSession()), saved);
    assert.equal(await page.evaluate(key => localStorage.getItem(key), sessionKey), null);
    await page.reload();
    await page.evaluate(() => ExamStorage.initializeExamSearchStorage());
    assert.deepEqual(await page.evaluate(() => ExamStorage.loadSearchSession()), saved);
    assert.deepEqual(await page.evaluate(() => ExamStorage.loadExamSearch()), saved.input);
    assert.deepEqual(await page.evaluate(() => [localStorage.getItem('twst-hand-collection'), localStorage.getItem('twst_saved_decks')]),
      ['keep-my-cards', 'keep-my-decks']);
    const referenceShared = await page.evaluate(() => {
      const c = ExamStorage.loadSearchSession().checkpoint;
      return c.parallel.checkpoints[0].pool[0] === c.parallel.checkpoints[0].finalists[0];
    });
    // JSON legacy data did not share object references; all values nevertheless survive unchanged.
    measurements.push({ case: compressed ? 'compressed migration' : 'plain migration', losslessReload: true, referenceShared });
  });
}
test('migration abort retains the original bytes and retries successfully', { timeout: 60000 }, async t => {
  const page = await pageFor(t), saved = session();
  const raw = JSON.stringify(saved);
  await page.evaluate(({ raw, sessionKey }) => localStorage.setItem(sessionKey, raw), { raw, sessionKey });
  await abortWrites(page);
  await page.evaluate(() => ExamStorage.initializeExamSearchStorage());
  assert.equal(await page.evaluate(key => localStorage.getItem(key), sessionKey), raw);
  assert.deepEqual(await page.evaluate(() => ExamStorage.loadSearchSession()), saved);
  await page.evaluate(() => { window.restoreWrites(); return ExamStorage.initializeExamSearchStorage(); });
  assert.equal(await page.evaluate(key => localStorage.getItem(key), sessionKey), null);
  await page.reload();
  await page.evaluate(() => ExamStorage.initializeExamSearchStorage());
  assert.deepEqual(await page.evaluate(() => ExamStorage.loadSearchSession()), saved);
});
test('a synchronous migration write error returns without losing the legacy session', { timeout: 60000 }, async t => {
  const page = await pageFor(t), saved = session(), raw = JSON.stringify(session());
  await page.evaluate(({ raw, sessionKey }) => {
    localStorage.setItem(sessionKey, raw);
    IDBObjectStore.prototype.put = () => { throw new DOMException('unavailable', 'QuotaExceededError'); };
  }, { raw, sessionKey });
  await page.evaluate(() => ExamStorage.initializeExamSearchStorage());
  assert.equal(await page.evaluate(key => localStorage.getItem(key), sessionKey), raw);
  assert.deepEqual(await page.evaluate(() => ExamStorage.loadSearchSession()), saved);
});
test('failed database transaction and failed fallback preserve the previous committed checkpoint', { timeout: 60000 }, async t => {
  const page = await pageFor(t), saved = session();
  assert.equal(await page.evaluate(saved => ExamStorage.saveSearchSession(saved), saved), true);
  await abortWrites(page);
  await page.evaluate(() => { Storage.prototype.setItem = () => { throw new DOMException('full', 'QuotaExceededError'); }; });
  const changed = structuredClone(saved); changed.checkpoint.cursor = 99;
  assert.equal(await page.evaluate(saved => ExamStorage.saveSearchSession(saved), changed), false);
  await page.reload();
  await page.evaluate(() => ExamStorage.initializeExamSearchStorage());
  assert.deepEqual(await page.evaluate(() => ExamStorage.loadSearchSession()), saved);
});
test('newer fallback data wins over an older database record after reload', { timeout: 60000 }, async t => {
  const page = await pageFor(t), saved = session();
  await page.evaluate(saved => ExamStorage.saveSearchSession(saved), saved);
  await page.evaluate(() => { IDBFactory.prototype.open = () => { throw new DOMException('blocked', 'SecurityError'); }; });
  const changed = structuredClone(saved); changed.checkpoint.cursor = 99; changed.input.attempts = 60;
  assert.equal(await page.evaluate(saved => ExamStorage.saveSearchSession(saved), changed), true);
  assert.deepEqual(await page.evaluate(() => ExamStorage.loadSearchSession()), changed);
  assert.deepEqual(await page.evaluate(() => ExamStorage.loadExamSearch()), changed.input);
  await page.reload();
  await page.evaluate(() => ExamStorage.initializeExamSearchStorage());
  assert.deepEqual(await page.evaluate(() => ExamStorage.loadSearchSession()), changed);
  assert.deepEqual(await page.evaluate(() => ExamStorage.loadExamSearch()), changed.input);
  assert.equal(await page.evaluate(key => localStorage.getItem(key), sessionKey), null);
});
test('old engine data retains seed teams without reviving obsolete statistics', { timeout: 60000 }, async t => {
  const page = await pageFor(t), saved = session(); saved.version = 'old-engine';
  await page.evaluate(({ saved, sessionKey }) => localStorage.setItem(sessionKey, JSON.stringify(saved)), { saved, sessionKey });
  await page.evaluate(() => ExamStorage.initializeExamSearchStorage());
  assert.equal(await page.evaluate(() => ExamStorage.loadSearchSession()), null);
  assert.deepEqual(await page.evaluate(() => ExamStorage.loadSearchSeedTeams('test')), [saved.input.roster.map(c => c.name)]);
});
test('serializes simultaneous saves and does not replace a later explicit setup change', { timeout: 60000 }, async t => {
  const page = await pageFor(t), saved = session();
  const result = await page.evaluate(async saved => {
    ExamStorage.saveExamSearch(saved.input);
    const second = structuredClone(saved); second.checkpoint.cursor = 88;
    const success = await Promise.all([ExamStorage.saveSearchSession(saved), ExamStorage.saveSearchSession(second)]);
    ExamStorage.saveExamSearch({ ...saved.input, attempts: 77 });
    return success;
  }, saved);
  assert.deepEqual(result, [true, true]);
  await page.reload();
  await page.evaluate(() => ExamStorage.initializeExamSearchStorage());
  assert.equal(await page.evaluate(() => ExamStorage.loadSearchSession().checkpoint.cursor), 88);
  assert.equal(await page.evaluate(() => ExamStorage.loadExamSearch().attempts), 77);
});
test('legacy migration preserves newer setup choices instead of restoring the older checkpoint input', async t => {
  const page = await pageFor(t), saved = session();
  await page.evaluate(({ saved, sessionKey, setupKey }) => {
    localStorage.setItem(sessionKey, JSON.stringify(saved));
    localStorage.setItem(setupKey, JSON.stringify({ ...saved.input, attempts: 77, setupVersion: 2 }));
  }, { saved, sessionKey, setupKey });
  await page.evaluate(() => ExamStorage.initializeExamSearchStorage());
  assert.equal(await page.evaluate(() => ExamStorage.loadExamSearch().attempts), 77);
  assert.equal(await page.evaluate(() => ExamStorage.loadSearchSession().input.attempts), 30);
});
test('checkpoint exceeding legacy quota saves and reloads even when localStorage is full', { timeout: 180000 }, async t => {
  const page = await pageFor(t), saved = session();
  const measured = await page.evaluate(async ({ saved, setupKey, sessionKey }) => {
    let random = 1729;
    const score = () => { random ^= random << 13; random ^= random >>> 17; random ^= random << 5; return 40000 + (random >>> 0) % 32000; };
    const children = Array.from({ length: 3 }, (_, island) => {
      const child = structuredClone(saved.checkpoint.parallel.checkpoints[0]);
      child.partition = { islandIndex: island, islandCount: 3 };
      child.finalists = Array.from({ length: 8 }, (_, index) => {
        const row = structuredClone(child.finalists[0]); row.candidate.id = `island-${island}-${index}`;
        row.validation.scores = Array.from({ length: 131072 }, score); row.validationTarget = 131072;
        return row;
      });
      child.pool = []; return child;
    });
    saved.checkpoint.parallel.checkpoints = children;
    saved.checkpoint.finalists = children.flatMap(c => c.finalists);
    saved.checkpoint.parallel.owners = Object.fromEntries(children.flatMap((c, i) => c.finalists.map(r => [r.candidate.id, i])));
    ExamStorage.saveExamSearch(saved.input);
    const encoded = ExamStorage.serializeSearchSession(saved);
    let oldError = null;
    try { localStorage.setItem(sessionKey, encoded); } catch (error) { oldError = error.name; }
    if (oldError !== 'QuotaExceededError') throw Error('large fixture must reproduce the original quota error');
    let low = 0, high = 6 * 1024 * 1024;
    while (high - low > 1) {
      const mid = Math.floor((low + high) / 2);
      try { localStorage.setItem('unrelated-data', 'x'.repeat(mid)); low = mid; } catch { high = mid; }
    }
    // Exercise restoring the checkpoint's own input after a setup write fails.
    saved.input.attempts = 99999;
    const setupSaved = ExamStorage.saveExamSearch(saved.input);
    const signature = c => c.finalists.map(r => [r.candidate.id, r.validation.scores.length,
      r.validation.scores.reduce((sum, score) => sum + score, 0), r.validation.scores[0], r.validation.scores.at(-1)]);
    const expected = signature(saved.checkpoint);
    const success = await ExamStorage.saveSearchSession(saved);
    const loaded = ExamStorage.loadSearchSession().checkpoint;
    return { oldError, setupSaved, success, savedCodeUnits: encoded.length, expected,
      sharedReferences: loaded.finalists[0] === loaded.parallel.checkpoints[0].finalists[0],
      unrelatedLength: localStorage.getItem('unrelated-data').length };
  }, { saved, setupKey, sessionKey });
  assert.equal(measured.setupSaved, false);
  assert.equal(measured.success, true);
  assert.equal(measured.sharedReferences, true);
  await page.reload();
  await page.evaluate(() => ExamStorage.initializeExamSearchStorage());
  const restored = await page.evaluate(() => {
    const c = ExamStorage.loadSearchSession().checkpoint;
    return { signature: c.finalists.map(r => [r.candidate.id, r.validation.scores.length,
      r.validation.scores.reduce((sum, score) => sum + score, 0), r.validation.scores[0], r.validation.scores.at(-1)]),
      attempts: ExamStorage.loadExamSearch().attempts, unrelatedLength: localStorage.getItem('unrelated-data').length,
      sharedReferences: c.finalists[0] === c.parallel.checkpoints[0].finalists[0] };
  });
  assert.deepEqual(restored.signature, measured.expected);
  assert.equal(restored.attempts, 99999);
  assert.equal(restored.unrelatedLength, measured.unrelatedLength);
  assert.equal(restored.sharedReferences, true);
  measurements.push({ case: 'large checkpoint with full localStorage', ...measured, losslessReload: true });
});
