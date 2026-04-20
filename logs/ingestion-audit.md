# Ingestion Audit — Jarvis Raw Data Entry Points
Generated: 2026-04-20

---

## 1. POST /chat — User Chat Message
**File:** `index.js:686`  
**Function:** route handler (anonymous)  
**Input shape:** `{ message: string, history?: array }`  
**Output shape:** `{ reply, state, action, history }` → session.jsonl, jarvis-log.jsonl  
**Validated:** PARTIAL — checks `!message` (400), JSON parse error caught (line 14). No length cap, no sanitization of `history` array entries. `message` flows raw into `detectEmotionalState`, `routeToAgent`, and Claude prompt.

---

## 2. POST /paste-signals — Manual Discord Paste
**File:** `index.js:950`  
**Function:** route handler (anonymous)  
**Input shape:** `{ text: string, source?: string }`  
**Output shape:** `{ reply: string }` → discord-history.jsonl  
**Validated:** NO — checks `!text` (400). `text` truncated to 8000 chars before Claude call but written raw (500 chars) to discord-history.jsonl. `source` field written unvalidated to history entry.

---

## 3. POST /see-image — Base64 Image Upload
**File:** `index.js:793`  
**Function:** route handler (anonymous)  
**Input shape:** `{ image: string (base64), mime_type?: string, question?: string }`  
**Output shape:** `{ reply: string }`  
**Validated:** NO — checks `!image` (400). `mime_type` passed directly to Claude API with no whitelist check. `question` flows raw into model prompt.

---

## 4. POST /research — URL Fetch + AI Extract
**File:** `index.js:840`  
**Function:** route handler (anonymous)  
**Input shape:** `{ url: string }`  
**Output shape:** `{ reply: string }` → memory.json (agent06_research)  
**Validated:** NO — checks `!url` (400). No URL format or domain validation. SSRF possible — any internal/external URL accepted. Content truncated to 5000 chars before Claude. Insight written to memory if not "NOT RELEVANT".

---

## 5. POST /memory — Direct Memory Write
**File:** `index.js:893`  
**Function:** route handler (anonymous)  
**Input shape:** `{ key: string, value: any }`  
**Output shape:** `{ saved: true }` → memory.json  
**Validated:** NO — checks `!key` (400). Any key/value pair accepted. No type enforcement, no key allowlist. Can overwrite system keys like `_schema_version`.

---

## 6. POST /notify — Alert Broadcast
**File:** `index.js:930`  
**Function:** route handler (anonymous)  
**Input shape:** `{ message: string }`  
**Output shape:** `{ sent: true }` → broadcast to all WS clients, jarvis-log.jsonl  
**Validated:** NO — checks `!message` (400). No length cap. Raw message broadcast to all connected WebSocket clients.

---

## 7. POST /scrape — Triggers Discord Scraper
**File:** `index.js:938`  
**Function:** route handler (anonymous)  
**Input shape:** `{ priority?: string[] }`  
**Output shape:** `{ started: true, priority }` — scraper runs async  
**Validated:** NO — `priority` array passed directly to `runScraper()` as filter. No validation that values are in `["HIGH","MEDIUM","LOW"]`.

---

## 8. discord-scraper.js: scrapeChannel()
**File:** `discord-scraper.js:122`  
**Function:** `scrapeChannel(channel)`  
**Input shape:** screenshot (base64 PNG) via `desktop.py screenshot`  
**Output shape:** `[{ scroll, raw: string, insights: string }]` → discord-history.jsonl  
**Validated:** NO — raw vision output from Haiku fed unmodified into second Haiku extraction call. No schema enforcement on `insights`. Two-stage pipeline: `readScreenWithHaiku` -> `extractInsightsWithOpus` (both actually Haiku). Text length check (`> 50`) is the only gate.

---

## 9. intraday-scraper.js: scrapeAndExtract()
**File:** `intraday-scraper.js:51`  
**Function:** `scrapeAndExtract(channel)`  
**Input shape:** screenshot (base64 PNG) via `desktop.py screenshot`  
**Output shape:** `{ raw: string, insights: string }` → discord-history.jsonl + /notify  
**Validated:** NO — same two-stage Haiku pipeline as discord-scraper. `insights` written directly to history and sent to /notify which broadcasts to all WS clients. No schema on output.

---

## 10. intraday-scraper.js: runPreMarketScan()
**File:** `intraday-scraper.js:192`  
**Function:** `runPreMarketScan()`  
**Input shape:** screenshot (base64 PNG) via `desktop.py screenshot`  
**Output shape:** JSONL entry → discord-history.jsonl, raw text → /notify  
**Validated:** NO — raw Haiku output written as both `raw` and `insights` in history entry. No deduplication against prior runs.

---

## 11. intraday-scraper.js: getLiveQuote()
**File:** `intraday-scraper.js:43`  
**Function:** `getLiveQuote(ticker)`  
**Input shape:** ticker string (hardcoded: `"SPY"`, `"NQ"` at call site)  
**Output shape:** formatted price string — embedded in history entry market field  
**Validated:** PARTIAL — hardcoded tickers only at call sites. API key hardcoded in file (line 9, not env var). try/catch returns fallback string on failure.

---

## 12. POST /agent/autonomous/evaluate — Signal Evaluation Trigger
**File:** `intraday-scraper.js:107` (caller); handler in `agents/agent-02b-autonomous.js`  
**Function:** `triggerAutonomousEvaluate()`  
**Input shape:** `{}` (empty body) — 02B reads discord-history.jsonl internally  
**Output shape:** 02B evaluates latest signals, may emit staged_trade broadcast  
**Validated:** N/A at call site — 02B owns its own validation internally.

---

## Summary Table

| # | Entry Point | File | Validated | Risk Note |
|---|-------------|------|-----------|-----------|
| 1 | POST /chat | index.js:686 | Partial | message flows raw into Claude prompt |
| 2 | POST /paste-signals | index.js:950 | No | raw text -> history + Claude |
| 3 | POST /see-image | index.js:793 | No | mime_type unvalidated, question -> prompt |
| 4 | POST /research | index.js:840 | No | SSRF via arbitrary URL |
| 5 | POST /memory | index.js:893 | No | can overwrite any memory key |
| 6 | POST /notify | index.js:930 | No | raw message -> all WS clients |
| 7 | POST /scrape | index.js:938 | No | priority array unvalidated |
| 8 | scrapeChannel() | discord-scraper.js:122 | No | vision output unschema'd -> history |
| 9 | scrapeAndExtract() | intraday-scraper.js:51 | No | vision output -> notify -> WS |
| 10 | runPreMarketScan() | intraday-scraper.js:192 | No | raw Haiku output -> history |
| 11 | getLiveQuote() | intraday-scraper.js:43 | Partial | API key hardcoded in plaintext |
| 12 | /autonomous/evaluate trigger | intraday-scraper.js:107 | N/A | 02B handles internally |

---

## Flags

- **SSRF risk:** POST /research accepts any URL with no domain allowlist (`index.js:840`)
- **Memory poisoning:** POST /memory allows overwriting system keys (`index.js:893`)
- **Hardcoded secret:** Finnhub API key at `intraday-scraper.js:9` — move to `process.env.FINNHUB_KEY`
- **Unvalidated broadcast:** POST /notify sends raw string to all WS clients with no length or content gate
- **No output schema on vision pipeline:** All three scrapers (discord-scraper, intraday-scraper pre-market, intraday cycle) write raw Haiku output to discord-history.jsonl without validating structure
