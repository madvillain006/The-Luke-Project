# Mancini holding inbox

Adam Mancini SPX/ES levels from his public Twitter (@AdamMancini4).
Paste tweets in chronological order as they come in. This is a holding
file. Parser is NOT built yet (deferred per TECH_DEBT.md until after
Phase 2 ships).

**Mancini context:** Full-time futures trader, ES intraday + ETF swing
2-7 day holds. Posts levels on Twitter free-side; full slate goes to
paid newsletter. We work from the Twitter side. He calls levels in
advance of session, then narrates as they hit. **Hashtag: #ES_F.**

**His framework (observed):**
- Trades only volatility-setup days. Defines those as "Failed
  Breakdown" reclaim setups — price loses a level, reclaims it, that
  reclaim is the trigger long.
- Every trigger has a CORE target slate (1-2 levels) and a BONUS slate
  (3-4 stretch levels above core).
- Strict "lock in level to level aggressively" on low-vol days.
- Calls "chop zones" with explicit ranges (e.g. "6793/88-6830=chop").
- Says "no elevator down sell = no trading for me" — explicit no-trade
  signal.
- Ride-runner mentality: keeps a small piece on for big macro targets.
- Marks targets as "hit" in real-time as they print.

**Key observation for confluence engine:** Mancini's levels are mostly
STATIC over multi-day windows. The April 9-10 batch shows the same
level cluster (6592, 6809, 6819, 6830, 6846, 6854, 6872, 6883, 6900-05)
referenced repeatedly across multiple tweets and multiple days. This
is materially different from Bobby's vision-derived integer king nodes
that drift bar-to-bar, and different from Dubz's daily-refresh key
flips. **Mancini levels accumulate confluence weight by repetition over
time, not by intra-session corroboration.** This affects how Phase 3+
parser writes them to Level Memory.

Format (loose — parser will be tolerant):

  ## [YYYY-MM-DD HH:MM]
  
  > <full tweet text>
  
  Source: <link if available>
  Note: <Conor's eyes-on observation if any>

═══════════════════════════════════════════════════════════════════════

## [2026-04-10 — pre-CPI / opening read]

> No volatility in #ES_F and 0 to do until we get some. Runners still paying from Tuesday's 6592 reclaim and yesterday's 6809 Failed Breakdown. 6872-6848=chop/flag. Today's 1st target was 6882, and we ran there, and dipped.
>
> 6900-05 still above if ES wants more. Same supports

