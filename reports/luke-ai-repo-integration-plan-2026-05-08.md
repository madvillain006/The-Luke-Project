# Luke AI Repo Integration Plan

Date: 2026-05-08

Status: review only. No runtime integration has been started.

## Decision Summary

Use the cloned repos as reference systems, not as blind dependencies. The first implementation pass should add a small Luke-native integration layer that records what each repo is useful for, exposes that intelligence in Radar and dashboards, and only then graduates selected patterns into memory, Katbot, and research flows.

The core rule: nothing from these repos gets to touch live trading, broker execution, or sacred slash commands until it has a separate reviewed goal and proof.

## Current Luke Surfaces To Integrate With

- `tools/reference-repos/`
  - ignored shallow clones of the ten upstream repos.
- `lib/radar/ingest.js`
  - Radar source typing, review queue, source health, and item lifecycle.
- `agents/agent-00-brain.js`
  - `/agent/brain/radar`, `/agent/brain/radar/brief`, item detail, ingest, and review routes.
- `radar-dashboard.html`
  - operator-facing Radar inbox and review UI.
- `luke-shell.html`
  - main dashboard shell, Radar panel iframe, operator readiness line.
- `brain-dashboard.html`
  - brain/status dashboard.
- `lib/companion-memory.js`
  - current shared memory capture, search, and Radar cross-link.
- `lib/luke-context-bins.js`
  - rolling context bins for personal, daily, Radar, trading, project, and general context.
- `agents/agent-14-kat.js`
  - Katbot Discord capture, signal parsing, live vision, Luke broadcast, confluence alerting.
- `operator-v2.html` and `trading-window.html`
  - read-only trading dashboards with Katbot/heatmap proof areas.
- `lib/trading-state/*`, `lib/operator/*`, `scripts/*research*`
  - research and replay paths where Qlib/autoresearch patterns can help without touching live execution.

## Repo By Repo Integration Role

| Repo | Luke role | First integration target | Hard boundary |
| --- | --- | --- | --- |
| `MemPalace/mempalace` | Memory architecture reference | `lib/companion-memory.js`, `lib/luke-context-bins.js`, Radar source scoping | Do not replace Luke memory wholesale in one pass |
| `NousResearch/hermes-agent` | Long-running agent, skill, scheduler, and session recall reference | Brain dashboard, Radar reminders, later skill extraction | No autonomous self-modification |
| `mattpocock/skills` | Coder workflow and shared language patterns | `AGENTS.md`, `.agent/goals`, docs/ADR workflow | Do not import Claude-specific commands blindly |
| `forrestchang/andrej-karpathy-skills` | Agent discipline guardrails | `AGENTS.md`, work-item templates, review checklists | Do not turn simple tasks into ceremony |
| `SuperClaude_Framework` | Structured workflow/persona/command reference | Optional command/workflow inspiration for `.agent` and docs | Do not install its framework into Luke runtime |
| `microsoft/ai-agents-for-beginners` | Production agent design curriculum | Trustworthy-agent checklist, memory/context/security review | Do not add course sample code as product code |
| `hesreallyhim/awesome-claude-code` | Catalog of agent tooling ideas | Radar "reference catalog" entries and future shortlist | Catalog only unless a specific tool is selected |
| `Shubhamsaboo/awesome-llm-apps` | Runnable app-pattern cookbook | Radar/RAG/app template ideas for future Luke features | No template graft without matching Luke feature |
| `karpathy/autoresearch` | Experiment loop reference | Research sweeps, backtest keep/discard loop, reports | No overnight unattended code edits to trading paths |
| `microsoft/qlib` | Quant research and backtest architecture | Export adapters, research evaluation reports, factor/backtest vocabulary | No Python platform dependency in Luke runtime yet |

## Proposed Integration Architecture

### 1. Reference Repo Registry

Create a small Luke-owned registry that records every cloned repo, checked-out commit, local path, license, category, and approved Luke use.

Likely files:

- `config/ai-reference-repos.json`
- `lib/reference-repos/registry.js`
- `tests/reference-repos-registry.test.js`

Dashboard exposure:

- Radar can show "Reference Ideas" as reviewable source items.
- Brain dashboard can show "Reference repos available" and "next integration candidates."

Why this comes first:

