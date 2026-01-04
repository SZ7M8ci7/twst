<template>
  <div class="modal-overlay" @click.self="closeModal">
    <div class="modal-content">
      <div class="modal-body">
        <!-- 保存セクション -->
        <div class="save-section">
          <div class="save-row">
            <v-text-field
              v-model="newDeckName"
              placeholder="編成名（未入力で現在日時）"
              hide-details
              density="compact"
              variant="outlined"
            />
            <v-btn 
              @click="saveDeck" 
              color="success"
              size="small"
              variant="flat"
              class="save-btn"
            >
              <v-icon size="small">mdi-content-save</v-icon>
            </v-btn>
          </div>
          <div v-if="saveError" class="error-message">{{ saveError }}</div>
        </div>

        <!-- 保存済み編成一覧 -->
        <div class="saved-decks-section">
          <div v-if="!hasAnyDecks" class="no-decks">
            保存された編成はありません
          </div>
          <div v-else>
            <div 
              v-for="deck in displayedDecks" 
              :key="deck.id"
              class="deck-item"
              @click="restoreDeck(deck.id)"
            >
              <div class="deck-row">
                <div class="deck-info">
                  <div class="deck-name">
                    {{ deck.name }}
                  </div>
                  <div class="character-icons">
                    <div 
                      v-for="(char, i) in deck.deckCharacters.slice(0,5)" 
                      :key="i"
                      class="icon-slot"
                    >
                      <img 
                        v-if="char && char.chara && getCharacterDisplayKey(char) && getCachedImageUrl(getCharacterDisplayKey(char))"
                        :src="getCachedImageUrl(getCharacterDisplayKey(char))" 
                        :alt="char.name || getCharacterNameFromImageUrl(char.imgUrl || '')"
                        class="icon"
                      />
                      <div v-else class="empty-icon">
                        <v-icon size="x-small" color="grey">mdi-account-plus</v-icon>
                      </div>
                    </div>
                  </div>
                </div>
                <v-btn 
                  v-if="deck.id !== AUTO_SAVE_DECK_ID"
                  size="x-small" 
                  @click.stop="deleteDeck(deck.id)"
                  color="error"
                  variant="flat"
                  class="delete-btn"
                >
                  <v-icon size="default">mdi-trash-can</v-icon>
                </v-btn>
              </div>
            </div>
          </div>
        </div>
        
        <!-- 閉じるボタン -->
        <div class="close-section">
          <v-btn @click="closeModal" variant="text" block>
            閉じる
          </v-btn>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useSimulatorStore } from '@/store/simulatorStore';
import { loadCharacterImage } from '@/utils/characterSelection';

interface SavedDeck {
  id: string;
  name: string;
  deckCharacters: any[];
  selectedAttribute: string;
  savedAt: string;
}

const emit = defineEmits(['close']);
const simulatorStore = useSimulatorStore();

const newDeckName = ref('');
const saveError = ref('');
const savedDecks = ref<SavedDeck[]>([]);
const autoSaveDeck = ref<SavedDeck | null>(null);

// 各編成の画像URLをキャッシュするための reactive map
const imageUrlCache = ref<Map<string, string>>(new Map());

// キャッシュから画像URLを取得する関数
const getCachedImageUrl = (characterName: string): string => {
  return imageUrlCache.value.get(characterName) || '';
};

// ハッシュなしのファイル名を抽出する共通関数（後方互換性のため）
const extractCleanImageName = (imgUrl: string): string => {
  if (!imgUrl) return '';
  
  // ファイル名部分を抽出（最後の/以降）
  let fileName = imgUrl.split('/').pop() || '';
  
  // クエリパラメータを除去（?以降）
  fileName = fileName.split('?')[0];
  
  // ハッシュ部分を除去（-で始まり.png/.webpで終わる部分）
  let cleanFileName = fileName.replace(/-[a-zA-Z0-9_-]+\.(png|webp)$/, '.$1');
  
  // .pngの場合は.webpに変換（実際の読み込みはwebpで行うため）
  if (cleanFileName.endsWith('.png')) {
    cleanFileName = cleanFileName.replace('.png', '.webp');
  }
  
  return cleanFileName;
};

// 画像URLからキャラクター名を推定する関数（後方互換性のため）
const getCharacterNameFromImageUrl = (imgUrl: string): string => {
  if (!imgUrl) return '';
  
  // 新形式の場合：直接ファイル名からキャラクター名を抽出
  const cleanFileName = extractCleanImageName(imgUrl);
  
  // .webp/.png拡張子を除去してキャラクター名を取得
  const characterName = cleanFileName.replace(/\.(png|webp)$/, '');
  
  return characterName;
};

// キャラクター表示用のキーを取得する関数（新旧両形式に対応）
const getCharacterDisplayKey = (char: any): string => {
  // 新形式：nameが存在する場合
  if (char?.name) {
    return char.name;
  }
  // 旧形式：imgUrlからキャラクター名を推定
  else if (char?.imgUrl) {
    return getCharacterNameFromImageUrl(char.imgUrl);
  }
  return '';
};

