# Luke Watch v5 Mancini Protocol Implementation Audit

Generated: 2026-05-07

## Base

- Source preserved: `tradingview/LUKE-WATCH-FLAGSHIP-v4-MANCINI-CONTEXT-NINJA-BRIDGE.pine`
- New candidate: `tradingview/LUKE-WATCH-FLAGSHIP-v5-MANCINI-PROTOCOL-SCALP-SWING.pine`
- Existing v4 scalp engine remains the base. v5 adds context routing around it.

## Implemented Protocol Changes

1. Mancini metadata is no longer visual-only in `context_aware` mode.
2. Target-only levels are excluded from LONG automation.
3. Caution/read-reaction levels default to manual-only: WATCH/context can show, LONG is blocked.
4. Explicit focus/reclaim levels become `MANCINI_RECLAIM`.
5. `MANCINI_RECLAIM` keeps TP1 behavior but gives TP2 a larger runner target:
   - next pasted target-only level above entry, or
   - fallback `mancini_swing_runner_points`.
6. Reclaim swing entries require completed 1m acceptance before firing intrabar.
7. Chart-timeframe acceptance fallback only counts on confirmed bars.
8. WATCH edge detection is now level-aware, so a new WATCH level is not suppressed merely because any WATCH fired on the previous bar.
9. Ninja bridge JSON now includes `"class"` for downstream scalp vs swing handling.
10. Added a separate `LUKE MANCINI RECLAIM` alertcondition for swing-class alerts.

## Anti-Cheat Checks

- No same-bar acceptance shortcut was added.
- 1m acceptance uses completed lower-timeframe closes.
- Current unconfirmed 5m close cannot satisfy swing acceptance by itself.
- Existing Saty previous-close logic was not changed.
- The script remains an `indicator`, not a `strategy`.
- Static bracket balance check passed after implementation.

## Known Boundary

TradingView Pine compilation still must be done in TradingView. Local checks can prove structure and intended no-lookahead wiring, but not TradingView compiler acceptance.
