# Luke Watch Failed Breakdown Audit - 2026-05-07

Scope: read-only audit of `tradingview/history/pre-ninja/v4-watch-family/LUKE-WATCH-FLAGSHIP-v4-CANCEL-ACTIVE-WATCH.pine` against the pasted Mancini failed-breakdown/acceptance framework and Thursday ES trade plan.

No existing Pine was edited.

## First Read

I understand the framework as a quality stack, not a single binary trigger.

The best failed breakdowns are not just "price dips under a level and closes back above." They require:

- a significant low or shelf,
- that low occurring at a technically important location,
- a convincing stop-run/short-trap flush,
- and acceptance after reclaim.

The current flagship catches part of that. It is doing a level-reclaim/fake-breakdown approximation, with LTF fill protection. It is not yet explicitly grading whether the low itself was significant or whether acceptance occurred in one of the specific Mancini forms.

## Current Flagship Behavior

Relevant file:

`C:\Users\conor\luke\tradingview\LUKE-WATCH-FLAGSHIP-v4-CANCEL-ACTIVE-WATCH.pine`

Current major mechanics:

- External Mancini/Dubz/heatmap levels are parsed only inside `live_level_window_points`.
- Saty levels are added internally.
- Levels are clustered by proximity.
- Displayed chart lines are capped by `max_displayed_cluster_lines` and `level_display_window_points`.
- Mancini and Saty lines are visually distinguished, but the algo does not know "major" versus ordinary Mancini level.
- WATCH fires on a flush under a cluster if target space is acceptable.
- LONG fires from `paper_here`, which currently means a recent flush/reclaim plus hold-above, or impulse reclaim, plus filters.
- LTF validation checks whether the planned entry was actually touched and whether stop touched before TP1 in 1m/3m/chart data.
- Live intrabar cancellations are counted separately, but not treated as failed stopped trades.

Key code areas:

- Level input and live-window filtering: lines 57, 75, 257-265.
- Saty + external level ingestion: lines 267-373.
- Clustering: lines 382-414.
- Chart level drawing: lines 625-642.
- Flush/reclaim/hold logic: lines 675-724.
- Event/refire logic: lines 814-823.
- LTF fill gate: lines 825-861.
- Live cancel handling: lines 1113-1141.

## Gaps Against The Mancini Framework

1. Significant low quality is missing.

The framework says this is the most important criterion. The current Pine treats any parsed cluster as structurally eligible if price flushes/reclaims it. A 7332 major shelf and a random old minor target are structurally equivalent once they are in the input list.

2. Major/support role is missing.

The Thursday plan has major levels and special context:

- 7332 is a major shelf and key tomorrow.
- 7345 matters, but the better version is defend 7345 then recover 7355.
- 7369 is first support but lower conviction after a rally.
- 7284 is a lower failed-breakdown watch.

The Pine input is one flat comma-separated string, so none of that context survives.

3. Acceptance is too generic.

Current acceptance is mostly:

- flush/reclaim happened in the lookback,
- price held above for `reclaim_hold_bars`,
- anti-stuff/ribbon filters passed.

That is useful, but it does not distinguish:

- backtest-from-below then return,
- first reclaim failure then second reclaim,
- non-acceptance rip through the 5-point danger zone and stay above.

4. Cancellation accounting is too generous for live trading.

The file comment says cancelled live fizzles are counted separately, not failed trades. That is only right if the alert was not traded. If the user takes the alert at the indicated level, a cancellation is at least commission/slippage and can be a real loss. For live edge measurement, cancellation should be an attempted-trade outcome class.

5. Same-level refire needs structure.

The current code can refire after cancellation when the signal condition re-edges or the active level changes. It does not require a fresh same-level acceptance reset. That preserves speed, but in chop it can undercount the cost of repeated failed tries.

## Recommended Improvement Plan

Do not build a short setup into the flagship yet. The pasted framework itself says breakdown shorts are low-win-rate, advanced, under 10% of trades, and not the core edge. Keep shorts research-only unless a separate backtest proves real edge.

The highest-value long-side improvements:

