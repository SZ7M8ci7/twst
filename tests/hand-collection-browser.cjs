// Uses disposable browser contexts and synthetic cards; never the user's profile.
const assert = require('node:assert/strict');
const path = require('node:path');
const { chromium, webkit } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const card = require('../src/assets/chara.json').find(card => card.rare === 'SSR');
const KEY = 'twst-hand-collection';
const target = process.env.TEST_URL || 'http://127.0.0.1:3107/twst/hand-collection';
const seed = JSON.stringify({ version: 1, data: {
  [card.name]: { cardName: card.name, isOwned: true, level: 80, totsu: 1 },
} });
async function run(engine, options = {}) {
  const browser = await engine.launch({ headless: true, ...options });
  try {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    await context.route(/googletagmanager|google-analytics|fonts\.googleapis/, route => route.abort());
    await context.addInitScript(({ key, seed }) => {
      if (!localStorage.getItem('test-seeded')) {
        localStorage.setItem(key, seed); localStorage.setItem('test-seeded', 'true');
      }
    }, { key: KEY, seed });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(target);
    await page.locator('.table-row').first().waitFor();
    const row = page.locator('.table-row').filter({ has: page.locator(`img[alt="${card.name}"]`) });
    assert.equal(await row.count(), 1);
    const level = row.locator('input[type="number"]');
    await level.fill('81');
    await page.locator('.unsaved-indicator').waitFor();
    await page.reload();
    await page.locator('.table-row').first().waitFor();
    assert.equal(await level.inputValue(), '81');
    assert.equal(await page.locator('.unsaved-indicator').count(), 1);
    // Route away and back without reloading the store.
    await page.evaluate(async () => {
      const router = document.querySelector('#app').__vue_app__.config.globalProperties.$router;
      await router.push('/twst/top'); await router.push('/twst/hand-collection');
    });
    await page.locator('.table-row').first().waitFor();
    assert.equal(await page.locator('.unsaved-indicator').count(), 1);
    const save = page.getByRole('button', { name: '保存', exact: true });
    await page.evaluate(key => {
      const original = Storage.prototype.setItem;
      window.restoreStorage = () => { Storage.prototype.setItem = original; };
      Storage.prototype.setItem = function(k, v) {
        if (this === localStorage && k === key) throw new DOMException('test quota', 'QuotaExceededError');
        return original.call(this, k, v);
      };
    }, KEY);
    await save.click();
    await page.locator('.v-alert').filter({ hasText: '保存に失敗しました' }).waitFor();
    assert.equal(await page.locator('.unsaved-indicator').count(), 1);
    assert.equal(await page.evaluate(key => localStorage.getItem(key), KEY), seed);
    await page.screenshot({ path: path.join(__dirname, `../artifacts/hand-save-error-${engine.name()}.png`) });
    await page.evaluate(() => window.restoreStorage());
    await save.click();
    await page.waitForFunction(() => !document.querySelector('.unsaved-indicator'));
    assert.equal(JSON.parse(await page.evaluate(key => localStorage.getItem(key), KEY)).data[card.name].level, 81);
    // Concurrent edits: a dirty older tab must not replace a newer save.
    const other = await context.newPage(); await other.goto(target);
    await other.locator('.table-row').first().waitFor();
    await level.fill('82');
    const otherRow = other.locator('.table-row').filter({ has: other.locator(`img[alt="${card.name}"]`) });
    await otherRow.locator('input[type="number"]').fill('83');
    await other.getByRole('button', { name: '保存', exact: true }).click();
    await page.locator('.v-alert').filter({ hasText: '別のタブ' }).waitFor();
    assert.equal(await save.isDisabled(), true);
    assert.equal(await level.inputValue(), '82');
    await page.reload(); await page.locator('.table-row').first().waitFor();
    assert.equal(await level.inputValue(), '82');
    assert.equal(await save.isDisabled(), true);
    assert.equal(JSON.parse(await page.evaluate(key => localStorage.getItem(key), KEY)).data[card.name].level, 83);
    // Broken saved data stays intact and visibly blocks saving.
    await page.evaluate(key => {
      sessionStorage.removeItem(`${key}-draft-v1`);
      localStorage.setItem(key, '{broken');
    }, KEY);
    await page.reload();
    await page.locator('.v-alert').filter({ hasText: '読み込めませんでした' }).waitFor();
    assert.equal(await save.isDisabled(), true);
    assert.equal(await page.evaluate(key => localStorage.getItem(key), KEY), '{broken');
    assert.deepEqual(errors, []);
    console.log(`${engine.name()}: mobile viewport draft recovery, navigation, quota error/retry, cross-tab conflict, malformed-data protection passed`);
    await context.close();
  } finally { await browser.close(); }
}
(async () => {
  await run(chromium, process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {});
  if (process.env.TEST_WEBKIT === '1') await run(webkit);
})().catch(error => { console.error(error); process.exitCode = 1; });
