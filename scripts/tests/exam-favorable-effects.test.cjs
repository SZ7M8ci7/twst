const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const source = fs.readFileSync(path.join(__dirname, '../../src/views/examSimulator.vue'), 'utf8')
  .match(/<script setup[^>]*>([\s\S]*?)<\/script>/)[1];
const ast = ts.createSourceFile('exam.ts', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
const constants = ['stateArrayOwnershipBits', 'curseRatePowerScale', 'freezeRatePowerScale'];
const declarations = ast.statements.filter(node =>
  ts.isFunctionDeclaration(node) && !node.getText(ast).includes('import.meta')
  || ts.isVariableStatement(node) && node.declarationList.declarations.some(d => constants.includes(d.name.getText(ast))))
  .map(node => node.getText(ast)).join('\n');
const code = ts.transpileModule(declarations, { compilerOptions: { target: ts.ScriptTarget.ES2020 } }).outputText;
const stateKeys = ['playerAttackDowns', 'playerDamageDowns', 'playerEvasions', 'enemyDamageReductions', 'enemyDamageNulls',
  'enemyEvasions', 'enemyCriticals', 'enemyAttackDowns', 'enemyDamageDowns', 'enemyDamageTakenUps', 'enemyCurses',
  'enemyBlinds', 'enemyFreezes', 'playerBlinds', 'playerCurses', 'playerFreezes', 'burns', 'playerDamageTakenDowns',
  'playerDamageTakenUps', 'playerContinueHeals', 'playerImmunities', 'playerGuts', 'playerBuffs', 'enemyAttackUps',
  'enemyDamageUps', 'enemyGuts', 'enemyContinueHeals'];

// Execute the production battle functions, replacing only spell/character data.
function fixture(enabled = true) {
  const context = { favorableEffects: { value: enabled }, simulationRuntimeCache: null,
    exam: { value: { kind: 'BASIC' } }, fixedEnemyActionElement: { value: null }, enemySlots: { value: [{ id: 'e1' }] },
    criticalRatePowerScale: { 小: 20 }, criticalDict: {}, atkbuffDict: {}, dmgbuffDict: {},
    CRITICAL_DAMAGE_MULTIPLIER: 1.5, resourceImportanceWeight: undefined,
    deck: { value: [{ character: { name: 'test' } }] },
    resourceCriticalScoutCard: undefined, resourceCriticalScoutMagic: undefined, resourceCriticalScoutHits: 0 };
  vm.createContext(context);
  vm.runInContext(code, context);
  context.magicById = () => ({ element: '無', power: '2連撃(強)' });
  context.buildRuntimeCharacter = () => ({ atk: 1000 });
  context.getPlayerMagicRuntimeMeta = () => ({ runtimeAtk: 1000, buddyAtk: 0, magicAttribute: '無',
    adjustedPower: '2連撃(強)', level: 10, magicRatio: 1, attributeAdjust: 1, rengekiMultiplier: 2 });
  context.getEnemyActionRuntimeMeta = () => ({ baseAtk: 1000, magicRatio: 1, rengekiMultiplier: 2, hitCount: 2 });
  const state = Object.fromEntries(stateKeys.map(key => [key, []]));
  const stats = { log: [], miss: 0, debuff: 0 };
  const enemy = { slotKey: 'e1', element: '無', effectKind: 'none', effectTarget: '相手', duration: 2 };
  return { c: context, state, stats, enemy,
    player: (roll = .99) => context.calculatePlayerDamage('0-M1', '無', state, () => roll, stats, false, enemy),
    opponent: (roll = .99) => context.calculateEnemyDamage(enemy, '0-M1', state, () => roll, stats) };
}
const ownRate = rate => ({ cardIndex: 0, rate, turns: 2 });
const enemyRate = rate => ({ targetEnemySlotKey: 'e1', rate, turns: 2 });
const criticalBuff = () => ({ targetDeckIndex: 0, turns: 2, buff: { buffOption: 'クリティカル', powerOption: '小', levelOption: 10 } });

test('favorable attacks ignore non-guaranteed blindness and enemy evasion and critical on every hit', () => {
  const f = fixture();
  f.state.playerBlinds.push(ownRate(99.9));
  f.state.enemyEvasions.push(enemyRate(99.9));
  f.state.playerBuffs.push(criticalBuff());
  const result = f.player(0);
  assert.equal(result.blindMiss, false);
  assert.equal(result.evasionCount, 0);
  assert.equal(result.criticalCount, 2);
  assert.ok(result.damage > 0);
  assert.equal(result.transferSnapshot.criticalCount, 2);
});

test('favorable defense always evades available hits or misses from active enemy blindness', () => {
  const f = fixture();
  f.state.playerEvasions.push(ownRate(1));
  assert.equal(f.opponent().evasionCount, 2);
  assert.equal(f.opponent().damage, 0);
  f.state.enemyBlinds.push(enemyRate(1));
  const blinded = f.opponent();
  assert.equal(blinded.blindMiss, true);
  assert.equal(blinded.damage, 0);
});

test('non-guaranteed enemy criticals never trigger, but ordinary attacks still hit', () => {
  const f = fixture();
  f.state.enemyCriticals.push(enemyRate(99.9));
  const result = f.opponent(0);
  assert.equal(result.criticalCount, 0);
  assert.equal(result.blindMiss, false);
  assert.equal(result.evasionCount, 0);
  assert.ok(result.damage > 0);
});

test('absent, expired or wrong-target critical and evasion effects are never invented', () => {
  const f = fixture();
  f.state.playerBuffs.push({ ...criticalBuff(), turns: 0 }, { ...criticalBuff(), targetDeckIndex: 1 });
  f.state.playerEvasions.push({ ...ownRate(100), turns: 0 }, { ...ownRate(100), cardIndex: 1 });
  f.c.tickTimedEffects(f.state);
  assert.equal(f.player(0).criticalCount, 0);
  assert.equal(f.opponent(0).evasionCount, 0);
  assert.equal(f.c.rollEffect(0, () => 0, true), false);
});

test('normal mode keeps successful and failed random outcomes for both sides', () => {
  const f = fixture(false);
  f.state.playerBuffs.push(criticalBuff());
  assert.equal(f.player(.99).criticalCount, 0);
  assert.equal(f.player(0).criticalCount, 2);
  f.state.playerBlinds.push(ownRate(20));
  assert.equal(f.player(0).blindMiss, true);
  assert.equal(f.player(.99).blindMiss, false);
  f.state.enemyEvasions.push(enemyRate(100));
  assert.equal(f.player(.99).evasionCount, 2);
  f.state.enemyCriticals.push(enemyRate(100));
  assert.equal(f.opponent(0).criticalCount, 2);
  f.state.playerEvasions.push(ownRate(20));
  assert.equal(f.opponent(.99).evasionCount, 0);
  assert.equal(f.opponent(0).evasionCount, 2);
  f.state.enemyBlinds.push(enemyRate(20));
  assert.equal(f.opponent(.99).blindMiss, false);
  assert.equal(f.opponent(0).blindMiss, true);
});

test('curse and freeze favor the player, while enemy freeze fails and fixed debuffs remain', () => {
  for (const enabled of [false, true]) {
    const f = fixture(enabled);
    f.stats.log = undefined;
    f.c.getAutomaticOpponentDebuffs = () => ['呪い', '凍結'].map(buffOption => ({
      magicOption: 'M1', buffOption, powerOption: '中', durationTurns: 2, targetType: 'opponent' }));
    f.c.activatePlayerOpponentDebuffs('0-M1', f.enemy, undefined, f.state, () => .99, f.stats, 1, 'test');
    assert.equal(f.state.enemyCurses.length, enabled ? 1 : 0);
    assert.equal(f.state.enemyFreezes.length, enabled ? 1 : 0);
    f.c.applyEnemyAdditionalEffects({ ...f.enemy, effectKind: 'freeze', effectValue: 99.9 }, '0-M1', '1-M1', f.state, () => 0, f.stats);
    assert.equal(f.state.playerFreezes.length, enabled ? 0 : 1);
    f.c.applyEnemyAdditionalEffects({ ...f.enemy, effectKind: 'atkDown', effectValue: 20 }, '0-M1', '1-M1', f.state, () => 0, f.stats);
    assert.equal(f.state.playerAttackDowns.length, 1);
  }
});

test('damage variance remains random even with favorable effects', () => {
  const f = fixture();
  assert.ok(f.player(0).damage < f.player(.99).damage);
  assert.ok(f.opponent(0).damage < f.opponent(.99).damage);
});

test('guaranteed enemy evasion, criticals, freeze and player blindness still trigger in favorable mode', () => {
  const f = fixture();
  f.state.enemyEvasions.push(enemyRate(100));
  assert.equal(f.player().evasionCount, 2);
  assert.equal(f.player().damage, 0);
  f.state.playerBlinds.push(ownRate(100));
  assert.equal(f.player().blindMiss, true);
  f.state.enemyCriticals.push(enemyRate(100));
  assert.equal(f.opponent().criticalCount, 2);
  f.c.applyEnemyAdditionalEffects({ ...f.enemy, effectKind: 'freeze', effectValue: 100 }, '0-M1', '1-M1', f.state, () => .99, f.stats);
  assert.equal(f.state.playerFreezes.length, 1);
});

test('stacked rates reaching or exceeding 100% stay guaranteed for both sides', () => {
  const f = fixture();
  f.state.enemyEvasions.push(enemyRate(60), enemyRate(40));
  assert.equal(f.player().evasionCount, 2);
  f.state.enemyCriticals.push(enemyRate(60), enemyRate(60));
  assert.equal(f.opponent().criticalCount, 2);
  for (const beneficial of [false, true]) {
    assert.equal(f.c.rollEffect(100, () => .99, beneficial), true);
    assert.equal(f.c.rollEffect(120, () => .99, beneficial), true);
    assert.equal(f.c.rollEffect(0, () => 0, beneficial), false);
    assert.equal(f.c.rollEffect(99.9, () => 0, beneficial), beneficial);
    assert.equal(f.c.effectProbability(1, beneficial), 1, 'forecasts preserve guaranteed effects too');
  }
});
