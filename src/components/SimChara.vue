<template>
  <div class="component-container">
    <div>
      <v-row dense>
        <v-col cols="2" class="center">
          <div class="image-section">
            <div class="character-icon-container">
              <img :src="imgpath" alt="Character" class="character-image" @click="openCharaModal" />
              <!-- デュオ相手のアイコン -->
              <div 
                v-if="duoPartnerIcon" 
                class="duo-icon-container"
                :class="{ 'duo-active': isDuoActive }"
                :title="duoTooltipText"
              >
                <img 
                  :src="duoPartnerIcon" 
                  alt="Duo Partner" 
                  class="duo-icon"
                  @error="handleDuoIconError"
                />
              </div>
            </div>
          </div>
        </v-col>
        <v-col cols="3" class="center">
          <div class="stats-section">
            <div class="stat">
              <button class="bonusbutton" :class="{'selected': isBonusSelected}" @click="toggleBonus">凸</button>
              <label>Lv</label>
              <input 
                type="number" 
                :value="simulatorStore.deckCharacters[props.charaIndex].level"
                @input="handleLevelInput"
                class="stat-input" 
                min="0"
                :max="getMaxLevel(simulatorStore.deckCharacters[props.charaIndex].rare)"
              />
            </div>
            <div class="stat">
              <label>HP</label>
              <input type="number" v-model="simulatorStore.deckCharacters[props.charaIndex].hp" class="stat-input" />
            </div>
            <div class="stat">
              <label>ATK</label>
              <input type="number" v-model="simulatorStore.deckCharacters[props.charaIndex].atk" class="stat-input" />
            </div>
          </div>
        </v-col>
        <v-col cols="5" style="margin-top: 2px;">
          <div v-for="index in getMagicCount()" :key="index" class="stat">
            <v-row dense>
              <v-col cols="2">
                <button :class="{'mbutton': true, 'selected': simulatorStore.deckCharacters[props.charaIndex][`isM${index}Selected`], 'shake': shakingStates[`isM${index}Shaking`]}" @click="toggleM(index)">M{{ index }}</button>
              </v-col>
              <v-col cols="2">
                <ElementDropdown :chara-index="props.charaIndex" :element-index="index"/>
              </v-col>
              <v-col :cols="windowWidth >= 360 ? (showBuddyIcon() ? 2 : 3) : 0">
                <select
                  v-if="windowWidth >= 360"
                  v-model="simulatorStore.deckCharacters[props.charaIndex][`magic${index}Lv`]"
                  class="level-select"
                  :style="getLevelSelectStyle()"
                >
                  <option disabled value="">Lv</option>
                  <option v-for="n in 10" :key="n" :value="n">Lv{{ n }}</option>
                </select>
              </v-col>
              <!-- 魔法ドロップダウン: 残りの列数を計算 -->
              <v-col :cols="getMagicDropdownCols()">
                <MagicDropdown
                  v-model="simulatorStore.deckCharacters[props.charaIndex][`magic${index}Power`]"
                  :style="getMagicDropdownStyle()"
                />
              </v-col>
              <!-- バディキャラアイコン -->
              <v-col v-if="showBuddyIcon()" cols="1" class="buddy-icon-col" :class="{ 'buddy-inactive': !isBuddyActive(index) }">
                <img
                  v-if="simulatorStore.deckCharacters[props.charaIndex][`buddy${index}c`] && getBuddyIconSync(simulatorStore.deckCharacters[props.charaIndex][`buddy${index}c`])"
                  :src="getBuddyIconSync(simulatorStore.deckCharacters[props.charaIndex][`buddy${index}c`])"
                  :alt="simulatorStore.deckCharacters[props.charaIndex][`buddy${index}c`]"
                  class="buddy-icon"
                  :title="simulatorStore.deckCharacters[props.charaIndex][`buddy${index}c`]"
                />
              </v-col>
              <!-- バディ効果値 -->
              <v-col v-if="showBuddyEffect()" cols="2" class="buddy-effect-col" :class="{ 'buddy-inactive': !isBuddyActive(index) }">
                <span v-if="simulatorStore.deckCharacters[props.charaIndex][`buddy${index}s`]" class="buddy-effect">
                  {{ formatBuddyEffect(simulatorStore.deckCharacters[props.charaIndex][`buddy${index}s`]) }}
                </span>
              </v-col>
            </v-row>
          </div>
        </v-col>
        <v-col cols="2" class="center">
          <div class="buttons-section">
            <button class="details-btn tall" @click="openDetailModal" title="詳細編集">
              <v-icon size="16">mdi-cog</v-icon>
            </button>
            <button
              class="buff-btn bottom-aligned"
              @click="addBuff"
              title="バフ追加"
              :class="{ 'drop-target': isBuffDragging }"
              @dragenter.prevent="onBuffButtonDragEnter"
              @dragover.prevent="onBuffButtonDragOver"
              @dragleave.prevent="onBuffButtonDragLeave"
              @drop.prevent="onBuffButtonDrop"
            >
              <v-icon size="16">mdi-plus</v-icon>
            </button>
          </div>
        </v-col>
      </v-row>
    </div>
    <v-row dense>
      <div
        class="buff-list"
        :class="{}"
        @dragenter.prevent="onBuffListDragEnter"
        @dragover.prevent="onBuffListDragOver"
        @dragleave="onBuffListDragLeave"
        @drop.prevent="onBuffListDrop"
      >
        <div
          v-if="!simulatorStore.deckCharacters[props.charaIndex].buffs.length"
          class="buff-drop-empty"
          :class="{ 'active': dropInsertIndex === 0, 'drop-blink': isBuffDragging }"
          @dragenter.prevent="onEmptyBuffDragEnter"
          @dragover.prevent="onEmptyBuffDragEnter"
          @dragleave="onEmptyBuffDragLeave"
          @drop.prevent="onEmptyBuffDrop"
        ></div>
        <template v-for="(buff, index) in simulatorStore.deckCharacters[props.charaIndex].buffs" :key="`buff-${index}`">
          <div
            class="buff-section"
            :class="{
              'manually-added': buff.isManuallyAdded,
              'drag-before': dropInsertIndex === index,
              'drag-after': dropInsertIndex === index + 1,
              'drop-blink': isBuffDragging && (dropInsertIndex === index || dropInsertIndex === index + 1),
              'drop-front': isBuffDragging,
              'drop-tail': isBuffDragging && isBuffRowEnd(index)
            }"
            @dragenter.prevent="onBuffDragEnter(index, $event)"
            @dragover.prevent="onBuffDragOver(index, $event)"
            @dragleave.self="onBuffDragLeave(index)"
            @drop.prevent="onBuffDrop(index, $event)"
          >
            <button
              class="drag-handle"
              :draggable="canReorderBuffs"
              @dragstart.stop="onBuffDragStart(index, $event)"
              @dragend="onBuffDragEnd"
              title="ドラッグで順番を変更"
              aria-label="バフの並び替え"
            >
              <v-icon size="14">mdi-drag-vertical</v-icon>
            </button>
            <div class="buff-dropdown-wrapper">
              <BuffDropdown
                v-model="simulatorStore.deckCharacters[props.charaIndex].buffs[index]"
                @buff-changed="handleBuffChanged"
              />
            </div>
          </div>
        </template>
      </div>
    </v-row>
    <SimCharaModal v-if="isCharaModalOpen" :chara-index="props.charaIndex" :selected-attribute="props.selectedAttribute" @close="closeCharaModal" @select="selectCharaImage" />
    <SimCharaDetailModal
      v-model="isDetailModalOpen"
      :character="simulatorStore.deckCharacters[props.charaIndex]"
      @save="saveDetailChanges"
    />
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onUnmounted } from 'vue';
import defaultImg from '@/assets/img/default.webp';
import ElementDropdown from './ElementDropdown.vue';
import SimCharaModal from './SimCharaModal.vue';
import MagicDropdown from './MagicDropdown.vue';
import BuffDropdown from './BuffDropdown.vue';
import SimCharaDetailModal from './SimCharaDetailModal.vue';
import { useSimulatorStore } from '@/store/simulatorStore';
import { useHandCollectionStore } from '@/store/handCollection';
import charactersInfo from '@/assets/characters_info.json';
import { buffDragPayload } from '@/utils/buffDragState';

