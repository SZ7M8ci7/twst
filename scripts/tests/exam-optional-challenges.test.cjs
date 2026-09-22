const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const root = path.resolve(__dirname, '../..');
const cache = new Map();
function load(relative) {
  if (cache.has(relative)) return cache.get(relative);
  const module = { exports: {} };
  cache.set(relative, module.exports);
  const code = ts.transpileModule(fs.readFileSync(path.join(root, relative), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2021, esModuleInterop: true },
  }).outputText;
  const localRequire = id => id.startsWith('@/') ? load(`src/${id.slice(2)}.ts`) : require(id);
  vm.runInNewContext(code, { module, exports: module.exports, require: localRequire, performance, setTimeout, MessageChannel });
  cache.set(relative, module.exports);
  return module.exports;
}
const variants = load('src/domain/examSearch/variants.ts');
const generation = load('src/domain/examSearch/candidateGenerator.ts');
const { examPresetDefinitions } = load('src/utils/examPresets.ts');
const catalog = Object.fromEntries(require('../../src/assets/chara.json').map(card => [card.name, card]));
const clone = value => JSON.parse(JSON.stringify(value));
function fixture() {
  const names = Object.values(catalog).filter(card => card.rare === 'SSR').slice(0, 4).map(card => card.name);
  const card = name => ({ name, totsu: 0, level: 80, magicLevels: [10, 10, 10], buddyLevels: [10, 10, 10], allowUpgrade: true });
  const preset = clone(examPresetDefinitions.find(preset => preset.specialChallenges?.length));
  preset.difficulty = 1.5;
  return { preset, roster: names.map(card), supports: [card(names[0])], budget: 0, itemsPerLimitBreak: 1,
    target: 45000, attempts: 30, desiredProbability: .8, tolerance: 500, challengeLocks: {}, maxRemoved: 1 };
}

test('a unified exam with all challenges disabled validates and generates teams with a support', () => {
  const input = fixture();
  input.challengeLocks = Object.fromEntries(input.preset.specialChallenges.map(challenge => [challenge.id, 'off']));
  assert.equal(variants.validateInput(input, catalog), null);
  assert.deepEqual(clone(variants.challengeVariants(input)), [[]]);
  const tasks = generation.buildTasks(input, catalog);
  assert.ok(tasks.length);
  assert.ok(tasks.every(task => task.challenges.length === 0));
  const candidates = generation.generateCandidates(input, tasks[0], catalog);
  assert.ok(candidates.length);
  for (const candidate of candidates) {
    assert.equal(candidate.cards.length, 5);
    assert.equal(candidate.cards.filter(card => card.support).length, 1);
  }
});

test('automatic removal can reach zero challenges while preserving mandatory locks', () => {
  const input = fixture();
  input.preset.specialChallenges = input.preset.specialChallenges.slice(0, 2);
  const [first, second] = input.preset.specialChallenges.map(challenge => challenge.id);
  assert.deepEqual(clone(variants.challengeVariants(input)), [[first, second], [second], [first]]);
  input.maxRemoved = 2;
  assert.ok(variants.challengeVariants(input).some(set => set.length === 0));
  input.challengeLocks = { [first]: 'on' };
  assert.deepEqual(clone(variants.challengeVariants(input)), [[first, second], [first]]);
  input.challengeLocks = { [first]: 'off' };
  assert.deepEqual(clone(variants.challengeVariants(input)), [[second], []]);
});
