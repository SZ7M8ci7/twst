<template>
  <v-container class="finisher-container">
    <!-- ローディング表示 -->
    <div v-if="loading" class="loading-container">
      <v-progress-circular
        indeterminate
        color="primary"
        :size="64"
      ></v-progress-circular>
      <p class="loading-text">Loading...</p>
    </div>

    <!-- メインコンテンツ -->
    <template v-else>
      <!-- 属性表示を1行目に追加 -->
      <div class="character-row">
        <div class="character-item" :style="{ ...iconStyle }">
          <!-- 空のスペース -->
        </div>
        <div class="damage-row">
          <div
            v-for="element in ['Fire', 'Water', 'Flora', 'Cosmic']"
            :key="element"
            class="damage-col"
          >
            <div class="damage-item clickable-header" @click="toggleSort(element.toLowerCase())">
              <div class="header-content">
                <span class="vs-text">VS</span>
                <img
                  :src="getElementIconUrl(element.toLowerCase())"
                  :alt="element"
                  class="element-icon"
                />
                <span class="sort-icon">
                  <span v-if="sortColumn === element.toLowerCase()" class="sort-indicator">
                    {{ sortDirection === 'asc' ? '↑' : '↓' }}
                  </span>
                  <span v-else class="sort-hint">↕</span>
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- ALL行を最上部に固定表示 -->
      <div class="character-row all-characters-row">
        <div class="character-item" :style="{ ...iconStyle }">
          <div class="all-characters-label">ALL</div>
        </div>
        <div class="damage-row">
          <div
            v-for="element in ['Fire', 'Water', 'Flora', 'Cosmic']"
            :key="element"
            class="damage-col"
          >
            <div class="damage-item all-characters-item">
              <span
                class="clickable-damage"
                @click="openAllCharactersModal(element.toLowerCase() as 'fire' | 'water' | 'flora' | 'cosmic')"
              >
                {{ getMaxDamage('全キャラ', element.toLowerCase() as 'fire' | 'water' | 'flora' | 'cosmic') }}
              </span>
            </div>
          </div>
        </div>
      </div>
      <div
        v-for="character in sortedCharacterData"
        :key="character.name_en"
        class="character-row"
      >
        <div class="character-item" :style="{ ...iconStyle }">
          <img
            :src="imgUrlDictionary[character.name_en]"
            :alt="character.name_en"
            class="character-image"
          />
        </div>
        <div class="damage-row">
          <div
            v-for="element in ['Fire', 'Water', 'Flora', 'Cosmic']"
            :key="element"
            class="damage-col"
          >
            <div class="damage-item">
              <span
                class="clickable-damage"
                @click="openDamageModal(character.name_ja, element.toLowerCase() as 'fire' | 'water' | 'flora' | 'cosmic')"
              >
                {{ getMaxDamage(character.name_ja, element.toLowerCase() as 'fire' | 'water' | 'flora' | 'cosmic') }}
              </span>
            </div>
          </div>
        </div>
      </div>
    </template>

    <!-- モーダル -->
    <v-dialog v-model="dialogVisible" max-width="450">
      <v-card>
        <v-card-text class="modal-content">
          <v-list class="damage-list">
            <v-list-item
              v-for="(entry, index) in sortedDamageList"
              :key="index"
              class="damage-list-item"
            >
              <div class="damage-item-content">
                <div class="card-info">
                  <img
                    :src="getCardImageUrl(entry.cardName)"
                    :alt="entry.cardName"
                    class="card-icon clickable-icon"
                    @click="openWikiPage(entry.cardName)"
                  />
                  <div class="buddy-cards" v-if="entry.cardName">
                    <img
                      v-for="buddyCard in getBuddyCards(entry.cardName)"
                      :key="buddyCard"
                      :src="getCardImageUrl(buddyCard)"
                      :alt="buddyCard"
                      class="buddy-icon clickable-icon"
                      @click="openWikiPage(buddyCard)"
                    />
                  </div>
                </div>
                <div class="buff-info" v-if="entry.name">
                  <div class="buff-container">
                    <img
                      :src="getCardImageUrl(entry.name)"
                      :alt="entry.name"
                      class="buff-icon clickable-icon"
                      @click="openWikiPage(entry.name)"
                    />
                    <span class="buff-source" v-if="entry.buffSource">{{ entry.buffSource }}</span>
                  </div>
                </div>
                <div class="damage-value">
                  {{ Math.floor(entry.damage).toLocaleString() }}
                </div>
              </div>
            </v-list-item>
          </v-list>
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn color="primary" variant="text" @click="dialogVisible = false">Close</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- 全キャラクター情報モーダル -->
    <v-dialog v-model="allCharactersDialogVisible" max-width="450">
      <v-card>
        <v-card-text class="modal-content">
          <v-list class="damage-list">
            <v-list-item
              v-for="(entry, index) in sortedAllCharactersDamageList"
              :key="index"
              class="damage-list-item"
            >
              <div class="damage-item-content">
                <div class="card-info">
                  <img
                    :src="getCardImageUrl(entry.cardName)"
                    :alt="entry.cardName"
                    class="card-icon clickable-icon"
                    @click="openWikiPage(entry.cardName)"
                  />
                  <div class="buddy-cards" v-if="entry.cardName">
                    <img
                      v-for="buddyCard in getBuddyCards(entry.cardName)"
                      :key="buddyCard"
                      :src="getCardImageUrl(buddyCard)"
                      :alt="buddyCard"
                      class="buddy-icon clickable-icon"
                      @click="openWikiPage(buddyCard)"
                    />
                  </div>
                </div>
                <div class="buff-info" v-if="entry.buffName">
                  <div class="buff-container">
                    <img
                      :src="getCardImageUrl(entry.buffName)"
                      :alt="entry.buffName"
                      class="buff-icon clickable-icon"
                      @click="openWikiPage(entry.buffName)"
                    />
                    <span class="buff-source" v-if="entry.buffSource">{{ entry.buffSource }}</span>
                  </div>
                </div>
                <div class="damage-value">
                  {{ Math.floor(entry.damage).toLocaleString() }}
                </div>
              </div>
            </v-list-item>
          </v-list>
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn color="primary" variant="text" @click="allCharactersDialogVisible = false">Close</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </v-container>
</template>

