# Luke Repo Completion And Cleanup Plan

## Objective

Bring Luke from a cleaned read-only/replay trading companion into a durable, organized, reviewable project state. Keep live execution blocked until live data, broker state, and human signoff are proven.

## Current Truth

- `docs/HOSTILE_AUDIT_REPORT.md` is the canonical audit verdict.
- `docs/CURRENT_STATUS.md` is the short operating snapshot.
- Generated audit outputs belong under `artifacts/`, not as new top-level docs.
- Luke is not live-ready. This plan must preserve read-only/replay boundaries.
- Existing PM2 apps are `luke-server` and `luke-scheduler`.
- Sacred trading smoke paths remain `/status`, `/balance`, `/saty`, `/ready`, and `/alert`.

## Constraints

- Do not weaken live/replay separation.
- Do not turn any research rule into live execution.
- Do not delete user data, credentials, local runtime state, or ignored artifacts unless explicitly scoped and reviewed.
- Prefer consolidation and clear source-of-truth docs over adding more audit files.
- Keep changes reviewable in small, verifiable slices.

## Non-Goals

- No live trading enablement without a separate proof phase.
- No broker automation approval.
- No claim that TradingView Pine is compiled until a human verifies it in TradingView.
- No large rewrite of `lib/slash-commands.js` until safety smoke coverage is green.

## Ordered Goal Summary

1. Baseline and repo map.
2. Documentation and artifact source-of-truth cleanup.
3. Runtime/process stability and launcher hygiene.
4. Dashboard/UI/UX audit and repair.
5. Trading safety boundary hardening.
6. Research/Pine/watchlist consolidation.
7. State/data/storage hygiene.
8. Test/proof command consolidation.
9. Final review packet and missing-piece list.

## Acceptance And Validation

- `git status --short` is understood before every destructive move.
- Canonical docs are named and linked from `docs/README.md`.
- Generated reports write to ignored artifact locations unless explicitly promoted.
- PM2 reload succeeds and `/api/health` returns Luke on port 3000.
- Focused and full test suites pass or failures are documented with exact commands and error text.
- Final report lists what remains missing other than live data.

## Assumptions And Risks

- Some current tracked proof packs under `reports/` may be intentionally retained evidence; move them only after confirming replacement artifact paths and tests.
- Some duplicate-looking research modules are separate historical strategy versions; archive only with evidence.
- Network and TradingView compilation checks may require manual/human steps outside Codex.
- Windows sandbox may block `npx vitest`; use `cmd /c npx vitest run` outside sandbox if needed.

## Goal-Mode Prompt

Use this prompt for the longer multi-agent pass:

```
You are taking over C:\Users\conor\luke after the May 5 cleanup commit. Work in goal mode. Use multiple focused agents for independent repo sections, then integrate only reviewed changes. The mission is to finish Luke as a clean, organized, read-only/replay trading companion while preserving live-execution blocks.

Rules:
- Start with `git status --short`, `git diff --stat`, and `git log --oneline -10`.
- Treat `docs/HOSTILE_AUDIT_REPORT.md` as the canonical audit and `docs/CURRENT_STATUS.md` as the short snapshot.
- Do not create new top-level audit docs for generated run output. Generated reports go under `artifacts/` unless promoted into a canonical doc.
- Keep live execution blocked. Do not promote research/watchlist signals to live readiness.
- Protect `/status`, `/balance`, `/saty`, `/ready`, and `/alert`.
- Keep every cleanup reversible until the exact paths and reasons are reported.

Agent lanes:
- Docs/artifacts agent: remove duplicate docs, consolidate source-of-truth links, and keep generated reports out of `docs/`.
- Runtime/process agent: inspect launchers, PM2, Electron, proof scripts, shell spawning, and state paths.
- Trading safety agent: inspect broker/live/paper/shadow paths, gates, slash commands, and operator APIs.
- UI/UX agent: inspect `/shell`, `/operator-v2`, `/trading-window`, `/brain-dashboard`, responsive layout, and read-only affordances.
- Research/Pine agent: inspect ladder reclaim, fake breakdown, Saty/Pine, TradingView exports, slippage tests, and artifact placement.
- Test/proof agent: rationalize test/proof commands and identify a minimal daily smoke plus full verification suite.

Deliverables:
- Small commits per coherent cleanup slice.
- A final `docs/CURRENT_STATUS.md` update only after the canonical audit agrees.
- A missing-piece report split into live-data blockers, non-live missing work, manual human checks, and optional future improvements.
- A final verification record with exact commands and outcomes.
```
