import { Character, useCharacterStore} from '@/store/characters'
import { useSearchSettingsStore } from '@/store/searchSetting';
import { useSearchResultStore } from '@/store/searchResult';
import { storeToRefs } from 'pinia';
const searchSettingStore = useSearchSettingsStore();
const { minEHP, minHP, minHPBuddy, minEvasion, maxResult, sortOptions, allowSameCharacter } = storeToRefs(searchSettingStore);
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
];

export const availableSortkeys = [
  'ehp',
  'hp',
  'hpBuudy',
  'noHpBuddy',
  'buddy',
  'evasion',
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
  const deckList = [];
  for (const chara of characters){
    deckList.push(chara.imgUrl);
    let maxLevel = 110;
    if (chara.rare == 'SR'){
      maxLevel = 90;
    } else if (chara.rare == 'R'){
      maxLevel = 70;
    } 
    const growPercentage = chara.level / maxLevel;
    const calcBaseHP = (chara.hp - chara.base_hp)*growPercentage+chara.base_hp;
    const calcBaseATK = (chara.atk - chara.base_atk)*growPercentage+chara.base_atk;
    

    deckTotalHP += calcBaseHP;
    let hasHpBuddy = false;
    // バディHP増加分加算
    if (memberNameSet.has(chara.buddy1c)){
      deckTotalBuddy+=1;
      const hpRate = calcHPBuddyRate(chara.buddy1s);
      if (hpRate != 0){
       deckTotalHPBuddy+=1;
       hasHpBuddy = true;
       deckTotalHP+=calcBaseHP*hpRate;
      }
    }
    if (memberNameSet.has(chara.buddy2c)){
      deckTotalBuddy+=1;
      const hpRate = calcHPBuddyRate(chara.buddy2s);
      if (hpRate != 0){
       deckTotalHPBuddy+=1;
       hasHpBuddy = true;
       deckTotalHP+=calcBaseHP*hpRate;
      }
    }
    if (memberNameSet.has(chara.buddy3c)){
      deckTotalBuddy+=1;
      const hpRate = calcHPBuddyRate(chara.buddy3s);
      if (hpRate != 0){
       deckTotalHPBuddy+=1;
       hasHpBuddy = true;
       deckTotalHP+=calcBaseHP*hpRate;
      }
    }
    // HP回復分加算
    deckTotalHeal+=calcHealRate(chara.magic1heal)*calcBaseATK;
    deckTotalHeal+=calcHealRate(chara.magic2heal)*calcBaseATK;
    deckTotalHeal+=calcHealRate(chara.magic3heal)*calcBaseATK;
    // HP継続回復分加算
    deckTotalHeal+=calcConHealRate(chara.magic1heal)*calcBaseHP;
    deckTotalHeal+=calcConHealRate(chara.magic2heal)*calcBaseHP;
    deckTotalHeal+=calcConHealRate(chara.magic3heal)*calcBaseHP;
    // 回避数加算
    deckTotalEvasion+=chara.evasion;
    if (!hasHpBuddy){
      deckNoHPBuddy+=1;
    }
  }
  if (deckTotalHP < minHP.value) { return; }
  if (deckTotalHP + deckTotalHeal < minEHP.value) { return; }
  if (deckTotalHPBuddy < minHPBuddy.value) { return; }
  if (deckTotalEvasion < minEvasion.value) { return; }
  deckList.sort();
  return [deckTotalHP, deckTotalHP+deckTotalHeal, deckTotalEvasion, deckTotalHPBuddy, deckTotalBuddy, deckNoHPBuddy, ...deckList];
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
  // requiredがtrueの順、HPの降順でソート
  nonZeroLevelCharacters.sort((a, b) => {
    if (a.required && !b.required) return -1;
    if (!a.required && b.required) return 1;
    return b.hp - a.hp;
  });

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
          chara1: ret[6],
          chara2: ret[7],
          chara3: ret[8],
          chara4: ret[9],
          chara5: ret[10],
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
