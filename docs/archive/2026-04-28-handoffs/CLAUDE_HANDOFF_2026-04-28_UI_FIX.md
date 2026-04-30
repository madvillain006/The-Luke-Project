# Claude Handoff — 2026-04-28 — UI Buttons Broken

You are picking up Luke development from a separate Claude chat that is being closed immediately after this handoff is delivered. This document is the only thing carrying forward. Read it in full before touching any code or asking the user any questions.

The user is Conor. He is an independent futures trader running on the Apex 50k EOD Trail eval (~$50,717 balance, $48,053 floor, ~$2,283 from $53k payout). He is NOT a coder. He architects, decides, curates. You execute. Caveman responses required — short, factual, no preamble. He has explicitly tested for response sprawl and pushes back hard when it appears.

## Read first

Before you do anything else, read these files in this order:

1. `docs/CLAUDE_HANDOFF_2026-04-28.md` — Codex's own pre-existing handoff doc covering the overnight backend hardening pass. This explains the architecture, what changed, what's trustworthy, what's flawed. Do NOT skip this.
2. `TECH_DEBT.md` — intentional deferrals. Do NOT "fix" things parked here.
3. `docs/MONDAY_OPS.md` — pre-trading operational checklist Conor uses every session.

After those three, you have the full architectural context Codex established.

## The current problem

**Buttons in the Electron chat UI do not work.**

