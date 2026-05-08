# Pine Inventory And Flagship Gate

Date: 2026-05-08 ET

This doc exists so the Pine work does not turn into filename archaeology. It is an inventory and gate, not compile proof.

For the generated source inventory, run:

```powershell
cmd /c npm run tradingview:inventory
```

Generated output:

- `docs/PINE_INVENTORY_GENERATED.md`
- `artifacts/proof/pine-inventory/pine-inventory.json`

## Current Rule

Pine files are visual/watchlist/research until a specific file is compiled in TradingView, visually checked, alert-checked, and promoted in writing.

No Luke route, Radar item, Daily brief, or trading-brain output may treat Pine as execution authority.

## Current Candidate Families

### Level Reclaim Base

- `tradingview/luke-level-reclaim-watch.pine`
- `tradingview/luke-level-reclaim-watch-realistic-accounting.pine`
- `tradingview/luke-level-reclaim-watch-hardmode.strategy.pine`

Use these as historical/reference implementations for realistic accounting, same-bar policy, and hardmode research.

### Production Test / Ledger Family

- `tradingview/luke-watch-production-test.pine`
- `tradingview/luke-watch-production-test-readable-ledger.pine`
- `tradingview/luke-watch-production-test-readable-ledger-v4-es-ledger-qol.pine`
- `tradingview/luke-watch-production-test-readable-ledger-v4-ltf-1m-gate.pine`
- `tradingview/luke-watch-production-test-readable-ledger-v4-ltf-3m-gate.pine`
- `tradingview/luke-watch-production-test-readable-ledger-v4-ltf-1m-3m-5m-gate.pine`
- `tradingview/luke-watch-production-test-readable-ledger-v4-ltf-audit-gate.pine`
- `tradingview/luke-watch-production-test-readable-ledger-v4-noncheat-fill-gate.pine`
- `tradingview/luke-watch-production-test-readable-ledger-v4-noncheat-light.pine`
- `tradingview/luke-watch-production-test-simulation.strategy.pine`

Use these for audit behavior and readable ledger comparisons. Do not promote the simulation strategy as live behavior.

### Luke Watch Candidate Family

- `tradingview/LUKE-WATCH-BEST-WORKING-v4-LTF-1m-3m-5m.pine`
- `tradingview/LUKE-WATCH-BETTER-UI-BEST-v4-LTF-1m-3m-5m-CONFIRMED-SAVED.pine`
- `tradingview/LUKE-WATCH-BEST-LIVE-EXECUTION-v4-LTF-1m-3m-5m.pine`
- `tradingview/LUKE-WATCH-BEST-CLEAN-SPLIT-v4-LTF-1m-3m-5m.pine`
- `tradingview/LUKE-WATCH-BEST-CLEAN-SPLIT-v4-VISIBLE-LEVELS-LIVE-CXL.pine`
- `tradingview/LUKE-WATCH-FLAGSHIP-v4-CANCEL-ACTIVE-WATCH.pine`
- `tradingview/LUKE-WATCH-FLAGSHIP-v4-MANCINI-SATY-ONLY-TRUSTED-RESTORE.pine`
- `tradingview/LUKE-WATCH-FLAGSHIP-v4-MANCINI-CONTEXT-LEGEND-TRUSTED.pine`
- `tradingview/LUKE-WATCH-FLAGSHIP-v4-MANCINI-CONTEXT-NINJA-BRIDGE.pine`
- `tradingview/LUKE-WATCH-FLAGSHIP-v5-DAILY-PLAN-QUALITY.pine`
- `tradingview/LUKE-WATCH-FLAGSHIP-v5-LIGHT-DAILY-PLAN-QUALITY.pine`
- `tradingview/LUKE-WATCH-FLAGSHIP-v5-MANCINI-PROTOCOL-SCALP-SWING.pine`
- `tradingview/LUKE-WATCH-FLAGSHIP-v6-EXEC-ONLY-WATCH-RECOVERY.pine`
- `tradingview/LUKE-WATCH-FLAGSHIP-v6-LIGHT-WATCH-RECOVERY.pine`
- `tradingview/LUKE-WATCH-FLAGSHIP-v6-USABLE-WATCH-RECOVERY.pine`
- `tradingview/LUKE-WATCH-v6-VISUAL-COMPANION-LEVELS.pine`

This is the likely flagship-selection family. Pick one flagship and one recovery/experimental branch only after compile/signoff.

### Mancini Confirmed Retest Candidate Family

- `tradingview/LUKE-MANCINI-FLAGSHIP-v6-CONFIRMED-RETEST-LIMIT-NINJA-DRYFIRE.pine`
- `tradingview/LUKE-MANCINI-FLAGSHIP-vA-CONFIRMED-RETEST-LIMIT-NINJA-DRYFIRE.pine`

Treat `vA` as the current local replacement candidate only after TradingView compile/signoff. It is still visual/watchlist/research until promoted in writing.

### Supporting Sources

- `tradingview/saty-atr-levels-source.pine`
- `tradingview/LUKE-OPTIONS-MANCINI-TRIGGER-v1.pine`

Use these as context/source components, not as default front-facing Luke Watch files.

## Promotion Checklist

1. Choose one candidate file and record why.
2. Compile it in TradingView with the exact symbol/timeframes it claims to support.
3. Verify labels, levels, alerts, and visibility on desktop chart.
4. Verify it does not imply live execution if it is only visual/watchlist.
5. Export or screenshot proof.
6. Update this doc with the promoted file, date, and proof artifact.
7. Archive or explicitly park the replaced variants.

## Current Promotion Status

No Pine file is promoted to trusted flagship in this doc yet.

Current allowed use: visual/watchlist/research only.
