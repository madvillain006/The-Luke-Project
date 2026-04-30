# ES Long Bracket Backtest Drop Zone

This folder is for the offline ES 3-contract long-only ladder runner. It is not wired into `/entries ES`, PM2, live alerts, or broker execution.

## Existing historical bars

Luke already reads 1-minute bars from:

`C:\Users\conor\luke\data\historical`

Current loader:

`C:\Users\conor\luke\lib\historical-data.js`

Supported formats:

- Flat Barchart exports like `esm26_intraday-1min_historical-data-download-04-27-2026.csv`
- Legacy test layout like `data/historical/2026-04-27/ES_1m.csv`

## Where to drop source material

- `raw\bobby-text\` - Bobby/Richy text dumps for reference and later parser work.
- `raw\bobby-images\` - Bobby heatmap screenshots/images. These are not parsed by the runner yet.
- `raw\dubz\` - Dubz levels or raw notes.
- `raw\mancini\` - Mancini outputs. Current research lane is long-only.
- `raw\saty\` - Saty levels or raw notes.
- `sessions\` - Frozen dated session JSON files that the runner consumes.
- `reports\` - Generated markdown/JSON run outputs.

## Session file shape

Create one JSON file per trading day in `sessions\`, for example:

`sessions\2026-04-27.json`

```json
{
  "date": "2026-04-27",
  "instrument": "ES",
  "rthOnly": true,
  "config": {
    "defaultStopDistancePts": 3,
    "minTargetDistancePts": 0.25,
    "dedupeTolerancePts": 0.25,
    "slippageTicks": 0,
    "commissionPerContract": 0
  },
  "levels": [
    { "price": 7193, "source": "saty", "label": "Saty upper level" },
    { "price": 7196, "source": "mancini", "label": "Mancini upside target" },
    { "price": 7200, "source": "dubz", "label": "Dubz level" }
  ],
  "setups": [
    {
      "id": "2026-04-27-es-7190-reclaim",
      "time": "2026-04-27T09:35:00-04:00",
      "direction": "long",
      "entry": 7190.25,
      "stop": 7187.25,
      "notes": "Manual high-confluence long setup"
    }
  ]
}
```

If a setup omits `targets`, the runner picks the next three levels above entry from `levels`. If a setup omits `stop`, the runner uses `entry - config.defaultStopDistancePts`.

Short setup support is intentionally kept out of this research pass. Non-long setups are skipped and reported.

## Run

```powershell
node scripts\backtest-es-long-bracket.js --session data\backtest\es-long-bracket\sessions\2026-04-27.json --out data\backtest\es-long-bracket\reports\2026-04-27
```

The script writes:

- `<out>.json` - full machine-readable result
- `<out>.md` - human-readable trade-by-trade report

