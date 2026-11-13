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
