<template>
  <div class="stats-container">
    <!-- 合計HP表示 -->
    <div class="margin">
      実質HP:<span id="totalHealHP">{{ formatNumber(totalEffectiveHP) }}</span>
      <span class="hp-breakdown">(HP:{{ formatNumber(totalHP) }}+バディ:{{ formatNumber(totalBuddyHP) }}+回復:{{ formatNumber(totalHeal) }})</span>
    </div>
    
    <!-- 合計ダメージとBasicスコア表示 -->
    <div class="margin">合計ダメージとBasic Extraスコア</div>
    <table class="damage-table">
      <thead>
        <tr>
          <th>3T</th>
          <th>4T</th>
          <th>5T</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td class="damage-cell">
            <div class="damage-value">{{ formatNumber(totalDamage3T) }} dmg</div>
            <div class="damage-breakdown">{{ midDamage3T }}</div>
          </td>
          <td class="damage-cell">
            <div class="damage-value">{{ formatNumber(totalDamage4T) }} dmg</div>
            <div class="damage-breakdown">{{ midDamage4T }}</div>
          </td>
          <td class="damage-cell">
            <div class="damage-value">{{ formatNumber(totalDamage5T) }} dmg</div>
            <div class="damage-breakdown">{{ midDamage5T }}</div>
          </td>
        </tr>
        <tr>
          <td class="score-cell">
            <span :class="getRankClass(getScoreRank(extraScores[2]))">{{ formatNumber(extraScores[2]) }}</span>
            <span :class="['score-rank', getRankClass(getScoreRank(extraScores[2]))]">({{ getScoreRank(extraScores[2]) }})</span>
          </td>
          <td class="score-cell">
            <span :class="getRankClass(getScoreRank(extraScores[3]))">{{ formatNumber(extraScores[3]) }}</span>
            <span :class="['score-rank', getRankClass(getScoreRank(extraScores[3]))]">({{ getScoreRank(extraScores[3]) }})</span>
          </td>
          <td class="score-cell">
            <span :class="getRankClass(getScoreRank(extraScores[4]))">{{ formatNumber(extraScores[4]) }}</span>
            <span :class="['score-rank', getRankClass(getScoreRank(extraScores[4]))]">({{ getScoreRank(extraScores[4]) }})</span>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useSimulatorStore } from '@/store/simulatorStore';

const props = defineProps<{
  selectedAttribute: string;
}>();

const simulatorStore = useSimulatorStore();

// HP統計
const totalHP = computed(() => 
  simulatorStore.characterStats.reduce((sum, stats) => sum + stats.hp, 0)
);

const totalBuddyHP = computed(() => 
  simulatorStore.characterStats.reduce((sum, stats) => sum + stats.buddyHP, 0)
);

const totalHeal = computed(() => 
  simulatorStore.characterStats.reduce((sum, stats) => sum + stats.heal, 0)
);

const totalEffectiveHP = computed(() => 
  totalHP.value + totalBuddyHP.value + totalHeal.value
);

// 全キャラクターの全ダメージを収集（旧シミュレータのdamageListに相当）
const damageList = computed(() => {
  const damages: number[] = [];
  
  // 選択された属性に基づいてダメージを取得
  const getAttributeDamage = (damageDetails: any) => {
    if (!damageDetails) return 0;
    
    switch (props.selectedAttribute) {
      case '対火':
        return damageDetails.fire || 0;
      case '対水':
        return damageDetails.water || 0;
      case '対木':
        return damageDetails.wood || 0;
      case '対無':
      case '対無属性':
        return damageDetails.neutral || 0;
      case '対全':
      default:
        // 対全の場合は全属性ダメージの最大値を使用（旧シミュレータの仕様）
        return Math.max(
          damageDetails.fire || 0,
          damageDetails.water || 0,
          damageDetails.wood || 0,
          damageDetails.neutral || 0
        );
    }
  };
  
  simulatorStore.deckCharacters.forEach((char) => {
    // 各キャラクターの選択されたマジックのダメージを収集
    for (let i = 1; i <= 3; i++) {
      if (char[`isM${i}Selected`]) {
        const damageDetails = char[`magic${i}DamageDetails`];
        const damage = getAttributeDamage(damageDetails);
        if (damage > 0) {
          damages.push(damage);
        }
      }
    }
  });
  
  // 降順ソート
  return damages.sort((a, b) => b - a);
});

