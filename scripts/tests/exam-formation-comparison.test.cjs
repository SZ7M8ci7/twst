const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const root = path.resolve(__dirname, '../..'), cache = new Map();
function load(relative) {
  if (cache.has(relative)) return cache.get(relative);
  const module = { exports: {} };
  const code = ts.transpileModule(fs.readFileSync(path.join(root, relative), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2021 },
  }).outputText;
  vm.runInNewContext(code, { module, exports: module.exports, setTimeout, setImmediate,
    require: id => id.startsWith('@/') ? load(`src/${id.slice(2)}.ts`) : id.startsWith('.')
      ? load(path.relative(root, path.resolve(root, path.dirname(relative), `${id}.ts`))) : require(id) });
  cache.set(relative, module.exports); return module.exports;
}
const { comparisonCandidate, comparisonSummary, comparisonScoreRange, comparisonHistogram, runComparison } = load('src/domain/examSearch/comparison.ts');
const { COMPARISON_EVALUATION_SAMPLES, COMPARISON_CDF_ERROR, COMPARISON_CONFIDENCE, MAX_COMPARISON_ENTRIES, comparisonCdfError } = load('src/domain/examSearch/sampling.ts');
const clone = value => JSON.parse(JSON.stringify(value));
const catalog = Object.fromEntries(Array.from({ length: 5 }, (_, i) => [`card${i}`, { rare: 'SSR' }]));
function entry(id = 'a') {
  return { id, label: id, candidate: { id, cards: Array.from({ length: 5 }, (_, i) => ({
    name: `card${i}`, level: 80, totsu: 0, originalTotsu: 0, selectedMagic: [1, 2], support: false,
    magicLevels: [10, 10, 10], buddyLevels: [10, 10, 10], allowUpgrade: true,
  })), policy: 'effects', challengeIds: ['challenge'], cost: 1, estimate: 0 } };
}
function request(entries = [entry(), entry('b')]) {
  return { entries, nonce: 'test', input: {
    preset: { kind: 'BASIC', specialChallenges: [{ id: 'challenge' }] }, roster: clone(entries[0].candidate.cards), supports: [], budget: 1, additionalLevelCap: 5,
    target: 0, attempts: 30, desiredProbability: .05, itemsPerLimitBreak: 1, challengeLocks: { challenge: 'on' }, maxRemoved: 1,
  } };
}
test('temporary training is isolated and losing M3 removes an illegal learned plan', () => {
  const original = entry(); original.candidate.cards[0].selectedMagic = [1, 3]; original.candidate.preferredPlan = [['0-M3', '1-M1']];
  const before = clone(original), normalized = comparisonCandidate(original, catalog);
  assert.deepEqual(clone(original), before);
  assert.deepEqual(clone(normalized.cards[0].selectedMagic), [1, 2]);
  assert.equal(normalized.preferredPlan, undefined);
  normalized.cards[0].magicLevels[0] = 1;
  assert.equal(original.candidate.cards[0].magicLevels[0], 10);
  original.candidate.cards[0].level = 101;
  assert.throws(() => comparisonCandidate(original, catalog), /レベル/);
});
test('level validation follows rarity and current limit breaks without a separate cap setting', () => {
  for (const [rare, base] of [['SSR', 100], ['SR', 70], ['R', 50]]) {
    const source = entry(), localCatalog = { ...catalog, card0: { rare } };
    for (let totsu = 0; totsu <= 4; totsu++) {
      source.candidate.cards[0].totsu = totsu;
      source.candidate.cards[0].level = base + totsu * 5;
      assert.doesNotThrow(() => comparisonCandidate(source, localCatalog));
      source.candidate.cards[0].level++;
      assert.throws(() => comparisonCandidate(source, localCatalog), /レベル/);
    }
  }
});
test('charts exclude zero scores but statistics and percentages include all trials', () => {
  const samples = { scores: [0, 100, 200, 300], retired: 1, turns: 16 };
  const stats = comparisonSummary(samples);
  assert.equal(stats.mean, 150);
  assert.equal(stats.median, 150); assert.equal(stats.p95, 300); assert.equal(stats.retired, .25);
  const hist = comparisonHistogram([{ samples }, { samples: { scores: [0, 300], retired: 1, turns: 8 } }], 4);
  assert.deepEqual(clone(comparisonScoreRange([{ samples }])), { min: 100, max: 300 });
  assert.equal(hist.labels[0], '100–150');
  assert.deepEqual(clone(hist.values[0]), [25, 25, 0, 25]);
  assert.deepEqual(clone(hist.values[1]), [0, 0, 0, 50]);
  assert.equal(comparisonSummary({ scores: [], retired: 0 }).n, 0);
});

