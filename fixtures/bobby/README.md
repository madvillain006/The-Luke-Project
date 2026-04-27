# Bobby Fixture Corpus

Bobby (BOBBY [SKY]) GEX heatmap fixtures from the OWLS Capital Discord
bobby-spx-coms channel. Used by the Bobby parser validation harness
(when built — Sub-task 5c).

## Format note: 3-panel SPX/SPY/QQQ heatmaps

These are a different format than Bobby's older single-instrument heatmaps.
Three-panel side-by-side: SPXW (SPX-equivalent), SPY, QQQ. Dense GEX node
data with king-node highlighting, per-node percentage changes, dollar volumes
in thousands. Vision parsing is harder against this format — multi-instrument
single image, dense numerical labels, color-coded gradients.

## Message <-> image pairings

| Date       | Time   | Has text? | Notes                                          |
|------------|--------|-----------|------------------------------------------------|
| 2026-04-27 | 10:03  | YES       | "$SPX heatmaps, decent support under all three with room to run on SPY" |
| 2026-04-27 | 10:05  | YES       | "Remmeber large nodes cause the chop if the rest of king nodes are not close in value" (sic) |
| 2026-04-27 | 10:08  | NO        | Same context as 10:05 message, 3 minutes later — image-only update |
| 2026-04-27 | 10:13  | NO        | Image-only update                              |
| 2026-04-27 | 10:17  | NO        | Image-only update                              |

## Edge cases to test in the harness

1. **Image-only fixtures** (10:08, 10:13, 10:17) — no text component. Bobby
   parser must handle vision-only path without crashing.
2. **Multi-instrument single image** — three instruments in one PNG. Vision
   prompt must extract per-instrument data.
3. **Bobby commentary without prices** — neither 10:03 nor 10:05 quotes
   specific levels in text. Levels come exclusively from the image.
4. **Same-context multi-snapshot** (10:05 + 10:08) — one message context,
   two image snapshots. Confluence implication: do levels at this time
   confirm or carry forward the prior message?
