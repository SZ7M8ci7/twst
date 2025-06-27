import { Character, useCharacterStore} from '@/store/characters'
import { useSearchSettingsStore } from '@/store/searchSetting';
import { useSearchResultStore } from '@/store/searchResult';
import { storeToRefs } from 'pinia';
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
  t('comments.train')];
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
  if (magicPow == "連撃(弱)" || magicPow == "連撃(強)") {
    comboRate = 1.8;
  }
  if (magicPow == "デュオ魔法" || magicPow == "3連撃(弱)") {
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
    simuURL += '&level'+(index+1) + '=' + chara.level;
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
    let increasedHP = 0;
    if (memberNameSet.has(chara.buddy1c)) {
      deckTotalBuddy += 1;
      const hpRate = calcHPBuddyRate(chara.buddy1s);
      atkBuddyRate += calcATKBuddyRate(chara.buddy1s);
      if (hpRate != 0) {
        deckTotalHPBuddy += 1;
        hasHpBuddy = true;
        deckTotalHP += chara.calcBaseHP * hpRate;
        increasedHP += chara.calcBaseHP * hpRate;
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
        increasedHP += chara.calcBaseHP * hpRate;
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
        increasedHP += chara.calcBaseHP * hpRate;
      }
    }
    deckMinIncreasedHPBuddy = Math.min(deckMinIncreasedHPBuddy, increasedHP);
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
      
    // 回復手札数をカウント
    if (isHealCard(chara.magic1heal)) {
      deckHealCards += 1;
    }
    if (isHealCard(chara.magic2heal)) {
      deckHealCards += 1;
    }
    if (chara.hasM3 && isHealCard(chara.magic3heal)) {
      deckHealCards += 1;
    }
    
    // 回避数加算
    deckTotalEvasion += chara.evasion;
    if (!hasHpBuddy) {
      deckNoHPBuddy += 1;
    }
    let magic2pow = chara.magic2pow;
    if (name2DuoUsed[index]) {
      magic2pow = "デュオ魔法";
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
        magic2pow = "デュオ魔法";
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
  let currentLimit = sortCriteria[0].order === '昇順' ? Infinity : -Infinity;  // 現在の上限値を保持する変数を追加
  const processCombinationCore = async (combination: Character[]) => {
    return new Promise<void>(resolve => {
      const ret: (string | number)[] | undefined = calcDeckStatus(combination);
      if (ret) {
        const transformedRet = {
          hp: Math.round(ret[0] as number),
          ehp: Math.round(ret[1] as number),
          evasion: ret[2],
          hpBuddy: ret[3],
          increasedHpBuddy: ret[4],
          buddy: ret[5],
          noHpBuddy: ret[6],
          duo: ret[7],
          buff: ret[8],
          debuff: ret[9],
          maxCosmic: ret[10],
          maxFire: ret[11],
          maxWater: ret[12],
          maxFlora: ret[13],
          referenceDamage: ret[14],
          referenceAdvantageDamage: ret[15],
          referenceVsHiDamage: ret[16],
          referenceVsMizuDamage: ret[17],
          referenceVsKiDamage: ret[18],
          healNum: ret[19],
          chara1: ret[20],
          chara2: ret[21],
          chara3: ret[22],
          chara4: ret[23],
          chara5: ret[24],
          simuURL: ret[25],
          detailList: ret[26],
        };
        const score = transformedRet[sortCriteria[0].key as keyof typeof transformedRet] as number;
        // sortCriteriaの0件目の順序が昇順の場合、現在の上限値よりも小さいか同じ場合のみpushする
        if (firstSortCriteria && score <= currentLimit) {
          results.value.push(transformedRet);
        }
        // sortCriteriaの0件目の順序が降順の場合、現在の上限値よりも大きいか同じ場合のみpushする
        else if ((!firstSortCriteria) && score >= currentLimit ) {
          results.value.push(transformedRet);
        }
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
      const module = await import(`@/assets/img/${notYetImageName}.png`) as { default: string };
      const imageUrl = module.default;
      cachedImageUrls[notYetCacheKey] = imageUrl;
      imageUrlDictionary[notYetImageName] = imageUrl;
    } catch (error) {
      console.error(`[loadImageUrls] Error loading ${notYetImageName}.png:`, error);
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
        module = await import(`@/assets/img/icon/${itemName}.png`) as { default: string };
      } else if (prefix === '') {
        module = await import(`@/assets/img/${itemName}.png`) as { default: string };
      } else {
        console.error(`[loadImageUrls] Unsupported or unknown prefix '${prefix}' for item '${itemName}'. Trying a generic path that might fail.`);
        module = await import(`@/assets/img/${prefix}${itemName}.png`) as { default: string };
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
      imagePathForLog = `@/assets/img/icon/${imageName}.png`;
      module = await import(`@/assets/img/icon/${imageName}.png`) as { default: string };
    } else if (prefix === '') {
      imagePathForLog = `@/assets/img/${imageName}.png`;
      module = await import(`@/assets/img/${imageName}.png`) as { default: string };
    } else {
      console.error(`[loadCachedImageUrl] Unsupported or unknown prefix '${prefix}' for item '${imageName}'. Trying a generic path that might fail.`);
      imagePathForLog = `@/assets/img/${prefix}${imageName}.png`;
      module = await import(`@/assets/img/${prefix}${imageName}.png`) as { default: string };
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