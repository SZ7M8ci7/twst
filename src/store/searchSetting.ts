import { defineStore } from 'pinia';
import type { RosterSource } from '@/domain/examSearch/types';
import charactersData from '@/assets/chara.json';
import charactersInfo from '@/assets/characters_info.json';

const cardCharacterNames = new Set(charactersData.map(card => card.chara));
export const deckSearchCharacters = charactersInfo.filter(character => cardCharacterNames.has(character.name_ja));

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
  candidateCharacters: string[];
  allowSameCharacter: boolean;
  selectedSupportCharacters: string[];
  appliedPresetName: string;
  rosterSource: RosterSource;
  requiredCards: string[];
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
    { prop: 'comments.effectiveHP', order: 'settingModal.desc' }
  ],
  mustCharacters: [],
  convertedMustCharacters: [],
  candidateCharacters: deckSearchCharacters.map(character => character.name_ja),
  allowSameCharacter: false,
  selectedSupportCharacters: getInitialSSRCharacters(),
  appliedPresetName: '',
  rosterSource: 'owned',
  requiredCards: [],
});

export const useSearchSettingsStore = defineStore('searchSettings', {
  state: (): SearchSettingsState => createDefaultSearchSettingsState(),
  getters: {
    hasExcludedRequiredCharacter: state =>
      state.convertedMustCharacters.some(name => !state.candidateCharacters.includes(name)),
  },
  actions: {
    updateSearchSettings(newSettings: Partial<SearchSettingsState>) {
      Object.assign(this, newSettings);
    }
  },
});
