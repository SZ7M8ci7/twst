const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

// Execute the same functions used by the Vue screen and generated worker host.
// Synthetic magic metadata avoids making regression expectations depend on cards.
const source = fs.readFileSync(path.join(__dirname, '../src/views/examSimulator.vue'), 'utf8');
const script = source.match(/<script setup lang="ts">([\s\S]*?)<\/script>/)[1];
const ast = ts.createSourceFile('exam.ts', script, ts.ScriptTarget.Latest, true);
const names = [
  'calculatePlayerDamageBaseFromState', 'calculatePlayerDamage', 'calculateEnemyDamage',
  'floorAttackDamage', 'ceilDamage', 'effectProbability', 'rollEffect', 'isPlayerImmune',
  'sumRatesForCard', 'sumRatesForEnemy', 'sumDamageDownRatesForCard',
  'sumDamageRatesForElementAndEnemy', 'sumDamageTakenDownRatesForCard',
  'hasEnemyDamageNull', 'timedRateAppliesToEnemy',
];
const functions = ast.statements.filter(n => ts.isFunctionDeclaration(n) && names.includes(n.name.text));
assert.equal(functions.length, names.length);
const code = ts.transpileModule(functions.map(n => n.getText(ast)).join('\n'), {
  compilerOptions: { target: ts.ScriptTarget.ES2021 },
}).outputText;

function fixture({ atk = 10000, buddy = 0, hits = 1 } = {}) {
  const state = Object.fromEntries([
    'playerBuffs', 'playerBlinds', 'playerImmunities', 'playerAttackDowns', 'playerDamageDowns',
    'playerDamageTakenUps', 'playerDamageTakenDowns', 'playerEvasions',
    'enemyDamageReductions', 'enemyDamageTakenUps', 'enemyDamageNulls', 'enemyEvasions',
    'enemyAttackUps', 'enemyAttackDowns', 'enemyDamageUps', 'enemyDamageDowns', 'enemyBlinds', 'enemyCriticals',
  ].map(k => [k, []]));
  const context = {
    simulationRuntimeCache: null, resourceImportanceWeight: undefined, resourceCriticalScoutCard: undefined,
    favorableEffects: { value: false },
    safeNumber: x => Number(x) || 0, CRITICAL_DAMAGE_MULTIPLIER: 1.25,
    getPlayerMagicRuntimeMeta: () => ({ runtimeAtk: atk, buddyAtk: buddy, magicAttribute: '火',
      adjustedPower: '単発(強)', level: 10, magicRatio: 1, attributeAdjust: 1, rengekiMultiplier: 1 }),
    atkbuffDict: { 'ATKUP(大)10': .5, 'ATKDOWN(小)10': -.2 }, dmgbuffDict: {},
    playerAttributeMultiplier: () => 1, parseMagicId: () => ({ deckIndex: 0, magicSlot: 1 }),
    magicById: () => ({ element: '火', power: '単発(強)' }), buildRuntimeCharacter: () => ({ atk }),
    getCompatibility: () => 'equal', magicHitCount: () => hits, criticalChanceFromPower: () => 1,
    nextDamageFactor: () => 1, effectiveEnemyActionElement: () => '火',
    getEnemyActionRuntimeMeta: () => ({ baseAtk: atk, magicRatio: 1, rengekiMultiplier: 1, hitCount: hits }),
  };
  vm.createContext(context); vm.runInContext(code, context);
  const player = () => context.calculatePlayerDamage('0-M1', '火', state, () => .5, {}, false, { slotKey: 'enemy' });
  const enemy = () => context.calculateEnemyDamage({ slotKey: 'enemy' }, '0-M1', state, () => .5, { log: [] });
  return { state, context, player, enemy };
}

test('player attack truncates each hit, including critical hits', () => {
  const f = fixture({ atk: 302.7, hits: 3 });
  assert.equal(f.player().damage, 300); // 100.9 per hit, not floor(total)=302 or ceil per hit=303
  f.state.playerBuffs.push({ targetDeckIndex: 0, turns: 1, buff: { buffOption: 'クリティカル', powerOption: '極大', levelOption: 10 } });
  assert.equal(f.player().damage, 378); // floor(100.9 * 1.25) per hit
});

