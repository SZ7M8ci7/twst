# NRC19 expected-best search — confirmation report

**Status: confirmation in progress; not adopted or published.**

The user authorized prioritizing the expected maximum of 30 attempts. Production source is frozen at SHA-256 `23245ff6b603b8ab69ba8426db50decf9acc34f888f334e14e81990d6301d80b` (last production commit `fa93af17`). Baseline is `8d68abb678ab3c74d6de4a9d793749cb93f9ab60`; branch `codex/nrc19-expected-best`. No push, merge or deployment was performed.

## Change and fixed comparison

Automatic development quality, finalist selection/retention and result ranking use the expected best of the configured ordinary attempts. Failures count as zero; weighted/scout trials never enter this expectation. The table adds this value alongside maximum and P95. Exact expected-score ties prefer lower cost; per-cost representatives and training alternatives remain. Peak/weighted/scout refinement parent paths are preserved. Explicit target-score mode retains its previous objective. Engine version140 prevents resuming incompatible old search statistics. Candidate generation and combat rules remain baseline-identical.

Five profiles × 37 subjects =185 pairs: set1 owned355 with budgets3/0, provided361, historical all-owned518 and sparse24. Only the two original profiles use the supplied November13 set1. Other profiles retain their original required characters and budget0. All challenges ON; historical518 support identities. Each added limit break raises level5, including multi-card allocations; independent additional-level budget0. Four concurrent slots, fresh process per pair, counterbalanced side order, 30seconds per version.

Select the top three distinct finalist compositions using each version’s production score ordering BEFORE fresh candidate-specific1024 ordinary trials. The main metric is the score-rank1 empirical E(max30); audited top3 best is auxiliary only. The baseline benchmark uses its score comparator across cost bands, as in the prior procedure; this is not a comparison against the first row of its former cost-first UI. One SearchSession is measured, not browser-wide island throughput.

Adoption weights were fixed before experiments:70% current25 mean +30% historical160 mean, equal profiles/subjects within each cohort. Normalization divides each change by that subject’s maximum baseline expectation across profiles. Six historical subjects are development; the other26 are confirmation. No confirmation score was used to retune this frozen source.

## Complete 30-second primary result

| Cohort | Conditions | E(max30) mean change | Improved / declined / tied |
|---|---:|---:|---:|
| NRC19 | 25 | +1705.580 | 16 / 8 / 1 |
| Historical | 160 | +237.327 | 82 / 51 / 27 |
| Historical normal22 | 110 | +228.262 | 58 / 31 / 21 |
| Historical unified10 | 50 | +257.270 | 24 / 20 / 6 |
| Historical tuning6 | 30 | +536.308 | 16 / 10 / 4 |
| Historical confirmation26 | 130 | +168.332 | 66 / 41 / 23 |

Fixed weighted change **+1265.104 points**; normalized **+2.7271%**. No primary individual regression exceeded5%. Ties use ±1point.

| NRC19 subject | Mean E(max30) change, five profiles |
|---|---:|
| 第19回統一火BS | -33.266 |
| 第19回統一水BS | -108.823 |
| 第19回統一木DF | +29.828 |
| 第19回統一無DF | +209.997 |
| 第19回統一全ATK | +8430.163 |

| Current profile | Mean E(max30) change, five subjects |
|---|---:|
| original | +1886.314 |
| original-zero | +454.267 |
| provided | +204.846 |
| all-owned | +515.343 |
| sparse | +5467.129 |

All1094 audited candidates (1,120,256 ordinary trials) passed legal-input constraints and seed/explicit-plan maximum replays. All110 common-candidate audits matched exactly. The aborted reused-process primary’s39 pairs are excluded entirely; the complete185-pair isolated run was restarted with a fresh nonce. Its production source and inputs did not change.

## Confirmation still required

The23-case180-second plan covers both set1 budgets×current5, zero×historical tuning6, original NRC17allDF/NRC18waterATK, the three other profiles’ currentwoodDF, and the largest primary current/historical gains (sparse currentallATK and April waterATK). Current535-support supplementation covers both set1 budgets×current5 at BOTH30/180seconds and is reported separately.

## Checks and limitations

On the locked production source: unit suite357pass/0fail/1skip (an unrelated supplied-screenshot test), vue-tsc and production build pass. Stop, file save, new-host resume, preserved nonce/trial position, continued validation and maximum replay pass. Chromium could not start because socket creation returned EPERM; browser storage and visual layout were not verified. Build retains the existing large-chunk warning.

All five NRC19 subjects and30 challenges already existed in baseline. FireBS star3 enemyfireUP matches the game screenshot; the wiki’s neutral label is a typo. NeutralDF star1 target disagreement and existing waterBS blind/wood-down estimated magnitudes remain unresolved. Both versions use identical data; no new game-accuracy claim is made.

This is a wall-clock search comparison with finite independent audits and one fresh nonce per planned run, not a confidence interval or guarantee of improvement for every search. Current subjects are development targets. Earlier observation-speed, directed-spell and burn-aware proposals remain rejected/unadopted in their separate reports.
