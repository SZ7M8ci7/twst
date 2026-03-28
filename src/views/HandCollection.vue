<template>
  <v-container class="pa-2">
    <v-row class="ma-0">
      <v-col cols="12" class="pa-2">
        <!-- ヘッダー -->
        <div class="header-section">
          <div class="title-container">
            <h2 class="page-title">{{ $t('handCollection.title') }}</h2>
            <v-chip 
              v-if="hasUnsavedChanges" 
              color="warning" 
              size="small"
              class="unsaved-indicator"
            >
              {{ $t('handCollection.unsaved') }}
            </v-chip>
          </div>

          <!-- 保存・元に戻すボタン -->
          <div class="header-actions">
            <v-btn 
              @click="saveHandCollection" 
              color="primary" 
              size="small"
              :loading="saving"
              prepend-icon="mdi-content-save"
            >
              {{ $t('handCollection.save') }}
            </v-btn>
            <v-btn 
              @click="resetUnsavedChanges" 
              color="grey" 
              size="small"
              :disabled="!hasUnsavedChanges"
              prepend-icon="mdi-undo"
            >
              {{ $t('handCollection.undo') }}
            </v-btn>
          </div>
        </div>

        <!-- 一括操作コントロール -->
        <div class="controls-main-container">
          <div class="controls-container">
            <h3 class="controls-title">{{ $t('handCollection.bulkSettings') }}</h3>
            <div class="bulk-controls">
              <!-- レベル設定 -->
              <div class="control-group">
                <v-text-field 
                  type="number" 
                  v-model="bulkLevel" 
                  class="level-input" 
                  :label="$t('handCollection.level')" 
                  hide-details 
                  :min="0" 
                  :max="getMaxLevel('SSR')"
                  variant="outlined"
                  density="compact"
                />
                <v-btn @click="applyBulkLevel" color="primary" size="small">{{ $t('handCollection.levelSetting') }}</v-btn>
              </div>
              
              <!-- 所持設定 -->
              <div class="control-group">
                <v-btn @click="applyBulkOwnership(true)" color="success" size="small">{{ $t('handCollection.ownershipSetting') }}</v-btn>
                <v-btn @click="applyBulkOwnership(false)" color="grey" size="small">{{ $t('handCollection.ownershipCancel') }}</v-btn>
              </div>
              
              <!-- 凸数設定 -->
              <div class="control-group">
                <div class="native-select-group level-input">
                  <label class="native-select-label">{{ $t('handCollection.totsu') }}</label>
                  <select v-model.number="bulkTotsu" class="native-select">
                    <option v-for="option in totsuOptions" :key="option.value" :value="option.value">{{ option.title }}</option>
                  </select>
                </div>
                <v-btn @click="applyBulkTotsu" color="success" size="small">{{ $t('handCollection.totsuSetting') }}</v-btn>
              </div>
            </div>
          </div>

          <!-- フィルター・データ管理 -->
          <div class="save-controls-container">
            <div class="save-controls data-management-controls">
              <v-btn 
                @click="showFilterModal = true" 
                variant="outlined"
                prepend-icon="mdi-filter"
                size="default"
                class="data-btn"
              >
                {{ $t('handCollection.filter') }}
              </v-btn>
              
              <v-btn
                color="primary"
                variant="outlined"
                @click="openDataModal"
                prepend-icon="mdi-database"
                size="default"
                class="data-btn"
              >
                {{ $t('handCollection.dataManagement') }}
              </v-btn>
            </div>
          </div>
        </div>


        <!-- カード一覧テーブル -->
        <div v-if="loading" class="text-center">
          <v-progress-circular indeterminate />
          <p>Loading...</p>
        </div>

        <div v-else-if="filteredCharacters.length === 0" class="text-center py-4">
          <v-icon size="48" color="grey">mdi-cards-outline</v-icon>
          <div class="mt-2 text-grey">{{ $t('handCollection.noMatchingCards') }}</div>
          <v-btn @click="resetFilters" class="mt-2" color="primary" size="small">{{ $t('handCollection.resetFilters') }}</v-btn>
        </div>
        
        <div v-else>
          <!-- 手動テーブル -->
          <div class="manual-table">
            <!-- ヘッダー -->
            <div class="table-header">
              <div class="header-cell character-col">{{ $t('handCollection.character') }}</div>
              <div class="header-cell checkbox-col sortable-header" @click="handleSort('isOwned')">
                {{ $t('handCollection.owned') }}
                <v-icon size="16" class="sort-icon">{{ getSortIcon('isOwned') }}</v-icon>
              </div>
              <div class="header-cell totsu-col sortable-header" @click="handleSort('totsu')">
                {{ $t('handCollection.totsu') }}
                <v-icon size="16" class="sort-icon">{{ getSortIcon('totsu') }}</v-icon>
              </div>
              <div class="header-cell level-col sortable-header" @click="handleSort('level')">
                Lv
                <v-icon size="16" class="sort-icon">{{ getSortIcon('level') }}</v-icon>
              </div>
              <div class="header-cell rare-col sortable-header" v-if="windowWidth > 600" @click="handleSort('rare')">
                {{ $t('handCollection.rarity') }}
                <v-icon size="16" class="sort-icon">{{ getSortIcon('rare') }}</v-icon>
              </div>
              <div class="header-cell costume-col sortable-header" v-if="windowWidth > 600" @click="handleSort('costume')">
                {{ $t('handCollection.costume') }}
                <v-icon size="16" class="sort-icon">{{ getSortIcon('costume') }}</v-icon>
              </div>
            </div>
            
            <!-- データ行 -->
            <div 
              v-for="(item, index) in filteredCharacters" 
              :key="item.name"
              class="table-row"
              :class="{ 'even-row': index % 2 === 0 }"
            >
              <!-- キャラクター画像 -->
              <div class="data-cell character-col">
                <img :src="item.imgUrl" :alt="item.name" class="character-image" @error="handleImageError" />
              </div>
              
              <!-- 所持チェックボックス -->
              <div class="data-cell checkbox-col">
                <v-checkbox 
                  :model-value="item.isOwned"
                  @update:model-value="updateOwnership(item.name, $event ?? false)"
                  hide-details
                  color="success"
                  density="compact"
                />
              </div>
              
              <!-- 凸数 -->
              <div class="data-cell totsu-col">
                <select
                  class="table-select"
                  :value="item.totsu ?? 0"
                  :disabled="!item.isOwned"
                  @change="handleTableTotsuChange(item.name, $event)"
                >
                  <option v-for="option in totsuOptions" :key="option.value" :value="option.value">{{ option.title }}</option>
                </select>
              </div>
              
              <!-- レベル入力 -->
              <div class="data-cell level-col">
                <v-text-field 
                  type="number" 
                  :model-value="item.level"
                  @update:model-value="updateLevel(item.name, $event)"
                  class="level-input" 
                  hide-details
                  variant="outlined"
                  density="compact"
                  :min="0" 
                  :max="getMaxLevel(item.rare)"
                  :disabled="!item.isOwned"
                />
              </div>
              
              <!-- レア度 -->
              <div class="data-cell rare-col" v-if="windowWidth > 600">
                {{ item.rare }}
              </div>
              
              <!-- 衣装 -->
              <div class="data-cell costume-col" v-if="windowWidth > 600">
                {{ item.costume }}
              </div>
            </div>
          </div>
          
        </div>

        <!-- データ管理モーダル -->
        <v-dialog v-model="dataModal" max-width="800px">
          <v-card>
            <v-card-title>{{ $t('handCollection.dataManagement') }}</v-card-title>
            <v-card-text>
              <div class="data-actions mb-4">
                <v-btn color="primary" @click="copyToClipboard" class="action-btn" size="small">
                  <v-icon>mdi-content-copy</v-icon>
                  <span class="ml-2">{{ $t('handCollection.copy') }}</span>
                </v-btn>
                <v-btn color="primary" @click="importFromText" class="action-btn" size="small">
                  <v-icon>mdi-database-import</v-icon>
                  <span class="ml-2">{{ $t('handCollection.import') }}</span>
                </v-btn>
                <v-btn color="grey" @click="closeDataModal" class="action-btn" size="small">
                  <v-icon>mdi-close</v-icon>
                  <span class="ml-2">{{ $t('handCollection.close') }}</span>
                </v-btn>
              </div>
              <v-textarea
                v-model="dataText"
                outlined
                auto-grow
                rows="10"
                class="mt-4"
                :label="$t('handCollection.dataFormat')"
              ></v-textarea>
            </v-card-text>
          </v-card>
        </v-dialog>
        
        <v-snackbar
          v-model="snackbar.show"
          :color="snackbar.color"
          :timeout="3000"
        >
          {{ snackbar.text }}
        </v-snackbar>
        
        <!-- FilterModal -->
        <v-dialog v-model="showFilterModal" max-width="800" persistent>
          <FilterModal
            :embedded="false"
            @close="showFilterModal = false"
            @filter-applied="handleFilterApplied"
          />
        </v-dialog>
      </v-col>
    </v-row>
  </v-container>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { useHandCollectionStore, type HandCard } from '@/store/handCollection';
