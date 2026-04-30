# Optimal ES Long Trading Strategies — As of 2026-04-30

**Last updated:** 2026-04-30
**Based on:** combined portfolio backtest, 92 candidates, 7 session dates (2026-04-07 through 2026-04-28)
**Apex account:** 50k EOD Trail — $50,000 starting balance, $2,000 EOD trailing drawdown limit
**Instrument:** ES (E-mini S&P 500 futures) long-only
**Bar resolution:** Results shown for both stop_first (pessimistic) and target_first (optimistic) modes. Truth lies between the two bounds.

---

## How to refresh this document

Re-run when new sessions are added:

```
node scripts/run-combined-atm-backtest.js
```

Then update the strategy table, equity curves, and caveats below based on the new report in:
`data/backtest/es-long-bracket/reports/combined-portfolio-<timestamp>.md`

---

## Strategy Ranking

| Rank | Strategy | Mode | P&L | Win% | Avg R | Max DD | Apex Breach |
|---|---|---|---:|---:|---:|---:|---|
| 1 | standard_3c + ATM 3pt | target_first | $7,200 | 58.54% | 0.38 | $675 | no |
| 1A | standard_3c + ATM 3pt | stop_first | $5,650 | 54.88% | 0.29 | $2,225 | **YES** |
| 2 | ATM 2pt + ATM 3pt | target_first | $7,025 | 60.67% | 0.42 | $0 | no |
| 2A | ATM 2pt + ATM 3pt | stop_first | $5,475 | 57.30% | 0.34 | $1,525 | no |
| 3 | ATM 3pt only | target_first | $5,325 | 57.33% | 0.35 | $225 | no |
| 3A | ATM 3pt only | stop_first | $3,775 | 53.33% | 0.25 | $1,775 | no |

> **Note on bar resolution modes:** When stop and target are both touched in the same 1-minute bar, stop_first assumes the stop hit first (loss), target_first assumes the target hit first (win). Real execution likely falls somewhere between these bounds depending on tick-level sequencing.

---

## Rank 1 — Standard 3c + ATM 3pt Scalp (Combined Portfolio)

### What this is

Combines two complementary lanes on the same set of candidates:

- **Lane A (Standard 3c):** Take the *first* touch at each confluence cluster per day as a 3-contract structural trade.
- **Lane B (ATM 3pt scalp):** Take *every* tap-3-or-later touch at each confluence cluster per day as a 2-contract 3-point scalp.

The two lanes don't duplicate. Lane A fires the first setup at a level. Lane B fires only after that level has been touched 3+ times and proved it keeps paying (ATM machine logic).

### Entry conditions

