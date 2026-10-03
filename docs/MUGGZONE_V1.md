# MuggZone Options cloud shadow observer

Implemented October 3, 2026 against `madvillain006/The-Luke-Project` commit
`a87e4d85685dc453b27084ae78e18fd282ce825f`. That published source is dated May 17;
the September local Windows installation has not been copied or certified here.
All existing Stage 2 modules are retained unchanged. Only the new MuggZone slice
is added. NASA/Sully, research engines, audio, charts, broker routing and Electron
are outside this implementation.

## Behavior

One manually authenticated Chromium tab supplies rendered text for one exact
Discord channel and an explicit author-ID allowlist. The observer scrolls to the
tail every four minutes within 08:00–17:00 America/New_York Monday–Friday. It proves
message-ID overlap through bounded backward scrolling; it does not treat a tail
screenshot as proof that every intervening post was acquired. Stable author IDs,
text, message IDs and publication timestamps are required. Image-only messages
and unavailable metadata require review. Add explicit closure dates to the
configuration; this weekday schedule is not an exchange holiday calendar.

The first successful read creates a historical baseline. Historical posts,
including older posts exposed by later catch-up scrolling, cannot become new
entries. Repeated IDs/content revisions are deduplicated in SQLite. Source edits
freeze affected announced state. Publication and observation timestamps remain
separate, so the polling delay is visible in receipts.

The adapter calls existing Stage 2 parsers, then guards their output with explicit
identity and action requirements. It represents OPEN, TP1/2/3 hits, trims,
breakeven, stop changes/hits, close, cancellation and adds. Compound management is
retained. It requires a valid explicit expiry and underlying for new entries;
yearless expiry and 0DTE resolve only from the publication date in New York with
provenance. It accepts fewer ambiguous expressions than the legacy parser.
Multiple contracts, spreads, unsupported DTE, conflicting or conditional language
and uncertainty require review. Calibrate this against actual MuggZone examples
before treating it as an unattended production observer.

Management links through a stable reply ID or a unique matching active contract
from the same author/channel. Partial strike/side selectors constrain that match.
The most recent unrelated trade is never silently selected. A whole compound
message validates before state changes persist. SQLite transactions cover the
revision, instructions, trade state and receipt together.

Unresolved source instructions create durable author holds. Acquisition health
and source review are separate fields. Restarting does not clear a source hold;
the runner stops on it. A continuity gap halts the channel. This slice has no
automatic review adjudication: preserve the database/checkpoint and reconcile the
missing or ambiguous source before resuming; do not erase evidence to bypass it.

The ledger tracks announced source state. It does not claim orders, broker
positions, fills, profit, spendable balance or execution readiness. The $300
account concept is context only. A quoted standard contract's gross premium cost
uses the conventional 100 multiplier; actual listing/multiplier, fees and buying
power are unverified. No lot sizing or fractional option execution is invented.

## Run and verify

From the repo root with Node 24:

```sh
node --test tests/muggzone*.node.test.js
node scripts/muggzone-replay.js
```

The replay uses clearly synthetic source messages and an in-memory ledger. It
proves the parser-to-ledger flow, including deduplication and compound management;
it is not a live Discord, cloud-desktop or broker test. Observer tests exercise
virtualized overlapping windows and rendered-DOM fixtures, including grouped
author IDs, reply links, embeds and the actual scrolling viewport.

The container, persistent Chrome profile, SSH-tunnel desktop access and background
observer launcher are described in `deploy/muggzone/README.md`. They have been
prepared and syntax checked, but the image has not been built or served on a pod.
The authenticated Discord DOM still requires a first-run check against the real
channel. Exact MuggZone channel and author IDs must be bound before that check.
No bot token or private Discord endpoint is used.

## Hosting status and cost

The configured RunPod MCP handshake returned `Auth required`, while the existing
RunPod browser session was verified signed in. Existing video-production pods
were observed only; none were modified. No new host was provisioned.

Official A5000 rates checked October 3 were $0.16/hour Community and $0.27/hour
Secure. At 195 average scheduled hours/month, Secure is approximately $54–55 with
10–20 GB network storage and a modest container disk, excluding tax. Stopping
polling does not stop compute billing; actual host start/stop scheduling remains a
deployment step. GPU restart capacity is not guaranteed after release.

The live CPU console quoted 2 vCPU/8 GB at $0.08/hour and 2 vCPU/4 GB at
$0.07/hour, approximately $15.60 or $13.65/month compute for the same schedule.
At those observations both tested CPU families displayed unavailable capacity.
A GPU is unnecessary for the workload. Select the smallest
available persistent Secure CPU host and verify its actual memory use, desktop
startup, external tunnel access, restart recovery and cost controls before delivery.

Sources: https://www.runpod.io/gpu-models/rtx-a5000 and
https://docs.runpod.io/pods/pricing. Live account/capacity observations are dated
evidence rather than guaranteed future availability.
