<template>
  <v-container class="hand-workspace pa-2">
    <v-row class="ma-0">
      <v-col cols="12" class="pa-2">
        <!-- ヘッダー -->
        <div class="header-section">
          <div class="title-container">
            <div><h2 class="page-title">{{ $t('handCollection.title') }}</h2><p class="page-description">{{ t('handCollection.workspaceHelp') }}</p></div>
          </div>

        <section class="saved-sets mb-3" :aria-label="t('handCollection.setName')">
          <div class="saved-sets-actions">
            <v-text-field id="inline-set-name" v-model="inlineSetName" :label="t('handCollection.setName')" :disabled="saving || saveDialog || deleteDialog || handCollectionStore.loadFailed || handCollectionStore.hasConflict" variant="outlined" density="compact" hide-details @keydown.enter.prevent="saveHandCollection" />
            <v-btn size="small" color="primary" :disabled="saving || !inlineSetName.trim() || handCollectionStore.loadFailed || handCollectionStore.hasConflict" @click="saveHandCollection">{{ t('handCollection.save') }}</v-btn>
            <v-btn size="small" color="error" variant="outlined" :disabled="saving || !activeSet || handCollectionStore.loadFailed || handCollectionStore.hasConflict" @click="openDeleteDialog">{{ t('handCollection.deleteSet') }}</v-btn>
          </div>
        </section>

        <v-dialog v-model="saveDialog" max-width="420" :persistent="saveSubmitting || saving">
          <v-card>
            <v-card-title>{{ t('handCollection.save') }}</v-card-title>
            <v-card-text>
              <p>{{ t('handCollection.saveSlotConfirm', { slot: t('handCollection.slotLabel', { number: saveContextSlot }), name: saveNewName.trim() }) }}</p>
              <v-alert v-if="!saving && !saveContextValid" type="warning" variant="tonal" class="mt-2">{{ t('handCollection.confirmationChanged') }}</v-alert>
            </v-card-text>
            <v-card-actions>
              <v-btn :disabled="saveSubmitting || saving" @click="saveDialog = false">{{ t('common.cancel') }}</v-btn>
              <v-btn color="primary" :loading="saveSubmitting || saving" :disabled="saveSubmitting || saving || !saveContextValid || !saveNewName.trim()" @click="submitSave">{{ t('common.save') }}</v-btn>
            </v-card-actions>
          </v-card>
        </v-dialog>

        <v-dialog v-model="deleteDialog" max-width="420" :persistent="deleteSubmitting || saving">
          <v-card>
            <v-card-title>{{ t('handCollection.deleteSet') }}</v-card-title>
            <v-card-text>
              <p>{{ t('handCollection.deleteSlotConfirm', { slot: t('handCollection.slotLabel', { number: deleteContextSlot }), name: deleteContextName }) }}</p>
              <v-alert v-if="!saving && !deleteContextValid" type="warning" variant="tonal" class="mt-2">{{ t('handCollection.confirmationChanged') }}</v-alert>
              <p v-if="hasUnsavedChanges" class="mt-2">{{ t('handCollection.deleteDirtyWarning') }}</p>
            </v-card-text>
            <v-card-actions>
              <v-btn :disabled="deleteSubmitting || saving" @click="deleteDialog = false">{{ t('common.cancel') }}</v-btn>
              <v-btn color="error" :loading="deleteSubmitting || saving" :disabled="deleteSubmitting || saving || !deleteContextValid" @click="submitDelete">{{ t('handCollection.deleteSet') }}</v-btn>
            </v-card-actions>
          </v-card>
        </v-dialog>
        </div>

        <v-alert v-if="storageWarning" type="warning" variant="tonal" class="mb-3">
          {{ storageWarning }}
          <v-btn
            v-if="handCollectionStore.loadFailed || handCollectionStore.hasConflict"
            class="mt-2" size="small" :disabled="saving || (saving)" @click="reloadSavedCollection"
          >{{ $t('handCollection.reloadSaved') }}</v-btn>
        </v-alert>

        <section class="transfer-strip" :aria-label="t('handCollection.transferTitle')">
          <div><h3>{{ t('handCollection.transferTitle') }}</h3><p>{{ t('handCollection.transferHelp') }}</p></div>
          <div class="transfer-actions"><HandScreenshotImport /><v-btn :disabled="saving" variant="text" prepend-icon="mdi-code-json" @click="openDataModal">{{ t('handCollection.jsonManagement') }}</v-btn></div>
        </section>

        <section class="card-workbench" :aria-label="t('handCollection.cardList')">
          <header class="workbench-heading"><h3>{{ t('handCollection.cardList') }}</h3><span class="display-count">{{ t('handCollection.displayCount', { count: filteredCharacters.length }) }}</span></header>
          <div class="list-search-row">
            <v-text-field v-model="cardSearch" :disabled="saving" :label="t('handCollection.searchCards')" prepend-inner-icon="mdi-magnify" variant="outlined" density="compact" clearable hide-details />
            <v-btn :disabled="saving" variant="outlined" prepend-icon="mdi-filter-outline" @click="showFilterModal = true">{{ t('handCollection.filter') }}</v-btn>
          </div>
          <div class="list-options-row">
            <v-checkbox v-model="ownedOnly" :disabled="saving" :label="t('handCollection.ownedOnlyShort')" color="primary" density="compact" hide-details />
            <div class="list-sort"><label for="card-sort">{{ t('handCollection.sortCards') }}</label><select id="card-sort" v-model="sortKey" :disabled="saving"><option v-for="option in sortOptions" :key="option.value" :value="option.value">{{ option.label }}</option></select><v-btn size="small" variant="text" :disabled="saving || sortKey === 'default'" :icon="sortOrder === 'asc' ? 'mdi-sort-ascending' : 'mdi-sort-descending'" :aria-label="t(sortOrder === 'asc' ? 'handCollection.sortAscending' : 'handCollection.sortDescending')" @click="sortOrder = sortOrder === 'asc' ? 'desc' : 'asc'" /></div>
          </div>
          <div v-if="hasActiveFilters" class="active-filter-summary"><span>{{ activeFilterSummary }}</span><v-btn :disabled="saving" size="small" variant="text" @click="resetFilters">{{ t('handCollection.resetFilters') }}</v-btn></div>
          <details class="bulk-disclosure">
            <summary><span>{{ t('handCollection.bulkSettings') }}</span><small>{{ t('handCollection.bulkTargetCount', { count: filteredCharacters.length }) }}</small><v-icon size="20" aria-hidden="true">mdi-chevron-down</v-icon></summary>
            <div class="bulk-content">
            <div class="bulk-controls">
              <div class="control-group" data-bulk-kind="ownership">
                <div class="control-label">{{ $t('handCollection.owned') }}</div>
                <div class="control-fields">
                  <v-btn :disabled="saving || !filteredCharacters.length" @click="applyBulkOwnership(true)" color="success" size="small">{{ $t('handCollection.ownershipSetting') }}</v-btn>
                  <v-btn :disabled="saving || !filteredCharacters.length" @click="applyBulkOwnership(false)" color="grey" variant="outlined" size="small">{{ $t('handCollection.ownershipCancel') }}</v-btn>
                </div>
              </div>
              <!-- レベル設定 -->
              <div class="control-group" data-bulk-kind="level">
                <label for="bulk-level" class="control-label">{{ $t('handCollection.level') }}</label>
                <div class="control-fields">
                  <v-text-field :disabled="saving || !filteredCharacters.length"
                    id="bulk-level"
                    type="number"
                    v-model="bulkLevel"
                    class="level-input"
                    hide-details
                    :min="0"
                    :max="getMaxLevel('SSR')"
                    variant="outlined"
                    density="compact"
                  />
                  <v-btn :disabled="saving || !filteredCharacters.length || !validBulkLevel" @click="applyBulkLevel" color="primary" size="small">{{ t('handCollection.bulkApply') }}</v-btn>
                </div>
              </div>
              
              <!-- 凸数設定 -->
              <div class="control-group" data-bulk-kind="totsu">
                <label for="bulk-totsu" class="control-label">{{ $t('handCollection.totsu') }}</label>
                <div class="control-fields">
                  <select :disabled="saving || !filteredCharacters.length" id="bulk-totsu" v-model.number="bulkTotsu" class="native-select">
                    <option v-for="option in totsuOptions" :key="option.value" :value="option.value">{{ option.title }}</option>
                  </select>
                  <v-btn :disabled="saving || !filteredCharacters.length" @click="applyBulkTotsu" color="primary" size="small">{{ t('handCollection.bulkApply') }}</v-btn>
                </div>
              </div>
            </div>

            </div>
          </details>

        <!-- カード一覧テーブル -->
        <div v-if="loading" class="text-center">
          <v-progress-circular indeterminate />
          <p>Loading...</p>
        </div>

        <div v-else-if="filteredCharacters.length === 0" class="text-center py-4">
          <v-icon size="48" color="grey">mdi-cards-outline</v-icon>
          <div class="mt-2 text-grey">{{ $t('handCollection.noMatchingCards') }}</div>
          <v-btn :disabled="saving" @click="resetFilters" class="mt-2" color="primary" size="small">{{ $t('handCollection.resetFilters') }}</v-btn>
        </div>
        
        <div v-else>
          <!-- 手動テーブル -->
          <div class="manual-table">
            <!-- ヘッダー -->
            <div class="table-header">
              <div class="header-cell character-col">{{ $t('handCollection.character') }}</div>
              <div class="header-cell checkbox-col sortable-header" @click="handleSort('isOwned')">
                {{ $t('handCollection.owned') }}
                <v-icon size="16" class="sort-icon">{{ getSortIcon('isOwned') }}</v-icon>
              </div>
              <div class="header-cell totsu-col sortable-header" @click="handleSort('totsu')">
                {{ $t('handCollection.totsu') }}
                <v-icon size="16" class="sort-icon">{{ getSortIcon('totsu') }}</v-icon>
              </div>
              <div class="header-cell level-col sortable-header" @click="handleSort('level')">
                Lv
                <v-icon size="16" class="sort-icon">{{ getSortIcon('level') }}</v-icon>
              </div>
              <div class="header-cell rare-col sortable-header" v-if="windowWidth > 600" @click="handleSort('rare')">
                {{ $t('handCollection.rarity') }}
                <v-icon size="16" class="sort-icon">{{ getSortIcon('rare') }}</v-icon>
              </div>
              <div class="header-cell costume-col sortable-header" v-if="windowWidth > 600" @click="handleSort('costume')">
                {{ $t('handCollection.costume') }}
                <v-icon size="16" class="sort-icon">{{ getSortIcon('costume') }}</v-icon>
              </div>
            </div>
            
            <!-- データ行 -->
            <div 
              v-for="(item, index) in filteredCharacters" 
              :key="item.name"
              class="table-row"
              :data-card-name="item.name"
              :class="{ 'even-row': index % 2 === 0 }"
            >
              <!-- キャラクター画像 -->
              <div class="data-cell character-col">
                <LazyCharacterImage
                  :src="item.imgUrl || defaultImg"
                  :alt="item.name"
                  class="character-image"
                />
              </div>
              
              <!-- 所持チェックボックス -->
              <div class="data-cell checkbox-col">
                <v-checkbox :disabled="saving" 
                  :model-value="item.isOwned"
                  @update:model-value="updateOwnership(item.name, $event ?? false)"
                  hide-details
                  color="success"
                  density="compact"
                />
              </div>
              
              <!-- 凸数 -->
              <div class="data-cell totsu-col">
                <select
                  class="table-select"
                  :value="item.totsu ?? 0"
                  :disabled="saving || (!item.isOwned)"
                  @change="handleTableTotsuChange(item.name, $event)"
                >
                  <option v-for="option in totsuOptions" :key="option.value" :value="option.value">{{ option.title }}</option>
                </select>
              </div>
              
              <!-- レベル入力 -->
              <div class="data-cell level-col">
                <v-text-field 
                  type="number" 
                  :model-value="item.level"
                  @update:model-value="updateLevel(item.name, $event)"
                  class="level-input" 
                  hide-details
                  variant="outlined"
                  density="compact"
                  :min="0" 
                  :max="getMaxLevel(item.rare)"
                  :disabled="saving || (!item.isOwned)"
                />
              </div>
              
              <!-- レア度 -->
              <div class="data-cell rare-col" v-if="windowWidth > 600">
                {{ item.rare }}
              </div>
              
              <!-- 衣装 -->
              <div class="data-cell costume-col" v-if="windowWidth > 600">
                {{ localizeCostumeName(item, locale) }}
              </div>
            </div>
          </div>
          
        </div>

        </section>

        <!-- データ管理モーダル -->
        <v-dialog v-model="dataModal" max-width="800px">
          <v-card class="data-management-card">
            <v-card-title>{{ $t('handCollection.dataManagement') }}</v-card-title>
            <v-card-text>
              <section class="backup-section">
                <h3>{{ t('handCollection.backupHeading') }}</h3>
                <p class="data-help">{{ t('handCollection.backupHelp') }}</p>
                <div class="json-editor mt-3">
                  <v-textarea :model-value="backupText" readonly variant="outlined" rows="5" max-rows="8" auto-grow hide-details :label="t('handCollection.backupJson')" />
                  <v-btn :disabled="saving || !backupText" class="json-copy-button" icon="mdi-content-copy" size="small" variant="text" color="primary" :aria-label="t('handCollection.copy')" :title="t('handCollection.copy')" @click="copyToClipboard" />
                </div>
                <v-btn :disabled="saving || !backupText" color="primary" prepend-icon="mdi-download" size="small" class="mt-3" @click="downloadSetsBackupFile">{{ t('handCollection.downloadAllSets') }}</v-btn>
              </section>
              <section class="restore-section">
                <h3>{{ t('handCollection.restoreHeading') }}</h3>
                <p class="data-help">{{ t('handCollection.restoreHelp') }}</p>
                <v-textarea :disabled="saving" v-model="dataText" variant="outlined" rows="4" max-rows="8" auto-grow hide-details class="mt-3" :label="t('handCollection.importJson')" />
                <div class="data-actions mt-3">
                  <v-btn :disabled="saving" variant="outlined" prepend-icon="mdi-upload" size="small" @click="openBackupFilePicker">{{ t('handCollection.importJsonFile') }}</v-btn>
                  <v-btn :disabled="saving || !dataText.trim()" color="success" prepend-icon="mdi-database-import" size="small" @click="importFromText">{{ t('handCollection.prepareImport') }}</v-btn>
                </div>
              </section>
              <section v-if="importRows.length" class="import-assignment mt-4" data-testid="json-assignment">
                <h3>{{ t('handCollection.assignmentHeading') }}</h3>
                <p class="data-help">{{ t('handCollection.assignmentHelp') }}</p>
                <div v-for="(row, index) in importRows" :key="index" class="assignment-row">
                  <div class="assignment-source"><strong>{{ row.name }}</strong><small>{{ t('handCollection.assignmentCardCount', { count: Object.keys(row.data).length }) }}</small></div>
                  <select v-model="row.destination" :aria-label="t('handCollection.assignmentDestination', { name: row.name })" :disabled="saving || importSubmitting || !importContextValid" class="native-select">
                    <option :value="null" disabled>{{ t('handCollection.chooseDestination') }}</option>
                    <option :value="0">{{ t('handCollection.skipImport') }}</option>
                    <option v-for="number in 5" :key="number" :value="number" :disabled="importRows.some(other => other !== row && other.destination === number)">{{ t('handCollection.slotLabel', { number }) }} — {{ handCollectionStore.slots[number - 1]?.savedSet?.name || t('handCollection.emptySlot') }}</option>
                  </select>
                </div>
                <v-alert v-if="!importContextValid" type="warning" variant="tonal" class="mt-2">{{ t('handCollection.confirmationChanged') }}</v-alert>
                <v-btn :disabled="!canConfirmImport || saving || importSubmitting" color="success" size="small" class="mt-3" @click="importConfirmDialog = true">{{ t('handCollection.confirmAssignment') }}</v-btn>
              </section>
              <v-alert v-if="importIssues.length" type="warning" variant="tonal" role="alert" data-testid="import-review">
                <strong>{{ t('handCollection.importReviewTitle') }}</strong>
                <p>{{ t('handCollection.assignmentInvalidHelp') }}</p>
                <ul>
                  <li v-for="(issue, index) in importIssues" :key="index">
                    {{ importCardLabel(issue.cardName) }} — {{ t('handCollection.importReviewValue', {
                      field: t(`handCollection.${issue.field}`), value: issue.value, max: issue.max
                    }) }}
                  </li>
                </ul>
              </v-alert>
              <input
                ref="backupFileInput"
                type="file"
                :disabled="saving"
                accept="application/json,.json"
                class="backup-file-input"
                @change="handleBackupFileSelected"
              />
            </v-card-text>
            <v-card-actions><v-spacer /><v-btn @click="closeDataModal">{{ t('handCollection.close') }}</v-btn></v-card-actions>
          </v-card>
        </v-dialog>
        
        <v-dialog v-model="importConfirmDialog" max-width="480" :persistent="saving || importSubmitting">
          <v-card>
            <v-card-title>{{ t('handCollection.confirmAssignment') }}</v-card-title>
            <v-card-text>
              <p>{{ t('handCollection.assignmentConfirmHelp') }}</p>
              <ul class="assignment-confirm-list"><li v-for="row in selectedImportRows" :key="row.destination ?? 0">{{ row.name }} → {{ t('handCollection.slotLabel', { number: row.destination }) }} — {{ handCollectionStore.slots[row.destination! - 1]?.savedSet?.name || t('handCollection.emptySlot') }}</li></ul>
              <p v-if="selectedImportRows.some(row => row.destination === selectedSlot)" class="mt-3">{{ t('handCollection.assignmentCurrentWarning') }}</p>
              <v-alert v-if="!importContextValid" type="warning" variant="tonal" class="mt-2">{{ t('handCollection.confirmationChanged') }}</v-alert>
            </v-card-text>
            <v-card-actions><v-btn :disabled="saving || importSubmitting" @click="importConfirmDialog = false">{{ t('common.cancel') }}</v-btn><v-btn color="success" :loading="saving || importSubmitting" :disabled="saving || importSubmitting || !canConfirmImport" @click="submitAssignedImport">{{ t('handCollection.import') }}</v-btn></v-card-actions>
          </v-card>
        </v-dialog>

        <v-snackbar
          v-model="snackbar.show"
          :color="snackbar.color"
          :timeout="3000"
        >
          {{ snackbar.text }}
        </v-snackbar>
        
        <!-- FilterModal -->
        <v-dialog v-model="showFilterModal" class="hand-filter-dialog" width="calc(100vw - 32px)" max-width="920" persistent>
          <FilterModal
            class="hand-filter-content"
            :embedded="false"
            @close="showFilterModal = false"
            @filter-applied="handleFilterApplied"
          />
        </v-dialog>
      </v-col>
    </v-row>
  </v-container>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted, defineAsyncComponent } from 'vue';
