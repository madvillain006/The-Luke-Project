# Mancini FBD Algo Training Table Summary

Generated: 2026-05-13T11:11:41.624989+00:00

Scope: research, historical, replay, and shadow only. No live trading authority.

## Counts

- Training rows: 1129
- Direct source audit input rows: 842
- Packet observation input rows: 172
- Context protocol events: 2456
- ES session JSON files: 51
- Gallery SVG files: 172
- Gallery PNG files: 172
- Gallery manifest rows missing PNG sidecars: 0

## Labels

- `source_confirmed_fbd`: 472
- `source_planned_fbd`: 131
- `source_negative_control`: 30
- `sr_list_only`: 98
- `chart_confirmed_reclaim`: 300
- `chart_confirmed_non_acceptance`: 158
- `chart_mismatch`: 3
- `needs_crop`: 591
- `data_only`: 496

## Direct Audit Verdicts

- `data_only`: 679
- `needs_bigger_crop`: 133
- `negative_control`: 30

## Direct Source Labels

- `source_confirmed_fbd`: 430
- `source_unparsed_fbd`: 252
- `source_planned_fbd`: 69
- `data_context`: 45
- `source_negative_control`: 30
- `methodology_definition`: 16

## Safety Notes

- Support/resistance-list-only packet rows are labeled as `sr_list_only` and are not promoted into positive examples.
- The current direct audit still has `0` strict positive training candidates; this is preserved as a safety-gate fact, not treated as proof the pattern is absent.
- Real packet gallery PNG sidecars were checked from disk, not assumed from manifest prose.
