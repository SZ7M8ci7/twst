<template>
  <iframe :src=url></iframe>
</template>

<script setup lang="ts">
import { useRoute } from 'vue-router';
import {ref} from 'vue';
import { onUpdated } from 'vue';
const route = useRoute();
const url = ref("");
function select_path(){
  if (route.path == "/twst/comfort") {
    url.value = "https://sz7m8ci7.github.io/roomcalc/";
  } else if (route.path == "/twst/invite") {
    url.value = "https://sz7m8ci7.github.io/roomcalc/invite.html";
  } else if (route.path == "/twst/simulator") {
    url.value = "https://sz7m8ci7.github.io/simulator/";
  }
}
select_path();
onUpdated(() => {
  select_path();
})
</script>

<style>
iframe {
  width: 100%;
  height: 95%;
}
</style>