const HandScreenshotImport = defineAsyncComponent(() => import('@/components/HandScreenshotImport.vue'));
import { useHandCollectionStore, type HandCard, type HandCollection } from '@/store/handCollection';
import { useCharacterStore } from '@/store/characters';
import { useFilterdStore } from '@/store/filterd';
import { storeToRefs } from 'pinia';
import defaultImg from '@/assets/img/default.webp';
import { hydrateCharacterImageUrls } from '@/utils/characterAssets';
import FilterModal from '@/components/FilterModal.vue';
import LazyCharacterImage from '@/components/LazyCharacterImage.vue';
import charactersInfo from '@/assets/characters_info.json';
import { useI18n } from 'vue-i18n';
import { getInputMaxLevel } from '@/constants/levels';
import { clampTotsuCount } from '@/utils/totsu';
import { localizeCharacterName, localizeCostumeName, localizeGameText } from '@/utils/localizedDisplay';
import { parseHandCollectionImport, type HandImportIssue } from '@/utils/handCollectionImport';
import { requestPersistentStorage } from '@/storage/persistentStorage';
import { parseHandCollectionSetsBackup } from '@/storage/handCollectionStorage';
import { defaultSelectedEffectValues, defaultSelectedBuddyBonusEffectValues } from '@/store/searchResult';

