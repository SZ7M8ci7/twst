<template>
  <div class="toolbar-items">
  <v-app-bar-nav-icon @click.stop="drawer = !drawer"></v-app-bar-nav-icon>
  <div class="language-links">
    <a href="#" :class="{'text-muted': $i18n.locale !== 'ja'}" @click="changeLanguage('ja')">JA</a>
    <span>/</span>
    <a href="#" :class="{'text-muted': $i18n.locale !== 'en'}" @click="changeLanguage('en')">EN</a>
  </div>
  </div>
  <v-navigation-drawer v-model="drawer" absolute bottom temporary>
    <v-list nav dense>
      <RouterLink :to="{name:'top'}">
      <v-list-item
        title="TOP"
        @click="drawer = false;"
      /></RouterLink>
      <RouterLink :to="{name:'drop'}">
      <v-list-item
        :title="$t('tool.alchemyDropCountCalculator')"
        @click="drawer = false;"
      /></RouterLink>
      <RouterLink :to="{name:'grow'}">
      <v-list-item
        :title="$t('tool.requiredUpgradeItemCalculator')"
        @click="drawer = false;"
      /></RouterLink>
      <RouterLink :to="{name:'calcBASIC'}">
      <v-list-item
        :title="$t('tool.basicExamScoreCalculator')"
        @click="drawer = false;"
      /></RouterLink>
      <RouterLink :to="{name:'calcATK'}">
      <v-list-item
        :title="$t('tool.attackExamScoreCalculator')"
        @click="drawer = false;"
      /></RouterLink>
      <RouterLink :to="{name:'calcDEF'}">
      <v-list-item
        :title="$t('tool.defencexamScoreCalculator')"
        @click="drawer = false;"
      /></RouterLink>
      <RouterLink :to="{name:'comfort'}">
      <v-list-item
        :title="$t('tool.comfortLevelConsiderationTool')"
        @click="drawer = false;"
      /></RouterLink>
      <RouterLink :to="{name:'invite'}">
      <v-list-item
        :title="$t('tool.invitationRoomConsiderationTool')"
        @click="drawer = false;"
        /></RouterLink>
      <RouterLink :to="{name:'simulator'}">
      <v-list-item
        :title="$t('tool.deckSimulator')"
        @click="drawer = false;"
      /></RouterLink>
      <RouterLink :to="{name:'search'}">
      <v-list-item
        :title="$t('tool.deckExplorationTools')"
        @click="drawer = false;"
      /></RouterLink>
      <RouterLink :to="{name:'relation'}">
      <v-list-item
        :title="$t('tool.mutualDuo')"
        @click="drawer = false;"
      /></RouterLink>
      <RouterLink :to="{name:'hand'}">
      <v-list-item
        :title="$t('tool.handGacha')"
        @click="drawer = false;"
      /></RouterLink>
      <RouterLink :to="{name:'data'}">
      <v-list-item
        :title="$t('tool.data')"
        @click="drawer = false;"
      /></RouterLink>
      <RouterLink :to="{name:'other'}">
      <v-list-item
        :title="$t('tool.other')"
        @click="drawer = false;"
      /></RouterLink>
    </v-list>
  </v-navigation-drawer>
</template>

<script setup lang="ts">
import { ref } from "vue";
import { useI18n } from 'vue-i18n';
const drawer = ref(false);

const { locale } = useI18n();

function changeLanguage(lang: string) {
  locale.value = lang;
}
</script>
<style scoped>
a {
  text-decoration: none;
  color: inherit;
}

.language-links {
  margin-left: 16px;
  display: flex;
  align-items: center;
}

.language-links a {
  margin: 0 4px;
}

.language-links .text-muted {
  color: #888;
}


.toolbar-items {
  display: flex;
  align-items: center;
}

</style>