// ダメージ計算（3T, 4T, 5T）
const totalDamage3T = computed(() => {
  return (damageList.value[0] || 0) + 
         (damageList.value[1] || 0) + 
         (damageList.value[2] || 0) + 
         (damageList.value[3] || 0) + 
         (damageList.value[4] || 0) + 
         (damageList.value[5] || 0);
});

const totalDamage4T = computed(() => {
  return totalDamage3T.value + 
         (damageList.value[6] || 0) + 
         (damageList.value[7] || 0);
});

const totalDamage5T = computed(() => {
  return totalDamage4T.value + 
         (damageList.value[8] || 0) + 
         (damageList.value[9] || 0);
});

// 中間ダメージ表示（最高ダメージを除いた値+最高ダメージ）
const midDamage3T = computed(() => {
  const highest = damageList.value[0] || 0;
  const rest = totalDamage3T.value - highest;
  return `${formatNumber(rest)}+${formatNumber(highest)}`;
});

const midDamage4T = computed(() => {
  const highest = damageList.value[0] || 0;
  const rest = totalDamage4T.value - highest;
  return `${formatNumber(rest)}+${formatNumber(highest)}`;
});

const midDamage5T = computed(() => {
  const highest = damageList.value[0] || 0;
  const rest = totalDamage5T.value - highest;
  return `${formatNumber(rest)}+${formatNumber(highest)}`;
});

