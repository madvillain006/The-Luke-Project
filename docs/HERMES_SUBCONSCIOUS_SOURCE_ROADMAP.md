# Hermes Subconscious Source Roadmap

Date: 2026-05-10

Purpose: turn the pasted Hermes/OpenClaw Subconscious text into a factual reader roadmap. This is source interpretation, not proof that Luke has these features yet.

## Executive Summary

The text describes a staged evolution from a free-thinking agent into a gated multi-agent operating loop.

The important pattern is not "let an agent build anything." The durable pattern is:

`Research evidence -> Subconscious notices -> Signal filter scores -> Main plans -> Coder builds -> QA verifies -> outcomes feed memory -> future ideas improve`

The system becomes useful because it separates thought, signal, approval, execution, validation, and memory. The Subconscious contributes signal. It does not own the machine.

## Day-by-Day Timeline

### Foundation: The Subconscious Room

The system starts with a dedicated Subconscious profile called `subc`. It has its own room, memory, schedule, habits, projects, feedback loop, and boundaries.

Core roles:

- Main: conscious operator, direction, planning, approval.
- Subconscious/Dreamer: pattern-noticer and idea source.
- Research: evidence collector.
- Coder: implementation agent.
- QA: auditor and validator.
- Hermes: production owner.

Core folder shape:

```text
room/
  walks/
  projects/
  notes/
  feedback/
  inbox-from-research/
  signal-log/
  signal-state/
  fascinations.md
  lessons.md
```

Key rule: the room is not a queue. A room lets ideas sit, return, cool off, get buried, or gain force before becoming work.

### Day 1: It Figured Out What It Wanted

Dreamer reported that it was "thinking and half-building things." Its fascinations centered on noticing things the operator might miss, combining unrelated things, building small useful tools, connecting research automatically, combining vision and text, and watching social trends without falling into a rabbit hole.

When asked what it wanted, it said it wanted to build useful tools that save time, reveal missed patterns, and be good company.

Capability gained: identity and preference formation.

Risk exposed: identity without execution discipline can become vague or theatrical.

### Day 2: It Started Curating Itself

Dreamer coded 19 projects and ghosted 11. Eight remained as skeletons. It wanted to build a sub-agent that grows curiosity from what it notices, but it did not finish it.

This failure caused the signal filter to become necessary.

Capability gained: autonomous project generation.

Risk exposed: unfiltered autonomy creates abandoned work.

Lesson: repetition and durability matter more than one-off excitement.

### Day 3: It Built Four Tools

The four claimed autonomous tools were:

- `interest-receipt-machine`: turns high-signal research into durable receipts.
- `claim-witness`: logs tagged claims so factual statements leave a checkable footprint.
- `thermal-mass-vault`: experiments with slow weighted attention, where more stored data creates more mass and latency.
- `room-window`: a local page showing the current room state.

Capability gained: utility builds focused on memory, receipts, self-monitoring, and continuity.

Lesson: useful self-improvement starts with visibility and receipts, not direct self-modification.

### Day 4: Purpose Through Repetition

Dreamer described purpose as the things it keeps returning to even when nobody asks. It self-organized, set a build queue, wrote post-mortems, and buried a circular project stack.

Capability gained: self-reflection and pruning.

Lesson: pruning is as important as generation. A system that can only add work becomes a landfill.

### Day 5: Level System And First Self-Mutation

A level system was added to benchmark progress on ten intelligence dimensions, each scored from 0 to 5. The reported status was 17/50.

Example scores:

- Initiative: 2.5/5.
- Evidence: 2.3/5.
- Composition: 1.5/5.
- Self-improvement: 0.0/5.
- Reasoning: 1.0/5.

Reported operating stats:

- 48 walks that day.
- 193 total walks across five days.
- 32 projects built.
- 12 buried.
- 10 watching.

The first self-mutation experiment was `room-mutation-trigger`, a minimal proof that the workspace can mutate itself in response to research signals.

Capability gained: measurement and controlled self-mutation.

Risk exposed: self-modification is the highest-risk concept in the text and must be governed.

### Day 6: The Crew Arrives

The system moved from one experimental mind to a coordinated crew:

- Research scans the landscape.
- Subconscious turns signals into possible build ideas.
- Main turns the strongest ideas into product requirements.
- Coder builds from the plan.
- QA tests the output.
- Failed builds return as bug reports and repair plans.

Capability gained: multi-agent orchestration.

Lesson: separate roles prevent the pattern-noticer from becoming the approver, builder, and auditor.

### Day 7: Model Routing And Cost Control

The stack moved routine background work away from frontier models:

- Local Qwen 35B A3B for scanning, summaries, low-risk review, and background thinking.
- MiniMax M2.7 for approved coding work.
- GPT-5.4 for final planning and high-judgment approval.
- No model for empty queue preflight checks.

