const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');

test('search UI preserves the original score columns without unsolicited explanations', () => {
  const view = read('src/views/examSearch.vue');
  const table = read('src/components/ExamSearchResultsTable.vue');
  assert.doesNotMatch(view, /input(?:\.value)?\.(?:target|tolerance)|auto-mode/);
  assert.doesNotMatch(table, /autoMode/);
  assert.doesNotMatch(table, /expectedBest|expected-cell|Math\.round/);
  assert.match(table, /examSearch.table.highest/);
  assert.match(table, /examSearch.table.p95/);
  assert.doesNotMatch(view, /expected-best-explanation|expectedBestExplanation/);
  assert.match(view, /rankedResults\(progress.value\?\.results \?\? \[\], evaluatedInput.value.attempts/);
});

test('obsolete target-setting translations are absent while comparison score curves remain', () => {
  for (const locale of ['ja', 'en', 'zh-CN']) {
    const text = JSON.parse(read(`src/i18n/${locale}.json`));
    for (const key of ['target', 'targetPlaceholder', 'probability', 'tolerance', 'reach', 'relaxed']) {
      assert.equal(text.examSearch[key], undefined, `${locale}: ${key}`);
    }
    assert.equal(text.examSearch.validation.target, undefined);
    assert.ok(text.examSearch.attempts);
    assert.equal(text.examSearch.table.expectedBest, undefined);
    assert.equal(text.examSearch.expectedBestExplanation, undefined);
    assert.ok(text.examComparison.reach);
  }
});
