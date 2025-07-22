<template>
  <v-container>
    <SimHeader v-model="selectedAttribute" @update:filter="selectedAttribute = $event" />
    
    <v-row>
      <!-- メインコンテンツエリア -->
      <v-col cols="12" md="8" class="main-content">
        <div class="simulator-area">
        <!-- チャートセクション -->
        <div class="chart-section">
          <SimChart :filter-attribute="selectedAttribute" />
        </div>
        
        <!-- 統計情報セクション -->
        <div class="stats-section">
          <SimStats :selected-attribute="selectedAttribute" />
        </div>
        
        <!-- キャラクターセクション -->
        <div class="character-section">
          <SimChara v-for="index in [0,1,2,3,4]" :key="index" :chara-index="index" :selected-attribute="selectedAttribute" />
        </div>
        </div>
      </v-col>
      
      <!-- サイドバー（タブレット・PC表示） -->
      <v-col cols="4" class="sidebar d-none d-md-block">
        <div class="calc-tools-area">
        <div class="calc-container">
          <div class="calc-header">
            <v-btn
              icon
              size="small"
              variant="text"
              @click="prevCalc"
              class="calc-nav-btn"
            >
              <v-icon size="small">mdi-chevron-left</v-icon>
            </v-btn>
            <h3 class="calc-title">{{ calcTitles[carouselModel] }}</h3>
            <v-btn
              icon
              size="small"
              variant="text"
              @click="nextCalc"
              class="calc-nav-btn"
            >
              <v-icon size="small">mdi-chevron-right</v-icon>
            </v-btn>
          </div>
          <div class="calc-wrapper">
            <BuddyInfo v-if="carouselModel === 0" />
            <CharacterEtc v-else-if="carouselModel === 1" />
            <CalcBASIC v-else-if="carouselModel === 2" :selected-attribute="selectedAttribute" />
            <CalcDEF v-else-if="carouselModel === 3" :selected-attribute="selectedAttribute" />
            <CalcATK v-else-if="carouselModel === 4" :selected-attribute="selectedAttribute" />
          </div>
        </div>
        </div>
      </v-col>
    </v-row>
    
    <!-- カルーセル（スマホ表示） -->
    <div class="carousel-container d-md-none">
      <div class="calc-tools-area">
      <div class="calc-container">
        <div class="calc-header">
          <v-btn
            icon
            size="small"
            variant="text"
            @click="prevCalc"
            class="calc-nav-btn"
          >
            <v-icon size="small">mdi-chevron-left</v-icon>
          </v-btn>
          <h3 class="calc-title">{{ calcTitles[carouselModel] }}</h3>
          <v-btn
            icon
            size="small"
            variant="text"
            @click="nextCalc"
            class="calc-nav-btn"
          >
            <v-icon size="small">mdi-chevron-right</v-icon>
          </v-btn>
        </div>
        <div class="carousel-content">
          <BuddyInfo v-if="carouselModel === 0" />
          <CharacterEtc v-else-if="carouselModel === 1" />
          <CalcBASIC v-else-if="carouselModel === 2" :selected-attribute="selectedAttribute" />
          <CalcDEF v-else-if="carouselModel === 3" :selected-attribute="selectedAttribute" />
          <CalcATK v-else-if="carouselModel === 4" :selected-attribute="selectedAttribute" />
        </div>
      </div>
      </div>
    </div>
  </v-container>
</template>

<script setup lang="ts">
import { ref, onMounted, nextTick } from 'vue';
import SimChara from '@/components/SimChara.vue';
import SimChart from '@/components/SimChart.vue';
import SimHeader from '@/components/SimHeader.vue';
import SimStats from '@/components/SimStats.vue';
import CalcBASIC from '@/views/calcBASIC.vue';
import CalcDEF from '@/views/calcDEF.vue';
import CalcATK from '@/views/calcATK.vue';
import BuddyInfo from '@/components/BuddyInfo.vue';
import CharacterEtc from '@/components/CharacterEtc.vue';
import { useSimulatorStore } from '@/store/simulatorStore';

const isLargeScreen = ref(window.innerWidth >= 768);
const selectedAttribute = ref('対全');
const carouselModel = ref(0);
const simulatorStore = useSimulatorStore();

const calcTitles = [
  'バディ情報',
  '付与効果',
  'ベーシック試験スコア計算',
  'ディフェンス試験スコア計算', 
  'アタック試験スコア計算'
];

function nextCalc() {
  carouselModel.value = (carouselModel.value + 1) % 5;
}

function prevCalc() {
  carouselModel.value = carouselModel.value === 0 ? 4 : carouselModel.value - 1;
}

