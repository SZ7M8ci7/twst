export type ExamPresetKind = 'BASIC' | 'DEFENCE' | 'ATTACK';
export type ExamPresetElement = '火' | '水' | '木' | '無' | '全';
export type ExamPresetActionElement = '火' | '水' | '木' | '無';
export type ExamPresetMagicPower = '単発(弱)' | '単発(強)' | '2連撃(弱)' | '2連撃(強)' | '3連撃(弱)' | '3連撃(強)';
export type ExamPresetEffectTarget = '自' | '相手' | '味方選択' | '相手選択' | '味方全体' | '相手全体';
export type ExamPresetEffectKind =
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
  fixedOrder?: number;
  preferFirstDuplicate?: boolean;
}

export interface ExamPresetEnemy {
  name: string;
  actions: ExamPresetEnemyAction[];
}

export type ExamSpecialChallengeEffectKind =
  | 'enemyMaxHp'
  | 'enemyAttackUp'
  | 'enemyDamageUp'
  | 'enemyDamageReduction'
  | 'enemyDamageNull'
  | 'enemyEvasion'
  | 'enemyCritical'
  | 'enemyContinueHeal'
  | 'playerAttackDown'
  | 'playerDamageDown'
  | 'playerDamageTakenUp'
  | 'playerBlind'
  | 'playerBurn'
  | 'playerCurse'
  | 'playerFreeze';

export interface ExamSpecialChallengeEffect {
  kind: ExamSpecialChallengeEffectKind;
  value?: number;
  duration?: number;
  attribute?: ExamPresetActionElement;
  dorm?: string;
  dormMode?: 'include' | 'exclude';
}

export interface ExamSpecialChallengeDefinition {
  id: string;
  rank: 1 | 2 | 3;
  label: string;
  score: number;
  effects: ExamSpecialChallengeEffect[];
}

export interface ExamPresetDefinition {
  id: string;
  title: string;
  kind: ExamPresetKind;
  enemyElement: ExamPresetElement;
  enemyHp: number;
  difficulty?: number;
  enemies: ExamPresetEnemy[];
  specialChallenges?: ExamSpecialChallengeDefinition[];
}