<script setup lang="ts">
import { useCharacterStore } from '@/store/characters';
import { storeToRefs } from 'pinia';
import { useImageUrlDictionary } from '@/components/common';
import { onMounted, ref, Ref, computed } from 'vue';
import characterData from '@/assets/characters_info.json';
const characterStore = useCharacterStore();
const { characters } = storeToRefs(characterStore);
const imgUrlDictionary: Ref<Record<string, string>> = ref({});
const elementIconDictionary: Ref<Record<string, string>> = ref({});


const iconSize = 50;
const gapSize = 10;

const iconStyle = ref({
  '--icon-size': `${iconSize}px`,
  '--gap-size': `${gapSize}px`
});

// 属性アイコンの辞書を追加
const elementIcons = {
  fire: 'fire',
  water: 'water',
  flora: 'flora',
  cosmic: 'cosmic'
};

// ローディング状態を管理
const loading = ref(true);

onMounted(async () => {
  try {
    // 画像の読み込み
    await Promise.all(characters.value.map(character => {
      return import(`@/assets/img/${character.name}.png`)
        .then(module => {
          character.imgUrl = module.default;
        })
        .catch(() => {
          character.imgUrl = ''; // 画像の読み込みに失敗した場合
        });
    }));

    // キャラクター画像の辞書を作成
    imgUrlDictionary.value = await useImageUrlDictionary(characterData);

    // 属性アイコンの読み込み
    await Promise.all(Object.entries(elementIcons).map(async ([key, value]) => {
      try {
        const module = await import(`@/assets/img/icon/${value}.png`);
        elementIconDictionary.value[key] = module.default;
      } catch {
        elementIconDictionary.value[key] = '';
      }
    }));
  } finally {
    loading.value = false;
  }
});

