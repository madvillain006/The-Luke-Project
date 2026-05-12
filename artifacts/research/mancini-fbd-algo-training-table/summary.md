# Mancini FBD Algo Training Table Summary

Generated: 2026-05-12T20:12:00.784171+00:00

Scope: research, historical, replay, and shadow only. No live trading authority.

## Counts

- Training rows: 739
- Direct source audit input rows: 478
- Packet observation input rows: 172
- Context protocol events: 2456
- ES session JSON files: 51
- Gallery SVG files: 172
- Gallery PNG files: 172
- Gallery manifest rows missing PNG sidecars: 0

## Labels

- `source_confirmed_fbd`: 139
- `source_planned_fbd`: 149
- `source_negative_control`: 34
- `sr_list_only`: 114
- `chart_confirmed_reclaim`: 214
- `chart_confirmed_non_acceptance`: 95
- `chart_mismatch`: 3
- `needs_crop`: 297
- `data_only`: 416

## Direct Audit Verdicts

- `needs_bigger_crop`: 114
- `data_only`: 332
- `negative_control`: 32

## Safety Notes

- Support/resistance-list-only packet rows are labeled as `sr_list_only` and are not promoted into positive examples.
- The current direct audit still has `0` strict positive training candidates; this is preserved as a safety-gate fact, not treated as proof the pattern is absent.
- Real packet gallery PNG sidecars were checked from disk, not assumed from manifest prose.
