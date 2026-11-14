# Burn-aware construction: development only, not adopted

Candidate generation is preserved separately at `codex/nrc19-burn-aware`, commit `a20157f3`. It is restored to baseline in the expected-best objective branch. No combat data or public ranking changed in these burn experiments. All figures below are rank-one independently audited E(max30) differences; each selected candidate received1024 ordinary trials.

|Development version|Cases|WoodDF mean difference|Outcome|
|---|---:|---:|---|
|v1|25|+122.725|Development only|
|v2|25|+110.297|Development only|
|v3|5|-55.346|Development only|
|v4|5|+74.103|Development only|

v4 changed the auxiliary-root ranking from individual owner score to an actually available two-card immunity pair, deduplicated across own/support roles. Its five-profile180-second rejection screen produced:

|Profile|30 seconds|180 seconds|
|---|---:|---:|
|original|-148.265|+422.086|
|original-zero|+356.225|-132.606|
|provided|+50.079|-377.238|
|all-owned|+112.478|-33.584|
|sparse|+0.000|+280.863|

Five-profile long mean: +31.904 points. All10 short/long pairs passed source/input/catalog/preset guards, ownership/training/support/required-character/budget constraints and maximum-score replays. No direct auxiliary candidate survived into the short-run top3; descendants were not separately attributed. Mixed small gains are insufficient evidence to adopt; the185-case primary and current-support confirmation were not run for this proposal. No historical holdout was used to tune these four burn versions.

The user then explicitly chose expected-best-of30 as the search/display objective. The next proposal implements that objective coherently and is tested separately. Do not combine the burn changes or scores with its adoption comparison.
