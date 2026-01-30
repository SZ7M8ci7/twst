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

// 数値入力で＋とeを弾く
export function checkNumber(input:KeyboardEvent){
  if (input.key === 'e' || input.key === '+') {
    input.preventDefault();
  }
}
// etc文字列からのバフ/デバフ数はM1/M2/M3のON/OFFに連動させるため、
// 1キャラ単位で解析結果をキャッシュして再利用する。
const buffDebuffCache = new WeakMap<any, { etc: string; buffByMagic: number[]; debuffByMagic: number[] }>();
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

function getBuffDebuffCountsByMagic(chara: any) {
  const etc = (chara?.etc || '').toString();
  const cached = buffDebuffCache.get(chara);
  if (cached && cached.etc === etc) {
    return cached;
  }

  // indexはM1/M2/M3に合わせて1..3を使用（0は未使用）
  const buffByMagic = [0, 0, 0, 0];
  const debuffByMagic = [0, 0, 0, 0];
  if (!etc) {
    const entry = { etc, buffByMagic, debuffByMagic };
    buffDebuffCache.set(chara, entry);
    return entry;
  }

  // etcは「,」区切りに整形済みなので分割してM番号ごとにカウント
  const effects = etc.split(',').map((effect: string) => effect.trim()).filter(Boolean);
  for (const effect of effects) {
    const mMatch = effect.match(/\(M([123])\)/);
    if (!mMatch) continue;
    const magicIndex = Number(mMatch[1]);
    if (Number.isNaN(magicIndex) || magicIndex < 1 || magicIndex > 3) continue;

    for (const pattern of buffPatterns) {
      if (!effect.includes(pattern)) continue;
      // 被ダメージUPはバフとして扱わない
      if (effect.includes('被ダメージUP')) break;
      // バフは自分/味方対象のみをカウント
      if (effect.includes('自') || effect.includes('味方')) {
        buffByMagic[magicIndex] += 1;
        break;
      }
    }

    for (const pattern of debuffPatterns) {
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

// バディレートキャッシュ
const buddyRatesCache: { [key: string]: { hp: number; atk: number; heal: number; conHeal: number } } = {};

function getBuddyRates(status: string): { hp: number; atk: number; heal: number; conHeal: number } {
  if (!buddyRatesCache[status]) {
    buddyRatesCache[status] = {
      hp: buddyRateMap[status]?.hp || 0,
      atk: buddyRateMap[status]?.atk || 0,
      heal: buddyRateMap[status]?.heal || 0,
      conHeal: buddyRateMap[status]?.conHeal || 0
    };
  }
  return buddyRatesCache[status];
}

function isHealCard(healStatus: string): boolean {
  return healStatus !== '' && buddyRateMap[healStatus] && 
         (buddyRateMap[healStatus].heal > 0 || buddyRateMap[healStatus].conHeal > 0);
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
function getMagicBuffTotalsFromEtc(
  chara: Character,
  magicIndex: 1 | 2 | 3,
  allowM3Override?: boolean
): { atkDelta: number; dmgDelta: number } {
  // M3可否（ストアのhasM3が信頼できない場合に備え、レアでも判断）
  const allowM3 = allowM3Override !== undefined
    ? allowM3Override
    : ((chara as any).hasM3 ?? (chara.rare === 'SSR'));
  const parsed = parseMagicBuffsFromEtc(chara as any, { allowM3 });
  let atkDelta = 0; // 基礎ATKに対する加算率合計（0.2なら+20%）
  let dmgDelta = 0; // ダメージ加算率合計

  parsed
    .filter(b => b.magicOption === `M${magicIndex}`)
    .forEach(b => {
      if (b.buffOption === 'ATKUP') {
        const key = `ATKUP(${b.powerOption})`;
        const factor = (atkBuffMap as any)[key] || 1;
        atkDelta += (factor - 1);
      } else if (b.buffOption === 'ダメージUP' || b.buffOption === '属性ダメUP') {
        const prefix = b.buffOption === 'ダメージUP' ? 'ダメUP' : '属性ダメUP';
        const key = `${prefix}(${b.powerOption})`;
        const add = (damageBuffMap as any)[key] || 0;
        dmgDelta += add;
      }
    });

  return { atkDelta, dmgDelta };
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
function calcTopDamage(damage1: number, damage2: number, damage3: number): number[] {
  const max = Math.max(damage1, damage2, damage3);
  let second: number;
  if (max === damage1) {
    second = Math.max(damage2, damage3);
  } else if (max === damage2) {
    second = Math.max(damage1, damage3);
  } else {
    second = Math.max(damage1, damage2);
  }
  return [max, second];
}
export function calcDeckStatus(characters:Character[]) : Array<number | string| any> | undefined {
  const memberNameSet: Set<string> = new Set();
  for (const chara of characters){
    memberNameSet.add(chara.chara);
  }
  const allMustCharactersIncluded = Array.from(convertedMustCharacters.value).every(character => memberNameSet.has(character as string));

  if (!allMustCharactersIncluded) {
    // もし mustCharactersSet に存在するすべての名前が memberNameSet にない場合、undefined を返す
    return ;
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
  const deckReferenceDamageList: number[] = [];
  const deckReferenceAdvantageDamageList: number[] = [];
  const deckReferenceVsHiDamageList: number[] = [];
  const deckReferenceVsMizuDamageList: number[] = [];
  const deckReferenceVsKiDamageList: number[] = [];
  let deckReferenceDamage = 0;
  let deckReferenceAdvantageDamage = 0;
  let deckReferenceVsHiDamage = 0;
  let deckReferenceVsMizuDamage = 0;
  let deckReferenceVsKiDamage = 0;
  const name2M2Used:Record<number, boolean> = {};
  const name2MotherUsed:Record<number, boolean> = {};
  const name2DuoUsed:Record<number, boolean> = {};
  const deckList: string[] = [];
  let simuURL = '';
  const detailList = [];
  const healList: number[] = [];
  const damageList: number[] = [];
  const advantageDamageList: number[] = [];
  const hiDamageList: number[] = [];
  const mizuDamageList: number[] = [];
  const kiDamageList: number[] = [];

  characters.forEach((chara, index) => {
    name2M2Used[index] = false;
    name2MotherUsed[index] = false;
    name2DuoUsed[index] = false;
  })
  function count_attr(chara: Character, attr: string, useM1: boolean, useM2: boolean, useM3: boolean) {
    // 属性枚数も使用可否(M1/M2/M3)を反映して数える
    let count = 0;
    if (useM1 && chara.magic1atr == attr) {
      count+=1;
    }
    if (useM2 && chara.magic2atr == attr) {
      count+=1;
    }
    if (useM3 && chara.magic3atr == attr) {
      count+=1;
    }
    return Math.min(count, 2);
  }
  characters.forEach((chara, index) => {
    const useM1 = (chara as any).hasM1 ?? true;
    const useM2 = (chara as any).hasM2 ?? true;
    const useM3 = chara.rare === 'SSR' ? ((chara as any).hasM3 ?? true) : false;
    // バフ/デバフ数は使用可能マジックのみ反映する
    const { buffByMagic, debuffByMagic } = getBuffDebuffCountsByMagic(chara);
    deckList.push(chara.imgUrl);
    simuURL += '&name' + (index + 1) + '=' + encodeURIComponent(chara.name);
    simuURL += '&level' + (index + 1) + '=' + chara.level;
    deckTotalHP += chara.calcBaseHP;
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
    deckCosmic += count_attr(chara, '無', useM1, useM2, useM3);
    deckFire += count_attr(chara, '火', useM1, useM2, useM3);
    deckWater += count_attr(chara, '水', useM1, useM2, useM3);
    deckFlora += count_attr(chara, '木', useM1, useM2, useM3);
    let hasHpBuddy = false;
    let atkBuddyRate = 0;
    // バディHP増加分加算
    let increasedHP = 0;
    const buddies = [
      { c: chara.buddy1c, s: chara.buddy1s },
      { c: chara.buddy2c, s: chara.buddy2s },
      { c: chara.buddy3c, s: chara.buddy3s }
    ];
    
    for (const buddy of buddies) {
      if (memberNameSet.has(buddy.c)) {
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
    deckMinIncreasedHPBuddy = Math.min(deckMinIncreasedHPBuddy, increasedHP);
    // HP回復分加算（使用可否を反映）
    const magic1Rates = useM1 ? getBuddyRates(chara.magic1heal) : { heal: 0, conHeal: 0 };
    const magic2Rates = useM2 ? getBuddyRates(chara.magic2heal) : { heal: 0, conHeal: 0 };
    const magic3Rates = useM3 ? getBuddyRates(chara.magic3heal) : { heal: 0, conHeal: 0 };
    
    const hpHeal = (magic1Rates.heal + magic2Rates.heal + magic3Rates.heal) * chara.calcBaseATK;
    const hpConHeal = (magic1Rates.conHeal + magic2Rates.conHeal + magic3Rates.conHeal) * chara.calcBaseHP;
    deckTotalHeal += hpHeal + hpConHeal
    healList.push(hpHeal + hpConHeal);
      
    // 回復手札数をカウント（使用可否を反映）
    const healMagics = [];
    if (useM1) healMagics.push(chara.magic1heal);
    if (useM2) healMagics.push(chara.magic2heal);
    if (useM3) healMagics.push(chara.magic3heal);
    
    for (const healMagic of healMagics) {
      if (isHealCard(healMagic)) {
        deckHealCards += 1;
      }
    }
    
    // 回避数加算
    deckTotalEvasion += chara.evasion;
    if (!hasHpBuddy) {
      deckNoHPBuddy += 1;
    }
    let magic2pow = chara.magic2pow;
    if (useM2) {
      // M2が無効なら自身のデュオ判定をしない
      if (name2DuoUsed[index]) {
        magic2pow = "デュオ魔法";
        deckDuo += 1;
      } else {
        // 相互デュオチェック
        for (const [index2, pair] of characters.entries()) {
          if (pair.duo == chara.chara && chara.duo == pair.chara) {
            if (!name2DuoUsed[index] && !name2DuoUsed[index2]) {
              name2DuoUsed[index] = true;
              name2DuoUsed[index2] = true;
              name2M2Used[index] = true;
              name2M2Used[index2] = true;
              break;
            }
          }
        }

        if (!name2M2Used[index]) {
          // Motherデュオチェック
          for (const [index2, pair] of characters.entries()) {
            if (chara.duo == pair.chara) {
              if (
                !name2DuoUsed[index] &&
                !name2M2Used[index] &&
                !name2MotherUsed[index2]
              ) {
                name2DuoUsed[index] = true;
                name2M2Used[index] = true;
                name2MotherUsed[index2] = true;
                break;
              }
            }
          }
        }

        if (!name2M2Used[index]) {
          // M2デュオチェック
          for (const [index2, pair] of characters.entries()) {
            if (chara.duo == pair.chara) {
              if (
                !name2DuoUsed[index] &&
                !name2M2Used[index] &&
                !name2M2Used[index2]
              ) {
                name2DuoUsed[index] = true;
                name2M2Used[index] = true;
                name2M2Used[index2] = true;
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
    const m1Totals = useM1 ? getMagicBuffTotalsFromEtc(chara, 1, useM3) : { atkDelta: 0, dmgDelta: 0 };
    const magic1Damage = useM1 ? calcDamageUsingEtcTotals(
      chara.magic1pow,
      chara.magic1atr,
      chara.calcBaseATK,
      atkBuddyRate,
      m1Totals
    ) : 0;
    const m2Totals = useM2 ? getMagicBuffTotalsFromEtc(chara, 2, useM3) : { atkDelta: 0, dmgDelta: 0 };
    const magic2Damage = useM2 ? calcDamageUsingEtcTotals(
      magic2pow,
      chara.magic2atr,
      chara.calcBaseATK,
      atkBuddyRate,
      m2Totals
    ) : 0;
    const m3Totals = useM3 ? getMagicBuffTotalsFromEtc(chara, 3, useM3) : { atkDelta: 0, dmgDelta: 0 };
    const magic3Damage = useM3 ? calcDamageUsingEtcTotals(
      chara.magic3pow,
      chara.magic3atr,
      chara.calcBaseATK,
      atkBuddyRate,
      m3Totals
    ) : 0;

    // 有利ダメージ
    const magic1AdvantageDamage =
      chara.magic1atr == "無" ? magic1Damage : magic1Damage * 1.5;
    const magic2AdvantageDamage =
      chara.magic2atr == "無" ? magic2Damage : magic2Damage * 1.5;
    const magic3AdvantageDamage =
      chara.magic3atr == "無" ? magic3Damage : magic3Damage * 1.5;

    // 対火ダメージ
    const magic1vsHiDamage = calcAttributeDamage(
      chara.magic1atr,
      "火",
      magic1Damage
    );
    const magic2vsHiDamage = calcAttributeDamage(
      chara.magic2atr,
      "火",
      magic2Damage
    );
    const magic3vsHiDamage = calcAttributeDamage(
      chara.magic3atr,
      "火",
      magic3Damage
    );
    // 対水ダメージ
    const magic1vsMizuDamage = calcAttributeDamage(
      chara.magic1atr,
      "水",
      magic1Damage
    );
    const magic2vsMizuDamage = calcAttributeDamage(
      chara.magic2atr,
      "水",
      magic2Damage
    );
    const magic3vsMizuDamage = calcAttributeDamage(
      chara.magic3atr,
      "水",
      magic3Damage
    );
    // 対木ダメージ
    const magic1vsKiDamage = calcAttributeDamage(
      chara.magic1atr,
      "木",
      magic1Damage
    );
    const magic2vsKiDamage = calcAttributeDamage(
      chara.magic2atr,
      "木",
      magic2Damage
    );
    const magic3vsKiDamage = calcAttributeDamage(
      chara.magic3atr,
      "木",
      magic3Damage
    );
    deckReferenceDamageList.push(...calcTopDamage(magic1Damage, magic2Damage, magic3Damage));
    deckReferenceAdvantageDamageList.push(...calcTopDamage(magic1AdvantageDamage, magic2AdvantageDamage, magic3AdvantageDamage));
    deckReferenceVsHiDamageList.push(...calcTopDamage(magic1vsHiDamage, magic2vsHiDamage, magic3vsHiDamage));
    deckReferenceVsMizuDamageList.push(...calcTopDamage(magic1vsMizuDamage, magic2vsMizuDamage, magic3vsMizuDamage));
    deckReferenceVsKiDamageList.push(...calcTopDamage(magic1vsKiDamage, magic2vsKiDamage, magic3vsKiDamage));
    damageList.push((deckReferenceDamageList.at(-1) as number) + (deckReferenceDamageList.at(-2) as number));
    advantageDamageList.push((deckReferenceAdvantageDamageList.at(-1) as number) + (deckReferenceAdvantageDamageList.at(-2) as number));
    hiDamageList.push((deckReferenceVsHiDamageList.at(-1) as number) + (deckReferenceVsHiDamageList.at(-2) as number));
    mizuDamageList.push((deckReferenceVsMizuDamageList.at(-1) as number) + (deckReferenceVsMizuDamageList.at(-2) as number));
    kiDamageList.push((deckReferenceVsKiDamageList.at(-1) as number) + (deckReferenceVsKiDamageList.at(-2) as number));
  });

  deckReferenceDamage = deckReferenceDamageList.sort((a, b) => b - a).slice(0, attackNum.value).reduce((acc, curr) => acc + curr, 0);
  deckReferenceAdvantageDamage = deckReferenceAdvantageDamageList.sort((a, b) => b - a).slice(0, attackNum.value).reduce((acc, curr) => acc + curr, 0);
  deckReferenceVsHiDamage = deckReferenceVsHiDamageList.sort((a, b) => b - a).slice(0, attackNum.value).reduce((acc, curr) => acc + curr, 0);
  deckReferenceVsMizuDamage = deckReferenceVsMizuDamageList.sort((a, b) => b - a).slice(0, attackNum.value).reduce((acc, curr) => acc + curr, 0);
  deckReferenceVsKiDamage = deckReferenceVsKiDamageList.sort((a, b) => b - a).slice(0, attackNum.value).reduce((acc, curr) => acc + curr, 0);

  if (deckTotalHP < minHP.value) { return; }
  if (deckTotalHP + deckTotalHeal < minEHP.value) { return; }
  if (deckTotalHPBuddy < minHPBuddy.value) { return; }
  if (deckMinIncreasedHPBuddy < minIncreasedHPBuddy.value) { return; }
  if (deckTotalEvasion < minEvasion.value) { return; }
  if (deckDuo < minDuo.value) { return; }
  if (deckTotalBuff < minBuff.value) { return; }
  if (deckTotalDebuff < minDebuff.value) { return; }
  if (deckCosmic < minCosmic.value) { return; }
  if (deckFire < minFire.value) { return; }
  if (deckWater < minWater.value) { return; }
  if (deckFlora < minFlora.value) { return; }
  if (deckHealCards < minHealNum.value) { return; }
  if (deckReferenceDamage < minReferenceDamage.value) { return; }
  if (deckReferenceAdvantageDamage < minReferenceAdvantageDamage.value) { return; }
  if (deckReferenceVsHiDamage < minReferenceVsHiDamage.value) { return; }
  if (deckReferenceVsMizuDamage < minReferenceVsMizuDamage.value) { return; }
  if (deckReferenceVsKiDamage < minReferenceVsKiDamage.value) { return; }
  deckReferenceDamage = Math.floor(deckReferenceDamage);
  deckReferenceAdvantageDamage = Math.floor(deckReferenceAdvantageDamage);
  deckReferenceVsHiDamage = Math.floor(deckReferenceVsHiDamage);
  deckReferenceVsMizuDamage = Math.floor(deckReferenceVsMizuDamage);
  deckReferenceVsKiDamage = Math.floor(deckReferenceVsKiDamage);
  deckMinIncreasedHPBuddy = Math.floor(deckMinIncreasedHPBuddy);
  detailList.push(healList);
  detailList.push(damageList);
  detailList.push(advantageDamageList);
  detailList.push(hiDamageList);
  detailList.push(mizuDamageList);
  detailList.push(kiDamageList);
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
    , detailList];
}
const attributeEffectiveness: Record<string, Record<string, number>> = {
  '水': { '火': 1.5, '木': 0.5 },
  '木': { '水': 1.5, '火': 0.5 },
  '火': { '木': 1.5, '水': 0.5 },
};
function calcAttributeDamage(magicAtr: string, targetAtr: string, damage: number): number {
  const effectiveness = attributeEffectiveness[magicAtr]?.[targetAtr];
  return effectiveness ? damage * effectiveness : damage;
}

interface SortCriterion {
  key: string;
  order: '昇順' | '降順'|'ASC' | 'DESC';
}

function factorialize(num:number) :number {
  if (num <= 0) { return 1; }
  return num * factorialize(num-1);
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

  nonZeroLevelCharacters.forEach((chara) => {
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

  maxLevelCharacters.forEach((chara) => {
    chara.calcBaseHP = chara.hp;
    chara.calcBaseATK = chara.atk;
  });

  const listLength = nonZeroLevelCharacters.length;
  if (listLength < 5) {
    errorMessage.value = t('error.fewCharacter');
    return;
  }
  nowResults.value = 0;
  const availableSortProps = getAvailableSortProps(t);
  const sortCriteria: SortCriterion[] = [];
  for (const key of sortOptions.value) {
    for (let i = 0; i < availableSortProps.length; i++) {
      if (availableSortProps[i] == key.prop) {
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
        sortCriteria.push({key: availableSortkeys[i] as string, order: order as '昇順' | '降順'});
      }
    }
  }

  // sortCriteriaが空の場合はエラーを表示して終了
  if (sortCriteria.length === 0) {
    errorMessage.value = t('search.noSettingOptions');
    return;
  }
  
  async function appendResult(){
    // 効率的な結果管理：既にソート済みの上位N件を取得
    results.value = resultsManager.getTopDecks();
    
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
    nonZeroLevelCharacters.sort((a, b) => {
      if (a.required && !b.required) return -1;
      if (!a.required && b.required) return 1;
      return b.calcBaseATK - a.calcBaseATK;
    });
  } else {
    // requiredがtrueの順、HPの降順でソート
    nonZeroLevelCharacters.sort((a, b) => {
      if (a.required && !b.required) return -1;
      if (!a.required && b.required) return 1;
      return b.calcBaseHP - a.calcBaseHP;
    });
  }
  // requiredがtrueの数を数える
  const requiredCount = nonZeroLevelCharacters.filter(character => character.required).length;
  if (requiredCount > 5) {
    errorMessage.value = '必須設定されたキャラが多すぎます';
    return;
  }
  results.value = [];
  
  // 効率的な上位N件管理クラスを初期化
  const resultsManager = new DeckSearchResultsManager(maxResult.value, sortCriteria);
  
  const processCombinationCore = async (combination: Character[]) => {
    return new Promise<void>(resolve => {
      const ret: (string | number)[] | undefined = calcDeckStatus(combination);
      if (ret) {
        const transformedRet: DeckResult = {
          hp: Math.round(ret[0] as number),
          ehp: Math.round(ret[1] as number),
          evasion: ret[2] as number,
          hpBuddy: ret[3] as number,
          increasedHpBuddy: ret[4] as number,
          buddy: ret[5] as number,
          noHpBuddy: ret[6] as number,
          duo: ret[7] as number,
          buff: ret[8] as number,
          debuff: ret[9] as number,
          maxCosmic: ret[10] as number,
          maxFire: ret[11] as number,
          maxWater: ret[12] as number,
          maxFlora: ret[13] as number,
          referenceDamage: ret[14] as number,
          referenceAdvantageDamage: ret[15] as number,
          referenceVsHiDamage: ret[16] as number,
          referenceVsMizuDamage: ret[17] as number,
          referenceVsKiDamage: ret[18] as number,
          healNum: ret[19] as number,
          chara1: ret[20] as string,
          chara2: ret[21] as string,
          chara3: ret[22] as string,
          chara4: ret[23] as string,
          chara5: ret[24] as string,
          simuURL: ret[25] as string,
          detailList: ret[26],
        };
        
        // 効率的な上位N件管理：上位に入る場合のみ追加
        resultsManager.addDeck(transformedRet);
      }
      nowResults.value += 1;
      resolve();
    });
  };

  const processCombination = async (i: number, j: number, k: number, l: number, m: number) => {
    const combination = [
      nonZeroLevelCharacters[i],
      nonZeroLevelCharacters[j],
      nonZeroLevelCharacters[k],
      nonZeroLevelCharacters[l],
      nonZeroLevelCharacters[m],
    ];
    await processCombinationCore(combination);
  };

  const processCombinationWithSupport = async (i: number, j: number, k: number, l: number, m: number) => {
    const combination = [
      nonZeroLevelCharacters[i],
      nonZeroLevelCharacters[j],
      nonZeroLevelCharacters[k],
      nonZeroLevelCharacters[l],
      maxLevelCharacters[m],
    ];
    await processCombinationCore(combination);
  };

  const lengthes: number[] = new Array(5).fill(listLength);
  for(let i = 0; i < requiredCount; i++) {
    lengthes[i] = i+1;
  }
  // 同キャラ編成有り
  if (allowSameCharacter.value) {
    let lastRenderTime = Date.now();
    
    const beforeLastLoops = (lengthes[0] * (lengthes[1] - 1) * (lengthes[2] - 2) * (lengthes[3] - 3));
    totalResults.value = beforeLastLoops*(maxLevelCharacters.length)/factorialize(4-requiredCount);
    if (requiredCount == 5) {
      totalResults.value = 1;
      await processCombination(0, 1, 2, 3, 4);
      
      await new Promise(requestAnimationFrame);
      return
    }

    for (let i = 0; i < lengthes[0]; i++) {
      for (let j = i + 1; j < lengthes[1]; j++) {
        for (let k = j + 1; k < lengthes[2]; k++) {
          if (!isSearching.value) {
            return;
          }
          for (let l = k + 1; l < lengthes[3]; l++) {
            for (let m = 0; m < maxLevelCharacters.length; m++) {
              await processCombinationWithSupport(i, j, k, l, m);

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
      await processCombination(0, 1, 2, 3, 4);
      
      await new Promise(requestAnimationFrame);
      return
    }
    let lastRenderTime = Date.now();

    for (let i = 0; i < lengthes[0]; i++) {
      for (let j = i + 1; j < lengthes[1]; j++) {
        for (let k = j + 1; k < lengthes[2]; k++) {
          if (!isSearching.value) {
            return;
          }
          for (let l = k + 1; l < lengthes[3]; l++) {
            for (let m = l + 1; m < lengthes[4]; m++) {

              await processCombination(i, j, k, l, m);

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