const simulatorStore = useSimulatorStore();
const handCollectionStore = useHandCollectionStore();

const imgpath = ref(defaultImg);
const props = defineProps(['charaIndex', 'selectedAttribute']);

// SimCharaModalの制御
const isCharaModalOpen = ref(false);
const isDetailModalOpen = ref(false);

// Modalを開く
const openCharaModal = () => {
  isCharaModalOpen.value = true;
};

// Modalを閉じる
const closeCharaModal = () => {
  isCharaModalOpen.value = false;
};

// 詳細編集モーダルを開く
const openDetailModal = () => {
  isDetailModalOpen.value = true;
};

// 詳細編集モーダルを閉じる
const closeDetailModal = () => {
  isDetailModalOpen.value = false;
};

// 画像を選択したときに呼ばれる
const selectCharaImage = async (chara) => {
  // 共通関数を使用してキャラクター選択処理を実行
  const processedChara = await processCharacterSelection(chara);
  
  // デュオキャラクターの効果を設定（初期設定後に実行して上書きを防ぐ）
  if (processedChara.duo && simulatorStore.charaDict[processedChara.duo]) {
    processedChara.magic2Power = 'デュオ';
  }

  // キャラクター選択時にselectCharacterを呼び出す
  simulatorStore.selectCharacter(props.charaIndex, processedChara);
  
  // 手持ちコレクション設定に基づいてレベルとボーナス状態を更新
  if (handCollectionStore.useHandCollection) {
    // deckCharactersのレベルとボーナス状態を更新
    simulatorStore.deckCharacters[props.charaIndex].level = processedChara.level;
    simulatorStore.deckCharacters[props.charaIndex].isBonusSelected = processedChara.isBonusSelected;
    
    // ステータスを再計算して更新
    const newStats = simulatorStore.calculateBaseStats(simulatorStore.deckCharacters[props.charaIndex]);
    simulatorStore.deckCharacters[props.charaIndex].atk = newStats.atk;
    simulatorStore.deckCharacters[props.charaIndex].hp = newStats.hp;
  }
  
  // 全ステータスを再計算
  simulatorStore.recalculateStats();
  
  // 画像を更新
  if (processedChara.imgUrl) {
    imgpath.value = processedChara.imgUrl;
  } else {
    imgpath.value = defaultImg;
  }
  
  // ボーナス選択状態を更新
  isBonusSelected.value = processedChara.isBonusSelected;
  closeCharaModal();
};


