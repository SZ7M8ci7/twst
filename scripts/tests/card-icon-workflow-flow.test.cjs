const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');
const yaml = require('js-yaml');

// This evaluates only the small condition grammar used by these workflows.
// No shell command, action, commit, dispatch, or deployment is executed.
function condition(input, outcomes, conclusions, cancelled) {
  let expression = (input || 'success()').replace(/^\$\{\{\s*|\s*\}\}$/g, '');
  const hasStatus = /(?:success|failure|always|cancelled)\(\)/.test(expression);
  if (!hasStatus && (cancelled || conclusions.includes('failure'))) return false;
  expression = expression.replace(/steps\.([\w-]+)\.(outcome|conclusion)/g,
    (_, id, prop) => JSON.stringify((outcomes[id] || {})[prop] || ''));
  expression = expression.replace(/success\(\)/g, String(!cancelled && !conclusions.includes('failure')))
    .replace(/failure\(\)/g, String(conclusions.includes('failure')))
    .replace(/always\(\)/g, 'true').replace(/cancelled\(\)/g, String(cancelled));
  const tokens = expression.match(/"[a-z]*"|'[a-z]*'|true|false|&&|\|\||==|!=|!|\(|\)/g) || [];
  assert.equal(tokens.join(''), expression.replace(/\s/g, ''), 'Unsupported workflow condition');
  // All tokens are now validated boolean/string literals and operators.
  return Function('return (' + tokens.join(' ') + ')')();
}

function simulate(steps, failures = [], cancelled = false) {
  const outcomes = {}, conclusions = [], executed = [];
  for (const step of steps) {
    if (!condition(step.if, outcomes, conclusions, cancelled)) {
      if (step.id) outcomes[step.id] = { outcome: 'skipped', conclusion: 'skipped' };
      continue;
    }
    executed.push(step.name || step.uses);
    const fails = failures.includes(step.id) || failures.includes(step.name) || /^Fail visibly/.test(step.name || '');
    const outcome = fails ? 'failure' : 'success';
    const conclusion = fails && step['continue-on-error'] === true ? 'success' : outcome;
    conclusions.push(conclusion);
    if (step.id) outcomes[step.id] = { outcome, conclusion };
  }
  return { executed, failed: conclusions.includes('failure'), outcomes };
}

const root = path.resolve(__dirname, '../..');
const cases = [
  { root, file: 'clone-simu.yml', failures: ['icons'], expected: ['Commit and push changes to twst repository', 'Trigger deploy workflow'] },
  { root, file: 'deploy.yml', failures: ['icons'], expected: ['Build', 'Deploy'] },
];
if (process.env.SIMULATOR_WORKFLOW_ROOT) {
  cases.push(
    { root: process.env.SIMULATOR_WORKFLOW_ROOT, file: 'get_img.yml', failures: ['download', 'icons'], expected: ['Generate and validate icons', 'Commit verified images'] },
    { root: process.env.SIMULATOR_WORKFLOW_ROOT, file: 'make_icon.yml', failures: ['icons'], expected: ['Commit verified icons'] },
  );
}
for (const entry of cases) {
  const workflow = yaml.load(fs.readFileSync(path.join(entry.root, '.github/workflows', entry.file), 'utf8'));
  const steps = Object.values(workflow.jobs)[0].steps;
  test(entry.file + ': unresolved card does not block partial publication and is reported last', () => {
    for (const id of entry.failures) assert.equal(steps.find(s => s.id === id)['continue-on-error'], true);
    const result = simulate(steps, entry.failures);
    for (const name of entry.expected) assert.ok(result.executed.includes(name), name + ' should execute');
    assert.match(result.executed.at(-1), /^Fail visibly/);
    assert.equal(result.failed, true);
    assert.ok(result.executed.some(n => /^Retain/.test(n)), 'report should be retained');
  });
  test(entry.file + ': complete assets finish successfully', () => {
    const result = simulate(steps);
    for (const name of entry.expected) assert.ok(result.executed.includes(name));
    assert.equal(result.failed, false);
    assert.ok(!result.executed.some(n => /^Fail visibly/.test(n)));
  });
  test(entry.file + ': cancellation does not publish', () => {
    const result = simulate(steps, [], true);
    for (const name of entry.expected) assert.ok(!result.executed.includes(name));
  });
}
const deploy = yaml.load(fs.readFileSync(path.join(root, '.github/workflows/deploy.yml'), 'utf8'));
test('deploy: a genuine build failure still blocks deployment', () => {
  const result = simulate(Object.values(deploy.jobs)[0].steps, ['Build']);
  assert.ok(!result.executed.includes('Deploy'));
  assert.equal(result.failed, true);
});
const sync = yaml.load(fs.readFileSync(path.join(root, '.github/workflows/clone-simu.yml'), 'utf8'));
test('sync: a failed commit/push does not dispatch deployment', () => {
  const result = simulate(Object.values(sync.jobs)[0].steps, ['Commit and push changes to twst repository']);
  assert.ok(!result.executed.includes('Trigger deploy workflow'));
  assert.equal(result.failed, true);
});
