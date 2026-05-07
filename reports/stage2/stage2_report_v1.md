# KatBot Stage 2 Research Report

Generated: 2026-05-07T15:42:08.955Z

## Scope

Offline financial research only. No live trading behavior is added or changed.
Raw server data stays in ignored local artifact paths; this report summarizes counts and metrics.

## Data Inventory

- KatBot location: `agents/agent-14-kat.js`
- Raw Kat messages: 12975
- Discord export messages loaded: 6800
- Deduped Stage 2 messages: 19773
- Attachments cataloged on ingested messages: 4545
- Analysts observed: 22
- Channels observed: 6
- Heatmaps cataloged: 486
- Gains posts: 199

## Parser Summary

- Candidate trade calls: 2235
- Valid calls: 204
- Partial calls: 1719
- Ambiguous calls: 312
- Rejected/non-stage2 messages: 16100
- Trade updates: 1075
- Linked updates: 357
- Gains-only unverified: 161
- Linked gains: 38

Supported formats include long/short calls, market/here entries, limit/zone entries, reclaim/breakout/breakdown triggers, stops, targets, trims, breakeven moves, stopped/closed updates, gains captions, and heatmap captions. Ambiguous messages stay ambiguous.

## Market Data Coverage

- VIX: missing, rows=0, range=n/a to n/a, source=UNKNOWN, error=local_csv_candles_unsupported_symbol_VIX
- ALL: missing, rows=0, range=n/a to n/a, source=UNKNOWN, error=local_csv_candles_unsupported_symbol_ALL
- SPX: found, rows=21841, range=2026-02-10T21:18:00.000Z to 2026-04-28T20:38:00.000Z, source=local/replay
- NQ: missing, rows=n/a, range=n/a to n/a, source=n/a, error=local_stage2_nq_candles_not_connected
- NOW: missing, rows=0, range=n/a to n/a, source=UNKNOWN, error=local_csv_candles_unsupported_symbol_NOW
- ZM: missing, rows=0, range=n/a to n/a, source=UNKNOWN, error=local_csv_candles_unsupported_symbol_ZM
- SHOP: missing, rows=0, range=n/a to n/a, source=UNKNOWN, error=local_csv_candles_unsupported_symbol_SHOP
- DOCU: missing, rows=0, range=n/a to n/a, source=UNKNOWN, error=local_csv_candles_unsupported_symbol_DOCU
- THAT: missing, rows=0, range=n/a to n/a, source=UNKNOWN, error=local_csv_candles_unsupported_symbol_THAT
- MMS: missing, rows=0, range=n/a to n/a, source=UNKNOWN, error=local_csv_candles_unsupported_symbol_MMS
- BTC: missing, rows=0, range=n/a to n/a, source=UNKNOWN, error=local_csv_candles_unsupported_symbol_BTC
- AMD: missing, rows=0, range=n/a to n/a, source=UNKNOWN, error=local_csv_candles_unsupported_symbol_AMD
- HTTPS: missing, rows=0, range=n/a to n/a, source=UNKNOWN, error=local_csv_candles_unsupported_symbol_HTTPS
- LOL: missing, rows=0, range=n/a to n/a, source=UNKNOWN, error=local_csv_candles_unsupported_symbol_LOL
- AXP: missing, rows=0, range=n/a to n/a, source=UNKNOWN, error=local_csv_candles_unsupported_symbol_AXP
- PLTR: missing, rows=0, range=n/a to n/a, source=UNKNOWN, error=local_csv_candles_unsupported_symbol_PLTR
- GLD: missing, rows=0, range=n/a to n/a, source=UNKNOWN, error=local_csv_candles_unsupported_symbol_GLD
- GDX: missing, rows=0, range=n/a to n/a, source=UNKNOWN, error=local_csv_candles_unsupported_symbol_GDX
- JUST: missing, rows=0, range=n/a to n/a, source=UNKNOWN, error=local_csv_candles_unsupported_symbol_JUST
- CVNA: missing, rows=0, range=n/a to n/a, source=UNKNOWN, error=local_csv_candles_unsupported_symbol_CVNA
- STEP: missing, rows=0, range=n/a to n/a, source=UNKNOWN, error=local_csv_candles_unsupported_symbol_STEP
- EL: missing, rows=0, range=n/a to n/a, source=UNKNOWN, error=local_csv_candles_unsupported_symbol_EL
- DID: missing, rows=0, range=n/a to n/a, source=UNKNOWN, error=local_csv_candles_unsupported_symbol_DID
- PROB: missing, rows=0, range=n/a to n/a, source=UNKNOWN, error=local_csv_candles_unsupported_symbol_PROB
- WRITE: missing, rows=0, range=n/a to n/a, source=UNKNOWN, error=local_csv_candles_unsupported_symbol_WRITE
- BE: missing, rows=0, range=n/a to n/a, source=UNKNOWN, error=local_csv_candles_unsupported_symbol_BE
- THEY: missing, rows=0, range=n/a to n/a, source=UNKNOWN, error=local_csv_candles_unsupported_symbol_THEY
- BX: missing, rows=0, range=n/a to n/a, source=UNKNOWN, error=local_csv_candles_unsupported_symbol_BX
- THE: missing, rows=0, range=n/a to n/a, source=UNKNOWN, error=local_csv_candles_unsupported_symbol_THE
- KODK: missing, rows=0, range=n/a to n/a, source=UNKNOWN, error=local_csv_candles_unsupported_symbol_KODK
- BRK: missing, rows=0, range=n/a to n/a, source=UNKNOWN, error=local_csv_candles_unsupported_symbol_BRK
- MCD: missing, rows=0, range=n/a to n/a, source=UNKNOWN, error=local_csv_candles_unsupported_symbol_MCD
- IF: missing, rows=0, range=n/a to n/a, source=UNKNOWN, error=local_csv_candles_unsupported_symbol_IF
- IGV: missing, rows=0, range=n/a to n/a, source=UNKNOWN, error=local_csv_candles_unsupported_symbol_IGV
- INTC: missing, rows=0, range=n/a to n/a, source=UNKNOWN, error=local_csv_candles_unsupported_symbol_INTC
- THESE: missing, rows=0, range=n/a to n/a, source=UNKNOWN, error=local_csv_candles_unsupported_symbol_THESE
- TEM: missing, rows=0, range=n/a to n/a, source=UNKNOWN, error=local_csv_candles_unsupported_symbol_TEM
- SAID: missing, rows=0, range=n/a to n/a, source=UNKNOWN, error=local_csv_candles_unsupported_symbol_SAID
- GNRC: missing, rows=0, range=n/a to n/a, source=UNKNOWN, error=local_csv_candles_unsupported_symbol_GNRC
- RBLX: missing, rows=0, range=n/a to n/a, source=UNKNOWN, error=local_csv_candles_unsupported_symbol_RBLX
- ARE: missing, rows=0, range=n/a to n/a, source=UNKNOWN, error=local_csv_candles_unsupported_symbol_ARE
- FOR: missing, rows=0, range=n/a to n/a, source=UNKNOWN, error=local_csv_candles_unsupported_symbol_FOR
- YUP: missing, rows=0, range=n/a to n/a, source=UNKNOWN, error=local_csv_candles_unsupported_symbol_YUP
- NOT: missing, rows=0, range=n/a to n/a, source=UNKNOWN, error=local_csv_candles_unsupported_symbol_NOT
- DOESN: missing, rows=0, range=n/a to n/a, source=UNKNOWN, error=local_csv_candles_unsupported_symbol_DOESN
- HOW: missing, rows=0, range=n/a to n/a, source=UNKNOWN, error=local_csv_candles_unsupported_symbol_HOW
- DUOL: missing, rows=0, range=n/a to n/a, source=UNKNOWN, error=local_csv_candles_unsupported_symbol_DUOL
- THERE: missing, rows=0, range=n/a to n/a, source=UNKNOWN, error=local_csv_candles_unsupported_symbol_THERE
- UNH: missing, rows=0, range=n/a to n/a, source=UNKNOWN, error=local_csv_candles_unsupported_symbol_UNH
- WOULD: missing, rows=0, range=n/a to n/a, source=UNKNOWN, error=local_csv_candles_unsupported_symbol_WOULD
- ADBE: missing, rows=0, range=n/a to n/a, source=UNKNOWN, error=local_csv_candles_unsupported_symbol_ADBE
- FDX: missing, rows=0, range=n/a to n/a, source=UNKNOWN, error=local_csv_candles_unsupported_symbol_FDX
- HAVE: missing, rows=0, range=n/a to n/a, source=UNKNOWN, error=local_csv_candles_unsupported_symbol_HAVE
- WAS: missing, rows=0, range=n/a to n/a, source=UNKNOWN, error=local_csv_candles_unsupported_symbol_WAS
- CHART: missing, rows=0, range=n/a to n/a, source=UNKNOWN, error=local_csv_candles_unsupported_symbol_CHART
- WHICH: missing, rows=0, range=n/a to n/a, source=UNKNOWN, error=local_csv_candles_unsupported_symbol_WHICH
- MIGHT: missing, rows=0, range=n/a to n/a, source=UNKNOWN, error=local_csv_candles_unsupported_symbol_MIGHT
- OF: missing, rows=0, range=n/a to n/a, source=UNKNOWN, error=local_csv_candles_unsupported_symbol_OF
- IS: missing, rows=0, range=n/a to n/a, source=UNKNOWN, error=local_csv_candles_unsupported_symbol_IS
- THIS: missing, rows=0, range=n/a to n/a, source=UNKNOWN, error=local_csv_candles_unsupported_symbol_THIS
- QCOM: missing, rows=0, range=n/a to n/a, source=UNKNOWN, error=local_csv_candles_unsupported_symbol_QCOM
- NOTED: missing, rows=0, range=n/a to n/a, source=UNKNOWN, error=local_csv_candles_unsupported_symbol_NOTED
- TTWO: missing, rows=0, range=n/a to n/a, source=UNKNOWN, error=local_csv_candles_unsupported_symbol_TTWO
- BEAR: missing, rows=0, range=n/a to n/a, source=UNKNOWN, error=local_csv_candles_unsupported_symbol_BEAR
- ISSUE: missing, rows=0, range=n/a to n/a, source=UNKNOWN, error=local_csv_candles_unsupported_symbol_ISSUE
- IT: missing, rows=0, range=n/a to n/a, source=UNKNOWN, error=local_csv_candles_unsupported_symbol_IT
- GOT: missing, rows=0, range=n/a to n/a, source=UNKNOWN, error=local_csv_candles_unsupported_symbol_GOT
- ALSO: missing, rows=0, range=n/a to n/a, source=UNKNOWN, error=local_csv_candles_unsupported_symbol_ALSO
- BETS: missing, rows=0, range=n/a to n/a, source=UNKNOWN, error=local_csv_candles_unsupported_symbol_BETS
- COIN: missing, rows=0, range=n/a to n/a, source=UNKNOWN, error=local_csv_candles_unsupported_symbol_COIN
- AFTER: missing, rows=0, range=n/a to n/a, source=UNKNOWN, error=local_csv_candles_unsupported_symbol_AFTER
- WHAT: missing, rows=0, range=n/a to n/a, source=UNKNOWN, error=local_csv_candles_unsupported_symbol_WHAT
- DE: missing, rows=0, range=n/a to n/a, source=UNKNOWN, error=local_csv_candles_unsupported_symbol_DE
- AND: missing, rows=0, range=n/a to n/a, source=UNKNOWN, error=local_csv_candles_unsupported_symbol_AND
- AAPL: missing, rows=0, range=n/a to n/a, source=UNKNOWN, error=local_csv_candles_unsupported_symbol_AAPL
- AMZN: missing, rows=0, range=n/a to n/a, source=UNKNOWN, error=local_csv_candles_unsupported_symbol_AMZN
- MAP: missing, rows=0, range=n/a to n/a, source=UNKNOWN, error=local_csv_candles_unsupported_symbol_MAP
- GE: missing, rows=0, range=n/a to n/a, source=UNKNOWN, error=local_csv_candles_unsupported_symbol_GE
- MSTR: missing, rows=0, range=n/a to n/a, source=UNKNOWN, error=local_csv_candles_unsupported_symbol_MSTR
- META: missing, rows=0, range=n/a to n/a, source=UNKNOWN, error=local_csv_candles_unsupported_symbol_META
- MDB: missing, rows=0, range=n/a to n/a, source=UNKNOWN, error=local_csv_candles_unsupported_symbol_MDB
- SNDK: missing, rows=0, range=n/a to n/a, source=UNKNOWN, error=local_csv_candles_unsupported_symbol_SNDK
- CAME: missing, rows=0, range=n/a to n/a, source=UNKNOWN, error=local_csv_candles_unsupported_symbol_CAME
- SOME: missing, rows=0, range=n/a to n/a, source=UNKNOWN, error=local_csv_candles_unsupported_symbol_SOME
- LOW: missing, rows=0, range=n/a to n/a, source=UNKNOWN, error=local_csv_candles_unsupported_symbol_LOW
- GOLD: missing, rows=0, range=n/a to n/a, source=UNKNOWN, error=local_csv_candles_unsupported_symbol_GOLD
- MU: missing, rows=0, range=n/a to n/a, source=UNKNOWN, error=local_csv_candles_unsupported_symbol_MU
- APP: missing, rows=0, range=n/a to n/a, source=UNKNOWN, error=local_csv_candles_unsupported_symbol_APP
- LET: missing, rows=0, range=n/a to n/a, source=UNKNOWN, error=local_csv_candles_unsupported_symbol_LET
- TGT: missing, rows=0, range=n/a to n/a, source=UNKNOWN, error=local_csv_candles_unsupported_symbol_TGT
- DOWN: missing, rows=0, range=n/a to n/a, source=UNKNOWN, error=local_csv_candles_unsupported_symbol_DOWN
- SNOW: missing, rows=0, range=n/a to n/a, source=UNKNOWN, error=local_csv_candles_unsupported_symbol_SNOW
- ONLY: missing, rows=0, range=n/a to n/a, source=UNKNOWN, error=local_csv_candles_unsupported_symbol_ONLY
- CRWV: missing, rows=0, range=n/a to n/a, source=UNKNOWN, error=local_csv_candles_unsupported_symbol_CRWV
- APLD: missing, rows=0, range=n/a to n/a, source=UNKNOWN, error=local_csv_candles_unsupported_symbol_APLD
- CLS: missing, rows=0, range=n/a to n/a, source=UNKNOWN, error=local_csv_candles_unsupported_symbol_CLS
- CMI: missing, rows=0, range=n/a to n/a, source=UNKNOWN, error=local_csv_candles_unsupported_symbol_CMI
- FTAI: missing, rows=0, range=n/a to n/a, source=UNKNOWN, error=local_csv_candles_unsupported_symbol_FTAI
- DRAW: missing, rows=0, range=n/a to n/a, source=UNKNOWN, error=local_csv_candles_unsupported_symbol_DRAW
- BIIB: missing, rows=0, range=n/a to n/a, source=UNKNOWN, error=local_csv_candles_unsupported_symbol_BIIB
- FSLR: missing, rows=0, range=n/a to n/a, source=UNKNOWN, error=local_csv_candles_unsupported_symbol_FSLR
- MRNA: missing, rows=0, range=n/a to n/a, source=UNKNOWN, error=local_csv_candles_unsupported_symbol_MRNA
- WEEK: missing, rows=0, range=n/a to n/a, source=UNKNOWN, error=local_csv_candles_unsupported_symbol_WEEK
- BA: missing, rows=0, range=n/a to n/a, source=UNKNOWN, error=local_csv_candles_unsupported_symbol_BA
- WE: missing, rows=0, range=n/a to n/a, source=UNKNOWN, error=local_csv_candles_unsupported_symbol_WE
- LLY: missing, rows=0, range=n/a to n/a, source=UNKNOWN, error=local_csv_candles_unsupported_symbol_LLY
- ARM: missing, rows=0, range=n/a to n/a, source=UNKNOWN, error=local_csv_candles_unsupported_symbol_ARM
- MAN: missing, rows=0, range=n/a to n/a, source=UNKNOWN, error=local_csv_candles_unsupported_symbol_MAN
- CAVA: missing, rows=0, range=n/a to n/a, source=UNKNOWN, error=local_csv_candles_unsupported_symbol_CAVA
- ASTS: missing, rows=0, range=n/a to n/a, source=UNKNOWN, error=local_csv_candles_unsupported_symbol_ASTS
- TRIED: missing, rows=0, range=n/a to n/a, source=UNKNOWN, error=local_csv_candles_unsupported_symbol_TRIED
- NKE: missing, rows=0, range=n/a to n/a, source=UNKNOWN, error=local_csv_candles_unsupported_symbol_NKE
- EVEN: missing, rows=0, range=n/a to n/a, source=UNKNOWN, error=local_csv_candles_unsupported_symbol_EVEN
- WELL: missing, rows=0, range=n/a to n/a, source=UNKNOWN, error=local_csv_candles_unsupported_symbol_WELL
- YOU: missing, rows=0, range=n/a to n/a, source=UNKNOWN, error=local_csv_candles_unsupported_symbol_YOU
- OTM: missing, rows=0, range=n/a to n/a, source=UNKNOWN, error=local_csv_candles_unsupported_symbol_OTM
- TRUMP: missing, rows=0, range=n/a to n/a, source=UNKNOWN, error=local_csv_candles_unsupported_symbol_TRUMP
- TSLA: missing, rows=0, range=n/a to n/a, source=UNKNOWN, error=local_csv_candles_unsupported_symbol_TSLA
- FIG: missing, rows=0, range=n/a to n/a, source=UNKNOWN, error=local_csv_candles_unsupported_symbol_FIG
- OPEX: missing, rows=0, range=n/a to n/a, source=UNKNOWN, error=local_csv_candles_unsupported_symbol_OPEX
- HE: missing, rows=0, range=n/a to n/a, source=UNKNOWN, error=local_csv_candles_unsupported_symbol_HE
- ONE: missing, rows=0, range=n/a to n/a, source=UNKNOWN, error=local_csv_candles_unsupported_symbol_ONE
- ITS: missing, rows=0, range=n/a to n/a, source=UNKNOWN, error=local_csv_candles_unsupported_symbol_ITS
- MY: missing, rows=0, range=n/a to n/a, source=UNKNOWN, error=local_csv_candles_unsupported_symbol_MY
- TREND: missing, rows=0, range=n/a to n/a, source=UNKNOWN, error=local_csv_candles_unsupported_symbol_TREND
- LEVI: missing, rows=0, range=n/a to n/a, source=UNKNOWN, error=local_csv_candles_unsupported_symbol_LEVI
- SE: missing, rows=0, range=n/a to n/a, source=UNKNOWN, error=local_csv_candles_unsupported_symbol_SE
- SC: missing, rows=0, range=n/a to n/a, source=UNKNOWN, error=local_csv_candles_unsupported_symbol_SC
- DO: missing, rows=0, range=n/a to n/a, source=UNKNOWN, error=local_csv_candles_unsupported_symbol_DO
- TSM: missing, rows=0, range=n/a to n/a, source=UNKNOWN, error=local_csv_candles_unsupported_symbol_TSM
- HOLD: missing, rows=0, range=n/a to n/a, source=UNKNOWN, error=local_csv_candles_unsupported_symbol_HOLD
- CATCH: missing, rows=0, range=n/a to n/a, source=UNKNOWN, error=local_csv_candles_unsupported_symbol_CATCH
- FEELS: missing, rows=0, range=n/a to n/a, source=UNKNOWN, error=local_csv_candles_unsupported_symbol_FEELS
- BUT: missing, rows=0, range=n/a to n/a, source=UNKNOWN, error=local_csv_candles_unsupported_symbol_BUT
- WILL: missing, rows=0, range=n/a to n/a, source=UNKNOWN, error=local_csv_candles_unsupported_symbol_WILL
- HASN: missing, rows=0, range=n/a to n/a, source=UNKNOWN, error=local_csv_candles_unsupported_symbol_HASN
- ALSON: missing, rows=0, range=n/a to n/a, source=UNKNOWN, error=local_csv_candles_unsupported_symbol_ALSON
- TEAM: missing, rows=0, range=n/a to n/a, source=UNKNOWN, error=local_csv_candles_unsupported_symbol_TEAM
- NVDA: missing, rows=0, range=n/a to n/a, source=UNKNOWN, error=local_csv_candles_unsupported_symbol_NVDA
- PANW: missing, rows=0, range=n/a to n/a, source=UNKNOWN, error=local_csv_candles_unsupported_symbol_PANW
- ENPH: missing, rows=0, range=n/a to n/a, source=UNKNOWN, error=local_csv_candles_unsupported_symbol_ENPH
- VE: missing, rows=0, range=n/a to n/a, source=UNKNOWN, error=local_csv_candles_unsupported_symbol_VE
- BULLS: missing, rows=0, range=n/a to n/a, source=UNKNOWN, error=local_csv_candles_unsupported_symbol_BULLS
- SHOW: missing, rows=0, range=n/a to n/a, source=UNKNOWN, error=local_csv_candles_unsupported_symbol_SHOW
- TODAY: missing, rows=0, range=n/a to n/a, source=UNKNOWN, error=local_csv_candles_unsupported_symbol_TODAY
- LMND: missing, rows=0, range=n/a to n/a, source=UNKNOWN, error=local_csv_candles_unsupported_symbol_LMND
- WITH: missing, rows=0, range=n/a to n/a, source=UNKNOWN, error=local_csv_candles_unsupported_symbol_WITH
- NEED: missing, rows=0, range=n/a to n/a, source=UNKNOWN, error=local_csv_candles_unsupported_symbol_NEED
- AVGO: missing, rows=0, range=n/a to n/a, source=UNKNOWN, error=local_csv_candles_unsupported_symbol_AVGO
- SFSL: missing, rows=0, range=n/a to n/a, source=UNKNOWN, error=local_csv_candles_unsupported_symbol_SFSL
- BIT: missing, rows=0, range=n/a to n/a, source=UNKNOWN, error=local_csv_candles_unsupported_symbol_BIT
- ALAB: missing, rows=0, range=n/a to n/a, source=UNKNOWN, error=local_csv_candles_unsupported_symbol_ALAB
- OH: missing, rows=0, range=n/a to n/a, source=UNKNOWN, error=local_csv_candles_unsupported_symbol_OH
- SO: missing, rows=0, range=n/a to n/a, source=UNKNOWN, error=local_csv_candles_unsupported_symbol_SO
- BOSS: missing, rows=0, range=n/a to n/a, source=UNKNOWN, error=local_csv_candles_unsupported_symbol_BOSS
- DON: missing, rows=0, range=n/a to n/a, source=UNKNOWN, error=local_csv_candles_unsupported_symbol_DON
- NO: missing, rows=0, range=n/a to n/a, source=UNKNOWN, error=local_csv_candles_unsupported_symbol_NO
- BEEN: missing, rows=0, range=n/a to n/a, source=UNKNOWN, error=local_csv_candles_unsupported_symbol_BEEN
- SLOW: missing, rows=0, range=n/a to n/a, source=UNKNOWN, error=local_csv_candles_unsupported_symbol_SLOW
- CATHY: missing, rows=0, range=n/a to n/a, source=UNKNOWN, error=local_csv_candles_unsupported_symbol_CATHY
- SEE: missing, rows=0, range=n/a to n/a, source=UNKNOWN, error=local_csv_candles_unsupported_symbol_SEE
- ADOBE: missing, rows=0, range=n/a to n/a, source=UNKNOWN, error=local_csv_candles_unsupported_symbol_ADOBE
- TWLO: missing, rows=0, range=n/a to n/a, source=UNKNOWN, error=local_csv_candles_unsupported_symbol_TWLO
- ULTA: missing, rows=0, range=n/a to n/a, source=UNKNOWN, error=local_csv_candles_unsupported_symbol_ULTA
- MA: missing, rows=0, range=n/a to n/a, source=UNKNOWN, error=local_csv_candles_unsupported_symbol_MA
- TOUGH: missing, rows=0, range=n/a to n/a, source=UNKNOWN, error=local_csv_candles_unsupported_symbol_TOUGH
- LAST: missing, rows=0, range=n/a to n/a, source=UNKNOWN, error=local_csv_candles_unsupported_symbol_LAST
- WICK: missing, rows=0, range=n/a to n/a, source=UNKNOWN, error=local_csv_candles_unsupported_symbol_WICK
- GS: missing, rows=0, range=n/a to n/a, source=UNKNOWN, error=local_csv_candles_unsupported_symbol_GS
- NEXT: missing, rows=0, range=n/a to n/a, source=UNKNOWN, error=local_csv_candles_unsupported_symbol_NEXT
- SOLD: missing, rows=0, range=n/a to n/a, source=UNKNOWN, error=local_csv_candles_unsupported_symbol_SOLD
- FISV: missing, rows=0, range=n/a to n/a, source=UNKNOWN, error=local_csv_candles_unsupported_symbol_FISV
- GIVES: missing, rows=0, range=n/a to n/a, source=UNKNOWN, error=local_csv_candles_unsupported_symbol_GIVES
- AS: missing, rows=0, range=n/a to n/a, source=UNKNOWN, error=local_csv_candles_unsupported_symbol_AS
- OR: missing, rows=0, range=n/a to n/a, source=UNKNOWN, error=local_csv_candles_unsupported_symbol_OR
- BEARS: missing, rows=0, range=n/a to n/a, source=UNKNOWN, error=local_csv_candles_unsupported_symbol_BEARS
- ROKU: missing, rows=0, range=n/a to n/a, source=UNKNOWN, error=local_csv_candles_unsupported_symbol_ROKU
- ON: missing, rows=0, range=n/a to n/a, source=UNKNOWN, error=local_csv_candles_unsupported_symbol_ON
- CEG: missing, rows=0, range=n/a to n/a, source=UNKNOWN, error=local_csv_candles_unsupported_symbol_CEG
- WHERE: missing, rows=0, range=n/a to n/a, source=UNKNOWN, error=local_csv_candles_unsupported_symbol_WHERE
- LOT: missing, rows=0, range=n/a to n/a, source=UNKNOWN, error=local_csv_candles_unsupported_symbol_LOT
- UPS: missing, rows=0, range=n/a to n/a, source=UNKNOWN, error=local_csv_candles_unsupported_symbol_UPS
- GUESS: missing, rows=0, range=n/a to n/a, source=UNKNOWN, error=local_csv_candles_unsupported_symbol_GUESS
- HOLY: missing, rows=0, range=n/a to n/a, source=UNKNOWN, error=local_csv_candles_unsupported_symbol_HOLY
- GOOD: missing, rows=0, range=n/a to n/a, source=UNKNOWN, error=local_csv_candles_unsupported_symbol_GOOD
- AM: missing, rows=0, range=n/a to n/a, source=UNKNOWN, error=local_csv_candles_unsupported_symbol_AM
- NOTE: missing, rows=0, range=n/a to n/a, source=UNKNOWN, error=local_csv_candles_unsupported_symbol_NOTE
- AT: missing, rows=0, range=n/a to n/a, source=UNKNOWN, error=local_csv_candles_unsupported_symbol_AT
- LOWS: missing, rows=0, range=n/a to n/a, source=UNKNOWN, error=local_csv_candles_unsupported_symbol_LOWS
- XYZ: missing, rows=0, range=n/a to n/a, source=UNKNOWN, error=local_csv_candles_unsupported_symbol_XYZ
- SURE: missing, rows=0, range=n/a to n/a, source=UNKNOWN, error=local_csv_candles_unsupported_symbol_SURE
- LEFT: missing, rows=0, range=n/a to n/a, source=UNKNOWN, error=local_csv_candles_unsupported_symbol_LEFT
- HIT: missing, rows=0, range=n/a to n/a, source=UNKNOWN, error=local_csv_candles_unsupported_symbol_HIT
- EA: missing, rows=0, range=n/a to n/a, source=UNKNOWN, error=local_csv_candles_unsupported_symbol_EA
- PLAY: missing, rows=0, range=n/a to n/a, source=UNKNOWN, error=local_csv_candles_unsupported_symbol_PLAY
- GREAT: missing, rows=0, range=n/a to n/a, source=UNKNOWN, error=local_csv_candles_unsupported_symbol_GREAT
- GOING: missing, rows=0, range=n/a to n/a, source=UNKNOWN, error=local_csv_candles_unsupported_symbol_GOING
- BY: missing, rows=0, range=n/a to n/a, source=UNKNOWN, error=local_csv_candles_unsupported_symbol_BY
- OKAY: missing, rows=0, range=n/a to n/a, source=UNKNOWN, error=local_csv_candles_unsupported_symbol_OKAY
- WAHHH: missing, rows=0, range=n/a to n/a, source=UNKNOWN, error=local_csv_candles_unsupported_symbol_WAHHH
- IWM: missing, rows=0, range=n/a to n/a, source=UNKNOWN, error=local_csv_candles_unsupported_symbol_IWM
- ITM: missing, rows=0, range=n/a to n/a, source=UNKNOWN, error=local_csv_candles_unsupported_symbol_ITM
- READ: missing, rows=0, range=n/a to n/a, source=UNKNOWN, error=local_csv_candles_unsupported_symbol_READ
- GO: missing, rows=0, range=n/a to n/a, source=UNKNOWN, error=local_csv_candles_unsupported_symbol_GO
- SPAIN: missing, rows=0, range=n/a to n/a, source=UNKNOWN, error=local_csv_candles_unsupported_symbol_SPAIN
- CAN: missing, rows=0, range=n/a to n/a, source=UNKNOWN, error=local_csv_candles_unsupported_symbol_CAN
- STILL: missing, rows=0, range=n/a to n/a, source=UNKNOWN, error=local_csv_candles_unsupported_symbol_STILL
- SMART: missing, rows=0, range=n/a to n/a, source=UNKNOWN, error=local_csv_candles_unsupported_symbol_SMART
- ANET: missing, rows=0, range=n/a to n/a, source=UNKNOWN, error=local_csv_candles_unsupported_symbol_ANET
- JPM: missing, rows=0, range=n/a to n/a, source=UNKNOWN, error=local_csv_candles_unsupported_symbol_JPM
- IONQ: missing, rows=0, range=n/a to n/a, source=UNKNOWN, error=local_csv_candles_unsupported_symbol_IONQ
- HALF: missing, rows=0, range=n/a to n/a, source=UNKNOWN, error=local_csv_candles_unsupported_symbol_HALF
- OTHER: missing, rows=0, range=n/a to n/a, source=UNKNOWN, error=local_csv_candles_unsupported_symbol_OTHER
- MRK: missing, rows=0, range=n/a to n/a, source=UNKNOWN, error=local_csv_candles_unsupported_symbol_MRK
- CRM: missing, rows=0, range=n/a to n/a, source=UNKNOWN, error=local_csv_candles_unsupported_symbol_CRM
- ME: missing, rows=0, range=n/a to n/a, source=UNKNOWN, error=local_csv_candles_unsupported_symbol_ME
- THINK: missing, rows=0, range=n/a to n/a, source=UNKNOWN, error=local_csv_candles_unsupported_symbol_THINK
- WHY: missing, rows=0, range=n/a to n/a, source=UNKNOWN, error=local_csv_candles_unsupported_symbol_WHY
- FIRST: missing, rows=0, range=n/a to n/a, source=UNKNOWN, error=local_csv_candles_unsupported_symbol_FIRST
- IDK: missing, rows=0, range=n/a to n/a, source=UNKNOWN, error=local_csv_candles_unsupported_symbol_IDK
- IN: missing, rows=0, range=n/a to n/a, source=UNKNOWN, error=local_csv_candles_unsupported_symbol_IN
- ES: found, rows=52927, range=2026-03-02T01:37:00.000Z to 2026-04-29T12:29:00.000Z, source=local/replay
- YEAH: missing, rows=0, range=n/a to n/a, source=UNKNOWN, error=local_csv_candles_unsupported_symbol_YEAH
- YOUR: missing, rows=0, range=n/a to n/a, source=UNKNOWN, error=local_csv_candles_unsupported_symbol_YOUR
- BLAME: missing, rows=0, range=n/a to n/a, source=UNKNOWN, error=local_csv_candles_unsupported_symbol_BLAME
- WERE: missing, rows=0, range=n/a to n/a, source=UNKNOWN, error=local_csv_candles_unsupported_symbol_WERE
- MICRO: missing, rows=0, range=n/a to n/a, source=UNKNOWN, error=local_csv_candles_unsupported_symbol_MICRO
- DPZ: missing, rows=0, range=n/a to n/a, source=UNKNOWN, error=local_csv_candles_unsupported_symbol_DPZ
- WILLL: missing, rows=0, range=n/a to n/a, source=UNKNOWN, error=local_csv_candles_unsupported_symbol_WILLL
- FEEL: missing, rows=0, range=n/a to n/a, source=UNKNOWN, error=local_csv_candles_unsupported_symbol_FEEL
- TO: missing, rows=0, range=n/a to n/a, source=UNKNOWN, error=local_csv_candles_unsupported_symbol_TO
- BARRY: missing, rows=0, range=n/a to n/a, source=UNKNOWN, error=local_csv_candles_unsupported_symbol_BARRY
- BEST: missing, rows=0, range=n/a to n/a, source=UNKNOWN, error=local_csv_candles_unsupported_symbol_BEST
- WAR: missing, rows=0, range=n/a to n/a, source=UNKNOWN, error=local_csv_candles_unsupported_symbol_WAR
- THOSE: missing, rows=0, range=n/a to n/a, source=UNKNOWN, error=local_csv_candles_unsupported_symbol_THOSE
- ANY: missing, rows=0, range=n/a to n/a, source=UNKNOWN, error=local_csv_candles_unsupported_symbol_ANY
- NA: missing, rows=0, range=n/a to n/a, source=UNKNOWN, error=local_csv_candles_unsupported_symbol_NA
- TERM: missing, rows=0, range=n/a to n/a, source=UNKNOWN, error=local_csv_candles_unsupported_symbol_TERM
- CRCL: missing, rows=0, range=n/a to n/a, source=UNKNOWN, error=local_csv_candles_unsupported_symbol_CRCL
- SCALP: missing, rows=0, range=n/a to n/a, source=UNKNOWN, error=local_csv_candles_unsupported_symbol_SCALP
- VRT: missing, rows=0, range=n/a to n/a, source=UNKNOWN, error=local_csv_candles_unsupported_symbol_VRT
- CAT: missing, rows=0, range=n/a to n/a, source=UNKNOWN, error=local_csv_candles_unsupported_symbol_CAT
- MORE: missing, rows=0, range=n/a to n/a, source=UNKNOWN, error=local_csv_candles_unsupported_symbol_MORE
- TIME: missing, rows=0, range=n/a to n/a, source=UNKNOWN, error=local_csv_candles_unsupported_symbol_TIME
- PEAK: missing, rows=0, range=n/a to n/a, source=UNKNOWN, error=local_csv_candles_unsupported_symbol_PEAK
- IM: missing, rows=0, range=n/a to n/a, source=UNKNOWN, error=local_csv_candles_unsupported_symbol_IM
- MAY: missing, rows=0, range=n/a to n/a, source=UNKNOWN, error=local_csv_candles_unsupported_symbol_MAY
- UP: missing, rows=0, range=n/a to n/a, source=UNKNOWN, error=local_csv_candles_unsupported_symbol_UP
- LETS: missing, rows=0, range=n/a to n/a, source=UNKNOWN, error=local_csv_candles_unsupported_symbol_LETS
- AGAIN: missing, rows=0, range=n/a to n/a, source=UNKNOWN, error=local_csv_candles_unsupported_symbol_AGAIN
- DAY: missing, rows=0, range=n/a to n/a, source=UNKNOWN, error=local_csv_candles_unsupported_symbol_DAY
- OIL: missing, rows=0, range=n/a to n/a, source=UNKNOWN, error=local_csv_candles_unsupported_symbol_OIL
- WHEN: missing, rows=0, range=n/a to n/a, source=UNKNOWN, error=local_csv_candles_unsupported_symbol_WHEN
- DATED: missing, rows=0, range=n/a to n/a, source=UNKNOWN, error=local_csv_candles_unsupported_symbol_DATED
- DAMN: missing, rows=0, range=n/a to n/a, source=UNKNOWN, error=local_csv_candles_unsupported_symbol_DAMN
- MSFT: missing, rows=0, range=n/a to n/a, source=UNKNOWN, error=local_csv_candles_unsupported_symbol_MSFT
- BTO: missing, rows=0, range=n/a to n/a, source=UNKNOWN, error=local_csv_candles_unsupported_symbol_BTO
- BOTH: missing, rows=0, range=n/a to n/a, source=UNKNOWN, error=local_csv_candles_unsupported_symbol_BOTH
- DONT: missing, rows=0, range=n/a to n/a, source=UNKNOWN, error=local_csv_candles_unsupported_symbol_DONT
- XOM: missing, rows=0, range=n/a to n/a, source=UNKNOWN, error=local_csv_candles_unsupported_symbol_XOM
- BALLS: missing, rows=0, range=n/a to n/a, source=UNKNOWN, error=local_csv_candles_unsupported_symbol_BALLS
- TOLD: missing, rows=0, range=n/a to n/a, source=UNKNOWN, error=local_csv_candles_unsupported_symbol_TOLD
- ALGOS: missing, rows=0, range=n/a to n/a, source=UNKNOWN, error=local_csv_candles_unsupported_symbol_ALGOS
- FEAR: missing, rows=0, range=n/a to n/a, source=UNKNOWN, error=local_csv_candles_unsupported_symbol_FEAR
- NEEDS: missing, rows=0, range=n/a to n/a, source=UNKNOWN, error=local_csv_candles_unsupported_symbol_NEEDS
- DIMON: missing, rows=0, range=n/a to n/a, source=UNKNOWN, error=local_csv_candles_unsupported_symbol_DIMON
- TAKE: missing, rows=0, range=n/a to n/a, source=UNKNOWN, error=local_csv_candles_unsupported_symbol_TAKE
- SPENT: missing, rows=0, range=n/a to n/a, source=UNKNOWN, error=local_csv_candles_unsupported_symbol_SPENT
- LIKE: missing, rows=0, range=n/a to n/a, source=UNKNOWN, error=local_csv_candles_unsupported_symbol_LIKE
- PLAN: missing, rows=0, range=n/a to n/a, source=UNKNOWN, error=local_csv_candles_unsupported_symbol_PLAN
- HAD: missing, rows=0, range=n/a to n/a, source=UNKNOWN, error=local_csv_candles_unsupported_symbol_HAD
- QUICK: missing, rows=0, range=n/a to n/a, source=UNKNOWN, error=local_csv_candles_unsupported_symbol_QUICK
- CALL: missing, rows=0, range=n/a to n/a, source=UNKNOWN, error=local_csv_candles_unsupported_symbol_CALL
- WAIT: missing, rows=0, range=n/a to n/a, source=UNKNOWN, error=local_csv_candles_unsupported_symbol_WAIT
- WENT: missing, rows=0, range=n/a to n/a, source=UNKNOWN, error=local_csv_candles_unsupported_symbol_WENT
- CONS: missing, rows=0, range=n/a to n/a, source=UNKNOWN, error=local_csv_candles_unsupported_symbol_CONS
- COME: missing, rows=0, range=n/a to n/a, source=UNKNOWN, error=local_csv_candles_unsupported_symbol_COME
- ORCL: missing, rows=0, range=n/a to n/a, source=UNKNOWN, error=local_csv_candles_unsupported_symbol_ORCL
- MADE: missing, rows=0, range=n/a to n/a, source=UNKNOWN, error=local_csv_candles_unsupported_symbol_MADE
- LOOK: missing, rows=0, range=n/a to n/a, source=UNKNOWN, error=local_csv_candles_unsupported_symbol_LOOK
- TROW: missing, rows=0, range=n/a to n/a, source=UNKNOWN, error=local_csv_candles_unsupported_symbol_TROW
- APO: missing, rows=0, range=n/a to n/a, source=UNKNOWN, error=local_csv_candles_unsupported_symbol_APO
- ZETA: missing, rows=0, range=n/a to n/a, source=UNKNOWN, error=local_csv_candles_unsupported_symbol_ZETA
- AAOI: missing, rows=0, range=n/a to n/a, source=UNKNOWN, error=local_csv_candles_unsupported_symbol_AAOI
- HIMS: missing, rows=0, range=n/a to n/a, source=UNKNOWN, error=local_csv_candles_unsupported_symbol_HIMS
- THATS: missing, rows=0, range=n/a to n/a, source=UNKNOWN, error=local_csv_candles_unsupported_symbol_THATS
- LOTTO: missing, rows=0, range=n/a to n/a, source=UNKNOWN, error=local_csv_candles_unsupported_symbol_LOTTO
- MOST: missing, rows=0, range=n/a to n/a, source=UNKNOWN, error=local_csv_candles_unsupported_symbol_MOST
- ISRG: missing, rows=0, range=n/a to n/a, source=UNKNOWN, error=local_csv_candles_unsupported_symbol_ISRG
- TOOK: missing, rows=0, range=n/a to n/a, source=UNKNOWN, error=local_csv_candles_unsupported_symbol_TOOK
- ADDED: missing, rows=0, range=n/a to n/a, source=UNKNOWN, error=local_csv_candles_unsupported_symbol_ADDED
- GM: missing, rows=0, range=n/a to n/a, source=UNKNOWN, error=local_csv_candles_unsupported_symbol_GM
- FRMI: missing, rows=0, range=n/a to n/a, source=UNKNOWN, error=local_csv_candles_unsupported_symbol_FRMI
- GEV: missing, rows=0, range=n/a to n/a, source=UNKNOWN, error=local_csv_candles_unsupported_symbol_GEV
- EMA: missing, rows=0, range=n/a to n/a, source=UNKNOWN, error=local_csv_candles_unsupported_symbol_EMA
- BROKE: missing, rows=0, range=n/a to n/a, source=UNKNOWN, error=local_csv_candles_unsupported_symbol_BROKE
- IBIT: missing, rows=0, range=n/a to n/a, source=UNKNOWN, error=local_csv_candles_unsupported_symbol_IBIT
- PPI: missing, rows=0, range=n/a to n/a, source=UNKNOWN, error=local_csv_candles_unsupported_symbol_PPI
- SHARP: missing, rows=0, range=n/a to n/a, source=UNKNOWN, error=local_csv_candles_unsupported_symbol_SHARP
- OUT: missing, rows=0, range=n/a to n/a, source=UNKNOWN, error=local_csv_candles_unsupported_symbol_OUT
- WEEP: missing, rows=0, range=n/a to n/a, source=UNKNOWN, error=local_csv_candles_unsupported_symbol_WEEP
- SETUP: missing, rows=0, range=n/a to n/a, source=UNKNOWN, error=local_csv_candles_unsupported_symbol_SETUP
- CUT: missing, rows=0, range=n/a to n/a, source=UNKNOWN, error=local_csv_candles_unsupported_symbol_CUT
- DIA: missing, rows=0, range=n/a to n/a, source=UNKNOWN, error=local_csv_candles_unsupported_symbol_DIA
- WORTH: missing, rows=0, range=n/a to n/a, source=UNKNOWN, error=local_csv_candles_unsupported_symbol_WORTH
- RKLB: missing, rows=0, range=n/a to n/a, source=UNKNOWN, error=local_csv_candles_unsupported_symbol_RKLB
- XIMES: missing, rows=0, range=n/a to n/a, source=UNKNOWN, error=local_csv_candles_unsupported_symbol_XIMES
- BEING: missing, rows=0, range=n/a to n/a, source=UNKNOWN, error=local_csv_candles_unsupported_symbol_BEING
- SHOOT: missing, rows=0, range=n/a to n/a, source=UNKNOWN, error=local_csv_candles_unsupported_symbol_SHOOT
- GIVE: missing, rows=0, range=n/a to n/a, source=UNKNOWN, error=local_csv_candles_unsupported_symbol_GIVE
- MAYBE: missing, rows=0, range=n/a to n/a, source=UNKNOWN, error=local_csv_candles_unsupported_symbol_MAYBE
- FULL: missing, rows=0, range=n/a to n/a, source=UNKNOWN, error=local_csv_candles_unsupported_symbol_FULL
- CLOSE: missing, rows=0, range=n/a to n/a, source=UNKNOWN, error=local_csv_candles_unsupported_symbol_CLOSE
- BRO: missing, rows=0, range=n/a to n/a, source=UNKNOWN, error=local_csv_candles_unsupported_symbol_BRO
- SMH: missing, rows=0, range=n/a to n/a, source=UNKNOWN, error=local_csv_candles_unsupported_symbol_SMH
- GIMME: missing, rows=0, range=n/a to n/a, source=UNKNOWN, error=local_csv_candles_unsupported_symbol_GIMME
- BUYS: missing, rows=0, range=n/a to n/a, source=UNKNOWN, error=local_csv_candles_unsupported_symbol_BUYS
- FULLY: missing, rows=0, range=n/a to n/a, source=UNKNOWN, error=local_csv_candles_unsupported_symbol_FULLY
- PER: missing, rows=0, range=n/a to n/a, source=UNKNOWN, error=local_csv_candles_unsupported_symbol_PER
- DEAD: missing, rows=0, range=n/a to n/a, source=UNKNOWN, error=local_csv_candles_unsupported_symbol_DEAD
- WILD: missing, rows=0, range=n/a to n/a, source=UNKNOWN, error=local_csv_candles_unsupported_symbol_WILD
- SEMIS: missing, rows=0, range=n/a to n/a, source=UNKNOWN, error=local_csv_candles_unsupported_symbol_SEMIS
- BARON: missing, rows=0, range=n/a to n/a, source=UNKNOWN, error=local_csv_candles_unsupported_symbol_BARON
- MAKE: missing, rows=0, range=n/a to n/a, source=UNKNOWN, error=local_csv_candles_unsupported_symbol_MAKE
- RUN: missing, rows=0, range=n/a to n/a, source=UNKNOWN, error=local_csv_candles_unsupported_symbol_RUN
- FUCK: missing, rows=0, range=n/a to n/a, source=UNKNOWN, error=local_csv_candles_unsupported_symbol_FUCK
- KEEP: missing, rows=0, range=n/a to n/a, source=UNKNOWN, error=local_csv_candles_unsupported_symbol_KEEP
- RIGHT: missing, rows=0, range=n/a to n/a, source=UNKNOWN, error=local_csv_candles_unsupported_symbol_RIGHT
- TNX: missing, rows=0, range=n/a to n/a, source=UNKNOWN, error=local_csv_candles_unsupported_symbol_TNX
- PORT: missing, rows=0, range=n/a to n/a, source=UNKNOWN, error=local_csv_candles_unsupported_symbol_PORT
- FURUS: missing, rows=0, range=n/a to n/a, source=UNKNOWN, error=local_csv_candles_unsupported_symbol_FURUS
- THO: missing, rows=0, range=n/a to n/a, source=UNKNOWN, error=local_csv_candles_unsupported_symbol_THO
- CELH: missing, rows=0, range=n/a to n/a, source=UNKNOWN, error=local_csv_candles_unsupported_symbol_CELH
- NEW: missing, rows=0, range=n/a to n/a, source=UNKNOWN, error=local_csv_candles_unsupported_symbol_NEW
- POST: missing, rows=0, range=n/a to n/a, source=UNKNOWN, error=local_csv_candles_unsupported_symbol_POST
- NODES: missing, rows=0, range=n/a to n/a, source=UNKNOWN, error=local_csv_candles_unsupported_symbol_NODES
- ZONES: missing, rows=0, range=n/a to n/a, source=UNKNOWN, error=local_csv_candles_unsupported_symbol_ZONES
- CMON: missing, rows=0, range=n/a to n/a, source=UNKNOWN, error=local_csv_candles_unsupported_symbol_CMON
- RISK: missing, rows=0, range=n/a to n/a, source=UNKNOWN, error=local_csv_candles_unsupported_symbol_RISK
- SIZE: missing, rows=0, range=n/a to n/a, source=UNKNOWN, error=local_csv_candles_unsupported_symbol_SIZE
- HAVEN: missing, rows=0, range=n/a to n/a, source=UNKNOWN, error=local_csv_candles_unsupported_symbol_HAVEN
- YES: missing, rows=0, range=n/a to n/a, source=UNKNOWN, error=local_csv_candles_unsupported_symbol_YES
- GONNA: missing, rows=0, range=n/a to n/a, source=UNKNOWN, error=local_csv_candles_unsupported_symbol_GONNA
- WOW: missing, rows=0, range=n/a to n/a, source=UNKNOWN, error=local_csv_candles_unsupported_symbol_WOW
- BRB: missing, rows=0, range=n/a to n/a, source=UNKNOWN, error=local_csv_candles_unsupported_symbol_BRB
- WTF: missing, rows=0, range=n/a to n/a, source=UNKNOWN, error=local_csv_candles_unsupported_symbol_WTF
- NICE: missing, rows=0, range=n/a to n/a, source=UNKNOWN, error=local_csv_candles_unsupported_symbol_NICE
- GUYS: missing, rows=0, range=n/a to n/a, source=UNKNOWN, error=local_csv_candles_unsupported_symbol_GUYS
- FROM: missing, rows=0, range=n/a to n/a, source=UNKNOWN, error=local_csv_candles_unsupported_symbol_FROM
- PYPL: missing, rows=0, range=n/a to n/a, source=UNKNOWN, error=local_csv_candles_unsupported_symbol_PYPL
- LIS: missing, rows=0, range=n/a to n/a, source=UNKNOWN, error=local_csv_candles_unsupported_symbol_LIS
- ROOT: missing, rows=0, range=n/a to n/a, source=UNKNOWN, error=local_csv_candles_unsupported_symbol_ROOT
- WANNA: missing, rows=0, range=n/a to n/a, source=UNKNOWN, error=local_csv_candles_unsupported_symbol_WANNA
- USE: missing, rows=0, range=n/a to n/a, source=UNKNOWN, error=local_csv_candles_unsupported_symbol_USE
- LULU: missing, rows=0, range=n/a to n/a, source=UNKNOWN, error=local_csv_candles_unsupported_symbol_LULU
- TELL: missing, rows=0, range=n/a to n/a, source=UNKNOWN, error=local_csv_candles_unsupported_symbol_TELL
- BTW: missing, rows=0, range=n/a to n/a, source=UNKNOWN, error=local_csv_candles_unsupported_symbol_BTW
- BIG: missing, rows=0, range=n/a to n/a, source=UNKNOWN, error=local_csv_candles_unsupported_symbol_BIG
- HAS: missing, rows=0, range=n/a to n/a, source=UNKNOWN, error=local_csv_candles_unsupported_symbol_HAS
- CAR: missing, rows=0, range=n/a to n/a, source=UNKNOWN, error=local_csv_candles_unsupported_symbol_CAR
- OWLS: missing, rows=0, range=n/a to n/a, source=UNKNOWN, error=local_csv_candles_unsupported_symbol_OWLS
- THEM: missing, rows=0, range=n/a to n/a, source=UNKNOWN, error=local_csv_candles_unsupported_symbol_THEM
- SOON: missing, rows=0, range=n/a to n/a, source=UNKNOWN, error=local_csv_candles_unsupported_symbol_SOON
- TRY: missing, rows=0, range=n/a to n/a, source=UNKNOWN, error=local_csv_candles_unsupported_symbol_TRY
- NFLX: missing, rows=0, range=n/a to n/a, source=UNKNOWN, error=local_csv_candles_unsupported_symbol_NFLX
- BEARY: missing, rows=0, range=n/a to n/a, source=UNKNOWN, error=local_csv_candles_unsupported_symbol_BEARY
- CASH: missing, rows=0, range=n/a to n/a, source=UNKNOWN, error=local_csv_candles_unsupported_symbol_CASH
- PANIC: missing, rows=0, range=n/a to n/a, source=UNKNOWN, error=local_csv_candles_unsupported_symbol_PANIC
- TQQQ: missing, rows=0, range=n/a to n/a, source=UNKNOWN, error=local_csv_candles_unsupported_symbol_TQQQ
- UAL: missing, rows=0, range=n/a to n/a, source=UNKNOWN, error=local_csv_candles_unsupported_symbol_UAL
- CRWD: missing, rows=0, range=n/a to n/a, source=UNKNOWN, error=local_csv_candles_unsupported_symbol_CRWD
- HOPE: missing, rows=0, range=n/a to n/a, source=UNKNOWN, error=local_csv_candles_unsupported_symbol_HOPE
- LIEN: missing, rows=0, range=n/a to n/a, source=UNKNOWN, error=local_csv_candles_unsupported_symbol_LIEN
- IL: missing, rows=0, range=n/a to n/a, source=UNKNOWN, error=local_csv_candles_unsupported_symbol_IL
- RCL: missing, rows=0, range=n/a to n/a, source=UNKNOWN, error=local_csv_candles_unsupported_symbol_RCL
- BACK: missing, rows=0, range=n/a to n/a, source=UNKNOWN, error=local_csv_candles_unsupported_symbol_BACK
- AVG: missing, rows=0, range=n/a to n/a, source=UNKNOWN, error=local_csv_candles_unsupported_symbol_AVG
- LRCX: missing, rows=0, range=n/a to n/a, source=UNKNOWN, error=local_csv_candles_unsupported_symbol_LRCX
- UNTIL: missing, rows=0, range=n/a to n/a, source=UNKNOWN, error=local_csv_candles_unsupported_symbol_UNTIL
- SET: missing, rows=0, range=n/a to n/a, source=UNKNOWN, error=local_csv_candles_unsupported_symbol_SET
- ONCE: missing, rows=0, range=n/a to n/a, source=UNKNOWN, error=local_csv_candles_unsupported_symbol_ONCE
- NAH: missing, rows=0, range=n/a to n/a, source=UNKNOWN, error=local_csv_candles_unsupported_symbol_NAH
- SAYS: missing, rows=0, range=n/a to n/a, source=UNKNOWN, error=local_csv_candles_unsupported_symbol_SAYS
- STOCK: missing, rows=0, range=n/a to n/a, source=UNKNOWN, error=local_csv_candles_unsupported_symbol_STOCK
- LMAOO: missing, rows=0, range=n/a to n/a, source=UNKNOWN, error=local_csv_candles_unsupported_symbol_LMAOO
- NON: missing, rows=0, range=n/a to n/a, source=UNKNOWN, error=local_csv_candles_unsupported_symbol_NON
- MOVED: missing, rows=0, range=n/a to n/a, source=UNKNOWN, error=local_csv_candles_unsupported_symbol_MOVED
- OPNE: missing, rows=0, range=n/a to n/a, source=UNKNOWN, error=local_csv_candles_unsupported_symbol_OPNE
- OOPS: missing, rows=0, range=n/a to n/a, source=UNKNOWN, error=local_csv_candles_unsupported_symbol_OOPS
- DAYS: missing, rows=0, range=n/a to n/a, source=UNKNOWN, error=local_csv_candles_unsupported_symbol_DAYS
- LL: missing, rows=0, range=n/a to n/a, source=UNKNOWN, error=local_csv_candles_unsupported_symbol_LL
- CRUDE: missing, rows=0, range=n/a to n/a, source=UNKNOWN, error=local_csv_candles_unsupported_symbol_CRUDE
- EVERY: missing, rows=0, range=n/a to n/a, source=UNKNOWN, error=local_csv_candles_unsupported_symbol_EVERY
- SORRY: missing, rows=0, range=n/a to n/a, source=UNKNOWN, error=local_csv_candles_unsupported_symbol_SORRY
- FUN: missing, rows=0, range=n/a to n/a, source=UNKNOWN, error=local_csv_candles_unsupported_symbol_FUN
- LOVE: missing, rows=0, range=n/a to n/a, source=UNKNOWN, error=local_csv_candles_unsupported_symbol_LOVE
- PRE: missing, rows=0, range=n/a to n/a, source=UNKNOWN, error=local_csv_candles_unsupported_symbol_PRE
- WIDE: missing, rows=0, range=n/a to n/a, source=UNKNOWN, error=local_csv_candles_unsupported_symbol_WIDE
- LEU: missing, rows=0, range=n/a to n/a, source=UNKNOWN, error=local_csv_candles_unsupported_symbol_LEU
- LLYP: missing, rows=0, range=n/a to n/a, source=UNKNOWN, error=local_csv_candles_unsupported_symbol_LLYP
- SOLID: missing, rows=0, range=n/a to n/a, source=UNKNOWN, error=local_csv_candles_unsupported_symbol_SOLID
- COST: missing, rows=0, range=n/a to n/a, source=UNKNOWN, error=local_csv_candles_unsupported_symbol_COST
- DIDNT: missing, rows=0, range=n/a to n/a, source=UNKNOWN, error=local_csv_candles_unsupported_symbol_DIDNT
- WANT: missing, rows=0, range=n/a to n/a, source=UNKNOWN, error=local_csv_candles_unsupported_symbol_WANT
- CPI: missing, rows=0, range=n/a to n/a, source=UNKNOWN, error=local_csv_candles_unsupported_symbol_CPI
- BIDU: missing, rows=0, range=n/a to n/a, source=UNKNOWN, error=local_csv_candles_unsupported_symbol_BIDU
- LOTTA: missing, rows=0, range=n/a to n/a, source=UNKNOWN, error=local_csv_candles_unsupported_symbol_LOTTA
- TLT: missing, rows=0, range=n/a to n/a, source=UNKNOWN, error=local_csv_candles_unsupported_symbol_TLT
- LOVES: missing, rows=0, range=n/a to n/a, source=UNKNOWN, error=local_csv_candles_unsupported_symbol_LOVES
- PROFT: missing, rows=0, range=n/a to n/a, source=UNKNOWN, error=local_csv_candles_unsupported_symbol_PROFT
- GOD: missing, rows=0, range=n/a to n/a, source=UNKNOWN, error=local_csv_candles_unsupported_symbol_GOD
- HARD: missing, rows=0, range=n/a to n/a, source=UNKNOWN, error=local_csv_candles_unsupported_symbol_HARD
- DDOG: missing, rows=0, range=n/a to n/a, source=UNKNOWN, error=local_csv_candles_unsupported_symbol_DDOG
- US: missing, rows=0, range=n/a to n/a, source=UNKNOWN, error=local_csv_candles_unsupported_symbol_US
- LOOKS: missing, rows=0, range=n/a to n/a, source=UNKNOWN, error=local_csv_candles_unsupported_symbol_LOOKS
- CL: missing, rows=0, range=n/a to n/a, source=UNKNOWN, error=local_csv_candles_unsupported_symbol_CL
- TRADE: missing, rows=0, range=n/a to n/a, source=UNKNOWN, error=local_csv_candles_unsupported_symbol_TRADE
- ABOUT: missing, rows=0, range=n/a to n/a, source=UNKNOWN, error=local_csv_candles_unsupported_symbol_ABOUT
- BOBBY: missing, rows=0, range=n/a to n/a, source=UNKNOWN, error=local_csv_candles_unsupported_symbol_BOBBY
- MAIN: missing, rows=0, range=n/a to n/a, source=UNKNOWN, error=local_csv_candles_unsupported_symbol_MAIN
- TWO: missing, rows=0, range=n/a to n/a, source=UNKNOWN, error=local_csv_candles_unsupported_symbol_TWO
- OKLO: missing, rows=0, range=n/a to n/a, source=UNKNOWN, error=local_csv_candles_unsupported_symbol_OKLO
- TBH: missing, rows=0, range=n/a to n/a, source=UNKNOWN, error=local_csv_candles_unsupported_symbol_TBH
- XLEP: missing, rows=0, range=n/a to n/a, source=UNKNOWN, error=local_csv_candles_unsupported_symbol_XLEP
- INTO: missing, rows=0, range=n/a to n/a, source=UNKNOWN, error=local_csv_candles_unsupported_symbol_INTO
- COULD: missing, rows=0, range=n/a to n/a, source=UNKNOWN, error=local_csv_candles_unsupported_symbol_COULD
- ENJOY: missing, rows=0, range=n/a to n/a, source=UNKNOWN, error=local_csv_candles_unsupported_symbol_ENJOY
- HEARD: missing, rows=0, range=n/a to n/a, source=UNKNOWN, error=local_csv_candles_unsupported_symbol_HEARD
- KNOW: missing, rows=0, range=n/a to n/a, source=UNKNOWN, error=local_csv_candles_unsupported_symbol_KNOW
- UBER: missing, rows=0, range=n/a to n/a, source=UNKNOWN, error=local_csv_candles_unsupported_symbol_UBER
- DONE: missing, rows=0, range=n/a to n/a, source=UNKNOWN, error=local_csv_candles_unsupported_symbol_DONE
- VC: missing, rows=0, range=n/a to n/a, source=UNKNOWN, error=local_csv_candles_unsupported_symbol_VC
- PCALL: missing, rows=0, range=n/a to n/a, source=UNKNOWN, error=local_csv_candles_unsupported_symbol_PCALL
- TOO: missing, rows=0, range=n/a to n/a, source=UNKNOWN, error=local_csv_candles_unsupported_symbol_TOO
- NHOD: missing, rows=0, range=n/a to n/a, source=UNKNOWN, error=local_csv_candles_unsupported_symbol_NHOD
- SHIFT: missing, rows=0, range=n/a to n/a, source=UNKNOWN, error=local_csv_candles_unsupported_symbol_SHIFT
- ALONG: missing, rows=0, range=n/a to n/a, source=UNKNOWN, error=local_csv_candles_unsupported_symbol_ALONG
- TFS: missing, rows=0, range=n/a to n/a, source=UNKNOWN, error=local_csv_candles_unsupported_symbol_TFS
- KILL: missing, rows=0, range=n/a to n/a, source=UNKNOWN, error=local_csv_candles_unsupported_symbol_KILL
- OUR: missing, rows=0, range=n/a to n/a, source=UNKNOWN, error=local_csv_candles_unsupported_symbol_OUR
- LOD: missing, rows=0, range=n/a to n/a, source=UNKNOWN, error=local_csv_candles_unsupported_symbol_LOD
- REAL: missing, rows=0, range=n/a to n/a, source=UNKNOWN, error=local_csv_candles_unsupported_symbol_REAL
- BURRY: missing, rows=0, range=n/a to n/a, source=UNKNOWN, error=local_csv_candles_unsupported_symbol_BURRY
- HES: missing, rows=0, range=n/a to n/a, source=UNKNOWN, error=local_csv_candles_unsupported_symbol_HES
- SPLIT: missing, rows=0, range=n/a to n/a, source=UNKNOWN, error=local_csv_candles_unsupported_symbol_SPLIT
- TTD: missing, rows=0, range=n/a to n/a, source=UNKNOWN, error=local_csv_candles_unsupported_symbol_TTD
- PM: missing, rows=0, range=n/a to n/a, source=UNKNOWN, error=local_csv_candles_unsupported_symbol_PM
- VERY: missing, rows=0, range=n/a to n/a, source=UNKNOWN, error=local_csv_candles_unsupported_symbol_VERY
- KANA: missing, rows=0, range=n/a to n/a, source=UNKNOWN, error=local_csv_candles_unsupported_symbol_KANA
- LEVEL: missing, rows=0, range=n/a to n/a, source=UNKNOWN, error=local_csv_candles_unsupported_symbol_LEVEL
- KAP: missing, rows=0, range=n/a to n/a, source=UNKNOWN, error=local_csv_candles_unsupported_symbol_KAP
- GOOGL: missing, rows=0, range=n/a to n/a, source=UNKNOWN, error=local_csv_candles_unsupported_symbol_GOOGL
- IREN: missing, rows=0, range=n/a to n/a, source=UNKNOWN, error=local_csv_candles_unsupported_symbol_IREN
- AIR: missing, rows=0, range=n/a to n/a, source=UNKNOWN, error=local_csv_candles_unsupported_symbol_AIR
- AAAND: missing, rows=0, range=n/a to n/a, source=UNKNOWN, error=local_csv_candles_unsupported_symbol_AAAND
- AI: missing, rows=0, range=n/a to n/a, source=UNKNOWN, error=local_csv_candles_unsupported_symbol_AI
- TENDS: missing, rows=0, range=n/a to n/a, source=UNKNOWN, error=local_csv_candles_unsupported_symbol_TENDS
- SUPER: missing, rows=0, range=n/a to n/a, source=UNKNOWN, error=local_csv_candles_unsupported_symbol_SUPER
- ID: missing, rows=0, range=n/a to n/a, source=UNKNOWN, error=local_csv_candles_unsupported_symbol_ID
- BAH: missing, rows=0, range=n/a to n/a, source=UNKNOWN, error=local_csv_candles_unsupported_symbol_BAH
- MIN: missing, rows=0, range=n/a to n/a, source=UNKNOWN, error=local_csv_candles_unsupported_symbol_MIN
- APR: missing, rows=0, range=n/a to n/a, source=UNKNOWN, error=local_csv_candles_unsupported_symbol_APR
- FEW: missing, rows=0, range=n/a to n/a, source=UNKNOWN, error=local_csv_candles_unsupported_symbol_FEW
- PDH: missing, rows=0, range=n/a to n/a, source=UNKNOWN, error=local_csv_candles_unsupported_symbol_PDH
- LIMIT: missing, rows=0, range=n/a to n/a, source=UNKNOWN, error=local_csv_candles_unsupported_symbol_LIMIT
- TOP: missing, rows=0, range=n/a to n/a, source=UNKNOWN, error=local_csv_candles_unsupported_symbol_TOP
- BREAK: missing, rows=0, range=n/a to n/a, source=UNKNOWN, error=local_csv_candles_unsupported_symbol_BREAK
- PHEW: missing, rows=0, range=n/a to n/a, source=UNKNOWN, error=local_csv_candles_unsupported_symbol_PHEW
- URA: missing, rows=0, range=n/a to n/a, source=UNKNOWN, error=local_csv_candles_unsupported_symbol_URA
- CHOSE: missing, rows=0, range=n/a to n/a, source=UNKNOWN, error=local_csv_candles_unsupported_symbol_CHOSE
- TMRW: missing, rows=0, range=n/a to n/a, source=UNKNOWN, error=local_csv_candles_unsupported_symbol_TMRW
- CIEN: missing, rows=0, range=n/a to n/a, source=UNKNOWN, error=local_csv_candles_unsupported_symbol_CIEN
- PATH: missing, rows=0, range=n/a to n/a, source=UNKNOWN, error=local_csv_candles_unsupported_symbol_PATH
- BAR: missing, rows=0, range=n/a to n/a, source=UNKNOWN, error=local_csv_candles_unsupported_symbol_BAR
- SHE: missing, rows=0, range=n/a to n/a, source=UNKNOWN, error=local_csv_candles_unsupported_symbol_SHE
- MRVL: missing, rows=0, range=n/a to n/a, source=UNKNOWN, error=local_csv_candles_unsupported_symbol_MRVL
- FIRE: missing, rows=0, range=n/a to n/a, source=UNKNOWN, error=local_csv_candles_unsupported_symbol_FIRE
- NOPE: missing, rows=0, range=n/a to n/a, source=UNKNOWN, error=local_csv_candles_unsupported_symbol_NOPE
- NOR: missing, rows=0, range=n/a to n/a, source=UNKNOWN, error=local_csv_candles_unsupported_symbol_NOR
- LOSS: missing, rows=0, range=n/a to n/a, source=UNKNOWN, error=local_csv_candles_unsupported_symbol_LOSS
- FOLKS: missing, rows=0, range=n/a to n/a, source=UNKNOWN, error=local_csv_candles_unsupported_symbol_FOLKS
- SHOCK: missing, rows=0, range=n/a to n/a, source=UNKNOWN, error=local_csv_candles_unsupported_symbol_SHOCK
- ELON: missing, rows=0, range=n/a to n/a, source=UNKNOWN, error=local_csv_candles_unsupported_symbol_ELON
- FEE: missing, rows=0, range=n/a to n/a, source=UNKNOWN, error=local_csv_candles_unsupported_symbol_FEE
- YEARS: missing, rows=0, range=n/a to n/a, source=UNKNOWN, error=local_csv_candles_unsupported_symbol_YEARS
- HELL: missing, rows=0, range=n/a to n/a, source=UNKNOWN, error=local_csv_candles_unsupported_symbol_HELL
- STACK: missing, rows=0, range=n/a to n/a, source=UNKNOWN, error=local_csv_candles_unsupported_symbol_STACK
- LITE: missing, rows=0, range=n/a to n/a, source=UNKNOWN, error=local_csv_candles_unsupported_symbol_LITE
- HEY: missing, rows=0, range=n/a to n/a, source=UNKNOWN, error=local_csv_candles_unsupported_symbol_HEY
- GOTTA: missing, rows=0, range=n/a to n/a, source=UNKNOWN, error=local_csv_candles_unsupported_symbol_GOTTA
- PLZ: missing, rows=0, range=n/a to n/a, source=UNKNOWN, error=local_csv_candles_unsupported_symbol_PLZ
- AN: missing, rows=0, range=n/a to n/a, source=UNKNOWN, error=local_csv_candles_unsupported_symbol_AN
- NEVER: missing, rows=0, range=n/a to n/a, source=UNKNOWN, error=local_csv_candles_unsupported_symbol_NEVER
- JUS: missing, rows=0, range=n/a to n/a, source=UNKNOWN, error=local_csv_candles_unsupported_symbol_JUS
- THEN: missing, rows=0, range=n/a to n/a, source=UNKNOWN, error=local_csv_candles_unsupported_symbol_THEN
- POOR: missing, rows=0, range=n/a to n/a, source=UNKNOWN, error=local_csv_candles_unsupported_symbol_POOR
- CANT: missing, rows=0, range=n/a to n/a, source=UNKNOWN, error=local_csv_candles_unsupported_symbol_CANT
- OXY: missing, rows=0, range=n/a to n/a, source=UNKNOWN, error=local_csv_candles_unsupported_symbol_OXY
- WISH: missing, rows=0, range=n/a to n/a, source=UNKNOWN, error=local_csv_candles_unsupported_symbol_WISH
- APES: missing, rows=0, range=n/a to n/a, source=UNKNOWN, error=local_csv_candles_unsupported_symbol_APES
- WMB: missing, rows=0, range=n/a to n/a, source=UNKNOWN, error=local_csv_candles_unsupported_symbol_WMB
- NXT: missing, rows=0, range=n/a to n/a, source=UNKNOWN, error=local_csv_candles_unsupported_symbol_NXT
- UAMY: missing, rows=0, range=n/a to n/a, source=UNKNOWN, error=local_csv_candles_unsupported_symbol_UAMY
- ZS: missing, rows=0, range=n/a to n/a, source=UNKNOWN, error=local_csv_candles_unsupported_symbol_ZS
- DKNG: missing, rows=0, range=n/a to n/a, source=UNKNOWN, error=local_csv_candles_unsupported_symbol_DKNG
- SSD: missing, rows=0, range=n/a to n/a, source=UNKNOWN, error=local_csv_candles_unsupported_symbol_SSD
- NOC: missing, rows=0, range=n/a to n/a, source=UNKNOWN, error=local_csv_candles_unsupported_symbol_NOC
- DG: missing, rows=0, range=n/a to n/a, source=UNKNOWN, error=local_csv_candles_unsupported_symbol_DG
- DIDN: missing, rows=0, range=n/a to n/a, source=UNKNOWN, error=local_csv_candles_unsupported_symbol_DIDN
- CPNG: missing, rows=0, range=n/a to n/a, source=UNKNOWN, error=local_csv_candles_unsupported_symbol_CPNG
- NBIS: missing, rows=0, range=n/a to n/a, source=UNKNOWN, error=local_csv_candles_unsupported_symbol_NBIS
- MARA: missing, rows=0, range=n/a to n/a, source=UNKNOWN, error=local_csv_candles_unsupported_symbol_MARA
- PICK: missing, rows=0, range=n/a to n/a, source=UNKNOWN, error=local_csv_candles_unsupported_symbol_PICK
- NOK: missing, rows=0, range=n/a to n/a, source=UNKNOWN, error=local_csv_candles_unsupported_symbol_NOK
- HUBS: missing, rows=0, range=n/a to n/a, source=UNKNOWN, error=local_csv_candles_unsupported_symbol_HUBS

