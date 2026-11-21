const assert = require('node:assert/strict');
const { test } = require('node:test');
const { buildSync } = require('esbuild');
const path = require('node:path');

function loadSearchModule(name) {
  const api = {};
  const bundle = buildSync({ entryPoints: [path.join(__dirname, '../../src/domain/examSearch', name + '.ts')],
    bundle: true, format: 'cjs', write: false });
  new Function('module', bundle.outputFiles[0].text)(api);
  return api.exports;
}
const { benchmarkWinner, summarizeBenchmark, groupBenchmarkPresets } = loadSearchModule('benchmark');

test('fixed benchmark work counts candidates and validation battles independently of elapsed time', async (t) => {
  const { SearchSession } = loadSearchModule('scheduler');
  const { BENCHMARK_ISLANDS, benchmarkIslandWork } = loadSearchModule('benchmarkWork');
  const preset = { title: '2026/11-2全BS', kind: 'BASIC', enemyElement: '全', enemyHp: 100000, difficulty: 1.5, enemies: [] };
  for (const [depth, expected, trials] of [['standard', 208, 576], ['thorough', 643, 1536]]) {
    const partitions = Array.from({ length: BENCHMARK_ISLANDS }, (_, i) => benchmarkIslandWork(preset, depth, i));
    assert.equal(partitions.reduce((sum, part) => sum + part.candidates, 0), expected);
    assert.ok(partitions.every(part => part.validationTrials === trials));
  }
  const cards = require('../../src/assets/chara.json').filter(c => c.rare === 'SSR').slice(0, 10);
  const catalog = Object.fromEntries(cards.map(c => [c.name, c]));
  const roster = cards.map(c => ({ name: c.name, totsu: 0, level: 80, magicLevels: [10,10,10], buddyLevels: [10,10,10] }));
  const input = { preset, roster, supports: [], budget: 0, itemsPerLimitBreak: 1, attempts: 30,
    target: 0, tolerance: 0, desiredProbability: .05, challengeLocks: {}, maxRemoved: 1 };
  let clock = 0;
  t.mock.method(performance, 'now', () => clock);
  async function measure(millisecondsPerBattle) {
    const engine = {
      async prepare() {},
      trial() { clock += millisecondsPerBattle; return { score: 500, retired: false, finishTurn: 4 }; },
      async learnPlan(_seed, budget) { assert.ok(budget.nodes > 0); return null; },
    };
    const session = new SearchSession(input, catalog, engine, 'same-seed');
    await session.run({ candidates: 24, validationTrials: 96 }, () => {});
    const { evaluatedCount, finalists, trialSerial } = session.checkpoint();
    assert.equal(evaluatedCount, 24);
    assert.ok(finalists.length > 0);
    assert.ok(finalists.every(r => r.validation.scores.length === 96));
    return { trialSerial, ids: finalists.map(r => r.candidate.id) };
  }
  const fast = await measure(1);
  assert.deepEqual(await measure(1000), fast);
});

test('each series, kind and element has its own latest preset', () => {
  const presets = ['第9回統一', '第12回統一', '第10回統一', '第11回統一', '2026/10-1'].map(title =>
    ({ title, kind: 'BASIC', enemyElement: '火' }));
  presets.push({ ...presets[0], kind: 'ATTACK' }, { ...presets[0], enemyElement: '全' });
  const groups = groupBenchmarkPresets(presets);
  assert.equal(groups.size, 4);
  assert.equal(groups.get('unified/BASIC/火')[0].title, '第12回統一');
  assert.equal(groups.get('normal/BASIC/火').length, 1);
  assert.equal(groups.get('unified/ATTACK/火').length, 1);
  assert.equal(groups.get('unified/BASIC/全').length, 1);
});

function finalist(id, scores, names = [id]) {
  return { candidate: { id, cards: names.map((name, i) => ({ name, support: i === 4, selectedMagic: [1, 2] })) },
    validation: { scores }, development: { scores: [99999] } };
}

test('winners use observed validation peaks, then the trial mean including zeroes', () => {
  const peak = finalist('peak', [0, 100]);
  assert.equal(benchmarkWinner([finalist('consistent', [90, 90]), peak]).mean, 50);
  const tie = finalist('tie', [80, 100]);
  assert.equal(benchmarkWinner([peak, tie]).cards[0].name, 'tie');
  assert.equal(benchmarkWinner([tie, peak]).cards[0].name, 'tie');
  assert.equal(benchmarkWinner([finalist('untested', [])]), null);
  assert.equal(benchmarkWinner([finalist('zero', [0])]).highest, 0);
});

test('each exam has equal weight and a borrowed duplicate uses two slots in one exam', () => {
  const first = benchmarkWinner([finalist('first', [100, 0], ['A', 'B', 'C', 'D', 'A'])]);
  const second = benchmarkWinner([finalist('second', [80, 80, 80, 80], ['A', 'B', 'E', 'F', 'G'])]);
  const summary = summarizeBenchmark([first, second]);
  assert.equal(summary.meanHighest, 90);
  assert.equal(summary.meanScore, 65);
  assert.deepEqual(summary.ranking.slice(0, 2), [
    { name: 'A', slots: 3, exams: 2 }, { name: 'B', slots: 2, exams: 2 },
  ]);
  assert.equal(summary.ranking.reduce((a, row) => a + row.slots, 0), 10);
  assert.deepEqual(summarizeBenchmark([]), { meanHighest: null, meanScore: null, ranking: [] });
});