// M1, M2, M3 ボタンの選択状態
const isBonusSelected = ref(false);

// 揺れアニメーションの制御
const shakingStates = ref( {
        isM1Shaking: false,
        isM2Shaking: false,
        isM3Shaking: false,
      });
let shakeTimeout = null;

// 共通関数をインポート
import { processCharacterSelection } from '@/utils/characterSelection';

const addBuff = () => {
  const character = simulatorStore.deckCharacters[props.charaIndex];
  
  // buffs配列が存在しない場合は初期化
  if (!character.buffs) {
    character.buffs = [];
  }
  
  // 空のバフを追加（全ての値を空文字列に設定）
  character.buffs.push({
    magicOption: '',
    buffOption: '',
    powerOption: '',
    levelOption: 10,
    isManuallyAdded: true // 手動追加フラグ
  });
};

// バフの並び替え可否
const canReorderBuffs = computed(() => {
  const character = simulatorStore.deckCharacters[props.charaIndex];
  return !!(character?.buffs && character.buffs.length > 0);
});

// Drag state for buff reorder
const draggingBuffIndex = ref(null);
const dropInsertIndex = ref(null);

const isBuffDragging = computed(() => buffDragPayload.fromBuffIndex !== null);

const resetBuffDragState = () => {
  draggingBuffIndex.value = null;
  dropInsertIndex.value = null;
  buffDragPayload.fromCharaIndex = null;
  buffDragPayload.fromBuffIndex = null;
};

const hasBuffDragSource = () => buffDragPayload.fromBuffIndex !== null || draggingBuffIndex.value !== null;

const onBuffDragStart = (index, event) => {
  const character = simulatorStore.deckCharacters[props.charaIndex];
  if (!character?.buffs || character.buffs.length === 0) return;

  draggingBuffIndex.value = index;
  dropInsertIndex.value = null; // フォーカス時の挙動を変えない
  buffDragPayload.fromCharaIndex = props.charaIndex;
  buffDragPayload.fromBuffIndex = index;
  isBuffDragging.value = true;

  if (event?.dataTransfer) {
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', String(index));
  }
};

const updateDropPosition = (index, event) => {
  if (!hasBuffDragSource()) return;
  const rect = event.currentTarget.getBoundingClientRect();
  const isSingleColumn = windowWidth.value < 600;
  let isAfter;

  if (isSingleColumn) {
    isAfter = (event.clientY - rect.top) > rect.height / 2;
  } else {
    const leftZone = rect.width * 0.35;
    isAfter = (event.clientX - rect.left) > leftZone;
  }
  dropInsertIndex.value = isAfter ? index + 1 : index;
};

const onBuffDragEnter = (index, event) => {
  if (!hasBuffDragSource()) return;
  updateDropPosition(index, event);
};

const onBuffDragOver = (index, event) => {
  if (!hasBuffDragSource()) return;
  updateDropPosition(index, event);
};

const onBuffDragLeave = (index) => {
  // 末尾への挿入位置（length）は消さない
  const len = simulatorStore.deckCharacters[props.charaIndex].buffs.length;
  if (dropInsertIndex.value === len) return;
  if (dropInsertIndex.value === index || dropInsertIndex.value === index + 1) {
    dropInsertIndex.value = null;
  }
};

const onBuffDrop = (index, event) => {
  const targetCharaIndex = props.charaIndex;
  const targetCharacter = simulatorStore.deckCharacters[targetCharaIndex];
  if (!targetCharacter.buffs) targetCharacter.buffs = [];
  const targetBuffs = targetCharacter.buffs;

  const fromCharaIndex = buffDragPayload.fromCharaIndex ?? targetCharaIndex;
  const sourceCharacter = simulatorStore.deckCharacters[fromCharaIndex];
  if (!sourceCharacter?.buffs || !sourceCharacter.buffs.length) {
    resetBuffDragState();
    return;
  }

  const sourceIndexRaw = buffDragPayload.fromBuffIndex ?? draggingBuffIndex.value;
  if (sourceIndexRaw === null || sourceIndexRaw === undefined) {
    resetBuffDragState();
    return;
  }
  const fromIndex = Math.max(0, Math.min(sourceIndexRaw, sourceCharacter.buffs.length - 1));

  if (fromIndex === null) {
    resetBuffDragState();
    return;
  }

  if (event) {
    updateDropPosition(index, event);
  }

  const preferredIndex = dropInsertIndex.value !== null ? dropInsertIndex.value : index;
  let targetIndex = Math.max(0, Math.min(preferredIndex, targetBuffs.length));

  if (fromCharaIndex === targetCharaIndex) {
    // 同一キャラ内の並び替え
    if (fromIndex === targetIndex || fromIndex + 1 === targetIndex) {
      resetBuffDragState();
      return;
    }

    const [movedBuff] = targetBuffs.splice(fromIndex, 1);
    if (fromIndex < targetIndex) {
      targetIndex = Math.max(0, targetIndex - 1);
    }
    targetIndex = Math.max(0, Math.min(targetIndex, targetBuffs.length));
    targetBuffs.splice(targetIndex, 0, movedBuff);
  } else {
    // 別キャラへの移動
    const [movedBuff] = sourceCharacter.buffs.splice(fromIndex, 1);
    const copied = JSON.parse(JSON.stringify(movedBuff));
    copied.isManuallyAdded = true;
    targetBuffs.splice(targetIndex, 0, copied);
  }

  simulatorStore.recalculateStats();
  resetBuffDragState();
};

