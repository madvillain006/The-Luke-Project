# Pine Inventory And Flagship Gate

Date: 2026-05-08 ET

This doc exists so the Pine work does not turn into filename archaeology. It records the current live-test Pine source, where historical variants live, and the checks required before any Pine variant is treated as more than a supervised signal source.

For the generated source inventory, run:

```powershell
cmd /c npm run tradingview:inventory
```

Generated output:

- `docs/PINE_INVENTORY_GENERATED.md`
- `artifacts/proof/pine-inventory/pine-inventory.json`

## Current Live-Test Pine

Use this file for the current v4 Mancini/Saty reclaim strategy and Ninja SIM bridge test:

- `tradingview/LUKE-WATCH-FLAGSHIP-v4-MANCINI-CONTEXT-NINJA-BRIDGE.pine`

Why this one stays live:

- It is the user-selected/currently running version.
- Its header records the v4 trade math baseline and says Mancini context is visual-only.
- It emits Ninja bridge JSON from the same `trade_long_event` that creates the LONG box.
- It keeps the TradingView script as an `indicator()`, not a `strategy()`, so order placement remains outside Pine.
- The documented bridge route in `ninjatrader/README.md` points to this exact file.

Current readiness:

- Luke local webhook accepted the non-order bridge doctor ping on `2026-05-08`.
- NinjaTrader did not report seeing that ping during the same doctor run, so end-to-end SIM fill tracking still requires NinjaTrader to be compiled/enabled and polling `data/ninjatrader/latest-luke-signal.json`.

## Current Rule

The current live-test file may drive supervised Ninja SIM bridge testing only. It is not autonomous execution authority.

No historical Pine file may be used as the default TradingView source unless it is explicitly promoted here with a date, reason, and test evidence.

All historical scripts remain visual/watchlist/research only.

## Historical Layout

### Ninja Bridge Experiments

- `tradingview/history/ninja-bridge/watch-experiments/`
- `tradingview/history/ninja-bridge/confirmed-retest-router/`

These files include bridge-capable or Ninja-adjacent experiments, including `v0b`, `v5`, `vA`, `OBJECTIVITY`, and `vB`. They are intentionally parked because they changed too much at once or are not the current profitable baseline.

### Pre-Ninja Watch Variants

- `tradingview/history/pre-ninja/v4-watch-family/`
- `tradingview/history/pre-ninja/quality-recovery/`

These files are historical watch/recovery/quality variants before the current v4 Ninja bridge choice.

### Research And Ledger Harnesses

- `tradingview/history/level-reclaim/`
- `tradingview/history/production-ledger/`

These files are research, readable-ledger, and strategy/backtest harnesses. Do not use them as the front-facing Pine source.

### Supporting Sources

- `tradingview/support/saty-reference/`
- `tradingview/support/options-context/`

These are supporting/reference Pine sources, not default live-test scripts.

## Promotion Checklist

1. Choose exactly one candidate file.
2. Compile it in TradingView with the exact symbol/timeframes it claims to support.
3. Verify labels, levels, alerts, visibility, and session panel behavior.
4. Verify `Any alert() function call` emits valid JSON to `/webhook/luke-long`.
5. Run `cmd /c npm run ninja:bridge:doctor` and confirm Ninja sees the ping.
6. If doing an order test, use SIM only and record the Ninja log evidence.
7. Update this doc with the promoted file, date, and proof artifact.
8. Move the replaced variant back under `tradingview/history/...`.
