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
let memberFlags = new Uint32Array(0); // Opt-296: memberFlags を再利用して割り当てを削減
let memberFlagsStamp = 0; // Opt-296: スタンプ方式で初期化コストを削減

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

function getCharaId(name: string): number {
  let id = charaIdMap.get(name);
  if (id === undefined) {
    id = charaIdMap.size;
    charaIdMap.set(name, id);
  }
  return id;
}


// 数値入力で＋とeを弾く
export function checkNumber(input:KeyboardEvent){
  if (input.key === 'e' || input.key === '+') {
    input.preventDefault();
  }
}
// etc文字列からのバフ/デバフ数はM1/M2/M3のON/OFFに連動させるため、
// 1キャラ単位で解析結果をキャッシュして再利用する。
const buffDebuffCache = new WeakMap<any, { etc: string; buffByMagic: number[]; debuffByMagic: number[] }>();
const emptyHealRates = { heal: 0, conHeal: 0 }; // Opt-2: 空オブジェクトの使い回しで生成回数を削減
const emptyDetailList: any[] = []; // Opt-247: 詳細なし時の空配列を共有
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
const buddyPairsCache = new WeakMap<any, Array<{ c: string; s: string; id: number }>>();
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
function getBuddyPairs(chara: Character): Array<{ c: string; s: string; id: number }> {
  const cached = buddyPairsCache.get(chara as any);
  if (cached) return cached;
  const pairs = [
    { c: chara.buddy1c, s: chara.buddy1s, id: chara.buddy1c ? getCharaId(chara.buddy1c) : -1 },
    { c: chara.buddy2c, s: chara.buddy2s, id: chara.buddy2c ? getCharaId(chara.buddy2c) : -1 },
    { c: chara.buddy3c, s: chara.buddy3s, id: chara.buddy3c ? getCharaId(chara.buddy3c) : -1 },
  ];
  buddyPairsCache.set(chara as any, pairs);
  return pairs;
}