// 型宣言
interface Effect { 
  buff: string; 
  name: string;
  buffSource: string;
}
interface DamageByCard { 
  damage: number; 
  name: string;
  cardName?: string;
  buffSource?: string;
}

const effectDict: Record<string, Effect[]> = {}; // キャラ名をキー、効果リストを値とする辞書

// バフ値関連定数
const buffValues = ['(極小)', '(小)', '(中)', '(大)', '(極大)']
const buffTypes = ['ATKUP', 'ダメージUP', '無属性ダメージUP', '火属性ダメージUP', '水属性ダメージUP', '木属性ダメージUP', '被ダメージUP']
const atkBuffDict: { [key: string]: number } = {
  'ATKUP(極小)': 0.1,
  'ATKUP(小)': 0.2,
  'ATKUP(中)': 0.35,
  'ATKUP(大)': 0.5,
  'ATKUP(極大)': 0.8,
};

// 画面表示用項目：キャラごとの最大ダメージ
const maxFireDamageByCharaDict: { [key: string]: number } = {};
const maxWaterDamageByCharaDict: { [key: string]: number } = {};
const maxFloraDamageByCharaDict: { [key: string]: number } = {};
const maxCosmicDamageByCharaDict: { [key: string]: number } = {};
// 画面表示用項目：カード毎のダメージとバフ要員リスト
const fireDamageListByCardDict: { [key: string]: DamageByCard[] } = {};
const waterDamageListByCardDict: { [key: string]: DamageByCard[] } = {};
const floraDamageListByCardDict: { [key: string]: DamageByCard[] } = {};
const cosmicDamageListByCardDict: { [key: string]: DamageByCard[] } = {};


