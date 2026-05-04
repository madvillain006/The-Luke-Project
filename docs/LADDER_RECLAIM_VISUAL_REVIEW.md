# Ladder Reclaim Visual Review

## 1. Winner Pattern
- The selected winners generally match the observed pattern: flush through a ladder, base/reclaim the lower trusted cluster, then move before upper reclaim.
- Visual examples generated: 240.

## 2. False Positives
- False-positive rows available: 230.
- Top categories: reclaim_failed 160, no_acceptance_above_level 182, cluster_too_wide_or_needs_visual_review 182, same_bar_ambiguity 40, repeated_same_level 112, bad_time_of_day 116, missing_bobby_heatmap_confirmation 87, deep_flush_too_violent 21.
- These categories are post-trade review labels only, not live filters.

## 3. Bobby+Mancini
- Bobby+Mancini examples: 91.
- TP +2: 91.2%, stop-first: 9.9%, avg/median heat: 1.16 / 0.75.
- Bobby+Mancini still looks strongest, but remains WATCHLIST_ONLY until visually reviewed on fresh sessions.

## 4. 25K 1ES
- 25K 1ES taken examples: 47.
- Avg 1ES impact per selected taken row: 11.97.
- Stop range: 1.25 to 3 ES points; avg stop 2.57.
- 25K 1ES remains the safer starting mode than immediate 2ES.

## 5. Staged Add
- Best staged variant: 1ES_ADD_AFTER_RETEST_HOLD, PnL 2850, max drawdown 487.5, failed false.
- 50K best staged variant: 1ES_ADD_AFTER_RETEST_HOLD, PnL 2850, max drawdown 487.5, failed false.
- Staged add remains diagnostic. It should not become paper/live until fill assumptions and add timing are visually checked.

## 6. Average Drawdown By Entry
- reclaim_close_first_cluster: avg stop 2.36, stop range 0.5-3, avg/median heat 2.7 / 1.

## 7. Readiness
- Status: WATCHLIST_ONLY.
- No rule upgrades to PAPER_ONLY from this review layer.

## 8. Image Reports
- Positive PNG cases: 12, folder C:\Users\conor\luke\artifacts\review\ladder-reclaim-visual-cases-2026-05-04\positive.
- Negative PNG cases: 12, folder C:\Users\conor\luke\artifacts\review\ladder-reclaim-visual-cases-2026-05-04\negative.
- Manifest: C:\Users\conor\luke\artifacts\review\ladder-reclaim-visual-cases-2026-05-04\manifest.json.

## 9. Needs More Data
- Fresh live-market watchlist observations.
- More Bobby+Mancini sessions.
- Visual validation of stop placement and staged-add fills.
- Explicit chop and repeated-same-level throttles.

## 10. Commands
- `npm run research:ladder-reclaim-review`
- `npm run research:ladder-reclaim`
- `npm test`
