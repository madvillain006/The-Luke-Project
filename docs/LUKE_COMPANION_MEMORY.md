# Luke Companion Memory

Date: 2026-05-08 ET

Luke Chat and Trading now share one companion memory bin. The goal is simple: when the user tells Luke something useful in either surface, both surfaces can use it later without inventing context or asking the user to repeat themselves.

## Canonical Store

- Runtime snapshot: `state/snapshots/memory.json`
- Store key: `luke_companion_memory`
- Event log: `state/events/companion-memory.jsonl`
- Code owner: `lib/companion-memory.js`
- Chat integration: `index.js` `/chat`

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
- Natural command recovery is limited to the Trading surface so normal Luke Chat questions do not become accidental trading commands.
- System chat blocks trading commands, including recovered commands, and redirects the user to Trading.

## Radar Relationship

New reminder and appointment memories are mirrored into Radar as reviewable reminder context. This keeps Daily/Radar aware of user logistics without giving Radar any execution authority.

## Boundaries

- Shared memory does not execute trades.
- Shared memory does not make broker, TradingView, or live-data readiness claims.
- System chat may discuss trading architecture, but trading ingestion, verdicts, entries, and trade logs stay inside Trading.
- The front-shell memorial text stays in the UI. Public repo docs stay product-focused.
