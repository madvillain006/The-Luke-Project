# TradingView Pine

Root rule: the only front-facing Pine file in this folder is the current live-test source:

- `LUKE-WATCH-FLAGSHIP-v4-MANCINI-CONTEXT-NINJA-BRIDGE.pine`

Historical variants live under `history/` by family. Supporting/reference scripts live under `support/`.
Sanitized copies for outside sharing live under `share/`; these are not the active local trading source.

The generated inventory in `docs/PINE_INVENTORY_GENERATED.md` scans this tree recursively. Do not promote a historical file back to active use without updating `docs/PINE_INVENTORY_AND_FLAGSHIP_GATE.md`.
