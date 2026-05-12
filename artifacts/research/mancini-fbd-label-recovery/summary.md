# Mancini FBD Label Recovery

Generated: 2026-05-12T20:12:19.385652+00:00

Scope: pre-Hermes research only. Recovered rows require review before merging into the gated package.

## Counts

- `source_qualified_hard_reject_rows`: 224
- `rows_with_existing_session_and_level_scanned`: 196
- `recovered_flush_reclaim_rows`: 101
- `recovered_unique_setups`: 73
- `candidate_eligible_after_recovery_rows`: 12
- `candidate_eligible_unique_setups`: 11
- `recovered_non_acceptance_rows`: 46

## Recovered By Family

- `non_acceptance_protocol`: 46 recovered; 9 candidate-eligible
- `classic_acceptance_backtest_from_below`: 33 recovered; 3 candidate-eligible
- `classic_acceptance_second_attempt_reclaim`: 16 recovered; 0 candidate-eligible
- `ladder_first_reclaim`: 6 recovered; 0 candidate-eligible
- `simple_reclaim_unclassified`: 0 recovered; 0 candidate-eligible

## Remaining Reject Reasons

- `immediate_failure_after_reclaim`: 45
- `source_after_entry_leakage`: 39
- `future_target_leakage`: 38
- `target_missing_or_below_entry`: 19
- `target_too_close_for_slippage`: 11

## Safety

- This does not modify `mancini-fbd-hermes-input`.
- SR-list-only rows remain excluded.
- MFE/MAE are emitted as validation labels only.
- No Pine, NinjaTrader, broker, risk, credential, or live execution path is touched.
