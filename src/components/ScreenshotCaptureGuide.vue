<template>
  <details class="capture-guide" :open="!hasSources" data-testid="screenshot-capture-guide">
    <summary>{{ t('screenshot.guideTitle') }}</summary>
    <p class="guide-intro">{{ t('screenshot.guideIntro') }}</p>
    <div class="guide-examples">
      <section class="guide-example">
        <h3>{{ t('screenshot.guideLevelTitle') }}</h3>
        <img class="screenshot-example" :src="levelExample" :alt="t('screenshot.guideLevelAlt')" width="960" height="540" />
      </section>
      <section class="guide-example">
        <h3><span class="guide-badge optional">{{ t('screenshot.guideOptional') }}</span>{{ t('screenshot.guideUncapTitle') }}</h3>
        <div class="uncap-example" role="img" :aria-label="t('screenshot.guideUncapAlt')">
          <div class="example-cards" aria-hidden="true">
            <div v-for="(card, index) in exampleCards" :key="card" class="example-card">
              <img :src="card" alt="" width="80" height="80" />
              <div class="uncap-dots"><span v-for="dot in 4" :key="dot" :class="{ filled: dot <= index + 1 }" /></div>
            </div>
          </div>
        </div>
        <p>{{ t('screenshot.combinedScreenshots') }}</p>
      </section>
    </div>
  </details>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import levelExample from '@/assets/guides/card-level-list.png';
import riddle from '@/assets/img/riddle_birth.webp';
import ace from '@/assets/img/ace_dormitory.webp';
import deuce from '@/assets/img/deuce_dormitory.webp';

defineProps<{ hasSources: boolean }>();
const { t } = useI18n();
const exampleCards = [riddle, ace, deuce];
</script>

<style scoped>
.capture-guide { margin-bottom: 20px; border: 1px solid rgba(var(--v-theme-primary), .2); border-radius: 12px; padding: 14px 16px; background: rgb(var(--v-theme-surface)); }
summary { cursor: pointer; color: rgb(var(--v-theme-primary)); font-weight: 700; font-size: .95rem; }
summary:focus-visible { outline: 2px solid rgb(var(--v-theme-primary)); outline-offset: 4px; }
.guide-intro { margin: 12px 0; font-size: .85rem; line-height: 1.7; }
.guide-examples { display: grid; grid-template-columns: 1.3fr 1fr; gap: 20px; }
.guide-example { min-width: 0; }
h3 { display: flex; align-items: center; flex-wrap: wrap; gap: 8px; font-size: .88rem; margin-bottom: 10px; }
.guide-badge { border-radius: 4px; padding: 2px 7px; background: #e4effb; color: #175ca1; font-size: .72rem; }
.guide-badge.optional { background: #eeebf6; color: #615181; }
.screenshot-example { display: block; width: 100%; max-width: 420px; height: auto; border: 1px solid rgba(var(--v-theme-on-surface), .15); border-radius: 8px; }
.guide-example p { margin-top: 10px; font-size: .8rem; line-height: 1.7; }
.uncap-example { background: #f5f2eb; border: 1px solid #e1d9c8; border-radius: 8px; padding: 22px 10px 14px; text-align: center; color: #625c50; }
.example-cards { display: flex; justify-content: center; gap: 16px; }
.example-card img { display: block; width: 70px; height: 70px; object-fit: cover; border: 2px solid #baa46a; }
.uncap-dots { display: flex; justify-content: space-between; gap: 4px; padding: 8px 0; }
.uncap-dots span { width: 12px; height: 12px; border-radius: 50%; border: 1px solid #9b978e; background: #ddd9d0; }
.uncap-dots .filled { background: #884dbb; border-color: #673198; }
@media (max-width: 760px) {
  .capture-guide { padding: 12px; }
  .guide-examples { grid-template-columns: 1fr; gap: 18px; }
}
</style>
