// 効率的な上位N件結果管理クラス

export class TopNResultsManager<T> {
  private results: T[] = [];
  private readonly maxSize: number;
  private readonly compareFunc: (a: T, b: T) => number;
  // 現在の上位N件に入るための一次判定境界値。
  // 降順なら「これより大きければ候補」、昇順なら「これより小さければ候補」。
  private thresholdScore: number;
  private readonly getScore: (item: T) => number;
  private readonly isDescending: boolean; // 降順かどうか
  private readonly allowThresholdTieForConsider: boolean;
  private isSorted: boolean = true; // Opt-31: ソート済みフラグで再ソートを抑制

  constructor(
    maxSize: number, 
    compareFunc: (a: T, b: T) => number,
    getScore: (item: T) => number,
    isDescending: boolean = true, // デフォルトは降順（大きい値が良い）
    allowThresholdTieForConsider: boolean = true
  ) {
    // UI入力由来で文字列が混入しても壊れないように、ここで整数へ正規化する。
    const normalizedMaxSize = Number(maxSize);
    this.maxSize = Number.isFinite(normalizedMaxSize)
      ? Math.max(0, Math.trunc(normalizedMaxSize))
      : 0;
    this.compareFunc = compareFunc;
    this.getScore = getScore;
    this.isDescending = isDescending;
    this.allowThresholdTieForConsider = allowThresholdTieForConsider;
    // 昇順と降順で初期値を変える
    this.thresholdScore = isDescending ? -Infinity : Infinity;
  }

  /**
   * 新しい結果を追加（上位N件に入る場合のみ）
   * @param item 追加する結果
   * @returns 追加された場合true、スキップされた場合false
   */
  addResult(item: T): boolean {
    if (this.maxSize <= 0) return false;
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

    // まず第一ソート値だけで粗く足切りする。
    // ここで落とすことで、比較関数の多段比較や挿入処理を最小化する。
    // （同値の扱いは canPossiblyAddScore 側で制御）
    let shouldAdd = false;
    if (this.isDescending) {
      if (score > this.thresholdScore) {
        shouldAdd = true;
      } else if (score === this.thresholdScore && this.allowThresholdTieForConsider) {
        // 第一キー同値のときは最下位要素と厳密比較し、実際に順位が上がる場合のみ採用する。
        shouldAdd = this.compareFunc(item, results[results.length - 1]) < 0;
      }
    } else {
      if (score < this.thresholdScore) {
        shouldAdd = true;
      } else if (score === this.thresholdScore && this.allowThresholdTieForConsider) {
        shouldAdd = this.compareFunc(item, results[results.length - 1]) < 0;
      }
    }
    if (!shouldAdd) return false;

    let insertIndex = 0;
    if (this.compareFunc(item, results[0]) < 0) {
      insertIndex = 0;
    } else {
      insertIndex = this.findInsertIndex(item, results);
    }

    // splice は配列再確保/境界チェックのコストが高くなりやすいため、
    // 固定長運用では手動シフトで入れ替える。
    if (insertIndex >= this.maxSize) {
      return false;
    }
    for (let i = this.maxSize - 1; i > insertIndex; i--) {
      results[i] = results[i - 1];
    }
    results[insertIndex] = item;
    this.isSorted = true;
    
    // 新しい閾値スコアを更新
    this.thresholdScore = this.getScore(results[results.length - 1]);
    
    return true;
  }

  /**
   * 第一ソート値だけで「追加の可能性があるか」を判定する。
   * 同値は二次キーで逆転し得るため許可する。
   */
  canPossiblyAddScore(score: number): boolean {
    if (this.maxSize <= 0) return false;
    if (this.results.length < this.maxSize) {
      return true;
    }
    // 複数キーソートでは、第一キーが同値でも第二キー以下で順位が逆転する。
    // そのため「同値を候補に残すか」を外から切り替え可能にしている。
    if (this.allowThresholdTieForConsider) {
      return this.isDescending ? score >= this.thresholdScore : score <= this.thresholdScore;
    }
    return this.isDescending ? score > this.thresholdScore : score < this.thresholdScore;
  }

  /**
   * 二分探索で挿入位置を特定
   */
  private findInsertIndex(item: T, results: T[]): number {
    let left = 0;
    let right = results.length;

    while (left < right) {
      const mid = (left + right) >>> 1;
      // compareFunc(a, b) > 0 means a should come after b in the sorted order
      if (this.compareFunc(item, results[mid]) < 0) {
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
    // 追加時に毎回 sort しない代わりに、参照時に必要な時だけ sort する。
    // 探索中に addResult が大量に呼ばれるケースで効果が大きい。
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
  
  constructor(
    maxResults: number,
    sortCriteria: Array<{key: string, order: string}>,
    options?: { allowThresholdTieForConsider?: boolean }
  ) {
    const sortLen = sortCriteria.length;
    const sortKeys = new Array<string>(sortLen);
    const sortDirs = new Int8Array(sortLen);
    for (let i = 0; i < sortLen; i++) {
      sortKeys[i] = sortCriteria[i].key;
      sortDirs[i] = sortCriteria[i].order === '昇順' ? 1 : -1;
    }
    const primarySortKey = sortKeys[0];
    const isDescending = sortDirs[0] === -1;
    // 複数ソート条件に対応した比較関数。
    // 各キーを順に比較し、差が出た時点で確定する（一般的な辞書順比較）。
    const compareFunc = (a: DeckResult, b: DeckResult): number => {
      for (let i = 0; i < sortLen; i++) {
        const key = sortKeys[i];
        const aValue = (a as any)[key];
        const bValue = (b as any)[key];

        if (aValue === bValue) continue;

        const comparison = aValue < bValue ? -1 : 1;
        return comparison * sortDirs[i];
      }
      // 全ソートキー同値時は deckKey で安定順序を作る。
      // これにより maxResult の違いによる同点時の順位揺れを抑える。
      const aKey = (a as any)._deckKey as string | undefined;
      const bKey = (b as any)._deckKey as string | undefined;
      if (aKey === bKey) return 0;
      if (aKey === undefined) return 1;
      if (bKey === undefined) return -1;
      return aKey < bKey ? -1 : 1;
    };

    // TopNResultsManager 側の閾値判定に使う一次キー値を抽出。
    // 二次キー以降の厳密順序は compareFunc が担保する。
    const getScore = (item: DeckResult): number => {
      return (item as any)[primarySortKey];
    };

    this.manager = new TopNResultsManager(
      maxResults,
      compareFunc,
      getScore,
      isDescending,
      options?.allowThresholdTieForConsider ?? true
    );
  }

  /**
   * 新しいデッキ結果を追加
   * @param deck デッキ結果
   * @returns 上位N件に追加された場合true
   */
  addDeck(deck: DeckResult): boolean {
    return this.manager.addResult(deck);
  }

  shouldConsider(primaryScore: number): boolean {
    return this.manager.canPossiblyAddScore(primaryScore);
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
