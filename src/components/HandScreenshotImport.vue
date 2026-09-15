<template>
  <v-btn prepend-icon="mdi-image-plus" variant="outlined" @click="open = true">{{ t('screenshot.button') }}</v-btn>
  <v-dialog v-model="open" max-width="1320" :persistent="busy" class="screenshot-modal">
    <v-card class="import-dialog">
      <header class="modal-heading">
        <div class="heading-mark" aria-hidden="true"><v-icon>mdi-image-multiple-outline</v-icon></div>
        <div><h2>{{ t('screenshot.button') }}</h2><p>{{ t('screenshot.overviewIntro') }}</p></div>
        <v-btn class="heading-close" icon="mdi-close" variant="text" :aria-label="t('screenshot.close')" :disabled="busy" @click="open=false" />
      </header>
      <div class="import-content">
        <div class="upload-area" :class="{ compact: sources.length, dragging: dragOver }" @dragover.prevent="dragOver = !busy" @dragleave.prevent="dragOver=false" @drop.prevent="dropFiles">
          <input ref="input" class="file-input" type="file" accept="image/png,image/jpeg,image/webp" multiple :disabled="busy" :aria-label="t('screenshot.files')" @change="chooseFiles" />
          <v-icon v-if="!sources.length" size="32" aria-hidden="true">mdi-image-plus-outline</v-icon>
          <div class="upload-copy"><strong>{{ t(sources.length ? 'screenshot.selectedFiles' : 'screenshot.uploadTitle', { count:sources.length }) }}</strong><p>{{ t('screenshot.uploadHint') }}</p></div>
          <v-btn color="primary" :variant="sources.length ? 'outlined' : 'flat'" prepend-icon="mdi-folder-image" :disabled="busy" @click="input?.click()">{{ t(sources.length ? 'screenshot.replaceFiles' : 'screenshot.files') }}</v-btn>
        </div>
        <p v-if="!sources.length" class="privacy-note">{{ t('screenshot.description') }}</p>
        <label class="level-import-option">{{ t('screenshot.importLevel') }}<select v-model="levelMode" :disabled="busy || applied" :aria-label="t('screenshot.importLevel')"><option value="maximum">{{ t('screenshot.maximumLevel') }}</option><option value="current">{{ t('screenshot.currentLevel') }}</option></select></label>
        <div v-if="busy" class="processing-state"><v-progress-linear :model-value="progress" :indeterminate="progress === 0" color="primary" rounded /><p role="status" aria-live="polite">{{ status }}</p></div>
        <p v-else-if="status && !rows.length" class="help" role="status">{{ status }}</p>
        <v-alert v-if="error" type="warning" variant="tonal" density="compact" class="import-alert">{{ error }}</v-alert>
        <div v-if="sources.length && !busy" class="overview-toolbar">
          <div><h3>{{ t('screenshot.overview') }}</h3><p>{{ t('screenshot.overviewHelp') }}</p></div>
          <label class="review-filter"><input v-model="reviewOnly" type="checkbox" /> {{ t('screenshot.reviewOnly') }}</label>
        </div>
        <div v-if="sources.length && !busy" class="export-toolbar"><v-btn variant="outlined" prepend-icon="mdi-image-multiple-outline" :disabled="!rows.length || exporting" @click="openExport">{{ t('screenshot.exportButton') }}</v-btn></div>
        <section v-for="(fileIndex,position) in fileOrder" :key="sources[fileIndex].url" class="source-group" :aria-label="sources[fileIndex].name">
          <header class="source-group-heading">
            <img :src="sources[fileIndex].url" alt="" /><div><strong>{{ t('screenshot.imageNumber',{number:position+1}) }}</strong><span :title="sources[fileIndex].name">{{ sources[fileIndex].name }}</span></div>
            <span v-if="!busy" class="source-count">{{ t('screenshot.detectedCount',{count:rows.filter(row=>row.fileIndex===fileIndex).length}) }}</span>
            <v-btn size="small" variant="text" :disabled="busy" @click="openSource(fileIndex)">{{ t('screenshot.viewOriginal') }}</v-btn>
          </header>
          <div class="result-grid">
            <article v-for="row in visibleRows.filter(row=>row.fileIndex===fileIndex)" :key="row.id" :id="`screenshot-${row.id}`" class="result-card" :class="{ unresolved: !row.selected }" :aria-label="cardLabel(row.selected) || t('screenshot.unrecognized')">
              <div class="card-pair">
                <figure><img :src="row.thumbnail" :alt="t('screenshot.crop')" loading="lazy" /><figcaption>{{ t('screenshot.original') }}</figcaption></figure>
                <span class="pair-arrow" aria-hidden="true">→</span>
                <figure><button type="button" class="card-icon-button" :disabled="busy || applied" :aria-label="`${t('screenshot.changeCard')}: ${cardLabel(row.selected) || t('screenshot.unrecognized')}`" @click="openCardPicker(row)"><img v-if="row.selected" :src="cardImages[row.selected]" :alt="cardLabel(row.selected)" loading="lazy" /><span v-else class="missing-icon">?</span><span class="icon-edit-mark" aria-hidden="true"><v-icon size="12">mdi-pencil</v-icon></span></button><figcaption>{{ t('screenshot.recognized') }}</figcaption></figure>
                <span class="card-number">{{ rows.filter(item=>item.fileIndex===fileIndex).indexOf(row)+1 }}</span>
              </div>
              <div class="inline-fields">
                <label>{{ t('screenshot.level') }}<input :value="getImportLevel(row,levelMode) ?? ''" :aria-label="t('screenshot.level')" type="number" min="1" :max="getInputMaxLevel(catalog.get(row.selected)?.rare)" :disabled="busy || applied" :placeholder="t('screenshot.unknown')" @input="changeLevel(row,$event)" /></label>
                <label>{{ t('screenshot.uncaps') }}<select :aria-label="t('screenshot.uncaps')" :value="row.totsu ?? ''" :disabled="busy || applied" :class="{unknown:row.totsu===undefined}" @change="changeTotsu(row,$event)"><option value="">{{ t('screenshot.uncapsUnknownOption') }}</option><option v-for="count in [0,1,2,3,4]" :key="count" :value="count">{{ t('screenshot.uncapsValue',{count}) }}</option></select></label>
              </div>
              <p v-if="hasDuplicateConflict(row)" class="card-warning">{{ t('screenshot.duplicateShort') }}</p>
            </article>
          </div>
          <p v-if="!busy && !visibleRows.some(row=>row.fileIndex===fileIndex)" class="empty-group">{{ rows.some(row=>row.fileIndex===fileIndex) ? t('screenshot.noReview') : t('screenshot.noCards') }}</p>
        </section>
      </div>
      <footer class="import-footer">
        <p class="uncaps-note">{{ t('screenshot.uncapsHelp') }}</p>
        <p v-if="applied" class="applied-message" role="status">{{ t('screenshot.applied') }}</p>
        <div class="footer-actions"><p class="import-summary" role="status" aria-live="polite">{{ t('screenshot.summary',{count:merged.length,review:rows.filter(needsReview).length}) }}</p>
          <v-btn v-if="busy" variant="text" @click="cancel">{{ t('screenshot.cancel') }}</v-btn>
          <v-btn v-if="applied" :disabled="store.saving" variant="outlined" @click="undo">{{ t('screenshot.undo') }}</v-btn>
          <v-btn v-if="applied" color="primary" variant="flat" @click="open=false">{{ t('screenshot.close') }}</v-btn>
          <v-btn v-else :disabled="busy || !merged.length || store.loadFailed || store.hasConflict || store.saving" color="primary" variant="flat" @click="apply">{{ t('screenshot.apply') }}</v-btn>
        </div>
      </footer>
      <v-dialog v-model="exportOpen" :max-width="exportPages.length ? 860 : 1100" :persistent="exporting" class="screenshot-modal">
        <v-card class="import-dialog">
          <header class="modal-heading"><div><h2>{{ t('screenshot.exportButton') }}</h2><p>{{ exportPages.length ? t('screenshot.exportSummary',{count:exportCount,duplicates:exportDuplicates}) : t('screenshot.exportHelp') }}</p></div><v-btn class="heading-close" icon="mdi-close" variant="text" :disabled="exporting" :aria-label="t('screenshot.close')" @click="exportOpen=false" /></header>
          <div v-if="!exportPages.length" class="export-order">
            <ScreenshotImageOrder v-model="exportOrder" :sources="sources" :disabled="exporting" @update:model-value="clearExport" />
            <v-alert v-if="error" type="warning" variant="tonal" density="compact">{{ error }}</v-alert>
          </div>
          <div v-else class="export-preview"><figure v-for="(page,index) in exportPages" :key="page.url"><img :src="page.url" :alt="t('screenshot.exportPage',{number:index+1})" /><figcaption><v-btn :href="page.url" :download="`twst-collection-${index+1}.png`" color="primary" prepend-icon="mdi-download">{{ t('screenshot.downloadPage',{number:index+1}) }}</v-btn></figcaption></figure></div>
          <footer class="export-actions"><v-btn v-if="exportPages.length" variant="text" prepend-icon="mdi-sort" @click="clearExport">{{ t('screenshot.editExportOrder') }}</v-btn><v-btn v-else color="primary" :loading="exporting" :disabled="exporting" @click="createExport">{{ t('screenshot.previewExport') }}</v-btn></footer>
        </v-card>
      </v-dialog>
      <SimCharaModal v-if="pickerOpen" catalog-mode @close="pickerOpen=false" @select="pickCard" @clear="clearCard" />
      <v-dialog v-model="sourceOpen" max-width="900" :persistent="busy" class="screenshot-modal">
        <v-card class="import-dialog source-dialog">
          <header class="modal-heading"><h2>{{ t('screenshot.original') }}</h2><v-btn class="heading-close" icon="mdi-close" variant="text" :aria-label="t('screenshot.close')" :disabled="busy" @click="sourceOpen=false" /></header>
          <div v-if="busy || error" class="source-status"><v-progress-linear v-if="busy" :model-value="progress" :indeterminate="progress===0" color="primary" /><p v-if="busy" class="help" role="status">{{ status }}</p><v-alert v-if="error" type="warning" variant="tonal" density="compact">{{ error }}</v-alert><v-btn v-if="busy" size="small" variant="text" @click="cancel">{{ t('screenshot.cancel') }}</v-btn></div>
        <section class="image-panel" :aria-label="t('screenshot.original')">
          <div class="image-toolbar">
            <select v-model.number="activeFile" :aria-label="t('screenshot.sourceImage')" @change="changeSource"><option v-for="(index,position) in fileOrder" :key="sources[index].url" :value="index">{{ position+1 }}. {{ sources[index].name }}</option></select>
            <v-btn size="small" :variant="drawMode ? 'flat' : 'outlined'" :disabled="busy || applied" :aria-pressed="drawMode" @click="drawMode = !drawMode">{{ t('screenshot.selectRegion') }}</v-btn>
          </div>
          <p v-if="drawMode" class="help">{{ t('screenshot.drawHelp') }}</p>
          <p v-else class="help">{{ t('screenshot.pickOnImage') }}</p>
          <div ref="sourceViewport" class="source-viewport">
            <div v-if="activeSource" ref="sourceFrame" class="source-frame" :class="{drawing:drawMode}" @pointerdown="startDraw($event, activeFile)" @pointerup="finishDraw($event, activeFile)" @pointercancel="drag=undefined">
              <img :key="activeSource.url" :src="activeSource.url" :alt="activeSource.name" draggable="false" @load="sourceLoaded($event)" />
              <svg v-if="activeSource.width" :viewBox="`0 0 ${activeSource.width} ${activeSource.height}`" preserveAspectRatio="none">
                <g v-for="(row,index) in sourceRows" :key="row.id" role="button" tabindex="0" :aria-label="`${index+1}. ${cardLabel(row.selected)} Lv ${getImportLevel(row,levelMode) ?? '?'} ${totsuLabel(row)}`" @click.stop="!drawMode && jumpToRow(row)" @keydown.enter.prevent="jumpToRow(row)" @keydown.space.prevent="jumpToRow(row)">
                  <rect :x="row.box.x" :y="row.box.y" :width="row.box.width" :height="row.box.height*1.27" :class="{active:activeId===row.id,uncertain:needsReview(row)}" />
                  <text :x="row.box.x+4" :y="row.box.y+row.box.width*.15" :font-size="row.box.width*.13">{{ index+1 }}</text>
                </g>
              </svg>
            </div>
          </div>
        </section>
        </v-card>
      </v-dialog>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