// Basic試験スコア計算（calcBASICと統一）
const scoreBase = computed(() => {
  const scores = [0, 0, 0, 0, 0]; // 1T～5T
  
  // ダメージデータを収集
  const damageDataList: any[] = [];
  simulatorStore.deckCharacters.forEach((char) => {
    for (let i = 1; i <= 3; i++) {
      if (char[`isM${i}Selected`]) {
        const damageDetails = char[`magic${i}DamageDetails`];
        if (damageDetails) {
          const magicAttribute = char[`magic${i}Attribute`];
          damageDataList.push({
            vszendamage: Math.max(
              damageDetails.fire || 0,
              damageDetails.wood || 0,
              damageDetails.water || 0
            ), // 火・木・水の最大値
            vshidamage: damageDetails.fire || 0,
            vskidamage: damageDetails.wood || 0,
            vsmizudamage: damageDetails.water || 0,
            vsmudamage: damageDetails.neutral || 0,
            attribute: magicAttribute,
            duoMagic: char[`magic${i}Power`] === 'デュオ' ? 'デュオ魔法' : ''
          });
        }
      }
    }
  });
  
  // 各ターンの攻撃数を計算
  const attackCounts = [2, 4, 6, 8, 10]; // 1T～5Tの攻撃数
  
  // 選択された属性に基づいてスコア計算
  if (props.selectedAttribute === '対全') {
    // 全属性: vszendamageでソート
    const result = damageDataList.sort((a, b) => b.vszendamage - a.vszendamage);
    for (let j = 0; j < 5; j++) {
      let totalDamage = 0;
      let duoCount = 0;
      let advantageCount = 0;
      let equalCount = 0;
      let disadvantageCount = 0;
      
      for (let k = 0; k < attackCounts[j] && k < result.length; k++) {
        if (!result[k]) continue;
        
        totalDamage += result[k].vszendamage;
        
        if (result[k].duoMagic === 'デュオ魔法') {
          duoCount++;
        }
        if (result[k].attribute !== '無') {
          advantageCount++;
        } else {
          equalCount++;
        }
      }
      
      // calcBASICと同じ計算式
      scores[j] = (totalDamage - attackCounts[j] * 4.5) + 
                  duoCount * 3000 + 
                  advantageCount * 2000 + 
                  equalCount * 500 + 
                  disadvantageCount * (-1000);
    }
  } else if (props.selectedAttribute === '対火') {
    // 対火: vshidamageでソート
    const result = damageDataList.sort((a, b) => b.vshidamage - a.vshidamage);
    for (let j = 0; j < 5; j++) {
      let totalDamage = 0;
      let duoCount = 0;
      let advantageCount = 0;
      let equalCount = 0;
      let disadvantageCount = 0;
      
      for (let k = 0; k < attackCounts[j] && k < result.length; k++) {
        if (!result[k]) continue;
        
        totalDamage += result[k].vshidamage;
        
        if (result[k].duoMagic === 'デュオ魔法') {
          duoCount++;
        }
        if (result[k].attribute === '水') {
          advantageCount++;
        } else if (result[k].attribute === '木') {
          disadvantageCount++;
        } else {
          equalCount++;
        }
      }
      
      // calcBASICと同じ計算式
      scores[j] = (totalDamage - attackCounts[j] * 4.5) + 
                  duoCount * 3000 + 
                  advantageCount * 2000 + 
                  equalCount * 500 + 
                  disadvantageCount * (-1000);
    }
  } else if (props.selectedAttribute === '対木') {
    // 対木: vskidamageでソート
    const result = damageDataList.sort((a, b) => b.vskidamage - a.vskidamage);
    for (let j = 0; j < 5; j++) {
      let totalDamage = 0;
      let duoCount = 0;
      let advantageCount = 0;
      let equalCount = 0;
      let disadvantageCount = 0;
      
      for (let k = 0; k < attackCounts[j] && k < result.length; k++) {
        if (!result[k]) continue;
        
        totalDamage += result[k].vskidamage;
        
        if (result[k].duoMagic === 'デュオ魔法') {
          duoCount++;
        }
        if (result[k].attribute === '火') {
          advantageCount++;
        } else if (result[k].attribute === '水') {
          disadvantageCount++;
        } else {
          equalCount++;
        }
      }
      
      // calcBASICと同じ計算式
      scores[j] = (totalDamage - attackCounts[j] * 4.5) + 
                  duoCount * 3000 + 
                  advantageCount * 2000 + 
                  equalCount * 500 + 
                  disadvantageCount * (-1000);
    }
  } else if (props.selectedAttribute === '対水') {
    // 対水: vsmizudamageでソート
    const result = damageDataList.sort((a, b) => b.vsmizudamage - a.vsmizudamage);
    for (let j = 0; j < 5; j++) {
      let totalDamage = 0;
      let duoCount = 0;
      let advantageCount = 0;
      let equalCount = 0;
      let disadvantageCount = 0;
      
      for (let k = 0; k < attackCounts[j] && k < result.length; k++) {
        if (!result[k]) continue;
        
        totalDamage += result[k].vsmizudamage;
        
        if (result[k].duoMagic === 'デュオ魔法') {
          duoCount++;
        }
        if (result[k].attribute === '木') {
          advantageCount++;
        } else if (result[k].attribute === '火') {
          disadvantageCount++;
        } else {
          equalCount++;
        }
      }
      
      // calcBASICと同じ計算式
      scores[j] = (totalDamage - attackCounts[j] * 4.5) + 
                  duoCount * 3000 + 
                  advantageCount * 2000 + 
                  equalCount * 500 + 
                  disadvantageCount * (-1000);
    }
  } else if (props.selectedAttribute === '対無' || props.selectedAttribute === '対無属性') {
    // 対無: vsmudamageでソート
    const result = damageDataList.sort((a, b) => b.vsmudamage - a.vsmudamage);
    for (let j = 0; j < 5; j++) {
      let totalDamage = 0;
      let duoCount = 0;
      let advantageCount = 0;
      let equalCount = 0;
      let disadvantageCount = 0;
      
      for (let k = 0; k < attackCounts[j] && k < result.length; k++) {
        if (!result[k]) continue;
        
        totalDamage += result[k].vsmudamage;
        
        if (result[k].duoMagic === 'デュオ魔法') {
          duoCount++;
        }
        // 対無の場合は全て等倍
        equalCount++;
      }
      
      // calcBASICと同じ計算式
      scores[j] = (totalDamage - attackCounts[j] * 4.5) + 
                  duoCount * 3000 + 
                  advantageCount * 2000 + 
                  equalCount * 500 + 
                  disadvantageCount * (-1000);
    }
  }
  
  return scores;
});

