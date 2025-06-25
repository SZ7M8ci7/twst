<template>
  <div class="modal-overlay" @click.self="closeModal">
    <div class="modal-content">
      <!-- タブセクション -->
      <div class="tab-section">
        <div class="tab-header">
          <div 
            class="tab-item"
            :class="{ active: activeTab === 'filter' }"
            @click="handleTabClick('filter')"
          >
            <span>フィルター設定</span>
            <v-icon>{{ activeTab === 'filter' && isExpanded ? 'mdi-chevron-up' : 'mdi-chevron-down' }}</v-icon>
          </div>
          <div 
            class="tab-item"
            :class="{ active: activeTab === 'sort' }"
            @click="handleTabClick('sort')"
          >
            <span>ソート設定</span>
            <v-icon>{{ activeTab === 'sort' && isExpanded ? 'mdi-chevron-up' : 'mdi-chevron-down' }}</v-icon>
          </div>
        </div>
        
        <v-expand-transition>
          <div v-if="isExpanded" class="tab-content">
            <!-- フィルターセクション -->
            <div v-show="activeTab === 'filter'">
              <FilterModal 
                :embedded="true"
                @close="handleFilterClose"
                @filter-applied="handleFilterApplied"
              />
            </div>
            
            <!-- ソートセクション -->
            <div v-show="activeTab === 'sort'" class="sort-content">
              <v-row>
                <v-col cols="12" sm="6">
                  <v-select
                    v-model="sortBy"
                    :items="sortOptions"
                    label="並び順"
                    item-title="text"
                    item-value="value"
                    variant="outlined"
                    density="compact"
                  />
                </v-col>
                <v-col cols="12" sm="6">
                  <v-select
                    v-model="sortOrder"
                    :items="sortOrderOptions"
                    label="順序"
                    item-title="text"
                    item-value="value"
                    variant="outlined"
                    density="compact"
                  />
                </v-col>
              </v-row>
              
            </div>
          </div>
        </v-expand-transition>
      </div>
      
      <!-- キャラクターグリッド -->
      <div class="character-grid-container">
        <div v-if="loadingImgUrl" class="loading-message">
          キャラクター画像を読み込み中...
        </div>
        <div v-else-if="filteredCharacters.length === 0" class="no-results">
          条件に一致するキャラクターがありません
        </div>
        <div v-else class="character-grid">
          <div 
            v-for="character in filteredCharacters" 
            :key="character.name" 
            @click="selectImage(character)" 
            class="character-item"
          >
            <img 
              :src="character.imgUrl" 
              :alt="character.name" 
              class="character-image" 
              :title="character.chara || character.name"
            />
            <div class="character-name">{{ getDisplayText(character) }}</div>
          </div>
        </div>
      </div>
      
    </div>
  </div>
</template>

<script setup>
import { computed, onBeforeMount, ref, watch } from 'vue';
import { useCharacterStore } from '@/store/characters';
import { useSimulatorStore } from '@/store/simulatorStore';
import { storeToRefs } from 'pinia';
import defaultImg from '@/assets/img/default.png';
import FilterModal from '@/components/FilterModal.vue';
import characterData from '@/assets/characters_info.json';
import { calculateCharacterStats, buddyHPDict, buddyATKDict, healDict, healContinueDict } from '@/utils/calculations';

const characterStore = useCharacterStore();
const { characters } = storeToRefs(characterStore);
const simulatorStore = useSimulatorStore();
const { deckCharacters } = storeToRefs(simulatorStore);
const loadingImgUrl = ref(true);

// タブ管理
const activeTab = ref('filter');

// 展開状態
const isExpanded = ref(false);

// ソート設定（保存機能付き）
const sortBy = ref(localStorage.getItem('simCharaModal_sortBy') || 'default');
const sortOrder = ref(localStorage.getItem('simCharaModal_sortOrder') || 'asc');

// ソート更新を強制するためのリアクティブカウンター
const sortUpdateCounter = ref(0);

// ソートオプション
const sortOptions = [
  { text: 'デフォルト順', value: 'default' },
  { text: 'レア度', value: 'rarity' },
  { text: 'HP', value: 'hp' },
  { text: 'ATK', value: 'atk' },
  { text: '実質HP（カード）', value: 'effectiveCardHP' },
  { text: '実質ATK（カード）', value: 'effectiveCardATK' },
  { text: '実質HP（デッキ）', value: 'effectiveDeckHP' },
  { text: '与ダメージ（デッキ）', value: 'deckDamage' },
  { text: 'HPバディ数（デッキ）', value: 'deckHPBuddyCount' },
  { text: 'バディ数（デッキ）', value: 'deckBuddyCount' },
  { text: 'バディ増加HP最低値', value: 'minBuddyHPIncrease' },
  { text: 'DUO数', value: 'duoCount' }
];

