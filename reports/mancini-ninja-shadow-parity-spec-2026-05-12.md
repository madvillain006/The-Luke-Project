# Mancini Ninja Shadow Parity Spec

Generated: 2026-05-12

Research/replay only. No live trading authority. Mancini source text and examples take priority over Luke/Hermes classifier labels.

## Source Priority

1. Mancini methodology/newsletter source text.
2. Real packet chart/window evidence from ES 1m data.
3. Observed OHLCV metrics.
4. Deterministic classifier labels.
5. Hypotheses for backtest.

Simulated methodology charts are OCR/schema aids only. They are not performance data.

## Current Evidence

- Full parsed level universe: 2,456 Mancini rows.
- Full ES overlap results: `artifacts/research/mancini-full-level-overlap/summary.json`.
- Packetized real chart windows: 172.
- Timing-valid packets: 128.
- Timing-excluded packets: 44.
- Explicit Mancini narrative packets: 50.
- Full source-priority Hermes prompt: `artifacts/research/mancini-hermes-source-priority-batches/HERMES_SOURCE_PRIORITY_PROMPT.md`.

## Shadow Modules

Module A: Level Reader

- Input: daily Mancini protocol pack, not generated Saty levels.
- Required fields: level, plan date, source quote, raw source path, role, tags, long eligibility, nearest Saty level, source confidence.
- Reject or mark weak: rows without raw source path, rows with only `price_only` provenance, target-only/resistance-only rows for long logic.

Module B: Significant Low / Shelf Context

- Detect prior day low, overnight low, multi-hour low, repeated shelf/cluster, and major support tag.
- Do not treat every support level as a fake breakdown setup.
- Store floor quality as telemetry first; do not use as an order gate until replay-reviewed.

Module C: Acceptance Family Classifier

- `classic_acceptance_backtest_from_below`: reclaim/backtest, selloff away from the level, then return/reclaim again.
- `classic_acceptance_second_attempt_reclaim`: first reclaim fails, second reclaim becomes actionable context.
- `non_acceptance_protocol`: fast reclaim clears level + 5 and holds above it for roughly 2-3 minutes.
- `simple_reclaim_unclassified`: fallback bucket, not a high-confidence Mancini match.

Module D: Trigger Telemetry

- Track trap candle timestamp, flush depth, wick/body, volume ratio, first reclaim close, acceptance close count, and reclaim minutes.
- Keep the 2-3.5 minute idea as a feature, not the strategy definition.
- Do not turn one-minute close count into a universal acceptance rule.

Module E: Invalidation Telemetry

- Anchor invalidation to the sweep low plus configurable buffer.
- Mancini examples imply “pattern low fails” / several points below the failed-breakdown low; this is not a proven universal stop.
- Existing fixed small-stop assumptions should be treated as likely non-parity until replay proves otherwise.

Module F: Saty Confluence Filter

- Use Saty as a filter first: distance bucket, label type, valid/invalid ATR state.
- Do not let Saty replace Mancini levels.
- Current full-overlap audit supports testing confluence buckets, but not promoting Saty into source authority.

## Replay-Only Outputs

For every candidate in Ninja shadow mode, emit:

- Mancini level and source quote.
- Source role and tags.
- Acceptance family.
- Trap candle metrics.
- Reclaim timing.
- Acceptance bars.
- Sweep-low invalidation anchor.
- Nearest Saty label/distance.
- Whether the row is accepted for timing stats or excluded.
- Human review label: `clean`, `weak_source`, `weak_acceptance`, `caution`, or `reject`.

## Hard Gates

- No broker/account/risk/order execution changes.
- No live trading behavior.
- No automatic promotion from research packet to strategy rule.
- No use of excluded timing rows in aggregate timing stats.
- No use of support/resistance-list rows as narrative proof without raw surrounding context.

## Next Implementation Slice

1. Add shadow-only telemetry fields in Ninja or an external replay parser.
2. Replay 30+ source-priority examples from `mancini-real-packet-gallery`.
3. Compare Ninja labels against Hermes source-priority batches.
4. Fix classifier mismatches before tuning stops or targets.
5. Only after shadow parity is verified, design backtest brackets by acceptance family.
