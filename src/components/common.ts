import { Character, useCharacterStore} from '@/store/characters'
import { parseMagicBuffsFromEtc } from '@/utils/buffParser';
import { useSearchSettingsStore } from '@/store/searchSetting';
import { useSearchResultStore } from '@/store/searchResult';
import { storeToRefs } from 'pinia';
import { DeckSearchResultsManager, type DeckResult } from './TopNResultsManager';
const searchSettingStore = useSearchSettingsStore();
const {
  minEHP,
  minHP,
  minDebuff,
  minBuff,
  minHPBuddy,
  minIncreasedHPBuddy,
  minEvasion,
  minDuo,
  minCosmic,
  minFire,
  minWater,
  minFlora,
  minHealNum,
  minReferenceDamage,
  minReferenceAdvantageDamage,
  minReferenceVsHiDamage,
  minReferenceVsKiDamage,
  minReferenceVsMizuDamage,
  maxResult,
  sortOptions,
  convertedMustCharacters,
  allowSameCharacter,
  attackNum,
  selectedSupportCharacters,
} = storeToRefs(searchSettingStore);
const characterStore = useCharacterStore();
const { characters } = storeToRefs(characterStore);
const searchResultStore = useSearchResultStore();
const { totalResults, nowResults, results, isSearching, errorMessage} = storeToRefs(searchResultStore);
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

// ループ毎に `if` 判定するとオーバーヘッドになるため、
// ビットマスクで「一定回数ごとにだけ」中断/描画更新チェックを行う。
const SEARCH_CHECK_MASK: number = 4095;
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
const magicBuffTotalsCache = new WeakMap<any, { allowM3: boolean; totals: Array<{ atkDelta: number; dmgDelta: number }> }>();
// Opt-250: magic heal の buddyRates をキャッシュ
const magicHealRatesCache = new WeakMap<any, { m1: { hp: number; atk: number; heal: number; conHeal: number }; m2: { hp: number; atk: number; heal: number; conHeal: number }; m3: { hp: number; atk: number; heal: number; conHeal: number } }>();

function getMagicHealRates(chara: Character) {
  const cached = magicHealRatesCache.get(chara as any);
  if (cached) return cached;
  const rates = {
    m1: getBuddyRates(chara.magic1heal),
    m2: getBuddyRates(chara.magic2heal),
    m3: getBuddyRates(chara.magic3heal),
  };
  magicHealRatesCache.set(chara as any, rates);
  return rates;
}
function buildSearchSnapshot(): SearchSnapshot {
  // リアクティブ参照（ref.value）を探索内で都度読むとコストが積み上がるため、
  // 探索開始時点の値をスナップショット化して使い回す。
  return {
    minEHP: minEHP.value,
    minHP: minHP.value,
    minDebuff: minDebuff.value,
    minBuff: minBuff.value,
    minHPBuddy: minHPBuddy.value,
    minIncreasedHPBuddy: minIncreasedHPBuddy.value,
    minEvasion: minEvasion.value,
    minDuo: minDuo.value,
    minCosmic: minCosmic.value,
    minFire: minFire.value,
    minWater: minWater.value,
    minFlora: minFlora.value,
    minHealNum: minHealNum.value,
    minReferenceDamage: minReferenceDamage.value,
    minReferenceAdvantageDamage: minReferenceAdvantageDamage.value,
    minReferenceVsHiDamage: minReferenceVsHiDamage.value,
    minReferenceVsMizuDamage: minReferenceVsMizuDamage.value,
    minReferenceVsKiDamage: minReferenceVsKiDamage.value,
    attackNum: attackNum.value,
  };
}

