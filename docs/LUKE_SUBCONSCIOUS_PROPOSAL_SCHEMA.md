# Luke Subconscious Proposal Schema

Date: 2026-05-10

Status: design contract only. No runtime state writes, no new runtime dependency, and no Subconscious implementation in this document.

## Purpose

Define the first safe Luke-native shape for Subconscious ideas before any code, state, scheduler, or auto-build work happens.

The source rule is unchanged:

- A thought is not a task.
- A build marker is not approval.
- Subconscious may notice and propose.
- Main approves.
- Coder builds only from an approved plan.
- QA proves behavior.

This document is the wall between "interesting" and "allowed to write."

## Non-Negotiable Boundaries

Subconscious proposals must not:

- write to `state/events/`
- write to `state/snapshots/`
- call `/agent/brain/radar/ingest`
- call `/agent/brain/radar/review`
- call companion memory capture
- call context-bin capture
- route slash commands
- create Coder jobs
- create scheduled automations
- create skill files, MCP workflows, context files, or external integration artifacts
- touch Pine, NinjaTrader, market-hours, trading execution, broker/account routing, risk, credentials, auth, tokens, or `.env`
- import Hermes, OpenClaw, MemPalace, Qlib, or other reference systems into runtime

Subconscious proposals may:

- be written as offline design packets
- be reviewed by Main
- be mapped onto existing Radar fields for a later dry-run
- be rejected, archived, revised, or promoted to Main planning

## Proposal Packet

The first schema is an offline packet, not a runtime event.

```json
{
  "schema_version": 1,
  "kind": "subconscious_proposal",
  "slug": "short-stable-id",
  "title": "human-readable idea",
  "raw_text": "source thought, note, or build marker",
  "source": {
    "agent": "subconscious",
    "mode": "drift-from-research|continue-project|pure-tangent|tend-the-room",
    "source_label": "luke-subconscious",
    "source_url": null
  },
  "signals": {
    "types": ["return", "friction"],
    "score": 0,
    "positive_walk_count": 0,
    "cooldown_state": "clear|cooldown",
    "lock_state": "none|active"
  },
  "review": {
    "status": "review_only",
    "review_only": true,
    "requires_main_approval": true,
    "trading_authority": "none"
  },
  "boundaries": {
    "non_goals": [],
    "forbidden_surfaces": [
      "trading",
      "pine",
      "ninjatrader",
      "market-hours",
      "broker",
      "credentials",
      "risk",
      "runtime-state"
    ]
  },
  "radar_mapping": {
    "source_type": "reference_idea",
    "source_label": "luke-subconscious",
    "scope": "subconscious_review",
    "status": "review_only",
    "review_only": true,
    "recall_reason": "subconscious_signal_review_lane",
    "relationship_ids": []
  }
}
```

## Existing Radar Mapping

Do not add `subconscious_signal` as a runtime source type yet.

Current Radar supports `reference_idea`, and `recordRadarIngest()` stores only known fields. Extra fields such as `score`, `cooldown_state`, `lock_state`, `non_goals`, and `forbidden_surfaces` will not survive unless they are encoded into existing fields or the Radar schema is intentionally extended later.

For the first safe pass, use:

- `source_type`: `reference_idea`
- `source_label`: `luke-subconscious`
- `scope`: `subconscious_review`
- `status`: `review_only`
- `review_only`: `true`
- `recall_reason`: `subconscious_signal_review_lane`
- `trading_authority`: `none`
- `relationship_ids`: stable ids like `subconscious:<slug>`, `family:<name>`, `walk:<id>`

Encode the proposal metadata in `raw_text` using a compact evidence block:

```text
[SUBCONSCIOUS_PROPOSAL: short-stable-id]
title: ...
signal_types: return, friction
score: 0
positive_walk_count: 0
cooldown_state: clear
lock_state: none
non_goals: ...
forbidden_surfaces: trading, pine, ninjatrader, market-hours, broker, credentials, risk, runtime-state
why_it_matters: ...
```

## Dry-Run Requirements

Before any Subconscious proposal can write into Radar, Radar needs a dry-run contract.

Required behavior for future code:

- `recordRadarIngest(input, { dryRun: true })` returns the normalized item and duplicate result without calling `appendJsonl`.
- Duplicate handling must not call `buildRadarSnapshot()` in write mode.
- Dry-run snapshot handling must call `buildRadarSnapshot(..., { writeSnapshot: false })` or skip snapshot creation.
- `recordRadarReview(input, { dryRun: true })` returns the normalized review without writing `radar-reviews.jsonl`.
- Dry-run responses include:
  - `ok`
  - `dry_run: true`
  - `would_write: false`
  - `target_events`
  - `target_snapshots`
  - `blocked_surfaces`
  - `normalized_item`
  - `duplicate`

No dry-run path may write to `state/events/` or `state/snapshots/`.

## Write Gate Requirements

A future write gate must block Subconscious proposal writes unless all checks pass:

- `source_label === "luke-subconscious"`
- `source_type === "reference_idea"` until a later approved code phase adds `subconscious_signal`
- `scope === "subconscious_review"`
- `status === "review_only"`
- `review_only === true`
- `trading_authority === "none"`
- `requires_main_approval === true`
- no requested target path is in the forbidden surface list
- no Coder job is created
- no scheduled automation is created
- no companion memory write occurs
- no context-bin write occurs
- no command routing occurs

Production writes require explicit operator approval and before/after `git status --short --branch`.

## Main Approval Artifact

Subagent reports and Subconscious proposals are evidence only. They cannot approve work.

Main approval must be a separate artifact with:

- approving owner
- proposal slug
- scope
- allowed paths
- forbidden paths
- tests to run
- rollback path
- expiration or review window
- explicit statement that the proposal is allowed to become a plan

Without this artifact, the proposal may only stay in review.

## Coder Job Boundary

No Coder job may be created directly from a Subconscious proposal.

Allowed transition:

`subconscious_proposal -> Main approval -> ExecPlan/PRD -> Coder task -> QA packet`

Forbidden transition:

`subconscious_proposal -> Coder task`

## QA Packet Requirement

Before any later implementation phase advances, QA must record:

- files changed
- protected paths touched or not touched
- tests run
- tests skipped with reasons
- behavior proven
- regression risk
- rollback path
- final `git status --short --branch`

If QA fails, the next artifact is a repair plan, not another blind patch.

## Protected Path Gate

Future implementation must include a protected-path diff check before any commit or push.

Blocked unless explicitly approved:

- `trading/`
- `tradingview/`
- `ninjatrader/`
- `lib/market-hours.js`
- `trading/router.js`
- `trading/signals.js`
- `trading/risk.js`
- `agents/agent-14-kat.js`
- `lib/kat*`
- `.env`
- credential/auth/token files
- broker/account routing
- runtime state under `state/events/` and `state/snapshots/`

## Loopholes Closed By This Design

- `subconscious_signal` is not added prematurely and cannot silently normalize to `manual_paste`.
- Arbitrary proposal metadata loss is acknowledged and handled by encoded text until Radar schema is extended.
- Radar write endpoints are not called by this design.
- Companion memory side effects are excluded.
- Context-bin command routing is excluded.
- Reports cannot launder approval.
- Ready-for-review is not treated as ready-to-build.
- State writes require a dry-run path and explicit write gate.

## Next Implementation Chunk

Only after this design is accepted:

1. Add Radar ingest/review dry-run support with tests using temporary paths.
2. Add a protected-path guard script or test.
3. Add a proposal-to-Radar mapping unit test that proves no production state writes occur.
4. Keep Subconscious proposal intake offline until those gates pass.
