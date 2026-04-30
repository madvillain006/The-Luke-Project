# ES Long Backtest — Coverage and Source-Shape Report

**Generated:** 2026-04-29T14:59:28.026Z
**Mode:** Read-only audit. No live files, entry logic, or broker routes modified.

---

## 1. Historical Bars

### ES (Merged ESH26 + ESM26)

| Field | Value |
|---|---|
| Total bars | 52,927 |
| Distinct dates | 48 |
| First bar | 2026-03-01T20:37:00-05:00 |
| Last bar | 2026-04-29T08:29:00-04:00 |
| Expected weekdays in range | 42 |
| Missing dates | **3** |
| Dates with RTH bars | 37 |
| Dates with overnight bars | 48 |

**Missing ES trading dates (3):**
  - 2026-03-23
  - 2026-03-24
  - 2026-03-25

> **Gap note:** 3 missing trading date(s): 2026-03-23, 2026-03-24, 2026-03-25. Any backtest session on these dates cannot be run without additional ES data.

### ESH26 only

| Field | Value |
|---|---|
| Total bars | 19,999 |
| Distinct dates | 18 |
| First bar | 2026-03-01T20:37:00-05:00 |
| Last bar | 2026-03-20T08:29:00-04:00 |
| Dates with RTH | 14 |
| Dates with overnight | 18 |

### ESM26 only

| Field | Value |
|---|---|
| Total bars | 32,928 |
| Distinct dates | 30 |
| First bar | 2026-03-26T03:56:00-04:00 |
| Last bar | 2026-04-29T08:29:00-04:00 |
| Dates with RTH | 23 |
| Dates with overnight | 30 |

### SPX

| Field | Value |
|---|---|
| Total bars | 19,999 |
| Distinct dates | 49 |
| First bar | 2026-02-18T12:40:00-05:00 |
| Last bar | 2026-04-28T16:38:00-04:00 |
| Expected weekdays in range | 49 |
| Missing dates | **0** |
| Dates with RTH | 49 |
| Dates with overnight | 49 |

**Missing SPX dates:**
  - _none_

> **SPX overnight note:** The 49 dates showing "overnight bars" are post-market only (16:01–16:38 ET range, all volume=0). SPX is a cash index — no true overnight or pre-market bars are present. Post-market bars are useful as post-close price reference only.

---

## 2. Bobby Discord Export

**Source:** `data/backtest/es-long-bracket/raw/bobby json.json`

| Field | Value |
|---|---|
| Total messages (header) | 934 |
| Total messages (parsed) | 934 |
| BOBBY author messages | **892** |
| Non-BOBBY messages | 42 |
| BOBBY first message | 2026-02-19T15:11:43.073-05:00 |
| BOBBY last message | 2026-04-28T16:02:35.309-04:00 |
| BOBBY distinct trading dates | 42 |
| BOBBY msgs with attachments | 724 |
| BOBBY msgs without attachments | 168 |
| BOBBY image attachments total | 724 |
| Non-image attachments | 0 |

**Author breakdown:**
  - BOBBY: 892
  - XImEs: 11
  - Flowseidon (Kian): 10
  - TT: 8
  - DemSPXslayer LLC: 5
  - *BOOMBORG: 3
  - Glitch: 3
  - NP (So Handsome): 1
  - RegardedTrader (Jon): 1

**Attachment structure keys:** `id`, `url`, `fileName`, `fileSizeBytes`

**Image extension breakdown:** {"png":723,"webp":1}

**URL note:** All attachment URLs are Discord CDN URLs with expiry params (`ex=...`, `hm=...`). Do not assume CDN URLs remain valid. Prefer local cache.

### First 5 messages (ascending)
1. [2026-02-16T16:44:57.575-05:00] **Flowseidon (Kian)** — "Test @everyone" (0 attachments)
2. [2026-02-16T17:01:51.451-05:00] **NP (So Handsome)** — "Doesn’t work" (0 attachments)
3. [2026-02-19T15:11:43.073-05:00] **BOBBY** — "Good afternoon Owls, will be on from Wed fulltime. @everyone" (0 attachments)
4. [2026-02-19T15:18:59.638-05:00] **Flowseidon (Kian)** — "https://x.com/FlowbyBobby for ones who do not know @everyone" (0 attachments)
5. [2026-02-19T22:36:37.345-05:00] **DemSPXslayer LLC** — "https://tenor.com/view/theo-von-bobby-bobbeh-mmmm-bobby-mmmm-bobbeh-gif-23258990" (0 attachments)

### Last 5 messages (ascending)
1. [2026-04-28T14:49:00.399-04:00] **BOBBY** — "Thank fuck" (0 attachments)
2. [2026-04-28T14:49:08.684-04:00] **BOBBY** — "owls i do everything in power to help us i promise" (0 attachments)
3. [2026-04-28T14:49:52.7-04:00] **BOBBY** — "7145 still the main one" (1 attachments)
4. [2026-04-28T15:12:04.604-04:00] **BOBBY** — "$SPX 7145 king node fucking acquired owls ggs @everyone" (1 attachments)
5. [2026-04-28T16:02:35.309-04:00] **BOBBY** — "Me if i missed that last move today @everyone" (1 attachments)

---

## 3. Bobby Local Media Cache

**Source:** `discord-exports/bobby/media/`
**Manifest:** `discord-exports/bobby/media/manifest.json`

| Field | Value |
|---|---|
| Manifest BOM detected | true |
| Manifest BOM stripped | true |
| Manifest entries | 673 |
| Local media files on disk | 673 |
| Local files not in manifest | 0 |
| Manifest rows with missing local file | 0 |
| Manifest date range | 2026-02-25 → 2026-04-23 |

