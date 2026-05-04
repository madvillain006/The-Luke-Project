# Research Replay Results

Generated from existing local data on 2026-05-03.

## 1. Replay Scope

- Scope: ES 1-minute no-lookahead replay with existing analyst context.
- SPX bars were inventoried but not substituted for ES current price.
- Current decision spine was called through the existing operator decision adapter with temporary research Level Memory under ignored artifacts.
- Live trading behavior, execution routes, risk gates, and `buildTradeDecision` strategy were not changed.

## 2. Sessions And Checkpoints

- Sessions replayed: 37.
- Date range replayed: 2026-03-02 through 2026-04-28.
- ES session bars used: 14,430.
- Checkpoints evaluated: 2,720.
- Checkpoint selection: 15-minute/opening checkpoints, source updates, and near-level/touch events, capped per day.

## 3. Data Sources Used

- ES session minute bars from `data/backtest/es-long-bracket/sessions/*.json`.
- Historical Saty levels from session JSONs.
- Bobby cached parsed heatmaps and timestamped Bobby message exports.
- Mancini session-normalized date-only context where available; raw date-only posts were quarantined.
- Katbot/Jefe timestamped local context.
- SPX historical CSVs were inventoried only.

## 4. No-Lookahead Enforcement

- Every source event had to satisfy `available_at_et <= checkpoint`.
- Bobby context was same-session only.
- Mancini date-only posts were same-session premarket/all-day context only.
- Heatmap image files without cached parse were not guessed.
- Outcomes used only bars after the checkpoint.

## 5. Outcome Summary

- Actionable decisions: 16.
- PASS/WAIT decisions: 2,704.
- Vetoes observed: 1,478.
- PASS missed-move classifications: 485.
- Veto saved-bad-trade classifications: 672.
- Among the dominant all-source combo, average 15-minute MFE was about 6.20 ES points and average 15-minute MAE was about 5.47 ES points.

## 6. Source Combinations

- `bobby+katbot+mancini+saty`: 1,132 checkpoints, 16 actionable, 1,116 PASS/WAIT, high sample confidence.
- `bobby+katbot`: 774 checkpoints, 0 actionable, high sample confidence.
- `katbot+mancini+saty`: 456 checkpoints, 0 actionable, high sample confidence.
- `bobby+katbot+saty`: 226 checkpoints, 0 actionable, high sample confidence.
- `katbot+saty`: 14 checkpoints, low sample confidence.

## 7. Veto Analysis

- Vetoes were common because the current decision spine is conservative about fresh Bobby/Saty inputs and chop/risk conditions.
- 672 veto rows had at least 5 ES points of adverse 15-minute movement, so the replay can prove vetoes often prevented bad immediate exposure in this corpus.
- This does not prove the veto logic is globally optimal.

## 8. PASS/Missed-Move Analysis

- 485 PASS rows still had at least 10 ES points of favorable 15-minute movement.
- Many missed moves were not necessarily valid trades because the replay did not prove fill quality, entry acceptance, or same-bar stop/target sequencing for every PASS.
- PASS missed-move rows are useful research targets, not proof that Luke should loosen gates.

## 9. What It Proves

- The repo already contains enough ES bars and analyst context to run a useful historical replay.
- Existing data can produce a no-lookahead source timeline and measurable ES forward outcomes.
- The current spine/adapter is very conservative on this corpus: only 16 of 2,720 checkpoints were actionable.
- Source attribution can be measured now, but should be interpreted with the exact source freshness caveats.

## 10. What It Does Not Prove

- It does not prove an uppercase Algo is ready.
- It does not prove live trading profitability.
- It does not prove SPX levels can be used as ES prices.
- It does not prove unparsed heatmaps or date-only commentary are reliable intraday signals.
- It does not tune or change `buildTradeDecision`.

## 11. Algo Readiness

- Luke is closer to an algo research engine because it now has inventory, timeline normalization, no-lookahead replay, source attribution, and outcome artifacts.
- Luke is not yet an uppercase Algo because source timestamps, Dubz normalization, SPX/ES basis handling, and broader bar coverage still limit confidence.

## 12. Next Data Worth Pulling

- None required before using the current artifacts.
- If expanding, pull exact missing ES RTH 1-minute bars for excluded sessions and exact-timestamp Mancini/Dubz source exports.

## 13. Commands

- `npm run research:inventory`
- `npm run research:replay:existing`
- `npm test`
- `npm run replay:history`
- `npm run market:data:test`
