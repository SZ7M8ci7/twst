<template>
  <div class="toolbar-items">
    <v-app-bar-nav-icon @click.stop="drawer = !drawer"></v-app-bar-nav-icon>
    <div class="language-links">
      <a href="#" :class="{ 'text-muted': $i18n.locale !== 'ja' }" @click="changeLanguage('ja')">JA</a>
      <span>/</span>
      <a href="#" :class="{ 'text-muted': $i18n.locale !== 'en' }" @click="changeLanguage('en')">EN</a>
    </div>
  </div>
  <v-navigation-drawer
    v-model="drawer"
    absolute
    bottom
    temporary
    class="app-navigation-drawer"
    width="320"
  >
    <v-list
      nav
      dense
      class="drawer-list"
    >
      <RouterLink :to="{ name: 'top' }">
        <v-list-item
          class="drawer-root-item drawer-root-top"
          title="TOP"
          @click="closeDrawer"
        >
          <template #prepend>
            <span class="drawer-root-icon">
              <v-icon
                icon="mdi-home-variant-outline"
                size="18"
              />
            </span>
          </template>
        </v-list-item>
      </RouterLink>
      <RouterLink :to="{ name: 'handCollection' }">
        <v-list-item
          class="drawer-root-item drawer-root-hand"
          :title="$t('tool.handCollection')"
          @click="closeDrawer"
        >
          <template #prepend>
            <span class="drawer-root-icon">
              <v-icon
                icon="mdi-cards-outline"
                size="18"
              />
            </span>
          </template>
        </v-list-item>
      </RouterLink>

      <div class="drawer-section-divider" />

      <v-list-group
        v-for="group in navGroups"
        :key="group.titleKey"
        class="drawer-group"
        :value="group.titleKey"
      >
        <template #activator="{ props }">
          <v-list-item
            v-bind="props"
            class="drawer-group-title"
            :style="navStyle(group)"
            :title="$t(group.titleKey)"
          >
            <template #prepend>
              <span class="drawer-group-icon">
                <v-icon
                  :icon="group.icon"
                  size="18"
                />
              </span>
            </template>
          </v-list-item>
        </template>

        <RouterLink
          v-for="item in group.items"
          :key="item.routeName"
          :to="{ name: item.routeName }"
        >
          <v-list-item
            class="drawer-child-item"
            :style="navStyle(group)"
            @click="closeDrawer"
          >
            <span class="drawer-child-title">{{ $t(item.titleKey) }}</span>
          </v-list-item>
        </RouterLink>
      </v-list-group>
    </v-list>
  </v-navigation-drawer>
</template>

<script setup lang="ts">
import { ref } from "vue";
import { useI18n } from 'vue-i18n';
const drawer = ref(false);

const { locale } = useI18n();

type NavItem = {
  routeName: string;
  titleKey: string;
};

type NavGroup = {
  titleKey: string;
  icon: string;
  color: string;
  background: string;
  items: NavItem[];
};

