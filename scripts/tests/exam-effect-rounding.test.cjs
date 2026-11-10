const assert = require('node:assert/strict');
const { test } = require('node:test');
const { runtime, state } = require('./helpers/exam-runtime.cjs');

test('overlapping burn floors once per card, honors immunity/expiration and cannot KO', () => {
  const c = runtime(), s = state();
  c.buildRuntimeCharacter = i => ({ hp: [13073, 8565][i] });
  s.burns = [
    { cardIndex: 0, rate: 5, turns: 2 }, { cardIndex: 0, rate: 16, turns: 3 },
    { cardIndex: 1, rate: 5, turns: 2 }, { cardIndex: 0, rate: 99, turns: 0 },
  ];
  assert.equal(c.applyBurnDamage(s, 10000), 2745 + 428);
  s.playerImmunities.push({ cardIndex: 0, kind: 'burn', turns: 1 });
  assert.equal(c.applyBurnDamage(s, 10000), 428);
  assert.equal(c.applyBurnDamage(s, 100), 99);
  assert.equal(c.applyBurnDamage(s, 1), 0);
  c.tickTimedEffects(s);
  assert.equal(c.applyBurnDamage(s, 10000), 3173);
  c.tickTimedEffects(s);
  assert.equal(c.applyBurnDamage(s, 10000), 2091);
  c.tickTimedEffects(s);
  assert.equal(c.applyBurnDamage(s, 10000), 0);
});

test('instant healing cache preserves floor rounding and still checks current curse', () => {
  const c = runtime(), s = state();
  c.simulationRuntimeCache = { playerHealAmounts: new Map() };
  c.buildRuntimeCharacter = () => ({ atk: 5591 });
  let calls = 0;
  c.buildRuntimeBuffs = () => {
    calls++;
    return [{ magicOption: 'M1', buffOption: '回復', powerOption: '小', levelOption: 10 }];
  };
  assert.equal(c.calculatePlayerHeal('0-M1', s), 6150);
  s.playerCurses.push({ cardIndex: 0, rate: 100, turns: 1 });
  assert.equal(c.calculatePlayerHeal('0-M1', s), 0);
  c.tickTimedEffects(s);
  assert.equal(c.calculatePlayerHeal('0-M1', s), 6150);
  assert.equal(calls, 1);
});

test('continuous healing uses floored potential amounts with HP caps and curses', () => {
  const c = runtime(), s = state();
  c.buildRuntimeCharacter = () => ({ hp: 13073 });
  c.totalDeckHp.value = 10000;
  s.playerContinueHeals.push({ cardIndex: 0, rate: .15, turns: 1, source: 'test' });
  let result = c.applyPlayerContinueHeal(s, 9997);
  assert.equal(result.total, 3);
  assert.equal(result.details[0].potentialAmount, 1960);
  assert.equal(result.details[0].capped, true);
  assert.equal(c.applyPlayerContinueHeal(s, 10000).total, 0);
  s.playerCurses.push({ cardIndex: 0, rate: 100, turns: 1 });
  assert.equal(c.applyPlayerContinueHeal(s, 5000).total, 0);
  c.tickTimedEffects(s);
  assert.equal(c.applyPlayerContinueHeal(s, 5000).total, 0);
});

test('exact integer healing is not lost to binary decimals; true fractions still truncate', () => {
  const c = runtime(), s = state();
  c.buildRuntimeCharacter = () => ({ atk: 1000 });
  c.buildRuntimeBuffs = () => [{ magicOption: 'M1', buffOption: '回復', powerOption: '極小', levelOption: 7 }];
  assert.equal(c.calculatePlayerHeal('0-M1', s), 570); // 1000 * .57 is 569.9999999999999 in JS
  assert.equal(c.floorEffectAmount(99.999999), 99);
  assert.equal(c.floorEffectAmount(-1), 0);
});
