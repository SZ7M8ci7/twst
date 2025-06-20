<template>
  <div class="buddy-info-container">
    <!-- バディテーブル -->
    <div class="buddy-table">
      <div 
        v-for="(character, rowIndex) in deckCharactersWithBuddies" 
        :key="rowIndex"
        class="buddy-row"
      >
        <!-- 1列目：選択されたカード -->
        <div class="character-cell main-character">
          <div class="character-card">
            <img 
              :src="getCardImage(character)" 
              :alt="character.chara"
              class="character-image"
              @error="handleImageError"
            />
          </div>
        </div>

        <!-- 2-4列目：バディキャラクター -->
        <div 
          v-for="(buddyInfo, buddyIndex) in character.buddyList" 
          :key="buddyIndex"
          class="buddy-cell"
          :class="{ 'inactive': !buddyInfo.inDeck }"
        >
          <div class="buddy-card">
            <img 
              :src="getCharacterIcon(buddyInfo.charaCode)" 
              :alt="buddyInfo.charaCode"
              class="buddy-image"
              :class="{ 'inactive': !buddyInfo.inDeck }"
              @error="handleImageError"
            />
            <div class="buddy-effect">{{ buddyInfo.effect }}</div>
          </div>
        </div>

        <!-- 空のセル（バディが3未満の場合） -->
        <div 
          v-for="emptyIndex in (3 - character.buddyList.length)" 
          :key="'empty-' + emptyIndex"
          class="buddy-cell empty"
        >
          <div class="empty-buddy-card">
            <v-icon size="24" color="grey">mdi-account-plus-outline</v-icon>
          </div>
        </div>
      </div>
    </div>

    <div v-if="deckCharactersWithBuddies.length === 0" class="no-characters">
      <v-icon size="48" color="grey">mdi-account-search</v-icon>
      <div>{{ t('noCharacters') }}</div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { useSimulatorStore } from '@/store/simulatorStore';
import defaultImg from '@/assets/img/default.png';
import charactersInfo from '@/assets/characters_info.json';

const simulatorStore = useSimulatorStore();

// 多言語対応
const translations = {
  ja: {
    noCharacters: 'デッキにキャラクターを追加してください'
  },
  en: {
    noCharacters: 'Please add characters to your deck'
  }
} as const;

// ブラウザの言語設定を検出
const detectLanguage = (): keyof typeof translations => {
  const browserLang = navigator.language || 'ja';
  return browserLang.startsWith('en') ? 'en' : 'ja';
};

const currentLang = ref(detectLanguage());
const t = (key: keyof typeof translations['ja']): string => translations[currentLang.value][key] || key;

// characters_info.jsonから日本語名から英語名への変換マップを動的に生成
const jpName2enName = charactersInfo.reduce((map, character) => {
  map[character.name_ja] = character.name_en;
  return map;
}, {} as Record<string, string>);

// デッキ内のキャラクターとそのバディ情報
const deckCharactersWithBuddies = computed(() => {
  return simulatorStore.deckCharacters
    .filter(char => char.chara && char.chara !== '')
    .map(char => {
      const buddyList = [];
      
      // バディ1
      if (char.buddy1c && char.buddy1c !== '') {
        buddyList.push({
          charaCode: char.buddy1c,
          effect: (char.buddy1s || 'ATK UP').replace(/UP/g, '').trim(),
          inDeck: isCharacterInDeck(char.buddy1c)
        });
      }
      
      // バディ2
      if (char.buddy2c && char.buddy2c !== '') {
        buddyList.push({
          charaCode: char.buddy2c,
          effect: (char.buddy2s || 'HP UP').replace(/UP/g, '').trim(),
          inDeck: isCharacterInDeck(char.buddy2c)
        });
      }
      
      // バディ3
      if (char.buddy3c && char.buddy3c !== '') {
        buddyList.push({
          charaCode: char.buddy3c,
          effect: (char.buddy3s || 'SKILL UP').replace(/UP/g, '').trim(),
          inDeck: isCharacterInDeck(char.buddy3c)
        });
      }
      
      return {
        chara: char.chara,
        name: char.name,
        imgUrl: (char as any).imgUrl, // カード画像URLを追加
        buddyList
      };
    })
    .slice(0, 5); // 最大5行
});

// キャラクターがデッキ内に存在するかチェック
function isCharacterInDeck(charaCode: string): boolean {
  return simulatorStore.deckCharacters.some(
    char => char.chara === charaCode && char.chara !== ''
  );
}


// キャラクターアイコンの状態管理
const characterIcons = ref<Record<string, string>>({});

// キャラクターアイコンを読み込む
async function loadCharacterIcon(charaCode: string): Promise<void> {
  if (!charaCode || characterIcons.value[charaCode]) {
    return;
  }
  
  // 日本語名から英語名に変換
  const englishName = jpName2enName[charaCode];
  if (!englishName) {
    console.warn(`English name not found for character: ${charaCode}`);
    characterIcons.value[charaCode] = defaultImg;
    return;
  }
  
  try {
    // 動的インポートを使用してアイコンを読み込む
    const module = await import(`@/assets/img/icon/${englishName}.png`);
    characterIcons.value[charaCode] = module.default;
  } catch (error) {
    console.error(`Error loading icon for ${charaCode} (${englishName}):`, error);
    characterIcons.value[charaCode] = defaultImg;
  }
}

