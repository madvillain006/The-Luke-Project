# TradingView Indicator

Date: 2026-05-04

## What It Does

`tradingview/luke-level-reclaim-watch.pine` is a TradingView visual and alert bridge for Luke level context.

It:

- Computes and plots Saty ATR trigger, fib, ATR, and extension levels in Pine.
- Accepts exported Mancini, Dubz, and heatmap/GEX level input strings.
- Draws Luke source levels as chart-owned horizontal lines.
- Clusters nearby levels with a conservative default tolerance.
- Marks `WATCH`, `ARMED`, `PAPER_CANDIDATE`, and `INVALIDATED` reclaim states.
- Draws visual entry/stop/TP1/TP2 bracket guides for review.
- Emits alertconditions with watchlist-only language.

It is not live execution.

## What It Cannot Do

- It cannot submit orders.
- It cannot connect to a broker.
- It cannot mutate Luke backend state.
- It cannot read user-drawn TradingView horizontal lines.
- It cannot prove live ES candle data for Luke.
- It cannot convert SPX levels into ES using a fixed basis.

## Manual TradingView Lines

Pine cannot reliably read manually drawn TradingView horizontal lines.

Mancini, Dubz, and heatmap/GEX levels must be generated into Pine inputs or into `artifacts/tradingview/luke-level-reclaim-watch.generated.pine`.

## Paste Level Inputs

Run:

```powershell
cmd /c npm run tradingview:export-levels
```

Then open:

```text
artifacts/tradingview/luke-levels-pine-input.txt
```

Paste the listed values into:

- `Mancini levels`
- `Dubz levels`
- `Heatmap/GEX levels`
- `Heatmap/GEX snapshot time`

The generated Pine copy already embeds the current exported strings:

```text
artifacts/tradingview/luke-level-reclaim-watch.generated.pine
```

## Exported Luke Levels

The exporter reads:

- Saty: `data/saty-levels.json`
- Mancini current log: `data/research/mancini/The Mancini Logs 3-15-2026 - 5-3-2026.txt`
- Dubz: `data/dubz-levels.json`
- Heatmap/GEX: `state/events/bobby-context.jsonl`

The Mancini file is currently misnamed: the filename ends `5-3-2026`, but the header says `5-4-2026`. The exporter treats the header as current and documents the alias in export issues.

## Saty ATR

The Pine indicator computes Saty levels from chart data:

- Previous close
- ATR
- Call trigger at `0.236 * ATR`
- Put trigger at `0.236 * ATR`
- Fib extensions at `0.382`, `0.500`, `0.618`, `0.786`
- ATR bands at `1.0 * ATR`

Modes:

- Daily
- Multi-day
- Swing

The local Saty reference file is:

```text
tradingview/saty-atr-levels-source.pine
```

## Mancini Levels

The exporter scans the full edited Mancini log, not just the first visible block.

It scans current Twitter-style and Reddit-style sections, expands shorthand target ladders such as `7248 reclaim sees 53, 64, 85`, filters old sections out of active export, and keeps the full parsed set in JSON for audit.

Current export proof:

- Active Mancini levels: 42
- Full Mancini log parsed levels: 249
- Mancini posts scanned: 280

## Heatmap/GEX Freshness

`heatmap_gex` includes Bobby/GEX/heatmap/Heatseeker/Jefe/mathemeatloaf/Katbot-style heatmap snapshots.

The exporter marks snapshots with:

- `fresh`
- `aging`
- `stale`
- `unknown`

Only active non-stale heatmap/GEX levels are written into the Pine input string. Stale manually pasted heatmap levels do not increase cluster strength in Pine.

## Clustering

Default tolerance:

```text
1.25 ES points
```

Recommended range:

```text
0.75 to 2.0
```

Hard cap:

```text
3.0
```

The clusterer will not merge levels if the final cluster width exceeds tolerance. This protects far rungs such as `7248` and `7258` from becoming one giant level.

Cluster strength:

- One source: thin neutral line
- Two sources: stronger line
- Three or more sources: strongest line
- Fresh heatmap/GEX: teal marker color
- Stale heatmap/GEX: faded/warning behavior

## Alerts

Alert labels are watchlist-only:

- `WATCH`
- `ARMED`
- `PAPER_CANDIDATE`
- `INVALIDATED`

Alert text includes:

```text
LUKE WATCHLIST ONLY - not an order
```

The script intentionally does not say `BUY` or `SELL`.

## Rerun Commands

```powershell
cmd /c npm run tradingview:export-levels
cmd /c npx vitest run tests/tradingview-level-export.test.js tests/pine-level-clustering.test.js tests/mancini-current-log-export.test.js tests/heatmap-gex-normalization.test.js
```

Full verification:

```powershell
cmd /c npm test
cmd /c npm run research:ladder-reclaim
cmd /c npm run market:data:test
```