Source: x.com/AdamMancini4
Tickers: ES (#ES_F)
Note: Two carry-forward triggers (Tue 6592, Wed 6809). 6872-6848 chop range. 6900-05 stretch resistance.
Levels:
  - 6592 — flip support (originally Failed Breakdown reclaim)
  - 6809 — flip support (yesterday's Failed Breakdown reclaim)
  - 6848 — chop zone floor
  - 6872 — chop zone ceiling
  - 6882 — 1st target (HIT)
  - 6900-6905 — stretch resistance

## [2026-04-10 — vol dead update]

> Vol dead in #ES_F but runners still paying. Trigger #1 was 6592 reclaim Tuesday, now +280 points. Trigger #2 was ystds 6809 reclaim. Target was 6872, still a ceiling
>
> Plan today: Ride runner. 6848-52=support (watch traps). 6872, 6882, 6900 next slate. 6848 fails, dip 6821-26

Source: x.com/AdamMancini4
Tickers: ES (#ES_F)
Note: 6848-52 support (with trap warning). 6872/6882/6900 upside slate. 6848 fail → 6821-26 dip target.
Levels:
  - 6592 — Trigger #1 (carry-forward, +280 from entry)
  - 6809 — Trigger #2 (carry-forward)
  - 6848-6852 — support zone (trap risk)
  - 6821-6826 — dip target if 6848 fails
  - 6872 — ceiling / next slate
  - 6882 — next slate
  - 6900 — next slate

## [2026-04-10 — CPI volatility note]

> Note: CPI at 830am could provide some volatility but from a trade perspective, just nothing to do now until we get an "elevator down" sell. As readers of my newsletter know, I *only* trade volatility which sets up Failed Breakdown. No elevator down sell=no trading for me. Period

Source: x.com/AdamMancini4
Tickers: ES (#ES_F)
Note: Explicit no-trade signal. "Elevator down sell" required for next setup. NO levels in this tweet — narrative only.

## [2026-04-09 — runner update]

> Little to do now but let the runner pay, which is now +280 from Tuesday's 6592 reclaim long. Today's #ES_F trigger was the 6809 reclaim. Targets were 6819, 6830 main (both hit). Bonus were 6846, 6854, 6872 (all hit)
>
> Next we head to 6883, 6903 as the macro flag breakout continues

Source: x.com/AdamMancini4
Tickers: ES (#ES_F)
Note: Full slate hit. Next stretch: 6883, 6903.
Levels:
  - 6592 — Tuesday trigger (carry-forward)
  - 6809 — today's reclaim trigger
  - 6819 — main target #1 (HIT)
  - 6830 — main target #2 (HIT, range resistance)
  - 6846 — bonus #1 (HIT)
  - 6854 — bonus #2 (HIT)
  - 6872 — bonus #3 (HIT)
  - 6883 — next stretch
  - 6903 — next stretch

## [2026-04-09 — big picture]

> While longs continue to pay in (now +280 points from the 6592 Failed Breakdown on Tuesday given out live) good time to zoom out. As posted Saturday, #ES_F spent a month in a clean downtrend channel/flag. Tuesday, it broke out.
>
> 1 month pattern breaks often see 1+ month rallies

Source: x.com/AdamMancini4
Tickers: ES (#ES_F)
Note: Macro context. Multi-week trend break thesis. NO new levels.

## [2026-04-04 — weekend big picture]

> Big Picture View #ES_F: Since February's highs, ES has been locked in a clear downtrend channel/flag with 6624 resistance. This week, we hit resistance
>
> Plan Next Week: As long as 6592 holds, breakout attempt likely. Targets 6677, 6716, 6820. 6592 fails, retrace to 6553, 6499 1st

Source: x.com/AdamMancini4
Tickers: ES (#ES_F)
Note: Weekend setup tweet. Forward-looking. 6592 = pivot. 6624 = resistance.
Levels:
  - 6499 — 2nd retrace target if 6592 fails
  - 6553 — 1st retrace target if 6592 fails
  - 6592 — KEY pivot (hold = bullish, fail = bearish)
  - 6624 — channel resistance
  - 6677 — upside target #1
  - 6716 — upside target #2
  - 6820 — upside target #3

## [2026-04-09 — closing update]

> Closing update #ES_F: 6809 reclaim was today's long trigger given at 8am. Targets were 6830 main (hit), 6872 bonus (hit). Hold runner now for 6883, 6902+. There are significant upside targets well above there as well. Newsletter out soon talking supports/entries from here

Source: x.com/AdamMancini4
Tickers: ES (#ES_F)
Note: EOD recap. Same levels as 04-09 runner update. 6902 stretch.
Levels:
  - 6809 — today's reclaim trigger
  - 6830 — main target (HIT)
  - 6872 — bonus target (HIT)
  - 6883 — next runner target
  - 6902 — next runner target

## [2026-04-09 — intraday slate confirmation]

> Levels respecting perfectly today as the long keeps paying in #ES_F. Today's long trigger was the 6809 reclaim given live 8am. Core targets given were 6819, 6830 (hit). Bonus slate were 6846 (hit), 6854 (hit), 6872 (been here for an hour)
>
> Ride runner now 6883, 6902 2nd bonus set

Source: x.com/AdamMancini4
Tickers: ES (#ES_F)
Note: Confirmation that level slate works. 6872 acted as ceiling for an hour.

## [2026-04-09 — bonus slate hit]

> We are moving into bonus targets now in #ES_F. Today's long trigger was the 6809 reclaim given at 8am + in newsletter last night. Core target slate was 6819, 6830 (both hit). Bonus targets today were 6846 (just hit), 6854, 6872.
>
> Now just let a small runner work rest of day

Source: x.com/AdamMancini4
Tickers: ES (#ES_F)
Note: 6846 hit live. Same level slate as prior tweets — confluence by repetition.

## [2026-04-09 — full bonus slate hit]

> We have hit the full bonus slate in #ES_F. 6809 reclaim was today's long trigger given at 8am. Core targets were 6819, 6830, both hit. 6830 was range resistance. Bonus/breakout slate were 6846 (hit), 6854 (hit), 6872 (hit exact).
>
> Ride that runner. Next bonus set are 6883, 6902

Source: x.com/AdamMancini4
Tickers: ES (#ES_F)
Note: 6872 hit "exact" — Mancini's precision claim. All bonus targets confirmed.

## [2026-04-09 — low vol scalps]

> Low volatility chop continues in #ES_F but we are still getting scalps. Today's long trigger given was the 6809 reclaim. We triggered at 930AM. 1st target was 6819 (hit). 2nd target was ~6830 (hit). 6830 remains range res. Lock in gains
>
> Bonus slate today remains 6846, 6854, 6872

Source: x.com/AdamMancini4
Tickers: ES (#ES_F)
Note: "Lock in gains" instruction. Confirms his level-to-level discipline.

## [2026-04-09 — early target read]

> Ultra low vol chop in #ES_F as we digest the recent 250 point long. 6809 reclaim was today's choppy long trigger. We triggered 930AM. 1st target was 6819 where I warned *lock in lvl to lvl aggressively*. We dipped there.
>
> 6830, 6846, 6854, 6872 if ES wants more. 6793/88-6830=chop

Source: x.com/AdamMancini4
Tickers: ES (#ES_F)
Note: Defines explicit chop range 6793/88-6830. "Lock in lvl to lvl aggressively" verbatim.
Levels:
  - 6788, 6793 — chop floor
  - 6809 — reclaim trigger
  - 6819 — 1st target (DIPPED, support test)
  - 6830 — chop ceiling / range resistance
  - 6846 — stretch
  - 6854 — stretch
  - 6872 — stretch

## [2026-04-09 — opening setup]

> Volatility remains very low in #ES_F as we digest Tuesday's 250+ point long, but we are getting trades. *Lock in gains lvl to lvl aggressively*. 6809 reclaim was long trigger given at 8am. We triggered
>
> Targets were 6819 1st (hit), 6830 2nd (not yet). Bonus slate 6846, 6854, 6872

Source: x.com/AdamMancini4
Tickers: ES (#ES_F)
Note: Earlier in the day. 6830 not yet hit at this point.

## [2026-04-09 — pre-trigger / chop warning]

> No volatility now as #ES_F is in day 2 of digesting Tuesday's 250 point 6593 Failed Breakdown long. Be very careful trading 0 vol - traps and fakeouts are extreme.
>
> No change: 6793/88 to 6830=pure chop. 6809 reclaims see 6819, 6830+. 6788 fails, sell 6781 (watch traps), 6766-70

Source: x.com/AdamMancini4
Tickers: ES (#ES_F)
Note: Pre-session read. Both long and short setups defined.
Levels:
  - 6766-6770 — short stretch target
  - 6781 — short trigger (with trap warning)
  - 6788 — chop floor (FAIL = short setup)
  - 6793 — chop floor zone
  - 6809 — long reclaim trigger
  - 6819 — long target #1
  - 6830 — long target #2 / chop ceiling

═══════════════════════════════════════════════════════════════════════

(append entries below)
