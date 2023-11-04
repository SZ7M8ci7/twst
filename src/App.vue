<template>
  <v-app>
    <v-main>
      <NavigationDrawer />
      <router-view/>
    </v-main>
  </v-app>
</template>

<script setup lang="ts">

import NavigationDrawer from '@/components/NavigationDrawer.vue'

</script>
