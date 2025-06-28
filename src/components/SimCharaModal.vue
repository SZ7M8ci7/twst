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
        <div v-else-if="isSorting && ['effectiveDeckHP', 'deckDamage', 'deckHPBuddyCount', 'deckBuddyCount', 'minBuddyHPIncrease', 'duoCount'].includes(sortBy)" class="loading-message">
          ソート処理中...
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
            <div class="character-image-wrapper" :data-character-name="character.name">
              <img 
                v-if="character.imgUrl && character.imgUrl !== 'placeholder'"
                :src="character.imgUrl" 
                :alt="character.name" 
                class="character-image" 
                :title="character.chara || character.name"
                @error="handleImageError(character)"
                loading="lazy"
              />
              <div v-else class="character-image-placeholder">
                <div class="placeholder-content">
                  <v-icon size="24" color="grey">mdi-image</v-icon>
                </div>
              </div>
              <!-- デュオ相手のアイコン -->
              <div 
                v-if="character.duo && getDuoIconSync(character.duo)" 
                class="modal-duo-icon-container"
                :class="{ 'duo-active': isDuoActive(character) }"
                :title="isDuoActive(character) ? `DUO: ${character.duo} (有効)` : `DUO: ${character.duo} (無効)`"
              >
                <img 
                  :src="getDuoIconSync(character.duo)" 
                  alt="Duo Partner" 
                  class="modal-duo-icon"
                />
              </div>
            </div>
            <div class="character-name">{{ getDisplayText(character) }}</div>
          </div>
        </div>
      </div>
      
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, onUnmounted, ref, watch, nextTick } from 'vue';
import { useCharacterStore } from '@/store/characters';
import { useSimulatorStore } from '@/store/simulatorStore';
import { useFilterdStore } from '@/store/filterd';
import { storeToRefs } from 'pinia';
import defaultImg from '@/assets/img/default.png';
import FilterModal from '@/components/FilterModal.vue';
import characterData from '@/assets/characters_info.json';
import charactersInfo from '@/assets/characters_info.json';

// characterDataの高速検索用Mapを事前に作成
const characterDataMap = new Map();
characterData.forEach(char => {
  characterDataMap.set(char.name_ja, char);
  characterDataMap.set(char.name_en, char);
});
import { calculateCharacterStats, buddyHPDict, buddyATKDict, healDict, healContinueDict } from '@/utils/calculations';

// characters_info.jsonから日本語名から英語名への変換マップを動的に生成
const jpName2enName = charactersInfo.reduce((map, character) => {
  map[character.name_ja] = character.name_en;
  return map;
}, {});

// デュオアイコンのキャッシュ
const duoIconCache = ref({});

// デュオアイコンを取得する関数
const getDuoIcon = async (duoCharaName) => {
  if (!duoCharaName) return null;
  
  // キャッシュされている場合は返す
  if (duoIconCache.value[duoCharaName]) {
    return duoIconCache.value[duoCharaName];
  }
  
  // 日本語名を英語名に変換
  const enName = jpName2enName[duoCharaName];
  if (!enName) return null;
  
  try {
    // 動的インポートを使用してアイコンを取得
    const module = await import(`@/assets/img/icon/${enName}.png`);
    duoIconCache.value[duoCharaName] = module.default;
    return module.default;
  } catch (error) {
    duoIconCache.value[duoCharaName] = defaultImg;
    return defaultImg;
  }
};

// デュオアイコンの同期版（テンプレートで使用）
const getDuoIconSync = (duoCharaName) => {
  if (!duoCharaName) return null;
  
  // 非同期で読み込みを開始（キャッシュされていない場合）
  if (!duoIconCache.value[duoCharaName]) {
    getDuoIcon(duoCharaName);
  }
  
  return duoIconCache.value[duoCharaName] || null;
};