test('enemy attack truncates each hit and keeps the log consistent', () => {
  const f = fixture({ atk: 201.8, hits: 2 });
  const result = f.enemy();
  assert.equal(result.damage, 200);
  assert.deepEqual(Array.from(result.hitDamages), [100, 100]);
  f.state.enemyCriticals.push({ rate: 100, turns: 1 });
  assert.equal(f.enemy().damage, 252);
});

test('enemy ATK DOWN subtracts from base ATK alongside UP; transfer keeps effects separate', () => {
  const f = fixture();
  f.state.playerBuffs.push({ targetDeckIndex: 0, turns: 1, buff: { buffOption: 'ATKUP', powerOption: '大', levelOption: 10 } });
  f.state.playerAttackDowns.push({ cardIndex: 0, rate: 20, turns: 1 });
  const result = f.player();
  assert.equal(result.damage, 13000);
  assert.equal(result.transferSnapshot.atkBuffRate, 50);
  assert.equal(result.transferSnapshot.attackDownRate, 20);
  assert.equal(f.context.calculatePlayerDamageBaseFromState(f.state, '0-M1', 0, 1, '火', 0, false).damage, 13000,
    'search estimates use the same corrected base without another DOWN multiplier');
});

test('ATK DOWN uses original ATK, combines with own DOWN, and respects card/attribute targeting', () => {
  const f = fixture({ buddy: 2000 });
  f.state.playerBuffs.push({ targetDeckIndex: 0, turns: 1, buff: { buffOption: 'ATKDOWN', powerOption: '小', levelOption: 10 } });
  f.state.playerAttackDowns.push({ cardIndex: 0, rate: 20, turns: 1 },
    { cardIndex: 1, rate: 80, turns: 1 }, { cardIndex: 0, rate: 80, turns: 1, attributeOption: '水' });
  assert.equal(f.player().damage, 8000); // 10000 - 2000 - 2000 + 2000 buddy
});

test('ATK DOWN above 100% still offsets UP and only final ATK is clamped', () => {
  const f = fixture();
  f.state.playerBuffs.push({ targetDeckIndex: 0, turns: 1, buff: { buffOption: 'ATKUP', powerOption: '大', levelOption: 10 } });
  f.state.playerAttackDowns.push({ cardIndex: 0, rate: 120, turns: 1 });
  assert.equal(f.player().damage, 3000);
  f.state.playerAttackDowns[0].rate = 200;
  assert.equal(f.player().damage, 0);
});

test('blocked attacks stay zero and attack/ceiling helpers retain their rounding', () => {
  const f = fixture();
  f.state.enemyDamageNulls.push({ rate: 100, turns: 1 });
  assert.equal(f.player().damage, 0);
  f.state.enemyDamageNulls = [];
  f.state.playerBlinds.push({ cardIndex: 0, rate: 100, turns: 1 });
  assert.equal(f.player().damage, 0);
  assert.equal(f.context.ceilDamage(100.9), 101);
  assert.equal(f.context.floorAttackDamage(100.9), 100);
  assert.equal(f.context.floorAttackDamage(-1), 0);
});

function fixedFinisherFixture({hits=3, chance=.2}={}) {
  const f = fixture({ atk: 300, hits });
  f.context.criticalChanceFromPower = () => chance;
  f.state.playerBuffs.push({ targetDeckIndex: 0, turns: 1,
    buff: { buffOption: 'クリティカル', powerOption: '小', levelOption: 10 } });
  let rolls=0;
  f.attack=(enabled=true, hp=360)=>f.context.calculatePlayerDamage('0-M1','火',f.state,
    ()=>{rolls++;return .9;},{},false,{slotKey:'enemy'},enabled,hp);
  f.rolls=()=>rolls;
  return f;
}
test('3-critical option changes only a critical-capable three-hit finishing attack', () => {
  const f=fixedFinisherFixture();
  assert.equal(f.attack(false).damage,300);
  assert.equal(f.attack(true,376).damage,300,'cannot finish even with three criticals');
  const result=f.attack();
  assert.equal(result.damage,375);
  assert.equal(result.criticalCount,3);
  assert.equal(result.transferSnapshot.criticalCount,3);
  assert.equal(f.rolls(),9,'ordinary critical rolls still consumed');
  for(const hits of [1,2])assert.equal(fixedFinisherFixture({hits}).attack(true,200).criticalCount,0);
  assert.equal(fixedFinisherFixture({chance:0}).attack(true,200).criticalCount,0);
});
test('3-critical finisher does not bypass guts, damage null, blindness or evasion', () => {
  const guts=fixedFinisherFixture();guts.state.enemyGuts=[{turns:1,count:1}];
  assert.equal(guts.attack().damage,300);
  const nul=fixedFinisherFixture();nul.state.enemyDamageNulls=[{rate:100,turns:1}];
  assert.equal(nul.attack().damage,0);
  const blind=fixedFinisherFixture();blind.state.playerBlinds=[{cardIndex:0,rate:100,turns:1}];
  assert.equal(blind.attack().damage,0);
  const evasion=fixedFinisherFixture();evasion.state.enemyEvasions=[{rate:100,turns:1}];
  assert.equal(evasion.attack().criticalCount,0);
});
test('3-critical finishing attacks use ordinary critical rolls in importance trials', () => {
  const f=fixedFinisherFixture();f.context.resourceImportanceWeight=1;
  f.context.criticalProposal=()=>{throw new Error('fixed finisher must not use a biased critical proposal');};
  assert.equal(f.attack().damage,375);
  assert.equal(f.context.resourceImportanceWeight,1);
});

