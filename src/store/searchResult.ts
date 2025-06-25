
import { defineStore } from 'pinia';

// Status effects array
export const effects = [
  { name: 'power_boost', value: 'ATKUP' },
  { name: 'damage_boost', value: 'ダメージUP' },
  { name: 'critical', value: 'クリティカル' },
  { name: 'element_boost', value: '属性ダメージUP' },
  { name: 'damage_vulnerability', value: '被ダメージUP' },
  { name: 'power_cut', value: 'ATKDOWN' },
  { name: 'damage_cut', value: 'ダメージDOWN' },
  { name: 'evasion', value: '回避' },
  { name: 'element_cut', value: '属性ダメージDOWN' },
  { name: 'resistence', value: '被ダメージDOWN' },
  { name: 'hp_restoration', value: 'HP回復' },
  { name: 'hp_regen', value: 'HP継続回復' },
  { name: 'nullifies_blind', value: '暗闇無効' },
  { name: 'nullifies_curse', value: '呪い無効' },
  { name: 'nullifies_freeze', value: '凍結無効' },
  { name: 'debuff_removal', value: 'デバフ解除' },
  { name: 'curse', value: '呪い' }
];

// types/searchSettingsTypes.ts
export interface result {
  totalHP: number;
  totalEHP: number;
  totalEvasion: number;
  totalHPBuddy: number;
  increasedHPBuddy: number;
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