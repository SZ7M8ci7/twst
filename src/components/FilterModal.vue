<template>
  <div class="modal-background" ref="modalContainer" :class="{ embedded: embedded }">
    <!-- Card Attributesセクション -->
    <div class="feature-select-all-container">
      <v-btn small @click="toggleSelectAll('cardAttributes')">
        {{ isGroupFullySelected('cardAttributes') ? t('filterModal.release') : t('filterModal.select') }}
      </v-btn>
      <div class="feature-items">
        <div class="feature-item" v-for="(rare, index) in rareOptions" :key="`rare-${index}`">
          <v-checkbox v-model="selectedRare" :value="rare" :label="rare" hide-details />
        </div>
        <div class="feature-item" v-for="(type, index) in typeOptions" :key="`type-${index}`">
          <v-checkbox v-model="selectedType" :value="type.value" :label="type.name" hide-details />
        </div>
        <div class="feature-item" v-for="(attr, index) in attrOptions" :key="`attr-${index}`">
          <v-checkbox v-model="selectedAttr" :value="attr.value" :label="attr.name" hide-details />
        </div>
      </div>
    </div>
    <hr class="rare-divider" />
    <!-- キャラクタリスト -->
     <div class="display-block">
      <div class="character-list-wrapper">
        <div v-for="(row, rowIndex) in determineLayout()" :key="rowIndex" class="row">
          <!-- 各行に表示する寮ごとのキャラクターを表示 -->
          <div
            v-for="groupName in row"
            :key="groupName"
            :style="getContainerStyle(row.length)"
            class="character-list"
          >
            <div class="character-select-all-container">
              <v-btn small @click="toggleSelectAll(groupName)">
                {{ isGroupFullySelected(groupName) ? t('filterModal.release') : t('filterModal.select') }}
              </v-btn>
              <div class="character-items">
                <div v-for="characterInfo in characterGroups[groupName]" :key="characterInfo.name_en" class="character-item"
                  @click="toggleCharacterSelection(characterInfo.name_en)"
                  :class="{ selected: selectedCharacters.includes(characterInfo.name_en) }"
                  :style="{ ...iconStyle, opacity: selectedCharacters.includes(characterInfo.name_en) ? 1 : 0.5 }">
                  <img 
                    :src="imgUrlDictionary[characterInfo.name_en] || defaultImg" 
                    :alt="characterInfo.name_en" 
                    class="character-image"
                    @error="handleImageError"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
    <hr class="rare-divider" />
    <!-- Status Effectsセクション -->
    <div class="feature-select-all-container">
      <v-btn small @click="toggleSelectAll('statusEffects')">
        {{ isGroupFullySelected('statusEffects') ? t('filterModal.release') : t('filterModal.select') }}
      </v-btn>
      <div class="feature-items">
        <div v-for="effect in localEffects" :key="effect.name" class="feature-item">
          <v-checkbox v-model="selectedEffects" :value="effect.value" :label="effect.name" hide-details />
        </div>
      </div>
    </div>
    <!-- ボタンのコンテナ -->
    <div class="button-container" v-if="!embedded">
      <v-btn class="button" @click="$emit('close')">{{ $t('filterModal.cancel') }}</v-btn>
      <v-btn class="button apply-button" :disabled="selectedCharacters.length === 0 || selectedRare.length === 0"
        @click="applyFilter">{{ $t('filterModal.submit') }}</v-btn>
    </div>
    <!-- 埋め込みモード用ボタン -->
    <div class="button-container embedded-buttons" v-else>
      <v-btn class="button reset-button" @click="resetFilter" variant="outlined" size="small">
        フィルターリセット
      </v-btn>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useCharacterStore } from '@/store/characters';
import { useFilterdStore } from '@/store/filterd';
import { storeToRefs } from 'pinia';
import { onMounted, onBeforeUnmount, ref, computed, Ref, watch} from 'vue';
import { useI18n } from 'vue-i18n';
import characterData from '@/assets/characters_info.json';
import { loadImageUrls } from '@/components/common';
import defaultImg from '@/assets/img/default.png';
import { effects } from '@/store/searchResult';

const { t } = useI18n();

const characterStore = useCharacterStore();
const { characters } = storeToRefs(characterStore);
const filterdStore = useFilterdStore();
const { tempSelectedCharacters, tempSelectedRare, tempSelectedType, tempSelectedAttr, tempSelectedEffects ,isFirst } = storeToRefs(filterdStore);

