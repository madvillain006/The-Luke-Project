# Ladder Reclaim Watchlist Candidate

Date: 2026-05-04

## 1. Candidate

- Name: `ladder_reclaim_bobby_mancini_staged_v1`
- Status: `WATCHLIST_ONLY`
- Surface: read-only Luke watchlist candidate, not an execution feature.

## 2. Evidence Summary

- Bobby+Mancini visual review: 91 examples.
- TP +2 hit rate: 91.2%.
- Stop-first rate: 9.9%.
- Avg/median heat before TP1: 1.16 / 0.75 ES points.
- Stop range in Bobby+Mancini review: 0.5 to 3 ES points.
- Broader ladder first-reclaim sample: 933 first-reclaim candidates from 37 sessions.
- Broader TP +2 hit rate: 76.2%.
- Broader stop-first rate: 29.6%.
- First reclaim beat late reclaim by average 4.1 ES points in comparable rows.

## 3. Account Findings

- 25k 2ES full: -$1050, failed true, max drawdown $1050.
- 25k 1ES starter: +$562.50, failed false, max drawdown $525, continuously profitable.
- 50k 2ES full: +$1125, failed false, max drawdown $1050, continuously profitable.
- 50k 1ES starter: +$562.50, failed false, max drawdown $525, continuously profitable.
- Best staged-add diagnostic for both 25k and 50k: `1ES_ADD_AFTER_RETEST_HOLD`.
- Staged-add diagnostic: +$2850, max drawdown $487.50, failed false.

## 4. Why Not Live

- No live-market forward proof exists for this candidate.
- Live ES market data quality is still a blocker in current evidence.
- Fill assumptions and staged-add timing need live or paper replay review.
- The watchlist endpoint returns research summaries only and no trade instruction.
- The operator surface explicitly says research only and has no execution controls.

## 5. Why Not Paper-Only Yet

- The strongest Bobby+Mancini subset is still 91 examples.
- Visual review exists, but fresh forward observation is still missing.
- The broader 25k 2ES account simulation failed.
- False-positive categories remain material.
- Staged-add results may be overfit until manually paper-reviewed.

## 6. Visual Review

- HTML review: `artifacts/research/ladder-reclaim-visual-review.html`
- Positive PNG folder: `artifacts/review/ladder-reclaim-visual-cases-2026-05-04/positive`
- Negative PNG folder: `artifacts/review/ladder-reclaim-visual-cases-2026-05-04/negative`
- Manifest: `artifacts/review/ladder-reclaim-visual-cases-2026-05-04/manifest.json`

## 7. False-Positive Categories

- Reclaim failed.
- No acceptance above level.
- Cluster too wide or needs visual review.
- Same-bar ambiguity.
- Repeated same level.
- Bad time of day.
- Missing Bobby/heatmap confirmation.
- Deep flush too violent.
- Stop too tight.

These categories are review labels only. They are not live filters.

## 8. How To View In Luke

- Operator card: `/operator-v2`
- Static visual review route: `/research/ladder-reclaim-watchlist`
- API: `GET /api/research/ladder-reclaim-watchlist?instrument=ES`

The API and UI are read-only.

## 9. Commands To Rerun

- `npm run research:ladder-reclaim`
- `npm run research:ladder-reclaim-review`
- `npm test`
- `node scripts/run-current-status-proof.js`

## 10. Current Verdict

`WATCHLIST_ONLY`

This is promising enough for manual watchlist observation and future paper-design review. It is not paper automation, not paper-only approval, and not live.
