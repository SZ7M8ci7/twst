import { Character, useCharacterStore} from '@/store/characters'
import { useSearchSettingsStore } from '@/store/searchSetting';
import { useSearchResultStore } from '@/store/searchResult';
import { storeToRefs } from 'pinia';
import { Ref } from 'vue';
const searchSettingStore = useSearchSettingsStore();
const { minEHP, minHP, minHPBuddy, minEvasion, minDuo, minReferenceDamage, minReferenceAdvantageDamage, minReferenceVsHiDamage,minReferenceVsKiDamage,minReferenceVsMizuDamage, maxResult, sortOptions, allowSameCharacter } = storeToRefs(searchSettingStore);
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
export const availableSortProps = [
  '実質HP',
  '実HP',
  'HPバディ数',
  'HPバディが存在しないキャラ数',
  'バディ数',
  '回避数',
  'デュオ数',
  '等倍与ダメージ',
  '有利与ダメージ',
  '対火与ダメージ',
  '対水与ダメージ',
  '対木与ダメージ',
];

export const availableSortkeys = [
  'ehp',
  'hp',
  'hpBuudy',
  'noHpBuddy',
  'buddy',
  'evasion',
  'duo',
  'referenceDamage',
  'referenceAdvantageDamage',
  'referenceVsHiDamage',
  'referenceVsMizuDamage',
  'referenceVsKiDamage',
];
function calcHPBuddyRate(status:string){
  if ((status == 'HPUP(小)') || (status == 'HP&ATKUP(小)')){
    return 0.2;
  }
  if ((status == 'HPUP(中)') || (status == 'HP&ATKUP(中)')){
    return 0.3;
  }
  return 0;
}
function calcATKBuddyRate(status:string){
  if ((status == 'ATKUP(小)') || (status == 'HP&ATKUP(小)')){
    return 0.2;
  }
  if ((status == 'ATKUP(中)') || (status == 'HP&ATKUP(中)')){
    return 0.35;
  }
  return 0;
}
function calcHealRate(status: string) {
  if ((status=='回復(小)') || (status=='回復&継続回復(小)')){
    return 1.1;
  }
  if ((status=='回復(中)') || (status=='回復&継続回復(中)')){
    return 1.7;
  }
  return 0;
}
function calcConHealRate(status: string) {
  if ((status=='継続回復(小)') || (status=='回復&継続回復(小)')){
    return 0.15*3;
  }
  if ((status=='継続回復(中)') || (status=='回復&継続回復(中)')){
    return 0.25*3;
  }
  return 0;
}
function calcDamage(magicBuff: string, magicPow: string, magicAtr: string, atk: number, atkBuddyRate: number) {
  if (magicBuff == "ATKUP(極小)") {
    atk = atk*1.1+atk*atkBuddyRate;
  } else if (magicBuff == "ATKUP(小)") {
    atk = atk*1.2+atk*atkBuddyRate;
  } else if (magicBuff == "ATKUP(中)") {
    atk = atk*1.35+atk*atkBuddyRate;
  } else if (magicBuff == "ATKUP(大)") {
    atk = atk*1.5+atk*atkBuddyRate;
  } else if (magicBuff == "ATKUP(極大)") {
    atk = atk*2+atk*atkBuddyRate;
  } else {
    atk = atk+atk*atkBuddyRate;
  }
  let atkRate = 1;
  if (magicPow.includes("弱")) {
    atkRate = 0.75;
  }
  if (magicAtr == '無') {
    atkRate *= 1.1;
  }
  if (magicBuff == "ダメUP(極小)") {
    atkRate += 0.025;
  } else if (magicBuff == "ダメUP(小)") {
    atkRate += 0.05;
  } else if (magicBuff == "ダメUP(中)") {
    atkRate += 0.0875;
  } else if (magicBuff == "ダメUP(大)") {
    atkRate += 0.125;
  } else if (magicBuff == "ダメUP(極大)") {
    atkRate += 0.25;
  } 
  if (magicBuff == "属性ダメUP(極小)") {
    atkRate += 0.03;
  } else if (magicBuff == "属性ダメUP(小)") {
    atkRate += 0.06;
  } else if (magicBuff == "属性ダメUP(中)") {
    atkRate += 0.1005;
  } else if (magicBuff == "属性ダメUP(大)") {
    atkRate += 0.15;
  } else if (magicBuff == "属性ダメUP(極大)") {
    atkRate += 0.30;
  } 
  let comboRate = 1;
  if (magicPow.includes("連撃")) {
    comboRate = 0.9 * 2;
  } else if (magicPow.includes("デュオ")) {
    comboRate = 0.8 * 3;
  }
  return atk*atkRate*comboRate;
}
function calcTopDamage(damage1: number,damage2: number,damage3: number,){

  const damages = [damage1, damage2, damage3];
  damages.sort((a, b) => b - a);
  return damages[0] + damages[1];
}
export function calcDeckStatus(characters:Character[]) : Array<number | string| any> | undefined {
  const memberNameSet: Set<string> = new Set();
  for (const chara of characters){
    memberNameSet.add(chara.chara);
  }
  let deckTotalHP = 0;
  let deckTotalHeal = 0;
  let deckTotalEvasion = 0;
  let deckTotalHPBuddy = 0;
  let deckTotalBuddy = 0;
  let deckNoHPBuddy = 0;
  let deckDuo = 0;
  let deckReferenceDamage = 0;
  let deckReferenceAdvantageDamage = 0;
  let deckReferenceVsHiDamage = 0;
  let deckReferenceVsMizuDamage = 0;
  let deckReferenceVsKiDamage = 0;
  const name2M2Used:Record<number, boolean> = {};
  const name2MotherUsed:Record<number, boolean> = {};
  const name2DuoUsed:Record<number, boolean> = {};
  const deckList: Ref<any>[] = [];
  characters.forEach((chara) => {
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
  characters.sort((a, b) => b.calcBaseATK - a.calcBaseATK);
  characters.forEach((chara, index) => {
    name2M2Used[index] = false;
    name2MotherUsed[index] = false;
    name2DuoUsed[index] = false;
  })
  characters.forEach((chara, index) => {
    deckList.push(chara.imgUrl);

    deckTotalHP += chara.calcBaseHP;
    let hasHpBuddy = false;
    let atkBuddyRate = 0;
    // バディHP増加分加算
    if (memberNameSet.has(chara.buddy1c)){
      deckTotalBuddy+=1;
      const hpRate = calcHPBuddyRate(chara.buddy1s);
      atkBuddyRate += calcATKBuddyRate(chara.buddy1s);
      if (hpRate != 0){
       deckTotalHPBuddy+=1;
       hasHpBuddy = true;
       deckTotalHP+=chara.calcBaseHP*hpRate;
      }
    }
    if (memberNameSet.has(chara.buddy2c)){
      deckTotalBuddy+=1;
      const hpRate = calcHPBuddyRate(chara.buddy2s);
      atkBuddyRate += calcATKBuddyRate(chara.buddy2s);
      if (hpRate != 0){
       deckTotalHPBuddy+=1;
       hasHpBuddy = true;
       deckTotalHP+=chara.calcBaseHP*hpRate;
      }
    }
    if (memberNameSet.has(chara.buddy3c)){
      deckTotalBuddy+=1;
      const hpRate = calcHPBuddyRate(chara.buddy3s);
      atkBuddyRate += calcATKBuddyRate(chara.buddy3s);
      if (hpRate != 0){
       deckTotalHPBuddy+=1;
       hasHpBuddy = true;
       deckTotalHP+=chara.calcBaseHP*hpRate;
      }
    }
    // HP回復分加算
    deckTotalHeal+=calcHealRate(chara.magic1heal)*chara.calcBaseATK;
    deckTotalHeal+=calcHealRate(chara.magic2heal)*chara.calcBaseATK;
    deckTotalHeal+=calcHealRate(chara.magic3heal)*chara.calcBaseATK;
    // HP継続回復分加算
    deckTotalHeal+=calcConHealRate(chara.magic1heal)*chara.calcBaseHP;
    deckTotalHeal+=calcConHealRate(chara.magic2heal)*chara.calcBaseHP;
    deckTotalHeal+=calcConHealRate(chara.magic3heal)*chara.calcBaseHP;
    // 回避数加算
    deckTotalEvasion+=chara.evasion;
    if (!hasHpBuddy){
      deckNoHPBuddy+=1;
    }
    let magic2pow = chara.magic2pow;
    if (name2DuoUsed[index]){
      magic2pow = 'デュオ';
      deckDuo += 1;
    } else {
      // 相互デュオチェック
      characters.forEach((pair, index2) => {
        if ((pair.duo == chara.chara) && (chara.duo == pair.chara)) {
          if (!name2DuoUsed[index] && !name2DuoUsed[index2]) {
            name2DuoUsed[index] = true;
            name2DuoUsed[index2] = true;
            name2M2Used[index] = true;
            name2M2Used[index2] = true;
          }
        }
      });
      // Motherデュオチェック
      characters.forEach((pair, index2) => {
        if (chara.duo == pair.chara) {
          if (!name2DuoUsed[index] && !name2M2Used[index] && !name2MotherUsed[index2]) {
            name2DuoUsed[index] = true;
            name2M2Used[index] = true;
            name2MotherUsed[index2] = true;
          }
        }
      });
      // M2デュオチェック
      characters.forEach((pair, index2) => {
        if (chara.duo == pair.chara) {
          if (!name2DuoUsed[index] && !name2M2Used[index] && !name2M2Used[index2]) {
            name2DuoUsed[index] = true;
            name2M2Used[index] = true;
            name2M2Used[index2] = true;
          }
        }
      });
      if (name2DuoUsed[index]) {
        magic2pow = "デュオ";
        deckDuo+=1;
      }
    }
    // 等倍ダメージ加算
    const magic1Damage = calcDamage(chara.magic1buf, chara.magic1pow, chara.magic1atr, chara.calcBaseATK,atkBuddyRate);
    const magic2Damage = calcDamage(chara.magic2buf, magic2pow, chara.magic2atr, chara.calcBaseATK,atkBuddyRate);
    const magic3Damage = calcDamage(chara.magic3buf, chara.magic3pow, chara.magic3atr, chara.calcBaseATK,atkBuddyRate);

    deckReferenceDamage += calcTopDamage(magic1Damage,magic2Damage,magic3Damage);

    // 有利ダメージ
    const magic1AdvantageDamage = chara.magic1atr == '無' ? magic1Damage : magic1Damage * 1.5;
    const magic2AdvantageDamage = chara.magic2atr == '無' ? magic2Damage : magic2Damage * 1.5;
    const magic3AdvantageDamage = chara.magic3atr == '無' ? magic3Damage : magic3Damage * 1.5;

    deckReferenceAdvantageDamage += calcTopDamage(magic1AdvantageDamage,magic2AdvantageDamage,magic3AdvantageDamage);

    // 対火ダメージ
    let magic1vsHiDamage = magic1Damage;
    if (chara.magic1atr == '水') {
      magic1vsHiDamage = magic1Damage*1.5;
    } else if (chara.magic1atr == '木') {
      magic1vsHiDamage = magic1Damage/2;
    }
    let magic2vsHiDamage = magic2Damage;
    if (chara.magic2atr == '水') {
      magic2vsHiDamage = magic2Damage*1.5;
    } else if (chara.magic2atr == '木') {
      magic2vsHiDamage = magic2Damage/2;
    }
    let magic3vsHiDamage = magic3Damage;
    if (chara.magic3atr == '水') {
      magic3vsHiDamage = magic3Damage*1.5;
    } else if (chara.magic3atr == '木') {
      magic3vsHiDamage = magic3Damage/2;
    }

    deckReferenceVsHiDamage += calcTopDamage(magic1vsHiDamage,magic2vsHiDamage,magic3vsHiDamage);

    // 対水ダメージ
    let magic1vsMizuDamage = magic1Damage;
    if (chara.magic1atr == '木') {
      magic1vsMizuDamage = magic1Damage*1.5;
    } else if (chara.magic1atr == '火') {
      magic1vsMizuDamage = magic1Damage/2;
    }
    let magic2vsMizuDamage = magic2Damage;
    if (chara.magic2atr == '木') {
      magic2vsMizuDamage = magic2Damage*1.5;
    } else if (chara.magic2atr == '火') {
      magic2vsMizuDamage = magic2Damage/2;
    }
    let magic3vsMizuDamage = magic3Damage;
    if (chara.magic3atr == '木') {
      magic3vsMizuDamage = magic3Damage*1.5;
    } else if (chara.magic3atr == '火') {
      magic3vsMizuDamage = magic3Damage/2;
    }
    deckReferenceVsMizuDamage += calcTopDamage(magic1vsMizuDamage,magic2vsMizuDamage,magic3vsMizuDamage);

    // 対木ダメージ
    let magic1vsKiDamage = magic1Damage;
    if (chara.magic1atr == '火') {
      magic1vsKiDamage = magic1Damage*1.5;
    } else if (chara.magic1atr == '水') {
      magic1vsKiDamage = magic1Damage/2;
    }
    let magic2vsKiDamage = magic2Damage;
    if (chara.magic2atr == '火') {
      magic2vsKiDamage = magic2Damage*1.5;
    } else if (chara.magic2atr == '水') {
      magic2vsKiDamage = magic2Damage/2;
    }
    let magic3vsKiDamage = magic3Damage;
    if (chara.magic3atr == '火') {
      magic3vsKiDamage = magic3Damage*1.5;
    } else if (chara.magic3atr == '水') {
      magic3vsKiDamage = magic3Damage/2;
    }
    deckReferenceVsKiDamage += calcTopDamage(magic1vsKiDamage,magic2vsKiDamage,magic3vsKiDamage);
  })
  if (deckTotalHP < minHP.value) { return; }
  if (deckTotalHP + deckTotalHeal < minEHP.value) { return; }
  if (deckTotalHPBuddy < minHPBuddy.value) { return; }
  if (deckTotalEvasion < minEvasion.value) { return; }
  if (deckDuo < minDuo.value) { return; }
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
  deckList.sort();
  return [deckTotalHP
    , deckTotalHP+deckTotalHeal
    , deckTotalEvasion
    , deckTotalHPBuddy
    , deckTotalBuddy
    , deckNoHPBuddy
    , deckDuo
    , deckReferenceDamage
    , deckReferenceAdvantageDamage
    , deckReferenceVsHiDamage
    , deckReferenceVsMizuDamage
    , deckReferenceVsKiDamage
    , ...deckList];
}


interface SortCriterion {
  key: string;
  order: '昇順' | '降順';
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
export async function calcDecks() {
 
  for (const i of characters.value){
    if (i.required && i.level == 0) {
      errorMessage.value = '必須キャラのレベルは1以上にして下さい';
      return
    }
  }
  const nonZeroLevelCharacters = characters.value.filter(character => character.level > 0);
  const listLength = nonZeroLevelCharacters.length;
  if (listLength < 5) {
    errorMessage.value = 'レベル設定されたキャラが少なすぎます';
    return;
  }
  nowResults.value = 0;
  const sortCriteria: SortCriterion[] = [];
  for (const key of sortOptions.value) {
    for (let i = 0; i < availableSortProps.length; i++) {
      if (availableSortProps[i] == key.prop) {
        sortCriteria.push({key: availableSortkeys[i] as string, order: key.order as '昇順' | '降順'});
      }
    }
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
          referenceDamage: ret[7],
          referenceAdvantageDamage: ret[8],
          referenceVsHiDamage: ret[9],
          referenceVsMizuDamage: ret[10],
          referenceVsKiDamage: ret[11],
          chara1: ret[12],
          chara2: ret[13],
          chara3: ret[14],
          chara4: ret[15],
          chara5: ret[16],
        };

        // sortCriteriaの0件目の順序が昇順の場合、現在の上限値よりも小さい場合のみpushする
        if (
          sortCriteria[0].order === "昇順" &&
          (transformedRet[sortCriteria[0].key as keyof typeof transformedRet] as number) < currentLimit
        ) {
          results.value.push(transformedRet);
        }
        // sortCriteriaの0件目の順序が降順の場合、現在の上限値よりも大きい場合のみpushする
        else if (
          sortCriteria[0].order === "降順" &&
          (transformedRet[sortCriteria[0].key as keyof typeof transformedRet] as number) > currentLimit
        ) {
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
          for (let l = k + 1; l < lengthes[3]; l++) {
            for (let m = l + 1; m < lengthes[4]; m++) {
              if (!isSearching.value) {
                return;
              }

              await processCombination(i, j, k, l, m);

              if (Date.now() - lastRenderTime > 500) {
                lastRenderTime = Date.now();
                
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
            }
            for (const m of [i,j,k,l]) {

              await processCombination(i, j, k, l, m);

              if (Date.now() - lastRenderTime > 500) {
                lastRenderTime = Date.now();
                
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
          for (let l = k + 1; l < lengthes[3]; l++) {
            for (let m = l + 1; m < lengthes[4]; m++) {
              if (!isSearching.value) {
                return;
              }

              await processCombination(i, j, k, l, m);

              // 1秒に1回だけ描画を更新
              if (Date.now() - lastRenderTime > 1000) {
                lastRenderTime = Date.now();
                
                // ソート基準と方向に基づいてソート
                results.value.sort(dynamicSortMultiple(sortCriteria));

                // 上位100件のみを保持
                const topResults = results.value.slice(0, maxResult.value);

                // リアクティブな状態を更新
                results.value = [...topResults];
                if (results.value.length > 0) {
                  currentLimit = results.value[results.value.length - 1][sortCriteria[0].key];
                }
                await new Promise(requestAnimationFrame);
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
