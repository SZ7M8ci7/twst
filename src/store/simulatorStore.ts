
import { defineStore } from 'pinia';

export interface SimulatorState {
  sortKey: string;
  deckCharacters: any[];
  selectedElement: string;
}

export const useSimulatorStore = defineStore('simulatorState', {
  state: (): SimulatorState => ({
    sortKey: '',
    deckCharacters: [
      { name: '', level: 0 , hp:0, atk:0, isM1Selected:true, isM2Selected:true, isM3Selected:false},
      { name: '', level: 0 , hp:0, atk:0, isM1Selected:true, isM2Selected:true, isM3Selected:false},
      { name: '', level: 0 , hp:0, atk:0, isM1Selected:true, isM2Selected:true, isM3Selected:false},
      { name: '', level: 0 , hp:0, atk:0, isM1Selected:true, isM2Selected:true, isM3Selected:false},
      { name: '', level: 0 , hp:0, atk:0, isM1Selected:true, isM2Selected:true, isM3Selected:false}
    ],
    selectedElement: 'all',
  }),
  actions: {
    updateLevel(index: number) {
      const character = this.deckCharacters[index];
      character.hp = character.level * 10 + 100;
      character.atk = character.level * 5 + 50;
    },
  }
});
