# Quick Reclaim Acceptance Next Step

Review-only. Trading authority: none.

## Corrected Read

The `2_to_3_5` reclaim timing hypothesis is **weakly supported**, not fully supported.

Evidence from `artifacts/research/hermes-mancini-event-packets/quick_reclaim_acceptance_summary.json`:

| bucket | packets | avg acceptance closes | avg flush points | avg MFE 15m | avg MAE 15m | avg MFE 60m | avg MAE 60m |
|---|---:|---:|---:|---:|---:|---:|---:|
| 2_to_3_5 | 10 | 13.1 | 2.875 | 7.9 | 2.9 | 10.2 | 8.0 |
| 3_5_to_10 | 34 | 12.6765 | 9.1691 | 8.9338 | 4.9338 | 14.4559 | 7.8971 |
| 10_plus | 33 | 11.4545 | 11.3864 | 5.1136 | 3.4924 | 8.6439 | 7.2576 |

`0_to_1` and `1_to_2` have zero packets in this packet set and cannot be compared.

## Interpretation

`2_to_3_5` is interesting because it combines high acceptance closes with shallow average flush and low 15-minute adverse excursion.

It is not proven because:

- only 10 packets populate the bucket;
- `3_5_to_10` has a much larger sample and stronger MFE;
- no profitability model, entry fill model, fee/slippage model, or stop/target model has been tested;
- the packet set is not out-of-sample.

## Next Test

Build a deterministic out-of-sample table from historical ES 1m data using these fields:

- `reclaim_time_bucket`
- `acceptance_closes`
- `flush_points`
- `trap_candle_volume`
- `trap_candle_wick_to_body`
- `mfe_15m`
- `mae_15m`
- `mfe_60m`
- `mae_60m`

Minimum viable next dataset:

- at least 30 accepted timing rows in `2_to_3_5`;
- at least 30 accepted timing rows in each populated comparison bucket;
- include enough earlier/later sessions to populate `0_to_1` and `1_to_2`, or explicitly mark them untestable.

## Next Hermes Prompt

```text
Process_narration=false.

Use direct OpenAI only.
Provider: openai-direct
Model: gpt-4o-mini.

Read:
C:\Users\conor\luke\artifacts\research\hermes-mancini-event-packets\quick_reclaim_acceptance_summary.json
C:\Users\conor\luke\artifacts\research\hermes-mancini-event-packets\quick_reclaim_acceptance_rows.jsonl
C:\Users\conor\luke\reports\quick-reclaim-acceptance-next-step-2026-05-10.md

Task:
Design the next deterministic out-of-sample test for Quick_Reclaim_Acceptance.

Requirements:
1. Treat 2_to_3_5 as weakly supported, not proven.
2. Do not compare against 0_to_1 or 1_to_2 until those buckets have rows.
3. Define exact inclusion/exclusion rules for OOS rows.
4. Define the aggregation table columns.
5. Define pass/fail criteria without live trading language.
6. Include a minimum sample-size gate.
7. Do not write NinjaScript.
8. Do not claim profitability.
9. Return the exact next command or script spec needed to generate the OOS table.
```
