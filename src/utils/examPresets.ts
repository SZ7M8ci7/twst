export type ExamPresetKind = 'BASIC' | 'DEFENCE' | 'ATTACK';
export type ExamPresetElement = '火' | '水' | '木' | '無' | '全';
export type ExamPresetActionElement = '火' | '水' | '木' | '無';
export type ExamPresetMagicPower = '単発(弱)' | '単発(強)' | '2連撃(弱)' | '2連撃(強)' | '3連撃(弱)' | '3連撃(強)';
export type ExamPresetEffectTarget = '自' | '相手' | '味方選択' | '相手選択' | '味方全体' | '相手全体';
export type ExamPresetEffectKind =
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

export interface ExamPresetEnemyAction {
  name: string;
  element?: ExamPresetActionElement;
  power: ExamPresetMagicPower;
  estimatedDamage: number;
  keepInDeckWhenDamageZero?: boolean;
  effectKind?: ExamPresetEffectKind;
  effectTarget?: ExamPresetEffectTarget;
  effectAttribute?: ExamPresetActionElement;
  effectValue?: number;
  duration?: number;
}

export interface ExamPresetEnemy {
  name: string;
  actions: ExamPresetEnemyAction[];
}

export interface ExamPresetDefinition {
  id: string;
  title: string;
  kind: ExamPresetKind;
  enemyElement: ExamPresetElement;
  enemyHp: number;
  difficulty?: number;
  enemies: ExamPresetEnemy[];
}