import { computed, nextTick, onUnmounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import cards from '@/assets/chara.json';
import SimCharaModal from '@/components/SimCharaModal.vue';
import ScreenshotImageOrder from '@/components/ScreenshotImageOrder.vue';
import { useHandCollectionStore, type HandCard } from '@/store/handCollection';
import { loadImageUrls } from '@/utils/characterAssets';
import { getInputMaxLevel } from '@/constants/levels';
import { localizeCharacterName, localizeCostumeName } from '@/utils/localizedDisplay';
import { mergeDetections, type Box, type Detection } from '@/domain/handScreenshot/types';
import { validateScreenshot } from '@/domain/handScreenshot/input';
import { applyMaxLevelUncaps } from '@/domain/handScreenshot/metadata';
import { getImportLevel, setImportLevel, type ImportDetection, type ImportLevelMode } from '@/domain/handScreenshot/importLevel';
import type { ExportPage } from '@/domain/handScreenshot/export';
import type { ScreenshotSession } from '@/domain/handScreenshot/client';

const { t, locale } = useI18n(), store = useHandCollectionStore();
const catalog = new Map(cards.map(card => [card.name, card]));
const open = ref(false), busy = ref(false), applied = ref(false), reviewOnly = ref(true);
const levelMode = ref<ImportLevelMode>('maximum');
const files = ref<File[]>([]), sources = ref<{ url: string; name: string; width: number; height: number }[]>([]);
const fileOrder = ref<number[]>([]), exporting = ref(false), exportOpen = ref(false);
const exportOrder = ref<number[]>([]);
const exportPages = ref<ExportPage[]>([]), exportCount = ref(0), exportDuplicates = ref(0);
let exportGeneration = 0;
function clearExport() { exportGeneration++; exportPages.value.forEach(page=>URL.revokeObjectURL(page.url)); exportPages.value=[]; }
function openExport() { clearExport(); error.value=''; exportOpen.value=true; }
async function createExport() {
  if (busy.value || exporting.value) return;
  exporting.value=true; error.value=''; clearExport();
  const generation = exportGeneration;
  const snapshot = rows.value.map(row=>({...row,box:{...row.box}}));
  try {
    const { exportCollection } = await import('@/domain/handScreenshot/export');
    const result = await exportCollection(files.value.slice(),snapshot,exportOrder.value.slice());
    if (generation !== exportGeneration) { result.pages.forEach(page=>URL.revokeObjectURL(page.url)); return; }
    exportPages.value=result.pages; exportCount.value=result.count; exportDuplicates.value=result.duplicates; exportOpen.value=true;
  } catch { error.value=t('screenshot.exportError'); }
  finally { exporting.value=false; }
}
const rows = ref<ImportDetection[]>([]), progress = ref(0), status = ref(''), error = ref('');
const input = ref<HTMLInputElement>();
const drawMode = ref(false), sourceOpen = ref(false), pickerOpen = ref(false), dragOver = ref(false);
const activeId = ref(''), activeFile = ref(0);
const sourceViewport = ref<HTMLElement>(), sourceFrame = ref<HTMLElement>();
const cardImages = ref<Record<string,string>>({});
void loadImageUrls(cards, 'name', '', 'notyet').then(images => { cardImages.value=images; });
const activeRow = computed(()=>rows.value.find(row=>row.id===activeId.value));
const activeSource = computed(()=>sources.value[activeFile.value]);
const sourceRows = computed(()=>rows.value.filter(row=>row.fileIndex===activeFile.value));
function totsuLabel(row: Detection) { return row.totsu === undefined ? t('screenshot.uncapsUnknown') : t('screenshot.uncapsValue',{count:row.totsu}); }
function needsReview(row: ImportDetection) { return !row.selected || !getImportLevel(row,levelMode.value) || row.totsu===undefined || hasDuplicateConflict(row); }
function changeLevel(row: ImportDetection, event: Event) {
  if (busy.value || applied.value) return;
  setImportLevel(row,levelMode.value,(event.target as HTMLInputElement).value);
}
async function focusRow(row?: Detection) {
  if(!row) return;
  activeId.value=row.id; activeFile.value=row.fileIndex;
  await nextTick();
  const viewport=sourceViewport.value, frame=sourceFrame.value, source=activeSource.value;
  if(viewport && frame && source?.width) {
    const scale=frame.clientWidth/source.width;
    viewport.scrollTo({top:Math.max(0,row.box.y*scale-(viewport.clientHeight-row.box.height*1.28*scale)/2),behavior:'smooth'});
  }
}
function openCardPicker(row: Detection) { activeId.value=row.id; pickerOpen.value=true; }
function openSource(index: number) { activeFile.value=index; sourceOpen.value=true; drawMode.value=false; changeSource(); }
async function jumpToRow(row: Detection) {
  sourceOpen.value=false; reviewOnly.value=false; await nextTick();
  const field=document.getElementById(`screenshot-${row.id}`)?.querySelector('input');
  field?.focus({preventScroll:true}); field?.scrollIntoView({block:'center',behavior:'smooth'});
}
function sourceLoaded(event: Event) {
  if(!activeSource.value) return;
  const image=event.target as HTMLImageElement;
  activeSource.value.width=image.naturalWidth;activeSource.value.height=image.naturalHeight;
  if(activeRow.value?.fileIndex===activeFile.value) void focusRow(activeRow.value);
}
function changeSource() {
  const row=rows.value.find(row=>row.fileIndex===activeFile.value);
  if(row) void focusRow(row);
  else activeId.value='';
}
function pickCard(card: { name: string }) {
  if(activeRow.value && catalog.has(card.name) && !busy.value && !applied.value) {
    activeRow.value.selected=card.name;
    applyMaxLevelUncaps(activeRow.value,catalog.get(card.name)?.rare);
  }
  pickerOpen.value=false;
}
function clearCard() {
  if(activeRow.value && !busy.value && !applied.value) {
    activeRow.value.selected='';
    applyMaxLevelUncaps(activeRow.value);
  }
  pickerOpen.value=false;
}
function changeTotsu(row: Detection, event: Event) {
  const value=(event.target as HTMLSelectElement).value;
  row.totsu=value===''?undefined:Number(value); row.totsuEvidence='manual';
}
let session: ScreenshotSession | undefined;
let operationId = 0;
let undoEntries: { key: string; before?: HandCard; after: HandCard }[] = [];
const merged = computed(() => mergeDetections(rows.value.map(row=>({...row,level:getImportLevel(row,levelMode.value)}))).filter(row => catalog.has(row.cardKey)));
const visibleRows = computed(() => rows.value.filter(row => !reviewOnly.value || needsReview(row)));
function cardLabel(key: string) {
  const card = catalog.get(key); return card ? `${localizeCharacterName(card.chara, locale.value)} / ${localizeCostumeName(card, locale.value)}` : key;
}
function hasDuplicateConflict(row: Detection) { return merged.value.some(card => card.cardKey === row.selected && (card.conflict || card.totsuConflict)); }
function clearSources() { for (const source of sources.value) URL.revokeObjectURL(source.url); sources.value = []; }
async function chooseFiles(event: Event) {
  const target=event.target as HTMLInputElement;
  const selection=Array.from(target.files ?? []);
  target.value='';
  await selectFiles(selection);
}
async function dropFiles(event: DragEvent) {
  dragOver.value=false;
  if(busy.value) return;
  await selectFiles(Array.from(event.dataTransfer?.files ?? []));
}
async function selectFiles(selection: File[]) {
  if (!selection.length || busy.value || exporting.value) return;
  cancel(); clearSources(); activeId.value=''; activeFile.value=0; files.value = selection; applied.value = false; undoEntries = []; reviewOnly.value=true;
  sources.value = selection.map(file => ({ url: URL.createObjectURL(file), name: file.name, width: 0, height: 0 }));
  fileOrder.value=selection.map((_,index)=>index); exportOrder.value=fileOrder.value.slice(); clearExport(); exportOpen.value=false;
  await recognize();
}
async function recognize(manual?: { box: Box; fileIndex: number }) {
  if (exporting.value) return;
  const operation = ++operationId;
  session?.stop(); busy.value = true; progress.value = 0; error.value = ''; status.value = t('screenshot.loading');
  if (!manual) rows.value = [];
  try {
    const targets: number[] = [];
    for (const fileIndex of manual ? [manual.fileIndex] : files.value.map((_, i) => i)) {
      try { await validateScreenshot(files.value[fileIndex]); targets.push(fileIndex); }
      catch { error.value = t('screenshot.fileError', { name: files.value[fileIndex].name }); }
      if (operation !== operationId) throw new DOMException('Cancelled', 'AbortError');
    }
    if (!targets.length) { status.value=''; return; }
    const { ScreenshotSession } = await import('@/domain/handScreenshot/client');
    if (operation !== operationId) throw new DOMException('Cancelled', 'AbortError');
    session = new ScreenshotSession();
    await session.load(value => { progress.value=value.totalBytes ? value.loadedBytes/value.totalBytes*100 : 0; status.value=value.totalBytes ? t('screenshot.preparing', { loaded:(value.loadedBytes/1_000_000).toFixed(1), total:(value.totalBytes/1_000_000).toFixed(1) }) : t('screenshot.loading'); });
    const staged: Detection[] = [];
    for (const fileIndex of targets) {
      status.value = t('screenshot.processing', { name: files.value[fileIndex].name });
      try {
        const detected = await session.analyze(files.value[fileIndex], fileIndex, (done, total) => { progress.value = done / total * 100; }, manual?.box);
        for (const row of detected) {
          row.id = `${Date.now()}-${fileIndex}-${row.id}`;
          if (!catalog.has(row.selected)) row.selected = '';
          applyMaxLevelUncaps(row,catalog.get(row.selected)?.rare);
        }
        staged.push(...detected);
      } catch (cause) {
        if (session.abort.signal.aborted) throw cause;
        error.value = t('screenshot.fileError', { name: files.value[fileIndex].name });
      }
    }
    session.abort.signal.throwIfAborted();
    rows.value = manual ? [...rows.value, ...staged] : staged;
    await focusRow(manual ? staged[0] : rows.value[0]);
    status.value = staged.length ? t('screenshot.done') : t('screenshot.noCards');
  } catch (cause) {
    if (operation !== operationId || (cause instanceof Error && cause.name === 'AbortError')) status.value = t('screenshot.cancelled');
    else error.value = t('screenshot.loadError');
  } finally { busy.value = false; session?.stop(); session = undefined; }
}
function cancel() { operationId++; session?.stop(); }
function apply() {
  if (busy.value || store.loadFailed || store.hasConflict || store.saving) return;
  undoEntries = [];
  store.batchUpdates(() => {
    for (const row of merged.value) {
      const existing = store.peekHandCard(row.cardKey), before = existing ? { ...existing } : undefined;
      const updates: Partial<HandCard> = { isOwned: true };
      if (!row.totsuConflict) updates.totsu = row.totsu ?? 0;
      if (!row.conflict && row.level !== undefined && Number.isInteger(row.level) && row.level <= getInputMaxLevel(catalog.get(row.cardKey)?.rare)) updates.level = row.level;
      store.updateHandCard(row.cardKey, updates);
      undoEntries.push({ key: row.cardKey, before, after: { ...store.getHandCard(row.cardKey) } });
    }
  });
  applied.value = true;
}
function undo() {
  let skipped = false;
  store.batchUpdates(() => {
    for (const entry of undoEntries) {
      if (JSON.stringify(store.getHandCard(entry.key)) !== JSON.stringify(entry.after)) { skipped = true; continue; }
      if (entry.before) store.updateHandCard(entry.key, entry.before);
      else store.removeHandCard(entry.key);
    }
  });
  applied.value = false; undoEntries = [];
  if (skipped) error.value = t('screenshot.undoConflict');
}
let drag: { x: number; y: number; index: number } | undefined;
function startDraw(event: PointerEvent, index: number) {
  if (!drawMode.value || busy.value || applied.value) return;
  const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
  drag = { x: (event.clientX - rect.left) / rect.width, y: (event.clientY - rect.top) / rect.height, index };
  (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
}
function finishDraw(event: PointerEvent, index: number) {
  if (!drag || drag.index !== index || busy.value || applied.value) return;
  const rect = (event.currentTarget as HTMLElement).getBoundingClientRect(), source = sources.value[index];
  const x = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width)), y = Math.max(0, Math.min(1, (event.clientY - rect.top) / rect.height));
  const box = { x: Math.min(x, drag.x) * source.width, y: Math.min(y, drag.y) * source.height, width: Math.abs(x - drag.x) * source.width, height: Math.abs(y - drag.y) * source.height };
  drag = undefined;
  if (box.width > 24 && box.height > 24) void recognize({ box, fileIndex: index });
}
onUnmounted(() => { cancel(); clearSources(); clearExport(); });
</script>

