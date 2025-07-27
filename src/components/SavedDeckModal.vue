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
          <div v-if="savedDecks.length === 0" class="no-decks">
            保存された編成はありません
          </div>
          <div v-else>
            <div 
              v-for="deck in savedDecks" 
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
                        v-if="char && char.chara && char.imgUrl"
                        :src="char.imgUrl" 
                        :alt="char.name"
                        class="icon"
                      />
                      <div v-else class="empty-icon">
                        <v-icon size="x-small" color="grey">mdi-account-plus</v-icon>
                      </div>
                    </div>
                  </div>
                </div>
                <v-btn 
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
import { ref, onMounted } from 'vue';
import { useSimulatorStore } from '@/store/simulatorStore';

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

const STORAGE_KEY = 'twst_saved_decks';

function closeModal() {
  emit('close');
}

function loadSavedDecks() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      savedDecks.value = JSON.parse(saved);
    }
  } catch (error) {
    console.error('保存された編成の読み込みに失敗しました:', error);
  }
}

function saveDeck() {
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

    const newDeck: SavedDeck = {
      id: Date.now().toString(),
      name: deckName,
      deckCharacters: JSON.parse(JSON.stringify(simulatorStore.deckCharacters)),
      selectedAttribute: simulatorStore.selectedAttribute,
      savedAt: new Date().toISOString()
    };

    savedDecks.value.unshift(newDeck);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(savedDecks.value));
    newDeckName.value = '';
    saveError.value = '';
    
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

function restoreDeck(deckId: string) {
  const deck = savedDecks.value.find(d => d.id === deckId);
  if (!deck || !deck.deckCharacters) return;

  // 編成データを復元
  deck.deckCharacters.forEach((char, index) => {
    if (char && simulatorStore.deckCharacters[index]) {
      Object.assign(simulatorStore.deckCharacters[index], char);
    }
  });
  
  if (deck.selectedAttribute) {
    simulatorStore.selectedAttribute = deck.selectedAttribute;
  }
  
  simulatorStore.recalculateStats();
  closeModal();
}

function deleteDeck(deckId: string) {
  savedDecks.value = savedDecks.value.filter(deck => deck.id !== deckId);
  
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(savedDecks.value));
  } catch (error) {
    console.error('編成の削除に失敗しました:', error);
  }
}


onMounted(() => {
  loadSavedDecks();
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