const onBuffDragEnd = () => {
  resetBuffDragState();
};

const onEmptyBuffDragEnter = () => {
  if (!hasBuffDragSource()) return;
  dropInsertIndex.value = 0;
};

const onEmptyBuffDragLeave = () => {
  if (dropInsertIndex.value === 0) {
    dropInsertIndex.value = null;
  }
};

const onEmptyBuffDrop = (event) => {
  onBuffDrop(0, event);
};

const copyBuffToCurrent = (sourceCharaIndex, sourceBuffIndex) => {
  const sourceCharacter = simulatorStore.deckCharacters[sourceCharaIndex];
  if (!sourceCharacter?.buffs || sourceBuffIndex == null) return;
  const buff = sourceCharacter.buffs[sourceBuffIndex];
  if (!buff) return;

  const targetCharacter = simulatorStore.deckCharacters[props.charaIndex];
  if (!targetCharacter.buffs) targetCharacter.buffs = [];
  // ディープコピーで追加
  const copied = JSON.parse(JSON.stringify(buff));
  copied.isManuallyAdded = true;
  targetCharacter.buffs.push(copied);
  simulatorStore.recalculateStats();
};

const onBuffButtonDragEnter = () => {
  if (!hasBuffDragSource()) return;
  dropInsertIndex.value = simulatorStore.deckCharacters[props.charaIndex].buffs.length;
};

const onBuffButtonDragOver = () => {
  if (!hasBuffDragSource()) return;
  dropInsertIndex.value = simulatorStore.deckCharacters[props.charaIndex].buffs.length;
};

const onBuffButtonDragLeave = () => {
  dropInsertIndex.value = null;
};

const onBuffButtonDrop = () => {
  if (!hasBuffDragSource()) return;
  const fromCharaIndex = buffDragPayload.fromCharaIndex ?? props.charaIndex;
  const sourceIndexRaw = buffDragPayload.fromBuffIndex ?? draggingBuffIndex.value;
  if (sourceIndexRaw === null || sourceIndexRaw === undefined) return;
  copyBuffToCurrent(fromCharaIndex, sourceIndexRaw);
  resetBuffDragState();
};

const onBuffListDragEnter = () => {
  if (!hasBuffDragSource()) return;
  const len = simulatorStore.deckCharacters[props.charaIndex].buffs.length;
  dropInsertIndex.value = len;
};

const onBuffListDragOver = () => {
  if (!hasBuffDragSource()) return;
  const len = simulatorStore.deckCharacters[props.charaIndex].buffs.length;
  dropInsertIndex.value = len;
};

const onBuffListDragLeave = () => {
  const len = simulatorStore.deckCharacters[props.charaIndex].buffs.length;
  if (dropInsertIndex.value === len) {
    dropInsertIndex.value = null;
  }
};

const onBuffListDrop = (event) => {
  const len = simulatorStore.deckCharacters[props.charaIndex].buffs.length;
  onBuffDrop(len, event);
};

const getBuffColumns = () => {
  const width = windowWidth.value;
  if (width >= 1400) return 3;
  if (width >= 1200) return 2;
  if (width >= 960) return 2;
  if (width >= 900) return 3;
  if (width >= 600) return 2;
  return 1;
};

const isBuffRowEnd = (index) => {
  const cols = getBuffColumns();
  const buffs = simulatorStore.deckCharacters[props.charaIndex].buffs || [];
  const isLast = index === buffs.length - 1;
  if (cols <= 1) return isLast;
  const rowEnd = (index + 1) % cols === 0;
  // 行が埋まっていない最終行でも末尾の右側に線を出す
  return rowEnd || isLast;
};

const toggleBonus = () => {
  isBonusSelected.value = !isBonusSelected.value;
  const character = simulatorStore.deckCharacters[props.charaIndex];
  character.isBonusSelected = isBonusSelected.value;
  // ボーナス状態が変更されたら再計算
  const newStats = simulatorStore.calculateBaseStats(character);
  // 計算結果を直接反映
  character.atk = newStats.atk;
  character.hp = newStats.hp;
  // 全ステータスを再計算
  simulatorStore.recalculateStats();
};

// characters_info.jsonから日本語名から英語名への変換マップを動的に生成
const jpName2enName = charactersInfo.reduce((map, character) => {
  map[character.name_ja] = character.name_en;
  return map;
}, {});

// デュオ相手のアイコンを取得するcomputed
const duoPartnerIcon = ref(null);

// バディアイコンのキャッシュ
const buddyIconCache = ref({});

// バディアイコンを取得する関数
const getBuddyIcon = async (buddyCharaName) => {
  if (!buddyCharaName) return null;
  
  // キャッシュされている場合は返す
  if (buddyIconCache.value[buddyCharaName]) {
    return buddyIconCache.value[buddyCharaName];
  }
  
  // 日本語名を英語名に変換
  const enName = jpName2enName[buddyCharaName];
  if (!enName) return null;
  
  try {
    // 動的インポートを使用してアイコンを取得
    const module = await import(`@/assets/img/icon/${enName}.webp`);
    buddyIconCache.value[buddyCharaName] = module.default;
    return module.default;
  } catch (error) {
    console.warn(`Failed to load buddy icon for ${enName}:`, error);
    buddyIconCache.value[buddyCharaName] = null;
    return null;
  }
};

