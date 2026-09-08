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
        :class="[entry.side, { emphasized: entry.emphasized }]"
      >
        <template v-if="entry.side === 'enemy'">
          <div class="log-marker">
            <div class="log-combatant enemy-combatant">{{ localize(entry.label || enemyLabel) }}</div>
            <img v-if="entry.sourceElement" class="log-element-icon" :src="elementIcon(entry.sourceElement)" alt="" />
          </div>
          <div class="log-arrow">→</div>
          <div class="log-bubble">{{ localize(entry.displayLine) }}</div>
          <template v-if="entry.targetIcon || entry.targetLabel">
            <div class="log-arrow">→</div>
            <div class="log-marker">
              <img v-if="entry.targetIcon" class="log-avatar" :src="entry.targetIcon" alt="" />
              <div v-else class="log-combatant target-combatant">{{ localize(entry.targetLabel || '') }}</div>
              <img v-if="entry.targetElement" class="log-element-icon" :src="elementIcon(entry.targetElement)" alt="" />
            </div>
          </template>
        </template>
        <template v-else-if="entry.side === 'player'">
          <template v-if="entry.targetLabel">
            <div class="log-marker">
              <div class="log-combatant target-combatant">{{ localize(entry.targetLabel) }}</div>
              <img v-if="entry.targetElement" class="log-element-icon" :src="elementIcon(entry.targetElement)" alt="" />
            </div>
            <div class="log-arrow">←</div>
          </template>
          <div class="log-bubble">{{ localize(entry.displayLine) }}</div>
          <div class="log-arrow">←</div>
          <div class="log-marker">
            <img class="log-avatar" :src="entry.icon || defaultImg" alt="" />
            <img v-if="entry.sourceElement" class="log-element-icon" :src="elementIcon(entry.sourceElement)" alt="" />
          </div>
        </template>
        <div v-else class="log-system-line">{{ localize(entry.displayLine) }}</div>
      </div>
    </section>
  </div>
</template>

<style scoped>
.log-body {
  max-height: 68vh;
  overflow: auto;
  padding-right: 4px;
}

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

.battle-log-row.enemy { justify-content: flex-start; padding-right: 0; }
.battle-log-row.player { justify-content: flex-end; padding-left: 0; }
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

.log-bubble { flex: 1 1 auto; background: #fbfcfd; }

.battle-log-row.emphasized .log-bubble,
.battle-log-row.emphasized .log-system-line { border-color: #8fbad7; background: #eef7fc; font-weight: 800; }
.battle-log-row.enemy .log-bubble { border-color: #e4d3c9; background: #fff8f4; }
.battle-log-row.player .log-bubble { border-color: #cadcea; background: #f4f9fd; }
.battle-log-row.enemy.emphasized .log-bubble { border-color: #d8a48c; background: #fff2eb; }
.battle-log-row.player.emphasized .log-bubble { border-color: #8fbad7; background: #eef7fc; }

.log-system-line { width: 100%; color: #5d7080; background: #f7f9fb; text-align: center; }

@media (max-width: 720px) {
  .battle-log-row { align-items: flex-start; flex-wrap: wrap; }
  .log-bubble { flex-basis: calc(100% - 56px); }
}
</style>
