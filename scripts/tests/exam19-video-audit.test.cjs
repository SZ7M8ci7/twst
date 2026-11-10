// Replay recorded inputs against production functions. No fitted damage model
// or preset values are copied into the observations fixture.
const assert = require('node:assert/strict');
const { test, after } = require('node:test');
const fs = require('node:fs');
const { load, runtime, state } = require('./helpers/exam-runtime.cjs');
const observations = require('./fixtures/exam19-observations.json');
const presets = load('src/utils/examPresets.ts').examPresetDefinitions;
const results = [];
const presetFor = id => presets.find(p => p.id === `第19回統一${id}`);
const power = (attack, player = false) => {
  const count = attack.includes('3') ? 3 : attack.includes('2') ? 2 : 1;
  return `${count === 1 ? '単発' : count === 2 && player ? '連撃' : `${count}連撃`}(${attack.includes('弱') ? '弱' : '強'})`;
};
const advantage = { 火: '木', 水: '火', 木: '水' };
const disadvantage = { 火: '水', 水: '木', 木: '火' };
function targetFor(element, affinity) {
  return affinity === 1.5 ? advantage[element] : affinity === .5 ? disadvantage[element] : '無';
}
function challengeEffects(preset, selectors) {
  return selectors.map(selector => {
    const [kind, duration, attribute] = selector.split(':');
    const effect = preset.specialChallenges.flatMap(c => c.effects).find(e =>
      e.kind === kind && e.duration === Number(duration) && (!attribute || e.attribute === attribute));
    assert.ok(effect, `${preset.id}: missing challenge ${selector}`);
    return effect;
  });
}
function setupChallenges(c, s, effects, row) {
  c.charaDormMap.fixture = row.defenderDorm || 'その他';
  effects.forEach(effect => c.applySpecialChallengeEffect(effect, s));
  for (let turn = 1; turn < row.turn; turn++) c.tickTimedEffects(s);
}
function enemyRanges(c, preset, effects, row) {
  const enemy = preset.enemies.find(e => e.name === row.actor);
  assert.ok(enemy, `missing enemy ${row.actor}`);
  const s = state();
  setupChallenges(c, s, effects, row);
  const atk = enemy.actions.find(a => a.effectKind === 'atkUp' && (row.single === undefined || a.power.includes('2')));
  const singleAtk = enemy.actions.find(a => a.effectKind === 'atkUp' && a.power.startsWith('単発'));
  const sharedActor = preset.enemies.find(e => e.actions.some(a => a.effectKind === 'atkUp' && a.effectTarget === '味方選択'));
  const shared = sharedActor?.actions.find(a => a.effectKind === 'atkUp' && a.effectTarget === '味方選択');
  const dmg = enemy.actions.find(a => a.effectKind === 'damageUp');
  for (const [count, action] of [[row.own, atk], [row.single, singleAtk], [row.shared, shared]]) {
    if (count) {
      assert.ok(action, `missing ATK buff for ${row.actor}`);
      s.enemyAttackUps.push({ rate: count * action.effectValue, turns: 1 });
    }
  }
  if (row.damage) {
    assert.ok(dmg, `missing damage buff for ${row.actor}`);
    s.enemyDamageUps.push({ rate: row.damage * dmg.effectValue, turns: 1 });
  }
  // The ledger records active buffs, not always which duplicate hand was used.
  // Keep all compatible hands: an outlier fails even the most generous envelope.
  const actions = enemy.actions.filter(a => a.power === power(row.attack) &&
    (a.effectKind !== 'atkUp' || (row.own || row.shared || row.single)) &&
    (a.effectKind !== 'damageUp' || row.damage));
  assert.ok(actions.length, `no compatible hand: ${row.actor}/${row.attack}`);
  const ranges = actions.map(a => {
    // Enemy affinity is the attacker's multiplier. Defender has inverse compatibility.
    const defender = targetFor(a.element, row.affinity);
    c.magicById = () => ({ element: defender });
    const action = { ...a, slotKey: row.actor };
    const stats = { log: [], miss: 0 };
    const low = c.calculateEnemyDamage(action, '0-M1', s, () => 0, stats);
    // Include the documented +5% endpoint; do not manufacture an outlier
    // through floating-point 1.0499999999999998 at an integer boundary.
    const high = c.calculateEnemyDamage(action, '0-M1', s, () => 1, stats);
    return { low: low.hitDamages[0], high: high.hitDamages[0], baseAtk: low.baseAtk, action: a.name };
  });
  return { low: Math.min(...ranges.map(r => r.low)), high: Math.max(...ranges.map(r => r.high)), ranges };
}
function playerRange(c, preset, effects, row) {
  const s = state();
  setupChallenges(c, s, effects, row);
  const configured = power(row.attack, true);
  const character = { atk: row.atk, magic2Attribute: row.element, magic2Power: configured, magic2Lv: row.level };
  c.buildRuntimeCharacter = () => character;
  c.calculateRuntimeBuddyAtk = () => row.atk * (row.buddy || 0);
  c.magicById = () => ({ element: row.element, power: configured });
  if (row.own) {
    assert.ok(Math.abs(row.own - .2) < 1e-8 || Math.abs(row.own - .5) < 1e-8, `unknown own buff ${row.own}`);
    s.playerBuffs.push({ targetDeckIndex: 0, turns: 1, buff: { buffOption: 'ATKUP', powerOption: row.own > .3 ? '大' : '小', levelOption: 10 } });
  }
  if (row.damageBuff) {
    assert.equal(row.damageBuff, .0875);
    s.playerBuffs.push({ targetDeckIndex: 0, turns: 1, buff: { buffOption: 'ダメージUP', powerOption: '中', levelOption: 10 } });
  }
  if (row.atkDownCount) {
    const action = preset.enemies.flatMap(e => e.actions).find(a => a.effectKind === 'atkDown');
    assert.ok(action);
    s.playerAttackDowns.push({ cardIndex: 0, rate: row.atkDownCount * action.effectValue, turns: 1 });
  }
  if (row.reductionCount) {
    const action = preset.enemies.flatMap(e => e.actions).find(a => a.effectKind === 'damageTakenDown');
    assert.ok(action);
    s.enemyDamageReductions.push({ rate: row.reductionCount * action.effectValue, turns: 1 });
  }
  const target = targetFor(row.element, row.affinity);
  const count = row.duo ? 3 : c.magicHitCount(configured);
  const stats = { log: [], miss: 0 };
  const low = c.calculatePlayerDamage('0-M2', target, s, () => 0, stats, !!row.duo);
  const high = c.calculatePlayerDamage('0-M2', target, s, () => 1, stats, !!row.duo);
  return { low: low.damage / count, high: high.damage / count };
}
for (const dataset of observations.datasets) {
  for (const side of ['enemy', 'player']) {
    if (!dataset[side].length) continue;
    test(`${dataset.name}: ${side} recorded damage is achievable`, () => {
      const c = runtime();
      const preset = presetFor(dataset.preset);
      const effects = challengeEffects(preset, dataset.challenges);
      let hits = 0;
      const failures = [];
      for (const row of dataset[side]) {
        const range = side === 'enemy' ? enemyRanges(c, preset, effects, row) : playerRange(c, preset, effects, row);
        row.values.forEach((value, hit) => {
          hits++;
          if (value < range.low || value > range.high) failures.push({
            battle: row.battle, video: row.video, turn: row.turn, time: row.time, actor: row.actor,
            attack: row.attack, hit: hit + 1, observed: value, ...range,
            outsideBy: value < range.low ? range.low - value : value - range.high,
          });
        });
      }
      results.push({ dataset: dataset.name, side, hits, passed: hits - failures.length, failures });
      assert.equal(failures.length, 0, `${failures.length}/${hits} outside production range; examples: ${JSON.stringify(failures.slice(0, 4))}`);
    });
  }
}

