# Mancini Failed Breakdown Research Report

Date: 2026-05-10
Scope: review-only research for Hermes input. Not a trading recommendation. Not NinjaScript approval.

## Bottom Line

We are not 100% confident in a mechanical strategy yet.

We are confident about the research boundary:

- Mancini describes a real pattern: meaningful support/low gets swept, price reclaims it, then proves acceptance.
- His text does not define one universal machine rule for all cases.
- Any exact rule must be labeled as one of:
  - raw Mancini evidence,
  - existing Luke implementation,
  - measured ES 1m bar metric,
  - hypothesis.

The strongest inferred working hypothesis is:

> A failed breakdown becomes more credible when price reclaims the level within roughly 2-3.5 minutes, then either holds above it for multiple 1m closes, retests and holds, or quickly escapes the 0-5 point danger zone above the reclaimed level.

That 2-3.5 minute reclaim window is an inference from context, not a quoted universal Mancini rule. It lines up with his “few minutes” language, his non-acceptance examples, and the existing Luke acceptance-window work.

## Raw Mancini Evidence

What the raw text supports:

- A failed breakdown is not any dip below a level. It must be a trap below a meaningful low/support.
- The low should matter: prior day low, multi-hour low, shelf/cluster low, major trendline, breakout/backtest zone.
- Price must convincingly lose the low.
- Shallow failed breakdown: under 20 ES points.
- Deep failed breakdown: over 20 ES points.
- Deep flushes usually need more acceptance.
- Acceptance is structure, not just time.
- Non-acceptance examples often use about +5 ES points above the reclaimed low and holding for a few minutes.
- One explicit invalidation-style example says the setup is valid as long as the lowest low holds.

What the raw text does not prove:

- No universal “must go X ticks below support” rule.
- No universal “must close above for exactly N bars” rule.
- No volume threshold.
- No universal stop-loss formula.
- No proof that this is live-tradable.

## Existing Luke Rules

Luke already has research implementations around this pattern:

- Fake breakdown/reclaim detectors.
- Mancini acceptance detector.
- State-machine watchlist rules A-F.
- Multi-source ladder reclaim research.
- Prop-risk research.

Important: Luke rules are implementation assumptions, not Mancini quotes.

Examples:

- `acceptanceBars: 3` is Luke logic.
- `minFlushDepthPoints: 1.0` is Luke logic.
- `highConfluenceFlushDepthPoints: 2.0` is Luke logic.
- “close back below reclaimed level before armed” is Luke state-machine logic.

These may be useful, but Hermes must not treat them as Adam Mancini’s exact definition unless raw text supports them.

## Independent Theory

The independent OHLCV-only theory is useful because it does not start from Mancini or Luke rules.

Proposed “Liquidity-Sweep Reclaim” signature:

1. Reference floor
   - Prior 30-60 1m bars define a local floor.
   - Stronger if at least 2 prior lows sit within 0.5-1.0 ES point of the same shelf.

2. Breakdown depth
   - Price must trade below the floor.
   - Normalize depth by recent volatility:
     - `depthNorm = (floor - low) / medianRange20`
   - Initial hypothesis:
     - below `0.25 depthNorm` may be noise,
     - `0.25-1.25 depthNorm` may be trap territory,
     - above `1.25 depthNorm` may be real breakdown unless reclaimed strongly.

3. Trap candle
   - Elevated volume versus recent 20-bar median.
   - Lower wick/body ratio elevated.
   - Close location in upper half or upper third of candle.

4. Reclaim
   - Reclaim should be a 1m close, not just a wick.
   - Working hypothesis: reclaim within roughly 2-3.5 minutes matters.
   - Same-bar or next-bar reclaim is strongest but can be noisy unless followed by acceptance.

5. Acceptance
   - Two or three 1m closes above the level.
   - Retest of the level that holds.
   - Second reclaim after first reclaim fails.
   - Fast impulse through the +5 point danger zone, followed by 2-3 minutes holding above.

6. Invalidation candidates
   - Conservative: any 1m close below trap low.
   - Structural: close below trap low minus 1 tick.
   - Acceptance failure: after reclaim, two closes below the reclaimed level zone.
   - Time failure: no reclaim within the 2-3.5 minute working window for shallow traps.

## Data Coverage

We went through a lot of local material.

High-level counts from the agent audit:

- 2 large raw Mancini log files:
  - `The Longer Mancini Logs.txt`: 3,520 lines.
  - `The Mancini Logs 3-15-2026 - 5-6-2026.txt`: 5,423 lines.
- 226 derived Mancini post records.
- 27 structured/text Mancini surfaces checked.
- 29,038 total rows/items reviewed across structured/text surfaces.
- 28,812 level-bearing rows/items.
- 23,847 timestamped rows.
- 23,835 exact ES bar matches.
- 23,734 full timestamp+level crop-ready rows.
- 67,540 unique merged ES 1m bars.
- 52,927 overlapping/duplicate ES bar timestamps across duplicate files.
- ES coverage from 2025-12-15 through 2026-05-07, with strongest usable range from 2026-03-26 through 2026-05-07.

The expensive part was not one answer. It was the parallel read-only audit:

- literal Mancini corpus extraction,
- ES 1m data coverage matrix,
- Hermes schema design,
- Ninja/Hermes safety boundary review,
- independent OHLCV theory,
- local cropper implementation and verification,
- repeated broad file searches over docs, artifacts, data, scripts, tests, and reports.

That explains why the session burned so much plan usage quickly: it used multiple long-context agents, each scanning large repo surfaces and returning detailed reports, plus local verification.

