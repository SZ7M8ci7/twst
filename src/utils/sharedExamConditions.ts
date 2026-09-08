import type { ExamPresetDefinition, ExamPresetEnemy } from './examPresets';

export interface SharedExamConditions {
  preset: ExamPresetDefinition;
  challengeLocks: Record<string, 'on' | 'off' | 'auto'>;
  maxRemoved: 1 | 2;
}

// Exclude editor-only row IDs, but preserve every setting used by battle execution.
export function snapshotExamConditions(
  metadata: ExamPresetDefinition | null,
  exam: Pick<ExamPresetDefinition, 'kind' | 'enemyElement' | 'enemyHp' | 'difficulty'>,
  enemies: ExamPresetEnemy[],
  challengeLocks: SharedExamConditions['challengeLocks'],
  maxRemoved: 1 | 2,
): SharedExamConditions {
  const preset: ExamPresetDefinition = {
    id: metadata?.id ?? 'custom', title: metadata?.title ?? 'カスタム試験',
    kind: exam.kind, enemyElement: exam.enemyElement, enemyHp: exam.enemyHp,
    difficulty: exam.difficulty,
    enemies: enemies.map(enemy => ({ name: enemy.name, actions: enemy.actions.map(action => ({
      name: action.name, element: action.element, power: action.power,
      estimatedDamage: action.estimatedDamage, keepInDeckWhenDamageZero: action.keepInDeckWhenDamageZero,
      effectKind: action.effectKind, effectTarget: action.effectTarget, effectAttribute: action.effectAttribute,
      effectValue: action.effectValue, duration: action.duration, fixedOrder: action.fixedOrder,
      preferFirstDuplicate: action.preferFirstDuplicate,
    })) })),
    specialChallenges: metadata?.specialChallenges,
  };
  return JSON.parse(JSON.stringify({ preset, challengeLocks, maxRemoved }));
}

// The editor fills optional action defaults. Compare their meaning so simply
// mounting the shared editor does not discard a saved search checkpoint.
export function sharedExamConditionsKey(value: SharedExamConditions): string {
  const { preset } = value;
  return JSON.stringify({
    id: preset.id, title: preset.title, kind: preset.kind, enemyElement: preset.enemyElement,
    enemyHp: preset.enemyHp, difficulty: preset.difficulty ?? 1.5,
    enemies: preset.enemies.map(enemy => ({ name: enemy.name, actions: enemy.actions.map(action => ({
      name: action.name, power: action.power, estimatedDamage: action.estimatedDamage,
      element: preset.enemyElement === '全' ? action.element ?? '火' : preset.enemyElement,
      keepInDeckWhenDamageZero: action.keepInDeckWhenDamageZero ?? false,
      effectKind: action.effectKind ?? 'none',
      effectTarget: action.effectTarget ?? (['atkDown', 'damageDown', 'burn', 'blind', 'curse', 'freeze', 'buffRemoval'].includes(action.effectKind ?? 'none') ? '相手' : '自'),
      effectAttribute: action.effectAttribute ?? null, effectValue: action.effectValue ?? 0,
      duration: action.duration ?? 1, fixedOrder: action.fixedOrder ?? null,
      preferFirstDuplicate: action.preferFirstDuplicate ?? false,
    })) })),
    challenges: (preset.specialChallenges ?? []).map(challenge => ({ ...challenge, lock: value.challengeLocks[challenge.id] ?? 'auto' })),
    maxRemoved: value.maxRemoved,
  });
}