function getBuffDebuffCountsByMagic(chara: any) {
  const etc = (chara?.etc || '').toString();
  const cached = buffDebuffCache.get(chara);
  if (cached && cached.etc === etc) {
    return cached;
  }

  // indexはM1/M2/M3に合わせて1..3を使用（0は未使用）
  // Opt-50: Uint8Array で小さな配列を軽量化
  const buffByMagic = new Uint8Array(4);
  const debuffByMagic = new Uint8Array(4);
  if (!etc) {
    const entry = { etc, buffByMagic, debuffByMagic };
    buffDebuffCache.set(chara, entry);
    return entry;
  }
  // Opt-25: M指定が無い場合は早期リターン
  if (!etc.includes('(M')) {
    const entry = { etc, buffByMagic, debuffByMagic };
    buffDebuffCache.set(chara, entry);
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
  buffDebuffCache.set(chara, entry);
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
  '継続回復(小)': { hp: 0, atk: 0, heal: 0, conHeal: 0.15 * 3 },
  '継続回復(中)': { hp: 0, atk: 0, heal: 0, conHeal: 0.25 * 3 },
};

const defaultBuddyRates = { hp: 0, atk: 0, heal: 0, conHeal: 0 }; // Opt-48: デフォルトを共有

function getBuddyRates(status: string): { hp: number; atk: number; heal: number; conHeal: number } {
  // Opt-48: 参照を返して生成を回避
  return buddyRateMap[status] ?? defaultBuddyRates;
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
  "属性ダメUP(中)": 0.1005,
  "属性ダメUP(大)": 0.15,
  "属性ダメUP(極大)": 0.27,
};

// etcから抽出した複数バフ合算でダメージを計算（magicNbufは不使用）
// allowM3Overrideは「使用可否」でM3を無効にした場合に解析から外すための上書き
function getMagicBuffTotalsAll(
  chara: Character,
  allowM3Override?: boolean
): Array<{ atkDelta: number; dmgDelta: number }> {
  // M3可否（ストアのhasM3が信頼できない場合に備え、レアでも判断）
  const allowM3 = allowM3Override !== undefined
    ? allowM3Override
    : ((chara as any).hasM3 ?? (chara.rare === 'SSR'));
  const cached = magicBuffTotalsCache.get(chara as any);
  if (cached && cached.allowM3 === allowM3) {
    return cached.totals;
  }

  const parsed = parseMagicBuffsFromEtc(chara as any, { allowM3 });
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
      const prefix = b.buffOption === 'ダメージUP' ? 'ダメUP' : '属性ダメUP';
      const key = `${prefix}(${b.powerOption})`;
      const add = (damageBuffMap as any)[key] || 0;
      totals[idx].dmgDelta += add;
    }
  }

  magicBuffTotalsCache.set(chara as any, { allowM3, totals });
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
    skipMustCheck?: boolean;
    assumePreparedCache?: boolean;
    auxMetricMask?: number;
    damageMetricMask?: number;
    mustIds?: number[];
    snapshot?: SearchSnapshot;
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
  const snapshot = options.snapshot ?? buildSearchSnapshot();
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
    // mustIds は呼び出し側で渡すのが本来の高速経路。
    // 未指定時だけ store から生成する（互換用フォールバック）。
    const mustIds = options.mustIds ?? Array.from(convertedMustCharacters.value).map(name => getCharaId(name as string));
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
    deckTotalHP += baseHP;
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
    const buddy1Id = charaAny.buddy1IdCached as number;
    const buddy2Id = charaAny.buddy2IdCached as number;
    const buddy3Id = charaAny.buddy3IdCached as number;
    const buddy1HpIncrease = charaAny.buddy1HpIncreaseCached as number;
    const buddy2HpIncrease = charaAny.buddy2HpIncreaseCached as number;
    const buddy3HpIncrease = charaAny.buddy3HpIncreaseCached as number;
    const buddy1AtkRate = needAttackRateFromBuddy ? (charaAny.buddy1AtkRateCached as number) : 0;
    const buddy2AtkRate = needAttackRateFromBuddy ? (charaAny.buddy2AtkRateCached as number) : 0;
    const buddy3AtkRate = needAttackRateFromBuddy ? (charaAny.buddy3AtkRateCached as number) : 0;
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
    // Opt-33: Math.min を分岐で置換
    if (needIncreasedHPBuddy && increasedHP < deckMinIncreasedHPBuddy) {
      deckMinIncreasedHPBuddy = increasedHP;
    }
    // HP回復分はキャラ単位で事前計算した値を加算
    const totalHeal = charaAny.totalHealCached as number;
    deckTotalHeal += totalHeal;
    if (includeDetails) {
      healList!.push(totalHeal);
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

      if (usePreparedLinearDamagePath) {
        // 高速経路:
        // ダメージ式を `base + buddyRate * coeff` に事前展開したキャッシュを利用する。
        // ここでは buddyRate を掛けるだけで済むため、文字列パースや分岐を最小化できる。
        if (useM1) {
          magic1Damage =
            (charaAny.m1DamageBaseCached as number) +
            (charaAny.m1DamageBuddyCoeffCached as number) * atkBuddyRate;
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
          if (needReferenceAdvantageDamage) magic2AdvantageDamage = magic2Damage * (charaAny.m2AdvantageRateCached as number);
          if (needReferenceVsHiDamage) magic2vsHiDamage = magic2Damage * (charaAny.m2VsFireCached as number);
          if (needReferenceVsMizuDamage) magic2vsMizuDamage = magic2Damage * (charaAny.m2VsWaterCached as number);
          if (needReferenceVsKiDamage) magic2vsKiDamage = magic2Damage * (charaAny.m2VsWoodCached as number);
        }
        if (useM3) {
          magic3Damage =
            (charaAny.m3DamageBaseCached as number) +
            (charaAny.m3DamageBuddyCoeffCached as number) * atkBuddyRate;
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
        const totalsAll = (useM1 || useM2 || useM3)
          ? (
            (charaAny.magicBuffTotalsCached as Array<{ atkDelta: number; dmgDelta: number }> | undefined)
            ?? getMagicBuffTotalsAll(chara, useM3)
          )
          : null;
        const m1Totals = useM1 ? totalsAll![1] : zeroTotalsRefForDisabledMagic;
        const m2Totals = useM2 ? totalsAll![2] : zeroTotalsRefForDisabledMagic;
        const m3Totals = useM3 ? totalsAll![3] : zeroTotalsRefForDisabledMagic;

        const m1AtkDelta = m1Totals.atkDelta;
        const m1DmgDelta = m1Totals.dmgDelta;
        const m2AtkDelta = m2Totals.atkDelta;
        const m2DmgDelta = m2Totals.dmgDelta;
        const m3AtkDelta = m3Totals.atkDelta;
        const m3DmgDelta = m3Totals.dmgDelta;
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
  const deckEHP = deckTotalHP + deckTotalHeal;
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

function prepareCharacterSearchCache(chara: Character): void {
  const charaAny = chara as any;
  if (charaAny.charaId === undefined) {
    charaAny.charaId = getCharaId(chara.chara);
  }
  if (charaAny.duoId === undefined) {
    charaAny.duoId = chara.duo ? getCharaId(chara.duo) : -1;
  }
  const charaBit = getBitPairById(charaAny.charaId as number);
  charaAny.charaBitLowCached = charaBit.low;
  charaAny.charaBitHighCached = charaBit.high;
  const useM1 = charaAny.hasM1 ?? true;
  const useM2 = charaAny.hasM2 ?? true;
  const useM3 = chara.rare === 'SSR' ? (charaAny.hasM3 ?? true) : false;
  charaAny.useM1Cached = useM1;
  charaAny.useM2Cached = useM2;
  charaAny.useM3Cached = useM3;

  const healRates = getMagicHealRates(chara);
  const magic1Rates = useM1 ? healRates.m1 : emptyHealRates;
  const magic2Rates = useM2 ? healRates.m2 : emptyHealRates;
  const magic3Rates = useM3 ? healRates.m3 : emptyHealRates;
  const hpHeal = (magic1Rates.heal + magic2Rates.heal + magic3Rates.heal) * chara.calcBaseATK;
  const hpConHeal = (magic1Rates.conHeal + magic2Rates.conHeal + magic3Rates.conHeal) * chara.calcBaseHP;
  charaAny.totalHealCached = hpHeal + hpConHeal;
  charaAny.healCardCountCached =
    (useM1 && isHealCard(chara.magic1heal) ? 1 : 0) +
    (useM2 && isHealCard(chara.magic2heal) ? 1 : 0) +
    (useM3 && isHealCard(chara.magic3heal) ? 1 : 0);

  const buddy1Rates = getBuddyRates(chara.buddy1s);
  const buddy2Rates = getBuddyRates(chara.buddy2s);
  const buddy3Rates = getBuddyRates(chara.buddy3s);
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
  charaAny.buddy1HpRateCached = buddy1Rates.hp;
  charaAny.buddy2HpRateCached = buddy2Rates.hp;
  charaAny.buddy3HpRateCached = buddy3Rates.hp;
  const baseHP = chara.calcBaseHP;
  charaAny.buddy1HpIncreaseCached = baseHP * buddy1Rates.hp;
  charaAny.buddy2HpIncreaseCached = baseHP * buddy2Rates.hp;
  charaAny.buddy3HpIncreaseCached = baseHP * buddy3Rates.hp;
  charaAny.buddy1AtkRateCached = buddy1Rates.atk;
  charaAny.buddy2AtkRateCached = buddy2Rates.atk;
  charaAny.buddy3AtkRateCached = buddy3Rates.atk;

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
}

export async function calcDecks(t: (key: string) => string) {
  const charactersValue = characters.value;
  for (let i = 0; i < charactersValue.length; i++) {
    const chara = charactersValue[i];
    if (chara.required && chara.level == 0) {
      errorMessage.value = t('error.requiredCharacter');
      return
    }
  }
  const nonZeroLevelCharacters = charactersValue
    .filter(character => character.level > 0)
    .map(chara => ({
      ...chara,
      calcBaseHP: 0,
      calcBaseATK: 0
    }));
  const selectedSupportCharactersValue = selectedSupportCharacters.value;
  const maxLevelCharacters = charactersValue
    .filter(character => character.rare == 'SSR' && selectedSupportCharactersValue.includes(character.name))
    .map(chara => ({
      ...chara,
      level: 110,
      calcBaseHP: 0,
      calcBaseATK: 0
    }));
  // Opt-132: 配列参照をローカル化
  const nonZero = nonZeroLevelCharacters;
  const maxLevel = maxLevelCharacters;

  for (let i = 0; i < nonZero.length; i++) {
    const chara = nonZero[i];
    let maxLevel = 110;  // Default max level for SSR
    if (chara.rare == 'SR') {
      maxLevel = 90;     // Max level for SR
    } else if (chara.rare == 'R') {
      maxLevel = 70;     // Max level for R
    }
    const bonusHP = chara.base_hp*0.2;
    const bonusATK = chara.base_atk*0.2;
    const HPperLv = (chara.hp - 2*bonusHP - chara.base_hp) / (maxLevel - 1);
    const ATKperLv = (chara.atk - 2*bonusATK - chara.base_atk) / (maxLevel - 1);
    const leveldiff = maxLevel - chara.level;
    chara.calcBaseHP = chara.hp - HPperLv * leveldiff;
    chara.calcBaseATK = chara.atk - ATKperLv * leveldiff;
  }

  for (let i = 0; i < maxLevel.length; i++) {
    const chara = maxLevel[i];
    chara.calcBaseHP = chara.hp;
    chara.calcBaseATK = chara.atk;
  }
  for (let i = 0; i < nonZero.length; i++) {
    prepareCharacterSearchCache(nonZero[i]);
  }
  for (let i = 0; i < maxLevel.length; i++) {
    prepareCharacterSearchCache(maxLevel[i]);
  }

  const listLength = nonZero.length;
  if (listLength < 5) {
    errorMessage.value = t('error.fewCharacter');
    return;
  }
  const snapshot = buildSearchSnapshot();
  nowResults.value = 0;
  // Opt-242: 進捗更新を間引いてリアクティブ更新コストを削減
  // Opt-243: nowResults は描画更新/終了時のみ反映
  let nowResultsCount = 0;
  const availableSortProps = getAvailableSortProps(t);
  // Opt-101: ソート項目のインデックスを辞書化
  const sortPropIndexMap: Record<string, number> = Object.create(null);
  for (let i = 0; i < availableSortProps.length; i++) {
    sortPropIndexMap[availableSortProps[i]] = i;
  }
  // Opt-102: sortOptions の参照をローカル化
  const sortOptionsValue = sortOptions.value;
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
    errorMessage.value = t('search.noSettingOptions');
    return;
  }
  
  async function appendResult(){
    // 中間描画では上位N件のみを更新する。
    // 全候補を配列化してから描画すると、探索より描画の方がボトルネックになりやすい。
    // 効率的な結果管理：既にソート済みの上位N件を取得
    const topDecks = resultsManager.getTopDecks();
    finalizeTopDecksForRender(topDecks);
    const displayDecks = buildDisplayDecks(topDecks);
    sortTopDecksForDisplay(displayDecks);
    results.value = displayDecks;
    nowResults.value = nowResultsCount;
    await new Promise(requestAnimationFrame);
  }
  if (ATK_SORT_KEYS.has(sortCriteria[0].key)) {
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
    errorMessage.value = '必須設定されたキャラが多すぎます';
    return;
  }
  results.value = [];
  
  // 効率的な上位N件管理クラスを初期化
  const resultsManager = new DeckSearchResultsManager(maxResult.value, sortCriteria);
  const mustIds = Array.from(convertedMustCharacters.value).map(name => getCharaId(name as string));
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
  const fillDeckResultCharacters = (combination: Character[], target: DeckResult) => {
    target.chara1 = combination[0].imgUrl;
    target.chara2 = combination[1].imgUrl;
    target.chara3 = combination[2].imgUrl;
    target.chara4 = combination[3].imgUrl;
    target.chara5 = combination[4].imgUrl;
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

  const combination: Character[] = new Array(5);
  const primaryPassOptions = {
    includeDetails: false,
    includeDeckMeta: false,
    skipDamageMetrics: skipDamageMetricsForPrimaryPass,
    skipAuxMetrics: skipAuxMetricsForPrimaryPass,
    skipMustCheck: skipMustCheckForCalcDeckStatus,
    assumePreparedCache: true,
    auxMetricMask: auxMetricMaskForPrimaryPass,
    damageMetricMask: damageMetricMaskForPrimaryPass,
    mustIds,
    snapshot,
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
      combo[0] = c0;
      combo[1] = targetAny._combo1 as Character;
      combo[2] = targetAny._combo2 as Character;
      combo[3] = targetAny._combo3 as Character;
      combo[4] = targetAny._combo4 as Character;
      const detailRet = calcDeckStatus(
        combo,
        detailPassOptions
      );
      if (!detailRet) continue;
      const detailRetArray = detailRet as (string | number)[];
      const detailLen = detailRetArray.length;
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
    }
  };
  const buildDisplayDecks = (topDecks: DeckResult[]): DeckResult[] => {
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
  const processCombinationCore = (currentCombination: Character[]) => {
    // まず軽量計算で「上位Nに入る可能性」を判定し、
    // 可能性がある候補だけを resultsManager に投入する。
    const ret: (string | number)[] | undefined = calcDeckStatus(
      currentCombination,
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
        currentCombination[0].name + '|' +
        currentCombination[1].name + '|' +
        currentCombination[2].name + '|' +
        currentCombination[3].name + '|' +
        currentCombination[4].name;

      const added = resultsManager.addDeck(transformedRet);
      if (added) {
        transformedRetAny._combo0 = currentCombination[0];
        transformedRetAny._combo1 = currentCombination[1];
        transformedRetAny._combo2 = currentCombination[2];
        transformedRetAny._combo3 = currentCombination[3];
        transformedRetAny._combo4 = currentCombination[4];
      }
    }
    nowResultsCount += 1;
  };

  const lengthes: number[] = [listLength, listLength, listLength, listLength, listLength];
  for(let i = 0; i < requiredCount; i++) {
    lengthes[i] = i+1;
  }
  // 同キャラ編成有り
  if (allowSameCharacter.value) {
    let lastRenderTime = Date.now();
    let lastAppendedResultsCount = 0;
    let renderCheckCounter = 0;
    let searchCheckCounter = 0;
    const beforeLastLoops = (lengthes[0] * (lengthes[1] - 1) * (lengthes[2] - 2) * (lengthes[3] - 3));
    totalResults.value = beforeLastLoops*(maxLevel.length)/factorialize(4-requiredCount);
    if (requiredCount == 5) {
      totalResults.value = 1;
      combination[0] = nonZero[0];
      combination[1] = nonZero[1];
      combination[2] = nonZero[2];
      combination[3] = nonZero[3];
      combination[4] = nonZero[4];
      processCombinationCore(combination);
      nowResults.value = nowResultsCount;
      await new Promise(requestAnimationFrame);
      return
    }

    for (let i = 0; i < lengthes[0]; i++) {
      for (let j = i + 1; j < lengthes[1]; j++) {
        for (let k = j + 1; k < lengthes[2]; k++) {
          searchCheckCounter += 1;
          if ((searchCheckCounter & SEARCH_CHECK_MASK) === 0) {
            if (!isSearching.value) {
              nowResults.value = nowResultsCount;
              return;
            }
          }
          for (let l = k + 1; l < lengthes[3]; l++) {
            combination[0] = nonZero[i];
            combination[1] = nonZero[j];
            combination[2] = nonZero[k];
            combination[3] = nonZero[l];
            for (let m = 0; m < maxLevel.length; m++) {
              combination[4] = maxLevel[m];
              processCombinationCore(combination);

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
    totalResults.value = (beforeLastLoops*(lengthes[4]-4)/factorialize(5-requiredCount));
    if (requiredCount == 5) {
      totalResults.value = 1;
      combination[0] = nonZero[0];
      combination[1] = nonZero[1];
      combination[2] = nonZero[2];
      combination[3] = nonZero[3];
      combination[4] = nonZero[4];
      processCombinationCore(combination);
      nowResults.value = nowResultsCount;
      await new Promise(requestAnimationFrame);
      return
    }
    let lastRenderTime = Date.now();
    let lastAppendedResultsCount = 0;
    let renderCheckCounter = 0;
    let searchCheckCounter = 0;

    for (let i = 0; i < lengthes[0]; i++) {
      for (let j = i + 1; j < lengthes[1]; j++) {
        for (let k = j + 1; k < lengthes[2]; k++) {
          searchCheckCounter += 1;
          if ((searchCheckCounter & SEARCH_CHECK_MASK) === 0) {
            if (!isSearching.value) {
              nowResults.value = nowResultsCount;
              return;
            }
          }
          for (let l = k + 1; l < lengthes[3]; l++) {
            combination[0] = nonZero[i];
            combination[1] = nonZero[j];
            combination[2] = nonZero[k];
            combination[3] = nonZero[l];
            for (let m = l + 1; m < lengthes[4]; m++) {
              combination[4] = nonZero[m];
              processCombinationCore(combination);

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
  nowResults.value = nowResultsCount;
  const topDecks = resultsManager.getTopDecks();
  finalizeTopDecksForRender(topDecks);
  const displayDecks = buildDisplayDecks(topDecks);
  sortTopDecksForDisplay(displayDecks);
  results.value = displayDecks;
  
}

// キャッシュされた画像URLの辞書 (モジュールスコープ)
const cachedImageUrls: Record<string, string> = {};

// 汎用的な画像読み込み関数
export async function loadImageUrls(
  items: any[],
  nameAccessor: string | ((item: any) => string),
  prefix: string = ''
): Promise<Record<string, string>> {
  const imageUrlDictionary: Record<string, string> = {};

  // Add notyet.png loading
  const notYetImageName = 'notyet';
  const notYetCacheKey = notYetImageName; // Assuming no prefix for notyet.png
  if (cachedImageUrls[notYetCacheKey]) {
    imageUrlDictionary[notYetImageName] = cachedImageUrls[notYetCacheKey];
  } else {
    try {
      const module = await import(`@/assets/img/${notYetImageName}.webp`) as { default: string };
      const imageUrl = module.default;
      cachedImageUrls[notYetCacheKey] = imageUrl;
      imageUrlDictionary[notYetImageName] = imageUrl;
    } catch (error) {
      console.error(`[loadImageUrls] Error loading ${notYetImageName}.webp:`, error);
      imageUrlDictionary[notYetImageName] = ''; // Set empty string on error
    }
  }

  const imageLoadPromises = items.map(async (item) => {
    let itemName: string | undefined;
    try {
      itemName = typeof nameAccessor === 'function' ? nameAccessor(item) : item[nameAccessor];
      if (typeof itemName !== 'string' || !itemName) {
        console.error(`[loadImageUrls] Invalid or undefined itemName (type: ${typeof itemName}, value: ${itemName}) for item:`, item, `with prefix '${prefix}'. Skipping.`);
        imageUrlDictionary[String(item) || 'unknown_item'] = '';
        return;
      }

      const cacheKey = `${prefix}${itemName}`;
      if (cachedImageUrls[cacheKey]) {
        imageUrlDictionary[itemName] = cachedImageUrls[cacheKey];
        return;
      }

      let module;
      if (prefix === 'icon/') {
        module = await import(`@/assets/img/icon/${itemName}.webp`) as { default: string };
      } else if (prefix === '') {
        module = await import(`@/assets/img/${itemName}.webp`) as { default: string };
      } else {
        console.error(`[loadImageUrls] Unsupported or unknown prefix '${prefix}' for item '${itemName}'. Trying a generic path that might fail.`);
        module = await import(`@/assets/img/${prefix}${itemName}.webp`) as { default: string };
      }
      const imageUrl = module.default;
      cachedImageUrls[cacheKey] = imageUrl;
      imageUrlDictionary[itemName] = imageUrl;
    } catch (error) {
      imageUrlDictionary[itemName || String(item) || 'unknown_error_item'] = '';
    }
  });

  await Promise.all(imageLoadPromises);
  return imageUrlDictionary;
}

// 単一の画像をキャッシュ付きで読み込む関数
export async function loadCachedImageUrl(imageName: string, prefix: string = ''): Promise<string> {
  const cacheKey = `${prefix}${imageName}`;
  if (cachedImageUrls[cacheKey]) {
    return cachedImageUrls[cacheKey];
  }
  let imagePathForLog: string = 'unknown_path'; // ログ出力用のパス変数
  try {
    let module;
    if (prefix === 'icon/') {
      imagePathForLog = `@/assets/img/icon/${imageName}.webp`;
      module = await import(`@/assets/img/icon/${imageName}.webp`) as { default: string };
    } else if (prefix === '') {
      imagePathForLog = `@/assets/img/${imageName}.webp`;
      module = await import(`@/assets/img/${imageName}.webp`) as { default: string };
    } else {
      console.error(`[loadCachedImageUrl] Unsupported or unknown prefix '${prefix}' for item '${imageName}'. Trying a generic path that might fail.`);
      imagePathForLog = `@/assets/img/${prefix}${imageName}.webp`;
      module = await import(`@/assets/img/${prefix}${imageName}.webp`) as { default: string };
    }
    const imageUrl = module.default;
    cachedImageUrls[cacheKey] = imageUrl;
    return imageUrl;
  } catch (error) {
    console.error(`[loadCachedImageUrl] Error loading image '${imageName}' (path: '${imagePathForLog}'):`, error);
    return '';
  }
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

