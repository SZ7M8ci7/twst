<template>
  <v-container class="top-container">
    <p class="d-flex justify-center">{{ $t('top.twistedTool') }}<a href="https://twitter.com/____akita" target="_blank" rel="noopener noreferrer">{{ $t('top.createdBy') }}</a></p>
    <p class="d-flex justify-center">{{ $t('top.useFromTopLeft') }}</p>
    <p class="d-flex justify-center" style="white-space: pre;">{{ $t('top.opinion') }}<a href="https://wavebox.me/wave/33o1qew69rzi93db/" target="_blank" rel="noopener noreferrer">Wavebox</a>{{ $t('top.please') }}</p>
    <p class="d-flex justify-center">{{ $t('top.forForeginer') }}</p>

    <section class="recommended-section">
      <h2 class="recommended-title">{{ $t('top.recommended') }}</h2>
      <div class="recommended-grid">
        <RouterLink
          v-for="item in recommendedTools"
          :key="item.routeName"
          class="recommended-link"
          :to="{ name: item.routeName }"
        >
          <v-card class="recommended-card">
            <v-icon
              class="recommended-icon"
              :icon="item.icon"
              size="26"
            />
            <span class="recommended-label">{{ $t(item.titleKey) }}</span>
          </v-card>
        </RouterLink>
      </div>
    </section>
  </v-container>
</template>

<script setup lang="ts">
type RecommendedTool = {
  routeName: string;
  titleKey: string;
  icon: string;
};

const recommendedTools: RecommendedTool[] = [
  { routeName: 'handCollection', titleKey: 'tool.handCollection', icon: 'mdi-cards-outline' },
  { routeName: 'sim', titleKey: 'tool.sim', icon: 'mdi-cards-playing-outline' },
  { routeName: 'search', titleKey: 'tool.deckExplorationTools', icon: 'mdi-magnify' },
  { routeName: 'finisherDamage', titleKey: 'tool.finisherDamage', icon: 'mdi-target' },
];
</script>
<style scoped>
a {
  color: inherit;
}

.top-container {
  max-width: 960px;
}

.recommended-section {
  margin-top: 28px;
}

.recommended-title {
  margin-bottom: 12px;
  color: #263238;
  font-size: 1.1rem;
  font-weight: 700;
  letter-spacing: 0;
}

.recommended-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 10px;
}

.recommended-link {
  text-decoration: none;
}

.recommended-card {
  min-height: 84px;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 14px;
  border: 1px solid rgba(21, 101, 192, 0.18);
  border-radius: 8px;
  box-shadow: none;
  transition: border-color 120ms ease, background-color 120ms ease;
}

.recommended-card:hover {
  background: rgba(21, 101, 192, 0.06);
  border-color: rgba(21, 101, 192, 0.38);
}

.recommended-icon {
  flex: 0 0 auto;
  color: #1565c0;
}

.recommended-label {
  color: #1f2937;
  font-size: 0.95rem;
  font-weight: 700;
  line-height: 1.35;
  letter-spacing: 0;
}

@media (max-width: 800px) {
  .recommended-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 480px) {
  .recommended-grid {
    grid-template-columns: 1fr;
  }
}
</style>