const sortOrderOptions = [
  { text: '昇順', value: 'asc' },
  { text: '降順', value: 'desc' }
];

// ソート設定の保存と監視
watch(sortBy, (newValue, oldValue) => {
  localStorage.setItem('simCharaModal_sortBy', newValue);
  // 新しい項目を選択した場合のみ、デフォルト順以外は降順を初期値にする
  if (newValue !== oldValue && newValue !== 'default') {
    sortOrder.value = 'desc';
  } else if (newValue === 'default') {
    sortOrder.value = 'asc';
  }
  sortUpdateCounter.value++; // ソート更新を強制
});

watch(sortOrder, (newValue) => {
  localStorage.setItem('simCharaModal_sortOrder', newValue);
  sortUpdateCounter.value++; // ソート更新を強制
});

// 初期値設定：保存された設定がない場合のデフォルト値
if (!localStorage.getItem('simCharaModal_sortBy')) {
  // 初回アクセス時のデフォルト値
  sortBy.value = 'default';
  sortOrder.value = 'asc';
} else if (sortBy.value !== 'default' && !localStorage.getItem('simCharaModal_sortOrder')) {
  // ソートキーは保存されているが順序が保存されていない場合（バージョンアップ対応）
  sortOrder.value = 'desc';
}

// 計算関数（calculations.tsの定数を使用）
function calcHPBuddyRate(status, level = 10) {
  if (!status) return 0;
  const key = `${status}${level}`;
  return buddyHPDict[key] || 0;
}

function calcATKBuddyRate(status, level = 10) {
  if (!status) return 0;
  const key = `${status}${level}`;
  return buddyATKDict[key] || 0;
}

function calcHealRate(status, level = 10) {
  if (!status) return 0;
  const key = `${status}${level}`;
  return healDict[key] || 0;
}

function calcConHealRate(status, level = 10) {
  if (!status) return 0;
  const key = `${status}${level}`;
  const conHealValue = healContinueDict[key] || 0;
  // 継続回復は3ターン分
  return conHealValue * 3;
}


// キャラクター単体の実質HPを計算
function calculateEffectiveCardHP(character, memberNameDict) {
  // 計算の元となるHP
  const characterHP = character.hp || 0;
  
  // バディHP増加分（レベル10を仮定）
  let buddyHP = 0;
  if (memberNameDict[character.buddy1c]) {
    const rate = calcHPBuddyRate(character.buddy1s, 10);
    buddyHP += characterHP * rate;
  }
  if (memberNameDict[character.buddy2c]) {
    const rate = calcHPBuddyRate(character.buddy2s, 10);
    buddyHP += characterHP * rate;
  }
  if (memberNameDict[character.buddy3c]) {
    const rate = calcHPBuddyRate(character.buddy3s, 10);
    buddyHP += characterHP * rate;
  }
  
  // 回復量（ATK基準、レベル10を仮定）
  const characterATK = character.atk || 0;
  const heal = (calcHealRate(character.magic1heal, 10) + 
                calcHealRate(character.magic2heal, 10) + 
                (character.hasM3 ? calcHealRate(character.magic3heal, 10) : 0)) * characterATK;
  
  // 継続回復量（HP基準、レベル10を仮定）
  const conHeal = (calcConHealRate(character.magic1heal, 10) + 
                   calcConHealRate(character.magic2heal, 10) + 
                   (character.hasM3 ? calcConHealRate(character.magic3heal, 10) : 0)) * characterHP;
  
  const totalHP = characterHP + buddyHP + heal + conHeal;
  
  
  return totalHP;
}

// キャラクター単体の実質ATKを計算
function calculateEffectiveCardATK(character, memberNameDict) {
  const baseATK = character.atk || 0;
  
  // バディATK増加分（レベル10を仮定）
  let buddyATK = 0;
  if (memberNameDict[character.buddy1c]) {
    buddyATK += baseATK * calcATKBuddyRate(character.buddy1s, 10);
  }
  if (memberNameDict[character.buddy2c]) {
    buddyATK += baseATK * calcATKBuddyRate(character.buddy2s, 10);
  }
  if (memberNameDict[character.buddy3c]) {
    buddyATK += baseATK * calcATKBuddyRate(character.buddy3s, 10);
  }
  
  return baseATK + buddyATK;
}

