# Luke Radar Integration Roadmap

Date: 2026-05-07
Status: proposal only

## Decision

Radar should be built into Brain Core as Luke's intake and synthesis layer, not as another top-level spine.

The front-facing UI must be the current Luke shell, not a redesigned app, not the Brain Dashboard, not Operator V2, and not a new dashboard language. Radar should be baked into the existing `/shell` layout the user already sees.

Back/control dashboards are drill-down surfaces only. They exist for evidence, debugging, proof, and implementation detail after the user clicks into something. They are not the front end.

Internally, Radar feeds the existing Luke lanes:

- Daily Brief gets morning ideas, contradictions, reminders, and source health.
- Trading gets read-only external thesis context.
- Research Leads gets broader source and idea tracking.
- Automation Business gets client/product/content ideas.
- Luke System gets catch-all Q&A over the local knowledge base.

## Product Definition

Luke Radar is the local intelligence companion layer. It catches raw inputs, preserves provenance, connects fresh material to old context, and surfaces only useful review items.

Radar is not:

- A separate Obsidian clone.
- A Sybil-only tab.
- A trade execution signal engine.
- A confidence machine that claims certainty.
- A replacement for the current trading gates.

Radar is:

- The inbox for links, notes, screenshots, Sybil dumps, Discord exports, voice transcripts, saved articles, and arbitrary pasted material.
- The connector between new material and existing Luke research.
- The source of morning synthesis.
- The source of contradiction alerts.
- A local-first knowledge layer that keeps raw evidence auditable.

## Existing Luke Fit

Current front-facing surfaces:

- `/shell`: main dashboard and module launcher.
- `/daily`: static daily operating brief.
- `/luke`: general system chat.

Current back/control surfaces:

- `/brain-dashboard`: control plane and spine status.
- `/operator-v2`: read-only trading workbench.
- `/trading`: human-gated trading chat.

Current relevant code:

- `luke-shell.html`: dashboard front door.
- `brain-dashboard.html`: existing brain/spine map.
- `daily-window.html`: daily operating brief UI.
- `operator-v2.html`: trading workbench UI.
- `agents/agent-00-brain.js`: brain routes.
- `lib/brain/brain-core.js`: top-level brain snapshot and routing.
- `lib/brain/daily-brief.js`: morning/afternoon brief logic.
- `lib/kat-stage2/manual-paste-capture.js`: Sybil manual paste capture.
- `lib/kat-stage2/sybil.js`: Sybil context extraction.
- `lib/paths.js`: event/snapshot path registry.

## Preflight Gate

Do not start the implementation directly on the current dirty tree without a checkpoint.

Protocol:

1. Capture exact state:
   - `git status --short --branch`
   - `git diff --stat`
   - `git log --oneline -10`
2. Separate housekeeping from Radar.
3. Commit or deliberately park current work before large integration.
4. Confirm generated artifacts, duplicate Pine files, reports, and archive material are either intentionally kept, ignored, or moved out of the active work surface.
5. Only then start Radar implementation.

Reason: Radar touches the front door, brain routes, daily brief, storage paths, and tests. Doing that on top of an unbounded dirty tree risks making cleanup and product work impossible to review.

## Architecture

### Data Flow

```text
Raw material
  -> Radar ingest
  -> Raw append-only event
  -> Extraction
  -> Connection pass
  -> Derived snapshot
  -> Daily / Trading / Research / Luke System consumers
```

### Pipelines

Reader:

- Articles
- X posts/bookmarks
- PDFs
- newsletters
- saved links
- YouTube/podcast transcripts later

Listener:

- voice notes
- audio transcripts
- dictated thoughts

Catcher:

- manual paste
- quick link
- screenshot metadata
- phone bridge later

Connector:

- entity matching
- ticker/theme matching
- same-source history
- support/contradiction detection
- old-to-new relationship graph

Briefer:

- 3 review-worthy ideas
- emerging thesis of week
- contradictions
- reminders/open loops
- source health

Mobile:

- later phase only
- local webhook or phone shortcut first
- voice Q&A later

