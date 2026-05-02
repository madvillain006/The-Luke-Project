# CC BRIEF — Fix Bobby heatmap vision parsing for multi-panel modern format

## TASK
Update `parseBobbyImage()` in `lib/parse-bobby.js` so the Haiku vision prompt
correctly identifies levels from real Bobby heatmap screenshots.

Last attempted vision parse returned as if it were an audio spectrogram. The
prompt is outdated — it assumes SPX in the 4000-6000 range (reality: 7100+),
assumes single-panel SPX-only heatmaps, and doesn't describe the actual visual
structure of what Bobby posts.

## CONTEXT — what Bobby heatmaps actually look like
Bobby's heatmaps are from a tool like HeatseekerPro or SpotGamma. Real format:
- 1 to 3 vertical panels side-by-side, each labeled with a ticker (SPXW, SPY, QQQ)
- Each panel has a "King" label at the top pointing at specific rows
- Left column of each panel is price levels (e.g. 7120, 7115, 7110)
- Right column is dealer gamma dollar exposure (e.g. $48,418.7K, -$38,030.7K)
- Rows are color-coded: yellow/green highlighted rows = king nodes
- Purple rows = major walls/resistance
- Red/bright green rows = high-magnitude levels
- Blue/teal rows = ordinary levels

SPX current range: 6900-7300 (April 2026)
SPY current range: 690-730
QQQ current range: 640-680

## DO NOT
- Do not touch `parseBobby` (the text parser) — it works fine
- Do not touch `mergeBobby`
- Do not touch `lib/bobby-heatmap-rules.js`
- Do not touch any file outside `lib/parse-bobby.js`
- Do not add new dependencies

## DIAGNOSTIC — read, report, STOP
1. Read `lib/parse-bobby.js` lines 79-170 (the `parseBobbyImage` function and
   everything after it through `mergeBobby`).
2. Confirm current model used is `claude-sonnet-4-6`. If not, report what it is.
3. Confirm the system prompt's price-range assumption (currently says 4000-6000).
4. Report: does the function currently support multi-panel images with
   multiple tickers, or does it assume single-ticker SPX?

Report findings. STOP.

## IMPLEMENTATION (after diagnostic approved)

Rewrite the system prompt in `parseBobbyImage()` to match the actual image
format. Keep the function signature, return shape, and error handling identical
to what exists today. Only the prompt string changes, plus one small addition
for multi-panel output merging.

### New system prompt (exact text to use)

```
You are analyzing a financial dealer gamma heatmap image. This is NOT an audio
spectrogram or waveform — it is a table-style heatmap showing options dealer
positioning across price levels for one or more tickers.

VISUAL STRUCTURE:
- The image contains 1 to 3 vertical panels placed side by side
- Each panel has a ticker label at the top (e.g. SPXW, SPY, QQQ, IWM, SPX)
- Each panel has a "King" marker at the top pointing to one or two specific rows
- Each panel is a table with two columns:
  * LEFT column = price level (integer or decimal, e.g. 7120, 709, 653)
  * RIGHT column = dealer gamma dollar exposure (e.g. $48,418.7K, -$38,030.7K)
- Rows are highlighted by color:
  * YELLOW or BRIGHT GREEN row = king node (the dominant positioning level)
  * PURPLE or MAGENTA row = major wall / resistance / high-magnitude negative
  * RED/ORANGE = strong negative exposure (wall/resistance)
  * TEAL/BLUE = ordinary/minor levels (IGNORE these — do not return)

PRICE RANGES (verify the level you extract is reasonable for the ticker):
- SPX / SPXW:   6500 to 7500 range in 2026
- SPY:          650 to 750 range in 2026
- QQQ:          600 to 700 range in 2026
- IWM:          200 to 260 range in 2026

EXTRACTION RULES:
- Only return levels visible on YELLOW, GREEN, PURPLE, MAGENTA, RED, or ORANGE
  rows. Ignore teal/blue "quiet" rows.
- The "King" label at the top of each panel identifies the primary king_node.
  That level goes into king_nodes.
- Purple/magenta rows are walls (resistance above current price, or support
  below — infer from position in the table).
- If a panel's current price indicator is visible (e.g. "$7117.52" at top),
  use it to decide which walls are above (resistance) vs below (support).
- If you cannot clearly identify a level, do NOT guess. Return empty arrays.

RETURN FORMAT — JSON ONLY, no markdown, no explanation:
{
  "tickers_detected": ["SPX", "SPY", "QQQ"],
  "panels": [
    {
      "ticker": "SPX",
      "current_price": 7117.52,
      "king_nodes": [7125, 7120],
      "walls": [7100, 7115],
      "floors": [7085, 7095],
      "air_pockets": [],
      "bias": "BULLISH"
    }
  ],
  "king_nodes": [7125, 7120, 709, 653],
  "walls": [7100, 7115, 705, 654],
  "floors": [7085, 7095, 700, 649],
  "air_pockets": [],
  "trinity": true,
  "overall_bias": "BULLISH",
  "notes": "brief 1-sentence observation"
}

Rules for top-level arrays:
- king_nodes / walls / floors / air_pockets at the top level are the UNION of
  all panels' levels (flat list, integers or floats, no duplicates).
- "trinity" is true if all three of SPX/SPXW, SPY, and QQQ are present AND
  their king nodes align directionally (all bullish or all bearish bias).
- overall_bias: BULLISH if majority of panels are bullish, BEARISH if majority
  bearish, NEUTRAL otherwise.
- notes: one sentence describing the dominant structure you see.

Return ONLY the JSON object. No ```json fences. No prose.
```

### Additionally change
- Keep the existing JSON parse/strip logic (handles ```json fences defensively
  even though we told it not to use them).
- In the post-parse block where `king_nodes`, `walls`, `floors` are filtered
  with `n > 50`, KEEP that filter — it works for SPX 7000s and SPY 700s alike
  since both are >50.
- Return shape should still match what `mergeBobby` expects: king_nodes,
  support, resistance, vix_mentioned, bias, notes, raw, source, vision_parsed.
  Keep the mapping `support = floors; resistance = walls`.
- If `panels` array is non-empty but top-level king_nodes/walls/floors are
  empty, derive them from the panels array (defensive fallback).

## GATE
1. `node --check lib/parse-bobby.js`
2. Then run this test (after diagnostic):
   ```
   node -e "require('./lib/parse-bobby').parseBobbyImage(require('fs').readFileSync('test-heatmap.png').toString('base64')).then(r => console.log(JSON.stringify(r, null, 2)))"
   ```
   (The user will have a file `test-heatmap.png` in the luke root by the
   time you run this — it's a real Bobby heatmap image.)

Report the parsed output. STOP for review before committing.

## COMMIT (after test output reviewed and approved)
fix(parse-bobby): update vision prompt for multi-panel modern heatmap format

## BUDGET
10 tool calls. This is a prompt rewrite, not a redesign. If you find yourself
needing more than 10 calls, stop and ask.