// バディアイコンの同期版（テンプレートで使用）
const getBuddyIconSync = (buddyCharaName) => {
  if (!buddyCharaName) return null;
  
  // 非同期で読み込みを開始（キャッシュされていない場合）
  if (!buddyIconCache.value[buddyCharaName]) {
    getBuddyIcon(buddyCharaName);
  }
  
  return buddyIconCache.value[buddyCharaName] || null;
};

// サイドバーの表示状態を判定
const isSidebarVisible = computed(() => windowWidth.value >= 960);

// バディアイコン表示判定
const showBuddyIcon = () => {
  if (isSidebarVisible.value) {
    // サイドバーがある場合 - より保守的に
    return windowWidth.value >= 1200;
  } else {
    // サイドバーがない場合（フル幅）
    return windowWidth.value >= 600;
  }
};

// バディ効果値表示判定
const showBuddyEffect = () => {
  if (isSidebarVisible.value) {
    // サイドバーがある場合 - より保守的に
    return windowWidth.value >= 1400;
  } else {
    // サイドバーがない場合
    return windowWidth.value >= 768;
  }
};


// バディ効果値のフォーマット関数（UPを削除）
const formatBuddyEffect = (effectText) => {
  if (!effectText) return '';
  return effectText.replace(/UP/gi, '');
};

// バディが有効かどうかを判定
const isBuddyActive = (magicIndex) => {
  const character = simulatorStore.deckCharacters[props.charaIndex];
  const buddyCharName = character[`buddy${magicIndex}c`];
  
  if (!buddyCharName) return false;
  
  // デッキ内の他のキャラクターと照合
  return simulatorStore.deckCharacters.some((deckChar, index) => 
    index !== props.charaIndex && deckChar.chara === buddyCharName
  );
};

// 魔法ドロップダウンの列数計算（安全性重視）
const getMagicDropdownCols = () => {
  let totalUsedCols = 2 + 2; // M1ボタン(2) + 属性(2) = 4列
  
  // レベルセレクト
  if (windowWidth.value >= 360) {
    totalUsedCols += showBuddyIcon() ? 2 : 3;
  }
  
  // バディ情報
  if (showBuddyIcon()) totalUsedCols += 1;
  if (showBuddyEffect()) totalUsedCols += 2;
  
  // 残りの列数を計算（最低2列は確保）
  const remainingCols = 12 - totalUsedCols;
  return Math.max(remainingCols, 2);
};

// レベルセレクトのスタイル
const getLevelSelectStyle = () => {
  if (showBuddyIcon()) {
    return {
      'min-width': '35px',
      'max-width': '50px'
    };
  } else {
    return {
      'min-width': '35px',
      'max-width': '60px'
    };
  }
};

// 魔法ドロップダウンのスタイルを動的に調整
const getMagicDropdownStyle = () => {
  const cols = getMagicDropdownCols();
  let maxWidth;
  
  // 列数に基づいて最大幅を決定（より保守的）
  if (cols <= 2) {
    maxWidth = '100px';
  } else if (cols <= 3) {
    maxWidth = '110px';
  } else if (cols <= 4) {
    maxWidth = '130px';
  } else {
    maxWidth = '150px';
  }
  
  return {
    'min-width': '90px',
    'max-width': maxWidth,
    'width': '100%'
  };
};

// デュオアイコンを動的に読み込む関数
const loadDuoPartnerIcon = async (duoPartnerName) => {
  if (!duoPartnerName) {
    duoPartnerIcon.value = null;
    return;
  }
  
  try {
    const module = await import(`@/assets/img/icon/${jpName2enName[duoPartnerName]}.webp`);
    duoPartnerIcon.value = module.default;
  } catch (error) {
    duoPartnerIcon.value = defaultImg;
  }
};

// デュオが有効かどうか判定するcomputed
const isDuoActive = computed(() => {
  const character = simulatorStore.deckCharacters[props.charaIndex];
  if (!character || !character.duo) return false;
  
  // デュオ相手がデッキに含まれているかチェック
  return simulatorStore.charaDict[character.duo] === true;
});

// デュオツールチップのテキスト
const duoTooltipText = computed(() => {
  const character = simulatorStore.deckCharacters[props.charaIndex];
  if (!character || !character.duo) return '';
  
  const duoPartnerName = character.duo;
  const isActive = isDuoActive.value;
  
  return isActive 
    ? `デュオ相手: ${duoPartnerName} (有効)` 
    : `デュオ相手: ${duoPartnerName} (無効)`;
});

// デュオアイコンの読み込みエラーハンドリング
const handleDuoIconError = (event) => {
  // エラー時はデフォルト画像を表示
  event.target.src = defaultImg;
};

// キャラクターのデュオ相手が変更されたらアイコンを読み込み
watch(() => simulatorStore.deckCharacters[props.charaIndex]?.duo, (newDuo) => {
  loadDuoPartnerIcon(newDuo);
}, { immediate: true });

