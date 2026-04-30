# SYSTEM PROMPT PATCH PROPOSAL — 2026-04-30

## Status: DIAGNOSTIC / DESIGN ONLY. No code changed.

---

## 1. Current system-prompt.js — capabilities/tools section

There is no explicit "capabilities", "tools", or "commands" section.
The closest passages are:

**TRADING OPERATING RULES** (lib/system-prompt.js:137):
```
- Prefer /status, /verdict, /entries, /alert, /dubz, /heatmap, /mancini, and /saty as the live workflow.
```

**ACTIONS block** (lib/system-prompt.js:149-156):
```
ACTIONS:
Use ACTION JSON only when needed for build tasks or explicit desktop control.
ACTION:{"action":"shell","command":"node --version"}
ACTION:{"action":"read","path":"agents/agent-07-opportunity.js"}
ACTION:{"action":"list","path":"agents"}
ACTION:{"action":"search","pattern":"router.post","glob":"*.js"}
shell returns stdout/stderr/exit_code. read/list use paths relative to luke root. search uses ripgrep.
```

No mention of getLivePrice, Polygon, Saty webhooks, Bobby parser, or Dubz parser anywhere in the prompt.

---

## 2. lib/live-price.js — full audit

**Exact function signature:**
```js
async function getLivePrice()
```
No parameters. No options.

**Return shape (success):**
```js
{
  spx: number,          // SPY × 10, integer
  spy: number,          // raw SPY close (backward compat)
  instruments: {
    spx: { price, source: 'approximated', basis_note: 'SPY × 10' },
    spy: { price, source: 'live', basis_note: null },
    qqq: { price, source: 'live', basis_note: null } | null,
    es:  { price, source: 'approximated', basis_note: 'SPX + 30 (hardcoded; observed ~SPX+55 on 2026-04-24)' },
    nq:  { price, source: 'approximated', basis_note: 'QQQ × 41.3 (hardcoded)' } | null,
  },
  source: 'massive',
  cached_at: timestamp_ms,
  data_date: 'YYYY-MM-DD',   // date of the close used
  delayed: boolean           // true if data_date !== today
}
```

**Return on failure:** `null` in all error paths (never throws to caller).

**Instruments supported:** SPY (live Polygon close), SPX (SPY × 10 approximation),
QQQ (live Polygon close), ES (SPX + 30 hardcoded approximation), NQ (QQQ × 41.3
hardcoded approximation). No direct futures feed — all derived from equities.

**Environment variables:** `MASSIVE_API_KEY` only. This is a Polygon.io API key.

**Behavior when MASSIVE_API_KEY is missing:**
- `console.warn('[live-price] MASSIVE_API_KEY not set — live price unavailable')`
- Returns `null` immediately (no fetch attempted)

**Behavior when API call fails:**
- HTTP non-OK (except 429): fetchDailyClose returns null
- HTTP 429: throws Error('rate limited on ${ticker}') — caught by outer try/catch, logs warn, returns null
- No SPY data in 5-day lookback: logs warn, returns null
- No QQQ data: logs warn, continues with qqq: null (non-fatal)
- Any other thrown error: caught, logs warn, returns null

Cache TTL: 5 minutes. getCachedPrice() is the sync variant — returns null if cache is cold or expired.

---

## 3. How getLivePrice is called downstream

**saty-auto-pull.js:172:**
```js
const livePrice = await getLivePrice().catch(() => null);
```
Used only to populate snapshot.source and snapshot.data_date in the reference
snapshot object returned by captureReferenceSnapshot(). The actual SPX level
computation uses fetchDailyBarsFromPolygon('I:SPX', key, ...) — a direct Polygon
bars call independent of getLivePrice. If livePrice is null, snapshot falls back
to latestBar?.date for data_date and 'massive' literal for source. Non-fatal.

**scheduler.js:301-326:**
```js
setInterval(async () => {
  if (!process.env.MASSIVE_API_KEY) return;   // hard gate
  // ... ET time window check: 8:25-8:35, weekdays only ...
  await runJob("saty-auto-pull-0830", async () => {
    const result = await runSatyAutoPull();
    ...
  });
}, ...)
```
getLivePrice is not called directly in scheduler.js — it's called inside
runSatyAutoPull() -> captureReferenceSnapshot(). Scheduler guards the whole job
with the MASSIVE_API_KEY env check before entering, so getLivePrice is never
attempted without the key from this path.

---

