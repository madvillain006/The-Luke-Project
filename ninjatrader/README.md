# Luke NinjaTrader SIM Bridge

This is a SIM-first proof bridge. TradingView/Luke remains the signal brain. NinjaTrader only consumes the latest Luke LONG payload and places simulated orders.

## Flow

1. TradingView alert calls Luke:
   `POST http://localhost:3000/webhook/luke-long`
2. Luke validates the LONG payload and writes:
   `C:\Users\conor\luke\data\ninjatrader\latest-luke-signal.json`
3. `LukeAlertBridgeStrategy` polls that file on each realtime tick and on its bridge timer.
4. The strategy rejects stale/duplicate/non-SIM LONG signals and any limit entry more than the configured entry-distance window from current price.
5. If allowed, it places NinjaTrader SIM orders.
6. If TradingView later emits `LUKE_CANCEL` for the same active signal id, NinjaTrader cancels working entry orders or exits the open SIM long.

## Payload

```json
{
  "id": "luke-long-2026-05-07T10:31:00-04:00-7395.25",
  "symbol": "ESM26",
  "side": "LONG",
  "entry": 7395.25,
  "stop": 7392.25,
  "tp1": 7397.25,
  "tp2": 7400.00,
  "qty": 2,
  "timestamp": "1778164260000",
  "bar_time": "1778164200000",
  "token": "optional-if-Luke-env-requires-it"
}
```

Cancel payloads use the same signal id:

```json
{
  "id": "luke-long-1778164260000-18-7395.25",
  "type": "LUKE_CANCEL",
  "side": "CANCEL",
  "symbol": "ESM26",
  "timestamp": "1778164270000",
  "reason": "live_cancel"
}
```

## NinjaTrader Defaults

- `Execution mode`: `LimitAtLukeEntry`
- `Allow live accounts`: `false`
- `Max signal age seconds`: `20`
- `Limit expiry seconds`: `600`
- `Use payload quantity`: `true`
- `Split TP1/TP2 runner`: `true`
- `Bridge poll milliseconds`: `50`
- `Max quantity`: `2`
- `Live bridge arm phrase`: blank
- `Max signals per session`: `20`
- `Require symbol prefix match`: `true`
- `Require cancel matches active signal`: `true`
- `Max entry distance points`: `0.25`
- Runner stop moves to breakeven after price reaches TP1 when split runner mode is on.

## Install

The working NinjaScript source is:

`C:\Users\conor\luke\ninjatrader\LukeAlertBridgeStrategy.cs`

The copied NinjaTrader script path is:

`C:\Users\conor\OneDrive\Documents\NinjaTrader 8\bin\Custom\Strategies\LukeAlertBridgeStrategy.cs`

Open NinjaTrader, compile NinjaScript, then add `LukeAlertBridgeStrategy` to an ES chart using `Sim101` first.

The Pine version that emits dynamic Ninja bridge JSON is:

`C:\Users\conor\luke\tradingview\LUKE-WATCH-FLAGSHIP-v4-MANCINI-CONTEXT-NINJA-BRIDGE.pine`

In TradingView:

1. Paste that Pine copy.
2. If Luke has `LUKE_NINJA_BRIDGE_TOKEN` set, paste the same value into `Ninja bridge token`.
3. Create an alert with condition `Any alert() function call`.
4. Set the webhook URL to `http://localhost:3000/webhook/luke-long` if TradingView can reach Luke directly, or use the ngrok/public URL that forwards to that local route.
5. The Pine bridge calls use `alert.freq_all` so same-bar LONG then CANCEL messages can both reach Luke, while Pine suppresses duplicate same-bar/same-entry LONG spam while a pending live signal is already active.
6. Pine and Ninja both enforce a `0.25` point live entry-distance guard by default. If TradingView delivers a signal after price has already moved away from the intended entry, the alert is blocked in Pine or rejected in Ninja.

## Safety

This does not use the existing Tradovate live execution code. The TradingView bridge is no longer the production execution path because TradingView alert delivery is too slow for the edge. Luke now rejects bridge `LONG` writes unless `LUKE_NINJA_BRIDGE_ACCEPT_LONGS=true` is set for an intentional fallback test. Ping and cancel diagnostics still work.

The Ninja strategy is also fail-closed for live accounts: `Allow live accounts=true` is not enough by itself. A live account must also match `Allowed exact account`, and `Live bridge arm phrase` must be exactly `LUKE_BRIDGE_LIVE_ACK`. Without all three, the strategy accepts only `Sim*` and `Playback*` accounts.

The bridge rejects malformed brackets, stale LONG signals, duplicate signal IDs, oversize payload quantities, late LONG payloads for already-cancelled ids, live accounts without the full arm gate, and symbol-family mismatches by default. The Ninja strategy still must be compiled and tested inside NinjaTrader before this can be called proven end to end.

`npm run ninja:bridge:doctor` is ping-only by default. `--order-test` is blocked unless `LUKE_NINJA_ORDER_TEST_ACK=I_ACCEPT_NINJA_ORDER_TEST_RISK` is set for that shell, because order-test intentionally writes a LONG and CANCEL payload for Ninja to consume.

## Ninja-Native Shadow Port

