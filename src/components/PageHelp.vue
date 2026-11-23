<template>
  <v-dialog v-model="open" max-width="520" scrollable aria-labelledby="page-help-title">
    <template #activator="{ props }">
      <v-btn v-bind="props" icon="mdi-help-circle-outline" variant="text" size="40"
        :aria-label="t('pageHelp.label')" :title="t('pageHelp.label')" />
    </template>
    <v-card>
      <v-card-title id="page-help-title" class="help-title" tag="h2">
        {{ titleKey ? t('pageHelp.pageTitle', { page: t(titleKey) }) : t('pageHelp.welcome') }}
      </v-card-title>
      <v-card-text class="help-body">
        <template v-if="!titleKey">
          <p>{{ t('pageHelp.overview') }}</p>
          <ol class="help-steps">
            <li>
              <RouterLink :to="{ name: 'handCollection' }">{{ t('pageHelp.startCollection') }}</RouterLink>
              <p>{{ t('pageHelp.register') }}</p>
            </li>
            <li>
              <RouterLink :to="{ name: 'examSimulator', query: { tab: 'search' } }">{{ t('pageHelp.openExam') }}</RouterLink>
              <p>{{ t('pageHelp.findTeam') }}</p>
            </li>
            <li>
              <strong>{{ t('pageHelp.scoreLogTitle') }}</strong>
              <p>{{ t('pageHelp.scoreLogSteps') }}</p>
            </li>
          </ol>
          <details class="mobile-help">
            <summary>{{ t('pageHelp.mobile.title') }}</summary>
            <p>{{ t('pageHelp.mobile.browser') }}</p>
            <p>{{ t('pageHelp.mobile.storage') }}</p>
            <h3>{{ t('pageHelp.mobile.install') }}</h3>
            <ol class="help-steps">
              <li v-for="step in homeScreenSteps" :key="step.text">
                <p>{{ t(step.text) }}</p>
                <img class="step-image" :src="step.image" :width="step.width" :height="step.height" alt="" loading="lazy" />
              </li>
            </ol>
            <p>{{ t('pageHelp.mobile.transfer') }}</p>
          </details>
        </template>
        <template v-else>
          <p>{{ t('pageHelp.pages.' + String(route.name)) }}</p>
          <DeckSearchHelp v-if="route.name === 'search'" />
          <template v-else-if="route.name === 'examSimulator'">
            <ol class="help-steps">
              <li>{{ t('pageHelp.findTeam') }}</li>
              <li>{{ t('pageHelp.scoreLogSteps') }}</li>
            </ol>
            <p class="exam-upgrades">{{ t('pageHelp.tryUpgrades') }}</p>
            <details class="exam-details">
              <summary>{{ t('pageHelp.manualExam.title') }}</summary>
              <p>{{ t('pageHelp.manualExam.intro') }}</p>
              <dl class="exam-modes">
                <dt>{{ t('examSimulator.autoBestMode') }}</dt>
                <dd>{{ t('pageHelp.manualExam.autoBest') }}</dd>
                <dt>{{ t('examSimulator.normalMode') }}</dt>
                <dd>{{ t('pageHelp.manualExam.normal') }}</dd>
              </dl>
              <p>{{ t('pageHelp.manualExam.probability') }}</p>
            </details>
          </template>
          <ol v-else-if="route.name === 'examBenchmark'" class="help-steps">
            <li>
              <strong>{{ t('benchmark.selectionMode') }}</strong>
              <p>{{ t('pageHelp.benchmark.select') }}</p>
            </li>
            <li>
              <strong>{{ t('benchmark.includeReference') }}</strong>
              <p>{{ t('pageHelp.benchmark.compare') }}</p>
            </li>
            <li>
              <strong>{{ t('benchmark.ranking') }}</strong>
              <p>{{ t('pageHelp.benchmark.ranking') }}</p>
            </li>
          </ol>
        </template>
      </v-card-text>
      <v-card-actions>
        <v-spacer />
        <v-btn color="primary" @click="open = false">{{ t('common.close') }}</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import { useI18n } from 'vue-i18n';
import DeckSearchHelp from './DeckSearchHelp.vue';
import shareImage from '@/assets/guides/iphone-home-share.png';
import moreImage from '@/assets/guides/iphone-home-more.png';
import addImage from '@/assets/guides/iphone-home-add.png';
import launchImage from '@/assets/guides/iphone-home-launch.png';

const homeScreenSteps = [
  { text: 'pageHelp.mobile.share', image: shareImage, width: 364, height: 85 },
  { text: 'pageHelp.mobile.home', image: moreImage, width: 492, height: 199 },
  { text: 'pageHelp.mobile.add', image: addImage, width: 523, height: 314 },
  { text: 'pageHelp.mobile.launch', image: launchImage, width: 163, height: 173 },
];

defineProps<{ titleKey?: string }>();
const { t } = useI18n();
const route = useRoute();
const open = ref(false);
watch(() => route.fullPath, () => { open.value = false; });
</script>

<style scoped>
.help-title {
  white-space: normal;
  line-height: 1.4;
}
.help-body {
  line-height: 1.65;
}
.exam-modes {
  margin: 1rem 0;
}
.exam-upgrades,
.exam-details {
  margin-top: 1rem;
}
.exam-details summary {
  cursor: pointer;
  color: #1565c0;
}
.exam-details > p:first-of-type {
  margin-top: .5rem;
}
.exam-modes dt {
  margin-top: .75rem;
  font-weight: 700;
}
.mobile-help {
  margin-top: 1rem;
  padding: .8rem 1rem;
  background: #f3f7fb;
  border-radius: 8px;
}
.mobile-help p {
  margin-top: .5rem;
}
.mobile-help h3 {
  margin-top: 1rem;
  font-size: 1rem;
}
.mobile-help summary {
  cursor: pointer;
  font-weight: 700;
  color: #1565c0;
}
.step-image {
  display: block;
  max-width: 100%;
  height: auto;
  margin-top: .4rem;
  border-radius: 6px;
}
.help-steps {
  margin-top: 1rem;
  padding-inline-start: 1.5rem;
}
.help-steps li + li {
  margin-top: .75rem;
}
.help-steps li::marker,
.help-steps a {
  font-weight: 700;
}
.help-steps a {
  color: #1565c0;
  text-underline-offset: .15em;
}
</style>