// Stores and i18n
const { t, locale } = useI18n();
const handCollectionStore = useHandCollectionStore();
const characterStore = useCharacterStore();
const filterdStore = useFilterdStore();
const { characters } = storeToRefs(characterStore);

// UI State
const loading = ref(true);
const showFilterModal = ref(false);
const ownedOnly = ref(false);
const cardSearch = ref('');
function readDetailedFilterState() {
  return {
    tempSelectedRare: [...filterdStore.tempSelectedRare], tempSelectedCharacters: [...filterdStore.tempSelectedCharacters],
    tempSelectedAttr: [...filterdStore.tempSelectedAttr], tempSelectedType: [...filterdStore.tempSelectedType],
    tempSelectedEffects: [...filterdStore.tempSelectedEffects], tempSelectedBuddyBonusEffects: [...filterdStore.tempSelectedBuddyBonusEffects],
    tempCostumeSearch: filterdStore.tempCostumeSearch,
  };
}
const appliedFilterState = ref<ReturnType<typeof readDetailedFilterState> | null>(null);
const hasActiveFilters = computed(() => !!cardSearch.value?.trim() || ownedOnly.value || appliedFilterState.value !== null || characters.value.some(card => !card.visible));
const activeFilterSummary = computed(() => {
  const labels: string[] = [];
  if (cardSearch.value?.trim()) labels.push(cardSearch.value.trim());
  if (ownedOnly.value) labels.push(t('handCollection.ownedOnlyShort'));
  if (appliedFilterState.value !== null || characters.value.some(card => !card.visible)) {
    const filters = appliedFilterState.value ?? filterdStore;
    const differs = (values: string[], defaults: string[]) => values.length !== defaults.length || values.some(value => !defaults.includes(value));
    const effectText = (values: string[]) => values.map(value => localizeGameText(value, locale.value)).slice(0, 2).join(', ') + (values.length > 2 ? ` +${values.length - 2}` : '') || t('handCollection.noConditionSelection');
    if (differs(filters.tempSelectedEffects, defaultSelectedEffectValues)) labels.push(t('handCollection.effectConditions', { value: effectText(filters.tempSelectedEffects) }));
    if (differs(filters.tempSelectedBuddyBonusEffects, defaultSelectedBuddyBonusEffectValues)) labels.push(t('handCollection.buddyConditions', { value: effectText(filters.tempSelectedBuddyBonusEffects) }));
    const selected = [
      ...(filters.tempSelectedRare.length < 3 ? filters.tempSelectedRare : []),
      ...(filters.tempSelectedCharacters.length < new Set(characters.value.map(card => card.chara)).size ? filters.tempSelectedCharacters.map(value => localizeCharacterName(value, locale.value)) : []),
      ...(filters.tempSelectedAttr.length < 4 ? filters.tempSelectedAttr.map(value => localizeGameText(value, locale.value)) : []),
      ...(filters.tempSelectedType.length < 3 ? filters.tempSelectedType.map(value => localizeGameText(value, locale.value)) : []),
      filters.tempCostumeSearch,
    ].filter(Boolean);
    labels.push(...selected.length ? selected : [t('handCollection.filter')]);
  }
  return t('handCollection.activeFilterLabel', { value: labels.slice(0, 3).join(' / ') + (labels.length > 3 ? ` +${labels.length - 3}` : '') });
});
const bulkLevel = ref(getInputMaxLevel('SSR'));
const validBulkLevel = computed(() => String(bulkLevel.value ?? '').trim() !== '' && Number.isInteger(Number(bulkLevel.value)));
const bulkTotsu = ref(4);
const windowWidth = ref(window.innerWidth);
const { saving, hasUnsavedChanges, selectedSlot, activeSet } = storeToRefs(handCollectionStore);
const saveDialog = ref(false);
const saveNewName = ref('');
const inlineSetName = computed({
  get: () => handCollectionStore.nameDraft ?? activeSet.value?.name ?? '',
  set: (value: string) => { handCollectionStore.nameDraft = value; },
});
const saveSubmitting = ref(false);
const deleteDialog = ref(false);
const deleteSubmitting = ref(false);
const saveContextSlot = ref(1);
const saveContextRevision = ref(0);
const deleteContextSlot = ref(1);
const deleteContextRevision = ref(0);
const deleteContextName = ref('');
const saveContextValid = computed(() => selectedSlot.value === saveContextSlot.value && handCollectionStore.collectionContextRevision === saveContextRevision.value);
const deleteContextValid = computed(() => selectedSlot.value === deleteContextSlot.value && handCollectionStore.collectionContextRevision === deleteContextRevision.value);

