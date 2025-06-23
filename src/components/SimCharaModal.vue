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
import { computed, onBeforeMount, ref } from 'vue';
import { useCharacterStore } from '@/store/characters';
import { storeToRefs } from 'pinia';
import defaultImg from '@/assets/img/default.png';
import FilterModal from '@/components/FilterModal.vue';
import characterData from '@/assets/characters_info.json';

const characterStore = useCharacterStore();
const { characters } = storeToRefs(characterStore);
const loadingImgUrl = ref(true);

// タブ管理
const activeTab = ref('filter');

// 展開状態
const isExpanded = ref(false);

// ソート設定
const sortBy = ref('default');
const sortOrder = ref('asc');

// ソートオプション
const sortOptions = [
  { text: 'デフォルト順', value: 'default' },
  { text: 'レア度', value: 'rarity' },
  { text: 'HP', value: 'hp' },
  { text: 'ATK', value: 'atk' }
];

const sortOrderOptions = [
  { text: '昇順', value: 'asc' },
  { text: '降順', value: 'desc' }
];


// フィルター適用済みのキャラクターリスト
const filteredCharacters = computed(() => {
  if (loadingImgUrl.value) {
    return []; // 画像URLの読み込み中は空の配列を返す
  }

  let filtered = characters.value.filter(character => {
    // 画像が読み込まれているか確認
    if (!character.imgUrl) return false;
    
    // visibleフラグをチェック（FilterModalから適用されたフィルター）
    if (!character.visible) return false;
    
    return true;
  });

  // ソート処理
  if (sortBy.value === 'default') {
    // デフォルト順：characters_info.jsonの順序でソート
    filtered.sort((a, b) => {
      const aInfo = characterData.find(char => char.name_ja === a.chara || char.name_en === a.chara);
      const bInfo = characterData.find(char => char.name_ja === b.chara || char.name_en === b.chara);
      
      const aIndex = aInfo ? characterData.indexOf(aInfo) : 999999;
      const bIndex = bInfo ? characterData.indexOf(bInfo) : 999999;
      
      return sortOrder.value === 'desc' ? bIndex - aIndex : aIndex - bIndex;
    });
  } else {
    filtered.sort((a, b) => {
      let aValue, bValue;
      
      switch (sortBy.value) {
        case 'rarity':
          const rarityOrder = { 'SSR': 3, 'SR': 2, 'R': 1 };
          aValue = rarityOrder[a.rare] || 0;
          bValue = rarityOrder[b.rare] || 0;
          break;
        case 'hp':
          aValue = a.hp || 0;
          bValue = b.hp || 0;
          break;
        case 'atk':
          aValue = a.atk || 0;
          bValue = b.atk || 0;
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
      
      // 降順の場合は反転
      return sortOrder.value === 'desc' ? -comparison : comparison;
    });
  }

  return filtered;
});

const emit = defineEmits(['close', 'select']);

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
  switch (sortBy.value) {
    case 'default':
      return character.chara || character.name;
    case 'rarity':
      return character.rare;
    case 'hp':
      return character.hp || 0;
    case 'atk':
      return character.atk || 0;
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
