const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');

test('search UI exposes expected-best results without an obsolete target-mode switch', () => {
  const view = read('src/views/examSearch.vue');
  const table = read('src/components/ExamSearchResultsTable.vue');
  assert.doesNotMatch(view, /input(?:\.value)?\.(?:target|tolerance)|auto-mode/);
  assert.doesNotMatch(table, /autoMode/);
  assert.match(table, /resultExpectedBestScore\(row\.result, attempts\)/);
  assert.match(view, /evaluatedInput\?\.attempts \?\? input\.attempts/);
});

test('obsolete target-setting translations are absent while comparison score curves remain', () => {
  for (const locale of ['ja', 'en', 'zh-CN']) {
    const text = JSON.parse(read(`src/i18n/${locale}.json`));
    for (const key of ['target', 'targetPlaceholder', 'probability', 'tolerance', 'reach', 'relaxed']) {
      assert.equal(text.examSearch[key], undefined, `${locale}: ${key}`);
    }
    assert.equal(text.examSearch.validation.target, undefined);
    assert.ok(text.examSearch.attempts);
    assert.ok(text.examSearch.table.expectedBest);
    assert.ok(text.examComparison.reach);
  }
});