import { useCharacterStore } from '@/store/characters';
import { useFilterdStore } from '@/store/filterd';
import { storeToRefs } from 'pinia';
import defaultImg from '@/assets/img/default.webp';
import { hydrateCharacterImageUrls } from '@/utils/characterAssets';
import FilterModal from '@/components/FilterModal.vue';
import charactersInfo from '@/assets/characters_info.json';
import { useI18n } from 'vue-i18n';
import { getInputMaxLevel } from '@/constants/levels';
import { clampTotsuCount, deriveTotsuCount } from '@/utils/totsu';

// Stores and i18n
const { t } = useI18n();
const handCollectionStore = useHandCollectionStore();
const characterStore = useCharacterStore();
const filterdStore = useFilterdStore();
const { characters } = storeToRefs(characterStore);

// UI State
const loading = ref(true);
const showFilterModal = ref(false);
const bulkLevel = ref(getInputMaxLevel('SSR'));
const bulkTotsu = ref(4);
const windowWidth = ref(window.innerWidth);
const saving = ref(false);
const hasUnsavedChanges = ref(false);
const totsuOptions = [0, 1, 2, 3, 4].map(value => ({
  title: value.toString(),
  value,
}));

// ソート機能
const sortKey = ref<string>('default');
const sortOrder = ref<'asc' | 'desc'>('asc');

