# Quiet pending card icons

The display-icon verifier distinguishes expected absence from damaged content. Missing per-card WebP files are `pending`, not errors. They are included only in diagnostic `reports/card-icons.json`; they do not create a GitHub step summary, warning annotation or failed exit. Existing files that cannot decode, have the wrong format/dimensions, or cannot be read remain errors. A missing image directory is a configuration error, not 528 pending cards.

The report contains `cardCount`, `validCount`, `pendingCount`, `failedCount`, `pending` and `failures`. Only `failedCount` controls the exit status. Mixed reports and notification summaries list actual errors without surfacing pending cards.

Synchronization checks immediately after copying simulator assets, and deployment checks again after merging the recognition catalog. Both still allow valid assets to commit/publish before the final actual-error gate. Pending-only runs exit successfully and skip that gate. True build/push failures still prevent dependent publication. No image is fabricated or substituted.

```sh
python -m unittest discover -s scripts/tests -p 'test_card_icons.py' -v
node --test scripts/tests/card-icon-workflow-flow.test.cjs
python scripts/check_card_icons.py
```

Set `SIMULATOR_WORKFLOW_ROOT` to the simulator checkout to include its workflows in the control-flow tests. On 2026-10-08: 8 display-verifier tests, 18 combined workflow tests, and 34 simulator pipeline tests pass (60 total). The cases cover pending-only silent success, corruption, mixed pending/error/valid cards, continued valid updates, true failure/cancellation, and later image availability.

Local real-data verification checks 528 cards: 527 valid and `jack_great_look` pending; zero errors. Acquisition, icon generation and the twst verifier all exit 0, print no card-specific error/warning, and create no notification summary. Evidence: `reports/pending-only-verification.json`. The existing normal build/type-check succeeded before this Python/workflow-only adjustment; application code and image assets are unchanged.

The quiet-pending policy was validated locally before publication. Normal simulator/main and twst/master pushes are followed by synchronization and deployment verification. No GitHub settings or notification settings need to change.