// ウィンドウサイズが変更されるたびに実行される関数
function handleResize() {
    isLargeScreen.value = window.innerWidth >= 768;
}

// 状態を復元する関数
async function restoreState() {
  const urlParams = new URLSearchParams(window.location.search);
  
  // 既存の状態復元
  if (urlParams.get('restoreState') === 'true') {
    const savedState = localStorage.getItem('twstSimulatorState');
    if (savedState) {
      try {
        const state = JSON.parse(savedState);
        
        // デッキキャラクターを復元
        if (state.deckCharacters) {
          state.deckCharacters.forEach((char: any, index: number) => {
            if (char.chara) {
              Object.assign(simulatorStore.deckCharacters[index], char);
            }
          });
          // 全体を再計算
          simulatorStore.recalculateStats();
        }
        
        // 選択された属性を復元
        if (state.selectedAttribute) {
          selectedAttribute.value = state.selectedAttribute;
        }
        
      } catch (error) {
        // Error handling
      }
    }
  }
  // デッキ探索結果からの復元
  else if (urlParams.get('restoreFromSearch') === 'true') {
    await restoreFromSearchParams(urlParams);
  }
}

// デッキ探索結果からキャラクターを復元する関数
async function restoreFromSearchParams(urlParams: URLSearchParams) {
  const { useCharacterStore } = await import('@/store/characters');
  const characterStore = useCharacterStore();
  const { processCharacterSelection } = await import('@/utils/characterSelection');
  
  try {
    // 5つのキャラクター情報を復元
    for (let i = 1; i <= 5; i++) {
      const characterName = urlParams.get(`name${i}`);
      const characterLevel = parseInt(urlParams.get(`level${i}`) || '0');
      
      if (characterName && characterLevel > 0) {
        const foundCharacter = characterStore.characters.find((char: any) => char.name === characterName);
        
        if (foundCharacter) {
          // 共通関数を使用してキャラクター選択処理を実行（手持ち設定を無視してカスタムレベル使用）
          const processedChara = await processCharacterSelection({ ...foundCharacter }, characterLevel, true);
          
          // デュオキャラクターの効果を設定
          if (processedChara.duo && simulatorStore.charaDict[processedChara.duo]) {
            processedChara.magic2Power = 'デュオ';
          }
          
          // キャラクター選択（手持ち設定を無視）
          simulatorStore.selectCharacter(i - 1, processedChara, true);
        }
      }
    }
    
    // 全体を再計算
    await nextTick();
    simulatorStore.recalculateStats();
    
  } catch (error) {
    console.error('デッキ探索結果からの復元に失敗しました:', error);
  }
}

onMounted(async () => {
    // コンポーネントがマウントされた後、リサイズイベントリスナーを追加
    window.addEventListener('resize', handleResize);
    
    // 状態復元のチェック
    await restoreState();
});
</script>

<style scoped>
.simulator-container {
  padding: 20px;
}

.character-section {
  margin-bottom: 20px;
}

.chart-section {
  margin-top: 20px;
}

.filter-section {
  margin-bottom: 10px;
}

.filter-section select {
  margin-left: 10px;
  padding: 5px;
  border-radius: 5px;
  border: 1px solid #ccc;
}

.main-content {
  padding-right: 8px;
}

.sidebar {
  padding-left: 8px;
  position: sticky;
  top: 20px;
  height: fit-content;
}

.chart-section {
  margin: 5px 0 0 0;
}

.stats-section {
  margin: 0;
  padding: 5px 0;
}

.character-section {
  margin: 5px 0 0 0;
}

.carousel-container {
  margin-top: 16px;
}

.carousel-content {
  padding: 16px;
}

.calc-container {
  width: 100%;
}

.calc-header {
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 12px;
  gap: 8px;
}

.calc-title {
  text-align: center;
  margin: 0;
  font-size: 1.1rem;
  font-weight: 500;
  flex: 1;
}

.calc-nav-btn {
  opacity: 0.6;
  transition: opacity 0.2s ease;
}

.calc-nav-btn:hover {
  opacity: 1;
}

.calc-wrapper {
  padding: 8px;
}

/* エリア別浮かせた表現 */
.simulator-area {
  border-radius: 8px;
  padding: 12px;
  margin-bottom: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  transition: box-shadow 0.2s ease;
}

.calc-tools-area {
  border-radius: 8px;
  padding: 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  transition: box-shadow 0.2s ease;
}

/* ダークモード対応 */
.v-theme--dark .simulator-area {
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
}

.v-theme--dark .calc-tools-area {
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
}
</style>
