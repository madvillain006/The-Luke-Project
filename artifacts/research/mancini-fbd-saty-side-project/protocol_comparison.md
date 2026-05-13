# Mancini FBD SATY Side-Project Protocol Comparison

Generated: 2026-05-13T09:43:11.690Z

Scope: research/historical/shadow only. SATY-generated rows are negative/control comparisons unless a separate Mancini source setup exists.

## Coverage

- Sessions loaded: 37
- Valid SATY sessions: 22
- SATY protocol rows: 526

## SATY By Protocol

- `non_acceptance_protocol`: rows=118, unique=118, tp2=0.9746, stop_first=0.0424, expectancy=2
- `classic_acceptance_backtest_from_below`: rows=164, unique=164, tp2=0.9085, stop_first=0.1098, expectancy=1.3445
- `classic_acceptance_second_attempt_reclaim`: rows=156, unique=156, tp2=0.8846, stop_first=0.2692, expectancy=0.234
- `ladder_first_reclaim`: rows=17, unique=17, tp2=1, stop_first=0, expectancy=2.4412
- `simple_reclaim_unclassified`: rows=71, unique=71, tp2=0.7465, stop_first=0.338, expectancy=-0.331

## Original Package By Protocol

- `non_acceptance_protocol`: rows=8, unique=8, tp2=1, stop_first=0.625, expectancy=-4.2188
- `classic_acceptance_backtest_from_below`: rows=0, unique=0, tp2=null, stop_first=null, expectancy=null
- `classic_acceptance_second_attempt_reclaim`: rows=0, unique=0, tp2=null, stop_first=null, expectancy=null
- `ladder_first_reclaim`: rows=0, unique=0, tp2=null, stop_first=null, expectancy=null
- `simple_reclaim_unclassified`: rows=5, unique=4, tp2=1, stop_first=0.4, expectancy=-7.7

## Safety

- No Pine, NinjaTrader, broker, account, credential, risk, order, or live-execution path is touched.
- SATY-only rows are classified as `saty_only_no_mancini_source_setup`.
- MFE/MAE, hit rates, stop-first, and future target hits are validation labels only.