function buildSearchSnapshot(): SearchSnapshot {
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

function getMagicBuffTotalsFromEtc(
  chara: Character,
  magicIndex: 1 | 2 | 3,
  allowM3Override?: boolean
): { atkDelta: number; dmgDelta: number } {
  // Opt-129: 全マジック分を一度に取得して参照
  const totals = getMagicBuffTotalsAll(chara, allowM3Override);
  return totals[magicIndex] || { atkDelta: 0, dmgDelta: 0 };
}

function calcDamageUsingEtcTotals(magicPow: string, magicAtr: string, baseAtk: number, atkBuddyRate: number, totals: { atkDelta: number; dmgDelta: number }): number {
  const effectiveAtk = baseAtk * (1 + atkBuddyRate + (totals.atkDelta || 0));
  let atkRate = magicPow.includes('弱') ? 0.75 : 1;
  atkRate *= magicAtr === '無' ? 1.1 : 1;
  atkRate += totals.dmgDelta || 0;

  let comboRate = 1;
  if (magicPow == '連撃(弱)' || magicPow == '連撃(強)') {
    comboRate = 1.8;
  }
  if (magicPow == 'デュオ魔法' || magicPow == '3連撃(弱)' || magicPow == '3連撃(強)') {
    comboRate = 2.4;
  }

  return effectiveAtk * atkRate * comboRate;
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
export function calcDeckStatus(
  characters: Character[],
  options: { includeDetails?: boolean; mustIds?: number[]; snapshot?: SearchSnapshot } = {}
): Array<number | string | any> | undefined {
  const includeDetails = options.includeDetails !== false;
  const snapshot = options.snapshot ?? buildSearchSnapshot();
  const charaLen = characters.length; // Opt-266: length参照をローカル化
  // Opt-296: memberFlags をスタンプ方式で再利用
  if (memberFlags.length < charaIdMap.size + 1) {
    memberFlags = new Uint32Array(charaIdMap.size + 1);
    memberFlagsStamp = 0;
  }
  memberFlagsStamp = (memberFlagsStamp + 1) >>> 0;
  if (memberFlagsStamp === 0) {
    memberFlagsStamp = 1;
    memberFlags.fill(0);
  }
  const charaIds: number[] = new Array(charaLen);
  const duoIds: number[] = new Array(charaLen);
  for (let i = 0; i < charaLen; i++) {
    const chara = characters[i];
    // Opt-232: charaId をキャッシュして Map 参照を削減
    let charaId = (chara as any).charaId;
    if (charaId === undefined) {
      charaId = getCharaId(chara.chara);
      (chara as any).charaId = charaId;
    }
    // Opt-234: duoId をキャッシュして文字列比較を削減
    let duoId = (chara as any).duoId;
    if (duoId === undefined) {
      duoId = chara.duo ? getCharaId(chara.duo) : -1;
      (chara as any).duoId = duoId;
    }
    charaIds[i] = charaId;
    duoIds[i] = duoId;
    memberFlags[charaId] = memberFlagsStamp;
  }
  const mustIds = options.mustIds ?? Array.from(convertedMustCharacters.value).map(name => getCharaId(name as string));
  if (mustIds.length > 0) {
    // Opt-60: every を for ループに置換
    let allMustCharactersIncluded = true;
    for (let i = 0; i < mustIds.length; i++) {
      if (memberFlags[mustIds[i]] !== memberFlagsStamp) {
        allMustCharactersIncluded = false;
        break;
      }
    }
    if (!allMustCharactersIncluded) {
      // もし mustCharactersSet に存在するすべての名前が memberNameSet にない場合、undefined を返す
      return;
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
  const deckReferenceDamageList: number[] | null = useFullSum ? null : [];
  const deckReferenceAdvantageDamageList: number[] | null = useFullSum ? null : [];
  const deckReferenceVsHiDamageList: number[] | null = useFullSum ? null : [];
  const deckReferenceVsMizuDamageList: number[] | null = useFullSum ? null : [];
  const deckReferenceVsKiDamageList: number[] | null = useFullSum ? null : [];
  let deckReferenceDamage = 0;
  let deckReferenceAdvantageDamage = 0;
  let deckReferenceVsHiDamage = 0;
  let deckReferenceVsMizuDamage = 0;
  let deckReferenceVsKiDamage = 0;
  // Opt-44: 使用済みフラグを Uint8Array 化
  const name2M2Used = new Uint8Array(characters.length);
  const name2MotherUsed = new Uint8Array(characters.length);
  const name2DuoUsed = new Uint8Array(characters.length);
  const deckList: string[] = [];
  let simuURL = '';
  const detailList: any[] | null = includeDetails ? [] : null;
  const healList: number[] | null = includeDetails ? [] : null;
  const damageList: number[] | null = includeDetails ? [] : null;
  const advantageDamageList: number[] | null = includeDetails ? [] : null;
  const hiDamageList: number[] | null = includeDetails ? [] : null;
  const mizuDamageList: number[] | null = includeDetails ? [] : null;
  const kiDamageList: number[] | null = includeDetails ? [] : null;
  const topTwoScratch: number[] = [0, 0];

  characters.forEach((chara, index) => {
    const charaAny = chara as any; // Opt-248: any参照の重複取得を削減
    const useM1 = charaAny.hasM1 ?? true;
    const useM2 = charaAny.hasM2 ?? true;
    const useM3 = chara.rare === 'SSR' ? (charaAny.hasM3 ?? true) : false;
    deckList.push(chara.imgUrl);
    if (includeDetails) {
      // Opt-43: encodeURIComponent をキャッシュ
      const encodedName = charaAny.encodedName ?? (charaAny.encodedName = encodeURIComponent(chara.name));
      simuURL += '&name' + (index + 1) + '=' + encodedName;
      simuURL += '&level' + (index + 1) + '=' + chara.level;
    }
    deckTotalHP += chara.calcBaseHP;
    // バフ/デバフ数は使用可能マジックのみ反映する
    const { buffByMagic, debuffByMagic } = getBuffDebuffCountsByMagic(chara);
    if (useM1) {
      deckTotalBuff += buffByMagic[1];
      deckTotalDebuff += debuffByMagic[1];
    }
    if (useM2) {
      deckTotalBuff += buffByMagic[2];
      deckTotalDebuff += debuffByMagic[2];
    }
    if (useM3) {
      deckTotalBuff += buffByMagic[3];
      deckTotalDebuff += debuffByMagic[3];
    }
    // Opt-39: 属性カウントを単一パスで集計
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
    deckCosmic += cosmic;
    deckFire += fire;
    deckWater += water;
    deckFlora += flora;
    let hasHpBuddy = false;
    let atkBuddyRate = 0;
    // バディHP増加分加算
    let increasedHP = 0;
    const buddies = getBuddyPairs(chara);
    for (const buddy of buddies) {
      // Opt-11: buddy id をキャッシュして判定に使用
      if (buddy.id >= 0 && memberFlags[buddy.id] === memberFlagsStamp) {
        deckTotalBuddy += 1;
        const rates = getBuddyRates(buddy.s);
        atkBuddyRate += rates.atk;
        if (rates.hp !== 0) {
          deckTotalHPBuddy += 1;
          hasHpBuddy = true;
          const hpIncrease = chara.calcBaseHP * rates.hp;
          deckTotalHP += hpIncrease;
          increasedHP += hpIncrease;
        }
      }
    }
    // Opt-33: Math.min を分岐で置換
    if (increasedHP < deckMinIncreasedHPBuddy) {
      deckMinIncreasedHPBuddy = increasedHP;
    }
    // HP回復分加算（使用可否を反映）
    const healRates = getMagicHealRates(chara);
    const magic1Rates = useM1 ? healRates.m1 : emptyHealRates;
    const magic2Rates = useM2 ? healRates.m2 : emptyHealRates;
    const magic3Rates = useM3 ? healRates.m3 : emptyHealRates;
    // Opt-85: 合計回復量の再計算を回避
    const hpHeal = (magic1Rates.heal + magic2Rates.heal + magic3Rates.heal) * chara.calcBaseATK;
    const hpConHeal = (magic1Rates.conHeal + magic2Rates.conHeal + magic3Rates.conHeal) * chara.calcBaseHP;
    const totalHeal = hpHeal + hpConHeal;
    deckTotalHeal += totalHeal;
    if (includeDetails) {
      healList!.push(totalHeal);
    }
      
    // Opt-1: 回復手札数の判定で配列生成を避ける
    if (useM1 && isHealCard(chara.magic1heal)) deckHealCards += 1;
    if (useM2 && isHealCard(chara.magic2heal)) deckHealCards += 1;
    if (useM3 && isHealCard(chara.magic3heal)) deckHealCards += 1;
    
    // 回避数加算
    deckTotalEvasion += chara.evasion;
    if (!hasHpBuddy) {
      deckNoHPBuddy += 1;
    }
    let magic2pow = chara.magic2pow;
    if (useM2) {
      const charaId = charaIds[index];
      const duoId = duoIds[index];
      // M2が無効なら自身のデュオ判定をしない
      if (name2DuoUsed[index]) {
        magic2pow = "デュオ魔法";
        deckDuo += 1;
      } else {
        // Opt-45: entries を for ループへ
        for (let index2 = 0; index2 < charaLen; index2++) {
          if (duoIds[index2] === charaId && duoId === charaIds[index2]) {
            if (!name2DuoUsed[index] && !name2DuoUsed[index2]) {
              name2DuoUsed[index] = 1;
              name2DuoUsed[index2] = 1;
              name2M2Used[index] = 1;
              name2M2Used[index2] = 1;
              break;
            }
          }
        }

        if (!name2M2Used[index]) {
          // Opt-45: entries を for ループへ
          for (let index2 = 0; index2 < charaLen; index2++) {
            if (duoId === charaIds[index2]) {
              if (
                !name2DuoUsed[index] &&
                !name2M2Used[index] &&
                !name2MotherUsed[index2]
              ) {
                name2DuoUsed[index] = 1;
                name2M2Used[index] = 1;
                name2MotherUsed[index2] = 1;
                break;
              }
            }
          }
        }

        if (!name2M2Used[index]) {
          // Opt-45: entries を for ループへ
          for (let index2 = 0; index2 < charaLen; index2++) {
            if (duoId === charaIds[index2]) {
              if (
                !name2DuoUsed[index] &&
                !name2M2Used[index] &&
                !name2M2Used[index2]
              ) {
                name2DuoUsed[index] = 1;
                name2M2Used[index] = 1;
                name2M2Used[index2] = 1;
                break;
              }
            }
          }
        }

        if (name2DuoUsed[index]) {
          magic2pow = "デュオ魔法";
          deckDuo += 1;
        }
      }
    }
    // 等倍ダメージ加算（使用可能なマジックのみ・etc→buffs[]の合算を使用）
    // Opt-129: バフ合算を一度だけ取得
    const totalsAll = (useM1 || useM2 || useM3) ? getMagicBuffTotalsAll(chara, useM3) : null;
    const m1Totals = useM1 ? totalsAll![1] : { atkDelta: 0, dmgDelta: 0 };
      const magic1Damage = useM1 ? calcDamageUsingEtcTotals(
        chara.magic1pow,
        chara.magic1atr,
        chara.calcBaseATK,
        atkBuddyRate,
        m1Totals
      ) : 0;
    const m2Totals = useM2 ? totalsAll![2] : { atkDelta: 0, dmgDelta: 0 };
      const magic2Damage = useM2 ? calcDamageUsingEtcTotals(
        magic2pow,
        chara.magic2atr,
        chara.calcBaseATK,
        atkBuddyRate,
        m2Totals
      ) : 0;
    const m3Totals = useM3 ? totalsAll![3] : { atkDelta: 0, dmgDelta: 0 };
      const magic3Damage = useM3 ? calcDamageUsingEtcTotals(
        chara.magic3pow,
        chara.magic3atr,
        chara.calcBaseATK,
        atkBuddyRate,
        m3Totals
      ) : 0;

    // Opt-264: 属性相性の倍率を事前計算
    let m1VsFire = 1;
    let m1VsWater = 1;
    let m1VsWood = 1;
    if (useM1) {
      switch (chara.magic1atr) {
        case '火': m1VsWater = 0.5; m1VsWood = 1.5; break;
        case '水': m1VsFire = 1.5; m1VsWood = 0.5; break;
        case '木': m1VsFire = 0.5; m1VsWater = 1.5; break;
      }
    }
    let m2VsFire = 1;
    let m2VsWater = 1;
    let m2VsWood = 1;
    if (useM2) {
      switch (chara.magic2atr) {
        case '火': m2VsWater = 0.5; m2VsWood = 1.5; break;
        case '水': m2VsFire = 1.5; m2VsWood = 0.5; break;
        case '木': m2VsFire = 0.5; m2VsWater = 1.5; break;
      }
    }
    let m3VsFire = 1;
    let m3VsWater = 1;
    let m3VsWood = 1;
    if (useM3) {
      switch (chara.magic3atr) {
        case '火': m3VsWater = 0.5; m3VsWood = 1.5; break;
        case '水': m3VsFire = 1.5; m3VsWood = 0.5; break;
        case '木': m3VsFire = 0.5; m3VsWater = 1.5; break;
      }
    }

    // 有利ダメージ
      const magic1AdvantageDamage = useM1
        ? (chara.magic1atr == "無" ? magic1Damage : magic1Damage * 1.5)
        : 0;
      const magic2AdvantageDamage = useM2
        ? (chara.magic2atr == "無" ? magic2Damage : magic2Damage * 1.5)
        : 0;
      const magic3AdvantageDamage = useM3
        ? (chara.magic3atr == "無" ? magic3Damage : magic3Damage * 1.5)
        : 0;

    // 対火ダメージ
      const magic1vsHiDamage = useM1
        ? magic1Damage * m1VsFire
        : 0;
      const magic2vsHiDamage = useM2
        ? magic2Damage * m2VsFire
        : 0;
      const magic3vsHiDamage = useM3
        ? magic3Damage * m3VsFire
        : 0;
    // 対水ダメージ
      const magic1vsMizuDamage = useM1
        ? magic1Damage * m1VsWater
        : 0;
      const magic2vsMizuDamage = useM2
        ? magic2Damage * m2VsWater
        : 0;
      const magic3vsMizuDamage = useM3
        ? magic3Damage * m3VsWater
        : 0;
    // 対木ダメージ
      const magic1vsKiDamage = useM1
        ? magic1Damage * m1VsWood
        : 0;
      const magic2vsKiDamage = useM2
        ? magic2Damage * m2VsWood
        : 0;
      const magic3vsKiDamage = useM3
        ? magic3Damage * m3VsWood
        : 0;
    fillTopTwoDamage(magic1Damage, magic2Damage, magic3Damage, topTwoScratch);
    const damageTop1 = topTwoScratch[0];
    const damageTop2 = topTwoScratch[1];
    if (useFullSum) {
      deckReferenceDamage += damageTop1 + damageTop2;
    } else {
      deckReferenceDamageList!.push(damageTop1, damageTop2);
    }
    if (includeDetails) {
      damageList!.push(damageTop1 + damageTop2);
    }

    fillTopTwoDamage(magic1AdvantageDamage, magic2AdvantageDamage, magic3AdvantageDamage, topTwoScratch);
    const advantageTop1 = topTwoScratch[0];
    const advantageTop2 = topTwoScratch[1];
    if (useFullSum) {
      deckReferenceAdvantageDamage += advantageTop1 + advantageTop2;
    } else {
      deckReferenceAdvantageDamageList!.push(advantageTop1, advantageTop2);
    }
    if (includeDetails) {
      advantageDamageList!.push(advantageTop1 + advantageTop2);
    }

    fillTopTwoDamage(magic1vsHiDamage, magic2vsHiDamage, magic3vsHiDamage, topTwoScratch);
    const hiTop1 = topTwoScratch[0];
    const hiTop2 = topTwoScratch[1];
    if (useFullSum) {
      deckReferenceVsHiDamage += hiTop1 + hiTop2;
    } else {
      deckReferenceVsHiDamageList!.push(hiTop1, hiTop2);
    }
    if (includeDetails) {
      hiDamageList!.push(hiTop1 + hiTop2);
    }

    fillTopTwoDamage(magic1vsMizuDamage, magic2vsMizuDamage, magic3vsMizuDamage, topTwoScratch);
    const mizuTop1 = topTwoScratch[0];
    const mizuTop2 = topTwoScratch[1];
    if (useFullSum) {
      deckReferenceVsMizuDamage += mizuTop1 + mizuTop2;
    } else {
      deckReferenceVsMizuDamageList!.push(mizuTop1, mizuTop2);
    }
    if (includeDetails) {
      mizuDamageList!.push(mizuTop1 + mizuTop2);
    }

    fillTopTwoDamage(magic1vsKiDamage, magic2vsKiDamage, magic3vsKiDamage, topTwoScratch);
    const kiTop1 = topTwoScratch[0];
    const kiTop2 = topTwoScratch[1];
    if (useFullSum) {
      deckReferenceVsKiDamage += kiTop1 + kiTop2;
    } else {
      deckReferenceVsKiDamageList!.push(kiTop1, kiTop2);
    }
    if (includeDetails) {
      kiDamageList!.push(kiTop1 + kiTop2);
    }
  });

  if (!useFullSum) {
    deckReferenceDamage = deckReferenceDamageList!.sort((a, b) => b - a).slice(0, attackNumValue).reduce((acc, curr) => acc + curr, 0);
    deckReferenceAdvantageDamage = deckReferenceAdvantageDamageList!.sort((a, b) => b - a).slice(0, attackNumValue).reduce((acc, curr) => acc + curr, 0);
    deckReferenceVsHiDamage = deckReferenceVsHiDamageList!.sort((a, b) => b - a).slice(0, attackNumValue).reduce((acc, curr) => acc + curr, 0);
    deckReferenceVsMizuDamage = deckReferenceVsMizuDamageList!.sort((a, b) => b - a).slice(0, attackNumValue).reduce((acc, curr) => acc + curr, 0);
    deckReferenceVsKiDamage = deckReferenceVsKiDamageList!.sort((a, b) => b - a).slice(0, attackNumValue).reduce((acc, curr) => acc + curr, 0);
  }

  if (deckTotalHP < snapshot.minHP) { return; }
  if (deckTotalHP + deckTotalHeal < snapshot.minEHP) { return; }
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
  return [deckTotalHP
    , deckTotalHP+deckTotalHeal
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
    , ...deckList
    , simuURL
    , detailList ?? emptyDetailList];
}
function calcAttributeDamage(magicAtr: string, targetAtr: string, damage: number): number {
  // Opt-46: 属性相性の判定を分岐に置換
  if (magicAtr === '水') {
    if (targetAtr === '火') return damage * 1.5;
    if (targetAtr === '木') return damage * 0.5;
  } else if (magicAtr === '木') {
    if (targetAtr === '水') return damage * 1.5;
    if (targetAtr === '火') return damage * 0.5;
  } else if (magicAtr === '火') {
    if (targetAtr === '木') return damage * 1.5;
    if (targetAtr === '水') return damage * 0.5;
  }
  return damage;
}
interface SortCriterion {
  key: string;
  order: '昇順' | '降順'|'ASC' | 'DESC';
}

// Opt-154: 小さな階乗はテーブル参照
const factorialTable = [1, 1, 2, 6, 24, 120];
function factorialize(num:number) :number {
  return factorialTable[num] ?? 1;
}
export async function calcDecks(t: (key: string) => string) {
  for (const i of characters.value){
    if (i.required && i.level == 0) {
      errorMessage.value = t('error.requiredCharacter');
      return
    }
  }
  const nonZeroLevelCharacters = characters.value
    .filter(character => character.level > 0)
    .map(chara => ({
      ...chara,
      calcBaseHP: 0,
      calcBaseATK: 0
    }));
  const maxLevelCharacters = characters.value
    .filter(character => character.rare == 'SSR' && selectedSupportCharacters.value.includes(character.name))
    .map(chara => ({
      ...chara,
      level: 110,
      calcBaseHP: 0,
      calcBaseATK: 0
    }));
  // Opt-132: 配列参照をローカル化
  const nonZero = nonZeroLevelCharacters;
  const maxLevel = maxLevelCharacters;

  nonZero.forEach((chara) => {
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
  });

  maxLevel.forEach((chara) => {
    chara.calcBaseHP = chara.hp;
    chara.calcBaseATK = chara.atk;
  });

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
  const sortPropIndexMap = new Map<string, number>();
  for (let i = 0; i < availableSortProps.length; i++) {
    sortPropIndexMap.set(availableSortProps[i], i);
  }
  // Opt-102: sortOptions の参照をローカル化
  const sortOptionsValue = sortOptions.value;
  const sortCriteria: SortCriterion[] = [];
  for (const key of sortOptionsValue) {
    const idx = sortPropIndexMap.get(key.prop);
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
    // 効率的な結果管理：既にソート済みの上位N件を取得
    results.value = resultsManager.getTopDecks();
    nowResults.value = nowResultsCount;
    await new Promise(requestAnimationFrame);
  }
  const atkSortKey = new Set([
    'referenceDamage',
    'referenceAdvantageDamage',
    'referenceVsHiDamage',
    'referenceVsMizuDamage',
    'referenceVsKiDamage']);
  if (sortCriteria[0]['key'] in atkSortKey) {
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
  const requiredCount = nonZero.filter(character => character.required).length;
  if (requiredCount > 5) {
    errorMessage.value = '必須設定されたキャラが多すぎます';
    return;
  }
  results.value = [];
  
  // 効率的な上位N件管理クラスを初期化
  const resultsManager = new DeckSearchResultsManager(maxResult.value, sortCriteria);
  const mustIds = Array.from(convertedMustCharacters.value).map(name => getCharaId(name as string));

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
    target.chara1 = ret[20] as string;
    target.chara2 = ret[21] as string;
    target.chara3 = ret[22] as string;
    target.chara4 = ret[23] as string;
    target.chara5 = ret[24] as string;
  };
  const processCombinationCore = (combination: Character[]) => {
    const ret: (string | number)[] | undefined = calcDeckStatus(combination, { includeDetails: false, mustIds, snapshot });
    if (ret) {
      const transformedRet: DeckResult = {
        hp: 0,
        ehp: 0,
        evasion: 0,
        hpBuddy: 0,
        increasedHpBuddy: 0,
        buddy: 0,
        noHpBuddy: 0,
        duo: 0,
        buff: 0,
        debuff: 0,
        maxCosmic: 0,
        maxFire: 0,
        maxWater: 0,
        maxFlora: 0,
        referenceDamage: 0,
        referenceAdvantageDamage: 0,
        referenceVsHiDamage: 0,
        referenceVsMizuDamage: 0,
        referenceVsKiDamage: 0,
        healNum: 0,
        chara1: '',
        chara2: '',
        chara3: '',
        chara4: '',
        chara5: '',
        simuURL: '',
        detailList: emptyDetailList,
      };
      fillDeckResultFromArray(ret, transformedRet);
      
      // 効率的な上位N件管理：上位に入る場合のみ追加
      const added = resultsManager.addDeck(transformedRet);
      if (added) {
        // Opt-247: 詳細情報は上位に入ったデッキのみ再計算で付与
        const detailRet = calcDeckStatus(combination, { includeDetails: true, mustIds, snapshot });
        if (detailRet) {
          transformedRet.simuURL = detailRet[25] as string;
          transformedRet.detailList = detailRet[26];
        }
      }
    }
    nowResultsCount += 1;
  };

  const combination: Character[] = new Array(5);
  const processCombination = (i: number, j: number, k: number, l: number, m: number) => {
    combination[0] = nonZero[i];
    combination[1] = nonZero[j];
    combination[2] = nonZero[k];
    combination[3] = nonZero[l];
    combination[4] = nonZero[m];
    processCombinationCore(combination);
  };

  const processCombinationWithSupport = (i: number, j: number, k: number, l: number, m: number) => {
    combination[0] = nonZero[i];
    combination[1] = nonZero[j];
    combination[2] = nonZero[k];
    combination[3] = nonZero[l];
    combination[4] = maxLevel[m];
    processCombinationCore(combination);
  };

  const lengthes: number[] = new Array(5).fill(listLength);
  for(let i = 0; i < requiredCount; i++) {
    lengthes[i] = i+1;
  }
  // 同キャラ編成有り
  if (allowSameCharacter.value) {
    let lastRenderTime = Date.now();
    
    const beforeLastLoops = (lengthes[0] * (lengthes[1] - 1) * (lengthes[2] - 2) * (lengthes[3] - 3));
    totalResults.value = beforeLastLoops*(maxLevel.length)/factorialize(4-requiredCount);
    if (requiredCount == 5) {
      totalResults.value = 1;
      processCombination(0, 1, 2, 3, 4);
      nowResults.value = nowResultsCount;
      await new Promise(requestAnimationFrame);
      return
    }

    for (let i = 0; i < lengthes[0]; i++) {
      for (let j = i + 1; j < lengthes[1]; j++) {
        for (let k = j + 1; k < lengthes[2]; k++) {
          if (!isSearching.value) {
            nowResults.value = nowResultsCount;
            return;
          }
          for (let l = k + 1; l < lengthes[3]; l++) {
            for (let m = 0; m < maxLevel.length; m++) {
              processCombinationWithSupport(i, j, k, l, m);

              if (Date.now() - lastRenderTime > 2000) {
                lastRenderTime = Date.now();
                await appendResult();
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
      processCombination(0, 1, 2, 3, 4);
      nowResults.value = nowResultsCount;
      await new Promise(requestAnimationFrame);
      return
    }
    let lastRenderTime = Date.now();

    for (let i = 0; i < lengthes[0]; i++) {
      for (let j = i + 1; j < lengthes[1]; j++) {
        for (let k = j + 1; k < lengthes[2]; k++) {
          if (!isSearching.value) {
            nowResults.value = nowResultsCount;
            return;
          }
          for (let l = k + 1; l < lengthes[3]; l++) {
            for (let m = l + 1; m < lengthes[4]; m++) {
              processCombination(i, j, k, l, m);

              // 1秒に1回だけ描画を更新
              if (Date.now() - lastRenderTime > 2000) {
                lastRenderTime = Date.now();
                await appendResult();
              }
            }
          }
        }
      }
    }
  }
  nowResults.value = nowResultsCount;
  // 最終結果を取得（既にソート済み）
  results.value = resultsManager.getTopDecks();
  
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