export const examPresetDefinitions: ExamPresetDefinition[] = [
  {
    id: '2026/05-1火BS',
    title: '2026/05-1火BS',
    kind: 'BASIC',
    enemyElement: '火',
    enemyHp: 115000,
    enemies: [
      {
        name: 'アズール',
        actions: [
          { name: '強2連', element: '火', power: '2連撃(強)', estimatedDamage: 0, keepInDeckWhenDamageZero: true },
          { name: 'ダメUP強単発', element: '火', power: '単発(強)', estimatedDamage: 0, keepInDeckWhenDamageZero: true, effectKind: 'damageUp', effectTarget: '自', effectValue: 5, duration: 3 },
          { name: 'ATKUP強2連', element: '火', power: '2連撃(強)', estimatedDamage: 0, keepInDeckWhenDamageZero: true, effectKind: 'atkUp', effectTarget: '自', effectValue: 32, duration: 1 },
        ],
      },
      {
        name: 'イデア',
        actions: [
          { name: '強2連', element: '火', power: '2連撃(強)', estimatedDamage: 0, keepInDeckWhenDamageZero: true },
          { name: '相手選択火ダメDOWN強単発', element: '火', power: '単発(強)', estimatedDamage: 0, keepInDeckWhenDamageZero: true, effectKind: 'damageDown', effectTarget: '相手選択', effectAttribute: '火', effectValue: 9.6, duration: 1 },
          { name: '相手選択火ダメDOWN強2連', element: '火', power: '2連撃(強)', estimatedDamage: 0, keepInDeckWhenDamageZero: true, effectKind: 'damageDown', effectTarget: '相手選択', effectAttribute: '火', effectValue: 9.6, duration: 1 },
        ],
      },
    ],
  },
  {
    id: '2026/05-1木DF',
    title: '2026/05-1木DF',
    kind: 'DEFENCE',
    enemyElement: '木',
    enemyHp: 99000,
    enemies: [
      {
        name: 'マレウス',
        actions: [
          { name: 'ダメUP強単発', element: '木', power: '単発(強)', estimatedDamage: 4900, effectKind: 'damageUp', effectTarget: '自', effectValue: 5, duration: 3 },
          { name: '強2連', element: '木', power: '2連撃(強)', estimatedDamage: 8400 },
          { name: 'ATKUP強2連', element: '木', power: '2連撃(強)', estimatedDamage: 11100, effectKind: 'atkUp', effectTarget: '自', effectValue: 32, duration: 1 },
        ],
      },
      {
        name: 'ケイト',
        actions: [
          { name: '弱3連', element: '木', power: '3連撃(弱)', estimatedDamage: 10850 },
          { name: 'ATKUP弱3連', element: '木', power: '3連撃(弱)', estimatedDamage: 14300, effectKind: 'atkUp', effectTarget: '自', effectValue: 32, duration: 1 },
          { name: '強3連', element: '木', power: '3連撃(強)', estimatedDamage: 14450 },
        ],
      },
    ],
  },
  {
    id: '2026/04-2水ATK',
    title: '2026/04-2水ATK',
    kind: 'ATTACK',
    enemyElement: '水',
    enemyHp: 218000,
    enemies: [
      {
        name: 'シルバー',
        actions: [
          { name: '強2連', element: '水', power: '2連撃(強)', estimatedDamage: 9000 },
          { name: 'ダメUP強単発', element: '水', power: '単発(強)', estimatedDamage: 7000, effectKind: 'damageUp', effectTarget: '自', effectValue: 5, duration: 3 },
          { name: 'ATKUP強2連', element: '水', power: '2連撃(強)', estimatedDamage: 12000, effectKind: 'atkUp', effectTarget: '自', effectValue: 32, duration: 1 },
        ],
      },
      {
        name: 'オルト',
        actions: [
          { name: '強2連', element: '水', power: '2連撃(強)', estimatedDamage: 9000 },
          { name: 'ダメDOWN強単発', element: '水', power: '単発(強)', estimatedDamage: 7000, effectKind: 'damageDown', effectTarget: '相手', effectValue: 5, duration: 1 },
          { name: '被ダメDOWN強2連', element: '水', power: '2連撃(強)', estimatedDamage: 9000, effectKind: 'damageTakenDown', effectTarget: '自', effectValue: 22.5, duration: 1 },
        ],
      },
    ],
  },
  {
    id: '2026/04-2無DF',
    title: '2026/04-2無DF',
    kind: 'DEFENCE',
    enemyElement: '無',
    enemyHp: 88000,
    enemies: [
      {
        name: 'リドル',
        actions: [
          { name: 'デバフ解除弱2連', element: '無', power: '2連撃(弱)', estimatedDamage: 5700, effectKind: 'debuffRemoval', effectTarget: '味方選択', effectValue: 0, duration: 1 },
          { name: '強2連', element: '無', power: '2連撃(強)', estimatedDamage: 7600 },
          { name: 'ATKUP強2連', element: '無', power: '2連撃(強)', estimatedDamage: 10050, effectKind: 'atkUp', effectTarget: '自', effectValue: 32, duration: 1 },
        ],
      },
      {
        name: 'トレイ',
        actions: [
          { name: 'ダメUP強単発', element: '無', power: '単発(強)', estimatedDamage: 5300, effectKind: 'damageUp', effectTarget: '自', effectValue: 5, duration: 3 },
          { name: '強2連', element: '無', power: '2連撃(強)', estimatedDamage: 9050 },
          { name: 'ATKUP強2連', element: '無', power: '2連撃(強)', estimatedDamage: 11950, effectKind: 'atkUp', effectTarget: '自', effectValue: 32, duration: 1 },
        ],
      },
      {
        name: 'ケイト',
        actions: [
          { name: 'ダメUP強単発', element: '無', power: '単発(強)', estimatedDamage: 5400, effectKind: 'damageUp', effectTarget: '自', effectValue: 5, duration: 3 },
          { name: '強2連', element: '無', power: '2連撃(強)', estimatedDamage: 9300 },
          { name: 'ATKUP強2連', element: '無', power: '2連撃(強)', estimatedDamage: 12250, effectKind: 'atkUp', effectTarget: '自', effectValue: 32, duration: 1 },
        ],
      },
    ],
  },
];
