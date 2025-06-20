<template>
  <v-container>
    <SimHeader v-model="selectedAttribute" @update:filter="selectedAttribute = $event" />
    
    <v-row>
      <!-- メインコンテンツエリア -->
      <v-col cols="12" md="8" class="main-content">
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
          <SimChara v-for="index in [0,1,2,3,4]" :key="index" :chara-index="index" />
        </div>
      </v-col>
      
      <!-- サイドバー（タブレット・PC表示） -->
      <v-col cols="4" class="sidebar d-none d-md-block">
        <div class="calc-basic-wrapper">
          <CalcBASIC />
        </div>
      </v-col>
    </v-row>
    
    <!-- カルーセル（スマホ表示） -->
    <div class="carousel-container d-md-none">
      <v-carousel
        v-model="carouselModel"
        height="auto"
        hide-delimiter-background
        show-arrows="hover"
        cycle
        :interval="0"
      >
        <v-carousel-item>
          <div class="carousel-content">
            <CalcBASIC />
          </div>
        </v-carousel-item>
      </v-carousel>
    </div>
  </v-container>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import SimChara from '@/components/SimChara.vue';
import SimChart from '@/components/SimChart.vue';
import SimHeader from '@/components/SimHeader.vue';
import SimStats from '@/components/SimStats.vue';
import CalcBASIC from '@/views/calcBASIC.vue';
import { useSimulatorStore } from '@/store/simulatorStore';

const isLargeScreen = ref(window.innerWidth >= 768);
const selectedAttribute = ref('対全');
const carouselModel = ref(0);
const simulatorStore = useSimulatorStore();

// ウィンドウサイズが変更されるたびに実行される関数
function handleResize() {
    isLargeScreen.value = window.innerWidth >= 768;
}

// 状態を復元する関数
function restoreState() {
  const urlParams = new URLSearchParams(window.location.search);
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
          simulatorStore.calculateAllStats();
        }
        
        // 選択された属性を復元
        if (state.selectedAttribute) {
          selectedAttribute.value = state.selectedAttribute;
        }
        
      } catch (error) {
      }
    }
  }
}

onMounted(() => {
    // コンポーネントがマウントされた後、リサイズイベントリスナーを追加
    window.addEventListener('resize', handleResize);
    
    // 状態復元のチェック
    restoreState();
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
</style>
