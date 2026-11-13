# NRC19 paired search benchmark

This branch tests **directed joint spell refinement** (`DIRECTED-LOADOUTS.md`). The earlier observation-speed proposal was rejected and is reverted here; its saved evidence remains in `NRC19-REPORT.md` and the November13 Library review bundle. The new proposal is not adopted pending fresh complete measurements after cloud recovery. Nothing has been published or merged.

Use `PROTOCOL.md` as the fixed decision protocol. Run from the checkout root. The production baseline is commit `8d68abb6`; the historical subject list comes from `7350e969` and the fixed support/catalog identities from `8dda02ba` (518 cards). Node dependencies must be installed in each checkout. No browser or DOM is required for the real simulation engine.

## Inputs

Private exports are deliberately excluded from git. Prepare the five profiles with:

```sh
node scripts/benchmarks/make-profiles.cjs current-sets.json provided-v3.json artifacts/nrc19/profiles.json
```

`current-sets.json` is the November 13 multi-set export. Only its first slot replaces original/original-zero. `provided-v3.json` is the September 7 export for the separate provided profile, also used by the unchanged historical sparse-selection rule. The output includes SHA-256 source fingerprints and the selected slot. Original budgets are 3 and 0; the other three profiles retain their required characters and zero budget. Additional standalone level allocation is zero; existing upgrade enumeration raises the registered level by 5 per added limit break and includes distributions across multiple owned cards.

## Paired searches

```sh
for shard in 0 1 2 3; do
  node scripts/benchmarks/paired.mjs --before=../twst-nrc19-baseline --after=. --cases=all --tag=primary --shard=$shard/4 > artifacts/nrc19/primary-$shard.log 2>&1 &
done
wait
node scripts/benchmarks/summarize.mjs artifacts/nrc19/primary-before artifacts/nrc19/primary-after artifacts/nrc19/primary-summary.json
```

Check every shard log and require `complete185: true` in the summary. A partial progress summary is not an adoption result. Completed cases can be resumed with identical arguments. Input/nonce/source mismatches abort instead of silently accepting stale files. Source fingerprints include src, build adapters, Vite configuration and the dependency lock; card and preset fingerprints must agree between versions. Keep an entire run directory together with its plan and checkpoints.

Each version runs a 30-second search, freezes the top three distinct published compositions using the production ranking, then evaluates each with 1,024 fresh ordinary trials. The primary metric is rank one's empirical expected maximum over 30 attempts. Audit scores never select or train candidates. Candidate-specific seeds make the same candidate's audit identical between versions. Every audited candidate is checked for ownership, support role, required characters, training, challenge locks and budget. The maximum audit result is replayed both by seed and explicit plan. Wall-clock bounds allow timing noise and cannot prove that every individual user search improves.

Use `--time-ms=180000 --nonce=nrc19-long-v1 --profiles=original-zero --cases=development --tag=long` for the five current plus six historical tuning cases with a fresh search nonce. Use four shards as above. Use `--supports=current --profiles=original,original-zero --cases=current --tag=current-support` for the separate current-535 support check. Do not mix these extra runs into the 70/30 primary weighting.

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