// デュオが有効かどうか判定する関数
const isDuoActive = (character) => {
  if (!character || !character.duo) return false;
  
  // 入れ替え対象のキャラクターを除外した仮想デッキを作成
  const virtualDeck = [];
  deckCharacters.value.forEach((deckChar, index) => {
    // 入れ替え対象のインデックスをスキップ
    if (index !== props.charaIndex && deckChar.chara) {
      virtualDeck.push(deckChar.chara);
    }
  });
  
  // 候補キャラクターを仮想デッキに追加
  virtualDeck.push(character.chara);
  
  // デュオ相手が仮想デッキに含まれているかチェック
  return virtualDeck.includes(character.duo);
};

const characterStore = useCharacterStore();
const { characters } = storeToRefs(characterStore);
const simulatorStore = useSimulatorStore();
const { deckCharacters } = storeToRefs(simulatorStore);
const filterdStore = useFilterdStore();

const loadingImgUrl = ref(false);

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
  { text: 'DUO数', value: 'duoCount' },
  { text: 'DUO相手', value: 'duoPartner' }
];

const sortOrderOptions = [
  { text: '昇順', value: 'asc' },
  { text: '降順', value: 'desc' }
];

// ソート設定の保存と監視
watch(sortBy, (newValue, oldValue) => {
  localStorage.setItem('simCharaModal_sortBy', newValue);
  // 新しい項目を選択した場合のみ、デフォルト順とDUO相手以外は降順を初期値にする
  if (newValue !== oldValue && newValue !== 'default' && newValue !== 'duoPartner') {
    sortOrder.value = 'desc';
  } else if (newValue === 'default' || newValue === 'duoPartner') {
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
} else if (sortBy.value !== 'default' && sortBy.value !== 'duoPartner' && !localStorage.getItem('simCharaModal_sortOrder')) {
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
  
  // 未使用の変数を削除
  
  // 軽量な統計計算のためのショートカット
  if (['deckHPBuddyCount', 'deckBuddyCount', 'duoCount'].includes(sortKey)) {
    // 軽量な統計はメンバー名のみで判定可能
    const memberNameDict = getOptimizedMemberNameSet(candidateCharacter, props.charaIndex >= 0 ? props.charaIndex : null);
    const memberNameSet = new Set(Object.keys(memberNameDict));
    
    let totalHPBuddy = 0;
    let totalBuddy = 0;
    let totalDuo = 0;
    
    // デュオカウント用のフラグ管理（デッキ探索ツールと同じロジック）
    const name2DuoUsed = {}; // デュオ使用者として使用済み
    const name2MotherUsed = {}; // Motherとして使用済み  
    const name2M2Used = {}; // M2として使用済み
    
    // 最適化：バディとデュオの高速カウント
    virtualDeck.forEach((chara, index) => {
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
    });
    
    // デュオ判定（デッキ探索ツールと同じ3段階判定）
    
    // 1. 相互デュオチェック（最優先）
    virtualDeck.forEach((chara, index) => {
      if (!chara.duo || !memberNameDict[chara.duo] || name2DuoUsed[index]) {
        return;
      }
      
      for (let partnerIndex = 0; partnerIndex < virtualDeck.length; partnerIndex++) {
        if (partnerIndex === index) continue;
        const partner = virtualDeck[partnerIndex];
        if (partner && partner.chara === chara.duo && partner.duo === chara.chara) {
          if (!name2DuoUsed[index] && !name2DuoUsed[partnerIndex]) {
            name2DuoUsed[index] = true;
            name2DuoUsed[partnerIndex] = true;
            name2M2Used[index] = true;
            name2M2Used[partnerIndex] = true;
            totalDuo += 2; // 2人がデュオ魔法を使用
            break;
          }
        }
      }
    });
    
    // 2. Motherデュオチェック（M2ではないキャラをパートナーとする）
    virtualDeck.forEach((chara, index) => {
      if (!chara.duo || !memberNameDict[chara.duo] || name2DuoUsed[index] || name2M2Used[index]) {
        return;
      }
      
      for (let partnerIndex = 0; partnerIndex < virtualDeck.length; partnerIndex++) {
        if (partnerIndex === index) continue;
        const partner = virtualDeck[partnerIndex];
        if (partner && partner.chara === chara.duo) {
          if (!name2MotherUsed[partnerIndex]) {
            name2DuoUsed[index] = true;
            name2M2Used[index] = true;
            name2MotherUsed[partnerIndex] = true;
            totalDuo += 1;
            break;
          }
        }
      }
    });
    
    // 3. M2デュオチェック（今まで使われていないM2をパートナーとする）
    virtualDeck.forEach((chara, index) => {
      if (!chara.duo || !memberNameDict[chara.duo] || name2DuoUsed[index] || name2M2Used[index]) {
        return;
      }
      
      for (let partnerIndex = 0; partnerIndex < virtualDeck.length; partnerIndex++) {
        if (partnerIndex === index) continue;
        const partner = virtualDeck[partnerIndex];
        if (partner && partner.chara === chara.duo) {
          if (!name2M2Used[partnerIndex]) {
            name2DuoUsed[index] = true;
            name2M2Used[index] = true;
            name2M2Used[partnerIndex] = true;
            totalDuo += 1;
            break;
          }
        }
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
                          buffValue.includes('属性ダメUP') ? '属性ダメUP' :
                          buffValue.includes('ダメUP') ? 'ダメージUP' :
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
    
    // デュオ判定は後でまとめて行うため、ここでは初期値を設定
    if (recalculatedChara.duo) {
      recalculatedChara.magic2Power = recalculatedChara.magic2pow || '連撃(強)';
    }
    
    // ダメージ計算は後でまとめて行う
    
    recalculatedVirtualDeck.push(recalculatedChara);
  }

  // デュオ判定を正確に行う（デッキ探索ツールと同じロジック）
  const name2DuoUsed = {}; // デュオ使用者として使用済み
  const name2MotherUsed = {}; // Motherとして使用済み  
  const name2M2Used = {}; // M2として使用済み
  
  // デュオ判定（3段階判定）
  
  // 1. 相互デュオチェック（最優先）
  recalculatedVirtualDeck.forEach((chara, index) => {
    if (!chara.duo || !fullMemberNameDict[chara.duo] || name2DuoUsed[index]) {
      return;
    }
    
    for (let partnerIndex = 0; partnerIndex < recalculatedVirtualDeck.length; partnerIndex++) {
      if (partnerIndex === index) continue;
      const partner = recalculatedVirtualDeck[partnerIndex];
      if (partner && partner.chara === chara.duo && partner.duo === chara.chara) {
        if (!name2DuoUsed[index] && !name2DuoUsed[partnerIndex]) {
          name2DuoUsed[index] = true;
          name2DuoUsed[partnerIndex] = true;
          name2M2Used[index] = true;
          name2M2Used[partnerIndex] = true;
          break;
        }
      }
    }
  });
  
  // 2. Motherデュオチェック（M2ではないキャラをパートナーとする）
  recalculatedVirtualDeck.forEach((chara, index) => {
    if (!chara.duo || !fullMemberNameDict[chara.duo] || name2DuoUsed[index] || name2M2Used[index]) {
      return;
    }
    
    for (let partnerIndex = 0; partnerIndex < recalculatedVirtualDeck.length; partnerIndex++) {
      if (partnerIndex === index) continue;
      const partner = recalculatedVirtualDeck[partnerIndex];
      if (partner && partner.chara === chara.duo) {
        if (!name2MotherUsed[partnerIndex]) {
          name2DuoUsed[index] = true;
          name2M2Used[index] = true;
          name2MotherUsed[partnerIndex] = true;
          break;
        }
      }
    }
  });
  
  // 3. M2デュオチェック（今まで使われていないM2をパートナーとする）
  recalculatedVirtualDeck.forEach((chara, index) => {
    if (!chara.duo || !fullMemberNameDict[chara.duo] || name2DuoUsed[index] || name2M2Used[index]) {
      return;
    }
    
    for (let partnerIndex = 0; partnerIndex < recalculatedVirtualDeck.length; partnerIndex++) {
      if (partnerIndex === index) continue;
      const partner = recalculatedVirtualDeck[partnerIndex];
      if (partner && partner.chara === chara.duo) {
        if (!name2M2Used[partnerIndex]) {
          name2DuoUsed[index] = true;
          name2M2Used[index] = true;
          name2M2Used[partnerIndex] = true;
          break;
        }
      }
    }
  });
  
  // デュオ判定結果をキャラクターのMagic2Powerに反映
  recalculatedVirtualDeck.forEach((chara, index) => {
    chara.magic2Power = name2DuoUsed[index] ? 'デュオ' : (chara.magic2pow || '連撃(強)');
  });
  
  // デュオ判定後、全キャラクターの統計を再計算（ダメージ計算が必要な場合）
  if (sortKey === 'deckDamage') {
    recalculatedVirtualDeck.forEach((chara) => {
      calculateCharacterStats(chara, fullMemberNameDict);
    });
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
    
    // HP回復分計算（選択されたマジックのみ）
    let hpHeal = 0;
    let hpConHeal = 0;
    
    // マジック選択状態を考慮した回復計算
    if (chara.isM1Selected) {
      hpHeal += calcHealRate(chara.magic1heal, 10) * chara.atk;
      hpConHeal += calcConHealRate(chara.magic1heal, 10) * chara.hp;
    }
    if (chara.isM2Selected) {
      hpHeal += calcHealRate(chara.magic2heal, 10) * chara.atk;
      hpConHeal += calcConHealRate(chara.magic2heal, 10) * chara.hp;
    }
    if (chara.isM3Selected) {
      hpHeal += calcHealRate(chara.magic3heal, 10) * chara.atk;
      hpConHeal += calcConHealRate(chara.magic3heal, 10) * chara.hp;
    }
    
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

// Props定義
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

// 最適化されたデータ構造の遅延初期化
let _optimizedDataStructuresCache = null;
let _optimizedDataStructuresInitialized = false;

// 最適化されたデータ構造：高速ルックアップテーブル
const optimizedDataStructures = computed(() => {
  // キャッシュが既に存在する場合は返す
  if (_optimizedDataStructuresInitialized && _optimizedDataStructuresCache) {
    return _optimizedDataStructuresCache;
  }
  
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
  
  // キャッシュに保存
  _optimizedDataStructuresCache = {
    characterIndexMap,
    characterByName,
    charactersByRarity,
    duoCharacterMap,
    buddyCharacterMap
  };
  _optimizedDataStructuresInitialized = true;
  
  return _optimizedDataStructuresCache;
});

// ソート用計算値のキャッシュ
const sortCache = ref(new Map());

// ソートキャッシュをクリアする関数
const clearSortCache = () => {
  sortCache.value.clear();
};

// 画像読み込みキューをリセットする関数
const resetImageLoadingQueue = () => {
  // 画像読み込みキューをクリア
  imageLoadingQueue.clear();
  
  // Observerを再設定
  if (imageObserver) {
    imageObserver.disconnect();
    // DOM更新後に再設定
    nextTick(() => {
      setupImageObserver();
    });
  }
};

// watchでソート条件が変更されたらキャッシュをクリア
watch([sortBy, sortOrder, () => props.selectedAttribute], () => {
  clearSortCache();
  clearMemberNameCache();
  resetImageLoadingQueue();
});

// デッキキャラクターが変更されたらキャッシュをクリア
watch(() => deckCharacters.value.map(c => ({ chara: c.chara, level: c.level, hp: c.hp, atk: c.atk })), () => {
  clearSortCache();
  clearMemberNameCache();
}, { deep: true });

// キャラクターの画像読み込み状態を初期化
const initializeImageState = () => {
  // 遅延初期化でモーダル表示を高速化
};

// ソート中フラグ
const isSorting = ref(false);

// フィルター・ソート済みのキャラクターリスト（非同期対応）
const filteredAndSortedCharacters = ref([]);

// フィルター適用済みのキャラクターリスト
const filteredCharacters = computed(() => filteredAndSortedCharacters.value);

// フィルターとソートの処理を非同期化
const updateFilteredCharacters = async () => {
  isSorting.value = true;
  
  // リアクティブな依存関係を明示的に参照
  const currentSortBy = sortBy.value;
  const currentSortOrder = sortOrder.value;
  // ソート強制更新カウンターを参照して強制更新を有効化
  sortUpdateCounter.value;
  
  // 新しい配列を作成（Vue リアクティブシステム対応）
  let filtered = [...characters.value.filter(character => {
    // visibleフラグをチェック（FilterModalから適用されたフィルター）
    if (!character.visible) return false;
    
    return true;
  })];

  // 最適化されたデータ構造を取得 (デフォルトソートとDUO相手ソートの場合に必要)
  let dataStructures = null;
  if (currentSortBy === 'default' || currentSortBy === 'duoPartner') {
    dataStructures = optimizedDataStructures.value;
  }

  // ソート処理
  if (currentSortBy === 'default') {
    // デフォルト順：最適化されたインデックスマップを使用
    filtered.sort((a, b) => {
      const aIndex = dataStructures.characterIndexMap.get(a.chara) ?? 999999;
      const bIndex = dataStructures.characterIndexMap.get(b.chara) ?? 999999;
      
      return currentSortOrder === 'desc' ? bIndex - aIndex : aIndex - bIndex;
    });
    filteredAndSortedCharacters.value = filtered;
    isSorting.value = false;
  } else if (['effectiveDeckHP', 'deckDamage', 'deckHPBuddyCount', 'deckBuddyCount', 'minBuddyHPIncrease', 'duoCount'].includes(currentSortBy)) {
    // 高コストなソートの場合は非同期処理
    // まずフィルターされた結果を即座に表示
    filteredAndSortedCharacters.value = [...filtered];
    
    // 非同期でソート計算を実行
    requestAnimationFrame(async () => {
      // 各キャラクターのソート値を計算
      const charactersWithValues = await Promise.all(
        filtered.map(async (character) => {
          // 計算をバッチ処理
          await new Promise(resolve => setTimeout(resolve, 0));
          const value = calculateDeckStats(character, currentSortBy);
          return { character, value };
        })
      );
      
      // ソート
      charactersWithValues.sort((a, b) => {
        const comparison = a.value - b.value;
        return currentSortOrder === 'desc' ? -comparison : comparison;
      });
      
      // 結果を更新
      filteredAndSortedCharacters.value = charactersWithValues.map(item => item.character);
      isSorting.value = false;
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
        case 'duoPartner': {
          // DUO相手の名前をデフォルト順（characterDataのインデックス）でソート
          const aIndex = a.duo ? (dataStructures.characterIndexMap.get(a.duo) ?? 999999) : 999999;
          const bIndex = b.duo ? (dataStructures.characterIndexMap.get(b.duo) ?? 999999) : 999999;
          aValue = aIndex;
          bValue = bIndex;
          break;
        }
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
    
    filteredAndSortedCharacters.value = filtered;
    isSorting.value = false;
  }
};

// ソート条件変更時に更新
watch([sortBy, sortOrder, () => characters.value.filter(c => c.visible).length], () => {
  updateFilteredCharacters();
}, { immediate: true });

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
    case 'duoPartner':
      return character.duo || 'なし';
    case 'effectiveCardHP': {
      const effectiveHP = calculateEffectiveCardHP(character, getOptimizedMemberNameSet(null, props.charaIndex));
      const roundedHP = Math.round(effectiveHP);
      return roundedHP;
    }
    case 'effectiveCardATK':
      return Math.round(calculateEffectiveCardATK(character, getOptimizedMemberNameSet(null, props.charaIndex)));
    case 'effectiveDeckHP':
    case 'deckDamage':
    case 'deckHPBuddyCount':
    case 'deckBuddyCount':
    case 'minBuddyHPIncrease':
    case 'duoCount': {
      const value = calculateDeckStats(character, currentSortBy);
      return Math.round(value);
    }
    default:
      return character.chara || character.name;
  }
}

// 画像読み込みエラーのハンドラー
const handleImageError = (character) => {
  // 画像読み込みエラー時はデフォルト画像を設定
  character.imgUrl = defaultImg;
  character.imageLoaded = true;
};

// 画像の遅延読み込み
let imageObserver = null;
const imageLoadingQueue = new Set();

// 並列読み込みの設定
const INITIAL_LOAD_COUNT = 50; // 初期読み込み数
const BATCH_SIZE = 30; // スクロール時のバッチサイズ
const MAX_CONCURRENT = 100; // 最大同時読み込み数

// 並列読み込みを実行する関数（バッチ処理対応）
const loadImagesInParallel = async (charactersToLoad, batchSize = MAX_CONCURRENT) => {
  // 既に読み込み済みのキャラクターを除外
  const toLoad = charactersToLoad.filter(character => 
    !character.imageLoaded || 
    !character.imgUrl || 
    character.imgUrl === 'placeholder'
  );
  
  if (toLoad.length === 0) return;
  
  // 大量のキャラクターをバッチに分割して処理
  for (let i = 0; i < toLoad.length; i += batchSize) {
    const batch = toLoad.slice(i, i + batchSize);
    
    const promises = batch.map(character => {
      return import(`@/assets/img/${character.name}.png`)
        .then(module => {
          character.imgUrl = module.default;
          character.imageLoaded = true;
        })
        .catch(() => {
          character.imgUrl = defaultImg;
          character.imageLoaded = true;
        })
        .finally(() => {
          // キューから削除
          imageLoadingQueue.delete(character.name);
        });
    });
    
    // バッチを並列で実行
    await Promise.all(promises);
    
    // 小さな遅延でブラウザをブロックしないように
    if (i + batchSize < toLoad.length) {
      await new Promise(resolve => setTimeout(resolve, 1));
    }
  }
};

// Observerを設定する関数
const setupImageObserver = () => {
  const imageWrappers = document.querySelectorAll('.character-image-wrapper');
  imageWrappers.forEach(wrapper => {
    if (imageObserver) {
      imageObserver.observe(wrapper);
    }
  });
  
  // 最初の大量の画像を即座に読み込む（非同期）
  requestAnimationFrame(() => {
    const visibleCharacters = filteredCharacters.value.slice(0, INITIAL_LOAD_COUNT);
    if (visibleCharacters.length > 0) {
      loadImagesInParallel(visibleCharacters, 50); // 初期読み込みはさらに高速化
    }
  });
  
  // バックグラウンドで残りの画像を遅延読み込み
  setTimeout(() => {
    const remainingCharacters = filteredCharacters.value.slice(INITIAL_LOAD_COUNT);
    if (remainingCharacters.length > 0) {
      loadImagesInParallel(remainingCharacters, 20); // バックグラウンド読み込み
    }
  }, 500); // 500ms後に開始
};

const loadCharacterImages = () => {
  // 既存のオブザーバーがあれば切断
  if (imageObserver) {
    imageObserver.disconnect();
  }
  
  // すぐにloadingImgUrlをfalseにして枠を表示
  loadingImgUrl.value = false;
  
  // IntersectionObserverを使った遅延読み込み（最適化）
  imageObserver = new IntersectionObserver((entries) => {
    const charactersToLoad = [];
    
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const characterName = entry.target.getAttribute('data-character-name');
        const character = characters.value.find(c => c.name === characterName && c.visible);
        
        if (character && !character.imageLoaded && !imageLoadingQueue.has(character.name)) {
          imageLoadingQueue.add(character.name);
          charactersToLoad.push(character);
        }
        
        // 観察を停止
        imageObserver.unobserve(entry.target);
      }
    });
    
    // 複数の画像を並列で読み込み（バッチサイズ指定）
    if (charactersToLoad.length > 0) {
      loadImagesInParallel(charactersToLoad, BATCH_SIZE);
    }
  }, {
    rootMargin: '200px', // 画面に入る200px前から読み込み開始（拡大）
    threshold: 0.01 // 少しでも見えたら読み込み開始
  });
  
  // Vue.nextTickを使用してDOMの更新後に監視を開始
  nextTick(() => {
    setupImageObserver();
  });
};

// filteredCharactersの変更を監視してIntersectionObserverを再設定
watch(filteredCharacters, () => {
  // DOM更新後にIntersectionObserverを再設定
  nextTick(() => {
    loadCharacterImages();
  });
});

// モーダル初期化時にフィルター状態を設定
const initializeModalFilter = () => {
  // 保存された状態がない場合のみSSRデフォルト設定を適用
  if (filterdStore.isFirst) {
    // フィルター状態をSSRのみに設定
    filterdStore.tempSelectedCharacters = characterData.map(student => student.name_en);
    filterdStore.tempSelectedRare = ['SSR']; // SSRのみ
    filterdStore.tempSelectedType = ['バランス', 'ディフェンス', 'アタック'];
    filterdStore.tempSelectedAttr = ['火', '水', '木', '無'];
    filterdStore.tempSelectedEffects = ['ATKUP', 'ダメージUP', 'クリティカル', '属性ダメージUP', '被ダメージUP', 'ATKDOWN', 'ダメージDOWN', '回避', '属性ダメージDOWN', '被ダメージDOWN', 'HP回復', 'HP継続回復', '暗闇無効', '呪い無効', '凍結無効', 'デバフ解除', '呪い'];
    
    // localStorage に保存
    filterdStore.saveCurrentState();
    filterdStore.isFirst = false;
  }
  
  // 最適化：早期退出とキャッシュを使用
  const selectedRareSet = new Set(filterdStore.tempSelectedRare);
  const selectedTypeSet = new Set(filterdStore.tempSelectedType);
  const selectedAttrSet = new Set(filterdStore.tempSelectedAttr);
  const selectedCharactersSet = new Set(filterdStore.tempSelectedCharacters);
  const allEffectsSelected = filterdStore.tempSelectedEffects.length === 17;
  
  // SSRキャラクターのみをまず抽出
  const ssrCharacters = [];
  const nonSsrCharacters = [];
  
  for (let i = 0; i < characters.value.length; i++) {
    const character = characters.value[i];
    if (character.rare === 'SSR') {
      ssrCharacters.push(character);
    } else {
      nonSsrCharacters.push(character);
    }
  }
  
  // 変更が必要なもののみ更新
  const updatesNeeded = [];
  
  // 非SSRキャラクターで visible=true になっているもののみ更新対象に
  for (let i = 0; i < nonSsrCharacters.length; i++) {
    const character = nonSsrCharacters[i];
    if (character.visible !== false) {
      updatesNeeded.push({ character, newValue: false });
    }
  }
  
  // SSRキャラクターの詳細フィルタリング結果を収集
  for (let i = 0; i < ssrCharacters.length; i++) {
    const character = ssrCharacters[i];
    let shouldBeVisible = false;
    
    // キャラクターチェック
    const characterInfo = characterDataMap.get(character.chara);
    if (characterInfo && selectedCharactersSet.has(characterInfo.name_en)) {
      // タイプチェック
      if (selectedTypeSet.has(character.attr)) {
        // 属性チェック
        if (selectedAttrSet.has(character.magic1atr) ||
            selectedAttrSet.has(character.magic2atr) ||
            selectedAttrSet.has(character.magic3atr)) {
          
          // 効果チェック
          if (allEffectsSelected) {
            shouldBeVisible = true;
          } else if (filterdStore.tempSelectedEffects.length > 0) {
            for (let j = 0; j < filterdStore.tempSelectedEffects.length; j++) {
              if (character.etc.indexOf(filterdStore.tempSelectedEffects[j]) !== -1) {
                shouldBeVisible = true;
                break;
              }
            }
          }
        }
      }
    }
    
    // 現在の値と異なる場合のみ更新対象に追加
    if (character.visible !== shouldBeVisible) {
      updatesNeeded.push({ character, newValue: shouldBeVisible });
    }
  }
  
  // 実際に変更が必要なもののみ更新
  for (let i = 0; i < updatesNeeded.length; i++) {
    const update = updatesNeeded[i];
    update.character.visible = update.newValue;
  }
};

// 遅延初期化のユーティリティ関数
const ensureImagePropertiesInitialized = (character) => {
  if (!('imageLoaded' in character)) {
    character.imageLoaded = false;
  }
  if (!character.imgUrl || character.imgUrl === 'placeholder') {
    character.imgUrl = null;
  }
};

const ensureVisiblePropertiesInitialized = (character) => {
  if (!('visible' in character)) {
    character.visible = false; // フィルター適用前は非表示
  }
};

// コンポーネントがマウントされた後に初期化
onMounted(async () => {
  try {
    // フィルター適用前に全キャラクターのvisibleを初期化（非表示から開始）
    characters.value.forEach(ensureVisiblePropertiesInitialized);
    
    // 高速初期化：最小限の処理のみ
    initializeImageState();
    
    // 初期フィルター・ソートを実行（フィルター処理前）
    updateFilteredCharacters();
    
    // モーダル表示後にフィルター処理を非同期で実行（UIをブロックしない）
    setTimeout(() => {
      initializeModalFilter();
      
      // フィルター適用後にソートを更新
      nextTick(() => {
        updateFilteredCharacters();
      });
    }, 0);
    
    // 初期化はフィルターされたキャラクターのみに対して実行
    requestAnimationFrame(() => {
      loadCharacterImages();
    });
    
    // バックグラウンドでプリロード
    setTimeout(() => {
      const allVisibleCharacters = characters.value.filter(c => c.visible);
      if (allVisibleCharacters.length > INITIAL_LOAD_COUNT) {
        const remainingCharacters = allVisibleCharacters.slice(INITIAL_LOAD_COUNT);
        loadImagesInParallel(remainingCharacters, 10);
      }
    }, 100);
  } catch (error) {
    console.error('SimCharaModal:onMounted - Error during initialization:', error);
  }
});

// filteredAndSortedCharactersが変更されたときにObserverを再設定
watch(filteredAndSortedCharacters, () => {
  if (imageObserver && !isSorting.value) {
    nextTick(() => {
      setupImageObserver();
    });
  }
}, { flush: 'post' });

// クリーンアップ
onUnmounted(() => {
  if (imageObserver) {
    imageObserver.disconnect();
  }
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

.character-image-wrapper {
  position: relative;
  width: 100%;
  padding-top: 100%; /* 1:1 アスペクト比 */
  background-color: #f5f5f5;
  border-radius: 3px;
  overflow: hidden;
}

.character-image {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  border-radius: 3px;
  object-fit: cover;
}

.character-image-placeholder {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: #f5f5f5;
}

.placeholder-content {
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0.5;
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

/* デュオアイコンのスタイル */
.modal-duo-icon-container {
  position: absolute;
  top: 1px;
  left: 1px;
  width: 14px;
  height: 14px;
  border-radius: 10%;
  border: 1px solid #fff;
  background-color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.2);
  transition: all 0.2s ease;
}

/* デュオが有効な場合のスタイル */
.modal-duo-icon-container.duo-active {
  border-color: #ff0000;
  background-color: #E8F5E8;
}

/* デュオが無効な場合のスタイル */
.modal-duo-icon-container:not(.duo-active) {
  border-color: #999;
  background-color: #f5f5f5;
}

.modal-duo-icon-container:not(.duo-active) .modal-duo-icon {
  filter: grayscale(100%);
  opacity: 0.7;
}

/* デュオアイコン画像 */
.modal-duo-icon {
  width: 12px;
  height: 12px;
  object-fit: cover;
  border-radius: 10%;
}

</style>
