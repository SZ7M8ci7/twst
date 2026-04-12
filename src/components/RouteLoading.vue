<template>
  <div class="route-loading">
    <v-progress-circular indeterminate color="primary" size="56" width="5" />
    <p class="route-loading-text">Loading...</p>
  </div>
</template>

<style scoped>
.route-loading {
  width: 100%;
  min-height: 50vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
}

.route-loading-text {
  margin: 0;
  color: rgba(0, 0, 0, 0.7);
  font-size: 0.95rem;
}
</style>