// 保存前の状態を保存（元に戻す機能用）
const savedState = ref<string>('');


// データ管理用
const dataModal = ref(false);
const dataText = ref('');
const snackbar = ref({
  show: false,
  text: '',
  color: 'success'
});

// キャラクター順序をキャッシュ化
const characterOrder = computed(() => 
  charactersInfo.map((info: any) => info.name_ja)
);

function getReadOnlyHandCard(cardName: string): HandCard {
  return handCollectionStore.peekHandCard(cardName) ?? {
    characterName: '',
    cardName,
    isOwned: false,
    level: 0,
    totsu: 0,
    isLimitBreak: false,
    isM3: false,
  };
}

// Computed Properties
const filteredCharacters = computed(() => {
  if (loading.value || !characters.value) {
    return [];
  }
  
  const order = characterOrder.value;
  
  const result = characters.value
    .filter(character => character.visible)
    .map(character => {
      const handCard = getReadOnlyHandCard(character.name);
      
      return {
        ...character,
        isOwned: handCard.isOwned,
        totsu: handCard.totsu,
        level: handCard.level
      };
    })
    .sort((a, b) => {
      // ソートキーに基づく並び替え
      if (sortKey.value === 'default') {
        // デフォルトソート: キャッシュされた順序でソート
        const indexA = order.indexOf(a.chara);
        const indexB = order.indexOf(b.chara);
        if (indexA === -1) return 1;
        if (indexB === -1) return -1;
        return indexA - indexB;
      } else {
        // カスタムソート
        let aValue: any, bValue: any;
        
        switch (sortKey.value) {
          case 'isOwned':
            aValue = a.isOwned ? 1 : 0;
            bValue = b.isOwned ? 1 : 0;
            break;
          case 'totsu':
            aValue = a.totsu;
            bValue = b.totsu;
            break;
          case 'level':
            aValue = a.level;
            bValue = b.level;
            break;
          case 'rare': {
            // SSR > SR > R の順序で数値化
            const rareOrder = { 'SSR': 3, 'SR': 2, 'R': 1 };
            aValue = rareOrder[a.rare as keyof typeof rareOrder] || 0;
            bValue = rareOrder[b.rare as keyof typeof rareOrder] || 0;
            break;
          }
          case 'costume':
            aValue = a.costume;
            bValue = b.costume;
            break;
          default:
            aValue = 0;
            bValue = 0;
        }
        
        // 文字列比較
        if (typeof aValue === 'string' && typeof bValue === 'string') {
          const comparison = aValue.localeCompare(bValue);
          return sortOrder.value === 'asc' ? comparison : -comparison;
        }
        
        // 数値比較
        if (aValue === bValue) {
          // 同じ値の場合はデフォルト順序で二次ソート
          const indexA = order.indexOf(a.chara);
          const indexB = order.indexOf(b.chara);
          return indexA - indexB;
        }
        
        return sortOrder.value === 'asc' ? aValue - bValue : bValue - aValue;
      }
    });
  
  return result;
});