// キャラ名をキーとして、バフ効果を持つカード名と効果値を辞書に追加
characters.value.forEach(character => {
  // etcをカンマで分割
  const etcItems = character.etc.split(',');

  // キャラ名をキーとして初期化
  if (!effectDict[character.chara]) {
    effectDict[character.chara] = [];
  }

  // 各効果をチェックし、キャラのリストに追加
  etcItems.forEach(item => {
    const trimmedItem = item.trim();
    if (!trimmedItem.includes('味方') && !(trimmedItem.includes('被ダメージUP') && trimmedItem.includes('相手'))) return;
    buffTypes.forEach(buffType => {
      // 〇属性ダメージUPとダメージUPを区別するために、バフの種別で文字列が始まっているかチェックする
      if (trimmedItem.startsWith(buffType)) {
        // 効果値毎に区別して辞書に追加
        buffValues.forEach(buffValue => {
          
          if (trimmedItem.includes(buffValue)) {
            // バフの種類を判定
            let buffbuffSource = '';
            if (trimmedItem.includes('(M1)')) buffbuffSource = 'M1';
            else if (trimmedItem.includes('(M2)')) buffbuffSource = 'M2';
            else if (trimmedItem.includes('(M3)')) buffbuffSource = 'M3';
            
            effectDict[character.chara].push({ 
              buff: buffType + buffValue, 
              name: character.name,
              buffSource: buffbuffSource
            });
          }
        });
      }
    });
  });
});
// カード毎のダメージ計算
characters.value.forEach(character => {
  // SSR以外は計算しない
  if (character.rare != 'SSR') return;

  // ATKバディーボーナス値計算
  const buddyBonus = calcBuddy(character.buddy1s) + calcBuddy(character.buddy2s) + calcBuddy(character.buddy3s);
  // 自己3TATKバフ計算
  const selfAtkBuff = calcSelfAtkUp(character.etc);
  // 自己3Tダメージバフ計算
  const selfDamageBuff = calcSelfDamageUp(character.etc);
  // 対各属性最大ダメージ
  let maxFireDamage = 0;
  let maxWaterDamage = 0;
  let maxFloraDamage = 0;
  let maxCosmicDamage = 0;

  // ダメージ計算関数
  function calcDamage(atr: string, partnerBuff: string, partnerName: string, buffSource: string) {
    const atkPartnerBuff = atkBuffDict[partnerBuff] || 0;
    // バフ込みのATK値
    const atk = character.atk + character.atk * buddyBonus + character.atk * selfAtkBuff + character.atk * atkPartnerBuff;
    let partnerDamageBuff = 0;
    const cosmicRatio = atr === '無' ? 1.1 : 1; // 無属性ダメージ補正
    // 味方のバフ値計算
    if (partnerBuff.includes(atr + '属性ダメージUP')) {
        if (partnerBuff.includes('(極小)')) partnerDamageBuff = 0.025;
        if (partnerBuff.includes('(小)')) partnerDamageBuff = 0.06;
        if (partnerBuff.includes('(中)')) partnerDamageBuff = 0.105;
        if (partnerBuff.includes('(大)')) partnerDamageBuff = 0.15;
        if (partnerBuff.includes('(極大)')) partnerDamageBuff = 0.27;
    } else {
        if (partnerBuff.includes('ダメージUP') && !partnerBuff.includes('属性ダメージUP')) {
          if (partnerBuff.includes('(極小)')) partnerDamageBuff = 0.0225;
          if (partnerBuff.includes('(小)')) partnerDamageBuff = 0.05;
          if (partnerBuff.includes('(中)')) partnerDamageBuff = 0.0875;
          if (partnerBuff.includes('(大)')) partnerDamageBuff = 0.125;
          if (partnerBuff.includes('(極大)')) partnerDamageBuff = 0.225;
      }
    }

    if (partnerBuff != '' && atkPartnerBuff == 0 && partnerDamageBuff == 0) {
      return;
    }
    // 等倍ダメージ
    const basedamage = Math.floor(atk * (cosmicRatio + selfDamageBuff + partnerDamageBuff) * 2.4);
    if (!fireDamageListByCardDict[character.name]) {
      fireDamageListByCardDict[character.name] = [];
      waterDamageListByCardDict[character.name] = [];
      floraDamageListByCardDict[character.name] = [];
      cosmicDamageListByCardDict[character.name] = [];
    }

    // 各属性でのダメージ値をキャラクターごとの最大ダメージと、カード毎のダメージ値で保存
    // 属性ごとの係数を辞書で定義
    const attributeModifiers: Record<string, { fire: number; water: number; flora: number; cosmic: number }> = {
      '無': { fire: 1, water: 1, flora: 1, cosmic: 1 },
      '火': { fire: 1, water: 0.5, flora: 1.5, cosmic: 1 },
      '水': { fire: 1.5, water: 1, flora: 0.5, cosmic: 1 },
      '木': { fire: 0.5, water: 1.5, flora: 1, cosmic: 1 },
    };

    // 属性の係数を取得
    const modifiers = attributeModifiers[atr] || { fire: 1, water: 1, flora: 1, cosmic: 1 };

    // 各属性でのダメージ値を計算し、最大ダメージとリストに保存
    maxFireDamage = Math.max(basedamage * modifiers.fire, maxFireDamage);
    maxWaterDamage = Math.max(basedamage * modifiers.water, maxWaterDamage);
    maxFloraDamage = Math.max(basedamage * modifiers.flora, maxFloraDamage);
    maxCosmicDamage = Math.max(basedamage * modifiers.cosmic, maxCosmicDamage);

    // ダメージリストを更新
    console.log(buffSource);
    fireDamageListByCardDict[character.name].push({ 
      damage: basedamage * modifiers.fire, 
      name: partnerName,
      buffSource: buffSource
    });
    waterDamageListByCardDict[character.name].push({ 
      damage: basedamage * modifiers.water, 
      name: partnerName,
      buffSource: buffSource
    });
    floraDamageListByCardDict[character.name].push({ 
      damage: basedamage * modifiers.flora, 
      name: partnerName,
      buffSource: buffSource
    });
    cosmicDamageListByCardDict[character.name].push({ 
      damage: basedamage * modifiers.cosmic, 
      name: partnerName,
      buffSource: buffSource
    });
  }
  // 味方バフ無しで計算
  calcDamage(character.magic2atr, '', getEnglishName(character.duo), '');
  // 味方バフ有りで計算
  effectDict[character.duo].forEach(duoPartner => {
    calcDamage(character.magic2atr, duoPartner.buff, duoPartner.name, duoPartner.buffSource);
  });
  if (!maxFireDamageByCharaDict[character.chara]) {
    maxFireDamageByCharaDict[character.chara] = 0;
    maxWaterDamageByCharaDict[character.chara] = 0;
    maxFloraDamageByCharaDict[character.chara] = 0;
    maxCosmicDamageByCharaDict[character.chara] = 0;
  }
  maxFireDamageByCharaDict[character.chara] = Math.max(maxFireDamageByCharaDict[character.chara], maxFireDamage);
  maxWaterDamageByCharaDict[character.chara] = Math.max(maxWaterDamageByCharaDict[character.chara], maxWaterDamage);
  maxFloraDamageByCharaDict[character.chara] = Math.max(maxFloraDamageByCharaDict[character.chara], maxFloraDamage);
  maxCosmicDamageByCharaDict[character.chara] = Math.max(maxCosmicDamageByCharaDict[character.chara], maxCosmicDamage);
});

