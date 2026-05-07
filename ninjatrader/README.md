# Luke NinjaTrader SIM Bridge

This is a SIM-first proof bridge. TradingView/Luke remains the signal brain. NinjaTrader only consumes the latest Luke LONG payload and places simulated orders.

## Flow

1. TradingView alert calls Luke:
   `POST http://localhost:3000/webhook/luke-long`
2. Luke validates the LONG payload and writes:
   `C:\Users\conor\luke\data\ninjatrader\latest-luke-signal.json`
3. `LukeAlertBridgeStrategy` polls that file on each realtime tick.
4. The strategy rejects stale/duplicate/non-SIM LONG signals.
5. If allowed, it places NinjaTrader SIM orders.
6. If TradingView later emits `LUKE_CANCEL` for the same signal id, NinjaTrader cancels working entry orders or exits the open SIM long.

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
- `Limit expiry seconds`: `60`
- `Use payload quantity`: `true`
- `Split TP1/TP2 runner`: `true`
- `Max quantity`: `2`
- `Max signals per session`: `10`
- `Require symbol prefix match`: `true`
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
2. Enable `Enable Ninja bridge alert() JSON`.
3. If Luke has `LUKE_NINJA_BRIDGE_TOKEN` set, paste the same value into `Ninja bridge token`.
4. Create an alert with condition `Any alert() function call`.
5. Set the webhook URL to `http://localhost:3000/webhook/luke-long` if TradingView can reach Luke directly, or use the ngrok/public URL that forwards to that local route.
6. The Pine bridge calls use `alert.freq_all` so same-bar LONG then CANCEL messages can both reach Luke.

## Safety

This does not use the existing Tradovate live execution code. Live accounts are blocked unless `Allow live accounts` is manually enabled in NinjaTrader.

The bridge rejects malformed brackets, stale LONG signals, duplicate signal IDs, oversize payload quantities, late LONG payloads for already-cancelled ids, and symbol-family mismatches by default. The Ninja strategy still must be compiled and tested inside NinjaTrader before this can be called proven end to end.
