# Shareable TradingView Pine

This folder contains sanitized Pine copies that are safe to send outside the local Luke setup.

- `LUKE-WATCH-FLAGSHIP-v4-MANCINI-CONTEXT-NINJA-BRIDGE-SANITIZED.pine`

The sanitized copy keeps the v4 Mancini/Saty signal, accounting, labels, and optional bridge JSON schema. It does not include the local Luke bridge token or any webhook URL, and bridge `alert()` sends are disabled by default.

To use automation, the receiving user must:

1. Paste the script into TradingView.
2. Add it to their chart.
3. Enter their own optional bridge token in script settings.
4. Turn on `Emit user bridge JSON alerts`.
5. Create a TradingView alert using `Any alert() function call`.
6. Paste their own webhook URL into the TradingView alert dialog.

Do not send the live root flagship file unless the private bridge token has been removed first.
