# Mancini Visual Training Sanity Audit

Research-only. This does not validate a strategy. It only checks whether generated charts are safe teaching/OCR examples.

## Counts

- dangerous_demote_for_training: 148
- insufficient_visual_context: 18
- review_only_context: 2
- training_candidate: 4

## Acceptable Training Example Criteria

- Mancini source text must be explicit, not only a support/resistance list.
- Raw source match should be exact or partial snippet, not price-only.
- Crop should visibly include prior shelf/cluster or repeated level interaction.
- Trap candle must occur before reclaim in the crop.
- Reclaim should show visible acceptance and should not immediately close back below the level.
- First-support caution rows and timing-excluded rows are not generic training examples.

## Manually Viewed Examples

- `viewed_7205_quick_reclaim` `mancini-es1m:2026-05-04T1111:7205.0:53db965edf54` -> `dangerous_demote_for_training`; reasons=['support_resistance_list_only_not_training_proof']; cautions=['raw_source_match_quality_price_and_role', 'prior_shelf_or_cluster_not_visible_in_crop']; image=`artifacts\research\mancini-real-packet-gallery\151_accepted_non_acceptance_protocol_20260504_1111_7205.0.png`
- `viewed_7212_major_failed_breakdown_zone` `mancini-es1m:2026-05-04T1120:7212.0:3aa4c0792b84` -> `dangerous_demote_for_training`; reasons=['quant_agent_high_risk_late_or_weak_source_subset', 'support_resistance_list_only_not_training_proof']; cautions=['raw_source_match_quality_price_and_role', 'limited_pre_trap_context_in_crop', 'prior_shelf_or_cluster_not_visible_in_crop']; image=`artifacts\research\mancini-real-packet-gallery\152_accepted_non_acceptance_protocol_20260504_1120_7212.0.png`
- `viewed_7355_defend_7345_recover_7355` `mancini-es1m:2026-05-07T1237:7355.0:3a8cb95abc7c` -> `dangerous_demote_for_training`; reasons=['quant_agent_demote_late_reclaim_rolls_back_through_level']; cautions=['prior_shelf_or_cluster_not_visible_in_crop']; image=`artifacts\research\mancini-real-packet-gallery\170_accepted_non_acceptance_protocol_20260507_1237_7355.0.png`
- `viewed_7369_first_support_caution` `mancini-es1m:2026-05-07T1118:7369.0:4e3777c6272c` -> `dangerous_demote_for_training`; reasons=['excluded_from_timing_stats', 'quant_agent_demote_first_support_desperation_caution', 'mancini_first_support_caution', 'reclaim_not_after_trap_in_crop', 'weak_visible_acceptance_after_reclaim', 'closed_back_below_level_soon_after_reclaim']; cautions=[]; image=`artifacts\research\mancini-real-packet-gallery\172_excluded_classic_acceptance_second_attempt_reclaim_20260507_1118_7369.0.png`

## Top Candidate Examples

- `mancini-es1m:2026-03-10T0222:6800.0:f437fd432408` family=non_acceptance_protocol level=6800.0 image=`artifacts\research\mancini-real-packet-gallery\011_accepted_non_acceptance_protocol_20260310_0222_6800.0.png`
- `mancini-es1m:2026-04-05T1958:6608.0:ba0d8c969158` family=classic_acceptance_backtest_from_below level=6608.0 image=`artifacts\research\mancini-real-packet-gallery\078_accepted_classic_acceptance_backtest_from_below_20260405_1958_6608.0.png`
- `mancini-es1m:2026-04-21T1009:7125.0:f658c3c64aec` family=non_acceptance_protocol level=7125.0 image=`artifacts\research\mancini-real-packet-gallery\098_accepted_non_acceptance_protocol_20260421_1009_7125.0.png`
- `mancini-es1m:2026-04-23T1256:7097.0:30dca8a80e9c` family=non_acceptance_protocol level=7097.0 image=`artifacts\research\mancini-real-packet-gallery\112_accepted_non_acceptance_protocol_20260423_1256_7097.0.png`

## First Demotions

