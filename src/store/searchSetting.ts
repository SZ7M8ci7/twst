import { defineStore } from 'pinia';

// types/searchSettingsTypes.ts
export interface SortOption {
  prop: string;
  order: string;
}

export interface SearchSettingsState {
  minEHP: number;
  minHP: number;
  minHPBuddy: number;
  minIncreasedHPBuddy: number;
  minEvasion: number;
  minDuo: number;
  minBuff: number;
  minDebuff: number;
  minCosmic: number;
  minFire: number;
  minWater: number;
  minFlora: number;
  minReferenceDamage: number;
  minReferenceAdvantageDamage: number;
  minReferenceVsHiDamage: number;
  minReferenceVsMizuDamage: number;
  minReferenceVsKiDamage: number;
  maxResult: number;
  attackNum: number;
  sortOptions: SortOption[];
  mustCharacters: [];
  convertedMustCharacters: [];
  allowSameCharacter: boolean;
}

export const useSearchSettingsStore = defineStore('searchSettings', {
  state: (): SearchSettingsState => ({
    minEHP: 30000,
    minHP: 30000,
    minHPBuddy: 0,
    minIncreasedHPBuddy: 0,
    minEvasion: 0,
    minDuo: 0,
    minBuff: 0,
    minDebuff: 0,
    minCosmic: 0,
    minFire: 0,
    minWater: 0,
    minFlora: 0,
    minReferenceDamage: 0,
    minReferenceAdvantageDamage: 0,
    minReferenceVsHiDamage: 0,
    minReferenceVsMizuDamage: 0,
    minReferenceVsKiDamage: 0,
    maxResult: 10,
    attackNum: 10,
    sortOptions: [
      { prop: 'settingModal.effectiveHP', order: 'settingModal.desc' }
    ],
    mustCharacters: [],
    convertedMustCharacters: [],
    allowSameCharacter: false,
  }),
  actions: {
    updateSearchSettings(newSettings: Partial<SearchSettingsState>) {
      Object.assign(this, newSettings);
    }
  },
});