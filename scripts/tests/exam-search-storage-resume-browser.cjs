// End-to-end persistence verification against a built app (TEST_URL).
// Uses fresh browser contexts, real search workers and short search budgets.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const { build } = require('esbuild');
const LZString = require('lz-string');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = path.resolve(__dirname, '../..');
const target = process.env.TEST_URL || 'http://127.0.0.1:4173/twst/exam-simulator?tab=search';
const sessionKey = 'twst-exam-resource-search-v1-session';
const setupKey = 'twst-exam-resource-search-v1';
const cards = require('../../src/assets/chara.json');
const presetModule = { exports: {} };
vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(root, 'src/utils/examPresets.ts'), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS },
}).outputText, { module: presetModule, exports: presetModule.exports });
const preset = structuredClone(presetModule.exports.examPresetDefinitions.find(p => p.kind === 'ATTACK' && !p.title.includes('統一') && !p.specialChallenges?.length));
preset.enemyHp = 10000; preset.difficulty ??= 1.5;
for (const enemy of preset.enemies) for (const action of enemy.actions) { action.estimatedDamage = 1; action.effectKind = 'none'; }
const seen = new Set();
const roster = cards.filter(c => c.rare === 'SSR' && !seen.has(c.chara) && seen.add(c.chara)).slice(0, 5)
  .map(c => ({ name: c.name, level: 110, totsu: 4, magicLevels: [10, 10, 10], buddyLevels: [10, 10, 10], allowUpgrade: true }));
const input = { preset, roster, supports: [], budget: 0, additionalLevelCap: 0, itemsPerLimitBreak: 1,
  attempts: 30, desiredProbability: .05, target: 0, tolerance: 0, maxRemoved: 1, challengeLocks: {}, requiredCards: roster.map(c => c.name) };