## 4. Proposed system prompt addition — full mock

The following text would be inserted into buildSystemPrompt() in lib/system-prompt.js,
between the TRADING OPERATING RULES block and the HOW YOU TALK block:

---

```
DATA SOURCES AND LIVE TOOLS:

The following data sources are wired into this session. Before saying you don't
have access to something, check this list. If it's listed and a call fails,
report the actual error — do not say you don't have access.

1. POLYGON.IO MARKET DATA (via MASSIVE_API_KEY)
   - Provides: SPY and QQQ daily close prices (last trading day, up to 5-day
     lookback). SPX, ES, NQ are derived approximations (not direct feeds):
       SPX  = SPY × 10
       ES   = SPX + 30  (hardcoded offset; observed basis ~SPX+55 on 2026-04-24)
       NQ   = QQQ × 41.3  (hardcoded ratio)
   - Available: when MASSIVE_API_KEY is set; cached 5 minutes; delayed flag set
     when data_date < today (pre-market or market closed).
   - If null returned: MASSIVE_API_KEY is missing, API call failed, or no data
     found in last 5 trading days. Report which — do not say "no market access."
   - ES and NQ prices are approximations with hardcoded offsets. Say so when
     quoting them. Do not present them as live futures prices.

2. SATY LEVELS (via Polygon bars + webhook)
   - Provides: SPX daily-bar computed Saty levels (ATR extensions, ribbon
     classification). Written to data/saty-levels.json by auto-pull at 8:25-8:35 ET
     weekdays; also available on demand via /saty slash command.
   - Available: weekdays pre-market after auto-pull fires; stale on weekends and
     holidays until manually refreshed.
   - If stale or missing: say "Saty levels not loaded today" and suggest /saty.

3. BOBBY HEATMAP (parse-bobby.js parser)
   - Provides: parsed heatmap panels from Bobby's shared image/data. Includes
     ticker, strikes, premiums, and expiry context.
   - Available: when /heatmap or /bobby slash command is run with a fresh paste.
   - Uses getLivePrice() to ground strike plausibility. If live price is null,
     parsing continues but plausibility grounding is skipped.
   - If parse fails: report the parse error directly.

4. RICHYDUBBZ SIGNALS (parse-dubz.js parser)
   - Provides: parsed RichyDubz signal entries including ticker, direction,
     strike, expiry, and +-5% plausibility bounds (requires live price).
   - Available: when /dubz slash command is run with a fresh paste.
   - If live price is null: plausibility bounds are skipped, parsing continues.
   - If parse fails: report the parse error directly.

5. DISCORD SIGNAL HISTORY (discord-history.jsonl)
   - Provides: last 7 days of parsed signal insights from Discord servers/channels.
   - Available: injected into context when the message is trading-related
     (detected by keyword heuristic). Pruned to 7-day window on boot.
   - If empty or stale: no signal block appears in context. Normal — not an error.

6. MANCINI / XIMES / EXTERNAL ANALYST FEEDS
   - Not directly fetched by Luke. Surface via Discord history or manual paste.
   - Use /mancini or /entries to reference loaded bracket/level data.

BEHAVIORAL RULES:
- Do not improvise about your own architecture. If unsure what is loaded, read
  this section or ask Conor to run /capabilities (when available).
- If a listed source returns null or fails, name the source and the failure.
  Never substitute "I don't have access to that" when the source is wired.
- ES and NQ prices are approximations. Always state the source and basis note
  when quoting them (e.g., "ES ~5490 approximated from SPX + 30 offset").
- The Polygon feed is end-of-day delayed outside market hours. Do not present
  it as a real-time intraday price.
```

---

## 5. Code change scope

- **File:** lib/system-prompt.js only. Specifically the string returned by buildSystemPrompt() (lines 125-156).
- **Lines added:** ~55 lines of new prompt text inserted between TRADING OPERATING RULES and HOW YOU TALK.
- **Logic changes:** None. Pure string addition. No function signatures or exports change.
- **Risk level:** Low. Static cache TTL means the new section appears within 5 minutes of restart.
- **Tests that would catch regression:**
  - tests/slash-commands.test.js — any snapshot asserting full prompt output would catch deletion.
  - No current test validates prompt content directly. Recommended minimum guard:
    ```js
    assert(buildSystemPrompt('', '').includes('DATA SOURCES AND LIVE TOOLS'));
    ```
  - The regression surface is behavioral (Luke making wrong claims), not mechanical.