// デッキ全体の計算（候補キャラクターを含む仮想デッキ）
function calculateDeckStats(candidateCharacter, sortKey) {
  
  // 現在のデッキキャラクターを取得（インデックス情報も保持）
  let virtualDeck = [];
  let virtualDeckIndexMap = []; // 元のdeckCharactersのインデックスを記録
  
  // デッキキャラクターを追加（置き換え対象は除外）
  deckCharacters.value.forEach((char, index) => {
    if (char.chara && index !== props.charaIndex) {
      virtualDeck.push(char);
      virtualDeckIndexMap.push(index); // 元のインデックスを記録
    }
  });
  
  // 候補キャラクターを追加
  if (candidateCharacter) {
    virtualDeck.push(candidateCharacter);
    virtualDeckIndexMap.push(-1); // 候補キャラクターは-1
  }
  
  if (virtualDeck.length === 0) {
    return 0;
  }
  
  // デッキ全体の計算では、置き換えを考慮
  const memberNameDict = getMemberNameSet(candidateCharacter, props.charaIndex >= 0 ? props.charaIndex : null);
  const memberNameSet = new Set(Object.keys(memberNameDict));
  
  let deckTotalHP = 0;
  let deckTotalHeal = 0;
  let deckTotalHPBuddy = 0;
  let deckTotalBuddy = 0;
  let deckDuo = 0;
  let deckMinIncreasedHPBuddy = 99999;
  const deckReferenceDamageList = [];
  
  const name2DuoUsed = {};
  const name2M2Used = {};
  const name2MotherUsed = {};
  
  virtualDeck.forEach((chara, index) => {
    name2M2Used[index] = false;
    name2MotherUsed[index] = false;
    name2DuoUsed[index] = false;
  });
  
  // 軽量な統計計算のためのショートカット
  if (['deckHPBuddyCount', 'deckBuddyCount', 'duoCount'].includes(sortKey)) {
    // 軽量な統計はメンバー名のみで判定可能
    const memberNameDict = getOptimizedMemberNameSet(candidateCharacter, props.charaIndex >= 0 ? props.charaIndex : null);
    const memberNameSet = new Set(Object.keys(memberNameDict));
    
    let totalHPBuddy = 0;
    let totalBuddy = 0;
    let totalDuo = 0;
    
    // 最適化：バディとデュオの高速カウント
    virtualDeck.forEach(chara => {
      // バディ数カウント（高速化）
      const buddies = [chara.buddy1c, chara.buddy2c, chara.buddy3c];
      const buddyStates = [chara.buddy1s, chara.buddy2s, chara.buddy3s];
      
      for (let i = 0; i < buddies.length; i++) {
        if (buddies[i] && memberNameSet.has(buddies[i])) {
          totalBuddy += 1;
          // HPバディ数カウント（レベル10を仮定）
          if (calcHPBuddyRate(buddyStates[i], 10) !== 0) {
            totalHPBuddy += 1;
          }
        }
      }
      
      // デュオ数カウント（高速化）
      if (chara.duo && memberNameDict[chara.duo]) {
        totalDuo += 1;
      }
    });
    
    switch (sortKey) {
      case 'deckHPBuddyCount': return totalHPBuddy;
      case 'deckBuddyCount': return totalBuddy;
      case 'duoCount': return totalDuo;
    }
  }

  // 重い計算が必要な場合のみ完全な再計算を実行
  const fullMemberNameDict = {};
  virtualDeck.forEach(char => {
    if (char.chara) {
      fullMemberNameDict[char.chara] = true;
    }
  });

  const virtualIndex = virtualDeckIndexMap.findIndex(index => index === -1);

  // 必要最小限のキャラクターのみ再計算
  const recalculatedVirtualDeck = [];
  for (let i = 0; i < virtualDeck.length; i++) {
    const chara = virtualDeck[i];
    let recalculatedChara;
    
    if (i === virtualIndex) {
      // 候補キャラクターの場合：完全なデータを準備
      recalculatedChara = { ...chara };
      
      // 必要なプロパティを設定
      recalculatedChara.magic1Lv = chara.magic1Lv || 10;
      recalculatedChara.magic2Lv = chara.magic2Lv || 10;
      recalculatedChara.magic3Lv = chara.magic3Lv || 10;
      recalculatedChara.buddy1Lv = chara.buddy1Lv || 10;
      recalculatedChara.buddy2Lv = chara.buddy2Lv || 10;
      recalculatedChara.buddy3Lv = chara.buddy3Lv || 10;
      
      recalculatedChara.magic1Power = chara.magic1Power || chara.magic1pow || '単発(弱)';
      recalculatedChara.magic2Power = chara.magic2Power || chara.magic2pow || '連撃(強)';
      recalculatedChara.magic2pow = chara.magic2pow || '連撃(強)';
      recalculatedChara.magic3Power = chara.magic3Power || chara.magic3pow || '単発(弱)';
      
      recalculatedChara.magic1Attribute = chara.magic1Attribute || chara.magic1atr || '無';
      recalculatedChara.magic2Attribute = chara.magic2Attribute || chara.magic2atr || '無';
      recalculatedChara.magic3Attribute = chara.magic3Attribute || chara.magic3atr || '無';
      
      recalculatedChara.selectedMagic = [1, 2];
      if (chara.hasM3) {
        recalculatedChara.selectedMagic.push(3);
      }
      
      recalculatedChara.isM1Selected = true;
      recalculatedChara.isM2Selected = true;
      recalculatedChara.isM3Selected = chara.hasM3 || false;
      recalculatedChara.duo = chara.duo || '';
      recalculatedChara.buffs = [];
      
      // 自動バフ設定
      for (let j = 1; j <= 3; j++) {
        const buffValue = chara[`magic${j}buf`];
        if (buffValue) {
          const buffType = buffValue.includes('ATKUP') ? 'ATKUP' :
                          buffValue.includes('ダメUP') ? 'ダメージUP' :
                          buffValue.includes('属性ダメUP') ? '属性ダメUP' :
                          buffValue.includes('クリティカル') ? 'クリティカル' : '';
          
          if (buffType) {
            const buff = {
              magicOption: `M${j}`,
              buffOption: buffType,
              powerOption: getPowerOptionForBuff(buffValue),
              levelOption: buffType === 'クリティカル' ? 1 : 10
            };
            recalculatedChara.buffs.push(buff);
          }
        }
      }
    } else {
      // 既存のデッキキャラクター：現在の設定値を使用
      const originalDeckIndex = virtualDeckIndexMap[i];
      
      if (originalDeckIndex >= 0 && originalDeckIndex < deckCharacters.value.length) {
        recalculatedChara = { ...deckCharacters.value[originalDeckIndex] };
      } else {
        recalculatedChara = { ...chara };
      }
      
      recalculatedChara.selectedMagic = [];
      for (let j = 1; j <= 3; j++) {
        if (recalculatedChara[`isM${j}Selected`]) {
          recalculatedChara.selectedMagic.push(j);
        }
      }
    }
    
    // デュオ判定を仮想デッキ構成で再計算
    if (recalculatedChara.duo && fullMemberNameDict[recalculatedChara.duo]) {
      recalculatedChara.magic2Power = 'デュオ';
    } else if (recalculatedChara.duo) {
      recalculatedChara.magic2Power = recalculatedChara.magic2pow || '連撃(強)';
    }
    
    // ダメージ計算が必要な場合のみ統計を再計算
    if (sortKey === 'deckDamage') {
      calculateCharacterStats(recalculatedChara, fullMemberNameDict);
    }
    
    recalculatedVirtualDeck.push(recalculatedChara);
  }

  // 再計算されたキャラクターデータを使用してHP・ヒール計算
  recalculatedVirtualDeck.forEach((chara) => {
    deckTotalHP += chara.hp || 0;
    
    let increasedHP = 0;
    
    // バディHP増加分計算（レベル10を仮定）
    if (memberNameSet.has(chara.buddy1c)) {
      deckTotalBuddy += 1;
      const hpRate = calcHPBuddyRate(chara.buddy1s, 10);
      if (hpRate !== 0) {
        deckTotalHPBuddy += 1;
        const hpIncrease = chara.hp * hpRate;
        deckTotalHP += hpIncrease;
        increasedHP += hpIncrease;
      }
    }
    
    if (memberNameSet.has(chara.buddy2c)) {
      deckTotalBuddy += 1;
      const hpRate = calcHPBuddyRate(chara.buddy2s, 10);
      if (hpRate !== 0) {
        deckTotalHPBuddy += 1;
        const hpIncrease = chara.hp * hpRate;
        deckTotalHP += hpIncrease;
        increasedHP += hpIncrease;
      }
    }
    
    if (memberNameSet.has(chara.buddy3c)) {
      deckTotalBuddy += 1;
      const hpRate = calcHPBuddyRate(chara.buddy3s, 10);
      if (hpRate !== 0) {
        deckTotalHPBuddy += 1;
        const hpIncrease = chara.hp * hpRate;
        deckTotalHP += hpIncrease;
        increasedHP += hpIncrease;
      }
    }
    
    deckMinIncreasedHPBuddy = Math.min(deckMinIncreasedHPBuddy, increasedHP);
    
    // HP回復分計算（レベル10を仮定）
    const hpHeal = (calcHealRate(chara.magic1heal, 10) +
                    calcHealRate(chara.magic2heal, 10) +
                    (chara.hasM3 ? calcHealRate(chara.magic3heal, 10) : 0)) * chara.atk;
    const hpConHeal = (calcConHealRate(chara.magic1heal, 10) +
                       calcConHealRate(chara.magic2heal, 10) +
                       (chara.hasM3 ? calcConHealRate(chara.magic3heal, 10) : 0)) * chara.hp;
    deckTotalHeal += hpHeal + hpConHeal;
    
    // デュオカウント（再計算済みデータから判定）
    if (chara.magic2Power === 'デュオ') {
      deckDuo += 1;
    }
  });

  // 再計算されたキャラクターデータを使用してダメージ計算
  recalculatedVirtualDeck.forEach((chara, currentIndex) => {
    // このキャラクターが候補キャラクターかどうかを判定
    const isCandidateCharacter = (currentIndex === virtualIndex);
    
    if (isCandidateCharacter) {
      // 候補キャラクター：既に再計算済みのダメージ詳細を使用
      
      
      // 計算されたダメージ詳細から属性ダメージを取得
      const allDamages = [];
      
      // M1, M2（、M3）のダメージ詳細から属性ダメージを抽出
      for (let i = 1; i <= 3; i++) {
        const damageDetails = chara[`magic${i}DamageDetails`];
        if (damageDetails) {
          let damage = 0;
          
          switch (props.selectedAttribute) {
            case '対火':
              damage = damageDetails.fire || 0;
              break;
            case '対水':
              damage = damageDetails.water || 0;
              break;
            case '対木':
              damage = damageDetails.wood || 0;
              break;
            case '対無':
            case '対無属性':
              damage = damageDetails.neutral || 0;
              break;
            case '対全':
            default:
              damage = Math.max(
                damageDetails.fire || 0,
                damageDetails.water || 0,
                damageDetails.wood || 0,
                damageDetails.neutral || 0
              );
              break;
          }
          
          
          if (damage > 0) {
            allDamages.push(damage);
          }
        }
      }
      
      // トップ2のダメージを取得
      allDamages.sort((a, b) => b - a);
      const topDamages = allDamages.slice(0, 2);
      deckReferenceDamageList.push(...topDamages.filter(d => d > 0));
      
    } else {
      // 既存のデッキキャラクター：既に再計算済みのダメージ詳細を使用
      
      // 計算されたダメージ詳細から属性ダメージを取得
      for (let i = 1; i <= 3; i++) {
        if (chara[`isM${i}Selected`]) {
          const damageDetails = chara[`magic${i}DamageDetails`];
          
          if (damageDetails) {
            let damage = 0;
            
            switch (props.selectedAttribute) {
              case '対火':
                damage = damageDetails.fire || 0;
                break;
              case '対水':
                damage = damageDetails.water || 0;
                break;
              case '対木':
                damage = damageDetails.wood || 0;
                break;
              case '対無':
              case '対無属性':
                damage = damageDetails.neutral || 0;
                break;
              case '対全':
              default:
                damage = Math.max(
                  damageDetails.fire || 0,
                  damageDetails.water || 0,
                  damageDetails.wood || 0,
                  damageDetails.neutral || 0
                );
                break;
            }
            
            if (damage > 0) {
              deckReferenceDamageList.push(damage);
            }
          }
        }
      }
    }
  });
  
  // ソートキーに応じて適切な値を返す
  switch (sortKey) {
    case 'effectiveDeckHP':
      return deckTotalHP + deckTotalHeal;
    case 'deckDamage':
      return deckReferenceDamageList.reduce((sum, damage) => sum + damage, 0);
    case 'deckHPBuddyCount':
      return deckTotalHPBuddy;
    case 'deckBuddyCount':
      return deckTotalBuddy;
    case 'minBuddyHPIncrease':
      return deckMinIncreasedHPBuddy === 99999 ? 0 : deckMinIncreasedHPBuddy;
    case 'duoCount':
      return deckDuo;
    default:
      return 0;
  }
}

