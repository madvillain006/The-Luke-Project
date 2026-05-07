# Luke Watch v6 Usable Color Guide

Script:

`C:\Users\conor\luke\tradingview\LUKE-WATCH-FLAGSHIP-v6-USABLE-WATCH-RECOVERY.pine`

This guide explains what the chart colors mean and how to use the script in
live testing. The main trading signals are still WATCH and LONG. The other
colors are level context.

## Quick Read

- Gray WATCH label / gray circle: a level flushed. Pay attention, but this is
  not an entry by itself.
- Green LONG triangle / green box: Luke fired a long candidate.
- Blue line: Mancini level.
- Fuchsia line: Mancini focus-long level from the daily plan.
- Purple line: Mancini target-only context.
- Yellow line: high-confluence level or Saty plus Mancini overlap.
- Lime line: Saty-only level.
- Teal line: Heatmap/GEX level.
- White bracket line: planned entry.
- Red bracket line: stop.
- Green bracket line: TP1.
- Lime bracket line: TP2.
- Yellow stop line after TP1: runner stop has moved to price break-even.

## Level Line Colors

The script builds one combined level map from Saty, Mancini, Dubz, and
Heatmap/GEX. If multiple sources cluster together, the line may represent a
merged confluence area. Color priority is top-down.

| Color | Meaning | How To Use |
|---|---|---|
| Teal | Heatmap/GEX level | Options/positioning context. Brighter teal means fresh; faded teal means stale or aging. |
| Fuchsia | Mancini focus-long level | Highest attention for long-side failed breakdowns, reclaims, and defended backtests. |
| Blue | Mancini major or normal Mancini level | Core daily plan support/resistance. Major levels are more important; labels show source when enabled. |
| Purple | Mancini target-only level | Overhead target/context. Does not trigger by itself unless duplicated into trade/major/focus inputs. |
| Yellow | Strong confluence, or Saty plus Mancini overlap | Treat as higher-interest context. If price flushes/reclaims here, it deserves attention. |
| Lime | Saty-only level | Saty ATR/trigger context. Useful confluence, but weaker by itself than Mancini focus/major. |
| Aqua | Two-source cluster or medium-strength cluster | Moderate confluence. Watch when near current price. |
| Gray | Single low-strength level | Background context. Do not over-prioritize unless price action confirms. |

Line width also matters:

- Width 2: Saty, Mancini, or at least medium confluence.
- Width 1: weaker single-source level.

## Signal Markers

| Marker | Meaning |
|---|---|
| Gray circle below candle | WATCH fired. Price flushed an eligible level with enough target room. |
| Green triangle below candle with `LONG` | LONG fired. The setup passed the current gate and accounting starts. |

WATCH is the heads-up. LONG is the actual script signal.

## Labels

| Label Color | Meaning |
|---|---|
| Gray WATCH label | Watch event, level flushed. |
| Green LONG box | Active/open LONG candidate. |
| Orange LONG/CXL label | Live intrabar signal cancelled before confirmation. This counts in the panel cancellation counter. |
| Red LONG box | Trade stopped or mixed stop-first result. |
| Teal LONG box | TP1 banked and runner moved to break-even, or TP1 plus BE outcome. |
| Green result box | TP1/TP2 success. |
| Gray result box | Refreshed by a newer candidate. |
| Orange warning label | Script warning, usually stale heatmap or tolerance capped. |

## Bracket Lines

| Color | Meaning |
|---|---|
| White | Planned entry. |
| Red | Initial stop. |
| Yellow | Stop moved to price break-even after TP1. |
| Green | TP1. |
| Lime | TP2 / runner target. |

Important: break-even means price break-even, not net-dollar break-even. Costs
can still make the runner negative after commissions/slippage.

## Top-Right Panel

The top-right panel is the fastest way to check whether the script is behaving.

| Row | Meaning |
|---|---|
| Header | Current LTF validation mode and timing mode, for example `1m gated live`. |
| success/attempt | Successful candidates divided by total long candidates. |
| watch/long/cxl | W = WATCH count, L = LONG count, M = Mancini LONG count, R = Mancini RUNNER count, C = cancelled live signals. |
| stopped preTP | Stops before TP1. This is the most important failure count. |
| milestones | TP1, TP2, BE, and mixed-bar counts. |
| gross total | Gross points and gross dollars before costs. |
| minus comm | PnL after commission only. |
| realistic net | PnL after commission plus selected slippage model. |
| mode/costs | Accounting mode and accumulated costs. |

Panel text colors:

- Lime: positive / working.
- Red: negative / stopped / net loss.
- Orange: cancellations exist.
- Silver: neutral/no events yet.

## Daily Level Input Rules

This matters. Luke will not trigger from `Mancini target-only levels` unless the
same price is also pasted into one of:

- `Mancini trade levels`
- `Mancini major levels`
- `Mancini focus long levels`

Target-only levels are for upside context and next-target spacing. If a target
level becomes defended support during the session, copy it into trade/focus for
that session.

Example around ES 7400:

- `7400` as target-only: target/context only, no trigger by itself.
- `7400` in target-only and focus-long: visible as target context and eligible
  as a long trigger if price flushes/reclaims it.

Duplicates are intentional when a level has both target context and trigger
eligibility.

## Practical Use

1. Paste the daily levels.
2. Confirm current-price area is not target-only unless you intentionally do not
   want trades there.
3. Watch gray WATCH labels for flushes into important lines.
4. Act only on green LONG signals or your own discretionary read.
5. If the panel shows many cancellations or preTP stops, the day is likely chop
   or the level input is too permissive.
6. If no WATCH/LONG fires near active price, check whether the active area was
   accidentally left target-only.

## Current Known Pitfall

The script can look dead if the daily plan puts the live action zone only into
target-only levels. That happened around the 7378-7426 zone. The fix is to
duplicate actionable near-price inflection levels into trade/major/focus while
keeping them in target-only for overhead context.
