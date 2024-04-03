// src/stores/deckStore.ts
import { defineStore } from 'pinia';
import { Character } from './characters';

export const useDeckStore = defineStore("deck", {
  state: () => ({
    deck: [] as Character[],
    selections: ["", "", "", "", ""],
    generatedList: [] as { imgUrl: string; text: string; magic1atr: string; magic2atr: string; magic3atr: string }[],
  }),
  actions: {
    addToDeck(item: Character) {
      if (this.deck.length < 5) {
        this.deck.push(item);
      }
    },
    removeFromDeck(index: number) {
      this.deck.splice(index, 1);
      // 選択肢を削除
      this.selections.splice(index, 1);
      // 最後尾に空文字を追加
      this.selections = [...this.selections, ""];
    },
    updateSelection(selectionKey: number, value: string) {
      if (selectionKey >= 0 && selectionKey < this.selections.length) {
        this.selections[selectionKey] = value;
        
        // selectionsが全件設定されていたらsetGeneratedListを呼ぶ
        if (this.areAllSelected) {
          const list = this.deck.flatMap((character, index) => {
            const selection = this.selections[index];
            if (selection) {
              return [
                { imgUrl: character.imgUrl, text: selection.substring(0, 2), magic1atr: character.magic1atr, magic2atr: character.magic2atr, magic3atr: character.magic3atr },
                { imgUrl: character.imgUrl, text: selection.substring(2, 4), magic1atr: character.magic1atr, magic2atr: character.magic2atr, magic3atr: character.magic3atr },
              ];
            } else {
              return [];
            }
          });
          this.setGeneratedList(this.shuffle(list));
        } else {
          this.setGeneratedList([]);
        }
      }
    },
    setGeneratedList(list: { imgUrl: string; text: string; magic1atr: string; magic2atr: string; magic3atr: string }[]) {
      this.generatedList = list;
    },
    removeFromGeneratedList(index: number) {
      this.generatedList.splice(index, 1);
      // this.generatedList = [...this.generatedList];
    },
    resetDeck() {
      if (this.areAllSelected) {
        const list = this.deck.flatMap((character, index) => {
          const selection = this.selections[index];
          if (selection) {
            return [
              { imgUrl: character.imgUrl, text: selection.substring(0, 2), magic1atr: character.magic1atr, magic2atr: character.magic2atr, magic3atr: character.magic3atr },
              { imgUrl: character.imgUrl, text: selection.substring(2, 4), magic1atr: character.magic1atr, magic2atr: character.magic2atr, magic3atr: character.magic3atr },
            ];
          } else {
            return [];
          }
        });
        this.setGeneratedList(this.shuffle(list));
      } else {
        this.setGeneratedList([]);
      }
    },
    shuffle(array: any[]) {
      for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
      }
      return array;
    },
  },
  getters: {
    areAllSelected(state) {
      return state.selections.every((selection) => selection !== "");
    },
  },
});