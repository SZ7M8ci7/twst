const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

const source = fs.readFileSync(path.join(__dirname, '../../src/utils/examSimulationRecovery.ts'), 'utf8');
const exportsObject = {};
vm.runInNewContext(ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText, { exports: exportsObject });
const { normalSimulationRecovery } = exportsObject;
const summary = (reasons, positiveScoreCount = 0) => ({ count: 10, positiveScoreCount, retireReasonFrequencies: reasons });

test('failed normal runs offer recovery only when a defeat occurred', () => {
  const result = normalSimulationRecovery(summary({ '手札無し': 7, '敗北': 3 }), 'normal', false);
  assert.equal(result.defeat, true);
  assert.equal(normalSimulationRecovery(summary({ '手札無し': 10 }), 'normal', false), null);
  assert.equal(normalSimulationRecovery(summary({ '敗北': 10 }), 'normal', false).defeat, true);
});

test('recovery is hidden before completion, after any success, and outside normal mode', () => {
  const failed = summary({ '敗北': 10 });
  assert.equal(normalSimulationRecovery(null, 'normal', false), null);
  assert.equal(normalSimulationRecovery({ ...failed, count: 0 }, 'normal', false), null);
  assert.equal(normalSimulationRecovery(failed, 'normal', true), null);
  assert.equal(normalSimulationRecovery(failed, 'autoBest', false), null);
  assert.equal(normalSimulationRecovery(summary({ '敗北': 9 }, 1), 'normal', false), null);
});

test('other failure reasons do not produce a warning', () => {
  assert.equal(normalSimulationRecovery(summary({ 'その他': 10 }), 'normal', false), null);
});
