const test = require('node:test');
const assert = require('node:assert/strict');
const { runtime } = require('./helpers/exam-runtime.cjs');

// Result time (seconds), HP before final spell, displayed hits including overkill,
// advantageous combos, neutral combos, advantageous singles, scoring buffs, displayed result, optional enemy healing.
function checkBattles(enemyMaxHp, difficulty, battles) {
  const simulator = runtime();
  simulator.exam.value = { kind: 'ATTACK', difficulty };
  for (const [time, remaining, hits, advantageCombo, equalCombo, advantageSingle, scoreBuff, expected, enemyHeal = 0] of battles) {
    const stats = {
      enemyMaxHp, playerDamage: enemyMaxHp + enemyHeal - remaining + hits.reduce((a, b) => a + b, 0),
      advantageCombo, equalCombo, disadvantageCombo: 0,
      advantageSingle, equalSingle: 0, disadvantageSingle: 0,
      scoreBuff, healBlock: 0, specialChallengeScore: 0,
    };
    assert.equal(simulator.calculateScore(stats), expected, `result at ${time}s`);
    assert.equal(simulator.calculateAttackExamScore(stats, difficulty).score, expected, `breakdown at ${time}s`);
  }
}

test('wood EXTRA scores in Recording-2026-11-21-141747', () => {
  checkBattles(205000, 1.5, [
    [97, 5595, [10717, 11168, 10480], 7, 1, 3, 5, 29515],
    [190, 4072, [12274, 12210, 12208], 7, 1, 3, 5, 29557],
    [270, 10721, [12866], 6, 1, 3, 4, 30433],
    [355, 14562, [10584, 10534], 7, 1, 3, 4, 29189],
    [435, 11891, [13417], 6, 1, 3, 4, 30429],
    [532, 205, [11978, 12547, 12441], 7, 1, 3, 5, 29587],
    [620, 2429, [9270, 8995], 7, 2, 3, 5, 28115],
    [732, 2402, [9362, 9102], 7, 1, 3, 5, 29437],
    [805, 11207, [13781], 6, 1, 3, 4, 30436],
    [898, 8702, [10954, 11215, 10958], 7, 1, 3, 6, 29678],
    [988, 13057, [10645, 10258, 10669], 7, 1, 3, 5, 29455],
    [1077, 22405, [7895, 7537, 8039], 7, 1, 3, 6, 29510],
    [1176, 12212, [10259, 10424, 10591], 7, 1, 3, 5, 29459],
    [1266, 9572, [10539, 10372], 7, 1, 3, 4, 29223],
    [1347, 4013, [12893], 6, 1, 3, 4, 30482],
  ]);
});

test('wood HARD scores in Recording-2026-11-21-151548', () => {
  checkBattles(163500, 1.2, [
    [75, 12771, [10613, 10572], 6, 1, 1, 3, 22993],
    [142, 12322, [15781], 5, 1, 2, 3, 22892],
    [218, 16019, [9393, 9579, 9771], 6, 1, 1, 2, 22873],
    [295, 6896, [13808, 13554], 6, 1, 1, 2, 22918],
    [370, 4597, [14664], 5, 1, 2, 3, 22930],
  ]);
});

test('wood NORMAL scores in Recording-2026-11-21-161854', () => {
  // The opening result has no corresponding battle footage.
  checkBattles(95300, 1, [
    [45, 14186, [14596], 3, 0, 1, 2, 16839],
    [93, 20387, [9652, 9468, 9297], 3, 1, 0, 1, 16786],
    [156, 3470, [10522, 10408], 4, 1, 0, 2, 16324],
  ]);
});

test('wood EASY scores in Recording-2026-11-21-163011', () => {
  // The video opens on the preceding NORMAL result, already covered above.
  checkBattles(47200, 0.8, [
    [41, 30053, [10593, 10271, 11146], 2, 0, 0, 2, 11405],
    [80, 28745, [10851, 10682, 10493], 2, 0, 0, 2, 11410],
    [140, 14454, [9439, 9649], 2, 0, 0, 2, 11415],
    [176, 26185, [10594, 10307, 11254], 2, 0, 0, 1, 11324],
    [202, 25273, [11205, 10794, 10244], 2, 0, 0, 1, 11328],
  ]);
});

test('wood EXTRA scores before and after the deck change in Recording-2026-11-21-163838', () => {
  checkBattles(205000, 1.5, [
    [90, 3095, [13619], 6, 1, 3, 4, 30494],
    [192, 7165, [14021], 6, 1, 3, 4, 30467],
    [296, 1122, [11174, 10300, 11104], 7, 1, 3, 5, 29548],
    [423, 9006, [10954], 4, 3, 2, 5, 31888],
    [520, 11594, [6421, 6792], 4, 4, 1, 5, 31931],
    [679, 9213, [6622, 6828], 4, 4, 1, 5, 31949],
  ]);
});

test('fire EXTRA scores in Recording-2026-11-21-171601', () => {
  checkBattles(211000, 1.5, [
    // The second selected spell (Leona) applies its buff before Crewel defeats the enemy.
    [132, 11725, [5370, 6761], 9, 4, 2, 5, 24697, 4149],
    [258, 16033, [10893, 11260], 11, 2, 1, 5, 26213, 4149],
    [366, 18332, [12702, 10397], 10, 2, 2, 3, 25723],
  ]);
});

test('HARD floors the final score on both sides of an exact integer', () => {
  const simulator = runtime();
  simulator.exam.value = { kind: 'ATTACK', difficulty: 1.2 };
  const stats = {
    enemyMaxHp: 163500, advantageCombo: 6, equalCombo: 0, disadvantageCombo: 0,
    advantageSingle: 0, equalSingle: 0, disadvantageSingle: 0,
    scoreBuff: 0, healBlock: 0, specialChallengeScore: 0,
  };
  for (const [playerDamage, expected] of [[165592, 24470], [165593, 24471], [165594, 24471]]) {
    assert.equal(simulator.calculateScore({ ...stats, playerDamage }), expected);
  }
});
