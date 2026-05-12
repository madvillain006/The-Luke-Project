# Mancini FBD Pre-Hermes Roadmap

Generated: 2026-05-12

Scope: research, historical, replay, and shadow only. No live trading authority. No broker/account routing, credentials, Pine edits, Ninja strategy execution work, order validation, position sizing, risk checks, or kill-switch changes are part of this handoff.

## Current State

The pre-Hermes package is ready for a deterministic math review. The strict direct audit still has `0` strict positive training candidates; that remains a safety gate, not evidence that the pattern is absent.

Core package:

- `artifacts/research/mancini-fbd-hermes-input/HERMES_PROMPT.md`
- `artifacts/research/mancini-fbd-hermes-input/selected_training_rows.jsonl`
- `artifacts/research/mancini-fbd-hermes-input/feature_dictionary.md`
- `artifacts/research/mancini-fbd-hermes-input/candidate_rule_scores.json`
- `artifacts/research/mancini-fbd-hermes-input/walk_forward_report.md`
- `artifacts/research/mancini-fbd-hermes-input/source_file_index.md`
- `artifacts/research/mancini-fbd-hermes-input/manifest.json`

Current counts:

- Training rows: `739`
- Feature rows: `739`
- Label rows: `739`
- Hard-rejected rows: `693`
- Unique setups: `698`
- Strict positive training candidates: `0`
- Gallery SVG files: `172`
- Gallery PNG sidecars: `172`
- Missing gallery PNG sidecars: `0`

Current label counts:

- `source_confirmed_fbd`: `139`
- `source_planned_fbd`: `149`
- `source_negative_control`: `34`
- `sr_list_only`: `114`
- `chart_confirmed_reclaim`: `214`
- `chart_confirmed_non_acceptance`: `95`
- `chart_mismatch`: `3`
- `needs_crop`: `297`
- `data_only`: `416`

## Additional Pre-Hermes Work Completed

Label recovery artifact:

- `artifacts/research/mancini-fbd-label-recovery/summary.md`
- `artifacts/research/mancini-fbd-label-recovery/summary.json`
- `artifacts/research/mancini-fbd-label-recovery/recovered_label_rows.jsonl`
- `artifacts/research/mancini-fbd-label-recovery/recovered_label_rows.csv`

Recovery results:

- Source-qualified hard-rejected rows scanned: `224`
- Rows with existing local ES data scanned: `196`
- Recovered flush/reclaim rows: `101`
- Recovered unique setups: `73`
- Candidate-eligible recovered rows: `12`
- Candidate-eligible unique setups: `11`
- Candidate-eligible families:
  - `non_acceptance_protocol`: `9`
  - `classic_acceptance_backtest_from_below`: `3`

SATY side-project comparison:

- `artifacts/research/mancini-fbd-saty-side-project/protocol_comparison.md`
- `artifacts/research/mancini-fbd-saty-side-project/protocol_comparison.json`
- `artifacts/research/mancini-fbd-saty-side-project/saty_protocol_rows.csv`

SATY-only rows remain negative/control/context rows unless separate Mancini source evidence qualifies them.

## Safety Boundaries Preserved

- Support/resistance-list-only rows remain negative/control/context rows.
- `data_only` and `data_context` rows stay review-only.
- Actual recaps are review labels unless a planned-entry source condition is present.
- MFE/MAE, hit rates, stop-first, and future target hits are validation labels only.
- No Hermes run has been performed in this repo state.
- No Ninja Strategy Analyzer, Playback, Market Replay, or Ninja code implementation is required before Hermes.

## Verification Run

Last known completed verification:

- `python scripts/aggregate_quick_reclaim_acceptance.py`
- `python scripts/build_mancini_fbd_algo_training_table.py`
- `python scripts/research_mancini_fbd_algo_math.py`
- `python scripts/build_mancini_fbd_hermes_package.py`
- `python scripts/research_mancini_fbd_label_recovery.py`
- `node scripts/research-mancini-fbd-saty-side-project.js`
- `node scripts/export_svg_charts_to_png.js --dir artifacts/research/mancini-real-packet-gallery`
- `python scripts/audit_mancini_chart_artifacts.py`
- `cmd /c npx vitest run tests/backtest-data-saty-historical.test.js tests/parse-mancini.test.js`

Focused Vitest result: `40/40` tests passed.

Chart artifact audit result: pass, with `233` total PNGs and `172` real packet gallery PNGs.

## Where We Are

Ready for Hermes to review deterministic math and rule candidates from the source-first package.

Hermes should not be asked for live trading instructions. The requested output should remain a deterministic research spec with features, state machine, entry/invalidation/target rules, risk-model labels, negative controls, validation plan, and future Ninja shadow telemetry fields.

## What Is Left After Hermes

1. Run `scripts/validate_hermes_mancini_output.py` against the Hermes JSONL output.
2. Reject or revise any Hermes claim that introduces exact thresholds without local evidence, live-trading language, or universal rule language.
3. Convert only validated Hermes suggestions into local deterministic tests.
4. Rebuild the feature/label/rule score package with any accepted deterministic rule candidates.
5. Require adequate source-qualified sample size before any Ninja work:
   - `classic_acceptance_backtest_from_below`: at least `30` source-qualified rows.
   - `non_acceptance_protocol`: at least `50` source-qualified rows.
   - `ladder_first_reclaim`: at least `30` source-qualified rows.
6. Only after local math survives out-of-sample validation should Ninja shadow telemetry be designed. Ninja Strategy Analyzer, Playback, and Market Replay remain later gates.
