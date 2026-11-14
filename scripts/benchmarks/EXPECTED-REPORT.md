# NRC19 expected-best search — confirmation report

**Decision: adopt the expected-best objective change as an unpublished branch. All planned confirmation passed; no merge or deployment.**

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

## Completed long and practical confirmation

All23 historical518-support long pairs completed. The balanced set1 current10 mean was **+127.607 points** (budget3 +139.729; budget0 +115.485). The selected historical9 mean was +4665.906; it is deliberately enriched for outliers and must not be mixed into the185-case70/30 result. Other-profile woodDF improved: provided +164.898, all-owned +82.132, sparse +265.099. Sparse currentallATK retained +7706.986; original NRC18waterATK +36752.671; sparse AprilwaterATK +1751.764.

Current535-support checks completed the full balanced set1×current5 matrix at both30/180seconds. Their means were **+1395.392 / +204.644 points**. At180seconds, budget3 averaged +141.343 and budget0 +267.945. No >5% individual regression occurred in any of the228 confirmation pairs.

| NRC19 subject | 518 supports, set1 180s | 535 supports, set1 30s | 535 supports, set1 180s |
|---|---:|---:|---:|
| 第19回統一火BS | +551.006 | +147.988 | +234.822 |
| 第19回統一水BS | -41.709 | -125.957 | +251.852 |
| 第19回統一木DF | +145.519 | +192.611 | +269.398 |
| 第19回統一無DF | -16.781 | +468.311 | +267.148 |
| 第19回統一全ATK | +0.000 | +6294.009 | +0.000 |

The large short-duration set1 allATK gain disappears at180seconds: both versions found equivalent audited top candidates. The current cohort still improves over the longer budget through other subjects. Individual small regressions remain (including waterBS in the historical-support long run and one fireBS case with current supports); adoption does not imply universal improvement.

## Supporting diagnostics and integrity

| Cohort | Rank1 E(max30) Δ | Max Δ | P95 Δ | Win rate Δ, percentage points | Audit-selected top3 E(max30) Δ |
|---|---:|---:|---:|---:|---:|
| Primary current25 | +1705.580 | -27.240 | +3678.960 | -0.980 | +483.480 |
| Primary historical160 | +237.327 | -28.606 | +410.869 | +0.555 | +59.974 |
| Current535 / 30s | +1395.392 | +214.400 | +4877.900 | +1.738 | +211.281 |
| Current535 / 180s | +204.644 | -90.200 | +325.700 | +7.275 | +173.640 |

Top3 is diagnostic only, never candidate selection or adoption. The228 confirmation pairs contain1348 audited candidates and1,380,352 independent ordinary trials. All constraints, maximum-score seed/explicit-plan replays and128 common-candidate exact comparisons passed. Development25 is separate and excluded from these totals.

## Adoption and rejected alternatives

Adopt the locked expected-best change: current and fixed weighted primary means are positive, historical normal/unified and26-subject confirmation means are positive, both set1 long budgets improve, and the current535 long supplement improves. No individual loss exceeds the predeclared5% threshold. Weights were not changed after results.

Do not adopt earlier proposals: the whole-team cache slowed generation; observation-speed gains failed long confirmation; directed joint-spell gains failed current535 long confirmation; burn-aware additions had mixed small effects and did not establish sufficient improvement. Their reports preserve their own sources/results; none of those production changes is in this branch.

## Checks and limitations

On the locked production source: unit suite357pass/0fail/1skip (an unrelated supplied-screenshot test), vue-tsc and production build pass. Stop, file save, new-host resume, preserved nonce/trial position, continued validation and maximum replay pass. Chromium could not start because socket creation returned EPERM; browser storage and visual layout were not verified. Build retains the existing large-chunk warning.

All five NRC19 subjects and30 challenges already existed in baseline. FireBS star3 enemyfireUP matches the game screenshot; the wiki’s neutral label is a typo. NeutralDF star1 target disagreement and existing waterBS blind/wood-down estimated magnitudes remain unresolved. Both versions use identical data; no new game-accuracy claim is made.

This is a wall-clock search comparison with finite independent audits and one fresh nonce per planned run, not a confidence interval or guarantee of improvement for every search. Current subjects are development targets. Earlier observation-speed, directed-spell and burn-aware proposals remain rejected/unadopted in their separate reports.

## Changed files and deliverables

Production: `src/domain/examSearch/statistics.ts`, `scheduler.ts`, `types.ts`; `src/components/ExamSearchResultsTable.vue`; `src/views/examSearch.vue`; Japanese/English/Chinese locale files. Regression coverage: `tests/exam-search.test.cjs`. The existing hand-import mock gained its missing additionalLevelCapError binding so the required suite runs; no import production behavior changed. `scripts/benchmarks/` contains the frozen plans, recovered-compatible harness, protocol and reports. The synthetic observation-equivalence fixture is retained as regression evidence, without personal hand data.

The review archive contains a baseline-relative patch, portable git bundle, source manifest, protocols/reports, four aggregate summaries and auxiliary diagnostics, final integrity, lifecycle and check logs. Personal profiles, raw candidate reports and checkpoints are excluded. A separate private recovery archive preserves profiles and completed pairs. `RESULTS.ja.md` is the Japanese result summary.