The Ninja-native port target is:

`C:\Users\conor\luke\ninjatrader\LukeNativeShadowStrategy.cs`

This is a separate strategy from `LukeAlertBridgeStrategy`. It does not read TradingView alerts. It calculates the Luke reclaim/watch state from Ninja tick data, writes telemetry, displays a Pine-style session ledger overlay on the Ninja chart, and can submit native LONG limit orders only when the operator explicitly selects `SimExecution` or `LiveGuarded`.

Saty levels are derived inside Ninja from the chart instrument's daily series with the same `close[1]` and ATR(14)[1] formula used by the locked flagship Pine. The level file is only for external Mancini prices.

Default telemetry path:

`C:\Users\conor\luke\state\events\ninja-native-shadow.jsonl`

Default Pine bridge comparison path:

`C:\Users\conor\luke\state\events\ninjatrader-bridge.jsonl`

Default external Mancini level input path:

`C:\Users\conor\luke\data\ninjatrader\luke-native-levels.txt`

The level file can contain comma-separated or newline-separated Mancini prices. Example:

```text
7413.00, 7418.25, 7421.00
7432.50
```

### Install Into NinjaTrader

1. Run the dry install check:
   `npm run ninja:native:install:dry`
2. If the dry run shows only the expected copy/project actions, run:
   `npm run ninja:native:install`
3. Export the current external Mancini level file:
   `npm run ninja:native:levels`
4. In NinjaTrader, open NinjaScript Editor.
5. Compile.
6. Add `LukeNativeShadowStrategy` to the ES chart.
7. Leave `Autonomy mode` as `Shadow` for proof runs. Use `SimExecution` only for SIM/Playback order tests. Use `LiveGuarded` only after setting `Allow live accounts=true` and confirming the exact account name.
8. Confirm `Level file path` points at `C:\Users\conor\luke\data\ninjatrader\luke-native-levels.txt`.
9. Confirm `Telemetry file path` points at `C:\Users\conor\luke\state\events\ninja-native-shadow.jsonl`.
10. Confirm `Show parity ledger overlay` is `true`.
11. Confirm `Pine bridge events path` points at `C:\Users\conor\luke\state\events\ninjatrader-bridge.jsonl`.
12. Enable the strategy.
13. Run:
   `npm run ninja:native:telemetry`
14. Run the today parity ledger:
    `npm run ninja:parity:ledger`

### Chart-Only Parity Overlay

Use this when the goal is to visually compare Ninja against the TradingView ledger without enabling orders.

1. Export operator-context levels:
   `npm run ninja:parity:levels`
2. Install the overlay source:
   `npm run ninja:parity:overlay:install`
3. In NinjaTrader, open NinjaScript Editor and compile.
4. Open an ES 06-26 5-minute chart with at least 60 days loaded, then run `Reload All Historical Data`.
5. Add `LukeParityOverlayIndicator`.
6. Confirm `Level file path` is `C:\Users\conor\luke\data\ninjatrader\luke-native-levels.txt`.
7. Confirm `Level window points` is near `80` so the chart shows the current useful ladder instead of every archived level.
8. The overlay is chart-only. It has no order APIs. Yellow means a Mancini/Saty overlap; blue/green/red/purple/gray show the underlying source family.

Expected first proof after enabling: `ENGINE_READY`, then `LEVELS_LOADED`, then the top-right `LUKE NATIVE SESSION LEDGER` overlay. The overlay mirrors the TradingView scorecard rows: `score incl cxl`, `watch/long/cxl`, `misses incl cxl`, `milestones`, `gross total`, `minus comm`, `realistic net`, `cxl net`, and `mode/costs`. `LEVELS_LOADED` can be zero if there are no Mancini levels; Saty is still available from the internal daily calculation once Ninja has enough daily bars.

Native execution submits only limit-at-entry LONG orders. The order gate blocks stale/chase cases where the current Ninja price is more than `0.25` points away from the computed Pine-style entry, blocks non-flat state by default, blocks live accounts by default, and writes `ORDER_BLOCKED` with the reason instead of pretending the signal was valid.

The Ninja chart overlay is the quick operator view for the same session-ledger read that TradingView shows. The file report is the cross-system parity authority:

`C:\Users\conor\luke\artifacts\research\ninja-parity-today\<date>\ledger.md`

Promotion rule: do not advance beyond shadow/SIM unless the parity ledger is `clean`, with no `missing_native`, `native_only`, or `geometry_mismatch` rows for executable LONG/CANCEL events.

### Repo Checks

Run these before copying a changed version into NinjaTrader:

```powershell
npm run ninja:native:check
npm run ninja:parity:ledger
npm run ninja:bridge:latency
npx vitest run tests/ninjatrader-alert-bridge.test.js tests/ninja-bridge-latency.test.js tests/ninja-native-telemetry.test.js tests/ninja-native-source.test.js tests/ninja-native-level-export.test.js tests/ninja-native-install.test.js tests/ninja-parity-ledger.test.js tests/saty-pine-watch-backtest.test.js
```

`npm run ninja:native:check` must report:

```text
source_status=clean
no_banned_order_calls=true
order_calls_gated=true
ready_to_install=true
```
