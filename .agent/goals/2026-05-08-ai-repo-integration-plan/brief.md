# Luke Subconscious And Auto-Build Roadmap

## Objective

Refresh the active Luke goal plan so future agents can resume the Subconscious and auto-build roadmap safely, using the Hermes pattern as source inspiration without importing Hermes/OpenClaw/MemPalace/Qlib as runtime dependencies.

## Operating Policy

- `Process_narration=false`.
- Measure twice, cut once policy: inspect current files and nearby tests before editing.
- Keep the codebase clean: no tmp files, no dead code, no dead files, no unnecessary folders, subfolders, or files.
- Subconscious signals are review-only and cannot become Coder jobs without Main approval.
- A thought is not a task. A build marker is not approval.
- Auto-build cannot be implemented until signal board, Main approval, Coder job state, QA packet, runtime monitor, sprint lock, rollback path, and tests exist.

## No-Touch Boundaries

Do not touch without explicit named approval:

- `trading/`
- `tradingview/`
- `ninjatrader/`
- `lib/market-hours.js`
- `trading/router.js`
- `trading/signals.js`
- `trading/risk.js`
- `agents/agent-14-kat.js`
- `lib/kat*`
- broker/account routing
- broker/auth/token/credential/execution paths
- `.env`
- `state/events/`
- `state/snapshots/`

## Already Landed

- `AGENTS.md` contains the required operating posture and trading safety rules.
- `docs/HERMES_SUBCONSCIOUS_SOURCE_ROADMAP.md` records the source timeline and architecture.
- `docs/LUKE_SUBCONSCIOUS_AUTOBUILD_ROADMAP.md` records the Luke-native adaptation roadmap.
- `docs/LUKE_SUBCONSCIOUS_PROPOSAL_SCHEMA.md` defines the review-only proposal packet and dry-run/write-gate requirements.
- `lib/reference-repo-registry.js` exists as an idea-only reference registry.
- `lib/radar/ingest.js` supports the `reference_idea` / `review_only` lane and `trading_authority: none`.
- `lib/paths.js` centralizes `state/events/` and `state/snapshots/` conventions.
- `agents/agent-00-brain.js` exposes Radar/report seams, but reports are evidence only and not approval.
- `tests/autonomous-recommendation-only.test.js` protects recommendation-only trading posture.
- `reports/luke-ai-repo-integration-plan-2026-05-08.md` records baseline evidence.

## Known Loopholes To Close Before Runtime Work

- `recordRadarIngest()` currently writes runtime state immediately and rebuilds snapshots.
- `recordRadarReview()` currently writes runtime state and snapshots.
- Brain `/radar/ingest` and `/radar/review` are live write routes without a Subconscious dry-run gate.
- Brain `/agent/brain/report` can record subagent reports; those reports must never count as Main approval.
- Radar does not yet have a dedicated `subconscious_signal` source type, so Phase 3 must use `reference_idea` review-only mapping or explicitly justify a later schema change.
- Package scripts include write-capable and sensitive surfaces; inspect scripts before running PM2, Ninja, Pine, broker, credential, market-data, or install commands.

## Phase Map

0. Baseline and safety freeze: completed. Evidence is in `reports/luke-ai-repo-integration-plan-2026-05-08.md`.
1. Reader and operator roadmaps: completed. Evidence is in the Hermes and Luke roadmap docs.
2. Active goal plan refresh: completed by this pass. Evidence is this directory's `goals.json`, `brief.md`, and `ledger.jsonl`.
3. Review-only Subconscious signal schema: next. Keep it offline/review-only and prove no Coder job or production runtime state write.
4. Signal board snapshot: blocked until Phase 3 evidence exists and dry-run/write gates are defined.
5. Main approval and Coder job boundary: blocked until the board exists; Main approval must be a separate artifact.
6. QA and recovery loop: blocked until job states exist; QA packet must include changed files, tests, skipped tests, protected paths, proof, and rollback.
7. Runtime monitor: blocked until QA loop exists; monitor may stop/report only and must not silently patch.
8. Scheduled auto-think: blocked until monitor and write gates exist; no code writing or approval authority.
9. Gated auto-build: blocked until signal board, Main approval, Coder job state, QA packet, runtime monitor, sprint lock, rollback path, and tests all exist.

## Validation Rules

- Before continuing any phase, run `git status --short --branch`.
- Confirm changed files are limited to that phase's allowed paths.
- Stop if protected paths appear in `git diff --name-only` without explicit approval.
- Use temporary paths for dry-run tests before any production state write support.
- Run focused tests for touched code. If no runtime code changes, JSON parse and diff review are enough.

## Next Chunk

Implement Phase 3 only after a fresh baseline check: create or refine the review-only Subconscious proposal schema and dry-run/write-gate requirements. Do not write runtime state and do not implement auto-build.
