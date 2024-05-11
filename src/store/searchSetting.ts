
import { defineStore } from 'pinia';
// types/searchSettingsTypes.ts
export interface SortOption {
  prop: string;
  order: '昇順' | '降順';
}

export interface SearchSettingsState {
  minEHP: number;
  minHP: number;
  minHPBuddy: number;
  minEvasion: number;
  minDuo: number;
  minReferenceDamage: number;
  minReferenceAdvantageDamage: number;
  minReferenceVsHiDamage: number;
  minReferenceVsMizuDamage: number;
  minReferenceVsKiDamage: number;
  maxResult: number;
  sortOptions: SortOption[];
  allowSameCharacter: boolean;
}

export const useSearchSettingsStore = defineStore('searchSettings', {
  state: (): SearchSettingsState => ({
    minEHP: 30000,
    minHP: 30000,
    minHPBuddy: 0,
    minEvasion: 0,
    minDuo: 0,
    minReferenceDamage: 0,
    minReferenceAdvantageDamage: 0,
    minReferenceVsHiDamage: 0,
    minReferenceVsMizuDamage: 0,
    minReferenceVsKiDamage: 0,
    maxResult: 10,
    sortOptions: [
      { prop: '実質HP', order: '降順' }
    ],
    allowSameCharacter: true,
  }),
  actions: {
    updateSearchSettings(newSettings: Partial<SearchSettingsState>) {
      Object.assign(this, newSettings);
    }
  },
});