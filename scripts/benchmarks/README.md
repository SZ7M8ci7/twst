# NRC19 paired search benchmark

The current branch tests **expected best of the configured attempts**, explicitly chosen by the user. Read `EXPECTED-BEST.md`. Baseline8d68abb6 retains its original ranking; the after version changes actual development/finalist/display ranking, never using audit scores for selection. Burn-aware construction is omitted (`BURN-REPORT.md`); directed spell and observation-speed proposals also remain unadopted. Nothing is published or merged.

Use `PROTOCOL.md` as the fixed decision protocol. Run from the checkout root. The production baseline is commit `8d68abb6`; the historical subject list comes from `7350e969` and the fixed support/catalog identities from `8dda02ba` (518 cards). Node dependencies must be installed in each checkout. No browser or DOM is required for the real simulation engine.

## Inputs

Private exports are deliberately excluded from git. Prepare the five profiles with:

```sh
node scripts/benchmarks/make-profiles.cjs current-sets.json provided-v3.json artifacts/nrc19/profiles.json
```

`current-sets.json` is the November 13 multi-set export. Only its first slot replaces original/original-zero. `provided-v3.json` is the September 7 export for the separate provided profile, also used by the unchanged historical sparse-selection rule. The output includes SHA-256 source fingerprints and the selected slot. Original budgets are 3 and 0; the other three profiles retain their required characters and zero budget. Additional standalone level allocation is zero; existing upgrade enumeration raises the registered level by 5 per added limit break and includes distributions across multiple owned cards.

## Paired searches

```sh
node scripts/benchmarks/isolated-paired.mjs --before=../twst-nrc19-baseline --after=. --plan=scripts/benchmarks/expected-primary-plan.json --tag=expected-primary-isolated --nonce=nrc19-expected-primary-isolated-v1
node scripts/benchmarks/summarize.mjs artifacts/nrc19/expected-primary-isolated-before artifacts/nrc19/expected-primary-isolated-after artifacts/nrc19/expected-primary-isolated-summary.json
```

Check every shard log and require `complete185: true` in the summary. A partial progress summary is not an adoption result. Completed cases can be resumed with identical arguments. Input/nonce/source mismatches abort instead of silently accepting stale files. Source fingerprints include src, build adapters, Vite configuration and the dependency lock; card and preset fingerprints must agree between versions. Keep an entire run directory together with its plan and checkpoints.

Each version runs a 30-second search, freezes the top three distinct published compositions using the production ranking, then evaluates each with 1,024 fresh ordinary trials. The primary metric is rank one's empirical expected maximum over 30 attempts. Audit scores never select or train candidates. Candidate-specific seeds make the same candidate's audit identical between versions. Every audited candidate is checked for ownership, support role, required characters, training, challenge locks and budget. The maximum audit result is replayed both by seed and explicit plan. Wall-clock bounds allow timing noise and cannot prove that every individual user search improves.

Use `--time-ms=180000 --nonce=nrc19-expected-long-isolated-v1 --plan=scripts/benchmarks/expected-long-confirmation-plan.json --tag=expected-long-isolated` for the fixed23 long comparisons (the original17: both set1 budgets × current5, original-zero × historical tuning6, original × NRC17 allDF; plus provided/all-owned/sparse NRC19 woodDF and original NRC18 waterATK; plus sparse NRC19 allATK and sparse 2026/04-2 waterATK, the largest current/historical primary gains). Use isolated-paired.mjs with its four concurrent slots as above. Use `--supports=current --plan=scripts/benchmarks/expected-current-support-plan.json --tag=expected-current-support-isolated --nonce=nrc19-expected-current-support-isolated-v1` for the separate current-535 support check. Do not mix these extra runs into the70/30 primary weighting.

## Checks and diagnostics

```sh
node --test tests/*.test.cjs scripts/tests/*.test.cjs
npm run build
./node_modules/.bin/vue-tsc --noEmit
```

Browser tests require a runnable Playwright Chromium (`PLAYWRIGHT_MODULE`, `CHROMIUM_EXECUTABLE_PATH` can point at installed runtimes). The observation regression fixture is synthetic and public: all eight policies across five current subjects, plus re-preparation of the first candidate. Its digests were generated against the untouched baseline; normal test runs must never regenerate them. To intentionally establish a reference, provide both `EXAM_REFERENCE_ROOT` and `EXAM_RECORD_REFERENCE=1`.

`run.mjs` / `search.ts`, `fingerprint.cjs`, and `replay-paired.mjs` are early diagnostic helpers; their synthetic profiles and auto challenge mode are not the adoption matrix. The last helper uses local diagnostic artifacts. All raw profiles, checkpoints and private results belong under ignored `artifacts/nrc19/`.

## Combat-data limitations

The repository already contains all five NRC19 subjects and 30 challenges. The [Gamerch table](https://gamerch.com/twst/967279) has a confirmed fire-BS star-three typo: the [game screenshot](https://assets.st-note.com/img/1794239229-2UFur3tjEiQ4bo1eKsy80mkc.jpg) says enemy **fire** damage UP for five turns, matching the existing code. The neutral-DF star-one target differs between that table and the code; no readable game image established a correction, so the current player attribute-down behavior is retained. Existing estimated water-BS blind and wood damage-down magnitudes remain unverified. Both search versions use identical combat data; this comparison is not new validation of those game magnitudes.

`FOLLOWUP.md` records the additional long checks fixed after the primary matrix, before those added measurements. `node scripts/benchmarks/lifecycle.mjs` checks real-engine stop, checkpoint file persistence, resumed validation and maximum replay without claiming browser storage coverage.


## Recoverable private measurements

`python3 scripts/benchmarks/recovery-snapshot.py` bundles the clean committed source, private profiles and only matched completed case reports. Save this archive to the same private Library item after each group of completed cases. It contains personal hand data; it is separate from the public source/review deliverable. On recovery, restore the recorded branch and profiles, then rerun the identical tag/nonce/shard arguments. Interrupted pairs are rerun on both versions; do not resume their partial time budgets. `status-pairs.py TAG` reports completion without exposing holdout score outcomes during the fixed-code confirmation run. `verify-paired.mjs output.json TAG...` validates complete plans, independent1024-trial audits, maximum replay, constraints and common-candidate equality. `lifecycle.mjs expected-lifecycle` preserves separate lifecycle evidence.

The current535 support supplement also runs the same entire10 cases at180 seconds with `--time-ms=180000 --tag=expected-current-support-long-isolated --nonce=nrc19-expected-current-support-long-isolated-v1`. Do not replace or mix the30-second result.
