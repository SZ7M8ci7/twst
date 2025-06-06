<template>
  <div class="modal-background" ref="modalContainer">
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
                  <img :src="imgUrlDictionary[characterInfo.name_en]" :alt="characterInfo.name_en" class="character-image" />
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
        <div v-for="effect in effects" :key="effect.name" class="feature-item">
          <v-checkbox v-model="selectedEffects" :value="effect.value" :label="effect.name" hide-details />
        </div>
      </div>
    </div>
    <!-- ボタンのコンテナ -->
    <div class="button-container">
      <v-btn class="button" @click="$emit('close')">{{ $t('filterModal.cancel') }}</v-btn>
      <v-btn class="button apply-button" :disabled="selectedCharacters.length === 0 || selectedRare.length === 0"
        @click="applyFilter">{{ $t('filterModal.submit') }}</v-btn>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useCharacterStore } from '@/store/characters';
import { useFilterdStore } from '@/store/filterd';
import { storeToRefs } from 'pinia';
import { onMounted, onBeforeUnmount, ref, computed, Ref} from 'vue';
import { useI18n } from 'vue-i18n';
import characterData from '@/assets/characters_info.json';
import { loadImageUrls } from '@/components/common';

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
const emit = defineEmits(['close']);
const displayBlockWidth = ref(0);
const imgUrlDictionary: Ref<Record<string, string>> = ref({});

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

const effects = [
{ name: t('filterModal.power_boost'), value: 'ATKUP' },
  { name: t('filterModal.damage_boost'), value: 'ダメージUP' },
  { name: t('filterModal.critical'), value: 'クリティカル' },
  { name: t('filterModal.element_boost'), value: '属性ダメージUP' },
  { name: t('filterModal.damage_vulnerability'), value: '被ダメージUP' },
  { name: t('filterModal.power_cut'), value: 'ATKDOWN' },
  { name: t('filterModal.damage_cut'), value: 'ダメージDOWN' },
  { name: t('filterModal.evasion'), value: '回避' },
  { name: t('filterModal.element_cut'), value: '属性ダメージDOWN' },
  { name: t('filterModal.resistence'), value: '被ダメージDOWN' },
  { name: t('filterModal.hp_restoration'), value: 'HP回復' },
  { name: t('filterModal.hp_regen'), value: 'HP継続回復' },
  { name: t('filterModal.nullifies_blind'), value: '暗闇無効' },
  { name: t('filterModal.nullifies_curse'), value: '呪い無効' },
  { name: t('filterModal.nullifies_freeze'), value: '凍結無効' },
  { name: t('filterModal.debuff_removal'), value: 'デバフ解除' },
  { name: t('filterModal.curse'), value: '呪い' }
];

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
    selectedRare.value = ['SSR', 'SR', 'R'];
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
    } else {
      // 効果が16件以下の場合、character.etcに選択された効果が含まれているかをチェック
      const effectMatched = selectedEffects.value.some(effect => character.etc.includes(effect));
      if (!effectMatched) {
        character.visible = false;
        return;
      }
    }
  });

  emit('close'); // モーダルを閉じる
}

function toggleSelectAll(groupName: string) {
  if (groupName === 'statusEffects') {
    // ステータス効果の全選択/解除を処理
    const allSelected = effects.every(effect => selectedEffects.value.includes(effect.value));
    if (allSelected) {
      // すべて選択されている場合は解除
      selectedEffects.value = [];
    } else {
      // すべてのエフェクトを選択
      selectedEffects.value = effects.map(effect => effect.value);
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
    return effects.every(effect => selectedEffects.value.includes(effect.value));
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
  margin-bottom: 0px;
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
  margin-top: 20px;
  margin-bottom: 20px;
  width: 100%; /* 画面全体に広がるコンテナ */
  max-width: 1200px; /* コンテナの最大幅を設定 */
}

.character-list-wrapper {
  display: flex;
  flex-direction: column;
  gap: 20px;
  width: 100%;
}

.row {
  display: flex;
  gap: 20px;  /* 寮ごとの間隔 */
  margin-bottom: 20px;
}

.character-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.character-select-all-container {
  display: flex;
  align-items: center;
  gap: 10px; /* 選択ボタンとアイコンの間隔 */
}

.character-items {
  display: flex;
  gap: 10px;  /* キャラクター間の間隔 */
  flex-wrap: wrap;  /* 必要に応じて改行 */
}

.character-item {
  margin: 5px;
  width: var(--icon-size); /* JavaScriptから渡された変数を使う */
  height: var(--icon-size); /* JavaScriptから渡された変数を使う */
  transition: border 0.3s ease;
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
  border-radius: 8px; /* アイコン自体の角を丸める */
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
  margin-bottom: 2px; /* 区切り線と下の要素とのスペースを確保 */
}
</style>
