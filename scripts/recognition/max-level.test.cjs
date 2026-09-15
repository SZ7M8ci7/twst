const { test } = require('node:test');
const assert = require('node:assert/strict');
const { load } = require('./test-helpers.cjs');
const { parseLevels, parseLevel, mergeDetections } = load('src/domain/handScreenshot/types.ts');
const { applyMaxLevelUncaps } = load('src/domain/handScreenshot/metadata.ts');

function recognize(text, rarity = 'SSR', confidence = 95) {
  const row = { selected: 'card', totsuEvidence: 'unknown', ...parseLevels(text, confidence) };
  applyMaxLevelUncaps(row, rarity);
  return row;
}

test('SSR without M3 uses the right-hand maximum, preserving the current level', () => {
  for (let max = 80; max <= 84; max++) {
    const row = recognize(`Lv 1 / ${max}`);
    assert.equal(row.level, 1); assert.equal(row.maxLevel, max);
    assert.equal(row.totsu, 0); assert.equal(row.totsuEvidence, 'max-level');
  }
  for (let max = 106; max <= 110; max++) {
    const row = recognize(`Lv 80 / ${max}`);
    assert.equal(row.level, 80); assert.equal(row.maxLevel, max);
    assert.equal(row.totsu, 2);
    assert.equal(mergeDetections([row])[0].totsu, 2);
  }
  assert.equal(recognize('84/105').totsu, undefined);
  assert.equal(recognize('106/111').totsu, undefined);
  assert.equal(parseLevel('80/110', 95), 80);
});

test('other rarities, adjacent ranges and unreadable maxima remain unknown', () => {
  for (const rare of ['SR', 'R', '']) for (const max of [80, 84, 106, 110]) {
    assert.equal(recognize(`1/${max}`, rare).totsu, undefined);
  }
  for (const max of [79, 85, 100, 105, 111, 120]) assert.equal(recognize(`1/${max}`).totsu, undefined);
  for (const text of ['80', '80/11O', '111/110', '0/80', '80/999']) {
    assert.equal(parseLevels(text, 95), undefined);
    assert.equal(recognize(text).totsu, undefined);
  }
  assert.equal(recognize('80/110', 'SSR', 74).totsu, undefined);
});

test('black frames, M3 and manual corrections take priority over maximum levels', () => {
  for (const [totsuEvidence, totsu] of [['black-frame', 4], ['magic3', 3], ['manual', 1], ['manual', undefined]]) {
    for (const maxLevel of [80, 110]) {
      const row = { totsuEvidence, totsu, maxLevel };
      applyMaxLevelUncaps(row, 'SSR');
      assert.equal(row.totsu, totsu); assert.equal(row.totsuEvidence, totsuEvidence);
    }
  }
});

test('correcting card rarity recalculates inferred uncaps without altering manual choices', () => {
  const row = recognize('80/110');
  applyMaxLevelUncaps(row, 'SR');
  assert.equal(row.totsu, undefined); assert.equal(row.totsuEvidence, 'unknown');
  applyMaxLevelUncaps(row, 'SSR'); assert.equal(row.totsu, 2);
  applyMaxLevelUncaps(row); assert.equal(row.totsu, undefined);
  row.totsu = 1; row.totsuEvidence = 'manual';
  applyMaxLevelUncaps(row, 'SSR'); assert.equal(row.totsu, 1);
});
