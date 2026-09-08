<template>
<div class="exam-preset-strip">
            <div class="preset-group">
              <span class="preset-group-label">{{ t('examSimulator.normalPresets') }}</span>
              <div class="preset-actions">
                <v-btn
                  v-for="preset in recentNormalExamPresets"
                  :key="preset.id"
                  color="primary"
                  variant="tonal"
                  size="small"
                  @click="preset.apply"
                >
                  {{ displayPresetTitle(preset.title) }}
                </v-btn>
              </div>
              <v-menu location="bottom end" max-height="420">
                <template #activator="{ props }">
                  <v-btn v-bind="props" color="primary" variant="outlined" size="small">
                    {{ t('examSimulator.pastPresets') }}
                  </v-btn>
                </template>
                <v-list class="preset-menu-list" density="compact" nav>
                  <v-list-item
                    v-for="preset in normalExamPresets"
                    :key="preset.id"
                    :title="displayPresetTitle(preset.title)"
                    @click="preset.apply"
                  />
                </v-list>
              </v-menu>
            </div>
            <div class="preset-group preset-group-unified">
              <span class="preset-group-label">{{ t('examSimulator.unifiedPresets') }}</span>
              <div class="preset-actions">
                <v-btn
                  v-for="preset in recentUnifiedExamPresets"
                  :key="preset.id"
                  color="primary"
                  variant="tonal"
                  size="small"
                  @click="preset.apply"
                >
                  {{ displayPresetTitle(preset.title) }}
                </v-btn>
              </div>
              <v-menu location="bottom end" max-height="420">
                <template #activator="{ props }">
                  <v-btn v-bind="props" color="primary" variant="outlined" size="small">
                    {{ t('examSimulator.pastPresets') }}
                  </v-btn>
                </template>
                <v-list class="preset-menu-list" density="compact" nav>
                  <v-list-item
                    v-for="preset in unifiedExamPresets"
                    :key="preset.id"
                    :title="displayPresetTitle(preset.title)"
                    @click="preset.apply"
                  />
                </v-list>
              </v-menu>
            </div>
          </div>
</template>
<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { examPresetDefinitions, type ExamPresetDefinition } from '@/utils/examPresets';
import { localizeGameText } from '@/utils/localizedDisplay';
const { t, locale } = useI18n();
const emit = defineEmits<{ select: [preset: ExamPresetDefinition] }>();
const displayPresetTitle = (title: string) => localizeGameText(title, locale.value);
const sortedExamPresets = computed(() => [...examPresetDefinitions]
  .sort((a, b) => b.title.localeCompare(a.title, 'ja')));
const isUnifiedExamPreset = (preset: ExamPresetDefinition) => preset.title.includes('統一') || (preset.specialChallenges?.length ?? 0) > 0;
const unifiedElementOrder: Record<string, number> = {
  火: 0,
  水: 1,
  木: 2,
  無: 3,
  全: 4,
};
function unifiedPresetGroupKey(preset: ExamPresetDefinition) {
  return preset.title.replace(new RegExp(`${preset.enemyElement}(?:ATK|DF|BS|BASIC|DEFENCE|ATTACK)?$`), '');
}
function compareUnifiedExamPresets(a: ExamPresetDefinition, b: ExamPresetDefinition) {
  const groupCompare = unifiedPresetGroupKey(b).localeCompare(unifiedPresetGroupKey(a), 'ja', { numeric: true });
  if (groupCompare !== 0) return groupCompare;
  return (unifiedElementOrder[a.enemyElement] ?? 99) - (unifiedElementOrder[b.enemyElement] ?? 99)
    || a.title.localeCompare(b.title, 'ja');
}
const createExamPresetListItem = (preset: ExamPresetDefinition) => ({
  ...preset,
  apply: () => emit('select', preset),
});
const normalExamPresets = computed(() => sortedExamPresets.value
  .filter((preset) => !isUnifiedExamPreset(preset))
  .map(createExamPresetListItem));
const unifiedExamPresets = computed(() => sortedExamPresets.value
  .filter(isUnifiedExamPreset)
  .sort(compareUnifiedExamPresets)
  .map(createExamPresetListItem));
const recentNormalExamPresets = computed(() => normalExamPresets.value.slice(0, 2));
const recentUnifiedExamPresets = computed(() => unifiedExamPresets.value.slice(0, 5));
</script>
<style scoped>
.exam-preset-strip {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 10px;
  min-width: 0;
  max-width: 100%;
  margin-bottom: 10px;
  padding: 10px 12px;
  border: 1px solid #d9e2ea;
  border-radius: 8px;
  background: #fff;
}
.preset-group {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: 8px;
  min-width: 0;
  padding: 6px 8px;
  border: 1px solid #dbe5ed;
  border-radius: 8px;
  background: #fbfcfd;
}
.preset-group-unified { background: #fffaf2; border-color: #ead9bd; }
.preset-group-label { white-space: nowrap; font-size: 12px; font-weight: 900; color: #52616d; }
.preset-actions { display: flex; flex-wrap: wrap; gap: 6px; min-width: 0; max-width: 100%; }
.preset-actions :deep(.v-btn) { max-width: 100%; white-space: normal; }
@media (max-width: 600px) {
  .preset-group { grid-template-columns: minmax(0, 1fr) auto; }
  .preset-group-label { grid-column: 1 / -1; }
}
</style>