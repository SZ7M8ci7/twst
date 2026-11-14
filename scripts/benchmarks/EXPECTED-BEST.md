# Expected best of the requested attempts — authorized objective change

The user explicitly chose “30回の最高点期待値を優先する” during the November14 work. Automatic search now optimizes and displays expected best of the configured number of ordinary attempts (30 in the fixed benchmark). This replaces the former upper-tail reachable-score preference; it is not an audit-only reranking. Failed/invalid ordinary outcomes count as zero, and hypothetical/importance trials never enter this expectation. Explicit target-score/reach-probability mode retains its previous objective.

Restore candidateGenerator to baseline8d68abb6. The burn-aware construction proposal remains separate on codex/nrc19-burn-aware; its focused development and ongoing long screen do not justify adopting it. The new production changes align development quality, automatic refinement parent priority, automatic finalist champions/retention, result sorting and compact display summaries. Rare-tail exploration remains in spare slots. Exact expected-score ties prefer fewer items; per-cost representatives and training variants remain available. Engine version140 prevents resuming incompatible old search sessions; ordinary combat data/rules are unchanged.

The UI shows expected best alongside observed maximum and P95, with the selected attempt count and zero-failure explanation. This is an estimated distribution statistic, not a guaranteed outcome or a new confidence interval.

Keep PROTOCOL.md's baseline, set1 replacement, other three hand profiles, all challengesON, historical518 supports, independent1024 ordinary audits, displayed score-rank1 E(max30), current70%/past30% weighting and185 primary cases. The authorized objective change applies only to the after version. The before version keeps its original production ordering; do not rerank either side using audits. The benchmark calls each version's own development-quality function for tie diagnostics. Common-candidate audits must still match on original metrics, and the new expected-score summary must equal the independently computed audit expectation.

Predeclare development before score results: same25-case burn-development-plan.json (both set1 budgets×current5+tuning6, plus other three profiles×currentwoodDF),30seconds, four processes, tag expected-development, nonce nrc19-expected-dev-v1. Then freeze source and run185 primary cases, tag expected-primary, nonce nrc19-expected-primary-v1. Long confirmation uses the20-case burn-long-plan.json at180seconds, tag expected-long, nonce nrc19-expected-long-v1; extend material primary regressions and largest positive outlier. Current535 support supplement uses both set1 budgets×current5 at30 and180seconds, tags expected-current-support and expected-current-support-long, corresponding nrc19-expected-current-support-v1 and nrc19-expected-current-support-long-v1 nonces. No publication or merge.

Locked development source hash: `eb1fe187e63aaa81f5aca080bf22f997e05fb9200ecd217c2d68c83e7ac8a76f`. Focused regression tests pass; full suite357pass/0fail/1skip, vue-tsc and production build pass. Browser storage could not start because the cloud Chromium process failed at socket() with EPERM; no browser storage or visual-layout coverage is claimed. Lifecycle stop/file-save/new-host resume/max replay passed.

## Development1 diagnosis and refinement

All25 development comparisons completed with valid independent audits/constraints. The two set1 budgets×current5 averaged -313.014; the12 historical tuning cases averaged +2776.666, dominated by NRC18 waterATK improvements. These uneven subsets are not the fixed70/30 primary result. Current original-zero neutralDF regressed -3053.110 (-6.1%). Its baseline winning composition was absent from the after pool, while validation correctly ranked the after pool by expectation. This identifies lost exploration as the issue, not an audit-reranking discrepancy.

Restore the original peak/weighted/scout/quality parent priority for refinement. Quality still uses expected best; final selection, retention and display continue to prioritize it. This preserves existing high-ceiling exploration paths rather than replacing them with the early expected-score winner. The regression test now requires both original peak-first refinement and expected-first final selection in every cost band. No changes to combat data, input profiles, public objective or adoption weights.

Re-run the same25 development cases with tag expected-development-v2 and fresh nonce nrc19-expected-dev-v2 before primary confirmation. The first result is retained and is not called an improvement.

Development2 source hash: `23245ff6b603b8ab69ba8426db50decf9acc34f888f334e14e81990d6301d80b`. Full357tests pass (1unrelated supplied-screenshot test skipped); type/build and stop/save/resume/max replay pass on this source.

## Locked confirmation decision

