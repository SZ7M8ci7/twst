// store/characters.ts
import { defineStore } from 'pinia';
import charactersData from '@/assets/chara.json'

export interface Character {
  id: string;
  name: string;
  rare: string;
  atk: number;
  attr: string;
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
  oldlevel: number;
  imgUrl: string;
  wikiURL: string;
  required: boolean;
  hasM3: boolean;
  evasion: number;
  selections: any;
  hasDuo: any;
  implementation_date: string;
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
  state: () => {
    const processedCharacters: Character[] = charactersData
      .map((characterJsonData: any) => {
        const { imgUrl: imgUrlFromJson, ...otherJsonProps } = characterJsonData;

        // Character インターフェースから imgUrl を除いた型を定義
        type CharacterWithoutImgUrl = Omit<Character, 'imgUrl'>;

        // まず imgUrl を含まない Character オブジェクトを構築
        const characterBase: CharacterWithoutImgUrl = {
          id: otherJsonProps.id,
          name: otherJsonProps.name,
          rare: otherJsonProps.rare,
          atk: Number(otherJsonProps.atk),
          attr: otherJsonProps.attr || '',
          costume: otherJsonProps.costume,
          base_atk: Number(otherJsonProps.base_atk),
          calcBaseATK: Number(otherJsonProps.base_atk),
          hp: Number(otherJsonProps.hp),
          base_hp: Number(otherJsonProps.base_hp),
          calcBaseHP: Number(otherJsonProps.base_hp),
          buddy1c: otherJsonProps.buddy1c || '',
          buddy1s: otherJsonProps.buddy1s || '',
          buddy2c: otherJsonProps.buddy2c || '',
          buddy2s: otherJsonProps.buddy2s || '',
          buddy3c: otherJsonProps.buddy3c || '',
          buddy3s: otherJsonProps.buddy3s || '',
          chara: otherJsonProps.chara || '',
          duo: otherJsonProps.duo,
          etc: formatEtc(otherJsonProps.etc) || '',
          buff_count: Number(otherJsonProps.buff_count),
          debuff_count: Number(otherJsonProps.debuff_count),
          growtype: otherJsonProps.growtype,
          magic1atr: otherJsonProps.magic1atr,
          magic1buf: otherJsonProps.magic1buf || '',
          magic1heal: otherJsonProps.magic1heal || '',
          magic1pow: otherJsonProps.magic1pow,
          magic2atr: otherJsonProps.magic2atr,
          magic2buf: otherJsonProps.magic2buf || '',
          magic2heal: otherJsonProps.magic2heal || '',
          magic2pow: otherJsonProps.magic2pow,
          magic3atr: otherJsonProps.magic3atr,
          magic3buf: otherJsonProps.magic3buf || '',
          magic3heal: otherJsonProps.magic3heal || '',
          magic3pow: otherJsonProps.magic3pow,
          visible: true,
          level: 0,
          oldlevel: 0,
          wikiURL: otherJsonProps.wikiURL || '',
          required: false,
          hasM3: true,
          evasion: countEvasion(otherJsonProps.etc),
          selections:[],
          hasDuo: false,
          implementation_date: otherJsonProps.implementation_date || '',
        };
        
        // 次に characterBase と ref でラップした imgUrl を結合して Character 型オブジェクトを生成
        const finalCharacter: Character = {
            ...characterBase,
            imgUrl: imgUrlFromJson || '',
        }; 
        return finalCharacter;
      });

    return { 
      characters: processedCharacters,
      currentPage: '',  
      lastPage: '',     
    };
  },

  actions: {
    // visibleをリセットするアクション
    resetVisible() {
      this.characters.forEach(character => {
        character.visible = true;
      });
    },

    // ページ変更時に状態をチェックし、前回アクセスしたページと異なる場合のみリセットするアクション
    handlePageChange(newPage: string) {
      this.lastPage = this.currentPage;
      this.currentPage = newPage;

      if (this.currentPage !== this.lastPage) {
        this.resetVisible();
      }
    },
  },
});
