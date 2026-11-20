<script setup lang="ts">
import { ref, watch } from 'vue';
import { useDisplay } from 'vuetify';
import { useI18n } from 'vue-i18n';
import ExamBattleLog from './ExamBattleLog.vue';
import { downloadBattleLogImage } from '@/utils/battleLogImage';
import type { BattleLogActionElement, BattleLogGroup } from '@/utils/examBattleLog';

const open = defineModel<boolean>({ required: true });
const props = defineProps<{
  title: string;
  groups: BattleLogGroup[];
  defaultImg: string;
  localize: (text: string) => string;
  elementIcon: (element: BattleLogActionElement) => string;
}>();
const { t } = useI18n();
const { width } = useDisplay();
const sheet = ref<HTMLElement | null>(null);
const saving = ref(false);
const saveFailed = ref(false);
watch(open, () => { saveFailed.value = false; });

async function saveImage() {
  if (!sheet.value || saving.value) return;
  saving.value = true;
  saveFailed.value = false;
  try {
    await downloadBattleLogImage(sheet.value, props.title);
  } catch (error) {
    console.error('Could not export battle log image', error);
    saveFailed.value = true;
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <v-dialog v-model="open" :fullscreen="width <= 720" max-width="1480"
    content-class="battle-log-overlay" scrollable>
    <v-card class="battle-log-card">
      <v-card-title class="battle-log-heading">
        <span data-testid="best-log-title">{{ title }}</span>
        <v-btn icon variant="text" width="44" height="44" :loading="saving" :disabled="!groups.length || saving"
          :title="t('examSimulator.saveLogImage')" :aria-label="t('examSimulator.saveLogImage')" @click="saveImage">
          <span class="save-image-icon" aria-hidden="true">
            <v-icon icon="mdi-image-outline" size="22" />
            <v-icon icon="mdi-download" size="15" class="download-badge" />
          </span>
        </v-btn>
        <v-btn icon variant="text" width="44" height="44"
          :title="t('common.close')" :aria-label="t('common.close')" @click="open = false">
          <span class="close-icon"><v-icon icon="mdi-close-thick" size="18" /></span>
        </v-btn>
      </v-card-title>
      <v-alert v-if="saveFailed" type="error" density="compact">{{ t('examSimulator.saveLogImageFailed') }}</v-alert>
      <v-card-text class="battle-log-content">
        <div ref="sheet">
          <ExamBattleLog :groups="groups" :default-img="defaultImg" :enemy-label="t('examSimulator.enemy')"
            :localize="localize" :element-icon="elementIcon" />
        </div>
      </v-card-text>
    </v-card>
  </v-dialog>
</template>

<style>
@media (min-width: 721px) {
  .v-dialog > .v-overlay__content.battle-log-overlay {
    width: calc(100% - 24px);
    max-height: calc(100% - 24px);
    margin: 12px;
  }
}
</style>

<style scoped>
.battle-log-heading {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto auto;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
  border-bottom: 1px solid #dfe7ee;
  font-weight: 800;
  line-height: 1.4;
  white-space: normal;
  overflow-wrap: anywhere;
}

.v-card.battle-log-card > .v-card-text.battle-log-content { padding: 0 16px 12px; }

.save-image-icon { display: inline-flex; position: relative; color: #526a7c; }
.close-icon {
  display: grid;
  place-items: center;
  width: 28px;
  height: 28px;
  border-radius: 50%;
  color: #fff;
  background: #526a7c;
}
.download-badge {
  position: absolute;
  right: -3px;
  bottom: -2px;
  border-radius: 3px;
  background: rgb(var(--v-theme-surface));
}

@media (max-width: 720px) {
  .battle-log-heading { padding: 3px 4px 3px 8px; gap: 4px; font-size: 16px; }
  .v-card.battle-log-card > .v-card-text.battle-log-content { padding: 0 6px 8px; }
}
</style>