// 保存済み編成の画像URLを事前に読み込んでキャッシュする関数
const preloadDeckImages = async () => {
  const imagePromises: Promise<void>[] = [];
  
  displayedDecks.value.forEach(deck => {
    deck.deckCharacters.forEach(char => {
      let cacheKey = '';
      
      // 新形式（nameが存在する場合）
      if (char?.name) {
        cacheKey = char.name;
      }
      // 旧形式（imgUrlのみ存在する場合）- 後方互換性
      else if (char?.imgUrl) {
        cacheKey = getCharacterNameFromImageUrl(char.imgUrl);
      }
      
      if (cacheKey && !imageUrlCache.value.has(cacheKey)) {
        const promise = loadCharacterImage(cacheKey).then(url => {
          if (url) {
            imageUrlCache.value.set(cacheKey, url);
          }
        }).catch(error => {
          console.warn('画像の事前読み込みに失敗しました:', cacheKey, error);
        });
        imagePromises.push(promise);
      }
    });
  });
  
  await Promise.all(imagePromises);
};

const STORAGE_KEY = 'twst_saved_decks';
const AUTO_SAVE_STORAGE_KEY = 'twst_autosave_deck';
const AUTO_SAVE_DECK_ID = 'autosave';
const AUTO_SAVE_DECK_NAME = 'AutoSave';

const displayedDecks = computed(() => {
  if (autoSaveDeck.value) {
    return [autoSaveDeck.value, ...savedDecks.value];
  }
  return savedDecks.value;
});

const hasAnyDecks = computed(() => displayedDecks.value.length > 0);


function buildDeckSnapshot(deckCharacters: any[], name: string, id: string): SavedDeck {
  const cleanedDeckCharacters = deckCharacters.map(char => {
    const charCopy = JSON.parse(JSON.stringify(char));
    delete charCopy.imgUrl;
    return charCopy;
  });

  return {
    id,
    name,
    deckCharacters: cleanedDeckCharacters,
    selectedAttribute: simulatorStore.selectedAttribute,
    savedAt: new Date().toISOString()
  };
}

function loadAutoSaveDeck() {
  try {
    const saved = localStorage.getItem(AUTO_SAVE_STORAGE_KEY);
    if (saved) {
      const loaded = JSON.parse(saved);
      if (loaded && Array.isArray(loaded.deckCharacters)) {
        autoSaveDeck.value = {
          ...loaded,
          id: AUTO_SAVE_DECK_ID,
          name: AUTO_SAVE_DECK_NAME
        };
        return;
      }
    }
  } catch (error) {
    console.error('AutoSaveの読み込みに失敗しました:', error);
  }

  if (simulatorStore.deckCharacters.some(char => char?.chara)) {
    autoSaveDeck.value = buildDeckSnapshot(
      simulatorStore.deckCharacters,
      AUTO_SAVE_DECK_NAME,
      AUTO_SAVE_DECK_ID
    );
  } else {
    autoSaveDeck.value = null;
  }
}

function closeModal() {
  emit('close');
}

// 旧形式のデータを新形式にマイグレーションする関数
function migrateLegacyDecks(decks: SavedDeck[]): SavedDeck[] {
  return decks.map(deck => {
    const migratedCharacters = deck.deckCharacters.map(char => {
      // 旧形式（nameがなくimgUrlのみ存在）の場合、nameを補完
      if (!char.name && char.imgUrl) {
        const characterName = getCharacterNameFromImageUrl(char.imgUrl);
        return {
          ...char,
          name: characterName
        };
      }
      return char;
    });
    
    return {
      ...deck,
      deckCharacters: migratedCharacters
    };
  });
}

function loadSavedDecks() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      let loadedDecks = JSON.parse(saved);
      
      // 旧形式のデータをマイグレーション
      loadedDecks = migrateLegacyDecks(loadedDecks);
      
      savedDecks.value = loadedDecks;
      
      // マイグレーション後のデータを保存（次回以降の読み込みを高速化）
      localStorage.setItem(STORAGE_KEY, JSON.stringify(loadedDecks));
    }
  } catch (error) {
    console.error('保存された編成の読み込みに失敗しました:', error);
  }
}

async function saveDeck() {
  saveError.value = '';
  
  const deckName = newDeckName.value.trim() || getCurrentDateTime();

  if (savedDecks.value.find(deck => deck.name === deckName)) {
    saveError.value = 'この名前の編成は既に存在します';
    return;
  }

  try {
    // deckCharactersが存在し、配列であることを確認
    if (!simulatorStore.deckCharacters || !Array.isArray(simulatorStore.deckCharacters)) {
      saveError.value = '編成データが見つかりません';
      return;
    }

    const newDeck = buildDeckSnapshot(
      simulatorStore.deckCharacters,
      deckName,
      Date.now().toString()
    );

    savedDecks.value.unshift(newDeck);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(savedDecks.value));
    newDeckName.value = '';
    saveError.value = '';
    
    // 保存後にキャッシュを更新
    await preloadDeckImages();
    
  } catch (error) {
    console.error('編成の保存に失敗しました:', error);
    saveError.value = '編成の保存に失敗しました';
  }
}

