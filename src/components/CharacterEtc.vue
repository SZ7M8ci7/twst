<template>
  <div class="etc-info-container">
    <!-- その他情報 -->
    <div class="etc-list">
      <div 
        v-for="(character, charIndex) in deckCharactersWithEtc" 
        :key="charIndex"
        class="character-block"
      >
        <!-- キャラクター画像 -->
        <img 
          :src="getCardImage(character)" 
          :alt="character.chara"
          class="character-image"
          @error="handleImageError"
        />

        <!-- 効果リスト -->
        <div class="effects-list">
          <div 
            v-for="(effect, effectIndex) in character.etcEffects" 
            :key="effectIndex"
            class="effect-item"
          >
            {{ effect }}
          </div>
          <div v-if="character.etcEffects.length === 0" class="no-effects">
            効果なし
          </div>
        </div>
      </div>
    </div>

    <div v-if="deckCharactersWithEtc.length === 0" class="no-characters">
      <v-icon size="48" color="grey">mdi-account-search</v-icon>
      <div>{{ t('noCharacters') }}</div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { useSimulatorStore } from '@/store/simulatorStore';
import defaultImg from '@/assets/img/default.png';
import charaData from '@/assets/chara.json';

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

const detectLanguage = (): keyof typeof translations => {
  const browserLang = navigator.language || 'ja';
  return browserLang.startsWith('en') ? 'en' : 'ja';
};

const currentLang = ref(detectLanguage());
const t = (key: keyof typeof translations['ja']): string => translations[currentLang.value][key] || key;

// デッキ内のキャラクターとそのetc情報
const deckCharactersWithEtc = computed(() => {
  return simulatorStore.deckCharacters
    .map((char) => {
      if (!char.chara || char.chara === '') {
        return null;
      }
      
      // chara.jsonからetc情報を取得
      const charaInfo = charaData.find((c: any) => c.name === char.name);
      const etcText = charaInfo?.etc || '';
      
      // HTMLのbrタグで分割して効果のリストを作成
      const etcEffects = etcText
        .split('<br>')
        .map((effect: string) => effect.trim())
        .filter((effect: string) => effect.length > 0);
      
      return {
        ...char,
        etcEffects
      };
    })
    .filter(char => char !== null);
});

// カード画像取得
const getCardImage = (character: any) => {
  if (!character || !character.imgUrl) {
    return defaultImg;
  }
  return character.imgUrl;
};

// 画像エラーハンドリング
const handleImageError = (event: Event) => {
  const target = event.target as HTMLImageElement;
  target.src = defaultImg;
};

</script>

<style scoped>
.etc-info-container {
  max-height: 450px;
  overflow-y: auto;
  padding: 8px;
}

/* その他情報リスト */
.etc-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

/* キャラクターブロック */
.character-block {
  display: flex;
  gap: 12px;
  border-radius: 8px;
  padding: 12px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  transition: box-shadow 0.2s ease;
}

.character-block:hover {
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.15);
}

.character-image {
  width: 40px;
  height: 40px;
  border-radius: 4px;
  object-fit: cover;
  border: none;
  flex-shrink: 0;
}


/* 効果リスト */
.effects-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
  flex: 1;
}

.effect-item {
  font-size: 0.75rem;
  color: #000000;
  padding: 4px 8px;
  background: rgba(0, 0, 0, 0.05);
  border-radius: 4px;
  line-height: 1.4;
}

.no-effects {
  font-size: 0.75rem;
  color: rgba(0, 0, 0, 0.5);
  font-style: italic;
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
.v-theme--dark .character-block {
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
}

.v-theme--dark .character-block:hover {
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.4);
}


.v-theme--dark .effect-item {
  color: #ffffff;
  background: rgba(255, 255, 255, 0.05);
}

.v-theme--dark .no-effects {
  color: rgba(255, 255, 255, 0.5);
}

.v-theme--dark .no-characters {
  color: rgba(255, 255, 255, 0.6);
}

/* モバイル対応 */
@media (max-width: 600px) {
  .etc-info-container {
    padding: 6px;
  }
  
  .etc-list {
    gap: 8px;
  }
  
  .character-block {
    padding: 8px;
  }
  
  
  .character-image {
    width: 32px;
    height: 32px;
  }
  
  
  .effects-list {
    gap: 2px;
  }
  
  .effect-item {
    font-size: 0.65rem;
    padding: 2px 6px;
  }
}
</style>