import { storeToRefs } from 'pinia';
import {
  calcDecks,
  type DeckSearchContext,
  type DeckSearchSettings,
} from '@/components/common';
import { useCharacterStore } from '@/store/characters';
import { useSearchResultStore } from '@/store/searchResult';
import { useSearchSettingsStore } from '@/store/searchSetting';

function createDeckSearchSettings(): DeckSearchSettings {
  const searchSettingsStore = useSearchSettingsStore();
  const {
    minEHP,
    minHP,
    minDebuff,
    minBuff,
    minHPBuddy,
    minIncreasedHPBuddy,
    minEvasion,
    minDuo,
    minCosmic,
    minFire,
    minWater,
    minFlora,
    minHealNum,
    minReferenceDamage,
    minReferenceAdvantageDamage,
    minReferenceVsHiDamage,
    minReferenceVsKiDamage,
    minReferenceVsMizuDamage,
    maxResult,
    sortOptions,
    convertedMustCharacters,
    allowSameCharacter,
    attackNum,
    selectedSupportCharacters,
  } = storeToRefs(searchSettingsStore);

  return {
    minEHP: minEHP.value,
    minHP: minHP.value,
    minDebuff: minDebuff.value,
    minBuff: minBuff.value,
    minHPBuddy: minHPBuddy.value,
    minIncreasedHPBuddy: minIncreasedHPBuddy.value,
    minEvasion: minEvasion.value,
    minDuo: minDuo.value,
    minCosmic: minCosmic.value,
    minFire: minFire.value,
    minWater: minWater.value,
    minFlora: minFlora.value,
    minHealNum: minHealNum.value,
    minReferenceDamage: minReferenceDamage.value,
    minReferenceAdvantageDamage: minReferenceAdvantageDamage.value,
    minReferenceVsHiDamage: minReferenceVsHiDamage.value,
    minReferenceVsMizuDamage: minReferenceVsMizuDamage.value,
    minReferenceVsKiDamage: minReferenceVsKiDamage.value,
    maxResult: maxResult.value,
    sortOptions: sortOptions.value.map((option) => ({ ...option })),
    convertedMustCharacters: [...convertedMustCharacters.value],
    allowSameCharacter: allowSameCharacter.value,
    attackNum: attackNum.value,
    selectedSupportCharacters: [...selectedSupportCharacters.value],
  };
}

export async function runDeckSearch(t: (key: string) => string) {
  const characterStore = useCharacterStore();
  const searchResultStore = useSearchResultStore();
  const { characters } = storeToRefs(characterStore);
  const { totalResults, nowResults, results, isSearching, errorMessage } = storeToRefs(searchResultStore);

  errorMessage.value = '';

  const context: DeckSearchContext = {
    characters: characters.value,
    settings: createDeckSearchSettings(),
    controls: {
      isSearching: () => isSearching.value,
      setTotalResults: (value) => {
        totalResults.value = value;
      },
      setNowResults: (value) => {
        nowResults.value = value;
      },
      setResults: (value) => {
        results.value = value;
      },
      setErrorMessage: (value) => {
        errorMessage.value = value;
      },
    },
  };

  await calcDecks(t, context);
}
