<template>
  <div class="stats-container">
    <!-- 合計HP表示 -->
    <div class="margin">合計HP:<span id="totalHP">{{ formatNumber(totalHP) }}</span> 　回復込み:<span id="totalHealHP">{{ formatNumber(totalEffectiveHP) }}</span></div>
    
    <!-- 合計ダメージ表示 -->
    <div>合計ダメージ 5T:<span id="totalDamage5">{{ formatNumber(totalDamage5T) }}</span> (<span id="midDamage5">{{ midDamage5T }}</span>) 　4T:<span id="totalDamage4">{{ formatNumber(totalDamage4T) }}</span> (<span id="midDamage4">{{ midDamage4T }}</span>) 　3T:<span id="totalDamage3">{{ formatNumber(totalDamage3T) }}</span> (<span id="midDamage3">{{ midDamage3T }}</span>)</div>
    
    <!-- Basic試験予想スコア -->
    <div>Basic試験予想スコア EXTRA 4T:<span id="extrascore4T">{{ formatNumber(extraScores[3]) }}</span> 　3T:<span id="extrascore3T">{{ formatNumber(extraScores[2]) }}</span></div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
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
  
  simulatorStore.deckCharacters.forEach((char, index) => {
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

// Basic試験スコア計算（旧シミュレータのロジックに従う）
const scoreBase = computed(() => {
  const scores = [0, 0, 0, 0, 0]; // 1T～5T
  
  // ダメージデータを収集
  const damageDataList: any[] = [];
  simulatorStore.deckCharacters.forEach((char, charIndex) => {
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
  
  // 選択された属性に基づいてスコア計算
  if (props.selectedAttribute === '対全') {
    // 全属性: vszendamageでソート
    const result = damageDataList.sort((a, b) => b.vszendamage - a.vszendamage);
    for (let j = 0; j < 5; j++) {
      for (let k = 2 * j; k < 2 * j + 2; k++) {
        for (let l = j; l < 5; l++) {
          if (!result[k]) continue;
          
          if (result[k].duoMagic === 'デュオ魔法') {
            scores[l] += 3000;
          }
          if (result[k].attribute !== '無') {
            scores[l] += 1500;
          }
          scores[l] += result[k].vszendamage;
          scores[l] += 500;
        }
      }
    }
  } else if (props.selectedAttribute === '対火') {
    // 対火: vshidamageでソート
    const result = damageDataList.sort((a, b) => b.vshidamage - a.vshidamage);
    for (let j = 0; j < 5; j++) {
      for (let k = 2 * j; k < 2 * j + 2; k++) {
        for (let l = j; l < 5; l++) {
          if (!result[k]) continue;
          
          if (result[k].duoMagic === 'デュオ魔法') {
            scores[l] += 3000;
          }
          if (result[k].attribute === '水') {
            scores[l] += 1500;
          }
          if (result[k].attribute === '木') {
            scores[l] -= 1500;
          }
          scores[l] += result[k].vshidamage;
          scores[l] += 500;
        }
      }
    }
  } else if (props.selectedAttribute === '対木') {
    // 対木: vskidamageでソート
    const result = damageDataList.sort((a, b) => b.vskidamage - a.vskidamage);
    for (let j = 0; j < 5; j++) {
      for (let k = 2 * j; k < 2 * j + 2; k++) {
        for (let l = j; l < 5; l++) {
          if (!result[k]) continue;
          
          if (result[k].duoMagic === 'デュオ魔法') {
            scores[l] += 3000;
          }
          if (result[k].attribute === '火') {
            scores[l] += 1500;
          }
          if (result[k].attribute === '水') {
            scores[l] -= 1500;
          }
          scores[l] += result[k].vskidamage;
          scores[l] += 500;
        }
      }
    }
  } else if (props.selectedAttribute === '対水') {
    // 対水: vsmizudamageでソート
    const result = damageDataList.sort((a, b) => b.vsmizudamage - a.vsmizudamage);
    for (let j = 0; j < 5; j++) {
      for (let k = 2 * j; k < 2 * j + 2; k++) {
        for (let l = j; l < 5; l++) {
          if (!result[k]) continue;
          
          if (result[k].duoMagic === 'デュオ魔法') {
            scores[l] += 3000;
          }
          if (result[k].attribute === '木') {
            scores[l] += 1500;
          }
          if (result[k].attribute === '火') {
            scores[l] -= 1500;
          }
          scores[l] += result[k].vsmizudamage;
          scores[l] += 500;
        }
      }
    }
  } else if (props.selectedAttribute === '対無' || props.selectedAttribute === '対無属性') {
    // 対無: vsmudamageでソート
    const result = damageDataList.sort((a, b) => b.vsmudamage - a.vsmudamage);
    for (let j = 0; j < 5; j++) {
      for (let k = 2 * j; k < 2 * j + 2; k++) {
        for (let l = j; l < 5; l++) {
          if (!result[k]) continue;
          
          if (result[k].duoMagic === 'デュオ魔法') {
            scores[l] += 3000;
          }
          scores[l] += result[k].vsmudamage;
          scores[l] += 500;
        }
      }
    }
  }
  
  return scores;
});

// 各難易度のスコア計算（EXTRAの3T,4Tのみ）
const extraScores = computed(() => [
  scoreBase.value[0] * 0.216,
  scoreBase.value[1] * 0.207,
  scoreBase.value[2] * 0.198,
  scoreBase.value[3] * 0.189,
  scoreBase.value[4] * 0.15
]);

// 数値フォーマット
const formatNumber = (value: number) => {
  return Math.floor(value).toLocaleString();
};
</script>

<style scoped>
.stats-container {
  margin: 0;
  padding: 5px 0;
  font-size: 14px;
}

.margin {
  margin: 2px 0;
}


#totalHP,
#totalHealHP {
  font-weight: bold;
  color: #1976d2;
}

#totalDamage3,
#totalDamage4,
#totalDamage5 {
  font-weight: bold;
  color: #d32f2f;
}

#midDamage3,
#midDamage4,
#midDamage5 {
  color: #666;
  font-size: 0.9em;
}

#extrascore4T,
#extrascore3T {
  font-weight: bold;
  color: #ff9800;
}
</style>