// キャラクターアイコンのパスを取得
function getCharacterIcon(charaCode: string): string {
  if (!charaCode) {
    return defaultImg;
  }
  return characterIcons.value[charaCode] || defaultImg;
}

// カードイメージを取得する関数
function getCardImage(character: any): string {
  // シミュレーターで選択されたキャラクターのimgUrlを使用
  if (character.imgUrl) {
    return character.imgUrl;
  }
  return defaultImg;
}

// 画像エラーハンドリング
function handleImageError(event: Event) {
  const img = event.target as HTMLImageElement;
  img.src = defaultImg;
}

// 初期化時とキャラクター変更時にアイコンを読み込む
watch(deckCharactersWithBuddies, async (newCharacters) => {
  const allCharaCodes = new Set<string>();
  
  // 全てのキャラクターコードを収集
  newCharacters.forEach(char => {
    if (char.chara) allCharaCodes.add(char.chara);
    char.buddyList.forEach(buddy => {
      if (buddy.charaCode) allCharaCodes.add(buddy.charaCode);
    });
  });
  
  // 並列でアイコンを読み込み
  await Promise.all(
    Array.from(allCharaCodes).map(charaCode => loadCharacterIcon(charaCode))
  );
}, { immediate: true, deep: true });
</script>

<style scoped>
.buddy-info-container {
  max-height: 450px;
  overflow-y: auto;
  padding: 8px;
}

/* バディテーブル */
.buddy-table {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.buddy-row {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr 1fr;
  gap: 2px;
  align-items: center;
  border-radius: 8px;
  padding: 4px;
  margin-bottom: 4px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  transition: box-shadow 0.2s ease;
}

.buddy-row:hover {
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.15);
}

/* キャラクターセル（1列目） */
.character-cell {
  padding: 0;
}

.character-card {
  display: flex;
  justify-content: center;
  align-items: center;
  background: transparent;
  border: none;
  border-radius: 0;
  padding: 0;
  box-shadow: none;
  width: 100%;
  height: auto;
  min-height: 44px;
}

.character-image {
  width: 40px;
  height: 40px;
  border-radius: 4px;
  object-fit: cover;
  border: none;
  margin: 0;
  flex-shrink: 0;
  transition: filter 0.3s ease;
}


/* バディセル（2-4列目） */
.buddy-cell {
  padding: 0;
}

.buddy-card {
  position: relative;
  background: transparent;
  border: none;
  border-radius: 0;
  padding: 0;
  text-align: center;
  box-shadow: none;
  width: 100%;
  height: auto;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 60px;
}



.buddy-image {
  width: 36px;
  height: 36px;
  border-radius: 4px;
  object-fit: cover;
  border: none;
  margin: 0;
  flex-shrink: 0;
  transition: filter 0.3s ease;
}

.buddy-image.inactive {
  filter: grayscale(100%) brightness(0.6);
}


.buddy-effect {
  font-size: 0.6rem;
  font-weight: bold;
  color: #000000;
  margin: 0;
  padding: 1px 2px;
  line-height: 1;
  flex-shrink: 0;
}




/* 空のバディセル */
.buddy-cell.empty {
  opacity: 0.3;
}

.empty-buddy-card {
  background: transparent;
  border: none;
  border-radius: 0;
  padding: 0;
  text-align: center;
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 60px;
  width: 100%;
}

/* 空状態表示 */
.no-characters {
  text-align: center;
  color: rgba(0, 0, 0, 0.6);
  padding: 40px 20px;
}

.no-characters div {
  margin-top: 12px;
  font-size: 0.875rem;
}

/* ダークモード対応 */

.v-theme--dark .character-card {
  background: transparent;
  border: none;
}


.v-theme--dark .buddy-card {
  background: transparent;
  border: none;
}


.v-theme--dark .buddy-effect {
  color: #ffffff;
}


.v-theme--dark .empty-buddy-card {
  background: transparent;
  border: none;
}

.v-theme--dark .no-characters {
  color: rgba(255, 255, 255, 0.6);
}

/* ダークモード対応のシャドウ */
.v-theme--dark .buddy-row {
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
}

.v-theme--dark .buddy-row:hover {
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.4);
}

/* モバイル対応 */
@media (max-width: 600px) {
  .buddy-info-container {
    padding: 6px;
  }
  
  .buddy-row {
    gap: 1px;
    padding: 2px;
    margin-bottom: 2px;
  }
  
  .character-card {
    padding: 1px;
  }
  
  .character-image {
    width: 32px;
    height: 32px;
  }
  
  .buddy-card {
    padding: 1px;
  }
  
  .buddy-image {
    width: 28px;
    height: 28px;
  }
  
  .buddy-effect {
    font-size: 0.6rem;
  }
}
</style>