// バフ文字列からパワーオプションを取得（SimChara.vueのgetPowerOptionと同じロジック）
function getPowerOptionForBuff(buffString) {
  // クリティカル分数形式の確認（旧シミュレータ形式）
  if (buffString.includes('(1/1)')) return '1/1';
  if (buffString.includes('(1/2)')) return '1/2';
  if (buffString.includes('(1/3)')) return '1/3';
  if (buffString.includes('(2/3)')) return '2/3';
  
  // クリティカルサイズ形式から分数形式への変換
  if (buffString.includes('クリティカル')) {
    if (buffString.includes('(小)')) return '1/2';
    if (buffString.includes('(中)')) return '1/1';
    if (buffString.includes('(大)')) return '2/3';
    if (buffString.includes('(極大)')) return '1/1';
    return '1/1'; // デフォルトのクリティカル値
  }
  
  // 通常のバフ形式の確認
  if (buffString.includes('極小')) return '極小';
  if (buffString.includes('小')) return '小';
  if (buffString.includes('中')) return '中';
  if (buffString.includes('大')) return '大';
  if (buffString.includes('極大')) return '極大';
  
  return '小'; // デフォルト値
}

// calculations.tsと同じダメージ計算関数
// 未使用の関数を削除（calculations.tsのcalculateCharacterStatsを使用）

