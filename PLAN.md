# T6 independent current small performance/score screen

Frozen base ba08481a26f079b830bfcb29e1067da4c0897cf1, pureT6 7247ef54cee812e734b6279c7c0b834670d751ff. No T1/T3/T4/pow/C1; no master/UI deployment/merge. Publiccatalog synthetic fixtures only.

Unchanged existing11caseplan:8cap0 +3cap20(current fireBS/woodDF/rareATK). Three fresh opaque searchnonces frozen in METADATA and scripts, separate ordinary/frozen audit namespaces. ABBA four isolatedprocesses, A1/A2 baseline and B1/B2 T6; separate samebaseline nullarm. Two source technical repetitions are averaged, only3 independent nonces.12VM=2arms×3rep×2shards. Any old labels are not used to infer casecounts: actual plan IDs determine current/history.

30sec source-native runtime/15sec threshold/actual productrank, ordinary1024 and rare32768. Real positivecapON allocation, constraints, maxreplay checked. Both source/harness/driver/helper hashes checked at each case end. Sourcehash includes src/build/config/lock (prior search harness already includedbuild, now reusable digest plus endassert), baseline/null same and candidate differs checked in aggregation. Frozenaudit verifies actual sourcehash matches selection and remains unchanged. Allraw/failures kept, no outcome-based rerun or dropping.

Prospective gates, not adoption:
- Paired withinVM CPU/wall throughput must be positive in all3replicates and aggregategain exceed both abs(geomean(null)-1) and geomean(1+abs(null-1))-1. Report cap strata; a cap loss beyond either nullnoise estimate means hold.
- Current-prioritized score pernonce =0.7×mean current-case auditdelta +0.3×mean historical-case delta. Require its mean>0 and positive in at least2/3nonces. Also require overall current mean delta>0. Summarize cap0 andcap20 separately, not hide ON deterioration in OFF means.
- Any current-case or fixedrare or historicalOFF auditloss>5% means hold and diagnosis regardless of aggregategain. Nullvariance contextualizes but never erases adversecases. Tiny scorechanges within nullvariability remain inconclusive.
- Fixedprepare+first20% prior gain is not whole-searchgain. This small never authorizes fullbench/adoption/publication of productchanges.

Localsmoke uses shorttime/8audit only in separate outputpaths and scripts, production30sec/1024/32768 constants unchanged. Finalreview/realroute smoke before launch. Explicitallowlist excludes node_modules/src/source worktrees, generated data directories andsmoke artifacts. Parent has conditionally authorized only this12VM experiment.
