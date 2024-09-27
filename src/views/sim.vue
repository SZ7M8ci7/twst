<template>
  <v-container>
    <SimChart />
    <SimHeader />
    <SimChara v-for="index in [0,1,2,3,4]" :key="index" :chara-index="index" />
  </v-container>
</template>

<script setup lang="ts">
import SimChart from '@/components/SimChart.vue';
import SimHeader from '@/components/SimHeader.vue';
import SimChara from '@/components/SimChara.vue';
import { ref, onMounted } from 'vue';

const isLargeScreen = ref(window.innerWidth >= 768);

// ウィンドウサイズが変更されるたびに実行される関数
function handleResize() {
    isLargeScreen.value = window.innerWidth >= 768;
}

onMounted(() => {
    // コンポーネントがマウントされた後、リサイズイベントリスナーを追加
    window.addEventListener('resize', handleResize);
});

</script>