// 置き換えを考慮したメンバー名セットを取得
function getMemberNameSet(candidateCharacter = null, excludeIndex = null) {
  let memberNames = [];
  
  // デッキメンバーを追加（excludeIndexを除く）
  deckCharacters.value.forEach((char, index) => {
    if (char.chara && index !== excludeIndex) {
      memberNames.push(char.chara);
    }
  });
  
  // 候補キャラクターがある場合は追加
  if (candidateCharacter && candidateCharacter.chara) {
    memberNames.push(candidateCharacter.chara);
  }
  
  // calculateCharacterStats が期待する形式（{ [key: string]: boolean }）に変換
  const memberNameDict = {};
  memberNames.forEach(name => {
    memberNameDict[name] = true;
  });
  return memberNameDict;
}

// 最適化されたメンバー名管理システム
const memberNameCache = ref(new Map());

// 高速メンバー名セット作成（最適化版）
function getOptimizedMemberNameSet(candidateCharacter = null, excludeIndex = null) {
  // キャッシュキーの生成
  const deckSignature = deckCharacters.value.map(c => c.chara || '').join('|');
  const candidateKey = candidateCharacter ? candidateCharacter.chara : '';
  const excludeKey = excludeIndex !== null ? excludeIndex : -1;
  const cacheKey = `${deckSignature}:${excludeKey}:${candidateKey}`;
  
  // キャッシュヒット確認
  if (memberNameCache.value.has(cacheKey)) {
    return memberNameCache.value.get(cacheKey);
  }
  
  // 高速Set生成
  const memberNameSet = new Set();
  
  // デッキメンバーを追加（excludeIndexを除く）
  deckCharacters.value.forEach((char, index) => {
    if (char.chara && index !== excludeIndex) {
      memberNameSet.add(char.chara);
    }
  });
  
  // 候補キャラクターがある場合は追加
  if (candidateCharacter && candidateCharacter.chara) {
    memberNameSet.add(candidateCharacter.chara);
  }
  
  // calculateCharacterStats が期待する形式（{ [key: string]: boolean }）に変換
  const memberNameDict = {};
  memberNameSet.forEach(name => {
    memberNameDict[name] = true;
  });
  
  // キャッシュに保存
  memberNameCache.value.set(cacheKey, memberNameDict);
  
  return memberNameDict;
}

