interface AttackExamStats {
  enemyMaxHp: number;
  playerDamage: number;
  scoreBuff: number;
  healBlock: number;
  advantageCombo: number;
  equalCombo: number;
  disadvantageCombo: number;
  advantageSingle: number;
  equalSingle: number;
  disadvantageSingle: number;
}

// 整数のHP・与ダメージで端数を正確に保持し、整数点を切り捨てで1点失うのを防ぐ。
const pointScale = 10_000_000;
const baseUnitsPerHp = Math.round(0.080448 * pointScale);
const penaltyUnitsPerHp = Math.round(0.0020424 * pointScale);
const unitsPerDamage = Math.round(0.0048 * pointScale);

interface AttackExamBreakdown {
  score: number;
  subtotal: number;
  basic: number;
  actionCount: number;
  actionPenalty: number;
  damage: number;
  buff: number;
  healBlock: number;
  advantageCombo: number;
  equalCombo: number;
  disadvantageCombo: number;
  advantageSingle: number;
  equalSingle: number;
  disadvantageSingle: number;
}

export function calculateAttackExamScore(stats: AttackExamStats, difficulty: number, challengeScore?: number): AttackExamBreakdown;
export function calculateAttackExamScore(stats: AttackExamStats, difficulty: number, challengeScore: number, mode: 'score'): number;
export function calculateAttackExamScore(stats: AttackExamStats, difficulty: number, challengeScore = 0, mode?: 'score') {
  const hp = Number.isFinite(stats.enemyMaxHp) ? stats.enemyMaxHp : 0;
  const actionCount = stats.advantageCombo + stats.equalCombo + stats.disadvantageCombo
    + stats.advantageSingle + stats.equalSingle + stats.disadvantageSingle;

  // 木属性4難易度の実測に合わせた推定式。HP係数は最終スコアを切り捨てる前提の値。
  const basicUnits = 11040 * pointScale + hp * baseUnitsPerHp;
  const penaltyUnits = actionCount * (642 * pointScale + hp * penaltyUnitsPerHp);
  const damageUnits = stats.playerDamage * unitsPerDamage;
  const buff = stats.scoreBuff * 120;
  const healBlock = Math.min(1, stats.healBlock) * 180;
  const advantageCombo = stats.advantageCombo * 210;
  const equalCombo = stats.equalCombo * 180;
  const disadvantageCombo = stats.disadvantageCombo * 150;
  const advantageSingle = stats.advantageSingle * 150;
  const equalSingle = stats.equalSingle * 120;
  const disadvantageSingle = stats.disadvantageSingle * 90;
  const bonuses = buff + healBlock
    + advantageCombo + equalCombo + disadvantageCombo + advantageSingle + equalSingle + disadvantageSingle;
  const subtotalUnits = basicUnits - penaltyUnits + damageUnits + bonuses * pointScale;
  // 難易度倍率（0.8・1・1.2・1.5）も整数の分子で掛けてから点に戻す。
  const score = Math.floor(subtotalUnits * (difficulty * 10) / (pointScale * 10) + challengeScore);
  if (mode === 'score') return score;
  return {
    score, subtotal: subtotalUnits / pointScale, basic: basicUnits / pointScale,
    actionCount, actionPenalty: penaltyUnits / pointScale, damage: damageUnits / pointScale, buff, healBlock,
    advantageCombo, equalCombo, disadvantageCombo, advantageSingle, equalSingle, disadvantageSingle,
  };
}
