# Burn-aware auxiliary construction — proposal, not adopted

Baseline8d68abb6 and PROTOCOL.md remain fixed. The whole-team estimate cache, observation-speed proposal and directed joint-spell proposal were rejected. Directed spells passed the historical518 support averages but failed current535 support180-second confirmation (-2035.469 points); DIRECTED-REPORT.md preserves all224 comparisons. Its two production changes are reverted. Public upside ranking is unchanged; audit outcomes never rerank the top3.

This proposal adds a fourth construction view ONLY for DEFENCE exams with an explicitly valued, duration-specified, team-wide playerBurn challenge. It estimates five-turn base-HP burn exposure, credits passive buddy burn immunity when the buddy is present, and gives the existing discounted completion potential to a missing immunity buddy. This is a construction heuristic, not a new battle rule: ordinary trials still decide actual early finishes, magic cleanses, immunity timing and nonlethal caps. Unknown rate/duration and dorm/attribute-scoped effects are skipped. Existing card/rule data remain unchanged.

Preserve all ordinary construction tasks and their relative order. Add at most two distinct anchored tasks per cost band, one after every eight ordinary tasks. The original three estimator styles retain their values. Non-burn exams receive no new tasks. No new whole-team estimate cache.

Development plan fixed before scores: both set1 budgets × (current5 + historical tuning6), plus provided/all-owned/sparse × NRC19 woodDF =25 paired30-second cases, four processes, nonce nrc19-burn-dev-v1. Do not interpret this uneven development subset as the primary70/30 aggregate. Confirm unaffected synthetic candidate fingerprints separately, not as score adoption evidence.

If worth confirming, freeze source, then repeat the complete185-case30-second primary matrix with nonce nrc19-burn-primary-v1. Same5profiles, allON, fixed518 supports, independent1024 ordinary audits, displayedrank1 E(max30), and current70%/past30% remain unchanged. Historical26 holdout subjects are not tuning data. This proposal was motivated by the known current woodDF burn and the existing engine, not historical holdout scores.

Long plan: the existing17 comparisons (both set1 budgets×current5; original-zero×tuning6; original×NRC17allDF), plus currentwoodDF for provided/all-owned/sparse =20 cases,180 seconds, nonce nrc19-burn-long-v1. Extend any material primary regression and the largest positive outlier not already included. Separately run both set1 budgets×current5 with current535 supports at BOTH30 and180 seconds, nonces nrc19-burn-current-support-v1 and nrc19-burn-current-support-long-v1. Four processes per run. Report all outcomes; do not hide a failed short or long cohort.

Final checks: constraints, allmaximum seed/plan replays, stop/save/resume, full tests/type/build, browserstorage if available. No publication, push or merge.

Initial locked production/dependency hash: `e4772474c38a224860b835e81fa3346d6813d3dd4fdb20af85caaa234dc70ab0`. The focused regression test and vue-tsc passed. Synthetic deterministic fingerprints are identical to baseline for NRC19 fireBS, waterBS, neutralDF and allATK; woodDF has two added tasks (145→147), while the unit regression proves every original task remains in order.

## Development refinement before primary confirmation

The first25 development comparisons averaged +122.725 on currentwoodDF across5 profiles (2 gains/3 losses, original -6.9, original-zero +427.5, provided -161.7, all-owned -25.4, sparse +380.2). Large differences also appeared in unchanged subjects, including original-zero currentATK +6188 and original NRC17allDF -6629; those timing-cutoff differences are not evidence of burn logic improving those subjects. No historical holdout was run for this proposal.

Refine the extra paths to require an available passive burn-immunity buddy, rather than merely cloning the first two ordinary anchors. Rank eligible root/buddy pairs by the existing single-card estimate plus the known avoided base-HP burn and buddy HP contribution. Retain the same limits (two distinct roots per cost, one extra after eight regular tasks), unchanged ordinary ordering, and unchanged styles0/1/2. Do not add work for roots with no available immunity buddy. Re-run the same25 development cases with tag burn-development-v2 and fresh nonce nrc19-burn-dev-v2 before deciding whether to run primary confirmation.

Second development source hash: `5de18bf833105aa80e93e5cdc1187bbab1ca85a9dd63b50b54b513b48120f73f`. Unit and type checks pass. All five dorm-only synthetic fingerprints now match baseline because that synthetic roster has no available enhanced burn-immunity pair; the focused unit uses an available immunity pair and asserts nonempty legal candidates containing the required buddy. These synthetic checks are not adoption scores.

Third development source hash: `2ffa4bc460b7404bf2eab173a03dc9c047588ba301a8277f1afdb1bf9ca88152`.

## Third development refinement

The second25-case development run averaged +110.297 on currentwoodDF: original -148.0, original-zero -77.7, provided +479.7, all-owned +276.6, sparse +20.9. Its unchanged subjects also showed large timing-cutoff differences and are not causal evidence of burn improvements.

Code review found that ordinary task.requiredCharacters is a lower-priority construction hint, so the extra immunity partner could be omitted when user constraints filled slots. Style3 now merges that partner with the user required-character set for completion and final construction checks; all user constraints remain mandatory. A focused regression covers an impossible partner with all owned slots fixed. The burn estimate is isolated in a style3 wrapper; the entire ordinary estimator body is restored exactly to baseline. An explicit return type resolves the wrapper/cache inference cycle. Focused test and type checks pass; all five dorm-only synthetic fingerprints equal baseline.

Before further measurement, fix a five-profile currentwoodDF-only development comparison: burn-focused-plan.json, tag burn-development-v3, nonce nrc19-burn-dev-v3,30seconds,4processes, unchanged1024 audit and historical518 supports. This avoids repeatedly scoring unaffected subjects while refining. Full185/long/current-support confirmation remains required for adoption.

## Fourth development refinement

Third focused5-case result: woodDF mean -55.346; original -196.614, original-zero -65.244, provided +164.781, all-owned +129.744, sparse -309.394. All audits and constraints passed. Not accepted. Path diagnostics show extra paths were reached but none of their candidates survived into the displayed top3. In provided/all-owned both extra paths selected the same immunity owner as owned and support, exposing limited diversity and single-card ranking that ignores the required partner's contribution.

Rank auxiliary roots by the best legal two-card ordinary-plus-burn estimate with an actually available immunity partner, including owned/support role capacity. Deduplicate the owner/partner pair across roles, preserving the best scored role and retaining at most two extras per cost. All ordinary paths, public ranking, combat data and fixed adoption protocol remain unchanged. Predeclare another focused five-profile woodDF30-second development run using burn-focused-plan.json, tag burn-development-v4, nonce nrc19-burn-dev-v4, four processes. This is tuning, not holdout/adoption evidence.

Fourth development source hash: `5ff539dcc29365438bd7e2e280b5c722e373d92d782f0876d143a21e1d4a8c64`. Focused unit and type checks pass.