// ATKバディ計算
function calcBuddy(buddy: string) {
  if (buddy.includes('ATK') && buddy.includes('小')) {
    return 0.2;
  }
  if (buddy.includes('ATK') && buddy.includes('中')) {
    return 0.35;
  }
  return 0;
}

// 自己ATKバフ計算
function calcSelfAtkUp(value: string) {
  if (value.includes('ATKUP(極小)(自/3T)')) {
    return 0.1;
  }
  if (value.includes('ATKUP(小)(自/3T)')) {
    return 0.2;
  }
  if (value.includes('ATKUP(中)(自/3T)')) {
    return 0.35;
  }
  if (value.includes('ATKUP(大)(自/3T)')) {
    return 0.5;
  }
  return 0;
}

// 自己ダメージバフ計算
function calcSelfDamageUp(value: string) {
  if (value.includes('ダメージUP(極小)(自/3T)')) {
    return 0.02;
  }
  if (value.includes('ダメージUP(小)(自/3T)')) {
    return 0.05;
  }
  if (value.includes('ダメージUP(中)(自/3T)')) {
    return 0.0875;
  }
  if (value.includes('ダメージUP(大)(自/3T)')) {
    return 0.125;
  }
  // フェロー用
  if (value.includes('被ダメージUP(中)(相手全体/2T)')) {
    return 0.0875;
  }
  return 0;
}


const cardNameDict: Record<string, string[]> = {}; // キャラ名をキー、カード名を値とする辞書

// キャラ名をキーとして、カード名を辞書に追加
characters.value.forEach(character => {
  if (character.rare != 'SSR') return;

  // キャラ名をキーとして初期化
  if (!cardNameDict[character.chara]) {
    cardNameDict[character.chara] = [];
  }

  cardNameDict[character.chara].push(character.name);

});

// const openPanels = ref<Record<string, { fire: number[]; water: number[]; flora: number[]; cosmic: number[] }>>({});
const openPanels = ref<Record<string, Record<string, number[]>>>({});

characterData.forEach((character) => {
  openPanels.value[character.name_en] = {
    fire: [],
    water: [],
    flora: [],
    cosmic: []
  };
});


// モーダル関連
const dialogVisible = ref(false);
const selectedDamageList = ref<DamageByCard[]>([]);
const selectedCardName = ref('');
const selectedElement = ref('');