const selectedCharacters = ref<string[]>([]);
const selectedRare = ref<string[]>([]);
const selectedType = ref<string[]>([]);
const selectedAttr = ref<string[]>([]);
const selectedEffects = ref<string[]>([]);
const emit = defineEmits(['close', 'filter-applied']);
const displayBlockWidth = ref(0);
const imgUrlDictionary: Ref<Record<string, string>> = ref({});

// プロパティ定義
const props = defineProps({
  embedded: {
    type: Boolean,
    default: false
  }
});

// アイコンのサイズと間隔を共通化したい
const iconSize = 50;
const gapSize = 10;

const iconStyle = ref({
  '--icon-size': `${iconSize}px`,
  '--gap-size': `${gapSize}px`
});

const rareOptions = ['SSR', 'SR', 'R'];

const typeOptions = computed(() => [
  { name: t('filterModal.balance'), value: 'バランス' },
  { name: t('filterModal.defence'), value: 'ディフェンス' },
  { name: t('filterModal.attack'), value: 'アタック' },
]);

const attrOptions = computed(() => [
  { name: t('filterModal.fire'), value: '火' },
  { name: t('filterModal.water'), value: '水' },
  { name: t('filterModal.flora'), value: '木' },
  { name: t('filterModal.cosmic'), value: '無' },
]);

// Use the translated effects by mapping the imported effects with translations
const localEffects = computed(() => effects.map(effect => ({
  name: t(`filterModal.${effect.name}`),
  value: effect.value
})));

interface Character {
  name_ja: string;
  name_en: string;
  dorm: string;
  theme_1: string;
  theme_2: string;
}

const characterGroups = characterData.reduce<Record<string, Character[]>>((groups, character) => {
  const dorm = character.dorm;
  if (!groups[dorm]) {
    groups[dorm] = [];
  }
  groups[dorm].push(character);
  return groups;
}, {});

// display-block幅の更新を行う関数
const updateDisplayBlockWidth = () => {
  const displayBlock = document.querySelector('.display-block');
  if (displayBlock) {
    displayBlockWidth.value = displayBlock.clientWidth;
  }
};

// resize イベント用のリスナー関数
const resizeListener = () => {
  updateDisplayBlockWidth();
};

onMounted(async () => {
  // 初期化処理
  if (isFirst.value) {
    selectedCharacters.value = Object.values(characterGroups).flat().map((student: Character) => student.name_en);
    selectedRare.value = ['SSR']; // SSRのみをデフォルトで選択
    selectedType.value = ['バランス', 'ディフェンス', 'アタック'];
    selectedAttr.value = ['火', '水', '木', '無'];
    selectedEffects.value = ['ATKUP', 'ダメージUP', 'クリティカル', '属性ダメージUP', '被ダメージUP', 'ATKDOWN', 'ダメージDOWN', '回避', '属性ダメージDOWN', '被ダメージDOWN', 'HP回復', 'HP継続回復', '暗闇無効', '呪い無効', '凍結無効', 'デバフ解除', '呪い'];
  } else {
    if (tempSelectedCharacters.value.length > 0) {
      selectedCharacters.value = [...tempSelectedCharacters.value];
    }
    if (tempSelectedRare.value.length > 0) {
      selectedRare.value = [...tempSelectedRare.value];
    }
    if (tempSelectedType.value.length > 0) {
      selectedType.value = [...tempSelectedType.value];
    }
    if (tempSelectedAttr.value.length > 0) {
      selectedAttr.value = [...tempSelectedAttr.value];
    }
    if (tempSelectedEffects.value.length > 0) {
      selectedEffects.value = [...tempSelectedEffects.value];
    }
  }
  isFirst.value = false;

  // display-block幅の更新
  updateDisplayBlockWidth();
  window.addEventListener('resize', resizeListener);
  imgUrlDictionary.value = await loadImageUrls(characterData, (item: any) => item.name_en, 'icon/');
  
  // 埋め込みモードの場合はリアルタイム更新のためのwatcherを設定
  if (props.embedded) {
    watch([selectedCharacters, selectedRare, selectedType, selectedAttr, selectedEffects], () => {
      // 選択状態を一時保存エリアに更新
      tempSelectedCharacters.value = [...selectedCharacters.value];
      tempSelectedRare.value = [...selectedRare.value];
      tempSelectedType.value = [...selectedType.value];
      tempSelectedAttr.value = [...selectedAttr.value];
      tempSelectedEffects.value = [...selectedEffects.value];
      
      // localStorage に永続化
      filterdStore.saveCurrentState();
      
      updateCharacterVisibility();
    }, { deep: true });
  }
});