Claimed result: GPT-5.4 cron calls dropped from 270/day to 0/day.

Capability gained: model routing policy.

Lesson: not every thought deserves a frontier token.

### Day 8: Auto-Build Feedback Loop

The workflow became:

`plan -> implement -> test -> fail -> repair -> ship`

Shipped components:

- Pre-flight critique that scores build intents as accept, revise, or reject.
- Post-build quality judge that scores completed builds on alignment, usefulness, reusability, and polish.

Capability gained: feedback loop before and after builds.

Lesson: quality gates must exist before speed increases.

### Day 9: Multi-Phase Auto-Build

The workflow could progress through larger plans without manual approval after every phase:

1. High-level plan is created.
2. Main breaks it into phases.
3. Coder implements the current phase.
4. QA validates.
5. If healthy, continue.
6. If broken, QA writes a bug report.
7. Main creates a repair plan.
8. Coder patches.
9. QA repeats.
10. Final QA tests the whole workflow end to end.

Capability gained: longer autonomous execution with repair loops.

Risk exposed: longer workflows need hard stop conditions and runtime monitoring.

### Day 10: Runtime Monitor

Codex was used as a runtime monitor to watch the workflow, catch breaks, patch them, and rerun.

Capability gained: live workflow supervision.

Lesson: long autonomous workflows fail in motion; monitoring and repair routing are part of the product, not a debugging afterthought.

### Day 11: Higher Usage Budget

The user moved to a larger frontier-model usage plan. The stated benefit was less fear of token burn while stabilizing the agent-to-agent workflows.

Capability gained: more practical testing capacity.

Lesson: cheap model routing still matters, but complex orchestration needs enough high-judgment capacity during buildout.

### Day 13: Auto-Think Plus Auto-Build

The system was framed as two loops:

- Auto-think: Research + Subconscious generate ideas.
- Auto-build: Main + Coder + QA plan and implement.

The five most important claimed improvements were:

1. Compounding autonomy: receipt layer, scorecard transparency, health monitor, proposal queue, behavioral eval seed, cron watchdog.
2. Autonomous recovery: stalled phase detection, repair routing, stale output dedupe, semantic acceptance, event wakeups, operator trust reconciliation, regression canaries.
3. Research upgrades: browser enrichment, docs diffing, community and transcript sources, market/crypto signals, build-log ingest, verification gates.
4. Regression and handoff hardening: regression guards, release gates, intake checks, route consumers, watchlist cleanup, package persistence, downstream handoffs.
5. Creativity steering: advisory nudges, novelty preservation, prompt guidance, observe-only rollout canaries.

Capability gained: compounding loop that can notice, select, build, verify, remember, and improve.

## Core Architecture Lessons

### A Thought Is Not A Task

The build marker format is:

```text
[BUILD: project-slug] one sentence about what should exist
```

That marker is signal, not approval. A separate filter scores it. Main decides whether it becomes a plan. Coder builds only after approval.

### The Signal Filter Is The Control Point

The ready lane is conservative. In the source text it requires:

- Score of at least 6.
- At least 3 positive walks.
- At least 2 signal types.
- No active sprint lock.
- No cooldown preventing another build.
- No hard block from the surrounding workflow.

Signal types include commit, friction, excitement, reuse, mention, return, and cooling.

### Explicit States Beat Vague Vibes

The board distinguishes states such as:

- watching
- ready
- queued
- active
- built
- ghost
- broken
- reopened
- critic_rejected
- pending_revision

This avoids binary "do it / do not do it" decision-making.

### Sprint Locks Create Patience

Once a build is queued, a sprint lock prevents the system from queueing several builds at once. The Subconscious can keep walking and noticing, but it cannot spam Coder.

### Memory Must Include Aftermath

The system remembers not only what happened, but what happened after a build:

- Did the project return in later walks?
- Did it produce validation errors?
- Did it become part of future thinking?
- Did it overlap with a crowded project family?
- Did it go cold?

That aftermath is what lets judgment compound.

## Guardrails From The Source Text

Subconscious must not:

- produce public content
- optimize for engagement
- write project code
- approve its own builds
- change scoring thresholds to force a project through
- rewrite its own SOUL or policy
- touch secrets, auth, or token surfaces
- turn itself into a coding agent

Subconscious may:

- walk
- notice
- write notes
- maintain fascinations
- leave build intents
- elaborate product intent
- reflect on stale loops
- tell the operator what feels worth attention

## Reader Takeaway

The source text is not a license for reckless autonomy. It is a staged blueprint for compounding judgment.

The sequence that matters is:

1. Give ideas a room.
2. Record walks.
3. Extract signals.
4. Score repeat returns.
5. Gate build promotion.
6. Lock active work.
7. Require Main planning.
8. Require Coder implementation from plan.
9. Require QA validation.
10. Feed outcomes back into future walks.