// 選択されている M ボタンの数をカウントする
const selectedCount = () => {
  const character = simulatorStore.deckCharacters[props.charaIndex];
  const magicCount = getMagicCount();
  
  const selections = [character.isM1Selected, character.isM2Selected];
  if (magicCount >= 3) {
    selections.push(character.isM3Selected);
  }
  
  return selections.filter(Boolean).length;
};

// 揺れアニメーションの開始
const startShaking = (shakingKey) => {
  shakingStates.value[shakingKey] = true;
  clearTimeout(shakeTimeout);
  shakeTimeout = setTimeout(() => {
    shakingStates.value[shakingKey] = false;
  }, 500); // 0.5秒間揺れる
};


const toggleM = (index) => {
  const selectedKey = `isM${index}Selected`;
  const shakingKey = `isM${index}Shaking`;
  const magicCount = getMagicCount();

  // R/SRの場合、M3は選択不可
  if (index > magicCount) {
    return;
  }

  if (simulatorStore.deckCharacters[props.charaIndex][selectedKey] || selectedCount() < 2) {
    simulatorStore.deckCharacters[props.charaIndex][selectedKey] = !simulatorStore.deckCharacters[props.charaIndex][selectedKey];
    // マジック選択変更時に再計算をトリガー
    simulatorStore.recalculateStats();
  } else {
    startShaking(shakingKey);
  }
};

// 最大レベルを取得する関数
const getMaxLevel = (rare) => {
  const levelDict = {'R': 70, 'SR': 90, 'SSR': 110};
  return levelDict[rare] || 110;
};

// レア度に応じて表示するマジックの数を取得
const getMagicCount = () => {
  const character = simulatorStore.deckCharacters[props.charaIndex];
  if (!character || !character.rare) return 3;
  
  // R、SRの場合は2つまで、SSRの場合は3つ
  return (character.rare === 'R' || character.rare === 'SR') ? 2 : 3;
};

// レベル入力のハンドラー
const handleLevelInput = (event) => {
  const value = parseInt(event.target.value) || 0;
  const maxLevel = getMaxLevel(simulatorStore.deckCharacters[props.charaIndex].rare);
  const validLevel = Math.max(0, Math.min(value, maxLevel));
  simulatorStore.updateLevel(props.charaIndex, validLevel);
};

// 詳細設定の保存
const saveDetailChanges = (updatedCharacter) => {
  // 詳細設定で変更された値を直接反映（selectCharacterによる自動計算を回避）
  const currentCharacter = simulatorStore.deckCharacters[props.charaIndex];
  
  // キャラクター基本情報の更新
  Object.assign(currentCharacter, {
    chara: updatedCharacter.chara,
    name: updatedCharacter.name,
    level: Number(updatedCharacter.level),
    hp: Number(updatedCharacter.hp),
    atk: Number(updatedCharacter.atk),
    magic1Lv: Number(updatedCharacter.magic1Lv),
    magic2Lv: Number(updatedCharacter.magic2Lv),
    magic3Lv: Number(updatedCharacter.magic3Lv),
    buddy1c: updatedCharacter.buddy1c,
    buddy1s: updatedCharacter.buddy1s,
    buddy1Lv: Number(updatedCharacter.buddy1Lv),
    buddy2c: updatedCharacter.buddy2c,
    buddy2s: updatedCharacter.buddy2s,
    buddy2Lv: Number(updatedCharacter.buddy2Lv),
    buddy3c: updatedCharacter.buddy3c,
    buddy3s: updatedCharacter.buddy3s,
    buddy3Lv: Number(updatedCharacter.buddy3Lv),
    buffs: updatedCharacter.buffs || []
  });
  
  // バフ設定の更新（詳細モーダルで設定された内容をそのまま保存）
  if (updatedCharacter.buffs) {
    currentCharacter.buffs = updatedCharacter.buffs.map(buff => ({
      magicOption: buff.magicOption,
      buffOption: buff.buffOption,
      powerOption: buff.powerOption,
      levelOption: Number(buff.levelOption),
      isManuallyAdded: true
    }));
  }
  
  // ステータス再計算をトリガー
  simulatorStore.recalculateStats();
  
  closeDetailModal();
};

// バフ変更時の処理
const handleBuffChanged = () => {
  // 全ステータスを再計算
  simulatorStore.recalculateStats();
};

const windowWidth = ref(window.innerWidth);
const handleResize = () => {
  windowWidth.value = window.innerWidth;
};
// キャラクターデータの変更を監視して画像を更新
watch(() => simulatorStore.deckCharacters[props.charaIndex]?.chara, (newChara) => {
  if (newChara) {
    const character = simulatorStore.deckCharacters[props.charaIndex];
    if (character.imgUrl) {
      imgpath.value = character.imgUrl;
    } else {
      // imgUrlが無い場合はデフォルト画像を使用
      imgpath.value = defaultImg;
    }
    // ボーナス選択状態も同期
    isBonusSelected.value = character.isBonusSelected || false;
  } else {
    imgpath.value = defaultImg;
    isBonusSelected.value = false;
  }
}, { immediate: true });

// imgUrlの変更も監視して画像を更新（URL復元時など）
watch(() => simulatorStore.deckCharacters[props.charaIndex]?.imgUrl, (newImgUrl) => {
  if (newImgUrl) {
    imgpath.value = newImgUrl;
  }
}, { immediate: true });