onBeforeUnmount(() => {
  window.removeEventListener('resize', resizeListener);
});

function applyFilter() {
  // 選択された項目を一時保存
  tempSelectedCharacters.value = [...selectedCharacters.value];
  tempSelectedRare.value = [...selectedRare.value];
  tempSelectedType.value = [...selectedType.value];
  tempSelectedAttr.value = [...selectedAttr.value];
  tempSelectedEffects.value = [...selectedEffects.value];

  // localStorage に永続化
  filterdStore.saveCurrentState();

  updateCharacterVisibility();

  emit('filter-applied'); // フィルター適用を通知
  if (!props.embedded) {
    emit('close'); // 埋め込みモードでない場合のみモーダルを閉じる
  }
}

// フィルターリセット機能
function resetFilter() {
  // デフォルト状態に戻す（SSRのみ選択）
  selectedCharacters.value = Object.values(characterGroups).flat().map((student: Character) => student.name_en);
  selectedRare.value = ['SSR']; // SSRのみをデフォルトで選択
  selectedType.value = ['バランス', 'ディフェンス', 'アタック'];
  selectedAttr.value = ['火', '水', '木', '無'];
  selectedEffects.value = ['ATKUP', 'ダメージUP', 'クリティカル', '属性ダメージUP', '被ダメージUP', 'ATKDOWN', 'ダメージDOWN', '回避', '属性ダメージDOWN', '被ダメージDOWN', 'HP回復', 'HP継続回復', '暗闇無効', '呪い無効', '凍結無効', 'デバフ解除', '呪い'];

  // 一時保存エリアも更新
  tempSelectedCharacters.value = [...selectedCharacters.value];
  tempSelectedRare.value = [...selectedRare.value];
  tempSelectedType.value = [...selectedType.value];
  tempSelectedAttr.value = [...selectedAttr.value];
  tempSelectedEffects.value = [...selectedEffects.value];

  // ストアの状態をリセットしlocalStorageからも削除
  filterdStore.resetFilterState();

  // フィルターを適用
  updateCharacterVisibility();
}

// フィルタリング処理を分離
function updateCharacterVisibility() {
  characters.value.forEach(character => {
    // レア度チェック
    if (!selectedRare.value.includes(character.rare)) {
      character.visible = false;
      return
    }
    // キャラチェック
    const characterInfo = characterData.find(char => char.name_ja === character.chara || char.name_en === character.chara);
    if (!characterInfo || !selectedCharacters.value.includes(characterInfo.name_en)) {
      character.visible = false;
      return;
    }
    // タイプチェック
    if (!selectedType.value.includes(character.attr)) {
      character.visible = false;
      return
    }
    // 属性チェック
    if ((!selectedAttr.value.includes(character.magic1atr))
      && (!selectedAttr.value.includes(character.magic2atr))
      && (!selectedAttr.value.includes(character.magic3atr))) {
      character.visible = false;
      return
    }
    // 効果チェック
    if (selectedEffects.value.length === 17) {
      // 効果が全件選択されている場合は無条件でtrue
      character.visible = true;
    } else if (selectedEffects.value.length === 0) {
      // 効果が全く選択されていない場合は無条件でfalse
      character.visible = false;
      return;
    } else {
      // 効果が1件以上選択されている場合、character.etcに選択された効果が含まれているかをチェック
      const effectMatched = selectedEffects.value.some(effect => character.etc.includes(effect));
      if (!effectMatched) {
        character.visible = false;
        return;
      } else {
        // 効果がマッチした場合は表示
        character.visible = true;
      }
    }
  });
}

// 画像読み込みエラーハンドリング
function handleImageError(event: Event) {
  const target = event.target as HTMLImageElement;
  target.src = defaultImg;
}

