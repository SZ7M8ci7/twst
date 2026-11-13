# Follow-up scope fixed before the added measurements

The 185-case primary matrix is complete and its 70/30 weighting remains unchanged. Its NRC19 mean is +274.56 points, but effects differ by budget: original (set1, budget3) +1016.78 and original-zero (set1, budget0) -72.95. The initial four completed budget0 long checks are mixed (fire0, water about-250, wood about-215, neutral about+22). No implementation changes are made in response.

In addition to the original protocol's 11 fresh-nonce long checks, run:

- All five NRC19 subjects with original (budget3), 180 seconds, fresh nonce `nrc19-long-v1:{profile}:{id}`. Keep all five, regardless of direction. This assesses the profile responsible for a large part of the current-cohort short gain; it does not replace the budget0 long comparison.
- original / 第17回統一全DF, 180 seconds: the primary matrix's only regression exceeding5% (-6187.47 expected points).
- original-zero / 2026/04-2水ATK, 180 seconds: the largest positive historical outlier (+6709.33), to check both directions of extreme short-run variation.

The original budget0 long11, the additional budget3 current5, the regression1 and the positive-outlier1 are reported separately. Do not treat the extra cases as extra primary weight or tune the code to their outcomes. The previously planned current535-support supplement remains both set1 profiles × current5, all challenges ON, 30 seconds, separately reported.
