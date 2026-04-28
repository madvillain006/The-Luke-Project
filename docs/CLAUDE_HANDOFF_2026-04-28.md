# Claude Handoff - 2026-04-28

Read this before changing code.

## What Luke is now

Luke is a local trading copilot for index/futures decision support.

It now has:
- canonical Level Memory
- confluence scoring
- futures recommendation output
- historical replay foundation
- Mancini integration
- Kat sidecar context
- supervised autonomous staging

## Highest-trust live surface

The current highest-trust recommendation surface is:

- `/entries ES`

It is built directly off:
- Level Memory
- confluence scoring
- futures entry zone logic
- Mancini chop-zone vetoes
- fresh-input checks

## Current readiness read

- manual trading copilot: ~93%
- internal alpha / ship-ready with some residue left: ~89%
- autonomous recommender you can trust blindly: ~70%

Autonomous mode is not self-driving. It is still supervised staging.

## What changed in the latest pass

### Recommendation lane hardened

Already in place before this handoff:
- `/entries ES` returns side, entry, acceptable zone, stop, target, RR, sizing
- `/entries` refuses stale or missing inputs
- Mancini chop zones surface as `AVOID`

### Katbot repaired

Already in place before this handoff:
- dead confluence import fixed
- ticker parsing improved for `#ES_F` and `#NQ_F`
- image MIME handling hardened
- proactive Kat strings cleaned up

### Autonomous staging hardened

Latest commit:
- `a294d63` Tighten autonomous staging against `/entries` truth

This did:
- require same-day ET Bobby/Dubz freshness
- block staging if autonomous side disagrees with `/entries`
- block staging if entry is too far from the best confluence anchor
- block staging if entry is inside a Mancini chop zone
- log freshness + confluence evidence for autonomous decisions

Meaning:
- autonomous is now less likely to confidently stage nonsense
- but it is still not the primary truth surface

## Core workflow

1. `/balance`
2. `/saty`
3. `/dubz`
4. `/heatmap`
5. optional `/mancini`
6. `/status`
7. `/verdict`
8. `/entries ES`

If `/entries ES` refuses due to stale inputs, trust the refusal.

## Saty truth

Saty levels are treated as:
- `SPX`

Why:
- they are structural index ATR levels
- Luke stores them as SPX
- ES views inherit them through cross-instrument equivalence

So:
- paste Saty as SPX truth
- use `/entries ES` or `/verdict ES` to see the translated ES view

## Main files that matter

Core:
- `index.js`
- `chat.html`
- `lib/slash-commands.js`
- `lib/system-prompt.js`

Confluence + memory:
- `lib/level-memory.js`
- `lib/confluence-engine.js`
- `lib/futures-entry-zones.js`
- `lib/level-replay.js`
- `lib/historical-data.js`

Parsers:
- `lib/parse-bobby.js`
- `lib/parse-dubz.js`
- `lib/parse-mancini.js`

Autonomous:
- `trading/router.js`
- `trading/signals.js`
- `trading/risk.js`

Kat:
- `agents/agent-14-kat.js`
- `lib/parse-kat.js`
- `lib/kat-confluence.js`

## Known truths and flaws

### Trustworthy

- `/status`
- `/saty`
- `/dubz`
- `/heatmap`
- `/mancini`
- `/verdict`
- `/entries ES`
- Level Memory flow
- confluence score flow
- same-day freshness blocking on recommendation path

### Not fully proven

- market-hours proof that Kat posts back into Discord again
- fresh live-session proof with tomorrow's actual levels
- fully unified autonomous scorer
- full personal-life/Jarvis residue cleanup outside live surfaces

### Current biggest architectural flaw

`trading/signals.js` still picks from Ximes candidates through an older LLM-scoring path.

Even after router hardening, autonomous still begins from:
- Ximes candidate parsing
- legacy Bobby context in `scoreSignals(...)`

The newest router guardrails reduce risk, but the long-term fix is:
- make `/entries`-style confluence the primary decision truth
- make `scoreSignals(...)` a candidate proposer or veto layer, not the lead decider

## Safe next steps

Before or at open:
1. load fresh real inputs
2. verify `/status`
3. verify `/verdict`
4. verify `/entries ES`
5. verify autonomous status but keep it staged-only

After open, if continuing hardening:
1. unify autonomous recommendation logic with `/entries` even more
2. add an autonomous readiness/preflight endpoint
3. prove Kat proactive posting during market hours
4. continue scraping personal-life residue out of non-live agents/docs

## Things not to destabilize casually

- do not weaken stale-input refusal
- do not bypass Mancini chop-zone vetoes
- do not reintroduce `today-levels.json` split-brain for core truth
- do not touch live execution paths right before a session unless explicitly asked

## Repo leftovers intentionally ignored

- `.ws-token`
- `repo-map.json`
- `LAUNCH-LUKE.cmd`
- `scripts/__pycache__/`

Do not waste time treating them like product blockers.