## Current Safe Tooling

Added:

- `scripts/crop_mancini_windows.py`

Purpose:

- Offline research helper.
- Reads local 1m Barchart CSVs.
- Reads timestamped event files.
- Crops 15-minute windows around events.
- Computes:
  - flush points/ticks,
  - trap candle OHLCV,
  - wick/body ratio,
  - first reclaim close,
  - consecutive 1m closes above level,
  - candidate invalidation levels.

Verified:

```powershell
python scripts\crop_mancini_windows.py --self-test
```

Passed.

Important limitation:

- Date-only daily plans are correctly rejected as crop centers unless a timestamp is supplied. Hermes should quarantine those or mark them as context-only.

## Loopholes To Close

- Timezone policy conflict:
  - Existing code often treats Barchart `Time` as ET.
  - Some scripts have CT-to-ET conversion paths.
  - Barchart footer says downloaded in CDT, but that does not prove bar timezone.
  - Fix: every Hermes packet must include `timezone_policy`.

- Raw text vs implementation:
  - Fix: Hermes must label Luke thresholds as existing implementation, not Mancini truth.

- Date-only logs:
  - Fix: no timestamped crop unless timestamp is exact or explicitly inferred with confidence.

- Volume interpretation:
  - Fix: volume ratio can be a hypothesis, not a Mancini rule.

- Intrabar ambiguity:
  - 1m OHLC cannot prove stop/target order inside the same candle.
  - Fix: keep stop-first/target-first ambiguity explicit.

- Live readiness:
  - Fix: keep everything review-only until SIM-only design is separately approved.

## Exact Hermes Prompt To Use Now

```text
You are Hermes in review-only mode.

Goal:
Compare Adam Mancini failed-breakdown source evidence against ES 1-minute OHLCV crop windows and existing Luke deterministic rule outputs. Your job is to extract a mathematical signature candidate, not to approve a live strategy.

Hard boundaries:
- Do not create live trading rules.
- Do not imply live readiness.
- Do not recommend position size.
- Do not touch broker, account, risk, execution, Pine, NinjaTrader, or live market-data paths.
- Do not convert a hypothesis into an approved Luke rule.
- Do not invent exact thresholds unless they are present in supplied source text, measured bar metrics, or existing Luke rule output.

Claim labels:
Every claim must be labeled as exactly one of:
- observed_text
- observed_bar_metric
- existing_luke_rule
- hypothesis
- unsupported

Inputs you will receive:
1. source_text_evidence
   - source_path
   - line_start / line_end
   - short quote
   - normalized text
   - timestamp quality: exact, inferred, date_only, or missing
   - level
   - instrument

2. crop_window
   - bars source path
   - window CSV path
   - center timestamp ET
   - minutes before/after
   - first/last timestamp
   - bar count
   - missing bar count
   - timezone policy

3. bar_metrics
   - level
   - flush points
   - flush ticks
   - trap candle timestamp
   - trap candle OHLCV
   - trap candle wick/body ratio
   - first reclaim close timestamp
   - consecutive 1m closes above level
   - candidate invalidation levels

4. existing_luke_rule_match
   - parser output
   - trigger detector output
   - state-machine/watchlist match
   - no-lookahead flag

5. independent_theory_features
   - floor quality
   - volatility-normalized flush depth
   - volume ratio
   - wick/body ratio
   - close location
   - reclaim time
   - acceptance type
   - danger-zone behavior

Known context:
- Mancini text supports: meaningful low/support, sweep/flush, reclaim, acceptance, shallow under 20 points, deep over 20 points, +5 and hold a few minutes in non-acceptance examples, and rare lowest-low-holds invalidation examples.
- Mancini text does not prove: universal close count, universal volume threshold, universal stop formula, or live-trading readiness.
- Working inference to test: reclaim within roughly 2-3.5 minutes appears important. Treat this as a hypothesis unless directly supported by the packet.

Tasks:
1. Summarize what the source text explicitly says.
2. Summarize what the ES 1m bar metrics show.
3. Compare source text to existing Luke rules.
4. Compare source text to the independent OHLCV theory.
5. Identify supported, conflicting, and unsupported assumptions.
6. Propose candidate mathematical signatures as hypotheses only.
7. Return a hallucination audit.

Output JSON:
{
  "packet_id": "...",
  "summary": "...",
  "claim_table": [
    {
      "claim": "...",
      "claim_type": "observed_text|observed_bar_metric|existing_luke_rule|hypothesis|unsupported",
      "citation_or_field": "..."
    }
  ],
  "rule_alignment": {
    "existing_luke_rule_supported": true,
    "supported_parts": [],
    "unsupported_parts": [],
    "conflicts": []
  },
  "mathematical_signature_hypotheses": [
    {
      "name": "...",
      "conditions": [],
      "confidence": "low|medium|high",
      "evidence_fields": [],
      "not_a_rule": true
    }
  ],
  "missing_evidence": [],
  "hallucination_audit": {
    "invented_exact_rules": [],
    "uncited_claims": [],
    "live_trading_language_found": false,
    "pass": true
  }
}
```

## Next Practical Step

Create Hermes JSONL packets from:

- `artifacts/research/mancini-context-protocol/examples.csv`
- `artifacts/research/mancini-context-protocol/events.csv`
- selected raw Mancini quotes from the two longer log files
- ES 1m crop windows from `scripts/crop_mancini_windows.py`

Do not use daily plan levels as timestamped crop evidence unless we manually assign or infer timestamps and mark confidence.
