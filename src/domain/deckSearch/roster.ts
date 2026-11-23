import { getInputMaxLevel } from '@/constants/levels';
import { SEARCH_PRESET_CONFIGURATIONS } from '@/constants/searchPresets';
import type { Character } from '@/store/characters';
import type { HandCollection } from '@/store/handCollection';
import type { SearchSettingsState } from '@/store/searchSetting';
import { isM3Unlocked, MAX_TOTSU } from '@/utils/totsu';

export function isDeckSearchCardEligible(name: string, collection: HandCollection, source: SearchSettingsState['rosterSource']) {
  const owned = collection[name];
  return source === 'allMax' || (!!owned?.isOwned && owned.level > 0);
}

export function buildDeckSearchRoster(
  catalog: Character[],
  collection: HandCollection,
  settings: Pick<SearchSettingsState, 'rosterSource' | 'candidateCharacters' | 'requiredCards' | 'allowSameCharacter' | 'selectedSupportCharacters' | 'appliedPresetName'>,
) {
  const candidates = new Set(settings.candidateCharacters);
  const required = new Set(settings.requiredCards);
  const supports = new Set(settings.selectedSupportCharacters);
  const disabledAttribute = SEARCH_PRESET_CONFIGURATIONS.find(preset => preset.name === settings.appliedPresetName)
    ?.deckSearchContinueHealDisabledAttribute;

  function prepare(card: Character, level: number, totsu: number, required: boolean): Character {
    const candidate = { ...card, level, totsu, required, hasM1: true, hasM2: true, hasM3: isM3Unlocked(card.rare, totsu) };
    // Defense presets can skip one unfavorable regeneration spell when three spells are available.
    if (disabledAttribute && candidate.hasM3) {
      for (const slot of [1, 2, 3] as const) {
        if (candidate[`magic${slot}atr`] === disabledAttribute && candidate[`magic${slot}heal`].includes('継続回復')) {
          candidate[`hasM${slot}`] = false;
          break;
        }
      }
    }
    return candidate;
  }

  const characters: Character[] = [];
  const supportCharacters: Character[] = [];
  for (const card of catalog) {
    const isCandidate = candidates.has(card.chara);
    const isRequired = required.has(card.name);
    if (!isCandidate && !isRequired) continue;
    const maxLevel = getInputMaxLevel(card.rare);
    const owned = collection[card.name];
    if (isCandidate && isDeckSearchCardEligible(card.name, collection, settings.rosterSource)) {
      characters.push(settings.rosterSource === 'owned'
        ? prepare(card, owned.level, owned.totsu, isRequired)
        : prepare(card, maxLevel, MAX_TOTSU, isRequired));
    } else if (isRequired) {
      characters.push(prepare(card, 0, 0, true));
    }
    if (isCandidate && settings.allowSameCharacter && card.rare === 'SSR' && supports.has(card.name)) {
      supportCharacters.push(prepare(card, maxLevel, MAX_TOTSU, false));
    }
  }
  return { characters, supportCharacters };
}