// Methods
function getHandCard(cardName: string) {
  return getReadOnlyHandCard(cardName);
}

// ソート機能
function handleSort(key: string) {
  if (sortKey.value === key) {
    // 同じキーをクリックした場合は昇順/降順を切り替え
    sortOrder.value = sortOrder.value === 'asc' ? 'desc' : 'asc';
  } else {
    // 異なるキーをクリックした場合は新しいキーで昇順に設定
    sortKey.value = key;
    sortOrder.value = 'asc';
  }
}

function getSortIcon(key: string): string {
  if (sortKey.value !== key) {
    return 'mdi-sort';
  }
  return sortOrder.value === 'asc' ? 'mdi-sort-ascending' : 'mdi-sort-descending';
}

function updateOwnership(cardName: string, isOwned: boolean) {
  handCollectionStore.updateHandCard(cardName, { isOwned });
  markAsUnsaved();
}

function updateLevel(cardName: string, level: string | number) {
  const numLevel = typeof level === 'string' ? parseInt(level) : level;
  if (isNaN(numLevel)) return;
  
  const character = characters.value.find(item => item.name === cardName);
  const maxLevel = getMaxLevel(character?.rare || 'R');
  const clampedLevel = Math.max(0, Math.min(numLevel, maxLevel));
  
  handCollectionStore.updateHandCard(cardName, { level: clampedLevel });
  markAsUnsaved();
}

function updateTotsu(cardName: string, value: string | number | null) {
  handCollectionStore.updateHandCard(cardName, { totsu: clampTotsuCount(value) });
  markAsUnsaved();
}

function handleTableTotsuChange(cardName: string, event: Event) {
  updateTotsu(cardName, (event.target as HTMLSelectElement)?.value ?? 0);
}

function getMaxLevel(rare: string): number {
  return getInputMaxLevel(rare);
}

// 変更追跡機能
function markAsUnsaved() {
  hasUnsavedChanges.value = true;
}

