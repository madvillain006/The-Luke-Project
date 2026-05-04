# Fake Breakdown Watchlist Replay

## 1. Can Rule A Be Visually Trusted?

Rule A has 33 replay rows in the watchlist artifact. It remains WATCHLIST_ONLY because the sample is small and the visual replay still needs human inspection of the power-hour setup quality.

## 2. Are Rule A Results Clustered?

Rule A appears on 12 days and 6 weeks. Top positive days: 2026-04-24: 4 signals, 4 winners, 0 losers, $600.00; 2026-04-10: 3 signals, 3 winners, 0 losers, $450.00; 2026-04-17: 4 signals, 4 winners, 0 losers, $450.00.

## 3. Why Did Rule B Fail Account Sim Despite Good TP/Stop Stats?

Baseline Rule B: 155 signals, $-500.00, target hit false, failed true. The issue is chronological loss sequencing and repeated allowed tradeable signals, not raw TP +2 rate alone.

## 4. Which Rule B Throttle Improves Survival?

Best Rule B throttle: no_repeat_same_level_after_loss_2es, $1200.00, target hit false, failed false, positive day rate 66.7%.

## 5. Is 1ES Starter Better Than 2ES For Rule B?

Rule B 2ES baseline: $-500.00, failed true. Rule B 1ES starter: $-125.00, failed false.

## 6. What Visual Patterns Show Up In Winners Vs Losers?

The replay artifact exposes the chart windows, state markers, level, entry, stop, TP +2/+3, next target, Bobby target flag, MFE/MAE, and account impact for every A/B/C signal. This doc does not overclaim the visual pattern; inspect the HTML signal-by-signal.

## 7. Should Any Rule Move From WATCHLIST_ONLY To PAPER_ONLY?

No. Rule A/B/C remain WATCHLIST_ONLY. Rule A is clean but low sample. Rule B and C have better sample size but still need throttle and visual review before paper status.

## 8. What Exact Evidence Is Still Missing?

- More out-of-sample days.
- Order-fill realistic replay beyond OHLC bars.
- Visual confirmation that losers are mechanically distinguishable before entry.
- A throttle that survives the 25k target path without relying on one cluster.
- Confirmed Bobby/heatmap target timestamps and distances for every Rule C signal.

## 9. Artifacts

- `artifacts/research/fake-breakdown-watchlist-replay.json`
- `artifacts/research/fake-breakdown-rule-clustering.json`
- `artifacts/research/fake-breakdown-rule-throttles.json`
- `artifacts/research/fake-breakdown-watchlist.html`
- `artifacts/research/fake-breakdown-watchlist-summary.csv`

## 10. Commands

```bash
npm run research:fake-breakdown-watchlist
npm run research:fake-breakdown-state
npm test
```
