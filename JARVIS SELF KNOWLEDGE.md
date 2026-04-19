# JARVIS SELF KNOWLEDGE
*Last updated: April 19 2026*

## WHO JARVIS IS FOR
Conor. 32. Buffalo NY, moving to Tennessee mid-June 2026. Cancer survivor, clear. ADHD. Instacart income, options trading is the path. $500 trading capital. Luke the dog has PLE. Kat is his partner. This system is his, not a product — yet.

## CORE PHILOSOPHY
- Lightweight beats powerful if powerful means bloated
- One nervous system, one task — never interrupt trading or Instacart with background noise
- Scalpel approach applies to code too — small, precise, purposeful
- Always suggest the minimal viable implementation first
- If something requires 3 dependencies, find the version that requires 1
- Background tasks run at night only (2-4AM window)
- Self-improvement should be invisible — Jarvis gets better without Conor having to manage it

## STACK
- **Runtime**: Node.js / Express on Windows 11, port 3000
- **Desktop**: Electron chat window (480x700), chat.html
- **Desktop control**: Python + pyautogui (desktop.py)
- **AI**: Anthropic SDK — Opus for reasoning, Haiku for vision/speed
- **Process manager**: pm2 (replaces manual PowerShell windows)
- **WebSocket**: ws package for push notifications
- **Memory**: memory.json (persistent), jarvis-log.jsonl (activity), discord-history.jsonl (signals)
- **Phone access**: ngrok tunnel (free tier, URL changes on restart)
- **Local IP**: 192.168.12.186:3000

## FILES AND WHAT THEY DO
- `index.js` — main server, all core endpoints, system prompt builder, Discord signal loader
- `electron.js` — desktop chat window launcher
- `chat.html` — chat UI
- `desktop.py` — screen control via pyautogui (screenshot, click, type, scroll, open, press)
- `scheduler.js` — night scheduler (2AM scrape, 3AM suggestions, 4AM briefing)
- `discord-scraper.js` — screen-reads Discord via desktop.py, extracts signals via Haiku→Opus pipeline
- `ecosystem.config.js` — pm2 config, runs server + scheduler silently
- `start-jarvis.bat` — single click startup, launches pm2 + Electron
- `memory.json` — persistent memory, loaded into every system prompt
- `discord-history.jsonl` — all scraped Discord signals, last 7 days loaded into context
- `jarvis-log.jsonl` — activity log for every chat, research, and action
- `suggestions.md` — Agent 06 improvement suggestions, appended nightly
- `JARVIS_SELF_KNOWLEDGE.md` — this file, read by Agent 06 before generating any suggestions

## AGENTS
- **01 SCAFFOLD** (index.js) — main chat, emotional regulation, daily triage, computer actions
- **02 TRADER** (agents/agent-02-trader.js) — signal analysis, entry validation, P&L — STUB
- **03 INCOME** (agents/agent-03-income.js) — Instacart optimization — STUB
- **04 HEALTH** (agents/agent-04-health.js) — Luke vitals, meds tracking — STUB
- **05 FINANCE** (agents/agent-05-finance.js) — move fund, debt, cashflow — STUB
- **06 RESEARCH** (agents/agent-06-research.js) — synthesis, validation, self-improvement — ACTIVE

## AGENT 06 SKILLS LIBRARY
Agent 06 knows and can apply these skills by name:
1. DEEP-RESEARCH-SYNTHESIZER — pattern extraction from large data
2. WORKFLOW-AUTOMATION-AGENT — goal to stepwise action mapping
3. CODE-REVIEW-SKILL — bug detection, optimization, style
4. SKILL-CREATOR-META-SKILL — generate new .md skills autonomously
5. COMPETITIVE-INTELLIGENCE-SKILL — compare setups, tools, signals
6. DEVOPS-ASSISTANT — deployment, versioning, automation
7. KNOWLEDGE-STRUCTURING-SKILL — organize messy input into frameworks
8. SOURCE-VALIDATION-SKILL — reliability scoring, bias detection
9. ONCHAIN-TRANSACTION-ANALYZER — wallet/token flow analysis
10. UI-UX-LAYOUT-ADVISOR — layout, spacing, hierarchy for Electron UI
11. FLOWCHART-DECISION-BUILDER — process to node-based flowchart
12. INFOGRAPHIC-BUILDER — visual summary generation
13. SCQA-WRITING-FRAMEWORK — Situation/Complication/Question/Answer structure
14. STRUCTURED-COPYWRITING-SKILL — hooks, flow, CTAs
15. LONG-FORM-SUMMARY-COMPRESSOR — condense to essential points
16. TONE-STYLE-ENFORCER — maintain consistent voice across outputs
17. CONTENT-REPURPOSING-ENGINE — adapt content across formats
18. KNOWLEDGE-STRUCTURING-SKILL — framework and hierarchy building
19. EXCALIDRAW-DIAGRAM-GENERATOR — diagram instructions for visualization
20. COMPETITIVE-INTELLIGENCE-SKILL — SWOT-style comparative analysis

## KNOWN CONSTRAINTS
- Lenovo Vantage blocks Chrome debug ports 9222 and 9333 — never use CDP
- All screen reading done via pyautogui screenshot → Haiku vision
- Notepad corrupts code on paste — VS Code only
- Multiple node processes accumulate — pm2 handles this now
- Free ngrok URL changes on restart — phone access requires checking current URL
- Discord scraper loses focus if another window is active — runs at 2AM only when machine is idle
- Always give Conor complete files, never partial edits

## SELF-IMPROVEMENT RULES
When Agent 06 generates suggestions it must:
1. Read this file first
2. Prefer solutions that use existing stack (Node/Python/Electron) over new dependencies
3. Prefer background/night execution over anything that interrupts daytime use
4. Prefer single-file changes over architectural rewrites
5. Flag anything requiring new npm packages as MEDIUM effort minimum
6. Never suggest CDP, Playwright for screen reading — use desktop.py
7. Rate suggestions by impact/effort ratio, not just impact alone
8. Consider Conor's cognitive load — fewer moving parts is always better

## NIGHT CYCLE (automated, 2-4AM)
- 2:00AM — Discord scraper runs on HIGH priority channels
- 3:00AM — Agent 06 generates improvement suggestions from research + signals
- 4:00AM — Morning briefing pushed via WebSocket

## ENDPOINTS REFERENCE
Core: /chat, /see, /do, /research, /memory, /notify, /scrape, /signals, /health
Agent 06: /agent/research/synthesize, /validate, /structure, /create-skill, /flowchart, /review-code, /ui-advice, /improve

## FUTURE DIRECTION
- Agents 02-05 need full implementation (currently stubs)
- Emotional state detection layer (detects dysregulation, adjusts response mode)
- Trading rule enforcement watchdog (monitors for rule violations in real time)
- Discord export JSON ingestion when data arrives (up to 30 days of history)
- Self-updating skills library (Agent 06 generates new skills and saves them)
- Potential commercial application if system proves robust enough