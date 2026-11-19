// Run against Vite dev. Exercise both sides and single-sided effects at fixed widths.
const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');

const cases = [
  ['1T 先手 自分 リドル/寮服 M1(火, 単発) -> 敵A:木 与100', 'right', 'left'],
  ['1T 後手 相手 敵A:攻撃(木, 単発) -> リドル/寮服 M1(火, 単発) 被100', 'left', 'right'],
  ['1T 先手 自分回復 リドル/寮服 M1(火, 単発) 100→200', 'right', null],
  ['1T 後手 自分効果 リドル/寮服 M1(火, 単発) -> 味方全体 / ATKUP', 'right', null],
  ['1T 先手 自分効果 リドル/寮服 M3(水, 3連撃(弱)) -> 自 / 凍結無効 1T', 'right', null],
  ['1T 相手継続回復: +100 / 敵HP 100→200', 'left', null],
];

(async () => {
  const browser = await chromium.launch({ channel: process.env.BROWSER_CHANNEL || 'chrome' });
  try {
    const page = await browser.newPage();
    const origin = new URL(process.env.TEST_URL || 'http://127.0.0.1:3000').origin;
    await page.route('**/log-layout-test', route => route.fulfill({
      contentType: 'text/html',
      body: '<meta charset="utf-8"><main id="log"></main>',
    }));
    await page.goto(origin + '/log-layout-test');
    await page.evaluate(async lines => {
      const { createApp } = await import('/node_modules/.vite/deps/vue.js');
      const { default: Log } = await import('/src/components/ExamBattleLog.vue');
      const { groupExamBattleLog } = await import('/src/utils/examBattleLog.ts');
      const icon = '/src/assets/img/fire.webp';
      const groups = groupExamBattleLog(lines, { playerIcon: text => text.includes('リドル/寮服') ? icon : '' });
      createApp(Log, { groups, defaultImg: icon, elementIcon: () => icon, localize: text => text }).mount('#log');
    }, cases.map(([line]) => line));

    for (const width of [320, 390, 720, 721, 1280]) {
      await page.setViewportSize({ width, height: 844 });
      const positions = await page.locator('.battle-log-row').evaluateAll(rows => rows.map(row => {
        const bounds = row.getBoundingClientRect();
        const middle = bounds.left + bounds.width / 2;
        function side(selector) {
          const marker = row.querySelector(selector);
          if (!marker) return null;
          const rect = marker.getBoundingClientRect();
          return rect.right <= middle ? 'left' : rect.left >= middle ? 'right' : 'center';
        }
        const arrow = row.querySelector('.log-arrow:not(.action-arrow)');
        const direction = arrow && (getComputedStyle(arrow).transform === 'none' ? 'right' : 'left');
        const source = row.querySelector('.log-source').getBoundingClientRect();
        const detail = row.querySelector('.log-bubble').getBoundingClientRect();
        const sameRow = source.top < detail.bottom && detail.top < source.bottom;
        return [side('.log-source'), side('.log-target'), direction, sameRow, row.scrollWidth <= row.clientWidth + 1];
      }));
      assert.deepEqual(positions, cases.map(([, source, target]) =>
        [source, target, target, !target || width > 720, true]), `layout at ${width}px`);
    }
    await page.setViewportSize({ width: 390, height: 640 });
    const downloadEvent = page.waitForEvent('download');
    await page.evaluate(async () => {
      const { downloadBattleLogImage } = await import('/src/utils/battleLogImage.ts');
      const log = document.querySelector('.log-body');
      const scroller = log.parentElement;
      scroller.style.cssText = 'height:120px; overflow:auto';
      scroller.scrollTop = scroller.scrollHeight;
      // Mark both ends to detect an export clipped to the scrolled viewport.
      log.firstElementChild.style.borderTop = '8px solid rgb(255,0,190)';
      log.lastElementChild.style.borderBottom = '8px solid rgb(0,225,115)';
      await downloadBattleLogImage(log, 'Test log');
    });
    const download = await downloadEvent;
    assert.equal(download.suggestedFilename(), 'Test log.png');
    const chunks = [];
    for await (const chunk of await download.createReadStream()) chunks.push(chunk);
    const bands = await page.evaluate(async base64 => {
      const image = new Image();
      image.src = 'data:image/png;base64,' + base64;
      await image.decode();
      const canvas = document.createElement('canvas');
      canvas.width = 1;
      canvas.height = image.height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(image, Math.floor(image.width / 2), 0, 1, image.height, 0, 0, 1, image.height);
      const { data } = ctx.getImageData(0, 0, 1, image.height);
      const colors = [];
      for (let i = 0; i < data.length; i += 4) {
        if (data[i] === 255 && data[i+1] === 0 && data[i+2] === 190) colors.push('top');
        if (data[i] === 0 && data[i+1] === 225 && data[i+2] === 115) colors.push('bottom');
      }
      return [...new Set(colors)];
    }, Buffer.concat(chunks).toString('base64'));
    assert.deepEqual(bands, ['top', 'bottom'], 'PNG contains both ends of the log in order');
    console.log('Battle log sides and arrows verified at five viewport widths.');
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