// メンバー名キャッシュのクリア関数
const clearMemberNameCache = () => {
  memberNameCache.value.clear();
};

// デッキ変更時にメンバー名キャッシュをクリア
watch(() => deckCharacters.value.map(c => c.chara), () => {
  clearMemberNameCache();
}, { deep: true });

// Props定義（他の定義より前に配置）
const props = defineProps({
  charaIndex: {
    type: Number,
    default: -1 // -1は新規追加を意味する
  },
  selectedAttribute: {
    type: String,
    default: '対全'
  }
});

const emit = defineEmits(['close', 'select']);

// 最適化されたデータ構造：高速ルックアップテーブル
const optimizedDataStructures = computed(() => {
  // キャラクター情報のインデックスマップ
  const characterIndexMap = new Map();
  const characterByName = new Map();
  const charactersByRarity = new Map();
  const duoCharacterMap = new Map();
  const buddyCharacterMap = new Map();
  
  // キャラクターデータの事前処理とインデックス化
  characterData.forEach((char, index) => {
    // 名前によるインデックス
    characterIndexMap.set(char.name_ja, index);
    characterIndexMap.set(char.name_en, index);
    characterByName.set(char.name_ja, char);
    characterByName.set(char.name_en, char);
    
    // レア度別グループ化
    if (!charactersByRarity.has(char.rarity)) {
      charactersByRarity.set(char.rarity, []);
    }
    charactersByRarity.get(char.rarity).push(char);
  });
  
  // キャラクターリストの事前処理
  characters.value.forEach(character => {
    // デュオ相手のマッピング
    if (character.duo) {
      if (!duoCharacterMap.has(character.duo)) {
        duoCharacterMap.set(character.duo, new Set());
      }
      duoCharacterMap.get(character.duo).add(character.chara);
      
      if (!duoCharacterMap.has(character.chara)) {
        duoCharacterMap.set(character.chara, new Set());
      }
      duoCharacterMap.get(character.chara).add(character.duo);
    }
    
    // バディ関係のマッピング
    [character.buddy1c, character.buddy2c, character.buddy3c].forEach(buddy => {
      if (buddy) {
        if (!buddyCharacterMap.has(buddy)) {
          buddyCharacterMap.set(buddy, new Set());
        }
        buddyCharacterMap.get(buddy).add(character.chara);
        
        if (!buddyCharacterMap.has(character.chara)) {
          buddyCharacterMap.set(character.chara, new Set());
        }
        buddyCharacterMap.get(character.chara).add(buddy);
      }
    });
  });
  
  return {
    characterIndexMap,
    characterByName,
    charactersByRarity,
    duoCharacterMap,
    buddyCharacterMap
  };
});

