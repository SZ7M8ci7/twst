# Card icon synchronization checks

`scripts/check_card_icons.py` verifies every final catalog entry (respecting `imageKey`) has a decodable 80x80 WebP display icon. It writes `reports/card-icons.json`, lists unresolved card keys in the Actions job summary and exits nonzero on missing or invalid icons.

The synchronization workflow validates immediately after copying simulator assets. The deploy workflow validates again after the recognition catalog merge, since that merge may introduce new cards. Both preserve successful updates and publishing of available content, then mark the workflow as failed if icons remain unresolved. Reports are retained for 30 days. This does not turn recognition artwork into display icons or silently replace missing cards.

```sh
python -m unittest discover -s scripts/tests -p 'test_card_icons.py' -v
python scripts/check_card_icons.py
```

The verifier needs Pillow (the deploy workflow already installs it; the sync workflow installs the same pinned version). The local repair copies verified simulator images additively, matching the existing sync behavior. As of 2026-10-08, 527 of 528 card icons validate; only `jack_great_look` remains unavailable upstream. The checker returns 1 for that known gap. Three verifier regression tests passed. No changes have been pushed or deployed.

## Final workflow ordering and build verification

On 2026-10-08, the actual YAML of both repositories was tested with simulated missing-card outcomes, complete outcomes and cancellation (14 workflow-control regression cases, all passed). A real build failure blocks Deploy; a real commit/push failure blocks deploy dispatch. Image-check failures have `continue-on-error: true`, so their step conclusion stays successful while their outcome stays failed. Commits and deploy dispatch/build/deploy run before the final explicit failure step. The twst sync is independently scheduled, with no dependency on the simulator workflow succeeding. A missing Jack icon therefore does not stop the nine repaired icons from propagating.

Run the workflow-contract test with Node.js and npm dependencies installed:

```sh
node --test scripts/tests/card-icon-workflow-flow.test.cjs
```

Set `SIMULATOR_WORKFLOW_ROOT` to an isolated simulator checkout to include the upstream workflows (14 cases total; 8 twst-only cases otherwise). This is a local condition-flow test; it never runs shell actions or publishes.

`npm ci --legacy-peer-deps` and `npm run build` passed in the isolated checkout (Node 22.18.0, npm 10.9.3). The normal build includes prebuild, `tsc --noEmit`, and Vite production bundling. The built image registry also contains 527/528 card icons; only `jack_great_look` is absent. Vite reports a chunk-size warning, with no build/type-check errors. CI uses Node 20; an actual hosted Actions execution and deployment remain unperformed because publication is not authorized. Logs are in `reports/build.log` and `reports/built-icon-verification.json`.
