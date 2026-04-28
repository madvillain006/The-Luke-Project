# Monday morning operational checklist

Run before any trading.

## 1. Live-price grounding integration test (5 min)

Confirms parseBobbyImage and parseDubzImage flow live Polygon prices 
through to classification correctly under real conditions (not mocks).

  $env:MASSIVE_API_KEY="<your key>"
  node scripts/validate-bobby-fixtures.js | tee /tmp/monday-bobby-test.txt
  node scripts/validate-dubz-fixtures.js  | tee /tmp/monday-dubz-test.txt

Expected:
- "[live-price] MASSIVE_API_KEY not set" warnings should be ABSENT
- Bobby panels show current_price values that are recent SPY/QQQ 
  cash data (or last close if pre-market)
- No new exceptions in stderr

If any vision call returns parse_status: failed: STOP. Do not trade.

## 2. pm2 health check

  pm2 list

Expected: luke-server and luke-scheduler both online, no luke-intraday.
If anything is errored or missing, run:
  pm2 reload ecosystem.config.js

## 3. Saty levels load

Open chat UI, paste day's Saty ATR levels via /saty.
Verify response shows 13 levels loaded, no parse errors.

Important:
- Saty levels are stored as SPX structure
- ES views inherit them through equivalence

## 4. Skim crash.log

  Get-Content crash.log -Tail 20

If anything was added since last session: read it. Do not trade if 
new crashes are present without diagnosis.

## 5. Bobby + Dubz dry-run paste

When Bobby or Dubz posts the morning brief:
- Paste into chat (/heatmap for Bobby, /dubz for Dubz)
- Visually verify the parser output matches the message
- Specifically: does the confluence read make sense given what you 
  see by eye?

If parser output looks anomalous compared to what you'd expect from 
reading the message yourself: trust your eyes, not the system. Treat 
the system output with skepticism for that session.

## 6. Pre-trade verdict gate

Never enter a trade off Luke's confluence read alone. Required 
checklist still applies:
- Saty levels loaded
- Bobby heatmap or Kat/Jefe heatmap parsed
- Ximes LIVE_ENTRY signal (text path, untouched in 5d)
- Manual visual verification of all three before pulling the trigger

Then run:
- `/status`
- `/verdict`
- `/entries ES`

Trust `/entries ES` over the older autonomous staging lane if they ever
conflict.

If `/entries ES` refuses because inputs are stale or missing: do not
force it. Load the missing inputs first.

Apex floor is ~$48,053. Do not trade if eyes-on-screen sanity check 
disagrees with system output.
