# ツイステ バトルエミュレーター仕様

作成日: 2026-04-26

この文書は、このプロジェクトの計算実装、外部調査、ユーザー提供の検証仕様をもとに、ツイステのバトルをエミュレートするための仕様をまとめたものです。数値係数は、ユーザー提供の検証仕様があるものを優先し、それ以外は本プロジェクトの実装を基準にします。

## 1. 仕様の信頼度

### 実装済みで確度が高い範囲

- プレイヤー側カードの HP/ATK 再計算
- プレイヤー側の与ダメージ概算
- 属性相性
- 魔法威力、連撃、デュオ魔法の係数
- ATK UP/DOWN、ダメージ UP/DOWN、属性ダメージ UP/DOWN、クリティカル
- HP 回復、HP 継続回復
- バディ HP/ATK と、SSR 限界突破後の追加バディ効果
- デッキ内のデュオ成立数の解決
- BASIC/DEFENCE/ATTACK 試験スコアのプロジェクト内推定式

### エミュレーター化には追加データが必要な範囲

- 敵カード/敵魔法ごとの HP、ATK、魔法威力、効果、行動パターン
- 敵カード/敵魔法ごとの実戦 HP、ATK、火力、攻撃回数、バフ、行動パターン
- 効果値のうち本文で直接値がないものは、既存の効果値から変化割合を推測して推定値として扱う
- 各やけど効果ごとのダメージ割合と継続ターンは都度入力する
- 複数敵がいるバトルでのターゲット指定、敵全体/味方全体効果の細則

既存の単発計算画面は主に「編成評価・ダメージ推定・試験スコア推定」を扱う。試験シミュレーター `src/views/examSimulator.vue` は、この文書のステートマシンに沿って、手札抽選、許容組み合わせ、敵行動、状態効果、早期終了、リタイアを含むターン進行を実行する。敵 HP、敵行動、やけど割合/継続など、試験ごとに変わる値は実行時入力データとして与える。

## 2. 参照元

### ローカル実装

- `src/utils/calculations.ts`: ステータス、ダメージ、回復、バフ辞書、属性相性
- `src/utils/buddyEffects.ts`: バディ効果、追加バディ効果、SSR 限界突破バディ強化
- `src/utils/duoLogic.ts`: デッキ内デュオ成立解決
- `src/utils/buffParser.ts`: `etc` 文字列からバフ情報を抽出するパーサー
- `src/utils/simulatorAttributes.ts`: 対火/対水/対木/対無/対全のダメージ選択
- `src/utils/totsu.ts`: 限界突破、M3 解禁、バディ強化条件
- `src/constants/levels.ts`: レアリティ別最大レベル
- `src/components/common.ts`: デッキ探索用の高速ダメージ/HP/指標計算
- `src/views/calcBASIC.vue`: BASIC 試験スコア推定式
- `src/views/calcDEF.vue`: DEFENCE 試験スコア推定式
- `src/views/calcATK.vue`: ATTACK 試験スコア推定式
- `src/views/finisherDamage.vue`: フィニッシャー最大ダメージ計算

### Web 調査