// 保存機能
async function saveHandCollection() {
  saving.value = true;
  try {
    // 現在の状態を保存
    savedState.value = JSON.stringify(handCollectionStore.handCollection);
    
    // 手持ちコレクションを保存
    handCollectionStore.saveHandCollectionManually();
    
    // 未保存フラグをリセット
    hasUnsavedChanges.value = false;
    
    showSnackbar(t('handCollection.saveSuccess'));
  } catch (error) {
    console.error('保存エラー:', error);
    showSnackbar(t('handCollection.saveError'), 'error');
  } finally {
    saving.value = false;
  }
}

// 元に戻す機能
function resetUnsavedChanges() {
  if (savedState.value) {
    try {
      // 保存済みの状態に戻す
      const saved = JSON.parse(savedState.value);
      Object.keys(handCollectionStore.handCollection).forEach(key => {
        delete handCollectionStore.handCollection[key];
      });
      Object.assign(handCollectionStore.handCollection, saved);
      
      hasUnsavedChanges.value = false;
      showSnackbar(t('handCollection.undoSuccess'));
    } catch (error) {
      console.error('復元エラー:', error);
      showSnackbar(t('handCollection.undoError'), 'error');
    }
  }
}

// 一括レベル設定
function applyBulkLevel() {
  filteredCharacters.value.forEach(character => {
    const maxLevel = getMaxLevel(character.rare);
    const clampedLevel = Math.max(Math.min(bulkLevel.value, maxLevel), 0);
    handCollectionStore.updateHandCard(character.name, { level: clampedLevel });
  });
  markAsUnsaved();
}

// 一括所持設定
function applyBulkOwnership(isOwned: boolean) {
  filteredCharacters.value.forEach(character => {
    handCollectionStore.updateHandCard(character.name, { isOwned });
  });
  markAsUnsaved();
}

// 一括完凸設定
function applyBulkTotsu() {
  filteredCharacters.value.forEach(character => {
    handCollectionStore.updateHandCard(character.name, { totsu: bulkTotsu.value });
  });
  markAsUnsaved();
}

function handleFilterApplied() {
  // FilterModalからフィルターが適用された際の処理
  // characters.visibleプロパティが更新されているので、
  // 表示が自動的に更新される
}

// データ管理機能
function openDataModal() {
  dataModal.value = true;
  const cards = filteredCharacters.value.reduce((result, char) => {
    const handCard = getHandCard(char.name);
    if (handCard.level <= 0) {
      return result;
    }
    result[char.name] = {
      chara: char.chara,
      costume: char.costume,
      rare: char.rare,
      isOwned: handCard.isOwned,
      level: handCard.level,
      totsu: handCard.totsu,
    };
    return result;
  }, {} as Record<string, { chara: string; costume: string; rare: string; isOwned: boolean; level: number; totsu: number }>);

  dataText.value = JSON.stringify({
    format: 'twst-hand-collection-v2',
    cards,
  }, null, 2);
}

function closeDataModal() {
  dataModal.value = false;
  dataText.value = '';
}

function showSnackbar(text: string, color: 'success' | 'error' = 'success') {
  snackbar.value.text = text;
  snackbar.value.color = color;
  snackbar.value.show = true;
}

function copyToClipboard() {
  navigator.clipboard.writeText(dataText.value)
    .then(() => {
      showSnackbar(t('handCollection.copySuccess'));
    })
    .catch(err => {
      console.error('クリップボードへのコピーに失敗しました:', err);
      showSnackbar(t('handCollection.copyError'), 'error');
    });
}

