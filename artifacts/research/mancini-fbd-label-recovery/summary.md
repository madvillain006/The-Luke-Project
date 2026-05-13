# Mancini FBD Label Recovery

Generated: 2026-05-13T00:59:10.401586+00:00

Scope: pre-Hermes research only. Recovered rows require review before merging into the gated package.

## Counts

- `source_qualified_hard_reject_rows`: 427
- `rows_with_existing_session_and_level_scanned`: 263
- `recovered_flush_reclaim_rows`: 125
- `recovered_unique_setups`: 61
- `candidate_eligible_after_recovery_rows`: 11
- `candidate_eligible_unique_setups`: 10
- `recovered_non_acceptance_rows`: 67

## Recovered By Family

- `non_acceptance_protocol`: 67 recovered; 9 candidate-eligible
- `classic_acceptance_backtest_from_below`: 28 recovered; 2 candidate-eligible
- `classic_acceptance_second_attempt_reclaim`: 23 recovered; 0 candidate-eligible
- `ladder_first_reclaim`: 6 recovered; 0 candidate-eligible
- `simple_reclaim_unclassified`: 1 recovered; 0 candidate-eligible

## Remaining Reject Reasons

- `source_after_entry_leakage`: 85
- `future_target_leakage`: 80
- `immediate_failure_after_reclaim`: 45
- `target_missing_or_below_entry`: 19
- `target_too_close_for_slippage`: 9

## Safety

- This does not modify `mancini-fbd-hermes-input`.
- SR-list-only rows remain excluded.
- MFE/MAE are emitted as validation labels only.
- No Pine, NinjaTrader, broker, risk, credential, or live execution path is touched.
