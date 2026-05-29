import charactersInfo from '@/assets/characters_info.json';

type CharacterInfo = {
  name_ja: string;
  name_en: string;
};

type CardLike = {
  name?: string;
  chara?: string;
  costume?: string;
};

const characterInfoList = charactersInfo as CharacterInfo[];

const characterNameOverrides: Record<string, string> = {
  lolo: 'Rollo',
};

const englishCharacterNameByJa = new Map<string, string>(
  characterInfoList.map((character) => [
    character.name_ja,
    characterNameOverrides[character.name_en] ?? toTitleCase(character.name_en),
  ])
);

const japaneseCharacterNames = Array.from(englishCharacterNameByJa.keys())
  .sort((a, b) => b.length - a.length);

const costumeKeyOverrides: Record<string, string> = {
  birth: 'Birthday Boy',
  birth2: 'Birthday Jacket',
  birth3: 'Union Birthday',
  birth4: 'Bloom Birthday',
  birth5: 'Relaxing in Room',
  ceremony: 'Ceremonial Robes',
  dormitory: 'Dorm Uniform',
  experiment: 'Labwear',
  uniform: 'School Uniform',
  gym: 'PE Uniform',
  chef: 'Master Chef',
  club: 'Club Wear',
  beans: 'Beans Camo',
  scary: 'Scary Dress',
  tmu: 'Tsumsitter',
  newyear: "New Year's Attire",
  groom: 'Suitor Suit',
  gara: 'Gala Couture',
  masquerade: 'Masquerade Dress',
  outdoor: 'Outdoor Wear',
  port: 'Port Wear',
  milk: 'Stitch-inspired Outfit',
  apple: 'Apple Boa',
  big_check: 'Apple Boa',
  beast: 'Beastly Garb',
  star: 'Stargazer Gear',
  stargaze: 'Stargazer Gear',
  deep_sea_merchant: 'Deep-Sea Merchant',
  playful_dress: 'Playful Dress',
  playful_gear: 'Playful Gear',
  nightmare_gear: 'Nightmare Gear',
  rabbit_gear: 'Rabbit Gear',
  new_year_gear: "New Year's Gear",
  cooking_gear: 'Cooking Gear',
  outdoor_gear: 'Outdoor Gear',
  bloom_gear: 'Bloom Gear',
  platinum_gear: 'Platinum Gear',
  relaxation_and_gear: 'Relaxation Gear',
  college: 'College Gear',
};

const exactTextMap: Record<string, string> = {
  '': '',
  なし: 'None',
  全: 'Omni',
  火: 'Fire',
  水: 'Water',
  木: 'Flora',
  無: 'Cosmic',
  等: 'Neutral',
  対全: 'Omni',
  対火: 'vs Fire',
  対水: 'vs Water',
  対木: 'vs Flora',
  対無: 'vs Cosmic',
  対無属性: 'vs Cosmic',
  アタック: 'Attack',
  バランス: 'Balance',
  ディフェンス: 'Defense',
  単発弱: 'Single Weak',
  単発強: 'Single Strong',
  '単発(弱)': 'Single (Weak)',
  '単発(強)': 'Single (Strong)',
  '連撃(弱)': 'Double (Weak)',
  '連撃(強)': 'Double (Strong)',
  '2連撃(弱)': 'Double (Weak)',
  '2連撃(強)': 'Double (Strong)',
  '3連撃(弱)': 'Triple (Weak)',
  '3連撃(強)': 'Triple (Strong)',
  デュオ: 'Duo',
  デュオ魔法: 'Duo Magic',
  昇順: 'Ascending',
  降順: 'Descending',
  開始: 'Start',
  結果: 'Result',
  スコア: 'Score',
  その他: 'Other',
  敵: 'Enemy',
  手札無し: 'No Cards',
  敗北: 'Defeat',
  不明: 'Unknown',
  行動なし: 'No Action',
  威力不明: 'Unknown Power',
  極小: 'Min',
  小: 'Small',
  中: 'Medium',
  大: 'Large',
  極大: 'Extra Large',
  弱: 'Weak',
  強: 'Strong',
};

