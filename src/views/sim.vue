<template>
  <v-container>
    <SimHeader @update:filter="selectedAttribute = $event" />
    <v-row>
      <v-col cols="12">
        <SimChart :filter-attribute="selectedAttribute" />
      </v-col>
    </v-row>
    <v-row>
      <v-col cols="12">
        <SimChara v-for="index in [0,1,2,3,4]" :key="index" :chara-index="index" />
      </v-col>
    </v-row>
  </v-container>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import SimChara from '@/components/SimChara.vue';
import SimChart from '@/components/SimChart.vue';
import SimHeader from '@/components/SimHeader.vue';

const isLargeScreen = ref(window.innerWidth >= 768);
const selectedAttribute = ref('対全');

// ウィンドウサイズが変更されるたびに実行される関数
function handleResize() {
    isLargeScreen.value = window.innerWidth >= 768;
}

onMounted(() => {
    // コンポーネントがマウントされた後、リサイズイベントリスナーを追加
    window.addEventListener('resize', handleResize);
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
</style>
