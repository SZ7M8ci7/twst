<template>
  <v-container class="exam-simulator" data-testid="exam-simulator" fluid>
    <div class="exam-shell">
      <v-tabs v-model="activeTab" class="main-tabs" color="primary" fixed-tabs :mobile-breakpoint="Infinity">
        <v-tab value="exam" prepend-icon="mdi-file-document-edit-outline">{{ t('examSimulator.tabs.exam') }}</v-tab>
        <v-tab value="deck" prepend-icon="mdi-cards-outline">{{ t('examSimulator.tabs.deck') }}</v-tab>
        <v-tab value="plan" prepend-icon="mdi-call-split">{{ t('examSimulator.tabs.plan') }}</v-tab>
        <v-tab value="result" prepend-icon="mdi-chart-bar">{{ t('examSimulator.tabs.result') }}</v-tab>
      </v-tabs>

      <div class="tab-window">
        <section v-show="activeTab === 'exam'">
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

          <div class="tab-grid exam-tab-grid">
            <section class="tool-panel">
              <div class="panel-heading">
                <div>
                  <h2>{{ t('examSimulator.examConditions') }}</h2>
                </div>
              </div>
              <div class="form-grid exam-grid">
                <v-select v-model="exam.kind" class="exam-kind-select" :items="examKindOptions" :label="t('examSimulator.kind')" density="compact" variant="outlined" hide-details />
                <v-select v-model="exam.enemyElement" :items="elementOptionItems" item-title="title" item-value="value" :label="t('examSimulator.enemyElement')" density="compact" variant="outlined" hide-details />
                <v-select
                  v-model="exam.difficulty"
                  :items="difficultyOptions"
                  item-title="title"
                  item-value="value"
                  :label="t('examSimulator.difficulty')"
                  density="compact"
                  variant="outlined"
                  hide-details
                />
                <v-text-field v-model.number="exam.enemyHp" type="number" :label="t('examSimulator.enemyHp')" min="1" density="compact" variant="outlined" hide-details />
              </div>
            </section>

            <section v-if="availableSpecialChallenges.length" class="tool-panel special-challenge-panel">
              <div class="panel-heading">
                <div>
                  <h2>{{ t('examSimulator.specialChallenges') }}</h2>
                </div>
                <div class="special-score-total">+{{ formatNumber(selectedSpecialChallengeScore) }}</div>
              </div>
              <div class="special-challenge-list">
                <label
                  v-for="challenge in availableSpecialChallenges"
                  :key="challenge.id"
                  class="special-challenge-item"
                  :class="{ selected: selectedSpecialChallengeIds.includes(challenge.id) }"
                >
                  <input v-model="selectedSpecialChallengeIds" type="checkbox" :value="challenge.id" />
                  <span class="special-rank">{{ specialChallengeRankLabel(challenge.rank) }}</span>
                  <span class="special-label">{{ localizeExamLogText(challenge.label) }}</span>
                  <span class="special-score">+{{ formatNumber(challenge.score) }}</span>
                </label>
              </div>
            </section>

            <section class="tool-panel">
              <div class="panel-heading">
                <div>
                  <h2>{{ t('examSimulator.enemyActions') }}</h2>
                </div>
                <v-btn color="primary" variant="tonal" size="small" prepend-icon="mdi-plus" @click="addEnemySlot">{{ t('examSimulator.addEnemy') }}</v-btn>
              </div>
              <div class="enemy-card-list">
                <article v-for="(slot, slotIndex) in enemySlots" :key="slot.id" class="enemy-summary-card">
                  <div>
                    <div class="summary-title">{{ displayEnemySlotName(slot.name, slotIndex) }}</div>
                    <div class="summary-sub">{{ t('examSimulator.actionCount', { count: slot.actions.length }) }}</div>
                  </div>
                  <div class="enemy-actions">
                    <v-btn size="small" variant="tonal" prepend-icon="mdi-pencil" @click="openEnemyDialog(slotIndex)">{{ t('common.edit') }}</v-btn>
                    <v-btn size="small" variant="text" color="error" icon="mdi-delete" @click="removeEnemySlot(slotIndex)" />
                  </div>
                </article>
              </div>
            </section>
          </div>
        </section>

        <section v-show="activeTab === 'deck'">
          <section class="tool-panel">
            <div class="panel-heading">
              <div>
                <h2>{{ t('examSimulator.deckSetup') }}</h2>
              </div>
              <div class="deck-save-actions">
                <v-btn color="primary" variant="tonal" size="small" prepend-icon="mdi-content-save-outline" @click="openSaveExamSettingsDialog">
                  {{ t('simulator.deck') }}
                </v-btn>
              </div>
            </div>

            <div class="deck-board">
              <article v-for="(slot, index) in deck" :key="index" class="deck-card">
                <button class="deck-card-button" :data-testid="`deck-card-${index}`" @click="openCharacterDialog(index)">
                  <img :src="slot.imageUrl || defaultImg" :alt="slot.character?.name || 'empty'" class="deck-card-image" />
                  <span class="deck-card-number">{{ index + 1 }}</span>
                </button>
                <div class="deck-card-body">
                  <div class="deck-controls">
                    <v-text-field
                      :model-value="deckLevelInputValue(index)"
                      class="level-field"
                      type="number"
                      inputmode="numeric"
                      pattern="[0-9]*"
                      label="Lv"
                      :min="1"
                      :max="maxCardLevel(slot)"
                      :step="1"
                      density="compact"
                      variant="outlined"
                      hide-details
                      @update:model-value="updateDeckLevelInput(index, $event)"
                      @focus="focusDeckLevelInput(index, $event)"
                      @change="normalizeDeckLevel(index)"
                      @blur="normalizeDeckLevel(index)"
                      @keydown.enter="normalizeDeckLevel(index)"
                    />
                    <v-select
                      v-model.number="slot.totsu"
                      class="totsu-field"
                      :items="totsuOptions"
                      item-title="title"
                      item-value="value"
                      :label="t('common.limitBreak')"
                      density="compact"
                      variant="outlined"
                      hide-details
                      :disabled="!slot.character"
                      @update:model-value="normalizeDeckTotsu(index)"
                    />
                    <div class="magic-toggle-row">
                      <button
                        v-for="magicSlot in magicSlotOptions"
                        :key="magicSlot"
                        class="magic-toggle"
                        :class="{ selected: slot.selectedMagicSlots.includes(magicSlot) }"
                        :disabled="!availableMagicSlots(slot).includes(magicSlot)"
                        @click="toggleDeckMagic(index, magicSlot)"
                      >
                        M{{ magicSlot }}
                      </button>
                    </div>
                    <v-btn icon="mdi-tune-variant" class="deck-detail-button" :data-testid="`deck-detail-${index}`" size="small" variant="tonal" :disabled="!slot.character" :aria-label="t('common.detailEdit')" @click="openDeckDetailDialog(index)" />
                  </div>
                </div>
              </article>
            </div>
          </section>
        </section>

        <section v-show="activeTab === 'plan'">
          <div class="plan-layout">
            <section class="tool-panel order-panel">
              <div class="panel-heading">
                <div>
                  <h2>{{ t('examSimulator.priority') }}</h2>
                </div>
                <div class="plan-heading-actions">
                  <label
                    class="smart-selection-toggle"
                    :class="{ disabled: exam.enemyElement !== '全' }"
                    :title="t('examSimulator.elementCompatibilityPriorityTitle')"
                  >
                    <input
                      v-model="allTurnElementCompatibilityPriority"
                      type="checkbox"
                      :disabled="exam.enemyElement !== '全'"
                    />
                    <span>{{ t('examSimulator.elementCompatibilityPriority') }}</span>
                  </label>
                  <v-btn
                    class="copy-prev-turn-button"
                    color="primary"
                    variant="tonal"
                    size="small"
                    prepend-icon="mdi-content-copy"
                    :disabled="activeTurnIndex === 0"
                    @click="copyPreviousTurnCombos"
                  >
                    {{ t('examSimulator.copyPreviousTurn') }}
                  </v-btn>
                  <v-btn
                    color="primary"
                    variant="tonal"
                    size="small"
                    prepend-icon="mdi-select-all"
                    :disabled="magicCards.length < 2"
                    @click="addAllTurnCombos"
                  >
                    {{ t('examSimulator.allCombinations') }}
                  </v-btn>
                </div>
              </div>

              <v-tabs :model-value="activeTurnIndex" class="turn-tabs" color="primary" density="compact" :mobile-breakpoint="Infinity" @update:model-value="requestTurnChange">
                <v-tab v-for="(turn, index) in turnPlans" :key="turn.turn" :value="index">
                  {{ turn.turn }}T
                  <span class="turn-count">{{ turn.combos.length }}</span>
                </v-tab>
              </v-tabs>

              <div class="turn-page">
                <div v-if="currentTurnPlan" class="turn-option-row">
                  <label
                    class="turn-smart-selection-toggle"
                    :class="{ disabled: exam.enemyElement !== '全' }"
                    :title="t('examSimulator.turnElementCompatibilityPriorityTitle')"
                  >
                    <input
                      :checked="currentTurnPlan.useElementCompatibilityPriority === true"
                      type="checkbox"
                      :disabled="exam.enemyElement !== '全'"
                      @change="updateActiveTurnElementCompatibilityPriority"
                    />
                    <span>{{ currentTurnPlan.turn }}T {{ t('examSimulator.elementCompatibilityPriority') }}</span>
                  </label>
                </div>
                <div v-if="currentTurnPlan" class="combo-list">
                  <div
                    v-for="(combo, comboIndex) in currentTurnDisplayCombos"
                    :key="combo.id"
                    class="combo-row"
                    :class="{ active: comboIndex === activeComboIndex && !combo.virtual, virtual: combo.virtual, 'combo-drag-over': comboIndex === dragOverComboIndex && !combo.virtual }"
                    @click="combo.virtual ? openMagicPicker(comboIndex, 'firstMagicId') : selectComboTarget(comboIndex)"
                    @dragenter="onComboRowDragEnter(comboIndex, combo.virtual, $event)"
                    @dragover="onComboRowDragOver(comboIndex, combo.virtual, $event)"
                    @dragleave="onComboRowDragLeave(comboIndex)"
                    @drop="onComboRowDrop(activeTurnIndex, comboIndex, combo.virtual, $event)"
                  >
                    <button
                      v-if="!combo.virtual"
                      class="combo-priority"
                      type="button"
                      draggable="true"
                      :aria-label="t('examSimulator.dragPriority')"
                      :title="t('common.dragToReorder')"
                      @click.stop="selectComboTarget(comboIndex)"
                      @dragstart.stop="onComboPriorityDragStart(activeTurnIndex, comboIndex, $event)"
                      @dragend="onComboPriorityDragEnd"
                    >
                      <span class="combo-priority-grip" aria-hidden="true">⋮⋮</span>
                      <span>{{ comboIndex + 1 }}</span>
                    </button>
                    <div v-else class="combo-priority combo-priority-empty" aria-hidden="true"></div>
                    <div class="combo-pair">
                      <div
                        class="combo-drop-slot"
                        :class="{ filled: !!combo.firstMagicId, active: comboIndex === activeComboIndex && activeComboSlot === 'firstMagicId' }"
                        :data-testid="`combo-${activeTurnIndex}-${comboIndex}-first`"
                        @click.stop="openMagicPicker(comboIndex, 'firstMagicId')"
                        @dragenter.prevent.stop
                        @dragover.prevent.stop="onMagicDragOver"
                        @mouseup.prevent.stop="onMagicPointerDrop(activeTurnIndex, comboIndex, 'firstMagicId')"
                        @pointerup.prevent.stop="onMagicPointerDrop(activeTurnIndex, comboIndex, 'firstMagicId')"
                        @drop.prevent.stop="onMagicDrop(activeTurnIndex, comboIndex, 'firstMagicId', $event)"
                      >
                        <template v-if="magicById(combo.firstMagicId)">
                          <img :src="magicById(combo.firstMagicId)?.imageUrl || defaultImg" class="combo-image" alt="" />
                          <span class="magic-badge">M{{ magicById(combo.firstMagicId)?.magicSlot }}</span>
                        </template>
                        <span v-else class="combo-placeholder">1</span>
                      </div>
                      <div
                        class="combo-drop-slot"
                        :class="{ filled: !!combo.secondMagicId, active: comboIndex === activeComboIndex && activeComboSlot === 'secondMagicId' }"
                        :data-testid="`combo-${activeTurnIndex}-${comboIndex}-second`"
                        @click.stop="openMagicPicker(comboIndex, 'secondMagicId')"
                        @dragenter.prevent.stop
                        @dragover.prevent.stop="onMagicDragOver"
                        @mouseup.prevent.stop="onMagicPointerDrop(activeTurnIndex, comboIndex, 'secondMagicId')"
                        @pointerup.prevent.stop="onMagicPointerDrop(activeTurnIndex, comboIndex, 'secondMagicId')"
                        @drop.prevent.stop="onMagicDrop(activeTurnIndex, comboIndex, 'secondMagicId', $event)"
                      >
                        <template v-if="magicById(combo.secondMagicId)">
                          <img :src="magicById(combo.secondMagicId)?.imageUrl || defaultImg" class="combo-image" alt="" />
                          <span class="magic-badge">M{{ magicById(combo.secondMagicId)?.magicSlot }}</span>
                        </template>
                        <span v-else class="combo-placeholder">2</span>
                      </div>
                    </div>
                    <div class="combo-right">
                    <label v-if="!combo.virtual" class="combo-auto-swap" :title="t('examSimulator.autoSwapTitle')" @click.stop>
                        <input v-model="combo.allowAutoSwap" type="checkbox" @click.stop />
                      <span>{{ t('examSimulator.allowSwap') }}</span>
                      </label>
                      <div class="combo-actions" v-if="!combo.virtual">
                    <v-btn icon="mdi-swap-horizontal" size="small" variant="text" :disabled="!combo.firstMagicId || !combo.secondMagicId" :aria-label="t('examSimulator.swapLeftRight')" @click.stop="swapComboMagic(activeTurnIndex, comboIndex)" />
                        <v-btn icon="mdi-delete" size="small" variant="text" color="error" :disabled="currentTurnPlan.combos.length <= 1" @click.stop="removeCombo(activeTurnIndex, comboIndex)" />
                      </div>
                    </div>
                  </div>
                </div>

                <transition name="picker-pop">
                  <div v-if="magicPickerOpen" class="magic-picker">
                    <v-btn class="magic-picker-close" icon="mdi-close" size="x-small" variant="text" @click="cancelMagicPicker" />
                    <div class="magic-picker-grid">
                      <div v-for="row in magicChoiceRows" :key="row.deckIndex" class="magic-picker-row">
                        <button
                          v-for="choice in row.choices"
                          :key="choice.slot"
                          class="picker-magic-cell"
                          :class="{ selected: choice.magic && isMagicInActiveCombo(choice.magic.id) }"
                          :disabled="!choice.magic"
                          @click="choice.magic && chooseMagicFromPicker(choice.magic.id)"
                        >
                          <template v-if="choice.magic">
                            <img :src="choice.magic.imageUrl || defaultImg" alt="" />
                            <span class="magic-badge">M{{ choice.slot }}</span>
                          </template>
                          <span v-else>M{{ choice.slot }}</span>
                        </button>
                      </div>
                    </div>
                  </div>
                </transition>
              </div>
            </section>

            <aside class="tool-panel plan-reference-panel" :aria-label="t('examSimulator.selectedMagicDetails')">
              <div class="panel-heading">
                <div>
                <h2>{{ t('examSimulator.referenceInfo') }}</h2>
                </div>
              </div>

              <div v-if="planReferenceCards.length" class="plan-reference-list">
                <article v-for="entry in planReferenceCards" :key="entry.deckIndex" class="plan-reference-card">
                  <div class="plan-reference-image-wrap">
                    <img :src="entry.imageUrl || defaultImg" alt="" class="plan-reference-image" />
                    <div
                      v-if="entry.duoPartner && getDuoIconSync(entry.duoPartner)"
                      class="plan-reference-duo-icon-container"
                      :class="{ 'duo-active': entry.duoActive }"
                    :title="duoReferenceTitle(entry)"
                    >
                      <img
                        :src="getDuoIconSync(entry.duoPartner) || defaultImg"
                        alt=""
                        class="plan-reference-duo-icon"
                        @error="handleReferenceDuoIconError"
                      />
                    </div>
                  </div>
                  <div class="plan-reference-magic-list">
                    <div v-for="magic in entry.magics" :key="magic.magicSlot" class="plan-reference-magic-row">
                      <span class="reference-magic-label" :class="referenceMagicElementClass(magic.element)">M{{ magic.magicSlot }}</span>
                      <span class="reference-effect-text">{{ magic.effectText }}</span>
                    </div>
                    <div v-if="!entry.magics.length" class="reference-effect-text muted">{{ t('examSimulator.unselected') }}</div>
                  </div>
                </article>
              </div>
              <div v-else class="plan-reference-empty">
                  {{ t('examSimulator.showSelectedDeckMagic') }}
              </div>
            </aside>
          </div>
        </section>

        <section v-show="activeTab === 'result'">
          <section class="tool-panel result-panel">
            <div class="panel-heading">
              <div>
                <h2>{{ t('examSimulator.simulationResult') }}</h2>
              </div>
              <div class="result-actions">
                <v-btn-toggle v-model="simulationMode" class="simulation-mode-toggle" mandatory divided density="compact" variant="outlined" :disabled="isRunning">
                  <v-btn value="normal" size="small" data-testid="simulation-mode-normal">{{ t('examSimulator.normalMode') }}</v-btn>
                  <v-btn value="autoBest" size="small" data-testid="simulation-mode-auto-best">{{ t('examSimulator.autoBestMode') }}</v-btn>
                </v-btn-toggle>
                <v-text-field v-model.number="iterations" class="run-field" type="number" min="1" max="100000" :label="t('examSimulator.iterations')" density="compact" variant="outlined" hide-details />
                <v-text-field v-model.number="seed" class="seed-field" type="number" label="seed" density="compact" variant="outlined" hide-details />
              <v-btn color="primary" data-testid="run-simulation" size="large" :loading="isRunning" :disabled="!!validationMessage || isRunning" prepend-icon="mdi-play" @click="runSimulation">{{ t('examSimulator.run') }}</v-btn>
              <v-btn v-if="isRunning && simulationMode === 'autoBest'" color="error" data-testid="stop-simulation" size="large" prepend-icon="mdi-stop" @click="requestSimulationStop">{{ t('examSimulator.stop') }}</v-btn>
              <v-btn icon="mdi-refresh" variant="tonal" :aria-label="t('examSimulator.clear')" :disabled="(!resultSummary && !autoBestProgress) || isRunning" @click="clearResults" />
              </div>
            </div>

            <div v-if="simulationMode === 'autoBest' && autoBestProgress" class="auto-best-progress" data-testid="auto-best-progress">
              <v-progress-linear v-if="isRunning" color="primary" indeterminate height="3" />
              <div class="auto-best-progress-grid">
                <div class="metric">
                  <div class="metric-label">{{ t('examSimulator.completedIterations') }}</div>
                  <div class="metric-value">{{ formatNumber(autoBestProgress.completedIterations) }} / {{ formatNumber(autoBestProgress.totalIterations) }}</div>
                </div>
                <div class="metric">
                  <div class="metric-label">{{ t('examSimulator.currentIteration') }}</div>
                  <div class="metric-value">{{ formatNumber(autoBestProgress.currentIteration) }}</div>
                </div>
                <div class="metric">
                  <div class="metric-label">{{ t('examSimulator.exploredNodes') }}</div>
                  <div class="metric-value">{{ formatNumber(autoBestProgress.exploredNodes) }}</div>
                </div>
                <div class="metric">
                  <div class="metric-label">{{ t('examSimulator.completedPatterns') }}</div>
                  <div class="metric-value">{{ formatNumber(autoBestProgress.completedPatterns) }}</div>
                </div>
                <div class="metric">
                  <div class="metric-label">{{ t('examSimulator.queuedBranches') }}</div>
                  <div class="metric-value">{{ formatNumber(autoBestProgress.queuedBranches) }}</div>
                </div>
                <div class="metric">
                  <div class="metric-label">{{ t('examSimulator.provisionalBestScore') }}</div>
                  <div class="metric-value">{{ formatNumber(autoBestProgress.provisionalBestScore) }}</div>
                </div>
                <div class="metric">
                  <div class="metric-label">{{ t('examSimulator.elapsedTime') }}</div>
                  <div class="metric-value">{{ formatElapsedTime(autoBestProgress.elapsedMs) }}</div>
                </div>
                <div v-if="autoBestProgress.stopped" class="metric auto-best-stopped">
                  <div class="metric-label">{{ t('examSimulator.status') }}</div>
                  <div class="metric-value">{{ t('examSimulator.stopped') }}</div>
                </div>
              </div>
            </div>

            <div v-if="resultSummary" class="retire-summary">
              <div class="metric retire-metric">
                <div class="metric-label">{{ t('examSimulator.retire') }}</div>
                <div class="metric-value">{{ formatNumber(resultSummary.retiredCount) }} / {{ formatNumber(resultSummary.count) }}</div>
              </div>
            </div>
                <div v-else class="empty-result">{{ t('examSimulator.notRun') }}</div>

            <div class="chart-grid">
              <div v-if="scoreDistributionData.labels.length" class="chart-panel wide">
              <div class="chart-heading">{{ t('examSimulator.scoreDistribution') }}</div>
                <div class="chart-body">
                  <Bar :key="`score-${simulationResultGeneration}`" :data="scoreDistributionChartData" :options="scoreDistributionOptions" :update-mode="isRunning ? 'none' : 'default'" />
                </div>
              </div>
              <div v-if="retireReasonDistributionData.labels.length" class="chart-panel">
              <div class="chart-heading">{{ t('examSimulator.retireReason') }}</div>
                <div class="chart-body compact">
                  <Bar :key="`reason-${simulationResultGeneration}`" :data="retireReasonDistributionData" :options="retireReasonDistributionOptions" :update-mode="isRunning ? 'none' : 'default'" />
                </div>
              </div>
              <div v-if="retireTurnDistributionData.labels.length" class="chart-panel">
              <div class="chart-heading">{{ t('examSimulator.retireTurn') }}</div>
                <div class="chart-body compact">
                  <Bar :key="`turn-${simulationResultGeneration}`" :data="retireTurnDistributionData" :options="retireTurnDistributionOptions" :update-mode="isRunning ? 'none' : 'default'" />
                </div>
              </div>
            </div>
              <div v-if="resultSummary && !scoreDistributionData.labels.length" class="empty-result">{{ t('examSimulator.noNonZeroScores') }}</div>

            <div v-if="bestLog.length" class="best-log-strip">
          <div data-testid="best-log-title">{{ bestLogTitle }}</div>
              <div class="best-log-actions">
              <v-btn variant="tonal" size="small" prepend-icon="mdi-text-box-search-outline" @click="logDialogOpen = true">{{ t('examSimulator.openLog') }}</v-btn>
              </div>
            </div>
          </section>
        </section>
      </div>

      <v-alert v-if="visibleValidationMessage" class="validation-bar" type="warning" variant="tonal" density="compact">
        {{ visibleValidationMessage }}
      </v-alert>
    </div>

    <v-dialog v-model="enemyDialogOpen" max-width="1320">
      <v-card class="modal-card" v-if="editingEnemySlot">
        <v-card-title class="modal-title">
          <span>{{ t('examSimulator.enemyActionTitle', { name: displayEnemySlotName(editingEnemySlot.name, editingEnemySlotIndex) }) }}</span>
          <v-btn icon="mdi-close" variant="text" @click="enemyDialogOpen = false" />
        </v-card-title>
        <v-card-text>
          <div class="enemy-toolbar">
            <v-text-field
              :model-value="displayEnemySlotName(editingEnemySlot.name, editingEnemySlotIndex)"
              class="enemy-name-field"
              :label="t('examSimulator.enemyName')"
              density="compact"
              variant="outlined"
              hide-details
              @update:model-value="updateEditingEnemySlotName"
            />
            <v-btn color="primary" variant="tonal" size="small" prepend-icon="mdi-plus" @click="addEnemyAction(editingEnemySlotIndex)">{{ t('examSimulator.addAction') }}</v-btn>
          </div>

          <div class="table-scroll">
            <v-table class="enemy-table" density="compact">
              <thead>
                <tr>
                  <th>{{ t('examSimulator.attribute') }}</th>
                  <th>{{ t('examSimulator.action') }}</th>
                  <th>{{ t('examSimulator.neutralDamage') }}</th>
                  <th>{{ t('examSimulator.effect') }}</th>
                  <th>{{ t('examSimulator.value') }}</th>
                  <th>T</th>
                  <th>{{ t('examSimulator.range') }}</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="(action, actionIndex) in editingEnemySlot.actions" :key="action.id">
                  <td class="attribute-cell">
                    <v-select
                      v-if="exam.enemyElement === '全'"
                      v-model="action.element"
                      :items="actionElementOptionItems"
                      item-title="title"
                      item-value="value"
                      density="compact"
                      variant="outlined"
                      hide-details
                    />
                    <div v-else class="fixed-attribute">{{ localizeGameText(exam.enemyElement, locale) }}</div>
                  </td>
                  <td class="power-cell"><v-select v-model="action.power" :items="enemyMagicPowerOptionItems" item-title="title" item-value="value" density="compact" variant="outlined" hide-details @update:model-value="syncEnemyPower(action)" /></td>
                  <td class="damage-cell"><v-text-field v-model.number="action.estimatedDamage" type="number" min="0" density="compact" variant="outlined" hide-details /></td>
                  <td class="effect-cell">
                    <v-select v-model="action.effectKind" :items="effectOptions" item-title="title" item-value="value" density="compact" variant="outlined" hide-details @update:model-value="syncEnemyEffectTarget(action)" />
                  </td>
                  <td class="value-cell"><v-text-field v-model.number="action.effectValue" type="number" density="compact" variant="outlined" hide-details /></td>
                  <td class="turn-cell"><v-select v-model.number="action.duration" :items="durationOptions" density="compact" variant="outlined" hide-details /></td>
                  <td class="range-cell"><v-select v-model="action.effectTarget" :items="effectTargetOptionItems" item-title="title" item-value="value" density="compact" variant="outlined" hide-details /></td>
                  <td class="delete-cell"><v-btn icon="mdi-delete" size="small" variant="text" color="error" @click="removeEnemyAction(editingEnemySlotIndex, actionIndex)" /></td>
                </tr>
              </tbody>
            </v-table>
          </div>
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn color="primary" variant="tonal" @click="enemyDialogOpen = false">{{ t('common.close') }}</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <v-dialog v-model="logDialogOpen" max-width="1120">
      <v-card class="modal-card">
        <v-card-title class="modal-title">
          <span data-testid="best-log-title">{{ bestLogTitle }}</span>
          <v-btn icon="mdi-close" variant="text" @click="logDialogOpen = false" />
        </v-card-title>
        <v-card-text>
          <div class="log-body" data-testid="best-log-body">
            <section v-for="group in groupedBestLog" :key="group.title" class="log-turn-group">
              <div class="log-turn-title">{{ localizeExamLogText(group.title) }}</div>
              <div
                v-for="(entry, index) in group.entries"
                :key="`${group.title}-${index}-${entry.line}`"
                class="battle-log-row"
                :class="[entry.side, { emphasized: entry.emphasized }]"
              >
                <template v-if="entry.side === 'enemy'">
                  <div class="log-marker">
                    <div class="log-combatant enemy-combatant">{{ entry.label ? localizeExamLogText(entry.label) : t('examSimulator.enemy') }}</div>
                    <img v-if="entry.sourceElement" class="log-element-icon" :src="elementIcon(entry.sourceElement)" alt="" />
                  </div>
                  <div class="log-arrow">→</div>
                  <div class="log-bubble">{{ localizeExamLogText(entry.displayLine) }}</div>
                  <template v-if="entry.targetIcon || entry.targetLabel">
                    <div class="log-arrow">→</div>
                    <div class="log-marker">
                      <img v-if="entry.targetIcon" class="log-avatar" :src="entry.targetIcon" alt="" />
                      <div v-else class="log-combatant target-combatant">{{ localizeExamLogText(entry.targetLabel || '') }}</div>
                      <img v-if="entry.targetElement" class="log-element-icon" :src="elementIcon(entry.targetElement)" alt="" />
                    </div>
                  </template>
                </template>
                <template v-else-if="entry.side === 'player'">
                  <template v-if="entry.targetLabel">
                    <div class="log-marker">
                      <div class="log-combatant target-combatant">{{ localizeExamLogText(entry.targetLabel) }}</div>
                      <img v-if="entry.targetElement" class="log-element-icon" :src="elementIcon(entry.targetElement)" alt="" />
                    </div>
                    <div class="log-arrow">←</div>
                  </template>
                  <div class="log-bubble">{{ localizeExamLogText(entry.displayLine) }}</div>
                  <div class="log-arrow">←</div>
                  <div class="log-marker">
                    <img class="log-avatar" :src="entry.icon || defaultImg" alt="" />
                    <img v-if="entry.sourceElement" class="log-element-icon" :src="elementIcon(entry.sourceElement)" alt="" />
                  </div>
                </template>
                <div v-else class="log-system-line">{{ localizeExamLogText(entry.displayLine) }}</div>
              </div>
            </section>
          </div>
        </v-card-text>
      </v-card>
    </v-dialog>

    <div v-if="settingsSaveDialogOpen" class="saved-deck-modal-overlay" @click.self="settingsSaveDialogOpen = false">
      <div class="saved-deck-modal-content">
        <div class="saved-deck-modal-body">
          <div class="settings-save-section">
            <div class="settings-save-row">
              <v-text-field
                v-model="settingsSetName"
                :placeholder="t('common.saveDeckPlaceholder')"
                hide-details
                density="compact"
                variant="outlined"
                autofocus
                @keydown.enter.prevent="saveCurrentExamSettingsSet"
              />
              <v-btn color="success" size="small" variant="flat" class="settings-save-btn" :aria-label="t('common.save')" @click="saveCurrentExamSettingsSet">
                <v-icon size="small">mdi-content-save</v-icon>
              </v-btn>
            </div>
            <div v-if="settingsSaveError" class="settings-error-message">{{ settingsSaveError }}</div>
          </div>

          <div class="saved-decks-section">
            <div v-if="!savedExamSettings.length" class="no-decks">
              {{ t('common.noSavedDecks') }}
            </div>
            <div v-else>
              <div
                v-for="setting in savedExamSettings"
                :key="setting.id"
                class="settings-deck-item"
                @click="applySavedExamSettingsSet(setting)"
              >
                <div class="settings-deck-row">
                  <div class="settings-deck-info">
                    <div class="settings-deck-name">{{ setting.name }}</div>
                    <div class="settings-character-icons">
                      <div v-for="slotIndex in 5" :key="slotIndex" class="settings-icon-slot">
                        <img
                          v-if="savedSettingIcon(setting, slotIndex - 1)"
                          :src="savedSettingIcon(setting, slotIndex - 1)"
                          alt=""
                          class="settings-icon"
                        />
                        <div v-else class="settings-empty-icon">
                          <v-icon size="x-small" color="grey">mdi-account-plus</v-icon>
                        </div>
                      </div>
                    </div>
                  </div>
                  <v-btn size="x-small" color="error" variant="flat" class="settings-delete-btn" :aria-label="t('common.delete')" @click.stop="deleteSavedExamSettingsSet(setting.id)">
                    <v-icon size="default">mdi-trash-can</v-icon>
                  </v-btn>
                </div>
              </div>
            </div>
          </div>

          <div class="settings-close-section">
            <v-btn variant="text" block @click="settingsSaveDialogOpen = false">{{ t('common.close') }}</v-btn>
          </div>
        </div>
      </div>
    </div>

    <SimCharaDetailModal
      v-if="editingDeckDetailCharacter"
      v-model="deckDetailDialogOpen"
      :character="editingDeckDetailCharacter"
      hide-buff-add-button
      hide-buff-section
      @save="saveDeckDetailChanges"
    />

    <SimCharaModal
      v-if="characterDialogOpen"
      :chara-index="selectingDeckIndex"
      :selected-attribute="examTargetAttribute"
      @close="closeCharacterDialog"
      @select="selectDeckCharacter"
    />
  </v-container>
</template>

<script setup lang="ts">
import { computed, markRaw, nextTick, onMounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { Bar } from 'vue-chartjs';
import { Chart, registerables } from 'chart.js';
import defaultImg from '@/assets/img/default.webp';
import fireIcon from '@/assets/img/fire.webp';
import waterIcon from '@/assets/img/water.webp';
import floraIcon from '@/assets/img/flora.webp';
import cosmicIcon from '@/assets/img/cosmic.webp';
import charactersInfo from '@/assets/characters_info.json';
import { useCharacterStore, type Character } from '@/store/characters';
import SimCharaModal from '@/components/SimCharaModal.vue';
import SimCharaDetailModal from '@/components/SimCharaDetailModal.vue';
import { loadCachedImageUrl, loadCharacterImageUrl } from '@/utils/characterAssets';
import { getStatScalingMaxLevel } from '@/constants/levels';
import { atkbuffDict, calculateCharacterStats, criticalDict, dmgbuffDict, healContinueDict, healDict, magicDict, recalculateATK, recalculateHP } from '@/utils/calculations';
import { parseMagicBuffsFromEtc, type ParsedBuff } from '@/utils/buffParser';
import { getPowerOption, processCharacterSelection } from '@/utils/characterSelection';
import { applyBuddyGeneratedBuffOverrides, createBuddyGeneratedBuffs, getBuddyAtkRate, getBuddyStatusForCharacter, splitBuddyEffects } from '@/utils/buddyEffects';
import { clampTotsuCount, isM3Unlocked, isMaxLimitBreak, isTotsuBuddyEnhanced } from '@/utils/totsu';
import { examPresetDefinitions, type ExamPresetDefinition, type ExamSpecialChallengeDefinition, type ExamSpecialChallengeEffect } from '@/utils/examPresets';
import { loadExamSimulatorDeckImportState } from '@/storage/simulatorStorage';
import {
  loadSavedExamSimulatorSettings,
  saveSavedExamSimulatorSettings,
  type SavedExamSimulatorSettings,
} from '@/storage/examSimulatorSettingsStorage';
import {
  localizeCharacterName,
  localizeGameText,
  localizeOptionItems,
} from '@/utils/localizedDisplay';

Chart.register(...registerables);
const { t, locale } = useI18n();

const jpNameToEnName = Object.fromEntries(
  (charactersInfo as Array<{ name_ja: string; name_en: string }>).map((character) => [character.name_ja, character.name_en]),
) as Record<string, string>;
const charaDormMap = Object.fromEntries(
  (charactersInfo as Array<{ name_ja: string; dorm?: string }>).map((character) => [character.name_ja, character.dorm || '']),
) as Record<string, string>;

type ExamKind = 'BASIC' | 'DEFENCE' | 'ATTACK';
type ExamElement = '火' | '水' | '木' | '無' | '全';
type ActionElement = Exclude<ExamElement, '全'>;
type MagicSlot = 1 | 2 | 3;
type ExamCharacter = Character & {
  magic1etc?: string;
  magic2etc?: string;
  magic3etc?: string;
};
type ComboSlotKey = 'firstMagicId' | 'secondMagicId';
type ActiveTab = 'exam' | 'deck' | 'plan' | 'result';
type ScoreCompatibility = 'advantage' | 'equal' | 'disadvantage';
type EnemyMagicPower = '単発(弱)' | '単発(強)' | '2連撃(弱)' | '2連撃(強)' | '3連撃(弱)' | '3連撃(強)';
type EffectTarget = '自' | '相手' | '味方選択' | '相手選択' | '味方全体' | '相手全体';
type EffectKind =
  | 'none'
  | 'atkUp'
  | 'atkDown'
  | 'damageUp'
  | 'damageDown'
  | 'damageTakenDown'
  | 'burn'
  | 'heal'
  | 'continueHeal'
  | 'blind'
  | 'evasion'
  | 'curse'
  | 'freeze'
  | 'debuffRemoval'
  | 'buffRemoval'
  | 'guts';

interface ExamDefinition {
  kind: ExamKind;
  enemyElement: ExamElement;
  difficulty: number;
  enemyHp: number;
}

interface EnemyActionDefinition {
  id: string;
  name: string;
  element: ActionElement;
  power: EnemyMagicPower;
  hitCount: number;
  estimatedDamage: number;
  keepInDeckWhenDamageZero?: boolean;
  effectTarget: EffectTarget;
  effectKind: EffectKind;
  effectAttribute?: ActionElement;
  effectValue: number;
  duration: number;
}

interface EnemySlotDefinition {
  id: string;
  name: string;
  actions: EnemyActionDefinition[];
}

interface DeckSlot {
  character: ExamCharacter | null;
  level: number;
  totsu: number;
  customHp: number;
  customAtk: number;
  maxHp: number;
  maxAtk: number;
  magicLevels: Record<MagicSlot, number>;
  buddyLevels: Record<MagicSlot, number>;
  magicAttributes: Record<MagicSlot, ActionElement>;
  magicPowers: Record<MagicSlot, string>;
  magicHeals: Record<MagicSlot, string>;
  magicEffects: Record<MagicSlot, string>;
  customBuffs: any[];
  selectedMagicSlots: MagicSlot[];
  imageUrl: string;
}

interface MagicCard {
  id: string;
  deckIndex: number;
  magicSlot: MagicSlot;
  element: ActionElement;
  power: string;
  imageUrl: string;
  label: string;
}

interface PlanReferenceCard {
  deckIndex: number;
  imageUrl: string;
  duoPartner: string;
  duoActive: boolean;
  magics: Array<{
    magicSlot: MagicSlot;
    element: ActionElement;
    effectText: string;
  }>;
}

interface TurnCombo {
  id: string;
  firstMagicId: string;
  secondMagicId: string;
  autoGenerated?: boolean;
  allowAutoSwap?: boolean;
}

interface DisplayTurnCombo extends TurnCombo {
  virtual?: boolean;
}

interface TurnPlan {
  turn: number;
  combos: TurnCombo[];
  useElementCompatibilityPriority?: boolean;
}

type SimulationMode = 'normal' | 'autoBest';
type PlayerPair = [string, string];
interface ParsedMagicId {
  deckIndex: number;
  magicSlot: MagicSlot;
}

interface AutoBestDecision {
  turnIndex: number;
  candidates: PlayerPair[];
  checkpoint: AutoBestCheckpoint;
}

interface SimulationRunOptions {
  forcedPairs?: PlayerPair[];
  forcedPairAtCheckpoint?: PlayerPair;
  pauseAtUnforcedDecision?: boolean;
  autoBestMode?: boolean;
  checkpoint?: AutoBestCheckpoint;
}

type StatefulRng = (() => number) & {
  getState: () => number;
  setState: (state: number) => void;
};

interface SimulationRuntimeCache {
  turnLimit: number;
  totalDeckHp: number;
  examKind: ExamKind;
  difficulty: number;
  specialChallengeScore: number;
  specialChallengeLabels: string[];
  runtimeCharacters: Map<number, any>;
  runtimeBuffs: Map<number, any[]>;
  automaticMagicBuffs: Map<string, ParsedBuff[]>;
  automaticOpponentDebuffs: Map<string, ParsedBuff[]>;
  buddyAtk: Map<number, number>;
  magicsById: Map<string, MagicCard | undefined>;
  parsedMagicIds: Map<string, ParsedMagicId | null>;
  visiblePairs: Map<string, PlayerPair[]>;
  duoActive: Map<string, boolean>;
  enemyActionMeta: Map<string, { baseAtk: number; magicRatio: number; rengekiMultiplier: number; hitCount: number }>;
  playerMagicMeta: Map<string, {
    runtimeAtk: number;
    buddyAtk: number;
    magicAttribute: ActionElement;
    adjustedPower: string;
    level: number;
    magicRatio: number;
    attributeAdjust: number;
    rengekiMultiplier: number;
  }>;
  playerEffectPlans: Map<string, Array<{ buff: ParsedBuff; duration: number; targets: number[] }>>;
  continueHealPlans: Map<string, Array<{ rate: number; duration: number; targets: number[] }>>;
  playerHealAmounts: Map<string, number>;
  playerDamageResult: Record<string, any>;
  enemyDamageResult: Record<string, any>;
  emptyHitDamages: number[];
  pendingResult: { pendingDecision?: AutoBestDecision };
}

interface AutoBestCheckpoint {
  turnIndex: number;
  enemyDeck: Array<RuntimeEnemyAction | undefined>;
  handState: { visible: string[]; hidden: string[] };
  state: SimulationState;
  stats: SimulationStats;
  playerHp: number;
  enemyHp: number;
  enemyMaxHp: number;
  rngState: number;
}

interface AutoBestProgress {
  completedIterations: number;
  totalIterations: number;
  currentIteration: number;
  exploredNodes: number;
  completedPatterns: number;
  queuedBranches: number;
  provisionalBestScore: number;
  elapsedMs: number;
  stopped: boolean;
}

interface AutoBestSeedSearchResult {
  bestResult: SimulationStats | null;
  bestPlan: PlayerPair[];
  exploredNodes: number;
  completedPatterns: number;
  queuedBranches: number;
  cancelled: boolean;
}

interface AutoBestRootRange {
  start: number;
  end: number;
}
interface AutoBestWorkerSnapshot {
  exam: ExamDefinition;
  enemySlots: EnemySlotDefinition[];
  deck: DeckSlot[];
  selectedSpecialChallengeIds: string[];
}
interface AutoBestWorkerProgress {
  exploredNodes: number;
  completedPatterns: number;
  queuedBranches: number;
  provisionalBestScore: number;
}
interface AutoBestWorkerClient {
  worker: Worker;
  ready: Promise<void>;
  nextRequestId: number;
  initializedRunToken: number;
  requests: Map<number, {
    resolve: (result: AutoBestSeedSearchResult) => void;
    reject: (error: Error) => void;
    onProgress: (progress: AutoBestWorkerProgress) => void;
  }>;
}



interface ExamSettingsPayload {
  deck: Array<Record<string, any>>;
  turnPlans: TurnPlan[];
  useElementCompatibilityPriority?: boolean;
  useAllElementSmartSelection?: boolean;
}

interface BattleLogEntry {
  line: string;
  displayLine: string;
  side: 'enemy' | 'player' | 'system';
  emphasized?: boolean;
  icon?: string;
  targetIcon?: string;
  sourceElement?: ActionElement;
  targetElement?: ActionElement;
  label?: string;
  targetLabel?: string;
}

interface BattleLogGroup {
  title: string;
  entries: BattleLogEntry[];
}

interface RuntimeEnemyAction extends EnemyActionDefinition {
  slotKey: string;
  slotName: string;
  slotLabel: string;
  identity: string;
}

interface TimedRate {
  rate: number;
  turns: number;
  attributeOption?: ActionElement;
  targetEnemySlotKey?: string;
  source?: string;
  isBuddyGenerated?: boolean;
}

interface TargetedTimedRate extends TimedRate {
  cardIndex: number;
}

interface TimedCount {
  count: number;
  turns: number;
  targetEnemySlotKey?: string;
}

interface TargetedTimedCount {
  cardIndex: number;
  count: number;
  turns: number;
  source?: string;
  isBuddyGenerated?: boolean;
}

interface BurnState {
  cardIndex: number;
  rate: number;
  turns: number;
}

interface ContinueHealState {
  cardIndex: number;
  rate: number;
  turns: number;
  source?: string;
  isBuddyGenerated?: boolean;
}

interface ContinueHealDetail {
  cardIndex: number;
  source: string;
  amount: number;
  potentialAmount: number;
  capped: boolean;
}

interface ContinueHealResult {
  total: number;
  details: ContinueHealDetail[];
}

interface TimedPlayerBuff {
  targetDeckIndex: number;
  buff: ParsedBuff | any;
  turns: number;
  source?: string;
}

interface EnemyContinueHealState {
  amount: number;
  turns: number;
  source?: string;
  targetEnemySlotKey?: string;
}

type PlayerImmunityKind = 'burn' | 'blind' | 'curse' | 'freeze';

interface PlayerImmunityState {
  cardIndex: number;
  kind: PlayerImmunityKind;
  turns: number;
  source?: string;
  isBuddyGenerated?: boolean;
}

interface SimulationStats {
  score: number;
  retired: boolean;
  retireReason: string;
  playerDamage: number;
  enemyDamage: number;
  enemyHeal: number;
  playerHeal: number;
  burnDamage: number;
  playerRemainHp: number;
  playerTotalHp: number;
  enemyRemainHp: number;
  enemyMaxHp: number;
  finishTurn: number;
  duo: number;
  advantage: number;
  equal: number;
  disadvantage: number;
  advantageCombo: number;
  equalCombo: number;
  disadvantageCombo: number;
  advantageSingle: number;
  equalSingle: number;
  disadvantageSingle: number;
  advantageDamaged: number;
  disadvantageDamaged: number;
  evasion: number;
  debuff: number;
  scoreBuff: number;
  healBlock: number;
  miss: number;
  fallback: number;
  specialChallengeScore: number;
  specialChallengeLabels: string[];
  pendingDecision?: AutoBestDecision;
  log?: string[];
}

interface SimulationResultAggregate {
  count: number;
  retiredCount: number;
  positiveScoreCount: number;
  scoreFrequencies: Record<number, number>;
  retireReasonFrequencies: Record<string, number>;
  retireTurnFrequencies: Record<number, number>;
}

type SimulationStateArrayKey = Exclude<keyof SimulationState, '_ownedMask'>;

interface SimulationState {
  _ownedMask?: number;
  playerAttackDowns: TargetedTimedRate[];
  playerDamageDowns: TargetedTimedRate[];
  playerEvasions: TargetedTimedRate[];
  enemyDamageReductions: TimedRate[];
  enemyDamageNulls: TimedRate[];
  enemyEvasions: TimedRate[];
  enemyCriticals: TimedRate[];
  enemyAttackDowns: TimedRate[];
  enemyDamageDowns: TimedRate[];
  enemyDamageTakenUps: TimedRate[];
  enemyCurses: TimedRate[];
  enemyBlinds: TimedRate[];
  enemyFreezes: TimedRate[];
  playerBlinds: TargetedTimedRate[];
  playerCurses: TargetedTimedRate[];
  playerFreezes: TargetedTimedRate[];
  burns: BurnState[];
  playerDamageTakenDowns: TargetedTimedRate[];
  playerDamageTakenUps: TargetedTimedRate[];
  playerContinueHeals: ContinueHealState[];
  playerImmunities: PlayerImmunityState[];
  playerGuts: TargetedTimedCount[];
  playerBuffs: TimedPlayerBuff[];
  enemyAttackUps: TimedRate[];
  enemyDamageUps: TimedRate[];
  enemyGuts: TimedCount[];
  enemyContinueHeals: EnemyContinueHealState[];
}

const examKindOptions = [
  { title: 'BS', value: 'BASIC' },
  { title: 'DF', value: 'DEFENCE' },
  { title: 'ATK', value: 'ATTACK' },
];
const elementOptions: ExamElement[] = ['火', '水', '木', '無', '全'];
const actionElementOptions: ActionElement[] = ['火', '水', '木', '無'];
const enemyMagicPowerOptions: EnemyMagicPower[] = ['単発(弱)', '単発(強)', '2連撃(弱)', '2連撃(強)', '3連撃(弱)', '3連撃(強)'];
const magicSlotOptions: MagicSlot[] = [1, 2, 3];
const effectTargetOptions: EffectTarget[] = ['自', '相手', '味方選択', '相手選択', '味方全体', '相手全体'];
const elementOptionItems = computed(() => localizeOptionItems(elementOptions, locale.value));
const actionElementOptionItems = computed(() => localizeOptionItems(actionElementOptions, locale.value));
const enemyMagicPowerOptionItems = computed(() => localizeOptionItems(enemyMagicPowerOptions, locale.value));
const effectTargetOptionItems = computed(() => localizeOptionItems(effectTargetOptions, locale.value));
const durationOptions = [1, 2, 3, 4, 5];
const totsuOptions = [0, 1, 2, 3, 4].map((value) => ({
  title: value.toString(),
  value,
}));
const evasionRateByPower: Record<string, number> = {
  極小: 9.2,
  小: 14.8,
  中: 23.7,
  大: 38.0,
  極大: 61.0,
};
const blindRateByPower: Record<string, number> = {
  中: 21.6,
};
const atkRatePowerScale: Record<string, number> = {
  極小: 10,
  小: 20,
  中: 35,
  大: 50,
  極大: 80,
};
const damageRatePowerScale: Record<string, number> = {
  極小: 2.5,
  小: 5,
  中: 8.75,
  大: 12.5,
  極大: 22.5,
};
const attributeDamageRatePowerScale: Record<string, number> = {
  極小: 3,
  小: 6,
  中: 10.5,
  大: 15,
  極大: 27,
};
const evasionRatePowerScale = evasionRateByPower;
const blindRatePowerScale: Record<string, number> = {
  中: 21.6,
};
const curseRatePowerScale: Record<string, number> = {
  極小: 22.3,
  小: 33.4,
  中: 44.6,
  大: 66.9,
  極大: 100,
};
const freezeRatePowerScale: Record<string, number> = {
  極小: 22.3,
  小: 33.4,
  中: 44.6,
  大: 66.9,
  極大: 100,
};
const criticalRatePowerScale: Record<string, number> = {
  極小: 10,
  小: 19.1,
  中: 33.3,
  大: 50,
  極大: 100,
};
const CRITICAL_DAMAGE_MULTIPLIER = 1.25;
const buddyInitialEffectTurns = 99;
const buddyContinueHealRate = 0.1;
const buddyImmunityKinds: Record<string, PlayerImmunityKind> = {
  やけど無効: 'burn',
  暗闇無効: 'blind',
  呪い無効: 'curse',
  凍結無効: 'freeze',
};
const difficultyOptions = [
  { title: 'Easy', value: 0.8 },
  { title: 'Normal', value: 1 },
  { title: 'Hard', value: 1.2 },
  { title: 'Extra', value: 1.5 },
];
const rawEffectOptions: { title: string; value: EffectKind }[] = [
  { title: 'なし', value: 'none' },
  { title: 'ATKUP', value: 'atkUp' },
  { title: 'ATKDOWN', value: 'atkDown' },
  { title: 'ダメージUP', value: 'damageUp' },
  { title: 'ダメージDOWN', value: 'damageDown' },
  { title: '被ダメDOWN', value: 'damageTakenDown' },
  { title: 'やけど', value: 'burn' },
  { title: '回復', value: 'heal' },
  { title: '継続回復', value: 'continueHeal' },
  { title: '暗闇', value: 'blind' },
  { title: '回避', value: 'evasion' },
  { title: '呪い', value: 'curse' },
  { title: '凍結', value: 'freeze' },
  { title: 'デバフ解除', value: 'debuffRemoval' },
  { title: 'バフ解除', value: 'buffRemoval' },
  { title: 'ガッツ', value: 'guts' },
];
const effectOptions = computed(() => rawEffectOptions.map((option) => ({
  ...option,
  title: localizeGameText(option.title, locale.value),
})));
const sortedExamPresets = computed(() => [...examPresetDefinitions]
  .sort((a, b) => b.title.localeCompare(a.title, 'ja')));
const isUnifiedExamPreset = (preset: ExamPresetDefinition) => preset.title.includes('統一') || (preset.specialChallenges?.length ?? 0) > 0;
const unifiedElementOrder: Record<ExamElement, number> = {
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
  apply: () => applyExamPreset(preset),
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
const SIMULATION_GRAPH_UPDATE_INTERVAL_MS = 500;
const AUTO_BEST_PROGRESS_UPDATE_INTERVAL_MS = 500;
const scoreDistributionOptions = computed(() => {
  const percentageDataset = scoreDistributionData.value.datasets.find((dataset: any) => dataset.yAxisID === 'percentage');
  const values = (percentageDataset?.data ?? []) as number[];
  const yRange = calculatePercentageAxisRange(values);
  return {
    responsive: true,
    maintainAspectRatio: false,
    animation: isRunning.value ? false as const : { duration: 120 },
    scales: {
      count: {
        type: 'linear' as const,
        position: 'left' as const,
        beginAtZero: true,
        ticks: { precision: 0 },
        title: { display: true, text: t('examSimulator.count') },
        grid: { drawOnChartArea: true },
      },
      percentage: {
        type: 'linear' as const,
        position: 'right' as const,
        min: yRange.min,
        max: yRange.max,
        title: { display: true, text: t('examSimulator.achievementRate') },
        ticks: {
          callback: (value: string | number) => `${formatTruncatedDecimal(value, 2)}%`,
        },
        grid: { drawOnChartArea: false },
      },
    },
    plugins: {
      legend: { display: true },
      tooltip: {
        mode: 'index' as const,
        intersect: false,
        callbacks: {
          label: (context: any) => {
            if (context.dataset.yAxisID === 'percentage') {
              const threshold = scoreBuckets.value.thresholds[context.dataIndex];
              const thresholdText = threshold !== undefined
                ? t('examSimulator.atLeast', { value: formatNumber(threshold) })
                : context.label;
              return `${t('examSimulator.achievementRate')} (${thresholdText}): ${formatPercentage(context.parsed.y)}%`;
            }
            return `${t('examSimulator.count')}: ${formatNumber(context.parsed.y)}`;
          },
        },
      },
    },
  };
});

function createRetireDistributionOptions(kind: 'reason' | 'turn') {
  return {
    responsive: true,
    maintainAspectRatio: false,
    animation: isRunning.value ? false as const : { duration: 120 },
    indexAxis: kind === 'reason' ? 'y' as const : 'x' as const,
    scales: {
      x: {
        beginAtZero: true,
        ticks: { precision: 0 },
        title: { display: kind === 'reason', text: t('examSimulator.count') },
      },
      y: {
        beginAtZero: true,
        ticks: { precision: 0 },
        title: { display: kind === 'turn', text: t('examSimulator.count') },
      },
    },
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: (context: any) => {
            const count = kind === 'reason'
              ? Number(context.parsed.x ?? 0)
              : Number(context.parsed.y ?? 0);
            const total = simulationAggregate.value?.retiredCount ?? 0;
            const rate = total > 0 ? (count / total) * 100 : 0;
            return `${t('examSimulator.count')}: ${formatNumber(count)} (${formatPercentage(rate)}%)`;
          },
        },
      },
    },
  };
}

let nextId = 0;
function makeId(prefix: string) {
  nextId += 1;
  return `${prefix}-${nextId}`;
}

function enemyName(index: number) {
  return `${t('examSimulator.enemy')}${index + 1}`;
}

function displayEnemySlotName(name: string, index: number) {
  return localizeGameText(name || enemyName(index), locale.value);
}

function updateEditingEnemySlotName(value: unknown) {
  if (!editingEnemySlot.value) return;
  editingEnemySlot.value.name = String(value ?? '');
}

function duoReferenceTitle(entry: { duoPartner: string; duoActive: boolean }) {
  const name = localizeCharacterName(entry.duoPartner, locale.value);
  return entry.duoActive
    ? t('simulator.duoPartnerShortActive', { name })
    : t('simulator.duoPartnerShortInactive', { name });
}

function displayPresetTitle(title: string) {
  return localizeGameText(title, locale.value);
}

function localizeExamLogText(text: string) {
  return localizeGameText(text, locale.value);
}

function specialChallengeRankLabel(rank: number) {
  if (rank === 3) return '③';
  if (rank === 2) return '②';
  return '①';
}

const exam = ref<ExamDefinition>({
  kind: 'DEFENCE',
  enemyElement: '木',
  difficulty: 1.5,
  enemyHp: 95000,
});

const enemySlots = ref<EnemySlotDefinition[]>([
  createEnemySlot('敵1'),
  createEnemySlot('敵2'),
  createEnemySlot('敵3'),
]);
const deck = ref<DeckSlot[]>(Array.from({ length: 5 }, () => createEmptyDeckSlot()));
const deckLevelInputTexts = ref<string[]>(Array.from({ length: 5 }, (_, index) => String(deck.value[index]?.level ?? 1)));
const deckLevelFocusPrefixes = ref<string[]>(Array.from({ length: 5 }, () => ''));
const turnPlans = ref<TurnPlan[]>(Array.from({ length: 5 }, (_, index) => ({
  turn: index + 1,
  combos: [createTurnCombo('', '', true)],
  useElementCompatibilityPriority: false,
})));
const openedTurnPanels = ref<number[]>([0, 1, 2, 3, 4]);
const simulationMode = ref<SimulationMode>('normal');
const normalIterations = ref(10000);
const autoBestIterations = ref(1000);
const iterations = computed<number>({
  get: () => simulationMode.value === 'autoBest' ? autoBestIterations.value : normalIterations.value,
  set: (value) => {
    if (simulationMode.value === 'autoBest') autoBestIterations.value = value;
    else normalIterations.value = value;
  },
});
const seed = ref(-1);
const isRunning = ref(false);
const stopRequested = ref(false);
const autoBestProgress = ref<AutoBestProgress | null>(null);
let simulationRuntimeCache: SimulationRuntimeCache | null = null;
let autoBestWorkerPool: AutoBestWorkerClient[] | null = null;
let autoBestWorkerPoolPromise: Promise<AutoBestWorkerClient[]> | null = null;
let autoBestRunToken = 0;
let autoBestSnapshotKey = '';
let autoBestRootWeights: number[] | null = null;
const simulationAggregate = ref<SimulationResultAggregate | null>(null);
const bestSimulationResult = ref<SimulationStats | null>(null);
const simulationResultGeneration = ref(0);
const imageCache = ref<Record<string, string>>({});
const duoIconCache = ref<Record<string, string>>({});
const characterDialogOpen = ref(false);
const selectingDeckIndex = ref(0);
const deckDetailDialogOpen = ref(false);
const editingDeckIndex = ref(0);
const editingDeckDetailCharacter = ref<any | null>(null);
const draggingMagicId = ref('');
const draggingCombo = ref<{ turnIndex: number; comboIndex: number } | null>(null);
const dragOverComboIndex = ref<number | null>(null);
const activeTab = ref<ActiveTab>('exam');
const activeTurnIndex = ref(0);
const activeComboIndex = ref(0);
const activeComboSlot = ref<ComboSlotKey>('firstMagicId');
const magicPickerOpen = ref(false);
const enemyDialogOpen = ref(false);
const editingEnemySlotIndex = ref(0);
const logDialogOpen = ref(false);
const settingsSaveDialogOpen = ref(false);
const settingsSetName = ref('');
const settingsSaveError = ref('');
const savedExamSettings = ref<SavedExamSimulatorSettings[]>([]);
const enemyConditionsTouched = ref(false);
const runAttemptWarning = ref('');
const activeExamPresetId = ref('');
const selectedSpecialChallengeIds = ref<string[]>([]);

const selectedCharacters = computed(() => deck.value.map((slot) => slot.character).filter((character): character is Character => !!character));
const charaDict = computed(() => Object.fromEntries(selectedCharacters.value.map((character) => [character.chara, true])));
const fixedEnemyActionElement = computed<ActionElement | null>(() => (exam.value.enemyElement === '全' ? null : exam.value.enemyElement));
const examTargetAttribute = computed(() => (exam.value.enemyElement === '全' ? '対全' : `対${exam.value.enemyElement}`));
const magicCards = computed<MagicCard[]>(() => deck.value.flatMap((slot, deckIndex) => {
  if (!slot.character) return [];
  return slot.selectedMagicSlots.map((magicSlot) => {
    const character = slot.character as Character;
    return {
      id: makeMagicId(deckIndex, magicSlot),
      deckIndex,
      magicSlot,
      element: slot.magicAttributes[magicSlot],
      power: getMagicPower(deckIndex, magicSlot),
      imageUrl: slot.imageUrl,
      label: `${character.chara} M${magicSlot}`,
    };
  });
}));
const handMagicIds = computed(() => deck.value.flatMap((slot, deckIndex) => {
  if (!slot.character) return [];
  const available = availableMagicSlots(slot);
  const selected = slot.selectedMagicSlots.filter((magicSlot) => available.includes(magicSlot)).slice(0, 2);
  const invalid = available
    .filter((magicSlot) => !selected.includes(magicSlot))
    .slice(0, Math.max(0, 2 - selected.length))
    .map((magicSlot) => makeInvalidMagicId(deckIndex, magicSlot));
  return [
    ...selected.map((magicSlot) => makeMagicId(deckIndex, magicSlot)),
    ...invalid,
  ];
}));
const magicMap = computed(() => Object.fromEntries(magicCards.value.map((magic) => [magic.id, magic])));
const totalDeckHp = computed(() => deck.value.reduce((sum, _slot, index) => sum + deckCardTotalHp(index), 0));
const maxTurnCount = computed(() => (exam.value.kind === 'ATTACK' ? 10 : 5));
const currentTurnPlan = computed(() => turnPlans.value[activeTurnIndex.value] ?? null);
const allTurnElementCompatibilityPriority = computed({
  get: () => turnPlans.value.length > 0 && turnPlans.value.every((turn) => turn.useElementCompatibilityPriority === true),
  set: (enabled: boolean) => {
    setAllTurnElementCompatibilityPriority(enabled);
  },
});
const currentTurnDisplayCombos = computed<DisplayTurnCombo[]>(() => {
  const combos = currentTurnPlan.value?.combos ?? [];
  const hasIncomplete = combos.some((combo) => !combo.firstMagicId || !combo.secondMagicId);
  if (hasIncomplete) return combos;
  return [
    ...combos,
    {
      id: `virtual-combo-${activeTurnIndex.value}`,
      firstMagicId: '',
      secondMagicId: '',
      virtual: true,
    },
  ];
});
const currentCombo = computed(() => currentTurnPlan.value?.combos[activeComboIndex.value] ?? null);
const magicChoiceRows = computed(() => deck.value.map((slot, deckIndex) => ({
  deckIndex,
  imageUrl: slot.imageUrl,
  choices: ([1, 2, 3] as MagicSlot[]).map((magicSlot) => ({
    slot: magicSlot,
    magic: magicMap.value[makeMagicId(deckIndex, magicSlot)] ?? null,
  })),
})));
const planReferenceCards = computed<PlanReferenceCard[]>(() => deck.value.flatMap((slot, deckIndex) => {
  if (!slot.character) return [];
  const magics = slot.selectedMagicSlots
    .slice()
    .sort((a, b) => a - b)
    .map((magicSlot) => ({
      magicSlot,
      element: slot.magicAttributes[magicSlot],
      effectText: planReferenceEffectLines(deckIndex, magicSlot).join(' / ') || '効果なし',
    }));
  return [{
    deckIndex,
    imageUrl: slot.imageUrl,
    duoPartner: String(slot.character.duo || ''),
    duoActive: !!slot.character.duo && charaDict.value[slot.character.duo] === true,
    magics,
  }];
}));
const editingEnemySlot = computed(() => enemySlots.value[editingEnemySlotIndex.value] ?? null);
const activePreset = computed(() => examPresetDefinitions.find((preset) => preset.id === activeExamPresetId.value) ?? null);
const availableSpecialChallenges = computed<ExamSpecialChallengeDefinition[]>(() => activePreset.value?.specialChallenges ?? []);
const selectedSpecialChallenges = computed<ExamSpecialChallengeDefinition[]>(() => {
  const selectedIds = new Set(selectedSpecialChallengeIds.value);
  return availableSpecialChallenges.value.filter((challenge) => selectedIds.has(challenge.id));
});
const selectedSpecialChallengeScore = computed(() => selectedSpecialChallenges.value.reduce((sum, challenge) => sum + safeNumber(challenge.score), 0));

interface ValidationIssue {
  tab: ActiveTab;
  message: string;
}

const validationIssues = computed<ValidationIssue[]>(() => {
  const issues: ValidationIssue[] = [];
  if (selectedCharacters.value.length !== 5) issues.push({ tab: 'deck', message: t('examSimulator.validation.selectFiveCards') });
  if (enemyActionPool().length === 0) issues.push({ tab: 'exam', message: t('examSimulator.validation.enterEnemyAction') });
  if (totalDeckHp.value <= 0) issues.push({ tab: 'deck', message: t('examSimulator.validation.deckHpUnavailable') });
  return issues;
});
const validationMessage = computed(() => validationIssues.value[0]?.message ?? '');
const visibleValidationMessage = computed(() => {
  const tabValidation = validationIssues.value.find((issue) => issue.tab === activeTab.value);
  if (tabValidation) return tabValidation.message;
  return activeTab.value === 'exam' ? runAttemptWarning.value : '';
});

const resultSummary = computed(() => {
  if (!simulationAggregate.value?.count) return null;
  return {
    count: simulationAggregate.value.count,
    retiredCount: simulationAggregate.value.retiredCount,
  };
});

const RETIRE_REASON_BUCKETS = [
  '手札無し',
  '敗北',
] as const;

const retireReasonDistributionData = computed<any>(() => {
  const aggregate = simulationAggregate.value;
  if (!aggregate?.count) return { labels: [], datasets: [] };
  const knownReasons = RETIRE_REASON_BUCKETS.map((reason) => [reason, aggregate.retireReasonFrequencies[reason] ?? 0] as const);
  const extraReasons = Object.entries(aggregate.retireReasonFrequencies)
    .filter(([reason]) => !RETIRE_REASON_BUCKETS.includes(reason as typeof RETIRE_REASON_BUCKETS[number]))
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'ja'));
  const entries = [...knownReasons, ...extraReasons];
  return {
    labels: entries.map(([reason]) => localizeExamLogText(reason)),
    datasets: [{
      label: t('examSimulator.count'),
      data: entries.map(([, count]) => count),
      backgroundColor: '#b35d5d',
      borderColor: '#8f3d3d',
      borderWidth: 1,
    }],
  };
});

const retireTurnDistributionData = computed<any>(() => {
  const aggregate = simulationAggregate.value;
  if (!aggregate?.retiredCount) return { labels: [], datasets: [] };
  const turnCount = maxTurnCount.value;
  const turns = Array.from({ length: turnCount }, (_, index) => index + 1);
  return {
    labels: turns.map((turn) => `${turn}T`),
    datasets: [{
      label: t('examSimulator.count'),
      data: turns.map((turn) => aggregate.retireTurnFrequencies[turn] ?? 0),
      backgroundColor: '#7d8fb3',
      borderColor: '#526b94',
      borderWidth: 1,
    }],
  };
});

const retireReasonDistributionOptions = computed(() => createRetireDistributionOptions('reason'));
const retireTurnDistributionOptions = computed(() => createRetireDistributionOptions('turn'));

const scoreBuckets = computed(() => {
  const aggregate = simulationAggregate.value;
  const scoreEntries = Object.entries(aggregate?.scoreFrequencies ?? {})
    .map(([score, count]) => [Number(score), count] as const)
    .filter(([score, count]) => Number.isFinite(score) && count > 0)
    .sort((a, b) => a[0] - b[0]);
  const total = aggregate?.positiveScoreCount ?? scoreEntries.reduce((sum, [, count]) => sum + count, 0);
  if (!scoreEntries.length || total <= 0) return { labels: [] as string[], thresholds: [] as number[], buckets: [] as number[], total: 0 };
  const min = scoreEntries[0]?.[0] ?? 0;
  const max = scoreEntries[scoreEntries.length - 1]?.[0] ?? min;
  const bucketCount = Math.min(30, Math.max(8, Math.ceil(Math.sqrt(total))));
  const width = Math.max(1, Math.ceil(((max - min + 1) / bucketCount) / 100) * 100);
  const start = Math.floor(min / width) * width;
  const buckets = Array.from({ length: Math.ceil((max - start + 1) / width) || 1 }, () => 0);
  scoreEntries.forEach(([score, count]) => {
    const index = Math.min(buckets.length - 1, Math.max(0, Math.floor((score - start) / width)));
    buckets[index] += count;
  });
  return {
    labels: buckets.map((_, index) => `${formatNumber(start + index * width)}-${formatNumber(start + (index + 1) * width - 1)}`),
    thresholds: buckets.map((_, index) => start + index * width),
    buckets,
    total,
  };
});
const scoreDistributionData = computed<any>(() => {
  const bucketData = scoreBuckets.value;
  if (!bucketData.total) return { labels: [], datasets: [] };
  const aggregate = simulationAggregate.value;
  const total = aggregate?.count || bucketData.total;
  const achievementData = Array.from({ length: bucketData.buckets.length }, () => 0);
  let belowCurrentBandCount = Math.max(0, total - bucketData.total);
  bucketData.buckets.forEach((count, index) => {
    achievementData[index] = roundPercentage(((total - belowCurrentBandCount) / total) * 100);
    belowCurrentBandCount += count;
  });
  return {
    labels: bucketData.labels,
    datasets: [
      {
        type: 'bar' as const,
        label: t('examSimulator.count'),
        data: bucketData.buckets,
        yAxisID: 'count',
        backgroundColor: '#4f7cac',
        borderColor: '#254f72',
        borderWidth: 1,
        order: 2,
      },
      {
        type: 'line' as const,
        label: t('examSimulator.achievementRate'),
        data: achievementData,
        yAxisID: 'percentage',
        borderColor: '#d36b36',
        backgroundColor: 'rgba(211, 107, 54, 0.14)',
        pointRadius: 2,
        tension: 0.2,
        fill: false,
        order: 1,
      },
    ],
  };
});
const scoreDistributionChartData = computed<any>(() => scoreDistributionData.value);
const bestResult = computed(() => bestSimulationResult.value);
const bestLog = computed(() => bestResult.value?.log ?? []);
const bestLogTitle = computed(() => {
  if (!bestResult.value) return t('examSimulator.bestScoreLog');
  const suffix = bestResult.value.retired
    ? ` / ${t('examSimulator.retire')}: ${localizeExamLogText(bestResult.value.retireReason)}`
    : '';
  return `${t('examSimulator.bestScoreLogWithScore', { score: formatNumber(bestResult.value.score) })}${suffix}`;
});
const groupedBestLog = computed<BattleLogGroup[]>(() => {
  const groups: BattleLogGroup[] = [];
  bestLog.value.forEach((line) => {
    if (!shouldShowBestLogLine(line)) return;
    const title = logTurnTitle(line);
    let group = groups[groups.length - 1];
    if (!group || group.title !== title) {
      group = { title, entries: [] };
      groups.push(group);
    }
    group.entries.push(buildBattleLogEntry(line));
  });
  return groups;
});

function shouldShowBestLogLine(line: string) {
  return !line.includes('自分手札')
    && !line.includes('相手予定')
    && !isSelectionLogLine(line);
}

watch(maxTurnCount, (turnCount) => {
  syncTurnPlans(turnCount);
}, { immediate: true });

watch(() => exam.value.enemyElement, () => {
  syncEnemyActionElementsToExam();
}, { immediate: true });

watch(exam, markEnemyConditionsTouched, { deep: true });
watch(enemySlots, markEnemyConditionsTouched, { deep: true });
watch(
  [exam, enemySlots, deck, turnPlans, selectedSpecialChallengeIds],
  () => {
    clearResults();
    if (isRunning.value) requestSimulationStop();
  },
  { deep: true },
);
watch(simulationMode, (mode) => {
  clearResults();
  if (isRunning.value) requestSimulationStop();
  if (mode === 'autoBest' && !autoBestWorkerPool) {
    setTimeout(() => {
      if (simulationMode.value === 'autoBest' && !autoBestWorkerPool) void ensureAutoBestWorkerPool().catch(() => undefined);
    }, 0);
  }
});

function markEnemyConditionsTouched() {
  enemyConditionsTouched.value = true;
  runAttemptWarning.value = '';
}

function syncTurnPlans(turnCount: number) {
  const normalized = Math.min(10, Math.max(1, Math.floor(safeNumber(turnCount) || 1)));
  const enableNewTurns = turnPlans.value.length > 0 && turnPlans.value.every((turn) => turn.useElementCompatibilityPriority === true);
  while (turnPlans.value.length < normalized) {
    turnPlans.value.push({
      turn: turnPlans.value.length + 1,
      combos: [createTurnCombo('', '', true, enableNewTurns)],
      useElementCompatibilityPriority: enableNewTurns,
    });
  }
  if (turnPlans.value.length > normalized) {
    turnPlans.value.splice(normalized);
  }
  if (activeTurnIndex.value >= normalized) activeTurnIndex.value = normalized - 1;
  openedTurnPanels.value = Array.from({ length: normalized }, (_, index) => index);
  ensureActiveComboTarget();
}

watch(activeTurnIndex, () => {
  ensureActiveComboTarget();
});

watch(activeTab, (tab) => {
  if (tab !== 'plan') cancelMagicPicker();
});

onMounted(() => {
  savedExamSettings.value = loadSavedExamSimulatorSettings();
  void restoreDeckFromSimulatorImport();
  window.setTimeout(() => {
    void ensureAutoBestWorkerPool().catch(() => undefined);
  }, 500);
});

function logTurnTitle(line: string) {
  if (line.startsWith('開始')) return '開始';
  const turnMatch = line.match(/^(\d+)T/);
  if (turnMatch) return `${turnMatch[1]}T`;
  if (line.startsWith('結果')) return '結果';
  if (line.startsWith('スコア内訳')) return 'スコア';
  if (line.startsWith('リタイア')) return 'リタイア';
  return 'その他';
}

function buildBattleLogEntry(line: string): BattleLogEntry {
  const displayLine = formatBattleLogLine(line);
  const emphasized = isHighlightedLogLine(line);
  if (isSystemLogLine(line)) {
    return { line, displayLine, side: 'system', emphasized };
  }
  if (line.includes('相手効果') || line.includes(' 相手 ')) {
    const label = enemyLogLabel(displayLine);
    return {
      line,
      displayLine: stripEnemyLogLabel(displayLine),
      side: 'enemy',
      emphasized,
      label,
      targetIcon: enemyLogTargetIcon(line),
      targetLabel: enemyLogTargetLabel(line, label),
      sourceElement: enemyLogSourceElement(line),
      targetElement: enemyLogTargetElement(line),
    };
  }
  if (line.includes(' 自分 ') || line.includes('自分効果') || line.includes('自分回復') || line.includes('継続回復')) {
    return {
      line,
      displayLine,
      side: 'player',
      emphasized,
      icon: playerLogIcon(line),
      targetLabel: playerLogTargetLabel(line),
      sourceElement: playerLogSourceElement(line),
      targetElement: playerLogTargetElement(line),
    };
  }
  return { line, displayLine, side: 'system' };
}

function isHighlightedLogLine(line: string) {
  if (line.startsWith('スコア内訳')) return false;
  return line.includes('回避')
    || line.includes('クリティカル')
    || line.includes('暗闇');
}

function formatBattleLogLine(line: string) {
  let text = line.replace(/^\d+T\s+/, '');
  text = text.replace(/^(先手|後手)\s+/, '');
  text = text.replace(/^相手効果\s+/, '');
  text = text.replace(/^自分効果\s+/, '効果 ');
  text = text.replace(/^自分回復\s+/, '回復 ');
  text = text.replace(/^自分\s+/, '');
  text = text.replace(/^相手\s+/, '');
  text = stripPlayerCardNames(text);
  text = stripInlineEnemyLabels(text);
  text = stripInlineElementTexts(text);
  text = stripArrowTargetLabels(text);
  text = stripInlineElementTexts(text);
  text = stripLogCalculationDetails(text);
  if (!isSelectionLogLine(line)) text = stripInlineTargetMagic(text);
  text = text.replace(/\s*->\s*/g, ' / ');
  text = text.replace(/\s+\/\s+\/\s+/g, ' / ');
  return text.trim();
}

function enemyLogLabel(displayLine: string) {
  const match = displayLine.match(/^([^:：\s/]+)[:：]/);
  return match?.[1] || '敵';
}

function stripEnemyLogLabel(displayLine: string) {
  return displayLine.replace(/^[^:：\s/]+[:：]\s*/, '');
}

function stripPlayerCardNames(text: string) {
  return text.replace(/[^/\s]+\/[^\s]+\s+(M[123]\()/g, '$1');
}

function stripInlineElementTexts(text: string) {
  return text
    .replace(/(M[123]\()([火水木無]),\s*/g, '$1')
    .replace(/(\S+\()([火水木無]),\s*/g, '$1')
    .replace(/\s*受け[火水木無]\s*/g, ' ')
    .replace(/->\s*[火水木無]\s*\/\s*/g, '-> ')
    .replace(/->\s*[火水木無]\s+(与[\d,]+)/g, '-> $1')
    .replace(/\s\/\s[火水木無]\s+(与[\d,]+)/g, ' / $1');
}

function stripLogCalculationDetails(text: string) {
  return text
    .replace(/,\s*等倍[\d,]+/g, '')
    .replace(/,\s*ATK[\d,]+/g, '')
    .replace(/\s+ATK[\d,]+/g, '')
    .replace(/\s*\/\s*逆算ATK[\d,]+/g, '')
    .replace(/\s*\/\s*等倍[\d,]+/g, '')
    .replace(/\s*\/\s*ATK[\d,]+/g, '')
    .replace(/\s*\[[\d,+]+\]/g, '')
    .replace(/\s+受け\s+(被[\d,]+)/g, ' $1')
    .replace(/\s+受け(?=\s|\/|$)/g, '');
}

function stripInlineEnemyLabels(text: string) {
  return text.replace(/(先手|後手)\s+([^:：\s/]+)[:：]\s*/g, '$1 ');
}

function stripArrowTargetLabels(text: string) {
  return text
    .replace(/->\s*相手全体\s*\/\s*/g, '-> ')
    .replace(/->\s*([^:：\s/]+)[:：]\s*/g, '-> ');
}

function stripInlineTargetMagic(text: string) {
  return text.replace(/->\s*M[123]\((?:[^()]|\([^()]*\))*\)\s*/g, '-> ');
}

function enemyLogTargetIcon(line: string) {
  const targetText = line.split('->')[1] || '';
  return playerLogIcon(targetText);
}

function enemyLogSourceElement(line: string): ActionElement | undefined {
  return extractActionElement(line);
}

function enemyLogTargetElement(line: string): ActionElement | undefined {
  const targetText = line.split('->')[1] || '';
  return extractMagicElement(targetText) || extractReceivingElement(targetText);
}

function enemyLogTargetLabel(line: string, sourceLabel: string) {
  const targetText = line.split('->')[1] || '';
  const match = targetText.match(/^\s*([^:：\s/]+)[:：]/);
  const targetLabel = match?.[1] || '';
  if (!targetLabel || targetLabel === sourceLabel) return '';
  return targetLabel;
}

function playerLogTargetLabel(line: string) {
  if ((!line.includes(' 自分 ') && !line.includes('自分効果')) || line.includes('自分回復')) return '';
  const match = line.match(/\s->\s*([^:：\s/]+)(?:[:：]|\s*\/)/);
  return match?.[1] || '敵';
}

function playerLogSourceElement(line: string): ActionElement | undefined {
  return extractMagicElement(line);
}

function playerLogTargetElement(line: string): ActionElement | undefined {
  if ((!line.includes(' 自分 ') && !line.includes('自分効果')) || line.includes('自分回復')) return undefined;
  const targetText = line.split('->')[1] || '';
  return extractTargetLabelElement(targetText) || extractReceivingElement(targetText);
}

function extractMagicElement(text: string): ActionElement | undefined {
  return normalizeActionElement(text.match(/M[123]\(([火水木無]),/)?.[1]);
}

function extractActionElement(text: string): ActionElement | undefined {
  return normalizeActionElement(text.match(/[^:：\s/]+[:：][^(]*\(([火水木無]),/)?.[1]);
}

function extractTargetLabelElement(text: string): ActionElement | undefined {
  return normalizeActionElement(text.match(/^\s*[^:：\s/]+[:：]\s*([火水木無])/)?.[1]);
}

function extractReceivingElement(text: string): ActionElement | undefined {
  return normalizeActionElement(text.match(/受け([火水木無])/)?.[1]);
}

function normalizeActionElement(value?: string): ActionElement | undefined {
  return ['火', '水', '木', '無'].includes(value || '') ? value as ActionElement : undefined;
}

function elementIcon(element: ActionElement) {
  if (element === '火') return fireIcon;
  if (element === '水') return waterIcon;
  if (element === '木') return floraIcon;
  return cosmicIcon;
}

function referenceMagicElementClass(element: ActionElement) {
  return {
    'reference-magic-label--fire': element === '火',
    'reference-magic-label--water': element === '水',
    'reference-magic-label--flora': element === '木',
    'reference-magic-label--cosmic': element === '無',
  };
}

function isSystemLogLine(line: string) {
  return line.startsWith('開始')
    || line.startsWith('結果')
    || line.startsWith('リタイア')
    || line.includes('自分手札')
    || line.includes('相手予定')
    || isSelectionLogLine(line)
    || line.includes('終了:')
    || line.includes('手札再配布')
    || line.includes('許容組み合わせなし')
    || line.includes('やけど:');
}

function isSelectionLogLine(line: string) {
  return /^\d+T\s+選択\s/.test(line);
}

function playerLogIcon(line: string) {
  const slot = deck.value.find((item) => {
    const character = item.character;
    if (!character) return false;
    return line.includes(`${character.chara}/${character.costume}`);
  });
  return slot?.imageUrl || '';
}

function createEnemyAction(partial: Partial<EnemyActionDefinition> = {}): EnemyActionDefinition {
  const power = normalizeEnemyMagicPower(partial.power, partial.hitCount, partial.name);
  return {
    id: makeId('enemy-action'),
    name: partial.name ?? power,
    element: partial.element ?? defaultEnemyActionElement(),
    power,
    hitCount: enemyPowerHitCount(power),
    estimatedDamage: partial.estimatedDamage ?? 9000,
    keepInDeckWhenDamageZero: partial.keepInDeckWhenDamageZero ?? false,
    effectTarget: partial.effectTarget ?? defaultEnemyEffectTarget(partial.effectKind ?? 'none'),
    effectKind: partial.effectKind ?? 'none',
    effectAttribute: partial.effectAttribute,
    effectValue: partial.effectValue ?? 0,
    duration: partial.duration ?? 1,
  };
}

function createEnemySlot(name = '敵'): EnemySlotDefinition {
  return {
    id: makeId('enemy-slot'),
    name,
    actions: [
      createEnemyAction({ name: '強単発', power: '単発(強)', estimatedDamage: 7000 }),
      createEnemyAction({ name: '強2連', power: '2連撃(強)', estimatedDamage: 9000 }),
      createEnemyAction({ name: 'バフ強2連', power: '2連撃(強)', estimatedDamage: 12000, effectKind: 'atkUp', effectValue: 20 }),
    ],
  };
}

function createEnemySlotFromActions(name: string, actions: Partial<EnemyActionDefinition>[]): EnemySlotDefinition {
  return {
    id: makeId('enemy-slot'),
    name,
    actions: actions.map((action) => createEnemyAction(action)),
  };
}

function applyExamPreset(preset: ExamPresetDefinition) {
  enemyConditionsTouched.value = true;
  runAttemptWarning.value = '';
  activeExamPresetId.value = preset.id;
  selectedSpecialChallengeIds.value = [];
  exam.value.kind = preset.kind;
  exam.value.enemyElement = preset.enemyElement;
  if (preset.difficulty !== undefined) exam.value.difficulty = preset.difficulty;
  exam.value.enemyHp = preset.enemyHp;
  enemySlots.value = preset.enemies.map((enemy) => createEnemySlotFromActions(enemy.name, enemy.actions));
  editingEnemySlotIndex.value = 0;
  enemyDialogOpen.value = false;
  clearResults();
  syncEnemyActionElementsToExam();
}

function clonePlain<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function createExamSettingsId() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return `exam-settings-${crypto.randomUUID()}`;
  }
  return `exam-settings-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function defaultExamSettingsName() {
  const now = new Date();
  return now.toLocaleDateString('ja-JP', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function serializeDeckSlotForSettings(slot: DeckSlot) {
  return {
    character: slot.character ? clonePlain(slot.character) : null,
    level: slot.level,
    totsu: slot.totsu,
    customHp: slot.customHp,
    customAtk: slot.customAtk,
    maxHp: slot.maxHp,
    maxAtk: slot.maxAtk,
    magicLevels: clonePlain(slot.magicLevels),
    buddyLevels: clonePlain(slot.buddyLevels),
    magicAttributes: clonePlain(slot.magicAttributes),
    magicPowers: clonePlain(slot.magicPowers),
    magicHeals: clonePlain(slot.magicHeals),
    magicEffects: clonePlain(slot.magicEffects),
    customBuffs: clonePlain(slot.customBuffs ?? []),
    selectedMagicSlots: [...slot.selectedMagicSlots],
    imageUrl: slot.imageUrl,
  };
}

function buildExamSettingsPayload(): ExamSettingsPayload {
  return {
    deck: deck.value.map(serializeDeckSlotForSettings),
    useElementCompatibilityPriority: allTurnElementCompatibilityPriority.value,
    turnPlans: turnPlans.value.map((turn) => ({
      turn: turn.turn,
      useElementCompatibilityPriority: turn.useElementCompatibilityPriority === true,
      combos: turn.combos.map((combo) => ({
        id: combo.id,
        firstMagicId: combo.firstMagicId,
        secondMagicId: combo.secondMagicId,
        autoGenerated: combo.autoGenerated,
        allowAutoSwap: combo.allowAutoSwap,
      })),
    })),
  };
}

function openSaveExamSettingsDialog() {
  settingsSetName.value = '';
  settingsSaveError.value = '';
  settingsSaveDialogOpen.value = true;
}

function saveCurrentExamSettingsSet() {
  settingsSaveError.value = '';
  const name = settingsSetName.value.trim() || defaultExamSettingsName();
  if (savedExamSettings.value.some((setting) => setting.name === name)) {
    settingsSaveError.value = t('common.duplicateDeckName');
    return;
  }
  const now = new Date().toISOString();
  const setting: SavedExamSimulatorSettings = {
    id: createExamSettingsId(),
    name,
    createdAt: now,
    updatedAt: now,
    payload: buildExamSettingsPayload(),
  };
  savedExamSettings.value = [setting, ...savedExamSettings.value];
  saveSavedExamSimulatorSettings(savedExamSettings.value);
  settingsSetName.value = '';
}

function deleteSavedExamSettingsSet(id: string) {
  savedExamSettings.value = savedExamSettings.value.filter((setting) => setting.id !== id);
  saveSavedExamSimulatorSettings(savedExamSettings.value);
}

function savedSettingIcon(setting: SavedExamSimulatorSettings, index: number) {
  const payload = setting.payload as Partial<ExamSettingsPayload> | null;
  const savedSlot = payload?.deck?.[index];
  if (!savedSlot?.character) return '';
  return String(savedSlot.imageUrl || savedSlot.character.imgUrl || '');
}

async function applySavedExamSettingsSet(setting: SavedExamSimulatorSettings) {
  const payload = setting.payload as Partial<ExamSettingsPayload> | null;
  if (!payload?.deck && !payload?.turnPlans) return;

  const characterStore = useCharacterStore();
  deck.value = await Promise.all(Array.from({ length: 5 }, (_, index) => (
    restoreDeckSlotFromSettings(payload.deck?.[index], characterStore)
  )));
  syncAllDeckLevelInputs();
  const legacyElementCompatibilityPriority = payload.useElementCompatibilityPriority === true
    || payload.useAllElementSmartSelection === true;

  const turnCount = maxTurnCount.value;
  turnPlans.value = Array.from({ length: turnCount }, (_, index) => {
    const savedTurn = payload.turnPlans?.[index];
    const useElementCompatibilityPriority = savedTurn?.useElementCompatibilityPriority === true
      || legacyElementCompatibilityPriority;
    const combos = Array.isArray(savedTurn?.combos)
      ? savedTurn.combos.map((combo) => (
        createTurnCombo(
          combo.firstMagicId,
          combo.secondMagicId,
          combo.autoGenerated,
          combo.allowAutoSwap ?? useElementCompatibilityPriority,
        )
      ))
      : [];
    const uniqueCombos = uniqueTurnCombos(combos);
    return {
      turn: index + 1,
      useElementCompatibilityPriority,
      combos: uniqueCombos.length ? uniqueCombos : [createTurnCombo('', '', true, useElementCompatibilityPriority)],
    };
  });
  normalizeTurnCombosForAvailableMagic();
  editingDeckDetailCharacter.value = null;
  characterDialogOpen.value = false;
  deckDetailDialogOpen.value = false;
  magicPickerOpen.value = false;
  settingsSaveDialogOpen.value = false;
  clearResults();
}

async function restoreDeckSlotFromSettings(
  savedSlot: Record<string, any> | undefined,
  characterStore: ReturnType<typeof useCharacterStore>,
): Promise<DeckSlot> {
  if (!savedSlot?.character) return createEmptyDeckSlot();
  const selectedMagicSlots = Array.isArray(savedSlot.selectedMagicSlots)
    ? savedSlot.selectedMagicSlots
    : [];
  const importedCharacter = {
    ...savedSlot.character,
    level: savedSlot.level,
    totsu: savedSlot.totsu,
    hp: savedSlot.customHp,
    atk: savedSlot.customAtk,
    originalMaxHP: savedSlot.maxHp,
    originalMaxATK: savedSlot.maxAtk,
    max_hp: savedSlot.maxHp,
    max_atk: savedSlot.maxAtk,
    imgUrl: savedSlot.imageUrl || savedSlot.character.imgUrl,
    magic1Lv: savedSlot.magicLevels?.[1],
    magic2Lv: savedSlot.magicLevels?.[2],
    magic3Lv: savedSlot.magicLevels?.[3],
    buddy1Lv: savedSlot.buddyLevels?.[1],
    buddy2Lv: savedSlot.buddyLevels?.[2],
    buddy3Lv: savedSlot.buddyLevels?.[3],
    magic1atr: savedSlot.magicAttributes?.[1],
    magic2atr: savedSlot.magicAttributes?.[2],
    magic3atr: savedSlot.magicAttributes?.[3],
    magic1Power: savedSlot.magicPowers?.[1],
    magic2Power: savedSlot.magicPowers?.[2],
    magic3Power: savedSlot.magicPowers?.[3],
    magic1heal: savedSlot.magicHeals?.[1],
    magic2heal: savedSlot.magicHeals?.[2],
    magic3heal: savedSlot.magicHeals?.[3],
    magic1etc: savedSlot.magicEffects?.[1],
    magic2etc: savedSlot.magicEffects?.[2],
    magic3etc: savedSlot.magicEffects?.[3],
    isM1Selected: selectedMagicSlots.includes(1),
    isM2Selected: selectedMagicSlots.includes(2),
    isM3Selected: selectedMagicSlots.includes(3),
  };
  const slot = await createDeckSlotFromSimulatorCharacter(importedCharacter, characterStore);
  slot.customBuffs = clonePlain(savedSlot.customBuffs ?? []);
  slot.selectedMagicSlots = selectedMagicSlots
    .map((value: unknown) => Math.floor(safeNumber(value)) as MagicSlot)
    .filter((value: MagicSlot) => magicSlotOptions.includes(value));
  normalizeSelectedMagicSlots(slot);
  return slot;
}

async function restoreDeckFromSimulatorImport() {
  if (typeof window === 'undefined') return;
  const importId = new URLSearchParams(window.location.search).get('importDeck');
  if (!importId) return;

  const importState = loadExamSimulatorDeckImportState(importId);
  if (!importState || importState.id !== importId || !Array.isArray(importState.deckCharacters)) return;

  const characterStore = useCharacterStore();
  deck.value = await Promise.all(Array.from({ length: 5 }, (_, index) => (
    createDeckSlotFromSimulatorCharacter(importState.deckCharacters[index], characterStore)
  )));
  syncAllDeckLevelInputs();
  editingDeckDetailCharacter.value = null;
  characterDialogOpen.value = false;
  deckDetailDialogOpen.value = false;
  activeTab.value = 'deck';
  resetDefaultCombos();
  normalizeTurnCombosForAvailableMagic();
  clearResults();
}

async function createDeckSlotFromSimulatorCharacter(
  importedCharacter: any,
  characterStore: ReturnType<typeof useCharacterStore>,
): Promise<DeckSlot> {
  if (!importedCharacter?.name && !importedCharacter?.chara) return createEmptyDeckSlot();

  const original = characterStore.characters.find((candidate: Character) => (
    (!!importedCharacter.id && candidate.id === importedCharacter.id)
    || (!!importedCharacter.name && candidate.name === importedCharacter.name)
  ));
  const merged = {
    ...(original ?? {}),
    ...importedCharacter,
  } as Character & Record<string, any>;
  const totsu = clampTotsuCount(importedCharacter.totsu ?? (importedCharacter.isBonusSelected ? 4 : merged.totsu ?? 0));
  const level = Math.min(
    getStatScalingMaxLevel(merged.rare),
    Math.max(1, Math.floor(safeNumber(importedCharacter.level) || safeNumber(merged.level) || 1)),
  );
  const normalized = {
    ...merged,
    level,
    totsu,
    isBonusSelected: isMaxLimitBreak(totsu),
    hasM3: isM3Unlocked(merged.rare, totsu),
  } as Character & Record<string, any>;
  const imageUrl = importedCharacter.imgUrl || normalized.imgUrl || await ensureImageUrl(normalized);
  const selectedMagicSlots = ([1, 2, 3] as MagicSlot[]).filter((magicSlot) => !!importedCharacter[`isM${magicSlot}Selected`]);
  const importedHp = Math.max(1, Math.ceil(
    safeNumber(importedCharacter.hp)
    || safeNumber(importedCharacter.calculatedHp)
    || safeNumber(importedCharacter.originalMaxHP)
    || safeNumber(importedCharacter.max_hp)
    || safeNumber(normalized.hp)
    || 1,
  ));
  const importedAtk = Math.max(1, Math.ceil(
    safeNumber(importedCharacter.atk)
    || safeNumber(importedCharacter.calculatedAtk)
    || safeNumber(importedCharacter.originalMaxATK)
    || safeNumber(importedCharacter.max_atk)
    || safeNumber(normalized.atk)
    || 1,
  ));
  const importedMaxHp = Math.max(importedHp, Math.ceil(
    safeNumber(importedCharacter.originalMaxHP)
    || safeNumber(importedCharacter.max_hp)
    || safeNumber(normalized.max_hp)
    || safeNumber(normalized.hp)
    || importedHp,
  ));
  const importedMaxAtk = Math.max(importedAtk, Math.ceil(
    safeNumber(importedCharacter.originalMaxATK)
    || safeNumber(importedCharacter.max_atk)
    || safeNumber(normalized.max_atk)
    || safeNumber(normalized.atk)
    || importedAtk,
  ));
  const slot: DeckSlot = {
    character: normalized,
    level,
    totsu,
    customHp: importedHp,
    customAtk: importedAtk,
    maxHp: importedMaxHp,
    maxAtk: importedMaxAtk,
    magicLevels: {
      1: normalizeLevelValue(importedCharacter.magic1Lv ?? normalized.magic1Lv),
      2: normalizeLevelValue(importedCharacter.magic2Lv ?? normalized.magic2Lv),
      3: normalizeLevelValue(importedCharacter.magic3Lv ?? normalized.magic3Lv),
    },
    buddyLevels: {
      1: normalizeLevelValue(importedCharacter.buddy1Lv ?? normalized.buddy1Lv),
      2: normalizeLevelValue(importedCharacter.buddy2Lv ?? normalized.buddy2Lv),
      3: normalizeLevelValue(importedCharacter.buddy3Lv ?? normalized.buddy3Lv),
    },
    magicAttributes: {
      1: normalizeElement(importedCharacter.magic1atr || importedCharacter.magic1Attribute || normalized.magic1atr || normalized.magic1Attribute),
      2: normalizeElement(importedCharacter.magic2atr || importedCharacter.magic2Attribute || normalized.magic2atr || normalized.magic2Attribute),
      3: normalizeElement(importedCharacter.magic3atr || importedCharacter.magic3Attribute || normalized.magic3atr || normalized.magic3Attribute),
    },
    magicPowers: {
      1: normalizeImportedMagicPower(1, importedCharacter, normalized),
      2: normalizeImportedMagicPower(2, importedCharacter, normalized),
      3: normalizeImportedMagicPower(3, importedCharacter, normalized),
    },
    magicHeals: {
      1: importedCharacter.magic1heal || normalized.magic1heal || '',
      2: importedCharacter.magic2heal || normalized.magic2heal || '',
      3: importedCharacter.magic3heal || normalized.magic3heal || '',
    },
    magicEffects: {
      1: importedCharacter.magic1etc || normalized.magic1etc || '',
      2: importedCharacter.magic2etc || normalized.magic2etc || '',
      3: importedCharacter.magic3etc || normalized.magic3etc || '',
    },
    customBuffs: [],
    selectedMagicSlots,
    imageUrl,
  };
  normalizeSelectedMagicSlots(slot);
  return slot;
}

function normalizeImportedMagicPower(magicSlot: MagicSlot, importedCharacter: any, fallbackCharacter: Record<string, any>) {
  const importedPower = importedCharacter[`magic${magicSlot}Power`] || importedCharacter[`magic${magicSlot}pow`];
  const fallbackPower = fallbackCharacter[`magic${magicSlot}pow`] || fallbackCharacter[`magic${magicSlot}Power`];
  if (magicSlot === 2 && importedPower === 'デュオ') {
    return fallbackCharacter.magic2pow && fallbackCharacter.magic2pow !== 'デュオ'
      ? fallbackCharacter.magic2pow
      : '連撃(強)';
  }
  return importedPower || fallbackPower || (magicSlot === 2 ? '連撃(強)' : '単発(弱)');
}

function createEmptyDeckSlot(): DeckSlot {
  return {
    character: null,
    level: 1,
    totsu: 4,
    customHp: 1,
    customAtk: 1,
    maxHp: 1,
    maxAtk: 1,
    magicLevels: { 1: 10, 2: 10, 3: 10 },
    buddyLevels: { 1: 10, 2: 10, 3: 10 },
    magicAttributes: { 1: '無', 2: '無', 3: '無' },
    magicPowers: { 1: '単発(弱)', 2: '連撃(強)', 3: '単発(弱)' },
    magicHeals: { 1: '', 2: '', 3: '' },
    magicEffects: { 1: '', 2: '', 3: '' },
    customBuffs: [],
    selectedMagicSlots: [1, 2],
    imageUrl: '',
  };
}

function createTurnCombo(firstMagicId = '', secondMagicId = '', autoGenerated = false, allowAutoSwap = false): TurnCombo {
  return {
    id: makeId('turn-combo'),
    firstMagicId,
    secondMagicId,
    autoGenerated,
    allowAutoSwap,
  };
}

function addEnemySlot() {
  enemySlots.value.push(createEnemySlot(`敵${enemySlots.value.length + 1}`));
  openEnemyDialog(enemySlots.value.length - 1);
}

function removeEnemySlot(slotIndex: number) {
  if (enemySlots.value.length <= 1) return;
  enemySlots.value.splice(slotIndex, 1);
  if (editingEnemySlotIndex.value >= enemySlots.value.length) editingEnemySlotIndex.value = enemySlots.value.length - 1;
  if (!enemySlots.value[editingEnemySlotIndex.value]) enemyDialogOpen.value = false;
}

function openEnemyDialog(slotIndex: number) {
  editingEnemySlotIndex.value = slotIndex;
  enemyDialogOpen.value = true;
}

function addEnemyAction(slotIndex: number) {
  enemySlots.value[slotIndex]?.actions.push(createEnemyAction());
}

function removeEnemyAction(slotIndex: number, actionIndex: number) {
  enemySlots.value[slotIndex]?.actions.splice(actionIndex, 1);
}

function syncEnemyPower(action: EnemyActionDefinition) {
  action.power = normalizeEnemyMagicPower(action.power, action.hitCount, action.name);
  action.hitCount = enemyPowerHitCount(action.power);
}

function syncEnemyEffectTarget(action: EnemyActionDefinition) {
  action.effectTarget = defaultEnemyEffectTarget(action.effectKind);
}

function defaultEnemyActionElement(): ActionElement {
  return exam.value.enemyElement === '全' ? '火' : exam.value.enemyElement;
}

function effectiveEnemyActionElement(action: EnemyActionDefinition | undefined): ActionElement {
  return fixedEnemyActionElement.value ?? action?.element ?? '無';
}

function syncEnemyActionElementsToExam() {
  const fixed = fixedEnemyActionElement.value;
  if (!fixed) return;
  enemySlots.value.forEach((slot) => {
    slot.actions.forEach((action) => {
      action.element = fixed;
    });
  });
}

function requestTurnChange(value: unknown) {
  const nextIndex = Math.min(turnPlans.value.length - 1, Math.max(0, Math.floor(safeNumber(value) || 0)));
  if (nextIndex === activeTurnIndex.value) return;
  if (magicPickerOpen.value) {
    const combo = currentCombo.value;
    if (!combo || !combo[activeComboSlot.value]) return;
    cancelMagicPicker();
  }
  activeTurnIndex.value = nextIndex;
}

function setAllTurnElementCompatibilityPriority(enabled: boolean) {
  turnPlans.value.forEach((turn) => {
    turn.useElementCompatibilityPriority = enabled;
    if (enabled) enableAutoSwapForTurn(turn);
  });
}

function updateActiveTurnElementCompatibilityPriority(event: Event) {
  const target = event.target as HTMLInputElement | null;
  const turn = currentTurnPlan.value;
  if (!turn || !target) return;
  turn.useElementCompatibilityPriority = target.checked;
  if (target.checked) enableAutoSwapForTurn(turn);
}

function enableAutoSwapForTurn(turn: TurnPlan) {
  turn.combos.forEach((combo) => {
    combo.allowAutoSwap = true;
  });
}

function defaultAllowAutoSwapForTurn(turn: TurnPlan | null | undefined) {
  return turn?.useElementCompatibilityPriority === true;
}

function copyPreviousTurnCombos() {
  const currentIndex = activeTurnIndex.value;
  const currentTurn = turnPlans.value[currentIndex];
  const previousTurn = turnPlans.value[currentIndex - 1];
  if (!currentTurn || !previousTurn) return;
  if (magicPickerOpen.value) magicPickerOpen.value = false;
  currentTurn.combos = previousTurn.combos.map((combo) => (
    createTurnCombo(
      combo.firstMagicId,
      combo.secondMagicId,
      false,
      combo.allowAutoSwap === true || defaultAllowAutoSwapForTurn(currentTurn),
    )
  ));
  if (!currentTurn.combos.length) currentTurn.combos = [createTurnCombo('', '', false, defaultAllowAutoSwapForTurn(currentTurn))];
  activeComboIndex.value = 0;
  activeComboSlot.value = 'firstMagicId';
  ensureActiveComboTarget();
}

function addAllTurnCombos() {
  const turn = currentTurnPlan.value;
  if (!turn) return;
  const ids = magicCards.value.map((magic) => magic.id);
  if (ids.length < 2) return;
  if (magicPickerOpen.value) magicPickerOpen.value = false;
  const hasOnlyEmptyAutoCombo = turn.combos.every((combo) => (
    combo.autoGenerated && !combo.firstMagicId && !combo.secondMagicId
  ));
  const nextCombos = hasOnlyEmptyAutoCombo ? [] : uniqueTurnCombos(turn.combos);
  const existingPairs = new Set(nextCombos.map((combo) => comboPairKey(combo.firstMagicId, combo.secondMagicId)));

  ids.forEach((firstMagicId, firstIndex) => {
    ids.slice(firstIndex + 1).forEach((secondMagicId) => {
      const key = comboPairKey(firstMagicId, secondMagicId);
      if (existingPairs.has(key)) return;
      nextCombos.push(createTurnCombo(firstMagicId, secondMagicId, false, defaultAllowAutoSwapForTurn(turn)));
      existingPairs.add(key);
    });
  });

  turn.combos = nextCombos.length ? nextCombos : [createTurnCombo('', '', false, defaultAllowAutoSwapForTurn(turn))];
  activeComboIndex.value = 0;
  activeComboSlot.value = 'firstMagicId';
  ensureActiveComboTarget();
}

function uniqueTurnCombos(combos: TurnCombo[]) {
  const seenPairs = new Set<string>();
  return combos.filter((combo) => {
    if (!combo.firstMagicId || !combo.secondMagicId || combo.firstMagicId === combo.secondMagicId) return false;
    const key = comboPairKey(combo.firstMagicId, combo.secondMagicId);
    if (seenPairs.has(key)) return false;
    seenPairs.add(key);
    return true;
  });
}

function comboPairKey(firstMagicId: string, secondMagicId: string) {
  return [firstMagicId, secondMagicId].sort().join('|');
}

function removeCombo(turnIndex: number, comboIndex: number) {
  const combos = turnPlans.value[turnIndex]?.combos;
  if (!combos || combos.length <= 1) return;
  combos.splice(comboIndex, 1);
  ensureActiveComboTarget();
}

function swapComboMagic(turnIndex: number, comboIndex: number) {
  const combos = turnPlans.value[turnIndex]?.combos;
  const combo = combos?.[comboIndex];
  if (!combo || !combo.firstMagicId || !combo.secondMagicId) return;
  [combo.firstMagicId, combo.secondMagicId] = [combo.secondMagicId, combo.firstMagicId];
  combo.autoGenerated = false;
  if (combos) {
    turnPlans.value[turnIndex].combos = uniqueTurnCombos(combos);
  }
  if (turnIndex === activeTurnIndex.value) {
    activeComboIndex.value = Math.min(comboIndex, turnPlans.value[turnIndex].combos.length - 1);
    activeComboSlot.value = 'firstMagicId';
  }
}

function onComboPriorityDragStart(turnIndex: number, comboIndex: number, event: DragEvent) {
  const combos = turnPlans.value[turnIndex]?.combos;
  if (!combos?.[comboIndex]) return;
  draggingCombo.value = { turnIndex, comboIndex };
  dragOverComboIndex.value = comboIndex;
  if (event.dataTransfer) {
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('application/x-twst-combo-index', String(comboIndex));
  }
}

function onComboPriorityDragEnd() {
  draggingCombo.value = null;
  dragOverComboIndex.value = null;
}

function onComboRowDragEnter(comboIndex: number, isVirtual: boolean | undefined, event: DragEvent) {
  if (!draggingCombo.value || isVirtual) return;
  event.preventDefault();
  dragOverComboIndex.value = comboIndex;
}

function onComboRowDragOver(comboIndex: number, isVirtual: boolean | undefined, event: DragEvent) {
  if (!draggingCombo.value || isVirtual) return;
  event.preventDefault();
  if (event.dataTransfer) event.dataTransfer.dropEffect = 'move';
  dragOverComboIndex.value = comboIndex;
}

function onComboRowDragLeave(comboIndex: number) {
  if (dragOverComboIndex.value === comboIndex) dragOverComboIndex.value = null;
}

function onComboRowDrop(turnIndex: number, targetIndex: number, isVirtual: boolean | undefined, event: DragEvent) {
  if (!draggingCombo.value || isVirtual) return;
  event.preventDefault();
  const sourceIndex = draggingCombo.value.comboIndex;
  const sourceTurnIndex = draggingCombo.value.turnIndex;
  draggingCombo.value = null;
  dragOverComboIndex.value = null;
  if (sourceTurnIndex !== turnIndex) return;
  reorderCombo(turnIndex, sourceIndex, targetIndex);
}

function reorderCombo(turnIndex: number, sourceIndex: number, targetIndex: number) {
  const combos = turnPlans.value[turnIndex]?.combos;
  if (!combos) return;
  if (sourceIndex === targetIndex) return;
  if (sourceIndex < 0 || sourceIndex >= combos.length || targetIndex < 0 || targetIndex >= combos.length) return;
  const [moved] = combos.splice(sourceIndex, 1);
  combos.splice(targetIndex, 0, moved);
  if (turnIndex === activeTurnIndex.value) {
    if (activeComboIndex.value === sourceIndex) {
      activeComboIndex.value = targetIndex;
    } else if (sourceIndex < activeComboIndex.value && activeComboIndex.value <= targetIndex) {
      activeComboIndex.value -= 1;
    } else if (targetIndex <= activeComboIndex.value && activeComboIndex.value < sourceIndex) {
      activeComboIndex.value += 1;
    }
  }
}

function ensureActiveComboTarget() {
  const combos = currentTurnPlan.value?.combos ?? [];
  if (!combos.length) {
    activeComboIndex.value = 0;
    activeComboSlot.value = 'firstMagicId';
    return;
  }
  activeComboIndex.value = Math.min(combos.length - 1, Math.max(0, activeComboIndex.value));
  if (activeComboSlot.value !== 'firstMagicId' && activeComboSlot.value !== 'secondMagicId') {
    activeComboSlot.value = 'firstMagicId';
  }
}

function selectComboTarget(comboIndex: number, slotKey?: ComboSlotKey) {
  const combos = currentTurnPlan.value?.combos ?? [];
  if (!combos.length) return;
  activeComboIndex.value = Math.min(combos.length - 1, Math.max(0, comboIndex));
  const combo = combos[activeComboIndex.value];
  activeComboSlot.value = slotKey ?? (!combo.firstMagicId ? 'firstMagicId' : 'secondMagicId');
}

function openMagicPicker(comboIndex: number, slotKey: ComboSlotKey) {
  const turn = currentTurnPlan.value;
  if (turn && comboIndex >= turn.combos.length) {
    turn.combos.push(createTurnCombo('', '', false, defaultAllowAutoSwapForTurn(turn)));
    comboIndex = turn.combos.length - 1;
  }
  selectComboTarget(comboIndex, slotKey);
  magicPickerOpen.value = true;
}

function cancelMagicPicker() {
  if (!magicPickerOpen.value) return;
  magicPickerOpen.value = false;
  const combos = currentTurnPlan.value?.combos;
  const combo = combos?.[activeComboIndex.value];
  if (combos && combo && combos.length > 1 && !combo.firstMagicId && !combo.secondMagicId) {
    combos.splice(activeComboIndex.value, 1);
    ensureActiveComboTarget();
  }
}

function openCharacterDialog(index: number) {
  selectingDeckIndex.value = index;
  characterDialogOpen.value = true;
}

function openDeckDetailDialog(index: number) {
  if (!deck.value[index]?.character) return;
  editingDeckIndex.value = index;
  editingDeckDetailCharacter.value = createDeckDetailCharacter(index);
  deckDetailDialogOpen.value = true;
}

function closeCharacterDialog() {
  characterDialogOpen.value = false;
}

async function selectDeckCharacter(character: Character) {
  const processed = await processCharacterSelection({ ...character }) as Character;
  await setDeckCharacter(selectingDeckIndex.value, processed);
  resetDefaultCombos();
  closeCharacterDialog();
}

async function setDeckCharacter(index: number, character: Character) {
  const maxLevel = getStatScalingMaxLevel(character.rare);
  const rawLevel = Number((character as any).level);
  const level = Number.isFinite(rawLevel)
    ? Math.min(maxLevel, Math.max(1, Math.floor(rawLevel)))
    : maxLevel;
  const totsu = clampTotsuCount((character as any).totsu ?? 4);
  const normalized = {
    ...character,
    level,
    totsu,
    isBonusSelected: isMaxLimitBreak(totsu),
    hasM3: isM3Unlocked(character.rare, totsu),
    magic1Lv: 10,
    magic2Lv: 10,
    magic3Lv: 10,
    buddy1Lv: 10,
    buddy2Lv: 10,
    buddy3Lv: 10,
  } as ExamCharacter;
  const imageUrl = normalized.imgUrl || await ensureImageUrl(normalized);
  const maxHp = Math.max(1, Math.ceil(
    safeNumber((normalized as any).originalMaxHP)
    || safeNumber((normalized as any).max_hp)
    || safeNumber(normalized.hp)
    || 1,
  ));
  const maxAtk = Math.max(1, Math.ceil(
    safeNumber((normalized as any).originalMaxATK)
    || safeNumber((normalized as any).max_atk)
    || safeNumber(normalized.atk)
    || 1,
  ));
  deck.value[index] = {
    character: normalized,
    level,
    totsu,
    customHp: Math.max(1, Math.ceil(safeNumber(normalized.hp) || 1)),
    customAtk: Math.max(1, Math.ceil(safeNumber(normalized.atk) || 1)),
    maxHp,
    maxAtk,
    magicLevels: { 1: 10, 2: 10, 3: 10 },
    buddyLevels: { 1: 10, 2: 10, 3: 10 },
    magicAttributes: {
      1: normalizeElement(normalized.magic1atr),
      2: normalizeElement(normalized.magic2atr),
      3: normalizeElement(normalized.magic3atr),
    },
    magicPowers: {
      1: normalized.magic1pow || '単発(弱)',
      2: normalized.magic2pow || '連撃(強)',
      3: normalized.magic3pow || '単発(弱)',
    },
    magicHeals: {
      1: normalized.magic1heal || '',
      2: normalized.magic2heal || '',
      3: normalized.magic3heal || '',
    },
    magicEffects: {
      1: normalized.magic1etc || '',
      2: normalized.magic2etc || '',
      3: normalized.magic3etc || '',
    },
    customBuffs: [],
    selectedMagicSlots: [1, 2],
    imageUrl,
  };
  normalizeSelectedMagicSlots(deck.value[index]);
  syncDeckLevelInput(index);
}

function deckLevelInputValue(index: number) {
  return deckLevelInputTexts.value[index] ?? String(deck.value[index]?.level ?? '');
}

function syncDeckLevelInput(index: number) {
  const slot = deck.value[index];
  deckLevelInputTexts.value[index] = slot?.character ? String(slot.level) : '';
  deckLevelFocusPrefixes.value[index] = '';
}

function syncAllDeckLevelInputs() {
  deck.value.forEach((_slot, index) => syncDeckLevelInput(index));
}

function updateDeckLevelInput(index: number, value: unknown) {
  const slot = deck.value[index];
  const maxLevel = maxCardLevel(slot);
  let text = String(value ?? '').replace(/[^\d]/g, '');

  const focusPrefix = deckLevelFocusPrefixes.value[index] ?? '';
  if (focusPrefix && text.startsWith(focusPrefix) && text.length > focusPrefix.length) {
    const replacementText = text.slice(focusPrefix.length);
    if (replacementText) {
      text = replacementText;
      deckLevelFocusPrefixes.value[index] = '';
    }
  }

  if (!slot?.character) {
    deckLevelInputTexts.value[index] = text;
    return;
  }

  if (!text) {
    deckLevelInputTexts.value[index] = '';
    return;
  }

  let level = Math.floor(Number(text));
  if (!Number.isFinite(level)) {
    deckLevelInputTexts.value[index] = '';
    return;
  }

  level = Math.min(maxLevel, Math.max(1, level));
  deckLevelInputTexts.value[index] = String(level);
  slot.level = level;
  recalculateDeckStats(index);
}

function normalizeDeckLevel(index: number) {
  const slot = deck.value[index];
  if (!slot.character) {
    syncDeckLevelInput(index);
    return;
  }
  slot.level = Math.min(maxCardLevel(slot), Math.max(1, Math.floor(safeNumber(slot.level) || 1)));
  syncDeckLevelInput(index);
  recalculateDeckStats(index);
}

function focusDeckLevelInput(index: number, event: FocusEvent) {
  deckLevelFocusPrefixes.value[index] = deckLevelInputTexts.value[index] ?? String(deck.value[index]?.level ?? '');
  const target = event.target instanceof HTMLInputElement
    ? event.target
    : (event.target as HTMLElement | null)?.querySelector?.('input') as HTMLInputElement | null;
  if (!target) return;
  requestAnimationFrame(() => target.select());
}

function normalizeDeckTotsu(index: number) {
  const slot = deck.value[index];
  if (!slot.character) return;
  slot.totsu = clampTotsuCount(slot.totsu);
  recalculateDeckStats(index);
  normalizeSelectedMagicSlots(slot);
  normalizeTurnCombosForAvailableMagic();
}

function recalculateDeckStats(index: number) {
  const slot = deck.value[index];
  if (!slot.character) return;
  const statSource = {
    ...slot.character,
    originalMaxHP: slot.maxHp,
    originalMaxATK: slot.maxAtk,
    max_hp: slot.maxHp,
    max_atk: slot.maxAtk,
    hp: slot.maxHp,
    atk: slot.maxAtk,
  };
  const level = Math.min(maxCardLevel(slot), Math.max(1, Math.floor(safeNumber(slot.level) || 1)));
  const isLimitBreak = isMaxLimitBreak(clampTotsuCount(slot.totsu));
  slot.customHp = Math.max(1, Math.ceil(recalculateHP(statSource, level, isLimitBreak) || 1));
  slot.customAtk = Math.max(1, Math.ceil(recalculateATK(statSource, level, isLimitBreak) || 1));
}

function saveDeckDetailChanges(updatedCharacter: any) {
  const slot = deck.value[editingDeckIndex.value];
  if (!slot?.character) return;
  const previousHp = slot.customHp;
  const previousAtk = slot.customAtk;
  const nextHp = Math.floor(safeNumber(updatedCharacter.hp) || previousHp || 1);
  const nextAtk = Math.floor(safeNumber(updatedCharacter.atk) || previousAtk || 1);
  const hpWasEdited = nextHp !== previousHp;
  const atkWasEdited = nextAtk !== previousAtk;
  slot.level = Math.min(maxCardLevel(slot), Math.max(1, Math.floor(safeNumber(updatedCharacter.level) || slot.level || 1)));
  slot.totsu = clampTotsuCount(updatedCharacter.totsu ?? slot.totsu);
  slot.maxHp = Math.max(slot.maxHp || 1, Math.ceil(
    safeNumber(updatedCharacter.originalMaxHP)
    || safeNumber(updatedCharacter.max_hp)
    || slot.maxHp
    || nextHp,
  ));
  slot.maxAtk = Math.max(slot.maxAtk || 1, Math.ceil(
    safeNumber(updatedCharacter.originalMaxATK)
    || safeNumber(updatedCharacter.max_atk)
    || slot.maxAtk
    || nextAtk,
  ));
  recalculateDeckStats(editingDeckIndex.value);
  if (hpWasEdited) slot.customHp = Math.max(1, nextHp);
  if (atkWasEdited) slot.customAtk = Math.max(1, nextAtk);
  slot.magicLevels = {
    1: normalizeLevelValue(updatedCharacter.magic1Lv),
    2: normalizeLevelValue(updatedCharacter.magic2Lv),
    3: normalizeLevelValue(updatedCharacter.magic3Lv),
  };
  slot.buddyLevels = {
    1: normalizeLevelValue(updatedCharacter.buddy1Lv),
    2: normalizeLevelValue(updatedCharacter.buddy2Lv),
    3: normalizeLevelValue(updatedCharacter.buddy3Lv),
  };
  slot.magicAttributes = {
    1: normalizeElement(updatedCharacter.magic1atr || updatedCharacter.magic1Attribute),
    2: normalizeElement(updatedCharacter.magic2atr || updatedCharacter.magic2Attribute),
    3: normalizeElement(updatedCharacter.magic3atr || updatedCharacter.magic3Attribute),
  };
  slot.magicPowers = {
    1: updatedCharacter.magic1Power || updatedCharacter.magic1pow || slot.magicPowers[1],
    2: updatedCharacter.magic2Power || updatedCharacter.magic2pow || slot.magicPowers[2],
    3: updatedCharacter.magic3Power || updatedCharacter.magic3pow || slot.magicPowers[3],
  };
  slot.magicHeals = {
    1: updatedCharacter.magic1heal || '',
    2: updatedCharacter.magic2heal || '',
    3: updatedCharacter.magic3heal || '',
  };
  slot.magicEffects = {
    1: updatedCharacter.magic1etc || '',
    2: updatedCharacter.magic2etc || '',
    3: updatedCharacter.magic3etc || '',
  };
  slot.customBuffs = [];
  normalizeSelectedMagicSlots(slot);
  editingDeckDetailCharacter.value = createDeckDetailCharacter(editingDeckIndex.value);
  syncDeckLevelInput(editingDeckIndex.value);
  normalizeTurnCombosForAvailableMagic();
}

function normalizeLevelValue(value: unknown) {
  return Math.min(10, Math.max(1, Math.floor(safeNumber(value) || 1)));
}

function toggleDeckMagic(index: number, magicSlot: MagicSlot) {
  const slot = deck.value[index];
  if (!slot.character) return;
  if (!availableMagicSlots(slot).includes(magicSlot)) return;
  const selected = slot.selectedMagicSlots;
  if (selected.includes(magicSlot)) {
    slot.selectedMagicSlots = selected.filter((value) => value !== magicSlot);
    normalizeTurnCombosForAvailableMagic();
    return;
  }
  slot.selectedMagicSlots = [...selected.slice(Math.max(0, selected.length - 1)), magicSlot].sort((a, b) => a - b);
  resetDefaultCombos();
  normalizeTurnCombosForAvailableMagic();
}

function createDeckDetailCharacter(index: number) {
  const slot = deck.value[index];
  if (!slot?.character) return null;
  const selected = new Set(slot.selectedMagicSlots);
  const totsu = clampTotsuCount(slot.totsu);
  const hasM3 = isM3Unlocked(slot.character.rare, totsu);
  const isBonusSelected = isMaxLimitBreak(totsu);
  return {
    ...slot.character,
    hp: slot.customHp,
    atk: slot.customAtk,
    originalMaxHP: slot.maxHp,
    originalMaxATK: slot.maxAtk,
    max_hp: slot.maxHp,
    max_atk: slot.maxAtk,
    level: slot.level,
    totsu,
    hasM3,
    isBonusSelected,
    imgUrl: slot.imageUrl,
    isM1Selected: selected.has(1),
    isM2Selected: selected.has(2),
    isM3Selected: selected.has(3),
    magic1Lv: slot.magicLevels[1],
    magic2Lv: slot.magicLevels[2],
    magic3Lv: slot.magicLevels[3],
    buddy1Lv: slot.buddyLevels[1],
    buddy2Lv: slot.buddyLevels[2],
    buddy3Lv: slot.buddyLevels[3],
    magic1atr: slot.magicAttributes[1],
    magic2atr: slot.magicAttributes[2],
    magic3atr: slot.magicAttributes[3],
    magic1pow: slot.magicPowers[1],
    magic2pow: slot.magicPowers[2],
    magic3pow: slot.magicPowers[3],
    magic1heal: slot.magicHeals[1],
    magic2heal: slot.magicHeals[2],
    magic3heal: slot.magicHeals[3],
    magic1etc: slot.magicEffects[1],
    magic2etc: slot.magicEffects[2],
    magic3etc: slot.magicEffects[3],
    buffs: [],
  };
}

function resetDefaultCombos() {
  const ids = magicCards.value.map((magic) => magic.id);
  if (ids.length < 2) {
    turnPlans.value.forEach((turn) => {
      if (turn.combos.every((combo) => combo.autoGenerated || (!combo.firstMagicId && !combo.secondMagicId))) {
        turn.combos = [createTurnCombo('', '', true, defaultAllowAutoSwapForTurn(turn))];
      }
    });
    return;
  }
  turnPlans.value.forEach((turn, index) => {
    const shouldRefresh = turn.combos.every((combo) => combo.autoGenerated)
      || turn.combos.length === 0
      || !turn.combos[0].firstMagicId
      || !turn.combos[0].secondMagicId;
    if (shouldRefresh) {
      const first = ids[(index * 2) % ids.length] ?? '';
      const second = ids[(index * 2 + 1) % ids.length] ?? '';
      turn.combos = [createTurnCombo(first, second, true, defaultAllowAutoSwapForTurn(turn))];
    }
  });
}

function normalizeTurnCombosForAvailableMagic() {
  const validIds = new Set(magicCards.value.map((magic) => magic.id));
  turnPlans.value.forEach((turn) => {
    turn.combos.forEach((combo) => {
      if (combo.firstMagicId && !validIds.has(combo.firstMagicId)) combo.firstMagicId = '';
      if (combo.secondMagicId && !validIds.has(combo.secondMagicId)) combo.secondMagicId = '';
      if (combo.firstMagicId && combo.firstMagicId === combo.secondMagicId) combo.secondMagicId = '';
    });
    if (!turn.combos.length) turn.combos = [createTurnCombo('', '', false, defaultAllowAutoSwapForTurn(turn))];
  });
}

function onMagicDragOver(event: DragEvent) {
  if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy';
}

function onMagicDrop(turnIndex: number, comboIndex: number, slotKey: ComboSlotKey, event: DragEvent) {
  const magicId = event.dataTransfer?.getData('application/x-twst-magic') || event.dataTransfer?.getData('text/plain') || draggingMagicId.value;
  assignMagicToCombo(turnIndex, comboIndex, slotKey, magicId);
}

function onMagicPointerDrop(turnIndex: number, comboIndex: number, slotKey: ComboSlotKey) {
  assignMagicToCombo(turnIndex, comboIndex, slotKey, draggingMagicId.value);
}

function assignMagicToCombo(turnIndex: number, comboIndex: number, slotKey: ComboSlotKey, magicId: string) {
  if (!magicId || !magicMap.value[magicId]) return;
  const combo = turnPlans.value[turnIndex]?.combos[comboIndex];
  if (!combo) return;
  const oppositeSlot: ComboSlotKey = slotKey === 'firstMagicId' ? 'secondMagicId' : 'firstMagicId';
  if (combo[oppositeSlot] === magicId) combo[oppositeSlot] = '';
  combo[slotKey] = magicId;
  combo.autoGenerated = false;
  if (turnIndex === activeTurnIndex.value) {
    activeComboIndex.value = comboIndex;
    activeComboSlot.value = slotKey;
  }
  draggingMagicId.value = '';
}

function chooseMagicFromPicker(magicId: string) {
  ensureActiveComboTarget();
  const comboIndex = activeComboIndex.value;
  const slotKey = activeComboSlot.value;
  assignMagicToCombo(activeTurnIndex.value, comboIndex, slotKey, magicId);
  advanceComboTarget(comboIndex, slotKey);
  magicPickerOpen.value = false;
}

function advanceComboTarget(comboIndex: number, slotKey: ComboSlotKey) {
  const combos = currentTurnPlan.value?.combos ?? [];
  if (!combos.length) return;
  if (slotKey === 'firstMagicId') {
    activeComboSlot.value = 'secondMagicId';
    return;
  }
  if (comboIndex < combos.length - 1) {
    activeComboIndex.value = comboIndex + 1;
    activeComboSlot.value = 'firstMagicId';
  }
}

function isMagicInActiveCombo(magicId: string) {
  const combo = currentCombo.value;
  return !!combo && (combo.firstMagicId === magicId || combo.secondMagicId === magicId);
}

async function ensureImageUrl(character: Character) {
  if (imageCache.value[character.name]) return imageCache.value[character.name];
  const loaded = await loadCharacterImageUrl(character.name);
  imageCache.value = {
    ...imageCache.value,
    [character.name]: loaded || character.imgUrl || '',
  };
  return imageCache.value[character.name];
}

async function loadReferenceDuoIcon(duoPartner: string) {
  if (!duoPartner || duoIconCache.value[duoPartner]) return;
  const enName = jpNameToEnName[duoPartner];
  if (!enName) return;
  try {
    const loaded = await loadCachedImageUrl(enName, 'icon/');
    duoIconCache.value = {
      ...duoIconCache.value,
      [duoPartner]: loaded || defaultImg,
    };
  } catch {
    duoIconCache.value = {
      ...duoIconCache.value,
      [duoPartner]: defaultImg,
    };
  }
}

function getDuoIconSync(duoPartner: string) {
  if (!duoPartner) return '';
  if (!duoIconCache.value[duoPartner]) {
    void loadReferenceDuoIcon(duoPartner);
  }
  return duoIconCache.value[duoPartner] || '';
}

function handleReferenceDuoIconError(event: Event) {
  const target = event.target as HTMLImageElement | null;
  if (target) target.src = defaultImg;
}

function maxCardLevel(slot: DeckSlot) {
  return getStatScalingMaxLevel(slot.character?.rare);
}

function availableMagicSlots(slot: DeckSlot): MagicSlot[] {
  if (!slot.character) return [1, 2];
  return isM3Unlocked(slot.character.rare, clampTotsuCount(slot.totsu)) ? [1, 2, 3] : [1, 2];
}

function normalizeSelectedMagicSlots(slot: DeckSlot) {
  const available = availableMagicSlots(slot);
  const selected = slot.selectedMagicSlots.filter((magicSlot) => available.includes(magicSlot));
  slot.selectedMagicSlots = selected.slice(0, 2).sort((a, b) => a - b);
}

function magicById(magicId?: string) {
  if (!magicId) return undefined;
  const cache = simulationRuntimeCache?.magicsById;
  if (cache?.has(magicId)) return cache.get(magicId);
  const magic = magicMap.value[magicId];
  cache?.set(magicId, magic);
  return magic;
}

function makeMagicId(deckIndex: number, magicSlot: MagicSlot) {
  return `${deckIndex}-M${magicSlot}`;
}

function makeInvalidMagicId(deckIndex: number, magicSlot: MagicSlot) {
  return `invalid-${deckIndex}-M${magicSlot}`;
}

function parseInvalidMagicId(id: string) {
  const match = id.match(/^invalid-(\d+)-M([123])$/);
  if (!match) return null;
  return {
    deckIndex: Number(match[1]),
    magicSlot: Number(match[2]) as MagicSlot,
  };
}

function parseMagicId(id: string): ParsedMagicId | null {
  const cache = simulationRuntimeCache?.parsedMagicIds;
  if (cache?.has(id)) return cache.get(id) ?? null;
  const match = id.match(/^(\d+)-M([123])$/);
  const parsed = match ? {
    deckIndex: Number(match[1]),
    magicSlot: Number(match[2]) as MagicSlot,
  } : null;
  cache?.set(id, parsed);
  return parsed;
}

function planReferenceEffectLines(deckIndex: number, magicSlot: MagicSlot) {
  const slot = deck.value[deckIndex];
  if (!slot?.character) return [];
  const lines: string[] = [];
  const healText = String(slot.magicHeals[magicSlot] || '').trim();
  if (healText) {
    lines.push(`自 / ${healText}`);
  }
  getAutomaticMagicBuffs(deckIndex, magicSlot).forEach((buff) => {
    const duration = Math.max(1, Math.floor(safeNumber(buff.durationTurns) || 1));
    lines.push(`${parsedBuffReferenceTarget(buff)} / ${describePlayerBuff(buff, parsedRateFromBuff(buff), duration)}`);
  });
  getAutomaticOpponentDebuffs(deckIndex, magicSlot).forEach((buff) => {
    const duration = Math.max(1, Math.floor(safeNumber(buff.durationTurns) || 1));
    lines.push(`${parsedBuffReferenceTarget(buff)} / ${describePlayerOpponentDebuff(buff, parsedRateFromBuff(buff), duration)}`);
  });
  return [...new Set(lines)];
}

function parsedBuffReferenceTarget(buff: ParsedBuff) {
  if (buff.targetType === 'allySelected') return '味方選択';
  if (buff.targetType === 'allyAll') return '味方全体';
  if (buff.targetType === 'opponent') return '相手';
  if (buff.targetType === 'opponentSelected') return '相手選択';
  if (buff.targetType === 'opponentAll') return '相手全体';
  return '自';
}

function deckCardHp(index: number) {
  const runtime = buildRuntimeCharacter(index);
  if (!runtime) return 0;
  return Math.ceil(runtime.hp);
}

function deckCardTotalHp(index: number) {
  const runtime = buildRuntimeCharacter(index);
  if (!runtime) return 0;
  const stats = calculateCharacterStats(runtime, charaDict.value);
  return Math.ceil((safeNumber(stats.hp) || safeNumber(runtime.hp)) + safeNumber(stats.buddyHP));
}

function buildRuntimeCharacter(index: number, activeBuffs: ParsedBuff[] = []) {
  const cached = simulationRuntimeCache?.runtimeCharacters.get(index);
  if (cached) {
    return activeBuffs.length
      ? { ...cached, buffs: activeBuffs.map((buff) => ({ ...buff })) }
      : cached;
  }
  const slot = deck.value[index];
  if (!slot?.character) return null;
  const base = slot.character;
  const totsu = clampTotsuCount(slot.totsu);
  const isBonusSelected = isMaxLimitBreak(totsu);
  const runtime: any = {
    ...base,
    hp: slot.customHp,
    atk: slot.customAtk,
    originalMaxHP: Number(slot.maxHp || slot.customHp),
    originalMaxATK: Number(slot.maxAtk || slot.customAtk),
    max_hp: Number(slot.maxHp || slot.customHp),
    max_atk: Number(slot.maxAtk || slot.customAtk),
    level: Math.min(maxCardLevel(slot), Math.max(1, Math.floor(safeNumber(slot.level) || 1))),
    totsu,
    isBonusSelected,
    hasM3: isM3Unlocked(base.rare, totsu),
    isM1Selected: slot.selectedMagicSlots.includes(1),
    isM2Selected: slot.selectedMagicSlots.includes(2),
    isM3Selected: slot.selectedMagicSlots.includes(3),
    magic1Lv: slot.magicLevels[1],
    magic2Lv: slot.magicLevels[2],
    magic3Lv: slot.magicLevels[3],
    buddy1Lv: slot.buddyLevels[1],
    buddy2Lv: slot.buddyLevels[2],
    buddy3Lv: slot.buddyLevels[3],
    magic1atr: slot.magicAttributes[1],
    magic2atr: slot.magicAttributes[2],
    magic3atr: slot.magicAttributes[3],
    magic1etc: slot.magicEffects[1],
    magic2etc: slot.magicEffects[2],
    magic3etc: slot.magicEffects[3],
    magic1Attribute: slot.magicAttributes[1],
    magic2Attribute: slot.magicAttributes[2],
    magic3Attribute: slot.magicAttributes[3],
    magic1Power: slot.magicPowers[1],
    magic2Power: slot.magicPowers[2],
    magic3Power: slot.magicPowers[3],
    magic1heal: slot.magicHeals[1],
    magic2heal: slot.magicHeals[2],
    magic3heal: slot.magicHeals[3],
    buffs: activeBuffs.map((buff) => ({ ...buff })),
    _examDeckIndex: index,
  };
  if (simulationRuntimeCache && activeBuffs.length === 0) {
    simulationRuntimeCache.runtimeCharacters.set(index, runtime);
  }
  return runtime;
}

function buildRuntimeBuffs(runtime: any) {
  const deckIndex = runtime?._examDeckIndex;
  const canUseCache = simulationRuntimeCache
    && typeof deckIndex === 'number'
    && Number.isInteger(deckIndex)
    && (!Array.isArray(runtime.buffs) || runtime.buffs.length === 0);
  const cached = canUseCache ? simulationRuntimeCache?.runtimeBuffs.get(deckIndex) : undefined;
  if (cached) return cached;
  const buffs: any[] = (Array.isArray(runtime.buffs) ? runtime.buffs.map((buff: any) => ({ ...buff })) : []);
  const parsedHealEffects = parseMagicBuffsFromEtc(runtime, { allowM3: true })
    .filter((buff) => buff.buffOption === '回復' || buff.buffOption === '継続回復')
    .map((buff) => {
      const magicIndex = Number(String(buff.magicOption || '').replace('M', '')) || 1;
      return { ...buff, levelOption: safeNumber(runtime[`magic${magicIndex}Lv`]) || 10 };
    });
  const consumedParsedHealEffects = new Set<string>();
  for (let magicIndex = 1; magicIndex <= 3; magicIndex += 1) {
    const healValue = String(runtime[`magic${magicIndex}heal`] || '');
    const levelOption = safeNumber(runtime[`magic${magicIndex}Lv`]) || 10;
    const parsedForMagic = parsedHealEffects.filter((buff) => buff.magicOption === `M${magicIndex}`);
    if (!healValue) continue;
    const hasContinueHeal = healValue.includes('継続回復');
    const hasInstantHeal = healValue.includes('回復') && (!hasContinueHeal || healValue.includes('回復&継続回復'));
    if (hasContinueHeal) {
      const parsed = parsedForMagic.find((buff) => buff.buffOption === '継続回復');
      if (parsed) consumedParsedHealEffects.add(`${parsed.magicOption}:${parsed.buffOption}`);
      buffs.push({ ...(parsed ?? {}), magicOption: `M${magicIndex}`, buffOption: '継続回復', powerOption: getPowerOption(healValue), levelOption });
    }
    if (hasInstantHeal) {
      const parsed = parsedForMagic.find((buff) => buff.buffOption === '回復');
      if (parsed) consumedParsedHealEffects.add(`${parsed.magicOption}:${parsed.buffOption}`);
      buffs.push({ ...(parsed ?? {}), magicOption: `M${magicIndex}`, buffOption: '回復', powerOption: getPowerOption(healValue), levelOption });
    }
  }
  parsedHealEffects
    .filter((buff) => !consumedParsedHealEffects.has(`${buff.magicOption}:${buff.buffOption}`))
    .forEach((buff) => buffs.push(buff));
  if (canUseCache) simulationRuntimeCache?.runtimeBuffs.set(deckIndex, buffs);
  return buffs;
}

function getMagicPower(deckIndex: number, magicSlot: MagicSlot) {
  const runtime = buildRuntimeCharacter(deckIndex);
  if (!runtime) return '';
  return runtime[`magic${magicSlot}Power`] || '';
}

async function waitForSimulationPaint() {
  await nextTick();
  await new Promise<void>((resolve) => {
    if (typeof window === 'undefined') {
      // Yield to the worker event loop so a queued stop message can be handled.
      setTimeout(resolve, 0);
      return;
    }
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => resolve());
    });
  });
}

function getSimulationClock() {
  if (typeof performance !== 'undefined') return performance.now();
  return Date.now();
}

async function runSimulation() {
  if (validationMessage.value || isRunning.value) return;
  if (!enemyConditionsTouched.value) {
    runAttemptWarning.value = t('examSimulator.enemyConditionsUntouched');
    activeTab.value = 'exam';
    return;
  }
  runAttemptWarning.value = '';
  stopRequested.value = false;
  isRunning.value = true;
  activeTab.value = 'result';
  logDialogOpen.value = false;
  clearResults();
  const resultGeneration = simulationResultGeneration.value;
  simulationRuntimeCache = createSimulationRuntimeCache();
  if (simulationMode.value === 'autoBest') {
    // Posting work to Web Workers yields the main thread, so the running state
    // can paint without delaying every search by two animation frames.
    await nextTick();
  } else {
    await waitForSimulationPaint();
  }
  try {
    const count = Math.min(100000, Math.max(1, Math.floor(safeNumber(iterations.value) || 1)));
    if (simulationMode.value === 'autoBest') {
      await runAutoBestSimulation(count, resultGeneration);
    } else {
      await runNormalSimulation(count);
    }
  } finally {
    simulationRuntimeCache = null;
    isRunning.value = false;
    stopRequested.value = false;
  }
}

function createSimulationRuntimeCache(): SimulationRuntimeCache {
  return {
    turnLimit: maxTurnCount.value,
    totalDeckHp: totalDeckHp.value,
    examKind: exam.value.kind,
    difficulty: exam.value.difficulty,
    specialChallengeScore: selectedSpecialChallengeScore.value,
    specialChallengeLabels: selectedSpecialChallenges.value.map((challenge) => challenge.label),
    runtimeCharacters: new Map(),
    runtimeBuffs: new Map(),
    automaticMagicBuffs: new Map(),
    automaticOpponentDebuffs: new Map(),
    buddyAtk: new Map(),
    magicsById: new Map(),
    parsedMagicIds: new Map(),
    visiblePairs: new Map(),
    duoActive: new Map(),
    enemyActionMeta: new Map(),
    playerMagicMeta: new Map(),
    playerEffectPlans: new Map(),
    continueHealPlans: new Map(),
    playerHealAmounts: new Map(),
    playerDamageResult: {},
    enemyDamageResult: {},
    emptyHitDamages: [],
    pendingResult: {},
  };
}

async function runNormalSimulation(count: number) {
    const scoreFrequencies: Record<number, number> = {};
    const retireReasonFrequencies: Record<string, number> = {};
    const retireTurnFrequencies: Record<number, number> = {};
    let positiveScoreCount = 0;
    let completed = 0;
    let retiredCount = 0;
    let bestScore = Number.NEGATIVE_INFINITY;
    let bestSeedText = '';
    let lastGraphUpdateAt = getSimulationClock();
    const publishAggregate = () => {
      simulationAggregate.value = {
        count: completed,
        retiredCount,
        positiveScoreCount,
        scoreFrequencies: { ...scoreFrequencies },
        retireReasonFrequencies: { ...retireReasonFrequencies },
        retireTurnFrequencies: { ...retireTurnFrequencies },
      };
    };
    for (let i = 0; i < count; i += 1) {
      const seedText = createIterationSeed(i);
      const result = runOneSimulation(createRng(seedText), false);
      completed += 1;
      if (result.retired) {
        retiredCount += 1;
        const reason = retireReasonBucket(result.retireReason);
        retireReasonFrequencies[reason] = (retireReasonFrequencies[reason] ?? 0) + 1;
        const retireTurn = Math.min(maxTurnCount.value, Math.max(1, Math.floor(safeNumber(result.finishTurn) || 1)));
        retireTurnFrequencies[retireTurn] = (retireTurnFrequencies[retireTurn] ?? 0) + 1;
      }
      if (result.score > 0) {
        positiveScoreCount += 1;
        scoreFrequencies[result.score] = (scoreFrequencies[result.score] ?? 0) + 1;
      }
      if (result.score > bestScore) {
        bestScore = result.score;
        bestSeedText = seedText;
      }
      const now = getSimulationClock();
      if (now - lastGraphUpdateAt >= SIMULATION_GRAPH_UPDATE_INTERVAL_MS || completed === count) {
        publishAggregate();
        lastGraphUpdateAt = now;
        await waitForSimulationPaint();
      }
    }
    if (bestSeedText) {
      bestSimulationResult.value = runOneSimulation(createRng(bestSeedText), true);
    }
    publishAggregate();
}

function createAutoBestWorkerClient(): AutoBestWorkerClient {
  let resolveReady!: () => void;
  let rejectReady!: (error: Error) => void;
  const ready = new Promise<void>((resolve, reject) => {
    resolveReady = resolve;
    rejectReady = reject;
  });
  void ready.catch(() => undefined);
  const client: AutoBestWorkerClient = {
    worker: new Worker(new URL('../workers/examAutoBest.worker.ts', import.meta.url), { type: 'module' }),
    ready,
    nextRequestId: 1,
    initializedRunToken: -1,
    requests: new Map(),
  };
  client.worker.onmessage = (event: MessageEvent<{ id: number; ready?: boolean; progress?: AutoBestWorkerProgress; result?: AutoBestSeedSearchResult; error?: string }>) => {
    if (event.data.ready) {
      resolveReady();
      return;
    }
    if (event.data.id === 0 && event.data.error) {
      rejectReady(new Error(event.data.error));
      return;
    }
    const request = client.requests.get(event.data.id);
    if (!request) return;
    if (event.data.progress) {
      request.onProgress(event.data.progress);
      return;
    }
    client.requests.delete(event.data.id);
    if (event.data.error) request.reject(new Error(event.data.error));
    else if (event.data.result) request.resolve(event.data.result);
    else request.reject(new Error('自動最善Workerから結果が返されませんでした。'));
  };
  client.worker.onerror = (event) => {
    const workerError = (event as ErrorEvent).error;
    const detail = [
      event.message,
      workerError instanceof Error ? `${workerError.name}: ${workerError.message}\n${workerError.stack ?? ''}` : String(workerError ?? ''),
      event.filename ? `${event.filename}:${event.lineno}:${event.colno}` : '',
    ].filter(Boolean).join('\n');
    const error = new Error(detail || '自動最善Workerでエラーが発生しました。');
    rejectReady(error);
    client.requests.forEach((request) => request.reject(error));
    client.requests.clear();
  };
  client.worker.postMessage({ id: 0, method: 'warmup' });
  return client;
}

async function ensureAutoBestWorkerPool() {
  if (autoBestWorkerPoolPromise) return await autoBestWorkerPoolPromise;
  const workerCount = Math.min(10, Math.max(1, typeof navigator === 'undefined' ? 8 : navigator.hardwareConcurrency || 8));
  autoBestWorkerPool = [];
  autoBestWorkerPoolPromise = (async () => {
    for (let index = 0; index < workerCount; index += 1) {
      const client = createAutoBestWorkerClient();
      try {
        await client.ready;
        autoBestWorkerPool?.push(client);
      } catch {
        client.worker.terminate();
      }
      if (index + 1 < workerCount) await new Promise<void>((resolve) => window.setTimeout(resolve, 25));
    }
    const workers = autoBestWorkerPool ?? [];
    if (workers.length === 0) throw new Error('自動最善Workerを起動できませんでした。');
    return workers;
  })();
  try {
    return await autoBestWorkerPoolPromise;
  } catch (error) {
    autoBestWorkerPool?.forEach((client) => client.worker.terminate());
    autoBestWorkerPool = null;
    autoBestWorkerPoolPromise = null;
    throw error;
  }
}

async function searchAutoBestSeedParallel(
  seedText: string,
  snapshot: AutoBestWorkerSnapshot,
  runToken: number,
  onProgress: (exploredNodes: number, completedPatterns: number, queuedBranches: number, provisionalBestScore: number) => void,
) {
  const workers = await ensureAutoBestWorkerPool();
  const rootCount = 20;
  const rootQueue = Array.from({ length: rootCount }, (_, rootIndex) => rootIndex);
  if (autoBestRootWeights?.length === rootCount) {
    rootQueue.sort((left, right) => (autoBestRootWeights?.[right] ?? 0) - (autoBestRootWeights?.[left] ?? 0));
  }
  const progress = Array.from<unknown, AutoBestWorkerProgress>({ length: rootCount }, () => ({ exploredNodes: 1, completedPatterns: 0, queuedBranches: 0, provisionalBestScore: 0 }));
  const rootDurations = new Array<number>(rootCount);
  let lastProgressPublishedAt = getSimulationClock();
  const aggregateProgress = () => ({
    exploredNodes: 1 + progress.reduce((sum, value) => sum + Math.max(0, value.exploredNodes - 1), 0),
    completedPatterns: progress.reduce((sum, value) => sum + value.completedPatterns, 0),
    queuedBranches: progress.reduce((sum, value) => sum + value.queuedBranches, 0),
    provisionalBestScore: progress.reduce((best, value) => Math.max(best, value.provisionalBestScore), 0),
  });
  const results = new Array<AutoBestSeedSearchResult>(rootCount);
  let nextRootQueueIndex = 0;
  const runRoot = (
    client: AutoBestWorkerClient,
    rootIndex: number,
    initialize: boolean,
    resetStop: boolean,
  ) => new Promise<AutoBestSeedSearchResult>((resolve, reject) => {
    const id = client.nextRequestId++;
    client.requests.set(id, {
      resolve,
      reject,
      onProgress: (item) => {
        progress[rootIndex] = item;
        const now = getSimulationClock();
        if (now - lastProgressPublishedAt < 500) return;
        lastProgressPublishedAt = now;
        const aggregate = aggregateProgress();
        onProgress(aggregate.exploredNodes, aggregate.completedPatterns, aggregate.queuedBranches, aggregate.provisionalBestScore);
      },
    });
    client.worker.postMessage({
      id,
      method: 'runPartition',
      ...(initialize ? { snapshot } : {}),
      resetStop,
      seedText,
      rootRange: { start: rootIndex, end: rootIndex + 1 },
    });
  });
  const workerTasks = workers.map(async (client) => {
    let initialize = client.initializedRunToken !== runToken;
    let resetStop = true;
    while (nextRootQueueIndex < rootCount) {
      const rootIndex = rootQueue[nextRootQueueIndex++];
      const rootStartedAt = getSimulationClock();
      const result = await runRoot(client, rootIndex, initialize, resetStop);
      rootDurations[rootIndex] = getSimulationClock() - rootStartedAt;
      if (initialize) client.initializedRunToken = runToken;
      initialize = false;
      resetStop = false;
      results[rootIndex] = result;
      if (result.cancelled) break;
    }
  });
  await Promise.all(workerTasks);
  if (results.every(Boolean)) autoBestRootWeights = rootDurations;
  const finalProgress = aggregateProgress();
  onProgress(
    finalProgress.exploredNodes,
    finalProgress.completedPatterns,
    finalProgress.queuedBranches,
    finalProgress.provisionalBestScore,
  );
  let bestResult: SimulationStats | null = null;
  let bestPlan: PlayerPair[] = [];
  const completedResults = results.filter((result): result is AutoBestSeedSearchResult => !!result);
  for (const result of completedResults) {
    if (result.bestResult && (!bestResult || result.bestResult.score > bestResult.score)) {
      bestResult = result.bestResult;
      bestPlan = result.bestPlan;
    }
  }
  return {
    bestResult,
    bestPlan,
    exploredNodes: 1 + completedResults.reduce((sum, result) => sum + Math.max(0, result.exploredNodes - 1), 0),
    completedPatterns: completedResults.reduce((sum, result) => sum + result.completedPatterns, 0),
    queuedBranches: completedResults.reduce((sum, result) => sum + result.queuedBranches, 0),
    cancelled: completedResults.length < rootCount || completedResults.some((result) => result.cancelled),
  } satisfies AutoBestSeedSearchResult;
}

async function runAutoBestSimulation(count: number, resultGeneration: number) {
  const snapshotJson = JSON.stringify({
    exam: exam.value,
    enemySlots: enemySlots.value,
    deck: deck.value,
    selectedSpecialChallengeIds: selectedSpecialChallengeIds.value,
  });
  if (snapshotJson !== autoBestSnapshotKey) {
    autoBestSnapshotKey = snapshotJson;
    autoBestRootWeights = null;
  }
  // Every execution gets a fresh snapshot generation. Worker-side runtime
  // caches contain deck-derived values and must never survive into a later run.
  const snapshot = JSON.parse(snapshotJson) as AutoBestWorkerSnapshot;
  const runToken = ++autoBestRunToken;
  const scoreFrequencies: Record<number, number> = {};
  const retireReasonFrequencies: Record<string, number> = {};
  const retireTurnFrequencies: Record<number, number> = {};
  const startedAt = getSimulationClock();
  let completed = 0;
  let retiredCount = 0;
  let positiveScoreCount = 0;
  let totalExploredNodes = 0;
  let totalCompletedPatterns = 0;
  let bestScore = Number.NEGATIVE_INFINITY;
  let bestSeedText = '';
  let bestPlan: PlayerPair[] = [];
  let provisionalBestScore = 0;
  let currentIteration = 1;
  const isCurrentRun = () => simulationResultGeneration.value === resultGeneration;

  const publishAggregate = () => {
    if (!isCurrentRun()) return;
    simulationAggregate.value = {
      count: completed,
      retiredCount,
      positiveScoreCount,
      scoreFrequencies: { ...scoreFrequencies },
      retireReasonFrequencies: { ...retireReasonFrequencies },
      retireTurnFrequencies: { ...retireTurnFrequencies },
    };
  };
  const publishProgress = (
    localExploredNodes = 0,
    localCompletedPatterns = 0,
    queuedBranches = 0,
    localBestScore = provisionalBestScore,
    stopped = false,
  ) => {
    if (!isCurrentRun()) return;
    provisionalBestScore = Math.max(provisionalBestScore, localBestScore);
    autoBestProgress.value = {
      completedIterations: completed,
      totalIterations: count,
      currentIteration: Math.min(count, currentIteration),
      exploredNodes: totalExploredNodes + localExploredNodes,
      completedPatterns: totalCompletedPatterns + localCompletedPatterns,
      queuedBranches,
      provisionalBestScore,
      elapsedMs: getSimulationClock() - startedAt,
      stopped,
    };
  };

  publishProgress();
  for (let iteration = 0; iteration < count; iteration += 1) {
    if (stopRequested.value || !isCurrentRun()) break;
    currentIteration = iteration + 1;
    const seedText = createIterationSeed(iteration);
    let searchResult: AutoBestSeedSearchResult;
    try {
      searchResult = await searchAutoBestSeedParallel(seedText, snapshot, runToken, (
        exploredNodes,
        completedPatterns,
        queuedBranches,
        currentBestScore,
      ) => {
        publishProgress(exploredNodes, completedPatterns, queuedBranches, currentBestScore);
        publishAggregate();
      });
    } catch (error) {
      if (!stopRequested.value && isCurrentRun()) throw error;
      publishProgress(0, 0, 0, provisionalBestScore, true);
      break;
    }
    if (!isCurrentRun()) break;
    if (searchResult.cancelled) {
      publishProgress(
        searchResult.exploredNodes,
        searchResult.completedPatterns,
        searchResult.queuedBranches,
        searchResult.bestResult?.score ?? provisionalBestScore,
        true,
      );
      break;
    }

    totalExploredNodes += searchResult.exploredNodes;
    totalCompletedPatterns += searchResult.completedPatterns;
    if (!searchResult.bestResult) continue;
    // The score distribution and the detailed best log must come from the
    // same full-plan execution. Replaying one winning plan per seed is tiny
    // compared with the exhaustive DFS and prevents checkpoint/search state
    // from producing a graph range that disagrees with the displayed log.
    const result = runOneSimulation(createRng(seedText), false, {
      forcedPairs: searchResult.bestPlan,
      pauseAtUnforcedDecision: false,
      autoBestMode: true,
    });

    completed += 1;
    if (result.retired) {
      retiredCount += 1;
      const reason = retireReasonBucket(result.retireReason);
      retireReasonFrequencies[reason] = (retireReasonFrequencies[reason] ?? 0) + 1;
      const retireTurn = Math.min(maxTurnCount.value, Math.max(1, Math.floor(safeNumber(result.finishTurn) || 1)));
      retireTurnFrequencies[retireTurn] = (retireTurnFrequencies[retireTurn] ?? 0) + 1;
    }
    if (result.score > 0) {
      positiveScoreCount += 1;
      scoreFrequencies[result.score] = (scoreFrequencies[result.score] ?? 0) + 1;
    }
    if (result.score > bestScore) {
      bestScore = result.score;
      bestSeedText = seedText;
      bestPlan = searchResult.bestPlan.map(([first, second]) => [first, second]);
    }
    provisionalBestScore = Math.max(provisionalBestScore, result.score);
    publishAggregate();
    publishProgress(0, 0, 0, result.score);
    if (iteration + 1 < count) await waitForSimulationPaint();
  }

  if (bestSeedText && isCurrentRun()) {
    bestSimulationResult.value = runOneSimulation(createRng(bestSeedText), true, {
      forcedPairs: bestPlan,
      pauseAtUnforcedDecision: false,
      autoBestMode: true,
    });
  }
  publishAggregate();
  if (isCurrentRun() && !autoBestProgress.value?.stopped) {
    publishProgress(0, 0, 0, provisionalBestScore, stopRequested.value);
  }
}

async function searchAutoBestSeed(
  seedText: string,
  onProgress: (
    exploredNodes: number,
    completedPatterns: number,
    queuedBranches: number,
    provisionalBestScore: number,
  ) => void,
  rootRange?: AutoBestRootRange,
): Promise<AutoBestSeedSearchResult> {
  const frames: Array<{
    checkpoint: AutoBestCheckpoint;
    candidates: PlayerPair[];
    nextIndex: number;
    depth: number;
  }> = [];
  const currentPath: PlayerPair[] = [];
  const branchOptions: SimulationRunOptions = {
    pauseAtUnforcedDecision: true,
    autoBestMode: true,
  };
  let exploredNodes = 0;
  let completedPatterns = 0;
  let bestResult: SimulationStats | null = null;
  let bestPlan: PlayerPair[] = [];
  let bestScore = 0;
  let lastProgressAt = getSimulationClock();
  let cancelled = false;
  const branchRng = createRng(seedText);

  const queuedBranchCount = () => {
    let count = 0;
    for (const frame of frames) count += frame.candidates.length - frame.nextIndex;
    return count;
  };

  const processResult = (result: SimulationStats, depth: number) => {
    if (result.pendingDecision) {
      let candidates = result.pendingDecision.candidates;
      if (depth === 0 && rootRange) {
        candidates = candidates.slice(rootRange.start, rootRange.end);
      }
      frames.push({
        checkpoint: result.pendingDecision.checkpoint,
        candidates,
        nextIndex: 0,
        depth,
      });
      return;
    }
    completedPatterns += 1;
    if (!bestResult || result.score > bestResult.score) {
      // Terminal results are not mutated after runOneSimulation returns. Keep
      // that object until the worker response is structured-cloned instead of
      // copying every field on each provisional-best update.
      bestResult = result;
      bestScore = result.score;
      bestPlan = currentPath.slice(0, depth);
    }
  };

  const initialResult = runOneSimulation(branchRng, false, branchOptions);
  exploredNodes += 1;
  processResult(initialResult, 0);

  while (frames.length > 0) {
    const frame = frames[frames.length - 1];
    if (frame.nextIndex >= frame.candidates.length) {
      frames.pop();
      currentPath.length = frame.depth;
      continue;
    }
    const pair = frame.candidates[frame.nextIndex++];
    currentPath[frame.depth] = pair;
    currentPath.length = frame.depth + 1;
    branchRng.setState(frame.checkpoint.rngState);
    branchOptions.checkpoint = frame.checkpoint;
    branchOptions.forcedPairAtCheckpoint = pair;
    const result = runOneSimulation(branchRng, false, branchOptions);
    exploredNodes += 1;
    processResult(result, frame.depth + 1);

    // Reading the high-resolution clock at every DFS node is measurable at
    // hundreds of thousands of nodes. Stop checks remain per-node; only the
    // optional UI progress check is sampled.
    if ((exploredNodes & 511) === 0) {
      const now = getSimulationClock();
      if (now - lastProgressAt >= AUTO_BEST_PROGRESS_UPDATE_INTERVAL_MS) {
        onProgress(exploredNodes, completedPatterns, queuedBranchCount(), bestScore);
        lastProgressAt = now;
        await waitForSimulationPaint();
        if (stopRequested.value) {
          cancelled = true;
          break;
        }
      }
    }
  }

  if (bestResult && bestPlan.length > 0) {
    bestResult = runOneSimulation(createRng(seedText), false, {
      forcedPairs: bestPlan,
      pauseAtUnforcedDecision: false,
      autoBestMode: true,
    });
    bestScore = bestResult.score;
  }
  onProgress(exploredNodes, completedPatterns, 0, bestScore);
  return { bestResult, bestPlan, exploredNodes, completedPatterns, queuedBranches: 0, cancelled };
}

async function runAutoBestWorkerPartition(
  snapshot: AutoBestWorkerSnapshot | null,
  seedText: string,
  rootRange: AutoBestRootRange,
  onProgress: (exploredNodes: number, completedPatterns: number, queuedBranches: number, provisionalBestScore: number) => void = () => undefined,
  resetStop = false,
) {
  if (snapshot) {
    exam.value = markRaw(snapshot.exam);
    enemySlots.value = markRaw(snapshot.enemySlots);
    deck.value = markRaw(snapshot.deck);
    selectedSpecialChallengeIds.value = markRaw(snapshot.selectedSpecialChallengeIds);
    simulationRuntimeCache = createSimulationRuntimeCache();
  } else if (!simulationRuntimeCache) {
    throw new Error('自動最善Workerが初期化されていません。');
  }
  if (resetStop) stopRequested.value = false;
  if (stopRequested.value) {
    return {
      bestResult: null,
      bestPlan: [],
      exploredNodes: 0,
      completedPatterns: 0,
      queuedBranches: 0,
      cancelled: true,
    } satisfies AutoBestSeedSearchResult;
  }
  return await searchAutoBestSeed(seedText, onProgress, rootRange);
}

function requestAutoBestWorkerStop() {
  stopRequested.value = true;
}

defineExpose({ runAutoBestWorkerPartition, requestAutoBestWorkerStop });

function requestSimulationStop() {
  stopRequested.value = true;
  const cancellationError = new Error('自動最善探索を停止しました。');
  if (autoBestWorkerPool) {
    for (const client of autoBestWorkerPool) {
      client.requests.forEach((request) => request.reject(cancellationError));
      client.requests.clear();
      client.worker.terminate();
    }
  }
  autoBestWorkerPool = null;
  autoBestWorkerPoolPromise = null;
}

function clearResults() {
  simulationResultGeneration.value += 1;
  simulationAggregate.value = null;
  bestSimulationResult.value = null;
  autoBestProgress.value = null;
}

function runOneSimulation(rng: StatefulRng, keepLog: boolean, options: SimulationRunOptions = {}): SimulationStats {
  const resumed = options.checkpoint;
  const runtimeCache = simulationRuntimeCache;
  const turnLimit = runtimeCache?.turnLimit ?? maxTurnCount.value;
  const playerMaxHp = runtimeCache?.totalDeckHp ?? totalDeckHp.value;
  const examKind = runtimeCache?.examKind ?? exam.value.kind;
  const enemyDeck = resumed?.enemyDeck ?? buildEnemyActionDeck(rng, turnLimit * 2);
  let handState = resumed ? resumed.handState : createHandCycle(rng);
  const state: SimulationState = resumed ? cloneSimulationState(resumed.state) : {
    playerAttackDowns: [],
    playerDamageDowns: [],
    playerEvasions: [],
    enemyDamageReductions: [],
    enemyDamageNulls: [],
    enemyEvasions: [],
    enemyCriticals: [],
    enemyAttackDowns: [],
    enemyDamageDowns: [],
    enemyDamageTakenUps: [],
    enemyCurses: [],
    enemyBlinds: [],
    enemyFreezes: [],
    playerBlinds: [],
    playerCurses: [],
    playerFreezes: [],
    burns: [],
    playerDamageTakenDowns: [],
    playerDamageTakenUps: [],
    playerContinueHeals: [],
    playerImmunities: [],
    playerGuts: [],
    playerBuffs: [],
    enemyAttackUps: [],
    enemyDamageUps: [],
    enemyGuts: [],
    enemyContinueHeals: [],
  };
  const initialEnemyHp = resumed?.enemyMaxHp ?? effectiveEnemyMaxHp();
  const stats: SimulationStats = resumed ? cloneSimulationStats(resumed.stats, keepLog) : {
    score: 0,
    retired: false,
    retireReason: '',
    playerDamage: 0,
    enemyDamage: 0,
    enemyHeal: 0,
    playerHeal: 0,
    burnDamage: 0,
    playerRemainHp: playerMaxHp,
    playerTotalHp: playerMaxHp,
    enemyRemainHp: initialEnemyHp,
    enemyMaxHp: initialEnemyHp,
    finishTurn: turnLimit,
    duo: 0,
    advantage: 0,
    equal: 0,
    disadvantage: 0,
    advantageCombo: 0,
    equalCombo: 0,
    disadvantageCombo: 0,
    advantageSingle: 0,
    equalSingle: 0,
    disadvantageSingle: 0,
    advantageDamaged: 0,
    disadvantageDamaged: 0,
    evasion: 0,
    debuff: 0,
    scoreBuff: 0,
    healBlock: 0,
    miss: 0,
    fallback: 0,
    specialChallengeScore: runtimeCache?.specialChallengeScore ?? selectedSpecialChallengeScore.value,
    specialChallengeLabels: runtimeCache?.specialChallengeLabels ?? selectedSpecialChallenges.value.map((challenge) => challenge.label),
    log: keepLog ? [] : undefined,
  };

  let playerHp = resumed?.playerHp ?? playerMaxHp;
  let enemyHp = resumed?.enemyHp ?? initialEnemyHp;
  const enemyMaxHp = resumed?.enemyMaxHp ?? initialEnemyHp;
  if (!resumed) {
    activateInitialBuddyEffects(state);
    if (stats.log) pushLog(stats, () => `開始: 自分HP ${formatNumber(playerHp)} / 敵HP ${formatNumber(enemyHp)} / ${exam.value.kind}`);
    activateInitialSpecialChallenges(state, stats);
  }

  battleLoop:
  for (let turnIndex = resumed?.turnIndex ?? 0; turnIndex < turnLimit; turnIndex += 1) {
    if (handState.visible.length < 2 && handState.hidden.length === 0) {
      if (turnIndex >= 5) {
        handState = createHandCycle(rng);
        if (stats.log) pushLog(stats, () => `${turnIndex + 1}T 手札再配布`);
      } else {
        stats.finishTurn = turnIndex + 1;
        retire(stats, `${turnIndex + 1}T 使用可能な手札が2枚未満`);
        break;
      }
    }
    const firstEnemy = enemyDeck[turnIndex * 2];
    const secondEnemy = enemyDeck[turnIndex * 2 + 1];
    const forcedPair = resumed && turnIndex === resumed.turnIndex
      ? options.forcedPairAtCheckpoint
      : options.forcedPairs?.[turnIndex];
    let selected: PlayerPair | null = null;
    if (forcedPair) {
      // DFS branches only receive pairs generated from this exact checkpoint.
      // Re-validating through the reactive magic map at every explored node is
      // redundant; externally supplied full plans still take the guarded path.
      selected = resumed && options.checkpoint && options.autoBestMode
        ? forcedPair
        : (isValidVisiblePlayerPair(forcedPair, handState.visible) ? forcedPair : null);
    } else if (options.autoBestMode) {
      const candidates = enumerateVisiblePlayerPairs(handState.visible);
      if (options.pauseAtUnforcedDecision && candidates.length > 0) {
        stats.finishTurn = turnIndex + 1;
        const pendingDecision: AutoBestDecision = {
          turnIndex,
          candidates,
          checkpoint: {
            turnIndex,
            enemyDeck,
            handState,
            state,
            stats,
            playerHp,
            enemyHp,
            enemyMaxHp,
            rngState: rng.getState(),
          },
        };
        const pendingResult = simulationRuntimeCache?.pendingResult;
        if (pendingResult) {
          pendingResult.pendingDecision = pendingDecision;
          return pendingResult as SimulationStats;
        }
        return { pendingDecision } as SimulationStats;
      }
    } else {
      selected = choosePlayerPair(turnIndex, handState.visible, stats, enemyDeck);
    }
    if (!selected) {
      stats.finishTurn = turnIndex + 1;
      retire(stats, options.autoBestMode
        ? `${turnIndex + 1}T 使用可能な行動組み合わせなし`
        : `${turnIndex + 1}T 許容組み合わせなし`);
      break;
    }
    handState = consumeHand(handState, selected);
    const playerActsFirst = isPlayerFirstTurn(turnIndex);

    for (let phaseIndex = 0; phaseIndex < 4; phaseIndex += 1) {
      const actionIndex = phaseIndex >> 1;
      const isPlayerAction = (phaseIndex % 2 === 0) === playerActsFirst;
      const magicId = selected[actionIndex];
      const pairedMagicId = selected[1 - actionIndex];
      const enemyAction = actionIndex === 0 ? firstEnemy : secondEnemy;
      const pairedEnemyAction = actionIndex === 0 ? secondEnemy : firstEnemy;
      const actionLabel = actionIndex === 0 ? '先手' : '後手';
      if (isPlayerAction) {
        const playerHpBeforeHeal = playerHp;
        activatePlayerMagicBuffs(magicId, pairedMagicId, state, stats, turnIndex + 1, actionLabel);
        activatePlayerContinueHeal(magicId, pairedMagicId, state, stats);
        activatePlayerOpponentDebuffs(magicId, enemyAction, pairedEnemyAction, state, rng, stats, turnIndex + 1, actionLabel);
        const heal = calculatePlayerHeal(magicId, state);
        if (heal > 0) {
          playerHp = Math.min(playerMaxHp, playerHp + heal);
          const actualHeal = Math.max(0, playerHp - playerHpBeforeHeal);
          if (actualHeal > 0) {
            if (examKind === 'DEFENCE' || stats.log) stats.playerHeal += actualHeal;
            if (stats.log) pushLog(stats, () => `${turnIndex + 1}T ${actionLabel} 自分回復 ${describeMagic(magicId)} ${formatNumber(playerHpBeforeHeal)}→${formatNumber(playerHp)} (+${formatNumber(actualHeal)})`);
          }
        }
      } else {
        const enemyEffectFrozen = !!enemyAction
          && isEnemySideTarget(enemyAction.effectTarget)
          && isEnemyFrozen(state, enemyAction.slotKey)
          && isEnemyFreezeBlockedEffectKind(enemyAction.effectKind);
        let appliedEnemyHeal = 0;
        if (!enemyEffectFrozen) {
          appliedEnemyHeal = applyEnemySelfEffects(enemyAction, state, enemyHp, enemyMaxHp, stats, pairedEnemyAction);
          if (appliedEnemyHeal > 0) {
            enemyHp = Math.min(enemyMaxHp, enemyHp + appliedEnemyHeal);
            if (stats.log) stats.enemyHeal += appliedEnemyHeal;
          }
          applyEnemyAdditionalEffects(enemyAction, magicId, pairedMagicId, state, rng, stats, pairedEnemyAction);
        }
        if (enemyAction?.effectKind && enemyAction.effectKind !== 'none') {
          if (stats.log) pushLog(stats, () => `${turnIndex + 1}T ${actionLabel} 相手効果 ${describeEnemyAction(enemyAction)}${describeEnemyEffectTarget(enemyAction, magicId, pairedMagicId)} / ${describeEnemyEffect(enemyAction)}${enemyEffectFrozen ? ' / 凍結無効化' : ''}${appliedEnemyHeal > 0 ? ` / 敵回復${formatNumber(appliedEnemyHeal)}` : ''}`);
        }
      }
    }

    for (let phaseIndex = 0; phaseIndex < 4; phaseIndex += 1) {
      const actionIndex = phaseIndex >> 1;
      const isPlayerAction = (phaseIndex % 2 === 0) === playerActsFirst;
      const magicId = selected[actionIndex];
      const pairedMagicId = selected[1 - actionIndex];
      const enemyAction = actionIndex === 0 ? firstEnemy : secondEnemy;
      const actionLabel = actionIndex === 0 ? '先手' : '後手';
      if (isPlayerAction) {
        const enemyHpBeforePhase = enemyHp;
        const targetElement = resolveTargetElement(enemyAction);
        const duoActive = isDuoActiveForPair(magicId, pairedMagicId);
        const playerAttack = calculatePlayerDamage(magicId, targetElement, state, rng, stats, duoActive, enemyAction);
        enemyHp = Math.max(0, enemyHp - playerAttack.damage);
        const gutsResult = applyEnemyGutsIfNeeded(state, enemyHp, stats, enemyAction?.slotKey);
        enemyHp = gutsResult.hp;
        stats.playerDamage += playerAttack.damage;
        incrementCompatibilityStats(stats, playerAttack.compatibility, playerAttack.hitCount);
        if (playerAttack.isDuo && (runtimeCache?.examKind ?? exam.value.kind) === 'BASIC') stats.duo += 1;

        if (stats.log) pushLog(stats, () => `${turnIndex + 1}T ${actionLabel} 自分 ${describeMagic(magicId, duoActive)} -> ${describeEnemyTarget(enemyAction)}:${targetElement} 与${formatNumber(playerAttack.damage)}${playerAttack.isDuo ? ' DUO' : ''}${describePlayerAttackSpecials(playerAttack)}${gutsResult.used ? ' / ガッツ' : ''} / 敵HP ${formatNumber(enemyHpBeforePhase)}→${formatNumber(enemyHp)}`);
        if (enemyHp <= 0) {
          stats.finishTurn = turnIndex + 1;
          break battleLoop;
        }
      } else {
        const playerHpBeforeEnemy = playerHp;
        const incoming = calculateEnemyDamage(enemyAction, magicId, state, rng, stats);
        playerHp = Math.max(0, playerHp - incoming.damage);
        const playerGutsResult = applyPlayerGutsIfNeeded(state, playerHp, magicId);
        playerHp = playerGutsResult.hp;
        if (stats.log) stats.enemyDamage += incoming.damage;
        if ((runtimeCache?.examKind ?? exam.value.kind) === 'DEFENCE') {
          if (incoming.defenceCompatibility === 'advantage') stats.advantageDamaged += incoming.damage;
          if (incoming.defenceCompatibility === 'disadvantage') stats.disadvantageDamaged += incoming.damage;
        }
        if (stats.log) pushLog(stats, () => {
          const hitText = incoming.hitDamages.length > 1 ? ` [${incoming.hitDamages.map(formatNumber).join('+')}]` : '';
          const evasionText = incoming.evasionCount > 0 ? ` / 回避成功${incoming.evasionCount}回` : '';
          const blindText = incoming.blindMiss ? ' / 暗闇MISS1回' : '';
          const criticalText = incoming.criticalCount > 0 ? ` / クリティカル${incoming.criticalCount}回` : '';
          const modifierText = describeEnemyDamageModifiers(incoming.atkRate, incoming.damageRate);
          return `${turnIndex + 1}T ${actionLabel} 相手 ${describeEnemyAction(enemyAction)} -> ${describeMagic(magicId)} 受け${incoming.defenderElement} 被${formatNumber(incoming.damage)}${hitText}${evasionText}${blindText}${criticalText}${modifierText}${playerGutsResult.used ? ' / ガッツ' : ''} / 逆算ATK${formatNumber(incoming.baseAtk)} / 等倍${formatNumber(incoming.equalDamage)} / 自HP ${formatNumber(playerHpBeforeEnemy)}→${formatNumber(playerHp)}`;
        });
        if (playerHp <= 0) {
          stats.finishTurn = turnIndex + 1;
          retire(stats, `${turnIndex + 1}T ${actionLabel} 被ダメージで自HP0`);
          break battleLoop;
        }
      }
    }

    const burnDamage = applyBurnDamage(state, playerHp);
    if (burnDamage > 0) {
      playerHp -= burnDamage;
      if (stats.log) stats.burnDamage += burnDamage;
      if (stats.log) pushLog(stats, () => `${turnIndex + 1}T やけど: ${burnDamage}`);
    }
    const enemyContinueHeal = applyEnemyContinueHeal(state, enemyHp, enemyMaxHp);
    if (enemyContinueHeal > 0) {
      const beforeEnemyHeal = enemyHp;
      enemyHp = Math.min(enemyMaxHp, enemyHp + enemyContinueHeal);
      const actualEnemyHeal = Math.max(0, enemyHp - beforeEnemyHeal);
      if (actualEnemyHeal > 0) {
        if (stats.log) stats.enemyHeal += actualEnemyHeal;
        if (stats.log) pushLog(stats, () => `${turnIndex + 1}T 相手継続回復: +${formatNumber(actualEnemyHeal)} / 敵HP ${formatNumber(beforeEnemyHeal)}→${formatNumber(enemyHp)}`);
      }
    }
    const continueHeal = applyPlayerContinueHeal(state, playerHp, !!stats.log);
    if (continueHeal.total > 0) {
      playerHp = Math.min(playerMaxHp, playerHp + continueHeal.total);
      if (examKind === 'DEFENCE' || stats.log) stats.playerHeal += continueHeal.total;
      continueHeal.details
        .filter((detail) => detail.amount > 0)
        .forEach((detail) => {
          if (stats.log) pushLog(stats, () => {
            const cappedText = detail.capped ? ` / 上限前${formatNumber(detail.potentialAmount)}` : '';
            return `${turnIndex + 1}T 継続回復 ${detail.source}: +${formatNumber(detail.amount)}${cappedText}`;
          });
        });
    }
    tickTimedEffects(state);
    stats.finishTurn = turnIndex + 1;
    if (stats.log) pushLog(stats, () => `${turnIndex + 1}T 終了: 自HP ${formatNumber(playerHp)} / 敵HP ${formatNumber(enemyHp)}`);
    if (enemyHp <= 0) break;
  }

  stats.playerRemainHp = playerHp;
  stats.enemyRemainHp = enemyHp;
  stats.score = stats.retired ? 0 : calculateScore(stats);
  if (stats.log) pushLog(stats, () => `結果: スコア ${formatNumber(stats.score)}${stats.retired ? ` / リタイア ${stats.retireReason}` : ''}`);
  pushScoreBreakdownLog(stats);
  return stats;
}

function cloneSimulationState(state: SimulationState): SimulationState {
  return { ...state, _ownedMask: 0 };
}

const stateArrayOwnershipBits = Object.fromEntries([
  'playerAttackDowns', 'playerDamageDowns', 'playerEvasions', 'enemyDamageReductions',
  'enemyDamageNulls', 'enemyEvasions', 'enemyCriticals', 'enemyAttackDowns',
  'enemyDamageDowns', 'enemyDamageTakenUps', 'enemyCurses', 'enemyBlinds',
  'enemyFreezes', 'playerBlinds', 'playerCurses', 'playerFreezes', 'burns',
  'playerDamageTakenDowns', 'playerDamageTakenUps', 'playerContinueHeals',
  'playerImmunities', 'playerGuts', 'playerBuffs', 'enemyAttackUps', 'enemyDamageUps',
  'enemyGuts', 'enemyContinueHeals',
].map((key, index) => [key, 2 ** index])) as Record<SimulationStateArrayKey, number>;

function appendState<K extends SimulationStateArrayKey>(
  state: SimulationState,
  key: K,
  value: SimulationState[K][number],
) {
  const bit = stateArrayOwnershipBits[key];
  const ownedMask = state._ownedMask ?? 0;
  if ((ownedMask & bit) === 0) {
    (state as any)[key] = [...state[key]];
    state._ownedMask = ownedMask | bit;
  }
  (state[key] as Array<SimulationState[K][number]>).push(value);
}

function cloneSimulationStats(stats: SimulationStats, keepLog: boolean): SimulationStats {
  return {
    score: stats.score,
    retired: stats.retired,
    retireReason: stats.retireReason,
    playerDamage: stats.playerDamage,
    enemyDamage: stats.enemyDamage,
    enemyHeal: stats.enemyHeal,
    playerHeal: stats.playerHeal,
    burnDamage: stats.burnDamage,
    playerRemainHp: stats.playerRemainHp,
    playerTotalHp: stats.playerTotalHp,
    enemyRemainHp: stats.enemyRemainHp,
    enemyMaxHp: stats.enemyMaxHp,
    finishTurn: stats.finishTurn,
    duo: stats.duo,
    advantage: stats.advantage,
    equal: stats.equal,
    disadvantage: stats.disadvantage,
    advantageCombo: stats.advantageCombo,
    equalCombo: stats.equalCombo,
    disadvantageCombo: stats.disadvantageCombo,
    advantageSingle: stats.advantageSingle,
    equalSingle: stats.equalSingle,
    disadvantageSingle: stats.disadvantageSingle,
    advantageDamaged: stats.advantageDamaged,
    disadvantageDamaged: stats.disadvantageDamaged,
    evasion: stats.evasion,
    debuff: stats.debuff,
    scoreBuff: stats.scoreBuff,
    healBlock: stats.healBlock,
    miss: stats.miss,
    fallback: stats.fallback,
    specialChallengeScore: stats.specialChallengeScore,
    specialChallengeLabels: keepLog ? [...stats.specialChallengeLabels] : stats.specialChallengeLabels,
    log: keepLog ? [...(stats.log ?? [])] : undefined,
  };
}

function createHandCycle(rng: () => number) {
  const shuffled = shuffle(handMagicIds.value, rng);
  return {
    visible: shuffled.slice(0, 5),
    hidden: shuffled.slice(5),
  };
}

function enumerateVisiblePlayerPairs(visible: string[]): PlayerPair[] {
  const cache = simulationRuntimeCache?.visiblePairs;
  const cacheKey = visible.join('|');
  const cached = cache?.get(cacheKey);
  if (cached) return cached;
  const selectable = visible.filter((magicId) => !!magicById(magicId));
  const pairs: PlayerPair[] = [];
  selectable.forEach((firstMagicId) => {
    selectable.forEach((secondMagicId) => {
      if (firstMagicId !== secondMagicId) pairs.push([firstMagicId, secondMagicId]);
    });
  });
  cache?.set(cacheKey, pairs);
  return pairs;
}

function isValidVisiblePlayerPair(pair: PlayerPair, visible: string[]) {
  return pair[0] !== pair[1]
    && !!magicMap.value[pair[0]]
    && !!magicMap.value[pair[1]]
    && visible.includes(pair[0])
    && visible.includes(pair[1]);
}

function choosePlayerPair(
  turnIndex: number,
  visible: string[],
  stats: SimulationStats,
  enemyDeck: Array<RuntimeEnemyAction | undefined>,
): [string, string] | null {
  const combos = turnPlans.value[turnIndex]?.combos ?? [];
  const visibleSet = new Set(visible);
  const matched = combos
    .map((combo, priority) => ({ combo, priority }))
    .filter(({ combo }) => (
      combo.firstMagicId
      && combo.secondMagicId
      && combo.firstMagicId !== combo.secondMagicId
      && visibleSet.has(combo.firstMagicId)
      && visibleSet.has(combo.secondMagicId)
    ));
  if (matched.length) {
    if (shouldUseAllElementSmartSelection(turnIndex)) {
      return chooseAllElementSmartPair(turnIndex, matched, enemyDeck);
    }
    const firstMatched = matched[0].combo;
    return [firstMatched.firstMagicId, firstMatched.secondMagicId];
  }
  stats.fallback += 1;
  if (stats.log) pushLog(stats, () => `${turnIndex + 1}T 許容外のみ: ${visible.map((magicId) => describeMagic(magicId)).join(' / ')}`);
  return null;
}

function shouldUseAllElementSmartSelection(turnIndex: number) {
  return exam.value.enemyElement === '全'
    && turnPlans.value[turnIndex]?.useElementCompatibilityPriority === true;
}

function chooseAllElementSmartPair(
  turnIndex: number,
  matched: Array<{ combo: TurnCombo; priority: number }>,
  enemyDeck: Array<RuntimeEnemyAction | undefined>,
): [string, string] {
  let best: { selected: [string, string]; score: number; priority: number } | null = null;
  matched.forEach(({ combo, priority }) => {
    const normalSelected: [string, string] = [combo.firstMagicId, combo.secondMagicId];
    const normalScore = calculateAllElementPairScore(turnIndex, normalSelected, enemyDeck);
    let candidate = {
      selected: normalSelected,
      score: normalScore,
      priority,
    };
    if (combo.allowAutoSwap === true) {
      const swappedSelected: [string, string] = [combo.secondMagicId, combo.firstMagicId];
      const swappedScore = calculateAllElementPairScore(turnIndex, swappedSelected, enemyDeck);
      if (swappedScore > normalScore) {
        candidate = {
          selected: swappedSelected,
          score: swappedScore,
          priority,
        };
      }
    }
    if (!best || candidate.score > best.score) {
      best = candidate;
    }
  });
  const resolvedBest = best as { selected: [string, string] } | null;
  return resolvedBest?.selected ?? [matched[0].combo.firstMagicId, matched[0].combo.secondMagicId];
}

function calculateAllElementPairScore(turnIndex: number, selected: [string, string], enemyDeck: Array<RuntimeEnemyAction | undefined>) {
  const knownSlotIndex = knownEnemySlotIndexForTurn(turnIndex);
  const unknownSlotIndex = knownSlotIndex === 0 ? 1 : 0;
  const knownEnemy = enemyDeck[turnIndex * 2 + knownSlotIndex];
  const knownScore = advantageScoreAgainstEnemy(selected[knownSlotIndex], knownEnemy);
  const unknownCandidates = unknownEnemyCandidatesForTurn(enemyDeck, turnIndex);
  const unknownScore = unknownCandidates.length
    ? unknownCandidates.reduce((sum, enemy) => sum + advantageScoreAgainstEnemy(selected[unknownSlotIndex], enemy), 0) / unknownCandidates.length
    : 0;
  return knownScore + unknownScore;
}

function knownEnemySlotIndexForTurn(turnIndex: number): 0 | 1 {
  return (turnIndex + 1) % 2 === 1 ? 0 : 1;
}

function unknownEnemyCandidatesForTurn(enemyDeck: Array<RuntimeEnemyAction | undefined>, turnIndex: number) {
  const knownSlotIndex = knownEnemySlotIndexForTurn(turnIndex);
  const knownEnemyDeckIndex = turnIndex * 2 + knownSlotIndex;
  const blockStart = Math.floor(turnIndex / 5) * 10;
  const turnInBlock = turnIndex % 5;
  const visibleStart = blockStart + turnInBlock * 2;
  const visibleEnd = Math.min(enemyDeck.length, blockStart + 10, visibleStart + 5);
  return enemyDeck
    .slice(visibleStart, visibleEnd)
    .filter((enemy, offset): enemy is RuntimeEnemyAction => !!enemy && visibleStart + offset !== knownEnemyDeckIndex);
}

function advantageScoreAgainstEnemy(magicId: string, enemyAction: RuntimeEnemyAction | undefined) {
  const magic = magicById(magicId);
  if (!magic || !enemyAction) return 0;
  return getCompatibility(magic.element, effectiveEnemyActionElement(enemyAction)) === 'advantage' ? 1 : 0;
}

function consumeHand(handState: { visible: string[]; hidden: string[] }, selected: [string, string]) {
  const nextVisible: string[] = [];
  for (const id of handState.visible) {
    if (id !== selected[0] && id !== selected[1]) nextVisible.push(id);
  }
  const drawCount = Math.min(5 - nextVisible.length, handState.hidden.length);
  for (let index = 0; index < drawCount; index += 1) nextVisible.push(handState.hidden[index]);
  return {
    visible: nextVisible,
    hidden: drawCount > 0 ? handState.hidden.slice(drawCount) : handState.hidden,
  };
}

function isPlayerFirstTurn(turnIndex: number) {
  if ((simulationRuntimeCache?.examKind ?? exam.value.kind) === 'ATTACK' && turnIndex >= 5) return false;
  return turnIndex % 2 === 0;
}

function activateInitialBuddyEffects(state: SimulationState) {
  const seenContinueHeals = new Set<string>();
  deck.value.forEach((slot, deckIndex) => {
    if (!slot.character) return;
    const runtime = buildRuntimeCharacter(deckIndex);
    if (!runtime) return;

    getRuntimeBuddyGeneratedBuffs(runtime).forEach((buff: any) => {
      if (buff.buffOption === '継続回復') {
        const key = `${deckIndex}:${buff.buddyIndex}:${buff.status}`;
        if (seenContinueHeals.has(key)) return;
        seenContinueHeals.add(key);
        appendState(state, 'playerContinueHeals', {
          cardIndex: deckIndex,
          rate: buddyContinueHealRate,
          turns: buddyInitialEffectTurns,
          source: `${describeDeckCard(deckIndex)} ${buff.status}`,
          isBuddyGenerated: true,
        });
        return;
      }
      appendState(state, 'playerBuffs', {
        targetDeckIndex: deckIndex,
        buff,
        turns: buddyInitialEffectTurns,
        source: buff.status,
      });
    });

    getRuntimeBuddyAdditionalEffects(runtime).forEach(({ effect }) => {
      const evasionMatch = effect.match(/^回避\((.+)\)$/);
      if (evasionMatch) {
        const rate = safeNumber(evasionRateByPower[evasionMatch[1]]) || 0;
        if (rate > 0) {
          appendState(state, 'playerEvasions', {
            cardIndex: deckIndex,
            rate,
            turns: buddyInitialEffectTurns,
            source: effect,
            isBuddyGenerated: true,
          });
        }
        return;
      }

      const damageTakenMatch = effect.match(/^被ダメージDOWN\((.+)\)$/);
      if (damageTakenMatch) {
        const rate = buddyDamageTakenDownRate(damageTakenMatch[1], false);
        if (rate > 0) {
          appendState(state, 'playerDamageTakenDowns', {
            cardIndex: deckIndex,
            rate,
            turns: buddyInitialEffectTurns,
            source: effect,
            isBuddyGenerated: true,
          });
        }
        return;
      }

      const attributeDamageTakenMatch = effect.match(/^(火|水|木|無)属性被ダメージDOWN\((.+)\)$/);
      if (attributeDamageTakenMatch) {
        const [, attribute, power] = attributeDamageTakenMatch as [string, ActionElement, string];
        const rate = buddyDamageTakenDownRate(power, true);
        if (rate > 0) {
          appendState(state, 'playerDamageTakenDowns', {
            cardIndex: deckIndex,
            rate,
            turns: buddyInitialEffectTurns,
            attributeOption: attribute,
            source: effect,
            isBuddyGenerated: true,
          });
        }
        return;
      }

      const immunityKind = buddyImmunityKinds[effect];
      if (immunityKind) {
        appendState(state, 'playerImmunities', {
          cardIndex: deckIndex,
          kind: immunityKind,
          turns: buddyInitialEffectTurns,
          source: effect,
          isBuddyGenerated: true,
        });
      }
    });
  });
}

function effectiveEnemyMaxHp() {
  return selectedSpecialChallenges.value.reduce((hp, challenge) => {
    const hpEffect = challenge.effects.find((effect) => effect.kind === 'enemyMaxHp');
    const value = safeNumber(hpEffect?.value);
    return value > 0 ? value : hp;
  }, safeNumber(exam.value.enemyHp));
}

function activateInitialSpecialChallenges(state: SimulationState, stats: SimulationStats) {
  const challenges = selectedSpecialChallenges.value;
  if (!challenges.length) return;
  challenges.forEach((challenge) => {
    challenge.effects.forEach((effect) => applySpecialChallengeEffect(effect, state));
  });
  if (stats.log) pushLog(stats, () => `特別課題: ${challenges.map((challenge) => `${specialChallengeRankLabel(challenge.rank)}${challenge.label}+${formatNumber(challenge.score)}`).join(' / ')} / 加点 +${formatNumber(selectedSpecialChallengeScore.value)}`);
}

function applySpecialChallengeEffect(effect: ExamSpecialChallengeEffect, state: SimulationState) {
  if (effect.kind === 'enemyMaxHp') return;
  const duration = Math.max(1, Math.floor(safeNumber(effect.duration) || 1));
  const value = safeNumber(effect.value);
  switch (effect.kind) {
    case 'enemyAttackUp':
      appendState(state, 'enemyAttackUps', { rate: value || 32, turns: duration });
      break;
    case 'enemyDamageUp':
      appendState(state, 'enemyDamageUps', { rate: value || 5, turns: duration, attributeOption: effect.attribute });
      break;
    case 'enemyDamageReduction':
      appendState(state, 'enemyDamageReductions', { rate: value || 8.75, turns: duration, attributeOption: effect.attribute });
      break;
    case 'enemyDamageNull':
      appendState(state, 'enemyDamageNulls', { rate: 100, turns: duration, attributeOption: effect.attribute });
      break;
    case 'enemyEvasion':
      appendState(state, 'enemyEvasions', { rate: value || 14.8, turns: duration });
      break;
    case 'enemyCritical':
      appendState(state, 'enemyCriticals', { rate: value || criticalRatePowerScale.小, turns: duration });
      break;
    case 'enemyContinueHeal':
      appendState(state, 'enemyContinueHeals', { amount: ceilDamage(value), turns: duration, source: '特別課題' });
      break;
    case 'playerDamageDown':
      specialChallengeTargetCardIndices(effect).forEach((cardIndex) => {
        appendState(state, 'playerDamageDowns', { cardIndex, rate: value || 5, turns: duration, attributeOption: effect.attribute });
      });
      break;
    case 'playerDamageTakenUp':
      specialChallengeTargetCardIndices(effect).forEach((cardIndex) => {
        appendState(state, 'playerDamageTakenUps', { cardIndex, rate: value || 8.75, turns: duration, attributeOption: effect.attribute });
      });
      break;
    case 'playerBlind':
      specialChallengeTargetCardIndices(effect).forEach((cardIndex) => {
        if (!isPlayerImmune(state, cardIndex, 'blind')) {
          appendState(state, 'playerBlinds', { cardIndex, rate: value || blindRatePowerScale.中, turns: duration });
        }
      });
      break;
    case 'playerBurn':
      specialChallengeTargetCardIndices(effect).forEach((cardIndex) => {
        if (!isPlayerImmune(state, cardIndex, 'burn')) {
          appendState(state, 'burns', { cardIndex, rate: value || 16, turns: duration });
        }
      });
      break;
    case 'playerCurse':
      specialChallengeTargetCardIndices(effect).forEach((cardIndex) => {
        if (!isPlayerImmune(state, cardIndex, 'curse')) {
          appendState(state, 'playerCurses', { cardIndex, rate: 100, turns: duration });
        }
      });
      break;
    case 'playerFreeze':
      specialChallengeTargetCardIndices(effect).forEach((cardIndex) => {
        if (!isPlayerImmune(state, cardIndex, 'freeze')) {
          appendState(state, 'playerFreezes', { cardIndex, rate: 100, turns: duration });
        }
      });
      break;
    default:
      break;
  }
}

function specialChallengeTargetCardIndices(effect: ExamSpecialChallengeEffect) {
  return deck.value
    .map((slot, index) => ({ slot, index }))
    .filter(({ slot }) => !!slot.character)
    .filter(({ index }) => specialChallengeDormMatches(effect, index))
    .map(({ index }) => index);
}

function specialChallengeDormMatches(effect: ExamSpecialChallengeEffect, deckIndex: number) {
  if (!effect.dorm) return true;
  const dorm = deckCharacterDorm(deckIndex);
  return effect.dormMode === 'exclude' ? dorm !== effect.dorm : dorm === effect.dorm;
}

function deckCharacterDorm(deckIndex: number) {
  const character = deck.value[deckIndex]?.character;
  return character ? charaDormMap[character.chara] || '' : '';
}

function getRuntimeBuddyAdditionalEffects(runtime: any) {
  const totsu = runtime?.totsu ?? (runtime?.isBonusSelected ? 4 : 0);
  if (!isTotsuBuddyEnhanced(runtime?.rare, totsu)) return [];
  return [1, 2, 3].flatMap((buddyIndex) => {
    const buddyName = runtime?.[`buddy${buddyIndex}c`];
    const isActive = !!(buddyName && charaDict.value && buddyName in charaDict.value);
    if (!isActive) return [];
    const status = getBuddyStatusForCharacter(runtime, buddyIndex, { totsu, isActive });
    return splitBuddyEffects(status).map((effect) => ({ buddyIndex, effect }));
  });
}

function buddyDamageTakenDownRate(power: string, attributeSpecific: boolean) {
  const prefix = attributeSpecific ? '属性ダメDOWN' : 'ダメDOWN';
  return Math.abs(safeNumber(dmgbuffDict[`${prefix}(${power})10`]) * 100);
}

function isDuoActiveForPair(magicId: string, pairedMagicId: string) {
  const cacheKey = `${magicId}|${pairedMagicId}`;
  const cached = simulationRuntimeCache?.duoActive.get(cacheKey);
  if (cached !== undefined) return cached;
  const parsed = parseMagicId(magicId);
  const paired = parseMagicId(pairedMagicId);
  if (!parsed || !paired || parsed.magicSlot !== 2) {
    simulationRuntimeCache?.duoActive.set(cacheKey, false);
    return false;
  }
  const source = deck.value[parsed.deckIndex]?.character;
  const partner = deck.value[paired.deckIndex]?.character;
  const active = !!source?.duo && !!partner && partner.chara === source.duo;
  simulationRuntimeCache?.duoActive.set(cacheKey, active);
  return active;
}

function activatePlayerMagicBuffs(
  magicId: string,
  pairedMagicId: string,
  state: SimulationState,
  stats: SimulationStats,
  turnNumber: number,
  timingLabel: string,
) {
  const parsed = parseMagicId(magicId);
  if (!parsed) return;
  const effectPlans = getPlayerEffectPlans(magicId, pairedMagicId, parsed);
  if (!effectPlans.length) return;
  effectPlans.forEach(({ buff, duration, targets }) => {
    if (isPlayerFrozen(state, parsed.deckIndex) && isFreezeBlockedPlayerSideEffect(buff)) {
      if (stats.log) pushLog(stats, () => `${turnNumber}T ${timingLabel} 自分効果 ${describeMagic(magicId)} / ${describePlayerBuff(buff, parsedRateFromBuff(buff), duration)} / 凍結無効化`);
      return;
    }
    let appliedForAttackScore = false;
    let appliedForDefenceScore = false;
    let appliedForEvasionScore = false;
    let applied = false;
    let effectText = '';
    targets.forEach((targetDeckIndex) => {
      if (buff.buffOption === 'デバフ解除') {
        removePlayerNegativeEffects(state, [targetDeckIndex]);
        applied = true;
        if (stats.log) effectText = describePlayerBuff(buff, 0, duration);
        return;
      }
      if (buff.buffOption === 'バフ解除') {
        removePlayerPositiveEffects(state, [targetDeckIndex]);
        applied = true;
        if (stats.log) effectText = describePlayerBuff(buff, 0, duration);
        return;
      }
      const immunityKind = playerImmunityKindFromBuff(buff);
      if (immunityKind) {
        appendState(state, 'playerImmunities', {
          cardIndex: targetDeckIndex,
          kind: immunityKind,
          turns: duration,
          source: describeMagic(magicId),
        });
        applied = true;
        if (stats.log) effectText = describePlayerBuff(buff, 0, duration);
        return;
      }
      if (buff.buffOption === '回避') {
        const rate = evasionRateFromParsedBuff(buff);
        if (rate <= 0) return;
        appendState(state, 'playerEvasions', {
          cardIndex: targetDeckIndex,
          rate,
          turns: duration,
        });
        appliedForEvasionScore = true;
        applied = true;
        if (stats.log) effectText = describePlayerBuff(buff, rate, duration);
        return;
      }
      if (isPlayerDamageTakenDownBuff(buff)) {
        const rate = playerDamageTakenDownRateFromParsedBuff(buff);
        if (rate <= 0) return;
        appendState(state, 'playerDamageTakenDowns', {
          cardIndex: targetDeckIndex,
          rate,
          turns: duration,
          attributeOption: buff.buffOption === '属性被ダメージDOWN' ? buff.attributeOption : undefined,
        });
        appliedForDefenceScore = true;
        applied = true;
        if (stats.log) effectText = describePlayerBuff(buff, rate, duration);
        return;
      }
      if (isPlayerDamageTakenUpBuff(buff)) {
        const rate = playerDamageTakenUpRateFromParsedBuff(buff);
        if (rate <= 0) return;
        appendState(state, 'playerDamageTakenUps', {
          cardIndex: targetDeckIndex,
          rate,
          turns: duration,
          attributeOption: buff.buffOption === '属性被ダメージUP' ? buff.attributeOption : undefined,
        });
        applied = true;
        if (stats.log) effectText = describePlayerBuff(buff, rate, duration);
        return;
      }
      if (buff.buffOption === 'ガッツ') {
        appendState(state, 'playerGuts', {
          cardIndex: targetDeckIndex,
          count: normalizePlayerGutsCount(buff),
          turns: duration,
          source: describeMagic(magicId),
        });
        applied = true;
        if (stats.log) effectText = describePlayerBuff(buff, 0, duration);
        return;
      }
      appendState(state, 'playerBuffs', {
        targetDeckIndex,
        buff,
        turns: duration,
      });
      if (isAttackScoreBuff(buff)) appliedForAttackScore = true;
      applied = true;
      if (stats.log) effectText = describePlayerBuff(buff, parsedRateFromBuff(buff), duration);
    });
    if (applied) {
      if (stats.log) pushLog(stats, () => `${turnNumber}T ${timingLabel} 自分効果 ${describeMagic(magicId)} -> ${describePlayerBuffTarget(buff, targets)} / ${effectText}`);
    }
    const examKind = simulationRuntimeCache?.examKind ?? exam.value.kind;
    if (appliedForAttackScore && examKind === 'ATTACK') {
      stats.scoreBuff += 1;
    }
    if (appliedForEvasionScore && examKind === 'DEFENCE') {
      stats.evasion += 1;
    }
    if (appliedForDefenceScore && examKind === 'DEFENCE') {
      stats.debuff += 1;
    }
  });
}

function getPlayerEffectPlans(magicId: string, pairedMagicId: string, parsed: ParsedMagicId) {
  const cacheKey = `${magicId}|${pairedMagicId}`;
  const cache = simulationRuntimeCache?.playerEffectPlans;
  const cached = cache?.get(cacheKey);
  if (cached) return cached;
  const paired = parseMagicId(pairedMagicId);
  const plans = getAutomaticMagicBuffs(parsed.deckIndex, parsed.magicSlot).map((buff) => ({
    buff,
    duration: Math.max(1, Math.floor(safeNumber(buff.durationTurns) || 1)),
    targets: resolvePlayerBuffTargets(buff, parsed.deckIndex, paired?.deckIndex),
  }));
  cache?.set(cacheKey, plans);
  return plans;
}

function isAttackScoreBuff(buff: ParsedBuff) {
  return ['ATKUP', 'ダメージUP', '属性ダメUP', 'クリティカル'].includes(buff.buffOption);
}

function isPlayerDamageTakenDownBuff(buff: ParsedBuff) {
  return buff.buffOption === '被ダメージDOWN' || buff.buffOption === '属性被ダメージDOWN';
}

function isPlayerDamageTakenUpBuff(buff: ParsedBuff) {
  return buff.buffOption === '被ダメージUP' || buff.buffOption === '属性被ダメージUP';
}

function isFreezeBlockedPlayerSideEffect(buff: ParsedBuff) {
  return [
    'ATKUP',
    'ダメージUP',
    '属性ダメUP',
    'クリティカル',
    '回避',
    '被ダメージDOWN',
    '属性被ダメージDOWN',
    '継続回復',
    'ガッツ',
    '暗闇無効',
    '呪い無効',
    '凍結無効',
    'やけど無効',
  ].includes(buff.buffOption);
}

function playerImmunityKindFromBuff(buff: ParsedBuff): PlayerImmunityKind | null {
  if (buff.buffOption === '暗闇無効') return 'blind';
  if (buff.buffOption === '呪い無効') return 'curse';
  if (buff.buffOption === '凍結無効') return 'freeze';
  if (buff.buffOption === 'やけど無効') return 'burn';
  return null;
}

function getAutomaticMagicBuffs(deckIndex: number, magicSlot: MagicSlot): ParsedBuff[] {
  const cacheKey = `${deckIndex}-M${magicSlot}`;
  const cached = simulationRuntimeCache?.automaticMagicBuffs.get(cacheKey);
  if (cached) return cached;
  const slot = deck.value[deckIndex];
  if (!slot?.character) return [];
  const levelOption = safeNumber(slot.magicLevels[magicSlot]) || 10;
  const customEffectText = String(slot.magicEffects[magicSlot] || '').trim();
  const source = customEffectText
    ? { etc: customEffectText.includes(`(M${magicSlot})`) ? customEffectText : `${customEffectText}(M${magicSlot})` }
    : { etc: slot.character.etc || '' };
  const parsed = parseMagicBuffsFromEtc(source, { allowM3: true })
    .filter((buff) => buff.magicOption === `M${magicSlot}`)
    .filter(isPlayerSideParsedTarget)
    .filter((buff) => [
      'ATKUP',
      'ATKDOWN',
      'ダメージUP',
      'ダメージDOWN',
      '属性ダメUP',
      '属性ダメDOWN',
      'クリティカル',
      '回避',
      '被ダメージDOWN',
      '属性被ダメージDOWN',
      '被ダメージUP',
      '属性被ダメージUP',
      'デバフ解除',
      'バフ解除',
      'ガッツ',
      '暗闇無効',
      '呪い無効',
      '凍結無効',
      'やけど無効',
    ].includes(buff.buffOption))
    .map((buff) => ({ ...buff, levelOption }));
  simulationRuntimeCache?.automaticMagicBuffs.set(cacheKey, parsed);
  return parsed;
}

function getAutomaticOpponentDebuffs(deckIndex: number, magicSlot: MagicSlot): ParsedBuff[] {
  const cacheKey = `${deckIndex}-M${magicSlot}`;
  const cached = simulationRuntimeCache?.automaticOpponentDebuffs.get(cacheKey);
  if (cached) return cached;
  const slot = deck.value[deckIndex];
  if (!slot?.character) return [];
  const levelOption = safeNumber(slot.magicLevels[magicSlot]) || 10;
  const customEffectText = String(slot.magicEffects[magicSlot] || '').trim();
  const source = customEffectText
    ? { etc: customEffectText.includes(`(M${magicSlot})`) ? customEffectText : `${customEffectText}(M${magicSlot})` }
    : { etc: slot.character.etc || '' };
  const parsed = parseMagicBuffsFromEtc(source, { allowM3: true })
    .filter((buff) => buff.magicOption === `M${magicSlot}`)
    .filter(isOpponentSideParsedTarget)
    .filter((buff) => [
      'ATKUP',
      'ATKDOWN',
      'ダメージUP',
      'ダメージDOWN',
      '属性ダメUP',
      '属性ダメDOWN',
      '被ダメージUP',
      '属性被ダメージUP',
      '被ダメージDOWN',
      '属性被ダメージDOWN',
      '回避',
      '暗闇',
      '呪い',
      '凍結',
      'デバフ解除',
      'バフ解除',
      'ガッツ',
    ].includes(buff.buffOption))
    .map((buff) => ({ ...buff, levelOption }));
  simulationRuntimeCache?.automaticOpponentDebuffs.set(cacheKey, parsed);
  return parsed;
}

function isPlayerSideParsedTarget(buff: ParsedBuff) {
  const targetType = buff.targetType ?? (buff.isSelf ? 'self' : 'self');
  return targetType === 'self' || targetType === 'allySelected' || targetType === 'allyAll';
}

function isOpponentSideParsedTarget(buff: ParsedBuff) {
  return buff.targetType === 'opponent' || buff.targetType === 'opponentSelected' || buff.targetType === 'opponentAll';
}

function activatePlayerOpponentDebuffs(
  magicId: string,
  targetEnemy: RuntimeEnemyAction | undefined,
  pairedEnemy: RuntimeEnemyAction | undefined,
  state: SimulationState,
  rng: () => number,
  stats: SimulationStats,
  turnNumber: number,
  timingLabel: string,
) {
  const parsed = parseMagicId(magicId);
  if (!parsed) return;
  const effects = getAutomaticOpponentDebuffs(parsed.deckIndex, parsed.magicSlot);
  effects.forEach((buff) => {
    const duration = Math.max(1, Math.floor(safeNumber(buff.durationTurns) || 1));
    const rate = parsedRateFromBuff(buff);
    if (isPlayerFrozen(state, parsed.deckIndex) && isFreezeBlockedPlayerSideEffect(buff)) {
      if (stats.log) pushLog(stats, () => `${turnNumber}T ${timingLabel} 自分効果 ${describeMagic(magicId)} -> ${describePlayerOpponentDebuffTarget(buff, targetEnemy, pairedEnemy)} / ${describePlayerOpponentDebuff(buff, rate, duration)} / 凍結無効化`);
      return;
    }
    if (rate <= 0 && !['デバフ解除', 'バフ解除', 'ガッツ'].includes(buff.buffOption)) return;
    const targetEnemySlotKeys = resolvePlayerOpponentDebuffTargets(buff, targetEnemy, pairedEnemy);
    let appliedForDefenceScore = false;
    let appliedAny = false;
    targetEnemySlotKeys.forEach((targetEnemySlotKey) => {
      if (buff.buffOption === 'ATKDOWN') {
        appendState(state, 'enemyAttackDowns', { rate, turns: duration, targetEnemySlotKey });
        appliedForDefenceScore = true;
        appliedAny = true;
        return;
      }
      if (buff.buffOption === 'ATKUP') {
        appendState(state, 'enemyAttackUps', { rate, turns: duration, targetEnemySlotKey });
        appliedAny = true;
        return;
      }
      if (buff.buffOption === 'ダメージUP' || buff.buffOption === '属性ダメUP') {
        appendState(state, 'enemyDamageUps', {
          rate,
          turns: duration,
          attributeOption: buff.buffOption === '属性ダメUP' ? buff.attributeOption : undefined,
          targetEnemySlotKey,
        });
        appliedAny = true;
        return;
      }
      if (buff.buffOption === 'ダメージDOWN' || buff.buffOption === '属性ダメDOWN') {
        appendState(state, 'enemyDamageDowns', {
          rate,
          turns: duration,
          attributeOption: buff.buffOption === '属性ダメDOWN' ? buff.attributeOption : undefined,
          targetEnemySlotKey,
        });
        appliedForDefenceScore = true;
        appliedAny = true;
        return;
      }
      if (isEnemyDamageTakenUpBuff(buff)) {
        appendState(state, 'enemyDamageTakenUps', {
          rate,
          turns: duration,
          attributeOption: buff.buffOption === '属性被ダメージUP' ? buff.attributeOption : undefined,
          targetEnemySlotKey,
        });
        appliedAny = true;
        return;
      }
      if (isEnemyDamageTakenDownBuff(buff)) {
        appendState(state, 'enemyDamageReductions', {
          rate,
          turns: duration,
          attributeOption: buff.buffOption === '属性被ダメージDOWN' ? buff.attributeOption : undefined,
          targetEnemySlotKey,
        });
        appliedAny = true;
        return;
      }
      if (buff.buffOption === '呪い') {
        const curseRate = rate;
        const roll = rng();
        const success = roll < Math.min(1, Math.max(0, curseRate) / 100);
        if (success) {
          appendState(state, 'enemyCurses', { rate: 100, turns: duration, targetEnemySlotKey });
          if ((simulationRuntimeCache?.examKind ?? exam.value.kind) === 'ATTACK') {
            stats.healBlock = Math.max(stats.healBlock, 1);
          }
          appliedAny = true;
        }
        return;
      }
      if (buff.buffOption === '暗闇') {
        appendState(state, 'enemyBlinds', { rate, turns: duration, targetEnemySlotKey });
        appliedAny = true;
        return;
      }
      if (buff.buffOption === '凍結') {
        const success = rollEffect(rate, rng);
        if (success) {
          appendState(state, 'enemyFreezes', { rate: 100, turns: duration, targetEnemySlotKey });
          appliedAny = true;
        }
        return;
      }
      if (buff.buffOption === '回避') {
        appendState(state, 'enemyEvasions', { rate, turns: duration, targetEnemySlotKey });
        appliedAny = true;
        return;
      }
      if (buff.buffOption === 'ガッツ') {
        appendState(state, 'enemyGuts', { count: normalizePlayerGutsCount(buff), turns: duration, targetEnemySlotKey });
        appliedAny = true;
        return;
      }
      if (buff.buffOption === 'デバフ解除') {
        removeEnemyNegativeEffects(state, targetEnemySlotKeys);
        appliedAny = true;
        return;
      }
      if (buff.buffOption === 'バフ解除') {
        removeEnemyPositiveEffects(state, targetEnemySlotKeys);
        appliedAny = true;
      }
    });
    if (appliedForDefenceScore && (simulationRuntimeCache?.examKind ?? exam.value.kind) === 'DEFENCE') stats.debuff += 1;
    if (appliedAny) {
      if (stats.log) pushLog(stats, () => `${turnNumber}T ${timingLabel} 自分効果 ${describeMagic(magicId)} -> ${describePlayerOpponentDebuffTarget(buff, targetEnemy, pairedEnemy)} / ${describePlayerOpponentDebuff(buff, rate, duration)}`);
    }
  });
}

function resolvePlayerOpponentDebuffTargets(buff: ParsedBuff, targetEnemy: RuntimeEnemyAction | undefined, pairedEnemy: RuntimeEnemyAction | undefined) {
  if (buff.targetType === 'opponentAll') {
    const slotKeys = enemySlots.value.map((slot) => slot.id).filter(Boolean);
    return slotKeys.length ? slotKeys : [undefined];
  }
  if (buff.targetType === 'opponentSelected') {
    const slotKeys = [targetEnemy?.slotKey, pairedEnemy?.slotKey].filter((slotKey): slotKey is string => !!slotKey);
    return slotKeys.length ? Array.from(new Set(slotKeys)) : [undefined];
  }
  return [targetEnemy?.slotKey];
}

function describePlayerOpponentDebuffTarget(buff: ParsedBuff, targetEnemy: RuntimeEnemyAction | undefined, pairedEnemy: RuntimeEnemyAction | undefined) {
  if (buff.targetType === 'opponentAll') return '相手全体';
  if (buff.targetType === 'opponentSelected') {
    return [targetEnemy, pairedEnemy]
      .filter((enemy, index, array) => enemy?.slotKey && array.findIndex((other) => other?.slotKey === enemy.slotKey) === index)
      .map((enemy) => `${describeEnemyTarget(enemy)}:${effectiveEnemyActionElement(enemy)}`)
      .join(' / ') || '相手選択';
  }
  const element = targetEnemy ? effectiveEnemyActionElement(targetEnemy) : undefined;
  return `${describeEnemyTarget(targetEnemy)}${element ? `:${element}` : ''}`;
}

function describePlayerOpponentDebuff(buff: ParsedBuff, rate: number, duration: number) {
  const power = describeParsedBuffPower(buff, rate);
  if (buff.buffOption === '暗闇') return `暗闇${power} ${duration}T`;
  if (buff.buffOption === '呪い') return `呪い${power} ${duration}T`;
  if (buff.buffOption === '凍結') return `凍結${power} ${duration}T`;
  if (buff.buffOption === 'ATKUP') return `ATKUP${power} ${duration}T`;
  if (buff.buffOption === 'ダメージUP') return `ダメージUP${power} ${duration}T`;
  if (buff.buffOption === '属性ダメUP') return `${buff.attributeOption ? `${buff.attributeOption}属性` : ''}ダメージUP${power} ${duration}T`;
  if (buff.buffOption === '回避') return `回避${power} ${duration}T`;
  if (buff.buffOption === 'ガッツ') return `ガッツ ${duration}T`;
  if (buff.buffOption === 'デバフ解除') return `デバフ解除 ${duration}T`;
  if (buff.buffOption === 'バフ解除') return `バフ解除 ${duration}T`;
  if (isEnemyDamageTakenUpBuff(buff)) {
    const attributePrefix = buff.buffOption === '属性被ダメージUP' && buff.attributeOption ? `${buff.attributeOption}属性` : '';
    return `${attributePrefix}被ダメUP${power} ${duration}T`;
  }
  if (isEnemyDamageTakenDownBuff(buff)) {
    const attributePrefix = buff.buffOption === '属性被ダメージDOWN' && buff.attributeOption ? `${buff.attributeOption}属性` : '';
    return `${attributePrefix}被ダメDOWN${power} ${duration}T`;
  }
  const attributePrefix = buff.buffOption === '属性ダメDOWN' && buff.attributeOption ? `${buff.attributeOption}属性` : '';
  const kind = buff.buffOption === 'ATKDOWN' ? 'ATKDOWN' : `${attributePrefix}ダメDOWN`;
  return `${kind}${power} ${duration}T`;
}

function describePlayerBuffTarget(buff: ParsedBuff, targetDeckIndices: number[]) {
  if ((buff.targetType ?? (buff.isSelf ? 'self' : 'self')) === 'self') return '自';
  if (buff.targetType === 'allyAll') return '味方全体';
  if (buff.targetType === 'allySelected') return '味方選択';
  if (targetDeckIndices.length === 1) return describeDeckTarget(targetDeckIndices[0]);
  if (targetDeckIndices.length > 1) return '味方選択';
  return '自';
}

function describeDeckTarget(deckIndex: number) {
  const character = deck.value[deckIndex]?.character;
  return character ? `${character.chara}/${character.costume}` : `枠${deckIndex + 1}`;
}

function describePlayerBuff(buff: ParsedBuff, rate: number, duration: number) {
  const power = describeParsedBuffPower(buff, rate);
  if (buff.buffOption === 'ATKUP') return `ATKUP${power} ${duration}T`;
  if (buff.buffOption === 'ダメージUP') return `ダメージUP${power} ${duration}T`;
  if (buff.buffOption === '属性ダメUP') return `${buff.attributeOption ? `${buff.attributeOption}属性` : ''}ダメージUP${power} ${duration}T`;
  if (buff.buffOption === 'クリティカル') return `クリティカル${power} ${duration}T`;
  if (buff.buffOption === '回避') return `回避${power} ${duration}T`;
  if (buff.buffOption === '被ダメージDOWN') return `被ダメDOWN${power} ${duration}T`;
  if (buff.buffOption === '属性被ダメージDOWN') return `${buff.attributeOption ? `${buff.attributeOption}属性` : ''}被ダメDOWN${power} ${duration}T`;
  if (buff.buffOption === '被ダメージUP') return `被ダメUP${power} ${duration}T`;
  if (buff.buffOption === '属性被ダメージUP') return `${buff.attributeOption ? `${buff.attributeOption}属性` : ''}被ダメUP${power} ${duration}T`;
  if (buff.buffOption === 'デバフ解除') return `デバフ解除 ${duration}T`;
  if (buff.buffOption === 'バフ解除') return `バフ解除 ${duration}T`;
  if (buff.buffOption === 'ATKDOWN') return `ATKDOWN${power} ${duration}T`;
  if (buff.buffOption === 'ダメージDOWN') return `ダメージDOWN${power} ${duration}T`;
  if (buff.buffOption === '属性ダメDOWN') return `${buff.attributeOption ? `${buff.attributeOption}属性` : ''}ダメージDOWN${power} ${duration}T`;
  if (buff.buffOption === 'ガッツ') return `ガッツ ${duration}T`;
  if (buff.buffOption === '暗闇無効') return `暗闇無効 ${duration}T`;
  if (buff.buffOption === '呪い無効') return `呪い無効 ${duration}T`;
  if (buff.buffOption === '凍結無効') return `凍結無効 ${duration}T`;
  if (buff.buffOption === 'やけど無効') return `やけど無効 ${duration}T`;
  return `${buff.buffOption} ${duration}T`;
}

function describeParsedBuffPower(buff: ParsedBuff, rate: number) {
  const rawPower = `${buff.powerOption || ''}`.trim();
  if (rawPower && rawPower !== '0') {
    return `(${normalizeDisplayPower(buff.buffOption, rawPower)})`;
  }
  const fallback = powerLabelFromRateForBuff(buff, rate);
  return fallback ? `(${fallback})` : '';
}

function normalizeDisplayPower(buffOption: string, power: string) {
  if (buffOption === 'クリティカル') {
    if (power === '1/1') return '極大';
    if (power === '1/2') return '大';
    if (power === '1/3') return '中';
  }
  return power;
}

function powerLabelFromRateForBuff(buff: ParsedBuff, rate: number) {
  if (buff.buffOption === 'ATKUP' || buff.buffOption === 'ATKDOWN') return closestPowerLabel(rate, atkRatePowerScale);
  if (buff.buffOption === '回避') return closestPowerLabel(rate, evasionRatePowerScale);
  if (buff.buffOption === '暗闇') return closestPowerLabel(rate, blindRatePowerScale);
  if (buff.buffOption === '呪い') return closestPowerLabel(rate, curseRatePowerScale);
  if (buff.buffOption === '凍結') return closestPowerLabel(rate, freezeRatePowerScale);
  if (buff.buffOption.includes('属性ダメ') || buff.buffOption.includes('属性被ダメ')) return closestPowerLabel(rate, attributeDamageRatePowerScale);
  if (buff.buffOption.includes('ダメージ') || buff.buffOption.includes('被ダメ')) return closestPowerLabel(rate, damageRatePowerScale);
  if (buff.buffOption === 'クリティカル') return closestPowerLabel(rate, criticalRatePowerScale);
  return '';
}

function resolvePlayerBuffTargets(buff: ParsedBuff, sourceDeckIndex: number, pairedDeckIndex: number | undefined) {
  const targetType = buff.targetType ?? (buff.isSelf ? 'self' : 'self');
  if (targetType === 'allyAll') {
    return deck.value.map((_, index) => index).filter((index) => !!deck.value[index]?.character);
  }
  if (targetType === 'allySelected') {
    return [...new Set([sourceDeckIndex, pairedDeckIndex])]
      .filter((index): index is number => index !== undefined && !!deck.value[index]?.character);
  }
  if (targetType === 'opponent' || targetType === 'opponentSelected' || targetType === 'opponentAll') return [];
  return [sourceDeckIndex];
}

function criticalChanceFromPower(powerType: string) {
  const normalizedPower = normalizeDisplayPower('クリティカル', powerType);
  if (normalizedPower in criticalRatePowerScale) return safeNumber(criticalRatePowerScale[normalizedPower]) / 100;
  if (powerType === '1/1') return 1;
  if (powerType === '1/2') return 0.5;
  if (powerType === '1/3') return 1 / 3;
  if (powerType === '2/3') return 2 / 3;
  const expectedMultiplier = safeNumber(criticalDict[`クリティカル(${powerType})`]);
  if (expectedMultiplier <= 1) return 0;
  return clamp((expectedMultiplier - 1) / (CRITICAL_DAMAGE_MULTIPLIER - 1), 0, 1);
}

function getRuntimeBuddyGeneratedBuffs(runtime: any) {
  return [1, 2, 3].flatMap((buddyIndex) => {
    const buddyName = runtime?.[`buddy${buddyIndex}c`];
    const isActive = !!(buddyName && charaDict.value && buddyName in charaDict.value);
    const generatedBuffs = createBuddyGeneratedBuffs(runtime, buddyIndex, {
      totsu: runtime?.totsu ?? (runtime?.isBonusSelected ? 4 : 0),
      isActive,
      criticalPowerMode: 'probability',
    });
    return applyBuddyGeneratedBuffOverrides(generatedBuffs, runtime?.buddyGeneratedBuffOverrides);
  });
}

function calculateRuntimeBuddyAtk(runtime: any) {
  const deckIndex = runtime?._examDeckIndex;
  const canUseCache = simulationRuntimeCache
    && typeof deckIndex === 'number'
    && Number.isInteger(deckIndex);
  const cached = canUseCache ? simulationRuntimeCache?.buddyAtk.get(deckIndex) : undefined;
  if (cached !== undefined) return cached;
  const totsu = runtime?.totsu ?? (runtime?.isBonusSelected ? 4 : 0);
  const total = [1, 2, 3].reduce((sum, buddyIndex) => {
    const buddyName = runtime?.[`buddy${buddyIndex}c`];
    if (!buddyName || !(buddyName in charaDict.value)) return sum;
    const status = getBuddyStatusForCharacter(runtime, buddyIndex, { totsu, isActive: true });
    return sum + safeNumber(runtime.atk) * getBuddyAtkRate(status, safeNumber(runtime[`buddy${buddyIndex}Lv`]) || 10);
  }, 0);
  if (canUseCache) simulationRuntimeCache?.buddyAtk.set(deckIndex, total);
  return total;
}

function calculatePlayerDamageBaseFromState(
  state: SimulationState,
  magicId: string,
  deckIndex: number,
  magicSlot: MagicSlot,
  targetElement: ActionElement,
  reductionRate: number,
  duoActive: boolean,
) {
  const magicMeta = getPlayerMagicRuntimeMeta(magicId, deckIndex, magicSlot, duoActive);
  if (!magicMeta) return null;
  const {
    runtimeAtk,
    buddyAtk,
    magicAttribute,
    adjustedPower,
    level,
    magicRatio,
    attributeAdjust,
    rengekiMultiplier,
  } = magicMeta;
  const currentMagicOption = `M${magicSlot}`;
  let atkBuffTotal = 0;
  let dmgBuffTotal = 0;
  let criticalChance = 0;

  for (const entry of state.playerBuffs) {
    if (entry.targetDeckIndex !== deckIndex || entry.turns <= 0) continue;
    const buff = entry.buff;
    if (buff?.isBuddyGenerated && buff.magicOption !== currentMagicOption) continue;
    const buffType = buff?.buffOption;
    const powerType = buff?.powerOption;
    const buffLevel = Math.min(10, Math.max(1, Math.floor(safeNumber(buff?.levelOption) || 10)));
    if (buffType === 'ATKUP' || buffType === 'ATKDOWN') {
      atkBuffTotal += safeNumber(atkbuffDict[`${buffType}(${powerType})${buffLevel}`]) * runtimeAtk;
      continue;
    }
    if (buffType === 'ダメージUP' || buffType === '属性ダメUP' || buffType === 'ダメージDOWN' || buffType === '属性ダメDOWN') {
      if ((buffType === '属性ダメUP' || buffType === '属性ダメDOWN') && buff.attributeOption && buff.attributeOption !== magicAttribute) continue;
      const prefix = buffType === 'ダメージUP'
        ? 'ダメUP'
        : buffType === 'ダメージDOWN'
          ? 'ダメDOWN'
          : buffType === '属性ダメUP'
            ? '属性ダメUP'
            : '属性ダメDOWN';
      dmgBuffTotal += safeNumber(dmgbuffDict[`${prefix}(${powerType})${buffLevel}`]);
      continue;
    }
    if (buffType === 'クリティカル') criticalChance = Math.max(criticalChance, criticalChanceFromPower(powerType));
  }

  const baseAtk = runtimeAtk + atkBuffTotal + buddyAtk;
  const damageTerm = Math.max(0, magicRatio * attributeAdjust + dmgBuffTotal);
  const reductionValue = reductionRate / 100;
  const damageTermAfterReduction = Math.max(0, damageTerm - reductionValue);
  const attributeMultiplier = playerAttributeMultiplier(magicAttribute, targetElement);
  return {
    magicAttribute,
    adjustedPower,
    level,
    magicRatio,
    attributeAdjust,
    buddyAtk,
    baseAtk,
    atkBuffTotal,
    dmgBuffTotal,
    criticalChance,
    damageTerm,
    rengekiMultiplier,
    reductionValue,
    damageTermAfterReduction,
    beforeReductionDamage: baseAtk * damageTerm * rengekiMultiplier * attributeMultiplier,
    damage: baseAtk * damageTermAfterReduction * rengekiMultiplier * attributeMultiplier,
  };
}

function getPlayerMagicRuntimeMeta(magicId: string, deckIndex: number, magicSlot: MagicSlot, duoActive: boolean) {
  const cacheKey = `${magicId}:${duoActive && magicSlot === 2 ? 'duo' : 'normal'}`;
  const cache = simulationRuntimeCache?.playerMagicMeta;
  const cached = cache?.get(cacheKey);
  if (cached) return cached;
  const runtime = buildRuntimeCharacter(deckIndex);
  if (!runtime) return null;
  const magicKey = `magic${magicSlot}`;
  const magicAttribute = normalizeElement(runtime[`${magicKey}Attribute`]);
  const configuredPower = runtime[`${magicKey}Power`] || '単発(弱)';
  const power = duoActive && magicSlot === 2 ? 'デュオ' : configuredPower;
  const adjustedPower = power === 'デュオ' ? 'デュオ魔法' : power;
  const level = Math.min(10, Math.max(1, Math.floor(safeNumber(runtime[`${magicKey}Lv`]) || 1)));
  const meta = {
    runtimeAtk: safeNumber(runtime.atk),
    buddyAtk: calculateRuntimeBuddyAtk(runtime),
    magicAttribute,
    adjustedPower,
    level,
    magicRatio: safeNumber(magicDict[`${adjustedPower}Lv${level}`]) || 1,
    attributeAdjust: magicAttribute === '無' ? 1.1 : 1,
    rengekiMultiplier: playerRengekiMultiplier(adjustedPower),
  };
  cache?.set(cacheKey, meta);
  return meta;
}

function playerRengekiMultiplier(power: string) {
  if (power === '連撃(弱)' || power === '連撃(強)') return 1.8;
  if (power === 'デュオ魔法' || power === '3連撃(弱)' || power === '3連撃(強)') return 2.4;
  return 1;
}

function playerAttributeMultiplier(magicAttribute: ActionElement, targetElement: ActionElement) {
  if (magicAttribute === '無') return 1;
  const compatibility = getCompatibility(magicAttribute, targetElement);
  if (compatibility === 'advantage') return 1.5;
  if (compatibility === 'disadvantage') return 0.5;
  return 1;
}

function activatePlayerContinueHeal(magicId: string, pairedMagicId: string, state: SimulationState, stats: SimulationStats) {
  const parsed = parseMagicId(magicId);
  if (!parsed) return;
  const plans = getContinueHealPlans(magicId, pairedMagicId, parsed);
  if (!plans.length) return;
  if (isPlayerFrozen(state, parsed.deckIndex)) {
    if (stats.log) pushLog(stats, () => `${describeMagic(magicId)} 継続回復凍結`);
    return;
  }
  plans.forEach(({ rate, duration, targets }) => {
    targets.forEach((cardIndex) => {
      appendState(state, 'playerContinueHeals', {
        cardIndex,
        rate,
        turns: duration,
        source: describeMagic(magicId),
      });
    });
  });
}

function getContinueHealPlans(magicId: string, pairedMagicId: string, parsed: ParsedMagicId) {
  const cacheKey = `${magicId}|${pairedMagicId}`;
  const cache = simulationRuntimeCache?.continueHealPlans;
  const cached = cache?.get(cacheKey);
  if (cached) return cached;
  const runtime = buildRuntimeCharacter(parsed.deckIndex);
  if (!runtime) return [];
  const paired = parseMagicId(pairedMagicId);
  const plans = buildRuntimeBuffs(runtime)
    .filter((buff) => buff.magicOption === `M${parsed.magicSlot}` && buff.buffOption === '継続回復')
    .map((buff) => {
      const level = Math.min(10, Math.max(1, Math.floor(safeNumber(buff.levelOption) || 10)));
      return {
        rate: safeNumber(healContinueDict[`継続回復(${buff.powerOption})${level}`]),
        duration: Math.max(1, Math.floor(safeNumber(buff.durationTurns) || 3)),
        targets: resolvePlayerBuffTargets(buff, parsed.deckIndex, paired?.deckIndex),
      };
    })
    .filter((plan) => plan.rate > 0);
  cache?.set(cacheKey, plans);
  return plans;
}

function calculatePlayerDamage(
  magicId: string,
  targetElement: ActionElement,
  state: SimulationState,
  rng: () => number,
  stats: SimulationStats,
  duoActive = false,
  targetEnemy?: RuntimeEnemyAction,
) {
  const parsed = parseMagicId(magicId);
  const magic = magicById(magicId);
  if (!parsed || !magic) {
    return { damage: 0, compatibility: 'equal' as ScoreCompatibility, hitCount: 1, isDuo: false, evasionCount: 0, blindMiss: false, criticalCount: 0 };
  }
  if (!buildRuntimeCharacter(parsed.deckIndex)) {
    return { damage: 0, compatibility: 'equal' as ScoreCompatibility, hitCount: 1, isDuo: false, evasionCount: 0, blindMiss: false, criticalCount: 0 };
  }
  const compatibility = getCompatibility(magic.element, targetElement);
  const power = duoActive && parsed.magicSlot === 2 ? 'デュオ' : magic.power;
  const hitCount = magicHitCount(power);
  const isDuo = parsed.magicSlot === 2 && duoActive;
  const targetEnemySlotKey = targetEnemy?.slotKey ?? '';
  const blindRate = isPlayerImmune(state, parsed.deckIndex, 'blind')
    ? 0
    : Math.min(1, sumRatesForCard(state.playerBlinds, parsed.deckIndex) / 100);
  const enemyReductionRate = sumDamageRatesForElementAndEnemy(state.enemyDamageReductions, magic.element, targetEnemySlotKey);
  const enemyDamageNullActive = hasEnemyDamageNull(state, magic.element, targetEnemySlotKey);
  const enemyDamageTakenUpRate = sumDamageRatesForElementAndEnemy(state.enemyDamageTakenUps, magic.element, targetEnemySlotKey);
  const enemyEvasionRate = Math.min(1, sumRatesForEnemy(state.enemyEvasions, targetEnemySlotKey) / 100);
  const reductionRate = Math.min(100, sumDamageDownRatesForCard(state.playerDamageDowns, parsed.deckIndex, magic.element) + enemyReductionRate - enemyDamageTakenUpRate);
  const damageBase = calculatePlayerDamageBaseFromState(
    state,
    magicId,
    parsed.deckIndex,
    parsed.magicSlot,
    targetElement,
    reductionRate,
    duoActive,
  );
  if (!damageBase) {
    return { damage: 0, compatibility: 'equal' as ScoreCompatibility, hitCount: 1, isDuo: false, evasionCount: 0, blindMiss: false, criticalCount: 0 };
  }
  const attackDownRate = Math.min(100, sumDamageDownRatesForCard(state.playerAttackDowns, parsed.deckIndex, magic.element));
  const baseDamage = enemyDamageNullActive ? 0 : damageBase.damage * Math.max(0, 1 - attackDownRate / 100);
  if (enemyDamageNullActive) {
    return { damage: 0, compatibility, hitCount, isDuo, evasionCount: 0, blindMiss: false, criticalCount: 0, damageNull: true };
  }
  if (blindRate > 0) {
    const blindRoll = rng();
    if (blindRoll < blindRate) {
      if (stats.log) stats.miss += 1;
      return { damage: 0, compatibility, hitCount, isDuo, evasionCount: 0, blindMiss: true, criticalCount: 0, damageNull: false };
    }
  }

  const evasionRate = enemyEvasionRate;
  let evasionCount = 0;
  let criticalCount = 0;
  let damage = 0;
  for (let hit = 0; hit < hitCount; hit += 1) {
    if (evasionRate > 0) {
      const evasionRoll = rng();
      const evaded = evasionRoll < evasionRate;
      if (evaded) {
        evasionCount += 1;
        continue;
      }
    }
    const criticalActive = damageBase.criticalChance > 0 && rollEffect(damageBase.criticalChance * 100, rng);
    const criticalMultiplier = criticalActive ? CRITICAL_DAMAGE_MULTIPLIER : 1;
    const randomFactor = nextDamageFactor(rng);
    const raw = (baseDamage * criticalMultiplier / hitCount) * randomFactor;
    const hitDamage = ceilDamage(raw);
    if (criticalActive && hitDamage > 0) criticalCount += 1;
    damage += hitDamage;
  }
  const cachedResult = simulationRuntimeCache?.playerDamageResult;
  if (cachedResult) {
    cachedResult.damage = damage;
    cachedResult.compatibility = compatibility;
    cachedResult.hitCount = hitCount;
    cachedResult.isDuo = isDuo;
    cachedResult.evasionCount = evasionCount;
    cachedResult.blindMiss = false;
    cachedResult.criticalCount = criticalCount;
    cachedResult.damageNull = false;
    return cachedResult;
  }
  return { damage, compatibility, hitCount, isDuo, evasionCount, blindMiss: false, criticalCount, damageNull: false };
}

function describePlayerAttackSpecials(attack: { evasionCount?: number; blindMiss?: boolean; criticalCount?: number; damageNull?: boolean }) {
  const parts: string[] = [];
  if (attack.blindMiss) parts.push('暗闇MISS1回');
  if (safeNumber(attack.evasionCount) > 0) parts.push(`回避成功${safeNumber(attack.evasionCount)}回`);
  if (safeNumber(attack.criticalCount) > 0) parts.push(`クリティカル発動${safeNumber(attack.criticalCount)}回`);
  if (attack.damageNull) parts.push('ダメージ無効');
  return parts.length ? ` / ${parts.join(' / ')}` : '';
}

function calculatePlayerHeal(magicId: string, state: SimulationState) {
  const amountCache = simulationRuntimeCache?.playerHealAmounts;
  let amount = amountCache?.get(magicId);
  const parsed = parseMagicId(magicId);
  if (!parsed) {
    return 0;
  }
  if (amount === undefined) {
    const runtime = buildRuntimeCharacter(parsed.deckIndex);
    if (!runtime) {
      return 0;
    }
    let heal = 0;
    for (const buff of buildRuntimeBuffs(runtime)) {
      if (buff.magicOption !== `M${parsed.magicSlot}` || buff.buffOption !== '回復') continue;
      const level = Math.min(10, Math.max(1, Math.floor(safeNumber(buff.levelOption) || 10)));
      heal += safeNumber(healDict[`回復(${buff.powerOption})${level}`]) * safeNumber(runtime.atk);
    }
    amount = ceilDamage(heal);
    amountCache?.set(magicId, amount);
  }
  if (amount > 0 && isPlayerCursed(state, parsed.deckIndex)) {
    return 0;
  }
  return amount;
}

function applyPlayerContinueHeal(state: SimulationState, currentHp: number, keepDetails = true): ContinueHealResult {
  if (!state.playerContinueHeals.length) {
    return { total: 0, details: [] };
  }
  let remainingRecoverableHp = Math.max(0, totalDeckHp.value - currentHp);
  let total = 0;
  const details: ContinueHealDetail[] = [];
  for (const entry of state.playerContinueHeals) {
    if (entry.turns <= 0) continue;
    const baseCardHp = deckCardHp(entry.cardIndex);
    const rawHeal = baseCardHp * entry.rate;
    const potentialAmount = ceilDamage(rawHeal);
    if (isPlayerCursed(state, entry.cardIndex)) {
      continue;
    }
    const amount = Math.min(potentialAmount, remainingRecoverableHp);
    if (keepDetails && potentialAmount > 0) {
      details.push({
        cardIndex: entry.cardIndex,
        source: entry.source || describeDeckCard(entry.cardIndex),
        amount,
        potentialAmount,
        capped: amount < potentialAmount,
      });
    }
    total += amount;
    remainingRecoverableHp = Math.max(0, remainingRecoverableHp - amount);
  }
  if (total <= 0) {
    return { total: 0, details };
  }
  return { total, details };
}

function applyEnemyContinueHeal(state: SimulationState, enemyHp: number, enemyMaxHp: number) {
  if (enemyHp <= 0 || enemyHp >= enemyMaxHp) return 0;
  let total = 0;
  for (const entry of state.enemyContinueHeals) {
    if (entry.turns <= 0) continue;
    if (entry.targetEnemySlotKey && isEnemyCursed(state, entry.targetEnemySlotKey)) continue;
    total += ceilDamage(entry.amount);
  }
  return Math.min(total, enemyMaxHp - enemyHp);
}

function calculateEnemyDamage(
  enemyAction: RuntimeEnemyAction | undefined,
  magicId: string,
  state: SimulationState,
  rng: () => number,
  stats: SimulationStats,
) {
  if (!enemyAction) {
    return {
      damage: 0,
      defenceCompatibility: 'equal' as ScoreCompatibility,
      defenderElement: '無' as ActionElement,
      baseAtk: 0,
      equalDamage: 0,
      atkRate: 0,
      damageRate: 0,
      hitDamages: [] as number[],
      evasionCount: 0,
      blindMiss: false,
      criticalCount: 0,
    };
  }
  const parsed = parseMagicId(magicId);
  const defenderElement = magicById(magicId)?.element ?? '無';
  const attackElement = effectiveEnemyActionElement(enemyAction);
  const defenceCompatibility = getCompatibility(defenderElement, attackElement);
  const elementMultiplier = defenceCompatibility === 'advantage' ? 0.5 : defenceCompatibility === 'disadvantage' ? 1.5 : 1;
  const actionMeta = getEnemyActionRuntimeMeta(enemyAction);
  const baseAtk = actionMeta.baseAtk;
  const atkRate = sumRatesForEnemy(state.enemyAttackUps, enemyAction.slotKey)
    - sumRatesForEnemy(state.enemyAttackDowns, enemyAction.slotKey);
  const damageTakenDownRate = parsed ? sumDamageTakenDownRatesForCard(state.playerDamageTakenDowns, parsed.deckIndex, attackElement) : 0;
  const damageTakenUpRate = parsed ? sumDamageTakenDownRatesForCard(state.playerDamageTakenUps, parsed.deckIndex, attackElement) : 0;
  const damageRate = sumDamageRatesForElementAndEnemy(state.enemyDamageUps, attackElement, enemyAction.slotKey)
    - sumDamageRatesForElementAndEnemy(state.enemyDamageDowns, attackElement, enemyAction.slotKey)
    - damageTakenDownRate
    + damageTakenUpRate;
  const equalDamage = Math.max(0, baseAtk)
    * Math.max(0, 1 + atkRate / 100)
    * Math.max(0, actionMeta.magicRatio + damageRate / 100)
    * actionMeta.rengekiMultiplier;
  const hitCount = actionMeta.hitCount;
  const evasionRate = parsed ? Math.min(1, sumRatesForCard(state.playerEvasions, parsed.deckIndex) / 100) : 0;
  const blindRate = Math.min(1, sumRatesForEnemy(state.enemyBlinds, enemyAction.slotKey) / 100);
  const criticalRate = Math.min(1, sumRatesForEnemy(state.enemyCriticals, enemyAction.slotKey) / 100);
  let evasionCount = 0;
  let criticalCount = 0;
  let damage = 0;
  const hitDamages: number[] | null = stats.log ? [] : null;
  if (blindRate > 0) {
    const blindRoll = rng();
    if (blindRoll < blindRate) {
      if (stats.log) stats.miss += 1;
      return {
        damage: 0,
        defenceCompatibility,
        defenderElement,
        baseAtk,
        equalDamage,
        atkRate,
        damageRate,
        hitDamages: stats.log ? Array.from({ length: hitCount }, () => 0) : [],
        evasionCount: 0,
        blindMiss: true,
        criticalCount: 0,
      };
    }
  }
  for (let hit = 0; hit < hitCount; hit += 1) {
    if (evasionRate > 0) {
      const evasionRoll = rng();
      const evaded = evasionRoll < evasionRate;
      if (evaded) {
        evasionCount += 1;
        hitDamages?.push(0);
        continue;
      }
    }
    const randomFactor = nextDamageFactor(rng);
    const criticalActive = criticalRate > 0 && rollEffect(criticalRate * 100, rng);
    const criticalMultiplier = criticalActive ? CRITICAL_DAMAGE_MULTIPLIER : 1;
    const raw = (equalDamage * elementMultiplier * criticalMultiplier / hitCount) * randomFactor;
    const hitDamage = ceilDamage(raw);
    if (criticalActive && hitDamage > 0) criticalCount += 1;
    hitDamages?.push(hitDamage);
    damage += hitDamage;
  }
  const cachedResult = simulationRuntimeCache?.enemyDamageResult;
  if (cachedResult) {
    cachedResult.damage = damage;
    cachedResult.defenceCompatibility = defenceCompatibility;
    cachedResult.defenderElement = defenderElement;
    cachedResult.baseAtk = baseAtk;
    cachedResult.equalDamage = equalDamage;
    cachedResult.atkRate = atkRate;
    cachedResult.damageRate = damageRate;
    cachedResult.hitDamages = hitDamages ?? simulationRuntimeCache!.emptyHitDamages;
    cachedResult.evasionCount = evasionCount;
    cachedResult.blindMiss = false;
    cachedResult.criticalCount = criticalCount;
    return cachedResult;
  }
  return { damage, defenceCompatibility, defenderElement, baseAtk, equalDamage, atkRate, damageRate, hitDamages: hitDamages ?? [], evasionCount, blindMiss: false, criticalCount };
}

function applyEnemySelfEffects(
  action: RuntimeEnemyAction | undefined,
  state: SimulationState,
  enemyHp: number,
  enemyMaxHp: number,
  stats: SimulationStats,
  pairedEnemy?: RuntimeEnemyAction,
) {
  if (!action) return 0;
  const duration = normalizeEffectDuration(action);
  const value = safeNumber(action.effectValue);
  if (!isEnemySideTarget(action.effectTarget)) {
    return 0;
  }
  const targetSlotKeys = resolveEnemySideTargetSlotKeys(action, pairedEnemy);
  switch (action.effectKind) {
    case 'atkUp':
      targetSlotKeys.forEach((targetEnemySlotKey) => {
        appendState(state, 'enemyAttackUps', { rate: value || 20, turns: duration, targetEnemySlotKey });
      });
      break;
    case 'damageUp':
      targetSlotKeys.forEach((targetEnemySlotKey) => {
        appendState(state, 'enemyDamageUps', { rate: value || 5, turns: duration, targetEnemySlotKey });
      });
      break;
    case 'heal': {
      const healAmount = value;
      const cursedTargets = targetSlotKeys.filter((targetEnemySlotKey) => isEnemyCursed(state, targetEnemySlotKey));
      if (cursedTargets.length) {
        return 0;
      }
      if (healAmount <= 0 || enemyHp >= enemyMaxHp) {
        return 0;
      }
      const capped = Math.min(ceilDamage(healAmount), enemyMaxHp - enemyHp);
      return capped;
    }
    case 'continueHeal': {
      const healAmount = ceilDamage(value);
      if (healAmount <= 0) {
        return 0;
      }
      targetSlotKeys.forEach((targetEnemySlotKey) => {
        if (isEnemyCursed(state, targetEnemySlotKey)) return;
        appendState(state, 'enemyContinueHeals', {
          amount: healAmount,
          turns: duration,
          source: action.name,
          targetEnemySlotKey,
        });
      });
      break;
    }
    case 'guts':
      targetSlotKeys.forEach((targetEnemySlotKey) => {
        appendState(state, 'enemyGuts', { count: normalizeGutsCount(action), turns: duration, targetEnemySlotKey });
      });
      break;
    default:
      break;
  }
  return 0;
}

function resolveEnemySideTargetSlotKeys(action: RuntimeEnemyAction, pairedEnemy?: RuntimeEnemyAction) {
  if (action.effectTarget === '味方全体') {
    const slotKeys = enemySlots.value.map((slot) => slot.id).filter(Boolean);
    return slotKeys.length ? slotKeys : [undefined];
  }
  if (action.effectTarget === '味方選択') {
    const slotKeys = [action.slotKey, pairedEnemy?.slotKey].filter((slotKey): slotKey is string => !!slotKey);
    return slotKeys.length ? Array.from(new Set(slotKeys)) : [undefined];
  }
  if (isEnemySideTarget(action.effectTarget)) return action.slotKey ? [action.slotKey] : [undefined];
  return [];
}

function applyEnemyAdditionalEffects(
  action: RuntimeEnemyAction | undefined,
  magicId: string,
  pairedMagicId: string,
  state: SimulationState,
  rng: () => number,
  stats: SimulationStats,
  pairedEnemy?: RuntimeEnemyAction,
) {
  if (!action) return;
  const parsed = parseMagicId(magicId);
  if (!parsed) return;
  const duration = normalizeEffectDuration(action);
  const value = safeNumber(action.effectValue);
  const cardIndex = parsed.deckIndex;
  const paired = parseMagicId(pairedMagicId);
  const targetCards = resolveEnemyPlayerTargets(action.effectTarget, cardIndex, paired?.deckIndex);
  const targetSlotKeys = resolveEnemySideTargetSlotKeys(action, pairedEnemy);
  switch (action.effectKind) {
    case 'atkDown':
      targetCards.forEach((targetCardIndex) => {
        appendState(state, 'playerAttackDowns', { cardIndex: targetCardIndex, rate: value || 20, turns: duration, attributeOption: action.effectAttribute });
      });
      break;
    case 'damageDown':
      targetCards.forEach((targetCardIndex) => {
        appendState(state, 'playerDamageDowns', { cardIndex: targetCardIndex, rate: value || 5, turns: duration, attributeOption: action.effectAttribute });
      });
      break;
    case 'damageTakenDown':
      if (isEnemySideTarget(action.effectTarget)) {
        targetSlotKeys.forEach((targetEnemySlotKey) => {
          appendState(state, 'enemyDamageReductions', { rate: value || 22.5, turns: duration, targetEnemySlotKey });
        });
      }
      break;
    case 'blind':
      targetCards.forEach((targetCardIndex) => {
        if (isPlayerImmune(state, targetCardIndex, 'blind')) {
          return;
        }
        appendState(state, 'playerBlinds', { cardIndex: targetCardIndex, rate: value || 21.6, turns: duration });
      });
      break;
    case 'evasion':
      if (isEnemySideTarget(action.effectTarget)) {
        targetSlotKeys.forEach((targetEnemySlotKey) => {
          appendState(state, 'enemyEvasions', { rate: value || 14.8, turns: duration, targetEnemySlotKey });
        });
      }
      break;
    case 'burn':
      targetCards.forEach((targetCardIndex) => {
        if (isPlayerImmune(state, targetCardIndex, 'burn')) {
          return;
        }
        appendState(state, 'burns', { cardIndex: targetCardIndex, rate: value || 16, turns: duration });
      });
      break;
    case 'debuffRemoval':
      if (targetCards.length) {
        const targetSet = new Set(targetCards);
        removePlayerNegativeEffects(state, Array.from(targetSet));
      } else if (action.effectTarget === '味方全体') {
        state.enemyAttackDowns = [];
        state.enemyDamageDowns = [];
        state.enemyDamageTakenUps = [];
        state.enemyCurses = [];
        state.enemyBlinds = [];
        state.enemyFreezes = [];
      } else if (isEnemySideTarget(action.effectTarget)) {
        removeEnemyNegativeEffects(state, targetSlotKeys);
      }
      break;
    case 'buffRemoval':
      if (targetCards.length) {
        removePlayerPositiveEffects(state, targetCards);
      } else if (isEnemySideTarget(action.effectTarget)) {
        removeEnemyPositiveEffects(state, action.effectTarget === '味方全体' ? undefined : targetSlotKeys);
      }
      break;
    case 'curse':
      targetCards.forEach((targetCardIndex) => {
        if (isPlayerImmune(state, targetCardIndex, 'curse')) {
          return;
        }
        appendState(state, 'playerCurses', { cardIndex: targetCardIndex, rate: 100, turns: duration });
      });
      break;
    case 'freeze':
      targetCards.forEach((targetCardIndex) => {
        if (isPlayerImmune(state, targetCardIndex, 'freeze')) {
          return;
        }
        const rate = value || 100;
        const roll = rng();
        const success = roll < Math.min(1, Math.max(0, rate) / 100);
        if (success) {
          appendState(state, 'playerFreezes', { cardIndex: targetCardIndex, rate: 100, turns: duration });
        }
      });
      break;
    case 'damageUp':
    case 'heal':
    case 'guts':
    case 'none':
    default:
      break;
  }
}

function normalizeEnemyMagicPower(power?: string, hitCount?: number, label?: string): EnemyMagicPower {
  if (enemyMagicPowerOptions.includes(power as EnemyMagicPower)) return power as EnemyMagicPower;
  if (power === '連撃(弱)') return '2連撃(弱)';
  if (power === '連撃(強)') return '2連撃(強)';
  const text = `${power ?? ''} ${label ?? ''}`;
  const strength = text.includes('弱') ? '弱' : '強';
  const normalizedHitCount = Math.max(1, Math.min(3, Math.floor(safeNumber(hitCount) || 1)));
  if (text.includes('3') || normalizedHitCount === 3) return `3連撃(${strength})` as EnemyMagicPower;
  if (text.includes('2') || text.includes('連') || normalizedHitCount === 2) return `2連撃(${strength})` as EnemyMagicPower;
  return `単発(${strength})` as EnemyMagicPower;
}

function enemyPowerHitCount(power: EnemyMagicPower) {
  if (power.startsWith('3')) return 3;
  if (power.startsWith('2')) return 2;
  return 1;
}

function enemyRengekiMultiplier(power: EnemyMagicPower) {
  if (power.startsWith('3')) return 2.4;
  if (power.startsWith('2')) return 1.8;
  return 1;
}

function enemyMagicRatio(action: EnemyActionDefinition) {
  const magicPower = action.power.replace('2連撃', '連撃');
  const ratio = safeNumber(magicDict[`${magicPower}Lv10`]) || 1;
  return ratio * (effectiveEnemyActionElement(action) === '無' ? 1.1 : 1);
}

function observedEnemyAtkBuffRate(action: EnemyActionDefinition) {
  return action.effectKind === 'atkUp' && isEnemySideTarget(action.effectTarget) ? (safeNumber(action.effectValue) || 20) : 0;
}

function observedEnemyDamageBuffRate(action: EnemyActionDefinition) {
  return action.effectKind === 'damageUp' && isEnemySideTarget(action.effectTarget) ? (safeNumber(action.effectValue) || 5) : 0;
}

function defaultEnemyEffectTarget(effectKind: EffectKind): EffectTarget {
  if (['atkDown', 'damageDown', 'burn', 'blind', 'curse', 'freeze', 'buffRemoval'].includes(effectKind)) return '相手';
  return '自';
}

function isEnemyFreezeBlockedEffectKind(effectKind: EffectKind) {
  return ['atkUp', 'damageUp', 'damageTakenDown', 'evasion', 'guts', 'continueHeal'].includes(effectKind);
}

function getEnemyActionRuntimeMeta(action: RuntimeEnemyAction) {
  const cache = simulationRuntimeCache?.enemyActionMeta;
  const cached = cache?.get(action.identity);
  if (cached) return cached;
  const meta = {
    baseAtk: deriveEnemyBaseAtk(action),
    magicRatio: enemyMagicRatio(action),
    rengekiMultiplier: enemyRengekiMultiplier(action.power),
    hitCount: enemyPowerHitCount(action.power),
  };
  cache?.set(action.identity, meta);
  return meta;
}

function isEnemySideTarget(target: EffectTarget) {
  return target === '自' || target === '味方選択' || target === '味方全体';
}

function resolveEnemyPlayerTargets(target: EffectTarget, defendingCardIndex: number, pairedDefendingCardIndex?: number) {
  if (target === '相手全体') {
    return deck.value.map((_, index) => index).filter((index) => !!deck.value[index]?.character);
  }
  if (target === '相手選択') {
    return [...new Set([defendingCardIndex, pairedDefendingCardIndex])]
      .filter((index): index is number => index !== undefined && !!deck.value[index]?.character);
  }
  if (target === '相手') {
    return deck.value[defendingCardIndex]?.character ? [defendingCardIndex] : [];
  }
  return [];
}

function deriveEnemyBaseAtk(action: EnemyActionDefinition) {
  const observedDamage = safeNumber(action.estimatedDamage);
  if (observedDamage <= 0) return 0;
  const denominator = calculateEnemyEqualDamage(
    action,
    1,
    observedEnemyAtkBuffRate(action),
    observedEnemyDamageBuffRate(action),
  );
  return denominator > 0 ? observedDamage / denominator : 0;
}

function calculateEnemyEqualDamage(
  action: EnemyActionDefinition,
  baseAtk: number,
  atkRatePercent: number,
  damageRatePercent: number,
) {
  const atkMultiplier = Math.max(0, 1 + atkRatePercent / 100);
  const damageTerm = Math.max(0, enemyMagicRatio(action) + damageRatePercent / 100);
  return Math.max(0, baseAtk) * atkMultiplier * damageTerm * enemyRengekiMultiplier(action.power);
}

function debuffRateFromParsedBuff(buff: ParsedBuff) {
  const level = Math.min(10, Math.max(1, Math.floor(safeNumber(buff.levelOption) || 10)));
  if (buff.buffOption === 'ATKDOWN') {
    return Math.abs(safeNumber(atkbuffDict[`ATKDOWN(${buff.powerOption})${level}`]) * 100);
  }
  const prefix = buff.buffOption === '属性ダメDOWN' ? '属性ダメDOWN' : 'ダメDOWN';
  return Math.abs(safeNumber(dmgbuffDict[`${prefix}(${buff.powerOption})${level}`]) * 100);
}

function playerDamageTakenDownRateFromParsedBuff(buff: ParsedBuff) {
  const level = Math.min(10, Math.max(1, Math.floor(safeNumber(buff.levelOption) || 10)));
  const prefix = buff.buffOption === '属性被ダメージDOWN' ? '属性ダメDOWN' : 'ダメDOWN';
  return Math.abs(safeNumber(dmgbuffDict[`${prefix}(${buff.powerOption})${level}`]) * 100);
}

function isEnemyDamageTakenUpBuff(buff: ParsedBuff) {
  return buff.buffOption === '被ダメージUP' || buff.buffOption === '属性被ダメージUP';
}

function isEnemyDamageTakenDownBuff(buff: ParsedBuff) {
  return buff.buffOption === '被ダメージDOWN' || buff.buffOption === '属性被ダメージDOWN';
}

function playerDamageTakenUpRateFromParsedBuff(buff: ParsedBuff) {
  const level = Math.min(10, Math.max(1, Math.floor(safeNumber(buff.levelOption) || 10)));
  const prefix = buff.buffOption === '属性被ダメージUP' ? '属性ダメUP' : 'ダメUP';
  return Math.abs(safeNumber(dmgbuffDict[`${prefix}(${buff.powerOption})${level}`]) * 100);
}

function curseSuccessRateFromParsedBuff(buff: ParsedBuff) {
  const power = buff.powerOption || '中';
  return safeNumber(curseRatePowerScale[power]) || curseRatePowerScale.中;
}

function blindRateFromParsedBuff(buff: ParsedBuff) {
  return safeNumber(blindRateByPower[buff.powerOption]) || 21.6;
}

function freezeSuccessRateFromParsedBuff(buff: ParsedBuff) {
  const power = buff.powerOption || '極大';
  return safeNumber(freezeRatePowerScale[power]) || freezeRatePowerScale.極大;
}

function parsedRateFromBuff(buff: ParsedBuff) {
  if (buff.buffOption === 'ATKUP' || buff.buffOption === 'ダメージUP' || buff.buffOption === '属性ダメUP' || buff.buffOption === 'クリティカル') {
    return playerBuffRateFromParsedBuff(buff);
  }
  if (buff.buffOption === 'ATKDOWN' || buff.buffOption === 'ダメージDOWN' || buff.buffOption === '属性ダメDOWN') {
    return debuffRateFromParsedBuff(buff);
  }
  if (isPlayerDamageTakenDownBuff(buff) || isEnemyDamageTakenDownBuff(buff)) {
    return playerDamageTakenDownRateFromParsedBuff(buff);
  }
  if (isPlayerDamageTakenUpBuff(buff) || isEnemyDamageTakenUpBuff(buff)) {
    return playerDamageTakenUpRateFromParsedBuff(buff);
  }
  if (buff.buffOption === '回避') return evasionRateFromParsedBuff(buff);
  if (buff.buffOption === '暗闇') return blindRateFromParsedBuff(buff);
  if (buff.buffOption === '呪い') return curseSuccessRateFromParsedBuff(buff);
  if (buff.buffOption === '凍結') return freezeSuccessRateFromParsedBuff(buff);
  return 0;
}

function playerBuffRateFromParsedBuff(buff: ParsedBuff) {
  const level = Math.min(10, Math.max(1, Math.floor(safeNumber(buff.levelOption) || 10)));
  if (buff.buffOption === 'ATKUP') {
    return Math.abs(safeNumber(atkbuffDict[`ATKUP(${buff.powerOption})${level}`]) * 100);
  }
  if (buff.buffOption === 'ダメージUP' || buff.buffOption === '属性ダメUP') {
    const prefix = buff.buffOption === '属性ダメUP' ? '属性ダメUP' : 'ダメUP';
    return Math.abs(safeNumber(dmgbuffDict[`${prefix}(${buff.powerOption})${level}`]) * 100);
  }
  if (buff.buffOption === 'クリティカル') {
    return criticalChanceFromPower(buff.powerOption) * 100;
  }
  return 0;
}

function evasionRateFromParsedBuff(buff: ParsedBuff) {
  return safeNumber(evasionRateByPower[buff.powerOption]) || 14.8;
}

function normalizeEffectDuration(action: RuntimeEnemyAction) {
  return Math.min(5, Math.max(1, Math.floor(safeNumber(action.duration) || 1)));
}

function normalizeGutsCount(action: RuntimeEnemyAction) {
  return Math.max(1, Math.floor(safeNumber(action.effectValue) || safeNumber(action.duration) || 1));
}

function normalizePlayerGutsCount(buff: ParsedBuff) {
  const explicitCount = safeNumber(buff.powerOption);
  return Math.max(1, Math.floor(explicitCount || 1));
}

function applyEnemyGutsIfNeeded(state: SimulationState, enemyHp: number, stats: SimulationStats, targetEnemySlotKey?: string) {
  if (enemyHp > 0) return { hp: enemyHp, used: false };
  const gutsIndex = state.enemyGuts.findIndex((entry) => entry.turns > 0
    && entry.count > 0
    && timedRateAppliesToEnemy(entry, targetEnemySlotKey || ''));
  if (gutsIndex < 0) {
    return { hp: enemyHp, used: false };
  }
  state.enemyGuts = state.enemyGuts
    .map((entry, index) => (index === gutsIndex ? { ...entry, count: entry.count - 1 } : entry))
    .filter((entry) => entry.turns > 0 && entry.count > 0);
  return { hp: 1, used: true };
}

function applyPlayerGutsIfNeeded(state: SimulationState, playerHp: number, defendingMagicId: string) {
  if (playerHp > 0) return { hp: playerHp, used: false };
  const parsed = parseMagicId(defendingMagicId);
  if (!parsed) return { hp: playerHp, used: false };
  const gutsIndex = state.playerGuts.findIndex((entry) => entry.turns > 0
    && entry.count > 0
    && entry.cardIndex === parsed.deckIndex);
  if (gutsIndex < 0) {
    return { hp: playerHp, used: false };
  }
  state.playerGuts = state.playerGuts
    .map((entry, index) => (index === gutsIndex ? { ...entry, count: entry.count - 1 } : entry))
    .filter((entry) => entry.turns > 0 && entry.count > 0);
  return { hp: 1, used: true };
}

function rollEffect(ratePercent: number, rng: () => number) {
  return rng() < Math.min(1, Math.max(0, ratePercent) / 100);
}

function isPlayerCursed(state: SimulationState, cardIndex: number) {
  return !isPlayerImmune(state, cardIndex, 'curse')
    && state.playerCurses.some((entry) => entry.cardIndex === cardIndex && entry.turns > 0);
}

function isPlayerFrozen(state: SimulationState, cardIndex: number) {
  return !isPlayerImmune(state, cardIndex, 'freeze')
    && state.playerFreezes.some((entry) => entry.cardIndex === cardIndex && entry.turns > 0);
}

function isPlayerImmune(state: SimulationState, cardIndex: number, kind: PlayerImmunityKind) {
  return state.playerImmunities.some((entry) => entry.cardIndex === cardIndex && entry.kind === kind && entry.turns > 0);
}

function isEnemyCursed(state: SimulationState, enemySlotKey?: string) {
  return state.enemyCurses.some((entry) => entry.turns > 0 && timedRateAppliesToEnemy(entry, enemySlotKey || ''));
}

function isEnemyFrozen(state: SimulationState, enemySlotKey?: string) {
  return state.enemyFreezes.some((entry) => entry.turns > 0 && timedRateAppliesToEnemy(entry, enemySlotKey || ''));
}

function removePlayerNegativeEffects(state: SimulationState, targetCards: number[]) {
  const targetSet = new Set(targetCards);
  state.playerAttackDowns = state.playerAttackDowns.filter((entry) => !targetSet.has(entry.cardIndex));
  state.playerDamageDowns = state.playerDamageDowns.filter((entry) => !targetSet.has(entry.cardIndex));
  state.playerDamageTakenUps = state.playerDamageTakenUps.filter((entry) => !targetSet.has(entry.cardIndex));
  state.playerBlinds = state.playerBlinds.filter((entry) => !targetSet.has(entry.cardIndex));
  state.playerCurses = state.playerCurses.filter((entry) => !targetSet.has(entry.cardIndex));
  state.playerFreezes = state.playerFreezes.filter((entry) => !targetSet.has(entry.cardIndex));
  state.burns = state.burns.filter((entry) => !targetSet.has(entry.cardIndex));
  state.playerBuffs = state.playerBuffs.filter((entry) => !targetSet.has(entry.targetDeckIndex) || !isNegativePlayerBuff(entry.buff));
}

function removePlayerPositiveEffects(state: SimulationState, targetCards: number[]) {
  const targetSet = new Set(targetCards);
  state.playerEvasions = state.playerEvasions.filter((entry) => !targetSet.has(entry.cardIndex) || entry.isBuddyGenerated);
  state.playerDamageTakenDowns = state.playerDamageTakenDowns.filter((entry) => !targetSet.has(entry.cardIndex) || entry.isBuddyGenerated);
  state.playerContinueHeals = state.playerContinueHeals.filter((entry) => !targetSet.has(entry.cardIndex) || entry.isBuddyGenerated);
  state.playerImmunities = state.playerImmunities.filter((entry) => !targetSet.has(entry.cardIndex) || entry.isBuddyGenerated);
  state.playerGuts = state.playerGuts.filter((entry) => !targetSet.has(entry.cardIndex) || entry.isBuddyGenerated);
  state.playerBuffs = state.playerBuffs.filter((entry) => !targetSet.has(entry.targetDeckIndex) || entry.buff?.isBuddyGenerated);
}

function isNegativePlayerBuff(buff: ParsedBuff | any) {
  return ['ATKDOWN', 'ダメージDOWN', '属性ダメDOWN'].includes(buff?.buffOption);
}

function removeEnemyNegativeEffects(state: SimulationState, enemySlotKeys: Array<string | undefined>) {
  state.enemyAttackDowns = removeEnemySlotDebuffsByTargets(state.enemyAttackDowns, enemySlotKeys);
  state.enemyDamageDowns = removeEnemySlotDebuffsByTargets(state.enemyDamageDowns, enemySlotKeys);
  state.enemyDamageTakenUps = removeEnemySlotDebuffsByTargets(state.enemyDamageTakenUps, enemySlotKeys);
  state.enemyCurses = removeEnemySlotDebuffsByTargets(state.enemyCurses, enemySlotKeys);
  state.enemyBlinds = removeEnemySlotDebuffsByTargets(state.enemyBlinds, enemySlotKeys);
  state.enemyFreezes = removeEnemySlotDebuffsByTargets(state.enemyFreezes, enemySlotKeys);
}

function removeEnemyPositiveEffects(state: SimulationState, enemySlotKeys?: Array<string | undefined>) {
  if (!enemySlotKeys) {
    state.enemyAttackUps = [];
    state.enemyDamageUps = [];
    state.enemyEvasions = [];
    state.enemyCriticals = [];
    state.enemyDamageReductions = [];
    state.enemyDamageNulls = [];
    state.enemyGuts = [];
    state.enemyContinueHeals = [];
    return;
  }
  const targetSet = enemySlotKeySet(enemySlotKeys);
  if (!targetSet.size) return;
  state.enemyAttackUps = removeEnemySlotBuffsByTargets(state.enemyAttackUps, targetSet);
  state.enemyDamageUps = removeEnemySlotBuffsByTargets(state.enemyDamageUps, targetSet);
  state.enemyEvasions = removeEnemySlotBuffsByTargets(state.enemyEvasions, targetSet);
  state.enemyCriticals = removeEnemySlotBuffsByTargets(state.enemyCriticals, targetSet);
  state.enemyDamageReductions = removeEnemySlotBuffsByTargets(state.enemyDamageReductions, targetSet);
  state.enemyDamageNulls = removeEnemySlotBuffsByTargets(state.enemyDamageNulls, targetSet);
  state.enemyGuts = state.enemyGuts.filter((entry) => !entry.targetEnemySlotKey || !targetSet.has(entry.targetEnemySlotKey));
  state.enemyContinueHeals = state.enemyContinueHeals.filter((entry) => !entry.targetEnemySlotKey || !targetSet.has(entry.targetEnemySlotKey));
}

function applyBurnDamage(state: SimulationState, currentHp: number) {
  let total = 0;
  state.burns.forEach((burn) => {
    if (isPlayerImmune(state, burn.cardIndex, 'burn')) return;
    const baseCardHp = deckCardHp(burn.cardIndex);
    const raw = baseCardHp * burn.rate / 100;
    const amount = ceilDamage(raw);
    total += amount;
  });
  const capped = total >= currentHp ? Math.max(0, currentHp - 1) : total;
  return capped;
}

function tickTimedEffects(state: SimulationState) {
  if (state.playerAttackDowns.length) state.playerAttackDowns = tickRateList(state.playerAttackDowns);
  if (state.playerDamageDowns.length) state.playerDamageDowns = tickRateList(state.playerDamageDowns);
  if (state.playerEvasions.length) state.playerEvasions = tickRateList(state.playerEvasions);
  if (state.enemyDamageReductions.length) state.enemyDamageReductions = tickRateList(state.enemyDamageReductions);
  if (state.enemyDamageNulls.length) state.enemyDamageNulls = tickRateList(state.enemyDamageNulls);
  if (state.enemyEvasions.length) state.enemyEvasions = tickRateList(state.enemyEvasions);
  if (state.enemyCriticals.length) state.enemyCriticals = tickRateList(state.enemyCriticals);
  if (state.enemyAttackDowns.length) state.enemyAttackDowns = tickRateList(state.enemyAttackDowns);
  if (state.enemyDamageDowns.length) state.enemyDamageDowns = tickRateList(state.enemyDamageDowns);
  if (state.enemyDamageTakenUps.length) state.enemyDamageTakenUps = tickRateList(state.enemyDamageTakenUps);
  if (state.enemyCurses.length) state.enemyCurses = tickRateList(state.enemyCurses);
  if (state.enemyBlinds.length) state.enemyBlinds = tickRateList(state.enemyBlinds);
  if (state.enemyFreezes.length) state.enemyFreezes = tickRateList(state.enemyFreezes);
  if (state.playerBlinds.length) state.playerBlinds = tickRateList(state.playerBlinds);
  if (state.playerCurses.length) state.playerCurses = tickRateList(state.playerCurses);
  if (state.playerFreezes.length) state.playerFreezes = tickRateList(state.playerFreezes);
  if (state.playerDamageTakenDowns.length) state.playerDamageTakenDowns = tickRateList(state.playerDamageTakenDowns);
  if (state.playerDamageTakenUps.length) state.playerDamageTakenUps = tickRateList(state.playerDamageTakenUps);
  if (state.enemyAttackUps.length) state.enemyAttackUps = tickRateList(state.enemyAttackUps);
  if (state.enemyDamageUps.length) state.enemyDamageUps = tickRateList(state.enemyDamageUps);
  if (state.enemyGuts.length) state.enemyGuts = tickConditionalList(state.enemyGuts, (entry) => entry.count > 0);
  if (state.enemyContinueHeals.length) state.enemyContinueHeals = tickConditionalList(state.enemyContinueHeals, (entry) => entry.amount > 0);
  if (state.playerGuts.length) state.playerGuts = tickConditionalList(state.playerGuts, (entry) => entry.count > 0);
  if (state.burns.length) state.burns = tickConditionalList(state.burns);
  if (state.playerContinueHeals.length) state.playerContinueHeals = tickConditionalList(state.playerContinueHeals);
  if (state.playerImmunities.length) state.playerImmunities = tickConditionalList(state.playerImmunities);
  if (state.playerBuffs.length) state.playerBuffs = tickConditionalList(state.playerBuffs);
}

function tickConditionalList<T extends { turns: number }>(list: T[], keep?: (entry: T) => boolean): T[] {
  if (list.length === 0) return list;
  const next: T[] = [];
  for (const entry of list) {
    if (entry.turns > 1 && (!keep || keep(entry))) next.push({ ...entry, turns: entry.turns - 1 });
  }
  return next;
}

function tickRateList<T extends TimedRate>(list: T[]): T[] {
  if (list.length === 0) return list;
  const next: T[] = [];
  for (const item of list) {
    if (item.turns > 1) next.push({ ...item, turns: item.turns - 1 });
  }
  return next;
}

function buildEnemyActionDeck(rng: () => number, requiredActions: number) {
  const perSlot = enemySlots.value
    .map((slot, slotIndex) => slot.actions
      .filter(isEnemyActionEnabled)
      .map((action, actionIndex) => ({
        ...action,
        slotKey: slot.id,
        slotName: slot.name || `敵${slotIndex + 1}`,
        slotLabel: `敵${slotIndex + 1}`,
        identity: `${slot.id}:${action.id}:${actionIndex}`,
      } as RuntimeEnemyAction)))
    .filter((actions) => actions.length > 0);
  const allActions = perSlot.flat();
  if (!allActions.length) return [];
  const firstDeck = buildFiveTurnEnemyDeck(perSlot, allActions, rng);
  if (requiredActions <= 10) return firstDeck.slice(0, requiredActions);
  return [...firstDeck, ...shuffle([...firstDeck], rng)].slice(0, requiredActions);
}

function buildFiveTurnEnemyDeck(perSlot: RuntimeEnemyAction[][], allActions: RuntimeEnemyAction[], rng: () => number) {
  let selected: RuntimeEnemyAction[] = [];
  if (perSlot.length === 3 && allActions.length === 9) {
    selected = [...allActions, pickRandom(allActions, rng)];
  } else if (perSlot.length === 3 && allActions.length === 10) {
    selected = [...allActions];
  } else if (perSlot.length >= 4) {
    selected = perSlot.map((actions) => pickRandom(actions, rng));
    const used = new Set(selected.map((action) => action.identity));
    selected = [...selected, ...shuffle(allActions.filter((action) => !used.has(action.identity)), rng).slice(0, Math.max(0, 10 - selected.length))];
  } else {
    selected = [...allActions];
    const counts = countIdentities(selected);
    while (selected.length < 10) {
      const candidates = allActions.filter((action) => (counts.get(action.identity) ?? 0) < 2);
      const picked = pickRandom(candidates.length ? candidates : allActions, rng);
      counts.set(picked.identity, (counts.get(picked.identity) ?? 0) + 1);
      selected.push(picked);
    }
  }
  return shuffle(selected, rng).slice(0, 10);
}

function enemyActionPool() {
  return enemySlots.value.flatMap((slot) => slot.actions).filter(isEnemyActionEnabled);
}

function isEnemyActionEnabled(action: EnemyActionDefinition) {
  return safeNumber(action.estimatedDamage) > 0 || action.effectKind !== 'none' || !!action.keepInDeckWhenDamageZero;
}

function countIdentities(actions: RuntimeEnemyAction[]) {
  const counts = new Map<string, number>();
  actions.forEach((action) => counts.set(action.identity, (counts.get(action.identity) ?? 0) + 1));
  return counts;
}

function calculateScore(stats: SimulationStats) {
  const runtimeCache = simulationRuntimeCache;
  const examKind = runtimeCache?.examKind ?? exam.value.kind;
  const difficulty = runtimeCache?.difficulty ?? exam.value.difficulty;
  if (examKind === 'BASIC') {
    const turns = [0.144, 0.138, 0.132, 0.126, 0.12];
    const moveNum = stats.advantage + stats.equal + stats.disadvantage;
    const turnIndex = clamp(Math.floor((moveNum - 1) / 2), 0, turns.length - 1);
    const base = stats.playerDamage - moveNum * 4.5 + stats.duo * 3000 + stats.advantage * 2000 + stats.equal * 500 - stats.disadvantage * 1000;
    return Math.round(base * difficulty * turns[turnIndex] + stats.specialChallengeScore);
  }
  if (examKind === 'ATTACK') {
    const actionCount = stats.advantageCombo + stats.equalCombo + stats.disadvantageCombo + stats.advantageSingle + stats.equalSingle + stats.disadvantageSingle;
    const damageScore = Math.round(stats.playerDamage / 208);
    const basicScore = 11036 + safeNumber(stats.enemyMaxHp) * 0.080471;
    const moveMinusScore = 641.2 + safeNumber(stats.enemyMaxHp) * 0.002048;
    const base = basicScore
      - moveMinusScore * actionCount
      + damageScore
      + stats.scoreBuff * 120
      + Math.min(1, stats.healBlock) * 180
      + stats.advantageCombo * 210
      + stats.equalCombo * 180
      + stats.disadvantageCombo * 150
      + stats.advantageSingle * 150
      + stats.equalSingle * 120
      + stats.disadvantageSingle * 90;
    return Math.round(base * difficulty + stats.specialChallengeScore);
  }
  const turns = [0.8, 0.85, 0.9, 0.95, 1];
  const turnMultiplier = turns[clamp(stats.finishTurn - 1, 0, turns.length - 1)];
  const base = stats.playerRemainHp * 0.1275
    + (stats.playerTotalHp + stats.playerHeal) * 0.0625
    + stats.playerDamage * 0.05
    + stats.advantageDamaged * 2 * 0.05208
    - stats.disadvantageDamaged / 1.5 * 0.05208
    + stats.evasion * 600
    + stats.debuff * 300;
  return Math.round(base * difficulty * turnMultiplier + stats.specialChallengeScore);
}

function pushScoreBreakdownLog(stats: SimulationStats) {
  if (!stats.log) return;
  if (stats.retired) {
    pushLog(stats, `スコア内訳: リタイアのためスコア0 / 理由 ${stats.retireReason}`);
    return;
  }

  if (exam.value.kind === 'BASIC') {
    const turns = [0.144, 0.138, 0.132, 0.126, 0.12];
    const moveNum = stats.advantage + stats.equal + stats.disadvantage;
    const turnIndex = clamp(Math.floor((moveNum - 1) / 2), 0, turns.length - 1);
    const turnMultiplier = turns[turnIndex];
    const components = [
      scoreComponent('与ダメ', stats.playerDamage),
      scoreComponent('行動数補正', -moveNum * 4.5, `${moveNum}回`),
      scoreComponent('DUO', stats.duo * 3000, `${stats.duo}回`),
      scoreComponent('有利', stats.advantage * 2000, `${stats.advantage}回`),
      scoreComponent('等倍', stats.equal * 500, `${stats.equal}回`),
      scoreComponent('不利', -stats.disadvantage * 1000, `${stats.disadvantage}回`),
      scoreComponent('特別課題', stats.specialChallengeScore, `${stats.specialChallengeLabels.length}件`),
    ];
    const base = stats.playerDamage - moveNum * 4.5 + stats.duo * 3000 + stats.advantage * 2000 + stats.equal * 500 - stats.disadvantage * 1000;
    pushLog(stats, `スコア内訳: BASIC ${components.join(' / ')}`);
    pushLog(stats, `スコア内訳: 小計 ${formatScoreNumber(base)} × 難易度 ${formatScoreNumber(exam.value.difficulty)} × ターン補正 ${formatScoreNumber(turnMultiplier)} + 特別課題 ${formatNumber(stats.specialChallengeScore)} = ${formatNumber(stats.score)}`);
    return;
  }

  if (exam.value.kind === 'ATTACK') {
    const actionCount = stats.advantageCombo + stats.equalCombo + stats.disadvantageCombo + stats.advantageSingle + stats.equalSingle + stats.disadvantageSingle;
    const damageScore = Math.round(stats.playerDamage / 208);
    const basicScore = 11036 + safeNumber(stats.enemyMaxHp) * 0.080471;
    const moveMinusScore = 641.2 + safeNumber(stats.enemyMaxHp) * 0.002048;
    const base = basicScore
      - moveMinusScore * actionCount
      + damageScore
      + stats.scoreBuff * 120
      + Math.min(1, stats.healBlock) * 180
      + stats.advantageCombo * 210
      + stats.equalCombo * 180
      + stats.disadvantageCombo * 150
      + stats.advantageSingle * 150
      + stats.equalSingle * 120
      + stats.disadvantageSingle * 90;
    const components = [
      scoreComponent('基礎', basicScore),
      scoreComponent('行動数補正', -moveMinusScore * actionCount, `${actionCount}回`),
      scoreComponent('与ダメ', damageScore, `総与ダメ${formatNumber(stats.playerDamage)}`),
      scoreComponent('バフ', stats.scoreBuff * 120, `${stats.scoreBuff}回`),
      scoreComponent('回復阻害', Math.min(1, stats.healBlock) * 180, `${Math.min(1, stats.healBlock)}回`),
      scoreComponent('有利連撃', stats.advantageCombo * 210, `${stats.advantageCombo}回`),
      scoreComponent('等倍連撃', stats.equalCombo * 180, `${stats.equalCombo}回`),
      scoreComponent('不利連撃', stats.disadvantageCombo * 150, `${stats.disadvantageCombo}回`),
      scoreComponent('有利単発', stats.advantageSingle * 150, `${stats.advantageSingle}回`),
      scoreComponent('等倍単発', stats.equalSingle * 120, `${stats.equalSingle}回`),
      scoreComponent('不利単発', stats.disadvantageSingle * 90, `${stats.disadvantageSingle}回`),
      scoreComponent('特別課題', stats.specialChallengeScore, `${stats.specialChallengeLabels.length}件`),
    ];
    pushLog(stats, `スコア内訳: ATTACK ${components.join(' / ')}`);
    pushLog(stats, `スコア内訳: 小計 ${formatScoreNumber(base)} × 難易度 ${formatScoreNumber(exam.value.difficulty)} + 特別課題 ${formatNumber(stats.specialChallengeScore)} = ${formatNumber(stats.score)}`);
    return;
  }

  const turns = [0.8, 0.85, 0.9, 0.95, 1];
  const turnMultiplier = turns[clamp(stats.finishTurn - 1, 0, turns.length - 1)];
  const remainHpScore = stats.playerRemainHp * 0.1275;
  const totalHpAndHealScore = (stats.playerTotalHp + stats.playerHeal) * 0.0625;
  const playerDamageScore = stats.playerDamage * 0.05;
  const advantageDamagedScore = stats.advantageDamaged * 2 * 0.05208;
  const disadvantageDamagedScore = -stats.disadvantageDamaged / 1.5 * 0.05208;
  const evasionScore = stats.evasion * 600;
  const debuffScore = stats.debuff * 300;
  const base = remainHpScore
    + totalHpAndHealScore
    + playerDamageScore
    + advantageDamagedScore
    + disadvantageDamagedScore
    + evasionScore
    + debuffScore;
  const components = [
    scoreComponent('残HP', remainHpScore, `HP${formatNumber(stats.playerRemainHp)}`),
    scoreComponent('総HP+回復', totalHpAndHealScore, `${formatNumber(stats.playerTotalHp)}+${formatNumber(stats.playerHeal)}`),
    scoreComponent('与ダメ', playerDamageScore, `${formatNumber(stats.playerDamage)}`),
    scoreComponent('有利被ダメ', advantageDamagedScore, `${formatNumber(stats.advantageDamaged)}`),
    scoreComponent('不利被ダメ', disadvantageDamagedScore, `${formatNumber(stats.disadvantageDamaged)}`),
    scoreComponent('回避', evasionScore, `${stats.evasion}回`),
    scoreComponent('デバフ', debuffScore, `${stats.debuff}回`),
    scoreComponent('特別課題', stats.specialChallengeScore, `${stats.specialChallengeLabels.length}件`),
  ];
  pushLog(stats, `スコア内訳: DEFENCE ${components.join(' / ')}`);
  pushLog(stats, `スコア内訳: 小計 ${formatScoreNumber(base)} × 難易度 ${formatScoreNumber(exam.value.difficulty)} × ターン補正 ${formatScoreNumber(turnMultiplier)} + 特別課題 ${formatNumber(stats.specialChallengeScore)} = ${formatNumber(stats.score)}`);
}

function scoreComponent(label: string, value: number, detail = '') {
  const detailText = detail ? `(${detail})` : '';
  return `${label} ${signedScore(value)}${detailText}`;
}

function signedScore(value: number) {
  if (Math.abs(value) < 0.0001) return '0';
  return `${value > 0 ? '+' : '-'}${formatScoreNumber(Math.abs(value))}`;
}

function formatScoreNumber(value: number) {
  return value.toLocaleString('ja-JP', {
    maximumFractionDigits: 3,
  });
}

function incrementCompatibilityStats(stats: SimulationStats, compatibility: ScoreCompatibility, hitCount: number) {
  const examKind = simulationRuntimeCache?.examKind ?? exam.value.kind;
  if (examKind === 'BASIC') {
    if (compatibility === 'advantage') stats.advantage += 1;
    if (compatibility === 'equal') stats.equal += 1;
    if (compatibility === 'disadvantage') stats.disadvantage += 1;
    return;
  }
  if (examKind !== 'ATTACK') return;
  const isCombo = hitCount > 1;
  if (compatibility === 'advantage' && isCombo) stats.advantageCombo += 1;
  if (compatibility === 'equal' && isCombo) stats.equalCombo += 1;
  if (compatibility === 'disadvantage' && isCombo) stats.disadvantageCombo += 1;
  if (compatibility === 'advantage' && !isCombo) stats.advantageSingle += 1;
  if (compatibility === 'equal' && !isCombo) stats.equalSingle += 1;
  if (compatibility === 'disadvantage' && !isCombo) stats.disadvantageSingle += 1;
}

function resolveTargetElement(enemyAction: RuntimeEnemyAction | undefined): ActionElement {
  return effectiveEnemyActionElement(enemyAction);
}

function normalizeElement(value: string): ActionElement {
  if (value?.includes('火')) return '火';
  if (value?.includes('水')) return '水';
  if (value?.includes('木')) return '木';
  return '無';
}

function getCompatibility(attacker: ActionElement, defender: ActionElement): ScoreCompatibility {
  if (attacker === '無' || defender === '無') return 'equal';
  if ((attacker === '火' && defender === '木') || (attacker === '木' && defender === '水') || (attacker === '水' && defender === '火')) return 'advantage';
  if ((attacker === '火' && defender === '水') || (attacker === '木' && defender === '火') || (attacker === '水' && defender === '木')) return 'disadvantage';
  return 'equal';
}

function magicHitCount(power: string) {
  if (power.includes('デュオ') || power.includes('3')) return 3;
  if (power.includes('連撃') || power.includes('2')) return 2;
  return 1;
}

function sumRatesForEnemy(list: TimedRate[], enemySlotKey: string) {
  let total = 0;
  for (const item of list) {
    if (timedRateAppliesToEnemy(item, enemySlotKey)) total += item.rate;
  }
  return total;
}

function sumDamageRatesForElementAndEnemy(list: TimedRate[], element: ActionElement, enemySlotKey: string) {
  let total = 0;
  for (const item of list) {
    if (!timedRateAppliesToEnemy(item, enemySlotKey)) continue;
    if (item.attributeOption && item.attributeOption !== element) continue;
    total += item.rate;
  }
  return total;
}

function hasEnemyDamageNull(state: SimulationState, element: ActionElement, enemySlotKey: string) {
  return state.enemyDamageNulls.some((item) => (
    item.turns > 0
    && timedRateAppliesToEnemy(item, enemySlotKey)
    && (!item.attributeOption || item.attributeOption === element)
  ));
}

function enemySlotKeySet(enemySlotKeys: Array<string | undefined>) {
  return new Set(enemySlotKeys.filter((enemySlotKey): enemySlotKey is string => !!enemySlotKey));
}

function timedRateAppliesToEnemy(item: { targetEnemySlotKey?: string }, enemySlotKey: string) {
  return !item.targetEnemySlotKey || item.targetEnemySlotKey === enemySlotKey;
}

function removeEnemySlotDebuffsByTargets<T extends TimedRate>(list: T[], enemySlotKeys: Array<string | undefined>) {
  const targetSet = enemySlotKeySet(enemySlotKeys);
  if (!targetSet.size) return list;
  return list.filter((item) => !item.targetEnemySlotKey || !targetSet.has(item.targetEnemySlotKey));
}

function removeEnemySlotBuffsByTargets<T extends TimedRate>(list: T[], targetSet: Set<string>) {
  return list.filter((item) => !item.targetEnemySlotKey || !targetSet.has(item.targetEnemySlotKey));
}

function sumRatesForCard(list: TargetedTimedRate[], cardIndex: number) {
  let total = 0;
  for (const item of list) {
    if (item.cardIndex === cardIndex) total += item.rate;
  }
  return total;
}

function sumDamageDownRatesForCard(list: TargetedTimedRate[], cardIndex: number, attackerElement: ActionElement) {
  let total = 0;
  for (const item of list) {
    if (item.cardIndex !== cardIndex) continue;
    if (item.attributeOption && item.attributeOption !== attackerElement) continue;
    total += item.rate;
  }
  return total;
}

function sumDamageTakenDownRatesForCard(list: TargetedTimedRate[], cardIndex: number, attackElement: ActionElement) {
  let total = 0;
  for (const item of list) {
    if (item.cardIndex !== cardIndex) continue;
    if (item.attributeOption && item.attributeOption !== attackElement) continue;
    total += item.rate;
  }
  return total;
}

function nextDamageFactor(rng: () => number) {
  const roll = rng();
  return 0.95 + roll * 0.1;
}

function ceilDamage(value: number) {
  return Math.ceil(Math.max(0, value));
}

function safeNumber(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function roundPercentage(value: number) {
  return Math.round(value * 1000) / 1000;
}

function formatPercentage(value: number) {
  return roundPercentage(Number(value) || 0).toFixed(3);
}

function formatTruncatedDecimal(value: string | number, fractionDigits: number) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return '0';
  const factor = 10 ** fractionDigits;
  const truncated = numeric < 0
    ? Math.ceil(numeric * factor) / factor
    : Math.floor(numeric * factor) / factor;
  return truncated.toLocaleString('ja-JP', {
    maximumFractionDigits: fractionDigits,
    minimumFractionDigits: 0,
  });
}

function calculatePercentageAxisRange(values: number[], lowerBound?: number) {
  const validValues = values.filter((value) => Number.isFinite(value));
  if (!validValues.length) return { min: 0, max: 100 };
  const minValue = Math.min(...validValues);
  const maxValue = Math.max(...validValues);
  const fixedMin = lowerBound !== undefined && Number.isFinite(lowerBound)
    ? Math.max(0, Math.min(100, lowerBound))
    : undefined;
  const span = maxValue - minValue;
  const padding = Math.max(2.5, span * 0.12);
  let min = fixedMin ?? Math.max(0, Math.floor((minValue - padding) / 5) * 5);
  let max = Math.min(100, Math.ceil((maxValue + padding) / 5) * 5);
  if (min === max) {
    if (max >= 100) min = Math.max(0, max - 5);
    else max = Math.min(100, min + 5);
  }
  if (max <= min) max = Math.min(100, min + 5);
  return { min, max };
}

function pickRandom<T>(items: T[], rng: () => number): T {
  return items[Math.min(items.length - 1, Math.floor(rng() * items.length))];
}

function shuffle<T>(items: T[], rng: () => number) {
  const shuffled = [...items];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(rng() * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }
  return shuffled;
}

function hashSeed(input: string) {
  let hash = 1779033703 ^ input.length;
  for (let index = 0; index < input.length; index += 1) {
    hash = Math.imul(hash ^ input.charCodeAt(index), 3432918353);
    hash = (hash << 13) | (hash >>> 19);
  }
  return () => {
    hash = Math.imul(hash ^ (hash >>> 16), 2246822507);
    hash = Math.imul(hash ^ (hash >>> 13), 3266489909);
    return (hash ^= hash >>> 16) >>> 0;
  };
}

function createRng(seedText: string, restoredState?: number): StatefulRng {
  let seedValue = restoredState ?? hashSeed(seedText)();
  const rng = (() => {
    seedValue += 0x6D2B79F5;
    let value = seedValue;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  }) as StatefulRng;
  rng.getState = () => seedValue;
  rng.setState = (state: number) => {
    seedValue = state;
  };
  return rng;
}

function createIterationSeed(iteration: number) {
  if (safeNumber(seed.value) === -1) {
    return `${Date.now()}:${Math.random()}:${iteration}`;
  }
  return `${seed.value}:${iteration}`;
}

function formatNumber(value: number) {
  return Math.round(value).toLocaleString('ja-JP');
}

function formatElapsedTime(value: number) {
  const totalSeconds = Math.max(0, Math.floor(value / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

function pushLog(stats: SimulationStats, line: string | (() => string)) {
  if (!stats.log) return;
  stats.log.push(typeof line === 'function' ? line() : line);
}

function retire(stats: SimulationStats, reason: string) {
  stats.retired = true;
  stats.retireReason = reason;
  if (stats.log) pushLog(stats, () => `リタイア: ${reason}`);
}

function retireReasonBucket(reason: string) {
  const normalized = String(reason || '')
    .replace(/^\d+T\s*/, '')
    .replace(/^(先手|後手)\s*/, '')
    .trim();
  if (normalized === '使用可能な手札が2枚未満' || normalized === '許容組み合わせなし') return '手札無し';
  if (normalized === '被ダメージで自HP0') return '敗北';
  return normalized || '不明';
}

function describeMagic(magicId?: string, duoActive = false) {
  const magic = magicById(magicId);
  if (!magic) {
    const invalid = magicId ? parseInvalidMagicId(magicId) : null;
    if (invalid) return `${describeDeckCard(invalid.deckIndex)} M${invalid.magicSlot}(無効手札)`;
    return magicId || 'なし';
  }
  const cardName = describeDeckCard(magic.deckIndex);
  const power = duoActive && magic.magicSlot === 2 ? 'デュオ' : magic.power;
  return `${cardName} M${magic.magicSlot}(${magic.element}, ${power || '威力不明'})`;
}

function describeDeckCard(deckIndex: number) {
  const slot = deck.value[deckIndex];
  return slot?.character ? `${slot.character.chara}/${slot.character.costume}` : `枠${deckIndex + 1}`;
}

function describeEnemyAction(action?: RuntimeEnemyAction) {
  if (!action) return '行動なし';
  return `${enemyDisplayLabel(action)}:${action.name}(${effectiveEnemyActionElement(action)}, ${action.power}, 等倍${formatNumber(action.estimatedDamage)}, ATK${formatNumber(deriveEnemyBaseAtk(action))})`;
}

function describeEnemyTarget(action?: RuntimeEnemyAction) {
  return action ? enemyDisplayLabel(action) : '敵';
}

function enemyDisplayLabel(action: RuntimeEnemyAction) {
  return action.slotName || action.slotLabel || '敵';
}

function describeEnemyEffectTarget(action: RuntimeEnemyAction, defendingMagicId: string, pairedDefendingMagicId?: string) {
  const parsed = parseMagicId(defendingMagicId);
  if (!parsed) return '';
  if (action.effectTarget === '相手全体') return ' -> 相手全体';
  const paired = pairedDefendingMagicId ? parseMagicId(pairedDefendingMagicId) : null;
  const playerTargets = resolveEnemyPlayerTargets(action.effectTarget, parsed.deckIndex, paired?.deckIndex);
  if (action.effectTarget === '相手選択' && playerTargets.length) {
    return ` -> ${[defendingMagicId, pairedDefendingMagicId]
      .filter((magicId): magicId is string => !!magicId && !!parseMagicId(magicId))
      .filter((magicId, index, array) => array.indexOf(magicId) === index)
      .map((magicId) => describeMagic(magicId))
      .join(' / ')}`;
  }
  if (playerTargets.length) return ` -> ${describeMagic(defendingMagicId)}`;
  return '';
}

function describeEnemyEffect(action: RuntimeEnemyAction) {
  if (action.effectKind === 'none') return 'なし';
  const value = safeNumber(action.effectValue);
  const valueText = value
    ? (['heal', 'continueHeal'].includes(action.effectKind) ? formatNumber(value) : `${value}%`)
    : '既定値';
  const labelMap: Record<EffectKind, string> = {
    none: 'なし',
    atkUp: 'ATKUP',
    atkDown: 'ATKDOWN',
    damageUp: 'ダメージUP',
    damageDown: 'ダメージDOWN',
    damageTakenDown: '被ダメDOWN',
    burn: 'やけど',
    heal: '回復',
    continueHeal: '継続回復',
    blind: '暗闇',
    evasion: '回避',
    curse: '呪い',
    freeze: '凍結',
    debuffRemoval: 'デバフ解除',
    buffRemoval: 'バフ解除',
    guts: 'ガッツ',
  };
  return `${labelMap[action.effectKind]} ${valueText} ${safeNumber(action.duration) || 1}T`;
}

function describeEnemyDamageModifiers(atkRate: number, damageRate: number) {
  const modifiers: string[] = [];
  if (Math.abs(atkRate) > 0.0001) modifiers.push(`${atkRate < 0 ? 'ATKDOWN' : 'ATKUP'}${formatRatePercent(Math.abs(atkRate))}%`);
  if (Math.abs(damageRate) > 0.0001) modifiers.push(`${damageRate < 0 ? 'ダメDOWN' : 'ダメUP'}${formatRatePercent(Math.abs(damageRate))}%`);
  return modifiers.length ? ` / 補正 ${modifiers.join(', ')}` : '';
}

function closestPowerLabel(rate: number, scale: Record<string, number>) {
  const absRate = Math.abs(safeNumber(rate));
  const entries = Object.entries(scale);
  if (!entries.length) return '中';
  return entries.reduce((best, current) => {
    const bestDistance = Math.abs(absRate - best[1]);
    const currentDistance = Math.abs(absRate - current[1]);
    return currentDistance < bestDistance ? current : best;
  })[0];
}

function formatRatePercent(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(3).replace(/0+$/, '').replace(/\.$/, '');
}
</script>

<style scoped>
.exam-simulator {
  max-width: none;
  min-height: calc(100vh - 64px);
  padding: 10px 12px 24px;
  color: #1f2c35;
  background: #f5f7fa;
}

.exam-shell {
  max-width: 1500px;
  min-width: 0;
  margin: 0 auto;
}

.exam-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 12px 14px;
  border: 1px solid #d9e2ea;
  border-radius: 8px;
  background: #ffffff;
}

.exam-header h1 {
  margin: 2px 0 6px;
  font-size: 24px;
  font-weight: 800;
  line-height: 1.2;
}

.eyebrow {
  color: #657889;
  font-size: 11px;
  font-weight: 800;
  line-height: 1.1;
}

.summary-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.summary-chips span,
.panel-chip,
.turn-count {
  min-height: 24px;
  padding: 4px 8px;
  border: 1px solid #dce5ed;
  border-radius: 6px;
  color: #3f5668;
  background: #f8fafc;
  font-size: 12px;
  font-weight: 800;
  line-height: 1.2;
}

.header-actions,
.result-actions,
.enemy-toolbar {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
}

.run-field {
  width: 132px;
}

.seed-field {
  width: 112px;
}

.validation-bar {
  margin: 10px 0 0;
}

.main-tabs {
  margin-top: 10px;
  border: 1px solid #d9e2ea;
  border-radius: 8px;
  background: #ffffff;
  overflow: hidden;
}

.main-tabs :deep(.v-tab) {
  min-height: 48px;
  font-weight: 800;
}

.tab-window {
  min-width: 0;
  margin-top: 10px;
}

.exam-preset-strip {
  display: grid;
  grid-template-columns: minmax(340px, 0.58fr) minmax(760px, 1.42fr);
  align-items: center;
  gap: 10px;
  min-width: 0;
  max-width: 100%;
  margin-bottom: 10px;
  padding: 10px 12px;
  border: 1px solid #d9e2ea;
  border-radius: 8px;
  background: #ffffff;
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

.preset-group-unified {
  background: #fffaf2;
  border-color: #ead9bd;
}

.preset-group-unified .preset-actions {
  flex-wrap: wrap;
}

.preset-group-unified :deep(.v-btn) {
  max-width: 100%;
  white-space: normal;
}

.preset-group-label {
  white-space: nowrap;
  font-size: 12px;
  font-weight: 900;
  color: #52616d;
}

.tab-grid,
.plan-layout {
  display: grid;
  gap: 10px;
  align-items: start;
}

.exam-tab-grid {
  grid-template-columns: minmax(330px, 0.7fr) minmax(560px, 1.3fr);
}

.plan-layout {
  grid-template-columns: minmax(560px, 1fr) minmax(360px, 1fr);
}

.tool-panel {
  position: relative;
  min-width: 0;
  padding: 14px;
  border: 1px solid #d9e2ea;
  border-radius: 8px;
  background: #ffffff;
}

.panel-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  margin-bottom: 12px;
  padding-bottom: 10px;
  border-bottom: 1px solid #edf2f6;
}

.panel-heading h2 {
  margin: 0;
  font-size: 19px;
  font-weight: 800;
  line-height: 1.25;
}

.special-challenge-panel {
  grid-column: 1 / -1;
}

.special-score-total {
  color: #8b4a10;
  font-size: 18px;
  font-weight: 900;
}

.special-challenge-list {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(300px, 100%), 1fr));
  gap: 8px;
}

.special-challenge-item {
  display: grid;
  grid-template-columns: 18px 28px minmax(0, 1fr) auto;
  align-items: center;
  gap: 8px;
  min-height: 42px;
  padding: 8px 10px;
  border: 1px solid #dde6ed;
  border-radius: 8px;
  background: #fbfcfd;
  cursor: pointer;
}

.special-challenge-item input {
  width: 16px;
  height: 16px;
  margin: 0;
  accent-color: #b16a21;
}

.special-challenge-item.selected {
  border-color: #d9a65d;
  background: #fff7ec;
}

.special-rank {
  color: #89530d;
  font-weight: 900;
}

.special-label {
  min-width: 0;
  line-height: 1.25;
  font-weight: 800;
}

.special-score {
  color: #9b4f0b;
  font-weight: 900;
  white-space: nowrap;
}

.order-panel > .panel-heading {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
}

.order-panel > .panel-heading > div:first-child {
  flex: 0 0 auto;
}

.order-panel > .panel-heading h2 {
  white-space: nowrap;
}

.plan-heading-actions {
  display: flex;
  align-items: center;
  justify-content: center;
  flex: 1 1 360px;
  gap: 8px;
  min-width: 0;
  flex-wrap: wrap;
}

.smart-selection-toggle {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-height: 28px;
  padding: 3px 9px;
  border: 1px solid #c8dbe7;
  border-radius: 999px;
  color: #164d68;
  background: #f3f9fc;
  font-size: 12px;
  font-weight: 800;
  line-height: 1;
  white-space: nowrap;
  cursor: pointer;
}

.smart-selection-toggle input {
  width: 14px;
  height: 14px;
  margin: 0;
  accent-color: #236c8e;
}

.smart-selection-toggle.disabled {
  opacity: 0.46;
  cursor: not-allowed;
}

.turn-option-row {
  display: flex;
  justify-content: flex-end;
  margin-bottom: 8px;
}

.turn-smart-selection-toggle {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-height: 27px;
  padding: 3px 9px;
  border: 1px solid #d7e4ed;
  border-radius: 999px;
  color: #35586d;
  background: #fbfdff;
  font-size: 12px;
  font-weight: 800;
  line-height: 1;
  white-space: nowrap;
  cursor: pointer;
}

.turn-smart-selection-toggle input {
  width: 14px;
  height: 14px;
  margin: 0;
  accent-color: #236c8e;
}

.turn-smart-selection-toggle:has(input:checked) {
  border-color: #9bc7dc;
  color: #164d68;
  background: #eef8fd;
}

.turn-smart-selection-toggle.disabled {
  opacity: 0.46;
  cursor: not-allowed;
}

.plan-reference-panel {
  position: sticky;
  top: 10px;
  align-self: start;
}

.plan-reference-list {
  display: grid;
  gap: 7px;
}

.plan-reference-card {
  display: grid;
  grid-template-columns: 42px minmax(0, 1fr);
  align-items: center;
  gap: 8px;
  min-width: 0;
  padding: 7px;
  border: 1px solid #dfe7ee;
  border-radius: 8px;
  background: #fbfcfd;
}

.plan-reference-image-wrap {
  position: relative;
  width: 42px;
  height: 42px;
}

.plan-reference-image {
  width: 42px;
  height: 42px;
  display: block;
  overflow: hidden;
  border: 1px solid #ccd8e2;
  border-radius: 8px;
  background: #eef3f7;
  object-fit: cover;
}

.plan-reference-duo-icon-container {
  position: absolute;
  top: 0;
  left: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 21px;
  height: 21px;
  border: 1px solid #999;
  border-radius: 10%;
  background-color: #f5f5f5;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
  transition: all 0.3s ease;
}

.plan-reference-duo-icon-container.duo-active {
  border-color: #ff0000;
  background-color: #e8f5e8;
}

.plan-reference-duo-icon-container:not(.duo-active) .plan-reference-duo-icon {
  filter: grayscale(100%);
}

.plan-reference-duo-icon {
  width: 19px;
  height: 19px;
  border-radius: 10%;
  object-fit: cover;
}

.plan-reference-magic-list {
  display: grid;
  gap: 4px;
  min-width: 0;
}

.plan-reference-magic-row {
  display: grid;
  grid-template-columns: 34px minmax(0, 1fr);
  align-items: center;
  gap: 6px;
  min-width: 0;
}

.reference-magic-label {
  display: inline-grid;
  min-width: 30px;
  min-height: 22px;
  place-items: center;
  border: 1px solid #dbe5ed;
  border-radius: 6px;
  color: #334155;
  background: #f4f7fa;
  font-size: 11px;
  font-weight: 900;
}

.reference-magic-label--fire {
  border-color: #f3b4a7;
  color: #9c3b2d;
  background: #fff0ed;
}

.reference-magic-label--water {
  border-color: #aac8f5;
  color: #245894;
  background: #eef6ff;
}

.reference-magic-label--flora {
  border-color: #aad6ad;
  color: #2e6740;
  background: #effaf1;
}

.reference-magic-label--cosmic {
  border-color: #c4cad4;
  color: #53606f;
  background: #f3f5f8;
}

.reference-effect-text {
  min-width: 0;
  overflow: hidden;
  color: #263847;
  font-size: 12px;
  font-weight: 800;
  line-height: 1.35;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.reference-effect-text.muted,
.plan-reference-empty {
  color: #6a7b88;
}

.plan-reference-empty {
  padding: 12px;
  border: 1px dashed #c9d6df;
  border-radius: 8px;
  background: #fbfcfd;
  font-size: 13px;
  font-weight: 800;
  text-align: center;
}

.preset-actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-start;
  gap: 8px;
  min-width: 0;
  max-width: 100%;
}

.deck-save-actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 8px;
  min-width: 0;
}

.preset-menu-list {
  min-width: 260px;
  max-width: min(420px, 92vw);
}

.saved-deck-modal-overlay {
  position: fixed;
  inset: 0;
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.5);
}

.saved-deck-modal-content {
  width: min(500px, 90vw);
  max-height: 80vh;
  overflow: hidden;
  border-radius: 8px;
  background: #ffffff;
}

.saved-deck-modal-body {
  max-height: 80vh;
  overflow-y: auto;
  padding: 20px;
}

.settings-save-section {
  margin-bottom: 20px;
}

.settings-save-row {
  display: flex;
  align-items: center;
  gap: 12px;
}

.settings-save-btn {
  min-width: 36px !important;
  height: 36px !important;
  border-radius: 6px !important;
}

.settings-error-message {
  margin-top: 4px;
  color: #d32f2f;
  font-size: 0.8rem;
}

.saved-decks-section {
  margin-bottom: 20px;
}

.no-decks {
  padding: 24px;
  color: #666666;
  font-style: italic;
  text-align: center;
}

.settings-deck-item {
  margin-bottom: 10px;
  padding: 12px;
  border: 1px solid #e0e0e0;
  border-radius: 6px;
  cursor: pointer;
  transition: background 0.2s ease;
}

.settings-deck-item:hover {
  background: #f5f5f5;
}

.settings-deck-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.settings-deck-info {
  flex: 1;
  min-width: 0;
}

.settings-deck-name {
  margin-bottom: 4px;
  font-size: 0.95rem;
  font-weight: 500;
  word-break: break-all;
}

.settings-character-icons {
  display: flex;
  flex-shrink: 0;
  gap: 3px;
}

.settings-icon-slot {
  display: flex;
  width: 32px;
  height: 32px;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  border: 1px solid #e0e0e0;
  border-radius: 4px;
}

.settings-icon {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.settings-empty-icon {
  display: flex;
  width: 100%;
  height: 100%;
  align-items: center;
  justify-content: center;
  background: #f5f5f5;
}

.settings-delete-btn {
  min-width: 24px !important;
  height: 24px !important;
  padding: 0 !important;
  border-radius: 4px !important;
}

.settings-close-section {
  padding-top: 12px;
  border-top: 1px solid #e0e0e0;
}

.v-theme--dark .saved-deck-modal-content {
  background: #2c2c2c;
}

.v-theme--dark .settings-deck-item {
  border-color: #424242;
}

.v-theme--dark .settings-deck-item:hover {
  background: #3a3a3a;
}

.v-theme--dark .settings-close-section,
.v-theme--dark .settings-icon-slot {
  border-color: #424242;
}

.v-theme--dark .settings-empty-icon {
  background: #424242;
}

.form-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(130px, 1fr));
  gap: 9px;
}

.exam-grid {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.exam-grid > :first-child {
  grid-column: auto;
}

.span-2 {
  grid-column: span 2;
}

.enemy-card-list {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 8px;
}

.enemy-summary-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 10px;
  border: 1px solid #dfe7ee;
  border-radius: 8px;
  background: #fbfcfd;
}

.summary-title {
  font-size: 14px;
  font-weight: 800;
}

.summary-sub {
  margin-top: 2px;
  color: #647684;
  font-size: 12px;
  font-weight: 700;
}

.enemy-actions {
  display: flex;
  align-items: center;
  gap: 4px;
}

.deck-board {
  display: grid;
  grid-template-columns: 1fr;
  gap: 10px;
}

.deck-card {
  min-width: 0;
  display: grid;
  grid-template-columns: 76px minmax(0, 1fr);
  align-items: center;
  gap: 12px;
  min-height: 96px;
  padding: 10px;
  border: 1px solid #dfe7ee;
  border-radius: 8px;
  background: #fbfcfd;
}

.deck-card-button {
  position: relative;
  display: block;
  width: 76px;
  height: 76px;
  margin: 0;
  border: 1px solid #ccd8e2;
  border-radius: 8px;
  overflow: hidden;
  padding: 0;
  background: #eef3f7;
  cursor: pointer;
}

.deck-card-image,
.magic-card-image,
.combo-image {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.deck-card-number {
  position: absolute;
  left: 5px;
  top: 5px;
  padding: 2px 6px;
  border-radius: 4px;
  color: #ffffff;
  background: rgba(20, 30, 42, 0.78);
  font-size: 12px;
  font-weight: 800;
  line-height: 1;
}

.deck-card-body {
  min-width: 0;
}

.deck-card-name {
  display: none;
}

.deck-stats {
  display: none;
}

.deck-controls {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 10px;
  margin-top: 0;
  min-width: 0;
  white-space: nowrap;
}

.level-field {
  flex: 0 0 84px;
  width: 84px;
}

.totsu-field {
  flex: 0 0 68px;
  width: 68px;
}

.level-field :deep(.v-field) {
  min-height: 42px;
}

.totsu-field :deep(.v-field) {
  min-height: 42px;
}

.level-field :deep(.v-field__input) {
  min-height: 42px;
  padding: 0 8px;
  font-size: 15px;
  text-align: center;
}

.totsu-field :deep(.v-field__input) {
  min-height: 42px;
  padding: 0 8px;
  font-size: 15px;
  text-align: center;
}

.level-field :deep(.v-field__field) {
  align-items: center;
}

.totsu-field :deep(.v-field__field) {
  align-items: center;
}

.level-field :deep(.v-label) {
  display: none;
}

.totsu-field :deep(.v-label) {
  display: none;
}

.deck-level-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 4px;
}

.deck-level-row {
  display: grid;
  grid-template-columns: 34px minmax(0, 1fr);
  align-items: center;
  gap: 4px;
}

.magic-toggle {
  width: 46px;
  height: 38px;
  border: 1px solid #c8d5df;
  border-radius: 7px;
  color: #3e5465;
  background: #ffffff;
  padding: 0;
  font-size: 13px;
  font-weight: 900;
  cursor: pointer;
}

.deck-detail-button {
  flex: 0 0 42px;
  width: 42px;
  min-width: 42px;
  height: 42px;
}

.deck-detail-button :deep(.v-icon) {
  font-size: 22px;
}

.magic-toggle.selected {
  border-color: #236c8e;
  color: #164d68;
  background: #e8f3fb;
}

.magic-toggle:disabled {
  opacity: 0.35;
  cursor: default;
}

.level-chip {
  display: grid;
  width: 34px;
  height: 28px;
  place-items: center;
  border: 1px solid #d7e0e8;
  border-radius: 6px;
  color: #526879;
  background: #ffffff;
  font-size: 12px;
  font-weight: 900;
}

.mini-level-field :deep(.v-field) {
  min-height: 28px;
}

.mini-level-field :deep(input) {
  min-height: 26px;
  padding: 0 4px;
  text-align: center;
}

.magic-panel {
  position: sticky;
  top: 10px;
}

.magic-pool {
  display: grid;
  grid-template-columns: repeat(5, 64px);
  gap: 8px;
}

.magic-card,
.combo-drop-slot {
  position: relative;
  width: 64px;
  height: 64px;
  border-radius: 8px;
  overflow: hidden;
  background: #eef3f7;
}

.magic-card {
  border: 1px solid #ccd8e2;
  box-shadow: 0 1px 2px rgba(26, 39, 52, 0.12);
  cursor: pointer;
}

.magic-card.picked {
  border-color: #236c8e;
  box-shadow: 0 0 0 3px rgba(35, 108, 142, 0.18);
}

.magic-card:active {
  cursor: grabbing;
}

.magic-badge,
.card-index-badge {
  position: absolute;
  color: #ffffff;
  background: rgba(17, 27, 38, 0.82);
  font-size: 10px;
  font-weight: 900;
  line-height: 1;
  padding: 2px 4px;
}

.magic-badge {
  left: auto;
  top: auto;
  right: 3px;
  bottom: 3px;
  border-radius: 4px;
}

.card-index-badge {
  right: 3px;
  top: 3px;
  border-radius: 4px;
}

.turn-tabs {
  position: relative;
  z-index: 2;
  margin-bottom: -1px;
  border: 1px solid #dfe7ee;
  border-bottom: 0;
  border-radius: 8px 8px 0 0;
  background: #fbfcfd;
  overflow: visible;
}

.turn-tabs :deep(.v-tab) {
  min-width: 86px;
  min-height: 40px;
  border: 1px solid transparent;
  border-bottom: 0;
  border-radius: 8px 8px 0 0;
  font-weight: 900;
}

.turn-tabs :deep(.v-tab--selected) {
  border-color: #c8d5df;
  color: #164d68;
  background: #ffffff;
  box-shadow: 0 -2px 0 #236c8e inset;
}

.turn-count {
  min-width: 20px;
  min-height: 18px;
  margin-left: 6px;
  padding: 2px 5px;
}

.turn-page {
  position: relative;
  padding: 10px;
  border: 1px solid #dfe7ee;
  border-radius: 0 8px 8px;
  background: #ffffff;
}

.combo-list {
  display: grid;
  grid-template-columns: 1fr;
  gap: 4px;
}

.combo-row {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  min-height: 54px;
  padding: 4px 6px;
  border: 1px solid #dfe7ee;
  border-radius: 8px;
  background: #fbfcfd;
  cursor: pointer;
}

.combo-row.active {
  border-color: #236c8e;
  background: #f2f8fc;
  box-shadow: inset 3px 0 0 #236c8e;
}

.combo-row.combo-drag-over {
  border-color: #d36b36;
  background: #fff7f1;
  box-shadow: inset 4px 0 0 #d36b36, 0 0 0 2px rgba(211, 107, 54, 0.16);
}

.combo-row.virtual {
  border-style: dashed;
  background: #ffffff;
}

.combo-priority {
  display: inline-grid;
  grid-template-columns: auto 1fr;
  gap: 2px;
  flex: 0 0 28px;
  width: 32px;
  height: 28px;
  align-items: center;
  place-items: center;
  border: 1px solid rgba(35, 108, 142, 0.25);
  border-radius: 7px;
  color: #ffffff;
  background: linear-gradient(135deg, #236c8e 0%, #2b7fa5 100%);
  font-weight: 900;
  line-height: 1;
  cursor: grab;
  user-select: none;
  box-shadow: 0 1px 2px rgba(24, 62, 82, 0.18);
  transition: transform 0.12s ease, box-shadow 0.12s ease, background 0.12s ease;
}

button.combo-priority {
  padding: 0;
  appearance: none;
}

.combo-priority:hover {
  background: linear-gradient(135deg, #1e5f7e 0%, #2d89b2 100%);
  box-shadow: 0 2px 6px rgba(24, 62, 82, 0.24);
}

.combo-priority:active {
  cursor: grabbing;
  transform: scale(0.97);
}

.combo-priority-grip {
  color: rgba(255, 255, 255, 0.72);
  font-size: 10px;
  letter-spacing: -2px;
}

.combo-row.virtual .combo-priority {
  background: transparent;
  border: 0;
  box-shadow: none;
  cursor: default;
}

.combo-priority-empty {
  pointer-events: none;
}

.combo-pair {
  display: flex;
  gap: 6px;
}

.combo-drop-slot {
  display: grid;
  place-items: center;
  border: 1px dashed #8aa0b2;
  width: 48px;
  height: 48px;
}

.combo-drop-slot.filled {
  border-style: solid;
  border-color: #236c8e;
}

.combo-drop-slot.active {
  border-color: #d36b36;
  box-shadow: 0 0 0 3px rgba(211, 107, 54, 0.18);
}

.combo-placeholder {
  color: #8b9ba8;
  font-size: 16px;
  font-weight: 900;
}

.combo-right {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-left: auto;
}

.combo-auto-swap {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  min-height: 26px;
  padding: 2px 7px;
  border: 1px solid #d3e2ec;
  border-radius: 999px;
  color: #466577;
  background: #ffffff;
  font-size: 11px;
  font-weight: 800;
  line-height: 1;
  white-space: nowrap;
  cursor: pointer;
}

.combo-auto-swap input {
  width: 13px;
  height: 13px;
  margin: 0;
  accent-color: #236c8e;
}

.combo-auto-swap:has(input:checked) {
  border-color: #9bc7dc;
  color: #164d68;
  background: #eef8fd;
}

.combo-actions {
  display: flex;
  align-items: center;
  gap: 0;
}

.order-panel {
  min-height: 0;
}

.magic-picker {
  position: absolute;
  left: 18px;
  top: 142px;
  z-index: 12;
  width: 252px;
  padding: 8px;
  border: 1px solid #c8dbe7;
  border-radius: 8px;
  background: #ffffff;
  box-shadow: 0 8px 24px rgba(26, 39, 52, 0.14);
  transform-origin: 26px 0;
}

.magic-picker-close {
  position: absolute;
  top: 3px;
  right: 3px;
  z-index: 2;
  background: rgba(255, 255, 255, 0.82);
}

.magic-picker-grid {
  display: grid;
  gap: 5px;
}

.magic-picker-row {
  display: grid;
  grid-template-columns: repeat(3, 48px);
  gap: 5px;
  align-items: center;
}

.picker-card-label {
  position: relative;
  width: 28px;
  height: 28px;
  border: 1px solid #d6e1e9;
  border-radius: 6px;
  overflow: hidden;
  background: #eef3f7;
}

.picker-card-label img,
.picker-magic-cell img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.picker-card-label span {
  position: absolute;
  left: 2px;
  top: 2px;
  min-width: 14px;
  padding: 1px 3px;
  border-radius: 3px;
  color: #ffffff;
  background: rgba(20, 30, 42, 0.78);
  font-size: 10px;
  font-weight: 900;
  line-height: 1;
  text-align: center;
}

.picker-magic-cell {
  position: relative;
  width: 48px;
  height: 48px;
  border: 1px solid #ccd8e2;
  border-radius: 8px;
  overflow: hidden;
  background: #eef3f7;
  color: #8b9ba8;
  font-size: 13px;
  font-weight: 900;
  cursor: pointer;
}

.picker-magic-cell.selected {
  border-color: #236c8e;
  box-shadow: 0 0 0 3px rgba(35, 108, 142, 0.18);
}

.picker-magic-cell:disabled {
  border-style: dashed;
  opacity: 0.42;
  cursor: not-allowed;
}

.picker-pop-enter-active,
.picker-pop-leave-active {
  transition: opacity 140ms ease, transform 140ms ease;
}

.picker-pop-enter-from,
.picker-pop-leave-to {
  opacity: 0;
  transform: translateY(-6px) scale(0.96);
}

.picker-pop-enter-to,
.picker-pop-leave-from {
  opacity: 1;
  transform: translateY(0) scale(1);
}

.result-panel {
  min-height: 520px;
}

.simulation-mode-toggle {
  flex: 0 0 auto;
}

.auto-best-progress {
  margin-bottom: 10px;
  overflow: hidden;
  border: 1px solid #cbdce9;
  border-radius: 8px;
  background: #f6fafc;
}

.auto-best-progress-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(128px, 1fr));
  gap: 6px;
  padding: 8px;
}

.auto-best-progress .metric {
  min-height: 52px;
  padding: 7px 9px;
  background: #ffffff;
}

.auto-best-progress .metric-value {
  font-size: 17px;
}

.auto-best-stopped {
  border-color: #efb3ac;
  color: #a9281b;
  background: #fff7f6 !important;
}

.metrics-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(120px, 1fr));
  gap: 8px;
}

.metric {
  min-width: 0;
  min-height: 60px;
  padding: 9px 10px;
  border: 1px solid #dfe7ee;
  border-radius: 8px;
  background: #fbfcfd;
}

.metric-label {
  color: #637686;
  font-size: 12px;
  font-weight: 800;
}

.metric-value {
  margin-top: 3px;
  font-size: 20px;
  font-weight: 900;
  line-height: 1.15;
}

.retire-summary {
  display: flex;
  margin-bottom: 10px;
}

.retire-metric {
  min-width: 160px;
}

.empty-result {
  display: grid;
  min-height: 130px;
  place-items: center;
  border: 1px dashed #c8d5df;
  border-radius: 8px;
  color: #657889;
  background: #fbfcfd;
  font-weight: 800;
}

.chart-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
  margin-top: 10px;
}

.chart-panel {
  padding: 10px;
  border: 1px solid #dfe7ee;
  border-radius: 8px;
  background: #fbfcfd;
}

.chart-panel.wide {
  grid-column: 1 / -1;
}

.chart-heading {
  margin-bottom: 6px;
  color: #637686;
  font-size: 13px;
  font-weight: 900;
}

.chart-body {
  height: 330px;
}

.chart-body.compact {
  height: 240px;
}

.best-log-strip {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  margin-top: 10px;
  padding: 10px 12px;
  border: 1px solid #dfe7ee;
  border-radius: 8px;
  background: #fbfcfd;
  font-weight: 800;
}

.best-log-actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  flex-wrap: wrap;
  gap: 8px;
}

.modal-card {
  border-radius: 8px;
}

.modal-title {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  font-weight: 800;
}

.enemy-name-field {
  max-width: 280px;
}

.table-scroll {
  overflow-x: auto;
  border: 1px solid #dfe7ee;
  border-radius: 8px;
}

.enemy-table {
  min-width: 1040px;
  width: max-content;
}

.enemy-table :deep(th) {
  height: 34px;
  color: #637686;
  background: #f7f9fb;
  font-size: 12px;
  font-weight: 900;
  white-space: nowrap;
}

.enemy-table :deep(td) {
  padding: 5px 6px;
  vertical-align: middle;
}

.wide-cell {
  min-width: 160px;
}

.attribute-cell {
  min-width: 72px;
  width: 72px;
}

.fixed-attribute {
  display: grid;
  place-items: center;
  height: 40px;
  border: 1px solid #d8e1e8;
  border-radius: 6px;
  color: #364b5c;
  background: #f8fafc;
  font-size: 13px;
  font-weight: 800;
}

.power-cell {
  min-width: 190px;
  width: 190px;
}

.range-cell {
  min-width: 160px;
  width: 160px;
}

.value-cell {
  min-width: 104px;
  width: 104px;
}

.turn-cell {
  min-width: 90px;
  width: 90px;
}

.damage-cell {
  min-width: 132px;
  width: 132px;
}

.effect-cell {
  min-width: 180px;
  width: 180px;
}

.delete-cell {
  min-width: 52px;
  width: 52px;
  text-align: center;
}

.enemy-table :deep(.v-field__input) {
  min-width: 0;
  padding-inline-start: 10px;
  padding-inline-end: 2px;
  font-size: 13px;
}

.enemy-table :deep(.v-select__selection-text),
.enemy-table :deep(input) {
  overflow: visible;
  text-overflow: clip;
}

.log-body {
  max-height: 68vh;
  overflow: auto;
  padding-right: 4px;
}

.log-line {
  font-family: ui-monospace, SFMono-Regular, Consolas, "Liberation Mono", monospace;
  font-size: 12px;
  line-height: 1.65;
}

.log-turn-group {
  display: grid;
  gap: 6px;
  padding: 10px 0 12px;
  border-bottom: 1px solid #e2e9ef;
}

.log-turn-group:last-child {
  border-bottom: 0;
}

.log-turn-title {
  position: sticky;
  top: 0;
  z-index: 1;
  width: max-content;
  min-width: 56px;
  padding: 4px 10px;
  border: 1px solid #cfdae3;
  border-radius: 999px;
  color: #334a5c;
  background: #ffffff;
  font-size: 12px;
  font-weight: 900;
}

.battle-log-row {
  display: flex;
  align-items: center;
  gap: 7px;
  min-width: 0;
}

.battle-log-row.enemy {
  justify-content: flex-start;
  padding-right: 0;
}

.battle-log-row.player {
  justify-content: flex-end;
  padding-left: 0;
}

.battle-log-row.system {
  justify-content: center;
}

.log-combatant {
  flex: 0 0 auto;
  min-width: 44px;
  height: 28px;
  padding: 0 6px;
  border: 1px solid #cfdbe4;
  border-radius: 6px;
  color: #526a7c;
  background: #f7fafc;
  display: grid;
  place-items: center;
  font-size: 11px;
  font-weight: 900;
  line-height: 1;
  white-space: nowrap;
}

.log-marker {
  display: inline-flex;
  flex: 0 0 auto;
  align-items: center;
  gap: 4px;
}

.log-avatar {
  flex: 0 0 auto;
  width: 28px;
  height: 28px;
  border: 1px solid #cfdbe4;
  border-radius: 6px;
  background: #f7fafc;
}

.log-avatar {
  object-fit: cover;
}

.log-element-icon {
  width: 18px;
  height: 18px;
  flex: 0 0 auto;
  object-fit: contain;
}

.log-arrow {
  flex: 0 0 auto;
  color: #236c8e;
  font-size: 18px;
  font-weight: 900;
  line-height: 1;
}

.log-bubble,
.log-system-line {
  min-width: 0;
  padding: 7px 9px;
  border: 1px solid #dfe7ee;
  border-radius: 8px;
  font-family: ui-monospace, SFMono-Regular, Consolas, "Liberation Mono", monospace;
  font-size: 12px;
  line-height: 1.55;
  white-space: pre-wrap;
  word-break: break-word;
}

.log-bubble {
  flex: 1 1 auto;
  background: #fbfcfd;
}

.battle-log-row.emphasized .log-bubble,
.battle-log-row.emphasized .log-system-line {
  border-color: #8fbad7;
  background: #eef7fc;
  font-weight: 800;
}

.battle-log-row.enemy .log-bubble {
  border-color: #e4d3c9;
  background: #fff8f4;
}

.battle-log-row.player .log-bubble {
  border-color: #cadcea;
  background: #f4f9fd;
}

.battle-log-row.enemy.emphasized .log-bubble {
  border-color: #d8a48c;
  background: #fff2eb;
}

.battle-log-row.player.emphasized .log-bubble {
  border-color: #8fbad7;
  background: #eef7fc;
}

.log-system-line {
  width: 100%;
  color: #5d7080;
  background: #f7f9fb;
  text-align: center;
}

@media (max-width: 1180px) {
  .exam-header,
  .panel-heading {
    align-items: stretch;
    flex-direction: column;
  }

  .order-panel > .panel-heading {
    display: flex;
  }

  .plan-heading-actions {
    justify-content: flex-start;
    flex: 0 1 auto;
    width: 100%;
  }

  .header-actions,
  .result-actions,
  .preset-actions,
  .deck-save-actions {
    justify-content: flex-start;
  }

  .exam-preset-strip {
    align-items: stretch;
    grid-template-columns: 1fr;
  }

  .preset-group {
    grid-template-columns: auto minmax(0, 1fr) auto;
  }

  .exam-tab-grid,
  .plan-layout {
    grid-template-columns: 1fr;
  }

  .plan-reference-panel {
    display: none;
  }

  .magic-panel {
    position: static;
  }

  .magic-pool {
    grid-template-columns: repeat(auto-fill, 64px);
  }

  .deck-board {
    grid-template-columns: 1fr;
  }
}

@media (min-width: 721px) and (max-width: 1180px) {
  .deck-board {
    grid-template-columns: 1fr;
    gap: 10px;
  }

  .deck-card {
    grid-template-columns: 72px minmax(0, 1fr);
    gap: 12px;
    min-height: 92px;
    padding: 10px;
  }

  .deck-card-button {
    width: 72px;
    height: 72px;
  }

  .deck-controls {
    gap: 10px;
  }

  .level-field {
    flex-basis: 82px;
    width: 82px;
  }

  .totsu-field {
    flex-basis: 66px;
    width: 66px;
  }

  .level-field :deep(.v-field) {
    min-height: 40px;
  }

  .totsu-field :deep(.v-field) {
    min-height: 40px;
  }

  .level-field :deep(.v-field__input) {
    min-height: 40px;
    padding: 0 8px;
    font-size: 15px;
  }

  .totsu-field :deep(.v-field__input) {
    min-height: 40px;
    padding: 0 8px;
    font-size: 15px;
  }

  .magic-toggle-row {
    gap: 6px;
  }

  .magic-toggle {
    width: 44px;
    height: 36px;
    font-size: 13px;
  }

  .deck-detail-button {
    flex-basis: 40px;
    width: 40px;
    min-width: 40px;
    height: 40px;
  }

  .deck-detail-button :deep(.v-icon) {
    font-size: 22px;
  }
}

@media (max-width: 720px) {
  .exam-simulator {
    padding: 8px 6px 18px;
  }

  .exam-header,
  .tool-panel {
    padding: 10px;
  }

  .panel-heading {
    gap: 8px;
    margin-bottom: 8px;
    padding-bottom: 8px;
  }

  .order-panel > .panel-heading {
    align-items: flex-start;
  }

  .order-panel > .panel-heading h2 {
    font-size: 18px;
  }

  .plan-heading-actions {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 6px;
  }

  .smart-selection-toggle,
  .plan-heading-actions :deep(.v-btn) {
    width: 100%;
    min-height: 30px;
  }

  .smart-selection-toggle {
    justify-content: center;
    padding: 3px 7px;
  }

  .turn-page {
    padding: 8px;
  }

  .turn-option-row {
    justify-content: flex-start;
    margin-bottom: 6px;
  }

  .turn-smart-selection-toggle {
    min-height: 28px;
    padding: 3px 8px;
  }

  .header-actions > *,
  .result-actions > * {
    flex: 1 1 120px;
  }

  .run-field,
  .seed-field {
    width: auto;
  }

  .form-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .exam-preset-strip {
    grid-template-columns: minmax(0, 1fr);
    padding: 10px;
  }

  .preset-group {
    grid-template-columns: minmax(0, 1fr);
    align-items: stretch;
  }

  .preset-group-label {
    white-space: normal;
  }

  .preset-actions {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 6px;
  }

  .preset-actions :deep(.v-btn),
  .preset-group > :deep(.v-btn) {
    width: 100%;
    min-width: 0;
  }

  .special-challenge-list {
    grid-template-columns: minmax(0, 1fr);
  }

  .special-challenge-item {
    grid-template-columns: 18px 28px minmax(0, 1fr);
  }

  .special-score {
    grid-column: 3;
    justify-self: end;
  }

  .span-2 {
    grid-column: 1 / -1;
  }

  .metrics-grid,
  .chart-grid {
    grid-template-columns: 1fr;
  }

  .enemy-summary-card,
  .best-log-strip {
    align-items: stretch;
    flex-direction: column;
  }

  .enemy-actions {
    margin-left: 0;
  }
}
</style>
