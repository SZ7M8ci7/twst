import { createPinia, setActivePinia } from 'pinia';
import { performance } from 'perf_hooks';
import { SEARCH_PRESET_CONFIGURATIONS } from '@/constants/searchPresets';
import { useCharacterStore } from '@/store/characters';
import { useSearchSettingsStore } from '@/store/searchSetting';
import { useSearchResultStore } from '@/store/searchResult';

type ComparedRank = {
  rank: number;
  advantageDamage: number;
  duo: number;
  deckNames: string[];
  simuURL: string;
};

type CompareRunResult = {
  maxResult: number;
  elapsedMs: number;
  top10: ComparedRank[];
};

type RankDiff = {
  rank: number;
  sameDeck: boolean;
  sameAdvantageDamage: boolean;
  left: ComparedRank | null;
  right: ComparedRank | null;
};

const REQUIRED_RIDDLE_NAMES_ENV = (process.env.REQUIRED_RIDDLE_NAMES ?? '').trim();

function ensureRequestAnimationFrame() {
  if (typeof globalThis.requestAnimationFrame !== 'function') {
    globalThis.requestAnimationFrame = (cb: FrameRequestCallback) => {
      return setTimeout(() => cb(Date.now()), 0) as unknown as number;
    };
  }
}

function normalizeSortOrder(order: string): string {
  switch (order) {
    case 'settingModal.desc':
      return 'DESC';
    case 'settingModal.asc':
      return 'ASC';
    default:
      return order;
  }
}

function parseDeckFromSimuURL(simuURL: string): string[] {
  if (!simuURL) return ['', '', '', '', ''];
  const search = simuURL.startsWith('&') ? simuURL.slice(1) : simuURL;
  const params = new URLSearchParams(search);
  return [1, 2, 3, 4, 5].map((index) => params.get(`name${index}`) ?? '');
}

function getMaxLevelByRare(rare: string): number {
  if (rare === 'SSR') return 110;
  if (rare === 'SR') return 90;
  return 70;
}

function findRequiredRiddleNames(allCharacterNames: string[], charaNames: string[]): string[] {
  const byNamePrefix = allCharacterNames.filter((name) => name.startsWith('riddle_'));
  if (byNamePrefix.length >= 3) return byNamePrefix.slice(0, 3);

  const byCharaName = charaNames
    .map((chara, index) => ({ chara, name: allCharacterNames[index] }))
    .filter((entry) => entry.chara === 'リドル')
    .map((entry) => entry.name);
  return byCharaName.slice(0, 3);
}

function resolveRequiredRiddleNames(allCharacterNames: string[], charaNames: string[]): string[] {
  if (REQUIRED_RIDDLE_NAMES_ENV !== '') {
    const requested = REQUIRED_RIDDLE_NAMES_ENV
      .split(',')
      .map((name) => name.trim())
      .filter(Boolean);
    if (requested.length !== 3) {
      throw new Error(`REQUIRED_RIDDLE_NAMES must contain exactly 3 names. received=${requested.length}`);
    }
    for (const name of requested) {
      if (!allCharacterNames.includes(name)) {
        throw new Error(`Required card not found: ${name}`);
      }
    }
    return requested;
  }
  return findRequiredRiddleNames(allCharacterNames, charaNames);
}

function buildRankDiffs(left: ComparedRank[], right: ComparedRank[]): RankDiff[] {
  const maxLen = Math.max(left.length, right.length);
  const diffs: RankDiff[] = [];
  for (let i = 0; i < maxLen; i++) {
    const l = left[i] ?? null;
    const r = right[i] ?? null;
    const lDeck = l ? l.deckNames.join('|') : '';
    const rDeck = r ? r.deckNames.join('|') : '';
    diffs.push({
      rank: i + 1,
      sameDeck: lDeck === rDeck,
      sameAdvantageDamage: !!l && !!r && l.advantageDamage === r.advantageDamage,
      left: l,
      right: r,
    });
  }
  return diffs;
}

async function runScenario(maxResult: number, requiredRiddleNames: string[]): Promise<CompareRunResult> {
  const characterStore = useCharacterStore();
  const searchSettingStore = useSearchSettingsStore();
  const searchResultStore = useSearchResultStore();
  const { calcDecks } = await import('@/components/common');

  for (const chara of characterStore.characters) {
    chara.level = getMaxLevelByRare(chara.rare);
    chara.required = requiredRiddleNames.includes(chara.name);
    chara.hasM1 = true;
    chara.hasM2 = true;
    chara.hasM3 = chara.rare === 'SSR';
  }

  const preset = SEARCH_PRESET_CONFIGURATIONS.find(
    (entry) => entry.name === 'settingModal.preset.allAttackExam',
  );
  if (!preset) {
    throw new Error('Preset not found: settingModal.preset.allAttackExam');
  }

  searchSettingStore.updateSearchSettings({
    // SettingModal の resetAllSettings 相当
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
    maxResult,
    attackNum: preset.attackNum ?? 10,
    allowSameCharacter: preset.allowSameCharacter ?? false,
    mustCharacters: [],
    convertedMustCharacters: [],
    sortOptions: preset.sortOptions.map((option) => ({
      prop: option.prop,
      order: normalizeSortOrder(option.order),
    })),
  });

  searchResultStore.totalResults = 0;
  searchResultStore.nowResults = 0;
  searchResultStore.results = [];
  searchResultStore.isSearching = true;
  searchResultStore.errorMessage = '';

  const t = (key: string) => key;
  const started = performance.now();
  await calcDecks(t);
  const ended = performance.now();

  if (searchResultStore.errorMessage) {
    throw new Error(searchResultStore.errorMessage);
  }

  const top10: ComparedRank[] = searchResultStore.results.slice(0, 10).map((row: any, index: number) => ({
    rank: index + 1,
    advantageDamage: row.referenceAdvantageDamage,
    duo: row.duo,
    deckNames: parseDeckFromSimuURL(row.simuURL ?? ''),
    simuURL: row.simuURL ?? '',
  }));

  return {
    maxResult,
    elapsedMs: Math.round((ended - started) * 1000) / 1000,
    top10,
  };
}

async function main() {
  ensureRequestAnimationFrame();
  setActivePinia(createPinia());

  const characterStore = useCharacterStore();
  const requiredRiddleNames = resolveRequiredRiddleNames(
    characterStore.characters.map((c) => c.name),
    characterStore.characters.map((c) => c.chara),
  );
  if (requiredRiddleNames.length < 3) {
    throw new Error(`Could not resolve 3 Riddle cards. found=${requiredRiddleNames.length}`);
  }

  const run10 = await runScenario(10, requiredRiddleNames);
  const run100 = await runScenario(100, requiredRiddleNames);
  const rankDiffs = buildRankDiffs(run10.top10, run100.top10);
  const mismatchRanks = rankDiffs.filter((diff) => !diff.sameDeck || !diff.sameAdvantageDamage);

  const output = {
    scenario: {
      preset: 'settingModal.preset.allAttackExam',
      requiredRiddleNames,
      rule: 'all characters at max level by rarity, required = first 3 riddle cards',
    },
    run10,
    run100,
    mismatchCount: mismatchRanks.length,
    mismatchRanks,
  };

  console.log(JSON.stringify(output, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