function toggleSelectAll(groupName: string) {
  if (groupName === 'statusEffects') {
    // ステータス効果の全選択/解除を処理
    const allSelected = localEffects.value.every(effect => selectedEffects.value.includes(effect.value));
    if (allSelected) {
      // すべて選択されている場合は解除
      selectedEffects.value = [];
    } else {
      // すべてのエフェクトを選択
      selectedEffects.value = localEffects.value.map(effect => effect.value);
    }
  } else if (groupName === 'cardAttributes') {
    // カード属性の全選択/解除を処理
    const allRaresSelected = ['SSR', 'SR', 'R'].every(rare => selectedRare.value.includes(rare));
    const allTypesSelected = ['バランス', 'ディフェンス', 'アタック'].every(type => selectedType.value.includes(type));
    const allAttrsSelected = ['火', '水', '木', '無'].every(attr => selectedAttr.value.includes(attr));

    if (allRaresSelected && allTypesSelected && allAttrsSelected) {
      // すべて選択されている場合は解除
      selectedRare.value = [];
      selectedType.value = [];
      selectedAttr.value = [];
    } else {
      // すべてのカード属性を選択
      selectedRare.value = ['SSR', 'SR', 'R'];
      selectedType.value = ['バランス', 'ディフェンス', 'アタック'];
      selectedAttr.value = ['火', '水', '木', '無'];
    }
  } else {
    // キャラクターグループの全選択/解除を処理
    const group: Character[] = characterGroups[groupName] || [];
    const allSelected = group.every((characterInfo: Character) => selectedCharacters.value.includes(characterInfo.name_en));

    if (allSelected) {
      selectedCharacters.value = selectedCharacters.value.filter(c => !group.some(student => student.name_en === c));
    } else {
      selectedCharacters.value = [...new Set([...selectedCharacters.value, ...group.map(student => student.name_en)])];
    }
  }
}

function isGroupFullySelected(groupName: string): boolean {
  if (groupName === 'cardAttributes') {
    return rareOptions.every(rare => selectedRare.value.includes(rare)) &&
           typeOptions.value.every(type => selectedType.value.includes(type.value)) &&
          attrOptions.value.every(attr => selectedAttr.value.includes(attr.value));
  } else if (groupName === 'statusEffects') {
    return localEffects.value.every(effect => selectedEffects.value.includes(effect.value));
  }

  const group = characterGroups[groupName];
  return group.every(character => selectedCharacters.value.includes(character.name_en));
}

// キャラクター選択の切り替え処理
function toggleCharacterSelection(characterValue: string) {
  selectedCharacters.value = selectedCharacters.value.includes(characterValue)
    ? selectedCharacters.value.filter(c => c !== characterValue)
    : [...selectedCharacters.value, characterValue];
}

// 各寮の幅を取得
const calculateGroupWidth = (group: Character[]) => {
  const buttonWidth = 64; // 選択ボタンの幅
  const gapBetweenButtonAndFirstIcon = 10; // 選択ボタンとアイコンの間のスペース
  const iconTotalWidth = iconSize + (2 * 5) + gapSize;

  const totalGroupWidth = buttonWidth + iconTotalWidth * group.length + gapBetweenButtonAndFirstIcon;

  return totalGroupWidth;
};

const getContainerStyle = (numberOfGroupsInRow: number) => {
  // 寮の数に応じて幅を調整（1行に複数の寮がある場合は50%）
  return {
    width: numberOfGroupsInRow === 1 ? '100%' : '50%',
  };
};

// 寮の並べ方
const determineLayout = () => {
  const layout = [];
  let currentRow: string[] = [];
  let currentRowWidth = 0;
  const maxWidth = displayBlockWidth.value;
  const maxGroupsPerRow = 2;

  Object.entries(characterGroups).forEach(([groupName, group]) => {
    const groupWidth = calculateGroupWidth(group);

    // 寮の幅が display-block の幅の半分を超える場合、その寮は単独で1行にする
    if (groupWidth >= maxWidth / maxGroupsPerRow) {
      if (currentRow.length > 0) {
        layout.push(currentRow);
        currentRow = [];
        currentRowWidth = 0;
      }
      layout.push([groupName]);
    } else {
      if (currentRowWidth + groupWidth <= maxWidth && currentRow.length < maxGroupsPerRow) {
        currentRow.push(groupName);
        currentRowWidth += groupWidth;
      } else {
        layout.push(currentRow);
        currentRow = [groupName];
        currentRowWidth = groupWidth;
      }
    }
  });

  // 最後に残った行を追加
  if (currentRow.length > 0) {
    layout.push(currentRow);
  }

  return layout;
};
</script>