function importFromText() {
  try {
    let importedCount = 0;
    const trimmed = dataText.value.trim();
    const parsedJson = trimmed ? JSON.parse(trimmed) : null;

    if (parsedJson && typeof parsedJson === 'object') {
      const cards = Array.isArray((parsedJson as any).cards)
        ? (parsedJson as any).cards
        : Object.entries((parsedJson as any).cards || {}).map(([cardName, value]) => ({
            cardName,
            ...(value as Record<string, unknown>),
          }));

      cards.forEach((entry: any) => {
        const character = characters.value.find(char =>
          (entry.cardName && char.name === entry.cardName) ||
          (entry.chara && entry.costume && char.chara === entry.chara && char.costume === entry.costume)
        );
        if (!character) return;

        handCollectionStore.updateHandCard(character.name, {
          isOwned: Boolean(entry.isOwned ?? entry.level > 0),
          level: Number(entry.level) || 0,
          totsu: clampTotsuCount(entry.totsu),
        });
        importedCount++;
      });
    }

    if (importedCount === 0) {
      const lines = dataText.value.split('\n').filter(line => line.trim());
      lines.forEach(line => {
        const parts = line.split('\t');
        if (parts.length < 2) return;
        const [chara, costume] = parts;
        const character = characters.value.find(
          char => char.chara === chara && char.costume === costume
        );
        if (!character) return;

        if (parts.length === 5) {
          const [, , level, , hasM3] = parts;
          handCollectionStore.updateHandCard(character.name, {
            isOwned: (parseInt(level) || 0) > 0,
            level: parseInt(level) || 0,
            totsu: deriveTotsuCount({ isM3: hasM3.toLowerCase() === 'true' }),
          });
          importedCount++;
          return;
        }

        if (parts.length === 7) {
          const [, , level, , hasM3, isOwned, isLimitBreak] = parts;
          handCollectionStore.updateHandCard(character.name, {
            isOwned: isOwned.toLowerCase() === 'true',
            level: parseInt(level) || 0,
            totsu: deriveTotsuCount({
              isLimitBreak: isLimitBreak.toLowerCase() === 'true',
              isM3: hasM3.toLowerCase() === 'true',
            }),
          });
          importedCount++;
        }
      });
    }

    markAsUnsaved();
    closeDataModal();
    showSnackbar(t('handCollection.importSuccess', { count: importedCount }));
  } catch (error) {
    try {
      let importedCount = 0;
      const lines = dataText.value.split('\n').filter(line => line.trim());
      lines.forEach(line => {
        const parts = line.split('\t');
        if (parts.length < 2) return;
        const [chara, costume] = parts;
        const character = characters.value.find(
          char => char.chara === chara && char.costume === costume
        );
        if (!character) return;

        if (parts.length === 5) {
          const [, , level, , hasM3] = parts;
          handCollectionStore.updateHandCard(character.name, {
            isOwned: (parseInt(level) || 0) > 0,
            level: parseInt(level) || 0,
            totsu: deriveTotsuCount({ isM3: hasM3.toLowerCase() === 'true' }),
          });
          importedCount++;
          return;
        }

        if (parts.length === 7) {
          const [, , level, , hasM3, isOwned, isLimitBreak] = parts;
          handCollectionStore.updateHandCard(character.name, {
            isOwned: isOwned.toLowerCase() === 'true',
            level: parseInt(level) || 0,
            totsu: deriveTotsuCount({
              isLimitBreak: isLimitBreak.toLowerCase() === 'true',
              isM3: hasM3.toLowerCase() === 'true',
            }),
          });
          importedCount++;
        }
      });

      if (importedCount === 0) {
        throw error;
      }

      markAsUnsaved();
      closeDataModal();
      showSnackbar(t('handCollection.importSuccess', { count: importedCount }));
    } catch (fallbackError) {
      console.error('インポートエラー:', fallbackError);
      showSnackbar(t('handCollection.importError'), 'error');
    }
  }
}

function handleImageError(event: Event) {
  const target = event.target as HTMLImageElement;
  target.src = defaultImg;
}

// フィルターリセット機能
function resetFilters() {
  // 全キャラクターを表示状態にリセット
  characters.value.forEach(character => {
    character.visible = true;
  });
  
  // FilterdStoreもリセット
  filterdStore.resetFilterState();
}

// ウィンドウリサイズの監視
function handleResize() {
  windowWidth.value = window.innerWidth;
}

