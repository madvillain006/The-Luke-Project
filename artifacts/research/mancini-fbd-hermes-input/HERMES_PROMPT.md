# Hermes Prompt: Mancini Fake-Breakdown Algorithm Math

You are reviewing a research-only ES fake-breakdown / failed-breakdown package based on Mancini source text plus local ES 1m data. Do not create live trading instructions. Do not create NinjaTrader code first. Do not assume support/resistance-list-only rows are positive examples.

Goal: propose deterministic, testable math and rule candidates that Codex can verify locally before any NinjaTrader Strategy Analyzer, Playback, or Market Replay work.

Safety boundary:
- Research, historical, replay, and shadow only.
- No live trading behavior.
- Do not touch or route broker accounts, credentials, Pine, live execution, risk checks, kill switches, order validation, or position sizing.
- Hermes may propose math, but local artifacts and replay must verify it.
- Support/resistance-list-only rows remain negative/control/context rows unless direct source and chart evidence prove otherwise.

Important current safety-gate fact:
- The strict direct audit has 0 `positive_training_candidate` rows.
- That is a safety-gate result, not proof the pattern is absent.
- Build broader review labels from `source_confirmed_fbd`, `source_planned_fbd`, `chart_confirmed_reclaim`, `chart_confirmed_non_acceptance`, `source_negative_control`, `sr_list_only`, `chart_mismatch`, `needs_crop`, and `data_only`.

Current local counts:
- Direct audit rows: 478
- Context events: 2456
- Packet rows: 172
- Training rows: 739
- Feature rows: 739
- Hard-rejected feature rows: 693
- Unique setups: 698
- Real packet gallery SVG files: 172
- Real packet gallery PNG files: 172
- Missing gallery PNG sidecars from manifest: 0

Current label counts:
- `source_confirmed_fbd`: 139
- `source_planned_fbd`: 149
- `source_negative_control`: 34
- `sr_list_only`: 114
- `chart_confirmed_reclaim`: 214
- `chart_confirmed_non_acceptance`: 95
- `chart_mismatch`: 3
- `needs_crop`: 297
- `data_only`: 416

Use these package files:
1. `selected_training_rows.jsonl`
2. `feature_dictionary.md`
3. `candidate_rule_scores.json`
4. `walk_forward_report.md`
5. `source_file_index.md`

Required output format:

```json
{
  "features": {},
  "state_machine": {},
  "entry_rules": [],
  "invalidation_rules": [],
  "target_rules": [],
  "risk_model": {},
  "training_labels": {},
  "negative_controls": {},
  "validation_plan": {},
  "ninja_shadow_telemetry_fields": []
}
```

Required analysis:
1. Propose deterministic formulas for significant low score, flush quality, reclaim acceptance, non-acceptance, squeeze/target room, source confidence, and candidate score.
2. Keep no-lookahead math separate from outcome labels. MFE/MAE, hit rates, stop-first, and future targets are labels/validation only.
3. Model these families separately: `non_acceptance_protocol`, `classic_acceptance_backtest_from_below`, `classic_acceptance_second_attempt_reclaim`, `ladder_first_reclaim`, and `simple_reclaim_unclassified`.
4. Preserve hard rejects for support-list-only, no source, no bars, no reclaim, chart/source mismatch, future target leakage, source-after-entry leakage, target below/too close, and immediate reclaim failure.
5. Compare against negative controls: random support levels, direct support bids without flush/reclaim, late reclaim, Saty-only/no Mancini source setup, and shuffled timestamps.
6. Recommend top 3 rule families to test next, including minimum sample-size requirements and what would invalidate each rule.
7. List exact Ninja shadow telemetry fields needed later, but do not write Ninja code.