<style scoped>

.feature-select-all-container {
  display: flex;
  align-items: center;
  margin-bottom: 3px;
}

.feature-items {
  display: flex;
  flex-wrap: wrap;
}

.feature-list > .feature-item {
  display: inline-flex;
  align-items: center;
  text-align: left;
}

.display-block {
  margin: 0 auto; /* コンテナを中央揃え */
  margin-top: 3px;
  margin-bottom: 3px;
  width: 100%; /* 画面全体に広がるコンテナ */
  max-width: 1200px; /* コンテナの最大幅を設定 */
}

.character-list-wrapper {
  display: flex;
  flex-direction: column;
  gap: 3px;
  width: 100%;
}

.row {
  display: flex;
  gap: 12px;  /* 寮ごとの間隔 */
  margin-bottom: 3px;
}

.character-list {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.character-select-all-container {
  display: flex;
  align-items: center;
  gap: 8px; /* 選択ボタンとアイコンの間隔 */
}

.character-items {
  display: flex;
  gap: 2px;  /* キャラクター間の間隔 */
  flex-wrap: wrap;  /* 必要に応じて改行 */
}

.character-item {
  margin: 5px;
  width: var(--icon-size); /* JavaScriptから渡された変数を使う */
  height: var(--icon-size); /* JavaScriptから渡された変数を使う */
  transition: border 0.3s ease;
}

.embedded-buttons {
  margin-top: 16px;
  text-align: center;
}

.reset-button {
  color: #666 !important;
  border-color: #ddd !important;
}

.character-item img {
  width: 100%;
  height: 100%;
  object-fit: cover; /* 親要素内に画像を収める */
  border-radius: 8px;
  cursor: pointer;
  z-index: 1;
  position: relative;
}

.character-item.selected {
  position: relative; /* 親要素にpositionを指定 */
  border-radius: 0px; /* アイコン自体の角を丸める */
}

.character-item.selected::before {
  content: '';
  position: absolute;
  top: -2px; /* アイコンの外側に縁取りを作るための余白 */
  left: -2px;
  right: -2px;
  bottom: -2px;
  border-radius: 8px; /* 縁取りもアイコンに合わせて丸める */
  border: 2px solid transparent; /* 実際のボーダーの太さを定義 */
  background: #ff0fff;
  z-index: 0; /* アイコンより後ろに表示されるように設定 */
}

.character-item:not(.selected) {
  opacity: 0.5;
}

.character-item:hover {
  opacity: 1.0;
}

.modal-background {
  background-color: white;
  padding: 20px; /* パディングを調整 */
  border-radius: 8px; /* 角を丸くする */
  max-height: 95vh; /* Maximum height - 80% of the viewport height */
  overflow-y: auto; /* Enable vertical scrolling if content overflows */
}

.modal-background.embedded {
  padding: 8px;
  max-height: none;
  border: 1px solid #e0e0e0;
  overflow-y: visible;
  font-size: 0.85em;
}

.modal-background.embedded :deep(.v-label) {
  font-size: 0.85em;
}

.modal-background.embedded :deep(.v-checkbox .v-label) {
  font-size: 0.85em;
}

.modal-background.embedded :deep(.v-checkbox) {
  margin-top: 0;
  margin-bottom: 0;
  padding-top: 0;
  padding-bottom: 0;
}

.modal-background.embedded :deep(.v-input__control) {
  min-height: auto;
}

.modal-background.embedded :deep(.v-selection-control) {
  min-height: auto;
  margin-top: 2px;
  margin-bottom: 2px;
}

.button-container {
  display: flex;
  gap: 10px; /* ボタン間のスペース */
  justify-content: center;
}

.button, .apply-button {
  width: 150px; /* ボタンの幅を統一 */
}

.apply-button {
  background-color: #19d241;
  color: white;
}
.rare-divider {
  border: none; /* 既存のボーダースタイルを消去 */
  height: 1px; /* 線の厚み */
  background-color: #e0e0e0; /* 線の色 */
  width: 100%; /* 親要素の幅いっぱいに線を引く */
  margin-bottom: 1px; /* 区切り線と下の要素とのスペースを確保 */
}

.embedded-buttons {
  justify-content: center;
  margin-top: 1px;
}

.filter-status {
  font-size: 12px;
  color: #666;
  font-style: italic;
}
</style>