function openDamageModal(charaName: string, element: string) {
  const damageDict = getDamageListByElement(element as 'fire' | 'water' | 'flora' | 'cosmic');
  const cardList = cardNameDict[charaName];
  if (!cardList || cardList.length === 0) return;
  
  // 全てのカードのダメージ情報を結合
  const allDamageList = cardList.flatMap(card => {
    const damageList = damageDict[card] || [];
    return damageList.map(damage => ({
      ...damage,
      cardName: card // カード名を追加
    }));
  });

  selectedDamageList.value = allDamageList;
  selectedCardName.value = charaName;
  selectedElement.value = element;
  dialogVisible.value = true;
}

// 型定義の追加
type ElementType = 'fire' | 'water' | 'flora' | 'cosmic';

function getDamageListByElement(element: ElementType) {
  const dict = {
    fire: fireDamageListByCardDict,
    water: waterDamageListByCardDict,
    flora: floraDamageListByCardDict,
    cosmic: cosmicDamageListByCardDict
  };
  return dict[element];
}

// ソート関連の状態
const sortColumn = ref<string>('');
const sortDirection = ref<'asc' | 'desc'>('desc');

// ソート機能の実装
function toggleSort(column: string) {
  if (sortColumn.value === column) {
    sortDirection.value = sortDirection.value === 'asc' ? 'desc' : 'asc';
  } else {
    sortColumn.value = column;
    sortDirection.value = 'desc';
  }
}

// ソート済みのキャラクターデータを計算
const sortedCharacterData = computed(() => {
  if (!sortColumn.value) return characterData;

  return [...characterData].sort((a, b) => {
    const aValue = getMaxDamage(a.name_ja, sortColumn.value as ElementType);
    const bValue = getMaxDamage(b.name_ja, sortColumn.value as ElementType);
    
    // 数値に変換（'-'の場合は0として扱う）
    const aNum = typeof aValue === 'number' ? aValue : 0;
    const bNum = typeof bValue === 'number' ? bValue : 0;
    
    return sortDirection.value === 'asc' 
      ? aNum - bNum 
      : bNum - aNum;
  });
});

// getMaxDamage関数を修正して小数点を切り捨て
function getMaxDamage(charaName: string, element: ElementType): number | string {
  if (charaName === '全キャラ') {
    const damageDict = getDamageListByElement(element);
    const maxDamage = characters.value
      .filter(character => character.rare === 'SSR')
      .reduce((max, character) => {
        const damageList = damageDict[character.name] || [];
        const characterMaxDamage = Math.max(...damageList.map(d => d.damage), 0);
        return Math.max(max, characterMaxDamage);
      }, 0);
    return Math.floor(maxDamage);
  }

  const dict = {
    fire: maxFireDamageByCharaDict,
    water: maxWaterDamageByCharaDict,
    flora: maxFloraDamageByCharaDict,
    cosmic: maxCosmicDamageByCharaDict
  };
  const value = dict[element]?.[charaName];
  return value ? Math.floor(value) : '-';
}

// カード画像のURLを取得する関数
function getCardImageUrl(cardName: string | undefined): string {
  if (!cardName) return '';
  const character = characters.value.find(char => char.name === cardName);
  return character?.imgUrl || imgUrlDictionary.value[cardName];
}

// ダメージリストを降順でソート
const sortedDamageList = computed(() => {
  return [...selectedDamageList.value].sort((a: DamageByCard, b: DamageByCard) => b.damage - a.damage);
});

// 日本語名から英名を取得する関数
function getEnglishName(japaneseName: string): string {
  const character = characterData.find(char => char.name_ja === japaneseName);
  return character?.name_en as string || '';
}

// 属性アイコンのURLを取得する関数を更新
function getElementIconUrl(element: string): string {
  return elementIconDictionary.value[element] || '';
}

// Wikiページを開く関数を追加
function openWikiPage(cardName: string | undefined) {
  if (!cardName) return;
  const character = characters.value.find(char => char.name === cardName);
  if (character?.wikiURL) {
    window.open(character.wikiURL, '_blank');
  }
}