const navGroups: NavGroup[] = [
  {
    titleKey: 'nav.exam',
    icon: 'mdi-sword-cross',
    color: '#c62828',
    background: 'rgba(198, 40, 40, 0.10)',
    items: [
      { routeName: 'calcBASIC', titleKey: 'tool.basicExamScoreCalculator' },
      { routeName: 'calcATK', titleKey: 'tool.attackExamScoreCalculator' },
      { routeName: 'calcDEF', titleKey: 'tool.defencexamScoreCalculator' },
      { routeName: 'examSimulator', titleKey: 'tool.examSimulator' },
      { routeName: 'sim', titleKey: 'tool.sim' },
      { routeName: 'search', titleKey: 'tool.deckExplorationTools' },
      { routeName: 'relation', titleKey: 'tool.mutualDuo' },
      { routeName: 'buddyDuo', titleKey: 'tool.buddyDuo' },
      { routeName: 'finisherDamage', titleKey: 'tool.finisherDamage' },
      { routeName: 'retire', titleKey: 'tool.retire' },
      { routeName: 'hand', titleKey: 'tool.handGacha' },
    ],
  },
  {
    titleKey: 'nav.room',
    icon: 'mdi-sofa-outline',
    color: '#7b1fa2',
    background: 'rgba(123, 31, 162, 0.10)',
    items: [
      { routeName: 'comfort', titleKey: 'tool.comfortLevelConsiderationTool' },
      { routeName: 'invite', titleKey: 'tool.invitationRoomConsiderationTool' },
    ],
  },
  {
    titleKey: 'nav.training',
    icon: 'mdi-sprout-outline',
    color: '#2e7d32',
    background: 'rgba(46, 125, 50, 0.10)',
    items: [
      { routeName: 'drop', titleKey: 'tool.alchemyDropCountCalculator' },
      { routeName: 'sam', titleKey: 'tool.sam' },
      { routeName: 'grow', titleKey: 'tool.requiredUpgradeItemCalculator' },
    ],
  },
  {
    titleKey: 'nav.other',
    icon: 'mdi-dots-horizontal-circle-outline',
    color: '#1565c0',
    background: 'rgba(21, 101, 192, 0.10)',
    items: [
      { routeName: 'data', titleKey: 'tool.data' },
      { routeName: 'statusPlot', titleKey: 'tool.statusPlot' },
      { routeName: 'other', titleKey: 'tool.other' },
    ],
  },
];

function changeLanguage(lang: string) {
  locale.value = lang;
}

function closeDrawer() {
  drawer.value = false;
}

function navStyle(group: NavGroup) {
  return {
    '--nav-accent': group.color,
    '--nav-accent-bg': group.background,
  };
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

.app-navigation-drawer {
  border-right: 1px solid rgba(17, 24, 39, 0.08);
  max-width: calc(100vw - 16px);
}

.drawer-list {
  padding: 10px 8px;
}

.drawer-root-item,
.drawer-group-title {
  font-weight: 600;
  margin: 2px 0;
  border-radius: 10px;
  letter-spacing: 0;
}

.drawer-root-icon,
.drawer-group-icon {
  width: 28px;
  height: 28px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 8px;
  margin-inline-end: 2px;
}

.drawer-root-top .drawer-root-icon {
  color: #5d4037;
  background: rgba(93, 64, 55, 0.12);
}

.drawer-root-hand .drawer-root-icon {
  color: #00695c;
  background: rgba(0, 105, 92, 0.12);
}

.drawer-group-title {
  color: var(--nav-accent);
}

.drawer-group-icon {
  color: var(--nav-accent);
  background: var(--nav-accent-bg);
}

.drawer-child-item {
  min-height: 34px;
  margin: 1px 0;
  padding-inline-start: 8px !important;
  padding-block: 6px !important;
  border-left: 2px solid var(--nav-accent-bg);
  border-radius: 8px;
  transition: background-color 120ms ease, border-color 120ms ease, color 120ms ease;
}

.drawer-group :deep(.v-list-group__items) {
  --indent-padding: 0px !important;
}

.drawer-group :deep(.v-list-group__items .v-list-item.drawer-child-item) {
  padding-inline-start: 8px !important;
}

.drawer-child-item :deep(.v-list-item__content) {
  overflow: visible;
}

.drawer-child-title {
  display: block;
  width: 100%;
  color: rgba(17, 24, 39, 0.88);
  font-size: 0.9rem;
  line-height: 1.35;
  letter-spacing: 0;
  overflow: hidden;
  text-overflow: clip;
  white-space: nowrap;
}

.drawer-section-divider {
  height: 1px;
  margin: 8px 6px;
  background: linear-gradient(90deg, transparent, rgba(17, 24, 39, 0.14), transparent);
}

a.router-link-active .drawer-child-item,
.drawer-child-item:hover {
  background: var(--nav-accent-bg);
  border-color: var(--nav-accent);
}

a.router-link-active .drawer-root-top {
  background: rgba(93, 64, 55, 0.10);
}

a.router-link-active .drawer-root-hand {
  background: rgba(0, 105, 92, 0.10);
}

.toolbar-items {
  display: flex;
  align-items: center;
}

</style>
