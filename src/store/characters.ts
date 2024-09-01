// store/characters.ts
import { defineStore } from 'pinia';
import charactersData from '@/assets/chara.json'
import { Ref, ref } from 'vue';

export interface Character {
  id: string;
  name: string;
  rare: string;
  atk: number;
  costume: string;
  base_atk: number;
  calcBaseATK: number;
  hp: number;
  base_hp: number;
  calcBaseHP: number;
  buddy1c: string;
  buddy1s: string;
  buddy2c: string;
  buddy2s: string;
  buddy3c: string;
  buddy3s: string;
  chara: string;
  duo: string;
  etc: string;
  buff_count: number;
  debuff_count: number;
  growtype: string;
  magic1atr: string;
  magic1buf: string;
  magic1heal: string;
  magic1pow: string;
  magic2atr: string;
  magic2buf: string;
  magic2heal: string;
  magic2pow: string;
  magic3atr: string;
  magic3buf: string;
  magic3heal: string;
  magic3pow: string;
  visible?: boolean;
  level: number;
  imgUrl: Ref;
  wikiURL: string;
  required: boolean;
  hasM3: boolean;
  evasion: number;
  selections: any;
}
function formatEtc(etc:string) {
  // <br>をカンマに置換
  let formattedEtc = etc.replaceAll('<br>', ', ');
  
  // 最後がカンマで終わる場合は取り除く
  if (formattedEtc.endsWith(', ')) {
    formattedEtc = formattedEtc.slice(0, -2);
  }

  return formattedEtc;
}
function countEvasion(etc:string) {
  const matchArray = etc.match(/回避/g) || [];
  return matchArray.length;
}
export const useCharacterStore = defineStore('characters', {
  state: () => ({
    characters: charactersData.map(character => ({
      ...character,
      atk: Number(character.atk),
      base_atk: Number(character.base_atk),
      calcBaseATK: Number(character.base_atk),
      hp: Number(character.hp),
      base_hp: Number(character.base_hp),
      calcBaseHP: Number(character.base_hp),
      visible: true,
      required: false,
      hasM3: true,
      level: 0,
      chara: character.chara || '',
      buddy1c: character.buddy1c || '',
      buddy1s: character.buddy1s || '',
      buddy2c: character.buddy2c || '',
      buddy2s: character.buddy2s || '',
      buddy3c: character.buddy3c || '',
      buddy3s: character.buddy3s || '',
      etc: formatEtc(character.etc) || '',
      buff_count: Number(character.buff_count),
      debuff_count: Number(character.debuff_count),
      magic1buf: character.magic1buf || '',
      magic1heal: character.magic1heal || '',
      magic2buf: character.magic2buf || '',
      magic2heal: character.magic2heal || '',
      magic3buf: character.magic3buf || '',
      magic3heal: character.magic3heal || '',
      imgUrl: ref(''),
      wikiURL:character.wikiURL || '',
      evasion: countEvasion(character.etc),
      selections:[],
    })) as Character[],
  }),
});
