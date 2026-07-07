import type { Character } from '@/store/characters'
import { normalizeLegacyDeckBuffs, parseMagicBuffsFromEtc } from '@/utils/buffParser';
import { calculateLegacyBuddyContinueHealAmount, getBuddyStatusForCharacter, getBuddyStatusSummary } from '@/utils/buddyEffects';
import { isM3Unlocked } from '@/utils/totsu';
import { DeckSearchResultsManager, type DeckResult } from './TopNResultsManager';
import { toRaw } from 'vue';
const charaIdMap = new Map<string, number>();
// 探索ループ内で毎回 new すると GC が増えるため、作業用バッファはモジュールスコープで再利用する。
let memberFlags = new Uint32Array(0); // Opt-296: memberFlags を再利用して割り当てを削減
let memberFlagsStamp = 0; // Opt-296: スタンプ方式で初期化コストを削減
let charaIdsScratch = new Int16Array(0);
let duoIdsScratch = new Int16Array(0);
let name2M2UsedScratch = new Uint8Array(0);
let name2MotherUsedScratch = new Uint8Array(0);
let name2DuoUsedScratch = new Uint8Array(0);
const fixedDuoCandidateMasksScratch = new Int32Array(5);
const fixedDuoMutualMasksScratch = new Int32Array(5);
const UNION_BUDDY_MASK_BITS = (() => {
  const table = new Uint8Array(8 * 256);
  for (let buddyMask = 0; buddyMask < 8; buddyMask++) {
    const rowOffset = buddyMask << 8;
    for (let bits = 0; bits < 256; bits++) {
      let unionBits = 0;
      for (let mask = 0; mask < 8; mask++) {
        if ((bits & (1 << mask)) !== 0) {
          unionBits |= 1 << (mask | buddyMask);
        }
      }
      table[rowOffset + bits] = unionBits;
    }
  }
  return table;
})();

// ループ毎に `if` 判定するとオーバーヘッドになるため、
// ビットマスクで「一定回数ごとにだけ」中断/描画更新チェックを行う。
const SEARCH_CHECK_MASK: number = 255;
const INNER_SEARCH_CHECK_MASK: number = 4095;
const SEARCH_UI_YIELD_INTERVAL_MS: number = 100;
const SEARCH_PAINT_FALLBACK_MS: number = 16;
const RENDER_UPDATE_INTERVAL_MS: number = 2000;
const RENDER_CHECK_MASK: number = 4095;
const APPEND_INTERMEDIATE_RESULTS: boolean = true;
const APPEND_MIN_RESULT_DELTA: number = 0;

type SearchSnapshot = {
  minEHP: number;
  minHP: number;
  minDebuff: number;
  minBuff: number;
  minHPBuddy: number;
  minIncreasedHPBuddy: number;
  minEvasion: number;
  minDuo: number;
  minCosmic: number;
  minFire: number;
  minWater: number;
  minFlora: number;
  minHealNum: number;
  minReferenceDamage: number;
  minReferenceAdvantageDamage: number;
  minReferenceVsHiDamage: number;
  minReferenceVsMizuDamage: number;
  minReferenceVsKiDamage: number;
  attackNum: number;
};

const EMPTY_SEARCH_SNAPSHOT: SearchSnapshot = {
  minEHP: 0,
  minHP: 0,
  minDebuff: 0,
  minBuff: 0,
  minHPBuddy: 0,
  minIncreasedHPBuddy: 0,
  minEvasion: 0,
  minDuo: 0,
  minCosmic: 0,
  minFire: 0,
  minWater: 0,
  minFlora: 0,
  minHealNum: 0,
  minReferenceDamage: 0,
  minReferenceAdvantageDamage: 0,
  minReferenceVsHiDamage: 0,
  minReferenceVsMizuDamage: 0,
  minReferenceVsKiDamage: 0,
  attackNum: 2,
};

export interface DeckSearchSortOption {
  prop: string;
  order: string;
}

export interface DeckSearchSettings {
  minEHP: number;
  minHP: number;
  minDebuff: number;
  minBuff: number;
  minHPBuddy: number;
  minIncreasedHPBuddy: number;
  minEvasion: number;
  minDuo: number;
  minCosmic: number;
  minFire: number;
  minWater: number;
  minFlora: number;
  minHealNum: number;
  minReferenceDamage: number;
  minReferenceAdvantageDamage: number;
  minReferenceVsHiDamage: number;
  minReferenceVsMizuDamage: number;
  minReferenceVsKiDamage: number;
  maxResult: number;
  sortOptions: DeckSearchSortOption[];
  convertedMustCharacters: string[];
  allowSameCharacter: boolean;
  attackNum: number;
  selectedSupportCharacters: string[];
}

export interface DeckSearchControls {
  isSearching: () => boolean;
  setTotalResults: (value: number) => void;
  setNowResults: (value: number) => void;
  setResults: (value: DeckResult[]) => void;
  setErrorMessage: (value: string) => void;
}

export interface DeckSearchContext {
  characters: Character[];
  settings: DeckSearchSettings;
  controls: DeckSearchControls;
}

type BitPair = { low: number; high: number };

function getCharaId(name: string): number {
  let id = charaIdMap.get(name);
  if (id === undefined) {
    id = charaIdMap.size;
    charaIdMap.set(name, id);
  }
  return id;
}

function getBitPairById(id: number): BitPair {
  if (id < 0) return { low: 0, high: 0 };
  if (id < 32) return { low: (1 << id) >>> 0, high: 0 };
  return { low: 0, high: (1 << (id - 32)) >>> 0 };
}


// 数値入力で＋とeを弾く
export function checkNumber(input:KeyboardEvent){
  if (input.key === 'e' || input.key === '+') {
    input.preventDefault();
  }
}
// etc文字列からのバフ/デバフ数はM1/M2/M3のON/OFFに連動させるため、
// 1キャラ単位で解析結果をキャッシュして再利用する。
const buffDebuffCache = new WeakMap<any, { etc: string; buffByMagic: Uint8Array; debuffByMagic: Uint8Array }>();
const emptyHealRates = { heal: 0, conHeal: 0 }; // Opt-2: 空オブジェクトの使い回しで生成回数を削減
const emptyDetailList: any[] = []; // Opt-247: 詳細なし時の空配列を共有
const zeroMagicTotals = { atkDelta: 0, dmgDelta: 0 };
// バフ判定の対象（calcATK.vueのロジックと揃える）
const buffPatterns = [
  '火属性ダメージUP',
  '水属性ダメージUP',
  '木属性ダメージUP',
  '無属性ダメージUP',
  'ダメージUP',
  'ATKUP',
  'クリティカル',
];
// デバフ判定の対象（calcDEF.vueのロジックと揃える）
const debuffPatterns = [
  '火属性ダメージDOWN',
  '水属性ダメージDOWN',
  '木属性ダメージDOWN',
  '無属性ダメージDOWN',
  'ダメージDOWN',
  'ATKDOWN',
  '被ダメージDOWN',
];
const magicBuffTotalsCache = new WeakMap<any, {
  etc: string;
  allowM3Totals?: Array<{ atkDelta: number; dmgDelta: number }>;
  noM3Totals?: Array<{ atkDelta: number; dmgDelta: number }>;
}>();
// Opt-250: magic heal の buddyRates をキャッシュ
const magicHealRatesCache = new WeakMap<any, {
  key: string;
  rates: { m1: { hp: number; atk: number; heal: number; conHeal: number }; m2: { hp: number; atk: number; heal: number; conHeal: number }; m3: { hp: number; atk: number; heal: number; conHeal: number } };
}>();

function getSearchCacheSource(chara: any): any {
  return chara?._searchSource ?? chara;
}

function getMagicHealRates(chara: Character) {
  const source = getSearchCacheSource(chara as any);
  const key = `${source?.magic1heal ?? ''}|${source?.magic2heal ?? ''}|${source?.magic3heal ?? ''}`;
  const cached = magicHealRatesCache.get(source);
  if (cached && cached.key === key) return cached.rates;
  const rates = {
    m1: getBuddyRates(source.magic1heal),
    m2: getBuddyRates(source.magic2heal),
    m3: getBuddyRates(source.magic3heal),
  };
  magicHealRatesCache.set(source, { key, rates });
  return rates;
}

const buddyStatusSummaryCache = new Map<string, ReturnType<typeof getBuddyStatusSummary>>();
function getCachedBuddyStatusSummary(status: string): ReturnType<typeof getBuddyStatusSummary> {
  let cached = buddyStatusSummaryCache.get(status);
  if (cached !== undefined) return cached;
  cached = getBuddyStatusSummary(status, 10);
  buddyStatusSummaryCache.set(status, cached);
  return cached;
}
function buildSearchSnapshot(settings: DeckSearchSettings): SearchSnapshot {
  // リアクティブ参照（ref.value）を探索内で都度読むとコストが積み上がるため、
  // 探索開始時点の値をスナップショット化して使い回す。
  return {
    minEHP: settings.minEHP,
    minHP: settings.minHP,
    minDebuff: settings.minDebuff,
    minBuff: settings.minBuff,
    minHPBuddy: settings.minHPBuddy,
    minIncreasedHPBuddy: settings.minIncreasedHPBuddy,
    minEvasion: settings.minEvasion,
    minDuo: settings.minDuo,
    minCosmic: settings.minCosmic,
    minFire: settings.minFire,
    minWater: settings.minWater,
    minFlora: settings.minFlora,
    minHealNum: settings.minHealNum,
    minReferenceDamage: settings.minReferenceDamage,
    minReferenceAdvantageDamage: settings.minReferenceAdvantageDamage,
    minReferenceVsHiDamage: settings.minReferenceVsHiDamage,
    minReferenceVsMizuDamage: settings.minReferenceVsMizuDamage,
    minReferenceVsKiDamage: settings.minReferenceVsKiDamage,
    attackNum: settings.attackNum,
  };
}

function getBuffDebuffCountsByMagic(chara: any) {
  const source = getSearchCacheSource(chara);
  const etc = (source?.etc || '').toString();
  const cached = buffDebuffCache.get(source);
  if (cached && cached.etc === etc) {
    return cached;
  }

  // indexはM1/M2/M3に合わせて1..3を使用（0は未使用）
  // Opt-50: Uint8Array で小さな配列を軽量化
  const buffByMagic = new Uint8Array(4);
  const debuffByMagic = new Uint8Array(4);
  if (!etc) {
    const entry = { etc, buffByMagic, debuffByMagic };
    buffDebuffCache.set(source, entry);
    return entry;
  }
  // Opt-25: M指定が無い場合は早期リターン
  if (!etc.includes('(M')) {
    const entry = { etc, buffByMagic, debuffByMagic };
    buffDebuffCache.set(source, entry);
    return entry;
  }

  // etcは「,」区切りに整形済みなので分割してM番号ごとにカウント
  // Opt-26: map/filter を避けてループ内でtrim
  const effects = etc.split(',');
  for (let i = 0; i < effects.length; i++) {
    const effect = effects[i].trim();
    if (!effect) continue;
    const mMatch = effect.match(/\(M([123])\)/);
    if (!mMatch) continue;
    const magicIndex = Number(mMatch[1]);
    if (Number.isNaN(magicIndex) || magicIndex < 1 || magicIndex > 3) continue;
    // Opt-149: buff/debuff の for-of を for ループに置換
    for (let i = 0; i < buffPatterns.length; i++) {
      const pattern = buffPatterns[i];
      if (!effect.includes(pattern)) continue;
      // 被ダメージUPはバフとして扱わない
      if (effect.includes('被ダメージUP')) break;
      // バフは自分/味方対象のみをカウント
      if (effect.includes('自') || effect.includes('味方')) {
        buffByMagic[magicIndex] += 1;
        break;
      }
    }

    for (let i = 0; i < debuffPatterns.length; i++) {
      const pattern = debuffPatterns[i];
      if (!effect.includes(pattern)) continue;
      if (pattern === '被ダメージDOWN') {
        // 被ダメージDOWNは自分/味方対象のみをデバフとしてカウント
        if (effect.includes('自') || effect.includes('味方')) {
          debuffByMagic[magicIndex] += 1;
          break;
        }
      // それ以外のデバフは相手対象のみをカウント
      } else if (effect.includes('相手')) {
        debuffByMagic[magicIndex] += 1;
        break;
      }
    }
  }

  const entry = { etc, buffByMagic, debuffByMagic };
  buffDebuffCache.set(source, entry);
  return entry;
}
// 効率的な結果管理のためのエクスポート
export { DeckSearchResultsManager, type DeckResult };

export function getAvailableSortProps(t: (key: string) => string) {
  return [  
  t('comments.HP'),
  t('comments.effectiveHP'),
  t('comments.HPBuddy'),
  t('comments.increasedHPBuddy'),
  t('comments.noHPBuddy'),
  t('comments.buddy'),
  t('comments.evasion'),
  t('comments.healNum'),
  t('comments.duo'),
  t('comments.buff'),
  t('comments.debuff'),
  t('comments.maxCosmic'),
  t('comments.maxFire'),
  t('comments.maxWater'),
  t('comments.maxFlora'),
  t('comments.neutralDamage'),
  t('comments.advantageDamage'),
  t('comments.damageAgainstFire'),
  t('comments.damageAgainstWater'),
  t('comments.damageAgainstFlora')];
}
export function getAvailableCharacterProps(t: (key: string) => string) {
  return [  
  t('comments.riddle'),
  t('comments.ace'),
  t('comments.deuce'),
  t('comments.cater'),
  t('comments.trey'),
  t('comments.leona'),
  t('comments.jack'),
  t('comments.ruggie'),
  t('comments.azul'),
  t('comments.jade'),
  t('comments.floyd'),
  t('comments.kalim'),
  t('comments.jamil'),
  t('comments.vil'),
  t('comments.epel'),
  t('comments.rook'),
  t('comments.idia'),
  t('comments.ortho'),
  t('comments.malleus'),
  t('comments.silver'),
  t('comments.sebek'),
  t('comments.lilia'),
  t('comments.grim'),
  t('comments.lolo'),
  t('comments.crowley'),
  t('comments.crewel'),
  t('comments.fellow'),
  t('comments.train'),
  t('comments.vargas')];
}
export const availableSortkeys = [
  'hp',
  'ehp',
  'hpBuddy',
  'increasedHpBuddy',
  'noHpBuddy',
  'buddy',
  'evasion',
  'healNum',
  'duo',
  'buff',
  'debuff',
  'maxCosmic',
  'maxFire',
  'maxWater',
  'maxFlora',
  'referenceDamage',
  'referenceAdvantageDamage',
  'referenceVsHiDamage',
  'referenceVsMizuDamage',
  'referenceVsKiDamage',
];
export const enName2jpName: { [key: string]: string } = {
  "Riddle": "リドル",
  "Ace": "エース",
  "Deuce": "デュース",
  "Cater": "ケイト",
  "Trey": "トレイ",
  "Leona": "レオナ",
  "Jack": "ジャック",
  "Ruggie": "ラギー",
  "Azul": "アズール", 
  "Jade": "ジェイド",
  "Floyd": "フロイド", 
  "Kalim": "カリム",
  "Jamil": "ジャミル",
  "Vil": "ヴィル",
  "Epel": "エペル",
  "Rook": "ルーク",
  "Idia": "イデア",
  "Ortho": "オルト",
  "Malleus": "マレウス",
  "Silver": "シルバー",
  "Sebek": "セベク",
  "Lilia": "リリア",
  "Grim": "グリム",
  "Lolo": "ロロ",
  "Crowley": "クロウリー",
  "Crewel": "クルーウェル",
  "Fellow": "フェロー",
  "Train": "トレイン"
};

const buddyRateMap: { [key: string]: { hp: number; atk: number; heal: number; conHeal: number } } = {
  'HPUP(小)': { hp: 0.2, atk: 0, heal: 0, conHeal: 0 },
  'HP&ATKUP(小)': { hp: 0.2, atk: 0.2, heal: 0, conHeal: 0 },
  'HPUP(中)': { hp: 0.3, atk: 0, heal: 0, conHeal: 0 },
  'HP&ATKUP(中)': { hp: 0.3, atk: 0.35, heal: 0, conHeal: 0 },
  'ATKUP(小)': { hp: 0, atk: 0.2, heal: 0, conHeal: 0 },
  'ATKUP(中)': { hp: 0, atk: 0.35, heal: 0, conHeal: 0 },
  '回復(極小)': { hp: 0, atk: 0, heal: 0.6, conHeal: 0 },
  '回復(小)': { hp: 0, atk: 0, heal: 1.1, conHeal: 0 },
  '回復&継続回復(小)': { hp: 0, atk: 0, heal: 1.1, conHeal: 0.15 * 3 },
  '回復(中)': { hp: 0, atk: 0, heal: 1.7, conHeal: 0 },
  '回復&継続回復(中)': { hp: 0, atk: 0, heal: 1.7, conHeal: 0.25 * 3 },
  '継続回復(極小)': { hp: 0, atk: 0, heal: 0, conHeal: 0.10 * 3 },
  '継続回復(小)': { hp: 0, atk: 0, heal: 0, conHeal: 0.15 * 3 },
  '継続回復(中)': { hp: 0, atk: 0, heal: 0, conHeal: 0.25 * 3 },
};

const defaultBuddyRates = { hp: 0, atk: 0, heal: 0, conHeal: 0 }; // Opt-48: デフォルトを共有

function getBuddyRates(status: string): { hp: number; atk: number; heal: number; conHeal: number } {
  // Opt-48: 参照を返して生成を回避
  return buddyRateMap[status] ?? defaultBuddyRates;
}

function calculateContinuousHealFromTotalRate(totalRate: number, hp: number): number {
  if (totalRate <= 0 || hp <= 0) return 0;
  const duration = 3;
  return Math.ceil(hp * (totalRate / duration)) * duration;
}

function isHealCard(healStatus: string): boolean {
  // Opt-56: 空文字を先に判定して早期リターン
  if (healStatus === '') return false;
  const rates = buddyRateMap[healStatus];
  return !!rates && (rates.heal > 0 || rates.conHeal > 0);
}

const atkBuffMap: { [key: string]: number } = {
  "ATKUP(極小)": 1.1,
  "ATKUP(小)": 1.2,
  "ATKUP(中)": 1.35,
  "ATKUP(大)": 1.5,
  "ATKUP(極大)": 1.8,
};

const damageBuffMap: { [key: string]: number } = {
  "ダメUP(極小)": 0.025,
  "ダメUP(小)": 0.05,
  "ダメUP(中)": 0.0875,
  "ダメUP(大)": 0.125,
  "ダメUP(極大)": 0.1875,
  "属性ダメUP(極小)": 0.03,
  "属性ダメUP(小)": 0.06,
  "属性ダメUP(中)": 0.105,
  "属性ダメUP(大)": 0.15,
  "属性ダメUP(極大)": 0.27,
};

// etcから抽出した複数バフ合算でダメージを計算（magicNbufは不使用）
// allowM3Overrideは「使用可否」でM3を無効にした場合に解析から外すための上書き
function getMagicBuffTotalsAll(
  chara: Character,
  allowM3Override?: boolean
): Array<{ atkDelta: number; dmgDelta: number }> {
  const source = getSearchCacheSource(chara as any);
  // M3可否（ストアのhasM3が信頼できない場合に備え、レアでも判断）
  const allowM3 = allowM3Override !== undefined
    ? allowM3Override
    : ((source as any).hasM3 ?? (source.rare === 'SSR'));
  const etc = (source?.etc || '').toString();
  let cached = magicBuffTotalsCache.get(source);
  if (cached && cached.etc === etc) {
    const totals = allowM3 ? cached.allowM3Totals : cached.noM3Totals;
    if (totals !== undefined) return totals;
  } else {
    cached = { etc };
    magicBuffTotalsCache.set(source, cached);
  }

  const parsed = normalizeLegacyDeckBuffs(parseMagicBuffsFromEtc(source as any, { allowM3 }));
  const totals: Array<{ atkDelta: number; dmgDelta: number }> = [
    { atkDelta: 0, dmgDelta: 0 },
    { atkDelta: 0, dmgDelta: 0 },
    { atkDelta: 0, dmgDelta: 0 },
    { atkDelta: 0, dmgDelta: 0 },
  ];

  for (const b of parsed) {
    // Opt-59: magicOption の数値化を軽量化
    const option = b.magicOption as string;
    const idxChar = option[1];
    const idx = idxChar ? (idxChar.charCodeAt(0) - 48) : 0;
    if (idx < 1 || idx > 3) continue;
    if (b.buffOption === 'ATKUP') {
      const key = `ATKUP(${b.powerOption})`;
      const factor = (atkBuffMap as any)[key] || 1;
      totals[idx].atkDelta += (factor - 1);
    } else if (b.buffOption === 'ダメージUP' || b.buffOption === '属性ダメUP') {
      if (
        b.buffOption === '属性ダメUP' &&
        b.attributeOption &&
        b.attributeOption !== (source as any)[`magic${idx}atr`]
      ) {
        continue;
      }
      const prefix = b.buffOption === 'ダメージUP' ? 'ダメUP' : '属性ダメUP';
      const key = `${prefix}(${b.powerOption})`;
      const add = (damageBuffMap as any)[key] || 0;
      totals[idx].dmgDelta += add;
    }
  }

  if (allowM3) {
    cached.allowM3Totals = totals;
  } else {
    cached.noM3Totals = totals;
  }
  return totals;
}

function getComboRateFromPow(magicPow: string): number {
  if (magicPow === '連撃(弱)' || magicPow === '連撃(強)') return 1.8;
  if (magicPow === 'デュオ魔法' || magicPow === '3連撃(弱)' || magicPow === '3連撃(強)') return 2.4;
  return 1;
}

function getBaseRateFromPowAndAtr(magicPow: string, magicAtr: string): number {
  let rate = magicPow.includes('弱') ? 0.75 : 1;
  rate *= magicAtr === '無' ? 1.1 : 1;
  return rate;
}

function getVsRatesFromAtr(magicAtr: string): { fire: number; water: number; wood: number } {
  if (magicAtr === '火') return { fire: 1, water: 0.5, wood: 1.5 };
  if (magicAtr === '水') return { fire: 1.5, water: 1, wood: 0.5 };
  if (magicAtr === '木') return { fire: 0.5, water: 1.5, wood: 1 };
  return { fire: 1, water: 1, wood: 1 };
}

function getAttributeBuddyDamageRate(chara: Character, charaAny: any, magicIndex: 1 | 2 | 3): number {
  const attr = magicIndex === 1
    ? chara.magic1atr
    : magicIndex === 2
      ? chara.magic2atr
      : chara.magic3atr;
  if (attr === '火') {
    return (charaAny.buddy1FireDamageRateCached as number) +
      (charaAny.buddy2FireDamageRateCached as number) +
      (charaAny.buddy3FireDamageRateCached as number);
  }
  if (attr === '水') {
    return (charaAny.buddy1WaterDamageRateCached as number) +
      (charaAny.buddy2WaterDamageRateCached as number) +
      (charaAny.buddy3WaterDamageRateCached as number);
  }
  if (attr === '木') {
    return (charaAny.buddy1WoodDamageRateCached as number) +
      (charaAny.buddy2WoodDamageRateCached as number) +
      (charaAny.buddy3WoodDamageRateCached as number);
  }
  return (charaAny.buddy1CosmicDamageRateCached as number) +
    (charaAny.buddy2CosmicDamageRateCached as number) +
    (charaAny.buddy3CosmicDamageRateCached as number);
}

function calculateDamageUpper(
  baseATK: number,
  baseRate: number,
  comboRate: number,
  totals: { atkDelta: number; dmgDelta: number },
  maxAtkBuddyRate: number,
  maxBuddyDamageRate: number,
): number {
  return baseATK *
    (1 + maxAtkBuddyRate + totals.atkDelta) *
    (baseRate + totals.dmgDelta + maxBuddyDamageRate) *
    comboRate;
}

function setDamageUpperCaches(chara: Character, charaAny: any): void {
  const totals = charaAny.magicBuffTotalsCached as Array<{ atkDelta: number; dmgDelta: number }> | undefined;
  const m1Totals = totals?.[1] ?? zeroMagicTotals;
  const m2Totals = totals?.[2] ?? zeroMagicTotals;
  const m3Totals = totals?.[3] ?? zeroMagicTotals;
  const baseATK = chara.calcBaseATK;
  const maxAtkBuddyRate =
    (charaAny.buddy1AtkRateCached as number) +
    (charaAny.buddy2AtkRateCached as number) +
    (charaAny.buddy3AtkRateCached as number);
  const genericBuddyDamageRate =
    (charaAny.buddy1DamageRateCached as number) +
    (charaAny.buddy2DamageRateCached as number) +
    (charaAny.buddy3DamageRateCached as number);

  const useM1 = charaAny.useM1Cached as boolean;
  const useM2 = charaAny.useM2Cached as boolean;
  const useM3 = charaAny.useM3Cached as boolean;
  const magic1DamageUpper = useM1
    ? calculateDamageUpper(
      baseATK,
      charaAny.m1BaseRateCached as number,
      charaAny.m1ComboRateCached as number,
      m1Totals,
      maxAtkBuddyRate,
      genericBuddyDamageRate + getAttributeBuddyDamageRate(chara, charaAny, 1),
    )
    : 0;
  const magic2DamageUpper = useM2
    ? calculateDamageUpper(
      baseATK,
      charaAny.m2DuoBaseRateCached as number,
      charaAny.m2DuoComboRateCached as number,
      m2Totals,
      maxAtkBuddyRate,
      genericBuddyDamageRate + getAttributeBuddyDamageRate(chara, charaAny, 2),
    )
    : 0;
  const magic3DamageUpper = useM3
    ? calculateDamageUpper(
      baseATK,
      charaAny.m3BaseRateCached as number,
      charaAny.m3ComboRateCached as number,
      m3Totals,
      maxAtkBuddyRate,
      genericBuddyDamageRate + getAttributeBuddyDamageRate(chara, charaAny, 3),
    )
    : 0;

  fillTopTwoDamage(magic1DamageUpper, magic2DamageUpper, magic3DamageUpper, topTwoDamageScratch);
  const damageUpperTop2 = topTwoDamageScratch[0] + topTwoDamageScratch[1];
  charaAny.referenceDamageUpperTop2Cached = damageUpperTop2;

  fillTopTwoDamage(
    magic1DamageUpper * (charaAny.m1AdvantageRateCached as number),
    magic2DamageUpper * (charaAny.m2AdvantageRateCached as number),
    magic3DamageUpper * (charaAny.m3AdvantageRateCached as number),
    topTwoDamageScratch,
  );
  charaAny.referenceAdvantageDamageUpperTop2Cached = topTwoDamageScratch[0] + topTwoDamageScratch[1];

  fillTopTwoDamage(
    magic1DamageUpper * (charaAny.m1VsFireCached as number),
    magic2DamageUpper * (charaAny.m2VsFireCached as number),
    magic3DamageUpper * (charaAny.m3VsFireCached as number),
    topTwoDamageScratch,
  );
  charaAny.referenceVsHiDamageUpperTop2Cached = topTwoDamageScratch[0] + topTwoDamageScratch[1];

  fillTopTwoDamage(
    magic1DamageUpper * (charaAny.m1VsWaterCached as number),
    magic2DamageUpper * (charaAny.m2VsWaterCached as number),
    magic3DamageUpper * (charaAny.m3VsWaterCached as number),
    topTwoDamageScratch,
  );
  charaAny.referenceVsMizuDamageUpperTop2Cached = topTwoDamageScratch[0] + topTwoDamageScratch[1];

  fillTopTwoDamage(
    magic1DamageUpper * (charaAny.m1VsWoodCached as number),
    magic2DamageUpper * (charaAny.m2VsWoodCached as number),
    magic3DamageUpper * (charaAny.m3VsWoodCached as number),
    topTwoDamageScratch,
  );
  charaAny.referenceVsKiDamageUpperTop2Cached = topTwoDamageScratch[0] + topTwoDamageScratch[1];
}

function sumTopTwoDamageValues(damage1: number, damage2: number, damage3: number): number {
  let max = damage1;
  let second = damage2;
  if (second > max) {
    const tmp = max;
    max = second;
    second = tmp;
  }
  if (damage3 > max) {
    second = max;
    max = damage3;
  } else if (damage3 > second) {
    second = damage3;
  }
  return max + second;
}

function writeTopTwoDamageTables(
  sumOut: Float64Array,
  minOut: Float64Array,
  offset: number,
  damage1: number,
  damage2: number,
  damage3: number,
): void {
  let max = damage1;
  let second = damage2;
  if (second > max) {
    const tmp = max;
    max = second;
    second = tmp;
  }
  if (damage3 > max) {
    second = max;
    max = damage3;
  } else if (damage3 > second) {
    second = damage3;
  }
  sumOut[offset] = max + second;
  minOut[offset] = second;
}

function getDamageMetricMultiplier(charaAny: any, metric: number, magicIndex: 1 | 2 | 3): number {
  if (metric === DAMAGE_METRIC_REFERENCE) return 1;
  if (metric === DAMAGE_METRIC_ADVANTAGE) {
    return magicIndex === 1
      ? (charaAny.m1AdvantageRateCached as number)
      : magicIndex === 2
        ? (charaAny.m2AdvantageRateCached as number)
        : (charaAny.m3AdvantageRateCached as number);
  }
  if (metric === DAMAGE_METRIC_VS_HI) {
    return magicIndex === 1
      ? (charaAny.m1VsFireCached as number)
      : magicIndex === 2
        ? (charaAny.m2VsFireCached as number)
        : (charaAny.m3VsFireCached as number);
  }
  if (metric === DAMAGE_METRIC_VS_MIZU) {
    return magicIndex === 1
      ? (charaAny.m1VsWaterCached as number)
      : magicIndex === 2
        ? (charaAny.m2VsWaterCached as number)
        : (charaAny.m3VsWaterCached as number);
  }
  return magicIndex === 1
    ? (charaAny.m1VsWoodCached as number)
    : magicIndex === 2
      ? (charaAny.m2VsWoodCached as number)
      : (charaAny.m3VsWoodCached as number);
}

function getActiveAttributeBuddyDamageRate(chara: Character, magicIndex: 1 | 2 | 3, fire: number, water: number, wood: number, cosmic: number): number {
  const attr = magicIndex === 1
    ? chara.magic1atr
    : magicIndex === 2
      ? chara.magic2atr
      : chara.magic3atr;
  if (attr === '火') return fire;
  if (attr === '水') return water;
  if (attr === '木') return wood;
  return cosmic;
}

function calculatePresenceAwareDamageUpperTop2(
  chara: Character,
  metric: number,
  presenceLow: number,
  presenceHigh: number,
): number {
  const charaAny = chara as any;
  let atkBuddyRate = 0;
  let buddyDamageRate = 0;
  let buddyFireDamageRate = 0;
  let buddyWaterDamageRate = 0;
  let buddyWoodDamageRate = 0;
  let buddyCosmicDamageRate = 0;

  if ((((charaAny.buddy1BitLowCached as number) & presenceLow) | ((charaAny.buddy1BitHighCached as number) & presenceHigh)) !== 0) {
    atkBuddyRate += charaAny.buddy1AtkRateCached as number;
    buddyDamageRate += charaAny.buddy1DamageRateCached as number;
    buddyFireDamageRate += charaAny.buddy1FireDamageRateCached as number;
    buddyWaterDamageRate += charaAny.buddy1WaterDamageRateCached as number;
    buddyWoodDamageRate += charaAny.buddy1WoodDamageRateCached as number;
    buddyCosmicDamageRate += charaAny.buddy1CosmicDamageRateCached as number;
  }
  if ((((charaAny.buddy2BitLowCached as number) & presenceLow) | ((charaAny.buddy2BitHighCached as number) & presenceHigh)) !== 0) {
    atkBuddyRate += charaAny.buddy2AtkRateCached as number;
    buddyDamageRate += charaAny.buddy2DamageRateCached as number;
    buddyFireDamageRate += charaAny.buddy2FireDamageRateCached as number;
    buddyWaterDamageRate += charaAny.buddy2WaterDamageRateCached as number;
    buddyWoodDamageRate += charaAny.buddy2WoodDamageRateCached as number;
    buddyCosmicDamageRate += charaAny.buddy2CosmicDamageRateCached as number;
  }
  if ((((charaAny.buddy3BitLowCached as number) & presenceLow) | ((charaAny.buddy3BitHighCached as number) & presenceHigh)) !== 0) {
    atkBuddyRate += charaAny.buddy3AtkRateCached as number;
    buddyDamageRate += charaAny.buddy3DamageRateCached as number;
    buddyFireDamageRate += charaAny.buddy3FireDamageRateCached as number;
    buddyWaterDamageRate += charaAny.buddy3WaterDamageRateCached as number;
    buddyWoodDamageRate += charaAny.buddy3WoodDamageRateCached as number;
    buddyCosmicDamageRate += charaAny.buddy3CosmicDamageRateCached as number;
  }

  const totals = charaAny.magicBuffTotalsCached as Array<{ atkDelta: number; dmgDelta: number }> | undefined;
  const baseATK = chara.calcBaseATK;
  let magic1Damage = 0;
  let magic2Damage = 0;
  let magic3Damage = 0;
  if (charaAny.useM1Cached as boolean) {
    const totals1 = totals?.[1] ?? zeroMagicTotals;
    magic1Damage = calculateDamageUpper(
      baseATK,
      charaAny.m1BaseRateCached as number,
      charaAny.m1ComboRateCached as number,
      totals1,
      atkBuddyRate,
      buddyDamageRate + getActiveAttributeBuddyDamageRate(chara, 1, buddyFireDamageRate, buddyWaterDamageRate, buddyWoodDamageRate, buddyCosmicDamageRate),
    ) * getDamageMetricMultiplier(charaAny, metric, 1);
  }
  if (charaAny.useM2Cached as boolean) {
    const totals2 = totals?.[2] ?? zeroMagicTotals;
    const duoPresent = (((charaAny.duoBitLowCached as number) & presenceLow) | ((charaAny.duoBitHighCached as number) & presenceHigh)) !== 0;
    const useDuoUpper = (charaAny.magic2IsDuoBaseCached as boolean) === true || duoPresent;
    magic2Damage = calculateDamageUpper(
      baseATK,
      useDuoUpper ? (charaAny.m2DuoBaseRateCached as number) : (charaAny.m2BaseRateCached as number),
      useDuoUpper ? (charaAny.m2DuoComboRateCached as number) : (charaAny.m2ComboRateCached as number),
      totals2,
      atkBuddyRate,
      buddyDamageRate + getActiveAttributeBuddyDamageRate(chara, 2, buddyFireDamageRate, buddyWaterDamageRate, buddyWoodDamageRate, buddyCosmicDamageRate),
    ) * getDamageMetricMultiplier(charaAny, metric, 2);
  }
  if (charaAny.useM3Cached as boolean) {
    const totals3 = totals?.[3] ?? zeroMagicTotals;
    magic3Damage = calculateDamageUpper(
      baseATK,
      charaAny.m3BaseRateCached as number,
      charaAny.m3ComboRateCached as number,
      totals3,
      atkBuddyRate,
      buddyDamageRate + getActiveAttributeBuddyDamageRate(chara, 3, buddyFireDamageRate, buddyWaterDamageRate, buddyWoodDamageRate, buddyCosmicDamageRate),
    ) * getDamageMetricMultiplier(charaAny, metric, 3);
  }

  return sumTopTwoDamageValues(magic1Damage, magic2Damage, magic3Damage);
}

const presenceAwareDamageUpperCache = new WeakMap<any, Map<string, number>>();
function getCachedPresenceAwareDamageUpperTop2(
  chara: Character,
  metric: number,
  presenceLow: number,
  presenceHigh: number,
): number {
  let cache = presenceAwareDamageUpperCache.get(chara as any);
  if (cache === undefined) {
    cache = new Map<string, number>();
    presenceAwareDamageUpperCache.set(chara as any, cache);
  }
  const key = metric + ':' + presenceLow + ':' + presenceHigh;
  const cached = cache.get(key);
  if (cached !== undefined) return cached;
  const value = calculatePresenceAwareDamageUpperTop2(chara, metric, presenceLow, presenceHigh);
  cache.set(key, value);
  return value;
}

function getActiveBuddyMaskFromPresence(charaAny: any, presenceLow: number, presenceHigh: number): number {
  let mask = 0;
  if ((((charaAny.buddy1BitLowCached as number) & presenceLow) | ((charaAny.buddy1BitHighCached as number) & presenceHigh)) !== 0) {
    mask |= 1;
  }
  if ((((charaAny.buddy2BitLowCached as number) & presenceLow) | ((charaAny.buddy2BitHighCached as number) & presenceHigh)) !== 0) {
    mask |= 2;
  }
  if ((((charaAny.buddy3BitLowCached as number) & presenceLow) | ((charaAny.buddy3BitHighCached as number) & presenceHigh)) !== 0) {
    mask |= 4;
  }
  return mask;
}

function calculatePrimaryDamageTop2ForCharacter(
  chara: Character,
  metric: number,
  presenceLow: number,
  presenceHigh: number,
  useDuoPow: boolean,
): number {
  const charaAny = chara as any;
  const primaryDamageTable = charaAny.primaryDamageTop2ByMaskCached as Float64Array | undefined;
  if (primaryDamageTable !== undefined) {
    const metricIndex = getDamageMetricTableIndex(metric);
    const buddyMask = getActiveBuddyMaskFromPresence(charaAny, presenceLow, presenceHigh);
    const duoOffset = ((charaAny.magic2IsDuoBaseCached as boolean) === true || useDuoPow) ? 8 : 0;
    return primaryDamageTable[(metricIndex << 4) + duoOffset + buddyMask];
  }
  let atkBuddyRate = 0;
  let buddyDamageRate = 0;
  let buddyFireDamageRate = 0;
  let buddyWaterDamageRate = 0;
  let buddyWoodDamageRate = 0;
  let buddyCosmicDamageRate = 0;

  if ((((charaAny.buddy1BitLowCached as number) & presenceLow) | ((charaAny.buddy1BitHighCached as number) & presenceHigh)) !== 0) {
    atkBuddyRate += charaAny.buddy1AtkRateCached as number;
    buddyDamageRate += charaAny.buddy1DamageRateCached as number;
    buddyFireDamageRate += charaAny.buddy1FireDamageRateCached as number;
    buddyWaterDamageRate += charaAny.buddy1WaterDamageRateCached as number;
    buddyWoodDamageRate += charaAny.buddy1WoodDamageRateCached as number;
    buddyCosmicDamageRate += charaAny.buddy1CosmicDamageRateCached as number;
  }
  if ((((charaAny.buddy2BitLowCached as number) & presenceLow) | ((charaAny.buddy2BitHighCached as number) & presenceHigh)) !== 0) {
    atkBuddyRate += charaAny.buddy2AtkRateCached as number;
    buddyDamageRate += charaAny.buddy2DamageRateCached as number;
    buddyFireDamageRate += charaAny.buddy2FireDamageRateCached as number;
    buddyWaterDamageRate += charaAny.buddy2WaterDamageRateCached as number;
    buddyWoodDamageRate += charaAny.buddy2WoodDamageRateCached as number;
    buddyCosmicDamageRate += charaAny.buddy2CosmicDamageRateCached as number;
  }
  if ((((charaAny.buddy3BitLowCached as number) & presenceLow) | ((charaAny.buddy3BitHighCached as number) & presenceHigh)) !== 0) {
    atkBuddyRate += charaAny.buddy3AtkRateCached as number;
    buddyDamageRate += charaAny.buddy3DamageRateCached as number;
    buddyFireDamageRate += charaAny.buddy3FireDamageRateCached as number;
    buddyWaterDamageRate += charaAny.buddy3WaterDamageRateCached as number;
    buddyWoodDamageRate += charaAny.buddy3WoodDamageRateCached as number;
    buddyCosmicDamageRate += charaAny.buddy3CosmicDamageRateCached as number;
  }

  const totals = charaAny.magicBuffTotalsCached as Array<{ atkDelta: number; dmgDelta: number }> | undefined;
  const baseATK = chara.calcBaseATK;
  let magic1Damage = 0;
  let magic2Damage = 0;
  let magic3Damage = 0;
  if (charaAny.useM1Cached as boolean) {
    const totals1 = totals?.[1] ?? zeroMagicTotals;
    magic1Damage = calculateDamageUpper(
      baseATK,
      charaAny.m1BaseRateCached as number,
      charaAny.m1ComboRateCached as number,
      totals1,
      atkBuddyRate,
      buddyDamageRate + getActiveAttributeBuddyDamageRate(chara, 1, buddyFireDamageRate, buddyWaterDamageRate, buddyWoodDamageRate, buddyCosmicDamageRate),
    ) * getDamageMetricMultiplier(charaAny, metric, 1);
  }
  if (charaAny.useM2Cached as boolean) {
    const totals2 = totals?.[2] ?? zeroMagicTotals;
    const useDuo = (charaAny.magic2IsDuoBaseCached as boolean) === true || useDuoPow;
    magic2Damage = calculateDamageUpper(
      baseATK,
      useDuo ? (charaAny.m2DuoBaseRateCached as number) : (charaAny.m2BaseRateCached as number),
      useDuo ? (charaAny.m2DuoComboRateCached as number) : (charaAny.m2ComboRateCached as number),
      totals2,
      atkBuddyRate,
      buddyDamageRate + getActiveAttributeBuddyDamageRate(chara, 2, buddyFireDamageRate, buddyWaterDamageRate, buddyWoodDamageRate, buddyCosmicDamageRate),
    ) * getDamageMetricMultiplier(charaAny, metric, 2);
  }
  if (charaAny.useM3Cached as boolean) {
    const totals3 = totals?.[3] ?? zeroMagicTotals;
    magic3Damage = calculateDamageUpper(
      baseATK,
      charaAny.m3BaseRateCached as number,
      charaAny.m3ComboRateCached as number,
      totals3,
      atkBuddyRate,
      buddyDamageRate + getActiveAttributeBuddyDamageRate(chara, 3, buddyFireDamageRate, buddyWaterDamageRate, buddyWoodDamageRate, buddyCosmicDamageRate),
    ) * getDamageMetricMultiplier(charaAny, metric, 3);
  }

  return sumTopTwoDamageValues(magic1Damage, magic2Damage, magic3Damage);
}

function resolveFixedFiveDuoMask(characters: Character[]): number {
  const charaIds = charaIdsScratch.length >= 5 ? charaIdsScratch : (charaIdsScratch = new Int16Array(5));
  const duoIds = duoIdsScratch.length >= 5 ? duoIdsScratch : (duoIdsScratch = new Int16Array(5));
  for (let i = 0; i < 5; i++) {
    const charaAny = characters[i] as any;
    charaIds[i] = charaAny.charaId as number;
    duoIds[i] = charaAny.duoId as number;
  }

  let fixedDuoUsedMask = 0;
  let fixedM2UsedMask = 0;
  let fixedMotherUsedMask = 0;
  let fixedEnabledM2Mask = 0;
  for (let i = 0; i < 5; i++) {
    if ((characters[i] as any).useM2Cached as boolean) {
      fixedEnabledM2Mask |= (1 << i);
    }
    const duoId = duoIds[i];
    const charaId = charaIds[i];
    let candidateMask = 0;
    let mutualMask = 0;
    for (let j = 0; j < 5; j++) {
      if (charaIds[j] !== duoId) continue;
      const bit = (1 << j);
      candidateMask |= bit;
      if (duoIds[j] === charaId) {
        mutualMask |= bit;
      }
    }
    fixedDuoCandidateMasksScratch[i] = candidateMask;
    fixedDuoMutualMasksScratch[i] = mutualMask;
  }

  for (let index = 0; index < 5; index++) {
    const charaAny = characters[index] as any;
    if (!(charaAny.useM2Cached as boolean)) continue;
    const selfBit = 1 << index;
    if ((fixedDuoUsedMask & selfBit) !== 0) continue;

    const candidateMask = fixedDuoCandidateMasksScratch[index];
    const mutualMask = fixedDuoMutualMasksScratch[index];
    const availableMutualMask = mutualMask & ~fixedDuoUsedMask;
    if (availableMutualMask !== 0) {
      const pairBit = availableMutualMask & -availableMutualMask;
      fixedDuoUsedMask |= selfBit | pairBit;
      fixedM2UsedMask |= selfBit | pairBit;
    }

    if ((fixedM2UsedMask & selfBit) === 0) {
      let scanMask = candidateMask;
      while (scanMask !== 0) {
        const pickBit = scanMask & -scanMask;
        if ((fixedMotherUsedMask & pickBit) === 0) {
          fixedDuoUsedMask |= selfBit;
          fixedM2UsedMask |= selfBit;
          fixedMotherUsedMask |= pickBit;
          break;
        }
        scanMask ^= pickBit;
      }
    }

    if ((fixedM2UsedMask & selfBit) === 0) {
      let scanMask = candidateMask;
      while (scanMask !== 0) {
        const pickBit = scanMask & -scanMask;
        if ((fixedM2UsedMask & pickBit) === 0) {
          fixedDuoUsedMask |= selfBit;
          fixedM2UsedMask |= selfBit | pickBit;
          break;
        }
        scanMask ^= pickBit;
      }
    }
  }

  return fixedDuoUsedMask & fixedEnabledM2Mask;
}

function resolveFixedFiveDuoMaskFromMasks(
  candidate0: number,
  candidate1: number,
  candidate2: number,
  candidate3: number,
  candidate4: number,
  mutual0: number,
  mutual1: number,
  mutual2: number,
  mutual3: number,
  mutual4: number,
  enabledM2Mask: number,
): number {
  let duoUsedMask = 0;
  let m2UsedMask = 0;
  let motherUsedMask = 0;

  if ((enabledM2Mask & 1) !== 0 && (duoUsedMask & 1) === 0) {
    let availableMutualMask = mutual0 & ~duoUsedMask;
    if (availableMutualMask !== 0) {
      const pairBit = availableMutualMask & -availableMutualMask;
      duoUsedMask |= 1 | pairBit;
      m2UsedMask |= 1 | pairBit;
    }
    if ((m2UsedMask & 1) === 0) {
      let scanMask = candidate0;
      while (scanMask !== 0) {
        const pickBit = scanMask & -scanMask;
        if ((motherUsedMask & pickBit) === 0) {
          duoUsedMask |= 1;
          m2UsedMask |= 1;
          motherUsedMask |= pickBit;
          break;
        }
        scanMask ^= pickBit;
      }
    }
    if ((m2UsedMask & 1) === 0) {
      let scanMask = candidate0;
      while (scanMask !== 0) {
        const pickBit = scanMask & -scanMask;
        if ((m2UsedMask & pickBit) === 0) {
          duoUsedMask |= 1;
          m2UsedMask |= 1 | pickBit;
          break;
        }
        scanMask ^= pickBit;
      }
    }
  }

  if ((enabledM2Mask & 2) !== 0 && (duoUsedMask & 2) === 0) {
    let availableMutualMask = mutual1 & ~duoUsedMask;
    if (availableMutualMask !== 0) {
      const pairBit = availableMutualMask & -availableMutualMask;
      duoUsedMask |= 2 | pairBit;
      m2UsedMask |= 2 | pairBit;
    }
    if ((m2UsedMask & 2) === 0) {
      let scanMask = candidate1;
      while (scanMask !== 0) {
        const pickBit = scanMask & -scanMask;
        if ((motherUsedMask & pickBit) === 0) {
          duoUsedMask |= 2;
          m2UsedMask |= 2;
          motherUsedMask |= pickBit;
          break;
        }
        scanMask ^= pickBit;
      }
    }
    if ((m2UsedMask & 2) === 0) {
      let scanMask = candidate1;
      while (scanMask !== 0) {
        const pickBit = scanMask & -scanMask;
        if ((m2UsedMask & pickBit) === 0) {
          duoUsedMask |= 2;
          m2UsedMask |= 2 | pickBit;
          break;
        }
        scanMask ^= pickBit;
      }
    }
  }

  if ((enabledM2Mask & 4) !== 0 && (duoUsedMask & 4) === 0) {
    let availableMutualMask = mutual2 & ~duoUsedMask;
    if (availableMutualMask !== 0) {
      const pairBit = availableMutualMask & -availableMutualMask;
      duoUsedMask |= 4 | pairBit;
      m2UsedMask |= 4 | pairBit;
    }
    if ((m2UsedMask & 4) === 0) {
      let scanMask = candidate2;
      while (scanMask !== 0) {
        const pickBit = scanMask & -scanMask;
        if ((motherUsedMask & pickBit) === 0) {
          duoUsedMask |= 4;
          m2UsedMask |= 4;
          motherUsedMask |= pickBit;
          break;
        }
        scanMask ^= pickBit;
      }
    }
    if ((m2UsedMask & 4) === 0) {
      let scanMask = candidate2;
      while (scanMask !== 0) {
        const pickBit = scanMask & -scanMask;
        if ((m2UsedMask & pickBit) === 0) {
          duoUsedMask |= 4;
          m2UsedMask |= 4 | pickBit;
          break;
        }
        scanMask ^= pickBit;
      }
    }
  }

  if ((enabledM2Mask & 8) !== 0 && (duoUsedMask & 8) === 0) {
    let availableMutualMask = mutual3 & ~duoUsedMask;
    if (availableMutualMask !== 0) {
      const pairBit = availableMutualMask & -availableMutualMask;
      duoUsedMask |= 8 | pairBit;
      m2UsedMask |= 8 | pairBit;
    }
    if ((m2UsedMask & 8) === 0) {
      let scanMask = candidate3;
      while (scanMask !== 0) {
        const pickBit = scanMask & -scanMask;
        if ((motherUsedMask & pickBit) === 0) {
          duoUsedMask |= 8;
          m2UsedMask |= 8;
          motherUsedMask |= pickBit;
          break;
        }
        scanMask ^= pickBit;
      }
    }
    if ((m2UsedMask & 8) === 0) {
      let scanMask = candidate3;
      while (scanMask !== 0) {
        const pickBit = scanMask & -scanMask;
        if ((m2UsedMask & pickBit) === 0) {
          duoUsedMask |= 8;
          m2UsedMask |= 8 | pickBit;
          break;
        }
        scanMask ^= pickBit;
      }
    }
  }

  if ((enabledM2Mask & 16) !== 0 && (duoUsedMask & 16) === 0) {
    let availableMutualMask = mutual4 & ~duoUsedMask;
    if (availableMutualMask !== 0) {
      const pairBit = availableMutualMask & -availableMutualMask;
      duoUsedMask |= 16 | pairBit;
      m2UsedMask |= 16 | pairBit;
    }
    if ((m2UsedMask & 16) === 0) {
      let scanMask = candidate4;
      while (scanMask !== 0) {
        const pickBit = scanMask & -scanMask;
        if ((motherUsedMask & pickBit) === 0) {
          duoUsedMask |= 16;
          m2UsedMask |= 16;
          motherUsedMask |= pickBit;
          break;
        }
        scanMask ^= pickBit;
      }
    }
    if ((m2UsedMask & 16) === 0) {
      let scanMask = candidate4;
      while (scanMask !== 0) {
        const pickBit = scanMask & -scanMask;
        if ((m2UsedMask & pickBit) === 0) {
          duoUsedMask |= 16;
          m2UsedMask |= 16 | pickBit;
          break;
        }
        scanMask ^= pickBit;
      }
    }
  }

  return duoUsedMask & enabledM2Mask;
}

function resolveFixedFiveDuoMaskFromIds(
  id0: number,
  id1: number,
  id2: number,
  id3: number,
  id4: number,
  duo0: number,
  duo1: number,
  duo2: number,
  duo3: number,
  duo4: number,
  use0: boolean,
  use1: boolean,
  use2: boolean,
  use3: boolean,
  use4: boolean,
): number {
  const candidate0 =
    (id0 === duo0 ? 1 : 0) |
    (id1 === duo0 ? 2 : 0) |
    (id2 === duo0 ? 4 : 0) |
    (id3 === duo0 ? 8 : 0) |
    (id4 === duo0 ? 16 : 0);
  const candidate1 =
    (id0 === duo1 ? 1 : 0) |
    (id1 === duo1 ? 2 : 0) |
    (id2 === duo1 ? 4 : 0) |
    (id3 === duo1 ? 8 : 0) |
    (id4 === duo1 ? 16 : 0);
  const candidate2 =
    (id0 === duo2 ? 1 : 0) |
    (id1 === duo2 ? 2 : 0) |
    (id2 === duo2 ? 4 : 0) |
    (id3 === duo2 ? 8 : 0) |
    (id4 === duo2 ? 16 : 0);
  const candidate3 =
    (id0 === duo3 ? 1 : 0) |
    (id1 === duo3 ? 2 : 0) |
    (id2 === duo3 ? 4 : 0) |
    (id3 === duo3 ? 8 : 0) |
    (id4 === duo3 ? 16 : 0);
  const candidate4 =
    (id0 === duo4 ? 1 : 0) |
    (id1 === duo4 ? 2 : 0) |
    (id2 === duo4 ? 4 : 0) |
    (id3 === duo4 ? 8 : 0) |
    (id4 === duo4 ? 16 : 0);
  const mutual0 =
    ((id0 === duo0 && duo0 === id0) ? 1 : 0) |
    ((id1 === duo0 && duo1 === id0) ? 2 : 0) |
    ((id2 === duo0 && duo2 === id0) ? 4 : 0) |
    ((id3 === duo0 && duo3 === id0) ? 8 : 0) |
    ((id4 === duo0 && duo4 === id0) ? 16 : 0);
  const mutual1 =
    ((id0 === duo1 && duo0 === id1) ? 1 : 0) |
    ((id1 === duo1 && duo1 === id1) ? 2 : 0) |
    ((id2 === duo1 && duo2 === id1) ? 4 : 0) |
    ((id3 === duo1 && duo3 === id1) ? 8 : 0) |
    ((id4 === duo1 && duo4 === id1) ? 16 : 0);
  const mutual2 =
    ((id0 === duo2 && duo0 === id2) ? 1 : 0) |
    ((id1 === duo2 && duo1 === id2) ? 2 : 0) |
    ((id2 === duo2 && duo2 === id2) ? 4 : 0) |
    ((id3 === duo2 && duo3 === id2) ? 8 : 0) |
    ((id4 === duo2 && duo4 === id2) ? 16 : 0);
  const mutual3 =
    ((id0 === duo3 && duo0 === id3) ? 1 : 0) |
    ((id1 === duo3 && duo1 === id3) ? 2 : 0) |
    ((id2 === duo3 && duo2 === id3) ? 4 : 0) |
    ((id3 === duo3 && duo3 === id3) ? 8 : 0) |
    ((id4 === duo3 && duo4 === id3) ? 16 : 0);
  const mutual4 =
    ((id0 === duo4 && duo0 === id4) ? 1 : 0) |
    ((id1 === duo4 && duo1 === id4) ? 2 : 0) |
    ((id2 === duo4 && duo2 === id4) ? 4 : 0) |
    ((id3 === duo4 && duo3 === id4) ? 8 : 0) |
    ((id4 === duo4 && duo4 === id4) ? 16 : 0);

  let duoUsedMask = 0;
  let m2UsedMask = 0;
  let motherUsedMask = 0;

  if (use0 && (duoUsedMask & 1) === 0) {
    let availableMutualMask = mutual0 & ~duoUsedMask;
    if (availableMutualMask !== 0) {
      const pairBit = availableMutualMask & -availableMutualMask;
      duoUsedMask |= 1 | pairBit;
      m2UsedMask |= 1 | pairBit;
    }
    if ((m2UsedMask & 1) === 0) {
      let scanMask = candidate0;
      while (scanMask !== 0) {
        const pickBit = scanMask & -scanMask;
        if ((motherUsedMask & pickBit) === 0) {
          duoUsedMask |= 1;
          m2UsedMask |= 1;
          motherUsedMask |= pickBit;
          break;
        }
        scanMask ^= pickBit;
      }
    }
    if ((m2UsedMask & 1) === 0) {
      let scanMask = candidate0;
      while (scanMask !== 0) {
        const pickBit = scanMask & -scanMask;
        if ((m2UsedMask & pickBit) === 0) {
          duoUsedMask |= 1;
          m2UsedMask |= 1 | pickBit;
          break;
        }
        scanMask ^= pickBit;
      }
    }
  }

  if (use1 && (duoUsedMask & 2) === 0) {
    let availableMutualMask = mutual1 & ~duoUsedMask;
    if (availableMutualMask !== 0) {
      const pairBit = availableMutualMask & -availableMutualMask;
      duoUsedMask |= 2 | pairBit;
      m2UsedMask |= 2 | pairBit;
    }
    if ((m2UsedMask & 2) === 0) {
      let scanMask = candidate1;
      while (scanMask !== 0) {
        const pickBit = scanMask & -scanMask;
        if ((motherUsedMask & pickBit) === 0) {
          duoUsedMask |= 2;
          m2UsedMask |= 2;
          motherUsedMask |= pickBit;
          break;
        }
        scanMask ^= pickBit;
      }
    }
    if ((m2UsedMask & 2) === 0) {
      let scanMask = candidate1;
      while (scanMask !== 0) {
        const pickBit = scanMask & -scanMask;
        if ((m2UsedMask & pickBit) === 0) {
          duoUsedMask |= 2;
          m2UsedMask |= 2 | pickBit;
          break;
        }
        scanMask ^= pickBit;
      }
    }
  }

  if (use2 && (duoUsedMask & 4) === 0) {
    let availableMutualMask = mutual2 & ~duoUsedMask;
    if (availableMutualMask !== 0) {
      const pairBit = availableMutualMask & -availableMutualMask;
      duoUsedMask |= 4 | pairBit;
      m2UsedMask |= 4 | pairBit;
    }
    if ((m2UsedMask & 4) === 0) {
      let scanMask = candidate2;
      while (scanMask !== 0) {
        const pickBit = scanMask & -scanMask;
        if ((motherUsedMask & pickBit) === 0) {
          duoUsedMask |= 4;
          m2UsedMask |= 4;
          motherUsedMask |= pickBit;
          break;
        }
        scanMask ^= pickBit;
      }
    }
    if ((m2UsedMask & 4) === 0) {
      let scanMask = candidate2;
      while (scanMask !== 0) {
        const pickBit = scanMask & -scanMask;
        if ((m2UsedMask & pickBit) === 0) {
          duoUsedMask |= 4;
          m2UsedMask |= 4 | pickBit;
          break;
        }
        scanMask ^= pickBit;
      }
    }
  }

  if (use3 && (duoUsedMask & 8) === 0) {
    let availableMutualMask = mutual3 & ~duoUsedMask;
    if (availableMutualMask !== 0) {
      const pairBit = availableMutualMask & -availableMutualMask;
      duoUsedMask |= 8 | pairBit;
      m2UsedMask |= 8 | pairBit;
    }
    if ((m2UsedMask & 8) === 0) {
      let scanMask = candidate3;
      while (scanMask !== 0) {
        const pickBit = scanMask & -scanMask;
        if ((motherUsedMask & pickBit) === 0) {
          duoUsedMask |= 8;
          m2UsedMask |= 8;
          motherUsedMask |= pickBit;
          break;
        }
        scanMask ^= pickBit;
      }
    }
    if ((m2UsedMask & 8) === 0) {
      let scanMask = candidate3;
      while (scanMask !== 0) {
        const pickBit = scanMask & -scanMask;
        if ((m2UsedMask & pickBit) === 0) {
          duoUsedMask |= 8;
          m2UsedMask |= 8 | pickBit;
          break;
        }
        scanMask ^= pickBit;
      }
    }
  }

  if (use4 && (duoUsedMask & 16) === 0) {
    let availableMutualMask = mutual4 & ~duoUsedMask;
    if (availableMutualMask !== 0) {
      const pairBit = availableMutualMask & -availableMutualMask;
      duoUsedMask |= 16 | pairBit;
      m2UsedMask |= 16 | pairBit;
    }
    if ((m2UsedMask & 16) === 0) {
      let scanMask = candidate4;
      while (scanMask !== 0) {
        const pickBit = scanMask & -scanMask;
        if ((motherUsedMask & pickBit) === 0) {
          duoUsedMask |= 16;
          m2UsedMask |= 16;
          motherUsedMask |= pickBit;
          break;
        }
        scanMask ^= pickBit;
      }
    }
    if ((m2UsedMask & 16) === 0) {
      let scanMask = candidate4;
      while (scanMask !== 0) {
        const pickBit = scanMask & -scanMask;
        if ((m2UsedMask & pickBit) === 0) {
          duoUsedMask |= 16;
          m2UsedMask |= 16 | pickBit;
          break;
        }
        scanMask ^= pickBit;
      }
    }
  }

  const enabledM2Mask =
    (use0 ? 1 : 0) |
    (use1 ? 2 : 0) |
    (use2 ? 4 : 0) |
    (use3 ? 8 : 0) |
    (use4 ? 16 : 0);
  return duoUsedMask & enabledM2Mask;
}

function calculatePrimaryDamageForFixedFive(characters: Character[], metric: number): number {
  const c0Any = characters[0] as any;
  const c1Any = characters[1] as any;
  const c2Any = characters[2] as any;
  const c3Any = characters[3] as any;
  const c4Any = characters[4] as any;
  const presenceLow = (
    (c0Any.charaBitLowCached as number) |
    (c1Any.charaBitLowCached as number) |
    (c2Any.charaBitLowCached as number) |
    (c3Any.charaBitLowCached as number) |
    (c4Any.charaBitLowCached as number)
  ) >>> 0;
  const presenceHigh = (
    (c0Any.charaBitHighCached as number) |
    (c1Any.charaBitHighCached as number) |
    (c2Any.charaBitHighCached as number) |
    (c3Any.charaBitHighCached as number) |
    (c4Any.charaBitHighCached as number)
  ) >>> 0;
  return calculatePrimaryDamageForFixedFiveWithPresence(characters, metric, presenceLow, presenceHigh);
}

function calculatePrimaryDamageForFixedFiveWithPresence(
  characters: Character[],
  metric: number,
  presenceLow: number,
  presenceHigh: number,
): number {
  const duoMask = resolveFixedFiveDuoMask(characters);
  const c0Any = characters[0] as any;
  const c1Any = characters[1] as any;
  const c2Any = characters[2] as any;
  const c3Any = characters[3] as any;
  const c4Any = characters[4] as any;
  const c0Table = c0Any.primaryDamageTop2ByMaskCached as Float64Array | undefined;
  const c1Table = c1Any.primaryDamageTop2ByMaskCached as Float64Array | undefined;
  const c2Table = c2Any.primaryDamageTop2ByMaskCached as Float64Array | undefined;
  const c3Table = c3Any.primaryDamageTop2ByMaskCached as Float64Array | undefined;
  const c4Table = c4Any.primaryDamageTop2ByMaskCached as Float64Array | undefined;
  if (
    c0Table !== undefined &&
    c1Table !== undefined &&
    c2Table !== undefined &&
    c3Table !== undefined &&
    c4Table !== undefined
  ) {
    const metricOffset = getDamageMetricTableIndex(metric) << 4;
    const score =
      c0Table[
        metricOffset +
        (((c0Any.magic2IsDuoBaseCached as boolean) === true || (duoMask & 1) !== 0) ? 8 : 0) +
        getActiveBuddyMaskFromPresence(c0Any, presenceLow, presenceHigh)
      ] +
      c1Table[
        metricOffset +
        (((c1Any.magic2IsDuoBaseCached as boolean) === true || (duoMask & 2) !== 0) ? 8 : 0) +
        getActiveBuddyMaskFromPresence(c1Any, presenceLow, presenceHigh)
      ] +
      c2Table[
        metricOffset +
        (((c2Any.magic2IsDuoBaseCached as boolean) === true || (duoMask & 4) !== 0) ? 8 : 0) +
        getActiveBuddyMaskFromPresence(c2Any, presenceLow, presenceHigh)
      ] +
      c3Table[
        metricOffset +
        (((c3Any.magic2IsDuoBaseCached as boolean) === true || (duoMask & 8) !== 0) ? 8 : 0) +
        getActiveBuddyMaskFromPresence(c3Any, presenceLow, presenceHigh)
      ] +
      c4Table[
        metricOffset +
        (((c4Any.magic2IsDuoBaseCached as boolean) === true || (duoMask & 16) !== 0) ? 8 : 0) +
        getActiveBuddyMaskFromPresence(c4Any, presenceLow, presenceHigh)
      ];
    return Math.floor(score);
  }
  const score =
    calculatePrimaryDamageTop2ForCharacter(characters[0], metric, presenceLow, presenceHigh, (duoMask & 1) !== 0) +
    calculatePrimaryDamageTop2ForCharacter(characters[1], metric, presenceLow, presenceHigh, (duoMask & 2) !== 0) +
    calculatePrimaryDamageTop2ForCharacter(characters[2], metric, presenceLow, presenceHigh, (duoMask & 4) !== 0) +
    calculatePrimaryDamageTop2ForCharacter(characters[3], metric, presenceLow, presenceHigh, (duoMask & 8) !== 0) +
    calculatePrimaryDamageTop2ForCharacter(characters[4], metric, presenceLow, presenceHigh, (duoMask & 16) !== 0);
  return Math.floor(score);
}

function calculatePrimaryDamageTopNForFixedFiveWithPresence(
  characters: Character[],
  metric: number,
  attackNum: number,
  presenceLow: number,
  presenceHigh: number,
): number | undefined {
  const duoMask = resolveFixedFiveDuoMask(characters);
  const c0Any = characters[0] as any;
  const c1Any = characters[1] as any;
  const c2Any = characters[2] as any;
  const c3Any = characters[3] as any;
  const c4Any = characters[4] as any;
  let c0Table = c0Any.primaryDamageTop2ByMaskCached as Float64Array | undefined;
  let c1Table = c1Any.primaryDamageTop2ByMaskCached as Float64Array | undefined;
  let c2Table = c2Any.primaryDamageTop2ByMaskCached as Float64Array | undefined;
  let c3Table = c3Any.primaryDamageTop2ByMaskCached as Float64Array | undefined;
  let c4Table = c4Any.primaryDamageTop2ByMaskCached as Float64Array | undefined;
  if (
    c0Table === undefined ||
    c1Table === undefined ||
    c2Table === undefined ||
    c3Table === undefined ||
    c4Table === undefined
  ) {
    return undefined;
  }
  const needsMinTable = attackNum === 9 || attackNum === 8;
  const c0MinTable = needsMinTable ? ensurePrimaryDamageTop2MinByMask(characters[0], c0Any) : undefined;
  const c1MinTable = needsMinTable ? ensurePrimaryDamageTop2MinByMask(characters[1], c1Any) : undefined;
  const c2MinTable = needsMinTable ? ensurePrimaryDamageTop2MinByMask(characters[2], c2Any) : undefined;
  const c3MinTable = needsMinTable ? ensurePrimaryDamageTop2MinByMask(characters[3], c3Any) : undefined;
  const c4MinTable = needsMinTable ? ensurePrimaryDamageTop2MinByMask(characters[4], c4Any) : undefined;
  c0Table = c0Any.primaryDamageTop2ByMaskCached as Float64Array;
  c1Table = c1Any.primaryDamageTop2ByMaskCached as Float64Array;
  c2Table = c2Any.primaryDamageTop2ByMaskCached as Float64Array;
  c3Table = c3Any.primaryDamageTop2ByMaskCached as Float64Array;
  c4Table = c4Any.primaryDamageTop2ByMaskCached as Float64Array;

  const metricOffset = getDamageMetricTableIndex(metric) << 4;
  const c0Index = metricOffset + (((c0Any.magic2IsDuoBaseCached as boolean) === true || (duoMask & 1) !== 0) ? 8 : 0) + getActiveBuddyMaskFromPresence(c0Any, presenceLow, presenceHigh);
  const c1Index = metricOffset + (((c1Any.magic2IsDuoBaseCached as boolean) === true || (duoMask & 2) !== 0) ? 8 : 0) + getActiveBuddyMaskFromPresence(c1Any, presenceLow, presenceHigh);
  const c2Index = metricOffset + (((c2Any.magic2IsDuoBaseCached as boolean) === true || (duoMask & 4) !== 0) ? 8 : 0) + getActiveBuddyMaskFromPresence(c2Any, presenceLow, presenceHigh);
  const c3Index = metricOffset + (((c3Any.magic2IsDuoBaseCached as boolean) === true || (duoMask & 8) !== 0) ? 8 : 0) + getActiveBuddyMaskFromPresence(c3Any, presenceLow, presenceHigh);
  const c4Index = metricOffset + (((c4Any.magic2IsDuoBaseCached as boolean) === true || (duoMask & 16) !== 0) ? 8 : 0) + getActiveBuddyMaskFromPresence(c4Any, presenceLow, presenceHigh);
  const total =
    c0Table[c0Index] +
    c1Table[c1Index] +
    c2Table[c2Index] +
    c3Table[c3Index] +
    c4Table[c4Index];
  if (attackNum >= 10) return total;
  if (attackNum === 9) {
    return total - Math.min(
      c0MinTable![c0Index],
      c1MinTable![c1Index],
      c2MinTable![c2Index],
      c3MinTable![c3Index],
      c4MinTable![c4Index],
    );
  }
  if (attackNum === 8) {
    const c0Min = c0MinTable![c0Index];
    const c1Min = c1MinTable![c1Index];
    const c2Min = c2MinTable![c2Index];
    const c3Min = c3MinTable![c3Index];
    const c4Min = c4MinTable![c4Index];
    let min1 = Infinity;
    let min2 = Infinity;
    let value = c0Min;
    if (value < min1) { min2 = min1; min1 = value; } else if (value < min2) { min2 = value; }
    value = c0Table[c0Index] - c0Min;
    if (value < min1) { min2 = min1; min1 = value; } else if (value < min2) { min2 = value; }
    value = c1Min;
    if (value < min1) { min2 = min1; min1 = value; } else if (value < min2) { min2 = value; }
    value = c1Table[c1Index] - c1Min;
    if (value < min1) { min2 = min1; min1 = value; } else if (value < min2) { min2 = value; }
    value = c2Min;
    if (value < min1) { min2 = min1; min1 = value; } else if (value < min2) { min2 = value; }
    value = c2Table[c2Index] - c2Min;
    if (value < min1) { min2 = min1; min1 = value; } else if (value < min2) { min2 = value; }
    value = c3Min;
    if (value < min1) { min2 = min1; min1 = value; } else if (value < min2) { min2 = value; }
    value = c3Table[c3Index] - c3Min;
    if (value < min1) { min2 = min1; min1 = value; } else if (value < min2) { min2 = value; }
    value = c4Min;
    if (value < min1) { min2 = min1; min1 = value; } else if (value < min2) { min2 = value; }
    value = c4Table[c4Index] - c4Min;
    if (value < min1) { min2 = min1; min1 = value; } else if (value < min2) { min2 = value; }
    return total - min1 - min2;
  }
  return undefined;
}

function fixedFiveHpThresholdsPass(
  characters: Character[],
  presenceLow: number,
  presenceHigh: number,
  minHP: number,
  minEHP: number,
): boolean {
  if (minHP <= 0 && minEHP <= 0) return true;
  let hp = 0;
  let heal = 0;
  for (let i = 0; i < 5; i++) {
    const chara = characters[i];
    const charaAny = chara as any;
    hp += chara.calcBaseHP;
    heal += charaAny.totalHealCached as number;

    if ((((charaAny.buddy1BitLowCached as number) & presenceLow) | ((charaAny.buddy1BitHighCached as number) & presenceHigh)) !== 0) {
      hp += charaAny.buddy1HpIncreaseCached as number;
      heal += charaAny.buddy1ContinueHealCached as number;
    }
    if ((((charaAny.buddy2BitLowCached as number) & presenceLow) | ((charaAny.buddy2BitHighCached as number) & presenceHigh)) !== 0) {
      hp += charaAny.buddy2HpIncreaseCached as number;
      heal += charaAny.buddy2ContinueHealCached as number;
    }
    if ((((charaAny.buddy3BitLowCached as number) & presenceLow) | ((charaAny.buddy3BitHighCached as number) & presenceHigh)) !== 0) {
      hp += charaAny.buddy3HpIncreaseCached as number;
      heal += charaAny.buddy3ContinueHealCached as number;
    }
  }
  return hp >= minHP && hp + heal >= minEHP;
}

function fillHpHealByBuddyMask(chara: Character, charaAny: any, hpOut: Float64Array, healOut: Float64Array): void {
  const baseHP = chara.calcBaseHP;
  const baseHeal = charaAny.totalHealCached as number;
  for (let buddyMask = 0; buddyMask < 8; buddyMask++) {
    let hp = baseHP;
    let heal = baseHeal;
    if ((buddyMask & 1) !== 0) {
      hp += charaAny.buddy1HpIncreaseCached as number;
      heal += charaAny.buddy1ContinueHealCached as number;
    }
    if ((buddyMask & 2) !== 0) {
      hp += charaAny.buddy2HpIncreaseCached as number;
      heal += charaAny.buddy2ContinueHealCached as number;
    }
    if ((buddyMask & 4) !== 0) {
      hp += charaAny.buddy3HpIncreaseCached as number;
      heal += charaAny.buddy3ContinueHealCached as number;
    }
    hpOut[buddyMask] = hp;
    healOut[buddyMask] = heal;
  }
}

function fillIncreasedHpByBuddyMask(charaAny: any, out: Float64Array): void {
  for (let buddyMask = 0; buddyMask < 8; buddyMask++) {
    let increasedHp = 0;
    if ((buddyMask & 1) !== 0) increasedHp += charaAny.buddy1HpIncreaseCached as number;
    if ((buddyMask & 2) !== 0) increasedHp += charaAny.buddy2HpIncreaseCached as number;
    if ((buddyMask & 4) !== 0) increasedHp += charaAny.buddy3HpIncreaseCached as number;
    out[buddyMask] = increasedHp;
  }
}

const topNSumScratch = new Array<number>(10);
const noMetaResultScratch = new Array<number>(20);
const topTwoDamageScratch: number[] = [0, 0];
const AUX_METRIC_EVASION = 1 << 0;
const AUX_METRIC_HP_BUDDY = 1 << 1;
const AUX_METRIC_INCREASED_HP_BUDDY = 1 << 2;
const AUX_METRIC_BUDDY = 1 << 3;
const AUX_METRIC_NO_HP_BUDDY = 1 << 4;
const AUX_METRIC_DUO = 1 << 5;
const AUX_METRIC_BUFF = 1 << 6;
const AUX_METRIC_DEBUFF = 1 << 7;
const AUX_METRIC_COSMIC = 1 << 8;
const AUX_METRIC_FIRE = 1 << 9;
const AUX_METRIC_WATER = 1 << 10;
const AUX_METRIC_FLORA = 1 << 11;
const AUX_METRIC_HEAL_NUM = 1 << 12;
const AUX_METRIC_ALL =
  AUX_METRIC_EVASION |
  AUX_METRIC_HP_BUDDY |
  AUX_METRIC_INCREASED_HP_BUDDY |
  AUX_METRIC_BUDDY |
  AUX_METRIC_NO_HP_BUDDY |
  AUX_METRIC_DUO |
  AUX_METRIC_BUFF |
  AUX_METRIC_DEBUFF |
  AUX_METRIC_COSMIC |
  AUX_METRIC_FIRE |
  AUX_METRIC_WATER |
  AUX_METRIC_FLORA |
  AUX_METRIC_HEAL_NUM;
const DAMAGE_METRIC_REFERENCE = 1 << 0;
const DAMAGE_METRIC_ADVANTAGE = 1 << 1;
const DAMAGE_METRIC_VS_HI = 1 << 2;
const DAMAGE_METRIC_VS_MIZU = 1 << 3;
const DAMAGE_METRIC_VS_KI = 1 << 4;
const DAMAGE_METRIC_ALL =
  DAMAGE_METRIC_REFERENCE |
  DAMAGE_METRIC_ADVANTAGE |
  DAMAGE_METRIC_VS_HI |
  DAMAGE_METRIC_VS_MIZU |
  DAMAGE_METRIC_VS_KI;

function getDamageMetricTableIndex(metric: number): number {
  if (metric === DAMAGE_METRIC_REFERENCE) return 0;
  if (metric === DAMAGE_METRIC_ADVANTAGE) return 1;
  if (metric === DAMAGE_METRIC_VS_HI) return 2;
  if (metric === DAMAGE_METRIC_VS_MIZU) return 3;
  return 4;
}

function fillPrimaryDamageTop2ByMask(
  chara: Character,
  charaAny: any,
  out: Float64Array,
  minOut: Float64Array,
): void {
  const totals = charaAny.magicBuffTotalsCached as Array<{ atkDelta: number; dmgDelta: number }> | undefined;
  const m1Totals = totals?.[1] ?? zeroMagicTotals;
  const m2Totals = totals?.[2] ?? zeroMagicTotals;
  const m3Totals = totals?.[3] ?? zeroMagicTotals;
  const baseATK = chara.calcBaseATK;
  const useM1 = charaAny.useM1Cached as boolean;
  const useM2 = charaAny.useM2Cached as boolean;
  const useM3 = charaAny.useM3Cached as boolean;

  for (let buddyMask = 0; buddyMask < 8; buddyMask++) {
    let atkBuddyRate = 0;
    let buddyDamageRate = 0;
    let buddyFireDamageRate = 0;
    let buddyWaterDamageRate = 0;
    let buddyWoodDamageRate = 0;
    let buddyCosmicDamageRate = 0;
    if ((buddyMask & 1) !== 0) {
      atkBuddyRate += charaAny.buddy1AtkRateCached as number;
      buddyDamageRate += charaAny.buddy1DamageRateCached as number;
      buddyFireDamageRate += charaAny.buddy1FireDamageRateCached as number;
      buddyWaterDamageRate += charaAny.buddy1WaterDamageRateCached as number;
      buddyWoodDamageRate += charaAny.buddy1WoodDamageRateCached as number;
      buddyCosmicDamageRate += charaAny.buddy1CosmicDamageRateCached as number;
    }
    if ((buddyMask & 2) !== 0) {
      atkBuddyRate += charaAny.buddy2AtkRateCached as number;
      buddyDamageRate += charaAny.buddy2DamageRateCached as number;
      buddyFireDamageRate += charaAny.buddy2FireDamageRateCached as number;
      buddyWaterDamageRate += charaAny.buddy2WaterDamageRateCached as number;
      buddyWoodDamageRate += charaAny.buddy2WoodDamageRateCached as number;
      buddyCosmicDamageRate += charaAny.buddy2CosmicDamageRateCached as number;
    }
    if ((buddyMask & 4) !== 0) {
      atkBuddyRate += charaAny.buddy3AtkRateCached as number;
      buddyDamageRate += charaAny.buddy3DamageRateCached as number;
      buddyFireDamageRate += charaAny.buddy3FireDamageRateCached as number;
      buddyWaterDamageRate += charaAny.buddy3WaterDamageRateCached as number;
      buddyWoodDamageRate += charaAny.buddy3WoodDamageRateCached as number;
      buddyCosmicDamageRate += charaAny.buddy3CosmicDamageRateCached as number;
    }

    const m1BuddyDamageDelta = buddyDamageRate + getActiveAttributeBuddyDamageRate(chara, 1, buddyFireDamageRate, buddyWaterDamageRate, buddyWoodDamageRate, buddyCosmicDamageRate);
    const m2BuddyDamageDelta = buddyDamageRate + getActiveAttributeBuddyDamageRate(chara, 2, buddyFireDamageRate, buddyWaterDamageRate, buddyWoodDamageRate, buddyCosmicDamageRate);
    const m3BuddyDamageDelta = buddyDamageRate + getActiveAttributeBuddyDamageRate(chara, 3, buddyFireDamageRate, buddyWaterDamageRate, buddyWoodDamageRate, buddyCosmicDamageRate);

    let m1Damage = 0;
    let m3Damage = 0;
    if (useM1) {
      m1Damage =
        (charaAny.m1DamageBaseCached as number) +
        (charaAny.m1DamageBuddyCoeffCached as number) * atkBuddyRate;
      if (m1BuddyDamageDelta !== 0) {
        m1Damage += baseATK * (charaAny.m1ComboRateCached as number) * m1BuddyDamageDelta * (1 + m1Totals.atkDelta + atkBuddyRate);
      }
    }
    if (useM3) {
      m3Damage =
        (charaAny.m3DamageBaseCached as number) +
        (charaAny.m3DamageBuddyCoeffCached as number) * atkBuddyRate;
      if (m3BuddyDamageDelta !== 0) {
        m3Damage += baseATK * (charaAny.m3ComboRateCached as number) * m3BuddyDamageDelta * (1 + m3Totals.atkDelta + atkBuddyRate);
      }
    }

    for (let duoState = 0; duoState < 2; duoState++) {
      let m2Damage = 0;
      if (useM2) {
        const useDuo = (charaAny.magic2IsDuoBaseCached as boolean) === true || duoState === 1;
        m2Damage = useDuo
          ? (
            (charaAny.m2DuoDamageBaseCached as number) +
            (charaAny.m2DuoDamageBuddyCoeffCached as number) * atkBuddyRate
          )
          : (
            (charaAny.m2DamageBaseCached as number) +
            (charaAny.m2DamageBuddyCoeffCached as number) * atkBuddyRate
          );
        if (m2BuddyDamageDelta !== 0) {
          const comboRate = useDuo ? (charaAny.m2DuoComboRateCached as number) : (charaAny.m2ComboRateCached as number);
          m2Damage += baseATK * comboRate * m2BuddyDamageDelta * (1 + m2Totals.atkDelta + atkBuddyRate);
        }
      }

      const offset = duoState * 8 + buddyMask;
      writeTopTwoDamageTables(out, minOut, offset, m1Damage, m2Damage, m3Damage);
      writeTopTwoDamageTables(
        out,
        minOut,
        16 + offset,
        m1Damage * (charaAny.m1AdvantageRateCached as number),
        m2Damage * (charaAny.m2AdvantageRateCached as number),
        m3Damage * (charaAny.m3AdvantageRateCached as number),
      );
      writeTopTwoDamageTables(
        out,
        minOut,
        32 + offset,
        m1Damage * (charaAny.m1VsFireCached as number),
        m2Damage * (charaAny.m2VsFireCached as number),
        m3Damage * (charaAny.m3VsFireCached as number),
      );
      writeTopTwoDamageTables(
        out,
        minOut,
        48 + offset,
        m1Damage * (charaAny.m1VsWaterCached as number),
        m2Damage * (charaAny.m2VsWaterCached as number),
        m3Damage * (charaAny.m3VsWaterCached as number),
      );
      writeTopTwoDamageTables(
        out,
        minOut,
        64 + offset,
        m1Damage * (charaAny.m1VsWoodCached as number),
        m2Damage * (charaAny.m2VsWoodCached as number),
        m3Damage * (charaAny.m3VsWoodCached as number),
      );
    }
  }
}

function ensurePrimaryDamageTop2MinByMask(chara: Character, charaAny: any): Float64Array {
  const cached = charaAny.primaryDamageTop2MinByMaskCached as Float64Array | undefined;
  if (cached !== undefined) return cached;
  const sumTable = charaAny.primaryDamageTop2ByMaskCached instanceof Float64Array
    ? charaAny.primaryDamageTop2ByMaskCached as Float64Array
    : new Float64Array(80);
  const minTable = new Float64Array(80);
  fillPrimaryDamageTop2ByMask(chara, charaAny, sumTable, minTable);
  charaAny.primaryDamageTop2ByMaskCached = sumTable;
  charaAny.primaryDamageTop2MinByMaskCached = minTable;
  return minTable;
}

function sumTopNByInsertion(values: number[], topN: number): number {
  const len = values.length;
  if (topN <= 0 || len === 0) return 0;
  if (len === 10 && topN >= 8) {
    let total = 0;
    let min1 = Infinity;
    let min2 = Infinity;
    for (let i = 0; i < 10; i++) {
      const v = values[i];
      total += v;
      if (v < min1) {
        min2 = min1;
        min1 = v;
      } else if (v < min2) {
        min2 = v;
      }
    }
    if (topN >= 10) return total;
    if (topN === 9) return total - min1;
    if (topN === 8) return total - min1 - min2;
  }
  if (topN >= len) {
    let total = 0;
    for (let i = 0; i < len; i++) total += values[i];
    return total;
  }

  // 初期topNを作り、最小要素を差し替える方式で部分選択する。
  // topN<=10 のケースでは sort より高速になりやすい。
  let total = 0;
  for (let i = 0; i < topN; i++) {
    const v = values[i];
    topNSumScratch[i] = v;
    total += v;
  }
  let minIdx = 0;
  let minVal = topNSumScratch[0];
  for (let i = 1; i < topN; i++) {
    const v = topNSumScratch[i];
    if (v < minVal) {
      minVal = v;
      minIdx = i;
    }
  }

  for (let i = topN; i < len; i++) {
    const v = values[i];
    if (v <= minVal) continue;
    total += v - minVal;
    topNSumScratch[minIdx] = v;
    minIdx = 0;
    minVal = topNSumScratch[0];
    for (let j = 1; j < topN; j++) {
      const c = topNSumScratch[j];
      if (c < minVal) {
        minVal = c;
        minIdx = j;
      }
    }
  }

  return total;
}

// 配列生成を避けるため、最大2件を出力配列に書き込む
function fillTopTwoDamage(damage1: number, damage2: number, damage3: number, out: number[]): void {
  let max = damage1;
  let second = damage2;
  if (second > max) {
    const tmp = max;
    max = second;
    second = tmp;
  }
  if (damage3 > max) {
    second = max;
    max = damage3;
  } else if (damage3 > second) {
    second = damage3;
  }
  out[0] = max;
  out[1] = second;
}

function clearUsedScratch(mask: Uint8Array, len: number): void {
  if (len === 5) {
    mask[0] = 0;
    mask[1] = 0;
    mask[2] = 0;
    mask[3] = 0;
    mask[4] = 0;
    return;
  }
  mask.fill(0, 0, len);
}

export function calcDeckStatus(
  characters: Character[],
  options: {
    includeDetails?: boolean;
    includeDeckMeta?: boolean;
    skipDamageMetrics?: boolean;
    skipAuxMetrics?: boolean;
    skipHpMetrics?: boolean;
    skipMustCheck?: boolean;
    assumePreparedCache?: boolean;
    auxMetricMask?: number;
    damageMetricMask?: number;
    mustIds?: number[];
    snapshot?: SearchSnapshot;
    settings?: DeckSearchSettings;
  } = {}
): Array<number | string | any> | undefined {
  /*
   * calcDeckStatus の実行方針（高速化版）
   * 1. 事前キャッシュ済みメタ情報を使って、文字列処理をできるだけ回避する
   * 2. 現在デッキの「在籍判定」をビット集合で持ち、バディ/デュオ判定を高速化する
   * 3. 必要な指標だけを計算する（mask + skip フラグ）
   * 4. 結果しきい値に届かないものは早期 return する
   *
   * 注意: ここは探索ループから極めて高頻度で呼ばれるため、
   * 可読性より分岐削減・割り当て削減を優先している。
   */
  const includeDetails = options.includeDetails !== false;
  const includeDeckMeta = options.includeDeckMeta ?? includeDetails;
  const skipDamageMetrics = options.skipDamageMetrics === true;
  const skipAuxMetrics = options.skipAuxMetrics === true;
  const skipHpMetrics = options.skipHpMetrics === true && !includeDetails;
  const skipMustCheck = options.skipMustCheck === true;
  const auxMetricMask = options.auxMetricMask ?? AUX_METRIC_ALL;
  const damageMetricMask = options.damageMetricMask ?? DAMAGE_METRIC_ALL;
  const needsDuoCalc = !skipAuxMetrics || !skipDamageMetrics;
  // デュオ解決（M2デュオ化/duo指標）が不要な経路では ID 配列準備を省く
  const needsDuoResolution =
    needsDuoCalc &&
    (
      !skipDamageMetrics ||
      includeDetails ||
      (!skipAuxMetrics && (auxMetricMask & AUX_METRIC_DUO) !== 0)
    );
  const useBuddyBitPresence = true;
  const snapshot = options.snapshot ?? (options.settings ? buildSearchSnapshot(options.settings) : EMPTY_SEARCH_SNAPSHOT);
  const charaLen = characters.length; // Opt-266: length参照をローカル化
  const assumePreparedCache = options.assumePreparedCache === true;
  if (!assumePreparedCache) {
    const firstCharaAny = characters[0] as any;
    if (
      firstCharaAny.charaId === undefined ||
      firstCharaAny.duoId === undefined ||
      firstCharaAny.useM1Cached === undefined
    ) {
      for (let i = 0; i < charaLen; i++) {
        prepareCharacterSearchCache(characters[i]);
      }
    }
  }
  const needMemberFlags = !skipMustCheck;
  // Opt-296: memberFlags をスタンプ方式で再利用
  if (needMemberFlags) {
    if (memberFlags.length < charaIdMap.size + 1) {
      memberFlags = new Uint32Array(charaIdMap.size + 1);
      memberFlagsStamp = 0;
    }
    // clear() を毎回走らせる代わりに世代番号で「今回の探索で立った印」を判定する。
    // stamp がオーバーフローしたときだけ全クリアする。
    memberFlagsStamp = (memberFlagsStamp + 1) >>> 0;
    if (memberFlagsStamp === 0) {
      memberFlagsStamp = 1;
      memberFlags.fill(0);
    }
  }
  const charaIds: Int16Array | null = needsDuoResolution
    ? (charaIdsScratch.length >= charaLen ? charaIdsScratch : (charaIdsScratch = new Int16Array(charaLen)))
    : null;
  const duoIds: Int16Array | null = needsDuoResolution
    ? (duoIdsScratch.length >= charaLen ? duoIdsScratch : (duoIdsScratch = new Int16Array(charaLen)))
    : null;
  let presenceLow = 0;
  let presenceHigh = 0;
  if (needsDuoResolution) {
    if (needMemberFlags) {
      for (let i = 0; i < charaLen; i++) {
        const charaAny = characters[i] as any;
        const charaId = charaAny.charaId as number;
        const duoId = charaAny.duoId as number;
        const charaBitLow = charaAny.charaBitLowCached as number;
        const charaBitHigh = charaAny.charaBitHighCached as number;
        presenceLow = (presenceLow | charaBitLow) >>> 0;
        presenceHigh = (presenceHigh | charaBitHigh) >>> 0;
        charaIds![i] = charaId;
        duoIds![i] = duoId;
        memberFlags[charaId] = memberFlagsStamp;
      }
    } else {
      for (let i = 0; i < charaLen; i++) {
        const charaAny = characters[i] as any;
        const charaId = charaAny.charaId as number;
        const duoId = charaAny.duoId as number;
        const charaBitLow = charaAny.charaBitLowCached as number;
        const charaBitHigh = charaAny.charaBitHighCached as number;
        presenceLow = (presenceLow | charaBitLow) >>> 0;
        presenceHigh = (presenceHigh | charaBitHigh) >>> 0;
        charaIds![i] = charaId;
        duoIds![i] = duoId;
      }
    }
  } else {
    if (needMemberFlags) {
      for (let i = 0; i < charaLen; i++) {
        const charaAny = characters[i] as any;
        const charaId = charaAny.charaId as number;
        const charaBitLow = charaAny.charaBitLowCached as number;
        const charaBitHigh = charaAny.charaBitHighCached as number;
        presenceLow = (presenceLow | charaBitLow) >>> 0;
        presenceHigh = (presenceHigh | charaBitHigh) >>> 0;
        memberFlags[charaId] = memberFlagsStamp;
      }
    } else {
      for (let i = 0; i < charaLen; i++) {
        const charaAny = characters[i] as any;
        const charaBitLow = charaAny.charaBitLowCached as number;
        const charaBitHigh = charaAny.charaBitHighCached as number;
        presenceLow = (presenceLow | charaBitLow) >>> 0;
        presenceHigh = (presenceHigh | charaBitHigh) >>> 0;
      }
    }
  }
  if (!skipMustCheck) {
    const mustIds = options.mustIds ?? [];
    const mustLen = mustIds.length;
    if (mustLen === 1) {
      if (memberFlags[mustIds[0]] !== memberFlagsStamp) return;
    } else if (mustLen === 2) {
      if (memberFlags[mustIds[0]] !== memberFlagsStamp || memberFlags[mustIds[1]] !== memberFlagsStamp) return;
    } else if (mustLen > 2) {
      // Opt-60: every を for ループに置換
      for (let i = 0; i < mustLen; i++) {
        if (memberFlags[mustIds[i]] !== memberFlagsStamp) {
          return;
        }
      }
    }
  }
  let deckTotalHP = 0;
  let deckTotalHeal = 0;
  let deckTotalEvasion = 0;
  let deckTotalHPBuddy = 0;
  let deckTotalBuddy = 0;
  let deckNoHPBuddy = 0;
  let deckTotalBuff = 0;
  let deckTotalDebuff = 0;
  let deckDuo = 0;
  let deckCosmic = 0;
  let deckFire = 0;
  let deckWater = 0;
  let deckFlora = 0;
  let deckHealCards = 0;
  let deckMinIncreasedHPBuddy = 99999;
  // 攻撃回数が全手数以上なら上位ソートを省略できる
  const totalAttacks = characters.length * 2;
  const attackNumValue = snapshot.attackNum;
  const useFullSum = attackNumValue >= totalAttacks;
  const shouldCollectDamage = !skipDamageMetrics;
  const needEvasion = !skipAuxMetrics && (auxMetricMask & AUX_METRIC_EVASION) !== 0;
  const needHPBuddy = !skipAuxMetrics && (auxMetricMask & AUX_METRIC_HP_BUDDY) !== 0;
  const needIncreasedHPBuddy = !skipAuxMetrics && (auxMetricMask & AUX_METRIC_INCREASED_HP_BUDDY) !== 0;
  const needBuddy = !skipAuxMetrics && (auxMetricMask & AUX_METRIC_BUDDY) !== 0;
  const needNoHPBuddy = !skipAuxMetrics && (auxMetricMask & AUX_METRIC_NO_HP_BUDDY) !== 0;
  const needDuo = !skipAuxMetrics && (auxMetricMask & AUX_METRIC_DUO) !== 0;
  const needBuff = !skipAuxMetrics && (auxMetricMask & AUX_METRIC_BUFF) !== 0;
  const needDebuff = !skipAuxMetrics && (auxMetricMask & AUX_METRIC_DEBUFF) !== 0;
  const needCosmic = !skipAuxMetrics && (auxMetricMask & AUX_METRIC_COSMIC) !== 0;
  const needFire = !skipAuxMetrics && (auxMetricMask & AUX_METRIC_FIRE) !== 0;
  const needWater = !skipAuxMetrics && (auxMetricMask & AUX_METRIC_WATER) !== 0;
  const needFlora = !skipAuxMetrics && (auxMetricMask & AUX_METRIC_FLORA) !== 0;
  const needHealNum = !skipAuxMetrics && (auxMetricMask & AUX_METRIC_HEAL_NUM) !== 0;
  const needBuddyInc = needBuddy ? 1 : 0;
  const needHPBuddyInc = needHPBuddy ? 1 : 0;
  const needIncreasedHPBuddyMul = needIncreasedHPBuddy ? 1 : 0;
  const needReferenceDamage = shouldCollectDamage && (damageMetricMask & DAMAGE_METRIC_REFERENCE) !== 0;
  const needReferenceAdvantageDamage = shouldCollectDamage && (damageMetricMask & DAMAGE_METRIC_ADVANTAGE) !== 0;
  const needReferenceVsHiDamage = shouldCollectDamage && (damageMetricMask & DAMAGE_METRIC_VS_HI) !== 0;
  const needReferenceVsMizuDamage = shouldCollectDamage && (damageMetricMask & DAMAGE_METRIC_VS_MIZU) !== 0;
  const needReferenceVsKiDamage = shouldCollectDamage && (damageMetricMask & DAMAGE_METRIC_VS_KI) !== 0;
  const needAnyDamageMetric =
    needReferenceDamage ||
    needReferenceAdvantageDamage ||
    needReferenceVsHiDamage ||
    needReferenceVsMizuDamage ||
    needReferenceVsKiDamage;
  const needAttackRateFromBuddy = needAnyDamageMetric;
  const needsAnyBuddyAuxCounter = needBuddy || needHPBuddy || needNoHPBuddy || needIncreasedHPBuddy;
  const usePreparedLinearDamagePath = assumePreparedCache;
  // 5枚編成(=10打点) かつ attackNum が 8〜10 のときだけ使える軽量経路。
  // 各打点を配列に積まず「合計 + 最小2件」だけ保持して上位和を復元する。
  // これにより push / sort 相当のコストを避ける。
  const useTopNStreamingFastPath = shouldCollectDamage && !useFullSum && totalAttacks === 10 && attackNumValue >= 8;
  const deckReferenceDamageList: number[] | null = (needReferenceDamage && !useFullSum && !useTopNStreamingFastPath) ? [] : null;
  const deckReferenceAdvantageDamageList: number[] | null = (needReferenceAdvantageDamage && !useFullSum && !useTopNStreamingFastPath) ? [] : null;
  const deckReferenceVsHiDamageList: number[] | null = (needReferenceVsHiDamage && !useFullSum && !useTopNStreamingFastPath) ? [] : null;
  const deckReferenceVsMizuDamageList: number[] | null = (needReferenceVsMizuDamage && !useFullSum && !useTopNStreamingFastPath) ? [] : null;
  const deckReferenceVsKiDamageList: number[] | null = (needReferenceVsKiDamage && !useFullSum && !useTopNStreamingFastPath) ? [] : null;
  let deckReferenceDamage = 0;
  let deckReferenceAdvantageDamage = 0;
  let deckReferenceVsHiDamage = 0;
  let deckReferenceVsMizuDamage = 0;
  let deckReferenceVsKiDamage = 0;
  let refDamageTotal = 0;
  let refDamageMin1 = Infinity;
  let refDamageMin2 = Infinity;
  let refAdvTotal = 0;
  let refAdvMin1 = Infinity;
  let refAdvMin2 = Infinity;
  let refHiTotal = 0;
  let refHiMin1 = Infinity;
  let refHiMin2 = Infinity;
  let refMizuTotal = 0;
  let refMizuMin1 = Infinity;
  let refMizuMin2 = Infinity;
  let refKiTotal = 0;
  let refKiMin1 = Infinity;
  let refKiMin2 = Infinity;
  const useFixedFiveDuoBitsetFastPath =
    needsDuoResolution &&
    charaLen === 5;
  // Opt-44: 使用済みフラグを Uint8Array 化
  const name2M2Used = needsDuoResolution && !useFixedFiveDuoBitsetFastPath
    ? (name2M2UsedScratch.length >= charaLen ? name2M2UsedScratch : (name2M2UsedScratch = new Uint8Array(charaLen)))
    : null;
  const name2MotherUsed = needsDuoResolution && !useFixedFiveDuoBitsetFastPath
    ? (name2MotherUsedScratch.length >= charaLen ? name2MotherUsedScratch : (name2MotherUsedScratch = new Uint8Array(charaLen)))
    : null;
  const name2DuoUsed = needsDuoResolution && !useFixedFiveDuoBitsetFastPath
    ? (name2DuoUsedScratch.length >= charaLen ? name2DuoUsedScratch : (name2DuoUsedScratch = new Uint8Array(charaLen)))
    : null;
  if (needsDuoResolution && !useFixedFiveDuoBitsetFastPath) {
    clearUsedScratch(name2M2Used!, charaLen);
    clearUsedScratch(name2MotherUsed!, charaLen);
    clearUsedScratch(name2DuoUsed!, charaLen);
  }
  let fixedDuoUsedMask = 0;
  let fixedM2UsedMask = 0;
  let fixedMotherUsedMask = 0;
  let fixedDuoCandidateMasks: Int32Array | null = null;
  let fixedDuoMutualMasks: Int32Array | null = null;
  if (useFixedFiveDuoBitsetFastPath) {
    // 5枚固定時は「どのスロットがデュオ候補か」を先に bit 化しておくと、
    // 後段の探索で線形探索を減らせる。
    fixedDuoCandidateMasks = fixedDuoCandidateMasksScratch;
    fixedDuoMutualMasks = fixedDuoMutualMasksScratch;
    for (let i = 0; i < 5; i++) {
      const duoId = duoIds![i];
      const charaId = charaIds![i];
      let candidateMask = 0;
      let mutualMask = 0;
      for (let j = 0; j < 5; j++) {
        if (charaIds![j] !== duoId) continue;
        const bit = (1 << j);
        candidateMask |= bit;
        if (duoIds![j] === charaId) {
          mutualMask |= bit;
        }
      }
      fixedDuoCandidateMasks[i] = candidateMask;
      fixedDuoMutualMasks[i] = mutualMask;
    }
  }
  const deckList: string[] | null = includeDeckMeta ? [] : null;
  let simuURL = '';
  const detailList: any[] | null = includeDetails ? [] : null;
  const healList: number[] | null = includeDetails ? [] : null;
  const damageList: number[] | null = includeDetails ? [] : null;
  const advantageDamageList: number[] | null = includeDetails ? [] : null;
  const hiDamageList: number[] | null = includeDetails ? [] : null;
  const mizuDamageList: number[] | null = includeDetails ? [] : null;
  const kiDamageList: number[] | null = includeDetails ? [] : null;
  const topTwoScratch: number[] | null = needAnyDamageMetric
    ? topTwoDamageScratch
    : null;
  const zeroTotalsRefForDisabledMagic = { atkDelta: 0, dmgDelta: 0 };
  for (let index = 0; index < charaLen; index++) {
    const chara = characters[index];
    const charaAny = chara as any; // Opt-248: any参照の重複取得を削減
    const baseHP = chara.calcBaseHP;
    const baseATK = chara.calcBaseATK;
    const useM1 = charaAny.useM1Cached as boolean;
    const useM2 = charaAny.useM2Cached as boolean;
    const useM3 = charaAny.useM3Cached as boolean;
    if (includeDeckMeta) {
      deckList!.push(chara.imgUrl);
    }
    if (includeDetails) {
      // Opt-43: encodeURIComponent をキャッシュ
      const encodedName = charaAny.encodedName ?? (charaAny.encodedName = encodeURIComponent(chara.name));
      simuURL += '&name' + (index + 1) + '=' + encodedName;
      simuURL += '&level' + (index + 1) + '=' + chara.level;
    }
    if (!skipHpMetrics) deckTotalHP += baseHP;
    if (!skipAuxMetrics) {
      if (needBuff) deckTotalBuff += (charaAny.totalBuffCached as number) ?? 0;
      if (needDebuff) deckTotalDebuff += (charaAny.totalDebuffCached as number) ?? 0;
      if (needCosmic) deckCosmic += (charaAny.magicCosmicCountCached as number) ?? 0;
      if (needFire) deckFire += (charaAny.magicFireCountCached as number) ?? 0;
      if (needWater) deckWater += (charaAny.magicWaterCountCached as number) ?? 0;
      if (needFlora) deckFlora += (charaAny.magicFloraCountCached as number) ?? 0;
    }
    let hasHpBuddy = false;
    let atkBuddyRate = 0;
    // バディHP増加分加算
    let increasedHP = 0;
    let buddyDamageRate = 0;
    let buddyFireDamageRate = 0;
    let buddyWaterDamageRate = 0;
    let buddyWoodDamageRate = 0;
    let buddyCosmicDamageRate = 0;
    let buddyContinueHeal = 0;
    const buddy1Id = charaAny.buddy1IdCached as number;
    const buddy2Id = charaAny.buddy2IdCached as number;
    const buddy3Id = charaAny.buddy3IdCached as number;
    const needsHpBuddyValue = !skipHpMetrics || needHPBuddy || needIncreasedHPBuddy || needNoHPBuddy;
    const buddy1HpIncrease = needsHpBuddyValue ? (charaAny.buddy1HpIncreaseCached as number) : 0;
    const buddy2HpIncrease = needsHpBuddyValue ? (charaAny.buddy2HpIncreaseCached as number) : 0;
    const buddy3HpIncrease = needsHpBuddyValue ? (charaAny.buddy3HpIncreaseCached as number) : 0;
    const buddy1AtkRate = needAttackRateFromBuddy ? (charaAny.buddy1AtkRateCached as number) : 0;
    const buddy2AtkRate = needAttackRateFromBuddy ? (charaAny.buddy2AtkRateCached as number) : 0;
    const buddy3AtkRate = needAttackRateFromBuddy ? (charaAny.buddy3AtkRateCached as number) : 0;
    const buddy1DamageRate = needAnyDamageMetric ? (charaAny.buddy1DamageRateCached as number) : 0;
    const buddy2DamageRate = needAnyDamageMetric ? (charaAny.buddy2DamageRateCached as number) : 0;
    const buddy3DamageRate = needAnyDamageMetric ? (charaAny.buddy3DamageRateCached as number) : 0;
    const buddy1FireDamage = needAnyDamageMetric ? (charaAny.buddy1FireDamageRateCached as number) : 0;
    const buddy1WaterDamage = needAnyDamageMetric ? (charaAny.buddy1WaterDamageRateCached as number) : 0;
    const buddy1WoodDamage = needAnyDamageMetric ? (charaAny.buddy1WoodDamageRateCached as number) : 0;
    const buddy1CosmicDamage = needAnyDamageMetric ? (charaAny.buddy1CosmicDamageRateCached as number) : 0;
    const buddy2FireDamage = needAnyDamageMetric ? (charaAny.buddy2FireDamageRateCached as number) : 0;
    const buddy2WaterDamage = needAnyDamageMetric ? (charaAny.buddy2WaterDamageRateCached as number) : 0;
    const buddy2WoodDamage = needAnyDamageMetric ? (charaAny.buddy2WoodDamageRateCached as number) : 0;
    const buddy2CosmicDamage = needAnyDamageMetric ? (charaAny.buddy2CosmicDamageRateCached as number) : 0;
    const buddy3FireDamage = needAnyDamageMetric ? (charaAny.buddy3FireDamageRateCached as number) : 0;
    const buddy3WaterDamage = needAnyDamageMetric ? (charaAny.buddy3WaterDamageRateCached as number) : 0;
    const buddy3WoodDamage = needAnyDamageMetric ? (charaAny.buddy3WoodDamageRateCached as number) : 0;
    const buddy3CosmicDamage = needAnyDamageMetric ? (charaAny.buddy3CosmicDamageRateCached as number) : 0;
    const buddy1ContinueHeal = skipHpMetrics ? 0 : (charaAny.buddy1ContinueHealCached as number);
    const buddy2ContinueHeal = skipHpMetrics ? 0 : (charaAny.buddy2ContinueHealCached as number);
    const buddy3ContinueHeal = skipHpMetrics ? 0 : (charaAny.buddy3ContinueHealCached as number);
    if (useBuddyBitPresence) {
      if (assumePreparedCache) {
        if (!needsAnyBuddyAuxCounter) {
          if (needAttackRateFromBuddy) {
            const b1Low = charaAny.buddy1BitLowCached as number;
            const b1High = charaAny.buddy1BitHighCached as number;
            if (((b1Low & presenceLow) | (b1High & presenceHigh)) !== 0) {
              if (buddy1AtkRate !== 0) atkBuddyRate += buddy1AtkRate;
              if (buddy1HpIncrease !== 0) deckTotalHP += buddy1HpIncrease;
            }

            const b2Low = charaAny.buddy2BitLowCached as number;
            const b2High = charaAny.buddy2BitHighCached as number;
            if (((b2Low & presenceLow) | (b2High & presenceHigh)) !== 0) {
              if (buddy2AtkRate !== 0) atkBuddyRate += buddy2AtkRate;
              if (buddy2HpIncrease !== 0) deckTotalHP += buddy2HpIncrease;
            }

            const b3Low = charaAny.buddy3BitLowCached as number;
            const b3High = charaAny.buddy3BitHighCached as number;
            if (((b3Low & presenceLow) | (b3High & presenceHigh)) !== 0) {
              if (buddy3AtkRate !== 0) atkBuddyRate += buddy3AtkRate;
              if (buddy3HpIncrease !== 0) deckTotalHP += buddy3HpIncrease;
            }
          } else {
            const b1Low = charaAny.buddy1BitLowCached as number;
            const b1High = charaAny.buddy1BitHighCached as number;
            if (((b1Low & presenceLow) | (b1High & presenceHigh)) !== 0) {
              if (buddy1HpIncrease !== 0) deckTotalHP += buddy1HpIncrease;
            }

            const b2Low = charaAny.buddy2BitLowCached as number;
            const b2High = charaAny.buddy2BitHighCached as number;
            if (((b2Low & presenceLow) | (b2High & presenceHigh)) !== 0) {
              if (buddy2HpIncrease !== 0) deckTotalHP += buddy2HpIncrease;
            }

            const b3Low = charaAny.buddy3BitLowCached as number;
            const b3High = charaAny.buddy3BitHighCached as number;
            if (((b3Low & presenceLow) | (b3High & presenceHigh)) !== 0) {
              if (buddy3HpIncrease !== 0) deckTotalHP += buddy3HpIncrease;
            }
          }
        } else if (needAttackRateFromBuddy) {
          const b1Low = charaAny.buddy1BitLowCached as number;
          const b1High = charaAny.buddy1BitHighCached as number;
          if (((b1Low & presenceLow) | (b1High & presenceHigh)) !== 0) {
            deckTotalBuddy += needBuddyInc;
            if (buddy1AtkRate !== 0) atkBuddyRate += buddy1AtkRate;
            if (buddy1HpIncrease !== 0) {
              deckTotalHPBuddy += needHPBuddyInc;
              hasHpBuddy = hasHpBuddy || needNoHPBuddy;
              const hpIncrease = buddy1HpIncrease;
              deckTotalHP += hpIncrease;
              increasedHP += hpIncrease * needIncreasedHPBuddyMul;
            }
          }

          const b2Low = charaAny.buddy2BitLowCached as number;
          const b2High = charaAny.buddy2BitHighCached as number;
          if (((b2Low & presenceLow) | (b2High & presenceHigh)) !== 0) {
            deckTotalBuddy += needBuddyInc;
            if (buddy2AtkRate !== 0) atkBuddyRate += buddy2AtkRate;
            if (buddy2HpIncrease !== 0) {
              deckTotalHPBuddy += needHPBuddyInc;
              hasHpBuddy = hasHpBuddy || needNoHPBuddy;
              const hpIncrease = buddy2HpIncrease;
              deckTotalHP += hpIncrease;
              increasedHP += hpIncrease * needIncreasedHPBuddyMul;
            }
          }

          const b3Low = charaAny.buddy3BitLowCached as number;
          const b3High = charaAny.buddy3BitHighCached as number;
          if (((b3Low & presenceLow) | (b3High & presenceHigh)) !== 0) {
            deckTotalBuddy += needBuddyInc;
            if (buddy3AtkRate !== 0) atkBuddyRate += buddy3AtkRate;
            if (buddy3HpIncrease !== 0) {
              deckTotalHPBuddy += needHPBuddyInc;
              hasHpBuddy = hasHpBuddy || needNoHPBuddy;
              const hpIncrease = buddy3HpIncrease;
              deckTotalHP += hpIncrease;
              increasedHP += hpIncrease * needIncreasedHPBuddyMul;
            }
          }
        } else {
          const b1Low = charaAny.buddy1BitLowCached as number;
          const b1High = charaAny.buddy1BitHighCached as number;
          if (((b1Low & presenceLow) | (b1High & presenceHigh)) !== 0) {
            deckTotalBuddy += needBuddyInc;
            if (buddy1HpIncrease !== 0) {
              deckTotalHPBuddy += needHPBuddyInc;
              hasHpBuddy = hasHpBuddy || needNoHPBuddy;
              const hpIncrease = buddy1HpIncrease;
              deckTotalHP += hpIncrease;
              increasedHP += hpIncrease * needIncreasedHPBuddyMul;
            }
          }

          const b2Low = charaAny.buddy2BitLowCached as number;
          const b2High = charaAny.buddy2BitHighCached as number;
          if (((b2Low & presenceLow) | (b2High & presenceHigh)) !== 0) {
            deckTotalBuddy += needBuddyInc;
            if (buddy2HpIncrease !== 0) {
              deckTotalHPBuddy += needHPBuddyInc;
              hasHpBuddy = hasHpBuddy || needNoHPBuddy;
              const hpIncrease = buddy2HpIncrease;
              deckTotalHP += hpIncrease;
              increasedHP += hpIncrease * needIncreasedHPBuddyMul;
            }
          }

          const b3Low = charaAny.buddy3BitLowCached as number;
          const b3High = charaAny.buddy3BitHighCached as number;
          if (((b3Low & presenceLow) | (b3High & presenceHigh)) !== 0) {
            deckTotalBuddy += needBuddyInc;
            if (buddy3HpIncrease !== 0) {
              deckTotalHPBuddy += needHPBuddyInc;
              hasHpBuddy = hasHpBuddy || needNoHPBuddy;
              const hpIncrease = buddy3HpIncrease;
              deckTotalHP += hpIncrease;
              increasedHP += hpIncrease * needIncreasedHPBuddyMul;
            }
          }
        }
      } else {
        let b1Low = charaAny.buddy1BitLowCached as number | undefined;
        let b1High = charaAny.buddy1BitHighCached as number | undefined;
        if (b1Low === undefined || b1High === undefined) {
          const pair = getBitPairById(buddy1Id);
          b1Low = pair.low;
          b1High = pair.high;
          charaAny.buddy1BitLowCached = b1Low;
          charaAny.buddy1BitHighCached = b1High;
        }
        if (((b1Low & presenceLow) | (b1High & presenceHigh)) !== 0) {
          deckTotalBuddy += needBuddyInc;
          if (buddy1AtkRate !== 0) atkBuddyRate += buddy1AtkRate;
          if (buddy1HpIncrease !== 0) {
            deckTotalHPBuddy += needHPBuddyInc;
            hasHpBuddy = hasHpBuddy || needNoHPBuddy;
            const hpIncrease = buddy1HpIncrease;
            deckTotalHP += hpIncrease;
            increasedHP += hpIncrease * needIncreasedHPBuddyMul;
          }
        }

        let b2Low = charaAny.buddy2BitLowCached as number | undefined;
        let b2High = charaAny.buddy2BitHighCached as number | undefined;
        if (b2Low === undefined || b2High === undefined) {
          const pair = getBitPairById(buddy2Id);
          b2Low = pair.low;
          b2High = pair.high;
          charaAny.buddy2BitLowCached = b2Low;
          charaAny.buddy2BitHighCached = b2High;
        }
        if (((b2Low & presenceLow) | (b2High & presenceHigh)) !== 0) {
          deckTotalBuddy += needBuddyInc;
          if (buddy2AtkRate !== 0) atkBuddyRate += buddy2AtkRate;
          if (buddy2HpIncrease !== 0) {
            deckTotalHPBuddy += needHPBuddyInc;
            hasHpBuddy = hasHpBuddy || needNoHPBuddy;
            const hpIncrease = buddy2HpIncrease;
            deckTotalHP += hpIncrease;
            increasedHP += hpIncrease * needIncreasedHPBuddyMul;
          }
        }

        let b3Low = charaAny.buddy3BitLowCached as number | undefined;
        let b3High = charaAny.buddy3BitHighCached as number | undefined;
        if (b3Low === undefined || b3High === undefined) {
          const pair = getBitPairById(buddy3Id);
          b3Low = pair.low;
          b3High = pair.high;
          charaAny.buddy3BitLowCached = b3Low;
          charaAny.buddy3BitHighCached = b3High;
        }
        if (((b3Low & presenceLow) | (b3High & presenceHigh)) !== 0) {
          deckTotalBuddy += needBuddyInc;
          if (buddy3AtkRate !== 0) atkBuddyRate += buddy3AtkRate;
          if (buddy3HpIncrease !== 0) {
            deckTotalHPBuddy += needHPBuddyInc;
            hasHpBuddy = hasHpBuddy || needNoHPBuddy;
            const hpIncrease = buddy3HpIncrease;
            deckTotalHP += hpIncrease;
            increasedHP += hpIncrease * needIncreasedHPBuddyMul;
          }
        }
      }
    }
    const buddy1Active = buddy1Id >= 0 && (((charaAny.buddy1BitLowCached as number) & presenceLow) | ((charaAny.buddy1BitHighCached as number) & presenceHigh)) !== 0;
    const buddy2Active = buddy2Id >= 0 && (((charaAny.buddy2BitLowCached as number) & presenceLow) | ((charaAny.buddy2BitHighCached as number) & presenceHigh)) !== 0;
    const buddy3Active = buddy3Id >= 0 && (((charaAny.buddy3BitLowCached as number) & presenceLow) | ((charaAny.buddy3BitHighCached as number) & presenceHigh)) !== 0;

    if (!skipHpMetrics) {
      if (buddy1Active) buddyContinueHeal += buddy1ContinueHeal;
      if (buddy2Active) buddyContinueHeal += buddy2ContinueHeal;
      if (buddy3Active) buddyContinueHeal += buddy3ContinueHeal;
    }

    if (needAnyDamageMetric) {
      if (buddy1Active) {
        buddyDamageRate += buddy1DamageRate;
        buddyFireDamageRate += buddy1FireDamage;
        buddyWaterDamageRate += buddy1WaterDamage;
        buddyWoodDamageRate += buddy1WoodDamage;
        buddyCosmicDamageRate += buddy1CosmicDamage;
      }
      if (buddy2Active) {
        buddyDamageRate += buddy2DamageRate;
        buddyFireDamageRate += buddy2FireDamage;
        buddyWaterDamageRate += buddy2WaterDamage;
        buddyWoodDamageRate += buddy2WoodDamage;
        buddyCosmicDamageRate += buddy2CosmicDamage;
      }
      if (buddy3Active) {
        buddyDamageRate += buddy3DamageRate;
        buddyFireDamageRate += buddy3FireDamage;
        buddyWaterDamageRate += buddy3WaterDamage;
        buddyWoodDamageRate += buddy3WoodDamage;
        buddyCosmicDamageRate += buddy3CosmicDamage;
      }
    }
    // Opt-33: Math.min を分岐で置換
    if (needIncreasedHPBuddy && increasedHP < deckMinIncreasedHPBuddy) {
      deckMinIncreasedHPBuddy = increasedHP;
    }
    // HP回復分はキャラ単位で事前計算した値を加算
    if (!skipHpMetrics) {
      const totalHeal = (charaAny.totalHealCached as number) + buddyContinueHeal;
      deckTotalHeal += totalHeal;
      if (includeDetails) {
        healList!.push(totalHeal);
      }
    }
      
    // Opt-1: 回復手札数の判定で配列生成を避ける
    if (needHealNum) {
      deckHealCards += (charaAny.healCardCountCached as number);
    }
    
    // 回避数加算
    if (needEvasion) {
      deckTotalEvasion += chara.evasion;
    }
    if (needNoHPBuddy && !hasHpBuddy) {
      deckNoHPBuddy += 1;
    }
    let useDuoPow = (charaAny.magic2IsDuoBaseCached as boolean) === true;
    if (needsDuoResolution && useM2) {
      const duoId = duoIds![index];
      if (useFixedFiveDuoBitsetFastPath) {
        const selfBit = 1 << index;
        if ((fixedDuoUsedMask & selfBit) !== 0) {
          useDuoPow = true;
          if (needDuo) deckDuo += 1;
        } else {
          const candidateMask = fixedDuoCandidateMasks![index];
          const mutualMask = fixedDuoMutualMasks![index];

          // 優先1: 相互デュオ（A↔B）を最優先で確保
          const availableMutualMask = mutualMask & ~fixedDuoUsedMask;
          if (availableMutualMask !== 0) {
            const pairBit = availableMutualMask & -availableMutualMask;
            fixedDuoUsedMask |= selfBit | pairBit;
            fixedM2UsedMask |= selfBit | pairBit;
          }

          // 優先2: 相手のM2使用を消費しない「母体のみ使用」で確保
          if ((fixedM2UsedMask & selfBit) === 0) {
            let scanMask = candidateMask;
            while (scanMask !== 0) {
              const pickBit = scanMask & -scanMask;
              if ((fixedMotherUsedMask & pickBit) === 0) {
                fixedDuoUsedMask |= selfBit;
                fixedM2UsedMask |= selfBit;
                fixedMotherUsedMask |= pickBit;
                break;
              }
              scanMask ^= pickBit;
            }
          }

          // 優先3: 最後に通常のM2競合ルールで確保
          if ((fixedM2UsedMask & selfBit) === 0) {
            let scanMask = candidateMask;
            while (scanMask !== 0) {
              const pickBit = scanMask & -scanMask;
              if ((fixedM2UsedMask & pickBit) === 0) {
                fixedDuoUsedMask |= selfBit;
                fixedM2UsedMask |= selfBit | pickBit;
                break;
              }
              scanMask ^= pickBit;
            }
          }

          if ((fixedDuoUsedMask & selfBit) !== 0) {
            useDuoPow = true;
            if (needDuo) deckDuo += 1;
          }
        }
      } else {
        // M2が無効なら自身のデュオ判定をしない
        if (name2DuoUsed![index]) {
          useDuoPow = true;
          if (needDuo) deckDuo += 1;
        } else {
          const charaId = charaIds![index];
          // Opt-45: entries を for ループへ
          for (let index2 = 0; index2 < charaLen; index2++) {
            if (duoIds![index2] === charaId && duoId === charaIds![index2]) {
              if (!name2DuoUsed![index] && !name2DuoUsed![index2]) {
                name2DuoUsed![index] = 1;
                name2DuoUsed![index2] = 1;
                name2M2Used![index] = 1;
                name2M2Used![index2] = 1;
                break;
              }
            }
          }

          if (!name2M2Used![index]) {
            // Opt-45: entries を for ループへ
            for (let index2 = 0; index2 < charaLen; index2++) {
              if (duoId === charaIds![index2]) {
                if (
                  !name2DuoUsed![index] &&
                  !name2M2Used![index] &&
                  !name2MotherUsed![index2]
                ) {
                  name2DuoUsed![index] = 1;
                  name2M2Used![index] = 1;
                  name2MotherUsed![index2] = 1;
                  break;
                }
              }
            }
          }

          if (!name2M2Used![index]) {
            // Opt-45: entries を for ループへ
            for (let index2 = 0; index2 < charaLen; index2++) {
              if (duoId === charaIds![index2]) {
                if (
                  !name2DuoUsed![index] &&
                  !name2M2Used![index] &&
                  !name2M2Used![index2]
                ) {
                  name2DuoUsed![index] = 1;
                  name2M2Used![index] = 1;
                  name2M2Used![index2] = 1;
                  break;
                }
              }
            }
          }

          if (name2DuoUsed![index]) {
            useDuoPow = true;
            if (needDuo) deckDuo += 1;
          }
        }
      }
    }
    if (needAnyDamageMetric) {
      let magic1Damage = 0;
      let magic2Damage = 0;
      let magic3Damage = 0;
      let magic1AdvantageDamage = 0;
      let magic2AdvantageDamage = 0;
      let magic3AdvantageDamage = 0;
      let magic1vsHiDamage = 0;
      let magic2vsHiDamage = 0;
      let magic3vsHiDamage = 0;
      let magic1vsMizuDamage = 0;
      let magic2vsMizuDamage = 0;
      let magic3vsMizuDamage = 0;
      let magic1vsKiDamage = 0;
      let magic2vsKiDamage = 0;
      let magic3vsKiDamage = 0;
      const totalsAll = (useM1 || useM2 || useM3)
        ? (
          (useM3
            ? (charaAny.magicBuffTotalsAllowM3Cached as Array<{ atkDelta: number; dmgDelta: number }> | undefined)
            : (charaAny.magicBuffTotalsNoM3Cached as Array<{ atkDelta: number; dmgDelta: number }> | undefined)
          )
          ?? getMagicBuffTotalsAll(chara, useM3)
        )
        : null;
      const m1Totals = useM1 ? totalsAll![1] : zeroTotalsRefForDisabledMagic;
      const m2Totals = useM2 ? totalsAll![2] : zeroTotalsRefForDisabledMagic;
      const m3Totals = useM3 ? totalsAll![3] : zeroTotalsRefForDisabledMagic;
      const m1BuddyDamageDelta = buddyDamageRate + (chara.magic1atr === '火' ? buddyFireDamageRate : chara.magic1atr === '水' ? buddyWaterDamageRate : chara.magic1atr === '木' ? buddyWoodDamageRate : buddyCosmicDamageRate);
      const m2BuddyDamageDelta = buddyDamageRate + (chara.magic2atr === '火' ? buddyFireDamageRate : chara.magic2atr === '水' ? buddyWaterDamageRate : chara.magic2atr === '木' ? buddyWoodDamageRate : buddyCosmicDamageRate);
      const m3BuddyDamageDelta = buddyDamageRate + (chara.magic3atr === '火' ? buddyFireDamageRate : chara.magic3atr === '水' ? buddyWaterDamageRate : chara.magic3atr === '木' ? buddyWoodDamageRate : buddyCosmicDamageRate);

      if (usePreparedLinearDamagePath) {
        // 高速経路:
        // ダメージ式を `base + buddyRate * coeff` に事前展開したキャッシュを利用する。
        // ここでは buddyRate を掛けるだけで済むため、文字列パースや分岐を最小化できる。
        if (useM1) {
          magic1Damage =
            (charaAny.m1DamageBaseCached as number) +
            (charaAny.m1DamageBuddyCoeffCached as number) * atkBuddyRate;
          if (m1BuddyDamageDelta !== 0) {
            magic1Damage += baseATK * (charaAny.m1ComboRateCached as number) * m1BuddyDamageDelta * (1 + m1Totals.atkDelta + atkBuddyRate);
          }
          if (needReferenceAdvantageDamage) magic1AdvantageDamage = magic1Damage * (charaAny.m1AdvantageRateCached as number);
          if (needReferenceVsHiDamage) magic1vsHiDamage = magic1Damage * (charaAny.m1VsFireCached as number);
          if (needReferenceVsMizuDamage) magic1vsMizuDamage = magic1Damage * (charaAny.m1VsWaterCached as number);
          if (needReferenceVsKiDamage) magic1vsKiDamage = magic1Damage * (charaAny.m1VsWoodCached as number);
        }
        if (useM2) {
          const isDuoPow = useDuoPow;
          magic2Damage = isDuoPow
            ? (
              (charaAny.m2DuoDamageBaseCached as number) +
              (charaAny.m2DuoDamageBuddyCoeffCached as number) * atkBuddyRate
            )
            : (
              (charaAny.m2DamageBaseCached as number) +
              (charaAny.m2DamageBuddyCoeffCached as number) * atkBuddyRate
            );
          if (m2BuddyDamageDelta !== 0) {
            const comboRate = isDuoPow ? (charaAny.m2DuoComboRateCached as number) : (charaAny.m2ComboRateCached as number);
            magic2Damage += baseATK * comboRate * m2BuddyDamageDelta * (1 + m2Totals.atkDelta + atkBuddyRate);
          }
          if (needReferenceAdvantageDamage) magic2AdvantageDamage = magic2Damage * (charaAny.m2AdvantageRateCached as number);
          if (needReferenceVsHiDamage) magic2vsHiDamage = magic2Damage * (charaAny.m2VsFireCached as number);
          if (needReferenceVsMizuDamage) magic2vsMizuDamage = magic2Damage * (charaAny.m2VsWaterCached as number);
          if (needReferenceVsKiDamage) magic2vsKiDamage = magic2Damage * (charaAny.m2VsWoodCached as number);
        }
        if (useM3) {
          magic3Damage =
            (charaAny.m3DamageBaseCached as number) +
            (charaAny.m3DamageBuddyCoeffCached as number) * atkBuddyRate;
          if (m3BuddyDamageDelta !== 0) {
            magic3Damage += baseATK * (charaAny.m3ComboRateCached as number) * m3BuddyDamageDelta * (1 + m3Totals.atkDelta + atkBuddyRate);
          }
          if (needReferenceAdvantageDamage) magic3AdvantageDamage = magic3Damage * (charaAny.m3AdvantageRateCached as number);
          if (needReferenceVsHiDamage) magic3vsHiDamage = magic3Damage * (charaAny.m3VsFireCached as number);
          if (needReferenceVsMizuDamage) magic3vsMizuDamage = magic3Damage * (charaAny.m3VsWaterCached as number);
          if (needReferenceVsKiDamage) magic3vsKiDamage = magic3Damage * (charaAny.m3VsWoodCached as number);
        }
      } else {
        // 互換経路:
        // 事前展開キャッシュが無いケースでも同一結果を返すため、従来式をそのまま計算する。
        // 等倍ダメージ加算（使用可能なマジックのみ・etc→buffs[]の合算を使用）
        // Opt-129: バフ合算を一度だけ取得
        const m1AtkDelta = m1Totals.atkDelta;
        const m1DmgDelta = m1Totals.dmgDelta + m1BuddyDamageDelta;
        const m2AtkDelta = m2Totals.atkDelta;
        const m2DmgDelta = m2Totals.dmgDelta + m2BuddyDamageDelta;
        const m3AtkDelta = m3Totals.atkDelta;
        const m3DmgDelta = m3Totals.dmgDelta + m3BuddyDamageDelta;
        if (useM1) {
          const effectiveAtk = baseATK * (1 + atkBuddyRate + m1AtkDelta);
          const atkRate = (charaAny.m1BaseRateCached as number) + m1DmgDelta;
          magic1Damage = effectiveAtk * atkRate * (charaAny.m1ComboRateCached as number);
          if (needReferenceAdvantageDamage) magic1AdvantageDamage = magic1Damage * (charaAny.m1AdvantageRateCached as number);
          if (needReferenceVsHiDamage) magic1vsHiDamage = magic1Damage * (charaAny.m1VsFireCached as number);
          if (needReferenceVsMizuDamage) magic1vsMizuDamage = magic1Damage * (charaAny.m1VsWaterCached as number);
          if (needReferenceVsKiDamage) magic1vsKiDamage = magic1Damage * (charaAny.m1VsWoodCached as number);
        }
        if (useM2) {
          const effectiveAtk = baseATK * (1 + atkBuddyRate + m2AtkDelta);
          const isDuoPow = useDuoPow;
          const baseRate = isDuoPow ? (charaAny.m2DuoBaseRateCached as number) : (charaAny.m2BaseRateCached as number);
          const comboRate = isDuoPow ? (charaAny.m2DuoComboRateCached as number) : (charaAny.m2ComboRateCached as number);
          const atkRate = baseRate + m2DmgDelta;
          magic2Damage = effectiveAtk * atkRate * comboRate;
          if (needReferenceAdvantageDamage) magic2AdvantageDamage = magic2Damage * (charaAny.m2AdvantageRateCached as number);
          if (needReferenceVsHiDamage) magic2vsHiDamage = magic2Damage * (charaAny.m2VsFireCached as number);
          if (needReferenceVsMizuDamage) magic2vsMizuDamage = magic2Damage * (charaAny.m2VsWaterCached as number);
          if (needReferenceVsKiDamage) magic2vsKiDamage = magic2Damage * (charaAny.m2VsWoodCached as number);
        }
        if (useM3) {
          const effectiveAtk = baseATK * (1 + atkBuddyRate + m3AtkDelta);
          const atkRate = (charaAny.m3BaseRateCached as number) + m3DmgDelta;
          magic3Damage = effectiveAtk * atkRate * (charaAny.m3ComboRateCached as number);
          if (needReferenceAdvantageDamage) magic3AdvantageDamage = magic3Damage * (charaAny.m3AdvantageRateCached as number);
          if (needReferenceVsHiDamage) magic3vsHiDamage = magic3Damage * (charaAny.m3VsFireCached as number);
          if (needReferenceVsMizuDamage) magic3vsMizuDamage = magic3Damage * (charaAny.m3VsWaterCached as number);
          if (needReferenceVsKiDamage) magic3vsKiDamage = magic3Damage * (charaAny.m3VsWoodCached as number);
        }
      }
      if (needReferenceDamage) {
          fillTopTwoDamage(magic1Damage, magic2Damage, magic3Damage, topTwoScratch!);
          const damageTop1 = topTwoScratch![0];
          const damageTop2 = topTwoScratch![1];
          if (useFullSum) {
            deckReferenceDamage += damageTop1 + damageTop2;
          } else if (useTopNStreamingFastPath) {
            refDamageTotal += damageTop1 + damageTop2;
            if (damageTop1 < refDamageMin1) {
              refDamageMin2 = refDamageMin1;
              refDamageMin1 = damageTop1;
            } else if (damageTop1 < refDamageMin2) {
              refDamageMin2 = damageTop1;
            }
            if (damageTop2 < refDamageMin1) {
              refDamageMin2 = refDamageMin1;
              refDamageMin1 = damageTop2;
            } else if (damageTop2 < refDamageMin2) {
              refDamageMin2 = damageTop2;
            }
          } else {
            deckReferenceDamageList!.push(damageTop1, damageTop2);
          }
          if (includeDetails) {
            damageList!.push(damageTop1 + damageTop2);
          }
        }

      if (needReferenceAdvantageDamage) {
          fillTopTwoDamage(magic1AdvantageDamage, magic2AdvantageDamage, magic3AdvantageDamage, topTwoScratch!);
          const advantageTop1 = topTwoScratch![0];
          const advantageTop2 = topTwoScratch![1];
          if (useFullSum) {
            deckReferenceAdvantageDamage += advantageTop1 + advantageTop2;
          } else if (useTopNStreamingFastPath) {
            refAdvTotal += advantageTop1 + advantageTop2;
            if (advantageTop1 < refAdvMin1) {
              refAdvMin2 = refAdvMin1;
              refAdvMin1 = advantageTop1;
            } else if (advantageTop1 < refAdvMin2) {
              refAdvMin2 = advantageTop1;
            }
            if (advantageTop2 < refAdvMin1) {
              refAdvMin2 = refAdvMin1;
              refAdvMin1 = advantageTop2;
            } else if (advantageTop2 < refAdvMin2) {
              refAdvMin2 = advantageTop2;
            }
          } else {
            deckReferenceAdvantageDamageList!.push(advantageTop1, advantageTop2);
          }
          if (includeDetails) {
            advantageDamageList!.push(advantageTop1 + advantageTop2);
          }
        }

      if (needReferenceVsHiDamage) {
          fillTopTwoDamage(magic1vsHiDamage, magic2vsHiDamage, magic3vsHiDamage, topTwoScratch!);
          const hiTop1 = topTwoScratch![0];
          const hiTop2 = topTwoScratch![1];
          if (useFullSum) {
            deckReferenceVsHiDamage += hiTop1 + hiTop2;
          } else if (useTopNStreamingFastPath) {
            refHiTotal += hiTop1 + hiTop2;
            if (hiTop1 < refHiMin1) {
              refHiMin2 = refHiMin1;
              refHiMin1 = hiTop1;
            } else if (hiTop1 < refHiMin2) {
              refHiMin2 = hiTop1;
            }
            if (hiTop2 < refHiMin1) {
              refHiMin2 = refHiMin1;
              refHiMin1 = hiTop2;
            } else if (hiTop2 < refHiMin2) {
              refHiMin2 = hiTop2;
            }
          } else {
            deckReferenceVsHiDamageList!.push(hiTop1, hiTop2);
          }
          if (includeDetails) {
            hiDamageList!.push(hiTop1 + hiTop2);
          }
        }

      if (needReferenceVsMizuDamage) {
          fillTopTwoDamage(magic1vsMizuDamage, magic2vsMizuDamage, magic3vsMizuDamage, topTwoScratch!);
          const mizuTop1 = topTwoScratch![0];
          const mizuTop2 = topTwoScratch![1];
          if (useFullSum) {
            deckReferenceVsMizuDamage += mizuTop1 + mizuTop2;
          } else if (useTopNStreamingFastPath) {
            refMizuTotal += mizuTop1 + mizuTop2;
            if (mizuTop1 < refMizuMin1) {
              refMizuMin2 = refMizuMin1;
              refMizuMin1 = mizuTop1;
            } else if (mizuTop1 < refMizuMin2) {
              refMizuMin2 = mizuTop1;
            }
            if (mizuTop2 < refMizuMin1) {
              refMizuMin2 = refMizuMin1;
              refMizuMin1 = mizuTop2;
            } else if (mizuTop2 < refMizuMin2) {
              refMizuMin2 = mizuTop2;
            }
          } else {
            deckReferenceVsMizuDamageList!.push(mizuTop1, mizuTop2);
          }
          if (includeDetails) {
            mizuDamageList!.push(mizuTop1 + mizuTop2);
          }
        }

      if (needReferenceVsKiDamage) {
          fillTopTwoDamage(magic1vsKiDamage, magic2vsKiDamage, magic3vsKiDamage, topTwoScratch!);
          const kiTop1 = topTwoScratch![0];
          const kiTop2 = topTwoScratch![1];
          if (useFullSum) {
            deckReferenceVsKiDamage += kiTop1 + kiTop2;
          } else if (useTopNStreamingFastPath) {
            refKiTotal += kiTop1 + kiTop2;
            if (kiTop1 < refKiMin1) {
              refKiMin2 = refKiMin1;
              refKiMin1 = kiTop1;
            } else if (kiTop1 < refKiMin2) {
              refKiMin2 = kiTop1;
            }
            if (kiTop2 < refKiMin1) {
              refKiMin2 = refKiMin1;
              refKiMin1 = kiTop2;
            } else if (kiTop2 < refKiMin2) {
              refKiMin2 = kiTop2;
            }
          } else {
            deckReferenceVsKiDamageList!.push(kiTop1, kiTop2);
          }
          if (includeDetails) {
            kiDamageList!.push(kiTop1 + kiTop2);
          }
      }
    }
  }

  if (needAnyDamageMetric && !useFullSum) {
    if (useTopNStreamingFastPath) {
      // 10打点のうち不要分（最小1件または2件）だけを引いて上位和を再構成する。
      // attackNum=10: 全加算
      // attackNum=9 : 最小1件を除外
      // attackNum=8 : 最小2件を除外
      if (attackNumValue >= 10) {
        if (needReferenceDamage) deckReferenceDamage = refDamageTotal;
        if (needReferenceAdvantageDamage) deckReferenceAdvantageDamage = refAdvTotal;
        if (needReferenceVsHiDamage) deckReferenceVsHiDamage = refHiTotal;
        if (needReferenceVsMizuDamage) deckReferenceVsMizuDamage = refMizuTotal;
        if (needReferenceVsKiDamage) deckReferenceVsKiDamage = refKiTotal;
      } else if (attackNumValue === 9) {
        if (needReferenceDamage) deckReferenceDamage = refDamageTotal - refDamageMin1;
        if (needReferenceAdvantageDamage) deckReferenceAdvantageDamage = refAdvTotal - refAdvMin1;
        if (needReferenceVsHiDamage) deckReferenceVsHiDamage = refHiTotal - refHiMin1;
        if (needReferenceVsMizuDamage) deckReferenceVsMizuDamage = refMizuTotal - refMizuMin1;
        if (needReferenceVsKiDamage) deckReferenceVsKiDamage = refKiTotal - refKiMin1;
      } else {
        if (needReferenceDamage) deckReferenceDamage = refDamageTotal - refDamageMin1 - refDamageMin2;
        if (needReferenceAdvantageDamage) deckReferenceAdvantageDamage = refAdvTotal - refAdvMin1 - refAdvMin2;
        if (needReferenceVsHiDamage) deckReferenceVsHiDamage = refHiTotal - refHiMin1 - refHiMin2;
        if (needReferenceVsMizuDamage) deckReferenceVsMizuDamage = refMizuTotal - refMizuMin1 - refMizuMin2;
        if (needReferenceVsKiDamage) deckReferenceVsKiDamage = refKiTotal - refKiMin1 - refKiMin2;
      }
    } else {
      if (needReferenceDamage) deckReferenceDamage = sumTopNByInsertion(deckReferenceDamageList!, attackNumValue);
      if (needReferenceAdvantageDamage) deckReferenceAdvantageDamage = sumTopNByInsertion(deckReferenceAdvantageDamageList!, attackNumValue);
      if (needReferenceVsHiDamage) deckReferenceVsHiDamage = sumTopNByInsertion(deckReferenceVsHiDamageList!, attackNumValue);
      if (needReferenceVsMizuDamage) deckReferenceVsMizuDamage = sumTopNByInsertion(deckReferenceVsMizuDamageList!, attackNumValue);
      if (needReferenceVsKiDamage) deckReferenceVsKiDamage = sumTopNByInsertion(deckReferenceVsKiDamageList!, attackNumValue);
    }
  }

  if (!needIncreasedHPBuddy) {
    deckMinIncreasedHPBuddy = 0;
  }
  const deckEHP = skipHpMetrics ? 0 : deckTotalHP + deckTotalHeal;
  if (deckTotalHP < snapshot.minHP) { return; }
  if (deckEHP < snapshot.minEHP) { return; }
  if (deckTotalHPBuddy < snapshot.minHPBuddy) { return; }
  if (deckMinIncreasedHPBuddy < snapshot.minIncreasedHPBuddy) { return; }
  if (deckTotalEvasion < snapshot.minEvasion) { return; }
  if (deckDuo < snapshot.minDuo) { return; }
  if (deckTotalBuff < snapshot.minBuff) { return; }
  if (deckTotalDebuff < snapshot.minDebuff) { return; }
  if (deckCosmic < snapshot.minCosmic) { return; }
  if (deckFire < snapshot.minFire) { return; }
  if (deckWater < snapshot.minWater) { return; }
  if (deckFlora < snapshot.minFlora) { return; }
  if (deckHealCards < snapshot.minHealNum) { return; }
  if (deckReferenceDamage < snapshot.minReferenceDamage) { return; }
  if (deckReferenceAdvantageDamage < snapshot.minReferenceAdvantageDamage) { return; }
  if (deckReferenceVsHiDamage < snapshot.minReferenceVsHiDamage) { return; }
  if (deckReferenceVsMizuDamage < snapshot.minReferenceVsMizuDamage) { return; }
  if (deckReferenceVsKiDamage < snapshot.minReferenceVsKiDamage) { return; }
  deckReferenceDamage = Math.floor(deckReferenceDamage);
  deckReferenceAdvantageDamage = Math.floor(deckReferenceAdvantageDamage);
  deckReferenceVsHiDamage = Math.floor(deckReferenceVsHiDamage);
  deckReferenceVsMizuDamage = Math.floor(deckReferenceVsMizuDamage);
  deckReferenceVsKiDamage = Math.floor(deckReferenceVsKiDamage);
  deckMinIncreasedHPBuddy = Math.floor(deckMinIncreasedHPBuddy);
  if (includeDetails) {
    detailList!.push(healList);
    detailList!.push(damageList);
    detailList!.push(advantageDamageList);
    detailList!.push(hiDamageList);
    detailList!.push(mizuDamageList);
    detailList!.push(kiDamageList);
  }
  if (!includeDeckMeta) {
    if (!includeDetails) {
      noMetaResultScratch[0] = deckTotalHP;
      noMetaResultScratch[1] = deckEHP;
      noMetaResultScratch[2] = deckTotalEvasion;
      noMetaResultScratch[3] = deckTotalHPBuddy;
      noMetaResultScratch[4] = deckMinIncreasedHPBuddy;
      noMetaResultScratch[5] = deckTotalBuddy;
      noMetaResultScratch[6] = deckNoHPBuddy;
      noMetaResultScratch[7] = deckDuo;
      noMetaResultScratch[8] = deckTotalBuff;
      noMetaResultScratch[9] = deckTotalDebuff;
      noMetaResultScratch[10] = deckCosmic;
      noMetaResultScratch[11] = deckFire;
      noMetaResultScratch[12] = deckWater;
      noMetaResultScratch[13] = deckFlora;
      noMetaResultScratch[14] = deckReferenceDamage;
      noMetaResultScratch[15] = deckReferenceAdvantageDamage;
      noMetaResultScratch[16] = deckReferenceVsHiDamage;
      noMetaResultScratch[17] = deckReferenceVsMizuDamage;
      noMetaResultScratch[18] = deckReferenceVsKiDamage;
      noMetaResultScratch[19] = deckHealCards;
      return noMetaResultScratch;
    }
    return [deckTotalHP
      , deckEHP
      , deckTotalEvasion
      , deckTotalHPBuddy
      , deckMinIncreasedHPBuddy
      , deckTotalBuddy
      , deckNoHPBuddy
      , deckDuo
      , deckTotalBuff
      , deckTotalDebuff
      , deckCosmic
      , deckFire
      , deckWater
      , deckFlora
      , deckReferenceDamage
      , deckReferenceAdvantageDamage
      , deckReferenceVsHiDamage
      , deckReferenceVsMizuDamage
      , deckReferenceVsKiDamage
      , deckHealCards
      , simuURL
      , detailList ?? emptyDetailList];
  }
  return [deckTotalHP
    , deckEHP
    , deckTotalEvasion
    , deckTotalHPBuddy
    , deckMinIncreasedHPBuddy
    , deckTotalBuddy
    , deckNoHPBuddy
    , deckDuo
    , deckTotalBuff
    , deckTotalDebuff
    , deckCosmic
    , deckFire
    , deckWater
    , deckFlora
    , deckReferenceDamage
    , deckReferenceAdvantageDamage
    , deckReferenceVsHiDamage
    , deckReferenceVsMizuDamage
    , deckReferenceVsKiDamage
    , deckHealCards
    , ...deckList!
    , simuURL
    , detailList ?? emptyDetailList];
}
interface SortCriterion {
  key: string;
  order: '昇順' | '降順'|'ASC' | 'DESC';
}
const sortKeyToRetIndex: Record<string, number> = {
  hp: 0,
  ehp: 1,
  evasion: 2,
  hpBuddy: 3,
  increasedHpBuddy: 4,
  buddy: 5,
  noHpBuddy: 6,
  duo: 7,
  buff: 8,
  debuff: 9,
  maxCosmic: 10,
  maxFire: 11,
  maxWater: 12,
  maxFlora: 13,
  referenceDamage: 14,
  referenceAdvantageDamage: 15,
  referenceVsHiDamage: 16,
  referenceVsMizuDamage: 17,
  referenceVsKiDamage: 18,
  healNum: 19,
};

const ATK_SORT_KEYS = new Set<string>([
  'referenceDamage',
  'referenceAdvantageDamage',
  'referenceVsHiDamage',
  'referenceVsMizuDamage',
  'referenceVsKiDamage',
]);

const DAMAGE_SORT_KEYS = new Set<string>([
  'referenceDamage',
  'referenceAdvantageDamage',
  'referenceVsHiDamage',
  'referenceVsMizuDamage',
  'referenceVsKiDamage',
]);

const AUX_SORT_KEYS = new Set<string>([
  'hpBuddy',
  'increasedHpBuddy',
  'buddy',
  'noHpBuddy',
  'evasion',
  'duo',
  'buff',
  'debuff',
  'maxCosmic',
  'maxFire',
  'maxWater',
  'maxFlora',
  'healNum',
]);

const DAMAGE_SORT_KEY_TO_MASK: Record<string, number> = {
  referenceDamage: DAMAGE_METRIC_REFERENCE,
  referenceAdvantageDamage: DAMAGE_METRIC_ADVANTAGE,
  referenceVsHiDamage: DAMAGE_METRIC_VS_HI,
  referenceVsMizuDamage: DAMAGE_METRIC_VS_MIZU,
  referenceVsKiDamage: DAMAGE_METRIC_VS_KI,
};

const DAMAGE_SORT_KEY_TO_UPPER_CACHE: Record<string, string> = {
  referenceDamage: 'referenceDamageUpperTop2Cached',
  referenceAdvantageDamage: 'referenceAdvantageDamageUpperTop2Cached',
  referenceVsHiDamage: 'referenceVsHiDamageUpperTop2Cached',
  referenceVsMizuDamage: 'referenceVsMizuDamageUpperTop2Cached',
  referenceVsKiDamage: 'referenceVsKiDamageUpperTop2Cached',
};

const AUX_SORT_KEY_TO_MASK: Record<string, number> = {
  hpBuddy: AUX_METRIC_HP_BUDDY,
  increasedHpBuddy: AUX_METRIC_INCREASED_HP_BUDDY,
  buddy: AUX_METRIC_BUDDY,
  noHpBuddy: AUX_METRIC_NO_HP_BUDDY,
  evasion: AUX_METRIC_EVASION,
  duo: AUX_METRIC_DUO,
  buff: AUX_METRIC_BUFF,
  debuff: AUX_METRIC_DEBUFF,
  maxCosmic: AUX_METRIC_COSMIC,
  maxFire: AUX_METRIC_FIRE,
  maxWater: AUX_METRIC_WATER,
  maxFlora: AUX_METRIC_FLORA,
  healNum: AUX_METRIC_HEAL_NUM,
};

// Opt-154: 小さな階乗はテーブル参照
const factorialTable = [1, 1, 2, 6, 24, 120];
function factorialize(num:number) :number {
  return factorialTable[num] ?? 1;
}

function combinationCount(n: number, k: number): number {
  if (k < 0 || n < k) return 0;
  if (k === 0) return 1;
  if (k === 1) return n;
  if (k === 2) return (n * (n - 1)) / 2;
  if (k === 3) return (n * (n - 1) * (n - 2)) / 6;
  if (k === 4) return (n * (n - 1) * (n - 2) * (n - 3)) / 24;
  if (k === 5) return (n * (n - 1) * (n - 2) * (n - 3) * (n - 4)) / 120;
  return 0;
}

function buildSuffixTopSums(scores: Float64Array, maxPick: number): Float64Array[] {
  const length = scores.length;
  const sums = Array.from({ length: maxPick + 1 }, () => new Float64Array(length + 1));
  const top = new Float64Array(maxPick);
  for (let i = 0; i < maxPick; i++) top[i] = -Infinity;
  for (let i = length - 1; i >= 0; i--) {
    const value = scores[i];
    for (let pos = 0; pos < maxPick; pos++) {
      if (value <= top[pos]) continue;
      for (let shift = maxPick - 1; shift > pos; shift--) {
        top[shift] = top[shift - 1];
      }
      top[pos] = value;
      break;
    }
    sums[0][i] = 0;
    let running = 0;
    for (let pick = 1; pick <= maxPick; pick++) {
      const topValue = top[pick - 1];
      if (topValue === -Infinity) {
        sums[pick][i] = -Infinity;
      } else {
        running += topValue;
        sums[pick][i] = running;
      }
    }
  }
  sums[0][length] = 0;
  for (let pick = 1; pick <= maxPick; pick++) {
    sums[pick][length] = -Infinity;
  }
  return sums;
}

function buildSuffixKthLargest(scores: Float64Array, maxPick: number): Float64Array[] {
  const length = scores.length;
  const kth = Array.from({ length: maxPick + 1 }, () => new Float64Array(length + 1));
  const top = new Float64Array(maxPick);
  for (let i = 0; i < maxPick; i++) top[i] = -Infinity;
  for (let i = length - 1; i >= 0; i--) {
    const value = scores[i];
    for (let pos = 0; pos < maxPick; pos++) {
      if (value <= top[pos]) continue;
      for (let shift = maxPick - 1; shift > pos; shift--) {
        top[shift] = top[shift - 1];
      }
      top[pos] = value;
      break;
    }
    kth[0][i] = Infinity;
    for (let pick = 1; pick <= maxPick; pick++) {
      kth[pick][i] = top[pick - 1];
    }
  }
  kth[0][length] = Infinity;
  for (let pick = 1; pick <= maxPick; pick++) {
    kth[pick][length] = -Infinity;
  }
  return kth;
}

type SearchWorkCharacterKind = 'normal' | 'support';
type SearchWorkCharacterEntry = {
  signature: string;
  character: Character;
};
const searchWorkCharacterCache = new WeakMap<any, Partial<Record<SearchWorkCharacterKind, SearchWorkCharacterEntry>>>();

type NoSameDamagePrimarySetupCache = {
  key: string;
  fastIds: Int16Array;
  fastBuddy1Ids: Int16Array;
  fastBuddy2Ids: Int16Array;
  fastBuddy3Ids: Int16Array;
  fastHpTables: Float64Array[];
  fastHealTables: Float64Array[];
  fastDuoIds: Int16Array;
  fastUseM2: Uint8Array;
  fastDuoBaseOffsets: Uint8Array;
  fastPairBuddyMasks: Uint8Array;
  fastDamageReachableMasks: Uint8Array;
  fastDamageReachableScoreByBits: Float64Array;
  fastDamageDuoTargetSuffixNext: Int16Array;
  fastDamageOnePickReachableUpper: Float64Array;
};
let noSameDamagePrimarySetupCache: NoSameDamagePrimarySetupCache | null = null;

function buildSearchWorkCharacterSignature(chara: Character): string {
  const charaAny = chara as any;
  return [
    chara.name,
    chara.imgUrl,
    chara.chara,
    chara.duo,
    chara.rare,
    charaAny.totsu,
    charaAny.hasM1,
    charaAny.hasM2,
    charaAny.hasM3,
    chara.base_hp,
    chara.base_atk,
    chara.hp,
    chara.atk,
    chara.evasion,
    chara.magic1pow,
    chara.magic2pow,
    chara.magic3pow,
    chara.magic1atr,
    chara.magic2atr,
    chara.magic3atr,
    chara.magic1heal,
    chara.magic2heal,
    chara.magic3heal,
    chara.buddy1c,
    chara.buddy2c,
    chara.buddy3c,
    charaAny.buddy1s,
    charaAny.buddy2s,
    charaAny.buddy3s,
    charaAny.buddy1s_totsu,
    charaAny.buddy2s_totsu,
    charaAny.buddy3s_totsu,
    charaAny.etc,
  ].join('\u0001');
}

function getSearchWorkCharacter(
  source: Character,
  kind: SearchWorkCharacterKind,
  level: number,
  calcBaseHP: number,
  calcBaseATK: number,
): Character {
  const signature = buildSearchWorkCharacterSignature(source);
  let cache = searchWorkCharacterCache.get(source as any);
  if (cache === undefined) {
    cache = {};
    searchWorkCharacterCache.set(source as any, cache);
  }
  let entry = cache[kind];
  let chara: Character;
  if (entry === undefined || entry.signature !== signature) {
    chara = {
      ...source,
      _searchSource: source,
      level,
      calcBaseHP,
      calcBaseATK,
    } as Character;
    entry = { signature, character: chara };
    cache[kind] = entry;
  } else {
    chara = entry.character;
    const charaAny = chara as any;
    chara.required = source.required;
    chara.level = level;
    charaAny.hasM1 = (source as any).hasM1;
    charaAny.hasM2 = (source as any).hasM2;
    charaAny.hasM3 = (source as any).hasM3;
    charaAny.totsu = (source as any).totsu;
    chara.calcBaseHP = calcBaseHP;
    chara.calcBaseATK = calcBaseATK;
  }

  const charaAny = chara as any;
  if (
    charaAny._preparedCalcBaseHP !== calcBaseHP ||
    charaAny._preparedCalcBaseATK !== calcBaseATK ||
    charaAny._preparedSignature !== signature ||
    !(charaAny.primaryDamageTop2MinByMaskCached instanceof Float64Array)
  ) {
    prepareCharacterSearchCache(chara);
    charaAny._preparedCalcBaseHP = calcBaseHP;
    charaAny._preparedCalcBaseATK = calcBaseATK;
    charaAny._preparedSignature = signature;
  }
  return chara;
}

function prepareCharacterSearchCache(chara: Character): void {
  const charaAny = chara as any;
  presenceAwareDamageUpperCache.delete(chara as any);
  if (charaAny.charaId === undefined) {
    charaAny.charaId = getCharaId(chara.chara);
  }
  if (charaAny.duoId === undefined) {
    charaAny.duoId = chara.duo ? getCharaId(chara.duo) : -1;
  }
  const charaBit = getBitPairById(charaAny.charaId as number);
  const duoBit = getBitPairById(charaAny.duoId as number);
  charaAny.charaBitLowCached = charaBit.low;
  charaAny.charaBitHighCached = charaBit.high;
  charaAny.duoBitLowCached = duoBit.low;
  charaAny.duoBitHighCached = duoBit.high;
  const useM1 = charaAny.hasM1 ?? true;
  const useM2 = charaAny.hasM2 ?? true;
  const totsuCount = Number.isFinite(Number(charaAny.totsu))
    ? Number(charaAny.totsu)
    : ((charaAny.hasM3 ?? (chara.rare === 'SSR')) ? 3 : 0);
  // M3は「解放されていること」と「UIで使用可になっていること」の両方を満たす時だけ使う。
  // これにより、3凸以上でも hasM3=false のカードは探索でM3を使わない。
  const useM3 = isM3Unlocked(chara.rare, totsuCount) && (charaAny.hasM3 ?? true);
  charaAny.useM1Cached = useM1;
  charaAny.useM2Cached = useM2;
  charaAny.useM3Cached = useM3;
  charaAny.totsuCached = totsuCount;

  const healRates = getMagicHealRates(chara);
  const magic1Rates = useM1 ? healRates.m1 : emptyHealRates;
  const magic2Rates = useM2 ? healRates.m2 : emptyHealRates;
  const magic3Rates = useM3 ? healRates.m3 : emptyHealRates;
  const hpHeal = (magic1Rates.heal + magic2Rates.heal + magic3Rates.heal) * chara.calcBaseATK;
  const hpConHeal = calculateContinuousHealFromTotalRate(magic1Rates.conHeal, chara.calcBaseHP)
    + calculateContinuousHealFromTotalRate(magic2Rates.conHeal, chara.calcBaseHP)
    + calculateContinuousHealFromTotalRate(magic3Rates.conHeal, chara.calcBaseHP);
  charaAny.totalHealCached = hpHeal + hpConHeal;
  charaAny.healCardCountCached =
    (useM1 && isHealCard(chara.magic1heal) ? 1 : 0) +
    (useM2 && isHealCard(chara.magic2heal) ? 1 : 0) +
    (useM3 && isHealCard(chara.magic3heal) ? 1 : 0);

  const buddy1Rates = getCachedBuddyStatusSummary(getBuddyStatusForCharacter(chara, 1, { totsu: totsuCount, isActive: true }));
  const buddy2Rates = getCachedBuddyStatusSummary(getBuddyStatusForCharacter(chara, 2, { totsu: totsuCount, isActive: true }));
  const buddy3Rates = getCachedBuddyStatusSummary(getBuddyStatusForCharacter(chara, 3, { totsu: totsuCount, isActive: true }));
  charaAny.buddy1IdCached = chara.buddy1c ? getCharaId(chara.buddy1c) : -1;
  charaAny.buddy2IdCached = chara.buddy2c ? getCharaId(chara.buddy2c) : -1;
  charaAny.buddy3IdCached = chara.buddy3c ? getCharaId(chara.buddy3c) : -1;
  const buddy1Bit = getBitPairById(charaAny.buddy1IdCached as number);
  const buddy2Bit = getBitPairById(charaAny.buddy2IdCached as number);
  const buddy3Bit = getBitPairById(charaAny.buddy3IdCached as number);
  charaAny.buddy1BitLowCached = buddy1Bit.low;
  charaAny.buddy1BitHighCached = buddy1Bit.high;
  charaAny.buddy2BitLowCached = buddy2Bit.low;
  charaAny.buddy2BitHighCached = buddy2Bit.high;
  charaAny.buddy3BitLowCached = buddy3Bit.low;
  charaAny.buddy3BitHighCached = buddy3Bit.high;
  charaAny.buddy1HpRateCached = buddy1Rates.hpRate;
  charaAny.buddy2HpRateCached = buddy2Rates.hpRate;
  charaAny.buddy3HpRateCached = buddy3Rates.hpRate;
  const baseHP = chara.calcBaseHP;
  charaAny.buddy1HpIncreaseCached = baseHP * buddy1Rates.hpRate;
  charaAny.buddy2HpIncreaseCached = baseHP * buddy2Rates.hpRate;
  charaAny.buddy3HpIncreaseCached = baseHP * buddy3Rates.hpRate;
  charaAny.buddy1AtkRateCached = buddy1Rates.atkRate;
  charaAny.buddy2AtkRateCached = buddy2Rates.atkRate;
  charaAny.buddy3AtkRateCached = buddy3Rates.atkRate;
  charaAny.buddy1DamageRateCached = buddy1Rates.damageRate;
  charaAny.buddy2DamageRateCached = buddy2Rates.damageRate;
  charaAny.buddy3DamageRateCached = buddy3Rates.damageRate;
  charaAny.buddy1CriticalCached = buddy1Rates.criticalMultiplier;
  charaAny.buddy2CriticalCached = buddy2Rates.criticalMultiplier;
  charaAny.buddy3CriticalCached = buddy3Rates.criticalMultiplier;
  charaAny.buddy1ContinueHealCached = buddy1Rates.continueHealRate > 0
    ? calculateLegacyBuddyContinueHealAmount(baseHP, 10)
    : 0;
  charaAny.buddy2ContinueHealCached = buddy2Rates.continueHealRate > 0
    ? calculateLegacyBuddyContinueHealAmount(baseHP, 10)
    : 0;
  charaAny.buddy3ContinueHealCached = buddy3Rates.continueHealRate > 0
    ? calculateLegacyBuddyContinueHealAmount(baseHP, 10)
    : 0;
  charaAny.buddy1FireDamageRateCached = buddy1Rates.attributeDamageRates['火'] || 0;
  charaAny.buddy1WaterDamageRateCached = buddy1Rates.attributeDamageRates['水'] || 0;
  charaAny.buddy1WoodDamageRateCached = buddy1Rates.attributeDamageRates['木'] || 0;
  charaAny.buddy1CosmicDamageRateCached = buddy1Rates.attributeDamageRates['無'] || 0;
  charaAny.buddy2FireDamageRateCached = buddy2Rates.attributeDamageRates['火'] || 0;
  charaAny.buddy2WaterDamageRateCached = buddy2Rates.attributeDamageRates['水'] || 0;
  charaAny.buddy2WoodDamageRateCached = buddy2Rates.attributeDamageRates['木'] || 0;
  charaAny.buddy2CosmicDamageRateCached = buddy2Rates.attributeDamageRates['無'] || 0;
  charaAny.buddy3FireDamageRateCached = buddy3Rates.attributeDamageRates['火'] || 0;
  charaAny.buddy3WaterDamageRateCached = buddy3Rates.attributeDamageRates['水'] || 0;
  charaAny.buddy3WoodDamageRateCached = buddy3Rates.attributeDamageRates['木'] || 0;
  charaAny.buddy3CosmicDamageRateCached = buddy3Rates.attributeDamageRates['無'] || 0;

  const { buffByMagic, debuffByMagic } = getBuffDebuffCountsByMagic(chara);
  charaAny.totalBuffCached =
    (useM1 ? buffByMagic[1] : 0) +
    (useM2 ? buffByMagic[2] : 0) +
    (useM3 ? buffByMagic[3] : 0);
  charaAny.totalDebuffCached =
    (useM1 ? debuffByMagic[1] : 0) +
    (useM2 ? debuffByMagic[2] : 0) +
    (useM3 ? debuffByMagic[3] : 0);
  let cosmic = 0;
  let fire = 0;
  let water = 0;
  let flora = 0;
  if (useM1) {
    switch (chara.magic1atr) {
      case '無': cosmic += 1; break;
      case '火': fire += 1; break;
      case '水': water += 1; break;
      case '木': flora += 1; break;
    }
  }
  if (useM2) {
    switch (chara.magic2atr) {
      case '無': cosmic += 1; break;
      case '火': fire += 1; break;
      case '水': water += 1; break;
      case '木': flora += 1; break;
    }
  }
  if (useM3) {
    switch (chara.magic3atr) {
      case '無': cosmic += 1; break;
      case '火': fire += 1; break;
      case '水': water += 1; break;
      case '木': flora += 1; break;
    }
  }
  if (cosmic > 2) cosmic = 2;
  if (fire > 2) fire = 2;
  if (water > 2) water = 2;
  if (flora > 2) flora = 2;
  charaAny.magicCosmicCountCached = cosmic;
  charaAny.magicFireCountCached = fire;
  charaAny.magicWaterCountCached = water;
  charaAny.magicFloraCountCached = flora;

  // ダメージ計算メタ:
  // 探索中に毎回 `magicXpow` / `magicXatr` の文字列分岐を行うと重いため、
  // 係数化できる情報をここで数値に変換してキャッシュしておく。
  charaAny.m1BaseRateCached = getBaseRateFromPowAndAtr(chara.magic1pow, chara.magic1atr);
  charaAny.m2BaseRateCached = getBaseRateFromPowAndAtr(chara.magic2pow, chara.magic2atr);
  charaAny.m2DuoBaseRateCached = getBaseRateFromPowAndAtr('デュオ魔法', chara.magic2atr);
  charaAny.magic2IsDuoBaseCached = chara.magic2pow === 'デュオ魔法';
  charaAny.m3BaseRateCached = getBaseRateFromPowAndAtr(chara.magic3pow, chara.magic3atr);
  charaAny.m1ComboRateCached = getComboRateFromPow(chara.magic1pow);
  charaAny.m2ComboRateCached = getComboRateFromPow(chara.magic2pow);
  charaAny.m2DuoComboRateCached = getComboRateFromPow('デュオ魔法');
  charaAny.m3ComboRateCached = getComboRateFromPow(chara.magic3pow);
  charaAny.m1AdvantageRateCached = chara.magic1atr === '無' ? 1 : 1.5;
  charaAny.m2AdvantageRateCached = chara.magic2atr === '無' ? 1 : 1.5;
  charaAny.m3AdvantageRateCached = chara.magic3atr === '無' ? 1 : 1.5;
  const m1Vs = getVsRatesFromAtr(chara.magic1atr);
  const m2Vs = getVsRatesFromAtr(chara.magic2atr);
  const m3Vs = getVsRatesFromAtr(chara.magic3atr);
  charaAny.m1VsFireCached = m1Vs.fire;
  charaAny.m1VsWaterCached = m1Vs.water;
  charaAny.m1VsWoodCached = m1Vs.wood;
  charaAny.m2VsFireCached = m2Vs.fire;
  charaAny.m2VsWaterCached = m2Vs.water;
  charaAny.m2VsWoodCached = m2Vs.wood;
  charaAny.m3VsFireCached = m3Vs.fire;
  charaAny.m3VsWaterCached = m3Vs.water;
  charaAny.m3VsWoodCached = m3Vs.wood;

  const totalsAllowM3 = getMagicBuffTotalsAll(chara, true);
  const totalsNoM3 = getMagicBuffTotalsAll(chara, false);
  charaAny.magicBuffTotalsAllowM3Cached = totalsAllowM3;
  charaAny.magicBuffTotalsNoM3Cached = totalsNoM3;
  charaAny.magicBuffTotalsCached = useM3 ? totalsAllowM3 : totalsNoM3;

  // ダメージ式を次の形に事前変換する:
  //   damage = base + buddyRate * coeff
  // これにより calcDeckStatus 側では「加算 + 乗算1回」中心になり、
  // 同じ結果を保ったまま CPU コストを抑えられる。
  const totals = charaAny.magicBuffTotalsCached as Array<{ atkDelta: number; dmgDelta: number }> | undefined;
  const m1Totals = totals?.[1] ?? zeroMagicTotals;
  const m2Totals = totals?.[2] ?? zeroMagicTotals;
  const m3Totals = totals?.[3] ?? zeroMagicTotals;
  const baseATK = chara.calcBaseATK;

  const m1Rate = (charaAny.m1BaseRateCached as number) + m1Totals.dmgDelta;
  const m1Common = baseATK * m1Rate * (charaAny.m1ComboRateCached as number);
  charaAny.m1DamageBuddyCoeffCached = m1Common;
  charaAny.m1DamageBaseCached = m1Common * (1 + m1Totals.atkDelta);

  const m2Rate = (charaAny.m2BaseRateCached as number) + m2Totals.dmgDelta;
  const m2Common = baseATK * m2Rate * (charaAny.m2ComboRateCached as number);
  charaAny.m2DamageBuddyCoeffCached = m2Common;
  charaAny.m2DamageBaseCached = m2Common * (1 + m2Totals.atkDelta);

  const m2DuoRate = (charaAny.m2DuoBaseRateCached as number) + m2Totals.dmgDelta;
  const m2DuoCommon = baseATK * m2DuoRate * (charaAny.m2DuoComboRateCached as number);
  charaAny.m2DuoDamageBuddyCoeffCached = m2DuoCommon;
  charaAny.m2DuoDamageBaseCached = m2DuoCommon * (1 + m2Totals.atkDelta);

  const m3Rate = (charaAny.m3BaseRateCached as number) + m3Totals.dmgDelta;
  const m3Common = baseATK * m3Rate * (charaAny.m3ComboRateCached as number);
  charaAny.m3DamageBuddyCoeffCached = m3Common;
  charaAny.m3DamageBaseCached = m3Common * (1 + m3Totals.atkDelta);

  const primaryDamageTop2ByMask = charaAny.primaryDamageTop2ByMaskCached instanceof Float64Array
    ? charaAny.primaryDamageTop2ByMaskCached as Float64Array
    : new Float64Array(80);
  const primaryDamageTop2MinByMask = charaAny.primaryDamageTop2MinByMaskCached instanceof Float64Array
    ? charaAny.primaryDamageTop2MinByMaskCached as Float64Array
    : new Float64Array(80);
  fillPrimaryDamageTop2ByMask(chara, charaAny, primaryDamageTop2ByMask, primaryDamageTop2MinByMask);
  charaAny.primaryDamageTop2ByMaskCached = primaryDamageTop2ByMask;
  charaAny.primaryDamageTop2MinByMaskCached = primaryDamageTop2MinByMask;
  const hpByBuddyMask = charaAny.hpByBuddyMaskCached instanceof Float64Array
    ? charaAny.hpByBuddyMaskCached as Float64Array
    : new Float64Array(8);
  const healByBuddyMask = charaAny.healByBuddyMaskCached instanceof Float64Array
    ? charaAny.healByBuddyMaskCached as Float64Array
    : new Float64Array(8);
  fillHpHealByBuddyMask(chara, charaAny, hpByBuddyMask, healByBuddyMask);
  charaAny.hpByBuddyMaskCached = hpByBuddyMask;
  charaAny.healByBuddyMaskCached = healByBuddyMask;
  const increasedHpByBuddyMask = charaAny.increasedHpByBuddyMaskCached instanceof Float64Array
    ? charaAny.increasedHpByBuddyMaskCached as Float64Array
    : new Float64Array(8);
  fillIncreasedHpByBuddyMask(charaAny, increasedHpByBuddyMask);
  charaAny.increasedHpByBuddyMaskCached = increasedHpByBuddyMask;
  charaAny.increasedHpBuddyUpperCached = increasedHpByBuddyMask[7];
  setDamageUpperCaches(chara, charaAny);
}

export async function calcDecks(
  t: (key: string) => string,
  context: DeckSearchContext
) {
  const debugTiming = typeof globalThis !== 'undefined'
    ? (globalThis as any).__TWST_LAST_SEARCH_TIMING__
    : undefined;
  const markTiming = (key: string) => {
    if (debugTiming && typeof performance !== 'undefined') {
      debugTiming[key] = performance.now();
    }
  };
  const markFastPath = (name: string) => {
    if (debugTiming) {
      debugTiming.fastPath = name;
    }
  };
  markFastPath('generic');
  const debugCounters = debugTiming && (globalThis as any).__TWST_COLLECT_DECK_SEARCH_COUNTERS__ === true
    ? (debugTiming.counters = {} as Record<string, number>)
    : undefined;
  const { characters: charactersValue, settings, controls } = context;
  const sourceCharacters = toRaw(charactersValue) as Character[];
  for (let i = 0; i < sourceCharacters.length; i++) {
    const chara = toRaw(sourceCharacters[i]) as Character;
    if (chara.required && chara.level == 0) {
      controls.setErrorMessage(t('error.requiredCharacter'));
      return
    }
  }
  const selectedSupportCharacterSet = settings.allowSameCharacter
    ? new Set(settings.selectedSupportCharacters)
    : null;
  const nonZeroLevelCharacters: Character[] = [];
  const maxLevelCharacters: Character[] = [];
  for (let i = 0; i < sourceCharacters.length; i++) {
    const chara = toRaw(sourceCharacters[i]) as Character;
    let maxCardLevel = 120;  // Default max level for SSR
    if (chara.rare == 'SR') {
      maxCardLevel = 90;     // Max level for SR
    } else if (chara.rare == 'R') {
      maxCardLevel = 70;     // Max level for R
    }
    if (chara.level > 0) {
      const bonusHP = chara.base_hp * 0.2;
      const bonusATK = chara.base_atk * 0.2;
      const HPperLv = (chara.hp - 2 * bonusHP - chara.base_hp) / (maxCardLevel - 1);
      const ATKperLv = (chara.atk - 2 * bonusATK - chara.base_atk) / (maxCardLevel - 1);
      const leveldiff = maxCardLevel - chara.level;
      nonZeroLevelCharacters.push(getSearchWorkCharacter(
        chara,
        'normal',
        chara.level,
        chara.hp - HPperLv * leveldiff,
        chara.atk - ATKperLv * leveldiff,
      ));
    }
    if (selectedSupportCharacterSet !== null && chara.rare == 'SSR' && selectedSupportCharacterSet.has(chara.name)) {
      maxLevelCharacters.push(getSearchWorkCharacter(
        chara,
        'support',
        120,
        chara.hp,
        chara.atk,
      ));
    }
  }
  // Opt-132: 配列参照をローカル化
  const nonZero = nonZeroLevelCharacters;
  const maxLevel = maxLevelCharacters;
  markTiming('afterCharacterPrepMs');

  const listLength = nonZero.length;
  if (listLength < 5) {
    controls.setErrorMessage(t('error.fewCharacter'));
    return;
  }
  const snapshot = buildSearchSnapshot(settings);
  controls.setNowResults(0);
  // Opt-242: 進捗更新を間引いてリアクティブ更新コストを削減
  // Opt-243: nowResults は描画更新/終了時のみ反映
  let nowResultsCount = 0;
  const nowMs = (): number =>
    typeof performance !== 'undefined' ? performance.now() : Date.now();
  const waitForBrowserPaint = (): Promise<void> =>
    new Promise((resolve) => {
      let done = false;
      let fallbackId: ReturnType<typeof setTimeout> | undefined;
      const finish = () => {
        if (done) return;
        done = true;
        if (fallbackId !== undefined) clearTimeout(fallbackId);
        resolve();
      };
      fallbackId = setTimeout(finish, SEARCH_PAINT_FALLBACK_MS);
      if (typeof requestAnimationFrame === 'function') {
        requestAnimationFrame(() => {
          setTimeout(finish, 0);
        });
      } else {
        setTimeout(finish, 0);
      }
    });
  let appendIntermediateResultsOnYield = false;
  let lastYieldIntermediateRenderMs = nowMs();
  let lastYieldIntermediateResultsCount = 0;
  async function maybeAppendIntermediateResultOnYield(): Promise<boolean> {
    if (
      !appendIntermediateResultsOnYield ||
      !APPEND_INTERMEDIATE_RESULTS ||
      typeof document === 'undefined'
    ) {
      return false;
    }
    const currentMs = nowMs();
    if (currentMs - lastYieldIntermediateRenderMs <= RENDER_UPDATE_INTERVAL_MS) {
      return false;
    }
    if (
      APPEND_MIN_RESULT_DELTA !== 0 &&
      nowResultsCount - lastYieldIntermediateResultsCount < APPEND_MIN_RESULT_DELTA
    ) {
      return false;
    }
    lastYieldIntermediateRenderMs = currentMs;
    lastYieldIntermediateResultsCount = nowResultsCount;
    await appendResult();
    return true;
  }
  async function runWithYieldIntermediateResults<T>(callback: () => Promise<T>): Promise<T> {
    const previous = appendIntermediateResultsOnYield;
    appendIntermediateResultsOnYield = true;
    try {
      return await callback();
    } finally {
      appendIntermediateResultsOnYield = previous;
    }
  }
  let nextSearchUiYieldMs = nowMs() + SEARCH_UI_YIELD_INTERVAL_MS;
  const yieldToSearchUi = async (): Promise<boolean> => {
    if (!controls.isSearching()) {
      controls.setNowResults(nowResultsCount);
      return false;
    }
    const currentMs = nowMs();
    if (currentMs < nextSearchUiYieldMs) return true;
    if (await maybeAppendIntermediateResultOnYield()) {
      nextSearchUiYieldMs = nowMs() + SEARCH_UI_YIELD_INTERVAL_MS;
      return controls.isSearching();
    }
    controls.setNowResults(nowResultsCount);
    await waitForBrowserPaint();
    nextSearchUiYieldMs = nowMs() + SEARCH_UI_YIELD_INTERVAL_MS;
    return controls.isSearching();
  };
  const availableSortProps = getAvailableSortProps(t);
  // Opt-101: ソート項目のインデックスを辞書化
  const sortPropIndexMap: Record<string, number> = Object.create(null);
  for (let i = 0; i < availableSortProps.length; i++) {
    sortPropIndexMap[availableSortProps[i]] = i;
  }
  // Opt-102: sortOptions の参照をローカル化
  const sortOptionsValue = settings.sortOptions;
  const sortCriteria: SortCriterion[] = [];
  for (let i = 0; i < sortOptionsValue.length; i++) {
    const key = sortOptionsValue[i];
    const idx = sortPropIndexMap[key.prop];
    if (idx === undefined) continue;
    let order = '降順';
    switch (key.order) {
      case 'ASC':
        order = '昇順';
        break;
      case 'DESC':
        order = '降順';
        break;
      case '昇順':
      case '降順':
        order = key.order;
        break;
      default:
        continue; // 不明な順序値は無視
    }
    sortCriteria.push({key: availableSortkeys[idx] as string, order: order as '昇順' | '降順'});
  }

  // sortCriteriaが空の場合はエラーを表示して終了
  if (sortCriteria.length === 0) {
    controls.setErrorMessage(t('search.noSettingOptions'));
    return;
  }
  
  async function appendResult(){
    // 中間描画では上位N件のみを更新する。
    // 全候補を配列化してから描画すると、探索より描画の方がボトルネックになりやすい。
    // 効率的な結果管理：既にソート済みの上位N件を取得
    const topDecks = metricPrimaryFastEntries ? getMetricPrimaryTopDecks() : resultsManager.getTopDecks();
    finalizeTopDecksForRender(topDecks);
    const displayDecks = buildDisplayDecks(topDecks);
    sortTopDecksForDisplay(displayDecks);
    controls.setResults(displayDecks);
    controls.setNowResults(nowResultsCount);
    await waitForBrowserPaint();
  }
  const firstSortKey = sortCriteria[0].key;
  const firstSortDesc = sortCriteria[0].order === '降順';
  const fastPathDisabled = (globalThis as any).__TWST_DISABLE_DECK_SEARCH_FAST_PATH__ === true;
  const primaryUpperSortCacheKey = !fastPathDisabled && firstSortDesc
    ? DAMAGE_SORT_KEY_TO_UPPER_CACHE[firstSortKey]
    : undefined;
  const duoSecondaryUpperSortCacheKey = !fastPathDisabled &&
    !settings.allowSameCharacter &&
    firstSortDesc &&
    firstSortKey === 'duo' &&
    sortCriteria.length >= 2 &&
    sortCriteria[1].order === '降順'
    ? DAMAGE_SORT_KEY_TO_UPPER_CACHE[sortCriteria[1].key]
    : undefined;
  const isSortedByPrimaryUpper = primaryUpperSortCacheKey !== undefined;
  for (let i = 0; i < nonZero.length; i++) {
    (nonZero[i] as any)._legacyDeckSourceIndex = i;
  }
  const legacyDeckOrderCompare = (a: Character, b: Character): number => {
    if (a.required && !b.required) return -1;
    if (!a.required && b.required) return 1;
    const scoreDiff = ATK_SORT_KEYS.has(firstSortKey)
      ? b.calcBaseATK - a.calcBaseATK
      : b.calcBaseHP - a.calcBaseHP;
    if (scoreDiff !== 0) return scoreDiff;
    return (((a as any)._legacyDeckSourceIndex as number) ?? 0) -
      (((b as any)._legacyDeckSourceIndex as number) ?? 0);
  };
  const legacyDeckOrder = nonZero.slice().sort(legacyDeckOrderCompare);
  for (let i = 0; i < legacyDeckOrder.length; i++) {
    (legacyDeckOrder[i] as any)._legacyDeckOrderIndex = i;
  }
  let hasRequiredCharacters = false;
  for (let i = 0; i < nonZero.length; i++) {
    if (nonZero[i].required) {
      hasRequiredCharacters = true;
      break;
    }
  }
  if (
    hasRequiredCharacters &&
    !settings.allowSameCharacter &&
    firstSortDesc &&
    firstSortKey === 'increasedHpBuddy'
  ) {
    nonZero.sort((a, b) => {
      if (a.required && !b.required) return -1;
      if (!a.required && b.required) return 1;
      const primaryDiff = (((b as any).increasedHpBuddyUpperCached as number) || 0) -
        (((a as any).increasedHpBuddyUpperCached as number) || 0);
      if (primaryDiff !== 0) return primaryDiff;
      const aEhpUpper =
        (((a as any).hpByBuddyMaskCached as Float64Array)[7]) +
        (((a as any).healByBuddyMaskCached as Float64Array)[7]);
      const bEhpUpper =
        (((b as any).hpByBuddyMaskCached as Float64Array)[7]) +
        (((b as any).healByBuddyMaskCached as Float64Array)[7]);
      const secondaryDiff = bEhpUpper - aEhpUpper;
      if (secondaryDiff !== 0) return secondaryDiff;
      return legacyDeckOrderCompare(a, b);
    });
  } else if (hasRequiredCharacters && duoSecondaryUpperSortCacheKey !== undefined) {
    nonZero.sort((a, b) => {
      if (a.required && !b.required) return -1;
      if (!a.required && b.required) return 1;
      const scoreDiff = (((b as any)[duoSecondaryUpperSortCacheKey] as number) || 0) -
        (((a as any)[duoSecondaryUpperSortCacheKey] as number) || 0);
      if (scoreDiff !== 0) return scoreDiff;
      return legacyDeckOrderCompare(a, b);
    });
  } else if (hasRequiredCharacters) {
    nonZero.sort(legacyDeckOrderCompare);
  } else if (isSortedByPrimaryUpper) {
    nonZero.sort((a, b) => {
      if (a.required && !b.required) return -1;
      if (!a.required && b.required) return 1;
      const scoreDiff = (((b as any)[primaryUpperSortCacheKey!] as number) || 0) -
        (((a as any)[primaryUpperSortCacheKey!] as number) || 0);
      if (scoreDiff !== 0) return scoreDiff;
      return b.calcBaseATK - a.calcBaseATK;
    });
    maxLevel.sort((a, b) => {
      const scoreDiff = (((b as any)[primaryUpperSortCacheKey!] as number) || 0) -
        (((a as any)[primaryUpperSortCacheKey!] as number) || 0);
      if (scoreDiff !== 0) return scoreDiff;
      return b.calcBaseATK - a.calcBaseATK;
    });
  } else if (firstSortDesc && (firstSortKey === 'hp' || firstSortKey === 'ehp')) {
    nonZero.sort((a, b) => {
      if (a.required && !b.required) return -1;
      if (!a.required && b.required) return 1;
      const aHpTable = (a as any).hpByBuddyMaskCached as Float64Array;
      const bHpTable = (b as any).hpByBuddyMaskCached as Float64Array;
      const scoreDiff = firstSortKey === 'ehp'
        ? (bHpTable[7] + (((b as any).healByBuddyMaskCached as Float64Array)[7])) -
          (aHpTable[7] + (((a as any).healByBuddyMaskCached as Float64Array)[7]))
        : bHpTable[7] - aHpTable[7];
      if (scoreDiff !== 0) return scoreDiff;
      return b.calcBaseHP - a.calcBaseHP;
    });
    maxLevel.sort((a, b) => {
      const aHpTable = (a as any).hpByBuddyMaskCached as Float64Array;
      const bHpTable = (b as any).hpByBuddyMaskCached as Float64Array;
      const scoreDiff = firstSortKey === 'ehp'
        ? (bHpTable[7] + (((b as any).healByBuddyMaskCached as Float64Array)[7])) -
          (aHpTable[7] + (((a as any).healByBuddyMaskCached as Float64Array)[7]))
        : bHpTable[7] - aHpTable[7];
      if (scoreDiff !== 0) return scoreDiff;
      return b.calcBaseHP - a.calcBaseHP;
    });
  } else if (!settings.allowSameCharacter && firstSortDesc && firstSortKey === 'increasedHpBuddy') {
    nonZero.sort((a, b) => {
      if (a.required && !b.required) return -1;
      if (!a.required && b.required) return 1;
      const scoreDiff = (((a as any).increasedHpBuddyUpperCached as number) || 0) -
        (((b as any).increasedHpBuddyUpperCached as number) || 0);
      if (scoreDiff !== 0) return scoreDiff;
      return a.calcBaseHP - b.calcBaseHP;
    });
  } else if (settings.allowSameCharacter && firstSortDesc && firstSortKey === 'increasedHpBuddy') {
    nonZero.sort((a, b) => {
      if (a.required && !b.required) return -1;
      if (!a.required && b.required) return 1;
      const scoreDiff = (((b as any).increasedHpBuddyUpperCached as number) || 0) -
        (((a as any).increasedHpBuddyUpperCached as number) || 0);
      if (scoreDiff !== 0) return scoreDiff;
      return b.calcBaseHP - a.calcBaseHP;
    });
    maxLevel.sort((a, b) => {
      const scoreDiff = (((b as any).increasedHpBuddyUpperCached as number) || 0) -
        (((a as any).increasedHpBuddyUpperCached as number) || 0);
      if (scoreDiff !== 0) return scoreDiff;
      return b.calcBaseHP - a.calcBaseHP;
    });
  } else if (duoSecondaryUpperSortCacheKey !== undefined) {
    nonZero.sort((a, b) => {
      if (a.required && !b.required) return -1;
      if (!a.required && b.required) return 1;
      const scoreDiff = (((b as any)[duoSecondaryUpperSortCacheKey] as number) || 0) -
        (((a as any)[duoSecondaryUpperSortCacheKey] as number) || 0);
      if (scoreDiff !== 0) return scoreDiff;
      return b.calcBaseATK - a.calcBaseATK;
    });
  } else if (ATK_SORT_KEYS.has(firstSortKey)) {
    // requiredがtrueの順、ATKの降順でソート
    nonZero.sort((a, b) => {
      if (a.required && !b.required) return -1;
      if (!a.required && b.required) return 1;
      return b.calcBaseATK - a.calcBaseATK;
    });
  } else {
    // requiredがtrueの順、HPの降順でソート
    nonZero.sort((a, b) => {
      if (a.required && !b.required) return -1;
      if (!a.required && b.required) return 1;
      return b.calcBaseHP - a.calcBaseHP;
    });
  }
  // requiredがtrueの数を数える
  let requiredCount = 0;
  for (let i = 0; i < nonZero.length; i++) {
    if (nonZero[i].required) requiredCount += 1;
  }
  if (requiredCount > 5) {
    controls.setErrorMessage('必須設定されたキャラが多すぎます');
    return;
  }
  controls.setResults([]);
  
  // 効率的な上位N件管理クラスを初期化
  const resultsManager = new DeckSearchResultsManager(settings.maxResult, sortCriteria);
  const mustIds = Array.from(settings.convertedMustCharacters).map(name => getCharaId(name as string));
  const skipMustCheckForCalcDeckStatus = mustIds.length === 0;

  const fillDeckResultFromArray = (ret: (string | number)[], target: DeckResult) => {
    target.hp = Math.round(ret[0] as number);
    target.ehp = Math.round(ret[1] as number);
    target.evasion = ret[2] as number;
    target.hpBuddy = ret[3] as number;
    target.increasedHpBuddy = ret[4] as number;
    target.buddy = ret[5] as number;
    target.noHpBuddy = ret[6] as number;
    target.duo = ret[7] as number;
    target.buff = ret[8] as number;
    target.debuff = ret[9] as number;
    target.maxCosmic = ret[10] as number;
    target.maxFire = ret[11] as number;
    target.maxWater = ret[12] as number;
    target.maxFlora = ret[13] as number;
    target.referenceDamage = ret[14] as number;
    target.referenceAdvantageDamage = ret[15] as number;
    target.referenceVsHiDamage = ret[16] as number;
    target.referenceVsMizuDamage = ret[17] as number;
    target.referenceVsKiDamage = ret[18] as number;
    target.healNum = ret[19] as number;
  };
  const sortCompareLen = sortCriteria.length;
  const sortCompareRetIndices = new Int8Array(sortCompareLen);
  const sortCompareKeys = new Array<string>(sortCompareLen);
  const sortCompareDirs = new Int8Array(sortCompareLen);
  for (let i = 0; i < sortCompareLen; i++) {
    const key = sortCriteria[i].key;
    sortCompareKeys[i] = key;
    sortCompareRetIndices[i] = sortKeyToRetIndex[key] ?? 0;
    sortCompareDirs[i] = sortCriteria[i].order === '昇順' ? 1 : -1;
  }
  const fillDeckResultSortValues = (ret: (string | number)[], target: DeckResult) => {
    const targetAny = target as any;
    for (let i = 0; i < sortCompareLen; i++) {
      targetAny[sortCompareKeys[i]] = ret[sortCompareRetIndices[i]] as number;
    }
  };
  const compareDeckForDisplay = (a: DeckResult, b: DeckResult): number => {
    const aAny = a as any;
    const bAny = b as any;
    for (let i = 0; i < sortCompareLen; i++) {
      const key = sortCompareKeys[i];
      const aValue = aAny[key];
      const bValue = bAny[key];
      if (aValue === bValue) continue;
      const comparison = aValue < bValue ? -1 : 1;
      return comparison * sortCompareDirs[i];
    }
    const aKey = (aAny._deckKey as string | undefined) ?? a.simuURL ?? '';
    const bKey = (bAny._deckKey as string | undefined) ?? b.simuURL ?? '';
    if (aKey !== bKey) return aKey < bKey ? -1 : 1;
    return 0;
  };
  const sortTopDecksForDisplay = (decks: DeckResult[]) => {
    // detail化でソートキー値が更新されるため、表示直前に最終順序を確定する。
    decks.sort(compareDeckForDisplay);
  };
  const usesDamageInSort = sortCriteria.some(criteria => DAMAGE_SORT_KEYS.has(criteria.key));
  const hasDamageThreshold =
    snapshot.minReferenceDamage > 0 ||
    snapshot.minReferenceAdvantageDamage > 0 ||
    snapshot.minReferenceVsHiDamage > 0 ||
    snapshot.minReferenceVsMizuDamage > 0 ||
    snapshot.minReferenceVsKiDamage > 0;
  const usesAuxInSort = sortCriteria.some(criteria => AUX_SORT_KEYS.has(criteria.key));
  const hasAuxThreshold =
    snapshot.minHPBuddy > 0 ||
    snapshot.minIncreasedHPBuddy > 0 ||
    snapshot.minEvasion > 0 ||
    snapshot.minDuo > 0 ||
    snapshot.minBuff > 0 ||
    snapshot.minDebuff > 0 ||
    snapshot.minCosmic > 0 ||
    snapshot.minFire > 0 ||
    snapshot.minWater > 0 ||
    snapshot.minFlora > 0 ||
    snapshot.minHealNum > 0;
  const primarySortKey = sortCriteria[0].key;
  const hpPrimaryUsesEhp = primarySortKey === 'ehp';
  const canUseHpPrimarySupportFastPath =
    !fastPathDisabled &&
    settings.allowSameCharacter &&
    requiredCount < 5 &&
    sortCompareLen === 1 &&
    sortCriteria[0].order === '降順' &&
    (primarySortKey === 'hp' || primarySortKey === 'ehp') &&
    snapshot.attackNum >= 9 &&
    snapshot.minHPBuddy === 0 &&
    snapshot.minIncreasedHPBuddy === 0 &&
    snapshot.minDuo === 0 &&
    skipMustCheckForCalcDeckStatus;
  const canUseHpPrimaryUpperBound =
    !fastPathDisabled &&
    (!settings.allowSameCharacter || canUseHpPrimarySupportFastPath) &&
    sortCompareLen === 1 &&
    sortCriteria[0].order === '降順' &&
    (primarySortKey === 'hp' || primarySortKey === 'ehp') &&
    skipMustCheckForCalcDeckStatus;
  const canUseHpPrimaryFastPath =
    canUseHpPrimaryUpperBound &&
    !settings.allowSameCharacter &&
    !hasDamageThreshold &&
    !hasAuxThreshold;
  const canUseHpPrimaryThresholdFastPath =
    canUseHpPrimaryUpperBound &&
    !settings.allowSameCharacter &&
    !canUseHpPrimaryFastPath &&
    snapshot.attackNum >= 9 &&
    snapshot.minHPBuddy === 0 &&
    snapshot.minIncreasedHPBuddy === 0 &&
    snapshot.minDuo === 0;
  const hpPrimaryUpperScores = canUseHpPrimaryUpperBound
    ? new Float64Array(nonZero.length)
    : null;
  const hpPrimaryUpperSuffixMax = canUseHpPrimaryUpperBound
    ? new Float64Array(nonZero.length + 1)
    : null;
  const maxLevelHpPrimaryUpperScores = canUseHpPrimarySupportFastPath
    ? new Float64Array(maxLevel.length)
    : null;
  const maxLevelHpPrimaryUpperSuffixMax = canUseHpPrimarySupportFastPath
    ? new Float64Array(maxLevel.length + 1)
    : null;
  let maxLevelHpPrimaryUpperMax = 0;
  if (canUseHpPrimaryUpperBound) {
    hpPrimaryUpperSuffixMax![nonZero.length] = -Infinity;
    for (let i = nonZero.length - 1; i >= 0; i--) {
      const charaAny = nonZero[i] as any;
      const hpTable = charaAny.hpByBuddyMaskCached as Float64Array;
      const healTable = charaAny.healByBuddyMaskCached as Float64Array;
      const score = hpPrimaryUsesEhp ? hpTable[7] + healTable[7] : hpTable[7];
      hpPrimaryUpperScores![i] = score;
      const next = hpPrimaryUpperSuffixMax![i + 1];
      hpPrimaryUpperSuffixMax![i] = score > next ? score : next;
    }
  }
  if (canUseHpPrimarySupportFastPath) {
    maxLevelHpPrimaryUpperSuffixMax![maxLevel.length] = -Infinity;
    for (let i = maxLevel.length - 1; i >= 0; i--) {
      const charaAny = maxLevel[i] as any;
      const hpTable = charaAny.hpByBuddyMaskCached as Float64Array;
      const healTable = charaAny.healByBuddyMaskCached as Float64Array;
      const score = hpPrimaryUsesEhp ? hpTable[7] + healTable[7] : hpTable[7];
      maxLevelHpPrimaryUpperScores![i] = score;
      if (score > maxLevelHpPrimaryUpperMax) maxLevelHpPrimaryUpperMax = score;
      const next = maxLevelHpPrimaryUpperSuffixMax![i + 1];
      maxLevelHpPrimaryUpperSuffixMax![i] = score > next ? score : next;
    }
  }
  const canUseIncreasedHpBuddyPrimaryFastPath =
    !fastPathDisabled &&
    requiredCount < 5 &&
    primarySortKey === 'increasedHpBuddy' &&
    sortCriteria[0].order === '降順' &&
    (sortCompareLen === 1 || (
      sortCompareLen === 2 &&
      sortCriteria[1].key === 'ehp' &&
      sortCriteria[1].order === '降順'
    )) &&
    !hasDamageThreshold &&
    snapshot.minHPBuddy === 0 &&
    snapshot.minEvasion === 0 &&
    snapshot.minDuo === 0 &&
    snapshot.minBuff === 0 &&
    snapshot.minDebuff === 0 &&
    snapshot.minCosmic === 0 &&
    snapshot.minFire === 0 &&
    snapshot.minWater === 0 &&
    snapshot.minFlora === 0 &&
    snapshot.minHealNum === 0 &&
    skipMustCheckForCalcDeckStatus;
  const canUseMetricPrimaryEhpSecondary =
    canUseIncreasedHpBuddyPrimaryFastPath &&
    sortCompareLen > 1;
  const canUseIncreasedHpBuddyFixedTwoFastLoop =
    canUseIncreasedHpBuddyPrimaryFastPath &&
    !settings.allowSameCharacter &&
    requiredCount === 2;
  const hasAnyDamageThreshold =
    snapshot.minReferenceDamage > 0 ||
    snapshot.minReferenceAdvantageDamage > 0 ||
    snapshot.minReferenceVsHiDamage > 0 ||
    snapshot.minReferenceVsMizuDamage > 0 ||
    snapshot.minReferenceVsKiDamage > 0;
  // 境界順位で calcDeckStatus と完全一致する保証が取れるまで、近似スコア系の高速経路は使わない。
  // Basic Duo は候補を近似で刈らず、各組み合わせをキャッシュ値から完全評価する経路だけ許可する。
  const canUseExactDamagePrimaryCombinationFastPath = true;
  const canUseExactDamagePrimaryNoRequiredFastLoop = true;
  const canUseExactBasicDuoPrimaryFastPath = true;
  const canUseDamagePrimaryFastPath =
    !fastPathDisabled &&
    canUseExactDamagePrimaryCombinationFastPath &&
    !settings.allowSameCharacter &&
    sortCompareLen === 1 &&
    sortCriteria[0].order === '降順' &&
    (DAMAGE_SORT_KEY_TO_MASK[primarySortKey] ?? 0) !== 0 &&
    snapshot.attackNum >= 10 &&
    !hasAnyDamageThreshold &&
    snapshot.minHPBuddy === 0 &&
    snapshot.minIncreasedHPBuddy === 0 &&
    snapshot.minDuo === 0 &&
    skipMustCheckForCalcDeckStatus;
  const canUseDamagePrimarySupportFastPath =
    !fastPathDisabled &&
    canUseExactDamagePrimaryCombinationFastPath &&
    settings.allowSameCharacter &&
    requiredCount < 5 &&
    sortCompareLen === 1 &&
    sortCriteria[0].order === '降順' &&
    (DAMAGE_SORT_KEY_TO_MASK[primarySortKey] ?? 0) !== 0 &&
    snapshot.attackNum >= 10 &&
    !hasAnyDamageThreshold &&
    snapshot.minHPBuddy === 0 &&
    snapshot.minIncreasedHPBuddy === 0 &&
    snapshot.minDuo === 0 &&
    skipMustCheckForCalcDeckStatus;
  const canUseDamagePrimaryFixedTwoFastLoop =
    canUseExactDamagePrimaryNoRequiredFastLoop &&
    canUseDamagePrimaryFastPath &&
    requiredCount === 2;
  const canUseDamagePrimaryNoRequiredFastLoop =
    canUseExactDamagePrimaryNoRequiredFastLoop &&
    canUseDamagePrimaryFastPath &&
    requiredCount < 5 &&
    !canUseDamagePrimaryFixedTwoFastLoop;
  const basicDuoSecondarySortKey = sortCompareLen === 2 ? sortCriteria[1].key : '';
  const basicDuoSecondaryDamageMetric = DAMAGE_SORT_KEY_TO_MASK[basicDuoSecondarySortKey] ?? 0;
  const canUseBasicDuoPrimaryFastPath =
    !fastPathDisabled &&
    canUseExactBasicDuoPrimaryFastPath &&
    sortCompareLen === 2 &&
    primarySortKey === 'duo' &&
    sortCriteria[0].order === '降順' &&
    sortCriteria[1].order === '降順' &&
    basicDuoSecondaryDamageMetric !== 0 &&
    snapshot.attackNum >= 8 &&
    snapshot.minHPBuddy === 0 &&
    snapshot.minIncreasedHPBuddy === 0 &&
    skipMustCheckForCalcDeckStatus;
  const canUseBasicDuoPrimaryNoRequiredFastLoop =
    canUseBasicDuoPrimaryFastPath &&
    !settings.allowSameCharacter &&
    requiredCount < 5;
  const canUseBasicDuoPrimarySupportFastLoop =
    canUseBasicDuoPrimaryFastPath &&
    settings.allowSameCharacter &&
    requiredCount < 5;
  const canUseIncreasedHpBuddyUpperPrune =
    canUseIncreasedHpBuddyPrimaryFastPath &&
    !canUseIncreasedHpBuddyFixedTwoFastLoop;
  const increasedHpPrimaryUpperScores = canUseIncreasedHpBuddyUpperPrune
    ? new Float64Array(nonZero.length)
    : null;
  const increasedHpPrimaryUpperSuffixMax = canUseIncreasedHpBuddyUpperPrune
    ? new Float64Array(nonZero.length + 1)
    : null;
  const maxLevelIncreasedHpPrimaryUpperScores = canUseIncreasedHpBuddyUpperPrune
    ? new Float64Array(maxLevel.length)
    : null;
  const maxLevelIncreasedHpPrimaryUpperSuffixMax = canUseIncreasedHpBuddyUpperPrune
    ? new Float64Array(maxLevel.length + 1)
    : null;
  const secondaryEhpUpperScores = canUseIncreasedHpBuddyUpperPrune
    ? new Float64Array(nonZero.length)
    : null;
  const secondaryEhpUpperSuffixMax = canUseIncreasedHpBuddyUpperPrune
    ? new Float64Array(nonZero.length + 1)
    : null;
  const maxLevelSecondaryEhpUpperScores = canUseIncreasedHpBuddyUpperPrune
    ? new Float64Array(maxLevel.length)
    : null;
  const maxLevelSecondaryEhpUpperSuffixMax = canUseIncreasedHpBuddyUpperPrune
    ? new Float64Array(maxLevel.length + 1)
    : null;
  let maxLevelIncreasedHpPrimaryUpperMax = 0;
  let maxLevelSecondaryEhpUpperMax = 0;
  if (canUseIncreasedHpBuddyUpperPrune) {
    increasedHpPrimaryUpperSuffixMax![nonZero.length] = -Infinity;
    for (let i = nonZero.length - 1; i >= 0; i--) {
      const score = ((nonZero[i] as any).increasedHpBuddyUpperCached as number) || 0;
      increasedHpPrimaryUpperScores![i] = score;
      const next = increasedHpPrimaryUpperSuffixMax![i + 1];
      increasedHpPrimaryUpperSuffixMax![i] = score > next ? score : next;
    }
    maxLevelIncreasedHpPrimaryUpperSuffixMax![maxLevel.length] = -Infinity;
    for (let i = maxLevel.length - 1; i >= 0; i--) {
      const score = ((maxLevel[i] as any).increasedHpBuddyUpperCached as number) || 0;
      maxLevelIncreasedHpPrimaryUpperScores![i] = score;
      if (score > maxLevelIncreasedHpPrimaryUpperMax) maxLevelIncreasedHpPrimaryUpperMax = score;
      const next = maxLevelIncreasedHpPrimaryUpperSuffixMax![i + 1];
      maxLevelIncreasedHpPrimaryUpperSuffixMax![i] = score > next ? score : next;
    }
  }
  if (canUseIncreasedHpBuddyUpperPrune) {
    secondaryEhpUpperSuffixMax![nonZero.length] = -Infinity;
    for (let i = nonZero.length - 1; i >= 0; i--) {
      const charaAny = nonZero[i] as any;
      const score =
        ((charaAny.hpByBuddyMaskCached as Float64Array)[7]) +
        ((charaAny.healByBuddyMaskCached as Float64Array)[7]);
      secondaryEhpUpperScores![i] = score;
      const next = secondaryEhpUpperSuffixMax![i + 1];
      secondaryEhpUpperSuffixMax![i] = score > next ? score : next;
    }
    maxLevelSecondaryEhpUpperSuffixMax![maxLevel.length] = -Infinity;
    for (let i = maxLevel.length - 1; i >= 0; i--) {
      const charaAny = maxLevel[i] as any;
      const score =
        ((charaAny.hpByBuddyMaskCached as Float64Array)[7]) +
        ((charaAny.healByBuddyMaskCached as Float64Array)[7]);
      maxLevelSecondaryEhpUpperScores![i] = score;
      if (score > maxLevelSecondaryEhpUpperMax) maxLevelSecondaryEhpUpperMax = score;
      const next = maxLevelSecondaryEhpUpperSuffixMax![i + 1];
      maxLevelSecondaryEhpUpperSuffixMax![i] = score > next ? score : next;
    }
  }
  // Primary pass で不要な指標は計算自体を省く。
  // 「ソートにも閾値にも使わない値」はここで落とすのが最も効果的。
  const skipDamageMetricsForPrimaryPass = !usesDamageInSort && !hasDamageThreshold;
  const skipAuxMetricsForPrimaryPass = !usesAuxInSort && !hasAuxThreshold;
  let damageMetricMaskForPrimaryPass = DAMAGE_METRIC_ALL;
  if (skipDamageMetricsForPrimaryPass) {
    damageMetricMaskForPrimaryPass = 0;
  } else {
    let mask = 0;
    if (snapshot.minReferenceDamage > 0) mask |= DAMAGE_METRIC_REFERENCE;
    if (snapshot.minReferenceAdvantageDamage > 0) mask |= DAMAGE_METRIC_ADVANTAGE;
    if (snapshot.minReferenceVsHiDamage > 0) mask |= DAMAGE_METRIC_VS_HI;
    if (snapshot.minReferenceVsMizuDamage > 0) mask |= DAMAGE_METRIC_VS_MIZU;
    if (snapshot.minReferenceVsKiDamage > 0) mask |= DAMAGE_METRIC_VS_KI;
    for (let i = 0; i < sortCriteria.length; i++) {
      const bit = DAMAGE_SORT_KEY_TO_MASK[sortCriteria[i].key];
      if (bit !== undefined) mask |= bit;
    }
    damageMetricMaskForPrimaryPass = mask === 0 ? DAMAGE_METRIC_ALL : mask;
  }
  let auxMetricMaskForPrimaryPass = AUX_METRIC_ALL;
  if (skipAuxMetricsForPrimaryPass) {
    auxMetricMaskForPrimaryPass = 0;
  } else {
    let mask = 0;
    if (snapshot.minHPBuddy > 0) mask |= AUX_METRIC_HP_BUDDY;
    if (snapshot.minIncreasedHPBuddy > 0) mask |= AUX_METRIC_INCREASED_HP_BUDDY;
    if (snapshot.minEvasion > 0) mask |= AUX_METRIC_EVASION;
    if (snapshot.minDuo > 0) mask |= AUX_METRIC_DUO;
    if (snapshot.minBuff > 0) mask |= AUX_METRIC_BUFF;
    if (snapshot.minDebuff > 0) mask |= AUX_METRIC_DEBUFF;
    if (snapshot.minCosmic > 0) mask |= AUX_METRIC_COSMIC;
    if (snapshot.minFire > 0) mask |= AUX_METRIC_FIRE;
    if (snapshot.minWater > 0) mask |= AUX_METRIC_WATER;
    if (snapshot.minFlora > 0) mask |= AUX_METRIC_FLORA;
    if (snapshot.minHealNum > 0) mask |= AUX_METRIC_HEAL_NUM;
    for (let i = 0; i < sortCriteria.length; i++) {
      const bit = AUX_SORT_KEY_TO_MASK[sortCriteria[i].key];
      if (bit !== undefined) mask |= bit;
    }
    auxMetricMaskForPrimaryPass = mask === 0 ? AUX_METRIC_ALL : mask;
  }
  const primarySortRetIndex = sortKeyToRetIndex[sortCriteria[0].key] ?? 0;
  const primaryUpperCacheKey = primaryUpperSortCacheKey;
  const shouldUsePrimaryUpperBound = primaryUpperCacheKey !== undefined;
  if (shouldUsePrimaryUpperBound) {
    markFastPath(settings.allowSameCharacter
      ? 'same-support-damage-upper-bound'
      : 'damage-upper-bound');
  }
  const primaryDamageUpperMetric = DAMAGE_SORT_KEY_TO_MASK[sortCriteria[0].key] ?? 0;
  const getPrimaryUpperScore = (chara: Character): number => {
    return ((chara as any)[primaryUpperCacheKey!] as number) || 0;
  };
  const nonZeroPrimaryUpperScores = shouldUsePrimaryUpperBound
    ? new Float64Array(nonZero.length)
    : null;
  const nonZeroPrimaryUpperSuffixMax = shouldUsePrimaryUpperBound
    ? new Float64Array(nonZero.length + 1)
    : null;
  const maxLevelPrimaryUpperScores = shouldUsePrimaryUpperBound
    ? new Float64Array(maxLevel.length)
    : null;
  let maxLevelPrimaryUpperMax = 0;
  if (shouldUsePrimaryUpperBound) {
    for (let i = 0; i < nonZero.length; i++) {
      nonZeroPrimaryUpperScores![i] = getPrimaryUpperScore(nonZero[i]);
    }
    nonZeroPrimaryUpperSuffixMax![nonZero.length] = -Infinity;
    for (let i = nonZero.length - 1; i >= 0; i--) {
      const value = nonZeroPrimaryUpperScores![i];
      const next = nonZeroPrimaryUpperSuffixMax![i + 1];
      nonZeroPrimaryUpperSuffixMax![i] = value > next ? value : next;
    }
    for (let i = 0; i < maxLevel.length; i++) {
      const value = getPrimaryUpperScore(maxLevel[i]);
      maxLevelPrimaryUpperScores![i] = value;
      if (value > maxLevelPrimaryUpperMax) maxLevelPrimaryUpperMax = value;
    }
  }
  const canUseNoRequiredEarlyPrune = requiredCount === 0;
  const canUseFixedPrefixNoSameEarlyPrune = !settings.allowSameCharacter && requiredCount < 5;
  const hpPrimaryUpperSuffixTopSums = (canUseFixedPrefixNoSameEarlyPrune || canUseHpPrimarySupportFastPath) && canUseHpPrimaryUpperBound
    ? buildSuffixTopSums(hpPrimaryUpperScores!, 5)
    : null;
  const increasedHpPrimarySuffixKthLargest = canUseIncreasedHpBuddyUpperPrune
    ? buildSuffixKthLargest(increasedHpPrimaryUpperScores!, 5)
    : null;
  const secondaryEhpUpperSuffixTopSums = canUseIncreasedHpBuddyUpperPrune
    ? buildSuffixTopSums(secondaryEhpUpperScores!, 5)
    : null;
  const primaryUpperSuffixTopSums = (canUseFixedPrefixNoSameEarlyPrune || canUseNoRequiredEarlyPrune) && shouldUsePrimaryUpperBound
    ? buildSuffixTopSums(nonZeroPrimaryUpperScores!, 5)
    : null;
  const buildCachedNumberScoreArrayFor = (cards: Character[], cacheKey: string): Float64Array => {
    const scores = new Float64Array(cards.length);
    for (let i = 0; i < cards.length; i++) {
      scores[i] = (((cards[i] as any)[cacheKey] as number) ?? 0);
    }
    return scores;
  };
  const buildCachedNumberScoreArray = (cacheKey: string): Float64Array =>
    buildCachedNumberScoreArrayFor(nonZero, cacheKey);
  const noRequiredAuxPruneEnabled =
    !fastPathDisabled &&
    canUseFixedPrefixNoSameEarlyPrune &&
    !settings.allowSameCharacter &&
    (
      snapshot.minEvasion > 0 ||
      snapshot.minBuff > 0 ||
      snapshot.minDebuff > 0 ||
      snapshot.minCosmic > 0 ||
      snapshot.minFire > 0 ||
      snapshot.minWater > 0 ||
      snapshot.minFlora > 0 ||
      snapshot.minHealNum > 0
    );
  const noRequiredEvasionScores = noRequiredAuxPruneEnabled && snapshot.minEvasion > 0
    ? buildCachedNumberScoreArray('evasion')
    : null;
  const noRequiredBuffScores = noRequiredAuxPruneEnabled && snapshot.minBuff > 0
    ? buildCachedNumberScoreArray('totalBuffCached')
    : null;
  const noRequiredDebuffScores = noRequiredAuxPruneEnabled && snapshot.minDebuff > 0
    ? buildCachedNumberScoreArray('totalDebuffCached')
    : null;
  const noRequiredCosmicScores = noRequiredAuxPruneEnabled && snapshot.minCosmic > 0
    ? buildCachedNumberScoreArray('magicCosmicCountCached')
    : null;
  const noRequiredFireScores = noRequiredAuxPruneEnabled && snapshot.minFire > 0
    ? buildCachedNumberScoreArray('magicFireCountCached')
    : null;
  const noRequiredWaterScores = noRequiredAuxPruneEnabled && snapshot.minWater > 0
    ? buildCachedNumberScoreArray('magicWaterCountCached')
    : null;
  const noRequiredFloraScores = noRequiredAuxPruneEnabled && snapshot.minFlora > 0
    ? buildCachedNumberScoreArray('magicFloraCountCached')
    : null;
  const noRequiredHealNumScores = noRequiredAuxPruneEnabled && snapshot.minHealNum > 0
    ? buildCachedNumberScoreArray('healCardCountCached')
    : null;
  const noRequiredEvasionSuffixTopSums = noRequiredEvasionScores ? buildSuffixTopSums(noRequiredEvasionScores, 5) : null;
  const noRequiredBuffSuffixTopSums = noRequiredBuffScores ? buildSuffixTopSums(noRequiredBuffScores, 5) : null;
  const noRequiredDebuffSuffixTopSums = noRequiredDebuffScores ? buildSuffixTopSums(noRequiredDebuffScores, 5) : null;
  const noRequiredCosmicSuffixTopSums = noRequiredCosmicScores ? buildSuffixTopSums(noRequiredCosmicScores, 5) : null;
  const noRequiredFireSuffixTopSums = noRequiredFireScores ? buildSuffixTopSums(noRequiredFireScores, 5) : null;
  const noRequiredWaterSuffixTopSums = noRequiredWaterScores ? buildSuffixTopSums(noRequiredWaterScores, 5) : null;
  const noRequiredFloraSuffixTopSums = noRequiredFloraScores ? buildSuffixTopSums(noRequiredFloraScores, 5) : null;
  const noRequiredHealNumSuffixTopSums = noRequiredHealNumScores ? buildSuffixTopSums(noRequiredHealNumScores, 5) : null;
  const noRequiredAuxCouldPass = (
    evasion: number,
    buff: number,
    debuff: number,
    cosmic: number,
    fire: number,
    water: number,
    flora: number,
    healNum: number,
    suffixStart: number,
    pickCount: number,
  ): boolean => {
    if (noRequiredEvasionSuffixTopSums && evasion + noRequiredEvasionSuffixTopSums[pickCount][suffixStart] < snapshot.minEvasion) return false;
    if (noRequiredBuffSuffixTopSums && buff + noRequiredBuffSuffixTopSums[pickCount][suffixStart] < snapshot.minBuff) return false;
    if (noRequiredDebuffSuffixTopSums && debuff + noRequiredDebuffSuffixTopSums[pickCount][suffixStart] < snapshot.minDebuff) return false;
    if (noRequiredCosmicSuffixTopSums && cosmic + noRequiredCosmicSuffixTopSums[pickCount][suffixStart] < snapshot.minCosmic) return false;
    if (noRequiredFireSuffixTopSums && fire + noRequiredFireSuffixTopSums[pickCount][suffixStart] < snapshot.minFire) return false;
    if (noRequiredWaterSuffixTopSums && water + noRequiredWaterSuffixTopSums[pickCount][suffixStart] < snapshot.minWater) return false;
    if (noRequiredFloraSuffixTopSums && flora + noRequiredFloraSuffixTopSums[pickCount][suffixStart] < snapshot.minFlora) return false;
    if (noRequiredHealNumSuffixTopSums && healNum + noRequiredHealNumSuffixTopSums[pickCount][suffixStart] < snapshot.minHealNum) return false;
    return true;
  };
  const hpThresholdBranchPruneEnabled =
    canUseFixedPrefixNoSameEarlyPrune &&
    canUseHpPrimaryThresholdFastPath &&
    (
      snapshot.minEvasion > 0 ||
      snapshot.minBuff > 0 ||
      snapshot.minDebuff > 0 ||
      snapshot.minCosmic > 0 ||
      snapshot.minFire > 0 ||
      snapshot.minWater > 0 ||
      snapshot.minFlora > 0 ||
      snapshot.minHealNum > 0 ||
      snapshot.minReferenceDamage > 0 ||
      snapshot.minReferenceAdvantageDamage > 0 ||
      snapshot.minReferenceVsHiDamage > 0 ||
      snapshot.minReferenceVsMizuDamage > 0 ||
      snapshot.minReferenceVsKiDamage > 0
    );
  const hpThresholdEvasionScores = hpThresholdBranchPruneEnabled && snapshot.minEvasion > 0
    ? buildCachedNumberScoreArray('evasion')
    : null;
  const hpThresholdBuffScores = hpThresholdBranchPruneEnabled && snapshot.minBuff > 0
    ? buildCachedNumberScoreArray('totalBuffCached')
    : null;
  const hpThresholdDebuffScores = hpThresholdBranchPruneEnabled && snapshot.minDebuff > 0
    ? buildCachedNumberScoreArray('totalDebuffCached')
    : null;
  const hpThresholdCosmicScores = hpThresholdBranchPruneEnabled && snapshot.minCosmic > 0
    ? buildCachedNumberScoreArray('magicCosmicCountCached')
    : null;
  const hpThresholdFireScores = hpThresholdBranchPruneEnabled && snapshot.minFire > 0
    ? buildCachedNumberScoreArray('magicFireCountCached')
    : null;
  const hpThresholdWaterScores = hpThresholdBranchPruneEnabled && snapshot.minWater > 0
    ? buildCachedNumberScoreArray('magicWaterCountCached')
    : null;
  const hpThresholdFloraScores = hpThresholdBranchPruneEnabled && snapshot.minFlora > 0
    ? buildCachedNumberScoreArray('magicFloraCountCached')
    : null;
  const hpThresholdHealNumScores = hpThresholdBranchPruneEnabled && snapshot.minHealNum > 0
    ? buildCachedNumberScoreArray('healCardCountCached')
    : null;
  const hpThresholdReferenceDamageScores = hpThresholdBranchPruneEnabled && snapshot.minReferenceDamage > 0
    ? buildCachedNumberScoreArray('referenceDamageUpperTop2Cached')
    : null;
  const hpThresholdAdvantageDamageScores = hpThresholdBranchPruneEnabled && snapshot.minReferenceAdvantageDamage > 0
    ? buildCachedNumberScoreArray('referenceAdvantageDamageUpperTop2Cached')
    : null;
  const hpThresholdVsHiDamageScores = hpThresholdBranchPruneEnabled && snapshot.minReferenceVsHiDamage > 0
    ? buildCachedNumberScoreArray('referenceVsHiDamageUpperTop2Cached')
    : null;
  const hpThresholdVsMizuDamageScores = hpThresholdBranchPruneEnabled && snapshot.minReferenceVsMizuDamage > 0
    ? buildCachedNumberScoreArray('referenceVsMizuDamageUpperTop2Cached')
    : null;
  const hpThresholdVsKiDamageScores = hpThresholdBranchPruneEnabled && snapshot.minReferenceVsKiDamage > 0
    ? buildCachedNumberScoreArray('referenceVsKiDamageUpperTop2Cached')
    : null;
  const hpThresholdEvasionSuffixTopSums = hpThresholdEvasionScores ? buildSuffixTopSums(hpThresholdEvasionScores, 5) : null;
  const hpThresholdBuffSuffixTopSums = hpThresholdBuffScores ? buildSuffixTopSums(hpThresholdBuffScores, 5) : null;
  const hpThresholdDebuffSuffixTopSums = hpThresholdDebuffScores ? buildSuffixTopSums(hpThresholdDebuffScores, 5) : null;
  const hpThresholdCosmicSuffixTopSums = hpThresholdCosmicScores ? buildSuffixTopSums(hpThresholdCosmicScores, 5) : null;
  const hpThresholdFireSuffixTopSums = hpThresholdFireScores ? buildSuffixTopSums(hpThresholdFireScores, 5) : null;
  const hpThresholdWaterSuffixTopSums = hpThresholdWaterScores ? buildSuffixTopSums(hpThresholdWaterScores, 5) : null;
  const hpThresholdFloraSuffixTopSums = hpThresholdFloraScores ? buildSuffixTopSums(hpThresholdFloraScores, 5) : null;
  const hpThresholdHealNumSuffixTopSums = hpThresholdHealNumScores ? buildSuffixTopSums(hpThresholdHealNumScores, 5) : null;
  const hpThresholdReferenceDamageSuffixTopSums = hpThresholdReferenceDamageScores ? buildSuffixTopSums(hpThresholdReferenceDamageScores, 5) : null;
  const hpThresholdAdvantageDamageSuffixTopSums = hpThresholdAdvantageDamageScores ? buildSuffixTopSums(hpThresholdAdvantageDamageScores, 5) : null;
  const hpThresholdVsHiDamageSuffixTopSums = hpThresholdVsHiDamageScores ? buildSuffixTopSums(hpThresholdVsHiDamageScores, 5) : null;
  const hpThresholdVsMizuDamageSuffixTopSums = hpThresholdVsMizuDamageScores ? buildSuffixTopSums(hpThresholdVsMizuDamageScores, 5) : null;
  const hpThresholdVsKiDamageSuffixTopSums = hpThresholdVsKiDamageScores ? buildSuffixTopSums(hpThresholdVsKiDamageScores, 5) : null;
  const buildNextAtLeast = (scores: Float64Array, maxNeed: number): Int32Array[] => {
    const tableCount = Math.max(0, Math.ceil(maxNeed));
    const tables = new Array<Int32Array>(tableCount + 1);
    for (let need = 1; need <= tableCount; need++) {
      const table = new Int32Array(nonZero.length + 1);
      let nextIndex = nonZero.length;
      table[nonZero.length] = nonZero.length;
      for (let index = nonZero.length - 1; index >= 0; index--) {
        if (scores[index] >= need) nextIndex = index;
        table[index] = nextIndex;
      }
      tables[need] = table;
    }
    return tables;
  };
  const hpThresholdEvasionNextAtLeast = hpThresholdEvasionScores ? buildNextAtLeast(hpThresholdEvasionScores, snapshot.minEvasion) : null;
  const hpThresholdBuffNextAtLeast = hpThresholdBuffScores ? buildNextAtLeast(hpThresholdBuffScores, snapshot.minBuff) : null;
  const hpThresholdDebuffNextAtLeast = hpThresholdDebuffScores ? buildNextAtLeast(hpThresholdDebuffScores, snapshot.minDebuff) : null;
  const hpThresholdCosmicNextAtLeast = hpThresholdCosmicScores ? buildNextAtLeast(hpThresholdCosmicScores, snapshot.minCosmic) : null;
  const hpThresholdFireNextAtLeast = hpThresholdFireScores ? buildNextAtLeast(hpThresholdFireScores, snapshot.minFire) : null;
  const hpThresholdWaterNextAtLeast = hpThresholdWaterScores ? buildNextAtLeast(hpThresholdWaterScores, snapshot.minWater) : null;
  const hpThresholdFloraNextAtLeast = hpThresholdFloraScores ? buildNextAtLeast(hpThresholdFloraScores, snapshot.minFlora) : null;
  const hpThresholdHealNumNextAtLeast = hpThresholdHealNumScores ? buildNextAtLeast(hpThresholdHealNumScores, snapshot.minHealNum) : null;
  const hpThresholdSingleCandidateJumpEnabled =
    hpThresholdEvasionNextAtLeast !== null ||
    hpThresholdBuffNextAtLeast !== null ||
    hpThresholdDebuffNextAtLeast !== null ||
    hpThresholdCosmicNextAtLeast !== null ||
    hpThresholdFireNextAtLeast !== null ||
    hpThresholdWaterNextAtLeast !== null ||
    hpThresholdFloraNextAtLeast !== null ||
    hpThresholdHealNumNextAtLeast !== null;
  const usesHpTotalInSort = sortCriteria.some(criteria => criteria.key === 'hp' || criteria.key === 'ehp');
  const usesHpBuddyMetric =
    snapshot.minHPBuddy > 0 ||
    snapshot.minIncreasedHPBuddy > 0 ||
    sortCriteria.some(criteria =>
      criteria.key === 'hpBuddy' ||
      criteria.key === 'increasedHpBuddy' ||
      criteria.key === 'noHpBuddy'
    );
  const sumSmallestBaseHp = (cards: Character[], startIndex: number, count: number): number => {
    if (count <= 0) return 0;
    const values: number[] = [];
    for (let i = startIndex; i < cards.length; i++) {
      values.push(cards[i].calcBaseHP);
    }
    if (values.length < count) return -Infinity;
    values.sort((a, b) => a - b);
    let sum = 0;
    for (let i = 0; i < count; i++) sum += values[i];
    return sum;
  };
  let guaranteedBaseHp = 0;
  for (let i = 0; i < requiredCount; i++) {
    guaranteedBaseHp += nonZero[i].calcBaseHP;
  }
  if (settings.allowSameCharacter) {
    guaranteedBaseHp += sumSmallestBaseHp(nonZero, requiredCount, 4 - requiredCount);
    guaranteedBaseHp += sumSmallestBaseHp(maxLevel, 0, requiredCount >= 5 ? 0 : 1);
  } else {
    guaranteedBaseHp += sumSmallestBaseHp(nonZero, requiredCount, 5 - requiredCount);
  }
  const skipHpMetricsForPrimaryPass =
    !usesHpTotalInSort &&
    !usesHpBuddyMetric &&
    guaranteedBaseHp >= snapshot.minHP &&
    guaranteedBaseHp >= snapshot.minEHP;
  const primarySnapshot = skipHpMetricsForPrimaryPass
    ? { ...snapshot, minHP: 0, minEHP: 0 }
    : snapshot;

  const combination: Character[] = new Array(5);
  const primaryPassOptions = {
    includeDetails: false,
    includeDeckMeta: false,
    skipDamageMetrics: skipDamageMetricsForPrimaryPass,
    skipAuxMetrics: skipAuxMetricsForPrimaryPass,
    skipHpMetrics: skipHpMetricsForPrimaryPass,
    skipMustCheck: skipMustCheckForCalcDeckStatus,
    assumePreparedCache: true,
    auxMetricMask: auxMetricMaskForPrimaryPass,
    damageMetricMask: damageMetricMaskForPrimaryPass,
    mustIds,
    snapshot: primarySnapshot,
  };
  const detailPassOptions = {
    includeDetails: true,
    includeDeckMeta: false,
    skipMustCheck: skipMustCheckForCalcDeckStatus,
    assumePreparedCache: true,
    mustIds,
    snapshot,
  };
  const detailFinalizeCombinationScratch = new Array<Character>(5);
  const primaryEvaluateCombinationScratch = new Array<Character>(5);
  const legacyDeckKeyScratch = new Array<Character>(5);
  const getLegacyDeckOrderIndex = (chara: Character): number =>
    ((chara as any)._legacyDeckOrderIndex as number | undefined) ?? Number.MAX_SAFE_INTEGER;
  const sortLegacyOutputPrefix = (items: Character[], count: number) => {
    for (let i = 1; i < count; i++) {
      const value = items[i];
      let j = i - 1;
      while (j >= 0 && legacyDeckOrderCompare(items[j], value) > 0) {
        items[j + 1] = items[j];
        j -= 1;
      }
      items[j + 1] = value;
    }
  };
  const copyLegacyOutputCombination = (
    c0: Character,
    c1: Character,
    c2: Character,
    c3: Character,
    c4: Character,
    supportSlot: boolean,
    target: Character[],
  ) => {
    target[0] = c0;
    target[1] = c1;
    target[2] = c2;
    target[3] = c3;
    if (supportSlot) {
      sortLegacyOutputPrefix(target, 4);
      target[4] = c4;
    } else {
      target[4] = c4;
      sortLegacyOutputPrefix(target, 5);
    }
  };
  const buildLegacyDeckKey = (
    c0: Character,
    c1: Character,
    c2: Character,
    c3: Character,
    c4: Character,
    supportSlot = false,
  ): string => {
    const combo = legacyDeckKeyScratch;
    copyLegacyOutputCombination(c0, c1, c2, c3, c4, supportSlot, combo);
    return combo[0].name + '|' + combo[1].name + '|' + combo[2].name + '|' + combo[3].name + '|' + combo[4].name;
  };
  const buildFastDetailRetForFixedFive = (combo: Character[]): (string | number | any)[] | undefined => {
    if (snapshot.attackNum < 8) return undefined;
    const c0 = combo[0];
    const c1 = combo[1];
    const c2 = combo[2];
    const c3 = combo[3];
    const c4 = combo[4];
    const c0Any = c0 as any;
    const c1Any = c1 as any;
    const c2Any = c2 as any;
    const c3Any = c3 as any;
    const c4Any = c4 as any;
    const presenceLow = (
      (c0Any.charaBitLowCached as number) |
      (c1Any.charaBitLowCached as number) |
      (c2Any.charaBitLowCached as number) |
      (c3Any.charaBitLowCached as number) |
      (c4Any.charaBitLowCached as number)
    ) >>> 0;
    const presenceHigh = (
      (c0Any.charaBitHighCached as number) |
      (c1Any.charaBitHighCached as number) |
      (c2Any.charaBitHighCached as number) |
      (c3Any.charaBitHighCached as number) |
      (c4Any.charaBitHighCached as number)
    ) >>> 0;
    const c0Mask = getActiveBuddyMaskFromPresence(c0Any, presenceLow, presenceHigh);
    const c1Mask = getActiveBuddyMaskFromPresence(c1Any, presenceLow, presenceHigh);
    const c2Mask = getActiveBuddyMaskFromPresence(c2Any, presenceLow, presenceHigh);
    const c3Mask = getActiveBuddyMaskFromPresence(c3Any, presenceLow, presenceHigh);
    const c4Mask = getActiveBuddyMaskFromPresence(c4Any, presenceLow, presenceHigh);
    const c0HpTable = c0Any.hpByBuddyMaskCached as Float64Array | undefined;
    const c1HpTable = c1Any.hpByBuddyMaskCached as Float64Array | undefined;
    const c2HpTable = c2Any.hpByBuddyMaskCached as Float64Array | undefined;
    const c3HpTable = c3Any.hpByBuddyMaskCached as Float64Array | undefined;
    const c4HpTable = c4Any.hpByBuddyMaskCached as Float64Array | undefined;
    const c0HealTable = c0Any.healByBuddyMaskCached as Float64Array | undefined;
    const c1HealTable = c1Any.healByBuddyMaskCached as Float64Array | undefined;
    const c2HealTable = c2Any.healByBuddyMaskCached as Float64Array | undefined;
    const c3HealTable = c3Any.healByBuddyMaskCached as Float64Array | undefined;
    const c4HealTable = c4Any.healByBuddyMaskCached as Float64Array | undefined;
    const c0IncreasedTable = c0Any.increasedHpByBuddyMaskCached as Float64Array | undefined;
    const c1IncreasedTable = c1Any.increasedHpByBuddyMaskCached as Float64Array | undefined;
    const c2IncreasedTable = c2Any.increasedHpByBuddyMaskCached as Float64Array | undefined;
    const c3IncreasedTable = c3Any.increasedHpByBuddyMaskCached as Float64Array | undefined;
    const c4IncreasedTable = c4Any.increasedHpByBuddyMaskCached as Float64Array | undefined;
    const c0DamageTable = c0Any.primaryDamageTop2ByMaskCached as Float64Array | undefined;
    const c1DamageTable = c1Any.primaryDamageTop2ByMaskCached as Float64Array | undefined;
    const c2DamageTable = c2Any.primaryDamageTop2ByMaskCached as Float64Array | undefined;
    const c3DamageTable = c3Any.primaryDamageTop2ByMaskCached as Float64Array | undefined;
    const c4DamageTable = c4Any.primaryDamageTop2ByMaskCached as Float64Array | undefined;
    if (
      c0HpTable === undefined || c1HpTable === undefined || c2HpTable === undefined || c3HpTable === undefined || c4HpTable === undefined ||
      c0HealTable === undefined || c1HealTable === undefined || c2HealTable === undefined || c3HealTable === undefined || c4HealTable === undefined ||
      c0IncreasedTable === undefined || c1IncreasedTable === undefined || c2IncreasedTable === undefined || c3IncreasedTable === undefined || c4IncreasedTable === undefined ||
      c0DamageTable === undefined || c1DamageTable === undefined || c2DamageTable === undefined || c3DamageTable === undefined || c4DamageTable === undefined
    ) {
      return undefined;
    }

    const hp =
      c0HpTable[c0Mask] +
      c1HpTable[c1Mask] +
      c2HpTable[c2Mask] +
      c3HpTable[c3Mask] +
      c4HpTable[c4Mask];
    const h0 = c0HealTable[c0Mask];
    const h1 = c1HealTable[c1Mask];
    const h2 = c2HealTable[c2Mask];
    const h3 = c3HealTable[c3Mask];
    const h4 = c4HealTable[c4Mask];
    const ehp = hp + h0 + h1 + h2 + h3 + h4;

    const countBits3 = (mask: number): number => (mask & 1) + ((mask >> 1) & 1) + ((mask >> 2) & 1);
    const activeHpBuddyCount = (charaAny: any, mask: number): number =>
      (((mask & 1) !== 0 && (charaAny.buddy1HpIncreaseCached as number) !== 0) ? 1 : 0) +
      (((mask & 2) !== 0 && (charaAny.buddy2HpIncreaseCached as number) !== 0) ? 1 : 0) +
      (((mask & 4) !== 0 && (charaAny.buddy3HpIncreaseCached as number) !== 0) ? 1 : 0);
    const c0HpBuddy = activeHpBuddyCount(c0Any, c0Mask);
    const c1HpBuddy = activeHpBuddyCount(c1Any, c1Mask);
    const c2HpBuddy = activeHpBuddyCount(c2Any, c2Mask);
    const c3HpBuddy = activeHpBuddyCount(c3Any, c3Mask);
    const c4HpBuddy = activeHpBuddyCount(c4Any, c4Mask);
    const hpBuddy = c0HpBuddy + c1HpBuddy + c2HpBuddy + c3HpBuddy + c4HpBuddy;
    const buddy = countBits3(c0Mask) + countBits3(c1Mask) + countBits3(c2Mask) + countBits3(c3Mask) + countBits3(c4Mask);
    let increasedHpBuddy = c0IncreasedTable[c0Mask];
    const c1IncreasedHp = c1IncreasedTable[c1Mask];
    if (c1IncreasedHp < increasedHpBuddy) increasedHpBuddy = c1IncreasedHp;
    const c2IncreasedHp = c2IncreasedTable[c2Mask];
    if (c2IncreasedHp < increasedHpBuddy) increasedHpBuddy = c2IncreasedHp;
    const c3IncreasedHp = c3IncreasedTable[c3Mask];
    if (c3IncreasedHp < increasedHpBuddy) increasedHpBuddy = c3IncreasedHp;
    const c4IncreasedHp = c4IncreasedTable[c4Mask];
    if (c4IncreasedHp < increasedHpBuddy) increasedHpBuddy = c4IncreasedHp;
    const noHpBuddy =
      (c0HpBuddy === 0 ? 1 : 0) +
      (c1HpBuddy === 0 ? 1 : 0) +
      (c2HpBuddy === 0 ? 1 : 0) +
      (c3HpBuddy === 0 ? 1 : 0) +
      (c4HpBuddy === 0 ? 1 : 0);
    const duoMask = resolveFixedFiveDuoMaskFromIds(
      c0Any.charaId as number,
      c1Any.charaId as number,
      c2Any.charaId as number,
      c3Any.charaId as number,
      c4Any.charaId as number,
      c0Any.duoId as number,
      c1Any.duoId as number,
      c2Any.duoId as number,
      c3Any.duoId as number,
      c4Any.duoId as number,
      c0Any.useM2Cached as boolean,
      c1Any.useM2Cached as boolean,
      c2Any.useM2Cached as boolean,
      c3Any.useM2Cached as boolean,
      c4Any.useM2Cached as boolean,
    );
    const duo =
      ((duoMask & 1) !== 0 ? 1 : 0) +
      ((duoMask & 2) !== 0 ? 1 : 0) +
      ((duoMask & 4) !== 0 ? 1 : 0) +
      ((duoMask & 8) !== 0 ? 1 : 0) +
      ((duoMask & 16) !== 0 ? 1 : 0);
    const c0DuoOffset = ((c0Any.magic2IsDuoBaseCached as boolean) === true || (duoMask & 1) !== 0) ? 8 : 0;
    const c1DuoOffset = ((c1Any.magic2IsDuoBaseCached as boolean) === true || (duoMask & 2) !== 0) ? 8 : 0;
    const c2DuoOffset = ((c2Any.magic2IsDuoBaseCached as boolean) === true || (duoMask & 4) !== 0) ? 8 : 0;
    const c3DuoOffset = ((c3Any.magic2IsDuoBaseCached as boolean) === true || (duoMask & 8) !== 0) ? 8 : 0;
    const c4DuoOffset = ((c4Any.magic2IsDuoBaseCached as boolean) === true || (duoMask & 16) !== 0) ? 8 : 0;
    const needsMinDamageTable = snapshot.attackNum < 10;
    const c0MinDamageTable = needsMinDamageTable ? ensurePrimaryDamageTop2MinByMask(c0, c0Any) : undefined;
    const c1MinDamageTable = needsMinDamageTable ? ensurePrimaryDamageTop2MinByMask(c1, c1Any) : undefined;
    const c2MinDamageTable = needsMinDamageTable ? ensurePrimaryDamageTop2MinByMask(c2, c2Any) : undefined;
    const c3MinDamageTable = needsMinDamageTable ? ensurePrimaryDamageTop2MinByMask(c3, c3Any) : undefined;
    const c4MinDamageTable = needsMinDamageTable ? ensurePrimaryDamageTop2MinByMask(c4, c4Any) : undefined;
    const metricValue = (metric: number): [number, number[]] => {
      const offset = getDamageMetricTableIndex(metric) << 4;
      const c0Index = offset + c0DuoOffset + c0Mask;
      const c1Index = offset + c1DuoOffset + c1Mask;
      const c2Index = offset + c2DuoOffset + c2Mask;
      const c3Index = offset + c3DuoOffset + c3Mask;
      const c4Index = offset + c4DuoOffset + c4Mask;
      const d0 = c0DamageTable[c0Index];
      const d1 = c1DamageTable[c1Index];
      const d2 = c2DamageTable[c2Index];
      const d3 = c3DamageTable[c3Index];
      const d4 = c4DamageTable[c4Index];
      let total = d0 + d1 + d2 + d3 + d4;
      if (snapshot.attackNum === 9) {
        total -= Math.min(
          c0MinDamageTable![c0Index],
          c1MinDamageTable![c1Index],
          c2MinDamageTable![c2Index],
          c3MinDamageTable![c3Index],
          c4MinDamageTable![c4Index],
        );
      } else if (snapshot.attackNum === 8) {
        let min1 = Infinity;
        let min2 = Infinity;
        let value = c0MinDamageTable![c0Index];
        if (value < min1) { min2 = min1; min1 = value; } else if (value < min2) { min2 = value; }
        value = d0 - c0MinDamageTable![c0Index];
        if (value < min1) { min2 = min1; min1 = value; } else if (value < min2) { min2 = value; }
        value = c1MinDamageTable![c1Index];
        if (value < min1) { min2 = min1; min1 = value; } else if (value < min2) { min2 = value; }
        value = d1 - c1MinDamageTable![c1Index];
        if (value < min1) { min2 = min1; min1 = value; } else if (value < min2) { min2 = value; }
        value = c2MinDamageTable![c2Index];
        if (value < min1) { min2 = min1; min1 = value; } else if (value < min2) { min2 = value; }
        value = d2 - c2MinDamageTable![c2Index];
        if (value < min1) { min2 = min1; min1 = value; } else if (value < min2) { min2 = value; }
        value = c3MinDamageTable![c3Index];
        if (value < min1) { min2 = min1; min1 = value; } else if (value < min2) { min2 = value; }
        value = d3 - c3MinDamageTable![c3Index];
        if (value < min1) { min2 = min1; min1 = value; } else if (value < min2) { min2 = value; }
        value = c4MinDamageTable![c4Index];
        if (value < min1) { min2 = min1; min1 = value; } else if (value < min2) { min2 = value; }
        value = d4 - c4MinDamageTable![c4Index];
        if (value < min1) { min2 = min1; min1 = value; } else if (value < min2) { min2 = value; }
        total -= min1 + min2;
      }
      return [Math.floor(total), [d0, d1, d2, d3, d4]];
    };
    const [referenceDamage, damageList] = metricValue(DAMAGE_METRIC_REFERENCE);
    const [referenceAdvantageDamage, advantageDamageList] = metricValue(DAMAGE_METRIC_ADVANTAGE);
    const [referenceVsHiDamage, hiDamageList] = metricValue(DAMAGE_METRIC_VS_HI);
    const [referenceVsMizuDamage, mizuDamageList] = metricValue(DAMAGE_METRIC_VS_MIZU);
    const [referenceVsKiDamage, kiDamageList] = metricValue(DAMAGE_METRIC_VS_KI);
    const evasion = c0.evasion + c1.evasion + c2.evasion + c3.evasion + c4.evasion;
    const buff =
      ((c0Any.totalBuffCached as number) ?? 0) +
      ((c1Any.totalBuffCached as number) ?? 0) +
      ((c2Any.totalBuffCached as number) ?? 0) +
      ((c3Any.totalBuffCached as number) ?? 0) +
      ((c4Any.totalBuffCached as number) ?? 0);
    const debuff =
      ((c0Any.totalDebuffCached as number) ?? 0) +
      ((c1Any.totalDebuffCached as number) ?? 0) +
      ((c2Any.totalDebuffCached as number) ?? 0) +
      ((c3Any.totalDebuffCached as number) ?? 0) +
      ((c4Any.totalDebuffCached as number) ?? 0);
    const cosmic =
      ((c0Any.magicCosmicCountCached as number) ?? 0) +
      ((c1Any.magicCosmicCountCached as number) ?? 0) +
      ((c2Any.magicCosmicCountCached as number) ?? 0) +
      ((c3Any.magicCosmicCountCached as number) ?? 0) +
      ((c4Any.magicCosmicCountCached as number) ?? 0);
    const fire =
      ((c0Any.magicFireCountCached as number) ?? 0) +
      ((c1Any.magicFireCountCached as number) ?? 0) +
      ((c2Any.magicFireCountCached as number) ?? 0) +
      ((c3Any.magicFireCountCached as number) ?? 0) +
      ((c4Any.magicFireCountCached as number) ?? 0);
    const water =
      ((c0Any.magicWaterCountCached as number) ?? 0) +
      ((c1Any.magicWaterCountCached as number) ?? 0) +
      ((c2Any.magicWaterCountCached as number) ?? 0) +
      ((c3Any.magicWaterCountCached as number) ?? 0) +
      ((c4Any.magicWaterCountCached as number) ?? 0);
    const flora =
      ((c0Any.magicFloraCountCached as number) ?? 0) +
      ((c1Any.magicFloraCountCached as number) ?? 0) +
      ((c2Any.magicFloraCountCached as number) ?? 0) +
      ((c3Any.magicFloraCountCached as number) ?? 0) +
      ((c4Any.magicFloraCountCached as number) ?? 0);
    const healNum =
      ((c0Any.healCardCountCached as number) ?? 0) +
      ((c1Any.healCardCountCached as number) ?? 0) +
      ((c2Any.healCardCountCached as number) ?? 0) +
      ((c3Any.healCardCountCached as number) ?? 0) +
      ((c4Any.healCardCountCached as number) ?? 0);
    if (
      hp < snapshot.minHP ||
      ehp < snapshot.minEHP ||
      hpBuddy < snapshot.minHPBuddy ||
      increasedHpBuddy < snapshot.minIncreasedHPBuddy ||
      evasion < snapshot.minEvasion ||
      duo < snapshot.minDuo ||
      buff < snapshot.minBuff ||
      debuff < snapshot.minDebuff ||
      cosmic < snapshot.minCosmic ||
      fire < snapshot.minFire ||
      water < snapshot.minWater ||
      flora < snapshot.minFlora ||
      healNum < snapshot.minHealNum ||
      referenceDamage < snapshot.minReferenceDamage ||
      referenceAdvantageDamage < snapshot.minReferenceAdvantageDamage ||
      referenceVsHiDamage < snapshot.minReferenceVsHiDamage ||
      referenceVsMizuDamage < snapshot.minReferenceVsMizuDamage ||
      referenceVsKiDamage < snapshot.minReferenceVsKiDamage
    ) {
      return undefined;
    }
    const encoded0 = c0Any.encodedName ?? (c0Any.encodedName = encodeURIComponent(c0.name));
    const encoded1 = c1Any.encodedName ?? (c1Any.encodedName = encodeURIComponent(c1.name));
    const encoded2 = c2Any.encodedName ?? (c2Any.encodedName = encodeURIComponent(c2.name));
    const encoded3 = c3Any.encodedName ?? (c3Any.encodedName = encodeURIComponent(c3.name));
    const encoded4 = c4Any.encodedName ?? (c4Any.encodedName = encodeURIComponent(c4.name));
    const simuURL =
      '&name1=' + encoded0 + '&level1=' + c0.level +
      '&name2=' + encoded1 + '&level2=' + c1.level +
      '&name3=' + encoded2 + '&level3=' + c2.level +
      '&name4=' + encoded3 + '&level4=' + c3.level +
      '&name5=' + encoded4 + '&level5=' + c4.level;
    return [
      hp,
      ehp,
      evasion,
      hpBuddy,
      Math.floor(increasedHpBuddy),
      buddy,
      noHpBuddy,
      duo,
      buff,
      debuff,
      cosmic,
      fire,
      water,
      flora,
      referenceDamage,
      referenceAdvantageDamage,
      referenceVsHiDamage,
      referenceVsMizuDamage,
      referenceVsKiDamage,
      healNum,
      simuURL,
      [[h0, h1, h2, h3, h4], damageList, advantageDamageList, hiDamageList, mizuDamageList, kiDamageList],
    ];
  };
  const finalizeTopDecksForRender = (topDecks: DeckResult[]) => {
    // 二段階評価:
    // 1st pass ではソートに必要な最小指標だけ計算して高速に絞る
    // 2nd pass では「画面に出る上位N件のみ」detail/simuURL を生成する
    // これにより出力品質を維持したまま総計算量を削減する。
    for (let i = 0; i < topDecks.length; i++) {
      const target = topDecks[i];
      const targetAny = target as any;
      if (targetAny._detailReady === true) continue;
      const c0 = targetAny._combo0 as Character | undefined;
      if (!c0) continue;
      const combo = detailFinalizeCombinationScratch!;
      copyLegacyOutputCombination(
        c0,
        targetAny._combo1 as Character,
        targetAny._combo2 as Character,
        targetAny._combo3 as Character,
        targetAny._combo4 as Character,
        targetAny._supportSlot === true,
        combo,
      );
      const detailRet = buildFastDetailRetForFixedFive(combo) ?? calcDeckStatus(
        combo,
        detailPassOptions
      );
      if (!detailRet) continue;
      const detailRetArray = detailRet as (string | number)[];
      const detailLen = detailRetArray.length;
      fillDeckResultFromArray(detailRetArray, target);
      target.simuURL = detailRetArray[detailLen - 2] as string;
      target.detailList = detailRetArray[detailLen - 1];
      target.chara1 = combo[0].imgUrl;
      target.chara2 = combo[1].imgUrl;
      target.chara3 = combo[2].imgUrl;
      target.chara4 = combo[3].imgUrl;
      target.chara5 = combo[4].imgUrl;
      targetAny._detailRet = detailRetArray;
      targetAny._detailSimuURL = detailRetArray[detailLen - 2] as string;
      targetAny._detailList = detailRetArray[detailLen - 1];
      targetAny._detailChara1 = combo[0].imgUrl;
      targetAny._detailChara2 = combo[1].imgUrl;
      targetAny._detailChara3 = combo[2].imgUrl;
      targetAny._detailChara4 = combo[3].imgUrl;
      targetAny._detailChara5 = combo[4].imgUrl;
      targetAny._detailReady = true;
      // 1度詳細化した deck は再計算対象から除外
      // （中間レンダリングが複数回走っても、同一 deck の詳細を使い回す）
      targetAny._combo0 = undefined;
      targetAny._combo1 = undefined;
      targetAny._combo2 = undefined;
      targetAny._combo3 = undefined;
      targetAny._combo4 = undefined;
      targetAny._supportSlot = undefined;
    }
  };
  const buildDisplayDecks = (topDecks: DeckResult[]): DeckResult[] => {
    if (metricPrimaryFastEntries) {
      return topDecks;
    }
    const displayDecks = new Array<DeckResult>(topDecks.length);
    for (let i = 0; i < topDecks.length; i++) {
      const source = topDecks[i];
      const sourceAny = source as any;
      const display = ({ ...source } as DeckResult);
      if (sourceAny._detailReady === true) {
        const detailRet = sourceAny._detailRet as (string | number)[] | undefined;
        if (detailRet) {
          fillDeckResultFromArray(detailRet, display);
        }
        display.simuURL = (sourceAny._detailSimuURL as string | undefined) ?? source.simuURL;
        display.detailList = sourceAny._detailList ?? source.detailList;
        display.chara1 = (sourceAny._detailChara1 as string | undefined) ?? source.chara1;
        display.chara2 = (sourceAny._detailChara2 as string | undefined) ?? source.chara2;
        display.chara3 = (sourceAny._detailChara3 as string | undefined) ?? source.chara3;
        display.chara4 = (sourceAny._detailChara4 as string | undefined) ?? source.chara4;
        display.chara5 = (sourceAny._detailChara5 as string | undefined) ?? source.chara5;
      }
      displayDecks[i] = display;
    }
    return displayDecks;
  };
  const processCombinationCore = (currentCombination: Character[], supportSlot = false) => {
    const evaluationCombination = primaryEvaluateCombinationScratch;
    copyLegacyOutputCombination(
      currentCombination[0],
      currentCombination[1],
      currentCombination[2],
      currentCombination[3],
      currentCombination[4],
      supportSlot,
      evaluationCombination,
    );
    if (shouldUsePrimaryUpperBound) {
      const c0Any = evaluationCombination[0] as any;
      const c1Any = evaluationCombination[1] as any;
      const c2Any = evaluationCombination[2] as any;
      const c3Any = evaluationCombination[3] as any;
      const c4Any = evaluationCombination[4] as any;
      const presenceLow = (
        (c0Any.charaBitLowCached as number) |
        (c1Any.charaBitLowCached as number) |
        (c2Any.charaBitLowCached as number) |
        (c3Any.charaBitLowCached as number) |
        (c4Any.charaBitLowCached as number)
      ) >>> 0;
      const presenceHigh = (
        (c0Any.charaBitHighCached as number) |
        (c1Any.charaBitHighCached as number) |
        (c2Any.charaBitHighCached as number) |
        (c3Any.charaBitHighCached as number) |
        (c4Any.charaBitHighCached as number)
      ) >>> 0;
      const upperScore =
        calculatePresenceAwareDamageUpperTop2(evaluationCombination[0], primaryDamageUpperMetric, presenceLow, presenceHigh) +
        calculatePresenceAwareDamageUpperTop2(evaluationCombination[1], primaryDamageUpperMetric, presenceLow, presenceHigh) +
        calculatePresenceAwareDamageUpperTop2(evaluationCombination[2], primaryDamageUpperMetric, presenceLow, presenceHigh) +
        calculatePresenceAwareDamageUpperTop2(evaluationCombination[3], primaryDamageUpperMetric, presenceLow, presenceHigh) +
        calculatePresenceAwareDamageUpperTop2(evaluationCombination[4], primaryDamageUpperMetric, presenceLow, presenceHigh);
      if (!resultsManager.shouldConsider(upperScore)) {
        nowResultsCount += 1;
        return;
      }
    }
    // まず軽量計算で「上位Nに入る可能性」を判定し、
    // 可能性がある候補だけを resultsManager に投入する。
    const ret: (string | number)[] | undefined = calcDeckStatus(
      evaluationCombination,
      primaryPassOptions
    );
    if (ret) {
      const primaryScore = ret[primarySortRetIndex] as number;
      if (!resultsManager.shouldConsider(primaryScore)) {
        nowResultsCount += 1;
        return;
      }
      const transformedRet = ({ simuURL: '', detailList: emptyDetailList } as DeckResult);
      fillDeckResultSortValues(ret, transformedRet);
      const transformedRetAny = transformedRet as any;
      transformedRetAny._deckKey =
        evaluationCombination[0].name + '|' +
        evaluationCombination[1].name + '|' +
        evaluationCombination[2].name + '|' +
        evaluationCombination[3].name + '|' +
        evaluationCombination[4].name;

      const added = resultsManager.addDeck(transformedRet);
      if (added) {
        transformedRetAny._combo0 = evaluationCombination[0];
        transformedRetAny._combo1 = evaluationCombination[1];
        transformedRetAny._combo2 = evaluationCombination[2];
        transformedRetAny._combo3 = evaluationCombination[3];
        transformedRetAny._combo4 = evaluationCombination[4];
        if (supportSlot) transformedRetAny._supportSlot = true;
      }
    }
    nowResultsCount += 1;
  };
  const processHpPrimaryCombinationCore = (currentCombination: Character[], supportSlot = false) => {
    const c0 = currentCombination[0];
    const c1 = currentCombination[1];
    const c2 = currentCombination[2];
    const c3 = currentCombination[3];
    const c4 = currentCombination[4];
    const c0Any = c0 as any;
    const c1Any = c1 as any;
    const c2Any = c2 as any;
    const c3Any = c3 as any;
    const c4Any = c4 as any;
    const presenceLow = (
      (c0Any.charaBitLowCached as number) |
      (c1Any.charaBitLowCached as number) |
      (c2Any.charaBitLowCached as number) |
      (c3Any.charaBitLowCached as number) |
      (c4Any.charaBitLowCached as number)
    ) >>> 0;
    const presenceHigh = (
      (c0Any.charaBitHighCached as number) |
      (c1Any.charaBitHighCached as number) |
      (c2Any.charaBitHighCached as number) |
      (c3Any.charaBitHighCached as number) |
      (c4Any.charaBitHighCached as number)
    ) >>> 0;
    const c0Mask = getActiveBuddyMaskFromPresence(c0Any, presenceLow, presenceHigh);
    const c1Mask = getActiveBuddyMaskFromPresence(c1Any, presenceLow, presenceHigh);
    const c2Mask = getActiveBuddyMaskFromPresence(c2Any, presenceLow, presenceHigh);
    const c3Mask = getActiveBuddyMaskFromPresence(c3Any, presenceLow, presenceHigh);
    const c4Mask = getActiveBuddyMaskFromPresence(c4Any, presenceLow, presenceHigh);
    const c0HpTable = c0Any.hpByBuddyMaskCached as Float64Array;
    const c1HpTable = c1Any.hpByBuddyMaskCached as Float64Array;
    const c2HpTable = c2Any.hpByBuddyMaskCached as Float64Array;
    const c3HpTable = c3Any.hpByBuddyMaskCached as Float64Array;
    const c4HpTable = c4Any.hpByBuddyMaskCached as Float64Array;
    const hp =
      c0HpTable[c0Mask] +
      c1HpTable[c1Mask] +
      c2HpTable[c2Mask] +
      c3HpTable[c3Mask] +
      c4HpTable[c4Mask];
    if (hp < snapshot.minHP) {
      nowResultsCount += 1;
      return;
    }
    const c0HealTable = c0Any.healByBuddyMaskCached as Float64Array;
    const c1HealTable = c1Any.healByBuddyMaskCached as Float64Array;
    const c2HealTable = c2Any.healByBuddyMaskCached as Float64Array;
    const c3HealTable = c3Any.healByBuddyMaskCached as Float64Array;
    const c4HealTable = c4Any.healByBuddyMaskCached as Float64Array;
    const ehp =
      hp +
      c0HealTable[c0Mask] +
      c1HealTable[c1Mask] +
      c2HealTable[c2Mask] +
      c3HealTable[c3Mask] +
      c4HealTable[c4Mask];
    if (ehp < snapshot.minEHP) {
      nowResultsCount += 1;
      return;
    }
    const primaryScore = hpPrimaryUsesEhp ? ehp : hp;
    if (!resultsManager.shouldConsider(primaryScore)) {
      nowResultsCount += 1;
      return;
    }
    addMetricPrimaryFastDeck(primaryScore, ehp, c0, c1, c2, c3, c4, supportSlot);
    nowResultsCount += 1;
  };
  const processIncreasedHpBuddyPrimaryCombinationCore = (currentCombination: Character[], supportSlot = false) => {
    const c0 = currentCombination[0];
    const c1 = currentCombination[1];
    const c2 = currentCombination[2];
    const c3 = currentCombination[3];
    const c4 = currentCombination[4];
    const c0Any = c0 as any;
    const c1Any = c1 as any;
    const c2Any = c2 as any;
    const c3Any = c3 as any;
    const c4Any = c4 as any;
    const presenceLow = (
      (c0Any.charaBitLowCached as number) |
      (c1Any.charaBitLowCached as number) |
      (c2Any.charaBitLowCached as number) |
      (c3Any.charaBitLowCached as number) |
      (c4Any.charaBitLowCached as number)
    ) >>> 0;
    const presenceHigh = (
      (c0Any.charaBitHighCached as number) |
      (c1Any.charaBitHighCached as number) |
      (c2Any.charaBitHighCached as number) |
      (c3Any.charaBitHighCached as number) |
      (c4Any.charaBitHighCached as number)
    ) >>> 0;
    const c0Mask = getActiveBuddyMaskFromPresence(c0Any, presenceLow, presenceHigh);
    const c1Mask = getActiveBuddyMaskFromPresence(c1Any, presenceLow, presenceHigh);
    const c2Mask = getActiveBuddyMaskFromPresence(c2Any, presenceLow, presenceHigh);
    const c3Mask = getActiveBuddyMaskFromPresence(c3Any, presenceLow, presenceHigh);
    const c4Mask = getActiveBuddyMaskFromPresence(c4Any, presenceLow, presenceHigh);
    const c0IncreasedTable = c0Any.increasedHpByBuddyMaskCached as Float64Array;
    const c1IncreasedTable = c1Any.increasedHpByBuddyMaskCached as Float64Array;
    const c2IncreasedTable = c2Any.increasedHpByBuddyMaskCached as Float64Array;
    const c3IncreasedTable = c3Any.increasedHpByBuddyMaskCached as Float64Array;
    const c4IncreasedTable = c4Any.increasedHpByBuddyMaskCached as Float64Array;
    let increasedHpBuddy = c0IncreasedTable[c0Mask];
    const c1IncreasedHp = c1IncreasedTable[c1Mask];
    if (c1IncreasedHp < increasedHpBuddy) increasedHpBuddy = c1IncreasedHp;
    const c2IncreasedHp = c2IncreasedTable[c2Mask];
    if (c2IncreasedHp < increasedHpBuddy) increasedHpBuddy = c2IncreasedHp;
    const c3IncreasedHp = c3IncreasedTable[c3Mask];
    if (c3IncreasedHp < increasedHpBuddy) increasedHpBuddy = c3IncreasedHp;
    const c4IncreasedHp = c4IncreasedTable[c4Mask];
    if (c4IncreasedHp < increasedHpBuddy) increasedHpBuddy = c4IncreasedHp;
    const primaryScore = Math.floor(increasedHpBuddy);
    if (primaryScore < snapshot.minIncreasedHPBuddy || !resultsManager.shouldConsider(primaryScore)) {
      nowResultsCount += 1;
      return;
    }

    const c0HpTable = c0Any.hpByBuddyMaskCached as Float64Array;
    const c1HpTable = c1Any.hpByBuddyMaskCached as Float64Array;
    const c2HpTable = c2Any.hpByBuddyMaskCached as Float64Array;
    const c3HpTable = c3Any.hpByBuddyMaskCached as Float64Array;
    const c4HpTable = c4Any.hpByBuddyMaskCached as Float64Array;
    const hp =
      c0HpTable[c0Mask] +
      c1HpTable[c1Mask] +
      c2HpTable[c2Mask] +
      c3HpTable[c3Mask] +
      c4HpTable[c4Mask];
    if (hp < snapshot.minHP) {
      nowResultsCount += 1;
      return;
    }
    const c0HealTable = c0Any.healByBuddyMaskCached as Float64Array;
    const c1HealTable = c1Any.healByBuddyMaskCached as Float64Array;
    const c2HealTable = c2Any.healByBuddyMaskCached as Float64Array;
    const c3HealTable = c3Any.healByBuddyMaskCached as Float64Array;
    const c4HealTable = c4Any.healByBuddyMaskCached as Float64Array;
    const ehp =
      hp +
      c0HealTable[c0Mask] +
      c1HealTable[c1Mask] +
      c2HealTable[c2Mask] +
      c3HealTable[c3Mask] +
      c4HealTable[c4Mask];
    if (ehp < snapshot.minEHP) {
      nowResultsCount += 1;
      return;
    }

    addMetricPrimaryFastDeck(primaryScore, ehp, c0, c1, c2, c3, c4, supportSlot);
    nowResultsCount += 1;
  };

  const processDamagePrimaryCombinationCore = (currentCombination: Character[], supportSlot = false) => {
    const c0 = currentCombination[0];
    const c1 = currentCombination[1];
    const c2 = currentCombination[2];
    const c3 = currentCombination[3];
    const c4 = currentCombination[4];
    const c0Any = c0 as any;
    const c1Any = c1 as any;
    const c2Any = c2 as any;
    const c3Any = c3 as any;
    const c4Any = c4 as any;
    const presenceLow = (
      (c0Any.charaBitLowCached as number) |
      (c1Any.charaBitLowCached as number) |
      (c2Any.charaBitLowCached as number) |
      (c3Any.charaBitLowCached as number) |
      (c4Any.charaBitLowCached as number)
    ) >>> 0;
    const presenceHigh = (
      (c0Any.charaBitHighCached as number) |
      (c1Any.charaBitHighCached as number) |
      (c2Any.charaBitHighCached as number) |
      (c3Any.charaBitHighCached as number) |
      (c4Any.charaBitHighCached as number)
    ) >>> 0;

    if (
      c0.evasion + c1.evasion + c2.evasion + c3.evasion + c4.evasion < snapshot.minEvasion ||
      ((c0Any.totalBuffCached as number) ?? 0) +
        ((c1Any.totalBuffCached as number) ?? 0) +
        ((c2Any.totalBuffCached as number) ?? 0) +
        ((c3Any.totalBuffCached as number) ?? 0) +
        ((c4Any.totalBuffCached as number) ?? 0) < snapshot.minBuff ||
      ((c0Any.totalDebuffCached as number) ?? 0) +
        ((c1Any.totalDebuffCached as number) ?? 0) +
        ((c2Any.totalDebuffCached as number) ?? 0) +
        ((c3Any.totalDebuffCached as number) ?? 0) +
        ((c4Any.totalDebuffCached as number) ?? 0) < snapshot.minDebuff ||
      ((c0Any.magicCosmicCountCached as number) ?? 0) +
        ((c1Any.magicCosmicCountCached as number) ?? 0) +
        ((c2Any.magicCosmicCountCached as number) ?? 0) +
        ((c3Any.magicCosmicCountCached as number) ?? 0) +
        ((c4Any.magicCosmicCountCached as number) ?? 0) < snapshot.minCosmic ||
      ((c0Any.magicFireCountCached as number) ?? 0) +
        ((c1Any.magicFireCountCached as number) ?? 0) +
        ((c2Any.magicFireCountCached as number) ?? 0) +
        ((c3Any.magicFireCountCached as number) ?? 0) +
        ((c4Any.magicFireCountCached as number) ?? 0) < snapshot.minFire ||
      ((c0Any.magicWaterCountCached as number) ?? 0) +
        ((c1Any.magicWaterCountCached as number) ?? 0) +
        ((c2Any.magicWaterCountCached as number) ?? 0) +
        ((c3Any.magicWaterCountCached as number) ?? 0) +
        ((c4Any.magicWaterCountCached as number) ?? 0) < snapshot.minWater ||
      ((c0Any.magicFloraCountCached as number) ?? 0) +
        ((c1Any.magicFloraCountCached as number) ?? 0) +
        ((c2Any.magicFloraCountCached as number) ?? 0) +
        ((c3Any.magicFloraCountCached as number) ?? 0) +
        ((c4Any.magicFloraCountCached as number) ?? 0) < snapshot.minFlora ||
      ((c0Any.healCardCountCached as number) ?? 0) +
        ((c1Any.healCardCountCached as number) ?? 0) +
        ((c2Any.healCardCountCached as number) ?? 0) +
        ((c3Any.healCardCountCached as number) ?? 0) +
        ((c4Any.healCardCountCached as number) ?? 0) < snapshot.minHealNum
    ) {
      nowResultsCount += 1;
      return;
    }

    if (!fixedFiveHpThresholdsPass(currentCombination, presenceLow, presenceHigh, snapshot.minHP, snapshot.minEHP)) {
      nowResultsCount += 1;
      return;
    }

    const evaluationCombination = primaryEvaluateCombinationScratch;
    copyLegacyOutputCombination(c0, c1, c2, c3, c4, supportSlot, evaluationCombination);
    const primaryScore = calculatePrimaryDamageForFixedFiveWithPresence(
      evaluationCombination,
      primaryDamageUpperMetric,
      presenceLow,
      presenceHigh,
    );
    if (!metricPrimaryShouldConsider(primaryScore)) {
      nowResultsCount += 1;
      return;
    }

    if (metricPrimaryFastEntries) {
      addMetricPrimaryFastEntry(
        primaryScore,
        0,
        evaluationCombination[0],
        evaluationCombination[1],
        evaluationCombination[2],
        evaluationCombination[3],
        evaluationCombination[4],
        supportSlot,
      );
      nowResultsCount += 1;
      return;
    }

    const transformedRet = ({ simuURL: '', detailList: emptyDetailList } as DeckResult);
    const transformedRetAny = transformedRet as any;
    transformedRetAny[sortCompareKeys[0]] = primaryScore;
    transformedRetAny._deckKey =
      evaluationCombination[0].name + '|' +
      evaluationCombination[1].name + '|' +
      evaluationCombination[2].name + '|' +
      evaluationCombination[3].name + '|' +
      evaluationCombination[4].name;
    const added = resultsManager.addDeck(transformedRet);
    if (added) {
      transformedRetAny._combo0 = evaluationCombination[0];
      transformedRetAny._combo1 = evaluationCombination[1];
      transformedRetAny._combo2 = evaluationCombination[2];
      transformedRetAny._combo3 = evaluationCombination[3];
      transformedRetAny._combo4 = evaluationCombination[4];
      if (supportSlot) transformedRetAny._supportSlot = true;
    }
    nowResultsCount += 1;
  };

  const damagePrimaryMetricOffsetForFastSupport = getDamageMetricTableIndex(primaryDamageUpperMetric) << 4;
  const processDamagePrimarySupportCombinationByIndex = (
    i: number,
    j: number,
    k: number,
    l: number,
    m: number,
  ) => {
    if (
      !fastPairBuddyMasks ||
      !fastThresholdDamageTables ||
      !fastIds ||
      !fastDuoIds ||
      !fastUseM2 ||
      !fastDuoBaseOffsets ||
      !fastHpTables ||
      !fastHealTables ||
      !supportFastIds ||
      !supportFastDuoIds ||
      !supportFastUseM2 ||
      !supportFastDuoBaseOffsets ||
      !supportFastHpTables ||
      !supportFastHealTables ||
      !supportFastDamageTables ||
      !fastNormalToSupportBuddyMasks ||
      !fastSupportToNormalBuddyMasks ||
      !fastSupportSelfBuddyMasks
    ) {
      combination[0] = nonZero[i];
      combination[1] = nonZero[j];
      combination[2] = nonZero[k];
      combination[3] = nonZero[l];
      combination[4] = maxLevel[m];
      processDamagePrimaryCombinationCore(combination, true);
      return;
    }

    const c0 = nonZero[i];
    const c1 = nonZero[j];
    const c2 = nonZero[k];
    const c3 = nonZero[l];
    const c4 = maxLevel[m];
    const c0Any = c0 as any;
    const c1Any = c1 as any;
    const c2Any = c2 as any;
    const c3Any = c3 as any;
    const c4Any = c4 as any;
    if (
      c0.evasion + c1.evasion + c2.evasion + c3.evasion + c4.evasion < snapshot.minEvasion ||
      ((c0Any.totalBuffCached as number) ?? 0) +
        ((c1Any.totalBuffCached as number) ?? 0) +
        ((c2Any.totalBuffCached as number) ?? 0) +
        ((c3Any.totalBuffCached as number) ?? 0) +
        ((c4Any.totalBuffCached as number) ?? 0) < snapshot.minBuff ||
      ((c0Any.totalDebuffCached as number) ?? 0) +
        ((c1Any.totalDebuffCached as number) ?? 0) +
        ((c2Any.totalDebuffCached as number) ?? 0) +
        ((c3Any.totalDebuffCached as number) ?? 0) +
        ((c4Any.totalDebuffCached as number) ?? 0) < snapshot.minDebuff ||
      ((c0Any.magicCosmicCountCached as number) ?? 0) +
        ((c1Any.magicCosmicCountCached as number) ?? 0) +
        ((c2Any.magicCosmicCountCached as number) ?? 0) +
        ((c3Any.magicCosmicCountCached as number) ?? 0) +
        ((c4Any.magicCosmicCountCached as number) ?? 0) < snapshot.minCosmic ||
      ((c0Any.magicFireCountCached as number) ?? 0) +
        ((c1Any.magicFireCountCached as number) ?? 0) +
        ((c2Any.magicFireCountCached as number) ?? 0) +
        ((c3Any.magicFireCountCached as number) ?? 0) +
        ((c4Any.magicFireCountCached as number) ?? 0) < snapshot.minFire ||
      ((c0Any.magicWaterCountCached as number) ?? 0) +
        ((c1Any.magicWaterCountCached as number) ?? 0) +
        ((c2Any.magicWaterCountCached as number) ?? 0) +
        ((c3Any.magicWaterCountCached as number) ?? 0) +
        ((c4Any.magicWaterCountCached as number) ?? 0) < snapshot.minWater ||
      ((c0Any.magicFloraCountCached as number) ?? 0) +
        ((c1Any.magicFloraCountCached as number) ?? 0) +
        ((c2Any.magicFloraCountCached as number) ?? 0) +
        ((c3Any.magicFloraCountCached as number) ?? 0) +
        ((c4Any.magicFloraCountCached as number) ?? 0) < snapshot.minFlora ||
      ((c0Any.healCardCountCached as number) ?? 0) +
        ((c1Any.healCardCountCached as number) ?? 0) +
        ((c2Any.healCardCountCached as number) ?? 0) +
        ((c3Any.healCardCountCached as number) ?? 0) +
        ((c4Any.healCardCountCached as number) ?? 0) < snapshot.minHealNum
    ) {
      nowResultsCount += 1;
      return;
    }

    const pairMasks = fastPairBuddyMasks;
    const supportLength = maxLevel.length;
    const iRow = i * listLength;
    const jRow = j * listLength;
    const kRow = k * listLength;
    const lRow = l * listLength;
    const supportRow = m * listLength;
    const iMask =
      pairMasks[iRow + i] |
      pairMasks[iRow + j] |
      pairMasks[iRow + k] |
      pairMasks[iRow + l] |
      fastNormalToSupportBuddyMasks[i * supportLength + m];
    const jMask =
      pairMasks[jRow + i] |
      pairMasks[jRow + j] |
      pairMasks[jRow + k] |
      pairMasks[jRow + l] |
      fastNormalToSupportBuddyMasks[j * supportLength + m];
    const kMask =
      pairMasks[kRow + i] |
      pairMasks[kRow + j] |
      pairMasks[kRow + k] |
      pairMasks[kRow + l] |
      fastNormalToSupportBuddyMasks[k * supportLength + m];
    const lMask =
      pairMasks[lRow + i] |
      pairMasks[lRow + j] |
      pairMasks[lRow + k] |
      pairMasks[lRow + l] |
      fastNormalToSupportBuddyMasks[l * supportLength + m];
    const supportMask =
      fastSupportToNormalBuddyMasks[supportRow + i] |
      fastSupportToNormalBuddyMasks[supportRow + j] |
      fastSupportToNormalBuddyMasks[supportRow + k] |
      fastSupportToNormalBuddyMasks[supportRow + l] |
      fastSupportSelfBuddyMasks[m];

    const hp =
      fastHpTables[i][iMask] +
      fastHpTables[j][jMask] +
      fastHpTables[k][kMask] +
      fastHpTables[l][lMask] +
      supportFastHpTables[m][supportMask];
    if (hp < snapshot.minHP) {
      nowResultsCount += 1;
      return;
    }
    if (
      snapshot.minEHP > 0 &&
      hp +
        fastHealTables[i][iMask] +
        fastHealTables[j][jMask] +
        fastHealTables[k][kMask] +
        fastHealTables[l][lMask] +
        supportFastHealTables[m][supportMask] < snapshot.minEHP
    ) {
      nowResultsCount += 1;
      return;
    }

    const duoMask = resolveFixedFiveDuoMaskFromIds(
      fastIds[i],
      fastIds[j],
      fastIds[k],
      fastIds[l],
      supportFastIds[m],
      fastDuoIds[i],
      fastDuoIds[j],
      fastDuoIds[k],
      fastDuoIds[l],
      supportFastDuoIds[m],
      fastUseM2[i] !== 0,
      fastUseM2[j] !== 0,
      fastUseM2[k] !== 0,
      fastUseM2[l] !== 0,
      supportFastUseM2[m] !== 0,
    );
    const metricOffset = damagePrimaryMetricOffsetForFastSupport;
    const primaryScore = Math.floor(
      fastThresholdDamageTables[i][metricOffset + ((fastDuoBaseOffsets[i] !== 0 || (duoMask & 1) !== 0) ? 8 : 0) + iMask] +
      fastThresholdDamageTables[j][metricOffset + ((fastDuoBaseOffsets[j] !== 0 || (duoMask & 2) !== 0) ? 8 : 0) + jMask] +
      fastThresholdDamageTables[k][metricOffset + ((fastDuoBaseOffsets[k] !== 0 || (duoMask & 4) !== 0) ? 8 : 0) + kMask] +
      fastThresholdDamageTables[l][metricOffset + ((fastDuoBaseOffsets[l] !== 0 || (duoMask & 8) !== 0) ? 8 : 0) + lMask] +
      supportFastDamageTables[m][metricOffset + ((supportFastDuoBaseOffsets[m] !== 0 || (duoMask & 16) !== 0) ? 8 : 0) + supportMask]
    );
    if (metricPrimaryShouldConsider(primaryScore)) {
      incrementDebugCounter('sameSupportDamageExactAdds');
      addMetricPrimaryFastEntry(primaryScore, 0, c0, c1, c2, c3, c4, true);
    }
    incrementDebugCounter('sameSupportDamageExactChecks');
    nowResultsCount += 1;
  };

  const processDamagePrimaryPreparedSupportCombination = (
    i: number,
    j: number,
    k: number,
    l: number,
    m: number,
    iBaseMask: number,
    jBaseMask: number,
    kBaseMask: number,
    lBaseMask: number,
    prefixEvasion: number,
    prefixBuff: number,
    prefixDebuff: number,
    prefixCosmic: number,
    prefixFire: number,
    prefixWater: number,
    prefixFlora: number,
    prefixHealNum: number,
  ) => {
    const support = maxLevel[m];
    const supportAny = support as any;
    if (
      prefixEvasion + support.evasion < snapshot.minEvasion ||
      prefixBuff + ((supportAny.totalBuffCached as number) ?? 0) < snapshot.minBuff ||
      prefixDebuff + ((supportAny.totalDebuffCached as number) ?? 0) < snapshot.minDebuff ||
      prefixCosmic + ((supportAny.magicCosmicCountCached as number) ?? 0) < snapshot.minCosmic ||
      prefixFire + ((supportAny.magicFireCountCached as number) ?? 0) < snapshot.minFire ||
      prefixWater + ((supportAny.magicWaterCountCached as number) ?? 0) < snapshot.minWater ||
      prefixFlora + ((supportAny.magicFloraCountCached as number) ?? 0) < snapshot.minFlora ||
      prefixHealNum + ((supportAny.healCardCountCached as number) ?? 0) < snapshot.minHealNum
    ) {
      nowResultsCount += 1;
      return;
    }

    const supportLength = maxLevel.length;
    const iMask = iBaseMask | fastNormalToSupportBuddyMasks![i * supportLength + m];
    const jMask = jBaseMask | fastNormalToSupportBuddyMasks![j * supportLength + m];
    const kMask = kBaseMask | fastNormalToSupportBuddyMasks![k * supportLength + m];
    const lMask = lBaseMask | fastNormalToSupportBuddyMasks![l * supportLength + m];
    const supportRow = m * listLength;
    const supportMask =
      fastSupportToNormalBuddyMasks![supportRow + i] |
      fastSupportToNormalBuddyMasks![supportRow + j] |
      fastSupportToNormalBuddyMasks![supportRow + k] |
      fastSupportToNormalBuddyMasks![supportRow + l] |
      fastSupportSelfBuddyMasks![m];

    const hp =
      fastHpTables![i][iMask] +
      fastHpTables![j][jMask] +
      fastHpTables![k][kMask] +
      fastHpTables![l][lMask] +
      supportFastHpTables![m][supportMask];
    if (hp < snapshot.minHP) {
      nowResultsCount += 1;
      return;
    }
    if (
      snapshot.minEHP > 0 &&
      hp +
        fastHealTables![i][iMask] +
        fastHealTables![j][jMask] +
        fastHealTables![k][kMask] +
        fastHealTables![l][lMask] +
        supportFastHealTables![m][supportMask] < snapshot.minEHP
    ) {
      nowResultsCount += 1;
      return;
    }

    const duoMask = resolveFixedFiveDuoMaskFromIds(
      fastIds![i],
      fastIds![j],
      fastIds![k],
      fastIds![l],
      supportFastIds![m],
      fastDuoIds![i],
      fastDuoIds![j],
      fastDuoIds![k],
      fastDuoIds![l],
      supportFastDuoIds![m],
      fastUseM2![i] !== 0,
      fastUseM2![j] !== 0,
      fastUseM2![k] !== 0,
      fastUseM2![l] !== 0,
      supportFastUseM2![m] !== 0,
    );
    const metricOffset = damagePrimaryMetricOffsetForFastSupport;
    const primaryScore = Math.floor(
      fastThresholdDamageTables![i][metricOffset + ((fastDuoBaseOffsets![i] !== 0 || (duoMask & 1) !== 0) ? 8 : 0) + iMask] +
      fastThresholdDamageTables![j][metricOffset + ((fastDuoBaseOffsets![j] !== 0 || (duoMask & 2) !== 0) ? 8 : 0) + jMask] +
      fastThresholdDamageTables![k][metricOffset + ((fastDuoBaseOffsets![k] !== 0 || (duoMask & 4) !== 0) ? 8 : 0) + kMask] +
      fastThresholdDamageTables![l][metricOffset + ((fastDuoBaseOffsets![l] !== 0 || (duoMask & 8) !== 0) ? 8 : 0) + lMask] +
      supportFastDamageTables![m][metricOffset + ((supportFastDuoBaseOffsets![m] !== 0 || (duoMask & 16) !== 0) ? 8 : 0) + supportMask]
    );
    if (metricPrimaryShouldConsider(primaryScore)) {
      addMetricPrimaryFastEntry(primaryScore, 0, nonZero[i], nonZero[j], nonZero[k], nonZero[l], support, true);
    }
    nowResultsCount += 1;
  };

  const preseedSameSupportDamagePrimaryThreshold = (lengthes: number[]) => {
    if (
      !canUseDamagePrimarySupportFastPath ||
      !metricPrimaryFastEntries ||
      metricPrimaryFastMaxSize <= 0 ||
      !nonZeroPrimaryUpperScores ||
      !maxLevelPrimaryUpperScores
    ) {
      return;
    }

    const normalPickCount = 4 - requiredCount;
    if (normalPickCount < 0) return;
    const remainingNormalCount = lengthes[3] - requiredCount;
    if (remainingNormalCount < normalPickCount || maxLevel.length <= 0) return;

    let seedNormalCount = Math.min(remainingNormalCount, Math.max(normalPickCount, 10));
    let seedSupportCount = Math.min(maxLevel.length, 2);
    while (
      (seedNormalCount < remainingNormalCount || seedSupportCount < maxLevel.length) &&
      combinationCount(seedNormalCount, normalPickCount) * seedSupportCount < metricPrimaryFastMaxSize
    ) {
      if (seedSupportCount < maxLevel.length) {
        seedSupportCount += 1;
      } else {
        seedNormalCount += 1;
      }
    }
    while (
      seedNormalCount < remainingNormalCount &&
      combinationCount(seedNormalCount + 1, normalPickCount) * seedSupportCount <= Math.max(800, metricPrimaryFastMaxSize * 4)
    ) {
      seedNormalCount += 1;
    }
    if (combinationCount(seedNormalCount, normalPickCount) * seedSupportCount < metricPrimaryFastMaxSize) return;

    const normalOrder = new Int32Array(remainingNormalCount);
    for (let index = 0; index < remainingNormalCount; index++) normalOrder[index] = requiredCount + index;
    normalOrder.sort((a, b) => {
      const diff = nonZeroPrimaryUpperScores[b] - nonZeroPrimaryUpperScores[a];
      if (diff !== 0) return diff;
      return a - b;
    });
    const supportOrder = new Int32Array(maxLevel.length);
    for (let index = 0; index < maxLevel.length; index++) supportOrder[index] = index;
    supportOrder.sort((a, b) => {
      const diff = maxLevelPrimaryUpperScores[b] - maxLevelPrimaryUpperScores[a];
      if (diff !== 0) return diff;
      return a - b;
    });

    const selectedNormals = new Int32Array(normalPickCount);
    const seedScores: number[] = [];
    const seedCombination = new Array<Character>(5);
    const evaluationCombination = primaryEvaluateCombinationScratch;
    let checked = 0;
    let valid = 0;
    const evaluateSeed = () => {
      let slot = 0;
      for (let index = 0; index < requiredCount; index++) {
        seedCombination[slot++] = nonZero[index];
      }
      for (let index = 0; index < normalPickCount; index++) {
        seedCombination[slot++] = nonZero[selectedNormals[index]];
      }
      const c0 = seedCombination[0];
      const c1 = seedCombination[1];
      const c2 = seedCombination[2];
      const c3 = seedCombination[3];
      const c0Any = c0 as any;
      const c1Any = c1 as any;
      const c2Any = c2 as any;
      const c3Any = c3 as any;
      for (let supportPos = 0; supportPos < seedSupportCount; supportPos++) {
        checked += 1;
        const support = maxLevel[supportOrder[supportPos]];
        const supportAny = support as any;
        if (
          c0.evasion + c1.evasion + c2.evasion + c3.evasion + support.evasion < snapshot.minEvasion ||
          ((c0Any.totalBuffCached as number) ?? 0) +
            ((c1Any.totalBuffCached as number) ?? 0) +
            ((c2Any.totalBuffCached as number) ?? 0) +
            ((c3Any.totalBuffCached as number) ?? 0) +
            ((supportAny.totalBuffCached as number) ?? 0) < snapshot.minBuff ||
          ((c0Any.totalDebuffCached as number) ?? 0) +
            ((c1Any.totalDebuffCached as number) ?? 0) +
            ((c2Any.totalDebuffCached as number) ?? 0) +
            ((c3Any.totalDebuffCached as number) ?? 0) +
            ((supportAny.totalDebuffCached as number) ?? 0) < snapshot.minDebuff ||
          ((c0Any.magicCosmicCountCached as number) ?? 0) +
            ((c1Any.magicCosmicCountCached as number) ?? 0) +
            ((c2Any.magicCosmicCountCached as number) ?? 0) +
            ((c3Any.magicCosmicCountCached as number) ?? 0) +
            ((supportAny.magicCosmicCountCached as number) ?? 0) < snapshot.minCosmic ||
          ((c0Any.magicFireCountCached as number) ?? 0) +
            ((c1Any.magicFireCountCached as number) ?? 0) +
            ((c2Any.magicFireCountCached as number) ?? 0) +
            ((c3Any.magicFireCountCached as number) ?? 0) +
            ((supportAny.magicFireCountCached as number) ?? 0) < snapshot.minFire ||
          ((c0Any.magicWaterCountCached as number) ?? 0) +
            ((c1Any.magicWaterCountCached as number) ?? 0) +
            ((c2Any.magicWaterCountCached as number) ?? 0) +
            ((c3Any.magicWaterCountCached as number) ?? 0) +
            ((supportAny.magicWaterCountCached as number) ?? 0) < snapshot.minWater ||
          ((c0Any.magicFloraCountCached as number) ?? 0) +
            ((c1Any.magicFloraCountCached as number) ?? 0) +
            ((c2Any.magicFloraCountCached as number) ?? 0) +
            ((c3Any.magicFloraCountCached as number) ?? 0) +
            ((supportAny.magicFloraCountCached as number) ?? 0) < snapshot.minFlora ||
          ((c0Any.healCardCountCached as number) ?? 0) +
            ((c1Any.healCardCountCached as number) ?? 0) +
            ((c2Any.healCardCountCached as number) ?? 0) +
            ((c3Any.healCardCountCached as number) ?? 0) +
            ((supportAny.healCardCountCached as number) ?? 0) < snapshot.minHealNum
        ) {
          continue;
        }
        seedCombination[4] = support;
        const presenceLow = (
          (c0Any.charaBitLowCached as number) |
          (c1Any.charaBitLowCached as number) |
          (c2Any.charaBitLowCached as number) |
          (c3Any.charaBitLowCached as number) |
          (supportAny.charaBitLowCached as number)
        ) >>> 0;
        const presenceHigh = (
          (c0Any.charaBitHighCached as number) |
          (c1Any.charaBitHighCached as number) |
          (c2Any.charaBitHighCached as number) |
          (c3Any.charaBitHighCached as number) |
          (supportAny.charaBitHighCached as number)
        ) >>> 0;
        if (!fixedFiveHpThresholdsPass(seedCombination, presenceLow, presenceHigh, snapshot.minHP, snapshot.minEHP)) {
          continue;
        }
        copyLegacyOutputCombination(c0, c1, c2, c3, support, true, evaluationCombination);
        seedScores.push(calculatePrimaryDamageForFixedFiveWithPresence(
          evaluationCombination,
          primaryDamageUpperMetric,
          presenceLow,
          presenceHigh,
        ));
        valid += 1;
      }
    };

    const chooseNormal = (depth: number, start: number) => {
      if (depth === normalPickCount) {
        evaluateSeed();
        return;
      }
      const remaining = normalPickCount - depth;
      for (let index = start; index <= seedNormalCount - remaining; index++) {
        selectedNormals[depth] = normalOrder[index];
        chooseNormal(depth + 1, index + 1);
      }
    };

    chooseNormal(0, 0);
    if (seedScores.length < metricPrimaryFastMaxSize) return;
    seedScores.sort((a, b) => b - a);
    metricPrimarySeedThresholdPrimary = seedScores[metricPrimaryFastMaxSize - 1];
    metricPrimarySeedThresholdSecondary = -Infinity;
    if (debugCounters) {
      debugCounters.sameSupportDamageSeedNormalCount = seedNormalCount;
      debugCounters.sameSupportDamageSeedSupportCount = seedSupportCount;
      debugCounters.sameSupportDamageSeedChecks = checked;
      debugCounters.sameSupportDamageSeedValid = valid;
      debugCounters.sameSupportDamageSeedThresholdPrimary = metricPrimarySeedThresholdPrimary;
    }
  };

  const hpThresholdCombinationScratch = new Array<Character>(5);
  const hpPrimaryThresholdsPass = (
    c0: Character,
    c1: Character,
    c2: Character,
    c3: Character,
    c4: Character,
    supportSlot = false,
  ): boolean => {
    const thresholdCombination = hpThresholdCombinationScratch;
    copyLegacyOutputCombination(c0, c1, c2, c3, c4, supportSlot, thresholdCombination);
    c0 = thresholdCombination[0];
    c1 = thresholdCombination[1];
    c2 = thresholdCombination[2];
    c3 = thresholdCombination[3];
    c4 = thresholdCombination[4];
    const c0Any = c0 as any;
    const c1Any = c1 as any;
    const c2Any = c2 as any;
    const c3Any = c3 as any;
    const c4Any = c4 as any;

    if (snapshot.minEvasion > 0 && c0.evasion + c1.evasion + c2.evasion + c3.evasion + c4.evasion < snapshot.minEvasion) return false;
    if (
      snapshot.minBuff > 0 &&
      ((c0Any.totalBuffCached as number) ?? 0) +
        ((c1Any.totalBuffCached as number) ?? 0) +
        ((c2Any.totalBuffCached as number) ?? 0) +
        ((c3Any.totalBuffCached as number) ?? 0) +
        ((c4Any.totalBuffCached as number) ?? 0) < snapshot.minBuff
    ) return false;
    if (
      snapshot.minDebuff > 0 &&
      ((c0Any.totalDebuffCached as number) ?? 0) +
        ((c1Any.totalDebuffCached as number) ?? 0) +
        ((c2Any.totalDebuffCached as number) ?? 0) +
        ((c3Any.totalDebuffCached as number) ?? 0) +
        ((c4Any.totalDebuffCached as number) ?? 0) < snapshot.minDebuff
    ) return false;
    if (
      snapshot.minCosmic > 0 &&
      ((c0Any.magicCosmicCountCached as number) ?? 0) +
        ((c1Any.magicCosmicCountCached as number) ?? 0) +
        ((c2Any.magicCosmicCountCached as number) ?? 0) +
        ((c3Any.magicCosmicCountCached as number) ?? 0) +
        ((c4Any.magicCosmicCountCached as number) ?? 0) < snapshot.minCosmic
    ) return false;
    if (
      snapshot.minFire > 0 &&
      ((c0Any.magicFireCountCached as number) ?? 0) +
        ((c1Any.magicFireCountCached as number) ?? 0) +
        ((c2Any.magicFireCountCached as number) ?? 0) +
        ((c3Any.magicFireCountCached as number) ?? 0) +
        ((c4Any.magicFireCountCached as number) ?? 0) < snapshot.minFire
    ) return false;
    if (
      snapshot.minWater > 0 &&
      ((c0Any.magicWaterCountCached as number) ?? 0) +
        ((c1Any.magicWaterCountCached as number) ?? 0) +
        ((c2Any.magicWaterCountCached as number) ?? 0) +
        ((c3Any.magicWaterCountCached as number) ?? 0) +
        ((c4Any.magicWaterCountCached as number) ?? 0) < snapshot.minWater
    ) return false;
    if (
      snapshot.minFlora > 0 &&
      ((c0Any.magicFloraCountCached as number) ?? 0) +
        ((c1Any.magicFloraCountCached as number) ?? 0) +
        ((c2Any.magicFloraCountCached as number) ?? 0) +
        ((c3Any.magicFloraCountCached as number) ?? 0) +
        ((c4Any.magicFloraCountCached as number) ?? 0) < snapshot.minFlora
    ) return false;
    if (
      snapshot.minHealNum > 0 &&
      ((c0Any.healCardCountCached as number) ?? 0) +
        ((c1Any.healCardCountCached as number) ?? 0) +
        ((c2Any.healCardCountCached as number) ?? 0) +
        ((c3Any.healCardCountCached as number) ?? 0) +
        ((c4Any.healCardCountCached as number) ?? 0) < snapshot.minHealNum
    ) return false;

    if (!hasDamageThreshold) return true;

    const presenceLow = (
      (c0Any.charaBitLowCached as number) |
      (c1Any.charaBitLowCached as number) |
      (c2Any.charaBitLowCached as number) |
      (c3Any.charaBitLowCached as number) |
      (c4Any.charaBitLowCached as number)
    ) >>> 0;
    const presenceHigh = (
      (c0Any.charaBitHighCached as number) |
      (c1Any.charaBitHighCached as number) |
      (c2Any.charaBitHighCached as number) |
      (c3Any.charaBitHighCached as number) |
      (c4Any.charaBitHighCached as number)
    ) >>> 0;
    if (snapshot.minReferenceDamage > 0) {
      const value = calculatePrimaryDamageTopNForFixedFiveWithPresence(
        thresholdCombination,
        DAMAGE_METRIC_REFERENCE,
        snapshot.attackNum,
        presenceLow,
        presenceHigh,
      );
      if (value === undefined) return calcDeckStatus(thresholdCombination, primaryPassOptions) !== undefined;
      if (value < snapshot.minReferenceDamage) return false;
    }
    if (snapshot.minReferenceAdvantageDamage > 0) {
      const value = calculatePrimaryDamageTopNForFixedFiveWithPresence(
        thresholdCombination,
        DAMAGE_METRIC_ADVANTAGE,
        snapshot.attackNum,
        presenceLow,
        presenceHigh,
      );
      if (value === undefined) return calcDeckStatus(thresholdCombination, primaryPassOptions) !== undefined;
      if (value < snapshot.minReferenceAdvantageDamage) return false;
    }
    if (snapshot.minReferenceVsHiDamage > 0) {
      const value = calculatePrimaryDamageTopNForFixedFiveWithPresence(
        thresholdCombination,
        DAMAGE_METRIC_VS_HI,
        snapshot.attackNum,
        presenceLow,
        presenceHigh,
      );
      if (value === undefined) return calcDeckStatus(thresholdCombination, primaryPassOptions) !== undefined;
      if (value < snapshot.minReferenceVsHiDamage) return false;
    }
    if (snapshot.minReferenceVsMizuDamage > 0) {
      const value = calculatePrimaryDamageTopNForFixedFiveWithPresence(
        thresholdCombination,
        DAMAGE_METRIC_VS_MIZU,
        snapshot.attackNum,
        presenceLow,
        presenceHigh,
      );
      if (value === undefined) return calcDeckStatus(thresholdCombination, primaryPassOptions) !== undefined;
      if (value < snapshot.minReferenceVsMizuDamage) return false;
    }
    if (snapshot.minReferenceVsKiDamage > 0) {
      const value = calculatePrimaryDamageTopNForFixedFiveWithPresence(
        thresholdCombination,
        DAMAGE_METRIC_VS_KI,
        snapshot.attackNum,
        presenceLow,
        presenceHigh,
      );
      if (value === undefined) return calcDeckStatus(thresholdCombination, primaryPassOptions) !== undefined;
      if (value < snapshot.minReferenceVsKiDamage) return false;
    }
    return true;
  };

  const hpThresholdDamageMetricOffsets: number[] = [];
  const hpThresholdDamageMinimums: number[] = [];
  if (canUseHpPrimaryThresholdFastPath && hasDamageThreshold) {
    if (snapshot.minReferenceDamage > 0) {
      hpThresholdDamageMetricOffsets.push(getDamageMetricTableIndex(DAMAGE_METRIC_REFERENCE) << 4);
      hpThresholdDamageMinimums.push(snapshot.minReferenceDamage);
    }
    if (snapshot.minReferenceAdvantageDamage > 0) {
      hpThresholdDamageMetricOffsets.push(getDamageMetricTableIndex(DAMAGE_METRIC_ADVANTAGE) << 4);
      hpThresholdDamageMinimums.push(snapshot.minReferenceAdvantageDamage);
    }
    if (snapshot.minReferenceVsHiDamage > 0) {
      hpThresholdDamageMetricOffsets.push(getDamageMetricTableIndex(DAMAGE_METRIC_VS_HI) << 4);
      hpThresholdDamageMinimums.push(snapshot.minReferenceVsHiDamage);
    }
    if (snapshot.minReferenceVsMizuDamage > 0) {
      hpThresholdDamageMetricOffsets.push(getDamageMetricTableIndex(DAMAGE_METRIC_VS_MIZU) << 4);
      hpThresholdDamageMinimums.push(snapshot.minReferenceVsMizuDamage);
    }
    if (snapshot.minReferenceVsKiDamage > 0) {
      hpThresholdDamageMetricOffsets.push(getDamageMetricTableIndex(DAMAGE_METRIC_VS_KI) << 4);
      hpThresholdDamageMinimums.push(snapshot.minReferenceVsKiDamage);
    }
  }
  const hpThresholdDamageMetricCount = hpThresholdDamageMetricOffsets.length;
  const canUseFastHpDamageThresholdExact = false;

  const usesHpPrimaryMetricFastLoop = canUseHpPrimaryFastPath || canUseHpPrimaryThresholdFastPath || canUseHpPrimarySupportFastPath;
  const usesMetricPrimaryFastLoop = usesHpPrimaryMetricFastLoop || canUseIncreasedHpBuddyPrimaryFastPath;
  const usesDamagePrimaryMetricFastLoop =
    canUseDamagePrimaryNoRequiredFastLoop ||
    canUseDamagePrimaryFixedTwoFastLoop ||
    canUseDamagePrimarySupportFastPath;
  const usesBasicDuoPrimaryMetricFastLoop = canUseBasicDuoPrimaryNoRequiredFastLoop;
  const usesBasicDuoExactCombinationFastPath = canUseBasicDuoPrimaryFastPath;
  const usesFastPairBuddyMasks =
    usesMetricPrimaryFastLoop ||
    canUseDamagePrimaryNoRequiredFastLoop ||
    canUseDamagePrimaryFixedTwoFastLoop ||
    (canUseDamagePrimarySupportFastPath && requiredCount === 2) ||
    usesBasicDuoPrimaryMetricFastLoop ||
    usesBasicDuoExactCombinationFastPath;
  const canUseHpPrimaryReachablePrune = canUseHpPrimaryFastPath;
  const canUseDamagePrimaryReachablePrune =
    canUseDamagePrimaryNoRequiredFastLoop ||
    canUseDamagePrimaryFixedTwoFastLoop;
  let damagePrimarySetupCacheKey = '';
  if (canUseDamagePrimaryReachablePrune) {
    let key = `${primaryDamageUpperMetric}|${listLength}`;
    for (let i = 0; i < listLength; i++) {
      const chara = nonZero[i];
      const charaAny = chara as any;
      key += `|${charaAny._preparedSignature}|${chara.calcBaseHP}|${chara.calcBaseATK}|${charaAny.charaId}`;
    }
    damagePrimarySetupCacheKey = key;
  }
  const damagePrimarySetupCache =
    noSameDamagePrimarySetupCache !== null &&
    noSameDamagePrimarySetupCache.key === damagePrimarySetupCacheKey
      ? noSameDamagePrimarySetupCache
      : null;
  const fastIds = damagePrimarySetupCache?.fastIds ?? (usesFastPairBuddyMasks ? new Int16Array(listLength) : null);
  const fastBuddy1Ids = damagePrimarySetupCache?.fastBuddy1Ids ?? (usesFastPairBuddyMasks ? new Int16Array(listLength) : null);
  const fastBuddy2Ids = damagePrimarySetupCache?.fastBuddy2Ids ?? (usesFastPairBuddyMasks ? new Int16Array(listLength) : null);
  const fastBuddy3Ids = damagePrimarySetupCache?.fastBuddy3Ids ?? (usesFastPairBuddyMasks ? new Int16Array(listLength) : null);
  const fastHpTables = damagePrimarySetupCache?.fastHpTables ?? (usesFastPairBuddyMasks ? new Array<Float64Array>(listLength) : null);
  const fastHealTables = damagePrimarySetupCache?.fastHealTables ?? (usesFastPairBuddyMasks ? new Array<Float64Array>(listLength) : null);
  const fastHpPrimaryScoreTables = canUseHpPrimaryReachablePrune ? new Array<Float64Array>(listLength) : null;
  const fastIncreasedTables = usesMetricPrimaryFastLoop ? new Array<Float64Array>(listLength) : null;
  const needsFastThresholdDamageTables =
    hpThresholdDamageMetricCount > 0 ||
    usesDamagePrimaryMetricFastLoop ||
    usesBasicDuoPrimaryMetricFastLoop ||
    usesBasicDuoExactCombinationFastPath;
  const fastThresholdDamageTables = needsFastThresholdDamageTables
    ? new Array<Float64Array>(listLength)
    : null;
  const needsFastTop2MinTables =
    (canUseFastHpDamageThresholdExact && snapshot.attackNum === 9) ||
    usesBasicDuoPrimaryMetricFastLoop ||
    usesBasicDuoExactCombinationFastPath;
  const fastThresholdDamageMinTables = needsFastTop2MinTables
    ? new Array<Float64Array>(listLength)
    : null;
  const needsFastDuoResolution =
    canUseFastHpDamageThresholdExact ||
    usesBasicDuoPrimaryMetricFastLoop ||
    usesBasicDuoExactCombinationFastPath ||
    canUseDamagePrimaryNoRequiredFastLoop ||
    canUseDamagePrimaryFixedTwoFastLoop ||
    canUseDamagePrimarySupportFastPath;
  const fastDuoIds = damagePrimarySetupCache?.fastDuoIds ?? (needsFastDuoResolution ? new Int16Array(listLength) : null);
  const fastUseM2 = damagePrimarySetupCache?.fastUseM2 ?? (needsFastDuoResolution ? new Uint8Array(listLength) : null);
  const fastDuoBaseOffsets = damagePrimarySetupCache?.fastDuoBaseOffsets ?? (needsFastDuoResolution ? new Uint8Array(listLength) : null);
  const fastPairBuddyMasks = damagePrimarySetupCache?.fastPairBuddyMasks ?? (usesFastPairBuddyMasks ? new Uint8Array(listLength * listLength) : null);
  if (usesFastPairBuddyMasks && damagePrimarySetupCache === null) {
    for (let i = 0; i < listLength; i++) {
      const charaAny = nonZero[i] as any;
      fastIds![i] = charaAny.charaId as number;
      fastBuddy1Ids![i] = charaAny.buddy1IdCached as number;
      fastBuddy2Ids![i] = charaAny.buddy2IdCached as number;
      fastBuddy3Ids![i] = charaAny.buddy3IdCached as number;
      const hpTable = charaAny.hpByBuddyMaskCached as Float64Array;
      const healTable = charaAny.healByBuddyMaskCached as Float64Array;
      fastHpTables![i] = hpTable;
      fastHealTables![i] = healTable;
      if (fastThresholdDamageTables) {
        fastThresholdDamageTables[i] = charaAny.primaryDamageTop2ByMaskCached as Float64Array;
      }
      if (fastThresholdDamageMinTables) {
        fastThresholdDamageMinTables[i] = charaAny.primaryDamageTop2MinByMaskCached as Float64Array;
      }
      if (fastDuoIds) {
        fastDuoIds[i] = charaAny.duoId as number;
        fastUseM2![i] = (charaAny.useM2Cached as boolean) ? 1 : 0;
        fastDuoBaseOffsets![i] = (charaAny.magic2IsDuoBaseCached as boolean) ? 8 : 0;
      }
      if (fastHpPrimaryScoreTables) {
        if (hpPrimaryUsesEhp) {
          const scoreTable = new Float64Array(8);
          for (let mask = 0; mask < 8; mask++) {
            scoreTable[mask] = hpTable[mask] + healTable[mask];
          }
          fastHpPrimaryScoreTables[i] = scoreTable;
        } else {
          fastHpPrimaryScoreTables[i] = hpTable;
        }
      }
      if (fastIncreasedTables) {
        fastIncreasedTables[i] = charaAny.increasedHpByBuddyMaskCached as Float64Array;
      }
    }
    for (let i = 0; i < listLength; i++) {
      const rowOffset = i * listLength;
      const buddy1Id = fastBuddy1Ids![i];
      const buddy2Id = fastBuddy2Ids![i];
      const buddy3Id = fastBuddy3Ids![i];
      for (let j = 0; j < listLength; j++) {
        const targetId = fastIds![j];
        fastPairBuddyMasks![rowOffset + j] =
          (buddy1Id === targetId ? 1 : 0) |
          (buddy2Id === targetId ? 2 : 0) |
          (buddy3Id === targetId ? 4 : 0);
      }
    }
  }
  const fastHpPrimarySuffixSpan = listLength + 1;
  const fastHpPrimarySuffixBestByBase = canUseHpPrimaryReachablePrune
    ? new Float64Array(listLength * 8 * fastHpPrimarySuffixSpan)
    : null;
  if (fastHpPrimarySuffixBestByBase) {
    for (let row = 0; row < listLength; row++) {
      const rowMaskOffset = row * listLength;
      const scoreTable = fastHpPrimaryScoreTables![row];
      for (let baseMask = 0; baseMask < 8; baseMask++) {
        const offset = ((row << 3) + baseMask) * fastHpPrimarySuffixSpan;
        fastHpPrimarySuffixBestByBase[offset + listLength] = -Infinity;
        for (let candidate = listLength - 1; candidate >= 0; candidate--) {
          const value = scoreTable[baseMask | fastPairBuddyMasks![rowMaskOffset + candidate]];
          const next = fastHpPrimarySuffixBestByBase[offset + candidate + 1];
          fastHpPrimarySuffixBestByBase[offset + candidate] = value > next ? value : next;
        }
      }
    }
  }
  const supportFastIds = (usesMetricPrimaryFastLoop || canUseBasicDuoPrimarySupportFastLoop || (canUseDamagePrimarySupportFastPath && requiredCount === 2)) && settings.allowSameCharacter
    ? new Int16Array(maxLevel.length)
    : null;
  const supportFastBuddy1Ids = supportFastIds ? new Int16Array(maxLevel.length) : null;
  const supportFastBuddy2Ids = supportFastIds ? new Int16Array(maxLevel.length) : null;
  const supportFastBuddy3Ids = supportFastIds ? new Int16Array(maxLevel.length) : null;
  const supportFastDuoIds = supportFastIds ? new Int16Array(maxLevel.length) : null;
  const supportFastUseM2 = supportFastIds ? new Uint8Array(maxLevel.length) : null;
  const supportFastDuoBaseOffsets = supportFastIds ? new Uint8Array(maxLevel.length) : null;
  const supportFastHpTables = supportFastIds ? new Array<Float64Array>(maxLevel.length) : null;
  const supportFastHealTables = supportFastIds ? new Array<Float64Array>(maxLevel.length) : null;
  const supportFastIncreasedTables = supportFastIds ? new Array<Float64Array>(maxLevel.length) : null;
  const supportFastDamageTables = supportFastIds && (usesDamagePrimaryMetricFastLoop || canUseBasicDuoPrimarySupportFastLoop) ? new Array<Float64Array>(maxLevel.length) : null;
  const supportFastDamageMinTables = supportFastIds && canUseBasicDuoPrimarySupportFastLoop && snapshot.attackNum < 10 ? new Array<Float64Array>(maxLevel.length) : null;
  const fastNormalToSupportBuddyMasks = supportFastIds ? new Uint8Array(listLength * maxLevel.length) : null;
  const fastSupportToNormalBuddyMasks = supportFastIds ? new Uint8Array(maxLevel.length * listLength) : null;
  const fastSupportSelfBuddyMasks = supportFastIds ? new Uint8Array(maxLevel.length) : null;
  if (supportFastIds) {
    for (let i = 0; i < maxLevel.length; i++) {
      const charaAny = maxLevel[i] as any;
      supportFastIds[i] = charaAny.charaId as number;
      supportFastBuddy1Ids![i] = charaAny.buddy1IdCached as number;
      supportFastBuddy2Ids![i] = charaAny.buddy2IdCached as number;
      supportFastBuddy3Ids![i] = charaAny.buddy3IdCached as number;
      supportFastDuoIds![i] = charaAny.duoId as number;
      supportFastUseM2![i] = (charaAny.useM2Cached as boolean) ? 1 : 0;
      supportFastDuoBaseOffsets![i] = (charaAny.magic2IsDuoBaseCached as boolean) ? 8 : 0;
      supportFastHpTables![i] = charaAny.hpByBuddyMaskCached as Float64Array;
      supportFastHealTables![i] = charaAny.healByBuddyMaskCached as Float64Array;
      supportFastIncreasedTables![i] = charaAny.increasedHpByBuddyMaskCached as Float64Array;
      if (supportFastDamageTables) {
        supportFastDamageTables[i] = charaAny.primaryDamageTop2ByMaskCached as Float64Array;
      }
      if (supportFastDamageMinTables) {
        supportFastDamageMinTables[i] = charaAny.primaryDamageTop2MinByMaskCached as Float64Array;
      }
    }
    const supportLength = maxLevel.length;
    for (let supportIndex = 0; supportIndex < supportLength; supportIndex++) {
      const supportId = supportFastIds[supportIndex];
      const supportBuddy1Id = supportFastBuddy1Ids![supportIndex];
      const supportBuddy2Id = supportFastBuddy2Ids![supportIndex];
      const supportBuddy3Id = supportFastBuddy3Ids![supportIndex];
      fastSupportSelfBuddyMasks![supportIndex] =
        (supportBuddy1Id === supportId ? 1 : 0) |
        (supportBuddy2Id === supportId ? 2 : 0) |
        (supportBuddy3Id === supportId ? 4 : 0);
      const supportRowOffset = supportIndex * listLength;
      for (let i = 0; i < listLength; i++) {
        const normalId = fastIds![i];
        fastNormalToSupportBuddyMasks![i * supportLength + supportIndex] =
          (fastBuddy1Ids![i] === supportId ? 1 : 0) |
          (fastBuddy2Ids![i] === supportId ? 2 : 0) |
          (fastBuddy3Ids![i] === supportId ? 4 : 0);
        fastSupportToNormalBuddyMasks![supportRowOffset + i] =
          (supportBuddy1Id === normalId ? 1 : 0) |
          (supportBuddy2Id === normalId ? 2 : 0) |
          (supportBuddy3Id === normalId ? 4 : 0);
      }
    }
  }
  const fastIncreasedReachableSpan = listLength + 1;
  const canUseNoSameIncreasedReachablePrune =
    canUseIncreasedHpBuddyPrimaryFastPath &&
    !settings.allowSameCharacter &&
    !canUseIncreasedHpBuddyFixedTwoFastLoop;
  const fastIncreasedReachableMasks = canUseNoSameIncreasedReachablePrune
    ? new Uint8Array(listLength * 5 * fastIncreasedReachableSpan)
    : null;
  const fastIncreasedReachableScoreByBits = canUseNoSameIncreasedReachablePrune
    ? new Float64Array(listLength * 8 * 256)
    : null;
  if (fastIncreasedReachableMasks && fastIncreasedReachableScoreByBits) {
    for (let row = 0; row < listLength; row++) {
      const rowMaskOffset = row * listLength;
      const increasedTable = fastIncreasedTables![row];
      const rowReachableOffset = row * 5 * fastIncreasedReachableSpan;
      for (let start = 0; start <= listLength; start++) {
        fastIncreasedReachableMasks[rowReachableOffset + start] = 1;
      }
      for (let pickCount = 1; pickCount <= 4; pickCount++) {
        const currentOffset = rowReachableOffset + pickCount * fastIncreasedReachableSpan;
        const previousOffset = rowReachableOffset + (pickCount - 1) * fastIncreasedReachableSpan;
        fastIncreasedReachableMasks[currentOffset + listLength] = 1;
        for (let candidate = listLength - 1; candidate >= 0; candidate--) {
          const skipBits = fastIncreasedReachableMasks[currentOffset + candidate + 1];
          const takeBits = UNION_BUDDY_MASK_BITS[
            (fastPairBuddyMasks![rowMaskOffset + candidate] << 8) +
            fastIncreasedReachableMasks[previousOffset + candidate + 1]
          ];
          fastIncreasedReachableMasks[currentOffset + candidate] = skipBits | takeBits;
        }
      }
      const scoreRowOffset = row << 11;
      for (let baseMask = 0; baseMask < 8; baseMask++) {
        const scoreBaseOffset = scoreRowOffset + (baseMask << 8);
        for (let bits = 0; bits < 256; bits++) {
          let best = -Infinity;
          for (let mask = 0; mask < 8; mask++) {
            if ((bits & (1 << mask)) !== 0) {
              const value = increasedTable[baseMask | mask];
              if (value > best) best = value;
            }
          }
          fastIncreasedReachableScoreByBits[scoreBaseOffset + bits] = best;
        }
      }
    }
  }
  const fastSupportIncreasedSuffixSpan = maxLevel.length + 1;
  const fastNormalSupportIncreasedSuffixBestByBase = supportFastIds && fastIncreasedTables
    ? new Float64Array(listLength * 8 * fastSupportIncreasedSuffixSpan)
    : null;
  if (fastNormalSupportIncreasedSuffixBestByBase) {
    const supportLength = maxLevel.length;
    for (let row = 0; row < listLength; row++) {
      const supportMaskOffset = row * supportLength;
      const increasedTable = fastIncreasedTables![row];
      for (let baseMask = 0; baseMask < 8; baseMask++) {
        const offset = ((row << 3) + baseMask) * fastSupportIncreasedSuffixSpan;
        fastNormalSupportIncreasedSuffixBestByBase[offset + supportLength] = -Infinity;
        for (let supportIndex = supportLength - 1; supportIndex >= 0; supportIndex--) {
          const value = increasedTable[baseMask | fastNormalToSupportBuddyMasks![supportMaskOffset + supportIndex]];
          const next = fastNormalSupportIncreasedSuffixBestByBase[offset + supportIndex + 1];
          fastNormalSupportIncreasedSuffixBestByBase[offset + supportIndex] = value > next ? value : next;
        }
      }
    }
  }
  const fastDamageReachableSpan = listLength + 1;
  const fastDamageReachableMasks = damagePrimarySetupCache?.fastDamageReachableMasks ?? (canUseDamagePrimaryReachablePrune
    ? new Uint8Array(listLength * 5 * fastDamageReachableSpan)
    : null);
  const fastDamageReachableScoreByBits = damagePrimarySetupCache?.fastDamageReachableScoreByBits ?? (canUseDamagePrimaryReachablePrune
    ? new Float64Array(listLength * 2 * 8 * 256)
    : null);
  const fastDamageOnePickReachableUpper = damagePrimarySetupCache?.fastDamageOnePickReachableUpper ?? (canUseDamagePrimaryReachablePrune
    ? new Float64Array(listLength * 2 * 8 * fastDamageReachableSpan)
    : null);
  const fastDamageDuoTargetSuffixNext = damagePrimarySetupCache?.fastDamageDuoTargetSuffixNext ?? (canUseDamagePrimaryReachablePrune
    ? new Int16Array(listLength * fastDamageReachableSpan)
    : null);
  if (fastDamageDuoTargetSuffixNext && damagePrimarySetupCache === null) {
    for (let row = 0; row < listLength; row++) {
      const rowOffset = row * fastDamageReachableSpan;
      const duoId = fastDuoIds![row];
      let next = listLength;
      fastDamageDuoTargetSuffixNext[rowOffset + listLength] = next;
      for (let candidate = listLength - 1; candidate >= 0; candidate--) {
        if (fastIds![candidate] === duoId) next = candidate;
        fastDamageDuoTargetSuffixNext[rowOffset + candidate] = next;
      }
    }
  }
  if (fastDamageReachableMasks && fastDamageReachableScoreByBits && damagePrimarySetupCache === null) {
    const metricOffset = getDamageMetricTableIndex(primaryDamageUpperMetric) << 4;
    for (let row = 0; row < listLength; row++) {
      const rowMaskOffset = row * listLength;
      const damageTable = ((nonZero[row] as any).primaryDamageTop2ByMaskCached as Float64Array);
      const rowReachableOffset = row * 5 * fastDamageReachableSpan;
      for (let start = 0; start <= listLength; start++) {
        fastDamageReachableMasks[rowReachableOffset + start] = 1;
      }
      for (let pickCount = 1; pickCount <= 4; pickCount++) {
        const currentOffset = rowReachableOffset + pickCount * fastDamageReachableSpan;
        const previousOffset = rowReachableOffset + (pickCount - 1) * fastDamageReachableSpan;
        fastDamageReachableMasks[currentOffset + listLength] = 1;
        for (let candidate = listLength - 1; candidate >= 0; candidate--) {
          const skipBits = fastDamageReachableMasks[currentOffset + candidate + 1];
          const takeBits = UNION_BUDDY_MASK_BITS[
            (fastPairBuddyMasks![rowMaskOffset + candidate] << 8) +
            fastDamageReachableMasks[previousOffset + candidate + 1]
          ];
          fastDamageReachableMasks[currentOffset + candidate] = skipBits | takeBits;
        }
      }
      const scoreRowOffset = row << 12;
      for (let baseMask = 0; baseMask < 8; baseMask++) {
        for (let duoState = 0; duoState < 2; duoState++) {
          const scoreBaseOffset = scoreRowOffset + (duoState << 11) + (baseMask << 8);
          const tableOffset = metricOffset + (duoState === 1 ? 8 : 0);
          for (let bits = 0; bits < 256; bits++) {
            let best = -Infinity;
            for (let mask = 0; mask < 8; mask++) {
              if ((bits & (1 << mask)) !== 0) {
                const value = damageTable[tableOffset + (baseMask | mask)];
                if (value > best) best = value;
              }
            }
            fastDamageReachableScoreByBits[scoreBaseOffset + bits] = best;
          }
        }
      }
    }
  }
  if (fastDamageOnePickReachableUpper && fastDamageReachableMasks && fastDamageReachableScoreByBits && damagePrimarySetupCache === null) {
    for (let row = 0; row < listLength; row++) {
      const rowReachableOffset = (row * 5 + 1) * fastDamageReachableSpan;
      const rowDuoOffset = row * fastDamageReachableSpan;
      const scoreRowOffset = row << 12;
      const outputRowOffset = row * 2 * 8 * fastDamageReachableSpan;
      for (let baseDuoPossible = 0; baseDuoPossible < 2; baseDuoPossible++) {
        const outputDuoOffset = outputRowOffset + baseDuoPossible * 8 * fastDamageReachableSpan;
        for (let baseMask = 0; baseMask < 8; baseMask++) {
          const outputOffset = outputDuoOffset + baseMask * fastDamageReachableSpan;
          for (let suffixStart = 0; suffixStart <= listLength; suffixStart++) {
            const suffixDuoPossible = fastDamageDuoTargetSuffixNext![rowDuoOffset + suffixStart] < listLength;
            const duoState =
              fastDuoBaseOffsets![row] !== 0 ||
              (fastUseM2![row] !== 0 && (baseDuoPossible !== 0 || suffixDuoPossible))
                ? 1
                : 0;
            const bits = fastDamageReachableMasks[rowReachableOffset + suffixStart];
            fastDamageOnePickReachableUpper[outputOffset + suffixStart] =
              fastDamageReachableScoreByBits[scoreRowOffset + (duoState << 11) + (baseMask << 8) + bits];
          }
        }
      }
    }
  }
  if (
    canUseDamagePrimaryReachablePrune &&
    damagePrimarySetupCache === null &&
    fastIds &&
    fastBuddy1Ids &&
    fastBuddy2Ids &&
    fastBuddy3Ids &&
    fastHpTables &&
    fastHealTables &&
    fastDuoIds &&
    fastUseM2 &&
    fastDuoBaseOffsets &&
    fastPairBuddyMasks &&
    fastDamageReachableMasks &&
    fastDamageReachableScoreByBits &&
    fastDamageDuoTargetSuffixNext &&
    fastDamageOnePickReachableUpper
  ) {
    noSameDamagePrimarySetupCache = {
      key: damagePrimarySetupCacheKey,
      fastIds,
      fastBuddy1Ids,
      fastBuddy2Ids,
      fastBuddy3Ids,
      fastHpTables,
      fastHealTables,
      fastDuoIds,
      fastUseM2,
      fastDuoBaseOffsets,
      fastPairBuddyMasks,
      fastDamageReachableMasks,
      fastDamageReachableScoreByBits,
      fastDamageDuoTargetSuffixNext,
      fastDamageOnePickReachableUpper,
    };
  }
  type MetricPrimaryFastEntry = {
    primaryScore: number;
    secondaryScore: number;
    c0: Character;
    c1: Character;
    c2: Character;
    c3: Character;
    c4: Character;
    supportSlot?: boolean;
    deckKey?: string;
  };
  const metricPrimaryFastEntries = (
    usesMetricPrimaryFastLoop ||
    usesDamagePrimaryMetricFastLoop ||
    usesBasicDuoPrimaryMetricFastLoop ||
    usesBasicDuoExactCombinationFastPath
  ) ? [] as MetricPrimaryFastEntry[] : null;
  const metricPrimaryFastMaxSize = Math.max(0, Math.trunc(Number(settings.maxResult)));
  const metricPrimaryFastHasSecondary =
    canUseMetricPrimaryEhpSecondary ||
    usesBasicDuoPrimaryMetricFastLoop ||
    usesBasicDuoExactCombinationFastPath;
  let metricPrimaryFastIsSorted = true;
  let metricPrimaryFastIsHeap = false;
  let metricPrimaryFastThresholdPrimary = -Infinity;
  let metricPrimaryFastThresholdSecondary = -Infinity;
  let metricPrimarySeedThresholdPrimary = -Infinity;
  let metricPrimarySeedThresholdSecondary = -Infinity;

  const ensureMetricPrimaryDeckKey = (entry: MetricPrimaryFastEntry): string => {
    return entry.deckKey ?? (entry.deckKey = buildLegacyDeckKey(
      entry.c0,
      entry.c1,
      entry.c2,
      entry.c3,
      entry.c4,
      entry.supportSlot === true,
    ));
  };
  const compareMetricPrimaryFastEntries = (a: MetricPrimaryFastEntry, b: MetricPrimaryFastEntry): number => {
    if (a.primaryScore !== b.primaryScore) return b.primaryScore - a.primaryScore;
    if (metricPrimaryFastHasSecondary && a.secondaryScore !== b.secondaryScore) {
      return b.secondaryScore - a.secondaryScore;
    }
    const aKey = ensureMetricPrimaryDeckKey(a);
    const bKey = ensureMetricPrimaryDeckKey(b);
    if (aKey === bKey) return 0;
    return aKey < bKey ? -1 : 1;
  };
  const isWorseMetricPrimaryFastEntry = (a: MetricPrimaryFastEntry, b: MetricPrimaryFastEntry): boolean =>
    compareMetricPrimaryFastEntries(a, b) > 0;
  const siftDownMetricPrimaryFastHeap = (entries: MetricPrimaryFastEntry[], start: number) => {
    let index = start;
    while (true) {
      const left = (index << 1) + 1;
      if (left >= entries.length) return;
      const right = left + 1;
      let worstChild = left;
      if (right < entries.length && isWorseMetricPrimaryFastEntry(entries[right], entries[left])) {
        worstChild = right;
      }
      if (!isWorseMetricPrimaryFastEntry(entries[worstChild], entries[index])) return;
      const temp = entries[index];
      entries[index] = entries[worstChild];
      entries[worstChild] = temp;
      index = worstChild;
    }
  };
  const buildMetricPrimaryFastHeap = (entries: MetricPrimaryFastEntry[]) => {
    for (let index = (entries.length >>> 1) - 1; index >= 0; index--) {
      siftDownMetricPrimaryFastHeap(entries, index);
    }
    metricPrimaryFastIsHeap = true;
    metricPrimaryFastIsSorted = false;
  };
  const updateMetricPrimaryFastThreshold = () => {
    if (!metricPrimaryFastEntries || metricPrimaryFastEntries.length < metricPrimaryFastMaxSize) {
      metricPrimaryFastThresholdPrimary = -Infinity;
      metricPrimaryFastThresholdSecondary = -Infinity;
      return;
    }
    const thresholdEntry = metricPrimaryFastIsHeap
      ? metricPrimaryFastEntries[0]
      : metricPrimaryFastEntries[metricPrimaryFastEntries.length - 1];
    metricPrimaryFastThresholdPrimary = thresholdEntry.primaryScore;
    metricPrimaryFastThresholdSecondary = thresholdEntry.secondaryScore;
  };
  const metricPrimaryShouldConsider = (primaryScore: number): boolean => {
    if (!metricPrimaryFastEntries) return resultsManager.shouldConsider(primaryScore);
    if (metricPrimaryFastMaxSize <= 0) return false;
    const thresholdPrimary = metricPrimaryFastEntries.length < metricPrimaryFastMaxSize
      ? metricPrimarySeedThresholdPrimary
      : (metricPrimaryFastThresholdPrimary > metricPrimarySeedThresholdPrimary
        ? metricPrimaryFastThresholdPrimary
        : metricPrimarySeedThresholdPrimary);
    return primaryScore >= thresholdPrimary;
  };
  const metricPrimaryCouldBeat = (primaryScore: number, secondaryUpperScore: number): boolean => {
    if (!metricPrimaryFastEntries) return resultsManager.shouldConsider(primaryScore);
    if (metricPrimaryFastMaxSize <= 0) return false;
    const thresholdPrimary = metricPrimaryFastEntries.length < metricPrimaryFastMaxSize
      ? metricPrimarySeedThresholdPrimary
      : (metricPrimaryFastThresholdPrimary > metricPrimarySeedThresholdPrimary
        ? metricPrimaryFastThresholdPrimary
        : metricPrimarySeedThresholdPrimary);
    if (primaryScore > thresholdPrimary) return true;
    if (primaryScore < thresholdPrimary) return false;
    if (!metricPrimaryFastHasSecondary) return true;
    const thresholdSecondary = metricPrimaryFastEntries.length < metricPrimaryFastMaxSize
      ? metricPrimarySeedThresholdSecondary
      : (metricPrimaryFastThresholdPrimary > metricPrimarySeedThresholdPrimary
        ? metricPrimaryFastThresholdSecondary
        : metricPrimarySeedThresholdSecondary);
    return secondaryUpperScore >= thresholdSecondary;
  };
  const addMetricPrimaryFastEntry = (
    primaryScore: number,
    secondaryScore: number,
    c0: Character,
    c1: Character,
    c2: Character,
    c3: Character,
    c4: Character,
    supportSlot = false,
  ) => {
    if (!metricPrimaryFastEntries || metricPrimaryFastMaxSize <= 0) return;
    if (metricPrimaryFastEntries.length >= metricPrimaryFastMaxSize) {
      const worst = metricPrimaryFastIsHeap
        ? metricPrimaryFastEntries[0]
        : metricPrimaryFastEntries[metricPrimaryFastEntries.length - 1];
      if (primaryScore < worst.primaryScore) return;
      if (primaryScore === worst.primaryScore && metricPrimaryFastHasSecondary && secondaryScore < worst.secondaryScore) return;
    }

    const entry: MetricPrimaryFastEntry = { primaryScore, secondaryScore, c0, c1, c2, c3, c4 };
    if (supportSlot) entry.supportSlot = true;
    const entries = metricPrimaryFastEntries;
    if (entries.length < metricPrimaryFastMaxSize) {
      entries.push(entry);
      metricPrimaryFastIsSorted = false;
      if (entries.length === metricPrimaryFastMaxSize) {
        buildMetricPrimaryFastHeap(entries);
        updateMetricPrimaryFastThreshold();
      }
      return;
    }

    const worstIndex = metricPrimaryFastIsHeap ? 0 : entries.length - 1;
    if (compareMetricPrimaryFastEntries(entry, entries[worstIndex]) >= 0) return;
    entries[worstIndex] = entry;
    if (metricPrimaryFastIsHeap) {
      siftDownMetricPrimaryFastHeap(entries, 0);
    } else {
      buildMetricPrimaryFastHeap(entries);
    }
    updateMetricPrimaryFastThreshold();
  };
  const getMetricPrimaryTopDecks = (): DeckResult[] => {
    if (!metricPrimaryFastEntries) return resultsManager.getTopDecks();
    if (!metricPrimaryFastIsSorted) {
      metricPrimaryFastEntries.sort(compareMetricPrimaryFastEntries);
      metricPrimaryFastIsSorted = true;
      metricPrimaryFastIsHeap = false;
      updateMetricPrimaryFastThreshold();
    }
    const topDecks = new Array<DeckResult>(metricPrimaryFastEntries.length);
    for (let i = 0; i < metricPrimaryFastEntries.length; i++) {
      const entry = metricPrimaryFastEntries[i];
      const transformedRet = ({ simuURL: '', detailList: emptyDetailList } as DeckResult);
      const transformedRetAny = transformedRet as any;
      if (
        usesHpPrimaryMetricFastLoop ||
        usesDamagePrimaryMetricFastLoop ||
        usesBasicDuoPrimaryMetricFastLoop ||
        usesBasicDuoExactCombinationFastPath
      ) {
        transformedRetAny[sortCompareKeys[0]] = entry.primaryScore;
        if (usesBasicDuoPrimaryMetricFastLoop || usesBasicDuoExactCombinationFastPath) {
          transformedRetAny[sortCompareKeys[1]] = entry.secondaryScore;
        }
      } else {
        transformedRetAny.increasedHpBuddy = entry.primaryScore;
        if (sortCompareLen > 1) transformedRetAny.ehp = entry.secondaryScore;
      }
      transformedRetAny._deckKey = ensureMetricPrimaryDeckKey(entry);
      transformedRetAny._combo0 = entry.c0;
      transformedRetAny._combo1 = entry.c1;
      transformedRetAny._combo2 = entry.c2;
      transformedRetAny._combo3 = entry.c3;
      transformedRetAny._combo4 = entry.c4;
      if (entry.supportSlot === true) transformedRetAny._supportSlot = true;
      topDecks[i] = transformedRet;
    }
    return topDecks;
  };

  function addMetricPrimaryFastDeck(
    primaryScore: number,
    ehp: number,
    c0: Character,
    c1: Character,
    c2: Character,
    c3: Character,
    c4: Character,
    supportSlot = false,
  ) {
    if (!metricPrimaryShouldConsider(primaryScore)) return;
    if (metricPrimaryFastEntries) {
      addMetricPrimaryFastEntry(primaryScore, ehp, c0, c1, c2, c3, c4, supportSlot);
      return;
    }
    const deckKey = buildLegacyDeckKey(c0, c1, c2, c3, c4, supportSlot);
    const transformedRet = ({ simuURL: '', detailList: emptyDetailList } as DeckResult);
    const transformedRetAny = transformedRet as any;
    if (usesHpPrimaryMetricFastLoop) {
      transformedRetAny[sortCompareKeys[0]] = primaryScore;
    } else {
      transformedRetAny.increasedHpBuddy = primaryScore;
      if (sortCompareLen > 1) transformedRetAny.ehp = ehp;
    }
    transformedRetAny._deckKey = deckKey;
    transformedRetAny._combo0 = c0;
    transformedRetAny._combo1 = c1;
    transformedRetAny._combo2 = c2;
    transformedRetAny._combo3 = c3;
    transformedRetAny._combo4 = c4;
    if (supportSlot) transformedRetAny._supportSlot = true;
    resultsManager.addDeck(transformedRet);
  }

  const countFixedFiveDuoBits = (mask: number): number =>
    ((mask & 1) !== 0 ? 1 : 0) +
    ((mask & 2) !== 0 ? 1 : 0) +
    ((mask & 4) !== 0 ? 1 : 0) +
    ((mask & 8) !== 0 ? 1 : 0) +
    ((mask & 16) !== 0 ? 1 : 0);

  const basicDuoSecondaryMetricOffset = getDamageMetricTableIndex(basicDuoSecondaryDamageMetric) << 4;
  const basicDuoReferenceMetricOffset = getDamageMetricTableIndex(DAMAGE_METRIC_REFERENCE) << 4;
  const basicDuoAdvantageMetricOffset = getDamageMetricTableIndex(DAMAGE_METRIC_ADVANTAGE) << 4;
  const basicDuoVsHiMetricOffset = getDamageMetricTableIndex(DAMAGE_METRIC_VS_HI) << 4;
  const basicDuoVsMizuMetricOffset = getDamageMetricTableIndex(DAMAGE_METRIC_VS_MIZU) << 4;
  const basicDuoVsKiMetricOffset = getDamageMetricTableIndex(DAMAGE_METRIC_VS_KI) << 4;
  const basicDuoAttackNum = snapshot.attackNum;
  const basicDuoSecondaryUpperCacheKey = DAMAGE_SORT_KEY_TO_UPPER_CACHE[basicDuoSecondarySortKey];
  const basicDuoSecondaryUpperScores =
    usesBasicDuoExactCombinationFastPath && basicDuoSecondaryUpperCacheKey !== undefined
      ? buildCachedNumberScoreArray(basicDuoSecondaryUpperCacheKey)
      : null;
  const basicDuoSupportSecondaryUpperScores =
    canUseBasicDuoPrimarySupportFastLoop && basicDuoSecondaryUpperCacheKey !== undefined
      ? buildCachedNumberScoreArrayFor(maxLevel, basicDuoSecondaryUpperCacheKey)
      : null;
  const basicDuoSecondaryUpperSuffixTopSums = basicDuoSecondaryUpperScores
    ? buildSuffixTopSums(basicDuoSecondaryUpperScores, 5)
    : null;
  const calculateBasicDuoDamageRaw = (
    metricOffset: number,
    c0DamageTable: Float64Array,
    c1DamageTable: Float64Array,
    c2DamageTable: Float64Array,
    c3DamageTable: Float64Array,
    c4DamageTable: Float64Array,
    c0MinDamageTable: Float64Array | undefined,
    c1MinDamageTable: Float64Array | undefined,
    c2MinDamageTable: Float64Array | undefined,
    c3MinDamageTable: Float64Array | undefined,
    c4MinDamageTable: Float64Array | undefined,
    c0BaseIndex: number,
    c1BaseIndex: number,
    c2BaseIndex: number,
    c3BaseIndex: number,
    c4BaseIndex: number,
  ): number => {
    const c0Index = metricOffset + c0BaseIndex;
    const c1Index = metricOffset + c1BaseIndex;
    const c2Index = metricOffset + c2BaseIndex;
    const c3Index = metricOffset + c3BaseIndex;
    const c4Index = metricOffset + c4BaseIndex;
    const c0Sum = c0DamageTable[c0Index];
    const c1Sum = c1DamageTable[c1Index];
    const c2Sum = c2DamageTable[c2Index];
    const c3Sum = c3DamageTable[c3Index];
    const c4Sum = c4DamageTable[c4Index];
    const total = c0Sum + c1Sum + c2Sum + c3Sum + c4Sum;
    if (basicDuoAttackNum >= 10) return total;
    const c0Min = c0MinDamageTable![c0Index];
    const c1Min = c1MinDamageTable![c1Index];
    const c2Min = c2MinDamageTable![c2Index];
    const c3Min = c3MinDamageTable![c3Index];
    const c4Min = c4MinDamageTable![c4Index];
    if (basicDuoAttackNum === 9) return total - Math.min(c0Min, c1Min, c2Min, c3Min, c4Min);

    let min1 = Infinity;
    let min2 = Infinity;
    let value = c0Min;
    if (value < min1) { min2 = min1; min1 = value; } else if (value < min2) { min2 = value; }
    value = c0Sum - c0Min;
    if (value < min1) { min2 = min1; min1 = value; } else if (value < min2) { min2 = value; }
    value = c1Min;
    if (value < min1) { min2 = min1; min1 = value; } else if (value < min2) { min2 = value; }
    value = c1Sum - c1Min;
    if (value < min1) { min2 = min1; min1 = value; } else if (value < min2) { min2 = value; }
    value = c2Min;
    if (value < min1) { min2 = min1; min1 = value; } else if (value < min2) { min2 = value; }
    value = c2Sum - c2Min;
    if (value < min1) { min2 = min1; min1 = value; } else if (value < min2) { min2 = value; }
    value = c3Min;
    if (value < min1) { min2 = min1; min1 = value; } else if (value < min2) { min2 = value; }
    value = c3Sum - c3Min;
    if (value < min1) { min2 = min1; min1 = value; } else if (value < min2) { min2 = value; }
    value = c4Min;
    if (value < min1) { min2 = min1; min1 = value; } else if (value < min2) { min2 = value; }
    value = c4Sum - c4Min;
    if (value < min1) { min2 = min1; min1 = value; } else if (value < min2) { min2 = value; }
    return total - min1 - min2;
  };

  type BasicDuoExactScore = {
    primaryScore: number;
    secondaryScore: number;
    i: number;
    j: number;
    k: number;
    l: number;
    m: number;
  };
  const basicDuoFastIndexScratch = new Int32Array(5);
  const basicDuoFastOrderScratch = new Int32Array(5);
  const sortBasicDuoNormalIndexes = (count: number): boolean => {
    let changed = false;
    for (let pos = 1; pos < count; pos++) {
      const indexValue = basicDuoFastIndexScratch[pos];
      const orderValue = basicDuoFastOrderScratch[pos];
      let prev = pos - 1;
      while (prev >= 0 && basicDuoFastOrderScratch[prev] > orderValue) {
        basicDuoFastIndexScratch[prev + 1] = basicDuoFastIndexScratch[prev];
        basicDuoFastOrderScratch[prev + 1] = basicDuoFastOrderScratch[prev];
        prev -= 1;
        changed = true;
      }
      basicDuoFastIndexScratch[prev + 1] = indexValue;
      basicDuoFastOrderScratch[prev + 1] = orderValue;
    }
    return changed;
  };
  const evaluateBasicDuoPrimaryByIndexFast = (
    i: number,
    j: number,
    k: number,
    l: number,
    m: number,
    supportSlot = false,
  ): BasicDuoExactScore | null | undefined => {
    if (
      !fastIds ||
      !fastDuoIds ||
      !fastUseM2 ||
      !fastDuoBaseOffsets ||
      !fastPairBuddyMasks ||
      !fastHpTables ||
      !fastHealTables ||
      !fastThresholdDamageTables
    ) {
      return undefined;
    }
    if (
      supportSlot &&
      (
        !supportFastIds ||
        !supportFastDuoIds ||
        !supportFastUseM2 ||
        !supportFastDuoBaseOffsets ||
        !supportFastHpTables ||
        !supportFastHealTables ||
        !supportFastDamageTables ||
        !fastNormalToSupportBuddyMasks ||
        !fastSupportToNormalBuddyMasks ||
        !fastSupportSelfBuddyMasks
      )
    ) {
      return undefined;
    }

    basicDuoFastIndexScratch[0] = i;
    basicDuoFastIndexScratch[1] = j;
    basicDuoFastIndexScratch[2] = k;
    basicDuoFastIndexScratch[3] = l;
    basicDuoFastOrderScratch[0] = getLegacyDeckOrderIndex(nonZero[i]);
    basicDuoFastOrderScratch[1] = getLegacyDeckOrderIndex(nonZero[j]);
    basicDuoFastOrderScratch[2] = getLegacyDeckOrderIndex(nonZero[k]);
    basicDuoFastOrderScratch[3] = getLegacyDeckOrderIndex(nonZero[l]);
    if (supportSlot) {
      sortBasicDuoNormalIndexes(4);
      i = basicDuoFastIndexScratch[0];
      j = basicDuoFastIndexScratch[1];
      k = basicDuoFastIndexScratch[2];
      l = basicDuoFastIndexScratch[3];
    } else {
      basicDuoFastIndexScratch[4] = m;
      basicDuoFastOrderScratch[4] = getLegacyDeckOrderIndex(nonZero[m]);
      sortBasicDuoNormalIndexes(5);
      i = basicDuoFastIndexScratch[0];
      j = basicDuoFastIndexScratch[1];
      k = basicDuoFastIndexScratch[2];
      l = basicDuoFastIndexScratch[3];
      m = basicDuoFastIndexScratch[4];
    }

    const iBuddyMaskOffset = i * listLength;
    const jBuddyMaskOffset = j * listLength;
    const kBuddyMaskOffset = k * listLength;
    const lBuddyMaskOffset = l * listLength;
    let iMask: number;
    let jMask: number;
    let kMask: number;
    let lMask: number;
    let mMask: number;
    let c4: Character;
    let c4Id: number;
    let c4DuoId: number;
    let c4UseM2: boolean;
    let c4DuoBaseOffset: number;

    if (supportSlot) {
      const supportLength = maxLevel.length;
      const iSupportMaskOffset = i * supportLength;
      const jSupportMaskOffset = j * supportLength;
      const kSupportMaskOffset = k * supportLength;
      const lSupportMaskOffset = l * supportLength;
      iMask =
        fastPairBuddyMasks[iBuddyMaskOffset + i] |
        fastPairBuddyMasks[iBuddyMaskOffset + j] |
        fastPairBuddyMasks[iBuddyMaskOffset + k] |
        fastPairBuddyMasks[iBuddyMaskOffset + l] |
        fastNormalToSupportBuddyMasks![iSupportMaskOffset + m];
      jMask =
        fastPairBuddyMasks[jBuddyMaskOffset + i] |
        fastPairBuddyMasks[jBuddyMaskOffset + j] |
        fastPairBuddyMasks[jBuddyMaskOffset + k] |
        fastPairBuddyMasks[jBuddyMaskOffset + l] |
        fastNormalToSupportBuddyMasks![jSupportMaskOffset + m];
      kMask =
        fastPairBuddyMasks[kBuddyMaskOffset + i] |
        fastPairBuddyMasks[kBuddyMaskOffset + j] |
        fastPairBuddyMasks[kBuddyMaskOffset + k] |
        fastPairBuddyMasks[kBuddyMaskOffset + l] |
        fastNormalToSupportBuddyMasks![kSupportMaskOffset + m];
      lMask =
        fastPairBuddyMasks[lBuddyMaskOffset + i] |
        fastPairBuddyMasks[lBuddyMaskOffset + j] |
        fastPairBuddyMasks[lBuddyMaskOffset + k] |
        fastPairBuddyMasks[lBuddyMaskOffset + l] |
        fastNormalToSupportBuddyMasks![lSupportMaskOffset + m];
      const supportNormalMaskOffset = m * listLength;
      mMask =
        fastSupportToNormalBuddyMasks![supportNormalMaskOffset + i] |
        fastSupportToNormalBuddyMasks![supportNormalMaskOffset + j] |
        fastSupportToNormalBuddyMasks![supportNormalMaskOffset + k] |
        fastSupportToNormalBuddyMasks![supportNormalMaskOffset + l] |
        fastSupportSelfBuddyMasks![m];
      c4 = maxLevel[m];
      c4Id = supportFastIds![m];
      c4DuoId = supportFastDuoIds![m];
      c4UseM2 = supportFastUseM2![m] !== 0;
      c4DuoBaseOffset = supportFastDuoBaseOffsets![m];
    } else {
      const mBuddyMaskOffset = m * listLength;
      iMask =
        fastPairBuddyMasks[iBuddyMaskOffset + i] |
        fastPairBuddyMasks[iBuddyMaskOffset + j] |
        fastPairBuddyMasks[iBuddyMaskOffset + k] |
        fastPairBuddyMasks[iBuddyMaskOffset + l] |
        fastPairBuddyMasks[iBuddyMaskOffset + m];
      jMask =
        fastPairBuddyMasks[jBuddyMaskOffset + i] |
        fastPairBuddyMasks[jBuddyMaskOffset + j] |
        fastPairBuddyMasks[jBuddyMaskOffset + k] |
        fastPairBuddyMasks[jBuddyMaskOffset + l] |
        fastPairBuddyMasks[jBuddyMaskOffset + m];
      kMask =
        fastPairBuddyMasks[kBuddyMaskOffset + i] |
        fastPairBuddyMasks[kBuddyMaskOffset + j] |
        fastPairBuddyMasks[kBuddyMaskOffset + k] |
        fastPairBuddyMasks[kBuddyMaskOffset + l] |
        fastPairBuddyMasks[kBuddyMaskOffset + m];
      lMask =
        fastPairBuddyMasks[lBuddyMaskOffset + i] |
        fastPairBuddyMasks[lBuddyMaskOffset + j] |
        fastPairBuddyMasks[lBuddyMaskOffset + k] |
        fastPairBuddyMasks[lBuddyMaskOffset + l] |
        fastPairBuddyMasks[lBuddyMaskOffset + m];
      mMask =
        fastPairBuddyMasks[mBuddyMaskOffset + i] |
        fastPairBuddyMasks[mBuddyMaskOffset + j] |
        fastPairBuddyMasks[mBuddyMaskOffset + k] |
        fastPairBuddyMasks[mBuddyMaskOffset + l] |
        fastPairBuddyMasks[mBuddyMaskOffset + m];
      c4 = nonZero[m];
      c4Id = fastIds[m];
      c4DuoId = fastDuoIds[m];
      c4UseM2 = fastUseM2[m] !== 0;
      c4DuoBaseOffset = fastDuoBaseOffsets[m];
    }

    const duoMask = resolveFixedFiveDuoMaskFromIds(
      fastIds[i],
      fastIds[j],
      fastIds[k],
      fastIds[l],
      c4Id,
      fastDuoIds[i],
      fastDuoIds[j],
      fastDuoIds[k],
      fastDuoIds[l],
      c4DuoId,
      fastUseM2[i] !== 0,
      fastUseM2[j] !== 0,
      fastUseM2[k] !== 0,
      fastUseM2[l] !== 0,
      c4UseM2,
    );
    const primaryScore = countFixedFiveDuoBits(duoMask);
    if (primaryScore < snapshot.minDuo) return null;

    const c0 = nonZero[i];
    const c1 = nonZero[j];
    const c2 = nonZero[k];
    const c3 = nonZero[l];
    const c0Any = c0 as any;
    const c1Any = c1 as any;
    const c2Any = c2 as any;
    const c3Any = c3 as any;
    const c4Any = c4 as any;
    if (
      c0.evasion + c1.evasion + c2.evasion + c3.evasion + c4.evasion < snapshot.minEvasion ||
      ((c0Any.totalBuffCached as number) ?? 0) +
        ((c1Any.totalBuffCached as number) ?? 0) +
        ((c2Any.totalBuffCached as number) ?? 0) +
        ((c3Any.totalBuffCached as number) ?? 0) +
        ((c4Any.totalBuffCached as number) ?? 0) < snapshot.minBuff ||
      ((c0Any.totalDebuffCached as number) ?? 0) +
        ((c1Any.totalDebuffCached as number) ?? 0) +
        ((c2Any.totalDebuffCached as number) ?? 0) +
        ((c3Any.totalDebuffCached as number) ?? 0) +
        ((c4Any.totalDebuffCached as number) ?? 0) < snapshot.minDebuff ||
      ((c0Any.magicCosmicCountCached as number) ?? 0) +
        ((c1Any.magicCosmicCountCached as number) ?? 0) +
        ((c2Any.magicCosmicCountCached as number) ?? 0) +
        ((c3Any.magicCosmicCountCached as number) ?? 0) +
        ((c4Any.magicCosmicCountCached as number) ?? 0) < snapshot.minCosmic ||
      ((c0Any.magicFireCountCached as number) ?? 0) +
        ((c1Any.magicFireCountCached as number) ?? 0) +
        ((c2Any.magicFireCountCached as number) ?? 0) +
        ((c3Any.magicFireCountCached as number) ?? 0) +
        ((c4Any.magicFireCountCached as number) ?? 0) < snapshot.minFire ||
      ((c0Any.magicWaterCountCached as number) ?? 0) +
        ((c1Any.magicWaterCountCached as number) ?? 0) +
        ((c2Any.magicWaterCountCached as number) ?? 0) +
        ((c3Any.magicWaterCountCached as number) ?? 0) +
        ((c4Any.magicWaterCountCached as number) ?? 0) < snapshot.minWater ||
      ((c0Any.magicFloraCountCached as number) ?? 0) +
        ((c1Any.magicFloraCountCached as number) ?? 0) +
        ((c2Any.magicFloraCountCached as number) ?? 0) +
        ((c3Any.magicFloraCountCached as number) ?? 0) +
        ((c4Any.magicFloraCountCached as number) ?? 0) < snapshot.minFlora ||
      ((c0Any.healCardCountCached as number) ?? 0) +
        ((c1Any.healCardCountCached as number) ?? 0) +
        ((c2Any.healCardCountCached as number) ?? 0) +
        ((c3Any.healCardCountCached as number) ?? 0) +
        ((c4Any.healCardCountCached as number) ?? 0) < snapshot.minHealNum
    ) {
      return null;
    }

    if (snapshot.minHP > 0 || snapshot.minEHP > 0) {
      const c4HpTable = supportSlot ? supportFastHpTables![m] : fastHpTables[m];
      const hp =
        fastHpTables[i][iMask] +
        fastHpTables[j][jMask] +
        fastHpTables[k][kMask] +
        fastHpTables[l][lMask] +
        c4HpTable[mMask];
      if (hp < snapshot.minHP) return null;
      if (snapshot.minEHP > 0) {
        const c4HealTable = supportSlot ? supportFastHealTables![m] : fastHealTables[m];
        const ehp =
          hp +
          fastHealTables[i][iMask] +
          fastHealTables[j][jMask] +
          fastHealTables[k][kMask] +
          fastHealTables[l][lMask] +
          c4HealTable[mMask];
        if (ehp < snapshot.minEHP) return null;
      }
    }

    const c0DamageTable = fastThresholdDamageTables[i];
    const c1DamageTable = fastThresholdDamageTables[j];
    const c2DamageTable = fastThresholdDamageTables[k];
    const c3DamageTable = fastThresholdDamageTables[l];
    const c4DamageTable = supportSlot ? supportFastDamageTables![m] : fastThresholdDamageTables[m];
    if (
      c0DamageTable === undefined ||
      c1DamageTable === undefined ||
      c2DamageTable === undefined ||
      c3DamageTable === undefined ||
      c4DamageTable === undefined
    ) {
      return undefined;
    }
    const needsMinDamageTable = basicDuoAttackNum < 10;
    const c0MinDamageTable = needsMinDamageTable ? fastThresholdDamageMinTables?.[i] : undefined;
    const c1MinDamageTable = needsMinDamageTable ? fastThresholdDamageMinTables?.[j] : undefined;
    const c2MinDamageTable = needsMinDamageTable ? fastThresholdDamageMinTables?.[k] : undefined;
    const c3MinDamageTable = needsMinDamageTable ? fastThresholdDamageMinTables?.[l] : undefined;
    const c4MinDamageTable = needsMinDamageTable
      ? (supportSlot ? supportFastDamageMinTables?.[m] : fastThresholdDamageMinTables?.[m])
      : undefined;
    if (
      needsMinDamageTable &&
      (
        c0MinDamageTable === undefined ||
        c1MinDamageTable === undefined ||
        c2MinDamageTable === undefined ||
        c3MinDamageTable === undefined ||
        c4MinDamageTable === undefined
      )
    ) {
      return undefined;
    }

    const c0BaseDamageIndex = ((fastDuoBaseOffsets[i] !== 0 || (duoMask & 1) !== 0) ? 8 : 0) + iMask;
    const c1BaseDamageIndex = ((fastDuoBaseOffsets[j] !== 0 || (duoMask & 2) !== 0) ? 8 : 0) + jMask;
    const c2BaseDamageIndex = ((fastDuoBaseOffsets[k] !== 0 || (duoMask & 4) !== 0) ? 8 : 0) + kMask;
    const c3BaseDamageIndex = ((fastDuoBaseOffsets[l] !== 0 || (duoMask & 8) !== 0) ? 8 : 0) + lMask;
    const c4BaseDamageIndex = ((c4DuoBaseOffset !== 0 || (duoMask & 16) !== 0) ? 8 : 0) + mMask;
    const calculateRaw = (metricOffset: number): number => calculateBasicDuoDamageRaw(
      metricOffset,
      c0DamageTable,
      c1DamageTable,
      c2DamageTable,
      c3DamageTable,
      c4DamageTable,
      c0MinDamageTable,
      c1MinDamageTable,
      c2MinDamageTable,
      c3MinDamageTable,
      c4MinDamageTable,
      c0BaseDamageIndex,
      c1BaseDamageIndex,
      c2BaseDamageIndex,
      c3BaseDamageIndex,
      c4BaseDamageIndex,
    );
    const secondaryRaw = calculateRaw(basicDuoSecondaryMetricOffset);
    let referenceRaw: number | undefined = basicDuoSecondaryDamageMetric === DAMAGE_METRIC_REFERENCE ? secondaryRaw : undefined;
    let advantageRaw: number | undefined = basicDuoSecondaryDamageMetric === DAMAGE_METRIC_ADVANTAGE ? secondaryRaw : undefined;
    let vsHiRaw: number | undefined = basicDuoSecondaryDamageMetric === DAMAGE_METRIC_VS_HI ? secondaryRaw : undefined;
    let vsMizuRaw: number | undefined = basicDuoSecondaryDamageMetric === DAMAGE_METRIC_VS_MIZU ? secondaryRaw : undefined;
    let vsKiRaw: number | undefined = basicDuoSecondaryDamageMetric === DAMAGE_METRIC_VS_KI ? secondaryRaw : undefined;
    if (snapshot.minReferenceDamage > 0) {
      if (referenceRaw === undefined) referenceRaw = calculateRaw(basicDuoReferenceMetricOffset);
      if (referenceRaw < snapshot.minReferenceDamage) return null;
    }
    if (snapshot.minReferenceAdvantageDamage > 0) {
      if (advantageRaw === undefined) advantageRaw = calculateRaw(basicDuoAdvantageMetricOffset);
      if (advantageRaw < snapshot.minReferenceAdvantageDamage) return null;
    }
    if (snapshot.minReferenceVsHiDamage > 0) {
      if (vsHiRaw === undefined) vsHiRaw = calculateRaw(basicDuoVsHiMetricOffset);
      if (vsHiRaw < snapshot.minReferenceVsHiDamage) return null;
    }
    if (snapshot.minReferenceVsMizuDamage > 0) {
      if (vsMizuRaw === undefined) vsMizuRaw = calculateRaw(basicDuoVsMizuMetricOffset);
      if (vsMizuRaw < snapshot.minReferenceVsMizuDamage) return null;
    }
    if (snapshot.minReferenceVsKiDamage > 0) {
      if (vsKiRaw === undefined) vsKiRaw = calculateRaw(basicDuoVsKiMetricOffset);
      if (vsKiRaw < snapshot.minReferenceVsKiDamage) return null;
    }

    return {
      primaryScore,
      secondaryScore: Math.floor(secondaryRaw),
      i,
      j,
      k,
      l,
      m,
    };
  };

  const basicDuoEvaluateCombinationScratch = new Array<Character>(5);
  const basicDuoSeedCombinationScratch = new Array<Character>(5);
  const basicDuoSecondarySortRetIndex = sortKeyToRetIndex[basicDuoSecondarySortKey] ?? -1;
  const preseedBasicDuoExactThreshold = (lengthes: number[]) => {
    if (
      !metricPrimaryFastEntries ||
      !usesBasicDuoExactCombinationFastPath ||
      metricPrimaryFastMaxSize <= 0 ||
      basicDuoSecondarySortRetIndex < 0
    ) {
      return;
    }

    const pickCount = 5 - requiredCount;
    if (pickCount <= 0) return;
    const maxSeedCombinations = Math.max(
      50000,
      Math.min(250000, metricPrimaryFastMaxSize * 250),
    );
    let candidateLimit = Math.min(lengthes[4], Math.max(requiredCount + pickCount, requiredCount + 120));
    while (
      candidateLimit > requiredCount + pickCount &&
      combinationCount(candidateLimit - requiredCount, pickCount) > maxSeedCombinations
    ) {
      candidateLimit -= 1;
    }
    if (candidateLimit - requiredCount < pickCount) return;

    const seedEntries: { primaryScore: number; secondaryScore: number }[] = [];
    let seedThresholdPrimary = -Infinity;
    let seedThresholdSecondary = -Infinity;
    const compareSeedEntries = (
      a: { primaryScore: number; secondaryScore: number },
      b: { primaryScore: number; secondaryScore: number },
    ): number => {
      if (a.primaryScore !== b.primaryScore) return b.primaryScore - a.primaryScore;
      if (a.secondaryScore !== b.secondaryScore) return b.secondaryScore - a.secondaryScore;
      return 0;
    };
    const updateSeedThreshold = () => {
      const worst = seedEntries[metricPrimaryFastMaxSize - 1];
      seedThresholdPrimary = worst.primaryScore;
      seedThresholdSecondary = worst.secondaryScore;
    };
    const seedCouldEnter = (primaryScore: number, secondaryScore: number): boolean => {
      if (seedEntries.length < metricPrimaryFastMaxSize) return true;
      if (primaryScore > seedThresholdPrimary) return true;
      if (primaryScore < seedThresholdPrimary) return false;
      return secondaryScore >= seedThresholdSecondary;
    };
    const addSeedEntry = (primaryScore: number, secondaryScore: number) => {
      if (!seedCouldEnter(primaryScore, secondaryScore)) return;
      const entry = { primaryScore, secondaryScore };
      if (seedEntries.length < metricPrimaryFastMaxSize) {
        seedEntries.push(entry);
        if (seedEntries.length === metricPrimaryFastMaxSize) {
          seedEntries.sort(compareSeedEntries);
          updateSeedThreshold();
        }
        return;
      }
      let left = 0;
      let right = seedEntries.length;
      while (left < right) {
        const mid = (left + right) >>> 1;
        if (compareSeedEntries(entry, seedEntries[mid]) < 0) right = mid;
        else left = mid + 1;
      }
      if (left >= metricPrimaryFastMaxSize) return;
      for (let index = metricPrimaryFastMaxSize - 1; index > left; index--) {
        seedEntries[index] = seedEntries[index - 1];
      }
      seedEntries[left] = entry;
      updateSeedThreshold();
    };

    const seedCombination = basicDuoSeedCombinationScratch;
    const seedIndexes = new Int32Array(5);
    for (let i = 0; i < requiredCount; i++) {
      seedCombination[i] = nonZero[i];
      seedIndexes[i] = i;
    }
    const evaluateSeed = () => {
      const fastScore = evaluateBasicDuoPrimaryByIndexFast(
        seedIndexes[0],
        seedIndexes[1],
        seedIndexes[2],
        seedIndexes[3],
        seedIndexes[4],
        false,
      );
      if (fastScore !== undefined) {
        if (fastScore !== null) {
          addSeedEntry(fastScore.primaryScore, fastScore.secondaryScore);
        }
        return;
      }
      const evaluationCombination = basicDuoEvaluateCombinationScratch;
      copyLegacyOutputCombination(
        seedCombination[0],
        seedCombination[1],
        seedCombination[2],
        seedCombination[3],
        seedCombination[4],
        false,
        evaluationCombination,
      );
      const ret = calcDeckStatus(evaluationCombination, primaryPassOptions);
      if (!ret) return;
      const primaryScore = ret[primarySortRetIndex] as number;
      if (primaryScore < snapshot.minDuo) return;
      const secondaryScore = ret[basicDuoSecondarySortRetIndex] as number;
      addSeedEntry(primaryScore, secondaryScore);
    };
    const chooseSeed = (depth: number, start: number) => {
      if (depth === 5) {
        evaluateSeed();
        return;
      }
      const remaining = 5 - depth;
      for (let index = start; index <= candidateLimit - remaining; index++) {
        seedCombination[depth] = nonZero[index];
        seedIndexes[depth] = index;
        chooseSeed(depth + 1, index + 1);
      }
    };
    chooseSeed(requiredCount, requiredCount);

    if (seedEntries.length >= metricPrimaryFastMaxSize) {
      metricPrimarySeedThresholdPrimary = seedThresholdPrimary;
      metricPrimarySeedThresholdSecondary = seedThresholdSecondary;
    }
  };
  const preseedBasicDuoSupportExactThreshold = (lengthes: number[]) => {
    if (
      !metricPrimaryFastEntries ||
      !canUseBasicDuoPrimarySupportFastLoop ||
      metricPrimaryFastMaxSize <= 0 ||
      basicDuoSecondarySortRetIndex < 0 ||
      maxLevel.length === 0
    ) {
      return;
    }

    const maxSeedCombinations = Math.max(
      50000,
      Math.min(250000, metricPrimaryFastMaxSize * 250),
    );
    const pickCount = 4 - requiredCount;
    let normalLimit = Math.min(lengthes[3], Math.max(requiredCount + pickCount, requiredCount + 64));
    let supportLimit = Math.min(maxLevel.length, 64);
    while (
      normalLimit > requiredCount + pickCount &&
      combinationCount(normalLimit - requiredCount, pickCount) * supportLimit > maxSeedCombinations
    ) {
      normalLimit -= 1;
    }
    while (
      supportLimit > 12 &&
      combinationCount(normalLimit - requiredCount, pickCount) * supportLimit > maxSeedCombinations
    ) {
      supportLimit -= 1;
    }
    if (normalLimit - requiredCount < pickCount || supportLimit < 1) return;

    const availableNormalCount = lengthes[3] - requiredCount;
    const normalSeedCount = normalLimit - requiredCount;
    const normalOrder = new Int32Array(availableNormalCount);
    for (let index = 0; index < availableNormalCount; index++) {
      normalOrder[index] = requiredCount + index;
    }
    normalOrder.sort((a, b) => {
      const diff = basicDuoSecondaryUpperScores![b] - basicDuoSecondaryUpperScores![a];
      if (diff !== 0) return diff;
      return a - b;
    });
    const supportOrder = new Int32Array(maxLevel.length);
    for (let index = 0; index < maxLevel.length; index++) {
      supportOrder[index] = index;
    }
    supportOrder.sort((a, b) => {
      const diff = basicDuoSupportSecondaryUpperScores![b] - basicDuoSupportSecondaryUpperScores![a];
      if (diff !== 0) return diff;
      return a - b;
    });

    const seedEntries: { primaryScore: number; secondaryScore: number }[] = [];
    let seedThresholdPrimary = -Infinity;
    let seedThresholdSecondary = -Infinity;
    const compareSeedEntries = (
      a: { primaryScore: number; secondaryScore: number },
      b: { primaryScore: number; secondaryScore: number },
    ): number => {
      if (a.primaryScore !== b.primaryScore) return b.primaryScore - a.primaryScore;
      if (a.secondaryScore !== b.secondaryScore) return b.secondaryScore - a.secondaryScore;
      return 0;
    };
    const updateSeedThreshold = () => {
      const worst = seedEntries[metricPrimaryFastMaxSize - 1];
      seedThresholdPrimary = worst.primaryScore;
      seedThresholdSecondary = worst.secondaryScore;
    };
    const seedCouldEnter = (primaryScore: number, secondaryScore: number): boolean => {
      if (seedEntries.length < metricPrimaryFastMaxSize) return true;
      if (primaryScore > seedThresholdPrimary) return true;
      if (primaryScore < seedThresholdPrimary) return false;
      return secondaryScore >= seedThresholdSecondary;
    };
    const addSeedEntry = (primaryScore: number, secondaryScore: number) => {
      if (!seedCouldEnter(primaryScore, secondaryScore)) return;
      const entry = { primaryScore, secondaryScore };
      if (seedEntries.length < metricPrimaryFastMaxSize) {
        seedEntries.push(entry);
        if (seedEntries.length === metricPrimaryFastMaxSize) {
          seedEntries.sort(compareSeedEntries);
          updateSeedThreshold();
        }
        return;
      }
      let left = 0;
      let right = seedEntries.length;
      while (left < right) {
        const mid = (left + right) >>> 1;
        if (compareSeedEntries(entry, seedEntries[mid]) < 0) right = mid;
        else left = mid + 1;
      }
      if (left >= metricPrimaryFastMaxSize) return;
      for (let index = metricPrimaryFastMaxSize - 1; index > left; index--) {
        seedEntries[index] = seedEntries[index - 1];
      }
      seedEntries[left] = entry;
      updateSeedThreshold();
    };

    const seedCombination = basicDuoSeedCombinationScratch;
    const seedIndexes = new Int32Array(5);
    const evaluateSeed = () => {
      const fastScore = evaluateBasicDuoPrimaryByIndexFast(
        seedIndexes[0],
        seedIndexes[1],
        seedIndexes[2],
        seedIndexes[3],
        seedIndexes[4],
        true,
      );
      if (fastScore !== undefined) {
        if (fastScore !== null) {
          addSeedEntry(fastScore.primaryScore, fastScore.secondaryScore);
        }
        return;
      }
      const evaluationCombination = basicDuoEvaluateCombinationScratch;
      copyLegacyOutputCombination(
        seedCombination[0],
        seedCombination[1],
        seedCombination[2],
        seedCombination[3],
        seedCombination[4],
        true,
        evaluationCombination,
      );
      const ret = calcDeckStatus(evaluationCombination, primaryPassOptions);
      if (!ret) return;
      const primaryScore = ret[primarySortRetIndex] as number;
      if (primaryScore < snapshot.minDuo) return;
      const secondaryScore = ret[basicDuoSecondarySortRetIndex] as number;
      addSeedEntry(primaryScore, secondaryScore);
    };

    for (let index = 0; index < requiredCount; index++) {
      seedCombination[index] = nonZero[index];
      seedIndexes[index] = index;
    }
    const chooseSeedNormal = (depth: number, start: number) => {
      if (depth === 4) {
        for (let supportIndex = 0; supportIndex < supportLimit; supportIndex++) {
          const orderedSupportIndex = supportOrder[supportIndex];
          seedIndexes[4] = orderedSupportIndex;
          seedCombination[4] = maxLevel[orderedSupportIndex];
          evaluateSeed();
        }
        return;
      }
      const remaining = 4 - depth;
      for (let orderIndex = start; orderIndex <= normalSeedCount - remaining; orderIndex++) {
        const normalIndex = normalOrder[orderIndex];
        seedIndexes[depth] = normalIndex;
        seedCombination[depth] = nonZero[normalIndex];
        chooseSeedNormal(depth + 1, orderIndex + 1);
      }
    };
    chooseSeedNormal(requiredCount, 0);

    if (seedEntries.length >= metricPrimaryFastMaxSize) {
      metricPrimarySeedThresholdPrimary = seedThresholdPrimary;
      metricPrimarySeedThresholdSecondary = seedThresholdSecondary;
      if (debugCounters) {
        debugCounters.basicDuoSupportSeedNormalLimit = normalLimit;
        debugCounters.basicDuoSupportSeedSupportLimit = supportLimit;
      }
    }
  };
  const processBasicDuoPrimaryCombinationExact = (
    source0: Character,
    source1: Character,
    source2: Character,
    source3: Character,
    source4: Character,
    supportSlot = false,
  ) => {
    const evaluationCombination = basicDuoEvaluateCombinationScratch;
    copyLegacyOutputCombination(
      source0,
      source1,
      source2,
      source3,
      source4,
      supportSlot,
      evaluationCombination,
    );
    const c0 = evaluationCombination[0];
    const c1 = evaluationCombination[1];
    const c2 = evaluationCombination[2];
    const c3 = evaluationCombination[3];
    const c4 = evaluationCombination[4];
    const c0Any = c0 as any;
    const c1Any = c1 as any;
    const c2Any = c2 as any;
    const c3Any = c3 as any;
    const c4Any = c4 as any;
    const presenceLow = (
      (c0Any.charaBitLowCached as number) |
      (c1Any.charaBitLowCached as number) |
      (c2Any.charaBitLowCached as number) |
      (c3Any.charaBitLowCached as number) |
      (c4Any.charaBitLowCached as number)
    ) >>> 0;
    const presenceHigh = (
      (c0Any.charaBitHighCached as number) |
      (c1Any.charaBitHighCached as number) |
      (c2Any.charaBitHighCached as number) |
      (c3Any.charaBitHighCached as number) |
      (c4Any.charaBitHighCached as number)
    ) >>> 0;
    const c0Mask = getActiveBuddyMaskFromPresence(c0Any, presenceLow, presenceHigh);
    const c1Mask = getActiveBuddyMaskFromPresence(c1Any, presenceLow, presenceHigh);
    const c2Mask = getActiveBuddyMaskFromPresence(c2Any, presenceLow, presenceHigh);
    const c3Mask = getActiveBuddyMaskFromPresence(c3Any, presenceLow, presenceHigh);
    const c4Mask = getActiveBuddyMaskFromPresence(c4Any, presenceLow, presenceHigh);

    if (
      c0.evasion + c1.evasion + c2.evasion + c3.evasion + c4.evasion < snapshot.minEvasion ||
      ((c0Any.totalBuffCached as number) ?? 0) +
        ((c1Any.totalBuffCached as number) ?? 0) +
        ((c2Any.totalBuffCached as number) ?? 0) +
        ((c3Any.totalBuffCached as number) ?? 0) +
        ((c4Any.totalBuffCached as number) ?? 0) < snapshot.minBuff ||
      ((c0Any.totalDebuffCached as number) ?? 0) +
        ((c1Any.totalDebuffCached as number) ?? 0) +
        ((c2Any.totalDebuffCached as number) ?? 0) +
        ((c3Any.totalDebuffCached as number) ?? 0) +
        ((c4Any.totalDebuffCached as number) ?? 0) < snapshot.minDebuff ||
      ((c0Any.magicCosmicCountCached as number) ?? 0) +
        ((c1Any.magicCosmicCountCached as number) ?? 0) +
        ((c2Any.magicCosmicCountCached as number) ?? 0) +
        ((c3Any.magicCosmicCountCached as number) ?? 0) +
        ((c4Any.magicCosmicCountCached as number) ?? 0) < snapshot.minCosmic ||
      ((c0Any.magicFireCountCached as number) ?? 0) +
        ((c1Any.magicFireCountCached as number) ?? 0) +
        ((c2Any.magicFireCountCached as number) ?? 0) +
        ((c3Any.magicFireCountCached as number) ?? 0) +
        ((c4Any.magicFireCountCached as number) ?? 0) < snapshot.minFire ||
      ((c0Any.magicWaterCountCached as number) ?? 0) +
        ((c1Any.magicWaterCountCached as number) ?? 0) +
        ((c2Any.magicWaterCountCached as number) ?? 0) +
        ((c3Any.magicWaterCountCached as number) ?? 0) +
        ((c4Any.magicWaterCountCached as number) ?? 0) < snapshot.minWater ||
      ((c0Any.magicFloraCountCached as number) ?? 0) +
        ((c1Any.magicFloraCountCached as number) ?? 0) +
        ((c2Any.magicFloraCountCached as number) ?? 0) +
        ((c3Any.magicFloraCountCached as number) ?? 0) +
        ((c4Any.magicFloraCountCached as number) ?? 0) < snapshot.minFlora ||
      ((c0Any.healCardCountCached as number) ?? 0) +
        ((c1Any.healCardCountCached as number) ?? 0) +
        ((c2Any.healCardCountCached as number) ?? 0) +
        ((c3Any.healCardCountCached as number) ?? 0) +
        ((c4Any.healCardCountCached as number) ?? 0) < snapshot.minHealNum
    ) {
      nowResultsCount += 1;
      return;
    }

    if (snapshot.minHP > 0 || snapshot.minEHP > 0) {
      const hp =
        (c0Any.hpByBuddyMaskCached as Float64Array)[c0Mask] +
        (c1Any.hpByBuddyMaskCached as Float64Array)[c1Mask] +
        (c2Any.hpByBuddyMaskCached as Float64Array)[c2Mask] +
        (c3Any.hpByBuddyMaskCached as Float64Array)[c3Mask] +
        (c4Any.hpByBuddyMaskCached as Float64Array)[c4Mask];
      if (hp < snapshot.minHP) {
        nowResultsCount += 1;
        return;
      }
      if (
        snapshot.minEHP > 0 &&
        hp +
          (c0Any.healByBuddyMaskCached as Float64Array)[c0Mask] +
          (c1Any.healByBuddyMaskCached as Float64Array)[c1Mask] +
          (c2Any.healByBuddyMaskCached as Float64Array)[c2Mask] +
          (c3Any.healByBuddyMaskCached as Float64Array)[c3Mask] +
          (c4Any.healByBuddyMaskCached as Float64Array)[c4Mask] < snapshot.minEHP
      ) {
        nowResultsCount += 1;
        return;
      }
    }

    const duoMask = resolveFixedFiveDuoMaskFromIds(
      c0Any.charaId as number,
      c1Any.charaId as number,
      c2Any.charaId as number,
      c3Any.charaId as number,
      c4Any.charaId as number,
      c0Any.duoId as number,
      c1Any.duoId as number,
      c2Any.duoId as number,
      c3Any.duoId as number,
      c4Any.duoId as number,
      c0Any.useM2Cached as boolean,
      c1Any.useM2Cached as boolean,
      c2Any.useM2Cached as boolean,
      c3Any.useM2Cached as boolean,
      c4Any.useM2Cached as boolean,
    );
    const primaryScore = countFixedFiveDuoBits(duoMask);
    if (primaryScore < snapshot.minDuo || !metricPrimaryShouldConsider(primaryScore)) {
      nowResultsCount += 1;
      return;
    }

    const c0DamageTable = c0Any.primaryDamageTop2ByMaskCached as Float64Array | undefined;
    const c1DamageTable = c1Any.primaryDamageTop2ByMaskCached as Float64Array | undefined;
    const c2DamageTable = c2Any.primaryDamageTop2ByMaskCached as Float64Array | undefined;
    const c3DamageTable = c3Any.primaryDamageTop2ByMaskCached as Float64Array | undefined;
    const c4DamageTable = c4Any.primaryDamageTop2ByMaskCached as Float64Array | undefined;
    if (
      c0DamageTable === undefined ||
      c1DamageTable === undefined ||
      c2DamageTable === undefined ||
      c3DamageTable === undefined ||
      c4DamageTable === undefined
    ) {
      processCombinationCore(evaluationCombination, supportSlot);
      return;
    }
    const needsMinDamageTable = basicDuoAttackNum < 10;
    const c0MinDamageTable = needsMinDamageTable
      ? ((c0Any.primaryDamageTop2MinByMaskCached as Float64Array | undefined) ?? ensurePrimaryDamageTop2MinByMask(c0, c0Any))
      : undefined;
    const c1MinDamageTable = needsMinDamageTable
      ? ((c1Any.primaryDamageTop2MinByMaskCached as Float64Array | undefined) ?? ensurePrimaryDamageTop2MinByMask(c1, c1Any))
      : undefined;
    const c2MinDamageTable = needsMinDamageTable
      ? ((c2Any.primaryDamageTop2MinByMaskCached as Float64Array | undefined) ?? ensurePrimaryDamageTop2MinByMask(c2, c2Any))
      : undefined;
    const c3MinDamageTable = needsMinDamageTable
      ? ((c3Any.primaryDamageTop2MinByMaskCached as Float64Array | undefined) ?? ensurePrimaryDamageTop2MinByMask(c3, c3Any))
      : undefined;
    const c4MinDamageTable = needsMinDamageTable
      ? ((c4Any.primaryDamageTop2MinByMaskCached as Float64Array | undefined) ?? ensurePrimaryDamageTop2MinByMask(c4, c4Any))
      : undefined;
    const c0BaseDamageIndex = (((c0Any.magic2IsDuoBaseCached as boolean) === true || (duoMask & 1) !== 0) ? 8 : 0) + c0Mask;
    const c1BaseDamageIndex = (((c1Any.magic2IsDuoBaseCached as boolean) === true || (duoMask & 2) !== 0) ? 8 : 0) + c1Mask;
    const c2BaseDamageIndex = (((c2Any.magic2IsDuoBaseCached as boolean) === true || (duoMask & 4) !== 0) ? 8 : 0) + c2Mask;
    const c3BaseDamageIndex = (((c3Any.magic2IsDuoBaseCached as boolean) === true || (duoMask & 8) !== 0) ? 8 : 0) + c3Mask;
    const c4BaseDamageIndex = (((c4Any.magic2IsDuoBaseCached as boolean) === true || (duoMask & 16) !== 0) ? 8 : 0) + c4Mask;
    const secondaryRaw = calculateBasicDuoDamageRaw(
      basicDuoSecondaryMetricOffset,
      c0DamageTable,
      c1DamageTable,
      c2DamageTable,
      c3DamageTable,
      c4DamageTable,
      c0MinDamageTable,
      c1MinDamageTable,
      c2MinDamageTable,
      c3MinDamageTable,
      c4MinDamageTable,
      c0BaseDamageIndex,
      c1BaseDamageIndex,
      c2BaseDamageIndex,
      c3BaseDamageIndex,
      c4BaseDamageIndex,
    );
    let referenceRaw: number | undefined = basicDuoSecondaryDamageMetric === DAMAGE_METRIC_REFERENCE ? secondaryRaw : undefined;
    let advantageRaw: number | undefined = basicDuoSecondaryDamageMetric === DAMAGE_METRIC_ADVANTAGE ? secondaryRaw : undefined;
    let vsHiRaw: number | undefined = basicDuoSecondaryDamageMetric === DAMAGE_METRIC_VS_HI ? secondaryRaw : undefined;
    let vsMizuRaw: number | undefined = basicDuoSecondaryDamageMetric === DAMAGE_METRIC_VS_MIZU ? secondaryRaw : undefined;
    let vsKiRaw: number | undefined = basicDuoSecondaryDamageMetric === DAMAGE_METRIC_VS_KI ? secondaryRaw : undefined;
    if (snapshot.minReferenceDamage > 0) {
      if (referenceRaw === undefined) {
        referenceRaw = calculateBasicDuoDamageRaw(
          basicDuoReferenceMetricOffset,
          c0DamageTable,
          c1DamageTable,
          c2DamageTable,
          c3DamageTable,
          c4DamageTable,
          c0MinDamageTable,
          c1MinDamageTable,
          c2MinDamageTable,
          c3MinDamageTable,
          c4MinDamageTable,
          c0BaseDamageIndex,
          c1BaseDamageIndex,
          c2BaseDamageIndex,
          c3BaseDamageIndex,
          c4BaseDamageIndex,
        );
      }
      if (referenceRaw < snapshot.minReferenceDamage) {
        nowResultsCount += 1;
        return;
      }
    }
    if (snapshot.minReferenceAdvantageDamage > 0) {
      if (advantageRaw === undefined) {
        advantageRaw = calculateBasicDuoDamageRaw(
          basicDuoAdvantageMetricOffset,
          c0DamageTable,
          c1DamageTable,
          c2DamageTable,
          c3DamageTable,
          c4DamageTable,
          c0MinDamageTable,
          c1MinDamageTable,
          c2MinDamageTable,
          c3MinDamageTable,
          c4MinDamageTable,
          c0BaseDamageIndex,
          c1BaseDamageIndex,
          c2BaseDamageIndex,
          c3BaseDamageIndex,
          c4BaseDamageIndex,
        );
      }
      if (advantageRaw < snapshot.minReferenceAdvantageDamage) {
        nowResultsCount += 1;
        return;
      }
    }
    if (snapshot.minReferenceVsHiDamage > 0) {
      if (vsHiRaw === undefined) {
        vsHiRaw = calculateBasicDuoDamageRaw(
          basicDuoVsHiMetricOffset,
          c0DamageTable,
          c1DamageTable,
          c2DamageTable,
          c3DamageTable,
          c4DamageTable,
          c0MinDamageTable,
          c1MinDamageTable,
          c2MinDamageTable,
          c3MinDamageTable,
          c4MinDamageTable,
          c0BaseDamageIndex,
          c1BaseDamageIndex,
          c2BaseDamageIndex,
          c3BaseDamageIndex,
          c4BaseDamageIndex,
        );
      }
      if (vsHiRaw < snapshot.minReferenceVsHiDamage) {
        nowResultsCount += 1;
        return;
      }
    }
    if (snapshot.minReferenceVsMizuDamage > 0) {
      if (vsMizuRaw === undefined) {
        vsMizuRaw = calculateBasicDuoDamageRaw(
          basicDuoVsMizuMetricOffset,
          c0DamageTable,
          c1DamageTable,
          c2DamageTable,
          c3DamageTable,
          c4DamageTable,
          c0MinDamageTable,
          c1MinDamageTable,
          c2MinDamageTable,
          c3MinDamageTable,
          c4MinDamageTable,
          c0BaseDamageIndex,
          c1BaseDamageIndex,
          c2BaseDamageIndex,
          c3BaseDamageIndex,
          c4BaseDamageIndex,
        );
      }
      if (vsMizuRaw < snapshot.minReferenceVsMizuDamage) {
        nowResultsCount += 1;
        return;
      }
    }
    if (snapshot.minReferenceVsKiDamage > 0) {
      if (vsKiRaw === undefined) {
        vsKiRaw = calculateBasicDuoDamageRaw(
          basicDuoVsKiMetricOffset,
          c0DamageTable,
          c1DamageTable,
          c2DamageTable,
          c3DamageTable,
          c4DamageTable,
          c0MinDamageTable,
          c1MinDamageTable,
          c2MinDamageTable,
          c3MinDamageTable,
          c4MinDamageTable,
          c0BaseDamageIndex,
          c1BaseDamageIndex,
          c2BaseDamageIndex,
          c3BaseDamageIndex,
          c4BaseDamageIndex,
        );
      }
      if (vsKiRaw < snapshot.minReferenceVsKiDamage) {
        nowResultsCount += 1;
        return;
      }
    }

    const secondaryScore = Math.floor(secondaryRaw);
    if (metricPrimaryFastEntries) {
      if (metricPrimaryCouldBeat(primaryScore, secondaryScore)) {
        addMetricPrimaryFastEntry(primaryScore, secondaryScore, c0, c1, c2, c3, c4, supportSlot);
      }
      nowResultsCount += 1;
      return;
    }
    const transformedRet = ({ simuURL: '', detailList: emptyDetailList } as DeckResult);
    const transformedRetAny = transformedRet as any;
    transformedRetAny[sortCompareKeys[0]] = primaryScore;
    transformedRetAny[sortCompareKeys[1]] = secondaryScore;
    transformedRetAny._deckKey = buildLegacyDeckKey(c0, c1, c2, c3, c4, supportSlot);
    const added = resultsManager.addDeck(transformedRet);
    if (added) {
      transformedRetAny._combo0 = c0;
      transformedRetAny._combo1 = c1;
      transformedRetAny._combo2 = c2;
      transformedRetAny._combo3 = c3;
      transformedRetAny._combo4 = c4;
      if (supportSlot) transformedRetAny._supportSlot = true;
    }
    nowResultsCount += 1;
  };

  const processBasicDuoPrimaryCombinationByIndex = (
    i: number,
    j: number,
    k: number,
    l: number,
    m: number,
  ) => {
    processBasicDuoPrimaryCombinationExact(nonZero[i], nonZero[j], nonZero[k], nonZero[l], nonZero[m], false);
  };

  const processBasicDuoPrimarySupportCombinationByIndex = (
    i: number,
    j: number,
    k: number,
    l: number,
    m: number,
  ) => {
    const fastScore = evaluateBasicDuoPrimaryByIndexFast(i, j, k, l, m, true);
    if (fastScore !== undefined) {
      if (fastScore !== null && metricPrimaryCouldBeat(fastScore.primaryScore, fastScore.secondaryScore)) {
        addMetricPrimaryFastEntry(
          fastScore.primaryScore,
          fastScore.secondaryScore,
          nonZero[fastScore.i],
          nonZero[fastScore.j],
          nonZero[fastScore.k],
          nonZero[fastScore.l],
          maxLevel[fastScore.m],
          true,
        );
      }
      nowResultsCount += 1;
      return;
    }
    processBasicDuoPrimaryCombinationExact(nonZero[i], nonZero[j], nonZero[k], nonZero[l], maxLevel[m], true);
  };

  const runFixedBasicDuoPrimaryFastLoop = async (lengthes: number[]): Promise<boolean> => {
    if (
      !metricPrimaryFastEntries ||
      !fastUseM2 ||
      !basicDuoSecondaryUpperScores ||
      !basicDuoSecondaryUpperSuffixTopSums ||
      requiredCount <= 0 ||
      requiredCount >= 5
    ) {
      return false;
    }

    const charaLow = new Uint32Array(listLength);
    const charaHigh = new Uint32Array(listLength);
    const duoLow = new Uint32Array(listLength);
    const duoHigh = new Uint32Array(listLength);
    const suffixCharaLow = new Uint32Array(listLength + 1);
    const suffixCharaHigh = new Uint32Array(listLength + 1);
    for (let index = 0; index < listLength; index++) {
      const charaAny = nonZero[index] as any;
      charaLow[index] = (charaAny.charaBitLowCached as number) >>> 0;
      charaHigh[index] = (charaAny.charaBitHighCached as number) >>> 0;
      duoLow[index] = (charaAny.duoBitLowCached as number) >>> 0;
      duoHigh[index] = (charaAny.duoBitHighCached as number) >>> 0;
    }
    for (let index = listLength - 1; index >= 0; index--) {
      suffixCharaLow[index] = (suffixCharaLow[index + 1] | charaLow[index]) >>> 0;
      suffixCharaHigh[index] = (suffixCharaHigh[index + 1] | charaHigh[index]) >>> 0;
    }

    let baseLow = 0;
    let baseHigh = 0;
    let baseSecondaryUpper = 0;
    for (let index = 0; index < requiredCount; index++) {
      baseLow = (baseLow | charaLow[index]) >>> 0;
      baseHigh = (baseHigh | charaHigh[index]) >>> 0;
      baseSecondaryUpper += basicDuoSecondaryUpperScores[index];
    }

    const selectedDuoUpper = (
      a: number,
      b: number,
      c: number,
      d: number,
      e: number,
      selectedCount: number,
      selectedLow: number,
      selectedHigh: number,
      suffixStart: number,
      remainingPickCount: number,
    ): number => {
      const availableLow = (selectedLow | suffixCharaLow[suffixStart]) >>> 0;
      const availableHigh = (selectedHigh | suffixCharaHigh[suffixStart]) >>> 0;
      let count = 0;
      if (selectedCount > 0 && fastUseM2[a] !== 0 && (((duoLow[a] & availableLow) | (duoHigh[a] & availableHigh)) !== 0)) count += 1;
      if (selectedCount > 1 && fastUseM2[b] !== 0 && (((duoLow[b] & availableLow) | (duoHigh[b] & availableHigh)) !== 0)) count += 1;
      if (selectedCount > 2 && fastUseM2[c] !== 0 && (((duoLow[c] & availableLow) | (duoHigh[c] & availableHigh)) !== 0)) count += 1;
      if (selectedCount > 3 && fastUseM2[d] !== 0 && (((duoLow[d] & availableLow) | (duoHigh[d] & availableHigh)) !== 0)) count += 1;
      if (selectedCount > 4 && fastUseM2[e] !== 0 && (((duoLow[e] & availableLow) | (duoHigh[e] & availableHigh)) !== 0)) count += 1;
      const upper = count + remainingPickCount;
      return upper > 5 ? 5 : upper;
    };

    const branchCouldBeat = (
      a: number,
      b: number,
      c: number,
      d: number,
      e: number,
      selectedCount: number,
      selectedLow: number,
      selectedHigh: number,
      suffixStart: number,
      remainingPickCount: number,
      secondaryUpper: number,
    ): boolean => {
      const duoUpper = selectedDuoUpper(
        a,
        b,
        c,
        d,
        e,
        selectedCount,
        selectedLow,
        selectedHigh,
        suffixStart,
        remainingPickCount,
      );
      return metricPrimaryCouldBeat(
        duoUpper,
        secondaryUpper + basicDuoSecondaryUpperSuffixTopSums[remainingPickCount][suffixStart],
      );
    };

    let searchCheckCounter = 0;
    if (requiredCount === 1) {
      if (!branchCouldBeat(0, 0, 0, 0, 0, 1, baseLow, baseHigh, 1, 4, baseSecondaryUpper)) {
        nowResultsCount += combinationCount(listLength - 1, 4);
        return true;
      }
      for (let a = 1; a < lengthes[4] - 3; a++) {
        const aLow = (baseLow | charaLow[a]) >>> 0;
        const aHigh = (baseHigh | charaHigh[a]) >>> 0;
        const aSecondary = baseSecondaryUpper + basicDuoSecondaryUpperScores[a];
        if (!branchCouldBeat(0, a, 0, 0, 0, 2, aLow, aHigh, a + 1, 3, aSecondary)) {
          nowResultsCount += combinationCount(lengthes[4] - a - 1, 3);
          continue;
        }
        for (let b = a + 1; b < lengthes[4] - 2; b++) {
          const bLow = (aLow | charaLow[b]) >>> 0;
          const bHigh = (aHigh | charaHigh[b]) >>> 0;
          const bSecondary = aSecondary + basicDuoSecondaryUpperScores[b];
          if (!branchCouldBeat(0, a, b, 0, 0, 3, bLow, bHigh, b + 1, 2, bSecondary)) {
            nowResultsCount += combinationCount(lengthes[4] - b - 1, 2);
            continue;
          }
          for (let c = b + 1; c < lengthes[4] - 1; c++) {
            searchCheckCounter += 1;
            if ((searchCheckCounter & SEARCH_CHECK_MASK) === 0 && !(await yieldToSearchUi())) return false;
            const cLow = (bLow | charaLow[c]) >>> 0;
            const cHigh = (bHigh | charaHigh[c]) >>> 0;
            const cSecondary = bSecondary + basicDuoSecondaryUpperScores[c];
            if (!branchCouldBeat(0, a, b, c, 0, 4, cLow, cHigh, c + 1, 1, cSecondary)) {
              nowResultsCount += lengthes[4] - c - 1;
              continue;
            }
            for (let d = c + 1; d < lengthes[4]; d++) {
              searchCheckCounter += 1;
              if ((searchCheckCounter & INNER_SEARCH_CHECK_MASK) === 0 && !(await yieldToSearchUi())) return false;
              const dLow = (cLow | charaLow[d]) >>> 0;
              const dHigh = (cHigh | charaHigh[d]) >>> 0;
              const dSecondary = cSecondary + basicDuoSecondaryUpperScores[d];
              if (!branchCouldBeat(0, a, b, c, d, 5, dLow, dHigh, lengthes[4], 0, dSecondary)) {
                nowResultsCount += 1;
                continue;
              }
              processBasicDuoPrimaryCombinationByIndex(0, a, b, c, d);
            }
          }
        }
      }
      return true;
    }

    if (requiredCount === 2) {
      if (!branchCouldBeat(0, 1, 0, 0, 0, 2, baseLow, baseHigh, 2, 3, baseSecondaryUpper)) {
        nowResultsCount += combinationCount(listLength - 2, 3);
        return true;
      }
      for (let a = 2; a < lengthes[4] - 2; a++) {
        const aLow = (baseLow | charaLow[a]) >>> 0;
        const aHigh = (baseHigh | charaHigh[a]) >>> 0;
        const aSecondary = baseSecondaryUpper + basicDuoSecondaryUpperScores[a];
        if (!branchCouldBeat(0, 1, a, 0, 0, 3, aLow, aHigh, a + 1, 2, aSecondary)) {
          nowResultsCount += combinationCount(lengthes[4] - a - 1, 2);
          continue;
        }
        for (let b = a + 1; b < lengthes[4] - 1; b++) {
          searchCheckCounter += 1;
          if ((searchCheckCounter & SEARCH_CHECK_MASK) === 0 && !(await yieldToSearchUi())) return false;
          const bLow = (aLow | charaLow[b]) >>> 0;
          const bHigh = (aHigh | charaHigh[b]) >>> 0;
          const bSecondary = aSecondary + basicDuoSecondaryUpperScores[b];
          if (!branchCouldBeat(0, 1, a, b, 0, 4, bLow, bHigh, b + 1, 1, bSecondary)) {
            nowResultsCount += lengthes[4] - b - 1;
            continue;
          }
          for (let c = b + 1; c < lengthes[4]; c++) {
            searchCheckCounter += 1;
            if ((searchCheckCounter & INNER_SEARCH_CHECK_MASK) === 0 && !(await yieldToSearchUi())) return false;
            const cLow = (bLow | charaLow[c]) >>> 0;
            const cHigh = (bHigh | charaHigh[c]) >>> 0;
            const cSecondary = bSecondary + basicDuoSecondaryUpperScores[c];
            if (!branchCouldBeat(0, 1, a, b, c, 5, cLow, cHigh, lengthes[4], 0, cSecondary)) {
              nowResultsCount += 1;
              continue;
            }
            processBasicDuoPrimaryCombinationByIndex(0, 1, a, b, c);
          }
        }
      }
      return true;
    }

    if (requiredCount === 3) {
      if (!branchCouldBeat(0, 1, 2, 0, 0, 3, baseLow, baseHigh, 3, 2, baseSecondaryUpper)) {
        nowResultsCount += combinationCount(listLength - 3, 2);
        return true;
      }
      for (let a = 3; a < lengthes[4] - 1; a++) {
        const aLow = (baseLow | charaLow[a]) >>> 0;
        const aHigh = (baseHigh | charaHigh[a]) >>> 0;
        const aSecondary = baseSecondaryUpper + basicDuoSecondaryUpperScores[a];
        if (!branchCouldBeat(0, 1, 2, a, 0, 4, aLow, aHigh, a + 1, 1, aSecondary)) {
          nowResultsCount += lengthes[4] - a - 1;
          continue;
        }
        for (let b = a + 1; b < lengthes[4]; b++) {
          searchCheckCounter += 1;
          if ((searchCheckCounter & INNER_SEARCH_CHECK_MASK) === 0 && !(await yieldToSearchUi())) return false;
          const bLow = (aLow | charaLow[b]) >>> 0;
          const bHigh = (aHigh | charaHigh[b]) >>> 0;
          const bSecondary = aSecondary + basicDuoSecondaryUpperScores[b];
          if (!branchCouldBeat(0, 1, 2, a, b, 5, bLow, bHigh, lengthes[4], 0, bSecondary)) {
            nowResultsCount += 1;
            continue;
          }
          processBasicDuoPrimaryCombinationByIndex(0, 1, 2, a, b);
        }
      }
      return true;
    }

    if (requiredCount === 4) {
      if (!branchCouldBeat(0, 1, 2, 3, 0, 4, baseLow, baseHigh, 4, 1, baseSecondaryUpper)) {
        nowResultsCount += listLength - 4;
        return true;
      }
      for (let a = 4; a < lengthes[4]; a++) {
        searchCheckCounter += 1;
        if ((searchCheckCounter & INNER_SEARCH_CHECK_MASK) === 0 && !(await yieldToSearchUi())) return false;
        const aLow = (baseLow | charaLow[a]) >>> 0;
        const aHigh = (baseHigh | charaHigh[a]) >>> 0;
        const aSecondary = baseSecondaryUpper + basicDuoSecondaryUpperScores[a];
        if (!branchCouldBeat(0, 1, 2, 3, a, 5, aLow, aHigh, lengthes[4], 0, aSecondary)) {
          nowResultsCount += 1;
          continue;
        }
        processBasicDuoPrimaryCombinationByIndex(0, 1, 2, 3, a);
      }
      return true;
    }

    return false;
  };

  const runSameSupportBasicDuoPrimaryFastLoop = async (lengthes: number[]): Promise<boolean> => {
    if (
      !metricPrimaryFastEntries ||
      !fastIds ||
      !fastDuoIds ||
      !fastUseM2 ||
      !basicDuoSecondaryUpperScores ||
      !basicDuoSecondaryUpperSuffixTopSums ||
      !basicDuoSupportSecondaryUpperScores ||
      !supportFastIds ||
      !supportFastDuoIds ||
      !supportFastUseM2 ||
      !fastPairBuddyMasks ||
      !fastNormalToSupportBuddyMasks ||
      !fastSupportToNormalBuddyMasks ||
      !fastSupportSelfBuddyMasks ||
      !fastHpTables ||
      !fastHealTables ||
      !supportFastHpTables ||
      !supportFastHealTables ||
      maxLevel.length === 0 ||
      requiredCount >= 5
    ) {
      return false;
    }

    const supportLength = maxLevel.length;
    const charaLow = new Uint32Array(listLength);
    const charaHigh = new Uint32Array(listLength);
    const duoLow = new Uint32Array(listLength);
    const duoHigh = new Uint32Array(listLength);
    for (let index = 0; index < listLength; index++) {
      const charaAny = nonZero[index] as any;
      charaLow[index] = (charaAny.charaBitLowCached as number) >>> 0;
      charaHigh[index] = (charaAny.charaBitHighCached as number) >>> 0;
      duoLow[index] = (charaAny.duoBitLowCached as number) >>> 0;
      duoHigh[index] = (charaAny.duoBitHighCached as number) >>> 0;
    }

    const supportOrder = Array.from({ length: supportLength }, (_, index) => index);
    supportOrder.sort((a, b) => basicDuoSupportSecondaryUpperScores[b] - basicDuoSupportSecondaryUpperScores[a]);
    const supportOrderArray = Int32Array.from(supportOrder);
    const supportOrderRank = new Int32Array(supportLength);
    for (let pos = 0; pos < supportLength; pos++) {
      supportOrderRank[supportOrderArray[pos]] = pos;
    }
    const supportIndexesById = new Map<number, number[]>();
    const supportIndexesByDuoTarget = new Map<number, number[]>();
    const supportSelfDuoIndexes: number[] = [];
    const pushSupportIndex = (map: Map<number, number[]>, key: number, supportIndex: number) => {
      const existing = map.get(key);
      if (existing) {
        existing.push(supportIndex);
      } else {
        map.set(key, [supportIndex]);
      }
    };
    for (let pos = 0; pos < supportLength; pos++) {
      const supportIndex = supportOrderArray[pos];
      const supportId = supportFastIds[supportIndex];
      pushSupportIndex(supportIndexesById, supportId, supportIndex);
      if (supportFastUseM2[supportIndex] !== 0) {
        const supportDuoId = supportFastDuoIds[supportIndex];
        pushSupportIndex(supportIndexesByDuoTarget, supportDuoId, supportIndex);
        if (supportDuoId === supportId) {
          supportSelfDuoIndexes.push(supportIndex);
        }
      }
    }
    const supportCandidateStamp = new Int32Array(supportLength);
    let supportCandidateStampValue = 1;
    const supportCandidateScratch: number[] = [];
    const supportCandidateFilteredScratch: number[] = [];
    const normalFourContainsId = (
      targetId: number,
      i: number,
      j: number,
      k: number,
      l: number,
    ): boolean => (
      targetId === fastIds[i] ||
      targetId === fastIds[j] ||
      targetId === fastIds[k] ||
      targetId === fastIds[l]
    );
    const calculateSupportBasicDuoPrimaryScore = (
      i: number,
      j: number,
      k: number,
      l: number,
      supportIndex: number,
    ): number => {
      const supportId = supportFastIds[supportIndex];
      let primaryScore = 0;
      if (
        fastUseM2[i] !== 0 &&
        (fastDuoIds[i] === supportId || normalFourContainsId(fastDuoIds[i], i, j, k, l))
      ) primaryScore += 1;
      if (
        fastUseM2[j] !== 0 &&
        (fastDuoIds[j] === supportId || normalFourContainsId(fastDuoIds[j], i, j, k, l))
      ) primaryScore += 1;
      if (
        fastUseM2[k] !== 0 &&
        (fastDuoIds[k] === supportId || normalFourContainsId(fastDuoIds[k], i, j, k, l))
      ) primaryScore += 1;
      if (
        fastUseM2[l] !== 0 &&
        (fastDuoIds[l] === supportId || normalFourContainsId(fastDuoIds[l], i, j, k, l))
      ) primaryScore += 1;
      if (
        supportFastUseM2[supportIndex] !== 0 &&
        (
          supportFastDuoIds[supportIndex] === supportId ||
          normalFourContainsId(supportFastDuoIds[supportIndex], i, j, k, l)
        )
      ) primaryScore += 1;
      return primaryScore;
    };
    const getMinimumSupportPrimaryToBeat = (): number => {
      if (!metricPrimaryCouldBeat(4, Number.POSITIVE_INFINITY)) return 5;
      if (!metricPrimaryCouldBeat(3, Number.POSITIVE_INFINITY)) return 4;
      return 0;
    };
    const appendSupportCandidateBucket = (bucket: number[] | undefined) => {
      if (!bucket) return;
      for (let index = 0; index < bucket.length; index++) {
        const supportIndex = bucket[index];
        if (supportCandidateStamp[supportIndex] === supportCandidateStampValue) continue;
        supportCandidateStamp[supportIndex] = supportCandidateStampValue;
        supportCandidateScratch.push(supportIndex);
      }
    };
    const getPrimaryAtLeastSupportCandidates = (
      i: number,
      j: number,
      k: number,
      l: number,
      minPrimary: number,
    ): number[] | null => {
      let normalPrimary = 0;
      if (fastUseM2[i] !== 0 && normalFourContainsId(fastDuoIds[i], i, j, k, l)) normalPrimary += 1;
      if (fastUseM2[j] !== 0 && normalFourContainsId(fastDuoIds[j], i, j, k, l)) normalPrimary += 1;
      if (fastUseM2[k] !== 0 && normalFourContainsId(fastDuoIds[k], i, j, k, l)) normalPrimary += 1;
      if (fastUseM2[l] !== 0 && normalFourContainsId(fastDuoIds[l], i, j, k, l)) normalPrimary += 1;
      if (normalPrimary >= minPrimary) return null;

      supportCandidateStampValue += 1;
      if (supportCandidateStampValue === 0x7fffffff) {
        supportCandidateStamp.fill(0);
        supportCandidateStampValue = 1;
      }
      supportCandidateScratch.length = 0;
      supportCandidateFilteredScratch.length = 0;

      if (fastUseM2[i] !== 0 && !normalFourContainsId(fastDuoIds[i], i, j, k, l)) {
        appendSupportCandidateBucket(supportIndexesById.get(fastDuoIds[i]));
      }
      if (fastUseM2[j] !== 0 && !normalFourContainsId(fastDuoIds[j], i, j, k, l)) {
        appendSupportCandidateBucket(supportIndexesById.get(fastDuoIds[j]));
      }
      if (fastUseM2[k] !== 0 && !normalFourContainsId(fastDuoIds[k], i, j, k, l)) {
        appendSupportCandidateBucket(supportIndexesById.get(fastDuoIds[k]));
      }
      if (fastUseM2[l] !== 0 && !normalFourContainsId(fastDuoIds[l], i, j, k, l)) {
        appendSupportCandidateBucket(supportIndexesById.get(fastDuoIds[l]));
      }
      appendSupportCandidateBucket(supportIndexesByDuoTarget.get(fastIds[i]));
      appendSupportCandidateBucket(supportIndexesByDuoTarget.get(fastIds[j]));
      appendSupportCandidateBucket(supportIndexesByDuoTarget.get(fastIds[k]));
      appendSupportCandidateBucket(supportIndexesByDuoTarget.get(fastIds[l]));
      appendSupportCandidateBucket(supportSelfDuoIndexes);

      for (let index = 0; index < supportCandidateScratch.length; index++) {
        const supportIndex = supportCandidateScratch[index];
        if (calculateSupportBasicDuoPrimaryScore(i, j, k, l, supportIndex) >= minPrimary) {
          supportCandidateFilteredScratch.push(supportIndex);
        }
      }
      supportCandidateFilteredScratch.sort((a, b) => supportOrderRank[a] - supportOrderRank[b]);
      return supportCandidateFilteredScratch;
    };
    const primaryFiveSupportOrderCache = new Map<string, Int32Array>();
    const getPrimaryFiveSupportOrder = (i: number, j: number, k: number, l: number): Int32Array => {
      const key =
        fastIds[i] + ':' + fastDuoIds[i] + ':' + fastUseM2[i] + '|' +
        fastIds[j] + ':' + fastDuoIds[j] + ':' + fastUseM2[j] + '|' +
        fastIds[k] + ':' + fastDuoIds[k] + ':' + fastUseM2[k] + '|' +
        fastIds[l] + ':' + fastDuoIds[l] + ':' + fastUseM2[l];
      const cached = primaryFiveSupportOrderCache.get(key);
      if (cached) return cached;
      const indexes: number[] = [];
      for (let supportPos = 0; supportPos < supportLength; supportPos++) {
        const supportIndex = supportOrderArray[supportPos];
        const duoMask = resolveFixedFiveDuoMaskFromIds(
          fastIds[i],
          fastIds[j],
          fastIds[k],
          fastIds[l],
          supportFastIds![supportIndex],
          fastDuoIds[i],
          fastDuoIds[j],
          fastDuoIds[k],
          fastDuoIds[l],
          supportFastDuoIds![supportIndex],
          fastUseM2[i] !== 0,
          fastUseM2[j] !== 0,
          fastUseM2[k] !== 0,
          fastUseM2[l] !== 0,
          supportFastUseM2![supportIndex] !== 0,
        );
        if (countFixedFiveDuoBits(duoMask) === 5) {
          indexes.push(supportIndex);
        }
      }
      const value = Int32Array.from(indexes);
      primaryFiveSupportOrderCache.set(key, value);
      return value;
    };
    const supportCharaLow = new Uint32Array(supportLength);
    const supportCharaHigh = new Uint32Array(supportLength);
    for (let index = 0; index < supportLength; index++) {
      const charaAny = maxLevel[index] as any;
      supportCharaLow[index] = (charaAny.charaBitLowCached as number) >>> 0;
      supportCharaHigh[index] = (charaAny.charaBitHighCached as number) >>> 0;
    }
    const supportSuffixCharaLow = new Uint32Array(supportLength + 1);
    const supportSuffixCharaHigh = new Uint32Array(supportLength + 1);
    const supportSuffixSecondaryUpper = new Float64Array(supportLength + 1);
    supportSuffixSecondaryUpper[supportLength] = -Infinity;
    for (let pos = supportLength - 1; pos >= 0; pos--) {
      const supportIndex = supportOrderArray[pos];
      supportSuffixCharaLow[pos] = (supportSuffixCharaLow[pos + 1] | supportCharaLow[supportIndex]) >>> 0;
      supportSuffixCharaHigh[pos] = (supportSuffixCharaHigh[pos + 1] | supportCharaHigh[supportIndex]) >>> 0;
      const value = basicDuoSupportSecondaryUpperScores[supportIndex];
      const next = supportSuffixSecondaryUpper[pos + 1];
      supportSuffixSecondaryUpper[pos] = value > next ? value : next;
    }

    const supportBranchCouldBeat = (
      a: number,
      b: number,
      c: number,
      d: number,
      selectedLow: number,
      selectedHigh: number,
      supportStart: number,
      normalSecondaryUpper: number,
    ): boolean => {
      const availableLow = (selectedLow | supportSuffixCharaLow[supportStart]) >>> 0;
      const availableHigh = (selectedHigh | supportSuffixCharaHigh[supportStart]) >>> 0;
      let duoUpper = 1;
      if (fastUseM2[a] !== 0 && (((duoLow[a] & availableLow) | (duoHigh[a] & availableHigh)) !== 0)) duoUpper += 1;
      if (fastUseM2[b] !== 0 && (((duoLow[b] & availableLow) | (duoHigh[b] & availableHigh)) !== 0)) duoUpper += 1;
      if (fastUseM2[c] !== 0 && (((duoLow[c] & availableLow) | (duoHigh[c] & availableHigh)) !== 0)) duoUpper += 1;
      if (fastUseM2[d] !== 0 && (((duoLow[d] & availableLow) | (duoHigh[d] & availableHigh)) !== 0)) duoUpper += 1;
      return metricPrimaryCouldBeat(duoUpper > 5 ? 5 : duoUpper, normalSecondaryUpper + supportSuffixSecondaryUpper[supportStart]);
    };

    let searchCheckCounter = 0;
    const shouldUsePrimaryFiveSupportOrder = (): boolean => (
      snapshot.minDuo === 5 ||
      !metricPrimaryCouldBeat(4, Number.POSITIVE_INFINITY)
    );
    const processPrimaryFiveSupportChoices = async (
      i: number,
      j: number,
      k: number,
      l: number,
      normalSecondaryUpper: number,
    ): Promise<boolean> => {
      const primaryFiveSupportOrder = getPrimaryFiveSupportOrder(i, j, k, l);
      let visitedCount = 0;
      for (let supportPos = 0; supportPos < primaryFiveSupportOrder.length; supportPos++) {
        searchCheckCounter += 1;
        if ((searchCheckCounter & INNER_SEARCH_CHECK_MASK) === 0 && !(await yieldToSearchUi())) return false;
        const supportIndex = primaryFiveSupportOrder[supportPos];
        if (
          !metricPrimaryCouldBeat(
            5,
            normalSecondaryUpper + basicDuoSupportSecondaryUpperScores[supportIndex],
          )
        ) {
          const skippedCount = supportLength - visitedCount;
          incrementDebugCounter('basicDuoSupportSuffixBreak', skippedCount);
          nowResultsCount += skippedCount;
          return true;
        }
        processBasicDuoPrimarySupportCombinationByIndex(i, j, k, l, supportIndex);
        visitedCount += 1;
      }
      const skippedCount = supportLength - visitedCount;
      if (skippedCount > 0) {
        incrementDebugCounter('basicDuoSupportCardSkip', skippedCount);
        nowResultsCount += skippedCount;
      }
      return true;
    };
    const processFilteredSupportChoices = async (
      i: number,
      j: number,
      k: number,
      l: number,
      normalSecondaryUpper: number,
      supportIndexes: number[],
      minPrimary: number,
    ): Promise<boolean> => {
      let consideredCount = 0;
      for (let supportPos = 0; supportPos < supportIndexes.length; supportPos++) {
        searchCheckCounter += 1;
        if ((searchCheckCounter & INNER_SEARCH_CHECK_MASK) === 0 && !(await yieldToSearchUi())) return false;
        const supportIndex = supportIndexes[supportPos];
        const secondaryUpper = normalSecondaryUpper + basicDuoSupportSecondaryUpperScores[supportIndex];
        if (minPrimary === 5 && !metricPrimaryCouldBeat(5, secondaryUpper)) {
          const skippedCount = supportLength - consideredCount;
          incrementDebugCounter('basicDuoSupportSuffixBreak', skippedCount);
          nowResultsCount += skippedCount;
          return true;
        }
        consideredCount += 1;
        const primaryScore = minPrimary === 5
          ? 5
          : calculateSupportBasicDuoPrimaryScore(i, j, k, l, supportIndex);
        if (!metricPrimaryCouldBeat(primaryScore, secondaryUpper)) {
          incrementDebugCounter('basicDuoSupportCardSkip');
          nowResultsCount += 1;
          continue;
        }
        processBasicDuoPrimarySupportCombinationByIndex(i, j, k, l, supportIndex);
      }
      const skippedCount = supportLength - consideredCount;
      if (skippedCount > 0) {
        incrementDebugCounter('basicDuoSupportCardSkip', skippedCount);
        nowResultsCount += skippedCount;
      }
      return true;
    };

    if (requiredCount === 0) {
      for (let i = 0; i < lengthes[3] - 3; i++) {
      const iLow = charaLow[i];
      const iHigh = charaHigh[i];
      const iSecondary = basicDuoSecondaryUpperScores[i];
      for (let j = i + 1; j < lengthes[3] - 2; j++) {
        const jLow = (iLow | charaLow[j]) >>> 0;
        const jHigh = (iHigh | charaHigh[j]) >>> 0;
        const jSecondary = iSecondary + basicDuoSecondaryUpperScores[j];
        for (let k = j + 1; k < lengthes[3] - 1; k++) {
          searchCheckCounter += 1;
          if ((searchCheckCounter & SEARCH_CHECK_MASK) === 0 && !(await yieldToSearchUi())) return false;
          const kLow = (jLow | charaLow[k]) >>> 0;
          const kHigh = (jHigh | charaHigh[k]) >>> 0;
          const kSecondary = jSecondary + basicDuoSecondaryUpperScores[k];
          for (let l = k + 1; l < lengthes[3]; l++) {
            const selectedLow = (kLow | charaLow[l]) >>> 0;
            const selectedHigh = (kHigh | charaHigh[l]) >>> 0;
            const normalSecondaryUpper = kSecondary + basicDuoSecondaryUpperScores[l];
            if (!supportBranchCouldBeat(i, j, k, l, selectedLow, selectedHigh, 0, normalSecondaryUpper)) {
              incrementDebugCounter('basicDuoSupportBranchSkip', supportLength);
              nowResultsCount += supportLength;
              continue;
            }
            if (snapshot.minDuo > 5) {
              incrementDebugCounter('basicDuoSupportCardSkip', supportLength);
              nowResultsCount += supportLength;
              continue;
            }
            const minimumSupportPrimary = getMinimumSupportPrimaryToBeat();
            if (minimumSupportPrimary >= 4) {
              const supportCandidates = getPrimaryAtLeastSupportCandidates(i, j, k, l, minimumSupportPrimary);
              if (supportCandidates !== null) {
                if (!await processFilteredSupportChoices(i, j, k, l, normalSecondaryUpper, supportCandidates, minimumSupportPrimary)) return false;
                continue;
              }
            }
            if (shouldUsePrimaryFiveSupportOrder()) {
              if (!await processPrimaryFiveSupportChoices(i, j, k, l, normalSecondaryUpper)) return false;
              continue;
            }
            for (let supportPos = 0; supportPos < supportLength; supportPos++) {
              searchCheckCounter += 1;
              if ((searchCheckCounter & INNER_SEARCH_CHECK_MASK) === 0 && !(await yieldToSearchUi())) return false;
              if (!supportBranchCouldBeat(i, j, k, l, selectedLow, selectedHigh, supportPos, normalSecondaryUpper)) {
                incrementDebugCounter('basicDuoSupportSuffixBreak', supportLength - supportPos);
                nowResultsCount += supportLength - supportPos;
                break;
              }
              const supportIndex = supportOrderArray[supportPos];
              const duoMask = resolveFixedFiveDuoMaskFromIds(
                fastIds[i],
                fastIds[j],
                fastIds[k],
                fastIds[l],
                supportFastIds[supportIndex],
                fastDuoIds[i],
                fastDuoIds[j],
                fastDuoIds[k],
                fastDuoIds[l],
                supportFastDuoIds[supportIndex],
                fastUseM2[i] !== 0,
                fastUseM2[j] !== 0,
                fastUseM2[k] !== 0,
                fastUseM2[l] !== 0,
                supportFastUseM2[supportIndex] !== 0,
              );
              const primaryScore = countFixedFiveDuoBits(duoMask);
              if (
                primaryScore < snapshot.minDuo ||
                !metricPrimaryCouldBeat(
                  primaryScore,
                  normalSecondaryUpper + basicDuoSupportSecondaryUpperScores[supportIndex],
                )
              ) {
                incrementDebugCounter('basicDuoSupportCardSkip');
                nowResultsCount += 1;
                continue;
              }
              processBasicDuoPrimarySupportCombinationByIndex(i, j, k, l, supportIndex);
            }
          }
        }
      }
    }
      return true;
    }

    const selectedIndexes = new Int32Array(4);
    let baseLow = 0;
    let baseHigh = 0;
    let baseSecondaryUpper = 0;
    for (let index = 0; index < requiredCount; index++) {
      selectedIndexes[index] = index;
      baseLow = (baseLow | charaLow[index]) >>> 0;
      baseHigh = (baseHigh | charaHigh[index]) >>> 0;
      baseSecondaryUpper += basicDuoSecondaryUpperScores[index];
    }
    const normalSuffixCharaLow = new Uint32Array(listLength + 1);
    const normalSuffixCharaHigh = new Uint32Array(listLength + 1);
    for (let index = listLength - 1; index >= requiredCount; index--) {
      normalSuffixCharaLow[index] = (normalSuffixCharaLow[index + 1] | charaLow[index]) >>> 0;
      normalSuffixCharaHigh[index] = (normalSuffixCharaHigh[index + 1] | charaHigh[index]) >>> 0;
    }
    const fixedSupportBranchCouldBeat = (
      selectedCount: number,
      selectedLow: number,
      selectedHigh: number,
      nextNormalStart: number,
      remainingNormalPickCount: number,
      supportStart: number,
      normalSecondaryUpper: number,
    ): boolean => {
      const availableLow = (
        selectedLow |
        normalSuffixCharaLow[nextNormalStart] |
        supportSuffixCharaLow[supportStart]
      ) >>> 0;
      const availableHigh = (
        selectedHigh |
        normalSuffixCharaHigh[nextNormalStart] |
        supportSuffixCharaHigh[supportStart]
      ) >>> 0;
      let duoUpper = remainingNormalPickCount + 1;
      for (let index = 0; index < selectedCount; index++) {
        const selectedIndex = selectedIndexes[index];
        if (
          fastUseM2[selectedIndex] !== 0 &&
          (((duoLow[selectedIndex] & availableLow) | (duoHigh[selectedIndex] & availableHigh)) !== 0)
        ) {
          duoUpper += 1;
        }
      }
      if (duoUpper > 5) duoUpper = 5;
      return metricPrimaryCouldBeat(
        duoUpper,
        normalSecondaryUpper +
          basicDuoSecondaryUpperSuffixTopSums![remainingNormalPickCount][nextNormalStart] +
          supportSuffixSecondaryUpper[supportStart],
      );
    };

    const processSupportChoices = async (
      selectedLow: number,
      selectedHigh: number,
      normalSecondaryUpper: number,
    ): Promise<boolean> => {
      const i = selectedIndexes[0];
      const j = selectedIndexes[1];
      const k = selectedIndexes[2];
      const l = selectedIndexes[3];
      if (!fixedSupportBranchCouldBeat(4, selectedLow, selectedHigh, listLength, 0, 0, normalSecondaryUpper)) {
        incrementDebugCounter('basicDuoSupportBranchSkip', supportLength);
        nowResultsCount += supportLength;
        return true;
      }
      if (snapshot.minDuo > 5) {
        incrementDebugCounter('basicDuoSupportCardSkip', supportLength);
        nowResultsCount += supportLength;
        return true;
      }
      const minimumSupportPrimary = getMinimumSupportPrimaryToBeat();
      if (minimumSupportPrimary >= 4) {
        const supportCandidates = getPrimaryAtLeastSupportCandidates(i, j, k, l, minimumSupportPrimary);
        if (supportCandidates !== null) {
          return processFilteredSupportChoices(i, j, k, l, normalSecondaryUpper, supportCandidates, minimumSupportPrimary);
        }
      }
      if (shouldUsePrimaryFiveSupportOrder()) {
        return processPrimaryFiveSupportChoices(i, j, k, l, normalSecondaryUpper);
      }
      for (let supportPos = 0; supportPos < supportLength; supportPos++) {
        searchCheckCounter += 1;
        if ((searchCheckCounter & INNER_SEARCH_CHECK_MASK) === 0 && !(await yieldToSearchUi())) return false;
        if (!fixedSupportBranchCouldBeat(4, selectedLow, selectedHigh, listLength, 0, supportPos, normalSecondaryUpper)) {
          incrementDebugCounter('basicDuoSupportSuffixBreak', supportLength - supportPos);
          nowResultsCount += supportLength - supportPos;
          break;
        }
        const supportIndex = supportOrderArray[supportPos];
        const duoMask = resolveFixedFiveDuoMaskFromIds(
          fastIds[i],
          fastIds[j],
          fastIds[k],
          fastIds[l],
          supportFastIds[supportIndex],
          fastDuoIds[i],
          fastDuoIds[j],
          fastDuoIds[k],
          fastDuoIds[l],
          supportFastDuoIds[supportIndex],
          fastUseM2[i] !== 0,
          fastUseM2[j] !== 0,
          fastUseM2[k] !== 0,
          fastUseM2[l] !== 0,
          supportFastUseM2[supportIndex] !== 0,
        );
        const primaryScore = countFixedFiveDuoBits(duoMask);
        if (
          primaryScore < snapshot.minDuo ||
          !metricPrimaryCouldBeat(
            primaryScore,
            normalSecondaryUpper + basicDuoSupportSecondaryUpperScores[supportIndex],
          )
        ) {
          incrementDebugCounter('basicDuoSupportCardSkip');
          nowResultsCount += 1;
          continue;
        }
        processBasicDuoPrimarySupportCombinationByIndex(i, j, k, l, supportIndex);
      }
      return true;
    };

    const chooseNormal = async (
      depth: number,
      start: number,
      selectedLow: number,
      selectedHigh: number,
      normalSecondaryUpper: number,
    ): Promise<boolean> => {
      if (depth === 4) {
        return processSupportChoices(selectedLow, selectedHigh, normalSecondaryUpper);
      }
      const remaining = 4 - depth;
      if (!fixedSupportBranchCouldBeat(depth, selectedLow, selectedHigh, start, remaining, 0, normalSecondaryUpper)) {
        incrementDebugCounter('basicDuoSupportBranchSkip', combinationCount(lengthes[3] - start, remaining) * supportLength);
        nowResultsCount += combinationCount(lengthes[3] - start, remaining) * supportLength;
        return true;
      }
      for (let index = start; index <= lengthes[3] - remaining; index++) {
        searchCheckCounter += 1;
        if ((searchCheckCounter & SEARCH_CHECK_MASK) === 0 && !(await yieldToSearchUi())) return false;
        selectedIndexes[depth] = index;
        const nextLow = (selectedLow | charaLow[index]) >>> 0;
        const nextHigh = (selectedHigh | charaHigh[index]) >>> 0;
        const nextSecondary = normalSecondaryUpper + basicDuoSecondaryUpperScores[index];
        if (!await chooseNormal(depth + 1, index + 1, nextLow, nextHigh, nextSecondary)) return false;
      }
      return true;
    };

    if (!await chooseNormal(requiredCount, requiredCount, baseLow, baseHigh, baseSecondaryUpper)) return false;
    return true;
  };

  const preseedHpPrimaryThreshold = (lengthes: number[]) => {
    if (
      !metricPrimaryFastEntries ||
      !canUseHpPrimaryThresholdFastPath ||
      !canUseNoRequiredEarlyPrune ||
      metricPrimaryFastMaxSize <= 0 ||
      !hpPrimaryUpperScores
    ) {
      return;
    }
    const maxSeedCombinations = canUseFastHpDamageThresholdExact ? 450000 : 50000;
    let candidateLimit = Math.min(lengthes[4], canUseFastHpDamageThresholdExact ? 40 : 26);
    while (candidateLimit > 24 && combinationCount(candidateLimit, 5) > maxSeedCombinations) {
      candidateLimit -= 1;
    }
    if (candidateLimit < 5) return;
    const seedScores: number[] = [];
    let seedThreshold = -Infinity;
    const seedCombination = hpThresholdCombinationScratch;
    let seedCandidateChecks = 0;
    let seedValidCount = 0;
    const addSeedScore = (score: number) => {
      if (seedScores.length < metricPrimaryFastMaxSize) {
        seedScores.push(score);
        if (seedScores.length === metricPrimaryFastMaxSize) {
          seedScores.sort((a, b) => b - a);
          seedThreshold = seedScores[metricPrimaryFastMaxSize - 1];
        }
        return;
      }
      if (score < seedThreshold) return;
      let left = 0;
      let right = seedScores.length;
      while (left < right) {
        const mid = (left + right) >>> 1;
        if (score > seedScores[mid]) right = mid;
        else left = mid + 1;
      }
      if (left >= metricPrimaryFastMaxSize) return;
      for (let i = metricPrimaryFastMaxSize - 1; i > left; i--) {
        seedScores[i] = seedScores[i - 1];
      }
      seedScores[left] = score;
      seedThreshold = seedScores[metricPrimaryFastMaxSize - 1];
    };

    for (let i = 0; i < candidateLimit - 4; i++) {
      const c0 = nonZero[i];
      const iBuddyMaskOffset = i * listLength;
      const iHpTable = fastHpTables![i];
      const iHealTable = fastHealTables![i];
      seedCombination[0] = c0;
      for (let j = i + 1; j < candidateLimit - 3; j++) {
        const c1 = nonZero[j];
        const jBuddyMaskOffset = j * listLength;
        const jHpTable = fastHpTables![j];
        const jHealTable = fastHealTables![j];
        seedCombination[1] = c1;
        for (let k = j + 1; k < candidateLimit - 2; k++) {
          const c2 = nonZero[k];
          const kBuddyMaskOffset = k * listLength;
          const kHpTable = fastHpTables![k];
          const kHealTable = fastHealTables![k];
          seedCombination[2] = c2;
          for (let l = k + 1; l < candidateLimit - 1; l++) {
            const c3 = nonZero[l];
            const lBuddyMaskOffset = l * listLength;
            const lHpTable = fastHpTables![l];
            const lHealTable = fastHealTables![l];
            seedCombination[3] = c3;
            const iBaseMask =
              fastPairBuddyMasks![iBuddyMaskOffset + i] |
              fastPairBuddyMasks![iBuddyMaskOffset + j] |
              fastPairBuddyMasks![iBuddyMaskOffset + k] |
              fastPairBuddyMasks![iBuddyMaskOffset + l];
            const jBaseMask =
              fastPairBuddyMasks![jBuddyMaskOffset + i] |
              fastPairBuddyMasks![jBuddyMaskOffset + j] |
              fastPairBuddyMasks![jBuddyMaskOffset + k] |
              fastPairBuddyMasks![jBuddyMaskOffset + l];
            const kBaseMask =
              fastPairBuddyMasks![kBuddyMaskOffset + i] |
              fastPairBuddyMasks![kBuddyMaskOffset + j] |
              fastPairBuddyMasks![kBuddyMaskOffset + k] |
              fastPairBuddyMasks![kBuddyMaskOffset + l];
            const lBaseMask =
              fastPairBuddyMasks![lBuddyMaskOffset + i] |
              fastPairBuddyMasks![lBuddyMaskOffset + j] |
              fastPairBuddyMasks![lBuddyMaskOffset + k] |
              fastPairBuddyMasks![lBuddyMaskOffset + l];
            for (let m = l + 1; m < candidateLimit; m++) {
              const c4 = nonZero[m];
              const mBuddyMaskOffset = m * listLength;
              const iMask = iBaseMask | fastPairBuddyMasks![iBuddyMaskOffset + m];
              const jMask = jBaseMask | fastPairBuddyMasks![jBuddyMaskOffset + m];
              const kMask = kBaseMask | fastPairBuddyMasks![kBuddyMaskOffset + m];
              const lMask = lBaseMask | fastPairBuddyMasks![lBuddyMaskOffset + m];
              const mMask =
                fastPairBuddyMasks![mBuddyMaskOffset + i] |
                fastPairBuddyMasks![mBuddyMaskOffset + j] |
                fastPairBuddyMasks![mBuddyMaskOffset + k] |
                fastPairBuddyMasks![mBuddyMaskOffset + l] |
                fastPairBuddyMasks![mBuddyMaskOffset + m];
              const hp =
                iHpTable[iMask] +
                jHpTable[jMask] +
                kHpTable[kMask] +
                lHpTable[lMask] +
                fastHpTables![m][mMask];
              if (hp < snapshot.minHP) continue;
              const ehp =
                hp +
                iHealTable[iMask] +
                jHealTable[jMask] +
                kHealTable[kMask] +
                lHealTable[lMask] +
                fastHealTables![m][mMask];
              if (ehp < snapshot.minEHP) continue;
              const primaryScore = hpPrimaryUsesEhp ? ehp : hp;
              if (primaryScore < seedThreshold) continue;
              let thresholdsPass = true;
              if (
                hpThresholdEvasionScores &&
                hpThresholdEvasionScores[i] + hpThresholdEvasionScores[j] + hpThresholdEvasionScores[k] + hpThresholdEvasionScores[l] + hpThresholdEvasionScores[m] < snapshot.minEvasion
              ) thresholdsPass = false;
              if (
                thresholdsPass &&
                hpThresholdBuffScores &&
                hpThresholdBuffScores[i] + hpThresholdBuffScores[j] + hpThresholdBuffScores[k] + hpThresholdBuffScores[l] + hpThresholdBuffScores[m] < snapshot.minBuff
              ) thresholdsPass = false;
              if (
                thresholdsPass &&
                hpThresholdDebuffScores &&
                hpThresholdDebuffScores[i] + hpThresholdDebuffScores[j] + hpThresholdDebuffScores[k] + hpThresholdDebuffScores[l] + hpThresholdDebuffScores[m] < snapshot.minDebuff
              ) thresholdsPass = false;
              if (
                thresholdsPass &&
                hpThresholdCosmicScores &&
                hpThresholdCosmicScores[i] + hpThresholdCosmicScores[j] + hpThresholdCosmicScores[k] + hpThresholdCosmicScores[l] + hpThresholdCosmicScores[m] < snapshot.minCosmic
              ) thresholdsPass = false;
              if (
                thresholdsPass &&
                hpThresholdFireScores &&
                hpThresholdFireScores[i] + hpThresholdFireScores[j] + hpThresholdFireScores[k] + hpThresholdFireScores[l] + hpThresholdFireScores[m] < snapshot.minFire
              ) thresholdsPass = false;
              if (
                thresholdsPass &&
                hpThresholdWaterScores &&
                hpThresholdWaterScores[i] + hpThresholdWaterScores[j] + hpThresholdWaterScores[k] + hpThresholdWaterScores[l] + hpThresholdWaterScores[m] < snapshot.minWater
              ) thresholdsPass = false;
              if (
                thresholdsPass &&
                hpThresholdFloraScores &&
                hpThresholdFloraScores[i] + hpThresholdFloraScores[j] + hpThresholdFloraScores[k] + hpThresholdFloraScores[l] + hpThresholdFloraScores[m] < snapshot.minFlora
              ) thresholdsPass = false;
              if (
                thresholdsPass &&
                hpThresholdHealNumScores &&
                hpThresholdHealNumScores[i] + hpThresholdHealNumScores[j] + hpThresholdHealNumScores[k] + hpThresholdHealNumScores[l] + hpThresholdHealNumScores[m] < snapshot.minHealNum
              ) thresholdsPass = false;
              if (thresholdsPass) {
                seedCandidateChecks += 1;
                if (canUseFastHpDamageThresholdExact) {
                  thresholdsPass = hpDamageThresholdsPassFastWithMasks(
                    i,
                    j,
                    k,
                    l,
                    m,
                    iMask,
                    jMask,
                    kMask,
                    lMask,
                    mMask,
                  );
                } else if (hasDamageThreshold) {
                  seedCombination[4] = c4;
                  thresholdsPass = hpPrimaryThresholdsPass(c0, c1, c2, c3, c4);
                }
              }
              if (thresholdsPass) {
                seedValidCount += 1;
                addSeedScore(primaryScore);
              }
            }
          }
        }
      }
    }
    if (seedScores.length >= metricPrimaryFastMaxSize) {
      metricPrimarySeedThresholdPrimary = seedScores[metricPrimaryFastMaxSize - 1];
      metricPrimarySeedThresholdSecondary = -Infinity;
      if (debugCounters) {
        debugCounters.metricSeedCandidateLimit = candidateLimit;
        debugCounters.metricSeedCandidateChecks = seedCandidateChecks;
        debugCounters.metricSeedValid = seedValidCount;
        debugCounters.metricSeedThresholdPrimary = metricPrimarySeedThresholdPrimary;
      }
    }
  };

  const preseedNoSameIncreasedHpBuddyThreshold = (lengthes: number[]) => {
    if (
      !metricPrimaryFastEntries ||
      !canUseIncreasedHpBuddyPrimaryFastPath ||
      settings.allowSameCharacter ||
      !canUseFixedPrefixNoSameEarlyPrune ||
      metricPrimaryFastMaxSize <= 0 ||
      !fastHpTables ||
      !fastHealTables ||
      !fastIncreasedTables
    ) {
      return;
    }

    const maxSeedCombinations = 900000;
    let candidateLimit = Math.min(lengthes[4], 42);
    while (candidateLimit > 24 && combinationCount(candidateLimit, 5) > maxSeedCombinations) {
      candidateLimit -= 1;
    }
    if (candidateLimit < 5) return;

    const seedEntries: { primaryScore: number; secondaryScore: number }[] = [];
    let seedThresholdPrimary = -Infinity;
    let seedThresholdSecondary = -Infinity;
    let seedCandidateChecks = 0;
    let seedValidCount = 0;
    const compareSeedEntries = (
      a: { primaryScore: number; secondaryScore: number },
      b: { primaryScore: number; secondaryScore: number },
    ): number => {
      if (a.primaryScore !== b.primaryScore) return b.primaryScore - a.primaryScore;
      if (metricPrimaryFastHasSecondary && a.secondaryScore !== b.secondaryScore) {
        return b.secondaryScore - a.secondaryScore;
      }
      return 0;
    };
    const updateSeedThreshold = () => {
      const worst = seedEntries[metricPrimaryFastMaxSize - 1];
      seedThresholdPrimary = worst.primaryScore;
      seedThresholdSecondary = metricPrimaryFastHasSecondary ? worst.secondaryScore : -Infinity;
    };
    const seedCouldEnter = (primaryScore: number, secondaryScore: number): boolean => {
      if (seedEntries.length < metricPrimaryFastMaxSize) return true;
      if (primaryScore > seedThresholdPrimary) return true;
      if (primaryScore < seedThresholdPrimary) return false;
      return !metricPrimaryFastHasSecondary || secondaryScore >= seedThresholdSecondary;
    };
    const addSeedEntry = (primaryScore: number, secondaryScore: number) => {
      if (!seedCouldEnter(primaryScore, secondaryScore)) return;
      const entry = { primaryScore, secondaryScore };
      if (seedEntries.length < metricPrimaryFastMaxSize) {
        seedEntries.push(entry);
        if (seedEntries.length === metricPrimaryFastMaxSize) {
          seedEntries.sort(compareSeedEntries);
          updateSeedThreshold();
        }
        return;
      }

      let left = 0;
      let right = seedEntries.length;
      while (left < right) {
        const mid = (left + right) >>> 1;
        if (compareSeedEntries(entry, seedEntries[mid]) < 0) {
          right = mid;
        } else {
          left = mid + 1;
        }
      }
      if (left >= metricPrimaryFastMaxSize) return;
      for (let index = metricPrimaryFastMaxSize - 1; index > left; index--) {
        seedEntries[index] = seedEntries[index - 1];
      }
      seedEntries[left] = entry;
      updateSeedThreshold();
    };
    const commitSeedThreshold = () => {
      if (seedEntries.length >= metricPrimaryFastMaxSize) {
        metricPrimarySeedThresholdPrimary = seedThresholdPrimary;
        metricPrimarySeedThresholdSecondary = seedThresholdSecondary;
        if (debugCounters) {
          debugCounters.noSameIncreasedSeedCandidateLimit = candidateLimit;
          debugCounters.noSameIncreasedSeedCandidateChecks = seedCandidateChecks;
          debugCounters.noSameIncreasedSeedValid = seedValidCount;
          debugCounters.noSameIncreasedSeedThresholdPrimary = metricPrimarySeedThresholdPrimary;
          debugCounters.noSameIncreasedSeedThresholdSecondary = metricPrimarySeedThresholdSecondary;
        }
      }
    };

    if (!canUseNoRequiredEarlyPrune) {
      const requiredSeedCount = 5 - requiredCount;
      const availableCandidateCount = lengthes[4] - requiredCount;
      if (requiredSeedCount <= 0 || availableCandidateCount < requiredSeedCount) return;
      const requiredMaxSeedCombinations = Math.max(
        30000,
        Math.min(maxSeedCombinations, metricPrimaryFastMaxSize * 100),
      );
      candidateLimit = Math.min(availableCandidateCount, 70);
      while (
        candidateLimit > requiredSeedCount &&
        combinationCount(candidateLimit, requiredSeedCount) > requiredMaxSeedCombinations
      ) {
        candidateLimit -= 1;
      }
      if (candidateLimit < requiredSeedCount) return;

      const selected = new Int32Array(5);
      for (let index = 0; index < requiredCount; index++) {
        selected[index] = index;
      }
      const seedEnd = requiredCount + candidateLimit;
      const evaluateRequiredSeed = () => {
        const i = selected[0];
        const j = selected[1];
        const k = selected[2];
        const l = selected[3];
        const m = selected[4];
        seedCandidateChecks += 1;

        const iBuddyMaskOffset = i * listLength;
        const jBuddyMaskOffset = j * listLength;
        const kBuddyMaskOffset = k * listLength;
        const lBuddyMaskOffset = l * listLength;
        const mBuddyMaskOffset = m * listLength;
        const iMask =
          fastPairBuddyMasks![iBuddyMaskOffset + i] |
          fastPairBuddyMasks![iBuddyMaskOffset + j] |
          fastPairBuddyMasks![iBuddyMaskOffset + k] |
          fastPairBuddyMasks![iBuddyMaskOffset + l] |
          fastPairBuddyMasks![iBuddyMaskOffset + m];
        const jMask =
          fastPairBuddyMasks![jBuddyMaskOffset + i] |
          fastPairBuddyMasks![jBuddyMaskOffset + j] |
          fastPairBuddyMasks![jBuddyMaskOffset + k] |
          fastPairBuddyMasks![jBuddyMaskOffset + l] |
          fastPairBuddyMasks![jBuddyMaskOffset + m];
        const kMask =
          fastPairBuddyMasks![kBuddyMaskOffset + i] |
          fastPairBuddyMasks![kBuddyMaskOffset + j] |
          fastPairBuddyMasks![kBuddyMaskOffset + k] |
          fastPairBuddyMasks![kBuddyMaskOffset + l] |
          fastPairBuddyMasks![kBuddyMaskOffset + m];
        const lMask =
          fastPairBuddyMasks![lBuddyMaskOffset + i] |
          fastPairBuddyMasks![lBuddyMaskOffset + j] |
          fastPairBuddyMasks![lBuddyMaskOffset + k] |
          fastPairBuddyMasks![lBuddyMaskOffset + l] |
          fastPairBuddyMasks![lBuddyMaskOffset + m];
        const mMask =
          fastPairBuddyMasks![mBuddyMaskOffset + i] |
          fastPairBuddyMasks![mBuddyMaskOffset + j] |
          fastPairBuddyMasks![mBuddyMaskOffset + k] |
          fastPairBuddyMasks![mBuddyMaskOffset + l] |
          fastPairBuddyMasks![mBuddyMaskOffset + m];

        let increasedHpBuddy = fastIncreasedTables[i][iMask];
        const jIncreasedHp = fastIncreasedTables[j][jMask];
        if (jIncreasedHp < increasedHpBuddy) increasedHpBuddy = jIncreasedHp;
        const kIncreasedHp = fastIncreasedTables[k][kMask];
        if (kIncreasedHp < increasedHpBuddy) increasedHpBuddy = kIncreasedHp;
        const lIncreasedHp = fastIncreasedTables[l][lMask];
        if (lIncreasedHp < increasedHpBuddy) increasedHpBuddy = lIncreasedHp;
        const mIncreasedHp = fastIncreasedTables[m][mMask];
        if (mIncreasedHp < increasedHpBuddy) increasedHpBuddy = mIncreasedHp;
        const primaryScore = Math.floor(increasedHpBuddy);
        if (primaryScore < snapshot.minIncreasedHPBuddy) return;

        const hp =
          fastHpTables[i][iMask] +
          fastHpTables[j][jMask] +
          fastHpTables[k][kMask] +
          fastHpTables[l][lMask] +
          fastHpTables[m][mMask];
        if (hp < snapshot.minHP) return;
        const ehp =
          hp +
          fastHealTables[i][iMask] +
          fastHealTables[j][jMask] +
          fastHealTables[k][kMask] +
          fastHealTables[l][lMask] +
          fastHealTables[m][mMask];
        if (ehp < snapshot.minEHP) return;

        seedValidCount += 1;
        addSeedEntry(primaryScore, ehp);
      };
      const chooseRequiredSeed = (depth: number, start: number) => {
        if (depth === 5) {
          evaluateRequiredSeed();
          return;
        }
        const remaining = 5 - depth;
        for (let index = start; index <= seedEnd - remaining; index++) {
          selected[depth] = index;
          chooseRequiredSeed(depth + 1, index + 1);
        }
      };
      chooseRequiredSeed(requiredCount, requiredCount);
      commitSeedThreshold();
      return;
    };

    const seedStart = Math.max(0, lengthes[4] - candidateLimit);
    const seedEnd = lengthes[4];
    for (let i = seedStart; i < seedEnd - 4; i++) {
      const iBuddyMaskOffset = i * listLength;
      const iHpTable = fastHpTables[i];
      const iHealTable = fastHealTables[i];
      const iIncreasedTable = fastIncreasedTables[i];
      for (let j = i + 1; j < seedEnd - 3; j++) {
        const jBuddyMaskOffset = j * listLength;
        const jHpTable = fastHpTables[j];
        const jHealTable = fastHealTables[j];
        const jIncreasedTable = fastIncreasedTables[j];
        for (let k = j + 1; k < seedEnd - 2; k++) {
          const kBuddyMaskOffset = k * listLength;
          const kHpTable = fastHpTables[k];
          const kHealTable = fastHealTables[k];
          const kIncreasedTable = fastIncreasedTables[k];
          for (let l = k + 1; l < seedEnd - 1; l++) {
            const lBuddyMaskOffset = l * listLength;
            const lHpTable = fastHpTables[l];
            const lHealTable = fastHealTables[l];
            const lIncreasedTable = fastIncreasedTables[l];
            const iBaseMask =
              fastPairBuddyMasks![iBuddyMaskOffset + i] |
              fastPairBuddyMasks![iBuddyMaskOffset + j] |
              fastPairBuddyMasks![iBuddyMaskOffset + k] |
              fastPairBuddyMasks![iBuddyMaskOffset + l];
            const jBaseMask =
              fastPairBuddyMasks![jBuddyMaskOffset + i] |
              fastPairBuddyMasks![jBuddyMaskOffset + j] |
              fastPairBuddyMasks![jBuddyMaskOffset + k] |
              fastPairBuddyMasks![jBuddyMaskOffset + l];
            const kBaseMask =
              fastPairBuddyMasks![kBuddyMaskOffset + i] |
              fastPairBuddyMasks![kBuddyMaskOffset + j] |
              fastPairBuddyMasks![kBuddyMaskOffset + k] |
              fastPairBuddyMasks![kBuddyMaskOffset + l];
            const lBaseMask =
              fastPairBuddyMasks![lBuddyMaskOffset + i] |
              fastPairBuddyMasks![lBuddyMaskOffset + j] |
              fastPairBuddyMasks![lBuddyMaskOffset + k] |
              fastPairBuddyMasks![lBuddyMaskOffset + l];
            for (let m = l + 1; m < seedEnd; m++) {
              seedCandidateChecks += 1;
              const mBuddyMaskOffset = m * listLength;
              const iMask = iBaseMask | fastPairBuddyMasks![iBuddyMaskOffset + m];
              const jMask = jBaseMask | fastPairBuddyMasks![jBuddyMaskOffset + m];
              const kMask = kBaseMask | fastPairBuddyMasks![kBuddyMaskOffset + m];
              const lMask = lBaseMask | fastPairBuddyMasks![lBuddyMaskOffset + m];
              const mMask =
                fastPairBuddyMasks![mBuddyMaskOffset + i] |
                fastPairBuddyMasks![mBuddyMaskOffset + j] |
                fastPairBuddyMasks![mBuddyMaskOffset + k] |
                fastPairBuddyMasks![mBuddyMaskOffset + l] |
                fastPairBuddyMasks![mBuddyMaskOffset + m];

              let increasedHpBuddy = iIncreasedTable[iMask];
              const jIncreasedHp = jIncreasedTable[jMask];
              if (jIncreasedHp < increasedHpBuddy) increasedHpBuddy = jIncreasedHp;
              const kIncreasedHp = kIncreasedTable[kMask];
              if (kIncreasedHp < increasedHpBuddy) increasedHpBuddy = kIncreasedHp;
              const lIncreasedHp = lIncreasedTable[lMask];
              if (lIncreasedHp < increasedHpBuddy) increasedHpBuddy = lIncreasedHp;
              const mIncreasedHp = fastIncreasedTables[m][mMask];
              if (mIncreasedHp < increasedHpBuddy) increasedHpBuddy = mIncreasedHp;
              const primaryScore = Math.floor(increasedHpBuddy);
              if (primaryScore < snapshot.minIncreasedHPBuddy) continue;

              const hp =
                iHpTable[iMask] +
                jHpTable[jMask] +
                kHpTable[kMask] +
                lHpTable[lMask] +
                fastHpTables[m][mMask];
              if (hp < snapshot.minHP) continue;
              const ehp =
                hp +
                iHealTable[iMask] +
                jHealTable[jMask] +
                kHealTable[kMask] +
                lHealTable[lMask] +
                fastHealTables[m][mMask];
              if (ehp < snapshot.minEHP) continue;

              seedValidCount += 1;
              addSeedEntry(primaryScore, ehp);
            }
          }
        }
      }
    }

    commitSeedThreshold();
  };

  const incrementDebugCounter = (key: string, value = 1) => {
    if (debugCounters) debugCounters[key] = (debugCounters[key] ?? 0) + value;
  };
  const getNoSameIncreasedReachableUpper = (
    row: number,
    baseMask: number,
    suffixStart: number,
    pickCount: number,
  ): number => {
    const bits = fastIncreasedReachableMasks![
      ((row * 5 + pickCount) * fastIncreasedReachableSpan) + suffixStart
    ];
    return fastIncreasedReachableScoreByBits![(row << 11) + (baseMask << 8) + bits];
  };
  const getNoSameDamageReachableUpper = (
    row: number,
    baseMask: number,
    baseDuoPossible: boolean,
    suffixStart: number,
    pickCount: number,
  ): number => {
    const bits = fastDamageReachableMasks![
      ((row * 5 + pickCount) * fastDamageReachableSpan) + suffixStart
    ];
    const suffixDuoPossible =
      pickCount > 0 &&
      fastDamageDuoTargetSuffixNext![row * fastDamageReachableSpan + suffixStart] < listLength;
    const duoState =
      fastDuoBaseOffsets![row] !== 0 ||
      (fastUseM2![row] !== 0 && (baseDuoPossible || suffixDuoPossible))
        ? 1
        : 0;
    return fastDamageReachableScoreByBits![(row << 12) + (duoState << 11) + (baseMask << 8) + bits];
  };
  const getNoSameDamageOnePickReachableUpper = (
    row: number,
    baseMask: number,
    baseDuoPossible: boolean,
    suffixStart: number,
  ): number => {
    return fastDamageOnePickReachableUpper![
      ((row * 2 + (baseDuoPossible ? 1 : 0)) * 8 + baseMask) * fastDamageReachableSpan + suffixStart
    ];
  };

  const preseedSameSupportIncreasedHpBuddyThreshold = (lengthes: number[]) => {
    if (
      !metricPrimaryFastEntries ||
      !canUseIncreasedHpBuddyPrimaryFastPath ||
      !settings.allowSameCharacter ||
      !supportFastIds ||
      requiredCount >= 5 ||
      metricPrimaryFastMaxSize <= 0 ||
      !fastHpTables ||
      !fastHealTables ||
      !fastIncreasedTables ||
      !supportFastHpTables ||
      !supportFastHealTables ||
      !supportFastIncreasedTables ||
      !fastNormalToSupportBuddyMasks ||
      !fastSupportToNormalBuddyMasks ||
      !fastSupportSelfBuddyMasks
    ) {
      return;
    }

    const supportLength = maxLevel.length;
    if (supportLength === 0) return;

    const maxSeedCombinations = 900000;
    let normalLimit = Math.min(lengthes[3], 34);
    let supportLimit = Math.min(supportLength, 32);
    while (normalLimit > 24 && combinationCount(normalLimit, 4) * supportLimit > maxSeedCombinations) {
      normalLimit -= 1;
    }
    while (supportLimit > 16 && combinationCount(normalLimit, 4) * supportLimit > maxSeedCombinations) {
      supportLimit -= 1;
    }
    if (normalLimit < 4 || supportLimit < 1) return;

    const seedEntries: { primaryScore: number; secondaryScore: number }[] = [];
    let seedThresholdPrimary = -Infinity;
    let seedThresholdSecondary = -Infinity;
    let seedCandidateChecks = 0;
    let seedValidCount = 0;
    const compareSeedEntries = (
      a: { primaryScore: number; secondaryScore: number },
      b: { primaryScore: number; secondaryScore: number },
    ): number => {
      if (a.primaryScore !== b.primaryScore) return b.primaryScore - a.primaryScore;
      if (metricPrimaryFastHasSecondary && a.secondaryScore !== b.secondaryScore) {
        return b.secondaryScore - a.secondaryScore;
      }
      return 0;
    };
    const updateSeedThreshold = () => {
      const worst = seedEntries[metricPrimaryFastMaxSize - 1];
      seedThresholdPrimary = worst.primaryScore;
      seedThresholdSecondary = metricPrimaryFastHasSecondary ? worst.secondaryScore : -Infinity;
    };
    const seedCouldEnter = (primaryScore: number, secondaryScore: number): boolean => {
      if (seedEntries.length < metricPrimaryFastMaxSize) return true;
      if (primaryScore > seedThresholdPrimary) return true;
      if (primaryScore < seedThresholdPrimary) return false;
      return !metricPrimaryFastHasSecondary || secondaryScore >= seedThresholdSecondary;
    };
    const addSeedEntry = (primaryScore: number, secondaryScore: number) => {
      if (!seedCouldEnter(primaryScore, secondaryScore)) return;
      const entry = { primaryScore, secondaryScore };
      if (seedEntries.length < metricPrimaryFastMaxSize) {
        seedEntries.push(entry);
        if (seedEntries.length === metricPrimaryFastMaxSize) {
          seedEntries.sort(compareSeedEntries);
          updateSeedThreshold();
        }
        return;
      }

      let left = 0;
      let right = seedEntries.length;
      while (left < right) {
        const mid = (left + right) >>> 1;
        if (compareSeedEntries(entry, seedEntries[mid]) < 0) {
          right = mid;
        } else {
          left = mid + 1;
        }
      }
      if (left >= metricPrimaryFastMaxSize) return;
      for (let index = metricPrimaryFastMaxSize - 1; index > left; index--) {
        seedEntries[index] = seedEntries[index - 1];
      }
      seedEntries[left] = entry;
      updateSeedThreshold();
    };
    const commitSeedThreshold = () => {
      if (seedEntries.length >= metricPrimaryFastMaxSize) {
        metricPrimarySeedThresholdPrimary = seedThresholdPrimary;
        metricPrimarySeedThresholdSecondary = seedThresholdSecondary;
        if (debugCounters) {
          debugCounters.sameSupportSeedNormalLimit = normalLimit;
          debugCounters.sameSupportSeedSupportLimit = supportLimit;
          debugCounters.sameSupportSeedCandidateChecks = seedCandidateChecks;
          debugCounters.sameSupportSeedValid = seedValidCount;
          debugCounters.sameSupportSeedThresholdPrimary = metricPrimarySeedThresholdPrimary;
          debugCounters.sameSupportSeedThresholdSecondary = metricPrimarySeedThresholdSecondary;
        }
      }
    };

    if (!canUseNoRequiredEarlyPrune) {
      const normalPickCount = 4 - requiredCount;
      const availableNormalCount = lengthes[3] - requiredCount;
      if (normalPickCount < 0 || availableNormalCount < normalPickCount) return;
      const requiredMaxSeedCombinations = Math.max(
        120000,
        Math.min(maxSeedCombinations, metricPrimaryFastMaxSize * 800),
      );
      normalLimit = Math.min(availableNormalCount, 80);
      supportLimit = Math.min(supportLength, 48);
      while (
        normalLimit > normalPickCount &&
        combinationCount(normalLimit, normalPickCount) * supportLimit > requiredMaxSeedCombinations
      ) {
        normalLimit -= 1;
      }
      while (
        supportLimit > 16 &&
        combinationCount(normalLimit, normalPickCount) * supportLimit > requiredMaxSeedCombinations
      ) {
        supportLimit -= 1;
      }
      if (normalLimit < normalPickCount || supportLimit < 1) return;

      const normalOrder = Array.from({ length: availableNormalCount }, (_, index) => requiredCount + index);
      normalOrder.sort((a, b) => {
        const primaryDiff = increasedHpPrimaryUpperScores![b] - increasedHpPrimaryUpperScores![a];
        if (primaryDiff !== 0) return primaryDiff;
        return secondaryEhpUpperScores![b] - secondaryEhpUpperScores![a];
      });
      const supportOrder = Array.from({ length: supportLength }, (_, index) => index);
      supportOrder.sort((a, b) => {
        const primaryDiff = maxLevelIncreasedHpPrimaryUpperScores![b] - maxLevelIncreasedHpPrimaryUpperScores![a];
        if (primaryDiff !== 0) return primaryDiff;
        return maxLevelSecondaryEhpUpperScores![b] - maxLevelSecondaryEhpUpperScores![a];
      });
      const selected = new Int32Array(4);
      for (let index = 0; index < requiredCount; index++) {
        selected[index] = index;
      }

      const evaluateRequiredSupportSeed = () => {
        const i = selected[0];
        const j = selected[1];
        const k = selected[2];
        const l = selected[3];
        const iBuddyMaskOffset = i * listLength;
        const jBuddyMaskOffset = j * listLength;
        const kBuddyMaskOffset = k * listLength;
        const lBuddyMaskOffset = l * listLength;
        const iSupportMaskOffset = i * supportLength;
        const jSupportMaskOffset = j * supportLength;
        const kSupportMaskOffset = k * supportLength;
        const lSupportMaskOffset = l * supportLength;
        const iBaseMask =
          fastPairBuddyMasks![iBuddyMaskOffset + i] |
          fastPairBuddyMasks![iBuddyMaskOffset + j] |
          fastPairBuddyMasks![iBuddyMaskOffset + k] |
          fastPairBuddyMasks![iBuddyMaskOffset + l];
        const jBaseMask =
          fastPairBuddyMasks![jBuddyMaskOffset + i] |
          fastPairBuddyMasks![jBuddyMaskOffset + j] |
          fastPairBuddyMasks![jBuddyMaskOffset + k] |
          fastPairBuddyMasks![jBuddyMaskOffset + l];
        const kBaseMask =
          fastPairBuddyMasks![kBuddyMaskOffset + i] |
          fastPairBuddyMasks![kBuddyMaskOffset + j] |
          fastPairBuddyMasks![kBuddyMaskOffset + k] |
          fastPairBuddyMasks![kBuddyMaskOffset + l];
        const lBaseMask =
          fastPairBuddyMasks![lBuddyMaskOffset + i] |
          fastPairBuddyMasks![lBuddyMaskOffset + j] |
          fastPairBuddyMasks![lBuddyMaskOffset + k] |
          fastPairBuddyMasks![lBuddyMaskOffset + l];
        for (let supportPos = 0; supportPos < supportLimit; supportPos++) {
          seedCandidateChecks += 1;
          const supportIndex = supportOrder[supportPos];
          const iMask = iBaseMask | fastNormalToSupportBuddyMasks[iSupportMaskOffset + supportIndex];
          const jMask = jBaseMask | fastNormalToSupportBuddyMasks[jSupportMaskOffset + supportIndex];
          const kMask = kBaseMask | fastNormalToSupportBuddyMasks[kSupportMaskOffset + supportIndex];
          const lMask = lBaseMask | fastNormalToSupportBuddyMasks[lSupportMaskOffset + supportIndex];
          const supportNormalMaskOffset = supportIndex * listLength;
          const mMask =
            fastSupportToNormalBuddyMasks[supportNormalMaskOffset + i] |
            fastSupportToNormalBuddyMasks[supportNormalMaskOffset + j] |
            fastSupportToNormalBuddyMasks[supportNormalMaskOffset + k] |
            fastSupportToNormalBuddyMasks[supportNormalMaskOffset + l] |
            fastSupportSelfBuddyMasks[supportIndex];

          let increasedHpBuddy = fastIncreasedTables[i][iMask];
          const jIncreasedHp = fastIncreasedTables[j][jMask];
          if (jIncreasedHp < increasedHpBuddy) increasedHpBuddy = jIncreasedHp;
          const kIncreasedHp = fastIncreasedTables[k][kMask];
          if (kIncreasedHp < increasedHpBuddy) increasedHpBuddy = kIncreasedHp;
          const lIncreasedHp = fastIncreasedTables[l][lMask];
          if (lIncreasedHp < increasedHpBuddy) increasedHpBuddy = lIncreasedHp;
          const supportIncreasedHp = supportFastIncreasedTables[supportIndex][mMask];
          if (supportIncreasedHp < increasedHpBuddy) increasedHpBuddy = supportIncreasedHp;
          const primaryScore = Math.floor(increasedHpBuddy);
          if (primaryScore < snapshot.minIncreasedHPBuddy) continue;

          const hp =
            fastHpTables[i][iMask] +
            fastHpTables[j][jMask] +
            fastHpTables[k][kMask] +
            fastHpTables[l][lMask] +
            supportFastHpTables[supportIndex][mMask];
          if (hp < snapshot.minHP) continue;
          const ehp =
            hp +
            fastHealTables[i][iMask] +
            fastHealTables[j][jMask] +
            fastHealTables[k][kMask] +
            fastHealTables[l][lMask] +
            supportFastHealTables[supportIndex][mMask];
          if (ehp < snapshot.minEHP) continue;

          seedValidCount += 1;
          addSeedEntry(primaryScore, ehp);
        }
      };
      const chooseRequiredSupportNormals = (depth: number, orderStart: number) => {
        if (depth === 4) {
          evaluateRequiredSupportSeed();
          return;
        }
        const remaining = 4 - depth;
        for (let orderIndex = orderStart; orderIndex <= normalLimit - remaining; orderIndex++) {
          selected[depth] = normalOrder[orderIndex];
          chooseRequiredSupportNormals(depth + 1, orderIndex + 1);
        }
      };
      chooseRequiredSupportNormals(requiredCount, 0);
      commitSeedThreshold();
      return;
    }

    for (let i = 0; i < normalLimit - 3; i++) {
      const iBuddyMaskOffset = i * listLength;
      const iSupportMaskOffset = i * supportLength;
      const iHpTable = fastHpTables[i];
      const iHealTable = fastHealTables[i];
      const iIncreasedTable = fastIncreasedTables[i];
      for (let j = i + 1; j < normalLimit - 2; j++) {
        const jBuddyMaskOffset = j * listLength;
        const jSupportMaskOffset = j * supportLength;
        const jHpTable = fastHpTables[j];
        const jHealTable = fastHealTables[j];
        const jIncreasedTable = fastIncreasedTables[j];
        for (let k = j + 1; k < normalLimit - 1; k++) {
          const kBuddyMaskOffset = k * listLength;
          const kSupportMaskOffset = k * supportLength;
          const kHpTable = fastHpTables[k];
          const kHealTable = fastHealTables[k];
          const kIncreasedTable = fastIncreasedTables[k];
          for (let l = k + 1; l < normalLimit; l++) {
            const lBuddyMaskOffset = l * listLength;
            const lSupportMaskOffset = l * supportLength;
            const lHpTable = fastHpTables[l];
            const lHealTable = fastHealTables[l];
            const lIncreasedTable = fastIncreasedTables[l];
            const iBaseMask =
              fastPairBuddyMasks![iBuddyMaskOffset + i] |
              fastPairBuddyMasks![iBuddyMaskOffset + j] |
              fastPairBuddyMasks![iBuddyMaskOffset + k] |
              fastPairBuddyMasks![iBuddyMaskOffset + l];
            const jBaseMask =
              fastPairBuddyMasks![jBuddyMaskOffset + i] |
              fastPairBuddyMasks![jBuddyMaskOffset + j] |
              fastPairBuddyMasks![jBuddyMaskOffset + k] |
              fastPairBuddyMasks![jBuddyMaskOffset + l];
            const kBaseMask =
              fastPairBuddyMasks![kBuddyMaskOffset + i] |
              fastPairBuddyMasks![kBuddyMaskOffset + j] |
              fastPairBuddyMasks![kBuddyMaskOffset + k] |
              fastPairBuddyMasks![kBuddyMaskOffset + l];
            const lBaseMask =
              fastPairBuddyMasks![lBuddyMaskOffset + i] |
              fastPairBuddyMasks![lBuddyMaskOffset + j] |
              fastPairBuddyMasks![lBuddyMaskOffset + k] |
              fastPairBuddyMasks![lBuddyMaskOffset + l];
            for (let m = 0; m < supportLimit; m++) {
              seedCandidateChecks += 1;
              const iMask = iBaseMask | fastNormalToSupportBuddyMasks[iSupportMaskOffset + m];
              const jMask = jBaseMask | fastNormalToSupportBuddyMasks[jSupportMaskOffset + m];
              const kMask = kBaseMask | fastNormalToSupportBuddyMasks[kSupportMaskOffset + m];
              const lMask = lBaseMask | fastNormalToSupportBuddyMasks[lSupportMaskOffset + m];
              const supportNormalMaskOffset = m * listLength;
              const mMask =
                fastSupportToNormalBuddyMasks[supportNormalMaskOffset + i] |
                fastSupportToNormalBuddyMasks[supportNormalMaskOffset + j] |
                fastSupportToNormalBuddyMasks[supportNormalMaskOffset + k] |
                fastSupportToNormalBuddyMasks[supportNormalMaskOffset + l] |
                fastSupportSelfBuddyMasks[m];

              let increasedHpBuddy = iIncreasedTable[iMask];
              const jIncreasedHp = jIncreasedTable[jMask];
              if (jIncreasedHp < increasedHpBuddy) increasedHpBuddy = jIncreasedHp;
              const kIncreasedHp = kIncreasedTable[kMask];
              if (kIncreasedHp < increasedHpBuddy) increasedHpBuddy = kIncreasedHp;
              const lIncreasedHp = lIncreasedTable[lMask];
              if (lIncreasedHp < increasedHpBuddy) increasedHpBuddy = lIncreasedHp;
              const supportIncreasedHp = supportFastIncreasedTables[m][mMask];
              if (supportIncreasedHp < increasedHpBuddy) increasedHpBuddy = supportIncreasedHp;
              const primaryScore = Math.floor(increasedHpBuddy);
              if (primaryScore < snapshot.minIncreasedHPBuddy) continue;

              const hp =
                iHpTable[iMask] +
                jHpTable[jMask] +
                kHpTable[kMask] +
                lHpTable[lMask] +
                supportFastHpTables[m][mMask];
              if (hp < snapshot.minHP) continue;
              const ehp =
                hp +
                iHealTable[iMask] +
                jHealTable[jMask] +
                kHealTable[kMask] +
                lHealTable[lMask] +
                supportFastHealTables[m][mMask];
              if (ehp < snapshot.minEHP) continue;

              seedValidCount += 1;
              addSeedEntry(primaryScore, ehp);
            }
          }
        }
      }
    }

    commitSeedThreshold();
  };

  const hpThresholdBranchCouldPass = (
    evasion: number,
    buff: number,
    debuff: number,
    cosmic: number,
    fire: number,
    water: number,
    flora: number,
    healNum: number,
    referenceDamage: number,
    advantageDamage: number,
    vsHiDamage: number,
    vsMizuDamage: number,
    vsKiDamage: number,
    suffixStart: number,
    pickCount: number,
  ): boolean => {
    if (hpThresholdEvasionSuffixTopSums && evasion + hpThresholdEvasionSuffixTopSums[pickCount][suffixStart] < snapshot.minEvasion) return false;
    if (hpThresholdBuffSuffixTopSums && buff + hpThresholdBuffSuffixTopSums[pickCount][suffixStart] < snapshot.minBuff) return false;
    if (hpThresholdDebuffSuffixTopSums && debuff + hpThresholdDebuffSuffixTopSums[pickCount][suffixStart] < snapshot.minDebuff) return false;
    if (hpThresholdCosmicSuffixTopSums && cosmic + hpThresholdCosmicSuffixTopSums[pickCount][suffixStart] < snapshot.minCosmic) return false;
    if (hpThresholdFireSuffixTopSums && fire + hpThresholdFireSuffixTopSums[pickCount][suffixStart] < snapshot.minFire) return false;
    if (hpThresholdWaterSuffixTopSums && water + hpThresholdWaterSuffixTopSums[pickCount][suffixStart] < snapshot.minWater) return false;
    if (hpThresholdFloraSuffixTopSums && flora + hpThresholdFloraSuffixTopSums[pickCount][suffixStart] < snapshot.minFlora) return false;
    if (hpThresholdHealNumSuffixTopSums && healNum + hpThresholdHealNumSuffixTopSums[pickCount][suffixStart] < snapshot.minHealNum) return false;
    if (hpThresholdReferenceDamageSuffixTopSums && referenceDamage + hpThresholdReferenceDamageSuffixTopSums[pickCount][suffixStart] < snapshot.minReferenceDamage) return false;
    if (hpThresholdAdvantageDamageSuffixTopSums && advantageDamage + hpThresholdAdvantageDamageSuffixTopSums[pickCount][suffixStart] < snapshot.minReferenceAdvantageDamage) return false;
    if (hpThresholdVsHiDamageSuffixTopSums && vsHiDamage + hpThresholdVsHiDamageSuffixTopSums[pickCount][suffixStart] < snapshot.minReferenceVsHiDamage) return false;
    if (hpThresholdVsMizuDamageSuffixTopSums && vsMizuDamage + hpThresholdVsMizuDamageSuffixTopSums[pickCount][suffixStart] < snapshot.minReferenceVsMizuDamage) return false;
    if (hpThresholdVsKiDamageSuffixTopSums && vsKiDamage + hpThresholdVsKiDamageSuffixTopSums[pickCount][suffixStart] < snapshot.minReferenceVsKiDamage) return false;
    return true;
  };

  const hpDamageThresholdsPassFastWithMasks = (
    i: number,
    j: number,
    k: number,
    l: number,
    m: number,
    iMask: number,
    jMask: number,
    kMask: number,
    lMask: number,
    mMask: number,
  ): boolean => {
    if (!fastThresholdDamageTables || !fastDuoIds || !fastUseM2 || !fastDuoBaseOffsets) return false;
    const duoMask = resolveFixedFiveDuoMaskFromIds(
      fastIds![i],
      fastIds![j],
      fastIds![k],
      fastIds![l],
      fastIds![m],
      fastDuoIds[i],
      fastDuoIds[j],
      fastDuoIds[k],
      fastDuoIds[l],
      fastDuoIds[m],
      fastUseM2[i] !== 0,
      fastUseM2[j] !== 0,
      fastUseM2[k] !== 0,
      fastUseM2[l] !== 0,
      fastUseM2[m] !== 0,
    );
    const iDuoOffset = fastDuoBaseOffsets[i] !== 0 || (duoMask & 1) !== 0 ? 8 : 0;
    const jDuoOffset = fastDuoBaseOffsets[j] !== 0 || (duoMask & 2) !== 0 ? 8 : 0;
    const kDuoOffset = fastDuoBaseOffsets[k] !== 0 || (duoMask & 4) !== 0 ? 8 : 0;
    const lDuoOffset = fastDuoBaseOffsets[l] !== 0 || (duoMask & 8) !== 0 ? 8 : 0;
    const mDuoOffset = fastDuoBaseOffsets[m] !== 0 || (duoMask & 16) !== 0 ? 8 : 0;
    const iDamageTable = fastThresholdDamageTables[i];
    const jDamageTable = fastThresholdDamageTables[j];
    const kDamageTable = fastThresholdDamageTables[k];
    const lDamageTable = fastThresholdDamageTables[l];
    const mDamageTable = fastThresholdDamageTables[m];
    for (let metricIndex = 0; metricIndex < hpThresholdDamageMetricCount; metricIndex++) {
      const metricOffset = hpThresholdDamageMetricOffsets[metricIndex];
      const iIndex = metricOffset + iDuoOffset + iMask;
      const jIndex = metricOffset + jDuoOffset + jMask;
      const kIndex = metricOffset + kDuoOffset + kMask;
      const lIndex = metricOffset + lDuoOffset + lMask;
      const mIndex = metricOffset + mDuoOffset + mMask;
      let value =
        iDamageTable[iIndex] +
        jDamageTable[jIndex] +
        kDamageTable[kIndex] +
        lDamageTable[lIndex] +
        mDamageTable[mIndex];
      if (snapshot.attackNum === 9) {
        const iMinTable = fastThresholdDamageMinTables![i];
        const jMinTable = fastThresholdDamageMinTables![j];
        const kMinTable = fastThresholdDamageMinTables![k];
        const lMinTable = fastThresholdDamageMinTables![l];
        const mMinTable = fastThresholdDamageMinTables![m];
        value -= Math.min(
          iMinTable[iIndex],
          jMinTable[jIndex],
          kMinTable[kIndex],
          lMinTable[lIndex],
          mMinTable[mIndex],
        );
      }
      if (value < hpThresholdDamageMinimums[metricIndex]) return false;
    }
    return true;
  };

  const runNoSameBasicDuoPrimaryFastLoop = async (lengthes: number[]): Promise<boolean> => {
    if (
      !metricPrimaryFastEntries ||
      !fastPairBuddyMasks ||
      !fastIds ||
      !fastDuoIds ||
      !fastUseM2 ||
      !fastDuoBaseOffsets ||
      !fastHpTables ||
      !fastHealTables ||
      !fastThresholdDamageTables ||
      !fastThresholdDamageMinTables
    ) {
      return false;
    }

    const secondaryUpperCacheKey = DAMAGE_SORT_KEY_TO_UPPER_CACHE[basicDuoSecondarySortKey];
    if (secondaryUpperCacheKey === undefined) return false;

    const pairMasks = fastPairBuddyMasks;
    const hpTables = fastHpTables;
    const healTables = fastHealTables;
    const damageTables = fastThresholdDamageTables;
    const minDamageTables = fastThresholdDamageMinTables;
    const secondaryMetricOffset = getDamageMetricTableIndex(basicDuoSecondaryDamageMetric) << 4;
    const basicDuoAttackNum = snapshot.attackNum;
    const secondaryUpperScores = buildCachedNumberScoreArray(secondaryUpperCacheKey);
    const secondaryUpperSuffixTopSums = buildSuffixTopSums(secondaryUpperScores, 5);

    const charaLow = new Uint32Array(listLength);
    const charaHigh = new Uint32Array(listLength);
    const duoLow = new Uint32Array(listLength);
    const duoHigh = new Uint32Array(listLength);
    const candidateEvasion = new Float64Array(listLength);
    const candidateBuff = new Float64Array(listLength);
    const candidateDebuff = new Float64Array(listLength);
    const candidateCosmic = new Float64Array(listLength);
    const candidateFire = new Float64Array(listLength);
    const candidateWater = new Float64Array(listLength);
    const candidateFlora = new Float64Array(listLength);
    const candidateHealCards = new Float64Array(listLength);
    for (let index = 0; index < listLength; index++) {
      const chara = nonZero[index];
      const charaAny = chara as any;
      charaLow[index] = (charaAny.charaBitLowCached as number) >>> 0;
      charaHigh[index] = (charaAny.charaBitHighCached as number) >>> 0;
      duoLow[index] = (charaAny.duoBitLowCached as number) >>> 0;
      duoHigh[index] = (charaAny.duoBitHighCached as number) >>> 0;
      candidateEvasion[index] = chara.evasion;
      candidateBuff[index] = (charaAny.totalBuffCached as number) ?? 0;
      candidateDebuff[index] = (charaAny.totalDebuffCached as number) ?? 0;
      candidateCosmic[index] = (charaAny.magicCosmicCountCached as number) ?? 0;
      candidateFire[index] = (charaAny.magicFireCountCached as number) ?? 0;
      candidateWater[index] = (charaAny.magicWaterCountCached as number) ?? 0;
      candidateFlora[index] = (charaAny.magicFloraCountCached as number) ?? 0;
      candidateHealCards[index] = (charaAny.healCardCountCached as number) ?? 0;
    }
    const duoPairPresent = new Uint8Array(listLength * listLength);
    const duoAllPairPresent = new Uint8Array(listLength * listLength);
    for (let sourceIndex = 0; sourceIndex < listLength; sourceIndex++) {
      const rowOffset = sourceIndex * listLength;
      const sourceDuoLow = duoLow[sourceIndex];
      const sourceDuoHigh = duoHigh[sourceIndex];
      const sourceUseM2 = fastUseM2[sourceIndex] !== 0;
      for (let targetIndex = 0; targetIndex < listLength; targetIndex++) {
        const present = (((sourceDuoLow & charaLow[targetIndex]) | (sourceDuoHigh & charaHigh[targetIndex])) !== 0) ? 1 : 0;
        duoAllPairPresent[rowOffset + targetIndex] = present;
        if (sourceUseM2) duoPairPresent[rowOffset + targetIndex] = present;
      }
    }
    const duoSuffixPresent = new Uint8Array(listLength * (listLength + 1));
    const duoSuffixStride = listLength + 1;
    for (let sourceIndex = 0; sourceIndex < listLength; sourceIndex++) {
      const pairRowOffset = sourceIndex * listLength;
      const suffixRowOffset = sourceIndex * duoSuffixStride;
      let present = 0;
      duoSuffixPresent[suffixRowOffset + listLength] = 0;
      for (let targetIndex = listLength - 1; targetIndex >= 0; targetIndex--) {
        present |= duoPairPresent[pairRowOffset + targetIndex];
        duoSuffixPresent[suffixRowOffset + targetIndex] = present;
      }
    }
    const legacyOrderIndexes = new Int32Array(listLength);
    for (let index = 0; index < listLength; index++) {
      legacyOrderIndexes[index] = ((nonZero[index] as any)._legacyDeckOrderIndex as number | undefined) ?? index;
    }
    const resolveDuoMaskFromIndexesFast = (
      i: number,
      j: number,
      k: number,
      l: number,
      m: number,
    ): number => {
      const iDuoOffset = i * listLength;
      const jDuoOffset = j * listLength;
      const kDuoOffset = k * listLength;
      const lDuoOffset = l * listLength;
      const mDuoOffset = m * listLength;
      const candidate0 =
        duoAllPairPresent[iDuoOffset + i] |
        (duoAllPairPresent[iDuoOffset + j] << 1) |
        (duoAllPairPresent[iDuoOffset + k] << 2) |
        (duoAllPairPresent[iDuoOffset + l] << 3) |
        (duoAllPairPresent[iDuoOffset + m] << 4);
      const candidate1 =
        duoAllPairPresent[jDuoOffset + i] |
        (duoAllPairPresent[jDuoOffset + j] << 1) |
        (duoAllPairPresent[jDuoOffset + k] << 2) |
        (duoAllPairPresent[jDuoOffset + l] << 3) |
        (duoAllPairPresent[jDuoOffset + m] << 4);
      const candidate2 =
        duoAllPairPresent[kDuoOffset + i] |
        (duoAllPairPresent[kDuoOffset + j] << 1) |
        (duoAllPairPresent[kDuoOffset + k] << 2) |
        (duoAllPairPresent[kDuoOffset + l] << 3) |
        (duoAllPairPresent[kDuoOffset + m] << 4);
      const candidate3 =
        duoAllPairPresent[lDuoOffset + i] |
        (duoAllPairPresent[lDuoOffset + j] << 1) |
        (duoAllPairPresent[lDuoOffset + k] << 2) |
        (duoAllPairPresent[lDuoOffset + l] << 3) |
        (duoAllPairPresent[lDuoOffset + m] << 4);
      const candidate4 =
        duoAllPairPresent[mDuoOffset + i] |
        (duoAllPairPresent[mDuoOffset + j] << 1) |
        (duoAllPairPresent[mDuoOffset + k] << 2) |
        (duoAllPairPresent[mDuoOffset + l] << 3) |
        (duoAllPairPresent[mDuoOffset + m] << 4);
      const mutual0 =
        (duoAllPairPresent[iDuoOffset + i] & duoAllPairPresent[iDuoOffset + i]) |
        ((duoAllPairPresent[iDuoOffset + j] & duoAllPairPresent[jDuoOffset + i]) << 1) |
        ((duoAllPairPresent[iDuoOffset + k] & duoAllPairPresent[kDuoOffset + i]) << 2) |
        ((duoAllPairPresent[iDuoOffset + l] & duoAllPairPresent[lDuoOffset + i]) << 3) |
        ((duoAllPairPresent[iDuoOffset + m] & duoAllPairPresent[mDuoOffset + i]) << 4);
      const mutual1 =
        (duoAllPairPresent[jDuoOffset + i] & duoAllPairPresent[iDuoOffset + j]) |
        ((duoAllPairPresent[jDuoOffset + j] & duoAllPairPresent[jDuoOffset + j]) << 1) |
        ((duoAllPairPresent[jDuoOffset + k] & duoAllPairPresent[kDuoOffset + j]) << 2) |
        ((duoAllPairPresent[jDuoOffset + l] & duoAllPairPresent[lDuoOffset + j]) << 3) |
        ((duoAllPairPresent[jDuoOffset + m] & duoAllPairPresent[mDuoOffset + j]) << 4);
      const mutual2 =
        (duoAllPairPresent[kDuoOffset + i] & duoAllPairPresent[iDuoOffset + k]) |
        ((duoAllPairPresent[kDuoOffset + j] & duoAllPairPresent[jDuoOffset + k]) << 1) |
        ((duoAllPairPresent[kDuoOffset + k] & duoAllPairPresent[kDuoOffset + k]) << 2) |
        ((duoAllPairPresent[kDuoOffset + l] & duoAllPairPresent[lDuoOffset + k]) << 3) |
        ((duoAllPairPresent[kDuoOffset + m] & duoAllPairPresent[mDuoOffset + k]) << 4);
      const mutual3 =
        (duoAllPairPresent[lDuoOffset + i] & duoAllPairPresent[iDuoOffset + l]) |
        ((duoAllPairPresent[lDuoOffset + j] & duoAllPairPresent[jDuoOffset + l]) << 1) |
        ((duoAllPairPresent[lDuoOffset + k] & duoAllPairPresent[kDuoOffset + l]) << 2) |
        ((duoAllPairPresent[lDuoOffset + l] & duoAllPairPresent[lDuoOffset + l]) << 3) |
        ((duoAllPairPresent[lDuoOffset + m] & duoAllPairPresent[mDuoOffset + l]) << 4);
      const mutual4 =
        (duoAllPairPresent[mDuoOffset + i] & duoAllPairPresent[iDuoOffset + m]) |
        ((duoAllPairPresent[mDuoOffset + j] & duoAllPairPresent[jDuoOffset + m]) << 1) |
        ((duoAllPairPresent[mDuoOffset + k] & duoAllPairPresent[kDuoOffset + m]) << 2) |
        ((duoAllPairPresent[mDuoOffset + l] & duoAllPairPresent[lDuoOffset + m]) << 3) |
        ((duoAllPairPresent[mDuoOffset + m] & duoAllPairPresent[mDuoOffset + m]) << 4);
      const enabledM2Mask =
        (fastUseM2[i] !== 0 ? 1 : 0) |
        (fastUseM2[j] !== 0 ? 2 : 0) |
        (fastUseM2[k] !== 0 ? 4 : 0) |
        (fastUseM2[l] !== 0 ? 8 : 0) |
        (fastUseM2[m] !== 0 ? 16 : 0);
      return resolveFixedFiveDuoMaskFromMasks(
        candidate0,
        candidate1,
        candidate2,
        candidate3,
        candidate4,
        mutual0,
        mutual1,
        mutual2,
        mutual3,
        mutual4,
        enabledM2Mask,
      );
    };

    const minHP = snapshot.minHP;
    const minEHP = snapshot.minEHP;
    const minDuo = snapshot.minDuo;
    const minEvasion = snapshot.minEvasion;
    const minBuff = snapshot.minBuff;
    const minDebuff = snapshot.minDebuff;
    const minCosmic = snapshot.minCosmic;
    const minFire = snapshot.minFire;
    const minWater = snapshot.minWater;
    const minFlora = snapshot.minFlora;
    const minHealNum = snapshot.minHealNum;
    const minReferenceDamage = snapshot.minReferenceDamage;
    const minReferenceAdvantageDamage = snapshot.minReferenceAdvantageDamage;
    const minReferenceVsHiDamage = snapshot.minReferenceVsHiDamage;
    const minReferenceVsMizuDamage = snapshot.minReferenceVsMizuDamage;
    const minReferenceVsKiDamage = snapshot.minReferenceVsKiDamage;
    const hasBasicDuoHpThreshold = minHP > 0 || minEHP > 0;
    const hasBasicDuoAuxThreshold =
      minEvasion > 0 ||
      minBuff > 0 ||
      minDebuff > 0 ||
      minCosmic > 0 ||
      minFire > 0 ||
      minWater > 0 ||
      minFlora > 0 ||
      minHealNum > 0;
    const hasBasicDuoDamageThreshold =
      minReferenceDamage > 0 ||
      minReferenceAdvantageDamage > 0 ||
      minReferenceVsHiDamage > 0 ||
      minReferenceVsMizuDamage > 0 ||
      minReferenceVsKiDamage > 0;
    const hasBasicDuoExactFilterThreshold =
      hasBasicDuoHpThreshold ||
      hasBasicDuoAuxThreshold ||
      hasBasicDuoDamageThreshold;
    const basicDuoSecondaryMinimum =
      basicDuoSecondaryDamageMetric === DAMAGE_METRIC_REFERENCE
        ? minReferenceDamage
        : basicDuoSecondaryDamageMetric === DAMAGE_METRIC_ADVANTAGE
          ? minReferenceAdvantageDamage
          : basicDuoSecondaryDamageMetric === DAMAGE_METRIC_VS_HI
            ? minReferenceVsHiDamage
            : basicDuoSecondaryDamageMetric === DAMAGE_METRIC_VS_MIZU
              ? minReferenceVsMizuDamage
              : basicDuoSecondaryDamageMetric === DAMAGE_METRIC_VS_KI
                ? minReferenceVsKiDamage
                : 0;

    const evasionSuffixTopSums = minEvasion > 0 ? buildSuffixTopSums(candidateEvasion, 5) : null;
    const buffSuffixTopSums = minBuff > 0 ? buildSuffixTopSums(candidateBuff, 5) : null;
    const debuffSuffixTopSums = minDebuff > 0 ? buildSuffixTopSums(candidateDebuff, 5) : null;
    const cosmicSuffixTopSums = minCosmic > 0 ? buildSuffixTopSums(candidateCosmic, 5) : null;
    const fireSuffixTopSums = minFire > 0 ? buildSuffixTopSums(candidateFire, 5) : null;
    const waterSuffixTopSums = minWater > 0 ? buildSuffixTopSums(candidateWater, 5) : null;
    const floraSuffixTopSums = minFlora > 0 ? buildSuffixTopSums(candidateFlora, 5) : null;
    const healNumSuffixTopSums = minHealNum > 0 ? buildSuffixTopSums(candidateHealCards, 5) : null;
    const referenceUpperScores = minReferenceDamage > 0 ? buildCachedNumberScoreArray('referenceDamageUpperTop2Cached') : null;
    const advantageUpperScores = minReferenceAdvantageDamage > 0 ? buildCachedNumberScoreArray('referenceAdvantageDamageUpperTop2Cached') : null;
    const vsHiUpperScores = minReferenceVsHiDamage > 0 ? buildCachedNumberScoreArray('referenceVsHiDamageUpperTop2Cached') : null;
    const vsMizuUpperScores = minReferenceVsMizuDamage > 0 ? buildCachedNumberScoreArray('referenceVsMizuDamageUpperTop2Cached') : null;
    const vsKiUpperScores = minReferenceVsKiDamage > 0 ? buildCachedNumberScoreArray('referenceVsKiDamageUpperTop2Cached') : null;
    const referenceSuffixTopSums = referenceUpperScores ? buildSuffixTopSums(referenceUpperScores, 5) : null;
    const advantageSuffixTopSums = advantageUpperScores ? buildSuffixTopSums(advantageUpperScores, 5) : null;
    const vsHiSuffixTopSums = vsHiUpperScores ? buildSuffixTopSums(vsHiUpperScores, 5) : null;
    const vsMizuSuffixTopSums = vsMizuUpperScores ? buildSuffixTopSums(vsMizuUpperScores, 5) : null;
    const vsKiSuffixTopSums = vsKiUpperScores ? buildSuffixTopSums(vsKiUpperScores, 5) : null;

    const countDuoBits = (mask: number): number =>
      ((mask & 1) !== 0 ? 1 : 0) +
      ((mask & 2) !== 0 ? 1 : 0) +
      ((mask & 4) !== 0 ? 1 : 0) +
      ((mask & 8) !== 0 ? 1 : 0) +
      ((mask & 16) !== 0 ? 1 : 0);

    const primaryDamageRaw = (
      metricOffset: number,
      i: number,
      j: number,
      k: number,
      l: number,
      m: number,
      iMask: number,
      jMask: number,
      kMask: number,
      lMask: number,
      mMask: number,
      duoMask: number,
    ): number => {
      const iIndex = metricOffset + ((fastDuoBaseOffsets[i] !== 0 || (duoMask & 1) !== 0) ? 8 : 0) + iMask;
      const jIndex = metricOffset + ((fastDuoBaseOffsets[j] !== 0 || (duoMask & 2) !== 0) ? 8 : 0) + jMask;
      const kIndex = metricOffset + ((fastDuoBaseOffsets[k] !== 0 || (duoMask & 4) !== 0) ? 8 : 0) + kMask;
      const lIndex = metricOffset + ((fastDuoBaseOffsets[l] !== 0 || (duoMask & 8) !== 0) ? 8 : 0) + lMask;
      const mIndex = metricOffset + ((fastDuoBaseOffsets[m] !== 0 || (duoMask & 16) !== 0) ? 8 : 0) + mMask;
      const iSum = damageTables[i][iIndex];
      const jSum = damageTables[j][jIndex];
      const kSum = damageTables[k][kIndex];
      const lSum = damageTables[l][lIndex];
      const mSum = damageTables[m][mIndex];
      const total = iSum + jSum + kSum + lSum + mSum;
      if (basicDuoAttackNum >= 10) return total;
      const iMin = minDamageTables[i][iIndex];
      const jMin = minDamageTables[j][jIndex];
      const kMin = minDamageTables[k][kIndex];
      const lMin = minDamageTables[l][lIndex];
      const mMin = minDamageTables[m][mIndex];
      if (basicDuoAttackNum === 9) return total - Math.min(iMin, jMin, kMin, lMin, mMin);
      let min1 = Infinity;
      let min2 = Infinity;
      let value = iMin;
      if (value < min1) { min2 = min1; min1 = value; } else if (value < min2) { min2 = value; }
      value = iSum - iMin;
      if (value < min1) { min2 = min1; min1 = value; } else if (value < min2) { min2 = value; }
      value = jMin;
      if (value < min1) { min2 = min1; min1 = value; } else if (value < min2) { min2 = value; }
      value = jSum - jMin;
      if (value < min1) { min2 = min1; min1 = value; } else if (value < min2) { min2 = value; }
      value = kMin;
      if (value < min1) { min2 = min1; min1 = value; } else if (value < min2) { min2 = value; }
      value = kSum - kMin;
      if (value < min1) { min2 = min1; min1 = value; } else if (value < min2) { min2 = value; }
      value = lMin;
      if (value < min1) { min2 = min1; min1 = value; } else if (value < min2) { min2 = value; }
      value = lSum - lMin;
      if (value < min1) { min2 = min1; min1 = value; } else if (value < min2) { min2 = value; }
      value = mMin;
      if (value < min1) { min2 = min1; min1 = value; } else if (value < min2) { min2 = value; }
      value = mSum - mMin;
      if (value < min1) { min2 = min1; min1 = value; } else if (value < min2) { min2 = value; }
      return total - min1 - min2;
    };

    const branchCouldPassThresholds = (
      evasion: number,
      buff: number,
      debuff: number,
      cosmic: number,
      fire: number,
      water: number,
      flora: number,
      healNum: number,
      referenceDamage: number,
      advantageDamage: number,
      vsHiDamage: number,
      vsMizuDamage: number,
      vsKiDamage: number,
      suffixStart: number,
      pickCount: number,
    ): boolean => {
      if (evasionSuffixTopSums && evasion + evasionSuffixTopSums[pickCount][suffixStart] < minEvasion) return false;
      if (buffSuffixTopSums && buff + buffSuffixTopSums[pickCount][suffixStart] < minBuff) return false;
      if (debuffSuffixTopSums && debuff + debuffSuffixTopSums[pickCount][suffixStart] < minDebuff) return false;
      if (cosmicSuffixTopSums && cosmic + cosmicSuffixTopSums[pickCount][suffixStart] < minCosmic) return false;
      if (fireSuffixTopSums && fire + fireSuffixTopSums[pickCount][suffixStart] < minFire) return false;
      if (waterSuffixTopSums && water + waterSuffixTopSums[pickCount][suffixStart] < minWater) return false;
      if (floraSuffixTopSums && flora + floraSuffixTopSums[pickCount][suffixStart] < minFlora) return false;
      if (healNumSuffixTopSums && healNum + healNumSuffixTopSums[pickCount][suffixStart] < minHealNum) return false;
      if (referenceSuffixTopSums && referenceDamage + referenceSuffixTopSums[pickCount][suffixStart] < minReferenceDamage) return false;
      if (advantageSuffixTopSums && advantageDamage + advantageSuffixTopSums[pickCount][suffixStart] < minReferenceAdvantageDamage) return false;
      if (vsHiSuffixTopSums && vsHiDamage + vsHiSuffixTopSums[pickCount][suffixStart] < minReferenceVsHiDamage) return false;
      if (vsMizuSuffixTopSums && vsMizuDamage + vsMizuSuffixTopSums[pickCount][suffixStart] < minReferenceVsMizuDamage) return false;
      if (vsKiSuffixTopSums && vsKiDamage + vsKiSuffixTopSums[pickCount][suffixStart] < minReferenceVsKiDamage) return false;
      return true;
    };
    const candidateCouldPassThresholds = (
      evasion: number,
      buff: number,
      debuff: number,
      cosmic: number,
      fire: number,
      water: number,
      flora: number,
      healNum: number,
      referenceDamageUpper: number,
      advantageDamageUpper: number,
      vsHiDamageUpper: number,
      vsMizuDamageUpper: number,
      vsKiDamageUpper: number,
      candidateIndex: number,
    ): boolean => {
      if (evasionSuffixTopSums && evasion + candidateEvasion[candidateIndex] < minEvasion) return false;
      if (buffSuffixTopSums && buff + candidateBuff[candidateIndex] < minBuff) return false;
      if (debuffSuffixTopSums && debuff + candidateDebuff[candidateIndex] < minDebuff) return false;
      if (cosmicSuffixTopSums && cosmic + candidateCosmic[candidateIndex] < minCosmic) return false;
      if (fireSuffixTopSums && fire + candidateFire[candidateIndex] < minFire) return false;
      if (waterSuffixTopSums && water + candidateWater[candidateIndex] < minWater) return false;
      if (floraSuffixTopSums && flora + candidateFlora[candidateIndex] < minFlora) return false;
      if (healNumSuffixTopSums && healNum + candidateHealCards[candidateIndex] < minHealNum) return false;
      if (referenceUpperScores && referenceDamageUpper + referenceUpperScores[candidateIndex] < minReferenceDamage) return false;
      if (advantageUpperScores && advantageDamageUpper + advantageUpperScores[candidateIndex] < minReferenceAdvantageDamage) return false;
      if (vsHiUpperScores && vsHiDamageUpper + vsHiUpperScores[candidateIndex] < minReferenceVsHiDamage) return false;
      if (vsMizuUpperScores && vsMizuDamageUpper + vsMizuUpperScores[candidateIndex] < minReferenceVsMizuDamage) return false;
      if (vsKiUpperScores && vsKiDamageUpper + vsKiUpperScores[candidateIndex] < minReferenceVsKiDamage) return false;
      return true;
    };

    const countBasicDuoPrimaryCandidate = (
      i: number,
      j: number,
      k: number,
      l: number,
      m: number,
    ): number => {
      const sort0 = legacyOrderIndexes[i];
      const sort1 = legacyOrderIndexes[j];
      const sort2 = legacyOrderIndexes[k];
      const sort3 = legacyOrderIndexes[l];
      const sort4 = legacyOrderIndexes[m];
      if (
        sort0 <= sort1 &&
        sort1 <= sort2 &&
        sort2 <= sort3 &&
        sort3 <= sort4
      ) {
        return countDuoBits(resolveDuoMaskFromIndexesFast(i, j, k, l, m));
      }

      let a = i;
      let b = j;
      let c = k;
      let d = l;
      let e = m;
      let aOrder = sort0;
      let bOrder = sort1;
      let cOrder = sort2;
      let dOrder = sort3;
      let eOrder = sort4;
      if (bOrder < aOrder) {
        const ti = a; a = b; b = ti;
        const to = aOrder; aOrder = bOrder; bOrder = to;
      }
      if (cOrder < bOrder) {
        const ti = b; b = c; c = ti;
        const to = bOrder; bOrder = cOrder; cOrder = to;
        if (bOrder < aOrder) {
          const ti2 = a; a = b; b = ti2;
          const to2 = aOrder; aOrder = bOrder; bOrder = to2;
        }
      }
      if (dOrder < cOrder) {
        const ti = c; c = d; d = ti;
        const to = cOrder; cOrder = dOrder; dOrder = to;
        if (cOrder < bOrder) {
          const ti2 = b; b = c; c = ti2;
          const to2 = bOrder; bOrder = cOrder; cOrder = to2;
          if (bOrder < aOrder) {
            const ti3 = a; a = b; b = ti3;
            const to3 = aOrder; aOrder = bOrder; bOrder = to3;
          }
        }
      }
      if (eOrder < dOrder) {
        const ti = d; d = e; e = ti;
        const to = dOrder; dOrder = eOrder; eOrder = to;
        if (dOrder < cOrder) {
          const ti2 = c; c = d; d = ti2;
          const to2 = cOrder; cOrder = dOrder; dOrder = to2;
          if (cOrder < bOrder) {
            const ti3 = b; b = c; c = ti3;
            const to3 = bOrder; bOrder = cOrder; cOrder = to3;
            if (bOrder < aOrder) {
              const ti4 = a; a = b; b = ti4;
              const to4 = aOrder; aOrder = bOrder; bOrder = to4;
            }
          }
        }
      }
      return countDuoBits(resolveDuoMaskFromIndexesFast(a, b, c, d, e));
    };

    const scoreBasicDuoCandidate = (
      i: number,
      j: number,
      k: number,
      l: number,
      m: number,
      iMask: number,
      jMask: number,
      kMask: number,
      lMask: number,
      mMask: number,
      duoMaskOverride: number = -1,
      primaryScoreOverride: number = -1,
    ): { primaryScore: number; secondaryScore: number; i: number; j: number; k: number; l: number; m: number } | null => {
      const sort0 = legacyOrderIndexes[i];
      const sort1 = legacyOrderIndexes[j];
      const sort2 = legacyOrderIndexes[k];
      const sort3 = legacyOrderIndexes[l];
      const sort4 = legacyOrderIndexes[m];
      const alreadyLegacyOrder =
        sort0 <= sort1 &&
        sort1 <= sort2 &&
        sort2 <= sort3 &&
        sort3 <= sort4;
      if (!alreadyLegacyOrder) {
        let a = i;
        let b = j;
        let c = k;
        let d = l;
        let e = m;
        let aOrder = sort0;
        let bOrder = sort1;
        let cOrder = sort2;
        let dOrder = sort3;
        let eOrder = sort4;
        if (bOrder < aOrder) {
          const ti = a; a = b; b = ti;
          const to = aOrder; aOrder = bOrder; bOrder = to;
        }
        if (cOrder < bOrder) {
          const ti = b; b = c; c = ti;
          const to = bOrder; bOrder = cOrder; cOrder = to;
          if (bOrder < aOrder) {
            const ti2 = a; a = b; b = ti2;
            const to2 = aOrder; aOrder = bOrder; bOrder = to2;
          }
        }
        if (dOrder < cOrder) {
          const ti = c; c = d; d = ti;
          const to = cOrder; cOrder = dOrder; dOrder = to;
          if (cOrder < bOrder) {
            const ti2 = b; b = c; c = ti2;
            const to2 = bOrder; bOrder = cOrder; cOrder = to2;
            if (bOrder < aOrder) {
              const ti3 = a; a = b; b = ti3;
              const to3 = aOrder; aOrder = bOrder; bOrder = to3;
            }
          }
        }
        if (eOrder < dOrder) {
          const ti = d; d = e; e = ti;
          const to = dOrder; dOrder = eOrder; eOrder = to;
          if (dOrder < cOrder) {
            const ti2 = c; c = d; d = ti2;
            const to2 = cOrder; cOrder = dOrder; dOrder = to2;
            if (cOrder < bOrder) {
              const ti3 = b; b = c; c = ti3;
              const to3 = bOrder; bOrder = cOrder; cOrder = to3;
              if (bOrder < aOrder) {
                const ti4 = a; a = b; b = ti4;
                const to4 = aOrder; aOrder = bOrder; bOrder = to4;
              }
            }
          }
        }
        i = a;
        j = b;
        k = c;
        l = d;
        m = e;
        iMask = -1;
        jMask = -1;
        kMask = -1;
        lMask = -1;
        mMask = -1;
        duoMaskOverride = -1;
        primaryScoreOverride = -1;
      }
      if (hasBasicDuoHpThreshold && iMask < 0) {
        const iBuddyMaskOffset = i * listLength;
        const jBuddyMaskOffset = j * listLength;
        const kBuddyMaskOffset = k * listLength;
        const lBuddyMaskOffset = l * listLength;
        const mBuddyMaskOffset = m * listLength;
        iMask =
          pairMasks[iBuddyMaskOffset + i] |
          pairMasks[iBuddyMaskOffset + j] |
          pairMasks[iBuddyMaskOffset + k] |
          pairMasks[iBuddyMaskOffset + l] |
          pairMasks[iBuddyMaskOffset + m];
        jMask =
          pairMasks[jBuddyMaskOffset + i] |
          pairMasks[jBuddyMaskOffset + j] |
          pairMasks[jBuddyMaskOffset + k] |
          pairMasks[jBuddyMaskOffset + l] |
          pairMasks[jBuddyMaskOffset + m];
        kMask =
          pairMasks[kBuddyMaskOffset + i] |
          pairMasks[kBuddyMaskOffset + j] |
          pairMasks[kBuddyMaskOffset + k] |
          pairMasks[kBuddyMaskOffset + l] |
          pairMasks[kBuddyMaskOffset + m];
        lMask =
          pairMasks[lBuddyMaskOffset + i] |
          pairMasks[lBuddyMaskOffset + j] |
          pairMasks[lBuddyMaskOffset + k] |
          pairMasks[lBuddyMaskOffset + l] |
          pairMasks[lBuddyMaskOffset + m];
        mMask =
          pairMasks[mBuddyMaskOffset + i] |
          pairMasks[mBuddyMaskOffset + j] |
          pairMasks[mBuddyMaskOffset + k] |
          pairMasks[mBuddyMaskOffset + l] |
          pairMasks[mBuddyMaskOffset + m];
      }
      if (hasBasicDuoHpThreshold) {
        const hp =
          hpTables[i][iMask] +
          hpTables[j][jMask] +
          hpTables[k][kMask] +
          hpTables[l][lMask] +
          hpTables[m][mMask];
        if (hp < minHP) return null;
        if (
          minEHP > 0 &&
          hp +
            healTables[i][iMask] +
            healTables[j][jMask] +
            healTables[k][kMask] +
            healTables[l][lMask] +
            healTables[m][mMask] < minEHP
        ) {
          return null;
        }
      }
      if (hasBasicDuoAuxThreshold) {
        if (minEvasion > 0 && candidateEvasion[i] + candidateEvasion[j] + candidateEvasion[k] + candidateEvasion[l] + candidateEvasion[m] < minEvasion) return null;
        if (minBuff > 0 && candidateBuff[i] + candidateBuff[j] + candidateBuff[k] + candidateBuff[l] + candidateBuff[m] < minBuff) return null;
        if (minDebuff > 0 && candidateDebuff[i] + candidateDebuff[j] + candidateDebuff[k] + candidateDebuff[l] + candidateDebuff[m] < minDebuff) return null;
        if (minCosmic > 0 && candidateCosmic[i] + candidateCosmic[j] + candidateCosmic[k] + candidateCosmic[l] + candidateCosmic[m] < minCosmic) return null;
        if (minFire > 0 && candidateFire[i] + candidateFire[j] + candidateFire[k] + candidateFire[l] + candidateFire[m] < minFire) return null;
        if (minWater > 0 && candidateWater[i] + candidateWater[j] + candidateWater[k] + candidateWater[l] + candidateWater[m] < minWater) return null;
        if (minFlora > 0 && candidateFlora[i] + candidateFlora[j] + candidateFlora[k] + candidateFlora[l] + candidateFlora[m] < minFlora) return null;
        if (minHealNum > 0 && candidateHealCards[i] + candidateHealCards[j] + candidateHealCards[k] + candidateHealCards[l] + candidateHealCards[m] < minHealNum) return null;
      }
      const duoMask = duoMaskOverride >= 0
        ? duoMaskOverride
        : resolveDuoMaskFromIndexesFast(i, j, k, l, m);
      const primaryScore = primaryScoreOverride >= 0 ? primaryScoreOverride : countDuoBits(duoMask);
      if (primaryScore < minDuo) return null;
      if (!metricPrimaryCouldBeat(primaryScore, Number.POSITIVE_INFINITY)) return null;
      if (iMask < 0) {
        const iBuddyMaskOffset = i * listLength;
        const jBuddyMaskOffset = j * listLength;
        const kBuddyMaskOffset = k * listLength;
        const lBuddyMaskOffset = l * listLength;
        const mBuddyMaskOffset = m * listLength;
        iMask =
          pairMasks[iBuddyMaskOffset + i] |
          pairMasks[iBuddyMaskOffset + j] |
          pairMasks[iBuddyMaskOffset + k] |
          pairMasks[iBuddyMaskOffset + l] |
          pairMasks[iBuddyMaskOffset + m];
        jMask =
          pairMasks[jBuddyMaskOffset + i] |
          pairMasks[jBuddyMaskOffset + j] |
          pairMasks[jBuddyMaskOffset + k] |
          pairMasks[jBuddyMaskOffset + l] |
          pairMasks[jBuddyMaskOffset + m];
        kMask =
          pairMasks[kBuddyMaskOffset + i] |
          pairMasks[kBuddyMaskOffset + j] |
          pairMasks[kBuddyMaskOffset + k] |
          pairMasks[kBuddyMaskOffset + l] |
          pairMasks[kBuddyMaskOffset + m];
        lMask =
          pairMasks[lBuddyMaskOffset + i] |
          pairMasks[lBuddyMaskOffset + j] |
          pairMasks[lBuddyMaskOffset + k] |
          pairMasks[lBuddyMaskOffset + l] |
          pairMasks[lBuddyMaskOffset + m];
        mMask =
          pairMasks[mBuddyMaskOffset + i] |
          pairMasks[mBuddyMaskOffset + j] |
          pairMasks[mBuddyMaskOffset + k] |
          pairMasks[mBuddyMaskOffset + l] |
          pairMasks[mBuddyMaskOffset + m];
      }

      const secondaryRaw = primaryDamageRaw(secondaryMetricOffset, i, j, k, l, m, iMask, jMask, kMask, lMask, mMask, duoMask);
      let referenceRaw = basicDuoSecondaryDamageMetric === DAMAGE_METRIC_REFERENCE ? secondaryRaw : NaN;
      let advantageRaw = basicDuoSecondaryDamageMetric === DAMAGE_METRIC_ADVANTAGE ? secondaryRaw : NaN;
      let vsHiRaw = basicDuoSecondaryDamageMetric === DAMAGE_METRIC_VS_HI ? secondaryRaw : NaN;
      let vsMizuRaw = basicDuoSecondaryDamageMetric === DAMAGE_METRIC_VS_MIZU ? secondaryRaw : NaN;
      let vsKiRaw = basicDuoSecondaryDamageMetric === DAMAGE_METRIC_VS_KI ? secondaryRaw : NaN;
      if (minReferenceDamage > 0) {
        if (Number.isNaN(referenceRaw)) referenceRaw = primaryDamageRaw(getDamageMetricTableIndex(DAMAGE_METRIC_REFERENCE) << 4, i, j, k, l, m, iMask, jMask, kMask, lMask, mMask, duoMask);
        if (referenceRaw < minReferenceDamage) return null;
      }
      if (minReferenceAdvantageDamage > 0) {
        if (Number.isNaN(advantageRaw)) advantageRaw = primaryDamageRaw(getDamageMetricTableIndex(DAMAGE_METRIC_ADVANTAGE) << 4, i, j, k, l, m, iMask, jMask, kMask, lMask, mMask, duoMask);
        if (advantageRaw < minReferenceAdvantageDamage) return null;
      }
      if (minReferenceVsHiDamage > 0) {
        if (Number.isNaN(vsHiRaw)) vsHiRaw = primaryDamageRaw(getDamageMetricTableIndex(DAMAGE_METRIC_VS_HI) << 4, i, j, k, l, m, iMask, jMask, kMask, lMask, mMask, duoMask);
        if (vsHiRaw < minReferenceVsHiDamage) return null;
      }
      if (minReferenceVsMizuDamage > 0) {
        if (Number.isNaN(vsMizuRaw)) vsMizuRaw = primaryDamageRaw(getDamageMetricTableIndex(DAMAGE_METRIC_VS_MIZU) << 4, i, j, k, l, m, iMask, jMask, kMask, lMask, mMask, duoMask);
        if (vsMizuRaw < minReferenceVsMizuDamage) return null;
      }
      if (minReferenceVsKiDamage > 0) {
        if (Number.isNaN(vsKiRaw)) vsKiRaw = primaryDamageRaw(getDamageMetricTableIndex(DAMAGE_METRIC_VS_KI) << 4, i, j, k, l, m, iMask, jMask, kMask, lMask, mMask, duoMask);
        if (vsKiRaw < minReferenceVsKiDamage) return null;
      }
      const secondaryScore = Math.floor(secondaryRaw);
      if (!metricPrimaryCouldBeat(primaryScore, secondaryScore)) return null;
      return { primaryScore, secondaryScore, i, j, k, l, m };
    };

    const preseedBasicDuoThreshold = () => {
      if (metricPrimaryFastMaxSize <= 0) return;
      const maxSeedCombinations = listLength <= 64 ? 50000 : 500000;
      let candidateLimit = Math.min(lengthes[4], 56);
      while (candidateLimit > 24 && combinationCount(candidateLimit, 5) > maxSeedCombinations) {
        candidateLimit -= 1;
      }
      if (candidateLimit < 5) return;

      const seedEntries: { primaryScore: number; secondaryScore: number }[] = [];
      let seedThresholdPrimary = -Infinity;
      let seedThresholdSecondary = -Infinity;
      let seedCandidateChecks = 0;
      let seedValidCount = 0;
      const compareSeedEntries = (
        a: { primaryScore: number; secondaryScore: number },
        b: { primaryScore: number; secondaryScore: number },
      ): number => {
        if (a.primaryScore !== b.primaryScore) return b.primaryScore - a.primaryScore;
        if (a.secondaryScore !== b.secondaryScore) return b.secondaryScore - a.secondaryScore;
        return 0;
      };
      const updateSeedThreshold = () => {
        const worst = seedEntries[metricPrimaryFastMaxSize - 1];
        seedThresholdPrimary = worst.primaryScore;
        seedThresholdSecondary = worst.secondaryScore;
      };
      const seedCouldEnter = (primaryScore: number, secondaryScore: number): boolean => {
        if (seedEntries.length < metricPrimaryFastMaxSize) return true;
        if (primaryScore > seedThresholdPrimary) return true;
        if (primaryScore < seedThresholdPrimary) return false;
        return secondaryScore >= seedThresholdSecondary;
      };
      const addSeedEntry = (primaryScore: number, secondaryScore: number) => {
        if (!seedCouldEnter(primaryScore, secondaryScore)) return;
        const entry = { primaryScore, secondaryScore };
        if (seedEntries.length < metricPrimaryFastMaxSize) {
          seedEntries.push(entry);
          if (seedEntries.length === metricPrimaryFastMaxSize) {
            seedEntries.sort(compareSeedEntries);
            updateSeedThreshold();
          }
          return;
        }
        let left = 0;
        let right = seedEntries.length;
        while (left < right) {
          const mid = (left + right) >>> 1;
          if (compareSeedEntries(entry, seedEntries[mid]) < 0) right = mid;
          else left = mid + 1;
        }
        if (left >= metricPrimaryFastMaxSize) return;
        for (let index = metricPrimaryFastMaxSize - 1; index > left; index--) {
          seedEntries[index] = seedEntries[index - 1];
        }
        seedEntries[left] = entry;
        updateSeedThreshold();
      };

      for (let i = 0; i < candidateLimit - 4; i++) {
        const iBuddyMaskOffset = i * listLength;
        for (let j = i + 1; j < candidateLimit - 3; j++) {
          const jBuddyMaskOffset = j * listLength;
          for (let k = j + 1; k < candidateLimit - 2; k++) {
            const kBuddyMaskOffset = k * listLength;
            for (let l = k + 1; l < candidateLimit - 1; l++) {
              const lBuddyMaskOffset = l * listLength;
              const iBaseMask =
                pairMasks[iBuddyMaskOffset + i] |
                pairMasks[iBuddyMaskOffset + j] |
                pairMasks[iBuddyMaskOffset + k] |
                pairMasks[iBuddyMaskOffset + l];
              const jBaseMask =
                pairMasks[jBuddyMaskOffset + i] |
                pairMasks[jBuddyMaskOffset + j] |
                pairMasks[jBuddyMaskOffset + k] |
                pairMasks[jBuddyMaskOffset + l];
              const kBaseMask =
                pairMasks[kBuddyMaskOffset + i] |
                pairMasks[kBuddyMaskOffset + j] |
                pairMasks[kBuddyMaskOffset + k] |
                pairMasks[kBuddyMaskOffset + l];
              const lBaseMask =
                pairMasks[lBuddyMaskOffset + i] |
                pairMasks[lBuddyMaskOffset + j] |
                pairMasks[lBuddyMaskOffset + k] |
                pairMasks[lBuddyMaskOffset + l];
              const prefixSecondaryUpper =
                secondaryUpperScores[i] +
                secondaryUpperScores[j] +
                secondaryUpperScores[k] +
                secondaryUpperScores[l];
              for (let m = l + 1; m < candidateLimit; m++) {
                const duoMask = resolveDuoMaskFromIndexesFast(i, j, k, l, m);
                const primaryScore = countDuoBits(duoMask);
                const secondaryUpper = Math.floor(prefixSecondaryUpper + secondaryUpperScores[m]);
                if (!seedCouldEnter(primaryScore, secondaryUpper)) {
                  incrementDebugCounter('basicDuoSeedPrimarySkip');
                  continue;
                }
                seedCandidateChecks += 1;
                const mBuddyMaskOffset = m * listLength;
                const iMask = iBaseMask | pairMasks[iBuddyMaskOffset + m];
                const jMask = jBaseMask | pairMasks[jBuddyMaskOffset + m];
                const kMask = kBaseMask | pairMasks[kBuddyMaskOffset + m];
                const lMask = lBaseMask | pairMasks[lBuddyMaskOffset + m];
                const mMask =
                  pairMasks[mBuddyMaskOffset + i] |
                  pairMasks[mBuddyMaskOffset + j] |
                  pairMasks[mBuddyMaskOffset + k] |
                  pairMasks[mBuddyMaskOffset + l] |
                  pairMasks[mBuddyMaskOffset + m];
                const score = scoreBasicDuoCandidate(i, j, k, l, m, iMask, jMask, kMask, lMask, mMask, duoMask, primaryScore);
                if (!score) continue;
                seedValidCount += 1;
                addSeedEntry(score.primaryScore, score.secondaryScore);
              }
            }
          }
        }
      }
      if (seedEntries.length >= metricPrimaryFastMaxSize) {
        metricPrimarySeedThresholdPrimary = seedThresholdPrimary;
        metricPrimarySeedThresholdSecondary = seedThresholdSecondary;
        if (debugCounters) {
          debugCounters.basicDuoSeedCandidateLimit = candidateLimit;
          debugCounters.basicDuoSeedCandidateChecks = seedCandidateChecks;
          debugCounters.basicDuoSeedValid = seedValidCount;
          debugCounters.basicDuoSeedThresholdPrimary = metricPrimarySeedThresholdPrimary;
          debugCounters.basicDuoSeedThresholdSecondary = metricPrimarySeedThresholdSecondary;
        }
      }
    };

    let requiredTwoSeededCandidateKeys: Set<number> | null = null;
    const packRequiredTwoCandidateKey = (a: number, b: number, c: number): number => {
      if (b < a) { const t = a; a = b; b = t; }
      if (c < b) {
        const t = b; b = c; c = t;
        if (b < a) { const t2 = a; a = b; b = t2; }
      }
      return ((a * listLength) + b) * listLength + c;
    };

    const preseedRequiredBasicDuoThreshold = () => {
      if (requiredCount <= 0 || requiredCount >= 5 || metricPrimaryFastMaxSize <= 0) return;
      const pickCount = 5 - requiredCount;
      const availableCount = lengthes[4] - requiredCount;
      if (availableCount < pickCount) return;

      if (requiredCount === 2) {
        const targetPrimary = Math.max(2, minDuo);
        if (targetPrimary <= 5) {
          const duoConnectivity = new Int16Array(listLength);
          for (let sourceIndex = 0; sourceIndex < listLength; sourceIndex++) {
            const sourceOffset = sourceIndex * listLength;
            for (let targetIndex = requiredCount; targetIndex < listLength; targetIndex++) {
              duoConnectivity[targetIndex] +=
                duoPairPresent[sourceOffset + targetIndex] +
                duoPairPresent[targetIndex * listLength + sourceIndex];
            }
          }
          const primaryOrder = new Int32Array(availableCount);
          for (let index = 0; index < availableCount; index++) primaryOrder[index] = requiredCount + index;
          primaryOrder.sort((a, b) => {
            const duoDiff = duoConnectivity[b] - duoConnectivity[a];
            if (duoDiff !== 0) return duoDiff;
            const secondaryDiff = secondaryUpperScores[b] - secondaryUpperScores[a];
            if (secondaryDiff !== 0) return secondaryDiff;
            return a - b;
          });

          const selected = new Int32Array(5);
          for (let index = 0; index < requiredCount; index++) selected[index] = index;
          let primarySeedChecks = 0;
          let primarySeedExactChecks = 0;
          let primarySeedValid = 0;
          let primarySeedSecondaryFloor = Infinity;
          const primarySeedEntries: Array<{ score: BasicDuoExactScore; a: number; b: number; c: number }> = [];
          const maxPrimarySeedChecks = Math.max(metricPrimaryFastMaxSize * 4, 900);
          const choosePrimarySeed = (depth: number, orderStart: number): void => {
            if (primarySeedValid >= metricPrimaryFastMaxSize || primarySeedChecks >= maxPrimarySeedChecks) return;
            if (depth === 5) {
              primarySeedChecks += 1;
              const primaryScore = countBasicDuoPrimaryCandidate(
                selected[0],
                selected[1],
                selected[2],
                selected[3],
                selected[4],
              );
              if (primaryScore < targetPrimary) return;
              if (hasBasicDuoExactFilterThreshold) {
                primarySeedExactChecks += 1;
                const score = scoreBasicDuoCandidate(
                  selected[0],
                  selected[1],
                  selected[2],
                  selected[3],
                  selected[4],
                  -1,
                  -1,
                  -1,
                  -1,
                  -1,
                );
                if (!score || score.primaryScore < targetPrimary) return;
                if (score.secondaryScore < primarySeedSecondaryFloor) {
                  primarySeedSecondaryFloor = score.secondaryScore;
                }
                primarySeedEntries.push({
                  score,
                  a: selected[2],
                  b: selected[3],
                  c: selected[4],
                });
              }
              primarySeedValid += 1;
              return;
            }
            const remaining = 5 - depth;
            for (let orderIndex = orderStart; orderIndex <= availableCount - remaining; orderIndex++) {
              selected[depth] = primaryOrder[orderIndex];
              choosePrimarySeed(depth + 1, orderIndex + 1);
              if (primarySeedValid >= metricPrimaryFastMaxSize || primarySeedChecks >= maxPrimarySeedChecks) return;
            }
          };
          choosePrimarySeed(requiredCount, 0);
          if (debugCounters) {
            debugCounters.basicDuoRequiredPrimarySeedChecks = primarySeedChecks;
            debugCounters.basicDuoRequiredPrimarySeedExactChecks = primarySeedExactChecks;
            debugCounters.basicDuoRequiredPrimarySeedValid = primarySeedValid;
            debugCounters.basicDuoRequiredPrimarySeedTarget = targetPrimary;
            if (primarySeedSecondaryFloor !== Infinity) {
              debugCounters.basicDuoRequiredPrimarySeedSecondaryFloor = primarySeedSecondaryFloor;
            }
          }
          if (primarySeedValid >= metricPrimaryFastMaxSize) {
            metricPrimarySeedThresholdPrimary = targetPrimary;
            metricPrimarySeedThresholdSecondary = primarySeedSecondaryFloor !== Infinity
              ? primarySeedSecondaryFloor
              : -Infinity;
            if (primarySeedEntries.length > 0 && metricPrimaryFastEntries && metricPrimaryFastEntries.length === 0) {
              requiredTwoSeededCandidateKeys = new Set<number>();
              for (const entry of primarySeedEntries) {
                const score = entry.score;
                addMetricPrimaryFastEntry(
                  score.primaryScore,
                  score.secondaryScore,
                  nonZero[score.i],
                  nonZero[score.j],
                  nonZero[score.k],
                  nonZero[score.l],
                  nonZero[score.m],
                );
                requiredTwoSeededCandidateKeys.add(packRequiredTwoCandidateKey(entry.a, entry.b, entry.c));
              }
            }
            if (debugCounters) {
              debugCounters.basicDuoRequiredSeedCandidateChecks = primarySeedChecks;
              debugCounters.basicDuoRequiredSeedExactChecks = primarySeedExactChecks;
              debugCounters.basicDuoRequiredSeedValid = primarySeedValid;
              debugCounters.basicDuoRequiredSeedThresholdPrimary = metricPrimarySeedThresholdPrimary;
              debugCounters.basicDuoRequiredSeedThresholdSecondary = metricPrimarySeedThresholdSecondary;
            }
          }
          return;
        }
      }

      const maxSeedCombinations = requiredCount === 2
        ? Math.max(500, Math.min(900, metricPrimaryFastMaxSize * 3))
        : Math.max(
          800,
          Math.min(8000, metricPrimaryFastMaxSize * 8),
        );
      let seedCount = Math.min(availableCount, 48);
      while (seedCount > pickCount && combinationCount(seedCount, pickCount) > maxSeedCombinations) {
        seedCount -= 1;
      }
      if (combinationCount(seedCount, pickCount) < metricPrimaryFastMaxSize) return;

      const order = new Int32Array(availableCount);
      for (let index = 0; index < availableCount; index++) order[index] = requiredCount + index;
      order.sort((a, b) => {
        const diff = secondaryUpperScores[b] - secondaryUpperScores[a];
        if (diff !== 0) return diff;
        return a - b;
      });

      const seedEntries: { primaryScore: number; secondaryScore: number }[] = [];
      let seedThresholdPrimary = -Infinity;
      let seedThresholdSecondary = -Infinity;
      let seedCandidateChecks = 0;
      let seedValidCount = 0;
      const compareSeedEntries = (
        a: { primaryScore: number; secondaryScore: number },
        b: { primaryScore: number; secondaryScore: number },
      ): number => {
        if (a.primaryScore !== b.primaryScore) return b.primaryScore - a.primaryScore;
        if (a.secondaryScore !== b.secondaryScore) return b.secondaryScore - a.secondaryScore;
        return 0;
      };
      const updateSeedThreshold = () => {
        const worst = seedEntries[metricPrimaryFastMaxSize - 1];
        seedThresholdPrimary = worst.primaryScore;
        seedThresholdSecondary = worst.secondaryScore;
      };
      const seedCouldEnter = (primaryScore: number, secondaryScore: number): boolean => {
        if (seedEntries.length < metricPrimaryFastMaxSize) return true;
        if (primaryScore > seedThresholdPrimary) return true;
        if (primaryScore < seedThresholdPrimary) return false;
        return secondaryScore >= seedThresholdSecondary;
      };
      const addSeedEntry = (primaryScore: number, secondaryScore: number) => {
        if (!seedCouldEnter(primaryScore, secondaryScore)) return;
        const entry = { primaryScore, secondaryScore };
        if (seedEntries.length < metricPrimaryFastMaxSize) {
          seedEntries.push(entry);
          if (seedEntries.length === metricPrimaryFastMaxSize) {
            seedEntries.sort(compareSeedEntries);
            updateSeedThreshold();
          }
          return;
        }
        let left = 0;
        let right = seedEntries.length;
        while (left < right) {
          const mid = (left + right) >>> 1;
          if (compareSeedEntries(entry, seedEntries[mid]) < 0) right = mid;
          else left = mid + 1;
        }
        if (left >= metricPrimaryFastMaxSize) return;
        for (let index = metricPrimaryFastMaxSize - 1; index > left; index--) {
          seedEntries[index] = seedEntries[index - 1];
        }
        seedEntries[left] = entry;
        updateSeedThreshold();
      };

      const selected = new Int32Array(5);
      const seenRequiredTwoSeedKeys = requiredCount === 2 ? new Set<number>() : null;
      for (let index = 0; index < requiredCount; index++) selected[index] = index;
      const requiredTwoSeedSeenOrAdd = (): boolean => {
        if (!seenRequiredTwoSeedKeys) return false;
        let a = selected[2];
        let b = selected[3];
        let c = selected[4];
        if (b < a) { const t = a; a = b; b = t; }
        if (c < b) {
          const t = b; b = c; c = t;
          if (b < a) { const t2 = a; a = b; b = t2; }
        }
        const key = ((a * listLength) + b) * listLength + c;
        if (seenRequiredTwoSeedKeys.has(key)) return true;
        seenRequiredTwoSeedKeys.add(key);
        return false;
      };
      const requiredTwoSeedReady = (): boolean =>
        requiredCount === 2 &&
        seedEntries.length >= metricPrimaryFastMaxSize &&
        seedThresholdPrimary >= 2;
      const evaluateSeed = () => {
        if (requiredTwoSeedSeenOrAdd()) return;
        const i = selected[0];
        const j = selected[1];
        const k = selected[2];
        const l = selected[3];
        const m = selected[4];
        seedCandidateChecks += 1;
        const score = scoreBasicDuoCandidate(i, j, k, l, m, -1, -1, -1, -1, -1);
        if (!score) return;
        seedValidCount += 1;
        addSeedEntry(score.primaryScore, score.secondaryScore);
      };
      const chooseSeed = (depth: number, orderStart: number, seedOrder: Int32Array, activeSeedCount: number) => {
        if (requiredTwoSeedReady()) return;
        if (depth === 5) {
          evaluateSeed();
          return;
        }
        const remaining = 5 - depth;
        for (let orderIndex = orderStart; orderIndex <= activeSeedCount - remaining; orderIndex++) {
          selected[depth] = seedOrder[orderIndex];
          chooseSeed(depth + 1, orderIndex + 1, seedOrder, activeSeedCount);
          if (requiredTwoSeedReady()) return;
        }
      };
      chooseSeed(requiredCount, 0, order, seedCount);
      if (requiredCount === 2 && !requiredTwoSeedReady()) {
        const duoConnectivity = new Int16Array(listLength);
        for (let sourceIndex = 0; sourceIndex < listLength; sourceIndex++) {
          if (fastUseM2[sourceIndex] === 0) continue;
          const sourceOffset = sourceIndex * listLength;
          for (let targetIndex = requiredCount; targetIndex < listLength; targetIndex++) {
            if (duoAllPairPresent[sourceOffset + targetIndex] !== 0) {
              duoConnectivity[targetIndex] += 1;
            }
            if (duoAllPairPresent[targetIndex * listLength + sourceIndex] !== 0) {
              duoConnectivity[targetIndex] += 1;
            }
          }
        }
        const duoOrder = new Int32Array(availableCount);
        for (let index = 0; index < availableCount; index++) duoOrder[index] = requiredCount + index;
        duoOrder.sort((a, b) => {
          const duoDiff = duoConnectivity[b] - duoConnectivity[a];
          if (duoDiff !== 0) return duoDiff;
          const secondaryDiff = secondaryUpperScores[b] - secondaryUpperScores[a];
          if (secondaryDiff !== 0) return secondaryDiff;
          return a - b;
        });
        chooseSeed(requiredCount, 0, duoOrder, seedCount);
      }

      if (seedEntries.length >= metricPrimaryFastMaxSize) {
        metricPrimarySeedThresholdPrimary = seedThresholdPrimary;
        metricPrimarySeedThresholdSecondary = seedThresholdSecondary;
        if (debugCounters) {
          debugCounters.basicDuoRequiredSeedCount = seedCount;
          debugCounters.basicDuoRequiredSeedCandidateChecks = seedCandidateChecks;
          debugCounters.basicDuoRequiredSeedValid = seedValidCount;
          debugCounters.basicDuoRequiredSeedThresholdPrimary = metricPrimarySeedThresholdPrimary;
          debugCounters.basicDuoRequiredSeedThresholdSecondary = metricPrimarySeedThresholdSecondary;
        }
      }
    };

    preseedRequiredBasicDuoThreshold();

    if (requiredCount === 2) {
      incrementDebugCounter(hasBasicDuoExactFilterThreshold
        ? 'basicDuoRequiredTwoExactFilterLoop'
        : 'basicDuoRequiredTwoNoFilterLoop');
      let searchCheckCounter = 0;
      const i = 0;
      const j = 1;
      const iBuddyMaskOffset = i * listLength;
      const jBuddyMaskOffset = j * listLength;
      const ijSecondaryUpper = secondaryUpperScores[i] + secondaryUpperScores[j];
      const iBranchDuoSuffixOffset = i * duoSuffixStride;
      const jBranchDuoSuffixOffset = j * duoSuffixStride;
      const ijIBranchDuoBase = duoPairPresent[iBuddyMaskOffset + i] | duoPairPresent[iBuddyMaskOffset + j];
      const ijJBranchDuoBase = duoPairPresent[jBuddyMaskOffset + i] | duoPairPresent[jBuddyMaskOffset + j];
      const ijDuoUpper =
        ((ijIBranchDuoBase | duoSuffixPresent[iBranchDuoSuffixOffset + j + 1]) !== 0 ? 1 : 0) +
        ((ijJBranchDuoBase | duoSuffixPresent[jBranchDuoSuffixOffset + j + 1]) !== 0 ? 1 : 0) +
        3;
      const ijReachableSecondaryUpper = ijSecondaryUpper + secondaryUpperSuffixTopSums[3][j + 1];
      if (basicDuoSecondaryMinimum > 0 && ijReachableSecondaryUpper < basicDuoSecondaryMinimum) {
        const skipped = combinationCount(lengthes[4] - j - 1, 3);
        incrementDebugCounter('basicDuoSecondaryMinimumBranchSkipJ', skipped);
        nowResultsCount += skipped;
        return true;
      }
      if (!metricPrimaryCouldBeat(ijDuoUpper, ijReachableSecondaryUpper)) {
        const skipped = combinationCount(lengthes[4] - j - 1, 3);
        incrementDebugCounter('basicDuoBranchSkipJ', skipped);
        nowResultsCount += skipped;
        return true;
      }
      for (let k = j + 1; k < lengthes[2]; k++) {
        const kBuddyMaskOffset = k * listLength;
        const ijkSecondaryUpper = ijSecondaryUpper + secondaryUpperScores[k];
        const kBranchDuoSuffixOffset = k * duoSuffixStride;
        const ijkIBranchDuoBase = ijIBranchDuoBase | duoPairPresent[iBuddyMaskOffset + k];
        const ijkJBranchDuoBase = ijJBranchDuoBase | duoPairPresent[jBuddyMaskOffset + k];
        const ijkKBranchDuoBase =
          duoPairPresent[kBuddyMaskOffset + i] |
          duoPairPresent[kBuddyMaskOffset + j] |
          duoPairPresent[kBuddyMaskOffset + k];
        const ijkDuoUpper =
          ((ijkIBranchDuoBase | duoSuffixPresent[iBranchDuoSuffixOffset + k + 1]) !== 0 ? 1 : 0) +
          ((ijkJBranchDuoBase | duoSuffixPresent[jBranchDuoSuffixOffset + k + 1]) !== 0 ? 1 : 0) +
          ((ijkKBranchDuoBase | duoSuffixPresent[kBranchDuoSuffixOffset + k + 1]) !== 0 ? 1 : 0) +
          2;
        const ijkReachableSecondaryUpper = ijkSecondaryUpper + secondaryUpperSuffixTopSums[2][k + 1];
        if (basicDuoSecondaryMinimum > 0 && ijkReachableSecondaryUpper < basicDuoSecondaryMinimum) {
          const skipped = combinationCount(lengthes[4] - k - 1, 2);
          incrementDebugCounter('basicDuoSecondaryMinimumBranchSkipK', skipped);
          nowResultsCount += skipped;
          continue;
        }
        if (!metricPrimaryCouldBeat(ijkDuoUpper, ijkReachableSecondaryUpper)) {
          const skipped = combinationCount(lengthes[4] - k - 1, 2);
          incrementDebugCounter('basicDuoBranchSkipK', skipped);
          nowResultsCount += skipped;
          continue;
        }
        for (let l = k + 1; l < lengthes[3]; l++) {
          searchCheckCounter += 1;
          if ((searchCheckCounter & SEARCH_CHECK_MASK) === 0 && !(await yieldToSearchUi())) return false;
          const mStart = l + 1;
          const remainingCount = lengthes[4] - mStart;
          if (remainingCount <= 0) continue;

          const lBuddyMaskOffset = l * listLength;
          const prefixSecondaryUpper = ijkSecondaryUpper + secondaryUpperScores[l];
          const iDuoSuffixOffset = i * duoSuffixStride;
          const jDuoSuffixOffset = j * duoSuffixStride;
          const kDuoSuffixOffset = k * duoSuffixStride;
          const lDuoSuffixOffset = l * duoSuffixStride;
          const iDuoBase =
            duoPairPresent[iBuddyMaskOffset + i] |
            duoPairPresent[iBuddyMaskOffset + j] |
            duoPairPresent[iBuddyMaskOffset + k] |
            duoPairPresent[iBuddyMaskOffset + l];
          const jDuoBase =
            duoPairPresent[jBuddyMaskOffset + i] |
            duoPairPresent[jBuddyMaskOffset + j] |
            duoPairPresent[jBuddyMaskOffset + k] |
            duoPairPresent[jBuddyMaskOffset + l];
          const kDuoBase =
            duoPairPresent[kBuddyMaskOffset + i] |
            duoPairPresent[kBuddyMaskOffset + j] |
            duoPairPresent[kBuddyMaskOffset + k] |
            duoPairPresent[kBuddyMaskOffset + l];
          const lDuoBase =
            duoPairPresent[lBuddyMaskOffset + i] |
            duoPairPresent[lBuddyMaskOffset + j] |
            duoPairPresent[lBuddyMaskOffset + k] |
            duoPairPresent[lBuddyMaskOffset + l];
          const prefixDuoUpper =
            ((iDuoBase | duoSuffixPresent[iDuoSuffixOffset + mStart]) !== 0 ? 1 : 0) +
            ((jDuoBase | duoSuffixPresent[jDuoSuffixOffset + mStart]) !== 0 ? 1 : 0) +
            ((kDuoBase | duoSuffixPresent[kDuoSuffixOffset + mStart]) !== 0 ? 1 : 0) +
            ((lDuoBase | duoSuffixPresent[lDuoSuffixOffset + mStart]) !== 0 ? 1 : 0) +
            1;
          const prefixReachableSecondaryUpper = prefixSecondaryUpper + secondaryUpperSuffixTopSums[1][mStart];
          if (basicDuoSecondaryMinimum > 0 && prefixReachableSecondaryUpper < basicDuoSecondaryMinimum) {
            incrementDebugCounter('basicDuoSecondaryMinimumPrefixSkip', remainingCount);
            nowResultsCount += remainingCount;
            continue;
          }
          if (!metricPrimaryCouldBeat(prefixDuoUpper, prefixReachableSecondaryUpper)) {
            incrementDebugCounter('basicDuoPrefixSkip', remainingCount);
            nowResultsCount += remainingCount;
            continue;
          }
          for (let m = mStart; m < lengthes[4]; m++) {
            const suffixDuoUpper =
              ((iDuoBase | duoSuffixPresent[iDuoSuffixOffset + m]) !== 0 ? 1 : 0) +
              ((jDuoBase | duoSuffixPresent[jDuoSuffixOffset + m]) !== 0 ? 1 : 0) +
              ((kDuoBase | duoSuffixPresent[kDuoSuffixOffset + m]) !== 0 ? 1 : 0) +
              ((lDuoBase | duoSuffixPresent[lDuoSuffixOffset + m]) !== 0 ? 1 : 0) +
              1;
            const suffixReachableSecondaryUpper = prefixSecondaryUpper + secondaryUpperSuffixTopSums[1][m];
            if (basicDuoSecondaryMinimum > 0 && suffixReachableSecondaryUpper < basicDuoSecondaryMinimum) {
              incrementDebugCounter('basicDuoSecondaryMinimumSuffixBreak', lengthes[4] - m);
              nowResultsCount += lengthes[4] - m;
              break;
            }
            if (!metricPrimaryCouldBeat(suffixDuoUpper, suffixReachableSecondaryUpper)) {
              incrementDebugCounter('basicDuoSuffixBreak', lengthes[4] - m);
              nowResultsCount += lengthes[4] - m;
              break;
            }

            const mBuddyMaskOffset = m * listLength;
            const mDuoBase =
              duoPairPresent[mBuddyMaskOffset + i] |
              duoPairPresent[mBuddyMaskOffset + j] |
              duoPairPresent[mBuddyMaskOffset + k] |
              duoPairPresent[mBuddyMaskOffset + l] |
              duoPairPresent[mBuddyMaskOffset + m];
            const candidateDuoUpper =
              ((iDuoBase | duoPairPresent[iBuddyMaskOffset + m]) !== 0 ? 1 : 0) +
              ((jDuoBase | duoPairPresent[jBuddyMaskOffset + m]) !== 0 ? 1 : 0) +
              ((kDuoBase | duoPairPresent[kBuddyMaskOffset + m]) !== 0 ? 1 : 0) +
              ((lDuoBase | duoPairPresent[lBuddyMaskOffset + m]) !== 0 ? 1 : 0) +
              (mDuoBase !== 0 ? 1 : 0);
            const candidateSecondaryUpper = prefixSecondaryUpper + secondaryUpperScores[m];
            if (basicDuoSecondaryMinimum > 0 && candidateSecondaryUpper < basicDuoSecondaryMinimum) {
              incrementDebugCounter('basicDuoSecondaryMinimumCardSkip');
              nowResultsCount += 1;
              continue;
            }
            if (!metricPrimaryCouldBeat(candidateDuoUpper, candidateSecondaryUpper)) {
              incrementDebugCounter('basicDuoCardSkip');
              nowResultsCount += 1;
              continue;
            }

            const seededCandidateKeys = requiredTwoSeededCandidateKeys as Set<number> | null;
            if (seededCandidateKeys !== null && seededCandidateKeys.has(packRequiredTwoCandidateKey(k, l, m))) {
              incrementDebugCounter('basicDuoRequiredTwoSeededSkip');
              nowResultsCount += 1;
              continue;
            }

            const score = scoreBasicDuoCandidate(i, j, k, l, m, -1, -1, -1, -1, -1);
            if (score) {
              incrementDebugCounter('basicDuoFastExactAdds');
              addMetricPrimaryFastEntry(score.primaryScore, score.secondaryScore, nonZero[score.i], nonZero[score.j], nonZero[score.k], nonZero[score.l], nonZero[score.m]);
            }
            incrementDebugCounter('basicDuoFastExactChecks');
            nowResultsCount += 1;
          }
        }
      }
      return true;
    }

    let searchCheckCounter = 0;
    for (let i = 0; i < lengthes[0]; i++) {
      const iBuddyMaskOffset = i * listLength;
      const iEvasion = evasionSuffixTopSums ? candidateEvasion[i] : 0;
      const iBuff = buffSuffixTopSums ? candidateBuff[i] : 0;
      const iDebuff = debuffSuffixTopSums ? candidateDebuff[i] : 0;
      const iCosmic = cosmicSuffixTopSums ? candidateCosmic[i] : 0;
      const iFire = fireSuffixTopSums ? candidateFire[i] : 0;
      const iWater = waterSuffixTopSums ? candidateWater[i] : 0;
      const iFlora = floraSuffixTopSums ? candidateFlora[i] : 0;
      const iHealCards = healNumSuffixTopSums ? candidateHealCards[i] : 0;
      const iReferenceUpper = referenceUpperScores ? referenceUpperScores[i] : 0;
      const iAdvantageUpper = advantageUpperScores ? advantageUpperScores[i] : 0;
      const iVsHiUpper = vsHiUpperScores ? vsHiUpperScores[i] : 0;
      const iVsMizuUpper = vsMizuUpperScores ? vsMizuUpperScores[i] : 0;
      const iVsKiUpper = vsKiUpperScores ? vsKiUpperScores[i] : 0;
      const iBranchDuoSuffixOffset = i * duoSuffixStride;
      const iBranchDuoBase = duoPairPresent[iBuddyMaskOffset + i];
      const iDuoUpper =
        ((iBranchDuoBase | duoSuffixPresent[iBranchDuoSuffixOffset + i + 1]) !== 0 ? 1 : 0) +
        4;
      const iReachableSecondaryUpper = secondaryUpperScores[i] + secondaryUpperSuffixTopSums[4][i + 1];
      if (basicDuoSecondaryMinimum > 0 && iReachableSecondaryUpper < basicDuoSecondaryMinimum) {
        const skipped = combinationCount(lengthes[4] - i - 1, 4);
        incrementDebugCounter('basicDuoSecondaryMinimumBranchSkipI', skipped);
        nowResultsCount += skipped;
        continue;
      }
      if (!metricPrimaryCouldBeat(iDuoUpper, iReachableSecondaryUpper)) {
        const skipped = combinationCount(lengthes[4] - i - 1, 4);
        incrementDebugCounter('basicDuoBranchSkipI', skipped);
        nowResultsCount += skipped;
        continue;
      }
      if (!branchCouldPassThresholds(
        iEvasion, iBuff, iDebuff, iCosmic, iFire, iWater, iFlora, iHealCards,
        iReferenceUpper, iAdvantageUpper, iVsHiUpper, iVsMizuUpper, iVsKiUpper,
        i + 1,
        4,
      )) {
        const skipped = combinationCount(lengthes[4] - i - 1, 4);
        incrementDebugCounter('basicDuoThresholdBranchSkip', skipped);
        nowResultsCount += skipped;
        continue;
      }

      for (let j = i + 1; j < lengthes[1]; j++) {
        const jBuddyMaskOffset = j * listLength;
        const ijEvasion = evasionSuffixTopSums ? iEvasion + candidateEvasion[j] : 0;
        const ijBuff = buffSuffixTopSums ? iBuff + candidateBuff[j] : 0;
        const ijDebuff = debuffSuffixTopSums ? iDebuff + candidateDebuff[j] : 0;
        const ijCosmic = cosmicSuffixTopSums ? iCosmic + candidateCosmic[j] : 0;
        const ijFire = fireSuffixTopSums ? iFire + candidateFire[j] : 0;
        const ijWater = waterSuffixTopSums ? iWater + candidateWater[j] : 0;
        const ijFlora = floraSuffixTopSums ? iFlora + candidateFlora[j] : 0;
        const ijHealCards = healNumSuffixTopSums ? iHealCards + candidateHealCards[j] : 0;
        const ijReferenceUpper = iReferenceUpper + (referenceUpperScores ? referenceUpperScores[j] : 0);
        const ijAdvantageUpper = iAdvantageUpper + (advantageUpperScores ? advantageUpperScores[j] : 0);
        const ijVsHiUpper = iVsHiUpper + (vsHiUpperScores ? vsHiUpperScores[j] : 0);
        const ijVsMizuUpper = iVsMizuUpper + (vsMizuUpperScores ? vsMizuUpperScores[j] : 0);
        const ijVsKiUpper = iVsKiUpper + (vsKiUpperScores ? vsKiUpperScores[j] : 0);
        const ijSecondaryUpper = secondaryUpperScores[i] + secondaryUpperScores[j];
        const jBranchDuoSuffixOffset = j * duoSuffixStride;
        const ijIBranchDuoBase = iBranchDuoBase | duoPairPresent[iBuddyMaskOffset + j];
        const ijJBranchDuoBase = duoPairPresent[jBuddyMaskOffset + i] | duoPairPresent[jBuddyMaskOffset + j];
        const ijDuoUpper =
          ((ijIBranchDuoBase | duoSuffixPresent[iBranchDuoSuffixOffset + j + 1]) !== 0 ? 1 : 0) +
          ((ijJBranchDuoBase | duoSuffixPresent[jBranchDuoSuffixOffset + j + 1]) !== 0 ? 1 : 0) +
          3;
        const ijReachableSecondaryUpper = ijSecondaryUpper + secondaryUpperSuffixTopSums[3][j + 1];
        if (basicDuoSecondaryMinimum > 0 && ijReachableSecondaryUpper < basicDuoSecondaryMinimum) {
          const skipped = combinationCount(lengthes[4] - j - 1, 3);
          incrementDebugCounter('basicDuoSecondaryMinimumBranchSkipJ', skipped);
          nowResultsCount += skipped;
          continue;
        }
        if (!metricPrimaryCouldBeat(ijDuoUpper, ijReachableSecondaryUpper)) {
          const skipped = combinationCount(lengthes[4] - j - 1, 3);
          incrementDebugCounter('basicDuoBranchSkipJ', skipped);
          nowResultsCount += skipped;
          continue;
        }
        if (!branchCouldPassThresholds(
          ijEvasion, ijBuff, ijDebuff, ijCosmic, ijFire, ijWater, ijFlora, ijHealCards,
          ijReferenceUpper, ijAdvantageUpper, ijVsHiUpper, ijVsMizuUpper, ijVsKiUpper,
          j + 1,
          3,
        )) {
          const skipped = combinationCount(lengthes[4] - j - 1, 3);
          incrementDebugCounter('basicDuoThresholdBranchSkip', skipped);
          nowResultsCount += skipped;
          continue;
        }

        for (let k = j + 1; k < lengthes[2]; k++) {
          const kBuddyMaskOffset = k * listLength;
          const ijkEvasion = evasionSuffixTopSums ? ijEvasion + candidateEvasion[k] : 0;
          const ijkBuff = buffSuffixTopSums ? ijBuff + candidateBuff[k] : 0;
          const ijkDebuff = debuffSuffixTopSums ? ijDebuff + candidateDebuff[k] : 0;
          const ijkCosmic = cosmicSuffixTopSums ? ijCosmic + candidateCosmic[k] : 0;
          const ijkFire = fireSuffixTopSums ? ijFire + candidateFire[k] : 0;
          const ijkWater = waterSuffixTopSums ? ijWater + candidateWater[k] : 0;
          const ijkFlora = floraSuffixTopSums ? ijFlora + candidateFlora[k] : 0;
          const ijkHealCards = healNumSuffixTopSums ? ijHealCards + candidateHealCards[k] : 0;
          const ijkReferenceUpper = ijReferenceUpper + (referenceUpperScores ? referenceUpperScores[k] : 0);
          const ijkAdvantageUpper = ijAdvantageUpper + (advantageUpperScores ? advantageUpperScores[k] : 0);
          const ijkVsHiUpper = ijVsHiUpper + (vsHiUpperScores ? vsHiUpperScores[k] : 0);
          const ijkVsMizuUpper = ijVsMizuUpper + (vsMizuUpperScores ? vsMizuUpperScores[k] : 0);
          const ijkVsKiUpper = ijVsKiUpper + (vsKiUpperScores ? vsKiUpperScores[k] : 0);
          const ijkSecondaryUpper = ijSecondaryUpper + secondaryUpperScores[k];
          const kBranchDuoSuffixOffset = k * duoSuffixStride;
          const ijkIBranchDuoBase = ijIBranchDuoBase | duoPairPresent[iBuddyMaskOffset + k];
          const ijkJBranchDuoBase = ijJBranchDuoBase | duoPairPresent[jBuddyMaskOffset + k];
          const ijkKBranchDuoBase =
            duoPairPresent[kBuddyMaskOffset + i] |
            duoPairPresent[kBuddyMaskOffset + j] |
            duoPairPresent[kBuddyMaskOffset + k];
          const ijkDuoUpper =
            ((ijkIBranchDuoBase | duoSuffixPresent[iBranchDuoSuffixOffset + k + 1]) !== 0 ? 1 : 0) +
            ((ijkJBranchDuoBase | duoSuffixPresent[jBranchDuoSuffixOffset + k + 1]) !== 0 ? 1 : 0) +
            ((ijkKBranchDuoBase | duoSuffixPresent[kBranchDuoSuffixOffset + k + 1]) !== 0 ? 1 : 0) +
            2;
          const ijkReachableSecondaryUpper = ijkSecondaryUpper + secondaryUpperSuffixTopSums[2][k + 1];
          if (basicDuoSecondaryMinimum > 0 && ijkReachableSecondaryUpper < basicDuoSecondaryMinimum) {
            const skipped = combinationCount(lengthes[4] - k - 1, 2);
            incrementDebugCounter('basicDuoSecondaryMinimumBranchSkipK', skipped);
            nowResultsCount += skipped;
            continue;
          }
          if (!metricPrimaryCouldBeat(ijkDuoUpper, ijkReachableSecondaryUpper)) {
            const skipped = combinationCount(lengthes[4] - k - 1, 2);
            incrementDebugCounter('basicDuoBranchSkipK', skipped);
            nowResultsCount += skipped;
            continue;
          }
          if (!branchCouldPassThresholds(
            ijkEvasion, ijkBuff, ijkDebuff, ijkCosmic, ijkFire, ijkWater, ijkFlora, ijkHealCards,
            ijkReferenceUpper, ijkAdvantageUpper, ijkVsHiUpper, ijkVsMizuUpper, ijkVsKiUpper,
            k + 1,
            2,
          )) {
            const skipped = combinationCount(lengthes[4] - k - 1, 2);
            incrementDebugCounter('basicDuoThresholdBranchSkip', skipped);
            nowResultsCount += skipped;
            continue;
          }

          for (let l = k + 1; l < lengthes[3]; l++) {
            searchCheckCounter += 1;
            if ((searchCheckCounter & SEARCH_CHECK_MASK) === 0 && !(await yieldToSearchUi())) return false;
            const mStart = l + 1;
            const remainingCount = lengthes[4] - mStart;
            if (remainingCount <= 0) continue;

            const lBuddyMaskOffset = l * listLength;
            const prefixEvasion = evasionSuffixTopSums ? ijkEvasion + candidateEvasion[l] : 0;
            const prefixBuff = buffSuffixTopSums ? ijkBuff + candidateBuff[l] : 0;
            const prefixDebuff = debuffSuffixTopSums ? ijkDebuff + candidateDebuff[l] : 0;
            const prefixCosmic = cosmicSuffixTopSums ? ijkCosmic + candidateCosmic[l] : 0;
            const prefixFire = fireSuffixTopSums ? ijkFire + candidateFire[l] : 0;
            const prefixWater = waterSuffixTopSums ? ijkWater + candidateWater[l] : 0;
            const prefixFlora = floraSuffixTopSums ? ijkFlora + candidateFlora[l] : 0;
            const prefixHealCards = healNumSuffixTopSums ? ijkHealCards + candidateHealCards[l] : 0;
            const prefixReferenceUpper = ijkReferenceUpper + (referenceUpperScores ? referenceUpperScores[l] : 0);
            const prefixAdvantageUpper = ijkAdvantageUpper + (advantageUpperScores ? advantageUpperScores[l] : 0);
            const prefixVsHiUpper = ijkVsHiUpper + (vsHiUpperScores ? vsHiUpperScores[l] : 0);
            const prefixVsMizuUpper = ijkVsMizuUpper + (vsMizuUpperScores ? vsMizuUpperScores[l] : 0);
            const prefixVsKiUpper = ijkVsKiUpper + (vsKiUpperScores ? vsKiUpperScores[l] : 0);
            const prefixSecondaryUpper =
              ijkSecondaryUpper +
              secondaryUpperScores[l];
            const iDuoSuffixOffset = i * duoSuffixStride;
            const jDuoSuffixOffset = j * duoSuffixStride;
            const kDuoSuffixOffset = k * duoSuffixStride;
            const lDuoSuffixOffset = l * duoSuffixStride;
            const iDuoBase =
              duoPairPresent[iBuddyMaskOffset + i] |
              duoPairPresent[iBuddyMaskOffset + j] |
              duoPairPresent[iBuddyMaskOffset + k] |
              duoPairPresent[iBuddyMaskOffset + l];
            const jDuoBase =
              duoPairPresent[jBuddyMaskOffset + i] |
              duoPairPresent[jBuddyMaskOffset + j] |
              duoPairPresent[jBuddyMaskOffset + k] |
              duoPairPresent[jBuddyMaskOffset + l];
            const kDuoBase =
              duoPairPresent[kBuddyMaskOffset + i] |
              duoPairPresent[kBuddyMaskOffset + j] |
              duoPairPresent[kBuddyMaskOffset + k] |
              duoPairPresent[kBuddyMaskOffset + l];
            const lDuoBase =
              duoPairPresent[lBuddyMaskOffset + i] |
              duoPairPresent[lBuddyMaskOffset + j] |
              duoPairPresent[lBuddyMaskOffset + k] |
              duoPairPresent[lBuddyMaskOffset + l];
            const prefixDuoUpper =
              ((iDuoBase | duoSuffixPresent[iDuoSuffixOffset + mStart]) !== 0 ? 1 : 0) +
              ((jDuoBase | duoSuffixPresent[jDuoSuffixOffset + mStart]) !== 0 ? 1 : 0) +
              ((kDuoBase | duoSuffixPresent[kDuoSuffixOffset + mStart]) !== 0 ? 1 : 0) +
              ((lDuoBase | duoSuffixPresent[lDuoSuffixOffset + mStart]) !== 0 ? 1 : 0) +
              1;
            const prefixReachableSecondaryUpper = prefixSecondaryUpper + secondaryUpperSuffixTopSums[1][mStart];
            if (basicDuoSecondaryMinimum > 0 && prefixReachableSecondaryUpper < basicDuoSecondaryMinimum) {
              incrementDebugCounter('basicDuoSecondaryMinimumPrefixSkip', remainingCount);
              nowResultsCount += remainingCount;
              continue;
            }
            if (!metricPrimaryCouldBeat(prefixDuoUpper, prefixReachableSecondaryUpper)) {
              incrementDebugCounter('basicDuoPrefixSkip', remainingCount);
              nowResultsCount += remainingCount;
              continue;
            }
            if (!branchCouldPassThresholds(
              prefixEvasion, prefixBuff, prefixDebuff, prefixCosmic, prefixFire, prefixWater, prefixFlora, prefixHealCards,
              prefixReferenceUpper, prefixAdvantageUpper, prefixVsHiUpper, prefixVsMizuUpper, prefixVsKiUpper,
              mStart,
              1,
            )) {
              incrementDebugCounter('basicDuoThresholdBranchSkip', remainingCount);
              nowResultsCount += remainingCount;
              continue;
            }

            for (let m = mStart; m < lengthes[4]; m++) {
              const suffixDuoUpper =
                ((iDuoBase | duoSuffixPresent[iDuoSuffixOffset + m]) !== 0 ? 1 : 0) +
                ((jDuoBase | duoSuffixPresent[jDuoSuffixOffset + m]) !== 0 ? 1 : 0) +
                ((kDuoBase | duoSuffixPresent[kDuoSuffixOffset + m]) !== 0 ? 1 : 0) +
                ((lDuoBase | duoSuffixPresent[lDuoSuffixOffset + m]) !== 0 ? 1 : 0) +
                1;
              const suffixReachableSecondaryUpper = prefixSecondaryUpper + secondaryUpperSuffixTopSums[1][m];
              if (basicDuoSecondaryMinimum > 0 && suffixReachableSecondaryUpper < basicDuoSecondaryMinimum) {
                incrementDebugCounter('basicDuoSecondaryMinimumSuffixBreak', lengthes[4] - m);
                nowResultsCount += lengthes[4] - m;
                break;
              }
              if (!metricPrimaryCouldBeat(suffixDuoUpper, suffixReachableSecondaryUpper)) {
                incrementDebugCounter('basicDuoSuffixBreak', lengthes[4] - m);
                nowResultsCount += lengthes[4] - m;
                break;
              }

              const candidateSecondaryUpper = prefixSecondaryUpper + secondaryUpperScores[m];
              if (basicDuoSecondaryMinimum > 0 && candidateSecondaryUpper < basicDuoSecondaryMinimum) {
                incrementDebugCounter('basicDuoSecondaryMinimumCardSkip');
                nowResultsCount += 1;
                continue;
              }
              if (!candidateCouldPassThresholds(
                prefixEvasion,
                prefixBuff,
                prefixDebuff,
                prefixCosmic,
                prefixFire,
                prefixWater,
                prefixFlora,
                prefixHealCards,
                prefixReferenceUpper,
                prefixAdvantageUpper,
                prefixVsHiUpper,
                prefixVsMizuUpper,
                prefixVsKiUpper,
                m,
              )) {
                incrementDebugCounter('basicDuoThresholdCardSkip');
                nowResultsCount += 1;
                continue;
              }

              const mBuddyMaskOffset = m * listLength;
              const mDuoBase =
                duoPairPresent[mBuddyMaskOffset + i] |
                duoPairPresent[mBuddyMaskOffset + j] |
                duoPairPresent[mBuddyMaskOffset + k] |
                duoPairPresent[mBuddyMaskOffset + l] |
                duoPairPresent[mBuddyMaskOffset + m];
              const candidateDuoUpper =
                ((iDuoBase | duoPairPresent[iBuddyMaskOffset + m]) !== 0 ? 1 : 0) +
                ((jDuoBase | duoPairPresent[jBuddyMaskOffset + m]) !== 0 ? 1 : 0) +
                ((kDuoBase | duoPairPresent[kBuddyMaskOffset + m]) !== 0 ? 1 : 0) +
                ((lDuoBase | duoPairPresent[lBuddyMaskOffset + m]) !== 0 ? 1 : 0) +
                (mDuoBase !== 0 ? 1 : 0);
              if (!metricPrimaryCouldBeat(candidateDuoUpper, candidateSecondaryUpper)) {
                incrementDebugCounter('basicDuoCardSkip');
                nowResultsCount += 1;
                continue;
              }

              const score = scoreBasicDuoCandidate(i, j, k, l, m, -1, -1, -1, -1, -1);
              if (score) {
                incrementDebugCounter('basicDuoFastExactAdds');
                addMetricPrimaryFastEntry(score.primaryScore, score.secondaryScore, nonZero[score.i], nonZero[score.j], nonZero[score.k], nonZero[score.l], nonZero[score.m]);
              }
              incrementDebugCounter('basicDuoFastExactChecks');
              nowResultsCount += 1;
            }
          }
        }
      }
    }
    return true;
  };

  const runNoSameMetricPrimaryFastLoop = async (lengthes: number[]): Promise<boolean> => {
    let searchCheckCounter = 0;
    for (let i = 0; i < lengthes[0]; i++) {
      const c0 = nonZero[i];
      const iBuddyMaskOffset = i * listLength;
      const iHpTable = fastHpTables![i];
      const iHealTable = fastHealTables![i];
      const iIncreasedTable = fastIncreasedTables![i];
      let iEvasion = 0;
      let iBuff = 0;
      let iDebuff = 0;
      let iCosmic = 0;
      let iFire = 0;
      let iWater = 0;
      let iFlora = 0;
      let iHealNum = 0;
      let iReferenceDamage = 0;
      let iAdvantageDamage = 0;
      let iVsHiDamage = 0;
      let iVsMizuDamage = 0;
      let iVsKiDamage = 0;
      if (hpThresholdBranchPruneEnabled) {
        iEvasion = hpThresholdEvasionScores ? hpThresholdEvasionScores[i] : 0;
        iBuff = hpThresholdBuffScores ? hpThresholdBuffScores[i] : 0;
        iDebuff = hpThresholdDebuffScores ? hpThresholdDebuffScores[i] : 0;
        iCosmic = hpThresholdCosmicScores ? hpThresholdCosmicScores[i] : 0;
        iFire = hpThresholdFireScores ? hpThresholdFireScores[i] : 0;
        iWater = hpThresholdWaterScores ? hpThresholdWaterScores[i] : 0;
        iFlora = hpThresholdFloraScores ? hpThresholdFloraScores[i] : 0;
        iHealNum = hpThresholdHealNumScores ? hpThresholdHealNumScores[i] : 0;
        iReferenceDamage = hpThresholdReferenceDamageScores ? hpThresholdReferenceDamageScores[i] : 0;
        iAdvantageDamage = hpThresholdAdvantageDamageScores ? hpThresholdAdvantageDamageScores[i] : 0;
        iVsHiDamage = hpThresholdVsHiDamageScores ? hpThresholdVsHiDamageScores[i] : 0;
        iVsMizuDamage = hpThresholdVsMizuDamageScores ? hpThresholdVsMizuDamageScores[i] : 0;
        iVsKiDamage = hpThresholdVsKiDamageScores ? hpThresholdVsKiDamageScores[i] : 0;
      }
      if (canUseFixedPrefixNoSameEarlyPrune) {
        if (usesHpPrimaryMetricFastLoop) {
          const branchUpper = hpPrimaryUpperScores![i] + hpPrimaryUpperSuffixTopSums![4][i + 1];
          if (!metricPrimaryShouldConsider(branchUpper)) {
            nowResultsCount += combinationCount(lengthes[4] - i - 1, 4);
            continue;
          }
          if (
            hpThresholdBranchPruneEnabled &&
            !hpThresholdBranchCouldPass(
              iEvasion, iBuff, iDebuff, iCosmic, iFire, iWater, iFlora, iHealNum,
              iReferenceDamage, iAdvantageDamage, iVsHiDamage, iVsMizuDamage, iVsKiDamage,
              i + 1,
              4,
            )
          ) {
            nowResultsCount += combinationCount(lengthes[4] - i - 1, 4);
            continue;
          }
        } else {
          const iBaseMask = fastPairBuddyMasks![iBuddyMaskOffset + i];
          const iReachableUpper = fastIncreasedReachableMasks
            ? getNoSameIncreasedReachableUpper(i, iBaseMask, i + 1, 4)
            : increasedHpPrimaryUpperScores![i];
          const branchUpper = Math.min(iReachableUpper, increasedHpPrimarySuffixKthLargest![4][i + 1]);
          const secondaryUpper = secondaryEhpUpperScores![i] + secondaryEhpUpperSuffixTopSums![4][i + 1];
          if (!metricPrimaryCouldBeat(branchUpper, secondaryUpper)) {
            incrementDebugCounter('increasedReachableBranchSkipI', combinationCount(lengthes[4] - i - 1, 4));
            nowResultsCount += combinationCount(lengthes[4] - i - 1, 4);
            continue;
          }
        }
      }
      for (let j = i + 1; j < lengthes[1]; j++) {
        const c1 = nonZero[j];
        const jBuddyMaskOffset = j * listLength;
        const jHpTable = fastHpTables![j];
        const jHealTable = fastHealTables![j];
        const jIncreasedTable = fastIncreasedTables![j];
        let ijEvasion = iEvasion;
        let ijBuff = iBuff;
        let ijDebuff = iDebuff;
        let ijCosmic = iCosmic;
        let ijFire = iFire;
        let ijWater = iWater;
        let ijFlora = iFlora;
        let ijHealNum = iHealNum;
        let ijReferenceDamage = iReferenceDamage;
        let ijAdvantageDamage = iAdvantageDamage;
        let ijVsHiDamage = iVsHiDamage;
        let ijVsMizuDamage = iVsMizuDamage;
        let ijVsKiDamage = iVsKiDamage;
        if (hpThresholdBranchPruneEnabled) {
          ijEvasion += hpThresholdEvasionScores ? hpThresholdEvasionScores[j] : 0;
          ijBuff += hpThresholdBuffScores ? hpThresholdBuffScores[j] : 0;
          ijDebuff += hpThresholdDebuffScores ? hpThresholdDebuffScores[j] : 0;
          ijCosmic += hpThresholdCosmicScores ? hpThresholdCosmicScores[j] : 0;
          ijFire += hpThresholdFireScores ? hpThresholdFireScores[j] : 0;
          ijWater += hpThresholdWaterScores ? hpThresholdWaterScores[j] : 0;
          ijFlora += hpThresholdFloraScores ? hpThresholdFloraScores[j] : 0;
          ijHealNum += hpThresholdHealNumScores ? hpThresholdHealNumScores[j] : 0;
          ijReferenceDamage += hpThresholdReferenceDamageScores ? hpThresholdReferenceDamageScores[j] : 0;
          ijAdvantageDamage += hpThresholdAdvantageDamageScores ? hpThresholdAdvantageDamageScores[j] : 0;
          ijVsHiDamage += hpThresholdVsHiDamageScores ? hpThresholdVsHiDamageScores[j] : 0;
          ijVsMizuDamage += hpThresholdVsMizuDamageScores ? hpThresholdVsMizuDamageScores[j] : 0;
          ijVsKiDamage += hpThresholdVsKiDamageScores ? hpThresholdVsKiDamageScores[j] : 0;
        }
        if (canUseFixedPrefixNoSameEarlyPrune) {
          if (usesHpPrimaryMetricFastLoop) {
            const branchUpper = hpPrimaryUpperScores![i] + hpPrimaryUpperScores![j] + hpPrimaryUpperSuffixTopSums![3][j + 1];
            if (!metricPrimaryShouldConsider(branchUpper)) {
              nowResultsCount += combinationCount(lengthes[4] - j - 1, 3);
              continue;
            }
            if (
              hpThresholdBranchPruneEnabled &&
              !hpThresholdBranchCouldPass(
                ijEvasion, ijBuff, ijDebuff, ijCosmic, ijFire, ijWater, ijFlora, ijHealNum,
                ijReferenceDamage, ijAdvantageDamage, ijVsHiDamage, ijVsMizuDamage, ijVsKiDamage,
                j + 1,
                3,
              )
            ) {
              nowResultsCount += combinationCount(lengthes[4] - j - 1, 3);
              continue;
            }
          } else {
            const iBaseMask =
              fastPairBuddyMasks![iBuddyMaskOffset + i] |
              fastPairBuddyMasks![iBuddyMaskOffset + j];
            const jBaseMask =
              fastPairBuddyMasks![jBuddyMaskOffset + i] |
              fastPairBuddyMasks![jBuddyMaskOffset + j];
            const iReachableUpper = fastIncreasedReachableMasks
              ? getNoSameIncreasedReachableUpper(i, iBaseMask, j + 1, 3)
              : increasedHpPrimaryUpperScores![i];
            const jReachableUpper = fastIncreasedReachableMasks
              ? getNoSameIncreasedReachableUpper(j, jBaseMask, j + 1, 3)
              : increasedHpPrimaryUpperScores![j];
            const branchUpper = Math.min(
              iReachableUpper,
              jReachableUpper,
              increasedHpPrimarySuffixKthLargest![3][j + 1]
            );
            const secondaryUpper =
              secondaryEhpUpperScores![i] +
              secondaryEhpUpperScores![j] +
              secondaryEhpUpperSuffixTopSums![3][j + 1];
            if (!metricPrimaryCouldBeat(branchUpper, secondaryUpper)) {
              incrementDebugCounter('increasedReachableBranchSkipJ', combinationCount(lengthes[4] - j - 1, 3));
              nowResultsCount += combinationCount(lengthes[4] - j - 1, 3);
              continue;
            }
          }
        }
        for (let k = j + 1; k < lengthes[2]; k++) {
          const c2 = nonZero[k];
          const kBuddyMaskOffset = k * listLength;
          const kHpTable = fastHpTables![k];
          const kHealTable = fastHealTables![k];
          const kIncreasedTable = fastIncreasedTables![k];
          let ijkEvasion = ijEvasion;
          let ijkBuff = ijBuff;
          let ijkDebuff = ijDebuff;
          let ijkCosmic = ijCosmic;
          let ijkFire = ijFire;
          let ijkWater = ijWater;
          let ijkFlora = ijFlora;
          let ijkHealNum = ijHealNum;
          let ijkReferenceDamage = ijReferenceDamage;
          let ijkAdvantageDamage = ijAdvantageDamage;
          let ijkVsHiDamage = ijVsHiDamage;
          let ijkVsMizuDamage = ijVsMizuDamage;
          let ijkVsKiDamage = ijVsKiDamage;
          if (hpThresholdBranchPruneEnabled) {
            ijkEvasion += hpThresholdEvasionScores ? hpThresholdEvasionScores[k] : 0;
            ijkBuff += hpThresholdBuffScores ? hpThresholdBuffScores[k] : 0;
            ijkDebuff += hpThresholdDebuffScores ? hpThresholdDebuffScores[k] : 0;
            ijkCosmic += hpThresholdCosmicScores ? hpThresholdCosmicScores[k] : 0;
            ijkFire += hpThresholdFireScores ? hpThresholdFireScores[k] : 0;
            ijkWater += hpThresholdWaterScores ? hpThresholdWaterScores[k] : 0;
            ijkFlora += hpThresholdFloraScores ? hpThresholdFloraScores[k] : 0;
            ijkHealNum += hpThresholdHealNumScores ? hpThresholdHealNumScores[k] : 0;
            ijkReferenceDamage += hpThresholdReferenceDamageScores ? hpThresholdReferenceDamageScores[k] : 0;
            ijkAdvantageDamage += hpThresholdAdvantageDamageScores ? hpThresholdAdvantageDamageScores[k] : 0;
            ijkVsHiDamage += hpThresholdVsHiDamageScores ? hpThresholdVsHiDamageScores[k] : 0;
            ijkVsMizuDamage += hpThresholdVsMizuDamageScores ? hpThresholdVsMizuDamageScores[k] : 0;
            ijkVsKiDamage += hpThresholdVsKiDamageScores ? hpThresholdVsKiDamageScores[k] : 0;
          }
          if (canUseFixedPrefixNoSameEarlyPrune) {
            if (usesHpPrimaryMetricFastLoop) {
              const branchUpper = hpPrimaryUpperScores![i] + hpPrimaryUpperScores![j] + hpPrimaryUpperScores![k] + hpPrimaryUpperSuffixTopSums![2][k + 1];
              if (!metricPrimaryShouldConsider(branchUpper)) {
                nowResultsCount += combinationCount(lengthes[4] - k - 1, 2);
                continue;
              }
              if (
                hpThresholdBranchPruneEnabled &&
                !hpThresholdBranchCouldPass(
                  ijkEvasion, ijkBuff, ijkDebuff, ijkCosmic, ijkFire, ijkWater, ijkFlora, ijkHealNum,
                  ijkReferenceDamage, ijkAdvantageDamage, ijkVsHiDamage, ijkVsMizuDamage, ijkVsKiDamage,
                  k + 1,
                  2,
                )
              ) {
                nowResultsCount += combinationCount(lengthes[4] - k - 1, 2);
                continue;
              }
            } else {
              const iBaseMask =
                fastPairBuddyMasks![iBuddyMaskOffset + i] |
                fastPairBuddyMasks![iBuddyMaskOffset + j] |
                fastPairBuddyMasks![iBuddyMaskOffset + k];
              const jBaseMask =
                fastPairBuddyMasks![jBuddyMaskOffset + i] |
                fastPairBuddyMasks![jBuddyMaskOffset + j] |
                fastPairBuddyMasks![jBuddyMaskOffset + k];
              const kBaseMask =
                fastPairBuddyMasks![kBuddyMaskOffset + i] |
                fastPairBuddyMasks![kBuddyMaskOffset + j] |
                fastPairBuddyMasks![kBuddyMaskOffset + k];
              const iReachableUpper = fastIncreasedReachableMasks
                ? getNoSameIncreasedReachableUpper(i, iBaseMask, k + 1, 2)
                : increasedHpPrimaryUpperScores![i];
              const jReachableUpper = fastIncreasedReachableMasks
                ? getNoSameIncreasedReachableUpper(j, jBaseMask, k + 1, 2)
                : increasedHpPrimaryUpperScores![j];
              const kReachableUpper = fastIncreasedReachableMasks
                ? getNoSameIncreasedReachableUpper(k, kBaseMask, k + 1, 2)
                : increasedHpPrimaryUpperScores![k];
              const branchUpper = Math.min(
                iReachableUpper,
                jReachableUpper,
                kReachableUpper,
                increasedHpPrimarySuffixKthLargest![2][k + 1]
              );
              const secondaryUpper =
                secondaryEhpUpperScores![i] +
                secondaryEhpUpperScores![j] +
                secondaryEhpUpperScores![k] +
                secondaryEhpUpperSuffixTopSums![2][k + 1];
              if (!metricPrimaryCouldBeat(branchUpper, secondaryUpper)) {
                incrementDebugCounter('increasedReachableBranchSkipK', combinationCount(lengthes[4] - k - 1, 2));
                nowResultsCount += combinationCount(lengthes[4] - k - 1, 2);
                continue;
              }
            }
          }
          for (let l = k + 1; l < lengthes[3]; l++) {
            searchCheckCounter += 1;
            if ((searchCheckCounter & SEARCH_CHECK_MASK) === 0 && !(await yieldToSearchUi())) return false;
            const mStart = l + 1;
            const remainingCount = lengthes[4] - mStart;
            if (remainingCount <= 0) continue;

            const c3 = nonZero[l];
            const lBuddyMaskOffset = l * listLength;
            const lHpTable = fastHpTables![l];
            const lHealTable = fastHealTables![l];
            const lIncreasedTable = fastIncreasedTables![l];
            let ijklEvasion = ijkEvasion;
            let ijklBuff = ijkBuff;
            let ijklDebuff = ijkDebuff;
            let ijklCosmic = ijkCosmic;
            let ijklFire = ijkFire;
            let ijklWater = ijkWater;
            let ijklFlora = ijkFlora;
            let ijklHealNum = ijkHealNum;
            let ijklReferenceDamage = ijkReferenceDamage;
            let ijklAdvantageDamage = ijkAdvantageDamage;
            let ijklVsHiDamage = ijkVsHiDamage;
            let ijklVsMizuDamage = ijkVsMizuDamage;
            let ijklVsKiDamage = ijkVsKiDamage;
            if (hpThresholdBranchPruneEnabled) {
              ijklEvasion += hpThresholdEvasionScores ? hpThresholdEvasionScores[l] : 0;
              ijklBuff += hpThresholdBuffScores ? hpThresholdBuffScores[l] : 0;
              ijklDebuff += hpThresholdDebuffScores ? hpThresholdDebuffScores[l] : 0;
              ijklCosmic += hpThresholdCosmicScores ? hpThresholdCosmicScores[l] : 0;
              ijklFire += hpThresholdFireScores ? hpThresholdFireScores[l] : 0;
              ijklWater += hpThresholdWaterScores ? hpThresholdWaterScores[l] : 0;
              ijklFlora += hpThresholdFloraScores ? hpThresholdFloraScores[l] : 0;
              ijklHealNum += hpThresholdHealNumScores ? hpThresholdHealNumScores[l] : 0;
              ijklReferenceDamage += hpThresholdReferenceDamageScores ? hpThresholdReferenceDamageScores[l] : 0;
              ijklAdvantageDamage += hpThresholdAdvantageDamageScores ? hpThresholdAdvantageDamageScores[l] : 0;
              ijklVsHiDamage += hpThresholdVsHiDamageScores ? hpThresholdVsHiDamageScores[l] : 0;
              ijklVsMizuDamage += hpThresholdVsMizuDamageScores ? hpThresholdVsMizuDamageScores[l] : 0;
              ijklVsKiDamage += hpThresholdVsKiDamageScores ? hpThresholdVsKiDamageScores[l] : 0;
            }

            let prefixUpper = 0;
            let prefixSecondaryUpper = 0;
            if (usesHpPrimaryMetricFastLoop) {
              prefixUpper =
                hpPrimaryUpperScores![i] +
                hpPrimaryUpperScores![j] +
                hpPrimaryUpperScores![k] +
                hpPrimaryUpperScores![l];
              if (!metricPrimaryShouldConsider(prefixUpper + hpPrimaryUpperSuffixMax![mStart])) {
                nowResultsCount += remainingCount;
                continue;
              }
              if (
                hpThresholdBranchPruneEnabled &&
                !hpThresholdBranchCouldPass(
                  ijklEvasion, ijklBuff, ijklDebuff, ijklCosmic, ijklFire, ijklWater, ijklFlora, ijklHealNum,
                  ijklReferenceDamage, ijklAdvantageDamage, ijklVsHiDamage, ijklVsMizuDamage, ijklVsKiDamage,
                  mStart,
                  1,
                )
              ) {
                nowResultsCount += remainingCount;
                continue;
              }
            } else {
              prefixUpper = increasedHpPrimaryUpperScores![i];
              const jUpper = increasedHpPrimaryUpperScores![j];
              if (jUpper < prefixUpper) prefixUpper = jUpper;
              const kUpper = increasedHpPrimaryUpperScores![k];
              if (kUpper < prefixUpper) prefixUpper = kUpper;
              const lUpper = increasedHpPrimaryUpperScores![l];
              if (lUpper < prefixUpper) prefixUpper = lUpper;
              const suffixUpperScore = prefixUpper < increasedHpPrimaryUpperSuffixMax![mStart]
                ? prefixUpper
                : increasedHpPrimaryUpperSuffixMax![mStart];
              prefixSecondaryUpper =
                secondaryEhpUpperScores![i] +
                secondaryEhpUpperScores![j] +
                secondaryEhpUpperScores![k] +
                secondaryEhpUpperScores![l];
              if (!metricPrimaryCouldBeat(suffixUpperScore, prefixSecondaryUpper + secondaryEhpUpperSuffixMax![mStart])) {
                nowResultsCount += remainingCount;
                continue;
              }
            }

            const iBaseMask =
              fastPairBuddyMasks![iBuddyMaskOffset + i] |
              fastPairBuddyMasks![iBuddyMaskOffset + j] |
              fastPairBuddyMasks![iBuddyMaskOffset + k] |
              fastPairBuddyMasks![iBuddyMaskOffset + l];
            const jBaseMask =
              fastPairBuddyMasks![jBuddyMaskOffset + i] |
              fastPairBuddyMasks![jBuddyMaskOffset + j] |
              fastPairBuddyMasks![jBuddyMaskOffset + k] |
              fastPairBuddyMasks![jBuddyMaskOffset + l];
            const kBaseMask =
              fastPairBuddyMasks![kBuddyMaskOffset + i] |
              fastPairBuddyMasks![kBuddyMaskOffset + j] |
              fastPairBuddyMasks![kBuddyMaskOffset + k] |
              fastPairBuddyMasks![kBuddyMaskOffset + l];
            const lBaseMask =
              fastPairBuddyMasks![lBuddyMaskOffset + i] |
              fastPairBuddyMasks![lBuddyMaskOffset + j] |
              fastPairBuddyMasks![lBuddyMaskOffset + k] |
              fastPairBuddyMasks![lBuddyMaskOffset + l];
            if (canUseHpPrimaryReachablePrune) {
              const reachablePrefixUpper =
                fastHpPrimarySuffixBestByBase![((i << 3) + iBaseMask) * fastHpPrimarySuffixSpan + mStart] +
                fastHpPrimarySuffixBestByBase![((j << 3) + jBaseMask) * fastHpPrimarySuffixSpan + mStart] +
                fastHpPrimarySuffixBestByBase![((k << 3) + kBaseMask) * fastHpPrimarySuffixSpan + mStart] +
                fastHpPrimarySuffixBestByBase![((l << 3) + lBaseMask) * fastHpPrimarySuffixSpan + mStart] +
                hpPrimaryUpperSuffixMax![mStart];
              if (!metricPrimaryShouldConsider(reachablePrefixUpper)) {
                nowResultsCount += remainingCount;
                continue;
              }
            }
            if (canUseIncreasedHpBuddyPrimaryFastPath) {
              let suffixUpperScore = prefixUpper < increasedHpPrimaryUpperSuffixMax![mStart]
                ? prefixUpper
                : increasedHpPrimaryUpperSuffixMax![mStart];
              if (fastIncreasedReachableMasks) {
                suffixUpperScore = getNoSameIncreasedReachableUpper(i, iBaseMask, mStart, 1);
                const jReachableUpper = getNoSameIncreasedReachableUpper(j, jBaseMask, mStart, 1);
                if (jReachableUpper < suffixUpperScore) suffixUpperScore = jReachableUpper;
                const kReachableUpper = getNoSameIncreasedReachableUpper(k, kBaseMask, mStart, 1);
                if (kReachableUpper < suffixUpperScore) suffixUpperScore = kReachableUpper;
                const lReachableUpper = getNoSameIncreasedReachableUpper(l, lBaseMask, mStart, 1);
                if (lReachableUpper < suffixUpperScore) suffixUpperScore = lReachableUpper;
                const supportUpper = increasedHpPrimaryUpperSuffixMax![mStart];
                if (supportUpper < suffixUpperScore) suffixUpperScore = supportUpper;
              }
              if (!metricPrimaryCouldBeat(suffixUpperScore, prefixSecondaryUpper + secondaryEhpUpperSuffixMax![mStart])) {
                incrementDebugCounter('increasedReachablePrefixSkip', remainingCount);
                nowResultsCount += remainingCount;
                continue;
              }
            }
            const requiredMEvasion = snapshot.minEvasion > ijklEvasion ? Math.ceil(snapshot.minEvasion - ijklEvasion) : 0;
            const requiredMBuff = snapshot.minBuff > ijklBuff ? Math.ceil(snapshot.minBuff - ijklBuff) : 0;
            const requiredMDebuff = snapshot.minDebuff > ijklDebuff ? Math.ceil(snapshot.minDebuff - ijklDebuff) : 0;
            const requiredMCosmic = snapshot.minCosmic > ijklCosmic ? Math.ceil(snapshot.minCosmic - ijklCosmic) : 0;
            const requiredMFire = snapshot.minFire > ijklFire ? Math.ceil(snapshot.minFire - ijklFire) : 0;
            const requiredMWater = snapshot.minWater > ijklWater ? Math.ceil(snapshot.minWater - ijklWater) : 0;
            const requiredMFlora = snapshot.minFlora > ijklFlora ? Math.ceil(snapshot.minFlora - ijklFlora) : 0;
            const requiredMHealNum = snapshot.minHealNum > ijklHealNum ? Math.ceil(snapshot.minHealNum - ijklHealNum) : 0;
            for (let m = mStart; m < lengthes[4]; m++) {
              if (usesHpPrimaryMetricFastLoop && hpThresholdSingleCandidateJumpEnabled) {
                let nextM = m;
                while (nextM < lengthes[4]) {
                  const before = nextM;
                  if (requiredMEvasion > 0 && hpThresholdEvasionNextAtLeast) nextM = hpThresholdEvasionNextAtLeast[requiredMEvasion][nextM];
                  if (requiredMBuff > 0 && hpThresholdBuffNextAtLeast) nextM = hpThresholdBuffNextAtLeast[requiredMBuff][nextM];
                  if (requiredMDebuff > 0 && hpThresholdDebuffNextAtLeast) nextM = hpThresholdDebuffNextAtLeast[requiredMDebuff][nextM];
                  if (requiredMCosmic > 0 && hpThresholdCosmicNextAtLeast) nextM = hpThresholdCosmicNextAtLeast[requiredMCosmic][nextM];
                  if (requiredMFire > 0 && hpThresholdFireNextAtLeast) nextM = hpThresholdFireNextAtLeast[requiredMFire][nextM];
                  if (requiredMWater > 0 && hpThresholdWaterNextAtLeast) nextM = hpThresholdWaterNextAtLeast[requiredMWater][nextM];
                  if (requiredMFlora > 0 && hpThresholdFloraNextAtLeast) nextM = hpThresholdFloraNextAtLeast[requiredMFlora][nextM];
                  if (requiredMHealNum > 0 && hpThresholdHealNumNextAtLeast) nextM = hpThresholdHealNumNextAtLeast[requiredMHealNum][nextM];
                  if (nextM === before) break;
                }
                if (nextM !== m) {
                  incrementDebugCounter('thresholdSingleJumpSkip', nextM - m);
                  nowResultsCount += nextM - m;
                  if (nextM >= lengthes[4]) break;
                  m = nextM;
                }
              }
              if (usesHpPrimaryMetricFastLoop) {
                if (!metricPrimaryShouldConsider(prefixUpper + hpPrimaryUpperSuffixMax![m])) {
                  incrementDebugCounter('metricSuffixBreak', lengthes[4] - m);
                  nowResultsCount += lengthes[4] - m;
                  break;
                }
                if (!metricPrimaryShouldConsider(prefixUpper + hpPrimaryUpperScores![m])) {
                  incrementDebugCounter('metricCardSkip');
                  nowResultsCount += 1;
                  continue;
                }
                if (
                  hpThresholdBranchPruneEnabled &&
                  !hpThresholdBranchCouldPass(
                    ijklEvasion + (hpThresholdEvasionScores ? hpThresholdEvasionScores[m] : 0),
                    ijklBuff + (hpThresholdBuffScores ? hpThresholdBuffScores[m] : 0),
                    ijklDebuff + (hpThresholdDebuffScores ? hpThresholdDebuffScores[m] : 0),
                    ijklCosmic + (hpThresholdCosmicScores ? hpThresholdCosmicScores[m] : 0),
                    ijklFire + (hpThresholdFireScores ? hpThresholdFireScores[m] : 0),
                    ijklWater + (hpThresholdWaterScores ? hpThresholdWaterScores[m] : 0),
                    ijklFlora + (hpThresholdFloraScores ? hpThresholdFloraScores[m] : 0),
                    ijklHealNum + (hpThresholdHealNumScores ? hpThresholdHealNumScores[m] : 0),
                    ijklReferenceDamage + (hpThresholdReferenceDamageScores ? hpThresholdReferenceDamageScores[m] : 0),
                    ijklAdvantageDamage + (hpThresholdAdvantageDamageScores ? hpThresholdAdvantageDamageScores[m] : 0),
                    ijklVsHiDamage + (hpThresholdVsHiDamageScores ? hpThresholdVsHiDamageScores[m] : 0),
                    ijklVsMizuDamage + (hpThresholdVsMizuDamageScores ? hpThresholdVsMizuDamageScores[m] : 0),
                    ijklVsKiDamage + (hpThresholdVsKiDamageScores ? hpThresholdVsKiDamageScores[m] : 0),
                    m + 1,
                    0,
                  )
                ) {
                  incrementDebugCounter('thresholdBranchSkip');
                  nowResultsCount += 1;
                  continue;
                }
              } else {
                let suffixUpperScore = prefixUpper < increasedHpPrimaryUpperSuffixMax![m]
                  ? prefixUpper
                  : increasedHpPrimaryUpperSuffixMax![m];
                if (fastIncreasedReachableMasks) {
                  suffixUpperScore = getNoSameIncreasedReachableUpper(i, iBaseMask, m, 1);
                  const jReachableUpper = getNoSameIncreasedReachableUpper(j, jBaseMask, m, 1);
                  if (jReachableUpper < suffixUpperScore) suffixUpperScore = jReachableUpper;
                  const kReachableUpper = getNoSameIncreasedReachableUpper(k, kBaseMask, m, 1);
                  if (kReachableUpper < suffixUpperScore) suffixUpperScore = kReachableUpper;
                  const lReachableUpper = getNoSameIncreasedReachableUpper(l, lBaseMask, m, 1);
                  if (lReachableUpper < suffixUpperScore) suffixUpperScore = lReachableUpper;
                  const supportUpper = increasedHpPrimaryUpperSuffixMax![m];
                  if (supportUpper < suffixUpperScore) suffixUpperScore = supportUpper;
                }
                if (!metricPrimaryCouldBeat(suffixUpperScore, prefixSecondaryUpper + secondaryEhpUpperSuffixMax![m])) {
                  incrementDebugCounter('increasedReachableSuffixBreak', lengthes[4] - m);
                  nowResultsCount += lengthes[4] - m;
                  break;
                }
                const cardUpper = increasedHpPrimaryUpperScores![m];
                const upperScore = prefixUpper < cardUpper ? prefixUpper : cardUpper;
                if (!metricPrimaryCouldBeat(upperScore, prefixSecondaryUpper + secondaryEhpUpperScores![m])) {
                  nowResultsCount += 1;
                  continue;
                }
              }

              const c4 = nonZero[m];
              const mBuddyMaskOffset = m * listLength;
              const iMask = iBaseMask | fastPairBuddyMasks![iBuddyMaskOffset + m];
              const jMask = jBaseMask | fastPairBuddyMasks![jBuddyMaskOffset + m];
              const kMask = kBaseMask | fastPairBuddyMasks![kBuddyMaskOffset + m];
              const lMask = lBaseMask | fastPairBuddyMasks![lBuddyMaskOffset + m];
              let normalPrimaryUpper = 0;
              if (canUseIncreasedHpBuddyPrimaryFastPath) {
                normalPrimaryUpper = iIncreasedTable[iMask];
                const jPrimaryUpper = jIncreasedTable[jMask];
                if (jPrimaryUpper < normalPrimaryUpper) normalPrimaryUpper = jPrimaryUpper;
                const kPrimaryUpper = kIncreasedTable[kMask];
                if (kPrimaryUpper < normalPrimaryUpper) normalPrimaryUpper = kPrimaryUpper;
                const lPrimaryUpper = lIncreasedTable[lMask];
                if (lPrimaryUpper < normalPrimaryUpper) normalPrimaryUpper = lPrimaryUpper;
                const upperScore = normalPrimaryUpper < increasedHpPrimaryUpperScores![m]
                  ? normalPrimaryUpper
                  : increasedHpPrimaryUpperScores![m];
                if (!metricPrimaryCouldBeat(upperScore, prefixSecondaryUpper + secondaryEhpUpperScores![m])) {
                  incrementDebugCounter('increasedReachableCardSkip');
                  nowResultsCount += 1;
                  continue;
                }
              }
              if (canUseHpPrimaryReachablePrune) {
                const reachableScore =
                  fastHpPrimaryScoreTables![i][iMask] +
                  fastHpPrimaryScoreTables![j][jMask] +
                  fastHpPrimaryScoreTables![k][kMask] +
                  fastHpPrimaryScoreTables![l][lMask] +
                  hpPrimaryUpperScores![m];
                if (!metricPrimaryShouldConsider(reachableScore)) {
                  nowResultsCount += 1;
                  continue;
                }
              }
              const mMask =
                fastPairBuddyMasks![mBuddyMaskOffset + i] |
                fastPairBuddyMasks![mBuddyMaskOffset + j] |
                fastPairBuddyMasks![mBuddyMaskOffset + k] |
                fastPairBuddyMasks![mBuddyMaskOffset + l] |
                fastPairBuddyMasks![mBuddyMaskOffset + m];

              let primaryScore = 0;
              if (canUseIncreasedHpBuddyPrimaryFastPath) {
                let increasedHpBuddy = normalPrimaryUpper;
                const mIncreasedHp = fastIncreasedTables![m][mMask];
                if (mIncreasedHp < increasedHpBuddy) increasedHpBuddy = mIncreasedHp;
                primaryScore = Math.floor(increasedHpBuddy);
                if (
                  primaryScore < snapshot.minIncreasedHPBuddy ||
                  !metricPrimaryCouldBeat(primaryScore, prefixSecondaryUpper + secondaryEhpUpperScores![m])
                ) {
                  nowResultsCount += 1;
                  continue;
                }
              }

              const mHpTable = fastHpTables![m];
              const hp =
                iHpTable[iMask] +
                jHpTable[jMask] +
                kHpTable[kMask] +
                lHpTable[lMask] +
                mHpTable[mMask];
              if (hp < snapshot.minHP) {
                incrementDebugCounter('hpSkip');
                nowResultsCount += 1;
                continue;
              }
              const mHealTable = fastHealTables![m];
              const ehp =
                hp +
                iHealTable[iMask] +
                jHealTable[jMask] +
                kHealTable[kMask] +
                lHealTable[lMask] +
                mHealTable[mMask];
              if (ehp < snapshot.minEHP) {
                incrementDebugCounter('ehpSkip');
                nowResultsCount += 1;
                continue;
              }

              if (usesHpPrimaryMetricFastLoop) {
                primaryScore = hpPrimaryUsesEhp ? ehp : hp;
                if (canUseHpPrimaryThresholdFastPath) {
                  incrementDebugCounter('thresholdExactCheck');
                  let thresholdsPass = false;
                  if (metricPrimaryShouldConsider(primaryScore)) {
                    if (hpThresholdBranchPruneEnabled && canUseFastHpDamageThresholdExact) {
                      thresholdsPass = hpDamageThresholdsPassFastWithMasks(
                        i,
                        j,
                        k,
                        l,
                        m,
                        iMask,
                        jMask,
                        kMask,
                        lMask,
                        mMask,
                      );
                    } else if (hpThresholdBranchPruneEnabled && !hasDamageThreshold) {
                      thresholdsPass = true;
                    } else {
                      thresholdsPass = hpPrimaryThresholdsPass(c0, c1, c2, c3, c4);
                    }
                  }
                  if (!thresholdsPass) {
                    incrementDebugCounter('thresholdExactSkip');
                    nowResultsCount += 1;
                    continue;
                  }
                }
              }
              addMetricPrimaryFastDeck(primaryScore, ehp, c0, c1, c2, c3, c4);
              nowResultsCount += 1;
            }
          }
        }
      }
    }
    return true;
  };

  const runNoSameIncreasedHpBuddyFastLoop = async (lengthes: number[]): Promise<boolean> => {
    const pairMasks = fastPairBuddyMasks!;
    const hpTables = fastHpTables!;
    const healTables = fastHealTables!;
    const increasedTables = fastIncreasedTables!;
    const upperScores = increasedHpPrimaryUpperScores!;
    const suffixMax = increasedHpPrimaryUpperSuffixMax!;
    const suffixKthLargest = increasedHpPrimarySuffixKthLargest!;
    const minIncreasedHpBuddy = snapshot.minIncreasedHPBuddy;
    const minHP = snapshot.minHP;
    const minEHP = snapshot.minEHP;
    const secondaryScores = secondaryEhpUpperScores;
    const secondaryTopSums = secondaryEhpUpperSuffixTopSums;
    const secondarySuffixMax = secondaryEhpUpperSuffixMax;
    const useSecondaryPrune =
      metricPrimaryFastHasSecondary &&
      secondaryScores !== null &&
      secondaryTopSums !== null &&
      secondarySuffixMax !== null;
    const increasedCouldBeat = (primaryUpper: number, secondaryUpper: number): boolean => {
      const flooredPrimaryUpper = Math.floor(primaryUpper);
      return useSecondaryPrune
        ? metricPrimaryCouldBeat(flooredPrimaryUpper, secondaryUpper)
        : metricPrimaryShouldConsider(flooredPrimaryUpper);
    };
    let searchCheckCounter = 0;

    for (let i = 0; i < lengthes[0]; i++) {
      const c0 = nonZero[i];
      const iBuddyMaskOffset = i * listLength;
      const iHpTable = hpTables[i];
      const iHealTable = healTables[i];
      const iIncreasedTable = increasedTables[i];
      const iSelfMask = pairMasks[iBuddyMaskOffset + i];
      const iReachableUpper = getNoSameIncreasedReachableUpper(i, iSelfMask, i + 1, 4);
      const iBranchUpper = Math.min(iReachableUpper, suffixKthLargest[4][i + 1]);
      const iSecondaryUpper = useSecondaryPrune
        ? secondaryScores![i] + secondaryTopSums![4][i + 1]
        : 0;
      if (!increasedCouldBeat(iBranchUpper, iSecondaryUpper)) {
        const skipped = combinationCount(lengthes[4] - i - 1, 4);
        incrementDebugCounter('increasedReachableBranchSkipI', skipped);
        nowResultsCount += skipped;
        continue;
      }

      for (let j = i + 1; j < lengthes[1]; j++) {
        const c1 = nonZero[j];
        const jBuddyMaskOffset = j * listLength;
        const jHpTable = hpTables[j];
        const jHealTable = healTables[j];
        const jIncreasedTable = increasedTables[j];
        const iBaseIJ = iSelfMask | pairMasks[iBuddyMaskOffset + j];
        const jBaseIJ = pairMasks[jBuddyMaskOffset + i] | pairMasks[jBuddyMaskOffset + j];
        const iReachableUpperJ = getNoSameIncreasedReachableUpper(i, iBaseIJ, j + 1, 3);
        const jReachableUpper = getNoSameIncreasedReachableUpper(j, jBaseIJ, j + 1, 3);
        const jBranchUpper = Math.min(
          iReachableUpperJ,
          jReachableUpper,
          suffixKthLargest[3][j + 1],
        );
        const ijSecondaryUpper = useSecondaryPrune
          ? secondaryScores![i] + secondaryScores![j] + secondaryTopSums![3][j + 1]
          : 0;
        if (!increasedCouldBeat(jBranchUpper, ijSecondaryUpper)) {
          const skipped = combinationCount(lengthes[4] - j - 1, 3);
          incrementDebugCounter('increasedReachableBranchSkipJ', skipped);
          nowResultsCount += skipped;
          continue;
        }

        for (let k = j + 1; k < lengthes[2]; k++) {
          const c2 = nonZero[k];
          const kBuddyMaskOffset = k * listLength;
          const kHpTable = hpTables[k];
          const kHealTable = healTables[k];
          const kIncreasedTable = increasedTables[k];
          const iBaseIJK = iBaseIJ | pairMasks[iBuddyMaskOffset + k];
          const jBaseIJK = jBaseIJ | pairMasks[jBuddyMaskOffset + k];
          const kBaseIJK =
            pairMasks[kBuddyMaskOffset + i] |
            pairMasks[kBuddyMaskOffset + j] |
            pairMasks[kBuddyMaskOffset + k];
          const iReachableUpperK = getNoSameIncreasedReachableUpper(i, iBaseIJK, k + 1, 2);
          const jReachableUpperK = getNoSameIncreasedReachableUpper(j, jBaseIJK, k + 1, 2);
          const kReachableUpper = getNoSameIncreasedReachableUpper(k, kBaseIJK, k + 1, 2);
          const kBranchUpper = Math.min(
            iReachableUpperK,
            jReachableUpperK,
            kReachableUpper,
            suffixKthLargest[2][k + 1],
          );
          const ijkSecondaryUpper = useSecondaryPrune
            ? secondaryScores![i] + secondaryScores![j] + secondaryScores![k] + secondaryTopSums![2][k + 1]
            : 0;
          if (!increasedCouldBeat(kBranchUpper, ijkSecondaryUpper)) {
            const skipped = combinationCount(lengthes[4] - k - 1, 2);
            incrementDebugCounter('increasedReachableBranchSkipK', skipped);
            nowResultsCount += skipped;
            continue;
          }

          for (let l = k + 1; l < lengthes[3]; l++) {
            searchCheckCounter += 1;
            if ((searchCheckCounter & SEARCH_CHECK_MASK) === 0 && !(await yieldToSearchUi())) return false;

            const mStart = l + 1;
            const remainingCount = lengthes[4] - mStart;
            if (remainingCount <= 0) continue;

            const c3 = nonZero[l];
            const lBuddyMaskOffset = l * listLength;
            const lHpTable = hpTables[l];
            const lHealTable = healTables[l];
            const lIncreasedTable = increasedTables[l];
            const iBaseMask = iBaseIJK | pairMasks[iBuddyMaskOffset + l];
            const jBaseMask = jBaseIJK | pairMasks[jBuddyMaskOffset + l];
            const kBaseMask = kBaseIJK | pairMasks[kBuddyMaskOffset + l];
            const lBaseMask =
              pairMasks[lBuddyMaskOffset + i] |
              pairMasks[lBuddyMaskOffset + j] |
              pairMasks[lBuddyMaskOffset + k] |
              pairMasks[lBuddyMaskOffset + l];

            let prefixUpper = upperScores[i];
            const jUpper = upperScores[j];
            if (jUpper < prefixUpper) prefixUpper = jUpper;
            const kUpper = upperScores[k];
            if (kUpper < prefixUpper) prefixUpper = kUpper;
            const lUpper = upperScores[l];
            if (lUpper < prefixUpper) prefixUpper = lUpper;

            let suffixUpperScore = getNoSameIncreasedReachableUpper(i, iBaseMask, mStart, 1);
            const jReachableUpperL = getNoSameIncreasedReachableUpper(j, jBaseMask, mStart, 1);
            if (jReachableUpperL < suffixUpperScore) suffixUpperScore = jReachableUpperL;
            const kReachableUpperL = getNoSameIncreasedReachableUpper(k, kBaseMask, mStart, 1);
            if (kReachableUpperL < suffixUpperScore) suffixUpperScore = kReachableUpperL;
            const lReachableUpper = getNoSameIncreasedReachableUpper(l, lBaseMask, mStart, 1);
            if (lReachableUpper < suffixUpperScore) suffixUpperScore = lReachableUpper;
            const supportUpper = suffixMax[mStart];
            if (supportUpper < suffixUpperScore) suffixUpperScore = supportUpper;
            const prefixSecondaryUpper = useSecondaryPrune
              ? secondaryScores![i] + secondaryScores![j] + secondaryScores![k] + secondaryScores![l]
              : 0;
            if (!increasedCouldBeat(
              suffixUpperScore,
              useSecondaryPrune ? prefixSecondaryUpper + secondarySuffixMax![mStart] : 0,
            )) {
              incrementDebugCounter('increasedReachablePrefixSkip', remainingCount);
              nowResultsCount += remainingCount;
              continue;
            }

            for (let m = mStart; m < lengthes[4]; m++) {
              let mSuffixUpperScore = getNoSameIncreasedReachableUpper(i, iBaseMask, m, 1);
              const jReachableUpperM = getNoSameIncreasedReachableUpper(j, jBaseMask, m, 1);
              if (jReachableUpperM < mSuffixUpperScore) mSuffixUpperScore = jReachableUpperM;
              const kReachableUpperM = getNoSameIncreasedReachableUpper(k, kBaseMask, m, 1);
              if (kReachableUpperM < mSuffixUpperScore) mSuffixUpperScore = kReachableUpperM;
              const lReachableUpperM = getNoSameIncreasedReachableUpper(l, lBaseMask, m, 1);
              if (lReachableUpperM < mSuffixUpperScore) mSuffixUpperScore = lReachableUpperM;
              const mSupportUpper = suffixMax[m];
              if (mSupportUpper < mSuffixUpperScore) mSuffixUpperScore = mSupportUpper;
              const mSecondaryUpper = useSecondaryPrune
                ? prefixSecondaryUpper + secondarySuffixMax![m]
                : 0;
              if (!increasedCouldBeat(mSuffixUpperScore, mSecondaryUpper)) {
                incrementDebugCounter('increasedReachableSuffixBreak', lengthes[4] - m);
                nowResultsCount += lengthes[4] - m;
                break;
              }

              const cardUpper = upperScores[m];
              const upperScore = prefixUpper < cardUpper ? prefixUpper : cardUpper;
              const exactSecondaryUpper = useSecondaryPrune
                ? prefixSecondaryUpper + secondaryScores![m]
                : 0;
              if (!increasedCouldBeat(upperScore, exactSecondaryUpper)) {
                nowResultsCount += 1;
                continue;
              }

              const c4 = nonZero[m];
              const mBuddyMaskOffset = m * listLength;
              const iMask = iBaseMask | pairMasks[iBuddyMaskOffset + m];
              const jMask = jBaseMask | pairMasks[jBuddyMaskOffset + m];
              const kMask = kBaseMask | pairMasks[kBuddyMaskOffset + m];
              const lMask = lBaseMask | pairMasks[lBuddyMaskOffset + m];
              let normalPrimaryUpper = iIncreasedTable[iMask];
              const jPrimaryUpper = jIncreasedTable[jMask];
              if (jPrimaryUpper < normalPrimaryUpper) normalPrimaryUpper = jPrimaryUpper;
              const kPrimaryUpper = kIncreasedTable[kMask];
              if (kPrimaryUpper < normalPrimaryUpper) normalPrimaryUpper = kPrimaryUpper;
              const lPrimaryUpper = lIncreasedTable[lMask];
              if (lPrimaryUpper < normalPrimaryUpper) normalPrimaryUpper = lPrimaryUpper;
              const exactUpperScore = normalPrimaryUpper < cardUpper ? normalPrimaryUpper : cardUpper;
              if (!metricPrimaryShouldConsider(exactUpperScore)) {
                incrementDebugCounter('increasedReachableCardSkip');
                nowResultsCount += 1;
                continue;
              }

              const mMask =
                pairMasks[mBuddyMaskOffset + i] |
                pairMasks[mBuddyMaskOffset + j] |
                pairMasks[mBuddyMaskOffset + k] |
                pairMasks[mBuddyMaskOffset + l] |
                pairMasks[mBuddyMaskOffset + m];
              let increasedHpBuddy = normalPrimaryUpper;
              const mIncreasedHp = increasedTables[m][mMask];
              if (mIncreasedHp < increasedHpBuddy) increasedHpBuddy = mIncreasedHp;
              const primaryScore = Math.floor(increasedHpBuddy);
              if (
                primaryScore < minIncreasedHpBuddy ||
                !increasedCouldBeat(primaryScore, exactSecondaryUpper)
              ) {
                nowResultsCount += 1;
                continue;
              }

              const mHpTable = hpTables[m];
              const hp =
                iHpTable[iMask] +
                jHpTable[jMask] +
                kHpTable[kMask] +
                lHpTable[lMask] +
                mHpTable[mMask];
              if (hp < minHP) {
                incrementDebugCounter('hpSkip');
                nowResultsCount += 1;
                continue;
              }
              const mHealTable = healTables[m];
              const ehp =
                hp +
                iHealTable[iMask] +
                jHealTable[jMask] +
                kHealTable[kMask] +
                lHealTable[lMask] +
                mHealTable[mMask];
              if (ehp < minEHP) {
                incrementDebugCounter('ehpSkip');
                nowResultsCount += 1;
                continue;
              }
              if (useSecondaryPrune && !metricPrimaryCouldBeat(primaryScore, ehp)) {
                nowResultsCount += 1;
                continue;
              }

              addMetricPrimaryFastDeck(primaryScore, ehp, c0, c1, c2, c3, c4);
              nowResultsCount += 1;
            }
          }
        }
      }
    }
    return true;
  };

  const runSameSupportIncreasedHpBuddyFastLoop = async (lengthes: number[]): Promise<boolean> => {
    let searchCheckCounter = 0;
    const supportLength = maxLevel.length;
    for (let i = 0; i < lengthes[0]; i++) {
      const c0 = nonZero[i];
      const iBuddyMaskOffset = i * listLength;
      const iSupportMaskOffset = i * supportLength;
      const iHpTable = fastHpTables![i];
      const iHealTable = fastHealTables![i];
      const iIncreasedTable = fastIncreasedTables![i];
      if (requiredCount <= 1) {
        const branchUpper = Math.min(
          increasedHpPrimaryUpperScores![i],
          increasedHpPrimarySuffixKthLargest![3][i + 1],
          maxLevelIncreasedHpPrimaryUpperMax
        );
        const secondaryUpper =
          secondaryEhpUpperScores![i] +
          secondaryEhpUpperSuffixTopSums![3][i + 1] +
          maxLevelSecondaryEhpUpperMax;
        if (!metricPrimaryCouldBeat(branchUpper, secondaryUpper)) {
          incrementDebugCounter('sameSupportBranchSkip', combinationCount(lengthes[3] - i - 1, 3) * supportLength);
          nowResultsCount += combinationCount(lengthes[3] - i - 1, 3) * supportLength;
          continue;
        }
      }
      for (let j = i + 1; j < lengthes[1]; j++) {
        const c1 = nonZero[j];
        const jBuddyMaskOffset = j * listLength;
        const jSupportMaskOffset = j * supportLength;
        const jHpTable = fastHpTables![j];
        const jHealTable = fastHealTables![j];
        const jIncreasedTable = fastIncreasedTables![j];
        if (requiredCount <= 2) {
          const branchUpper = Math.min(
            increasedHpPrimaryUpperScores![i],
            increasedHpPrimaryUpperScores![j],
            increasedHpPrimarySuffixKthLargest![2][j + 1],
            maxLevelIncreasedHpPrimaryUpperMax
          );
          const secondaryUpper =
            secondaryEhpUpperScores![i] +
            secondaryEhpUpperScores![j] +
            secondaryEhpUpperSuffixTopSums![2][j + 1] +
            maxLevelSecondaryEhpUpperMax;
          if (!metricPrimaryCouldBeat(branchUpper, secondaryUpper)) {
            incrementDebugCounter('sameSupportBranchSkip', combinationCount(lengthes[3] - j - 1, 2) * supportLength);
            nowResultsCount += combinationCount(lengthes[3] - j - 1, 2) * supportLength;
            continue;
          }
        }
        for (let k = j + 1; k < lengthes[2]; k++) {
          const c2 = nonZero[k];
          const kBuddyMaskOffset = k * listLength;
          const kSupportMaskOffset = k * supportLength;
          const kHpTable = fastHpTables![k];
          const kHealTable = fastHealTables![k];
          const kIncreasedTable = fastIncreasedTables![k];
          if (requiredCount <= 3) {
            const branchUpper = Math.min(
              increasedHpPrimaryUpperScores![i],
              increasedHpPrimaryUpperScores![j],
              increasedHpPrimaryUpperScores![k],
              increasedHpPrimarySuffixKthLargest![1][k + 1],
              maxLevelIncreasedHpPrimaryUpperMax
            );
            const secondaryUpper =
              secondaryEhpUpperScores![i] +
              secondaryEhpUpperScores![j] +
              secondaryEhpUpperScores![k] +
              secondaryEhpUpperSuffixTopSums![1][k + 1] +
              maxLevelSecondaryEhpUpperMax;
            if (!metricPrimaryCouldBeat(branchUpper, secondaryUpper)) {
              incrementDebugCounter('sameSupportBranchSkip', (lengthes[3] - k - 1) * supportLength);
              nowResultsCount += (lengthes[3] - k - 1) * supportLength;
              continue;
            }
          }
          for (let l = k + 1; l < lengthes[3]; l++) {
            searchCheckCounter += 1;
            if ((searchCheckCounter & SEARCH_CHECK_MASK) === 0 && !(await yieldToSearchUi())) return false;
            const c3 = nonZero[l];
            const lBuddyMaskOffset = l * listLength;
            const lSupportMaskOffset = l * supportLength;
            const lHpTable = fastHpTables![l];
            const lHealTable = fastHealTables![l];
            const lIncreasedTable = fastIncreasedTables![l];

            let prefixUpper = increasedHpPrimaryUpperScores![i];
            const jUpper = increasedHpPrimaryUpperScores![j];
            if (jUpper < prefixUpper) prefixUpper = jUpper;
            const kUpper = increasedHpPrimaryUpperScores![k];
            if (kUpper < prefixUpper) prefixUpper = kUpper;
            const lUpper = increasedHpPrimaryUpperScores![l];
            if (lUpper < prefixUpper) prefixUpper = lUpper;
            const prefixWithSupportUpper = prefixUpper < maxLevelIncreasedHpPrimaryUpperMax
              ? prefixUpper
              : maxLevelIncreasedHpPrimaryUpperMax;
            const prefixSecondaryUpper =
              secondaryEhpUpperScores![i] +
              secondaryEhpUpperScores![j] +
              secondaryEhpUpperScores![k] +
              secondaryEhpUpperScores![l];
            if (!metricPrimaryCouldBeat(prefixWithSupportUpper, prefixSecondaryUpper + maxLevelSecondaryEhpUpperMax)) {
              incrementDebugCounter('sameSupportPrefixSkip', supportLength);
              nowResultsCount += supportLength;
              continue;
            }

            const iBaseMask =
              fastPairBuddyMasks![iBuddyMaskOffset + i] |
              fastPairBuddyMasks![iBuddyMaskOffset + j] |
              fastPairBuddyMasks![iBuddyMaskOffset + k] |
              fastPairBuddyMasks![iBuddyMaskOffset + l];
            const jBaseMask =
              fastPairBuddyMasks![jBuddyMaskOffset + i] |
              fastPairBuddyMasks![jBuddyMaskOffset + j] |
              fastPairBuddyMasks![jBuddyMaskOffset + k] |
              fastPairBuddyMasks![jBuddyMaskOffset + l];
            const kBaseMask =
              fastPairBuddyMasks![kBuddyMaskOffset + i] |
              fastPairBuddyMasks![kBuddyMaskOffset + j] |
              fastPairBuddyMasks![kBuddyMaskOffset + k] |
              fastPairBuddyMasks![kBuddyMaskOffset + l];
            const lBaseMask =
              fastPairBuddyMasks![lBuddyMaskOffset + i] |
              fastPairBuddyMasks![lBuddyMaskOffset + j] |
              fastPairBuddyMasks![lBuddyMaskOffset + k] |
              fastPairBuddyMasks![lBuddyMaskOffset + l];
            let normalSupportReachableUpper = prefixUpper;
            if (fastNormalSupportIncreasedSuffixBestByBase) {
              normalSupportReachableUpper =
                fastNormalSupportIncreasedSuffixBestByBase[((i << 3) + iBaseMask) * fastSupportIncreasedSuffixSpan];
              const jReachableUpper =
                fastNormalSupportIncreasedSuffixBestByBase[((j << 3) + jBaseMask) * fastSupportIncreasedSuffixSpan];
              if (jReachableUpper < normalSupportReachableUpper) normalSupportReachableUpper = jReachableUpper;
              const kReachableUpper =
                fastNormalSupportIncreasedSuffixBestByBase[((k << 3) + kBaseMask) * fastSupportIncreasedSuffixSpan];
              if (kReachableUpper < normalSupportReachableUpper) normalSupportReachableUpper = kReachableUpper;
              const lReachableUpper =
                fastNormalSupportIncreasedSuffixBestByBase[((l << 3) + lBaseMask) * fastSupportIncreasedSuffixSpan];
              if (lReachableUpper < normalSupportReachableUpper) normalSupportReachableUpper = lReachableUpper;
              const reachableUpper = normalSupportReachableUpper < maxLevelIncreasedHpPrimaryUpperMax
                ? normalSupportReachableUpper
                : maxLevelIncreasedHpPrimaryUpperMax;
              if (!metricPrimaryCouldBeat(reachableUpper, prefixSecondaryUpper + maxLevelSecondaryEhpUpperMax)) {
                incrementDebugCounter('sameSupportReachablePrefixSkip', supportLength);
                nowResultsCount += supportLength;
                continue;
              }
            }

            for (let m = 0; m < supportLength; m++) {
              const supportUpper = maxLevelIncreasedHpPrimaryUpperScores![m];
              let suffixReachableUpper = normalSupportReachableUpper;
              if (fastNormalSupportIncreasedSuffixBestByBase) {
                suffixReachableUpper =
                  fastNormalSupportIncreasedSuffixBestByBase[((i << 3) + iBaseMask) * fastSupportIncreasedSuffixSpan + m];
                const jReachableUpper =
                  fastNormalSupportIncreasedSuffixBestByBase[((j << 3) + jBaseMask) * fastSupportIncreasedSuffixSpan + m];
                if (jReachableUpper < suffixReachableUpper) suffixReachableUpper = jReachableUpper;
                const kReachableUpper =
                  fastNormalSupportIncreasedSuffixBestByBase[((k << 3) + kBaseMask) * fastSupportIncreasedSuffixSpan + m];
                if (kReachableUpper < suffixReachableUpper) suffixReachableUpper = kReachableUpper;
                const lReachableUpper =
                  fastNormalSupportIncreasedSuffixBestByBase[((l << 3) + lBaseMask) * fastSupportIncreasedSuffixSpan + m];
                if (lReachableUpper < suffixReachableUpper) suffixReachableUpper = lReachableUpper;
              }
              const suffixUpperScore = suffixReachableUpper < maxLevelIncreasedHpPrimaryUpperSuffixMax![m]
                ? suffixReachableUpper
                : maxLevelIncreasedHpPrimaryUpperSuffixMax![m];
              if (!metricPrimaryCouldBeat(suffixUpperScore, prefixSecondaryUpper + maxLevelSecondaryEhpUpperSuffixMax![m])) {
                incrementDebugCounter('sameSupportSuffixBreak', supportLength - m);
                nowResultsCount += supportLength - m;
                break;
              }

              const iMask = iBaseMask | fastNormalToSupportBuddyMasks![iSupportMaskOffset + m];
              const jMask = jBaseMask | fastNormalToSupportBuddyMasks![jSupportMaskOffset + m];
              const kMask = kBaseMask | fastNormalToSupportBuddyMasks![kSupportMaskOffset + m];
              const lMask = lBaseMask | fastNormalToSupportBuddyMasks![lSupportMaskOffset + m];
              let normalPrimaryUpper = iIncreasedTable[iMask];
              const jPrimaryUpper = jIncreasedTable[jMask];
              if (jPrimaryUpper < normalPrimaryUpper) normalPrimaryUpper = jPrimaryUpper;
              const kPrimaryUpper = kIncreasedTable[kMask];
              if (kPrimaryUpper < normalPrimaryUpper) normalPrimaryUpper = kPrimaryUpper;
              const lPrimaryUpper = lIncreasedTable[lMask];
              if (lPrimaryUpper < normalPrimaryUpper) normalPrimaryUpper = lPrimaryUpper;
              const upperScore = normalPrimaryUpper < supportUpper ? normalPrimaryUpper : supportUpper;
              const secondaryUpper = prefixSecondaryUpper + maxLevelSecondaryEhpUpperScores![m];
              if (!metricPrimaryCouldBeat(upperScore, secondaryUpper)) {
                incrementDebugCounter('sameSupportCardSkip');
                nowResultsCount += 1;
                continue;
              }

              const c4 = maxLevel[m];
              const supportNormalMaskOffset = m * listLength;
              const mMask =
                fastSupportToNormalBuddyMasks![supportNormalMaskOffset + i] |
                fastSupportToNormalBuddyMasks![supportNormalMaskOffset + j] |
                fastSupportToNormalBuddyMasks![supportNormalMaskOffset + k] |
                fastSupportToNormalBuddyMasks![supportNormalMaskOffset + l] |
                fastSupportSelfBuddyMasks![m];

              let increasedHpBuddy = normalPrimaryUpper;
              const mIncreasedHp = supportFastIncreasedTables![m][mMask];
              if (mIncreasedHp < increasedHpBuddy) increasedHpBuddy = mIncreasedHp;
              const primaryScore = Math.floor(increasedHpBuddy);
              if (primaryScore < snapshot.minIncreasedHPBuddy || !metricPrimaryCouldBeat(primaryScore, secondaryUpper)) {
                nowResultsCount += 1;
                continue;
              }

              const hp =
                iHpTable[iMask] +
                jHpTable[jMask] +
                kHpTable[kMask] +
                lHpTable[lMask] +
                supportFastHpTables![m][mMask];
              if (hp < snapshot.minHP) {
                nowResultsCount += 1;
                continue;
              }
              const ehp =
                hp +
                iHealTable[iMask] +
                jHealTable[jMask] +
                kHealTable[kMask] +
                lHealTable[lMask] +
                supportFastHealTables![m][mMask];
              if (ehp < snapshot.minEHP) {
                nowResultsCount += 1;
                continue;
              }

              addMetricPrimaryFastDeck(primaryScore, ehp, c0, c1, c2, c3, c4, true);
              nowResultsCount += 1;
            }
          }
        }
      }
    }
    return true;
  };

  const runSameSupportHpPrimaryFastLoop = async (lengthes: number[]): Promise<boolean> => {
    if (
      !metricPrimaryFastEntries ||
      !fastPairBuddyMasks ||
      !fastHpTables ||
      !fastHealTables ||
      !hpPrimaryUpperScores ||
      !hpPrimaryUpperSuffixTopSums ||
      !maxLevelHpPrimaryUpperScores ||
      !maxLevelHpPrimaryUpperSuffixMax ||
      !supportFastHpTables ||
      !supportFastHealTables ||
      !fastNormalToSupportBuddyMasks ||
      !fastSupportToNormalBuddyMasks ||
      !fastSupportSelfBuddyMasks ||
      requiredCount >= 5
    ) {
      return false;
    }

    let searchCheckCounter = 0;
    const supportLength = maxLevel.length;
    for (let i = 0; i < lengthes[0]; i++) {
      const c0 = nonZero[i];
      const iBuddyMaskOffset = i * listLength;
      const iSupportMaskOffset = i * supportLength;
      const iHpTable = fastHpTables[i];
      const iHealTable = fastHealTables[i];
      if (!metricPrimaryShouldConsider(hpPrimaryUpperScores[i] + hpPrimaryUpperSuffixTopSums[3][i + 1] + maxLevelHpPrimaryUpperMax)) {
        const skipped = combinationCount(lengthes[3] - i - 1, 3) * supportLength;
        incrementDebugCounter('sameSupportHpBranchSkip', skipped);
        nowResultsCount += skipped;
        continue;
      }
      for (let j = i + 1; j < lengthes[1]; j++) {
        const c1 = nonZero[j];
        const jBuddyMaskOffset = j * listLength;
        const jSupportMaskOffset = j * supportLength;
        const jHpTable = fastHpTables[j];
        const jHealTable = fastHealTables[j];
        const ijUpper = hpPrimaryUpperScores[i] + hpPrimaryUpperScores[j];
        if (!metricPrimaryShouldConsider(ijUpper + hpPrimaryUpperSuffixTopSums[2][j + 1] + maxLevelHpPrimaryUpperMax)) {
          const skipped = combinationCount(lengthes[3] - j - 1, 2) * supportLength;
          incrementDebugCounter('sameSupportHpBranchSkip', skipped);
          nowResultsCount += skipped;
          continue;
        }
        for (let k = j + 1; k < lengthes[2]; k++) {
          const c2 = nonZero[k];
          const kBuddyMaskOffset = k * listLength;
          const kSupportMaskOffset = k * supportLength;
          const kHpTable = fastHpTables[k];
          const kHealTable = fastHealTables[k];
          const ijkUpper = ijUpper + hpPrimaryUpperScores[k];
          if (!metricPrimaryShouldConsider(ijkUpper + hpPrimaryUpperSuffixTopSums[1][k + 1] + maxLevelHpPrimaryUpperMax)) {
            const skipped = (lengthes[3] - k - 1) * supportLength;
            incrementDebugCounter('sameSupportHpBranchSkip', skipped);
            nowResultsCount += skipped;
            continue;
          }
          for (let l = k + 1; l < lengthes[3]; l++) {
            searchCheckCounter += 1;
            if ((searchCheckCounter & SEARCH_CHECK_MASK) === 0 && !(await yieldToSearchUi())) return false;
            const c3 = nonZero[l];
            const lBuddyMaskOffset = l * listLength;
            const lSupportMaskOffset = l * supportLength;
            const lHpTable = fastHpTables[l];
            const lHealTable = fastHealTables[l];
            const prefixUpper = ijkUpper + hpPrimaryUpperScores[l];
            if (!metricPrimaryShouldConsider(prefixUpper + maxLevelHpPrimaryUpperMax)) {
              incrementDebugCounter('sameSupportHpPrefixSkip', supportLength);
              nowResultsCount += supportLength;
              continue;
            }

            const iBaseMask =
              fastPairBuddyMasks[iBuddyMaskOffset + i] |
              fastPairBuddyMasks[iBuddyMaskOffset + j] |
              fastPairBuddyMasks[iBuddyMaskOffset + k] |
              fastPairBuddyMasks[iBuddyMaskOffset + l];
            const jBaseMask =
              fastPairBuddyMasks[jBuddyMaskOffset + i] |
              fastPairBuddyMasks[jBuddyMaskOffset + j] |
              fastPairBuddyMasks[jBuddyMaskOffset + k] |
              fastPairBuddyMasks[jBuddyMaskOffset + l];
            const kBaseMask =
              fastPairBuddyMasks[kBuddyMaskOffset + i] |
              fastPairBuddyMasks[kBuddyMaskOffset + j] |
              fastPairBuddyMasks[kBuddyMaskOffset + k] |
              fastPairBuddyMasks[kBuddyMaskOffset + l];
            const lBaseMask =
              fastPairBuddyMasks[lBuddyMaskOffset + i] |
              fastPairBuddyMasks[lBuddyMaskOffset + j] |
              fastPairBuddyMasks[lBuddyMaskOffset + k] |
              fastPairBuddyMasks[lBuddyMaskOffset + l];

            for (let m = 0; m < supportLength; m++) {
              searchCheckCounter += 1;
              if ((searchCheckCounter & INNER_SEARCH_CHECK_MASK) === 0 && !(await yieldToSearchUi())) return false;
              if (!metricPrimaryShouldConsider(prefixUpper + maxLevelHpPrimaryUpperSuffixMax[m])) {
                incrementDebugCounter('sameSupportHpSuffixBreak', supportLength - m);
                nowResultsCount += supportLength - m;
                break;
              }
              if (!metricPrimaryShouldConsider(prefixUpper + maxLevelHpPrimaryUpperScores[m])) {
                incrementDebugCounter('sameSupportHpCardSkip');
                nowResultsCount += 1;
                continue;
              }

              const c4 = maxLevel[m];
              const iMask = iBaseMask | fastNormalToSupportBuddyMasks[iSupportMaskOffset + m];
              const jMask = jBaseMask | fastNormalToSupportBuddyMasks[jSupportMaskOffset + m];
              const kMask = kBaseMask | fastNormalToSupportBuddyMasks[kSupportMaskOffset + m];
              const lMask = lBaseMask | fastNormalToSupportBuddyMasks[lSupportMaskOffset + m];
              const supportNormalMaskOffset = m * listLength;
              const mMask =
                fastSupportToNormalBuddyMasks[supportNormalMaskOffset + i] |
                fastSupportToNormalBuddyMasks[supportNormalMaskOffset + j] |
                fastSupportToNormalBuddyMasks[supportNormalMaskOffset + k] |
                fastSupportToNormalBuddyMasks[supportNormalMaskOffset + l] |
                fastSupportSelfBuddyMasks[m];
              const hp =
                iHpTable[iMask] +
                jHpTable[jMask] +
                kHpTable[kMask] +
                lHpTable[lMask] +
                supportFastHpTables[m][mMask];
              if (hp < snapshot.minHP) {
                nowResultsCount += 1;
                continue;
              }
              const ehp =
                hp +
                iHealTable[iMask] +
                jHealTable[jMask] +
                kHealTable[kMask] +
                lHealTable[lMask] +
                supportFastHealTables[m][mMask];
              if (ehp < snapshot.minEHP) {
                nowResultsCount += 1;
                continue;
              }
              const primaryScore = hpPrimaryUsesEhp ? ehp : hp;
              if (!metricPrimaryShouldConsider(primaryScore)) {
                nowResultsCount += 1;
                continue;
              }
              if ((hasAuxThreshold || hasDamageThreshold) && !hpPrimaryThresholdsPass(c0, c1, c2, c3, c4, true)) {
                nowResultsCount += 1;
                continue;
              }
              addMetricPrimaryFastDeck(primaryScore, ehp, c0, c1, c2, c3, c4, true);
              nowResultsCount += 1;
            }
          }
        }
      }
    }
    return true;
  };

  const runNoSameDamagePrimaryFastLoop = async (lengthes: number[]): Promise<boolean> => {
    const damageMetricOffset = getDamageMetricTableIndex(primaryDamageUpperMetric) << 4;
    const minHP = snapshot.minHP;
    const minEHP = snapshot.minEHP;
    const needsDamageHpCheck = minHP > 0 || minEHP > 0;
    const minEvasion = snapshot.minEvasion;
    const minBuff = snapshot.minBuff;
    const minDebuff = snapshot.minDebuff;
    const minCosmic = snapshot.minCosmic;
    const minFire = snapshot.minFire;
    const minWater = snapshot.minWater;
    const minFlora = snapshot.minFlora;
      const minHealNum = snapshot.minHealNum;
      const damagePrimaryAuxRequirementCount =
      (minEvasion > 0 ? 1 : 0) +
      (minBuff > 0 ? 1 : 0) +
      (minDebuff > 0 ? 1 : 0) +
      (minCosmic > 0 ? 1 : 0) +
      (minFire > 0 ? 1 : 0) +
      (minWater > 0 ? 1 : 0) +
      (minFlora > 0 ? 1 : 0) +
      (minHealNum > 0 ? 1 : 0);
    const hasDamagePrimaryAuxRequirements = damagePrimaryAuxRequirementCount > 0;
    const hasDamagePrimaryMultiAuxRequirements = damagePrimaryAuxRequirementCount > 1;
    const canUseDamagePrimaryOrderPrune = canUseNoRequiredEarlyPrune;
    const damagePrimarySingleAuxRequirement =
      damagePrimaryAuxRequirementCount !== 1
        ? 0
        : minEvasion > 0
          ? 1
          : minBuff > 0
            ? 2
            : minDebuff > 0
              ? 3
              : minCosmic > 0
                ? 4
                : minFire > 0
                  ? 5
                  : minWater > 0
                    ? 6
                    : minFlora > 0
                      ? 7
                      : 8;
    const candidateDuoIds = new Int16Array(listLength);
    const candidateUseM2 = new Uint8Array(listLength);
    const candidateDuoBase = new Uint8Array(listLength);
    const candidateEvasion = new Float64Array(listLength);
    const candidateBuff = new Float64Array(listLength);
    const candidateDebuff = new Float64Array(listLength);
    const candidateCosmic = new Float64Array(listLength);
    const candidateFire = new Float64Array(listLength);
    const candidateWater = new Float64Array(listLength);
    const candidateFlora = new Float64Array(listLength);
    const candidateHealCards = new Float64Array(listLength);
    const candidateDamageTables = new Array<Float64Array>(listLength);
    const damagePrimarySingleAuxMinimum =
      damagePrimarySingleAuxRequirement === 1
        ? minEvasion
        : damagePrimarySingleAuxRequirement === 2
          ? minBuff
          : damagePrimarySingleAuxRequirement === 3
            ? minDebuff
            : damagePrimarySingleAuxRequirement === 4
              ? minCosmic
              : damagePrimarySingleAuxRequirement === 5
                ? minFire
                : damagePrimarySingleAuxRequirement === 6
                  ? minWater
                  : damagePrimarySingleAuxRequirement === 7
                    ? minFlora
                    : damagePrimarySingleAuxRequirement === 8
                      ? minHealNum
                      : 0;

    for (let index = 0; index < listLength; index++) {
      const chara = nonZero[index];
      const charaAny = chara as any;
      candidateDuoIds[index] = charaAny.duoId as number;
      candidateUseM2[index] = (charaAny.useM2Cached as boolean) ? 1 : 0;
      candidateDuoBase[index] = (charaAny.magic2IsDuoBaseCached as boolean) === true ? 1 : 0;
      if (hasDamagePrimaryAuxRequirements) {
        candidateEvasion[index] = chara.evasion;
        candidateBuff[index] = (charaAny.totalBuffCached as number) ?? 0;
        candidateDebuff[index] = (charaAny.totalDebuffCached as number) ?? 0;
        candidateCosmic[index] = (charaAny.magicCosmicCountCached as number) ?? 0;
        candidateFire[index] = (charaAny.magicFireCountCached as number) ?? 0;
        candidateWater[index] = (charaAny.magicWaterCountCached as number) ?? 0;
        candidateFlora[index] = (charaAny.magicFloraCountCached as number) ?? 0;
        candidateHealCards[index] = (charaAny.healCardCountCached as number) ?? 0;
      }
      candidateDamageTables[index] = charaAny.primaryDamageTop2ByMaskCached as Float64Array;
    }
    const damagePrimarySingleAuxScores =
      damagePrimarySingleAuxRequirement === 1
        ? candidateEvasion
        : damagePrimarySingleAuxRequirement === 2
          ? candidateBuff
          : damagePrimarySingleAuxRequirement === 3
            ? candidateDebuff
            : damagePrimarySingleAuxRequirement === 4
              ? candidateCosmic
              : damagePrimarySingleAuxRequirement === 5
                ? candidateFire
                : damagePrimarySingleAuxRequirement === 6
                  ? candidateWater
                  : damagePrimarySingleAuxRequirement === 7
                    ? candidateFlora
                    : damagePrimarySingleAuxRequirement === 8
                      ? candidateHealCards
                      : null;
    const damagePrimarySingleAuxSuffixTopSums = damagePrimarySingleAuxScores ? buildSuffixTopSums(damagePrimarySingleAuxScores, 5) : null;
    const damagePrimarySingleAuxNextAtLeast = damagePrimarySingleAuxScores ? buildNextAtLeast(damagePrimarySingleAuxScores, damagePrimarySingleAuxMinimum) : null;
    const damagePrimaryEvasionSuffixTopSums = minEvasion > 0 && damagePrimarySingleAuxRequirement !== 1 ? buildSuffixTopSums(candidateEvasion, 5) : null;
    const damagePrimaryBuffSuffixTopSums = minBuff > 0 && damagePrimarySingleAuxRequirement !== 2 ? buildSuffixTopSums(candidateBuff, 5) : null;
    const damagePrimaryDebuffSuffixTopSums = minDebuff > 0 && damagePrimarySingleAuxRequirement !== 3 ? buildSuffixTopSums(candidateDebuff, 5) : null;
    const damagePrimaryCosmicSuffixTopSums = minCosmic > 0 && damagePrimarySingleAuxRequirement !== 4 ? buildSuffixTopSums(candidateCosmic, 5) : null;
    const damagePrimaryFireSuffixTopSums = minFire > 0 && damagePrimarySingleAuxRequirement !== 5 ? buildSuffixTopSums(candidateFire, 5) : null;
    const damagePrimaryWaterSuffixTopSums = minWater > 0 && damagePrimarySingleAuxRequirement !== 6 ? buildSuffixTopSums(candidateWater, 5) : null;
    const damagePrimaryFloraSuffixTopSums = minFlora > 0 && damagePrimarySingleAuxRequirement !== 7 ? buildSuffixTopSums(candidateFlora, 5) : null;
    const damagePrimaryHealNumSuffixTopSums = minHealNum > 0 && damagePrimarySingleAuxRequirement !== 8 ? buildSuffixTopSums(candidateHealCards, 5) : null;
    const damagePrimaryEvasionNextAtLeast = minEvasion > 0 && damagePrimarySingleAuxRequirement !== 1 ? buildNextAtLeast(candidateEvasion, minEvasion) : null;
    const damagePrimaryBuffNextAtLeast = minBuff > 0 && damagePrimarySingleAuxRequirement !== 2 ? buildNextAtLeast(candidateBuff, minBuff) : null;
    const damagePrimaryDebuffNextAtLeast = minDebuff > 0 && damagePrimarySingleAuxRequirement !== 3 ? buildNextAtLeast(candidateDebuff, minDebuff) : null;
    const damagePrimaryCosmicNextAtLeast = minCosmic > 0 && damagePrimarySingleAuxRequirement !== 4 ? buildNextAtLeast(candidateCosmic, minCosmic) : null;
    const damagePrimaryFireNextAtLeast = minFire > 0 && damagePrimarySingleAuxRequirement !== 5 ? buildNextAtLeast(candidateFire, minFire) : null;
    const damagePrimaryWaterNextAtLeast = minWater > 0 && damagePrimarySingleAuxRequirement !== 6 ? buildNextAtLeast(candidateWater, minWater) : null;
    const damagePrimaryFloraNextAtLeast = minFlora > 0 && damagePrimarySingleAuxRequirement !== 7 ? buildNextAtLeast(candidateFlora, minFlora) : null;
    const damagePrimaryHealNumNextAtLeast = minHealNum > 0 && damagePrimarySingleAuxRequirement !== 8 ? buildNextAtLeast(candidateHealCards, minHealNum) : null;
    const damagePrimarySingleCandidateJumpEnabled =
      damagePrimarySingleAuxNextAtLeast !== null ||
      damagePrimaryEvasionNextAtLeast !== null ||
      damagePrimaryBuffNextAtLeast !== null ||
      damagePrimaryDebuffNextAtLeast !== null ||
      damagePrimaryCosmicNextAtLeast !== null ||
      damagePrimaryFireNextAtLeast !== null ||
      damagePrimaryWaterNextAtLeast !== null ||
      damagePrimaryFloraNextAtLeast !== null ||
      damagePrimaryHealNumNextAtLeast !== null;
    const damagePrimaryAuxCouldPass = (
      evasion: number,
      buff: number,
      debuff: number,
      cosmic: number,
      fire: number,
      water: number,
      flora: number,
      healNum: number,
      suffixStart: number,
      pickCount: number,
    ): boolean => {
      if (!hasDamagePrimaryAuxRequirements) return true;
      if (damagePrimarySingleAuxRequirement !== 0) {
        const value =
          damagePrimarySingleAuxRequirement === 1
            ? evasion
            : damagePrimarySingleAuxRequirement === 2
              ? buff
              : damagePrimarySingleAuxRequirement === 3
                ? debuff
                : damagePrimarySingleAuxRequirement === 4
                  ? cosmic
                  : damagePrimarySingleAuxRequirement === 5
                    ? fire
                    : damagePrimarySingleAuxRequirement === 6
                      ? water
                      : damagePrimarySingleAuxRequirement === 7
                        ? flora
                        : healNum;
        return value + damagePrimarySingleAuxSuffixTopSums![pickCount][suffixStart] >= damagePrimarySingleAuxMinimum;
      }
      if (damagePrimaryEvasionSuffixTopSums && evasion + damagePrimaryEvasionSuffixTopSums[pickCount][suffixStart] < minEvasion) return false;
      if (damagePrimaryBuffSuffixTopSums && buff + damagePrimaryBuffSuffixTopSums[pickCount][suffixStart] < minBuff) return false;
      if (damagePrimaryDebuffSuffixTopSums && debuff + damagePrimaryDebuffSuffixTopSums[pickCount][suffixStart] < minDebuff) return false;
      if (damagePrimaryCosmicSuffixTopSums && cosmic + damagePrimaryCosmicSuffixTopSums[pickCount][suffixStart] < minCosmic) return false;
      if (damagePrimaryFireSuffixTopSums && fire + damagePrimaryFireSuffixTopSums[pickCount][suffixStart] < minFire) return false;
      if (damagePrimaryWaterSuffixTopSums && water + damagePrimaryWaterSuffixTopSums[pickCount][suffixStart] < minWater) return false;
      if (damagePrimaryFloraSuffixTopSums && flora + damagePrimaryFloraSuffixTopSums[pickCount][suffixStart] < minFlora) return false;
      if (damagePrimaryHealNumSuffixTopSums && healNum + damagePrimaryHealNumSuffixTopSums[pickCount][suffixStart] < minHealNum) return false;
      return true;
    };
    const damagePrimarySingleAuxCouldPass = (value: number, suffixStart: number, pickCount: number): boolean =>
      value + damagePrimarySingleAuxSuffixTopSums![pickCount][suffixStart] >= damagePrimarySingleAuxMinimum;
    const damagePrimaryExactIndexes = new Int32Array(5);
    const damagePrimaryExactMasks = new Uint8Array(5);
    const addLegacyOrderedDamagePrimaryEntry = (
      i: number,
      j: number,
      k: number,
      l: number,
      m: number,
      iMask: number,
      jMask: number,
      kMask: number,
      lMask: number,
      mMask: number,
    ) => {
      const indexes = damagePrimaryExactIndexes;
      const masks = damagePrimaryExactMasks;
      indexes[0] = i;
      indexes[1] = j;
      indexes[2] = k;
      indexes[3] = l;
      indexes[4] = m;
      masks[0] = iMask;
      masks[1] = jMask;
      masks[2] = kMask;
      masks[3] = lMask;
      masks[4] = mMask;
      for (let pos = 1; pos < 5; pos++) {
        const indexValue = indexes[pos];
        const maskValue = masks[pos];
        const orderValue = getLegacyDeckOrderIndex(nonZero[indexValue]);
        let prev = pos - 1;
        while (prev >= 0 && getLegacyDeckOrderIndex(nonZero[indexes[prev]]) > orderValue) {
          indexes[prev + 1] = indexes[prev];
          masks[prev + 1] = masks[prev];
          prev -= 1;
        }
        indexes[prev + 1] = indexValue;
        masks[prev + 1] = maskValue;
      }

      const s0 = indexes[0];
      const s1 = indexes[1];
      const s2 = indexes[2];
      const s3 = indexes[3];
      const s4 = indexes[4];
      const duoMask = resolveFixedFiveDuoMaskFromIds(
        fastIds![s0],
        fastIds![s1],
        fastIds![s2],
        fastIds![s3],
        fastIds![s4],
        candidateDuoIds[s0],
        candidateDuoIds[s1],
        candidateDuoIds[s2],
        candidateDuoIds[s3],
        candidateDuoIds[s4],
        candidateUseM2[s0] !== 0,
        candidateUseM2[s1] !== 0,
        candidateUseM2[s2] !== 0,
        candidateUseM2[s3] !== 0,
        candidateUseM2[s4] !== 0,
      );
      const t0 = candidateDamageTables[s0];
      const t1 = candidateDamageTables[s1];
      const t2 = candidateDamageTables[s2];
      const t3 = candidateDamageTables[s3];
      const t4 = candidateDamageTables[s4];
      const primaryRaw =
        t0[damageMetricOffset + ((candidateDuoBase[s0] !== 0 || (duoMask & 1) !== 0) ? 8 : 0) + masks[0]] +
        t1[damageMetricOffset + ((candidateDuoBase[s1] !== 0 || (duoMask & 2) !== 0) ? 8 : 0) + masks[1]] +
        t2[damageMetricOffset + ((candidateDuoBase[s2] !== 0 || (duoMask & 4) !== 0) ? 8 : 0) + masks[2]] +
        t3[damageMetricOffset + ((candidateDuoBase[s3] !== 0 || (duoMask & 8) !== 0) ? 8 : 0) + masks[3]] +
        t4[damageMetricOffset + ((candidateDuoBase[s4] !== 0 || (duoMask & 16) !== 0) ? 8 : 0) + masks[4]];
      if (metricPrimaryShouldConsider(primaryRaw)) {
        addMetricPrimaryFastEntry(
          Math.floor(primaryRaw),
          0,
          nonZero[s0],
          nonZero[s1],
          nonZero[s2],
          nonZero[s3],
          nonZero[s4],
        );
      }
    };

    const calculateDamagePrimaryOutsideUpper = (candidateLimit: number): number => {
      if (
        candidateLimit >= lengthes[4] ||
        !primaryUpperSuffixTopSums ||
        !fastDamageReachableMasks ||
        !fastDamageReachableScoreByBits ||
        !fastPairBuddyMasks
      ) {
        return -Infinity;
      }

      let outsideUpper = primaryUpperSuffixTopSums[5][candidateLimit];

      const outsideTop4 = primaryUpperSuffixTopSums[4][candidateLimit];
      for (let i = 0; i < candidateLimit; i++) {
        const iBuddyMaskOffset = i * listLength;
        const iSelfMask = fastPairBuddyMasks[iBuddyMaskOffset + i];
        const upper =
          getNoSameDamageReachableUpper(i, iSelfMask, false, candidateLimit, 4) +
          outsideTop4;
        if (upper > outsideUpper) outsideUpper = upper;
      }

      const outsideTop3 = primaryUpperSuffixTopSums[3][candidateLimit];
      for (let i = 0; i < candidateLimit - 1; i++) {
        const iBuddyMaskOffset = i * listLength;
        const iSelfMask = fastPairBuddyMasks[iBuddyMaskOffset + i];
        for (let j = i + 1; j < candidateLimit; j++) {
          const jBuddyMaskOffset = j * listLength;
          const iBaseIJ = iSelfMask | fastPairBuddyMasks[iBuddyMaskOffset + j];
          const jBaseIJ = fastPairBuddyMasks[jBuddyMaskOffset + i] | fastPairBuddyMasks[jBuddyMaskOffset + j];
          const upper =
            getNoSameDamageReachableUpper(i, iBaseIJ, false, candidateLimit, 3) +
            getNoSameDamageReachableUpper(j, jBaseIJ, false, candidateLimit, 3) +
            outsideTop3;
          if (upper > outsideUpper) outsideUpper = upper;
        }
      }

      const outsideTop2 = primaryUpperSuffixTopSums[2][candidateLimit];
      for (let i = 0; i < candidateLimit - 2; i++) {
        const iBuddyMaskOffset = i * listLength;
        const iSelfMask = fastPairBuddyMasks[iBuddyMaskOffset + i];
        for (let j = i + 1; j < candidateLimit - 1; j++) {
          const jBuddyMaskOffset = j * listLength;
          const iBaseIJ = iSelfMask | fastPairBuddyMasks[iBuddyMaskOffset + j];
          const jBaseIJ = fastPairBuddyMasks[jBuddyMaskOffset + i] | fastPairBuddyMasks[jBuddyMaskOffset + j];
          for (let k = j + 1; k < candidateLimit; k++) {
            const kBuddyMaskOffset = k * listLength;
            const iBaseIJK = iBaseIJ | fastPairBuddyMasks[iBuddyMaskOffset + k];
            const jBaseIJK = jBaseIJ | fastPairBuddyMasks[jBuddyMaskOffset + k];
            const kBaseIJK =
              fastPairBuddyMasks[kBuddyMaskOffset + i] |
              fastPairBuddyMasks[kBuddyMaskOffset + j] |
              fastPairBuddyMasks[kBuddyMaskOffset + k];
            const upper =
              getNoSameDamageReachableUpper(i, iBaseIJK, false, candidateLimit, 2) +
              getNoSameDamageReachableUpper(j, jBaseIJK, false, candidateLimit, 2) +
              getNoSameDamageReachableUpper(k, kBaseIJK, false, candidateLimit, 2) +
              outsideTop2;
            if (upper > outsideUpper) outsideUpper = upper;
          }
        }
      }

      const outsideTop1 = primaryUpperSuffixTopSums[1][candidateLimit];
      for (let i = 0; i < candidateLimit - 3; i++) {
        const iBuddyMaskOffset = i * listLength;
        const iSelfMask = fastPairBuddyMasks[iBuddyMaskOffset + i];
        for (let j = i + 1; j < candidateLimit - 2; j++) {
          const jBuddyMaskOffset = j * listLength;
          const iBaseIJ = iSelfMask | fastPairBuddyMasks[iBuddyMaskOffset + j];
          const jBaseIJ = fastPairBuddyMasks[jBuddyMaskOffset + i] | fastPairBuddyMasks[jBuddyMaskOffset + j];
          for (let k = j + 1; k < candidateLimit - 1; k++) {
            const kBuddyMaskOffset = k * listLength;
            const iBaseIJK = iBaseIJ | fastPairBuddyMasks[iBuddyMaskOffset + k];
            const jBaseIJK = jBaseIJ | fastPairBuddyMasks[jBuddyMaskOffset + k];
            const kBaseIJK =
              fastPairBuddyMasks[kBuddyMaskOffset + i] |
              fastPairBuddyMasks[kBuddyMaskOffset + j] |
              fastPairBuddyMasks[kBuddyMaskOffset + k];
            for (let l = k + 1; l < candidateLimit; l++) {
              const lBuddyMaskOffset = l * listLength;
              const iBaseMask = iBaseIJK | fastPairBuddyMasks[iBuddyMaskOffset + l];
              const jBaseMask = jBaseIJK | fastPairBuddyMasks[jBuddyMaskOffset + l];
              const kBaseMask = kBaseIJK | fastPairBuddyMasks[kBuddyMaskOffset + l];
              const lBaseMask =
                fastPairBuddyMasks[lBuddyMaskOffset + i] |
                fastPairBuddyMasks[lBuddyMaskOffset + j] |
                fastPairBuddyMasks[lBuddyMaskOffset + k] |
                fastPairBuddyMasks[lBuddyMaskOffset + l];
              const upper =
                getNoSameDamageReachableUpper(i, iBaseMask, false, candidateLimit, 1) +
                getNoSameDamageReachableUpper(j, jBaseMask, false, candidateLimit, 1) +
                getNoSameDamageReachableUpper(k, kBaseMask, false, candidateLimit, 1) +
                getNoSameDamageReachableUpper(l, lBaseMask, false, candidateLimit, 1) +
                outsideTop1;
              if (upper > outsideUpper) outsideUpper = upper;
            }
          }
        }
      }

      return outsideUpper;
    };

    let damagePrimarySeededCandidateLimit = 0;
    const preseedDamagePrimaryThreshold = (): boolean => {
      if (!metricPrimaryFastEntries || metricPrimaryFastMaxSize <= 0) return false;
      const seedScores: number[] = [];
      let seedThreshold = -Infinity;
      let seedCandidateChecks = 0;
      let seedValidCount = 0;
      let completedLimit = 0;
      let lastOutsideUpper = Infinity;
      const addSeedScore = (score: number) => {
        if (seedScores.length < metricPrimaryFastMaxSize) {
          seedScores.push(score);
          if (seedScores.length === metricPrimaryFastMaxSize) {
            seedScores.sort((a, b) => b - a);
            seedThreshold = seedScores[metricPrimaryFastMaxSize - 1];
          }
          return;
        }
        if (score < seedThreshold) return;
        let left = 0;
        let right = seedScores.length;
        while (left < right) {
          const mid = (left + right) >>> 1;
          if (score > seedScores[mid]) right = mid;
          else left = mid + 1;
        }
        if (left >= metricPrimaryFastMaxSize) return;
        for (let index = metricPrimaryFastMaxSize - 1; index > left; index--) {
          seedScores[index] = seedScores[index - 1];
        }
        seedScores[left] = score;
        seedThreshold = seedScores[metricPrimaryFastMaxSize - 1];
      };

      const getOutsideSimpleUpper = (candidateLimit: number): number => {
        if (!nonZeroPrimaryUpperScores || candidateLimit >= lengthes[4]) return -Infinity;
        if (candidateLimit < 1 || lengthes[4] < 5) return Infinity;
        return (
          nonZeroPrimaryUpperScores[0] +
          nonZeroPrimaryUpperScores[1] +
          nonZeroPrimaryUpperScores[2] +
          nonZeroPrimaryUpperScores[3] +
          nonZeroPrimaryUpperScores[candidateLimit]
        );
      };

      const expandSeedRange = (previousLimit: number, candidateLimit: number) => {
      for (let i = 0; i < candidateLimit - 4; i++) {
        const iBuddyMaskOffset = i * listLength;
        const iEvasion = candidateEvasion[i];
        const iBuff = candidateBuff[i];
        const iDebuff = candidateDebuff[i];
        const iCosmic = candidateCosmic[i];
        const iFire = candidateFire[i];
        const iWater = candidateWater[i];
        const iFlora = candidateFlora[i];
        const iHealCards = candidateHealCards[i];
        for (let j = i + 1; j < candidateLimit - 3; j++) {
          const jBuddyMaskOffset = j * listLength;
          const ijEvasion = iEvasion + candidateEvasion[j];
          const ijBuff = iBuff + candidateBuff[j];
          const ijDebuff = iDebuff + candidateDebuff[j];
          const ijCosmic = iCosmic + candidateCosmic[j];
          const ijFire = iFire + candidateFire[j];
          const ijWater = iWater + candidateWater[j];
          const ijFlora = iFlora + candidateFlora[j];
          const ijHealCards = iHealCards + candidateHealCards[j];
          for (let k = j + 1; k < candidateLimit - 2; k++) {
            const kBuddyMaskOffset = k * listLength;
            const ijkEvasion = ijEvasion + candidateEvasion[k];
            const ijkBuff = ijBuff + candidateBuff[k];
            const ijkDebuff = ijDebuff + candidateDebuff[k];
            const ijkCosmic = ijCosmic + candidateCosmic[k];
            const ijkFire = ijFire + candidateFire[k];
            const ijkWater = ijWater + candidateWater[k];
            const ijkFlora = ijFlora + candidateFlora[k];
            const ijkHealCards = ijHealCards + candidateHealCards[k];
            for (let l = k + 1; l < candidateLimit - 1; l++) {
              const lBuddyMaskOffset = l * listLength;
              const prefixEvasion = ijkEvasion + candidateEvasion[l];
              const prefixBuff = ijkBuff + candidateBuff[l];
              const prefixDebuff = ijkDebuff + candidateDebuff[l];
              const prefixCosmic = ijkCosmic + candidateCosmic[l];
              const prefixFire = ijkFire + candidateFire[l];
              const prefixWater = ijkWater + candidateWater[l];
              const prefixFlora = ijkFlora + candidateFlora[l];
              const prefixHealCards = ijkHealCards + candidateHealCards[l];
              if (!damagePrimaryAuxCouldPass(prefixEvasion, prefixBuff, prefixDebuff, prefixCosmic, prefixFire, prefixWater, prefixFlora, prefixHealCards, l + 1, 1)) {
                continue;
              }
              const iBaseMask =
                fastPairBuddyMasks![iBuddyMaskOffset + i] |
                fastPairBuddyMasks![iBuddyMaskOffset + j] |
                fastPairBuddyMasks![iBuddyMaskOffset + k] |
                fastPairBuddyMasks![iBuddyMaskOffset + l];
              const jBaseMask =
                fastPairBuddyMasks![jBuddyMaskOffset + i] |
                fastPairBuddyMasks![jBuddyMaskOffset + j] |
                fastPairBuddyMasks![jBuddyMaskOffset + k] |
                fastPairBuddyMasks![jBuddyMaskOffset + l];
              const kBaseMask =
                fastPairBuddyMasks![kBuddyMaskOffset + i] |
                fastPairBuddyMasks![kBuddyMaskOffset + j] |
                fastPairBuddyMasks![kBuddyMaskOffset + k] |
                fastPairBuddyMasks![kBuddyMaskOffset + l];
              const lBaseMask =
                fastPairBuddyMasks![lBuddyMaskOffset + i] |
                fastPairBuddyMasks![lBuddyMaskOffset + j] |
                fastPairBuddyMasks![lBuddyMaskOffset + k] |
                fastPairBuddyMasks![lBuddyMaskOffset + l];
              const iDamageTable = candidateDamageTables[i];
              const jDamageTable = candidateDamageTables[j];
              const kDamageTable = candidateDamageTables[k];
              const lDamageTable = candidateDamageTables[l];
              const seedMStart = l + 1 > previousLimit ? l + 1 : previousLimit;
              for (let m = seedMStart; m < candidateLimit; m++) {
                seedCandidateChecks += 1;
                if (
                  prefixEvasion + candidateEvasion[m] < minEvasion ||
                  prefixBuff + candidateBuff[m] < minBuff ||
                  prefixDebuff + candidateDebuff[m] < minDebuff ||
                  prefixCosmic + candidateCosmic[m] < minCosmic ||
                  prefixFire + candidateFire[m] < minFire ||
                  prefixWater + candidateWater[m] < minWater ||
                  prefixFlora + candidateFlora[m] < minFlora ||
                  prefixHealCards + candidateHealCards[m] < minHealNum
                ) {
                  continue;
                }

                const mBuddyMaskOffset = m * listLength;
                const iMask = iBaseMask | fastPairBuddyMasks![iBuddyMaskOffset + m];
                const jMask = jBaseMask | fastPairBuddyMasks![jBuddyMaskOffset + m];
                const kMask = kBaseMask | fastPairBuddyMasks![kBuddyMaskOffset + m];
                const lMask = lBaseMask | fastPairBuddyMasks![lBuddyMaskOffset + m];
                const mMask =
                  fastPairBuddyMasks![mBuddyMaskOffset + i] |
                  fastPairBuddyMasks![mBuddyMaskOffset + j] |
                  fastPairBuddyMasks![mBuddyMaskOffset + k] |
                  fastPairBuddyMasks![mBuddyMaskOffset + l] |
                  fastPairBuddyMasks![mBuddyMaskOffset + m];

                if (needsDamageHpCheck) {
                  const hp =
                    fastHpTables![i][iMask] +
                    fastHpTables![j][jMask] +
                    fastHpTables![k][kMask] +
                    fastHpTables![l][lMask] +
                    fastHpTables![m][mMask];
                  if (hp < minHP) continue;
                  if (
                    minEHP > 0 &&
                    hp +
                      fastHealTables![i][iMask] +
                      fastHealTables![j][jMask] +
                      fastHealTables![k][kMask] +
                      fastHealTables![l][lMask] +
                      fastHealTables![m][mMask] < minEHP
                  ) {
                    continue;
                  }
                }

                const mDamageTable = candidateDamageTables[m];
                if (seedScores.length >= metricPrimaryFastMaxSize) {
                  const duoUpperScore =
                    iDamageTable[damageMetricOffset + 8 + iMask] +
                    jDamageTable[damageMetricOffset + 8 + jMask] +
                    kDamageTable[damageMetricOffset + 8 + kMask] +
                    lDamageTable[damageMetricOffset + 8 + lMask] +
                    mDamageTable[damageMetricOffset + 8 + mMask];
                  if (duoUpperScore < seedThreshold) continue;
                }

                const duoMask = resolveFixedFiveDuoMaskFromIds(
                  fastIds![i],
                  fastIds![j],
                  fastIds![k],
                  fastIds![l],
                  fastIds![m],
                  candidateDuoIds[i],
                  candidateDuoIds[j],
                  candidateDuoIds[k],
                  candidateDuoIds[l],
                  candidateDuoIds[m],
                  candidateUseM2[i] !== 0,
                  candidateUseM2[j] !== 0,
                  candidateUseM2[k] !== 0,
                  candidateUseM2[l] !== 0,
                  candidateUseM2[m] !== 0,
                );
                const primaryScore = Math.floor(
                  iDamageTable[damageMetricOffset + ((candidateDuoBase[i] !== 0 || (duoMask & 1) !== 0) ? 8 : 0) + iMask] +
                  jDamageTable[damageMetricOffset + ((candidateDuoBase[j] !== 0 || (duoMask & 2) !== 0) ? 8 : 0) + jMask] +
                  kDamageTable[damageMetricOffset + ((candidateDuoBase[k] !== 0 || (duoMask & 4) !== 0) ? 8 : 0) + kMask] +
                  lDamageTable[damageMetricOffset + ((candidateDuoBase[l] !== 0 || (duoMask & 8) !== 0) ? 8 : 0) + lMask] +
                  mDamageTable[damageMetricOffset + ((candidateDuoBase[m] !== 0 || (duoMask & 16) !== 0) ? 8 : 0) + mMask]
                );
                seedValidCount += 1;
                addSeedScore(primaryScore);
                addMetricPrimaryFastEntry(primaryScore, 0, nonZero[i], nonZero[j], nonZero[k], nonZero[l], nonZero[m]);
              }
            }
          }
        }
      }
      };

      const maxSeedCombinations = 1100000;
      const maxCandidateLimit = Math.min(lengthes[4], 44);
      const candidateLimits: number[] = [];
      for (let limit = Math.min(maxCandidateLimit, 30); limit < maxCandidateLimit; limit += 4) {
        if (limit >= 5) candidateLimits.push(limit);
      }
      if (candidateLimits[candidateLimits.length - 1] !== maxCandidateLimit && maxCandidateLimit >= 5) {
        candidateLimits.push(maxCandidateLimit);
      }

      let previousLimit = 0;
      let complete = false;
      for (let limitIndex = 0; limitIndex < candidateLimits.length; limitIndex++) {
        let candidateLimit = candidateLimits[limitIndex];
        while (candidateLimit > 24 && combinationCount(candidateLimit, 5) > maxSeedCombinations) {
          candidateLimit -= 1;
        }
        if (candidateLimit <= previousLimit || candidateLimit < 5) continue;

        expandSeedRange(previousLimit, candidateLimit);
        damagePrimarySeededCandidateLimit = candidateLimit;

        if (!metricPrimaryFastIsSorted) {
          metricPrimaryFastEntries.sort(compareMetricPrimaryFastEntries);
          metricPrimaryFastIsSorted = true;
          updateMetricPrimaryFastThreshold();
        }

        complete = candidateLimit >= lengthes[4];
        if (seedScores.length >= metricPrimaryFastMaxSize) {
          metricPrimarySeedThresholdPrimary = seedScores[metricPrimaryFastMaxSize - 1];
          metricPrimarySeedThresholdSecondary = -Infinity;
          lastOutsideUpper = getOutsideSimpleUpper(candidateLimit);
          if (!complete) {
            complete = lastOutsideUpper < metricPrimarySeedThresholdPrimary;
          }
          if (complete) {
            completedLimit = candidateLimit;
            break;
          }
        }
        previousLimit = candidateLimit;
      }

      if (debugCounters) {
        debugCounters.damagePrimarySeedCandidateLimit = damagePrimarySeededCandidateLimit;
        debugCounters.damagePrimarySeedCompletedLimit = completedLimit;
        debugCounters.damagePrimarySeedCandidateChecks = seedCandidateChecks;
        debugCounters.damagePrimarySeedValid = seedValidCount;
        debugCounters.damagePrimarySeedThresholdPrimary = metricPrimarySeedThresholdPrimary;
        debugCounters.damagePrimarySeedOutsideUpper = lastOutsideUpper;
        debugCounters.damagePrimarySeedComplete = complete ? 1 : 0;
      }
      return complete;
    };

    const tryCompleteFixedTwoDamagePrimaryFromSeed = (): boolean => {
      if (
        !metricPrimaryFastEntries ||
        metricPrimaryFastMaxSize <= 0 ||
        requiredCount !== 2 ||
        !hasRequiredCharacters ||
        hasDamagePrimaryAuxRequirements ||
        !nonZeroPrimaryUpperScores ||
        !fastPairBuddyMasks ||
        !fastIds ||
        (needsDamageHpCheck && (!fastHpTables || !fastHealTables))
      ) {
        return false;
      }
      const remainingCount = lengthes[4] - 2;
      if (remainingCount < 3) return false;

      const sortedRemaining = new Int32Array(remainingCount);
      for (let index = 0; index < remainingCount; index++) {
        sortedRemaining[index] = index + 2;
      }
      sortedRemaining.sort((a, b) => {
        const diff = nonZeroPrimaryUpperScores[b] - nonZeroPrimaryUpperScores[a];
        if (diff !== 0) return diff;
        return a - b;
      });

      const maxSeedCombinations = 26000;
      let seedCount = Math.min(remainingCount, 52);
      while (seedCount > 3 && combinationCount(seedCount, 3) > maxSeedCombinations) {
        seedCount -= 1;
      }
      if (combinationCount(seedCount, 3) < metricPrimaryFastMaxSize) return false;

      type FixedTwoDamageSeedEntry = {
        primaryScore: number;
        c2: Character;
        c3: Character;
        c4: Character;
      };
      const seedEntries: FixedTwoDamageSeedEntry[] = [];
      let seedThreshold = -Infinity;
      const compareSeedEntries = (a: FixedTwoDamageSeedEntry, b: FixedTwoDamageSeedEntry): number => {
        if (a.primaryScore !== b.primaryScore) return b.primaryScore - a.primaryScore;
        const aKey = buildLegacyDeckKey(nonZero[0], nonZero[1], a.c2, a.c3, a.c4);
        const bKey = buildLegacyDeckKey(nonZero[0], nonZero[1], b.c2, b.c3, b.c4);
        if (aKey === bKey) return 0;
        return aKey < bKey ? -1 : 1;
      };
      const updateSeedThreshold = () => {
        seedThreshold = seedEntries[metricPrimaryFastMaxSize - 1].primaryScore;
      };
      const addSeedEntry = (primaryScore: number, c2: Character, c3: Character, c4: Character) => {
        if (seedEntries.length >= metricPrimaryFastMaxSize && primaryScore < seedThreshold) return;
        const entry = { primaryScore, c2, c3, c4 };
        if (seedEntries.length < metricPrimaryFastMaxSize) {
          seedEntries.push(entry);
          if (seedEntries.length === metricPrimaryFastMaxSize) {
            seedEntries.sort(compareSeedEntries);
            updateSeedThreshold();
          }
          return;
        }
        if (compareSeedEntries(entry, seedEntries[seedEntries.length - 1]) >= 0) return;
        let left = 0;
        let right = seedEntries.length;
        while (left < right) {
          const mid = (left + right) >>> 1;
          if (compareSeedEntries(entry, seedEntries[mid]) < 0) {
            right = mid;
          } else {
            left = mid + 1;
          }
        }
        if (left >= metricPrimaryFastMaxSize) return;
        for (let index = metricPrimaryFastMaxSize - 1; index > left; index--) {
          seedEntries[index] = seedEntries[index - 1];
        }
        seedEntries[left] = entry;
        updateSeedThreshold();
      };

      const fixed0Row = 0;
      const fixed1Row = listLength;
      const fixed0BaseMask = fastPairBuddyMasks[fixed0Row] | fastPairBuddyMasks[fixed0Row + 1];
      const fixed1BaseMask = fastPairBuddyMasks[fixed1Row] | fastPairBuddyMasks[fixed1Row + 1];
      const fixed0DamageTable = candidateDamageTables[0];
      const fixed1DamageTable = candidateDamageTables[1];
      for (let ai = 0; ai < seedCount - 2; ai++) {
        const a = sortedRemaining[ai];
        const aRow = a * listLength;
        const fixed0BaseA = fixed0BaseMask | fastPairBuddyMasks[fixed0Row + a];
        const fixed1BaseA = fixed1BaseMask | fastPairBuddyMasks[fixed1Row + a];
        const aBaseMask = fastPairBuddyMasks[aRow] | fastPairBuddyMasks[aRow + 1] | fastPairBuddyMasks[aRow + a];
        for (let bi = ai + 1; bi < seedCount - 1; bi++) {
          const b = sortedRemaining[bi];
          const bRow = b * listLength;
          const fixed0BaseB = fixed0BaseA | fastPairBuddyMasks[fixed0Row + b];
          const fixed1BaseB = fixed1BaseA | fastPairBuddyMasks[fixed1Row + b];
          const aBaseB = aBaseMask | fastPairBuddyMasks[aRow + b];
          const bBaseMask =
            fastPairBuddyMasks[bRow] |
            fastPairBuddyMasks[bRow + 1] |
            fastPairBuddyMasks[bRow + a] |
            fastPairBuddyMasks[bRow + b];
          for (let ci = bi + 1; ci < seedCount; ci++) {
            const c = sortedRemaining[ci];
            let s2 = a;
            let s3 = b;
            let s4 = c;
            if (s3 < s2) {
              const tmp = s2;
              s2 = s3;
              s3 = tmp;
            }
            if (s4 < s3) {
              const tmp = s3;
              s3 = s4;
              s4 = tmp;
              if (s3 < s2) {
                const tmp2 = s2;
                s2 = s3;
                s3 = tmp2;
              }
            }
            const cRow = c * listLength;
            const fixed0Mask = fixed0BaseB | fastPairBuddyMasks[fixed0Row + c];
            const fixed1Mask = fixed1BaseB | fastPairBuddyMasks[fixed1Row + c];
            const aMask = aBaseB | fastPairBuddyMasks[aRow + c];
            const bMask = bBaseMask | fastPairBuddyMasks[bRow + c];
            const cMask =
              fastPairBuddyMasks[cRow] |
              fastPairBuddyMasks[cRow + 1] |
              fastPairBuddyMasks[cRow + a] |
              fastPairBuddyMasks[cRow + b] |
              fastPairBuddyMasks[cRow + c];
            const duoMask = resolveFixedFiveDuoMaskFromIds(
              fastIds[0],
              fastIds[1],
              fastIds[s2],
              fastIds[s3],
              fastIds[s4],
              candidateDuoIds[0],
              candidateDuoIds[1],
              candidateDuoIds[s2],
              candidateDuoIds[s3],
              candidateDuoIds[s4],
              candidateUseM2[0] !== 0,
              candidateUseM2[1] !== 0,
              candidateUseM2[s2] !== 0,
              candidateUseM2[s3] !== 0,
              candidateUseM2[s4] !== 0,
            );
            const mask2 = s2 === a ? aMask : s2 === b ? bMask : cMask;
            const mask3 = s3 === a ? aMask : s3 === b ? bMask : cMask;
            const mask4 = s4 === a ? aMask : s4 === b ? bMask : cMask;
            const primaryScore = Math.floor(
              fixed0DamageTable[damageMetricOffset + ((candidateDuoBase[0] !== 0 || (duoMask & 1) !== 0) ? 8 : 0) + fixed0Mask] +
              fixed1DamageTable[damageMetricOffset + ((candidateDuoBase[1] !== 0 || (duoMask & 2) !== 0) ? 8 : 0) + fixed1Mask] +
              candidateDamageTables[s2][damageMetricOffset + ((candidateDuoBase[s2] !== 0 || (duoMask & 4) !== 0) ? 8 : 0) + mask2] +
              candidateDamageTables[s3][damageMetricOffset + ((candidateDuoBase[s3] !== 0 || (duoMask & 8) !== 0) ? 8 : 0) + mask3] +
              candidateDamageTables[s4][damageMetricOffset + ((candidateDuoBase[s4] !== 0 || (duoMask & 16) !== 0) ? 8 : 0) + mask4]
            );
            addSeedEntry(primaryScore, nonZero[s2], nonZero[s3], nonZero[s4]);
          }
        }
      }
      if (seedEntries.length < metricPrimaryFastMaxSize) return false;

      const outsideUpper = seedCount >= remainingCount
        ? -Infinity
        : nonZeroPrimaryUpperScores[0] +
          nonZeroPrimaryUpperScores[1] +
          nonZeroPrimaryUpperScores[sortedRemaining[0]] +
          nonZeroPrimaryUpperScores[sortedRemaining[1]] +
          nonZeroPrimaryUpperScores[sortedRemaining[seedCount]];
      if (outsideUpper >= seedThreshold) return false;

      for (let index = 0; index < seedEntries.length; index++) {
        const entry = seedEntries[index];
        addMetricPrimaryFastEntry(
          entry.primaryScore,
          0,
          nonZero[0],
          nonZero[1],
          entry.c2,
          entry.c3,
          entry.c4,
        );
      }
      if (debugCounters) {
        debugCounters.fixedTwoDamageSeedCount = seedCount;
        debugCounters.fixedTwoDamageSeedThresholdPrimary = seedThreshold;
        debugCounters.fixedTwoDamageSeedOutsideUpper = outsideUpper;
        debugCounters.fixedTwoDamageSeedComplete = 1;
      }
      return true;
    };

    if (false && tryCompleteFixedTwoDamagePrimaryFromSeed()) {
      nowResultsCount += combinationCount(lengthes[4] - 2, 3);
      return true;
    }

    const tryCompleteFixedTwoDamagePrimaryBestFirst = async (): Promise<boolean> => {
      if (
        !metricPrimaryFastEntries ||
        metricPrimaryFastMaxSize <= 0 ||
        requiredCount !== 2 ||
        !hasRequiredCharacters ||
        hasDamagePrimaryAuxRequirements ||
        !nonZeroPrimaryUpperScores ||
        !fastPairBuddyMasks ||
        !fastIds
      ) {
        return false;
      }
      const remainingCount = lengthes[4] - 2;
      if (remainingCount < 3) return false;

      const order = new Int32Array(remainingCount);
      for (let index = 0; index < remainingCount; index++) order[index] = index + 2;
      order.sort((a, b) => {
        const diff = nonZeroPrimaryUpperScores[b] - nonZeroPrimaryUpperScores[a];
        if (diff !== 0) return diff;
        return a - b;
      });

      type FixedTwoDamageNode = { a: number; b: number; c: number; upper: number };
      const heap: FixedTwoDamageNode[] = [];
      const visited = new Uint8Array(remainingCount * remainingCount * remainingCount);
      const packNodeKey = (a: number, b: number, c: number): number =>
        ((a * remainingCount + b) * remainingCount + c);
      const heapPush = (node: FixedTwoDamageNode) => {
        let index = heap.length;
        heap.push(node);
        while (index > 0) {
          const parent = (index - 1) >>> 1;
          if (heap[parent].upper >= node.upper) break;
          heap[index] = heap[parent];
          index = parent;
        }
        heap[index] = node;
      };
      const heapPop = (): FixedTwoDamageNode | undefined => {
        const root = heap[0];
        if (root === undefined) return undefined;
        const last = heap.pop()!;
        if (heap.length === 0) return root;
        let index = 0;
        while (true) {
          const left = index * 2 + 1;
          const right = left + 1;
          if (left >= heap.length) break;
          let child = left;
          if (right < heap.length && heap[right].upper > heap[left].upper) child = right;
          if (heap[child].upper <= last.upper) break;
          heap[index] = heap[child];
          index = child;
        }
        heap[index] = last;
        return root;
      };
      const pushNode = (a: number, b: number, c: number) => {
        if (!(a < b && b < c && c < remainingCount)) return;
        const key = packNodeKey(a, b, c);
        if (visited[key] !== 0) return;
        const upper =
          nonZeroPrimaryUpperScores[0] +
          nonZeroPrimaryUpperScores[1] +
          nonZeroPrimaryUpperScores[order[a]] +
          nonZeroPrimaryUpperScores[order[b]] +
          nonZeroPrimaryUpperScores[order[c]];
        if (!metricPrimaryShouldConsider(upper)) return;
        visited[key] = 1;
        heapPush({ a, b, c, upper });
      };

      const originalEntryCount = metricPrimaryFastEntries.length;
      const originalIsSorted = metricPrimaryFastIsSorted;
      let checked = 0;
      let valid = 0;
      let completed = false;
      let searchCheckCounter = 0;
      const maxBestFirstChecks = 18000;
      const fixed0Row = 0;
      const fixed1Row = listLength;
      const fixed0BaseMask = fastPairBuddyMasks[fixed0Row] | fastPairBuddyMasks[fixed0Row + 1];
      const fixed1BaseMask = fastPairBuddyMasks[fixed1Row] | fastPairBuddyMasks[fixed1Row + 1];
      const fixed0DamageTable = candidateDamageTables[0];
      const fixed1DamageTable = candidateDamageTables[1];
      const fixed0HpTable = fastHpTables?.[0];
      const fixed1HpTable = fastHpTables?.[1];
      const fixed0HealTable = fastHealTables?.[0];
      const fixed1HealTable = fastHealTables?.[1];

      pushNode(0, 1, 2);
      while (heap.length > 0) {
        const node = heapPop()!;
        if (!metricPrimaryShouldConsider(node.upper)) {
          completed = true;
          break;
        }
        checked += 1;
        searchCheckCounter += 1;
        if ((searchCheckCounter & SEARCH_CHECK_MASK) === 0 && !(await yieldToSearchUi())) return false;
        if (checked > maxBestFirstChecks) break;

        const ia = order[node.a];
        const ib = order[node.b];
        const ic = order[node.c];
        let s2 = ia;
        let s3 = ib;
        let s4 = ic;
        if (s3 < s2) {
          const tmp = s2;
          s2 = s3;
          s3 = tmp;
        }
        if (s4 < s3) {
          const tmp = s3;
          s3 = s4;
          s4 = tmp;
          if (s3 < s2) {
            const tmp2 = s2;
            s2 = s3;
            s3 = tmp2;
          }
        }

        const aRow = ia * listLength;
        const bRow = ib * listLength;
        const cRow = ic * listLength;
        const fixed0Mask = fixed0BaseMask | fastPairBuddyMasks[fixed0Row + ia] | fastPairBuddyMasks[fixed0Row + ib] | fastPairBuddyMasks[fixed0Row + ic];
        const fixed1Mask = fixed1BaseMask | fastPairBuddyMasks[fixed1Row + ia] | fastPairBuddyMasks[fixed1Row + ib] | fastPairBuddyMasks[fixed1Row + ic];
        const aMask =
          fastPairBuddyMasks[aRow] |
          fastPairBuddyMasks[aRow + 1] |
          fastPairBuddyMasks[aRow + ia] |
          fastPairBuddyMasks[aRow + ib] |
          fastPairBuddyMasks[aRow + ic];
        const bMask =
          fastPairBuddyMasks[bRow] |
          fastPairBuddyMasks[bRow + 1] |
          fastPairBuddyMasks[bRow + ia] |
          fastPairBuddyMasks[bRow + ib] |
          fastPairBuddyMasks[bRow + ic];
        const cMask =
          fastPairBuddyMasks[cRow] |
          fastPairBuddyMasks[cRow + 1] |
          fastPairBuddyMasks[cRow + ia] |
          fastPairBuddyMasks[cRow + ib] |
          fastPairBuddyMasks[cRow + ic];
        const duoMask = resolveFixedFiveDuoMaskFromIds(
          fastIds[0],
          fastIds[1],
          fastIds[s2],
          fastIds[s3],
          fastIds[s4],
          candidateDuoIds[0],
          candidateDuoIds[1],
          candidateDuoIds[s2],
          candidateDuoIds[s3],
          candidateDuoIds[s4],
          candidateUseM2[0] !== 0,
          candidateUseM2[1] !== 0,
          candidateUseM2[s2] !== 0,
          candidateUseM2[s3] !== 0,
          candidateUseM2[s4] !== 0,
        );
        const mask2 = s2 === ia ? aMask : s2 === ib ? bMask : cMask;
        const mask3 = s3 === ia ? aMask : s3 === ib ? bMask : cMask;
        const mask4 = s4 === ia ? aMask : s4 === ib ? bMask : cMask;
        const primaryScore = Math.floor(
          fixed0DamageTable[damageMetricOffset + ((candidateDuoBase[0] !== 0 || (duoMask & 1) !== 0) ? 8 : 0) + fixed0Mask] +
          fixed1DamageTable[damageMetricOffset + ((candidateDuoBase[1] !== 0 || (duoMask & 2) !== 0) ? 8 : 0) + fixed1Mask] +
          candidateDamageTables[s2][damageMetricOffset + ((candidateDuoBase[s2] !== 0 || (duoMask & 4) !== 0) ? 8 : 0) + mask2] +
          candidateDamageTables[s3][damageMetricOffset + ((candidateDuoBase[s3] !== 0 || (duoMask & 8) !== 0) ? 8 : 0) + mask3] +
          candidateDamageTables[s4][damageMetricOffset + ((candidateDuoBase[s4] !== 0 || (duoMask & 16) !== 0) ? 8 : 0) + mask4]
        );
        let hpPass = true;
        if (needsDamageHpCheck) {
          const hp =
            fixed0HpTable![fixed0Mask] +
            fixed1HpTable![fixed1Mask] +
            fastHpTables![s2][mask2] +
            fastHpTables![s3][mask3] +
            fastHpTables![s4][mask4];
          hpPass = hp >= minHP && (
            minEHP <= 0 ||
            hp +
              fixed0HealTable![fixed0Mask] +
              fixed1HealTable![fixed1Mask] +
              fastHealTables![s2][mask2] +
              fastHealTables![s3][mask3] +
              fastHealTables![s4][mask4] >= minEHP
          );
        }
        let auxPass = true;
        if (hasDamagePrimaryAuxRequirements) {
          auxPass = !(
            fixedEvasion + candidateEvasion[s2] + candidateEvasion[s3] + candidateEvasion[s4] < minEvasion ||
            fixedBuff + candidateBuff[s2] + candidateBuff[s3] + candidateBuff[s4] < minBuff ||
            fixedDebuff + candidateDebuff[s2] + candidateDebuff[s3] + candidateDebuff[s4] < minDebuff ||
            fixedCosmic + candidateCosmic[s2] + candidateCosmic[s3] + candidateCosmic[s4] < minCosmic ||
            fixedFire + candidateFire[s2] + candidateFire[s3] + candidateFire[s4] < minFire ||
            fixedWater + candidateWater[s2] + candidateWater[s3] + candidateWater[s4] < minWater ||
            fixedFlora + candidateFlora[s2] + candidateFlora[s3] + candidateFlora[s4] < minFlora ||
            fixedHealCards + candidateHealCards[s2] + candidateHealCards[s3] + candidateHealCards[s4] < minHealNum
          );
        }
        if (hpPass && auxPass && metricPrimaryShouldConsider(primaryScore)) {
          addMetricPrimaryFastEntry(primaryScore, 0, nonZero[0], nonZero[1], nonZero[s2], nonZero[s3], nonZero[s4]);
          valid += 1;
        }

        pushNode(node.a + 1, node.b, node.c);
        pushNode(node.a, node.b + 1, node.c);
        pushNode(node.a, node.b, node.c + 1);
      }

      if (heap.length === 0) completed = true;
      if (debugCounters) {
        debugCounters.fixedTwoDamageBestFirstChecks = checked;
        debugCounters.fixedTwoDamageBestFirstValid = valid;
        debugCounters.fixedTwoDamageBestFirstVisited = visited.reduce((sum, value) => sum + value, 0);
        debugCounters.fixedTwoDamageBestFirstCompleted = completed ? 1 : 0;
      }
      if (completed) {
        nowResultsCount += combinationCount(lengthes[4] - 2, 3);
        return true;
      }

      metricPrimaryFastEntries.length = originalEntryCount;
      metricPrimaryFastIsSorted = originalIsSorted;
      updateMetricPrimaryFastThreshold();
      return false;
    };

    if (await tryCompleteFixedTwoDamagePrimaryBestFirst()) {
      return true;
    }

    const preseedFixedTwoDamagePrimaryThresholdOnly = (): void => {
      if (
        !metricPrimaryFastEntries ||
        metricPrimaryFastMaxSize <= 0 ||
        requiredCount !== 2 ||
        !hasRequiredCharacters ||
        hasDamagePrimaryAuxRequirements ||
        !nonZeroPrimaryUpperScores ||
        !fastPairBuddyMasks ||
        !fastIds ||
        !fastHpTables ||
        !fastHealTables
      ) {
        return;
      }

      const remainingCount = lengthes[4] - 2;
      if (remainingCount < 3) return;

      const sortedRemaining = new Int32Array(remainingCount);
      for (let index = 0; index < remainingCount; index++) {
        sortedRemaining[index] = index + 2;
      }
      sortedRemaining.sort((a, b) => {
        const diff = nonZeroPrimaryUpperScores[b] - nonZeroPrimaryUpperScores[a];
        if (diff !== 0) return diff;
        return a - b;
      });

      const maxSeedCombinations = 1200;
      let seedCount = Math.min(remainingCount, 24);
      while (seedCount > 3 && combinationCount(seedCount, 3) > maxSeedCombinations) {
        seedCount -= 1;
      }
      if (combinationCount(seedCount, 3) < metricPrimaryFastMaxSize) return;

      const seedScores = new Array<number>();
      let seedThreshold = -Infinity;
      let seedChecks = 0;
      let seedValid = 0;
      const addSeedScore = (primaryScore: number) => {
        if (seedScores.length < metricPrimaryFastMaxSize) {
          seedScores.push(primaryScore);
          if (seedScores.length === metricPrimaryFastMaxSize) {
            seedScores.sort((a, b) => b - a);
            seedThreshold = seedScores[metricPrimaryFastMaxSize - 1];
          }
          return;
        }
        if (primaryScore < seedThreshold) return;
        let left = 0;
        let right = seedScores.length;
        while (left < right) {
          const mid = (left + right) >>> 1;
          if (primaryScore > seedScores[mid]) right = mid;
          else left = mid + 1;
        }
        if (left >= metricPrimaryFastMaxSize) return;
        for (let index = metricPrimaryFastMaxSize - 1; index > left; index--) {
          seedScores[index] = seedScores[index - 1];
        }
        seedScores[left] = primaryScore;
        seedThreshold = seedScores[metricPrimaryFastMaxSize - 1];
      };

      const fixed0Row = 0;
      const fixed1Row = listLength;
      const fixed0BaseMask = fastPairBuddyMasks[fixed0Row] | fastPairBuddyMasks[fixed0Row + 1];
      const fixed1BaseMask = fastPairBuddyMasks[fixed1Row] | fastPairBuddyMasks[fixed1Row + 1];
      const fixed0DamageTable = candidateDamageTables[0];
      const fixed1DamageTable = candidateDamageTables[1];
      const fixed0HpTable = fastHpTables[0];
      const fixed1HpTable = fastHpTables[1];
      const fixed0HealTable = fastHealTables[0];
      const fixed1HealTable = fastHealTables[1];

      for (let ai = 0; ai < seedCount - 2; ai++) {
        const a = sortedRemaining[ai];
        const aRow = a * listLength;
        const fixed0BaseA = fixed0BaseMask | fastPairBuddyMasks[fixed0Row + a];
        const fixed1BaseA = fixed1BaseMask | fastPairBuddyMasks[fixed1Row + a];
        const aBaseMask = fastPairBuddyMasks[aRow] | fastPairBuddyMasks[aRow + 1] | fastPairBuddyMasks[aRow + a];
        const aHpTable = fastHpTables[a];
        const aHealTable = fastHealTables[a];
        const aDamageTable = candidateDamageTables[a];
        for (let bi = ai + 1; bi < seedCount - 1; bi++) {
          const b = sortedRemaining[bi];
          const bRow = b * listLength;
          const fixed0BaseB = fixed0BaseA | fastPairBuddyMasks[fixed0Row + b];
          const fixed1BaseB = fixed1BaseA | fastPairBuddyMasks[fixed1Row + b];
          const aBaseB = aBaseMask | fastPairBuddyMasks[aRow + b];
          const bBaseMask =
            fastPairBuddyMasks[bRow] |
            fastPairBuddyMasks[bRow + 1] |
            fastPairBuddyMasks[bRow + a] |
            fastPairBuddyMasks[bRow + b];
          const bHpTable = fastHpTables[b];
          const bHealTable = fastHealTables[b];
          const bDamageTable = candidateDamageTables[b];
          for (let ci = bi + 1; ci < seedCount; ci++) {
            const c = sortedRemaining[ci];
            seedChecks += 1;
            let s2 = a;
            let s3 = b;
            let s4 = c;
            if (s3 < s2) {
              const tmp = s2;
              s2 = s3;
              s3 = tmp;
            }
            if (s4 < s3) {
              const tmp = s3;
              s3 = s4;
              s4 = tmp;
              if (s3 < s2) {
                const tmp2 = s2;
                s2 = s3;
                s3 = tmp2;
              }
            }

            const cRow = c * listLength;
            const fixed0Mask = fixed0BaseB | fastPairBuddyMasks[fixed0Row + c];
            const fixed1Mask = fixed1BaseB | fastPairBuddyMasks[fixed1Row + c];
            const aMask = aBaseB | fastPairBuddyMasks[aRow + c];
            const bMask = bBaseMask | fastPairBuddyMasks[bRow + c];
            const cMask =
              fastPairBuddyMasks[cRow] |
              fastPairBuddyMasks[cRow + 1] |
              fastPairBuddyMasks[cRow + a] |
              fastPairBuddyMasks[cRow + b] |
              fastPairBuddyMasks[cRow + c];

            const hp =
              fixed0HpTable[fixed0Mask] +
              fixed1HpTable[fixed1Mask] +
              aHpTable[aMask] +
              bHpTable[bMask] +
              fastHpTables[c][cMask];
            if (hp < minHP) continue;
            if (
              minEHP > 0 &&
              hp +
                fixed0HealTable[fixed0Mask] +
                fixed1HealTable[fixed1Mask] +
                aHealTable[aMask] +
                bHealTable[bMask] +
                fastHealTables[c][cMask] < minEHP
            ) {
              continue;
            }

            const duoMask = resolveFixedFiveDuoMaskFromIds(
              fastIds[0],
              fastIds[1],
              fastIds[s2],
              fastIds[s3],
              fastIds[s4],
              candidateDuoIds[0],
              candidateDuoIds[1],
              candidateDuoIds[s2],
              candidateDuoIds[s3],
              candidateDuoIds[s4],
              candidateUseM2[0] !== 0,
              candidateUseM2[1] !== 0,
              candidateUseM2[s2] !== 0,
              candidateUseM2[s3] !== 0,
              candidateUseM2[s4] !== 0,
            );
            const mask2 = s2 === a ? aMask : s2 === b ? bMask : cMask;
            const mask3 = s3 === a ? aMask : s3 === b ? bMask : cMask;
            const mask4 = s4 === a ? aMask : s4 === b ? bMask : cMask;
            const table2 = s2 === a ? aDamageTable : s2 === b ? bDamageTable : candidateDamageTables[c];
            const table3 = s3 === a ? aDamageTable : s3 === b ? bDamageTable : candidateDamageTables[c];
            const table4 = s4 === a ? aDamageTable : s4 === b ? bDamageTable : candidateDamageTables[c];
            const primaryScore = Math.floor(
              fixed0DamageTable[damageMetricOffset + ((candidateDuoBase[0] !== 0 || (duoMask & 1) !== 0) ? 8 : 0) + fixed0Mask] +
              fixed1DamageTable[damageMetricOffset + ((candidateDuoBase[1] !== 0 || (duoMask & 2) !== 0) ? 8 : 0) + fixed1Mask] +
              table2[damageMetricOffset + ((candidateDuoBase[s2] !== 0 || (duoMask & 4) !== 0) ? 8 : 0) + mask2] +
              table3[damageMetricOffset + ((candidateDuoBase[s3] !== 0 || (duoMask & 8) !== 0) ? 8 : 0) + mask3] +
              table4[damageMetricOffset + ((candidateDuoBase[s4] !== 0 || (duoMask & 16) !== 0) ? 8 : 0) + mask4]
            );
            seedValid += 1;
            addSeedScore(primaryScore);
          }
        }
      }

      if (seedScores.length >= metricPrimaryFastMaxSize) {
        metricPrimarySeedThresholdPrimary = seedThreshold;
        metricPrimarySeedThresholdSecondary = -Infinity;
      }
      if (debugCounters) {
        debugCounters.fixedTwoDamageThresholdSeedCount = seedCount;
        debugCounters.fixedTwoDamageThresholdSeedChecks = seedChecks;
        debugCounters.fixedTwoDamageThresholdSeedValid = seedValid;
        debugCounters.fixedTwoDamageThresholdSeedPrimary = metricPrimarySeedThresholdPrimary;
      }
    };
    preseedFixedTwoDamagePrimaryThresholdOnly();

    if (false && preseedDamagePrimaryThreshold()) {
      nowResultsCount += combinationCount(lengthes[4], 5);
      return true;
    }

    const tryCompleteDamagePrimaryFromPrefix = (): boolean => {
      if (
        !metricPrimaryFastEntries ||
        metricPrimaryFastMaxSize <= 0 ||
        !fastPairBuddyMasks ||
        !fastIds ||
        !nonZeroPrimaryUpperScores
      ) {
        return false;
      }
      const maxPrefixCombinations = 1100000;
      let candidateLimit = Math.min(lengthes[4], 44);
      while (candidateLimit > 24 && combinationCount(candidateLimit, 5) > maxPrefixCombinations) {
        candidateLimit -= 1;
      }
      if (candidateLimit < 5) return false;

      const originalEntryCount = metricPrimaryFastEntries.length;
      const originalIsSorted = metricPrimaryFastIsSorted;
      let checked = 0;
      let valid = 0;

      for (let i = 0; i < candidateLimit - 4; i++) {
        const iBuddyMaskOffset = i * listLength;
        const iEvasion = candidateEvasion[i];
        const iBuff = candidateBuff[i];
        const iDebuff = candidateDebuff[i];
        const iCosmic = candidateCosmic[i];
        const iFire = candidateFire[i];
        const iWater = candidateWater[i];
        const iFlora = candidateFlora[i];
        const iHealCards = candidateHealCards[i];
        for (let j = i + 1; j < candidateLimit - 3; j++) {
          const jBuddyMaskOffset = j * listLength;
          const ijEvasion = iEvasion + candidateEvasion[j];
          const ijBuff = iBuff + candidateBuff[j];
          const ijDebuff = iDebuff + candidateDebuff[j];
          const ijCosmic = iCosmic + candidateCosmic[j];
          const ijFire = iFire + candidateFire[j];
          const ijWater = iWater + candidateWater[j];
          const ijFlora = iFlora + candidateFlora[j];
          const ijHealCards = iHealCards + candidateHealCards[j];
          for (let k = j + 1; k < candidateLimit - 2; k++) {
            const kBuddyMaskOffset = k * listLength;
            const ijkEvasion = ijEvasion + candidateEvasion[k];
            const ijkBuff = ijBuff + candidateBuff[k];
            const ijkDebuff = ijDebuff + candidateDebuff[k];
            const ijkCosmic = ijCosmic + candidateCosmic[k];
            const ijkFire = ijFire + candidateFire[k];
            const ijkWater = ijWater + candidateWater[k];
            const ijkFlora = ijFlora + candidateFlora[k];
            const ijkHealCards = ijHealCards + candidateHealCards[k];
            for (let l = k + 1; l < candidateLimit - 1; l++) {
              const lBuddyMaskOffset = l * listLength;
              const prefixEvasion = ijkEvasion + candidateEvasion[l];
              const prefixBuff = ijkBuff + candidateBuff[l];
              const prefixDebuff = ijkDebuff + candidateDebuff[l];
              const prefixCosmic = ijkCosmic + candidateCosmic[l];
              const prefixFire = ijkFire + candidateFire[l];
              const prefixWater = ijkWater + candidateWater[l];
              const prefixFlora = ijkFlora + candidateFlora[l];
              const prefixHealCards = ijkHealCards + candidateHealCards[l];
              if (!damagePrimaryAuxCouldPass(prefixEvasion, prefixBuff, prefixDebuff, prefixCosmic, prefixFire, prefixWater, prefixFlora, prefixHealCards, l + 1, 1)) {
                continue;
              }

              const iBaseMask =
                fastPairBuddyMasks[iBuddyMaskOffset + i] |
                fastPairBuddyMasks[iBuddyMaskOffset + j] |
                fastPairBuddyMasks[iBuddyMaskOffset + k] |
                fastPairBuddyMasks[iBuddyMaskOffset + l];
              const jBaseMask =
                fastPairBuddyMasks[jBuddyMaskOffset + i] |
                fastPairBuddyMasks[jBuddyMaskOffset + j] |
                fastPairBuddyMasks[jBuddyMaskOffset + k] |
                fastPairBuddyMasks[jBuddyMaskOffset + l];
              const kBaseMask =
                fastPairBuddyMasks[kBuddyMaskOffset + i] |
                fastPairBuddyMasks[kBuddyMaskOffset + j] |
                fastPairBuddyMasks[kBuddyMaskOffset + k] |
                fastPairBuddyMasks[kBuddyMaskOffset + l];
              const lBaseMask =
                fastPairBuddyMasks[lBuddyMaskOffset + i] |
                fastPairBuddyMasks[lBuddyMaskOffset + j] |
                fastPairBuddyMasks[lBuddyMaskOffset + k] |
                fastPairBuddyMasks[lBuddyMaskOffset + l];
              const iDamageTable = candidateDamageTables[i];
              const jDamageTable = candidateDamageTables[j];
              const kDamageTable = candidateDamageTables[k];
              const lDamageTable = candidateDamageTables[l];

              for (let m = l + 1; m < candidateLimit; m++) {
                checked += 1;
                if (
                  prefixEvasion + candidateEvasion[m] < minEvasion ||
                  prefixBuff + candidateBuff[m] < minBuff ||
                  prefixDebuff + candidateDebuff[m] < minDebuff ||
                  prefixCosmic + candidateCosmic[m] < minCosmic ||
                  prefixFire + candidateFire[m] < minFire ||
                  prefixWater + candidateWater[m] < minWater ||
                  prefixFlora + candidateFlora[m] < minFlora ||
                  prefixHealCards + candidateHealCards[m] < minHealNum
                ) {
                  continue;
                }

                const mBuddyMaskOffset = m * listLength;
                const iMask = iBaseMask | fastPairBuddyMasks[iBuddyMaskOffset + m];
                const jMask = jBaseMask | fastPairBuddyMasks[jBuddyMaskOffset + m];
                const kMask = kBaseMask | fastPairBuddyMasks[kBuddyMaskOffset + m];
                const lMask = lBaseMask | fastPairBuddyMasks[lBuddyMaskOffset + m];
                const mMask =
                  fastPairBuddyMasks[mBuddyMaskOffset + i] |
                  fastPairBuddyMasks[mBuddyMaskOffset + j] |
                  fastPairBuddyMasks[mBuddyMaskOffset + k] |
                  fastPairBuddyMasks[mBuddyMaskOffset + l] |
                  fastPairBuddyMasks[mBuddyMaskOffset + m];

                if (needsDamageHpCheck) {
                  const hp =
                    fastHpTables![i][iMask] +
                    fastHpTables![j][jMask] +
                    fastHpTables![k][kMask] +
                    fastHpTables![l][lMask] +
                    fastHpTables![m][mMask];
                  if (hp < minHP) continue;
                  if (
                    minEHP > 0 &&
                    hp +
                      fastHealTables![i][iMask] +
                      fastHealTables![j][jMask] +
                      fastHealTables![k][kMask] +
                      fastHealTables![l][lMask] +
                      fastHealTables![m][mMask] < minEHP
                  ) {
                    continue;
                  }
                }

                const mDamageTable = candidateDamageTables[m];
                const duoUpperScore =
                  iDamageTable[damageMetricOffset + 8 + iMask] +
                  jDamageTable[damageMetricOffset + 8 + jMask] +
                  kDamageTable[damageMetricOffset + 8 + kMask] +
                  lDamageTable[damageMetricOffset + 8 + lMask] +
                  mDamageTable[damageMetricOffset + 8 + mMask];
                if (!metricPrimaryShouldConsider(duoUpperScore)) continue;

                const duoMask = resolveFixedFiveDuoMaskFromIds(
                  fastIds[i],
                  fastIds[j],
                  fastIds[k],
                  fastIds[l],
                  fastIds[m],
                  candidateDuoIds[i],
                  candidateDuoIds[j],
                  candidateDuoIds[k],
                  candidateDuoIds[l],
                  candidateDuoIds[m],
                  candidateUseM2[i] !== 0,
                  candidateUseM2[j] !== 0,
                  candidateUseM2[k] !== 0,
                  candidateUseM2[l] !== 0,
                  candidateUseM2[m] !== 0,
                );
                const primaryRaw =
                  iDamageTable[damageMetricOffset + ((candidateDuoBase[i] !== 0 || (duoMask & 1) !== 0) ? 8 : 0) + iMask] +
                  jDamageTable[damageMetricOffset + ((candidateDuoBase[j] !== 0 || (duoMask & 2) !== 0) ? 8 : 0) + jMask] +
                  kDamageTable[damageMetricOffset + ((candidateDuoBase[k] !== 0 || (duoMask & 4) !== 0) ? 8 : 0) + kMask] +
                  lDamageTable[damageMetricOffset + ((candidateDuoBase[l] !== 0 || (duoMask & 8) !== 0) ? 8 : 0) + lMask] +
                  mDamageTable[damageMetricOffset + ((candidateDuoBase[m] !== 0 || (duoMask & 16) !== 0) ? 8 : 0) + mMask];
                if (metricPrimaryShouldConsider(primaryRaw)) {
                  addMetricPrimaryFastEntry(Math.floor(primaryRaw), 0, nonZero[i], nonZero[j], nonZero[k], nonZero[l], nonZero[m]);
                }
                valid += 1;
              }
            }
          }
        }
      }

      if (!metricPrimaryFastIsSorted) {
        metricPrimaryFastEntries.sort(compareMetricPrimaryFastEntries);
        metricPrimaryFastIsSorted = true;
        updateMetricPrimaryFastThreshold();
      }

      let complete = metricPrimaryFastEntries.length >= metricPrimaryFastMaxSize;
      let outsideUpper = -Infinity;
      if (complete && candidateLimit < lengthes[4]) {
        outsideUpper =
          nonZeroPrimaryUpperScores[0] +
          nonZeroPrimaryUpperScores[1] +
          nonZeroPrimaryUpperScores[2] +
          nonZeroPrimaryUpperScores[3] +
          nonZeroPrimaryUpperScores[candidateLimit];
        complete = outsideUpper < metricPrimaryFastThresholdPrimary;
      }

      if (debugCounters) {
        debugCounters.damagePrimaryPrefixCandidateLimit = candidateLimit;
        debugCounters.damagePrimaryPrefixCandidateChecks = checked;
        debugCounters.damagePrimaryPrefixValid = valid;
        debugCounters.damagePrimaryPrefixOutsideUpper = outsideUpper;
        debugCounters.damagePrimaryPrefixThresholdPrimary = metricPrimaryFastThresholdPrimary;
        debugCounters.damagePrimaryPrefixComplete = complete ? 1 : 0;
      }

      if (complete) {
        nowResultsCount += combinationCount(lengthes[4], 5);
        return true;
      }

      metricPrimaryFastEntries.length = originalEntryCount;
      metricPrimaryFastIsSorted = originalIsSorted;
      updateMetricPrimaryFastThreshold();
      return false;
    };

    if (false && lengthes[4] <= 44 && tryCompleteDamagePrimaryFromPrefix()) {
      return true;
    }

    const runDamagePrimaryBestFirst = async (): Promise<boolean> => {
      if (
        !metricPrimaryFastEntries ||
        metricPrimaryFastMaxSize <= 0 ||
        !nonZeroPrimaryUpperScores ||
        !fastPairBuddyMasks ||
        !fastIds
      ) {
        return false;
      }

      type DamageHeapNode = {
        i: number;
        j: number;
        k: number;
        l: number;
        m: number;
        upper: number;
      };
      const heap: DamageHeapNode[] = [];
      const visited = new Set<number>();
      const packNodeKey = (i: number, j: number, k: number, l: number, m: number): number =>
        (((((i * listLength) + j) * listLength + k) * listLength + l) * listLength + m);
      const heapPush = (node: DamageHeapNode) => {
        let index = heap.length;
        heap.push(node);
        while (index > 0) {
          const parent = (index - 1) >>> 1;
          if (heap[parent].upper >= node.upper) break;
          heap[index] = heap[parent];
          index = parent;
        }
        heap[index] = node;
      };
      const heapPop = (): DamageHeapNode | undefined => {
        const root = heap[0];
        if (root === undefined) return undefined;
        const last = heap.pop()!;
        if (heap.length === 0) return root;
        let index = 0;
        while (true) {
          const left = index * 2 + 1;
          const right = left + 1;
          if (left >= heap.length) break;
          let child = left;
          if (right < heap.length && heap[right].upper > heap[left].upper) child = right;
          if (heap[child].upper <= last.upper) break;
          heap[index] = heap[child];
          index = child;
        }
        heap[index] = last;
        return root;
      };
      const pushCandidateNode = (i: number, j: number, k: number, l: number, m: number) => {
        if (!(i < j && j < k && k < l && l < m && m < lengthes[4])) return;
        const upper =
          nonZeroPrimaryUpperScores[i] +
          nonZeroPrimaryUpperScores[j] +
          nonZeroPrimaryUpperScores[k] +
          nonZeroPrimaryUpperScores[l] +
          nonZeroPrimaryUpperScores[m];
        if (!metricPrimaryShouldConsider(upper)) return;
        const key = packNodeKey(i, j, k, l, m);
        if (visited.has(key)) return;
        visited.add(key);
        heapPush({ i, j, k, l, m, upper });
      };

      const originalEntryCount = metricPrimaryFastEntries.length;
      const originalIsSorted = metricPrimaryFastIsSorted;
      const maxBestFirstChecks = 1000000;
      let checked = 0;
      let valid = 0;
      let completed = false;
      let searchCheckCounter = 0;

      pushCandidateNode(0, 1, 2, 3, 4);
      while (heap.length > 0) {
        const node = heapPop()!;
        if (!metricPrimaryShouldConsider(node.upper)) {
          completed = true;
          break;
        }
        checked += 1;
        searchCheckCounter += 1;
        if ((searchCheckCounter & SEARCH_CHECK_MASK) === 0 && !(await yieldToSearchUi())) return false;
        if (checked > maxBestFirstChecks) break;

        const i = node.i;
        const j = node.j;
        const k = node.k;
        const l = node.l;
        const m = node.m;
        const iBuddyMaskOffset = i * listLength;
        const jBuddyMaskOffset = j * listLength;
        const kBuddyMaskOffset = k * listLength;
        const lBuddyMaskOffset = l * listLength;
        const mBuddyMaskOffset = m * listLength;

        if (
          candidateEvasion[i] + candidateEvasion[j] + candidateEvasion[k] + candidateEvasion[l] + candidateEvasion[m] >= minEvasion &&
          candidateBuff[i] + candidateBuff[j] + candidateBuff[k] + candidateBuff[l] + candidateBuff[m] >= minBuff &&
          candidateDebuff[i] + candidateDebuff[j] + candidateDebuff[k] + candidateDebuff[l] + candidateDebuff[m] >= minDebuff &&
          candidateCosmic[i] + candidateCosmic[j] + candidateCosmic[k] + candidateCosmic[l] + candidateCosmic[m] >= minCosmic &&
          candidateFire[i] + candidateFire[j] + candidateFire[k] + candidateFire[l] + candidateFire[m] >= minFire &&
          candidateWater[i] + candidateWater[j] + candidateWater[k] + candidateWater[l] + candidateWater[m] >= minWater &&
          candidateFlora[i] + candidateFlora[j] + candidateFlora[k] + candidateFlora[l] + candidateFlora[m] >= minFlora &&
          candidateHealCards[i] + candidateHealCards[j] + candidateHealCards[k] + candidateHealCards[l] + candidateHealCards[m] >= minHealNum
        ) {
          const iMask =
            fastPairBuddyMasks[iBuddyMaskOffset + i] |
            fastPairBuddyMasks[iBuddyMaskOffset + j] |
            fastPairBuddyMasks[iBuddyMaskOffset + k] |
            fastPairBuddyMasks[iBuddyMaskOffset + l] |
            fastPairBuddyMasks[iBuddyMaskOffset + m];
          const jMask =
            fastPairBuddyMasks[jBuddyMaskOffset + i] |
            fastPairBuddyMasks[jBuddyMaskOffset + j] |
            fastPairBuddyMasks[jBuddyMaskOffset + k] |
            fastPairBuddyMasks[jBuddyMaskOffset + l] |
            fastPairBuddyMasks[jBuddyMaskOffset + m];
          const kMask =
            fastPairBuddyMasks[kBuddyMaskOffset + i] |
            fastPairBuddyMasks[kBuddyMaskOffset + j] |
            fastPairBuddyMasks[kBuddyMaskOffset + k] |
            fastPairBuddyMasks[kBuddyMaskOffset + l] |
            fastPairBuddyMasks[kBuddyMaskOffset + m];
          const lMask =
            fastPairBuddyMasks[lBuddyMaskOffset + i] |
            fastPairBuddyMasks[lBuddyMaskOffset + j] |
            fastPairBuddyMasks[lBuddyMaskOffset + k] |
            fastPairBuddyMasks[lBuddyMaskOffset + l] |
            fastPairBuddyMasks[lBuddyMaskOffset + m];
          const mMask =
            fastPairBuddyMasks[mBuddyMaskOffset + i] |
            fastPairBuddyMasks[mBuddyMaskOffset + j] |
            fastPairBuddyMasks[mBuddyMaskOffset + k] |
            fastPairBuddyMasks[mBuddyMaskOffset + l] |
            fastPairBuddyMasks[mBuddyMaskOffset + m];

          let hp = 0;
          if (needsDamageHpCheck) {
            hp =
              fastHpTables![i][iMask] +
              fastHpTables![j][jMask] +
              fastHpTables![k][kMask] +
              fastHpTables![l][lMask] +
              fastHpTables![m][mMask];
          }
          if (
            !needsDamageHpCheck ||
            (
              hp >= minHP &&
              (
                minEHP <= 0 ||
                hp +
                  fastHealTables![i][iMask] +
                  fastHealTables![j][jMask] +
                  fastHealTables![k][kMask] +
                  fastHealTables![l][lMask] +
                  fastHealTables![m][mMask] >= minEHP
              )
            )
          ) {
            const iDamageTable = candidateDamageTables[i];
            const jDamageTable = candidateDamageTables[j];
            const kDamageTable = candidateDamageTables[k];
            const lDamageTable = candidateDamageTables[l];
            const mDamageTable = candidateDamageTables[m];
            const duoUpperScore =
              iDamageTable[damageMetricOffset + 8 + iMask] +
              jDamageTable[damageMetricOffset + 8 + jMask] +
              kDamageTable[damageMetricOffset + 8 + kMask] +
              lDamageTable[damageMetricOffset + 8 + lMask] +
              mDamageTable[damageMetricOffset + 8 + mMask];
            if (metricPrimaryShouldConsider(duoUpperScore)) {
              const duoMask = resolveFixedFiveDuoMaskFromIds(
                fastIds[i],
                fastIds[j],
                fastIds[k],
                fastIds[l],
                fastIds[m],
                candidateDuoIds[i],
                candidateDuoIds[j],
                candidateDuoIds[k],
                candidateDuoIds[l],
                candidateDuoIds[m],
                candidateUseM2[i] !== 0,
                candidateUseM2[j] !== 0,
                candidateUseM2[k] !== 0,
                candidateUseM2[l] !== 0,
                candidateUseM2[m] !== 0,
              );
              const primaryRaw =
                iDamageTable[damageMetricOffset + ((candidateDuoBase[i] !== 0 || (duoMask & 1) !== 0) ? 8 : 0) + iMask] +
                jDamageTable[damageMetricOffset + ((candidateDuoBase[j] !== 0 || (duoMask & 2) !== 0) ? 8 : 0) + jMask] +
                kDamageTable[damageMetricOffset + ((candidateDuoBase[k] !== 0 || (duoMask & 4) !== 0) ? 8 : 0) + kMask] +
                lDamageTable[damageMetricOffset + ((candidateDuoBase[l] !== 0 || (duoMask & 8) !== 0) ? 8 : 0) + lMask] +
                mDamageTable[damageMetricOffset + ((candidateDuoBase[m] !== 0 || (duoMask & 16) !== 0) ? 8 : 0) + mMask];
              if (metricPrimaryShouldConsider(primaryRaw)) {
                addMetricPrimaryFastEntry(Math.floor(primaryRaw), 0, nonZero[i], nonZero[j], nonZero[k], nonZero[l], nonZero[m]);
              }
              valid += 1;
            }
          }
        }

        pushCandidateNode(i + 1, j, k, l, m);
        pushCandidateNode(i, j + 1, k, l, m);
        pushCandidateNode(i, j, k + 1, l, m);
        pushCandidateNode(i, j, k, l + 1, m);
        pushCandidateNode(i, j, k, l, m + 1);
      }

      if (heap.length === 0) completed = true;
      if (debugCounters) {
        debugCounters.damagePrimaryBestFirstChecks = checked;
        debugCounters.damagePrimaryBestFirstValid = valid;
        debugCounters.damagePrimaryBestFirstVisited = visited.size;
        debugCounters.damagePrimaryBestFirstCompleted = completed ? 1 : 0;
      }
      if (completed) {
        nowResultsCount += combinationCount(lengthes[4], 5);
        return true;
      }

      metricPrimaryFastEntries.length = originalEntryCount;
      metricPrimaryFastIsSorted = originalIsSorted;
      updateMetricPrimaryFastThreshold();
      return false;
    };

    const enableDamagePrimaryBestFirst = false;
    if (enableDamagePrimaryBestFirst && await runDamagePrimaryBestFirst()) {
      return true;
    }

    let searchCheckCounter = 0;
    for (let i = 0; i < lengthes[0]; i++) {
      const iBuddyMaskOffset = i * listLength;
      const iId = fastIds![i];
      const iDuoId = candidateDuoIds[i];
      const iSelfMask = fastPairBuddyMasks![iBuddyMaskOffset + i];
      const iSingleAux = damagePrimarySingleAuxScores ? damagePrimarySingleAuxScores[i] : 0;
      const iEvasion = hasDamagePrimaryMultiAuxRequirements ? candidateEvasion[i] : 0;
      const iBuff = hasDamagePrimaryMultiAuxRequirements ? candidateBuff[i] : 0;
      const iDebuff = hasDamagePrimaryMultiAuxRequirements ? candidateDebuff[i] : 0;
      const iCosmic = hasDamagePrimaryMultiAuxRequirements ? candidateCosmic[i] : 0;
      const iFire = hasDamagePrimaryMultiAuxRequirements ? candidateFire[i] : 0;
      const iWater = hasDamagePrimaryMultiAuxRequirements ? candidateWater[i] : 0;
      const iFlora = hasDamagePrimaryMultiAuxRequirements ? candidateFlora[i] : 0;
      const iHealCards = hasDamagePrimaryMultiAuxRequirements ? candidateHealCards[i] : 0;
      if (canUseFixedPrefixNoSameEarlyPrune) {
        const branchUpper =
          getNoSameDamageReachableUpper(i, iSelfMask, false, i + 1, 4) +
          primaryUpperSuffixTopSums![4][i + 1];
        if (!metricPrimaryShouldConsider(branchUpper)) {
          nowResultsCount += combinationCount(lengthes[4] - i - 1, 4);
          continue;
        }
        if (damagePrimarySingleAuxScores && !damagePrimarySingleAuxCouldPass(iSingleAux, i + 1, 4)) {
          incrementDebugCounter('damagePrimaryAuxBranchSkip', combinationCount(lengthes[4] - i - 1, 4));
          nowResultsCount += combinationCount(lengthes[4] - i - 1, 4);
          continue;
        }
        if (hasDamagePrimaryMultiAuxRequirements && !damagePrimaryAuxCouldPass(iEvasion, iBuff, iDebuff, iCosmic, iFire, iWater, iFlora, iHealCards, i + 1, 4)) {
          incrementDebugCounter('damagePrimaryAuxBranchSkip', combinationCount(lengthes[4] - i - 1, 4));
          nowResultsCount += combinationCount(lengthes[4] - i - 1, 4);
          continue;
        }
      }
      for (let j = i + 1; j < lengthes[1]; j++) {
        const jBuddyMaskOffset = j * listLength;
        const jId = fastIds![j];
        const jDuoId = candidateDuoIds[j];
        const iDuoIJ = jId === iDuoId;
        const jDuoIJ = iId === jDuoId;
        const iBaseIJ = iSelfMask | fastPairBuddyMasks![iBuddyMaskOffset + j];
        const jBaseIJ = fastPairBuddyMasks![jBuddyMaskOffset + i] | fastPairBuddyMasks![jBuddyMaskOffset + j];
        const ijSingleAux = damagePrimarySingleAuxScores ? iSingleAux + damagePrimarySingleAuxScores[j] : 0;
        const ijEvasion = hasDamagePrimaryMultiAuxRequirements ? iEvasion + candidateEvasion[j] : 0;
        const ijBuff = hasDamagePrimaryMultiAuxRequirements ? iBuff + candidateBuff[j] : 0;
        const ijDebuff = hasDamagePrimaryMultiAuxRequirements ? iDebuff + candidateDebuff[j] : 0;
        const ijCosmic = hasDamagePrimaryMultiAuxRequirements ? iCosmic + candidateCosmic[j] : 0;
        const ijFire = hasDamagePrimaryMultiAuxRequirements ? iFire + candidateFire[j] : 0;
        const ijWater = hasDamagePrimaryMultiAuxRequirements ? iWater + candidateWater[j] : 0;
        const ijFlora = hasDamagePrimaryMultiAuxRequirements ? iFlora + candidateFlora[j] : 0;
        const ijHealCards = hasDamagePrimaryMultiAuxRequirements ? iHealCards + candidateHealCards[j] : 0;
        if (canUseFixedPrefixNoSameEarlyPrune) {
          const branchUpper =
            getNoSameDamageReachableUpper(i, iBaseIJ, iDuoIJ, j + 1, 3) +
            getNoSameDamageReachableUpper(j, jBaseIJ, jDuoIJ, j + 1, 3) +
            primaryUpperSuffixTopSums![3][j + 1];
          if (!metricPrimaryShouldConsider(branchUpper)) {
            nowResultsCount += combinationCount(lengthes[4] - j - 1, 3);
            continue;
          }
          if (damagePrimarySingleAuxScores && !damagePrimarySingleAuxCouldPass(ijSingleAux, j + 1, 3)) {
            incrementDebugCounter('damagePrimaryAuxBranchSkip', combinationCount(lengthes[4] - j - 1, 3));
            nowResultsCount += combinationCount(lengthes[4] - j - 1, 3);
            continue;
          }
          if (hasDamagePrimaryMultiAuxRequirements && !damagePrimaryAuxCouldPass(ijEvasion, ijBuff, ijDebuff, ijCosmic, ijFire, ijWater, ijFlora, ijHealCards, j + 1, 3)) {
            incrementDebugCounter('damagePrimaryAuxBranchSkip', combinationCount(lengthes[4] - j - 1, 3));
            nowResultsCount += combinationCount(lengthes[4] - j - 1, 3);
            continue;
          }
        }
        for (let k = j + 1; k < lengthes[2]; k++) {
          const kBuddyMaskOffset = k * listLength;
          const kId = fastIds![k];
          const kDuoId = candidateDuoIds[k];
          const iDuoIJK = iDuoIJ || kId === iDuoId;
          const jDuoIJK = jDuoIJ || kId === jDuoId;
          const kDuoIJK = iId === kDuoId || jId === kDuoId;
          const iBaseIJK = iBaseIJ | fastPairBuddyMasks![iBuddyMaskOffset + k];
          const jBaseIJK = jBaseIJ | fastPairBuddyMasks![jBuddyMaskOffset + k];
          const kBaseIJK =
            fastPairBuddyMasks![kBuddyMaskOffset + i] |
            fastPairBuddyMasks![kBuddyMaskOffset + j] |
            fastPairBuddyMasks![kBuddyMaskOffset + k];
          const ijkSingleAux = damagePrimarySingleAuxScores ? ijSingleAux + damagePrimarySingleAuxScores[k] : 0;
          const ijkEvasion = hasDamagePrimaryMultiAuxRequirements ? ijEvasion + candidateEvasion[k] : 0;
          const ijkBuff = hasDamagePrimaryMultiAuxRequirements ? ijBuff + candidateBuff[k] : 0;
          const ijkDebuff = hasDamagePrimaryMultiAuxRequirements ? ijDebuff + candidateDebuff[k] : 0;
          const ijkCosmic = hasDamagePrimaryMultiAuxRequirements ? ijCosmic + candidateCosmic[k] : 0;
          const ijkFire = hasDamagePrimaryMultiAuxRequirements ? ijFire + candidateFire[k] : 0;
          const ijkWater = hasDamagePrimaryMultiAuxRequirements ? ijWater + candidateWater[k] : 0;
          const ijkFlora = hasDamagePrimaryMultiAuxRequirements ? ijFlora + candidateFlora[k] : 0;
          const ijkHealCards = hasDamagePrimaryMultiAuxRequirements ? ijHealCards + candidateHealCards[k] : 0;
          if (canUseFixedPrefixNoSameEarlyPrune) {
            const branchUpper =
              getNoSameDamageReachableUpper(i, iBaseIJK, iDuoIJK, k + 1, 2) +
              getNoSameDamageReachableUpper(j, jBaseIJK, jDuoIJK, k + 1, 2) +
              getNoSameDamageReachableUpper(k, kBaseIJK, kDuoIJK, k + 1, 2) +
              primaryUpperSuffixTopSums![2][k + 1];
            if (!metricPrimaryShouldConsider(branchUpper)) {
              nowResultsCount += combinationCount(lengthes[4] - k - 1, 2);
              continue;
            }
            if (damagePrimarySingleAuxScores && !damagePrimarySingleAuxCouldPass(ijkSingleAux, k + 1, 2)) {
              incrementDebugCounter('damagePrimaryAuxBranchSkip', combinationCount(lengthes[4] - k - 1, 2));
              nowResultsCount += combinationCount(lengthes[4] - k - 1, 2);
              continue;
            }
            if (hasDamagePrimaryMultiAuxRequirements && !damagePrimaryAuxCouldPass(ijkEvasion, ijkBuff, ijkDebuff, ijkCosmic, ijkFire, ijkWater, ijkFlora, ijkHealCards, k + 1, 2)) {
              incrementDebugCounter('damagePrimaryAuxBranchSkip', combinationCount(lengthes[4] - k - 1, 2));
              nowResultsCount += combinationCount(lengthes[4] - k - 1, 2);
              continue;
            }
          }
          for (let l = k + 1; l < lengthes[3]; l++) {
            searchCheckCounter += 1;
            if ((searchCheckCounter & SEARCH_CHECK_MASK) === 0 && !(await yieldToSearchUi())) return false;

            const mStart = l + 1;
            const seededSkipEnd = l < damagePrimarySeededCandidateLimit
              ? Math.min(lengthes[4], damagePrimarySeededCandidateLimit)
              : mStart;
            if (seededSkipEnd > mStart) {
              nowResultsCount += seededSkipEnd - mStart;
            }
            const effectiveMStart = seededSkipEnd > mStart ? seededSkipEnd : mStart;
            const remainingCount = lengthes[4] - effectiveMStart;
            if (remainingCount <= 0) continue;
            const lBuddyMaskOffset = l * listLength;
            const lId = fastIds![l];
            const lDuoId = candidateDuoIds[l];
            const iDuoPrefix = iDuoIJK || lId === iDuoId;
            const jDuoPrefix = jDuoIJK || lId === jDuoId;
            const kDuoPrefix = kDuoIJK || lId === kDuoId;
            const lDuoPrefix = iId === lDuoId || jId === lDuoId || kId === lDuoId;
            const prefixSingleAux = damagePrimarySingleAuxScores ? ijkSingleAux + damagePrimarySingleAuxScores[l] : 0;
            const prefixEvasion = hasDamagePrimaryMultiAuxRequirements ? ijkEvasion + candidateEvasion[l] : 0;
            const prefixBuff = hasDamagePrimaryMultiAuxRequirements ? ijkBuff + candidateBuff[l] : 0;
            const prefixDebuff = hasDamagePrimaryMultiAuxRequirements ? ijkDebuff + candidateDebuff[l] : 0;
            const prefixCosmic = hasDamagePrimaryMultiAuxRequirements ? ijkCosmic + candidateCosmic[l] : 0;
            const prefixFire = hasDamagePrimaryMultiAuxRequirements ? ijkFire + candidateFire[l] : 0;
            const prefixWater = hasDamagePrimaryMultiAuxRequirements ? ijkWater + candidateWater[l] : 0;
            const prefixFlora = hasDamagePrimaryMultiAuxRequirements ? ijkFlora + candidateFlora[l] : 0;
            const prefixHealCards = hasDamagePrimaryMultiAuxRequirements ? ijkHealCards + candidateHealCards[l] : 0;
            const iBaseMask =
              iBaseIJK |
              fastPairBuddyMasks![iBuddyMaskOffset + l];
            const jBaseMask =
              jBaseIJK |
              fastPairBuddyMasks![jBuddyMaskOffset + l];
            const kBaseMask =
              kBaseIJK |
              fastPairBuddyMasks![kBuddyMaskOffset + l];
            const lBaseMask =
              fastPairBuddyMasks![lBuddyMaskOffset + i] |
              fastPairBuddyMasks![lBuddyMaskOffset + j] |
              fastPairBuddyMasks![lBuddyMaskOffset + k] |
              fastPairBuddyMasks![lBuddyMaskOffset + l];
            let branchUpper = Infinity;
            if (canUseDamagePrimaryOrderPrune) {
              branchUpper =
                getNoSameDamageOnePickReachableUpper(i, iBaseMask, iDuoPrefix, effectiveMStart) +
                getNoSameDamageOnePickReachableUpper(j, jBaseMask, jDuoPrefix, effectiveMStart) +
                getNoSameDamageOnePickReachableUpper(k, kBaseMask, kDuoPrefix, effectiveMStart) +
                getNoSameDamageOnePickReachableUpper(l, lBaseMask, lDuoPrefix, effectiveMStart) +
                nonZeroPrimaryUpperSuffixMax![effectiveMStart];
              if (!metricPrimaryShouldConsider(branchUpper)) {
                incrementDebugCounter('damagePrimaryMainPrefixSkip', remainingCount);
                nowResultsCount += remainingCount;
                continue;
              }
            }
            if (damagePrimarySingleAuxScores && !damagePrimarySingleAuxCouldPass(prefixSingleAux, effectiveMStart, 1)) {
              incrementDebugCounter('damagePrimaryAuxBranchSkip', remainingCount);
              nowResultsCount += remainingCount;
              continue;
            }
            if (hasDamagePrimaryMultiAuxRequirements && !damagePrimaryAuxCouldPass(prefixEvasion, prefixBuff, prefixDebuff, prefixCosmic, prefixFire, prefixWater, prefixFlora, prefixHealCards, effectiveMStart, 1)) {
              incrementDebugCounter('damagePrimaryAuxBranchSkip', remainingCount);
              nowResultsCount += remainingCount;
              continue;
            }
            let requiredMSingleAux = 0;
            let requiredMEvasion = 0;
            let requiredMBuff = 0;
            let requiredMDebuff = 0;
            let requiredMCosmic = 0;
            let requiredMFire = 0;
            let requiredMWater = 0;
            let requiredMFlora = 0;
            let requiredMHealNum = 0;
            if (damagePrimarySingleCandidateJumpEnabled) {
              if (damagePrimarySingleAuxNextAtLeast) {
                requiredMSingleAux = damagePrimarySingleAuxMinimum > prefixSingleAux
                  ? Math.ceil(damagePrimarySingleAuxMinimum - prefixSingleAux)
                  : 0;
              } else {
                requiredMEvasion = minEvasion > prefixEvasion ? Math.ceil(minEvasion - prefixEvasion) : 0;
                requiredMBuff = minBuff > prefixBuff ? Math.ceil(minBuff - prefixBuff) : 0;
                requiredMDebuff = minDebuff > prefixDebuff ? Math.ceil(minDebuff - prefixDebuff) : 0;
                requiredMCosmic = minCosmic > prefixCosmic ? Math.ceil(minCosmic - prefixCosmic) : 0;
                requiredMFire = minFire > prefixFire ? Math.ceil(minFire - prefixFire) : 0;
                requiredMWater = minWater > prefixWater ? Math.ceil(minWater - prefixWater) : 0;
                requiredMFlora = minFlora > prefixFlora ? Math.ceil(minFlora - prefixFlora) : 0;
                requiredMHealNum = minHealNum > prefixHealCards ? Math.ceil(minHealNum - prefixHealCards) : 0;
              }
            }

            for (let m = effectiveMStart; m < lengthes[4]; m++) {
              if (damagePrimarySingleCandidateJumpEnabled) {
                let nextM = m;
                while (nextM < lengthes[4]) {
                  const before = nextM;
                  if (requiredMSingleAux > 0 && damagePrimarySingleAuxNextAtLeast) nextM = damagePrimarySingleAuxNextAtLeast[requiredMSingleAux][nextM];
                  if (requiredMEvasion > 0 && damagePrimaryEvasionNextAtLeast) nextM = damagePrimaryEvasionNextAtLeast[requiredMEvasion][nextM];
                  if (requiredMBuff > 0 && damagePrimaryBuffNextAtLeast) nextM = damagePrimaryBuffNextAtLeast[requiredMBuff][nextM];
                  if (requiredMDebuff > 0 && damagePrimaryDebuffNextAtLeast) nextM = damagePrimaryDebuffNextAtLeast[requiredMDebuff][nextM];
                  if (requiredMCosmic > 0 && damagePrimaryCosmicNextAtLeast) nextM = damagePrimaryCosmicNextAtLeast[requiredMCosmic][nextM];
                  if (requiredMFire > 0 && damagePrimaryFireNextAtLeast) nextM = damagePrimaryFireNextAtLeast[requiredMFire][nextM];
                  if (requiredMWater > 0 && damagePrimaryWaterNextAtLeast) nextM = damagePrimaryWaterNextAtLeast[requiredMWater][nextM];
                  if (requiredMFlora > 0 && damagePrimaryFloraNextAtLeast) nextM = damagePrimaryFloraNextAtLeast[requiredMFlora][nextM];
                  if (requiredMHealNum > 0 && damagePrimaryHealNumNextAtLeast) nextM = damagePrimaryHealNumNextAtLeast[requiredMHealNum][nextM];
                  if (nextM === before) break;
                }
                if (nextM !== m) {
                  incrementDebugCounter('damagePrimaryAuxSingleJumpSkip', nextM - m);
                  nowResultsCount += nextM - m;
                  if (nextM >= lengthes[4]) break;
                  m = nextM;
                }
              }
              if (canUseDamagePrimaryOrderPrune) {
                branchUpper =
                  getNoSameDamageOnePickReachableUpper(i, iBaseMask, iDuoPrefix, m) +
                  getNoSameDamageOnePickReachableUpper(j, jBaseMask, jDuoPrefix, m) +
                  getNoSameDamageOnePickReachableUpper(k, kBaseMask, kDuoPrefix, m) +
                  getNoSameDamageOnePickReachableUpper(l, lBaseMask, lDuoPrefix, m) +
                  nonZeroPrimaryUpperSuffixMax![m];
                if (!metricPrimaryShouldConsider(branchUpper)) {
                  incrementDebugCounter('damagePrimaryMainSuffixBreak', lengthes[4] - m);
                  nowResultsCount += lengthes[4] - m;
                  break;
                }
              }
              if (shouldUsePrimaryUpperBound) {
                const exactUpperScore =
                  nonZeroPrimaryUpperScores![i] +
                  nonZeroPrimaryUpperScores![j] +
                  nonZeroPrimaryUpperScores![k] +
                  nonZeroPrimaryUpperScores![l] +
                  nonZeroPrimaryUpperScores![m];
                if (!metricPrimaryShouldConsider(exactUpperScore)) {
                  if (canUseDamagePrimaryOrderPrune) {
                    nowResultsCount += lengthes[4] - m;
                    break;
                  }
                  nowResultsCount += 1;
                  continue;
                }
              }

              if (damagePrimarySingleAuxScores) {
                if (prefixSingleAux + damagePrimarySingleAuxScores[m] < damagePrimarySingleAuxMinimum) {
                  nowResultsCount += 1;
                  continue;
                }
              } else if (hasDamagePrimaryMultiAuxRequirements) {
                let auxPass = true;
                auxPass = !(
                  prefixEvasion + candidateEvasion[m] < minEvasion ||
                  prefixBuff + candidateBuff[m] < minBuff ||
                  prefixDebuff + candidateDebuff[m] < minDebuff ||
                  prefixCosmic + candidateCosmic[m] < minCosmic ||
                  prefixFire + candidateFire[m] < minFire ||
                  prefixWater + candidateWater[m] < minWater ||
                  prefixFlora + candidateFlora[m] < minFlora ||
                  prefixHealCards + candidateHealCards[m] < minHealNum
                );
                if (!auxPass) {
                  nowResultsCount += 1;
                  continue;
                }
              }

              const mId = fastIds![m];
              const mDuoId = candidateDuoIds[m];
              const mBuddyMaskOffset = m * listLength;
              const iMask = iBaseMask | fastPairBuddyMasks![iBuddyMaskOffset + m];
              const jMask = jBaseMask | fastPairBuddyMasks![jBuddyMaskOffset + m];
              const kMask = kBaseMask | fastPairBuddyMasks![kBuddyMaskOffset + m];
              const lMask = lBaseMask | fastPairBuddyMasks![lBuddyMaskOffset + m];
              const mMask =
                fastPairBuddyMasks![mBuddyMaskOffset + i] |
                fastPairBuddyMasks![mBuddyMaskOffset + j] |
                fastPairBuddyMasks![mBuddyMaskOffset + k] |
                fastPairBuddyMasks![mBuddyMaskOffset + l] |
                fastPairBuddyMasks![mBuddyMaskOffset + m];

              if (needsDamageHpCheck) {
                const hp =
                  fastHpTables![i][iMask] +
                  fastHpTables![j][jMask] +
                  fastHpTables![k][kMask] +
                  fastHpTables![l][lMask] +
                  fastHpTables![m][mMask];
                if (hp < minHP) {
                  nowResultsCount += 1;
                  continue;
                }
                if (
                  minEHP > 0 &&
                  hp +
                    fastHealTables![i][iMask] +
                    fastHealTables![j][jMask] +
                    fastHealTables![k][kMask] +
                    fastHealTables![l][lMask] +
                    fastHealTables![m][mMask] < minEHP
                ) {
                  nowResultsCount += 1;
                  continue;
                }
              }

              const iDamageTable = candidateDamageTables[i];
              const jDamageTable = candidateDamageTables[j];
              const kDamageTable = candidateDamageTables[k];
              const lDamageTable = candidateDamageTables[l];
              const mDamageTable = candidateDamageTables[m];
              const iUpperDuoOffset = (candidateDuoBase[i] !== 0 || (candidateUseM2[i] !== 0 && (iDuoPrefix || mId === iDuoId))) ? 8 : 0;
              const jUpperDuoOffset = (candidateDuoBase[j] !== 0 || (candidateUseM2[j] !== 0 && (jDuoPrefix || mId === jDuoId))) ? 8 : 0;
              const kUpperDuoOffset = (candidateDuoBase[k] !== 0 || (candidateUseM2[k] !== 0 && (kDuoPrefix || mId === kDuoId))) ? 8 : 0;
              const lUpperDuoOffset = (candidateDuoBase[l] !== 0 || (candidateUseM2[l] !== 0 && (lDuoPrefix || mId === lDuoId))) ? 8 : 0;
              const mUpperDuoOffset = (candidateDuoBase[m] !== 0 || (candidateUseM2[m] !== 0 && (
                iId === mDuoId ||
                jId === mDuoId ||
                kId === mDuoId ||
                lId === mDuoId
              ))) ? 8 : 0;
              const duoUpperScore =
                iDamageTable[damageMetricOffset + iUpperDuoOffset + iMask] +
                jDamageTable[damageMetricOffset + jUpperDuoOffset + jMask] +
                kDamageTable[damageMetricOffset + kUpperDuoOffset + kMask] +
                lDamageTable[damageMetricOffset + lUpperDuoOffset + lMask] +
                mDamageTable[damageMetricOffset + mUpperDuoOffset + mMask];
              if (!metricPrimaryShouldConsider(duoUpperScore)) {
                incrementDebugCounter('damagePrimaryMainDuoUpperSkip');
                nowResultsCount += 1;
                continue;
              }

              incrementDebugCounter('damagePrimaryMainExactChecks');
              addLegacyOrderedDamagePrimaryEntry(i, j, k, l, m, iMask, jMask, kMask, lMask, mMask);
              nowResultsCount += 1;
            }
          }
        }
      }
    }
    return true;
  };

  const runFixedTwoDamagePrimaryFastLoop = async (lengthes: number[]): Promise<boolean> => {
    const pairMasks = fastPairBuddyMasks!;
    const ids = fastIds!;
    const duoIds = fastDuoIds!;
    const useM2 = fastUseM2!;
    const duoBaseOffsets = fastDuoBaseOffsets!;
    const metricOffset = getDamageMetricTableIndex(primaryDamageUpperMetric) << 4;
    const damageTables = new Array<Float64Array>(listLength);
    const safeDamageUpperByMask = new Float64Array(listLength * 8);
    for (let index = 0; index < listLength; index++) {
      const table = (nonZero[index] as any).primaryDamageTop2ByMaskCached as Float64Array;
      damageTables[index] = table;
      const base = index << 3;
      for (let mask = 0; mask < 8; mask++) {
        const normal = table[metricOffset + mask];
        const duo = table[metricOffset + 8 + mask];
        safeDamageUpperByMask[base + mask] = duo > normal ? duo : normal;
      }
    }

    const minHP = snapshot.minHP;
    const minEHP = snapshot.minEHP;
    const needsHpCheck = minHP > 0 || minEHP > 0;
    const minEvasion = snapshot.minEvasion;
    const minBuff = snapshot.minBuff;
    const minDebuff = snapshot.minDebuff;
    const minCosmic = snapshot.minCosmic;
    const minFire = snapshot.minFire;
    const minWater = snapshot.minWater;
    const minFlora = snapshot.minFlora;
    const minHealNum = snapshot.minHealNum;
    const auxRequirementCount =
      (minEvasion > 0 ? 1 : 0) +
      (minBuff > 0 ? 1 : 0) +
      (minDebuff > 0 ? 1 : 0) +
      (minCosmic > 0 ? 1 : 0) +
      (minFire > 0 ? 1 : 0) +
      (minWater > 0 ? 1 : 0) +
      (minFlora > 0 ? 1 : 0) +
      (minHealNum > 0 ? 1 : 0);
    const hasAuxRequirements =
      minEvasion > 0 ||
      minBuff > 0 ||
      minDebuff > 0 ||
      minCosmic > 0 ||
      minFire > 0 ||
      minWater > 0 ||
      minFlora > 0 ||
      minHealNum > 0;
    const hasMultiAuxRequirements = auxRequirementCount > 1;
    const fixed0Any = nonZero[0] as any;
    const fixed1Any = nonZero[1] as any;
    const fixedEvasion = nonZero[0].evasion + nonZero[1].evasion;
    const fixedBuff = ((fixed0Any.totalBuffCached as number) ?? 0) + ((fixed1Any.totalBuffCached as number) ?? 0);
    const fixedDebuff = ((fixed0Any.totalDebuffCached as number) ?? 0) + ((fixed1Any.totalDebuffCached as number) ?? 0);
    const fixedCosmic = ((fixed0Any.magicCosmicCountCached as number) ?? 0) + ((fixed1Any.magicCosmicCountCached as number) ?? 0);
    const fixedFire = ((fixed0Any.magicFireCountCached as number) ?? 0) + ((fixed1Any.magicFireCountCached as number) ?? 0);
    const fixedWater = ((fixed0Any.magicWaterCountCached as number) ?? 0) + ((fixed1Any.magicWaterCountCached as number) ?? 0);
    const fixedFlora = ((fixed0Any.magicFloraCountCached as number) ?? 0) + ((fixed1Any.magicFloraCountCached as number) ?? 0);
    const fixedHealNum = ((fixed0Any.healCardCountCached as number) ?? 0) + ((fixed1Any.healCardCountCached as number) ?? 0);
    const fixed0Row = 0;
    const fixed1Row = listLength;
    const fixed0BaseMask = pairMasks[fixed0Row] | pairMasks[fixed0Row + 1];
    const fixed1BaseMask = pairMasks[fixed1Row] | pairMasks[fixed1Row + 1];
    const fixedUpper = nonZeroPrimaryUpperScores![0] + nonZeroPrimaryUpperScores![1];
    const fixed0Id = ids[0];
    const fixed1Id = ids[1];
    const fixed0DuoId = duoIds[0];
    const fixed1DuoId = duoIds[1];
    const fixed0UseM2 = useM2[0] !== 0;
    const fixed1UseM2 = useM2[1] !== 0;
    const fixed0DuoBase = duoBaseOffsets[0] !== 0;
    const fixed1DuoBase = duoBaseOffsets[1] !== 0;
    const fixed0DamageTable = damageTables[0];
    const fixed1DamageTable = damageTables[1];
    const singleAuxScores = auxRequirementCount === 1 ? new Float64Array(listLength) : null;
    const singleAuxMinimum =
      !singleAuxScores
        ? 0
        : minEvasion > 0
          ? minEvasion
          : minBuff > 0
            ? minBuff
            : minDebuff > 0
              ? minDebuff
              : minCosmic > 0
                ? minCosmic
                : minFire > 0
                  ? minFire
                  : minWater > 0
                    ? minWater
                    : minFlora > 0
                      ? minFlora
                      : minHealNum;
    let fixedSingleAux = 0;
    if (singleAuxScores) {
      fixedSingleAux =
        minEvasion > 0
          ? fixedEvasion
          : minBuff > 0
            ? fixedBuff
            : minDebuff > 0
              ? fixedDebuff
              : minCosmic > 0
                ? fixedCosmic
                : minFire > 0
                  ? fixedFire
                  : minWater > 0
                    ? fixedWater
                    : minFlora > 0
                      ? fixedFlora
                      : fixedHealNum;
      for (let index = 0; index < listLength; index++) {
        const chara = nonZero[index];
        const charaAny = chara as any;
        singleAuxScores[index] =
          minEvasion > 0
            ? chara.evasion
            : minBuff > 0
              ? ((charaAny.totalBuffCached as number) ?? 0)
              : minDebuff > 0
                ? ((charaAny.totalDebuffCached as number) ?? 0)
                : minCosmic > 0
                  ? ((charaAny.magicCosmicCountCached as number) ?? 0)
                  : minFire > 0
                    ? ((charaAny.magicFireCountCached as number) ?? 0)
                    : minWater > 0
                      ? ((charaAny.magicWaterCountCached as number) ?? 0)
                      : minFlora > 0
                        ? ((charaAny.magicFloraCountCached as number) ?? 0)
                        : ((charaAny.healCardCountCached as number) ?? 0);
      }
    }
    const singleAuxSuffixTopSums = singleAuxScores ? buildSuffixTopSums(singleAuxScores, 2) : null;
    const fixedTwoPrimaryUpperSuffixTopSums =
      fastDamageReachableMasks && nonZeroPrimaryUpperScores
        ? buildSuffixTopSums(nonZeroPrimaryUpperScores, 2)
        : null;
    const canUseFixedTwoReachablePrune =
      fixedTwoPrimaryUpperSuffixTopSums !== null &&
      fastDamageOnePickReachableUpper !== null &&
      fastDamageReachableMasks !== null &&
      fastDamageReachableScoreByBits !== null &&
      fastDamageDuoTargetSuffixNext !== null &&
      nonZeroPrimaryUpperSuffixMax !== null;
    const canUseFixedTwoSeededTop = true;
    let fixedTwoSeededCandidateFlags: Uint8Array | null = null;

    const preseedFixedTwoDamagePrimaryThreshold = () => {
      if (
        !metricPrimaryFastEntries ||
        metricPrimaryFastMaxSize <= 0 ||
        !nonZeroPrimaryUpperScores ||
        lengthes[4] - 2 < 3
      ) {
        return;
      }

      const remainingCount = lengthes[4] - 2;
      let seedCount = 3;
      while (seedCount < remainingCount && combinationCount(seedCount, 3) < metricPrimaryFastMaxSize) {
        seedCount += 1;
      }
      if (combinationCount(seedCount, 3) < metricPrimaryFastMaxSize) return;

      const order = new Int32Array(remainingCount);
      for (let index = 0; index < remainingCount; index++) order[index] = index + 2;
      order.sort((a, b) => {
        const diff = nonZeroPrimaryUpperScores[b] - nonZeroPrimaryUpperScores[a];
        if (diff !== 0) return diff;
        return a - b;
      });

      const seedScores: number[] = [];
      let checked = 0;
      let valid = 0;
      const addSeedScore = (score: number) => {
        seedScores.push(score);
        valid += 1;
      };

      for (let ai = 0; ai < seedCount - 2; ai++) {
        const a = order[ai];
        for (let bi = ai + 1; bi < seedCount - 1; bi++) {
          const b = order[bi];
          for (let ci = bi + 1; ci < seedCount; ci++) {
            const c = order[ci];
            checked += 1;
            let s2 = a;
            let s3 = b;
            let s4 = c;
            if (s3 < s2) {
              const tmp = s2;
              s2 = s3;
              s3 = tmp;
            }
            if (s4 < s3) {
              const tmp = s3;
              s3 = s4;
              s4 = tmp;
              if (s3 < s2) {
                const tmp2 = s2;
                s2 = s3;
                s3 = tmp2;
              }
            }

            const s2Row = s2 * listLength;
            const s3Row = s3 * listLength;
            const s4Row = s4 * listLength;
            const fixed0Mask = fixed0BaseMask | pairMasks[fixed0Row + s2] | pairMasks[fixed0Row + s3] | pairMasks[fixed0Row + s4];
            const fixed1Mask = fixed1BaseMask | pairMasks[fixed1Row + s2] | pairMasks[fixed1Row + s3] | pairMasks[fixed1Row + s4];
            const s2Mask =
              pairMasks[s2Row] |
              pairMasks[s2Row + 1] |
              pairMasks[s2Row + s2] |
              pairMasks[s2Row + s3] |
              pairMasks[s2Row + s4];
            const s3Mask =
              pairMasks[s3Row] |
              pairMasks[s3Row + 1] |
              pairMasks[s3Row + s2] |
              pairMasks[s3Row + s3] |
              pairMasks[s3Row + s4];
            const s4Mask =
              pairMasks[s4Row] |
              pairMasks[s4Row + 1] |
              pairMasks[s4Row + s2] |
              pairMasks[s4Row + s3] |
              pairMasks[s4Row + s4];

            if (
              singleAuxScores &&
              fixedSingleAux + singleAuxScores[s2] + singleAuxScores[s3] + singleAuxScores[s4] < singleAuxMinimum
            ) {
              continue;
            }
            if (hasMultiAuxRequirements) {
              const s2Any = nonZero[s2] as any;
              const s3Any = nonZero[s3] as any;
              const s4Any = nonZero[s4] as any;
              if (
                fixedEvasion + nonZero[s2].evasion + nonZero[s3].evasion + nonZero[s4].evasion < minEvasion ||
                fixedBuff + ((s2Any.totalBuffCached as number) ?? 0) + ((s3Any.totalBuffCached as number) ?? 0) + ((s4Any.totalBuffCached as number) ?? 0) < minBuff ||
                fixedDebuff + ((s2Any.totalDebuffCached as number) ?? 0) + ((s3Any.totalDebuffCached as number) ?? 0) + ((s4Any.totalDebuffCached as number) ?? 0) < minDebuff ||
                fixedCosmic + ((s2Any.magicCosmicCountCached as number) ?? 0) + ((s3Any.magicCosmicCountCached as number) ?? 0) + ((s4Any.magicCosmicCountCached as number) ?? 0) < minCosmic ||
                fixedFire + ((s2Any.magicFireCountCached as number) ?? 0) + ((s3Any.magicFireCountCached as number) ?? 0) + ((s4Any.magicFireCountCached as number) ?? 0) < minFire ||
                fixedWater + ((s2Any.magicWaterCountCached as number) ?? 0) + ((s3Any.magicWaterCountCached as number) ?? 0) + ((s4Any.magicWaterCountCached as number) ?? 0) < minWater ||
                fixedFlora + ((s2Any.magicFloraCountCached as number) ?? 0) + ((s3Any.magicFloraCountCached as number) ?? 0) + ((s4Any.magicFloraCountCached as number) ?? 0) < minFlora ||
                fixedHealNum + ((s2Any.healCardCountCached as number) ?? 0) + ((s3Any.healCardCountCached as number) ?? 0) + ((s4Any.healCardCountCached as number) ?? 0) < minHealNum
              ) {
                continue;
              }
            }
            if (needsHpCheck) {
              const hp =
                fastHpTables![0][fixed0Mask] +
                fastHpTables![1][fixed1Mask] +
                fastHpTables![s2][s2Mask] +
                fastHpTables![s3][s3Mask] +
                fastHpTables![s4][s4Mask];
              if (
                hp < minHP ||
                (
                  minEHP > 0 &&
                  hp +
                    fastHealTables![0][fixed0Mask] +
                    fastHealTables![1][fixed1Mask] +
                    fastHealTables![s2][s2Mask] +
                    fastHealTables![s3][s3Mask] +
                    fastHealTables![s4][s4Mask] < minEHP
                )
              ) {
                continue;
              }
            }

            const duoMask = resolveFixedFiveDuoMaskFromIds(
              fixed0Id,
              fixed1Id,
              ids[s2],
              ids[s3],
              ids[s4],
              fixed0DuoId,
              fixed1DuoId,
              duoIds[s2],
              duoIds[s3],
              duoIds[s4],
              fixed0UseM2,
              fixed1UseM2,
              useM2[s2] !== 0,
              useM2[s3] !== 0,
              useM2[s4] !== 0,
            );
            const primaryRaw =
              fixed0DamageTable[metricOffset + ((fixed0DuoBase || (duoMask & 1) !== 0) ? 8 : 0) + fixed0Mask] +
              fixed1DamageTable[metricOffset + ((fixed1DuoBase || (duoMask & 2) !== 0) ? 8 : 0) + fixed1Mask] +
              damageTables[s2][metricOffset + ((duoBaseOffsets[s2] !== 0 || (duoMask & 4) !== 0) ? 8 : 0) + s2Mask] +
              damageTables[s3][metricOffset + ((duoBaseOffsets[s3] !== 0 || (duoMask & 8) !== 0) ? 8 : 0) + s3Mask] +
              damageTables[s4][metricOffset + ((duoBaseOffsets[s4] !== 0 || (duoMask & 16) !== 0) ? 8 : 0) + s4Mask];
            addSeedScore(Math.floor(primaryRaw));
          }
        }
      }

      if (seedScores.length < metricPrimaryFastMaxSize) return;
      seedScores.sort((a, b) => b - a);
      metricPrimarySeedThresholdPrimary = seedScores[metricPrimaryFastMaxSize - 1];
      metricPrimarySeedThresholdSecondary = -Infinity;
      if (debugCounters) {
        debugCounters.fixedTwoDamagePreseedCount = seedCount;
        debugCounters.fixedTwoDamagePreseedChecks = checked;
        debugCounters.fixedTwoDamagePreseedValid = valid;
        debugCounters.fixedTwoDamagePreseedThresholdPrimary = metricPrimarySeedThresholdPrimary;
      }
    };

    if (!canUseFixedTwoSeededTop) {
      preseedFixedTwoDamagePrimaryThreshold();
    }

    const tryCompleteFixedTwoDamagePrimarySeededTop = (): boolean => {
      if (
        !metricPrimaryFastEntries ||
        metricPrimaryFastMaxSize <= 0 ||
        !nonZeroPrimaryUpperScores ||
        !canUseFixedTwoReachablePrune ||
        lengthes[4] - 2 < 3
      ) {
        return false;
      }

      const remainingCount = lengthes[4] - 2;
      const order = new Int32Array(remainingCount);
      for (let index = 0; index < remainingCount; index++) order[index] = index + 2;
      order.sort((a, b) => {
        const diff = nonZeroPrimaryUpperScores[b] - nonZeroPrimaryUpperScores[a];
        if (diff !== 0) return diff;
        return a - b;
      });

      let minSeedCount = 3;
      while (minSeedCount < remainingCount && combinationCount(minSeedCount, 3) < metricPrimaryFastMaxSize) {
        minSeedCount += 1;
      }
      if (combinationCount(minSeedCount, 3) < metricPrimaryFastMaxSize) return false;

      const maxSeedCombinations = Math.max(1000, Math.min(8000, metricPrimaryFastMaxSize * 8));
      let maxSeedCount = minSeedCount;
      while (
        maxSeedCount < remainingCount &&
        combinationCount(maxSeedCount + 1, 3) <= maxSeedCombinations
      ) {
        maxSeedCount += 1;
      }

      let checked = 0;
      let exactChecks = 0;
      let valid = 0;

      const evaluateSeedTriple = (a: number, b: number, c: number) => {
        checked += 1;
        let s2 = a;
        let s3 = b;
        let s4 = c;
        if (s3 < s2) {
          const tmp = s2;
          s2 = s3;
          s3 = tmp;
        }
        if (s4 < s3) {
          const tmp = s3;
          s3 = s4;
          s4 = tmp;
          if (s3 < s2) {
            const tmp2 = s2;
            s2 = s3;
            s3 = tmp2;
          }
        }

        const s2Row = s2 * listLength;
        const s3Row = s3 * listLength;
        const s4Row = s4 * listLength;
        const fixed0Mask = fixed0BaseMask | pairMasks[fixed0Row + s2] | pairMasks[fixed0Row + s3] | pairMasks[fixed0Row + s4];
        const fixed1Mask = fixed1BaseMask | pairMasks[fixed1Row + s2] | pairMasks[fixed1Row + s3] | pairMasks[fixed1Row + s4];
        const s2Mask =
          pairMasks[s2Row] |
          pairMasks[s2Row + 1] |
          pairMasks[s2Row + s2] |
          pairMasks[s2Row + s3] |
          pairMasks[s2Row + s4];
        const s3Mask =
          pairMasks[s3Row] |
          pairMasks[s3Row + 1] |
          pairMasks[s3Row + s2] |
          pairMasks[s3Row + s3] |
          pairMasks[s3Row + s4];
        const s4Mask =
          pairMasks[s4Row] |
          pairMasks[s4Row + 1] |
          pairMasks[s4Row + s2] |
          pairMasks[s4Row + s3] |
          pairMasks[s4Row + s4];

        const safeUpperScore =
          safeDamageUpperByMask[fixed0Mask] +
          safeDamageUpperByMask[8 + fixed1Mask] +
          safeDamageUpperByMask[(s2 << 3) + s2Mask] +
          safeDamageUpperByMask[(s3 << 3) + s3Mask] +
          safeDamageUpperByMask[(s4 << 3) + s4Mask];
        if (!metricPrimaryShouldConsider(safeUpperScore)) return;

        if (
          singleAuxScores &&
          fixedSingleAux + singleAuxScores[s2] + singleAuxScores[s3] + singleAuxScores[s4] < singleAuxMinimum
        ) {
          return;
        }
        if (hasMultiAuxRequirements) {
          const s2Any = nonZero[s2] as any;
          const s3Any = nonZero[s3] as any;
          const s4Any = nonZero[s4] as any;
          if (
            fixedEvasion + nonZero[s2].evasion + nonZero[s3].evasion + nonZero[s4].evasion < minEvasion ||
            fixedBuff + ((s2Any.totalBuffCached as number) ?? 0) + ((s3Any.totalBuffCached as number) ?? 0) + ((s4Any.totalBuffCached as number) ?? 0) < minBuff ||
            fixedDebuff + ((s2Any.totalDebuffCached as number) ?? 0) + ((s3Any.totalDebuffCached as number) ?? 0) + ((s4Any.totalDebuffCached as number) ?? 0) < minDebuff ||
            fixedCosmic + ((s2Any.magicCosmicCountCached as number) ?? 0) + ((s3Any.magicCosmicCountCached as number) ?? 0) + ((s4Any.magicCosmicCountCached as number) ?? 0) < minCosmic ||
            fixedFire + ((s2Any.magicFireCountCached as number) ?? 0) + ((s3Any.magicFireCountCached as number) ?? 0) + ((s4Any.magicFireCountCached as number) ?? 0) < minFire ||
            fixedWater + ((s2Any.magicWaterCountCached as number) ?? 0) + ((s3Any.magicWaterCountCached as number) ?? 0) + ((s4Any.magicWaterCountCached as number) ?? 0) < minWater ||
            fixedFlora + ((s2Any.magicFloraCountCached as number) ?? 0) + ((s3Any.magicFloraCountCached as number) ?? 0) + ((s4Any.magicFloraCountCached as number) ?? 0) < minFlora ||
            fixedHealNum + ((s2Any.healCardCountCached as number) ?? 0) + ((s3Any.healCardCountCached as number) ?? 0) + ((s4Any.healCardCountCached as number) ?? 0) < minHealNum
          ) {
            return;
          }
        }
        if (needsHpCheck) {
          const hp =
            fastHpTables![0][fixed0Mask] +
            fastHpTables![1][fixed1Mask] +
            fastHpTables![s2][s2Mask] +
            fastHpTables![s3][s3Mask] +
            fastHpTables![s4][s4Mask];
          if (
            hp < minHP ||
            (
              minEHP > 0 &&
              hp +
                fastHealTables![0][fixed0Mask] +
                fastHealTables![1][fixed1Mask] +
                fastHealTables![s2][s2Mask] +
                fastHealTables![s3][s3Mask] +
                fastHealTables![s4][s4Mask] < minEHP
            )
          ) {
            return;
          }
        }

        exactChecks += 1;
        const duoMask = resolveFixedFiveDuoMaskFromIds(
          fixed0Id,
          fixed1Id,
          ids[s2],
          ids[s3],
          ids[s4],
          fixed0DuoId,
          fixed1DuoId,
          duoIds[s2],
          duoIds[s3],
          duoIds[s4],
          fixed0UseM2,
          fixed1UseM2,
          useM2[s2] !== 0,
          useM2[s3] !== 0,
          useM2[s4] !== 0,
        );
        const primaryRaw =
          fixed0DamageTable[metricOffset + ((fixed0DuoBase || (duoMask & 1) !== 0) ? 8 : 0) + fixed0Mask] +
          fixed1DamageTable[metricOffset + ((fixed1DuoBase || (duoMask & 2) !== 0) ? 8 : 0) + fixed1Mask] +
          damageTables[s2][metricOffset + ((duoBaseOffsets[s2] !== 0 || (duoMask & 4) !== 0) ? 8 : 0) + s2Mask] +
          damageTables[s3][metricOffset + ((duoBaseOffsets[s3] !== 0 || (duoMask & 8) !== 0) ? 8 : 0) + s3Mask] +
          damageTables[s4][metricOffset + ((duoBaseOffsets[s4] !== 0 || (duoMask & 16) !== 0) ? 8 : 0) + s4Mask];
        if (metricPrimaryShouldConsider(primaryRaw)) {
          addMetricPrimaryFastEntry(Math.floor(primaryRaw), 0, nonZero[0], nonZero[1], nonZero[s2], nonZero[s3], nonZero[s4]);
          valid += 1;
        }
      };

      for (let seedCount = minSeedCount; seedCount <= maxSeedCount; seedCount++) {
        if (seedCount === minSeedCount) {
          for (let ai = 0; ai < seedCount - 2; ai++) {
            const a = order[ai];
            for (let bi = ai + 1; bi < seedCount - 1; bi++) {
              const b = order[bi];
              for (let ci = bi + 1; ci < seedCount; ci++) {
                evaluateSeedTriple(a, b, order[ci]);
              }
            }
          }
        } else {
          const ci = seedCount - 1;
          const c = order[ci];
          for (let ai = 0; ai < ci - 1; ai++) {
            const a = order[ai];
            for (let bi = ai + 1; bi < ci; bi++) {
              evaluateSeedTriple(a, order[bi], c);
            }
          }
        }

        if (metricPrimaryFastEntries.length >= metricPrimaryFastMaxSize) {
          const outsideUpper = seedCount >= remainingCount
            ? -Infinity
            : fixedUpper +
              nonZeroPrimaryUpperScores[order[0]] +
              nonZeroPrimaryUpperScores[order[1]] +
              nonZeroPrimaryUpperScores[order[seedCount]];
          if (outsideUpper < metricPrimaryFastThresholdPrimary) {
            nowResultsCount += combinationCount(remainingCount, 3);
            if (debugCounters) {
              debugCounters.fixedTwoDamageSeededTopSeedCount = seedCount;
              debugCounters.fixedTwoDamageSeededTopChecks = checked;
              debugCounters.fixedTwoDamageSeededTopExactChecks = exactChecks;
              debugCounters.fixedTwoDamageSeededTopValid = valid;
              debugCounters.fixedTwoDamageSeededTopOutsideUpper = outsideUpper;
              debugCounters.fixedTwoDamageSeededTopThreshold = metricPrimaryFastThresholdPrimary;
            }
            return true;
          }
        }
      }

      fixedTwoSeededCandidateFlags = new Uint8Array(listLength);
      for (let index = 0; index < maxSeedCount; index++) {
        fixedTwoSeededCandidateFlags[order[index]] = 1;
      }
      if (debugCounters) {
        debugCounters.fixedTwoDamageSeededTopSeedCount = maxSeedCount;
        debugCounters.fixedTwoDamageSeededTopChecks = checked;
        debugCounters.fixedTwoDamageSeededTopExactChecks = exactChecks;
        debugCounters.fixedTwoDamageSeededTopValid = valid;
        debugCounters.fixedTwoDamageSeededTopComplete = 0;
      }
      return false;
    };

    if (canUseFixedTwoSeededTop && tryCompleteFixedTwoDamagePrimarySeededTop()) {
      return true;
    }

    const tryCompleteFixedTwoDamagePrimaryBestFirst = async (): Promise<boolean> => {
      if (
        !metricPrimaryFastEntries ||
        metricPrimaryFastMaxSize <= 0 ||
        !nonZeroPrimaryUpperScores ||
        hasMultiAuxRequirements ||
        needsHpCheck
      ) {
        return false;
      }

      const remainingCount = lengthes[4] - 2;
      if (remainingCount < 3) return false;

      const order = new Int32Array(remainingCount);
      for (let index = 0; index < remainingCount; index++) order[index] = index + 2;
      order.sort((a, b) => {
        const diff = nonZeroPrimaryUpperScores[b] - nonZeroPrimaryUpperScores[a];
        if (diff !== 0) return diff;
        return a - b;
      });

      type FixedTwoBestFirstNode = { a: number; b: number; c: number; upper: number };
      const heap: FixedTwoBestFirstNode[] = [];
      const visited = new Uint8Array(remainingCount * remainingCount * remainingCount);
      const packNodeKey = (a: number, b: number, c: number): number =>
        ((a * remainingCount + b) * remainingCount + c);
      const heapPush = (node: FixedTwoBestFirstNode) => {
        let index = heap.length;
        heap.push(node);
        while (index > 0) {
          const parent = (index - 1) >>> 1;
          if (heap[parent].upper >= node.upper) break;
          heap[index] = heap[parent];
          index = parent;
        }
        heap[index] = node;
      };
      const heapPop = (): FixedTwoBestFirstNode | undefined => {
        const root = heap[0];
        if (root === undefined) return undefined;
        const last = heap.pop()!;
        if (heap.length === 0) return root;
        let index = 0;
        while (true) {
          const left = index * 2 + 1;
          const right = left + 1;
          if (left >= heap.length) break;
          let child = left;
          if (right < heap.length && heap[right].upper > heap[left].upper) child = right;
          if (heap[child].upper <= last.upper) break;
          heap[index] = heap[child];
          index = child;
        }
        heap[index] = last;
        return root;
      };
      const pushNode = (a: number, b: number, c: number) => {
        if (!(a < b && b < c && c < remainingCount)) return;
        const key = packNodeKey(a, b, c);
        if (visited[key] !== 0) return;
        const upper =
          fixedUpper +
          nonZeroPrimaryUpperScores[order[a]] +
          nonZeroPrimaryUpperScores[order[b]] +
          nonZeroPrimaryUpperScores[order[c]];
        if (!metricPrimaryShouldConsider(upper)) return;
        visited[key] = 1;
        heapPush({ a, b, c, upper });
      };

      const originalEntryCount = metricPrimaryFastEntries.length;
      const originalIsSorted = metricPrimaryFastIsSorted;
      let checked = 0;
      let exactChecks = 0;
      let safeUpperSkip = 0;
      let auxSkip = 0;
      let completed = false;
      let searchCheckCounter = 0;
      const maxBestFirstChecks = 9000;

      pushNode(0, 1, 2);
      while (heap.length > 0) {
        const node = heapPop()!;
        if (!metricPrimaryShouldConsider(node.upper)) {
          completed = true;
          break;
        }
        checked += 1;
        searchCheckCounter += 1;
        if ((searchCheckCounter & SEARCH_CHECK_MASK) === 0 && !(await yieldToSearchUi())) return false;
        if (checked > maxBestFirstChecks) break;

        const ia = order[node.a];
        const ib = order[node.b];
        const ic = order[node.c];
        let s2 = ia;
        let s3 = ib;
        let s4 = ic;
        if (s3 < s2) {
          const tmp = s2;
          s2 = s3;
          s3 = tmp;
        }
        if (s4 < s3) {
          const tmp = s3;
          s3 = s4;
          s4 = tmp;
          if (s3 < s2) {
            const tmp2 = s2;
            s2 = s3;
            s3 = tmp2;
          }
        }

        let auxPass = true;
        if (
          singleAuxScores &&
          fixedSingleAux + singleAuxScores[s2] + singleAuxScores[s3] + singleAuxScores[s4] < singleAuxMinimum
        ) {
          auxSkip += 1;
          auxPass = false;
        } else if (hasMultiAuxRequirements) {
          const s2Any = nonZero[s2] as any;
          const s3Any = nonZero[s3] as any;
          const s4Any = nonZero[s4] as any;
          if (
            fixedEvasion + nonZero[s2].evasion + nonZero[s3].evasion + nonZero[s4].evasion < minEvasion ||
            fixedBuff + ((s2Any.totalBuffCached as number) ?? 0) + ((s3Any.totalBuffCached as number) ?? 0) + ((s4Any.totalBuffCached as number) ?? 0) < minBuff ||
            fixedDebuff + ((s2Any.totalDebuffCached as number) ?? 0) + ((s3Any.totalDebuffCached as number) ?? 0) + ((s4Any.totalDebuffCached as number) ?? 0) < minDebuff ||
            fixedCosmic + ((s2Any.magicCosmicCountCached as number) ?? 0) + ((s3Any.magicCosmicCountCached as number) ?? 0) + ((s4Any.magicCosmicCountCached as number) ?? 0) < minCosmic ||
            fixedFire + ((s2Any.magicFireCountCached as number) ?? 0) + ((s3Any.magicFireCountCached as number) ?? 0) + ((s4Any.magicFireCountCached as number) ?? 0) < minFire ||
            fixedWater + ((s2Any.magicWaterCountCached as number) ?? 0) + ((s3Any.magicWaterCountCached as number) ?? 0) + ((s4Any.magicWaterCountCached as number) ?? 0) < minWater ||
            fixedFlora + ((s2Any.magicFloraCountCached as number) ?? 0) + ((s3Any.magicFloraCountCached as number) ?? 0) + ((s4Any.magicFloraCountCached as number) ?? 0) < minFlora ||
            fixedHealNum + ((s2Any.healCardCountCached as number) ?? 0) + ((s3Any.healCardCountCached as number) ?? 0) + ((s4Any.healCardCountCached as number) ?? 0) < minHealNum
          ) {
            auxSkip += 1;
            auxPass = false;
          }
        }
        if (auxPass) {
          const s2Row = s2 * listLength;
          const s3Row = s3 * listLength;
          const s4Row = s4 * listLength;
          const fixed0Mask = fixed0BaseMask | pairMasks[fixed0Row + s2] | pairMasks[fixed0Row + s3] | pairMasks[fixed0Row + s4];
          const fixed1Mask = fixed1BaseMask | pairMasks[fixed1Row + s2] | pairMasks[fixed1Row + s3] | pairMasks[fixed1Row + s4];
          const s2Mask =
            pairMasks[s2Row] |
            pairMasks[s2Row + 1] |
            pairMasks[s2Row + s2] |
            pairMasks[s2Row + s3] |
            pairMasks[s2Row + s4];
          const s3Mask =
            pairMasks[s3Row] |
            pairMasks[s3Row + 1] |
            pairMasks[s3Row + s2] |
            pairMasks[s3Row + s3] |
            pairMasks[s3Row + s4];
          const s4Mask =
            pairMasks[s4Row] |
            pairMasks[s4Row + 1] |
            pairMasks[s4Row + s2] |
            pairMasks[s4Row + s3] |
            pairMasks[s4Row + s4];
          const safeUpperScore =
            safeDamageUpperByMask[fixed0Mask] +
            safeDamageUpperByMask[8 + fixed1Mask] +
            safeDamageUpperByMask[(s2 << 3) + s2Mask] +
            safeDamageUpperByMask[(s3 << 3) + s3Mask] +
            safeDamageUpperByMask[(s4 << 3) + s4Mask];
          if (!metricPrimaryShouldConsider(safeUpperScore)) {
            safeUpperSkip += 1;
          } else {
            let hpPass = true;
            if (needsHpCheck) {
              const hp =
                fastHpTables![0][fixed0Mask] +
                fastHpTables![1][fixed1Mask] +
                fastHpTables![s2][s2Mask] +
                fastHpTables![s3][s3Mask] +
                fastHpTables![s4][s4Mask];
              hpPass =
                hp >= minHP &&
                (
                  minEHP <= 0 ||
                  hp +
                    fastHealTables![0][fixed0Mask] +
                    fastHealTables![1][fixed1Mask] +
                    fastHealTables![s2][s2Mask] +
                    fastHealTables![s3][s3Mask] +
                    fastHealTables![s4][s4Mask] >= minEHP
                );
            }
            if (hpPass) {
              exactChecks += 1;
              const duoMask = resolveFixedFiveDuoMaskFromIds(
                fixed0Id,
                fixed1Id,
                ids[s2],
                ids[s3],
                ids[s4],
                fixed0DuoId,
                fixed1DuoId,
                duoIds[s2],
                duoIds[s3],
                duoIds[s4],
                fixed0UseM2,
                fixed1UseM2,
                useM2[s2] !== 0,
                useM2[s3] !== 0,
                useM2[s4] !== 0,
              );
              const primaryRaw =
                fixed0DamageTable[metricOffset + ((fixed0DuoBase || (duoMask & 1) !== 0) ? 8 : 0) + fixed0Mask] +
                fixed1DamageTable[metricOffset + ((fixed1DuoBase || (duoMask & 2) !== 0) ? 8 : 0) + fixed1Mask] +
                damageTables[s2][metricOffset + ((duoBaseOffsets[s2] !== 0 || (duoMask & 4) !== 0) ? 8 : 0) + s2Mask] +
                damageTables[s3][metricOffset + ((duoBaseOffsets[s3] !== 0 || (duoMask & 8) !== 0) ? 8 : 0) + s3Mask] +
                damageTables[s4][metricOffset + ((duoBaseOffsets[s4] !== 0 || (duoMask & 16) !== 0) ? 8 : 0) + s4Mask];
              if (metricPrimaryShouldConsider(primaryRaw)) {
                addMetricPrimaryFastEntry(Math.floor(primaryRaw), 0, nonZero[0], nonZero[1], nonZero[s2], nonZero[s3], nonZero[s4]);
              }
            }
          }
        }

        pushNode(node.a + 1, node.b, node.c);
        pushNode(node.a, node.b + 1, node.c);
        pushNode(node.a, node.b, node.c + 1);
      }

      if (heap.length === 0) completed = true;
      if (debugCounters) {
        debugCounters.fixedTwoDamageBestFirstChecks = checked;
        debugCounters.fixedTwoDamageBestFirstExactChecks = exactChecks;
        debugCounters.fixedTwoDamageBestFirstSafeSkip = safeUpperSkip;
        debugCounters.fixedTwoDamageBestFirstAuxSkip = auxSkip;
        debugCounters.fixedTwoDamageBestFirstCompleted = completed ? 1 : 0;
      }
      if (completed) {
        nowResultsCount += combinationCount(remainingCount, 3);
        return true;
      }

      metricPrimaryFastEntries.length = originalEntryCount;
      metricPrimaryFastIsSorted = originalIsSorted;
      updateMetricPrimaryFastThreshold();
      return false;
    };

    if (await tryCompleteFixedTwoDamagePrimaryBestFirst()) {
      return true;
    }

    const tryCompleteFixedTwoDamagePrimarySortedUpper = async (): Promise<boolean> => {
      if (
        !metricPrimaryFastEntries ||
        metricPrimaryFastMaxSize <= 0 ||
        !nonZeroPrimaryUpperScores ||
        hasMultiAuxRequirements ||
        canUseFixedTwoReachablePrune
      ) {
        return false;
      }

      const remainingCount = lengthes[4] - 2;
      if (remainingCount < 3) return false;

      const order = new Int32Array(remainingCount);
      for (let index = 0; index < remainingCount; index++) order[index] = index + 2;
      order.sort((a, b) => {
        const diff = nonZeroPrimaryUpperScores[b] - nonZeroPrimaryUpperScores[a];
        if (diff !== 0) return diff;
        return a - b;
      });

      let checked = 0;
      let exactChecks = 0;
      let safeUpperSkip = 0;
      let auxSkip = 0;
      let sortedSearchCheckCounter = 0;

      for (let ai = 0; ai < remainingCount - 2; ai++) {
        const ia = order[ai];
        const aUpper = nonZeroPrimaryUpperScores[ia];
        if (
          !metricPrimaryShouldConsider(
            fixedUpper +
            aUpper +
            nonZeroPrimaryUpperScores[order[ai + 1]] +
            nonZeroPrimaryUpperScores[order[ai + 2]],
          )
        ) {
          break;
        }
        for (let bi = ai + 1; bi < remainingCount - 1; bi++) {
          const ib = order[bi];
          const abUpper = fixedUpper + aUpper + nonZeroPrimaryUpperScores[ib];
          if (!metricPrimaryShouldConsider(abUpper + nonZeroPrimaryUpperScores[order[bi + 1]])) {
            break;
          }
          for (let ci = bi + 1; ci < remainingCount; ci++) {
            const ic = order[ci];
            if (!metricPrimaryShouldConsider(abUpper + nonZeroPrimaryUpperScores[ic])) {
              break;
            }
            checked += 1;
            sortedSearchCheckCounter += 1;
            if ((sortedSearchCheckCounter & SEARCH_CHECK_MASK) === 0 && !(await yieldToSearchUi())) return false;

            let s2 = ia;
            let s3 = ib;
            let s4 = ic;
            if (s3 < s2) {
              const tmp = s2;
              s2 = s3;
              s3 = tmp;
            }
            if (s4 < s3) {
              const tmp = s3;
              s3 = s4;
              s4 = tmp;
              if (s3 < s2) {
                const tmp2 = s2;
                s2 = s3;
                s3 = tmp2;
              }
            }

            const s2Row = s2 * listLength;
            const s3Row = s3 * listLength;
            const s4Row = s4 * listLength;
            const fixed0Mask = fixed0BaseMask | pairMasks[fixed0Row + s2] | pairMasks[fixed0Row + s3] | pairMasks[fixed0Row + s4];
            const fixed1Mask = fixed1BaseMask | pairMasks[fixed1Row + s2] | pairMasks[fixed1Row + s3] | pairMasks[fixed1Row + s4];
            const s2Mask =
              pairMasks[s2Row] |
              pairMasks[s2Row + 1] |
              pairMasks[s2Row + s2] |
              pairMasks[s2Row + s3] |
              pairMasks[s2Row + s4];
            const s3Mask =
              pairMasks[s3Row] |
              pairMasks[s3Row + 1] |
              pairMasks[s3Row + s2] |
              pairMasks[s3Row + s3] |
              pairMasks[s3Row + s4];
            const s4Mask =
              pairMasks[s4Row] |
              pairMasks[s4Row + 1] |
              pairMasks[s4Row + s2] |
              pairMasks[s4Row + s3] |
              pairMasks[s4Row + s4];
            const safeUpperScore =
              safeDamageUpperByMask[fixed0Mask] +
              safeDamageUpperByMask[8 + fixed1Mask] +
              safeDamageUpperByMask[(s2 << 3) + s2Mask] +
              safeDamageUpperByMask[(s3 << 3) + s3Mask] +
              safeDamageUpperByMask[(s4 << 3) + s4Mask];
            if (!metricPrimaryShouldConsider(safeUpperScore)) {
              safeUpperSkip += 1;
              continue;
            }
            if (
              singleAuxScores &&
              fixedSingleAux + singleAuxScores[s2] + singleAuxScores[s3] + singleAuxScores[s4] < singleAuxMinimum
            ) {
              auxSkip += 1;
              continue;
            }
            if (needsHpCheck) {
              const hp =
                fastHpTables![0][fixed0Mask] +
                fastHpTables![1][fixed1Mask] +
                fastHpTables![s2][s2Mask] +
                fastHpTables![s3][s3Mask] +
                fastHpTables![s4][s4Mask];
              if (
                hp < minHP ||
                (
                  minEHP > 0 &&
                  hp +
                    fastHealTables![0][fixed0Mask] +
                    fastHealTables![1][fixed1Mask] +
                    fastHealTables![s2][s2Mask] +
                    fastHealTables![s3][s3Mask] +
                    fastHealTables![s4][s4Mask] < minEHP
                )
              ) {
                continue;
              }
            }

            exactChecks += 1;
            const duoMask = resolveFixedFiveDuoMaskFromIds(
              fixed0Id,
              fixed1Id,
              ids[s2],
              ids[s3],
              ids[s4],
              fixed0DuoId,
              fixed1DuoId,
              duoIds[s2],
              duoIds[s3],
              duoIds[s4],
              fixed0UseM2,
              fixed1UseM2,
              useM2[s2] !== 0,
              useM2[s3] !== 0,
              useM2[s4] !== 0,
            );
            const primaryRaw =
              fixed0DamageTable[metricOffset + ((fixed0DuoBase || (duoMask & 1) !== 0) ? 8 : 0) + fixed0Mask] +
              fixed1DamageTable[metricOffset + ((fixed1DuoBase || (duoMask & 2) !== 0) ? 8 : 0) + fixed1Mask] +
              damageTables[s2][metricOffset + ((duoBaseOffsets[s2] !== 0 || (duoMask & 4) !== 0) ? 8 : 0) + s2Mask] +
              damageTables[s3][metricOffset + ((duoBaseOffsets[s3] !== 0 || (duoMask & 8) !== 0) ? 8 : 0) + s3Mask] +
              damageTables[s4][metricOffset + ((duoBaseOffsets[s4] !== 0 || (duoMask & 16) !== 0) ? 8 : 0) + s4Mask];
            if (metricPrimaryShouldConsider(primaryRaw)) {
              addMetricPrimaryFastEntry(Math.floor(primaryRaw), 0, nonZero[0], nonZero[1], nonZero[s2], nonZero[s3], nonZero[s4]);
            }
          }
        }
      }

      nowResultsCount += combinationCount(remainingCount, 3);
      if (debugCounters) {
        debugCounters.fixedTwoDamageSortedUpperChecks = checked;
        debugCounters.fixedTwoDamageSortedUpperExactChecks = exactChecks;
        debugCounters.fixedTwoDamageSortedUpperSafeSkip = safeUpperSkip;
        debugCounters.fixedTwoDamageSortedUpperAuxSkip = auxSkip;
      }
      return true;
    };

    if (await tryCompleteFixedTwoDamagePrimarySortedUpper()) {
      return true;
    }

    let searchCheckCounter = 0;

    for (let k = 2; k < lengthes[2]; k++) {
      searchCheckCounter += 1;
      if ((searchCheckCounter & SEARCH_CHECK_MASK) === 0 && !(await yieldToSearchUi())) return false;
      const kRow = k * listLength;
      const kId = ids[k];
      const kDuoId = duoIds[k];
      const kUseM2 = useM2[k] !== 0;
      const kDuoBase = duoBaseOffsets[k] !== 0;
      const kDamageTable = damageTables[k];
      const kChara = nonZero[k];
      const kUpper = fixedUpper + nonZeroPrimaryUpperScores![k];
      const kSingleAux = singleAuxScores ? fixedSingleAux + singleAuxScores[k] : 0;
      const fixed0DuoPrefixK = fixed1Id === fixed0DuoId || kId === fixed0DuoId;
      const fixed1DuoPrefixK = fixed0Id === fixed1DuoId || kId === fixed1DuoId;
      const kDuoPrefix = fixed0Id === kDuoId || fixed1Id === kDuoId;
      if (
        singleAuxScores &&
        kSingleAux + singleAuxSuffixTopSums![2][k + 1] < singleAuxMinimum
      ) {
        const remainingAfterK = lengthes[4] - k - 1;
        nowResultsCount += (remainingAfterK * (remainingAfterK - 1)) / 2;
        continue;
      }
      const fixed0BaseK = fixed0BaseMask | pairMasks[fixed0Row + k];
      const fixed1BaseK = fixed1BaseMask | pairMasks[fixed1Row + k];
      const kBaseMask = pairMasks[kRow] | pairMasks[kRow + 1] | pairMasks[kRow + k];
      if (canUseFixedTwoReachablePrune) {
        const branchUpper =
          getNoSameDamageReachableUpper(0, fixed0BaseK, fixed0DuoPrefixK, k + 1, 2) +
          getNoSameDamageReachableUpper(1, fixed1BaseK, fixed1DuoPrefixK, k + 1, 2) +
          getNoSameDamageReachableUpper(k, kBaseMask, kDuoPrefix, k + 1, 2) +
          fixedTwoPrimaryUpperSuffixTopSums![2][k + 1];
        if (!metricPrimaryShouldConsider(branchUpper)) {
          const remainingAfterK = lengthes[4] - k - 1;
          const skipCount = (remainingAfterK * (remainingAfterK - 1)) / 2;
          incrementDebugCounter('fixedTwoDamageReachableKSkip', skipCount);
          nowResultsCount += skipCount;
          continue;
        }
      }
      for (let l = k + 1; l < lengthes[3]; l++) {
        const mStart = l + 1;
        if (mStart >= lengthes[4]) continue;
        const lRow = l * listLength;
        const lId = ids[l];
        const lDuoId = duoIds[l];
        const lUseM2 = useM2[l] !== 0;
        const lDuoBase = duoBaseOffsets[l] !== 0;
        const lDamageTable = damageTables[l];
        const lChara = nonZero[l];
        const prefixUpper = kUpper + nonZeroPrimaryUpperScores![l];
        const klSingleAux = singleAuxScores ? kSingleAux + singleAuxScores[l] : 0;
        const fixed0DuoPrefixL = fixed0DuoPrefixK || lId === fixed0DuoId;
        const fixed1DuoPrefixL = fixed1DuoPrefixK || lId === fixed1DuoId;
        const kDuoPrefixL = kDuoPrefix || lId === kDuoId;
        const lDuoPrefix = fixed0Id === lDuoId || fixed1Id === lDuoId || kId === lDuoId;
        if (
          singleAuxScores &&
          klSingleAux + singleAuxSuffixTopSums![1][mStart] < singleAuxMinimum
        ) {
          nowResultsCount += lengthes[4] - mStart;
          continue;
        }
        if (!metricPrimaryShouldConsider(prefixUpper + nonZeroPrimaryUpperSuffixMax![mStart])) {
          incrementDebugCounter('fixedTwoDamageSimplePrefixSkip', lengthes[4] - mStart);
          nowResultsCount += lengthes[4] - mStart;
          continue;
        }
        const fixed0BaseL = fixed0BaseK | pairMasks[fixed0Row + l];
        const fixed1BaseL = fixed1BaseK | pairMasks[fixed1Row + l];
        const kBaseL = kBaseMask | pairMasks[kRow + l];
        const lBaseMask =
          pairMasks[lRow] |
          pairMasks[lRow + 1] |
          pairMasks[lRow + k] |
          pairMasks[lRow + l];
        let fixed0OnePickReachableOffset = 0;
        let fixed1OnePickReachableOffset = 0;
        let kOnePickReachableOffset = 0;
        let lOnePickReachableOffset = 0;
        if (canUseFixedTwoReachablePrune) {
          const onePickReachable = fastDamageOnePickReachableUpper!;
          const fixed0DuoState = fixed0DuoPrefixL ? 1 : 0;
          const fixed1DuoState = fixed1DuoPrefixL ? 1 : 0;
          const kDuoState = kDuoPrefixL ? 1 : 0;
          const lDuoState = lDuoPrefix ? 1 : 0;
          fixed0OnePickReachableOffset = ((fixed0DuoState * 8) + fixed0BaseL) * fastDamageReachableSpan;
          fixed1OnePickReachableOffset = (((1 * 2 + fixed1DuoState) * 8) + fixed1BaseL) * fastDamageReachableSpan;
          kOnePickReachableOffset = (((k * 2 + kDuoState) * 8) + kBaseL) * fastDamageReachableSpan;
          lOnePickReachableOffset = (((l * 2 + lDuoState) * 8) + lBaseMask) * fastDamageReachableSpan;
          const remainingCount = lengthes[4] - mStart;
          const branchUpper =
            onePickReachable[fixed0OnePickReachableOffset + mStart] +
            onePickReachable[fixed1OnePickReachableOffset + mStart] +
            onePickReachable[kOnePickReachableOffset + mStart] +
            onePickReachable[lOnePickReachableOffset + mStart] +
            nonZeroPrimaryUpperSuffixMax![mStart];
          if (!metricPrimaryShouldConsider(branchUpper)) {
            incrementDebugCounter('fixedTwoDamageReachableLSkip', remainingCount);
            nowResultsCount += remainingCount;
            continue;
          }
        }
        for (let m = mStart; m < lengthes[4]; m++) {
          if (
            canUseFixedTwoSeededTop &&
            fixedTwoSeededCandidateFlags !== null &&
            fixedTwoSeededCandidateFlags[k] !== 0 &&
            fixedTwoSeededCandidateFlags[l] !== 0 &&
            fixedTwoSeededCandidateFlags[m] !== 0
          ) {
            incrementDebugCounter('fixedTwoDamageSeededTopSkip');
            nowResultsCount += 1;
            continue;
          }
          if (!metricPrimaryShouldConsider(prefixUpper + nonZeroPrimaryUpperScores![m])) {
            incrementDebugCounter('fixedTwoDamageSimpleCardSkip');
            nowResultsCount += 1;
            continue;
          }
          if (canUseFixedTwoReachablePrune) {
            const onePickReachable = fastDamageOnePickReachableUpper!;
            const branchUpper =
              onePickReachable[fixed0OnePickReachableOffset + m] +
              onePickReachable[fixed1OnePickReachableOffset + m] +
              onePickReachable[kOnePickReachableOffset + m] +
              onePickReachable[lOnePickReachableOffset + m] +
              nonZeroPrimaryUpperSuffixMax![m];
            if (!metricPrimaryShouldConsider(branchUpper)) {
              const skipCount = lengthes[4] - m;
              incrementDebugCounter('fixedTwoDamageReachableMBreak', skipCount);
              nowResultsCount += skipCount;
              break;
            }
          }
          const mRow = m * listLength;
          const mId = ids[m];
          const mDuoId = duoIds[m];
          const mUseM2 = useM2[m] !== 0;
          const mDuoBase = duoBaseOffsets[m] !== 0;
          const fixed0Mask = fixed0BaseL | pairMasks[fixed0Row + m];
          const fixed1Mask = fixed1BaseL | pairMasks[fixed1Row + m];
          const kMask = kBaseL | pairMasks[kRow + m];
          const lMask = lBaseMask | pairMasks[lRow + m];
          const mMask =
            pairMasks[mRow] |
            pairMasks[mRow + 1] |
            pairMasks[mRow + k] |
            pairMasks[mRow + l] |
            pairMasks[mRow + m];
          const mDamageTable = damageTables[m];
          const safeUpperScore =
            safeDamageUpperByMask[fixed0Mask] +
            safeDamageUpperByMask[8 + fixed1Mask] +
            safeDamageUpperByMask[(k << 3) + kMask] +
            safeDamageUpperByMask[(l << 3) + lMask] +
            safeDamageUpperByMask[(m << 3) + mMask];
          if (!metricPrimaryShouldConsider(safeUpperScore)) {
            incrementDebugCounter('fixedTwoDamageSafeUpperSkip');
            nowResultsCount += 1;
            continue;
          }
          if (singleAuxScores) {
            if (klSingleAux + singleAuxScores[m] < singleAuxMinimum) {
              nowResultsCount += 1;
              continue;
            }
          } else if (hasMultiAuxRequirements) {
            const kAny = nonZero[k] as any;
            const lAny = nonZero[l] as any;
            const mAny = nonZero[m] as any;
            if (
              fixedEvasion + nonZero[k].evasion + nonZero[l].evasion + nonZero[m].evasion < minEvasion ||
              fixedBuff + ((kAny.totalBuffCached as number) ?? 0) + ((lAny.totalBuffCached as number) ?? 0) + ((mAny.totalBuffCached as number) ?? 0) < minBuff ||
              fixedDebuff + ((kAny.totalDebuffCached as number) ?? 0) + ((lAny.totalDebuffCached as number) ?? 0) + ((mAny.totalDebuffCached as number) ?? 0) < minDebuff ||
              fixedCosmic + ((kAny.magicCosmicCountCached as number) ?? 0) + ((lAny.magicCosmicCountCached as number) ?? 0) + ((mAny.magicCosmicCountCached as number) ?? 0) < minCosmic ||
              fixedFire + ((kAny.magicFireCountCached as number) ?? 0) + ((lAny.magicFireCountCached as number) ?? 0) + ((mAny.magicFireCountCached as number) ?? 0) < minFire ||
              fixedWater + ((kAny.magicWaterCountCached as number) ?? 0) + ((lAny.magicWaterCountCached as number) ?? 0) + ((mAny.magicWaterCountCached as number) ?? 0) < minWater ||
              fixedFlora + ((kAny.magicFloraCountCached as number) ?? 0) + ((lAny.magicFloraCountCached as number) ?? 0) + ((mAny.magicFloraCountCached as number) ?? 0) < minFlora ||
              fixedHealNum + ((kAny.healCardCountCached as number) ?? 0) + ((lAny.healCardCountCached as number) ?? 0) + ((mAny.healCardCountCached as number) ?? 0) < minHealNum
            ) {
              nowResultsCount += 1;
              continue;
            }
          }
          if (needsHpCheck) {
            const hp =
              fastHpTables![0][fixed0Mask] +
              fastHpTables![1][fixed1Mask] +
              fastHpTables![k][kMask] +
              fastHpTables![l][lMask] +
              fastHpTables![m][mMask];
            if (hp < minHP) {
              nowResultsCount += 1;
              continue;
            }
            if (
              minEHP > 0 &&
              hp +
                fastHealTables![0][fixed0Mask] +
                fastHealTables![1][fixed1Mask] +
                fastHealTables![k][kMask] +
                fastHealTables![l][lMask] +
                fastHealTables![m][mMask] < minEHP
            ) {
              nowResultsCount += 1;
              continue;
            }
          }
          incrementDebugCounter('fixedTwoDamageExactChecks');
          const duoMask = resolveFixedFiveDuoMaskFromIds(
            fixed0Id,
            fixed1Id,
            kId,
            lId,
            mId,
            fixed0DuoId,
            fixed1DuoId,
            kDuoId,
            lDuoId,
            mDuoId,
            fixed0UseM2,
            fixed1UseM2,
            kUseM2,
            lUseM2,
            mUseM2,
          );
          const primaryRaw =
            fixed0DamageTable[metricOffset + ((fixed0DuoBase || (duoMask & 1) !== 0) ? 8 : 0) + fixed0Mask] +
            fixed1DamageTable[metricOffset + ((fixed1DuoBase || (duoMask & 2) !== 0) ? 8 : 0) + fixed1Mask] +
            kDamageTable[metricOffset + ((kDuoBase || (duoMask & 4) !== 0) ? 8 : 0) + kMask] +
            lDamageTable[metricOffset + ((lDuoBase || (duoMask & 8) !== 0) ? 8 : 0) + lMask] +
            mDamageTable[metricOffset + ((mDuoBase || (duoMask & 16) !== 0) ? 8 : 0) + mMask];
          if (metricPrimaryShouldConsider(primaryRaw)) {
            addMetricPrimaryFastEntry(
              Math.floor(primaryRaw),
              0,
              nonZero[0],
              nonZero[1],
              kChara,
              lChara,
              nonZero[m],
            );
          }
          nowResultsCount += 1;
        }
      }
    }
    return true;
  };

  const preseedFixedTwoIncreasedHpBuddyThreshold = (lengthes: number[]) => {
    if (
      !metricPrimaryFastEntries ||
      metricPrimaryFastMaxSize <= 0 ||
      !canUseIncreasedHpBuddyFixedTwoFastLoop ||
      !fastPairBuddyMasks ||
      !fastHpTables ||
      !fastHealTables ||
      !fastIncreasedTables
    ) {
      return;
    }

    const remainingCount = lengthes[4] - 2;
    if (remainingCount < 3) return;
    const maxSeedCombinations = Math.max(1000, Math.min(8000, metricPrimaryFastMaxSize * 8));
    let seedCount = Math.min(remainingCount, 36);
    while (seedCount > 3 && combinationCount(seedCount, 3) > maxSeedCombinations) {
      seedCount -= 1;
    }
    if (combinationCount(seedCount, 3) < metricPrimaryFastMaxSize) return;

    const pairMasks = fastPairBuddyMasks;
    const hpTables = fastHpTables;
    const healTables = fastHealTables;
    const increasedTables = fastIncreasedTables;
    const minIncreasedHpBuddy = snapshot.minIncreasedHPBuddy;
    const minHP = snapshot.minHP;
    const minEHP = snapshot.minEHP;
    const fixed0Row = 0;
    const fixed1Row = listLength;
    const fixed0BaseMask = pairMasks[fixed0Row] | pairMasks[fixed0Row + 1];
    const fixed1BaseMask = pairMasks[fixed1Row] | pairMasks[fixed1Row + 1];
    const fixed0IncreasedTable = increasedTables[0];
    const fixed1IncreasedTable = increasedTables[1];
    const fixed0HpTable = hpTables[0];
    const fixed1HpTable = hpTables[1];
    const fixed0HealTable = healTables[0];
    const fixed1HealTable = healTables[1];

    const seedIndexes = new Int32Array(remainingCount);
    for (let i = 0; i < remainingCount; i++) seedIndexes[i] = i + 2;
    seedIndexes.sort((a, b) => {
      const aAny = nonZero[a] as any;
      const bAny = nonZero[b] as any;
      const upperDiff =
        (((bAny.increasedHpBuddyUpperCached as number) || 0) - ((aAny.increasedHpBuddyUpperCached as number) || 0));
      if (upperDiff !== 0) return upperDiff;
      const aHp = ((aAny.hpByBuddyMaskCached as Float64Array)[7]) + ((aAny.healByBuddyMaskCached as Float64Array)[7]);
      const bHp = ((bAny.hpByBuddyMaskCached as Float64Array)[7]) + ((bAny.healByBuddyMaskCached as Float64Array)[7]);
      return bHp - aHp;
    });

    const seedEntries: { primaryScore: number; secondaryScore: number }[] = [];
    let seedThresholdPrimary = -Infinity;
    let seedThresholdSecondary = -Infinity;
    const compareSeedEntries = (
      a: { primaryScore: number; secondaryScore: number },
      b: { primaryScore: number; secondaryScore: number },
    ): number => {
      if (a.primaryScore !== b.primaryScore) return b.primaryScore - a.primaryScore;
      if (metricPrimaryFastHasSecondary && a.secondaryScore !== b.secondaryScore) {
        return b.secondaryScore - a.secondaryScore;
      }
      return 0;
    };
    const updateSeedThreshold = () => {
      const worst = seedEntries[metricPrimaryFastMaxSize - 1];
      seedThresholdPrimary = worst.primaryScore;
      seedThresholdSecondary = metricPrimaryFastHasSecondary ? worst.secondaryScore : -Infinity;
    };
    const seedCouldEnter = (primaryScore: number, secondaryScore: number): boolean => {
      if (seedEntries.length < metricPrimaryFastMaxSize) return true;
      if (primaryScore > seedThresholdPrimary) return true;
      if (primaryScore < seedThresholdPrimary) return false;
      return !metricPrimaryFastHasSecondary || secondaryScore >= seedThresholdSecondary;
    };
    const addSeedEntry = (primaryScore: number, secondaryScore: number) => {
      if (!seedCouldEnter(primaryScore, secondaryScore)) return;
      const entry = { primaryScore, secondaryScore };
      if (seedEntries.length < metricPrimaryFastMaxSize) {
        seedEntries.push(entry);
        if (seedEntries.length === metricPrimaryFastMaxSize) {
          seedEntries.sort(compareSeedEntries);
          updateSeedThreshold();
        }
        return;
      }
      let left = 0;
      let right = seedEntries.length;
      while (left < right) {
        const mid = (left + right) >>> 1;
        if (compareSeedEntries(entry, seedEntries[mid]) < 0) {
          right = mid;
        } else {
          left = mid + 1;
        }
      }
      if (left >= metricPrimaryFastMaxSize) return;
      for (let index = metricPrimaryFastMaxSize - 1; index > left; index--) {
        seedEntries[index] = seedEntries[index - 1];
      }
      seedEntries[left] = entry;
      updateSeedThreshold();
    };

    for (let ai = 0; ai < seedCount - 2; ai++) {
      const a = seedIndexes[ai];
      const aRow = a * listLength;
      const aIncreasedTable = increasedTables[a];
      const aHpTable = hpTables[a];
      const aHealTable = healTables[a];
      const fixed0BaseA = fixed0BaseMask | pairMasks[fixed0Row + a];
      const fixed1BaseA = fixed1BaseMask | pairMasks[fixed1Row + a];
      const aBaseMask = pairMasks[aRow] | pairMasks[aRow + 1] | pairMasks[aRow + a];
      for (let bi = ai + 1; bi < seedCount - 1; bi++) {
        const b = seedIndexes[bi];
        const bRow = b * listLength;
        const bIncreasedTable = increasedTables[b];
        const bHpTable = hpTables[b];
        const bHealTable = healTables[b];
        const fixed0BaseB = fixed0BaseA | pairMasks[fixed0Row + b];
        const fixed1BaseB = fixed1BaseA | pairMasks[fixed1Row + b];
        const aBaseB = aBaseMask | pairMasks[aRow + b];
        const bBaseMask =
          pairMasks[bRow] |
          pairMasks[bRow + 1] |
          pairMasks[bRow + a] |
          pairMasks[bRow + b];
        for (let ci = bi + 1; ci < seedCount; ci++) {
          const c = seedIndexes[ci];
          const cRow = c * listLength;
          const fixed0Mask = fixed0BaseB | pairMasks[fixed0Row + c];
          const fixed1Mask = fixed1BaseB | pairMasks[fixed1Row + c];
          const aMask = aBaseB | pairMasks[aRow + c];
          const bMask = bBaseMask | pairMasks[bRow + c];
          const cMask =
            pairMasks[cRow] |
            pairMasks[cRow + 1] |
            pairMasks[cRow + a] |
            pairMasks[cRow + b] |
            pairMasks[cRow + c];

          let increasedHpBuddy = fixed0IncreasedTable[fixed0Mask];
          const fixed1Increased = fixed1IncreasedTable[fixed1Mask];
          if (fixed1Increased < increasedHpBuddy) increasedHpBuddy = fixed1Increased;
          const aIncreased = aIncreasedTable[aMask];
          if (aIncreased < increasedHpBuddy) increasedHpBuddy = aIncreased;
          const bIncreased = bIncreasedTable[bMask];
          if (bIncreased < increasedHpBuddy) increasedHpBuddy = bIncreased;
          const cIncreased = increasedTables[c][cMask];
          if (cIncreased < increasedHpBuddy) increasedHpBuddy = cIncreased;
          const primaryScore = Math.floor(increasedHpBuddy);
          if (primaryScore < minIncreasedHpBuddy) continue;

          const hp =
            fixed0HpTable[fixed0Mask] +
            fixed1HpTable[fixed1Mask] +
            aHpTable[aMask] +
            bHpTable[bMask] +
            hpTables[c][cMask];
          if (hp < minHP) continue;
          const ehp =
            hp +
            fixed0HealTable[fixed0Mask] +
            fixed1HealTable[fixed1Mask] +
            aHealTable[aMask] +
            bHealTable[bMask] +
            healTables[c][cMask];
          if (minEHP > 0 && ehp < minEHP) {
            continue;
          }
          addSeedEntry(primaryScore, ehp);
        }
      }
    }

    if (seedEntries.length >= metricPrimaryFastMaxSize) {
      metricPrimarySeedThresholdPrimary = seedThresholdPrimary;
      metricPrimarySeedThresholdSecondary = seedThresholdSecondary;
      if (debugCounters) {
        debugCounters.fixedTwoIncreasedSeedCount = seedCount;
        debugCounters.fixedTwoIncreasedSeedThresholdPrimary = metricPrimarySeedThresholdPrimary;
        debugCounters.fixedTwoIncreasedSeedThresholdSecondary = metricPrimarySeedThresholdSecondary;
      }
    }
  };

  const runFixedTwoIncreasedHpBuddyFastLoop = async (lengthes: number[]): Promise<boolean> => {
    const pairMasks = fastPairBuddyMasks!;
    const hpTables = fastHpTables!;
    const healTables = fastHealTables!;
    const increasedTables = fastIncreasedTables!;
    const minIncreasedHpBuddy = snapshot.minIncreasedHPBuddy;
    const minHP = snapshot.minHP;
    const minEHP = snapshot.minEHP;
    const fixed0Row = 0;
    const fixed1Row = listLength;
    const fixed0BaseMask = pairMasks[fixed0Row] | pairMasks[fixed0Row + 1];
    const fixed1BaseMask = pairMasks[fixed1Row] | pairMasks[fixed1Row + 1];
    const fixed0IncreasedTable = increasedTables[0];
    const fixed1IncreasedTable = increasedTables[1];
    const fixed0HpTable = hpTables[0];
    const fixed1HpTable = hpTables[1];
    const fixed0HealTable = healTables[0];
    const fixed1HealTable = healTables[1];
    const fixed0Chara = nonZero[0];
    const fixed1Chara = nonZero[1];
    const suffixSpan = listLength + 1;
    const fixedTwoIncreasedSuffixBestByBase = metricPrimarySeedThresholdPrimary !== -Infinity
      ? new Float64Array(listLength * 8 * suffixSpan)
      : null;
    const fixedTwoIncreasedUpperSuffixMax = metricPrimarySeedThresholdPrimary !== -Infinity
      ? new Float64Array(listLength + 1)
      : null;
    const fixedTwoEhpSuffixBestByBase = metricPrimaryFastHasSecondary
      ? new Float64Array(listLength * 8 * suffixSpan)
      : null;
    const fixedTwoEhpUpperScores = metricPrimaryFastHasSecondary
      ? new Float64Array(listLength)
      : null;
    const fixedTwoEhpUpperSuffixMax = metricPrimaryFastHasSecondary
      ? new Float64Array(listLength + 1)
      : null;
    const fixedTwoCanBeatThreshold = (primaryUpper: number, secondaryUpper: number): boolean => {
      if (!metricPrimaryFastEntries || metricPrimaryFastMaxSize <= 0) return false;
      let thresholdPrimary = metricPrimarySeedThresholdPrimary;
      let thresholdSecondary = metricPrimarySeedThresholdSecondary;
      if (metricPrimaryFastEntries.length >= metricPrimaryFastMaxSize) {
        if (metricPrimaryFastThresholdPrimary > thresholdPrimary) {
          thresholdPrimary = metricPrimaryFastThresholdPrimary;
          thresholdSecondary = metricPrimaryFastThresholdSecondary;
        } else if (
          metricPrimaryFastThresholdPrimary === thresholdPrimary &&
          metricPrimaryFastHasSecondary &&
          metricPrimaryFastThresholdSecondary > thresholdSecondary
        ) {
          thresholdSecondary = metricPrimaryFastThresholdSecondary;
        }
      }
      if (primaryUpper > thresholdPrimary) return true;
      if (primaryUpper < thresholdPrimary) return false;
      return !metricPrimaryFastHasSecondary || secondaryUpper >= thresholdSecondary;
    };
    if (fixedTwoIncreasedSuffixBestByBase && fixedTwoIncreasedUpperSuffixMax) {
      fixedTwoIncreasedUpperSuffixMax[listLength] = -Infinity;
      for (let candidate = listLength - 1; candidate >= 0; candidate--) {
        const value = ((nonZero[candidate] as any).increasedHpBuddyUpperCached as number) || 0;
        const next = fixedTwoIncreasedUpperSuffixMax[candidate + 1];
        fixedTwoIncreasedUpperSuffixMax[candidate] = value > next ? value : next;
      }
      for (let row = 0; row < listLength; row++) {
        const rowMaskOffset = row * listLength;
        const increasedTable = increasedTables[row];
        for (let baseMask = 0; baseMask < 8; baseMask++) {
          const offset = ((row << 3) + baseMask) * suffixSpan;
          fixedTwoIncreasedSuffixBestByBase[offset + listLength] = -Infinity;
          for (let candidate = listLength - 1; candidate >= 0; candidate--) {
            const value = increasedTable[baseMask | pairMasks[rowMaskOffset + candidate]];
            const next = fixedTwoIncreasedSuffixBestByBase[offset + candidate + 1];
            fixedTwoIncreasedSuffixBestByBase[offset + candidate] = value > next ? value : next;
          }
        }
      }
    }
    if (fixedTwoEhpSuffixBestByBase && fixedTwoEhpUpperScores && fixedTwoEhpUpperSuffixMax) {
      fixedTwoEhpUpperSuffixMax[listLength] = -Infinity;
      for (let candidate = listLength - 1; candidate >= 0; candidate--) {
        const hpTable = hpTables[candidate];
        const healTable = healTables[candidate];
        const value = hpTable[7] + healTable[7];
        fixedTwoEhpUpperScores[candidate] = value;
        const next = fixedTwoEhpUpperSuffixMax[candidate + 1];
        fixedTwoEhpUpperSuffixMax[candidate] = value > next ? value : next;
      }
      for (let row = 0; row < listLength; row++) {
        const rowMaskOffset = row * listLength;
        const hpTable = hpTables[row];
        const healTable = healTables[row];
        for (let baseMask = 0; baseMask < 8; baseMask++) {
          const offset = ((row << 3) + baseMask) * suffixSpan;
          fixedTwoEhpSuffixBestByBase[offset + listLength] = -Infinity;
          for (let candidate = listLength - 1; candidate >= 0; candidate--) {
            const mask = baseMask | pairMasks[rowMaskOffset + candidate];
            const value = hpTable[mask] + healTable[mask];
            const next = fixedTwoEhpSuffixBestByBase[offset + candidate + 1];
            fixedTwoEhpSuffixBestByBase[offset + candidate] = value > next ? value : next;
          }
        }
      }
    }
    const fixedTwoRequiredEhpUpper = fixedTwoEhpUpperScores
      ? fixedTwoEhpUpperScores[0] + fixedTwoEhpUpperScores[1]
      : 0;
    let searchCheckCounter = 0;

    for (let k = 2; k < lengthes[2]; k++) {
      searchCheckCounter += 1;
      if ((searchCheckCounter & SEARCH_CHECK_MASK) === 0 && !(await yieldToSearchUi())) return false;
      const kRow = k * listLength;
      const kIncreasedTable = increasedTables[k];
      const kHpTable = hpTables[k];
      const kHealTable = healTables[k];
      const kChara = nonZero[k];
      const fixedTwoKPrefixEhpUpper = fixedTwoEhpUpperScores
        ? fixedTwoRequiredEhpUpper + fixedTwoEhpUpperScores[k]
        : 0;
      const fixed0BaseK = fixed0BaseMask | pairMasks[fixed0Row + k];
      const fixed1BaseK = fixed1BaseMask | pairMasks[fixed1Row + k];
      const kBaseMask = pairMasks[kRow] | pairMasks[kRow + 1] | pairMasks[kRow + k];
      for (let l = k + 1; l < lengthes[3]; l++) {
        const mStart = l + 1;
        if (mStart >= lengthes[4]) continue;
        const lRow = l * listLength;
        const lIncreasedTable = increasedTables[l];
        const lHpTable = hpTables[l];
        const lHealTable = healTables[l];
        const lChara = nonZero[l];
        const fixedTwoLPrefixEhpUpper = fixedTwoEhpUpperScores
          ? fixedTwoKPrefixEhpUpper + fixedTwoEhpUpperScores[l]
          : 0;
        const fixed0BaseL = fixed0BaseK | pairMasks[fixed0Row + l];
        const fixed1BaseL = fixed1BaseK | pairMasks[fixed1Row + l];
        const kBaseL = kBaseMask | pairMasks[kRow + l];
        const lBaseMask =
          pairMasks[lRow] |
          pairMasks[lRow + 1] |
          pairMasks[lRow + k] |
          pairMasks[lRow + l];
        if (fixedTwoIncreasedSuffixBestByBase && fixedTwoIncreasedUpperSuffixMax) {
          let branchUpper = fixedTwoIncreasedSuffixBestByBase[fixed0BaseL * suffixSpan + mStart];
          const fixed1Upper = fixedTwoIncreasedSuffixBestByBase[((1 << 3) + fixed1BaseL) * suffixSpan + mStart];
          if (fixed1Upper < branchUpper) branchUpper = fixed1Upper;
          const kUpper = fixedTwoIncreasedSuffixBestByBase[((k << 3) + kBaseL) * suffixSpan + mStart];
          if (kUpper < branchUpper) branchUpper = kUpper;
          const lUpper = fixedTwoIncreasedSuffixBestByBase[((l << 3) + lBaseMask) * suffixSpan + mStart];
          if (lUpper < branchUpper) branchUpper = lUpper;
          const suffixUpper = fixedTwoIncreasedUpperSuffixMax[mStart];
          if (suffixUpper < branchUpper) branchUpper = suffixUpper;
          let branchSecondaryUpper = Infinity;
          if (fixedTwoEhpSuffixBestByBase && fixedTwoEhpUpperSuffixMax) {
            branchSecondaryUpper =
              fixedTwoEhpSuffixBestByBase[fixed0BaseL * suffixSpan + mStart] +
              fixedTwoEhpSuffixBestByBase[((1 << 3) + fixed1BaseL) * suffixSpan + mStart] +
              fixedTwoEhpSuffixBestByBase[((k << 3) + kBaseL) * suffixSpan + mStart] +
              fixedTwoEhpSuffixBestByBase[((l << 3) + lBaseMask) * suffixSpan + mStart] +
              fixedTwoEhpUpperSuffixMax[mStart];
          }
          if (!fixedTwoCanBeatThreshold(branchUpper, branchSecondaryUpper)) {
            const skipped = lengthes[4] - mStart;
            incrementDebugCounter('fixedTwoIncreasedBranchSkip', skipped);
            nowResultsCount += skipped;
            continue;
          }
        }
        for (let m = mStart; m < lengthes[4]; m++) {
          const mRow = m * listLength;
          const mIncreasedTable = increasedTables[m];
          const mHpTable = hpTables[m];
          const mHealTable = healTables[m];
          const fixed0Mask = fixed0BaseL | pairMasks[fixed0Row + m];
          const fixed1Mask = fixed1BaseL | pairMasks[fixed1Row + m];
          const kMask = kBaseL | pairMasks[kRow + m];
          const lMask = lBaseMask | pairMasks[lRow + m];
          const mMask =
            pairMasks[mRow] |
            pairMasks[mRow + 1] |
            pairMasks[mRow + k] |
            pairMasks[mRow + l] |
            pairMasks[mRow + m];

          let increasedHpBuddy = fixed0IncreasedTable[fixed0Mask];
          const fixed1Increased = fixed1IncreasedTable[fixed1Mask];
          if (fixed1Increased < increasedHpBuddy) increasedHpBuddy = fixed1Increased;
          const kIncreased = kIncreasedTable[kMask];
          if (kIncreased < increasedHpBuddy) increasedHpBuddy = kIncreased;
          const lIncreased = lIncreasedTable[lMask];
          if (lIncreased < increasedHpBuddy) increasedHpBuddy = lIncreased;
          const mIncreased = mIncreasedTable[mMask];
          if (mIncreased < increasedHpBuddy) increasedHpBuddy = mIncreased;
          const primaryScore = Math.floor(increasedHpBuddy);
          if (primaryScore < minIncreasedHpBuddy || !metricPrimaryShouldConsider(primaryScore)) {
            nowResultsCount += 1;
            continue;
          }
          if (
            fixedTwoEhpUpperScores &&
            !fixedTwoCanBeatThreshold(primaryScore, fixedTwoLPrefixEhpUpper + fixedTwoEhpUpperScores[m])
          ) {
            incrementDebugCounter('fixedTwoIncreasedEhpUpperSkip');
            nowResultsCount += 1;
            continue;
          }

          const hp =
            fixed0HpTable[fixed0Mask] +
            fixed1HpTable[fixed1Mask] +
            kHpTable[kMask] +
            lHpTable[lMask] +
            mHpTable[mMask];
          if (hp < minHP) {
            nowResultsCount += 1;
            continue;
          }
          const ehp =
            hp +
            fixed0HealTable[fixed0Mask] +
            fixed1HealTable[fixed1Mask] +
            kHealTable[kMask] +
            lHealTable[lMask] +
            mHealTable[mMask];
          if (ehp < minEHP) {
            nowResultsCount += 1;
            continue;
          }
          if (metricPrimaryFastHasSecondary && !fixedTwoCanBeatThreshold(primaryScore, ehp)) {
            nowResultsCount += 1;
            continue;
          }

          addMetricPrimaryFastEntry(primaryScore, ehp, fixed0Chara, fixed1Chara, kChara, lChara, nonZero[m]);
          nowResultsCount += 1;
        }
      }
    }
    return true;
  };

  markTiming('afterSearchSetupMs');

  let fixedEvasion = 0;
  let fixedBuff = 0;
  let fixedDebuff = 0;
  let fixedCosmic = 0;
  let fixedFire = 0;
  let fixedWater = 0;
  let fixedFlora = 0;
  let fixedHealCards = 0;
  for (let i = 0; i < requiredCount; i++) {
    const charaAny = nonZero[i] as any;
    fixedEvasion += nonZero[i].evasion;
    fixedBuff += (charaAny.totalBuffCached as number) ?? 0;
    fixedDebuff += (charaAny.totalDebuffCached as number) ?? 0;
    fixedCosmic += (charaAny.magicCosmicCountCached as number) ?? 0;
    fixedFire += (charaAny.magicFireCountCached as number) ?? 0;
    fixedWater += (charaAny.magicWaterCountCached as number) ?? 0;
    fixedFlora += (charaAny.magicFloraCountCached as number) ?? 0;
    fixedHealCards += (charaAny.healCardCountCached as number) ?? 0;
  }
  const canUseFixedThreeDamageFastPath =
    (globalThis as any).__TWST_DISABLE_DECK_SEARCH_FAST_PATH__ !== true &&
    shouldUsePrimaryUpperBound &&
    !settings.allowSameCharacter &&
    requiredCount === 3 &&
    sortCompareLen === 1 &&
    sortCriteria[0].order === '降順' &&
    primaryDamageUpperMetric !== 0 &&
    snapshot.attackNum >= 10 &&
    skipMustCheckForCalcDeckStatus &&
    snapshot.minDuo === 0 &&
    snapshot.minHPBuddy === 0 &&
    snapshot.minIncreasedHPBuddy === 0 &&
    snapshot.minReferenceDamage === 0 &&
    snapshot.minReferenceAdvantageDamage === 0 &&
    snapshot.minReferenceVsHiDamage === 0 &&
    snapshot.minReferenceVsMizuDamage === 0 &&
    snapshot.minReferenceVsKiDamage === 0;

  if (canUseFixedThreeDamageFastPath) {
    markFastPath('fixed-three-damage-primary');
    const total = ((listLength - 3) * (listLength - 4)) / 2;
    controls.setTotalResults(total);
    combination[0] = nonZero[0];
    combination[1] = nonZero[1];
    combination[2] = nonZero[2];
    const fixedRequiredPrimaryUpperScore =
      nonZeroPrimaryUpperScores![0] +
      nonZeroPrimaryUpperScores![1] +
      nonZeroPrimaryUpperScores![2];
    const fixed0 = nonZero[0];
    const fixed1 = nonZero[1];
    const fixed2 = nonZero[2];
    const fixed0Any = fixed0 as any;
    const fixed1Any = fixed1 as any;
    const fixed2Any = fixed2 as any;
    const fixed0Id = fixed0Any.charaId as number;
    const fixed1Id = fixed1Any.charaId as number;
    const fixed2Id = fixed2Any.charaId as number;
    const fixed0DuoId = fixed0Any.duoId as number;
    const fixed1DuoId = fixed1Any.duoId as number;
    const fixed2DuoId = fixed2Any.duoId as number;
    const fixed0UseM2 = fixed0Any.useM2Cached as boolean;
    const fixed1UseM2 = fixed1Any.useM2Cached as boolean;
    const fixed2UseM2 = fixed2Any.useM2Cached as boolean;
    const fixed0DuoBase = (fixed0Any.magic2IsDuoBaseCached as boolean) === true;
    const fixed1DuoBase = (fixed1Any.magic2IsDuoBaseCached as boolean) === true;
    const fixed2DuoBase = (fixed2Any.magic2IsDuoBaseCached as boolean) === true;
    const fixed0Buddy1Id = fixed0Any.buddy1IdCached as number;
    const fixed0Buddy2Id = fixed0Any.buddy2IdCached as number;
    const fixed0Buddy3Id = fixed0Any.buddy3IdCached as number;
    const fixed1Buddy1Id = fixed1Any.buddy1IdCached as number;
    const fixed1Buddy2Id = fixed1Any.buddy2IdCached as number;
    const fixed1Buddy3Id = fixed1Any.buddy3IdCached as number;
    const fixed2Buddy1Id = fixed2Any.buddy1IdCached as number;
    const fixed2Buddy2Id = fixed2Any.buddy2IdCached as number;
    const fixed2Buddy3Id = fixed2Any.buddy3IdCached as number;
    const fixed0BaseBuddyMask =
      (fixed0Buddy1Id === fixed0Id || fixed0Buddy1Id === fixed1Id || fixed0Buddy1Id === fixed2Id ? 1 : 0) |
      (fixed0Buddy2Id === fixed0Id || fixed0Buddy2Id === fixed1Id || fixed0Buddy2Id === fixed2Id ? 2 : 0) |
      (fixed0Buddy3Id === fixed0Id || fixed0Buddy3Id === fixed1Id || fixed0Buddy3Id === fixed2Id ? 4 : 0);
    const fixed1BaseBuddyMask =
      (fixed1Buddy1Id === fixed0Id || fixed1Buddy1Id === fixed1Id || fixed1Buddy1Id === fixed2Id ? 1 : 0) |
      (fixed1Buddy2Id === fixed0Id || fixed1Buddy2Id === fixed1Id || fixed1Buddy2Id === fixed2Id ? 2 : 0) |
      (fixed1Buddy3Id === fixed0Id || fixed1Buddy3Id === fixed1Id || fixed1Buddy3Id === fixed2Id ? 4 : 0);
    const fixed2BaseBuddyMask =
      (fixed2Buddy1Id === fixed0Id || fixed2Buddy1Id === fixed1Id || fixed2Buddy1Id === fixed2Id ? 1 : 0) |
      (fixed2Buddy2Id === fixed0Id || fixed2Buddy2Id === fixed1Id || fixed2Buddy2Id === fixed2Id ? 2 : 0) |
      (fixed2Buddy3Id === fixed0Id || fixed2Buddy3Id === fixed1Id || fixed2Buddy3Id === fixed2Id ? 4 : 0);
    const fixed0DamageTable = fixed0Any.primaryDamageTop2ByMaskCached as Float64Array;
    const fixed1DamageTable = fixed1Any.primaryDamageTop2ByMaskCached as Float64Array;
    const fixed2DamageTable = fixed2Any.primaryDamageTop2ByMaskCached as Float64Array;
    const fixed0HpTable = fixed0Any.hpByBuddyMaskCached as Float64Array;
    const fixed1HpTable = fixed1Any.hpByBuddyMaskCached as Float64Array;
    const fixed2HpTable = fixed2Any.hpByBuddyMaskCached as Float64Array;
    const fixed0HealTable = fixed0Any.healByBuddyMaskCached as Float64Array;
    const fixed1HealTable = fixed1Any.healByBuddyMaskCached as Float64Array;
    const fixed2HealTable = fixed2Any.healByBuddyMaskCached as Float64Array;
    const metricOffset = getDamageMetricTableIndex(primaryDamageUpperMetric) << 4;
    const needsFixedHpCheck = snapshot.minHP > 0 || snapshot.minEHP > 0;
    const candidateCharaIds = new Int16Array(listLength);
    const candidateDuoIds = new Int16Array(listLength);
    const candidateUseM2 = new Uint8Array(listLength);
    const candidateDuoBase = new Uint8Array(listLength);
    const candidateBuddyBaseMasks = new Uint8Array(listLength);
    const candidateBuddy1Ids = new Int16Array(listLength);
    const candidateBuddy2Ids = new Int16Array(listLength);
    const candidateBuddy3Ids = new Int16Array(listLength);
    const candidateEvasion = new Float64Array(listLength);
    const candidateBuff = new Float64Array(listLength);
    const candidateDebuff = new Float64Array(listLength);
    const candidateCosmic = new Float64Array(listLength);
    const candidateFire = new Float64Array(listLength);
    const candidateWater = new Float64Array(listLength);
    const candidateFlora = new Float64Array(listLength);
    const candidateHealCards = new Float64Array(listLength);
    const candidateDamageTables = new Array<Float64Array>(listLength);
    const candidateHpTables = new Array<Float64Array>(listLength);
    const candidateHealTables = new Array<Float64Array>(listLength);
    for (let i = 0; i < listLength; i++) {
      const chara = nonZero[i];
      const charaAny = chara as any;
      const charaId = charaAny.charaId as number;
      const buddy1Id = charaAny.buddy1IdCached as number;
      const buddy2Id = charaAny.buddy2IdCached as number;
      const buddy3Id = charaAny.buddy3IdCached as number;
      candidateCharaIds[i] = charaId;
      candidateDuoIds[i] = charaAny.duoId as number;
      candidateUseM2[i] = (charaAny.useM2Cached as boolean) ? 1 : 0;
      candidateDuoBase[i] = (charaAny.magic2IsDuoBaseCached as boolean) === true ? 1 : 0;
      candidateBuddy1Ids[i] = buddy1Id;
      candidateBuddy2Ids[i] = buddy2Id;
      candidateBuddy3Ids[i] = buddy3Id;
      candidateBuddyBaseMasks[i] =
        (buddy1Id === fixed0Id || buddy1Id === fixed1Id || buddy1Id === fixed2Id || buddy1Id === charaId ? 1 : 0) |
        (buddy2Id === fixed0Id || buddy2Id === fixed1Id || buddy2Id === fixed2Id || buddy2Id === charaId ? 2 : 0) |
        (buddy3Id === fixed0Id || buddy3Id === fixed1Id || buddy3Id === fixed2Id || buddy3Id === charaId ? 4 : 0);
      candidateEvasion[i] = chara.evasion;
      candidateBuff[i] = (charaAny.totalBuffCached as number) ?? 0;
      candidateDebuff[i] = (charaAny.totalDebuffCached as number) ?? 0;
      candidateCosmic[i] = (charaAny.magicCosmicCountCached as number) ?? 0;
      candidateFire[i] = (charaAny.magicFireCountCached as number) ?? 0;
      candidateWater[i] = (charaAny.magicWaterCountCached as number) ?? 0;
      candidateFlora[i] = (charaAny.magicFloraCountCached as number) ?? 0;
      candidateHealCards[i] = (charaAny.healCardCountCached as number) ?? 0;
      candidateDamageTables[i] = charaAny.primaryDamageTop2ByMaskCached as Float64Array;
      candidateHpTables[i] = charaAny.hpByBuddyMaskCached as Float64Array;
      candidateHealTables[i] = charaAny.healByBuddyMaskCached as Float64Array;
    }
    let searchCheckCounter = 0;
    const previousAppendIntermediateResultsOnYield = appendIntermediateResultsOnYield;
    appendIntermediateResultsOnYield = true;

    try {
    for (let l = 3; l < listLength - 1; l++) {
      const lChara = nonZero[l];
      const lId = candidateCharaIds[l];
      const lDuoId = candidateDuoIds[l];
      const lUseM2 = candidateUseM2[l] !== 0;
      const lDuoBase = candidateDuoBase[l] !== 0;
      const lBuddy1Id = candidateBuddy1Ids[l];
      const lBuddy2Id = candidateBuddy2Ids[l];
      const lBuddy3Id = candidateBuddy3Ids[l];
      const lDamageTable = candidateDamageTables[l];
      const lHpTable = candidateHpTables[l];
      const lHealTable = candidateHealTables[l];
      const lEvasion = candidateEvasion[l];
      const lBuff = candidateBuff[l];
      const lDebuff = candidateDebuff[l];
      const lCosmic = candidateCosmic[l];
      const lFire = candidateFire[l];
      const lWater = candidateWater[l];
      const lFlora = candidateFlora[l];
      const lHealCards = candidateHealCards[l];
      const lBaseBuddyMask = candidateBuddyBaseMasks[l];
      const remainingCount = listLength - l - 1;
      const pairPrefixUpper = fixedRequiredPrimaryUpperScore + nonZeroPrimaryUpperScores![l];
      if (!resultsManager.shouldConsider(pairPrefixUpper + nonZeroPrimaryUpperSuffixMax![l + 1])) {
        nowResultsCount += remainingCount;
        continue;
      }
      for (let m = l + 1; m < listLength; m++) {
        searchCheckCounter += 1;
        if ((searchCheckCounter & SEARCH_CHECK_MASK) === 0 && !(await yieldToSearchUi())) return;
        if (!resultsManager.shouldConsider(pairPrefixUpper + nonZeroPrimaryUpperScores![m])) {
          nowResultsCount += listLength - m;
          break;
        }
        const mChara = nonZero[m];
        const mId = candidateCharaIds[m];
        if (
          fixedEvasion + lEvasion + candidateEvasion[m] < snapshot.minEvasion ||
          fixedBuff + lBuff + candidateBuff[m] < snapshot.minBuff ||
          fixedDebuff + lDebuff + candidateDebuff[m] < snapshot.minDebuff ||
          fixedCosmic + lCosmic + candidateCosmic[m] < snapshot.minCosmic ||
          fixedFire + lFire + candidateFire[m] < snapshot.minFire ||
          fixedWater + lWater + candidateWater[m] < snapshot.minWater ||
          fixedFlora + lFlora + candidateFlora[m] < snapshot.minFlora ||
          fixedHealCards + lHealCards + candidateHealCards[m] < snapshot.minHealNum
        ) {
          nowResultsCount += 1;
          continue;
        }

        let fixed0BuddyMask = fixed0BaseBuddyMask;
        if (fixed0Buddy1Id === lId || fixed0Buddy1Id === mId) fixed0BuddyMask |= 1;
        if (fixed0Buddy2Id === lId || fixed0Buddy2Id === mId) fixed0BuddyMask |= 2;
        if (fixed0Buddy3Id === lId || fixed0Buddy3Id === mId) fixed0BuddyMask |= 4;
        let fixed1BuddyMask = fixed1BaseBuddyMask;
        if (fixed1Buddy1Id === lId || fixed1Buddy1Id === mId) fixed1BuddyMask |= 1;
        if (fixed1Buddy2Id === lId || fixed1Buddy2Id === mId) fixed1BuddyMask |= 2;
        if (fixed1Buddy3Id === lId || fixed1Buddy3Id === mId) fixed1BuddyMask |= 4;
        let fixed2BuddyMask = fixed2BaseBuddyMask;
        if (fixed2Buddy1Id === lId || fixed2Buddy1Id === mId) fixed2BuddyMask |= 1;
        if (fixed2Buddy2Id === lId || fixed2Buddy2Id === mId) fixed2BuddyMask |= 2;
        if (fixed2Buddy3Id === lId || fixed2Buddy3Id === mId) fixed2BuddyMask |= 4;
        let lBuddyMask = lBaseBuddyMask;
        if (lBuddy1Id === mId) lBuddyMask |= 1;
        if (lBuddy2Id === mId) lBuddyMask |= 2;
        if (lBuddy3Id === mId) lBuddyMask |= 4;
        let mBuddyMask = candidateBuddyBaseMasks[m];
        if (candidateBuddy1Ids[m] === lId) mBuddyMask |= 1;
        if (candidateBuddy2Ids[m] === lId) mBuddyMask |= 2;
        if (candidateBuddy3Ids[m] === lId) mBuddyMask |= 4;

        const mHpTable = candidateHpTables[m];
        const mHealTable = candidateHealTables[m];
        if (needsFixedHpCheck) {
          const hp =
            fixed0HpTable[fixed0BuddyMask] +
            fixed1HpTable[fixed1BuddyMask] +
            fixed2HpTable[fixed2BuddyMask] +
            lHpTable[lBuddyMask] +
            mHpTable[mBuddyMask];
          if (hp < snapshot.minHP) {
            nowResultsCount += 1;
            continue;
          }
          if (
            hp +
            fixed0HealTable[fixed0BuddyMask] +
            fixed1HealTable[fixed1BuddyMask] +
            fixed2HealTable[fixed2BuddyMask] +
            lHealTable[lBuddyMask] +
            mHealTable[mBuddyMask] < snapshot.minEHP
          ) {
            nowResultsCount += 1;
            continue;
          }
        }

        const mDamageTable = candidateDamageTables[m];
        const duoUpperScore = Math.floor(
          fixed0DamageTable[metricOffset + 8 + fixed0BuddyMask] +
          fixed1DamageTable[metricOffset + 8 + fixed1BuddyMask] +
          fixed2DamageTable[metricOffset + 8 + fixed2BuddyMask] +
          lDamageTable[metricOffset + 8 + lBuddyMask] +
          mDamageTable[metricOffset + 8 + mBuddyMask]
        );
        if (!resultsManager.shouldConsider(duoUpperScore)) {
          nowResultsCount += 1;
          continue;
        }

        const mDuoId = candidateDuoIds[m];
        const duoMask = resolveFixedFiveDuoMaskFromIds(
          fixed0Id,
          fixed1Id,
          fixed2Id,
          lId,
          mId,
          fixed0DuoId,
          fixed1DuoId,
          fixed2DuoId,
          lDuoId,
          mDuoId,
          fixed0UseM2,
          fixed1UseM2,
          fixed2UseM2,
          lUseM2,
          candidateUseM2[m] !== 0,
        );
        const primaryScore = Math.floor(
          fixed0DamageTable[metricOffset + ((fixed0DuoBase || (duoMask & 1) !== 0) ? 8 : 0) + fixed0BuddyMask] +
          fixed1DamageTable[metricOffset + ((fixed1DuoBase || (duoMask & 2) !== 0) ? 8 : 0) + fixed1BuddyMask] +
          fixed2DamageTable[metricOffset + ((fixed2DuoBase || (duoMask & 4) !== 0) ? 8 : 0) + fixed2BuddyMask] +
          lDamageTable[metricOffset + ((lDuoBase || (duoMask & 8) !== 0) ? 8 : 0) + lBuddyMask] +
          mDamageTable[metricOffset + ((candidateDuoBase[m] !== 0 || (duoMask & 16) !== 0) ? 8 : 0) + mBuddyMask]
        );
        if (resultsManager.shouldConsider(primaryScore)) {
          const transformedRet = ({ simuURL: '', detailList: emptyDetailList } as DeckResult);
          (transformedRet as any)[sortCompareKeys[0]] = primaryScore;
          const transformedRetAny = transformedRet as any;
          transformedRetAny._deckKey = buildLegacyDeckKey(fixed0, fixed1, fixed2, lChara, mChara);
          const added = resultsManager.addDeck(transformedRet);
          if (added) {
            transformedRetAny._combo0 = fixed0;
            transformedRetAny._combo1 = fixed1;
            transformedRetAny._combo2 = fixed2;
            transformedRetAny._combo3 = lChara;
            transformedRetAny._combo4 = mChara;
          }
        }
        nowResultsCount += 1;
      }
    }
    } finally {
      appendIntermediateResultsOnYield = previousAppendIntermediateResultsOnYield;
    }

    controls.setNowResults(nowResultsCount);
    const topDecks = resultsManager.getTopDecks();
    finalizeTopDecksForRender(topDecks);
    const displayDecks = buildDisplayDecks(topDecks);
    sortTopDecksForDisplay(displayDecks);
    controls.setResults(displayDecks);
    return;
  }

  const lengthes: number[] = [listLength, listLength, listLength, listLength, listLength];
  for(let i = 0; i < requiredCount; i++) {
    lengthes[i] = i+1;
  }
  // 同キャラ編成有り
  if (settings.allowSameCharacter) {
    let lastRenderTime = Date.now();
    let lastAppendedResultsCount = 0;
    let renderCheckCounter = 0;
    let searchCheckCounter = 0;
    const beforeLastLoops = (lengthes[0] * (lengthes[1] - 1) * (lengthes[2] - 2) * (lengthes[3] - 3));
    controls.setTotalResults(beforeLastLoops * (maxLevel.length) / factorialize(4 - requiredCount));
    if (requiredCount == 5) {
      controls.setTotalResults(1);
      combination[0] = nonZero[0];
      combination[1] = nonZero[1];
      combination[2] = nonZero[2];
      combination[3] = nonZero[3];
      combination[4] = nonZero[4];
      processCombinationCore(combination);
      controls.setNowResults(nowResultsCount);
      await waitForBrowserPaint();
      return
    }
    if (canUseHpPrimarySupportFastPath) {
      markFastPath('same-support-hp-primary');
      markTiming('beforeMainLoopMs');
      const completed = await runWithYieldIntermediateResults(() => runSameSupportHpPrimaryFastLoop(lengthes));
      markTiming('afterMainLoopMs');
      if (!completed) return;
      controls.setNowResults(nowResultsCount);
      const topDecks = getMetricPrimaryTopDecks();
      markTiming('afterTopDecksMs');
      finalizeTopDecksForRender(topDecks);
      markTiming('afterFinalizeMs');
      const displayDecks = buildDisplayDecks(topDecks);
      sortTopDecksForDisplay(displayDecks);
      markTiming('afterBuildDisplayMs');
      controls.setResults(displayDecks);
      return;
    }
    if (canUseBasicDuoPrimarySupportFastLoop) {
      markFastPath('same-support-basic-duo-primary-exact');
      preseedBasicDuoSupportExactThreshold(lengthes);
      markTiming('beforeMainLoopMs');
      const completed = await runWithYieldIntermediateResults(() => runSameSupportBasicDuoPrimaryFastLoop(lengthes));
      markTiming('afterMainLoopMs');
      if (!completed) return;
      controls.setNowResults(nowResultsCount);
      const topDecks = getMetricPrimaryTopDecks();
      markTiming('afterTopDecksMs');
      finalizeTopDecksForRender(topDecks);
      markTiming('afterFinalizeMs');
      const displayDecks = buildDisplayDecks(topDecks);
      sortTopDecksForDisplay(displayDecks);
      markTiming('afterBuildDisplayMs');
      controls.setResults(displayDecks);
      return;
    }
    if (canUseIncreasedHpBuddyPrimaryFastPath && supportFastIds) {
      markFastPath('same-support-increased-hp-buddy');
      preseedSameSupportIncreasedHpBuddyThreshold(lengthes);
      markTiming('beforeMainLoopMs');
      const completed = await runWithYieldIntermediateResults(() => runSameSupportIncreasedHpBuddyFastLoop(lengthes));
      markTiming('afterMainLoopMs');
      if (!completed) return;
      controls.setNowResults(nowResultsCount);
      const topDecks = getMetricPrimaryTopDecks();
      markTiming('afterTopDecksMs');
      finalizeTopDecksForRender(topDecks);
      markTiming('afterFinalizeMs');
      const displayDecks = buildDisplayDecks(topDecks);
      sortTopDecksForDisplay(displayDecks);
      markTiming('afterBuildDisplayMs');
      controls.setResults(displayDecks);
      return;
    }
    if (canUseDamagePrimarySupportFastPath) {
      markFastPath('same-support-damage-primary');
      if (requiredCount <= 2) {
        preseedSameSupportDamagePrimaryThreshold(lengthes);
      }
    }
    const shouldConsiderSupportPrimary = (score: number): boolean =>
      canUseDamagePrimarySupportFastPath ? metricPrimaryShouldConsider(score) : resultsManager.shouldConsider(score);
    const damagePrimarySupportOrder =
      canUseDamagePrimarySupportFastPath &&
      requiredCount <= 2 &&
      shouldUsePrimaryUpperBound &&
      maxLevelPrimaryUpperScores !== null
        ? Int32Array.from(
          Array.from({ length: maxLevel.length }, (_, index) => index)
            .sort((a, b) => {
              const diff = maxLevelPrimaryUpperScores[b] - maxLevelPrimaryUpperScores[a];
              if (diff !== 0) return diff;
              return a - b;
            }),
        )
        : null;

    const runSameSupportFixedTwoDamagePrimaryFastLoop = async (): Promise<boolean> => {
      if (
        !canUseDamagePrimarySupportFastPath ||
        requiredCount !== 2 ||
        !metricPrimaryFastEntries ||
        !fastPairBuddyMasks ||
        !fastNormalToSupportBuddyMasks ||
        !fastSupportToNormalBuddyMasks ||
        !fastSupportSelfBuddyMasks ||
        !fastHpTables ||
        !fastHealTables ||
        !supportFastHpTables ||
        !supportFastHealTables ||
        !fastIds ||
        !fastDuoIds ||
        !fastUseM2 ||
        !fastDuoBaseOffsets ||
        !supportFastIds ||
        !supportFastDuoIds ||
        !supportFastUseM2 ||
        !supportFastDuoBaseOffsets ||
        !supportFastDamageTables ||
        !nonZeroPrimaryUpperScores ||
        !maxLevelPrimaryUpperScores
      ) {
        return false;
      }

      const supportOrder = damagePrimarySupportOrder ?? Int32Array.from(
        Array.from({ length: maxLevel.length }, (_, index) => index)
          .sort((a, b) => {
            const diff = maxLevelPrimaryUpperScores[b] - maxLevelPrimaryUpperScores[a];
            if (diff !== 0) return diff;
            return a - b;
          }),
      );
      const supportLength = supportOrder.length;
      const supportEvasion = new Float64Array(supportLength);
      const supportBuff = new Float64Array(supportLength);
      const supportDebuff = new Float64Array(supportLength);
      const supportCosmic = new Float64Array(supportLength);
      const supportFire = new Float64Array(supportLength);
      const supportWater = new Float64Array(supportLength);
      const supportFlora = new Float64Array(supportLength);
      const supportHealNum = new Float64Array(supportLength);
      let maxSupportEvasion = 0;
      let maxSupportBuff = 0;
      let maxSupportDebuff = 0;
      let maxSupportCosmic = 0;
      let maxSupportFire = 0;
      let maxSupportWater = 0;
      let maxSupportFlora = 0;
      let maxSupportHealNum = 0;
      for (let pos = 0; pos < supportLength; pos++) {
        const support = maxLevel[supportOrder[pos]];
        const supportAny = support as any;
        supportEvasion[pos] = support.evasion;
        supportBuff[pos] = ((supportAny.totalBuffCached as number) ?? 0);
        supportDebuff[pos] = ((supportAny.totalDebuffCached as number) ?? 0);
        supportCosmic[pos] = ((supportAny.magicCosmicCountCached as number) ?? 0);
        supportFire[pos] = ((supportAny.magicFireCountCached as number) ?? 0);
        supportWater[pos] = ((supportAny.magicWaterCountCached as number) ?? 0);
        supportFlora[pos] = ((supportAny.magicFloraCountCached as number) ?? 0);
        supportHealNum[pos] = ((supportAny.healCardCountCached as number) ?? 0);
        if (supportEvasion[pos] > maxSupportEvasion) maxSupportEvasion = supportEvasion[pos];
        if (supportBuff[pos] > maxSupportBuff) maxSupportBuff = supportBuff[pos];
        if (supportDebuff[pos] > maxSupportDebuff) maxSupportDebuff = supportDebuff[pos];
        if (supportCosmic[pos] > maxSupportCosmic) maxSupportCosmic = supportCosmic[pos];
        if (supportFire[pos] > maxSupportFire) maxSupportFire = supportFire[pos];
        if (supportWater[pos] > maxSupportWater) maxSupportWater = supportWater[pos];
        if (supportFlora[pos] > maxSupportFlora) maxSupportFlora = supportFlora[pos];
        if (supportHealNum[pos] > maxSupportHealNum) maxSupportHealNum = supportHealNum[pos];
      }

      const pairMasks = fastPairBuddyMasks;
      const normalToSupportMasks = fastNormalToSupportBuddyMasks;
      const supportToNormalMasks = fastSupportToNormalBuddyMasks;
      const supportSelfMasks = fastSupportSelfBuddyMasks;
      const metricOffset = damagePrimaryMetricOffsetForFastSupport;
      const safeNormalDamageUpperByMask = new Float64Array(listLength * 8);
      for (let index = 0; index < listLength; index++) {
        const table = fastThresholdDamageTables![index];
        const base = index << 3;
        for (let mask = 0; mask < 8; mask++) {
          const normal = table[metricOffset + mask];
          const duo = table[metricOffset + 8 + mask];
          safeNormalDamageUpperByMask[base + mask] = duo > normal ? duo : normal;
        }
      }
      const safeSupportDamageUpperByMask = new Float64Array(maxLevel.length * 8);
      for (let index = 0; index < maxLevel.length; index++) {
        const table = supportFastDamageTables[index];
        const base = index << 3;
        for (let mask = 0; mask < 8; mask++) {
          const normal = table[metricOffset + mask];
          const duo = table[metricOffset + 8 + mask];
          safeSupportDamageUpperByMask[base + mask] = duo > normal ? duo : normal;
        }
      }
      const fixed0Row = 0;
      const fixed1Row = listLength;
      const fixed0BaseMask = pairMasks[fixed0Row] | pairMasks[fixed0Row + 1];
      const fixed1BaseMask = pairMasks[fixed1Row] | pairMasks[fixed1Row + 1];
      const fixed0Upper = nonZeroPrimaryUpperScores[0];
      const fixed1Upper = nonZeroPrimaryUpperScores[1];
      const fixed0Id = fastIds[0];
      const fixed1Id = fastIds[1];
      const fixed0DuoId = fastDuoIds[0];
      const fixed1DuoId = fastDuoIds[1];
      const fixed0UseM2 = fastUseM2[0] !== 0;
      const fixed1UseM2 = fastUseM2[1] !== 0;
      const fixed0DuoBase = fastDuoBaseOffsets[0] !== 0;
      const fixed1DuoBase = fastDuoBaseOffsets[1] !== 0;
      const fixed0DamageTable = fastThresholdDamageTables![0];
      const fixed1DamageTable = fastThresholdDamageTables![1];
      const fixed0HpTable = fastHpTables[0];
      const fixed1HpTable = fastHpTables[1];
      const fixed0HealTable = fastHealTables[0];
      const fixed1HealTable = fastHealTables[1];
      const fixed0Any = nonZero[0] as any;
      const fixed1Any = nonZero[1] as any;
      const fixedEvasion = nonZero[0].evasion + nonZero[1].evasion;
      const fixedBuff = ((fixed0Any.totalBuffCached as number) ?? 0) + ((fixed1Any.totalBuffCached as number) ?? 0);
      const fixedDebuff = ((fixed0Any.totalDebuffCached as number) ?? 0) + ((fixed1Any.totalDebuffCached as number) ?? 0);
      const fixedCosmic = ((fixed0Any.magicCosmicCountCached as number) ?? 0) + ((fixed1Any.magicCosmicCountCached as number) ?? 0);
      const fixedFire = ((fixed0Any.magicFireCountCached as number) ?? 0) + ((fixed1Any.magicFireCountCached as number) ?? 0);
      const fixedWater = ((fixed0Any.magicWaterCountCached as number) ?? 0) + ((fixed1Any.magicWaterCountCached as number) ?? 0);
      const fixedFlora = ((fixed0Any.magicFloraCountCached as number) ?? 0) + ((fixed1Any.magicFloraCountCached as number) ?? 0);
      const fixedHealNum = ((fixed0Any.healCardCountCached as number) ?? 0) + ((fixed1Any.healCardCountCached as number) ?? 0);
      const minHP = snapshot.minHP;
      const minEHP = snapshot.minEHP;
      const needsHpCheck = minHP > 0 || minEHP > 0;
      let searchCheckCounter = 0;
      let exactChecks = 0;
      let safeUpperSkips = 0;

      for (let k = 2; k < lengthes[2] - 1; k++) {
        searchCheckCounter += 1;
        if ((searchCheckCounter & SEARCH_CHECK_MASK) === 0 && !(await yieldToSearchUi())) return false;
        const kRow = k * listLength;
        const kChara = nonZero[k];
        const kAny = kChara as any;
        const kUpper = fixed0Upper + fixed1Upper + nonZeroPrimaryUpperScores[k];
        const kEvasion = fixedEvasion + kChara.evasion;
        const kBuff = fixedBuff + ((kAny.totalBuffCached as number) ?? 0);
        const kDebuff = fixedDebuff + ((kAny.totalDebuffCached as number) ?? 0);
        const kCosmic = fixedCosmic + ((kAny.magicCosmicCountCached as number) ?? 0);
        const kFire = fixedFire + ((kAny.magicFireCountCached as number) ?? 0);
        const kWater = fixedWater + ((kAny.magicWaterCountCached as number) ?? 0);
        const kFlora = fixedFlora + ((kAny.magicFloraCountCached as number) ?? 0);
        const kHealNum = fixedHealNum + ((kAny.healCardCountCached as number) ?? 0);
        const fixed0BaseK = fixed0BaseMask | pairMasks[fixed0Row + k];
        const fixed1BaseK = fixed1BaseMask | pairMasks[fixed1Row + k];
        const kBaseMask = pairMasks[kRow] | pairMasks[kRow + 1] | pairMasks[kRow + k];
        const kId = fastIds[k];
        const kDuoId = fastDuoIds[k];
        const kUseM2 = fastUseM2[k] !== 0;
        const kDuoBase = fastDuoBaseOffsets[k] !== 0;
        const kDamageTable = fastThresholdDamageTables![k];
        const kHpTable = fastHpTables[k];
        const kHealTable = fastHealTables[k];

        for (let l = k + 1; l < lengthes[3]; l++) {
          const lRow = l * listLength;
          const lChara = nonZero[l];
          const lAny = lChara as any;
          const prefixUpper = kUpper + nonZeroPrimaryUpperScores[l];
          if (!metricPrimaryShouldConsider(prefixUpper + maxLevelPrimaryUpperMax)) {
            nowResultsCount += supportLength;
            continue;
          }
          const prefixEvasion = kEvasion + lChara.evasion;
          const prefixBuff = kBuff + ((lAny.totalBuffCached as number) ?? 0);
          const prefixDebuff = kDebuff + ((lAny.totalDebuffCached as number) ?? 0);
          const prefixCosmic = kCosmic + ((lAny.magicCosmicCountCached as number) ?? 0);
          const prefixFire = kFire + ((lAny.magicFireCountCached as number) ?? 0);
          const prefixWater = kWater + ((lAny.magicWaterCountCached as number) ?? 0);
          const prefixFlora = kFlora + ((lAny.magicFloraCountCached as number) ?? 0);
          const prefixHealNum = kHealNum + ((lAny.healCardCountCached as number) ?? 0);
          if (
            prefixEvasion + maxSupportEvasion < snapshot.minEvasion ||
            prefixBuff + maxSupportBuff < snapshot.minBuff ||
            prefixDebuff + maxSupportDebuff < snapshot.minDebuff ||
            prefixCosmic + maxSupportCosmic < snapshot.minCosmic ||
            prefixFire + maxSupportFire < snapshot.minFire ||
            prefixWater + maxSupportWater < snapshot.minWater ||
            prefixFlora + maxSupportFlora < snapshot.minFlora ||
            prefixHealNum + maxSupportHealNum < snapshot.minHealNum
          ) {
            nowResultsCount += supportLength;
            continue;
          }
          const fixed0BaseL = fixed0BaseK | pairMasks[fixed0Row + l];
          const fixed1BaseL = fixed1BaseK | pairMasks[fixed1Row + l];
          const kBaseL = kBaseMask | pairMasks[kRow + l];
          const lBaseMask =
            pairMasks[lRow] |
            pairMasks[lRow + 1] |
            pairMasks[lRow + k] |
            pairMasks[lRow + l];
          const lId = fastIds[l];
          const lDuoId = fastDuoIds[l];
          const lUseM2 = fastUseM2[l] !== 0;
          const lDuoBase = fastDuoBaseOffsets[l] !== 0;
          const lDamageTable = fastThresholdDamageTables![l];
          const lHpTable = fastHpTables[l];
          const lHealTable = fastHealTables[l];

          for (let supportPos = 0; supportPos < supportLength; supportPos++) {
            const m = supportOrder[supportPos];
            searchCheckCounter += 1;
            if ((searchCheckCounter & INNER_SEARCH_CHECK_MASK) === 0 && !(await yieldToSearchUi())) return false;
            if (!metricPrimaryShouldConsider(prefixUpper + maxLevelPrimaryUpperScores[m])) {
              nowResultsCount += supportLength - supportPos;
              break;
            }
            if (
              prefixEvasion + supportEvasion[supportPos] < snapshot.minEvasion ||
              prefixBuff + supportBuff[supportPos] < snapshot.minBuff ||
              prefixDebuff + supportDebuff[supportPos] < snapshot.minDebuff ||
              prefixCosmic + supportCosmic[supportPos] < snapshot.minCosmic ||
              prefixFire + supportFire[supportPos] < snapshot.minFire ||
              prefixWater + supportWater[supportPos] < snapshot.minWater ||
              prefixFlora + supportFlora[supportPos] < snapshot.minFlora ||
              prefixHealNum + supportHealNum[supportPos] < snapshot.minHealNum
            ) {
              nowResultsCount += 1;
              continue;
            }

            const supportOffset = m * listLength;
            const fixed0Mask = fixed0BaseL | normalToSupportMasks[m];
            const fixed1Mask = fixed1BaseL | normalToSupportMasks[maxLevel.length + m];
            const kMask = kBaseL | normalToSupportMasks[k * maxLevel.length + m];
            const lMask = lBaseMask | normalToSupportMasks[l * maxLevel.length + m];
            const supportMask =
              supportToNormalMasks[supportOffset] |
              supportToNormalMasks[supportOffset + 1] |
              supportToNormalMasks[supportOffset + k] |
              supportToNormalMasks[supportOffset + l] |
              supportSelfMasks[m];
            const safeUpperScore =
              safeNormalDamageUpperByMask[fixed0Mask] +
              safeNormalDamageUpperByMask[8 + fixed1Mask] +
              safeNormalDamageUpperByMask[(k << 3) + kMask] +
              safeNormalDamageUpperByMask[(l << 3) + lMask] +
              safeSupportDamageUpperByMask[(m << 3) + supportMask];
            if (!metricPrimaryShouldConsider(safeUpperScore)) {
              safeUpperSkips += 1;
              nowResultsCount += 1;
              continue;
            }

            if (needsHpCheck) {
              const hp =
                fixed0HpTable[fixed0Mask] +
                fixed1HpTable[fixed1Mask] +
                kHpTable[kMask] +
                lHpTable[lMask] +
                supportFastHpTables[m][supportMask];
              if (
                hp < minHP ||
                (
                  minEHP > 0 &&
                  hp +
                    fixed0HealTable[fixed0Mask] +
                    fixed1HealTable[fixed1Mask] +
                    kHealTable[kMask] +
                    lHealTable[lMask] +
                    supportFastHealTables[m][supportMask] < minEHP
                )
              ) {
                nowResultsCount += 1;
                continue;
              }
            }

            const duoMask = resolveFixedFiveDuoMaskFromIds(
              fixed0Id,
              fixed1Id,
              kId,
              lId,
              supportFastIds[m],
              fixed0DuoId,
              fixed1DuoId,
              kDuoId,
              lDuoId,
              supportFastDuoIds[m],
              fixed0UseM2,
              fixed1UseM2,
              kUseM2,
              lUseM2,
              supportFastUseM2[m] !== 0,
            );
            const primaryRaw =
              fixed0DamageTable[metricOffset + ((fixed0DuoBase || (duoMask & 1) !== 0) ? 8 : 0) + fixed0Mask] +
              fixed1DamageTable[metricOffset + ((fixed1DuoBase || (duoMask & 2) !== 0) ? 8 : 0) + fixed1Mask] +
              kDamageTable[metricOffset + ((kDuoBase || (duoMask & 4) !== 0) ? 8 : 0) + kMask] +
              lDamageTable[metricOffset + ((lDuoBase || (duoMask & 8) !== 0) ? 8 : 0) + lMask] +
              supportFastDamageTables[m][metricOffset + ((supportFastDuoBaseOffsets[m] !== 0 || (duoMask & 16) !== 0) ? 8 : 0) + supportMask];
            const primaryScore = Math.floor(primaryRaw);
            if (metricPrimaryShouldConsider(primaryScore)) {
              addMetricPrimaryFastEntry(primaryScore, 0, nonZero[0], nonZero[1], kChara, lChara, maxLevel[m], true);
            }
            exactChecks += 1;
            nowResultsCount += 1;
          }
        }
      }
      if (debugCounters) {
        debugCounters.sameSupportFixedTwoDamageInlineChecks = exactChecks;
        debugCounters.sameSupportFixedTwoDamageSafeUpperSkip = safeUpperSkips;
      }
      return true;
    };

    let sameSupportFixedTwoDamageBestFirstCancelled = false;
    const tryCompleteSameSupportFixedTwoDamagePrimaryBestFirst = async (): Promise<boolean> => {
      if (
        !canUseDamagePrimarySupportFastPath ||
        requiredCount !== 2 ||
        !metricPrimaryFastEntries ||
        metricPrimaryFastMaxSize <= 0 ||
        !nonZeroPrimaryUpperScores ||
        !maxLevelPrimaryUpperScores ||
        maxLevel.length === 0 ||
        lengthes[3] - 2 < 2
      ) {
        return false;
      }

      const normalPairCount = combinationCount(lengthes[3] - 2, 2);
      if (normalPairCount <= 0) return false;
      const fixedUpper = nonZeroPrimaryUpperScores[0] + nonZeroPrimaryUpperScores[1];
      const pairA = new Int32Array(normalPairCount);
      const pairB = new Int32Array(normalPairCount);
      const pairUpper = new Float64Array(normalPairCount);
      let pairIndex = 0;
      for (let a = 2; a < lengthes[3] - 1; a++) {
        const aUpper = nonZeroPrimaryUpperScores[a];
        for (let b = a + 1; b < lengthes[3]; b++) {
          pairA[pairIndex] = a;
          pairB[pairIndex] = b;
          pairUpper[pairIndex] = aUpper + nonZeroPrimaryUpperScores[b];
          pairIndex += 1;
        }
      }
      const pairOrder = new Int32Array(normalPairCount);
      for (let index = 0; index < normalPairCount; index++) pairOrder[index] = index;
      pairOrder.sort((a, b) => {
        const diff = pairUpper[b] - pairUpper[a];
        if (diff !== 0) return diff;
        const aFirst = pairA[a] - pairA[b];
        return aFirst !== 0 ? aFirst : pairB[a] - pairB[b];
      });

      const supportOrder = damagePrimarySupportOrder ?? Int32Array.from(
        Array.from({ length: maxLevel.length }, (_, index) => index)
          .sort((a, b) => {
            const diff = maxLevelPrimaryUpperScores[b] - maxLevelPrimaryUpperScores[a];
            if (diff !== 0) return diff;
            return a - b;
          }),
      );

      type SameSupportFixedTwoNode = { pairPos: number; supportPos: number; upper: number };
      const heap: SameSupportFixedTwoNode[] = [];
      const visited = new Uint8Array(normalPairCount * supportOrder.length);
      const heapPush = (node: SameSupportFixedTwoNode) => {
        let index = heap.length;
        heap.push(node);
        while (index > 0) {
          const parent = (index - 1) >>> 1;
          if (heap[parent].upper >= node.upper) break;
          heap[index] = heap[parent];
          index = parent;
        }
        heap[index] = node;
      };
      const heapPop = (): SameSupportFixedTwoNode | undefined => {
        const root = heap[0];
        if (root === undefined) return undefined;
        const last = heap.pop()!;
        if (heap.length === 0) return root;
        let index = 0;
        while (true) {
          const left = index * 2 + 1;
          const right = left + 1;
          if (left >= heap.length) break;
          let child = left;
          if (right < heap.length && heap[right].upper > heap[left].upper) child = right;
          if (heap[child].upper <= last.upper) break;
          heap[index] = heap[child];
          index = child;
        }
        heap[index] = last;
        return root;
      };
      const pushNode = (pairPos: number, supportPos: number) => {
        if (pairPos >= normalPairCount || supportPos >= supportOrder.length) return;
        const key = pairPos * supportOrder.length + supportPos;
        if (visited[key] !== 0) return;
        const pair = pairOrder[pairPos];
        const support = supportOrder[supportPos];
        const upper = fixedUpper + pairUpper[pair] + maxLevelPrimaryUpperScores[support];
        if (!metricPrimaryShouldConsider(upper)) return;
        visited[key] = 1;
        heapPush({ pairPos, supportPos, upper });
      };

      const originalEntryCount = metricPrimaryFastEntries.length;
      const originalEntries = originalEntryCount > 0 ? metricPrimaryFastEntries.slice() : null;
      const originalIsSorted = metricPrimaryFastIsSorted;
      const originalNowResultsCount = nowResultsCount;
      let checked = 0;
      let completed = false;
      let searchCheckCounter = 0;
      const maxBestFirstChecks = Math.max(30000, metricPrimaryFastMaxSize * 120);

      pushNode(0, 0);
      while (heap.length > 0) {
        const node = heapPop()!;
        if (!metricPrimaryShouldConsider(node.upper)) {
          completed = true;
          break;
        }
        checked += 1;
        searchCheckCounter += 1;
        if ((searchCheckCounter & SEARCH_CHECK_MASK) === 0 && !(await yieldToSearchUi())) {
          sameSupportFixedTwoDamageBestFirstCancelled = true;
          return false;
        }
        if (checked > maxBestFirstChecks) break;

        const pair = pairOrder[node.pairPos];
        processDamagePrimarySupportCombinationByIndex(
          0,
          1,
          pairA[pair],
          pairB[pair],
          supportOrder[node.supportPos],
        );

        pushNode(node.pairPos + 1, node.supportPos);
        pushNode(node.pairPos, node.supportPos + 1);
      }

      if (heap.length === 0) completed = true;
      if (debugCounters) {
        debugCounters.sameSupportFixedTwoDamageBestFirstChecks = checked;
        debugCounters.sameSupportFixedTwoDamageBestFirstCompleted = completed ? 1 : 0;
      }
      if (completed) {
        nowResultsCount += (normalPairCount * supportOrder.length) - checked;
        return true;
      }

      if (originalEntries) {
        metricPrimaryFastEntries.length = 0;
        metricPrimaryFastEntries.push(...originalEntries);
      } else {
        metricPrimaryFastEntries.length = originalEntryCount;
      }
      metricPrimaryFastIsSorted = originalIsSorted;
      nowResultsCount = originalNowResultsCount;
      updateMetricPrimaryFastThreshold();
      return false;
    };

    if (canUseDamagePrimarySupportFastPath && requiredCount === 2) {
      markTiming('beforeMainLoopMs');
      const completed = await runWithYieldIntermediateResults(() => runSameSupportFixedTwoDamagePrimaryFastLoop());
      if (completed) {
        markTiming('afterMainLoopMs');
        controls.setNowResults(nowResultsCount);
        const topDecks = getMetricPrimaryTopDecks();
        markTiming('afterTopDecksMs');
        finalizeTopDecksForRender(topDecks);
        markTiming('afterFinalizeMs');
        const displayDecks = buildDisplayDecks(topDecks);
        sortTopDecksForDisplay(displayDecks);
        markTiming('afterBuildDisplayMs');
        controls.setResults(displayDecks);
        return;
      }
    }

    for (let i = 0; i < lengthes[0]; i++) {
      if (canUseNoRequiredEarlyPrune) {
        const branchUpper = canUseHpPrimaryUpperBound
          ? hpPrimaryUpperScores![i] + hpPrimaryUpperSuffixTopSums![4][i + 1]
            : shouldUsePrimaryUpperBound
              ? nonZeroPrimaryUpperScores![i] + primaryUpperSuffixTopSums![3][i + 1] + maxLevelPrimaryUpperMax
              : Infinity;
        if (!shouldConsiderSupportPrimary(branchUpper)) {
          nowResultsCount += combinationCount(lengthes[4] - i - 1, 3) * maxLevel.length;
          continue;
        }
      }
      for (let j = i + 1; j < lengthes[1]; j++) {
        if (canUseNoRequiredEarlyPrune) {
          const branchUpper = canUseHpPrimaryUpperBound
            ? hpPrimaryUpperScores![i] + hpPrimaryUpperScores![j] + hpPrimaryUpperSuffixTopSums![3][j + 1]
              : shouldUsePrimaryUpperBound
                ? nonZeroPrimaryUpperScores![i] + nonZeroPrimaryUpperScores![j] +
                  primaryUpperSuffixTopSums![2][j + 1] + maxLevelPrimaryUpperMax
                : Infinity;
          if (!shouldConsiderSupportPrimary(branchUpper)) {
            nowResultsCount += combinationCount(lengthes[4] - j - 1, 2) * maxLevel.length;
            continue;
          }
        }
        for (let k = j + 1; k < lengthes[2]; k++) {
          searchCheckCounter += 1;
          if ((searchCheckCounter & SEARCH_CHECK_MASK) === 0 && !(await yieldToSearchUi())) return;
          if (canUseNoRequiredEarlyPrune) {
            const branchUpper = canUseHpPrimaryUpperBound
              ? hpPrimaryUpperScores![i] + hpPrimaryUpperScores![j] + hpPrimaryUpperScores![k] + hpPrimaryUpperSuffixTopSums![2][k + 1]
                : shouldUsePrimaryUpperBound
                  ? nonZeroPrimaryUpperScores![i] + nonZeroPrimaryUpperScores![j] +
                    nonZeroPrimaryUpperScores![k] + primaryUpperSuffixTopSums![1][k + 1] +
                    maxLevelPrimaryUpperMax
                  : Infinity;
            if (!shouldConsiderSupportPrimary(branchUpper)) {
              nowResultsCount += (lengthes[4] - k - 1) * maxLevel.length;
              continue;
            }
          }
          for (let l = k + 1; l < lengthes[3]; l++) {
            combination[0] = nonZero[i];
            combination[1] = nonZero[j];
            combination[2] = nonZero[k];
            combination[3] = nonZero[l];
            let prefixUpper = 0;
            if (canUseIncreasedHpBuddyPrimaryFastPath) {
              prefixUpper = increasedHpPrimaryUpperScores![i];
              const jUpper = increasedHpPrimaryUpperScores![j];
              if (jUpper < prefixUpper) prefixUpper = jUpper;
              const kUpper = increasedHpPrimaryUpperScores![k];
              if (kUpper < prefixUpper) prefixUpper = kUpper;
              const lUpper = increasedHpPrimaryUpperScores![l];
              if (lUpper < prefixUpper) prefixUpper = lUpper;
              const upperScore = prefixUpper < maxLevelIncreasedHpPrimaryUpperMax
                ? prefixUpper
                : maxLevelIncreasedHpPrimaryUpperMax;
              if (!shouldConsiderSupportPrimary(upperScore)) {
                nowResultsCount += maxLevel.length;
                continue;
              }
            } else if (shouldUsePrimaryUpperBound) {
              prefixUpper =
                nonZeroPrimaryUpperScores![i] +
                nonZeroPrimaryUpperScores![j] +
                nonZeroPrimaryUpperScores![k] +
                nonZeroPrimaryUpperScores![l];
              if (!shouldConsiderSupportPrimary(prefixUpper + maxLevelPrimaryUpperMax)) {
                nowResultsCount += maxLevel.length;
                continue;
              }
            }
            const canUsePreparedDamageSupport =
              canUseDamagePrimarySupportFastPath &&
              requiredCount === 2 &&
              fastPairBuddyMasks !== null;
            let preparedIBaseMask = 0;
            let preparedJBaseMask = 0;
            let preparedKBaseMask = 0;
            let preparedLBaseMask = 0;
            let preparedPrefixEvasion = 0;
            let preparedPrefixBuff = 0;
            let preparedPrefixDebuff = 0;
            let preparedPrefixCosmic = 0;
            let preparedPrefixFire = 0;
            let preparedPrefixWater = 0;
            let preparedPrefixFlora = 0;
            let preparedPrefixHealNum = 0;
            if (canUsePreparedDamageSupport) {
              const pairMasks = fastPairBuddyMasks!;
              const iRow = i * listLength;
              const jRow = j * listLength;
              const kRow = k * listLength;
              const lRow = l * listLength;
              preparedIBaseMask =
                pairMasks[iRow + i] |
                pairMasks[iRow + j] |
                pairMasks[iRow + k] |
                pairMasks[iRow + l];
              preparedJBaseMask =
                pairMasks[jRow + i] |
                pairMasks[jRow + j] |
                pairMasks[jRow + k] |
                pairMasks[jRow + l];
              preparedKBaseMask =
                pairMasks[kRow + i] |
                pairMasks[kRow + j] |
                pairMasks[kRow + k] |
                pairMasks[kRow + l];
              preparedLBaseMask =
                pairMasks[lRow + i] |
                pairMasks[lRow + j] |
                pairMasks[lRow + k] |
                pairMasks[lRow + l];
              const c0 = nonZero[i];
              const c1 = nonZero[j];
              const c2 = nonZero[k];
              const c3 = nonZero[l];
              const c0Any = c0 as any;
              const c1Any = c1 as any;
              const c2Any = c2 as any;
              const c3Any = c3 as any;
              preparedPrefixEvasion = c0.evasion + c1.evasion + c2.evasion + c3.evasion;
              preparedPrefixBuff =
                ((c0Any.totalBuffCached as number) ?? 0) +
                ((c1Any.totalBuffCached as number) ?? 0) +
                ((c2Any.totalBuffCached as number) ?? 0) +
                ((c3Any.totalBuffCached as number) ?? 0);
              preparedPrefixDebuff =
                ((c0Any.totalDebuffCached as number) ?? 0) +
                ((c1Any.totalDebuffCached as number) ?? 0) +
                ((c2Any.totalDebuffCached as number) ?? 0) +
                ((c3Any.totalDebuffCached as number) ?? 0);
              preparedPrefixCosmic =
                ((c0Any.magicCosmicCountCached as number) ?? 0) +
                ((c1Any.magicCosmicCountCached as number) ?? 0) +
                ((c2Any.magicCosmicCountCached as number) ?? 0) +
                ((c3Any.magicCosmicCountCached as number) ?? 0);
              preparedPrefixFire =
                ((c0Any.magicFireCountCached as number) ?? 0) +
                ((c1Any.magicFireCountCached as number) ?? 0) +
                ((c2Any.magicFireCountCached as number) ?? 0) +
                ((c3Any.magicFireCountCached as number) ?? 0);
              preparedPrefixWater =
                ((c0Any.magicWaterCountCached as number) ?? 0) +
                ((c1Any.magicWaterCountCached as number) ?? 0) +
                ((c2Any.magicWaterCountCached as number) ?? 0) +
                ((c3Any.magicWaterCountCached as number) ?? 0);
              preparedPrefixFlora =
                ((c0Any.magicFloraCountCached as number) ?? 0) +
                ((c1Any.magicFloraCountCached as number) ?? 0) +
                ((c2Any.magicFloraCountCached as number) ?? 0) +
                ((c3Any.magicFloraCountCached as number) ?? 0);
              preparedPrefixHealNum =
                ((c0Any.healCardCountCached as number) ?? 0) +
                ((c1Any.healCardCountCached as number) ?? 0) +
                ((c2Any.healCardCountCached as number) ?? 0) +
                ((c3Any.healCardCountCached as number) ?? 0);
            }
            const supportLoopLength = damagePrimarySupportOrder !== null ? damagePrimarySupportOrder.length : maxLevel.length;
            for (let supportPos = 0; supportPos < supportLoopLength; supportPos++) {
              const m = damagePrimarySupportOrder !== null ? damagePrimarySupportOrder[supportPos] : supportPos;
              searchCheckCounter += 1;
              if ((searchCheckCounter & INNER_SEARCH_CHECK_MASK) === 0 && !(await yieldToSearchUi())) return;
              if (canUseIncreasedHpBuddyPrimaryFastPath) {
                const supportUpper = maxLevelIncreasedHpPrimaryUpperScores![m];
                const upperScore = prefixUpper < supportUpper ? prefixUpper : supportUpper;
                if (!shouldConsiderSupportPrimary(upperScore)) {
                  nowResultsCount += 1;
                  continue;
                }
              } else {
                if (
                  shouldUsePrimaryUpperBound &&
                  !shouldConsiderSupportPrimary(prefixUpper + maxLevelPrimaryUpperScores![m])
                ) {
                  if (damagePrimarySupportOrder !== null) {
                    nowResultsCount += supportLoopLength - supportPos;
                    break;
                  }
                  if (canUseNoRequiredEarlyPrune) {
                    nowResultsCount += maxLevel.length - m;
                    break;
                  }
                  nowResultsCount += 1;
                  continue;
                }
              }
              combination[4] = maxLevel[m];
              if (canUseIncreasedHpBuddyPrimaryFastPath) {
                processIncreasedHpBuddyPrimaryCombinationCore(combination, true);
              } else if (canUseDamagePrimarySupportFastPath) {
                if (canUsePreparedDamageSupport) {
                  processDamagePrimaryPreparedSupportCombination(
                    i,
                    j,
                    k,
                    l,
                    m,
                    preparedIBaseMask,
                    preparedJBaseMask,
                    preparedKBaseMask,
                    preparedLBaseMask,
                    preparedPrefixEvasion,
                    preparedPrefixBuff,
                    preparedPrefixDebuff,
                    preparedPrefixCosmic,
                    preparedPrefixFire,
                    preparedPrefixWater,
                    preparedPrefixFlora,
                    preparedPrefixHealNum,
                  );
                } else {
                  processDamagePrimarySupportCombinationByIndex(i, j, k, l, m);
                }
              } else {
                processCombinationCore(combination, true);
              }

              if (APPEND_INTERMEDIATE_RESULTS) {
                renderCheckCounter += 1;
                // 描画判定は回数+時間の2段ゲートで間引く。
                // 目的: 探索中の体感更新を維持しつつ、描画負荷で探索速度を落とさない。
                if (RENDER_CHECK_MASK === 0 || (renderCheckCounter & RENDER_CHECK_MASK) === 0) {
                  const now = Date.now();
                  if (now - lastRenderTime > RENDER_UPDATE_INTERVAL_MS) {
                    if (
                      APPEND_MIN_RESULT_DELTA === 0 ||
                      nowResultsCount - lastAppendedResultsCount >= APPEND_MIN_RESULT_DELTA
                    ) {
                      lastRenderTime = now;
                      lastAppendedResultsCount = nowResultsCount;
                      await appendResult();
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  } else {
    const beforeLastLoops = (lengthes[0] * (lengthes[1] - 1) * (lengthes[2] - 2) * (lengthes[3] - 3));
    controls.setTotalResults(beforeLastLoops * (lengthes[4] - 4) / factorialize(5 - requiredCount));
    if (requiredCount == 5) {
      controls.setTotalResults(1);
      combination[0] = nonZero[0];
      combination[1] = nonZero[1];
      combination[2] = nonZero[2];
      combination[3] = nonZero[3];
      combination[4] = nonZero[4];
      processCombinationCore(combination);
      controls.setNowResults(nowResultsCount);
      await waitForBrowserPaint();
      return
    }
    if (canUseDamagePrimaryFixedTwoFastLoop) {
      markFastPath('fixed-two-damage-primary');
      markTiming('beforeMainLoopMs');
      const completed = await runWithYieldIntermediateResults(() => runFixedTwoDamagePrimaryFastLoop(lengthes));
      markTiming('afterMainLoopMs');
      if (!completed) return;
      controls.setNowResults(nowResultsCount);
      const topDecks = getMetricPrimaryTopDecks();
      markTiming('afterTopDecksMs');
      finalizeTopDecksForRender(topDecks);
      markTiming('afterFinalizeMs');
      const displayDecks = buildDisplayDecks(topDecks);
      sortTopDecksForDisplay(displayDecks);
      markTiming('afterBuildDisplayMs');
      controls.setResults(displayDecks);
      return;
    }
    if (canUseDamagePrimaryNoRequiredFastLoop) {
      markFastPath('no-same-damage-primary');
      markTiming('beforeMainLoopMs');
      const completed = await runWithYieldIntermediateResults(() => runNoSameDamagePrimaryFastLoop(lengthes));
      markTiming('afterMainLoopMs');
      if (!completed) return;
      controls.setNowResults(nowResultsCount);
      const topDecks = getMetricPrimaryTopDecks();
      markTiming('afterTopDecksMs');
      finalizeTopDecksForRender(topDecks);
      markTiming('afterFinalizeMs');
      const displayDecks = buildDisplayDecks(topDecks);
      sortTopDecksForDisplay(displayDecks);
      markTiming('afterBuildDisplayMs');
      controls.setResults(displayDecks);
      return;
    }
    if (canUseBasicDuoPrimaryNoRequiredFastLoop) {
      markFastPath(requiredCount > 0
        ? 'fixed-basic-duo-primary-exact'
        : 'no-same-basic-duo-primary-exact');
      markTiming('beforeMainLoopMs');
      const completed = await runWithYieldIntermediateResults(() => runNoSameBasicDuoPrimaryFastLoop(lengthes));
      markTiming('afterMainLoopMs');
      if (!completed) return;
      controls.setNowResults(nowResultsCount);
      const topDecks = getMetricPrimaryTopDecks();
      markTiming('afterTopDecksMs');
      finalizeTopDecksForRender(topDecks);
      markTiming('afterFinalizeMs');
      const displayDecks = buildDisplayDecks(topDecks);
      sortTopDecksForDisplay(displayDecks);
      markTiming('afterBuildDisplayMs');
      controls.setResults(displayDecks);
      return;
    }
    if (canUseIncreasedHpBuddyFixedTwoFastLoop) {
      markFastPath('fixed-two-increased-hp-buddy');
      preseedFixedTwoIncreasedHpBuddyThreshold(lengthes);
      markTiming('beforeMainLoopMs');
      const completed = await runWithYieldIntermediateResults(() => runFixedTwoIncreasedHpBuddyFastLoop(lengthes));
      markTiming('afterMainLoopMs');
      if (!completed) return;
      controls.setNowResults(nowResultsCount);
      const topDecks = getMetricPrimaryTopDecks();
      markTiming('afterTopDecksMs');
      finalizeTopDecksForRender(topDecks);
      markTiming('afterFinalizeMs');
      const displayDecks = buildDisplayDecks(topDecks);
      sortTopDecksForDisplay(displayDecks);
      markTiming('afterBuildDisplayMs');
      controls.setResults(displayDecks);
      return;
    }
    if (canUseIncreasedHpBuddyPrimaryFastPath) {
      markFastPath('no-same-increased-hp-buddy');
      preseedNoSameIncreasedHpBuddyThreshold(lengthes);
      markTiming('beforeMainLoopMs');
      const completed = await runWithYieldIntermediateResults(() => runNoSameIncreasedHpBuddyFastLoop(lengthes));
      markTiming('afterMainLoopMs');
      if (!completed) return;
      controls.setNowResults(nowResultsCount);
      const topDecks = getMetricPrimaryTopDecks();
      markTiming('afterTopDecksMs');
      finalizeTopDecksForRender(topDecks);
      markTiming('afterFinalizeMs');
      const displayDecks = buildDisplayDecks(topDecks);
      sortTopDecksForDisplay(displayDecks);
      markTiming('afterBuildDisplayMs');
      controls.setResults(displayDecks);
      return;
    }
    if (usesMetricPrimaryFastLoop) {
      markFastPath(canUseHpPrimaryThresholdFastPath
        ? 'no-same-hp-primary-threshold'
        : canUseHpPrimaryFastPath
          ? 'no-same-hp-primary'
          : 'no-same-metric-primary');
      preseedNoSameIncreasedHpBuddyThreshold(lengthes);
      preseedHpPrimaryThreshold(lengthes);
      markTiming('beforeMainLoopMs');
      const completed = await runWithYieldIntermediateResults(() => runNoSameMetricPrimaryFastLoop(lengthes));
      markTiming('afterMainLoopMs');
      if (!completed) return;
      controls.setNowResults(nowResultsCount);
      const topDecks = getMetricPrimaryTopDecks();
      markTiming('afterTopDecksMs');
      finalizeTopDecksForRender(topDecks);
      markTiming('afterFinalizeMs');
      const displayDecks = buildDisplayDecks(topDecks);
      sortTopDecksForDisplay(displayDecks);
      markTiming('afterBuildDisplayMs');
      controls.setResults(displayDecks);
      return;
    }
    if (canUseBasicDuoPrimaryFastPath) {
      markFastPath(requiredCount > 0
        ? 'fixed-basic-duo-primary-exact'
        : 'no-same-basic-duo-primary-exact');
      preseedBasicDuoExactThreshold(lengthes);
    }
    let lastRenderTime = Date.now();
    let lastAppendedResultsCount = 0;
    let renderCheckCounter = 0;
    let searchCheckCounter = 0;

    for (let i = 0; i < lengthes[0]; i++) {
      const iEvasion = noRequiredEvasionScores ? noRequiredEvasionScores[i] : 0;
      const iBuff = noRequiredBuffScores ? noRequiredBuffScores[i] : 0;
      const iDebuff = noRequiredDebuffScores ? noRequiredDebuffScores[i] : 0;
      const iCosmic = noRequiredCosmicScores ? noRequiredCosmicScores[i] : 0;
      const iFire = noRequiredFireScores ? noRequiredFireScores[i] : 0;
      const iWater = noRequiredWaterScores ? noRequiredWaterScores[i] : 0;
      const iFlora = noRequiredFloraScores ? noRequiredFloraScores[i] : 0;
      const iHealNum = noRequiredHealNumScores ? noRequiredHealNumScores[i] : 0;
      if (
        noRequiredAuxPruneEnabled &&
        !noRequiredAuxCouldPass(iEvasion, iBuff, iDebuff, iCosmic, iFire, iWater, iFlora, iHealNum, i + 1, 4)
      ) {
        nowResultsCount += combinationCount(lengthes[4] - i - 1, 4);
        continue;
      }
      for (let j = i + 1; j < lengthes[1]; j++) {
        const ijEvasion = iEvasion + (noRequiredEvasionScores ? noRequiredEvasionScores[j] : 0);
        const ijBuff = iBuff + (noRequiredBuffScores ? noRequiredBuffScores[j] : 0);
        const ijDebuff = iDebuff + (noRequiredDebuffScores ? noRequiredDebuffScores[j] : 0);
        const ijCosmic = iCosmic + (noRequiredCosmicScores ? noRequiredCosmicScores[j] : 0);
        const ijFire = iFire + (noRequiredFireScores ? noRequiredFireScores[j] : 0);
        const ijWater = iWater + (noRequiredWaterScores ? noRequiredWaterScores[j] : 0);
        const ijFlora = iFlora + (noRequiredFloraScores ? noRequiredFloraScores[j] : 0);
        const ijHealNum = iHealNum + (noRequiredHealNumScores ? noRequiredHealNumScores[j] : 0);
        if (
          noRequiredAuxPruneEnabled &&
          !noRequiredAuxCouldPass(ijEvasion, ijBuff, ijDebuff, ijCosmic, ijFire, ijWater, ijFlora, ijHealNum, j + 1, 3)
        ) {
          nowResultsCount += combinationCount(lengthes[4] - j - 1, 3);
          continue;
        }
        for (let k = j + 1; k < lengthes[2]; k++) {
          searchCheckCounter += 1;
          if ((searchCheckCounter & SEARCH_CHECK_MASK) === 0 && !(await yieldToSearchUi())) return;
          const ijkEvasion = ijEvasion + (noRequiredEvasionScores ? noRequiredEvasionScores[k] : 0);
          const ijkBuff = ijBuff + (noRequiredBuffScores ? noRequiredBuffScores[k] : 0);
          const ijkDebuff = ijDebuff + (noRequiredDebuffScores ? noRequiredDebuffScores[k] : 0);
          const ijkCosmic = ijCosmic + (noRequiredCosmicScores ? noRequiredCosmicScores[k] : 0);
          const ijkFire = ijFire + (noRequiredFireScores ? noRequiredFireScores[k] : 0);
          const ijkWater = ijWater + (noRequiredWaterScores ? noRequiredWaterScores[k] : 0);
          const ijkFlora = ijFlora + (noRequiredFloraScores ? noRequiredFloraScores[k] : 0);
          const ijkHealNum = ijHealNum + (noRequiredHealNumScores ? noRequiredHealNumScores[k] : 0);
          if (
            noRequiredAuxPruneEnabled &&
            !noRequiredAuxCouldPass(ijkEvasion, ijkBuff, ijkDebuff, ijkCosmic, ijkFire, ijkWater, ijkFlora, ijkHealNum, k + 1, 2)
          ) {
            nowResultsCount += combinationCount(lengthes[4] - k - 1, 2);
            continue;
          }
          for (let l = k + 1; l < lengthes[3]; l++) {
            combination[0] = nonZero[i];
            combination[1] = nonZero[j];
            combination[2] = nonZero[k];
            combination[3] = nonZero[l];
            const mStart = l + 1;
            const prefixEvasion = ijkEvasion + (noRequiredEvasionScores ? noRequiredEvasionScores[l] : 0);
            const prefixBuff = ijkBuff + (noRequiredBuffScores ? noRequiredBuffScores[l] : 0);
            const prefixDebuff = ijkDebuff + (noRequiredDebuffScores ? noRequiredDebuffScores[l] : 0);
            const prefixCosmic = ijkCosmic + (noRequiredCosmicScores ? noRequiredCosmicScores[l] : 0);
            const prefixFire = ijkFire + (noRequiredFireScores ? noRequiredFireScores[l] : 0);
            const prefixWater = ijkWater + (noRequiredWaterScores ? noRequiredWaterScores[l] : 0);
            const prefixFlora = ijkFlora + (noRequiredFloraScores ? noRequiredFloraScores[l] : 0);
            const prefixHealNum = ijkHealNum + (noRequiredHealNumScores ? noRequiredHealNumScores[l] : 0);
            let prefixUpper = 0;
            if (canUseHpPrimaryUpperBound) {
              const remainingCount = lengthes[4] - mStart;
              if (remainingCount <= 0) continue;
              prefixUpper =
                hpPrimaryUpperScores![i] +
                hpPrimaryUpperScores![j] +
                hpPrimaryUpperScores![k] +
                hpPrimaryUpperScores![l];
              if (!resultsManager.shouldConsider(prefixUpper + hpPrimaryUpperSuffixMax![mStart])) {
                nowResultsCount += remainingCount;
                continue;
              }
            } else if (canUseIncreasedHpBuddyPrimaryFastPath) {
              const remainingCount = lengthes[4] - mStart;
              if (remainingCount <= 0) continue;
              prefixUpper = increasedHpPrimaryUpperScores![i];
              const jUpper = increasedHpPrimaryUpperScores![j];
              if (jUpper < prefixUpper) prefixUpper = jUpper;
              const kUpper = increasedHpPrimaryUpperScores![k];
              if (kUpper < prefixUpper) prefixUpper = kUpper;
              const lUpper = increasedHpPrimaryUpperScores![l];
              if (lUpper < prefixUpper) prefixUpper = lUpper;
              const upperScore = prefixUpper < increasedHpPrimaryUpperSuffixMax![mStart]
                ? prefixUpper
                : increasedHpPrimaryUpperSuffixMax![mStart];
              if (!resultsManager.shouldConsider(upperScore)) {
                nowResultsCount += remainingCount;
                continue;
              }
            } else if (
              canUseBasicDuoPrimaryFastPath &&
              basicDuoSecondaryUpperScores &&
              basicDuoSecondaryUpperSuffixTopSums
            ) {
              const remainingCount = lengthes[4] - mStart;
              if (remainingCount <= 0) continue;
              prefixUpper =
                basicDuoSecondaryUpperScores[i] +
                basicDuoSecondaryUpperScores[j] +
                basicDuoSecondaryUpperScores[k] +
                basicDuoSecondaryUpperScores[l];
              if (!metricPrimaryCouldBeat(5, prefixUpper + basicDuoSecondaryUpperSuffixTopSums[1][mStart])) {
                nowResultsCount += remainingCount;
                continue;
              }
            } else if (shouldUsePrimaryUpperBound) {
              const remainingCount = lengthes[4] - mStart;
              if (remainingCount <= 0) continue;
              prefixUpper =
                nonZeroPrimaryUpperScores![i] +
                nonZeroPrimaryUpperScores![j] +
                nonZeroPrimaryUpperScores![k] +
                nonZeroPrimaryUpperScores![l];
              if (!resultsManager.shouldConsider(prefixUpper + nonZeroPrimaryUpperSuffixMax![mStart])) {
                nowResultsCount += remainingCount;
                continue;
              }
            }
            if (
              noRequiredAuxPruneEnabled &&
              !noRequiredAuxCouldPass(prefixEvasion, prefixBuff, prefixDebuff, prefixCosmic, prefixFire, prefixWater, prefixFlora, prefixHealNum, mStart, 1)
            ) {
              nowResultsCount += lengthes[4] - mStart;
              continue;
            }
            for (let m = l + 1; m < lengthes[4]; m++) {
              searchCheckCounter += 1;
              if ((searchCheckCounter & INNER_SEARCH_CHECK_MASK) === 0 && !(await yieldToSearchUi())) return;
              if (canUseHpPrimaryUpperBound) {
                if (!resultsManager.shouldConsider(prefixUpper + hpPrimaryUpperSuffixMax![m])) {
                  nowResultsCount += lengthes[4] - m;
                  break;
                }
                if (!resultsManager.shouldConsider(prefixUpper + hpPrimaryUpperScores![m])) {
                  nowResultsCount += 1;
                  continue;
                }
              } else if (canUseIncreasedHpBuddyPrimaryFastPath) {
                const suffixUpperScore = prefixUpper < increasedHpPrimaryUpperSuffixMax![m]
                  ? prefixUpper
                  : increasedHpPrimaryUpperSuffixMax![m];
                if (!resultsManager.shouldConsider(suffixUpperScore)) {
                  nowResultsCount += lengthes[4] - m;
                  break;
                }
                const cardUpper = increasedHpPrimaryUpperScores![m];
                const upperScore = prefixUpper < cardUpper ? prefixUpper : cardUpper;
                if (!resultsManager.shouldConsider(upperScore)) {
                  nowResultsCount += 1;
                  continue;
                }
              } else if (
                canUseBasicDuoPrimaryFastPath &&
                basicDuoSecondaryUpperScores &&
                basicDuoSecondaryUpperSuffixTopSums
              ) {
                if (!metricPrimaryCouldBeat(5, prefixUpper + basicDuoSecondaryUpperSuffixTopSums[1][m])) {
                  nowResultsCount += lengthes[4] - m;
                  break;
                }
                if (!metricPrimaryCouldBeat(5, prefixUpper + basicDuoSecondaryUpperScores[m])) {
                  nowResultsCount += 1;
                  continue;
                }
              } else if (
                  shouldUsePrimaryUpperBound &&
                  !resultsManager.shouldConsider(prefixUpper + nonZeroPrimaryUpperScores![m])
                ) {
                  if (canUseNoRequiredEarlyPrune) {
                    nowResultsCount += lengthes[4] - m;
                    break;
                  }
                  nowResultsCount += 1;
                  continue;
              }
              if (
                noRequiredAuxPruneEnabled &&
                !noRequiredAuxCouldPass(
                  prefixEvasion + (noRequiredEvasionScores ? noRequiredEvasionScores[m] : 0),
                  prefixBuff + (noRequiredBuffScores ? noRequiredBuffScores[m] : 0),
                  prefixDebuff + (noRequiredDebuffScores ? noRequiredDebuffScores[m] : 0),
                  prefixCosmic + (noRequiredCosmicScores ? noRequiredCosmicScores[m] : 0),
                  prefixFire + (noRequiredFireScores ? noRequiredFireScores[m] : 0),
                  prefixWater + (noRequiredWaterScores ? noRequiredWaterScores[m] : 0),
                  prefixFlora + (noRequiredFloraScores ? noRequiredFloraScores[m] : 0),
                  prefixHealNum + (noRequiredHealNumScores ? noRequiredHealNumScores[m] : 0),
                  lengthes[4],
                  0,
                )
              ) {
                nowResultsCount += 1;
                continue;
              }
              combination[4] = nonZero[m];
              if (canUseHpPrimaryFastPath) {
                processHpPrimaryCombinationCore(combination);
              } else if (canUseIncreasedHpBuddyPrimaryFastPath) {
                processIncreasedHpBuddyPrimaryCombinationCore(combination);
              } else if (canUseDamagePrimaryFastPath) {
                processDamagePrimaryCombinationCore(combination);
              } else if (canUseBasicDuoPrimaryFastPath) {
                processBasicDuoPrimaryCombinationByIndex(i, j, k, l, m);
              } else {
                processCombinationCore(combination);
              }

              if (APPEND_INTERMEDIATE_RESULTS) {
                renderCheckCounter += 1;
                if (RENDER_CHECK_MASK === 0 || (renderCheckCounter & RENDER_CHECK_MASK) === 0) {
                  const now = Date.now();
                  if (now - lastRenderTime > RENDER_UPDATE_INTERVAL_MS) {
                    if (
                      APPEND_MIN_RESULT_DELTA === 0 ||
                      nowResultsCount - lastAppendedResultsCount >= APPEND_MIN_RESULT_DELTA
                    ) {
                      lastRenderTime = now;
                      lastAppendedResultsCount = nowResultsCount;
                      await appendResult();
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  }
  controls.setNowResults(nowResultsCount);
  const topDecks = metricPrimaryFastEntries ? getMetricPrimaryTopDecks() : resultsManager.getTopDecks();
  finalizeTopDecksForRender(topDecks);
  const displayDecks = buildDisplayDecks(topDecks);
  sortTopDecksForDisplay(displayDecks);
  controls.setResults(displayDecks);
  
}

export interface CharacterCardInfo {
  type: string;
  wikiUrl: string;
  imgSrc: string;
  iconSrc?: string; // アイコン画像のURL (オプショナル)
  elementIconSrc?: string; // 属性アイコンのURL (オプショナル)
}

export function createCharacterInfoMap(
  characters: Character[],
  mainImageUrls?: Record<string, string>,
  iconImageUrls?: Record<string, string>, // アイコン画像の辞書 (キーは日本語名)
  elementIconUrls?: Record<string, string>
): Map<string, CharacterCardInfo> {
  const infoMap = new Map<string, CharacterCardInfo>();
  characters.forEach(character => {
    if (character.name) {
      let cardTypeShort = '';
      if (character.attr) {
        switch (character.attr) {
          case 'アタック':
            cardTypeShort = 'ATK';
            break;
          case 'バランス':
            cardTypeShort = 'BAL';
            break;
          case 'ディフェンス':
            cardTypeShort = 'DEF';
            break;
          default:
            cardTypeShort = character.attr.substring(0, 3).toUpperCase();
            break;
        }
      }
      const imgSrc = mainImageUrls && mainImageUrls[character.name] ? mainImageUrls[character.name] : character.imgUrl;
      const iconSrc = iconImageUrls && iconImageUrls[character.name] ? iconImageUrls[character.name] : undefined; // 日本語名でアイコンを取得

      infoMap.set(character.name, {
        type: cardTypeShort,
        wikiUrl: character.wikiURL,
        imgSrc: imgSrc,
        iconSrc: iconSrc,
      });
    }
  });

  if (elementIconUrls) {
    for (const [elementName, url] of Object.entries(elementIconUrls)) {
      infoMap.set(elementName, { 
        type: 'Element',
        wikiUrl: '',
        imgSrc: url,
      });
    }
  }

  return infoMap;
}