Development2 completed25/25 with valid independent1024 audits, constraints and maximum replays. Set1 current10 mean +87.987; historical tuning12 mean +3386.304. Original/zero currentneutralDF improved +610.6/+226.0; no individual development regression exceeded5%. Other-profile currentwoodDF was all-owned +225.0, provided -218.2, sparse -207.4. These are development findings, not adoption.

Freeze source23245ff6b603b8ab69ba8426db50decf9acc34f888f334e14e81990d6301d80b and proceed to the complete185-case primary matrix exactly as predeclared. Do not use the26 historical confirmation subjects to retune this source. Extend the fixed20-case long plan before primary scores with original NRC18 waterATK (development +33041.3), yielding expected-long-plan.json21cases. This guards the unusually large development outlier. Further material primary regressions/largest uncovered gain still require extension. The10-case current535 supplements remain required at both30/180seconds.

## Infrastructure interruption and fresh complete matrix

The reused-process primary run suffered an externally killed child after roughly36 matched cases; stopping the other children left39 complete files. The environment exposed neither a cause nor usable cgroup counters. All39 are excluded from adoption, including potentially affected completions. No score outcomes from this aborted primary were inspected or used to tune production code.

Use a four-slot supervisor with a fresh Node process for each paired case, closing it after both versions and their independent audits. Counterbalanced order and per-version30/180-second search budgets remain unchanged; module startup stays outside the search budget. This bounds accumulation across exams. Child failure stops all remaining children immediately. Save each child's own resource-usage totals for diagnosis. This is a measurement-infrastructure change, not a production optimization.

Restart the ENTIRE185-case primary matrix with expected-primary-plan.json, tag expected-primary-isolated, nonce nrc19-expected-primary-isolated-v1. Use the same one-pair-per-child/four-slot mode for21-case expected-long-plan.json (tag expected-long-isolated, nonce nrc19-expected-long-isolated-v1), and expected-current-support-plan.json10cases at30/180seconds (tags expected-current-support-isolated and expected-current-support-long-isolated; matching nrc19-expected-current-support-isolated-v1 and nrc19-expected-current-support-long-isolated-v1 nonces). Keep production hash23245ff6b603b8ab69ba8426db50decf9acc34f888f334e14e81990d6301d80b, all input/rule hashes and70/30 weights. Do not combine the aborted primary with the fresh matrix. Development evidence remains development only.

## Complete primary result and locked long extension

All185 isolated pairs completed. Rank1 E(max30): current25 +1705.580, historical160 +237.327, fixed70/30 +1265.104 points; normalized weighted +2.7271%. Current fireBS -33.266, waterBS -108.823, woodDF +29.828, neutralDF +209.997, allATK +8430.163. No individual regression exceeded5%. Historical26-subject confirmation mean +168.332. All1094 independent1024-candidate audits passed constraints, maximum replays and110 shared-candidate exact comparisons. This is short-duration evidence only.

Keep source23245 unchanged. Before running long scores, extend the21-case plan with sparse NRC19 allATK (largest primary gain +27057.544) and sparse 2026/04-2 waterATK (largest historical gain +10988.437). The latter is confirmation of an outlier, not tuning on a holdout. expected-long-confirmation-plan.json therefore contains23 cases at180seconds, tag expected-long-isolated, nonce nrc19-expected-long-isolated-v1. Both10-case current535-support supplements remain mandatory.

## Complete180-second confirmation

All23 long pairs passed integrity checks. The balanced set1 current10 mean was +127.607 points (budget3 +139.729; budget0 +115.485). Its subject means were fireBS +551.006, waterBS -41.710, woodDF +145.518, neutralDF -16.781, allATK0. No individual long regression exceeded5%. All three other-profile woodDF cases improved (+164.898 provided, +82.132 all-owned, +265.099 sparse); sparse currentallATK retained +7706.986. The two deliberately added historical outliers improved (original NRC18waterATK +36752.671 and sparse April waterATK +1751.764). Historical9 long cases averaged +4665.906 but are a selected diagnostic subset, not the185-case70/30 aggregate. Current535 support checks remain pending; no adoption yet.

Current535-support30-second supplement completed10/10 with valid audits and no >5% regressions. Balanced set1 mean +1395.392 (budget3 +2562.014; budget0 +228.771). Subject means: fireBS +147.988, waterBS -125.957, woodDF +192.611, neutralDF +468.311, allATK +6294.009. The same10 cases are now frozen for180-second confirmation; this supplement is not mixed into the primary70/30 result.
