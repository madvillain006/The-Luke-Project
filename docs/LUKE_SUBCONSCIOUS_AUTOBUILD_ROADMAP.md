# Luke Subconscious And Auto-Build Roadmap

Date: 2026-05-10

Purpose: define a safe Luke-native roadmap for adapting the Hermes Subconscious and Auto-build pattern without weakening Luke's trading safety, dirty-worktree protection, or codebase hygiene.

## Current Confidence

I am not 100% confident in the original strategy as written.

Reason: "full permissions" plus "force parallel agents to act" is too broad for a dirty live trading decision-support repo. The current Luke tree has modified files in trading-adjacent, Pine, NinjaTrader, Radar, LLM routing, and test surfaces. Broad autonomous execution can overwrite user work, create clutter, loop, or touch high-risk surfaces.

I am confident in the revised strategy below because it turns the idea into gated, review-only, Luke-native milestones before any build automation.

## Hard Rules For This Roadmap

- `Process_narration=false`: updates stay short and operational.
- Measure twice, cut once policy: inspect files, nearby tests, and current dirty state before edits.
- Keep the codebase clean: no tmp files, no dead code, no dead files, no unnecessary folders, subfolders, or files.
- Dirty worktree protection: do not overwrite, normalize, or revert unrelated user changes.
- Reference systems are idea sources only unless explicitly wired in.
- No automatic reference ingestion.
- No runtime dependencies from Hermes, OpenClaw, MemPalace, Qlib, or similar systems without explicit approval.
- No live trading behavior during research, replay, parser, UI, memory, Radar, or context work.
- Pine, NinjaTrader, market-hours, broker/account routing, risk, credentials, and execution gates are no-touch unless the operator explicitly names and approves that surface.

## No-Touch Boundary For Early Work

Until explicitly approved, do not edit:

- `trading/`
- `tradingview/`
- `ninjatrader/`
- `lib/market-hours.js`
- `trading/router.js`
- `trading/signals.js`
- `trading/risk.js`
- broker, credential, auth, token, and execution paths
- `.env`
- generated runtime state under `state/events/` and `state/snapshots/`

Allowed early surfaces:

- `docs/`
- `.agent/goals/<approved-plan>/`
- read-only inspection of `agents/`, `lib/radar/`, `lib/brain/`, `lib/companion-memory.js`, `lib/luke-context-bins.js`, `lib/paths.js`, and tests

## Existing Luke Fit

Luke already has many of the safe pieces needed for this pattern.

- `AGENTS.md` already carries friendly collaboration, `Process_narration=false`, measure twice/cut once, clean codebase rules, and trading safety boundaries.
- `.agent/PLANS.md` already defines self-contained, verifiable plan requirements.
- `.agent/goals/2026-05-08-ai-repo-integration-plan/` already contains a durable integration plan.
- `lib/reference-repo-registry.js` already treats external repos as idea sources and bans trading execution and broker surfaces.
- `lib/radar/ingest.js` already supports review-only `reference_idea` items, review states, source health, and snapshots.
- `lib/paths.js` already uses `state/events/*.jsonl` for append-only logs and `state/snapshots/*.json` for current board state.
- `agents/agent-00-brain.js` already accepts subagent reports through `/agent/brain/report`.
- `tests/autonomous-recommendation-only.test.js` already protects the recommendation-only posture for autonomous trading.

Implication: Luke should not start by adding a new autonomous runtime. It should start by extending the existing review and state workflow.

## Loopholes Found And Fixes

### Loophole 1: Full Permissions Can Override Safety

Risk: agents interpret "full permissions" as permission to edit trading, Pine, NinjaTrader, broker, risk, secrets, or execution surfaces.

Fix: full permissions means full effort inside approved scope. Sensitive surfaces require named approval and a separate plan.

### Loophole 2: Subagents Can Loop

Risk: "act, iterate, get it done" can become repeated planning, repeated patches, or background continuation.

Fix: every subagent task must include objective, owned paths, forbidden paths, max iterations, stop condition, required evidence, and report-only completion.

### Loophole 3: Dirty Worktree Damage

Risk: an agent overwrites user work or another chat's changes.

Fix: every implementation phase starts with `git status --short --branch`. If a needed file is dirty and not owned by the phase, stop and ask.

### Loophole 4: Clean Codebase Is Underspecified

Risk: agents create scratch folders, duplicate docs, temporary files, generated dumps, or dead scaffolds.

Fix: every phase names allowed artifact locations. No `tmp/`, random scratch folders, unowned generated state, or exploratory dead files.

### Loophole 5: Reference Systems Become Dependencies

Risk: Hermes/OpenClaw/MemPalace concepts get copied into Luke runtime.

Fix: references stay idea-only until a separate approved integration plan names exact files, interfaces, dependency policy, tests, and rollback.

