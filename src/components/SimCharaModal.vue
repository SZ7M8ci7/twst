<template>
  <div class="modal-overlay" @click.self="closeModal">
    <div class="modal-content">
      <!-- フィルターセクション -->
      <div class="filter-section">
        <div class="filter-header">
          <h3>キャラクターフィルター</h3>
          <v-btn small @click="toggleSelectAll('attributes')">
            {{ isGroupFullySelected('attributes') ? '全解除' : '全選択' }}
          </v-btn>
        </div>
        
        <!-- 属性フィルター -->
        <div class="filter-group">
          <div class="filter-label">属性:</div>
          <div class="filter-items">
            <div class="filter-item" v-for="(attr, index) in attrOptions" :key="`attr-${index}`">
              <v-checkbox v-model="selectedAttributes" :value="attr.value" :label="attr.name" hide-details />
            </div>
          </div>
        </div>
        
        <!-- タイプフィルター -->
        <div class="filter-group">
          <div class="filter-label">タイプ:</div>
          <div class="filter-items">
            <div class="filter-item" v-for="(type, index) in typeOptions" :key="`type-${index}`">
              <v-checkbox v-model="selectedTypes" :value="type.value" :label="type.name" hide-details />
            </div>
          </div>
        </div>
        
        <!-- レア度フィルター -->
        <div class="filter-group">
          <div class="filter-label">レア度:</div>
          <div class="filter-items">
            <div class="filter-item" v-for="(rare, index) in rareOptions" :key="`rare-${index}`">
              <v-checkbox v-model="selectedRares" :value="rare" :label="rare" hide-details />
            </div>
          </div>
        </div>
      </div>
      
      <hr class="divider" />
      
      <!-- 検索ボックス -->
      <div class="search-box">
        <input 
          type="text" 
          v-model="searchQuery" 
          placeholder="キャラクター名で検索..." 
          class="search-input"
        />
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
            <div class="character-name">{{ character.chara || character.name }}</div>
          </div>
        </div>
      </div>
      
      <!-- ボタンコンテナ -->
      <div class="button-container">
        <v-btn class="button" @click="closeModal">キャンセル</v-btn>
        <v-btn class="button apply-button" @click="resetFilters">フィルターリセット</v-btn>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, onBeforeMount, ref, watch } from 'vue';
import { useCharacterStore } from '@/store/characters';
import { storeToRefs } from 'pinia';
import defaultImg from '@/assets/img/default.png';

const characterStore = useCharacterStore();
const { characters } = storeToRefs(characterStore);
const loadingImgUrl = ref(true);
const searchQuery = ref('');

// フィルター状態
const selectedAttributes = ref(['火', '水', '木', '無']);
const selectedTypes = ref(['バランス', 'ディフェンス', 'アタック']);
const selectedRares = ref(['SSR', 'SR', 'R']);

// フィルターオプション
const attrOptions = [
  { name: '火', value: '火' },
  { name: '水', value: '水' },
  { name: '木', value: '木' },
  { name: '無', value: '無' }
];

const typeOptions = [
  { name: 'バランス', value: 'バランス' },
  { name: 'ディフェンス', value: 'ディフェンス' },
  { name: 'アタック', value: 'アタック' }
];

const rareOptions = ['SSR', 'SR', 'R'];

// フィルター適用済みのキャラクターリスト
const filteredCharacters = computed(() => {
  if (loadingImgUrl.value) {
    return []; // 画像URLの読み込み中は空の配列を返す
  }

  return characters.value.filter(character => {
    // 画像が読み込まれているか確認
    if (!character.imgUrl) return false;
    
    // 検索クエリでフィルタリング
    if (searchQuery.value && character.chara) {
      const query = searchQuery.value.toLowerCase();
      const name = character.chara.toLowerCase();
      if (!name.includes(query)) return false;
    }
    
    // レア度でフィルタリング
    if (!selectedRares.value.includes(character.rare)) return false;
    
    // タイプでフィルタリング
    if (!selectedTypes.value.includes(character.attr)) return false;
    
    // 属性でフィルタリング (魔法1, 2, 3のいずれかが選択された属性に含まれるか)
    const hasSelectedAttribute = 
      (character.magic1Attribute && selectedAttributes.value.includes(character.magic1Attribute)) ||
      (character.magic2Attribute && selectedAttributes.value.includes(character.magic2Attribute)) ||
      (character.magic3Attribute && selectedAttributes.value.includes(character.magic3Attribute)) ||
      // 旧属性名もサポート
      (character.magic1atr && selectedAttributes.value.includes(character.magic1atr)) ||
      (character.magic2atr && selectedAttributes.value.includes(character.magic2atr)) ||
      (character.magic3atr && selectedAttributes.value.includes(character.magic3atr));
    
    if (!hasSelectedAttribute) return false;
    
    return true;
  });
});

const emit = defineEmits(['close', 'select']);

const closeModal = () => {
  emit('close');
};

const selectImage = (character) => {
  emit('select', character);
};

// 全選択/全解除の切り替え
function toggleSelectAll(group) {
  if (group === 'attributes') {
    if (isGroupFullySelected('attributes')) {
      selectedAttributes.value = [];
    } else {
      selectedAttributes.value = attrOptions.map(attr => attr.value);
    }
  }
}

// グループが完全に選択されているかチェック
function isGroupFullySelected(group) {
  if (group === 'attributes') {
    return attrOptions.every(attr => selectedAttributes.value.includes(attr.value));
  }
  return false;
}

// フィルターをリセット
function resetFilters() {
  selectedAttributes.value = ['火', '水', '木', '無'];
  selectedTypes.value = ['バランス', 'ディフェンス', 'アタック'];
  selectedRares.value = ['SSR', 'SR', 'R'];
  searchQuery.value = '';
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

.filter-section {
  margin-bottom: 20px;
}

.filter-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 15px;
}

.filter-group {
  display: flex;
  align-items: center;
  margin-bottom: 10px;
}

.filter-label {
  width: 80px;
  font-weight: bold;
}

.filter-items {
  display: flex;
  flex-wrap: wrap;
}

.filter-item {
  margin-right: 15px;
}

.divider {
  border: none;
  height: 1px;
  background-color: #e0e0e0;
  width: 100%;
  margin: 15px 0;
}

.search-box {
  margin-bottom: 20px;
}

.search-input {
  width: 100%;
  padding: 10px;
  border: 1px solid #ccc;
  border-radius: 4px;
  font-size: 16px;
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
  grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
  gap: 15px;
}

.character-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  cursor: pointer;
  transition: transform 0.2s;
  padding: 5px;
  border-radius: 8px;
}

.character-item:hover {
  transform: scale(1.05);
  background-color: rgba(0, 0, 0, 0.05);
}

.character-image {
  width: 100%;
  height: auto;
  border-radius: 8px;
  object-fit: cover;
}

.character-name {
  margin-top: 5px;
  font-size: 12px;
  text-align: center;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.button-container {
  display: flex;
  justify-content: center;
  gap: 15px;
}

.button {
  min-width: 120px;
}

.apply-button {
  background-color: #19d241;
  color: white;
}
</style>
