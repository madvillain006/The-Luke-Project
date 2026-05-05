# Senior SWE + Trader Review Packet

Status: legacy baseline review packet. This file is no longer the current audit verdict.

Use these current review documents instead:

- `docs/HOSTILE_AUDIT_REPORT.md`: canonical hostile-audit findings, fixes, remaining risks, proof artifacts, and next fix.
- `docs/REVIEW_READINESS.md`: current readiness scores and claim classifications.
- `docs/LIVE_BLOCKERS.md`: live execution and live-arming blockers.
- `docs/CURRENT_STATUS.md`: short current product state.
- `docs/TRADINGVIEW_INDICATOR.md`: Pine/TradingView-specific safety and parity notes.

## Preserved Baseline Invariants

- No production fake/static current-price assumptions.
- UNKNOWN, missing, stale, delayed, replay-only, or unauthorized market data must stay non-actionable.
- SPX/ES and QQQ/NQ references are confluence/reference context, not silent current-price substitutes.
- `buildTradeDecision(...)` remains the entries-style decision authority.
- `/operator-v2` is read-only and not the default shell.
- Any staged execution remains separate, explicit, and confirmation-gated.
- No direct execution shortcut or operator-v2 execute button is allowed.
- Risk, Apex, open-position, pending-signal, kill, and trading-window gates remain preserved.
- Mancini chop zones are veto/avoid/pass logic, not entries.

## Current Verdict Pointer

`READY_FOR_CODE_REVIEW_NOT_READY_FOR_LIVE`

Do not approve live execution, autonomous staging, stale/latest-close data as live, implicit SPX-to-ES conversion, or Tradovate/live provider readiness without credentialed market-hours proof.