<style scoped>
.level-import-option { display:flex; align-items:center; flex-wrap:wrap; gap:10px; margin:16px 0; font-size:.8rem; font-weight:600; }
.level-import-option select { min-width:150px; font-weight:400; }
.level-import-option select:disabled { opacity:.6; }
.export-order { padding:20px 24px; overflow:auto; min-height:0; }.export-actions { display:flex; justify-content:flex-end; padding:14px 24px; border-top:1px solid var(--import-border); flex-shrink:0; }
@media (max-width:600px) { .export-order { padding:12px; } }
.import-dialog { --import-border:rgba(var(--v-theme-on-surface),.13); max-height:94dvh; display:flex; flex-direction:column; overflow:hidden; border-radius:22px!important; background:rgb(var(--v-theme-surface)); }
.export-toolbar { display:flex; align-items:center; justify-content:flex-end; gap:16px; margin:12px 0 20px; }.export-toolbar p { font-size:.78rem; opacity:.7; }.export-preview { overflow:auto; padding:20px; background:#e7e4df; }.export-preview figure { margin:0 0 20px; }.export-preview img { width:100%; display:block; box-shadow:0 3px 16px #0002; }.export-preview figcaption { padding:16px 0; text-align:center; }
.modal-heading { display:flex; align-items:center; gap:14px; padding:22px 26px 18px; flex-shrink:0; border-bottom:1px solid var(--import-border); }
.modal-heading h2 { font-size:1.2rem; font-weight:700; letter-spacing:.03em; }.modal-heading p { font-size:.8rem; opacity:.65; margin:5px 0 0; }.heading-close { margin-left:auto; flex-shrink:0; }
.heading-mark { display:grid; place-items:center; width:46px; height:46px; border-radius:14px; background:rgba(var(--v-theme-primary),.09); color:rgb(var(--v-theme-primary)); flex-shrink:0; }
.import-content { container-type:inline-size; overflow:auto; min-height:0; flex:1; padding:22px 26px; background:rgba(var(--v-theme-on-surface),.025); }
.upload-area { position:relative; display:flex; flex-direction:column; align-items:center; gap:16px; padding:32px 20px; border:1.5px dashed rgba(var(--v-theme-primary),.35); border-radius:16px; background:rgb(var(--v-theme-surface)); text-align:center; transition:background .15s; }
.upload-area.compact { flex-direction:row; justify-content:space-between; padding:14px 18px; text-align:left; }.upload-area.dragging { background:rgba(var(--v-theme-primary),.1); border-style:solid; }
.upload-copy strong { font-size:.95rem; }.upload-copy p { margin:4px 0 0; font-size:.75rem; opacity:.65; }.file-input { position:absolute; width:1px; height:1px; opacity:0; overflow:hidden; }.upload-area:focus-within { outline:2px solid rgba(var(--v-theme-primary),.4); outline-offset:3px; }
.privacy-note { text-align:center; margin:16px auto 4px; max-width:650px; font-size:.8rem; opacity:.65; line-height:1.8; }.processing-state { padding:16px 0; }.processing-state p { margin-top:8px; font-size:.8rem; }.import-alert { margin-top:12px; }
.overview-toolbar { display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:12px; margin:24px 0 10px; }.overview-toolbar h3 { font-size:1rem; }.overview-toolbar p { font-size:.75rem; opacity:.65; margin:4px 0; }.review-filter { display:flex; align-items:center; gap:6px; font-size:.75rem; cursor:pointer; }
.source-group { margin-top:18px; }.source-group-heading { display:flex; align-items:center; gap:10px; margin-bottom:12px; }.source-group-heading>img { width:36px; height:42px; object-fit:cover; border-radius:6px; border:1px solid var(--import-border); }.source-group-heading>div { display:flex; flex-direction:column; min-width:0; }.source-group-heading strong { font-size:.83rem; }.source-group-heading div>span { font-size:.7rem; opacity:.55; max-width:300px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }.source-count { margin-left:auto; font-size:.75rem; white-space:nowrap; opacity:.65; }
.result-grid { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:12px; }
@container (min-width:640px) { .result-grid { grid-template-columns:repeat(3,minmax(0,1fr)); } }
@container (min-width:820px) { .result-grid { grid-template-columns:repeat(4,minmax(0,1fr)); } }
@container (min-width:1160px) { .result-grid { grid-template-columns:repeat(6,minmax(0,1fr)); } }
.result-card { position:relative; border:1px solid var(--import-border); border-radius:14px; background:rgb(var(--v-theme-surface)); padding:14px 12px 12px; min-width:0; }.result-card.unresolved { border-color:#c7a36a; }
.card-pair { display:flex; align-items:center; justify-content:center; gap:5px; margin-bottom:10px; }.card-pair figure { margin:0; text-align:center; }.card-pair img,.missing-icon { display:block; width:64px; height:82px; object-fit:contain; }.missing-icon { display:grid; place-items:center; font-size:2rem; color:#a89d8d; background:rgba(var(--v-theme-on-surface),.04); border-radius:8px; }.card-pair figcaption { margin-top:4px; font-size:.62rem; opacity:.55; }.pair-arrow { opacity:.3; }.card-number { position:absolute; top:5px; left:8px; font-size:.6rem; opacity:.45; }
.card-icon-button { position:relative; display:block; border:1px solid var(--import-border); border-radius:8px; padding:0 3px; transition:border-color .15s; }.card-icon-button:hover { border-color:rgb(var(--v-theme-primary)); }.card-icon-button:focus-visible { outline:3px solid rgb(var(--v-theme-primary)); outline-offset:2px; }.card-icon-button:disabled { opacity:.7; }.icon-edit-mark { position:absolute; bottom:2px; right:2px; display:grid; place-items:center; width:20px; height:20px; border-radius:50%; background:rgb(var(--v-theme-primary)); color:white; border:2px solid rgb(var(--v-theme-surface)); }
.inline-fields { display:grid; grid-template-columns:minmax(0,.75fr) minmax(0,1.25fr); gap:8px; }.inline-fields label { font-size:.67rem; opacity:.9; }.inline-fields input,.inline-fields select { width:100%; min-width:0; font-size:.8rem; padding:7px 5px; margin-top:3px; }.inline-fields input { font-weight:600; font-variant-numeric:tabular-nums; }.inline-fields select { appearance:auto; }.inline-fields select.unknown { color:#896124; background:#d8a64712; }
.card-warning { color:#9a6313; font-size:.65rem; margin-top:6px; }.empty-group { padding:20px; text-align:center; font-size:.8rem; opacity:.65; }
.import-footer { flex-shrink:0; padding:14px 26px 18px; border-top:1px solid var(--import-border); }.uncaps-note { font-size:.72rem; line-height:1.7; opacity:.7; margin:0 0 12px; }.footer-actions { display:flex; align-items:center; gap:10px; flex-wrap:wrap; }.import-summary { margin-right:auto; font-size:.8rem; }.applied-message { font-size:.8rem; color:rgb(var(--v-theme-primary)); margin-bottom:8px; }
.help { font-size:.75rem; color:rgb(var(--v-theme-on-surface)); opacity:.7; margin:6px 0; line-height:1.6; }
.image-panel { display:flex; flex-direction:column; min-height:0; padding:16px 20px 20px; height:70dvh; }
.image-toolbar { display:flex; align-items:center; gap:8px; flex-wrap:wrap; }.image-toolbar select { flex:1; min-width:0; width:100px; }
.source-viewport { overflow:auto; flex:1; min-height:140px; background:rgba(var(--v-theme-on-surface),.06); border-radius:12px; }.source-frame { position:relative; user-select:none; }.source-frame.drawing { touch-action:none; cursor:crosshair; }.source-frame>img { width:100%; display:block; }.source-frame svg { position:absolute; inset:0; width:100%; height:100%; }.source-frame g { cursor:pointer; }.source-frame.drawing g { pointer-events:none; }
rect { fill:transparent; stroke:#228a52; stroke-width:2px; vector-effect:non-scaling-stroke; }rect.uncertain { stroke:#d58813; }rect.active { stroke:#00b7ff; stroke-width:5px; fill:#00b7ff15; }svg text { fill:white; stroke:#222; paint-order:stroke; stroke-width:3px; font-weight:bold; pointer-events:none; }
input[type=number],select { display:block; border:1px solid var(--import-border); border-radius:8px; padding:9px; background:rgb(var(--v-theme-surface)); color:rgb(var(--v-theme-on-surface)); }input:focus-visible,select:focus-visible { outline:2px solid rgb(var(--v-theme-primary)); outline-offset:1px; }.source-status { padding:8px 20px; flex-shrink:0; }
@media(max-width:760px) {
 .import-dialog { max-height:95dvh; border-radius:16px!important; }.modal-heading { padding:14px; gap:10px; }.modal-heading h2 { font-size:1rem; }.modal-heading p { font-size:.7rem; }.heading-mark { display:none; }.heading-close { width:32px; height:32px; }
 .import-content { padding:12px; }.upload-area.compact { flex-wrap:wrap; padding:12px; gap:8px; }.upload-area.compact .upload-copy { flex:1; }.upload-area.compact .upload-copy p { display:none; }.upload-area.compact .upload-copy strong { font-size:.72rem; }.upload-area.compact .v-btn { font-size:.7rem; padding:0 10px; }.upload-copy strong { font-size:.85rem; }.upload-copy p { font-size:.68rem; }.overview-toolbar { margin-top:18px; }.source-group-heading { gap:6px; }.source-group-heading>img { display:none; }.source-group-heading div>span { max-width:115px; }.source-count { font-size:.65rem; }
 .result-grid { grid-template-columns:repeat(auto-fill,minmax(240px,1fr)); gap:8px; }.result-card { display:flex; flex-wrap:wrap; align-items:center; gap:10px; padding:12px 9px 10px; }.card-pair { margin:0; gap:5px; }.card-pair img,.missing-icon { width:60px; height:78px; }.pair-arrow { font-size:.7rem; }.inline-fields { flex:1; min-width:80px; grid-template-columns:1fr; gap:5px; }.inline-fields input,.inline-fields select { padding:5px; font-size:.75rem; }.card-warning { width:100%; margin:0; }
 .import-footer { padding:10px 14px 12px; }.uncaps-note { font-size:.65rem; line-height:1.6; margin-bottom:8px; }.footer-actions { gap:6px; justify-content:flex-end; }.import-summary { width:100%; font-size:.72rem; }.image-panel { padding:10px 12px 12px; }
}
</style>
