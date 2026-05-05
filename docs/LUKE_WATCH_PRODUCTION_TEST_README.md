# Luke Watch Production Test

This README explains how to use the TradingView indicator we just built:

- Source template: `tradingview/luke-watch-production-test.pine`
- Paste-ready generated Pine: `artifacts/tradingview/luke-watch-production-test.generated.pine`

Use the generated file when pasting into TradingView. It includes the current exported Mancini, Dubz, heatmap/GEX, and other Luke level inputs.

## What This Indicator Is

`Luke Watch Production Test - Realistic Accounting` is a visual TradingView indicator for watching Luke-style long reclaim setups.

It is not a strategy.
It does not place orders.
It does not connect to a broker.
It does not make `/operator-v2` write-capable.
It cannot read manual TradingView drawings.

Its job is to show when the Luke/Pine reclaim logic reaches an actual long candidate with bracket levels, then track how that bracket would have resolved on the chart.

## Why This Version Exists

Earlier versions were useful but visually noisy:

- The hard-mode strategy is intentionally pessimistic.
- The older visual indicator showed too many small labels around candles.
- The word `PAPER` made the chart look less professional.
- Individual trade outcomes were harder to read than the session total.

This production-test indicator keeps the same practical chart workflow but cleans up the visual layer:

- actual entry candidate boxes say `LONG`
- small candle-adjacent LONG markers are off by default
- each actual bracketed long gets its own persistent green entry box
- when that trade resolves, the same box gets a final result line
- totals remain in the top scorecard and lower event ledger

## Recommended TradingView Workflow

1. Open `artifacts/tradingview/luke-watch-production-test.generated.pine`.
2. Copy the full file.
3. In TradingView, open Pine Editor.
4. Paste the generated Pine.
5. Save it as something obvious, for example:

   `Luke Watch Production Test`

6. Add it to your ES chart.
7. Use it on the same timeframe you are actively reviewing, usually 1m or 5m.

If you need fresh levels later, rerun:

```powershell
npm run tradingview:export-levels
```

Then paste the regenerated file from:

```text
artifacts/tradingview/luke-watch-production-test.generated.pine
```

## Main Visual Elements

### WATCH

`WATCH` means a level is interesting but not yet a full long candidate.

Do not treat WATCH as an entry.

### ARMED

`ARMED` means the reclaim context is closer, but the full candidate conditions have not completed yet.

Do not treat ARMED as an entry.

### LONG Box

The green `LONG #...` box is the important one.

It marks an actual bracketed long candidate from the indicator logic. That box includes:

- cluster level
- entry
- accounting fill
- stop
- T1
- T2
- current or final trade status

When the long first appears, the bottom line says:

```text
Status: open
```

When the bracket resolves, the same box updates to one of:

```text
Result: STOPPED ...
Result: TP1 ...
Result: TP1 + BE ...
Result: TP2 ...
```

If TP1 hits and the runner is still alive, it can temporarily show:

```text
Status: TP1 hit / runner BE
```

That means the trade has paid the first target and moved the remaining runner behavior to break-even logic.

## Accounting Mode

The indicator uses realistic accounting, not hard-mode accounting by default.

Default:

```text
entry_only_0_25
```

That means:

- entry is charged 0.25 points adverse
- exit is treated as exact
- commission is still charged

Default commission:

```text
$5.00 per contract round trip
```

Available accounting modes:

```text
commission_only
entry_only_0_25
exit_only_0_25
both_sides_0_25_each
custom_entry_only
custom_exit_only
custom_both_sides
```

## Recommended Settings

For normal chart review, start with:

```text
Realistic accounting mode: entry_only_0_25
Commission per contract round trip: 5.00
Mixed-bar PnL policy: conservative_stop
Show small candle LONG marker: off
Show LONG entry boxes: on
Track candidate results: on
Show session scorecard: on
Show event ledger: on
```

Use `entry_only_0_25` as the default practical read.

Use `commission_only` only when you want to see whether the raw signal logic is strong before fill friction.

Use `both_sides_0_25_each` when you want a realistic stress test.

Use the hard-mode strategy separately when you want the punishment case.

## How To Read Results

Focus on three layers:

1. Individual LONG boxes
2. Top-right session scorecard
3. Bottom-right event ledger

The individual LONG boxes tell you what happened to each candidate.

The top scorecard tells you whether the session is behaving well overall:

- success/attempt
- stopped before TP1
- total points/dollars
- commission-adjusted dollars
- realistic net after commission/slippage

The event ledger gives the chronological audit trail.

Do not judge the setup from one isolated label. Look for whether the session is repeatedly producing clean TP1 or TP2 outcomes without clustering too many stop-outs.

## Practical Interpretation

Good behavior:

- LONG boxes are not firing constantly.
- Entries are near meaningful level clusters.
- Stops are not getting tagged immediately.
- TP1 hits are common.
- TP1 + BE outcomes show the trade paid something before failing.
- TP2 hits appear often enough to matter.
- The session scorecard stays net positive after realistic costs.

Weak behavior:

- many LONG boxes fire in chop
- multiple STOPPED results cluster near the same level
- price repeatedly tags entry then fails before TP1
- session net is only positive before costs
- most wins are same-bar or visually ambiguous

## What This Does Better Than The Earlier Files

Compared with the older visual indicator:

- cleaner professional label language
- no big `PAPER` marker clutter
- no repeated result boxes covering candles
- each actual long candidate keeps its own readable status/result
- realistic accounting is selectable instead of hard-coded and confusing

Compared with the hard-mode strategy:

- easier to use live on a chart
- less pessimistic by default
- better for discretionary review
- still lets you stress the setup with both-side slippage if needed

The hard-mode strategy is still valuable, but it answers a different question:

```text
Does this still survive if fills and same-bar ambiguity are punished?
```

This production-test indicator answers:

```text
What does the setup look like under a practical, realistic accounting model?
```

## Limitations

This is still a TradingView indicator.

It cannot prove:

- broker queue priority
- actual fill order inside a 1-minute candle
- whether stop or target was hit first inside ambiguous candles
- whether manually drawn TradingView lines were relevant
- whether stale source levels should have been ignored

It should be treated as a visual validation and decision-support tool, not execution infrastructure.

## Best Current Recommendation

Use this indicator as the main chart-facing view.

Use:

```text
entry_only_0_25
```

as the normal read.

Use:

```text
both_sides_0_25_each
```

as the stress read.

Use the hard-mode strategy only when you want to attack the signal.

Do not promote anything live from this alone. The right next step is to compare days where the production-test indicator shows clean LONG boxes against Luke replay artifacts and make sure the same setups are not only TradingView visual artifacts.