No-lookahead rule: entries use only candles after the message timestamp. Pre-entry features use candles at or before the call time.

## Backtest Assumptions

- Entry: market/here uses next available candle; levels/zones require post-call touch.
- Exit: explicit linked close/stop/target updates win first; otherwise target/stop simulation is used when available.
- Same-candle stop/target policy: `intrabar_ambiguous`.
- Max hold: 390 minutes.
- Commission: not configured; gross only.
- Slippage ticks: 0

## Overall Performance

- Backtestable trades: 160 / 2235
- Wins: 1
- Losses: 14
- Partial: 0
- Unresolved: 125
- Hit rate: 0.6%
- Win rate: 6.7%
- Average win points: 0
- Average loss points: 2717.50
- Expectancy points: 136.33
- Average R: 0.026
- Profit factor: 1.312
- Average time to close seconds: 13506.90

## Analyst Leaderboard

| Analyst | Backtestable | Wins | Losses | Hit Rate | Expectancy Pts | Avg R | Caveat |
|---|---:|---:|---:|---:|---:|---:|---|
| 1460112508739256492 | 0 | 0 | 0 | n/a | n/a | n/a | low sample |
| 727227550459232287 | 0 | 0 | 0 | n/a | n/a | n/a | low sample |
| 755259514068009041 | 0 | 0 | 0 | n/a | n/a | n/a | low sample |
| 260504760669569025 | 0 | 0 | 0 | n/a | n/a | n/a | low sample |
| 380840741846646784 | 0 | 0 | 0 | n/a | n/a | n/a | low sample |
| 207606301805641728 | 0 | 0 | 0 | n/a | n/a | n/a | low sample |
| 890654687882276884 | 0 | 0 | 0 | n/a | n/a | n/a | low sample |
| mathemeatloaf7 | 47 | 1 | 3 | 2.1% | -382.68 | -0.062 | sample still exploratory |
| bobbyaxl | 33 | 0 | 3 | 0.0% | -374.62 | -0.026 | sample still exploratory |
| kaprik0rn3 | 31 | 0 | 7 | 0.0% | 832.26 | 0.136 | sample still exploratory |
| kanabis16 | 25 | 0 | 0 | 0.0% | 7.77 | 0.001 | sample still exploratory |
| followthewhiterabblt | 16 | 0 | 0 | 0.0% | -15.38 | -0.002 | low sample |

