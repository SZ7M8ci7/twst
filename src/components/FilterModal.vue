<template>
  <div class="modal-background" ref="modalContainer" :class="{ embedded: embedded }">
    <!-- カード属性セクション -->
    <div class="card-attribute-groups">
      <section class="attribute-group attribute-group--rarity">
        <div class="attribute-group-header">
          <div class="attribute-group-title">
            <v-icon size="18">mdi-diamond-stone</v-icon>
            <span>{{ t('filterModal.rarity') }}</span>
          </div>
          <v-btn class="attribute-group-action" size="small" variant="text" @click="toggleSelectAll('rarity')">
            {{ isGroupFullySelected('rarity') ? t('filterModal.release') : t('filterModal.select') }}
          </v-btn>
        </div>
        <div class="feature-items attribute-items">
          <div class="feature-item" v-for="(rare, index) in rareOptions" :key="`rare-${index}`">
            <v-checkbox v-model="selectedRare" :value="rare" :label="rare" hide-details density="compact" />
          </div>
        </div>
      </section>
      <section class="attribute-group attribute-group--type">
        <div class="attribute-group-header">
          <div class="attribute-group-title">
            <v-icon size="18">mdi-shape-outline</v-icon>
            <span>{{ t('filterModal.cardType') }}</span>
          </div>
          <v-btn class="attribute-group-action" size="small" variant="text" @click="toggleSelectAll('cardType')">
            {{ isGroupFullySelected('cardType') ? t('filterModal.release') : t('filterModal.select') }}
          </v-btn>
        </div>
        <div class="feature-items attribute-items">
          <div class="feature-item" v-for="(type, index) in typeOptions" :key="`type-${index}`">
            <v-checkbox v-model="selectedType" :value="type.value" :label="type.name" hide-details density="compact" />
          </div>
        </div>
      </section>
      <section class="attribute-group attribute-group--attribute">
        <div class="attribute-group-header">
          <div class="attribute-group-title">
            <v-icon size="18">mdi-flare</v-icon>
            <span>{{ t('filterModal.magicAttribute') }}</span>
          </div>
          <v-btn class="attribute-group-action" size="small" variant="text" @click="toggleSelectAll('magicAttribute')">
            {{ isGroupFullySelected('magicAttribute') ? t('filterModal.release') : t('filterModal.select') }}
          </v-btn>
        </div>
        <div class="feature-items attribute-items">
          <div class="feature-item" v-for="(attr, index) in attrOptions" :key="`attr-${index}`">
            <v-checkbox v-model="selectedAttr" :value="attr.value" :label="attr.name" hide-details density="compact" />
          </div>
        </div>
      </section>
    </div>
    <hr class="rare-divider" />
    <!-- キャラクタリスト -->
     <div class="display-block">
      <!-- キャラクター全体の全選択・解除ボタン -->
      <div class="section-heading-row character-global-select-container">
        <div class="section-title">
          <v-icon size="18">mdi-account-group-outline</v-icon>
          <span>{{ t('filterModal.characters') }}</span>
        </div>
        <v-btn class="filter-section-action" size="small" variant="text" @click="toggleSelectAllCharacters">
          {{ areAllCharactersSelected() ? t('filterModal.release') : t('filterModal.select') }}
        </v-btn>
      </div>
      <div class="character-list-wrapper">
        <div v-for="(row, rowIndex) in layoutRows" :key="rowIndex" class="row">
          <!-- 各行に表示する寮ごとのキャラクターを表示 -->
          <div
            v-for="groupName in row"
            :key="groupName"
            :style="getContainerStyle(row.length)"
            class="character-list"
          >
            <div class="character-select-all-container">
              <v-btn class="filter-section-action character-group-action" size="small" variant="text" @click="toggleSelectAll(groupName)">
                {{ isGroupFullySelected(groupName) ? t('filterModal.release') : t('filterModal.select') }}
              </v-btn>
              <div class="character-items">
                <div v-for="characterInfo in filteredCharacterGroups[groupName]" :key="characterInfo.name_en" class="character-item"
                  @click="toggleCharacterSelection(characterInfo.name_en)"
                  :class="{ selected: selectedCharactersSet.has(characterInfo.name_en) }"
                  :style="getCharacterItemStyle(characterInfo.name_en)">
                  <img 
                    :src="imgUrlDictionary[characterInfo.name_en]" 
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
    <div class="costume-search-container filter-section-surface">
      <div class="section-title costume-search-label">
        <v-icon size="20">mdi-hanger</v-icon>
        <span>{{ t('filterModal.costumeName') }}</span>
      </div>
      <v-text-field
        v-model="costumeSearch"
        :placeholder="t('filterModal.costumeSearchPlaceholder')"
        :aria-label="t('filterModal.costumeSearch')"
        prepend-inner-icon="mdi-magnify"
        clearable
        hide-details
        density="compact"
        variant="outlined"
        class="costume-search-input"
      />
    </div>
    <hr class="rare-divider" />
    <!-- Status Effectsセクション -->
    <div class="status-effects-section filter-section-surface">
      <div class="section-heading-row">
        <div class="section-title">
          <v-icon size="18">mdi-auto-fix</v-icon>
          <span>{{ t('filterModal.statusEffects') }}</span>
        </div>
        <v-btn class="filter-section-action" size="small" variant="text" @click="toggleSelectAll('statusEffects')">
          {{ isGroupFullySelected('statusEffects') ? t('filterModal.release') : t('filterModal.select') }}
        </v-btn>
      </div>
      <div class="feature-items status-effect-items">
        <div v-for="effect in localEffects" :key="effect.name" class="feature-item">
          <v-checkbox v-model="selectedEffects" :value="effect.value" :label="effect.name" hide-details density="compact" />
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
        {{ t('common.filterReset') }}
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
import { loadImageUrls } from '@/utils/characterAssets';
import defaultImg from '@/assets/img/default.webp';
import { defaultSelectedEffectValues, effects } from '@/store/searchResult';
import { matchesAnySelectedEffect } from '@/utils/effectFilter';
import { localizeCostumeName } from '@/utils/localizedDisplay';

