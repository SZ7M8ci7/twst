<template>
  <v-container class="exam-simulator" data-testid="exam-simulator" fluid>
    <div class="exam-shell">
      <v-tabs v-model="activeTab" class="main-tabs" color="primary" fixed-tabs :mobile-breakpoint="Infinity">
        <v-tab value="exam" prepend-icon="mdi-file-document-edit-outline">敵条件</v-tab>
        <v-tab value="deck" prepend-icon="mdi-cards-outline">編成</v-tab>
        <v-tab value="plan" prepend-icon="mdi-call-split">行動</v-tab>
        <v-tab value="result" prepend-icon="mdi-chart-bar">シミュ</v-tab>
      </v-tabs>

      <div class="tab-window">
        <section v-show="activeTab === 'exam'">
          <div class="exam-preset-strip">
            <div class="preset-actions">
              <v-btn
                v-for="preset in recentExamPresets"
                :key="preset.id"
                color="primary"
                variant="tonal"
                size="small"
                @click="preset.apply"
              >
                {{ preset.title }}
              </v-btn>
            </div>
            <v-menu location="bottom end" max-height="420">
              <template #activator="{ props }">
                <v-btn v-bind="props" color="primary" variant="outlined" size="small">
                  過去分
                </v-btn>
              </template>
              <v-list class="preset-menu-list" density="compact" nav>
                <v-list-item
                  v-for="preset in examPresets"
                  :key="preset.id"
                  :title="preset.title"
                  @click="preset.apply"
                />
              </v-list>
            </v-menu>
          </div>

          <div class="tab-grid exam-tab-grid">
            <section class="tool-panel">
              <div class="panel-heading">
                <div>
                  <h2>試験条件</h2>
                </div>
              </div>
              <div class="form-grid exam-grid">
                <v-select v-model="exam.kind" class="exam-kind-select" :items="examKindOptions" label="形式" density="compact" variant="outlined" hide-details />
                <v-select v-model="exam.enemyElement" :items="elementOptions" label="敵属性" density="compact" variant="outlined" hide-details />
                <v-select
                  v-model="exam.difficulty"
                  :items="difficultyOptions"
                  item-title="title"
                  item-value="value"
                  label="難易度"
                  density="compact"
                  variant="outlined"
                  hide-details
                />
                <v-text-field v-model.number="exam.enemyHp" type="number" label="敵HP" min="1" density="compact" variant="outlined" hide-details />
              </div>
            </section>

            <section class="tool-panel">
              <div class="panel-heading">
                <div>
                  <h2>敵行動</h2>
                </div>
                <v-btn color="primary" variant="tonal" size="small" prepend-icon="mdi-plus" @click="addEnemySlot">敵を追加</v-btn>
              </div>
              <div class="enemy-card-list">
                <article v-for="(slot, slotIndex) in enemySlots" :key="slot.id" class="enemy-summary-card">
                  <div>
                    <div class="summary-title">{{ slot.name || `敵${slotIndex + 1}` }}</div>
                    <div class="summary-sub">{{ slot.actions.length }}行動</div>
                  </div>
                  <div class="enemy-actions">
                    <v-btn size="small" variant="tonal" prepend-icon="mdi-pencil" @click="openEnemyDialog(slotIndex)">編集</v-btn>
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
                <h2>デッキ編成</h2>
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
                      v-model.number="slot.level"
                      class="level-field"
                      type="number"
                      label="Lv"
                      :min="1"
                      :max="maxCardLevel(slot)"
                      density="compact"
                      variant="outlined"
                      hide-details
                      @update:model-value="normalizeDeckLevel(index)"
                    />
                    <v-select
                      v-model.number="slot.totsu"
                      class="totsu-field"
                      :items="totsuOptions"
                      item-title="title"
                      item-value="value"
                      label="凸"
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
                    <v-btn icon="mdi-tune-variant" class="deck-detail-button" :data-testid="`deck-detail-${index}`" size="small" variant="tonal" :disabled="!slot.character" aria-label="詳細編集" @click="openDeckDetailDialog(index)" />
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
                  <h2>許容組み合わせ</h2>
                </div>
                <div class="plan-heading-actions">
                  <v-btn
                    class="copy-prev-turn-button"
                    color="primary"
                    variant="tonal"
                    size="small"
                    prepend-icon="mdi-content-copy"
                    :disabled="activeTurnIndex === 0"
                    @click="copyPreviousTurnCombos"
                  >
                    前Tコピー
                  </v-btn>
                  <v-btn
                    color="primary"
                    variant="tonal"
                    size="small"
                    prepend-icon="mdi-select-all"
                    :disabled="magicCards.length < 2"
                    @click="addAllTurnCombos"
                  >
                    全組み合わせ
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
                <div v-if="currentTurnPlan" class="combo-list">
                  <div
                    v-for="(combo, comboIndex) in currentTurnDisplayCombos"
                    :key="combo.id"
                    class="combo-row"
                    :class="{ active: comboIndex === activeComboIndex && !combo.virtual, virtual: combo.virtual }"
                    @click="combo.virtual ? openMagicPicker(comboIndex, 'firstMagicId') : selectComboTarget(comboIndex)"
                  >
                    <div class="combo-priority">{{ combo.virtual ? '' : comboIndex + 1 }}</div>
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
                      <div class="combo-actions" v-if="!combo.virtual">
                        <v-btn icon="mdi-swap-horizontal" size="small" variant="text" :disabled="!combo.firstMagicId || !combo.secondMagicId" aria-label="左右入れ替え" @click.stop="swapComboMagic(activeTurnIndex, comboIndex)" />
                        <v-btn icon="mdi-arrow-up" size="small" variant="text" :disabled="comboIndex === 0" @click.stop="moveCombo(activeTurnIndex, comboIndex, -1)" />
                        <v-btn icon="mdi-arrow-down" size="small" variant="text" :disabled="comboIndex === currentTurnPlan.combos.length - 1" @click.stop="moveCombo(activeTurnIndex, comboIndex, 1)" />
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

            <aside class="tool-panel plan-reference-panel" aria-label="選択中マジック詳細">
              <div class="panel-heading">
                <div>
                  <h2>参考情報</h2>
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
                      :title="`デュオ相手: ${entry.duoPartner} (${entry.duoActive ? '有効' : '無効'})`"
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
                    <div v-if="!entry.magics.length" class="reference-effect-text muted">未選択</div>
                  </div>
                </article>
              </div>
              <div v-else class="plan-reference-empty">
                編成の選択マジックを表示
              </div>
            </aside>
          </div>
        </section>

        <section v-show="activeTab === 'result'">
          <section class="tool-panel result-panel">
            <div class="panel-heading">
              <div>
                <h2>シミュレーション結果</h2>
              </div>
              <div class="result-actions">
                <v-text-field v-model.number="iterations" class="run-field" type="number" min="1" max="100000" label="回数" density="compact" variant="outlined" hide-details />
                <v-text-field v-model.number="seed" class="seed-field" type="number" label="seed" density="compact" variant="outlined" hide-details />
                <v-btn color="primary" data-testid="run-simulation" size="large" :loading="isRunning" :disabled="!!validationMessage || isRunning" prepend-icon="mdi-play" @click="runSimulation">実行</v-btn>
                <v-btn icon="mdi-refresh" variant="tonal" aria-label="クリア" :disabled="!resultSummary || isRunning" @click="clearResults" />
              </div>
            </div>

            <div v-if="resultSummary" class="retire-summary">
              <div class="metric retire-metric">
                <div class="metric-label">リタイア</div>
                <div class="metric-value">{{ formatNumber(resultSummary.retiredCount) }} / {{ formatNumber(resultSummary.count) }}</div>
              </div>
            </div>
            <div v-else class="empty-result">未実行</div>

            <div class="chart-grid">
              <div v-if="scoreDistributionData.labels.length" class="chart-panel wide">
                <div class="chart-heading">スコア分布 / 達成確率</div>
                <div class="chart-body">
                  <Bar :data="scoreDistributionChartData" :options="scoreDistributionOptions" :update-mode="isRunning ? 'none' : 'default'" />
                </div>
              </div>
            </div>
            <div v-if="resultSummary && !scoreDistributionData.labels.length" class="empty-result">スコア0以外の結果なし</div>

            <div v-if="bestLog.length" class="best-log-strip">
              <div data-testid="best-log-title">{{ bestLogTitle }}</div>
              <div class="best-log-actions">
                <v-btn variant="tonal" size="small" prepend-icon="mdi-text-box-search-outline" @click="logDialogOpen = true">ログを開く</v-btn>
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
          <span>{{ editingEnemySlot.name || `敵${editingEnemySlotIndex + 1}` }} の行動</span>
          <v-btn icon="mdi-close" variant="text" @click="enemyDialogOpen = false" />
        </v-card-title>
        <v-card-text>
          <div class="enemy-toolbar">
            <v-text-field v-model="editingEnemySlot.name" class="enemy-name-field" label="敵名" density="compact" variant="outlined" hide-details />
            <v-btn color="primary" variant="tonal" size="small" prepend-icon="mdi-plus" @click="addEnemyAction(editingEnemySlotIndex)">行動追加</v-btn>
          </div>

          <div class="table-scroll">
            <v-table class="enemy-table" density="compact">
              <thead>
                <tr>
                  <th>属性</th>
                  <th>行動</th>
                  <th>等倍火力</th>
                  <th>効果</th>
                  <th>値</th>
                  <th>T</th>
                  <th>範囲</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="(action, actionIndex) in editingEnemySlot.actions" :key="action.id">
                  <td class="attribute-cell">
                    <v-select
                      v-if="exam.enemyElement === '全'"
                      v-model="action.element"
                      :items="actionElementOptions"
                      density="compact"
                      variant="outlined"
                      hide-details
                    />
                    <div v-else class="fixed-attribute">{{ exam.enemyElement }}</div>
                  </td>
                  <td class="power-cell"><v-select v-model="action.power" :items="enemyMagicPowerOptions" density="compact" variant="outlined" hide-details @update:model-value="syncEnemyPower(action)" /></td>
                  <td class="damage-cell"><v-text-field v-model.number="action.estimatedDamage" type="number" min="0" density="compact" variant="outlined" hide-details /></td>
                  <td class="effect-cell">
                    <v-select v-model="action.effectKind" :items="effectOptions" item-title="title" item-value="value" density="compact" variant="outlined" hide-details @update:model-value="syncEnemyEffectTarget(action)" />
                  </td>
                  <td class="value-cell"><v-text-field v-model.number="action.effectValue" type="number" density="compact" variant="outlined" hide-details /></td>
                  <td class="turn-cell"><v-select v-model.number="action.duration" :items="durationOptions" density="compact" variant="outlined" hide-details /></td>
                  <td class="range-cell"><v-select v-model="action.effectTarget" :items="effectTargetOptions" density="compact" variant="outlined" hide-details /></td>
                  <td class="delete-cell"><v-btn icon="mdi-delete" size="small" variant="text" color="error" @click="removeEnemyAction(editingEnemySlotIndex, actionIndex)" /></td>
                </tr>
              </tbody>
            </v-table>
          </div>
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn color="primary" variant="tonal" @click="enemyDialogOpen = false">閉じる</v-btn>
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
              <div class="log-turn-title">{{ group.title }}</div>
              <div
                v-for="(entry, index) in group.entries"
                :key="`${group.title}-${index}-${entry.line}`"
                class="battle-log-row"
                :class="[entry.side, { emphasized: entry.emphasized }]"
              >
                <template v-if="entry.side === 'enemy'">
                  <div class="log-marker">
                    <div class="log-combatant enemy-combatant">{{ entry.label || '敵' }}</div>
                    <img v-if="entry.sourceElement" class="log-element-icon" :src="elementIcon(entry.sourceElement)" alt="" />
                  </div>
                  <div class="log-arrow">→</div>
                  <div class="log-bubble">{{ entry.displayLine }}</div>
                  <template v-if="entry.targetIcon || entry.targetLabel">
                    <div class="log-arrow">→</div>
                    <div class="log-marker">
                      <img v-if="entry.targetIcon" class="log-avatar" :src="entry.targetIcon" alt="" />
                      <div v-else class="log-combatant target-combatant">{{ entry.targetLabel }}</div>
                      <img v-if="entry.targetElement" class="log-element-icon" :src="elementIcon(entry.targetElement)" alt="" />
                    </div>
                  </template>
                </template>
                <template v-else-if="entry.side === 'player'">
                  <template v-if="entry.targetLabel">
                    <div class="log-marker">
                      <div class="log-combatant target-combatant">{{ entry.targetLabel }}</div>
                      <img v-if="entry.targetElement" class="log-element-icon" :src="elementIcon(entry.targetElement)" alt="" />
                    </div>
                    <div class="log-arrow">←</div>
                  </template>
                  <div class="log-bubble">{{ entry.displayLine }}</div>
                  <div class="log-arrow">←</div>
                  <div class="log-marker">
                    <img class="log-avatar" :src="entry.icon || defaultImg" alt="" />
                    <img v-if="entry.sourceElement" class="log-element-icon" :src="elementIcon(entry.sourceElement)" alt="" />
                  </div>
                </template>
                <div v-else class="log-system-line">{{ entry.displayLine }}</div>
              </div>
            </section>
          </div>
        </v-card-text>
      </v-card>
    </v-dialog>

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
import { computed, nextTick, onMounted, ref, watch } from 'vue';
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
import { examPresetDefinitions, type ExamPresetDefinition } from '@/utils/examPresets';
import { loadExamSimulatorDeckImportState } from '@/storage/simulatorStorage';

