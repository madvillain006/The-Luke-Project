# Mancini FBD Algo Math Walk-Forward Report

Generated: 2026-05-12T17:19:12.858479+00:00

Scope: deterministic offline research only. Candidate scores avoid MFE/MAE and other future outcome columns.

## Input Counts

- Training rows: 739
- Feature rows: 739
- Hard-rejected rows: 693
- Unique setups: 698

## Overall Non-Rejected Results

- `rows`: 46
- `unique_setups`: 46
- `tp_plus_2_hit_rate`: 0.9783
- `tp_plus_3_hit_rate`: 0.9565
- `next_level_hit_rate`: 0.3261
- `stop_first_rate`: 0.3478
- `false_armed_rate`: 0.0
- `median_mae_before_tp1`: 3.25
- `avg_mfe_15m`: 8.2935
- `avg_mae_15m`: 4.3804
- `avg_mfe_60m`: 11.6957
- `avg_mae_60m`: 8.7989
- `expectancy_points_with_0_5_es_point_slippage`: -2.2337

## Per Family

- `classic_acceptance_backtest_from_below`: rows=4, unique=4, tp2=1.0, stop_first=0.0, expectancy=2.5
- `classic_acceptance_second_attempt_reclaim`: rows=2, unique=2, tp2=1.0, stop_first=0.5, expectancy=-4.875
- `non_acceptance_protocol`: rows=24, unique=24, tp2=1.0, stop_first=0.4167, expectancy=-2.3438
- `simple_reclaim_unclassified`: rows=16, unique=16, tp2=0.9375, stop_first=0.3125, expectancy=-2.9219

## Candidate Rules

- `candidate_score_055`: rows=35, unique=35, tp2=0.9714, tp3=0.9429, next=0.2857, stop_first=0.4571, false_armed=0.0, expectancy=-3.7214
- `non_acceptance_only`: rows=22, unique=22, tp2=1.0, tp3=0.9545, next=0.3636, stop_first=0.4545, false_armed=0.0, expectancy=-2.7841
- `classic_backtest_only`: rows=4, unique=4, tp2=1.0, tp3=1.0, next=0.25, stop_first=0.0, false_armed=0.0, expectancy=2.5
- `second_attempt_review_only`: rows=2, unique=2, tp2=1.0, tp3=1.0, next=0.0, stop_first=0.5, false_armed=0.0, expectancy=-4.875
- `ladder_first_reclaim`: rows=0, unique=0, tp2=None, tp3=None, next=None, stop_first=None, false_armed=None, expectancy=None
- `level_to_level_target_R`: rows=24, unique=24, tp2=0.9583, tp3=0.9583, next=0.0833, stop_first=0.4583, false_armed=0.0, expectancy=-2.4062

## Negative Controls

- `random_support_levels`: rows=114, unique=114, tp2=0.7719, stop_first=0.3246, false_armed=0.0877, expectancy=-3.0395
- `direct_support_bids_without_flush_reclaim`: rows=16, unique=16, tp2=0.0, stop_first=0.0, false_armed=0.0, expectancy=-0.5
- `late_reclaim_after_first_reclaim_already_moved`: rows=96, unique=96, tp2=0.8958, stop_first=0.2396, false_armed=0.0729, expectancy=-0.9844
- `saty_only_levels_no_mancini_source_setup`: rows=0, unique=0, tp2=None, stop_first=None, false_armed=None, expectancy=None
- `shuffled_timestamps`: rows=46, unique=46, tp2=0.9783, stop_first=0.3478, false_armed=1.0, expectancy=-2.2337

## Walk Forward

- `walk_forward_1`: train_dates=14, test_dates=29, train_unique=14, test_unique=32, test_tp2=0.9688, test_stop_first=0.25, test_expectancy=-1.3281
- `walk_forward_2`: train_dates=28, test_dates=15, train_unique=18, test_unique=28, test_tp2=0.9643, test_stop_first=0.2857, test_expectancy=-1.875

## Safety Gates

- `sr_list_only` rows are hard-rejected before candidate rule scoring.
- Negative controls are reported separately and are not promoted into positive examples.
- Date-based walk-forward splits are used; no random row split is used.
- MFE/MAE, hit rates, and stop-first are labels/outcomes, not candidate-score inputs.
