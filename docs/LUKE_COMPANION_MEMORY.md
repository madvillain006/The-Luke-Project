# Luke Companion Memory

Date: 2026-05-08 ET

Luke Chat and Trading now share one companion memory bin. The goal is simple: when the user tells Luke something useful in either surface, both surfaces can use it later without inventing context or asking the user to repeat themselves.

## Canonical Store

- Runtime snapshot: `state/snapshots/memory.json`
- Rolling context snapshot: `state/snapshots/context-bins.json`
- Store key: `luke_companion_memory`
- Event log: `state/events/companion-memory.jsonl`
- Context-bin event log: `state/events/context-bins.jsonl`
- Code owner: `lib/companion-memory.js`
- Context-bin owner: `lib/luke-context-bins.js`
- Chat integration: `index.js` `/chat`
- First-open readiness: `index.js` `/luke/operator-check`

## What Gets Captured

- Appointments: meetings, calls, doctor/dentist/interview items, and similar dated or timed logistics.
- Reminders: "remind me", "remember to", "follow up", and "check back" style instructions.
- Thoughts: active ideas, thesis notes, and "I am thinking about..." statements.
- Preferences: durable user preferences such as tone, UI behavior, and kept/removed product language.
- Notes: explicit "remember that", "note that", "save this", or "for later" statements.

Large generic pastes are ignored unless they contain explicit memory language. Trading source material still belongs in the trading/Radar ingestion paths.

## Retrieval Behavior

- A question like "what do I have at 2?" is answered from shared memory before the LLM path.
- A typo like `/statsu` is recovered to `/status` instead of falling through to a random model reply.
- Natural command recovery remains conservative, but explicit slash-command typos from Luke Chat route through the trading lane inside the same merged conversation.
- Luke Chat and Trading are two doors into one conversation layer. The route is tracked in rolling bins instead of making the user switch chats.
- Luke Chat opens with a read-only operator check so the user can see whether Luke should be the default daily surface before asking anything.

## Rolling Context Bins

Luke keeps compact rolling bins for personal, daily, Radar, trading, Luke project, and general conversation context. These bins are not a full Obsidian replacement yet; they are the short working index that lets Luke remember what lane a message belonged to and bring the relevant recent context into the next answer.

## Radar Relationship

New reminder and appointment memories are mirrored into Radar as reviewable reminder context. This keeps Daily/Radar aware of user logistics without giving Radar any execution authority.

## Boundaries

- Shared memory does not execute trades.
- Shared memory does not make broker, TradingView, or live-data readiness claims.
- Luke Chat may discuss trading architecture, and explicit trading commands route through the trading lane internally. Trading ingestion, verdicts, entries, and trade logs still use trading-owned code paths and safety checks.
- The front-shell memorial text stays in the UI. Public repo docs stay product-focused.
