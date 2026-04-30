# Claude Handoff - Stabilize Luke Before Open

Date: 2026-04-28
Repo: C:\Users\conor\luke
Branch: phase-1b5

## What just broke
Codex over-patched the UI and slash-command surfaces.
Main failures were:
- `chat.html` on disk became truncated, which broke button/tooltips behavior.
- `lib/slash-commands.js` still contained mojibake-heavy help strings, especially bare `/heatmap`.
- User-facing confidence cratered because the app looked haunted even when parts of the backend still worked.

## What is fixed now
As of this handoff, live smoke is clean again for the main embarrassing paths:
- `/status`
- `/heatmap`
- `/alert`

Frontend stabilization completed:
- Restored full `chat.html` from `HEAD`
- Removed orphaned premarket fragment that left `await` outside the intended async wrapper
- Repaired button seam around `btn-luke`
- Confirmed script parses again
- Cleaned visible ASCII labels for top bar, boot modal, panic modal, pending overlay, and close buttons
- Reloaded PM2 after repair

Backend/help-text stabilization completed:
- Added defensive normalization in `lib/slash-commands.js` for broken help text patterns
- Clean bare `/heatmap` response now returns:
  - `HEATMAP Paste Bobby's heatmap text then run:`
- Clean bare `/alert` response now returns:
  - `ALERT Paste a Ximes signal then run:`

## Live smoke results at handoff
`/status`:
- LUKE ONLINE
- Market: OPEN - Lunch chop (11:30 AM-1:00 PM ET)
- Levels: not loaded
- Saty: loaded
- Next: Missing prep inputs: /dubz, /heatmap

`/heatmap`:
- clean ASCII help text

`/alert`:
- clean ASCII help text

## Important preserve-this work
Do NOT casually throw this away:
- `lib/saty-auto-pull.js`
- `tests/saty-auto-pull.test.js`
- `index.js` Saty auto-pull endpoints
- `scheduler.js` 8:25-8:35 ET Saty auto-pull scheduling

That seam is real and worked earlier.
Current design:
- pull daily bars from Polygon/Massive
- prefer SPX daily bars
- fallback to SPY x10
- compute server-side Saty ladder as SPX truth

## Current dirty files that matter
Modified:
- `chat.html`
- `lib/slash-commands.js`
- `index.js`
- `scheduler.js`
- `TECH_DEBT.md`

Untracked but meaningful:
- `lib/saty-auto-pull.js`
- `tests/saty-auto-pull.test.js`
- `lib/llm-client.js`
- `state/daily-context.json`

Noise/unimportant:
- `.ws-token`
- `repo-map.json`
- `scripts/__pycache__/`
- assorted `.codex-bak` / backup files

## Risks still left
1. `lib/slash-commands.js` is still a danger zone.
   - It now behaves for the key smoke paths above.
   - It still contains lots of mojibake in comments and likely some deeper branches.
2. `chat.html` is stabilized, but only minimally.
   - It is no longer truncated.
   - The page is whole and key labels are sane.
   - More cleanup can happen later, but do not do broad regex edits.
3. No final end-to-end morning ingest smoke was run after this repair.
   - Need fresh `/dubz`, `/heatmap`, `/verdict`, `/entries ES` before trusting the session.

## Safe next steps
1. Reopen Luke/Electron once if the already-open window still shows stale garbage.
2. Keep changes surgical.
3. Before feature work, run these live checks:
   - `/status`
   - `/heatmap`
   - `/alert`
   - `/dubz` with safe sample
   - `/verdict`
   - `/entries ES`
4. If touching `chat.html`, avoid regex rewrites. Edit exact seams only.
5. If touching `lib/slash-commands.js`, prefer targeted branch cleanup over global transforms.

## Operator truth right now
Luke is back in a usable stabilization state.
It is not pretty everywhere.
But the high-tilt user-facing breakage that Codex caused tonight is no longer live on the core smoke paths.
