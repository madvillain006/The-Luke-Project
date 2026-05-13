# Mancini FBD Algo Math Walk-Forward Report

Generated: 2026-05-13T11:11:49.405574+00:00

Scope: deterministic offline research only. Candidate scores avoid MFE/MAE and other future outcome columns.

## Input Counts

- Training rows: 1129
- Feature rows: 1129
- Hard-rejected rows: 1072
- Unique setups: 973

## Overall Non-Rejected Results

- `rows`: 57
- `unique_setups`: 50
- `tp_plus_2_hit_rate`: 1.0
- `tp_plus_3_hit_rate`: 0.7719
- `next_level_hit_rate`: 0.5789
- `stop_first_rate`: 0.0526
- `false_armed_rate`: 0.0702
- `median_mae_before_tp1`: 5.5
- `avg_mfe_15m`: 10.1579
- `avg_mae_15m`: 7.1009
- `avg_mfe_60m`: 15.443
- `avg_mae_60m`: 10.557
- `expectancy_points_with_0_5_es_point_slippage`: 1.5307

## Overall Packet-Deduped Results

- `rows`: 43
- `unique_setups`: 40
- `tp_plus_2_hit_rate`: 1.0
- `tp_plus_3_hit_rate`: 0.8837
- `next_level_hit_rate`: 0.5349
- `stop_first_rate`: 0.0698
- `false_armed_rate`: 0.093
- `median_mae_before_tp1`: 5.5
- `avg_mfe_15m`: 11.3372
- `avg_mae_15m`: 7.8953
- `avg_mfe_60m`: 17.3547
- `avg_mae_60m`: 11.5465
- `expectancy_points_with_0_5_es_point_slippage`: 1.4477

## Per Family

- `ladder_first_reclaim`: rows=4, unique=4, tp2=1.0, stop_first=0.5, expectancy=-5.25
- `non_acceptance_protocol`: rows=42, unique=39, tp2=1.0, stop_first=0.0, expectancy=2.2738
- `simple_reclaim_unclassified`: rows=11, unique=7, tp2=1.0, stop_first=0.0909, expectancy=1.1591

## Candidate Rules

- `candidate_score_055`: rows=42, unique=38, tp2=1.0, tp3=0.8571, next=0.4286, stop_first=0.0714, false_armed=0.0952, expectancy=1.3929; packet_deduped_rows=38, packet_deduped_expectancy=1.3092
- `non_acceptance_only`: rows=37, unique=34, tp2=1.0, tp3=0.973, next=0.5135, stop_first=0.0, false_armed=0.027, expectancy=2.2432; packet_deduped_rows=34, packet_deduped_expectancy=2.2206
- `classic_backtest_only`: rows=0, unique=0, tp2=None, tp3=None, next=None, stop_first=None, false_armed=None, expectancy=None; packet_deduped_rows=0, packet_deduped_expectancy=None
- `second_attempt_review_only`: rows=0, unique=0, tp2=None, tp3=None, next=None, stop_first=None, false_armed=None, expectancy=None; packet_deduped_rows=0, packet_deduped_expectancy=None
- `ladder_first_reclaim`: rows=4, unique=4, tp2=1.0, tp3=0.5, next=0.25, stop_first=0.5, false_armed=0.5, expectancy=-5.25; packet_deduped_rows=4, packet_deduped_expectancy=-5.25
- `level_to_level_target_R`: rows=17, unique=14, tp2=1.0, tp3=0.8824, next=0.0588, stop_first=0.1176, false_armed=0.1176, expectancy=1.3824; packet_deduped_rows=15, packet_deduped_expectancy=1.2333

## Negative Controls

- `random_support_levels`: rows=98, unique=98, tp2=0.8265, stop_first=0.1531, false_armed=0.2041, expectancy=-0.8047
- `direct_support_bids_without_flush_reclaim`: rows=0, unique=0, tp2=None, stop_first=None, false_armed=None, expectancy=None
- `late_reclaim_after_first_reclaim_already_moved`: rows=106, unique=102, tp2=0.7736, stop_first=0.0943, false_armed=0.1792, expectancy=-0.0545
- `saty_only_levels_no_mancini_source_setup`: rows=0, unique=0, tp2=None, stop_first=None, false_armed=None, expectancy=None
- `shuffled_timestamps`: rows=57, unique=50, tp2=1.0, stop_first=0.0526, false_armed=1.0, expectancy=1.5307

## Walk Forward

- `walk_forward_1`: train_dates=14, test_dates=28, train_unique=16, test_unique=34, test_tp2=1.0, test_stop_first=0.0732, test_expectancy=1.1524
- `walk_forward_2`: train_dates=28, test_dates=14, train_unique=26, test_unique=24, test_tp2=1.0, test_stop_first=0.1071, test_expectancy=0.8661

## Safety Gates

- `sr_list_only` rows are hard-rejected before candidate rule scoring.
- Negative controls are reported separately and are not promoted into positive examples.
- Date-based walk-forward splits are used; no random row split is used.
- MFE/MAE, hit rates, and stop-first are labels/outcomes, not candidate-score inputs.