const textReplacements: Array<[RegExp, string]> = [
  [/火属性被ダメージDOWN/g, 'Fire Damage Taken DOWN'],
  [/水属性被ダメージDOWN/g, 'Water Damage Taken DOWN'],
  [/木属性被ダメージDOWN/g, 'Flora Damage Taken DOWN'],
  [/無属性被ダメージDOWN/g, 'Cosmic Damage Taken DOWN'],
  [/火属性被ダメージUP/g, 'Fire Damage Taken UP'],
  [/水属性被ダメージUP/g, 'Water Damage Taken UP'],
  [/木属性被ダメージUP/g, 'Flora Damage Taken UP'],
  [/無属性被ダメージUP/g, 'Cosmic Damage Taken UP'],
  [/火属性ダメージDOWN/g, 'Fire Damage DOWN'],
  [/水属性ダメージDOWN/g, 'Water Damage DOWN'],
  [/木属性ダメージDOWN/g, 'Flora Damage DOWN'],
  [/無属性ダメージDOWN/g, 'Cosmic Damage DOWN'],
  [/火属性ダメージUP/g, 'Fire Damage UP'],
  [/水属性ダメージUP/g, 'Water Damage UP'],
  [/木属性ダメージUP/g, 'Flora Damage UP'],
  [/無属性ダメージUP/g, 'Cosmic Damage UP'],
  [/属性被ダメージDOWN/g, 'Element Damage Taken DOWN'],
  [/属性被ダメージUP/g, 'Element Damage Taken UP'],
  [/属性ダメージDOWN/g, 'Element Damage DOWN'],
  [/属性ダメージUP/g, 'Element Damage UP'],
  [/属性ダメDOWN/g, 'Element Damage DOWN'],
  [/属性ダメUP/g, 'Element Damage UP'],
  [/被ダメージDOWN/g, 'Damage Taken DOWN'],
  [/被ダメージUP/g, 'Damage Taken UP'],
  [/ダメージDOWN/g, 'Damage DOWN'],
  [/ダメージUP/g, 'Damage UP'],
  [/ダメDOWN/g, 'Damage DOWN'],
  [/ダメUP/g, 'Damage UP'],
  [/HP&ATKUP/g, 'HP & ATK UP'],
  [/ATKDOWN/g, 'ATK DOWN'],
  [/ATKUP/g, 'ATK UP'],
  [/HP継続回復/g, 'HP Regen'],
  [/継続回復/g, 'Regen'],
  [/HP回復/g, 'HP Heal'],
  [/回復阻害/g, 'Heal Block'],
  [/回復/g, 'Heal'],
  [/クリティカル/g, 'Critical'],
  [/回避/g, 'Evasion'],
  [/暗闇無効/g, 'Blind Immunity'],
  [/呪い無効/g, 'Curse Immunity'],
  [/凍結無効/g, 'Freeze Immunity'],
  [/やけど無効/g, 'Burn Immunity'],
  [/暗闇/g, 'Blind'],
  [/呪い/g, 'Curse'],
  [/凍結/g, 'Freeze'],
  [/やけど/g, 'Burn'],
  [/デバフ解除/g, 'Debuff Removal'],
  [/バフ解除/g, 'Buff Removal'],
  [/デバフ/g, 'Debuff'],
  [/バフ/g, 'Buff'],
  [/ガッツ/g, 'Guts'],
  [/敵/g, 'Enemy'],
  [/リタイア/g, 'Retire'],
  [/スコア内訳/g, 'Score Breakdown'],
  [/行動数補正/g, 'Action Count Modifier'],
  [/基礎/g, 'Base'],
  [/総与ダメ/g, 'Total Damage'],
  [/与ダメ/g, 'Damage Dealt'],
  [/有利被ダメ/g, 'Advantage Damage Taken'],
  [/不利被ダメ/g, 'Disadvantage Damage Taken'],
  [/被ダメ/g, 'Damage Taken'],
  [/残HP/g, 'Remaining HP'],
  [/総HP/g, 'Total HP'],
  [/有利/g, 'Advantage'],
  [/等倍/g, 'Neutral'],
  [/不利/g, 'Disadvantage'],
  [/先手/g, 'First'],
  [/後手/g, 'Second'],
  [/単発/g, 'Single'],
  [/連撃/g, 'Double'],
  [/相手全体/g, 'All Foes'],
  [/相手選択/g, 'Selected Foe'],
  [/相手/g, 'Foe'],
  [/味方全体/g, 'All Allies'],
  [/味方選択/g, 'Selected Ally'],
  [/味方/g, 'Ally'],
  [/自/g, 'Self'],
  [/火属性/g, 'Fire'],
  [/水属性/g, 'Water'],
  [/木属性/g, 'Flora'],
  [/無属性/g, 'Cosmic'],
  [/全/g, 'Omni'],
  [/火/g, 'Fire'],
  [/水/g, 'Water'],
  [/木/g, 'Flora'],
  [/無/g, 'Cosmic'],
  [/極大/g, 'XL'],
  [/極小/g, 'Min'],
  [/小/g, 'S'],
  [/中/g, 'M'],
  [/大/g, 'L'],
  [/弱/g, 'Weak'],
  [/強/g, 'Strong'],
  [/寄り/g, '-leaning '],
];

