<template>
  <div v-if="loadFailed" class="search-load-state" role="alert" data-testid="search-load-error">
    <p>{{ t('examSearch.loadFailed') }}</p>
    <div class="search-load-actions">
      <v-btn color="primary" variant="tonal" @click="reloadPage">{{ t('examSearch.reloadPage') }}</v-btn>
    </div>
  </div>
  <div v-else-if="!panel" class="search-load-state" role="status" aria-live="polite">
    <v-progress-linear indeterminate color="primary" />
    <p>{{ t('examSearch.loadingPanel') }}</p>
  </div>
  <component v-else :is="panel" ref="panelRef" v-bind="$attrs" />
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, shallowRef, type Component } from 'vue';
import { useI18n } from 'vue-i18n';

defineOptions({ inheritAttrs: false });
const { t } = useI18n();
const panel = shallowRef<Component | null>(null);
const panelRef = ref<{ busy?: boolean; requestStopAndSave?: () => Promise<boolean> } | null>(null);
const loadFailed = ref(false);
let disposed = false;

async function loadPanel() {
  loadFailed.value = false;
  try {
    const loaded = await import('@/views/examSearch.vue');
    if (!disposed) panel.value = loaded.default;
  } catch {
    if (!disposed) loadFailed.value = true;
  }
}
function reloadPage() { window.location.reload(); }
const busy = computed(() => panelRef.value?.busy === true);
async function requestStopAndSave() { return await panelRef.value?.requestStopAndSave?.() ?? true; }
defineExpose({ busy, requestStopAndSave });
onMounted(loadPanel);
onBeforeUnmount(() => { disposed = true; });
</script>

<style scoped>
.search-load-state { padding: 20px; border: 1px solid #d9e2ea; border-radius: 8px; background: #fff; }
.search-load-state p { margin: 12px 0; }
.search-load-actions { display: flex; flex-wrap: wrap; gap: 8px; }
</style>