### Loophole 6: Self-Mutation Is Too Dangerous

Risk: a Subconscious-style component edits its own policy, thresholds, schedule, or code path.

Fix: Luke Subconscious may propose and explain. It may not approve, write runtime code, change scoring thresholds, alter policy, or schedule itself into execution.

### Loophole 7: No Validation Gate

Risk: phases claim success because files changed.

Fix: every phase ends with files changed, tests run, tests skipped with reason, remaining risk, next allowed action, and rollback path.

## Target Architecture

The Luke-native loop should become:

```text
Radar / Research / Operator notes
  -> Subconscious signal extractor
  -> Review-only signal board
  -> Main approval and PRD
  -> Coder phase plan
  -> Coder implementation
  -> QA validation
  -> Brain report and retrospective
  -> Signal memory update
```

The important split:

- Subconscious notices.
- Signal board scores.
- Main decides.
- Coder builds.
- QA audits.
- Brain reports.
- State persists.

No layer approves itself.

## Roadmap

### Phase 0: Baseline And Safety Freeze

Goal: establish exact current truth before edits.

Actions:

- Record `git status --short --branch`.
- Confirm `AGENTS.md` contains the hard policy bundle.
- Read `GEMINI.md`, `README.md`, `docs/ARCHITECTURE_CURRENT.md`, `.agent/PLANS.md`.
- Inventory current Radar, memory, brain report, path, and goal-plan seams.
- List current dirty files and no-touch surfaces.

Acceptance:

- A baseline note exists in the roadmap or active goal plan.
- No runtime files changed.
- No trading/Pine/Ninja files touched.

### Phase 1: Reader And Operator Roadmaps

Goal: create durable documents from the pasted source and the Luke adaptation plan.

Artifacts:

- `docs/HERMES_SUBCONSCIOUS_SOURCE_ROADMAP.md`
- `docs/LUKE_SUBCONSCIOUS_AUTOBUILD_ROADMAP.md`

Acceptance:

- Reader can understand the source timeline without the original paste.
- Operator can see the safe Luke path, loopholes, no-touch boundaries, and phased milestones.
- Docs are scoped to `docs/` only.

### Phase 2: Refresh Active Goal Plan

Goal: align `.agent/goals/2026-05-08-ai-repo-integration-plan/` with the current repo truth.

Actions:

- Mark already-landed pieces with evidence, if verified:
  - `AGENTS.md`
  - `lib/reference-repo-registry.js`
  - `lib/radar/ingest.js` reference review lane
- Add a new goal group for Subconscious signal board work.
- Preserve no-touch trading boundaries.

Acceptance:

- Goal statuses match current files.
- No implementation is hidden inside the planning update.
- The plan can be resumed by a fresh agent.

### Phase 3: Review-Only Subconscious Signal Schema

Goal: represent Subconscious-style build intents as review-only data, not tasks.

Likely design:

- Source type: `subconscious_signal` or reuse `reference_idea` with a clear lane.
- Required fields:
  - slug
  - source
  - raw text
  - signal types
  - score
  - positive walk count
  - cooldown state
  - lock state
  - status
  - non-goals
  - forbidden surfaces
  - review-only flag

Acceptance:

- A signal can be stored and reviewed without creating a Coder job.
- It cannot be promoted without Main approval.
- It cannot target trading/Pine/Ninja/broker surfaces in early phases.

### Phase 4: Signal Board Snapshot

Goal: create the Luke equivalent of `signal-board.md` and `summary.json`, using existing state conventions.

Preferred locations after approval:

- append-only events through `state/events/*`
- current board through `state/snapshots/*`
- human-readable docs only if explicitly needed

Board states:

- watching
- ready_for_main_review
- blocked
- cooldown
- queued_after_approval
- active
- built
- failed_qa
- repaired
- archived

Acceptance:

- Board generation is deterministic.
- It is read-only with respect to code.
- It can distinguish "interesting" from "approved to build."

### Phase 5: Main Approval And Coder Job Boundary

Goal: prevent direct Subconscious-to-code execution.

Rules:

- Subconscious can elaborate intent only.
- Main writes the PRD or ExecPlan.
- Coder receives only approved plans.
- One active sprint lock at a time.
- A failed phase routes to repair planning, not blind patching.

Acceptance:

- Jobs have states such as `pending_intent`, `pending_plan`, `approved`, `active`, `qa_failed`, `complete`, `archived`.
- No job can be active without Main approval.
- No job can touch forbidden surfaces without named approval.

### Phase 6: QA And Recovery Loop

Goal: add proof before autonomous phase progression.

Required QA packet:

- files changed
- tests run
- test output summary
- skipped tests with reason
- behavior proven
- regression risks
- rollback path

Recovery capabilities:

- stalled phase detection
- stale output dedupe
- semantic acceptance policy
- repair routing
- regression canary list
- operator trust reconciliation note

Acceptance:

- A failing QA result creates a repair plan, not a success claim.
- A passing QA result is still reviewable by the operator.
- Sacred trading smoke checks are required if any future approved work touches sacred paths.

### Phase 7: Runtime Monitor

Goal: watch long agent workflows and stop waste.

Monitor responsibilities:

- detect stuck loops
- detect repeated failures
- detect unapproved path edits
- detect dirty worktree conflict
- detect missing tests
- stop or pause agents when policy is violated

Acceptance:

- Monitor can stop a run.
- Monitor writes a short report.
- Monitor does not make hidden code changes.

### Phase 8: Scheduled Auto-Think

Goal: add scheduled thinking only after review-only signal flow is safe.

Allowed early behavior:

- read Radar/research/operator notes
- generate walk notes
- extract signals
- update board
- write digest

Forbidden behavior:

- write runtime code
- approve builds
- change policy
- tune thresholds to promote its own ideas
- touch secrets or trading surfaces
- dispatch Coder directly

Acceptance:

- Empty queues do not call expensive models.
- Walks have cooldowns and repetition checks.
- Digest separates evidence from interpretation.

### Phase 9: Auto-Build, Gated

Goal: allow bounded phase execution only after the full gate stack exists.

Preconditions:

- signal board exists
- Main approval exists
- Coder job states exist
- QA packet exists
- runtime monitor exists
- one sprint lock exists
- rollback path exists
- tests are defined

Acceptance:

- One phase runs at a time.
- QA must pass before the next phase.
- Failure creates repair work.
- Final QA runs end-to-end.
- Operator gets a concise report.

## Retro-Engineering The Source Days Into Luke Milestones

### Luke Day 1 Equivalent: Room And Receipts

Build nothing autonomous. Create the documents, define the room concept, and route candidate ideas into review-only Radar.

### Luke Day 2 Equivalent: Curation

Add signal states and project burial/archive language. Make it easy to reject or archive noisy ideas without losing evidence.

### Luke Day 3 Equivalent: Four Utilities

Luke-safe equivalents:

- Interest receipts: durable Radar receipt for high-signal research.
- Claim witness: claim/evidence tagging in review-only records.
- Thermal mass: weighting by repeated return, not excitement.
- Room window: dashboard/status view only after state is clean.

### Luke Day 4 Equivalent: Purpose Through Repetition

Add repeated-return scoring and cooling logic. Do not promote one-off ideas.

### Luke Day 5 Equivalent: Level System

Add a scorecard for autonomy maturity, but keep it descriptive, not self-authorizing.

Candidate dimensions:

- initiative
- evidence
- composition
- self-improvement governance
- reasoning depth
- safety compliance
- recovery ability
- test coverage
- state hygiene
- operator trust

### Luke Day 6 Equivalent: Crew

Formalize roles:

- Research: collects evidence.
- Subconscious: notices.
- Main: decides.
- Coder: builds.
- QA: validates.
- Monitor: stops loops.

### Luke Day 7 Equivalent: Model Routing

Create policy before implementation:

- cheap/local model for low-risk summarization and walk notes
- stronger model for synthesis
- frontier model for final approval and high-judgment plans
- no model call for empty queues

### Luke Day 8 And 9 Equivalent: Feedback And Multi-Phase Build

Only after the above:

- pre-flight critique
- post-build quality judge
- phased build loop
- repair PRDs
- end-to-end QA

### Luke Day 10+ Equivalent: Runtime Monitor And Recovery

Codex or a Luke-native monitor watches long workflows, detects policy violations, and stops waste.

## Orchestrator Task Template

Every parallel agent task must use this shape:

```text
Process_narration=false.
Role: <Research | Repo Fit | Safety | QA | Coder>
Objective: <single bounded outcome>
Allowed paths: <explicit list>
Forbidden paths: <explicit list>
Max iterations: <number>
Stop condition: <observable condition>
Required evidence: <files, commands, tests, findings>
Write permissions: <none | named files only>
Report format: findings, risks, recommendations, tests run/skipped.
Do not continue in the background after reporting.
```

## Immediate Next Steps

1. Review these two docs.
2. Refresh the active `.agent` goal plan so it reflects current landed pieces and the new Subconscious roadmap.
3. Add a review-only Subconscious signal schema.
4. Add a deterministic signal board snapshot.
5. Add Main approval and Coder job boundaries.
6. Add QA packet and runtime monitor before any auto-build loop.

## Final Strategy

The safe Luke strategy is free-thinking, not free-building.

Subconscious may notice and propose. Radar records and reviews. Main approves. Coder builds only from a bounded plan. QA proves behavior. The monitor stops loops. Outcomes feed back into state.

That is the path from the source text that can compound without weakening Luke.

