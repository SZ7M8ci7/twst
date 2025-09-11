// 共通ソートユーティリティ
import charactersInfo from '@/assets/characters_info.json';

export interface SortableCharacter {
  rare: string;
  implementation_date: string;
  chara: string;
  [key: string]: any;
}

// characters_info.jsonの順序マップを作成
const characterOrderMap = new Map();
charactersInfo.forEach((char, index) => {
  characterOrderMap.set(char.name_ja, index);
});

/**
 * レアリティと実装日による多段階ソート関数
 * @param a 比較対象のキャラクターA
 * @param b 比較対象のキャラクターB
 * @param primaryComparison 第1キーの比較結果
 * @returns ソート結果（負数: a < b, 0: a = b, 正数: a > b）
 */
export function applyMultiLevelSort<T extends SortableCharacter>(
  a: T, 
  b: T, 
  primaryComparison: number
): number {
  // 第1キー：指定されたソート項目
  if (primaryComparison !== 0) {
    return primaryComparison;
  }
  
  // 第2キー：レアリティ（降順: SSR > SR > R）
  const rarityOrder = { 'SSR': 3, 'SR': 2, 'R': 1 };
  const aRarity = rarityOrder[a.rare as keyof typeof rarityOrder] || 0;
  const bRarity = rarityOrder[b.rare as keyof typeof rarityOrder] || 0;
  const rarityComparison = bRarity - aRarity; // 降順
  if (rarityComparison !== 0) {
    return rarityComparison;
  }
  
  // 第3キー：実装日（昇順：古い方が先）
  const aDate = new Date(a.implementation_date || '9999-12-31');
  const bDate = new Date(b.implementation_date || '9999-12-31');
  return aDate.getTime() - bDate.getTime();
}

/**
 * キャラクター順序 → レアリティ → 実装日順のデフォルトソート
 * @param characters ソート対象のキャラクター配列
 * @returns ソートされたキャラクター配列
 */
export function applyDefaultSort<T extends SortableCharacter>(characters: T[]): T[] {
  return [...characters].sort((a, b) => {
    // 第1キー：キャラクター順序（characters_info.jsonの順序）
    const aCharaIndex = characterOrderMap.get(a.chara) ?? 999999;
    const bCharaIndex = characterOrderMap.get(b.chara) ?? 999999;
    const characterComparison = aCharaIndex - bCharaIndex;
    
    return applyMultiLevelSort(a, b, characterComparison);
  });
}

/**
 * 既存のソート処理にレアリティ・実装日ソートを追加
 * @param characters ソート対象のキャラクター配列
 * @param sortFunction 既存のソート関数
 * @returns ソートされたキャラクター配列
 */
export function enhanceSort<T extends SortableCharacter>(
  characters: T[],
  sortFunction: (a: T, b: T) => number
): T[] {
  return [...characters].sort((a, b) => {
    const primaryComparison = sortFunction(a, b);
    return applyMultiLevelSort(a, b, primaryComparison);
  });
}