# Luke ExecPlan Rules

This document is the repo-local source of truth for execution plans used by
Codex and by `slop-janitor`. An ExecPlan is a durable plan that lets a fresh
agent or human implement a working change from the file alone.

Luke is a live trading decision-support system. Every plan must protect the
operator, preserve human-in-the-loop trading decisions, and prove behavior with
tests or smoke checks before claiming readiness.

## Non-Negotiable Requirements

Every ExecPlan must be self-contained. The reader has the current worktree and
the plan file, but no memory of the prior conversation. Define project-specific
terms in plain language. Name concrete repository-relative paths, functions,
commands, and observable outcomes.

Every ExecPlan is a living document. Keep `Progress`, `Surprises & Discoveries`,
`Decision Log`, and `Outcomes & Retrospective` current as work proceeds. Record
why decisions were made, not just what changed.

Every ExecPlan must produce demonstrably working behavior. A successful plan is
not "files changed"; it is a behavior that can be observed through a test,
script, UI path, local endpoint, or explicit smoke check.

Every ExecPlan must be safe to resume. Include retry, rollback, or stop
instructions for risky steps. If the work touches live runtime behavior, include
the exact tests to run before any PM2 reload and the exact smoke checks after.

Ordinary Codex chat should not create git commits unless the operator asks. When
`slop-janitor` is the runner, it may create its own checkpoint commits after
successful plan, implementation, and review stages.

## Luke Safety Addendum

Start by reading `GEMINI.md`, `README.md`, and
`docs/ARCHITECTURE_CURRENT.md`. Do not trust older docs over current code.

Never enable autonomous or unattended live trading. Never call broker or live
execution endpoints unless the operator explicitly asks. Never weaken stop,
target, stale-input, readiness, Apex risk, chop-zone, confidence, or
human-approval gates.

Treat these files and flows as high-risk surfaces:

- `index.js`
- `scheduler.js`
- `chat.html`
- `lib/slash-commands.js`
- `lib/slash-commands-ingest.js`
- `lib/level-memory.js`
- `lib/confluence-engine.js`
- `trading/router.js`
- `trading/signals.js`
- `trading/risk.js`

The sacred operator flow is:

`/balance -> /saty -> /dubz -> /heatmap -> optional /mancini -> /status -> /verdict -> /entries ES -> /alert`

Plans that touch this flow must include focused tests and smoke coverage for the
affected commands. Do not expand Architect, sweeper, Katbot, health, or personal
assistant surfaces unless the operator specifically asks.

## Design Quality Lens

Use simplicity as the main quality bar. Prefer deep modules that hide policy and
sequencing over shallow wrappers that move complexity around. A plan should
explain:

- what complexity exists today and who pays for it
- what boundary becomes simpler after the change
- what knowledge moves out of callers and into the implementation
- what concepts, branches, duplicate state, or special cases disappear
- how the change reduces future bug surface

Do not mistake motion for cleanup. A plan is weak if it mainly adds adapters,
flags, layers, or configuration without hiding more detail from the rest of the
system.

## Required Shape

When an ExecPlan is written to a Markdown file where the file contains only the
plan, omit outer triple backticks. Use prose first. Checklists are required only
in `Progress`.

Every plan must include these sections:

1. `Purpose / Big Picture`: what the operator can do after the change and how to
   see it working.
2. `Progress`: timestamped checkbox entries that reflect current reality.
3. `Surprises & Discoveries`: unexpected facts with short evidence.
4. `Decision Log`: decisions, rationales, date, and author.
5. `Outcomes & Retrospective`: results, gaps, and lessons.
6. `Context and Orientation`: paths, modules, flows, and current behavior.
7. `Plan of Work`: the sequence of edits and why each reduces risk or
   complexity.
8. `Concrete Steps`: exact commands from the repo root and expected results.
9. `Validation and Acceptance`: observable checks and pass criteria.
10. `Idempotence and Recovery`: how to rerun, stop, or recover safely.
11. `Artifacts and Notes`: concise proof snippets or logs.
12. `Interfaces and Dependencies`: final interfaces, modules, and what they hide.

## Validation Defaults

For JavaScript changes, include focused tests for touched areas. Run the full
suite when feasible:

```powershell
npx vitest run
node --check index.js
node --check scheduler.js
node --check lib\slash-commands.js
node --check lib\slash-commands-ingest.js
```

For live server changes, do not reload casually. Run tests first, state why the
reload is necessary, then reload and inspect logs:

```powershell
pm2 reload ecosystem.config.js
pm2 logs luke-server --lines 20 --nostream
pm2 logs luke-scheduler --lines 20 --nostream
```

Smoke only the routes relevant to the change, and include sacred route smoke
checks when command routing or state handling is touched:

- `/status`
- `/ready`
- `/balance`
- `/saty`
- `/dubz`
- `/heatmap`
- `/verdict ES`
- `/entries ES`
- `/alert`

If validation cannot be run, the plan or final report must say exactly why.
