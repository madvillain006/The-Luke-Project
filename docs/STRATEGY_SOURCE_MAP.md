# Strategy Source Map

## Primary Roles

### Ximes
- Role: primary execution source.
- Current repo source: `ximes-dubz` in `discord-history.jsonl`, plus processed export `discord-exports/processed/*ximes*`.
- What it contributes:
  - entry ideas
  - session timing
  - exact levels
  - invalidation language
  - adds / partials / management clues
  - conviction and urgency
- What it does not contribute:
  - standalone regime model
  - broad gamma/flow backdrop
  - durable heatmap structure on its own

### Bobby
- Role: level / heatmap context source.
- Current repo source: `bobby-spx-coms` in `discord-history.jsonl`, plus processed export `discord-exports/processed/*bobby*`.
- What it contributes:
  - structural levels
  - heatmap nodes
  - magnet / flip / support / resistance context
  - expected reaction zones
- What it does not contribute:
  - primary trigger authority
  - full execution plan
  - trade management model

### Sybil via KatBot
- Role: regime / confluence intelligence lane.
- Current repo reality: there is no single discrete `sybil` feed in the repo.
- Current practical source bundle feeding this lane:
  - `Direct Messages - OWLS Capital Clanker [1450560212900647016].txt`
  - `Direct Messages - Flow [1417517605576638484].txt`
  - `Direct Messages - bigT [963573643194015814].txt`
  - `Direct Messages - BarrySanders329 [1137717841609629786].txt`
  - `giul-heatseeker`
- What it contributes:
  - flow / scanner context
  - market tone
  - regime pressure
  - macro / event / positioning cues
  - press / do-not-press environment context
- What it does not contribute:
  - direct override of Ximes execution logic
  - direct live execution triggers

## Precedence Rules

### Ximes overrides Bobby when:
- Ximes gives a concrete entry, reclaim, rejection, break/retest, or invalidation.
- Bobby only provides broad structural context without a same-session trigger.

### Bobby supports Ximes when:
- Bobby level clusters are near the Ximes trigger.
- Bobby heatmap / flip / magnet context improves location quality.
- Bobby reduces ambiguity about where a reaction should happen.

### Bobby does not override Ximes when:
- Bobby is only macro or descriptive.
- Bobby levels are too broad or stale for intraday use.
- Bobby image interpretation is low confidence.

### Sybil / KatBot affects only:
- selectivity
- pressure environment
- confidence to press or stand down
- context scoring

Sybil / KatBot does not currently decide:
- raw entry trigger
- stop placement by itself
- direct adds
- live order timing

## Decision Influence Matrix

| Decision | Ximes | Bobby | Sybil/KatBot |
|---|---|---|---|
| Entry trigger | primary | support only | no |
| Level quality | primary | primary support | support only |
| Stop / invalidation | primary | support only | no |
| Adds | primary | support only | no |
| Management style | primary | support only | no |
| Regime / press environment | support | support | primary |
| Stand-down / caution bias | support | support | primary |

## Current Repo Gaps

- Old standalone agent routing has been removed; Sybil-style context now belongs under KatBot Stage 2.
- `trading/signals.js` currently consumes recent `ximes` and `bobby` insights only; Sybil/KatBot context is not fully wired into 02B execution.
- Bobby is still mostly text-extracted from screenshots, not yet a dedicated heatmap interpreter.
- Ximes/Bobby/Sybil records are not yet normalized into one structured research store.