- [神ゲー攻略: バトルのコツとシステム要素一覧](https://kamigame.jp/%E3%83%84%E3%82%A4%E3%82%B9%E3%83%86/%E6%94%BB%E7%95%A5%E3%82%AC%E3%82%A4%E3%83%89/%E3%83%90%E3%83%88%E3%83%AB.html): ターン順、勝利条件、属性、バディ、デュオ条件
- [公式 FAQ: The HP % is not displayed in the Exams](https://faq.twisted-wonderland.aniplex.co.jp/faq/show/282?category_id=29&return_path=%2Fcategory%2Fshow%2F29%3Fpage%3D1%26site_domain%3Den%26sort%3Dsort_access%26sort_order%3Ddesc&site_domain=en): Basic/Defense 試験の採点方針
- [ツイステ攻略wiki: アタックテスト26期](https://twstswt.gamewiki.jp/nrc-test-26/): ATK 試験 10T、6T-10T 後攻スタート、撃破ターン評価
- [ゲーム乱舞: デュオ魔法の一覧と効果](https://gameranbu.jp/twistedwonderland/52eb78acafd7cb2c9751): デュオ条件、2連撃から3連撃への強化
- [Twisted Wonderland Wiki Fandom: Battle](https://twisted-wonderland.fandom.com/wiki/Battle): Duo Magic の概要
- [Gamerch: 試験でハイスコアを取るテクニック](https://gamerch.com/twisted-wonderland/333890): 試験でのオーバーキル加算
- [Gamerch: 魔法効果の一覧と詳細](https://gamerch.com/twisted-wonderland/859546): 魔法効果の分類、対象範囲表記
- [ツイステ攻略: 回復スキル解説](https://tw.xn--h9jepie9n6a5394exeq51z.com/ecovery/): HP 回復/HP 継続回復の係数と、呪い・凍結との相互作用

### ユーザー提供仕様

- 2026-04-27 のユーザー提供仕様: 乱数、丸め、暗闇、回避、呪い、凍結、デバフ解除、ガッツ、やけど、ターゲット、DUOシミュレーション、敵行動抽選、ATKUP極大、ダメージUP極大、回復&継続回復(中)、不明効果値の比率推定の扱い。
- `https://lyou-free.com/` に記載されている確率値は信頼度が低いものとして採用しない。

### ユーザー提示動画

- [【ツイステ攻略】バトルのしくみ 基本編 【初心者向け】](https://www.youtube.com/watch?v=-Iz3SnrQsjw)
- [【ツイステ攻略】BS試験のしくみ① -基本編 -【試験初心者向け】](https://www.youtube.com/watch?v=LK4nZsDw5U0)
- [【ツイステ攻略】BS試験のしくみ② -編成編- 【試験初心者向け】](https://www.youtube.com/watch?v=N0_OzYP06ZE)
- [【ツイステ攻略】DF試験のしくみ① 基本編 【試験初心者向け】](https://www.youtube.com/watch?v=-0lNEf1-GdA)
- [【ツイステ攻略】DF試験のしくみ② 編成編 【試験初心者向け】](https://www.youtube.com/watch?v=x_2O0Sjhj3M)
- [【ツイステ攻略】ATK試験のしくみ① 基本編 【試験初心者向け】](https://www.youtube.com/watch?v=plj44lQglFM)

## 3. 基本バトル構造

### 編成

- プレイヤーは通常 5 枚のカードでデッキを組む。
- 各カードは通常 M1/M2 を持つ。
- SSR は条件を満たすと M3 を使える。このプロジェクトでは `rare === 'SSR'` かつ `totsu >= 3` のとき M3 解禁とする。
- 各ターンに 2 つの魔法を選ぶ。
- 同一ターン内の攻撃順は、先攻/後攻ターンで変わる。
- 攻撃は常に初手同士、後手同士で解決する。
- ターゲット不可やカード単位の戦闘不能状態は存在しないものとして扱う。

### ターン順

神ゲー攻略の記述と本プロジェクトの前提を合わせると、標準 5 ターンバトルの攻撃順は次の通り。

| ターン | 先後 | 行動順 |
|---:|---|---|
| 1 | プレイヤー先攻 | 自分1 -> 敵1 -> 自分2 -> 敵2 |
| 2 | プレイヤー後攻 | 敵1 -> 自分1 -> 敵2 -> 自分2 |
| 3 | プレイヤー先攻 | 自分1 -> 敵1 -> 自分2 -> 敵2 |
| 4 | プレイヤー後攻 | 敵1 -> 自分1 -> 敵2 -> 自分2 |
| 5 | プレイヤー先攻 | 自分1 -> 敵1 -> 自分2 -> 敵2 |

エミュレーターでは `TurnAction[]` をこの順で作る。プレイヤー1手目は敵1手目と、プレイヤー2手目は敵2手目と対応する。ターン内ではまずこの行動順で4行動分の追加効果を判定し、その後に同じ行動順で攻撃ダメージを解決する。つまり、4行動目のバフ/デバフ判定が終わってから1行動目の攻撃が始まる。

試験シミュレーターでは BS/BASIC と DF/DEFENCE は最大 5T、ATK/ATTACK は最大 10T とする。ATK は 1T から 5T までは通常の先攻/後攻交互、6T から 10T は後攻スタートとして扱う。

| ターン | 先後 | 行動順 |
|---:|---|---|
| 6 | プレイヤー後攻 | 敵1 -> 自分1 -> 敵2 -> 自分2 |
| 7 | プレイヤー後攻 | 敵1 -> 自分1 -> 敵2 -> 自分2 |
| 8 | プレイヤー後攻 | 敵1 -> 自分1 -> 敵2 -> 自分2 |
| 9 | プレイヤー後攻 | 敵1 -> 自分1 -> 敵2 -> 自分2 |
| 10 | プレイヤー後攻 | 敵1 -> 自分1 -> 敵2 -> 自分2 |

### バトル種別と勝利条件

| 種別 | 勝利条件 |
|---|---|
| 5ターン制限バトル | 5ターン終了時に敵より多くのダメージを与えている、または敵 HP を 0 にする |
| ターン無制限バトル | 敵 HP を 0 にする |
| 5ターン耐久バトル | 5ターン終了まで生存する、または敵 HP を 0 にする |
| BASIC 試験 | 通常試験形式。与ダメージが主に評価される |
| DEFENCE 試験 | 残 HP が主に評価される |
| ATTACK 試験 | 敵 HP を削り切る速さ、手数、属性、バフ等が評価される |

公式 FAQ は Basic Exam と Defense Exam の違いを明示しており、Defense は戦闘終了時の残 HP が高いほど高スコアになる。

試験シミュレーターでは、最大ターン到達前でも敵 HP または味方総 HP が 0 になった時点で試行を終了する。味方総 HP が 0 になった場合はリタイア扱いとし、試験種別にかかわらずスコアは `0` として分布に含める。敵 HP が 0 になった場合はそのターン・手番までを終了ログとして、試験タイプ別のスコア式を計算する。

## 4. データモデル

### Card

最低限必要なカードデータ。

```ts
type Element = '火' | '水' | '木' | '無';
type Rarity = 'R' | 'SR' | 'SSR';

type Card = {
  id: string;
  name: string;       // カード名
  chara: string;      // キャラ名。バディ/デュオはこの値で判定する
  rare: Rarity;
  type?: string;

  hp: number;
  atk: number;
  base_hp?: number;
  base_atk?: number;
  max_hp?: number;
  max_atk?: number;
  originalMaxHP?: number;
  originalMaxATK?: number;

  level: number;
  totsu: number;      // 0..4
  isLimitBreak?: boolean;
  hasM3?: boolean;

  magic1: Magic;
  magic2: Magic;
  magic3?: Magic;

  buddy1?: Buddy;
  buddy2?: Buddy;
  buddy3?: Buddy;

  duo?: string;       // デュオ相手のキャラ名
  etc?: string;       // カード効果テキスト
};
```

### Magic

```ts
type MagicPower =
  | '単発(弱)'
  | '単発(強)'
  | '連撃(弱)'
  | '連撃(強)'
  | '3連撃(弱)'
  | '3連撃(強)'
  | 'デュオ'
  | 'デュオ魔法';

type Magic = {
  index: 1 | 2 | 3;
  attribute: Element;
  power: MagicPower;
  level: number;      // 1..10
  effects: Effect[];
};
```

### Effect

```ts
type EffectTarget =
  | '自'
  | '相手'
  | '味方選択'
  | '相手選択'
  | '味方全体'
  | '相手全体';

type Effect = {
  kind:
    | 'ATKUP'
    | 'ATKDOWN'
    | 'ダメージUP'
    | 'ダメージDOWN'
    | '属性ダメUP'
    | '属性ダメDOWN'
    | '被ダメージUP'
    | '被ダメージDOWN'
    | 'クリティカル'
    | '回復'
    | '継続回復'
    | '回避'
    | '呪い'
    | '呪い無効'
    | '暗闇'
    | '暗闇無効'
    | '凍結'
    | '凍結無効'
    | 'デバフ解除'
    | 'バフ解除'
    | 'ガッツ'
    | 'やけど';
  power?: '極小' | '小' | '中' | '大' | '極大' | '0' | '1/1' | '1/2' | '1/3' | '2/3';
  level: number;
  target: EffectTarget;
  durationTurns?: number;
  attribute?: Element;
  sourceMagic?: 1 | 2 | 3;
};
```

### Buddy

```ts
type Buddy = {
  partnerChara: string;
  status: string;        // 例: 'HPUP(中)', 'ATKUP(小)', 'HP&ATKUP(小)'
  statusTotsu?: string;  // SSR 2凸以降用の強化後効果
  level: number;         // 1..10
};
```

## 5. レベル、限界突破、ステータス

### レアリティ別最大レベル

本プロジェクトの `getStatScalingMaxLevel` は次を採用している。

| レアリティ | 最大レベル |
|---|---:|
| R | 70 |
| SR | 90 |
| SSR | 120 |

### M3/バディ強化

`src/utils/totsu.ts` の条件。

| 条件 | 判定 |
|---|---|
| M3 解禁 | `rare === 'SSR' && totsu >= 3` |
| 限界突破バディ強化 | `rare === 'SSR' && totsu >= 2` |
| 完凸 | `totsu >= 4` |

### HP/ATK 再計算式

`src/utils/calculations.ts` の `calculateStatFromLevel` が基準。

```ts
maxLevel = rare === 'R' ? 70 : rare === 'SR' ? 90 : 120
calculatedBaseStat = baseStat || floor(maxStat / divisor)
divisor = SSR: 4.7, SR: 4.3, R: 4.2
bonusStat = calculatedBaseStat * 0.2
statPerLv = (maxStat - 2 * bonusStat - calculatedBaseStat) / (maxLevel - 1)
levelDiff = maxLevel - level
totsurate = isLimitBreak ? 0 : 1
stat = (maxStat - statPerLv * levelDiff) - bonusStat * totsurate
result = max(0, Number(stat.toFixed(1)))
```

注意:

- `maxStat` は `originalMaxHP/originalMaxATK` を優先し、なければ `max_hp/max_atk`、さらに現在値を使う。
- 完凸時は `bonusStat` の減算がなくなる。
- プロジェクト上は小数 1 桁を保持する。表示や最終集計では丸めが混ざる。

## 6. 属性

### 属性一覧

火、水、木、無の 4 種類。

### 属性相性

| 攻撃属性 | 対火 | 対水 | 対木 | 対無 |
|---|---:|---:|---:|---:|
| 火 | 1.0 | 0.5 | 1.5 | 1.0 |
| 水 | 1.5 | 1.0 | 0.5 | 1.0 |
| 木 | 0.5 | 1.5 | 1.0 | 1.0 |
| 無 | 1.0 | 1.0 | 1.0 | 1.0 |

### 無属性補正

プロジェクトの与ダメージ式では、攻撃魔法が無属性の場合に魔法倍率側へ `1.1` を加味する。

```ts
attributeAdjust = magicAttribute === '無' ? 1.1 : 1.0
```

これは属性相性とは別の基礎倍率であり、対火/対水/対木/対無の相性倍率はすべて 1.0 のまま扱う。

## 7. 魔法威力と連撃

### 魔法レベル倍率

`src/utils/calculations.ts` の `magicDict` と `src/components/common.ts` の検索用式を整理したもの。

| 威力 | Lv1 | Lv10 | 式 |
|---|---:|---:|---|
| 弱 | 0.525 | 0.75 | `0.5 + 0.025 * Lv` |
| 強 | 0.6625 | 1.0 | `0.625 + 0.0375 * Lv` |
| デュオ魔法 | 0.525 | 1.0 | Lv1..9 は弱相当、Lv10 は 1.0 |

注意:

- プロジェクトの通常シミュレーターでは `デュオ` を `デュオ魔法` に変換する。
- `components/common.ts` のデッキ探索では、`デュオ魔法` は強相当の基礎倍率 `1.0` として扱われる。
- デュオが Lv5 から発動可能というゲーム仕様は外部情報で確認できるが、プロジェクト側の `resolveDeckDuoAvailability` は魔法レベル条件を見ていない。実装時は `M2 Lv >= 5` を必ず条件に加えるべき。

### 連撃倍率

プロジェクトはヒット数そのものではなく、総ダメージ係数として扱う。

| 魔法種別 | 連撃倍率 |
|---|---:|
| 単発 | 1.0 |
| 連撃(弱), 連撃(強) | 1.8 |
| デュオ魔法, 3連撃(弱), 3連撃(強) | 2.4 |

そのため、基礎ダメージは次のようになる。

```ts
baseRate = magicRatio * attributeAdjust + damageBuffTotal
damageBeforeElement = effectiveATK * baseRate * comboMultiplier * criticalMultiplier
```

## 8. 与ダメージ計算

### プロジェクトの標準式

`src/utils/calculations.ts` の `calculateDamage` をエミュレーター向けに整理する。

```ts
buddyATK = card.atk * sum(activeBuddyAtkRate)
atkBuffTotal = card.atk * sum(activeAtkBuffRate)
effectiveATK = card.atk + buddyATK + atkBuffTotal

magicRatio = magicDict[power + 'Lv' + level]
attributeAdjust = magic.attribute === '無' ? 1.1 : 1.0
comboMultiplier = 1.0 | 1.8 | 2.4
criticalMultiplier = max(activeCriticalMultipliers, default 1.0)

damageBeforeElement =
  effectiveATK *
  (magicRatio * attributeAdjust + damageBuffTotal) *
  comboMultiplier *
  criticalMultiplier

damageVsTarget = round(damageBeforeElement * elementCompatibility)
```

### バフの加算単位

- ATK 系は `card.atk` に対する加算値として合算する。
- バディ ATK も `card.atk` に対する加算値として合算する。
- ダメージ UP/DOWN 系は魔法倍率に加算する。戦闘中に追加された `ダメージDOWN` や `被ダメージDOWN` も最終ダメージへの乗算ではなく、現在の魔法倍率項から効果値を減算して扱う。
- 属性ダメージ UP/DOWN は、対象属性が魔法属性と一致する場合だけダメージ UP 系に加算する。
- クリティカルは複数あっても最大倍率のみ採用する。

### 丸め

プロジェクト内で丸めは完全には統一されていない。

| 箇所 | 丸め |
|---|---|
| `calculateDamage` の各魔法ダメージ詳細 | `Math.round` |
| `calculateDamage` の属性別合計 | 魔法ごとに `Math.round` して加算 |
| `finisherDamage.vue` の基礎ダメージ | `Math.floor` |
| `components/common.ts` のデッキ探索最終ダメージ | 集計後 `Math.floor` |
| 試験スコア | 箇所により `toFixed`, `Math.floor` |

完全エミュレーターでは、目的別に丸めルールを分ける。

- 実戦 HP 推移再現: 小数点以下は切り上げる。
- 現プロジェクト互換: 魔法単位で `round`、検索結果は最終 `floor` を使う。
- 試験スコア推定: 既存の `calc*.vue` と同じ丸めを使う。

### 乱数

外部情報では、実バトルのダメージには乱数があるとされる。既存の単発計算画面は deterministic な推定値を出すが、試験シミュレーターはユーザー検証仕様に従い、ダメージごとに乱数係数を抽選する。

エミュレーター設計では次のいずれかを選ぶ。

- `rngMode: 'none'`: このプロジェクト互換。乱数なし。
- `rngMode: 'expected'`: 期待値係数を 1.0 とする。
- `rngMode: 'uniform'`: `0.95 <= r <= 1.05` の一様分布を使う。

プロジェクト互換では `rngMode: 'none'` とする。実ゲーム再現では `rngMode: 'uniform'` を使い、乱数係数は `0.95` から `1.05` の一様分布で抽選する。

## 9. バフ/デバフ係数

### ATK UP/DOWN

`src/utils/calculations.ts` の式。

| 強度 | 係数 |
|---|---|
| 極小 | `(5 + 0.5 * Lv) / 100` |
| 小 | `(10 + 1 * Lv) / 100` |
| 中 | `(20 + 1.5 * Lv) / 100` |
| 大 | `(30 + 2 * Lv) / 100` |
| 極大 | Lv10 は `0.80`。Lv1-9 は既存 `calculations.ts` の極大カーブを Lv10 `80%` に正規化して推定する。 |

DOWN は同じ値をマイナスにする。

Lv10 の値:

| 強度 | UP | DOWN |
|---|---:|---:|
| 極小 | +10% | -10% |
| 小 | +20% | -20% |
| 中 | +35% | -35% |
| 大 | +50% | -50% |
| 極大 | +80% | -80% |

注意: `src/utils/calculations.ts` の式では ATK UP 極大 Lv10 が `+90%` になるが、ユーザー提供仕様では `+80%` を正とする。エミュレーターでは `+80%` を標準とし、プロジェクト互換モードだけ `calculations.ts` の `+90%` を再現できるようにする。

ATK UP 極大の推定 Lv 別値:

```ts
ATKUP_極大_rate(Lv) = ((50 + 4 * Lv) / 90) * 0.80
```

| Lv | 推定値 |
|---:|---:|
| 1 | 48.0% |
| 2 | 51.6% |
| 3 | 55.1% |
| 4 | 58.7% |
| 5 | 62.2% |
| 6 | 65.8% |
| 7 | 69.3% |
| 8 | 72.9% |
| 9 | 76.4% |
| 10 | 80.0% |

### ダメージ UP/DOWN

| 強度 | 係数 |
|---|---|
| 極小 | `(1.25 + 0.125 * Lv) / 100` |
| 小 | `(2.5 + 0.25 * Lv) / 100` |
| 中 | `(5 + 0.375 * Lv) / 100` |
| 大 | `(7.5 + 0.5 * Lv) / 100` |
| 極大 | `(12.5 + 1 * Lv) / 100` |

Lv10:

| 強度 | UP | DOWN |
|---|---:|---:|
| 極小 | +2.5% | -2.5% |
| 小 | +5% | -5% |
| 中 | +8.75% | -8.75% |
| 大 | +12.5% | -12.5% |
| 極大 | +22.5% | -22.5% |

注意: `components/common.ts` には検索用の `ダメージUP(極大)` として `+18.75%` 相当の差異があるが、ユーザー提供仕様では `+22.5%` を正とする。エミュレーターでは `+22.5%` を標準とする。

### 属性ダメージ UP/DOWN

| 強度 | 係数 |
|---|---|
| 極小 | `(1.5 + 0.15 * Lv) / 100` |
| 小 | `(3 + 0.3 * Lv) / 100` |
| 中 | `(6 + 0.45 * Lv) / 100` |
| 大 | `(9 + 0.6 * Lv) / 100` |
| 極大 | `(15 + 1.2 * Lv) / 100` |

Lv10:

| 強度 | UP | DOWN |
|---|---:|---:|
| 極小 | +3% | -3% |
| 小 | +6% | -6% |
| 中 | +10.5% | -10.5% |
| 大 | +15% | -15% |
| 極大 | +27% | -27% |

### クリティカル

試験シミュレーターでは、ヒットごとにクリティカル発動判定を行う。発動したヒットだけ `1.25` 倍する。デュオは 3 回攻撃として扱うため、クリティカル判定も 3 回行う。

| 強度 | 発動率 | 出典 |
|---|---:|---|
| 極小 | 10.0% | 暫定推定 |
| 小 | 19.1% | user-verified |
| 中 | 33.3% | user-verified |
| 大 | 50.0% | user-verified |
| 極大 | 100.0% | user-verified |

既存のデッキシミュレーター/探索ツールでは従来どおり期待値倍率として扱う。試験シミュレーターの確率抽選とは分ける。

## 10. 回復

### HP 回復

`totalHeal += healRate * card.atk`。

HP 回復は攻撃時ではなく、バフ/デバフと同じ効果判定フェーズで即時発生する。凍結はバフ発動を止める効果として扱うため、HP 回復そのものは凍結で止めない。呪いが有効な場合は、その回復判定時点の回復量を `0` にする。

| 強度 | Lv1 | Lv10 | 式 |
|---|---:|---:|---|
| 極小 | 0.51 | 0.60 | `0.50 + 0.01 * Lv` |
| 小 | 0.92 | 1.10 | `0.90 + 0.02 * Lv` |
| 中 | 1.34 | 1.70 | `1.30 + 0.04 * Lv` |

外部の回復検証でも、小 Lv10 は ATK の 110%、中 Lv10 は 170% とされる。

### HP 継続回復

既存の単発計算画面では 3 ターン分を一括で評価する。

```ts
totalContinueHeal = 3 * continueHealRate * card.hp
```

試験シミュレーターでは一括加算しない。継続回復は「継続回復バフの付与」と「ターン終了時の回復発生」を分けて扱う。

```ts
onMagicAction:
  if frozenBeforeActivation: 継続回復バフは付与されない
  else addContinueHeal(card, continueHealRate, 3T)

onTurnEnd:
  if cursedAtHealTiming: heal = 0
  else heal += ceil(cardBaseHp * continueHealRate) for each active continue heal
```

`cardBaseHp` はカード本体 HP。バディ HP は含めない。新デッキシミュレータの `calculateCharacterStats()` も `3 * continueHealRate * character.hp` で評価しており、マレウス/ツムステ Lv120・継続回復(中)Lv10 の例では `ceil(16487 * 0.25) * 3 = 12366` になる。

HP 回復との主な違いは次の通り。

| 項目 | HP 回復 | HP 継続回復 |
|---|---|---|
| 発生単位 | 効果判定フェーズで即時 1 回 | 付与後、ターン終了時に複数回 |
| 基準値 | 使用カードの ATK | 対象カードの HP |
| 凍結判定 | 回復自体は凍結対象外 | 凍結後に発動する継続回復バフは付与されない |
| 呪い判定 | 即時回復の発生時に判定 | 各ターン終了時の回復発生ごとに判定 |

| 強度 | Lv1 | Lv10 | 3T 合計 Lv10 |
|---|---:|---:|---:|
| 小 | 0.105 | 0.15 | 45% HP |
| 中 | 0.205 | 0.25 | 75% HP |

### 回復&継続回復

- `回復&継続回復(小)` は即時回復 `回復(小)` と継続回復 `継続回復(小)` を両方足す。
- `回復&継続回復(中)` は存在しないものとして扱い、エミュレーターでは考慮しない。
- `common.ts` には `回復&継続回復(中)` 相当の係数があるが、ユーザー提供仕様を優先して使用しない。

### 呪い

Web 調査では、呪いは HP 回復と HP 継続回復を無効化する。既存の ATTACK 試験計算画面では「回復阻害数」として呪いを数える。試験シミュレーターでは、呪い付与時に成功判定を行い、有効中の回復量を 0 にする。

エミュレーターでは、回復解決時に対象へ有効な `呪い` があり、`呪い無効` がない場合は回復量を 0 にする。

## 11. バディ

### 発動条件

- `buddyXc` のキャラ名がデッキ内に存在すれば発動する。
- 相手は同じキャラ名であればカード・レアリティは問わない。
- 神ゲー攻略でも「キャラクター名が一致していればレアリティは問わない」と説明されている。

### 通常バディ効果

`getBuddyHpRate` / `getBuddyAtkRate` は、効果文字列を `&` で分解して合算する。`HP&ATKUP(...)` は分割しないよう保護される。

#### HP 系

| 効果 | 係数 |
|---|---|
| HPUP(小), HP&ATKUP(小) | `0.10 + 0.01 * Lv` |
| HPUP(中), HP&ATKUP(中) | `0.20 + 0.01 * Lv` |
| HPUP(大), HP&ATKUP(大) | `0.30 + 0.01 * Lv` |

Lv10:

| 効果 | HP 係数 |
|---|---:|
| 小 | 20% |
| 中 | 30% |
| 大 | 40% |

#### ATK 系

| 効果 | 係数 |
|---|---|
| ATKUP(小), HP&ATKUP(小) | `0.10 + 0.01 * Lv` |
| ATKUP(中), HP&ATKUP(中) | `0.20 + 0.015 * Lv` |
| ATKUP(大), HP&ATKUP(大) | `0.35 + 0.015 * Lv` |

Lv10:

| 効果 | ATK 係数 |
|---|---:|
| 小 | 20% |
| 中 | 35% |
| 大 | 50% |

### 限界突破後の追加バディ効果

SSR かつ `totsu >= 2` のとき、`buddyXs_totsu` があれば強化後効果を使う。

追加効果として以下が扱われる。

- `ダメージUP(強度)`
- `[火/水/木/無]属性ダメージUP(強度)`
- `クリティカル(強度)`
- `回避(極小)`
- `被ダメージDOWN(強度)`
- `[火/水/木/無]属性被ダメージDOWN(強度)`
- `やけど無効` / `暗闇無効` / `呪い無効` / `凍結無効`
- `HP継続回復(極小)` または `継続回復(極小)`

ダメージ UP、属性ダメージ UP、クリティカル、回避、被ダメージ DOWN の値は前述の Lv10 相当値を使う。

バディ継続回復は次の式。

```ts
buddyContinueHealPerTick = ceil(cardBaseHp * 0.10)
```

試験シミュレーターでは、追加バディ効果は戦闘開始時に付与される `99T` 効果として扱う。敵の凍結では発動を止められない。回復発生時に呪いが有効なら回復量は `0` になる。バフ解除は魔法によって付与された効果だけを解除し、追加バディ効果は解除しない。敵撃破または自HP0で戦闘が終了したターンは、通常の継続回復と同じくターン終了時の回復は発生しない。

## 12. デュオ魔法

### ゲーム仕様

外部情報では、デュオ魔法の条件は次。

1. SSR カードの MAGIC2 を Lv5 以上にする。
2. デュオ相手のキャラを同じ編成に入れる。
3. SSR の MAGIC2 とデュオ相手の魔法を同じターンに選択する。
4. 発動すると通常 2 連撃の MAGIC2 が 3 連撃へ強化される。

### プロジェクトの解決ロジック

`src/utils/duoLogic.ts` は 5 枚デッキのデュオ成立数を最大化するため、以下の優先順で割り当てる。

1. 相互デュオを優先する。
2. 未使用 M2 に対して、相手の M1/M3 を消費して割り当てる。
3. 残った M2 同士で割り当てる。

この解決は「デッキ内で最大何 DUO を成立させられるか」の推定であり、実戦のターン手札・選択順を厳密に再現するものではない。

### エミュレーターでの実装

実戦エミュレーターでは、各ターンの 2 選択について次を満たすとき M2 を `デュオ魔法` として扱う。

```ts
canDuo =
  actor.card.rare === 'SSR' &&
  actor.magic.index === 2 &&
  actor.magic.level >= 5 &&
  actor.card.duo != null &&
  selectedSameTurn.some(other => other.card.chara === actor.card.duo)
```

試験シミュレーターでは、同じターンに選んだもう片方の魔法が DUO 相手キャラの魔法である場合のみ DUO を有効にする。複数 DUO 条件がある場合、エミュレーター上ではユーザーにターンごとの許容組み合わせを最初に選択させる。最初に決めたターンごとの許容組み合わせで指定回数のシミュレーションを行い、獲得できたスコアの分布をヒストグラムで表示する。エミュレーター側では、同ターンのもう片方が DUO 相手かどうか以外の追加制限や自動最適化を行わない。

## 13. 効果のタイミング

### 基本

外部情報では、特殊効果は多くの場合、魔法攻撃前に付与される。1T 効果はその魔法を使用するターンに効く。

エミュレーターでは次の手順を推奨する。

1. 戦闘開始: 発動条件を満たす追加バディ効果を `99T` の初期状態として付与する。
2. ターン開始: 前ターンから残っている効果の残りターンを確認する。
3. プレイヤー先攻ターンなら `自分1 -> 敵1 -> 自分2 -> 敵2`、プレイヤー後攻ターンなら `敵1 -> 自分1 -> 敵2 -> 自分2` でステップを作る。
4. 効果判定フェーズ: 上記ステップ順で4行動分のバフ、デバフ、状態異常、ガッツ、プレイヤー/敵側の即時HP回復、継続回復予約を先に処理する。凍結はこのフェーズの行動順で判定し、凍結後に発動する通常バフは発生しない。凍結前に発動済みのバフと戦闘開始時の追加バディ効果は残る。即時HP回復はこの時点で呪いが有効なら失敗する。
5. 攻撃フェーズ: 効果判定フェーズ後の状態を使い、同じステップ順で攻撃ダメージを解決する。
6. ターン内の全攻撃後にやけど、継続回復などのターン終了処理を解決する。ただし敵撃破または自HP0で戦闘終了したターンは、以後のターン終了処理へ進まない。
7. ターン単位の効果持続を 1 減らす。

1T 効果は「発動ターン中の該当攻撃に効く」。同カードの M1 ATK UP 1T と M2 を同ターンに選ぶと、順不同で M2 にも ATK UP が乗るという外部検証がある。この仕様を再現するなら、ターン内で選ばれた自己/味方バフを、そのターンの同一対象の攻撃計算に先行適用する。

### 対象範囲

Gamerch の効果分類に合わせる。

| 表記 | 意味 |
|---|---|
| 自 | 魔法を発動したカード |
| 相手 | その魔法と対応する攻撃対象。初手魔法なら敵初手、後手魔法なら敵後手 |
| 味方選択 | プレイヤー側では同ターンで選んだ味方カード。敵側では同ターンで同時選択された敵行動スロット。重複は1対象にまとめる |
| 相手選択 | そのターンに同時選択された相手側2枠。プレイヤー側効果なら敵初手/敵後手、敵側効果なら自分初手/自分後手。重複は1対象にまとめる |
| 味方全体 | プレイヤー側では自軍5カード全体。敵側では入力されている敵スロット全体 |
| 相手全体 | プレイヤー側では入力されている敵スロット全体。敵側では自軍5カード全体。選択されていないカード/敵スロットも含む |

`味方選択` は、プレイヤー側効果では同ターンで選んだ2つの味方魔法のカードを、敵側効果では同ターンに選ばれた2つの敵行動スロットを、重複なしで対象にする。`相手` は初手同士、後手同士の対応関係で決まる1対象。`相手選択` は同ターンに選択された相手側2枠で、`相手全体` はそのターンに選択されていない相手も含めた全対象。現試験ツールは敵 HP を個別スロット HP ではなく合算 HP として扱うため、敵側対象は敵行動スロット単位の状態として解決する。ターゲット不可や個別の戦闘不能状態は存在しない。

敵からプレイヤーへ付与される暗闇、呪い、凍結、ダメージ DOWN、やけどは、対応する初手/後手で攻撃されたカードを対象にする。対象カードが後で攻撃または回復した時だけ判定し、別カードの魔法には波及しない。範囲が `味方全体` または `相手全体` の効果として入力される場合は、全対象へ同じ状態を個別に付与する。

## 14. 状態異常と特殊効果

既存の単発計算画面では、状態異常の多くは「試験スコア用の個数カウント」または検索フィルタとして扱う。試験シミュレーターでは、本文で確定している暗闇、回避、呪い、凍結、デバフ解除、バフ解除、ガッツ、やけどをターン進行上の戦闘効果として解決する。

### 呪い

- HP 回復と HP 継続回復を無効化する。
- 呪い無効が有効な対象には付与されない、または効果を発揮しない。
- 呪い(中) の成功率は `44.6%`。
- 呪い(極大) の成功率は `100%`。
- その他の強度は暫定推定値を使い、実測値が判明したら差し替える。
- プロジェクトでは ATTACK 試験の回復阻害として最大 1 回カウントする。

呪い成功率の推定表:

| 強度 | 成功率 | 出典 |
|---|---:|---|
| 極小 | 22.3% | 暫定推定 |
| 小 | 33.4% | 暫定推定 |
| 中 | 44.6% | user-verified |
| 大 | 66.9% | 暫定推定 |
| 極大 | 100.0% | user-verified |

### 暗闇

- 相手の攻撃が確率で失敗する。
- 暗闇中の MISS 率は `21.6%`。
- MISS 判定は魔法単位で行う。
- MISS 判定に入った場合、同じ魔法内の連撃はすべて MISS になる。
- 同ターン内に複数の暗闇効果が有効な場合、確率は加算する。
- 暗闇無効が有効な対象には無効。

### 回避

- 成功すると受けるダメージが 0。
- 成功率は、回避(極小) `9.2%`、回避(小) `14.8%`、回避(中) `23.7%`。
- 回避(大) と回避(極大) は、極小/小/中の変化割合を幾何進行として推定する。
- 判定単位はヒット単位。同じ魔法の連撃でも、片方だけ外して片方だけ当たることがある。
- 複数の回避バフが有効な場合、確率は加算する。
- DEFENCE 試験スコアでは、回避の成功/失敗ではなく回避バフの発動数として数える。
- プレイヤー側の回避は、敵攻撃の被弾対象になったカードに紐づく有効な回避バフだけを参照する。敵側の回避でプレイヤー攻撃が外れた場合は、プレイヤーの DEFENCE 回避発動数には数えない。

回避成功率の推定表:

| 強度 | 成功率 | 出典 |
|---|---:|---|
| 極小 | 9.2% | user-verified |
| 小 | 14.8% | user-verified |
| 中 | 23.7% | user-verified |
| 大 | 38.0% | 暫定推定 |
| 極大 | 61.0% | 暫定推定 |

### 凍結

- 凍結は、凍結後に発動した新規バフを発生させない。
- 凍結前に発動済みの既存バフは残る。
- 同じターン内でも、凍結前に発動したバフは有効、凍結後に発動したバフは無効。
- 凍結無効が有効な対象には無効。
- 既存の単発計算画面では凍結を戦闘解決しない。試験シミュレーターでは凍結付与時に成功判定を行い、有効中は凍結後に発動する味方バフを抑止する。

凍結成功率の推定表:

| 強度 | 成功率 | 出典 |
|---|---:|---|
| 極小 | 22.3% | 暫定推定 |
| 小 | 33.4% | 暫定推定 |
| 中 | 44.6% | 暫定推定 |
| 大 | 66.9% | 暫定推定 |
| 極大 | 100.0% | user-verified |

### デバフ解除

- 複数デバフがある場合、すべて解除する。
- デバフはすべて解除対象。
- 同じターン内では、デバフ解除より先に付与されたデバフは解除される。
- デバフ解除後に付与されたデバフは有効。
- 試験シミュレーターでは、解除対象カードに有効な暗闇、呪い、凍結、ダメージ DOWN、やけどをまとめて解除する。解除後に付与されたデバフは残る。

### バフ解除

- バフ解除は、解除対象カードに魔法によって付与された ATK UP、ダメージ UP、属性ダメージ UP、クリティカル、回避、被ダメージ DOWN、継続回復、状態異常無効を解除する。
- 戦闘開始時に付与された追加バディ効果はバフ解除の対象外。
- デバフ解除とは別効果として扱い、暗闇、呪い、凍結、やけど、ダメージ DOWN は解除しない。

### ガッツ

- ガッツが付与されている対象が HP 0 以下になるダメージを受けた場合、HP 1 で耐える。
- 複数ガッツが付与された場合、その回数分だけ耐える。
- 複数対象に付与される場合、対象の数だけ個別に付与され、その対象が攻撃されたときに発動する。
- やけどでは HP 0 以下にならないため、やけどでガッツは発動しない。
- 毒は存在しない。

### やけど

- やけどのダメージ割合は効果ごとに設定される。
- ダメージ基準は対象カード本体 HP の割合。バディ HP は含めない。
- 発動タイミングは、そのターンの全ダメージ計算が終わった後。
- 小数点以下は切り上げる。
- 継続ターンは効果ごとに異なる。
- やけどでは HP 0 以下にならない。

## 15. `etc` 効果パース

カードの複数効果は `etc` 文字列に保存される。プロジェクトは `src/utils/buffParser.ts` で次の形をパースする。

### 入力例

```txt
ATKUP(小)(自/1T)(M1), 火属性ダメージUP(中)(味方選択/1T)(M3)
```

### パース仕様

- `<br>` は `,` に正規化する。
- `(M1)`, `(M2)`, `(M3)` を抽出する。
- R/SR または M3 未解禁の場合、M3 効果は除外できる。
- `自/XT`, `相手/XT`, `相手全体/XT` から持続ターンを抽出する。
- 自分/味方対象の ATKUP、ダメージUP、属性ダメージUP、クリティカルを抽出する。
- 相手対象の `被ダメージUP` は、自分側の `ダメージUP` として扱う。
- 属性ダメージUP は文字列先頭の `火|水|木|無` から属性を抽出する。

### 現在の制限

- `ATKDOWN`, `ダメージDOWN`, `属性ダメージDOWN`, `被ダメージDOWN` は通常のプレイヤー与ダメージ用パーサーでは抽出しない。
- 回復は `magicNheal` から別処理で追加される。
- 暗闇、回避、呪い、凍結、デバフ解除などの戦闘効果はパースして戦闘解決する仕組みがない。

完全エミュレーターでは、`Effect` 型へ全効果を正規化する汎用パーサーが必要。

## 16. デッキ集計

### シミュレーター集計

`src/store/simulatorStore.ts` の `deckStats` は次を返す。

```ts
{
  totalHP: sum(card.hp),
  totalBuddyHP: sum(activeBuddyHpIncrease),
  totalHeal: sum(heal + continueHeal + buddyContinueHeal),
  totalDamage: {
    火: sum(selectedMagicDamageVsFire),
    水: sum(selectedMagicDamageVsWater),
    木: sum(selectedMagicDamageVsWood),
    無: sum(selectedMagicDamageVsNeutral),
    対全: sum(bestVsFireWaterWood)
  }
}
```

`getSafeDeckDamage(attribute)` は、各魔法の `magicNDamageDetails` から対象属性に対応する値を合計する。

### 対全

`src/utils/simulatorAttributes.ts` では、`対全` は火/水/木/無のうち最大ダメージを返す。BASIC/ATTACK の属性相性個数では、`対全` の場合、無属性以外は有利扱い、無属性は等倍扱いにしている。

### デッキ探索

`src/components/common.ts` の `calcDeckStatus` は、探索用に次の指標を返す。

| index | 指標 |
|---:|---|
| 0 | HP |
| 1 | EHP = HP + 回復 |
| 2 | 回避数 |
| 3 | HP バディ数 |
| 4 | 最小 HP バディ増加量 |
| 5 | バディ数 |
| 6 | HP バディなし数 |
| 7 | DUO 数 |
| 8 | バフ数 |
| 9 | デバフ数 |
| 10 | 無属性魔法数 |
| 11 | 火属性魔法数 |
| 12 | 水属性魔法数 |
| 13 | 木属性魔法数 |
| 14 | 参照ダメージ |
| 15 | 参照有利ダメージ |
| 16 | 対火ダメージ |
| 17 | 対水ダメージ |
| 18 | 対木ダメージ |
| 19 | 回復魔法数 |

探索では各カードの使用可能魔法から上位 2 ダメージを採用し、デッキ全体では `attackNum` 個の上位ダメージを合計する。

## 17. 試験スコア推定式

本プロジェクトの推定式であり、ゲーム内部式の公式値ではない。

### 難易度係数

| 難易度 | 係数 |
|---|---:|
| Easy | 0.8 |
| Normal | 1.0 |
| Hard | 1.2 |
| Extra | 1.5 |

### BASIC

`src/views/calcBASIC.vue`

```ts
turns = [0.144, 0.138, 0.132, 0.126, 0.12]
moveNum = advantage + equal + disadvantage
turnNum = floor((moveNum - 1) / 2)

damageScore = damage - moveNum * 4.5
duoScore = duo * 3000
advantageScore = advantage * 2000
equalScore = equal * 500
disadvantageScore = disadvantage * -1000

baseScore =
  damageScore +
  duoScore +
  advantageScore +
  equalScore +
  disadvantageScore

score = round(baseScore * difficulty * turns[turnNum])
```

入力:

- `damage`: 合計与ダメージ
- `duo`: デュオ数
- `advantage/equal/disadvantage`: 使用魔法の属性相性数

### DEFENCE

`src/views/calcDEF.vue`

```ts
turns = [0.8, 0.85, 0.9, 0.95, 1.0]

allyRemainHPScore = remainHP * 0.1275
allyTotalHPScore = totalHP * 0.0625
damageScore = damage * 0.05
advantageDamagedScore = advantageDamaged * 2 * 0.05208
disadvantageDamagedScore = -disadvantageDamaged / 1.5 * 0.05208
evasionScore = evasion * 600
debuffScore = debuff * 300

baseScore =
  allyRemainHPScore +
  allyTotalHPScore +
  damageScore +
  advantageDamagedScore +
  disadvantageDamagedScore +
  evasionScore +
  debuffScore

score = round(baseScore * difficulty * turns[finishTurn - 1])
```

入力:

- `totalHP`: HP + バディ HP + 回復量
- `remainHP`: 戦闘終了時の残 HP
- `damage`: 合計与ダメージ
- `evasion`: 回避発動数
- `debuff`: 自陣の魔法で発動した DEFENCE 加点対象デバフ数。ATKDOWN、ダメージDOWN、属性ダメージDOWN、被ダメージDOWN、属性被ダメージDOWNを効果1つにつき1回数える。相手選択/相手全体/味方全体で複数対象に付与されても加点は1回。敵側のデバフ、暗闇、呪い、凍結、やけど、バフ解除は加点対象外。
- `advantageDamaged/disadvantageDamaged`: 被弾時の属性有利/不利ダメージ

### ATTACK

`src/views/calcATK.vue`

```ts
damageScore = round(damage / 208)
buffScore = buff * 120
blockHealScore = blockHeal * 180

advantageComboScore = advantageCombo * 210
equalComboScore = equalCombo * 180
disadvantageComboScore = disadvantageCombo * 150

advantageSingleScore = advantageSingle * 150
equalSingleScore = equalSingle * 120
disadvantageSingleScore = disadvantageSingle * 90

basicScore = 11036 + enemyHP * 0.080471
moveMinusScore = 641.2 + enemyHP * 0.002048

baseScore =
  basicScore -
  moveMinusScore * totalActionCount +
  damageScore +
  buffScore +
  blockHealScore +
  advantageComboScore +
  equalComboScore +
  disadvantageComboScore +
  advantageSingleScore +
  equalSingleScore +
  disadvantageSingleScore

score = round(baseScore * difficulty)
```

入力:

- `enemyHP`: 敵 HP
- `damage`: 合計与ダメージ
- `buff`: 自陣の魔法で発動した加点対象バフ数。ATKUP、ダメージUP、属性ダメージUP、クリティカルを効果1つにつき1回数える。味方選択/味方全体で複数対象に付与されても加点は1回。敵側のバフ、回避、HP継続回復、追加バディ効果は加点対象外。
- `blockHeal`: 呪い等の回復阻害数。プロジェクトでは最大 1
- `combo/single`: 連撃/単発別の属性相性数

## 18. フィニッシャーダメージ

`src/views/finisherDamage.vue` は、SSR の M2 デュオをフィニッシャーとして最大火力を探す専用計算。

主な前提:

- SSR 以外はフィニッシャー計算対象外。
- M2 はデュオ魔法として固定使用する。
- M2 自己バフは必須。
- M1/M3 の自己バフは高い方だけ採用する。
- デュオ相手が持つ味方バフや、相手への被ダメージUPをフィニッシャーに乗せる。
- バディ ATK、バディダメージUP、属性バディダメージUPも乗せる。

計算の中核:

```ts
cosmicRatio = atr === '無' ? 1.1 : 1

atk =
  characterAtk *
  (1 + buddyBonus + mandatorySelfAtk + optionalSelfAtk + partnerAtkBuff)

damageRate =
  cosmicRatio +
  mandatorySelfDamage +
  mandatorySelfAttributeDamage +
  optionalSelfDamage +
  optionalSelfAttributeDamage +
  buddyDamageBonus +
  buddyAttributeDamageBuff +
  partnerDamageBuff

baseDamage = floor(atk * damageRate * 2.4)
```

その後、対火/対水/対木/対無の属性相性を掛ける。

注意:

- この画面の係数には `calculations.ts` と差異がある箇所がある。
- フィニッシャー専用の「最大値探索」なので、通常のターン進行再現とは別モードで実装する。

## 19. 完全エミュレーターの推奨アーキテクチャ

### 状態

```ts
type BattleState = {
  turn: number;
  phase: 'turn-start' | 'action' | 'turn-end' | 'finished';
  player: SideState;
  enemy: SideState;
  logs: BattleLog[];
  rng: Rng;
};

type SideState = {
  cards: RuntimeCard[];
  hp: number;
  maxHp: number;
  damageDealt: number;
  effects: ActiveEffect[];
};

type RuntimeCard = {
  card: Card;
  hpContribution: number;
  atk: number;
  activeEffects: ActiveEffect[];
  selectedMagicsThisBattle: number[];
};
```

### 1 ターンの処理

```ts
function resolveTurn(state, playerSelection, enemySelection) {
  const actions = buildActionOrder(state.turn, playerSelection, enemySelection);

  registerTurnScopedPreAttackEffects(actions);

  for (const action of actions) {
    if (isBattleFinished(state)) break;

    applyPreActionEffects(state, action);
    resolveDebuffRemoval(state, action);
    resolveBuffPreventionByFreeze(state, action);

    const hitResult = resolveHitCheck(state, action); // 暗闇/回避
    if (hitResult.hit) {
      const damage = calculateActionDamage(state, action);
      applyDamage(state, action.targetSide, damage);
    }

    const heal = calculateActionHeal(state, action);
    applyHealUnlessCursed(state, action.sourceSide, heal);

    applyPostActionEffects(state, action);
    pushBattleLog(state, action);
  }

  tickTurnDurations(state);
  checkVictory(state);
}
```

### ダメージ計算 API

```ts
type DamageContext = {
  source: RuntimeCard;
  magic: Magic;
  targetElement: Element;
  turnEffects: ActiveEffect[];
  isDuo: boolean;
  rounding: 'project-simulator' | 'project-search' | 'ceil';
  rngMode: 'none' | 'expected' | 'uniform';
};

function calculateDamage(ctx: DamageContext): number;
```

### 効果解決 API

```ts
function collectActiveAtkRates(ctx): number;
function collectActiveDamageRates(ctx): number;
function collectCriticalMultiplier(ctx): number;
function collectBuddyRates(card, deck): BuddyRates;
function canApplyBuff(target, effect, state): boolean;
function isCursed(target, state): boolean;
function isDebuffImmune(target, debuffKind, state): boolean;
```

## 20. 実装時の注意点

### 現プロジェクト互換にする場合

- `calculations.ts` の係数を優先する。
- ダメージ乱数は入れない。
- 選択魔法ごとにダメージ詳細を `Math.round` する。
- 継続回復は 3 ターン分を一括加算する。
- 呪い、暗闇、回避、凍結、デバフ解除は戦闘効果としては解決しない。試験スコア指標として数える。

### 実ゲーム再現を目指す場合

- 敵データをカードと同じ `Card/Magic/Effect` モデルに正規化する。
- 1T 効果を「ターン内で先に予約して、そのターンの該当攻撃へ乗せる」方式で扱う。
- 暗闇/回避/呪い/凍結/デバフ解除/バフ解除は、ユーザー提供仕様に従って戦闘効果として実装する。
- ダメージ乱数は `0.95..1.05` の一様分布、丸めは小数点以下切り上げで実装する。
- DUO は `M2 Lv >= 5`、同ターン選択、デュオ相手キャラ存在の全条件で判定する。
- オーバーキルは試験スコアに加算する。Gamerch でも、連撃中に敵 HP が 0 になった後のダメージも合計与ダメージへ加算されるとされる。

### 差異を出典で管理する

現状、プロジェクト内でも一部係数に差異がある。ユーザー提供仕様をエミュレーター標準とし、既存画面との互換が必要な場合だけプロジェクト実装値を ruleset で再現する。

```ts
type Ruleset = {
  source: 'user-verified' | 'project-simulator' | 'project-search';
  damageUpExtremeRateLv10: 0.225 | 0.1875;
  atkUpExtremeRateLv10: 0.80 | 0.90;
  rounding: 'ceil' | 'round-per-magic' | 'floor-final';
  damageRandom: 'uniform-0.95-1.05' | 'none';
  resolveStatuses: boolean;
};
```

## 21. 追加で必要なデータ

このプロジェクトの現在の実装だけでは、敵を含む完全なターン進行は再現できない。エミュレーター化では、以下のデータを仕様書側の入力データとして整備する。

### 必須マスター

| データ | 主な項目 | 用途 |
| --- | --- | --- |
| カードマスター | `cardId`, `characterId`, レアリティ, タイプ, 最大HP/ATK, 最大Lv, M3有無, グルーヴィー有無 | プレイヤー側カードの基礎ステータス計算 |
| 魔法マスター | `cardId`, M1/M2/M3, 属性, 威力区分, ヒット数, 対象, 解放条件, DUO相手, 効果原文 | 攻撃、回復、バフ/デバフ解決 |
| 効果マスター | 効果種別, 強度, 対象, 対象範囲, 継続ターン, 成功率, 発動タイミング, 原文 | `etc` 文字列を戦闘処理へ正規化 |
| バディマスター | カード, バディ相手, HP/ATK効果, 追加バディ効果, 限界突破条件 | デッキ単位のHP/ATK/追加効果計算 |
| 育成状態 | カードLv, 魔法Lv, バディLv, 限界突破数, グルーヴィー | 所持カードごとの実ステータス |
| 敵マスター | 敵ID, HP, ATK, 敵魔法, 属性, 効果, 耐性 | 敵側行動と被ダメージ計算 |
| バトル定義 | バトルID, 種別, 難易度, ターン上限, 勝敗条件, 敵スロット, 特殊ルール | 1バトルの初期状態 |
| 敵行動パターン | 固定/重み付き/条件付き, ターン, 敵スロット, 敵魔法, 条件 | 敵の行動選択 |
| ターゲット規則 | 明示対象, 全体, 自動選択, 同値優先 | 複数敵/複数味方の対象決定 |

### 敵行動入力と抽選

敵の火力、攻撃回数、バフ、HP はバトルごとに都度入力する。各行動は条件に反しない限り独立してランダムに選択される。

5T バトルでは敵行動を合計 10 回分用意する。敵キャラ数と保持パターン数に応じて、10 回分の候補を次のように作る。

| 敵構成 | 10回分の作り方 |
| --- | --- |
| 3キャラで各3パターン | 9種類をすべて1回ずつ採用し、どれか1種類を追加で1回採用する。選択順はランダムで、最初に同じ行動が2回続くこともある。 |
| 3キャラで `3,3,4` の計10パターン | 10種類をそれぞれ1回ずつ採用する。 |
| 4キャラ以上 | 各キャラが最低1回は保持パターンのどれかを使う。残りは合計10回になるまで、未使用行動から選ぶ。 |
| 2キャラ | 各キャラが保持しているパターンをすべて採用する。合計10回に満たない分は重複して選ぶ。 |

全パターンで、同じ行動が3回以上選ばれることはない。ただし ATK 試験の 10T では、その組み合わせを後半の 6T 目以降でも採用するため、戦闘全体を通して同じ行動が4回行われることはあり得る。

### 検証用データ

| データ | 主な項目 | 用途 |
| --- | --- | --- |
| ダメージ観測ログ | 攻撃者, 対象, 魔法, 属性, バフ, 表示ダメージ, ヒット別表示, スクリーンショット | 乱数、丸め、係数差異の検証 |
| 状態異常観測ログ | 効果種別, Lv, 強度, 試行回数, 成功回数, 対象, 条件 | 暗闇/回避/呪いなどの成功率検証 |
| バトルログ | 編成, ターン選択, 敵行動, ダメージ, 回復, 状態変化, 終了HP, スコア | ターン進行エンジンの再現性確認 |
| 出典メタ情報 | 公式/攻略/実測/プロジェクトコード, URL, 確認日, 確度 | データの信頼度管理 |

### 型の最小形

```ts
type CardMaster = {
  cardId: string;
  characterId: string;
  rarity: 'R' | 'SR' | 'SSR';
  type: string;
  maxHp: number;
  maxAtk: number;
  maxLevel: number;
  hasM3: boolean;
};

type MagicMaster = {
  cardId: string;
  slot: 'M1' | 'M2' | 'M3';
  element: Element;
  powerLabel: string;
  hitCount: 1 | 2 | 3;
  target: string;
  duoPartnerCharacterId?: string;
  effects: Effect[];
  rawText?: string;
};

type EnemyMaster = {
  enemyId: string;
  displayName: string;
  hp: number;
  atk: number;
  magics: EnemyMagic[];
  resistances?: StatusResistance[];
};

type BattleDefinition = {
  battleId: string;
  category: 'story' | 'event' | 'exam' | 'other';
  turnLimit: number;
  winCondition: string;
  enemySlots: Array<{ slotIndex: number; enemyId: string; initialHp: number }>;
  enemyActionPattern: EnemyActionPattern;
};
```

### 最小実装に必要なデータセット

最初のエミュレーターを動かすだけなら、次の範囲に絞れる。

- プレイヤー側カード 5 枚分のカード/魔法/バディ/育成状態。
- 敵 1 体分の HP/ATK と敵魔法 2 種。
- 5 ターン分の固定敵行動。
- ATK UP、ダメージ UP、属性ダメージ UP、回復だけの効果マスター。
- プロジェクト互換なら乱数なし固定ダメージモード。実ゲーム再現なら `0.95..1.05` 一様乱数と小数点以下切り上げ。
- 勝利条件は敵 HP 0、敗北条件はプレイヤー HP 0 またはターン終了。

暗闇、回避、呪い、凍結、解除系、ガッツは本文の確定仕様の範囲で実装する。やけどは効果ごとの割合/継続ターンを実行時入力し、複数敵とランダム敵行動はバトル定義として都度入力する。試験シミュレーターのスコアは既存の BASIC/DEFENCE/ATTACK 推定式を利用し、公式内部式との差分が判明した場合は推定式として差し替える。

### 引き続きデータまたは実測が必要なもの

- 敵 HP/ATK の一覧。
- 敵魔法の属性、威力区分、ヒット数、対象、追加効果。
- バトルごとの敵行動パターン。
- 敵の属性ヒントと実際の魔法対応。
- 複数敵/複数味方のターゲット規則。
- 試験ごとの敵総 HP、難易度、スコア対象イベント。
- 推定効果値を上書きしたい場合の実測値。
- 各やけど効果ごとのダメージ割合と継続ターン。
- 各バトルで都度変わる敵HP、敵火力、攻撃回数、バフ、行動パターン。

## 22. 調査後の確定/未確定項目

追加調査の結果は `docs/twst-battle-unknowns-resolution.md` に分離した。ここでは実装時に参照する要点だけを置く。

| 項目 | 確定仕様 | 不明として残すこと |
| --- | --- | --- |
| ダメージ乱数 | `0.95..1.05` の一様分布。 | なし。 |
| ダメージ丸め | 小数点以下切り上げ。 | なし。 |
| 暗闇 | MISS 率 `21.6%`、魔法単位、同魔法内連撃は全MISS、同ターン確率加算。 | 強度/Lv差が別途存在する場合は推定または入力で上書き。 |
| 回避 | 極小 `9.2%`、小 `14.8%`、中 `23.7%`。大 `38.0%`、極大 `61.0%` は暫定推定。ヒット単位、複数回避バフは確率加算。 | なし。推定値は実測で上書き可。 |
| クリティカル | 極小 `10.0%` は暫定推定。小 `19.1%`、中 `33.3%`、大 `50.0%`、極大 `100.0%`。ヒット単位。発動時は該当ヒットだけ `1.25` 倍。 | なし。推定値は実測で上書き可。 |
| 呪い | 中 `44.6%`、極大 `100%`。極小 `22.3%`、小 `33.4%`、大 `66.9%` は暫定推定。 | なし。推定値は実測で上書き可。 |
| 凍結 | 極大 `100%`。極小 `22.3%`、小 `33.4%`、中 `44.6%`、大 `66.9%` は暫定推定。既存バフは残る。凍結後に発動したバフは無効、凍結前なら有効。 | 指定されていない特殊効果との相互作用。 |
| デバフ解除 | 複数デバフは全解除。全デバフ対象。同ターンでは先に付与されたデバフだけ解除。 | なし。 |
| バフ解除 | 魔法で付与された対象のバフ、継続回復、状態異常無効を解除。追加バディ効果とデバフは解除しない。 | なし。 |
| ガッツ | 複数付与時は回数分耐える。やけどではHP0以下にならないため発動しない。 | 指定されていない特殊勝敗処理。 |
| やけど | 割合は効果ごとに都度設定。対象カード本体HP基準。バディHPは含めない。ターン内全ダメージ計算後に発動。小数切り上げ。継続ターンも都度設定。 | なし。値は実行時入力。 |
| 複数対象 | そのターンに同時選択されたキャラが対象。ターゲット不可/個別戦闘不能は存在しない。 | なし。 |
| 敵行動 | 敵数/行動パターン数に応じた10回分の抽選規則を使用。各行動は条件に反しない限り独立ランダム。 | なし。各バトル内容は実行時入力。 |
| 係数差異 | ATKUP極大 `80%`、Lv1-9 は既存カーブを正規化して推定。ダメージUP極大 `22.5%`、回復&継続回復(中)は存在しない。 | なし。推定値は実測で上書き可。 |

効果値の不足分は既存値の変化割合から推定する。やけど値と各バトル内容は仕様不明ではなく実行時入力として扱う。

### 敵火力入力と ATK 逆算

試験シミュレーターの敵行動は、敵 ATK を直接入力しない。ユーザーが入力するのは次の値。

- 属性。試験全体の敵属性が `火/水/木/無` のいずれかに固定されている場合、敵行動の属性もその属性に固定する。試験全体の敵属性が `全` の場合だけ、行動ごとに `火/水/木/無` から選択できる。
- 威力区分: `単発(弱)`, `単発(強)`, `2連撃(弱)`, `2連撃(強)`, `3連撃(弱)`, `3連撃(強)`。
- 等倍火力: その行動に表示されている、観測時バフ込みの総ダメージ。
- 追加効果、効果値、継続ターン。継続ターンは `1..5` から選ぶ。
- 範囲: `自`, `相手`, `味方選択`, `相手選択`, `味方全体`, `相手全体`。

逆算は、既存の味方側ダメージ式と同じ係数系を使う。

```ts
observedDamage =
  enemyAtk
  * (1 + observedAtkBuffFromEffectValue / 100)
  * (magicRatio * neutralAttributeAdjust + observedDamageBuffFromEffectValue / 100)
  * hitMultiplier

enemyAtk = observedDamage / denominator
```

`magicRatio` は Lv10 相当の魔法倍率、`neutralAttributeAdjust` は無属性のみ `1.1`、それ以外は `1.0`。`hitMultiplier` は単発 `1.0`、2連撃 `1.8`、3連撃 `2.4`。

観測時バフ率は個別入力しない。敵行動の効果が `ATKUP` で範囲が敵側 (`自`, `味方選択`, `味方全体`) の場合、その効果値を `observedAtkBuffFromEffectValue` として使う。敵行動の効果が `ダメージUP` で範囲が敵側の場合、その効果値を `observedDamageBuffFromEffectValue` として使う。効果がない、または範囲がプレイヤー側の場合は `0` とする。

戦闘中の敵ダメージは、逆算した `enemyAtk` を基準に、現在有効な敵 ATK UP、敵ダメージ UP、プレイヤーから付与された ATK DOWN、ダメージ DOWN、属性ダメージ DOWN、受け属性相性、乱数 `0.95..1.05` を再適用して計算する。

```ts
actualEqualDamage =
  enemyAtk
  * max(0, 1 + (activeAtkUp - activeAtkDown) / 100)
  * max(0, magicRatio * neutralAttributeAdjust + (activeDamageUp - activeDamageDown) / 100)
  * hitMultiplier

actualDamage = ceil(perHitDamage * receivingAttributeMultiplier * random(0.95, 1.05)) を hit 数分合計
```

これにより、画像の `ATKup(約32%/1T) 強2連 約11950` のような行は、`威力=2連撃(強)`, `等倍火力=11950`, `範囲=自`, `効果=ATKUP`, `値=32`, `T=1` だけで基礎 ATK を逆算できる。

## 23. 試験画像入力シミュレーションツール仕様

### 目的

試験内容を構造化入力し、選択したデッキとターンごとの許容組み合わせで指定回数シミュレーションする。結果はスコア分布をヒストグラムと累積割合の折れ線で表示する。

このツールでは画像OCRを行わない。`siken` フォルダ内の画像は開発時の情報提供サンプルであり、ツール画面には表示しない。試験内容はユーザーが手入力する。

### 確認した画像形式

`siken/通常試験` の画像には、次のような情報が含まれる。

| 種類 | 例 | 入力項目 |
| --- | --- | --- |
| 試験ヘッダ | `1月後期試験`, `2月前期試験` | 試験名、開催メモ |
| 属性/種別 | `木DF`, `水DF`, `無BS`, `全ATK` | 試験属性、試験タイプ |
| HP/回復 | `相手HP95000/回復なし`, `相手HP89000/回復3177(最大2回)` | 敵HP、回復量、最大回復回数、最大敵HP |
| 火力メモ | `有利受け平均火力 5833`, `相手等倍火力` | 被ダメージ推定用メモ |
| 敵キャラ | `アズール`, `ジャミル`, `デュース`, `ジャック`, `エース` など | 敵スロット/敵名 |
| 行動候補 | `火 ダメup強単発`, `水 被ダメダウン(約22.5%/1T) 強2連`, `強2連 約11600` | 属性、効果、威力、連撃数、概算ダメージ |
| 手札/構成メモ | `火2水3木3無2 相手手札固定` | 敵行動候補の構成、固定/ランダム条件 |

### 画面構成

新規画面 `ExamSimulator` を追加する。

- ルート: `/twst/exam-simulator`
- ナビ表示名: `試験シミュレーター`
- 実装候補: `src/views/examSimulator.vue`
- 共通ロジック候補:
  - `src/utils/examSimulation/types.ts`
  - `src/utils/examSimulation/enemyPattern.ts`
  - `src/utils/examSimulation/simulator.ts`
  - `src/utils/examSimulation/scoring.ts`

画面は次の5領域に分ける。

1. 試験内容入力フォーム。
2. 敵行動入力フォーム。
3. デッキ編成。
4. ターンごとの許容組み合わせ設定。
5. シミュレーション結果グラフと最高スコアログ。

### 試験定義データ

```ts
type ExamKind = 'BASIC' | 'DEFENCE' | 'ATTACK';
type ExamTheme = '火' | '水' | '木' | '無' | '全';

type ExamDefinition = {
  id: string;
  title: string;
  imageUrl?: string;
  sourceImagePath?: string;
  kind: ExamKind;
  theme: ExamTheme;
  enemyHp: number;
  enemyMaxHp?: number;
  heal?: {
    amount: number;
    maxCount: number;
  };
  notes: string;
  enemySlots: EnemySlotDefinition[];
  enemyActionPolicy: EnemyActionPolicy;
};

type EnemySlotDefinition = {
  slotId: string;
  name: string;
  actions: EnemyActionDefinition[];
};

type EnemyActionDefinition = {
  id: string;
  enemySlotId: string;
  element: Element;
  power: '弱単発' | '強単発' | '弱2連' | '強2連' | '強3連' | string;
  hitCount: 1 | 2 | 3;
  estimatedDamage?: number;
  effects: Effect[];
  condition?: string;
  rawText: string;
};
```

### 手入力する試験項目

ユーザーのメモを見ながら手入力または選択入力する。

- 試験名。
- 試験タイプ: BASIC/DEFENCE/ATTACK。
- 試験属性: 火/水/木/無/全。
- 敵HP。
- 回復量と最大回数。
- 最大敵HP。
- 敵キャラ名。
- 各敵キャラの行動候補。
- 各行動の属性。
- 威力/連撃数。
- 効果種別と効果量。
- 概算ダメージ。
- 条件メモ。

敵行動にはメモ欄を持たせる。原文メモは保存するが、属性、効果、連撃数、概算ダメージはユーザーが構造化欄へ入力する。

### 敵行動抽選

敵行動は、ユーザー提供仕様の抽選規則を使う。

```ts
type EnemyActionPolicy = {
  turnCount: 5 | 10;
  actionCount: 10;
  mode: 'twst-exam-pattern';
  allowDuplicateAtMostPerHalf: 2;
  allowDuplicateAcrossAtkSecondHalf: true;
};
```

BS/BASIC と DF/DEFENCE は `turnCount: 5`、ATK/ATTACK は `turnCount: 10` とする。5Tでは敵行動10回分を生成する。2キャラ、3キャラ、4キャラ以上の候補数ごとの作り方は前節の敵行動仕様に従う。ATK試験10Tでは、前半5Tの10行動構築と同じ組み合わせを後半6T目以降にも採用しうるため、戦闘全体で同一行動が4回出ることを許容する。

敵 HP、敵火力、攻撃回数、バフ、行動候補は試験ごとに固定マスターから推測せず、ユーザーが都度入力する。

### デッキ編成

デッキは既存カードデータから5枚をアイコン選択する。カード選択UIは既存シミュレーターの `SimCharaModal` をそのまま使用し、フィルター/ソート/手持ち切替の操作感を揃える。

入力項目:

- カード。
- レベル。
- 使用するマジック2つ。M1/M2/M3 はアイコン上で判別できる表示にする。

レベル以外のステータス入力は置かない。魔法レベル、効果レベル、バディレベルは最大値として扱い、限界突破/グルーヴィー/M3解禁に必要な内部値はカードデータと最大条件から自動計算する。

既存の `characterStore`、カード画像ローダー、`calculateCharacterStats`、`parseMagicBuffsFromEtc`、回復テーブル、ダメージ計算ロジックを再利用する。新規エミュレーターでは `user-verified` ruleset を標準とする。

### ターンごとの許容組み合わせ

ユーザーは各ターンで許容するプレイヤー側2手の組み合わせを選択する。許容組み合わせは「2枚1セット」で、使用マジックのアイコンをドラッグ&ドロップして決める。優先度は表示順の上から下とし、同じターンで複数候補が手札に存在する場合は最上位の候補を採用する。

```ts
type TurnAllowedPlan = {
  turn: number;
  allowedPairs: PlayerActionPair[];
};

type PlayerActionPair = {
  first: PlayerMagicSelection;
  second: PlayerMagicSelection;
  duoMode?: 'none' | 'first-duo' | 'second-duo' | 'both-duo';
  label: string;
};

type PlayerMagicSelection = {
  cardId: string;
  magicSlot: 'M1' | 'M2' | 'M3';
};
```

複数DUO条件がある場合は、ツールが勝手に最適化しない。DUO は同じターンのもう片方が DUO 相手キャラである場合のみ有効とし、ユーザーがターンごとの許容組み合わせを最初に選択する。エミュレーター側では追加の DUO 制限を置かず、その条件で指定回数シミュレーションする。

### プレイヤー手札抽選

プレイヤーは5枚デッキで選択済みの魔法10個を1サイクルとして扱う。

1. 1T目開始時に10マジックからランダムに5つが見える。
2. 各ターン、見えているマジックの中から2つを選択し、選択順に先手/後手として行動する。
3. 選択した2マジックは消化される。
4. 消化後、隠れている未表示マジックから補充して手札を最大5つに戻す。
5. 4T目以降は未表示マジックが少なくなり、残りの出現内容が確定していく。許容組み合わせが可能かどうかは、見えている手札と残り手札で確定する。
6. 10T試験で5T終了時に全マジックを消化した場合は、6T目開始時に次サイクルを再抽選する。

各ターンでは、見えている手札に含まれる許容組み合わせのうち、優先度が最も高い2枚セットを採用する。該当候補がない場合、許容外選択を行わず、その試行はリタイアとして終了する。リタイア試行のスコアは `0` として分布に含める。

### シミュレーション入力

```ts
type SimulationRequest = {
  exam: ExamDefinition;
  deck: OwnedCardState[];
  turnPlans: TurnAllowedPlan[];
  iterations: number;
  seed: number; // -1 は毎回ランダム、それ以外は固定seed
  ruleset: 'user-verified' | 'project-compatible';
};
```

`iterations` は任意数入力とする。seed の初期値は `-1`。`-1` の場合は実行ごとにランダム、`0` 以上の値では同じ試行番号に対して再現可能な乱数列を使う。目標スコア入力は置かない。

### シミュレーション処理

1回の試行では次を行う。

1. 試験定義から敵HP、敵行動候補、回復設定を初期化する。
2. 敵行動10回分を抽選する。
3. 1T目の手札5枚を抽選し、以後は選択済みマジックを消化して未表示マジックを補充する。
4. 各ターンで、見えている手札に含まれる許容組み合わせを上から順に評価し、最初に成立した2枚セットを選ぶ。
5. 成立する許容組み合わせがない場合はリタイアし、スコア `0` として記録する。
6. 初手同士、後手同士で行動順を組む。
7. 行動順で4行動分のバフ/デバフ/状態異常/ガッツ/プレイヤーと敵側の即時HP回復/継続回復予約を先に判定し、その後に同じ行動順で攻撃ダメージを解決する。
8. ダメージ乱数は `0.95..1.05` 一様分布、丸めは小数点以下切り上げ。
9. 敵火力には、プレイヤーが同フェーズで選択したマジック属性に対する受け属性補正を常に掛ける。オン/オフ選択肢は置かない。
10. 各行動後に敵 HP と味方総 HP を確認し、どちらかが `0` になった時点で試行を終了する。
11. 味方総 HP が `0` になった場合はリタイア扱いとし、スコア `0` として記録する。
12. 敵 HP が `0` になった場合、または BS/DF は5T、ATK は10Tの上限に到達した場合は、リタイアしなかった試行として試験タイプ別のスコア式でスコアを計算する。
13. 最高スコア試行について、自分の行動、相手の行動、与ダメージ、被ダメージ、回復、残HPを含む詳細ログを保存する。

### スコア計算

初期実装では既存の `calcBASIC.vue`、`calcDEF.vue`、`calcATK.vue` のスコア式をモジュール化して再利用する。

- BASIC: 与ダメージ、DUO回数、属性選択、終了ターンを使う。
- DEFENCE: 残HP、最大HP、被弾属性、回避、デバフ等を使う。
- ATTACK: ダメージ、バフ、回復阻害、コンボ/単発の属性評価、敵HPを使う。

既存画面の推定式は公式内部式ではないため、結果画面には「プロジェクト推定式」と明記する。

### ヒストグラム

Chart.js を使用する。既に依存関係に `chart.js` と `vue-chartjs` があるため追加依存は不要。

表示するもの:

- スコアヒストグラム。
- 累積割合の折れ線グラフ。
- 試行回数。
- 平均、中央値、最小、最大。
- 上位5%、下位5%。
- リタイア率。
- 許容組み合わせ不成立の平均回数。
- 最高スコア試行の詳細ログ。

```ts
type SimulationSummary = {
  iterations: number;
  min: number;
  max: number;
  mean: number;
  median: number;
  p05: number;
  p95: number;
  fallbackAverage: number;
  retiredCount: number;
  retiredRate: number;
  histogramBins: Array<{ from: number; to: number; count: number }>;
  cumulativePercentage: Array<{ scoreTo: number; percentage: number }>;
  bestRun: SimulationRun;
};
```

### 実装できる範囲

この仕様で実装できる。

- 試験内容の構造化入力。
- デッキ編成。
- ターンごとの許容組み合わせ選択。
- 指定回数シミュレーション。
- スコア分布ヒストグラム。
- 累積割合の折れ線グラフ。
- 最高スコア詳細ログ表示。

初期実装でやらないこと:

- 画像からの自動抽出。
- 動画からの自動仕様抽出。
- 公式内部スコア式の断定。

## 24. 最小実装チェックリスト

1. カードデータを `Card/Magic/Buddy/Effect` に正規化する。
2. `calculateStatFromLevel` を移植する。
3. バディ発動判定と HP/ATK/追加ダメージ効果を実装する。
4. 魔法倍率、無属性 1.1、連撃 1/1.8/2.4、属性相性を実装する。
5. ATK 系、ダメージ系、属性ダメージ系、クリティカルを実装する。
6. 回復と継続回復を実装する。
7. DUO 判定を実戦用条件で実装する。
8. ターン順ステートマシンを作る。
9. 状態異常をオプション機能として順に実装する。
10. BASIC/DEFENCE/ATTACK のスコア式を別モジュールに切り出す。
11. `user-verified`、`project-simulator`、`project-search` の ruleset を分ける。
12. 試験画像入力シミュレーターを `ExamSimulator` として追加する。
13. 既存プロジェクトの代表カードで、現シミュレーター出力と一致する単体テストを作る。