## Storage

Add to `lib/paths.js`:

```js
events.radarIngest = path.join(EVENTS_DIR, "radar-ingest.jsonl");
events.radarConnections = path.join(EVENTS_DIR, "radar-connections.jsonl");
events.radarReviews = path.join(EVENTS_DIR, "radar-reviews.jsonl");

snapshots.radarState = path.join(SNAPSHOTS_DIR, "radar-state.json");
snapshots.radarBrief = path.join(SNAPSHOTS_DIR, "radar-brief.json");
```

Raw event shape:

```json
{
  "id": "radar_...",
  "ts": "2026-05-07T12:00:00.000Z",
  "source_type": "manual_paste",
  "source_label": "sybil",
  "source_url": null,
  "title": null,
  "raw_text": "...",
  "raw_hash": "...",
  "provenance": {
    "captured_by": "luke",
    "capture_route": "/agent/brain/radar/ingest"
  },
  "entities": {
    "symbols": ["NVDA"],
    "people": [],
    "themes": ["ai_capex"]
  },
  "classification": {
    "lane": "trading_research",
    "confidence": 0.72,
    "review_priority": "normal"
  }
}
```

Connection event shape:

```json
{
  "id": "radar_edge_...",
  "ts": "2026-05-07T12:05:00.000Z",
  "from_id": "radar_...",
  "to_ref": "prior_note_or_research_id",
  "relation": "supports|contradicts|extends|duplicates|reminds",
  "strength": 0.68,
  "evidence": ["shared ticker NVDA", "theme ai_capex"]
}
```

## New Modules

Create:

- `lib/radar/store.js`
- `lib/radar/ingest.js`
- `lib/radar/extract.js`
- `lib/radar/connect.js`
- `lib/radar/brief.js`
- `lib/brain/radar-layer.js`

Responsibilities:

`store.js`

- append JSONL
- read recent events
- dedupe by hash
- write/read snapshot

`ingest.js`

- normalize input
- classify source
- call Sybil parser when applicable
- preserve raw text

`extract.js`

- symbols
- themes
- reminder candidates
- dates
- links
- contradiction hints

`connect.js`

- compare fresh items to old Radar events
- compare fresh items to level memory/research docs where safe
- write relationship edges

`brief.js`

- build daily Radar brief
- produce 3 candidate ideas
- produce contradictions
- produce reminders
- produce source health

`radar-layer.js`

- expose status shape for Brain Core
- expose brief shape for Daily
- expose read-only context for Trading/Operator

## Routes

Add static UI route:

- `GET /radar` -> `radar-dashboard.html`

Add Brain routes under `agents/agent-00-brain.js`:

- `GET /radar`
- `POST /radar/ingest`
- `GET /radar/items`
- `GET /radar/brief`
- `POST /radar/review`

Keep route namespace as `/agent/brain/radar/...` so Radar is clearly owned by Brain Core.

## UI Plan: Existing Shell Only

### Current `/shell`

Use the current shell exactly as the integration target:

- same topbar
- same Ninja Bridge Watchdog position
- same Trading hero
- same Luke System row
- same Show All / Brain Status / Agents row
- same Operations / Focus / Missions view switcher
- same module-card visual language
- same embedded-panel pattern used by Trading and Daily

Radar additions:

1. Add a Radar line to the existing Luke System status block:
   - `> Radar: 23 fresh / 2 review`

2. Add a Radar filter button beside Brain Status / Agents:
   - `Radar`

3. Add an Operations tile using the existing module-card pattern:
- Code: `I 004`
- Name: `Radar`
- Meta: `Inbox, synthesis, review`

4. Add an embedded `radar-panel`, matching the existing `trading-panel` and `daily-panel` behavior:
   - header: `Radar / Inbox + Synthesis`
   - actions: `CAPTURE`, `FULL`, `BACK`
   - iframe or panel body points to `/radar?embed=1`

5. Add the Radar tile to Focus and Missions views using the existing `view-module` style.

6. Keep backend/control detail out of the shell. The shell shows summary and entry points only.

### Radar Dashboard