// レア度の変更を監視してM3の状態を調整
watch(() => simulatorStore.deckCharacters[props.charaIndex]?.rare, (newRare) => {
  if (newRare) {
    const character = simulatorStore.deckCharacters[props.charaIndex];
    // R/SRの場合、M3を無効化
    if (newRare === 'R' || newRare === 'SR') {
      character.isM3Selected = false;
      // ステータス再計算
      simulatorStore.recalculateStats();
    }
  }
}, { immediate: true });

onMounted(() => {
  window.addEventListener('resize', handleResize);
});
onUnmounted(() => {
  window.removeEventListener('resize', handleResize);
});

</script>

<style scoped>
.component-container {
  align-items: center;
  border: 1px solid #ccc;
  padding: 1px;
  font-size: 0.7em;
  max-width: 100%;
  margin-bottom: 2px;
}
.center{
  display: flex;
  justify-content: center;
  align-items: center;
}
.image-section {
  padding-left: 5%;
  display: flex;
  justify-content: center;
  align-items: center;
}

.selected {
  background-color: #8faef3;
  color: rgb(0, 0, 0);
}

/* キャラクターアイコンのコンテナ */
.character-icon-container {
  position: relative;
  display: inline-block;
  width: 100%;
  max-width: 60px;
}

.character-image {
  width: 100%;
  max-width: 60px;
  height: 100%;
  object-fit: cover;
  border-radius: 1px; /* アイコンに角丸を追加 */
}

/* デュオアイコンのコンテナ */
.duo-icon-container {
  position: absolute;
  top: 0px;
  left: 0px;
  width: 21px;
  height: 21px;
  border-radius: 10%;
  border: 1px solid #fff;
  background-color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
  transition: all 0.3s ease;
  cursor: pointer;
}


/* デュオが有効な場合のスタイル */
.duo-icon-container.duo-active {
  border-color: #ff0000;
  background-color: #E8F5E8;
}

/* デュオが無効な場合のスタイル */
.duo-icon-container:not(.duo-active) {
  border-color: #999;
  background-color: #f5f5f5;
}

.duo-icon-container:not(.duo-active) .duo-icon {
  filter: grayscale(100%);
}

/* デュオアイコン */
.duo-icon {
  width: 19px;
  height: 19px;
  object-fit: cover;
}

.stats-section {
  display: flex;
  flex-direction: column;
}

.stat {
  display: flex;
  align-items: center;
}

.stat-input {
  width: 100%;
  margin-left: 10px;
  border: 1px solid #ccc;
}

select {
  margin-right: 1px;
}

.buttons-section {
  display: flex;
  flex-direction: column;
  height: 100%;
  align-items: stretch;
}

.buff-btn, .details-btn {
  margin-bottom: 1px;
  border-radius: 4px;
  padding: 6px 8px;
  border: 1px solid #e0e0e0;
  background-color: transparent;
  cursor: pointer;
  font-size: 0.8em;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #666;
  transition: all 0.2s ease;
}

.buff-btn:hover, .details-btn:hover {
  background-color: #f5f5f5;
  border-color: #ccc;
  color: #333;
}

.details-btn.tall {
  flex: 0 0 auto;
  width: 32px;
  height: 32px;
  min-height: 32px;
  padding: 4px;
}

.buff-btn.bottom-aligned {
  flex: 1;
  margin-top: auto;
  min-height: 28px;
  width: 32px;
}
.bonusbutton {
  margin-bottom: 1px;
  padding-left: 2%;
  padding-right: 2%;
  border-radius: 5px;
  border: 1px solid #ccc;
  cursor: pointer;
}
.mbutton {
  margin-bottom: 1px;
  padding-left: 20%;
  padding-right: 20%;
  border-radius: 5px;
  border: 1px solid #ccc;
  cursor: pointer;
}

/* mbuttonを含むdense rowの左パディングを調整 */
:deep(.v-row--dense > .v-col),
:deep(.v-row--dense > [class*=v-col-]) {
  padding-left: 1px;
}

.mbutton.shake {
  animation: shake 0.25s;
}


/* バディ関連のスタイル */
.buddy-icon-col {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 2px;
}

.buddy-icon {
  width: 18px;
  height: 18px;
  object-fit: cover;
}

.buddy-effect-col {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 1px;
}

.buddy-effect {
  font-size: 0.7em;
  color: #666;
  text-align: center;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 100%;
  line-height: 1;
}

/* バディ無効時のグレーアウト */
.buddy-inactive {
  opacity: 0.6;
  filter: grayscale(90%);
}

.buddy-inactive .buddy-icon {
  filter: grayscale(100%);
}

.buddy-inactive .buddy-effect {
  color: #888;
}


.buff-section {
  display: flex;
  align-items: stretch;
  justify-content: flex-start;
  gap: 2px;
  margin-bottom: 0;
  width: 100%;
  position: relative;
  overflow: visible;
}

.buff-dropdown-wrapper {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
}

.buff-section.drag-before::before,
.buff-section.drag-after::after {
  content: '';
  position: absolute;
  left: -2px;
  right: -2px;
  height: 2px;
  background-color: #8faef3;
  border-radius: 2px;
}

.buff-section.drag-before::before {
  top: -4px;
}