// 全キャラクター情報モーダル関連の状態を追加
const allCharactersDialogVisible = ref(false);
const allCharactersDamageList = ref<{ cardName: string; damage: number; buffName: string; buffSource: string }[]>([]);
const selectedAllCharactersElement = ref<ElementType>('fire');

// 全キャラクター情報モーダルを開く関数
function openAllCharactersModal(element: ElementType) {
  selectedAllCharactersElement.value = element;
  const damageDict = getDamageListByElement(element);
  
  // 全キャラクターの全カード・全バフのダメージ情報を結合
  allCharactersDamageList.value = characters.value
    .filter(character => character.rare === 'SSR')
    .flatMap(character => {
      const damageList = damageDict[character.name] || [];
      // 各カード・バフの全ダメージ情報を取得
      return damageList.map(d => ({
        cardName: character.name,
        damage: d.damage,
        buffName: d.name || '',
        buffSource: d.buffSource || ''
      }));
    });

  allCharactersDialogVisible.value = true;
}

// 全キャラクターのダメージリストを降順でソート
const sortedAllCharactersDamageList = computed(() => {
  return [...allCharactersDamageList.value].sort((a, b) => b.damage - a.damage);
});

// バディーカードの情報を取得する関数を修正
function getBuddyCards(cardName: string) {
  const character = characters.value.find(char => char.name === cardName);
  if (!character) return [];
  
  const buddyCards = [];
  if (character.buddy1c && character.buddy1s.includes('ATK')) buddyCards.push(getEnglishName(character.buddy1c));
  if (character.buddy2c && character.buddy2s.includes('ATK')) buddyCards.push(getEnglishName(character.buddy2c));
  if (character.buddy3c && character.buddy3s.includes('ATK')) buddyCards.push(getEnglishName(character.buddy3c));
  
  return buddyCards;
}

</script>
<style scoped>
.finisher-container {
  padding: 8px;
  max-width: 100%;
  overflow-x: hidden;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.character-row {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-bottom: 8px;
  flex-wrap: nowrap;
  min-width: 0;
  width: 100%;
  max-width: 800px;
  justify-content: center;
}

.character-item {
  margin: 2px;
  width: var(--icon-size);
  height: var(--icon-size);
  transition: border 0.3s ease;
  flex-shrink: 0;
  margin-right: 0;
}

.character-item img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  border-radius: 8px;
  cursor: pointer;
  z-index: 1;
  position: relative;
}

.damage-row {
  display: flex;
  gap: 4px;
  flex-wrap: nowrap;
  align-items: center;
  flex: 1;
  margin: 0;
  min-width: 0;
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
  scrollbar-width: none;
  -ms-overflow-style: none;
  justify-content: center;
  padding-left: 0;
  max-width: 600px;
}

.damage-row::-webkit-scrollbar {
  display: none;
}

.damage-col {
  min-width: 80px;
  max-width: 120px;
  padding: 0;
  flex: 1;
}

