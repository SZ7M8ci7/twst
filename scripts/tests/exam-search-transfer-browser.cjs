// Run against Vite preview (TEST_URL). Uses only an isolated browser context.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = path.resolve(__dirname, '../..');
const target = process.env.TEST_URL || 'http://127.0.0.1:4173/twst/exam-simulator';
const cards = require('../../src/assets/chara.json');
const presetModule = { exports: {} };
vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(root, 'src/utils/examPresets.ts'), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS },
}).outputText, { module: presetModule, exports: presetModule.exports });
const preset = structuredClone(presetModule.exports.examPresetDefinitions.find(p => p.kind === 'ATTACK' && p.title.includes('統一')));
// A deterministic, survivable battle makes replay equality meaningful (nonzero score).
preset.enemyHp = 50000;
preset.specialChallenges = [];
for (const enemy of preset.enemies) for (const action of enemy.actions) {
  action.estimatedDamage = 1;
  action.effectKind = 'none';
}
const rosterCard = c => ({ name: c.name, level: c.rare === 'SSR' ? 110 : c.rare === 'SR' ? 90 : 70,
  totsu: 4, magicLevels: [10, 10, 10], buddyLevels: [10, 10, 10], allowUpgrade: true });
const roster = cards.filter(c => c.rare === 'SSR').slice(0, 5).map(rosterCard);
const input = { preset: { ...preset, difficulty: preset.difficulty ?? 1.5 }, roster, supports: cards.map(rosterCard),
  budget: 0, itemsPerLimitBreak: 1, attempts: 30, desiredProbability: .05,
  favorableEffects: true, challengeLocks: Object.fromEntries((preset.specialChallenges ?? []).map(c => [c.id, 'on'])),
  maxRemoved: 1, seedTeams: [] };
const candidate = { id: 'transfer-browser', cards: roster.map((c, i) => ({ ...c, originalTotsu: c.totsu,
  support: i === 4, selectedMagic: i === 4 ? [2, 3] : [1, 2] })),
  challengeIds: (preset.specialChallenges ?? []).map(c => c.id), cost: 0, policy: 'effects', estimate: 0 };
const version = require('./helpers/exam-runtime.cjs').load('src/domain/examSearch/types.ts').searchEngineVersion(preset.kind);
const key = 'twst-exam-resource-search-v1';
const errors = [];

// Only reads the simulator's existing exposed test/worker entry point.
async function replay(page, seed) {
  return page.evaluate(seed => {
    const nodes = [document.querySelector('#app')._vnode];
    while (nodes.length) {
      const node = nodes.pop();
      if (!node) continue;
      if (node.component?.exposed?.runResourceTrial) return node.component.exposed.runResourceTrial(seed, 'effects', true);
      if (node.component?.subTree) nodes.push(node.component.subTree);
      if (Array.isArray(node.children)) nodes.push(...node.children);
    }
    throw Error('simulator runtime not mounted');
  }, seed);
}
async function deckReady(page) {
  await page.getByTestId('deck-card-4').locator(`img[alt="${candidate.cards[4].name}"]`).waitFor({ timeout: 60000 });
  await page.waitForFunction(() => [...document.querySelectorAll('.level-field input')].every(input => input.value === '110'));
}
async function snapshot(page) {
  return page.evaluate(() => Object.fromEntries(Object.keys(localStorage).sort().map(k => [k, localStorage.getItem(k)])));
}