test('common battle loop applies the option to BASIC only, including a resumed battle', () => {
  const runSource=ast.statements.find(n=>ts.isFunctionDeclaration(n)&&n.name.text==='runOneSimulation').getText(ast);
  const runCode=ts.transpileModule(runSource,{compilerOptions:{target:ts.ScriptTarget.ES2021}}).outputText;
  for(const kind of ['BASIC','ATTACK','DEFENCE'])for(const enabled of [false,true])for(const resumed of [false,true]) {
    const f=fixedFinisherFixture();
    const c=f.context;
    Object.assign(c,{
      forceFinisherTripleCritical:{value:enabled},exam:{value:{kind}},maxTurnCount:{value:1},
      totalDeckHp:{value:10000},selectedSpecialChallengeScore:{value:0},selectedSpecialChallenges:{value:[]},
      resourceInitialRuntime:undefined,resourceInitialState:undefined,resourceInitialStats:undefined,
      buildEnemyActionDeck:()=>[{slotKey:'enemy'},{slotKey:'enemy'}],
      createHandCycle:()=>({visible:['0-M1','1-M1'],hidden:[]}),effectiveEnemyMaxHp:()=>360,
      activateInitialBuddyEffects:state=>state.playerBuffs.push(...f.state.playerBuffs),
      activateInitialSpecialChallenges:()=>{},cloneSimulationState:state=>structuredClone(state),cloneSimulationStats:stats=>({...stats}),
      isValidVisiblePlayerPair:()=>true,consumeHand:state=>state,isPlayerFirstTurn:()=>true,
      activatePlayerMagicBuffs:()=>{},activatePlayerContinueHeal:()=>{},activatePlayerOpponentDebuffs:()=>{},calculatePlayerHeal:()=>0,
      isEnemySideTarget:()=>false,applyEnemySelfEffects:()=>0,applyEnemyAdditionalEffects:()=>{},
      resolveTargetElement:()=> '火',isDuoActiveForPair:()=>false,
    });
    vm.runInContext(runCode,c);
    const originalDamage=c.calculatePlayerDamage,stop=Symbol('first attack observed');
    let observed;
    // Run the real common battle-loop path up through its real first attack;
    // stop there instead of stubbing the remaining scoring/battle machinery.
    c.calculatePlayerDamage=(...args)=>{observed=originalDamage(...args);throw stop;};
    const options=resumed?{checkpoint:{turnIndex:0,enemyDeck:c.buildEnemyActionDeck(),handState:c.createHandCycle(),
      state:f.state,stats:{},enemyMaxHp:360,enemyHp:360,playerHp:10000},forcedPairAtCheckpoint:['0-M1','1-M1']}
      :{forcedPairs:[['0-M1','1-M1']]};
    assert.throws(()=>c.runOneSimulation(()=>.9,false,options),error=>error===stop);
    assert.equal(observed.criticalCount,kind==='BASIC'&&enabled?3:0,`${kind}, enabled=${enabled}, resumed=${resumed}`);
    assert.equal(observed.damage,kind==='BASIC'&&enabled?375:300);
  }
});