export function isEnglishLocale(locale: unknown): boolean {
  return String(locale ?? '').toLowerCase().startsWith('en');
}

export function localizeCharacterName(value: unknown, locale: unknown): string {
  const text = toDisplayString(value);
  if (!isEnglishLocale(locale)) return text;
  return englishCharacterNameByJa.get(text) ?? text;
}

export function localizeCostumeName(card: CardLike | string, locale: unknown): string {
  if (!isEnglishLocale(locale)) {
    return typeof card === 'string' ? card : toDisplayString(card.costume);
  }

  const cardName = typeof card === 'string' ? '' : toDisplayString(card.name);
  const fallback = typeof card === 'string' ? card : toDisplayString(card.costume);
  const key = getCostumeKey(cardName);
  if (!key) return localizeGameText(fallback, locale);
  return costumeKeyOverrides[key] ?? titleCaseCostumeKey(key);
}

export function localizeCardTitle(card: CardLike, locale: unknown): string {
  const characterName = localizeCharacterName(card.chara, locale);
  const costumeName = localizeCostumeName(card, locale);
  if (!characterName) return costumeName;
  if (!costumeName) return characterName;
  return isEnglishLocale(locale)
    ? `${characterName} [${costumeName}]`
    : `${characterName}【${costumeName}】`;
}

export function localizeGameText(value: unknown, locale: unknown): string {
  const text = toDisplayString(value);
  if (!isEnglishLocale(locale)) return text;
  if (exactTextMap[text] !== undefined) return exactTextMap[text];

  let result = text;
  for (const name of japaneseCharacterNames) {
    result = result.replaceAll(name, englishCharacterNameByJa.get(name) ?? name);
  }
  for (const [pattern, replacement] of textReplacements) {
    result = result.replace(pattern, replacement);
  }
  return normalizeEnglishSpacing(result);
}

export function localizeOptionItems<T extends string>(
  values: readonly T[],
  locale: unknown
): Array<{ title: string; value: T }> {
  return values.map((value) => ({
    title: localizeGameText(value, locale),
    value,
  }));
}

export function localizeNumberUnit(
  value: number | string,
  unitJa: string,
  locale: unknown
): string {
  if (!isEnglishLocale(locale)) return `${value}${unitJa}`;
  if (unitJa === '回') return `${value} times`;
  if (unitJa === '行動') return `${value} actions`;
  if (unitJa === '秒') return `${value} sec`;
  return `${value}`;
}

function getCostumeKey(cardName: string): string {
  if (!cardName.includes('_')) return '';
  return cardName.slice(cardName.indexOf('_') + 1);
}

function titleCaseCostumeKey(key: string): string {
  return key
    .replace(/_/g, ' ')
    .split(' ')
    .map((word) => {
      const lower = word.toLowerCase();
      if (['of', 'the', 'and', 'at'].includes(lower)) return lower;
      if (lower === 'c&d') return 'C&D';
      if (lower === 'tmu') return 'TMU';
      return toTitleCase(word);
    })
    .join(' ')
    .replace(/^./, (char) => char.toUpperCase());
}

function toTitleCase(value: string): string {
  return value
    .split(/[\s_-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(' ');
}

function toDisplayString(value: unknown): string {
  return value === undefined || value === null ? '' : String(value);
}

function normalizeEnglishSpacing(value: string): string {
  return value
    .replace(/（/g, '(')
    .replace(/）/g, ')')
    .replace(/、/g, ', ')
    .replace(/：/g, ': ')
    .replace(/\s+/g, ' ')
    .replace(/Enemy(\d)/g, 'Enemy $1')
    .replace(/Omni(ATK|DF|BS)/g, 'Omni $1')
    .replace(/Cosmic(ATK|DF|BS)/g, 'Cosmic $1')
    .replace(/\s+([),])/g, '$1')
    .replace(/([(])\s+/g, '$1')
    .trim();
}
