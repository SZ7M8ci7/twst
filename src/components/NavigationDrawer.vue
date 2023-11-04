<template>
  <v-app-bar-nav-icon @click.stop="drawer = !drawer"></v-app-bar-nav-icon>
  <v-navigation-drawer v-model="drawer" absolute bottom temporary>
    <v-list nav dense>
      <RouterLink :to="{name:'top'}">
      <v-list-item
        title="TOP"
        @click="drawer = false;"
      /></RouterLink>
      <RouterLink :to="{name:'drop'}">
      <v-list-item
        title="錬金術ドロップ数計算"
        @click="drawer = false;"
      /></RouterLink>
      <RouterLink :to="{name:'grow'}">
      <v-list-item
        title="必要育成アイテム数計算"
        @click="drawer = false;"
      /></RouterLink>
      <RouterLink :to="{name:'comfort'}">
      <v-list-item
        title="いごこち度検討ツール"
        @click="drawer = false;"
      /></RouterLink>
      <RouterLink :to="{name:'invite'}">
      <v-list-item
        title="招待部屋検討ツール"
        @click="drawer = false;"
        /></RouterLink>
      <RouterLink :to="{name:'simulator'}">
      <v-list-item
        title="デッキシミュレータ"
        @click="drawer = false;"
      /></RouterLink>
      <RouterLink :to="{name:'other'}">
      <v-list-item
        title="その他"
        @click="drawer = false;"
      /></RouterLink>
    </v-list>
  </v-navigation-drawer>
</template>

<script setup lang="ts">
import { ref } from "vue";
const drawer = ref(false);

</script>
<style scoped>
a {
  text-decoration: none;
  color: inherit;
}
</style>