.buff-section.drag-after::after {
  bottom: -4px;
}

.buff-section.drop-front::before {
  content: '';
  position: absolute;
  top: 4px;
  bottom: 4px;
  width: 2px;
  left: -2px;
  border-radius: 2px;
  background-color: #8faef3;
}

.buff-section.drop-tail::after {
  content: '';
  position: absolute;
  top: 4px;
  bottom: 4px;
  width: 2px;
  right: -2px;
  border-radius: 2px;
  background-color: #8faef3;
  animation: dropBlink 0.9s ease-in-out infinite;
}

.buff-section.drop-blink::before,
.buff-section.drop-blink::after {
  animation: dropBlink 0.9s ease-in-out infinite;
}

.buff-drop-empty {
  width: 100%;
  min-height: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px dashed #ccc;
  border-radius: 4px;
  color: #777;
  font-size: 0.8em;
  padding: 4px;
  transition: background-color 0.15s ease, border-color 0.15s ease;
}

.buff-drop-empty.active {
  border-color: #8faef3;
  background-color: rgba(143, 174, 243, 0.12);
  color: #555;
}

.drop-blink {
  animation: dropBlink 0.9s ease-in-out infinite;
}

.buff-drop-empty.drop-blink {
  outline: 1px dashed #8faef3;
  outline-offset: 2px;
}

.buff-btn.drop-target {
  border-color: #8faef3;
  outline: 1px solid #8faef3;
  outline-offset: 2px;
}

.buff-btn.drop-target {
  outline: 1px #8faef3;
  outline-offset: 2px;
  animation: dropBlink 0.9s ease-in-out infinite;
}

@keyframes dropBlink {
  0%, 100% {
    opacity: 1;
  }
  50% {
    opacity: 0.55;
  }
}

@media (min-width: 600px) {
  .buff-section.drag-before::before,
  .buff-section.drag-after::after {
    top: 4px;
    bottom: 4px;
    height: auto;
    width: 2px;
    left: auto;
    right: auto;
  }

  .buff-section.drag-before::before {
    left: -2px;
    top: 4px;
    bottom: 4px;
  }

  .buff-section.drag-after::after {
    right: -2px;
    top: 4px;
    bottom: 4px;
  }

  .buff-section.drop-front::before {
    top: 4px;
    bottom: 4px;
    height: auto;
    width: 2px;
    left: -2px;
  }

  .buff-section.drop-tail::after {
    top: 4px;
    bottom: 4px;
    height: auto;
    width: 2px;
    right: -1px;
  }
}

.remove-btn {
  padding: 0px 10px;
  border-radius: 8px;
  border: 1px solid #ccc;
  background-color: #f0f0f0;
  cursor: pointer;
}

@keyframes shake {
  0%, 100% {
    transform: translateX(0);
  }
  25% {
    transform: translateX(-5%);
  }
  75% {
    transform: translateX(5%);
  }
}

.buff-list {
  display: grid;
  grid-template-columns: repeat(1, 1fr);
  gap: 1px;
  justify-items: center;
  width: 100%;
  margin-bottom: 2px;
  position: relative;
}

.buff-section {
  border-radius: 4px;
  padding: 4px;
  width: 100%;
}

.buff-section.manually-added {
  background-color: rgba(255, 0, 0, 0.05);
}

.drag-handle {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 15px;
  min-width: 15px;
  align-self: stretch;
  padding: 2px 2px;
  border-radius: 2px;
  cursor: grab;
}

.drag-handle:active {
  cursor: grabbing;
}

/* モバイル（サイドパネルなし） */
@media (min-width: 480px) and (max-width: 599px) {
  .buff-list {
    grid-template-columns: repeat(1, 1fr);
  }
}

@media (min-width: 600px) and (max-width: 899px) {
  .buff-list {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (min-width: 900px) and (max-width: 959px) {
  .buff-list {
    grid-template-columns: repeat(3, 1fr);
  }
}

@media (max-width: 599px) {
  .buff-section {
    width: auto;
    margin-left: auto;
    margin-right: auto;
    justify-content: center;
  }
  .buff-dropdown-wrapper {
    width: auto;
  }
}

/* デスクトップ（サイドパネルあり） - より保守的に */
@media (min-width: 960px) and (max-width: 1199px) {
  .buff-list {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (min-width: 1200px) and (max-width: 1399px) {
  .buff-list {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (min-width: 1400px) {
  .buff-list {
    grid-template-columns: repeat(3, 1fr);
  }
}

.level-select {
  appearance: none;
  -webkit-appearance: none;
  -moz-appearance: none;
  background: none;
  background-image: none;
  border-radius: 5px;
  border: 1px solid #ccc;
  padding: 1px 8px;
  font-size: 0.9em;
  min-width: 48px;
  max-width: 60px;
  margin: 0;
}
.level-select::-ms-expand {
  display: none;
}
.level-select:focus {
  outline: none;
  border-color: #66afe9;
  box-shadow: 0 0 8px rgba(102, 175, 233, 0.6);
}

/* ダークモード対応 */
:deep(.v-theme--dark) .buff-section.manually-added {
  background-color: rgba(255, 100, 100, 0.1);
}

:deep(.v-theme--dark) .drag-handle {
  border-color: #666;
  color: #ddd;
}
</style>

