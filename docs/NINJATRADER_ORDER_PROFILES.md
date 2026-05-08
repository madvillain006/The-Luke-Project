# Luke NinjaTrader Order Profiles

This documents the current TradingView -> Luke -> NinjaTrader handoff for ES/MES dry-fire testing.

## Alert Types

| Pine alert | Ninja action | Notes |
| --- | --- | --- |
| `LUKE_LONG` with `class=SCALP_VALID` | Submit split long limit at Pine `entry` | Standard smaller reclaim. TP1/TP2/stop come from Pine. |
| `LUKE_LONG` with `class=SCALP_MAJOR` | Submit split long limit at Pine `entry` | Same order mechanics as scalp, but Pine identified major/Saty/Mancini confluence. |
| `LUKE_LONG` with `class=MANCINI_RECLAIM` | Submit split long limit at Pine `entry` | Larger-context reclaim. Pine supplies wider swing-style TP2 when available. |
| `LUKE_CANCEL` | Cancel working entries and exit any open long | This is the safety escape for live fizzle/cancel events. |
| `LUKE_PING` | No order | Health check only. |

## Current Tested Execution Model

The best-tested model is `confirmed_retest_limit`.

That means Pine does not ask Ninja to market-buy the alert. Pine sends a confirmed long setup, then Ninja rests a buy limit at the planned entry. If price retests that entry, Ninja can fill it. If it does not retest before expiry, Ninja cancels the working entry order.

The current historical test supports this model better than the early watch-entry models. The class-specific order profile therefore does not override Pine's entry, stop, TP1, or TP2. The alert class is preserved so Ninja logs and settings can distinguish scalp versus Mancini reclaim behavior.

## Ninja Defaults

| Setting | Default | Reason |
| --- | ---: | --- |
| `ExecutionMode` | `LimitAtLukeEntry` | Matches `confirmed_retest_limit`. |
| `SplitTp1Tp2Runner` | `true` | One contract exits TP1, one runs to TP2/BE. |
| `MaxQuantity` | `2` | Dry-fire default cap. |
| `ScalpLimitOrderExpirySeconds` | `600` | Mirrors Pine's 10 minute retest expiry. |
| `ManciniReclaimLimitOrderExpirySeconds` | `600` | Kept equal until separate testing proves a longer expiry helps. |
| `MaxSignalsPerSession` | `20` | Allows a busy day without removing the guard. |

## Important Boundary

Ninja is intentionally not inventing different targets or stops from the class name. Pine owns strategy geometry. Ninja owns execution safety: account guard, stale-signal guard, symbol guard, quantity cap, limit expiry, cancel/exit handling, and split order placement.
