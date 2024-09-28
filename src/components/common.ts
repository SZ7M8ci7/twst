import { Character, useCharacterStore} from '@/store/characters'
import { useSearchSettingsStore } from '@/store/searchSetting';
import { useSearchResultStore } from '@/store/searchResult';
import { storeToRefs } from 'pinia';
import { Ref } from 'vue';
const searchSettingStore = useSearchSettingsStore();
const {
  minEHP,
  minHP,
  minDebuff,
  minBuff,
  minHPBuddy,
  minEvasion,
  minDuo,
  minCosmic,
  minFire,
  minWater,
  minFlora,
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
export interface deckStatus{
  EHP:number;
  HP:number;
  evasion:number;
  buddyNum:number;
  HPBuddyNum:number;
}
export function getAvailableSortProps(t: (key: string) => string) {
  return [  
  t('comments.HP'),
  t('comments.effectiveHP'),
  t('comments.HPBuddy'),
  t('comments.noHPBuddy'),
  t('comments.buddy'),
  t('comments.evasion'),
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
  t('comments.fellow')];
}
export const availableSortkeys = [
  'hp',
  'ehp',
  'hpBuudy',
  'noHpBuddy',
  'buddy',
  'evasion',
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
  "Fellow": "フェロー"
};

const buddyRateMap: { [key: string]: { hp: number; atk: number; heal: number; conHeal: number } } = {
  'HPUP(小)': { hp: 0.2, atk: 0, heal: 0, conHeal: 0 },
  'HP&ATKUP(小)': { hp: 0.2, atk: 0.2, heal: 0, conHeal: 0 },
  'HPUP(中)': { hp: 0.3, atk: 0, heal: 0, conHeal: 0 },
  'HP&ATKUP(中)': { hp: 0.3, atk: 0.35, heal: 0, conHeal: 0 },
  'ATKUP(小)': { hp: 0, atk: 0.2, heal: 0, conHeal: 0 },
  'ATKUP(中)': { hp: 0, atk: 0.35, heal: 0, conHeal: 0 },
  '回復(小)': { hp: 0, atk: 0, heal: 1.1, conHeal: 0 },
  '回復&継続回復(小)': { hp: 0, atk: 0, heal: 1.1, conHeal: 0.15 * 3 },
  '回復(中)': { hp: 0, atk: 0, heal: 1.7, conHeal: 0 },
  '回復&継続回復(中)': { hp: 0, atk: 0, heal: 1.7, conHeal: 0.25 * 3 },
  '継続回復(小)': { hp: 0, atk: 0, heal: 0, conHeal: 0.15 * 3 },
  '継続回復(中)': { hp: 0, atk: 0, heal: 0, conHeal: 0.25 * 3 },
};

function calcHPBuddyRate(status: string): number {
  return buddyRateMap[status]?.hp || 0;
}

function calcATKBuddyRate(status: string): number {
  return buddyRateMap[status]?.atk || 0;
}

function calcHealRate(status: string): number {
  return buddyRateMap[status]?.heal || 0;
}

function calcConHealRate(status: string): number {
  return buddyRateMap[status]?.conHeal || 0;
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

const damageCache: Record<string, number> = {};
function calcDamageAfterCalcAtk(magicBuff: string, magicPow: string, magicAtr: string, atk: number): number {
  const cacheKey = `${magicBuff},${magicPow},${magicAtr},${atk}`;
  
  if (cacheKey in damageCache) {
    return damageCache[cacheKey];
  }
  let atkRate = magicPow.includes("弱") ? 0.75 : 1;
  atkRate *= magicAtr === '無' ? 1.1 : 1;
  atkRate += damageBuffMap[magicBuff] || 0;

  let comboRate = 1;
  if (magicPow.includes("連撃")) {
    comboRate = 1.8;
  } else if (magicPow.includes("デュオ")) {
    comboRate = 2.4;
  }

  const damage = atk * atkRate * comboRate;
  damageCache[cacheKey] = damage;
  return damage;
}
function calcDamage(magicBuff: string, magicPow: string, magicAtr: string, atk: number, atkBuddyRate: number): number {
  atk = (atkBuffMap[magicBuff] || 1) * atk + atk * atkBuddyRate;  
  return calcDamageAfterCalcAtk(magicBuff, magicPow, magicAtr=='無' ? '無':'無以外', atk);
}
function calcTopDamage(damage1: number, damage2: number, damage3: number): number[] {
  const damages = [damage1, damage2, damage3];
  damages.sort((a, b) => b - a);
  return [damages[0], damages[1]];
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
  const deckList: Ref<any>[] = [];
  let simuURL = '';
  const detailList = [];
  const healList: number[] = [];
  const damageList: number[] = [];
  const advantageDamageList: number[] = [];
  const hiDamageList: number[] = [];
  const mizuDamageList: number[] = [];
  const kiDamageList: number[] = [];

  characters.sort((a, b) => b.calcBaseATK - a.calcBaseATK);
  characters.forEach((chara, index) => {
    name2M2Used[index] = false;
    name2MotherUsed[index] = false;
    name2DuoUsed[index] = false;
  })
  function count_attr(chara:Character, attr: string){
    let count = 0;
    if (chara.magic1atr == attr) {
      count+=1;
    }
    if (chara.magic2atr == attr) {
      count+=1;
    }
    if (chara.magic3atr == attr && chara.hasM3) {
      count+=1;
    }
    return Math.min(count, 2);
  }
  characters.forEach((chara, index) => {
    deckList.push(chara.imgUrl);
    simuURL += '&name'+(index+1) + '=' + chara.name;
    deckTotalHP += chara.calcBaseHP;
    deckTotalBuff += chara.buff_count;
    deckTotalDebuff += chara.debuff_count;
    deckCosmic += count_attr(chara, '無');
    deckFire += count_attr(chara, '火');
    deckWater += count_attr(chara, '水');
    deckFlora += count_attr(chara, '木');
    let hasHpBuddy = false;
    let atkBuddyRate = 0;
    // バディHP増加分加算
    if (memberNameSet.has(chara.buddy1c)) {
      deckTotalBuddy += 1;
      const hpRate = calcHPBuddyRate(chara.buddy1s);
      atkBuddyRate += calcATKBuddyRate(chara.buddy1s);
      if (hpRate != 0) {
        deckTotalHPBuddy += 1;
        hasHpBuddy = true;
        deckTotalHP += chara.calcBaseHP * hpRate;
      }
    }
    if (memberNameSet.has(chara.buddy2c)) {
      deckTotalBuddy += 1;
      const hpRate = calcHPBuddyRate(chara.buddy2s);
      atkBuddyRate += calcATKBuddyRate(chara.buddy2s);
      if (hpRate != 0) {
        deckTotalHPBuddy += 1;
        hasHpBuddy = true;
        deckTotalHP += chara.calcBaseHP * hpRate;
      }
    }
    if (memberNameSet.has(chara.buddy3c)) {
      deckTotalBuddy += 1;
      const hpRate = calcHPBuddyRate(chara.buddy3s);
      atkBuddyRate += calcATKBuddyRate(chara.buddy3s);
      if (hpRate != 0) {
        deckTotalHPBuddy += 1;
        hasHpBuddy = true;
        deckTotalHP += chara.calcBaseHP * hpRate;
      }
    }
    // HP回復分加算
    const hpHeal =
      (calcHealRate(chara.magic1heal) +
        calcHealRate(chara.magic2heal) +
        (chara.hasM3 ? calcHealRate(chara.magic3heal) : 0)) *
      chara.calcBaseATK;
    const hpConHeal =
      (calcConHealRate(chara.magic1heal) +
        calcConHealRate(chara.magic2heal) +
        (chara.hasM3 ? calcConHealRate(chara.magic3heal) : 0)) *
      chara.calcBaseHP;
    deckTotalHeal += hpHeal + hpConHeal
    healList.push(hpHeal + hpConHeal);
      
    // 回避数加算
    deckTotalEvasion += chara.evasion;
    if (!hasHpBuddy) {
      deckNoHPBuddy += 1;
    }
    let magic2pow = chara.magic2pow;
    if (name2DuoUsed[index]) {
      magic2pow = "デュオ";
      deckDuo += 1;
    } else {
      if (!name2DuoUsed[index]) {
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
      }

      if (name2DuoUsed[index]) {
        magic2pow = "デュオ";
        deckDuo += 1;
      }
    }
    // 等倍ダメージ加算
    const magic1Damage = calcDamage(
      chara.magic1buf,
      chara.magic1pow,
      chara.magic1atr,
      chara.calcBaseATK,
      atkBuddyRate
    );
    const magic2Damage = calcDamage(
      chara.magic2buf,
      magic2pow,
      chara.magic2atr,
      chara.calcBaseATK,
      atkBuddyRate
    );
    const magic3Damage = chara.hasM3 ? calcDamage(
      chara.magic3buf,
      chara.magic3pow,
      chara.magic3atr,
      chara.calcBaseATK,
      atkBuddyRate
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
  if (deckTotalEvasion < minEvasion.value) { return; }
  if (deckDuo < minDuo.value) { return; }
  if (deckTotalBuff < minBuff.value) { return; }
  if (deckTotalDebuff < minDebuff.value) { return; }
  if (deckCosmic < minCosmic.value) { return; }
  if (deckFire < minFire.value) { return; }
  if (deckWater < minWater.value) { return; }
  if (deckFlora < minFlora.value) { return; }
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

function dynamicSortMultiple(criteria: SortCriterion[]) {
  return function(a:any, b:any) {
      for (let i = 0; i < criteria.length; i++) {
          const { key, order } = criteria[i];
          if (!Object.prototype.hasOwnProperty.call(a, key) || !Object.prototype.hasOwnProperty.call(b, key)) {
            continue; // オブジェクトがキーを持っていない場合は比較をスキップ
          }
          let comparison = 0;
          if (a[key] < b[key]) {
              comparison = -1;
          } else if (a[key] > b[key]) {
              comparison = 1;
          }
          if (comparison !== 0) {
              return order === '降順' ? comparison * -1 : comparison;
          }
          // このキーでは同値だった場合、次のキーでの比較に移る
      }
      return 0; // すべてのキーで比較しても差がない場合
  };
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
  const nonZeroLevelCharacters = characters.value.filter(character => character.level > 0);
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
  
  const firstSortCriteria = sortCriteria[0].order === "昇順";
  async function appendResult(){
    // ソート基準と方向に基づいてソート
    results.value.sort(dynamicSortMultiple(sortCriteria));

    // 上位のみを保持
    const topResults = results.value.slice(0, maxResult.value);

    // リアクティブな状態を更新
    results.value = [...topResults];
    if (results.value.length > 0) {
      currentLimit = results.value[results.value.length - 1][sortCriteria[0].key];
    }
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
      return b.atk - a.atk;
    });
  } else {
    // requiredがtrueの順、HPの降順でソート
    nonZeroLevelCharacters.sort((a, b) => {
      if (a.required && !b.required) return -1;
      if (!a.required && b.required) return 1;
      return b.hp - a.hp;
    });
  }
  // requiredがtrueの数を数える
  const requiredCount = nonZeroLevelCharacters.filter(character => character.required).length;
  if (requiredCount > 5) {
    errorMessage.value = '必須設定されたキャラが多すぎます';
    return;
  }
  results.value = [];
  nonZeroLevelCharacters.forEach((chara) => {
    let maxLevel = 110;  // Default max level for SSR
    if (chara.rare == 'SR') {
      maxLevel = 90;     // Max level for SR
    } else if (chara.rare == 'R') {
      maxLevel = 70;     // Max level for R
    }
    
    const growPercentage = chara.level / maxLevel;
    chara.calcBaseHP = (chara.hp - chara.base_hp) * growPercentage + chara.base_hp;
    chara.calcBaseATK = (chara.atk - chara.base_atk) * growPercentage + chara.base_atk;
  })
  let currentLimit = sortCriteria[0].order === '昇順' ? Infinity : -Infinity;  // 現在の上限値を保持する変数を追加
  const processCombination = async (i: number, j: number, k: number, l: number, m: number) => {
    return new Promise<void>(resolve => {
      const combination = [
        nonZeroLevelCharacters[i],
        nonZeroLevelCharacters[j],
        nonZeroLevelCharacters[k],
        nonZeroLevelCharacters[l],
        nonZeroLevelCharacters[m],
      ];
      const ret: (string | number)[] | undefined = calcDeckStatus(combination);
      if (ret) {
        const transformedRet = {
          hp: Math.round(ret[0] as number),
          ehp: Math.round(ret[1] as number),
          evasion: ret[2],
          hpBuudy: ret[3],
          buddy: ret[4],
          noHpBuddy: ret[5],
          duo: ret[6],
          buff: ret[7],
          debuff: ret[8],
          maxCosmic: ret[9],
          maxFire: ret[10],
          maxWater: ret[11],
          maxFlora: ret[12],
          referenceDamage: ret[13],
          referenceAdvantageDamage: ret[14],
          referenceVsHiDamage: ret[15],
          referenceVsMizuDamage: ret[16],
          referenceVsKiDamage: ret[17],
          chara1: ret[18],
          chara2: ret[19],
          chara3: ret[20],
          chara4: ret[21],
          chara5: ret[22],
          simuURL: ret[23],
          detailList: ret[24],
        };
        const score = transformedRet[sortCriteria[0].key as keyof typeof transformedRet] as number;
        // sortCriteriaの0件目の順序が昇順の場合、現在の上限値よりも小さい場合のみpushする
        if (firstSortCriteria && score < currentLimit) {
          results.value.push(transformedRet);
        }
        // sortCriteriaの0件目の順序が降順の場合、現在の上限値よりも大きい場合のみpushする
        else if ((!firstSortCriteria) && score > currentLimit ) {
          results.value.push(transformedRet);
        }
      }
      nowResults.value += 1;
      resolve();
    });
  };
  const lengthes: number[] = new Array(5).fill(listLength);
  for(let i = 0; i < requiredCount; i++) {
    lengthes[i] = i+1;
  }
  // 同キャラ編成有り
  if (allowSameCharacter.value) {
    let lastRenderTime = Date.now();
    
    const beforeLastLoops = (lengthes[0] * (lengthes[1] - 1) * (lengthes[2] - 2) * (lengthes[3] - 3));
    totalResults.value = (beforeLastLoops*(lengthes[4]-4)/factorialize(5-requiredCount))+beforeLastLoops*4/factorialize(4-requiredCount);
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
            for (let m = l + 1; m < lengthes[4]; m++) {

              await processCombination(i, j, k, l, m);

              if (Date.now() - lastRenderTime > 2000) {
                lastRenderTime = Date.now();
                await appendResult();
              }
            }
            for (const m of [i,j,k,l]) {

              await processCombination(i, j, k, l, m);

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
  // ソート基準と方向に基づいてソート
  results.value.sort(dynamicSortMultiple(sortCriteria));

  // 上位のみを保持
  const topResults = results.value.slice(0, maxResult.value);

  // リアクティブな状態を更新
  results.value = [...topResults];
  if (results.value.length > 0) {
    currentLimit = results.value[results.value.length - 1][sortCriteria[0].key];
  }

}