**Lane A (Standard 3c):**
1. At least one confluence cluster exists — levels from 2+ of Mancini / Bobby / Saty within 3 ES points of each other.
2. A 1-minute bar interacts with the cluster via one of two triggers:
   - **support_hold:** Bar touches cluster zone (low <= cluster high + 3 pts) and closes at or above cluster anchor. Price respected the level.
   - **trap_reclaim:** Bar low sweeps *below* cluster low (by more than 1 tick), but bar close (or next bar's close) returns to or above cluster anchor. The fake breakdown reversed.
3. Structural risk is within cap: stop must be ≤ 3 ES points below entry.
4. At least one target level exists above entry.
5. This is the *first* eligible trigger at this cluster on this calendar day.

**Lane B (ATM 3pt scalp):**
1. Same level cluster as Lane A, but this is tap 3 or later (same cluster has already triggered 2+ times on the same day).
2. ATM machine annotation is `true` on the candidate.
3. The 3pt scalp variant's `riskRewardOk` must be `true`: structural stop distance <= 3 ES points (reward = 3 pts must cover structural risk).
4. No one-per-day limit — every tap-3+ trigger fires.

### Entry execution

- **Entry price:** Max of (cluster anchor, bar close) rounded to nearest 0.25 tick. For trap_reclaim, use the next bar's close if it reclaims the anchor.
- **Entry time:** Timestamp of the trigger bar (or next bar for trap_reclaim).

### Stop placement

- **Both lanes use the same stop logic:** Structural stop placed 1 tick below the cluster invalidation low (lowest of: trigger bar low, next bar low, cluster low).
- The simulator uses `structure_1_tick` as the preferred policy (1 tick = 0.25 pts below invalidation low).
- Stop only accepted if resulting risk ≤ 3 ES points from entry.

### Targets

- **Lane A (Standard 3c):** All 3 contracts exit at `targets[0]` — the nearest Mancini/Saty/Bobby level above entry (minimum 1 point above).
- **Lane B (ATM 3pt):** 2 contracts exit at entry + 3.00 ES points (fixed scalp target).

### Contract management

| Lane | Contracts | Target | Stop | Max Risk/Trade |
|---|---|---|---|---|
| Standard 3c | 3 | First level above entry | Structural (≤3 pts) | $450 |
| ATM 3pt | 2 | Entry + 3.00 pts | Structural (≤3 pts) | $300 |
| Combined max | 5 | — | — | $750 |

> Stop movement is not modeled in this backtest. In live trading, consider moving to breakeven after Lane A fills its target.

### Execution policy

| Lane | Policy |
|---|---|
| Standard 3c | `first_per_cluster_day` — one trade per cluster per day |
| ATM 3pt | `atm_tap3_plus_only` — every tap-3+ signal |

### Backtest results (7 dates, 87 combined trades)

| Metric | stop_first | target_first |
|---|---:|---:|
| Total trades | 87 | 87 |
| Eligible (not no-setup) | 87 | 87 |
| Wins | — | — |
| Win rate | 54.88% | 58.54% |
| Avg R-multiple | 0.2940 | 0.3814 |
| Total P&L | $5,650 | **$7,200** |
| Max drawdown | $2,225 | **$675** |
| Apex breach | **YES (04-07)** | **no** |

### EOD equity curve (target_first)

| Date | Day P&L | EOD Equity | Trailing High | Apex Floor | Drawdown |
|---|---:|---:|---:|---:|---:|
| 2026-04-07 | -$675.00 | $49,325.00 | $50,000.00 | $48,000.00 | $675.00 |
| 2026-04-09 | $1,200.00 | $50,525.00 | $50,525.00 | $48,525.00 | $0.00 |
| 2026-04-16 | -$225.00 | $50,300.00 | $50,525.00 | $48,525.00 | $225.00 |
| 2026-04-20 | $1,337.50 | $51,637.50 | $51,637.50 | $49,637.50 | $0.00 |
| 2026-04-22 | $2,512.50 | $54,150.00 | $54,150.00 | $52,150.00 | $0.00 |
| 2026-04-23 | $2,862.50 | $57,012.50 | $57,012.50 | $55,012.50 | $0.00 |
| 2026-04-28 | $187.50 | $57,200.00 | $57,200.00 | $55,200.00 | $0.00 |

### Apex risk note

- **stop_first: BREACHES Apex on 2026-04-07.** Combined loss of -$2,225 (3c: -$450 + ATM 3pt: -$1,775) drops equity to $47,775 — $225 below the $48,000 floor. This is the critical Apex exposure of this combined portfolio: a single bad day in a volatile opening session can breach the $2,000 limit when both lanes fire and both lose.
- **target_first: $675 max drawdown, never approaches breach.** Under optimistic fill sequencing, a bad open day produces only -$675 (3c loses, ATM 3pt nets small positive), and the account never gets close to the $2,000 limit.
- **Real risk lies between these bounds.** The most conservative safe approach: monitor same-day combined exposure before taking the ATM lane on a day where the standard_3c trade has already lost.

---

## Rank 2 — ATM 2pt + ATM 3pt Scalp (Combined Portfolio)

### What this is

Takes only ATM machine setups (tap 3+ at any cluster), but fires *both* scalp variants simultaneously:
- **Lane A (ATM 2pt):** 2 contracts, 2-point fixed target
- **Lane B (ATM 3pt):** 2 contracts, 3-point fixed target

Both lanes require `riskRewardOk: true` (structural stop ≤ reward). 2pt scalps are more frequently rejected when structural risk is wide. Result: 160 total trade slots but only 94 eligible (2pt scalps with structural risk > 2 pts are skipped; 3pt scalps with structural risk > 3 pts are skipped).

**Standout characteristic: zero peak-to-trough drawdown in target_first mode.** The account never looked back from day 1 — even the one losing day (2026-04-07) was net positive (+$25) because winning ATM scalps offset the single losing ATM setup.

### Entry conditions

Both lanes share the same entry conditions:
1. Same trigger conditions as Rank 1 (support_hold or trap_reclaim at a confluence cluster).
2. **Tap 3 or later only.** `atmMachine: true` annotation required.
3. 2pt lane: `atm_2_contract_2pt_scalp` variant exists with `riskRewardOk: true` (structural risk ≤ 2 pts).
4. 3pt lane: `atm_2_contract_3pt_scalp` variant exists with `riskRewardOk: true` (structural risk ≤ 3 pts).
5. No per-day limit — every qualifying tap-3+ fires.

### Entry execution

Same as Rank 1: entry = max(cluster anchor, trigger bar close), rounded to nearest 0.25 tick.

### Stop placement

Same structural stop logic: 1 tick below cluster invalidation low, accepted only if ≤ 3 pts risk.

### Targets

| Lane | Contracts | Target |
|---|---|---|
| ATM 2pt | 2 | Entry + 2.00 pts (fixed) |
| ATM 3pt | 2 | Entry + 3.00 pts (fixed) |

### Execution policy

Both lanes: `atm_tap3_plus_only` — every tap-3+ signal, no daily cap.

### Backtest results (5 dates with ATM setups, 160 total trade slots / 94 eligible)

| Metric | stop_first | target_first |
|---|---:|---:|
| Total trades (slots) | 160 | 160 |
| Eligible (not no-setup) | 94 | 94 |
| Win rate | 57.30% | 60.67% |
| Avg R-multiple | 0.3423 | **0.4229** |
| Total P&L | $5,475 | **$7,025** |
| Max drawdown | $1,525 | **$0.00** |
| Apex breach | no | **no** |

> Note: `atm_2pt_scalp` frequently produces `no_setup` (66 out of 80 ATM candidates) because the 2pt reward does not cover the structural stop. Only 14 of 80 ATM candidates pass the 2pt `riskRewardOk` check. The 3pt lane runs all 80.

### EOD equity curve (target_first)

| Date | Day P&L | EOD Equity | Trailing High | Apex Floor | Drawdown |
|---|---:|---:|---:|---:|---:|
| 2026-04-07 | $25.00 | $50,025.00 | $50,025.00 | $48,025.00 | $0.00 |
| 2026-04-16 | $275.00 | $50,300.00 | $50,300.00 | $48,300.00 | $0.00 |
| 2026-04-20 | $1,150.00 | $51,450.00 | $51,450.00 | $49,450.00 | $0.00 |
| 2026-04-22 | $2,400.00 | $53,850.00 | $53,850.00 | $51,850.00 | $0.00 |
| 2026-04-23 | $3,175.00 | $57,025.00 | $57,025.00 | $55,025.00 | $0.00 |

### Apex risk note

- **target_first: perfect equity curve — zero drawdown, never below starting balance.** No Apex risk whatsoever across 5 trade dates.
- **stop_first: $1,525 max drawdown on 04-07, recovers by 04-22.** Apex floor at $48,000 was never breached (low point $48,475 on 04-07).
- **Caveat: this portfolio only fires on ATM machine days.** On 2026-04-07, 04-09, and 04-28 there were few or no ATM setups on some of those dates (04-09 and 04-28 appear in 3c-only results but not ATM results, meaning ATM machines were not activated on those dates). Check the candidate file before assuming ATM setups exist on any given day.
- **The 2pt scalp rejection rate (66/80 = 82.5% no-setup) suggests structural stops are frequently wider than 2 pts.** In practice, the 2pt lane is selectively available and should not be planned as a reliable daily income source.

---

## Rank 3 — ATM 3pt Scalp Only

### What this is

The single simplest strategy: trade only ATM machine setups, only the 3pt scalp variant, no standard bracket. No structural trade is taken at the first cluster touch — only tap-3+ setups qualify.

This isolates the ATM machine signal cleanly with no interaction from Lane A standard_3c trades.

### Entry conditions

1. Confluence cluster exists from Mancini/Bobby/Saty levels.
2. This cluster has been touched 3 or more times today at or near that price (`atmMachine: true`).
3. Current bar triggers support_hold or trap_reclaim.
4. `atm_2_contract_3pt_scalp` variant exists with `riskRewardOk: true` (structural stop ≤ 3 pts).
5. No daily limit — fire every tap-3+ trigger.

### Entry execution

Same as above: entry = max(cluster anchor, trigger bar close), 0.25 tick rounded.

### Stop placement

Structural stop 1 tick below cluster invalidation low. Risk capped at ≤ 3 pts.

### Target

2 contracts, exit at entry + 3.00 ES points.

### Execution policy

`atm_tap3_plus_only` — every qualifying tap-3+ signal, no per-day limit.

### Backtest results (5 dates with ATM setups, 80 trades)

| Metric | stop_first | target_first |
|---|---:|---:|
| Total / eligible trades | 80 / 80 | 80 / 80 |
| Settled | 75 | 75 |
| Wins | 40 | 43 |
| Losses | 35 | 32 |
| Timeouts | 5 | 5 |
| Win rate | 53.33% | 57.33% |
| Avg R-multiple | 0.2521 | 0.3476 |
| Total P&L | $3,775 | **$5,325** |
| Max drawdown | $1,775 | **$225** |
| Apex breach | no | **no** |

### EOD equity curve (target_first)

| Date | Day P&L | EOD Equity | Trailing High | Apex Floor | Drawdown |
|---|---:|---:|---:|---:|---:|
| 2026-04-07 | -$225.00 | $49,775.00 | $50,000.00 | $48,000.00 | $225.00 |
| 2026-04-16 | $225.00 | $50,000.00 | $50,000.00 | $48,000.00 | $0.00 |
| 2026-04-20 | $1,150.00 | $51,150.00 | $51,150.00 | $49,150.00 | $0.00 |
| 2026-04-22 | $1,800.00 | $52,950.00 | $52,950.00 | $50,950.00 | $0.00 |
| 2026-04-23 | $2,375.00 | $55,325.00 | $55,325.00 | $53,325.00 | $0.00 |

### EOD equity curve (stop_first)

| Date | Day P&L | EOD Equity | Trailing High | Apex Floor | Drawdown |
|---|---:|---:|---:|---:|---:|
| 2026-04-07 | -$1,775.00 | $48,225.00 | $50,000.00 | $48,000.00 | $1,775.00 |
| 2026-04-16 | $225.00 | $48,450.00 | $50,000.00 | $48,000.00 | $1,550.00 |
| 2026-04-20 | $1,150.00 | $49,600.00 | $50,000.00 | $48,000.00 | $400.00 |
| 2026-04-22 | $1,800.00 | $51,400.00 | $51,400.00 | $49,400.00 | $0.00 |
| 2026-04-23 | $2,375.00 | $53,775.00 | $53,775.00 | $51,775.00 | $0.00 |

### Apex risk note

- **stop_first: $1,775 max drawdown on 04-07.** Apex floor was $48,000; low point $48,225 — only $225 of margin above breach. The opening volatile session (04-07) was nearly fatal under pessimistic fill assumptions.
- **target_first: $225 max drawdown, immediate recovery.** Never meaningfully threatened the $2,000 Apex limit.
- **Alone, this is the cleanest single-strategy option.** No Apex risk under either mode, and the stop_first case recovers fully by 04-22.

---

## Cross-Strategy Comparison Summary

### What each strategy gives up and gets

| Strategy | What you gain | What you give up |
|---|---|---|
| Rank 1: 3c + ATM 3pt | Highest P&L ($7,200), 7 active dates (3c fires on 2 extra dates with no ATM) | Apex exposure in stop_first: combined bad day can exceed $2,000 limit |
| Rank 2: ATM 2pt + ATM 3pt | Zero drawdown (target_first), highest win rate (60.67%), best avg R (0.42) | Only fires on 5 dates; 2pt scalp frequently rejected (82.5% no-setup rate) |
| Rank 3: ATM 3pt only | Simplest, cleanest single strategy; no Apex risk under either mode | $1,900 less P&L than Rank 1; stop_first has uncomfortably close $225 Apex margin on 04-07 |

### What 2026-04-07 reveals about Apex risk

April 7 was a volatile opening session. Here is what each strategy produced that day:

| Strategy | Mode | Day P&L | Apex floor | Margin |
|---|---|---:|---:|---:|
| standard_3c only | either | -$450 | $48,000 | $1,100 |
| ATM 3pt only | stop_first | -$1,775 | $48,000 | $225 |
| ATM 3pt only | target_first | -$225 | $48,000 | $1,550 |
| **3c + ATM 3pt** | **stop_first** | **-$2,225** | **$48,000** | **-$225 (BREACH)** |
| 3c + ATM 3pt | target_first | -$675 | $48,000 | $925 |
| ATM 2pt + ATM 3pt | stop_first | -$1,525 | $48,000 | $475 |
| ATM 2pt + ATM 3pt | target_first | +$25 | $48,000 | $2,025 |

**Takeaway:** The 3c + ATM 3pt combination is the highest-P&L strategy but the most Apex-dangerous on a bad day. ATM 2pt + ATM 3pt (target_first) was the only strategy that was *profitable* on the worst day in the dataset. The 2pt scalps apparently caught enough wins to offset the 3pt losses on 04-07.

---

## Caveats and limitations

1. **7 dates of data.** This is a preliminary result, not a statistically robust conclusion. More sessions are needed before any of these strategies can be trusted in live trading.

2. **Candidate generation uses `maxThreeContractRiskPts: 3`.** Structural stops wider than 3 pts are rejected. If levels are spaced wider in future sessions, many setups will be filtered out. This is conservative and intentional, but it means fewer trades in choppier conditions.

3. **Standard 3c exits all 3 contracts at `targets[0]` with no scale-out.** Real strategy uses a scale-out ladder (1c at each of 3 levels, breakeven stops). This backtest simplification makes standard_3c more conservative (no trailed profit from partial fills).

4. **ATM machine tap count uses no lookahead.** Tap 3 is correctly identified only when taps 1 and 2 have already occurred chronologically. No future data leakage.

5. **Bar-level resolution only.** 1-minute OHLC bars cannot detect intrabar tick sequencing. The stop_first / target_first bounds define the plausible range; real fills will land somewhere between them.

6. **No commission or slippage modeled.** ES RTH spread is typically 0.25 pts. At 2-3 contracts per trade, add ~$12.50-$25 per round-trip to estimate real costs.

7. **No session-level context (FOMC, major news, gap-fill days).** The 7 backtest dates include 2026-04-07 which appears to be a high-volatility opening session. Real strategy would filter or reduce size on known high-volatility event days.

8. **Mancini/Bobby/Saty levels were not eyeballed for accuracy.** The levels in the session files were generated from the raw data normalizers. Some may be misclassified or stale relative to what a human would have used in real trading.

---

## Files

- Source report (JSON): `data/backtest/es-long-bracket/reports/combined-portfolio-2026-04-30T00-29-06-818Z.json`
- Source report (MD): `data/backtest/es-long-bracket/reports/combined-portfolio-2026-04-30T00-29-06-818Z.md`
- Prior blended report: `data/backtest/es-long-bracket/reports/atm-backtest-blended_3c_first_atm_tap3-2026-04-30T00-17-52-264Z.md`
- Candidate simulator: `lib/backtest-data/atm-simulator.js`
- Candidate generator: `lib/backtest-data/long-candidate-generator.js`
- CLI (per-strategy): `scripts/run-atm-backtest.js`
- CLI (combined portfolio): `scripts/run-combined-atm-backtest.js`
