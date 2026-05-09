# AI Repo Integration Plan

## Objective

Create a reviewable integration path for the ten cloned AI repos so Luke can use them to improve coder workflow, memory, Radar, dashboard UI, Katbot, and trading research without blindly importing foreign frameworks into runtime code.

## Constraints

- This plan is review only until the user approves implementation.
- External repos under `tools/reference-repos/` are reference material, not vendored Luke source.
- Preserve human-gated trading and read-only dashboard boundaries.
- Do not touch broker execution, live order placement, or sacred command behavior without a separate proof phase.
- Keep integration small, native to Luke, and reversible.

## Non-Goals

- No direct SuperClaude framework install.
- No direct Qlib runtime dependency.
- No MemPalace runtime install until Luke-native memory limits are proven.
- No autonomous self-modifying code.
- No UI redesign or dashboard clutter before Radar proves the value.
- No live trading enablement.

## Ordered Goal Summary

1. Freeze the integration baseline.
2. Add a Luke-native reference repo registry.
3. Add coder/agent guidance from selected reference patterns.
4. Add Radar reference-review lane.
5. Improve memory/context with scoped recall and relationship metadata.
6. Bridge Katbot captures and confluence into Radar/memory, read-only.
7. Add Qlib/autoresearch-style research-loop metadata.
8. Expose approved integration status in UI dashboards.
9. Verify and write an accepted/rejected/deferred decision report.

## Acceptance And Validation

- The user can review and push back from `reports/luke-ai-repo-integration-plan-2026-05-08.md`.
- The goal plan is durable under `.agent/goals/2026-05-08-ai-repo-integration-plan/`.
- Implementation, when approved, starts with registry and Radar, not trading runtime.
- Validation includes focused syntax checks, Radar/memory/Katbot tests, UI proof scripts, and sacred trading smoke checks if touched.

## Assumptions And Risks

- The cloned repos are useful as reference snapshots but may change upstream; local commit hashes should remain recorded.
- Radar is the safest first integration surface because it already has review states.
- Katbot should get a review trail before more UI.
- Qlib can improve research discipline without becoming a dependency.
- The main risk is adding complexity before proving value; this plan keeps early work reviewable and reversible.
