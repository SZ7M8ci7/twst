<template>
  <div class="results-table-wrap">
    <table class="results-table">
      <thead><tr>
        <th scope="col" class="rank-cell">#</th>
        <th scope="col" class="deck-cell">{{ t('examSearch.table.deck') }}</th>
        <th scope="col" class="extra-cell">{{ t('examSearch.table.extra') }}</th>
        <th scope="col" class="score-cell max-cell">{{ t('examSearch.table.highest') }}</th>
        <th scope="col" class="score-cell p95-cell">{{ t('examSearch.table.p95') }}</th>
        <th scope="col" class="actions-cell">{{ t('examSearch.table.actions') }}</th>
      </tr></thead>
      <tbody>
        <tr v-for="(row, index) in rows" :key="row.result.candidate.id">
          <th scope="row" class="rank-cell">{{ index + 1 }}</th>
          <td class="deck-cell">
            <div class="result-deck">
              <figure v-for="card in row.result.candidate.cards" :key="`${card.support}:${card.name}`" :title="cardLabel(card.name)">
                <div class="result-card-image">
                  <img :src="cardImages[card.name] || defaultImg" :alt="cardLabel(card.name)" loading="lazy" />
                  <span v-if="card.support" class="support-badge">S</span>
                  <div class="selected-magic-icons" :aria-label="`M${card.selectedMagic.join('/M')}`">
                    <span v-for="magic in [1, 2, 3]" :key="magic" class="magic-icon" :class="{ selected: card.selectedMagic.includes(magic as 1 | 2 | 3) }">M{{ magic }}</span>
                  </div>
                </div>
              </figure>
            </div>
          </td>
          <td class="extra-cell">
            <button v-if="row.variantCount" type="button" class="variants-button" :disabled="busy" aria-haspopup="dialog" :aria-label="t('examSearch.compareVariantsFor', { rank: index + 1, count: row.variantCount })" @click="$emit('variants', row.result)"><span class="variant-summary">{{ upgradeSummary(row.result) }}<span class="variant-arrow"> ▾</span></span><span class="variant-count">{{ t('examSearch.compareVariants', { count: row.variantCount }) }}</span></button>
            <span v-else>{{ upgradeSummary(row.result) }}</span>
          </td>
          <td class="score-cell max-cell">{{ highestScoreLabel(row.result) }}</td>
          <td class="score-cell p95-cell">{{ scoreLabel(resultScoreDistribution(row.result).p95) }}</td>
          <td class="actions-cell">
            <v-btn v-if="row.result.validationBest" :disabled="busy" size="small" variant="text" @click="$emit('preview', row.result)">{{ t('examSearch.replayBest') }}</v-btn>
            <v-btn :disabled="busy" size="small" variant="text" @click="$emit('simulator', row.result)">{{ t('examSearch.openSimulator') }}</v-btn>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import type { SearchResult } from '@/domain/examSearch/types';
import { resultScoreDistribution } from '@/domain/examSearch/statistics';
import defaultImg from '@/assets/img/default.webp';

defineProps<{
  rows: { result: SearchResult; variantCount?: number }[];
  cardImages: Record<string, string>;
  cardLabel: (name: string) => string;
  upgradeSummary: (result: SearchResult) => string;
  busy: boolean;
}>();
defineEmits<{ (event: 'preview' | 'simulator' | 'variants', result: SearchResult): void }>();
const { t } = useI18n();
const scoreLabel = (score: number | null) => score === null ? '—' : score.toLocaleString();
function highestScoreLabel(result: SearchResult) {
  const scores = resultScoreDistribution(result);
  return scoreLabel(scores.n > 0 ? scores.max : null);
}
</script>

<style scoped>
.results-table-wrap { max-width: 1100px; margin: 12px 0; border: 1px solid #d9e2ea; border-radius: 6px; background: #fff; container-type: inline-size; }
.results-table { width: 100%; border-collapse: collapse; }
th, td { padding: 8px 6px; border-bottom: 1px solid #edf2f6; vertical-align: middle; text-align: left; }
thead th { background: #f7fafc; color: #52616d; font-size: 12px; font-weight: 500; }
tbody tr:last-child > * { border-bottom: 0; }
.rank-cell { width: 32px; text-align: center; font-size: 12px; color: #657582; }
.deck-cell { width: 342px; }
.extra-cell { font-size: 12px; max-width: 125px; overflow-wrap: anywhere; }
.extra-cell > span { display: block; }
.score-cell { text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; font-size: 13px; }
thead .score-cell { font-size: 12px; white-space: normal; }
.max-cell { font-weight: 700; }
.actions-cell { width: 154px; }
.actions-cell .v-btn { display: flex; width: 100%; min-height: 30px; height: auto; padding: 5px 6px; font-size: 12px; letter-spacing: 0; }
.actions-cell :deep(.v-btn__content) { white-space: normal; text-align: center; }
.result-deck { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 5px; }
figure { margin: 0; min-width: 0; }
.result-card-image { position: relative; aspect-ratio: 1; border: 1px solid #ccd8e2; border-radius: 5px; overflow: hidden; background: #eef3f7; }
.result-card-image img { display: block; width: 100%; height: 100%; object-fit: cover; }
.selected-magic-icons { position: absolute; inset: auto 0 0; display: flex; gap: 2px; padding: 2px; background: #152336c9; }
.magic-icon { flex: 1; border-radius: 2px; text-align: center; font-size: 9px; line-height: 14px; color: #ffffff66; }
.magic-icon.selected { background: #fff; color: #173e65; font-weight: 800; }
.support-badge { position: absolute; left: 3px; top: 3px; padding: 0 3px; border-radius: 3px; background: #14202bcc; color: #fff; font-size: 10px; font-weight: 800; }
.variants-button { display: block; padding: 4px 0; color: #1768a7; text-align: left; font-size: 12px; }
.variant-summary, .variant-count { display: block; }
.variant-count { margin-top: 3px; font-size: 11px; text-decoration: underline; text-underline-offset: 3px; }
.variant-arrow { display: none; }
.variants-button:focus-visible { outline: 2px solid #1768a7; outline-offset: 2px; }
.variants-button:disabled { opacity: .5; }
@container (max-width: 780px) {
  .results-table, thead, tbody { display: block; }
  tr { display: grid; grid-template-columns: 26px minmax(0, 1fr) minmax(0, 1fr) minmax(0, 1fr); align-items: center; }
  thead { position: sticky; top: 0; z-index: 1; background: #f7fafc; }
  th, td { min-width: 0; width: auto !important; max-width: none !important; border: 0; padding: 5px; }
  tbody tr { border-top: 1px solid #d9e2ea; padding: 5px 0; }
  .rank-cell { grid-column: 1; grid-row: 1; }
  .deck-cell { grid-column: 2 / 5; grid-row: 1; }
  .extra-cell { grid-column: 2; grid-row: 2; }
  .max-cell { grid-column: 3; grid-row: 2; }
  .p95-cell { grid-column: 4; grid-row: 2; }
  .actions-cell { grid-column: 2 / 5; grid-row: 3; display: flex; justify-content: flex-end; gap: 4px; padding-top: 0; }
  thead .actions-cell { display: none; }
  .actions-cell .v-btn { width: auto; min-height: 34px; }
  .result-deck { max-width: 380px; }
  thead .score-cell { font-size: 11px; }
  .variants-button { min-height: 30px; margin: 0; }
  .variant-count { display: none; }
  .variant-arrow { display: inline; }
}
</style>