- It prevents the clones from becoming mystery folders.
- It lets Luke reason about the repos without importing their code.
- It creates one place for pushback: enabled/disabled, allowed surfaces, and banned surfaces.

### 2. Agent And Coder Workflow Layer

Create or update repo-level guidance using only the useful pieces from Karpathy, Matt Pocock, and selected SuperClaude docs.

Likely files:

- `AGENTS.md`
- `docs/LUKE_ENGINEERING_RULES.md`
- `docs/LUKE_SHARED_LANGUAGE.md`
- `.agent/goals/*` templates or examples, only if useful

Planned content:

- Keep "friendly" collaboration features: concise status, concrete options, helpful pushback, no fake certainty.
- Preserve Luke-specific rules: sacred commands, human-gated trading, read-only dashboards, dirty-worktree respect.
- Add "small verified steps" and "shared language" patterns.
- Add a clear rule that external reference repos are inspiration, not authority.

Pushback point:

- If you do not want more guidance files, this can be one `AGENTS.md` section only.

### 3. Memory And Context Upgrade

Use MemPalace and Hermes as references to improve Luke memory incrementally.

First safe pass:

- Keep current `state/snapshots/memory.json` and `state/events/companion-memory.jsonl`.
- Add project/person/topic scopes to companion memory entries.
- Add verbatim raw text retention for user-approved important entries.
- Add "why recalled" metadata to memory search results.
- Add Radar cross-links so source items, memory entries, and Katbot events can point at each other.

Likely files:

- `lib/companion-memory.js`
- `lib/luke-context-bins.js`
- `lib/radar/ingest.js`
- `docs/LUKE_COMPANION_MEMORY.md`
- `tests/companion-memory*.test.js`

Later optional pass:

- Add a local search backend if the JSON search becomes too weak.
- Evaluate MemPalace as a separate CLI/tool only after the Luke-native store has clear limits.

Pushback point:

- I would not install MemPalace into Luke runtime yet. The safer move is to borrow its local-first/scoped-memory ideas first.

### 4. Radar Integration

Radar becomes the review surface for "ideas from reference repos" and "patterns to test."

Add source types or themes such as:

- `reference_repo`
- `agent_workflow`
- `memory_pattern`
- `quant_research_pattern`
- `katbot_pattern`
- `ui_pattern`

Likely files:

- `lib/radar/ingest.js`
- `lib/brain/radar-layer.js`
- `agents/agent-00-brain.js`
- `radar-dashboard.html`
- `scripts/prove-radar-daily-loop.js`

New behavior:

- A script can ingest top-level findings from each cloned repo into Radar as reviewable cards.
- Accepted Radar cards can become work items or goal-plan candidates.
- Contradicted/rejected cards stay as evidence, so future Codex sessions do not re-suggest the same bad integration.

Pushback point:

- Radar should not become a giant bookmark manager. Only ingest items with a proposed Luke action.

### 5. Dashboard And UI Integration

Add a restrained "Reference Intelligence" lane across the existing operational surfaces.

Likely placements:

- `luke-shell.html`
  - small status line: reference repos indexed, open integration ideas, blocked ideas.
- `radar-dashboard.html`
  - filter or tab for reference-derived ideas.
- `brain-dashboard.html`
  - reference repo health and active integration plan.
- `operator-v2.html`
  - only show research/quant reference status, not general coding content.
- `trading-window.html`
  - only show Qlib/autoresearch-derived research status if it affects read-only research confidence.

UI rule:

- Keep this dense and operational. No landing page, no hero, no decorative cards.

Pushback point:

- If you dislike dashboard clutter, keep the UI to Radar only and skip shell/brain panels until the integration proves useful.

### 6. Katbot Integration

Katbot should use the repos in three ways:

1. Memory/context:
   - Use MemPalace/Hermes ideas to improve recall of prior Katbot captures, analyst reliability, and accepted/rejected contexts.

2. Radar review:
   - Automatically record selected Katbot captures or confluence alerts into Radar with source links and review state.
   - Let accepted Radar reviews become stronger future context.

3. Research loop:
   - Use autoresearch/Qlib patterns for offline sweeps that ask: "Did Katbot context improve or degrade decision quality?"

Likely files:

- `agents/agent-14-kat.js`
- `lib/kat-vision-store.js`
- `lib/kat-confluence.js`
- `lib/kat-release-readiness.js`
- `lib/radar/ingest.js`
- `lib/operator/heatmap-proof-fixtures.js`
- `operator-v2.html`
- `trading-window.html`
- `scripts/analyze-sybil-katbot-discord-logs.js`
- `scripts/kat-stage2.js`

Hard boundary:

- Katbot remains confluence/context only.
- No Katbot item can create a live trade, live candidate, or broker action.
- Heatmap/GEX remains freshness-gated and read-only.

Pushback point:

- I would integrate Katbot into Radar before adding more Katbot UI. The review trail matters more than another visual panel.

### 7. Trading Research Integration

Use Qlib and autoresearch as architecture references for research discipline, not as a live dependency.

First safe pass:

- Create a Luke export format for backtest/research datasets.
- Add research run metadata: hypothesis, inputs, commit, data window, accept/reject result.
- Add keep/discard logic to strategy sweeps.
- Compare current scripts to Qlib concepts: data handler, feature, model, backtest, report.

Likely files:

- `scripts/backtest-*`
- `scripts/replay-decision-spine-history.js`
- `scripts/strategy-combination-agent-analyze.js`
- `lib/research/*`
- `reports/` for promoted summaries
- `artifacts/research/` for generated runs

Hard boundary:

- Qlib does not become a runtime trading dependency in this pass.
- Any Python environment or data download needs a separate approval.

Pushback point:

- If you want speed, skip Qlib integration and only borrow the report/run metadata model.

## Proposed Goal Sequence

1. Freeze integration baseline.
   - Verify reference clone paths, current git status, and current Radar/Katbot/UI routes.

2. Add reference repo registry.
   - Track local path, upstream URL, commit, category, and allowed Luke surfaces.

3. Add agent/coder guidance.
   - Create a concise Luke `AGENTS.md` update using friendly/collaborative behavior, Karpathy discipline, and Matt Pocock shared-language ideas.

4. Add Radar reference-review lane.
   - Ingest selected repo ideas as reviewable Radar items with accept/reject states.

5. Add memory/context improvements.
   - Add scopes, recall reasons, and Radar relationships without changing storage backend.

6. Add Katbot review bridge.
   - Route selected Katbot captures/confluence alerts into Radar and memory context, read-only.

7. Add research-loop metadata.
   - Apply autoresearch/Qlib-inspired hypothesis, run, result, accept/reject metadata to backtest/research scripts.

8. Add UI visibility.
   - Show reference integration status in Radar first, then optionally shell/brain/operator surfaces.

9. Verify and produce decision report.
   - Run focused tests/proofs and write what was accepted, rejected, deferred, and why.

## Validation Plan

Minimum before implementation:

- `git status --short --branch`
- Verify `tools/reference-repos/` exists and is ignored.
- Verify `/agent/brain/radar`, `/luke/operator-check`, `/operator-v2`, and `/trading-window` current behavior.

Focused tests after implementation:

- `node --check index.js`
- `node --check agents/agent-00-brain.js`
- `node --check agents/agent-14-kat.js`
- `node --check lib/radar/ingest.js`
- `node --check lib/companion-memory.js`
- `cmd /c npx vitest run tests/companion-memory*.test.js tests/*radar*.test.js tests/*kat*.test.js`

UI/proof checks:

- `npm run prove:radar-daily-loop`
- `npm run prove:companion-memory`
- `npm run prove:luke-operator-check`
- `npm run prove:operator-v2`
- `npm run prove:trading-window`

Sacred trading smoke checks if slash or trading paths are touched:

- `/status`
- `/balance`
- `/saty`
- `/ready`
- `/alert`

## Explicit Non-Goals

- No live trading enablement.
- No broker-path changes.
- No direct SuperClaude install.
- No direct Qlib runtime dependency.
- No MemPalace runtime install until a separate benchmark says Luke's native memory cannot do the job.
- No blind copy/paste from upstream repos.
- No UI clutter outside Radar until the first reference-review lane proves useful.

## My Recommended Approval

Approve goals 1-4 first:

1. Baseline.
2. Reference registry.
3. `AGENTS.md` and engineering guidance.
4. Radar reference-review lane.

Then pause for review before memory, Katbot, research, and UI changes.

This keeps the first pass useful to you as the coder while avoiding a risky graft into Luke's trading and runtime surfaces.
