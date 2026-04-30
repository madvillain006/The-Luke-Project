# ES Long Backtest — Dataset Build Report

**Generated:** 2026-04-29T16:55:57.890Z
**Mode:** Offline data build only. No live routes, /entries, PM2, broker execution, or scheduler touched.

---

## Bobby Export

| Field | Value |
|---|---|
| Total export messages | 934 |
| BOBBY messages in export | 892 |
| BOBBY messages (after date filter) | 892 |
| First timestamp | 2026-02-19T15:11:43.073-05:00 |
| Last timestamp | 2026-04-28T16:02:35.309-04:00 |
| Total attachments | 724 |
| Image attachments | 724 |

## Bobby Image Cache

| Status | Count |
|---|---|
| local_matched | 668 |
| unmatched | 56 |
| **total** | **724** |

> **Unmatched images (56):** Not in local media cache.
> CDN download not attempted. Each is recorded explicitly — nothing silently dropped.

| messageId | fileName | tradingDateET |
|---|---|---|
| 1498321254615351367 | Screenshot_2026-04-27_at_6.51.23_AM.png | 2026-04-27 |
| 1498321358424117258 | Screenshot_2026-04-27_at_6.54.04_AM.png | 2026-04-27 |
| 1498323667845648525 | Screenshot_2026-04-27_at_7.02.23_AM.png | 2026-04-27 |
| 1498324203026386944 | Screenshot_2026-04-27_at_7.05.04_AM.png | 2026-04-27 |
| 1498325074493833337 | Screenshot_2026-04-27_at_7.08.50_AM.png | 2026-04-27 |
| 1498326230330642553 | Screenshot_2026-04-27_at_7.13.21_AM.png | 2026-04-27 |
| 1498327167954845867 | Screenshot_2026-04-27_at_7.17.07_AM.png | 2026-04-27 |
| 1498328565870231602 | Screenshot_2026-04-27_at_7.22.32_AM.png | 2026-04-27 |
| 1498335346382082108 | Screenshot_2026-04-27_at_7.49.31_AM.png | 2026-04-27 |
| 1498337804890148997 | Screenshot_2026-04-27_at_7.59.23_AM.png | 2026-04-27 |
| 1498339589633343658 | Screenshot_2026-04-27_at_8.06.29_AM.png | 2026-04-27 |
| 1498341816506908672 | Screenshot_2026-04-27_at_8.15.20_AM.png | 2026-04-27 |
| 1498346712564240606 | Screenshot_2026-04-27_at_8.34.44_AM.png | 2026-04-27 |
| 1498347178131722464 | Screenshot_2026-04-27_at_8.36.26_AM.png | 2026-04-27 |
| 1498349381030514731 | Screenshot_2026-04-27_at_8.45.06_AM.png | 2026-04-27 |
| 1498352888026501191 | Screenshot_2026-04-27_at_8.59.20_AM.png | 2026-04-27 |
| 1498354788646256762 | Screenshot_2026-04-27_at_9.06.40_AM.png | 2026-04-27 |
| 1498358721267630091 | Screenshot_2026-04-27_at_9.22.19_AM.png | 2026-04-27 |
| 1498366626750267493 | Screenshot_2026-04-27_at_9.53.34_AM.png | 2026-04-27 |
| 1498368418397556857 | Screenshot_2026-04-27_at_10.00.50_AM.png | 2026-04-27 |
| 1498374054674042890 | Screenshot_2026-04-27_at_10.22.39_AM.png | 2026-04-27 |
| 1498374839981969508 | Screenshot_2026-04-27_at_10.26.15_AM.png | 2026-04-27 |
| 1498376406277689476 | Screenshot_2026-04-27_at_10.32.29_AM.png | 2026-04-27 |
| 1498380024447762592 | Screenshot_2026-04-27_at_10.46.55_AM.png | 2026-04-27 |
| 1498384430685884440 | Screenshot_2026-04-27_at_11.04.31_AM.png | 2026-04-27 |
| *(31 more not shown)* | | |

## Mancini Posts

| Field | Value |
|---|---|
| Total posts | 225 |
| High-confidence timestamps | 177 |
| Week-candidate timestamps | 48 |
| Low-confidence timestamps | 0 |
| Entry-generation-ready | 177 |
| Scrape date used | 2026-04-29 |

> All posts are written to `mancini-posts.jsonl`. Low-confidence posts have
> `timestampConfidence: "low"` and are excluded from entry generation.

---

## Saty Levels

| Field | Value |
|---|---|
| Trading dates requested | 56 |
| Dates with valid Saty levels | 33 |
| Dates without prior ES futures-session ATR | 23 |

**Dates without valid Saty (missing prior ES futures-session ATR):**
  - 2026-02-19
  - 2026-02-23
  - 2026-02-25
  - 2026-02-26
  - 2026-02-27
  - 2026-03-01
  - 2026-03-02
  - 2026-03-03
  - 2026-03-04
  - 2026-03-05
  - 2026-03-06
  - 2026-03-08
  - 2026-03-09
  - 2026-03-10
  - 2026-03-11
  - 2026-03-12
  - 2026-03-13
  - 2026-03-15
  - 2026-03-16
  - 2026-03-17
  - 2026-03-18
  - 2026-03-19
  - 2026-03-20

---

## Output Files

| File | Description |
|---|---|
| `bobby-messages.jsonl` | Normalized BOBBY text commentary (content, levels, instruments) |
| `bobby-image-cache.jsonl` | Per-image cache status linked by messageId |
| `mancini-posts.jsonl` | All Mancini posts with levels and timestampConfidence |
| `saty-levels-by-date.json` | Saty call/put triggers by trading date (no lookahead) |
| `dataset-build-report.json` | Machine-readable build summary |
| `dataset-build-report.md` | This report |

---

> **Safety:** No Anthropic vision calls. No Discord CDN downloads.
> No live trading routes, /entries, PM2, scheduler, or broker execution modified.
> Long-only ES scope. Short support untouched.