// ソート用計算値のキャッシュ
const sortCache = ref(new Map());

// ソートキャッシュをクリアする関数
const clearSortCache = () => {
  sortCache.value.clear();
};

// watchでソート条件が変更されたらキャッシュをクリア
watch([sortBy, sortOrder, () => props.selectedAttribute], () => {
  clearSortCache();
  clearMemberNameCache();
});

// デッキキャラクターが変更されたらキャッシュをクリア
watch(() => deckCharacters.value.map(c => ({ chara: c.chara, level: c.level, hp: c.hp, atk: c.atk })), () => {
  clearSortCache();
  clearMemberNameCache();
}, { deep: true });

// フィルター適用済みのキャラクターリスト
const filteredCharacters = computed(() => {
  if (loadingImgUrl.value) {
    return []; // 画像URLの読み込み中は空の配列を返す
  }

  // リアクティブな依存関係を明示的に参照
  const currentSortBy = sortBy.value;
  const currentSortOrder = sortOrder.value;
  const currentSelectedAttribute = props.selectedAttribute;
  const currentSortUpdateCounter = sortUpdateCounter.value; // ソート強制更新カウンター
  

  // 新しい配列を作成（Vue リアクティブシステム対応）
  let filtered = [...characters.value.filter(character => {
    // 画像が読み込まれているか確認
    if (!character.imgUrl) return false;
    
    // visibleフラグをチェック（FilterModalから適用されたフィルター）
    if (!character.visible) return false;
    
    return true;
  })];


  // 最適化されたデータ構造を取得
  const dataStructures = optimizedDataStructures.value;

  // ソート処理
  if (currentSortBy === 'default') {
    // デフォルト順：最適化されたインデックスマップを使用
    filtered.sort((a, b) => {
      const aIndex = dataStructures.characterIndexMap.get(a.chara) ?? 999999;
      const bIndex = dataStructures.characterIndexMap.get(b.chara) ?? 999999;
      
      return currentSortOrder === 'desc' ? bIndex - aIndex : aIndex - bIndex;
    });
  } else {
    // 高コストなソート項目の場合は事前計算
    if (['effectiveDeckHP', 'deckDamage', 'deckHPBuddyCount', 'deckBuddyCount', 'minBuddyHPIncrease', 'duoCount'].includes(currentSortBy)) {
      
      // 直接計算でソート（キャッシュ問題を回避）
      filtered.sort((a, b) => {
        const aValue = calculateDeckStats(a, currentSortBy);
        const bValue = calculateDeckStats(b, currentSortBy);
        
        
        const comparison = aValue - bValue;
        return currentSortOrder === 'desc' ? -comparison : comparison;
      });
    } else {
      // 軽量なソート項目
      filtered.sort((a, b) => {
        let aValue, bValue;
        
        switch (currentSortBy) {
          case 'rarity': {
            const rarityOrder = { 'SSR': 3, 'SR': 2, 'R': 1 };
            aValue = rarityOrder[a.rare] || 0;
            bValue = rarityOrder[b.rare] || 0;
            break;
          }
          case 'hp':
            aValue = a.hp || 0;
            bValue = b.hp || 0;
            break;
          case 'atk':
            aValue = a.atk || 0;
            bValue = b.atk || 0;
            break;
          case 'effectiveCardHP':
            // カード単体の計算では、置き換え対象のキャラクターを除外
            aValue = calculateEffectiveCardHP(a, getOptimizedMemberNameSet(null, props.charaIndex));
            bValue = calculateEffectiveCardHP(b, getOptimizedMemberNameSet(null, props.charaIndex));
            break;
          case 'effectiveCardATK':
            // カード単体の計算では、置き換え対象のキャラクターを除外
            aValue = calculateEffectiveCardATK(a, getOptimizedMemberNameSet(null, props.charaIndex));
            bValue = calculateEffectiveCardATK(b, getOptimizedMemberNameSet(null, props.charaIndex));
            break;
          default:
            aValue = a.chara || '';
            bValue = b.chara || '';
        }
        
        // 数値の場合はそのまま比較、文字列の場合は大文字小文字を無視
        let comparison = 0;
        if (typeof aValue === 'number' && typeof bValue === 'number') {
          comparison = aValue - bValue;
        } else {
          comparison = String(aValue).localeCompare(String(bValue), 'ja');
        }
        
        return currentSortOrder === 'desc' ? -comparison : comparison;
      });
    }
  }

  return filtered;
});

const closeModal = () => {
  emit('close');
};