test('all-zero results and empty results produce no plotted score data', () => {
  const results = [{ samples: { scores: [0, 0], retired: 2, turns: 8 } }];
  assert.equal(comparisonScoreRange(results), null);
  assert.deepEqual(clone(comparisonHistogram(results).labels), []);
  assert.deepEqual(clone(comparisonHistogram(results).values), [[]]);
  assert.equal(comparisonScoreRange([]), null);
  assert.deepEqual(clone(comparisonHistogram([]).values), []);
});
test('comparison defaults to 10000 trials and error bounds depend on the chosen count', () => {
  assert.equal(COMPARISON_EVALUATION_SAMPLES, 10000);
  assert.ok(comparisonCdfError(COMPARISON_EVALUATION_SAMPLES, 6) > .01);
  const n = 32768;
  assert.ok(2 * MAX_COMPARISON_ENTRIES * Math.exp(-2 * n * COMPARISON_CDF_ERROR ** 2) <= 1 - COMPARISON_CONFIDENCE);
  assert.ok(comparisonCdfError(n, 6) < .01);
  assert.ok(comparisonCdfError(1000, 6) > .05);
  assert.ok(comparisonCdfError(n, 6) > comparisonCdfError(n, 2));
  assert.equal(comparisonCdfError(0, 6), 1);
});
test('re-search inherits the source objective and shared challenges, then evaluates equal fresh seed sets', async () => {
  const req = request();
  req.input.target = 100;
  req.entries[1].candidate.challengeIds = ['legacy-variation'];
  const before = clone(req), complete = [], evaluationSeeds = [[], []];
  let active, team = -1;
  const engine = { prepare: async (_input, candidate) => { active = candidate; }, trial(seed, policy) {
    // A rare very high score must lose to a reliably attained target.
    if (seed.includes(':evaluation:')) {
      evaluationSeeds[team].push(seed);
      const n = Number(seed.split(':').at(-1));
      return { score: 200, retired: n % 4 === 0, finishTurn: 4 };
    }
    return { score: policy === 'reserve' ? 150 : Number(seed.split(':').at(-1)) % 8 === 0 ? 1000 : 0, retired: false, finishTurn: 4 };
  } };
  await runComparison(req, catalog, engine, p => { team = p.index; }, r => complete.push(clone(r)));
  assert.equal(complete.length, 2);
  assert.ok(complete.every(r => r.candidate.policy === 'reserve'));
  assert.ok(complete.every(r => r.samples.scores.length === COMPARISON_EVALUATION_SAMPLES && r.samples.retired === COMPARISON_EVALUATION_SAMPLES / 4));
  assert.deepEqual(evaluationSeeds[0], evaluationSeeds[1]);
  assert.ok(evaluationSeeds[0].every(seed => seed.includes(':evaluation:')));
  assert.deepEqual(req, before);
  assert.ok(complete.every(result => JSON.stringify(result.candidate.challengeIds) === '["challenge"]'));
});
test('newly unlocked M3 is searched while fixed levels and support assignments stay intact', async () => {
  const e = entry(); e.candidate.cards[0].totsu = 3; e.candidate.cards[0].support = true;
  const prepared = [], complete = [];
  await runComparison(request([e]), catalog, { prepare: async (_input, c) => prepared.push(clone(c)),
    trial: () => ({ score: 200, retired: false, finishTurn: 4 }) }, () => {}, r => complete.push(r));
  assert.ok(prepared.some(c => c.cards[0].selectedMagic.includes(3)));
  assert.ok(prepared.every(c => c.cards[0].support && c.cards[0].level === 80 && c.cards[0].totsu === 3));
  assert.equal(complete.length, 1);
});
test('cancellation never publishes a partially evaluated team', async () => {
  let stop = false, completed = 0;
  await runComparison(request(), catalog, { prepare: async () => {}, trial: () => ({ score: 0, retired: true, finishTurn: 1 }) },
    p => { if (p.phase === 'validate' && p.done === 32) stop = true; }, () => completed++, () => stop);
  assert.equal(completed, 0);
});
test('invalid comparison settings fail before touching the battle engine', async () => {
  const req = request(); req.entries[1].candidate.cards[0].level = 121;
  await assert.rejects(runComparison(req, catalog, { prepare: () => assert.fail('must not prepare') }, () => {}, () => {}), /レベル/);
});

test('requested trial counts apply equally to every team and progress totals', async () => {
  for (const count of [1, 65]) {
    const req = { ...request(), evaluationSamples: count }, completed = [], progress = [];
    const seeds = [[], []];
    let team = 0;
    await runComparison(req, catalog, {
      prepare: async () => {},
      trial: seed => {
        if (seed.includes(':evaluation:')) seeds[team].push(seed);
        return { score: 200, retired: false, finishTurn: 4 };
      },
    }, p => { team = p.index; if (p.phase === 'validate') progress.push(p); }, r => completed.push(r));
    assert.equal(completed.length, 2);
    assert.ok(completed.every(r => r.samples.scores.length === count));
    assert.deepEqual(seeds[0], seeds[1]);
    assert.ok(progress.every(p => p.total === count));
    assert.equal(progress.at(-1).done, count);
  }
});

test('invalid trial counts fail before simulation starts', async () => {
  for (const count of [0, -1, 1.5, NaN, Infinity, 1000001]) {
    await assert.rejects(runComparison({ ...request(), evaluationSamples: count }, catalog,
      { prepare: () => assert.fail('must not prepare') }, () => {}, () => {}), /試行回数/);
  }
});