- `mancini-es1m:2026-03-04T0023:6776.0:6eac29c1821f` status=`dangerous_demote_for_training` reasons=['support_resistance_list_only_not_training_proof'] image=`artifacts\research\mancini-real-packet-gallery\001_accepted_non_acceptance_protocol_20260304_0023_6776.0.png`
- `mancini-es1m:2026-03-03T2139:6782.0:8cb8c2777bb4` status=`dangerous_demote_for_training` reasons=['support_resistance_list_only_not_training_proof'] image=`artifacts\research\mancini-real-packet-gallery\002_accepted_classic_acceptance_backtest_from_below_20260303_2139_6782.0.png`
- `mancini-es1m:2026-03-03T2039:6790.0:a70152a4e786` status=`dangerous_demote_for_training` reasons=['support_resistance_list_only_not_training_proof'] image=`artifacts\research\mancini-real-packet-gallery\003_accepted_non_acceptance_protocol_20260303_2039_6790.0.png`
- `mancini-es1m:2026-03-03T1928:6800.0:398c6bacdc82` status=`dangerous_demote_for_training` reasons=['excluded_from_timing_stats', 'weak_raw_price_only_provenance', 'reclaim_not_after_trap_in_crop', 'weak_visible_acceptance_after_reclaim', 'closed_back_below_level_soon_after_reclaim'] image=`artifacts\research\mancini-real-packet-gallery\004_excluded_classic_acceptance_second_attempt_reclaim_20260303_1928_6800.0.png`
- `mancini-es1m:2026-03-03T1940:6802.0:7287cc965506` status=`dangerous_demote_for_training` reasons=['support_resistance_list_only_not_training_proof'] image=`artifacts\research\mancini-real-packet-gallery\005_accepted_non_acceptance_protocol_20260303_1940_6802.0.png`
- `mancini-es1m:2026-03-03T1715:6818.0:4df8690d4034` status=`dangerous_demote_for_training` reasons=['support_resistance_list_only_not_training_proof', 'post_reclaim_adverse_excursion_exceeds_favorable_move'] image=`artifacts\research\mancini-real-packet-gallery\006_accepted_classic_acceptance_backtest_from_below_20260303_1715_6818.0.png`
- `mancini-es1m:2026-03-03T1820:6822.0:ceea33247e1a` status=`dangerous_demote_for_training` reasons=['quant_agent_high_risk_late_or_weak_source_subset', 'support_resistance_list_only_not_training_proof', 'mancini_first_support_caution'] image=`artifacts\research\mancini-real-packet-gallery\007_accepted_non_acceptance_protocol_20260303_1820_6822.0.png`
- `mancini-es1m:2026-03-09T1913:6764.0:33352b2c422b` status=`dangerous_demote_for_training` reasons=['support_resistance_list_only_not_training_proof', 'weak_visible_acceptance_after_reclaim'] image=`artifacts\research\mancini-real-packet-gallery\009_accepted_non_acceptance_protocol_20260309_1913_6764.0.png`
- `mancini-es1m:2026-03-09T1927:6774.0:2758841277d0` status=`dangerous_demote_for_training` reasons=['quant_agent_high_risk_late_or_weak_source_subset', 'support_resistance_list_only_not_training_proof'] image=`artifacts\research\mancini-real-packet-gallery\010_accepted_non_acceptance_protocol_20260309_1927_6774.0.png`
- `mancini-es1m:2026-03-13T1450:6630.0:edd154316406` status=`dangerous_demote_for_training` reasons=['support_resistance_list_only_not_training_proof'] image=`artifacts\research\mancini-real-packet-gallery\012_accepted_classic_acceptance_backtest_from_below_20260313_1450_6630.0.png`
- `mancini-es1m:2026-03-13T1254:6638.0:37a31f30e5e5` status=`dangerous_demote_for_training` reasons=['support_resistance_list_only_not_training_proof'] image=`artifacts\research\mancini-real-packet-gallery\013_accepted_simple_reclaim_unclassified_20260313_1254_6638.0.png`
- `mancini-es1m:2026-03-13T0314:6641.0:b3545754af5a` status=`dangerous_demote_for_training` reasons=['excluded_from_timing_stats', 'reclaim_not_after_trap_in_crop'] image=`artifacts\research\mancini-real-packet-gallery\014_excluded_non_acceptance_protocol_20260313_0314_6641.0.png`
- `mancini-es1m:2026-03-13T0308:6646.0:d6a01c34bab9` status=`dangerous_demote_for_training` reasons=['excluded_from_timing_stats', 'reclaim_not_after_trap_in_crop', 'weak_visible_acceptance_after_reclaim', 'closed_back_below_level_soon_after_reclaim', 'post_reclaim_adverse_excursion_exceeds_favorable_move'] image=`artifacts\research\mancini-real-packet-gallery\015_excluded_classic_acceptance_second_attempt_reclaim_20260313_0308_6646.0.png`
- `mancini-es1m:2026-03-13T0226:6652.0:ff2f764293d8` status=`dangerous_demote_for_training` reasons=['support_resistance_list_only_not_training_proof'] image=`artifacts\research\mancini-real-packet-gallery\016_accepted_non_acceptance_protocol_20260313_0226_6652.0.png`
- `mancini-es1m:2026-03-13T0210:6656.0:149a80c09b51` status=`dangerous_demote_for_training` reasons=['excluded_from_timing_stats', 'reclaim_not_after_trap_in_crop', 'closed_back_below_level_soon_after_reclaim', 'post_reclaim_adverse_excursion_exceeds_favorable_move'] image=`artifacts\research\mancini-real-packet-gallery\017_excluded_classic_acceptance_second_attempt_reclaim_20260313_0210_6656.0.png`
- `mancini-es1m:2026-03-13T0353:6663.0:e51c17892298` status=`dangerous_demote_for_training` reasons=['support_resistance_list_only_not_training_proof'] image=`artifacts\research\mancini-real-packet-gallery\018_accepted_non_acceptance_protocol_20260313_0353_6663.0.png`
- `mancini-es1m:2026-03-13T0355:6667.0:473442daff01` status=`dangerous_demote_for_training` reasons=['support_resistance_list_only_not_training_proof'] image=`artifacts\research\mancini-real-packet-gallery\019_accepted_classic_acceptance_backtest_from_below_20260313_0355_6667.0.png`
- `mancini-es1m:2026-03-12T1908:6676.0:bbd7eff65630` status=`dangerous_demote_for_training` reasons=['support_resistance_list_only_not_training_proof'] image=`artifacts\research\mancini-real-packet-gallery\020_accepted_non_acceptance_protocol_20260312_1908_6676.0.png`
- `mancini-es1m:2026-03-12T1731:6685.0:11b5eb37471f` status=`dangerous_demote_for_training` reasons=['quant_agent_high_risk_late_or_weak_source_subset', 'support_resistance_list_only_not_training_proof', 'mancini_first_support_caution'] image=`artifacts\research\mancini-real-packet-gallery\021_accepted_non_acceptance_protocol_20260312_1731_6685.0.png`
- `mancini-es1m:2026-03-12T1919:6699.0:95ee11585d82` status=`dangerous_demote_for_training` reasons=['weak_visible_acceptance_after_reclaim'] image=`artifacts\research\mancini-real-packet-gallery\023_accepted_simple_reclaim_unclassified_20260312_1919_6699.0.png`
- `mancini-es1m:2026-03-12T1935:6705.0:7e8020f96f27` status=`dangerous_demote_for_training` reasons=['weak_visible_acceptance_after_reclaim', 'closed_back_below_level_soon_after_reclaim', 'post_reclaim_adverse_excursion_exceeds_favorable_move'] image=`artifacts\research\mancini-real-packet-gallery\024_accepted_classic_acceptance_second_attempt_reclaim_20260312_1935_6705.0.png`
- `mancini-es1m:2026-03-13T0748:6712.0:ae9878e26bb0` status=`dangerous_demote_for_training` reasons=['closed_back_below_level_soon_after_reclaim'] image=`artifacts\research\mancini-real-packet-gallery\025_accepted_simple_reclaim_unclassified_20260313_0748_6712.0.png`
- `mancini-es1m:2026-03-13T0845:6721.0:8e30e84dcbf5` status=`dangerous_demote_for_training` reasons=['closed_back_below_level_soon_after_reclaim'] image=`artifacts\research\mancini-real-packet-gallery\026_accepted_non_acceptance_protocol_20260313_0845_6721.0.png`
- `mancini-es1m:2026-03-13T0846:6727.0:c8d48af5481f` status=`dangerous_demote_for_training` reasons=['closed_back_below_level_soon_after_reclaim'] image=`artifacts\research\mancini-real-packet-gallery\027_accepted_non_acceptance_protocol_20260313_0846_6727.0.png`
- `mancini-es1m:2026-03-18T1459:6623.0:119749312ede` status=`dangerous_demote_for_training` reasons=['excluded_from_timing_stats', 'reclaim_not_after_trap_in_crop'] image=`artifacts\research\mancini-real-packet-gallery\028_excluded_simple_reclaim_unclassified_20260318_1459_6623.0.png`
- `mancini-es1m:2026-03-18T1442:6632.0:2b576122b343` status=`dangerous_demote_for_training` reasons=['excluded_from_timing_stats', 'reclaim_not_after_trap_in_crop', 'weak_visible_acceptance_after_reclaim', 'closed_back_below_level_soon_after_reclaim', 'post_reclaim_adverse_excursion_exceeds_favorable_move'] image=`artifacts\research\mancini-real-packet-gallery\029_excluded_classic_acceptance_second_attempt_reclaim_20260318_1442_6632.0.png`
- `mancini-es1m:2026-03-18T1441:6635.0:3b9205c20946` status=`dangerous_demote_for_training` reasons=['excluded_from_timing_stats', 'reclaim_not_after_trap_in_crop'] image=`artifacts\research\mancini-real-packet-gallery\030_excluded_non_acceptance_protocol_20260318_1441_6635.0.png`
- `mancini-es1m:2026-03-18T1430:6639.0:3fe1d44cd2d1` status=`dangerous_demote_for_training` reasons=['excluded_from_timing_stats', 'reclaim_not_after_trap_in_crop'] image=`artifacts\research\mancini-real-packet-gallery\031_excluded_simple_reclaim_unclassified_20260318_1430_6639.0.png`
- `mancini-es1m:2026-03-18T1405:6648.0:706990a114ff` status=`dangerous_demote_for_training` reasons=['support_resistance_list_only_not_training_proof'] image=`artifacts\research\mancini-real-packet-gallery\032_accepted_non_acceptance_protocol_20260318_1405_6648.0.png`
- `mancini-es1m:2026-03-18T1410:6655.0:adddfa132039` status=`dangerous_demote_for_training` reasons=['excluded_from_timing_stats', 'reclaim_not_after_trap_in_crop', 'weak_visible_acceptance_after_reclaim', 'closed_back_below_level_soon_after_reclaim', 'post_reclaim_adverse_excursion_exceeds_favorable_move'] image=`artifacts\research\mancini-real-packet-gallery\033_excluded_classic_acceptance_second_attempt_reclaim_20260318_1410_6655.0.png`