## Symbol Results

| Symbol | Backtestable | Hit Rate | Expectancy Pts | Avg Win | Avg Loss |
|---|---:|---:|---:|---:|---:|
| SPX | 92 | 0.0% | -104.38 | n/a | 2387.61 |
| IF | 0 | n/a | n/a | n/a | n/a |
| SPY | 56 | 0.0% | 676.57 | n/a | 5890.67 |
| THE | 0 | n/a | n/a | n/a | n/a |
| unknown | 0 | n/a | n/a | n/a | n/a |
| WE | 0 | n/a | n/a | n/a | n/a |
| THAT | 0 | n/a | n/a | n/a | n/a |
| JUST | 0 | n/a | n/a | n/a | n/a |
| FOR | 0 | n/a | n/a | n/a | n/a |
| NOT | 0 | n/a | n/a | n/a | n/a |
| FDX | 0 | n/a | n/a | n/a | n/a |
| ALL | 0 | n/a | n/a | n/a | n/a |

## Heatmap Analysis

- Heatmaps cataloged: 486
- Heatmap links to trades: 485
- without_heatmap: 55 backtestable, hit rate 1.8%, expectancy 111.36
- with_heatmap: 105 backtestable, hit rate 0.0%, expectancy 149.42

## Market-Condition Analysis

