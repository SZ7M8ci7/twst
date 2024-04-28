<template>
  <meta name="viewport" content="width=device-width">
  <v-app>
    <v-main>
      <NavigationDrawer />
      <div class="router-view-container">
        <router-view></router-view>
      </div>
    </v-main>
  </v-app>
  </template>
  <script setup lang="ts">
  import NavigationDrawer from '@/components/NavigationDrawer.vue'
  </script>
  <style scoped>
  .router-view-container {
    display: flex;
    justify-content: center;
    height: 100%;
  }
  </style>