(async () => {
  const browser = await chromium.launch({ headless: true, ...(process.env.CHROMIUM_EXECUTABLE_PATH
    ? { executablePath: process.env.CHROMIUM_EXECUTABLE_PATH } : {}) });
  try {
    const context = await browser.newContext();
    context.on('page', page => page.on('pageerror', error => errors.push(error.message)));
    await context.route(/^https:\/\/(fonts\.googleapis\.com|fonts\.gstatic\.com|www\.googletagmanager\.com|www\.google-analytics\.com)\//, route => route.abort());
    await context.route('**/twst/assets/**', route => {
      const asset = new URL(route.request().url());
      asset.pathname = asset.pathname.replace(/^\/twst\/assets\//, '/assets/');
      return route.continue({ url: asset.href });
    });
    await context.addInitScript(() => {
      // Match the failing environment: the fallback checkpoint stays in localStorage.
      IDBFactory.prototype.open = () => { throw new DOMException('unavailable', 'SecurityError'); };
    });
    const source = await context.newPage();
    await source.goto(new URL('/', target).href);
    await source.evaluate(({ input, candidate, key }) => {
      localStorage.setItem('twst-language', 'ja');
      localStorage.setItem('twst-hand-collection', JSON.stringify(Object.fromEntries(input.roster.map(c =>
        [c.name, { cardName: c.name, isOwned: true, level: c.level, totsu: c.totsu }]))));
      localStorage.setItem(`${key}-transfer-reference`, JSON.stringify({ id: 'reference', input, candidate, createdAt: Date.now() }));
      localStorage.setItem(`${key}-transfer-expired`, JSON.stringify({ id: 'expired', createdAt: 1 }));
    }, { input, candidate, key });
    // Establish an independent real-engine replay through the old link format.
    await source.goto(`${target}?resourceSearch=reference`);
    await deckReady(source);
    const seed = 'transfer-regression-exact-replay';
    const expected = await replay(source, seed);
    assert.ok(expected.score > 0);
    assert.ok(expected.plan.length > 0);
    const result = { candidate, development: { scores: [], retired: 0, turns: 0 },
      validation: { scores: [expected.score], retired: 0, turns: expected.finishTurn }, validationTarget: 1,
      validationBest: { seed, score: expected.score } };
    const session = { input, version, catalogVersion: 'fixture', checkpoint: { nonce: 'fixture', cursor: 1,
      seen: [candidate.id], pool: [result], finalists: [result], pending: [], round: 0, elapsed: 10, trialSerial: 1 } };
    await source.evaluate(({ key, input, session }) => {
      localStorage.setItem(key, JSON.stringify({ ...input, setupVersion: 2 }));
      localStorage.setItem(`${key}-session`, JSON.stringify(session));
    }, { key, input, session });
    await source.goto(`${target}?tab=search`);
    const open = source.getByRole('button', { name: '詳細シミュレーション', exact: true }).first();
    await open.waitFor({ timeout: 60000 });
    await source.evaluate(() => {
      let low = 0, high = 6 * 1024 * 1024;
      while (high - low > 1) {
        const mid = Math.floor((low + high) / 2);
        try { localStorage.setItem('saved-data-fill', 'x'.repeat(mid)); low = mid; } catch { high = mid; }
      }
      try { localStorage.setItem('cannot-fit', 'x'.repeat(1000)); throw Error('fixture is not full'); }
      catch (error) { if (error.name !== 'QuotaExceededError') throw error; }
    });
    const before = await snapshot(source);
    const opened = context.waitForEvent('page');
    await open.click();
    const destination = await opened;
    await deckReady(destination);
    assert.equal(await destination.evaluate(() => window.opener), null);
    assert.equal(new URL(destination.url()).searchParams.get('resourceSearch'), 'inline');
    assert.ok(new URL(destination.url()).hash.startsWith('#resource-inline-v1-'));
    assert.deepEqual(await replay(destination, seed), expected);
    assert.equal(await destination.getByTestId('simulation-favorable-effects').isVisible(), true);
    for (let i = 0; i < 5; i++) {
      assert.equal(await destination.getByTestId(`deck-card-${i}`).locator('img').getAttribute('alt'), candidate.cards[i].name);
      assert.deepEqual((await destination.locator('.deck-card').nth(i).locator('.magic-toggle.selected').allTextContents()).map(text => text.trim()),
        candidate.cards[i].selectedMagic.map(m => `M${m}`));
    }
    assert.deepEqual(await snapshot(destination), before);
    const hash = new URL(destination.url()).hash;
    await destination.getByRole('tab', { name: '編成探索', exact: true }).click();
    await destination.waitForURL(url => url.searchParams.get('tab') === 'search');
    await destination.getByRole('tab', { name: '詳細シミュレーション', exact: true }).click();
    await destination.waitForURL(url => url.searchParams.get('tab') === 'simulate');
    assert.equal(new URL(destination.url()).hash, hash);
    await destination.reload();
    await deckReady(destination);
    assert.deepEqual(await replay(destination, seed), expected);
    assert.deepEqual(await snapshot(destination), before);
    assert.deepEqual(errors, []);
    const report = { passed: true, quotaExceededBeforeClick: true, indexedDBUnavailable: true,
      savedDataUnchanged: true, exactReplayScore: expected.score, newTabAndReload: true, hashSurvivesTabSwitch: true,
      urlLength: destination.url().length, pageErrors: errors };
    fs.mkdirSync(path.join(root, 'artifacts'), { recursive: true });
    fs.writeFileSync(path.join(root, 'artifacts/exam-search-transfer-browser.json'), JSON.stringify(report, null, 2));
    console.log(JSON.stringify(report));
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
