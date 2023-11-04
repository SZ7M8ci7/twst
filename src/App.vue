<template>
  <meta name="viewport" content="width=device-width">
  <v-app>
    <v-main>
      <NavigationDrawer />
      <router-view></router-view>
    </v-main>
  </v-app>
</template>

<script setup lang="ts">

import NavigationDrawer from '@/components/NavigationDrawer.vue'

</script>