Chart.register(...registerables);

const jpNameToEnName = Object.fromEntries(
  (charactersInfo as Array<{ name_ja: string; name_en: string }>).map((character) => [character.name_ja, character.name_en]),
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
  | 'damageUp'
  | 'damageDown'
  | 'damageTakenDown'
  | 'burn'
  | 'heal'
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

interface PlayerDamageBuffTotal {
  atkBuffTotal: number;
  dmgBuffTotal: number;
  criticalChance: number;
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
}

interface DisplayTurnCombo extends TurnCombo {
  virtual?: boolean;
}

interface TurnPlan {
  turn: number;
  combos: TurnCombo[];
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
  log?: string[];
}

interface SimulationResultAggregate {
  count: number;
  retiredCount: number;
  positiveScoreCount: number;
  scoreFrequencies: Record<number, number>;
}

interface SimulationState {
  playerDamageDowns: TargetedTimedRate[];
  playerEvasions: TargetedTimedRate[];
  enemyDamageReductions: TimedRate[];
  enemyEvasions: TimedRate[];
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
}

type BattleStep =
  | { actor: 'player'; label: string; magicId: string; pairedMagicId: string; targetEnemy?: RuntimeEnemyAction; pairedEnemy?: RuntimeEnemyAction; duoActive: boolean }
  | { actor: 'enemy'; label: string; enemy?: RuntimeEnemyAction; pairedEnemy?: RuntimeEnemyAction; defendingMagicId: string; pairedDefendingMagicId: string };

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
const effectOptions: { title: string; value: EffectKind }[] = [
  { title: 'なし', value: 'none' },
  { title: 'ATKUP', value: 'atkUp' },
  { title: 'ダメージUP', value: 'damageUp' },
  { title: 'ダメージDOWN', value: 'damageDown' },
  { title: '被ダメDOWN', value: 'damageTakenDown' },
  { title: 'やけど', value: 'burn' },
  { title: '回復', value: 'heal' },
  { title: '暗闇', value: 'blind' },
  { title: '回避', value: 'evasion' },
  { title: '呪い', value: 'curse' },
  { title: '凍結', value: 'freeze' },
  { title: 'デバフ解除', value: 'debuffRemoval' },
  { title: 'バフ解除', value: 'buffRemoval' },
  { title: 'ガッツ', value: 'guts' },
];
const examPresets = computed(() => [...examPresetDefinitions]
  .sort((a, b) => b.title.localeCompare(a.title, 'ja'))
  .map((preset) => ({
    ...preset,
    apply: () => applyExamPreset(preset),
  })));
const recentExamPresets = computed(() => examPresets.value.slice(0, 2));
const SIMULATION_GRAPH_UPDATE_INTERVAL_MS = 500;
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
        title: { display: true, text: '回数' },
        grid: { drawOnChartArea: true },
      },
      percentage: {
        type: 'linear' as const,
        position: 'right' as const,
        min: yRange.min,
        max: yRange.max,
        title: { display: true, text: '達成確率' },
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
              const thresholdText = threshold !== undefined ? `${formatNumber(threshold)}以上` : context.label;
              return `達成確率 (${thresholdText}): ${formatPercentage(context.parsed.y)}%`;
            }
            return `回数: ${formatNumber(context.parsed.y)}`;
          },
        },
      },
    },
  };
});