const report = { cases: [], errors: [] };
let browser;
async function readSession(page) {
  return page.evaluate(async () => { await ExamStorage.initializeExamSearchStorage(); return ExamStorage.loadSearchSession(); });
}
async function ready(page) {
  await page.getByTestId('resource-start').waitFor({ timeout: 60000 });
}
async function idle(page) {
  await page.getByTestId('resource-resume').waitFor({ timeout: 60000 });
  assert.equal(await page.getByTestId('resource-save-retry').count(), 0);
}
(async () => {
  const bundle = (await build({ entryPoints: [path.join(root, 'src/storage/examSearchStorage.ts')],
    bundle: true, write: false, format: 'iife', globalName: 'ExamStorage', platform: 'browser',
    tsconfig: path.join(root, 'tsconfig.json') })).outputFiles[0].text;
  browser = await chromium.launch({ headless: true, ...(process.env.CHROMIUM_EXECUTABLE_PATH
    ? { executablePath: process.env.CHROMIUM_EXECUTABLE_PATH } : {}) });
  async function open(seedInput, legacy) {
    const context = await browser.newContext();
    // The deployed site is mounted at /twst/. Vite preview serves its assets
    // at /assets/, so mirror that deployment mount for deep-link reloads.
    await context.route('**/twst/assets/**', route => {
      const asset = new URL(route.request().url());
      asset.pathname = asset.pathname.replace(/^\/twst\/assets\//, '/assets/');
      return route.continue({ url: asset.href });
    });
    await context.addInitScript({ content: `${bundle}\nglobalThis.ExamStorage = ExamStorage;` });
    await context.addInitScript(({ input, legacy, setupKey, sessionKey }) => {
      if (!localStorage.getItem('storage-resume-test-seeded')) {
        localStorage.setItem(setupKey, JSON.stringify({ ...input, setupVersion: 2 }));
        localStorage.setItem('twst-hand-collection', JSON.stringify(Object.fromEntries(input.roster.map(c =>
          [c.name, { cardName: c.name, isOwned: true, level: c.level, totsu: c.totsu }]))));
        if (legacy) localStorage.setItem(sessionKey, legacy);
        localStorage.setItem('storage-resume-test-seeded', 'yes');
      }
      window.trace = { requests: [], checkpoints: 0, previews: [] };
      const NativeWorker = window.Worker;
      function WrappedWorker(...args) {
        const worker = new NativeWorker(...args);
        if (!/examSearch\.worker/.test(String(args[0]))) return worker;
        const post = worker.postMessage.bind(worker);
        worker.postMessage = (message, ...rest) => {
          if (['start', 'resume'].includes(message.method)) message.durationMs = 3000;
          window.trace.requests.push(structuredClone(message));
          return post(message, ...rest);
        };
        worker.addEventListener('message', ({ data }) => {
          if (data.checkpoint) window.trace.checkpoints++;
          if (data.preview) window.trace.previews.push(data.preview);
        });
        return worker;
      }
      WrappedWorker.prototype = NativeWorker.prototype;
      window.Worker = WrappedWorker;
    }, { input: seedInput, legacy, setupKey, sessionKey });
    const page = await context.newPage();
    page.on('pageerror', error => report.errors.push(error.message));
    page.on('dialog', dialog => dialog.accept());
    await page.goto(target);
    await ready(page);
    return { context, page };
  }
  const first = await open(input);
  await first.page.getByTestId('resource-start').click();
  await idle(first.page);
  const initial = await readSession(first.page);
  assert.ok(initial?.checkpoint.evaluatedCount > 0);
  assert.ok(initial.checkpoint.finalists.length > 0);
  assert.equal(await first.page.evaluate(key => localStorage.getItem(key), sessionKey), null);
  const handBefore = await first.page.evaluate(() => localStorage.getItem('twst-hand-collection'));
  await first.page.reload(); await ready(first.page); await idle(first.page);
  assert.deepEqual(await readSession(first.page), initial);
  await first.page.getByTestId('resource-resume').click(); await idle(first.page);
  const resumed = await readSession(first.page);
  const sent = await first.page.evaluate(() => window.trace.requests.find(r => r.method === 'resume'));
  assert.deepEqual(sent.checkpoint, initial.checkpoint);
  assert.deepEqual(sent.input, initial.input);
  assert.ok(resumed.checkpoint.elapsed > initial.checkpoint.elapsed);
  assert.ok(resumed.checkpoint.evaluatedCount >= initial.checkpoint.evaluatedCount);
  assert.equal(await first.page.evaluate(() => localStorage.getItem('twst-hand-collection')), handBefore);
  const replayLabel = require('../../src/i18n/ja.json').examSearch.replayBest;
  const replay = first.page.getByRole('button', { name: replayLabel, exact: true }).first();
  await replay.click();
  await first.page.waitForFunction(() => window.trace.previews.length > 0, null, { timeout: 30000 });
  const replayed = await first.page.evaluate(() => ({ sent: window.trace.requests.find(r => r.method === 'preview'), result: window.trace.previews[0] }));
  assert.equal(replayed.result.score, replayed.sent.best.score);
  report.cases.push({ name: 'new save, reload, real resume, exact best replay', passed: true,
    beforeEvaluated: initial.checkpoint.evaluatedCount, afterEvaluated: resumed.checkpoint.evaluatedCount,
    bestScore: replayed.result.score });
  await first.context.close();

  for (const compressed of [false, true]) {
    const legacyExpected = JSON.parse(JSON.stringify(initial));
    const legacy = compressed ? JSON.stringify({ input: initial.input, version: initial.version, catalogVersion: initial.catalogVersion,
      checkpointEncoding: 'lz-utf16-v1', checkpointLz: LZString.compressToUTF16(JSON.stringify(initial.checkpoint)) }) : JSON.stringify(initial);
    const { context, page } = await open(initial.input, legacy);
    await idle(page);
    assert.deepEqual(await readSession(page), legacyExpected);
    assert.equal(await page.evaluate(key => localStorage.getItem(key), sessionKey), null);
    await page.reload(); await ready(page); await idle(page);
    await page.getByTestId('resource-resume').click();
    await page.waitForFunction(() => window.trace.requests.some(r => r.method === 'resume'));
    await page.getByTestId('resource-stop').click();
    await idle(page);
    const after = await readSession(page);
    const request = await page.evaluate(() => window.trace.requests.find(r => r.method === 'resume'));
    assert.deepEqual(request.checkpoint, legacyExpected.checkpoint);
    assert.deepEqual(request.input, initial.input);
    assert.ok(after.checkpoint.elapsed >= initial.checkpoint.elapsed);
    await page.reload(); await ready(page); await idle(page);
    assert.deepEqual(await readSession(page), after);
    report.cases.push({ name: `${compressed ? 'compressed' : 'plain'} legacy migration, reload, resume, stop, reload`, passed: true });
    if (compressed) {
      await page.getByTestId('continuous-search').locator('input').check();
      await page.getByTestId('resource-resume').click();
      await page.waitForFunction(() => window.trace.requests.filter(r => r.method === 'resume').length >= 2, null, { timeout: 60000 });
      await page.getByTestId('resource-stop').click(); await idle(page);
      const final = await readSession(page);
      assert.ok(final.checkpoint.elapsed > after.checkpoint.elapsed);
      await page.reload(); await ready(page); await idle(page);
      assert.deepEqual(await readSession(page), final);
      report.cases.push({ name: 'continuous resume after committed saves, stop and reload', passed: true });
    }
    await context.close();
  }
  assert.deepEqual(report.errors, []);
})().catch(error => { report.failure = { message: error.message.slice(0, 2000), stack: error.stack.split('\n').slice(-4).join('\n') }; process.exitCode = 1; }).finally(async () => {
  await browser?.close();
  fs.mkdirSync(path.join(root, 'artifacts'), { recursive: true });
  fs.writeFileSync(path.join(root, 'artifacts/exam-search-storage-resume-browser.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
});