.damage-item {
  padding: 4px;
  background-color: #f5f5f5;
  border-radius: 4px;
  margin-bottom: 4px;
  text-align: center;
  font-weight: 500;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.header-content {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  width: 100%;
  min-width: 0;
}

.vs-text {
  font-weight: bold;
  color: #1976d2;
  font-size: 0.8em;
  white-space: nowrap;
}

.element-icon {
  width: 24px;
  height: 24px;
  object-fit: contain;
  flex-shrink: 0;
}

.clickable-header {
  cursor: pointer;
  user-select: none;
  position: relative;
  transition: all 0.2s ease;
  background-color: #f5f5f5;
  border: 1px solid #e0e0e0;
  min-height: 40px;
}

.clickable-header:hover {
  background-color: #e3f2fd;
  border-color: #1976d2;
}

.sort-icon {
  display: inline-flex;
  align-items: center;
  color: #666;
  font-size: 0.8em;
  flex-shrink: 0;
}

.sort-indicator {
  color: #1976d2;
  font-weight: bold;
}

.sort-hint {
  opacity: 0.5;
  font-size: 0.7em;
}

.clickable-damage {
  color: #1976d2;
  cursor: pointer;
  text-decoration: underline;
  font-size: 0.9em;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 100%;
}

@media (max-width: 600px) {
  .character-row {
    max-width: 100%;
  }

  .damage-row {
    max-width: 100%;
  }

  .damage-col {
    min-width: 70px;
  }

  .element-icon {
    width: 20px;
    height: 20px;
  }

  .vs-text {
    font-size: 0.7em;
  }

  .damage-item {
    padding: 2px;
    height: 36px;
  }

  .clickable-damage {
    font-size: 0.8em;
  }

  :deep(.v-overlay__content) {
    margin: 0 !important;
    left: 0 !important;
    right: 0 !important;
    inset: 0 !important;
    width: 100vw !important;
    min-width: 100vw !important;
    max-width: 100vw !important;
    padding: 0 !important;
    position: fixed !important;
    box-sizing: border-box !important;
    padding-top: 12px !important;
  }
  :deep(.v-dialog .v-card) {
    width: 100vw !important;
    min-width: 100vw !important;
    max-width: 100vw !important;
    margin: 0 !important;
    padding: 0 !important;
    border-radius: 0 !important;
    box-sizing: border-box !important;
  }
}

.modal-content {
  padding: 0 !important;
  max-height: 95vh;
  overflow-y: auto;
}

.damage-list {
  background: transparent;
  padding: 0;
  margin: 0;
}

.damage-list-item {
  padding: 12px 8px;
  border-bottom: 1px solid #eee;
  background: white;
  margin-bottom: 0px;
  border-radius: 6px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.08);
  min-height: 56px;
  display: flex;
  align-items: center;
}

.damage-item-content {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  width: 100%;
  padding: 0;
  margin: 0;
}

.card-info {
  display: flex;
  align-items: center;
  gap: 1px;
  min-width: 125px;
  flex: 1;
}

.buff-info {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 80px;
  flex: 1;
  justify-content: flex-start;
}

.buff-container {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 80px;
  justify-content: flex-start;
}

.buddy-cards {
  display: flex;
  gap: 1px;
  align-items: center;
}

.buff-source {
  font-size: 0.85em;
  font-weight: bold;
  color: #6e7072;
  border-radius: 4px;
  white-space: nowrap;
  margin-left: 0px;
  padding: 0px 0px;
}

.card-icon, .buff-icon {
  width: 46px;
  height: 46px;
  border-radius: 8px;
  object-fit: cover;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.12);
  cursor: pointer;
  transition: transform 0.2s ease;
}

.buddy-icon {
  width: 26px;
  height: 26px;
  border-radius: 4px;
  object-fit: cover;
  box-shadow: 0 1px 1px rgba(0, 0, 0, 0.12);
  cursor: pointer;
  transition: transform 0.2s ease;
}

.damage-value {
  font-weight: bold;
  color: #1976d2;
  min-width: 90px;
  text-align: right;
  font-size: 1em;
  padding: 0 8px;
  background: #f5f5f5;
  border-radius: 8px;
  flex: 1;
  display: flex;
  justify-content: flex-start;
  align-items: center;
}

.loading-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 200px;
  gap: 16px;
}

.loading-text {
  color: #666;
  font-size: 1.2em;
  margin-top: 8px;
}

.all-characters-row {
  margin-top: 16px;
  border-top: 2px solid #e0e0e0;
  padding-top: 8px;
}

.all-characters-label {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  font-weight: bold;
  color: #1976d2;
  background-color: #e3f2fd;
  border-radius: 8px;
}

.all-characters-item {
  background-color: #e3f2fd;
  border: 1px solid #1976d2;
}

.v-dialog .v-card {
  margin-left: auto !important;
  margin-right: auto !important;
}

:deep(.v-card.v-theme--light.v-card--density-default.v-card--variant-elevated) {
  margin: 7px !important;
  margin-top: 20px !important;
}
</style>