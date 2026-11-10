const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const root = path.resolve(__dirname, '../../..');
const modules = new Map();
function load(relative) {
  if (modules.has(relative)) return modules.get(relative);
  const module = { exports: {} };
  const code = ts.transpileModule(fs.readFileSync(path.join(root, relative), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2021, esModuleInterop: true },
  }).outputText;
  vm.runInNewContext(code, { module, exports: module.exports, require: id => {
    if (id.startsWith('@/')) return load(`src/${id.slice(2)}.ts`);
    if (id.startsWith('.')) return load(path.relative(root, path.resolve(root, path.dirname(relative), `${id}.ts`)));
    return require(id);
  }});
  modules.set(relative, module.exports);
  return module.exports;
}
const source = fs.readFileSync(path.join(root, 'src/views/examSimulator.vue'), 'utf8')
  .match(/<script setup[^>]*>([\s\S]*?)<\/script>/)[1];
const ast = ts.createSourceFile('exam.ts', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
const constants = ['stateArrayOwnershipBits', 'curseRatePowerScale', 'freezeRatePowerScale', 'blindRatePowerScale'];
const declarations = ast.statements.filter(n =>
  ts.isFunctionDeclaration(n) && !n.getText(ast).includes('import.meta') ||
  ts.isVariableStatement(n) && n.declarationList.declarations.some(d => constants.includes(d.name.getText(ast))))
  .map(n => n.getText(ast)).join('\n');
const code = ts.transpileModule(declarations, { compilerOptions: { target: ts.ScriptTarget.ES2021 } }).outputText;
const keys = ['playerAttackDowns', 'playerDamageDowns', 'playerEvasions', 'enemyDamageReductions', 'enemyDamageNulls',
  'enemyEvasions', 'enemyCriticals', 'enemyAttackDowns', 'enemyDamageDowns', 'enemyDamageTakenUps', 'enemyCurses',
  'enemyBlinds', 'enemyFreezes', 'playerBlinds', 'playerCurses', 'playerFreezes', 'burns', 'playerDamageTakenDowns',
  'playerDamageTakenUps', 'playerContinueHeals', 'playerImmunities', 'playerGuts', 'playerBuffs', 'enemyAttackUps',
  'enemyDamageUps', 'enemyGuts', 'enemyContinueHeals'];
function runtime() {
  const c = { ...load('src/utils/calculations.ts'), ...load('src/utils/enemyActionDeck.ts'), simulationRuntimeCache: null,
    favorableEffects: { value: false }, fixedEnemyActionElement: { value: null },
    exam: { value: { kind: 'DEFENCE', difficulty: 1.5 } }, enemySlots: { value: [] },
    deck: { value: [{ character: { chara: 'fixture' } }] }, charaDormMap: { fixture: 'その他' },
    totalDeckHp: { value: 100000 }, resourceImportanceWeight: undefined,
    resourceCriticalScoutCard: undefined, resourceCriticalScoutMagic: undefined, resourceCriticalScoutHits: 0,
    CRITICAL_DAMAGE_MULTIPLIER: 1.5, criticalRatePowerScale: { 小: 20 },
  };
  vm.createContext(c);
  vm.runInContext(code, c);
  return c;
}
module.exports = { root, load, runtime, state: () => Object.fromEntries(keys.map(k => [k, []])) };
