import { defineStore } from 'pinia';
import charactersData from '@/assets/chara.json';

// types/searchSettingsTypes.ts
export interface SortOption {
  prop: string;
  order: string;
}

export interface MustCharacterOption {
  prop: string;
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
  minHealNum: number;
  minReferenceDamage: number;
  minReferenceAdvantageDamage: number;
  minReferenceVsHiDamage: number;
  minReferenceVsMizuDamage: number;
  minReferenceVsKiDamage: number;
  maxResult: number;
  attackNum: number;
  sortOptions: SortOption[];
  mustCharacters: MustCharacterOption[];
  convertedMustCharacters: string[];
  allowSameCharacter: boolean;
  selectedSupportCharacters: string[];
}

// SSRキャラクターの名前を取得する関数
const getInitialSSRCharacters = () => {
  return charactersData
    .filter(character => character.rare === 'SSR')
    .map(character => character.name);
};

export const createDefaultSearchSettingsState = (): SearchSettingsState => ({
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
  minHealNum: 0,
  minReferenceDamage: 0,
  minReferenceAdvantageDamage: 0,
  minReferenceVsHiDamage: 0,
  minReferenceVsMizuDamage: 0,
  minReferenceVsKiDamage: 0,
  maxResult: 30,
  attackNum: 10,
  sortOptions: [
    { prop: 'settingModal.effectiveHP', order: 'settingModal.desc' }
  ],
  mustCharacters: [],
  convertedMustCharacters: [],
  allowSameCharacter: false,
  selectedSupportCharacters: getInitialSSRCharacters(),
});

export const useSearchSettingsStore = defineStore('searchSettings', {
  state: (): SearchSettingsState => createDefaultSearchSettingsState(),
  actions: {
    updateSearchSettings(newSettings: Partial<SearchSettingsState>) {
      Object.assign(this, newSettings);
    }
  },
});
