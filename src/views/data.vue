<template>
  <v-container>
    <div>
      <DataHeader />
    </div>
    <div class="data-body">
      <DataBody />
    </div>
  </v-container>
</template>

<script setup lang="ts">
import DataHeader from '@/components/DataHeader.vue';
import DataBody from '@/components/DataBody.vue';
</script>

<style scoped>
.v-container {
  height: 90vh; /* Make the container fill the viewport height */
  display: flex;
  flex-direction: column; /* Stack children vertically */
}

.data-body {
  height: 90vh;
}
</style>