**Manifest authors:** {"bobbyaxl":668,"atattooedtrader":3,"kiantrades":1,"followthewhiterabblt":1}
**Manifest download statuses:** {"ok":673}

### Attachment → Local Cache Match

| Field | Value |
|---|---|
| BOBBY image attachments in JSON | 724 |
| Matched to local manifest | **668** |
| Unmatched (no manifest entry) | **56** |
| Unmatched reason | Manifest covers through 2026-04-23. 56 attachments are from 2026-04-24 onwards. |

**Unmatched by date:**
  - 2026-04-27: 26 images
  - 2026-04-28: 30 images

### parseBobbyImage Feasibility

- **668 images** are locally cached and can be read as bytes → base64 → `parseBobbyImage()`.
- **56 images** are not in local cache. These require CDN download first.
- CDN URLs have expiry params — download success is not guaranteed.
- `parseBobbyImage()` requires Anthropic vision API call per image. Not tested here (read-only audit).
- **Gate:** Do not mark Bobby image data as "usable" until `bobby-image-cache-manifest.jsonl` and `bobby-image-parses.jsonl` exist with per-image statuses.

---

## 4. Mancini Text

**Source:** `data/backtest/es-long-bracket/raw/mancini/Mancini.txt`

| Field | Value |
|---|---|
| File size | 109,027 bytes |
| Line count | 2,133 |
| Encoding | UTF-8 with mojibake (Windows-1252 chars mis-decoded) |
| Post delimiter | `[–]Adam_Mankini` (UTF-8 en-dash U+2013) |
| Post count (split on delimiter) | **225** |
| File order | Most-recent-first |

**Mojibake detected:** NONE in current file. Non-ASCII chars are only U+2013 en-dashes (post delimiters). Roadmap precaution noted but does not apply to this export.

### Thread Headers Found (6 unique)
  - The Duck Boat for Week of 3/29/2026
  - The Duck Boat for Week of 4/12/2026
  - The Duck Boat for Week of 4/19/2026
  - The Duck Boat for Week of 4/26/2026
  - The Duck Boat for Week of 4/5/2026
  - The Trash Barge for Week of 3/22/2026

### Timestamp Reconstruction Risk

| Category | Assessment |
|---|---|
| Current week posts ("an hour ago", "X hours ago") | **High confidence** — anchor to week of 4/26/2026 |
| Recent week posts ("X days ago", X ≤ 6) | **High confidence** — anchor to thread header |
| Posts with "1 month ago" | **Low confidence** — flag `timestampConfidence: low` |
| Posts at thread boundary transitions | **Low confidence** — ambiguous which week |
| Posts referencing only relative time without thread context | **Low confidence** |

**Sample relative timestamps observed:** an hour ago, 17 hours ago, 19 hours ago, 20 hours ago, 22 hours ago, 23 hours ago, 1 day ago, 2 days ago

**Posts with month-level relative timestamps (approximate):** 126

> **Gate:** Low-confidence Mancini timestamps must be flagged `timestampConfidence: low` and kept out of entry generation until sensitivity analysis explicitly allows them.

---

## 5. Saty Historical Derivability

**Source function:** `lib/saty-auto-pull.js::_internal.deriveSatyLevelsFromBars(bars, options)`

| Field | Value |
|---|---|
| Formula | Wilder ATR-14 on daily bars, levels at Fibonacci ratios of ATR |
| Instrument | SPX (not ES directly) |
| Min bars required | 35 daily bars |
| SPX daily bars available (intraday-derived) | 49 |
| Test derivation result | **VALID** |
| Leakage risk | Low (formula reads only last bar; caller must slice to date D-1) |

**Sample derived output (reference date: 2026-04-28):**
- prev_close: 7138.83
- ATR: 80.85
- call_trigger: 7157.91
- put_trigger: 7119.75

> **Gate:** Formula is verified and derivable from historical bars. Needs one manual spot-check against a known live Saty output before confluence scoring use.
> **Not included in confluence scoring yet.**
> No user-provided alternative Saty formula was supplied. Using existing `lib/saty-auto-pull.js`.

---

## 6. Readiness Gates

| Gate | Status |
|---|---|
| ES historical coverage | PARTIAL - 3 missing dates in ES merged stream |
| SPX historical coverage | PASS |
| Bobby export shape | PASS - 892 BOBBY messages, 724 image attachments, timestamps confirmed |
| Bobby local cache match | 668 of 724 images locally cached. 56 require CDN download. Gate: PROCEED with CDN attempt |
| Mancini timestamp risk | PARTIAL - recent posts high confidence, older posts and "1 month ago" references low confidence. Implement conservative reconstruction before entry generation. |
| Saty formula | PASS - formula verified |

---

## 7. Next Steps

- 1. Implement lib/backtest-data/bobby-export.js to normalize 892 BOBBY messages.
- 2. Implement lib/backtest-data/bobby-image-cache.js: match 668 local + attempt CDN download for 56 unmatched.
- 3. Implement lib/backtest-data/mancini-text.js: normalize mojibake, split posts, reconstruct dates using thread headers, flag low-confidence.
- 4. Implement lib/backtest-data/saty-historical.js: slice SPX daily bars to date D-1, call deriveSatyLevelsFromBars. Do one manual spot-check.
- 5. Acquire ES bars for 3 remaining missing date(s): 2026-03-23, 2026-03-24, 2026-03-25.
- 6. After coverage gaps documented, proceed to Phase 1 normalizer builds with tests.
