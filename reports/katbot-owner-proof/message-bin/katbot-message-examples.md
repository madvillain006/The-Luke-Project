# Katbot Message Bin

Purpose: timestamped proof examples from actual Kat raw input and parsed signal output.

## Confluence And Timeliness Examples

### SPX/SPY/ES index lane - BEARISH
- Rule: 2 analysts aligned bearish inside 30 minutes
- First timestamp: 2026-03-04T15:14:33.374Z
- Last timestamp: 2026-03-04T15:35:34.415Z
- Window: 21 minute(s)
- Analysts: mathemeatloaf7, kaprik0rn3

Message 1478772647260196931 @ 2026-03-04T15:14:33.374Z
- Analyst/channel: mathemeatloaf7 / #☔︱spy-qqq-es-nq-vix
- Input: "$spy resistance is at 685-686 right now"
- Parsed: SPY BEARISH CHART_ANALYSIS; levels=685, 686

Message 1478777936449638541 @ 2026-03-04T15:35:34.415Z
- Analyst/channel: kaprik0rn3 / #🟢︱trade-floor
- Input: "SPY 30min. First attempt to close the bear gap we left open yesterday. Will act as resistance. Good place to take some off"
- Parsed: SPY BEARISH CHART_ANALYSIS; levels=none

### SPX/SPY/ES index lane - BULLISH
- Rule: 2 analysts aligned bullish inside 30 minutes
- First timestamp: 2026-04-21T19:45:28.282Z
- Last timestamp: 2026-04-21T19:53:48.548Z
- Window: 8 minute(s)
- Analysts: barrysanders329, kaprik0rn3

Message 1496235442834509946 @ 2026-04-21T19:45:28.282Z
- Analyst/channel: barrysanders329 / #🟢︱trade-floor
- Input: "SPY inside day breaking downward"
- Parsed: SPY BULLISH CHART_ANALYSIS; levels=none

Message 1496237541102321798 @ 2026-04-21T19:53:48.548Z
- Analyst/channel: kaprik0rn3 / #🟢︱trade-floor
- Input: "The cliche line here is no one goes broke taking profits. That's even truer with SPX plays if you do it long enough"
- Parsed: SPX BULLISH DIRECTIONAL; levels=none

### SPX/SPY/ES index lane - BEARISH
- Rule: 2 analysts aligned bearish inside 30 minutes
- First timestamp: 2026-04-21T15:27:14.623Z
- Last timestamp: 2026-04-21T15:50:54.201Z
- Window: 24 minute(s)
- Analysts: kaprik0rn3, mathemeatloaf7

Message 1496170457718587473 @ 2026-04-21T15:27:14.623Z
- Analyst/channel: kaprik0rn3 / #🟢︱trade-floor
- Input: "SPX 5min. Bear flag. SIMPOL"
- Parsed: SPX BEARISH CHART_ANALYSIS; levels=none

Message 1496176411860402266 @ 2026-04-21T15:50:54.201Z
- Analyst/channel: mathemeatloaf7 / #🟢︱trade-floor
- Input: "whos shorting $spy a couple weeks out up here"
- Parsed: SPY BEARISH DIRECTIONAL; levels=none

### SPX/SPY/ES index lane - BEARISH
- Rule: 2 analysts aligned bearish inside 30 minutes
- First timestamp: 2026-04-21T14:59:23.938Z
- Last timestamp: 2026-04-21T15:27:14.623Z
- Window: 28 minute(s)
- Analysts: mathemeatloaf7, kaprik0rn3

Message 1496163450358071468 @ 2026-04-21T14:59:23.938Z
- Analyst/channel: mathemeatloaf7 / #🟢︱trade-floor
- Input: "$spx second time to tag TL resistance"
- Parsed: SPX BEARISH CHART_ANALYSIS; levels=none

Message 1496167330739257364 @ 2026-04-21T15:14:49.093Z
- Analyst/channel: kaprik0rn3 / #🟢︱trade-floor
- Input: "If SPX 5min bear flags here, expect lower comes. It's also dead money time so we can stay here for another couple hours"
- Parsed: SPX BEARISH DIRECTIONAL; levels=none

Message 1496170457718587473 @ 2026-04-21T15:27:14.623Z
- Analyst/channel: kaprik0rn3 / #🟢︱trade-floor
- Input: "SPX 5min. Bear flag. SIMPOL"
- Parsed: SPX BEARISH CHART_ANALYSIS; levels=none

## Latest Parsed Examples

- 2026-04-28T19:09:35.220Z | SPX/SPY/ES index lane | ES | BULLISH | 1498763127297409035
  - "Alternatively, You could have gone long after the 8EMA (blue line) was reclaimed. Waiting for stronger confirmations reduces the chances of getting faked out"

- 2026-04-28T19:08:06.259Z | SPX/SPY/ES index lane | SPX | BULLISH | 1498762754167935079
  - "SPX 15min. Both EMAs reclaimed. Bullish EMA crossovers imminent. This is an example of what a reversal could look like for you"

- 2026-04-28T17:46:54.812Z | SPX/SPY/ES index lane | ES | BULLISH | 1498742321838162061
  - "Crude oil Futures 1W. If you would long this here, it should give you pause in loading calls too heavily in equities especially tech"

- 2026-04-28T17:05:16.381Z | SPX/SPY/ES index lane | ES | BEARISH | 1498731842659155979
  - "$iwm breakdown continues, the gaps below look juicy from here gaps are at 270, 265, 253"

- 2026-04-28T16:36:52.050Z | SPX/SPY/ES index lane | SPY | BEARISH | 1498724694176694443
  - "$spy if peaking at this TL resistance next target would be 698-690 below 690 can start opening the door to the large gap below at 660 imo"

- 2026-04-28T16:07:25.842Z | UNH equity/options shadow lane | UNH | BEARISH | 1498717286163283998
  - "UNH 1W. It's only Tuesday but that 364 resistance has held for almost a year"

- 2026-04-28T15:11:42.589Z | SPX/SPY/ES index lane | ES | BULLISH | 1498703263543853206
  - "You're not likely selling based on anything UPS does today lol"

- 2026-04-28T15:04:02.095Z | SPX/SPY/ES index lane | ES | BULLISH | 1498701332092293172
  - "You have to develop your system for gauging a reversal. Is it the 5min/10min/15min reclaim of an EMA or the VWAP or bullish crossover of EMAs? Reversals often show something objective and measurable. Of course, you ca..."

## Local Output Sink
- Suppressed Discord replies/posts are appended to `katbot-output-bin.jsonl`.
- This is where generated Discord-facing text goes until Conor approves public output.
