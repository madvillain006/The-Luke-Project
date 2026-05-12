# Feature Dictionary

Scope: deterministic offline research features for Mancini FBD review. Candidate scoring avoids future outcome labels.

## Source Fields

- `training_row_id`: Stable local row id.
- `row_origin`: `direct_source_audit` or `packet_observation`.
- `raw_file`, `line`, `plan_date`, `pub_date`, `source_quote`: Mancini source provenance.
- `source_mode`: Source mode from direct audit or packet context.
- `source_confidence_score`: Source-first confidence. Negative controls score 0, support/resistance list-only rows score 0.20, direct actual recaps can score up to 1.0.
- `level_role_map`, `sr_coincidence`: Source role and S/R context evidence.

## Level And Chart Fields

- `setup_level`: Candidate failed-breakdown level.
- `swept_low`: Trap/sweep low from source or chart window.
- `recovered_level`: Reclaimed level.
- `non_acceptance_threshold`: Usually `setup_level + 5`.
- `invalidation_level`: Sweep-low or source invalidation anchor.
- `target_or_response_level`: Next response/target from source or same-plan level universe.
- `chart_path`, `window_csv`, `visual_sanity_status`, `blockers`: Chart/window and source sanity evidence.
- `es_window_available`, `session_date`, `bars_available`: Local data availability checks.

## Labels

- `source_confirmed_fbd`: Direct source text describes failed breakdown, recovery, reclaim, or squeeze.
- `source_planned_fbd`: Mancini planned a future failed-breakdown style setup.
- `source_negative_control`: Source says no trigger, non-FBD, failed setup, or negative control.
- `sr_list_only`: Support/resistance list-only row; never a positive example by itself.
- `chart_confirmed_reclaim`: ES 1m confirms sweep/reclaim structure.
- `chart_confirmed_non_acceptance`: ES 1m confirms reclaim plus threshold behavior near `level + 5`.
- `chart_mismatch`: Chart/trap timing contradicts source.
- `needs_crop`: Usable source but chart/window is missing or too narrow.
- `data_only`: Context row, not a training positive.

## Deterministic Feature Math

- `significant_low_score`: Prior touches, prior hold time, prior bounce points, and major-source bonus.
- `flush_score`: Flush depth, approach velocity, multi-level flush count, and trap-bar volume ratio.
- `reclaim_score`: Close above level, reclaim close location, acceptance closes, no immediate close back below, and reclaim range.
- `non_acceptance_score`: No-lookahead threshold/hold/retest score. The 15m MAE outcome gate is excluded from candidate scoring.
- `non_acceptance_score_with_outcome_audit`: Full audit score with the 15m MAE gate included for analysis only.
- `squeeze_score`: Target room, target R, trusted source level, no nearby overhead level, and time-of-day bonus.
- `candidate_score`: `0.25 significant_low + 0.20 flush + 0.25 max(reclaim, non_acceptance_no_lookahead) + 0.20 squeeze + 0.10 source_confidence`.

## Outcome Labels

- `mfe_15m`, `mae_15m`, `mfe_60m`, `mae_60m`: Labels only.
- `tp2_hit`, `tp3_hit`, `next_level_hit`, `stop_first`, `false_armed`: Validation labels only.
- `expectancy_points_slippage_0_5`: Outcome label using 0.5 ES point round-trip slippage.

## Completeness And Review Artifacts

- `label_recovery_summary.json`: Review-only pass over source-qualified hard rejects using existing session/window/raw Barchart data.
- `recovered_label_rows.jsonl`: Recovered review labels and remaining hard rejects. Use as supplemental evidence, not as automatic promotion.
- `saty_protocol_comparison.json`: SATY ATR-generated side-project comparison. SATY-only/no Mancini-source rows remain negative/control/context rows.
- `saty_protocol_rows.csv`: SATY protocol rows for geometry comparison only.
- `chart_artifact_audit.json`: PNG/chart artifact coverage and warnings. Price-only raw-source matches are caveats, not blockers.
- `pre_hermes_completeness_audit.md`: Final package-completeness audit and response contract.
- `features.csv`: Full deterministic feature matrix.
- `labels.csv`: Full label/outcome matrix. Use future/outcome fields only in validation, never in candidate formulas.
- `training_summary.json`: Training-table counts and label counts.
- `mancini_algo_hermes_handoff.md`: Source-of-truth handoff narrative.
- `direct_fbd_source_audit.json`: Direct Mancini source audit.
- `real_packet_gallery_manifest.json`: Manifest for the 172 real packet gallery cases and chart sidecars.
- `visual_sanity_audit.json`: Visual/source sanity status for packet rows.
- `ninja_shadow_parity_spec.md`: Later shadow telemetry context only; do not write Ninja code.
