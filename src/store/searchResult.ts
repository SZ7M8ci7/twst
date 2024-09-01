
import { defineStore } from 'pinia';
// types/searchSettingsTypes.ts
export interface result {
  totalHP: number;
  totalEHP: number;
  totalEvasion: number;
  totalHPBuddy: number;
  totalBuddy: number;
  totalDuo: number;
  totalBuff: number;
  totalDebuff: number;
  totalReferenceDamage: number;
  noHPBuddy: number;
  chara1: string;
  chara2: string;
  chara3: string;
  chara4: string;
  chara5: string;
}

export interface SearchResultState {
  totalResults: number;
  nowResults: number;
  results: any[];
  isSearching: boolean;
  errorMessage: string;
}

export const useSearchResultStore = defineStore('searchResult', {
  state: (): SearchResultState => ({
    totalResults: 0,
    nowResults: 0,
    results: [],
    isSearching: false,
    errorMessage: '',
  }),
});