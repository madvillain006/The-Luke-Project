# ES Long Backtest - Session Build Report

**Generated:** 2026-04-29T16:56:33.570Z
**Mode:** Offline session assembly only. No live routes, /entries, PM2, scheduler, or broker execution touched.

## Summary

| Field | Value |
|---|---:|
| Total sessions written | 50 |
| Eligible sessions | 37 |
| Excluded sessions | 13 |
| Sessions with Bobby context | 42 |
| Sessions with entry-ready Mancini | 22 |
| Sessions with valid Saty | 28 |
| Eligible sessions with Bobby context | 33 |
| Eligible sessions with entry-ready Mancini | 20 |
| Eligible sessions with valid Saty | 23 |

## Exclusions

| Reason | Count |
|---|---:|
| missing_es_rth_bars,missing_es_session_bars | 10 |
| missing_es_rth_bars | 3 |

| Date | Reason | Bobby | Images | Entry-ready Mancini | Saty |
|---|---|---:|---:|---:|---|
| 2026-02-19 | missing_es_rth_bars,missing_es_session_bars | 1 | 0 | 0 | no |
| 2026-02-23 | missing_es_rth_bars,missing_es_session_bars | 2 | 0 | 0 | no |
| 2026-02-25 | missing_es_rth_bars,missing_es_session_bars | 18 | 13 | 0 | no |
| 2026-02-26 | missing_es_rth_bars,missing_es_session_bars | 25 | 22 | 0 | no |
| 2026-02-27 | missing_es_rth_bars,missing_es_session_bars | 19 | 16 | 0 | no |
| 2026-03-20 | missing_es_rth_bars | 25 | 21 | 0 | no |
| 2026-03-23 | missing_es_rth_bars,missing_es_session_bars | 20 | 18 | 0 | yes |
| 2026-03-24 | missing_es_rth_bars,missing_es_session_bars | 33 | 28 | 0 | yes |
| 2026-03-25 | missing_es_rth_bars,missing_es_session_bars | 50 | 42 | 0 | yes |
| 2026-04-03 | missing_es_rth_bars | 0 | 0 | 7 | yes |
| 2026-04-29 | missing_es_rth_bars | 0 | 0 | 8 | yes |
| 2026-04-30 | missing_es_rth_bars,missing_es_session_bars | 0 | 0 | 0 | no |
| 2026-05-01 | missing_es_rth_bars,missing_es_session_bars | 0 | 0 | 0 | no |

## Files

- Sessions directory: `C:\Users\conor\luke\data\backtest\es-long-bracket\sessions`
- One JSON file per target date, named `YYYY-MM-DD.json`.
- Session files include ES overnight/RTH bars, Bobby commentary/images, Mancini posts, valid Saty levels, and deduped candidate levels.

## Safety

- No vision calls.
- No CDN downloads.
- Low-confidence Mancini posts preserved but excluded from `entryReadyPosts`.
- Invalid Saty dates preserved as `saty.included: false`.
- Long-only ES scope.

