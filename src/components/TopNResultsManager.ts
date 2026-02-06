// 効率的な上位N件結果管理クラス

export class TopNResultsManager<T> {
  private results: T[] = [];
  private readonly maxSize: number;
  private readonly compareFunc: (a: T, b: T) => number;
  private thresholdScore: number;
  private readonly getScore: (item: T) => number;
  private readonly isDescending: boolean; // 降順かどうか
  private isSorted: boolean = true; // Opt-31: ソート済みフラグで再ソートを抑制

  constructor(
    maxSize: number, 
    compareFunc: (a: T, b: T) => number,
    getScore: (item: T) => number,
    isDescending: boolean = true // デフォルトは降順（大きい値が良い）
  ) {
    this.maxSize = maxSize;
    this.compareFunc = compareFunc;
    this.getScore = getScore;
    this.isDescending = isDescending;
    // 昇順と降順で初期値を変える
    this.thresholdScore = isDescending ? -Infinity : Infinity;
  }

  /**
   * 新しい結果を追加（上位N件に入る場合のみ）
   * @param item 追加する結果
   * @returns 追加された場合true、スキップされた場合false
   */
  addResult(item: T): boolean {
    const score = this.getScore(item);
    const results = this.results;

    // まだ最大サイズに達していない場合
    if (results.length < this.maxSize) {
      results.push(item);
      this.isSorted = false;
      
      // 最大サイズに達した時点で初回ソート
      if (results.length === this.maxSize) {
        results.sort(this.compareFunc);
        this.isSorted = true;
        // 閾値は最後の要素（最悪の要素）のスコア
        this.thresholdScore = this.getScore(results[results.length - 1]);
      }
      return true;
    }

    // 上位N件に入るかどうかの判定（昇順と降順で条件が異なる）
    const shouldAdd = this.isDescending 
      ? score > this.thresholdScore  // 降順：より大きい値が良い
      : score < this.thresholdScore; // 昇順：より小さい値が良い
    
    if (!shouldAdd) {
      return false;
    }

    // 二分探索で挿入位置を特定
    const insertIndex = this.findInsertIndex(item);
    
    // 挿入して末尾を削除
    results.splice(insertIndex, 0, item);
    results.pop();
    this.isSorted = true;
    
    // 新しい閾値スコアを更新
    this.thresholdScore = this.getScore(results[results.length - 1]);
    
    return true;
  }

  /**
   * 二分探索で挿入位置を特定
   */
  private findInsertIndex(item: T): number {
    let left = 0;
    let right = this.results.length;

    while (left < right) {
      const mid = Math.floor((left + right) / 2);
      // compareFunc(a, b) > 0 means a should come after b in the sorted order
      if (this.compareFunc(item, this.results[mid]) < 0) {
        right = mid;
      } else {
        left = mid + 1;
      }
    }

    return left;
  }

  /**
   * 現在の結果を取得
   */
  getResults(): T[] {
    // Opt-31: 未ソート時のみソートして返す
    if (!this.isSorted) {
      this.results.sort(this.compareFunc);
      this.isSorted = true;
    }
    return this.results.slice();
  }

  /**
   * 現在の結果数
   */
  size(): number {
    return this.results.length;
  }

  /**
   * 上位N件に入るための閾値スコア
   */
  getThresholdScore(): number {
    return this.thresholdScore;
  }

  /**
   * 結果をクリア
   */
  clear(): void {
    this.results = [];
    this.thresholdScore = this.isDescending ? -Infinity : Infinity;
    this.isSorted = true;
  }
}

// デッキ探索結果の型定義
export interface DeckResult {
  hp: number;
  ehp: number;
  evasion: number;
  hpBuddy: number;
  increasedHpBuddy: number;
  buddy: number;
  noHpBuddy: number;
  duo: number;
  buff: number;
  debuff: number;
  maxCosmic: number;
  maxFire: number;
  maxWater: number;
  maxFlora: number;
  referenceDamage: number;
  referenceAdvantageDamage: number;
  referenceVsHiDamage: number;
  referenceVsMizuDamage: number;
  referenceVsKiDamage: number;
  healNum: number;
  chara1: string;
  chara2: string;
  chara3: string;
  chara4: string;
  chara5: string;
  simuURL: string;
  detailList: any;
}

/**
 * デッキ探索専用の結果管理クラス
 */
export class DeckSearchResultsManager {
  private manager: TopNResultsManager<DeckResult>;
  
  constructor(maxResults: number, sortCriteria: Array<{key: string, order: string}>) {
    // 複数ソート条件に対応した比較関数
    const compareFunc = (a: DeckResult, b: DeckResult): number => {
      for (const criteria of sortCriteria) {
        const aValue = (a as any)[criteria.key];
        const bValue = (b as any)[criteria.key];
        
        if (aValue === bValue) continue;
        
        const comparison = aValue < bValue ? -1 : 1;
        return criteria.order === '昇順' ? comparison : -comparison;
      }
      return 0;
    };

    // 第一ソート基準のスコア取得関数
    const getScore = (item: DeckResult): number => {
      return (item as any)[sortCriteria[0].key];
    };

    // 第一ソート基準が降順かどうかを判定
    const isDescending = sortCriteria[0].order === '降順';

    this.manager = new TopNResultsManager(maxResults, compareFunc, getScore, isDescending);
  }

  /**
   * 新しいデッキ結果を追加
   * @param deck デッキ結果
   * @returns 上位N件に追加された場合true
   */
  addDeck(deck: DeckResult): boolean {
    return this.manager.addResult(deck);
  }

  /**
   * 現在の上位結果を取得
   */
  getTopDecks(): DeckResult[] {
    return this.manager.getResults();
  }

  /**
   * 現在の結果数
   */
  getCount(): number {
    return this.manager.size();
  }

  /**
   * 上位に入るための閾値スコア
   */
  getThreshold(): number {
    return this.manager.getThresholdScore();
  }

  /**
   * 結果をクリア
   */
  clear(): void {
    this.manager.clear();
  }
}
