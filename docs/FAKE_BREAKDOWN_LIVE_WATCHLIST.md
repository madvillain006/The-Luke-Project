# Fake Breakdown Read-Only Watchlist

Status: research/watchlist only. This document describes the operator watchlist surface, not a live trading system.

## 1. What The Watchlist Does

The fake-breakdown watchlist is a read-only operator/research surface for Rule A/B/C fake-breakdown state-machine signals.

It displays:

- Current ES market-data status.
- Nearest trusted executable ES level.
- Distance from current ES price to that level.
- Current watchlist state.
- Rule A/B/C candidate, if one is forming.
- Next condition needed before a rule can arm.
- Target space above and nearest overhead level.
- Rule B no-repeat-after-loss throttle status.
- Research-only entry zone, invalidation reference, and TP1 reference.

Endpoint:

```bash
GET /api/research/fake-breakdown-watchlist?instrument=ES
```

UI:

- `/operator-v2` now shows a read-only `Fake Breakdown Watchlist` card.
- The only control is the existing page refresh button.

## 2. What It Does Not Do

- It does not place trades.
- It does not stage trades.
- It does not alter `buildTradeDecision`.
- It does not change live trading behavior.
- It does not make `/operator-v2` write-capable.
- It does not classify Rule A, B, or C as paper/live.
- It does not create ES executable levels from SPX reference levels unless an explicit basis exists.

The card warning is intentional:

```text
WATCHLIST ONLY - not a trade recommendation.
```

## 3. Rule A/B/C Status

Rule A:

- Definition: power hour + three-candle hold + next target at least 4 ES points.
- Research sample: 33 signals, 12 days / 6 weeks.
- TP +2: 81.3%.
- Stop-first: 18.8%.
- Status: WATCHLIST_ONLY.
- Reason: promising but low sample and clustered.

Rule B:

- Definition: power hour + reclaim range not excessive + next target at least 3 ES points.
- Baseline failed the 25k account simulation.
- Best throttle: `no_repeat_same_level_after_loss_2es`.
- Throttled result: +$1200, no fail, max drawdown $675.
- Status: WATCHLIST_ONLY.
- Reason: throttle improves survival but does not yet prove paper readiness.

Rule C:

- Definition: Bobby/heatmap target above + two-candle hold.
- Research sample: 76 signals, 56 tradeable rows.
- TP +2: 80.4%.
- Stop-first: 26.8%.
- Status: WATCHLIST_ONLY.
- Reason: needs visual review.

## 4. Why No Rule Is Paper/Live Yet

No rule has enough clean out-of-sample evidence. Rule A is small and clustered. Rule B needs account-risk throttling before its raw TP rate is useful. Rule C still needs visual inspection of heatmap target behavior and loser patterns.

## 5. How To Read The Card

State meanings:

- `NO_SETUP`: no usable ES price or executable trusted ES level.
- `LEVEL_WATCH`: trusted level exists but price is not near the zone.
- `ZONE_WATCH`: price is within the watch distance of the level.
- `BREAKDOWN_DETECTED`: price closed below the level after sweeping below it.
- `RECLAIM_WATCH`: price reclaimed the level, but A/B/C filters are not armed.
- `ARMED_RULE_A`: Rule A watchlist condition is present.
- `ARMED_RULE_B`: Rule B watchlist condition is present.
- `ARMED_RULE_C`: Rule C watchlist condition is present.
- `WATCH_ONLY`: structure exists but a rule is blocked or target/risk context is incomplete.
- `INVALIDATED`: reclaimed level was lost.
- `EXPIRED`: reclaim window expired.

The card should be read as a research prompt for visual review, not as an instruction.

## 6. No-Repeat-After-Loss Throttle

Rule B gets blocked if the same level already produced a loss today.

The card shows:

- `Prior loss same level today`: yes/no.
- `No-repeat throttle`: `clear`, `not_applicable`, or `BLOCKED_REPEAT_LEVEL_AFTER_LOSS`.

This is read from trading state only. The watchlist does not write the loss state.

## 7. Known Limitations

- Live state reconstruction is only as good as available ES market data and recent ES one-minute bars.
- Without recent bars, the surface can show level/zone watch but cannot prove breakdown/reclaim progression.
- Stale or delayed ES price prevents arming.
- SPX reference levels remain `reference_only` unless explicit basis metadata exists.
- Bobby/heatmap target timing still needs careful visual inspection.
- The card does not solve slippage, fill quality, or same-bar ordering ambiguity.

## 8. Commands To Verify

```bash
npm test
npm run research:fake-breakdown-watchlist
npm run research:fake-breakdown-state
```