const { t } = useI18n();

const characterStore = useCharacterStore();
const { characters } = storeToRefs(characterStore);
const filterdStore = useFilterdStore();
const { tempSelectedCharacters, tempSelectedRare, tempSelectedType, tempSelectedAttr, tempSelectedEffects, tempCostumeSearch, isFirst } = storeToRefs(filterdStore);

const selectedCharacters = ref<string[]>([]);
const selectedRare = ref<string[]>([]);
const selectedType = ref<string[]>([]);
const selectedAttr = ref<string[]>([]);
const selectedEffects = ref<string[]>([]);
const costumeSearch = ref('');
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

// 画像が存在するキャラクターのみを表示するためのフィルタ済みグループ
const filteredCharacterGroups = computed(() => {
  const result: Record<string, Character[]> = {};
  Object.entries(characterGroups).forEach(([dorm, list]) => {
    result[dorm] = list.filter((c) => !!imgUrlDictionary.value[c.name_en]);
  });
  return result;
});

// キャラクター検索の最適化 - O(1)検索用Map
const characterLookupMap = new Map<string, Character>();
characterData.forEach(character => {
  characterLookupMap.set(character.name_ja, character);
  characterLookupMap.set(character.name_en, character);
});

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
    selectedCharacters.value = allCharacterNames.value;
    selectedRare.value = ['SSR']; // SSRのみをデフォルトで選択
    selectedType.value = ['バランス', 'ディフェンス', 'アタック'];
    selectedAttr.value = ['火', '水', '木', '無'];
    selectedEffects.value = [...defaultSelectedEffectValues];
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
    costumeSearch.value = tempCostumeSearch.value;
  }
  isFirst.value = false;

  // display-block幅の更新
  updateDisplayBlockWidth();
  window.addEventListener('resize', resizeListener);
  imgUrlDictionary.value = await loadImageUrls(characterData, (item: any) => item.name_en, 'icon/');
  // 画像辞書読み込み後に初期選択が未設定なら、画像がある項目のみ全選択
  if (selectedCharacters.value.length === 0) {
    selectedCharacters.value = allCharacterNames.value;
  }
  
  // 埋め込みモードの場合はリアルタイム更新のためのwatcherを設定
  if (props.embedded) {
    watch([selectedCharacters, selectedRare, selectedType, selectedAttr, selectedEffects, costumeSearch], () => {
      // 選択状態を一時保存エリアに更新
      tempSelectedCharacters.value = [...selectedCharacters.value];
      tempSelectedRare.value = [...selectedRare.value];
      tempSelectedType.value = [...selectedType.value];
      tempSelectedAttr.value = [...selectedAttr.value];
      tempSelectedEffects.value = [...selectedEffects.value];
      tempCostumeSearch.value = costumeSearch.value || '';
      
      // ユーザーがフィルターを変更したことを記録
      filterdStore.markFilterAsModified();
      
      // セッション内での永続化
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
  tempCostumeSearch.value = costumeSearch.value || '';

  // ユーザーがフィルターを変更したことを記録
  filterdStore.markFilterAsModified();
  
  // セッション内での永続化
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
  selectedCharacters.value = allCharacterNames.value;
  selectedRare.value = ['SSR']; // SSRのみをデフォルトで選択
  selectedType.value = ['バランス', 'ディフェンス', 'アタック'];
  selectedAttr.value = ['火', '水', '木', '無'];
  selectedEffects.value = [...defaultSelectedEffectValues];
  costumeSearch.value = '';

  // 一時保存エリアも更新
  tempSelectedCharacters.value = [...selectedCharacters.value];
  tempSelectedRare.value = [...selectedRare.value];
  tempSelectedType.value = [...selectedType.value];
  tempSelectedAttr.value = [...selectedAttr.value];
  tempSelectedEffects.value = [...selectedEffects.value];
  tempCostumeSearch.value = '';

  // ストアの状態をリセットしlocalStorageからも削除
  filterdStore.resetFilterState();

  // フィルターを適用
  updateCharacterVisibility();
}

// パフォーマンス最適化のためのSet
const selectedCharactersSet = computed(() => new Set(selectedCharacters.value));
const selectedRareSet = computed(() => new Set(selectedRare.value));
const selectedTypeSet = computed(() => new Set(selectedType.value));
const selectedAttrSet = computed(() => new Set(selectedAttr.value));
const selectedEffectsSet = computed(() => new Set(selectedEffects.value));
const allEffectsSelected = computed(() => localEffects.value.every(effect => selectedEffectsSet.value.has(effect.value)));

// 全キャラクター配列 - computed property化（画像があるもののみ）
const allCharacterNames = computed(() => 
  Object.values(filteredCharacterGroups.value).flat().map((student: Character) => student.name_en)
);

// スタイル最適化 - computed property化
const getCharacterItemStyle = (characterName: string) => {
  const isSelected = selectedCharactersSet.value.has(characterName);
  return {
    '--icon-size': `${iconSize}px`,
    '--gap-size': `${gapSize}px`,
    opacity: isSelected ? 1 : 0.5
  };
};

// フィルタリング処理を分離
function updateCharacterVisibility() {
  const normalizedCostumeSearch = normalizeSearchText(costumeSearch.value);

  characters.value.forEach(character => {
    // レア度チェック
    if (!selectedRareSet.value.has(character.rare)) {
      character.visible = false;
      return
    }
    // キャラチェック
    const characterInfo = characterLookupMap.get(character.chara);
    if (!characterInfo || !selectedCharactersSet.value.has(characterInfo.name_en)) {
      character.visible = false;
      return;
    }
    // タイプチェック
    if (!selectedTypeSet.value.has(character.attr)) {
      character.visible = false;
      return
    }
    // 衣装名チェック（日本語の元データと現在の表示言語の名前を対象に部分一致）
    if (normalizedCostumeSearch) {
      const costumeNames = [
        character.costume,
        localizeCostumeName(character, 'en'),
      ];
      if (!costumeNames.some(name => normalizeSearchText(name).includes(normalizedCostumeSearch))) {
        character.visible = false;
        return;
      }
    }
    // 属性チェック
    if ((!selectedAttrSet.value.has(character.magic1atr))
      && (!selectedAttrSet.value.has(character.magic2atr))
      && (!selectedAttrSet.value.has(character.magic3atr))) {
      character.visible = false;
      return
    }
    // 効果チェック
    if (allEffectsSelected.value) {
      // 効果が全件選択されている場合は無条件でtrue
      character.visible = true;
    } else if (selectedEffects.value.length === 0) {
      // 効果が全く選択されていない場合は無条件でfalse
      character.visible = false;
      return;
    } else {
      // 効果が1件以上選択されている場合、特殊条件を含めて一致を判定
      const effectMatched = matchesAnySelectedEffect(character.etc, selectedEffects.value);
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
    const allSelected = localEffects.value.every(effect => selectedEffectsSet.value.has(effect.value));
    if (allSelected) {
      // すべて選択されている場合は解除
      selectedEffects.value = [];
    } else {
      // すべてのエフェクトを選択
      selectedEffects.value = localEffects.value.map(effect => effect.value);
    }
  } else if (groupName === 'rarity') {
    selectedRare.value = isGroupFullySelected('rarity') ? [] : [...rareOptions];
  } else if (groupName === 'cardType') {
    selectedType.value = isGroupFullySelected('cardType') ? [] : typeOptions.value.map(type => type.value);
  } else if (groupName === 'magicAttribute') {
    selectedAttr.value = isGroupFullySelected('magicAttribute') ? [] : attrOptions.value.map(attr => attr.value);
  } else {
    // キャラクターグループの全選択/解除を処理
    const group: Character[] = filteredCharacterGroups.value[groupName] || [];
    const currentSet = selectedCharactersSet.value;
    const allSelected = group.every((characterInfo: Character) => currentSet.has(characterInfo.name_en));

    if (allSelected) {
      selectedCharacters.value = selectedCharacters.value.filter(c => !group.some(student => student.name_en === c));
    } else {
      selectedCharacters.value = [...new Set([...selectedCharacters.value, ...group.map(student => student.name_en)])];
    }
  }
}

function isGroupFullySelected(groupName: string): boolean {
  if (groupName === 'rarity') {
    return rareOptions.every(rare => selectedRareSet.value.has(rare));
  } else if (groupName === 'cardType') {
    return typeOptions.value.every(type => selectedTypeSet.value.has(type.value));
  } else if (groupName === 'magicAttribute') {
    return attrOptions.value.every(attr => selectedAttrSet.value.has(attr.value));
  } else if (groupName === 'statusEffects') {
    return localEffects.value.every(effect => selectedEffectsSet.value.has(effect.value));
  }

  const group = filteredCharacterGroups.value[groupName] || [];
  return group.every(character => selectedCharactersSet.value.has(character.name_en));
}

function normalizeSearchText(value: unknown): string {
  return String(value ?? '').normalize('NFKC').trim().toLocaleLowerCase();
}

// キャラクター選択の切り替え処理
function toggleCharacterSelection(characterValue: string) {
  const currentSet = selectedCharactersSet.value;
  selectedCharacters.value = currentSet.has(characterValue)
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

// 寮の並べ方 - computed property化
const layoutRows = computed(() => {
  const layout = [];
  let currentRow: string[] = [];
  let currentRowWidth = 0;
  const maxWidth = displayBlockWidth.value;
  const maxGroupsPerRow = 2;

  Object.entries(filteredCharacterGroups.value).forEach(([groupName, group]) => {
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
});

// キャラクター全体の全選択・解除機能
function toggleSelectAllCharacters() {
  if (areAllCharactersSelected()) {
    // 全て選択されている場合は全て解除
    selectedCharacters.value = [];
  } else {
    // 全てのキャラクターを選択
    selectedCharacters.value = [...allCharacterNames.value];
  }
}

// 全キャラクターが選択されているかチェック
function areAllCharactersSelected(): boolean {
  return allCharacterNames.value.every(character => selectedCharactersSet.value.has(character));
}
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
  position: sticky;
  bottom: 0;
  display: flex;
  gap: 10px; /* ボタン間のスペース */
  justify-content: center;
  background: white;
  border-top: 1px solid #e0e0e0;
  padding: 10px 0 0;
  z-index: 2;
}

.card-attribute-groups {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
  margin-bottom: 7px;
}

.attribute-group {
  display: grid;
  grid-template-rows: auto 1fr;
  min-width: 0;
  padding: 4px 7px 3px;
  border: 1px solid #e4e4e7;
  border-radius: 8px;
  background: #fafafa;
}

.attribute-group-header {
  display: flex;
  min-height: 25px;
  align-items: center;
  justify-content: space-between;
  gap: 5px;
  padding-left: 2px;
  color: #3f3f46;
  font-weight: 600;
}

.attribute-group-title {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-size: 0.88rem;
  white-space: nowrap;
}

.attribute-group-title .v-icon {
  color: #62666d;
}

.attribute-group-action,
.filter-section-action {
  min-width: 42px !important;
  height: 23px !important;
  padding: 0 5px !important;
  border-radius: 5px;
  color: #52525b;
  font-size: 0.75rem;
  letter-spacing: 0;
  background: #f4f4f5;
}

.section-heading-row {
  display: flex;
  min-height: 25px;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.section-title {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  color: #3f3f46;
  font-size: 0.88rem;
  font-weight: 600;
  white-space: nowrap;
}

.section-title .v-icon {
  color: #62666d;
}

.filter-section-surface {
  box-sizing: border-box;
  border: 1px solid #e4e4e7;
  border-radius: 8px;
  background: #fafafa;
}

.character-global-select-container {
  margin-bottom: 2px;
  padding: 0 2px;
}

.character-group-action {
  flex: 0 0 auto;
}

.attribute-items {
  display: grid;
  align-items: center;
  align-content: center;
  gap: 0 2px;
}

.attribute-group--rarity .attribute-items {
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

.attribute-group--type .attribute-items {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.attribute-group--attribute .attribute-items {
  grid-template-columns: repeat(4, minmax(0, 1fr));
}

.attribute-items :deep(.v-selection-control) {
  min-height: 28px;
}

.attribute-items :deep(.v-label) {
  font-size: 0.82rem;
  white-space: nowrap;
}

.attribute-items :deep(.v-selection-control__wrapper) {
  transform: scale(0.88);
}

.costume-search-container {
  display: flex;
  align-items: center;
  gap: 16px;
  box-sizing: border-box;
  width: 100%;
  max-width: 520px;
  margin: 10px 0;
  padding: 10px 12px;
}

.costume-search-label {
  display: inline-flex;
  flex: 0 0 96px;
  align-items: center;
  gap: 7px;
  color: #444;
  white-space: nowrap;
}

.costume-search-input {
  flex: 1 1 auto;
  min-width: 0;
}

.costume-search-input :deep(.v-field) {
  background: #fff;
}

.modal-background.embedded .costume-search-container {
  margin: 6px 0;
  padding: 7px 9px;
}

.status-effects-section {
  margin: 8px 0 3px;
  padding: 5px 9px;
}

.status-effect-items {
  gap: 0 4px;
}

.status-effect-items :deep(.v-selection-control) {
  min-height: 30px;
}

.status-effect-items :deep(.v-label) {
  font-size: 0.84rem;
}

@media (max-width: 600px) {
  .card-attribute-groups {
    grid-template-columns: 1fr;
    gap: 5px;
  }

  .costume-search-container {
    align-items: stretch;
    flex-direction: column;
    gap: 7px;
  }

  .costume-search-label {
    flex-basis: auto;
  }
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
  position: static;
  border-top: 0;
  padding-top: 0;
  justify-content: center;
  margin-top: 1px;
}

.filter-status {
  font-size: 12px;
  color: #666;
  font-style: italic;
}

.character-global-select-container {
  display: flex;
  align-items: center;
  gap: 8px;
}

.character-global-label {
  color: #333;
}
</style>