function getCurrentDateTime(): string {
  const now = new Date();
  return now.toLocaleDateString('ja-JP', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

async function restoreDeck(deckId: string) {
  const deck = deckId === AUTO_SAVE_DECK_ID
    ? autoSaveDeck.value
    : savedDecks.value.find(d => d.id === deckId);
  if (!deck || !deck.deckCharacters) return;

  // 編成データを復元
  for (const [index, char] of deck.deckCharacters.entries()) {
    if (char && simulatorStore.deckCharacters[index]) {
      let characterName = '';
      
      // 新形式：nameが存在する場合
      if (char.name) {
        characterName = char.name;
      }
      // 旧形式：imgUrlからキャラクター名を推定（後方互換性）
      else if (char.imgUrl) {
        characterName = getCharacterNameFromImageUrl(char.imgUrl);
        // 旧形式の場合、nameフィールドを補完
        char.name = characterName;
      }
      
      // 現在の環境に適した画像URLを再生成
      if (characterName) {
        try {
          const actualImgUrl = await loadCharacterImage(characterName);
          char.imgUrl = actualImgUrl;
        } catch (error) {
          console.warn('画像の読み込みに失敗しました:', characterName, error);
        }
      }
      
      Object.assign(simulatorStore.deckCharacters[index], char);
    }
  }
  
  if (deck.selectedAttribute) {
    simulatorStore.selectedAttribute = deck.selectedAttribute;
  }
  
  simulatorStore.recalculateStats();
  closeModal();
}

function deleteDeck(deckId: string) {
  if (deckId === AUTO_SAVE_DECK_ID) return;
  savedDecks.value = savedDecks.value.filter(deck => deck.id !== deckId);
  
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(savedDecks.value));
  } catch (error) {
    console.error('編成の削除に失敗しました:', error);
  }
}


onMounted(async () => {
  loadSavedDecks();
  loadAutoSaveDeck();
  await preloadDeckImages();
});
</script>

<style scoped>
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal-content {
  background: white;
  border-radius: 8px;
  width: 90%;
  max-width: 500px;
  max-height: 80vh;
  overflow: hidden;
}

.modal-body {
  padding: 20px;
  overflow-y: auto;
  max-height: 80vh;
}

.save-section {
  margin-bottom: 20px;
}

.save-row {
  display: flex;
  gap: 12px;
  align-items: center;
}

.error-message {
  color: #d32f2f;
  font-size: 0.8rem;
  margin-top: 4px;
}

.saved-decks-section {
  margin-bottom: 20px;
}

.no-decks {
  text-align: center;
  color: #666;
  padding: 24px;
  font-style: italic;
}

.deck-item {
  border: 1px solid #e0e0e0;
  border-radius: 6px;
  padding: 12px;
  margin-bottom: 10px;
  cursor: pointer;
  transition: background 0.2s ease;
}

.deck-item:hover {
  background: #f5f5f5;
}

.deck-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.deck-info {
  flex: 1;
  min-width: 0;
}

.deck-name {
  font-weight: 500;
  font-size: 0.95rem;
  margin-bottom: 4px;
  word-break: break-all;
}

.character-icons {
  display: flex;
  gap: 3px;
  flex-shrink: 0;
}

.icon-slot {
  width: 32px;
  height: 32px;
  border-radius: 4px;
  overflow: hidden;
  border: 1px solid #e0e0e0;
  display: flex;
  align-items: center;
  justify-content: center;
}

.icon {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.empty-icon {
  width: 100%;
  height: 100%;
  background: #f5f5f5;
  display: flex;
  align-items: center;
  justify-content: center;
}

.close-section {
  border-top: 1px solid #e0e0e0;
  padding-top: 12px;
}

.save-btn {
  min-width: 36px !important;
  height: 36px !important;
  border-radius: 6px !important;
}

.delete-btn {
  min-width: 24px !important;
  height: 24px !important;
  border-radius: 4px !important;
  padding: 0 !important;
}

/* ダークモード対応 */
.v-theme--dark .modal-content {
  background: #2c2c2c;
}

.v-theme--dark .deck-item {
  border-color: #424242;
}

.v-theme--dark .deck-item:hover {
  background: #3a3a3a;
}

.v-theme--dark .close-section {
  border-top-color: #424242;
}

.v-theme--dark .icon-slot {
  border-color: #424242;
}

.v-theme--dark .empty-icon {
  background: #424242;
}
</style>