- morning: 45 backtestable, hit rate 0.0%, expectancy -300.71
- market_open: 15 backtestable, hit rate 0.0%, expectancy -57.98
- midday: 54 backtestable, hit rate 1.9%, expectancy 55.72
- afternoon: 16 backtestable, hit rate 0.0%, expectancy 0.89
- after_hours: 6 backtestable, hit rate 0.0%, expectancy 1097.21
- premarket: 11 backtestable, hit rate 0.0%, expectancy 2382.42
- futures_overnight: 1 backtestable, hit rate 0.0%, expectancy 50.25
- power_hour: 12 backtestable, hit rate 0.0%, expectancy 29.30

## Gains Analysis

- Linked gains: 38
- Gains-only/unverified: 161
Gains-only screenshots/captions are not counted as verified trade calls unless linked to an earlier call.

## Caveats

- Exploratory research only; no live execution.
- Gains-only posts are not counted as verified calls unless linked to a prior call.
- Net results are unavailable when commission config is missing.
- Same-candle target/stop collisions are ambiguous unless configured otherwise.
- Percent metrics are price move percentages, not account returns.
- Missing market data creates invalid/unbacktestable results; no prices are fabricated.
- Intrabar ambiguity is not resolved with unavailable lower timeframe data.
- Any edge is exploratory until validated out of sample.

## Output Files

- summary_json: `artifacts/stage2/stage2_results_v1.json`
- parsed_trades_csv: `artifacts/stage2/stage2_trades_v1.csv`
- backtest_csv: `artifacts/stage2/stage2_backtest_v1.csv`
- report_md: `reports/stage2/stage2_report_v1.md`

## Sample Parsed Messages

- 2026-01-28T16:22:07.546Z | mathemeatloaf7 | VIX | long | market | partial
- 2026-01-29T14:55:11.446Z | mathemeatloaf7 | VIX | long | zone | partial
- 2026-01-29T16:13:48.323Z | mathemeatloaf7 | ALL | long | market | partial
- 2026-01-29T17:04:00.739Z | mathemeatloaf7 | SPY | long | market | partial
- 2026-02-09T15:19:53.688Z | mathemeatloaf7 | QQQ | long | zone | partial