function openDeleteDialog() {
  if (saving.value || deleteSubmitting.value || !activeSet.value) return;
  deleteContextSlot.value = selectedSlot.value;
  deleteContextRevision.value = handCollectionStore.collectionContextRevision;
  deleteContextName.value = activeSet.value.name;
  deleteDialog.value = true;
}

async function submitDelete() {
  if (saving.value || deleteSubmitting.value || !deleteDialog.value || !deleteContextValid.value) return;
  deleteSubmitting.value = true;
  try {
    await handCollectionStore.deleteSlot(deleteContextSlot.value, { deleteConfirmed: true, discardConfirmed: true });
    deleteDialog.value = false;
    showSnackbar(t('handCollection.deleteSetSuccess'));
  } catch (error) {
    console.error('Failed to delete hand collection slot:', error);
    showSnackbar(storageWarning.value || t('handCollection.saveError'), 'error');
  } finally {
    deleteSubmitting.value = false;
  }
}

const storageWarning = computed(() => {
  if (handCollectionStore.loadFailed) return t('handCollection.loadError');
  if (handCollectionStore.hasConflict) return t('handCollection.saveConflict');
  if (handCollectionStore.saveFailed) return t('handCollection.saveError');
  if (handCollectionStore.draftFailed && hasUnsavedChanges.value) return t('handCollection.draftError');
  return '';
});
const totsuOptions = [0, 1, 2, 3, 4].map(value => ({
  title: value.toString(),
  value,
}));

