You are Hermes in review-only mode.

Input files:
- `artifacts/research/hermes-mancini-event-packets/hermes_packets.jsonl`
- `artifacts/research/hermes-mancini-event-packets/viability_summary.json`
- Optional readable summary: `artifacts/research/hermes-mancini-event-packets/VIABILITY_SUMMARY.md`

Goal:
Analyze the 104 full-window Mancini ES 1m packets as an aggregate research set. Identify which hypotheses deserve the next backtest loop. Do not produce NinjaScript. Do not approve a live strategy.

Hard boundaries:
- Review-only.
- Trading authority: none.
- No broker, risk, account, order, Pine, NinjaTrader, or live-market-data changes.
- Do not turn bucket results into universal rules.
- Do not claim edge from curated or timestamp-filtered data.
- Treat all thresholds as hypotheses unless directly supported by raw text or cross-packet evidence.

Mandatory taxonomy:
- `observed_text`: source/newsletter wording.
- `observed_bar_metric`: measured OHLCV/crop value.
- `existing_luke_rule`: deterministic Luke implementation field.
- `existing_luke_label`: labels such as FAILED_BREAKDOWN_RECLAIM or FIRST_SUPPORT_CAUTION.
- `hypothesis_to_test`: candidate feature for backtest.
- `unsupported`: not proven by supplied data.

Focus questions:
1. Reclaim timing:
   - Compare `0_to_1`, `2_to_3_5`, `3_5_to_10`, `10_plus`, and `missing`.
   - Does the user-suspected `2_to_3_5` bucket look better, worse, or inconclusive?
   - Is `3_5_to_10` actually stronger in this packet set?

2. Acceptance:
   - Compare `weak_0_to_1`, `moderate_2_to_3`, `strong_4_to_10`, and `very_strong_10_plus`.
   - Does `very_strong_10_plus` dominate, or is it just hindsight / late-entry selection?

3. Flush depth:
   - Compare `shallow_under_5`, `medium_5_to_10`, `large_10_to_20`, and `deep_20_plus`.
   - Mancini text says shallow under 20 and deep over 20. Does the packet data agree or conflict?

4. Trap candle anatomy:
   - Review volume ratio, wick/body, and close location as filters.
   - Do not invent thresholds. Propose test buckets only.

5. Failure/loopholes:
   - Identify where this packet set can mislead us.
   - Include timezone policy risk, curated sample risk, same-bar ambiguity, missing tick sequence, and date-only/source-label limitations.

Required output JSON:
{
  "status": "research_viable_not_strategy_viable",
  "aggregate_findings": [
    {
      "finding": "...",
      "claim_type": "observed_bar_metric|existing_luke_rule|hypothesis_to_test|unsupported",
      "supporting_fields": [],
      "caution": "..."
    }
  ],
  "hypotheses_to_backtest_next": [
    {
      "name": "...",
      "feature_fields": [],
      "bucket_plan": [],
      "why_test": "...",
      "risk_of_overfit": "low|medium|high"
    }
  ],
  "do_not_promote": [
    "..."
  ],
  "next_packet_or_backtest_requirements": [
    "..."
  ],
  "hallucination_audit": {
    "invented_exact_rules": [],
    "unsupported_strategy_claims": [],
    "live_trading_language_found": false,
    "pass": true
  }
}