export const examPresetDefinitions: ExamPresetDefinition[] = [
  {
    id: '2026/08-2水ATK',
    title: '2026/08-2水ATK',
    kind: 'ATTACK',
    enemyElement: '水',
    enemyHp: 210000,
    enemies: [
      {
        name: 'イデア',
        actions: [
          { name: '強2連', element: '水', power: '2連撃(強)', estimatedDamage: 0, keepInDeckWhenDamageZero: true },
          { name: 'ダメUP強単発', element: '水', power: '単発(強)', estimatedDamage: 0, keepInDeckWhenDamageZero: true, effectKind: 'damageUp', effectTarget: '自', effectValue: 5, duration: 3 },
          { name: 'ATKUP強2連', element: '水', power: '2連撃(強)', estimatedDamage: 0, keepInDeckWhenDamageZero: true, effectKind: 'atkUp', effectTarget: '自', effectValue: 32, duration: 1 },
        ],
      },
      {
        name: 'エペル',
        actions: [
          { name: '強2連', element: '水', power: '2連撃(強)', estimatedDamage: 0, keepInDeckWhenDamageZero: true },
          { name: 'ダメUP強単発', element: '水', power: '単発(強)', estimatedDamage: 0, keepInDeckWhenDamageZero: true, effectKind: 'damageUp', effectTarget: '自', effectValue: 5, duration: 3 },
          { name: 'ATKUP強2連', element: '水', power: '2連撃(強)', estimatedDamage: 0, keepInDeckWhenDamageZero: true, effectKind: 'atkUp', effectTarget: '自', effectValue: 32, duration: 1 },
        ],
      },
      {
        name: 'ヴィル',
        actions: [
          { name: '強2連', element: '水', power: '2連撃(強)', estimatedDamage: 0, keepInDeckWhenDamageZero: true },
          { name: 'ダメUP強2連', element: '水', power: '2連撃(強)', estimatedDamage: 0, keepInDeckWhenDamageZero: true, effectKind: 'damageUp', effectTarget: '自', effectValue: 8, duration: 1 },
          { name: '相手選択凍結強単発', element: '水', power: '単発(強)', estimatedDamage: 0, keepInDeckWhenDamageZero: true, effectKind: 'freeze', effectTarget: '相手選択', effectValue: 100, duration: 3 },
        ],
      },
    ],
  },
  {
    id: '2026/08-2火BS',
    title: '2026/08-2火BS',
    kind: 'BASIC',
    enemyElement: '火',
    enemyHp: 111000,
    enemies: [
      {
        name: 'オルト',
        actions: [
          { name: '強2連', element: '火', power: '2連撃(強)', estimatedDamage: 0, keepInDeckWhenDamageZero: true },
          { name: 'ダメUP強単発', element: '火', power: '単発(強)', estimatedDamage: 0, keepInDeckWhenDamageZero: true, effectKind: 'damageUp', effectTarget: '自', effectValue: 5, duration: 3 },
          { name: '味方選択ATKUP強単発', element: '火', power: '単発(強)', estimatedDamage: 0, keepInDeckWhenDamageZero: true, effectKind: 'atkUp', effectTarget: '味方選択', effectValue: 32, duration: 1 },
        ],
      },
      {
        name: 'カリム',
        actions: [
          { name: '強2連', element: '火', power: '2連撃(強)', estimatedDamage: 0, keepInDeckWhenDamageZero: true },
          { name: 'ダメUP強単発', element: '火', power: '単発(強)', estimatedDamage: 0, keepInDeckWhenDamageZero: true, effectKind: 'damageUp', effectTarget: '自', effectValue: 5, duration: 3 },
          { name: 'ATKUP強2連', element: '火', power: '2連撃(強)', estimatedDamage: 0, keepInDeckWhenDamageZero: true, effectKind: 'atkUp', effectTarget: '自', effectValue: 32, duration: 1 },
        ],
      },
    ],
  },
  {
    id: '2026/08-1全BS',
    title: '2026/08-1全BS',
    kind: 'BASIC',
    enemyElement: '全',
    enemyHp: 110000,
    enemies: [
      {
        name: 'シルバー',
        actions: [
          { name: '火強2連', element: '火', power: '2連撃(強)', estimatedDamage: 0, keepInDeckWhenDamageZero: true },
          { name: '火単体ダメDOWN強単発', element: '火', power: '単発(強)', estimatedDamage: 0, keepInDeckWhenDamageZero: true, effectKind: 'damageDown', effectTarget: '相手', effectValue: 5, duration: 1 },
          { name: '火被ダメDOWN強2連', element: '火', power: '2連撃(強)', estimatedDamage: 0, keepInDeckWhenDamageZero: true, effectKind: 'damageTakenDown', effectTarget: '自', effectValue: 22.5, duration: 1 },
        ],
      },
      {
        name: 'ジャミル',
        actions: [
          { name: '水強2連', element: '水', power: '2連撃(強)', estimatedDamage: 0, keepInDeckWhenDamageZero: true },
          { name: '水ダメUP強単発', element: '水', power: '単発(強)', estimatedDamage: 0, keepInDeckWhenDamageZero: true, effectKind: 'damageUp', effectTarget: '自', effectValue: 5, duration: 3 },
          { name: '水ATKUP強2連', element: '水', power: '2連撃(強)', estimatedDamage: 0, keepInDeckWhenDamageZero: true, effectKind: 'atkUp', effectTarget: '自', effectValue: 32, duration: 1 },
        ],
      },
      {
        name: 'マレウス',
        actions: [
          { name: '木強2連', element: '木', power: '2連撃(強)', estimatedDamage: 0, keepInDeckWhenDamageZero: true },
          { name: '木ダメUP強単発', element: '木', power: '単発(強)', estimatedDamage: 0, keepInDeckWhenDamageZero: true, effectKind: 'damageUp', effectTarget: '自', effectValue: 5, duration: 3 },
          { name: '木ATKUP強2連', element: '木', power: '2連撃(強)', estimatedDamage: 0, keepInDeckWhenDamageZero: true, effectKind: 'atkUp', effectTarget: '自', effectValue: 32, duration: 1 },
        ],
      },
      {
        name: 'リドル',
        actions: [
          { name: '無強単発', element: '無', power: '単発(強)', estimatedDamage: 0, keepInDeckWhenDamageZero: true },
          { name: '無強2連', element: '無', power: '2連撃(強)', estimatedDamage: 0, keepInDeckWhenDamageZero: true },
          { name: '無単体ATKDOWN強2連', element: '無', power: '2連撃(強)', estimatedDamage: 0, keepInDeckWhenDamageZero: true, effectKind: 'atkDown', effectTarget: '相手', effectValue: 32, duration: 1 },
        ],
      },
    ],
  },
  {
    id: '2026/08-1無DF',
    title: '2026/08-1無DF',
    kind: 'DEFENCE',
    enemyElement: '無',
    enemyHp: 92000,
    enemies: [
      {
        name: 'エース',
        actions: [
          { name: '相手選択呪い強単発', element: '無', power: '単発(強)', estimatedDamage: 4200, effectKind: 'curse', effectTarget: '相手選択', effectValue: 100, duration: 3 },
          { name: '強2連', element: '無', power: '2連撃(強)', estimatedDamage: 7550 },
          { name: 'ダメUP強2連', element: '無', power: '2連撃(強)', estimatedDamage: 8150, effectKind: 'damageUp', effectTarget: '自', effectValue: 8, duration: 1 },
        ],
      },
      {
        name: 'オルト',
        actions: [
          { name: 'ダメUP強単発', element: '無', power: '単発(強)', estimatedDamage: 5000, effectKind: 'damageUp', effectTarget: '自', effectValue: 5, duration: 3 },
          { name: '強2連', element: '無', power: '2連撃(強)', estimatedDamage: 8550 },
          { name: 'ATKUP強2連', element: '無', power: '2連撃(強)', estimatedDamage: 11300, effectKind: 'atkUp', effectTarget: '自', effectValue: 32, duration: 1 },
        ],
      },
      {
        name: 'イデア',
        actions: [
          { name: 'ダメUP強単発', element: '無', power: '単発(強)', estimatedDamage: 5200, effectKind: 'damageUp', effectTarget: '自', effectValue: 5, duration: 3 },
          { name: '強2連', element: '無', power: '2連撃(強)', estimatedDamage: 8850 },
          { name: 'ATKUP強2連', element: '無', power: '2連撃(強)', estimatedDamage: 11700, effectKind: 'atkUp', effectTarget: '自', effectValue: 32, duration: 1 },
        ],
      },
    ],
  },
  {
    id: '2026/07-2火DF',
    title: '2026/07-2火DF',
    kind: 'DEFENCE',
    enemyElement: '火',
    enemyHp: 98000,
    enemies: [
      {
        name: 'マレウス',
        actions: [
          { name: 'ダメUP強単発', element: '火', power: '単発(強)', estimatedDamage: 5400, effectKind: 'damageUp', effectTarget: '自', effectValue: 5, duration: 3 },
          { name: '強2連', element: '火', power: '2連撃(強)', estimatedDamage: 9300 },
          { name: 'ATKUP強2連', element: '火', power: '2連撃(強)', estimatedDamage: 12250, effectKind: 'atkUp', effectTarget: '自', effectValue: 32, duration: 1 },
        ],
      },
      {
        name: 'エース',
        actions: [
          { name: 'ダメUP強単発', element: '火', power: '単発(強)', estimatedDamage: 6450, effectKind: 'damageUp', effectTarget: '自', effectValue: 5, duration: 3 },
          { name: '強2連', element: '火', power: '2連撃(強)', estimatedDamage: 11100 },
          { name: 'ATKUP強2連', element: '火', power: '2連撃(強)', estimatedDamage: 14600, effectKind: 'atkUp', effectTarget: '自', effectValue: 32, duration: 1 },
        ],
      },
      {
        name: 'セベク',
        actions: [
          { name: 'ダメUP強単発', element: '火', power: '単発(強)', estimatedDamage: 9350, effectKind: 'damageUp', effectTarget: '自', effectValue: 5, duration: 3 },
          { name: 'ATKUP強単発', element: '火', power: '単発(強)', estimatedDamage: 10800, effectKind: 'atkUp', effectTarget: '自', effectValue: 21.5, duration: 1 },
          { name: 'ATKUP強2連', element: '火', power: '2連撃(強)', estimatedDamage: 21150, effectKind: 'atkUp', effectTarget: '自', effectValue: 32, duration: 1 },
        ],
      },
    ],
  },
  {
    id: '2026/07-2木ATK',
    title: '2026/07-2木ATK',
    kind: 'ATTACK',
    enemyElement: '木',
    enemyHp: 218000,
    enemies: [
      {
        name: 'ラギー',
        actions: [
          { name: '強単発', element: '木', power: '単発(強)', estimatedDamage: 0, keepInDeckWhenDamageZero: true },
          { name: '強2連', element: '木', power: '2連撃(強)', estimatedDamage: 0, keepInDeckWhenDamageZero: true },
          { name: '単体ATKDOWN強2連', element: '木', power: '2連撃(強)', estimatedDamage: 0, keepInDeckWhenDamageZero: true, effectKind: 'atkDown', effectTarget: '相手', effectValue: 32, duration: 1 },
        ],
      },
      {
        name: 'シルバー',
        actions: [
          { name: '強2連', element: '木', power: '2連撃(強)', estimatedDamage: 0, keepInDeckWhenDamageZero: true },
          { name: 'ダメUP強単発', element: '木', power: '単発(強)', estimatedDamage: 0, keepInDeckWhenDamageZero: true, effectKind: 'damageUp', effectTarget: '自', effectValue: 5, duration: 3 },
          { name: 'ATKUP強2連', element: '木', power: '2連撃(強)', estimatedDamage: 0, keepInDeckWhenDamageZero: true, effectKind: 'atkUp', effectTarget: '自', effectValue: 32, duration: 1 },
        ],
      },
    ],
  },
  {
    id: '2026/07-1無ATK',
    title: '2026/07-1無ATK',
    kind: 'ATTACK',
    enemyElement: '無',
    enemyHp: 167000,
    enemies: [
      {
        name: 'アズール',
        actions: [
          { name: '強2連', element: '無', power: '2連撃(強)', estimatedDamage: 0, keepInDeckWhenDamageZero: true },
          { name: 'ダメUP強単発', element: '無', power: '単発(強)', estimatedDamage: 0, keepInDeckWhenDamageZero: true, effectKind: 'damageUp', effectTarget: '自', effectValue: 5, duration: 3 },
          { name: 'ATKUP強2連', element: '無', power: '2連撃(強)', estimatedDamage: 0, keepInDeckWhenDamageZero: true, effectKind: 'atkUp', effectTarget: '自', effectValue: 32, duration: 1 },
        ],
      },
      {
        name: 'ジェイド',
        actions: [
          { name: '強単発', element: '無', power: '単発(強)', estimatedDamage: 0, keepInDeckWhenDamageZero: true },
          { name: '強2連', element: '無', power: '2連撃(強)', estimatedDamage: 0, keepInDeckWhenDamageZero: true },
          { name: '回復強2連', element: '無', power: '2連撃(強)', estimatedDamage: 0, keepInDeckWhenDamageZero: true, effectKind: 'heal', effectTarget: '自', effectValue: 2382, duration: 1 },
        ],
      },
      {
        name: 'フロイド',
        actions: [
          { name: '強2連', element: '無', power: '2連撃(強)', estimatedDamage: 0, keepInDeckWhenDamageZero: true },
          { name: 'ダメUP強単発', element: '無', power: '単発(強)', estimatedDamage: 0, keepInDeckWhenDamageZero: true, effectKind: 'damageUp', effectTarget: '自', effectValue: 5, duration: 3 },
          { name: 'ATKUP強2連', element: '無', power: '2連撃(強)', estimatedDamage: 0, keepInDeckWhenDamageZero: true, effectKind: 'atkUp', effectTarget: '自', effectValue: 32, duration: 1 },
        ],
      },
    ],
  },
  {
    id: '2026/07-1水BS',
    title: '2026/07-1水BS',
    kind: 'BASIC',
    enemyElement: '水',
    enemyHp: 115000,
    enemies: [
      {
        name: 'リドル',
        actions: [
          { name: '強2連', element: '水', power: '2連撃(強)', estimatedDamage: 0, keepInDeckWhenDamageZero: true },
          { name: '相手選択バフ解除弱2連', element: '水', power: '2連撃(弱)', estimatedDamage: 0, keepInDeckWhenDamageZero: true, effectKind: 'buffRemoval', effectTarget: '相手選択', effectValue: 0, duration: 1 },
          { name: 'ATKUP強2連', element: '水', power: '2連撃(強)', estimatedDamage: 0, keepInDeckWhenDamageZero: true, effectKind: 'atkUp', effectTarget: '自', effectValue: 32, duration: 1 },
        ],
      },
      {
        name: 'トレイ',
        actions: [
          { name: '強2連', element: '水', power: '2連撃(強)', estimatedDamage: 0, keepInDeckWhenDamageZero: true },
          { name: 'ダメUP強単発', element: '水', power: '単発(強)', estimatedDamage: 0, keepInDeckWhenDamageZero: true, effectKind: 'damageUp', effectTarget: '自', effectValue: 5, duration: 3 },
          { name: 'ATKUP強2連', element: '水', power: '2連撃(強)', estimatedDamage: 0, keepInDeckWhenDamageZero: true, effectKind: 'atkUp', effectTarget: '自', effectValue: 32, duration: 1 },
        ],
      },
      {
        name: 'ジェイド',
        actions: [
          { name: '強2連', element: '水', power: '2連撃(強)', estimatedDamage: 0, keepInDeckWhenDamageZero: true },
          { name: 'ダメUP強単発', element: '水', power: '単発(強)', estimatedDamage: 0, keepInDeckWhenDamageZero: true, effectKind: 'damageUp', effectTarget: '自', effectValue: 5, duration: 3 },
          { name: 'ATKUP強2連', element: '水', power: '2連撃(強)', estimatedDamage: 0, keepInDeckWhenDamageZero: true, effectKind: 'atkUp', effectTarget: '自', effectValue: 32, duration: 1 },
        ],
      },
      {
        name: 'リリア',
        actions: [
          { name: '強単発', element: '水', power: '単発(強)', estimatedDamage: 0, keepInDeckWhenDamageZero: true },
          { name: '強2連', element: '水', power: '2連撃(強)', estimatedDamage: 0, keepInDeckWhenDamageZero: true },
          { name: 'ATKDOWN強2連', element: '水', power: '2連撃(強)', estimatedDamage: 0, keepInDeckWhenDamageZero: true, effectKind: 'atkDown', effectTarget: '相手', effectValue: 32, duration: 1 },
        ],
      },
    ],
  },
  {
    id: '2026/06-2木BS',
    title: '2026/06-2木BS',
    kind: 'BASIC',
    enemyElement: '木',
    enemyHp: 110000,
    enemies: [
      {
        name: 'リドル',
        actions: [
          { name: '強2連', element: '木', power: '2連撃(強)', estimatedDamage: 0, keepInDeckWhenDamageZero: true },
          { name: 'ダメUP強単発', element: '木', power: '単発(強)', estimatedDamage: 0, keepInDeckWhenDamageZero: true, effectKind: 'damageUp', effectTarget: '自', effectValue: 5, duration: 3 },
          { name: 'ATKUP強2連', element: '木', power: '2連撃(強)', estimatedDamage: 0, keepInDeckWhenDamageZero: true, effectKind: 'atkUp', effectTarget: '自', effectValue: 32, duration: 1 },
        ],
      },
      {
        name: 'エース',
        actions: [
          { name: '強2連', element: '木', power: '2連撃(強)', estimatedDamage: 0, keepInDeckWhenDamageZero: true },
          { name: 'ダメUP強2連', element: '木', power: '2連撃(強)', estimatedDamage: 0, keepInDeckWhenDamageZero: true, effectKind: 'damageUp', effectTarget: '自', effectValue: 5, duration: 3 },
          { name: '継続回復強単発', element: '木', power: '単発(強)', estimatedDamage: 0, keepInDeckWhenDamageZero: true, effectKind: 'continueHeal', effectTarget: '自', effectValue: 5062, duration: 3 },
        ],
      },
      {
        name: 'デュース',
        actions: [
          { name: '強2連', element: '木', power: '2連撃(強)', estimatedDamage: 0, keepInDeckWhenDamageZero: true },
          { name: 'ダメUP強単発', element: '木', power: '単発(強)', estimatedDamage: 0, keepInDeckWhenDamageZero: true, effectKind: 'damageUp', effectTarget: '自', effectValue: 5, duration: 3 },
          { name: 'ATKUP強2連', element: '木', power: '2連撃(強)', estimatedDamage: 0, keepInDeckWhenDamageZero: true, effectKind: 'atkUp', effectTarget: '自', effectValue: 32, duration: 1 },
        ],
      },
    ],
  },
  {
    id: '2026/06-2全DF',
    title: '2026/06-2全DF',
    kind: 'DEFENCE',
    enemyElement: '全',
    enemyHp: 95000,
    enemies: [
      {
        name: 'ルーク',
        actions: [
          { name: '火ダメUP強単発', element: '火', power: '単発(強)', estimatedDamage: 7300, effectKind: 'damageUp', effectTarget: '自', effectValue: 5, duration: 3 },
          { name: '火強2連', element: '火', power: '2連撃(強)', estimatedDamage: 12500 },
          { name: '無強2連', element: '無', power: '2連撃(強)', estimatedDamage: 13750 },
          { name: '無ATKUP強2連', element: '無', power: '2連撃(強)', estimatedDamage: 18150, effectKind: 'atkUp', effectTarget: '自', effectValue: 32, duration: 1 },
        ],
      },
      {
        name: 'ヴィル',
        actions: [
          { name: '水デバフ解除弱2連', element: '水', power: '2連撃(弱)', estimatedDamage: 8050, effectKind: 'debuffRemoval', effectTarget: '味方選択', effectValue: 0, duration: 1 },
          { name: '水強2連', element: '水', power: '2連撃(強)', estimatedDamage: 10750 },
          { name: '水ATKUP強2連', element: '水', power: '2連撃(強)', estimatedDamage: 14200, effectKind: 'atkUp', effectTarget: '自', effectValue: 32, duration: 1 },
        ],
      },
      {
        name: 'レオナ',
        actions: [
          { name: '木相手選択やけど弱2連', element: '木', power: '2連撃(弱)', estimatedDamage: 8000, effectKind: 'burn', effectTarget: '相手選択', effectValue: 16, duration: 3 },
          { name: '木強2連', element: '木', power: '2連撃(強)', estimatedDamage: 10650 },
          { name: '木被ダメDOWN強2連', element: '木', power: '2連撃(強)', estimatedDamage: 10650, effectKind: 'damageTakenDown', effectTarget: '自', effectValue: 22.5, duration: 1 },
        ],
      },
    ],
  },
  {
    id: '2026/06-1水DF',
    title: '2026/06-1水DF',
    kind: 'DEFENCE',
    enemyElement: '水',
    enemyHp: 100000,
    enemies: [
      {
        name: 'カリム',
        actions: [
          { name: '相手選択呪い強単発', element: '水', power: '単発(強)', estimatedDamage: 4450, effectKind: 'curse', effectTarget: '相手選択', effectValue: 100, duration: 3 },
          { name: '強2連', element: '水', power: '2連撃(強)', estimatedDamage: 8050 },
          { name: 'ダメUP強2連', element: '水', power: '2連撃(強)', estimatedDamage: 8700, effectKind: 'damageUp', effectTarget: '自', effectValue: 8, duration: 1 },
        ],
      },
      {
        name: 'ジャミル',
        actions: [
          { name: 'ダメUP強単発', element: '水', power: '単発(強)', estimatedDamage: 8400, effectKind: 'damageUp', effectTarget: '自', effectValue: 5, duration: 3 },
          { name: '強2連', element: '水', power: '2連撃(強)', estimatedDamage: 14400 },
          { name: 'ATKUP強2連', element: '水', power: '2連撃(強)', estimatedDamage: 19000, effectKind: 'atkUp', effectTarget: '自', effectValue: 32, duration: 1 },
        ],
      },
    ],
  },
  {
    id: '2026/06-1火ATK',
    title: '2026/06-1火ATK',
    kind: 'ATTACK',
    enemyElement: '火',
    enemyHp: 220000,
    enemies: [
      {
        name: 'トレイ',
        actions: [
          { name: '強2連', element: '火', power: '2連撃(強)', estimatedDamage: 0, keepInDeckWhenDamageZero: true },
          { name: 'ダメUP強単発', element: '火', power: '単発(強)', estimatedDamage: 0, keepInDeckWhenDamageZero: true, effectKind: 'damageUp', effectTarget: '自', effectValue: 5, duration: 3 },
          { name: 'ATKUP強2連', element: '火', power: '2連撃(強)', estimatedDamage: 0, keepInDeckWhenDamageZero: true, effectKind: 'atkUp', effectTarget: '自', effectValue: 32, duration: 1 },
        ],
      },
      {
        name: 'リリア',
        actions: [
          { name: '強2連', element: '火', power: '2連撃(強)', estimatedDamage: 0, keepInDeckWhenDamageZero: true },
          { name: 'ダメUP強単発', element: '火', power: '単発(強)', estimatedDamage: 0, keepInDeckWhenDamageZero: true, effectKind: 'damageUp', effectTarget: '自', effectValue: 5, duration: 3 },
          { name: '味方選択ATKUP強単発', element: '火', power: '単発(強)', estimatedDamage: 0, keepInDeckWhenDamageZero: true, effectKind: 'atkUp', effectTarget: '味方選択', effectValue: 32, duration: 1 },
        ],
      },
    ],
  },
  {
    id: '第18回統一火DF',
    title: '第18回統一火DF',
    kind: 'DEFENCE',
    enemyElement: '火',
    enemyHp: 96000,
    difficulty: 1.5,
    enemies: [
      {
        name: 'ヴィル',
        actions: [
          { name: 'ATKUP強2連', element: '火', power: '2連撃(強)', estimatedDamage: 16162, effectKind: 'atkUp', effectTarget: '自', effectValue: 32, duration: 1 },
          { name: '強2連', element: '火', power: '2連撃(強)', estimatedDamage: 12244 },
          { name: 'ダメUP強単発', element: '火', power: '単発(強)', estimatedDamage: 7108, effectKind: 'damageUp', effectTarget: '自', effectValue: 4.5, duration: 3 },
        ],
      },
      {
        name: 'ルーク',
        actions: [
          { name: 'ATKUP強2連', element: '火', power: '2連撃(強)', estimatedDamage: 12560, effectKind: 'atkUp', effectTarget: '自', effectValue: 32, duration: 1 },
          { name: '強2連', element: '火', power: '2連撃(強)', estimatedDamage: 9515 },
          { name: 'ダメUP強単発', element: '火', power: '単発(強)', estimatedDamage: 5524, effectKind: 'damageUp', effectTarget: '自', effectValue: 4.5, duration: 3 },
        ],
      },
      {
        name: 'エペル',
        actions: [
          { name: '味方選択ATKUP強単発', element: '火', power: '単発(強)', estimatedDamage: 11558, effectKind: 'atkUp', effectTarget: '味方選択', effectValue: 30.5, duration: 1 },
          { name: 'ダメUP強単発', element: '火', power: '単発(強)', estimatedDamage: 9211, effectKind: 'damageUp', effectTarget: '自', effectValue: 4, duration: 1 },
          { name: '強2連', element: '火', power: '2連撃(強)', estimatedDamage: 15943 },
        ],
      },
    ],
    specialChallenges: [
      { id: 'player-curse-5t', rank: 3, label: '味方が呪い(5T)', score: 9000, effects: [{ kind: 'playerCurse', duration: 5 }] },
      { id: 'enemy-atk-up-3t-35', rank: 2, label: '相手がATKUP(3T/35%)', score: 4000, effects: [{ kind: 'enemyAttackUp', value: 35, duration: 3 }] },
      { id: 'enemy-damage-reduction-3t-10_5', rank: 2, label: '相手が被ダメDOWN(3T/10.5%)', score: 2500, effects: [{ kind: 'enemyDamageReduction', value: 10.5, duration: 3 }] },
      { id: 'enemy-evasion-2t-7_4', rank: 1, label: '相手が回避(2T/7.4%)', score: 500, effects: [{ kind: 'enemyEvasion', value: 7.4, duration: 2 }] },
      { id: 'player-damage-taken-up-2t-4_3', rank: 1, label: '味方が被ダメUP(2T/4.3%)', score: 500, effects: [{ kind: 'playerDamageTakenUp', value: 4.3, duration: 2 }] },
      { id: 'enemy-continue-heal-2t-4799', rank: 1, label: '相手がHP継続回復(2T/4799×2)', score: 500, effects: [{ kind: 'enemyContinueHeal', value: 4799, duration: 2 }] },
    ],
  },
  {
    id: '第18回統一水ATK',
    title: '第18回統一水ATK',
    kind: 'ATTACK',
    enemyElement: '水',
    enemyHp: 208000,
    difficulty: 1.5,
    enemies: [
      {
        name: 'イデア',
        actions: [
          { name: '相手選択バフ解除強単発', element: '水', power: '単発(強)', estimatedDamage: 3683, effectKind: 'buffRemoval', effectTarget: '相手選択', duration: 1, fixedOrder: 6 },
          { name: '相手選択バフ解除弱2連', element: '水', power: '2連撃(弱)', estimatedDamage: 4972, effectKind: 'buffRemoval', effectTarget: '相手選択', duration: 1 },
          { name: '強2連', element: '水', power: '2連撃(強)', estimatedDamage: 6629 },
          { name: 'ATKUP強2連', element: '水', power: '2連撃(強)', estimatedDamage: 8850, effectKind: 'atkUp', effectTarget: '自', effectValue: 33.5, duration: 1 },
        ],
      },
      {
        name: 'オルト',
        actions: [
          { name: 'ATKUP強2連', element: '水', power: '2連撃(強)', estimatedDamage: 7313, effectKind: 'atkUp', effectTarget: '自', effectValue: 32, duration: 1, preferFirstDuplicate: true },
          { name: '強2連', element: '水', power: '2連撃(強)', estimatedDamage: 5540, preferFirstDuplicate: true },
          { name: 'ダメUP強単発', element: '水', power: '単発(強)', estimatedDamage: 3244, effectKind: 'damageUp', effectTarget: '自', effectValue: 5.4, duration: 3, preferFirstDuplicate: true },
        ],
      },
    ],
    specialChallenges: [
      { id: 'player-freeze-10t', rank: 3, label: '味方が凍結(10T)', score: 8500, effects: [{ kind: 'playerFreeze', duration: 10 }] },
      { id: 'enemy-atk-up-5t-40', rank: 2, label: '相手がATKUP(5T/40%)', score: 3000, effects: [{ kind: 'enemyAttackUp', value: 40, duration: 5 }] },
      { id: 'player-burn-5t-5', rank: 2, label: '味方がやけど(5T/5%)', score: 3500, effects: [{ kind: 'playerBurn', value: 5, duration: 5 }] },
      { id: 'player-damage-down-2t-4_5', rank: 1, label: '味方がダメDOWN(2T/4.5%)', score: 400, effects: [{ kind: 'playerDamageDown', value: 4.5, duration: 2 }] },
      { id: 'enemy-hp-up-239199', rank: 1, label: '相手がHPUP(239199)', score: 300, effects: [{ kind: 'enemyMaxHp', value: 239199 }] },
      { id: 'player-damage-taken-up-2t-4', rank: 1, label: '味方が被ダメUP(2T/4%)', score: 300, effects: [{ kind: 'playerDamageTakenUp', value: 4, duration: 2 }] },
    ],
  },
  {
    id: '第18回統一木BS',
    title: '第18回統一木BS',
    kind: 'BASIC',
    enemyElement: '木',
    enemyHp: 115000,
    difficulty: 1.5,
    enemies: [
      {
        name: 'アズール',
        actions: [
          { name: 'ATKDOWN強2連', element: '木', power: '2連撃(強)', estimatedDamage: 7353, effectKind: 'atkDown', effectTarget: '相手', effectValue: 32, duration: 1 },
          { name: '強2連', element: '木', power: '2連撃(強)', estimatedDamage: 7353 },
          { name: '強単発', element: '木', power: '単発(強)', estimatedDamage: 4085 },
        ],
      },
      {
        name: 'ジェイド',
        actions: [
          { name: 'ダメUP強単発', element: '木', power: '単発(強)', estimatedDamage: 4523, effectKind: 'damageUp', effectTarget: '自', effectValue: 5.4, duration: 3 },
          { name: '強2連', element: '木', power: '2連撃(強)', estimatedDamage: 7724 },
          { name: 'ATKUP強2連', element: '木', power: '2連撃(強)', estimatedDamage: 10195, effectKind: 'atkUp', effectTarget: '自', effectValue: 32, duration: 1 },
        ],
      },
      {
        name: 'フロイド',
        actions: [
          { name: 'ダメUP強2連', element: '木', power: '2連撃(強)', estimatedDamage: 7835, effectKind: 'damageUp', effectTarget: '自', effectValue: 8, duration: 1 },
          { name: '相手選択ATKDOWN強単発', element: '木', power: '単発(強)', estimatedDamage: 7268, effectKind: 'atkDown', effectTarget: '相手選択', effectValue: 32, duration: 1 },
          { name: '強2連', element: '木', power: '2連撃(強)', estimatedDamage: 4038 },
        ],
      },
    ],
    specialChallenges: [
      { id: 'enemy-atk-up-5t-61', rank: 3, label: '相手がATKUP(5T/61%)', score: 8500, effects: [{ kind: 'enemyAttackUp', value: 61, duration: 5 }] },
      { id: 'enemy-damage-reduction-3t-10', rank: 2, label: '相手が被ダメDOWN(3T/10%)', score: 3000, effects: [{ kind: 'enemyDamageReduction', value: 10, duration: 3 }] },
      { id: 'enemy-fire-damage-reduction-3t-13_8', rank: 2, label: '相手が火属性被ダメDOWN(3T/13.8%)', score: 3500, effects: [{ kind: 'enemyDamageReduction', value: 13.8, duration: 3, attribute: '火' }] },
      { id: 'player-blind-2t-7', rank: 1, label: '味方が暗闇(2T/7%)', score: 500, effects: [{ kind: 'playerBlind', value: 7, duration: 2 }] },
      { id: 'player-atk-down-2t-20', rank: 1, label: '味方がATKDOWN(2T/20%)', score: 800, effects: [{ kind: 'playerAttackDown', value: 20, duration: 2 }] },
      { id: 'enemy-critical-2t-10', rank: 1, label: '相手がクリティカル(2T/10%)', score: 500, effects: [{ kind: 'enemyCritical', value: 10, duration: 2 }] },
    ],
  },
  {
    id: '第18回統一無ATK',
    title: '第18回統一無ATK',
    kind: 'ATTACK',
    enemyElement: '無',
    enemyHp: 170000,
    difficulty: 1.5,
    enemies: [
      {
        name: 'マレウス',
        actions: [
          { name: 'ATKUP強単発', element: '無', power: '単発(強)', estimatedDamage: 2645, effectKind: 'atkUp', effectTarget: '自', effectValue: 20, duration: 1 },
          { name: 'ATKUP強2連', element: '無', power: '2連撃(強)', estimatedDamage: 5119, effectKind: 'atkUp', effectTarget: '自', effectValue: 29, duration: 1 },
          { name: 'ダメUP強単発', element: '無', power: '単発(強)', estimatedDamage: 2271, effectKind: 'damageUp', effectTarget: '自', effectValue: 3.25, duration: 3 },
        ],
      },
      {
        name: 'リリア',
        actions: [
          { name: 'ATKUP強2連', element: '無', power: '2連撃(強)', estimatedDamage: 5225, effectKind: 'atkUp', effectTarget: '自', effectValue: 30.5, duration: 1 },
          { name: 'ATKUP強単発', element: '無', power: '単発(強)', estimatedDamage: 2802, effectKind: 'atkUp', effectTarget: '自', effectValue: 26, duration: 1 },
          { name: 'ダメUP強単発', element: '無', power: '単発(強)', estimatedDamage: 2255, effectKind: 'damageUp', effectTarget: '自', effectValue: 1.5, duration: 3 },
        ],
      },
      {
        name: 'シルバー',
        actions: [
          { name: 'ATKUP強2連', element: '無', power: '2連撃(強)', estimatedDamage: 5805, effectKind: 'atkUp', effectTarget: '自', effectValue: 33.5, duration: 1 },
          { name: 'ダメUP強単発', element: '無', power: '単発(強)', estimatedDamage: 2558, effectKind: 'damageUp', effectTarget: '自', effectValue: 6.5, duration: 3 },
          { name: '強2連', element: '無', power: '2連撃(強)', estimatedDamage: 4348 },
        ],
      },
      {
        name: 'セベク',
        actions: [
          { name: 'ATKUP強2連', element: '無', power: '2連撃(強)', estimatedDamage: 5826, effectKind: 'atkUp', effectTarget: '自', effectValue: 32, duration: 1 },
          { name: 'ダメUP強単発', element: '無', power: '単発(強)', estimatedDamage: 2559, effectKind: 'damageUp', effectTarget: '自', effectValue: 4.75, duration: 3 },
          { name: '強2連', element: '無', power: '2連撃(強)', estimatedDamage: 4413 },
        ],
      },
    ],
    specialChallenges: [
      { id: 'non-diasomnia-damage-down-10t-20_5', rank: 3, label: 'ディアソ以外にダメDOWN(10T/20.5%)', score: 8500, effects: [{ kind: 'playerDamageDown', value: 20.5, duration: 10, dorm: 'ディアソムニア', dormMode: 'exclude' }] },
      { id: 'enemy-critical-5t-9_72', rank: 2, label: '相手がクリティカル(5T/9.72%)', score: 3000, effects: [{ kind: 'enemyCritical', value: 9.72, duration: 5 }] },
      { id: 'enemy-cosmic-damage-up-5t-10', rank: 2, label: '相手が無属性ダメUP(5T/10%)', score: 3000, effects: [{ kind: 'enemyDamageUp', value: 10, duration: 5, attribute: '無' }] },
      { id: 'enemy-fire-damage-null-2t', rank: 1, label: '相手が火属性ダメ無効(2T)', score: 500, effects: [{ kind: 'enemyDamageNull', duration: 2, attribute: '火' }] },
      { id: 'enemy-water-damage-null-2t', rank: 1, label: '相手が水属性ダメ無効(2T)', score: 500, effects: [{ kind: 'enemyDamageNull', duration: 2, attribute: '水' }] },
      { id: 'enemy-flora-damage-null-2t', rank: 1, label: '相手が木属性ダメ無効(2T)', score: 500, effects: [{ kind: 'enemyDamageNull', duration: 2, attribute: '木' }] },
    ],
  },
  {
    id: '第18回統一全BS',
    title: '第18回統一全BS',
    kind: 'BASIC',
    enemyElement: '全',
    enemyHp: 117000,
    difficulty: 1.5,
    enemies: [
      {
        name: 'リドル',
        actions: [
          { name: '無強2連', element: '無', power: '2連撃(強)', estimatedDamage: 6037 },
          { name: '無ダメUP強2連', element: '無', power: '2連撃(強)', estimatedDamage: 6443, effectKind: 'damageUp', effectTarget: '自', effectValue: 7.25, duration: 1 },
          { name: '無相手選択凍結強単発', element: '無', power: '単発(強)', estimatedDamage: 3354, effectKind: 'freeze', effectTarget: '相手選択', effectValue: 100, duration: 3 },
        ],
      },
      {
        name: 'トレイ',
        actions: [
          { name: '火強2連', element: '火', power: '2連撃(強)', estimatedDamage: 9621 },
          { name: '火ダメUP強単発', element: '火', power: '単発(強)', estimatedDamage: 5671, effectKind: 'damageUp', effectTarget: '自', effectValue: 6.125, duration: 3 },
          { name: '火ATKUP強2連', element: '火', power: '2連撃(強)', estimatedDamage: 12700, effectKind: 'atkUp', effectTarget: '自', effectValue: 32, duration: 1 },
        ],
      },
      {
        name: 'ケイト',
        actions: [
          { name: '水ATKUP強2連', element: '水', power: '2連撃(強)', estimatedDamage: 12049, effectKind: 'atkUp', effectTarget: '自', effectValue: 32, duration: 1 },
          { name: '水強2連', element: '水', power: '2連撃(強)', estimatedDamage: 9128 },
          { name: '水相手選択バフ解除弱2連', element: '水', power: '2連撃(弱)', estimatedDamage: 6846, effectKind: 'buffRemoval', effectTarget: '相手選択', duration: 1 },
        ],
      },
      {
        name: 'エース',
        actions: [
          { name: '木強2連', element: '木', power: '2連撃(強)', estimatedDamage: 9081 },
          { name: '木ATKUP強2連', element: '木', power: '2連撃(強)', estimatedDamage: 11987, effectKind: 'atkUp', effectTarget: '自', effectValue: 32, duration: 1 },
          { name: '木ダメUP強単発', element: '木', power: '単発(強)', estimatedDamage: 5317, effectKind: 'damageUp', effectTarget: '自', effectValue: 5.375, duration: 3 },
        ],
      },
      {
        name: 'デュース',
        actions: [
          { name: '火強2連', element: '火', power: '2連撃(強)', estimatedDamage: 5823 },
          { name: '火ダメUP強単発', element: '火', power: '単発(強)', estimatedDamage: 3400, effectKind: 'damageUp', effectTarget: '自', effectValue: 5.375, duration: 3 },
          { name: '無ATKUP強2連', element: '無', power: '2連撃(強)', estimatedDamage: 8455, effectKind: 'atkUp', effectTarget: '自', effectValue: 32, duration: 1 },
          { name: '無強2連', element: '無', power: '2連撃(強)', estimatedDamage: 6405 },
        ],
      },
    ],
    specialChallenges: [
      { id: 'enemy-critical-5t-16_2', rank: 3, label: '相手がクリティカル(5T/16.2%)', score: 8000, effects: [{ kind: 'enemyCritical', value: 16.2, duration: 5 }] },
      { id: 'player-blind-3t-8_8', rank: 2, label: '味方が暗闇(3T/8.8%)', score: 4000, effects: [{ kind: 'playerBlind', value: 8.8, duration: 3 }] },
      { id: 'non-heartslabyul-atk-down-3t-30', rank: 2, label: 'ハーツ以外にATKDOWN(3T/30%)', score: 4000, effects: [{ kind: 'playerAttackDown', value: 30, duration: 3, dorm: 'ハーツラビュル', dormMode: 'exclude' }] },
      { id: 'player-damage-taken-up-2t-4_5', rank: 1, label: '味方が被ダメUP(2T/4.5%)', score: 300, effects: [{ kind: 'playerDamageTakenUp', value: 4.5, duration: 2 }] },
      { id: 'enemy-atk-up-2t-18', rank: 1, label: '相手がATKUP(2T/18%)', score: 400, effects: [{ kind: 'enemyAttackUp', value: 18, duration: 2 }] },
      { id: 'enemy-cosmic-damage-null-2t', rank: 1, label: '相手が無属性ダメ無効(2T)', score: 500, effects: [{ kind: 'enemyDamageNull', duration: 2, attribute: '無' }] },
    ],
  },
  {
    id: '第17回統一火ATK',
    title: '第17回統一火ATK',
    kind: 'ATTACK',
    enemyElement: '火',
    enemyHp: 217000,
    difficulty: 1.5,
    enemies: [
      {
        name: 'レオナ',
        actions: [
          { name: '強2連', element: '火', power: '2連撃(強)', estimatedDamage: 0, keepInDeckWhenDamageZero: true },
          { name: 'ダメUP強単発', element: '火', power: '単発(強)', estimatedDamage: 0, keepInDeckWhenDamageZero: true, effectKind: 'damageUp', effectTarget: '自', effectValue: 5, duration: 3 },
          { name: 'ATKUP強2連', element: '火', power: '2連撃(強)', estimatedDamage: 0, keepInDeckWhenDamageZero: true, effectKind: 'atkUp', effectTarget: '自', effectValue: 32, duration: 1 },
        ],
      },
      {
        name: 'ラギー',
        actions: [
          { name: '強単発', element: '火', power: '単発(強)', estimatedDamage: 0, keepInDeckWhenDamageZero: true },
          { name: '強2連', element: '火', power: '2連撃(強)', estimatedDamage: 0, keepInDeckWhenDamageZero: true },
          { name: '回復強2連', element: '火', power: '2連撃(強)', estimatedDamage: 0, keepInDeckWhenDamageZero: true, effectKind: 'heal', effectTarget: '自', effectValue: 3931, duration: 1 },
        ],
      },
      {
        name: 'ジャック',
        actions: [
          { name: '強単発', element: '火', power: '単発(強)', estimatedDamage: 0, keepInDeckWhenDamageZero: true },
          { name: '強2連', element: '火', power: '2連撃(強)', estimatedDamage: 0, keepInDeckWhenDamageZero: true },
          { name: 'ATKDOWN強2連', element: '火', power: '2連撃(強)', estimatedDamage: 0, keepInDeckWhenDamageZero: true, effectKind: 'atkDown', effectTarget: '相手', effectValue: 32, duration: 1 },
        ],
      },
    ],
    specialChallenges: [
      { id: 'enemy-hp-up-314649', rank: 3, label: '相手HPup(314649)', score: 8000, effects: [{ kind: 'enemyMaxHp', value: 314649 }] },
      { id: 'player-freeze-5t', rank: 2, label: '味方凍結(5T)', score: 2000, effects: [{ kind: 'playerFreeze', duration: 5 }] },
      { id: 'enemy-damage-reduction-5t-10', rank: 2, label: '相手被ダメDOWN(5T/約10%)', score: 2000, effects: [{ kind: 'enemyDamageReduction', value: 10, duration: 5 }] },
      { id: 'enemy-evasion-2t', rank: 1, label: '相手回避(2T)', score: 500, effects: [{ kind: 'enemyEvasion', value: 14.8, duration: 2 }] },
      { id: 'enemy-fire-damage-up-2t', rank: 1, label: '相手火ダメUP(2T)', score: 200, effects: [{ kind: 'enemyDamageUp', value: 5, duration: 2, attribute: '火' }] },
      { id: 'enemy-fire-damage-null-2t', rank: 1, label: '相手火ダメ無効(2T)', score: 500, effects: [{ kind: 'enemyDamageNull', duration: 2, attribute: '火' }] },
    ],
  },
  {
    id: '第17回統一水DF',
    title: '第17回統一水DF',
    kind: 'DEFENCE',
    enemyElement: '水',
    enemyHp: 98000,
    difficulty: 1.5,
    enemies: [
      {
        name: 'フロイド',
        actions: [
          { name: '相手選択やけど弱2連', element: '水', power: '2連撃(弱)', estimatedDamage: 7350, effectKind: 'burn', effectTarget: '相手選択', effectValue: 16, duration: 3 },
          { name: '強2連', element: '水', power: '2連撃(強)', estimatedDamage: 9800 },
          { name: '被ダメDOWN強2連', element: '水', power: '2連撃(強)', estimatedDamage: 9800, effectKind: 'damageTakenDown', effectTarget: '自', effectValue: 22.5, duration: 1 },
        ],
      },
      {
        name: 'ジェイド',
        actions: [
          { name: 'ダメUP強単発', element: '水', power: '単発(強)', estimatedDamage: 6450, effectKind: 'damageUp', effectTarget: '自', effectValue: 5, duration: 3 },
          { name: '強2連', element: '水', power: '2連撃(強)', estimatedDamage: 11000 },
          { name: 'ATKUP強2連', element: '水', power: '2連撃(強)', estimatedDamage: 14550, effectKind: 'atkUp', effectTarget: '自', effectValue: 32, duration: 1 },
        ],
      },
      {
        name: 'アズール',
        actions: [
          { name: '弱3連', element: '水', power: '3連撃(弱)', estimatedDamage: 11100 },
          { name: '強3連', element: '水', power: '3連撃(強)', estimatedDamage: 14800 },
          { name: 'ATKUP弱3連', element: '水', power: '3連撃(弱)', estimatedDamage: 14650, effectKind: 'atkUp', effectTarget: '自', effectValue: 32, duration: 1 },
        ],
      },
    ],
    specialChallenges: [
      { id: 'player-freeze-5t', rank: 3, label: '味方凍結(5T)', score: 8000, effects: [{ kind: 'playerFreeze', duration: 5 }] },
      { id: 'player-damage-taken-up-3t-8_75', rank: 2, label: '味方被ダメUP(3T/約8.75%)', score: 2000, effects: [{ kind: 'playerDamageTakenUp', value: 8.75, duration: 3 }] },
      { id: 'enemy-continue-heal-3t-4899', rank: 2, label: '相手継続回復(3T/4899×3)', score: 2000, effects: [{ kind: 'enemyContinueHeal', value: 4899, duration: 3 }] },
      { id: 'non-octavinelle-curse-2t', rank: 1, label: 'オクタ以外に呪い(2T)', score: 500, effects: [{ kind: 'playerCurse', duration: 2, dorm: 'オクタヴィネル', dormMode: 'exclude' }] },
      { id: 'enemy-atk-up-2t-20_3', rank: 1, label: '相手ATKUP(2T/約20.3%)', score: 200, effects: [{ kind: 'enemyAttackUp', value: 20.3, duration: 2 }] },
      { id: 'enemy-damage-reduction-2t-4_5', rank: 1, label: '相手被ダメDOWN(2T/約4.5%)', score: 300, effects: [{ kind: 'enemyDamageReduction', value: 4.5, duration: 2 }] },
    ],
  },
  {
    id: '第17回統一木ATK',
    title: '第17回統一木ATK',
    kind: 'ATTACK',
    enemyElement: '木',
    enemyHp: 226000,
    difficulty: 1.5,
    enemies: [
      {
        name: 'リドル',
        actions: [
          { name: '強2連', element: '木', power: '2連撃(強)', estimatedDamage: 0, keepInDeckWhenDamageZero: true },
          { name: 'ダメUP強単発', element: '木', power: '単発(強)', estimatedDamage: 0, keepInDeckWhenDamageZero: true, effectKind: 'damageUp', effectTarget: '自', effectValue: 5, duration: 3 },
          { name: 'ATKUP強2連', element: '木', power: '2連撃(強)', estimatedDamage: 0, keepInDeckWhenDamageZero: true, effectKind: 'atkUp', effectTarget: '自', effectValue: 32, duration: 1 },
        ],
      },
      {
        name: 'エース',
        actions: [
          { name: '強2連', element: '木', power: '2連撃(強)', estimatedDamage: 0, keepInDeckWhenDamageZero: true },
          { name: 'ダメUP強2連', element: '木', power: '2連撃(強)', estimatedDamage: 0, keepInDeckWhenDamageZero: true, effectKind: 'damageUp', effectTarget: '自', effectValue: 5, duration: 3 },
          { name: '相手選択凍結強単発', element: '木', power: '単発(強)', estimatedDamage: 0, keepInDeckWhenDamageZero: true, effectKind: 'freeze', effectTarget: '相手選択', effectValue: 100, duration: 3 },
        ],
      },
      {
        name: 'デュース',
        actions: [
          { name: '強2連', element: '木', power: '2連撃(強)', estimatedDamage: 0, keepInDeckWhenDamageZero: true },
          { name: 'ダメUP強2連', element: '木', power: '2連撃(強)', estimatedDamage: 0, keepInDeckWhenDamageZero: true, effectKind: 'damageUp', effectTarget: '自', effectValue: 5, duration: 3 },
          { name: '相手選択凍結強単発', element: '木', power: '単発(強)', estimatedDamage: 0, keepInDeckWhenDamageZero: true, effectKind: 'freeze', effectTarget: '相手選択', effectValue: 100, duration: 3 },
        ],
      },
      {
        name: 'ケイト',
        actions: [
          { name: '強2連', element: '木', power: '2連撃(強)', estimatedDamage: 0, keepInDeckWhenDamageZero: true },
          { name: 'ダメUP強単発', element: '木', power: '単発(強)', estimatedDamage: 0, keepInDeckWhenDamageZero: true, effectKind: 'damageUp', effectTarget: '自', effectValue: 5, duration: 3 },
          { name: 'ATKUP強2連', element: '木', power: '2連撃(強)', estimatedDamage: 0, keepInDeckWhenDamageZero: true, effectKind: 'atkUp', effectTarget: '自', effectValue: 32, duration: 1 },
        ],
      },
      {
        name: 'トレイ',
        actions: [
          { name: '強2連', element: '木', power: '2連撃(強)', estimatedDamage: 0, keepInDeckWhenDamageZero: true },
          { name: 'ダメUP強単発', element: '木', power: '単発(強)', estimatedDamage: 0, keepInDeckWhenDamageZero: true, effectKind: 'damageUp', effectTarget: '自', effectValue: 5, duration: 3 },
          { name: 'ATKUP強2連', element: '木', power: '2連撃(強)', estimatedDamage: 0, keepInDeckWhenDamageZero: true, effectKind: 'atkUp', effectTarget: '自', effectValue: 32, duration: 1 },
        ],
      },
    ],
    specialChallenges: [
      { id: 'player-damage-down-10t-18_5', rank: 3, label: '味方ダメDOWN(10T/約18.5%)', score: 8000, effects: [{ kind: 'playerDamageDown', value: 18.5, duration: 10 }] },
      { id: 'player-damage-taken-up-5t-8_75', rank: 2, label: '味方被ダメUP(5T)', score: 2000, effects: [{ kind: 'playerDamageTakenUp', value: 8.75, duration: 5 }] },
      { id: 'enemy-atk-up-5t-32', rank: 2, label: '相手ATKUP(5T)', score: 2000, effects: [{ kind: 'enemyAttackUp', value: 32, duration: 5 }] },
      { id: 'player-blind-2t', rank: 1, label: '味方暗闇(2T)', score: 500, effects: [{ kind: 'playerBlind', value: 21.6, duration: 2 }] },
      { id: 'player-burn-2t', rank: 1, label: '味方やけど(2T)', score: 500, effects: [{ kind: 'playerBurn', value: 16, duration: 2 }] },
      { id: 'enemy-critical-small-2t', rank: 1, label: '相手クリ(2T)', score: 500, effects: [{ kind: 'enemyCritical', value: 19.1, duration: 2 }] },
    ],
  },
  {
    id: '第17回統一無BS',
    title: '第17回統一無BS',
    kind: 'BASIC',
    enemyElement: '無',
    enemyHp: 94000,
    difficulty: 1.5,
    enemies: [
      {
        name: 'カリム',
        actions: [
          { name: '強2連', element: '無', power: '2連撃(強)', estimatedDamage: 0, keepInDeckWhenDamageZero: true },
          { name: 'ダメUP強単発', element: '無', power: '単発(強)', estimatedDamage: 0, keepInDeckWhenDamageZero: true, effectKind: 'damageUp', effectTarget: '自', effectValue: 5, duration: 3 },
          { name: 'ATKUP強2連', element: '無', power: '2連撃(強)', estimatedDamage: 0, keepInDeckWhenDamageZero: true, effectKind: 'atkUp', effectTarget: '自', effectValue: 32, duration: 1 },
        ],
      },
      {
        name: 'ジャミル',
        actions: [
          { name: '強2連', element: '無', power: '2連撃(強)', estimatedDamage: 0, keepInDeckWhenDamageZero: true },
          { name: 'ダメUP強単発', element: '無', power: '単発(強)', estimatedDamage: 0, keepInDeckWhenDamageZero: true, effectKind: 'damageUp', effectTarget: '自', effectValue: 5, duration: 3 },
          { name: '味方選択ATKUP強単発', element: '無', power: '単発(強)', estimatedDamage: 0, keepInDeckWhenDamageZero: true, effectKind: 'atkUp', effectTarget: '味方選択', effectValue: 32, duration: 1 },
        ],
      },
    ],
    specialChallenges: [
      { id: 'enemy-damage-reduction-5t-18_5', rank: 3, label: '相手被ダメDOWN(5T/約18.5%)', score: 8000, effects: [{ kind: 'enemyDamageReduction', value: 18.5, duration: 5 }] },
      { id: 'non-scarabia-damage-down-3t-10', rank: 2, label: 'スカラ以外ダメDOWN(3T/約10%)', score: 2500, effects: [{ kind: 'playerDamageDown', value: 10, duration: 3, dorm: 'スカラビア', dormMode: 'exclude' }] },
      { id: 'player-damage-down-3t-9', rank: 2, label: '味方ダメDOWN(3T/約9%)', score: 2000, effects: [{ kind: 'playerDamageDown', value: 9, duration: 3 }] },
      { id: 'enemy-atk-up-2t-32', rank: 1, label: '相手ATKUP(2T)', score: 400, effects: [{ kind: 'enemyAttackUp', value: 32, duration: 2 }] },
      { id: 'player-damage-taken-up-2t-8_75', rank: 1, label: '味方被ダメUP(2T)', score: 300, effects: [{ kind: 'playerDamageTakenUp', value: 8.75, duration: 2 }] },
      { id: 'player-freeze-2t', rank: 1, label: '味方凍結(2T)', score: 500, effects: [{ kind: 'playerFreeze', duration: 2 }] },
    ],
  },
  {
    id: '第17回統一全DF',
    title: '第17回統一全DF',
    kind: 'DEFENCE',
    enemyElement: '全',
    enemyHp: 95000,
    difficulty: 1.5,
    enemies: [
      {
        name: 'エペル',
        actions: [
          { name: '火ダメUP強単発', element: '火', power: '単発(強)', estimatedDamage: 7100, effectKind: 'damageUp', effectTarget: '自', effectValue: 5, duration: 3 },
          { name: '火ATKUP強単発', element: '火', power: '単発(強)', estimatedDamage: 8200, effectKind: 'atkUp', effectTarget: '自', effectValue: 21.5, duration: 1 },
          { name: '火ATKUP強2連', element: '火', power: '2連撃(強)', estimatedDamage: 16050, effectKind: 'atkUp', effectTarget: '自', effectValue: 32, duration: 1 },
        ],
      },
      {
        name: 'ルーク',
        actions: [
          { name: '水ダメUP強単発', element: '水', power: '単発(強)', estimatedDamage: 7750, effectKind: 'damageUp', effectTarget: '自', effectValue: 5, duration: 3 },
          { name: '水強2連', element: '水', power: '2連撃(強)', estimatedDamage: 13250 },
          { name: '水ATKUP強2連', element: '水', power: '2連撃(強)', estimatedDamage: 17500, effectKind: 'atkUp', effectTarget: '自', effectValue: 32, duration: 1 },
        ],
      },
      {
        name: 'ヴィル',
        actions: [
          { name: '木強単発', element: '木', power: '単発(強)', estimatedDamage: 7200 },
          { name: '木強2連', element: '木', power: '2連撃(強)', estimatedDamage: 12950 },
          { name: '無相手選択呪い強単発', element: '無', power: '単発(強)', estimatedDamage: 7900, effectKind: 'curse', effectTarget: '相手選択', effectValue: 100, duration: 3 },
          { name: '無ダメUP強2連', element: '無', power: '2連撃(強)', estimatedDamage: 15300, effectKind: 'damageUp', effectTarget: '自', effectValue: 8, duration: 1 },
        ],
      },
    ],
    specialChallenges: [
      { id: 'enemy-atk-up-5t-60', rank: 3, label: '相手ATKUP(5T/約60%)', score: 8000, effects: [{ kind: 'enemyAttackUp', value: 60, duration: 5 }] },
      { id: 'player-freeze-3t', rank: 2, label: '味方凍結(3T)', score: 2500, effects: [{ kind: 'playerFreeze', duration: 3 }] },
      { id: 'enemy-damage-reduction-3t-8_75', rank: 2, label: '相手被ダメDOWN(3T/約8.75%)', score: 2000, effects: [{ kind: 'enemyDamageReduction', value: 8.75, duration: 3 }] },
      { id: 'player-damage-down-2t-4', rank: 1, label: '味方ダメDOWN(2T/約4%)', score: 200, effects: [{ kind: 'playerDamageDown', value: 4, duration: 2 }] },
      { id: 'player-curse-2t', rank: 1, label: '味方呪い(2T)', score: 300, effects: [{ kind: 'playerCurse', duration: 2 }] },
      { id: 'enemy-critical-small-2t', rank: 1, label: '相手クリ(2T)', score: 500, effects: [{ kind: 'enemyCritical', value: 19.1, duration: 2 }] },
    ],
  },
  {
    id: '2026/05-2全ATK',
    title: '2026/05-2全ATK',
    kind: 'ATTACK',
    enemyElement: '全',
    enemyHp: 225000,
    enemies: [
      {
        name: 'カリム',
        actions: [
          { name: 'ダメUP強単発', element: '火', power: '単発(強)', estimatedDamage: 0, keepInDeckWhenDamageZero: true, effectKind: 'damageUp', effectTarget: '自', effectValue: 5, duration: 3 },
          { name: 'ATKUP強単発', element: '火', power: '単発(強)', estimatedDamage: 0, keepInDeckWhenDamageZero: true, effectKind: 'atkUp', effectTarget: '自', effectValue: 32, duration: 1 },
          { name: 'ATKUP強2連', element: '火', power: '2連撃(強)', estimatedDamage: 0, keepInDeckWhenDamageZero: true, effectKind: 'atkUp', effectTarget: '自', effectValue: 32, duration: 1 },
        ],
      },
      {
        name: 'ジャミル',
        actions: [
          { name: '強2連', element: '水', power: '2連撃(強)', estimatedDamage: 0, keepInDeckWhenDamageZero: true },
          { name: 'バフ解除弱2連', element: '水', power: '2連撃(弱)', estimatedDamage: 0, keepInDeckWhenDamageZero: true, effectKind: 'buffRemoval', effectTarget: '相手選択', effectValue: 0, duration: 1 },
          { name: 'ATKUP強2連', element: '水', power: '2連撃(強)', estimatedDamage: 0, keepInDeckWhenDamageZero: true, effectKind: 'atkUp', effectTarget: '自', effectValue: 32, duration: 1 },
        ],
      },
      {
        name: 'フロイド',
        actions: [
          { name: '強2連', element: '木', power: '2連撃(強)', estimatedDamage: 0, keepInDeckWhenDamageZero: true },
          { name: 'ダメUP強単発', element: '木', power: '単発(強)', estimatedDamage: 0, keepInDeckWhenDamageZero: true, effectKind: 'damageUp', effectTarget: '自', effectValue: 5, duration: 3 },
          { name: 'ATKUP強2連', element: '木', power: '2連撃(強)', estimatedDamage: 0, keepInDeckWhenDamageZero: true, effectKind: 'atkUp', effectTarget: '自', effectValue: 32, duration: 1 },
        ],
      },
      {
        name: 'アズール',
        actions: [
          { name: '強2連', element: '無', power: '2連撃(強)', estimatedDamage: 0, keepInDeckWhenDamageZero: true },
          { name: 'ダメUP強単発', element: '無', power: '単発(強)', estimatedDamage: 0, keepInDeckWhenDamageZero: true, effectKind: 'damageUp', effectTarget: '自', effectValue: 5, duration: 3 },
          { name: 'ATKUP強2連', element: '無', power: '2連撃(強)', estimatedDamage: 0, keepInDeckWhenDamageZero: true, effectKind: 'atkUp', effectTarget: '自', effectValue: 32, duration: 1 },
        ],
      },
    ],
  },
  {
    id: '2026/05-2無BS',
    title: '2026/05-2無BS',
    kind: 'BASIC',
    enemyElement: '無',
    enemyHp: 90000,
    enemies: [
      {
        name: 'トレイ',
        actions: [
          { name: '強2連', element: '無', power: '2連撃(強)', estimatedDamage: 0, keepInDeckWhenDamageZero: true },
          { name: 'ダメUP強2連', element: '無', power: '2連撃(強)', estimatedDamage: 0, keepInDeckWhenDamageZero: true, effectKind: 'damageUp', effectTarget: '自', effectValue: 5, duration: 3 },
          { name: '相手選択凍結強単発', element: '無', power: '単発(強)', estimatedDamage: 0, keepInDeckWhenDamageZero: true, effectKind: 'freeze', effectTarget: '相手選択', effectValue: 100, duration: 3 },
        ],
      },
      {
        name: 'ルーク',
        actions: [
          { name: '強2連', element: '無', power: '2連撃(強)', estimatedDamage: 0, keepInDeckWhenDamageZero: true },
          { name: 'ダメUP強単発', element: '無', power: '単発(強)', estimatedDamage: 0, keepInDeckWhenDamageZero: true, effectKind: 'damageUp', effectTarget: '自', effectValue: 5, duration: 3 },
          { name: 'ATKUP強2連', element: '無', power: '2連撃(強)', estimatedDamage: 0, keepInDeckWhenDamageZero: true, effectKind: 'atkUp', effectTarget: '自', effectValue: 32, duration: 1 },
        ],
      },
      {
        name: 'ジェイド',
        actions: [
          { name: '強2連', element: '無', power: '2連撃(強)', estimatedDamage: 0, keepInDeckWhenDamageZero: true },
          { name: 'ダメUP強単発', element: '無', power: '単発(強)', estimatedDamage: 0, keepInDeckWhenDamageZero: true, effectKind: 'damageUp', effectTarget: '自', effectValue: 5, duration: 3 },
          { name: 'ATKUP強2連', element: '無', power: '2連撃(強)', estimatedDamage: 0, keepInDeckWhenDamageZero: true, effectKind: 'atkUp', effectTarget: '自', effectValue: 32, duration: 1 },
        ],
      },
    ],
  },
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