// 各難易度のスコア計算（EXTRAの3T,4Tのみ）
const extraScores = computed(() => [
  scoreBase.value[0] * 0.144 * 1.5,
  scoreBase.value[1] * 0.138 * 1.5,
  scoreBase.value[2] * 0.132 * 1.5,
  scoreBase.value[3] * 0.126 * 1.5,
  scoreBase.value[4] * 0.1 * 1.5
]);

// 数値フォーマット
const formatNumber = (value: number) => {
  return Math.floor(value).toLocaleString();
};

// スコアのランクを判定
const getScoreRank = (score: number) => {
  if (score >= 32001) return 'S5';
  if (score >= 26001) return 'S4';
  if (score >= 20001) return 'S3';
  if (score >= 17001) return 'S2';
  if (score >= 13001) return 'S1';
  if (score >= 9001) return 'A';
  if (score >= 7001) return 'B';
  if (score >= 5001) return 'C';
  if (score >= 3001) return 'D';
  if (score >= 1001) return 'E';
  if (score >= 1) return 'F';
  return '-';
};

// ランクのクラス名を取得
const getRankClass = (rank: string) => {
  if (rank === 'S5') return 'rank-s5';
  if (rank === 'S4' || rank === 'S3') return 'rank-s34';
  if (['A', 'S1', 'S2'].includes(rank)) return 'rank-gold';
  return 'rank-default';
};
</script>

<style scoped>
.stats-container {
  margin: 0;
  padding: 0;
  font-size: 14px;
}

.margin {
  margin: 0;
}

/* ダメージテーブルのスタイル */
.damage-table {
  width: 100%;
  border-collapse: collapse;
  margin: 1px 0;
  font-size: 13px;
}

.damage-table th,
.damage-table td {
  padding: 1px 2px;
  text-align: center;
  border: 1px solid #ddd;
}

.damage-table thead th {
  background-color: #f5f5f5;
  font-weight: bold;
  color: #333;
}

.damage-table td {
  background-color: white;
}


.damage-table tr:hover td {
  background-color: #f9f9f9;
}

.damage-cell {
  padding: 0;
}

.damage-value {
  font-weight: bold;
  color: #d32f2f;
  font-size: 13px;
  margin: 0;
}

.damage-breakdown {
  color: #666;
  font-size: 0.75em;
  line-height: 0.9;
  margin: 0;
}

.score-cell {
  font-weight: bold;
  font-size: 13px;
  padding: 0;
}

/* スコアランクのスタイル */
.score-rank {
  margin-left: 2px;
  font-weight: bold;
  font-size: 12px;
}

.rank-s5 {
  color: #6a1b9a; /* 濃い紫 */
}

.rank-s34 {
  color: #ba68c8; /* 薄い紫 */
}

.rank-gold {
  color: #ffb74d; /* 薄い金色 */
}

.rank-default {
  color: #bdbdbd; /* 薄いグレー */
}

/* ダークモード対応 */
.v-theme--dark .damage-table thead th {
  background-color: #424242;
  color: #fff;
  border-color: #666;
}


.v-theme--dark .damage-table td {
  background-color: #303030;
  border-color: #666;
}


.v-theme--dark .damage-table tr:hover td {
  background-color: #3a3a3a;
}

.v-theme--dark .damage-value {
  color: #ff5252;
}

.v-theme--dark .damage-breakdown {
  color: #bbb;
}

/* ダークモードのランクカラー */
.v-theme--dark .rank-s5 {
  color: #9c27b0; /* 濃い紫 */
}

.v-theme--dark .rank-s34 {
  color: #ce93d8; /* 薄い紫 */
}

.v-theme--dark .rank-gold {
  color: #ffd54f; /* 薄い金色 */
}

.v-theme--dark .rank-default {
  color: #757575; /* 薄いグレー */
}

#totalHP,
#totalHealHP {
  font-weight: bold;
  color: #1976d2;
}

.hp-breakdown {
  color: #666;
  font-size: 0.85em;
  margin-left: 2px;
}

.v-theme--dark .hp-breakdown {
  color: #bbb;
}


</style>