let nextId = 0;
function makeId(prefix: string) {
  nextId += 1;
  return `${prefix}-${nextId}`;
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
const turnPlans = ref<TurnPlan[]>(Array.from({ length: 5 }, (_, index) => ({
  turn: index + 1,
  combos: [createTurnCombo('', '', true)],
})));
const openedTurnPanels = ref<number[]>([0, 1, 2, 3, 4]);
const iterations = ref(10000);
const seed = ref(-1);
const isRunning = ref(false);
const simulationAggregate = ref<SimulationResultAggregate | null>(null);
const bestSimulationResult = ref<SimulationStats | null>(null);
const imageCache = ref<Record<string, string>>({});
const duoIconCache = ref<Record<string, string>>({});
const characterDialogOpen = ref(false);
const selectingDeckIndex = ref(0);
const deckDetailDialogOpen = ref(false);
const editingDeckIndex = ref(0);
const editingDeckDetailCharacter = ref<any | null>(null);
const draggingMagicId = ref('');
const activeTab = ref<ActiveTab>('exam');
const activeTurnIndex = ref(0);
const activeComboIndex = ref(0);
const activeComboSlot = ref<ComboSlotKey>('firstMagicId');
const magicPickerOpen = ref(false);
const enemyDialogOpen = ref(false);
const editingEnemySlotIndex = ref(0);
const logDialogOpen = ref(false);
const enemyConditionsTouched = ref(false);
const runAttemptWarning = ref('');

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

interface ValidationIssue {
  tab: ActiveTab;
  message: string;
}

const validationIssues = computed<ValidationIssue[]>(() => {
  const issues: ValidationIssue[] = [];
  if (selectedCharacters.value.length !== 5) issues.push({ tab: 'deck', message: '5枚のカードを選択してください。' });
  if (enemyActionPool().length === 0) issues.push({ tab: 'exam', message: '敵行動を1つ以上入力してください。' });
  if (totalDeckHp.value <= 0) issues.push({ tab: 'deck', message: 'デッキHPを計算できません。' });
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
        label: '回数',
        data: bucketData.buckets,
        yAxisID: 'count',
        backgroundColor: '#4f7cac',
        borderColor: '#254f72',
        borderWidth: 1,
        order: 2,
      },
      {
        type: 'line' as const,
        label: '達成確率',
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
  if (!bestResult.value) return '最高スコアログ';
  const suffix = bestResult.value.retired ? ` / リタイア: ${bestResult.value.retireReason}` : '';
  return `最高スコアログ: ${formatNumber(bestResult.value.score)}${suffix}`;
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

function markEnemyConditionsTouched() {
  enemyConditionsTouched.value = true;
  runAttemptWarning.value = '';
}

function syncTurnPlans(turnCount: number) {
  const normalized = Math.min(10, Math.max(1, Math.floor(safeNumber(turnCount) || 1)));
  while (turnPlans.value.length < normalized) {
    turnPlans.value.push({ turn: turnPlans.value.length + 1, combos: [createTurnCombo('', '', true)] });
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
  void restoreDeckFromSimulatorImport();
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

function createTurnCombo(firstMagicId = '', secondMagicId = '', autoGenerated = false): TurnCombo {
  return {
    id: makeId('turn-combo'),
    firstMagicId,
    secondMagicId,
    autoGenerated,
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

function copyPreviousTurnCombos() {
  const currentIndex = activeTurnIndex.value;
  const currentTurn = turnPlans.value[currentIndex];
  const previousTurn = turnPlans.value[currentIndex - 1];
  if (!currentTurn || !previousTurn) return;
  if (magicPickerOpen.value) magicPickerOpen.value = false;
  currentTurn.combos = previousTurn.combos.map((combo) => createTurnCombo(combo.firstMagicId, combo.secondMagicId));
  if (!currentTurn.combos.length) currentTurn.combos = [createTurnCombo()];
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
      nextCombos.push(createTurnCombo(firstMagicId, secondMagicId));
      existingPairs.add(key);
    });
  });

  turn.combos = nextCombos.length ? nextCombos : [createTurnCombo()];
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

function moveCombo(turnIndex: number, comboIndex: number, direction: -1 | 1) {
  const combos = turnPlans.value[turnIndex]?.combos;
  if (!combos) return;
  const nextIndex = comboIndex + direction;
  if (nextIndex < 0 || nextIndex >= combos.length) return;
  [combos[comboIndex], combos[nextIndex]] = [combos[nextIndex], combos[comboIndex]];
  if (turnIndex === activeTurnIndex.value && activeComboIndex.value === comboIndex) {
    activeComboIndex.value = nextIndex;
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
    turn.combos.push(createTurnCombo());
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
  const processed = await processCharacterSelection({ ...character }, undefined, true) as Character;
  await setDeckCharacter(selectingDeckIndex.value, processed);
  resetDefaultCombos();
  closeCharacterDialog();
}

async function setDeckCharacter(index: number, character: Character) {
  const totsu = 4;
  const normalized = {
    ...character,
    level: getStatScalingMaxLevel(character.rare),
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
    level: getStatScalingMaxLevel(normalized.rare),
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
}

function normalizeDeckLevel(index: number) {
  const slot = deck.value[index];
  if (!slot.character) return;
  slot.level = Math.min(maxCardLevel(slot), Math.max(1, Math.floor(safeNumber(slot.level) || 1)));
  recalculateDeckStats(index);
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
        turn.combos = [createTurnCombo('', '', true)];
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
      turn.combos = [createTurnCombo(first, second, true)];
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
    if (!turn.combos.length) turn.combos = [createTurnCombo()];
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
  return magicId ? magicMap.value[magicId] : undefined;
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

function parseMagicId(id: string) {
  const match = id.match(/^(\d+)-M([123])$/);
  if (!match) return null;
  return {
    deckIndex: Number(match[1]),
    magicSlot: Number(match[2]) as MagicSlot,
  };
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
  };
  return runtime;
}

function buildRuntimeBuffs(runtime: any) {
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
      resolve();
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
    runAttemptWarning.value = '敵条件が初期状態のままです。過去分から選択するか、敵条件を入力してください。';
    activeTab.value = 'exam';
    return;
  }
  runAttemptWarning.value = '';
  isRunning.value = true;
  activeTab.value = 'result';
  logDialogOpen.value = false;
  simulationAggregate.value = null;
  bestSimulationResult.value = null;
  await waitForSimulationPaint();
  try {
    const count = Math.min(100000, Math.max(1, Math.floor(safeNumber(iterations.value) || 1)));
    const scoreFrequencies: Record<number, number> = {};
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
      };
    };
    for (let i = 0; i < count; i += 1) {
      const seedText = createIterationSeed(i);
      const result = runOneSimulation(createRng(seedText), false);
      completed += 1;
      if (result.retired) retiredCount += 1;
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
  } finally {
    isRunning.value = false;
  }
}

function clearResults() {
  simulationAggregate.value = null;
  bestSimulationResult.value = null;
}

function runOneSimulation(rng: () => number, keepLog: boolean): SimulationStats {
  const turnLimit = maxTurnCount.value;
  const enemyDeck = buildEnemyActionDeck(rng, turnLimit * 2);
  let handState = createHandCycle(rng);
  const state: SimulationState = {
    playerDamageDowns: [],
    playerEvasions: [],
    enemyDamageReductions: [],
    enemyEvasions: [],
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
  };
  const stats: SimulationStats = {
    score: 0,
    retired: false,
    retireReason: '',
    playerDamage: 0,
    enemyDamage: 0,
    enemyHeal: 0,
    playerHeal: 0,
    burnDamage: 0,
    playerRemainHp: totalDeckHp.value,
    playerTotalHp: totalDeckHp.value,
    enemyRemainHp: safeNumber(exam.value.enemyHp),
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
    log: keepLog ? [] : undefined,
  };

  let playerHp = totalDeckHp.value;
  let enemyHp = safeNumber(exam.value.enemyHp);
  const enemyMaxHp = safeNumber(exam.value.enemyHp);
  activateInitialBuddyEffects(state);
  pushLog(stats, `開始: 自分HP ${formatNumber(playerHp)} / 敵HP ${formatNumber(enemyHp)} / ${exam.value.kind}`);

  battleLoop:
  for (let turnIndex = 0; turnIndex < turnLimit; turnIndex += 1) {
    if (handState.visible.length < 2 && handState.hidden.length === 0) {
      if (turnIndex >= 5) {
        handState = createHandCycle(rng);
        pushLog(stats, `${turnIndex + 1}T 手札再配布`);
      } else {
        stats.finishTurn = turnIndex + 1;
        retire(stats, `${turnIndex + 1}T 使用可能な手札が2枚未満`);
        break;
      }
    }
    const firstEnemy = enemyDeck[turnIndex * 2];
    const secondEnemy = enemyDeck[turnIndex * 2 + 1];
    const selected = choosePlayerPair(turnIndex, handState.visible, stats);
    if (!selected) {
      stats.finishTurn = turnIndex + 1;
      retire(stats, `${turnIndex + 1}T 許容組み合わせなし`);
      break;
    }
    consumeHand(handState, selected);
    const steps = buildTurnSteps(turnIndex, selected, firstEnemy, secondEnemy);

    for (const step of steps) {
      if (step.actor === 'player') {
        const playerHpBeforeHeal = playerHp;
        activatePlayerMagicBuffs(step.magicId, step.pairedMagicId, state, stats, turnIndex + 1, step.label);
        activatePlayerContinueHeal(step.magicId, step.pairedMagicId, state, stats);
        activatePlayerOpponentDebuffs(step.magicId, step.targetEnemy, step.pairedEnemy, state, rng, stats, turnIndex + 1, step.label);
        const heal = calculatePlayerHeal(step.magicId, state);
        if (heal > 0) {
          playerHp = Math.min(totalDeckHp.value, playerHp + heal);
          const actualHeal = Math.max(0, playerHp - playerHpBeforeHeal);
          if (actualHeal > 0) {
            stats.playerHeal += actualHeal;
            pushLog(stats, `${turnIndex + 1}T ${step.label} 自分回復 ${describeMagic(step.magicId)} ${formatNumber(playerHpBeforeHeal)}→${formatNumber(playerHp)} (+${formatNumber(actualHeal)})`);
          }
        }
      } else {
        const enemyEffectFrozen = !!step.enemy
          && isEnemySideTarget(step.enemy.effectTarget)
          && isEnemyFrozen(state, step.enemy.slotKey)
          && isEnemyFreezeBlockedEffectKind(step.enemy.effectKind);
        let appliedEnemyHeal = 0;
        if (!enemyEffectFrozen) {
          appliedEnemyHeal = applyEnemySelfEffects(step.enemy, state, enemyHp, enemyMaxHp, stats, step.pairedEnemy);
          if (appliedEnemyHeal > 0) {
            enemyHp = Math.min(enemyMaxHp, enemyHp + appliedEnemyHeal);
            stats.enemyHeal += appliedEnemyHeal;
          }
          applyEnemyAdditionalEffects(step.enemy, step.defendingMagicId, step.pairedDefendingMagicId, state, rng, stats, step.pairedEnemy);
        }
        if (step.enemy?.effectKind && step.enemy.effectKind !== 'none') {
          pushLog(stats, `${turnIndex + 1}T ${step.label} 相手効果 ${describeEnemyAction(step.enemy)}${describeEnemyEffectTarget(step.enemy, step.defendingMagicId, step.pairedDefendingMagicId)} / ${describeEnemyEffect(step.enemy)}${enemyEffectFrozen ? ' / 凍結無効化' : ''}${appliedEnemyHeal > 0 ? ` / 敵回復${formatNumber(appliedEnemyHeal)}` : ''}`);
        }
      }
    }

    for (const step of steps) {
      if (step.actor === 'player') {
        const enemyHpBeforePhase = enemyHp;
        const targetElement = resolveTargetElement(step.targetEnemy);
        const playerAttack = calculatePlayerDamage(step.magicId, targetElement, state, rng, stats, step.duoActive, step.targetEnemy);
        enemyHp = Math.max(0, enemyHp - playerAttack.damage);
        const gutsResult = applyEnemyGutsIfNeeded(state, enemyHp, stats, step.targetEnemy?.slotKey);
        enemyHp = gutsResult.hp;
        stats.playerDamage += playerAttack.damage;
        incrementCompatibilityStats(stats, playerAttack.compatibility, playerAttack.hitCount);
        if (playerAttack.isDuo) stats.duo += 1;

        const playerSpecialText = describePlayerAttackSpecials(playerAttack);
        pushLog(stats, `${turnIndex + 1}T ${step.label} 自分 ${describeMagic(step.magicId, step.duoActive)} -> ${describeEnemyTarget(step.targetEnemy)}:${targetElement} 与${formatNumber(playerAttack.damage)}${playerAttack.isDuo ? ' DUO' : ''}${playerSpecialText}${gutsResult.used ? ' / ガッツ' : ''} / 敵HP ${formatNumber(enemyHpBeforePhase)}→${formatNumber(enemyHp)}`);
        if (enemyHp <= 0) {
          stats.finishTurn = turnIndex + 1;
          break battleLoop;
        }
      } else {
        const playerHpBeforeEnemy = playerHp;
        const incoming = calculateEnemyDamage(step.enemy, step.defendingMagicId, state, rng, stats);
        playerHp = Math.max(0, playerHp - incoming.damage);
        const playerGutsResult = applyPlayerGutsIfNeeded(state, playerHp, step.defendingMagicId);
        playerHp = playerGutsResult.hp;
        stats.enemyDamage += incoming.damage;
        if (incoming.defenceCompatibility === 'advantage') stats.advantageDamaged += incoming.damage;
        if (incoming.defenceCompatibility === 'disadvantage') stats.disadvantageDamaged += incoming.damage;
        const hitText = incoming.hitDamages.length > 1 ? ` [${incoming.hitDamages.map(formatNumber).join('+')}]` : '';
        const evasionText = incoming.evasionCount > 0 ? ` / 回避成功${incoming.evasionCount}回` : '';
        const blindText = incoming.blindMiss ? ' / 暗闇MISS1回' : '';
        const modifierText = describeEnemyDamageModifiers(incoming.atkRate, incoming.damageRate);
        pushLog(stats, `${turnIndex + 1}T ${step.label} 相手 ${describeEnemyAction(step.enemy)} -> ${describeMagic(step.defendingMagicId)} 受け${incoming.defenderElement} 被${formatNumber(incoming.damage)}${hitText}${evasionText}${blindText}${modifierText}${playerGutsResult.used ? ' / ガッツ' : ''} / 逆算ATK${formatNumber(incoming.baseAtk)} / 等倍${formatNumber(incoming.equalDamage)} / 自HP ${formatNumber(playerHpBeforeEnemy)}→${formatNumber(playerHp)}`);
        if (playerHp <= 0) {
          stats.finishTurn = turnIndex + 1;
          retire(stats, `${turnIndex + 1}T ${step.label} 被ダメージで自HP0`);
          break battleLoop;
        }
      }
    }

    const burnDamage = applyBurnDamage(state, playerHp);
    if (burnDamage > 0) {
      playerHp -= burnDamage;
      stats.burnDamage += burnDamage;
      pushLog(stats, `${turnIndex + 1}T やけど: ${burnDamage}`);
    }
    const continueHeal = applyPlayerContinueHeal(state, playerHp);
    if (continueHeal.total > 0) {
      playerHp = Math.min(totalDeckHp.value, playerHp + continueHeal.total);
      stats.playerHeal += continueHeal.total;
      continueHeal.details
        .filter((detail) => detail.amount > 0)
        .forEach((detail) => {
          const cappedText = detail.capped ? ` / 上限前${formatNumber(detail.potentialAmount)}` : '';
          pushLog(stats, `${turnIndex + 1}T 継続回復 ${detail.source}: +${formatNumber(detail.amount)}${cappedText}`);
        });
    }
    tickTimedEffects(state);
    stats.finishTurn = turnIndex + 1;
    pushLog(stats, `${turnIndex + 1}T 終了: 自HP ${formatNumber(playerHp)} / 敵HP ${formatNumber(enemyHp)}`);
    if (enemyHp <= 0) break;
  }

  stats.playerRemainHp = playerHp;
  stats.enemyRemainHp = enemyHp;
  stats.score = stats.retired ? 0 : calculateScore(stats);
  pushLog(stats, `結果: スコア ${formatNumber(stats.score)}${stats.retired ? ` / リタイア ${stats.retireReason}` : ''}`);
  pushScoreBreakdownLog(stats);
  return stats;
}

function createHandCycle(rng: () => number) {
  const shuffled = shuffle(handMagicIds.value, rng);
  return {
    visible: shuffled.slice(0, 5),
    hidden: shuffled.slice(5),
  };
}

function choosePlayerPair(turnIndex: number, visible: string[], stats: SimulationStats): [string, string] | null {
  const combos = turnPlans.value[turnIndex]?.combos ?? [];
  const visibleSet = new Set(visible);
  const matched = combos.find((combo) => (
    combo.firstMagicId
    && combo.secondMagicId
    && combo.firstMagicId !== combo.secondMagicId
    && visibleSet.has(combo.firstMagicId)
    && visibleSet.has(combo.secondMagicId)
  ));
  if (matched) return [matched.firstMagicId, matched.secondMagicId];
  stats.fallback += 1;
  pushLog(stats, `${turnIndex + 1}T 許容外のみ: ${visible.map((magicId) => describeMagic(magicId)).join(' / ')}`);
  return null;
}

function consumeHand(handState: { visible: string[]; hidden: string[] }, selected: [string, string]) {
  const selectedSet = new Set(selected);
  handState.visible = handState.visible.filter((id) => !selectedSet.has(id));
  while (handState.visible.length < 5 && handState.hidden.length > 0) {
    const next = handState.hidden.shift();
    if (next) handState.visible.push(next);
  }
}

function isPlayerFirstTurn(turnIndex: number) {
  if (exam.value.kind === 'ATTACK' && turnIndex >= 5) return false;
  return turnIndex % 2 === 0;
}

function buildTurnSteps(
  turnIndex: number,
  selected: [string, string],
  firstEnemy: RuntimeEnemyAction | undefined,
  secondEnemy: RuntimeEnemyAction | undefined,
): BattleStep[] {
  const duoFirst = isDuoActiveForPair(selected[0], selected[1]);
  const duoSecond = isDuoActiveForPair(selected[1], selected[0]);
  if (isPlayerFirstTurn(turnIndex)) {
    return [
      { actor: 'player', label: '先手', magicId: selected[0], pairedMagicId: selected[1], targetEnemy: firstEnemy, pairedEnemy: secondEnemy, duoActive: duoFirst },
      { actor: 'enemy', label: '先手', enemy: firstEnemy, pairedEnemy: secondEnemy, defendingMagicId: selected[0], pairedDefendingMagicId: selected[1] },
      { actor: 'player', label: '後手', magicId: selected[1], pairedMagicId: selected[0], targetEnemy: secondEnemy, pairedEnemy: firstEnemy, duoActive: duoSecond },
      { actor: 'enemy', label: '後手', enemy: secondEnemy, pairedEnemy: firstEnemy, defendingMagicId: selected[1], pairedDefendingMagicId: selected[0] },
    ];
  }
  return [
    { actor: 'enemy', label: '先手', enemy: firstEnemy, pairedEnemy: secondEnemy, defendingMagicId: selected[0], pairedDefendingMagicId: selected[1] },
    { actor: 'player', label: '先手', magicId: selected[0], pairedMagicId: selected[1], targetEnemy: firstEnemy, pairedEnemy: secondEnemy, duoActive: duoFirst },
    { actor: 'enemy', label: '後手', enemy: secondEnemy, pairedEnemy: firstEnemy, defendingMagicId: selected[1], pairedDefendingMagicId: selected[0] },
    { actor: 'player', label: '後手', magicId: selected[1], pairedMagicId: selected[0], targetEnemy: secondEnemy, pairedEnemy: firstEnemy, duoActive: duoSecond },
  ];
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
        state.playerContinueHeals.push({
          cardIndex: deckIndex,
          rate: buddyContinueHealRate,
          turns: buddyInitialEffectTurns,
          source: `${describeDeckCard(deckIndex)} ${buff.status}`,
          isBuddyGenerated: true,
        });
        return;
      }
      state.playerBuffs.push({
        targetDeckIndex: deckIndex,
        buff: { ...buff },
        turns: buddyInitialEffectTurns,
        source: buff.status,
      });
    });

    getRuntimeBuddyAdditionalEffects(runtime).forEach(({ effect }) => {
      const evasionMatch = effect.match(/^回避\((.+)\)$/);
      if (evasionMatch) {
        const rate = safeNumber(evasionRateByPower[evasionMatch[1]]) || 0;
        if (rate > 0) {
          state.playerEvasions.push({
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
          state.playerDamageTakenDowns.push({
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
          state.playerDamageTakenDowns.push({
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
        state.playerImmunities.push({
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
  const parsed = parseMagicId(magicId);
  const paired = parseMagicId(pairedMagicId);
  if (!parsed || !paired || parsed.magicSlot !== 2) return false;
  const source = deck.value[parsed.deckIndex]?.character;
  const partner = deck.value[paired.deckIndex]?.character;
  return !!source?.duo && !!partner && partner.chara === source.duo;
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
  const effects = getAutomaticMagicBuffs(parsed.deckIndex, parsed.magicSlot);
  if (!effects.length) return;
  const paired = parseMagicId(pairedMagicId);
  effects.forEach((buff) => {
    if (isPlayerFrozen(state, parsed.deckIndex) && isFreezeBlockedPlayerSideEffect(buff)) {
      pushLog(stats, `${turnNumber}T ${timingLabel} 自分効果 ${describeMagic(magicId)} / ${describePlayerBuff(buff, parsedRateFromBuff(buff), Math.max(1, Math.floor(safeNumber(buff.durationTurns) || 1)))} / 凍結無効化`);
      return;
    }
    const targets = resolvePlayerBuffTargets(buff, parsed.deckIndex, paired?.deckIndex);
    let appliedForAttackScore = false;
    let appliedForDefenceScore = false;
    let appliedForEvasionScore = false;
    let applied = false;
    let effectText = '';
    targets.forEach((targetDeckIndex) => {
      const duration = Math.max(1, Math.floor(safeNumber(buff.durationTurns) || 1));
      if (buff.buffOption === 'デバフ解除') {
        removePlayerNegativeEffects(state, [targetDeckIndex]);
        applied = true;
        effectText = describePlayerBuff(buff, 0, duration);
        return;
      }
      if (buff.buffOption === 'バフ解除') {
        removePlayerPositiveEffects(state, [targetDeckIndex]);
        applied = true;
        effectText = describePlayerBuff(buff, 0, duration);
        return;
      }
      const immunityKind = playerImmunityKindFromBuff(buff);
      if (immunityKind) {
        state.playerImmunities.push({
          cardIndex: targetDeckIndex,
          kind: immunityKind,
          turns: duration,
          source: describeMagic(magicId),
        });
        applied = true;
        effectText = describePlayerBuff(buff, 0, duration);
        return;
      }
      if (buff.buffOption === '回避') {
        const rate = evasionRateFromParsedBuff(buff);
        if (rate <= 0) return;
        state.playerEvasions.push({
          cardIndex: targetDeckIndex,
          rate,
          turns: duration,
        });
        appliedForEvasionScore = true;
        applied = true;
        effectText = describePlayerBuff(buff, rate, duration);
        return;
      }
      if (isPlayerDamageTakenDownBuff(buff)) {
        const rate = playerDamageTakenDownRateFromParsedBuff(buff);
        if (rate <= 0) return;
        state.playerDamageTakenDowns.push({
          cardIndex: targetDeckIndex,
          rate,
          turns: duration,
          attributeOption: buff.buffOption === '属性被ダメージDOWN' ? buff.attributeOption : undefined,
        });
        appliedForDefenceScore = true;
        applied = true;
        effectText = describePlayerBuff(buff, rate, duration);
        return;
      }
      if (isPlayerDamageTakenUpBuff(buff)) {
        const rate = playerDamageTakenUpRateFromParsedBuff(buff);
        if (rate <= 0) return;
        state.playerDamageTakenUps.push({
          cardIndex: targetDeckIndex,
          rate,
          turns: duration,
          attributeOption: buff.buffOption === '属性被ダメージUP' ? buff.attributeOption : undefined,
        });
        applied = true;
        effectText = describePlayerBuff(buff, rate, duration);
        return;
      }
      if (buff.buffOption === 'ガッツ') {
        state.playerGuts.push({
          cardIndex: targetDeckIndex,
          count: normalizePlayerGutsCount(buff),
          turns: duration,
          source: describeMagic(magicId),
        });
        applied = true;
        effectText = describePlayerBuff(buff, 0, duration);
        return;
      }
      state.playerBuffs.push({
        targetDeckIndex,
        buff: { ...buff },
        turns: duration,
      });
      if (isAttackScoreBuff(buff)) appliedForAttackScore = true;
      applied = true;
      effectText = describePlayerBuff(buff, parsedRateFromBuff(buff), duration);
    });
    if (applied) {
      pushLog(stats, `${turnNumber}T ${timingLabel} 自分効果 ${describeMagic(magicId)} -> ${describePlayerBuffTarget(buff, targets)} / ${effectText}`);
    }
    if (appliedForAttackScore) {
      stats.scoreBuff += 1;
    }
    if (appliedForEvasionScore) {
      stats.evasion += 1;
    }
    if (appliedForDefenceScore) {
      stats.debuff += 1;
    }
  });
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
  const slot = deck.value[deckIndex];
  if (!slot?.character) return [];
  const levelOption = safeNumber(slot.magicLevels[magicSlot]) || 10;
  const customEffectText = String(slot.magicEffects[magicSlot] || '').trim();
  const source = customEffectText
    ? { etc: customEffectText.includes(`(M${magicSlot})`) ? customEffectText : `${customEffectText}(M${magicSlot})` }
    : { etc: slot.character.etc || '' };
  return parseMagicBuffsFromEtc(source, { allowM3: true })
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
}

function getAutomaticOpponentDebuffs(deckIndex: number, magicSlot: MagicSlot): ParsedBuff[] {
  const slot = deck.value[deckIndex];
  if (!slot?.character) return [];
  const levelOption = safeNumber(slot.magicLevels[magicSlot]) || 10;
  const customEffectText = String(slot.magicEffects[magicSlot] || '').trim();
  const source = customEffectText
    ? { etc: customEffectText.includes(`(M${magicSlot})`) ? customEffectText : `${customEffectText}(M${magicSlot})` }
    : { etc: slot.character.etc || '' };
  return parseMagicBuffsFromEtc(source, { allowM3: true })
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
      pushLog(stats, `${turnNumber}T ${timingLabel} 自分効果 ${describeMagic(magicId)} -> ${describePlayerOpponentDebuffTarget(buff, targetEnemy, pairedEnemy)} / ${describePlayerOpponentDebuff(buff, rate, duration)} / 凍結無効化`);
      return;
    }
    if (rate <= 0 && !['デバフ解除', 'バフ解除', 'ガッツ'].includes(buff.buffOption)) return;
    const targetEnemySlotKeys = resolvePlayerOpponentDebuffTargets(buff, targetEnemy, pairedEnemy);
    let appliedForDefenceScore = false;
    let appliedAny = false;
    targetEnemySlotKeys.forEach((targetEnemySlotKey) => {
      if (buff.buffOption === 'ATKDOWN') {
        state.enemyAttackDowns.push({ rate, turns: duration, targetEnemySlotKey });
        appliedForDefenceScore = true;
        appliedAny = true;
        return;
      }
      if (buff.buffOption === 'ATKUP') {
        state.enemyAttackUps.push({ rate, turns: duration, targetEnemySlotKey });
        appliedAny = true;
        return;
      }
      if (buff.buffOption === 'ダメージUP' || buff.buffOption === '属性ダメUP') {
        state.enemyDamageUps.push({
          rate,
          turns: duration,
          attributeOption: buff.buffOption === '属性ダメUP' ? buff.attributeOption : undefined,
          targetEnemySlotKey,
        });
        appliedAny = true;
        return;
      }
      if (buff.buffOption === 'ダメージDOWN' || buff.buffOption === '属性ダメDOWN') {
        state.enemyDamageDowns.push({
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
        state.enemyDamageTakenUps.push({
          rate,
          turns: duration,
          attributeOption: buff.buffOption === '属性被ダメージUP' ? buff.attributeOption : undefined,
          targetEnemySlotKey,
        });
        appliedAny = true;
        return;
      }
      if (isEnemyDamageTakenDownBuff(buff)) {
        state.enemyDamageReductions.push({
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
          state.enemyCurses.push({ rate: 100, turns: duration, targetEnemySlotKey });
          stats.healBlock = Math.max(stats.healBlock, 1);
          appliedAny = true;
        }
        return;
      }
      if (buff.buffOption === '暗闇') {
        state.enemyBlinds.push({ rate, turns: duration, targetEnemySlotKey });
        appliedAny = true;
        return;
      }
      if (buff.buffOption === '凍結') {
        const success = rollEffect(rate, rng);
        if (success) {
          state.enemyFreezes.push({ rate: 100, turns: duration, targetEnemySlotKey });
          appliedAny = true;
        }
        return;
      }
      if (buff.buffOption === '回避') {
        state.enemyEvasions.push({ rate, turns: duration, targetEnemySlotKey });
        appliedAny = true;
        return;
      }
      if (buff.buffOption === 'ガッツ') {
        state.enemyGuts.push({ count: normalizePlayerGutsCount(buff), turns: duration, targetEnemySlotKey });
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
    if (appliedForDefenceScore) stats.debuff += 1;
    if (appliedAny) {
      pushLog(stats, `${turnNumber}T ${timingLabel} 自分効果 ${describeMagic(magicId)} -> ${describePlayerOpponentDebuffTarget(buff, targetEnemy, pairedEnemy)} / ${describePlayerOpponentDebuff(buff, rate, duration)}`);
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

function activeBuffsForMagic(state: SimulationState, deckIndex: number, magicSlot: MagicSlot): ParsedBuff[] {
  const currentMagicOption = `M${magicSlot}` as ParsedBuff['magicOption'];
  return state.playerBuffs
    .filter((entry) => entry.targetDeckIndex === deckIndex && entry.turns > 0)
    .filter((entry) => !entry.buff?.isBuddyGenerated || entry.buff.magicOption === currentMagicOption)
    .map((entry) => ({
      ...entry.buff,
      magicOption: currentMagicOption,
    }));
}

function calculatePlayerDamageBase(runtime: any, magicSlot: MagicSlot, targetElement: ActionElement, reductionRate: number) {
  const components = calculatePlayerDamageComponents(runtime, magicSlot);
  const reductionValue = reductionRate / 100;
  const damageTermAfterReduction = Math.max(0, components.damageTerm - reductionValue);
  const beforeReductionDamage = components.baseAtk
    * components.damageTerm
    * components.rengekiMultiplier
    * playerAttributeMultiplier(components.magicAttribute, targetElement);
  const damage = components.baseAtk
    * damageTermAfterReduction
    * components.rengekiMultiplier
    * playerAttributeMultiplier(components.magicAttribute, targetElement);
  return {
    ...components,
    reductionValue,
    damageTermAfterReduction,
    beforeReductionDamage,
    damage,
  };
}

function calculatePlayerDamageComponents(runtime: any, magicSlot: MagicSlot) {
  const magicKey = `magic${magicSlot}`;
  const magicAttribute = normalizeElement(runtime[`${magicKey}Attribute`]);
  const power = runtime[`${magicKey}Power`] || '単発(弱)';
  const adjustedPower = power === 'デュオ' ? 'デュオ魔法' : power;
  const level = Math.min(10, Math.max(1, Math.floor(safeNumber(runtime[`${magicKey}Lv`]) || 1)));
  const magicRatio = safeNumber(magicDict[`${adjustedPower}Lv${level}`]) || 1;
  const attributeAdjust = magicAttribute === '無' ? 1.1 : 1;
  const buffTotals = playerDamageBuffTotals(runtime, magicSlot, magicAttribute);
  const buddyAtk = calculateRuntimeBuddyAtk(runtime);
  const baseAtk = safeNumber(runtime.atk) + buffTotals.atkBuffTotal + buddyAtk;
  const damageTerm = Math.max(0, magicRatio * attributeAdjust + buffTotals.dmgBuffTotal);
  return {
    magicAttribute,
    adjustedPower,
    level,
    magicRatio,
    attributeAdjust,
    buddyAtk,
    baseAtk,
    atkBuffTotal: buffTotals.atkBuffTotal,
    dmgBuffTotal: buffTotals.dmgBuffTotal,
    criticalChance: buffTotals.criticalChance,
    damageTerm,
    rengekiMultiplier: playerRengekiMultiplier(adjustedPower),
  };
}

function playerDamageBuffTotals(runtime: any, magicSlot: MagicSlot, magicAttribute: ActionElement) {
  const magicOption = `M${magicSlot}`;
  return getRuntimePlayerBuffs(runtime).reduce<PlayerDamageBuffTotal>((total, buff: any) => {
    if (buff.magicOption !== magicOption) return total;
    const buffType = buff.buffOption;
    const powerType = buff.powerOption;
    const level = Math.min(10, Math.max(1, Math.floor(safeNumber(buff.levelOption) || 10)));
    if (buffType === 'ATKUP' || buffType === 'ATKDOWN') {
      total.atkBuffTotal += safeNumber(atkbuffDict[`${buffType}(${powerType})${level}`]) * safeNumber(runtime.atk);
      return total;
    }
    if (['ダメージUP', '属性ダメUP', 'ダメージDOWN', '属性ダメDOWN'].includes(buffType)) {
      if ((buffType === '属性ダメUP' || buffType === '属性ダメDOWN') && buff.attributeOption && buff.attributeOption !== magicAttribute) {
        return total;
      }
      const prefix = buffType === 'ダメージUP'
        ? 'ダメUP'
        : buffType === 'ダメージDOWN'
          ? 'ダメDOWN'
          : buffType === '属性ダメUP'
            ? '属性ダメUP'
            : '属性ダメDOWN';
      total.dmgBuffTotal += safeNumber(dmgbuffDict[`${prefix}(${powerType})${level}`]);
      return total;
    }
    if (buffType === 'クリティカル') {
      total.criticalChance = Math.max(total.criticalChance, criticalChanceFromPower(powerType));
    }
    return total;
  }, { atkBuffTotal: 0, dmgBuffTotal: 0, criticalChance: 0 });
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

function getRuntimePlayerBuffs(runtime: any): any[] {
  return Array.isArray(runtime.buffs) ? runtime.buffs.map((buff: any) => ({ ...buff })) : [];
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
  const totsu = runtime?.totsu ?? (runtime?.isBonusSelected ? 4 : 0);
  return [1, 2, 3].reduce((total, buddyIndex) => {
    const buddyName = runtime?.[`buddy${buddyIndex}c`];
    if (!buddyName || !(buddyName in charaDict.value)) return total;
    const status = getBuddyStatusForCharacter(runtime, buddyIndex, { totsu, isActive: true });
    return total + safeNumber(runtime.atk) * getBuddyAtkRate(status, safeNumber(runtime[`buddy${buddyIndex}Lv`]) || 10);
  }, 0);
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
  const runtime = buildRuntimeCharacter(parsed.deckIndex);
  if (!runtime) return;
  const buffs = buildRuntimeBuffs(runtime).filter((buff) => (
    buff.magicOption === `M${parsed.magicSlot}` && buff.buffOption === '継続回復'
  ));
  if (!buffs.length) return;
  if (isPlayerFrozen(state, parsed.deckIndex)) {
    pushLog(stats, `${describeMagic(magicId)} 継続回復凍結`);
    return;
  }
  const paired = parseMagicId(pairedMagicId);
  buffs.forEach((buff) => {
    const level = Math.min(10, Math.max(1, Math.floor(safeNumber(buff.levelOption) || 10)));
    const rate = safeNumber(healContinueDict[`継続回復(${buff.powerOption})${level}`]);
    if (rate <= 0) return;
    const duration = Math.max(1, Math.floor(safeNumber(buff.durationTurns) || 3));
    const targets = resolvePlayerBuffTargets(buff, parsed.deckIndex, paired?.deckIndex);
    targets.forEach((cardIndex) => {
      state.playerContinueHeals.push({
        cardIndex,
        rate,
        turns: duration,
        source: describeMagic(magicId),
      });
    });
  });
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
  const runtime = buildRuntimeCharacter(parsed.deckIndex, activeBuffsForMagic(state, parsed.deckIndex, parsed.magicSlot));
  if (!runtime) {
    return { damage: 0, compatibility: 'equal' as ScoreCompatibility, hitCount: 1, isDuo: false, evasionCount: 0, blindMiss: false, criticalCount: 0 };
  }
  if (duoActive) runtime.magic2Power = 'デュオ';
  const compatibility = getCompatibility(magic.element, targetElement);
  const power = duoActive && parsed.magicSlot === 2 ? 'デュオ' : magic.power;
  const hitCount = magicHitCount(power);
  const isDuo = parsed.magicSlot === 2 && duoActive;
  const targetEnemySlotKey = targetEnemy?.slotKey ?? '';
  const blindRate = isPlayerImmune(state, parsed.deckIndex, 'blind')
    ? 0
    : Math.min(1, sumRatesForCard(state.playerBlinds, parsed.deckIndex) / 100);
  const enemyReductionRate = sumDamageRatesForElementAndEnemy(state.enemyDamageReductions, magic.element, targetEnemySlotKey);
  const enemyDamageTakenUpRate = sumDamageRatesForElementAndEnemy(state.enemyDamageTakenUps, magic.element, targetEnemySlotKey);
  const enemyEvasionRate = Math.min(1, sumRatesForEnemy(state.enemyEvasions, targetEnemySlotKey) / 100);
  const reductionRate = Math.min(100, sumDamageDownRatesForCard(state.playerDamageDowns, parsed.deckIndex, magic.element) + enemyReductionRate - enemyDamageTakenUpRate);
  const damageBase = calculatePlayerDamageBase(runtime, parsed.magicSlot, targetElement, reductionRate);
  const baseDamage = damageBase.damage;
  if (blindRate > 0) {
    const blindRoll = rng();
    if (blindRoll < blindRate) {
      stats.miss += 1;
      return { damage: 0, compatibility, hitCount, isDuo, evasionCount: 0, blindMiss: true, criticalCount: 0 };
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
    const random = nextDamageFactor(rng);
    const raw = (baseDamage * criticalMultiplier / hitCount) * random.factor;
    const hitDamage = ceilDamage(raw);
    if (criticalActive && hitDamage > 0) criticalCount += 1;
    damage += hitDamage;
  }
  return { damage, compatibility, hitCount, isDuo, evasionCount, blindMiss: false, criticalCount };
}

function describePlayerAttackSpecials(attack: { evasionCount?: number; blindMiss?: boolean; criticalCount?: number }) {
  const parts: string[] = [];
  if (attack.blindMiss) parts.push('暗闇MISS1回');
  if (safeNumber(attack.evasionCount) > 0) parts.push(`回避成功${safeNumber(attack.evasionCount)}回`);
  if (safeNumber(attack.criticalCount) > 0) parts.push(`クリティカル発動${safeNumber(attack.criticalCount)}回`);
  return parts.length ? ` / ${parts.join(' / ')}` : '';
}

function calculatePlayerHeal(magicId: string, state: SimulationState) {
  const parsed = parseMagicId(magicId);
  if (!parsed) {
    return 0;
  }
  const runtime = buildRuntimeCharacter(parsed.deckIndex);
  if (!runtime) {
    return 0;
  }
  const buffs = buildRuntimeBuffs(runtime).filter((buff) => buff.magicOption === `M${parsed.magicSlot}`);
  let heal = 0;
  buffs.forEach((buff) => {
    const level = Math.min(10, Math.max(1, Math.floor(safeNumber(buff.levelOption) || 10)));
    if (buff.buffOption === '回復') {
      const rate = safeNumber(healDict[`回復(${buff.powerOption})${level}`]);
      const raw = rate * safeNumber(runtime.atk);
      heal += raw;
    }
  });
  const amount = ceilDamage(heal);
  if (amount > 0 && isPlayerCursed(state, parsed.deckIndex)) {
    return 0;
  }
  return amount;
}

function applyPlayerContinueHeal(state: SimulationState, currentHp: number): ContinueHealResult {
  const activeHeals = state.playerContinueHeals.filter((entry) => entry.turns > 0);
  if (!activeHeals.length) {
    return { total: 0, details: [] };
  }
  let remainingRecoverableHp = Math.max(0, totalDeckHp.value - currentHp);
  const details: ContinueHealDetail[] = [];
  for (const entry of activeHeals) {
    const baseCardHp = deckCardHp(entry.cardIndex);
    const rawHeal = baseCardHp * entry.rate;
    const potentialAmount = ceilDamage(rawHeal);
    if (isPlayerCursed(state, entry.cardIndex)) {
      continue;
    }
    const amount = Math.min(potentialAmount, remainingRecoverableHp);
    if (potentialAmount > 0) {
      details.push({
        cardIndex: entry.cardIndex,
        source: entry.source || describeDeckCard(entry.cardIndex),
        amount,
        potentialAmount,
        capped: amount < potentialAmount,
      });
    }
    remainingRecoverableHp = Math.max(0, remainingRecoverableHp - amount);
  }
  const total = details.reduce((sum, detail) => sum + detail.amount, 0);
  if (total <= 0) {
    return { total: 0, details };
  }
  return { total, details };
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
    };
  }
  const parsed = parseMagicId(magicId);
  const defenderElement = parsed ? normalizeElement(deck.value[parsed.deckIndex]?.character?.[`magic${parsed.magicSlot}atr` as keyof Character] as string) : '無';
  const attackElement = effectiveEnemyActionElement(enemyAction);
  const defenceCompatibility = getCompatibility(defenderElement, attackElement);
  const elementMultiplier = defenceCompatibility === 'advantage' ? 0.5 : defenceCompatibility === 'disadvantage' ? 1.5 : 1;
  const baseAtk = deriveEnemyBaseAtk(enemyAction);
  const atkRate = sumRatesForEnemy(state.enemyAttackUps, enemyAction.slotKey)
    - sumRatesForEnemy(state.enemyAttackDowns, enemyAction.slotKey);
  const damageTakenDownRate = parsed ? sumDamageTakenDownRatesForCard(state.playerDamageTakenDowns, parsed.deckIndex, attackElement) : 0;
  const damageTakenUpRate = parsed ? sumDamageTakenDownRatesForCard(state.playerDamageTakenUps, parsed.deckIndex, attackElement) : 0;
  const damageRate = sumDamageRatesForElementAndEnemy(state.enemyDamageUps, attackElement, enemyAction.slotKey)
    - sumDamageRatesForElementAndEnemy(state.enemyDamageDowns, attackElement, enemyAction.slotKey)
    - damageTakenDownRate
    + damageTakenUpRate;
  const equalDamage = calculateEnemyEqualDamage(enemyAction, baseAtk, atkRate, damageRate);
  const hitCount = enemyPowerHitCount(enemyAction.power);
  const evasionRate = parsed ? Math.min(1, sumRatesForCard(state.playerEvasions, parsed.deckIndex) / 100) : 0;
  const blindRate = Math.min(1, sumRatesForEnemy(state.enemyBlinds, enemyAction.slotKey) / 100);
  let evasionCount = 0;
  const hitDamages: number[] = [];
  if (blindRate > 0) {
    const blindRoll = rng();
    if (blindRoll < blindRate) {
      stats.miss += 1;
      return {
        damage: 0,
        defenceCompatibility,
        defenderElement,
        baseAtk,
        equalDamage,
        atkRate,
        damageRate,
        hitDamages: Array.from({ length: hitCount }, () => 0),
        evasionCount: 0,
        blindMiss: true,
      };
    }
  }
  for (let hit = 0; hit < hitCount; hit += 1) {
    if (evasionRate > 0) {
      const evasionRoll = rng();
      const evaded = evasionRoll < evasionRate;
      if (evaded) {
        evasionCount += 1;
        hitDamages.push(0);
        continue;
      }
    }
    const random = nextDamageFactor(rng);
    const raw = (equalDamage * elementMultiplier / hitCount) * random.factor;
    const hitDamage = ceilDamage(raw);
    hitDamages.push(hitDamage);
  }
  return {
    damage: hitDamages.reduce((sum, value) => sum + value, 0),
    defenceCompatibility,
    defenderElement,
    baseAtk,
    equalDamage,
    atkRate,
    damageRate,
    hitDamages,
    evasionCount,
    blindMiss: false,
  };
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
        state.enemyAttackUps.push({ rate: value || 20, turns: duration, targetEnemySlotKey });
      });
      break;
    case 'damageUp':
      targetSlotKeys.forEach((targetEnemySlotKey) => {
        state.enemyDamageUps.push({ rate: value || 5, turns: duration, targetEnemySlotKey });
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
    case 'guts':
      targetSlotKeys.forEach((targetEnemySlotKey) => {
        state.enemyGuts.push({ count: normalizeGutsCount(action), turns: duration, targetEnemySlotKey });
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
    case 'damageDown':
      targetCards.forEach((targetCardIndex) => {
        state.playerDamageDowns.push({ cardIndex: targetCardIndex, rate: value || 5, turns: duration, attributeOption: action.effectAttribute });
      });
      break;
    case 'damageTakenDown':
      if (isEnemySideTarget(action.effectTarget)) {
        targetSlotKeys.forEach((targetEnemySlotKey) => {
          state.enemyDamageReductions.push({ rate: value || 22.5, turns: duration, targetEnemySlotKey });
        });
      }
      break;
    case 'blind':
      targetCards.forEach((targetCardIndex) => {
        if (isPlayerImmune(state, targetCardIndex, 'blind')) {
          return;
        }
        state.playerBlinds.push({ cardIndex: targetCardIndex, rate: value || 21.6, turns: duration });
      });
      break;
    case 'evasion':
      if (isEnemySideTarget(action.effectTarget)) {
        targetSlotKeys.forEach((targetEnemySlotKey) => {
          state.enemyEvasions.push({ rate: value || 14.8, turns: duration, targetEnemySlotKey });
        });
      }
      break;
    case 'burn':
      targetCards.forEach((targetCardIndex) => {
        if (isPlayerImmune(state, targetCardIndex, 'burn')) {
          return;
        }
        state.burns.push({ cardIndex: targetCardIndex, rate: value || 16, turns: duration });
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
        state.playerCurses.push({ cardIndex: targetCardIndex, rate: 100, turns: duration });
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
          state.playerFreezes.push({ cardIndex: targetCardIndex, rate: 100, turns: duration });
        }
      });
      break;
    case 'atkUp':
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
  if (['damageDown', 'burn', 'blind', 'curse', 'freeze', 'buffRemoval'].includes(effectKind)) return '相手';
  return '自';
}

function isEnemyFreezeBlockedEffectKind(effectKind: EffectKind) {
  return ['atkUp', 'damageUp', 'damageTakenDown', 'evasion', 'guts'].includes(effectKind);
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
  const guts = state.enemyGuts.find((entry) => entry.turns > 0
    && entry.count > 0
    && timedRateAppliesToEnemy(entry, targetEnemySlotKey || ''));
  if (!guts) {
    return { hp: enemyHp, used: false };
  }
  guts.count -= 1;
  state.enemyGuts = state.enemyGuts.filter((entry) => entry.turns > 0 && entry.count > 0);
  return { hp: 1, used: true };
}

function applyPlayerGutsIfNeeded(state: SimulationState, playerHp: number, defendingMagicId: string) {
  if (playerHp > 0) return { hp: playerHp, used: false };
  const parsed = parseMagicId(defendingMagicId);
  if (!parsed) return { hp: playerHp, used: false };
  const guts = state.playerGuts.find((entry) => entry.turns > 0
    && entry.count > 0
    && entry.cardIndex === parsed.deckIndex);
  if (!guts) {
    return { hp: playerHp, used: false };
  }
  guts.count -= 1;
  state.playerGuts = state.playerGuts.filter((entry) => entry.turns > 0 && entry.count > 0);
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
    state.enemyDamageReductions = [];
    state.enemyGuts = [];
    return;
  }
  const targetSet = enemySlotKeySet(enemySlotKeys);
  if (!targetSet.size) return;
  state.enemyAttackUps = removeEnemySlotBuffsByTargets(state.enemyAttackUps, targetSet);
  state.enemyDamageUps = removeEnemySlotBuffsByTargets(state.enemyDamageUps, targetSet);
  state.enemyEvasions = removeEnemySlotBuffsByTargets(state.enemyEvasions, targetSet);
  state.enemyDamageReductions = removeEnemySlotBuffsByTargets(state.enemyDamageReductions, targetSet);
  state.enemyGuts = state.enemyGuts.filter((entry) => !entry.targetEnemySlotKey || !targetSet.has(entry.targetEnemySlotKey));
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
  state.playerDamageDowns = tickRateList(state.playerDamageDowns);
  state.playerEvasions = tickRateList(state.playerEvasions);
  state.enemyDamageReductions = tickRateList(state.enemyDamageReductions);
  state.enemyEvasions = tickRateList(state.enemyEvasions);
  state.enemyAttackDowns = tickRateList(state.enemyAttackDowns);
  state.enemyDamageDowns = tickRateList(state.enemyDamageDowns);
  state.enemyDamageTakenUps = tickRateList(state.enemyDamageTakenUps);
  state.enemyCurses = tickRateList(state.enemyCurses);
  state.enemyBlinds = tickRateList(state.enemyBlinds);
  state.enemyFreezes = tickRateList(state.enemyFreezes);
  state.playerBlinds = tickRateList(state.playerBlinds);
  state.playerCurses = tickRateList(state.playerCurses);
  state.playerFreezes = tickRateList(state.playerFreezes);
  state.playerDamageTakenDowns = tickRateList(state.playerDamageTakenDowns);
  state.playerDamageTakenUps = tickRateList(state.playerDamageTakenUps);
  state.enemyAttackUps = tickRateList(state.enemyAttackUps);
  state.enemyDamageUps = tickRateList(state.enemyDamageUps);
  state.enemyGuts = state.enemyGuts.map((entry) => ({ ...entry, turns: entry.turns - 1 })).filter((entry) => entry.turns > 0 && entry.count > 0);
  state.playerGuts = state.playerGuts.map((entry) => ({ ...entry, turns: entry.turns - 1 })).filter((entry) => entry.turns > 0 && entry.count > 0);
  state.burns = state.burns.map((burn) => ({ ...burn, turns: burn.turns - 1 })).filter((burn) => burn.turns > 0);
  state.playerContinueHeals = state.playerContinueHeals.map((entry) => ({ ...entry, turns: entry.turns - 1 })).filter((entry) => entry.turns > 0);
  state.playerImmunities = state.playerImmunities.map((entry) => ({ ...entry, turns: entry.turns - 1 })).filter((entry) => entry.turns > 0);
  state.playerBuffs = state.playerBuffs.map((entry) => ({ ...entry, turns: entry.turns - 1 })).filter((entry) => entry.turns > 0);
}

function tickRateList<T extends TimedRate>(list: T[]): T[] {
  return list.map((item) => ({ ...item, turns: item.turns - 1 })).filter((item) => item.turns > 0);
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
  if (exam.value.kind === 'BASIC') {
    const turns = [0.144, 0.138, 0.132, 0.126, 0.12];
    const moveNum = stats.advantage + stats.equal + stats.disadvantage;
    const turnIndex = clamp(Math.floor((moveNum - 1) / 2), 0, turns.length - 1);
    const base = stats.playerDamage - moveNum * 4.5 + stats.duo * 3000 + stats.advantage * 2000 + stats.equal * 500 - stats.disadvantage * 1000;
    return Math.round(base * exam.value.difficulty * turns[turnIndex]);
  }
  if (exam.value.kind === 'ATTACK') {
    const actionCount = stats.advantageCombo + stats.equalCombo + stats.disadvantageCombo + stats.advantageSingle + stats.equalSingle + stats.disadvantageSingle;
    const damageScore = Math.round(stats.playerDamage / 208);
    const basicScore = 11036 + safeNumber(exam.value.enemyHp) * 0.080471;
    const moveMinusScore = 641.2 + safeNumber(exam.value.enemyHp) * 0.002048;
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
    return Math.round(base * exam.value.difficulty);
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
  return Math.round(base * exam.value.difficulty * turnMultiplier);
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
    ];
    const base = stats.playerDamage - moveNum * 4.5 + stats.duo * 3000 + stats.advantage * 2000 + stats.equal * 500 - stats.disadvantage * 1000;
    pushLog(stats, `スコア内訳: BASIC ${components.join(' / ')}`);
    pushLog(stats, `スコア内訳: 小計 ${formatScoreNumber(base)} × 難易度 ${formatScoreNumber(exam.value.difficulty)} × ターン補正 ${formatScoreNumber(turnMultiplier)} = ${formatNumber(stats.score)}`);
    return;
  }

  if (exam.value.kind === 'ATTACK') {
    const actionCount = stats.advantageCombo + stats.equalCombo + stats.disadvantageCombo + stats.advantageSingle + stats.equalSingle + stats.disadvantageSingle;
    const damageScore = Math.round(stats.playerDamage / 208);
    const basicScore = 11036 + safeNumber(exam.value.enemyHp) * 0.080471;
    const moveMinusScore = 641.2 + safeNumber(exam.value.enemyHp) * 0.002048;
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
    ];
    pushLog(stats, `スコア内訳: ATTACK ${components.join(' / ')}`);
    pushLog(stats, `スコア内訳: 小計 ${formatScoreNumber(base)} × 難易度 ${formatScoreNumber(exam.value.difficulty)} = ${formatNumber(stats.score)}`);
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
  ];
  pushLog(stats, `スコア内訳: DEFENCE ${components.join(' / ')}`);
  pushLog(stats, `スコア内訳: 小計 ${formatScoreNumber(base)} × 難易度 ${formatScoreNumber(exam.value.difficulty)} × ターン補正 ${formatScoreNumber(turnMultiplier)} = ${formatNumber(stats.score)}`);
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
  if (compatibility === 'advantage') stats.advantage += 1;
  if (compatibility === 'equal') stats.equal += 1;
  if (compatibility === 'disadvantage') stats.disadvantage += 1;
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
  return list.reduce((sum, item) => (
    timedRateAppliesToEnemy(item, enemySlotKey) ? sum + safeNumber(item.rate) : sum
  ), 0);
}

function sumDamageRatesForElementAndEnemy(list: TimedRate[], element: ActionElement, enemySlotKey: string) {
  return list.reduce((sum, item) => {
    if (!timedRateAppliesToEnemy(item, enemySlotKey)) return sum;
    if (item.attributeOption && item.attributeOption !== element) return sum;
    return sum + safeNumber(item.rate);
  }, 0);
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
  return list.reduce((sum, item) => (
    item.cardIndex === cardIndex ? sum + safeNumber(item.rate) : sum
  ), 0);
}

function sumDamageDownRatesForCard(list: TargetedTimedRate[], cardIndex: number, attackerElement: ActionElement) {
  return list.reduce((sum, item) => {
    if (item.cardIndex !== cardIndex) return sum;
    if (item.attributeOption && item.attributeOption !== attackerElement) return sum;
    return sum + safeNumber(item.rate);
  }, 0);
}

function sumDamageTakenDownRatesForCard(list: TargetedTimedRate[], cardIndex: number, attackElement: ActionElement) {
  return list.reduce((sum, item) => {
    if (item.cardIndex !== cardIndex) return sum;
    if (item.attributeOption && item.attributeOption !== attackElement) return sum;
    return sum + safeNumber(item.rate);
  }, 0);
}

function nextDamageFactor(rng: () => number) {
  const roll = rng();
  return { roll, factor: 0.95 + roll * 0.1 };
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

function createRng(seedText: string) {
  let seedValue = hashSeed(seedText)();
  return () => {
    seedValue += 0x6D2B79F5;
    let value = seedValue;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
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

function pushLog(stats: SimulationStats, line: string) {
  if (!stats.log) return;
  stats.log.push(line);
}

function retire(stats: SimulationStats, reason: string) {
  stats.retired = true;
  stats.retireReason = reason;
  pushLog(stats, `リタイア: ${reason}`);
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
  const valueText = value ? `${value}%` : '既定値';
  const labelMap: Record<EffectKind, string> = {
    none: 'なし',
    atkUp: 'ATKUP',
    damageUp: 'ダメージUP',
    damageDown: 'ダメージDOWN',
    damageTakenDown: '被ダメDOWN',
    burn: 'やけど',
    heal: '回復',
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
  margin-top: 10px;
}

.exam-preset-strip {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  margin-bottom: 10px;
  padding: 10px 12px;
  border: 1px solid #d9e2ea;
  border-radius: 8px;
  background: #ffffff;
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

.order-panel > .panel-heading {
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  align-items: center;
}

.order-panel > .panel-heading > div:first-child {
  justify-self: start;
}

.plan-heading-actions {
  grid-column: 2;
  justify-self: center;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  min-width: 0;
  flex-wrap: wrap;
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
}

.preset-menu-list {
  min-width: 260px;
  max-width: min(420px, 92vw);
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

.combo-row.virtual {
  border-style: dashed;
  background: #ffffff;
}

.combo-priority {
  display: grid;
  flex: 0 0 28px;
  width: 28px;
  height: 28px;
  place-items: center;
  border-radius: 7px;
  color: #ffffff;
  background: #236c8e;
  font-weight: 900;
  line-height: 1;
}

.combo-row.virtual .combo-priority {
  background: transparent;
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
  }

  .header-actions,
  .result-actions,
  .preset-actions {
    justify-content: flex-start;
  }

  .exam-preset-strip {
    align-items: stretch;
    flex-direction: column;
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
    padding: 10px;
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