// Initialize
onMounted(async () => {
  // ウィンドウリサイズイベントリスナーを追加
  window.addEventListener('resize', handleResize);
  loading.value = true;
  
  
  try {
    // characterStoreの初期化を確実に待つ
    if (!characters.value || characters.value.length === 0) {
      characterStore.handlePageChange('handCollectionPage');
      
      // 少し待ってから再確認
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    // 画像の読み込み処理
    if (characters.value && characters.value.length > 0) {
      await hydrateCharacterImageUrls(characters.value, 'name', { fallbackName: 'notyet' });
      characters.value.forEach((character) => {
        if (!character.imgUrl) {
          character.imgUrl = defaultImg;
        }
      });
    }
    
    // 初期化時にcharacter.visibleを設定
    if (characters.value) {
      characters.value.forEach((character) => {
        if (!('visible' in character)) {
          character.visible = true; // デフォルトで全て表示
        }
      });
    }
    
    // 初期状態を保存
    savedState.value = JSON.stringify(handCollectionStore.handCollection);
    
  } finally {
    loading.value = false;
  }
});

onUnmounted(() => {
  // ウィンドウリサイズイベントリスナーを削除
  window.removeEventListener('resize', handleResize);
});
</script>

<style scoped>
.page-title {
  font-size: 1.5rem;
  font-weight: 600;
  margin-bottom: 8px;
}

.title-container {
  display: flex;
  align-items: center;
  gap: 12px;
}

.unsaved-indicator {
  animation: pulse 1.5s infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.7; }
}

.header-section {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
  flex-wrap: wrap;
  gap: 8px;
}

.header-actions {
  display: flex;
  gap: 8px;
  align-items: center;
}

.stats-summary {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}


.controls-main-container {
  display: flex;
  gap: 16px;
  margin-bottom: 16px;
}

.controls-container {
  flex: 1;
  padding: 16px;
  background-color: #f5f5f5;
  border-radius: 8px;
}

.controls-title {
  margin: 0 0 12px 0;
  font-size: 1.1rem;
  font-weight: 600;
  color: #333;
}

.bulk-controls {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
  align-items: center;
}