// ソート機能
const sortKey = ref<string>('default');
const sortOrder = ref<'asc' | 'desc'>('asc');
const sortOptions = computed(() => [
  { value: 'default', label: t('handCollection.sortDefault') },
  { value: 'isOwned', label: t('handCollection.owned') },
  { value: 'totsu', label: t('handCollection.totsu') },
  { value: 'level', label: t('handCollection.level') },
  { value: 'rare', label: t('handCollection.rarity') },
  { value: 'costume', label: t('handCollection.costume') },
]);


// データ管理用
const dataModal = ref(false);
const dataText = ref('');
const backupText = ref('');
function refreshBackupText() {
  backupText.value = handCollectionStore.createSetsBackup(inlineSetName.value.trim() || t('handCollection.unsavedSet'));
}
const importIssues = ref<HandImportIssue[]>([]);
type ImportAssignmentRow = { name: string; data: HandCollection; destination: number | null };
const importRows = ref<ImportAssignmentRow[]>([]);
const importStageRevision = ref(-1);
const importConfirmDialog = ref(false);
const importSubmitting = ref(false);
const importContextValid = computed(() => importStageRevision.value === handCollectionStore.collectionContextRevision);
const selectedImportRows = computed(() => importRows.value.filter(row => row.destination !== null && row.destination > 0));
const canConfirmImport = computed(() => importContextValid.value && importRows.value.length > 0 && importRows.value.every(row => row.destination !== null) && selectedImportRows.value.length > 0 && new Set(selectedImportRows.value.map(row => row.destination)).size === selectedImportRows.value.length && !handCollectionStore.loadFailed && !handCollectionStore.hasConflict);
watch(dataText, () => { importRows.value = []; importConfirmDialog.value = false; importIssues.value = []; }, { flush: 'sync' });
watch(() => handCollectionStore.collectionContextRevision, () => { importRows.value = []; importConfirmDialog.value = false; });
function importCardLabel(name: string) {
  const card = characters.value.find(card => card.name === name);
  return card ? `${localizeCharacterName(card.chara, locale.value)} / ${localizeCostumeName(card, locale.value)}` : name;
}
const backupFileInput = ref<HTMLInputElement | null>(null);
const snackbar = ref({
  show: false,
  text: '',
  color: 'success'
});

// キャラクター順序をキャッシュ化
const characterOrder = computed(() => 
  charactersInfo.map((info: any) => info.name_ja)
);

function getReadOnlyHandCard(cardName: string): HandCard {
  return handCollectionStore.peekHandCard(cardName) ?? {
    characterName: '',
    cardName,
    isOwned: false,
    level: 0,
    totsu: 0,
    isLimitBreak: false,
    isM3: false,
  };
}

// Computed Properties
const filteredCharacters = computed(() => {
  if (loading.value || !characters.value) {
    return [];
  }
  
  const order = characterOrder.value;
  
  const result = characters.value
    .filter(character => character.visible)
    .map(character => {
      const handCard = getReadOnlyHandCard(character.name);
      
      return {
        ...character,
        isOwned: handCard.isOwned,
        totsu: handCard.totsu,
        level: handCard.level
      };
    })
      .filter(character => !ownedOnly.value || character.isOwned)
      .filter(character => !cardSearch.value?.trim() || [character.name, localizeCharacterName(character.chara, locale.value), localizeCostumeName(character, locale.value)].join(' ').toLocaleLowerCase().includes(cardSearch.value.trim().toLocaleLowerCase()))
    .sort((a, b) => {
      // ソートキーに基づく並び替え
      if (sortKey.value === 'default') {
        // デフォルトソート: キャッシュされた順序でソート
        const indexA = order.indexOf(a.chara);
        const indexB = order.indexOf(b.chara);
        if (indexA === -1) return 1;
        if (indexB === -1) return -1;
        return indexA - indexB;
      } else {
        // カスタムソート
        let aValue: any, bValue: any;
        
        switch (sortKey.value) {
          case 'isOwned':
            aValue = a.isOwned ? 1 : 0;
            bValue = b.isOwned ? 1 : 0;
            break;
          case 'totsu':
            aValue = a.totsu;
            bValue = b.totsu;
            break;
          case 'level':
            aValue = a.level;
            bValue = b.level;
            break;
          case 'rare': {
            // SSR > SR > R の順序で数値化
            const rareOrder = { 'SSR': 3, 'SR': 2, 'R': 1 };
            aValue = rareOrder[a.rare as keyof typeof rareOrder] || 0;
            bValue = rareOrder[b.rare as keyof typeof rareOrder] || 0;
            break;
          }
          case 'costume':
            aValue = a.costume;
            bValue = b.costume;
            break;
          default:
            aValue = 0;
            bValue = 0;
        }
        
        // 文字列比較
        if (typeof aValue === 'string' && typeof bValue === 'string') {
          const comparison = aValue.localeCompare(bValue);
          return sortOrder.value === 'asc' ? comparison : -comparison;
        }
        
        // 数値比較
        if (aValue === bValue) {
          // 同じ値の場合はデフォルト順序で二次ソート
          const indexA = order.indexOf(a.chara);
          const indexB = order.indexOf(b.chara);
          return indexA - indexB;
        }
        
        return sortOrder.value === 'asc' ? aValue - bValue : bValue - aValue;
      }
    });
  
  return result;
});



// Methods
function getHandCard(cardName: string) {
  return getReadOnlyHandCard(cardName);
}

// ソート機能
function handleSort(key: string) {
  if (sortKey.value === key) {
    // 同じキーをクリックした場合は昇順/降順を切り替え
    sortOrder.value = sortOrder.value === 'asc' ? 'desc' : 'asc';
  } else {
    // 異なるキーをクリックした場合は新しいキーで昇順に設定
    sortKey.value = key;
    sortOrder.value = 'asc';
  }
}

