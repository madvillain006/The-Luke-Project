# AI Repo Selection for Luke

Date: 2026-05-08

Purpose: choose which repos from the Nav Toor list are worth keeping locally for Luke improvement and for coder workflow reference.

Install mode: shallow local reference clones under `tools/reference-repos/`. They are intentionally ignored by git. Nothing here is wired into Luke runtime, installed as a dependency, or allowed to touch trading execution paths yet.

## Installed Snapshot

| Local folder | Upstream | Checked-out commit |
| --- | --- | --- |
| `tools/reference-repos/ai-agents-for-beginners` | `https://github.com/microsoft/ai-agents-for-beginners.git` | `e145657` |
| `tools/reference-repos/andrej-karpathy-skills` | `https://github.com/forrestchang/andrej-karpathy-skills.git` | `2c60614` |
| `tools/reference-repos/autoresearch` | `https://github.com/karpathy/autoresearch.git` | `228791f` |
| `tools/reference-repos/awesome-claude-code` | `https://github.com/hesreallyhim/awesome-claude-code.git` | `614f102` |
| `tools/reference-repos/awesome-llm-apps` | `https://github.com/Shubhamsaboo/awesome-llm-apps.git` | `20381f9` |
| `tools/reference-repos/hermes-agent` | `https://github.com/NousResearch/hermes-agent.git` | `81928f0` |
| `tools/reference-repos/mattpocock-skills` | `https://github.com/mattpocock/skills.git` | `733d312` |
| `tools/reference-repos/mempalace` | `https://github.com/MemPalace/mempalace.git` | `018ded5` |
| `tools/reference-repos/qlib` | `https://github.com/microsoft/qlib.git` | `d5379c5` |
| `tools/reference-repos/SuperClaude_Framework` | `https://github.com/SuperClaude-Org/SuperClaude_Framework.git` | `226c45c` |

## Chosen

1. `MemPalace/mempalace`
   - Best Luke fit.
   - Direct overlap with Luke companion memory, durable project recall, and local-first retrieval.
   - Has Codex/Claude/plugin-oriented structure worth inspecting before any Luke memory rewrite.

2. `microsoft/qlib`
   - Best trading/research fit.
   - Useful as a reference for quant data pipelines, backtesting, model training, risk research, and factor workflows.
   - Reference only for now because Luke is supervised trading support, not an unattended quant execution engine.

3. `mattpocock/skills`
   - Best coder-workflow fit.
   - Small, adaptable skills around planning, testing, issue triage, shared language, and agent alignment.
   - Useful for turning Luke cleanup into tighter work items without importing a huge framework.

4. `forrestchang/andrej-karpathy-skills`
   - Best agent-discipline fit.
   - Aligns with Luke's current cleanup needs: explicit assumptions, simple changes, surgical edits, and verifiable goals.
   - Good source material for future AGENTS/Codex instructions.

5. `karpathy/autoresearch`
   - Useful for Luke research automation patterns.
   - The direct nanochat training target is not Luke, but the keep/discard experiment loop maps well to strategy research and backtest sweeps.

6. `microsoft/ai-agents-for-beginners`
   - Useful as a structured agent engineering course.
   - Relevant sections include tool use, trustworthy agents, planning, multi-agent, production, context engineering, memory, and security.

7. `SuperClaude-Org/SuperClaude_Framework`
   - Useful as a structured workflow and command-system reference.
   - Claude-specific and too invasive to install into Luke directly; keep as reference only.

8. `hesreallyhim/awesome-claude-code`
   - Useful as a catalog of skills, hooks, slash commands, orchestrators, and tooling.
   - Catalog value is high; direct code value is lower.

9. `Shubhamsaboo/awesome-llm-apps`
   - Useful as a cookbook of runnable agent, RAG, MCP, memory, finance, and multi-agent app templates.
   - Good for borrowing proven app shapes, not for direct dependency use.

10. `NousResearch/hermes-agent`
   - Useful as a reference for memory, self-improving skills, scheduling, multi-channel gateways, and subagent orchestration.
   - Too broad to graft onto Luke blindly; keep as reference until a specific feature slice is selected.

## Not Doing Yet

- No upstream installers.
- No `npm install`, `pip install`, `uv tool install`, Docker, or background services.
- No package.json changes.
- No AGENTS.md rewrite from these repos yet.
- No trading path integration.

## Recommended Next Use

Use the local clones as source material for a second pass:

1. Extract a Luke-specific agent/coder instruction patch from `andrej-karpathy-skills`, `mattpocock/skills`, and selected SuperClaude docs.
2. Compare Luke memory against MemPalace concepts before changing `lib/companion-memory.js` or state layout.
3. Compare Luke research/backtest scripts against Qlib and autoresearch patterns before changing strategy research flow.
4. Pull concrete app patterns from `awesome-llm-apps` only when a matching Luke feature is already chosen.