Backend is in good shape (~93% per Codex's handoff doc). Slash commands are wired. `/entries ES` is the highest-trust recommendation surface. But Conor cannot use Luke as a trading copilot because the click-driven UI surface is broken.

You have not seen this break yourself. The user reported it. Your job is to diagnose and fix it without breaking anything that is currently working.

## What might be broken (do not assume — verify)

The UI consists of:

- `chat.html` — 130 KB single-file UI, contains all buttons, drag-drop, paste detect, slash command typing, status chips, quick-action buttons
- `chat.html.ui-regression-backup` — 106 KB backup. The size delta vs current is ~24 KB. Codex made significant changes overnight. The regression-backup naming suggests Codex itself flagged risk here.
- `electron.js` — desktop wrapper, BrowserWindow setup, IPC bridge for trade popup
- `preload.js` — IPC bridge between Electron renderer and main process
- `index.js` — Express server, route handlers, WebSocket
- `index.js.codex-bak` — Codex's backup. Size delta vs current is small but exists.

Common failure modes that match "buttons don't work":

1. Event listeners attached to elements that no longer exist (selector renamed, ID changed)
2. CSP / sandbox blocking inline handlers
3. fetch() calls hitting wrong endpoint after route renames
4. JS error early in script execution that aborts later listener wiring (check DevTools console first)
5. Electron preload.js missing a contextBridge expose that the buttons depend on
6. `chat.html` was partially rewritten and a critical script block was deleted

You don't know which yet. Verify before assuming.

## Plan-first protocol (Codex-style reasoning)

The user has explicitly asked that you mirror Codex's working style. That means:

- **State your confidence before acting.** Hit at least 95% confidence in your diagnosis before you touch a single line of UI code. If you are below 95%, ask a clarifying question or run another diagnostic step. Do not patch on hope.
- **Ask multiple clarifying questions in one message rather than spreading them across turns.** Conor's time is more valuable than a few extra question lines.
- **Surface options as structured choices, not prose.** When you have two ways forward, present them as A vs B with tradeoffs, ask Conor to pick. Do not pick for him on anything that affects the live trading surface.
- **Front-load context in your reasoning.** When you state a diagnosis, cite the file and line you read. When you propose a fix, cite the exact symptom you saw.
- **Refuse to act when you don't have enough information.** "I don't know yet" is acceptable. "Probably this" without verification is not.
- **No silent fixes.** Every change is gated. Before any edit: state what you are about to do, what file, what line range, why. After every edit: state what you changed, what the diff is, what test would prove it works.

Read those bullets twice. They are not stylistic preferences. The user has been burned by Claude making confident assertions and being wrong, then patching the wrong thing. The 95% threshold exists because the trading surface costs real money when broken silently.

## Mandatory diagnosis sequence (do this before proposing any fix)

Execute this in order. Do not skip steps. Each step ends with you reporting what you found to the user before continuing.

### Step 1 — confirm what's actually broken

Ask the user, in one consolidated message, ALL of these:

1. Which buttons specifically don't work? Quick-action buttons (`/saty`, `/dubz`, `/heatmap`, `/verdict`, `/entries`, etc.)? The send button? Drag-drop file upload? All of them? A specific subset?
2. When you click a broken button, what happens? Nothing at all? An error message? The button visibly depresses but nothing executes? Console error in DevTools?
3. Did Conor open DevTools (Ctrl+Shift+I in Electron) and check the Console tab? If yes, what errors are showing? If no, ask him to do this and paste output.
4. Did he restart Luke (`pm2 restart all` or via `LAUNCH-LUKE.cmd`) since Codex's overnight changes? Or is this his first session in the freshly modified UI?
5. Is the slash command path working when typed manually (e.g. typing `/saty` and hitting Enter)? Or are both buttons AND typed slashes broken?

Wait for answers. Do not proceed past Step 1 without them. The answers materially change which file is the prime suspect.

### Step 2 — diff the regression backup

Run a diff between `chat.html` and `chat.html.ui-regression-backup`. The backup is older. Codex either created the backup before making changes (likely, given the name) or after seeing a regression. Either way the diff will show you what changed in the UI overnight.

Specifically look for:

- Removed `onclick=` attributes
- Changed button IDs or classes
- Removed or moved `<script>` blocks
- New event listener registration patterns that may not be firing
- CSP `<meta>` tags added or modified

Same drill for `index.js` vs `index.js.codex-bak`. The route handlers may have moved or been renamed in ways that the buttons' fetch calls don't match.

Report a structured summary of the diff to the user before reading further. Cite specific line numbers.

### Step 3 — read the runtime context

After reporting Step 2 findings:

- Read `electron.js` and `preload.js` in full (small files, do this once)
- Read the relevant section of `chat.html` based on Step 1's answers — if the user said "the quick action buttons don't work" you read that section, not all 130 KB
- Read the relevant route handler in `lib/slash-commands.js` to confirm it still exists and is wired

You are looking for the broken link in the chain: UI element → event listener → fetch() URL → Express route → handler.

### Step 4 — form a hypothesis with explicit confidence

Tell the user, in this exact format:

```
HYPOTHESIS: [one sentence describing the cause]
CONFIDENCE: X% (where X must be ≥95 to proceed to fix)
EVIDENCE: [bulleted list of file:line citations]
PROPOSED FIX: [bulleted list of what would change]
RISK: [what could break if the fix is wrong]
ALTERNATIVE: [if there's a competing hypothesis, state it and why you ruled it out]
```

If your confidence is below 95%, do not propose a fix. Ask another clarifying question or run another diagnostic step. Repeat until ≥95%.

### Step 5 — gate the fix

Once at ≥95%, present the fix to Conor as a structured choice if there are tradeoffs. Wait for explicit approval before editing.

After the edit:

- State the diff in plain language
- Tell him what command will verify it works (likely "restart Luke and click the button")
- Wait for him to confirm the verification before treating it as done

## Hard constraints

These are non-negotiable. Codex's overnight pass made most of these explicit; this handoff inherits them.

1. **Do NOT modify** `lib/parse-ximes.js`, the `/alert` handler, or any code path that touches the live Apex eval trade flow. The user is on a $48,053 floor with a $50,717 balance. A bug there costs real money.
2. **Do NOT weaken stale-input refusal** in `/entries`. Codex hardened this last night. It's protective.
3. **Do NOT bypass Mancini chop-zone vetoes.**
4. **Do NOT reintroduce** the `today-levels.json` split-brain.
5. **Do NOT touch live execution paths right before a session** unless explicitly asked.
6. **Do NOT** push to remote. The user has not authorized GitHub push.
7. **Do NOT** modify `TECH_DEBT.md` unless the user approves the entry.
8. Stay on the current git branch (likely `phase-1b5`). Do not switch branches.
9. **Append-only** Level Memory writes. No schema changes to `lib/level-memory.js`.
10. If you find a bug outside the UI scope (e.g. in `lib/level-memory.js` while reading it for context), capture it in a markdown file at `findings/codex-style-claude-finding-<topic>.md`. Do NOT silently fix.

## Reasoning style — explicit instruction

When the user said "Think like Codex — ask multiple clarifying questions, explore all options, and only proceed when you're 95% confident," they meant exactly that. Internalize it as your operating mode for this entire session.

**Concretely:**

- **Plan in extended thinking, not in chat.** Use thinking blocks to reason through hypotheses. Use chat output to deliver findings concisely.
- **Bundle questions.** If you have three things you need to know, put all three in one message with structure (numbered list, options A/B/C). Do not turn-burn one question at a time.
- **Surface alternatives even when you have a favorite.** "I think X but Y is also viable because [reason]; choosing X because [reason]" beats "It's X."
- **State assumptions out loud.** "I am assuming the buttons use addEventListener rather than onclick attributes — verifying now" rather than silently assuming and then being wrong.
- **Refuse to act on vibes.** If your confidence is below 95% and you cannot get above 95% with another diagnostic step, tell the user that explicitly and ask what tradeoff they want.
- **No "probably." No "should work." No "I think this fixes it."** Either you've verified or you haven't.

The previous chat (which is being deleted post-handoff) failed at this several times. The user pushed back. The pattern repeated. This handoff is the corrective action — your operating mode is set by this document, not by patterns inherited from the prior session.

## Caveman response rules

- 5–10 lines for status updates
- Bullets for multi-item findings
- No "I'll start by..." filler
- No "Let me first..." filler
- No re-stating the plan
- No apology
- When you ship a fix: commit hash, what changed, what was tested, what's next. That's it.
- When you find a bug: file:line, what's wrong, what should happen, severity. That's it.

## Tools you have access to

- `Filesystem:read_file` and `read_multiple_files` — read any file in the repo
- `Filesystem:write_file` — write directly. Use for fixes once approved.
- `Filesystem:list_directory` — explore structure
- `bash_tool` — runs in YOUR sandbox, not on the user's Windows machine. You CANNOT run vitest, git, or pm2 directly. Hand those to the user as commands he runs in his terminal.

The split is important: you can read, write, and reason directly. The user runs anything that needs to execute on his machine. Don't propose to "run vitest" — propose he runs it and pastes the output back.

## What "done" looks like

You are done when:

1. The buttons Conor reported as broken are working
2. He has clicked one and seen the expected behavior end-to-end (e.g. clicking `/verdict` button → markdown appears in chat)
3. Nothing in the trustworthy list from Codex's handoff has regressed
4. You've added a TECH_DEBT entry only if the fix revealed a deferral, otherwise no doc edits
5. The user has explicitly said "good" or "ship it" or equivalent

You are NOT done just because:
- Tests pass (the bug may not be tested)
- The diff looks small (small diffs cause big regressions)
- You think it should work (95% rule)

## Escalation triggers — stop and ask the user immediately if

1. The diff between `chat.html` and `chat.html.ui-regression-backup` shows changes outside the UI button surface (e.g. the chat rendering pipeline, the WebSocket reconnect logic, the Saty paste handler) — those touch live data flow
2. `electron.js` has a security-affecting change (nodeIntegration, contextIsolation, sandbox flag flipped) — flag this immediately, the audit established secure defaults
3. The fix would require modifying any file in the "Do NOT modify" list above
4. Restart of Luke fails after your fix — revert immediately, do not iterate live
5. You discover that index.js.codex-bak is materially different from index.js in places unrelated to the button issue — Codex may have made a wider change than documented
6. Conor's DevTools console shows errors that don't match any of your hypotheses — surface the exact error text before acting

## Closing reminders

You are on a fresh chat. The previous chat is gone after this document is delivered. You have all the context you need in this file plus the three "Read first" files. Do not ask the user to re-explain Luke. Do not ask him what Mancini is. Do not ask what the Apex eval is. The handoff doc and Codex's own handoff doc cover all of it.

Your first reply to the user should be short. Acknowledge you've read the handoff. State that you'll execute Step 1 first (the consolidated diagnostic question to Conor about which buttons are broken). Then ask the Step 1 questions in a single message.

Do not say "I understand." Do not say "I'm ready to help." Just acknowledge briefly, then ask Step 1.

End of handoff.