test('木DF: all 40 recorded burn events use floor per card', () => {
  const c = runtime();
  const hp = [11658, 10536, 12965, 15340, 12965];
  c.buildRuntimeCharacter = i => ({ hp: hp[i] });
  const s = state();
  s.burns = hp.map((_, cardIndex) => ({ cardIndex, rate: 5, turns: 5 }));
  const failures = observations.burnWood.map(g => ({ time: g.t, expected: g.damage, actual: c.applyBurnDamage(s, g.hp_before) }))
    .filter(g => g.expected !== g.actual);
  results.push({ dataset: 'wood burn', events: 40, failures });
  assert.deepEqual(failures.slice(0, 3), [], 'video=3171 per turn; production must match');
});
test('水BS: all 36 burn events include overlapping normal and challenge burn', () => {
  const c = runtime();
  const cards = ['U', 'M', 'A', 'T', 'L'];
  const hp = [13073, 16487, 11900, 16559, 8565];
  c.buildRuntimeCharacter = i => ({ hp: hp[i] });
  const failures = [];
  for (const g of observations.burnWater) {
    const s = state();
    if (g.challenge_rate) hp.forEach((_, cardIndex) => s.burns.push({ cardIndex, rate: g.challenge_rate * 100, turns: 1 }));
    g.normal_enemy_burn_cards.forEach(card => s.burns.push({ cardIndex: cards.indexOf(card), rate: 16, turns: 1 }));
    const actual = c.applyBurnDamage(s, 100000);
    if (actual !== g.values[0]) failures.push({ time: g.times[0], expected: g.values[0], actual });
  }
  results.push({ dataset: 'water burn', events: 36, failures });
  assert.deepEqual(failures.slice(0, 3), []);
});
test('無DF: observed continuous heals (1960, 1944, 2301, 4121)', () => {
  const c = runtime();
  const hp = [13073, 12965, 15340, 16487];
  c.buildRuntimeCharacter = i => ({ hp: hp[i] });
  const s = state();
  s.playerContinueHeals = hp.map((_, cardIndex) => ({ cardIndex, rate: cardIndex === 3 ? .25 : .15, turns: 3, source: 'video' }));
  const actual = c.applyPlayerContinueHeal(s, 50000).details.map(d => d.amount);
  results.push({ dataset: 'neutral continuous heal', expected: [1960, 1944, 2301, 4121], actual: [...actual] });
  assert.deepEqual([...actual], [1960, 1944, 2301, 4121]);
});
test('無DF: observed instant heals (Azul 6633, Ortho 6150)', () => {
  const c = runtime();
  c.buildRuntimeBuffs = () => [{ magicOption: 'M1', buffOption: '回復', powerOption: '小', levelOption: 10 }];
  const actual = [6030, 5591].map(atk => {
    c.buildRuntimeCharacter = () => ({ atk });
    return c.calculatePlayerHeal('0-M1', state());
  });
  results.push({ dataset: 'neutral instant heal', expected: [6633, 6150], actual });
  assert.deepEqual(actual, [6633, 6150]);
});
test('configured 2T/3T/5T/10T challenge durations and dorm exclusions', () => {
  const c = runtime();
  for (const id of ['火BS', '水BS', '木DF', '無DF', '全ATK']) {
    for (const challenge of presetFor(id).specialChallenges) {
      for (const effect of challenge.effects) {
        const s = state();
        c.charaDormMap.fixture = 'その他';
        c.applySpecialChallengeEffect(effect, s);
        const entries = () => Object.values(s).filter(Array.isArray).flat();
        assert.equal(entries().length, 1);
        for (let t = 1; t < effect.duration; t++) {
          c.tickTimedEffects(s);
          assert.equal(entries().length, 1);
        }
        c.tickTimedEffects(s);
        assert.equal(entries().length, 0);
        if (effect.dorm) {
          c.charaDormMap.fixture = effect.dorm;
          const exempt = state();
          c.applySpecialChallengeEffect(effect, exempt);
          assert.equal(Object.values(exempt).filter(Array.isArray).flat().length, 0);
        }
      }
    }
  }
});
test('video initial HP, enemy roster and observed normal buff durations match presets', () => {
  const expected = [
    ['火BS', 'BASIC', 110000, ['カリム', 'ジャミル']],
    ['水BS', 'BASIC', 112000, ['レオナ', 'ラギー', 'ジャック']],
    ['木DF', 'DEFENCE', 101000, ['イデア', 'オルト']],
    ['無DF', 'DEFENCE', 86000, ['アズール', 'ジェイド', 'フロイド']],
    ['全ATK', 'ATTACK', 222000, ['マレウス', 'リリア', 'シルバー', 'セベク']],
  ];
  for (const [id, kind, hp, names] of expected) {
    const preset = presetFor(id);
    assert.equal(preset.kind, kind);
    assert.equal(preset.enemyHp, hp);
    assert.deepEqual([...preset.enemies.map(e => e.name)], names);
    for (const enemy of preset.enemies) {
      assert.equal(enemy.actions.length, 3);
      for (const action of enemy.actions) {
        if (action.effectKind === 'atkUp' && !action.fixedOrder) assert.equal(action.duration, 1);
        if (action.effectKind === 'damageUp') {
          if (id === '木DF') assert.ok(action.duration >= 3, 'video establishes at least 3T, not exact expiration');
          else assert.equal(action.duration, ['ジェイド', 'セベク'].includes(enemy.name) ? 1 : 3);
        }
      }
    }
  }
});
test('火BS: Jamil recovery restores the observed 5243 HP', () => {
  const c = runtime();
  const action = presetFor('火BS').enemies.find(e => e.name === 'ジャミル').actions.find(a => a.effectKind === 'heal');
  assert.ok(action);
  assert.equal(c.applyEnemySelfEffects({ ...action, slotKey: 'ジャミル' }, state(), 50000, 110000, {}), 5243);
});
test('無DF: 5T fixed pair, shared ATK and stacked buffs match observed recipients', () => {
  const c = runtime();
  const p = presetFor('無DF');
  const azul = { ...p.enemies[0].actions.find(a => a.fixedOrder === 9), slotKey: 'アズール' };
  const jade = { ...p.enemies[1].actions.find(a => a.fixedOrder === 10), slotKey: 'ジェイド' };
  assert.equal(azul.power, '3連撃(強)');
  assert.equal(jade.power, '2連撃(強)');
  const s = state();
  c.applyEnemySelfEffects(azul, s, 86000, 86000, {}, jade);
  c.applyEnemySelfEffects(jade, s, 86000, 86000, {}, azul);
  assert.equal(c.sumRatesForEnemy(s.enemyAttackUps, 'アズール'), 64);
  assert.equal(c.sumRatesForEnemy(s.enemyAttackUps, 'ジェイド'), 32);
  assert.equal(c.sumRatesForEnemy(s.enemyAttackUps, 'フロイド'), 0);
  c.enemySlots.value = p.enemies.map(e => ({ id: e.name, name: e.name,
    actions: e.actions.map((a, i) => ({ ...a, id: String(i) })) }));
  for (let seed = 0; seed < 100; seed++) {
    const deck = c.buildEnemyActionDeck(c.createRng(String(seed)), 10);
    assert.equal(deck.length, 10);
    assert.equal(deck[8].slotKey, 'アズール');
    assert.equal(deck[8].power, '3連撃(強)');
    assert.equal(deck[9].slotKey, 'ジェイド');
    assert.equal(deck[9].effectTarget, '味方選択');
  }
});
test('blindness rolls per spell; evasion rolls separately per hit, as in video', () => {
  const c = runtime();
  c.buildRuntimeCharacter = () => ({ atk: 1000, magic2Attribute: '水', magic2Power: '連撃(強)', magic2Lv: 10 });
  c.calculateRuntimeBuddyAtk = () => 0;
  c.magicById = () => ({ element: '水', power: '連撃(強)' });
  const s = state();
  s.playerBlinds.push({ cardIndex: 0, rate: 11.5, turns: 3 });
  let draws = 0;
  assert.equal(c.calculatePlayerDamage('0-M2', '火', s, () => { draws++; return 0; }, {}).damage, 0);
  assert.equal(draws, 1);
  s.playerBlinds = [];
  c.applySpecialChallengeEffect(challengeEffects(presetFor('火BS'), ['enemyEvasion:2'])[0], s);
  const rolls = [0, .99, .5];
  const partial = c.calculatePlayerDamage('0-M2', '火', s, () => rolls.shift(), {});
  assert.equal(partial.evasionCount, 1);
  assert.ok(partial.damage > 0);
  assert.equal(observations.evasion.evaded, 11);
  assert.equal(observations.evasion.attempts, 119);
});
after(() => {
  if (process.env.EXAM19_AUDIT_REPORT) fs.writeFileSync(process.env.EXAM19_AUDIT_REPORT,
    JSON.stringify({ scope: 'Saved video observations, production damage functions; not full battle RNG replay', results }, null, 2));
});