const selectImage = (character) => {
  emit('select', character);
};


// FilterModalからのフィルター適用処理
function handleFilterApplied() {
  // FilterModalが既にcharacters.visibleを更新しているので、
  // ここでは追加の処理は不要
}

// FilterModalの閉じる処理
function handleFilterClose() {
  // 詳細フィルターを閉じるだけ（フィルターは適用されない）
  isExpanded.value = false;
}

// タブクリック処理
function handleTabClick(tab) {
  if (activeTab.value === tab) {
    // 同じタブをクリックした場合は展開/折りたたみ
    isExpanded.value = !isExpanded.value;
  } else {
    // 別のタブをクリックした場合はタブ切り替えて展開
    activeTab.value = tab;
    isExpanded.value = true;
  }
}

// 表示テキストを取得する関数
function getDisplayText(character) {
  const currentSortBy = sortBy.value;
  
  switch (currentSortBy) {
    case 'default':
      return character.chara || character.name;
    case 'rarity':
      return character.rare;
    case 'hp':
      return character.hp || 0;
    case 'atk':
      return character.atk || 0;
    case 'effectiveCardHP':
      const effectiveHP = calculateEffectiveCardHP(character, getOptimizedMemberNameSet(null, props.charaIndex));
      const roundedHP = Math.round(effectiveHP);
      return roundedHP;
    case 'effectiveCardATK':
      return Math.round(calculateEffectiveCardATK(character, getOptimizedMemberNameSet(null, props.charaIndex)));
    case 'effectiveDeckHP':
    case 'deckDamage':
    case 'deckHPBuddyCount':
    case 'deckBuddyCount':
    case 'minBuddyHPIncrease':
    case 'duoCount':
      const value = calculateDeckStats(character, currentSortBy);
      return Math.round(value);
    default:
      return character.chara || character.name;
  }
}

onBeforeMount(() => {
  // 画像の読み込みを最適化するために、表示されるキャラクターのみを処理
  const visibleCharacters = characters.value.filter(character => character.visible);
  
  // 画像の読み込みを小さなバッチに分割して処理
  const batchSize = 10;
  const batches = [];
  
  for (let i = 0; i < visibleCharacters.length; i += batchSize) {
    batches.push(visibleCharacters.slice(i, i + batchSize));
  }
  
  // バッチごとに順次処理
  const processBatch = async (index) => {
    if (index >= batches.length) {
      loadingImgUrl.value = false; // すべての画像のロードが完了
      return;
    }
    
    const batch = batches[index];
    const promises = batch.map(character => {
      return import(`@/assets/img/${character.name}.png`)
        .then(module => {
          character.imgUrl = module.default;
        })
        .catch(() => {
          console.log(`Image not found for ${character.name}, using default`);
          character.imgUrl = defaultImg; // デフォルト画像を使用
        });
    });
    
    await Promise.all(promises);
    // 次のバッチを処理
    setTimeout(() => processBatch(index + 1), 0);
  };
  
  // 最初のバッチから処理開始
  processBatch(0);
});
</script>

<style scoped>
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  z-index: 20;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  justify-content: center;
  align-items: center;
}

.modal-content {
  background: white;
  padding: 20px;
  border-radius: 8px;
  max-height: 90vh;
  width: 90%;
  max-width: 1200px;
  overflow-y: auto;
}

.tab-section {
  margin-bottom: 20px;
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  overflow: hidden;
}

.tab-header {
  display: flex;
  background-color: #f5f5f5;
}

.tab-item {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 12px 16px;
  cursor: pointer;
  transition: background-color 0.2s;
  user-select: none;
  border-right: 1px solid #e0e0e0;
}

.tab-item:last-child {
  border-right: none;
}

.tab-item:hover {
  background-color: #eeeeee;
}

.tab-item.active {
  background-color: #fff;
}

.tab-item span {
  margin-right: 8px;
  font-weight: 500;
}

.tab-content {
  background-color: #fff;
  border-top: 1px solid #e0e0e0;
}

.sort-content {
  padding: 16px;
}

.sort-info {
  display: flex;
  align-items: center;
  color: #666;
}


.character-grid-container {
  margin-bottom: 20px;
  min-height: 200px;
}

.loading-message, .no-results {
  display: flex;
  justify-content: center;
  align-items: center;
  height: 200px;
  font-size: 18px;
  color: #666;
}

.character-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(48px, 1fr));
  gap: 2px;
}

.character-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  cursor: pointer;
  padding: 1px;
  border-radius: 3px;
}

.character-image {
  width: 100%;
  height: auto;
  border-radius: 3px;
  object-fit: cover;
}

.character-name {
  margin-top: 1px;
  font-size: 8px;
  line-height: 1.0;
  text-align: center;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

</style>
