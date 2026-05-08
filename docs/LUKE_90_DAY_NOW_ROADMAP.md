# Luke 90-Day Roadmap, Starting Now

Date: 2026-05-08 ET

This is the canonical implementation roadmap for turning the current Luke build into the three-month target state now, without pretending external gates are already solved.

## Product Rule

Luke is the front-facing companion system. The shell is the home surface. Back/control dashboards are drilldowns only.

Every new feature must feed this loop:

1. Capture source material.
2. Preserve provenance.
3. Summarize into reviewable context.
4. Surface the right item in Daily, Radar, or Trading.
5. Require proof before anything becomes trusted.
6. Keep trading human-gated.

## Implemented In This Roadmap Pass

- Radar source typing for Sybil, Katbot, voice notes, articles, links, screenshots, Pine/trading notes, reminders, and manual pastes.
- Radar dedupe by source type, label, URL, and text hash.
- Radar relationship IDs for connecting source items to Saty, Mancini, Pine, Katbot, or other context.
- Radar append-only review log with states: `new`, `reviewing`, `accepted`, `contradicted`, `archived`.
- Radar on-demand evidence detail route for raw text and review history.
- Radar custom review notes and next actions from the front UI.
- Compact Radar snapshots for UI and Daily so polling does not resend full raw text.
- Radar source health/freshness in the snapshot.
- Radar front UI source health panel and recent-inbox filters.
- Radar source-quality scaffolding from accepted, contradicted, and archived review outcomes.
- Daily/Radar integration so Daily sees review counts and top review items.
- Daily/Radar reminder carry-through.
- Daily brief integration so Radar review items appear ahead of news sections.
- Radar and Daily briefs prioritize contradictions ahead of ordinary review items.
- Front shell keeps one route per visible destination and shows Radar summary on the Radar tile.
- Front-shell memorial text remains on the topbar.
- Shared companion memory added for Luke Chat and Trading at `state/snapshots/memory.json` under `luke_companion_memory`.
- Deterministic memory answers added for appointment/reminder/thought questions before the generic LLM path.
- Typo-aware command recovery added for known Luke commands, with system chat still blocking trading commands.
- Professional repo-facing folder labels added through top-level README files.
- Pine inventory and flagship promotion gate documented in `docs/PINE_INVENTORY_AND_FLAGSHIP_GATE.md`.
- Runnable Pine inventory generator added as `cmd /c npm run tradingview:inventory`.
- Focused `prove:radar-daily-loop` proof command for Radar capture, review, compact snapshots, Daily Radar context, and Daily brief ordering.

## Current Proof Commands

Run these after Radar, Daily, shell, or trading-path edits:

```powershell
npx vitest run
npm run prove:radar-daily-loop
npm run prove:companion-memory
npm run prove:luke-ui-ux
git diff --check
```

When Vite hits Windows sandbox `spawn EPERM`, rerun the same Vitest command outside the sandbox with approval.

## Next Local Work

- Add source-quality reporting into Daily after enough review outcomes exist.
- Add richer shared-memory editing controls only if the current deterministic memory loop proves useful in daily use.

## External Gates

These are not done until proven separately:

- TradingView compile and visual signoff for the selected Pine flagship.
- Parallel trading-brain merge and review.
- Live/delayed ES 1m OHLC provider entitlement and freshness proof.
- Broker/Ninja/Tradovate live execution proof packet.
- Any live execution path.

## Non-Negotiables

- No duplicate front routes for the same destination.
- No backend dashboard as the main user surface.
- No raw source text in polling snapshots unless a route explicitly asks for raw evidence.
- No trading execution authority from Radar, Daily, Pine, or the shell.
- No unstated promotion from research/watchlist to trade action.