function getSortIcon(key: string): string {
  if (sortKey.value !== key) {
    return 'mdi-sort';
  }
  return sortOrder.value === 'asc' ? 'mdi-sort-ascending' : 'mdi-sort-descending';
}

function updateOwnership(cardName: string, isOwned: boolean) {
  handCollectionStore.updateHandCard(cardName, { isOwned });
}

function updateLevel(cardName: string, level: string | number) {
  const numLevel = typeof level === 'string' ? parseInt(level) : level;
  if (isNaN(numLevel)) return;
  
  const character = characters.value.find(item => item.name === cardName);
  const maxLevel = getMaxLevel(character?.rare || 'R');
  const clampedLevel = Math.max(0, Math.min(numLevel, maxLevel));
  
  handCollectionStore.updateHandCard(cardName, { level: clampedLevel });
}

function updateTotsu(cardName: string, value: string | number | null) {
  handCollectionStore.updateHandCard(cardName, { totsu: clampTotsuCount(value) });
}

function handleTableTotsuChange(cardName: string, event: Event) {
  updateTotsu(cardName, (event.target as HTMLSelectElement)?.value ?? 0);
}

function getMaxLevel(rare: string): number {
  return getInputMaxLevel(rare);
}

// 保存機能
function saveHandCollection() {
  if (saving.value || saveSubmitting.value || saveDialog.value || !inlineSetName.value.trim()) return;
  saveContextSlot.value = selectedSlot.value;
  saveContextRevision.value = handCollectionStore.collectionContextRevision;
  saveNewName.value = inlineSetName.value;
  saveDialog.value = true;
}

async function submitSave() {
  if (saving.value || saveSubmitting.value || !saveDialog.value || !saveContextValid.value) return;
  if (!saveNewName.value.trim()) return;
  saveSubmitting.value = true;
  try {
    await handCollectionStore.saveSlot(saveContextSlot.value, saveNewName.value.trim(), { overwriteConfirmed: true });
    saveDialog.value = false;

    // 永続ストレージ要求の拒否や未対応は、通常の保存結果へ影響させない。
    void requestPersistentStorage();
    
    showSnackbar(t('handCollection.saveSuccess'));
  } catch (error) {
    console.error('保存エラー:', error);
    showSnackbar(storageWarning.value || t('handCollection.saveError'), 'error');
  } finally {
    saveSubmitting.value = false;
  }
}

function reloadSavedCollection() {
  if (hasUnsavedChanges.value && !window.confirm(t('handCollection.reloadConfirm'))) return;
  if (!handCollectionStore.reloadHandCollection()) showSnackbar(t('handCollection.loadError'), 'error');
}

// 一括レベル設定
function applyBulkLevel() {
  const targets = [...filteredCharacters.value];
  if (saving.value || !targets.length || !validBulkLevel.value) return;
  handCollectionStore.batchUpdates(() => {
    targets.forEach(character => {
      const maxLevel = getMaxLevel(character.rare);
      const clampedLevel = Math.max(Math.min(bulkLevel.value, maxLevel), 0);
      handCollectionStore.updateHandCard(character.name, { level: clampedLevel });
    });
  });
  showSnackbar(t('handCollection.bulkUpdated', { count: targets.length }));
}

// 一括所持設定
function applyBulkOwnership(isOwned: boolean) {
  const targets = [...filteredCharacters.value];
  if (saving.value || !targets.length) return;
  handCollectionStore.batchUpdates(() => {
    targets.forEach(character => {
      handCollectionStore.updateHandCard(character.name, { isOwned });
    });
  });
  showSnackbar(t('handCollection.bulkUpdated', { count: targets.length }));
}

// 一括完凸設定
function applyBulkTotsu() {
  const targets = [...filteredCharacters.value];
  if (saving.value || !targets.length) return;
  handCollectionStore.batchUpdates(() => {
    targets.forEach(character => {
      handCollectionStore.updateHandCard(character.name, { totsu: bulkTotsu.value });
    });
  });
  showSnackbar(t('handCollection.bulkUpdated', { count: targets.length }));
}

function handleFilterApplied() {
  appliedFilterState.value = readDetailedFilterState();
}

// データ管理機能
function openDataModal() {
  try {
    refreshBackupText();
    dataModal.value = true;
  } catch {
    showSnackbar(t('handCollection.downloadError'), 'error');
  }
}

function closeDataModal() {
  dataModal.value = false;
  if (!importIssues.value.length) dataText.value = '';
  importRows.value = [];
  importConfirmDialog.value = false;
}

function showSnackbar(text: string, color: 'success' | 'error' = 'success') {
  snackbar.value.text = text;
  snackbar.value.color = color;
  snackbar.value.show = true;
}

function copyToClipboard() {
  navigator.clipboard.writeText(backupText.value)
    .then(() => {
      showSnackbar(t('handCollection.copySuccess'));
    })
    .catch(err => {
      console.error('クリップボードへのコピーに失敗しました:', err);
      showSnackbar(t('handCollection.copyError'), 'error');
    });
}