.control-group {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.save-controls-container {
  flex: 0 0 300px;
  padding: 16px;
  background-color: #f8f9fa;
  border-radius: 8px;
  border: 1px solid #dee2e6;
}

.save-controls {
  display: flex;
  gap: 12px;
  justify-content: center;
  align-items: center;
  flex-wrap: wrap;
}

.data-management-controls {
  flex-direction: row !important;
  flex-wrap: nowrap !important;
}

.data-btn {
  flex: 0 1 auto !important;
  min-width: 120px;
}

.level-controls {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}

.level-input {
  max-width: 120px;
  min-width: 100px;
}

.level-input :deep(.v-field) {
  margin: 0 !important;
  height: 40px !important;
}

.level-input :deep(.v-field__field) {
  height: 40px !important;
  min-height: 40px !important;
}

.level-input :deep(.v-input) {
  grid-template-rows: min-content 0 !important;
  margin: 0 !important;
}

.level-input :deep(.v-field__input) {
  padding-top: 8px !important;
  padding-bottom: 8px !important;
}

.native-select-group {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.native-select-label {
  font-size: 0.75rem;
  color: rgba(0, 0, 0, 0.6);
  line-height: 1;
}

.native-select,
.table-select {
  width: 100%;
  border: 1px solid #ccc;
  border-radius: 4px;
  background-color: #fff;
  color: rgba(0, 0, 0, 0.87);
  min-height: 40px;
  padding: 0 12px;
  appearance: none;
  -webkit-appearance: none;
  -moz-appearance: none;
}

.table-select:disabled {
  background-color: #f5f5f5;
  color: rgba(0, 0, 0, 0.38);
}

.character-image {
  width: 40px;
  height: 40px;
  border-radius: 1px;
  object-fit: cover;
}

.action-buttons {
  display: flex;
  gap: 4px;
  flex-wrap: wrap;
}

/* モバイル対応 */
@media (max-width: 600px) {
  .header-section {
    flex-direction: row;
    justify-content: space-between;
    align-items: center;
  }
  
  .header-actions {
    flex-shrink: 0;
  }
  
  .controls-main-container {
    flex-direction: column;
    gap: 12px;
  }
  
  .save-controls-container {
    flex: 1;
  }
  
  .bulk-controls {
    flex-direction: column;
    align-items: stretch;
    gap: 12px;
  }
  
  .control-group {
    justify-content: center;
  }
  
  .character-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 8px;
  }
  
  .character-icon {
    width: 32px;
    height: 32px;
  }
  
  .stats-summary {
    justify-content: center;
    width: 100%;
  }

  .save-controls {
    flex-direction: row;
    gap: 8px;
    justify-content: center;
  }
  
  .data-management-controls {
    flex-direction: row !important;
    flex-wrap: wrap !important;
  }
  
  .data-btn {
    flex: 1 1 45% !important;
    min-width: 100px !important;
  }
}

/* Vuetify 3 のスタイル調整 */
:deep(.v-expansion-panel-title) {
  padding: 12px 16px;
}

:deep(.v-expansion-panel-text__wrapper) {
  padding: 12px 16px;
}

:deep(.v-field) {
  margin: 0 !important;
}

:deep(.v-field__field) {
  padding: 4px 8px !important;
  min-height: 36px !important;
}

:deep(.v-input) {
  grid-template-rows: min-content 0 !important;
}

:deep(.v-checkbox) {
  margin: 0 !important;
}

.data-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.action-btn {
  flex: 1;
  min-width: 120px;
  max-width: 200px;
}

@media (max-width: 600px) {
  .action-btn {
    flex: 1 1 100%;
    max-width: none;
  }
}

.format-selector {
  background-color: #f5f5f5;
  border-radius: 8px;
  padding: 16px;
}

.format-info {
  color: #666;
  line-height: 1.5;
}

/* 手動テーブルのスタイル */
.manual-table {
  border: 1px solid #ddd;
  border-radius: 4px;
  overflow: hidden;
}

.table-header {
  display: flex;
  background-color: #f5f5f5;
  font-weight: bold;
  border-bottom: 2px solid #ddd;
}

.sortable-header {
  cursor: pointer;
  user-select: none;
  transition: background-color 0.2s ease;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
}

.sortable-header:hover {
  background-color: #e8f4fd;
}

.sort-icon {
  opacity: 0.7;
  transition: opacity 0.2s ease;
}

.sortable-header:hover .sort-icon {
  opacity: 1;
}

.table-row {
  display: flex;
  border-bottom: 1px solid #eee;
  min-height: 60px;
  align-items: center;
}

.table-row:hover {
  background-color: #f9f9f9;
}

.even-row {
  background-color: #fafafa;
}

.header-cell, .data-cell {
  padding: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-right: 1px solid #eee;
}

.header-cell:last-child, .data-cell:last-child {
  border-right: none;
}

.character-col {
  flex: 0 0 80px;
  min-width: 80px;
}

.checkbox-col {
  flex: 0 0 60px;
  min-width: 60px;
}

.totsu-col {
  flex: 0 0 90px;
  min-width: 90px;
}

.level-col {
  flex: 0 0 100px;
  min-width: 100px;
}

.rare-col {
  flex: 0 0 80px;
  min-width: 80px;
}

.costume-col {
  flex: 1;
  min-width: 120px;
  text-align: left;
  justify-content: flex-start;
}

.character-image {
  width: 40px;
  height: 40px;
  border-radius: 1px;
  object-fit: cover;
}

/* モバイル対応 */
@media (max-width: 600px) {
  .character-col {
    flex: 0 0 60px;
    min-width: 60px;
  }
  
  .checkbox-col {
    flex: 0 0 50px;
    min-width: 50px;
  }

  .totsu-col {
    flex: 0 0 84px;
    min-width: 84px;
  }
  
  .level-col {
    flex: 1;
    min-width: 80px;
  }
  
  .character-image {
    width: 32px;
    height: 32px;
  }
}
</style>