New page: `radar-dashboard.html`, but only after click. It should match the current Luke visual system and be the inbox/review room, not a backend dashboard.

Panels:

- Today Brief
- Fresh Inbox
- Three Ideas To Verify
- Contradictions
- Reminder Candidates
- Source Health
- Connection Graph Summary
- Review Queue

Controls:

- paste/drop text
- source label
- save
- mark reviewed
- promote to Daily
- promote to Trading Context
- archive/noise

### Back/Control Dashboards

Do not use Brain Dashboard as the primary user experience for Radar.

Brain Dashboard can show Radar only as a compact Brain Core diagnostic:

- Inbox
- Fresh today
- Connections
- Contradictions
- Review queue

This is for evidence/debugging only. It should not be the mock, the sales pitch, or the default daily workflow.

### Daily

Add panel:

- Radar Brief
- 3 ideas to verify
- contradictions
- open loops
- source health

### Operator V2

Operator V2 is also not the front end for Radar. It can receive one read-only panel only after Radar is proven:

- External Thesis Context
- Active themes
- Contradictions
- Related Radar evidence

Hard boundary:

- no arm button
- no execution path
- no live signal authority
- read-only context only

## Phases

### Phase 0: Housekeeping Checkpoint

Goal: make the repo reviewable before a fundamental integration.

Tasks:

- Capture git evidence.
- Identify unrelated dirty files.
- Commit or park current work.
- Confirm ignored/generated paths.
- Decide whether proposal files stay or move to docs.

Exit criteria:

- Clear branch state.
- No accidental mixing of cleanup and Radar implementation.
- Current sacred trading checks still pass.

### Phase 1: Tone And Front Door Mock

Goal: align Luke with companion/operator language.

Tasks:

- Replace front-facing memorial language in shell and daily surfaces.
- Keep the current shell layout.
- Add Radar line, Radar filter, Radar module tile, Radar embedded panel, Focus/Missions links.
- Add static `/radar` review page.
- No backend behavior beyond stub JSON.

Exit criteria:

- UI shows Radar as part of the current Luke shell.
- Existing routes still load.
- No trading behavior changed.

### Phase 2: Radar Storage And Ingest

Goal: make capture durable.

Tasks:

- Add Radar paths.
- Implement append-only store.
- Implement ingest endpoint.
- Hash/dedupe raw text.
- Classify source type.
- Preserve provenance.

Exit criteria:

- Manual paste writes exactly one event.
- Duplicate paste does not create duplicate active item.
- Raw text can be recovered.

### Phase 3: Sybil Integration

Goal: fold the current Sybil bin into Radar.

Tasks:

- Reuse `captureManualSybilPaste`.
- Store Sybil contexts as Radar-derived context.
- Keep Sybil context-only unless explicitly promoted.
- Surface Sybil tags/symbols/themes in Radar.

Exit criteria:

- Existing Sybil tests still pass.
- Radar can ingest a Sybil dump and show context records.
- No trade is staged.

### Phase 4: Extraction And Review Queue

Goal: turn raw material into reviewable objects.

Tasks:

- Extract symbols, dates, themes, reminders, links.
- Mark items as idea, contradiction, reminder, source update, noise.
- Add review states: new, reviewed, promoted, archived.

Exit criteria:

- Radar status shows fresh inbox, themes, contradictions, reminders.
- Review action writes audit events.

### Phase 5: Connector

Goal: connect fresh and old context.

Tasks:

- Compare new items to prior Radar events.
- Compare trading items to safe research summaries and level memory metadata.
- Detect support/contradiction candidates.
- Write connection events.

Exit criteria:

- Radar brief can cite why an item is connected.
- Contradictions are evidence-backed.

### Phase 6: Daily Brief Integration

Goal: make Radar useful every morning.

Tasks:

- Add Radar section to `buildDailyBrief`.
- Add Radar panel to `daily-window.html`.
- Include 3 ideas to verify, not 3 trades to take.
- Include contradictions and reminders.

Exit criteria:

- `/agent/brain/daily/brief?kind=morning` includes Radar data.
- `/daily` shows Radar brief.

### Phase 7: Trading Context Integration

Goal: feed Operator V2 without weakening gates.

Tasks:

- Add read-only Radar context adapter.
- Add External Thesis Context panel to Operator V2.
- Show Radar evidence as context only.

Exit criteria:

- Operator V2 still says read-only/no execution.
- Radar context cannot arm a candidate.
- Sacred trading smoke checks still pass.

### Phase 8: Mobile Intake

Goal: allow phone capture after local desktop path is stable.

Tasks:

- Add local webhook/token.
- Add iPhone shortcut or Telegram bridge.
- Route mobile capture to same ingest endpoint.

Exit criteria:

- Phone input lands in Radar inbox with provenance.
- No public write endpoint without a token.

## Tests

Add:

- `tests/radar-store.test.js`
- `tests/radar-ingest.test.js`
- `tests/radar-sybil.test.js`
- `tests/radar-brief.test.js`
- `tests/radar-brain-route.test.js`
- `tests/radar-ui.test.js`

Update:

- `tests/brain-agent.test.js`
- `tests/brain-dashboard.test.js`
- `tests/current-status-docs.test.js`
- `tests/operator-v2-ui.test.js`
- `tests/slash-commands.test.js` only if route/status text changes touch command behavior.

Verification:

```powershell
node --check lib/radar/store.js
node --check lib/radar/ingest.js
node --check lib/radar/extract.js
node --check lib/radar/connect.js
node --check lib/radar/brief.js
node --check lib/brain/radar-layer.js
node --check agents/agent-00-brain.js
node --check index.js
npx vitest run tests/radar-store.test.js tests/radar-ingest.test.js tests/radar-sybil.test.js tests/radar-brief.test.js tests/brain-agent.test.js tests/brain-dashboard.test.js
npx vitest run tests/slash-commands.test.js tests/saty-auto-pull.test.js
```

UI proof:

```powershell
npm run prove:luke-ui-ux
npm run prove:brain-sections
npm run prove:operator-v2
```

Sacred smoke paths:

- `/status`
- `/balance`
- `/saty`
- `/ready`
- `/alert`

## Risk Register

Biggest risks:

- Mixing this with the current dirty tree.
- Turning Radar into a sixth fake dashboard organ.
- Treating the Brain Dashboard or Operator V2 as the front end.
- Making confidence look like trading certainty.
- Losing raw provenance.
- Letting Sybil dominate the architecture.
- Accidentally weakening trading safety language.
- Building a pretty UI before storage contracts are stable.

Mitigations:

- Commit/park first.
- Keep Radar owned by Brain Core.
- Design front-door UX first; keep backend/control dashboards behind clicks.
- Store raw before derived.
- Make review states explicit.
- Treat all trading output as "verify before action."
- Keep Operator V2 read-only.

## 100 Percent Protocol

1. Stop and checkpoint the repo.
2. Clean or park unrelated residue.
3. Land Radar proposal/mock only.
4. Redesign the actual front door first.
5. Add Radar review page as product UI.
6. Implement storage contracts.
7. Implement ingest.
8. Reuse Sybil.
9. Feed Daily.
10. Feed Trading as read-only context.
11. Add connector.
12. Add mobile capture only after local ingest is proven.
13. Run targeted tests.
14. Run UI proof.
15. Run sacred smoke checks.
16. Update architecture/current-status docs.
17. Commit as a coherent integration branch.

## Acceptance Criteria

- Luke front door shows Radar as part of the existing system.
- Radar is Brain Core intake/synthesis, not another independent spine.
- Brain Dashboard and Operator V2 remain drill-down/back surfaces, not the primary UX.
- User can paste raw material and see it in Radar.
- Raw provenance is preserved.
- Sybil data flows into Radar without becoming trade authority.
- Daily Brief includes Radar ideas, contradictions, reminders, and source health.
- Operator V2 shows Radar as read-only external thesis context only.
- No auto-trading path is added.
- Sacred trading command paths remain intact.
- Tests and UI proofs pass.