function downloadSetsBackupFile() {
  if (saving.value) return;
  try {
    const json = backupText.value;
    if (!json) return;
    const url = URL.createObjectURL(new Blob([json], { type: 'application/json;charset=utf-8' }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `twst-hand-collection-sets-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    showSnackbar(t('handCollection.downloadSuccess'));
  } catch (error) {
    console.error('Failed to export hand collection sets:', error);
    showSnackbar(t('handCollection.downloadError'), 'error');
  }
}

function openBackupFilePicker() {
  backupFileInput.value?.click();
}

async function handleBackupFileSelected(event: Event) {
  if (saving.value) return;
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = '';
  if (!file) return;

  const contextRevision = handCollectionStore.collectionContextRevision;
  try {
    const text = await file.text();
    if (saving.value || contextRevision !== handCollectionStore.collectionContextRevision) return;
    dataText.value = text;
    await importFromText();
  } catch (error) {
    console.error('JSONファイルの読み込みに失敗しました:', error);
    showSnackbar(t('handCollection.fileReadError'), 'error');
  }
}

async function importFromText() {
  if (saving.value || importSubmitting.value) return;
  importRows.value = [];
  importIssues.value = [];
  try {
    const backup = parseHandCollectionSetsBackup(dataText.value, characters.value);
    if (backup) {
      importRows.value = backup.sets.map(set => ({ name: set.name, data: JSON.parse(JSON.stringify(set.data)), destination: null }));
    } else {
      const result = parseHandCollectionImport(dataText.value, characters.value);
      if (result.issues.length) { importIssues.value = result.issues; return; }
      const data: HandCollection = {};
      for (const update of result.updates) {
        const card = characters.value.find(card => card.name === update.cardName);
        const totsu = update.values.totsu ?? 0;
        data[update.cardName] = { characterName: card?.chara ?? '', cardName: update.cardName, isOwned: update.values.isOwned ?? false, level: update.values.level ?? 0, totsu, isLimitBreak: totsu === 4, isM3: card?.rare === 'SSR' && totsu >= 3 };
      }
      importRows.value = [{ name: t('handCollection.importedSetName'), data, destination: null }];
    }
    importStageRevision.value = handCollectionStore.collectionContextRevision;
  } catch {
    showSnackbar(t('handCollection.importError'), 'error');
  }
}

async function submitAssignedImport() {
  if (saving.value || importSubmitting.value || !canConfirmImport.value || !importConfirmDialog.value) return;
  const assignments = selectedImportRows.value.map(row => ({ slot: row.destination!, name: row.name, data: JSON.parse(JSON.stringify(row.data)) as HandCollection }));
  importSubmitting.value = true;
  try {
    await handCollectionStore.importAssignedSets(assignments, { overwriteConfirmed: true, expectedRevision: importStageRevision.value });
    importRows.value = [];
    importConfirmDialog.value = false;
    refreshBackupText();
    showSnackbar(t('handCollection.assignedImportSuccess', { count: assignments.length }));
  } catch {
    showSnackbar(handCollectionStore.hasConflict ? t('handCollection.saveConflict') : t('handCollection.importError'), 'error');
  } finally { importSubmitting.value = false; }
}

// フィルターリセット機能
function resetFilters() {
  appliedFilterState.value = null;
  cardSearch.value = '';
  ownedOnly.value = false;
  // 全キャラクターを表示状態にリセット
  characters.value.forEach(character => {
    character.visible = true;
  });
  
  // FilterdStoreもリセット
  filterdStore.resetFilterState();
}

// ウィンドウリサイズの監視
function handleResize() {
  windowWidth.value = window.innerWidth;
}

// Initialize
onMounted(async () => {
  // ウィンドウリサイズイベントリスナーを追加
  window.addEventListener('resize', handleResize);
  loading.value = true;
  
  
  try {
    // characterStoreの初期化を確実に待つ
    if (!characters.value || characters.value.length === 0) {
      characterStore.handlePageChange('handCollectionPage');
      
      // 少し待ってから再確認
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    // 画像の読み込み処理
    if (characters.value && characters.value.length > 0) {
      await hydrateCharacterImageUrls(characters.value, 'name', { fallbackName: 'notyet' });
      characters.value.forEach((character) => {
        if (!character.imgUrl) {
          character.imgUrl = defaultImg;
        }
      });
    }
    
    // 初期化時にcharacter.visibleを設定
    if (characters.value) {
      characters.value.forEach((character) => {
        if (!('visible' in character)) {
          character.visible = true; // デフォルトで全て表示
        }
      });
    }
    
    
  } finally {
    loading.value = false;
  }
});

onUnmounted(() => {
  // ウィンドウリサイズイベントリスナーを削除
  window.removeEventListener('resize', handleResize);
});
</script>

<style scoped>
.data-management-card { display: flex; flex-direction: column; max-height: calc(100dvh - 48px); }
.data-management-card :deep(.v-card-text) { flex: 1 1 auto; min-height: 0; overflow-y: auto; }
.data-management-card :deep(.v-card-title), .data-management-card :deep(.v-card-actions) { flex: 0 0 auto; }
.hand-workspace { max-width: 1280px; color: #243248; }
.header-section { margin-bottom: 18px; }
.title-container { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; margin: 8px 0 18px; }
.page-title { margin: 0; font-size: 1.65rem; font-weight: 700; letter-spacing: -.025em; }
.page-description { margin-top: 4px; color: #69778c; font-size: .85rem; }
.unsaved-indicator { flex-shrink: 0; margin-top: 5px; }
.saved-sets { padding: 0; }
.section-caption { color: #69778c; }
.saved-sets-actions { display: grid; grid-template-columns: minmax(0, 1fr) auto auto; align-items: center; gap: 8px; }
.list-sort select, .native-select { border: 1px solid #cbd5e3; border-radius: 6px; background: white; min-width: 0; max-width: 100%; padding: 8px; }
.visually-hidden { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }
.transfer-strip { display: flex; align-items: center; justify-content: space-between; gap: 16px; padding: 0 2px 16px; margin-bottom: 4px; border-bottom: 1px solid #e6ebf2; }
.transfer-strip h3 { font-size: .85rem; font-weight: 600; }
.transfer-strip p { font-size: .75rem; color: #69778c; margin-top: 2px; }
.transfer-actions { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; }
.transfer-actions :deep(.v-btn) { font-size: .8rem; height: 36px; }
.card-workbench { padding-top: 12px; }
.workbench-heading { display: flex; justify-content: space-between; align-items: center; gap: 12px; margin-bottom: 12px; }
.workbench-heading h3 { font-size: 1.15rem; font-weight: 700; }
.display-count { color: #69778c; font-size: .82rem; }
.list-search-row { display: grid; grid-template-columns: minmax(0,1fr) auto; gap: 8px; align-items: center; }
.list-search-row :deep(.v-field) { border-radius: 8px; }
.list-options-row { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin: 6px 0; }
.list-options-row :deep(.v-input) { flex: 0 0 auto; }
.list-options-row :deep(.v-label) { font-size: .82rem; }
.list-sort { display: flex; align-items: center; gap: 4px; min-width: 0; }
.list-sort label { font-size: .75rem; color: #69778c; }
.list-sort select { height: 34px; font-size: .82rem; }
.active-filter-summary { display: flex; align-items: center; flex-wrap: wrap; justify-content: space-between; gap: 4px; margin-bottom: 8px; font-size: .75rem; color: #48617e; overflow-wrap: anywhere; }
.bulk-disclosure { width: min(100%, 360px); margin-bottom: 14px; border: 1px solid #e1e7ef; border-radius: 8px; background: white; }
.bulk-disclosure > summary { display: flex; align-items: center; gap: 8px; padding: 10px 12px; cursor: pointer; list-style: none; font-size: .82rem; font-weight: 600; }
.bulk-disclosure > summary::-webkit-details-marker { display: none; }
.bulk-disclosure > summary small { margin-left: auto; font-weight: 400; color: #69778c; font-size: .72rem; }
.bulk-disclosure[open] > summary .v-icon { transform: rotate(180deg); }
.bulk-content { padding: 0 10px 10px; }
.bulk-controls { display: grid; width: max-content; max-width: 100%; gap: 8px; }
.control-group { display: grid; grid-template-columns: 48px minmax(0, 1fr); align-items: center; gap: 8px; min-width: 0; padding: 0; }
.control-label { margin: 0; font-size: .8rem; font-weight: 600; }
.control-fields { display: flex; gap: 6px; align-items: center; min-width: 0; }
.control-fields .v-input, .control-fields select { flex: 0 0 88px; width: 88px; min-width: 0; max-width: 88px; }
.control-fields .native-select { box-sizing: border-box; height: 34px; min-height: 34px; width: 88px; flex: 0 0 88px; padding: 0 8px; }
.control-fields :deep(.v-field), .control-fields :deep(.v-field__input) { min-height: 34px; height: 34px; }
.control-fields :deep(.v-field__input) { padding-block: 4px; }
.control-fields :deep(.v-btn) { height: 34px; min-width: 0; padding-inline: 10px; font-size: .75rem; }
.backup-section h3, .restore-section h3 { font-size: 1rem; }
.data-help { margin-top: 6px; font-size: .8rem; line-height: 1.7; color: #58677c; }
.restore-section { margin-top: 24px; padding-top: 20px; border-top: 1px solid #e1e7ef; }
.assignment-row { display: grid; grid-template-columns: minmax(0, 1fr) minmax(140px, 1fr); gap: 12px; align-items: center; padding: 10px 0; border-bottom: 1px solid #e1e7ef; }
.assignment-source { min-width: 0; overflow-wrap: anywhere; font-size: .85rem; }
.assignment-source small { display: block; margin-top: 2px; color: #69778c; }
.assignment-row select { width: 100%; font-size: .85rem; }
.assignment-confirm-list { padding-left: 20px; margin-top: 12px; overflow-wrap: anywhere; }
@media (max-width: 600px) { .assignment-row { grid-template-columns: 1fr; gap: 6px; } }
.data-actions { display: flex; flex-wrap: wrap; gap: 8px; }
.action-btn { flex: 1 1 120px; }
.backup-file-input { display: none; }
.json-editor { position: relative; }
.json-copy-button { position: absolute; top: 8px; right: 8px; z-index: 1; }
.json-editor :deep(textarea.v-field__input) { padding-right: 56px; }
@media (max-width: 600px) {
 .page-title { font-size: 1.35rem; }
 .page-description { font-size: .75rem; }
 .title-container { margin-bottom: 12px; }
 .header-section { margin-bottom: 12px; }
 .saved-sets { padding: 0; }
 .saved-sets-actions { gap: 6px; }
 .saved-sets-actions :deep(.v-btn) { min-width: 46px; padding-inline: 10px; }
  .transfer-strip { display: block; padding-bottom: 12px; }
 .transfer-strip p { display: none; }
 .transfer-actions { margin-top: 6px; gap: 4px; }
 .transfer-actions :deep(.v-btn) { font-size: .72rem; padding-inline: 8px; }
 .workbench-heading { margin-bottom: 8px; }
 .workbench-heading h3 { font-size: 1rem; }
 .list-search-row :deep(.v-btn) { font-size: .75rem; min-width: 60px; padding-inline: 8px; }
 .list-options-row { gap: 6px; }
 .list-sort { flex: 1; justify-content: flex-end; }
 .list-sort label { position: absolute; clip-path: inset(50%); width: 1px; height: 1px; overflow: hidden; }
 .list-sort select { max-width: 115px; }
 .bulk-disclosure > summary { padding: 9px 10px; }

 .action-btn { flex-basis: 100%; }
}
.table-select {
  width: 100%;
  border: 1px solid #ccc;
  border-radius: 4px;
  background-color: #fff;
  color: rgba(0, 0, 0, 0.87);
  min-height: 40px;
  padding: 0 12px;
  appearance: none;
  -webkit-appearance: none;
  -moz-appearance: none;
}

.table-select:disabled {
  background-color: #f5f5f5;
  color: rgba(0, 0, 0, 0.38);
}

/* 手動テーブルのスタイル */
.manual-table {
  border: 1px solid #ddd;
  border-radius: 4px;
  overflow-x: auto;
  overflow-y: hidden;
}

.table-header {
  background-color: #f5f5f5;
  font-weight: bold;
  border-bottom: 2px solid #ddd;
}

.table-header,
.table-row {
  display: grid;
  grid-template-columns: minmax(56px, 1fr) minmax(64px, .75fr) minmax(72px, 1fr) minmax(100px, 1fr) minmax(60px, .75fr) minmax(100px, 2fr);
}

.sortable-header {
  cursor: pointer;
  user-select: none;
  transition: background-color 0.2s ease;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
}

.sortable-header:hover {
  background-color: #e8f4fd;
}

.sort-icon {
  opacity: 0.7;
  transition: opacity 0.2s ease;
}

.sortable-header:hover .sort-icon {
  opacity: 1;
}

.table-row {
  border-bottom: 1px solid #eee;
  min-height: 60px;
  align-items: center;
}

.table-row:hover {
  background-color: #f9f9f9;
}

.even-row {
  background-color: #fafafa;
}

.header-cell, .data-cell {
  min-width: 0;
  padding: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-right: 1px solid #eee;
}

.header-cell {
  line-height: 1.2;
  overflow-wrap: anywhere;
  text-align: center;
  white-space: normal;
}

.header-cell:last-child, .data-cell:last-child {
  border-right: none;
}

.level-col .level-input {
  width: 100%;
  min-width: 0;
  max-width: none;
}

.level-col :deep(.v-field__field) {
  padding-inline: 4px !important;
}

.level-col :deep(.v-field__input) {
  padding-inline: 4px !important;
}

.costume-col {
  overflow-wrap: anywhere;
  text-align: left;
  justify-content: flex-start;
}

.character-image {
  width: 40px;
  height: 40px;
  border-radius: 1px;
  object-fit: cover;
}

/* モバイル対応 */
@media (max-width: 600px) {
  .table-header,
  .table-row {
    grid-template-columns: minmax(48px, 1fr) minmax(56px, 1fr) minmax(64px, 1fr) minmax(88px, 1.3fr);
  }

  .header-cell, .data-cell {
    padding-inline: 4px;
  }

  .sortable-header {
    gap: 2px;
  }
  
  .character-image {
    width: 32px;
    height: 32px;
  }
}
</style>