1. Add level quality metadata outside Pine.

Best path: Luke/Node parses the daily plan into groups:

- major support,
- ordinary support,
- resistance/target,
- special trigger level,
- shelf/reclaim level.

Then Pine receives smaller, cleaner inputs. Pine should not try to infer all written context from one flat string.

Lowest-bloat Pine version:

- keep `mancini_levels_input`,
- add one optional `mancini_major_levels_input`,
- let major levels strengthen clusters and optionally gate high-quality LONG tags.

2. Add an acceptance-quality tag.

Do not immediately hard-veto everything. First add text/classification:

- `ACCEPT hold`: simple hold above level.
- `ACCEPT second`: first reclaim failed, second reclaim recovered.
- `ACCEPT rip`: reclaimed and stayed 5+ points above level after 2-3 minutes.
- `WEAK accept`: hovering 0-5 points above level without structure.

The first version should make this visible in labels and stats before changing entries.

3. Scale acceptance by flush depth.

Mancini's rule:

- shallow/high-volatility failed breakdowns can accept faster,
- deep/low-volatility failed breakdowns need longer.

Practical translation:

- shallow under 10 points: current 2-3 minute acceptance can be acceptable.
- 10-20 points: require stronger hold/second reclaim.
- 20+ points: do not use quick same-candle/short acceptance unless it is an extreme-volatility rip.

4. Treat cancelled live longs as attempted trades.

Add a separate cancellation cost model:

- if stop touched after fired, count STOP,
- if no stop/TP but signal cancelled, count CXL with at least commission/slippage,
- optionally mark estimated live exit from close when cancelled.

This will make stats uglier but more honest. It also aligns with the user's actual behavior: trading the LONG alert at the level.

5. Require same-level refire reset after cancellation.

Best rule:

- same level can refire if price performs a fresh below/above reset,
- or if a second-reclaim acceptance pattern forms,
- or if enough bars/time pass and the level is still defended.

Do not use the full failed-stop cooldown for every cancellation. A cancellation can be chop before the real reclaim. But it should not be neutral either.

6. Keep Pine light by moving heavy context to Luke/Katbot.

The flagship is already near practical TradingView weight limits on lower timeframes. Significant-low detection, multi-touch shelf scoring, and options-promotion logic should live in Luke/Katbot from 1m data. Pine should display/alert a compact execution surface.

## Thursday Level Handling

For today's TradingView Mancini input, the cleanest operational move is to clear old far-away Mancini paste and use the Thursday trade-plan levels.

Saved paste file:

`C:\Users\conor\luke\artifacts\tradingview\mancini-thursday-2026-05-07-levels.txt`

Combined sorted list:

`7121,7128,7135,7147,7159,7165,7173,7181,7186,7194,7200,7204,7209,7214,7218,7225,7233,7242,7248,7257,7262,7268,7273,7279,7284,7289,7295,7297,7300,7309,7311,7326,7332,7338,7345,7356,7369,7378,7387,7391,7400,7411,7418,7426,7430,7435,7443,7451,7454,7458,7464,7474,7484,7490,7497,7500,7515,7528,7538,7545,7553`

Near-actionable focus:

`7332,7345,7355,7356,7369,7378,7387,7400,7426,7451`

Notes:

- `7355` is not in the support list, but it is explicitly identified in the plan as the significant low/recover trigger after 7345 defense.
- `7332` should be treated as the key failed-breakdown shelf. The plan says wicks ran to about 7327, so the higher-quality version is sweep the whole shelf and recover 7332.
- `7369` is first support but low enthusiasm after a rally.
- `7400`, `7426`, `7451` are upside targets and should matter for TP/space, not necessarily long triggers.

## Ship Judgment

Do not rewrite the flagship yet.

The next best version should be a controlled new copy only after testing:

- daily plan level metadata,
- acceptance-quality tagging,
- cancellation-as-attempt accounting,
- same-level refire reset.

The short setup should stay out until separately proven. The current edge is long-side failed breakdowns and level reclaims with planned entry behavior, not generic breakdown trading.
