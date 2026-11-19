<script setup lang="ts">
import type { BattleLogActionElement, BattleLogGroup } from '@/utils/examBattleLog';

withDefaults(defineProps<{
  groups: BattleLogGroup[];
  defaultImg: string;
  enemyLabel?: string;
  localize: (text: string) => string;
  elementIcon: (element: BattleLogActionElement) => string;
}>(), {
  enemyLabel: '敵',
});
</script>

<template>
  <div class="log-body" data-testid="best-log-body">
    <section v-for="group in groups" :key="group.title" class="log-turn-group">
      <div class="log-turn-title">{{ localize(group.title) }}</div>
      <div
        v-for="(entry, index) in group.entries"
        :key="`${group.title}-${index}-${entry.line}`"
        class="battle-log-row"
        :class="[entry.side, { emphasized: entry.emphasized,
          'source-only': entry.side !== 'system' && !entry.targetIcon && !entry.targetLabel }]"
      >
        <template v-if="entry.side !== 'system'">
          <div class="log-marker log-source">
            <div v-if="entry.side === 'enemy'" class="log-combatant">{{ localize(entry.label || enemyLabel) }}</div>
            <img v-else class="log-avatar" :src="entry.icon || defaultImg" alt="" />
            <img v-if="entry.sourceElement" class="log-element-icon" :src="elementIcon(entry.sourceElement)" alt="" />
          </div>
          <span class="log-arrow action-arrow" aria-hidden="true">→</span>
          <div class="log-bubble">{{ localize(entry.displayLine) }}</div>
          <template v-if="entry.targetIcon || entry.targetLabel">
            <span class="log-arrow" aria-hidden="true">→</span>
            <div class="log-marker log-target">
              <img v-if="entry.targetIcon" class="log-avatar" :src="entry.targetIcon" alt="" />
              <div v-else class="log-combatant">{{ localize(entry.targetLabel || '') }}</div>
              <img v-if="entry.targetElement" class="log-element-icon" :src="elementIcon(entry.targetElement)" alt="" />
            </div>
          </template>
        </template>
        <div v-else class="log-system-line">{{ localize(entry.displayLine) }}</div>
      </div>
    </section>
  </div>
</template>

<style scoped>
.log-turn-group {
  display: grid;
  gap: 6px;
  padding: 10px 0 12px;
  border-bottom: 1px solid #e2e9ef;
}

.log-turn-group:last-child { border-bottom: 0; }

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

.battle-log-row.enemy { --log-border: #e4d3c9; --log-bg: #fff8f4; }
.battle-log-row.player { --log-border: #cadcea; --log-bg: #f4f9fd; flex-direction: row-reverse; }
.battle-log-row.enemy.emphasized { --log-border: #d8a48c; --log-bg: #fff2eb; }
.battle-log-row.player.emphasized { --log-border: #8fbad7; --log-bg: #eef7fc; }
.battle-log-row.player .log-arrow { transform: scaleX(-1); }
.battle-log-row.system { justify-content: center; }

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

.log-marker { display: inline-flex; flex: 0 0 auto; align-items: center; gap: 4px; }

.log-avatar {
  flex: 0 0 auto;
  width: 28px;
  height: 28px;
  border: 1px solid #cfdbe4;
  border-radius: 6px;
  background: #f7fafc;
  object-fit: cover;
}

.log-element-icon { width: 18px; height: 18px; flex: 0 0 auto; object-fit: contain; }
.log-arrow { flex: 0 0 auto; color: #236c8e; font-size: 18px; font-weight: 900; line-height: 1; }

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

.log-bubble { flex: 1 1 auto; border-color: var(--log-border); background: var(--log-bg); }

.battle-log-row.emphasized .log-bubble { font-weight: 800; }
.battle-log-row.emphasized .log-system-line { border-color: #8fbad7; background: #eef7fc; font-weight: 800; }

.log-system-line { width: 100%; color: #5d7080; background: #f7f9fb; text-align: center; }

@media (max-width: 720px) {
  .battle-log-row.player,
  .battle-log-row.enemy {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr);
    grid-template-areas: "enemy arrow player" "detail detail detail";
    gap: 4px 6px;
    padding: 8px 10px;
    border: 1px solid var(--log-border);
    border-radius: 8px;
    background: var(--log-bg);
  }

  .player.source-only {
    grid-template-columns: minmax(0, 1fr) fit-content(40%);
    grid-template-areas: "detail player";
  }
  .enemy.source-only {
    grid-template-columns: fit-content(40%) minmax(0, 1fr);
    grid-template-areas: "enemy detail";
  }
  .battle-log-row.source-only { padding-block: 4px; }
  .action-arrow { display: none; }
  .log-arrow { grid-area: arrow; }
  .enemy .log-source, .player .log-target { grid-area: enemy; justify-self: start; }
  .player .log-source, .enemy .log-target { grid-area: player; justify-self: end; }
  .log-marker { min-width: 0; max-width: 100%; }
  .log-combatant {
    flex: 0 1 auto;
    min-width: 0;
    height: auto;
    min-height: 28px;
    padding-block: 3px;
    line-height: 1.25;
    white-space: normal;
    overflow-wrap: anywhere;
  }
  .log-bubble {
    grid-area: detail;
    justify-self: stretch;
    padding: 0;
    border: 0;
  }
  .log-bubble, .log-system-line {
    font-family: inherit;
    font-size: 13px;
    line-height: 1.5;
  }
  .log-system-line { text-align: start; }
}
</style>
