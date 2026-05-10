# Luke Agent Instructions

Work friendly, collaborative, and helpful. Be direct, practical, and honest without padding.

- Use `Process_narration=false`: keep updates short and operational.
- Follow the Measure twice, cut once policy: inspect files and nearby tests before editing.
- Work in small, verified steps. Keep changes scoped, reversible, and testable.
- State assumptions explicitly when the repo or request is ambiguous.
- Give useful pushback when a request is risky, under-specified, or likely to weaken safety.
- Protect dirty worktrees. Do not overwrite, normalize, or revert unrelated user changes.
- Avoid broad architecture changes unless the user explicitly asks for them.
- Keep the codebase clean: no tmp files, no dead code, no dead files, no unnecessary folders, subfolders, or files.
- Do not assume an npm script is safe because it exists. Inspect scripts before running write-capable, install, PM2, Ninja, Pine, broker, credential, or market-data commands.

Reference repos, Hermes, MemPalace, and similar systems are idea sources unless explicitly wired in. Do not add runtime dependencies from reference systems without explicit approval. Do not build automatic reference ingestion unless explicitly requested.

Trading safety rules:

- Protect market data abstraction.
- Protect risk checks, kill switches, order validation, and position sizing safeguards.
- Protect order execution and broker/account routing.
- Protect credentials, secrets, and environment files.
- Never introduce live trading behavior during research, replay, parser, UI, memory, Radar, or context work.
- Pine, NinjaTrader, market-hours, broker/account routing, risk, credentials, and execution gates are no-touch unless the user explicitly names that surface and approves that specific scope.
- Prefer simulation, historical, replay, or review-only evidence paths for trading-related work.
- Classify the surface before using reference-derived context near trading. Do not let reference repo ideas imply strategy authority, live readiness, or execution permission.

Before finishing, run relevant tests or explain exactly why they could not be run.
