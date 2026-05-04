# Katbot Owner Review Pack

Status: **not_ready**

Keep Kat internal. Fix blockers before showing it to the server owner.

> Discord replies/posts are gated off in this build. Nothing here has been sent to Discord.

## Pipeline
```mermaid
flowchart LR
  A["Discord analyst message"] --> B["Kat capture gate"]
  B --> C["raw-feed.jsonl"]
  C --> D["parse-kat signal parser"]
  D --> E["processed-signals.jsonl"]
  C --> V["vision parser for chart + heatmap images"]
  V --> W["vision-signals.jsonl"]
  W --> E
  E --> F["Index confluence lane"]
  E --> G["Equity/options shadow lane"]
  F --> H["Luke trading window websocket payload"]
  G --> H
  F --> I["Owner report / readiness pack"]
  G --> I
  I --> J["Discord owner review"]
  J -. "explicit approval only" .-> K["Discord replies/posts"]
```

## Safety Gate
```mermaid
flowchart TD
  A["Generated Kat output"] --> B{"Discord output approved?"}
  B -- "No" --> C["Suppress reply/post; keep Luke-only"]
  B -- "Yes" --> D["Send with allowedMentions disabled"]
  D --> E["No @everyone / no user reply ping"]
  C --> F["Owner can inspect report first"]
```

## Current Evidence
- Raw messages captured: 12265
- Processed signals: 2604
- Image posts: 2332
- Heatmap/image candidates: 700
- Vision parses: 0 (0 chart, 0 heatmap)
- SPX/SPY evaluated records: 114
- Shadow watchlist: TSLA, CAR, AAOI, MU, SNDK, LITE, ASML, ARM, COST, MSFT
- Ready for downstream validation: MU, LITE, ASML

## Parsed Message Proof: Index Lane
- Analyst: mathemeatloaf7
- Channel: ☔︱spy-qqq-es-nq-vix
- Message ID: 1498724694176694443
- Timestamp: 2026-04-28T16:36:52.050Z
- Message: "$spy if peaking at this TL resistance next target would be 698-690 below 690 can start opening the door to the large gap below at 660 imo"
- Parsed ticker: SPY
- Parsed bias: BEARISH
- Parsed levels: 698, 690, 660

```json
{
  "signal_type": "CHART_ANALYSIS",
  "ticker": "SPY",
  "timeframe": null,
  "bias": "BEARISH",
  "pattern": "resistance",
  "levels": [
    698,
    690,
    660
  ],
  "has_image": true,
  "raw": "$spy\n\nif peaking at this TL resistance\n\nnext target would be 698-690\n\nbelow 690 can start opening the door to the large gap below at 660 imo",
  "analyst": "mathemeatloaf7",
  "ts": "2026-04-28T16:36:52.050Z",
  "message_id": "1498724694176694443",
  "channel": "☔︱spy-qqq-es-nq-vix",
  "user_id": "755259514068009041"
}
```

## Parsed Message Proof: Equity/Options Shadow Lane
- Analyst: kaprik0rn3
- Channel: 🟢︱trade-floor
- Message ID: 1496891939268722860
- Timestamp: 2026-04-23T15:14:09.229Z
- Message: "MU 10min. Almost 3% move off LOD"
- Parsed ticker: MU
- Asset class: equity

```json
{
  "asset_class": "equity",
  "underlying": "MU",
  "side": null,
  "strike": null,
  "expiry": null,
  "premium": null,
  "confidence": "low",
  "parse_note": "Equity shadow context only; needs market data and scoring before recommendations."
}
```

## Image Proof Candidate
- Analyst: barrysanders329
- Channel: 🟢︱trade-floor
- Message ID: 1500843002262847590
- Timestamp: 2026-05-04T12:54:16.054Z
- Message: "Bearish names RKT, FIG, TMUS, SW, CHWY, GPK, CELH, ORC, FLNC, PDD, XRAY, VNET"
- Attachment URL: https://cdn.discordapp.com/attachments/1040400353490911292/1500843001709330435/image.png?ex=69f9e877&is=69f896f7&hm=77a3dc84282fcc0109c49b35e408f6f03166f9ccca5fddef26ea27e866cd43dc&

## Parsed Vision Proof: Chart Image
No persisted chart vision parse found yet.

## Parsed Vision Proof: Heatmap Image
No persisted heatmap vision parse found yet.

## Rendered Screenshot Proof
- Owner proof page: `screenshots/owner-proof.png`
- Luke trading-window preview: `screenshots/luke-trading-preview.png`

## Timestamped Message Bin
- Examples JSON: `message-bin/katbot-message-examples.json`
- Examples Markdown: `message-bin/katbot-message-examples.md`
- Examples HTML: `message-bin/katbot-message-examples.html`
- Suppressed Discord output sink: `message-bin/katbot-output-bin.jsonl`

## Discord Preview
Preview only. This is how owner-facing Kat output would look if explicitly approved later.

```text
**Kat owner-review preview**
Status: not_ready
Evidence: 12265 raw messages, 2604 processed signals
Watchlist: TSLA, CAR, AAOI, MU, SNDK, LITE
Discord output: gated off until Conor explicitly approves generated wording.
_No autonomous execution. Human-gated evidence only._
```

## Luke Trading Window Preview
Separate operator-facing view. This is what Luke receives internally.

```json
[
  {
    "type": "kat_signal",
    "source": "katbot-discord",
    "ticker": "SPY",
    "bias": "BEARISH",
    "levels": [
      698,
      690,
      660
    ],
    "analyst": "mathemeatloaf7",
    "channel": "☔︱spy-qqq-es-nq-vix",
    "message_id": "1498724694176694443",
    "human_gate_required": true
  },
  {
    "type": "kat_watchlist_signal",
    "source": "katbot-discord",
    "ticker": "MU",
    "asset_class": "equity",
    "option_context": null,
    "equity_context": {
      "asset_class": "equity",
      "underlying": "MU",
      "side": null,
      "strike": null,
      "expiry": null,
      "premium": null,
      "confidence": "low",
      "parse_note": "Equity shadow context only; needs market data and scoring before recommendations."
    },
    "analyst": "kaprik0rn3",
    "message_id": "1496891939268722860",
    "policy": "equity/options shadow-watch only; not SPX-equivalent and not execution authority",
    "human_gate_required": true
  }
]
```

## Readiness Details
# Katbot Readiness

Recommendation: not_ready
Keep Kat internal. Fix blockers before showing it to the server owner.

## Evidence
- Raw messages: 12265
- Processed signals: 2604
- Image posts: 2332
- Heatmap candidates: 700
- Vision signals: 0 (0 chart, 0 heatmap)
- Replay records: 1078
- SPX/SPY evaluated: 114
- Watchlist: TSLA, CAR, AAOI, MU, SNDK, LITE, ASML, ARM, COST, MSFT
- Ready for downstream validation: MU, LITE, ASML

## Blockers
- analyst chart/heatmap reads are saved: 0 saved chart/heatmap read(s) for 2332 image post(s)
- chart images are read for levels: 0 saved chart read(s)
- heatmap images are read for levels: 0 saved heatmap read(s) for 700 candidate(s)

## Warnings
- SPX/SPY sample size: 114 evaluated direct records

## Owner Notes
- Discord outputs still gated: replies=false, posts=false
- Recommend silent capture and Luke-only shadow evidence before any public Discord answering.
- Do not enable Discord replies or channel posts until Conor explicitly approves generated wording.
- No autonomous execution exists here; all outputs remain human-gated evidence.
- Backtesting/scoring remains owned by the separate backtesting lane.
