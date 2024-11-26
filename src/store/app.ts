// Utilities
import { defineStore } from 'pinia'

export const useAppStore = defineStore('app', {
  state: () => ({
    //
  }),
})

export const useLevelStore = defineStore('levelstore', {
  state: () => ({
    levelchanged: 0,
  }),
  actions: {
    setNumofCard(count: number){
      this.levelchanged = count;
    }
  }
})
